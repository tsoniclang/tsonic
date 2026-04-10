/**
 * Reference type emission (Array, Promise, Error, etc.)
 *
 * All types are emitted with global:: prefix for unambiguous resolution.
 */

import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { emitTypeAst } from "./emitter.js";
import {
  resolveTypeAlias,
  resolveStructuralReferenceType,
  resolveLocalTypeInfo,
  substituteTypeArgs,
} from "../core/semantic/type-resolution.js";
import { resolveLocalTypeInfoWithoutBindings } from "../core/semantic/property-lookup-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  identifierType,
  nullableType,
  withTypeArguments,
} from "../core/format/backend-ast/builders.js";
import {
  clrTypeNameToTypeAst,
  isCSharpPredefinedTypeKeyword,
} from "../core/format/backend-ast/utils.js";
import {
  attachTypeArgumentsIfSupported,
  emitQualifiedLocalType,
  emitRecursiveAliasFallbackType,
  emitTypeArgAsts,
  identifierTypeWithArgs,
  getReferenceLookupCandidates,
  keyForResolvedLocalType,
  resolveCanonicalLocalTypeTarget,
  resolveImportedTypeAst,
  restoreResolvingTypeAliases,
  toGlobalClr,
  withResolvingTypeAlias,
} from "./reference-lookup.js";
import { resolveBindingBackedStructuralTypeAst } from "./reference-structural-signatures.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../core/semantic/runtime-unions.js";

/**
 * Check if a type name indicates an unsupported support type.
 *
 * NOTE: The emitter does not have access to the TypeScript checker. Support types
 * should be rejected during frontend IR building. This is a defensive guard in case
 * unsupported types leak into IR.
 */
const checkUnsupportedSupportType = (typeName: string): string | undefined => {
  if (
    typeName === "TSUnsafePointer" ||
    typeName.startsWith("TSUnsafePointer<")
  ) {
    return "Unsafe pointers are not supported in Tsonic. Use IntPtr for opaque handles.";
  }
  if (typeName === "TSFixed" || typeName.startsWith("TSFixed<")) {
    return "Fixed-size buffers (unsafe feature) are not supported. Use arrays or Span<T> instead.";
  }
  if (typeName === "TSStackAlloc" || typeName.startsWith("TSStackAlloc<")) {
    return "stackalloc is not supported in Tsonic. Use heap-allocated arrays instead.";
  }
  return undefined;
};

const EXACT_BCL_VALUE_TYPE_MAP = new Map<string, string>([
  ["half", "global::System.Half"],
  ["int128", "global::System.Int128"],
  ["uint128", "global::System.UInt128"],
]);

const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

const isQualifiedClrIdentity = (name: string | undefined): boolean => {
  if (!name) {
    return false;
  }

  const trimmed = name.trim();
  return (
    trimmed.startsWith("global::") ||
    trimmed.includes(".") ||
    trimmed.includes("+")
  );
};

const isSystemObjectClrIdentity = (name: string | undefined): boolean =>
  name === "System.Object" || name === "global::System.Object";

const getDeclaringTypeParameterAsts = (
  context: EmitterContext
): readonly CSharpTypeAst[] =>
  (context.declaringTypeParameterNames ?? []).map((name) =>
    identifierType(context.declaringTypeParameterNameMap?.get(name) ?? name)
  );

/**
 * Emit reference types as CSharpTypeAst
 */
export const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const { name, typeArguments, resolvedClrType, typeId } = type;

  const resolvedAlias = resolveTypeAlias(type, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    stableIrTypeKey(resolvedAlias) !== stableIrTypeKey(type)
  ) {
    if (
      resolvedAlias.kind === "unionType" &&
      resolvedAlias.runtimeCarrierFamilyKey
    ) {
      const [layout, layoutContext] = buildRuntimeUnionLayout(
        type,
        context,
        emitTypeAst
      );
      if (layout) {
        return [buildRuntimeUnionTypeAst(layout), layoutContext];
      }
    }
    return emitTypeAst(resolvedAlias, context);
  }

  const currentModuleNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const currentModuleLocalResolution = resolveLocalTypeInfoWithoutBindings(
    type,
    context
  );
  const currentModuleLocalType =
    currentModuleLocalResolution?.namespace === currentModuleNamespace
      ? currentModuleLocalResolution.info
      : undefined;
  const currentModuleLocalName =
    currentModuleLocalResolution?.namespace === currentModuleNamespace
      ? currentModuleLocalResolution.name
      : undefined;

  // Explicit import contracts are authoritative and must win before any
  // structural or binding-backed rebound. Otherwise same-named sibling types
  // can be reattached to an unrelated owner through registry aliasing.
  const importedTypeAst = resolveImportedTypeAst(name, context);
  if (importedTypeAst) {
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      if (
        importedTypeAst.kind === "identifierType" ||
        importedTypeAst.kind === "qualifiedIdentifierType"
      ) {
        return [withTypeArguments(importedTypeAst, typeArgAsts), newContext];
      }
      return [importedTypeAst, newContext];
    }
    return [importedTypeAst, context];
  }

  const structuralReference = resolveStructuralReferenceType(type, context);
  if (
    structuralReference &&
    structuralReference.kind === "referenceType" &&
    stableIrTypeKey(structuralReference) !== stableIrTypeKey(type)
  ) {
    return emitReferenceType(structuralReference, context);
  }

  if (name === POLYMORPHIC_THIS_MARKER && context.declaringTypeName) {
    const declaringTypeParameterAsts = getDeclaringTypeParameterAsts(context);
    return emitReferenceType(
      {
        ...type,
        name: context.declaringTypeName,
        typeArguments:
          declaringTypeParameterAsts.length > 0
            ? (context.declaringTypeParameterNames ?? []).map((paramName) => ({
                kind: "typeParameterType" as const,
                name: paramName,
              }))
            : undefined,
        resolvedClrType: undefined,
        typeId: undefined,
      },
      context
    );
  }

  // Check if this is a local type alias.
  //
  // C# has no general-purpose type alias syntax at the use-site, so type aliases must be
  // resolved to their underlying type *except* for `objectType` aliases, which are emitted
  // as concrete classes with a `__Alias` suffix.
  //
  // Examples:
  // - `type Pair = [number, number]`      → `global::System.ValueTuple<double, double>`
  // - `type Auth = { ok: true } | { error: string }`
  //                                   → compiler-owned runtime union carrier
  // - `type Point = { x: number; y: number }`
  //                                   → `Point__Alias` (class emitted elsewhere)
  const typeInfo = context.localTypes?.get(name);
  if (typeInfo && typeInfo.kind === "typeAlias") {
    const underlyingKind = typeInfo.type.kind;
    // Resolve all non-object type aliases; object aliases are emitted as classes.
    const shouldResolve = underlyingKind !== "objectType";

    if (shouldResolve) {
      const substitutedUnderlyingType =
        typeArguments && typeArguments.length > 0
          ? substituteTypeArgs(
              typeInfo.type,
              typeInfo.typeParameters,
              typeArguments
            )
          : typeInfo.type;
      if (context.resolvingTypeAliases?.has(name)) {
        return emitRecursiveAliasFallbackType(substitutedUnderlyingType, context);
      }
      const [resolvedAst, resolvedContext] = emitTypeAst(
        substitutedUnderlyingType,
        withResolvingTypeAlias(name, context)
      );
      return [
        resolvedAst,
        restoreResolvingTypeAliases(resolvedContext, context),
      ];
    }
    // For `objectType` aliases - fall through and emit the alias name; it will be
    // rewritten to `__Alias` in the local-type handling below.
  }

  // Check for unsupported support types
  const unsupportedError = checkUnsupportedSupportType(name);
  if (unsupportedError) {
    throw new Error(`[Tsonic] ${unsupportedError}`);
  }

  if (name === "Promise" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      return [identifierType("global::System.Threading.Tasks.Task"), context];
    }
    const [elementTypeAst, newContext] = emitTypeAst(firstArg, context);
    // Promise<void> should map to Task (not Task<void>)
    if (
      elementTypeAst.kind === "predefinedType" &&
      elementTypeAst.keyword === "void"
    ) {
      return [
        identifierType("global::System.Threading.Tasks.Task"),
        newContext,
      ];
    }
    return [
      identifierType("global::System.Threading.Tasks.Task", [elementTypeAst]),
      newContext,
    ];
  }

  if (name === "Promise") {
    return [identifierType("global::System.Threading.Tasks.Task"), context];
  }

  if (
    name === "Iterable" ||
    name === "IterableIterator" ||
    name === "Generator"
  ) {
    const elementType = typeArguments?.[0] ?? { kind: "unknownType" };
    const [elementTypeAst, newContext] = emitTypeAst(elementType, context);
    return [
      identifierType("global::System.Collections.Generic.IEnumerable", [
        elementTypeAst,
      ]),
      newContext,
    ];
  }

  if (
    name === "AsyncIterable" ||
    name === "AsyncIterableIterator" ||
    name === "AsyncGenerator"
  ) {
    const elementType = typeArguments?.[0] ?? { kind: "unknownType" };
    const [elementTypeAst, newContext] = emitTypeAst(elementType, context);
    return [
      identifierType("global::System.Collections.Generic.IAsyncEnumerable", [
        elementTypeAst,
      ]),
      newContext,
    ];
  }

  // Map core Span<T> to System.Span<T>.
  // This is used by stackalloc<T>(n) and other span-based APIs.
  if (name === "Span") {
    if (!typeArguments || typeArguments.length !== 1) {
      throw new Error(
        `ICE: Span must have exactly 1 type argument, got ${typeArguments?.length ?? 0}`
      );
    }
    const inner = typeArguments[0];
    if (!inner) {
      throw new Error("ICE: Span<T> missing type argument");
    }
    const [innerTypeAst, newContext] = emitTypeAst(inner, context);
    return [identifierType("global::System.Span", [innerTypeAst]), newContext];
  }

  // Map core ptr<T> to C# unsafe pointer type: T*
  if (name === "ptr") {
    if (!typeArguments || typeArguments.length !== 1) {
      throw new Error(
        `ICE: ptr must have exactly 1 type argument, got ${typeArguments?.length ?? 0}`
      );
    }
    const inner = typeArguments[0];
    if (!inner) {
      throw new Error("ICE: ptr<T> missing type argument");
    }
    const [innerTypeAst, newContext] = emitTypeAst(inner, context);
    return [{ kind: "pointerType", elementType: innerTypeAst }, newContext];
  }

  // NOTE: Map and Set must be explicitly imported (not ambient)

  if (name === "JsPrimitive") {
    return [{ kind: "predefinedType", keyword: "object" }, context];
  }

  if (name === "JsValue") {
    return [
      nullableType({ kind: "predefinedType", keyword: "object" }),
      context,
    ];
  }

  // Map PromiseLike to Task
  if (name === "PromiseLike") {
    const firstArg = typeArguments?.[0];
    if (!firstArg) {
      return [identifierType("global::System.Threading.Tasks.Task"), context];
    }

    const [elementTypeAst, newContext] = emitTypeAst(firstArg, context);
    if (
      elementTypeAst.kind === "predefinedType" &&
      elementTypeAst.keyword === "void"
    ) {
      return [
        identifierType("global::System.Threading.Tasks.Task"),
        newContext,
      ];
    }

    return [
      identifierType("global::System.Threading.Tasks.Task", [elementTypeAst]),
      newContext,
    ];
  }

  // C# primitive types can be emitted directly
  if (isCSharpPredefinedTypeKeyword(name)) {
    return [{ kind: "predefinedType", keyword: name }, context];
  }

  const exactBclValueType = EXACT_BCL_VALUE_TYPE_MAP.get(name);
  if (exactBclValueType) {
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [
        identifierTypeWithArgs(exactBclValueType, typeArgAsts),
        newContext,
      ];
    }
    return [identifierType(exactBclValueType), context];
  }

  // Type parameters in scope can be emitted directly
  if (context.typeParameters?.has(name)) {
    const mappedName = context.typeParameterNameMap?.get(name) ?? name;
    return [identifierType(mappedName), context];
  }

  // Source-package local types compiled in this program must win over imported CLR
  // metadata names. Imported aliases/interfaces often carry a nominal resolvedClrType,
  // but if their real definition is present in moduleMap we need to emit from that
  // local definition instead of treating them as precompiled external CLR types.
  //
  // Do not route current-module locals through this path. Same-module locals need the
  // later local-type handling because it intentionally keeps local references short
  // unless `qualifyLocalTypes` is explicitly enabled.
  if (!currentModuleLocalType) {
    const crossModuleLocalType = resolveLocalTypeInfo(type, context);
    if (crossModuleLocalType) {
      const { info, namespace, name: resolvedLocalName } = crossModuleLocalType;

      if (info.kind === "typeAlias") {
        const underlyingKind = info.type.kind;
        if (underlyingKind !== "objectType") {
          const substitutedUnderlyingType =
            typeArguments && typeArguments.length > 0
              ? substituteTypeArgs(info.type, info.typeParameters, typeArguments)
              : info.type;
          const aliasKey = keyForResolvedLocalType(name, namespace);
          if (context.resolvingTypeAliases?.has(aliasKey)) {
            return emitRecursiveAliasFallbackType(substitutedUnderlyingType, context);
          }
          const [resolvedAst, resolvedContext] = emitTypeAst(
            substitutedUnderlyingType,
            withResolvingTypeAlias(aliasKey, context)
          );
          return [
            resolvedAst,
            restoreResolvingTypeAliases(resolvedContext, context),
          ];
        }

        return emitQualifiedLocalType(
          namespace,
          `${resolvedLocalName}__Alias`,
          typeArguments,
          context
        );
      }

      return emitQualifiedLocalType(
        namespace,
        resolvedLocalName,
        typeArguments,
        context
      );
    }
  }

  // Check if this type is imported - use pre-computed type AST directly.
  // Exact source/CLR import bindings are authoritative for imported simple names.
  // resolvedClrType can carry stale nominal identity when frontend/binding paths
  // collapse same-named exported types from sibling modules; the explicit import
  // contract must win in that case.
  //
  // This includes canonicalization for tsbindgen instance aliases (Foo$instance)
  // so imported type identity remains stable even when global aliases collide.
  // If the type has a pre-resolved CLR type (from IR), use it
  if (
    (!currentModuleLocalType ||
      context.preferResolvedLocalClrIdentity ||
      isSystemObjectClrIdentity(resolvedClrType)) &&
    isQualifiedClrIdentity(resolvedClrType)
  ) {
    const typeAst = clrTypeNameToTypeAst(
      toGlobalClr(resolvedClrType as string)
    );
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      if (
        typeAst.kind === "identifierType" ||
        typeAst.kind === "qualifiedIdentifierType"
      ) {
        return [withTypeArguments(typeAst, typeArgAsts), newContext];
      }
      return [typeAst, newContext];
    }
    return [typeAst, context];
  }

  const bindingBackedStructuralTypeAst = !currentModuleLocalType
    ? resolveBindingBackedStructuralTypeAst(type, context)
    : undefined;
  if (bindingBackedStructuralTypeAst) {
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      if (
        bindingBackedStructuralTypeAst.kind === "identifierType" ||
        bindingBackedStructuralTypeAst.kind === "qualifiedIdentifierType"
      ) {
        return [
          withTypeArguments(bindingBackedStructuralTypeAst, typeArgAsts),
          newContext,
        ];
      }
      return [bindingBackedStructuralTypeAst, newContext];
    }
    return [bindingBackedStructuralTypeAst, context];
  }

  const canonicalLocalTarget = resolveCanonicalLocalTypeTarget(name, context);
  if (canonicalLocalTarget) {
    const qualified = toGlobalClr(canonicalLocalTarget);
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
    }
    return [identifierType(qualified), context];
  }

  // IMPORTANT: Check local types BEFORE binding registry.
  // Local types take precedence over .NET types with the same name.
  // This ensures that a locally defined `Container<T>` is not resolved
  // to `System.ComponentModel.Container` from the binding registry.
  const localTypeInfo = currentModuleLocalType;
  if (localTypeInfo) {
    let csharpName = currentModuleLocalName ?? name;
    const shouldForceQualifiedLocalType =
      csharpName.startsWith("__Anon_") || csharpName.startsWith("__Rest_");

    // Type aliases with objectType underlying type are emitted as classes with __Alias suffix
    // (per spec/16-types-and-interfaces.md §3.4)
    if (
      localTypeInfo.kind === "typeAlias" &&
      localTypeInfo.type.kind === "objectType"
    ) {
      csharpName = `${csharpName}__Alias`;
    }

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);

      if (!context.qualifyLocalTypes && !shouldForceQualifiedLocalType) {
        return [identifierTypeWithArgs(csharpName, typeArgAsts), newContext];
      }

      const moduleNamespace =
        context.moduleNamespace ?? context.options.rootNamespace;
      const container = context.moduleStaticClassName;
      const isNestedInStaticContainer =
        localTypeInfo.kind === "typeAlias" &&
        // Structural aliases (objectType) are emitted as namespace-level classes.
        // Only non-structural aliases (comments/erased types) are nested in the static container.
        localTypeInfo.type.kind !== "objectType";
      const qualifiedPrefix =
        isNestedInStaticContainer && container
          ? `${moduleNamespace}.${container}`
          : moduleNamespace;

      return [
        identifierTypeWithArgs(
          `global::${qualifiedPrefix}.${csharpName}`,
          typeArgAsts
        ),
        newContext,
      ];
    }

    if (!context.qualifyLocalTypes && !shouldForceQualifiedLocalType) {
      return [identifierType(csharpName), context];
    }

    const moduleNamespace =
      context.moduleNamespace ?? context.options.rootNamespace;
    const container = context.moduleStaticClassName;
    const isNestedInStaticContainer =
      localTypeInfo.kind === "typeAlias" &&
      localTypeInfo.type.kind !== "objectType";
    const qualifiedPrefix =
      isNestedInStaticContainer && container
        ? `${moduleNamespace}.${container}`
        : moduleNamespace;

    return [
      identifierType(`global::${qualifiedPrefix}.${csharpName}`),
      context,
    ];
  }

  // Handle built-in array-like contracts only after giving concrete local/source
  // declarations a chance to win. Source packages such as @tsonic/js are allowed
  // to define a real exported class named Array, and that must not be erased to T[].
  if (name === "Array" || name === "ReadonlyArray" || name === "ArrayLike") {
    if (resolvedClrType) {
      return [clrTypeNameToTypeAst(toGlobalClr(resolvedClrType)), context];
    }
    const firstArg = typeArguments?.[0];
    if (!firstArg) {
      return [
        {
          kind: "arrayType",
          elementType: { kind: "predefinedType", keyword: "object" },
          rank: 1,
        },
        context,
      ];
    }
    const [elementTypeAst, newContext] = emitTypeAst(firstArg, context);
    return [
      { kind: "arrayType", elementType: elementTypeAst, rank: 1 },
      newContext,
    ];
  }

  // Canonical nominal identity from the UnifiedUniverse.
  // When present, this is the authoritative source for CLR emission and
  // avoids relying on emitter-side registry plumbing for basic type names.
  if (typeId) {
    const typeAst = clrTypeNameToTypeAst(toGlobalClr(typeId.clrName));

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [attachTypeArgumentsIfSupported(typeAst, typeArgAsts), newContext];
    }

    return [typeAst, context];
  }

  // Resolve external types via binding registry (must be fully qualified)
  // This handles types from contextual inference (e.g., Action from Parallel.invoke)
  // IMPORTANT: This is checked AFTER localTypes to ensure local types take precedence
  for (const candidate of getReferenceLookupCandidates(name)) {
    const regBinding = context.bindingsRegistry?.get(candidate);
    if (!regBinding) continue;

    const typeAst = clrTypeNameToTypeAst(toGlobalClr(regBinding.name));

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [attachTypeArgumentsIfSupported(typeAst, typeArgAsts), newContext];
    }

    return [typeAst, context];
  }

  // Synthetic cross-module types (e.g. compiler-generated anonymous types) are
  // declared in separate `__tsonic/*` modules. These do not appear in a given
  // module's localTypes map, but they are part of the compilation unit and can
  // be emitted as fully-qualified CLR types.
  const syntheticNs = context.options.syntheticTypeNamespaces?.get(name);
  if (syntheticNs) {
    const qualified = toGlobalClr(
      `${syntheticNs}.${escapeCSharpIdentifier(name)}`
    );

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
    }

    return [identifierType(qualified), context];
  }

  // Hard failure: unresolved external reference type
  // This should never happen if the IR soundness gate is working correctly
  throw new Error(
    `ICE: Unresolved reference type '${name}' (no resolvedClrType, no import binding, no registry binding, not local)`
  );
};

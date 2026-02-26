/**
 * Reference type emission (Array, Promise, Error, etc.)
 *
 * All types are emitted with global:: prefix for unambiguous resolution.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { emitTypeAst } from "./emitter.js";
import { substituteTypeArgs } from "../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * C# primitive type names that can be emitted directly without qualification.
 * These correspond to the types defined in @tsonic/core package.
 */
const CSHARP_PRIMITIVES = new Set([
  // Signed integers (from @tsonic/core)
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  // Unsigned integers (from @tsonic/core)
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  // Floating-point (from @tsonic/core)
  "half",
  "float",
  "double",
  "decimal",
  // Other primitives (from @tsonic/core)
  "bool",
  "char",
  // Additional C# keywords that are valid type names
  "string",
  "object",
  "void",
]);

/**
 * Normalize a CLR type name to global:: format
 */
const toGlobalClr = (clr: string): string => {
  const trimmed = clr.trim();
  return trimmed.startsWith("global::") ? trimmed : `global::${trimmed}`;
};

/**
 * Convert CLR metadata type names into C#-emittable type names.
 *
 * tsbindgen bindings use CLR "full names" that include:
 * - Generic arity markers: `Dictionary`2`, `Func`3`, etc.
 * - Nested type separators: `Outer+Inner`
 *
 * C# source code must not include arity markers, and nested types use `.`
 * in source (e.g. `Outer.Inner`).
 */
const clrTypeNameToCSharp = (clr: string): string => {
  const prefix = "global::";
  const hasGlobal = clr.startsWith(prefix);
  const body = hasGlobal ? clr.slice(prefix.length) : clr;

  const sanitized = body
    // Strip generic arity markers (e.g. Dictionary`2 -> Dictionary)
    .replace(/`\d+/g, "")
    // CLR nested types use '+'; C# source uses '.'
    .replace(/\+/g, ".");

  return hasGlobal ? `${prefix}${sanitized}` : sanitized;
};

const resolveImportedTypeClrName = (
  typeName: string,
  context: EmitterContext
): string | undefined => {
  const candidates: string[] = [typeName];

  // tsbindgen class-like instance aliases often flow through IR as Foo$instance.
  // Import bindings are keyed by the surface name (typically Foo), so try
  // deterministic canonicalizations to preserve import-origin identity.
  if (typeName.endsWith("$instance")) {
    const base = typeName.slice(0, -"$instance".length);
    if (base.length > 0) {
      candidates.push(base);
      const unsuffixed = base.replace(/_\d+$/, "");
      if (unsuffixed !== base && unsuffixed.length > 0) {
        candidates.push(unsuffixed);
      }
    }
  }

  for (const candidate of candidates) {
    const binding = context.importBindings?.get(candidate);
    if (!binding || binding.kind === "namespace") continue;

    if (binding.member) {
      return `${binding.clrName}.${binding.member}`;
    }

    return binding.clrName;
  }

  return undefined;
};

const resolveCanonicalLocalTypeTarget = (
  typeName: string,
  context: EmitterContext
): string | undefined => {
  const namespace = context.moduleNamespace ?? context.options.rootNamespace;
  const key = `${namespace}::${typeName}`;
  return context.options.canonicalLocalTypeTargets?.get(key);
};

/**
 * Normalize a generic type argument AST: void → object.
 * C# generic type arguments cannot be void, so we substitute object.
 */
const normalizeGenericTypeArgAst = (ast: CSharpTypeAst): CSharpTypeAst =>
  ast.kind === "predefinedType" && ast.keyword === "void"
    ? { kind: "predefinedType", keyword: "object" }
    : ast;

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

/**
 * Emit type arguments as CSharpTypeAst[], with void→object normalization.
 */
const emitTypeArgAsts = (
  typeArguments: readonly IrType[],
  context: EmitterContext
): [CSharpTypeAst[], EmitterContext] => {
  const typeArgAsts: CSharpTypeAst[] = [];
  let currentContext = context;
  for (const typeArg of typeArguments) {
    const [paramAst, newContext] = emitTypeAst(typeArg, currentContext);
    typeArgAsts.push(normalizeGenericTypeArgAst(paramAst));
    currentContext = newContext;
  }
  return [typeArgAsts, currentContext];
};

/**
 * Build an identifierType with optional type arguments.
 */
const identifierTypeWithArgs = (
  name: string,
  typeArgAsts: CSharpTypeAst[] | undefined
): CSharpTypeAst =>
  typeArgAsts && typeArgAsts.length > 0
    ? { kind: "identifierType", name, typeArguments: typeArgAsts }
    : { kind: "identifierType", name };

/**
 * Emit reference types as CSharpTypeAst
 */
export const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const { name, typeArguments, resolvedClrType, typeId } = type;

  // Check if this is a local type alias.
  //
  // C# has no general-purpose type alias syntax at the use-site, so type aliases must be
  // resolved to their underlying type *except* for `objectType` aliases, which are emitted
  // as concrete classes with a `__Alias` suffix.
  //
  // Examples:
  // - `type Pair = [number, number]`      → `global::System.ValueTuple<double, double>`
  // - `type Auth = { ok: true } | { error: string }`
  //                                   → `global::Tsonic.Runtime.Union<Auth__0, Auth__1>`
  // - `type Point = { x: number; y: number }`
  //                                   → `Point__Alias` (class emitted elsewhere)
  const typeInfo = context.localTypes?.get(name);
  if (typeInfo && typeInfo.kind === "typeAlias") {
    const underlyingKind = typeInfo.type.kind;
    // Resolve all non-object type aliases; object aliases are emitted as classes.
    const shouldResolve = underlyingKind !== "objectType";

    if (shouldResolve) {
      // Substitute type arguments if present
      const underlyingType =
        typeArguments && typeArguments.length > 0
          ? substituteTypeArgs(
              typeInfo.type,
              typeInfo.typeParameters,
              typeArguments
            )
          : typeInfo.type;
      return emitTypeAst(underlyingType, context);
    }
    // For `objectType` aliases - fall through and emit the alias name; it will be
    // rewritten to `__Alias` in the local-type handling below.
  }

  // If the type has a pre-resolved CLR type (from IR), use it
  if (resolvedClrType) {
    const qualifiedClr = CSHARP_PRIMITIVES.has(resolvedClrType)
      ? resolvedClrType
      : toGlobalClr(resolvedClrType);
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualifiedClr, typeArgAsts), newContext];
    }
    // For primitives, emit as predefinedType; for others, identifierType
    return [
      CSHARP_PRIMITIVES.has(resolvedClrType)
        ? { kind: "predefinedType", keyword: resolvedClrType }
        : { kind: "identifierType", name: qualifiedClr },
      context,
    ];
  }

  // Check if this type is imported - use pre-computed CLR name directly.
  // This includes canonicalization for tsbindgen instance aliases (Foo$instance)
  // so imported type identity remains stable even when global aliases collide.
  const qualifiedName = resolveImportedTypeClrName(name, context);
  if (qualifiedName) {
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualifiedName, typeArgAsts), newContext];
    }
    return [{ kind: "identifierType", name: qualifiedName }, context];
  }

  // Check for unsupported support types
  const unsupportedError = checkUnsupportedSupportType(name);
  if (unsupportedError) {
    throw new Error(`[Tsonic] ${unsupportedError}`);
  }

  // Handle built-in types
  // Array<T> emits as native T[] array, same as T[] syntax
  // Users must explicitly use List<T> to get a List
  if (name === "Array" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
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

  if (name === "Promise" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      return [
        {
          kind: "identifierType",
          name: "global::System.Threading.Tasks.Task",
        },
        context,
      ];
    }
    const [elementTypeAst, newContext] = emitTypeAst(firstArg, context);
    // Promise<void> should map to Task (not Task<void>)
    if (
      elementTypeAst.kind === "predefinedType" &&
      elementTypeAst.keyword === "void"
    ) {
      return [
        {
          kind: "identifierType",
          name: "global::System.Threading.Tasks.Task",
        },
        newContext,
      ];
    }
    return [
      {
        kind: "identifierType",
        name: "global::System.Threading.Tasks.Task",
        typeArguments: [elementTypeAst],
      },
      newContext,
    ];
  }

  if (name === "Promise") {
    return [
      {
        kind: "identifierType",
        name: "global::System.Threading.Tasks.Task",
      },
      context,
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
    return [
      {
        kind: "identifierType",
        name: "global::System.Span",
        typeArguments: [innerTypeAst],
      },
      newContext,
    ];
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

  // Map PromiseLike to Task
  if (name === "PromiseLike") {
    // PromiseLike is in both globals packages - safe to map unconditionally
    return [
      {
        kind: "identifierType",
        name: "global::System.Threading.Tasks.Task",
      },
      context,
    ];
  }

  // C# primitive types can be emitted directly
  if (CSHARP_PRIMITIVES.has(name)) {
    return [{ kind: "predefinedType", keyword: name }, context];
  }

  // Type parameters in scope can be emitted directly
  if (context.typeParameters?.has(name)) {
    const mappedName = context.typeParameterNameMap?.get(name) ?? name;
    return [{ kind: "identifierType", name: mappedName }, context];
  }

  const canonicalLocalTarget = resolveCanonicalLocalTypeTarget(name, context);
  if (canonicalLocalTarget) {
    const qualified = toGlobalClr(canonicalLocalTarget);
    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
    }
    return [{ kind: "identifierType", name: qualified }, context];
  }

  // IMPORTANT: Check local types BEFORE binding registry.
  // Local types take precedence over .NET types with the same name.
  // This ensures that a locally defined `Container<T>` is not resolved
  // to `System.ComponentModel.Container` from the binding registry.
  const localTypeInfo = context.localTypes?.get(name);
  if (localTypeInfo) {
    let csharpName = name;

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

      if (!context.qualifyLocalTypes) {
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

    if (!context.qualifyLocalTypes) {
      return [{ kind: "identifierType", name: csharpName }, context];
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
      {
        kind: "identifierType",
        name: `global::${qualifiedPrefix}.${csharpName}`,
      },
      context,
    ];
  }

  // Canonical nominal identity from the UnifiedUniverse.
  // When present, this is the authoritative source for CLR emission and
  // avoids relying on emitter-side registry plumbing for basic type names.
  if (typeId) {
    const qualified = toGlobalClr(clrTypeNameToCSharp(typeId.clrName));

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
    }

    return [{ kind: "identifierType", name: qualified }, context];
  }

  // Resolve external types via binding registry (must be fully qualified)
  // This handles types from contextual inference (e.g., Action from Parallel.invoke)
  // IMPORTANT: This is checked AFTER localTypes to ensure local types take precedence
  const regBinding = context.bindingsRegistry?.get(name);
  if (regBinding) {
    const qualified = toGlobalClr(clrTypeNameToCSharp(regBinding.name));

    if (typeArguments && typeArguments.length > 0) {
      const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
      return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
    }

    return [{ kind: "identifierType", name: qualified }, context];
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

    return [{ kind: "identifierType", name: qualified }, context];
  }

  // Hard failure: unresolved external reference type
  // This should never happen if the IR soundness gate is working correctly
  throw new Error(
    `ICE: Unresolved reference type '${name}' (no resolvedClrType, no import binding, no registry binding, not local)`
  );
};

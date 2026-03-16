/**
 * Reference type emission (Array, Promise, Error, etc.)
 *
 * All types are emitted with global:: prefix for unambiguous resolution.
 */

import {
  IrType,
  stableIrTypeKey,
  type TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { emitTypeAst } from "./emitter.js";
import {
  resolveLocalTypeInfo,
  substituteTypeArgs,
  splitRuntimeNullishUnionMembers,
} from "../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  identifierType,
  withTypeArguments,
} from "../core/format/backend-ast/builders.js";
import {
  clrTypeNameToTypeAst,
  isCSharpPredefinedTypeKeyword,
} from "../core/format/backend-ast/utils.js";

/**
 * Normalize a CLR type name to global:: format
 */
const toGlobalClr = (clr: string): string => {
  const trimmed = clr.trim();
  return trimmed.startsWith("global::") ? trimmed : `global::${trimmed}`;
};

const resolveImportedTypeAst = (
  typeName: string,
  context: EmitterContext
): CSharpTypeAst | undefined => {
  const candidates = getReferenceLookupCandidates(typeName);

  for (const candidate of candidates) {
    const binding = context.importBindings?.get(candidate);
    if (!binding || binding.kind !== "type") continue;
    return binding.typeAst;
  }

  return undefined;
};

type StructuralReferenceMember = Extract<
  NonNullable<
    Extract<IrType, { kind: "referenceType" }>["structuralMembers"]
  >[number],
  { kind: "propertySignature" | "methodSignature" }
>;

type BindingStructuralPropertyMember = {
  readonly kind: "property";
  readonly alias: string;
  readonly semanticType: IrType;
  readonly semanticOptional?: boolean;
};

type BindingStructuralMethodMember = {
  readonly kind: "method";
  readonly alias: string;
  readonly semanticSignature: NonNullable<
    FrontendTypeBinding["members"][number]["semanticSignature"]
  >;
};

type StructuralSignatureMember =
  | StructuralReferenceMember
  | BindingStructuralPropertyMember
  | BindingStructuralMethodMember;

type LocalStructuralPropertyMember = {
  readonly kind: "property";
  readonly alias: string;
  readonly semanticType: IrType;
  readonly semanticOptional?: boolean;
};

type LocalStructuralMethodMember = {
  readonly kind: "method";
  readonly alias: string;
  readonly parameters: readonly IrType[];
  readonly returnType: IrType;
};

const stableStructuralIrTypeKey = (type: IrType): string => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return stableIrTypeKey({ kind: "primitiveType", name: "string" });
    }
    if (typeof type.value === "number") {
      return stableIrTypeKey({ kind: "primitiveType", name: "number" });
    }
    if (typeof type.value === "boolean") {
      return stableIrTypeKey({ kind: "primitiveType", name: "boolean" });
    }
  }

  if (type.kind === "unionType") {
    return stableIrTypeKey({
      ...type,
      types: type.types.map((member) => stableStructuralComparableType(member)),
    });
  }

  return stableIrTypeKey(type);
};

const stableStructuralComparableType = (type: IrType): IrType => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
    if (typeof type.value === "number") {
      return { kind: "primitiveType", name: "number" };
    }
    if (typeof type.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
  }
  if (type.kind === "unionType") {
    return {
      ...type,
      types: type.types.map((member) => stableStructuralComparableType(member)),
    };
  }
  return type;
};

const getStructuralMemberSignatureKey = (
  member: StructuralSignatureMember
): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${member.isReadonly ? "ro" : "rw"}:${stableStructuralIrTypeKey(member.type)}`;
  }
  if (member.kind === "methodSignature") {
    const parameters = member.parameters.map((parameter) =>
      stableStructuralIrTypeKey(parameter.type ?? { kind: "unknownType" })
    );
    return `method:${member.name}:${parameters.join(",")}:${member.parameters.length}:${stableStructuralIrTypeKey(member.returnType ?? { kind: "unknownType" })}`;
  }
  if (member.kind === "property") {
    return `prop:${member.alias}:${member.semanticOptional === true ? "opt" : "req"}:rw:${stableStructuralIrTypeKey(member.semanticType)}`;
  }
  const parameters = member.semanticSignature.parameters.map((parameter) =>
    stableStructuralIrTypeKey(parameter.type ?? { kind: "unknownType" })
  );
  return `method:${member.alias}:${parameters.join(",")}:${member.semanticSignature.parameters.length}:${stableStructuralIrTypeKey(member.semanticSignature.returnType ?? { kind: "unknownType" })}`;
};

const buildLocalTypeStructuralSignature = (
  localInfo: LocalTypeInfo | undefined
): string | undefined => {
  if (
    !localInfo ||
    (localInfo.kind !== "class" && localInfo.kind !== "interface")
  ) {
    return undefined;
  }

  const members = localInfo.members
    .flatMap<LocalStructuralPropertyMember | LocalStructuralMethodMember>(
      (member) => {
        if (member.kind === "propertyDeclaration" && member.type) {
          return {
            kind: "property",
            alias: member.name,
            semanticType: member.type,
            semanticOptional: false,
          };
        }
        if (member.kind === "propertySignature" && member.type) {
          return {
            kind: "property",
            alias: member.name,
            semanticType: member.type,
            semanticOptional: member.isOptional,
          };
        }
        if (member.kind === "methodDeclaration") {
          return {
            kind: "method",
            alias: member.name,
            parameters: member.parameters.map(
              (parameter) => parameter.type ?? { kind: "unknownType" }
            ),
            returnType: member.returnType ?? { kind: "unknownType" },
          };
        }
        if (member.kind === "methodSignature") {
          return {
            kind: "method",
            alias: member.name,
            parameters: member.parameters.map(
              (parameter) => parameter.type ?? { kind: "unknownType" }
            ),
            returnType: member.returnType ?? { kind: "unknownType" },
          };
        }
        return [];
      }
    )
    .map((member) => {
      if (member.kind === "property") {
        return `prop:${member.alias}:${member.semanticOptional === true ? "opt" : "req"}:rw:${stableStructuralIrTypeKey(member.semanticType)}`;
      }
      return `method:${member.alias}:${member.parameters
        .map((parameter) => stableStructuralIrTypeKey(parameter))
        .join(
          ","
        )}:${member.parameters.length}:${stableStructuralIrTypeKey(member.returnType)}`;
    })
    .sort();

  if (members.length === 0) {
    return undefined;
  }

  return members.join("|");
};

const buildReferenceStructuralSignature = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  const members = (type.structuralMembers ?? [])
    ?.filter(
      (member): member is StructuralReferenceMember =>
        member.kind === "propertySignature" || member.kind === "methodSignature"
    )
    .map(getStructuralMemberSignatureKey)
    .sort();

  if (!members || members.length === 0) {
    return undefined;
  }

  return members.join("|");
};

const buildBindingStructuralSignature = (
  binding: FrontendTypeBinding
): string | undefined => {
  const members = binding.members
    .flatMap<StructuralSignatureMember>((member) => {
      if (member.kind === "property" && member.semanticType) {
        return {
          kind: "property",
          alias: member.alias,
          semanticType: member.semanticType,
          semanticOptional: member.semanticOptional,
        };
      }
      if (member.kind === "method" && member.semanticSignature) {
        return {
          kind: "method",
          alias: member.alias,
          semanticSignature: member.semanticSignature,
        };
      }
      return [];
    })
    .map(getStructuralMemberSignatureKey)
    .sort();

  if (members.length === 0) {
    return undefined;
  }

  return members.join("|");
};

const resolveBindingBackedStructuralTypeAst = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): CSharpTypeAst | undefined => {
  if (!type.structuralMembers || type.structuralMembers.length === 0) {
    return undefined;
  }
  if (!type.name.startsWith("__Anon_")) {
    return undefined;
  }

  const signature =
    buildReferenceStructuralSignature(type) ??
    buildLocalTypeStructuralSignature(
      resolveLocalTypeInfo(type, context)?.info
    );
  if (!signature) {
    return undefined;
  }

  const matches = new Map<string, FrontendTypeBinding>();
  for (const binding of context.bindingsRegistry?.values() ?? []) {
    const bindingSignature = buildBindingStructuralSignature(binding);
    if (!bindingSignature || bindingSignature !== signature) {
      continue;
    }
    matches.set(binding.name, binding);
  }

  if (matches.size !== 1) {
    return undefined;
  }

  const match = [...matches.values()][0];
  return match ? clrTypeNameToTypeAst(toGlobalClr(match.name)) : undefined;
};

const getReferenceLookupCandidates = (typeName: string): readonly string[] => {
  const candidates = new Set<string>([typeName]);

  if (typeName.endsWith("$instance")) {
    const base = typeName.slice(0, -"$instance".length);
    if (base.length > 0) {
      candidates.add(base);
      const unsuffixed = base.replace(/_\d+$/, "");
      if (unsuffixed.length > 0) {
        candidates.add(unsuffixed);
      }
    }
  }

  return Array.from(candidates);
};

const resolveCanonicalLocalTypeTarget = (
  typeName: string,
  context: EmitterContext
): string | undefined => {
  const namespace = context.moduleNamespace ?? context.options.rootNamespace;
  const key = `${namespace}::${typeName}`;
  return context.options.canonicalLocalTypeTargets?.get(key);
};

const emitQualifiedLocalType = (
  namespace: string,
  csharpName: string,
  typeArguments: readonly IrType[] | undefined,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const qualified = `global::${namespace}.${csharpName}`;
  if (typeArguments && typeArguments.length > 0) {
    const [typeArgAsts, newContext] = emitTypeArgAsts(typeArguments, context);
    return [identifierTypeWithArgs(qualified, typeArgAsts), newContext];
  }
  return [identifierType(qualified), context];
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
): CSharpTypeAst => identifierType(name, typeArgAsts);

const withResolvingTypeAlias = (
  typeName: string,
  context: EmitterContext
): EmitterContext => {
  const resolving = new Set(context.resolvingTypeAliases ?? []);
  resolving.add(typeName);
  return { ...context, resolvingTypeAliases: resolving };
};

const restoreResolvingTypeAliases = (
  context: EmitterContext,
  parentContext: EmitterContext
): EmitterContext => {
  if (context.resolvingTypeAliases === parentContext.resolvingTypeAliases) {
    return context;
  }

  return {
    ...context,
    resolvingTypeAliases: parentContext.resolvingTypeAliases,
  };
};

const OBJECT_TYPE_AST: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "object",
};

const keyForResolvedLocalType = (name: string, namespace: string): string =>
  `${namespace}::${name}`;

const emitRecursiveAliasFallbackType = (
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  if (type.kind === "arrayType") {
    return [
      {
        kind: "arrayType",
        elementType: OBJECT_TYPE_AST,
        rank: 1,
      },
      context,
    ];
  }

  if (type.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(type);
    const nonNullish = split?.nonNullishMembers ?? type.types;
    const hasNullish = split?.hasRuntimeNullish ?? false;

    if (
      nonNullish.length === 1 &&
      nonNullish[0] &&
      nonNullish[0].kind === "arrayType"
    ) {
      const arrayAst: CSharpTypeAst = {
        kind: "arrayType",
        elementType: OBJECT_TYPE_AST,
        rank: 1,
      };
      return [
        hasNullish
          ? { kind: "nullableType", underlyingType: arrayAst }
          : arrayAst,
        context,
      ];
    }

    return [
      hasNullish
        ? { kind: "nullableType", underlyingType: OBJECT_TYPE_AST }
        : OBJECT_TYPE_AST,
      context,
    ];
  }

  return [OBJECT_TYPE_AST, context];
};

const attachTypeArgumentsIfSupported = (
  typeAst: CSharpTypeAst,
  typeArguments: readonly CSharpTypeAst[]
): CSharpTypeAst => {
  switch (typeAst.kind) {
    case "identifierType":
    case "qualifiedIdentifierType":
      return withTypeArguments(typeAst, typeArguments);
    default:
      return typeAst;
  }
};

const EXACT_BCL_VALUE_TYPE_MAP = new Map<string, string>([
  ["half", "global::System.Half"],
  ["int128", "global::System.Int128"],
  ["uint128", "global::System.UInt128"],
]);

const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

/**
 * Emit reference types as CSharpTypeAst
 */
export const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const { name, typeArguments, resolvedClrType, typeId } = type;

  if (name === POLYMORPHIC_THIS_MARKER && context.declaringTypeName) {
    return emitReferenceType(
      {
        ...type,
        name: context.declaringTypeName,
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
  //                                   → `global::Tsonic.Runtime.Union<Auth__0, Auth__1>`
  // - `type Point = { x: number; y: number }`
  //                                   → `Point__Alias` (class emitted elsewhere)
  const typeInfo = context.localTypes?.get(name);
  if (typeInfo && typeInfo.kind === "typeAlias") {
    const underlyingKind = typeInfo.type.kind;
    // Resolve all non-object type aliases; object aliases are emitted as classes.
    const shouldResolve = underlyingKind !== "objectType";

    if (shouldResolve) {
      const underlyingType =
        typeArguments && typeArguments.length > 0
          ? substituteTypeArgs(
              typeInfo.type,
              typeInfo.typeParameters,
              typeArguments
            )
          : typeInfo.type;
      if (context.resolvingTypeAliases?.has(name)) {
        return emitRecursiveAliasFallbackType(underlyingType, context);
      }
      const [resolvedAst, resolvedContext] = emitTypeAst(
        underlyingType,
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

  // If the type has a pre-resolved CLR type (from IR), use it
  if (resolvedClrType) {
    const typeAst = clrTypeNameToTypeAst(toGlobalClr(resolvedClrType));
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

  // Check if this type is imported - use pre-computed type AST directly.
  // This includes canonicalization for tsbindgen instance aliases (Foo$instance)
  // so imported type identity remains stable even when global aliases collide.
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

  const bindingBackedStructuralTypeAst = resolveBindingBackedStructuralTypeAst(
    type,
    context
  );
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

  // Map PromiseLike to Task
  if (name === "PromiseLike") {
    // PromiseLike is in both globals packages - safe to map unconditionally
    return [identifierType("global::System.Threading.Tasks.Task"), context];
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

  const crossModuleLocalType = resolveLocalTypeInfo(type, context);
  if (crossModuleLocalType) {
    const { info, namespace } = crossModuleLocalType;

    if (info.kind === "typeAlias") {
      const underlyingKind = info.type.kind;
      if (underlyingKind !== "objectType") {
        const underlyingType =
          typeArguments && typeArguments.length > 0
            ? substituteTypeArgs(info.type, info.typeParameters, typeArguments)
            : info.type;
        const aliasKey = keyForResolvedLocalType(name, namespace);
        if (context.resolvingTypeAliases?.has(aliasKey)) {
          return emitRecursiveAliasFallbackType(underlyingType, context);
        }
        return emitTypeAst(
          underlyingType,
          withResolvingTypeAlias(aliasKey, context)
        );
      }

      return emitQualifiedLocalType(
        namespace,
        `${name}__Alias`,
        typeArguments,
        context
      );
    }

    return emitQualifiedLocalType(namespace, name, typeArguments, context);
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

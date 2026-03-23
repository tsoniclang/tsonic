import { type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import { splitRuntimeNullishUnionMembers } from "../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  identifierType,
  withTypeArguments,
} from "../core/format/backend-ast/builders.js";

export const toGlobalClr = (clr: string): string => {
  const trimmed = clr.trim();
  return trimmed.startsWith("global::") ? trimmed : `global::${trimmed}`;
};

export const getReferenceLookupCandidates = (
  typeName: string
): readonly string[] => {
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

export const resolveImportedTypeAst = (
  typeName: string,
  context: EmitterContext
): CSharpTypeAst | undefined => {
  const candidates = getReferenceLookupCandidates(typeName);

  for (const candidate of candidates) {
    const binding = context.importBindings?.get(candidate);
    if (!binding) continue;
    if (binding.kind === "type") {
      return binding.typeAst;
    }
    if (binding.kind === "namespace" && !binding.moduleObject) {
      return identifierType(binding.clrName);
    }
  }

  return undefined;
};

export const resolveCanonicalLocalTypeTarget = (
  typeName: string,
  context: EmitterContext
): string | undefined => {
  const namespace = context.moduleNamespace ?? context.options.rootNamespace;
  return context.options.canonicalLocalTypeTargets?.get(
    `${namespace}::${typeName}`
  );
};

const normalizeGenericTypeArgAst = (ast: CSharpTypeAst): CSharpTypeAst =>
  ast.kind === "predefinedType" && ast.keyword === "void"
    ? { kind: "predefinedType", keyword: "object" }
    : ast;

export const emitTypeArgAsts = (
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

export const identifierTypeWithArgs = (
  name: string,
  typeArgAsts: CSharpTypeAst[] | undefined
): CSharpTypeAst => identifierType(name, typeArgAsts);

export const emitQualifiedLocalType = (
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

export const withResolvingTypeAlias = (
  typeName: string,
  context: EmitterContext
): EmitterContext => {
  const resolving = new Set(context.resolvingTypeAliases ?? []);
  resolving.add(typeName);
  return { ...context, resolvingTypeAliases: resolving };
};

export const restoreResolvingTypeAliases = (
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

export const keyForResolvedLocalType = (
  name: string,
  namespace: string
): string => `${namespace}::${name}`;

export const emitRecursiveAliasFallbackType = (
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

export const attachTypeArgumentsIfSupported = (
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

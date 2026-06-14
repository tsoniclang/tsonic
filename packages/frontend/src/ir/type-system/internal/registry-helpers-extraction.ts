/**
 * TypeRegistry extraction helpers for TSTS syntax.
 */

import type {
  TstsHeritageClauseDetails,
  TstsNode,
} from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsExpressionWithTypeArgumentsName,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsTypeParameterNodes,
  getTstsTypeReferenceName,
  hasTstsReadonlyModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../../../source-frontend/index.js";
import type { IrType } from "../../types/index.js";
import { normalizeToTargetName } from "./universe/alias-table.js";
import type {
  ConvertTypeFn,
  MemberInfo,
  HeritageInfo,
  TypeParameterEntry,
} from "./type-registry.js";
import {
  inferMemberType,
  convertMethodToSignature,
  convertMethodSignatureToIr,
} from "./registry-helpers-inference.js";
import { isOverloadStubImplementation } from "../../syntax/overload-stubs.js";
import {
  resolveContainingSourcePackageNamespace,
  resolveSourceFileNamespace,
} from "../../../program/source-file-identity.js";
import { getTstsContainingSourceFileName } from "@tsonic/tsts";
import { tryResolveDeterministicPropertyName } from "../../syntax/property-names.js";

export const isWellKnownLibrary = (fileName: string): boolean =>
  fileName.includes("@tsonic/globals") || fileName.includes("@tsonic/core");

export const getCanonicalTargetName = (
  simpleName: string,
  isFromWellKnownLib: boolean
): string | undefined => {
  if (!isFromWellKnownLib) return undefined;

  const directMapping = normalizeToTargetName(simpleName);
  if (directMapping !== simpleName) return directMapping;

  if (simpleName.endsWith("$instance")) {
    const baseName = simpleName.slice(0, -"$instance".length);
    const baseTargetName = normalizeToTargetName(baseName);
    if (baseTargetName !== baseName) {
      return `${baseTargetName}$instance`;
    }
  }

  if (simpleName.includes("$views")) {
    const baseName = simpleName.replace("__", "").replace("$views", "");
    const baseTargetName = normalizeToTargetName(baseName);
    if (baseTargetName !== baseName) {
      return `${baseTargetName}$views`;
    }
  }

  return undefined;
};

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

export const extractTypeParameters = (
  typeParams: readonly TstsNode[] | undefined,
  convertType: ConvertTypeFn
): readonly TypeParameterEntry[] => {
  if (!typeParams) return [];
  return typeParams.map((typeParameter) => {
    const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
    return {
      name: getTstsNodeNameText(typeParameter) ?? "T",
      constraint: data?.Constraint ? convertType(data.Constraint) : undefined,
      defaultType: data?.DefaultType ? convertType(data.DefaultType) : undefined,
    };
  });
};

export const getTypeNodeName = (typeNode: TstsNode): string | undefined => {
  if (typeNode.Kind === TstsSyntax.KindStringKeyword) {
    return "string";
  }
  if (typeNode.Kind === TstsSyntax.KindNumberKeyword) {
    return "number";
  }
  if (typeNode.Kind === TstsSyntax.KindBooleanKeyword) {
    return "boolean";
  }
  if (typeNode.Kind === TstsSyntax.KindBigIntKeyword) {
    return "bigint";
  }
  if (typeNode.Kind === TstsSyntax.KindSymbolKeyword) {
    return "symbol";
  }
  if (typeNode.Kind === TstsSyntax.KindObjectKeyword) {
    return "object";
  }
  if (typeNode.Kind === TstsSyntax.KindAnyKeyword) {
    return "any";
  }
  if (typeNode.Kind === TstsSyntax.KindUnknownKeyword) {
    return "unknown";
  }

  return (
    getTstsTypeReferenceName(typeNode) ??
    getTstsExpressionWithTypeArgumentsName(typeNode)
  );
};

const isDeclaredInGlobalBlock = (decl: TstsNode | undefined): boolean => {
  let current = decl;
  while (current) {
    if (
      TstsSyntax.IsModuleDeclaration(current) &&
      getTstsNodeNameText(current) === "global"
    ) {
      return true;
    }
    current = current.Parent;
  }
  return false;
};

const getMemberNameText = (member: TstsNode): string | undefined =>
  tryResolveDeterministicPropertyName(TstsSyntax.Node_Name(member)) ??
  getTstsPropertyNameText(member) ??
  getTstsNodeNameText(member);

export const resolveHeritageTypeName = (
  typeNode: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  sourceRoot: string,
  rootNamespace: string
): string | undefined => {
  const expression = TstsSyntax.Node_Expression(typeNode);
  const symbol = expression ? sourceSemantics.getSymbol(expression) : undefined;
  const resolvedSymbol = symbol ? sourceSemantics.resolveAlias(symbol) : undefined;
  const decl = resolvedSymbol
    ? sourceSemantics.getSymbolDeclarations(resolvedSymbol)[0]
    : undefined;
  const fileName = getTstsContainingSourceFileName(decl);
  const simpleName =
    (decl &&
    (TstsSyntax.IsClassDeclaration(decl) ||
      TstsSyntax.IsInterfaceDeclaration(decl) ||
      TstsSyntax.IsTypeAliasDeclaration(decl) ||
      TstsSyntax.IsEnumDeclaration(decl))
      ? getTstsNodeNameText(decl)
      : undefined) ??
    resolvedSymbol?.Name ??
    getTstsExpressionWithTypeArgumentsName(typeNode) ??
    getTypeNodeName(typeNode);

  if (!simpleName) return undefined;

  const canonical = getCanonicalTargetName(
    simpleName,
    fileName ? isWellKnownLibrary(fileName) : false
  );
  if (canonical) return canonical;

  if (isDeclaredInGlobalBlock(decl)) {
    return simpleName;
  }

  const ns =
    fileName && !fileName.endsWith(".d.ts")
      ? (resolveContainingSourcePackageNamespace(fileName) ??
        resolveSourceFileNamespace(fileName, sourceRoot, rootNamespace))
      : undefined;

  return ns ? `${ns}.${simpleName}` : simpleName;
};

export const extractMembers = (
  members: readonly TstsNode[],
  convertType: ConvertTypeFn
): ReadonlyMap<string, MemberInfo> => {
  const result = new Map<string, MemberInfo>();

  for (const member of members) {
    if (TstsSyntax.IsConstructorDeclaration(member)) {
      for (const parameter of concreteTstsNodes(getTstsParameters(member))) {
        const name = getTstsNodeNameText(parameter);
        if (!name) continue;
        result.set(name, {
          kind: "property",
          name,
          type: getTstsDeclaredTypeNode(parameter)
            ? convertType(getTstsDeclaredTypeNode(parameter)!)
            : undefined,
          isOptional: isTstsOptionalParameter(parameter),
          isReadonly: hasTstsReadonlyModifier(parameter),
        });
      }
      continue;
    }

    if (
      TstsSyntax.IsPropertyDeclaration(member) ||
      TstsSyntax.IsPropertySignatureDeclaration(member)
    ) {
      const name = getMemberNameText(member);
      if (!name) continue;
      result.set(name, {
        kind: "property",
        name,
        type:
          TstsSyntax.IsPropertyDeclaration(member)
            ? inferMemberType(member, convertType)
            : getTstsDeclaredTypeNode(member)
              ? convertType(getTstsDeclaredTypeNode(member)!)
              : undefined,
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: hasTstsReadonlyModifier(member),
      });
      continue;
    }

    if (
      TstsSyntax.IsGetAccessorDeclaration(member) ||
      TstsSyntax.IsSetAccessorDeclaration(member)
    ) {
      const name = getMemberNameText(member);
      if (!name) continue;
      const existing = result.get(name);
      const inferredType = inferMemberType(member, convertType);
      result.set(name, {
        kind: "property",
        name,
        type: TstsSyntax.IsGetAccessorDeclaration(member)
          ? (inferredType ?? existing?.type)
          : (existing?.type ?? inferredType),
        isOptional: false,
        isReadonly: TstsSyntax.IsSetAccessorDeclaration(member)
          ? false
          : (existing?.isReadonly ?? true),
      });
      continue;
    }

    if (TstsSyntax.IsMethodDeclaration(member)) {
      if (isOverloadStubImplementation(member)) {
        continue;
      }
      const name = getMemberNameText(member);
      if (!name) continue;
      const existing = result.get(name);
      const newSig = convertMethodToSignature(member, convertType);
      result.set(name, {
        kind: "method",
        name,
        type: undefined,
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: false,
        methodSignatures: existing?.methodSignatures
          ? [...existing.methodSignatures, newSig]
          : [newSig],
      });
      continue;
    }

    if (TstsSyntax.IsMethodSignatureDeclaration(member)) {
      const name = getMemberNameText(member);
      if (!name) continue;
      const existing = result.get(name);
      const newSig = convertMethodSignatureToIr(member, convertType);
      result.set(name, {
        kind: "method",
        name,
        type: undefined,
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: false,
        methodSignatures: existing?.methodSignatures
          ? [...existing.methodSignatures, newSig]
          : [newSig],
      });
      continue;
    }

    if (TstsSyntax.IsIndexSignatureDeclaration(member)) {
      const [parameter] = concreteTstsNodes(getTstsParameters(member));
      const keyType = parameter ? getTstsDeclaredTypeNode(parameter) : undefined;
      const keyName = keyType ? (getTypeNodeName(keyType) ?? "unknown") : "unknown";
      const name = `[${keyName}]`;
      result.set(name, {
        kind: "indexSignature",
        name,
        type: getTstsDeclaredTypeNode(member)
          ? convertType(getTstsDeclaredTypeNode(member)!)
          : undefined,
        isOptional: false,
        isReadonly: hasTstsReadonlyModifier(member),
      });
    }
  }

  return result;
};

export const extractMembersFromAliasedObjectType = (
  aliased: IrType
): ReadonlyMap<string, MemberInfo> => {
  if (aliased.kind !== "objectType") return new Map();
  const result = new Map<string, MemberInfo>();

  for (const member of aliased.members) {
    if (member.kind === "propertySignature") {
      result.set(member.name, {
        kind: "property",
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
        isReadonly: member.isReadonly,
      });
      continue;
    }
    if (member.kind === "methodSignature") {
      const existing = result.get(member.name);
      result.set(member.name, {
        kind: "method",
        name: member.name,
        type: undefined,
        isOptional: false,
        isReadonly: false,
        methodSignatures: existing?.methodSignatures
          ? [...existing.methodSignatures, member]
          : [member],
      });
    }
  }

  return result;
};

export const convertCallableInterfaceOnlyType = (
  node: TstsNode,
  convertType: ConvertTypeFn
): IrType | undefined => {
  if (getTstsTypeParameterNodes(node).length > 0) return undefined;
  if ((TstsSyntax.AsInterfaceDeclaration(node)?.HeritageClauses?.Nodes.length ?? 0) > 0) {
    return undefined;
  }

  const members = concreteTstsNodes(getTstsMemberNodes(node));
  if (
    members.length === 0 ||
    !members.every(TstsSyntax.IsCallSignatureDeclaration)
  ) {
    return undefined;
  }

  const signatures = members.map((member): IrType => ({
    kind: "functionType",
    typeParameters: concreteTstsNodes(getTstsTypeParameterNodes(member)).map(
      (typeParameter) => {
        const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
        return {
          kind: "typeParameter" as const,
          name: getTstsNodeNameText(typeParameter) ?? "T",
          constraint: data?.Constraint ? convertType(data.Constraint) : undefined,
          default: data?.DefaultType ? convertType(data.DefaultType) : undefined,
          variance: undefined,
          isStructuralConstraint:
            data?.Constraint?.Kind === TstsSyntax.KindTypeLiteral,
          structuralMembers: undefined,
        };
      }
    ),
    parameters: concreteTstsNodes(getTstsParameters(member)).map(
      (parameter, index) => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: getTstsNodeNameText(parameter) ?? `arg${index}`,
        },
        type: getTstsDeclaredTypeNode(parameter)
          ? convertType(getTstsDeclaredTypeNode(parameter)!)
          : undefined,
        initializer: undefined,
        isOptional: isTstsOptionalParameter(parameter),
        isRest: isTstsRestParameter(parameter),
        passing: "value",
      })
    ),
    returnType: getTstsDeclaredTypeNode(member)
      ? convertType(getTstsDeclaredTypeNode(member)!)
      : { kind: "voidType" },
  }));

  return signatures.length === 1
    ? signatures[0]
    : {
        kind: "intersectionType",
        types: signatures,
      };
};

export { convertMethodToSignature, convertMethodSignatureToIr };

export const extractHeritage = (
  clauses: readonly TstsHeritageClauseDetails[],
  sourceSemantics: TstsFrontendSourceSemanticView,
  sourceRoot: string,
  rootNamespace: string,
  convertType: ConvertTypeFn,
  canonicalize?: (name: string) => string
): readonly HeritageInfo[] => {
  const result: HeritageInfo[] = [];
  for (const clause of clauses) {
    for (const type of concreteTstsNodes(clause.types)) {
      const resolvedName = resolveHeritageTypeName(
        type,
        sourceSemantics,
        sourceRoot,
        rootNamespace
      );
      const rawTypeName = resolvedName ?? getTypeNodeName(type);
      if (!rawTypeName) continue;
      const typeName = canonicalize ? canonicalize(rawTypeName) : rawTypeName;
      result.push({
        kind: clause.kind,
        baseType: convertType(type),
        typeName,
      });
    }
  }
  return result;
};

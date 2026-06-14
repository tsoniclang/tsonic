/**
 * Binding Layer — TSTS syntax helper functions.
 *
 * These helpers operate on TSTS nodes and source-extension facts only. They do
 * not call TypeScript checker APIs and do not inspect TypeScript AST nodes.
 */

import type { TstsNode, TstsSymbol } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsDeclarationKind,
  getTstsIdentifierText,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  hasTstsReadonlyModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type {
  DeclKind,
  ParameterNode,
  TypeParameterNode,
  SignatureTypePredicate,
  ClassMemberNames,
  CapturedClassMethodSignature,
} from "../type-system/internal/handle-types.js";
import type { ParameterMode } from "../type-system/types.js";
import type { TstsFrontendSourceSemanticView } from "../../source-frontend/index.js";
import {
  parameterPassingFactKey,
  parameterPassingModeFromFact,
} from "../../source-frontend/index.js";

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

export const getTypeNodeFromDeclaration = (
  decl: TstsNode
): TstsNode | undefined => getTstsDeclaredTypeNode(decl);

export const getMemberTypeAnnotation = (
  decl: TstsNode
): TstsNode | undefined => getTstsDeclaredTypeNode(decl);

export const getDeclKind = (decl: TstsNode): DeclKind =>
  getTstsDeclarationKind(decl);

export const getReturnTypeNode = (
  decl: TstsNode | undefined
): TstsNode | undefined =>
  decl === undefined ? undefined : getTstsDeclaredTypeNode(decl);

export const isThisParameter = (p: TstsNode): boolean =>
  getTstsNodeNameText(p) === "this";

export const extractThisParameterTypeNode = (
  decl: TstsNode | undefined,
  sourceSemantics?: TstsFrontendSourceSemanticView
): TstsNode | undefined => {
  if (!decl) return undefined;
  const thisParam = concreteTstsNodes(getTstsParameters(decl)).find(
    isThisParameter
  );
  if (!thisParam) return undefined;
  return normalizeParameterTypeNode(
    getTstsDeclaredTypeNode(thisParam),
    sourceSemantics
  ).typeNode;
};

export const normalizeParameterTypeNode = (
  typeNode: TstsNode | undefined,
  sourceSemantics?: TstsFrontendSourceSemanticView
): { mode: ParameterMode; typeNode: TstsNode | undefined } => {
  let current = typeNode;
  let mode: ParameterMode = "value";

  while (current !== undefined) {
    const passing = parameterPassingModeFromFact(
      sourceSemantics?.getFact(current, parameterPassingFactKey)
    );
    if (passing === undefined || passing === "value") {
      break;
    }

    const [inner] = getTstsTypeArguments(current);
    if (!inner) {
      break;
    }

    mode = passing;
    current = inner;
  }

  return { mode, typeNode: current };
};

export const extractParameterNodes = (
  decl: TstsNode | undefined,
  sourceSemantics?: TstsFrontendSourceSemanticView
): readonly ParameterNode[] => {
  if (!decl) return [];
  return concreteTstsNodes(getTstsParameters(decl))
    .filter((parameter) => !isThisParameter(parameter))
    .map((parameter) => {
      const normalized = normalizeParameterTypeNode(
        getTstsDeclaredTypeNode(parameter),
        sourceSemantics
      );
      return {
        name: getTstsNodeNameText(parameter) ?? "param",
        typeNode: normalized.typeNode,
        isOptional: isTstsOptionalParameter(parameter),
        isRest: isTstsRestParameter(parameter),
        mode: normalized.mode,
      };
    });
};

export const convertTypeParameterDeclarations = (
  typeParameters: readonly TstsNode[] | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  return typeParameters.map((typeParameter) => {
    const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
    return {
      name: getTstsNodeNameText(typeParameter) ?? "T",
      constraintNode: data?.Constraint,
      defaultNode: data?.DefaultType,
    };
  });
};

export const extractTypeParameterNodes = (
  decl: TstsNode | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!decl) return undefined;
  if (TstsSyntax.IsConstructorDeclaration(decl)) {
    return convertTypeParameterDeclarations(
      concreteTstsNodes(getTstsTypeParameterNodes(decl.Parent))
    );
  }
  return convertTypeParameterDeclarations(
    concreteTstsNodes(getTstsTypeParameterNodes(decl))
  );
};

export const extractTypePredicate = (
  returnTypeNode: TstsNode | undefined,
  decl: TstsNode | undefined
): SignatureTypePredicate | undefined => {
  if (!returnTypeNode || !TstsSyntax.IsTypePredicateNode(returnTypeNode)) {
    return undefined;
  }
  const predicate = TstsSyntax.AsTypePredicateNode(returnTypeNode);
  const targetTypeNode = predicate?.Type;
  const parameterName = predicate?.ParameterName;
  if (!targetTypeNode || !parameterName) {
    return undefined;
  }

  if (TstsSyntax.IsThisTypeNode(parameterName)) {
    return { kind: "this", targetTypeNode };
  }

  const name =
    getTstsIdentifierText(parameterName) ?? getTstsNodeNameText(parameterName);
  if (!name) {
    return undefined;
  }

  const parameterIndex = concreteTstsNodes(getTstsParameters(decl)).findIndex(
    (parameter) => getTstsNodeNameText(parameter) === name
  );
  if (parameterIndex < 0) {
    return undefined;
  }

  return {
    kind: "param",
    parameterName: name,
    parameterIndex,
    targetTypeNode,
  };
};

export const isOptionalMember = (symbol: TstsSymbol): boolean => {
  const valueDeclaration = symbol.ValueDeclaration;
  return valueDeclaration !== undefined && isTstsOptionalParameter(valueDeclaration);
};

export const isReadonlyMember = (decl: TstsNode | undefined): boolean =>
  decl !== undefined && hasTstsReadonlyModifier(decl);

export const normalizeCapturedDeclaringTypeName = (name: string): string => {
  if (name.endsWith("$instance")) {
    return name.slice(0, -"$instance".length);
  }
  if (name.startsWith("__") && name.endsWith("$views")) {
    return name.slice(2, -"$views".length);
  }
  return name;
};

export const extractDeclaringIdentity = (
  decl: TstsNode | undefined
): { typeTsName: string; memberName: string } | undefined => {
  if (!decl) return undefined;
  const parent = decl.Parent;
  const memberName =
    TstsSyntax.IsConstructorDeclaration(decl)
      ? "constructor"
      : (getTstsPropertyNameText(decl) ?? getTstsNodeNameText(decl));
  if (!memberName) return undefined;

  if (
    TstsSyntax.IsClassDeclaration(parent) ||
    TstsSyntax.IsInterfaceDeclaration(parent)
  ) {
    const typeName = getTstsNodeNameText(parent);
    return typeName
      ? {
          typeTsName: normalizeCapturedDeclaringTypeName(typeName),
          memberName,
        }
      : undefined;
  }

  return undefined;
};

const captureMethodSignature = (
  member: TstsNode
): CapturedClassMethodSignature => ({
  parameters: concreteTstsNodes(getTstsParameters(member)).map(
    (parameter) => ({
      typeNode: getTstsDeclaredTypeNode(parameter),
      isRest: isTstsRestParameter(parameter),
    })
  ),
});

export const extractClassMemberNames = (
  classDecl: TstsNode
): ClassMemberNames => {
  const typeParameters = concreteTstsNodes(getTstsTypeParameterNodes(classDecl))
    .map(getTstsNodeNameText)
    .filter((name): name is string => name !== undefined);
  const methods = new Set<string>();
  const properties = new Set<string>();
  const methodSignatures = new Map<string, CapturedClassMethodSignature[]>();
  const propertyTypeNodes = new Map<string, TstsNode | undefined>();

  for (const member of concreteTstsNodes(getTstsMemberNodes(classDecl))) {
    const name = getTstsPropertyNameText(member) ?? getTstsNodeNameText(member);
    if (!name) continue;

    if (TstsSyntax.IsMethodDeclaration(member)) {
      methods.add(name);
      const signatures = methodSignatures.get(name) ?? [];
      signatures.push(captureMethodSignature(member));
      methodSignatures.set(name, signatures);
      continue;
    }

    if (
      TstsSyntax.IsPropertyDeclaration(member) ||
      TstsSyntax.IsGetAccessorDeclaration(member) ||
      TstsSyntax.IsSetAccessorDeclaration(member)
    ) {
      properties.add(name);
      if (!propertyTypeNodes.has(name)) {
        propertyTypeNodes.set(name, getTstsDeclaredTypeNode(member));
      }
    }
  }

  return {
    typeParameters,
    methods,
    properties,
    methodSignatures,
    propertyTypeNodes,
  };
};

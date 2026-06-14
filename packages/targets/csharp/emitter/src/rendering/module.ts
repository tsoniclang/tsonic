import type {
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
  LoweringVariablePlan,
} from "@tsonic/frontend";
import type {
  CSharpLoweringModulePlan,
  EmitterOptions,
  ModuleEmitResult,
  RenderContext,
} from "../types.js";
import { renderDeclaration, renderStaticContainerMember } from "./declarations.js";
import { renderStaticField, renderTopLevelBody } from "./statements.js";
import {
  renderTypeMember,
  structuralTypeName,
  typePlanKey,
} from "./types.js";

const hasNamespaceDeclarationShape = (
  declaration: LoweringDeclarationPlan
): boolean =>
  declaration.declarationKind === "class" ||
  declaration.declarationKind === "enum" ||
  declaration.declarationKind === "interface";

const isStaticTopLevelVariableStatement = (
  statement: CSharpLoweringModulePlan["topLevelStatements"][number]
): boolean =>
  statement.statementKind === "variable" &&
  statement.declarations.every(
    (declaration) => declaration.bindingElements.length === 0
  );

const collectStructuralType = (
  types: Map<string, LoweringTypeRefPlan>,
  type: LoweringTypeRefPlan | undefined
): void => {
  if (!type) return;
  switch (type.kind) {
    case "object":
      types.set(typePlanKey(type), type);
      for (const member of type.members) {
        switch (member.kind) {
          case "property":
            collectStructuralType(types, member.type);
            break;
          case "method":
            for (const parameter of member.parameters) {
              collectStructuralType(types, parameter.type);
            }
            collectStructuralType(types, member.returnType);
            break;
        }
      }
      break;
    case "named":
      for (const argument of type.typeArguments) collectStructuralType(types, argument);
      break;
    case "array":
      collectStructuralType(types, type.elementType);
      break;
    case "tuple":
      for (const element of type.elements) collectStructuralType(types, element);
      break;
    case "union":
    case "intersection":
      for (const member of type.types) collectStructuralType(types, member);
      break;
    case "function":
      for (const parameter of type.parameters) {
        collectStructuralType(types, parameter.type);
      }
      collectStructuralType(types, type.returnType);
      break;
    case "predicate":
      collectStructuralType(types, type.assertedType);
      break;
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "unsupported":
      break;
  }
};

const collectStructuralTypesFromExpression = (
  types: Map<string, LoweringTypeRefPlan>,
  expression: LoweringExpressionPlan | undefined
): void => {
  if (!expression) return;
  collectStructuralType(types, expression.type);
  collectStructuralType(types, expression.contextualTypePlan);
  collectStructuralType(types, expression.returnType);
  for (const typeArgument of expression.typeArguments) {
    collectStructuralType(types, typeArgument);
  }
  collectStructuralTypesFromExpression(types, expression.expression);
  collectStructuralTypesFromExpression(types, expression.left);
  collectStructuralTypesFromExpression(types, expression.right);
  collectStructuralTypesFromExpression(types, expression.condition);
  collectStructuralTypesFromExpression(types, expression.whenTrue);
  collectStructuralTypesFromExpression(types, expression.whenFalse);
  for (const argument of expression.arguments) {
    collectStructuralTypesFromExpression(types, argument);
  }
  for (const element of expression.elements) {
    collectStructuralTypesFromExpression(types, element);
  }
  for (const property of expression.properties) {
    collectStructuralTypesFromExpression(types, property.expression);
  }
  for (const parameter of expression.parameters) {
    collectStructuralType(types, parameter.type);
    collectStructuralTypesFromExpression(types, parameter.initializer);
  }
};

const collectStructuralTypesFromVariable = (
  types: Map<string, LoweringTypeRefPlan>,
  declaration: LoweringVariablePlan
): void => {
  collectStructuralType(types, declaration.type);
  collectStructuralTypesFromExpression(types, declaration.initializer);
  for (const binding of declaration.bindingElements) {
    collectStructuralTypesFromExpression(types, binding.initializer);
  }
};

const collectStructuralTypesFromStatement = (
  types: Map<string, LoweringTypeRefPlan>,
  statement: LoweringStatementPlan | undefined
): void => {
  if (!statement) return;
  collectStructuralTypesFromExpression(types, statement.expression);
  collectStructuralTypesFromExpression(types, statement.condition);
  collectStructuralTypesFromExpression(types, statement.incrementor);
  collectStructuralTypesFromExpression(types, statement.iterable);
  if (statement.catchVariable) {
    collectStructuralTypesFromVariable(types, statement.catchVariable);
  }
  collectStructuralTypesFromStatement(types, statement.thenStatement);
  collectStructuralTypesFromStatement(types, statement.elseStatement);
  collectStructuralTypesFromStatement(types, statement.body);
  collectStructuralTypesFromStatement(types, statement.tryBlock);
  collectStructuralTypesFromStatement(types, statement.catchBlock);
  collectStructuralTypesFromStatement(types, statement.finallyBlock);
  for (const declaration of statement.declarations) {
    collectStructuralTypesFromVariable(types, declaration);
  }
  for (const child of statement.statements) {
    collectStructuralTypesFromStatement(types, child);
  }
  for (const switchCase of statement.cases) {
    collectStructuralTypesFromExpression(types, switchCase.expression);
    for (const child of switchCase.statements) {
      collectStructuralTypesFromStatement(types, child);
    }
  }
};

const collectStructuralTypesFromDeclaration = (
  types: Map<string, LoweringTypeRefPlan>,
  declaration: LoweringDeclarationPlan
): void => {
  collectStructuralType(types, declaration.declaredTypePlan);
  collectStructuralType(types, declaration.typeAliasTarget);
  collectStructuralType(types, declaration.returnType);
  for (const heritage of declaration.heritageTypes) {
    collectStructuralType(types, heritage);
  }
  for (const parameter of declaration.parameters) {
    collectStructuralType(types, parameter.type);
    collectStructuralTypesFromExpression(types, parameter.initializer);
  }
  collectStructuralTypesFromExpression(types, declaration.initializer);
  collectStructuralTypesFromStatement(types, declaration.body);
  for (const member of declaration.members) {
    collectStructuralTypesFromDeclaration(types, member);
  }
};

const collectStructuralTypes = (
  module: CSharpLoweringModulePlan
): readonly LoweringTypeRefPlan[] => {
  const types = new Map<string, LoweringTypeRefPlan>();
  for (const declaration of module.declarations) {
    collectStructuralTypesFromDeclaration(types, declaration);
  }
  for (const statement of module.statements) {
    collectStructuralTypesFromStatement(types, statement);
  }
  for (const expression of module.expressions) {
    collectStructuralTypesFromExpression(types, expression);
  }
  return [...types.values()];
};

const renderStructuralType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string | undefined => {
  if (type.kind !== "object") return undefined;
  const name = context.getStructuralTypeName(type);
  const hasMethods = type.members.some((member) => member.kind === "method");
  if (hasMethods) {
    return [
      `public interface ${name}`,
      "{",
      ...type.members.map((member) => `    ${renderTypeMember(member, context)}`),
      "}",
    ].join("\n");
  }
  return [
    `public sealed class ${name}`,
    "{",
    ...type.members.map((member) => `    ${renderTypeMember(member, context)}`),
    "}",
  ].join("\n");
};

const createRenderContext = (): RenderContext => {
  const diagnostics: RenderContext["diagnostics"] = [];
  let nextTempId = 0;
  return {
    diagnostics,
    getStructuralTypeName: structuralTypeName,
    allocateTempName: (prefix) => {
      const name = `__tsonic_${prefix}_${nextTempId}`;
      nextTempId += 1;
      return name;
    },
    reportUnsupported: (feature, sourceKindName, sourceText) => {
      diagnostics.push({
        code: "TSN2001",
        severity: "error",
        message: `C# lowering does not yet support ${feature} '${sourceKindName}'.`,
        hint: sourceText.replace(/\s+/g, " ").slice(0, 240),
      });
    },
  };
};

export const emitModule = (
  module: CSharpLoweringModulePlan,
  _options: Partial<EmitterOptions> = {}
): ModuleEmitResult => {
  const context = createRenderContext();
  const namespaceDeclarations = module.declarations
    .filter(hasNamespaceDeclarationShape)
    .map((declaration) => renderDeclaration(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const staticMembers = module.declarations
    .filter((declaration) => !hasNamespaceDeclarationShape(declaration))
    .map((declaration) => renderStaticContainerMember(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const topLevelFields = module.topLevelStatements
    .filter(isStaticTopLevelVariableStatement)
    .flatMap((statement) => statement.declarations)
    .filter((declaration) => !declaration.compileTimeOnly)
    .map((declaration) => renderStaticField(declaration, context))
    .filter((rendered) => rendered.length > 0)
    .map((rendered) => `    ${rendered}`);
  const structuralDeclarations = collectStructuralTypes(module)
    .map((type) => renderStructuralType(type, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const executableTopLevelStatements = module.topLevelStatements.filter(
    (statement) =>
      statement.statementKind !== "declaration" &&
      !isStaticTopLevelVariableStatement(statement)
  );
  const topLevelMethod =
    executableTopLevelStatements.length > 0
      ? [
          "    public static void __TopLevel()",
          renderTopLevelBody(executableTopLevelStatements, context)
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n"),
        ]
      : [];

  const lines: string[] = [
    "#nullable enable",
    "using System;",
    "using System.Collections.Concurrent;",
    "using System.Collections.Generic;",
    "using System.Globalization;",
    "using System.Text;",
    "using System.Text.RegularExpressions;",
    "using System.Threading;",
    "using System.Threading.Tasks;",
    "",
    `namespace ${module.identity.namespace};`,
    "",
  ];

  lines.push(...namespaceDeclarations);
  if (structuralDeclarations.length > 0) {
    if (namespaceDeclarations.length > 0) lines.push("");
    lines.push(...structuralDeclarations);
  }

  if (
    staticMembers.length > 0 ||
    topLevelFields.length > 0 ||
    topLevelMethod.length > 0 ||
    (namespaceDeclarations.length === 0 && structuralDeclarations.length === 0)
  ) {
    if (namespaceDeclarations.length > 0 || structuralDeclarations.length > 0) {
      lines.push("");
    }
    lines.push(`public static class ${module.identity.className}`);
    lines.push("{");
    lines.push(...staticMembers);
    lines.push(...topLevelFields);
    if (topLevelMethod.length > 0) {
      if (staticMembers.length > 0 || topLevelFields.length > 0) lines.push("");
      lines.push(...topLevelMethod);
    }
    lines.push("}");
  }

  if (context.diagnostics.length > 0) {
    return { ok: false, errors: context.diagnostics };
  }
  return { ok: true, code: `${lines.join("\n")}\n` };
};

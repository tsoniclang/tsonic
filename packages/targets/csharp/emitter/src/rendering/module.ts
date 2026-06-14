import type {
  LoweringDeclarationPlan,
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

const variableInitializerIdentifier = (
  declaration: LoweringDeclarationPlan
): string | undefined =>
  declaration.declarationKind === "variable" &&
  declaration.initializer?.expressionKind === "identifier"
    ? declaration.initializer.literalText ?? declaration.initializer.name
    : undefined;

const variablePlanInitializerIdentifier = (
  declaration: LoweringVariablePlan
): string | undefined =>
  declaration.initializer?.expressionKind === "identifier"
    ? declaration.initializer.literalText ?? declaration.initializer.name
    : undefined;

const buildGenericFunctionAliasMap = (
  module: CSharpLoweringModulePlan
): ReadonlyMap<string, string> => {
  const declarations = module.declarations;
  const topLevelVariables = module.topLevelStatements.flatMap(
    (statement) => statement.declarations
  );
  const genericFunctions = new Set(
    declarations
      .filter(
        (declaration) =>
          declaration.declarationKind === "function" &&
          declaration.name !== undefined &&
          declaration.typeParameters.length > 0
      )
      .map((declaration) => declaration.name)
  );
  const aliases = new Map<string, string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (declaration.declarationKind !== "variable" || !declaration.name) {
        continue;
      }
      if (aliases.has(declaration.name)) continue;
      const target = variableInitializerIdentifier(declaration);
      if (!target) continue;
      const resolvedTarget = aliases.get(target) ?? target;
      if (!genericFunctions.has(resolvedTarget)) continue;
      aliases.set(declaration.name, resolvedTarget);
      changed = true;
    }
    for (const declaration of topLevelVariables) {
      if (aliases.has(declaration.name)) continue;
      const target = variablePlanInitializerIdentifier(declaration);
      if (!target) continue;
      const resolvedTarget = aliases.get(target) ?? target;
      if (!genericFunctions.has(resolvedTarget)) continue;
      aliases.set(declaration.name, resolvedTarget);
      changed = true;
    }
  }
  return aliases;
};

const createRenderContext = (
  expressionAliases: ReadonlyMap<string, string>
): RenderContext => {
  const diagnostics: RenderContext["diagnostics"] = [];
  let nextTempId = 0;
  return {
    diagnostics,
    expressionAliases,
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
  const expressionAliases = buildGenericFunctionAliasMap(module);
  const context = createRenderContext(expressionAliases);
  const isGenericFunctionAlias = (name: string | undefined): boolean =>
    name !== undefined && expressionAliases.has(name);
  const namespaceDeclarations = module.declarations
    .filter(hasNamespaceDeclarationShape)
    .map((declaration) => renderDeclaration(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const staticMembers = module.declarations
    .filter((declaration) => !hasNamespaceDeclarationShape(declaration))
    .filter((declaration) => !isGenericFunctionAlias(declaration.name))
    .map((declaration) => renderStaticContainerMember(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const topLevelFields = module.topLevelStatements
    .filter(isStaticTopLevelVariableStatement)
    .flatMap((statement) => statement.declarations)
    .filter((declaration) => !isGenericFunctionAlias(declaration.name))
    .map((declaration) => renderStaticField(declaration, context))
    .map((rendered) => `    ${rendered}`);
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

  if (
    staticMembers.length > 0 ||
    topLevelFields.length > 0 ||
    topLevelMethod.length > 0 ||
    namespaceDeclarations.length === 0
  ) {
    if (namespaceDeclarations.length > 0) lines.push("");
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

import type { LoweringDeclarationPlan } from "@tsonic/frontend";
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

const createRenderContext = (): RenderContext => {
  const diagnostics: RenderContext["diagnostics"] = [];
  let nextTempId = 0;
  return {
    diagnostics,
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

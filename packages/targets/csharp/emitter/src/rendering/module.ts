import type { LoweringDeclarationPlan } from "@tsonic/frontend";
import type { CSharpLoweringModulePlan, EmitterOptions } from "../types.js";
import { renderDeclaration, renderStaticContainerMember } from "./declarations.js";

const hasNamespaceDeclarationShape = (
  declaration: LoweringDeclarationPlan
): boolean =>
  declaration.declarationKind === "class" ||
  declaration.declarationKind === "enum" ||
  declaration.declarationKind === "interface";

export const emitModule = (
  module: CSharpLoweringModulePlan,
  _options: Partial<EmitterOptions> = {}
): string => {
  const namespaceDeclarations = module.declarations
    .filter(hasNamespaceDeclarationShape)
    .map(renderDeclaration)
    .filter((rendered): rendered is string => rendered !== undefined);
  const staticMembers = module.declarations
    .filter((declaration) => !hasNamespaceDeclarationShape(declaration))
    .map(renderStaticContainerMember)
    .filter((rendered): rendered is string => rendered !== undefined);

  const lines: string[] = [
    "#nullable enable",
    "using System;",
    "",
    `namespace ${module.identity.namespace};`,
    "",
  ];

  lines.push(...namespaceDeclarations);

  if (staticMembers.length > 0 || namespaceDeclarations.length === 0) {
    if (namespaceDeclarations.length > 0) lines.push("");
    lines.push(`public static class ${module.identity.className}`);
    lines.push("{");
    lines.push(...staticMembers);
    lines.push("}");
  }

  return `${lines.join("\n")}\n`;
};

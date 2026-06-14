import type { LoweringModulePlan } from "@tsonic/frontend";
import type { EntryInfo } from "@tsonic/csharp-backend";

export const findMainEntryInfo = (
  entryModule: LoweringModulePlan
): EntryInfo | null => {
  for (const declaration of entryModule.declarations) {
    if (
      declaration.declarationKind === "function" &&
      declaration.name === "main" &&
      declaration.exported
    ) {
      return {
        namespace: entryModule.identity.namespace,
        className: entryModule.identity.className,
        methodName: "main",
        isAsync: declaration.async,
        needsProgram: true,
      };
    }
  }

  return null;
};

export const hasTopLevelExecutableStatements = (
  entryModule: LoweringModulePlan
): boolean =>
  entryModule.topLevelStatements.some((statement) => {
    switch (statement.sourceKindName) {
      case "FunctionDeclaration":
      case "ClassDeclaration":
      case "InterfaceDeclaration":
      case "TypeAliasDeclaration":
      case "EnumDeclaration":
      case "ImportDeclaration":
      case "ImportEqualsDeclaration":
      case "ExportDeclaration":
      case "EmptyStatement":
        return false;
      default:
        return true;
    }
  });

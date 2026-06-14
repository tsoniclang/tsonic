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
    switch (statement.statementKind) {
      case "declaration":
      case "variable":
      case "empty":
        return false;
      case "expression":
        return statement.compileTimeOnly !== true;
      default:
        return true;
    }
  });

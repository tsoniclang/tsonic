import { isExecutableStatement, type IrModule } from "@tsonic/frontend";
import type { EntryInfo } from "@tsonic/backend";

export const findMainEntryInfo = (entryModule: IrModule): EntryInfo | null => {
  for (const exp of entryModule.exports) {
    if (exp.kind === "declaration") {
      const decl = exp.declaration;
      if (decl.kind === "functionDeclaration" && decl.name === "main") {
        return {
          namespace: entryModule.namespace,
          className: entryModule.className,
          methodName: "main",
          isAsync: decl.isAsync,
          needsProgram: true,
        };
      }
    } else if (exp.kind === "named" && exp.name === "main") {
      for (const stmt of entryModule.body) {
        if (stmt.kind === "functionDeclaration" && stmt.name === "main") {
          return {
            namespace: entryModule.namespace,
            className: entryModule.className,
            methodName: "main",
            isAsync: stmt.isAsync,
            needsProgram: true,
          };
        }
      }
    }
  }

  return null;
};

export const hasTopLevelExecutableStatements = (
  entryModule: IrModule
): boolean => entryModule.body.some(isExecutableStatement);

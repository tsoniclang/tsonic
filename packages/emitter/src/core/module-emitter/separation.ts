/**
 * Statement separation logic
 */

import { IrModule, IrStatement } from "@tsonic/frontend";

export type SeparatedStatements = {
  readonly namespaceLevelDecls: readonly IrStatement[];
  readonly staticContainerMembers: readonly IrStatement[];
  readonly hasInheritance: boolean;
};

/**
 * Separate namespace-level declarations from static container members
 */
export const separateStatements = (module: IrModule): SeparatedStatements => {
  const namespaceLevelDecls: IrStatement[] = [];
  const staticContainerMembers: IrStatement[] = [];

  // Detect if module has any inheritance (for virtual/override keywords)
  const hasInheritance = module.body.some(
    (stmt) => stmt.kind === "classDeclaration" && stmt.superClass
  );

  for (const stmt of module.body) {
    if (
      stmt.kind === "classDeclaration" ||
      stmt.kind === "interfaceDeclaration" ||
      stmt.kind === "enumDeclaration" ||
      (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType")
    ) {
      namespaceLevelDecls.push(stmt);
    } else {
      staticContainerMembers.push(stmt);
    }
  }

  return {
    namespaceLevelDecls,
    staticContainerMembers,
    hasInheritance,
  };
};

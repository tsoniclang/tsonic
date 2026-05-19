/**
 * Type parameter collection
 */

import { IrModule, IrTypeParameter } from "@tsonic/frontend";

/**
 * Collect all type parameters from declarations in a module
 */
export const collectTypeParameters = (
  module: IrModule
): readonly IrTypeParameter[] => {
  const typeParams: IrTypeParameter[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    } else if (stmt.kind === "classDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
      // Also collect from class members
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration" && member.typeParameters) {
          typeParams.push(...member.typeParameters);
        }
      }
    } else if (stmt.kind === "interfaceDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    } else if (stmt.kind === "typeAliasDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    }
  }

  return typeParams;
};

import type { IrStatement } from "@tsonic/frontend";

export const declarationEmitsNamespaceTypeNamed = (
  stmt: IrStatement,
  name: string
): boolean => {
  if (
    stmt.kind === "classDeclaration" ||
    stmt.kind === "interfaceDeclaration" ||
    stmt.kind === "enumDeclaration"
  ) {
    return stmt.name === name;
  }

  return (
    stmt.kind === "typeAliasDeclaration" &&
    stmt.type.kind === "unionType" &&
    stmt.type.runtimeCarrierName === name
  );
};

export const moduleBodyEmitsNamespaceTypeNamed = (
  body: readonly IrStatement[],
  name: string
): boolean =>
  body.some((stmt) => declarationEmitsNamespaceTypeNamed(stmt, name));

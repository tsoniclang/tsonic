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

export const declarationEmitsStaticValueNamed = (
  stmt: IrStatement,
  name: string
): boolean => {
  if (stmt.kind === "functionDeclaration") {
    return stmt.name === name;
  }

  if (stmt.kind === "variableDeclaration") {
    return stmt.declarations.some(
      (decl) =>
        decl.name.kind === "identifierPattern" && decl.name.name === name
    );
  }

  return false;
};

export const moduleBodyEmitsStaticValueNamed = (
  body: readonly IrStatement[],
  name: string
): boolean => body.some((stmt) => declarationEmitsStaticValueNamed(stmt, name));

export const moduleBodyRequiresStaticContainerSuffix = (
  body: readonly IrStatement[],
  name: string
): boolean =>
  moduleBodyEmitsNamespaceTypeNamed(body, name) ||
  moduleBodyEmitsStaticValueNamed(body, name);

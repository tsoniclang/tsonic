/**
 * Local type indexing for property type lookup
 *
 * Builds a map of locally-defined types (classes, interfaces, type aliases)
 * for use in property type resolution during emission.
 */

import type {
  IrModule,
  IrStatement,
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrEnumDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import type { LocalTypeInfo } from "../types.js";

/**
 * Build the localTypes map from a module's body statements.
 *
 * Scans all statements for class, interface, and typeAlias declarations
 * and indexes them by name for property type lookup.
 *
 * @param module The IR module to scan
 * @returns Map from type name to LocalTypeInfo
 */
export const buildLocalTypes = (
  module: IrModule
): ReadonlyMap<string, LocalTypeInfo> => {
  const localTypes = new Map<string, LocalTypeInfo>();

  for (const stmt of module.body) {
    const info = extractLocalTypeInfo(stmt);
    if (info) {
      localTypes.set(info.name, info.info);
    }
  }

  return localTypes;
};

/**
 * Extract LocalTypeInfo from a statement if it's a type declaration.
 * Returns undefined for non-type statements.
 */
const extractLocalTypeInfo = (
  stmt: IrStatement
): { name: string; info: LocalTypeInfo } | undefined => {
  switch (stmt.kind) {
    case "classDeclaration":
      return {
        name: stmt.name,
        info: buildClassInfo(stmt),
      };

    case "enumDeclaration":
      return {
        name: stmt.name,
        info: buildEnumInfo(stmt),
      };

    case "interfaceDeclaration":
      return {
        name: stmt.name,
        info: buildInterfaceInfo(stmt),
      };

    case "typeAliasDeclaration":
      return {
        name: stmt.name,
        info: buildTypeAliasInfo(stmt),
      };

    default:
      return undefined;
  }
};

/**
 * Build LocalTypeInfo for a class declaration
 */
const buildClassInfo = (stmt: IrClassDeclaration): LocalTypeInfo => ({
  kind: "class",
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  members: stmt.members,
  implements: stmt.implements,
});

/**
 * Build LocalTypeInfo for an interface declaration
 */
const buildInterfaceInfo = (stmt: IrInterfaceDeclaration): LocalTypeInfo => ({
  kind: "interface",
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  members: stmt.members,
  extends: stmt.extends,
});

/**
 * Build LocalTypeInfo for an enum declaration
 */
const buildEnumInfo = (stmt: IrEnumDeclaration): LocalTypeInfo => ({
  kind: "enum",
  members: stmt.members.map((m) => m.name),
});

/**
 * Build LocalTypeInfo for a type alias declaration
 */
const buildTypeAliasInfo = (stmt: IrTypeAliasDeclaration): LocalTypeInfo => ({
  kind: "typeAlias",
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  type: stmt.type,
});

/**
 * Local type indexing for property type lookup
 *
 * Builds a map of locally-defined types (classes, interfaces, type aliases)
 * for use in property type resolution during emission.
 */

import type {
  IrModule,
  IrType,
  IrStatement,
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrEnumDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import type { LocalTypeInfo } from "../../types.js";

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
  isExported: stmt.isExported,
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  members: stmt.members,
  superClass: stmt.superClass,
  implements: stmt.implements,
});

/**
 * Build LocalTypeInfo for an interface declaration
 */
const buildInterfaceInfo = (stmt: IrInterfaceDeclaration): LocalTypeInfo => ({
  kind: "interface",
  isExported: stmt.isExported,
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  members: stmt.members,
  extends: stmt.extends,
});

/**
 * Build LocalTypeInfo for an enum declaration
 */
const buildEnumInfo = (stmt: IrEnumDeclaration): LocalTypeInfo => ({
  kind: "enum",
  isExported: stmt.isExported,
  members: stmt.members.map((m) => m.name),
});

/**
 * Build LocalTypeInfo for a type alias declaration
 */
const buildTypeAliasInfo = (stmt: IrTypeAliasDeclaration): LocalTypeInfo => ({
  kind: "typeAlias",
  isExported: stmt.isExported,
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  type: stmt.type,
});

const walkTypeRefs = (
  type: IrType | undefined,
  onReference: (
    ref: Extract<IrType, { kind: "referenceType" }>
  ) => void,
  seen: WeakSet<object> = new WeakSet<object>()
): void => {
  if (!type) return;
  if (typeof type === "object" && type !== null) {
    if (seen.has(type)) {
      return;
    }
    seen.add(type);
  }

  switch (type.kind) {
    case "referenceType":
      onReference(type);
      if (type.typeArguments) {
        for (const arg of type.typeArguments) {
          walkTypeRefs(arg, onReference, seen);
        }
      }
      if (type.structuralMembers) {
        for (const member of type.structuralMembers) {
          if (member.kind === "propertySignature") {
            walkTypeRefs(member.type, onReference, seen);
            continue;
          }
          for (const param of member.parameters) {
            walkTypeRefs(param.type, onReference, seen);
          }
          walkTypeRefs(member.returnType, onReference, seen);
        }
      }
      return;
    case "typeParameterType":
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return;
    case "arrayType":
      walkTypeRefs(type.elementType, onReference, seen);
      return;
    case "tupleType":
      for (const element of type.elementTypes) {
        walkTypeRefs(element, onReference, seen);
      }
      return;
    case "functionType":
      for (const param of type.parameters) {
        walkTypeRefs(param.type, onReference, seen);
      }
      walkTypeRefs(type.returnType, onReference, seen);
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          walkTypeRefs(member.type, onReference, seen);
          continue;
        }
        for (const param of member.parameters) {
          walkTypeRefs(param.type, onReference, seen);
        }
        walkTypeRefs(member.returnType, onReference, seen);
      }
      return;
    case "dictionaryType":
      walkTypeRefs(type.keyType, onReference, seen);
      walkTypeRefs(type.valueType, onReference, seen);
      return;
    case "unionType":
    case "intersectionType":
      for (const nested of type.types) {
        walkTypeRefs(nested, onReference, seen);
      }
      return;
  }
};

export const collectPublicLocalTypes = (
  module: IrModule,
  localTypes: ReadonlyMap<string, LocalTypeInfo>
): ReadonlySet<string> => {
  const localTypeLookup = new Map<string, string>();
  for (const localName of localTypes.keys()) {
    localTypeLookup.set(localName, localName);
    localTypeLookup.set(`${module.namespace}.${localName}`, localName);
  }

  const result = new Set<string>();
  const queue: string[] = [];
  const enqueueLocalType = (name: string): void => {
    if (!localTypes.has(name) || result.has(name)) return;
    result.add(name);
    queue.push(name);
  };
  const resolveLocalTypeName = (
    ref: Extract<IrType, { kind: "referenceType" }>
  ): string | undefined => {
    const candidates = [
      ref.name,
      ref.resolvedClrType,
      ref.typeId?.clrName,
      ref.typeId?.tsName,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const localName = localTypeLookup.get(candidate);
      if (localName) {
        return localName;
      }
    }

    return undefined;
  };
  const addType = (type: IrType | undefined): void => {
    walkTypeRefs(type, (ref) => {
      const localName = resolveLocalTypeName(ref);
      if (localName) {
        enqueueLocalType(localName);
      }
    });
  };

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration") {
      if (!stmt.isExported) continue;
      for (const param of stmt.parameters) addType(param.type);
      addType(stmt.returnType);
      continue;
    }

    if (stmt.kind === "variableDeclaration") {
      if (!stmt.isExported) continue;
      for (const decl of stmt.declarations) {
        addType(decl.type);
        const init = decl.initializer;
        if (
          init?.kind === "arrowFunction" ||
          init?.kind === "functionExpression"
        ) {
          for (const param of init.parameters) addType(param.type);
          addType(init.returnType);
        }
      }
      continue;
    }

    if (stmt.kind === "classDeclaration") {
      if (!stmt.isExported) continue;
      addType(stmt.superClass);
      for (const impl of stmt.implements) addType(impl);
      for (const member of stmt.members) {
        if (member.kind === "propertyDeclaration") {
          if (member.accessibility === "private") continue;
          addType(member.type);
          continue;
        }
        if (member.kind === "methodDeclaration") {
          if (member.accessibility === "private") continue;
          addType(member.returnType);
          for (const param of member.parameters) addType(param.type);
          continue;
        }
        if (member.accessibility === "private") continue;
        for (const param of member.parameters) addType(param.type);
      }
      continue;
    }

    if (stmt.kind === "interfaceDeclaration") {
      if (!stmt.isExported) continue;
      for (const ext of stmt.extends) addType(ext);
      for (const member of stmt.members) {
        if (member.kind === "propertySignature") {
          addType(member.type);
          continue;
        }
        for (const param of member.parameters) addType(param.type);
        addType(member.returnType);
      }
      continue;
    }

    if (stmt.kind === "typeAliasDeclaration") {
      if (!stmt.isExported) continue;
      enqueueLocalType(stmt.name);
      addType(stmt.type);
    }
  }

  while (queue.length > 0) {
    const nextName = queue.shift();
    if (!nextName) continue;
    const info = localTypes.get(nextName);
    if (!info) continue;

    switch (info.kind) {
      case "class":
        addType(info.superClass);
        for (const impl of info.implements) addType(impl);
        for (const member of info.members) {
          if (member.kind === "propertyDeclaration") {
            if (member.accessibility === "private") continue;
            addType(member.type);
            continue;
          }
          if (member.kind === "methodDeclaration") {
            if (member.accessibility === "private") continue;
            addType(member.returnType);
            for (const param of member.parameters) addType(param.type);
            continue;
          }
          if (member.accessibility === "private") continue;
          for (const param of member.parameters) addType(param.type);
        }
        break;
      case "interface":
        for (const ext of info.extends) addType(ext);
        for (const member of info.members) {
          if (member.kind === "propertySignature") {
            addType(member.type);
            continue;
          }
          addType(member.returnType);
          for (const param of member.parameters) addType(param.type);
        }
        break;
      case "typeAlias":
        addType(info.type);
        break;
      case "enum":
        break;
    }
  }

  return result;
};

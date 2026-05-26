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
  IrClassMember,
  IrInterfaceDeclaration,
  IrEnumDeclaration,
  IrTypeAliasDeclaration,
  IrTypeParameter,
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
  isStruct: stmt.isStruct,
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
  isStruct: stmt.isStruct,
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
  isStruct: stmt.isStruct,
  typeParameters: stmt.typeParameters?.map((tp) => tp.name) ?? [],
  type: stmt.type,
});

const walkTypeRefs = (
  type: IrType | undefined,
  onReference: (ref: Extract<IrType, { kind: "referenceType" }>) => void,
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
      if (type.runtimeCarrierName) {
        onReference({
          kind: "referenceType",
          name: type.runtimeCarrierName,
          ...(type.runtimeCarrierNamespace
            ? {
                providerQualifiedName: `${type.runtimeCarrierNamespace}.${type.runtimeCarrierName}`,
              }
            : {}),
          ...(type.runtimeCarrierTypeArguments &&
          type.runtimeCarrierTypeArguments.length > 0
            ? { typeArguments: type.runtimeCarrierTypeArguments }
            : {}),
        });
      }
      for (const nested of type.types) {
        walkTypeRefs(nested, onReference, seen);
      }
      return;
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
      ref.providerQualifiedName,
      ref.typeId?.providerName,
      ref.typeId?.sourceName,
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

export const structuralInterfaceContractKey = (
  namespace: string,
  name: string
): string => `${namespace}::${name}`;

const normalizeModulePath = (filePath: string): string => {
  let normalized = filePath.replace(/\\/g, "/");
  if (normalized.endsWith(".ts")) {
    normalized = normalized.slice(0, -3);
  }

  const segments: string[] = [];
  for (const segment of normalized.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
};

const getReferenceLeafNameForContract = (
  ref: Extract<IrType, { kind: "referenceType" }>
): string => {
  if (ref.typeId?.sourceName) {
    return ref.typeId.sourceName.split(".").pop() ?? ref.typeId.sourceName;
  }
  if (ref.providerQualifiedName) {
    return (
      ref.providerQualifiedName.split(".").pop() ?? ref.providerQualifiedName
    );
  }
  return ref.name.split(".").pop() ?? ref.name;
};

const collectTypeParameterConstraints = (
  typeParameters: readonly IrTypeParameter[] | undefined,
  onReference: (ref: Extract<IrType, { kind: "referenceType" }>) => void
): void => {
  for (const typeParameter of typeParameters ?? []) {
    walkTypeRefs(typeParameter.constraint, onReference);
  }
};

const collectMemberTypeParameterConstraints = (
  member: IrClassMember,
  onReference: (ref: Extract<IrType, { kind: "referenceType" }>) => void
): void => {
  if (member.kind !== "methodDeclaration") return;
  collectTypeParameterConstraints(member.typeParameters, onReference);
};

const collectStatementTypeParameterConstraints = (
  statement: IrStatement,
  onReference: (ref: Extract<IrType, { kind: "referenceType" }>) => void
): void => {
  switch (statement.kind) {
    case "functionDeclaration":
    case "interfaceDeclaration":
    case "typeAliasDeclaration":
      collectTypeParameterConstraints(statement.typeParameters, onReference);
      return;
    case "classDeclaration":
      collectTypeParameterConstraints(statement.typeParameters, onReference);
      for (const member of statement.members) {
        collectMemberTypeParameterConstraints(member, onReference);
      }
      return;
    default:
      return;
  }
};

export const collectStructuralInterfaceContracts = (
  modules: readonly IrModule[]
): ReadonlySet<string> => {
  const moduleInfos = modules.map((module) => ({
    module,
    normalizedPath: normalizeModulePath(module.filePath),
    localTypes: buildLocalTypes(module),
  }));
  const moduleByPath = new Map(
    moduleInfos.map((info) => [info.normalizedPath, info] as const)
  );
  const typeByFullyQualifiedName = new Map<
    string,
    {
      readonly namespace: string;
      readonly name: string;
      readonly info: LocalTypeInfo;
    }
  >();

  for (const { module, localTypes } of moduleInfos) {
    for (const [name, info] of localTypes) {
      typeByFullyQualifiedName.set(`${module.namespace}.${name}`, {
        namespace: module.namespace,
        name,
        info,
      });
    }
  }

  const result = new Set<string>();

  for (const { module, localTypes } of moduleInfos) {
    const resolveReference = (
      ref: Extract<IrType, { kind: "referenceType" }>
    ):
      | {
          readonly namespace: string;
          readonly name: string;
          readonly info: LocalTypeInfo;
        }
      | undefined => {
      const directCandidates = [
        ref.providerQualifiedName,
        ref.typeId?.providerName,
        ref.typeId?.sourceName,
        ref.name.includes(".") ? ref.name : undefined,
      ];
      for (const candidate of directCandidates) {
        if (!candidate) continue;
        const direct = typeByFullyQualifiedName.get(candidate);
        if (direct) return direct;
      }

      if (!ref.name.includes(".")) {
        const local = localTypes.get(ref.name);
        if (local) {
          return { namespace: module.namespace, name: ref.name, info: local };
        }
      }

      const importedName = getReferenceLeafNameForContract(ref);
      for (const imp of module.imports) {
        const spec = imp.specifiers.find(
          (candidate) =>
            candidate.kind === "named" &&
            candidate.isType === true &&
            candidate.localName === importedName
        );
        if (!spec || spec.kind !== "named") continue;

        const importedNamespace = imp.resolvedNamespace;
        if (importedNamespace) {
          const imported = typeByFullyQualifiedName.get(
            `${importedNamespace}.${spec.name}`
          );
          if (imported) return imported;
        }

        const importedPath = imp.resolvedPath
          ? normalizeModulePath(imp.resolvedPath)
          : undefined;
        const importedModule = importedPath
          ? moduleByPath.get(importedPath)
          : undefined;
        const importedInfo = importedModule?.localTypes.get(spec.name);
        if (importedModule && importedInfo) {
          return {
            namespace: importedModule.module.namespace,
            name: spec.name,
            info: importedInfo,
          };
        }
      }

      return undefined;
    };

    const markNativeInterfaceAndBases = (
      resolved: {
        readonly namespace: string;
        readonly name: string;
        readonly info: LocalTypeInfo;
      },
      visited: Set<string> = new Set<string>()
    ): void => {
      if (resolved.info.kind !== "interface") return;
      const key = structuralInterfaceContractKey(
        resolved.namespace,
        resolved.name
      );
      if (visited.has(key)) return;
      visited.add(key);
      result.add(key);

      for (const extended of resolved.info.extends) {
        if (extended.kind !== "referenceType") continue;
        const extendedResolved = resolveReference(extended);
        if (extendedResolved?.info.kind === "interface") {
          markNativeInterfaceAndBases(extendedResolved, visited);
        }
      }
    };

    for (const statement of module.body) {
      if (statement.kind === "interfaceDeclaration") {
        const info = localTypes.get(statement.name);
        if (
          info?.kind === "interface" &&
          (info.members.some((member) => member.kind === "methodSignature") ||
            info.extends.length > 1)
        ) {
          markNativeInterfaceAndBases({
            namespace: module.namespace,
            name: statement.name,
            info,
          });
        }
      }

      collectStatementTypeParameterConstraints(statement, (ref) => {
        const resolved = resolveReference(ref);
        if (resolved?.info.kind !== "interface") return;
        markNativeInterfaceAndBases(resolved);
      });
    }
  }

  return result;
};

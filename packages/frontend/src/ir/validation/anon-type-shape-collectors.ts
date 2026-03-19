/**
 * Anonymous Type Shape Analysis — Collectors & Type Utilities
 *
 * Type parameter collection, referenced type name collection, reachability
 * analysis, and nullish type stripping/addition. Split from
 * anon-type-shape-analysis.ts for file-size compliance.
 */

import type {
  IrType,
  IrClassMember,
  IrClassDeclaration,
  IrStatement,
  IrModule,
} from "../types.js";

/**
 * Collect free type parameter names referenced by an IrType.
 *
 * These are used to make synthesized anonymous types generic when their
 * member types contain typeParameterType nodes (e.g., `{ value: T }`).
 */
type CollectTypeParameterState = {
  readonly seen: WeakSet<object>;
};

export const collectTypeParameterNames = (
  type: IrType,
  out: Set<string>,
  state?: CollectTypeParameterState
): void => {
  const currentState = state ?? { seen: new WeakSet<object>() };

  if (typeof type === "object" && type !== null) {
    if (currentState.seen.has(type)) {
      return;
    }
    currentState.seen.add(type);
  }

  switch (type.kind) {
    case "typeParameterType":
      out.add(type.name);
      return;

    case "referenceType":
      for (const ta of type.typeArguments ?? []) {
        if (ta) collectTypeParameterNames(ta, out, currentState);
      }
      return;

    case "arrayType":
      collectTypeParameterNames(type.elementType, out, currentState);
      return;

    case "tupleType":
      for (const el of type.elementTypes) {
        if (el) collectTypeParameterNames(el, out, currentState);
      }
      return;

    case "functionType":
      for (const p of type.parameters) {
        if (p.type) collectTypeParameterNames(p.type, out, currentState);
      }
      collectTypeParameterNames(type.returnType, out, currentState);
      return;

    case "unionType":
    case "intersectionType":
      for (const t of type.types) {
        if (t) collectTypeParameterNames(t, out, currentState);
      }
      return;

    case "dictionaryType":
      collectTypeParameterNames(type.keyType, out, currentState);
      collectTypeParameterNames(type.valueType, out, currentState);
      return;

    case "objectType":
      for (const m of type.members) {
        if (m.kind === "propertySignature") {
          collectTypeParameterNames(m.type, out, currentState);
        } else if (m.kind === "methodSignature") {
          for (const p of m.parameters) {
            if (p.type) collectTypeParameterNames(p.type, out, currentState);
          }
          if (m.returnType) {
            collectTypeParameterNames(m.returnType, out, currentState);
          }
        }
      }
      return;

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return;
  }
};

export const collectReferencedTypeNames = (
  type: IrType | undefined,
  out: Set<string>,
  seen: WeakSet<object> = new WeakSet<object>()
): void => {
  if (!type || typeof type !== "object") {
    return;
  }
  if (seen.has(type)) {
    return;
  }
  seen.add(type);

  switch (type.kind) {
    case "referenceType":
      out.add(type.name);
      for (const arg of type.typeArguments ?? []) {
        if (arg) {
          collectReferencedTypeNames(arg, out, seen);
        }
      }
      return;
    case "arrayType":
      collectReferencedTypeNames(type.elementType, out, seen);
      return;
    case "tupleType":
      for (const element of type.elementTypes) {
        if (element) {
          collectReferencedTypeNames(element, out, seen);
        }
      }
      return;
    case "unionType":
    case "intersectionType":
      for (const member of type.types) {
        collectReferencedTypeNames(member, out, seen);
      }
      return;
    case "dictionaryType":
      collectReferencedTypeNames(type.keyType, out, seen);
      collectReferencedTypeNames(type.valueType, out, seen);
      return;
    case "functionType":
      for (const parameter of type.parameters) {
        if (parameter.type) {
          collectReferencedTypeNames(parameter.type, out, seen);
        }
      }
      collectReferencedTypeNames(type.returnType, out, seen);
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          collectReferencedTypeNames(member.type, out, seen);
          continue;
        }
        for (const parameter of member.parameters) {
          if (parameter.type) {
            collectReferencedTypeNames(parameter.type, out, seen);
          }
        }
        if (member.returnType) {
          collectReferencedTypeNames(member.returnType, out, seen);
        }
      }
      return;
    default:
      return;
  }
};

export const collectPubliclyReachableAnonymousTypes = (
  modules: readonly IrModule[],
  generatedDeclarations: readonly IrClassDeclaration[]
): ReadonlySet<string> => {
  const declarationMap = new Map<string, IrStatement>();
  for (const module of modules) {
    for (const statement of module.body) {
      if (
        statement.kind === "classDeclaration" ||
        statement.kind === "interfaceDeclaration" ||
        statement.kind === "typeAliasDeclaration" ||
        statement.kind === "enumDeclaration" ||
        statement.kind === "functionDeclaration"
      ) {
        declarationMap.set(statement.name, statement);
      }
    }
  }
  for (const declaration of generatedDeclarations) {
    declarationMap.set(declaration.name, declaration);
  }

  const queue: string[] = [];
  const reachable = new Set<string>();
  const enqueueType = (type: IrType | undefined): void => {
    const names = new Set<string>();
    collectReferencedTypeNames(type, names);
    for (const name of names) {
      if (reachable.has(name)) {
        continue;
      }
      reachable.add(name);
      queue.push(name);
    }
  };

  const enqueueClassMember = (member: IrClassMember): void => {
    if (member.kind === "propertyDeclaration") {
      if (member.accessibility === "private") return;
      enqueueType(member.type);
      return;
    }
    if (member.kind === "methodDeclaration") {
      if (member.accessibility === "private") return;
      enqueueType(member.returnType);
      for (const parameter of member.parameters) {
        enqueueType(parameter.type);
      }
      return;
    }
    if (member.accessibility === "private") return;
    for (const parameter of member.parameters) {
      enqueueType(parameter.type);
    }
  };

  for (const module of modules) {
    for (const statement of module.body) {
      if (statement.kind === "classDeclaration") {
        if (!statement.isExported) continue;
        enqueueType(statement.superClass);
        for (const implemented of statement.implements) {
          enqueueType(implemented);
        }
        for (const member of statement.members) {
          enqueueClassMember(member);
        }
        continue;
      }

      if (statement.kind === "interfaceDeclaration") {
        if (!statement.isExported) continue;
        for (const extended of statement.extends) {
          enqueueType(extended);
        }
        for (const member of statement.members) {
          if (member.kind === "propertySignature") {
            enqueueType(member.type);
            continue;
          }
          enqueueType(member.returnType);
          for (const parameter of member.parameters) {
            enqueueType(parameter.type);
          }
        }
        continue;
      }

      if (statement.kind === "typeAliasDeclaration") {
        if (statement.isExported) {
          enqueueType(statement.type);
        }
        continue;
      }

      if (statement.kind === "functionDeclaration") {
        if (!statement.isExported) continue;
        enqueueType(statement.returnType);
        for (const parameter of statement.parameters) {
          enqueueType(parameter.type);
        }
        continue;
      }

      if (statement.kind === "variableDeclaration") {
        if (!statement.isExported) continue;
        for (const declaration of statement.declarations) {
          enqueueType(declaration.type);
        }
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const declaration = declarationMap.get(current);
    if (!declaration) continue;

    if (declaration.kind === "classDeclaration") {
      enqueueType(declaration.superClass);
      for (const implemented of declaration.implements) {
        enqueueType(implemented);
      }
      for (const member of declaration.members) {
        enqueueClassMember(member);
      }
      continue;
    }

    if (declaration.kind === "interfaceDeclaration") {
      for (const extended of declaration.extends) {
        enqueueType(extended);
      }
      for (const member of declaration.members) {
        if (member.kind === "propertySignature") {
          enqueueType(member.type);
          continue;
        }
        enqueueType(member.returnType);
        for (const parameter of member.parameters) {
          enqueueType(parameter.type);
        }
      }
      continue;
    }

    if (declaration.kind === "typeAliasDeclaration") {
      enqueueType(declaration.type);
      continue;
    }

    if (declaration.kind === "functionDeclaration") {
      enqueueType(declaration.returnType);
      for (const parameter of declaration.parameters) {
        enqueueType(parameter.type);
      }
    }
  }

  return new Set(
    [...reachable].filter((name) =>
      generatedDeclarations.some((d) => d.name === name)
    )
  );
};

/**
 * Extract the non-undefined/null type from a union type.
 * For `T | undefined` or `T | null | undefined`, returns T.
 * For non-union types, returns the type as-is.
 */
export const stripNullishFromType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }
  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "undefined" || t.name === "null")
      )
  );
  if (nonNullish.length === 0) {
    // All types were nullish, return original
    return type;
  }
  if (nonNullish.length === type.types.length) {
    // No nullish types were filtered
    return type;
  }
  if (nonNullish.length === 1) {
    // Safe: we checked length === 1
    const first = nonNullish[0];
    if (first !== undefined) {
      return first;
    }
    return type;
  }
  // Return a new union with the filtered types
  return { ...type, types: nonNullish };
};

export const stripUndefinedFromType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const nonUndefined = type.types.filter(
    (t) => !(t.kind === "primitiveType" && t.name === "undefined")
  );
  if (nonUndefined.length === type.types.length) {
    return type;
  }
  if (nonUndefined.length === 0) {
    return type;
  }
  if (nonUndefined.length === 1) {
    return nonUndefined[0] ?? type;
  }
  return { ...type, types: nonUndefined };
};

/**
 * Ensure a type includes `undefined` (for optional members).
 *
 * Optional properties in TS (`foo?: T`) can carry optionality via a flag,
 * not as an explicit `T | undefined` union in IR. When we synthesize a named
 * type for an anonymous object, we must preserve optionality by materializing
 * `undefined` into the type.
 */
export const addUndefinedToType = (type: IrType): IrType => {
  const undefinedType: IrType = { kind: "primitiveType", name: "undefined" };

  if (type.kind === "unionType") {
    const hasUndefined = type.types.some(
      (t) => t.kind === "primitiveType" && t.name === "undefined"
    );
    return hasUndefined
      ? type
      : { ...type, types: [...type.types, undefinedType] };
  }

  return { kind: "unionType", types: [type, undefinedType] };
};

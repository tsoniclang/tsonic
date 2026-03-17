/**
 * Anonymous Object Type Lowering Pass
 *
 * Transforms anonymous object types (IrObjectType) in type positions into
 * generated named types (IrReferenceType) with synthetic interface declarations.
 *
 * This pass runs BEFORE soundness validation to ensure the emitter never
 * receives IrObjectType nodes.
 *
 * Example transformation:
 * ```
 * const config: { value: number } = { value: 42 };
 * ```
 * becomes:
 * ```
 * interface __Anon_abc123 { value: number }
 * const config: __Anon_abc123 = { value: 42 };
 * ```
 */

import { createHash } from "crypto";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrParameter,
  IrTypeParameter,
  IrInterfaceMember,
  IrPattern,
  IrObjectType,
  IrReferenceType,
  IrClassDeclaration,
  IrClassMember,
  IrBlockStatement,
  IrVariableDeclaration,
  IrPropertyDeclaration,
} from "../types.js";
import type { TypeBinding as FrontendTypeBinding } from "../../program/binding-types.js";

/**
 * Result of anonymous type lowering pass
 */
export type AnonymousTypeLoweringResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
};

export type AnonymousTypeLoweringOptions = {
  readonly bindings?: ReadonlyMap<string, FrontendTypeBinding>;
};

/**
 * Context for tracking state during lowering
 */
type LoweringContext = {
  /** Generated class declarations (shared across modules) */
  readonly generatedDeclarations: IrClassDeclaration[];
  /** Map from shape signature to generated type name for deduplication (shared across modules) */
  readonly shapeToName: Map<string, string>;
  /** Existing reusable structural reference types available across the compilation, keyed by shape signature. */
  readonly shapeToExistingReference: Map<string, IrReferenceType>;
  /** Module file path for unique naming */
  readonly moduleFilePath: string;
  /** Type names already declared in the compilation (avoid collisions) */
  readonly existingTypeNames: ReadonlySet<string>;
  /** Current function's lowered return type (for propagating to return statements) */
  readonly currentFunctionReturnType?: IrType;
  /** Cycle-safe cache for lowering recursive type graphs by identity. */
  readonly loweredTypeByIdentity: WeakMap<object, IrType>;
  /** Cycle-safe cache for lowering reference types across cloned nodes. */
  readonly loweredReferenceByStableKey: Map<string, IrReferenceType>;
};

/**
 * Collect free type parameter names referenced by an IrType.
 *
 * These are used to make synthesized anonymous types generic when their
 * member types contain typeParameterType nodes (e.g., `{ value: T }`).
 */
type CollectTypeParameterState = {
  readonly seen: WeakSet<object>;
};

const collectTypeParameterNames = (
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

const collectReferencedTypeNames = (
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

const collectPubliclyReachableAnonymousTypes = (
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

type SerializeState = {
  readonly seen: WeakMap<object, number>;
  nextId: number;
};

const beginSerializeNode = (
  state: SerializeState,
  node: object
): { readonly id: number; readonly seenBefore: boolean } => {
  const existing = state.seen.get(node);
  if (existing !== undefined) {
    return { id: existing, seenBefore: true };
  }

  const id = state.nextId;
  state.nextId += 1;
  state.seen.set(node, id);
  return { id, seenBefore: false };
};

/**
 * Serialize an IrType to a stable string for shape signature.
 *
 * This must be cycle-safe because source ports can legitimately contain
 * recursive alias/object graphs (for example handler arrays that reference
 * themselves transitively).
 */
const serializeType = (type: IrType, state?: SerializeState): string => {
  const currentState = state ?? {
    seen: new WeakMap<object, number>(),
    nextId: 0,
  };

  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return `lit:${typeof type.value}:${String(type.value)}`;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        const visit = beginSerializeNode(currentState, type);
        if (visit.seenBefore) {
          return `refcycle:${visit.id}`;
        }
        return `ref:${type.name}#${visit.id}<${type.typeArguments
          .map((arg) => serializeType(arg, currentState))
          .join(",")}>`;
      }
      return `ref:${type.name}`;
    case "arrayType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `arrcycle:${visit.id}`;
      }
      return `arr#${visit.id}:${serializeType(type.elementType, currentState)}`;
    }
    case "tupleType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `tupcycle:${visit.id}`;
      }
      return `tup#${visit.id}:[${type.elementTypes
        .map((elementType) => serializeType(elementType, currentState))
        .join(",")}]`;
    }
    case "functionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `fncycle:${visit.id}`;
      }
      const params = type.parameters
        .map((p) => (p.type ? serializeType(p.type, currentState) : "any"))
        .join(",");
      return `fn#${visit.id}:(${params})=>${serializeType(
        type.returnType,
        currentState
      )}`;
    }
    case "unionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `unioncycle:${visit.id}`;
      }
      return `union#${visit.id}:[${type.types
        .map((member) => serializeType(member, currentState))
        .join("|")}]`;
    }
    case "typeParameterType":
      return `tp:${type.name}`;
    case "voidType":
      return "void";
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "neverType":
      return "never";
    case "objectType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `objcycle:${visit.id}`;
      }

      // Serialize property signatures
      const propMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map(
          (m) =>
            `prop:${m.isReadonly ? "ro:" : ""}${m.name}${m.isOptional ? "?" : ""}:${serializeType(
              m.type,
              currentState
            )}`
        );

      // Serialize method signatures
      const methodMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "methodSignature" }> =>
            m.kind === "methodSignature"
        )
        .map((m) => {
          const params = m.parameters
            .map((p) => (p.type ? serializeType(p.type, currentState) : "any"))
            .join(",");
          const ret = m.returnType
            ? serializeType(m.returnType, currentState)
            : "void";
          return `method:${m.name}(${params})=>${ret}`;
        });

      const allMembers = [...propMembers, ...methodMembers].sort().join(";");
      return `obj#${visit.id}:{${allMembers}}`;
    }
    case "dictionaryType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `dictcycle:${visit.id}`;
      }
      return `dict#${visit.id}:[${serializeType(
        type.keyType,
        currentState
      )}]:${serializeType(type.valueType, currentState)}`;
    }
    case "intersectionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `intersectioncycle:${visit.id}`;
      }
      return `intersection#${visit.id}:[${type.types
        .map((member) => serializeType(member, currentState))
        .join("&")}]`;
    }
    default:
      return "unknown";
  }
};

/**
 * Compute shape signature for an objectType
 */
const computeShapeSignature = (objectType: IrObjectType): string => {
  return serializeType(objectType);
};

/**
 * Generate a short hash from shape signature
 */
const generateShapeHash = (signature: string): string => {
  return createHash("md5").update(signature).digest("hex").slice(0, 8);
};

/**
 * Convert interface members to class property declarations
 */
const interfaceMembersToClassMembers = (
  members: readonly IrInterfaceMember[]
): readonly IrClassMember[] => {
  return members
    .filter(
      (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
        m.kind === "propertySignature"
    )
    .map((m): IrPropertyDeclaration => {
      // For optional properties (title?: string), make type nullable and don't require
      // For required properties (title: string), use required modifier
      const isOptional = m.isOptional ?? false;
      return {
        kind: "propertyDeclaration",
        name: m.name,
        type: isOptional ? addUndefinedToType(m.type) : m.type,
        initializer: undefined,
        emitAsAutoProperty: true,
        isStatic: false,
        isReadonly: m.isReadonly ?? false,
        accessibility: "public",
        isRequired: !isOptional, // C# 11 required modifier - must be set in object initializer
      };
    });
};

const classMembersToInterfaceMembers = (
  members: readonly IrClassMember[]
): readonly IrInterfaceMember[] =>
  members.flatMap<IrInterfaceMember>((member) => {
    if (member.kind !== "propertyDeclaration" || !member.type) {
      return [];
    }

    return {
      kind: "propertySignature",
      name: member.name,
      type: member.type,
      isOptional: false,
      isReadonly: member.isReadonly,
    };
  });

/**
 * Generate a module-unique hash from file path
 */
const generateModuleHash = (filePath: string): string => {
  return createHash("md5").update(filePath).digest("hex").slice(0, 4);
};

const getReferenceLoweringStableKey = (
  type: IrReferenceType
): string | undefined => {
  const baseKey =
    type.typeId?.stableId ??
    type.typeId?.clrName ??
    type.resolvedClrType ??
    undefined;
  if (!baseKey) return undefined;

  const typeArgsKey =
    type.typeArguments && type.typeArguments.length > 0
      ? `<${type.typeArguments.map((arg) => serializeType(arg)).join(",")}>`
      : "";

  return `${baseKey}${typeArgsKey}`;
};

/**
 * Get or create a generated type name for an object type shape
 */
const getOrCreateTypeName = (
  objectType: IrObjectType,
  ctx: LoweringContext
): string => {
  const signature = computeShapeSignature(objectType);
  const existing = ctx.shapeToName.get(signature);
  if (existing) {
    return existing;
  }

  // Generate name with module hash prefix to avoid collisions across modules
  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const shapeHash = generateShapeHash(signature);
  // Keep a stable compiler-synthesized prefix for cross-module type tracking.
  // Dependency/soundness passes treat __Anon_* as compiler-generated types.
  const name = `__Anon_${moduleHash}_${shapeHash}`;
  ctx.shapeToName.set(signature, name);

  const typeParamNames = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
    } else if (member.kind === "methodSignature") {
      for (const p of member.parameters) {
        if (p.type) collectTypeParameterNames(p.type, typeParamNames);
      }
      if (member.returnType)
        collectTypeParameterNames(member.returnType, typeParamNames);
    }
  }
  const orderedTypeParams = Array.from(typeParamNames).sort();

  // Create a class declaration (not interface) so it can be instantiated
  const declaration: IrClassDeclaration = {
    kind: "classDeclaration",
    name,
    typeParameters:
      orderedTypeParams.length > 0
        ? orderedTypeParams.map(
            (tp): IrTypeParameter => ({
              kind: "typeParameter",
              name: tp,
            })
          )
        : undefined,
    superClass: undefined,
    implements: [],
    members: interfaceMembersToClassMembers(objectType.members),
    isExported: true, // Public to avoid inconsistent accessibility errors
    isStruct: false,
  };

  ctx.generatedDeclarations.push(declaration);
  return name;
};

const isReusableStructuralCarrierName = (name: string): boolean =>
  name.startsWith("__Anon_") || /__\d+$/.test(name);

const inferTemplateTypeArguments = (
  template: IrType,
  concrete: IrType,
  substitution: Map<string, IrType>
): boolean => {
  if (template.kind === "typeParameterType") {
    const existing = substitution.get(template.name);
    if (!existing) {
      substitution.set(template.name, concrete);
      return true;
    }
    return serializeType(existing) === serializeType(concrete);
  }

  if (template.kind !== concrete.kind) {
    return false;
  }

  switch (template.kind) {
    case "primitiveType":
      return (
        concrete.kind === "primitiveType" && template.name === concrete.name
      );
    case "literalType":
      return (
        concrete.kind === "literalType" && template.value === concrete.value
      );
    case "voidType":
    case "unknownType":
    case "anyType":
    case "neverType":
      return true;
    case "referenceType": {
      if (concrete.kind !== "referenceType") {
        return false;
      }
      if (template.name !== concrete.name) {
        return false;
      }
      const templateArgs = template.typeArguments ?? [];
      const concreteArgs = concrete.typeArguments ?? [];
      if (templateArgs.length !== concreteArgs.length) {
        return false;
      }
      for (let index = 0; index < templateArgs.length; index += 1) {
        const templateArg = templateArgs[index];
        const concreteArg = concreteArgs[index];
        if (!templateArg || !concreteArg) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(templateArg, concreteArg, substitution)
        ) {
          return false;
        }
      }
      return true;
    }
    case "arrayType":
      if (concrete.kind !== "arrayType") {
        return false;
      }
      return inferTemplateTypeArguments(
        template.elementType,
        concrete.elementType,
        substitution
      );
    case "tupleType":
      if (concrete.kind !== "tupleType") {
        return false;
      }
      if (template.elementTypes.length !== concrete.elementTypes.length) {
        return false;
      }
      for (let index = 0; index < template.elementTypes.length; index += 1) {
        const templateElement = template.elementTypes[index];
        const concreteElement = concrete.elementTypes[index];
        if (!templateElement || !concreteElement) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(
            templateElement,
            concreteElement,
            substitution
          )
        ) {
          return false;
        }
      }
      return true;
    case "unionType":
    case "intersectionType":
      if (concrete.kind !== template.kind) {
        return false;
      }
      if (template.types.length !== concrete.types.length) {
        return false;
      }
      for (let index = 0; index < template.types.length; index += 1) {
        const templateMember = template.types[index];
        const concreteMember = concrete.types[index];
        if (!templateMember || !concreteMember) {
          return false;
        }
        if (
          !inferTemplateTypeArguments(
            templateMember,
            concreteMember,
            substitution
          )
        ) {
          return false;
        }
      }
      return true;
    case "functionType":
      if (concrete.kind !== "functionType") {
        return false;
      }
      if (template.parameters.length !== concrete.parameters.length) {
        return false;
      }
      for (let index = 0; index < template.parameters.length; index += 1) {
        const templateParam = template.parameters[index];
        const concreteParam = concrete.parameters[index];
        if (!templateParam || !concreteParam) {
          return false;
        }
        if (
          templateParam.isOptional !== concreteParam.isOptional ||
          templateParam.isRest !== concreteParam.isRest ||
          templateParam.passing !== concreteParam.passing
        ) {
          return false;
        }
        if (templateParam.type && concreteParam.type) {
          if (
            !inferTemplateTypeArguments(
              templateParam.type,
              concreteParam.type,
              substitution
            )
          ) {
            return false;
          }
        } else if (templateParam.type || concreteParam.type) {
          return false;
        }
      }
      return inferTemplateTypeArguments(
        template.returnType,
        concrete.returnType,
        substitution
      );
    case "objectType":
      if (concrete.kind !== "objectType") {
        return false;
      }
      if (template.members.length !== concrete.members.length) {
        return false;
      }
      for (let index = 0; index < template.members.length; index += 1) {
        const templateMember = template.members[index];
        const concreteMember = concrete.members[index];
        if (!templateMember || !concreteMember) {
          return false;
        }
        if (
          templateMember.kind !== concreteMember.kind ||
          templateMember.name !== concreteMember.name
        ) {
          return false;
        }
        if (
          templateMember.kind === "propertySignature" &&
          concreteMember.kind === "propertySignature"
        ) {
          if (
            templateMember.isOptional !== concreteMember.isOptional ||
            templateMember.isReadonly !== concreteMember.isReadonly
          ) {
            return false;
          }
          if (
            !inferTemplateTypeArguments(
              templateMember.type,
              concreteMember.type,
              substitution
            )
          ) {
            return false;
          }
          continue;
        }
        if (
          templateMember.kind !== "methodSignature" ||
          concreteMember.kind !== "methodSignature"
        ) {
          return false;
        }
        if (
          templateMember.parameters.length !== concreteMember.parameters.length
        ) {
          return false;
        }
        for (
          let paramIndex = 0;
          paramIndex < templateMember.parameters.length;
          paramIndex += 1
        ) {
          const templateParam = templateMember.parameters[paramIndex];
          const concreteParam = concreteMember.parameters[paramIndex];
          if (!templateParam || !concreteParam) {
            return false;
          }
          if (
            templateParam.isOptional !== concreteParam.isOptional ||
            templateParam.isRest !== concreteParam.isRest ||
            templateParam.passing !== concreteParam.passing
          ) {
            return false;
          }
          if (templateParam.type && concreteParam.type) {
            if (
              !inferTemplateTypeArguments(
                templateParam.type,
                concreteParam.type,
                substitution
              )
            ) {
              return false;
            }
          } else if (templateParam.type || concreteParam.type) {
            return false;
          }
        }
        if (templateMember.returnType && concreteMember.returnType) {
          if (
            !inferTemplateTypeArguments(
              templateMember.returnType,
              concreteMember.returnType,
              substitution
            )
          ) {
            return false;
          }
        } else if (templateMember.returnType || concreteMember.returnType) {
          return false;
        }
      }
      return true;
    case "dictionaryType":
      if (concrete.kind !== "dictionaryType") {
        return false;
      }
      return (
        inferTemplateTypeArguments(
          template.keyType,
          concrete.keyType,
          substitution
        ) &&
        inferTemplateTypeArguments(
          template.valueType,
          concrete.valueType,
          substitution
        )
      );
    default:
      return false;
  }
};

const tryInstantiateReusableStructuralCarrier = (
  objectType: IrObjectType,
  ctx: LoweringContext
): IrReferenceType | undefined => {
  for (const templateRef of ctx.shapeToExistingReference.values()) {
    if (!isReusableStructuralCarrierName(templateRef.name)) {
      continue;
    }

    const templateMembers = templateRef.structuralMembers;
    if (!templateMembers || templateMembers.length === 0) {
      continue;
    }

    const substitution = new Map<string, IrType>();
    const matches = inferTemplateTypeArguments(
      { kind: "objectType", members: templateMembers },
      objectType,
      substitution
    );
    if (!matches) {
      continue;
    }

    const templateTypeArgs = templateRef.typeArguments ?? [];
    const instantiatedTypeArgs: IrType[] = [];
    for (const typeArg of templateTypeArgs) {
      if (typeArg.kind !== "typeParameterType") {
        instantiatedTypeArgs.push(typeArg);
        continue;
      }
      const resolved = substitution.get(typeArg.name);
      if (!resolved) {
        instantiatedTypeArgs.length = 0;
        break;
      }
      instantiatedTypeArgs.push(resolved);
    }
    if (templateTypeArgs.length > 0 && instantiatedTypeArgs.length === 0) {
      continue;
    }

    return {
      ...templateRef,
      typeArguments:
        instantiatedTypeArgs.length > 0 ? instantiatedTypeArgs : undefined,
      structuralMembers: objectType.members,
    };
  }

  return undefined;
};

const getOrCreateObjectTypeReference = (
  objectType: IrObjectType,
  ctx: LoweringContext
): IrReferenceType => {
  const signature = computeShapeSignature(objectType);
  const existingReference = ctx.shapeToExistingReference.get(signature);
  const typeParamNames = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
    } else if (member.kind === "methodSignature") {
      for (const p of member.parameters) {
        if (p.type) collectTypeParameterNames(p.type, typeParamNames);
      }
      if (member.returnType) {
        collectTypeParameterNames(member.returnType, typeParamNames);
      }
    }
  }
  const orderedTypeParams = Array.from(typeParamNames).sort();

  if (existingReference) {
    return {
      ...existingReference,
      typeArguments:
        orderedTypeParams.length > 0
          ? orderedTypeParams.map(
              (tp): IrType => ({
                kind: "typeParameterType",
                name: tp,
              })
            )
          : undefined,
      structuralMembers: objectType.members,
    };
  }

  const reusableCarrier = tryInstantiateReusableStructuralCarrier(
    objectType,
    ctx
  );
  if (reusableCarrier) {
    return reusableCarrier;
  }

  const typeName = getOrCreateTypeName(objectType, ctx);
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments:
      orderedTypeParams.length > 0
        ? orderedTypeParams.map(
            (tp): IrType => ({
              kind: "typeParameterType",
              name: tp,
            })
          )
        : undefined,
    resolvedClrType: undefined,
    structuralMembers: objectType.members,
  };
};

const getOrCreateBehavioralObjectTypeName = (
  objectType: IrObjectType,
  behaviorMembers: readonly IrClassMember[],
  sourceLocation: IrExpression["sourceSpan"] | undefined,
  ctx: LoweringContext
): string => {
  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const locationKey = sourceLocation
    ? `${sourceLocation.file}:${sourceLocation.line}:${sourceLocation.column}`
    : `${ctx.moduleFilePath}:behavior`;
  const behaviorSignature = [
    "behavior",
    locationKey,
    computeShapeSignature(objectType),
    ...behaviorMembers.map((member) =>
      member.kind === "methodDeclaration"
        ? `method:${member.name}`
        : member.kind === "propertyDeclaration"
          ? `property:${member.name}`
          : `ctor:${member.parameters.length}`
    ),
  ].join("|");

  const existing = ctx.shapeToName.get(behaviorSignature);
  if (existing) {
    return existing;
  }

  const name = `__Anon_${moduleHash}_${generateShapeHash(behaviorSignature)}`;
  ctx.shapeToName.set(behaviorSignature, name);

  const behaviorPropertyNames = new Set(
    behaviorMembers
      .filter(
        (
          member
        ): member is Extract<IrClassMember, { kind: "propertyDeclaration" }> =>
          member.kind === "propertyDeclaration"
      )
      .map((member) => member.name)
  );

  const generatedMembers: IrClassMember[] = [
    ...interfaceMembersToClassMembers(objectType.members).filter(
      (member) =>
        member.kind !== "propertyDeclaration" ||
        !behaviorPropertyNames.has(member.name)
    ),
    ...behaviorMembers,
  ];

  ctx.generatedDeclarations.push({
    kind: "classDeclaration",
    name,
    typeParameters: undefined,
    superClass: undefined,
    implements: [],
    members: generatedMembers,
    isExported: true,
    isStruct: false,
  });

  return name;
};

/**
 * Extract the non-undefined/null type from a union type.
 * For `T | undefined` or `T | null | undefined`, returns T.
 * For non-union types, returns the type as-is.
 */
const stripNullishFromType = (type: IrType): IrType => {
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

const stripUndefinedFromType = (type: IrType): IrType => {
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
const addUndefinedToType = (type: IrType): IrType => {
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

/**
 * Lower a type, replacing objectType with referenceType
 */
const lowerType = (
  type: IrType,
  ctx: LoweringContext,
  _nameHint?: string
): IrType => {
  switch (type.kind) {
    case "objectType": {
      // First, recursively lower any nested object types in members
      const loweredMembers: IrInterfaceMember[] = type.members.map((m) => {
        if (m.kind === "propertySignature") {
          return {
            ...m,
            type: lowerType(m.type, ctx, m.name),
          };
        } else if (m.kind === "methodSignature") {
          return {
            ...m,
            parameters: m.parameters.map((p) => lowerParameter(p, ctx)),
            returnType: m.returnType ? lowerType(m.returnType, ctx) : undefined,
          };
        }
        return m;
      });

      const loweredObjectType: IrObjectType = {
        ...type,
        members: loweredMembers,
      };

      return getOrCreateObjectTypeReference(loweredObjectType, ctx);
    }

    case "arrayType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredArray = {
          ...type,
        } as IrType & { elementType: IrType };
        ctx.loweredTypeByIdentity.set(type, loweredArray);
        loweredArray.elementType = lowerType(type.elementType, ctx);
        return loweredArray;
      })();

    case "tupleType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredTuple = {
          ...type,
        } as IrType & { elementTypes: IrType[] };
        ctx.loweredTypeByIdentity.set(type, loweredTuple);
        loweredTuple.elementTypes = type.elementTypes.map((et) =>
          lowerType(et, ctx)
        );
        return loweredTuple;
      })();

    case "functionType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredFunction = {
          ...type,
        } as IrType & {
          parameters: IrParameter[];
          returnType: IrType;
        };
        ctx.loweredTypeByIdentity.set(type, loweredFunction);
        loweredFunction.parameters = type.parameters.map((p) =>
          lowerParameter(p, ctx)
        );
        loweredFunction.returnType = lowerType(type.returnType, ctx);
        return loweredFunction;
      })();

    case "unionType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredUnion = {
          ...type,
        } as IrType & { types: IrType[] };
        ctx.loweredTypeByIdentity.set(type, loweredUnion);
        loweredUnion.types = type.types.map((t) => lowerType(t, ctx));
        return loweredUnion;
      })();

    case "intersectionType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredIntersection = {
          ...type,
        } as IrType & { types: IrType[] };
        ctx.loweredTypeByIdentity.set(type, loweredIntersection);
        loweredIntersection.types = type.types.map((t) => lowerType(t, ctx));
        return loweredIntersection;
      })();

    case "dictionaryType":
      return (() => {
        const cached = ctx.loweredTypeByIdentity.get(type);
        if (cached) return cached;
        const loweredDictionary = {
          ...type,
        } as IrType & { keyType: IrType; valueType: IrType };
        ctx.loweredTypeByIdentity.set(type, loweredDictionary);
        loweredDictionary.keyType = lowerType(type.keyType, ctx);
        loweredDictionary.valueType = lowerType(type.valueType, ctx);
        return loweredDictionary;
      })();

    case "referenceType": {
      const cachedByIdentity = ctx.loweredTypeByIdentity.get(type);
      if (cachedByIdentity) {
        return cachedByIdentity;
      }

      const stableKey = getReferenceLoweringStableKey(type);
      if (stableKey) {
        const cachedByStableKey =
          ctx.loweredReferenceByStableKey.get(stableKey);
        if (cachedByStableKey) {
          ctx.loweredTypeByIdentity.set(type, cachedByStableKey);
          return cachedByStableKey;
        }
      }

      // Lower both typeArguments and structuralMembers
      const typeArgs = type.typeArguments;
      const structuralMembers = type.structuralMembers;
      const hasTypeArgs = typeArgs !== undefined && typeArgs.length > 0;
      const hasStructuralMembers =
        structuralMembers !== undefined && structuralMembers.length > 0;

      if (!hasTypeArgs && !hasStructuralMembers) {
        return type;
      }

      const loweredReference: IrReferenceType = {
        ...type,
        typeArguments: hasTypeArgs
          ? typeArgs.map((ta) => lowerType(ta, ctx))
          : undefined,
      };

      ctx.loweredTypeByIdentity.set(type, loweredReference);
      if (stableKey) {
        ctx.loweredReferenceByStableKey.set(stableKey, loweredReference);
      }

      if (hasStructuralMembers) {
        (
          loweredReference as IrReferenceType & {
            structuralMembers?: readonly IrInterfaceMember[];
          }
        ).structuralMembers = structuralMembers.map((m) =>
          lowerInterfaceMember(m, ctx)
        );
      }

      return loweredReference;
    }

    // These types don't contain nested types
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return type;
  }
};

/**
 * Lower a parameter
 */
const lowerParameter = (
  param: IrParameter,
  ctx: LoweringContext
): IrParameter => {
  return {
    ...param,
    type: param.type ? lowerType(param.type, ctx) : undefined,
    pattern: lowerPattern(param.pattern, ctx),
    initializer: param.initializer
      ? lowerExpression(param.initializer, ctx)
      : undefined,
  };
};

/**
 * Lower a type parameter
 */
const lowerTypeParameter = (
  tp: IrTypeParameter,
  ctx: LoweringContext
): IrTypeParameter => {
  return {
    ...tp,
    constraint: tp.constraint ? lowerType(tp.constraint, ctx) : undefined,
    default: tp.default ? lowerType(tp.default, ctx) : undefined,
    structuralMembers: tp.structuralMembers?.map((m) =>
      lowerInterfaceMember(m, ctx)
    ),
  };
};

/**
 * Lower an interface member
 *
 * IMPORTANT: We MUST lower objectType in all type positions before the emitter.
 * The emitter is not allowed to see IrObjectType nodes (soundness gate enforces this).
 */
const lowerInterfaceMember = (
  member: IrInterfaceMember,
  ctx: LoweringContext
): IrInterfaceMember => {
  switch (member.kind) {
    case "propertySignature": {
      return {
        ...member,
        type: lowerType(member.type, ctx, member.name),
      };
    }
    case "methodSignature":
      return {
        ...member,
        typeParameters: member.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        parameters: member.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: member.returnType
          ? lowerType(member.returnType, ctx)
          : undefined,
      };
  }
};

/**
 * Lower a pattern
 */
const lowerPattern = (pattern: IrPattern, ctx: LoweringContext): IrPattern => {
  switch (pattern.kind) {
    case "identifierPattern":
      return {
        ...pattern,
        type: pattern.type ? lowerType(pattern.type, ctx) : undefined,
      };
    case "arrayPattern":
      return {
        ...pattern,
        elements: pattern.elements.map((e) =>
          e
            ? {
                ...e,
                pattern: lowerPattern(e.pattern, ctx),
                defaultExpr: e.defaultExpr
                  ? lowerExpression(e.defaultExpr, ctx)
                  : undefined,
              }
            : undefined
        ),
      };
    case "objectPattern":
      return {
        ...pattern,
        properties: pattern.properties.map((p) => {
          if (p.kind === "property") {
            return {
              ...p,
              value: lowerPattern(p.value, ctx),
              defaultExpr: p.defaultExpr
                ? lowerExpression(p.defaultExpr, ctx)
                : undefined,
            };
          } else {
            return {
              ...p,
              pattern: lowerPattern(p.pattern, ctx),
            };
          }
        }),
      };
  }
};

/**
 * Lower an expression
 */
const lowerExpression = (
  expr: IrExpression,
  ctx: LoweringContext
): IrExpression => {
  const lowered: IrExpression = (() => {
    switch (expr.kind) {
      case "literal":
      case "this":
        return expr;

      case "identifier": {
        // IMPORTANT: Only lower inferredType for identifiers that refer to a real declaration
        // (locals/parameters). Imported CLR symbols often carry placeholder inferred types
        // that are not part of emission and must not trigger anonymous type synthesis.
        if (!expr.declId || !expr.inferredType) return expr;
        if (expr.resolvedClrType || expr.resolvedAssembly || expr.importedFrom)
          return expr;
        // Treat empty object types (`{}`) as `object`-like placeholders; do not synthesize.
        if (
          expr.inferredType.kind === "objectType" &&
          expr.inferredType.members.length === 0
        ) {
          return expr;
        }
        const loweredInferred = lowerType(expr.inferredType, ctx);
        return loweredInferred === expr.inferredType
          ? expr
          : { ...expr, inferredType: loweredInferred };
      }

      case "array":
        return {
          ...expr,
          inferredType: expr.inferredType
            ? lowerType(expr.inferredType, ctx)
            : undefined,
          elements: expr.elements.map((e) =>
            e ? lowerExpression(e, ctx) : undefined
          ),
        };

      case "object": {
        const rawContextualType = expr.contextualType;
        const rawInferredType = expr.inferredType;
        const objectTypeForBehavior = (() => {
          if (
            rawContextualType?.kind === "objectType" &&
            rawContextualType.members.length > 0
          ) {
            return rawContextualType;
          }
          if (
            rawInferredType?.kind === "objectType" &&
            rawInferredType.members.length > 0
          ) {
            return rawInferredType;
          }
          return undefined;
        })();

        const loweredBehaviorMembers = expr.behaviorMembers?.map((member) =>
          lowerClassMember(member, ctx)
        );
        const behaviorTypeName =
          objectTypeForBehavior &&
          loweredBehaviorMembers &&
          loweredBehaviorMembers.length > 0
            ? getOrCreateBehavioralObjectTypeName(
                objectTypeForBehavior,
                loweredBehaviorMembers,
                expr.sourceSpan,
                ctx
              )
            : undefined;
        const loweredBehaviorType =
          behaviorTypeName !== undefined
            ? ({
                kind: "referenceType",
                name: behaviorTypeName,
              } satisfies IrReferenceType)
            : undefined;

        return {
          ...expr,
          behaviorMembers:
            loweredBehaviorMembers && loweredBehaviorMembers.length > 0
              ? loweredBehaviorMembers
              : undefined,
          inferredType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.inferredType
              ? lowerType(expr.inferredType, ctx)
              : undefined,
          contextualType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.contextualType
              ? lowerType(expr.contextualType, ctx)
              : undefined,
          properties: expr.properties.map((p) => {
            if (p.kind === "property") {
              return {
                ...p,
                key:
                  typeof p.key === "string"
                    ? p.key
                    : lowerExpression(p.key, ctx),
                value: lowerExpression(p.value, ctx),
              };
            } else {
              return {
                ...p,
                expression: lowerExpression(p.expression, ctx),
              };
            }
          }),
        };
      }

      case "functionExpression": {
        const loweredParams = expr.parameters.map((p) =>
          lowerParameter(p, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        return {
          ...expr,
          parameters: loweredParams,
          returnType: loweredReturnType,
          body: lowerBlockStatement(expr.body, bodyCtx),
          inferredType: loweredInferredType,
        };
      }

      case "arrowFunction": {
        const loweredParams = expr.parameters.map((p) =>
          lowerParameter(p, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        // For expression body arrow functions, we need to handle inferredType directly
        if (expr.body.kind === "blockStatement") {
          return {
            ...expr,
            parameters: loweredParams,
            returnType: loweredReturnType,
            body: lowerBlockStatement(expr.body, bodyCtx),
            inferredType: loweredInferredType,
          };
        } else {
          const loweredBody = lowerExpression(expr.body, ctx);
          // If arrow has expression body and return type, propagate to expression's inferredType
          const bodyWithType =
            loweredReturnType && loweredBody.inferredType?.kind === "objectType"
              ? { ...loweredBody, inferredType: loweredReturnType }
              : loweredBody;
          return {
            ...expr,
            parameters: loweredParams,
            returnType: loweredReturnType,
            body: bodyWithType,
            inferredType: loweredInferredType,
          };
        }
      }

      case "memberAccess":
        return {
          ...expr,
          object: lowerExpression(expr.object, ctx),
          property:
            typeof expr.property === "string"
              ? expr.property
              : lowerExpression(expr.property, ctx),
        };

      case "call":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((a) => lowerExpression(a, ctx)),
          dynamicImportNamespace: expr.dynamicImportNamespace
            ? (lowerExpression(expr.dynamicImportNamespace, ctx) as Extract<
                typeof expr.dynamicImportNamespace,
                { kind: "object" }
              >)
            : undefined,
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
          // parameterTypes participate in expected-type threading during emission
          // (e.g., object literal contextual typing). They must be lowered so
          // IrObjectType never leaks into the emitter.
          parameterTypes: expr.parameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceRestParameter: expr.surfaceRestParameter
            ? {
                ...expr.surfaceRestParameter,
                arrayType: expr.surfaceRestParameter.arrayType
                  ? lowerType(expr.surfaceRestParameter.arrayType, ctx)
                  : undefined,
                elementType: expr.surfaceRestParameter.elementType
                  ? lowerType(expr.surfaceRestParameter.elementType, ctx)
                  : undefined,
              }
            : undefined,
          narrowing: expr.narrowing
            ? {
                ...expr.narrowing,
                targetType: lowerType(expr.narrowing.targetType, ctx),
              }
            : undefined,
        };

      case "new":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((a) => lowerExpression(a, ctx)),
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
          parameterTypes: expr.parameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceRestParameter: expr.surfaceRestParameter
            ? {
                ...expr.surfaceRestParameter,
                arrayType: expr.surfaceRestParameter.arrayType
                  ? lowerType(expr.surfaceRestParameter.arrayType, ctx)
                  : undefined,
                elementType: expr.surfaceRestParameter.elementType
                  ? lowerType(expr.surfaceRestParameter.elementType, ctx)
                  : undefined,
              }
            : undefined,
        };

      case "update":
      case "unary":
      case "await":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "yield":
        return {
          ...expr,
          expression: expr.expression
            ? lowerExpression(expr.expression, ctx)
            : undefined,
        };

      case "binary":
      case "logical":
        return {
          ...expr,
          left: lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "conditional":
        return {
          ...expr,
          condition: lowerExpression(expr.condition, ctx),
          whenTrue: lowerExpression(expr.whenTrue, ctx),
          whenFalse: lowerExpression(expr.whenFalse, ctx),
        };

      case "assignment":
        return {
          ...expr,
          left:
            expr.left.kind === "identifierPattern" ||
            expr.left.kind === "arrayPattern" ||
            expr.left.kind === "objectPattern"
              ? lowerPattern(expr.left, ctx)
              : lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "templateLiteral":
        return {
          ...expr,
          expressions: expr.expressions.map((e) => lowerExpression(e, ctx)),
        };

      case "spread":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "numericNarrowing":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "typeAssertion":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "asinterface":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "trycast":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "stackalloc":
        return {
          ...expr,
          elementType: lowerType(expr.elementType, ctx),
          size: lowerExpression(expr.size, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "defaultof":
        return {
          ...expr,
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "nameof":
        return expr;

      case "sizeof":
        return {
          ...expr,
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };
    }
  })();

  // Lower inferred/contextual metadata for all expression kinds so objectType
  // cannot leak through metadata-only paths (e.g. call/member inferredType).
  // Identifier expressions are handled explicitly above to avoid rewriting
  // imported CLR/global placeholders.
  if (lowered.kind !== "identifier") {
    let nextExpr: IrExpression = lowered;
    const inferredType = nextExpr.inferredType;
    if (
      inferredType &&
      !(inferredType.kind === "objectType" && inferredType.members.length === 0)
    ) {
      const loweredInferred = lowerType(inferredType, ctx);
      if (loweredInferred !== inferredType) {
        nextExpr = { ...nextExpr, inferredType: loweredInferred };
      }
    }

    if ("contextualType" in nextExpr) {
      const contextualExpr = nextExpr as IrExpression & {
        contextualType?: IrType;
      };
      const contextualType = contextualExpr.contextualType;
      if (
        contextualType &&
        !(
          contextualType.kind === "objectType" &&
          contextualType.members.length === 0
        )
      ) {
        const loweredContextual = lowerType(contextualType, ctx);
        if (loweredContextual !== contextualType) {
          nextExpr = {
            ...contextualExpr,
            contextualType: loweredContextual,
          } as IrExpression;
        }
      }
    }
    return nextExpr;
  }

  return lowered;
};

/**
 * Lower a block statement specifically (for places that need IrBlockStatement)
 */
const lowerBlockStatement = (
  stmt: IrBlockStatement,
  ctx: LoweringContext
): IrBlockStatement => {
  return {
    ...stmt,
    statements: stmt.statements.map((s) => lowerStatement(s, ctx)),
  };
};

/**
 * Lower a variable declaration specifically (for forStatement initializer)
 */
const lowerVariableDeclaration = (
  stmt: IrVariableDeclaration,
  ctx: LoweringContext
): IrVariableDeclaration => {
  return {
    ...stmt,
    declarations: stmt.declarations.map((d) => ({
      ...d,
      name: lowerPattern(d.name, ctx),
      type: d.type ? lowerType(d.type, ctx) : undefined,
      initializer: d.initializer
        ? lowerExpression(d.initializer, ctx)
        : undefined,
    })),
  };
};

/**
 * Lower a class member
 */
const lowerClassMember = (
  member: IrClassMember,
  ctx: LoweringContext
): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration": {
      const loweredReturnType = member.returnType
        ? lowerType(member.returnType, ctx)
        : undefined;
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...member,
        typeParameters: member.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        parameters: member.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: loweredReturnType,
        body: member.body
          ? lowerBlockStatement(member.body, bodyCtx)
          : undefined,
      };
    }
    case "propertyDeclaration":
      return {
        ...member,
        type: member.type
          ? lowerType(member.type, ctx, member.name)
          : undefined,
        initializer: member.initializer
          ? lowerExpression(member.initializer, ctx)
          : undefined,
        getterBody: member.getterBody
          ? lowerBlockStatement(member.getterBody, ctx)
          : undefined,
        setterBody: member.setterBody
          ? lowerBlockStatement(member.setterBody, ctx)
          : undefined,
      };
    case "constructorDeclaration":
      return {
        ...member,
        parameters: member.parameters.map((p) => lowerParameter(p, ctx)),
        body: member.body ? lowerBlockStatement(member.body, ctx) : undefined,
      };
  }
};

/**
 * Lower a statement
 */
const lowerStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((d) => ({
          ...d,
          name: lowerPattern(d.name, ctx),
          type: d.type ? lowerType(d.type, ctx) : undefined,
          initializer: d.initializer
            ? lowerExpression(d.initializer, ctx)
            : undefined,
        })),
      };

    case "functionDeclaration": {
      // First lower the return type
      const loweredReturnType = stmt.returnType
        ? lowerType(stmt.returnType, ctx)
        : undefined;
      // Create context with the lowered return type for return statements
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        parameters: stmt.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: loweredReturnType,
        body: lowerBlockStatement(stmt.body, bodyCtx),
      };
    }

    case "classDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        superClass: stmt.superClass
          ? lowerType(stmt.superClass, ctx)
          : undefined,
        implements: stmt.implements.map((i) => lowerType(i, ctx)),
        members: stmt.members.map((m) => lowerClassMember(m, ctx)),
      };

    case "interfaceDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        extends: stmt.extends.map((e) => lowerType(e, ctx)),
        members: stmt.members.map((m) => lowerInterfaceMember(m, ctx)),
      };

    case "enumDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((m) => ({
          ...m,
          initializer: m.initializer
            ? lowerExpression(m.initializer, ctx)
            : undefined,
        })),
      };

    case "typeAliasDeclaration":
      // IMPORTANT: Do NOT lower the top-level objectType in a type alias declaration.
      // The emitter already generates a class with __Alias suffix for these.
      // We only lower nested objectTypes within the members.
      if (stmt.type.kind === "objectType") {
        // Lower nested types within the object type's members, but keep objectType as-is
        const loweredMembers: IrInterfaceMember[] = stmt.type.members.map(
          (m) => {
            if (m.kind === "propertySignature") {
              return {
                ...m,
                type: lowerType(m.type, ctx),
              };
            } else if (m.kind === "methodSignature") {
              return {
                ...m,
                parameters: m.parameters.map((p) => lowerParameter(p, ctx)),
                returnType: m.returnType
                  ? lowerType(m.returnType, ctx)
                  : undefined,
              };
            }
            return m;
          }
        );

        return {
          ...stmt,
          typeParameters: stmt.typeParameters?.map((tp) =>
            lowerTypeParameter(tp, ctx)
          ),
          type: {
            ...stmt.type,
            members: loweredMembers,
          },
        };
      }

      // For non-objectType type aliases, lower the type normally
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        type: lowerType(stmt.type, ctx),
      };

    case "expressionStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "returnStatement": {
      if (!stmt.expression) {
        return stmt;
      }
      const loweredExpr = lowerExpression(stmt.expression, ctx);
      // If we have a function return type and the expression's inferredType is objectType,
      // replace it with the lowered type (stripping nullish from union if needed)
      if (
        ctx.currentFunctionReturnType &&
        loweredExpr.inferredType?.kind === "objectType"
      ) {
        // Extract non-nullish part of return type (e.g., { title: string } from { title: string } | undefined)
        const targetType = stripNullishFromType(ctx.currentFunctionReturnType);
        return {
          ...stmt,
          expression: { ...loweredExpr, inferredType: targetType },
        };
      }
      return {
        ...stmt,
        expression: loweredExpr,
      };
    }

    case "ifStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        thenStatement: lowerStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? lowerStatement(stmt.elseStatement, ctx)
          : undefined,
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? stmt.initializer.kind === "variableDeclaration"
            ? lowerVariableDeclaration(stmt.initializer, ctx)
            : lowerExpression(stmt.initializer, ctx)
          : undefined,
        condition: stmt.condition
          ? lowerExpression(stmt.condition, ctx)
          : undefined,
        update: stmt.update ? lowerExpression(stmt.update, ctx) : undefined,
        body: lowerStatement(stmt.body, ctx),
      };

    case "forOfStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forInStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? lowerExpression(c.test, ctx) : undefined,
          statements: c.statements.map((s) => lowerStatement(s, ctx)),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: lowerBlockStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              parameter: stmt.catchClause.parameter
                ? lowerPattern(stmt.catchClause.parameter, ctx)
                : undefined,
              body: lowerBlockStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? lowerBlockStatement(stmt.finallyBlock, ctx)
          : undefined,
      };

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) => lowerStatement(s, ctx)),
      };

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? lowerExpression(stmt.output, ctx) : undefined,
        receiveTarget: stmt.receiveTarget
          ? lowerPattern(stmt.receiveTarget, ctx)
          : undefined,
        receivedType: stmt.receivedType
          ? lowerType(stmt.receivedType, ctx)
          : undefined,
      };

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? lowerExpression(stmt.expression, ctx)
          : undefined,
      };

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return stmt;
  }
};

/**
 * Lower a single module
 */
const lowerModule = (
  module: IrModule,
  shared: {
    readonly generatedDeclarations: IrClassDeclaration[];
    readonly shapeToName: Map<string, string>;
    readonly shapeToExistingReference: Map<string, IrReferenceType>;
    readonly existingTypeNames: ReadonlySet<string>;
    readonly loweredTypeByIdentity: WeakMap<object, IrType>;
    readonly loweredReferenceByStableKey: Map<string, IrReferenceType>;
  }
): IrModule => {
  const ctx: LoweringContext = {
    generatedDeclarations: shared.generatedDeclarations,
    shapeToName: shared.shapeToName,
    shapeToExistingReference: shared.shapeToExistingReference,
    moduleFilePath: module.filePath,
    existingTypeNames: shared.existingTypeNames,
    loweredTypeByIdentity: shared.loweredTypeByIdentity,
    loweredReferenceByStableKey: shared.loweredReferenceByStableKey,
  };

  // Lower all statements in the module body
  const loweredBody = module.body.map((stmt) => lowerStatement(stmt, ctx));

  // Lower exports
  const loweredExports = module.exports.map((exp) => {
    if (exp.kind === "default") {
      return {
        ...exp,
        expression: lowerExpression(exp.expression, ctx),
      };
    } else if (exp.kind === "declaration") {
      return {
        ...exp,
        declaration: lowerStatement(exp.declaration, ctx),
      };
    }
    return exp;
  });

  return {
    ...module,
    body: loweredBody,
    exports: loweredExports,
  };
};

const findCommonNamespacePrefix = (namespaces: readonly string[]): string => {
  if (namespaces.length === 0) return "";
  const split = namespaces.map((ns) => ns.split("."));
  const first = split[0] ?? [];
  const minLength = Math.min(...split.map((s) => s.length));

  let commonLength = 0;
  for (let i = 0; i < minLength; i++) {
    const seg = first[i];
    if (seg && split.every((s) => s[i] === seg)) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  return first.slice(0, commonLength).join(".");
};

const isAnonymousReferenceType = (
  value: unknown
): value is IrReferenceType & {
  readonly structuralMembers: readonly IrInterfaceMember[];
} => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<IrReferenceType> & {
    readonly kind?: unknown;
    readonly name?: unknown;
    readonly structuralMembers?: unknown;
  };

  return (
    record.kind === "referenceType" &&
    typeof record.name === "string" &&
    record.name.startsWith("__Anon_") &&
    Array.isArray(record.structuralMembers) &&
    record.structuralMembers.length > 0
  );
};

const registerExistingAnonymousReference = (
  type: IrReferenceType & {
    readonly structuralMembers: readonly IrInterfaceMember[];
  },
  shapeToExistingReference: Map<string, IrReferenceType>
): void => {
  const signature = computeShapeSignature({
    kind: "objectType",
    members: type.structuralMembers,
  });

  const resolvedClrType =
    type.resolvedClrType ?? type.typeId?.clrName ?? undefined;
  const existing = shapeToExistingReference.get(signature);
  if (
    existing &&
    existing.resolvedClrType !== undefined &&
    resolvedClrType === undefined
  ) {
    return;
  }

  shapeToExistingReference.set(signature, {
    kind: "referenceType",
    name: type.name,
    typeArguments: type.typeArguments,
    resolvedClrType,
    structuralMembers: type.structuralMembers,
  });
};

const collectExistingAnonymousReferences = (
  value: unknown,
  shapeToExistingReference: Map<string, IrReferenceType>,
  seen: WeakSet<object>
): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (isAnonymousReferenceType(value)) {
    registerExistingAnonymousReference(value, shapeToExistingReference);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectExistingAnonymousReferences(entry, shapeToExistingReference, seen);
    }
    return;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    collectExistingAnonymousReferences(entry, shapeToExistingReference, seen);
  }
};

const collectAnonymousReferencesFromBindings = (
  bindings: ReadonlyMap<string, FrontendTypeBinding> | undefined,
  shapeToExistingReference: Map<string, IrReferenceType>
): void => {
  if (!bindings || bindings.size === 0) {
    return;
  }

  for (const binding of bindings.values()) {
    const simpleAlias = binding.alias.split(".").pop() ?? binding.alias;
    const simpleName = binding.name.split(".").pop() ?? binding.name;
    if (
      !simpleAlias.startsWith("__Anon_") &&
      !simpleName.startsWith("__Anon_")
    ) {
      continue;
    }
    if (binding.members.some((member) => member.kind === "method")) {
      continue;
    }

    const members = binding.members
      .filter(
        (
          member
        ): member is (typeof binding.members)[number] & { kind: "property" } =>
          member.kind === "property" && member.semanticType !== undefined
      )
      .map((member): IrInterfaceMember => {
        const semanticType = member.semanticType;
        if (!semanticType) {
          throw new Error(
            "Anonymous binding property matched without semanticType"
          );
        }

        const hasUndefinedBranch =
          semanticType.kind === "unionType" &&
          semanticType.types.some(
            (type) => type.kind === "primitiveType" && type.name === "undefined"
          );
        const isOptional =
          member.semanticOptional === true || hasUndefinedBranch;

        return {
          kind: "propertySignature",
          name: member.alias,
          type: isOptional
            ? stripUndefinedFromType(semanticType)
            : semanticType,
          isOptional,
          isReadonly: false,
        };
      });

    if (members.length === 0) {
      continue;
    }

    registerExistingAnonymousReference(
      {
        kind: "referenceType",
        name: simpleAlias.startsWith("__Anon_") ? simpleAlias : simpleName,
        resolvedClrType: binding.name,
        structuralMembers: members,
      },
      shapeToExistingReference
    );
  }
};

/**
 * Run anonymous type lowering pass on all modules
 */
export const runAnonymousTypeLoweringPass = (
  modules: readonly IrModule[],
  options?: AnonymousTypeLoweringOptions
): AnonymousTypeLoweringResult => {
  const existingTypeNames = new Set<string>();
  const shapeToExistingReference = new Map<string, IrReferenceType>();
  const existingReferenceTraversalSeen = new WeakSet<object>();
  for (const module of modules) {
    for (const stmt of module.body) {
      switch (stmt.kind) {
        case "classDeclaration":
          if (isReusableStructuralCarrierName(stmt.name)) {
            const members = classMembersToInterfaceMembers(stmt.members);
            if (members.length > 0) {
              registerExistingAnonymousReference(
                {
                  kind: "referenceType",
                  name: stmt.name,
                  typeArguments:
                    stmt.typeParameters?.map(
                      (parameter): IrType => ({
                        kind: "typeParameterType",
                        name: parameter.name,
                      })
                    ) ?? undefined,
                  resolvedClrType: `${module.namespace}.${stmt.name}`,
                  structuralMembers: members,
                },
                shapeToExistingReference
              );
            }
          }
          existingTypeNames.add(stmt.name);
          break;
        case "interfaceDeclaration":
          if (isReusableStructuralCarrierName(stmt.name)) {
            registerExistingAnonymousReference(
              {
                kind: "referenceType",
                name: stmt.name,
                typeArguments:
                  stmt.typeParameters?.map(
                    (parameter): IrType => ({
                      kind: "typeParameterType",
                      name: parameter.name,
                    })
                  ) ?? undefined,
                resolvedClrType: `${module.namespace}.${stmt.name}`,
                structuralMembers: stmt.members,
              },
              shapeToExistingReference
            );
          }
          existingTypeNames.add(stmt.name);
          break;
        case "enumDeclaration":
        case "typeAliasDeclaration":
          existingTypeNames.add(stmt.name);
          break;
      }
    }

    collectExistingAnonymousReferences(
      module,
      shapeToExistingReference,
      existingReferenceTraversalSeen
    );
  }

  collectAnonymousReferencesFromBindings(
    options?.bindings,
    shapeToExistingReference
  );

  const shared = {
    generatedDeclarations: [] as IrClassDeclaration[],
    shapeToName: new Map<string, string>(),
    shapeToExistingReference,
    existingTypeNames,
    loweredTypeByIdentity: new WeakMap<object, IrType>(),
    loweredReferenceByStableKey: new Map<string, IrReferenceType>(),
  };

  const loweredModules = modules.map((m) => lowerModule(m, shared));

  // If any anonymous classes were generated, emit them once in a shared module
  // in the common root namespace so they are visible to all nested namespaces.
  if (shared.generatedDeclarations.length > 0) {
    const publicAnonymousTypes = collectPubliclyReachableAnonymousTypes(
      loweredModules,
      shared.generatedDeclarations
    );
    const commonNamespace =
      findCommonNamespacePrefix(modules.map((m) => m.namespace)) ||
      (modules[0]?.namespace ?? "");

    const anonModule: IrModule = {
      kind: "module",
      // Special synthetic module prefix: downstream CLI code uses this to skip
      // source-based augmentation steps (no corresponding .ts file exists).
      filePath: "__tsonic/__tsonic_anonymous_types.g.ts",
      namespace: commonNamespace,
      className: "__tsonic_anonymous_types",
      isStaticContainer: true,
      imports: [],
      body: shared.generatedDeclarations.map((declaration) => ({
        ...declaration,
        isExported: publicAnonymousTypes.has(declaration.name),
      })),
      exports: [],
    };

    return {
      ok: true,
      modules: [anonModule, ...loweredModules],
    };
  }

  return {
    ok: true,
    modules: loweredModules,
  };
};

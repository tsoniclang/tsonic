/**
 * Anonymous Type Lower Types
 *
 * Core type, parameter, type-parameter, interface-member, and pattern
 * lowering functions. These replace IrObjectType nodes with IrReferenceType
 * nodes in type positions throughout the IR tree.
 *
 * Note: This module and anon-type-ir-rewriting.ts form a mutual recursion
 * group (e.g. lowerParameter -> lowerExpression -> lowerBlockStatement ->
 * lowerStatement -> lowerExpression). The circular import is safe because
 * all exports are const arrow functions that are not invoked at import time.
 */

import type {
  IrType,
  IrParameter,
  IrTypeParameter,
  IrInterfaceMember,
  IrPattern,
  IrObjectType,
  IrReferenceType,
  IrClassDeclaration,
} from "../types.js";

import { getReferenceLoweringStableKey } from "./anon-type-shape-analysis.js";

import { getOrCreateObjectTypeReference } from "./anon-type-declaration-synthesis.js";

// Circular import: lowerParameter/lowerPattern call lowerExpression.
// Safe because all exports are const arrow functions (no top-level execution).
import { lowerExpression } from "./anon-type-ir-rewriting.js";

/**
 * Context for tracking state during lowering
 */
export type LoweringContext = {
  /** Generated class declarations (shared across modules) */
  readonly generatedDeclarations: IrClassDeclaration[];
  /** Map from shape signature to generated type name for deduplication (shared across modules) */
  readonly shapeToName: Map<string, string>;
  /** Existing reusable structural reference types available across the compilation, keyed by shape signature. */
  readonly shapeToExistingReference: Map<string, IrReferenceType>;
  /** Explicit named structural aliases in the current module, keyed by exact shape signature. */
  readonly localNamedStructuralReferences: ReadonlyMap<
    string,
    IrReferenceType
  >;
  /** Local named type declarations in the current module, keyed by authored type name. */
  readonly localDeclaredTypeReferences: ReadonlyMap<string, IrReferenceType>;
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
 * Lower a type, replacing objectType with referenceType
 */
export const lowerType = (
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
      const localDeclaredReference =
        type.resolvedClrType === undefined
          ? ctx.localDeclaredTypeReferences.get(type.name)
          : undefined;
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

      if (!hasTypeArgs && !hasStructuralMembers && !localDeclaredReference) {
        return type;
      }

      const loweredReference: IrReferenceType = {
        ...type,
        resolvedClrType:
          type.resolvedClrType ?? localDeclaredReference?.resolvedClrType,
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
export const lowerParameter = (
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
export const lowerTypeParameter = (
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
export const lowerInterfaceMember = (
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
export const lowerPattern = (
  pattern: IrPattern,
  ctx: LoweringContext
): IrPattern => {
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

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

/**
 * Result of anonymous type lowering pass
 */
export type AnonymousTypeLoweringResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
};

/**
 * Context for tracking state during lowering
 */
type LoweringContext = {
  /** Generated class declarations for this module */
  readonly generatedDeclarations: IrClassDeclaration[];
  /** Map from shape signature to generated type name for deduplication */
  readonly shapeToName: Map<string, string>;
  /** Module file path for unique naming */
  readonly moduleFilePath: string;
  /** Type names already declared in this module (avoid collisions) */
  readonly existingTypeNames: ReadonlySet<string>;
  /** Current function's lowered return type (for propagating to return statements) */
  readonly currentFunctionReturnType?: IrType;
};

/**
 * Collect free type parameter names referenced by an IrType.
 *
 * These are used to make synthesized anonymous types generic when their
 * member types contain typeParameterType nodes (e.g., `{ value: T }`).
 */
const collectTypeParameterNames = (type: IrType, out: Set<string>): void => {
  switch (type.kind) {
    case "typeParameterType":
      out.add(type.name);
      return;

    case "referenceType":
      for (const ta of type.typeArguments ?? []) {
        if (ta) collectTypeParameterNames(ta, out);
      }
      return;

    case "arrayType":
      collectTypeParameterNames(type.elementType, out);
      return;

    case "tupleType":
      for (const el of type.elementTypes) {
        if (el) collectTypeParameterNames(el, out);
      }
      return;

    case "functionType":
      for (const p of type.parameters) {
        if (p.type) collectTypeParameterNames(p.type, out);
      }
      collectTypeParameterNames(type.returnType, out);
      return;

    case "unionType":
    case "intersectionType":
      for (const t of type.types) {
        if (t) collectTypeParameterNames(t, out);
      }
      return;

    case "dictionaryType":
      collectTypeParameterNames(type.keyType, out);
      collectTypeParameterNames(type.valueType, out);
      return;

    case "objectType":
      for (const m of type.members) {
        if (m.kind === "propertySignature") {
          collectTypeParameterNames(m.type, out);
        } else if (m.kind === "methodSignature") {
          for (const p of m.parameters) {
            if (p.type) collectTypeParameterNames(p.type, out);
          }
          if (m.returnType) collectTypeParameterNames(m.returnType, out);
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

/**
 * Serialize an IrType to a stable string for shape signature
 */
const serializeType = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return `lit:${typeof type.value}:${String(type.value)}`;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        return `ref:${type.name}<${type.typeArguments.map(serializeType).join(",")}>`;
      }
      return `ref:${type.name}`;
    case "arrayType":
      return `arr:${serializeType(type.elementType)}`;
    case "tupleType":
      return `tup:[${type.elementTypes.map(serializeType).join(",")}]`;
    case "functionType": {
      const params = type.parameters
        .map((p) => (p.type ? serializeType(p.type) : "any"))
        .join(",");
      return `fn:(${params})=>${serializeType(type.returnType)}`;
    }
    case "unionType":
      return `union:[${type.types.map(serializeType).join("|")}]`;
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
      // Serialize property signatures
      const propMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map(
          (m) =>
            `prop:${m.isReadonly ? "ro:" : ""}${m.name}${m.isOptional ? "?" : ""}:${serializeType(m.type)}`
        );

      // Serialize method signatures
      const methodMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "methodSignature" }> =>
            m.kind === "methodSignature"
        )
        .map((m) => {
          const params = m.parameters
            .map((p) => (p.type ? serializeType(p.type) : "any"))
            .join(",");
          const ret = m.returnType ? serializeType(m.returnType) : "void";
          return `method:${m.name}(${params})=>${ret}`;
        });

      const allMembers = [...propMembers, ...methodMembers].sort().join(";");
      return `obj:{${allMembers}}`;
    }
    case "dictionaryType":
      return `dict:[${serializeType(type.keyType)}]:${serializeType(type.valueType)}`;
    case "intersectionType":
      return `intersection:[${type.types.map(serializeType).join("&")}]`;
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

/**
 * Generate a module-unique hash from file path
 */
const generateModuleHash = (filePath: string): string => {
  return createHash("md5").update(filePath).digest("hex").slice(0, 4);
};

/**
 * Get or create a generated type name for an object type shape
 */
const sanitizeInlineTypeName = (raw: string): string | undefined => {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;

  const cleaned = trimmed.replace(/[^A-Za-z0-9_]/g, "_");
  if (cleaned === "") return undefined;

  // C# identifiers cannot start with a digit.
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`;

  return cleaned;
};

const getOrCreateTypeName = (
  objectType: IrObjectType,
  ctx: LoweringContext,
  nameHint?: string
): string => {
  const signature = computeShapeSignature(objectType);
  const existing = ctx.shapeToName.get(signature);
  if (existing) {
    return existing;
  }

  // Generate name with module hash prefix to avoid collisions across modules
  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const shapeHash = generateShapeHash(signature);
  const anonName = `__Anon_${moduleHash}_${shapeHash}`;
  const preferredBase = nameHint ? sanitizeInlineTypeName(nameHint) : undefined;

  const preferredName = preferredBase
    ? ctx.existingTypeNames.has(preferredBase) ||
      ctx.generatedDeclarations.some((d) => d.name === preferredBase) ||
      Array.from(ctx.shapeToName.values()).includes(preferredBase)
      ? `${preferredBase}_${shapeHash}`
      : preferredBase
    : undefined;

  const name = preferredName ?? anonName;
  ctx.shapeToName.set(signature, name);

  const typeParamNames = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
    } else if (member.kind === "methodSignature") {
      for (const p of member.parameters) {
        if (p.type) collectTypeParameterNames(p.type, typeParamNames);
      }
      if (member.returnType) collectTypeParameterNames(member.returnType, typeParamNames);
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
const lowerType = (type: IrType, ctx: LoweringContext, nameHint?: string): IrType => {
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

      // Generate name for this shape
      const typeName = getOrCreateTypeName(loweredObjectType, ctx, nameHint);

      const typeParamNames = new Set<string>();
      for (const member of loweredObjectType.members) {
        if (member.kind === "propertySignature") {
          collectTypeParameterNames(member.type, typeParamNames);
        } else if (member.kind === "methodSignature") {
          for (const p of member.parameters) {
            if (p.type) collectTypeParameterNames(p.type, typeParamNames);
          }
          if (member.returnType) collectTypeParameterNames(member.returnType, typeParamNames);
        }
      }
      const orderedTypeParams = Array.from(typeParamNames).sort();

      // Return reference to generated type
      const refType: IrReferenceType = {
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
      };
      return refType;
    }

    case "arrayType":
      return {
        ...type,
        elementType: lowerType(type.elementType, ctx),
      };

    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((et) => lowerType(et, ctx)),
      };

    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: lowerType(type.returnType, ctx),
      };

    case "unionType":
      return {
        ...type,
        types: type.types.map((t) => lowerType(t, ctx)),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map((t) => lowerType(t, ctx)),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: lowerType(type.keyType, ctx),
        valueType: lowerType(type.valueType, ctx),
      };

    case "referenceType": {
      // Lower both typeArguments and structuralMembers
      const typeArgs = type.typeArguments;
      const structuralMembers = type.structuralMembers;
      const hasTypeArgs = typeArgs !== undefined && typeArgs.length > 0;
      const hasStructuralMembers =
        structuralMembers !== undefined && structuralMembers.length > 0;

      if (!hasTypeArgs && !hasStructuralMembers) {
        return type;
      }

      return {
        ...type,
        typeArguments: hasTypeArgs
          ? typeArgs.map((ta) => lowerType(ta, ctx))
          : undefined,
        structuralMembers: hasStructuralMembers
          ? structuralMembers.map((m) => lowerInterfaceMember(m, ctx))
          : undefined,
      };
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
        if (expr.resolvedClrType || expr.resolvedAssembly || expr.importedFrom) return expr;
        // Treat empty object types (`{}`) as `object`-like placeholders; do not synthesize.
        if (expr.inferredType.kind === "objectType" && expr.inferredType.members.length === 0) {
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
          elements: expr.elements.map((e) =>
            e ? lowerExpression(e, ctx) : undefined
          ),
        };

      case "object":
        return {
          ...expr,
          contextualType: expr.contextualType
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

      case "functionExpression": {
        const loweredParams = expr.parameters.map((p) => lowerParameter(p, ctx));
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
                returnType: loweredReturnType ?? lowerType(expr.inferredType.returnType, ctx),
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
        const loweredParams = expr.parameters.map((p) => lowerParameter(p, ctx));
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
                returnType: loweredReturnType ?? lowerType(expr.inferredType.returnType, ctx),
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
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
        };

      case "new":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((a) => lowerExpression(a, ctx)),
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
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
    }
  })();
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
        type: member.type ? lowerType(member.type, ctx, member.name) : undefined,
        initializer: member.initializer
          ? lowerExpression(member.initializer, ctx)
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
        superClass: stmt.superClass ? lowerType(stmt.superClass, ctx) : undefined,
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
const lowerModule = (module: IrModule): IrModule => {
  const existingTypeNames = new Set<string>();
  for (const stmt of module.body) {
    switch (stmt.kind) {
      case "classDeclaration":
      case "interfaceDeclaration":
      case "enumDeclaration":
      case "typeAliasDeclaration":
        existingTypeNames.add(stmt.name);
        break;
    }
  }

  const ctx: LoweringContext = {
    generatedDeclarations: [],
    shapeToName: new Map(),
    moduleFilePath: module.filePath,
    existingTypeNames,
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

  // Prepend generated declarations to module body
  const newBody: IrStatement[] = [...ctx.generatedDeclarations, ...loweredBody];

  return {
    ...module,
    body: newBody,
    exports: loweredExports,
  };
};

/**
 * Run anonymous type lowering pass on all modules
 */
export const runAnonymousTypeLoweringPass = (
  modules: readonly IrModule[]
): AnonymousTypeLoweringResult => {
  const loweredModules = modules.map((m) => lowerModule(m));

  return {
    ok: true,
    modules: loweredModules,
  };
};

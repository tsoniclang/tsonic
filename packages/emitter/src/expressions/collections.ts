/**
 * Collection expression emitters (arrays and objects)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  getPropertyType,
  stripNullish,
  resolveTypeAlias,
  selectUnionMemberForObjectLiteral,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  printExpression,
  printType,
} from "../core/format/backend-ast/printer.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

type ObjectMemberKind = "method" | "property" | "field" | "enumMember";

type ObjectMemberBucket = "methods" | "properties" | "fields" | "enumMembers";

const bucketFromMemberKind = (
  kind: ObjectMemberKind | undefined
): ObjectMemberBucket => {
  switch (kind) {
    case "method":
      return "methods";
    case "field":
      return "fields";
    case "enumMember":
      return "enumMembers";
    default:
      return "properties";
  }
};

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const lookupMemberKindFromLocalTypes = (
  receiverTypeName: string,
  memberName: string,
  context: EmitterContext
): ObjectMemberKind | undefined => {
  const local = context.localTypes?.get(receiverTypeName);
  if (!local) return undefined;

  if (local.kind === "enum") {
    return local.members.includes(memberName) ? "enumMember" : undefined;
  }

  if (local.kind === "typeAlias") {
    if (local.type.kind !== "objectType") return undefined;
    const found = local.type.members.find((m) => m.name === memberName);
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  // class/interface
  const members = local.members;
  for (const m of members) {
    if (!("name" in m) || m.name !== memberName) continue;

    if (m.kind === "methodDeclaration" || m.kind === "methodSignature") {
      return "method";
    }

    if (m.kind === "propertySignature") return "property";

    if (m.kind === "propertyDeclaration") {
      const hasAccessors = !!(m.getterBody || m.setterBody);
      return hasAccessors ? "property" : "field";
    }
  }

  return undefined;
};

const resolveReceiverTypeFqn = (
  receiverType: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (!receiverType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind !== "referenceType") return undefined;

  if (resolved.resolvedClrType) {
    return stripGlobalPrefix(resolved.resolvedClrType);
  }

  const binding = context.importBindings?.get(resolved.name);
  if (binding?.kind === "type") {
    return stripGlobalPrefix(binding.clrName);
  }

  return undefined;
};

const lookupMemberKindFromIndex = (
  receiverTypeFqn: string,
  memberName: string,
  context: EmitterContext
): ObjectMemberKind | undefined => {
  const perType = context.options.typeMemberIndex?.get(receiverTypeFqn);
  const kind = perType?.get(memberName) as ObjectMemberKind | undefined;
  return kind;
};

const getMemberKind = (
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext
): ObjectMemberKind | undefined => {
  if (!receiverType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);

  if (resolved.kind === "objectType") {
    const found = resolved.members.find((m) => m.name === memberName);
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  if (resolved.kind === "referenceType") {
    const localKind = lookupMemberKindFromLocalTypes(
      resolved.name,
      memberName,
      context
    );
    if (localKind) return localKind;

    const receiverFqn = resolveReceiverTypeFqn(resolved, context);
    if (receiverFqn) {
      return lookupMemberKindFromIndex(receiverFqn, memberName, context);
    }
  }

  return undefined;
};

const emitObjectMemberName = (
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext
): string => {
  const kind = getMemberKind(receiverType, memberName, context);
  return emitCSharpName(memberName, bucketFromMemberKind(kind), context);
};

/**
 * Escape a string for use in a C# string literal.
 */
const escapeCSharpString = (str: string): string =>
  str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

/**
 * Emit an array literal as CSharpExpressionAst
 */
export const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // Resolve type alias to check for tuple types
  const resolvedExpectedType = expectedType
    ? resolveTypeAlias(expectedType, context)
    : undefined;

  // Check if expected type is a tuple - emit as ValueTuple
  if (resolvedExpectedType?.kind === "tupleType") {
    return emitTupleLiteral(expr, context, resolvedExpectedType);
  }

  // Check if inferred type is a tuple
  if (expr.inferredType?.kind === "tupleType") {
    return emitTupleLiteral(expr, context, expr.inferredType);
  }

  let currentContext = context;
  const elementAsts: CSharpExpressionAst[] = [];

  // Determine element type as AST
  let elementTypeAst: CSharpTypeAst = {
    kind: "predefinedType",
    keyword: "object",
  };
  let elementTypeResolved = false;
  let expectedElementType: IrType | undefined = undefined;

  // Priority 1: Use explicit type annotation
  if (expectedType) {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(expectedType),
      context
    );

    if (resolvedExpected.kind === "arrayType") {
      expectedElementType = resolvedExpected.elementType;
      const [typeAst, newContext] = emitTypeAst(
        resolvedExpected.elementType,
        currentContext
      );
      elementTypeAst = typeAst;
      elementTypeResolved = true;
      currentContext = newContext;
    } else if (
      resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "Array" &&
      resolvedExpected.typeArguments &&
      resolvedExpected.typeArguments.length > 0
    ) {
      const firstArg = resolvedExpected.typeArguments[0];
      if (firstArg) {
        expectedElementType = firstArg;
        const [typeAst, newContext] = emitTypeAst(firstArg, currentContext);
        elementTypeAst = typeAst;
        elementTypeResolved = true;
        currentContext = newContext;
      }
    }
  }

  // Priority 2: Infer from literals
  if (!elementTypeResolved) {
    const definedElements = expr.elements.filter(
      (el): el is IrExpression => el !== undefined
    );

    if (definedElements.length > 0) {
      const allLiterals = definedElements.every((el) => el.kind === "literal");

      if (allLiterals) {
        const literals = definedElements as Extract<
          IrExpression,
          { kind: "literal" }
        >[];

        const allNumbers = literals.every(
          (lit) => typeof lit.value === "number"
        );

        if (allNumbers) {
          const hasDouble = literals.some(
            (lit) => lit.numericIntent === "Double"
          );
          const hasLong = literals.some((lit) => lit.numericIntent === "Int64");

          if (hasDouble) {
            elementTypeAst = { kind: "predefinedType", keyword: "double" };
            elementTypeResolved = true;
          } else if (hasLong) {
            elementTypeAst = { kind: "predefinedType", keyword: "long" };
            elementTypeResolved = true;
          } else {
            elementTypeAst = { kind: "predefinedType", keyword: "int" };
            elementTypeResolved = true;
          }
        } else if (literals.every((lit) => typeof lit.value === "string")) {
          elementTypeAst = { kind: "predefinedType", keyword: "string" };
          elementTypeResolved = true;
        } else if (literals.every((lit) => typeof lit.value === "boolean")) {
          elementTypeAst = { kind: "predefinedType", keyword: "bool" };
          elementTypeResolved = true;
        }
      }
    }
  }

  // Priority 3: Fall back to inferred type
  if (!elementTypeResolved) {
    if (expr.inferredType && expr.inferredType.kind === "arrayType") {
      expectedElementType = expr.inferredType.elementType;
      const [typeAst, newContext] = emitTypeAst(
        expr.inferredType.elementType,
        currentContext
      );
      elementTypeAst = typeAst;
      currentContext = newContext;
    }
  }

  // Check if array contains only spread elements
  const allSpreads = expr.elements.every(
    (el) => el !== undefined && el.kind === "spread"
  );

  if (allSpreads && expr.elements.length > 0) {
    // Emit as chained Enumerable.Concat calls + ToArray()
    const spreadElements = expr.elements.filter(
      (el): el is Extract<IrExpression, { kind: "spread" }> =>
        el !== undefined && el.kind === "spread"
    );

    const firstSpread = spreadElements[0];
    if (!firstSpread) {
      return [
        {
          kind: "arrayCreationExpression",
          elementType: { kind: "predefinedType", keyword: "object" },
          sizeExpression: { kind: "literalExpression", text: "0" },
        },
        currentContext,
      ];
    }

    const [firstAst, firstContext] = emitExpressionAst(
      firstSpread.expression,
      currentContext
    );
    currentContext = firstContext;

    // Build chain of Concat calls
    let concatAst: CSharpExpressionAst = firstAst;
    for (let i = 1; i < spreadElements.length; i++) {
      const spread = spreadElements[i];
      if (spread) {
        const [spreadAst, newContext] = emitExpressionAst(
          spread.expression,
          currentContext
        );
        concatAst = {
          kind: "invocationExpression",
          expression: {
            kind: "identifierExpression",
            identifier: "global::System.Linq.Enumerable.Concat",
          },
          arguments: [concatAst, spreadAst],
        };
        currentContext = newContext;
      }
    }

    // Wrap in ToArray()
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: "global::System.Linq.Enumerable.ToArray",
        },
        arguments: [concatAst],
      },
      currentContext,
    ];
  }

  // Regular array or mixed spreads/elements
  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole
      elementAsts.push({ kind: "defaultExpression" });
    } else if (element.kind === "spread") {
      // Spread mixed with other elements - not yet supported
      elementAsts.push({
        kind: "identifierExpression",
        identifier: "/* ...spread */",
      });
    } else {
      const [elemAst, newContext] = emitExpressionAst(
        element,
        currentContext,
        expectedElementType
      );
      elementAsts.push(elemAst);
      currentContext = newContext;
    }
  }

  // Always emit native CLR array
  if (elementAsts.length === 0) {
    // Array.Empty<T>() for empty arrays
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: "global::System.Array.Empty",
        },
        arguments: [],
        typeArguments: [elementTypeAst],
      },
      currentContext,
    ];
  }

  // new T[] { elem1, elem2, ... }
  return [
    {
      kind: "arrayCreationExpression",
      elementType: elementTypeAst,
      initializer: elementAsts,
    },
    currentContext,
  ];
};

/**
 * Emit an object literal as CSharpExpressionAst
 */
export const emitObject = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const effectiveType: IrType | undefined = (() => {
    if (!expectedType) return expr.contextualType;

    const strippedExpected = stripNullish(expectedType);
    if (
      strippedExpected.kind === "unknownType" ||
      strippedExpected.kind === "anyType" ||
      (strippedExpected.kind === "referenceType" &&
        strippedExpected.name === "object")
    ) {
      return expr.contextualType ?? expectedType;
    }

    return expectedType;
  })();

  // Check if contextual type is a dictionary type
  if (effectiveType?.kind === "dictionaryType") {
    return emitDictionaryLiteral(expr, currentContext, effectiveType);
  }

  const strippedType: IrType | undefined = effectiveType
    ? stripNullish(effectiveType)
    : undefined;

  // Handle union type aliases: select the best-matching union member
  const instantiationType: IrType | undefined = (() => {
    if (!strippedType) return undefined;

    const resolved = resolveTypeAlias(strippedType, currentContext);
    if (resolved.kind !== "unionType") return strippedType;

    const literalKeys = expr.properties
      .filter(
        (p): p is Extract<typeof p, { kind: "property" }> =>
          p.kind === "property" && typeof p.key === "string"
      )
      .map((p) => p.key as string);

    if (literalKeys.length !== expr.properties.length) return strippedType;

    const selected = selectUnionMemberForObjectLiteral(
      resolved,
      literalKeys,
      currentContext
    );
    return selected ?? strippedType;
  })();

  const [typeAst, typeContext] = resolveContextualTypeAst(
    instantiationType,
    currentContext
  );
  currentContext = typeContext;

  if (!typeAst) {
    throw new Error(
      "ICE: Object literal without contextual type reached emitter - validation missed TSN7403"
    );
  }

  // Strip nullable wrapper for object construction
  const safeTypeAst: CSharpTypeAst =
    typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;

  // Check if object has spreads - use IIFE pattern
  if (expr.hasSpreads) {
    return emitObjectWithSpreads(
      expr,
      currentContext,
      effectiveType,
      safeTypeAst,
      instantiationType
    );
  }

  // Regular object literal with nominal type
  const initializerAsts: CSharpExpressionAst[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      throw new Error("ICE: Spread in object literal but hasSpreads is false");
    } else {
      const key =
        typeof prop.key === "string"
          ? emitObjectMemberName(instantiationType, prop.key, currentContext)
          : "/* computed */";
      const propertyExpectedType =
        typeof prop.key === "string"
          ? getPropertyType(
              instantiationType ?? effectiveType,
              prop.key,
              currentContext
            )
          : undefined;
      const [valueAst, newContext] = emitExpressionAst(
        prop.value,
        currentContext,
        propertyExpectedType
      );
      initializerAsts.push({
        kind: "assignmentExpression",
        operatorToken: "=",
        left: { kind: "identifierExpression", identifier: key },
        right: valueAst,
      });
      currentContext = newContext;
    }
  }

  return [
    {
      kind: "objectCreationExpression",
      type: safeTypeAst,
      arguments: [],
      initializer: initializerAsts,
    },
    currentContext,
  ];
};

/**
 * Emit an object literal with spreads using IIFE pattern.
 */
const emitObjectWithSpreads = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  effectiveType: IrType | undefined,
  typeAst: CSharpTypeAst,
  targetType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const typeName = printType(typeAst);
  const assignments: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      const [spreadAssignments, newContext] = emitSpreadPropertyCopies(
        targetType,
        prop.expression,
        currentContext
      );
      assignments.push(...spreadAssignments);
      currentContext = newContext;
    } else {
      const key =
        typeof prop.key === "string"
          ? emitObjectMemberName(targetType, prop.key, currentContext)
          : "/* computed */";
      const propertyExpectedType =
        typeof prop.key === "string"
          ? getPropertyType(
              targetType ?? effectiveType,
              prop.key,
              currentContext
            )
          : undefined;
      const [valueAst, newContext] = emitExpressionAst(
        prop.value,
        currentContext,
        propertyExpectedType
      );
      assignments.push(`__tmp.${key} = ${printExpression(valueAst)}`);
      currentContext = newContext;
    }
  }

  const body = [
    `var __tmp = new ${typeName}()`,
    ...assignments,
    "return __tmp",
  ].join("; ");

  // IIFE: ((System.Func<T>)(() => { body; }))()
  // The lambda body contains inline statements — use expression body
  // with identifierExpression as a bridge at the statement boundary.
  const funcTypeAst: CSharpTypeAst = {
    kind: "identifierType",
    name: "global::System.Func",
    typeArguments: [typeAst],
  };
  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: {
      kind: "identifierExpression",
      identifier: `{ ${body}; }`,
    },
  };
  const castAst: CSharpExpressionAst = {
    kind: "castExpression",
    type: funcTypeAst,
    expression: {
      kind: "parenthesizedExpression",
      expression: lambdaAst,
    },
  };
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: castAst,
      },
      arguments: [],
    },
    currentContext,
  ];
};

/**
 * Emit property copy assignments from a spread source.
 */
const emitSpreadPropertyCopies = (
  targetType: IrType | undefined,
  spreadExpr: IrExpression,
  context: EmitterContext
): [string[], EmitterContext] => {
  let currentContext = context;
  const assignments: string[] = [];

  const spreadType = spreadExpr.inferredType;

  if (!spreadType) {
    const [exprAst, newContext] = emitExpressionAst(spreadExpr, currentContext);
    const exprText = printExpression(exprAst);
    assignments.push(`/* spread: ${exprText} (no type info) */`);
    return [assignments, newContext];
  }

  const [sourceAst, sourceContext] = emitExpressionAst(
    spreadExpr,
    currentContext
  );
  currentContext = sourceContext;
  const sourceExpr = printExpression(sourceAst);

  const propertyNames = getObjectTypePropertyNames(spreadType, currentContext);

  for (const propName of propertyNames) {
    const targetMember = emitObjectMemberName(
      targetType,
      propName,
      currentContext
    );
    const sourceMember = emitObjectMemberName(
      spreadType,
      propName,
      currentContext
    );
    assignments.push(`__tmp.${targetMember} = ${sourceExpr}.${sourceMember}`);
  }

  return [assignments, currentContext];
};

/**
 * Get property names from an object-like type.
 */
const getObjectTypePropertyNames = (
  type: IrType,
  context: EmitterContext
): readonly string[] => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    return resolved.members
      .filter(
        (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
          m.kind === "propertySignature"
      )
      .map((m) => m.name);
  }

  if (resolved.kind === "referenceType") {
    const localType = context.localTypes?.get(resolved.name);
    if (localType?.kind === "interface") {
      return localType.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }

    if (localType?.kind === "class") {
      return localType.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertyDeclaration" }> =>
            m.kind === "propertyDeclaration" && !m.isStatic
        )
        .map((m) => m.name);
    }

    if (
      localType?.kind === "typeAlias" &&
      localType.type.kind === "objectType"
    ) {
      return localType.type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }

    const receiverFqn = resolveReceiverTypeFqn(resolved, context);
    if (receiverFqn) {
      const perType = context.options.typeMemberIndex?.get(receiverFqn);
      if (perType) {
        const names: string[] = [];
        for (const [memberName, kind] of perType.entries()) {
          if (kind === "property" || kind === "field") {
            names.push(memberName);
          }
        }
        return names;
      }
    }
  }

  return [];
};

/**
 * Emit a dictionary literal as CSharpExpressionAst
 */
const emitDictionaryLiteral = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  dictType: Extract<IrType, { kind: "dictionaryType" }>
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const keyTypeAst = emitDictKeyTypeAst(dictType.keyType);
  const [valueTypeAst, ctx2] = emitTypeAst(dictType.valueType, currentContext);
  currentContext = ctx2;

  const dictTypeAst: CSharpTypeAst = {
    kind: "identifierType",
    name: "global::System.Collections.Generic.Dictionary",
    typeArguments: [keyTypeAst, valueTypeAst],
  };

  const initializerAsts: CSharpExpressionAst[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      throw new Error("ICE: Spread in dictionary literal not supported");
    } else {
      if (typeof prop.key !== "string") {
        throw new Error(
          "ICE: Computed property key in dictionary literal - validation gap"
        );
      }

      const [valueAst, newContext] = emitExpressionAst(
        prop.value,
        currentContext,
        dictType.valueType
      );
      // Dictionary initializer: ["key"] = value
      initializerAsts.push({
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: `["${escapeCSharpString(prop.key)}"]`,
        },
        right: valueAst,
      });
      currentContext = newContext;
    }
  }

  return [
    {
      kind: "objectCreationExpression",
      type: dictTypeAst,
      arguments: [],
      initializer: initializerAsts.length > 0 ? initializerAsts : undefined,
    },
    currentContext,
  ];
};

/**
 * Emit dictionary key type as AST.
 */
const emitDictKeyTypeAst = (keyType: IrType): CSharpTypeAst => {
  if (keyType.kind === "primitiveType") {
    switch (keyType.name) {
      case "string":
        return { kind: "predefinedType", keyword: "string" };
      case "number":
        return { kind: "predefinedType", keyword: "double" };
    }
  }

  throw new Error(
    `ICE: Unsupported dictionary key type reached emitter - validation missed TSN7413. Got: ${JSON.stringify(keyType)}`
  );
};

/**
 * Resolve contextual type to C# type AST.
 */
const resolveContextualTypeAst = (
  contextualType: IrType | undefined,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!contextualType) {
    return [undefined, context];
  }

  if (contextualType.kind === "referenceType") {
    const typeName = contextualType.name;
    const importBinding = context.importBindings?.get(typeName);

    if (importBinding && importBinding.kind === "type") {
      if (
        contextualType.typeArguments &&
        contextualType.typeArguments.length > 0
      ) {
        let currentContext = context;
        const typeArgAsts: CSharpTypeAst[] = [];
        for (const typeArg of contextualType.typeArguments) {
          const [typeArgAst, newContext] = emitTypeAst(typeArg, currentContext);
          typeArgAsts.push(typeArgAst);
          currentContext = newContext;
        }
        return [
          {
            kind: "identifierType",
            name: importBinding.clrName,
            typeArguments: typeArgAsts,
          },
          currentContext,
        ];
      }
      return [{ kind: "identifierType", name: importBinding.clrName }, context];
    }
  }

  return emitTypeAst(contextualType, context);
};

/**
 * Emit a tuple literal as CSharpExpressionAst
 *
 * Input:  const t: [string, number] = ["hello", 42];
 * Output: ("hello", 42.0)
 */
const emitTupleLiteral = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  tupleType: Extract<IrType, { kind: "tupleType" }>
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const elemAsts: CSharpExpressionAst[] = [];

  const definedElements = expr.elements.filter(
    (el): el is IrExpression => el !== undefined
  );

  for (let i = 0; i < definedElements.length; i++) {
    const element = definedElements[i];
    const expectedElementType = tupleType.elementTypes[i];

    if (element) {
      const [elemAst, newContext] = emitExpressionAst(
        element,
        currentContext,
        expectedElementType
      );
      elemAsts.push(elemAst);
      currentContext = newContext;
    }
  }

  // C# tuple literal: (elem1, elem2, ...)
  return [{ kind: "tupleExpression", elements: elemAsts }, currentContext];
};

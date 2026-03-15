/**
 * Collection expression emitters (arrays and objects)
 */

import { IrClassMember, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  getPropertyType,
  stripNullish,
  resolveTypeAlias,
  getArrayLikeElementType,
  selectUnionMemberForObjectLiteral,
} from "../core/semantic/type-resolution.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  identifierExpression,
  identifierType,
  stringLiteral,
  withTypeArguments,
} from "../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
  getIdentifierTypeName,
} from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";

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

const resolveArrayLiteralContextType = (
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) return undefined;

  const strippedExpected = stripNullish(expectedType);
  const resolvedExpected = resolveTypeAlias(strippedExpected, context);
  if (resolvedExpected.kind !== "unionType") {
    return strippedExpected;
  }

  const arrayLikeMembers = resolvedExpected.types.filter((member): member is IrType =>
    getArrayLikeElementType(member, context) !== undefined ||
    resolveTypeAlias(stripNullish(member), context).kind === "tupleType"
  );

  if (arrayLikeMembers.length === 1) {
    return arrayLikeMembers[0];
  }

  return strippedExpected;
};

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
    const typeName = getIdentifierTypeName(binding.typeAst);
    return typeName ? stripGlobalPrefix(typeName) : undefined;
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

const getDeterministicObjectKeyName = (
  key: string | IrExpression
): string | undefined => {
  if (typeof key === "string") return key;
  if (key.kind === "literal" && typeof key.value === "string") {
    return key.value;
  }
  return undefined;
};

const isObjectRootTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType") {
    return typeAst.keyword === "object";
  }
  if (typeAst.kind === "identifierType") {
    const normalized = typeAst.name.replace(/^global::/, "");
    return normalized === "object" || normalized === "System.Object";
  }
  return false;
};

const isObjectRootType = (type: IrType, context: EmitterContext): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "referenceType" && resolved.name === "object";
};

const isDictionaryLikeSpreadType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "dictionaryType" || isObjectRootType(resolved, context)
  );
};

const createStringLiteralExpression = (value: string): CSharpExpressionAst =>
  stringLiteral(value);

const createDictionaryElementAccess = (
  targetIdentifier: string,
  key: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "elementAccessExpression",
  expression: identifierExpression(targetIdentifier),
  arguments: [key],
});

/**
 * Escape a string for use in a C# string literal.
 */
/**
 * Emit an array literal as CSharpExpressionAst
 */
export const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const effectiveExpectedType = resolveArrayLiteralContextType(
    expectedType,
    context
  );
  // Resolve type alias to check for tuple types
  const resolvedExpectedType = effectiveExpectedType
    ? resolveTypeAlias(effectiveExpectedType, context)
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
  if (effectiveExpectedType) {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(effectiveExpectedType),
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
    } else if (
      resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "ReadonlyArray" &&
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

  const hasSpread = expr.elements.some(
    (element) => element !== undefined && element.kind === "spread"
  );

  if (hasSpread) {
    const segments: CSharpExpressionAst[] = [];
    let inlineElements: CSharpExpressionAst[] = [];

    const flushInlineElements = (): void => {
      if (inlineElements.length === 0) return;
      segments.push({
        kind: "arrayCreationExpression",
        elementType: elementTypeAst,
        initializer: inlineElements,
      });
      inlineElements = [];
    };

    for (const element of expr.elements) {
      if (element === undefined) {
        inlineElements.push({ kind: "defaultExpression" });
        continue;
      }

      if (element.kind === "spread") {
        flushInlineElements();
        const [spreadAst, newContext] = emitExpressionAst(
          element.expression,
          currentContext
        );
        segments.push(spreadAst);
        currentContext = newContext;
        continue;
      }

      const [elemAst, newContext] = emitExpressionAst(
        element,
        currentContext,
        expectedElementType
      );
      inlineElements.push(elemAst);
      currentContext = newContext;
    }

    flushInlineElements();

    if (segments.length === 0) {
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression("global::System.Array.Empty"),
          typeArguments: [elementTypeAst],
          arguments: [],
        },
        currentContext,
      ];
    }

    const firstSegment = segments[0];
    if (!firstSegment) {
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression("global::System.Array.Empty"),
          typeArguments: [elementTypeAst],
          arguments: [],
        },
        currentContext,
      ];
    }

    let concatAst = firstSegment;
    for (let index = 1; index < segments.length; index++) {
      const segment = segments[index];
      if (!segment) continue;
      concatAst = {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.Concat"
        ),
        arguments: [concatAst, segment],
      };
    }

    return [
      {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.ToArray"
        ),
        arguments: [concatAst],
      },
      currentContext,
    ];
  }

  // Regular array without spreads
  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole
      elementAsts.push({ kind: "defaultExpression" });
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
        expression: identifierExpression("global::System.Array.Empty"),
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
  const behavioralType = resolveBehavioralObjectLiteralType(
    expr,
    currentContext
  );

  const effectiveType: IrType | undefined = (() => {
    if (!expectedType) {
      return behavioralType ?? expr.inferredType ?? expr.contextualType;
    }

    const strippedExpected = stripNullish(expectedType);
    if (
      strippedExpected.kind === "unknownType" ||
      strippedExpected.kind === "anyType" ||
      (strippedExpected.kind === "referenceType" &&
        strippedExpected.name === "object")
    ) {
      return (
        behavioralType ??
        expr.inferredType ??
        expr.contextualType ??
        expectedType
      );
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

  if (isObjectRootTypeAst(safeTypeAst)) {
    const dictionaryType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "unknownType" },
    } as const;

    if (expr.hasSpreads) {
      return emitDictionaryLiteralWithSpreads(
        expr,
        currentContext,
        dictionaryType
      );
    }

    return emitDictionaryLiteral(expr, currentContext, dictionaryType);
  }

  // Check if object has spreads - use IIFE pattern
  const needsTempObject =
    expr.hasSpreads ||
    expr.properties.some(
      (prop) =>
        prop.kind === "property" &&
        prop.value.kind === "functionExpression" &&
        prop.value.capturesObjectLiteralThis
    );

  if (needsTempObject) {
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
      const keyName = getDeterministicObjectKeyName(prop.key);
      if (!keyName) {
        throw new Error(
          "ICE: Unsupported computed property key reached nominal object emission"
        );
      }
      const key = emitObjectMemberName(
        instantiationType,
        keyName,
        currentContext
      );
      const propertyExpectedType = getPropertyType(
        instantiationType ?? effectiveType,
        keyName,
        currentContext
      );
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
  const bodyStatements: CSharpStatementAst[] = [];
  const objectThisContext: EmitterContext = {
    ...currentContext,
    objectLiteralThisIdentifier: "__tmp",
  };

  // var __tmp = new TypeName()
  const initStatement: CSharpStatementAst = {
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [
      {
        name: "__tmp",
        initializer: {
          kind: "objectCreationExpression",
          type: typeAst,
          arguments: [],
        },
      },
    ],
  };
  bodyStatements.push(initStatement);

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      const [spreadStatements, newContext] = emitSpreadPropertyCopyStatements(
        targetType,
        prop.expression,
        currentContext
      );
      bodyStatements.push(...spreadStatements);
      currentContext = newContext;
    } else {
      const keyName = getDeterministicObjectKeyName(prop.key);
      if (!keyName) {
        throw new Error(
          "ICE: Unsupported computed property key reached spread object emission"
        );
      }
      const key = emitObjectMemberName(targetType, keyName, currentContext);
      const propertyExpectedType = getPropertyType(
        targetType ?? effectiveType,
        keyName,
        currentContext
      );
      const [valueAst, newContext] = emitExpressionAst(
        prop.value,
        objectThisContext,
        propertyExpectedType
      );
      bodyStatements.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "memberAccessExpression",
            expression: { kind: "identifierExpression", identifier: "__tmp" },
            memberName: key,
          },
          right: valueAst,
        },
      });
      currentContext = {
        ...newContext,
        objectLiteralThisIdentifier: currentContext.objectLiteralThisIdentifier,
      };
    }
  }

  // return __tmp
  bodyStatements.push({
    kind: "returnStatement",
    expression: { kind: "identifierExpression", identifier: "__tmp" },
  });

  // IIFE: ((System.Func<T>)(() => { body }))()
  const funcTypeAst: CSharpTypeAst = identifierType("global::System.Func", [
    typeAst,
  ]);
  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: { kind: "blockStatement", statements: bodyStatements },
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
 * Emit property copy assignments from a spread source as AST statements.
 */
const emitSpreadPropertyCopyStatements = (
  targetType: IrType | undefined,
  spreadExpr: IrExpression,
  context: EmitterContext
): [CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  const spreadType = spreadExpr.inferredType;

  if (!spreadType) {
    const [exprAst] = emitExpressionAst(spreadExpr, currentContext);
    const exprText = extractCalleeNameFromAst(exprAst);
    throw new Error(
      `ICE: Object spread source '${exprText}' reached emitter without inferredType. ` +
        "Validation/type conversion should preserve spread source shape before emission."
    );
  }

  const [sourceAst, sourceContext] = emitExpressionAst(
    spreadExpr,
    currentContext
  );
  currentContext = sourceContext;

  const sourceTemp = allocateLocalName("__spread", currentContext);
  currentContext = sourceTemp.context;
  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [
      {
        name: sourceTemp.emittedName,
        initializer: sourceAst,
      },
    ],
  });

  const sourceRef: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: sourceTemp.emittedName,
  };

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
    statements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "memberAccessExpression",
          expression: { kind: "identifierExpression", identifier: "__tmp" },
          memberName: targetMember,
        },
        right: {
          kind: "memberAccessExpression",
          expression: sourceRef,
          memberName: sourceMember,
        },
      },
    });
  }

  return [statements, currentContext];
};

const emitDictionarySpreadCopyStatements = (
  targetIdentifier: string,
  spreadExpr: IrExpression,
  context: EmitterContext
): [CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];
  const spreadType = spreadExpr.inferredType;

  if (!spreadType) {
    throw new Error(
      "ICE: Spread in dictionary literal reached emitter without inferred type"
    );
  }

  const [sourceAst, sourceContext] = emitExpressionAst(
    spreadExpr,
    currentContext
  );
  currentContext = sourceContext;

  const sourceTemp = allocateLocalName("__spread", currentContext);
  currentContext = sourceTemp.context;
  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [
      {
        name: sourceTemp.emittedName,
        initializer: sourceAst,
      },
    ],
  });

  const sourceRef: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: sourceTemp.emittedName,
  };

  if (isDictionaryLikeSpreadType(spreadType, currentContext)) {
    const entryTemp = allocateLocalName("__entry", currentContext);
    currentContext = entryTemp.context;
    statements.push({
      kind: "foreachStatement",
      isAwait: false,
      type: { kind: "varType" },
      identifier: entryTemp.emittedName,
      expression: sourceRef,
      body: {
        kind: "blockStatement",
        statements: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "assignmentExpression",
              operatorToken: "=",
              left: createDictionaryElementAccess(targetIdentifier, {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: entryTemp.emittedName,
                },
                memberName: "Key",
              }),
              right: {
                kind: "memberAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: entryTemp.emittedName,
                },
                memberName: "Value",
              },
            },
          },
        ],
      },
    });

    return [statements, currentContext];
  }

  const propertyNames = getObjectTypePropertyNames(spreadType, currentContext);
  for (const propName of propertyNames) {
    const sourceMember = emitObjectMemberName(
      spreadType,
      propName,
      currentContext
    );
    statements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: createDictionaryElementAccess(
          targetIdentifier,
          createStringLiteralExpression(propName)
        ),
        right: {
          kind: "memberAccessExpression",
          expression: sourceRef,
          memberName: sourceMember,
        },
      },
    });
  }

  return [statements, currentContext];
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

const hasMatchingBehaviorMember = (
  candidate: Extract<LocalTypeInfo, { kind: "class" }>,
  member: IrClassMember
): boolean => {
  if (member.kind === "propertyDeclaration") {
    return candidate.members.some(
      (candidateMember) =>
        candidateMember.kind === "propertyDeclaration" &&
        candidateMember.name === member.name &&
        !!candidateMember.getterBody === !!member.getterBody &&
        !!candidateMember.setterBody === !!member.setterBody
    );
  }

  if (member.kind === "methodDeclaration") {
    return candidate.members.some(
      (candidateMember) =>
        candidateMember.kind === "methodDeclaration" &&
        candidateMember.name === member.name
    );
  }

  return false;
};

export const resolveBehavioralObjectLiteralType = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext
): IrType | undefined => {
  if (!expr.behaviorMembers?.length) return undefined;

  const propertyNames = expr.properties
    .filter(
      (prop): prop is Extract<typeof prop, { kind: "property" }> =>
        prop.kind === "property"
    )
    .map((prop) => getDeterministicObjectKeyName(prop.key))
    .filter((name): name is string => !!name);

  const candidateMaps: ReadonlyMap<string, LocalTypeInfo>[] = [];
  if (context.localTypes) {
    candidateMaps.push(context.localTypes);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (module.localTypes !== undefined) {
        candidateMaps.push(module.localTypes);
      }
    }
  }

  const matches: string[] = [];

  for (const localTypes of candidateMaps) {
    for (const [typeName, info] of localTypes.entries()) {
      if (info.kind !== "class" || !typeName.startsWith("__Anon_")) continue;

      const candidateNames = new Set(
        info.members
          .filter(
            (member): member is Extract<IrClassMember, { name: string }> =>
              "name" in member && typeof member.name === "string"
          )
          .map((member) => member.name)
      );

      if (propertyNames.some((name) => !candidateNames.has(name))) {
        continue;
      }

      if (
        expr.behaviorMembers.some(
          (member) => !hasMatchingBehaviorMember(info, member)
        )
      ) {
        continue;
      }

      matches.push(typeName);
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const onlyMatch = uniqueMatches.length === 1 ? uniqueMatches[0] : undefined;
  return onlyMatch
    ? ({ kind: "referenceType", name: onlyMatch } satisfies IrType)
    : undefined;
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

  const dictTypeAst: CSharpTypeAst = identifierType(
    "global::System.Collections.Generic.Dictionary",
    [keyTypeAst, valueTypeAst]
  );

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
      initializerAsts.push({
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "implicitElementAccessExpression",
          arguments: [stringLiteral(prop.key)],
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

const emitDictionaryLiteralWithSpreads = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  dictType: Extract<IrType, { kind: "dictionaryType" }>
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const keyTypeAst = emitDictKeyTypeAst(dictType.keyType);
  const [valueTypeAst, ctx2] = emitTypeAst(dictType.valueType, currentContext);
  currentContext = ctx2;

  const dictTypeAst: CSharpTypeAst = identifierType(
    "global::System.Collections.Generic.Dictionary",
    [keyTypeAst, valueTypeAst]
  );

  const bodyStatements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: "__tmp",
          initializer: {
            kind: "objectCreationExpression",
            type: dictTypeAst,
            arguments: [],
          },
        },
      ],
    },
  ];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      const [spreadStatements, nextContext] =
        emitDictionarySpreadCopyStatements(
          "__tmp",
          prop.expression,
          currentContext
        );
      bodyStatements.push(...spreadStatements);
      currentContext = nextContext;
      continue;
    }

    if (typeof prop.key !== "string") {
      throw new Error(
        "ICE: Computed property key in dictionary literal - validation gap"
      );
    }

    const [valueAst, nextContext] = emitExpressionAst(
      prop.value,
      currentContext,
      dictType.valueType
    );
    currentContext = nextContext;
    bodyStatements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: createDictionaryElementAccess(
          "__tmp",
          createStringLiteralExpression(prop.key)
        ),
        right: valueAst,
      },
    });
  }

  bodyStatements.push({
    kind: "returnStatement",
    expression: { kind: "identifierExpression", identifier: "__tmp" },
  });

  const funcTypeAst: CSharpTypeAst = identifierType("global::System.Func", [
    dictTypeAst,
  ]);
  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: { kind: "blockStatement", statements: bodyStatements },
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

  if (keyType.kind === "referenceType" && keyType.name === "object") {
    return { kind: "predefinedType", keyword: "object" };
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
          withTypeArguments(importBinding.typeAst, typeArgAsts),
          currentContext,
        ];
      }
      return [importBinding.typeAst, context];
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

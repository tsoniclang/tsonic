/**
 * Object literal expression emitters.
 */

import { IrClassMember, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  getPropertyType,
  resolveStructuralReferenceType,
  stripNullish,
  resolveTypeAlias,
  selectObjectLiteralUnionMember,
} from "../core/semantic/type-resolution.js";
import { allocateLocalName } from "../core/format/local-names.js";
import {
  identifierType,
  withTypeArguments,
} from "../core/format/backend-ast/builders.js";
import { extractCalleeNameFromAst } from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import {
  emitObjectMemberName,
  getDeterministicObjectKeyName,
  isObjectRootTypeAst,
  getObjectTypePropertyNames,
  hasMatchingBehaviorMember,
} from "./object-helpers.js";
import {
  emitDictionaryLiteral,
  emitDictionaryLiteralWithSpreads,
} from "./dictionary-literal.js";

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

    const selected = selectObjectLiteralUnionMember(
      resolved,
      literalKeys,
      currentContext
    );
    return selected ?? strippedType;
  })();

  const resolvedInstantiationType = instantiationType
    ? resolveTypeAlias(stripNullish(instantiationType), currentContext)
    : undefined;
  if (resolvedInstantiationType?.kind === "dictionaryType") {
    if (expr.hasSpreads) {
      return emitDictionaryLiteralWithSpreads(
        expr,
        currentContext,
        resolvedInstantiationType
      );
    }
    return emitDictionaryLiteral(
      expr,
      currentContext,
      resolvedInstantiationType
    );
  }

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
 * Resolve contextual type to C# type AST.
 */
const resolveContextualTypeAst = (
  contextualType: IrType | undefined,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!contextualType) {
    return [undefined, context];
  }

  const emissionType =
    resolveStructuralReferenceType(contextualType, context) ?? contextualType;

  if (emissionType.kind === "referenceType") {
    const typeName = emissionType.name;
    const importBinding = context.importBindings?.get(typeName);

    if (importBinding && importBinding.kind === "type") {
      if (emissionType.typeArguments && emissionType.typeArguments.length > 0) {
        let currentContext = context;
        const typeArgAsts: CSharpTypeAst[] = [];
        for (const typeArg of emissionType.typeArguments) {
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

  return emitTypeAst(emissionType, context);
};

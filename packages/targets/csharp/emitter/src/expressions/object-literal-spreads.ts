/**
 * Object literal spread/IIFE emission and behavioral type resolution.
 *
 * Handles object literals with spread properties (using IIFE pattern)
 * and resolves behavioral object literal types by matching against
 * synthesized anonymous classes.
 */

import { IrClassMember, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { getPropertyType } from "../core/semantic/type-resolution.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { extractCalleeNameFromAst } from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { buildInvokedLambdaExpressionAst } from "./invoked-lambda.js";
import {
  emitObjectMemberName,
  getDeterministicObjectKeyName,
  getObjectTypePropertyNames,
  hasMatchingBehaviorMember,
} from "./object-helpers.js";

/**
 * Emit an object literal with spreads using IIFE pattern.
 */
export const emitObjectWithSpreads = (
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

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      body: { kind: "blockStatement", statements: bodyStatements },
      arguments: [],
      returnType: typeAst,
      context: currentContext,
    }),
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

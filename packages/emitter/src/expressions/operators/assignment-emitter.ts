/**
 * Assignment operator expression emitter
 */

import { IrExpression, IrType, IrPattern } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitRemappedLocalName } from "../../core/format/local-names.js";
import { lowerAssignmentPatternAst } from "../../patterns.js";
import { hasInt32Proof } from "./helpers.js";
import { emitWritableTargetAst } from "./write-targets.js";
import { getTypedArrayStorageElementType } from "../calls/new-emitter-collections.js";
import { maybeCastNumericToExpectedIntegralAst } from "../post-emission-adaptation.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";

/**
 * Emit an assignment expression as CSharpExpressionAst
 *
 * Passes the LHS type as expected type to RHS, enabling proper integer
 * literal emission for cases like `this.value = this.value + 1`.
 */
export const emitAssignment = (
  expr: Extract<IrExpression, { kind: "assignment" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Array element assignment uses native CLR indexer.
  // Protocol-backed source indexers route through explicit member calls.

  if (
    expr.operator === "=" &&
    "kind" in expr.left &&
    expr.left.kind === "memberAccess" &&
    expr.left.isComputed &&
    (expr.left.object.inferredType?.kind === "arrayType" ||
      !!getTypedArrayStorageElementType(expr.left.object.inferredType) ||
      !!expr.left.accessProtocol?.setterMember)
  ) {
    const leftExpr = expr.left as Extract<
      IrExpression,
      { kind: "memberAccess" }
    >;
    const indexExpr = leftExpr.property as IrExpression;

    if (!hasInt32Proof(indexExpr)) {
      // ICE: Unproven index should have been caught by proof pass (TSN5107)
      throw new Error(
        `Internal Compiler Error: Array index must be proven Int32. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    const [objectAst, objectContext] = emitExpressionAst(
      leftExpr.object,
      context
    );
    const [indexAst, indexContext] = emitExpressionAst(
      indexExpr,
      objectContext
    );
    const typedArrayStorageElementType = getTypedArrayStorageElementType(
      leftExpr.object.inferredType
    );
    const expectedElementType =
      leftExpr.object.inferredType?.kind === "arrayType"
        ? leftExpr.object.inferredType.elementType
        : (typedArrayStorageElementType ?? leftExpr.inferredType);
    if (!expectedElementType) {
      throw new Error(
        "Internal Compiler Error: Writable computed access reached emitter without an element type."
      );
    }
    const [rightAst, rightContext] = emitExpressionAst(
      expr.right,
      indexContext,
      expectedElementType
    );
    const numericAssignmentActualType =
      ((expr.right.inferredType?.kind === "literalType" &&
        typeof expr.right.inferredType.value === "number") ||
        (expr.right.kind === "literal" && typeof expr.right.value === "number"))
        ? ({ kind: "primitiveType", name: "number" } as const)
        : expr.right.inferredType;
    const [adaptedRightAst, adaptedRightContext] =
      numericAssignmentActualType &&
      expectedElementType.kind !== "arrayType"
        ? maybeCastNumericToExpectedIntegralAst(
            rightAst,
            numericAssignmentActualType,
            rightContext,
            expectedElementType
          )
        : [rightAst, rightContext];

    if (leftExpr.accessProtocol?.setterMember) {
      const [returnTypeAst] = emitTypeAst(
        expectedElementType,
        adaptedRightContext
      );
      const setterCall: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: leftExpr.accessProtocol.setterMember,
        },
        arguments: [indexAst, adaptedRightAst],
      };

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "castExpression",
              type: identifierType("global::System.Func", [returnTypeAst]),
              expression: {
                kind: "parenthesizedExpression",
                expression: {
                  kind: "lambdaExpression",
                  isAsync: false,
                  parameters: [],
                  body: {
                    kind: "blockStatement",
                    statements: [
                      {
                        kind: "expressionStatement",
                        expression: setterCall,
                      },
                      {
                        kind: "returnStatement",
                        expression: adaptedRightAst,
                      },
                    ],
                  },
                },
              },
            },
          },
          arguments: [],
        },
        adaptedRightContext,
      ];
    }

    // Use native CLR indexer: arr[idx] = value
    return [
      {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "elementAccessExpression",
          expression: objectAst,
          arguments: [indexAst],
        },
        right: adaptedRightAst,
      },
      adaptedRightContext,
    ];
  }

  // Left side can be an expression or a pattern (for destructuring)
  const isPattern =
    "kind" in expr.left &&
    (expr.left.kind === "identifierPattern" ||
      expr.left.kind === "arrayPattern" ||
      expr.left.kind === "objectPattern");

  // Handle destructuring assignment patterns with AST lowering.
  if (isPattern && expr.operator === "=") {
    const pattern = expr.left as IrPattern;

    // Emit the RHS first
    const [rightAst, rightContext] = emitExpressionAst(expr.right, context);
    const result = lowerAssignmentPatternAst(
      pattern,
      rightAst,
      expr.right.inferredType,
      rightContext
    );

    return [result.expression, result.context];
  }

  // Standard assignment (expression on left side)
  let leftAst: CSharpExpressionAst;
  let leftContext: EmitterContext;
  let leftType: IrType | undefined;

  if (isPattern) {
    // Identifier pattern with compound assignment (+=, etc.)
    const pattern = expr.left as IrPattern;
    if (pattern.kind === "identifierPattern") {
      leftAst = {
        kind: "identifierExpression",
        identifier: emitRemappedLocalName(pattern.name, context),
      };
      leftContext = context;
      leftType = pattern.type;
    } else {
      throw new Error(
        "ICE: Compound assignment to array/object destructuring pattern reached emitter. " +
          "Validation should have rejected this invalid JavaScript shape."
      );
    }
  } else {
    const leftExpr = expr.left as IrExpression;
    const [emittedLeftAst, ctx] = emitWritableTargetAst(leftExpr, context);
    leftAst = emittedLeftAst;
    leftContext = ctx;
    leftType = leftExpr.inferredType;
  }

  // Pass LHS type as expected type to RHS for proper integer handling
  const [rightAst, rightContext] = emitExpressionAst(
    expr.right,
    leftContext,
    leftType
  );

  return [
    {
      kind: "assignmentExpression",
      operatorToken: expr.operator,
      left: leftAst,
      right: rightAst,
    },
    rightContext,
  ];
};

/**
 * Array and tuple literal expression emitters.
 */

import { IrExpression, IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  stripNullish,
  resolveTypeAlias,
} from "../core/semantic/type-resolution.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import { resolveArrayLiteralContextType } from "../core/semantic/array-expected-types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { adaptValueToExpectedTypeAst } from "./expected-type-adaptation.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { maybeCastNumericToExpectedIntegralAst } from "./post-emission-adaptation.js";

const preserveScopedExpressionFlowContext = (
  baseContext: EmitterContext,
  nextContext: EmitterContext
): EmitterContext => ({
  ...nextContext,
  typeParameters: baseContext.typeParameters,
  typeParamConstraints: baseContext.typeParamConstraints,
  typeParameterNameMap: baseContext.typeParameterNameMap,
  returnType: baseContext.returnType,
  localNameMap: baseContext.localNameMap,
  conditionAliases: baseContext.conditionAliases,
  localSemanticTypes: baseContext.localSemanticTypes,
  localValueTypes: baseContext.localValueTypes,
  narrowedBindings: baseContext.narrowedBindings,
});

const shouldCoerceArrayLiteralElementToExpectedType = (
  element: IrExpression,
  expectedElementType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!expectedElementType) {
    return false;
  }

  if (element.kind === "literal") {
    return false;
  }

  if (element.kind === "identifier" || element.kind === "memberAccess") {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(expectedElementType),
      context
    );
    const isBroadObjectTarget =
      resolvedExpected.kind === "objectType" ||
      (resolvedExpected.kind === "referenceType" &&
        resolvedExpected.name === "object");
    if (!isBroadObjectTarget) {
      return false;
    }
  }

  const effectiveElementType =
    resolveEffectiveExpressionType(element, context) ?? element.inferredType;
  if (!effectiveElementType) {
    return false;
  }

  if (
    matchesExpectedEmissionType(
      effectiveElementType,
      expectedElementType,
      context
    )
  ) {
    return false;
  }

  if (
    willCarryAsRuntimeUnion(expectedElementType, context) &&
    !willCarryAsRuntimeUnion(effectiveElementType, context)
  ) {
    const [expectedLayout] = buildRuntimeUnionLayout(
      expectedElementType,
      context,
      emitTypeAst
    );
    if (
      expectedLayout?.members.some((member) =>
        matchesExpectedEmissionType(effectiveElementType, member, context)
      )
    ) {
      return false;
    }
  }

  const actual = stableIrTypeKey(
    resolveTypeAlias(stripNullish(effectiveElementType), context)
  );
  const expected = stableIrTypeKey(
    resolveTypeAlias(stripNullish(expectedElementType), context)
  );
  return actual !== expected;
};

const emitArrayElementAst = (
  element: IrExpression,
  expectedElementType: IrType | undefined,
  semanticElementType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const adaptationExpectedElementType =
    semanticElementType ?? expectedElementType;
  const transparentElement = unwrapTransparentExpression(element);
  const coercedExpectedElementType =
    adaptationExpectedElementType !== undefined &&
    shouldCoerceArrayLiteralElementToExpectedType(
      transparentElement,
      adaptationExpectedElementType,
      context
    )
      ? adaptationExpectedElementType
      : undefined;
  const elementExpr = coercedExpectedElementType
    ? ({
        kind: "typeAssertion",
        expression: element,
        targetType: coercedExpectedElementType,
        inferredType: coercedExpectedElementType,
      } satisfies IrExpression)
    : element;

  if (
    adaptationExpectedElementType &&
    (transparentElement.kind === "identifier" ||
      transparentElement.kind === "memberAccess")
  ) {
    const [rawElemAst, rawContext] = emitExpressionAst(
      transparentElement,
      context
    );
    const effectiveElementType =
      resolveEffectiveExpressionType(transparentElement, context) ??
      transparentElement.inferredType;
    const actualElementType =
      effectiveElementType ?? transparentElement.inferredType;

    const [adaptedElementAst, adaptedElementContext] =
      adaptValueToExpectedTypeAst({
        valueAst: rawElemAst,
        actualType: actualElementType,
        context: rawContext,
        expectedType: adaptationExpectedElementType,
      }) ?? [rawElemAst, rawContext];

    return maybeCastNumericToExpectedIntegralAst(
      adaptedElementAst,
      actualElementType,
      adaptedElementContext,
      adaptationExpectedElementType
    );
  }

  return emitExpressionAst(elementExpr, context, adaptationExpectedElementType);
};

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
  let semanticElementType: IrType | undefined = undefined;

  // Priority 1: Use explicit type annotation
  if (effectiveExpectedType) {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(effectiveExpectedType),
      context
    );

    const resolveExpectedArrayElementTypeAst = (): [
      CSharpTypeAst,
      EmitterContext,
    ] => {
      const [expectedTypeAst, nextContext] = emitTypeAst(
        effectiveExpectedType,
        currentContext
      );
      const concreteExpectedTypeAst = stripNullableTypeAst(expectedTypeAst);
      if (concreteExpectedTypeAst.kind === "arrayType") {
        return [concreteExpectedTypeAst.elementType, nextContext];
      }
      return [identifierType("object"), nextContext];
    };

    if (resolvedExpected.kind === "arrayType") {
      expectedElementType = resolvedExpected.elementType;
      semanticElementType = resolvedExpected.storageErasedElementType;
      const [typeAst, newContext] = resolveExpectedArrayElementTypeAst();
      elementTypeAst = typeAst;
      elementTypeResolved = true;
      currentContext = preserveScopedExpressionFlowContext(
        currentContext,
        newContext
      );
    } else if (
      resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "Array" &&
      resolvedExpected.typeArguments &&
      resolvedExpected.typeArguments.length > 0
    ) {
      const firstArg = resolvedExpected.typeArguments[0];
      if (firstArg) {
        expectedElementType = firstArg;
        semanticElementType = undefined;
        const [typeAst, newContext] = resolveExpectedArrayElementTypeAst();
        elementTypeAst = typeAst;
        elementTypeResolved = true;
        currentContext = preserveScopedExpressionFlowContext(
          currentContext,
          newContext
        );
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
        semanticElementType = undefined;
        const [typeAst, newContext] = resolveExpectedArrayElementTypeAst();
        elementTypeAst = typeAst;
        elementTypeResolved = true;
        currentContext = preserveScopedExpressionFlowContext(
          currentContext,
          newContext
        );
      }
    } else if (
      resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "ArrayLike" &&
      resolvedExpected.typeArguments &&
      resolvedExpected.typeArguments.length > 0
    ) {
      const firstArg = resolvedExpected.typeArguments[0];
      if (firstArg) {
        expectedElementType = firstArg;
        semanticElementType = undefined;
        const [typeAst, newContext] = resolveExpectedArrayElementTypeAst();
        elementTypeAst = typeAst;
        elementTypeResolved = true;
        currentContext = preserveScopedExpressionFlowContext(
          currentContext,
          newContext
        );
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
      currentContext = preserveScopedExpressionFlowContext(
        currentContext,
        newContext
      );
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

      const [elemAst, newContext] = emitArrayElementAst(
        element,
        expectedElementType,
        semanticElementType,
        currentContext
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
      const [elemAst, newContext] = emitArrayElementAst(
        element,
        expectedElementType,
        semanticElementType,
        currentContext
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

/**
 * Object literal expression emitters — orchestrator facade.
 *
 * Heavy-lifting helpers live in:
 *   - ./object-literal-spreads.ts (spread emission and behavioral type resolution)
 *   - ./object-helpers.ts         (member name resolution and type helpers)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
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
import { withTypeArguments } from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  emitObjectMemberName,
  getDeterministicObjectKeyName,
  isObjectRootTypeAst,
} from "./object-helpers.js";
import {
  emitDictionaryLiteral,
  emitDictionaryLiteralWithSpreads,
} from "./dictionary-literal.js";
import { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
import { canPreferAnonymousStructuralTarget } from "./structural-type-shapes.js";
import {
  emitObjectWithSpreads,
  resolveBehavioralObjectLiteralType,
} from "./object-literal-spreads.js";

// Re-export from sub-module
export { resolveBehavioralObjectLiteralType } from "./object-literal-spreads.js";

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
 * Resolve contextual type to C# type AST.
 */
const resolveContextualTypeAst = (
  contextualType: IrType | undefined,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!contextualType) {
    return [undefined, context];
  }

  const anonymousEmissionType =
    canPreferAnonymousStructuralTarget(contextualType)
      ? resolveAnonymousStructuralReferenceType(contextualType, context)
      : undefined;
  const emissionType =
    anonymousEmissionType ??
    resolveStructuralReferenceType(contextualType, context) ??
    contextualType;

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

/**
 * Pattern lowering for local declarations (AST-only).
 *
 * Handles destructuring for local variable declarations:
 * - identifier patterns
 * - array patterns (including tuple lowering)
 * - object patterns
 *
 * Also exports shared helpers used by static and assignment lowering.
 */

import {
  IrArrayPattern,
  IrExpression,
  IrObjectPattern,
  IrPattern,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../emitter-types/index.js";
import { emitTypeAst } from "../types/emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  allocateLocalName,
  emitRemappedLocalName,
  registerLocalName,
} from "../core/format/local-names.js";
import { registerParameterTypes } from "../core/semantic/symbol-types.js";
import { getPropertyType } from "../core/semantic/type-resolution.js";
import {
  getTupleElementType,
  getTupleRestArrayType,
  resolveArrayPatternType,
} from "../core/semantic/pattern-types.js";
import {
  booleanLiteral,
  decimalIntegerLiteral,
  identifierExpression,
  identifierType,
  nullLiteral,
  parseNumericLiteral,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

export const objectTypeAst: CSharpTypeAst = identifierType("object");

export const tupleElementMemberName = (index: number): string =>
  index < 7 ? `Item${index + 1}` : "Rest";

export const emitTupleElementAccessAst = (
  inputExpr: CSharpExpressionAst,
  index: number
): CSharpExpressionAst => {
  if (index < 7) {
    return {
      kind: "memberAccessExpression",
      expression: inputExpr,
      memberName: tupleElementMemberName(index),
    };
  }

  return emitTupleElementAccessAst(
    {
      kind: "memberAccessExpression",
      expression: inputExpr,
      memberName: "Rest",
    },
    index - 7
  );
};

export const emitTupleRestArrayAst = (
  inputExpr: CSharpExpressionAst,
  tupleType: Extract<IrType, { kind: "tupleType" }>,
  startIndex: number
): CSharpExpressionAst => ({
  kind: "arrayCreationExpression",
  elementType: { kind: "varType" },
  initializer: tupleType.elementTypes
    .slice(startIndex)
    .map((_, offset) =>
      emitTupleElementAccessAst(inputExpr, startIndex + offset)
    ),
});

export const generateTemp = (
  prefix: string,
  ctx: EmitterContext
): [string, EmitterContext] => {
  const tempId = ctx.tempVarId ?? 0;
  const name = `__${prefix}${tempId}`;
  return [name, { ...ctx, tempVarId: tempId + 1 }];
};

export const emitDefaultExprAst = (
  expr: IrExpression,
  ctx: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return [stringLiteral(expr.value), ctx];
    }
    if (typeof expr.value === "number") {
      return [parseNumericLiteral(String(expr.value)), ctx];
    }
    if (typeof expr.value === "boolean") {
      return [booleanLiteral(expr.value), ctx];
    }
    if (expr.value === null) {
      return [nullLiteral(), ctx];
    }
  }
  if (expr.kind === "identifier") {
    return [
      {
        kind: "identifierExpression",
        identifier: emitRemappedLocalName(expr.name, ctx),
      },
      ctx,
    ];
  }
  return emitExpressionAst(expr, ctx);
};

export type LoweringResultAst = {
  readonly statements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
};

const lowerIdentifierAst = (
  name: string,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const alloc = allocateLocalName(name, ctx);
  const localName = alloc.emittedName;
  let currentCtx = alloc.context;

  let typeAst: CSharpTypeAst = { kind: "varType" };
  if (type) {
    const [emittedType, next] = emitTypeAst(type, currentCtx);
    typeAst = emittedType;
    currentCtx = next;
  }

  const stmt: CSharpStatementAst = {
    kind: "localDeclarationStatement",
    modifiers: [],
    type: typeAst,
    declarators: [{ name: localName, initializer: inputExpr }],
  };

  currentCtx = registerLocalName(name, localName, currentCtx);
  currentCtx = registerParameterTypes(name, type, currentCtx);
  return { statements: [stmt], context: currentCtx };
};

const lowerArrayPatternAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  elementType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("arr", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      index++;
      continue;
    }

    if (elem.isRest) {
      const sliceExpr: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression("Tsonic.Runtime.ArrayHelpers"),
          memberName: "Slice",
        },
        arguments: [tempId, decimalIntegerLiteral(index)],
      };
      const rest = lowerPatternAst(
        elem.pattern,
        sliceExpr,
        elementType ? { kind: "arrayType", elementType } : undefined,
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      break;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: tempId,
      arguments: [decimalIntegerLiteral(index)],
    };

    let valueExpr: CSharpExpressionAst = accessExpr;
    if (elem.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        elem.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const nested = lowerPatternAst(
      elem.pattern,
      valueExpr,
      elementType,
      currentCtx
    );
    statements.push(...nested.statements);
    currentCtx = nested.context;
    index++;
  }

  return { statements, context: currentCtx };
};

const lowerTuplePatternAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  tupleType: Extract<IrType, { kind: "tupleType" }>,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("tuple", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempExpr: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      index++;
      continue;
    }

    if (elem.isRest) {
      const restExpr = emitTupleRestArrayAst(tempExpr, tupleType, index);
      const rest = lowerPatternAst(
        elem.pattern,
        restExpr,
        getTupleRestArrayType(tupleType, index),
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      break;
    }

    const accessExpr = emitTupleElementAccessAst(tempExpr, index);
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (elem.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        elem.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const nested = lowerPatternAst(
      elem.pattern,
      valueExpr,
      getTupleElementType(tupleType, index),
      currentCtx
    );
    statements.push(...nested.statements);
    currentCtx = nested.context;
    index++;
  }

  return { statements, context: currentCtx };
};

const lowerObjectPatternAst = (
  pattern: IrObjectPattern,
  inputExpr: CSharpExpressionAst,
  inputType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("obj", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      if (!prop.restShapeMembers || !prop.restSynthTypeName) {
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
      }

      const initMembers = prop.restShapeMembers
        .filter((m) => m.kind === "propertySignature")
        .map((m) => ({
          kind: "assignmentExpression" as const,
          operatorToken: "=" as const,
          left: {
            kind: "identifierExpression" as const,
            identifier: m.name,
          },
          right: {
            kind: "memberAccessExpression" as const,
            expression: tempId,
            memberName: m.name,
          },
        }));

      const restExpr: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: identifierType(prop.restSynthTypeName),
        arguments: [],
        initializer: initMembers,
      };
      const restType: IrType = {
        kind: "referenceType",
        name: prop.restSynthTypeName,
        structuralMembers: prop.restShapeMembers,
      };
      const rest = lowerPatternAst(
        prop.pattern,
        restExpr,
        restType,
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      continue;
    }

    const propAccessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempId,
      memberName: prop.key,
    };

    let valueExpr: CSharpExpressionAst = propAccessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: propAccessExpr,
        right: defaultAst,
      };
    }

    const propType = getPropertyType(inputType, prop.key, currentCtx);
    const nested = lowerPatternAst(prop.value, valueExpr, propType, currentCtx);
    statements.push(...nested.statements);
    currentCtx = nested.context;
  }

  return { statements, context: currentCtx };
};

export const lowerPatternAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifierAst(pattern.name, inputExpr, type, ctx);
    case "arrayPattern": {
      const resolved = resolveArrayPatternType(type, ctx);
      if (resolved.kind === "tuple") {
        return lowerTuplePatternAst(
          pattern,
          inputExpr,
          resolved.tupleType,
          ctx
        );
      }
      return lowerArrayPatternAst(
        pattern,
        inputExpr,
        resolved.elementType,
        ctx
      );
    }
    case "objectPattern":
      return lowerObjectPatternAst(pattern, inputExpr, type, ctx);
  }
};

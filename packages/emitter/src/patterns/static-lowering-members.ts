/**
 * Static/module-level field pattern lowering (AST-only).
 *
 * Handles destructuring for static/module-level field declarations,
 * producing CSharpMemberAst nodes for class-level fields.
 */

import {
  IrArrayPattern,
  IrObjectPattern,
  IrPattern,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../emitter-types/index.js";
import { emitTypeAst } from "../types/emitter.js";
import { emitCSharpName } from "../naming-policy.js";
import { getPropertyType } from "../core/semantic/type-resolution.js";
import {
  getTupleElementType,
  getTupleRestArrayType,
  resolveArrayPatternType,
} from "../core/semantic/pattern-types.js";
import {
  decimalIntegerLiteral,
  identifierExpression,
  identifierType,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  emitDefaultExprAst,
  emitTupleElementAccessAst,
  emitTupleRestArrayAst,
  generateTemp,
  objectTypeAst,
} from "./local-lowering.js";

export type StaticPatternLoweringResultAst = {
  readonly members: readonly CSharpMemberAst[];
  readonly context: EmitterContext;
};

const createStaticField = (
  name: string,
  type: CSharpTypeAst,
  initializer: CSharpExpressionAst
): CSharpMemberAst => ({
  kind: "fieldDeclaration",
  attributes: [],
  modifiers: ["private", "static", "readonly"],
  type,
  name,
  initializer,
});

const lowerIdentifierStaticAst = (
  name: string,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  let currentCtx = ctx;
  let typeAst: CSharpTypeAst = objectTypeAst;
  if (type) {
    const [emittedType, next] = emitTypeAst(type, currentCtx);
    typeAst = emittedType;
    currentCtx = next;
  }
  return {
    members: [
      createStaticField(
        emitCSharpName(name, "fields", ctx),
        typeAst,
        inputExpr
      ),
    ],
    context: currentCtx,
  };
};

const lowerArrayPatternStaticAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  elementType: IrType | undefined,
  arrayType: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  const members: CSharpMemberAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("arr", currentCtx);
  currentCtx = nextCtx;
  const tempName = emitCSharpName(rawTempName, "fields", currentCtx);

  let tempTypeAst: CSharpTypeAst = objectTypeAst;
  if (arrayType) {
    const [emittedType, typeCtx] = emitTypeAst(arrayType, currentCtx);
    tempTypeAst = emittedType;
    currentCtx = typeCtx;
  }
  members.push(createStaticField(tempName, tempTypeAst, inputExpr));

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
      const restExpr: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression("Tsonic.Runtime.ArrayHelpers"),
          memberName: "Slice",
        },
        arguments: [tempExpr, decimalIntegerLiteral(index)],
      };
      const rest = lowerPatternToStaticMembersAst(
        elem.pattern,
        restExpr,
        elementType ? { kind: "arrayType", elementType } : undefined,
        currentCtx
      );
      members.push(...rest.members);
      currentCtx = rest.context;
      break;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: tempExpr,
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

    const nested = lowerPatternToStaticMembersAst(
      elem.pattern,
      valueExpr,
      elementType,
      currentCtx
    );
    members.push(...nested.members);
    currentCtx = nested.context;
    index++;
  }

  return { members, context: currentCtx };
};

const lowerTuplePatternStaticAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  tupleType: Extract<IrType, { kind: "tupleType" }>,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  const members: CSharpMemberAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("tuple", currentCtx);
  currentCtx = nextCtx;
  const tempName = emitCSharpName(rawTempName, "fields", currentCtx);

  members.push(createStaticField(tempName, { kind: "varType" }, inputExpr));

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
      const rest = lowerPatternToStaticMembersAst(
        elem.pattern,
        restExpr,
        getTupleRestArrayType(tupleType, index),
        currentCtx
      );
      members.push(...rest.members);
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

    const nested = lowerPatternToStaticMembersAst(
      elem.pattern,
      valueExpr,
      getTupleElementType(tupleType, index),
      currentCtx
    );
    members.push(...nested.members);
    currentCtx = nested.context;
    index++;
  }

  return { members, context: currentCtx };
};

const lowerObjectPatternStaticAst = (
  pattern: IrObjectPattern,
  inputExpr: CSharpExpressionAst,
  inputType: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  const members: CSharpMemberAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("obj", currentCtx);
  currentCtx = nextCtx;
  const tempName = emitCSharpName(rawTempName, "fields", currentCtx);

  let tempTypeAst: CSharpTypeAst = objectTypeAst;
  if (inputType) {
    const [emittedType, typeCtx] = emitTypeAst(inputType, currentCtx);
    tempTypeAst = emittedType;
    currentCtx = typeCtx;
  }
  members.push(createStaticField(tempName, tempTypeAst, inputExpr));

  const tempExpr: CSharpExpressionAst = {
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
            expression: tempExpr,
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
      const rest = lowerPatternToStaticMembersAst(
        prop.pattern,
        restExpr,
        restType,
        currentCtx
      );
      members.push(...rest.members);
      currentCtx = rest.context;
      continue;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempExpr,
      memberName: prop.key,
    };
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
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

    const propType = getPropertyType(inputType, prop.key, currentCtx);
    const nested = lowerPatternToStaticMembersAst(
      prop.value,
      valueExpr,
      propType,
      currentCtx
    );
    members.push(...nested.members);
    currentCtx = nested.context;
  }

  return { members, context: currentCtx };
};

export const lowerPatternToStaticMembersAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifierStaticAst(pattern.name, inputExpr, type, ctx);
    case "arrayPattern": {
      const resolved = resolveArrayPatternType(type, ctx);
      if (resolved.kind === "tuple") {
        return lowerTuplePatternStaticAst(
          pattern,
          inputExpr,
          resolved.tupleType,
          ctx
        );
      }
      return lowerArrayPatternStaticAst(
        pattern,
        inputExpr,
        resolved.elementType,
        resolved.originalType,
        ctx
      );
    }
    case "objectPattern":
      return lowerObjectPatternStaticAst(pattern, inputExpr, type, ctx);
  }
};

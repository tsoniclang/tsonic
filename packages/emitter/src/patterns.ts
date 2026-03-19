/**
 * Pattern lowering (AST-only).
 *
 * Handles destructuring for:
 * - local declarations
 * - static/module-level field declarations
 * - assignment expressions
 */

import {
  IrArrayPattern,
  IrExpression,
  IrObjectPattern,
  IrPattern,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "./emitter-types/index.js";
import { emitTypeAst } from "./types/emitter.js";
import { emitExpressionAst } from "./expression-emitter.js";
import { emitCSharpName } from "./naming-policy.js";
import {
  allocateLocalName,
  emitRemappedLocalName,
  registerLocalName,
} from "./core/format/local-names.js";
import { registerParameterTypes } from "./core/semantic/symbol-types.js";
import { getPropertyType } from "./core/semantic/type-resolution.js";
import {
  getTupleElementType,
  getTupleRestArrayType,
  resolveArrayPatternType,
} from "./core/semantic/pattern-types.js";
import {
  booleanLiteral,
  decimalIntegerLiteral,
  identifierExpression,
  identifierType,
  nullLiteral,
  parseNumericLiteral,
  stringLiteral,
} from "./core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

const objectTypeAst: CSharpTypeAst = identifierType("object");

const tupleElementMemberName = (index: number): string =>
  index < 7 ? `Item${index + 1}` : "Rest";

const emitTupleElementAccessAst = (
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

const emitTupleRestArrayAst = (
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

const generateTemp = (
  prefix: string,
  ctx: EmitterContext
): [string, EmitterContext] => {
  const tempId = ctx.tempVarId ?? 0;
  const name = `__${prefix}${tempId}`;
  return [name, { ...ctx, tempVarId: tempId + 1 }];
};

const emitDefaultExprAst = (
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

type AssignmentPatternLoweringResultAst = {
  readonly expression: CSharpExpressionAst;
  readonly context: EmitterContext;
};

const isRuntimeRepresentableType = (type: IrType): boolean => {
  if (type.kind === "anyType" || type.kind === "unknownType") return false;
  if (type.kind === "objectType") return false;
  if (type.kind === "unionType") {
    return type.types.every(isRuntimeRepresentableType);
  }
  return true;
};

const resolveAssignmentResultTypeAst = (
  type: IrType | undefined,
  ctx: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  if (!type || !isRuntimeRepresentableType(type)) {
    return [objectTypeAst, ctx];
  }
  return emitTypeAst(type, ctx);
};

const lowerAssignmentPatternStatementsAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): {
  readonly statements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
} => {
  if (pattern.kind === "identifierPattern") {
    return {
      statements: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            operatorToken: "=",
            left: {
              kind: "identifierExpression",
              identifier: emitRemappedLocalName(pattern.name, ctx),
            },
            right: inputExpr,
          },
        },
      ],
      context: ctx,
    };
  }

  let currentCtx = ctx;
  const statements: CSharpStatementAst[] = [];

  const [rawTempName, nextCtx] = generateTemp("t", currentCtx);
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

  if (pattern.kind === "arrayPattern") {
    const resolvedArray = resolveArrayPatternType(type, currentCtx);
    if (resolvedArray.kind === "tuple") {
      const tupleType = resolvedArray.tupleType;
      let index = 0;
      for (const elem of pattern.elements) {
        if (!elem) {
          index++;
          continue;
        }
        if (elem.isRest) {
          const restExpr = emitTupleRestArrayAst(tempExpr, tupleType, index);
          const rest = lowerAssignmentPatternStatementsAst(
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

        const nested = lowerAssignmentPatternStatementsAst(
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
    }

    const elementType = resolvedArray.elementType;
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
        const rest = lowerAssignmentPatternStatementsAst(
          elem.pattern,
          restExpr,
          elementType ? { kind: "arrayType", elementType } : undefined,
          currentCtx
        );
        statements.push(...rest.statements);
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

      const nested = lowerAssignmentPatternStatementsAst(
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
  }

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
      const rest = lowerAssignmentPatternStatementsAst(
        prop.pattern,
        restExpr,
        restType,
        currentCtx
      );
      statements.push(...rest.statements);
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

    const propType = getPropertyType(type, prop.key, currentCtx);
    const nested = lowerAssignmentPatternStatementsAst(
      prop.value,
      valueExpr,
      propType,
      currentCtx
    );
    statements.push(...nested.statements);
    currentCtx = nested.context;
  }

  return { statements, context: currentCtx };
};

export const lowerAssignmentPatternAst = (
  pattern: IrPattern,
  rhsExpr: CSharpExpressionAst,
  rhsType: IrType | undefined,
  ctx: EmitterContext
): AssignmentPatternLoweringResultAst => {
  if (pattern.kind === "identifierPattern") {
    return {
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: emitRemappedLocalName(pattern.name, ctx),
        },
        right: rhsExpr,
      },
      context: ctx,
    };
  }

  let currentCtx = ctx;
  const [resultTypeAst, typeCtx] = resolveAssignmentResultTypeAst(
    rhsType,
    currentCtx
  );
  currentCtx = typeCtx;

  const [rawResultName, nextCtx] = generateTemp("assign", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawResultName, currentCtx);
  const resultName = alloc.emittedName;
  currentCtx = alloc.context;

  const nested = lowerAssignmentPatternStatementsAst(
    pattern,
    {
      kind: "identifierExpression",
      identifier: resultName,
    },
    rhsType,
    currentCtx
  );
  currentCtx = nested.context;

  const lambdaStatements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: resultTypeAst,
      declarators: [{ name: resultName, initializer: rhsExpr }],
    },
    ...nested.statements,
    {
      kind: "returnStatement",
      expression: { kind: "identifierExpression", identifier: resultName },
    },
  ];

  const iifeExpr: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: identifierType("global::System.Func", [resultTypeAst]),
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [],
            body: { kind: "blockStatement", statements: lambdaStatements },
          },
        },
      },
    },
    arguments: [],
  };

  return { expression: iifeExpr, context: currentCtx };
};

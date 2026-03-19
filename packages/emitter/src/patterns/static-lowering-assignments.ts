/**
 * Assignment expression pattern lowering (AST-only).
 *
 * Handles destructuring for assignment expressions (e.g. `[a, b] = expr`),
 * producing CSharpStatementAst and CSharpExpressionAst nodes.
 */

import { IrPattern, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../emitter-types/index.js";
import { emitTypeAst } from "../types/emitter.js";
import {
  allocateLocalName,
  emitRemappedLocalName,
} from "../core/format/local-names.js";
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
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  emitDefaultExprAst,
  emitTupleElementAccessAst,
  emitTupleRestArrayAst,
  generateTemp,
  objectTypeAst,
} from "./local-lowering.js";

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

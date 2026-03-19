/**
 * Overload specialization engine
 *
 * Rewrites IR trees by substituting known parameter types and evaluating
 * compile-time predicates (istype<T>, Array.isArray) to constant booleans,
 * then folding away dead branches.
 */

import {
  IrBlockStatement,
  IrExpression,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { normalizedUnionType } from "../../../../types/type-ops.js";

type IrPrimitiveName = Extract<IrType, { kind: "primitiveType" }>["name"];

const primitiveTypeToClrName = (name: IrPrimitiveName): string | undefined => {
  switch (name) {
    case "string":
      return "System.String";
    case "number":
      return "System.Double";
    case "boolean":
      return "System.Boolean";
    case "int":
      return "System.Int32";
    case "char":
      return "System.Char";
    default:
      return undefined;
  }
};

const getClrName = (type: IrType): string | undefined => {
  if (type.kind !== "referenceType") return undefined;
  return type.resolvedClrType ?? type.typeId?.clrName;
};

export const typesEqualForIsType = (
  a: IrType | undefined,
  b: IrType | undefined
): boolean => {
  if (!a || !b) return false;

  // Canonicalize primitive aliases to CLR names (System.String etc).
  if (a.kind === "primitiveType" && b.kind === "referenceType") {
    const clr = getClrName(b);
    const expected = primitiveTypeToClrName(a.name);
    return !!expected && clr === expected;
  }
  if (a.kind === "referenceType" && b.kind === "primitiveType") {
    const clr = getClrName(a);
    const expected = primitiveTypeToClrName(b.name);
    return !!expected && clr === expected;
  }

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return b.kind === "primitiveType" && a.name === b.name;
    case "typeParameterType":
      return b.kind === "typeParameterType" && a.name === b.name;
    case "arrayType":
      return (
        b.kind === "arrayType" &&
        typesEqualForIsType(a.elementType, b.elementType)
      );
    case "referenceType": {
      if (b.kind !== "referenceType") return false;
      const aStable = a.typeId?.stableId ?? a.resolvedClrType;
      const bStable = b.typeId?.stableId ?? b.resolvedClrType;
      if (aStable && bStable) return aStable === bStable;
      if (a.name !== b.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = b.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        if (!typesEqualForIsType(aArgs[i], bArgs[i])) return false;
      }
      return true;
    }
    default:
      // istype is only supported for primitive/array/nominal/type-param equality during overload specialization.
      return false;
  }
};

export const specializeExpression = (
  expr: IrExpression,
  paramTypesByDeclId: ReadonlyMap<number, IrType>
): IrExpression => {
  const tryResolveParamType = (
    expression: IrExpression
  ): IrType | undefined => {
    if (expression.kind !== "identifier" || !expression.declId) {
      return undefined;
    }
    return paramTypesByDeclId.get(expression.declId.id);
  };

  const evaluateArrayIsArrayPredicate = (
    candidate: IrType | undefined
  ): boolean | undefined => {
    if (!candidate) return undefined;

    switch (candidate.kind) {
      case "arrayType":
      case "tupleType":
        return true;

      case "unionType": {
        const memberResults = candidate.types.map((member) =>
          evaluateArrayIsArrayPredicate(member)
        );
        if (memberResults.every((value) => value === true)) return true;
        if (memberResults.every((value) => value === false)) return false;
        return undefined;
      }

      case "intersectionType": {
        const memberResults = candidate.types.map((member) =>
          evaluateArrayIsArrayPredicate(member)
        );
        if (memberResults.some((value) => value === true)) return true;
        if (memberResults.every((value) => value === false)) return false;
        return undefined;
      }

      default:
        return false;
    }
  };

  const tryEvaluateCompileTimePredicate = (
    callee: IrExpression,
    args: readonly IrExpression[],
    sourceSpan: IrExpression["sourceSpan"]
  ): IrExpression | undefined => {
    if (
      callee.kind === "identifier" &&
      callee.name === "istype" &&
      expr.kind === "call" &&
      expr.typeArguments &&
      expr.typeArguments.length === 1 &&
      args.length === 1
    ) {
      const actual = tryResolveParamType(args[0] as IrExpression);
      if (!actual) return undefined;

      return {
        kind: "literal",
        value: typesEqualForIsType(actual, expr.typeArguments[0]),
        inferredType: { kind: "primitiveType", name: "boolean" },
        sourceSpan,
      };
    }

    if (
      callee.kind === "memberAccess" &&
      !callee.isComputed &&
      callee.object.kind === "identifier" &&
      callee.object.name === "Array" &&
      callee.property === "isArray" &&
      args.length === 1
    ) {
      const actual = tryResolveParamType(args[0] as IrExpression);
      const value = evaluateArrayIsArrayPredicate(actual);
      if (value === undefined) return undefined;

      return {
        kind: "literal",
        value,
        inferredType: { kind: "primitiveType", name: "boolean" },
        sourceSpan,
      };
    }

    return undefined;
  };

  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
      return expr;

    case "call": {
      const callee = specializeExpression(expr.callee, paramTypesByDeclId);
      const args = expr.arguments.map((a) =>
        a.kind === "spread"
          ? {
              ...a,
              expression: specializeExpression(
                a.expression,
                paramTypesByDeclId
              ),
            }
          : specializeExpression(a, paramTypesByDeclId)
      );

      const specializedPredicate = tryEvaluateCompileTimePredicate(
        callee,
        args,
        expr.sourceSpan
      );
      if (specializedPredicate) {
        return specializedPredicate;
      }

      return { ...expr, callee, arguments: args };
    }

    case "new":
      return {
        ...expr,
        callee: specializeExpression(expr.callee, paramTypesByDeclId),
        arguments: expr.arguments.map((a) =>
          a.kind === "spread"
            ? {
                ...a,
                expression: specializeExpression(
                  a.expression,
                  paramTypesByDeclId
                ),
              }
            : specializeExpression(a, paramTypesByDeclId)
        ),
      };

    case "functionExpression":
      return {
        ...expr,
        body: specializeStatement(
          expr.body,
          paramTypesByDeclId
        ) as IrBlockStatement,
      };

    case "arrowFunction":
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? (specializeStatement(
                expr.body,
                paramTypesByDeclId
              ) as IrBlockStatement)
            : specializeExpression(expr.body, paramTypesByDeclId),
      };

    case "unary": {
      const inner = specializeExpression(expr.expression, paramTypesByDeclId);
      if (
        expr.operator === "!" &&
        inner.kind === "literal" &&
        typeof inner.value === "boolean"
      ) {
        return {
          kind: "literal",
          value: !inner.value,
          inferredType: { kind: "primitiveType", name: "boolean" },
          sourceSpan: expr.sourceSpan,
        };
      }
      return { ...expr, expression: inner };
    }

    case "logical": {
      const left = specializeExpression(expr.left, paramTypesByDeclId);
      if (left.kind === "literal" && typeof left.value === "boolean") {
        if (expr.operator === "&&") {
          if (left.value === false) {
            return {
              kind: "literal",
              value: false,
              inferredType: { kind: "primitiveType", name: "boolean" },
              sourceSpan: expr.sourceSpan,
            };
          }
          return specializeExpression(expr.right, paramTypesByDeclId);
        }

        if (expr.operator === "||") {
          if (left.value === true) {
            return {
              kind: "literal",
              value: true,
              inferredType: { kind: "primitiveType", name: "boolean" },
              sourceSpan: expr.sourceSpan,
            };
          }
          return specializeExpression(expr.right, paramTypesByDeclId);
        }
      }

      const right = specializeExpression(expr.right, paramTypesByDeclId);
      return { ...expr, left, right };
    }

    case "binary":
      return {
        ...expr,
        left: specializeExpression(expr.left, paramTypesByDeclId),
        right: specializeExpression(expr.right, paramTypesByDeclId),
      };
    case "conditional": {
      const condition = specializeExpression(
        expr.condition,
        paramTypesByDeclId
      );
      const whenTrue = specializeExpression(expr.whenTrue, paramTypesByDeclId);
      const whenFalse = specializeExpression(
        expr.whenFalse,
        paramTypesByDeclId
      );

      const inferredType = (() => {
        const trueType = whenTrue.inferredType;
        const falseType = whenFalse.inferredType;

        if (!trueType) return falseType;
        if (!falseType) return trueType;
        if (typesEqualForIsType(trueType, falseType)) {
          return trueType;
        }
        return normalizedUnionType([trueType, falseType]);
      })();

      return {
        ...expr,
        condition,
        whenTrue,
        whenFalse,
        inferredType,
      };
    }
    case "assignment":
      return {
        ...expr,
        right: specializeExpression(expr.right, paramTypesByDeclId),
      };
    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((e) =>
          specializeExpression(e, paramTypesByDeclId)
        ),
      };
    case "spread":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    case "await":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? specializeExpression(expr.expression, paramTypesByDeclId)
          : undefined,
      };
    case "numericNarrowing":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    case "typeAssertion":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    case "trycast":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    case "stackalloc":
      return {
        ...expr,
        size: specializeExpression(expr.size, paramTypesByDeclId),
      };
    case "memberAccess":
      return {
        ...expr,
        object: specializeExpression(expr.object, paramTypesByDeclId),
        property:
          typeof expr.property === "string"
            ? expr.property
            : specializeExpression(expr.property, paramTypesByDeclId),
      };
    case "array":
      return {
        ...expr,
        elements: expr.elements.map((e) =>
          e
            ? e.kind === "spread"
              ? {
                  ...e,
                  expression: specializeExpression(
                    e.expression,
                    paramTypesByDeclId
                  ),
                }
              : specializeExpression(e, paramTypesByDeclId)
            : undefined
        ),
      };
    case "object":
      return {
        ...expr,
        properties: expr.properties.map((p) =>
          p.kind === "spread"
            ? {
                ...p,
                expression: specializeExpression(
                  p.expression,
                  paramTypesByDeclId
                ),
              }
            : {
                ...p,
                key:
                  typeof p.key === "string"
                    ? p.key
                    : specializeExpression(p.key, paramTypesByDeclId),
                value: specializeExpression(p.value, paramTypesByDeclId),
              }
        ),
      };
    case "update":
      return {
        ...expr,
        expression: specializeExpression(expr.expression, paramTypesByDeclId),
      };
    default:
      return expr;
  }
};

export const specializeStatement = (
  stmt: IrStatement,
  paramTypesByDeclId: ReadonlyMap<number, IrType>
): IrStatement => {
  const statementAlwaysTerminates = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "returnStatement":
      case "throwStatement":
      case "generatorReturnStatement":
        return true;
      case "blockStatement": {
        for (const inner of s.statements) {
          if (statementAlwaysTerminates(inner)) return true;
        }
        return false;
      }
      case "ifStatement":
        return s.elseStatement
          ? statementAlwaysTerminates(s.thenStatement) &&
              statementAlwaysTerminates(s.elseStatement)
          : false;
      case "tryStatement": {
        const tryOk = statementAlwaysTerminates(s.tryBlock);
        const catchOk = s.catchClause
          ? statementAlwaysTerminates(s.catchClause.body)
          : true;
        const finallyOk = s.finallyBlock
          ? statementAlwaysTerminates(s.finallyBlock)
          : true;
        return tryOk && catchOk && finallyOk;
      }
      default:
        return false;
    }
  };

  switch (stmt.kind) {
    case "blockStatement": {
      const statements: IrStatement[] = [];
      for (const s of stmt.statements) {
        const specialized = specializeStatement(s, paramTypesByDeclId);
        statements.push(specialized);
        if (statementAlwaysTerminates(specialized)) {
          break;
        }
      }
      return {
        ...stmt,
        statements,
      };
    }

    case "ifStatement": {
      const condition = specializeExpression(
        stmt.condition,
        paramTypesByDeclId
      );
      const thenStatement = specializeStatement(
        stmt.thenStatement,
        paramTypesByDeclId
      );
      const elseStatement = stmt.elseStatement
        ? specializeStatement(stmt.elseStatement, paramTypesByDeclId)
        : undefined;

      if (
        condition.kind === "literal" &&
        typeof condition.value === "boolean"
      ) {
        return condition.value
          ? thenStatement
          : (elseStatement ?? { kind: "emptyStatement" });
      }

      return { ...stmt, condition, thenStatement, elseStatement };
    }

    case "expressionStatement":
      return {
        ...stmt,
        expression: specializeExpression(stmt.expression, paramTypesByDeclId),
      };
    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? specializeExpression(stmt.expression, paramTypesByDeclId)
          : undefined,
      };

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((d) => ({
          ...d,
          initializer: d.initializer
            ? specializeExpression(d.initializer, paramTypesByDeclId)
            : undefined,
        })),
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: specializeExpression(stmt.condition, paramTypesByDeclId),
        body: specializeStatement(stmt.body, paramTypesByDeclId),
      };

    case "forStatement": {
      const initializer = (() => {
        if (!stmt.initializer) return undefined;
        if (stmt.initializer.kind === "variableDeclaration") {
          const specialized = specializeStatement(
            stmt.initializer,
            paramTypesByDeclId
          );
          if (specialized.kind !== "variableDeclaration") {
            throw new Error(
              "ICE: forStatement initializer specialization changed kind"
            );
          }
          return specialized;
        }
        return specializeExpression(stmt.initializer, paramTypesByDeclId);
      })();

      return {
        ...stmt,
        initializer,
        condition: stmt.condition
          ? specializeExpression(stmt.condition, paramTypesByDeclId)
          : undefined,
        update: stmt.update
          ? specializeExpression(stmt.update, paramTypesByDeclId)
          : undefined,
        body: specializeStatement(stmt.body, paramTypesByDeclId),
      };
    }

    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        expression: specializeExpression(stmt.expression, paramTypesByDeclId),
        body: specializeStatement(stmt.body, paramTypesByDeclId),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: specializeExpression(stmt.expression, paramTypesByDeclId),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test
            ? specializeExpression(c.test, paramTypesByDeclId)
            : undefined,
          statements: c.statements.map((s) =>
            specializeStatement(s, paramTypesByDeclId)
          ),
        })),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: specializeStatement(
          stmt.tryBlock,
          paramTypesByDeclId
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: specializeStatement(
                stmt.catchClause.body,
                paramTypesByDeclId
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (specializeStatement(
              stmt.finallyBlock,
              paramTypesByDeclId
            ) as IrBlockStatement)
          : undefined,
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: specializeExpression(stmt.expression, paramTypesByDeclId),
      };

    default:
      return stmt;
  }
};

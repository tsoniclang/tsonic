/**
 * Method member conversion
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrClassMember,
  IrExpression,
  IrMethodDeclaration,
  IrParameter,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import type { ProgramContext } from "../../../../program-context.js";

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: ts.MethodDeclaration,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  const parameters = convertParameters(node.parameters, ctx);

  const overrideInfo = detectOverride(
    memberName,
    "method",
    superClass,
    ctx,
    parameters
  );

  const declaredAccessibility = getAccessibility(node);
  const accessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return declaredAccessibility;
    }

    // Airplane-grade: always emit CLR-required accessibility for overrides.
    // The TS surface may lose access modifiers (e.g., protected members exposed as callable
    // overloads to avoid unstable renames like Dispose2), but C# compilation enforces the truth.
    return overrideInfo.requiredAccessibility;
  })();

  // Get return type from declared annotation for contextual typing
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const returnType = node.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, ctx, returnType)
      : undefined,
    isStatic: hasStaticModifier(node),
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    accessibility,
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};

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

const typesEqualForIsType = (
  a: IrType | undefined,
  b: IrType | undefined
): boolean => {
  if (!a || !b) return false;

  // Bridge primitive types to their canonical CLR types (System.String etc).
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

const specializeExpression = (
  expr: IrExpression,
  paramTypesByDeclId: ReadonlyMap<number, IrType>
): IrExpression => {
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

      // Compile-time-only istype<T>(param)
      if (
        callee.kind === "identifier" &&
        callee.name === "istype" &&
        expr.typeArguments &&
        expr.typeArguments.length === 1 &&
        args.length === 1 &&
        args[0]?.kind === "identifier" &&
        args[0].declId
      ) {
        const target = expr.typeArguments[0];
        const actual = paramTypesByDeclId.get(args[0].declId.id);
        const value = typesEqualForIsType(actual, target);
        return {
          kind: "literal",
          value,
          inferredType: { kind: "primitiveType", name: "boolean" },
          sourceSpan: expr.sourceSpan,
        };
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
    case "conditional":
      return {
        ...expr,
        condition: specializeExpression(expr.condition, paramTypesByDeclId),
        whenTrue: specializeExpression(expr.whenTrue, paramTypesByDeclId),
        whenFalse: specializeExpression(expr.whenFalse, paramTypesByDeclId),
      };
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

const specializeStatement = (
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

const assertNoIsTypeCalls = (stmt: IrStatement): boolean => {
  const visitExpr = (expr: IrExpression): boolean => {
    switch (expr.kind) {
      case "literal":
      case "identifier":
      case "this":
        return true;
      case "spread":
        return visitExpr(expr.expression);
      case "memberAccess":
        return (
          visitExpr(expr.object) &&
          (typeof expr.property === "string" ? true : visitExpr(expr.property))
        );
      case "call":
        return (
          !(
            expr.callee.kind === "identifier" && expr.callee.name === "istype"
          ) &&
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "new":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "functionExpression":
        return expr.body.statements.every(visitStmt);
      case "arrowFunction":
        return expr.body.kind === "blockStatement"
          ? expr.body.statements.every(visitStmt)
          : visitExpr(expr.body);
      case "update":
      case "unary":
        return visitExpr(expr.expression);
      case "binary":
      case "logical":
        return visitExpr(expr.left) && visitExpr(expr.right);
      case "conditional":
        return (
          visitExpr(expr.condition) &&
          visitExpr(expr.whenTrue) &&
          visitExpr(expr.whenFalse)
        );
      case "assignment":
        return visitExpr(expr.right);
      case "templateLiteral":
        return expr.expressions.every(visitExpr);
      case "array":
        return expr.elements.every((e) => {
          if (!e) return true;
          return e.kind === "spread" ? visitExpr(e.expression) : visitExpr(e);
        });
      case "object":
        return expr.properties.every((p) => {
          if (p.kind === "spread") return visitExpr(p.expression);
          const keyOk = typeof p.key === "string" ? true : visitExpr(p.key);
          return keyOk && visitExpr(p.value);
        });
      case "await":
        return visitExpr(expr.expression);
      case "yield":
        return expr.expression ? visitExpr(expr.expression) : true;
      case "numericNarrowing":
        return visitExpr(expr.expression);
      case "typeAssertion":
        return visitExpr(expr.expression);
      case "trycast":
        return visitExpr(expr.expression);
      case "stackalloc":
        return visitExpr(expr.size);
      default:
        return true;
    }
  };

  const visitStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "blockStatement":
        return s.statements.every(visitStmt);
      case "ifStatement":
        return (
          visitExpr(s.condition) &&
          visitStmt(s.thenStatement) &&
          (s.elseStatement ? visitStmt(s.elseStatement) : true)
        );
      case "expressionStatement":
        return visitExpr(s.expression);
      case "returnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      case "variableDeclaration":
        return s.declarations.every((d) =>
          d.initializer ? visitExpr(d.initializer) : true
        );
      case "whileStatement":
        return visitExpr(s.condition) && visitStmt(s.body);
      case "forStatement":
        return (
          (s.initializer
            ? s.initializer.kind === "variableDeclaration"
              ? visitStmt(s.initializer)
              : visitExpr(s.initializer)
            : true) &&
          (s.condition ? visitExpr(s.condition) : true) &&
          (s.update ? visitExpr(s.update) : true) &&
          visitStmt(s.body)
        );
      case "forOfStatement":
      case "forInStatement":
        return visitExpr(s.expression) && visitStmt(s.body);
      case "switchStatement":
        return (
          visitExpr(s.expression) &&
          s.cases.every(
            (c) =>
              (c.test ? visitExpr(c.test) : true) &&
              c.statements.every(visitStmt)
          )
        );
      case "tryStatement":
        return (
          visitStmt(s.tryBlock) &&
          (s.catchClause ? visitStmt(s.catchClause.body) : true) &&
          (s.finallyBlock ? visitStmt(s.finallyBlock) : true)
        );
      case "throwStatement":
        return visitExpr(s.expression);
      case "yieldStatement":
        return s.output ? visitExpr(s.output) : true;
      case "generatorReturnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      default:
        return true;
    }
  };

  return visitStmt(stmt);
};

const assertNoMissingParamRefs = (
  stmt: IrStatement,
  missingDeclIds: ReadonlySet<number>
): boolean => {
  const visitExpr = (expr: IrExpression): boolean => {
    switch (expr.kind) {
      case "literal":
      case "this":
        return true;
      case "identifier":
        return expr.declId ? !missingDeclIds.has(expr.declId.id) : true;
      case "spread":
        return visitExpr(expr.expression);
      case "memberAccess":
        return (
          visitExpr(expr.object) &&
          (typeof expr.property === "string" ? true : visitExpr(expr.property))
        );
      case "call":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "new":
        return (
          visitExpr(expr.callee) &&
          expr.arguments.every((a) =>
            a.kind === "spread" ? visitExpr(a.expression) : visitExpr(a)
          )
        );
      case "functionExpression":
        return expr.body.statements.every(visitStmt);
      case "arrowFunction":
        return expr.body.kind === "blockStatement"
          ? expr.body.statements.every(visitStmt)
          : visitExpr(expr.body);
      case "update":
      case "unary":
        return visitExpr(expr.expression);
      case "binary":
      case "logical":
        return visitExpr(expr.left) && visitExpr(expr.right);
      case "conditional":
        return (
          visitExpr(expr.condition) &&
          visitExpr(expr.whenTrue) &&
          visitExpr(expr.whenFalse)
        );
      case "assignment":
        return visitExpr(expr.right);
      case "templateLiteral":
        return expr.expressions.every(visitExpr);
      case "array":
        return expr.elements.every((e) => {
          if (!e) return true;
          return e.kind === "spread" ? visitExpr(e.expression) : visitExpr(e);
        });
      case "object":
        return expr.properties.every((p) => {
          if (p.kind === "spread") return visitExpr(p.expression);
          const keyOk = typeof p.key === "string" ? true : visitExpr(p.key);
          return keyOk && visitExpr(p.value);
        });
      case "await":
        return visitExpr(expr.expression);
      case "yield":
        return expr.expression ? visitExpr(expr.expression) : true;
      case "numericNarrowing":
        return visitExpr(expr.expression);
      case "typeAssertion":
        return visitExpr(expr.expression);
      case "trycast":
        return visitExpr(expr.expression);
      case "stackalloc":
        return visitExpr(expr.size);
      default:
        return true;
    }
  };

  const visitStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case "blockStatement":
        return s.statements.every(visitStmt);
      case "ifStatement":
        return (
          visitExpr(s.condition) &&
          visitStmt(s.thenStatement) &&
          (s.elseStatement ? visitStmt(s.elseStatement) : true)
        );
      case "expressionStatement":
        return visitExpr(s.expression);
      case "returnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      case "variableDeclaration":
        return s.declarations.every((d) =>
          d.initializer ? visitExpr(d.initializer) : true
        );
      case "whileStatement":
        return visitExpr(s.condition) && visitStmt(s.body);
      case "forStatement":
        return (
          (s.initializer
            ? s.initializer.kind === "variableDeclaration"
              ? visitStmt(s.initializer)
              : visitExpr(s.initializer)
            : true) &&
          (s.condition ? visitExpr(s.condition) : true) &&
          (s.update ? visitExpr(s.update) : true) &&
          visitStmt(s.body)
        );
      case "forOfStatement":
      case "forInStatement":
        return visitExpr(s.expression) && visitStmt(s.body);
      case "switchStatement":
        return (
          visitExpr(s.expression) &&
          s.cases.every(
            (c) =>
              (c.test ? visitExpr(c.test) : true) &&
              c.statements.every(visitStmt)
          )
        );
      case "tryStatement":
        return (
          visitStmt(s.tryBlock) &&
          (s.catchClause ? visitStmt(s.catchClause.body) : true) &&
          (s.finallyBlock ? visitStmt(s.finallyBlock) : true)
        );
      case "throwStatement":
        return visitExpr(s.expression);
      case "yieldStatement":
        return s.output ? visitExpr(s.output) : true;
      case "generatorReturnStatement":
        return s.expression ? visitExpr(s.expression) : true;
      default:
        return true;
    }
  };

  return visitStmt(stmt);
};

/**
 * Convert a TypeScript overload group (`sig; sig; impl {}`) into one C# method per signature.
 *
 * The implementation body is written once and specialized per overload by erasing
 * `istype<T>(pN)` branches that don't match the current overload signature.
 */
export const convertMethodOverloadGroup = (
  nodes: readonly ts.MethodDeclaration[],
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): readonly IrMethodDeclaration[] => {
  const impls = nodes.filter((n) => !!n.body);
  if (impls.length !== 1) {
    throw new Error(
      `ICE: method overload group must contain exactly one implementation body (found ${impls.length})`
    );
  }

  const impl = impls[0] as ts.MethodDeclaration;
  const memberName = ts.isIdentifier(impl.name) ? impl.name.text : "[computed]";

  const sigs = nodes.filter((n) => !n.body);
  if (sigs.length === 0) {
    return [convertMethod(impl, ctx, superClass) as IrMethodDeclaration];
  }

  const implBody = impl.body
    ? convertBlockStatement(impl.body, ctx, undefined)
    : undefined;
  if (!implBody) {
    throw new Error("ICE: overload implementation must have a body");
  }

  const implParams = convertParameters(impl.parameters, ctx);

  // Map implementation param DeclId.id -> index.
  const implParamDeclIds: number[] = [];
  for (const p of impl.parameters) {
    if (!ts.isIdentifier(p.name)) {
      throw new Error(
        `ICE: overload implementations currently require identifier parameters (got non-identifier in '${memberName}')`
      );
    }
    const id = ctx.binding.resolveIdentifier(p.name);
    if (!id) {
      throw new Error(`ICE: could not resolve parameter '${p.name.text}'`);
    }
    implParamDeclIds.push(id.id);
  }

  const declaredAccessibility = getAccessibility(impl);
  const isStatic = hasStaticModifier(impl);
  const isAsync = !!impl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword
  );
  const isGenerator = !!impl.asteriskToken;

  // Convert each signature into a concrete method emission.
  const out: IrMethodDeclaration[] = [];
  for (const sig of sigs) {
    const sigParams = convertParameters(sig.parameters, ctx);
    const returnType = sig.type
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(sig.type))
      : undefined;

    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const parameters: IrParameter[] = sigParams.map((p, i) => ({
      ...p,
      pattern: (implParams[i] as IrParameter).pattern,
    }));

    const overrideInfo = detectOverride(
      memberName,
      "method",
      superClass,
      ctx,
      parameters
    );

    // If this signature matches a non-virtual CLR base method, do not emit a new method
    // (avoid accidental `new` shadowing). Users still inherit the base implementation.
    if (overrideInfo.isShadow) {
      continue;
    }

    const accessibility =
      overrideInfo.isOverride && overrideInfo.requiredAccessibility
        ? overrideInfo.requiredAccessibility
        : declaredAccessibility;

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let i = 0; i < implParamDeclIds.length; i++) {
      const declId = implParamDeclIds[i] as number;
      const t =
        i < parameters.length
          ? parameters[i]?.type
          : ({ kind: "primitiveType", name: "undefined" } as IrType);
      if (t) paramTypesByDeclId.set(declId, t);
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      throw new Error(
        `ICE: istype<T>(...) must be erased during overload specialization for '${memberName}'.`
      );
    }
    if (sigParams.length < implParams.length) {
      const missing = new Set<number>();
      for (let i = sigParams.length; i < implParamDeclIds.length; i++) {
        missing.add(implParamDeclIds[i] as number);
      }
      if (missing.size > 0 && !assertNoMissingParamRefs(specialized, missing)) {
        throw new Error(
          `ICE: overload '${memberName}' implementation references parameters not present in the current signature (sigParams=${sigParams.length}, implParams=${implParams.length}).`
        );
      }
    }

    out.push({
      kind: "methodDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(sig.typeParameters, ctx),
      parameters,
      returnType,
      body: specialized as IrBlockStatement,
      isStatic,
      isAsync,
      isGenerator,
      accessibility,
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    });
  }

  return out;
};

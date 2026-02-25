/**
 * IR → backend AST statement emission.
 *
 * This module incrementally migrates control-flow emission to typed C# AST
 * nodes while preserving fallback behavior for still-string-backed paths.
 */

import { IrExpression, IrStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  NarrowedBinding,
  dedent,
  indent,
  withStatic,
} from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitType } from "../../../type-emitter.js";
import { emitBooleanCondition } from "../../semantic/boolean-context.js";
import { emitStatement as emitStatementText } from "../../../statement-emitter.js";
import { lowerPattern } from "../../../patterns.js";
import { allocateLocalName, registerLocalName } from "../local-names.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../semantic/type-resolution.js";
import {
  isDefinitelyTerminating,
  tryResolveDiscriminantEqualityGuard,
  tryResolveInGuard,
  tryResolveInstanceofGuard,
  tryResolveNullableGuard,
  tryResolvePredicateGuard,
  tryResolveSimpleNullableGuard,
} from "../../../statements/control/conditionals/guard-analysis.js";
import type {
  CSharpCatchClauseAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpSwitchLabelAst,
  CSharpSwitchSectionAst,
} from "./types.js";
import { typeAstFromText } from "./type-factories.js";

const rawExpression = (text: string): CSharpExpressionAst => ({
  kind: "rawExpression",
  text,
});

const identifierExpression = (identifier: string): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier,
});

const parenthesizedExpression = (
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression,
});

const memberAccessExpression = (
  expression: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression,
  memberName,
});

const assignmentExpression = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "assignmentExpression",
  operatorToken: "=",
  left,
  right,
});

const emitStatementFallback = (
  stmt: IrStatement,
  context: EmitterContext
): never => {
  const [code] = emitStatementText(stmt, context);
  throw new Error(
    `ICE: Legacy raw statement fallback reached for ${stmt.kind}. Raw fallback is retired; add AST lowering. Emitted text was:\n${code}`
  );
};

const emitExpressionAst = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrExpression["inferredType"]
): [CSharpExpressionAst, EmitterContext] => {
  const [frag, next] = emitExpression(expr, context, expectedType);
  return [rawExpression(frag.text), next];
};

const emitBooleanConditionAst = (
  expr: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [condText, condCtx] = emitBooleanCondition(
    expr,
    (e, ctx) => emitExpression(e, ctx),
    context
  );
  return [rawExpression(condText), condCtx];
};

const emitYieldExpressionAst = (
  expr: Extract<IrExpression, { kind: "yield" }>,
  context: EmitterContext
): [CSharpStatementAst, EmitterContext] => {
  let current = context;

  if (expr.delegate) {
    if (!expr.expression) {
      return [{ kind: "emptyStatement" }, current];
    }
    const [delegatedExpr, delegatedCtx] = emitExpressionAst(
      expr.expression,
      current
    );
    current = delegatedCtx;
    const itemAlloc = allocateLocalName("item", current);
    current = itemAlloc.context;
    return [
      {
        kind: "foreachStatement",
        awaitModifier: !!current.isAsync,
        type: { kind: "identifierType", name: "var" },
        identifier: itemAlloc.emittedName,
        expression: delegatedExpr,
        statement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "yieldReturnStatement",
              expression: identifierExpression(itemAlloc.emittedName),
            },
          ],
        },
      },
      current,
    ];
  }

  const statements: CSharpStatementAst[] = [];
  if (expr.expression) {
    const [valueExpr, valueCtx] = emitExpressionAst(expr.expression, current);
    current = valueCtx;
    const exchangeVar = current.generatorExchangeVar ?? "exchange";
    statements.push({
      kind: "expressionStatement",
      expression: assignmentExpression(
        memberAccessExpression(identifierExpression(exchangeVar), "Output"),
        valueExpr
      ),
    });
  }

  const exchangeVar = current.generatorExchangeVar ?? "exchange";
  statements.push({
    kind: "yieldReturnStatement",
    expression: identifierExpression(exchangeVar),
  });

  if (statements.length === 1) {
    const single = statements[0];
    if (single) return [single, current];
  }
  return [{ kind: "blockStatement", statements }, current];
};

const parseLoweredLocalDeclaration = (
  statement: string
): CSharpStatementAst | undefined => {
  const trimmed = statement.trim();
  if (!trimmed) return undefined;
  const withoutSemicolon = trimmed.endsWith(";")
    ? trimmed.slice(0, -1)
    : trimmed;
  const eqIndex = withoutSemicolon.indexOf("=");
  const declarationText =
    eqIndex >= 0 ? withoutSemicolon.slice(0, eqIndex) : withoutSemicolon;
  const lhsMatch = declarationText
    .trim()
    .match(/^(.+)\s+(@?[A-Za-z_][A-Za-z0-9_]*)$/);
  if (!lhsMatch) {
    throw new Error(
      `ICE: Unable to parse lowered destructuring declaration: ${statement}`
    );
  }

  const typeText = lhsMatch[1]?.trim();
  const name = lhsMatch[2]?.trim();
  if (!typeText || !name) {
    throw new Error(
      `ICE: Malformed lowered destructuring declaration: ${statement}`
    );
  }

  const initializer =
    eqIndex >= 0
      ? ({
          kind: "rawExpression",
          text: withoutSemicolon.slice(eqIndex + 1).trim(),
        } as const)
      : undefined;

  return {
    kind: "localDeclarationStatement",
    modifiers: [],
    type: typeAstFromText(typeText),
    declarators: [{ kind: "variableDeclarator", name, initializer }],
  };
};

export const parseLoweredStatements = (
  statements: readonly string[]
): readonly CSharpStatementAst[] => {
  const parsed: CSharpStatementAst[] = [];
  for (const statement of statements) {
    const parsedStatement = parseLoweredLocalDeclaration(statement);
    if (parsedStatement) parsed.push(parsedStatement);
  }
  return parsed;
};

type CanonicalIntLoop = {
  readonly varName: string;
  readonly initialValue: number;
};

const isIntegerIncrement = (expr: IrExpression, varName: string): boolean => {
  if (expr.kind === "update") {
    if (expr.operator !== "++") return false;
    if (expr.expression.kind !== "identifier") return false;
    return expr.expression.name === varName;
  }

  if (expr.kind === "assignment") {
    if (expr.left.kind !== "identifier" || expr.left.name !== varName) {
      return false;
    }
    if (expr.operator === "+=") {
      if (expr.right.kind !== "literal") return false;
      return expr.right.value === 1;
    }

    if (expr.operator === "=") {
      if (expr.right.kind !== "binary" || expr.right.operator !== "+") {
        return false;
      }

      const binExpr = expr.right;
      const isVarPlusOne =
        binExpr.left.kind === "identifier" &&
        binExpr.left.name === varName &&
        binExpr.right.kind === "literal" &&
        binExpr.right.value === 1;
      const isOnePlusVar =
        binExpr.left.kind === "literal" &&
        binExpr.left.value === 1 &&
        binExpr.right.kind === "identifier" &&
        binExpr.right.name === varName;
      return isVarPlusOne || isOnePlusVar;
    }
  }

  return false;
};

const detectCanonicalIntLoop = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>
): CanonicalIntLoop | undefined => {
  const { initializer, update } = stmt;
  if (!initializer || initializer.kind !== "variableDeclaration") {
    return undefined;
  }
  if (initializer.declarationKind !== "let") return undefined;
  if (initializer.declarations.length !== 1) return undefined;
  const decl = initializer.declarations[0];
  if (!decl || decl.name.kind !== "identifierPattern") return undefined;
  const varName = decl.name.name;
  const declInit = decl.initializer;
  if (!declInit || declInit.kind !== "literal") return undefined;
  if (typeof declInit.value !== "number" || !Number.isInteger(declInit.value)) {
    return undefined;
  }
  if (!update) return undefined;
  if (!isIntegerIncrement(update, varName)) return undefined;
  return { varName, initialValue: declInit.value };
};

const emitBlockWithLexicalScope = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [
  Extract<CSharpStatementAst, { kind: "blockStatement" }>,
  EmitterContext,
] => {
  const outerNameMap = context.localNameMap;
  let currentContext: EmitterContext = {
    ...context,
    localNameMap: new Map(outerNameMap ?? []),
  };
  const statements: CSharpStatementAst[] = [];
  for (const s of stmt.statements) {
    const [ast, next] = emitStatementAst(s, currentContext);
    if (s.kind !== "blockStatement" && ast.kind === "blockStatement") {
      statements.push(...ast.statements);
    } else {
      statements.push(ast);
    }
    currentContext = next;
  }
  return [
    { kind: "blockStatement", statements },
    { ...currentContext, localNameMap: outerNameMap },
  ];
};

type IfBranchNarrowing = {
  readonly thenBindings?: ReadonlyMap<string, NarrowedBinding>;
  readonly elseBindings?: ReadonlyMap<string, NarrowedBinding>;
  readonly postBindings?: ReadonlyMap<string, NarrowedBinding>;
};

const mapUnionMemberExpr = (
  base: ReadonlyMap<string, NarrowedBinding> | undefined,
  name: string,
  escapedOrig: string,
  memberN: number
): ReadonlyMap<string, NarrowedBinding> => {
  const next = new Map(base ?? []);
  next.set(name, {
    kind: "expr",
    exprText: `(${escapedOrig}.As${memberN}())`,
  });
  return next;
};

const resolveIfBranchNarrowing = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): IfBranchNarrowing => {
  const condition = stmt.condition;
  const base = context.narrowedBindings;

  const inGuard = tryResolveInGuard(condition, context);
  if (inGuard) {
    const thenBindings = mapUnionMemberExpr(
      base,
      inGuard.originalName,
      inGuard.escapedOrig,
      inGuard.memberN
    );
    const otherMemberN = inGuard.memberN === 1 ? 2 : 1;
    const elseBindings =
      stmt.elseStatement && inGuard.unionArity === 2
        ? mapUnionMemberExpr(
            base,
            inGuard.originalName,
            inGuard.escapedOrig,
            otherMemberN
          )
        : base;
    const postBindings =
      !stmt.elseStatement &&
      inGuard.unionArity === 2 &&
      isDefinitelyTerminating(stmt.thenStatement)
        ? mapUnionMemberExpr(
            base,
            inGuard.originalName,
            inGuard.escapedOrig,
            otherMemberN
          )
        : undefined;
    return { thenBindings, elseBindings, postBindings };
  }

  const discriminantGuard = tryResolveDiscriminantEqualityGuard(
    condition,
    context
  );
  if (discriminantGuard) {
    const isInequality =
      discriminantGuard.operator === "!==" ||
      discriminantGuard.operator === "!=";
    const directMember = discriminantGuard.memberN;
    const otherMember = directMember === 1 ? 2 : 1;
    const thenBindings = !isInequality
      ? mapUnionMemberExpr(
          base,
          discriminantGuard.originalName,
          discriminantGuard.escapedOrig,
          directMember
        )
      : discriminantGuard.unionArity === 2
        ? mapUnionMemberExpr(
            base,
            discriminantGuard.originalName,
            discriminantGuard.escapedOrig,
            otherMember
          )
        : base;
    const elseBindings = stmt.elseStatement
      ? isInequality
        ? mapUnionMemberExpr(
            base,
            discriminantGuard.originalName,
            discriminantGuard.escapedOrig,
            directMember
          )
        : discriminantGuard.unionArity === 2
          ? mapUnionMemberExpr(
              base,
              discriminantGuard.originalName,
              discriminantGuard.escapedOrig,
              otherMember
            )
          : base
      : base;
    const postBindings =
      !stmt.elseStatement &&
      discriminantGuard.unionArity === 2 &&
      isDefinitelyTerminating(stmt.thenStatement)
        ? mapUnionMemberExpr(
            base,
            discriminantGuard.originalName,
            discriminantGuard.escapedOrig,
            isInequality ? directMember : otherMember
          )
        : undefined;
    return { thenBindings, elseBindings, postBindings };
  }

  const predicateGuardCondition =
    condition.kind === "unary" &&
    condition.operator === "!" &&
    condition.expression.kind === "call"
      ? { guardTarget: condition.expression, negated: true }
      : condition.kind === "call"
        ? { guardTarget: condition, negated: false }
        : undefined;
  if (predicateGuardCondition) {
    const predicateGuard = tryResolvePredicateGuard(
      predicateGuardCondition.guardTarget,
      context
    );
    if (predicateGuard) {
      const directMember = predicateGuard.memberN;
      const otherMember = directMember === 1 ? 2 : 1;
      const thenBindings = !predicateGuardCondition.negated
        ? mapUnionMemberExpr(
            base,
            predicateGuard.originalName,
            predicateGuard.escapedOrig,
            directMember
          )
        : predicateGuard.unionArity === 2
          ? mapUnionMemberExpr(
              base,
              predicateGuard.originalName,
              predicateGuard.escapedOrig,
              otherMember
            )
          : base;
      const elseBindings = stmt.elseStatement
        ? !predicateGuardCondition.negated
          ? predicateGuard.unionArity === 2
            ? mapUnionMemberExpr(
                base,
                predicateGuard.originalName,
                predicateGuard.escapedOrig,
                otherMember
              )
            : base
          : mapUnionMemberExpr(
              base,
              predicateGuard.originalName,
              predicateGuard.escapedOrig,
              directMember
            )
        : base;
      const postBindings =
        !stmt.elseStatement &&
        predicateGuard.unionArity === 2 &&
        isDefinitelyTerminating(stmt.thenStatement)
          ? mapUnionMemberExpr(
              base,
              predicateGuard.originalName,
              predicateGuard.escapedOrig,
              predicateGuardCondition.negated ? directMember : otherMember
            )
          : undefined;
      return { thenBindings, elseBindings, postBindings };
    }
  }

  const instanceofGuardCondition =
    condition.kind === "unary" &&
    condition.operator === "!" &&
    condition.expression.kind === "binary" &&
    condition.expression.operator === "instanceof"
      ? { guardTarget: condition.expression, negated: true }
      : condition.kind === "binary" && condition.operator === "instanceof"
        ? { guardTarget: condition, negated: false }
        : undefined;
  if (instanceofGuardCondition) {
    const guard = tryResolveInstanceofGuard(
      instanceofGuardCondition.guardTarget,
      context
    );
    if (guard) {
      const castExpr = `((${guard.rhsTypeText})(${guard.escapedOrig}))`;
      const narrowed = new Map(base ?? []);
      narrowed.set(guard.originalName, {
        kind: "expr",
        exprText: castExpr,
        type: guard.targetType,
      });
      if (instanceofGuardCondition.negated) {
        return {
          thenBindings: base,
          elseBindings: stmt.elseStatement ? narrowed : base,
        };
      }
      return {
        thenBindings: narrowed,
        elseBindings: base,
      };
    }
  }

  const simpleNullableGuard = tryResolveSimpleNullableGuard(condition);
  const nullableGuard =
    simpleNullableGuard ?? tryResolveNullableGuard(condition, context);
  if (nullableGuard && nullableGuard.isValueType) {
    const isAndCondition =
      condition.kind === "logical" && condition.operator === "&&";
    if (
      isAndCondition &&
      !simpleNullableGuard &&
      !nullableGuard.narrowsInThen
    ) {
      return { thenBindings: base, elseBindings: base };
    }

    const targetExpr = nullableGuard.targetExpr;
    const [target] =
      targetExpr.kind === "identifier"
        ? emitExpression(targetExpr, {
            ...context,
            narrowedBindings: undefined,
          })
        : emitExpression(targetExpr, {
            ...context,
            narrowedBindings: undefined,
          });
    const narrowed = new Map(base ?? []);
    narrowed.set(nullableGuard.key, {
      kind: "expr",
      exprText: `${target.text}.Value`,
      type: nullableGuard.strippedType,
    });
    return {
      thenBindings: nullableGuard.narrowsInThen ? narrowed : base,
      elseBindings: nullableGuard.narrowsInThen ? base : narrowed,
    };
  }

  return {
    thenBindings: base,
    elseBindings: base,
  };
};

const emitIfConditionAst = (
  condition: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (condition.kind === "logical" && condition.operator === "&&") {
    const pseudoIf: Extract<IrStatement, { kind: "ifStatement" }> = {
      kind: "ifStatement",
      condition: condition.left,
      thenStatement: { kind: "emptyStatement" },
    };
    const leftNarrowing = resolveIfBranchNarrowing(
      pseudoIf,
      context
    ).thenBindings;
    if (leftNarrowing && leftNarrowing !== context.narrowedBindings) {
      const [leftCondition, leftCtx] = emitBooleanConditionAst(
        condition.left,
        context
      );
      const [rightCondition, rightCtx] = emitBooleanConditionAst(
        condition.right,
        {
          ...leftCtx,
          narrowedBindings: leftNarrowing,
        }
      );
      return [
        {
          kind: "parenthesizedExpression",
          expression: {
            kind: "binaryExpression",
            operatorToken: "&&",
            left: leftCondition,
            right: rightCondition,
          },
        },
        {
          ...rightCtx,
          narrowedBindings: context.narrowedBindings,
        },
      ];
    }
  }

  return emitBooleanConditionAst(condition, context);
};

export const emitStatementAst = (
  stmt: IrStatement,
  context: EmitterContext
): [CSharpStatementAst, EmitterContext] => {
  switch (stmt.kind) {
    case "blockStatement": {
      return emitBlockWithLexicalScope(stmt, context);
    }

    case "ifStatement": {
      const [condition, condCtx] = emitIfConditionAst(stmt.condition, context);
      const narrowing = resolveIfBranchNarrowing(stmt, context);
      const [thenAst, thenCtx] = emitStatementAst(stmt.thenStatement, {
        ...condCtx,
        narrowedBindings: narrowing.thenBindings ?? condCtx.narrowedBindings,
      });
      const thenRestoredCtx: EmitterContext = {
        ...thenCtx,
        narrowedBindings: condCtx.narrowedBindings,
      };
      if (!stmt.elseStatement) {
        return [
          {
            kind: "ifStatement",
            condition,
            thenStatement: thenAst,
          },
          {
            ...thenRestoredCtx,
            narrowedBindings:
              narrowing.postBindings ?? thenRestoredCtx.narrowedBindings,
          },
        ];
      }
      const [elseAst, elseCtx] = emitStatementAst(stmt.elseStatement, {
        ...thenRestoredCtx,
        narrowedBindings: narrowing.elseBindings ?? condCtx.narrowedBindings,
      });
      return [
        {
          kind: "ifStatement",
          condition,
          thenStatement: thenAst,
          elseStatement: elseAst,
        },
        {
          ...elseCtx,
          narrowedBindings: condCtx.narrowedBindings,
        },
      ];
    }

    case "whileStatement": {
      const [condition, condCtx] = emitBooleanConditionAst(
        stmt.condition,
        context
      );
      const [bodyAst, bodyCtx] = emitStatementAst(stmt.body, indent(condCtx));
      return [
        {
          kind: "whileStatement",
          condition,
          statement: bodyAst,
        },
        dedent(bodyCtx),
      ];
    }

    case "forStatement": {
      const outerNameMap = context.localNameMap;
      let currentContext: EmitterContext = {
        ...context,
        localNameMap: new Map(outerNameMap ?? []),
      };
      const canonical = detectCanonicalIntLoop(stmt);

      let initializer: CSharpStatementAst | undefined;
      if (stmt.initializer) {
        if (canonical) {
          const alloc = allocateLocalName(canonical.varName, currentContext);
          currentContext = registerLocalName(
            canonical.varName,
            alloc.emittedName,
            alloc.context
          );
          initializer = {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: { kind: "identifierType", name: "int" },
            declarators: [
              {
                kind: "variableDeclarator",
                name: alloc.emittedName,
                initializer: {
                  kind: "literalExpression",
                  text: String(canonical.initialValue),
                },
              },
            ],
          };
        } else if (stmt.initializer.kind === "variableDeclaration") {
          if (stmt.initializer.declarations.length !== 1) {
            return emitStatementFallback(stmt, context);
          }
          const decl = stmt.initializer.declarations[0];
          if (!decl || decl.name.kind !== "identifierPattern") {
            return emitStatementFallback(stmt, context);
          }
          const alloc = allocateLocalName(decl.name.name, currentContext);
          currentContext = registerLocalName(
            decl.name.name,
            alloc.emittedName,
            alloc.context
          );

          let declType: string = "var";
          if (decl.type) {
            const [typeText, typeCtx] = emitType(decl.type, currentContext);
            currentContext = typeCtx;
            declType = typeText;
          }

          let declInit: CSharpExpressionAst | undefined;
          if (decl.initializer) {
            const [initExpr, initCtx] = emitExpressionAst(
              decl.initializer,
              currentContext,
              decl.type
            );
            currentContext = initCtx;
            declInit = initExpr;
          }

          initializer = {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: typeAstFromText(declType),
            declarators: [
              {
                kind: "variableDeclarator",
                name: alloc.emittedName,
                initializer: declInit,
              },
            ],
          };
        } else {
          const [initExpr, initCtx] = emitExpressionAst(
            stmt.initializer,
            currentContext
          );
          currentContext = initCtx;
          initializer = {
            kind: "expressionStatement",
            expression: initExpr,
          };
        }
      }

      let condition: CSharpExpressionAst | undefined;
      if (stmt.condition) {
        const [condExpr, condCtx] = emitBooleanConditionAst(
          stmt.condition,
          currentContext
        );
        currentContext = condCtx;
        condition = condExpr;
      }

      let iterator: readonly CSharpExpressionAst[] | undefined;
      if (stmt.update) {
        const [updateExpr, updateCtx] = emitExpressionAst(
          stmt.update,
          currentContext
        );
        currentContext = updateCtx;
        iterator = [updateExpr];
      }

      let bodyContext = currentContext;
      if (canonical) {
        const existingIntVars = currentContext.intLoopVars ?? new Set<string>();
        const emittedName =
          currentContext.localNameMap?.get(canonical.varName) ??
          canonical.varName;
        const newIntVars = new Set([...existingIntVars, emittedName]);
        const contextWithIntVar = {
          ...indent(currentContext),
          intLoopVars: newIntVars,
        };
        const [bodyAst, bodyCtx] = emitStatementAst(
          stmt.body,
          contextWithIntVar
        );
        bodyContext = {
          ...dedent(bodyCtx),
          intLoopVars: existingIntVars,
          localNameMap: outerNameMap,
        };
        return [
          {
            kind: "forStatement",
            initializer,
            condition,
            iterator,
            statement: bodyAst,
          },
          bodyContext,
        ];
      }

      const [bodyAst, bodyCtx] = emitStatementAst(
        stmt.body,
        indent(currentContext)
      );
      bodyContext = { ...dedent(bodyCtx), localNameMap: outerNameMap };

      return [
        {
          kind: "forStatement",
          initializer,
          condition,
          iterator,
          statement: bodyAst,
        },
        bodyContext,
      ];
    }

    case "forOfStatement": {
      const [expr, exprCtx] = emitExpressionAst(stmt.expression, context);
      const outerNameMap = exprCtx.localNameMap;
      let loopContext: EmitterContext = {
        ...exprCtx,
        localNameMap: new Map(outerNameMap ?? []),
      };
      if (stmt.variable.kind === "identifierPattern") {
        const originalName = stmt.variable.name;
        const alloc = allocateLocalName(originalName, loopContext);
        loopContext = registerLocalName(
          originalName,
          alloc.emittedName,
          alloc.context
        );
        const [body, bodyCtx] = emitStatementAst(
          stmt.body,
          indent(loopContext)
        );
        return [
          {
            kind: "foreachStatement",
            awaitModifier: stmt.isAwait,
            type: { kind: "identifierType", name: "var" },
            identifier: alloc.emittedName,
            expression: expr,
            statement: body,
          },
          { ...dedent(bodyCtx), localNameMap: outerNameMap },
        ];
      }

      const tempAlloc = allocateLocalName("__item", loopContext);
      const tempVar = tempAlloc.emittedName;
      loopContext = tempAlloc.context;
      const lowered = lowerPattern(
        stmt.variable,
        tempVar,
        stmt.expression.inferredType?.kind === "arrayType"
          ? stmt.expression.inferredType.elementType
          : undefined,
        "",
        loopContext
      );
      const loweredAstStatements = parseLoweredStatements(lowered.statements);

      const [body, bodyCtx] = emitStatementAst(
        stmt.body,
        indent(lowered.context)
      );
      const bodyStatements =
        body.kind === "blockStatement" ? body.statements : [body];
      const foreachBody: Extract<
        CSharpStatementAst,
        { kind: "blockStatement" }
      > = {
        kind: "blockStatement",
        statements: [...loweredAstStatements, ...bodyStatements],
      };
      return [
        {
          kind: "foreachStatement",
          awaitModifier: stmt.isAwait,
          type: { kind: "identifierType", name: "var" },
          identifier: tempVar,
          expression: expr,
          statement: foreachBody,
        },
        { ...dedent(bodyCtx), localNameMap: outerNameMap },
      ];
    }

    case "forInStatement": {
      if (stmt.variable.kind !== "identifierPattern") {
        return emitStatementFallback(stmt, context);
      }

      const receiverType = stmt.expression.inferredType
        ? resolveTypeAlias(stripNullish(stmt.expression.inferredType), context)
        : undefined;
      if (
        receiverType?.kind !== "dictionaryType" ||
        receiverType.keyType.kind !== "primitiveType" ||
        receiverType.keyType.name !== "string"
      ) {
        return emitStatementFallback(stmt, context);
      }

      const [expr, exprCtx] = emitExpressionAst(stmt.expression, context);
      const outerNameMap = exprCtx.localNameMap;
      let loopContext: EmitterContext = {
        ...exprCtx,
        localNameMap: new Map(outerNameMap ?? []),
      };
      const alloc = allocateLocalName(stmt.variable.name, loopContext);
      loopContext = registerLocalName(
        stmt.variable.name,
        alloc.emittedName,
        alloc.context
      );
      const [body, bodyCtx] = emitStatementAst(stmt.body, indent(loopContext));
      return [
        {
          kind: "foreachStatement",
          awaitModifier: false,
          type: { kind: "identifierType", name: "var" },
          identifier: alloc.emittedName,
          expression: memberAccessExpression(
            parenthesizedExpression(expr),
            "Keys"
          ),
          statement: body,
        },
        { ...dedent(bodyCtx), localNameMap: outerNameMap },
      ];
    }

    case "switchStatement": {
      const [expr, exprCtx] = emitExpressionAst(stmt.expression, context);
      let current = exprCtx;
      const sections: CSharpSwitchSectionAst[] = [];
      for (const switchCase of stmt.cases) {
        const labels: CSharpSwitchLabelAst[] = [];
        if (switchCase.test) {
          const [testExpr, testCtx] = emitExpressionAst(
            switchCase.test,
            current
          );
          current = testCtx;
          labels.push({
            kind: "caseSwitchLabel",
            value: testExpr,
          });
        } else {
          labels.push({ kind: "defaultSwitchLabel" });
        }

        const statements: CSharpStatementAst[] = [];
        for (const s of switchCase.statements) {
          const [statementAst, next] = emitStatementAst(s, current);
          statements.push(statementAst);
          current = next;
        }

        sections.push({ kind: "switchSection", labels, statements });
      }
      return [
        {
          kind: "switchStatement",
          expression: expr,
          sections,
        },
        current,
      ];
    }

    case "tryStatement": {
      const [tryAst, tryCtx] = emitStatementAst(stmt.tryBlock, context);
      if (tryAst.kind !== "blockStatement") {
        return emitStatementFallback(stmt, context);
      }
      let current = tryCtx;
      const catches: CSharpCatchClauseAst[] = [];
      if (stmt.catchClause) {
        const [catchBodyAst, catchCtx] = emitStatementAst(
          stmt.catchClause.body,
          current
        );
        current = catchCtx;
        catches.push({
          kind: "catchClause",
          declarationType: typeAstFromText("global::System.Exception"),
          declarationIdentifier:
            stmt.catchClause.parameter?.kind === "identifierPattern"
              ? stmt.catchClause.parameter.name
              : "ex",
          block:
            catchBodyAst.kind === "blockStatement"
              ? catchBodyAst
              : { kind: "blockStatement", statements: [catchBodyAst] },
        });
      }

      let finallyBlock:
        | Extract<CSharpStatementAst, { kind: "blockStatement" }>
        | undefined;
      if (stmt.finallyBlock) {
        const [finallyAst, finallyCtx] = emitStatementAst(
          stmt.finallyBlock,
          current
        );
        current = finallyCtx;
        finallyBlock =
          finallyAst.kind === "blockStatement"
            ? finallyAst
            : { kind: "blockStatement", statements: [finallyAst] };
      }

      return [
        {
          kind: "tryStatement",
          block: tryAst,
          catches,
          finallyBlock,
        },
        current,
      ];
    }

    case "throwStatement": {
      if (!stmt.expression) {
        return [{ kind: "throwStatement" }, context];
      }
      const [expression, next] = emitExpressionAst(stmt.expression, context);
      return [{ kind: "throwStatement", expression }, next];
    }

    case "returnStatement": {
      const expr = stmt.expression;
      if (!expr) return [{ kind: "returnStatement" }, context];

      if (
        context.returnType?.kind === "voidType" ||
        context.returnType?.kind === "neverType"
      ) {
        const operand =
          expr.kind === "unary" && expr.operator === "void"
            ? expr.expression
            : expr;
        const isNoopExpr =
          (operand.kind === "literal" &&
            (operand.value === undefined || operand.value === null)) ||
          (operand.kind === "identifier" &&
            (operand.name === "undefined" || operand.name === "null"));
        const [operandExpr, next] = emitExpressionAst(operand, context);
        if (isNoopExpr) {
          return [{ kind: "returnStatement" }, next];
        }
        const directExpr =
          operand.kind === "call" ||
          operand.kind === "new" ||
          operand.kind === "assignment" ||
          operand.kind === "update" ||
          operand.kind === "await";
        if (directExpr) {
          return [
            {
              kind: "blockStatement",
              statements: [
                { kind: "expressionStatement", expression: operandExpr },
                { kind: "returnStatement" },
              ],
            },
            next,
          ];
        }
        return [
          {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: assignmentExpression(
                  identifierExpression("_"),
                  operandExpr
                ),
              },
              { kind: "returnStatement" },
            ],
          },
          next,
        ];
      }

      const [expression, next] = emitExpressionAst(
        expr,
        context,
        context.returnType
      );
      return [{ kind: "returnStatement", expression }, next];
    }

    case "breakStatement":
      return [{ kind: "breakStatement" }, context];

    case "continueStatement":
      return [{ kind: "continueStatement" }, context];

    case "yieldStatement": {
      if (stmt.delegate) {
        if (!stmt.output) return emitStatementFallback(stmt, context);
        const [delegatedExpr, delegatedCtx] = emitExpressionAst(
          stmt.output,
          context
        );
        const itemAlloc = allocateLocalName("item", delegatedCtx);
        const yieldExpr = identifierExpression(itemAlloc.emittedName);
        return [
          {
            kind: "foreachStatement",
            awaitModifier: !!delegatedCtx.isAsync,
            type: { kind: "identifierType", name: "var" },
            identifier: itemAlloc.emittedName,
            expression: delegatedExpr,
            statement: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "yieldReturnStatement",
                  expression: yieldExpr,
                },
              ],
            },
          },
          itemAlloc.context,
        ];
      }

      let current = context;
      const exchangeVar = current.generatorExchangeVar ?? "exchange";
      const statements: CSharpStatementAst[] = [];
      if (stmt.output) {
        const [valueExpr, next] = emitExpressionAst(stmt.output, current);
        current = next;
        statements.push({
          kind: "expressionStatement",
          expression: assignmentExpression(
            memberAccessExpression(identifierExpression(exchangeVar), "Output"),
            valueExpr
          ),
        });
      }
      statements.push({
        kind: "yieldReturnStatement",
        expression: identifierExpression(exchangeVar),
      });
      if (stmt.receiveTarget) {
        const lowered = lowerPattern(
          stmt.receiveTarget,
          `(${exchangeVar}.Input ?? default!)`,
          stmt.receivedType,
          "",
          current
        );
        statements.push(...parseLoweredStatements(lowered.statements));
        current = lowered.context;
      }
      return [{ kind: "blockStatement", statements }, current];
    }

    case "generatorReturnStatement": {
      if (!stmt.expression) return [{ kind: "yieldBreakStatement" }, context];
      const returnVar = context.generatorReturnValueVar ?? "__returnValue";
      const [valueExpr, next] = emitExpressionAst(stmt.expression, context);
      return [
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "expressionStatement",
              expression: assignmentExpression(
                identifierExpression(returnVar),
                valueExpr
              ),
            },
            { kind: "yieldBreakStatement" },
          ],
        },
        next,
      ];
    }

    case "expressionStatement": {
      if (
        stmt.expression.kind === "unary" &&
        stmt.expression.operator === "void"
      ) {
        const operand = stmt.expression.expression;
        const [operandExpr, next] = emitExpressionAst(operand, context);
        const directExpr =
          operand.kind === "call" ||
          operand.kind === "new" ||
          operand.kind === "assignment" ||
          operand.kind === "update" ||
          operand.kind === "await";
        if (directExpr) {
          return [
            { kind: "expressionStatement", expression: operandExpr },
            next,
          ];
        }
        return [
          {
            kind: "expressionStatement",
            expression: assignmentExpression(
              identifierExpression("_"),
              operandExpr
            ),
          },
          next,
        ];
      }

      if (stmt.expression.kind === "yield") {
        return emitYieldExpressionAst(stmt.expression, context);
      }

      const [expression, next] = emitExpressionAst(stmt.expression, context);
      return [{ kind: "expressionStatement", expression }, next];
    }

    case "emptyStatement":
      return [{ kind: "emptyStatement" }, context];

    case "variableDeclaration": {
      const localContext = withStatic(context, false);
      const statements: CSharpStatementAst[] = [];
      let current = localContext;

      for (const decl of stmt.declarations) {
        if (
          decl.name.kind === "arrayPattern" ||
          decl.name.kind === "objectPattern"
        ) {
          if (!decl.initializer) {
            return emitStatementFallback(stmt, localContext);
          }
          const [initExpr, initCtx] = emitExpressionAst(
            decl.initializer,
            current,
            decl.type
          );
          current = initCtx;
          const patternType = decl.type ?? decl.initializer.inferredType;
          if (initExpr.kind !== "rawExpression") {
            throw new Error(
              "ICE: Destructuring initializer AST is expected to be rawExpression"
            );
          }
          const lowered = lowerPattern(
            decl.name,
            initExpr.text,
            patternType,
            "",
            current
          );
          current = lowered.context;
          const loweredStatements = parseLoweredStatements(lowered.statements);
          statements.push(...loweredStatements);
          continue;
        }

        if (decl.name.kind !== "identifierPattern") {
          return emitStatementFallback(stmt, localContext);
        }

        const alloc = allocateLocalName(decl.name.name, current);
        current = registerLocalName(
          decl.name.name,
          alloc.emittedName,
          alloc.context
        );

        let typeText = "var";
        const targetType =
          decl.initializer?.kind === "stackalloc"
            ? (decl.type ?? decl.initializer.inferredType)
            : decl.type;
        if (targetType) {
          const [explicitType, typeCtx] = emitType(targetType, current);
          current = typeCtx;
          typeText = explicitType;
        } else if (!decl.initializer) {
          return emitStatementFallback(stmt, localContext);
        }

        let initializer: CSharpExpressionAst | undefined;
        if (decl.initializer) {
          const [initExpr, initCtx] = emitExpressionAst(
            decl.initializer,
            current,
            decl.type
          );
          current = initCtx;
          initializer = initExpr;
        }

        statements.push({
          kind: "localDeclarationStatement",
          modifiers: [],
          type: typeAstFromText(typeText),
          declarators: [
            {
              kind: "variableDeclarator",
              name: alloc.emittedName,
              initializer,
            },
          ],
        });
      }

      if (statements.length === 1) {
        const single = statements[0];
        if (single) return [single, current];
      }
      return [{ kind: "blockStatement", statements }, current];
    }

    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return emitStatementFallback(stmt, context);
  }

  const _exhaustive: never = stmt;
  throw new Error(
    `ICE: Unhandled IR statement kind in AST emitter: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

/**
 * Constructor member emission — returns CSharpMemberAst (constructor declaration)
 */

import { IrClassMember, IrStatement, type IrParameter } from "@tsonic/frontend";
import { EmitterContext, indent, dedent } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitBlockStatementAst } from "../../../statement-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/format/attributes.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuringAst,
} from "../parameters.js";
import type {
  CSharpMemberAst,
  CSharpExpressionAst,
  CSharpBlockStatementAst,
  CSharpStatementAst,
} from "../../../core/format/backend-ast/types.js";

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set<string>();
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      const emitted = escapeCSharpIdentifier(p.pattern.name);
      map.set(p.pattern.name, emitted);
      used.add(emitted);
    }
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

/**
 * Emit a constructor declaration as CSharpMemberAst
 */
export const emitConstructorMember = (
  member: IrClassMember & { kind: "constructorDeclaration" },
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
    usedLocalNames: context.usedLocalNames,
  };

  let currentContext = context;

  // Attributes
  const [attrs, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  // Modifiers
  const modifiers: string[] = [];
  const accessibility = member.accessibility ?? "public";
  modifiers.push(accessibility);

  // Constructor name (same as class name)
  const constructorName = context.className ?? "UnknownClass";

  // Parameters
  const paramsResult = emitParametersWithDestructuring(
    member.parameters,
    currentContext
  );
  currentContext = paramsResult.context;
  currentContext = seedLocalNameMapFromParameters(
    member.parameters,
    currentContext
  );

  // No body → abstract constructor
  if (!member.body) {
    const ctorAst: CSharpMemberAst = {
      kind: "constructorDeclaration",
      attributes: attrs,
      modifiers,
      name: constructorName,
      parameters: paramsResult.parameters,
      body: { kind: "blockStatement", statements: [] },
    };
    return [ctorAst, { ...currentContext, ...savedScoped }];
  }

  // Extract super() call from first statement
  const [baseArgs, bodyStatements, baseCallContext] = extractSuperCallAst(
    member.body.statements,
    currentContext
  );
  currentContext = baseCallContext;

  // Check for later super() calls (not supported)
  const hasLaterSuperCall = bodyStatements.some(
    (stmt) =>
      stmt.kind === "expressionStatement" &&
      stmt.expression.kind === "call" &&
      stmt.expression.callee.kind === "identifier" &&
      stmt.expression.callee.name === "super"
  );

  if (hasLaterSuperCall) {
    throw new Error(
      "Unsupported constructor semantics: super() must be the first statement to preserve JavaScript initialization order."
    );
  }

  // Emit body
  let bodyContext = indent(currentContext);
  const modifiedBody: typeof member.body = {
    ...member.body,
    statements: bodyStatements,
  };

  // Generate parameter destructuring as AST
  const [paramDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuringAst(
          paramsResult.destructuringParams,
          bodyContext
        )
      : [[] as readonly CSharpStatementAst[], bodyContext];
  bodyContext = destructuringContext;

  const [bodyBlockAst, finalContext] = emitBlockStatementAst(
    modifiedBody,
    bodyContext
  );

  // Merge destructuring preamble into body
  const mergedBody: CSharpBlockStatementAst =
    paramDestructuringStmts.length > 0
      ? {
          kind: "blockStatement",
          statements: [...paramDestructuringStmts, ...bodyBlockAst.statements],
        }
      : bodyBlockAst;

  const ctorAst: CSharpMemberAst = {
    kind: "constructorDeclaration",
    attributes: attrs,
    modifiers,
    name: constructorName,
    parameters: paramsResult.parameters,
    baseArguments: baseArgs,
    body: mergedBody,
  };

  const returnedContext = dedent(finalContext);
  return [ctorAst, { ...returnedContext, ...savedScoped }];
};

/**
 * Extract super() call from first statement as AST.
 * Returns [baseArguments | undefined, remainingStatements, context]
 */
const extractSuperCallAst = (
  statements: readonly IrStatement[],
  context: EmitterContext
): [
  readonly CSharpExpressionAst[] | undefined,
  readonly IrStatement[],
  EmitterContext,
] => {
  let currentContext = context;

  if (statements.length === 0) {
    return [undefined, statements, currentContext];
  }

  const firstStmt = statements[0];
  if (
    firstStmt &&
    firstStmt.kind === "expressionStatement" &&
    firstStmt.expression.kind === "call" &&
    firstStmt.expression.callee.kind === "identifier" &&
    firstStmt.expression.callee.name === "super"
  ) {
    // Found super() call as first statement - convert to base(...)
    const superCall = firstStmt.expression;
    const argAsts: CSharpExpressionAst[] = [];
    for (const arg of superCall.arguments) {
      const [argAst, newContext] = emitExpressionAst(arg, currentContext);
      argAsts.push(argAst);
      currentContext = newContext;
    }
    const remainingStatements = statements.slice(1);
    return [argAsts, remainingStatements, currentContext];
  }

  return [undefined, statements, currentContext];
};

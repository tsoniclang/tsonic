import type { Node } from "@tsonic/tsts";
import { sourceFlowBooleanEdges } from "./conditions.js";
import { sourceFlowResourceScope, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { SourceFlowFailure } from "./resources.js";

export function sourceFlowLoop(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext): number {
  const { ast } = build.source;
  const initializer = ast.is.IsForStatement(node) ? ast.as.AsForStatement(node)?.Initializer : undefined;
  const kind = initializer === undefined ? undefined : ast.variableDeclarationKind(initializer);
  if (initializer !== undefined && (kind === "using" || kind === "await using")) {
    const declarations = ast.as.AsVariableDeclarationList(initializer)?.Declarations?.Nodes;
    if (declarations === undefined || declarations.length === 0 || declarations.some(declaration => declaration === undefined)) {
      throw new SourceFlowFailure("Source flow requires exact checked loop resources.", initializer);
    }
    return sourceFlowResourceScope(build, declarations as readonly Node[], next, context,
      (completion, protectedContext) => sourceFlowLoopBody(build, node, completion, protectedContext, true));
  }
  return sourceFlowLoopBody(build, node, next, context, false);
}

function sourceFlowLoopBody(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext, acquired: boolean): number {
  const { ast } = build.source;
  const anchor = build.point(node, { kind: "merge" });
  const breaks = new Map([...context.breaks, [node, next]]);
  const loopContext = (continuation: number): SourceFlowContext => ({ ...context, breaks,
    continues: new Map([...context.continues, [node, continuation]]) });
  if (ast.is.IsForInStatement(node) || ast.is.IsForOfStatement(node)) {
    const selected = ast.as.AsForInOrOfStatement(node);
    if (selected?.Expression === undefined || selected.Statement === undefined || selected.Initializer === undefined) {
      throw new SourceFlowFailure("Source flow requires a complete checked iterator loop.", node);
    }
    const bodyContext = loopContext(anchor);
    let body: number;
    if (ast.is.IsVariableDeclarationList(selected.Initializer)) {
      const declarations = ast.as.AsVariableDeclarationList(selected.Initializer)?.Declarations?.Nodes;
      const declaration = declarations?.[0];
      const name = declaration === undefined ? undefined : ast.name(declaration);
      if (name === undefined || declarations?.length !== 1) throw new SourceFlowFailure("An iterator loop requires one checked binding.", node);
      const kind = ast.variableDeclarationKind(declaration);
      body = kind === "using" || kind === "await using"
        ? sourceFlowResourceScope(build, [declaration!], anchor, bodyContext,
          (completion, protectedContext) => build.statement(selected.Statement!, completion, protectedContext),
          (resource, continuation, acquisitionContext) => {
            const binding = ast.name(resource);
            if (binding === undefined) throw new SourceFlowFailure("Source flow requires an exact iteration resource binding.", resource);
            return build.pattern(binding, continuation, acquisitionContext, true);
          })
        : build.pattern(name, build.statement(selected.Statement, anchor, bodyContext), bodyContext, true);
    } else body = build.pattern(selected.Initializer, build.statement(selected.Statement, anchor, bodyContext), bodyContext, false);
    const branch = build.point(node, { kind: "iteration" });
    build.edge(branch, body, "true");
    build.edge(branch, next, "false");
    build.edge(branch, context.throwTo, "exception");
    const step = selected.AwaitModifier === undefined ? branch
      : build.emit(node, { kind: "await" }, branch, context, true, "resume");
    build.edge(anchor, step);
    return build.expression(selected.Expression, build.emit(node, { kind: "evaluate" }, anchor, context, true), context);
  }
  const selected = ast.is.IsForStatement(node) ? ast.as.AsForStatement(node) : undefined;
  const condition = selected?.Condition ?? (ast.is.IsWhileStatement(node) ? ast.as.AsWhileStatement(node)?.Expression
    : ast.is.IsDoStatement(node) ? ast.as.AsDoStatement(node)?.Expression : undefined);
  const statement = selected?.Statement ?? (ast.is.IsWhileStatement(node) ? ast.as.AsWhileStatement(node)?.Statement
    : ast.is.IsDoStatement(node) ? ast.as.AsDoStatement(node)?.Statement : undefined);
  if (statement === undefined || condition === undefined && !ast.is.IsForStatement(node)) {
    throw new SourceFlowFailure("Source flow requires a complete checked loop.", node);
  }
  const incrementor = selected?.Incrementor;
  const continuation = incrementor === undefined ? anchor : build.expression(incrementor, anchor, context);
  const body = build.statement(statement, continuation, loopContext(continuation));
  if (condition === undefined) build.edge(anchor, body);
  else {
    const branch = build.point(node, { kind: "branch" });
    sourceFlowBooleanEdges(build, branch, condition, body, next);
    build.edge(anchor, build.expression(condition, branch, context));
  }
  if (ast.is.IsDoStatement(node)) return body;
  const initializer = acquired ? undefined : selected?.Initializer;
  return initializer === undefined ? anchor : ast.is.IsVariableDeclarationList(initializer)
    ? build.statement(initializer, anchor, context) : build.expression(initializer, anchor, context);
}

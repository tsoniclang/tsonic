import type { Node } from "@tsonic/tsts";
import { sourceControlTransferTarget } from "../../source-navigation/control-targets.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import { sourceFlowBooleanEdges } from "./conditions.js";
import { sourceFlowCleanupScope, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { sourceFlowClosure } from "./expressions.js";
import { sourceFlowLoop } from "./loops.js";
import { SourceFlowFailure } from "./resources.js";

export function sourceFlowStatement(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext): number {
  const { ast } = build.source;
  if (ast.is.IsBlock(node)) return sourceFlowStatements(build, ast.statements(node), next, context);
  if (ast.is.IsEmptyStatement(node) || ast.is.IsDebuggerStatement(node) || ast.is.IsInterfaceDeclaration(node) ||
    ast.is.IsTypeAliasDeclaration(node) || isTypeSyntaxNode(ast, node)) return next;
  if (ast.is.IsExpressionStatement(node)) {
    const expression = ast.as.AsExpressionStatement(node)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked statement expression.", node);
    return build.expression(expression, next, context);
  }
  if (ast.is.IsVariableStatement(node)) {
    const list = ast.as.AsVariableStatement(node)?.DeclarationList;
    if (list === undefined) throw new SourceFlowFailure("Source flow requires a checked declaration list.", node);
    return build.statement(list, next, context);
  }
  if (ast.is.IsVariableDeclarationList(node)) {
    const kind = ast.variableDeclarationKind(node);
    const declarations = ast.as.AsVariableDeclarationList(node)?.Declarations?.Nodes ?? [];
    if (kind === "using" || kind === "await using") {
      throw new SourceFlowFailure("Resource acquisition requires its checked lexical cleanup scope.", node);
    }
    let entry = next;
    for (let index = declarations.length - 1; index >= 0; index -= 1) {
      const declaration = declarations[index];
      if (declaration !== undefined) entry = build.pattern(declaration, entry, context, true);
    }
    return entry;
  }
  if (ast.is.IsVariableDeclaration(node)) return build.pattern(node, next, context, true);
  if (ast.is.IsIfStatement(node)) {
    const selected = ast.as.AsIfStatement(node);
    if (selected?.Expression === undefined || selected.ThenStatement === undefined) {
      throw new SourceFlowFailure("Source flow requires a complete checked if statement.", node);
    }
    const branch = build.point(node, { kind: "branch" });
    sourceFlowBooleanEdges(build, branch, selected.Expression, build.statement(selected.ThenStatement, next, context),
      selected.ElseStatement === undefined ? next : build.statement(selected.ElseStatement, next, context));
    return build.expression(selected.Expression, branch, context);
  }
  if (ast.is.IsReturnStatement(node) || ast.is.IsThrowStatement(node)) {
    const returning = ast.is.IsReturnStatement(node);
    const point = build.point(node, { kind: returning ? "return" : "throw" });
    build.edge(point, returning ? context.returnTo : context.throwTo, returning ? "return" : "exception");
    const expression = returning ? ast.as.AsReturnStatement(node)?.Expression : ast.as.AsThrowStatement(node)?.Expression;
    return expression === undefined ? point : build.expression(expression, point, context);
  }
  if (ast.is.IsBreakStatement(node) || ast.is.IsContinueStatement(node)) {
    const continuing = ast.is.IsContinueStatement(node);
    const target = sourceControlTransferTarget(ast, node);
    const destination = target === undefined ? undefined : (continuing ? context.continues : context.breaks).get(target);
    if (destination === undefined) throw new SourceFlowFailure("Source flow requires the checked control-transfer destination.", node);
    const point = build.point(node, { kind: "merge" });
    build.edge(point, destination, continuing ? "continue" : "break");
    return point;
  }
  if (ast.is.IsLabeledStatement(node)) {
    const statement = ast.as.AsLabeledStatement(node)?.Statement;
    if (statement === undefined) throw new SourceFlowFailure("Source flow requires the checked labelled statement.", node);
    return build.statement(statement, next, { ...context, breaks: new Map([...context.breaks, [node, next]]) });
  }
  if (ast.is.IsWhileStatement(node) || ast.is.IsDoStatement(node) || ast.is.IsForStatement(node) ||
    ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node)) return sourceFlowLoop(build, node, next, context);
  if (ast.is.IsSwitchStatement(node)) return switchStatement(build, node, next, context);
  if (ast.is.IsTryStatement(node)) return tryStatement(build, node, next, context);
  if (ast.is.IsFunctionDeclaration(node)) return sourceFlowClosure(build, node, next, context);
  if (ast.is.IsClassDeclaration(node)) {
    const write = build.emit(node, { kind: "write", binding: node, initialization: true }, next, context);
    return build.expression(node, write, context);
  }
  throw new SourceFlowFailure(`Source flow does not support checked statement ${ast.kindName(node)}.`, node);
}

export function sourceFlowStatements(build: SourceFlowConstruction, statements: readonly (Node | undefined)[],
  next: number, context: SourceFlowContext): number {
  const sequence: { readonly node: Node; readonly context: SourceFlowContext; readonly acquisition: boolean }[] = [];
  let completion = next;
  let active = context;
  const { ast } = build.source;
  for (const statement of statements) {
    if (statement === undefined) throw new SourceFlowFailure("Source flow requires a dense checked statement sequence.", undefined);
    const list = ast.is.IsVariableStatement(statement) ? ast.as.AsVariableStatement(statement)?.DeclarationList : undefined;
    const kind = list === undefined ? undefined : ast.variableDeclarationKind(list);
    if (list === undefined || kind !== "using" && kind !== "await using") {
      sequence.push({ node: statement, context: active, acquisition: false });
      continue;
    }
    build.step(statement);
    const declarations = checkedDeclarations(ast.as.AsVariableDeclarationList(list)?.Declarations?.Nodes, list);
    for (const declaration of declarations) {
      sequence.push({ node: declaration, context: active, acquisition: true });
      const scope = sourceFlowCleanupScope(build, declaration, completion, active);
      completion = scope.next;
      active = scope.context;
    }
  }
  let entry = completion;
  for (let index = sequence.length - 1; index >= 0; index -= 1) {
    const selected = sequence[index]!;
    entry = selected.acquisition ? build.pattern(selected.node, entry, selected.context, true)
      : build.statement(selected.node, entry, selected.context);
  }
  return entry;
}

function checkedDeclarations(declarations: readonly (Node | undefined)[] | undefined, owner: Node): readonly Node[] {
  if (declarations === undefined || declarations.length === 0 || declarations.some(declaration => declaration === undefined)) {
    throw new SourceFlowFailure("Source flow requires exact checked resource declaration slots.", owner);
  }
  return declarations as readonly Node[];
}

function switchStatement(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number {
  const { ast } = build.source;
  const selected = ast.as.AsSwitchStatement(node);
  const clauses = selected?.CaseBlock === undefined ? undefined : ast.as.AsCaseBlock(selected.CaseBlock)?.Clauses?.Nodes;
  if (selected?.Expression === undefined || clauses === undefined) throw new SourceFlowFailure("Source flow requires a checked switch body.", node);
  const bodyContext = { ...context, breaks: new Map([...context.breaks, [node, next]]) };
  const bodies = new Map<Node, number>();
  const hasResources = clauses.some(clause => clause !== undefined && ast.statements(clause).some(statement => {
    const list = statement !== undefined && ast.is.IsVariableStatement(statement)
      ? ast.as.AsVariableStatement(statement)?.DeclarationList : undefined;
    const kind = list === undefined ? undefined : ast.variableDeclarationKind(list);
    return kind === "using" || kind === "await using";
  }));
  let entry = next;
  let defaultEntry = next;
  for (let index = clauses.length - 1; index >= 0; index -= 1) {
    const clause = clauses[index];
    if (clause === undefined) continue;
    entry = hasResources
      ? sourceFlowStatements(build, clauses.slice(index).flatMap(following => following === undefined ? [] : ast.statements(following)), next, bodyContext)
      : sourceFlowStatements(build, ast.statements(clause), entry, bodyContext);
    bodies.set(clause, entry);
    if (ast.is.IsDefaultClause(clause)) defaultEntry = entry;
  }
  const defaultPoint = build.point(node, { kind: "merge" });
  build.edge(defaultPoint, defaultEntry, "default");
  entry = defaultPoint;
  for (let index = clauses.length - 1; index >= 0; index -= 1) {
    const clause = clauses[index];
    if (clause === undefined || ast.is.IsDefaultClause(clause)) continue;
    const expression = ast.as.AsCaseOrDefaultClause(clause)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked case expression.", clause);
    const branch = build.point(clause, { kind: "branch" });
    build.edge(branch, bodies.get(clause)!, "case");
    build.edge(branch, entry, "false");
    entry = build.expression(expression, branch, context);
  }
  return build.expression(selected.Expression, entry, context);
}

function tryStatement(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number {
  const { ast } = build.source;
  const selected = ast.as.AsTryStatement(node);
  if (selected?.TryBlock === undefined) throw new SourceFlowFailure("Source flow requires a checked try body.", node);
  const finallyBlock = selected.FinallyBlock;
  const routed = new Map<number, number>();
  const route = (destination: number): number => {
    if (finallyBlock === undefined) return destination;
    const existing = routed.get(destination);
    if (existing !== undefined) return existing;
    const entry = build.statement(finallyBlock, destination, context);
    routed.set(destination, entry);
    return entry;
  };
  const protectedContext: SourceFlowContext = finallyBlock === undefined ? context : {
    returnTo: route(context.returnTo), throwTo: route(context.throwTo),
    breaks: new Map([...context.breaks].map(([target, destination]) => [target, route(destination)])),
    continues: new Map([...context.continues].map(([target, destination]) => [target, route(destination)])),
  };
  const normal = route(next);
  let throwTo = protectedContext.throwTo;
  if (selected.CatchClause !== undefined) {
    const handler = ast.as.AsCatchClause(selected.CatchClause);
    if (handler?.Block === undefined) throw new SourceFlowFailure("Source flow requires a checked catch body.", selected.CatchClause);
    let entry = build.statement(handler.Block, normal, protectedContext);
    if (handler.VariableDeclaration !== undefined) {
      const name = ast.name(handler.VariableDeclaration);
      if (name === undefined) throw new SourceFlowFailure("Source flow requires a checked catch binding.", handler.VariableDeclaration);
      entry = build.pattern(name, entry, protectedContext, true);
    }
    throwTo = build.emit(selected.CatchClause, { kind: "catch" }, entry, protectedContext);
  }
  return build.statement(selected.TryBlock, normal, { ...protectedContext, throwTo });
}

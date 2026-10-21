import { AsBinaryExpression } from "../../source-navigation/checked-casts.js";
import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import { sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/callable-boundaries.js";
import { sourceFlowBinding, sourceFlowReference, sourceFlowWriteValue } from "./bindings.js";
import { sourceFlowBooleanEdges, sourceFlowNullishEdges } from "./conditions.js";
import { sourceFlowSequence, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { SourceFlowFailure } from "./resources.js";
import { sourceFlowUnwrap } from "./syntax.js";

const assignments: ReadonlySet<string> = new Set(["KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken",
  "KindAsteriskEqualsToken", "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken", "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken", "KindAmpersandAmpersandEqualsToken",
  "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken"]);
const literalKinds: ReadonlySet<string> = new Set(["KindNumericLiteral", "KindBigIntLiteral", "KindStringLiteral",
  "KindNoSubstitutionTemplateLiteral", "KindRegularExpressionLiteral", "KindTrueKeyword", "KindFalseKeyword",
  "KindNullKeyword", "KindThisKeyword", "KindSuperKeyword", "KindOmittedExpression", "KindMetaProperty"]);

export function sourceFlowExpression(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext): number {
  const { ast } = build.source;
  const kind = ast.kindName(node);
  if (literalKinds.has(kind)) return build.emit(node, { kind: "evaluate" }, next, context);
  if (ast.is.IsIdentifier(node)) {
    const binding = sourceFlowBinding(build, node);
    return build.emit(node, binding === undefined ? { kind: "evaluate" } : { kind: "read", binding }, next, context);
  }
  if (isTypeSyntaxNode(ast, node)) return next;
  if (isSourceCallableBodyBoundary(ast, node)) return sourceFlowClosure(build, node, next, context);
  if (ast.is.IsBlock(node)) return build.statement(node, next, context);
  if (isChainOperand(build, node)) return chain(build, node, next, next, context);
  if (ast.is.IsAwaitExpression(node)) {
    const expression = ast.as.AsAwaitExpression(node)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked await operand.", node);
    const awaitPoint = build.emit(node, { kind: "await", value: expression }, next, context, true, "resume");
    return build.expression(expression, awaitPoint, context);
  }
  if (ast.is.IsYieldExpression(node)) {
    const expression = ast.as.AsYieldExpression(node)?.Expression;
    const suspension = build.emit(node, { kind: "yield" }, next, context, true, "resume");
    build.edge(suspension, context.returnTo, "return");
    return expression === undefined ? suspension : build.expression(expression, suspension, context);
  }
  if (ast.is.IsConditionalExpression(node)) {
    const selected = ast.as.AsConditionalExpression(node);
    if (selected?.Condition === undefined || selected.WhenTrue === undefined || selected.WhenFalse === undefined) {
      throw new SourceFlowFailure("Source flow requires a complete checked conditional.", node);
    }
    const branch = build.point(node, { kind: "branch" });
    sourceFlowBooleanEdges(build, branch, selected.Condition, build.expression(selected.WhenTrue, next, context),
      build.expression(selected.WhenFalse, next, context));
    return build.expression(selected.Condition, branch, context);
  }
  if (ast.is.IsBinaryExpression(node)) return binary(build, node, next, context);
  if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
    const original = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand
      : ast.as.AsPostfixUnaryExpression(node)?.Operand;
    if (original === undefined) throw new SourceFlowFailure("Source flow requires a checked unary operand.", node);
    const operand = sourceFlowUnwrap(build, original);
    const operator = ast.operatorKindName(node);
    if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
      const binding = ast.is.IsIdentifier(operand) ? sourceFlowBinding(build, operand) : undefined;
      const value = sourceFlowWriteValue(build, operand, { kind: "value", expression: node, projection: [] });
      const write = build.emit(node, binding === undefined
        ? { kind: "write-location", location: operand, value }
        : { kind: "write", binding, reference: operand, initialization: false,
            value }, next, context, binding === undefined);
      return sourceFlowReference(build, operand, write, context, true);
    }
    return build.expression(operand, build.emit(node, { kind: "evaluate" }, next, context,
      build.source.navigation.expressionEffects(node).mayThrow), context);
  }
  if (ast.is.IsNewExpression(node)) {
    const expression = ast.as.AsNewExpression(node)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked constructor.", node);
    const invoke = build.emit(node, { kind: "evaluate" }, next, context, true);
    return build.expression(expression, sourceFlowSequence(ast.arguments(node), invoke, context, build.expression), context);
  }
  if (ast.is.IsDeleteExpression(node)) {
    const expression = ast.as.AsDeleteExpression(node)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked delete operand.", node);
    const target = sourceFlowUnwrap(build, expression);
    const access = ast.is.IsPropertyAccessExpression(target) ? ast.as.AsPropertyAccessExpression(target)
      : ast.is.IsElementAccessExpression(target) ? ast.as.AsElementAccessExpression(target) : undefined;
    if (access?.Expression === undefined) throw new SourceFlowFailure("Source flow requires a checked property deletion.", node);
    let entry = build.emit(node, { kind: "evaluate" }, next, context, true);
    if (ast.is.IsElementAccessExpression(target)) {
      const argument = ast.as.AsElementAccessExpression(target)?.ArgumentExpression;
      if (argument === undefined) throw new SourceFlowFailure("Source flow requires a checked deletion index.", node);
      entry = build.expression(argument, entry, context);
    }
    if (access.QuestionDotToken !== undefined) {
      const branch = build.point(target, { kind: "branch" });
      build.edge(branch, next, "nullish");
      build.edge(branch, entry, "present");
      entry = branch;
    }
    const receiver = access.Expression;
    return isChainOperand(build, receiver)
      ? chain(build, receiver, entry, next, context) : build.expression(receiver, entry, context);
  }
  if (ast.is.IsClassExpression(node) || ast.is.IsClassDeclaration(node)) {
    let entry = sourceFlowClosure(build, node, next, context);
    const children: Node[] = [];
    forEachSourceImmediateEvaluationChild(ast, node, child => children.push(child));
    entry = sourceFlowSequence(children, entry, context, build.expression);
    return entry;
  }
  if (ast.is.IsPropertyAssignment(node)) {
    const initializer = ast.as.AsPropertyAssignment(node)?.Initializer;
    if (initializer === undefined) throw new SourceFlowFailure("Source flow requires a checked property value.", node);
    let entry = build.expression(initializer, next, context);
    const name = ast.name(node);
    if (name !== undefined && ast.is.IsComputedPropertyName(name)) entry = build.expression(name, entry, context);
    return entry;
  }
  if (ast.is.IsShorthandPropertyAssignment(node)) {
    const name = ast.name(node);
    if (name === undefined) throw new SourceFlowFailure("Source flow requires a checked shorthand value.", node);
    return build.expression(name, next, context);
  }
  if (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node)) {
    return sourceFlowSequence(ast.is.IsArrayLiteralExpression(node) ? ast.elements(node) : ast.properties(node),
      build.emit(node, { kind: "evaluate" }, next, context), context, build.expression);
  }
  if (ast.is.IsTemplateExpression(node)) {
    const spans = ast.as.AsTemplateExpression(node)?.TemplateSpans?.Nodes ?? [];
    return sourceFlowSequence(spans, build.emit(node, { kind: "evaluate" }, next, context, true), context, build.expression);
  }
  if (ast.is.IsTaggedTemplateExpression(node)) {
    const tagged = ast.as.AsTaggedTemplateExpression(node);
    if (tagged?.Tag === undefined || tagged.Template === undefined) throw new SourceFlowFailure("Source flow requires a checked tagged template.", node);
    const invoke = build.emit(node, { kind: "evaluate" }, next, context, true);
    const spans = ast.is.IsTemplateExpression(tagged.Template) ? ast.as.AsTemplateExpression(tagged.Template)?.TemplateSpans?.Nodes ?? [] : [];
    return build.expression(tagged.Tag, sourceFlowSequence(spans, invoke, context, build.expression), context);
  }
  const inner = transparentOperand(build, node);
  if (inner !== undefined) return build.expression(inner, build.emit(node, { kind: "evaluate" }, next, context,
    ast.is.IsSpreadElement(node) || ast.is.IsSpreadAssignment(node) || ast.is.IsDeleteExpression(node)), context);
  throw new SourceFlowFailure(`Source flow does not support checked expression ${kind}.`, node);
}

function chain(build: SourceFlowConstruction, node: Node, next: number, skipped: number,
  context: SourceFlowContext): number {
  build.step(node);
  const { ast } = build.source;
  if (ast.is.IsNonNullExpression(node)) {
    const operand = ast.as.AsNonNullExpression(node)?.Expression;
    if (operand === undefined) throw new SourceFlowFailure("Source flow requires a checked assertion operand.", node);
    const entry = build.emit(node, { kind: "evaluate" }, next, context);
    return isChainOperand(build, operand) ? chain(build, operand, entry, skipped, context)
      : build.expression(operand, entry, context);
  }
  const access = ast.is.IsPropertyAccessExpression(node) ? ast.as.AsPropertyAccessExpression(node)
    : ast.is.IsElementAccessExpression(node) ? ast.as.AsElementAccessExpression(node)
    : ast.is.IsCallExpression(node) ? ast.as.AsCallExpression(node) : undefined;
  if (access?.Expression === undefined) return build.expression(node, next, context);
  const completion = ast.is.IsCallExpression(node) && ast.kindName(access.Expression) === "KindSuperKeyword"
    ? build.initializeSuper(next, context) : next;
  let entry = build.emit(node, { kind: "evaluate" }, completion, context, true);
  if (ast.is.IsCallExpression(node)) entry = sourceFlowSequence(ast.arguments(node), entry, context, build.expression);
  if (ast.is.IsElementAccessExpression(node)) {
    const argument = ast.as.AsElementAccessExpression(node)?.ArgumentExpression;
    if (argument === undefined) throw new SourceFlowFailure("Source flow requires a checked element index.", node);
    entry = build.expression(argument, entry, context);
  }
  if (access.QuestionDotToken !== undefined) {
    const branch = build.point(node, { kind: "branch" });
    build.edge(branch, skipped, "nullish");
    build.edge(branch, entry, "present");
    entry = branch;
  }
  const receiver = access.Expression;
  return isChainOperand(build, receiver)
    ? chain(build, receiver, entry, skipped, context) : build.expression(receiver, entry, context);
}

function isChainOperand(build: SourceFlowConstruction, node: Node): boolean {
  const { ast } = build.source;
  return ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node) ||
    ast.is.IsCallExpression(node) || ast.is.IsNonNullExpression(node);
}

function binary(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number {
  const { ast } = build.source;
  const selected = AsBinaryExpression(ast, node);
  if (selected?.Left === undefined || selected.Right === undefined) throw new SourceFlowFailure("Source flow requires both checked binary operands.", node);
  const left = sourceFlowUnwrap(build, selected.Left);
  const right = selected.Right;
  const operator = ast.operatorKindName(node) ?? "";
  if (assignments.has(operator)) {
    if (ast.is.IsArrayLiteralExpression(left) || ast.is.IsObjectLiteralExpression(left)) {
      return build.expression(right, build.pattern(left, next, context, false, { kind: "value", expression: right, projection: [] }), context);
    }
    const binding = ast.is.IsIdentifier(left) ? sourceFlowBinding(build, left) : undefined;
    const assignedValue = sourceFlowWriteValue(build, left, { kind: "value", expression: operator === "KindEqualsToken" ||
      operator === "KindAmpersandAmpersandEqualsToken" || operator === "KindBarBarEqualsToken" ||
      operator === "KindQuestionQuestionEqualsToken" ? right : node, projection: [] });
    const write = build.emit(node, binding === undefined ? { kind: "write-location", location: left, value: assignedValue }
      : { kind: "write", binding, reference: left, initialization: false, value: assignedValue }, next, context, binding === undefined);
    let value = build.expression(right, write, context);
    if (operator === "KindAmpersandAmpersandEqualsToken" || operator === "KindBarBarEqualsToken" || operator === "KindQuestionQuestionEqualsToken") {
      const branch = build.point(node, { kind: "branch" });
      branchEdges(build, branch, left, operator, value, next);
      value = branch;
    }
    return sourceFlowReference(build, left, value, context, operator !== "KindEqualsToken");
  }
  if (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken" || operator === "KindQuestionQuestionToken") {
    const branch = build.point(node, { kind: "branch" });
    branchEdges(build, branch, left, operator, build.expression(right, next, context), next);
    return build.expression(left, branch, context);
  }
  const finish = build.emit(node, { kind: "evaluate" }, next, context,
    operator !== "KindCommaToken" && build.source.navigation.expressionEffects(node).mayThrow);
  return build.expression(left, build.expression(right, finish, context), context);
}

function branchEdges(build: SourceFlowConstruction, point: number, condition: Node, operator: string, evaluated: number, skipped: number): void {
  if (operator === "KindQuestionQuestionToken" || operator === "KindQuestionQuestionEqualsToken") {
    sourceFlowNullishEdges(build, point, condition, evaluated, skipped);
  } else {
    const conjunction = operator === "KindAmpersandAmpersandToken" || operator === "KindAmpersandAmpersandEqualsToken";
    sourceFlowBooleanEdges(build, point, condition, conjunction ? evaluated : skipped, conjunction ? skipped : evaluated);
  }
}

export function sourceFlowClosure(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number {
  const captures = build.captures(node);
  let entry = build.emit(node, { kind: "evaluate" }, next, context);
  for (let index = captures.length - 1; index >= 0; index -= 1) {
    const capture = captures[index]!;
    entry = build.emit(node, { kind: "capture", binding: capture.declaration }, entry, context);
  }
  const name = build.source.ast.name(node);
  return name !== undefined && build.source.ast.is.IsComputedPropertyName(name)
    ? build.expression(name, entry, context) : entry;
}

function transparentOperand(build: SourceFlowConstruction, node: Node): Node | undefined {
  const { ast } = build.source;
  const wrapped = sourceTransparentExpressionOperand(ast, node);
  if (wrapped !== undefined) return wrapped;
  if (ast.is.IsVoidExpression(node)) return ast.as.AsVoidExpression(node)?.Expression;
  if (ast.is.IsTypeOfExpression(node)) return ast.as.AsTypeOfExpression(node)?.Expression;
  if (ast.is.IsSpreadElement(node)) return ast.as.AsSpreadElement(node)?.Expression;
  if (ast.is.IsSpreadAssignment(node)) return ast.as.AsSpreadAssignment(node)?.Expression;
  if (ast.is.IsComputedPropertyName(node)) return ast.as.AsComputedPropertyName(node)?.Expression;
  if (ast.is.IsTemplateSpan(node)) return ast.as.AsTemplateSpan(node)?.Expression;
  return undefined;
}

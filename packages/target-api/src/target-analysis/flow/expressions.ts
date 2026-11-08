import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourceOperation, SourceResult, SourceValueOperand, SourceValueSelection } from "../../public/source/contracts.js";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import { sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import { sourceFlowBinding, sourceFlowReference, sourceFlowWriteValue } from "./bindings.js";
import { sourceFlowNullishEdges } from "./conditions.js";
import { sourceFlowSequence, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { SourceFlowFailure, SourceFlowRefusal } from "./resources.js";
import { sourceFlowUnwrap } from "./syntax.js";

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
  if (build.source.facts.navigation.callableRoles(node).body) return sourceFlowClosure(build, node, next, context);
  if (ast.is.IsBlock(node)) return build.statement(node, next, context);
  if (isChainOperand(build, node)) return chain(build, node, next, next, context);
  if (ast.is.IsAwaitExpression(node)) {
    const selected = operation(build, node);
    if (selected.kind !== "await") throw new SourceFlowFailure("Source flow requires its published await operation.", node);
    const expression = selected.operand.occurrence;
    const awaitPoint = build.emit(node, { kind: "await", awaitKind: "authored", value: expression }, next, context, true, "resume");
    return build.expression(expression, awaitPoint, context);
  }
  if (ast.is.IsYieldExpression(node)) {
    const expression = ast.as.AsYieldExpression(node)?.Expression;
    const suspension = build.emit(node, { kind: "yield" }, next, context, true, "resume");
    build.edge(suspension, context.returnTo, "return");
    return expression === undefined ? suspension : build.expression(expression, suspension, context);
  }
  if (ast.is.IsConditionalExpression(node)) {
    const selected = operation(build, node);
    if (selected.kind !== "conditional") throw new SourceFlowFailure("Source flow requires its published conditional operation.", node);
    if (selected.disposition === "true") return build.expression(selected.control.occurrence,
      build.expression(demandedOperand(selected.whenTrue).occurrence, next, context), context);
    if (selected.disposition === "false") return build.expression(selected.control.occurrence,
      build.expression(demandedOperand(selected.whenFalse).occurrence, next, context), context);
    const branch = build.point(node, { kind: "branch" });
    build.edge(branch, build.expression(demandedOperand(selected.whenTrue).occurrence, next, context), "true");
    build.edge(branch, build.expression(demandedOperand(selected.whenFalse).occurrence, next, context), "false");
    return build.expression(selected.control.occurrence, branch, context);
  }
  if (ast.is.IsBinaryExpression(node)) return binary(build, node, next, context);
  if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
    const selected = operation(build, node);
    if (selected.kind === "update") {
      const operand = sourceFlowUnwrap(build, selected.operand.occurrence);
      const binding = ast.is.IsIdentifier(operand) ? sourceFlowBinding(build, operand) : undefined;
      const value = sourceFlowWriteValue(build, operand, { kind: "value", expression: node, projection: [] });
      const write = build.emit(node, binding === undefined
        ? { kind: "write-location", location: operand, value }
        : { kind: "write", binding, reference: operand, initialization: false,
            value }, next, context, binding === undefined);
      return sourceFlowReference(build, operand, write, context, true);
    }
    if (selected.kind !== "unary") throw new SourceFlowFailure("Source flow requires its published unary operation.", node);
    return sourceFlowSequence(selected.operands.map(operand => operand.occurrence),
      build.emit(node, { kind: "evaluate" }, next, context,
        build.source.facts.navigation.expressionEffects(node).mayThrow), context, build.expression);
  }
  if (ast.is.IsNewExpression(node)) {
    const application = selectedApplication(build, node);
    if (application.kind !== "construct") throw new SourceFlowFailure("Source flow requires its published construction.", node);
    const invoke = build.emit(node, { kind: "evaluate" }, next, context, true);
    return build.expression(application.callee.occurrence, applicationArguments(build, application, invoke, context), context);
  }
  if (ast.is.IsDeleteExpression(node)) {
    const expression = ast.as.AsDeleteExpression(node)?.Expression;
    if (expression === undefined) throw new SourceFlowFailure("Source flow requires a checked delete operand.", node);
    const target = sourceFlowUnwrap(build, expression);
    if (!ast.is.IsPropertyAccessExpression(target) && !ast.is.IsElementAccessExpression(target))
      throw new SourceFlowFailure("Source flow requires its original property deletion.", node);
    return memberChain(build, target, build.emit(node, { kind: "evaluate" }, next, context, true), next, context);
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
  if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node))
    return memberChain(build, node, build.emit(node, { kind: "evaluate" }, next, context, true), skipped, context);
  if (!ast.is.IsCallExpression(node)) throw new SourceFlowFailure("Source flow requires an original evaluation chain.", node);
  const application = selectedApplication(build, node);
  if (application.kind !== "call") throw new SourceFlowFailure("Source flow requires its published invocation.", node);
  const receiver = application.callee.occurrence;
  const completion = ast.kindName(receiver) === "KindSuperKeyword" ? build.initializeSuper(next, context) : next;
  let entry = skipped;
  if (application.argumentDisposition !== "skip") {
    const invoke = build.emit(node, { kind: "evaluate" }, completion, context, true);
    entry = applicationArguments(build, application, invoke, context);
    if (application.optionalCall && application.argumentDisposition === "dynamic") {
      const branch = build.point(node, { kind: "branch" });
      build.edge(branch, skipped, "nullish");
      build.edge(branch, entry, "present");
      entry = branch;
    }
  }
  return isChainOperand(build, receiver)
    ? chain(build, receiver, entry, skipped, context) : build.expression(receiver, entry, context);
}

function memberChain(build: SourceFlowConstruction, node: Node, next: number, skipped: number,
  context: SourceFlowContext): number {
  const selected = build.source.facts.objects.use(node);
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  const member = selected.value;
  if (member.occurrence !== node) throw new SourceFlowFailure("Source flow requires the identical member occurrence.", node);
  const selectedKey = member.key;
  const evaluateKey = (): number => selectedKey.kind === "present"
    ? build.expression(selectedKey.value.occurrence, next, context) : next;
  let entry: number;
  if (member.optionalChain) {
    const branch = build.point(node, { kind: "branch" });
    sourceFlowNullishEdges(build, branch, member.receiver.occurrence, () => skipped, evaluateKey);
    entry = branch;
  } else entry = evaluateKey();
  const receiver = member.receiver.occurrence;
  return isChainOperand(build, receiver)
    ? chain(build, receiver, entry, member.chainContinuation || member.optionalChain ? skipped : entry, context)
    : build.expression(receiver, entry, context);
}

function isChainOperand(build: SourceFlowConstruction, node: Node): boolean {
  const { ast } = build.source;
  return ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node) ||
    ast.is.IsCallExpression(node) || ast.is.IsNonNullExpression(node);
}

function binary(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number {
  const { ast } = build.source;
  const selected = operation(build, node);
  if (selected.kind === "assignment" || selected.kind === "compound" || selected.kind === "selection-assignment") {
    const left = sourceFlowUnwrap(build, selected.target);
    if (selected.kind === "selection-assignment" && selected.selection.disposition === "left")
      return sourceFlowReference(build, left, next, context, true);
    const right = selected.kind === "assignment" ? selected.source.occurrence
      : selected.kind === "compound" ? selected.operands[1].occurrence
      : demandedOperand(rightOperand(selected.selection)).occurrence;
    if (ast.is.IsArrayLiteralExpression(left) || ast.is.IsObjectLiteralExpression(left)) {
      if (selected.kind !== "assignment") throw new SourceFlowFailure("Source flow requires a plain pattern assignment.", node);
      return build.expression(right, build.pattern(left, next, context, false, { kind: "value", expression: right, projection: [] }), context);
    }
    const binding = ast.is.IsIdentifier(left) ? sourceFlowBinding(build, left) : undefined;
    const assignedValue = sourceFlowWriteValue(build, left, { kind: "value",
      expression: selected.kind === "compound" ? node : right, projection: [] });
    const write = build.emit(node, binding === undefined ? { kind: "write-location", location: left, value: assignedValue }
      : { kind: "write", binding, reference: left, initialization: false, value: assignedValue }, next, context, binding === undefined);
    let value = build.expression(right, write, context);
    if (selected.kind === "selection-assignment" && selected.selection.disposition === "dynamic") {
      const branch = build.point(node, { kind: "branch" });
      branchEdges(build, branch, selected.selection.kind, value, next);
      value = branch;
    }
    return sourceFlowReference(build, left, value, context, selected.kind !== "assignment");
  }
  if (selected.kind === "and" || selected.kind === "or" || selected.kind === "coalesce") {
    if (selected.disposition === "left") return build.expression(selected.control.occurrence, next, context);
    const right = build.expression(demandedOperand(rightOperand(selected)).occurrence, next, context);
    if (selected.disposition === "right") return build.expression(selected.control.occurrence, right, context);
    const branch = build.point(node, { kind: "branch" });
    branchEdges(build, branch, selected.kind, right, next);
    return build.expression(selected.control.occurrence, branch, context);
  }
  const operands = selected.kind === "binary" || selected.kind === "sequence" ? selected.operands
    : selected.kind === "in" || selected.kind === "instanceof" ? [selected.left, selected.right] : undefined;
  if (operands === undefined) throw new SourceFlowFailure("Source flow requires its published binary operation.", node);
  const finish = build.emit(node, { kind: "evaluate" }, next, context,
    selected.kind !== "sequence" && build.source.facts.navigation.expressionEffects(node).mayThrow);
  return sourceFlowSequence(operands.map(operand => operand.occurrence), finish, context, build.expression);
}

type LogicalSelection = Extract<SourceValueSelection, { readonly kind: "and" | "or" | "coalesce" }>;

function rightOperand(selection: LogicalSelection): SourceResult<SourceValueOperand> {
  return selection.kind === "and" ? selection.whenTrue
    : selection.kind === "or" ? selection.whenFalse : selection.whenAbsent;
}

function branchEdges(build: SourceFlowConstruction, point: number, kind: LogicalSelection["kind"], evaluated: number, skipped: number): void {
  if (kind === "coalesce") {
    build.edge(point, evaluated, "nullish");
    build.edge(point, skipped, "present");
  } else {
    build.edge(point, kind === "and" ? evaluated : skipped, "true");
    build.edge(point, kind === "and" ? skipped : evaluated, "false");
  }
}

function operation(build: SourceFlowConstruction, node: Node): SourceOperation {
  const selected = build.source.facts.values.operation(node);
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  if (selected.value.occurrence !== node) throw new SourceFlowFailure("Source flow requires the identical published operation.", node);
  return selected.value;
}

function selectedApplication(build: SourceFlowConstruction, node: Node): SourceApplication {
  const selected = build.source.facts.applications.application(node);
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  if (selected.value.identity.invocation !== node) throw new SourceFlowFailure("Source flow requires the identical published application.", node);
  return selected.value;
}

function demandedOperand(selected: SourceResult<SourceValueOperand>): SourceValueOperand {
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  return selected.value;
}

function applicationArguments(build: SourceFlowConstruction, application: SourceApplication, next: number,
  context: SourceFlowContext): number {
  if (application.argumentDisposition === "skip") return next;
  const argumentsInOrder: Node[] = [];
  for (const argument of application.sourceArguments) {
    build.source.facts.navigation.callableRoles(argument.occurrence);
    demandedOperand(argument.operand);
    argumentsInOrder.push(argument.occurrence);
  }
  return sourceFlowSequence(argumentsInOrder, next, context, build.expression);
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

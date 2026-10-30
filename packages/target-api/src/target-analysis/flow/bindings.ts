import type { Node } from "@tsonic/tsts";
import type { SourceFlowConstruction, SourceFlowContext } from "./construction.js";
import { SourceFlowFailure } from "./resources.js";
import { sourceFlowUnwrap } from "./syntax.js";
import type { SourceFlowOperation } from "./model.js";
import { sourceBindingWriteAtReference } from "../../source-navigation/references-usage.js";
import type { SourceBindingWriteValue } from "../../source-navigation/types.js";

const bindingKinds: ReadonlySet<string> = new Set(["KindVariableDeclaration", "KindBindingElement", "KindParameter",
  "KindFunctionDeclaration", "KindFunctionExpression", "KindClassDeclaration", "KindClassExpression", "KindEnumDeclaration"]);

export function sourceFlowBinding(build: SourceFlowConstruction, reference: Node): Node | undefined {
  const selected = build.source.navigation.sourceReferenceFor(reference)?.declaration;
  return selected !== undefined && bindingKinds.has(build.source.ast.kindName(selected)) ? selected : undefined;
}

export function sourceFlowPattern(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext, initialization: boolean,
  value: Extract<SourceFlowOperation, { readonly kind: "write" }>["value"]): number {
  node = sourceFlowUnwrap(build, node);
  const { ast } = build.source;
  if (ast.is.IsIdentifier(node)) {
    const binding = sourceFlowBinding(build, node);
    if (binding === undefined) throw new SourceFlowFailure("Source flow requires the checked binding of a write.", node);
    return build.emit(node, { kind: "write", binding, reference: node, value: sourceFlowWriteValue(build, node, value),
      initialization: initialization && ast.variableDeclarationKind(binding) !== "var" }, next, context);
  }
  if (ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node)) {
    const name = ast.name(node);
    if (name === undefined) throw new SourceFlowFailure("Source flow requires a checked binding name.", node);
    const initializer = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)?.Initializer
      : ast.as.AsParameterDeclaration(node)?.Initializer;
    if (initializer === undefined) {
      if (ast.is.IsParameterDeclaration(node)) return build.pattern(name, next, context, true, value);
      if (!ast.is.IsIdentifier(name)) throw new SourceFlowFailure("A binding pattern requires an initializer.", node);
      if (ast.variableDeclarationKind(node) === "var") return next;
      return build.emit(node, { kind: "declare", binding: node }, next, context);
    }
    const initialized = Object.freeze({ kind: "value" as const, expression: initializer, projection: Object.freeze([]) });
    const write = build.pattern(name, next, context, true, initialized);
    if (ast.is.IsVariableDeclaration(node)) return build.expression(initializer, write, context);
    const branch = build.point(node, { kind: "branch" });
    build.edge(branch, build.expression(initializer, write, context), "default");
    build.edge(branch, build.pattern(name, next, context, true, value), "present");
    return branch;
  }
  if (ast.is.IsBindingElement(node)) {
    const element = ast.as.AsBindingElement(node);
    const name = ast.name(node);
    if (name === undefined) throw new SourceFlowFailure("Source flow requires a checked destructuring binding.", node);
    const projected = value === undefined ? undefined : Object.freeze({ ...value,
      projection: Object.freeze([...value.projection, node]) });
    let entry = build.pattern(name, next, context, initialization, projected);
    if (element?.Initializer !== undefined) {
      const branch = build.point(node, { kind: "branch" });
      const assigned = build.pattern(name, next, context, initialization,
        Object.freeze({ kind: "value", expression: element.Initializer, projection: Object.freeze([]) }));
      build.edge(branch, build.expression(element.Initializer, assigned, context), "default");
      build.edge(branch, entry, "present");
      entry = branch;
    }
    entry = build.emit(node, { kind: "evaluate" }, entry, context, true);
    const property = element?.PropertyName;
    return property !== undefined && ast.is.IsComputedPropertyName(property)
      ? build.expression(property, entry, context) : entry;
  }
  if (ast.is.IsArrayBindingPattern(node) || ast.is.IsObjectBindingPattern(node)) {
    let entry = next;
    const elements = ast.elements(node);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      if (element !== undefined && !ast.is.IsOmittedExpression(element)) entry = build.pattern(element, entry, context, initialization, value);
    }
    return entry;
  }
  if (ast.is.IsArrayLiteralExpression(node)) {
    let entry = next;
    const elements = ast.elements(node);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      if (element === undefined || ast.is.IsOmittedExpression(element)) continue;
      const target = ast.is.IsSpreadElement(element) ? ast.as.AsSpreadElement(element)?.Expression : element;
      if (target !== undefined) entry = build.emit(element, { kind: "evaluate" },
        build.pattern(target, entry, context, initialization, value === undefined ? undefined :
          Object.freeze({ ...value, projection: Object.freeze([...value.projection, element]) })), context, true);
    }
    return entry;
  }
  if (ast.is.IsObjectLiteralExpression(node)) {
    let entry = next;
    const properties = ast.properties(node);
    for (let index = properties.length - 1; index >= 0; index -= 1) {
      const property = properties[index];
      if (property === undefined) continue;
      let computed: Node | undefined;
      if (ast.is.IsPropertyAssignment(property)) {
        const target = ast.as.AsPropertyAssignment(property)?.Initializer;
        if (target !== undefined) entry = build.pattern(target, entry, context, initialization, projectedValue(property));
        const name = ast.name(property);
        if (name !== undefined && ast.is.IsComputedPropertyName(name)) computed = name;
      } else if (ast.is.IsShorthandPropertyAssignment(property)) {
        const name = ast.name(property);
        const initializer = ast.as.AsShorthandPropertyAssignment(property)?.ObjectAssignmentInitializer;
        if (name !== undefined && initializer !== undefined) {
          const branch = build.point(property, { kind: "branch" });
          const assigned = build.pattern(name, entry, context, initialization,
            Object.freeze({ kind: "value", expression: initializer, projection: Object.freeze([]) }));
          build.edge(branch, build.expression(initializer, assigned, context), "default");
          build.edge(branch, build.pattern(name, entry, context, initialization, projectedValue(property)), "present");
          entry = branch;
        } else if (name !== undefined) entry = build.pattern(name, entry, context, initialization, projectedValue(property));
      } else if (ast.is.IsSpreadAssignment(property)) {
        const target = ast.as.AsSpreadAssignment(property)?.Expression;
        if (target !== undefined) entry = build.pattern(target, entry, context, initialization, projectedValue(property));
      } else throw new SourceFlowFailure("Source flow cannot assign this object pattern element.", property);
      entry = build.emit(property, { kind: "evaluate" }, entry, context, true);
      if (computed !== undefined) entry = build.expression(computed, entry, context);
    }
    return entry;
  }
  if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken") {
    const binary = ast.as.AsBinaryExpression(node);
    if (binary?.Left === undefined || binary.Right === undefined) throw new SourceFlowFailure("Source flow requires both pattern operands.", node);
    const write = build.pattern(binary.Left, next, context, initialization,
      Object.freeze({ kind: "value", expression: binary.Right, projection: Object.freeze([]) }));
    const branch = build.point(node, { kind: "branch" });
    build.edge(branch, build.expression(binary.Right, write, context), "default");
    build.edge(branch, build.pattern(binary.Left, next, context, initialization, value), "present");
    return branch;
  }
  if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
    if (value === undefined) throw new SourceFlowFailure("Source location assignment requires its original incoming value.", node);
    const write = build.emit(node, { kind: "write-location", location: node,
      value: sourceFlowWriteValue(build, node, value) }, next, context, true);
    return sourceFlowReference(build, node, write, context, false);
  }
  throw new SourceFlowFailure(`Source flow does not support the checked assignment pattern ${ast.kindName(node)}.`, node);

  function projectedValue(part: Node) {
    return value === undefined ? undefined : Object.freeze({ ...value,
      projection: Object.freeze([...value.projection, part]) });
  }
}

export function sourceFlowWriteValue(build: SourceFlowConstruction, reference: Node,
  value: SourceBindingWriteValue): SourceBindingWriteValue;
export function sourceFlowWriteValue(build: SourceFlowConstruction, reference: Node,
  value: SourceBindingWriteValue | undefined): SourceBindingWriteValue | undefined;
export function sourceFlowWriteValue(build: SourceFlowConstruction, reference: Node,
  value: SourceBindingWriteValue | undefined): SourceBindingWriteValue | undefined {
  if (value === undefined) return undefined;
  const selected = sourceBindingWriteAtReference(build.source.ast, reference)?.values.find(candidate =>
    candidate.kind === value.kind && candidate.expression === value.expression &&
    candidate.projection.length === value.projection.length &&
    candidate.projection.every((part, index) => part === value.projection[index]));
  if (selected === undefined) throw new SourceFlowFailure("Source flow requires the identical original checked write value and projection.", reference);
  return selected;
}

export function sourceFlowReference(build: SourceFlowConstruction, node: Node, next: number,
  context: SourceFlowContext, read: boolean): number {
  node = sourceFlowUnwrap(build, node);
  const { ast } = build.source;
  if (ast.is.IsIdentifier(node)) return read ? build.expression(node, next, context) : next;
  if (ast.is.IsPropertyAccessExpression(node)) {
    const access = ast.as.AsPropertyAccessExpression(node);
    if (access?.Expression === undefined || access.QuestionDotToken !== undefined) {
      throw new SourceFlowFailure("Source flow requires a checked non-optional assignment receiver.", node);
    }
    return build.expression(access.Expression, read ? build.emit(node, { kind: "evaluate" }, next, context, true) : next, context);
  }
  if (ast.is.IsElementAccessExpression(node)) {
    const access = ast.as.AsElementAccessExpression(node);
    if (access?.Expression === undefined || access.ArgumentExpression === undefined || access.QuestionDotToken !== undefined) {
      throw new SourceFlowFailure("Source flow requires a checked non-optional indexed assignment.", node);
    }
    let entry = read ? build.emit(node, { kind: "evaluate" }, next, context, true) : next;
    entry = build.expression(access.ArgumentExpression, entry, context);
    return build.expression(access.Expression, entry, context);
  }
  throw new SourceFlowFailure("Source flow requires a checked assignment reference.", node);
}

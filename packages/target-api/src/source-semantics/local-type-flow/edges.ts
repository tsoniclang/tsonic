import type { Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, SpreadAssignment_Expression, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { sourceTypeFlowTypeSyntax } from "./value-syntax.js";
import { sourceApplicationStaticReceiver } from "./application-references.js";
import { sourceTypeFlowBinaryOperators, sourceTypeFlowUnaryOperators } from "./operators.js";
import type { SourceRefusal } from "../../public/source/contracts.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowCall, SourceTypeFlowDerived, SourceTypeFlowGraph,
  SourceTypeFlowLink, SourceTypeFlowNode, SourceTypeFlowOperator, SourceTypeFlowPathPart,
  SourceTypeFlowProducerInput, SourceTypeFlowTerm, SourceTypeFlowVariable } from "./types.js";

export function collectSourceTypeFlowEdges(context: SourceTypeFlowAnalysisContext): SourceTypeFlowGraph {
  const { ast, navigation, input } = context.source;
  const roots = new Set<Node>();
  const records = new Map<Node, SourceTypeFlowNode>();
  const positions: SourceTypeFlowNode[] = [];
  const projected = new Set<SourceTypeFlowVariable>();
  const links: SourceTypeFlowLink[] = [];
  const producerInputs: SourceTypeFlowProducerInput[] = [];
  const derived: SourceTypeFlowDerived[] = [];
  const calls: SourceTypeFlowCall[] = [];
  const refusals: SourceRefusal[] = [];
  const variables = new WeakMap<Node, Map<string, SourceTypeFlowVariable>>();
  const pending = new Set<Node>();
  const values = new Set(context.values);

  function variable(node: Node, path: readonly SourceTypeFlowPathPart[] = []): SourceTypeFlowVariable {
    const key = path.map(part => part.kind === "member" ? `${part.kind}:${part.name}` : part.kind === "tuple" ? `${part.kind}:${part.index}`
      : part.kind === "binder" ? `${part.kind}:${context.order(part.declaration).preorder}` : part.kind).join("/");
    let entries = variables.get(node);
    if (entries === undefined) { entries = new Map(); variables.set(node, entries); }
    const previous = entries.get(key);
    if (previous !== undefined) return previous;
    const result = Object.freeze({ node, path: Object.freeze([...path]) });
    entries.set(key, result);
    return result;
  }

  function region(node: Node): Node {
    const result = navigation.enclosing(node, "execution") ?? ast.getSourceFile(node);
    if (result === undefined) throw new Error("An enrolled Source graph occurrence requires its original execution region.");
    roots.add(result);
    return result;
  }

  function record(node: Node, kind: SourceTypeFlowNode["kind"], term?: SourceTypeFlowTerm,
    declaration?: Node, initializer?: Node): SourceTypeFlowVariable {
    const selected = variable(node);
    const previous = records.get(node);
    records.set(node, Object.freeze({ ...(previous ?? {}), node, root: region(node), variable: selected, kind,
      publish: values.has(node), ...(term === undefined ? {} : { term }),
      ...(declaration === undefined ? {} : { declaration }), ...(initializer === undefined ? {} : { initializer }) }));
    return selected;
  }

  function project(source: SourceTypeFlowVariable, part: SourceTypeFlowPathPart): SourceTypeFlowVariable {
    const result = variable(source.node, [...source.path, part]);
    if (!projected.has(result)) {
      projected.add(result);
      positions.push({ node: source.node, root: region(source.node), variable: result, kind: "value", publish: false });
    }
    return result;
  }

  function connect(source: SourceTypeFlowVariable, target: SourceTypeFlowVariable, site: Node): void {
    if (region(source.node) === region(target.node)) links.push({ source, target, site });
    else producerInputs.push({ source, target, site, purpose: "value" });
  }

  function original(node: Node, declaration?: Node): SourceTypeFlowVariable {
    return record(node, declaration === undefined ? "fixed" : "parameter", { kind: "original", site: node, component: input.syntax(node) }, declaration);
  }

  function declaration(node: Node): SourceTypeFlowVariable {
    const previous = records.get(node);
    if (previous !== undefined) return previous.variable;
    const initializer = Node_Initializer(ast, node), annotation = ast.typeNode(node);
    const result = record(node, annotation === undefined ? "open-local" : "fixed", annotation === undefined ? undefined
      : { kind: "original", site: node, component: input.syntax(annotation) }, node, initializer);
    if (initializer !== undefined) connect(value(initializer), result, node);
    return result;
  }

  function operation(node: Node, operator: SourceTypeFlowOperator, operands: readonly Node[], control?: Node): SourceTypeFlowVariable {
    const result = record(node, "derived-local");
    const inputs = operands.map(value);
    derived.push({ node, result, operator, operands: inputs, ...(control === undefined ? {} : { control: value(control) }),
      required: navigation.expressionResultUse(node) === "consumed" });
    return result;
  }

  function value(node: Node): SourceTypeFlowVariable {
    const previous = records.get(node);
    if (previous !== undefined) return previous.variable;
    if (pending.has(node)) return variable(node);
    pending.add(node);
    try {
      if (ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node) || ast.is.IsPropertyDeclaration(node)) return declaration(node);
      if (ast.is.IsParameterDeclaration(node)) return original(node, node);
      if (ast.is.IsIdentifier(node) || ast.kindName(node) === "KindThisKeyword") {
        const selected = navigation.sourceReferenceFor(node)?.declaration;
        if (selected !== undefined && selected !== node && (ast.is.IsVariableDeclaration(selected) || ast.is.IsBindingElement(selected) ||
          ast.is.IsPropertyDeclaration(selected) || ast.is.IsParameterDeclaration(selected))) {
          const result = record(node, "read", undefined, selected);
          connect(value(selected), result, node);
          return result;
        }
        return original(node);
      }
      const transparent = sourceTransparentExpressionOperand(ast, node);
      if (transparent !== undefined && !ast.is.IsAsExpression(node) && !ast.is.IsTypeAssertion(node)) {
        const result = record(node, "read");
        connect(value(transparent), result, node);
        return result;
      }
      const literal = context.literal(node);
      if (ast.is.IsNumericLiteral(node) && literal !== undefined) {
        return record(node, "value", { kind: "numeric", site: node,
          form: literal.integer !== undefined || literal.integerConstant !== undefined ? "integer" : "fractional", literal });
      }
      if (ast.is.IsArrayLiteralExpression(node)) {
        const result = record(node, "value"), element = project(result, { kind: "element" });
        record(node, "value", { kind: "array", site: node, element, readonly: false });
        for (const child of ast.elements(node)) {
          if (child === undefined || ast.is.IsOmittedExpression(child)) continue;
          const spread = ast.is.IsSpreadElement(child) ? Node_Expression(ast, child) : undefined;
          const source = value(spread ?? child);
          producerInputs.push({ source: spread === undefined ? source : project(source, { kind: "element" }), target: element, site: child, purpose: "value" });
        }
        return result;
      }
      if (ast.is.IsObjectLiteralExpression(node)) {
        const result = record(node, "value"), inputs: SourceTypeFlowVariable[] = [];
        for (const property of ast.properties(node)) {
          if (property === undefined) continue;
          const spread = SpreadAssignment_Expression(ast, property);
          if (spread !== undefined) { inputs.push(value(spread)); continue; }
          const initializer = ObjectLiteralProperty_Value(ast, property) ?? (navigation.callableRoles(property).signature ? property : undefined);
          if (initializer !== undefined) inputs.push(value(initializer));
        }
        record(node, "value", { kind: "construction", site: node, inputs });
        return result;
      }
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        const form = context.source.admission.form(node);
        if (form.kind === "refused") {
          refusals.push(form);
          return record(node, "derived-local");
        }
        const result = record(node, "derived-local");
        const selection = input.application(node);
        calls.push({ node, selection, result });
        const candidates = selection.kind === "applicable" ? [selection.selection] : selection.kind === "conditional-candidates" ? selection.candidates : [];
        for (const candidate of candidates) {
          value(candidate.application.callee.occurrence);
          if (candidate.application.receiver?.role === "value" && sourceApplicationStaticReceiver(context.source, candidate.application) === undefined) {
            value(candidate.application.receiver.occurrence);
          }
          for (const argument of candidate.sourceArguments) value(argument.expression);
        }
        return result;
      }
      if (ast.is.IsConditionalExpression(node)) {
        const selected = ast.as.AsConditionalExpression(node);
        if (selected?.Condition !== undefined && selected.WhenTrue !== undefined && selected.WhenFalse !== undefined) {
          return operation(node, "conditional", [selected.WhenTrue, selected.WhenFalse], selected.Condition);
        }
      }
      if (ast.is.IsBinaryExpression(node)) {
        const selected = ast.as.AsBinaryExpression(node), operator = sourceTypeFlowBinaryOperators.get(ast.operatorKindName(node) ?? "");
        if (selected?.Left !== undefined && selected.Right !== undefined && operator !== undefined) return operation(node, operator, [selected.Left, selected.Right]);
      }
      if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
        const operand = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand : ast.as.AsPostfixUnaryExpression(node)?.Operand;
        const operator = sourceTypeFlowUnaryOperators.get(ast.operatorKindName(node) ?? "");
        if (operand !== undefined && operator !== undefined) return operation(node, operator, [operand]);
      }
      if (ast.is.IsAwaitExpression(node)) {
        const operand = Node_Expression(ast, node);
        if (operand !== undefined) return operation(node, "await", [operand]);
      }
      return original(node);
    } finally { pending.delete(node); }
  }

  for (const node of context.nodes) {
    if (sourceTypeFlowTypeSyntax(ast, node)) continue;
    if (ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node) || ast.is.IsPropertyDeclaration(node)) declaration(node);
    if (values.has(node)) value(node);
  }
  return Object.freeze({ roots: Object.freeze([...roots]), nodes: Object.freeze([...records.values(), ...positions]),
    links: Object.freeze(links), producerInputs: Object.freeze(producerInputs), derived: Object.freeze(derived),
    calls: Object.freeze(calls), refusals: Object.freeze(refusals) });
}

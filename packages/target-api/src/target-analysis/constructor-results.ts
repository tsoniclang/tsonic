import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { AsBinaryExpression, AsConditionalExpression, AsIfStatement, AsVariableStatement,
  AsVariableDeclarationList, Node_Expression, Node_Initializer, forEachSourceImmediateEvaluationChild,
  isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceEnclosingCallable } from "../source-navigation/index.js";

export interface SourceConstructorResultIssue {
  readonly code: "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED" | "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN";
  readonly category: "error";
  readonly source: "tsonic";
  readonly sourceNode?: Node;
  readonly message: string;
}

export function analyzeSourceConstructorResults(
  source: TargetSourceProgram,
): readonly SourceConstructorResultIssue[] {
  const issues: SourceConstructorResultIssue[] = [];
  const { ast } = source;
  const constructors: Node[] = [...source.sourceFiles];
  while (constructors.length > 0) {
    const node = constructors.pop()!;
    if (ast.is.IsConstructorDeclaration(node)) {
      const body = ast.body(node);
      if (body !== undefined) analyzeConstructor(node, body);
    }
    ast.forEachChild(node, child => { if (child !== undefined) constructors.push(child); });
  }
  return Object.freeze(issues);

  function analyzeConstructor(declaration: Node, body: Node): void {
    const join = (left: ConstructorValue, right: ConstructorValue): ConstructorValue =>
      left === right || right === "never" ? left : left === "never" ? right :
        left === "unknown" || right === "unknown" ? "unknown" : "substitute";
    const merge = (target: ConstructorBindings, left: ConstructorBindings, right: ConstructorBindings): void => {
      const entries = [...new Set([...left.keys(), ...right.keys()])]
        .map(binding => [binding, join(left.get(binding) ?? "unknown", right.get(binding) ?? "unknown")] as const);
      target.clear();
      for (const [binding, value] of entries) target.set(binding, value);
    };
    const binding = (node: Node | undefined): Node | undefined => node !== undefined && ast.is.IsIdentifier(node)
      ? source.navigation.sourceReferenceFor(node)?.declaration : undefined;
    const deferredWrites = new Set<Node>();
    const collectDeferredWrites = (node: Node): void => {
      const selected = binding(node);
      if (selected !== undefined && sourceEnclosingCallable(selected, ast) === declaration &&
        sourceEnclosingCallable(node, ast) !== declaration && sourceBindingWriteAtReference(ast, node) !== undefined) {
        deferredWrites.add(selected);
      }
      ast.forEachChild(node, child => { if (child !== undefined) collectDeferredWrites(child); });
    };
    collectDeferredWrites(body);
    const invalidateWrites = (node: Node, bindings: ConstructorBindings): void => {
      if (isSourceCallableBodyBoundary(ast, node) || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) return;
      const selected = binding(node);
      const write = selected === undefined ? undefined : sourceBindingWriteAtReference(ast, node);
      if (selected !== undefined && write !== undefined && write.kind !== "initialization" &&
        write.values.some(value => value.projection.length === 0)) bindings.set(selected, "unknown");
      ast.forEachChild(node, child => { if (child !== undefined) invalidateWrites(child, bindings); });
    };
    const expression = (node: Node, bindings: ConstructorBindings, inspectInitializer = true): ConstructorValue => {
      if (ast.kindName(node) === "KindThisKeyword") return sourceEnclosingCallable(node, ast) === declaration ? "receiver" : "unknown";
      if (ast.is.IsParenthesizedExpression(node) || ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node) ||
        ast.is.IsSatisfiesExpression(node) || ast.is.IsNonNullExpression(node)) {
        const inner = Node_Expression(ast, node);
        return inner === undefined ? "unknown" : expression(inner, bindings, inspectInitializer);
      }
      if (ast.is.IsIdentifier(node)) {
        const selected = binding(node);
        if (selected !== undefined && bindings.has(selected)) return bindings.get(selected)!;
        const initializer = selected !== undefined && ast.is.IsVariableDeclaration(selected) ? Node_Initializer(ast, selected) : undefined;
        if (inspectInitializer && initializer !== undefined) return expression(initializer, new Map(), false);
        const types = source.semantics.forNode(node).types;
        const type = types.expressionType(node);
        return initializer === undefined && type !== undefined && types.isNever(type) ? "never" : "unknown";
      }
      const conditional = AsConditionalExpression(ast, node);
      if (conditional?.Condition !== undefined && conditional.WhenTrue !== undefined && conditional.WhenFalse !== undefined) {
        if (expression(conditional.Condition, bindings) === "never") return "never";
        const yes = new Map(bindings), no = new Map(bindings);
        const result = join(expression(conditional.WhenTrue, yes), expression(conditional.WhenFalse, no));
        merge(bindings, yes, no);
        return result;
      }
      const binary = AsBinaryExpression(ast, node);
      if (binary?.Left !== undefined && binary.Right !== undefined) {
        const left = expression(binary.Left, bindings);
        if (left === "never") return "never";
        const operator = ast.operatorKindName(node);
        const optional = operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken" ||
          operator === "KindQuestionQuestionToken";
        const rightBindings = optional ? new Map(bindings) : bindings;
        const value = expression(binary.Right, rightBindings);
        if (optional) merge(bindings, bindings, rightBindings);
        if (optional) return join(left, value);
        if (value === "never") return "never";
        if (operator === "KindEqualsToken") {
          const selected = binding(binary.Left);
          if (selected !== undefined) bindings.set(selected, value);
          return value;
        }
        if (operator === "KindCommaToken") return value;
        invalidateWrites(node, bindings);
        return "unknown";
      }
      let never = false;
      forEachSourceImmediateEvaluationChild(ast, node, child => { if (!never) never = expression(child, bindings) === "never"; });
      if (never) return "never";
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        for (const selected of deferredWrites) bindings.set(selected, "unknown");
      }
      if (ast.is.IsObjectLiteralExpression(node) || ast.is.IsArrayLiteralExpression(node) || ast.is.IsNewExpression(node) ||
        ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node) || ast.is.IsClassExpression(node)) return "substitute";
      const types = source.semantics.forNode(node).types;
      const type = types.expressionType(node);
      return type !== undefined && types.isNever(type) ? "never" : "unknown";
    };
    const statement = (node: Node, bindings: ConstructorBindings): boolean => {
      if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
        expression(node, bindings);
        return true;
      }
      if (isSourceCallableBodyBoundary(ast, node)) return true;
      if (ast.is.IsBlock(node)) {
        for (const child of ast.statements(node)) if (child !== undefined && !statement(child, bindings)) return false;
      } else if (ast.is.IsReturnStatement(node)) {
        const returned = Node_Expression(ast, node);
        const value = returned === undefined ? "receiver" : expression(returned, bindings);
        if (value === "substitute" || value === "unknown") issues.push(Object.freeze({
          code: value === "substitute" ? "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED" : "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN",
          category: "error", source: "tsonic", sourceNode: returned,
          message: value === "substitute" ? "A constructor that returns an object other than its receiver is not supported." :
            "Constructor result receiver identity is not proven: The returned expression is not locally established as the constructor receiver.",
        }));
        return false;
      } else if (ast.is.IsThrowStatement(node)) {
        return false;
      } else if (ast.is.IsVariableStatement(node)) {
        const list = AsVariableStatement(ast, node)?.DeclarationList;
        for (const selected of AsVariableDeclarationList(ast, list)?.Declarations?.Nodes ?? []) {
          if (selected === undefined) continue;
          const initializer = Node_Initializer(ast, selected);
          const value = initializer === undefined ? "unknown" : expression(initializer, bindings);
          if (value === "never") return false;
          bindings.set(selected, value);
        }
      } else if (ast.is.IsExpressionStatement(node)) {
        const selected = Node_Expression(ast, node);
        if (selected !== undefined && expression(selected, bindings) === "never") return false;
      } else if (ast.is.IsIfStatement(node)) {
        const selected = AsIfStatement(ast, node)!;
        if (selected.Expression !== undefined && expression(selected.Expression, bindings) === "never") return false;
        const yes = new Map(bindings), no = new Map(bindings);
        const yesContinues = selected.ThenStatement === undefined || statement(selected.ThenStatement, yes);
        const noContinues = selected.ElseStatement === undefined || statement(selected.ElseStatement, no);
        if (yesContinues && noContinues) merge(bindings, yes, no);
        else if (yesContinues || noContinues) merge(bindings, yesContinues ? yes : no, yesContinues ? yes : no);
        else return false;
      } else {
        invalidateWrites(node, bindings);
        forEachSourceImmediateEvaluationChild(ast, node, child => { statement(child, new Map(bindings)); });
      }
      return true;
    };
    statement(body, new Map());
  }
}

type ConstructorValue = "receiver" | "substitute" | "never" | "unknown";
type ConstructorBindings = Map<Node, ConstructorValue>;

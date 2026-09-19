import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../types.js";
import { Node_Expression, Node_Initializer } from "../ast.js";
import { binaryIntegerRange, integerRange, joinIntegerRanges } from "./domain.js";
import type { SourceIntegerRange } from "./domain.js";

export interface SourceIntegerRangeOptions {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly sourceFiles: readonly SourceFile[];
  isNumber(expression: Node): boolean;
}

export interface SourceIntegerRangeQueries {
  readonly exactInt32Remainders: readonly Node[];
  range(expression: Node): SourceIntegerRange | undefined;
}

type Environment = Map<Node, SourceIntegerRange>;

export function analyzeSourceIntegerRanges(options: SourceIntegerRangeOptions): SourceIntegerRangeQueries {
  const ranges = new WeakMap<Node, SourceIntegerRange>();
  const candidates: Node[] = [];
  const { ast } = options;
  const callables = new Set<Node>();
  const pending: { readonly node: Node; readonly owner?: Node }[] = options.sourceFiles.map(node => ({ node }));
  while (pending.length > 0) {
    const current = pending.pop()!;
    const { node } = current;
    const owner = callableKinds.has(ast.kindName(node)) ? node : current.owner;
    if (owner !== undefined && ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindPercentToken") callables.add(owner);
    ast.forEachChild(node, child => { if (child !== undefined) pending.push({ node: child, owner }); });
  }
  for (const callable of callables) {
    const analysis = new CallableIntegerRanges(options);
    for (const [expression, range] of analysis.analyze(callable)) {
      ranges.set(expression, range);
      if (ast.is.IsBinaryExpression(expression) && ast.operatorKindName(expression) === "KindPercentToken") candidates.push(expression);
    }
  }
  const exactInt32Remainders = candidates.filter(expression => {
      const binary = ast.as.AsBinaryExpression(expression);
      const left = binary?.Left === undefined ? undefined : ranges.get(binary.Left);
      const right = binary?.Right === undefined ? undefined : ranges.get(binary.Right);
      return ranges.has(expression) && left !== undefined && right !== undefined &&
        left.minimum >= 0 && left.maximum <= 2_147_483_647 &&
        right.minimum > 0 && right.maximum <= 2_147_483_647;
  });
  return Object.freeze({
    range: (expression: Node) => ranges.get(expression),
    exactInt32Remainders: Object.freeze(exactInt32Remainders),
  });
}

class CallableIntegerRanges {
  readonly #options: SourceIntegerRangeOptions;
  readonly #ranges = new Map<Node, SourceIntegerRange>();
  readonly #safeBindings = new Map<Node, boolean>();
  #remaining = 16_384;
  #abandoned = false;

  constructor(options: SourceIntegerRangeOptions) { this.#options = options; }

  analyze(callable: Node): ReadonlyMap<Node, SourceIntegerRange> {
    const body = this.#options.ast.body(callable);
    if (body !== undefined) {
      if (this.#options.ast.is.IsBlock(body)) this.statement(body, new Map(), 0);
      else this.expression(body, new Map(), 0);
    }
    return this.#abandoned ? new Map() : this.#ranges;
  }

  private enter(depth: number): boolean {
    if (depth > 128 || --this.#remaining < 0) this.#abandoned = true;
    return !this.#abandoned;
  }

  private safeBinding(declaration: Node): boolean {
    const cached = this.#safeBindings.get(declaration);
    if (cached !== undefined) return cached;
    const summary = this.#options.navigation.declarationUseSummary(declaration);
    const safe = this.#options.ast.is.IsVariableDeclaration(declaration) &&
      !summary.captured && !summary.exported && !summary.memberWritten &&
      !summary.uses.some(use => use.role === "argument" || use.role === "yield");
    this.#safeBindings.set(declaration, safe);
    return safe;
  }

  private declaration(reference: Node | undefined): Node | undefined {
    const { ast } = this.#options;
    while (reference !== undefined && transparentKinds.has(ast.kindName(reference))) reference = Node_Expression(ast, reference);
    return reference === undefined || !ast.is.IsIdentifier(reference)
      ? undefined : this.#options.navigation.sourceReferenceFor(reference)?.declaration;
  }

  private bind(declaration: Node | undefined, range: SourceIntegerRange | undefined, environment: Environment): void {
    if (declaration === undefined) return;
    if (range !== undefined && this.safeBinding(declaration)) environment.set(declaration, range);
    else environment.delete(declaration);
  }

  private expression(node: Node, environment: Environment, depth: number): SourceIntegerRange | undefined {
    if (!this.enter(depth)) return undefined;
    const { ast } = this.#options;
    const kind = ast.kindName(node);
    if (callableKinds.has(kind)) return undefined;
    let range: SourceIntegerRange | undefined;
    if (ast.is.IsNumericLiteral(node)) {
      const text = ast.text(node);
      range = text === undefined ? undefined : integerRange(Number(text.replace(/_/gu, "")));
    } else if (ast.is.IsIdentifier(node)) {
      const declaration = this.declaration(node);
      range = declaration === undefined ? undefined : environment.get(declaration);
    } else if (transparentKinds.has(kind)) {
      const inner = Node_Expression(ast, node);
      range = inner === undefined ? undefined : this.expression(inner, environment, depth + 1);
    } else if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node);
      const operator = ast.operatorKindName(node);
      if (binary?.Left === undefined || binary.Right === undefined) return undefined;
      if (conditionalKinds.has(operator ?? "")) {
        this.expression(binary.Left, environment, depth + 1);
        const optional = new Map(environment);
        this.expression(binary.Right, optional, depth + 1);
        this.merge(environment, optional, environment);
        if (assignmentKinds.has(operator ?? "")) this.bind(this.declaration(binary.Left), undefined, environment);
        return undefined;
      }
      const left = this.expression(binary.Left, environment, depth + 1);
      const right = this.expression(binary.Right, environment, depth + 1);
      if (operator === "KindEqualsToken") {
        const declaration = this.declaration(binary.Left);
        if (declaration === undefined) environment.clear();
        else this.bind(declaration, right, environment);
        range = right;
      } else if (assignmentKinds.has(operator ?? "")) {
        const declaration = this.declaration(binary.Left);
        if (declaration === undefined) environment.clear();
        else this.bind(declaration, undefined, environment);
      } else if (left !== undefined && right !== undefined && operator !== undefined) {
        range = binaryIntegerRange(operator, left, right);
      }
    } else if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const operand = ast.is.IsPrefixUnaryExpression(node)
        ? ast.as.AsPrefixUnaryExpression(node)?.Operand : ast.as.AsPostfixUnaryExpression(node)?.Operand;
      const value = operand === undefined ? undefined : this.expression(operand, environment, depth + 1);
      const operator = ast.operatorKindName(node);
      if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
        const next = value === undefined ? undefined : binaryIntegerRange(
          operator === "KindPlusPlusToken" ? "KindPlusToken" : "KindMinusToken", value, integerRange(1)!);
        this.bind(this.declaration(operand), next, environment);
        range = ast.is.IsPrefixUnaryExpression(node) ? next : value;
      } else if (operator === "KindPlusToken") range = value;
      else if (operator === "KindMinusToken" && value !== undefined && (value.minimum > 0 || value.maximum < 0)) {
        range = integerRange(-value.maximum, -value.minimum);
      }
    } else {
      this.invalidateWrites(node, environment, depth + 1);
      return undefined;
    }
    if (range !== undefined && this.#options.isNumber(node)) this.#ranges.set(node, range);
    else range = undefined;
    return range;
  }

  private statement(node: Node, environment: Environment, depth: number): boolean {
    if (!this.enter(depth)) return false;
    const { ast } = this.#options;
    if (ast.is.IsBlock(node)) {
      for (const statement of ast.statements(node)) if (statement !== undefined && !this.statement(statement, environment, depth + 1)) return false;
      return true;
    }
    if (ast.is.IsVariableStatement(node)) {
      const list = ast.as.AsVariableStatement(node)?.DeclarationList;
      if (list !== undefined && ast.is.IsVariableDeclarationList(list)) for (const declaration of ast.as.AsVariableDeclarationList(list)?.Declarations?.Nodes ?? []) {
        const initializer = Node_Initializer(ast, declaration);
        this.bind(declaration, initializer === undefined ? undefined : this.expression(initializer, environment, depth + 1), environment);
      }
    } else if (ast.is.IsExpressionStatement(node)) {
      const expression = Node_Expression(ast, node);
      if (expression !== undefined) this.expression(expression, environment, depth + 1);
    } else if (ast.is.IsReturnStatement(node) || ast.is.IsThrowStatement(node)) {
      const expression = Node_Expression(ast, node);
      if (expression !== undefined) this.expression(expression, environment, depth + 1);
      return false;
    } else if (ast.is.IsIfStatement(node)) {
      const conditional = ast.as.AsIfStatement(node);
      if (conditional?.Expression !== undefined) this.expression(conditional.Expression, environment, depth + 1);
      const yes = new Map(environment);
      const no = new Map(environment);
      const yesContinues = conditional?.ThenStatement === undefined || this.statement(conditional.ThenStatement, yes, depth + 1);
      const noContinues = conditional?.ElseStatement === undefined || this.statement(conditional.ElseStatement, no, depth + 1);
      if (yesContinues && noContinues) this.merge(yes, no, environment);
      else if (yesContinues || noContinues) this.replace(environment, yesContinues ? yes : no);
      else return false;
    } else if (ast.is.IsForStatement(node)) {
      this.loop(node, environment, depth + 1);
    } else if (!callableKinds.has(ast.kindName(node)) && ast.kindName(node) !== "KindEmptyStatement") {
      environment.clear();
    }
    return true;
  }

  private loop(node: Node, environment: Environment, depth: number): void {
    const { ast } = this.#options;
    const loop = ast.as.AsForStatement(node);
    const bodyEnvironment = new Map(environment);
    this.invalidateWrites(node, bodyEnvironment, depth + 1);
    this.invalidateWrites(node, environment, depth + 1);
    if (loop?.Initializer === undefined || loop.Condition === undefined || loop.Incrementor === undefined ||
      loop.Statement === undefined || !ast.is.IsVariableDeclarationList(loop.Initializer) ||
      ast.variableDeclarationKind(loop.Initializer) !== "let") return;
    const declarations = ast.as.AsVariableDeclarationList(loop.Initializer)?.Declarations?.Nodes;
    const counter = declarations?.length === 1 ? declarations[0] : undefined;
    const startNode = counter === undefined ? undefined : Node_Initializer(ast, counter);
    const start = startNode === undefined ? undefined : this.expression(startNode, bodyEnvironment, depth + 1);
    const increment = ast.is.IsPostfixUnaryExpression(loop.Incrementor)
      ? ast.as.AsPostfixUnaryExpression(loop.Incrementor)?.Operand
      : ast.is.IsPrefixUnaryExpression(loop.Incrementor) ? ast.as.AsPrefixUnaryExpression(loop.Incrementor)?.Operand : undefined;
    if (counter === undefined || !this.safeBinding(counter) || start === undefined || start.minimum !== start.maximum ||
      start.minimum < 0 || ast.operatorKindName(loop.Incrementor) !== "KindPlusPlusToken" ||
      this.declaration(increment) !== counter || !ast.is.IsBinaryExpression(loop.Condition)) return;
    const condition = ast.as.AsBinaryExpression(loop.Condition);
    const operator = ast.operatorKindName(loop.Condition);
    if (condition?.Left === undefined || condition.Right === undefined ||
      (operator !== "KindLessThanToken" && operator !== "KindLessThanEqualsToken")) return;
    const bound = this.expression(condition.Right, bodyEnvironment, depth + 1);
    if (bound === undefined || bound.maximum >= Number.MAX_SAFE_INTEGER) return;
    let maximum = bound.maximum - (operator === "KindLessThanToken" ? 1 : 0);
    if (this.declaration(condition.Left) !== counter) {
      const square = ast.is.IsBinaryExpression(condition.Left) ? ast.as.AsBinaryExpression(condition.Left) : undefined;
      if (square === undefined || ast.operatorKindName(condition.Left) !== "KindAsteriskToken" ||
        this.declaration(square.Left) !== counter || this.declaration(square.Right) !== counter || maximum > 2_147_483_647) return;
      maximum = Math.floor(Math.sqrt(maximum));
    }
    const range = integerRange(start.minimum, maximum);
    if (range === undefined) return;
    const writes = new Map<Node, SourceIntegerRange>([[counter, range]]);
    this.invalidateWrites(loop.Statement, writes, depth + 1);
    if (!writes.has(counter)) return;
    bodyEnvironment.set(counter, range);
    this.statement(loop.Statement, bodyEnvironment, depth + 1);
  }

  private invalidateWrites(node: Node, environment: Environment, depth: number): void {
    if (!this.enter(depth)) return;
    const { ast } = this.#options;
    if (callableKinds.has(ast.kindName(node))) return;
    if (ast.is.IsVariableDeclaration(node) && Node_Initializer(ast, node) !== undefined) {
      const parent = ast.parent(node);
      if (parent === undefined || ast.variableDeclarationKind(parent) === "var") environment.clear();
      else environment.delete(node);
    }
    const operator = ast.operatorKindName(node);
    const target = ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node)
      ? ast.as.AsForInOrOfStatement(node)?.Initializer
      : ast.is.IsBinaryExpression(node) && assignmentKinds.has(operator ?? "")
      ? ast.as.AsBinaryExpression(node)?.Left
      : operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken"
        ? ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand
          : ast.is.IsPostfixUnaryExpression(node) ? ast.as.AsPostfixUnaryExpression(node)?.Operand : undefined
        : undefined;
    if (target !== undefined) {
      if (ast.is.IsIdentifier(target)) {
        const declaration = this.declaration(target);
        if (declaration !== undefined) environment.delete(declaration);
      } else environment.clear();
    }
    ast.forEachChild(node, child => { if (child !== undefined) this.invalidateWrites(child, environment, depth + 1); });
  }

  private merge(left: Environment, right: Environment, output: Environment): void {
    const merged: Environment = new Map();
    for (const [declaration, value] of left) {
      const joined = joinIntegerRanges(value, right.get(declaration));
      if (joined !== undefined) merged.set(declaration, joined);
    }
    this.replace(output, merged);
  }

  private replace(output: Environment, input: Environment): void {
    output.clear();
    for (const [declaration, value] of input) output.set(declaration, value);
  }
}

const callableKinds = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration"]);
const transparentKinds = new Set(["KindParenthesizedExpression", "KindAsExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindTypeAssertion"]);
const conditionalKinds = new Set(["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken",
  "KindAmpersandAmpersandEqualsToken", "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken"]);
const assignmentKinds = new Set(["KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken", "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken", "KindAmpersandEqualsToken",
  "KindBarEqualsToken", "KindCaretEqualsToken", "KindBarBarEqualsToken", "KindAmpersandAmpersandEqualsToken", "KindQuestionQuestionEqualsToken"]);

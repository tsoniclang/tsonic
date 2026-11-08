import type { Node } from "@tsonic/tsts";
import { sourceBooleanLiteralDisposition } from "../../source-model/literals/domain.js";
import type { SourceOperation, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-semantics/descriptor-contracts.js";
import type { SourceGuardContext } from "../../source-semantics/value-flow-model.js";
import { sourcePrimitiveIntegerBounds } from "../../source-semantics/local-type-flow/operator-decisions.js";
import { sourceBindingHasMutableExposure } from "../binding-mutation-exposure.js";
import { Node_Expression, Node_Initializer } from "../ast.js";
import { binaryIntegerRange, exactIntegerRange, integerRange, integerSquareRoot, joinIntegerRanges, sourceIntegerScalar } from "./domain.js";
import type { SourceIntegerArithmetic, SourceIntegerRange } from "./domain.js";

export interface SourceIntegerRangeOptions extends Pick<SourceGuardContext, "ast" | "navigation" | "protocols" | "view" | "syntaxDomain" | "enclosing"> {
  value(expression: Node): SourceProductionResult<SourceTypeEvidence>;
  operation(expression: Node): SourceProductionResult<SourceOperation>;
}

export interface SourceIntegerRangeQueries {
  range(expression: Node): SourceProductionResult<SourceIntegerRange | undefined>;
}

type Environment = Map<Node, SourceIntegerRange>;

export function createSourceIntegerRangeQueries(options: SourceIntegerRangeOptions): SourceIntegerRangeQueries {
  const completed = new WeakMap<Node, ReadonlyMap<Node, SourceIntegerRange>>();
  return Object.freeze({
    range(expression: Node): SourceProductionResult<SourceIntegerRange | undefined> {
      if (!options.navigation.includes(expression)) throw new Error("Integer ranges require an original occurrence from this Source program.");
      let remaining = 2_048;
      const callable = options.enclosing(expression, "body", () => --remaining >= 0);
      if (callable === undefined) return Object.freeze({ kind: "resolved", value: undefined });
      let ranges = completed.get(callable);
      if (ranges === undefined) {
        const analyzed = new CallableIntegerRanges(options).analyze(callable);
        if (analyzed.kind !== "resolved") return analyzed;
        ranges = analyzed.value;
        completed.set(callable, ranges);
      }
      return Object.freeze({ kind: "resolved", value: ranges.get(expression) });
    },
  });
}

class CallableIntegerRanges {
  readonly #options: SourceIntegerRangeOptions;
  readonly #ranges = new Map<Node, SourceIntegerRange>();
  readonly #safeBindings = new Map<Node, boolean>();
  readonly #evidence = new Map<Node, SourceTypeEvidence>();
  #incomplete: Exclude<SourceProductionResult<unknown>, { readonly kind: "resolved" }> | undefined;
  #remaining = 16_384;
  #abandoned = false;

  constructor(options: SourceIntegerRangeOptions) { this.#options = options; }

  analyze(callable: Node): SourceProductionResult<ReadonlyMap<Node, SourceIntegerRange>> {
    const body = this.#options.ast.body(callable);
    if (body !== undefined) {
      if (this.#options.ast.is.IsBlock(body)) this.statement(body, new Map(), 0);
      else this.expression(body, new Map(), 0);
    }
    return this.#incomplete ?? Object.freeze({ kind: "resolved", value: this.#abandoned ? new Map() : this.#ranges });
  }

  private enter(depth: number): boolean {
    if (this.#incomplete !== undefined || depth > 128 || --this.#remaining < 0) this.#abandoned = true;
    return !this.#abandoned;
  }

  private safeBinding(declaration: Node): boolean {
    const cached = this.#safeBindings.get(declaration);
    if (cached !== undefined) return cached;
    const parent = this.#options.ast.parent(declaration);
    const declarationKind = parent === undefined ? undefined : this.#options.ast.variableDeclarationKind(parent);
    const summary = this.#options.navigation.declarationUseSummary(declaration);
    let safe = this.#options.ast.is.IsVariableDeclaration(declaration) &&
      (declarationKind === "let" || declarationKind === "const") &&
      !summary.captured && !summary.exported && !summary.memberWritten &&
      !summary.uses.some(use => use.role === "argument" || use.role === "yield");
    if (safe) {
      const exposure = sourceBindingHasMutableExposure(this.#options, summary, () => this.enter(0));
      if (exposure.kind === "refused") { this.#incomplete = exposure; return false; }
      safe = !exposure.value;
    }
    this.#safeBindings.set(declaration, safe);
    return safe;
  }

  private evidence(node: Node): SourceTypeEvidence | undefined {
    const previous = this.#evidence.get(node);
    if (previous !== undefined) return previous;
    const selected = this.#options.value(node);
    if (selected.kind !== "resolved") { this.#incomplete = selected; return undefined; }
    let value = selected.value;
    const visited = new Set<SourceTypeEvidence>();
    while (value.type.kind === "declared") {
      if (!this.enter(0) || visited.has(value)) return undefined;
      visited.add(value);
      const definition = this.#options.view.definition(value);
      if (definition.kind === "refused") { this.#incomplete = definition; return undefined; }
      value = definition.value;
    }
    this.#options.view.assertEvidence(value);
    this.#evidence.set(node, value);
    return value;
  }

  private arithmetic(node: Node): SourceIntegerArithmetic | undefined {
    const value = this.evidence(node);
    if (value?.category.kind !== "known" || value.category.category !== "number" && value.category.category !== "bigint") return undefined;
    if (value.type.kind === "intrinsic" && value.type.intrinsic === "bigint") return "integer";
    if (value.type.kind !== "primitive") return undefined;
    return value.type.primitive === "float64" ? "float64"
      : sourcePrimitiveIntegerBounds(value.type.primitive) !== undefined ? "integer" : undefined;
  }

  private retain(node: Node, range: SourceIntegerRange): SourceIntegerRange | undefined {
    const arithmetic = this.arithmetic(node);
    if (arithmetic === undefined || exactIntegerRange(range, arithmetic) === undefined) return undefined;
    const value = this.evidence(node)!;
    const bounds = value.type.kind === "primitive" ? sourcePrimitiveIntegerBounds(value.type.primitive) : undefined;
    return bounds === undefined || range.minimum >= bounds[0] && range.maximum <= bounds[1] ? range : undefined;
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
    if (this.#options.navigation.callableRoles(node).body) return undefined;
    let range: SourceIntegerRange | undefined;
    if (ast.is.IsNumericLiteral(node) || ast.is.IsBigIntLiteral(node)) {
      const domain = this.#options.syntaxDomain(node);
      if (domain.kind !== "resolved") { this.#incomplete = domain; return undefined; }
      const integer = domain.value.kind === "finite" && domain.value.values.length === 1
        ? sourceIntegerScalar(domain.value.values[0]!) : undefined;
      range = integer === undefined ? undefined : integerRange(integer);
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
        const operation = this.#options.operation(node);
        if (operation.kind !== "resolved") { this.#incomplete = operation; return undefined; }
        const selection = operation.value.kind === "selection-assignment" ? operation.value.selection : operation.value;
        if (selection.kind !== "and" && selection.kind !== "or" && selection.kind !== "coalesce")
          throw new Error("Conditional integer-flow analysis requires the original Source selection.");
        if (selection.disposition === "left") return undefined;
        if (selection.disposition === "right") {
          this.expression(binary.Right, environment, depth + 1);
          if (assignmentKinds.has(operator ?? "")) this.bind(this.declaration(binary.Left), undefined, environment);
          return undefined;
        }
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
        const arithmetic = this.arithmetic(node);
        range = arithmetic === undefined ? undefined : binaryIntegerRange(operator, left, right, arithmetic);
      }
    } else if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const operand = ast.is.IsPrefixUnaryExpression(node)
        ? ast.as.AsPrefixUnaryExpression(node)?.Operand : ast.as.AsPostfixUnaryExpression(node)?.Operand;
      const value = operand === undefined ? undefined : this.expression(operand, environment, depth + 1);
      const operator = ast.operatorKindName(node);
      if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
        const arithmetic = this.arithmetic(node);
        const computed = value === undefined || arithmetic === undefined ? undefined : binaryIntegerRange(
          operator === "KindPlusPlusToken" ? "KindPlusToken" : "KindMinusToken", value, integerRange(1n)!, arithmetic);
        const next = computed === undefined ? undefined : this.retain(node, computed);
        this.bind(this.declaration(operand), next, environment);
        range = ast.is.IsPrefixUnaryExpression(node) ? next : value;
      } else if (operator === "KindPlusToken") range = value;
      else if (operator === "KindMinusToken" && value !== undefined && (value.minimum > 0n || value.maximum < 0n)) {
        range = integerRange(-value.maximum, -value.minimum);
      }
    } else {
      this.invalidateWrites(node, environment, depth + 1);
      return undefined;
    }
    range = range === undefined ? undefined : this.retain(node, range);
    if (range !== undefined) this.#ranges.set(node, range);
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
        const name = ast.name(declaration);
        if (name === undefined || !ast.is.IsIdentifier(name)) {
          environment.clear();
          continue;
        }
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
      if (conditional?.Expression !== undefined) {
        const domain = this.#options.syntaxDomain(conditional.Expression);
        if (domain.kind !== "resolved") { this.#incomplete = domain; return false; }
        const disposition = sourceBooleanLiteralDisposition(domain.value);
        if (disposition !== "dynamic") {
          const selected = disposition === "true" ? conditional.ThenStatement : conditional.ElseStatement;
          return selected === undefined || this.statement(selected, environment, depth + 1);
        }
      }
      const yes = new Map(environment);
      const no = new Map(environment);
      const yesContinues = conditional?.ThenStatement === undefined || this.statement(conditional.ThenStatement, yes, depth + 1);
      const noContinues = conditional?.ElseStatement === undefined || this.statement(conditional.ElseStatement, no, depth + 1);
      if (yesContinues && noContinues) this.merge(yes, no, environment);
      else if (yesContinues || noContinues) this.replace(environment, yesContinues ? yes : no);
      else return false;
    } else if (ast.is.IsForStatement(node)) {
      this.loop(node, environment, depth + 1);
    } else if (!this.#options.navigation.callableRoles(node).body && ast.kindName(node) !== "KindEmptyStatement") {
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
    this.invalidateWrites(loop.Condition, bodyEnvironment, depth + 1);
    this.invalidateWrites(loop.Statement, bodyEnvironment, depth + 1);
    const increment = ast.is.IsPostfixUnaryExpression(loop.Incrementor)
      ? ast.as.AsPostfixUnaryExpression(loop.Incrementor)?.Operand
      : ast.is.IsPrefixUnaryExpression(loop.Incrementor) ? ast.as.AsPrefixUnaryExpression(loop.Incrementor)?.Operand : undefined;
    if (counter === undefined || !this.safeBinding(counter) || start === undefined || start.minimum !== start.maximum ||
      start.minimum < 0n || ast.operatorKindName(loop.Incrementor) !== "KindPlusPlusToken" ||
      this.declaration(increment) !== counter || !ast.is.IsBinaryExpression(loop.Condition)) return;
    const condition = ast.as.AsBinaryExpression(loop.Condition);
    const operator = ast.operatorKindName(loop.Condition);
    if (condition?.Left === undefined || condition.Right === undefined ||
      (operator !== "KindLessThanToken" && operator !== "KindLessThanEqualsToken")) return;
    const bound = this.expression(condition.Right, bodyEnvironment, depth + 1);
    if (bound === undefined) return;
    let maximum = bound.maximum - (operator === "KindLessThanToken" ? 1n : 0n);
    if (this.declaration(condition.Left) !== counter) {
      const square = ast.is.IsBinaryExpression(condition.Left) ? ast.as.AsBinaryExpression(condition.Left) : undefined;
      if (square === undefined || ast.operatorKindName(condition.Left) !== "KindAsteriskToken" ||
        this.declaration(square.Left) !== counter || this.declaration(square.Right) !== counter || maximum > 2_147_483_647n || maximum < 0n) return;
      maximum = integerSquareRoot(maximum);
      const followingSquare = integerRange((maximum + 1n) * (maximum + 1n));
      if (followingSquare === undefined || this.retain(condition.Left, followingSquare) === undefined) return;
    }
    const after = integerRange(maximum + 1n);
    if (after === undefined || this.retain(loop.Incrementor, after) === undefined) return;
    const range = integerRange(start.minimum, maximum);
    if (range === undefined) return;
    const writes = new Map<Node, SourceIntegerRange>([[counter, range]]);
    this.invalidateWrites(loop.Condition, writes, depth + 1);
    this.invalidateWrites(loop.Statement, writes, depth + 1);
    if (!writes.has(counter)) return;
    bodyEnvironment.set(counter, range);
    this.statement(loop.Statement, bodyEnvironment, depth + 1);
  }

  private invalidateWrites(node: Node, environment: Environment, depth: number): void {
    if (!this.enter(depth)) return;
    const { ast } = this.#options;
    if (this.#options.navigation.callableRoles(node).body) return;
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

const transparentKinds = new Set(["KindParenthesizedExpression", "KindAsExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindTypeAssertion"]);
const conditionalKinds = new Set(["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken",
  "KindAmpersandAmpersandEqualsToken", "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken"]);
const assignmentKinds = new Set(["KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken", "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken", "KindAmpersandEqualsToken",
  "KindBarEqualsToken", "KindCaretEqualsToken", "KindBarBarEqualsToken", "KindAmpersandAmpersandEqualsToken", "KindQuestionQuestionEqualsToken"]);

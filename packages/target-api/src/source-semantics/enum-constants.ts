import type { CheckedSourceProgram, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";

export type SourceEnumConstantSelection =
  | { readonly kind: "resolved"; readonly declaration: Node; readonly value: bigint | string }
  | { readonly kind: "rejected"; readonly declaration: Node; readonly reason: string; readonly failure: "source" | "resource" };

export type SourceEnumIntegerWidthSelection =
  | { readonly kind: "resolved"; readonly declaration: Node; readonly integerWidth: 32 | 64 }
  | { readonly kind: "rejected"; readonly declaration: Node; readonly member: Node;
      readonly reason: string; readonly failure: "source" | "resource" };

export interface SourceEnumConstantIndex {
  readonly entries: readonly SourceEnumConstantSelection[];
  get(member: Node): SourceEnumConstantSelection | undefined;
  integerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
}

type Constant =
  | { readonly kind: "resolved"; readonly value: bigint | string }
  | { readonly kind: "rejected"; readonly reason: string; readonly failure: "source" | "resource" };

type Step =
  | { readonly kind: "visit"; readonly node: Node }
  | { readonly kind: "finish"; readonly node: Node; readonly dependencies: readonly Node[];
      readonly select: (values: readonly Constant[]) => Constant };

const resolved = (value: bigint | string): Constant => Object.freeze({ kind: "resolved", value });
const rejected = (reason: string): Constant => Object.freeze({ kind: "rejected", reason, failure: "source" });

export function analyzeSourceEnumConstants(
  source: CheckedSourceProgram,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
): SourceEnumConstantIndex {
  const { ast } = source;
  const members: Node[] = [];
  const declarations: { readonly declaration: Node; readonly members: readonly Node[] }[] = [];
  const previous = new WeakMap<Node, Node>();
  const membership = new WeakSet<Node>();
  for (const file of source.sourceFiles) {
    if (file === undefined) continue;
    const pending: Node[] = [file];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (ast.is.IsEnumDeclaration(node)) {
        let prior: Node | undefined;
        const declaredMembers: Node[] = [];
        for (const member of ast.as.AsEnumDeclaration(node)?.Members?.Nodes ?? []) {
          if (member === undefined || !ast.is.IsEnumMember(member)) throw new Error("Checked enum declarations require exact member identities.");
          members.push(member);
          declaredMembers.push(member);
          membership.add(member);
          if (prior !== undefined) previous.set(member, prior);
          prior = member;
        }
        declarations.push({ declaration: node, members: declaredMembers });
      }
      const children: Node[] = [];
      ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
    }
  }

  const completed = new WeakMap<Node, Constant>();
  const active = new Set<Node>();
  const selections = new WeakMap<Node, SourceEnumConstantSelection>();
  const widths = new WeakMap<Node, SourceEnumIntegerWidthSelection>();
  const entries: SourceEnumConstantSelection[] = [];
  for (const member of members) {
    const value = evaluate(member);
    const selection: SourceEnumConstantSelection = Object.freeze({ declaration: member, ...value });
    selections.set(member, selection);
    entries.push(selection);
  }
  for (const declaration of declarations) {
    const constants = declaration.members.map(member => {
      const selected = selections.get(member);
      if (selected === undefined) throw new Error("Every checked enum member requires its exact completed constant entry.");
      return selected;
    });
    const failure = constants.find((constant): constant is Extract<SourceEnumConstantSelection, { kind: "rejected" }> => constant.kind === "rejected");
    if (failure !== undefined) {
      widths.set(declaration.declaration, Object.freeze({ kind: "rejected", declaration: declaration.declaration,
        member: failure.declaration, reason: failure.reason, failure: failure.failure }));
      continue;
    }
    const decision = selectSourceEnumIntegerWidth(constants.map(constant => {
      if (constant.kind !== "resolved") throw new Error("A completed enum width decision cannot consume an unresolved value.");
      return constant.value;
    }));
    if (decision.kind === "resolved") {
      widths.set(declaration.declaration, Object.freeze({ ...decision, declaration: declaration.declaration }));
    } else {
      const member = declaration.members[decision.index];
      if (member === undefined) throw new Error("A refused enum width requires its exact offending member.");
      widths.set(declaration.declaration, Object.freeze({ kind: "rejected", declaration: declaration.declaration,
        member, reason: decision.reason, failure: "source" }));
    }
  }
  return Object.freeze({ entries: Object.freeze(entries), get: (member: Node) => selections.get(member),
    integerWidth: (declaration: Node) => widths.get(declaration) });

  function evaluate(root: Node): Constant {
    const tasks: Step[] = [{ kind: "visit", node: root }];
    while (tasks.length !== 0) {
      const task = tasks.pop()!;
      if (completed.has(task.node)) continue;
      if (task.kind === "finish") {
        active.delete(task.node);
        const values = task.dependencies.map(dependency => {
          const value = completed.get(dependency);
          if (value === undefined) throw new Error("Enum constant dependency must complete before its consumer.");
          return value;
        });
        const failure = values.find(value => value.kind === "rejected");
        completed.set(task.node, failure ?? task.select(values));
        continue;
      }
      if (active.has(task.node)) {
        completed.set(task.node, rejected("Enum constant dependencies contain a cycle."));
        continue;
      }
      const step = describe(task.node);
      if (step.kind !== "finish") {
        completed.set(task.node, step);
        continue;
      }
      active.add(task.node);
      tasks.push(step);
      for (let index = step.dependencies.length - 1; index >= 0; index -= 1) {
        tasks.push({ kind: "visit", node: step.dependencies[index]! });
      }
    }
    const selected = completed.get(root);
    if (selected === undefined) throw new Error("A checked enum member must have one completed constant selection.");
    return selected;
  }

  function depends(node: Node, dependencies: readonly Node[], select: (values: readonly Constant[]) => Constant): Extract<Step, { kind: "finish" }> {
    return { kind: "finish", node, dependencies, select };
  }

  function describe(node: Node): Constant | Extract<Step, { kind: "finish" }> {
    if (membership.has(node)) {
      const member = ast.as.AsEnumMember(node)!;
      if (member.Initializer !== undefined) {
        const file = ast.getSourceFile(node);
        if (file === undefined) throw new Error("A checked enum member must belong to its source file.");
        const constant = source.getSourceFileQueries(file).typeShape.getConstantValue(node);
        return depends(node, [member.Initializer], values => typeof constant === "number" || typeof constant === "string"
          ? values[0]! : rejected("The enum member is computed rather than a checked source constant."));
      }
      const owner = ast.parent(node);
      const file = ast.getSourceFile(node);
      if (file === undefined || owner === undefined) throw new Error("A checked enum member requires its declaration and file.");
      if (ast.isDeclarationFile(file) || ast.hasModifierKind(owner, "ambient")) return rejected(
        "The selected enum member has no exact compile-time constant value: an ambient member without an initializer is unknown.");
      const prior = previous.get(node);
      return prior === undefined ? resolved(0n) : depends(node, [prior], values => {
        const value = values[0]!;
        return value.kind === "resolved" && typeof value.value === "bigint" ? resolved(value.value + 1n)
          : rejected("An implicit enum member requires a preceding exact integer constant.");
      });
    }
    if (ast.is.IsNumericLiteral(node)) {
      const literal = sourceLiteralToken(ast, node);
      if (literal.kind !== "authored") return rejected("Enum numeric constants require their exact authored source token.");
      const token = parseSourceNumericLiteral(literal.text)?.token;
      if (token === undefined) return rejected("The enum numeric literal has no exact authored numeric value.");
      if (token.exponent < 0n) return rejected("An enum constant must be integral; fractional numeric literals are not representable.");
      const value = token.coefficient * 10n ** token.exponent;
      return resolved(token.negative ? -value : value);
    }
    if (ast.is.IsStringLiteral(node) || ast.is.IsNoSubstitutionTemplateLiteral(node)) return resolved(ast.text(node));
    if (ast.is.IsParenthesizedExpression(node)) {
      const expression = ast.as.AsParenthesizedExpression(node)?.Expression;
      return expression === undefined ? rejected("An enum constant has an incomplete parenthesized expression.")
        : depends(node, [expression], values => values[0]!);
    }
    if (ast.is.IsPrefixUnaryExpression(node)) {
      const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
      const operator = ast.operatorKindName(node);
      if (operand === undefined || operator !== "KindPlusToken" && operator !== "KindMinusToken" && operator !== "KindTildeToken") return rejected(
        "The enum unary operator is not a supported source constant form.");
      return depends(node, [operand], values => {
        const value = values[0]!;
        if (value.kind !== "resolved" || typeof value.value !== "bigint") return rejected("An enum numeric unary operator requires an exact integer operand.");
        return resolved(operator === "KindPlusToken" ? value.value : operator === "KindMinusToken" ? -value.value : ~BigInt.asIntN(32, value.value));
      });
    }
    if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node)!;
      const operator = ast.operatorKindName(node);
      if (binary.Left === undefined || binary.Right === undefined) return rejected("An enum binary expression has an incomplete operand.");
      return depends(node, [binary.Left, binary.Right], values => binaryConstant(operator, values[0]!, values[1]!));
    }
    const file = ast.getSourceFile(node);
    if (file === undefined) return rejected("The enum constant reference is outside the checked source program.");
    const checker = source.getSourceFileQueries(file).checker;
    const declaration = ast.is.IsIdentifier(node) ? navigation.sourceReferenceFor(node)?.declaration
      : ast.is.IsPropertyAccessExpression(node) ? checker.getResolvedPropertyAccessInfo(node)?.selectedDeclaration
        : ast.is.IsElementAccessExpression(node) ? checker.getResolvedElementAccessInfo(node)?.selectedDeclaration : undefined;
    if (declaration !== undefined && membership.has(declaration)) return depends(node, [declaration], values => values[0]!);
    if (declaration !== undefined && ast.is.IsVariableDeclaration(declaration) && ast.variableDeclarationKind(declaration) === "const") {
      const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
      if (initializer !== undefined) return depends(node, [initializer], values => values[0]!);
    }
    return rejected("The enum initializer is not an exact checked literal, enum reference or supported constant expression.");
  }
}

export function selectSourceEnumIntegerWidth(values: readonly (bigint | string)[]):
  | { readonly kind: "resolved"; readonly integerWidth: 32 | 64 }
  | { readonly kind: "rejected"; readonly index: number; readonly reason: string } {
  let integerWidth: 32 | 64 = 32;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (typeof value === "string") return Object.freeze({ kind: "rejected", index,
      reason: "A source-authored native enum requires exact integer constants; regular string enums have no admitted native runtime representation." });
    if (value < -(1n << 63n) || value > (1n << 63n) - 1n) return Object.freeze({ kind: "rejected", index,
      reason: "The exact source enum constant is outside the signed i64 native enum domain." });
    if (value < -(1n << 31n) || value > (1n << 31n) - 1n) integerWidth = 64;
  }
  return Object.freeze({ kind: "resolved", integerWidth });
}

function binaryConstant(operator: string | undefined, left: Constant, right: Constant): Constant {
  if (left.kind === "rejected") return left;
  if (right.kind === "rejected") return right;
  if (operator === "KindPlusToken" && (typeof left.value === "string" || typeof right.value === "string")) return resolved(String(left.value) + String(right.value));
  if (typeof left.value !== "bigint" || typeof right.value !== "bigint") return rejected("Enum arithmetic requires exact integer operands.");
  const first = left.value;
  const second = right.value;
  switch (operator) {
    case "KindPlusToken": return resolved(first + second);
    case "KindMinusToken": return resolved(first - second);
    case "KindAsteriskToken": return resolved(first * second);
    case "KindSlashToken":
      return second === 0n ? rejected("Enum constant division by zero has no integral value.")
        : first % second !== 0n ? rejected("An enum constant division result must be integral; truncation is not permitted.") : resolved(first / second);
    case "KindPercentToken": return second === 0n ? rejected("Enum constant remainder by zero has no integral value.") : resolved(first % second);
    case "KindAsteriskAsteriskToken":
      return second < 0n ? rejected("An enum constant exponent must produce an exact integral result.") : resolved(first ** second);
    case "KindBarToken": return resolved(BigInt.asIntN(32, first) | BigInt.asIntN(32, second));
    case "KindAmpersandToken": return resolved(BigInt.asIntN(32, first) & BigInt.asIntN(32, second));
    case "KindCaretToken": return resolved(BigInt.asIntN(32, first) ^ BigInt.asIntN(32, second));
    case "KindLessThanLessThanToken": return resolved(BigInt.asIntN(32, BigInt.asIntN(32, first) << (BigInt.asUintN(32, second) & 31n)));
    case "KindGreaterThanGreaterThanToken": return resolved(BigInt.asIntN(32, first) >> (BigInt.asUintN(32, second) & 31n));
    case "KindGreaterThanGreaterThanGreaterThanToken": return resolved(BigInt.asUintN(32, first) >> (BigInt.asUintN(32, second) & 31n));
    default: return rejected("The enum binary operator is not a supported source constant form.");
  }
}

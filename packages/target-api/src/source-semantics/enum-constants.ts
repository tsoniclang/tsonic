import { AsEnumMember } from "../source-navigation/checked-casts.js";
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex,
  SourceEnumConstantSelection, SourceEnumIntegerWidthSelection } from "./enum-model.js";

type Constant =
  // `float`: the JS (float64) evaluation of the same initializer, for numeric members. TypeScript and the JS runtime
  // evaluate enum initializers in float64; the Host evaluates exactly and in float64 side by side, and admits a numeric
  // member only when both agree (coherence below).
  | { readonly kind: "resolved"; readonly value: bigint | string; readonly bits: bigint; readonly float?: number }
  | { readonly kind: "rejected"; readonly reason: string; readonly failure: "source" | "resource" };

type Step =
  | { readonly kind: "visit"; readonly node: Node }
  | { readonly kind: "finish"; readonly node: Node; readonly dependencies: readonly Node[];
      readonly select: (values: readonly Constant[]) => Constant;
      readonly allocation?: (values: readonly Constant[]) => { readonly bits: bigint; readonly work: bigint } };

interface EvaluationBudget {
  charge(work: bigint, bits?: bigint): Constant | undefined;
}

const maximumConstantBits = 1_048_576n;
const maximumEvaluationWork = 67_108_864n;
const resolved = (value: bigint | string, float: number | undefined = typeof value === "bigint" ? Number(value) : undefined): Constant =>
  Object.freeze({ kind: "resolved", value,
    bits: typeof value === "string" ? BigInt(value.length) * 16n : BigInt((value < 0n ? -value : value).toString(2).length),
    ...(float === undefined ? {} : { float }) });
const rejected = (reason: string): Constant => Object.freeze({ kind: "rejected", reason, failure: "source" });
const resourceExhausted = (reason: string): Constant => Object.freeze({ kind: "rejected", reason, failure: "resource" });

/**
 * The Host enum constant facts: the exact value of every enum member of the program (enum initializer evaluation from
 * syntax and declarations), the integer width of each enum declaration, and the declaration-level admission issues
 * (merged declarations). Checker-free (I3). The use-site admission issues (enum values used as numbers or strings) are
 * Host-fact analyses over the value model: analyzeSourceEnumNumericUses (enum-numeric-uses.ts).
 */
export function analyzeSourceEnumConstants(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "mergedDeclarations" | "memberAccess">,
): SourceEnumConstantIndex {
  const members: Node[] = [];
  const declarations: { readonly declaration: Node; readonly members: readonly Node[] }[] = [];
  type DeclarationGroup = {
    readonly checkedDeclarations: Set<Node>;
    readonly declarations: { readonly declaration: Node; readonly members: readonly Node[] }[];
  };
  const groups = new Set<DeclarationGroup>();
  const groupsByDeclaration = new WeakMap<Node, DeclarationGroup>();
  const previous = new WeakMap<Node, Node>();
  const membership = new WeakSet<Node>();
  for (const file of sourceFiles) {
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
        const declaration = { declaration: node, members: declaredMembers };
        declarations.push(declaration);
        let group = groupsByDeclaration.get(node);
        if (group === undefined) {
          const checkedDeclarations = navigation.mergedDeclarations(node)
            .filter(selected => ast.is.IsEnumDeclaration(selected));
          if (!checkedDeclarations.includes(node)) throw new Error("A checked enum symbol requires its actual declaration membership.");
          group = { checkedDeclarations: new Set(checkedDeclarations), declarations: [] };
          for (const selected of checkedDeclarations) {
            if (groupsByDeclaration.has(selected))
              throw new Error("Completed checked enum declaration membership requires one consistent group.");
            groupsByDeclaration.set(selected, group);
          }
          groups.add(group);
        }
        group.declarations.push(declaration);
      }
      const children: Node[] = [];
      ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
    }
  }

  const completed = new WeakMap<Node, Constant>();
  const selections = new WeakMap<Node, SourceEnumConstantSelection>();
  const widths = new WeakMap<Node, SourceEnumIntegerWidthSelection>();
  const disagreements = new WeakMap<Node, Constant>();
  const entries: SourceEnumConstantSelection[] = [];
  const issues: SourceEnumAdmissionIssue[] = [];
  const mergedDeclarations = new WeakSet<Node>();
  for (const group of groups) {
    if (group.checkedDeclarations.size < 2) continue;
    const canonical = group.declarations[0]!.declaration;
    const reason = `Enum '${ast.text(ast.name(canonical))}' has ${group.checkedDeclarations.size} declarations; tsonic supports one declaration per enum.`;
    const issue: SourceEnumAdmissionIssue = Object.freeze({ code: "TSONIC_ENUM_MERGED_DECLARATIONS_NOT_SUPPORTED", category: "error",
      source: "tsonic", sourceNode: canonical, message: reason });
    issues.push(issue);
    for (const declaration of group.declarations) {
      mergedDeclarations.add(declaration.declaration);
      widths.set(declaration.declaration, Object.freeze({ kind: "rejected", declaration: declaration.declaration,
        member: canonical, reason, failure: "source", admissionIssue: issue }));
      for (const member of declaration.members) completed.set(member, rejected(reason));
    }
  }
  for (const member of members) evaluate(member);
  for (const declaration of declarations) {
    if (mergedDeclarations.has(declaration.declaration)) continue;
    const floatValues = new Map<number, { readonly member: Node; readonly exact: bigint }[]>();
    for (const member of declaration.members) {
      const value = completed.get(member)!;
      if (value.kind !== "resolved" || typeof value.value !== "bigint") continue;
      // The member is a JS number at runtime: the float64 evaluation of its initializer must be the float64 rounding
      // of its exact value.
      const float = floatOf(value);
      if (float !== Number(value.value)) disagreements.set(member, rejected(enumDisagreement(member, value.value, float)));
      const prior = floatValues.get(float);
      const entry = { member, exact: value.value };
      if (prior === undefined) floatValues.set(float, [entry]);
      else prior.push(entry);
    }
    // Distinct exact values that are one JS number at runtime cannot keep distinct native identities.
    for (const [float, values] of floatValues) {
      if (values.every(value => value.exact === values[0]!.exact)) continue;
      const members = values.map(value => `${ast.text(ast.name(value.member))} (exact value ${value.exact})`).join(", ");
      for (const value of values) disagreements.set(value.member, rejected(
        `Enum members ${members} have distinct exact values but share JS number value ${float}. Write distinct explicit values that are distinct JS numbers.`));
    }
  }
  for (const member of members) {
    const value = disagreements.get(member) ?? completed.get(member)!;
    const selection: SourceEnumConstantSelection = value.kind === "resolved"
      ? Object.freeze({ kind: "resolved", declaration: member, value: value.value })
      : Object.freeze({ kind: "rejected", declaration: member, reason: value.reason, failure: value.failure });
    selections.set(member, selection);
    entries.push(selection);
  }
  for (const declaration of declarations) {
    if (mergedDeclarations.has(declaration.declaration)) continue;
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
  const constants = Object.freeze({ entries: Object.freeze(entries), get: (member: Node) => selections.get(member),
    integerWidth: (declaration: Node) => widths.get(declaration) });
  return Object.freeze({ ...constants, issues: Object.freeze(issues) });

  function enumDisagreement(member: Node, exact: bigint, float: number): string {
    const name = ast.name(member);
    return `Enum member ${name === undefined ? "<unnamed>" : ast.text(name)} has exact value ${exact}, but its JS number value is ${String(float)}. Write the value explicitly so that both agree.`;
  }

  function evaluate(root: Node): Constant {
    const active = new Set<Node>();
    let consumedWork = 0n;
    const budget: EvaluationBudget = {
      charge(work, bits = 0n) {
        if (bits > maximumConstantBits) return resourceExhausted(
          `Exact enum evaluation exceeded its intermediate storage budget (${maximumConstantBits} bits).`);
        if (work > maximumEvaluationWork - consumedWork) return resourceExhausted(
          `Exact enum evaluation exceeded its arithmetic work budget (${maximumEvaluationWork} bit-work units).`);
        consumedWork += work;
        return undefined;
      },
    };
    const tasks: Step[] = [{ kind: "visit", node: root }];
    while (tasks.length !== 0) {
      const task = tasks.pop()!;
      const visitFailure = budget.charge(1n);
      if (visitFailure !== undefined) {
        completed.set(root, visitFailure);
        break;
      }
      if (completed.has(task.node)) continue;
      if (task.kind === "finish") {
        active.delete(task.node);
        const values = task.dependencies.map(dependency => {
          const value = completed.get(dependency);
          if (value === undefined) throw new Error("Enum constant dependency must complete before its consumer.");
          return value;
        });
        const failure = values.find(value => value.kind === "rejected");
        const allocation = failure === undefined ? task.allocation?.(values) : undefined;
        const resourceFailure = allocation === undefined ? undefined : budget.charge(allocation.work, allocation.bits);
        completed.set(task.node, failure ?? resourceFailure ?? task.select(values));
        continue;
      }
      if (active.has(task.node)) {
        completed.set(task.node, rejected("Enum constant dependencies contain a cycle."));
        continue;
      }
      const step = describe(task.node, budget);
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

  function depends(node: Node, dependencies: readonly Node[], select: (values: readonly Constant[]) => Constant,
    allocation?: Extract<Step, { kind: "finish" }>["allocation"]): Extract<Step, { kind: "finish" }> {
    return { kind: "finish", node, dependencies, select, ...(allocation === undefined ? {} : { allocation }) };
  }

  function describe(node: Node, budget: EvaluationBudget): Constant | Extract<Step, { kind: "finish" }> {
    if (membership.has(node)) {
      const member = AsEnumMember(ast, node)!;
      if (member.Initializer !== undefined) {
        return depends(node, [member.Initializer], values => values[0]!);
      }
      const owner = ast.parent(node);
      const file = ast.getSourceFile(node);
      if (file === undefined || owner === undefined) throw new Error("A checked enum member requires its declaration and file.");
      if (ast.isDeclarationFile(file) || ast.hasModifierKind(owner, "ambient")) return rejected(
        "The selected enum member has no exact compile-time constant value: an ambient member without an initializer is unknown.");
      const prior = previous.get(node);
      return prior === undefined ? resolved(0n) : depends(node, [prior], values => {
        const value = values[0]!;
        return value.kind === "resolved" && typeof value.value === "bigint" ? resolved(value.value + 1n, floatOf(value) + 1)
          : rejected("An implicit enum member requires a preceding exact integer constant.");
      }, values => ({ bits: constantBits(values[0]!) + 1n, work: constantBits(values[0]!) + 1n }));
    }
    if (ast.is.IsNumericLiteral(node)) {
      const literal = sourceLiteralToken(ast, node);
      if (literal.kind !== "authored") return rejected("Enum numeric constants require their exact authored source token.");
      const normalized = literal.text.replace(/_/gu, "");
      const radix = /^0[xob]/iu.test(normalized);
      const parts = radix ? [normalized.slice(2)] : normalized.split(/[eE]/u);
      const significant = parts[0]!.replace(/\./gu, "").replace(/^0+/u, "");
      const coefficientDigits = radix ? significant : significant.replace(/0+$/u, "");
      const parseFailure = budget.charge(BigInt(normalized.length),
        BigInt(Math.max(coefficientDigits.length, parts[1]?.length ?? 0)) * 4n);
      if (parseFailure !== undefined) return parseFailure;
      const token = parseSourceNumericLiteral(literal.text)?.token;
      if (token === undefined) return rejected("The enum numeric literal has no exact authored numeric value.");
      if (token.exponent < 0n) return rejected("An enum constant must be integral; fractional numeric literals are not representable.");
      const bits = BigInt(coefficientDigits.length) * 4n + token.exponent * 4n;
      const allocationFailure = budget.charge(bits > maximumConstantBits ? 0n : token.exponent === 0n ? 1n : bits * bits, bits);
      if (allocationFailure !== undefined) return allocationFailure;
      const value = token.coefficient * 10n ** token.exponent;
      return resolved(token.negative ? -value : value);
    }
    if (ast.is.IsStringLiteral(node) || ast.is.IsNoSubstitutionTemplateLiteral(node)) {
      const text = ast.text(node);
      const allocationFailure = budget.charge(BigInt(text.length), BigInt(text.length) * 16n);
      return allocationFailure ?? resolved(text);
    }
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
        const float = floatOf(value);
        return operator === "KindPlusToken" ? resolved(value.value, float) : operator === "KindMinusToken" ? resolved(-value.value, -float)
          : resolved(~BigInt.asIntN(32, value.value), ~float);
      }, values => ({ bits: operator === "KindTildeToken" ? 32n : constantBits(values[0]!),
        work: constantBits(values[0]!) + 32n }));
    }
    if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node)!;
      const operator = ast.operatorKindName(node);
      if (binary.Left === undefined || binary.Right === undefined) return rejected("An enum binary expression has an incomplete operand.");
      return depends(node, [binary.Left, binary.Right], values => binaryConstant(operator, values[0]!, values[1]!),
        values => binaryAllocation(operator, values[0]!, values[1]!));
    }
    if (ast.getSourceFile(node) === undefined) return rejected("The enum constant reference is outside the checked source program.");
    const declaration = ast.is.IsIdentifier(node) ? navigation.sourceReferenceFor(node)?.declaration
      : ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)
        ? navigation.memberAccess(node)?.declaration : undefined;
    if (declaration !== undefined && membership.has(declaration)) return depends(node, [declaration], values => values[0]!);
    if (declaration !== undefined && ast.is.IsVariableDeclaration(declaration) && ast.variableDeclarationKind(declaration) === "const") {
      const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
      if (initializer !== undefined) return depends(node, [initializer], values => values[0]!);
    }
    return rejected("The enum initializer is not an exact checked literal, enum reference or supported constant expression.");
  }
}

function constantBits(constant: Constant): bigint {
  return constant.kind === "rejected" ? 0n : constant.bits;
}

function binaryAllocation(operator: string | undefined, left: Constant, right: Constant): { readonly bits: bigint; readonly work: bigint } {
  if (left.kind === "rejected" || right.kind === "rejected") return { bits: 0n, work: 1n };
  const first = constantBits(left);
  const second = constantBits(right);
  if (typeof left.value === "string" || typeof right.value === "string") {
    const bits = (typeof left.value === "string" ? first : first * 16n) + (typeof right.value === "string" ? second : second * 16n);
    return { bits: operator === "KindPlusToken" ? bits : 0n, work: bits + 1n };
  }
  switch (operator) {
    case "KindPlusToken":
    case "KindMinusToken": return { bits: (first > second ? first : second) + 1n, work: first + second };
    case "KindAsteriskToken": return { bits: left.value === 0n || right.value === 0n ? 1n : first + second, work: first * second };
    case "KindSlashToken":
    case "KindPercentToken": return { bits: first, work: right.value === 0n ? 1n : first * second };
    case "KindAsteriskAsteriskToken": {
      if (right.value <= 0n || left.value >= -1n && left.value <= 1n) return { bits: 1n, work: 1n };
      const bits = first * right.value;
      return { bits, work: bits > maximumConstantBits ? 0n : bits * bits };
    }
    case "KindBarToken":
    case "KindAmpersandToken":
    case "KindCaretToken":
    case "KindLessThanLessThanToken":
    case "KindGreaterThanGreaterThanToken":
    case "KindGreaterThanGreaterThanGreaterThanToken": return { bits: 32n, work: first + second + 32n };
    default: return { bits: 0n, work: 1n };
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

function floatOf(constant: Extract<Constant, { kind: "resolved" }>): number {
  return constant.float ?? Number(constant.value);
}

/** The exact result with the float64 result of the same JS operator attached (numeric results only). */
function binaryConstant(operator: string | undefined, left: Constant, right: Constant): Constant {
  const exact = exactBinaryConstant(operator, left, right);
  if (exact.kind !== "resolved" || typeof exact.value !== "bigint" || left.kind !== "resolved" || right.kind !== "resolved") return exact;
  const first = floatOf(left);
  const second = floatOf(right);
  const float = operator === "KindPlusToken" ? first + second : operator === "KindMinusToken" ? first - second
    : operator === "KindAsteriskToken" ? first * second : operator === "KindSlashToken" ? first / second
    : operator === "KindPercentToken" ? first % second : operator === "KindAsteriskAsteriskToken" ? first ** second
    : operator === "KindBarToken" ? first | second : operator === "KindAmpersandToken" ? first & second
    : operator === "KindCaretToken" ? first ^ second : operator === "KindLessThanLessThanToken" ? first << second
    : operator === "KindGreaterThanGreaterThanToken" ? first >> second : first >>> second;
  return resolved(exact.value, float);
}

function exactBinaryConstant(operator: string | undefined, left: Constant, right: Constant): Constant {
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
      return second === 0n ? resolved(1n) : first === 1n ? resolved(1n)
        : first === -1n ? resolved(second % 2n === 0n ? 1n : -1n)
          : first === 0n && second > 0n ? resolved(0n)
            : second < 0n ? rejected("An enum constant exponent must produce an exact integral result.") : resolved(first ** second);
    case "KindBarToken": return resolved(BigInt.asIntN(32, first) | BigInt.asIntN(32, second));
    case "KindAmpersandToken": return resolved(BigInt.asIntN(32, first) & BigInt.asIntN(32, second));
    case "KindCaretToken": return resolved(BigInt.asIntN(32, first) ^ BigInt.asIntN(32, second));
    case "KindLessThanLessThanToken": return resolved(BigInt.asIntN(32, BigInt.asIntN(32, first) << (BigInt.asUintN(32, second) & 31n)));
    case "KindGreaterThanGreaterThanToken": return resolved(BigInt.asIntN(32, first) >> (BigInt.asUintN(32, second) & 31n));
    case "KindGreaterThanGreaterThanGreaterThanToken": return resolved(BigInt.asUintN(32, first) >> (BigInt.asUintN(32, second) & 31n));
    default: return rejected("The enum binary operator is not a supported source constant form.");
  }
}

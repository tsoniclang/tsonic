import type { NodeRef, Origin, TyId } from "../ids/contract.js";
import type { HirBinaryOperator, HirUnaryOperator } from "../ir-hir/contract.js";
import type { OperationDecision, QualifiedOperatorField } from "../ir-infer/contract.js";
import type { NativeIntegerOperation, NativePrimitive, TypeEvidence } from "../ir-types/contract.js";
import { internType, isNativeBinaryFloatPrimitive, isNativeIntegerPrimitive, isNativeSignedIntegerPrimitive, nativeAbsenceComparisonOf, nativeCarrierOf, readType, viewTypes } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, callerDefect, notDecidedYet, termName } from "./frontier.js";

function forms(operator: HirUnaryOperator | HirBinaryOperator): { readonly unary: boolean; readonly binary: boolean } {
  switch (operator) {
    case "+": case "-": return { unary: true, binary: true };
    case "!": case "~": case "++": case "--": case "typeof": case "void": case "delete": return { unary: true, binary: false };
    case "*": case "/": case "%": case "**": case "&": case "|": case "^": case "<<": case ">>": case ">>>":
    case "<": case "<=": case ">": case ">=": case "==": case "!=": case "===": case "!==": case "in": case "instanceof":
      return { unary: false, binary: true };
  }
}

function overflowSelection(deps: RulesDeps, carrier: NativePrimitive, type: TyId, family: NativeIntegerOperation,
  named: string, occurrence: NodeRef, origin: Origin | null): Pick<OperationDecision, "result" | "execution"> {
  const overflow = deps.selectedNativeFacts.integerOverflow.find(row => row.carrier === carrier && row.operation === family);
  if (overflow === undefined) {
    const action = family === "add" ? "addition" : family === "subtract" ? "subtraction" : family === "multiply" ? "multiplication"
      : family === "negate" ? "negation" : family === "left-shift" ? "left-shift overflow" : family;
    return notDecidedYet(`the actual selected native ${action} law for ${named} at ${at(occurrence)}`, origin);
  }
  if ((family === "increment" || family === "decrement") && overflow.result !== carrier)
    return notDecidedYet(`the selected write conversion for native ${family} over ${named} at ${at(occurrence)}`, origin);
  return { result: overflow.result === carrier ? type : internType(deps.types, { kind: "primitive", primitive: overflow.result }),
    execution: overflow.law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: overflow.law } };
}

export function decideOperator(deps: RulesDeps, operator: HirUnaryOperator | HirBinaryOperator, operands: readonly TypeEvidence[],
  occurrence: NodeRef, origin: Origin | null, reference: QualifiedOperatorField | null): OperationDecision {
  const terms = operands.map(operand => readType(deps.types, operand.type));
  const named = terms.map(termName).join(" and ");
  if (terms.some(term => term.kind === "open")) return callerDefect(`the operator ${operator} over ${named} at ${at(occurrence)}: an operand is an unsolved variable`, origin);
  const form = forms(operator);
  if (terms.length === 1 && form.unary) {
    const operand = operands[0];
    const term = terms[0];
    if (operator === "void" && operand !== undefined && term !== undefined) {
      if (term.kind === "intrinsic" && term.intrinsic === "never")
        return notDecidedYet("a void operator without an actual operand value", origin);
      return { kind: "selected", operation: { kind: "discard" }, operands: [operand.type],
        result: internType(deps.types, { kind: "intrinsic", intrinsic: "absence" }), execution: { kind: "pure" } };
    }
    if (operand === undefined || operator !== "!" && operator !== "+" && operator !== "-" && operator !== "~" && operator !== "++" && operator !== "--")
      return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    const table = viewTypes(deps.types);
    const carrier = nativeCarrierOf(table, operand.type, type => table.terms[type]);
    if (carrier.kind !== "primitive")
      return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    const floatingUnary = isNativeBinaryFloatPrimitive(carrier.primitive) && (operator === "+" || operator === "-");
    if (floatingUnary) {
      if (!deps.selectedNativeFacts.floatingFormats.some(format => format.carrier === carrier.primitive))
        return notDecidedYet(`the actual selected native floating format for unary ${operator} over ${named} at ${at(occurrence)}`, origin);
    } else if (operator === "!" ? carrier.primitive !== "bool" : !isNativeIntegerPrimitive(carrier.primitive))
      return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    const overflow = operator === "++" ? "increment" : operator === "--" ? "decrement" : operator === "-" && !floatingUnary ? "negate" : null;
    const selection: Pick<OperationDecision, "result" | "execution"> = overflow !== null
      ? overflowSelection(deps, carrier.primitive, carrier.type, overflow, named, occurrence, origin)
      : { result: carrier.type, execution: { kind: "pure" } };
    return { kind: "selected", operation: { kind: "native-operator", operator, carrier: carrier.primitive },
      operands: [operand.type], ...selection };
  }
  const left = operands[0];
  const right = operands[1];
  const carrier = terms[0];
  if (terms.length !== 2 || !form.binary || left === undefined || right === undefined || carrier === undefined)
    return callerDefect(`the operator ${operator} with ${terms.length} operands at ${at(occurrence)}`, origin);
  const equality = operator === "==" || operator === "===" || operator === "!=" || operator === "!==";
  const presence = reference?.field.presence;
  if (reference !== null && (!equality || presence == null || reference.field.occurrence.body !== occurrence.body
    || (reference.operand === 0 ? left : right).type !== presence.storage))
    return callerDefect("a reference absence comparison requires its actual checked operand", origin);
  if (equality && nativeAbsenceComparisonOf(carrier, terms[1], type => readType(deps.types, type), presence?.present ?? null) === "native-absence") {
    return { kind: "selected", operation: { kind: "absence-test", negated: operator === "!=" || operator === "!==" },
      operands: [left.type, right.type], result: internType(deps.types, { kind: "primitive", primitive: "bool" }), execution: { kind: "pure" } };
  }
  if (equality || operator === "<" || operator === ">" || operator === "<=" || operator === ">=") {
    const table = viewTypes(deps.types);
    const leftCarrier = nativeCarrierOf(table, left.type, type => table.terms[type]);
    const rightCarrier = nativeCarrierOf(table, right.type, type => table.terms[type]);
    if (leftCarrier.kind === "primitive" && rightCarrier.kind === "primitive" && leftCarrier.type === rightCarrier.type) {
      const floating = isNativeBinaryFloatPrimitive(leftCarrier.primitive);
      if (floating && !deps.selectedNativeFacts.floatingFormats.some(format => format.carrier === leftCarrier.primitive))
        return notDecidedYet(`the actual selected native floating format for comparison over ${named} at ${at(occurrence)}`, origin);
      if (floating || isNativeIntegerPrimitive(leftCarrier.primitive))
        return { kind: "selected", operation: { kind: "native-operator", operator, carrier: leftCarrier.primitive },
          operands: [left.type, right.type], result: internType(deps.types, { kind: "primitive", primitive: "bool" }), execution: { kind: "pure" } };
    }
    if (equality) {
      const kind = leftCarrier.kind === "primitive" && leftCarrier.primitive === "bool"
        && rightCarrier.kind === "primitive" && rightCarrier.primitive === "bool" ? "boolean-operator"
        : leftCarrier.kind === "needs-selected-association" && table.terms[leftCarrier.type]?.kind === "string"
          && rightCarrier.kind === "needs-selected-association" && table.terms[rightCarrier.type]?.kind === "string" ? "string-operator" : null;
      if (kind !== null) return { kind: "selected", operation: { kind, operator }, operands: [left.type, right.type],
        result: internType(deps.types, { kind: "primitive", primitive: "bool" }), execution: { kind: "pure" } };
    }
  }
  const bitwise = operator === "&" || operator === "|" || operator === "^";
  const shift = operator === "<<" || operator === ">>" || operator === ">>>";
  if (operator !== "+" && operator !== "-" && operator !== "*" && operator !== "/" && operator !== "%" && !shift && !bitwise
    || carrier.kind !== "primitive" || left.type !== right.type
    || carrier.primitive === "float64" && operator !== "+")
    return notDecidedYet(`the binary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
  if (operator === "/" || operator === "%" || shift || bitwise) {
    if (!isNativeIntegerPrimitive(carrier.primitive))
      return notDecidedYet(`the binary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    if (bitwise)
      return { kind: "selected", operation: { kind: "native-operator", operator, carrier: carrier.primitive },
        operands: [left.type, right.type], result: left.type, execution: { kind: "pure" } };
    if (shift) {
      const count = deps.selectedNativeFacts.invalidShiftCount.find(row => row.carrier === carrier.primitive);
      if (count === undefined)
        return notDecidedYet(`the actual selected native shift-count law for ${named} at ${at(occurrence)}`, origin);
      const value: Pick<OperationDecision, "result" | "execution"> = operator === "<<"
        ? overflowSelection(deps, carrier.primitive, left.type, "left-shift", named, occurrence, origin)
        : { result: left.type, execution: { kind: "pure" } };
      if (count.law.kind === "fail" && value.execution.kind === "invocation" && value.execution.failure !== count.law.failure)
        return notDecidedYet("distinct native shift-count and left-shift overflow continuations", origin);
      return { kind: "selected", operation: { kind: "native-operator", operator, carrier: carrier.primitive },
        operands: [left.type, right.type], result: value.result, execution: count.law.kind === "mask" ? value.execution
          : { kind: "invocation", writesStorage: false, failure: count.law.failure } };
    }
    const division = operator === "/";
    const zero = (division ? deps.selectedNativeFacts.divisionByZero : deps.selectedNativeFacts.remainderByZero)
      .find(row => row.carrier === carrier.primitive);
    if (zero === undefined || zero.law === "ieee754")
      return notDecidedYet(`the actual selected native ${division ? "division" : "remainder"}-by-zero law for ${named} at ${at(occurrence)}`, origin);
    if (division) {
      if (!deps.selectedNativeFacts.divisionRounding.some(row => row.carrier === carrier.primitive))
        return notDecidedYet(`the actual selected native division rounding law for ${named} at ${at(occurrence)}`, origin);
      if (isNativeSignedIntegerPrimitive(carrier.primitive)) {
        const overflow = deps.selectedNativeFacts.signedQuotientOverflow.find(row => row.carrier === carrier.primitive);
        if (overflow === undefined)
          return notDecidedYet(`the actual selected native signed quotient overflow law for ${named} at ${at(occurrence)}`, origin);
        if (overflow.law !== "wrap" && overflow.law !== zero.law)
          return notDecidedYet("distinct native division-by-zero and signed quotient overflow continuations", origin);
      }
    } else if (!deps.selectedNativeFacts.remainderSign.some(row => row.carrier === carrier.primitive))
      return notDecidedYet(`the actual selected native remainder sign law for ${named} at ${at(occurrence)}`, origin);
    return { kind: "selected", operation: { kind: "native-operator", operator, carrier: carrier.primitive },
      operands: [left.type, right.type], result: left.type, execution: { kind: "invocation", writesStorage: false, failure: zero.law } };
  }
  const selection: Pick<OperationDecision, "result" | "execution"> = carrier.primitive === "float64"
    ? { result: left.type, execution: { kind: "pure" } }
    : overflowSelection(deps, carrier.primitive, left.type, operator === "+" ? "add" : operator === "-" ? "subtract" : "multiply",
      named, occurrence, origin);
  return {
    kind: "selected",
    operation: { kind: "native-operator", operator, carrier: carrier.primitive },
    operands: [left.type, right.type],
    ...selection,
  };
}

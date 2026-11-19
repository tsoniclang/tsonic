import type { NodeRef, Origin } from "../ids/contract.js";
import type { HirBinaryOperator, HirUnaryOperator } from "../ir-hir/contract.js";
import type { OperationDecision } from "../ir-infer/contract.js";
import type { TypeEvidence } from "../ir-types/contract.js";
import { internType, nativeCarrierOf, readType, viewTypes } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, callerDefect, notDecidedYet, termName } from "./frontier.js";

function forms(operator: HirUnaryOperator | HirBinaryOperator): { readonly unary: boolean; readonly binary: boolean } {
  switch (operator) {
    case "+": case "-": return { unary: true, binary: true };
    case "!": case "~": case "typeof": case "void": case "delete": return { unary: true, binary: false };
    case "*": case "/": case "%": case "**": case "&": case "|": case "^": case "<<": case ">>": case ">>>":
    case "<": case "<=": case ">": case ">=": case "==": case "!=": case "===": case "!==": case "in": case "instanceof":
      return { unary: false, binary: true };
  }
}

export function decideOperator(deps: RulesDeps, operator: HirUnaryOperator | HirBinaryOperator, operands: readonly TypeEvidence[],
  occurrence: NodeRef, origin: Origin | null): OperationDecision {
  const terms = operands.map(operand => readType(deps.types, operand.type));
  const named = terms.map(termName).join(" and ");
  if (terms.some(term => term.kind === "open")) return callerDefect(`the operator ${operator} over ${named} at ${at(occurrence)}: an operand is an unsolved variable`, origin);
  const form = forms(operator);
  if (terms.length === 1 && form.unary) {
    const operand = operands[0];
    if (operator !== "!" || operand === undefined)
      return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    const table = viewTypes(deps.types);
    const carrier = nativeCarrierOf(table, operand.type, type => table.terms[type]);
    if (carrier.kind !== "primitive" || carrier.primitive !== "bool")
      return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
    return { kind: "selected", operation: { kind: "native-operator", operator: "!", carrier: "bool" },
      operands: [operand.type], result: carrier.type, execution: { kind: "pure" } };
  }
  const left = operands[0];
  const right = operands[1];
  const carrier = terms[0];
  if (terms.length !== 2 || !form.binary || left === undefined || right === undefined || carrier === undefined)
    return callerDefect(`the operator ${operator} with ${terms.length} operands at ${at(occurrence)}`, origin);
  if (operator === "==" || operator === "===" || operator === "!=" || operator === "!==") {
    const table = viewTypes(deps.types);
    const leftCarrier = nativeCarrierOf(table, left.type, type => table.terms[type]);
    const rightCarrier = nativeCarrierOf(table, right.type, type => table.terms[type]);
    const kind = leftCarrier.kind === "primitive" && leftCarrier.primitive === "bool"
      && rightCarrier.kind === "primitive" && rightCarrier.primitive === "bool" ? "boolean-operator"
      : leftCarrier.kind === "needs-selected-association" && table.terms[leftCarrier.type]?.kind === "string"
        && rightCarrier.kind === "needs-selected-association" && table.terms[rightCarrier.type]?.kind === "string" ? "string-operator" : null;
    if (kind !== null) return { kind: "selected", operation: { kind, operator }, operands: [left.type, right.type],
      result: internType(deps.types, { kind: "primitive", primitive: "bool" }), execution: { kind: "pure" } };
  }
  if (operator !== "+" || carrier.kind !== "primitive" || carrier.primitive !== "float64" || left.type !== right.type)
    return notDecidedYet(`the binary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
  return {
    kind: "selected",
    operation: { kind: "native-operator", operator: "+", carrier: carrier.primitive },
    operands: [left.type, right.type],
    result: left.type,
    execution: { kind: "pure" },
  };
}

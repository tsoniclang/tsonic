import type { NodeRef, Origin } from "../ids/contract.js";
import type { HirBinaryOperator, HirUnaryOperator } from "../ir-hir/contract.js";
import type { OperationDecision } from "../ir-infer/contract.js";
import type { TypeEvidence } from "../ir-types/contract.js";
import { readType } from "../ir-types/index.js";
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
  if (terms.length === 1 && form.unary) return notDecidedYet(`the unary operator ${operator} over ${named} at ${at(occurrence)}`, origin);
  const left = operands[0];
  const right = operands[1];
  const carrier = terms[0];
  if (terms.length !== 2 || !form.binary || left === undefined || right === undefined || carrier === undefined)
    return callerDefect(`the operator ${operator} with ${terms.length} operands at ${at(occurrence)}`, origin);
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

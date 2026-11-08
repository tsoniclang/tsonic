import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourcePrimitiveOperatorIsIntegral, sourcePrimitiveOperatorLiteralFits,
  type SourcePrimitiveBinaryOperator, type SourcePrimitiveUnaryOperator } from "./operator-decisions.js";
import { sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";

export type SourceNumericOperationCategory = "number" | "bigint" | "boolean";

export function produceSourceOperatorCategory(context: Pick<SourceSemanticProduction, "input" | "builder">,
  operator: SourcePrimitiveBinaryOperator | SourcePrimitiveUnaryOperator,
  operands: readonly { readonly value: SourceTypeEvidence; readonly literal: SourceLiteralValue | undefined }[],
  site: Node): SourceProductionResult<SourceNumericOperationCategory> {
  const refusal = (message: string) => sourceSemanticRefusal(site, message);
  const comparison = operator === "less" || operator === "less-equal" || operator === "greater" || operator === "greater-equal" ||
    operator === "equal" || operator === "not-equal" || operator === "equal-strict" || operator === "not-equal-strict";
  if (comparison || operator === "logical-not") return { kind: "resolved", value: "boolean" };
  if (operands.length !== 1 && operands.length !== 2) throw new Error("A numeric operation requires its exact original operand vector.");
  const categories: ("number" | "bigint")[] = [];
  for (const operand of operands) {
    context.builder.assertEvidence(operand.value);
    const category = operand.value.category;
    if (category.kind !== "known" || category.category !== "number" && category.category !== "bigint")
      return refusal("A numeric operation requires each original operand's exact numeric category.");
    categories.push(category.category);
  }
  if (operator === "shift-left" || operator === "shift-right" || operator === "shift-right-unsigned" ||
    operands.length === 1 || categories.every(category => category === categories[0]))
    return { kind: "resolved", value: categories[0]! };
  if (operator === "divide") return refusal("Division between Number and BigInt categories has no single native truncation law.");
  if (operator !== "add" && operator !== "subtract" && operator !== "multiply" && operator !== "remainder" &&
    operator !== "bit-and" && operator !== "bit-or" && operator !== "bit-xor")
    return refusal("This operation has no admitted mixed Number and BigInt category law.");
  const configured: { readonly index: number; readonly primitive: SourcePrimitiveKind }[] = [];
  for (const [index, operand] of operands.entries()) {
    const original = context.builder.originalComponent(operand.value);
    if (original.kind !== "present") continue;
    const fact = context.input.describe(original.value).primitive;
    if (fact !== undefined && fact.runtimeBase === categories[index] && sourcePrimitiveOperatorIsIntegral(fact.kind))
      configured.push({ index, primitive: fact.kind });
  }
  if (configured.length !== 1) return refusal("A mixed numeric operation requires one authenticated configured native operand category.");
  const native = configured[0]!;
  const numberIndex = categories.indexOf("number");
  const number = operands[numberIndex]!;
  const numberType = number.value.type;
  const exactLiteral = number.literal !== undefined && sourcePrimitiveOperatorLiteralFits(number.literal, native.primitive);
  const exactValue = numberType.kind === "primitive" && numberType.primitive === "int64" && native.primitive === "int64";
  if (!exactLiteral && !exactValue) return refusal("A mixed configured numeric operation requires an exact fitting integer literal or Number-category int64 value.");
  return { kind: "resolved", value: categories[native.index]! };
}

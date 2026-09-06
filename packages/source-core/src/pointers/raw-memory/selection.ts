import type { AstReader, ExtensionFactSubject, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { TsonicRawMemoryOperationFact } from "./facts.js";
import type { TsonicMemoryLayoutFact } from "../../memory-layout/facts.js";
import { readTsonicDataLayout, readTsonicMemoryLayout, readTsonicRawMemoryOperation } from "../../memory-layout/readers.js";
import { dataLayoutsEqual } from "../../memory-layout/facts.js";

export type TsonicRawLocationSelection =
  | { readonly kind: "rejected"; readonly reason: string }
  | { readonly kind: "resolved";
      readonly operation: Extract<TsonicRawMemoryOperationFact, { readonly operation: "to-raw" | "reinterpret" }>;
      readonly expression: Node; readonly layout: TsonicMemoryLayoutFact };

export function selectTsonicRawLocationOperation(
  ast: AstReader,
  facts: ReadonlySourceFactResolver,
  subject: ExtensionFactSubject,
): TsonicRawLocationSelection | undefined {
  const operation = readTsonicRawMemoryOperation(facts, subject);
  if (operation?.operation !== "to-raw" && operation?.operation !== "reinterpret") return undefined;
  const expression = operation.operation === "to-raw" ? operation.pointerExpression : operation.rawExpression;
  const arguments_ = ast.arguments(operation.call);
  const layout = readTsonicMemoryLayout(facts, operation.layoutExpression);
  const abi = layout === undefined ? undefined : readTsonicDataLayout(facts, layout.dataLayoutExpression);
  if (operation.call !== subject || arguments_.length !== 2 || arguments_[0] !== expression ||
    arguments_[1] !== operation.layoutExpression || layout === undefined || abi === undefined ||
    !dataLayoutsEqual(abi, layout.dataLayout)) {
    return Object.freeze({ kind: "rejected" as const,
      reason: "Raw location conversion requires its exact selected operands and finalized layout/ABI identity." });
  }
  return Object.freeze({ kind: "resolved" as const, operation, expression, layout });
}

import type { Node } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import type { SourceTypeDescriptor } from "./types.js";

// The awaited payload of an await operand from the operand's own descriptor: the declared type argument identical to the
// checker's awaited type (the same rule as async returns). A non-thenable operand is its own payload.
export function sourceTypeFlowAwaitedPayload(queries: SourceFileSemantics, operand: Node,
  described: SourceTypeDescriptor | undefined): SourceTypeDescriptor | undefined {
  const actual = queries.types.expressionType(operand);
  const awaited = actual === undefined ? undefined : queries.types.awaitedType(actual);
  if (actual === undefined || awaited === undefined || described === undefined) return undefined;
  if (queries.types.isIdentical(actual, awaited)) return described;
  const arguments_ = queries.types.typeArguments(actual);
  const index = arguments_.findIndex(argument => queries.types.isIdentical(argument, awaited));
  return described.kind === "declared" && index >= 0 ? described.typeArguments[index] : undefined;
}

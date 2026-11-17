import type { Node } from "@tsonic/tsts";
import { sourceBooleanLiteralDisposition, sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import type { SourceFlowConstruction } from "./construction.js";
import { SourceFlowRefusal } from "./resources.js";

export function sourceFlowBooleanEdges(build: SourceFlowConstruction, point: number, condition: Node,
  whenTrue: () => number, whenFalse: () => number): void {
  const selected = build.source.facts.values.type(condition);
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  const disposition = sourceBooleanLiteralDisposition(build.literalDomain(selected.value));
  if (disposition !== "false") build.edge(point, whenTrue(), "true");
  if (disposition !== "true") build.edge(point, whenFalse(), "false");
}

export function sourceFlowNullishEdges(build: SourceFlowConstruction, point: number, condition: Node,
  nullish: () => number, present: () => number): void {
  const selected = build.source.facts.values.type(condition);
  if (selected.kind === "refused") throw new SourceFlowRefusal(selected);
  const disposition = sourcePresenceLiteralDisposition(build.literalDomain(selected.value));
  if (disposition !== "present") build.edge(point, nullish(), "nullish");
  if (disposition !== "absent") build.edge(point, present(), "present");
}

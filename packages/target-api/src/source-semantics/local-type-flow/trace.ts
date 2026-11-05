import type { Node } from "@tsonic/tsts";
import type { SourceTypeFlowSource } from "./types.js";

export type SourceTypeFlowTraceFacts = Readonly<Record<string, string | number | boolean | undefined>>;
type Observer = (source: SourceTypeFlowSource, node: Node, step: string, facts: SourceTypeFlowTraceFacts) => void;
let observer: Observer | undefined;
let subject: Node | undefined;

export function withSourceTypeFlowTraceSubject<Value>(node: Node, read: () => Value): Value {
  if (observer === undefined) return read();
  const previous = subject;
  if (previous === undefined) subject = node;
  try { return read(); } finally { subject = previous; }
}

export function withSourceTypeFlowTrace<Value>(observe: Observer, read: () => Value): Value {
  const previous = observer;
  observer = observe;
  try { return read(); } finally { observer = previous; }
}

export function traceSourceTypeFlow(source: SourceTypeFlowSource, node: Node | undefined, step: string,
  facts: () => SourceTypeFlowTraceFacts): void {
  const occurrence = node ?? subject;
  if (observer !== undefined && occurrence !== undefined) observer(source, occurrence, step, facts());
}

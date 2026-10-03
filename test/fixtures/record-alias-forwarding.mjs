export const recordAliasForwardingFiles = {
  "types.ts": `
import type { int32 } from "@tsonic/core/types.js";
export type Dictionary<T> = Record<string, T>;
export type Values = Dictionary<int32>;
export type RecordAlias = Record<string, unknown>;
export type Nested = RecordAlias;
export type Body = string | number | boolean | null | Nested | unknown[];
export type Listener<T> = (...args: T[]) => void;
export type EventListener = Listener<unknown>;
`,
  "index.ts": `
import type { Body, Dictionary, Nested, Values } from "./types.js";
class Reply {
  count: number = 0;
  send(body: Nested): this;
  send(body?: Body): this;
  send(body?: Body): this { return this.write(body); }
  end(body?: Body): this { return this.send(body); }
  private write(body?: Body): this {
    if (body === null || body === undefined) this.count += 1;
    else this.count += 2;
    return this;
  }
}
function update(values: Values): void { values["count"] = 17; }
function forward(values: Dictionary<unknown>): Nested { return values; }
export function run(): boolean {
  const reply = new Reply();
  const body: Nested = { count: 3 };
  const values: Values = { count: 2 };
  update(values);
  const aliased = forward(body);
  aliased["count"] = 9;
  if (body["count"] !== 9 || values["count"] !== 17) return false;
  return reply.send(body).end("text").end().count === 5;
}
`,
};

export const recordAliasListenerFiles = {
  "types.ts": recordAliasForwardingFiles["types.ts"],
  "index.ts": `
import type { Dictionary, EventListener } from "./types.js";
function add(values: Dictionary<EventListener[] | undefined>, listener: EventListener): void {
  const listeners = values["event"] ?? [];
  listeners.push(listener);
  values["event"] = listeners;
}
export function run(): boolean {
  const listeners: Dictionary<EventListener[] | undefined> = {};
  const listener: EventListener = (...args: unknown[]): void => {};
  add(listeners, listener);
  const selected = listeners["event"];
  return selected !== undefined && selected.length === 1 && selected[0] === listener;
}
`,
};

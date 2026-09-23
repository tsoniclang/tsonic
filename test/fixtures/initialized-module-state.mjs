export const initializedModuleStateFiles = Object.freeze({
  "address.ts": `
import { addressOf, loadPointer, storePointer, equalPointer } from "@tsonic/core/lang.js";
import { state, constant, writable } from "./state.js";
export function writeCount(): boolean {
  const first = addressOf(state.count);
  const second = addressOf(state.count);
  storePointer(first, 10);
  return equalPointer(first, second) && loadPointer(second) === 10 &&
    constant === 7 && loadPointer(addressOf(writable)) === 13;
}
`,
  "state.ts": `
import type { int32 } from "@tsonic/core/types.js";
import type { Payload } from "./values.js";
export class State {
  count: int32;
  payload: Payload;
  constructor(count: int32, payload: Payload) {
    this.count = count;
    this.payload = payload;
  }
}
export let state: State;
export let assigned: State;
export const constant: int32 = 7;
export let writable: int32 = 13;
export function initializeState(count: int32, payload: Payload): void {
  state = new State(count, payload);
}
export function assignValue(count: int32, payload: Payload): State {
  return assigned = new State(count, payload);
}
`,
  "values.ts": `
import { state } from "./state.js";
export class Payload {
  text: string;
  constructor(text: string) { this.text = text; }
}
export function advance(): void {
  state.count++;
  state.payload.text += "!";
}
`,
  "index.ts": `
import type { int32 } from "@tsonic/core/types.js";
import { state, assigned, initializeState, assignValue } from "./state.js";
import { Payload, advance } from "./values.js";
import { writeCount } from "./address.js";
export function run(): boolean {
  const count: int32 = 0;
  const payload = new Payload("ready");
  const assignment = assignValue(count, payload);
  if (assignment !== assigned || assigned.payload !== payload) return false;
  initializeState(count, payload);
  const alias = state;
  advance();
  advance();
  if (alias.count !== 2 || state.count !== 2 || payload.text !== "ready!!" ||
    alias.payload !== payload || state !== alias) return false;
  const nextCount: int32 = 10;
  initializeState(nextCount, new Payload("next"));
  if (!writeCount()) return false;
  advance();
  const current = state;
  return current.count === 11 && current.payload.text === "next!" &&
    alias.count === 2 && alias.payload === payload && current !== alias;
}
`,
});

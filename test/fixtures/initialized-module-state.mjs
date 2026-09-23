export const initializedModuleStateFiles = Object.freeze({
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
export function initializeState(count: int32, payload: Payload): void {
  state = new State(count, payload);
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
import { state, initializeState } from "./state.js";
import { Payload, advance } from "./values.js";
export function run(): boolean {
  const count: int32 = 0;
  const payload = new Payload("ready");
  initializeState(count, payload);
  const alias = state;
  advance();
  advance();
  return alias.count === 2 && state.count === 2 &&
    payload.text === "ready!!" && alias.payload === payload && state === alias;
}
`,
});

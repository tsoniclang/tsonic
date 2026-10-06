export const nativeErrorTransportCases = Object.freeze([
  ["caught-typed-scalar", `
import type { uint64 } from "@tsonic/core/types.js";
const exact: uint64 = 9007199254740993n;
function fail(): never { throw exact; }
function capture(): unknown { try { fail(); } catch (error) { return error; } }
export function main(): void {
  const result = capture();
  if (result instanceof Error || result !== exact) throw new Error("typed scalar payload lost precision or category");
}
`],
  ["async-object-unit", `
async function fail(): Promise<void> { throw new Error("selected rejection"); }
const api = { async dispatch(): Promise<void> { await fail(); } };
export async function main(): Promise<void> {
  let caught = false;
  try { await api.dispatch(); } catch { caught = true; }
  if (!caught) throw new Error("async object method lost its rejection");
}
`],
  ["caught-record-contribution", `
interface Envelope { value: unknown; }
const failure = new Error("selected rejection");
function fail(): never { throw failure; }
function capture(): Envelope {
  try { fail(); } catch (error) { return { value: error }; }
}
export function main(): void {
  const result = capture();
  if (!(result.value instanceof Error) || result.value !== failure) {
    throw new Error("record contribution lost its error");
  }
}
`],
  ["caught-project-error", `
class Failure extends Error {}
interface Envelope { value: unknown; }
const failure = new Failure("selected rejection");
function fail(): never { throw failure; }
function capture(): Envelope {
  try { fail(); } catch (error) { return { value: error }; }
}
export function main(): void {
  const result = capture();
  if (!(result.value instanceof Error) || result.value !== failure) {
    throw new Error("project record contribution lost its error");
  }
}
`],
  ["caught-closed-payload", `
interface Envelope { value: unknown; }
const payload: unknown = "selected value";
function fail(): never { throw payload; }
function capture(): Envelope {
  try { fail(); } catch (error) { return { value: error }; }
}
export function main(): void {
  const result = capture();
  if (result.value instanceof Error || result.value !== payload) {
    throw new Error("non-Error record contribution changed its payload");
  }
}
`],
].map(row => Object.freeze(row)));

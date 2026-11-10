export const retainedLexicalCompletionsSource = `
import type { int32 } from "@tsonic/core/types.js";
export function counter(): () => Promise<int32> {
  let count = 0 as int32;
  async function next(): Promise<int32> { count += 1; return count; }
  return next;
}
export function owned<Value>(value: Value): Promise<Value> {
  async function read(): Promise<Value> { return value; }
  return read();
}
export function repeated(value: string): Promise<string> {
  async function read(): Promise<string> { return value; }
  async function combined(): Promise<string> { return await read() + await read(); }
  return combined();
}
export function throwing(failure: Error): Promise<void> {
  async function reject(): Promise<void> { throw failure; }
  return reject();
}
export async function main(): Promise<void> {
  const first = counter();
  const second = counter();
  if (await first() !== 1 || await first() !== 2 || await second() !== 1 || await first() !== 3)
    throw new Error("retained mutable lexical capture");
  if (await owned(17 as int32) !== 17 || await owned("retained") !== "retained" ||
    await repeated("twice") !== "twicetwice") throw new Error("owned lexical capture");
  const failure = new Error("retained lexical failure");
  let caught = false;
  try { await throwing(failure); }
  catch (actual) { if (actual !== failure) throw new Error("retained thrown identity"); caught = true; }
  if (!caught) throw new Error("retained failure missing");
}
`;

export const caughtErrorProofFiles = Object.freeze({
  "failures.ts": `
export function fail(error: Error): void { throw error; }
export function restore(error: Error): Error {
  try { fail(error); }
  catch (failure) {
    if (failure instanceof Error) return failure;
    throw failure;
  }
  throw new Error("unreachable successful throw");
}
`,
  "index.ts": `
import { fail, restore } from "./failures.js";
export function run(): boolean {
  const original = new Error("retained");
  const before = original.stack;
  const recovered = restore(original);
  if (recovered !== original || recovered.name !== "Exception" || recovered.message !== "retained") return false;
  if (before !== undefined || recovered.stack === undefined) return false;
  let checked = false;
  let cleaned = 0;
  try {
    try { fail(recovered); }
    catch (failure) {
      if (!(failure instanceof Error)) return false;
      if (failure !== original || failure.message !== "retained" || failure.stack === undefined) return false;
      throw failure;
    } finally { cleaned += 1; }
  } catch (failure) {
    if (failure instanceof Error) checked = failure === original && failure.stack !== undefined;
  }
  return checked && cleaned === 1;
}
`,
});

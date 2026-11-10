export const lexicalFallibilitySource = `
import type { int32 } from "@tsonic/core/types.js";
export function unused(): int32 {
  function dormant(): int32 { throw new Error("must remain deferred"); }
  return 23 as int32;
}
export function forward(error: Error): never {
  function fail(): never { throw error; }
  function through(): never { return fail(); }
  return through();
}
export function caught(error: Error): boolean {
  try { forward(error); }
  catch (failure) { return failure === error; }
}
export function run(): boolean {
  const error = new Error("original lexical error");
  return unused() === 23 && caught(error);
}
`;

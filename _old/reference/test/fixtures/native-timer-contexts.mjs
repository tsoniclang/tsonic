export const nativeTimerCompletionSource = String.raw`
import { setTimeout as nodeTimeout, clearTimeout as nodeClear } from "node:timers";
export function main(): void {
  const cancelled = nodeTimeout(() => { throw new Error("cancelled callback executed"); }, 0);
  nodeClear(cancelled);
  setTimeout(() => {
    nodeTimeout(() => { console.log("native timer completion"); }, 0);
  }, 0);
}
`;

export const nativeTimerOriginalErrorSource = String.raw`
import { setTimeout as nodeTimeout } from "node:timers";
let completed = 0;
export function schedule(): Error {
  const original = new Error("original timer failure");
  setTimeout(() => {
    nodeTimeout(() => { completed += 1; }, 0);
    throw original;
  }, 0);
  return original;
}
export function count(): number { return completed; }
`;

export const nativeJsTimerCompletionSource = String.raw`
export function main(): void {
  const cancelled = setTimeout(() => { throw new Error("cancelled callback executed"); }, 0);
  clearTimeout(cancelled);
  setTimeout(() => { console.log("native timer completion"); }, 0);
}
`;

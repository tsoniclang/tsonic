export const closedErrorInputsSource = `
import type { int32 } from "@tsonic/core/types.js";
class DetailedError extends Error { constructor() { super("detailed"); } }
interface NativeFailure { readonly message: string; readonly native: boolean; }
type Failure = Error | NativeFailure;
function accept(error: Failure, expected: Error): boolean {
  if (!(error instanceof Error)) return false;
  return error === expected && error.message === expected.message;
}
function isError(error: Failure): boolean { return error instanceof Error; }
function classify(error: Failure | undefined): int32 {
  if (error instanceof RangeError) return 1;
  if (error instanceof TypeError) return 2;
  if (error instanceof URIError) return 3;
  return error instanceof Error ? 4 : 0;
}
function fallback(reason: unknown): boolean {
  return isError(reason instanceof Error ? reason : new Error("fallback"));
}
export function narrow(reason: unknown, expected: Error): boolean {
  return accept(reason instanceof Error ? reason : expected, expected);
}
export function keep(error: DetailedError): string { return error.message; }
export function run(count: int32 = 10_000): boolean {
  const original = new RangeError("closed Error");
  if (!fallback(original) || !fallback(7)) return false;
  const detailed = new DetailedError();
  if (classify(original) !== 1 || classify(new TypeError("type")) !== 2 ||
    classify(new URIError("uri")) !== 3 || classify(detailed) !== 4 ||
    classify({ message: "native", native: true }) !== 0 || classify(undefined) !== 0) return false;
  let evaluations: int32 = 0;
  const select = (): Failure => { evaluations++; return original; };
  if (!(select() instanceof RangeError) || evaluations !== 1) return false;
  for (let index: int32 = 0; index < count; index++) {
    if (!narrow(original, original) || !narrow(7, original)) return false;
  }
  return true;
}
`;

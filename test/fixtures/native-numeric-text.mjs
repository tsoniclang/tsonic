export const nativeNumericTextFunctions = `
import type { float32, int64, uint64, nativeUint } from "@tsonic/core/types.js";
export function exactWord(): nativeUint { return 9007199254740993; }
export function signedText(value: int64): string { return value.toString(); }
export function unsignedHex(value: uint64): string { return value.toString(16); }
export function preciseSingle(value: float32): string { return value.toString(); }
export function fixedSingle(value: float32): string { return value.toFixed(2); }
export function wideIntegerText(value: bigint): string { return value.toString(); }
export function wideIntegerHex(value: bigint): string { return value.toString(16); }
export function nativePredicates(value: int64): boolean { return isFinite(value) && !isNaN(value); }
export function copyTyped(values: Int16Array): Uint8Array { return new Uint8Array(values); }
export function assignTyped(target: Uint8Array, source: Int16Array): void { target.set(source); }
export function jsNumericApiContract(): boolean {
  const source = new Int16Array([-1, 256]);
  const target = new Uint8Array(source);
  return Math.round(-1.5) === -1 && Number.isNaN(Math.min(Number.NaN, 1)) &&
    Math.imul(4294967297, 2) === 2 && Math.clz32(Number.NaN) === 32 &&
    parseInt("123suffix", 10) === 123 && parseFloat("1.5tail") === 1.5 &&
    Number("") === 0 && Number.isNaN(Number("123suffix")) &&
    (12.5).toExponential(1) === "1.3e+1" && (1.25).toPrecision(2) === "1.3" &&
    target[0] === 255 && target[1] === 0;
}
`;

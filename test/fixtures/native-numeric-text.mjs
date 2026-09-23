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
`;

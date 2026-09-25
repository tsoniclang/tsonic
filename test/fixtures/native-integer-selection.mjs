export const nativeIntegerSelectionSource = `
import type { int8, int32, uint32 } from "@tsonic/core/types.js";
function integerCopy(value: int32): int32 { value++; return value; }
export function forwardedCount(bound: int32): int32 {
  let sum: int32 = 0;
  for (let index = 0; index < bound; index++) sum += integerCopy(index);
  return sum;
}
export function boundedCount(bound: int8): int32 {
  let count: int32 = 0;
  for (let counter = 0; counter < bound; counter++) count++;
  return count;
}
export function reverseCount(values: string[]): int32 {
  let count: int32 = 0;
  for (let remaining = values.length; remaining > 0; remaining--) count++;
  return count;
}
export function exiting(values: string[]): string {
  let result = "";
  for (let counter = 0; counter < values.length; counter++) {
    if (counter === 0) continue;
    if (counter === 2) break;
    result += values[counter]!;
  }
  return result;
}
export function counted(values: string[]): string {
  let result = "";
  for (let index = 0; index < values.length; index++) result += values[index]!;
  return result;
}
export function growing(): string {
  const values = ["a"];
  let result = "";
  for (let index = 0; index < values.length; index++) {
    result += values[index]!;
    if (index === 0) values.push("b");
  }
  return result;
}
export function fractional(values: string[]): number {
  let result = 0;
  for (let index = 0; index < values.length; index++) result += index / 2;
  return result;
}
export function annotated(values: string[]): number {
  let result = 0;
  for (let index: number = 0; index < values.length; index++) result += index / 2;
  return result;
}
export function mutableCounter(values: string[]): number {
  let result = 0;
  for (let index = 0; index < values.length; index++) { result += index; index += 0.5; }
  return result;
}
export function integralFloor(value: int32) { return Math.floor(value); }
export function compoundFloor(low: int32, high: int32) { return low + Math.floor((high - low) / 2); }
export function negatedFloor(low: int32, high: int32) { return Math.floor(-((high - low) / 2)); }
const firstCount = (): int32 => 7;
const secondCount = (): int32 => 11;
export function calledConditionalLiteral(choice: boolean) { return choice ? firstCount() : 0; }
export function calledConditional(choice: boolean) {
  try {
    const count = choice ? firstCount() : secondCount();
    return count;
  } catch {
    return firstCount();
  }
}
export function fractionalFloor(value: number) { return Math.floor(value); }
export function conditional(left: int32, right: int32, choice: boolean) {
  const value = choice ? left : right;
  return value;
}
export function conditionalLiteral(value: int32, choice: boolean) {
  const selected = choice ? value : 0;
  return selected;
}
export function conditionalFraction(value: int32, choice: boolean) { return choice ? value : 0.5; }
export function explicitFloat(left: int32, right: int32, choice: boolean): number {
  const value: number = choice ? left : right;
  return value;
}
export function promoted(left: int32, right: uint32, choice: boolean) { return choice ? left : right; }
export function optional(value: int32, choice: boolean) { return choice ? value : undefined; }
export function optionalBranch(value: int32 | undefined, choice: boolean) { return choice ? value : undefined; }
let branchCalls: int32 = 0;
function once(value: int32): int32 { branchCalls++; return value; }
export function nested(value: int32, choice: boolean, other: boolean) {
  const result = choice ? (other ? once(value) : once(0)) : once(-1);
  return result;
}
export function shadowed(value: number): number {
  const Math = { floor(input: number): number { return input + 0.25; } };
  return Math.floor(value);
}
export function run(): boolean {
  return forwardedCount(4) === 10 && forwardedCount(0) === 0 &&
    boundedCount(127) === 127 && boundedCount(0) === 0 && boundedCount(-1) === 0 &&
    reverseCount(["a", "b"]) === 2 && reverseCount([]) === 0 &&
    exiting(["a", "b", "c"]) === "b" && counted(["a", "b", "c"]) === "abc" && counted([]) === "" && growing() === "ab" &&
    fractional(["a", "b", "c"]) === 1.5 && annotated(["a", "b", "c"]) === 1.5 &&
    mutableCounter(["a", "b", "c"]) === 1.5 &&
    integralFloor(-3) === -3 && compoundFloor(2, 9) === 5 && compoundFloor(-9, -2) === -6 &&
    negatedFloor(2, 9) === -3 &&
    calledConditional(true) === 7 && calledConditional(false) === 11 &&
    calledConditionalLiteral(true) === 7 && calledConditionalLiteral(false) === 0 && fractionalFloor(-2.5) === -3 &&
    conditional(17, -9, true) === 17 && conditional(17, -9, false) === -9 &&
    conditionalLiteral(17, false) === 0 && conditionalFraction(17, false) === 0.5 &&
    explicitFloat(1, 2, false) === 2 && promoted(-1, 4294967295, false) === 4294967295 &&
    shadowed(2) === 2.25 && Number.isNaN(fractionalFloor(Number.NaN)) &&
    fractionalFloor(Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY &&
    fractionalFloor(Number.NEGATIVE_INFINITY) === Number.NEGATIVE_INFINITY &&
    optional(9, true) === 9 && optional(9, false) === undefined &&
    optionalBranch(9, true) === 9 && optionalBranch(undefined, true) === undefined &&
    optionalBranch(9, false) === undefined &&
    nested(9, true, true) === 9 && branchCalls === 1;
}
`;

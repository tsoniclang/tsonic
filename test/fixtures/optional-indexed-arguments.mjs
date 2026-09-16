export const optionalIndexedArgumentsSource = `
import type { int32 } from "@tsonic/core/types.js";
let reads = 0;
function readCount(): number { return reads; }
function index(value: number): number { reads++; return value; }
function accept(value: string | undefined): string { return value === undefined ? "absent" : value; }
function optional(value?: string): string { return accept(value); }
function defaulted(value: string = "default"): string { return value; }
function required(value: string): string { return value; }
function indexed(values: string[], position: int32 | undefined): string | undefined {
  if (position === undefined) return undefined;
  return values[position];
}
function character(value: string, position: int32 | undefined): string {
  if (position === undefined) return "absent";
  return required(value[position]!);
}
function retained(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value;
}
function effectful(value: string | undefined): string | undefined {
  if (value === undefined) { reads++; return undefined; }
  return value;
}
function observed(value: string | undefined): string | undefined { reads++; return value; }
function computed(value: string | undefined): string | undefined {
  if (observed(value) === undefined) return undefined;
  return "present";
}
class Data { values: string[] = ["first"]; }
class Receiver { accept(value: string | undefined): string { return accept(value); } }
export function run(): boolean {
  const data = new Data();
  const receiver = new Receiver();
  reads = 0;
  const present = accept(data.values[index(0)]);
  const missing = accept(data.values[index(9)]);
  return present === "first" && missing === "absent" && readCount() === 2 &&
    accept((data.values[0])) === "first" && accept((data.values[9])) === "absent" &&
    accept(data.values[9] satisfies string) === "absent" &&
    optional(data.values[0]) === "first" && optional(data.values[9]) === "absent" &&
    defaulted(data.values[0]) === "first" && defaulted(data.values[9]) === "default" &&
    receiver.accept(data.values[0]) === "first" && receiver.accept(data.values[9]) === "absent" &&
    required(data.values[0]) === "first" &&
    indexed(data.values, 0 as int32) === "first" && indexed(data.values, undefined) === undefined &&
    character("first", 0 as int32) === "f" && character("first", undefined) === "absent" &&
    retained("first") === "first" && retained(undefined) === undefined &&
    effectful(undefined) === undefined && effectful("first") === "first" && readCount() === 3 &&
    computed(undefined) === undefined && computed("first") === "present" && readCount() === 5;
}
`;

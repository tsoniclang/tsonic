export const assignmentWriteEffectCases = Object.freeze([
  Object.freeze({
    id: "W1",
    name: "computed value-struct assignment retains its complete write scope",
    source: `
import { field, struct } from "@tsonic/core/lang.js";
import type { int32 } from "@tsonic/core/types.js";
const Point = struct({ x: field<int32>() });
type Point = typeof Point;
let events = 0;
function key(): "x" { events = events * 10 + 2; return "x"; }
function operand(): int32 { events = events * 10 + 4; return 7; }
export function run(): boolean {
  let point: Point = { x: 1 };
  const assigned = (point[key()] = operand());
  return events === 24 && assigned === 7 && point.x === 7;
}
`,
  }),
  Object.freeze({
    id: "W2",
    name: "computed assignment captures its receiver before the key replaces it",
    source: `
let events = 0;
class Named {
  value = 3;
  read(): number { return this.value; }
}
const original = new Named();
const replacement = new Named();
let selected = original;
function receiver(): Named { events = events * 10 + 1; return selected; }
function key(): "value" { events = events * 10 + 2; selected = replacement; return "value"; }
function operand(): number { events = events * 10 + 4; return 7; }
export function run(): boolean {
  const assigned = (receiver()[key()] = operand());
  return events === 124 && assigned === 7 && original.read() === 7 && replacement.read() === 3;
}
`,
  }),
  Object.freeze({
    id: "W3",
    name: "computed compound assignment retains getter operand and setter order",
    source: `
let events = 0;
class Named {
  private value = 3;
  get count(): number { events = events * 10 + 3; return this.value; }
  set count(value: number) { events = events * 10 + 5; this.value = value; }
}
const original = new Named();
function receiver(): Named { events = events * 10 + 1; return original; }
function key(): "count" { events = events * 10 + 2; return "count"; }
function operand(): number { events = events * 10 + 4; return 7; }
export function run(): boolean {
  const assigned = (receiver()[key()] += operand());
  const ordered = events === 12345 && assigned === 10;
  return ordered && original.count === 10;
}
`,
  }),
  Object.freeze({
    id: "W4",
    name: "computed nullish assignment keeps operand and store in the absent branch",
    source: `
let events = 0;
class Named { value: number | undefined = undefined; }
const original = new Named();
function receiver(): Named { events = events * 10 + 1; return original; }
function key(): "value" { events = events * 10 + 2; return "value"; }
function operand(): number { events = events * 10 + 4; return 7; }
export function run(): boolean {
  const first = (receiver()[key()] ??= operand());
  const absent = events === 124 && first === 7;
  events = 0;
  const second = (receiver()[key()] ??= operand());
  return absent && events === 12 && second === 7 && original.value === 7;
}
`,
  }),
]);

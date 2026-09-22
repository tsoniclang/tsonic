export const classStructuralConversionFiles = Object.freeze({
  "model.ts": `
export class Counter {
  count: number;
  extra: boolean = true;
  reads: number = 0;
  constructor(count: number) { this.count = count; }
  get score(): number { this.reads += 1; return this.count; }
  set score(value: number) {
    if (value < 0) throw new Error("negative");
    this.count = value;
  }
  add(value: number = 3): number { this.count += value; return this.count; }
}
export class Child extends Counter { child: boolean = true; }
export class Box<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
}
`,
  "index.ts": `
import { Counter, Child, Box } from "./model.js";
type Count = { count: number };
type Score = { score: number };
type Action = { add(value?: number): number };
type Read<Value> = { readonly value: Value };
function returned(value: Counter): Count { return value; }
function count(value: Counter): number { return value.count; }
function increase(value: Count): void { value.count = value.count + 1; }
function readonlyView<Value>(value: Box<Value>): Read<Value> { return value; }
export function run(): boolean {
  const counter = new Counter(2);
  const assigned: Count = counter;
  const alias = assigned;
  const returnedView = returned(counter);
  increase(counter);
  assigned.count = 7;
  if (count(counter) !== 7 || alias !== assigned || returnedView !== assigned) return false;
  const values: Count[] = [counter, { count: 20 }];
  values[0]!.count = 8;
  if (count(counter) !== 8 || values[1]!.count !== 20) return false;
  const score: Score = counter;
  if (score.score !== 8 || counter.reads !== 1) return false;
  score.score = 9;
  let caught = false;
  try { score.score = -1; } catch { caught = true; }
  if (!caught || count(counter) !== 9) return false;
  const action: Action = counter;
  if (action.add() !== 12 || count(counter) !== 12) return false;
  const child = new Child(30);
  const inherited: Count = child;
  inherited.count = 31;
  if (child.count !== 31 || !child.child) return false;
  const inheritedAction: Action = child;
  if (inheritedAction.add() !== 34 || count(child) !== 34) return false;
  const box = new Box<string>("original");
  const projected = readonlyView(box);
  box.value = "changed";
  if (projected.value !== "changed" || readonlyView(new Box<number>(4)).value !== 4) return false;
  const optional: { readonly value?: string } = box;
  return optional.value === "changed";
}
`,
});

export const invalidClassStructuralConversions = Object.freeze([
  `class Value { readonly count: number = 1; }
   const result: { count: string } = new Value();`,
  `class Value { get count(): number { return 1; } }
   const result: { readonly count: number } = new Value();
   result.count = 2;`,
]);

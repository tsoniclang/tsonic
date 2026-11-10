export const frozenObjectSources = {
  "compound-order": `
function change(value: {count: number}, freeze: boolean): number {
  value.count = 9;
  if (freeze) Object.freeze(value);
  return 2;
}
export function main(): void {
  const value = {count: 1};
  value.count += change(value, false);
  if (value.count !== 3) throw new Error("compound read precedes right operand");
  value.count += change(value, true);
  if (value.count !== 5) throw new Error("readonly view preserves compound read and alias write order");
}
`,
  "module-token": `
const fileType = Object.freeze({ comparable: true });
class File { type: {readonly comparable: boolean}; constructor(type = fileType) { this.type = type; } }
export function main(): void {
  const value = new File();
  if (!value.type.comparable || value.type !== fileType) throw new Error("readonly token identity");
}
`,
  "aliases-and-order": `
function update(value: {count: number}, state: {calls: number}): void { value.count = ++state.calls; }
export function main(): void {
  const value = {count: 2, nested: {count: 3}};
  const alias = value;
  const state = {calls: 0};
  const frozen = Object.freeze(value);
  if (frozen !== alias) throw new Error("identity");
  update(alias, state);
  if (state.calls !== 1 || frozen.count !== 1) throw new Error("mutable alias write");
  alias.nested.count = 8;
  if (value.nested.count !== 8 || frozen.nested !== alias.nested) throw new Error("shallow");
  const other = {count: 1, nested: {count: 1}};
  update(other, state);
  if (other === value || other.count !== 2 || frozen.count !== 1) throw new Error("independent identity");
}
`,
  "accessor-and-data": `
function write(value: {count: number}, next: number): void { value.count = next; }
export function main(): void {
  const state = {count: 1};
  const accessor = { get count(): number { return state.count; }, set count(value: number) { state.count = value; } };
  Object.freeze(accessor);
  write(accessor, 7);
  if (accessor.count !== 7) throw new Error("frozen accessor");
  const data = {count: 2};
  Object.freeze(data);
  write(data, 3);
  if (data.count !== 3) throw new Error("mutable data alias");
}
`,
  "retained-locations": `
import { addressof, loadptr, storeptr } from "@tsonic/core/lang.js";
export function main(): void {
  const value = {count: 2, nested: {count: 4}};
  const pointer = addressof(value.count);
  const nested = addressof(value.nested.count);
  Object.freeze(value);
  storeptr(pointer, 7);
  if (loadptr(pointer) !== 7 || value.count !== 7) throw new Error("retained native location");
  storeptr(nested, 9);
  if (value.nested.count !== 9) throw new Error("reference projection");
}
`,
  "class-view": `
class Counter { count = 1; increment(): void { this.count += 1; } }
function freeze(value: {count: number}): void { Object.freeze(value); }
export function main(): void {
  const counter = new Counter();
  freeze(counter);
  counter.increment();
  if (counter.count !== 2) throw new Error("mutable class alias");
}
`,
  "assign-and-method-write": `
class Counter { count = 1; value(): number { return this.count; } }
function freeze(value: {count: number}): void { Object.freeze(value); }
export function main(): void {
  const record = {count: 1};
  Object.freeze(record);
  Object.assign(record, {count: 9});
  const counter = new Counter();
  freeze(counter);
  counter.value = (): number => 7;
  if (record.count !== 9 || counter.value() !== 7) throw new Error("mutable alias routes");
}
`,
};

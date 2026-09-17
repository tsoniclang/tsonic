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
  let failed = false;
  try { value.count += change(value, true); } catch (error) { if (!(error instanceof TypeError)) throw error; failed = true; }
  if (!failed || value.count !== 9) throw new Error("freeze precedes final write");
}
`,
  "module-token": `
const fileType = Object.freeze({ comparable: true });
class File { type: {readonly comparable: boolean}; constructor(type = fileType) { this.type = type; } }
export function main(): void {
  const value = new File();
  if (!value.type.comparable || !Object.isFrozen(fileType) || value.type !== fileType) throw new Error("frozen token");
}
`,
  "aliases-and-order": `
function update(value: {count: number}, state: {calls: number}): void { value.count = ++state.calls; }
export function main(): void {
  const value = {count: 2, nested: {count: 3}};
  const alias = value;
  const state = {calls: 0};
  const frozen = Object.freeze(value);
  if (frozen !== alias || !Object.isFrozen(alias)) throw new Error("identity");
  let failed = false;
  try { update(alias, state); } catch (error) { if (!(error instanceof TypeError)) throw error; failed = true; }
  if (!failed || state.calls !== 1 || value.count !== 2) throw new Error("frozen write");
  alias.nested.count = 8;
  if (value.nested.count !== 8 || Object.isFrozen(value.nested)) throw new Error("shallow");
  const other = {count: 1, nested: {count: 1}};
  update(other, state);
  if (Object.isFrozen(other) || other.count !== 2) throw new Error("independent identity");
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
  let failed = false;
  try { write(data, 3); } catch (error) { if (!(error instanceof TypeError)) throw error; failed = true; }
  if (!failed || data.count !== 2) throw new Error("data arm");
}
`,
  "retained-locations": `
import { addressOf, loadPointer, storePointer } from "@tsonic/core/lang.js";
export function main(): void {
  const value = {count: 2, nested: {count: 4}};
  const pointer = addressOf(value.count);
  const nested = addressOf(value.nested.count);
  Object.freeze(value);
  let failed = false;
  try { storePointer(pointer, 7); } catch (error) { if (!(error instanceof TypeError)) throw error; failed = true; }
  if (!failed || loadPointer(pointer) !== 2) throw new Error("retained location");
  storePointer(nested, 9);
  if (value.nested.count !== 9) throw new Error("reference projection");
}
`,
  "class-view": `
class Counter { count = 1; increment(): void { this.count += 1; } }
function freeze(value: {count: number}): void { Object.freeze(value); }
export function main(): void {
  const counter = new Counter();
  freeze(counter);
  let failed = false;
  try { counter.increment(); } catch (error) { if (!(error instanceof TypeError)) throw error; failed = true; }
  if (!failed || counter.count !== 1 || !Object.isFrozen(counter)) throw new Error("class view");
}
`,
  "assign-and-method-write": `
class Counter { count = 1; value(): number { return this.count; } }
function freeze(value: {count: number}): void { Object.freeze(value); }
export function main(): void {
  const record = {count: 1};
  Object.freeze(record);
  let rejected = 0;
  try { Object.assign(record, {count: 9}); } catch (error) { if (!(error instanceof TypeError)) throw error; rejected += 1; }
  const counter = new Counter();
  freeze(counter);
  try { counter.value = (): number => 7; } catch (error) { if (!(error instanceof TypeError)) throw error; rejected += 1; }
  if (rejected !== 2 || record.count !== 1 || counter.value() !== 1) throw new Error("frozen mutation routes");
}
`,
};

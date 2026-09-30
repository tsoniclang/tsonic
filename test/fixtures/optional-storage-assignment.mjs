export const optionalStorageAssignmentSource = `
import type { int64 } from "@tsonic/core/types.js";
class Value { text = "before"; }
class Holder {
  value?: Value;
  constructor(value?: Value) { this.value = value; }
  replace(value?: Value): void { this.value = value; }
  clear(): void { if (this.value !== undefined) this.value = undefined; }
}
interface Slot<Element> { value?: Element; }
class GenericHolder<Element> {
  value?: Element;
  constructor(value?: Element) { this.value = value; }
  replace(value?: Element): void { this.value = value; }
}
function replaceSlot(slot: Slot<Value>, value?: Value): void { slot.value = value; }
function capture(value?: Value): () => Value | undefined {
  let current: Value | undefined = value;
  return () => {
    const previous = current;
    current = undefined;
    return previous;
  };
}
export function run(): boolean {
  const value = new Value();
  const holder = new Holder(value);
  const alias = holder;
  value.text = "after";
  if (holder.value?.text !== "after") return false;
  holder.clear();
  if (alias.value !== undefined) return false;
  holder.replace(value);
  if (holder.value !== value) return false;
  holder.replace();
  const next = capture(value);
  if (holder.value !== undefined || next() !== value || next() !== undefined) return false;
  const generic = new GenericHolder<int64>(9007199254740993n);
  if (generic.value !== 9007199254740993n) return false;
  generic.replace();
  if (generic.value !== undefined) return false;
  if (null !== generic.value) return false;
  generic.replace(0n);
  if (generic.value !== 0n) return false;
  const nullable = new GenericHolder<Value | null>(null);
  if (nullable.value !== undefined) return false;
  nullable.replace(value);
  if (nullable.value !== value) return false;
  nullable.replace();
  if (nullable.value !== null) return false;
  const slot: Slot<Value> = { value };
  replaceSlot(slot);
  if (slot.value !== undefined) return false;
  replaceSlot(slot, value);
  return slot.value === value;
}
`;

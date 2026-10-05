export const borrowedScalarFieldWritesSource = `
interface Point { x: number; y: number; }
class Value {
  point: Point = { x: 1, y: 2 };
  read = (): number => this.point.x;
  change = (value: number): void => { this.point.x = value; };
}
export function parameter(holder: Value, value: number): void { holder.point.x = value; }
export function literal(holder: Value): void { holder.point.x = 11; }
export function storage(holder: Value, value: number): void {
  const selected = value;
  holder.point.x = selected;
}
export function arithmetic(holder: Value, value: number): void { holder.point.x = value + 1; }
function replace(holder: Value, next: Point, value: number): number {
  holder.point = next;
  return value;
}
export function reentrant(holder: Value, next: Point, value: number): void {
  holder.point.x = replace(holder, next, value);
}
class Reader {
  holder: Value;
  next: Point;
  constructor(holder: Value, next: Point) { this.holder = holder; this.next = next; }
  get selected(): number { return replace(this.holder, this.next, 29); }
}
export function accessor(holder: Value, next: Point): void {
  holder.point.x = new Reader(holder, next).selected;
}
export function run(): boolean {
  const holder = new Value();
  const read = holder.read;
  holder.change(7);
  if (read() !== 7) return false;
  parameter(holder, 9);
  literal(holder);
  storage(holder, 13);
  arithmetic(holder, 16);
  if (read() !== 17) return false;
  const original = holder.point;
  const next: Point = { x: 80, y: 90 };
  reentrant(holder, next, 23);
  if (original.x !== 23 || holder.point !== next || holder.point.x !== 80) return false;
  const replacement: Point = { x: 70, y: 60 };
  accessor(holder, replacement);
  return next.x === 29 && holder.point === replacement && read() === 70;
}
`;

export const borrowedScalarFieldFreezeSource = `
export function frozenWrite(): boolean {
  const holder = new Value();
  Object.freeze(holder.point);
  let failed = false;
  try { parameter(holder, 99); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    failed = true;
  }
  return failed && holder.point.x === 1;
}
`;

export const ordinaryScalarFieldWritesSource = `
class Child { count = 0; }
class Parent {
  child: Child;
  constructor(child: Child) { this.child = child; }
  replace(child: Child): void { this.child = child; }
}
class Linked {
  count = 0;
  next: Linked;
  constructor(next: Linked) { this.next = next; }
}
export function distinct(holder: Parent, value: number): void { holder.child.count = value; }
export function identical(holder: Linked, value: number): void { holder.next.count = value; }
export function run(): boolean {
  const child = new Child();
  const parent = new Parent(child);
  distinct(parent, 7);
  return child.count === 7 && parent.child === child;
}
`;

export const ownedFieldSnapshotSource = `
export class OwnedBox<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
}
export class OwnedParent<Value> {
  child: OwnedBox<Value>;
  constructor(child: OwnedBox<Value>) { this.child = child; }
}
export function createOwnedBox<Value>(value: Value): OwnedBox<Value> {
  return new OwnedBox(value);
}
export function createOwnedParent<Value>(value: Value): OwnedParent<Value> {
  return new OwnedParent(createOwnedBox(value));
}
function replaceValue<Value>(parent: OwnedParent<Value>, next: OwnedBox<Value>, value: Value): Value {
  parent.child = next;
  return value;
}
export function ownedWrite<Value>(parent: OwnedParent<Value>, next: OwnedBox<Value>, value: Value): void {
  parent.child.value = replaceValue(parent, next, value);
}
`;

export const ownedFieldSnapshotRunSource = `
export function run(): boolean {
  const parent = createOwnedParent("original");
  const original = parent.child;
  const next = createOwnedBox("replacement");
  ownedWrite(parent, next, "changed");
  return original.value === "changed" && parent.child === next && next.value === "replacement";
}
`;

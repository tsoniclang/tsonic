export const receiverFieldCaptureEdges = [
  { name: "readonly-scalar-copy", asynchronous: false, source: `
class Value {
  readonly value = 7;
  read = (): number => this.value;
}
function escaped(): () => number { return new Value().read; }
export function run(): boolean { const read = escaped(); return read() === 7 && read() === 7; }
` },
  { name: "readonly-late-constructor-write", asynchronous: false, source: `
class Value {
  readonly value: number = 1;
  read = (): number => this.value;
  constructor() { this.value = 7; }
}
export function run(): boolean { const value = new Value(); const read = value.read; return read() === 7 && value.value === 7; }
` },
  { name: "readonly-overridden-field", asynchronous: false, source: `
class Base { readonly value: number = 1; read = (): number => this.value; }
class Derived extends Base { override readonly value: number = 2; }
export function run(): boolean {
  const value: Base = new Derived(); const read = value.read;
  return read() === 2 && value.value === 2;
}
` },
  { name: "readonly-deferred-field", asynchronous: false, source: `
class Value {
  read = (): number => this.value;
  readonly value = 7;
}
export function run(): boolean { const read = new Value().read; return read() === 7; }
` },
  { name: "defaults-private-readonly", asynchronous: false, source: `
class Value {
  private value = 2;
  readonly label = "ready";
  read = (step: number = (this).value): number => this.value + step;
  text = (): string => this.label;
  change(value: number): void { this.value = value; }
}
export function run(): boolean {
  const value = new Value();
  const read = value.read;
  value.change(5);
  return read() === 10 && value.text() === "ready";
}
` },
  { name: "projected-fields", asynchronous: false, source: `
interface Point { x: number; y: number; }
class Value {
  point: Point = { x: 1, y: 2 };
  read = (): number => this.point.x;
  change = (value: number): void => { this.point.x = value; };
}
export function run(): boolean {
  const value = new Value();
  const read = value.read;
  value.change(7);
  if (read() !== 7) return false;
  value.point.x = 11;
  return read() === 11 && value.point.y === 2;
}
` },
  { name: "overridden-fields", asynchronous: false, source: `
class Base { value = 1; read = (): number => this.value; }
class Derived extends Base { override value = 2; }
export function run(): boolean {
  const value = new Derived();
  const base: Base = value;
  const read = base.read;
  base.value = 7;
  return read() === 7 && value.value === 7;
}
` },
  { name: "generic-callable-fields", asynchronous: false, source: `
class Value {
  first = true;
  choose = <T>(left: T, right: T): T => this.first ? left : right;
}
export function run(): boolean {
  const value = new Value();
  const choose = value.choose;
  value.first = false;
  return choose("left", "right") === "right" && choose(3, 4) === 4;
}
` },
  { name: "generic-overridden-fields", asynchronous: false, source: `
class Base<T> {
  value: T;
  read = (): T => this.value;
  constructor(value: T) { this.value = value; }
}
class Derived extends Base<number> { override value = 2; }
export function run(): boolean {
  const first = new Base(3);
  const second = new Derived(1);
  const base: Base<number> = second;
  const read = base.read;
  base.value = 7;
  second.value = 9;
  return first.read() === 3 && read() === 9 && base.value === 9;
}
` },
  { name: "generic-callable-aliases", asynchronous: false, source: `
class Value {
  first = true;
  choose = <T>(left: T, right: T): T => this.first ? left : right;
}
export function run(): boolean {
  const value = new Value();
  const before = value.choose;
  const identical = before === value.choose;
  value.choose = <U>(left: U, right: U): U => left;
  value.first = false;
  return identical && before(1, 2) === 2 && value.choose("left", "right") === "left";
}
` },
  { name: "generic-callable-mutable-captures", asynchronous: false, source: `
function create() {
  let first = true;
  const choose = <T>(left: T, right: T): T => first ? left : right;
  const change = (): void => { first = false; };
  return { choose, change };
}
export function run(): boolean {
  const value = create();
  value.change();
  return value.choose("left", "right") === "right" && value.choose(1, 2) === 2;
}
` },
  { name: "generic-callable-nested-owners", asynchronous: false, source: `
const create = <Outer>(seed: Outer) =>
  <T>(left: T, right: T): T => {
    const held: Outer[] = [seed];
    return held.length !== 0 ? left : right;
  };
export function run(): boolean {
  const first = create(3);
  const second = create("seed");
  return first("left", "right") === "left" && second(1, 2) === 1;
}
` },
  { name: "suspended-fields", asynchronous: true, source: `
async function pause(): Promise<void> {}
class Value {
  value = 1;
  read = async (step: number): Promise<number> => {
    await pause();
    this.value += step;
    return this.value;
  };
}
function escaped(): (step: number) => Promise<number> {
  const value = new Value();
  value.value = 7;
  return value.read;
}
export async function run(): Promise<boolean> {
  const read = escaped();
  if (await read(2) !== 9) return false;
  return await read(3) === 12;
}
` },
];

export const receiverFieldUnconstrainedEqualitySource = `
const create = <Outer>(seed: Outer) =>
  <T>(left: T, right: T): T => seed === seed ? left : right;
export function run(): boolean {
  const first = create(3);
  const second = create("seed");
  return first("left", "right") === "left" && second(1, 2) === 1;
}
`;

export const receiverFieldFreezeSource = `
class Value {
  value = 1;
  change = (): void => { this.value = 2; };
}
export function run(): boolean {
  const value = new Value();
  const change = value.change;
  Object.freeze(value);
  let failed = false;
  try { change(); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    failed = true;
  }
  return failed && value.value === 1 && Object.isFrozen(value);
}
`;

export const receiverFieldFreezeEdges = [
  { name: "escaped-identity", asynchronous: false, source: `
class Value {
  value = 1;
  change = (): void => { this.value = 2; };
}
function escaped(): () => void {
  const value = new Value();
  Object.freeze(value);
  return value.change;
}
export function run(): boolean {
  const change = escaped();
  try { change(); } catch (error) { return error instanceof TypeError; }
  return false;
}
` },
  { name: "inherited-identity", asynchronous: false, source: `
class Base {
  value = 1;
  change = (next: number): void => { this.value = next; };
}
class Derived extends Base { override value = 2; }
function freeze(value: { value: number }): void { Object.freeze(value); }
export function run(): boolean {
  const value = new Derived();
  const base: Base = value;
  const change = base.change;
  freeze(value);
  try { change(7); } catch (error) {
    return error instanceof TypeError && base.value === 2 && value.value === 2;
  }
  return false;
}
` },
  { name: "generic-identity", asynchronous: false, source: `
class Value {
  first = true;
  choose = <T>(left: T, right: T): T => {
    this.first = false;
    return this.first ? left : right;
  };
}
export function run(): boolean {
  const value = new Value();
  const choose = value.choose;
  Object.freeze(value);
  let text = false;
  let numeric = false;
  try { choose("left", "right"); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    text = true;
  }
  try { choose(3, 4); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    numeric = true;
  }
  return text && numeric && value.first;
}
` },
  { name: "suspended-identity", asynchronous: true, source: `
async function pause(): Promise<void> {}
class Value {
  value = 1;
  change = async (): Promise<void> => { await pause(); this.value = 2; };
}
function escaped(): () => Promise<void> {
  const value = new Value();
  Object.freeze(value);
  return value.change;
}
export async function run(): Promise<boolean> {
  const change = escaped();
  try { await change(); } catch (error) { return error instanceof TypeError; }
  return false;
}
` },
  { name: "reentrant-write", asynchronous: false, source: `
class Value {
  value = 1;
  change = (next: () => number): void => { this.value = next(); };
}
export function run(): boolean {
  const value = new Value();
  let calls = 0;
  const next = (): number => { calls += 1; Object.freeze(value); return 2; };
  try { value.change(next); } catch (error) {
    return error instanceof TypeError && calls === 1 && value.value === 1;
  }
  return false;
}
` },
  { name: "shallow-content", asynchronous: false, source: `
class Value {
  child = { value: 1 };
  change = (): void => { this.child.value = 2; };
}
export function run(): boolean {
  const value = new Value();
  Object.freeze(value);
  value.change();
  return value.child.value === 2 && Object.isFrozen(value) && !Object.isFrozen(value.child);
}
` },
];

export const optionalProjectCarriersSource = `
class Base<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
  read(): Value { return this.value; }
}
class Child extends Base<number> { extra(): number { return this.value + 1; } }
function conditional(present: boolean): Base<number> | undefined {
  return present ? new Child(3) : undefined;
}
function consume(value: Base<number> | undefined): number | undefined { return value?.read(); }
function owned(value: Base<number> | undefined): Child | undefined {
  return value instanceof Child ? (value as Child) : undefined;
}
function borrowed(value: Base<number> | undefined): Child | undefined {
  if (!(value instanceof Child)) return undefined;
  const selected = value as Child;
  selected.value++;
  if (value.read() !== selected.read()) throw new Error("optional projected alias");
  return selected;
}
function nullable(value: Base<number> | null | undefined): Child | undefined {
  return value instanceof Child ? value : undefined;
}
export function run(): boolean {
  const child = new Child(7);
  const stored: Base<number> | undefined = child;
  if (stored !== child || consume(child) !== 7) throw new Error("optional identity");
  child.value = 9;
  if (stored.read() !== 9 || child.extra() !== 10) throw new Error("optional live alias");
  if (conditional(false) !== undefined || conditional(true)?.read() !== 3) throw new Error("optional conditional");
  if (consume(undefined) !== undefined) throw new Error("optional absent call");
  if (owned(child) !== child || borrowed(child) !== child || child.value !== 10) throw new Error("optional projected identity");
  const other = new Base(2);
  if (owned(other) !== undefined || borrowed(other) !== undefined || other.value !== 2) throw new Error("optional wrong class");
  if (owned(undefined) !== undefined || borrowed(undefined) !== undefined) throw new Error("optional projected absence");
  if (nullable(null) !== undefined || nullable(undefined) !== undefined || nullable(other) !== undefined || nullable(child) !== child) throw new Error("nullable project projection");
  return true;
}
`;

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
export function run(): boolean {
  const child = new Child(7);
  const stored: Base<number> | undefined = child;
  if (stored !== child || consume(child) !== 7) throw new Error("optional identity");
  child.value = 9;
  if (stored.read() !== 9 || child.extra() !== 10) throw new Error("optional live alias");
  if (conditional(false) !== undefined || conditional(true)?.read() !== 3) throw new Error("optional conditional");
  if (consume(undefined) !== undefined) throw new Error("optional absent call");
  return true;
}
`;

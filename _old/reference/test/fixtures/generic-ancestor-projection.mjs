export const genericAncestorProjectionSource = `
abstract class Base { abstract kind(): number; }
class Box<Value> extends Base {
  value: Value;
  constructor(value: Value) { super(); this.value = value; }
  kind(): number { return 1; }
  static accepts<Value>(value: Base): value is Box<Value> { return value.kind() === 1; }
}
class Child<Value> extends Box<Value> { extra = 2; }
class Other extends Base { kind(): number { return 0; } }
function read<Value>(value: Base, absent: Value): Value {
  if (Box.accepts<Value>(value)) return value.value;
  return absent;
}
export function run(): boolean {
  const child = new Child<string>("retained");
  const base: Base = child;
  if (read<string>(base, "absent") !== "retained") throw new Error("ancestor");
  child.value = "changed";
  if (read<string>(base, "absent") !== "changed" || child.extra !== 2) throw new Error("identity");
  if (read<string>(new Other(), "absent") !== "absent") throw new Error("unrelated");
  return true;
}
export function main(): void { if (!run()) throw new Error("generic ancestor projection"); }
`;

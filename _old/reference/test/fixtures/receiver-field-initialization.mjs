export const receiverFieldInitializationSource = `
let trace: number = 0;
function mark(value: number): number { trace = trace * 10 + value; return value; }
class Base {
  base: number = mark(1);
  constructor() { mark(2); }
}
class Child extends Base {
  left: number = mark(3);
  snapshot: number = this.base + this.left;
  read: () => number = () => this.left;
  right: number = mark(4);
  constructor() { super(); mark(5); }
}
class ImplicitChild extends Base {
  own: number = mark(3);
  snapshot: number = this.base + this.own;
}
class Holder {
  value: number = 1;
  read: () => number = () => this.value;
}
export function run(): boolean {
  const child = new Child();
  if (trace !== 12345 || child.snapshot !== 4 || child.right !== 4 || child.read() !== 3) return false;
  child.left = 8;
  if (child.read() !== 8) return false;
  trace = 0;
  const implicit = new ImplicitChild();
  if (trace !== 123 || implicit.snapshot !== 4) return false;
  const holder = new Holder();
  const read = holder.read;
  holder.value = 9;
  return read() === 9;
}
`;

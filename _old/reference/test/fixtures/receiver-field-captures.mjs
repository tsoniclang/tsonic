export const receiverFieldCapturesSource = `
class Holder {
  value: number = 1;
  read = (): number => this.value;
  sum = (other: Holder): number => this.value + other.value;
  bump(): void { this.value++; }
  capture(): () => number { return () => this.value; }
}
class TextHolder {
  value = "first";
  read = (): string => this.value;
}
class GenericHolder<T> {
  constructor(public value: T) {}
  read = (): T => this.value;
}
class Leaf { constructor(public value: number) {} }
class Parent {
  child = new Leaf(2);
  read = (): number => this.child.value;
}
class Base {
  protected value = 3;
  read = (): number => this.value;
  change(value: number): void { this.value = value; }
}
class Derived extends Base { readonly tag = "derived"; }
class ConditionalHolder {
  value: number;
  read = (): number => this.value;
  constructor(flag: boolean) {
    if (flag) this.value = 1;
    this.value = 2;
    this.value = 3;
  }
}
function escaped(): () => number {
  const holder = new Holder();
  const read = holder.read;
  holder.value = 9;
  return read;
}
export function run(): boolean {
  const holder = new Holder();
  const read = holder.read;
  holder.value = 7;
  holder.bump();
  if (read() !== 8 || holder.capture()() !== 8 || escaped()() !== 9) return false;
  const other = new Holder();
  other.value = 2;
  if (holder.sum(other) !== 10 || new ConditionalHolder(true).read() !== 3 || new ConditionalHolder(false).read() !== 3) return false;
  const text = new TextHolder();
  const readText = text.read;
  text.value = "second";
  if (readText() !== "second") return false;
  const generic = new GenericHolder<string>("generic");
  generic.value = "changed";
  if (generic.read() !== "changed") return false;
  const parent = new Parent();
  const readChild = parent.read;
  parent.child = new Leaf(11);
  if (readChild() !== 11) return false;
  const derived = new Derived();
  const readBase = derived.read;
  derived.change(13);
  return readBase() === 13 && derived.tag === "derived";
}
`;

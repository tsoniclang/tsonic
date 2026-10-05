export const receiverFieldCaptureEdges = [
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

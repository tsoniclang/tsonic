export const sourceClassAnnotationSource = `
abstract class Base<T> {
  readonly label: string;
  constructor(label: string) { this.label = label; }
  abstract readonly count: number;
  abstract readonly texts: string[];
  abstract read(): T;
}
class Derived extends Base<number> {
  readonly count = 2;
  readonly values: number[];
  readonly texts: string[];
  constructor() { super("base"); this.values = [2, 3]; this.texts = ["first"]; }
  read(): number { return this.values[0]; }
}
export function run(): boolean {
  const derived = new Derived();
  const base: Base<number> = derived;
  derived.values[0] = 7;
  base.texts[0] = "changed";
  return base.label === "base" && base.count === 2 && base.read() === 7 && derived.texts[0] === "changed";
}
`;

export const invalidSourceClassAnnotations = Object.freeze([
  { source: "abstract class Base {} export const value = new Base();", code: "TS2511" },
  { source: "abstract class Base { abstract read(): number; } class Derived extends Base {}", code: "TS2515" },
  { source: "class Value { readonly count = 1; } const value = new Value(); value.count = 2;", code: "TS2540" },
]);

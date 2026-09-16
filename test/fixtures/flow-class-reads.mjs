export const flowClassReadSource = `
class Base {}
class Derived extends Base {
  value: string;
  constructor(value: string) { super(); this.value = value; }
}
function fromElement(values: Base[]): string | undefined {
  const value = values[0];
  if (value instanceof Derived) return value.value;
  return undefined;
}
const fromArrow = (value: Base): string | undefined => value instanceof Derived ? value.value : undefined;
class Holder {
  value: Base;
  constructor(value: Base) { this.value = value; }
}
function fromProperty(holder: Holder): string | undefined {
  if (holder.value instanceof Derived) return holder.value.value;
  return undefined;
}
export function run(): boolean {
  const derived = new Derived("kept");
  const base = new Base();
  return fromElement([derived]) === "kept" && fromElement([base]) === undefined &&
    fromArrow(derived) === "kept" && fromArrow(base) === undefined &&
    fromProperty(new Holder(derived)) === "kept" && fromProperty(new Holder(base)) === undefined;
}
`;

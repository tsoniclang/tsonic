export const polymorphicThisResultsSource = `
class Base<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
  set(value: Value): this { this.value = value; return this; }
  inferred() { return this; }
  choose(other: this): this { return other; }
  asBase(): Base<Value> { return this; }
}
class Effects { count: number = 0; }
class Child extends Base<number> {
  extra(): number { return this.value + 1; }
}
function receiver(child: Child, calls: Effects): Child { calls.count++; return child; }
function optional(child: Child | undefined): number | undefined { return child?.set(3).extra(); }
function optionalOther(child: Child | undefined, other: Child): number | undefined { return child?.choose(other).extra(); }
function argument(effects: Effects): number { effects.count++; return 6; }
function optionalArgument(child: Child | undefined, effects: Effects): number | undefined { return child?.set(argument(effects)).extra(); }
export function run(): boolean {
  const calls = new Effects();
  const child = new Child(1);
  const other = new Child(9);
  const selected = receiver(child, calls).set(4).extra();
  const inferred = child.inferred().extra();
  const chosen = child.choose(other).extra();
  const base = child.asBase();
  const valid = selected === 5 && inferred === 5 && chosen === 10 && base.value === 4 &&
    calls.count === 1 && optional(undefined) === undefined && optional(child) === 4 &&
    optionalOther(undefined, other) === undefined && optionalOther(child, other) === 10;
  const effects = new Effects();
  const absent = optionalArgument(undefined, effects);
  const lazy = absent === undefined && effects.count === 0;
  const present = optionalArgument(child, effects);
  return valid && lazy && present === 7 && effects.count === 1 && child.value === 6 && other.value === 9;
}
`;

export const independentFrameAlternativesSource = `
class Value {
  recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1);
}

class Replaced {
  readonly recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1);
  constructor() { this.recurse = (): number => 17; }
}

class Rebinding {
  recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1);
  rebind(): void {
    this.recurse = (count: number): number => count === 0 ? 2 : this.recurse(count - 1);
  }
}

export function run(): boolean {
  const value = new Value();
  const before = value.recurse;
  value.recurse = (): number => 99;
  const independent = value.recurse;
  if (before(2) !== 99 || independent(3) !== 99 || independent !== value.recurse) return false;
  const view: { recurse: (count: number) => number } = value;
  view["recurse"] = (): number => 23;
  const next = value.recurse;
  if (before(2) !== 23 || independent(2) !== 99 || next === independent) return false;
  const rebinding = new Rebinding();
  const first = rebinding.recurse;
  rebinding.rebind();
  const second = rebinding.recurse;
  rebinding.rebind();
  if (first(2) !== 2 || second(2) !== 2 || first === second || second === rebinding.recurse) return false;
  const rebindingView: { recurse: (count: number) => number } = rebinding;
  if (rebindingView.recurse(2) !== 2 || rebindingView.recurse !== rebinding.recurse) return false;
  return view.recurse(2) === 23 && next === value.recurse && new Replaced().recurse(4) === 17;
}

export function main(): void {
  if (!run()) throw new Error("independent callback alternative lost native ownership or identity");
}

export function retainedRoot(): (count: number) => number {
  return new Value().recurse;
}

export function independentRoot(): (count: number) => number {
  const value = new Value();
  value.recurse = (): number => 31;
  return value.recurse;
}
`;

export const recursiveCallbackProtocolCases = [
  {
    name: "captured-class-field",
    source: `
class Counter {
  constructor(public seed: number) {}
  recurse = (count: number): number => count === 0 ? this.seed : this.recurse(count - 1);
  rebind(seed: number): void {
    this.seed = seed;
    this.recurse = (count: number): number => count === 0 ? this.seed + 1 : this.recurse(count - 1);
  }
}
function create(seed: number): (count: number) => number {
  const value = new Counter(seed);
  const before = value.recurse;
  value.rebind(seed + 10);
  return before;
}
export function main(): void {
  const callback = create(3);
  if (callback(0) !== 13 || callback(1) !== 14 || callback(8) !== 14)
    throw new Error("retained class frame fields");
}
`,
  },
  {
    name: "shared-class-frame",
    source: `
class Counter {
  constructor(public seed: number) {}
  recurse = (count: number): number => count === 0 ? this.seed : this.recurse(count - 1);
  rebind(seed: number): void {
    this.seed = seed;
    this.recurse = (count: number): number => count === 0 ? this.seed + 1 : this.recurse(count - 1);
  }
}
function create(seed: number): (count: number) => number {
  const value = new Counter(seed);
  const alias = value;
  const before = alias.recurse;
  value.rebind(seed + 10);
  return before;
}
export function main(): void {
  const callback = create(3);
  if (callback(0) !== 13 || callback(1) !== 14 || callback(8) !== 14)
    throw new Error("shared class frame fields");
}
`,
  },
  {
    name: "stable-recursion",
    source: `
function create(): (count: number, seed: number) => number {
  let selected = (count: number, seed: number): number => count === 0 ? seed : selected(count - 1, seed);
  return selected;
}
export function main(): void {
  const callback = create();
  if (callback(0, 3) !== 3 || callback(4, 7) !== 7)
    throw new Error("ordinary stable recursive callback return");
}
`,
  },
  {
    name: "same-activation-alias",
    source: `
function create(): (count: number) => number {
  let selected = (count: number): number => count === 0 ? 1 : selected(count - 1);
  const original = selected;
  const alias = original;
  selected = (count: number): number => count === 0 ? 2 : selected(count - 1);
  selected = alias;
  return original;
}
export function main(): void {
  const callback = create();
  if (callback(0) !== 1 || callback(1) !== 1 || callback(8) !== 1)
    throw new Error("same-activation alias entry rebinding");
}
`,
  },
  {
    name: "generic-seed",
    source: `
function create<T>(seed: T): (count: number) => T {
  let selected = (count: number): T => count === 0 ? seed : selected(count - 1);
  const before = selected;
  selected = (count: number): T => count === 0 ? seed : selected(count - 1);
  return before;
}
export function main(): void {
  const first = create("seed");
  const alias = first;
  const other = create("other");
  if (first !== alias || first === other || first(4) !== "seed" || other(2) !== "other")
    throw new Error("generic frame seed and identity");
}
`,
  },
  {
    name: "hygienic-parameters",
    source: `
function create(): (frame_owner: number, frame_state: number) => number {
  let selected = (frame_owner: number, frame_state: number): number =>
    frame_owner === 0 ? frame_state : selected(frame_owner - 1, frame_state);
  const before = selected;
  selected = (frame_owner: number, frame_state: number): number =>
    frame_owner === 0 ? frame_state : selected(frame_owner - 1, frame_state);
  return before;
}
export function main(): void {
  const callback = create();
  if (callback(4, 7) !== 7) throw new Error("frame helper parameter hygiene");
}
`,
  },
  {
    name: "per-evaluation-captures",
    source: `
function create(): (count: number) => number {
  let selected = (count: number): number => count === 0 ? 1 : selected(count - 1);
  const before = selected;
  for (let index = 0; index < 2; index++) {
    const captured = index + 3;
    selected = (count: number): number => count === 0 ? captured : selected(count - 1);
  }
  return before;
}
export function main(): void {
  const callback = create();
  if (callback(0) !== 1 || callback(1) !== 4 || callback(8) !== 4)
    throw new Error("per-evaluation frame capture");
}
`,
  },
];

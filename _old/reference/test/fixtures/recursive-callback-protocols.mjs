export const recursiveCallbackProtocolCases = [
  {
    name: "recursive-callback-typed-failures",
    source: `
import type { int64 } from "@tsonic/core/types.js";
export class Payload {
  code: int64;
  constructor(code: int64) { this.code = code; }
}
class Counter {
  first: Payload;
  second: Payload;
  constructor(first: Payload, second: Payload) { this.first = first; this.second = second; }
  selected = (count: number): number => {
    if (count === 0) throw this.first;
    return this.selected(count - 1);
  };
  rebind(): void { this.selected = (_count: number): number => { throw this.second; }; }
}
function lexical(first: Payload, second: Payload): (count: number) => number {
  let selected = (count: number): number => {
    if (count === 0) throw first;
    return selected(count - 1);
  };
  const original = selected;
  selected = (_count: number): number => { throw second; };
  return original;
}
function check(callback: (count: number) => number, count: number, expected: Payload): void {
  try {
    callback(count);
    throw new Error("recursive callback did not throw");
  } catch (value) {
    if (!(value instanceof Payload) || value !== expected || value.code !== expected.code)
      throw new Error("recursive callback lost its exact native payload");
  }
}
export function main(): void {
  const first = new Payload(9007199254740993n);
  const second = new Payload(9007199254740995n);
  const lexicalCallback = lexical(first, second);
  const instance = new Counter(first, second);
  const classCallback = instance.selected;
  instance.rebind();
  check(lexicalCallback, 0, first);
  check(lexicalCallback, 8, second);
  check(classCallback, 0, first);
  check(classCallback, 8, second);
}
`,
  },
  {
    name: "addressed-class-pointer-return",
    source: `
import { addressof, equalptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { Pointer } from "@tsonic/core/types.js";
class Value {
  seed: number;
  constructor(seed: number) { this.seed = seed; }
  recurse = (count: number): Pointer<number> => count === 0 ? addressof(this.seed) : this.recurse(count - 1);
  rebind(): void {
    this.recurse = (count: number): Pointer<number> => count === 0 ? addressof(this.seed) : this.recurse(count - 1);
  }
}
function create(seed: number): (count: number) => Pointer<number> {
  const value = new Value(seed);
  const original = value.recurse;
  value.rebind();
  return original;
}
function retain(): Pointer<number> {
  const callback = create(3);
  const first = callback(0);
  const second = callback(5);
  if (!equalptr(first, second)) throw new Error("class callback pointer return identity");
  storeptr(first, 7);
  if (loadptr(second) !== 7) throw new Error("class callback pointer return alias");
  return first;
}
export function main(): void {
  const pointer = retain();
  if (loadptr(pointer) !== 7) throw new Error("class pointer outlives callback");
  storeptr(pointer, 9);
  if (loadptr(pointer) !== 9) throw new Error("class pointer survives retained mutation");
}
`,
  },
  {
    name: "addressed-class-field",
    source: `
import { addressof, equalptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { Pointer } from "@tsonic/core/types.js";
export class Value {
  seed: number;
  constructor(seed: number) { this.seed = seed; }
  pointer(): Pointer<number> { return addressof(this.seed); }
}
function create(seed: number): Pointer<number> {
  const value = new Value(seed);
  const first = value.pointer();
  const second = addressof(value.seed);
  if (!equalptr(first, second)) throw new Error("ordinary class field address identity");
  storeptr(first, 5);
  if (value.seed !== 5) throw new Error("ordinary class field pointer alias");
  value.seed = 6;
  if (loadptr(second) !== 6) throw new Error("ordinary class field direct alias");
  return first;
}
export function main(): void {
  const pointer = create(3);
  if (loadptr(pointer) !== 6) throw new Error("ordinary class field address lifetime");
  storeptr(pointer, 8);
  if (loadptr(pointer) !== 8) throw new Error("ordinary class field retained mutation");
}
`,
  },
  {
    name: "addressed-lexical-frame",
    source: `
import { addressof, equalptr, loadptr, storeptr } from "@tsonic/core/lang.js";
function create(seed: number): (count: number) => number {
  let selected = (count: number): number => {
    if (count !== 0) return selected(count - 1);
    const first = addressof(seed);
    const second = addressof(seed);
    if (!equalptr(first, second)) throw new Error("lexical frame address identity");
    storeptr(second, loadptr(first) + 1);
    return seed;
  };
  const original = selected;
  selected = (count: number): number => {
    if (count !== 0) return selected(count - 1);
    const pointer = addressof(seed);
    storeptr(pointer, loadptr(pointer) + 2);
    return seed;
  };
  return original;
}
export function main(): void {
  const callback = create(3);
  const alias = callback;
  if (callback(0) !== 4 || callback(1) !== 6 || alias(0) !== 7 || alias(8) !== 9)
    throw new Error("lexical frame pointer storage");
}
`,
  },
  {
    name: "addressed-class-frame",
    source: `
import { addressof, equalptr, loadptr, storeptr } from "@tsonic/core/lang.js";
class Counter {
  extra = 0;
  seed: number;
  constructor(seed: number) { this.seed = seed; }
  recurse = (count: number): number => {
    if (count !== 0) return this.recurse(count - 1);
    const first = addressof(this.seed);
    const second = addressof(this.seed);
    if (!equalptr(first, second)) throw new Error("class frame address identity");
    storeptr(second, loadptr(first) + 1);
    return this.seed;
  };
  rebind(): void {
    this.recurse = (count: number): number => {
      if (count !== 0) return this.recurse(count - 1);
      const pointer = addressof(this.seed);
      storeptr(pointer, loadptr(pointer) + 2);
      return this.seed;
    };
  }
}
function create(seed: number): (count: number) => number {
  const value = new Counter(seed);
  const alias = value;
  const original = value.recurse;
  value.rebind();
  alias.extra = 1;
  if (value.extra !== 1) throw new Error("class frame instance alias");
  return original;
}
export function main(): void {
  const callback = create(3);
  const alias = callback;
  if (callback(0) !== 4 || callback(1) !== 6 || alias(0) !== 7 || alias(8) !== 9)
    throw new Error("class frame pointer storage");
}
`,
  },
  {
    name: "captured-class-field",
    source: `
class Counter {
  seed: number;
  constructor(seed: number) { this.seed = seed; }
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
  extra = 0;
  seed: number;
  constructor(seed: number) { this.seed = seed; }
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
  alias.extra = 4;
  value.extra = 5;
  if (alias.extra !== 5) throw new Error("native shared instance alias");
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
    name: "shared-class-string-field",
    source: `
class Counter {
  extra = 0;
  seed: string;
  constructor(seed: string) { this.seed = seed; }
  recurse = (count: number): number => count === 0 ? (this.seed === "abcabcdefghij" ? 13 : -1) : this.recurse(count - 1);
  rebind(seed: string): void {
    this.seed = seed;
    this.recurse = (count: number): number => count === 0 ? (this.seed === "abcabcdefghij" ? 14 : -1) : this.recurse(count - 1);
  }
}
function create(seed: string): (count: number) => number {
  const value = new Counter(seed);
  const alias = value;
  const before = alias.recurse;
  value.rebind(seed + "abcdefghij");
  alias.extra = 4;
  value.extra = 5;
  if (alias.extra !== 5) throw new Error("native shared string instance alias");
  return before;
}
export function main(): void {
  const callback = create("abc");
  if (callback(0) !== 13 || callback(1) !== 14 || callback(8) !== 14)
    throw new Error("shared non-Copy class frame fields");
}
`,
  },
  {
    name: "shared-class-construction-writes",
    source: `
class Counter {
  extra = 0;
  seed: number;
  constructor(seed: number) { this.seed = seed; this.seed += 1; }
  recurse = (count: number): number => count === 0 ? this.seed : this.recurse(count - 1);
  rebind(seed: number): void {
    this.seed = seed;
    this.recurse = (count: number): number => count === 0 ? this.seed + 1 : this.recurse(count - 1);
  }
}
function create(seed: number): (count: number) => number {
  const value = new Counter(seed);
  const alias = value;
  if (alias.recurse(0) !== seed + 1) throw new Error("native frame constructor writes");
  const before = alias.recurse;
  value.rebind(seed + 10);
  alias.extra = 4;
  value.extra = 5;
  if (alias.extra !== 5) throw new Error("native shared constructor instance alias");
  return before;
}
export function main(): void {
  const callback = create(3);
  if (callback(0) !== 13 || callback(1) !== 14 || callback(8) !== 14)
    throw new Error("shared constructor field writes");
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

for (const name of ["captured-class-field", "shared-class-frame", "shared-class-string-field", "shared-class-construction-writes"]) {
  const explicit = recursiveCallbackProtocolCases.find(current => current.name === name);
  const field = name === "shared-class-string-field" ? "string" : "number";
  const constructor = name === "shared-class-construction-writes"
    ? `  seed: ${field};\n  constructor(seed: ${field}) { this.seed = seed; this.seed += 1; }`
    : `  seed: ${field};\n  constructor(seed: ${field}) { this.seed = seed; }`;
  const replacement = name === "shared-class-construction-writes"
    ? `  constructor(public seed: ${field}) { this.seed += 1; }`
    : `  constructor(public seed: ${field}) {}`;
  if (explicit === undefined || !explicit.source.includes(constructor)) throw new Error(`Missing exact ${name} field fixture`);
  recursiveCallbackProtocolCases.push({ name: `${name}-parameter-property`, source: explicit.source.replace(constructor, replacement) });
}

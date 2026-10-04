export const constructorLinkageFiles = {
  "base.ts": `
import type { int32 } from "@tsonic/core/types.js";
let effects: int32 = 0;
function next(value: int32): int32 { effects = effects * 10 + value; return value; }
export function count(): int32 { return effects; }
export class Base<Value> {
  tag: int32 = next(1);
  constructor(readonly value: Value) { next(2); }
}
`,
  "index.ts": `
import type { int32 } from "@tsonic/core/types.js";
import { Base, count } from "./base.js";
class Child extends Base<string> {
  doubled: int32 = this.tag * 2;
  constructor() { super("native"); }
}
export function run(): boolean {
  const value = new Child();
  return value.value === "native" && value.doubled === 2 && count() === 12;
}
`,
};

export const parameterPropertiesSource = `
let order: number = 0;
function step(value: number): number { order = order * 10 + value; return value; }
class Box {
  field: number = step(2);
  constructor(private readonly value: string, public count: number = step(1)) {
    if (this.value !== value || this.count !== count || this.field !== 2) throw new Error("parameter initialization");
    value = "changed";
    if (this.value !== "kept" || value !== "changed") throw new Error("independent parameter binding");
    step(3);
  }
  text(): string { return this.value; }
}
class Holder<T> {
  constructor(readonly value: T) {}
  read(): T { return this.value; }
}
class Base {
  constructor(protected readonly base: number) { step(4); }
  getBase(): number { return this.base; }
}
class Derived extends Base {
  field: number = step(5);
  constructor(readonly amount: number = step(7)) {
    super(amount);
    if (this.amount !== amount || this.field !== 5) throw new Error("derived parameter initialization");
    step(6);
  }
}
export function run(): boolean {
  const box = new Box("kept");
  if (order !== 123 || box.text() !== "kept" || box.count !== 1) return false;
  box.count = 8;
  const holder = new Holder<Box>(box);
  if (holder.read() !== box || holder.value.count !== 8) return false;
  order = 0;
  const derived = new Derived(9);
  if (order !== 456 || derived.amount !== 9 || derived.getBase() !== 9) return false;
  order = 0;
  const prepared = new Derived();
  return order === 7456 && prepared.amount === 7 && prepared.getBase() === 7;
}
`;

export const constructorReadinessSource = `
let trace: number = 0;
function mark(value: number): number { trace = trace * 10 + value; return value; }
class Alias {
  value: number = mark(1);
  readonly owner: Alias = this;
  constructor(early: boolean) {
    try {
      mark(2);
      this.bump();
      if (early) return;
      mark(3);
    } finally {
      this.bump();
      mark(4);
    }
  }
  bump(): void { this.value += 1; }
  read(): number { return this.value; }
}
class Finalized {
  value!: number;
  constructor() { try { return; } finally { this.value = mark(6); } }
}
class Base {
  base: number = mark(1);
  constructor() { try { mark(2); return; } finally { mark(3); } }
  read(): number { return this.base; }
}
class Child extends Base {
  own: number = mark(4);
  constructor() { super(); mark(5); }
}
class Loop {
  value!: number;
  constructor() {
    outside: do {
      try { this.value = mark(7); break outside; }
      finally { mark(8); }
    } while (true);
  }
}
export function run(): boolean {
  const early = new Alias(true);
  if (trace !== 124 || early.owner !== early || early.read() !== 3) return false;
  trace = 0;
  const normal = new Alias(false);
  if (trace !== 1234 || normal.owner !== normal || normal.read() !== 3) return false;
  trace = 0;
  const finalized = new Finalized();
  if (trace !== 6 || finalized.value !== 6) return false;
  trace = 0;
  const child = new Child();
  if (trace !== 12345 || child.read() !== 1 || child.own !== 4) return false;
  trace = 0;
  const loop = new Loop();
  return trace === 78 && loop.value === 7;
}
`;

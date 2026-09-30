export const genericStructuralMethodFiles = {
  "factory.ts": `
export function create<Owner>(owner: Owner) {
  let calls = 0;
  return {
    owner,
    count: 0,
    identity<Value>(value: Value): Value {
      this.count++;
      calls++;
      return value;
    },
    selected(): Owner { return this.owner; },
    readCalls(): number { return calls; },
  };
}
`,
  "index.ts": `
import { create } from "./factory.js";
export function run(): boolean {
  const object = create(7);
  const alias = object;
  const first = object.identity(3);
  const second = alias.identity("text");
  return first === 3 && second === "text" && object.count === 2 &&
    alias.readCalls() === 2 && object.selected() === 7;
}
`,
};

export const genericStructuralAsyncFiles = {
  "index.ts": `
function create() {
  return {
    count: 0,
    async identity<Value>(value: Value): Promise<Value> {
      this.count++;
      return value;
    },
  };
}
export async function run(): Promise<boolean> {
  const object = create();
  const alias = object;
  const first = await object.identity(3);
  const second = await alias.identity("text");
  return first === 3 && second === "text" && object.count === 2;
}
`,
};

export const genericStructuralOptionalFiles = {
  "index.ts": `
interface Counter {
  count: number;
  identity?<Value>(value: Value): Value;
}
function create(present: boolean): Counter {
  if (!present) return { count: 0 };
  return {
    count: 0,
    identity<Value>(value: Value): Value {
      this.count++;
      return value;
    },
  };
}
export function run(): boolean {
  const present = create(true);
  const alias = present;
  const absent = create(false);
  return present.identity?.(3) === 3 && alias.identity?.("text") === "text" &&
    absent.identity?.(3) === undefined && present.count === 2 && absent.count === 0;
}
`,
};

export const inheritedStructuralOptionalFiles = {
  "index.ts": `
interface Identity {
  identity?<Value>(value: Value): Value;
}
interface Counter extends Identity { count: number; }
function create(present: boolean): Counter {
  if (!present) return { count: 0 };
  return { count: 0, identity<Value>(value: Value): Value {
    this.count++;
    return value;
  } };
}
function invoke<Value>(counter: Counter, value: Value): Value | undefined {
  return counter.identity?.(value);
}
export function run(): boolean {
  const present = create(true);
  const absent = create(false);
  let evaluations = 0;
  const first = present.identity?.(++evaluations);
  const missing = absent.identity?.(++evaluations);
  return first === 1 && missing === null && evaluations === 1 &&
    invoke(present, "text") === "text" && invoke(absent, "text") === undefined &&
    present.count === 2 && absent.count === 0;
}
`,
};

export const monomorphicStructuralOptionalFiles = {
  "index.ts": `
interface Counter { count: number; identity?(value: number): number; }
function create(present: boolean): Counter {
  if (!present) return { count: 0 };
  return { count: 0, identity(value: number): number { this.count++; return value; } };
}
export function run(): boolean {
  const present = create(true);
  const absent = create(false);
  let evaluations = 0;
  return present.identity?.(++evaluations) === 1 && absent.identity?.(++evaluations) === undefined &&
    present.count === 1 && absent.count === 0 && evaluations === 1;
}
`,
};

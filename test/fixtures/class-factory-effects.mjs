export const classFactoryEffectsFiles = Object.freeze({
  "base.ts": `
export let trace = "";
export function readTrace(): string { return trace; }
export function mark(label: string, fails: boolean): number {
  trace += label;
  if (fails) throw new Error(label);
  return 7;
}
export class Base {
  readonly value: number;
  constructor(value: number) {
    mark("base;", value < 0);
    this.value = value;
  }
}
`,
  "factory.ts": `
import { Base, mark } from "./base.js";
export function explicit(fails: boolean) {
  return class Selected extends Base {
    static selected: number = mark("static;", false);
    readonly initialized: number = mark("field;", fails);
    constructor(value: number) { super(value); }
    unused(): number { return mark("method;", true); }
  };
}
export function implicit() {
  class Selected extends Base { readonly initialized: number = mark("implicit;", false); }
  return Selected;
}
`,
  "index.ts": `
import { readTrace } from "./base.js";
import { explicit, implicit } from "./factory.js";
export function run(): boolean {
  const Good = explicit(false);
  if (readTrace() !== "static;") return false;
  const good = new Good(3);
  if (good.value !== 3 || good.initialized !== 7 || readTrace() !== "static;base;field;") return false;
  let baseFailed = false;
  try { new Good(-1); } catch { baseFailed = true; }
  if (!baseFailed || readTrace() !== "static;base;field;base;") return false;
  const Bad = explicit(true);
  if (readTrace() !== "static;base;field;base;static;") return false;
  let fieldFailed = false;
  try { new Bad(4); } catch { fieldFailed = true; }
  if (!fieldFailed || readTrace() !== "static;base;field;base;static;base;field;") return false;
  const Implicit = implicit();
  const result = new Implicit(9);
  return result.value === 9 && result.initialized === 7 &&
    readTrace() === "static;base;field;base;static;base;field;base;implicit;";
}
`,
});

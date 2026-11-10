export const classMemberVisibilityFiles = {
  "base.ts": `
export class Base {
  protected count: number = 1;
  protected constructor() {}
  private bump(): number { this.count += 1; return this.count; }
  public capture(): () => number { return () => this.bump(); }
  protected read(): number { return this.count; }
  public tick(): number { return this.read(); }
}
`,
  "child.ts": `
import { Base } from "./base.js";
export class Child extends Base {
  constructor() { super(); }
  protected override read(): number { return super.read() * 2; }
  override tick(): number { this.count += 1; return super.tick(); }
}
`,
  "index.ts": `
import { Base } from "./base.js";
import { Child } from "./child.js";
export function run(): boolean {
  const child = new Child();
  const base: Base = child;
  const next = base.capture();
  return next() === 2 && base.tick() === 6 && next() === 4;
}
`,
};

export const closedInstanceFiles = {
  "models.ts": `
export class Base { readonly count = 7; }
export class Derived extends Base { readonly extra = 9; }
export class Other { readonly count = 11; }
export type Choice = string | Base | Other | undefined | null;
`,
  "index.ts": `
import { Base, Derived as Child, Other } from "./models.js";
import type { Choice } from "./models.js";
let reads = 0;
function readCount(): number { return reads; }
function observe(value: Choice): Choice { reads += 1; return value; }
function createChoice(): Choice { return new Child(); }
export function base(value: Choice): boolean { return value instanceof Base; }
export function child(value: Choice): boolean { return value instanceof Child; }
export function selected(value: string | Other | undefined): number {
  return value instanceof Other ? value.count : 0;
}
export function run(): boolean {
  const parent = new Base();
  const derived = new Child();
  const other = new Other();
  if (!base(parent) || !base(derived) || base(other) || base("x") || base(undefined)) return false;
  if (child(parent) || !child(derived) || child(other) || child("x") || child(null)) return false;
  if (selected(other) !== 11 || selected("x") !== 0 || selected(undefined) !== 0) return false;
  if (!(observe(derived) instanceof Child) || readCount() !== 1) return false;
  if (observe(other) instanceof Child || readCount() !== 2) return false;
  if (!child(createChoice())) return false;
  return derived.extra === 9 && parent.count === 7;
}
`,
};

export const closedInstanceAdapterFiles = {
  "models.ts": closedInstanceFiles["models.ts"],
  "index.ts": `
import { Base, Derived } from "./models.js";
import type { Choice } from "./models.js";
class Producer { produce(): Choice { return "none"; } }
interface ProducesBase { produce(): Base; }
class ChildProducer extends Producer implements ProducesBase {
  readonly child = new Derived();
  produce(): Derived { return this.child; }
}
class GrandProducer extends ChildProducer { produce(): Derived { return this.child; } }
abstract class AbstractProducer { abstract produce(): Choice; }
class ConcreteProducer extends AbstractProducer { produce(): Derived { return new Derived(); } }
function derivedValue(value: Derived): number { return value.extra; }
function narrowed(value: Choice): number {
  if (!(value instanceof Base)) return 0;
  if (!(value instanceof Derived)) return 0;
  const selected = value;
  return derivedValue(selected);
}
export function run(): boolean {
  const direct = new ChildProducer();
  const producer: Producer = direct;
  const result = producer.produce();
  if (!(result instanceof Base && result instanceof Derived && result.extra === 9)) return false;
  if (direct.produce() !== direct.child || direct.produce().extra !== 9) return false;
  const contract: ProducesBase = direct;
  if (contract.produce() !== direct.child) return false;
  const grand = new GrandProducer();
  const middle: ChildProducer = grand;
  const root: Producer = grand;
  if (middle.produce().extra !== 9 || narrowed(root.produce()) !== 9) return false;
  const abstract: AbstractProducer = new ConcreteProducer();
  if (narrowed(abstract.produce()) !== 9 || narrowed("none") !== 0) return false;
  return true;
}
`,
};

export const genericInstanceAdapterFiles = {
  "models.ts": closedInstanceFiles["models.ts"],
  "index.ts": `
import { Derived } from "./models.js";
class GenericProducer<Value> { produce(value: Value): Value | undefined { return value; } }
class PresentProducer<Value> extends GenericProducer<Value> { produce(value: Value): Value { return value; } }
export function run(): boolean {
  const child = new Derived();
  const generic = new PresentProducer<Derived>();
  const genericBase: GenericProducer<Derived> = generic;
  if (generic.produce(child).extra !== 9 || genericBase.produce(child) !== child) return false;
  const optional = new PresentProducer<Derived | undefined | null>();
  const optionalBase: GenericProducer<Derived | undefined | null> = optional;
  if (optionalBase.produce(child) !== child || optionalBase.produce(undefined) !== undefined) return false;
  return optional.produce(null) === null;
}
`,
};

export const closedNativeInstanceSource = `
let reads = 0;
function readCount(): number { return reads; }
function observe(value: string | RegExp | undefined | null): string | RegExp | undefined | null { reads += 1; return value; }
export function pattern(value: string | RegExp | undefined | null): boolean { return value instanceof RegExp; }
function match(value: string | RegExp | undefined | null): boolean {
  return value instanceof RegExp ? value.test("chosen") : false;
}
export function run(): boolean {
  const expression = new RegExp("chosen");
  if (!pattern(expression) || pattern("chosen") || pattern(undefined) || pattern(null)) return false;
  if (!match(expression) || match("chosen") || match(undefined)) return false;
  if (!(observe(expression) instanceof RegExp) || readCount() !== 1) return false;
  if (observe("chosen") instanceof RegExp || readCount() !== 2) return false;
  return expression.test("chosen");
}
`;

export const overloadedRestCallbackSource = `
interface Handler { (left: Left, right: Right, next: () => void): unknown; }
class Left { value = 1; }
class Right { value = 2; }
let observed = 0;
class Collector {
  collect(mode: "empty"): number;
  collect(mode: string, ...handlers: Handler[]): number;
  collect(mode: string, ...handlers: Handler[]): number {
    let count = 0;
    for (const handler of handlers) {
      handler(new Left(), new Right(), () => {});
      count += 1;
    }
    return count;
  }
}
class Derived extends Collector {}
export function run(): boolean {
  const collector = new Derived();
  const base: Collector = collector;
  const handler: Handler = (left, right) => { observed += left.value + right.value; };
  const handlers: Handler[] = [handler, () => {}];
  return collector.collect("empty") === 0 && base.collect("run", handler) === 1 &&
    collector.collect("run", (left, right) => { observed += left.value + right.value; }, () => {}) === 2 &&
    collector.collect("run", ...handlers) === 2 && observed === 9;
}
`;

export const overloadedRestIntegerSource = `
import type { uint64 } from "@tsonic/core/types.js";
class Total {
  sum(mode: "empty"): uint64;
  sum(mode: string, ...values: uint64[]): uint64;
  sum(mode: string, ...values: uint64[]): uint64 {
    let total: uint64 = 0n;
    for (const value of values) total += value;
    return total;
  }
}
class Echo<Value> {
  last(mode: "empty", fallback: Value): Value;
  last(mode: string, fallback: Value, ...values: Value[]): Value;
  last(mode: string, fallback: Value, ...values: Value[]): Value {
    let result = fallback;
    for (const value of values) result = value;
    return result;
  }
}
class DerivedTotal extends Total {}
export function run(): boolean {
  const total = new DerivedTotal();
  const echo = new Echo<uint64>();
  const exact: uint64 = 9007199254740993n;
  const unit: uint64 = 1n;
  const expected: uint64 = 9007199254740994n;
  const values: uint64[] = [exact, unit];
  return total.sum("empty") === 0n && total.sum("run", exact, unit) === expected &&
    total.sum("run", ...values) === expected && echo.last("empty", exact) === exact &&
    echo.last("run", unit, exact) === exact && echo.last("run", exact, ...values) === unit;
}
`;

export const overloadedRestOverrideSource = `
import type { uint64 } from "@tsonic/core/types.js";
class Total {
  sum(mode: "empty"): uint64;
  sum(mode: string, ...values: uint64[]): uint64;
  sum(mode: string, ...values: uint64[]): uint64 {
    let result: uint64 = 0n;
    for (const value of values) result += value;
    return result;
  }
}
class OverrideTotal extends Total {
  override sum(mode: "empty"): uint64;
  override sum(mode: string, ...values: uint64[]): uint64;
  override sum(mode: string, ...values: uint64[]): uint64 {
    return super.sum(mode, ...values) + 1n;
  }
}
export function run(): boolean {
  const child = new OverrideTotal();
  const base: Total = child;
  const exact: uint64 = 9007199254740993n;
  const expected: uint64 = 9007199254740994n;
  const values: uint64[] = [exact];
  return child.sum("empty") === 1n && base.sum("empty") === 1n &&
    child.sum("run", exact) === expected && base.sum("run", ...values) === expected &&
    new Total().sum("run", exact) === exact;
}
`;

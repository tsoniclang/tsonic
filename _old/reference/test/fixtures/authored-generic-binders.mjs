export const authoredGenericBinderFiles = Object.freeze({
  "factory.ts": `
    export function capture<T>(seed: T) {
      return {
        identity<T>(value: T): T { return value; },
        reserved<CapturedT>(value: CapturedT): CapturedT { return value; },
        pair<T>(value: T): [typeof seed, T] { return [seed, value]; },
        constrained<T extends { score: number }>(value: T): [typeof seed, number] { return [seed, value.score]; },
      };
    }
    export function local<T>(seed: T) {
      return class Entry<T> {
        value: T;
        constructor(value: T) { this.value = value; }
        pair(): [typeof seed, T] { return [seed, this.value]; }
        identity<U>(value: U): U { return value; }
        same<T>(value: T): T { return value; }
      };
    }
    export function identity<T>(value: T): T { return value; }
  `,
  "other.ts": `
    export function identity<T>(value: T): T { return value; }
    export type Pair<T> = { left: T; right: T };
    export function pair<T>(value: T): Pair<T> { return { left: value, right: value }; }
  `,
  "index.ts": `
    import { capture, local, identity } from "./factory.js";
    import { identity as other, pair } from "./other.js";
    export function run(): boolean {
      const first = capture("seed");
      const second = capture(7);
      const left = first.pair(9);
      const right = second.pair("value");
      const constrained = first.constrained({ score: 11 });
      const Entry = local("outer");
      const instance = new Entry<number>(17);
      const captured = instance.pair();
      const record = pair(other(identity("record")));
      return first.identity(true) && second.identity("item") === "item" && first.reserved(5) === 5 &&
        left[0] === "seed" && left[1] === 9 && right[0] === 7 && right[1] === "value" &&
        constrained[0] === "seed" && constrained[1] === 11 &&
        captured[0] === "outer" && captured[1] === 17 && instance.identity(false) === false && instance.same("same") === "same" &&
        record.left === "record" && record.right === "record";
    }
  `,
});

interface JsArrayMemberEffect {
  readonly kind: "length" | "copy" | "entries" | "method";
  readonly mayShrink?: boolean;
  readonly callbackReceiverIndex?: number;
}

const preserving = Object.freeze({ kind: "method" } as const);
const shrinking = Object.freeze({ kind: "method", mayShrink: true } as const);
const callback = Object.freeze({ kind: "method", callbackReceiverIndex: 2 } as const);
const reducing = Object.freeze({ kind: "method", callbackReceiverIndex: 3 } as const);
const copying = Object.freeze({ kind: "copy" } as const);
const effects: Readonly<Record<string, JsArrayMemberEffect>> = Object.freeze({
  length: Object.freeze({ kind: "length" }),
  entries: Object.freeze({ kind: "entries" }),
  keys: preserving, values: preserving, push: preserving, pop: shrinking,
  shift: shrinking, unshift: preserving, reverse: preserving, sort: preserving,
  fill: preserving, copyWithin: preserving, splice: shrinking, slice: preserving,
  concat: preserving, includes: preserving, indexOf: preserving,
  lastIndexOf: preserving, join: preserving, toString: preserving, flat: preserving,
  at: preserving, toReversed: preserving, toSorted: preserving,
  toSpliced: preserving, with: preserving,
  map: callback, filter: callback, forEach: callback, every: callback,
  some: callback, find: callback, findIndex: callback, findLast: callback,
  findLastIndex: callback, flatMap: callback, reduce: reducing, reduceRight: reducing,
});

export function jsArrayMemberEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): JsArrayMemberEffect | undefined {
  if (identity === undefined) return undefined;
  if (identity.ownerName === "ArrayConstructor" && identity.memberName === "from") return copying;
  if (!["Array", "ReadonlyArray", "TypedArray"].includes(identity.ownerName) ||
    !Object.prototype.hasOwnProperty.call(effects, identity.memberName)) return undefined;
  return effects[identity.memberName];
}

// Storage rows of the JS API meaning table (api/table.ts): which JS API calls allocate, alias an argument, or resume
// their receiver, and the global binding each operation belongs to. Row data only; the lookup is the one table.

/** The storage facet of one JS API operation. Receiver resumption is the callback facet's `resumeReceiver`. */
export type JsSourceStorageOperation =
  /** The call's result is a fresh native allocation (`new Error()`, `Error()`); a construct signature also constructs natively. */
  | { readonly kind: "allocation"; readonly binding: string; readonly nativeConstructor: boolean }
  /** The call's result is its single positional value argument at parameter 0 (`Object.freeze(x)`). */
  | { readonly kind: "argument-alias"; readonly binding: string };

const errorBindings: readonly (readonly [owner: string, binding: string])[] = [
  ["ErrorConstructor", "Error"],
  ["RangeErrorConstructor", "RangeError"],
  ["TypeErrorConstructor", "TypeError"],
  ["URIErrorConstructor", "URIError"],
];

/** Storage rows by declaring name and member name (`constructor` for a construct signature, `call` for a call signature). */
export const jsSourceStorageRows: Readonly<Record<string, Readonly<Record<string, JsSourceStorageOperation>>>> = Object.freeze({
  ...Object.fromEntries(errorBindings.map(([owner, binding]) => [owner, Object.freeze({
    constructor: Object.freeze({ kind: "allocation" as const, binding, nativeConstructor: true }),
    call: Object.freeze({ kind: "allocation" as const, binding, nativeConstructor: false }),
  })])),
  ObjectConstructor: Object.freeze({ freeze: Object.freeze({ kind: "argument-alias" as const, binding: "Object" }) }),
});

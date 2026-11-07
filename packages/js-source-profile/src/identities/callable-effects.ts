// Callback and refusal rows of the JS API meaning table (api/table.ts): when a JS API operation runs its callback
// arguments and which values flow into them, and which members a Source program may not call. Row data only; every
// lookup goes through the one table, keyed by the JS API identity (declaring name + member name).
import type { SourceJsCallbackEffect } from "@tsonic/target-api/source";

const none: readonly number[] = Object.freeze([]);
const first: readonly number[] = Object.freeze([0]);
const second: readonly number[] = Object.freeze([1]);

/** The callback facet of one JS API operation. */
export interface JsSourceCallableEffects {
  readonly entries: readonly SourceJsCallbackEffect[];
  /** Parameter indexes whose argument the operation only invokes (never retains). */
  readonly invocationOnly: readonly number[];
  /** The operation keeps this meaning in every source profile that declares it (shared base declarations included). */
  readonly native?: true;
  /** The call resumes its receiver (`generator.next()`). */
  readonly resumeReceiver?: true;
}

const synchronous = (indexes: readonly number[], inputs?: SourceJsCallbackEffect["inputs"]): readonly SourceJsCallbackEffect[] =>
  Object.freeze(indexes.map(parameterIndex => Object.freeze({ parameterIndex, timing: "synchronous" as const,
    ...(inputs === undefined ? {} : { inputs: Object.freeze(inputs.map(input => Object.freeze(input))) }) })));
const firstSynchronous = synchronous(first, [{ parameterIndex: 0, from: "receiver-element" }]);
const secondSynchronous = synchronous(second, [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }]);
const comparator = synchronous(first, [0, 1].map(parameterIndex => ({ parameterIndex, from: "receiver-element" as const })));
const deferred = (indexes: readonly number[]): readonly SourceJsCallbackEffect[] => Object.freeze(
  indexes.map(parameterIndex => Object.freeze({ parameterIndex, timing: "deferred" as const })),
);
const array = Object.freeze({
  map: firstSynchronous, filter: firstSynchronous, some: firstSynchronous, every: firstSynchronous,
  find: firstSynchronous, findLast: firstSynchronous, findIndex: firstSynchronous, findLastIndex: firstSynchronous,
  forEach: firstSynchronous, reduce: synchronous(first, [{ parameterIndex: 1, from: "receiver-element" }]),
});
const forEach = Object.freeze({ forEach: synchronous(first) });
const rejectedInput = Object.freeze([{ parameterIndex: 0, from: "receiver-rejection" as const }]);
const rejected = Object.freeze({ parameterIndex: 0, timing: "deferred" as const, inputs: rejectedInput });
const reactions = Object.freeze({
  then: Object.freeze([...deferred(first), Object.freeze({ ...rejected, parameterIndex: 1 })]),
  catch: Object.freeze([rejected]), finally: deferred(first),
});
const lifetimeRows = (rows: Readonly<Record<string, readonly SourceJsCallbackEffect[]>>, invocationOnly: readonly number[],
  native?: true): Readonly<Record<string, JsSourceCallableEffects>> => Object.freeze(Object.fromEntries(Object.entries(rows)
  .map(([name, entries]) => [name, Object.freeze({ entries, invocationOnly, ...(native === undefined ? {} : { native }) })])));
const resume = Object.freeze({ entries: Object.freeze([]), invocationOnly: none, native: true as const, resumeReceiver: true as const });
const resumes = Object.freeze({
  next: resume, return: resume, throw: Object.freeze({ entries: Object.freeze([]), invocationOnly: none }),
});

/** Callback rows by declaring name and member name (`constructor` for a construct signature). */
export const jsSourceCallableEffectRows: Readonly<Record<string, Readonly<Record<string, JsSourceCallableEffects>>>> = Object.freeze({
  ArrayConstructor: lifetimeRows({ from: secondSynchronous }, second),
  Array: lifetimeRows({ ...array, sort: comparator }, first),
  ReadonlyArray: lifetimeRows(array, first),
  Map: lifetimeRows(forEach, first), ReadonlyMap: lifetimeRows(forEach, first),
  Set: lifetimeRows(forEach, first), ReadonlySet: lifetimeRows(forEach, first),
  TypedArray: lifetimeRows({ sort: comparator }, first),
  Promise: lifetimeRows(reactions, none),
  PromiseLike: lifetimeRows({ then: reactions.then }, none),
  PromiseConstructor: lifetimeRows({ constructor: Object.freeze([
    Object.freeze({ parameterIndex: 0, timing: "synchronous" as const, rejection: 1 }),
  ]) }, none, true),
  Generator: resumes, AsyncGenerator: resumes,
});

const generatorThrow = Object.freeze({ code: "TSONIC_GENERATOR_THROW_UNSUPPORTED", message: "Generator throw-in is not supported." });

/** Source refusals of calling a JS API member, by declaring name and member name (baseline codes and messages). */
export const jsSourceCallRefusalRows: Readonly<Record<string, Readonly<Record<string, {
  readonly code: string; readonly message: string;
}>>>> = Object.freeze({
  Generator: Object.freeze({ throw: generatorThrow }),
  AsyncGenerator: Object.freeze({ throw: generatorThrow }),
  ObjectConstructor: Object.freeze({ isFrozen: Object.freeze({ code: "TSONIC_IS_FROZEN_UNSUPPORTED",
    message: "Object.isFrozen has no native equivalent; immutability is a compile-time property. Use readonly declarations instead." }) }),
});

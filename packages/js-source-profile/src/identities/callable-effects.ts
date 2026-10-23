const none: readonly number[] = Object.freeze([]);
const first: readonly number[] = Object.freeze([0]);
const second: readonly number[] = Object.freeze([1]);
interface CallableParameterEffect {
  readonly parameterIndex: number;
  readonly timing: "synchronous" | "deferred";
  readonly rejection?: number;
  readonly inputs?: readonly {
    readonly parameterIndex: number;
    readonly from: "receiver-element" | "argument-element" | "receiver-rejection";
    readonly sourceParameterIndex?: number;
  }[];
}
const synchronous = (indexes: readonly number[], inputs?: CallableParameterEffect["inputs"]): readonly CallableParameterEffect[] => Object.freeze(
  indexes.map(parameterIndex => Object.freeze({ parameterIndex, timing: "synchronous" as const,
    ...(inputs === undefined ? {} : { inputs: Object.freeze(inputs.map(input => Object.freeze(input))) }) })),
);
const firstSynchronous = synchronous(first, [{ parameterIndex: 0, from: "receiver-element" }]);
const secondSynchronous = synchronous(second, [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }]);
const comparator = synchronous(first, [0, 1].map(parameterIndex => ({ parameterIndex, from: "receiver-element" as const })));
const deferred = (indexes: readonly number[]): readonly CallableParameterEffect[] => Object.freeze(
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
interface CallableOperationEffects {
  readonly entries: readonly CallableParameterEffect[];
  readonly invocationOnly: readonly number[];
  readonly native?: true;
  readonly resumeReceiver?: true;
}
const lifetimeRows = (rows: Readonly<Record<string, readonly CallableParameterEffect[]>>, invocationOnly: readonly number[], native?: true):
  Readonly<Record<string, CallableOperationEffects>> => Object.freeze(Object.fromEntries(Object.entries(rows)
    .map(([name, entries]) => [name, Object.freeze({ entries, invocationOnly, ...(native === undefined ? {} : { native }) })])));
const resume = Object.freeze({ entries: Object.freeze([]), invocationOnly: none, native: true as const, resumeReceiver: true as const });
const resumes = Object.freeze({ next: resume, throw: resume, return: resume });
const effects: Readonly<Record<string, Readonly<Record<string, CallableOperationEffects>>>> = Object.freeze({
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
function operationFor(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): CallableOperationEffects | undefined {
  if (identity === undefined || !Object.prototype.hasOwnProperty.call(effects, identity.ownerName)) return undefined;
  const owner = effects[identity.ownerName]!;
  return Object.prototype.hasOwnProperty.call(owner, identity.memberName) ? owner[identity.memberName] : undefined;
}

export function jsSourceCallableParameterEffects(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): readonly CallableParameterEffect[] | undefined {
  return operationFor(identity)?.entries;
}

export function jsSourceInvocationOnlyCallableParameters(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): readonly number[] {
  return operationFor(identity)?.invocationOnly ?? none;
}

export function jsSourceNativeStorageOperation(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): boolean {
  return operationFor(identity)?.native === true;
}

export function jsSourceReceiverResumeEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): true | undefined {
  return operationFor(identity)?.resumeReceiver;
}

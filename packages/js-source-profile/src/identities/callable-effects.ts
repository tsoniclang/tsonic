const none: readonly number[] = Object.freeze([]);
const first: readonly number[] = Object.freeze([0]);
const second: readonly number[] = Object.freeze([1]);
const array = Object.freeze({
  map: first, filter: first, some: first, every: first,
  find: first, findLast: first, findIndex: first, findLastIndex: first,
  forEach: first, reduce: first,
});
const forEach = Object.freeze({ forEach: first });
const effects: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = Object.freeze({
  ArrayConstructor: Object.freeze({ from: second }),
  Array: Object.freeze({ ...array, sort: first }),
  ReadonlyArray: array,
  Map: forEach, ReadonlyMap: forEach, Set: forEach, ReadonlySet: forEach,
  TypedArray: Object.freeze({ sort: first }),
});

export function jsSourceInvocationOnlyCallableParameters(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined): readonly number[] {
  if (identity === undefined || !Object.hasOwn(effects, identity.ownerName)) return none;
  const owner = effects[identity.ownerName]!;
  return Object.hasOwn(owner, identity.memberName) ? owner[identity.memberName]! : none;
}

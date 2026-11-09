import type { LibraryDeclaration } from '../model/contract.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const tType = Object.freeze({ kind: "type-parameter", name: "T" } as const);

const presentValue = Object.freeze({ kind: "present", value: tType } as const);

const sharedRecord = Object.freeze({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const booleanData = Object.freeze({ kind: "boolean" } as const);

export const coreCompileTimeDeclarations: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "comptime",
  name: "comptime",
  exportName: "comptime",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "comptime<T>(value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "value", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "comptime<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "comptimeif",
  name: "comptimeif",
  exportName: "comptimeif",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "comptimeif(condition)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "condition",
          type: booleanData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: booleanData } as const),
      typeParameters: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "unroll",
  name: "unroll",
  exportName: "unroll",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "unroll<T>(iterable)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "iterable", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
]);

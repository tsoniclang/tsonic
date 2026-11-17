import type { LibraryDeclaration, LibraryParameter, LibrarySignature, LibraryType, LibraryTypeParameter, Presence } from '../model/contract.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const tType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "T" });

const presentValue = Object.freeze<Presence<LibraryType>>({ kind: "present", value: tType });

const sharedRecord = Object.freeze<LibraryTypeParameter>({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord]);

const booleanData = Object.freeze<LibraryType>({ kind: "boolean" });

export const coreCompileTimeDeclarations: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "comptime<T>(value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "value",
          type: tType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
    Object.freeze<LibrarySignature>({
      id: "comptime<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "comptimeif(condition)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "condition",
          type: booleanData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: booleanData }),
      typeParameters: emptyItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "unroll<T>(iterable)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "iterable",
          type: tType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
]);

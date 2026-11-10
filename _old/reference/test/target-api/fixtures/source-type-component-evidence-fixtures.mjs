export const componentEvidenceProgram = `
  import type { DerivedStore, word } from "@test/native/types.js";
  type Floating = number;
  type BroadObject = object;
  type ReadonlyObject = Readonly<BroadObject>;
  type PartialObject = Partial<BroadObject>;
  type RequiredObject = Required<BroadObject>;
  type ReadonlyFields = Readonly<{ value: number }>;
  type ReadonlyEmpty = Readonly<{}>;
  type ReadonlyGeneric<Value extends object> = Readonly<Value>;
  type ReadonlyNative = Readonly<DerivedStore<word>>;
  type PartialFields = Partial<{ value: number }>;
  type RequiredFields = Required<{ value?: number }>;
  type PickedFields = Pick<{ value: number; other: string }, "value">;
  type RecordedFields = Record<"value", number>;
  type Wide = bigint;
  type Callable = (first: Floating, second: Wide) => string;
  type Indirect = Callable;
  type Exact = word;
  type Mixed = [Exact, Floating];
  type Recursive = { next?: Recursive; value: word };
  type Fields = { first: word; second: word; optional?: word; ordinary: number };
  type ChangedFields = { readonly [Key in keyof Fields]: boolean };
  type RenamedFields = { readonly [Key in keyof Fields as "renamed"]: Fields[Key] };
  type ReadonlyChanged = Readonly<ChangedFields>;
  type First = Fields["first"];
  type Several = Fields["first" | "second"];
  type Optional = Fields["optional"];
  type Present = NonNullable<Fields["optional"]>;
  type PresentAlias = NonNullable<Optional>;
  type PresentNested = NonNullable<PresentAlias>;
  type Absent = NonNullable<null | undefined>;
  type Indexed = { [key: string]: number }[string];
  type ImportedIndexed = DerivedStore<word>[string];
  type NumberIndexed = { readonly [key: number]: word }[number];
  type Deferred<T, K extends keyof T> = T[K];
  type NativeArray = word[];
  type TextArray = string[];
  type Arrays = NativeArray | TextArray;
  type NativeFactory = () => word;
  type Composed = Arrays | NativeFactory;
  type Bound<T> = string | T[];
  type Applied = Bound<word>;
  type Wrong = Bound<boolean>;
  type RecordUnion<T> = { kind: "values"; values: T[] } | { kind: "call"; callback: (value: T) => T };
  type AppliedRecordUnion = RecordUnion<word>;
  type WrongRecordUnion = RecordUnion<boolean>;
  type ForeignRecordUnion<T> = { kind: "values"; values: T[] } | { kind: "call"; callback: (value: T) => T };
  type ForeignAppliedRecordUnion = ForeignRecordUnion<word>;
  type OptionalValue = word | undefined;
  type NullableValue = word | null | undefined;
  type OptionalWrong = boolean | undefined;
  type NullableWrong = boolean | null | undefined;
  type TextValue = string;
  type TextOptionalValue = string | word | undefined;
  type TextOptionalWrong = string | boolean | undefined;
  function optional<Value>(value: Value): Value | undefined { return value; }
  function nullable<Value>(value: Value): Value | null | undefined { return value; }
  function mixed<Value>(value: Value): string | Value | undefined { return value; }
  function duplicate<Value>(value: Value): string | Value { return value; }
  declare function readonlyInput<Value>(value: Value): Readonly<Value>;
  function readonlyExplicit<Value extends object>(value: Value): Readonly<Value> { return readonlyInput(value); }
  function readonlyInferred<Value extends object>(value: Value) { return readonlyInput(value); }
`;

export const componentEvidenceGlobals = `
  interface Object {}
  interface Function {}
  interface CallableFunction extends Function {}
  interface NewableFunction extends Function {}
  interface String {}
  interface Number {}
  interface Boolean {}
  interface RegExp {}
  interface IArguments { length: number; [index: number]: unknown }
  interface Array<T> { length: number; [index: number]: T }
  interface ReadonlyArray<T> { readonly length: number; readonly [index: number]: T }
`;

export const componentEvidenceNativeDeclarations = `
  export type word = number;
  export interface Store<T> { readonly [key: string]: T | undefined }
  export interface DerivedStore<T> extends Store<T> {}
`;

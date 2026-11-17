import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";

export type ScalarRule = "type-id" | "signature-id" | "own-signature-id" | "definition-id" | "body-id" | "group-id" | "node-id" | "local-id"
  | "number" | "bigint" | "string" | "boolean" | "native" | "intrinsic" | "member-kind" | "signature-kind"
  | "parameter-kind" | "tuple-kind" | "passing" | "runtime-base" | "facet" | "sum-origin";
export interface TextFieldReader {
  readonly name: string;
  readonly request: () => TextRequest;
}

export interface TextRecordReader {
  readonly fields: readonly TextFieldReader[];
  readonly complete: () => void;
}

export type TextRequest =
  | { readonly kind: "number"; readonly rule: ScalarRule; readonly accept: (value: number) => void }
  | { readonly kind: "bigint"; readonly rule: ScalarRule; readonly accept: (value: bigint) => void }
  | { readonly kind: "boolean"; readonly rule: ScalarRule; readonly accept: (value: boolean) => void }
  | { readonly kind: "string"; readonly rule: ScalarRule; readonly accept: (value: string) => boolean }
  | { readonly kind: "nullable"; readonly value: () => TextRequest; readonly accept: () => void }
  | { readonly kind: "array"; readonly value: () => TextRequest; readonly complete: () => void }
  | { readonly kind: "record"; readonly open: (label: string) => TextRecordReader | { readonly kind: "invalid"; readonly expected: readonly string[] } };

export type ScalarRequest = TextRequest & { readonly kind: "number" | "bigint" | "boolean" | "string" };

export interface TextReader<Value> {
  readonly request: (accept: (value: Value) => void) => TextRequest;
}

export interface RecordReader<Value> extends TextReader<Value> {
  readonly request: (accept: (value: Value) => void) => TextRequest & { readonly kind: "record" };
}

interface FieldSlot<Value> extends TextFieldReader { readonly value: () => Value }
type ReadField = <Value>(name: string, reader: TextReader<Value>) => FieldSlot<Value>;
interface RecordBuild<Value> { readonly fields: readonly TextFieldReader[]; readonly value: () => Value }

const constructionFailure: InvariantFailure = { owner: "ir-types", query: null, origin: null,
  message: "A complete typed text record must publish every declared field." };

export function numberReader<Value>(rule: ScalarRule, make: (value: number) => Value): TextReader<Value> {
  return { request: accept => ({ kind: "number", rule, accept: value => accept(make(value)) }) };
}

export function bigintReader(): TextReader<bigint> {
  return { request: accept => ({ kind: "bigint", rule: "bigint", accept }) };
}

export function booleanReader(): TextReader<boolean> {
  return { request: accept => ({ kind: "boolean", rule: "boolean", accept }) };
}

export function stringReader<Value>(rule: ScalarRule, decode: (value: string) => Value | undefined): TextReader<Value> {
  return { request: accept => ({ kind: "string", rule, accept: value => {
    const decoded = decode(value);
    if (decoded === undefined) return false;
    accept(decoded);
    return true;
  } }) };
}

export function enumReader<Value extends string>(rule: ScalarRule, values: readonly Value[]): TextReader<Value> {
  return { request: accept => ({ kind: "string", rule, accept: value => {
    accept(requirePresent(values.find(candidate => candidate === value), constructionFailure));
    return true;
  } }) };
}

export function arrayReader<Value>(reader: () => TextReader<Value>): TextReader<readonly Value[]> {
  return { request: accept => {
    const values: Value[] = [];
    return { kind: "array", value: () => reader().request(value => { values.push(value); }), complete: () => accept(values) };
  } };
}

export function nullableReader<Value>(reader: () => TextReader<Value>): TextReader<Value | null> {
  return { request: accept => ({ kind: "nullable",
    value: () => reader().request(accept), accept: () => accept(null) }) };
}

export function lazyReader<Value>(reader: () => TextReader<Value>): TextReader<Value> {
  return { request: accept => reader().request(accept) };
}

export function recordReader<Value>(name: string, configure: (read: ReadField) => RecordBuild<Value>): RecordReader<Value> {
  const read: ReadField = <Child>(field: string, reader: TextReader<Child>): FieldSlot<Child> => {
    let slot: Child | undefined;
    return { name: field, request: () => reader.request(value => { slot = value; }),
      value: () => requirePresent(slot, constructionFailure) };
  };
  return { request: accept => ({ kind: "record", open: label => {
    if (label !== name) return { kind: "invalid", expected: [name] };
    const build = configure(read);
    return { fields: build.fields, complete: () => accept(build.value()) };
  } }) };
}

export function unionReader<Value>(expected: readonly string[],
  select: (label: string) => RecordReader<Value> | null): RecordReader<Value> {
  return { request: accept => ({ kind: "record", open: label => {
    const selected = select(label);
    return selected === null ? { kind: "invalid", expected } : selected.request(accept).open(label);
  } }) };
}

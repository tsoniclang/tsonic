import type { DecodedIdentity } from "../ids/contract.js";

export type Scalar = string | number | bigint | boolean;

export interface TextPath {
  readonly parent: TextPath | null;
  readonly segment: string;
}

export type WriteStep =
  | { readonly kind: "done" }
  | { readonly kind: "text"; readonly value: string; readonly next: () => WriteStep }
  | { readonly kind: "enter" | "leave"; readonly value: object;
      readonly path: TextPath; readonly next: () => WriteStep };

export type ReadStep<Value> =
  | { readonly kind: "continue"; readonly next: () => ReadStep<Value> }
  | { readonly kind: "invalid"; readonly offset: number;
      readonly expected: readonly string[]; readonly found: string | null }
  | { readonly kind: "complete"; readonly value: Value };

export interface TextReader {
  readonly identity: <Parts, Identity extends string, Result>(
    prefix: string, decode: (text: string) => DecodedIdentity<Parts>,
    encode: (parts: Parts) => Identity, next: (value: Identity) => ReadStep<Result>,
  ) => ReadStep<Result>;
  readonly string: <Result>(prefix: string | null, next: (value: string) => ReadStep<Result>) => ReadStep<Result>;
  readonly number: <Result>(prefix: string | null, next: (value: number) => ReadStep<Result>) => ReadStep<Result>;
  readonly bigint: <Result>(next: (value: bigint) => ReadStep<Result>) => ReadStep<Result>;
  readonly boolean: <Result>(next: (value: boolean) => ReadStep<Result>) => ReadStep<Result>;
  readonly literals: <Value extends string, Result>(
    values: readonly Value[], next: (value: Value) => ReadStep<Result>,
  ) => ReadStep<Result>;
  readonly record: <Result>(label: string, next: () => ReadStep<Result>) => ReadStep<Result>;
  readonly field: <Result>(
    name: string, previous: ReadonlySet<string>, first: boolean,
    next: () => ReadStep<Result>,
  ) => ReadStep<Result>;
  readonly endRecord: <Result>(previous: ReadonlySet<string>, next: () => ReadStep<Result>) => ReadStep<Result>;
  readonly startArray: <Result>(next: () => ReadStep<Result>) => ReadStep<Result>;
  readonly arrayElement: <Result>(
    first: boolean, next: () => ReadStep<Result>, end: () => ReadStep<Result>,
  ) => ReadStep<Result>;
  readonly nullable: <Result>(
    words: readonly string[], present: () => ReadStep<Result>, absent: () => ReadStep<Result>,
  ) => ReadStep<Result>;
  readonly variant: <Value, Result>(
    choices: readonly ReadChoice<Value>[], next: (value: Value) => ReadStep<Result>,
  ) => ReadStep<Result>;
}

export interface Wire<Value> {
  readonly words: readonly string[];
  readonly write: (value: Value, path: TextPath, next: () => WriteStep) => WriteStep;
  readonly read: <Result>(reader: TextReader, next: (value: Value) => ReadStep<Result>) => ReadStep<Result>;
}

export interface ReadChoice<Value> {
  readonly label: string;
  readonly read: <Result>(reader: TextReader, next: (value: Value) => ReadStep<Result>) => ReadStep<Result>;
}

export interface Fields<Value> {
  readonly write: (value: Value, path: TextPath, first: boolean, next: () => WriteStep) => WriteStep;
  readonly read: <Result>(
    reader: TextReader, previous: Set<string>, next: (value: Value) => ReadStep<Result>,
  ) => ReadStep<Result>;
}

export const rootPath: TextPath = ({ parent: null, segment: "$" });

export function childPath(parent: TextPath, segment: string): TextPath {
  return { parent, segment };
}

export function showPath(path: TextPath): string {
  const parts: string[] = [];
  let current: TextPath | null = path;
  while (current !== null) {
    parts.push(current.segment);
    current = current.parent;
  }
  return parts.reverse().join("");
}

export function wireText<Value>(wire: Wire<Value>, value: Value): string {
  const output: string[] = [];
  const active = new Set<object>();
  let current: WriteStep = wire.write(value, rootPath, () => ({ kind: "done" }));
  while (current.kind !== "done") {
    switch (current.kind) {
      case "text": output.push(current.value); break;
      case "enter":
        if (active.has(current.value)) throw new TypeError(`Cyclic MIR value at ${showPath(current.path)}`);
        active.add(current.value);
        break;
      case "leave": active.delete(current.value); break;
    }
    current = current.next();
  }
  return output.join("");
}

export function text(value: string, next: () => WriteStep): WriteStep {
  return { kind: "text", value, next };
}

export function stringToken(prefix: string | null): Wire<string> {
  return {
    words: prefix === null ? [] : [prefix],
    write: (value, _path, next) => text(`${prefix === null ? "" : `${prefix}:`}${JSON.stringify(value)}`, next),
    read: (reader, next) => reader.string(prefix, next),
  };
}

export function numberToken(prefix: string | null): Wire<number> {
  return {
    words: prefix === null ? ["NaN"] : [prefix],
    write: (value, _path, next) => text(`${prefix === null ? "" : `${prefix}:`}${numberText(value)}`, next),
    read: (reader, next) => reader.number(prefix, next),
  };
}

export function identityWire<Parts, Identity extends string>(
  prefix: string, decode: (text: string) => DecodedIdentity<Parts>, encode: (parts: Parts) => Identity,
): Wire<Identity> {
  return {
    words: [prefix],
    write: (value, _path, next) => text(`${prefix}:${JSON.stringify(value)}`, next),
    read: (reader, next) => reader.identity(prefix, decode, encode, next),
  };
}

export function ownedScalar<Value extends Scalar, Identity extends Value>(
  wire: Wire<Value>, construct: (value: Value) => Identity,
): Wire<Identity> {
  return {
    words: wire.words,
    write: (value, path, next) => wire.write(value, path, next),
    read: (reader, next) => wire.read(reader, value => next(construct(value))),
  };
}

export function numberText(value: number): string {
  return Object.is(value, -0) ? "-0" : Number.isNaN(value) ? "NaN"
    : value === Infinity ? "+Infinity" : value === -Infinity ? "-Infinity" : String(value);
}

export function literals<const Value extends string>(values: readonly Value[]): Wire<Value> {
  return {
    words: [],
    write: (value, _path, next) => text(JSON.stringify(value), next),
    read: (reader, next) => reader.literals(values, next),
  };
}

export function nullable<Value>(wire: () => Wire<Value>): Wire<Value | null> {
  return {
    words: ["null", ...wire().words],
    write: (value, path, next) => value === null ? text("null", next) : wire().write(value, path, next),
    read: (reader, next) => reader.nullable(wire().words, () => wire().read(reader, next), () => next(null)),
  };
}

export function vector<Value extends {}>(wire: () => Wire<Value>): Wire<readonly Value[]> {
  return {
    words: [],
    write: (values, path, next) => ({ kind: "enter", value: values, path, next: () => {
      const iterator = values.entries();
      const advance = (): WriteStep => {
        const selected = iterator.next();
        if (selected.done) return text("]", () => ({ kind: "leave", value: values, path, next }));
        const [index, value] = selected.value;
        const at = childPath(path, `[${index}]`);
        if (value === undefined || value === null) throw new TypeError(`Sparse MIR value at ${showPath(at)}`);
        return text(index === 0 ? "" : ", ", () => wire().write(value, at, advance));
      };
      return text("[", advance);
    } }),
    read: (reader, next) => reader.startArray(() => {
      const values: Value[] = [];
      const readValues = <Result>(finish: (values: readonly Value[]) => ReadStep<Result>): ReadStep<Result> =>
        reader.arrayElement(values.length === 0,
          () => wire().read(reader, value => {
            values.push(value);
            return { kind: "continue", next: () => readValues(finish) };
          }),
          () => finish(values));
      return readValues(next);
    }),
  };
}

export function finish<Value>(make: () => Value): Fields<Value> {
  return {
    write: (_value, _path, _first, next) => text(")", next),
    read: (reader, previous, next) => reader.endRecord(previous, () => next(make())),
  };
}

export function field<Value, Part>(
  name: string,
  wire: () => Wire<Part>,
  get: (value: Value) => NoInfer<Part>,
  tail: (part: NoInfer<Part>) => Fields<Value>,
): Fields<Value> {
  return {
    write: (value, path, first, next) => {
      const part = get(value);
      return text(`${first ? "" : ", "}${name}=`, () => wire().write(part, childPath(path, `.${name}`),
        () => tail(part).write(value, path, false, next)));
    },
    read: (reader, previous, next) => reader.field(name, previous, previous.size === 0,
      () => wire().read(reader, value => {
        previous.add(name);
        return { kind: "continue", next: () => tail(value).read(reader, previous, next) };
      })),
  };
}

export function record<Value extends object>(label: string, fields: () => Fields<Value>): Wire<Value> {
  return {
    words: [label],
    write: (value, path, next) => ({ kind: "enter", value, path,
      next: () => text(`${label}(`, () => fields().write(value, path, true,
        () => ({ kind: "leave", value, path, next }))) }),
    read: (reader, next) => reader.record(label, () => fields().read(reader, new Set(), next)),
  };
}

export function choice<Value, Part extends Value>(label: string, wire: () => Wire<Part>): ReadChoice<Value> {
  return { label, read: (reader, next) => wire().read(reader, next) };
}

export function variants<Value>(
  choices: readonly ReadChoice<Value>[],
  write: (value: Value, path: TextPath, next: () => WriteStep) => WriteStep,
): Wire<Value> {
  return { words: choices.map(choice => choice.label), write, read: (reader, next) => reader.variant(choices, next) };
}

export interface ScalarWires {
  readonly stringWire: Wire<string>;
  readonly numberWire: Wire<number>;
  readonly bigintWire: Wire<bigint>;
  readonly booleanWire: Wire<boolean>;
}

export function createScalarWires(): ScalarWires {
  const stringWire: Wire<string> = stringToken(null);

  const numberWire: Wire<number> = numberToken(null);

  const bigintWire: Wire<bigint> = {
    words: [], write: (value, _path, next) => text(`${value}n`, next), read: (reader, next) => reader.bigint(next),
  };

  const booleanWire: Wire<boolean> = {
    words: ["true", "false"], write: (value, _path, next) => text(String(value), next), read: (reader, next) => reader.boolean(next),
  };
  return { stringWire, numberWire, bigintWire, booleanWire };
}

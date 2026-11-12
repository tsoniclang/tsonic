import type { BodyId, DefId, ExpansionId, LocalId, ModuleId, NodeId, SigId, TyId } from "../ids/contract.js";
import type { HostDiagnosticCode } from "../diag/contract.js";
import { hostDiagnosticCode, requirePresent } from "../diag/index.js";
import type { TirBody, TirNode } from "./contract.js";

export type TirConstructionStep =
  | { readonly kind: "next"; readonly next: () => TirConstructionStep }
  | { readonly kind: "complete"; readonly value: TirBody };

export interface TirConstruction<Value> {
  readonly run: (next: (value: Value) => TirConstructionStep) => TirConstructionStep;
}

export const constructionValue = <Value>(value: Value): TirConstruction<Value> =>
  ({ run: next => ({ kind: "next", next: () => next(value) }) });

export const mapConstruction = <Input, Output>(input: TirConstruction<Input>, make: (value: Input) => Output): TirConstruction<Output> =>
  ({ run: next => ({ kind: "next", next: () => input.run(value => next(make(value))) }) });

export const appendConstruction = <Values extends readonly unknown[], Value>(
  previous: TirConstruction<Values>, value: TirConstruction<Value>,
): TirConstruction<readonly [...Values, Value]> => ({ run: next => ({ kind: "next",
  next: () => previous.run(values => value.run(actual => next([...values, actual]))) }) });

export const sequenceConstruction = <Value>(values: readonly TirConstruction<Value>[]): TirConstruction<readonly Value[]> =>
  ({ run: next => {
    const output: Value[] = [];
    const advance = (position: number): TirConstructionStep => ({ kind: "next", next: () => {
      const value = values[position];
      return value === undefined ? next(output) : value.run(actual => {
        output.push(actual);
        return advance(position + 1);
      });
    } });
    return advance(0);
  } });

export const memoSyntaxConstruction = <Value extends TirNode>(input: TirConstruction<Value>): TirConstruction<Value> => {
  let saved: { readonly value: Value } | undefined;
  return { run: next => ({ kind: "next", next: () => {
    if (saved !== undefined) return next(saved.value);
    return input.run(value => {
      saved = { value };
      return next(value);
    });
  } }) };
};

export type TirSyntaxConstruction = {
  readonly [Kind in TirNode["kind"]]: {
    readonly kind: Kind;
    readonly value: TirConstruction<TirNode & { readonly kind: Kind }>;
  }
}[TirNode["kind"]];

export type TirSyntaxFactory<Node extends TirNode> = (kind: Node["kind"],
  make: <Kind extends Node["kind"]>(kind: Kind) => TirConstruction<Node & { readonly kind: Kind }>,
) => TirSyntaxConstruction;

export interface TirFieldLayout { readonly name: string; readonly type: string }
export interface TirRecordLayout {
  readonly label: string;
  readonly fields: readonly TirFieldLayout[];
  readonly wireFields: readonly TirFieldLayout[];
  readonly labels: ReadonlySet<string>;
  readonly hasKind: boolean;
}

export type TirIdentityInput =
  | { readonly prefix: "mod"; readonly value: ModuleId }
  | { readonly prefix: "def"; readonly value: DefId }
  | { readonly prefix: "body"; readonly value: BodyId }
  | { readonly prefix: "exp"; readonly value: ExpansionId }
  | { readonly prefix: "n"; readonly value: NodeId }
  | { readonly prefix: "l"; readonly value: LocalId }
  | { readonly prefix: "t"; readonly value: TyId }
  | { readonly prefix: "sig"; readonly value: SigId };

export type TirConstructionCursor =
  | { readonly kind: "field"; readonly field: TirFieldLayout; readonly requests: (name: string) => readonly TirValueRequest[];
      readonly close: (() => void) | null }
  | { readonly kind: "complete"; readonly publish: () => void };

export interface TirRecordConstruction {
  readonly cursor: () => TirConstructionCursor;
}

export interface TirSyntaxReader {
  readonly start: (accept: (value: TirSyntaxConstruction) => void) => TirRecordConstruction;
}

export interface TirSequenceConstruction {
  readonly requests: () => readonly TirValueRequest[];
  readonly publish: () => void;
}

interface TirIdentityValues {
  readonly mod: ModuleId;
  readonly def: DefId;
  readonly body: BodyId;
  readonly exp: ExpansionId;
  readonly n: NodeId;
  readonly l: LocalId;
  readonly t: TyId;
  readonly sig: SigId;
}

type TirIdentityRequest = { readonly [Prefix in keyof TirIdentityValues]: {
  readonly kind: Prefix;
  readonly type: string;
  readonly read: (value: TirIdentityValues[Prefix]) => void;
} }[keyof TirIdentityValues];

export type TirPlainScalar = string | number | bigint | boolean | null;
export type TirValueRequest = TirIdentityRequest
  | { readonly kind: "scalar"; readonly type: string; readonly read: (input: TirPlainScalar) => boolean }
  | { readonly kind: "record"; readonly type: string; readonly records: (label: string) => readonly TirRecordConstruction[] }
  | { readonly kind: "sequence"; readonly type: string; readonly sequence: () => TirSequenceConstruction }
  | { readonly kind: "syntax"; readonly type: string;
      readonly reference: (ordinal: number) => (value: TirSyntaxConstruction) => boolean };

export interface TirReader<Value> {
  readonly literalSets: readonly TirLiteralSet[];
  readonly requests: (accept: (value: TirConstruction<Value>) => void) => readonly TirValueRequest[];
}

export interface TirLiteralSet { readonly type: string; readonly values: readonly (string | number)[] }

export interface TirLiteralReader<Value extends string | number> extends TirReader<Value> {
  readonly type: string;
  readonly values: readonly Value[];
}

export const scalarReader = <Value>(type: string,
  select: (input: TirPlainScalar) => { readonly value: Value } | null,
  literals: readonly (string | number)[] | null = null,
): TirReader<Value> => ({ literalSets: literals === null ? [] : [{ type, values: literals }],
  requests: accept => [{ kind: "scalar", type, read: input => {
  const selected = select(input);
  if (selected === null) return false;
  accept(constructionValue(selected.value));
  return true;
} }] });

export const literalReader = <Value extends string | number>(type: string, values: readonly Value[]): TirLiteralReader<Value> =>
  ({ type, values, ...scalarReader(type, input => {
    const value = values.find(value => value === input);
    return value === undefined ? null : { value };
  }, values) });

export const nullReader: TirReader<null> = Object.freeze<TirReader<null>>({ literalSets: Object.freeze([]), requests: accept => [{ kind: "scalar", type: "null", read: input => {
  if (input !== null) return false;
  accept(constructionValue(null));
  return true;
} }] });

export interface TirScalarReaders {
  readonly stringReader: TirReader<string>;
  readonly numberReader: TirReader<number>;
  readonly bigintReader: TirReader<bigint>;
  readonly booleanReader: TirReader<boolean>;
  readonly nullReader: TirReader<null>;
  readonly diagnosticCodeReader: TirReader<HostDiagnosticCode>;
  readonly moduleReader: TirReader<ModuleId>;
  readonly definitionReader: TirReader<DefId>;
  readonly bodyReader: TirReader<BodyId>;
  readonly expansionReader: TirReader<ExpansionId>;
  readonly nodeReader: TirReader<NodeId>;
  readonly localReader: TirReader<LocalId>;
  readonly typeReader: TirReader<TyId>;
  readonly signatureReader: TirReader<SigId>;
}

export const createScalarReaders = (): TirScalarReaders => {
  const stringReader: TirReader<string> = scalarReader("string", input =>
    typeof input === "string" ? { value: input } : null);
  const numberReader: TirReader<number> = scalarReader("number", input =>
    typeof input === "number" ? { value: input } : null);
  const bigintReader: TirReader<bigint> = scalarReader("bigint", input =>
    typeof input === "bigint" ? { value: input } : null);
  const booleanReader: TirReader<boolean> = scalarReader("boolean", input =>
    typeof input === "boolean" ? { value: input } : null);
  const diagnosticCodeReader: TirReader<HostDiagnosticCode> = scalarReader("HostDiagnosticCode", input =>
    typeof input === "string" ? { value: hostDiagnosticCode(input) } : null);
  const moduleReader: TirReader<ModuleId> = { literalSets: [], requests: accept => [{ kind: "mod", type: "mod",
    read: value => accept(constructionValue(value)) }] };
  const definitionReader: TirReader<DefId> = { literalSets: [], requests: accept => [{ kind: "def", type: "def",
    read: value => accept(constructionValue(value)) }] };
  const bodyReader: TirReader<BodyId> = { literalSets: [], requests: accept => [{ kind: "body", type: "body",
    read: value => accept(constructionValue(value)) }] };
  const expansionReader: TirReader<ExpansionId> = { literalSets: [], requests: accept => [{ kind: "exp", type: "exp",
    read: value => accept(constructionValue(value)) }] };
  const nodeReader: TirReader<NodeId> = { literalSets: [], requests: accept => [{ kind: "n", type: "n",
    read: value => accept(constructionValue(value)) }] };
  const localReader: TirReader<LocalId> = { literalSets: [], requests: accept => [{ kind: "l", type: "l",
    read: value => accept(constructionValue(value)) }] };
  const typeReader: TirReader<TyId> = { literalSets: [], requests: accept => [{ kind: "t", type: "t",
    read: value => accept(constructionValue(value)) }] };
  const signatureReader: TirReader<SigId> = { literalSets: [], requests: accept => [{ kind: "sig", type: "sig",
    read: value => accept(constructionValue(value)) }] };
  return { stringReader, numberReader, bigintReader, booleanReader, nullReader, diagnosticCodeReader, moduleReader, definitionReader, bodyReader, expansionReader, nodeReader, localReader, typeReader, signatureReader };
};

export const nullableReader = <Value>(read: TirReader<Value>): TirReader<Value | null> => ({ literalSets: read.literalSets, requests: accept => [
  ...nullReader.requests(accept), ...read.requests(accept),
] });

export const sequenceReader = <Value>(type: string, read: TirReader<Value>): TirReader<readonly Value[]> =>
  ({ literalSets: read.literalSets, requests: accept => [{ kind: "sequence", type, sequence: () => {
    const values: TirConstruction<Value>[] = [];
    return { requests: () => read.requests(value => { values.push(value); }),
      publish: () => accept(sequenceConstruction(values)) };
  } }] });

export const unionReader = <Value>(type: string, reads: () => readonly TirReader<Value>[]): TirReader<Value> =>
  ({ literalSets: [], requests: accept => reads().flatMap(read => read.requests(accept).map(request => ({ ...request, type }))) });

export const lazyReader = <Value>(read: () => TirReader<Value>): TirReader<Value> =>
  ({ literalSets: [], requests: accept => read().requests(accept) });

export const syntaxReader = <Value extends TirNode>(type: string,
  select: (value: TirSyntaxConstruction) => TirConstruction<Value> | null,
): TirReader<Value> => ({ literalSets: [], requests: accept => [{ kind: "syntax", type, reference: ordinal => {
  let resolved: TirConstruction<Value> | undefined;
  accept({ run: next => ({ kind: "next", next: () => requirePresent(resolved, { owner: "ir-tir",
    query: { name: "text.syntax-reference", encodedKey: String(ordinal) }, origin: null,
    message: "validated syntax reference has no typed construction" }).run(next) }) });
  return value => {
    const selected = select(value);
    if (selected === null) return false;
    resolved = selected;
    return true;
  };
} }] });

import type { TirConstruction, TirConstructionCursor, TirFieldLayout, TirLiteralReader, TirReader, TirRecordConstruction, TirRecordLayout, TirScalarReaders, TirSyntaxFactory, TirSyntaxReader } from "./text-construction.js";
import { appendConstruction, constructionValue, createScalarReaders, lazyReader, literalReader, mapConstruction, memoSyntaxConstruction, nullableReader, sequenceConstruction, sequenceReader, unionReader } from "./text-construction.js";
import { createSyntaxReaders } from "./text-syntax-construction.js";
import type { TirSyntaxReaders } from "./text-syntax-construction.js";
import type { MemberSelection, TirBody, TirNode } from "./contract.js";
import type { ConstructionPartDecision } from "../ir-infer/contract.js";
import type { BindingVector, TypeEvidence } from "../ir-types/contract.js";
import type { DefId, LocalId, LocalRef, NodeId, NodeRef, SigId, SourceNodeRef, TyId } from "../ids/contract.js";

export type TirWireNode = TirNode;

export interface TirRecord {
  readonly [field: string]: unknown;
}

export type { TirFieldLayout, TirRecordLayout } from "./text-construction.js";

interface TirDiscriminant {
  readonly field: string;
  readonly value: string;
}

export interface TirLayouts {
  readonly bodyReader: TirReader<TirBody>;
  readonly literals: ReadonlyMap<string, readonly string[]>;
  readonly numericLiterals: ReadonlySet<string>;
  readonly syntax: ReadonlyMap<string, TirSyntaxReader>;
  readonly bodyWork: (body: TirBody) => TirTypedRecordWork;
  readonly nodeWork: (node: TirWireNode) => TirTypedRecordWork;
}

export interface TirValuePath {
  readonly parent: TirValuePath | null;
  readonly field: string | number;
}

export const tirPathText = (path: TirValuePath | null, root: string): string => {
  const parts: string[] = [];
  for (let current = path; current !== null; current = current.parent) {
    parts.push(typeof current.field === "number" ? `[${current.field}]` : `[${JSON.stringify(current.field)}]`);
  }
  return root + parts.reverse().join("");
};

export const enterTirInline = (active: Set<object>, value: object, path: TirValuePath | null, root: string): void => {
  if (active.has(value)) throw new TypeError(`ir-tir: inline cycle at ${tirPathText(path, root)}`);
  active.add(value);
};

export type TirScalarValue = string | number | bigint | boolean | null;

export type TirRecordAssociation =
  | { readonly kind: "binding"; readonly value: BindingVector }
  | { readonly kind: "evidence"; readonly value: TypeEvidence }
  | { readonly kind: "node-reference"; readonly value: NodeRef }
  | { readonly kind: "source-reference"; readonly value: SourceNodeRef }
  | { readonly kind: "local-reference"; readonly value: LocalRef }
  | { readonly kind: "member-selection"; readonly value: MemberSelection }
  | { readonly kind: "construction-part"; readonly value: ConstructionPartDecision };

export interface TirTypedFieldWork { readonly name: string; readonly work: TirTypedWork }
export type TirReference =
  | { readonly prefix: "def"; readonly value: DefId }
  | { readonly prefix: "n"; readonly value: NodeId }
  | { readonly prefix: "l"; readonly value: LocalId }
  | { readonly prefix: "t"; readonly value: TyId }
  | { readonly prefix: "sig"; readonly value: SigId };
export interface TirTypedRecordWork {
  readonly kind: "record";
  readonly type: string;
  readonly layout: TirRecordLayout;
  readonly label: string;
  readonly value: object;
  readonly syntax: TirWireNode | null;
  readonly association: TirRecordAssociation | null;
  readonly bindingOwner?: DefId | null;
  readonly fields: () => readonly TirTypedFieldWork[];
}

export const withBindingOwner = (work: TirTypedRecordWork, owner: DefId | null): TirTypedRecordWork =>
  ({ ...work, bindingOwner: owner });
export type TirTypedWork = TirTypedRecordWork
  | { readonly kind: "scalar"; readonly type: string; readonly value: TirScalarValue; readonly reference: TirReference | null }
  | { readonly kind: "sequence"; readonly type: string; readonly value: object; readonly length: number; readonly element: (position: number) => TirTypedWork | null }
  | { readonly kind: "node"; readonly type: string; readonly value: TirWireNode };

export type TirValueWork =
  | { readonly kind: "exit"; readonly value: object }
  | { readonly kind: "value"; readonly value: TirTypedWork; readonly path: TirValuePath | null };

export type TirPrintValue =
  | { readonly kind: "scalar"; readonly type: string; readonly value: TirScalarValue }
  | { readonly kind: "node"; readonly position: number }
  | { readonly kind: "sequence"; readonly elements: readonly TirPrintValue[] }
  | { readonly kind: "record"; readonly label: string; readonly fields: readonly TirPrintField[] };
export interface TirPrintField { readonly name: string; readonly value: TirPrintValue }
export interface TirPrintedNode { readonly position: number; readonly value: TirPrintValue }
export interface TirNodeArena { readonly body: TirPrintValue; readonly nodes: readonly TirPrintedNode[] }

interface TirArenaPosition { readonly position: number }
type TirArenaStep =
  | { readonly kind: "done"; readonly value: TirPrintValue }
  | { readonly kind: "value"; readonly work: TirTypedWork; readonly path: TirValuePath | null;
      readonly root: string; readonly next: (value: TirPrintValue) => TirArenaStep }
  | { readonly kind: "record"; readonly work: TirTypedRecordWork; readonly fields: readonly TirTypedFieldWork[];
      readonly output: TirPrintField[]; readonly path: TirValuePath | null; readonly root: string;
      readonly position: number; readonly next: (value: TirPrintValue) => TirArenaStep }
  | { readonly kind: "sequence"; readonly work: TirTypedWork & { readonly kind: "sequence" };
      readonly output: TirPrintValue[]; readonly path: TirValuePath | null; readonly root: string;
      readonly position: number; readonly next: (value: TirPrintValue) => TirArenaStep }
  | { readonly kind: "node-done"; readonly node: TirWireNode; readonly entry: TirArenaPosition;
      readonly value: TirPrintValue; readonly next: () => TirArenaStep };

export const hostNumberText = (value: number): string => {
  if (Object.is(value, -0)) return "-0";
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "+Infinity";
  if (value === -Infinity) return "-Infinity";
  return String(value);
};

export const indexTirNodes = (body: TirBody, layouts: TirLayouts): TirNodeArena => {
  const nodes: TirPrintedNode[] = [];
  const positions = new Map<object, TirArenaPosition>();
  const activeSyntax = new Set<object>();
  const activeInline = new Set<object>();
  let step: TirArenaStep = { kind: "value", work: layouts.bodyWork(body), path: null, root: "$body",
    next: value => ({ kind: "done", value }) };
  const advance = (current: Exclude<TirArenaStep, { readonly kind: "done" }>): TirArenaStep => {
    switch (current.kind) {
      case "node-done":
        activeSyntax.delete(current.node);
        nodes.push({ position: current.entry.position, value: current.value });
        return current.next();
      case "value": {
        const work = current.work;
        switch (work.kind) {
          case "scalar": return current.next({ kind: "scalar", type: work.type, value: work.value });
          case "node": {
            const path = current.root === "$body" ? null : current.path;
            if (activeSyntax.has(work.value)) throw new TypeError(`ir-tir: syntax cycle at ${tirPathText(path, "$syntax")}`);
            const known = positions.get(work.value);
            if (known !== undefined) return current.next({ kind: "node", position: known.position });
            const entry: TirArenaPosition = { position: positions.size };
            positions.set(work.value, entry);
            activeSyntax.add(work.value);
            return { kind: "value", work: layouts.nodeWork(work.value), path, root: "$syntax",
              next: value => ({ kind: "node-done", node: work.value, entry, value,
                next: () => current.next({ kind: "node", position: entry.position }) }) };
          }
          case "sequence":
            enterTirInline(activeInline, work.value, current.path, current.root);
            return { ...current, kind: "sequence", work, output: [], position: 0 };
          case "record":
            if (work.syntax === null) enterTirInline(activeInline, work.value, current.path, current.root);
            return { ...current, kind: "record", work, fields: work.fields(), output: [], position: 0 };
        }
      }
      case "record": {
        const field = current.fields[current.position];
        if (field === undefined) {
          if (current.work.syntax === null) activeInline.delete(current.work.value);
          return current.next({ kind: "record", label: current.work.label, fields: current.output });
        }
        return { kind: "value", work: field.work, path: { parent: current.path, field: field.name }, root: current.root,
          next: value => {
            current.output.push({ name: field.name, value });
            return { ...current, position: current.position + 1 };
          } };
      }
      case "sequence": {
        if (current.position === current.work.length) {
          activeInline.delete(current.work.value);
          return current.next({ kind: "sequence", elements: current.output });
        }
        const path: TirValuePath = { parent: current.path, field: current.position };
        const child = current.work.element(current.position);
        if (child === null) throw new TypeError(`ir-tir: sparse vector at ${tirPathText(path, current.root)}`);
        return { kind: "value", work: child, path, root: current.root, next: value => {
          current.output.push(value);
          return { ...current, position: current.position + 1 };
        } };
      }
    }
  };
  while (step.kind !== "done") step = advance(step);
  return { body: step.value, nodes: nodes.sort((left, right) => left.position - right.position) };
};

interface TirTypedField<T> extends TirFieldLayout { readonly read: (value: T) => TirTypedWork }

export const scalarWork = (type: string, value: TirScalarValue): TirTypedWork => ({ kind: "scalar", type, value, reference: null });
export const referenceWork = (...[type, value]: ["n", NodeId] | ["l", LocalId] | ["t", TyId] | ["sig", SigId] | ["def", DefId]): TirTypedWork => {
  switch (type) {
    case "def": return { kind: "scalar", type, value, reference: { prefix: type, value } };
    case "n": return { kind: "scalar", type, value, reference: { prefix: type, value } };
    case "l": return { kind: "scalar", type, value, reference: { prefix: type, value } };
    case "t": return { kind: "scalar", type, value, reference: { prefix: type, value } };
    case "sig": return { kind: "scalar", type, value, reference: { prefix: type, value } };
  }
};
export const syntaxReference = (type: string, value: TirWireNode): TirTypedWork => ({ kind: "node", type, value });
export const nullableWork = <T>(value: T | null, read: (value: T) => TirTypedWork): TirTypedWork =>
  value === null ? scalarWork("null", null) : read(value);
export const sequenceWork = <T>(type: string, value: readonly T[], read: (value: T) => TirTypedWork): TirTypedWork =>
  ({ kind: "sequence", type, value, length: value.length, element: position => {
    const actual = value[position];
    return actual === undefined ? null : read(actual);
  } });

export type TirRecordCodec<Value> = ((value: Value) => TirTypedRecordWork) & { readonly reader: TirReader<Value> };
type TirSyntaxHeaderValues = readonly [TirNode["id"], TirNode["origin"], TirNode["parent"], TirNode["flags"], TirNode["loc"]];

interface TirFieldChain<Value, Values extends readonly unknown[]> {
  readonly fields: readonly TirTypedField<Value>[];
  readonly kindField: (TirFieldLayout & { readonly position: number }) | null;
  readonly kinds: readonly string[];
  readonly start: (next: (value: TirConstruction<Values>) => TirConstructionCursor,
    advance: (cursor: TirConstructionCursor) => void) => TirConstructionCursor;
}

export interface TirRecordFields<Value, Values extends readonly unknown[]> {
  readonly field: <Field>(name: string, type: string, read: (value: Value) => TirTypedWork,
    reader: TirReader<Field>) => TirRecordFields<Value, readonly [...Values, Field]>;
  readonly finish: (make: (...values: Values) => Value) => TirRecordCodec<Value>;
}

export interface TirSyntaxFields<Value extends TirNode, Values extends readonly unknown[]> {
  readonly syntaxHeader: (origin: TirRecordCodec<TirNode["origin"]>, loc: TirRecordCodec<TirNode["loc"]>) =>
    TirSyntaxFields<Value, readonly [...Values, ...TirSyntaxHeaderValues]>;
  readonly field: <Field>(name: string, type: string, read: (value: Value) => TirTypedWork,
    reader: TirReader<Field>) => TirSyntaxFields<Value, readonly [...Values, Field]>;
  readonly syntaxKind: (name: string, type: string,
    reader: TirLiteralReader<Value["kind"]>) => TirSyntaxFields<Value, Values>;
  readonly finishSyntax: (make: <Kind extends Value["kind"]>(kind: Kind, ...values: Values) => Value & { readonly kind: Kind },
    offer: TirSyntaxFactory<Value>) => (value: Value) => TirTypedRecordWork;
}

export interface TirTextKernel extends TirScalarReaders {
  readonly syntax: ReadonlyMap<string, TirSyntaxReader>;
  readonly syntaxReads: TirSyntaxReaders;
  readonly literals: ReadonlyMap<string, readonly string[]>;
  readonly numericLiterals: ReadonlySet<string>;
  readonly defineRecord: <Value extends object>(name: string, label: string, discriminant: TirDiscriminant | null,
    wireLabel: string | ((value: Value) => string), syntax: ((value: Value) => TirWireNode) | null,
    association: ((value: Value) => TirRecordAssociation) | null,
    fields: (value: TirRecordFields<Value, readonly []>) => TirRecordCodec<Value>) => TirRecordCodec<Value>;
  readonly defineSyntaxRecord: <Value extends TirNode>(label: string, discriminant: TirDiscriminant | null,
    wireLabel: string | ((value: Value) => string), syntax: (value: Value) => TirWireNode,
    association: ((value: Value) => TirRecordAssociation) | null,
    fields: (value: TirSyntaxFields<Value, readonly []>) => (value: Value) => TirTypedRecordWork) => (value: Value) => TirTypedRecordWork;
  readonly dynamicRecord: <Value>(name: string, type: string, read: (value: Value) => TirTypedWork,
    reader: TirReader<Value>) => TirRecordCodec<Readonly<Record<string, Value>>>;
}

export const unionRecord = <Value>(type: string, read: (value: Value) => TirTypedRecordWork,
  alternatives: () => readonly TirReader<Value>[]): TirRecordCodec<Value> =>
  Object.assign(read, { reader: unionReader(type, alternatives) });

export const lazyRecord = <Value>(read: () => TirRecordCodec<Value>): TirRecordCodec<Value> =>
  Object.assign((value: Value) => read()(value), { reader: lazyReader(() => read().reader) });

const appendField = <Value, Values extends readonly unknown[], Field>(chain: TirFieldChain<Value, Values>,
  name: string, type: string, read: (value: Value) => TirTypedWork, reader: TirReader<Field>,
): TirFieldChain<Value, readonly [...Values, Field]> => ({
  fields: [...chain.fields, { name, type, read }], kindField: chain.kindField, kinds: chain.kinds,
  start: (next, advance) => chain.start(previous => ({ kind: "field", field: { name, type }, close: null,
    requests: () => reader.requests(value => advance(next(appendConstruction(previous, value))))
      .map(request => ({ ...request, type })) }), advance),
});

const startRecord = <Values extends readonly unknown[]>(chain: TirFieldChain<object, Values>,
  publish: (value: TirConstruction<Values>) => void): TirRecordConstruction => {
  let cursor: TirConstructionCursor;
  const advance = (value: TirConstructionCursor): void => { cursor = value; };
  cursor = chain.start(value => ({ kind: "complete", publish: () => publish(value) }), advance);
  return { cursor: () => cursor };
};

export const createTirTextKernel = (): TirTextKernel => {
  const scalars = createScalarReaders();
  const syntax = new Map<string, TirSyntaxReader>();
  const literals = new Map<string, readonly string[]>();
  const numericLiterals = new Set<string>();
  const register = (reader: TirReader<unknown>): void => {
    for (const literal of reader.literalSets) {
      literals.set(literal.type, literal.values.map(String));
      if (typeof literal.values[0] === "number") numericLiterals.add(literal.type);
    }
  };
  const initial = <Value>(): TirFieldChain<Value, readonly []> =>
    ({ fields: [], kindField: null, kinds: [], start: next => next(constructionValue<readonly []>([])) });
  const describe = <Value>(label: string, discriminant: TirDiscriminant | null,
    wireLabel: string | ((value: Value) => string), chain: TirFieldChain<Value, readonly unknown[]>): TirRecordLayout => {
    const fields = chain.fields.map(field => ({ name: field.name, type: field.type }));
    if (chain.kindField !== null) fields.splice(chain.kindField.position, 0,
      { name: chain.kindField.name, type: chain.kindField.type });
    const hasKind = discriminant?.field === "kind" || typeof wireLabel === "function";
    const labels = new Set(discriminant?.field === "kind" ? [discriminant.value] :
      typeof wireLabel === "string" ? [wireLabel] : chain.kinds);
    return { label, fields, wireFields: fields.filter(field => !hasKind || field.name !== "kind"), labels, hasKind };
  };
  const project = <Value extends object>(label: string, layout: TirRecordLayout,
    wireLabel: string | ((value: Value) => string), syntax: ((value: Value) => TirWireNode) | null,
    association: ((value: Value) => TirRecordAssociation) | null, fields: readonly TirTypedField<Value>[],
  ): ((value: Value) => TirTypedRecordWork) => value => ({ kind: "record", type: label, layout, value,
    label: typeof wireLabel === "string" ? wireLabel : wireLabel(value), syntax: syntax === null ? null : syntax(value),
    association: association === null ? null : association(value),
    fields: () => fields.map(field => ({ name: field.name, work: field.read(value) })) });
  const defineRecord: TirTextKernel["defineRecord"] = (name, label, discriminant, wireLabel, syntaxOf, association, fields) => {
    const build = <Value extends object, Values extends readonly unknown[]>(chain: TirFieldChain<Value, Values>,
      actualWireLabel: string | ((value: Value) => string), actualSyntax: ((value: Value) => TirWireNode) | null,
      actualAssociation: ((value: Value) => TirRecordAssociation) | null,
    ): TirRecordFields<Value, Values> => ({
      field: (fieldName, type, read, reader) => {
        register(reader);
        return build(appendField(chain, fieldName, type, read, reader), actualWireLabel, actualSyntax, actualAssociation);
      },
      finish: make => {
        const layout = describe(label, discriminant, actualWireLabel, chain);
        const reader: TirReader<Value> = { literalSets: [], requests: accept => [{ kind: "record", type: name,
          records: selected => layout.labels.has(selected) ? [startRecord({ ...chain, fields: [] },
            value => accept(mapConstruction(value, values => make(...values))))] : [] }] };
        return Object.assign(project(label, layout, actualWireLabel, actualSyntax, actualAssociation, chain.fields), { reader });
      },
    });
    return fields(build(initial(), wireLabel, syntaxOf, association));
  };
  const defineSyntaxRecord: TirTextKernel["defineSyntaxRecord"] =
    (label, discriminant, wireLabel, syntaxOf, association, fields) => {
      const build = <Value extends TirNode, Values extends readonly unknown[]>(chain: TirFieldChain<Value, Values>,
        actualWireLabel: string | ((value: Value) => string), actualSyntax: (value: Value) => TirWireNode,
        actualAssociation: ((value: Value) => TirRecordAssociation) | null,
        kinds: readonly Value["kind"][],
      ): TirSyntaxFields<Value, Values> => ({
        syntaxHeader: (origin, loc) => {
          const flags = sequenceReader("[SyntaxFlag]", literalReader<TirNode["flags"][number]>("SyntaxFlag", [
            "Let", "Const", "Using", "OptionalChain", "DisallowInContext", "YieldContext", "DecoratorContext", "AwaitContext",
            "DisallowConditionalTypesContext", "ThisNodeHasError", "JavaScriptFile", "ThisNodeOrAnySubNodesHasError", "HasJSDoc",
            "JSDoc", "Ambient", "InWithStatement", "JsonFile", "IdentifierHasExtendedUnicodeEscape", "IdentifierIsInJSDocNamespace",
            "NestedNamespace", "AwaitUsing",
          ]));
          register(flags);
          const idField = appendField(chain, "id", "n", value => referenceWork("n", value.id), scalars.nodeReader);
          const originField = appendField(idField, "origin", "Origin", value => origin(value.origin), origin.reader);
          const parentField = appendField(originField, "parent", "?n", value => nullableWork(value.parent,
            actual => referenceWork("n", actual)), nullableReader(scalars.nodeReader));
          const flagsField = appendField(parentField, "flags", "[SyntaxFlag]", value => sequenceWork("[SyntaxFlag]", value.flags,
            actual => scalarWork("SyntaxFlag", actual)), flags);
          const header = appendField(flagsField, "loc", "TextRange", value => loc(value.loc), loc.reader);
          return build(header, actualWireLabel, actualSyntax, actualAssociation, kinds);
        },
        field: (fieldName, type, read, reader) => {
          register(reader);
          return build(appendField(chain, fieldName, type, read, reader), actualWireLabel, actualSyntax, actualAssociation, kinds);
        },
        syntaxKind: (fieldName, type, reader) => {
          register(reader);
          return build({ ...chain, kindField: { name: fieldName, type, position: chain.fields.length }, kinds: reader.values },
            actualWireLabel, actualSyntax, actualAssociation, reader.values);
        },
        finishSyntax: (make, offer) => {
          const layout = describe(label, discriminant, actualWireLabel, chain);
          for (const kind of kinds) syntax.set(kind, { start: accept =>
            startRecord({ ...chain, fields: [] }, values => accept(offer(kind,
              actual => memoSyntaxConstruction(mapConstruction(values, fields => make(actual, ...fields)))))) });
          return project(label, layout, actualWireLabel, actualSyntax, actualAssociation, chain.fields);
        },
      });
      return fields(build(initial(), wireLabel, syntaxOf, association, []));
    };
  const dynamicRecord: TirTextKernel["dynamicRecord"] = (name, type, read, reader) => {
    register(reader);
    const fields = [{ name: "*", type }];
    const layout: TirRecordLayout = { label: name, fields, wireFields: fields, labels: new Set([name]), hasKind: false };
    const dynamicReader: TirReader<Readonly<Record<string, Parameters<typeof read>[0]>>> = {
      literalSets: [], requests: accept => [{ kind: "record", type: name, records: selected => {
        if (selected !== name) return [];
        const entries: { readonly name: string; readonly value: TirConstruction<Parameters<typeof read>[0]> }[] = [];
        const publish = (): void => accept(mapConstruction(sequenceConstruction(entries.map(entry =>
          mapConstruction(entry.value, value => ({ name: entry.name, value })))), entries => {
          const output: Record<string, Parameters<typeof read>[0]> = {};
          for (const entry of entries) Object.defineProperty(output, entry.name,
            { value: entry.value, writable: true, enumerable: true, configurable: true });
          return output;
        }));
        const cursor: TirConstructionCursor = { kind: "field", field: { name: "*", type },
          requests: name => reader.requests(value => entries.push({ name, value })),
          close: publish };
        return [{ cursor: () => cursor }];
      } }] };
    return Object.assign((value: Readonly<Record<string, Parameters<typeof read>[0]>>): TirTypedRecordWork => ({
      kind: "record", type: name, layout, label: name, value, syntax: null, association: null,
      fields: () => Object.entries(value).sort(([left], [right]) => Number(left > right) - Number(left < right))
        .map(([name, field]) => ({ name, work: read(field) })) }), { reader: dynamicReader });
  };
  return { ...scalars, syntax, syntaxReads: createSyntaxReaders(), literals, numericLiterals, defineRecord, defineSyntaxRecord, dynamicRecord };
};

export const finishTirLayouts = (kernel: TirTextKernel, bodyWork: TirRecordCodec<TirBody>,
  nodeWork: (node: TirWireNode) => TirTypedRecordWork): TirLayouts =>
  ({ literals: kernel.literals, numericLiterals: kernel.numericLiterals, syntax: kernel.syntax,
    bodyWork, bodyReader: bodyWork.reader, nodeWork });

export const isTirRecord = (value: unknown): value is TirRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isTirSequence = (value: unknown): value is readonly unknown[] => Array.isArray(value);

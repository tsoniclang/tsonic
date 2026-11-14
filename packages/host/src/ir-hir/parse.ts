import type { InvariantFailure, TextParseResult } from "../diag/contract.js";
import type { HirModule, ParseHir } from "./contract.js";
import { candidateListId, decodeBodyId, decodeDefId, decodeModuleId,
  encodeBodyId, encodeDefId, encodeModuleId, expansionId,
  localId, nodeId, sigId, tyId } from "../ids/index.js";
import { requirePresent } from "../diag/index.js";
import type { HirConstruction, HirConstructionStep, HirIdentityInput, HirRecordConstruction, HirSequenceConstruction, HirSyntaxConstruction, HirValueRequest } from "./text-construction.js";
import { createHirTextReaders, hirModuleReader, hirSyntaxReaders } from "./text-readers.js";
import type { HirDictionaryShape, HirField, HirIdentityShape, HirNumericIdentityShape, HirRecordShape, HirSchema, HirShape, HirShapeLeaf, HirStringIdentityShape } from "./verify-syntax.js";
import { hirChoice, hirRecordChoices, hirShapeLeaves } from "./verify-syntax.js";
import { createHirSchema } from "./verify-captures.js";

export interface TextScalar {
  readonly kind: "scalar";
  readonly offset: number;
  readonly value: string | number | bigint | boolean | null;
}
export interface TextIdentity {
  readonly kind: "identity";
  readonly offset: number;
  readonly prefix: string;
  readonly value: string | number;
}
export interface TextField { readonly name: string; readonly offset: number; readonly value: TextValue }
export interface TextRecord {
  readonly kind: "record";
  readonly binding: number | null;
  readonly bindingOffset: number;
  readonly offset: number;
  readonly end: number;
  readonly label: string;
  readonly fields: readonly TextField[];
}
export interface TextArray { readonly kind: "array"; readonly offset: number; readonly end: number; readonly values: readonly TextValue[] }
export type TextValue = TextScalar | TextIdentity | TextRecord | TextArray;

type InvalidText = TextParseResult<never> & { readonly kind: "invalid-text" };
type Scalar = string | number | bigint | boolean | null;
interface StringDomain { readonly values: readonly string[]; readonly expected: readonly string[]; readonly offset: number }
interface TextReader {
  readonly text: string;
  cursor: number;
  failed: boolean;
  failure: InvalidText;
  pending: PendingFrame | null;
  header: boolean;
  needSeparator: boolean;
}
interface RecordChoice {
  readonly kind: "record";
  readonly fields: readonly HirField[];
}
interface DictionaryChoice { readonly kind: "dictionary"; readonly element: HirShape }
type FrameChoice = RecordChoice | DictionaryChoice;
type FieldSelection =
  | { readonly kind: "record"; readonly choice: RecordChoice; readonly field: HirField }
  | { readonly kind: "dictionary"; readonly choice: DictionaryChoice };
interface RecordFrame {
  readonly kind: "record";
  readonly builders: readonly HirRecordConstruction[];
  readonly names: Set<string>;
  readonly owner: WireNode | null;
  readonly put: () => void;
  choices: readonly FrameChoice[];
  selected: readonly FieldSelection[];
  ordinal: number;
  phase: "first-field" | "field" | "equals" | "value" | "delimiter";
  name: string;
  shape: HirShape;
}
interface ArrayFrame {
  readonly kind: "array";
  readonly builders: readonly HirSequenceConstruction[];
  readonly element: HirShape;
  readonly owner: WireNode | null;
  readonly put: () => void;
  phase: "first-value" | "value" | "delimiter";
}
interface PendingFrame { readonly frame: RecordFrame | ArrayFrame; readonly next: PendingFrame | null }
interface WireReference {
  readonly shape: HirShape;
  readonly offset: number;
  readonly node: WireNode;
  readonly resolve: readonly ((value: HirSyntaxConstruction) => boolean)[];
}
interface WireNode {
  construction: HirSyntaxConstruction | undefined;
  readonly edges: WireEdge[];
  label: string | null;
}
interface WireEdge { readonly target: WireNode; readonly ordinal: number; readonly offset: number }
type WireBinding =
  | { readonly kind: "pending"; readonly node: WireNode }
  | { readonly kind: "declared"; readonly node: WireNode; readonly label: string; readonly offset: number };
interface HirOutput { value: HirConstruction<HirModule> | undefined }
type DecodedCharacter = (value: string, offset: number) => void;

const constructionFailure: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "Complete validated HIR text must publish its typed module and syntax constructions." };

function fail(reader: TextReader, expected: readonly string[], offset = reader.cursor): null {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (reader.text.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  reader.failure = {
    kind: "invalid-text", offset, line, column, expected,
    found: offset === reader.text.length ? null : reader.text.slice(offset, offset + 1),
  };
  reader.failed = true;
  return null;
}

function whitespace(reader: TextReader): boolean {
  let newline = false;
  while (reader.cursor < reader.text.length) {
    const code = reader.text.charCodeAt(reader.cursor);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
    if (code === 10 || code === 13) newline = true;
    reader.cursor += 1;
  }
  return newline;
}

function word(reader: TextReader, onCharacter: DecodedCharacter | null = null): string | null {
  const start = reader.cursor;
  if (!/[A-Za-z_]/u.test(reader.text.charAt(reader.cursor))) return fail(reader, ["identifier"]);
  do {
    onCharacter?.(reader.text.charAt(reader.cursor), reader.cursor);
    reader.cursor += 1;
  } while (/[A-Za-z0-9_-]/u.test(reader.text.charAt(reader.cursor)));
  return reader.text.slice(start, reader.cursor);
}

function quoted(reader: TextReader, domain: StringDomain | null, onCharacter: DecodedCharacter | null = null): string | null {
  reader.cursor += 1;
  const pieces: string[] = [];
  let prefix = "";
  const admit = (value: string, offset: number): boolean => {
    onCharacter?.(value, offset);
    if (domain === null) return true;
    prefix += value;
    if (domain.values.some(candidate => candidate.startsWith(prefix))) return true;
    fail(reader, domain.expected, domain.offset);
    return false;
  };
  let start = reader.cursor;
  while (reader.cursor < reader.text.length) {
    const code = reader.text.charCodeAt(reader.cursor);
    if (code === 34) {
      pieces.push(reader.text.slice(start, reader.cursor));
      reader.cursor += 1;
      return pieces.join("");
    }
    if (code < 32) return fail(reader, ["JSON string character"]);
    if (code === 92) {
      const offset = reader.cursor;
      pieces.push(reader.text.slice(start, reader.cursor));
      reader.cursor += 1;
      const escape = reader.text.charAt(reader.cursor);
      if (escape === "u") {
        const digits = reader.text.slice(reader.cursor + 1, reader.cursor + 5);
        if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) return fail(reader, ["four hexadecimal digits"], reader.cursor + 1);
        const value = String.fromCharCode(Number.parseInt(digits, 16));
        if (!admit(value, offset)) return null;
        pieces.push(value);
        reader.cursor += 5;
      } else {
        let value: string;
        switch (escape) {
          case "\"": value = "\""; break;
          case "\\": value = "\\"; break;
          case "/": value = "/"; break;
          case "b": value = "\b"; break;
          case "f": value = "\f"; break;
          case "n": value = "\n"; break;
          case "r": value = "\r"; break;
          case "t": value = "\t"; break;
          default: return fail(reader, ["JSON escape"]);
        }
        if (!admit(value, offset)) return null;
        pieces.push(value);
        reader.cursor += 1;
      }
      start = reader.cursor;
    } else {
      if (!admit(reader.text.charAt(reader.cursor), reader.cursor)) return null;
      reader.cursor += 1;
    }
  }
  return fail(reader, ["closing quote"]);
}

const specialNumbers: readonly string[] = (["NaN", "+Infinity", "-Infinity"]);

function numeric(reader: TextReader, offset: number): TextScalar | null {
  for (const token of specialNumbers) {
    if (reader.text.startsWith(token, reader.cursor)) {
      reader.cursor += token.length;
      return { kind: "scalar", offset, value: token === "NaN" ? Number.NaN : token === "+Infinity" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY };
    }
  }
  while (/[0-9eE+.-]/u.test(reader.text.charAt(reader.cursor))) reader.cursor += 1;
  if (reader.text.charAt(reader.cursor) === "n") {
    reader.cursor += 1;
    const digits = reader.text.slice(offset, reader.cursor - 1);
    if (!/^-?(?:0|[1-9][0-9]*)$/u.test(digits) || digits === "-0")
      return fail(reader, ["canonical bigint"], offset);
    return { kind: "scalar", offset, value: BigInt(digits) };
  }
  const digits = reader.text.slice(offset, reader.cursor);
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/u.test(digits))
    return fail(reader, ["canonical finite number"], offset);
  const value = Number(digits);
  if (!Number.isFinite(value) || digits !== (Object.is(value, -0) ? "-0" : String(value)))
    return fail(reader, ["canonical finite number"], offset);
  return { kind: "scalar", offset, value };
}


function expectedValue(shape: HirShape): readonly string[] {
  return [typeof shape === "string" ? shape : "declared field value"];
}

function scalarMatches(shape: HirShapeLeaf, value: Scalar): boolean {
  if (typeof shape === "string") {
    switch (shape) {
      case "string": return typeof value === "string";
      case "number": return typeof value === "number";
      case "bigint": return typeof value === "bigint";
      case "boolean": return typeof value === "boolean";
      case "null": return value === null;
      case "SyntaxNode": return false;
    }
  }
  switch (shape.kind) {
    case "host-code": return typeof value === "string";
    case "literal": return shape.values.some(candidate => Object.is(candidate, value));
    case "identity": case "array": case "record": case "dictionary": return false;
  }
}

function scalarKindMatches(shape: HirShapeLeaf, kind: "string" | "number" | "bigint"): boolean {
  if (typeof shape === "string") return shape === kind;
  switch (shape.kind) {
    case "host-code": return kind === "string";
    case "literal": return shape.values.some(value => typeof value === kind);
    case "identity": case "array": case "record": case "dictionary": return false;
  }
}

function stringDomain(leaves: readonly HirShapeLeaf[], shape: HirShape, offset: number): StringDomain | null {
  if (leaves.includes("string") || leaves.some(leaf => typeof leaf !== "string" && leaf.kind === "host-code")) return null;
  const values: string[] = [];
  for (const leaf of leaves) if (typeof leaf !== "string" && leaf.kind === "literal")
    for (const value of leaf.values) if (typeof value === "string") values.push(value);
  return { values, expected: expectedValue(shape), offset };
}

function readField(reader: TextReader, frame: RecordFrame): boolean {
  let required: string[] | null = [];
  for (const choice of frame.choices) {
    if (choice.kind === "dictionary") { required = null; break; }
    const field = choice.fields[frame.ordinal];
    if (field !== undefined && !required.includes(field[0])) required.push(field[0]);
  }
  const expected = required === null ? [] : required.length === 0 ? ["end of record"] : required;
  const quotedName = reader.text.charAt(reader.cursor) === "\"";
  let first = reader.cursor + (quotedName ? 1 : 0);
  let deviation: number | null = null;
  let length = 0;
  let candidates: readonly string[] | null = required;
  const previousKey = required === null && frame.ordinal > 0 ? frame.name : null;
  let orderDecided = false;
  let descending = false;
  const onCharacter: DecodedCharacter = (value, offset) => {
    if (length === 0) first = offset;
    if (previousKey !== null && !orderDecided) {
      const previous = previousKey.charAt(length);
      if (previous !== value) {
        descending = previous !== "" && value < previous;
        orderDecided = true;
      }
    }
    if (candidates !== null && deviation === null) {
      candidates = candidates.filter(candidate => candidate.charAt(length) === value);
      if (candidates.length === 0) deviation = offset;
    }
    length += 1;
  };
  const name = quotedName ? quoted(reader, null, onCharacter) : word(reader, onCharacter);
  if (name === null) {
    if (deviation !== null && deviation < reader.failure.offset) fail(reader, expected, deviation);
    if (descending && first < reader.failure.offset) fail(reader, ["increasing dictionary key"], first);
    return false;
  }
  const end = reader.cursor - (quotedName ? 1 : 0);
  if (frame.names.has(name)) {
    fail(reader, ["unique record field"], required === null ? first : deviation === null ? end : deviation);
    return false;
  }
  if (previousKey !== null && name < previousKey) {
    fail(reader, ["increasing dictionary key"], first);
    return false;
  }
  const selected: FieldSelection[] = [];
  let fieldShape: HirShape | null = null;
  for (const choice of frame.choices) {
    if (choice.kind === "dictionary") {
      selected.push({ kind: "dictionary", choice });
      fieldShape = choice.element;
    } else {
      const field = choice.fields[frame.ordinal];
      if (field !== undefined && field[0] === name) {
        selected.push({ kind: "record", choice, field });
        fieldShape = fieldShape === null || fieldShape === field[1] ? field[1] : hirChoice(fieldShape, field[1]);
      }
    }
  }
  if (fieldShape === null) {
    fail(reader, expected, deviation === null ? end : deviation);
    return false;
  }
  frame.names.add(name);
  frame.name = name;
  frame.selected = selected;
  frame.shape = fieldShape;
  frame.phase = "equals";
  return true;
}

function frameChoices(choices: readonly (HirRecordShape | HirDictionaryShape)[]): readonly FrameChoice[] {
  return choices.map(choice => choice.kind === "dictionary" ? { kind: "dictionary", element: choice.element } :
    { kind: "record", fields: choice.fields.filter(([name]) => name !== "kind") });
}

function missingField(frame: RecordFrame): string | null {
  let expected: string | null = null;
  for (const choice of frame.choices) {
    if (choice.kind === "dictionary") return null;
    const field = choice.fields[frame.ordinal];
    if (field === undefined) return null;
    expected = field[0];
  }
  return expected;
}

function attach(frame: RecordFrame | ArrayFrame, value: Scalar | undefined): void {
  if (frame.kind === "record") {
    frame.choices = frame.selected.filter(selection => {
      if (selection.kind === "dictionary") return true;
      const field: HirField = selection.field;
      return field.length === 2 || field[1].values.some(candidate => Object.is(candidate, value));
    })
      .map(selection => selection.choice);
    frame.ordinal += 1;
  }
  frame.phase = "delimiter";
}

type WireVisit = { readonly node: WireNode; readonly leaving: boolean; readonly next: WireVisit | null };

function ownedNumericIdentity(shape: HirNumericIdentityShape, value: number): HirIdentityInput {
  switch (shape.prefix) {
    case "n": return { kind: "n", value: nodeId(value) };
    case "l": return { kind: "l", value: localId(value) };
    case "t": return { kind: "t", value: tyId(value) };
    case "sig": return { kind: "sig", value: sigId(value) };
    case "cand": return { kind: "cand", value: candidateListId(value) };
  }
}

function ownedStringIdentity(shape: HirStringIdentityShape, value: string): HirIdentityInput | null {
  switch (shape.prefix) {
    case "mod": {
      const decoded = decodeModuleId(value);
      return decoded.kind === "decoded" ? { kind: "mod", value: encodeModuleId(decoded.value) } : null;
    }
    case "def": {
      const decoded = decodeDefId(value);
      return decoded.kind === "decoded" ? { kind: "def", value: encodeDefId(decoded.value) } : null;
    }
    case "body": {
      const decoded = decodeBodyId(value);
      return decoded.kind === "decoded" ? { kind: "body", value: encodeBodyId(decoded.value) } : null;
    }
    case "exp": return { kind: "exp", value: expansionId(value) };
  }
}

function acceptIdentity(requests: readonly HirValueRequest[], input: HirIdentityInput): void {
  for (const request of requests) switch (input.kind) {
    case "mod": if (request.kind === "mod") request.read(input.value); break;
    case "def": if (request.kind === "def") request.read(input.value); break;
    case "body": if (request.kind === "body") request.read(input.value); break;
    case "exp": if (request.kind === "exp") request.read(input.value); break;
    case "n": if (request.kind === "n") request.read(input.value); break;
    case "l": if (request.kind === "l") request.read(input.value); break;
    case "t": if (request.kind === "t") request.read(input.value); break;
    case "sig": if (request.kind === "sig") request.read(input.value); break;
    case "cand": if (request.kind === "cand") request.read(input.value); break;
  }
}

function selectedRequests<Kind extends HirValueRequest["kind"]>(requests: readonly HirValueRequest[], kind: Kind):
readonly (HirValueRequest & { readonly kind: Kind })[] {
  return requests.filter((request): request is HirValueRequest & { readonly kind: Kind } => request.kind === kind);
}

function acceptScalar(requests: readonly HirValueRequest[], value: Scalar): void {
  for (const request of selectedRequests(requests, "scalar")) request.read(value);
  switch (typeof value) {
    case "string": for (const request of selectedRequests(requests, "string")) request.read(value); break;
    case "number": for (const request of selectedRequests(requests, "number")) request.read(value); break;
    case "bigint": for (const request of selectedRequests(requests, "bigint")) request.read(value); break;
    case "boolean": for (const request of selectedRequests(requests, "boolean")) request.read(value); break;
    case "object": for (const request of selectedRequests(requests, "null")) request.read(); break;
  }
}

function closesWireCycle(arena: ReadonlyMap<number, WireBinding>, prefix: number): boolean {
  const colors = new Map<WireNode, "active" | "complete">();
  for (const binding of arena.values()) {
    const root = binding.node;
    if (colors.has(root)) continue;
    let pending: WireVisit | null = { node: root, leaving: false, next: null };
    while (pending !== null) {
      const frame: WireVisit = pending;
      pending = frame.next;
      if (frame.leaving) { colors.set(frame.node, "complete"); continue; }
      const previous = colors.get(frame.node);
      if (previous === "active") return true;
      if (previous === "complete") continue;
      colors.set(frame.node, "active");
      pending = frame.node.edges.reduceRight<WireVisit | null>((next, edge) => edge.ordinal < prefix ?
        { node: edge.target, leaving: false, next } : next,
      { node: frame.node, leaving: true, next: pending });
    }
  }
  return false;
}

function firstWireCycle(arena: ReadonlyMap<number, WireBinding>, edges: readonly WireEdge[]): WireEdge | null {
  let result: WireEdge | null = null;
  if (closesWireCycle(arena, edges.length)) {
    let low = 0;
    let high = edges.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (closesWireCycle(arena, middle)) high = middle;
      else low = middle;
    }
    for (const edge of edges) if (edge.ordinal === high - 1) result = edge;
  }
  return result;
}

function readHirModule(reader: TextReader, output: HirOutput, schema: HirSchema): boolean {
  const readers = createHirTextReaders();
  const syntaxReaders = hirSyntaxReaders(readers);
  const rootRequests = hirModuleReader(readers).requests(value => { output.value = value; });
  const arena = new Map<number, WireBinding>();
  const roots = new Set<WireNode>();
  const declared: { readonly node: WireNode; readonly offset: number }[] = [];
  const edges: WireEdge[] = [];
  const references: WireReference[] = [];
  const wireNode = (): WireNode => ({ construction: undefined, edges: [], label: null });
  const put = (): void => {
    reader.header = true;
    reader.needSeparator = true;
  };
  const syntaxReference = (shape: HirShape, value: number, offset: number, owner: WireNode | null,
    requests: readonly HirValueRequest[]): void => {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      fail(reader, expectedValue(shape), offset);
      return;
    }
    const previous = arena.get(value);
    const binding: WireBinding = previous ?? { kind: "pending", node: wireNode() };
    arena.set(value, binding);
    references.push({ shape, offset, node: binding.node,
      resolve: requests.flatMap(request => request.kind === "syntax" ? [request.reference()] : []) });
    if (owner === null) roots.add(binding.node);
    else {
      const edge: WireEdge = { target: binding.node, ordinal: edges.length, offset };
      owner.edges.push(edge);
      edges.push(edge);
    }
  };
  while (!reader.failed) {
    const newline = whitespace(reader);
    const frame: RecordFrame | ArrayFrame | undefined = reader.pending?.frame;
    if (frame === undefined && reader.cursor === reader.text.length) {
      if (!reader.header) { fail(reader, ["record"]); return false; }
      let invalidTarget: { readonly reference: WireReference; readonly expected: readonly string[] } | null = null;
      for (const reference of references) {
        if (reference.node.label === null) {
          invalidTarget = { reference, expected: ["declared syntax node"] };
          break;
        }
        if (!reference.resolve.every(resolve => resolve(requirePresent(reference.node.construction, constructionFailure)))) {
          invalidTarget = { reference, expected: expectedValue(reference.shape) };
          break;
        }
      }
      const cycle = firstWireCycle(arena, edges);
      if (invalidTarget !== null && (cycle === null || invalidTarget.reference.offset <= cycle.offset)) {
        fail(reader, invalidTarget.expected, invalidTarget.reference.offset);
        return false;
      }
      if (cycle !== null) { fail(reader, ["acyclic syntax reference"], cycle.offset); return false; }
      const reachable = new Set<WireNode>();
      const work = [...roots];
      for (const node of work) {
        if (reachable.has(node)) continue;
        reachable.add(node);
        for (const edge of node.edges) work.push(edge.target);
      }
      for (const binding of declared) if (!reachable.has(binding.node)) {
        fail(reader, ["referenced syntax declaration"], binding.offset);
        return false;
      }
      return true;
    }
    if (frame === undefined && reader.needSeparator && !newline) { fail(reader, ["newline"]); return false; }
    const character = reader.text.charAt(reader.cursor);
    if (reader.pending !== null && reader.pending.frame.phase === "delimiter") {
      const frame: RecordFrame | ArrayFrame = reader.pending.frame;
      const closing = frame.kind === "record" ? ")" : "]";
      if (character === closing) {
        if (frame.kind === "record") {
          const expected = missingField(frame);
          if (expected !== null) { fail(reader, [expected]); return false; }
        }
        reader.cursor += 1;
        reader.pending = reader.pending.next;
        if (frame.kind === "record") {
          for (const builder of frame.builders) if (builder.complete(frame.ordinal)) builder.publish();
        } else {
          const complete = frame.builders.filter(builder => builder.complete());
          if (complete.length === 0) { fail(reader, ["nonempty sequence"]); return false; }
          for (const builder of complete) builder.publish();
        }
        frame.put();
      } else if (character === ",") {
        reader.cursor += 1;
        frame.phase = frame.kind === "record" ? "field" : "value";
      } else { fail(reader, [",", closing]); return false; }
      continue;
    }
    if (frame?.kind === "record" && (frame.phase === "first-field" || frame.phase === "field")) {
      if (frame.phase === "first-field" && character === ")") { frame.phase = "delimiter"; continue; }
      if (!readField(reader, frame)) return false;
      continue;
    }
    if (frame?.kind === "record" && frame.phase === "equals") {
      if (character !== "=") { fail(reader, ["="]); return false; }
      reader.cursor += 1;
      frame.phase = "value";
      continue;
    }
    if (frame?.kind === "array" && frame.phase === "first-value" && character === "]") {
      frame.phase = "delimiter";
      continue;
    }
    const shape: HirShape = frame === undefined ? reader.header ? "SyntaxNode" : "HirModule" :
      frame.kind === "array" ? frame.element : frame.shape;
    const leaves = hirShapeLeaves(shape, schema);
    let declaration: { readonly position: number; readonly offset: number } | null = null;
    if (frame === undefined && reader.header) {
      const offset = reader.cursor;
      if (!reader.text.startsWith("n:", reader.cursor)) { fail(reader, ["node wire binding"]); return false; }
      reader.cursor += 2;
      const position = numeric(reader, reader.cursor);
      if (position === null) return false;
      if (typeof position.value !== "number" || !Number.isSafeInteger(position.value) || position.value < 0 || Object.is(position.value, -0)) {
        fail(reader, ["nonnegative wire position"], position.offset);
        return false;
      }
      if (arena.get(position.value)?.kind === "declared") { fail(reader, ["distinct wire binding"], offset); return false; }
      if (position.value !== declared.length) { fail(reader, [`n:${declared.length}`], offset); return false; }
      whitespace(reader);
      if (reader.text.charAt(reader.cursor) !== "=") { fail(reader, ["="]); return false; }
      reader.cursor += 1;
      whitespace(reader);
      declaration = { position: position.value, offset };
    } else if (frame === undefined && reader.text.startsWith("n:", reader.cursor)) {
      fail(reader, ["HirModule"]);
      return false;
    }
    const offset = reader.cursor;
    const token = reader.text.charAt(reader.cursor);
    const owner: WireNode | null = frame === undefined ? null : frame.owner;
    const accept = declaration !== null ? (): void => { reader.needSeparator = true; } :
      frame === undefined ? put : (): void => { attach(frame, undefined); };
    const requests: readonly HirValueRequest[] = frame === undefined ? rootRequests : frame.kind === "array" ?
      frame.builders.flatMap(builder => builder.requests()) : frame.builders.flatMap(builder => builder.requests(frame.ordinal, frame.name));
    if (token === "[") {
      if (frame === undefined) { fail(reader, ["record"], offset); return false; }
      let element: HirShape | null = null;
      for (const leaf of leaves) if (typeof leaf !== "string" && leaf.kind === "array") {
        element = leaf.element;
        break;
      }
      if (element === null) { fail(reader, ["declared array"], offset); return false; }
      reader.cursor += 1;
      reader.pending = { frame: { kind: "array", builders: requests.flatMap(request => request.kind === "sequence" ? [request.sequence()] : []),
        element, owner, put: accept, phase: "first-value" }, next: reader.pending };
      continue;
    }
    const scalar = (value: Scalar): void => {
      if (frame === undefined) { fail(reader, ["record"], offset); return; }
      if (!leaves.some(leaf => scalarMatches(leaf, value))) {
        fail(reader, expectedValue(shape), offset);
        return;
      }
      acceptScalar(requests, value);
      if (frame !== undefined) attach(frame, value);
    };
    if (token === "\"") {
      if (!leaves.some(leaf => scalarKindMatches(leaf, "string"))) {
        const identityShape = leaves.find(leaf => typeof leaf !== "string" && leaf.kind === "identity" && leaf.value === "string");
        fail(reader, identityShape !== undefined && typeof identityShape !== "string" && identityShape.kind === "identity" ?
          [`${identityShape.prefix}:identity`] : frame === undefined ? ["record"] : expectedValue(shape), offset);
        return false;
      }
      const value = quoted(reader, stringDomain(leaves, shape, offset));
      if (value === null) return false;
      scalar(value);
      continue;
    }
    if (/[0-9+-]/u.test(token) || reader.text.startsWith("NaN", reader.cursor)) {
      if (frame === undefined) { fail(reader, ["record"], offset); return false; }
      if (!leaves.some(leaf => scalarKindMatches(leaf, "number") || scalarKindMatches(leaf, "bigint"))) {
        const identityShape = leaves.find(leaf => typeof leaf !== "string" && leaf.kind === "identity" && leaf.value === "number");
        fail(reader, typeof identityShape !== "string" && identityShape?.kind === "identity" ?
          [`${identityShape.prefix}:identity`] : expectedValue(shape), offset);
        return false;
      }
      const value = numeric(reader, offset);
      if (value === null) return false;
      scalar(value.value);
      continue;
    }
    const label = word(reader);
    if (label === null) return false;
    if (label === "true" || label === "false" || label === "null") {
      scalar(label === "null" ? null : label === "true");
      continue;
    }
    whitespace(reader);
    if (reader.text.charAt(reader.cursor) === "(") {
      const choices = hirRecordChoices(shape, label, schema);
      if (choices.length === 0) {
        fail(reader, declaration !== null ? ["syntax node declaration"] : [typeof shape === "string" ? shape : "declared record"], offset);
        return false;
      }
      if (declaration === null && choices.some(choice => choice.kind === "record" && choice.syntax)) {
        fail(reader, ["node wire reference"], offset);
        return false;
      }
      let builders: readonly HirRecordConstruction[];
      let recordOwner: WireNode | null = owner;
      if (declaration === null) builders = requests.flatMap(request => request.kind === "record" ? request.records(label) : []);
      else {
        const previous = arena.get(declaration.position);
        const node = previous === undefined ? wireNode() : previous.node;
        node.label = label;
        builders = [requirePresent(syntaxReaders.get(label), constructionFailure)(value => { node.construction = value; })];
        recordOwner = node;
        arena.set(declaration.position, { kind: "declared", node, label, offset: declaration.offset });
        declared.push({ node, offset: declaration.offset });
      }
      reader.cursor += 1;
      reader.pending = { frame: { kind: "record", builders, names: new Set(), owner: recordOwner, put: accept,
        choices: frameChoices(choices), selected: [], ordinal: 0, phase: "first-field", name: "", shape: "null" }, next: reader.pending };
      continue;
    }
    let ownerShape: HirIdentityShape | null = null;
    for (const leaf of leaves) if (typeof leaf !== "string" && leaf.kind === "identity" && leaf.prefix === label) ownerShape = leaf;
    const syntax = label === "n" && leaves.some(leaf => leaf === "SyntaxNode" ||
      typeof leaf !== "string" && leaf.kind === "record" && leaf.syntax);
    if (ownerShape === null && !syntax) {
      fail(reader, expectedValue(shape), offset);
      return false;
    }
    if (reader.text.charAt(reader.cursor) !== ":") { fail(reader, [":"]); return false; }
    reader.cursor += 1;
    whitespace(reader);
    const payloadOffset = reader.cursor;
    if (reader.text.charAt(reader.cursor) === "\"") {
      if (ownerShape === null || ownerShape.value !== "string") {
        fail(reader, ["number identity"], payloadOffset);
        return false;
      }
      const content = quoted(reader, null);
      if (content === null) return false;
      const issued = ownedStringIdentity(ownerShape, content);
      if (issued === null) { fail(reader, expectedValue(shape), offset); return false; }
      acceptIdentity(requests, issued);
      accept();
    } else {
      if (ownerShape !== null && ownerShape.value !== "number") {
        fail(reader, ["string identity"], payloadOffset);
        return false;
      }
      if (!/[0-9+-]/u.test(reader.text.charAt(reader.cursor)) && !reader.text.startsWith("NaN", reader.cursor)) {
        fail(reader, ["number identity"], payloadOffset);
        return false;
      }
      const content = numeric(reader, payloadOffset);
      if (content === null) return false;
      if (typeof content.value !== "number") { fail(reader, ["number identity"], payloadOffset); return false; }
      if (ownerShape === null) syntaxReference(shape, content.value, offset, owner, requests);
      else acceptIdentity(requests, ownedNumericIdentity(ownerShape, content.value));
      if (reader.failed) return false;
      accept();
    }
  }
  return false;
}

export const parseHir: ParseHir = text => {
  const reader: TextReader = { text, cursor: 0, failed: false, pending: null, header: false, needSeparator: false,
    failure: { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"],
      found: text.length === 0 ? null : text.slice(0, 1) } };
  const output: HirOutput = { value: undefined };
  if (readHirModule(reader, output, createHirSchema())) {
    let step: HirConstructionStep = requirePresent(output.value, constructionFailure).run(value => ({ kind: "complete", value }));
    while (step.kind === "next") step = step.next();
    return { kind: "parsed", value: step.value };
  }
  return reader.failure;
};

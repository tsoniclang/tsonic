import type { TextParseResult } from "../diag/contract.js";
import type { HirModule, ParseHir } from "./contract.js";
import type { HirDictionaryShape, HirField, HirRecordShape, HirSchema, HirShape, HirShapeLeaf } from "./verify-syntax.js";
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
interface MutableRecord { [field: string]: unknown }
interface StringDomain { readonly values: readonly string[]; readonly expected: readonly string[]; readonly offset: number }
interface TextReader {
  readonly text: string;
  cursor: number;
  failed: boolean;
  failure: InvalidText;
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
  readonly value: MutableRecord;
  readonly names: Set<string>;
  readonly owner: WireNode | null;
  readonly put: (value: unknown) => void;
  choices: readonly FrameChoice[];
  selected: readonly FieldSelection[];
  ordinal: number;
  phase: "first-field" | "field" | "equals" | "value" | "delimiter";
  name: string;
  shape: HirShape;
}
interface ArrayFrame {
  readonly kind: "array";
  readonly value: unknown[];
  readonly element: HirShape;
  readonly owner: WireNode | null;
  readonly put: (value: unknown) => void;
  phase: "first-value" | "value" | "delimiter";
}
interface PendingFrame { readonly frame: RecordFrame | ArrayFrame; readonly next: PendingFrame | null }
interface WireReference { readonly shape: HirShape; readonly offset: number }
interface WireNode {
  readonly value: MutableRecord;
  readonly edges: Set<WireNode>;
}
type WireBinding =
  | { readonly kind: "pending"; readonly node: WireNode; readonly references: [WireReference, ...WireReference[]] }
  | { readonly kind: "declared"; readonly node: WireNode; readonly label: string; readonly offset: number };
interface HirOutput { value: unknown }

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

function word(reader: TextReader): string | null {
  const start = reader.cursor;
  if (!/[A-Za-z_]/u.test(reader.text.charAt(reader.cursor))) return fail(reader, ["identifier"]);
  reader.cursor += 1;
  while (/[A-Za-z0-9_-]/u.test(reader.text.charAt(reader.cursor))) reader.cursor += 1;
  return reader.text.slice(start, reader.cursor);
}

function quoted(reader: TextReader, domain: StringDomain | null): string | null {
  reader.cursor += 1;
  const pieces: string[] = [];
  let prefix = "";
  const admit = (value: string): boolean => {
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
      pieces.push(reader.text.slice(start, reader.cursor));
      reader.cursor += 1;
      const escape = reader.text.charAt(reader.cursor);
      if (escape === "u") {
        const digits = reader.text.slice(reader.cursor + 1, reader.cursor + 5);
        if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) return fail(reader, ["four hexadecimal digits"], reader.cursor + 1);
        const value = String.fromCharCode(Number.parseInt(digits, 16));
        if (!admit(value)) return null;
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
        if (!admit(value)) return null;
        pieces.push(value);
        reader.cursor += 1;
      }
      start = reader.cursor;
    } else {
      if (!admit(reader.text.charAt(reader.cursor))) return null;
      reader.cursor += 1;
    }
  }
  return fail(reader, ["closing quote"]);
}

const specialNumbers: readonly string[] = Object.freeze(["NaN", "+Infinity", "-Infinity"]);

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
    case "literal": return shape.values.some(candidate => Object.is(candidate, value));
    case "identity": case "array": case "record": case "dictionary": return false;
  }
}

function scalarKindMatches(shape: HirShapeLeaf, kind: "string" | "number" | "bigint"): boolean {
  if (typeof shape === "string") return shape === kind;
  switch (shape.kind) {
    case "literal": return shape.values.some(value => typeof value === kind);
    case "identity": case "array": case "record": case "dictionary": return false;
  }
}

function stringDomain(leaves: readonly HirShapeLeaf[], shape: HirShape, offset: number): StringDomain | null {
  if (leaves.includes("string")) return null;
  const values: string[] = [];
  for (const leaf of leaves) if (typeof leaf !== "string" && leaf.kind === "literal")
    for (const value of leaf.values) if (typeof value === "string") values.push(value);
  return { values, expected: expectedValue(shape), offset };
}

function fieldDomain(frame: RecordFrame, offset: number): StringDomain | null {
  const values: string[] = [];
  for (const choice of frame.choices) {
    if (choice.kind === "dictionary") return null;
    const field = choice.fields[frame.ordinal];
    if (field !== undefined && !values.includes(field[0])) values.push(field[0]);
  }
  return { values, expected: values.length === 0 ? [")"] : values, offset };
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

function attach(frame: RecordFrame | ArrayFrame, value: unknown): void {
  if (frame.kind === "array") frame.value.push(value);
  else {
    Object.defineProperty(frame.value, frame.name, { value, configurable: true, enumerable: true, writable: true });
    frame.choices = frame.selected.filter(selection => selection.kind === "dictionary" ||
      selection.field[2] !== true || selection.field[1].values.some(candidate => Object.is(candidate, value)))
      .map(selection => selection.choice);
    frame.ordinal += 1;
  }
  frame.phase = "delimiter";
}

function readHirModule(reader: TextReader, output: HirOutput, schema: HirSchema): output is HirOutput & { value: HirModule } {
  const arena = new Map<number, WireBinding>();
  const roots = new Set<WireNode>();
  const declared: { readonly node: WireNode; readonly offset: number }[] = [];
  let pending: PendingFrame | null = null;
  let header = false;
  let needSeparator = false;
  const wireNode = (): WireNode => ({ value: {}, edges: new Set() });
  const put = (value: unknown): void => {
    if (pending === null) { output.value = value; header = true; needSeparator = true; }
    else attach(pending.frame, value);
  };
  const identity = (shape: HirShape, prefix: string, value: string | number, offset: number, owner: WireNode | null): unknown => {
    const leaves = hirShapeLeaves(shape, schema);
    if (leaves.some(leaf => typeof leaf !== "string" && leaf.kind === "identity" &&
      leaf.prefix === prefix && typeof value === leaf.value)) return value;
    const syntax = leaves.some(leaf => leaf === "SyntaxNode" ||
      typeof leaf !== "string" && leaf.kind === "record" && leaf.syntax);
    if (!syntax || prefix !== "n" || typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      fail(reader, expectedValue(shape), offset);
      return null;
    }
    const previous = arena.get(value);
    if (previous?.kind === "declared" && !hirRecordChoices(shape, previous.label, schema).some(choice =>
      choice.kind === "record" && choice.syntax)) {
      fail(reader, expectedValue(shape), offset);
      return null;
    }
    let binding: WireBinding;
    if (previous === undefined) binding = { kind: "pending", node: wireNode(), references: [{ shape, offset }] };
    else {
      binding = previous;
      if (binding.kind === "pending") binding.references.push({ shape, offset });
    }
    arena.set(value, binding);
    if (owner === null) roots.add(binding.node);
    else owner.edges.add(binding.node);
    return binding.node.value;
  };
  while (!reader.failed) {
    const newline = whitespace(reader);
    const frame = pending?.frame;
    if (frame === undefined && reader.cursor === reader.text.length) {
      if (!header) { fail(reader, ["record"]); return false; }
      for (const binding of arena.values()) if (binding.kind === "pending") {
        const reference = binding.references[0];
        fail(reader, expectedValue(reference.shape), reference.offset);
        return false;
      }
      const reachable = new Set<WireNode>();
      const work = [...roots];
      for (const node of work) {
        if (reachable.has(node)) continue;
        reachable.add(node);
        for (const edge of node.edges) work.push(edge);
      }
      for (const binding of declared) if (!reachable.has(binding.node)) {
        fail(reader, ["referenced syntax declaration"], binding.offset);
        return false;
      }
      return true;
    }
    if (frame === undefined && needSeparator && !newline) { fail(reader, ["newline"]); return false; }
    const character = reader.text.charAt(reader.cursor);
    if (pending !== null && pending.frame.phase === "delimiter") {
      const frame = pending.frame;
      const closing = frame.kind === "record" ? ")" : "]";
      if (character === closing) {
        if (frame.kind === "record") {
          const expected = missingField(frame);
          if (expected !== null) { fail(reader, [expected]); return false; }
        }
        reader.cursor += 1;
        pending = pending.next;
        Object.freeze(frame.value);
        frame.put(frame.value);
      } else if (character === ",") {
        reader.cursor += 1;
        frame.phase = frame.kind === "record" ? "field" : "value";
      } else { fail(reader, [",", closing]); return false; }
      continue;
    }
    if (frame?.kind === "record" && (frame.phase === "first-field" || frame.phase === "field")) {
      if (frame.phase === "first-field" && character === ")") { frame.phase = "delimiter"; continue; }
      const offset = reader.cursor;
      const name = character === "\"" ? quoted(reader, fieldDomain(frame, offset)) : word(reader);
      if (name === null) return false;
      if (frame.names.has(name)) { fail(reader, ["distinct field"], offset); return false; }
      const selected: FieldSelection[] = [];
      let fieldShape: HirShape | null = null;
      const expected: string[] = [];
      for (const choice of frame.choices) {
        if (choice.kind === "dictionary") {
          selected.push({ kind: "dictionary", choice });
          fieldShape = fieldShape === null || fieldShape === choice.element ? choice.element : hirChoice(fieldShape, choice.element);
        }
        else {
          const field = choice.fields[frame.ordinal];
          if (field !== undefined) {
            if (!expected.includes(field[0])) expected.push(field[0]);
            if (field[0] === name) {
              selected.push({ kind: "record", choice, field });
              fieldShape = fieldShape === null || fieldShape === field[1] ? field[1] : hirChoice(fieldShape, field[1]);
            }
          }
        }
      }
      if (fieldShape === null) { fail(reader, expected.length === 0 ? [")"] : expected, offset); return false; }
      frame.names.add(name);
      frame.name = name;
      frame.selected = selected;
      frame.shape = fieldShape;
      frame.phase = "equals";
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
    const shape: HirShape = frame === undefined ? header ? "SyntaxNode" : "HirModule" :
      frame.kind === "array" ? frame.element : frame.shape;
    const leaves = hirShapeLeaves(shape, schema);
    let declaration: { readonly position: number; readonly offset: number } | null = null;
    if (frame === undefined && header) {
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
    const owner = frame === undefined ? null : frame.owner;
    const accept = declaration !== null ? (): void => { needSeparator = true; } :
      frame === undefined ? put : (value: unknown): void => { attach(frame, value); };
    if (token === "[") {
      if (frame === undefined) { fail(reader, ["record"], offset); return false; }
      let element: HirShape | null = null;
      for (const leaf of leaves) if (typeof leaf !== "string" && leaf.kind === "array")
        element = element === null || element === leaf.element ? leaf.element : hirChoice(element, leaf.element);
      if (element === null) { fail(reader, ["declared array"], offset); return false; }
      reader.cursor += 1;
      pending = { frame: { kind: "array", value: [], element, owner, put: accept, phase: "first-value" }, next: pending };
      continue;
    }
    const scalar = (value: Scalar): void => {
      if (frame === undefined) { fail(reader, ["record"], offset); return; }
      if (!leaves.some(leaf => scalarMatches(leaf, value))) {
        const identityShape = leaves.find(leaf => typeof leaf !== "string" && leaf.kind === "identity" && typeof value === leaf.value);
        fail(reader, typeof identityShape !== "string" && identityShape?.kind === "identity" ?
          [`${identityShape.prefix}:identity`] : expectedValue(shape), offset);
        return;
      }
      accept(value);
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
      if (declaration !== null) {
        const binding = arena.get(declaration.position);
        if (binding?.kind === "pending") for (const reference of binding.references) {
          if (!hirRecordChoices(reference.shape, label, schema).some(choice => choice.kind === "record" && choice.syntax)) {
            fail(reader, expectedValue(reference.shape), reference.offset);
            return false;
          }
        }
      }
      const choices = hirRecordChoices(shape, label, schema);
      if (choices.length === 0) {
        fail(reader, declaration !== null ? ["syntax node declaration"] : [typeof shape === "string" ? shape : "declared record"], offset);
        return false;
      }
      if (declaration === null && choices.some(choice => choice.kind === "record" && choice.syntax)) {
        fail(reader, ["node wire reference"], offset);
        return false;
      }
      let value: MutableRecord;
      let recordOwner = owner;
      if (declaration === null) value = {};
      else {
        const previous = arena.get(declaration.position);
        const node = previous === undefined ? wireNode() : previous.node;
        value = node.value;
        recordOwner = node;
        arena.set(declaration.position, { kind: "declared", node, label, offset: declaration.offset });
        declared.push({ node, offset: declaration.offset });
      }
      if (choices.some(choice => choice.kind === "record" && choice.fields.some(([name]) => name === "kind"))) value.kind = label;
      reader.cursor += 1;
      pending = { frame: { kind: "record", value, names: new Set(), owner: recordOwner, put: accept,
        choices: frameChoices(choices), selected: [], ordinal: 0, phase: "first-field", name: "", shape: "null" }, next: pending };
      continue;
    }
    const identityShapes = leaves.filter(leaf => typeof leaf !== "string" && leaf.kind === "identity" && leaf.prefix === label);
    const syntax = label === "n" && leaves.some(leaf => leaf === "SyntaxNode" ||
      typeof leaf !== "string" && leaf.kind === "record" && leaf.syntax);
    if (identityShapes.length === 0 && !syntax) {
      fail(reader, expectedValue(shape), offset);
      return false;
    }
    if (reader.text.charAt(reader.cursor) !== ":") { fail(reader, [":"]); return false; }
    reader.cursor += 1;
    whitespace(reader);
    let value: string | number;
    const payloadOffset = reader.cursor;
    if (reader.text.charAt(reader.cursor) === "\"") {
      if (!identityShapes.some(leaf => typeof leaf !== "string" && leaf.kind === "identity" && leaf.value === "string")) {
        fail(reader, ["number identity"], payloadOffset);
        return false;
      }
      const content = quoted(reader, null);
      if (content === null) return false;
      value = content;
    } else {
      if (!syntax && !identityShapes.some(leaf => typeof leaf !== "string" && leaf.kind === "identity" && leaf.value === "number")) {
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
      value = content.value;
    }
    const data = identity(shape, label, value, offset, owner);
    if (reader.failed) return false;
    accept(data);
  }
  return false;
}

export const parseHir: ParseHir = text => {
  const reader: TextReader = { text, cursor: 0, failed: false,
    failure: { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"],
      found: text.length === 0 ? null : text.slice(0, 1) } };
  const output: HirOutput = { value: null };
  if (readHirModule(reader, output, createHirSchema())) return { kind: "parsed", value: output.value };
  return reader.failure;
};

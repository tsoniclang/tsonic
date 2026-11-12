import type { InvariantFailure, TextParseResult } from "../diag/contract.js";
import type { AtomicContribution, ConstraintSet, InferenceGroup, Solution } from "./contract.js";
import { requirePresent } from "../diag/index.js";
import { enumValue } from "./print.js";
import { numberText } from "./text-data.js";
import type { Reader, RecordReader, RecordShape, Schema } from "./text-data.js";
import { createTextSchemas } from "./text-decisions.js";

interface InvalidText { readonly kind: "invalid-text"; readonly offset: number; readonly line: number; readonly column: number; readonly expected: readonly string[]; readonly found: string | null }

interface TokenPosition {
  readonly text: string;
  readonly offset: number;
  readonly end: number;
  readonly newline: boolean;
}

type Token = TokenPosition & (
  | { readonly kind: "name" | "punctuation"; readonly value: string }
  | { readonly kind: "scalar"; readonly value: unknown; readonly stringOffsets: readonly number[] | null }
);

interface WireScalar {
  readonly kind: "scalar";
  readonly value: unknown;
  readonly prefix: string | null;
  readonly offset: number;
  readonly end: number;
}

interface WireArray<Value> {
  readonly kind: "array";
  readonly values: Value[];
  readonly offset: number;
  end: number;
}

interface WireRecord<Value> {
  readonly kind: "record";
  readonly label: string;
  readonly fields: WireField<Value>[];
  readonly offset: number;
  end: number;
  closed: boolean;
  pendingField: FieldName | null;
}

interface FieldName {
  readonly name: string;
  readonly offset: number;
  readonly end: number;
  readonly offsets: readonly number[] | null;
  readonly complete: boolean;
}

interface WireField<Value> extends FieldName {
  value: Value;
}

interface DecodedStringPrefix {
  readonly offset: number;
  readonly end: number;
  readonly value: string;
  readonly offsets: readonly number[];
}

interface WireIncomplete {
  readonly kind: "incomplete";
  readonly first: Token | null;
  readonly following: Token | null;
  readonly value: Token | null;
  readonly offset: number;
  readonly firstEnd: number;
  readonly incompleteString: DecodedStringPrefix | null;
  readonly end: number;
}

type Wire = WireScalar | WireArray<Wire> | WireRecord<Wire> | WireIncomplete;

type Frame =
  | { readonly kind: "array"; readonly node: WireArray<Wire>;
      state: "first" | "value" | "separator" }
  | { readonly kind: "record"; readonly node: WireRecord<Wire>;
      state: "first" | "field" | "separator" };

interface Validation {
  readonly text: string;
  failure: InvalidText;
}

function invalid(text: string, offset: number, expected: readonly string[], found?: string | null): InvalidText {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === "\n") { line += 1; column = 1; }
    else column += 1;
  }
  return { kind: "invalid-text", offset, line, column, expected,
    found: found === undefined ? offset < text.length ? text.charAt(offset) : null : found };
}

interface Lexical {
  readonly tokens: readonly Token[];
  readonly failure: InvalidText | null;
  readonly incompleteString: DecodedStringPrefix | null;
}

function numericEnd(text: string, start: number): number {
  let end = start;
  if (text[end] === "+" || text[end] === "-") end++;
  if (text.startsWith("Infinity", end)) end += 8;
  else {
    const first = end;
    while (text[end] !== undefined && text.charAt(end) >= "0" && text.charAt(end) <= "9") end++;
    if (end === first) return start;
    if (text[end] === "." && text.charAt(end + 1) >= "0" && text.charAt(end + 1) <= "9") {
      end += 2;
      while (text.charAt(end) >= "0" && text.charAt(end) <= "9") end++;
    }
    if (text[end] === "e" || text[end] === "E") {
      let exponent = end + 1;
      if (text[exponent] === "+" || text[exponent] === "-") exponent++;
      const firstDigit = exponent;
      while (text.charAt(exponent) >= "0" && text.charAt(exponent) <= "9") exponent++;
      if (exponent > firstDigit) end = exponent;
    }
  }
  return text[end] === "n" ? end + 1 : end;
}

function tokenize(text: string): Lexical {
  const result: Token[] = [];
  const stop = (failure: InvalidText, incompleteString: DecodedStringPrefix | null = null): Lexical => ({ tokens: result, failure, incompleteString });
  let offset = 0;
  while (offset < text.length) {
    const character = text.charAt(offset);
    if (/\s/u.test(character)) { offset += 1; continue; }
    const start = offset;
    const newline = text.slice(result.at(-1)?.end ?? 0, start).includes("\n");
    if (character === '"') {
      const parts: string[] = [];
      const offsets: number[] = [];
      const unfinished = (failure: InvalidText): Lexical =>
        stop(failure, { offset: start, end: offset, value: parts.join(""), offsets });
      offset += 1;
      let terminated = false;
      while (offset < text.length) {
        const current = text.charAt(offset);
        if (current === '"') { offset += 1; terminated = true; break; }
        if (current === "\\") {
          const escape = text[offset + 1];
          if (escape === "u") {
            const digits = text.slice(offset + 2, offset + 6);
            if (!/^[0-9a-fA-F]{4}$/u.test(digits)) return unfinished(invalid(text, offset + 2, ["four hexadecimal digits"], digits || null));
            offsets.push(offset); parts.push(String.fromCharCode(Number.parseInt(digits, 16))); offset += 6;
          } else {
            const decoded = escape === '"' ? '"' : escape === "\\" ? "\\" : escape === "/" ? "/"
              : escape === "b" ? "\b" : escape === "f" ? "\f" : escape === "n" ? "\n"
                : escape === "r" ? "\r" : escape === "t" ? "\t" : undefined;
            if (decoded === undefined) return unfinished(invalid(text, offset + 1, ["JSON escape"], escape ?? null));
            offsets.push(offset); parts.push(decoded); offset += 2;
          }
        } else {
          if (current.charCodeAt(0) < 32) return unfinished(invalid(text, offset, ["string character"]));
          offsets.push(offset); parts.push(current); offset += 1;
        }
      }
      if (!terminated) return unfinished(invalid(text, offset, ['"'], null));
      result.push({ kind: "scalar", text: text.slice(start, offset), value: parts.join(""), stringOffsets: offsets,
        offset: start, end: offset, newline });
    } else if ("(),[]=:".includes(character)) {
      result.push({ kind: "punctuation", text: character, value: character, offset, end: offset + 1, newline }); offset += 1;
    } else {
      const end = numericEnd(text, offset);
      const numeric = end !== offset;
      if (numeric) offset = end;
      else {
        if (!/[A-Za-z_]/u.test(character)) return stop(invalid(text, offset, ["value", "record"]));
        do { offset++; } while (/[A-Za-z_0-9-]/u.test(text.charAt(offset)));
      }
      const token = text.slice(start, offset);
      if (numeric) {
        if (token.endsWith("n")) {
          const digits = token.slice(0, -1);
          if (!/^-?(?:0|[1-9][0-9]*)$/u.test(digits) || digits === "-0")
            return stop(invalid(text, start, ["canonical bigint"], token));
          result.push({ kind: "scalar", text: token, value: BigInt(digits), stringOffsets: null, offset: start, end: offset, newline });
        } else {
          const value = Number(token);
          if (numberText(value) !== token) return stop(invalid(text, start, ["canonical number"], token));
          result.push({ kind: "scalar", text: token, value, stringOffsets: null, offset: start, end: offset, newline });
        }
      } else if (token === "NaN" || token === "true" || token === "false" || token === "null") {
        result.push({ kind: "scalar", text: token,
          value: token === "NaN" ? NaN : token === "true" ? true : token === "false" ? false : null,
          stringOffsets: null, offset: start, end: offset, newline });
      } else result.push({ kind: "name", text: token, value: token, offset: start, end: offset, newline });
    }
  }
  return { tokens: result, failure: null, incompleteString: null };
}

function earlier(left: InvalidText | null, right: InvalidText | null): InvalidText | null {
  if (left === null) return right;
  if (right === null) return left;
  return left.offset <= right.offset ? left : right;
}

function readWire(text: string): { readonly roots: readonly Wire[]; readonly lexical: InvalidText | null; readonly framing: InvalidText | null } {
  const lexical = tokenize(text);
  const tokens = lexical.tokens;
  const boundary = lexical.failure?.offset ?? text.length;
  const roots: Wire[] = [];
  const frames: Frame[] = [];
  let position = 0;
  let failure: InvalidText | null = null;
  const incomplete = (): WireIncomplete => ({ kind: "incomplete", first: tokens[position] ?? null,
    following: tokens[position + 1] ?? null, value: tokens[position + 2] ?? null,
    offset: tokens[position]?.offset ?? lexical.incompleteString?.offset ?? boundary,
    firstEnd: tokens[position]?.end ?? (lexical.incompleteString === null ? boundary : lexical.incompleteString.offset + 1),
    incompleteString: lexical.incompleteString, end: boundary });
  const fail = (expected: readonly string[]) => {
    const token = tokens[position];
    failure = invalid(text, token?.offset ?? boundary, expected, token?.text ?? null);
  };
  const take = (store: (value: Wire) => void, root: boolean) => {
    const token = tokens[position];
    const following = tokens[position + 1];
    if (token === undefined) { fail(["value", "record"]); return; }
    if (root && !token.newline) { fail(["newline"]); return; }
    if (token.kind === "scalar") {
      store({ kind: "scalar", value: token.value, prefix: null, offset: token.offset, end: token.end }); position += 1;
    } else if (token.text === "[") {
      const node: WireArray<Wire> = { kind: "array", values: [], offset: token.offset, end: boundary };
      store(node); frames.push({ kind: "array", node, state: "first" }); position += 1;
    } else if (token.kind === "name" && following?.text === ":") {
      const value = tokens[position + 2];
      if (value?.kind !== "scalar") { position += 2; fail(["identity value"]); return; }
      store({ kind: "scalar", prefix: token.text, value: value.value, offset: token.offset, end: value.end }); position += 3;
    } else if (token.kind === "name" && following?.text === "(") {
      const node: WireRecord<Wire> = { kind: "record", label: token.text,
        fields: [], offset: token.offset, end: boundary, closed: false, pendingField: null };
      store(node); frames.push({ kind: "record", node, state: "first" }); position += 2;
    } else if (token.kind === "name") { position += 1; fail([":", "("]); }
    else fail(["value", "record"]);
  };
  while ((position < tokens.length || frames.length > 0) && failure === null) {
    const frame = frames.at(-1);
    const token = tokens[position];
    if (frame === undefined) {
      const index = roots.length;
      roots.push(incomplete());
      take(value => { roots[index] = value; }, index > 0);
    } else if (frame.state === "separator") {
      const closing = frame.kind === "array" ? "]" : ")";
      if (token?.text === closing) {
        frame.node.end = token.offset;
        if (frame.kind === "record") frame.node.closed = true;
        frames.pop(); position += 1;
      }
      else if (token?.text === ",") { frame.state = frame.kind === "array" ? "value" : "field"; position += 1; }
      else { fail([",", closing]); break; }
    } else if (frame.kind === "array") {
      if (frame.state === "first" && token?.text === "]") { frame.node.end = token.offset; frames.pop(); position += 1; }
      else {
        const index = frame.node.values.length;
        frame.node.values.push(incomplete());
        frame.state = "separator"; take(value => { frame.node.values[index] = value; }, false);
      }
    } else if (frame.state === "first" && token?.text === ")") {
      frame.node.end = token.offset; frame.node.closed = true; frames.pop(); position += 1;
    } else if (token !== undefined && typeof token.value === "string" && (token.kind === "name" || token.kind === "scalar")) {
      const name = token.value;
      const spelling: FieldName = { name, offset: token.offset, end: token.kind === "scalar" ? token.end - 1 : token.end,
        offsets: token.kind === "scalar" ? token.stringOffsets : null, complete: true };
      frame.node.pendingField = spelling;
      position += 1;
      if (tokens[position]?.text !== "=") { fail(["="]); break; }
      frame.node.pendingField = null;
      position += 1; frame.state = "separator";
      const field: WireField<Wire> = { ...spelling, value: incomplete() };
      frame.node.fields.push(field);
      take(value => { field.value = value; }, false);
    } else {
      const prefix = lexical.incompleteString;
      if (token === undefined && prefix !== null)
        frame.node.pendingField = { name: prefix.value, offset: prefix.offset, end: prefix.end, offsets: prefix.offsets, complete: false };
      fail(["field", "="]); break;
    }
  }
  if (position >= tokens.length && frames.length === 0 && failure === null && lexical.incompleteString !== null)
    roots.push(incomplete());
  return { roots, lexical: lexical.failure, framing: failure };
}

interface RecordSelection {
  readonly shape: RecordShape;
  readonly reader: RecordReader;
  readonly invalidEnum: InvalidEnum | null;
  readonly pendingFailure: readonly string[] | null;
}

interface InvalidEnum {
  readonly index: number;
  readonly values: readonly (string | number)[];
}

function recordShape(records: readonly RecordReader[], wire: Wire): RecordSelection | undefined {
  if (wire.kind !== "record") return undefined;
  let choices = records.filter(alternative => alternative.shape.label === wire.label);
  let invalidEnum: InvalidEnum | null = null;
  for (const [index, field] of wire.fields.entries()) {
    const matchingNames = choices.flatMap(choice => {
      const selected = choice.shape.fields[index];
      return selected !== undefined && selected.name === field.name ? [{ choice, field: selected }] : [];
    });
    if (matchingNames.length === 0) break;
    choices = matchingNames.map(selected => selected.choice);
    const enums = matchingNames.flatMap(selected => {
      const metadata = selected.field.shape.shape();
      return metadata.kind === "enum" ? [{ choice: selected.choice, values: metadata.values }] : [];
    });
    if (enums.length === 0) continue;
    const value = field.value;
    const matchingValues = enums.filter(selected => value.kind === "scalar" && value.prefix === null && enumValue(selected.values, value.value));
    if (matchingValues.length === 0) {
      invalidEnum = { index, values: [...new Set(enums.flatMap(selected => selected.values))] }; break;
    }
    choices = matchingValues.map(selected => selected.choice);
  }
  let pendingFailure: readonly string[] | null = null;
  const pending = wire.pendingField;
  if (pending !== null && invalidEnum === null) {
    const matching = choices.filter(choice => {
      const field = choice.shape.fields[wire.fields.length];
      return field !== undefined && (pending.complete ? field.name === pending.name : field.name.startsWith(pending.name));
    });
    if (matching.length === 0) pendingFailure = [...new Set(choices.flatMap(choice => {
      const field = choice.shape.fields[wire.fields.length];
      return field === undefined ? [] : [field.name];
    }))];
    else choices = matching;
  }
  const selected = choices[0];
  return selected === undefined ? undefined : { shape: selected.shape, reader: selected, invalidEnum, pendingFailure };
}

type ValidationTask =
  | { readonly kind: "value"; readonly wire: Wire; readonly reader: Reader; readonly expectedEnum: readonly (string | number)[] | null }
  | { readonly kind: "complete"; readonly complete: () => void }
  | { readonly kind: "invalid"; readonly wire: Wire | undefined; readonly expected: readonly string[];
      readonly offset: number | undefined; readonly found: string | null | undefined };

function enumItems(values: readonly (string | number)[]): readonly string[] {
  return values.map(value => typeof value === "number" ? numberText(value) : JSON.stringify(value));
}

function matches<Value>(roots: readonly Wire[], schema: Schema<Value>, receive: (index: number, value: Value) => void,
  many: boolean, state: Validation, constructions: (() => void)[]): boolean {
  const fail = (wire: Wire | undefined, expected: readonly string[], offset?: number, found?: string | null) => {
    const at = offset ?? wire?.offset ?? state.text.length;
    const token = found !== undefined ? found : wire === undefined ? null : wire.kind === "record" ? wire.label
      : wire.kind === "array" ? "[" : state.text.slice(wire.offset, wire.kind === "incomplete" ? wire.firstEnd : wire.end);
    state.failure = invalid(state.text, at, expected, token); return false;
  };
  const bad = (wire: Wire | undefined, expected: readonly string[], offset?: number, found?: string | null): ValidationTask =>
    ({ kind: "invalid", wire, expected, offset, found });
  const badField = (record: WireRecord<Wire>, field: FieldName, required: readonly string[], given: number): ValidationTask => {
    let shared = 0;
    for (const name of required) {
      let length = 0;
      while (length < name.length && length < field.name.length && name[length] === field.name[length]) length += 1;
      shared = Math.max(shared, length);
    }
    const offset = shared === field.name.length ? field.end : field.offsets === null ? field.offset + shared : field.offsets[shared];
    const duplicate = field.complete && record.fields.slice(0, given).some(previous => previous.name === field.name);
    return bad(record, duplicate ? ["unique record field"] : required.length === 0 ? ["end of record"] : required, offset, field.name);
  };
  const pending: ValidationTask[] = [];
  if (!many && roots.length === 0) return fail(undefined, [schema.name]);
  if (!many && roots.length > 1) pending.push(bad(roots[1], ["end of document"]));
  for (const [index, wire] of [...(many ? roots : roots.slice(0, 1)).entries()].reverse())
    pending.push({ kind: "value", wire, reader: schema.reader(value => receive(index, value)), expectedEnum: null });
  for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
    if (task.kind === "invalid") return fail(task.wire, task.expected, task.offset, task.found);
    if (task.kind === "complete") { constructions.push(task.complete); continue; }
    const shape = task.reader;
    const records = shape.kind === "records" ? shape.records() : [];
    const wire = task.wire;
    if (shape.kind === "enum") {
      const values = task.expectedEnum ?? shape.values;
      if (wire.kind === "incomplete") {
        const token = wire.first;
        if (token === null) {
          const prefix = wire.incompleteString;
          if (prefix !== null) {
            const literals = values.filter((value): value is string => typeof value === "string");
            if (literals.length === 0) return fail(undefined, enumItems(values), prefix.offset, '"');
            if (!literals.some(value => value.startsWith(prefix.value)))
              return fail(undefined, enumItems(values), prefix.offset, state.text.slice(prefix.offset, prefix.end));
          }
          return fail(undefined, enumItems(values), wire.end, null);
        }
        return fail(wire, enumItems(values), wire.offset, token.text);
      }
      if (wire.kind !== "scalar" || wire.prefix !== null ||
        (typeof wire.value !== "string" && typeof wire.value !== "number") || !enumValue(shape.values, wire.value))
        return fail(wire, enumItems(values));
      shape.receive(wire.value);
      continue;
    }
    if (wire.kind === "incomplete" && shape.kind !== "nullable") {
      const token = wire.first;
      const expected = shape.kind === "records" ? records.map(value => value.shape.label)
        : [shape.kind === "array" ? "[" : shape.name];
      if (token === null) {
        const prefix = wire.incompleteString;
        if (prefix !== null) {
          if (!(shape.kind === "scalar" && shape.name === "string"))
            return fail(undefined, expected, prefix.offset, '"');
        }
        return fail(undefined, expected, wire.end, null);
      }
      if (shape.kind === "scalar" && token.kind === "name" && token.text === shape.name &&
        shape.name !== "string" && shape.name !== "number" && shape.name !== "boolean" && shape.name !== "bigint") {
        const next = wire.following;
        if (next?.text === ":") {
          const prefix = wire.incompleteString;
          if (wire.value === null && prefix !== null &&
            (shape.name === "n" || shape.name === "l" || shape.name === "t" || shape.name === "sig" || shape.name === "cand"))
            return fail(wire, [shape.name], wire.offset, state.text.slice(wire.offset, prefix.end));
          return fail(undefined, ["identity value"], wire.value?.offset ?? wire.end, wire.value?.text ?? null);
        }
        return fail(undefined, [":"], next?.offset ?? wire.end, next?.text ?? null);
      }
      if (shape.kind === "records") {
        const labels = records.map(value => value.shape.label);
        if (token.kind === "name" && labels.includes(token.text))
          return fail(undefined, ["("], wire.following?.offset ?? wire.end, wire.following?.text ?? null);
        return fail(wire, labels, wire.offset, token.text);
      }
      return fail(wire, [shape.kind === "array" ? "[" : shape.name], wire.offset, token.text);
    }
    switch (shape.kind) {
      case "nullable":
        if (wire.kind === "scalar" && wire.prefix === null && wire.value === null) shape.receive();
        else pending.push({ ...task, reader: shape.value() });
        break;
      case "scalar":
        if (wire.kind !== "scalar" || !shape.receive(wire.value, wire.prefix)) return fail(wire, [shape.name]);
        break;
      case "array":
        if (wire.kind !== "array") return fail(wire, ["["]);
        pending.push({ kind: "complete", complete: shape.complete });
        for (const [index, child] of [...wire.values.entries()].reverse())
          pending.push({ kind: "value", wire: child, reader: shape.item(index), expectedEnum: null });
        break;
      case "records": {
        if (wire.kind === "scalar" && wire.prefix !== null && records.some(choice => choice.shape.label === wire.prefix))
          return fail(wire, ["("], wire.offset + wire.prefix.length, ":");
        const selected = recordShape(records, wire);
        if (wire.kind !== "record" || selected === undefined)
          return fail(wire, records.map(item => item.shape.label));
        const record = selected.reader.prepare();
        const fields = record.fields;
        pending.push({ kind: "complete", complete: record.complete });
        const children: ValidationTask[] = [];
        let complete = true;
        for (const [index, expected] of fields.entries()) {
          const actual = wire.fields[index];
          if (actual === undefined) {
            const pendingField = wire.pendingField;
            if (pendingField === null) children.push(bad(wire, [expected.name], wire.end, wire.closed ? ")" : null));
            else if (selected.pendingFailure !== null)
              children.push(badField(wire, pendingField, selected.pendingFailure, index));
            complete = false; break;
          }
          if (actual.name !== expected.name) { children.push(badField(wire, actual, [expected.name], index)); complete = false; break; }
          const failedEnum = selected.invalidEnum;
          children.push({ kind: "value", wire: actual.value, reader: expected.reader(),
            expectedEnum: failedEnum !== null && failedEnum.index === index ? failedEnum.values : null });
        }
        const extra = wire.fields[fields.length];
        if (complete && extra !== undefined) children.push(badField(wire, extra, [], fields.length));
        else if (complete && wire.pendingField !== null && (wire.pendingField.complete || wire.pendingField.name.length > 0))
          children.push(badField(wire, wire.pendingField, selected.pendingFailure ?? [], fields.length));
        for (const child of children.reverse()) pending.push(child);
        break;
      }
    }
  }
  return true;
}

const constructionFailure: InvariantFailure = { owner: "ir-infer", query: null, origin: null,
  message: "The text reader must construct its validated root and declared fields." };

function readValues<Value>(text: string, schema: Schema<Value>, many: boolean): TextParseResult<readonly Value[]> {
  const wire = readWire(text);
  const values: Value[] = [];
  const constructions: (() => void)[] = [];
  const state = { text, failure: invalid(text, 0, [schema.name]) };
  const valid = matches(wire.roots, schema, (index, value) => { values[index] = value; }, many, state, constructions);
  const failure = earlier(earlier(wire.lexical, valid ? null : state.failure), wire.framing);
  if (failure !== null) return failure;
  for (const construct of constructions) construct();
  return { kind: "parsed", value: values };
}

function readOne<Value>(text: string, schema: Schema<Value>): TextParseResult<Value> {
  const result = readValues(text, schema, false);
  return result.kind === "invalid-text" ? result : { kind: "parsed", value: requirePresent(result.value[0], constructionFailure) };
}

export function readConstraints(text: string): TextParseResult<ConstraintSet> {
  return readOne(text, createTextSchemas().constraintSetSchema);
}

export function readContributions(text: string): TextParseResult<readonly AtomicContribution[]> {
  return readValues(text, createTextSchemas().atomicContributionSchema, true);
}

export function readGroup(text: string): TextParseResult<InferenceGroup> {
  return readOne(text, createTextSchemas().inferenceGroupSchema);
}

export function readSolution(text: string): TextParseResult<Solution> {
  return readOne(text, createTextSchemas().solutionSchema);
}

import { requirePresent } from "../diag/index.js";
import { createTypeTextReaders } from "./text-records.js";
import type { ScalarRequest, ScalarRule, TextFieldReader, TextRecordReader, TextRequest } from "./text-readers.js";
import type { ParseTypes, TypeTable } from "./contract.js";
import type { InvariantFailure, TextParseResult } from "../diag/contract.js";

function referencePrefix(rule: ScalarRule): string | null {
  switch (rule) {
    case "type-id": return "t"; case "signature-id": case "own-signature-id": return "sig"; case "definition-id": return "def";
    case "body-id": return "body"; case "group-id": return "group"; case "node-id": return "n"; case "local-id": return "l";
    case "number": case "bigint": case "string": case "boolean": case "native": case "intrinsic": case "member-kind":
    case "signature-kind": case "parameter-kind": case "tuple-kind": case "passing": case "runtime-base": case "facet":
    case "sum-origin": return null;
  }
}
function scalarExpected(rule: ScalarRule): readonly string[] {
  switch (rule) {
    case "number": case "type-id": case "signature-id": case "own-signature-id": case "node-id": case "local-id": return ["number"];
    case "string": return ["string"];
    case "bigint": return ["bigint"];
    case "boolean": return ["boolean"];
    case "definition-id": return ["canonical definition identity"];
    case "body-id": return ["canonical body identity"];
    case "group-id": return ["canonical inference-group identity"];
    case "native": return ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
      "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
    case "intrinsic": return ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"];
    case "member-kind": return ["property", "method", "accessor"];
    case "signature-kind": return ["call", "construct"];
    case "parameter-kind": return ["required", "optional", "default", "rest"];
    case "tuple-kind": return ["required", "optional", "rest"];
    case "passing": return ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"];
    case "runtime-base": return ["number", "bigint"];
    case "facet": return ["instance", "value"];
    case "sum-origin": return ["authored", "inferred"];
  }
}

interface ArrayFrame { readonly kind: "array"; readonly parent: Frame | null;
  readonly request: TextRequest & { readonly kind: "array" }; phase: "first" | "next" | "comma" }
interface RecordFrame { readonly kind: "record"; readonly parent: Frame | null;
  readonly request: TextRecordReader; phase: "first" | "next" | "comma"; count: number }
type Frame = ArrayFrame | RecordFrame;
interface FieldName {
  readonly required: string; readonly expected: readonly string[]; readonly previous: readonly string[];
  deviation: number | null;
}

const tableConstructionFailure: InvariantFailure = { owner: "ir-types", query: null, origin: null,
  message: "A complete TypeTable text must publish its typed root." };

function decodeTypes(text: string): TextParseResult<TypeTable> {
  let offset = 0;
  let failure: TextParseResult<never> | null = null;
  const fail = (position: number, expected: readonly string[]): void => {
    let line = 1;
    let column = 1;
    for (let index = 0; index < position; index += 1) {
      if (text[index] === "\n") { line += 1; column = 1; } else column += 1;
    }
    failure = { kind: "invalid-text", offset: position, line, column, expected,
      found: position < text.length ? text.slice(position, position + 1) : null };
  };
  const space = (): void => { while (offset < text.length && /\s/u.test(text.charAt(offset))) offset += 1; };
  const word = (): string => {
    const begin = offset++;
    while (offset < text.length && /[A-Za-z0-9_-]/u.test(text.charAt(offset))) offset += 1;
    return text.slice(begin, offset);
  };
  const identifier = (expected: readonly string[] = ["identifier"]): string | null => {
    if (!/[A-Za-z_]/u.test(text.charAt(offset))) { fail(offset, expected); return null; }
    return word();
  };
  const finishField = (field: FieldName, value: string, end: number): string | null => {
    if (field.required === "" || value !== field.required) {
      fail(field.deviation ?? end, field.previous.includes(value) ? ["unique record field"] : field.expected);
      return null;
    }
    return value;
  };
  const string = (choices: readonly string[] | null, expected: readonly string[], field: FieldName | null): string | null => {
    const begin = offset++;
    const parts: string[] = [];
    let remaining = choices;
    let previous = field === null ? [] : field.previous;
    let position = 0;
    const lexical = (site: number, expected: readonly string[]): null => {
      if (field !== null && field.deviation !== null) fail(field.deviation, field.expected);
      else fail(site, expected);
      return null;
    };
    while (offset < text.length) {
      const site = offset;
      const character = text.charAt(offset++);
      if (character === '"') {
        const value = parts.join("");
        return field === null ? value : finishField(field, value, site);
      }
      if (character.charCodeAt(0) < 32) return lexical(site, ["escaped string character"]);
      let decoded = character;
      if (character === "\\") {
        if (offset === text.length) break;
        const escaped = text.charAt(offset++);
        switch (escaped) {
          case '"': case "\\": case "/": decoded = escaped; break;
          case "b": decoded = "\b"; break;
          case "f": decoded = "\f"; break;
          case "n": decoded = "\n"; break;
          case "r": decoded = "\r"; break;
          case "t": decoded = "\t"; break;
          case "u": {
            const digits = text.slice(offset, offset + 4);
            if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) return lexical(begin, ["JSON string"]);
            decoded = String.fromCharCode(Number.parseInt(digits, 16));
            offset += 4;
            break;
          }
          default: return lexical(begin, ["JSON string"]);
        }
      }
      parts.push(decoded);
      if (field !== null) {
        previous = previous.filter(name => name.charAt(position) === decoded);
        if (field.deviation === null && field.required.charAt(position) !== decoded) field.deviation = site;
        if (field.deviation !== null && previous.length === 0) { fail(field.deviation, field.expected); return null; }
      }
      if (remaining !== null) {
        remaining = remaining.filter(choice => choice.charAt(position) === decoded);
        if (remaining.length === 0) { fail(begin, expected); return null; }
      }
      position += 1;
    }
    return lexical(offset, ['"']);
  };
  const scalar = (request: ScalarRequest, site: number): boolean => {
    const begin = offset;
    const rule = request.rule;
    const expected = scalarExpected(rule);
    if (text.charAt(offset) === '"') {
      if (request.kind !== "string") { fail(site, expected); return false; }
      const choices = rule === "string" || referencePrefix(rule) !== null ? null : expected;
      const value = string(choices, expected, null);
      if (value === null) return false;
      if (!request.accept(value)) { fail(site, expected); return false; }
      return true;
    }
    for (const [token, value] of [["NaN", NaN], ["+Infinity", Infinity], ["-Infinity", -Infinity]] satisfies readonly (readonly [string, number])[]) {
      if (text.startsWith(token, offset)) {
        if (request.kind !== "number") { fail(site, expected); return false; }
        offset += token.length;
        request.accept(value);
        return true;
      }
    }
    if (/[0-9-]/u.test(text.charAt(offset))) {
      if (request.kind !== "number" && request.kind !== "bigint") { fail(site, expected); return false; }
      offset += 1;
      while (offset < text.length && /[0-9eE+.n-]/u.test(text.charAt(offset))) {
        const character = text.charAt(offset);
        if (request.kind === "number" && character === "n" || request.kind === "bigint" && /[.eE]/u.test(character)) {
          if (/^-?(?:0|[1-9][0-9]*)$/u.test(text.slice(begin, offset))) fail(site, expected);
          else fail(begin, ["finite number", "bigint"]);
          return false;
        }
        offset += 1;
      }
      const token = text.slice(begin, offset);
      if (request.kind === "bigint" && /^-?(?:0|[1-9][0-9]*)n$/u.test(token)) {
        request.accept(BigInt(token.slice(0, -1)));
        return true;
      }
      if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u.test(token) || !Number.isFinite(Number(token))) {
        fail(begin, ["finite number", "bigint"]);
        return false;
      }
      if (request.kind === "bigint") { fail(site, expected); return false; }
      request.accept(Number(token));
      return true;
    }
    return false;
  };

  const readers = createTypeTextReaders();
  let value: TypeTable | undefined;
  const rootRequest = readers.table.request(result => { value = result; });
  let active: Frame | null = null;
  let ready = false;
  while (failure === null) {
    if (ready) {
      if (active === null) {
        space();
        if (offset !== text.length) { fail(offset, ["end of document"]); continue; }
        return { kind: "parsed", value: requirePresent(value, tableConstructionFailure) };
      }
      if (active.kind === "record") active.count += 1;
      active.phase = "comma";
      ready = false;
      continue;
    }
    space();
    let request: TextRequest = rootRequest;
    if (active !== null) {
      const close = active.kind === "array" ? "]" : ")";
      if (text.charAt(offset) === close && active.phase !== "next") {
        if (active.kind === "record") {
          const missing = active.request.fields[active.count];
          if (missing !== undefined) { fail(offset, [missing.name]); continue; }
        }
        offset += 1;
        const completed: Frame = active;
        active = completed.parent;
        completed.request.complete();
        ready = true;
        continue;
      }
      if (active.phase === "comma") {
        if (text.charAt(offset) !== ",") { fail(offset, [",", close]); continue; }
        offset += 1;
        active.phase = "next";
        continue;
      }
      if (active.kind === "array") request = active.request.value();
      else {
        const begin = offset;
        const field: TextFieldReader | undefined = active.request.fields[active.count];
        const name: FieldName = { required: field === undefined ? "" : field.name,
          expected: field === undefined ? ["end of record"] : [field.name],
          previous: active.request.fields.slice(0, active.count).map(field => field.name), deviation: null };
        let key: string | null;
        if (text.charAt(offset) === '"') key = string(null, name.expected, name);
        else {
          key = identifier();
          if (key !== null) {
            let position = 0;
            while (position < key.length && key.charAt(position) === name.required.charAt(position)) position += 1;
            if (position < key.length) name.deviation = begin + position;
            key = finishField(name, key, begin + key.length);
          }
        }
        if (field === undefined || key === null) continue;
        request = field.request();
        space();
        if (text.charAt(offset) !== "=") { fail(offset, ["="]); continue; }
        offset += 1;
        space();
      }
    }
    const begin = offset;
    while (request.kind === "nullable") {
      if (text.startsWith("null", offset) && !/[A-Za-z0-9_-]/u.test(text.charAt(offset + 4))) {
        offset += 4;
        request.accept();
        ready = true;
        break;
      }
      request = request.value();
    }
    if (request.kind === "nullable") continue;
    if (request.kind === "array") {
      if (text.charAt(offset) !== "[") { fail(begin, ["array"]); continue; }
      offset += 1;
      active = { kind: "array", parent: active, request, phase: "first" };
      continue;
    }
    if (request.kind !== "record") {
      const check = request.rule;
      const expected = scalarExpected(check);
      const prefix = referencePrefix(check);
      if (prefix !== null) {
        const name = identifier([`${prefix}:identity`]);
        if (name === null) continue;
        space();
        if (name !== prefix || text.charAt(offset) !== ":") { fail(begin, [`${prefix}:identity`]); continue; }
        offset += 1;
        space();
        if (!scalar(request, begin)) { if (failure === null) fail(offset, ["identity scalar"]); continue; }
        ready = true;
        continue;
      }
      const character = text.charAt(offset);
      if (/[A-Za-z_]/u.test(character) && !text.startsWith("NaN", offset)) {
        const name = word();
        space();
        if (text.charAt(offset) === ":") { fail(begin, ["unqualified value"]); continue; }
        if (name !== "true" && name !== "false") { fail(begin, expected); continue; }
        if (request.kind !== "boolean") { fail(begin, expected); continue; }
        request.accept(name === "true");
        ready = true;
        continue;
      }
      if (!scalar(request, begin)) { if (failure === null) fail(begin, expected); continue; }
      ready = true;
      continue;
    }
    const name = identifier();
    if (name === null) continue;
    const record = request.open(name);
    if ("kind" in record) { fail(begin, record.expected); continue; }
    space();
    if (text.charAt(offset) !== "(") { fail(offset, ["("]); continue; }
    offset += 1;
    active = { kind: "record", parent: active, request: record, phase: "first", count: 0 };
  }
  return failure;
}

export const parseTypes: ParseTypes = text => decodeTypes(text);

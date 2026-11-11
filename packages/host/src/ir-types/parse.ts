import { decodeDefId, decodeBodyId, decodeGroupId, encodeDefId, encodeBodyId, encodeGroupId,
  tyId, sigId, nodeId, localId } from "../ids/index.js";
import type { ParseTypes, TypeTable, TypeTerm, Signature, SignatureInput } from "./contract.js";
import type { TextParseResult } from "../diag/contract.js";
import type { PublicationWork, PublicationResult } from "./work.js";
import { chargeWork, workLimit } from "./work.js";

type Row = { readonly [field: string]: unknown };
type RecordRule = "table" | "type" | "signature" | "signature-input" | "member" | "member-key" | "origin" | "source"
  | "node" | "item-node" | "local" | "construction" | "component" | "selector" | "family" | "arm"
  | "parameter-identity" | "type-parameter" | "signature-parameter" | "tuple-element" | "rational" | "literal"
  | "extent" | "projection" | "composition" | "index-signature";
type ScalarRule = "type-id" | "signature-id" | "own-signature-id" | "definition-id" | "body-id" | "group-id" | "node-id" | "local-id"
  | "number" | "bigint" | "string" | "boolean" | "native" | "intrinsic" | "member-kind" | "signature-kind"
  | "parameter-kind" | "tuple-kind" | "passing" | "runtime-base" | "facet" | "sum-origin";
type Rule = RecordRule | ScalarRule;
type RootRule = "type" | "signature" | "signature-input";
type Check = Rule | { readonly kind: "array" | "nullable"; readonly rule: Rule };
type Field = readonly [string, Check];
type Schema = { readonly kind: "fields"; readonly name: string | null; readonly fields: readonly Field[] }
  | { readonly kind: "invalid"; readonly expected: readonly string[] };
type Phase = "read" | "emit";
type DataResult<Value> = PublicationResult<Value> | { readonly kind: "invalid" };
interface Path { readonly parent: Path | null; readonly part: string }

function isRow(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isValues(value: unknown): value is readonly unknown[] { return Array.isArray(value); }
function array(rule: Rule): Check { return { kind: "array", rule }; }
function nullable(rule: Rule): Check { return { kind: "nullable", rule }; }
function isScalar(rule: Rule): rule is ScalarRule {
  switch (rule) {
    case "type-id": case "signature-id": case "own-signature-id": case "definition-id": case "body-id": case "group-id": case "node-id": case "local-id":
    case "number": case "bigint": case "string": case "boolean": case "native": case "intrinsic": case "member-kind":
    case "signature-kind": case "parameter-kind": case "tuple-kind": case "passing": case "runtime-base": case "facet":
    case "sum-origin": return true;
    case "table": case "type": case "signature": case "signature-input": case "member": case "member-key": case "origin":
    case "source": case "node": case "item-node": case "local": case "construction": case "component": case "selector":
    case "family": case "arm": case "parameter-identity": case "type-parameter": case "signature-parameter":
    case "tuple-element": case "rational": case "literal": case "extent": case "projection": case "composition":
    case "index-signature": return false;
  }
}
function referencePrefix(rule: ScalarRule): string | null {
  switch (rule) {
    case "type-id": return "t"; case "signature-id": case "own-signature-id": return "sig"; case "definition-id": return "def";
    case "body-id": return "body"; case "group-id": return "group"; case "node-id": return "n"; case "local-id": return "l";
    case "number": case "bigint": case "string": case "boolean": case "native": case "intrinsic": case "member-kind":
    case "signature-kind": case "parameter-kind": case "tuple-kind": case "passing": case "runtime-base": case "facet":
    case "sum-origin": return null;
  }
}
function scalarProblem(rule: ScalarRule, value: undefined): readonly string[];
function scalarProblem(rule: ScalarRule, value: unknown): readonly string[] | null;
function scalarProblem(rule: ScalarRule, value: unknown): readonly string[] | null {
  const choices = (...allowed: readonly string[]): readonly string[] | null =>
    typeof value === "string" && allowed.includes(value) ? null : allowed;
  switch (rule) {
    case "number": case "type-id": case "signature-id": case "own-signature-id": case "node-id": case "local-id": return typeof value === "number" ? null : ["number"];
    case "string": return typeof value === "string" ? null : ["string"];
    case "bigint": return typeof value === "bigint" ? null : ["bigint"];
    case "boolean": return typeof value === "boolean" ? null : ["boolean"];
    case "definition-id": return typeof value === "string" && decodeDefId(value).kind === "decoded" ? null : ["canonical definition identity"];
    case "body-id": return typeof value === "string" && decodeBodyId(value).kind === "decoded" ? null : ["canonical body identity"];
    case "group-id": return typeof value === "string" && decodeGroupId(value).kind === "decoded" ? null : ["canonical inference-group identity"];
    case "native": return choices("bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
      "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal");
    case "intrinsic": return choices("any", "unknown", "object", "void", "never", "absence", "bigint", "symbol");
    case "member-kind": return choices("property", "method", "accessor");
    case "signature-kind": return choices("call", "construct");
    case "parameter-kind": return choices("required", "optional", "default", "rest");
    case "tuple-kind": return choices("required", "optional", "rest");
    case "passing": return choices("by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move");
    case "runtime-base": return choices("number", "bigint");
    case "facet": return choices("instance", "value");
    case "sum-origin": return choices("authored", "inferred");
  }
}

function recordSchema(check: RecordRule, tag: unknown): Schema {
  const name = check === "table" ? "TypeTable" : check === "signature" ? "Signature" : check === "signature-input" ? "SignatureInput"
    : check === "member" ? "Member" : check === "index-signature" ? "IndexSignature" : check === "node" ? "NodeRef"
      : check === "item-node" ? "ItemNodeRef" : check === "local" ? "LocalRef" : check === "construction" ? "ConstructionDefinition"
        : check === "component" ? "TypeComponent" : check === "family" ? "SumFamily" : check === "arm" ? "SumArmRole"
          : check === "parameter-identity" ? "TypeParameterIdentity" : check === "type-parameter" ? "TypeParameter"
            : check === "signature-parameter" ? "SignatureParameter" : check === "tuple-element" ? "TupleElement"
              : check === "rational" ? "ExactRational" : check === "extent" ? "FixedExtent" : null;
  const fields = (...fields: readonly Field[]): Schema => ({ kind: "fields", name, fields });
  const invalid = (...expected: readonly string[]): Schema => ({ kind: "invalid", expected });
  switch (check) {
      case "table": return fields(["terms", array("type")], ["signatures", array("signature")]);
      case "rational": return fields(["numerator", "bigint"], ["denominator", "bigint"], ["negativeZero", "boolean"]);
      case "extent": return fields(["length", "bigint"], ["runtimeBase", "runtime-base"]);
      case "node": return fields(["body", "body-id"], ["node", "node-id"]);
      case "item-node": return fields(["owner", "definition-id"], ["node", "node-id"]);
      case "local": return fields(["body", "body-id"], ["local", "local-id"]);
      case "source":
        if (tag === "body" || tag === "item") return fields(["kind", "string"], ["value", tag === "body" ? "node" : "item-node"]);
        else return invalid("body", "item");
      case "parameter-identity": return fields(["owner", "definition-id"], ["index", "number"]);
      case "type-parameter": return fields(["identity", "parameter-identity"], ["declaration", "definition-id"],
        ["constraint", nullable("type-id")], ["default", nullable("type-id")]);
      case "signature-parameter": return fields(["declaration", "definition-id"], ["kind", "parameter-kind"],
        ["type", "type-id"], ["passing", "passing"], ["initializer", nullable("body-id")]);
      case "tuple-element": return fields(["kind", "tuple-kind"], ["type", "type-id"], ["declaration", nullable("definition-id")]);
      case "construction": return fields(["occurrence", "node"], ["captures", array("local")]);
      case "component": return fields(["root", "source"], ["path", array("selector")]);
      case "family": return fields(["origin", "sum-origin"], ["component", "component"],
        ["parameters", array("parameter-identity")], ["roles", array("arm")]);
      case "arm": return fields(["authoredIndex", "number"], ["component", "source"], ["member", "type-id"]);
      case "member-key":
        if (tag === "text" || tag === "number") return fields(["kind", "string"], ["value", tag === "text" ? "string" : "rational"]);
        else if (tag === "symbol") return fields(["kind", "string"], ["declaration", "definition-id"]);
        else return invalid("text", "number", "symbol");
      case "origin":
        if (tag === "declared") return fields(["kind", "string"], ["declaration", "definition-id"]);
        else if (tag === "class-prototype") return fields(["kind", "string"], ["owner", "definition-id"]);
        else if (tag === "mapped") return fields(["kind", "string"], ["owner", "source"], ["key", "member-key"]);
        else return invalid("declared", "class-prototype", "mapped");
      case "member": return fields(["key", "member-key"], ["origins", array("origin")], ["readOrigins", array("origin")],
        ["writeOrigins", array("origin")], ["kind", "member-kind"], ["read", nullable("type-id")], ["write", nullable("type-id")],
        ["optional", "boolean"], ["readonly", "boolean"]);
      case "index-signature": return fields(["declaration", "definition-id"], ["key", "type-id"],
        ["read", "type-id"], ["write", nullable("type-id")], ["readonly", "boolean"]);
      case "composition":
        if (tag === "union" || tag === "intersection") return fields(["kind", "string"], ["signatures", array("signature-id")]);
        else return invalid("union", "intersection");
      case "signature": case "signature-input": {
        const schema: (readonly [string, Check])[] = check === "signature" ? [["id", "own-signature-id"]] : [];
        schema.push(["declaration", nullable("definition-id")], ["owner", nullable("source")], ["composition", nullable("composition")],
          ["kind", "signature-kind"], ["typeParameters", array("type-parameter")], ["receiver", nullable("type-id")],
          ["parameters", array("signature-parameter")], ["result", "type-id"]);
        return fields(...schema);
      }
      case "projection":
        if (tag === "awaited") return fields(["kind", "string"]);
        else if (tag === "component") return fields(["kind", "string"], ["component", "component"]);
        else return invalid("awaited", "component");
      case "selector": {
        const prefix: readonly [string, Check] = ["kind", "string"];
        switch (tag) {
          case "class-value": case "optional-value": case "array-element": case "intersection-result": case "projection-source": case "awaited": return fields(prefix);
          case "tuple-element": case "union-member": case "argument-place": case "parameter-place": case "intersection-member": return fields(prefix, ["index", "number"]);
          case "construction-argument": return fields(prefix, ["definition", "construction"], ["index", "number"]);
          case "argument-tail": case "parameter-tail": return fields(prefix, ["start", "number"]);
          case "member": return fields(prefix, ["origin", "origin"]);
          case "index-key": case "index-value": return fields(prefix, ["declaration", "definition-id"]);
          case "parameter": return fields(prefix, ["signature", "signature-id"], ["index", "number"]);
          case "receiver": case "result": return fields(prefix, ["signature", "signature-id"]);
          case "signature-tail": return fields(prefix, ["signature", "signature-id"], ["start", "number"], ["readonly", "boolean"]);
          case "tuple-slice": return fields(prefix, ["start", "number"], ["endCount", "number"], ["readonly", "boolean"]);
          case "type-argument": return fields(prefix, ["declaration", "definition-id"], ["index", "number"]);
          case "sum-arm": return fields(prefix, ["family", "family"], ["index", "number"]);
          default: return invalid("component selector");
        }

      }
      case "literal":
        switch (tag) {
          case "number": return fields(["kind", "string"], ["value", "rational"]);
          case "bigint": case "string": case "boolean": return fields(["kind", "string"], ["value", tag]);
          case "absence": return fields(["kind", "string"]);
          case "unique-symbol": return fields(["kind", "string"], ["declaration", "definition-id"]);
          default: return invalid("literal value");
        }

      case "type":
        switch (tag) {
          case "primitive": return fields(["kind", "string"], ["primitive", "native"]);
          case "intrinsic": return fields(["kind", "string"], ["intrinsic", "intrinsic"]);
          case "string": case "error": return fields(["kind", "string"]);
          case "literal": return fields(["kind", "string"], ["value", "literal"], ["base", "type-id"]);
          case "union": case "intersection": return fields(["kind", "string"], ["members", array("type-id")]);
          case "optional": return fields(["kind", "string"], ["value", "type-id"]);
          case "array": return fields(["kind", "string"], ["element", "type-id"], ["readonly", "boolean"]);
          case "tuple": return fields(["kind", "string"], ["elements", array("tuple-element")], ["readonly", "boolean"]);
          case "fixed-array": return fields(["kind", "string"], ["element", "type-id"], ["extent", "extent"]);
          case "shape": return fields(["kind", "string"], ["members", array("member")], ["indexes", array("index-signature")],
            ["calls", array("signature-id")], ["constructs", array("signature-id")]);
          case "callable": return fields(["kind", "string"], ["calls", array("signature-id")], ["constructs", array("signature-id")]);
          case "declared": return fields(["kind", "string"], ["definition", "definition-id"], ["arguments", array("type-id")],
            ["facet", "facet"], ["extent", nullable("extent")]);
          case "construction-reference": return fields(["kind", "string"], ["definition", "construction"], ["arguments", array("type-id")]);
          case "enum": return fields(["kind", "string"], ["definition", "definition-id"]);
          case "param": return fields(["kind", "string"], ["parameter", "parameter-identity"]);
          case "self": return fields(["kind", "string"], ["owner", "definition-id"]);
          case "projection": return fields(["kind", "string"], ["source", "type-id"], ["projection", "projection"]);
          case "open": return fields(["kind", "string"], ["group", "group-id"], ["variable", "number"]);
          default: return invalid("type term");
        }


  }
}

type ValidationTask = { readonly kind: "value"; readonly value: unknown; readonly check: Check; readonly path: Path | null }
  | { readonly kind: "array"; readonly value: readonly unknown[]; readonly rule: Rule; readonly position: number; readonly path: Path | null }
  | { readonly kind: "fields"; readonly value: Row; readonly fields: readonly Field[];
      readonly position: number; readonly path: Path | null }
  | { readonly kind: "leave"; readonly value: object };

function validateTypeData(value: unknown, root: "type", budget: PublicationWork | null, phase: Phase): DataResult<TypeTerm>;
function validateTypeData(value: unknown, root: "signature", budget: PublicationWork | null, phase: Phase): DataResult<Signature>;
function validateTypeData(value: unknown, root: "signature-input", budget: PublicationWork | null, phase: Phase): DataResult<SignatureInput>;
function validateTypeData(value: unknown, root: RootRule, budget: PublicationWork | null, phase: Phase): DataResult<unknown> {
  if (budget !== null && !chargeWork(budget, 1)) return workLimit(budget);
  const work: ValidationTask[] = [{ kind: "value", value, check: root, path: null }];
  const onPath = new Set<object>();
  const enter = (value: object, path: Path | null): void => {
    if (onPath.has(value)) {
      const parts: string[] = [];
      for (let selected = path; selected !== null; selected = selected.parent) parts.push(selected.part);
      throw new TypeError(`Inline cycle at $${parts.reverse().join("")}`);
    }
    onPath.add(value);
    work.push({ kind: "leave", value });
  };
  for (;;) {
    const task = work.pop();
    if (task === undefined) return { kind: "complete", value };
    if (task.kind === "leave") { onPath.delete(task.value); continue; }
    if (task.kind === "array") {
      if (task.position < task.value.length) {
        work.push({ ...task, position: task.position + 1 });
        work.push({ kind: "value", value: task.value[task.position], check: task.rule,
          path: { parent: task.path, part: `[${task.position}]` } });
      }
      continue;
    }
    if (task.kind === "fields") {
      const field = task.fields[task.position];
      if (field !== undefined) {
        if (budget !== null && !chargeWork(budget, 1)) return workLimit(budget);
        work.push({ ...task, position: task.position + 1 });
        work.push({ kind: "value", value: task.value[field[0]], check: field[1],
          path: { parent: task.path, part: `.${field[0]}` } });
      }
      continue;
    }
    const selected = task.value;
    const check = task.check;
    if (typeof check !== "string") {
      if (check.kind === "nullable") {
        if (selected !== null) work.push({ ...task, check: check.rule });
      } else {
        if (!isValues(selected)) return { kind: "invalid" };
        enter(selected, task.path);
        work.push({ kind: "array", value: selected, rule: check.rule, position: 0, path: task.path });
      }
      continue;
    }
    if (isScalar(check)) {
      if (budget !== null && phase === "emit" && (check === "type-id" || check === "signature-id")
        && !chargeWork(budget, 1)) return workLimit(budget);
      if (scalarProblem(check, selected) !== null) return { kind: "invalid" };
      continue;
    }
    if (budget !== null && check === "selector" && !chargeWork(budget, 1)) return workLimit(budget);
    if (!isRow(selected)) return { kind: "invalid" };
    const schema = recordSchema(check, selected.kind);
    if (schema.kind === "invalid") return { kind: "invalid" };
    const keys = Object.keys(selected);
    if (keys.length !== schema.fields.length || keys.some(key => !schema.fields.some(field => field[0] === key)))
      return { kind: "invalid" };
    enter(selected, task.path);
    work.push({ kind: "fields", value: selected, fields: schema.fields, position: 0, path: task.path });
  }
}

function checked<Value>(result: DataResult<Value>, message: string): PublicationResult<Value> {
  if (result.kind === "invalid") throw new Error(message);
  return result;
}
export function readTypeData(value: unknown, budget: null, phase: Phase, message: string): { readonly kind: "complete"; readonly value: TypeTerm };
export function readTypeData(value: unknown, budget: PublicationWork, phase: Phase, message: string): PublicationResult<TypeTerm>;
export function readTypeData(value: unknown, budget: PublicationWork | null, phase: Phase, message: string): PublicationResult<TypeTerm> {
  return checked(validateTypeData(value, "type", budget, phase), message);
}
export function readSignatureData(value: unknown, budget: PublicationWork, phase: Phase, message: string): PublicationResult<SignatureInput> {
  return checked(validateTypeData(value, "signature-input", budget, phase), message);
}
export function readSignatureRow(value: unknown, budget: null, phase: Phase, message: string): { readonly kind: "complete"; readonly value: Signature };
export function readSignatureRow(value: unknown, budget: PublicationWork, phase: Phase, message: string): PublicationResult<Signature>;
export function readSignatureRow(value: unknown, budget: PublicationWork | null, phase: Phase, message: string): PublicationResult<Signature> {
  return checked(validateTypeData(value, "signature", budget, phase), message);
}


interface Located { readonly value: unknown }
interface ArrayFrame { readonly kind: "array"; readonly parent: Frame | null;
  readonly value: unknown[]; readonly rule: Rule; phase: "first" | "next" | "comma" }
interface RecordFrame { readonly kind: "record"; readonly parent: Frame | null;
  readonly value: { [field: string]: unknown }; readonly fields: readonly Field[];
  phase: "first" | "next" | "comma"; field: string; count: number }
type Frame = ArrayFrame | RecordFrame;
interface FieldName {
  readonly required: string; readonly expected: readonly string[]; readonly previous: readonly string[];
  deviation: number | null;
}

function scalarType(rule: ScalarRule): "number" | "bigint" | "string" | "boolean" {
  switch (rule) {
    case "number": case "type-id": case "signature-id": case "own-signature-id": case "node-id": case "local-id": return "number";
    case "bigint": return "bigint";
    case "boolean": return "boolean";
    case "string": case "definition-id": case "body-id": case "group-id": case "native": case "intrinsic":
    case "member-kind": case "signature-kind": case "parameter-kind": case "tuple-kind": case "passing":
    case "runtime-base": case "facet": case "sum-origin": return "string";
  }
}

function decodeTypes(text: string): TextParseResult<TypeTable>;
function decodeTypes(text: string): TextParseResult<unknown> {
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
  const scalar = (rule: ScalarRule, site: number): Located | null => {
    const begin = offset;
    const expectedType = scalarType(rule);
    const expected = scalarProblem(rule, undefined);
    const numericValue = (value: number): Located => ({ value: rule === "type-id" ? tyId(value)
      : rule === "signature-id" || rule === "own-signature-id" ? sigId(value)
        : rule === "node-id" ? nodeId(value) : rule === "local-id" ? localId(value) : value });
    if (text.charAt(offset) === '"') {
      if (expectedType !== "string") { fail(site, expected); return null; }
      const choices = rule === "string" || referencePrefix(rule) !== null ? null : expected;
      const value = string(choices, expected, null);
      if (value === null) return null;
      if (rule === "definition-id") {
        const decoded = decodeDefId(value);
        if (decoded.kind === "invalid") { fail(site, expected); return null; }
        return { value: encodeDefId(decoded.value) };
      }
      if (rule === "body-id") {
        const decoded = decodeBodyId(value);
        if (decoded.kind === "invalid") { fail(site, expected); return null; }
        return { value: encodeBodyId(decoded.value) };
      }
      if (rule === "group-id") {
        const decoded = decodeGroupId(value);
        if (decoded.kind === "invalid") { fail(site, expected); return null; }
        return { value: encodeGroupId([decoded.value]) };
      }
      return { value };
    }
    for (const [token, value] of [["NaN", NaN], ["+Infinity", Infinity], ["-Infinity", -Infinity]] satisfies readonly (readonly [string, number])[]) {
      if (text.startsWith(token, offset)) {
        if (expectedType !== "number") { fail(site, expected); return null; }
        offset += token.length;
        return numericValue(value);
      }
    }
    if (/[0-9-]/u.test(text.charAt(offset))) {
      if (expectedType !== "number" && expectedType !== "bigint") { fail(site, expected); return null; }
      offset += 1;
      while (offset < text.length && /[0-9eE+.n-]/u.test(text.charAt(offset))) {
        const character = text.charAt(offset);
        if (expectedType === "number" && character === "n" || expectedType === "bigint" && /[.eE]/u.test(character)) {
          if (/^-?(?:0|[1-9][0-9]*)$/u.test(text.slice(begin, offset))) fail(site, expected);
          else fail(begin, ["finite number", "bigint"]);
          return null;
        }
        offset += 1;
      }
      const token = text.slice(begin, offset);
      if (/^-?(?:0|[1-9][0-9]*)n$/u.test(token)) return { value: BigInt(token.slice(0, -1)) };
      if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u.test(token) || !Number.isFinite(Number(token))) {
        fail(begin, ["finite number", "bigint"]);
        return null;
      }
      return numericValue(Number(token));
    }
    return null;
  };

  let active: Frame | null = null;
  let ready: Located | null = null;
  while (failure === null) {
    if (ready !== null) {
      if (active === null) {
        space();
        if (offset !== text.length) { fail(offset, ["end of document"]); continue; }
        return { kind: "parsed", value: ready.value };
      }
      if (active.kind === "array") active.value.push(ready.value);
      else {
        Object.defineProperty(active.value, active.field, { value: ready.value, enumerable: true, writable: true, configurable: true });
        active.count += 1;
      }
      active.phase = "comma";
      ready = null;
      continue;
    }
    space();
    let check: Check = "table";
    if (active !== null) {
      const close = active.kind === "array" ? "]" : ")";
      if (text.charAt(offset) === close && active.phase !== "next") {
        if (active.kind === "record") {
          const missing = active.fields[active.count];
          if (missing !== undefined) { fail(offset, [missing[0]]); continue; }
        }
        offset += 1;
        ready = { value: active.value };
        active = active.parent;
        continue;
      }
      if (active.phase === "comma") {
        if (text.charAt(offset) !== ",") { fail(offset, [",", close]); continue; }
        offset += 1;
        active.phase = "next";
        continue;
      }
      if (active.kind === "array") check = active.rule;
      else {
        const begin = offset;
        const field: Field | undefined = active.fields[active.count];
        const name: FieldName = { required: field === undefined ? "" : field[0],
          expected: field === undefined ? ["end of record"] : [field[0]],
          previous: active.fields.slice(0, active.count).map(field => field[0]), deviation: null };
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
        active.field = key;
        check = field[1];
        space();
        if (text.charAt(offset) !== "=") { fail(offset, ["="]); continue; }
        offset += 1;
        space();
      }
    }
    const begin = offset;
    if (typeof check !== "string") {
      if (check.kind === "array") {
        if (text.charAt(offset) !== "[") { fail(begin, ["array"]); continue; }
        offset += 1;
        const next: ArrayFrame = { kind: "array", parent: active, value: [], rule: check.rule, phase: "first" };
        active = next;
        continue;
      }
      if (text.startsWith("null", offset) && !/[A-Za-z0-9_-]/u.test(text.charAt(offset + 4))) {
        offset += 4;
        ready = { value: null };
        continue;
      }
      check = check.rule;
    }
    if (isScalar(check)) {
      const expected = scalarProblem(check, undefined);
      const prefix = referencePrefix(check);
      if (prefix !== null) {
        const name = identifier([`${prefix}:identity`]);
        if (name === null) continue;
        space();
        if (name !== prefix || text.charAt(offset) !== ":") { fail(begin, [`${prefix}:identity`]); continue; }
        offset += 1;
        space();
        const selected = scalar(check, begin);
        if (selected === null) { if (failure === null) fail(offset, ["identity scalar"]); continue; }
        ready = selected;
        continue;
      }
      const character = text.charAt(offset);
      if (/[A-Za-z_]/u.test(character) && !text.startsWith("NaN", offset)) {
        const name = word();
        space();
        if (text.charAt(offset) === ":") { fail(begin, ["unqualified value"]); continue; }
        if (name !== "true" && name !== "false") { fail(begin, expected); continue; }
        const value = name === "true";
        const problem = scalarProblem(check, value);
        if (problem !== null) { fail(begin, problem); continue; }
        ready = { value };
        continue;
      }
      const selected = scalar(check, begin);
      if (selected === null) { if (failure === null) fail(begin, expected); continue; }
      const problem = scalarProblem(check, selected.value);
      if (problem !== null) { fail(begin, problem); continue; }
      ready = selected;
      continue;
    }
    const name = identifier();
    if (name === null) continue;
    const schema = recordSchema(check, name);
    if (schema.kind === "invalid") { fail(begin, schema.expected); continue; }
    if (schema.name !== null && name !== schema.name) { fail(begin, [schema.name]); continue; }
    space();
    if (text.charAt(offset) !== "(") { fail(offset, ["("]); continue; }
    offset += 1;
    const value: { [field: string]: unknown } = {};
    const fields = schema.name === null ? schema.fields.filter(field => field[0] !== "kind") : schema.fields;
    if (schema.name === null) value.kind = name;
    active = { kind: "record", parent: active, value, fields, phase: "first", field: "", count: 0 };
  }
  return failure;
}

export const parseTypes: ParseTypes = text => decodeTypes(text);

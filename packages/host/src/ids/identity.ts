import type {
  BodyId, BodyPath, BodyRole, ComponentId, DecodedIdentity, DefId, DefinitionPath,
  DefinitionSegment, EncodePackageId, GroupId, ModuleId, ModulePath, PackageId,
} from "./contract.js";
import { encodeCanonicalNumber } from "./key.js";

interface Cursor {
  readonly text: string;
  offset: number;
}

interface InvalidIdentity {
  readonly kind: "invalid";
  readonly text: string;
  readonly offset: number;
  readonly reason: "syntax" | "noncanonical" | "wrong-kind";
}

type Read<Value> = { readonly kind: "value"; readonly value: Value } | InvalidIdentity;

function invalid(cursor: Cursor, reason: InvalidIdentity["reason"], offset = cursor.offset): InvalidIdentity {
  return Object.freeze({ kind: "invalid", text: cursor.text, offset, reason });
}

function value<Value>(input: Value): Read<Value> {
  return { kind: "value", value: input };
}

function take(cursor: Cursor, expected: string): InvalidIdentity | null {
  if (cursor.text.charAt(cursor.offset) !== expected) return invalid(cursor, "syntax");
  cursor.offset += 1;
  return null;
}

function begin(cursor: Cursor, prefix: string): InvalidIdentity | null {
  const found = cursor.text.charAt(cursor.offset);
  if (found !== prefix) return invalid(cursor, found === "" ? "syntax" : "wrong-kind");
  cursor.offset += 1;
  return take(cursor, "[");
}

function reserved(character: string): boolean {
  return "%[];#/".includes(character);
}

function escape(text: string): string {
  const output: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    output.push(reserved(character) ? `%${text.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0")}` : character);
  }
  return output.join("");
}

function escaped(cursor: Cursor, terminators: string): Read<string> {
  const output: string[] = [];
  while (cursor.offset < cursor.text.length) {
    const character = cursor.text.charAt(cursor.offset);
    if (terminators.includes(character)) return value(output.join(""));
    if (character === "%") {
      const start = cursor.offset;
      let hexadecimal = "";
      for (let digit = 1; digit <= 4; digit += 1) {
        const characterAt = cursor.text.charAt(start + digit);
        if (!/^[0-9A-Fa-f]$/u.test(characterAt)) return invalid(cursor, "syntax", start + digit);
        if (characterAt !== characterAt.toUpperCase()) return invalid(cursor, "noncanonical", start + digit);
        hexadecimal += characterAt;
      }
      const decoded = String.fromCharCode(Number.parseInt(hexadecimal, 16));
      if (!reserved(decoded)) return invalid(cursor, "noncanonical", start);
      output.push(decoded);
      cursor.offset += 5;
    } else {
      if (reserved(character)) return invalid(cursor, "syntax");
      output.push(character);
      cursor.offset += 1;
    }
  }
  return invalid(cursor, "syntax");
}

function readOrdinal(cursor: Cursor, terminators: string, nonzero: boolean): Read<number> {
  const start = cursor.offset;
  let ordinal: number;
  if (cursor.text.charAt(cursor.offset) === "F") {
    cursor.offset += 1;
    const numberStart = cursor.offset;
    while (cursor.offset < cursor.text.length && cursor.text.charAt(cursor.offset) !== ":" &&
        !terminators.includes(cursor.text.charAt(cursor.offset))) cursor.offset += 1;
    if (cursor.offset === numberStart || cursor.text.charAt(cursor.offset) !== ":") return invalid(cursor, "syntax");
    const text = cursor.text.slice(numberStart, cursor.offset);
    ordinal = Number(text);
    if (Number.isNaN(ordinal) && text !== "NaN") return invalid(cursor, "syntax", numberStart);
    cursor.offset += 1;
  } else {
    while (/^[0-9]$/u.test(cursor.text.charAt(cursor.offset))) cursor.offset += 1;
    if (cursor.offset === start) return invalid(cursor, "syntax");
    ordinal = Number(cursor.text.slice(start, cursor.offset));
  }
  if (!terminators.includes(cursor.text.charAt(cursor.offset)) || cursor.offset === cursor.text.length) {
    return invalid(cursor, "syntax");
  }
  if (cursor.text.slice(start, cursor.offset) !== ordinalText(ordinal) || nonzero && Object.is(ordinal, 0)) {
    return invalid(cursor, "noncanonical", start);
  }
  return value(ordinal);
}

function packagePart(cursor: Cursor): Read<string> {
  const opening = begin(cursor, "P");
  if (opening !== null) return opening;
  const root = escaped(cursor, "]");
  if (root.kind === "invalid") return root;
  cursor.offset += 1;
  return root;
}

function modulePart(cursor: Cursor): Read<ModulePath> {
  const opening = begin(cursor, "M");
  if (opening !== null) return opening;
  const root = packagePart(cursor);
  if (root.kind === "invalid") return root;
  const separator = take(cursor, ";");
  if (separator !== null) return separator;
  const path = escaped(cursor, "]");
  if (path.kind === "invalid") return path;
  cursor.offset += 1;
  return value(Object.freeze({ package: encodePackageId(root.value), path: path.value }));
}

function definitionPart(cursor: Cursor): Read<DefinitionPath> {
  const opening = begin(cursor, "D");
  if (opening !== null) return opening;
  const moduleStart = cursor.offset;
  const module = modulePart(cursor);
  if (module.kind === "invalid") return module;
  const moduleText = cursor.text.slice(moduleStart, cursor.offset);
  if (cursor.text.charAt(cursor.offset) === "]") {
    cursor.offset += 1;
    return value(Object.freeze({ module: moduleIdentity(moduleText), segments: Object.freeze([]) }));
  }
  const separator = take(cursor, ";");
  if (separator !== null) return separator;
  const segments: DefinitionSegment[] = [];
  while (true) {
    const name = escaped(cursor, "/#]");
    if (name.kind === "invalid") return name;
    let ordinal = 0;
    if (cursor.text.charAt(cursor.offset) === "#") {
      cursor.offset += 1;
      const parsed = readOrdinal(cursor, "/]", true);
      if (parsed.kind === "invalid") return parsed;
      ordinal = parsed.value;
    }
    segments.push(Object.freeze({ name: name.value, ordinal }));
    if (cursor.text.charAt(cursor.offset) !== "/") break;
    cursor.offset += 1;
  }
  cursor.offset += 1;
  return value(Object.freeze({ module: moduleIdentity(moduleText), segments: Object.freeze(segments) }));
}

function bodyRole(role: string): role is BodyRole {
  return ["function", "initializer", "module", "default-argument", "field-initializer",
    "enum-member-initializer", "class-static-initializer"].includes(role);
}

function bodyPart(cursor: Cursor): Read<BodyPath> {
  const opening = begin(cursor, "B");
  if (opening !== null) return opening;
  const definitionStart = cursor.offset;
  const definition = definitionPart(cursor);
  if (definition.kind === "invalid") return definition;
  const definitionText = cursor.text.slice(definitionStart, cursor.offset);
  const separator = take(cursor, ";");
  if (separator !== null) return separator;
  const roleStart = cursor.offset;
  while (cursor.offset < cursor.text.length && cursor.text.charAt(cursor.offset) !== ";") cursor.offset += 1;
  const role = cursor.text.slice(roleStart, cursor.offset);
  if (!bodyRole(role)) return invalid(cursor, "syntax", roleStart);
  const ordinalSeparator = take(cursor, ";");
  if (ordinalSeparator !== null) return ordinalSeparator;
  const ordinal = readOrdinal(cursor, "]", false);
  if (ordinal.kind === "invalid") return ordinal;
  cursor.offset += 1;
  return value(Object.freeze({ owner: definitionIdentity(definitionText), role, ordinal: ordinal.value }));
}

function groupPart(cursor: Cursor): Read<BodyId> {
  const opening = begin(cursor, "G");
  if (opening !== null) return opening;
  const bodyStart = cursor.offset;
  const body = bodyPart(cursor);
  if (body.kind === "invalid") return body;
  const bodyText = cursor.text.slice(bodyStart, cursor.offset);
  const closing = take(cursor, "]");
  if (closing !== null) return closing;
  return value(bodyIdentity(bodyText));
}

function componentPart(cursor: Cursor): Read<readonly [DefId, ...DefId[]]> {
  const opening = begin(cursor, "C");
  if (opening !== null) return opening;
  const firstStart = cursor.offset;
  const first = definitionPart(cursor);
  if (first.kind === "invalid") return first;
  let previous = definitionIdentity(cursor.text.slice(firstStart, cursor.offset));
  const members: [DefId, ...DefId[]] = [previous];
  while (cursor.text.charAt(cursor.offset) === ";") {
    cursor.offset += 1;
    const nextStart = cursor.offset;
    const next = definitionPart(cursor);
    if (next.kind === "invalid") return next;
    const member = definitionIdentity(cursor.text.slice(nextStart, cursor.offset));
    if (member <= previous) return invalid(cursor, "noncanonical", nextStart);
    members.push(member);
    previous = member;
  }
  const closing = take(cursor, "]");
  if (closing !== null) return closing;
  return value(Object.freeze(members));
}

function decode<Value>(text: string, read: (cursor: Cursor) => Read<Value>): DecodedIdentity<Value> {
  const cursor: Cursor = { text, offset: 0 };
  const parsed = read(cursor);
  if (parsed.kind === "invalid") return parsed;
  if (cursor.offset !== text.length) return invalid(cursor, "syntax");
  return Object.freeze({ kind: "decoded", value: parsed.value });
}

function validModule(text: string): text is ModuleId { return decode(text, modulePart).kind === "decoded"; }
function validDefinition(text: string): text is DefId { return decode(text, definitionPart).kind === "decoded"; }
function validBody(text: string): text is BodyId { return decode(text, bodyPart).kind === "decoded"; }
function validGroup(text: string): text is GroupId { return decode(text, groupPart).kind === "decoded"; }
function validComponent(text: string): text is ComponentId { return decode(text, componentPart).kind === "decoded"; }

export function moduleIdentity(text: string): ModuleId {
  if (!validModule(text)) throw new TypeError("ids: invalid module identity");
  return text;
}

export function definitionIdentity(text: string): DefId {
  if (!validDefinition(text)) throw new TypeError("ids: invalid definition identity");
  return text;
}

export function bodyIdentity(text: string): BodyId {
  if (!validBody(text)) throw new TypeError("ids: invalid body identity");
  return text;
}

export function groupIdentity(text: string): GroupId {
  if (!validGroup(text)) throw new TypeError("ids: invalid group identity");
  return text;
}

export function componentIdentity(text: string): ComponentId {
  if (!validComponent(text)) throw new TypeError("ids: invalid component identity");
  return text;
}

function ordinalText(ordinal: number): string {
  return Number.isSafeInteger(ordinal) && ordinal >= 0 && !Object.is(ordinal, -0)
    ? String(ordinal) : encodeCanonicalNumber(ordinal);
}

export const encodePackageId: EncodePackageId = rootIdentity => `P[${escape(rootIdentity)}]` as PackageId;

export function decodePackageIdentity(text: string): DecodedIdentity<string> {
  return decode(text, packagePart);
}

export function encodeModuleIdentity(path: ModulePath): ModuleId {
  return moduleIdentity(`M[${path.package};${escape(path.path)}]`);
}

export function decodeModuleIdentity(text: string): DecodedIdentity<ModulePath> {
  return decode(text, modulePart);
}

export function encodeDefinitionIdentity(path: DefinitionPath): DefId {
  const segments = path.segments.map(segment => {
    const ordinal = ordinalText(segment.ordinal);
    return `${escape(segment.name)}${Object.is(segment.ordinal, 0) ? "" : `#${ordinal}`}`;
  });
  return definitionIdentity(`D[${path.module}${segments.length === 0 ? "" : `;${segments.join("/")}`}]`);
}

export function decodeDefinitionIdentity(text: string): DecodedIdentity<DefinitionPath> {
  return decode(text, definitionPart);
}

export function encodeBodyIdentity(path: BodyPath): BodyId {
  return bodyIdentity(`B[${path.owner};${path.role};${ordinalText(path.ordinal)}]`);
}

export function decodeBodyIdentity(text: string): DecodedIdentity<BodyPath> {
  return decode(text, bodyPart);
}

export function encodeGroupIdentity(members: readonly [BodyId, ...BodyId[]]): GroupId {
  let minimum = members[0];
  for (const member of members) if (member < minimum) minimum = member;
  return groupIdentity(`G[${minimum}]`);
}

export function decodeGroupIdentity(text: string): DecodedIdentity<BodyId> {
  return decode(text, groupPart);
}

export function encodeComponentIdentity(members: readonly [DefId, ...DefId[]]): ComponentId {
  return componentIdentity(`C[${[...new Set(members)].sort().join(";")}]`);
}

export function decodeComponentIdentity(text: string): DecodedIdentity<readonly [DefId, ...DefId[]]> {
  return decode(text, componentPart);
}

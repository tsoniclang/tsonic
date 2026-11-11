import type { PrintTypes, TypeTerm, Signature, SignatureInput, Member, MemberKey, MemberOrigin,
  IndexSignature, TypeParameter, ExactRational, LiteralTypeValue, ConstructionDefinition,
  TypeComponent, ComponentSelector, SumFamily } from "./contract.js";
import type { SourceNodeRef, NodeRef, LocalRef } from "../ids/contract.js";

type TextValue = string | number | bigint | boolean | null | readonly TextValue[] | TextRecord | TextReference | Deferred;
interface TextRecord { readonly kind: "record"; readonly source: object; readonly label: string; readonly fields: readonly (readonly [string, TextValue])[] }
interface TextReference { readonly kind: "reference"; readonly prefix: string; readonly value: string | number }
interface Deferred { readonly kind: "deferred"; readonly read: () => TextValue }
interface Token { readonly kind: "token"; readonly text: string }
interface Leave { readonly kind: "leave"; readonly source: object }
interface PrintPath { readonly parent: PrintPath | null; readonly part: string }
interface PrintWork { readonly value: TextValue | Token | Leave; readonly path: PrintPath | null; readonly next: PrintWork | null }

function record(label: string, source: object, ...fields: readonly (readonly [string, TextValue])[]): TextRecord {
  return { kind: "record", source, label, fields };
}

function reference(prefix: string, value: string | number): TextReference {
  return { kind: "reference", prefix, value };
}

function deferred(read: () => TextValue): Deferred {
  return { kind: "deferred", read };
}

function rational(value: ExactRational): TextRecord {
  return record("ExactRational", value, ["numerator", value.numerator], ["denominator", value.denominator],
    ["negativeZero", value.negativeZero]);
}

function literal(value: LiteralTypeValue): TextRecord {
  switch (value.kind) {
    case "number": return record(value.kind, value, ["value", rational(value.value)]);
    case "bigint": case "string": case "boolean": return record(value.kind, value, ["value", value.value]);
    case "absence": return record(value.kind, value);
    case "unique-symbol": return record(value.kind, value, ["declaration", reference("def", value.declaration)]);
  }
}

function node(value: NodeRef): TextRecord {
  return record("NodeRef", value, ["body", reference("body", value.body)], ["node", reference("n", value.node)]);
}

function source(value: SourceNodeRef): TextRecord {
  return record(value.kind, value, ["value", value.kind === "body" ? node(value.value)
    : record("ItemNodeRef", value.value, ["owner", reference("def", value.value.owner)], ["node", reference("n", value.value.node)])]);
}

function local(value: LocalRef): TextRecord {
  return record("LocalRef", value, ["body", reference("body", value.body)], ["local", reference("l", value.local)]);
}

function construction(value: ConstructionDefinition): TextRecord {
  return record("ConstructionDefinition", value, ["occurrence", node(value.occurrence)], ["captures", value.captures.map(selected => local(selected))]);
}

function memberKey(value: MemberKey): TextRecord {
  switch (value.kind) {
    case "text": return record(value.kind, value, ["value", value.value]);
    case "number": return record(value.kind, value, ["value", rational(value.value)]);
    case "symbol": return record(value.kind, value, ["declaration", reference("def", value.declaration)]);
  }
}

function origin(value: MemberOrigin): TextRecord {
  switch (value.kind) {
    case "declared": return record(value.kind, value, ["declaration", reference("def", value.declaration)]);
    case "class-prototype": return record(value.kind, value, ["owner", reference("def", value.owner)]);
    case "mapped": return record(value.kind, value, ["owner", source(value.owner)], ["key", memberKey(value.key)]);
  }
}

function family(value: SumFamily): TextRecord {
  return record("SumFamily", value, ["origin", value.origin], ["component", deferred(() => component(value.component))],
    ["parameters", value.parameters.map(parameter => record("TypeParameterIdentity", parameter,
      ["owner", reference("def", parameter.owner)], ["index", parameter.index]))],
    ["roles", value.roles.map(role => record("SumArmRole", role, ["authoredIndex", role.authoredIndex],
      ["component", source(role.component)], ["member", reference("t", role.member)]))]);
}

function selector(value: ComponentSelector): TextRecord {
  switch (value.kind) {
    case "class-value": case "optional-value": case "array-element": case "intersection-result":
    case "projection-source": case "awaited": return record(value.kind, value);
    case "construction-argument": return record(value.kind, value, ["definition", construction(value.definition)], ["index", value.index]);
    case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
    case "intersection-member": return record(value.kind, value, ["index", value.index]);
    case "argument-tail": case "parameter-tail": return record(value.kind, value, ["start", value.start]);
    case "member": return record(value.kind, value, ["origin", origin(value.origin)]);
    case "index-key": case "index-value": return record(value.kind, value, ["declaration", reference("def", value.declaration)]);
    case "parameter": return record(value.kind, value, ["signature", reference("sig", value.signature)], ["index", value.index]);
    case "receiver": case "result": return record(value.kind, value, ["signature", reference("sig", value.signature)]);
    case "signature-tail": return record(value.kind, value, ["signature", reference("sig", value.signature)],
      ["start", value.start], ["readonly", value.readonly]);
    case "tuple-slice": return record(value.kind, value, ["start", value.start], ["endCount", value.endCount], ["readonly", value.readonly]);
    case "type-argument": return record(value.kind, value, ["declaration", reference("def", value.declaration)], ["index", value.index]);
    case "sum-arm": return record(value.kind, value, ["family", deferred(() => family(value.family))], ["index", value.index]);
  }
}

function component(value: TypeComponent): TextRecord {
  return record("TypeComponent", value, ["root", source(value.root)], ["path", value.path.map(selected => selector(selected))]);
}

function member(value: Member): TextRecord {
  return record("Member", value, ["key", memberKey(value.key)], ["origins", value.origins.map(selected => origin(selected))],
    ["readOrigins", value.readOrigins.map(selected => origin(selected))], ["writeOrigins", value.writeOrigins.map(selected => origin(selected))],
    ["kind", value.kind], ["read", value.read === null ? null : reference("t", value.read)],
    ["write", value.write === null ? null : reference("t", value.write)], ["optional", value.optional], ["readonly", value.readonly]);
}

function index(value: IndexSignature): TextRecord {
  return record("IndexSignature", value, ["declaration", reference("def", value.declaration)], ["key", reference("t", value.key)],
    ["read", reference("t", value.read)], ["write", value.write === null ? null : reference("t", value.write)], ["readonly", value.readonly]);
}

function parameter(value: TypeParameter): TextRecord {
  return record("TypeParameter", value, ["identity", record("TypeParameterIdentity", value.identity, ["owner", reference("def", value.identity.owner)],
    ["index", value.identity.index])], ["declaration", reference("def", value.declaration)],
    ["constraint", value.constraint === null ? null : reference("t", value.constraint)],
    ["default", value.default === null ? null : reference("t", value.default)]);
}

function signature(value: Signature | SignatureInput): TextRecord {
  const fields: (readonly [string, TextValue])[] = [];
  if ("id" in value) fields.push(["id", reference("sig", value.id)]);
  fields.push(["declaration", value.declaration === null ? null : reference("def", value.declaration)],
    ["owner", value.owner === null ? null : source(value.owner)],
    ["composition", value.composition === null ? null : record(value.composition.kind, value.composition,
      ["signatures", value.composition.signatures.map(selected => reference("sig", selected))])],
    ["kind", value.kind], ["typeParameters", value.typeParameters.map(selected => parameter(selected))],
    ["receiver", value.receiver === null ? null : reference("t", value.receiver)],
    ["parameters", value.parameters.map(selected => record("SignatureParameter", selected,
      ["declaration", reference("def", selected.declaration)], ["kind", selected.kind], ["type", reference("t", selected.type)],
      ["passing", selected.passing], ["initializer", selected.initializer === null ? null : reference("body", selected.initializer)]))],
    ["result", reference("t", value.result)]);
  return record("id" in value ? "Signature" : "SignatureInput", value, ...fields);
}

function term(value: TypeTerm): TextRecord {
  switch (value.kind) {
    case "primitive": return record(value.kind, value, ["primitive", value.primitive]);
    case "string": case "error": return record(value.kind, value);
    case "intrinsic": return record(value.kind, value, ["intrinsic", value.intrinsic]);
    case "literal": return record(value.kind, value, ["value", literal(value.value)], ["base", reference("t", value.base)]);
    case "union": case "intersection": return record(value.kind, value, ["members", value.members.map(selected => reference("t", selected))]);
    case "optional": return record(value.kind, value, ["value", reference("t", value.value)]);
    case "array": return record(value.kind, value, ["element", reference("t", value.element)], ["readonly", value.readonly]);
    case "tuple": return record(value.kind, value, ["elements", value.elements.map(selected => record("TupleElement", selected,
      ["kind", selected.kind], ["type", reference("t", selected.type)],
      ["declaration", selected.declaration === null ? null : reference("def", selected.declaration)]))], ["readonly", value.readonly]);
    case "fixed-array": return record(value.kind, value, ["element", reference("t", value.element)],
      ["extent", record("FixedExtent", value.extent, ["length", value.extent.length], ["runtimeBase", value.extent.runtimeBase])]);
    case "shape": return record(value.kind, value, ["members", value.members.map(selected => member(selected))], ["indexes", value.indexes.map(selected => index(selected))],
      ["calls", value.calls.map(selected => reference("sig", selected))], ["constructs", value.constructs.map(selected => reference("sig", selected))]);
    case "callable": return record(value.kind, value, ["calls", value.calls.map(selected => reference("sig", selected))],
      ["constructs", value.constructs.map(selected => reference("sig", selected))]);
    case "declared": return record(value.kind, value, ["definition", reference("def", value.definition)],
      ["arguments", value.arguments.map(selected => reference("t", selected))], ["facet", value.facet],
      ["extent", value.extent === null ? null : record("FixedExtent", value.extent, ["length", value.extent.length], ["runtimeBase", value.extent.runtimeBase])]);
    case "construction-reference": return record(value.kind, value, ["definition", construction(value.definition)],
      ["arguments", value.arguments.map(selected => reference("t", selected))]);
    case "enum": return record(value.kind, value, ["definition", reference("def", value.definition)]);
    case "param": return record(value.kind, value, ["parameter", record("TypeParameterIdentity", value.parameter,
      ["owner", reference("def", value.parameter.owner)], ["index", value.parameter.index])]);
    case "self": return record(value.kind, value, ["owner", reference("def", value.owner)]);
    case "projection": {
      const projection = value.projection;
      return record(value.kind, value, ["source", reference("t", value.source)],
        ["projection", projection.kind === "awaited" ? record("awaited", projection)
          : record("component", projection, ["component", deferred(() => component(projection.component))])]);
    }
    case "open": return record(value.kind, value, ["group", reference("group", value.group)], ["variable", value.variable]);
  }
}

function isVector(value: TextValue | Token | Leave): value is readonly TextValue[] {
  return Array.isArray(value);
}

function hostNumber(value: number): string {
  return Object.is(value, -0) ? "-0" : value === Infinity ? "+Infinity" : String(value);
}

function render(value: TextValue): string {
  const output: string[] = [];
  const onPath = new Set<object>();
  let work: PrintWork | null = { value, path: null, next: null };
  const push = (selected: TextValue | Token | Leave, path: PrintPath | null): void => { work = { value: selected, path, next: work }; };
  while (work !== null) {
    const selected = work.value;
    const path = work.path;
    work = work.next;
    if (selected === null) output.push("null");
    else if (typeof selected === "string") {
      output.push(JSON.stringify(selected));
    }
    else if (typeof selected === "number") {
      output.push(hostNumber(selected));
    } else if (typeof selected === "bigint") {
      output.push(`${selected}n`);
    }
    else if (typeof selected === "boolean") output.push(String(selected));
    else if (isVector(selected)) {
      output.push("[");
      push({ kind: "token", text: "]" }, path);
      for (let position = selected.length - 1; position >= 0; position -= 1) {
        const element = selected[position];
        if (element === undefined) throw new Error("IR text arrays must be dense.");
        push(element, { parent: path, part: `[${position}]` });
        if (position > 0) push({ kind: "token", text: ", " }, path);
      }
    } else if (selected.kind === "token") output.push(selected.text);
    else if (selected.kind === "leave") onPath.delete(selected.source);
    else if (selected.kind === "reference") {
      output.push(`${selected.prefix}:${typeof selected.value === "string" ? JSON.stringify(selected.value) : hostNumber(selected.value)}`);
    }
    else if (selected.kind === "deferred") push(selected.read(), path);
    else {
      if (onPath.has(selected.source)) {
        const parts: string[] = [];
        for (let selected = path; selected !== null; selected = selected.parent) parts.push(selected.part);
        throw new TypeError(`Inline cycle at $${parts.reverse().join("")}`);
      }
      onPath.add(selected.source);
      output.push(`${selected.label}(`);
      push({ kind: "leave", source: selected.source }, path);
      push({ kind: "token", text: ")" }, path);
      let position = selected.fields.length;
      for (const field of [...selected.fields].reverse()) {
        push(field[1], { parent: path, part: `.${field[0]}` });
        push({ kind: "token", text: `${field[0]}=` }, path);
        position -= 1;
        if (position > 0) push({ kind: "token", text: ", " }, path);
      }
    }
  }
  return output.join("");
}

export function typeText(value: TypeTerm): string {
  return render(term(value));
}

export function signatureText(value: Signature | SignatureInput): string {
  return render(signature(value));
}

export function memberKeyText(value: MemberKey): string {
  return render(memberKey(value));
}

export function originText(value: MemberOrigin): string {
  return render(origin(value));
}

export const printTypes: PrintTypes = table => `${render(record("TypeTable", table,
  ["terms", table.terms.map(selected => term(selected))], ["signatures", table.signatures.map(selected => signature(selected))]))}\n`;

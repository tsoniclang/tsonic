import type { Cause, DiagnosticIdentity, UnitPosition, UnitRef, UnitRequest } from "../diag/contract.js";
import type { GroupId, KeyData, KeyRecord, ModuleId, NodeId, SourceNodeRef } from "../ids/contract.js";
import { decodeGroupId, encodeGroupId } from "../ids/index.js";
import type { Cursor, TextStep } from "./parse-values.js";
import { acceptText, arrayText, atomicText, choice, closeRecord, delimiter, fieldText, openRecord, readBigInt, readBoolean,
  invalid, readHostCode, readModuleId, readNodeId, readNumber, readString } from "./parse-values.js";
import { readSourceNodeRef } from "./parse-diagnostics.js";
import type { TextWork } from "./text-values.js";
import { boolean, deferred, field, identity, numeric, numericIdentity, record, sequence, text, textSourceNodeRef, token } from "./text-values.js";

function keyText(value: KeyData): TextWork {
  if (value === null) return record("KeyNull", []);
  if (typeof value === "string") return record("KeyString", [field("value", text(value))]);
  if (typeof value === "number") return record("KeyNumber", [field("value", numeric(value))]);
  if (typeof value === "boolean") return record("KeyBoolean", [field("value", boolean(value))]);
  if (typeof value === "bigint") return record("KeyBigint", [field("value", token(`${value}n`))]);
  if ("fields" in value) return deferred(value, () => record("KeyRecord", [field("fields", sequence(value.fields, entry => record("KeyField", [
    field("name", text(entry[0])), field("value", keyText(entry[1])),
  ])))]));
  return record("KeyArray", [field("values", sequence(value, keyText))]);
}

function positionText(value: UnitPosition): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "result": return record(value.kind, []);
      case "module-node": return record(value.kind, [field("module", identity("mod", value.module)), field("node", numericIdentity("n", value.node))]);
      case "source-node": return record(value.kind, [field("node", textSourceNodeRef(value.node))]);
      case "component": return record(value.kind, [field("path", sequence(value.path, keyText))]);
      case "inference-variable": return record(value.kind, [field("group", text(value.group)), field("variable", numeric(value.variable))]);
    }
  });
}

function unitText(value: UnitRef): TextWork {
  return deferred(value, () => record("UnitRef", [field("request", record("UnitRequest", [field("query", text(value.request.query)),
    field("key", keyText(value.request.key))])), field("position", positionText(value.position))]));
}

function identityText(value: DiagnosticIdentity): TextWork {
  return deferred(value, () => value.kind === "checker" ? record(value.kind, [field("module", identity("mod", value.diagnostic.module)),
    field("index", numeric(value.diagnostic.index))]) : record(value.kind, [field("unit", unitText(value.unit)), field("code", text(value.code))]));
}

export function textCause(value: Cause): TextWork {
  return deferred(value, () => value.kind === "unit" ? record(value.kind, [field("unit", unitText(value.unit))])
    : record(value.kind, [field("diagnostic", identityText(value.diagnostic))]));
}

function readKeyField<Root>(cursor: Cursor, finish: (value: readonly [string, KeyData]) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "KeyField"), fields => fieldText<string, Root>(cursor, fields, "name",
    (next, done) => atomicText(next, readString, done), name => fieldText<KeyData, Root>(cursor, fields, "value", readKey, value =>
      atomicText(cursor, next => closeRecord(next, fields), () => acceptText([name, value], finish)))));
}

function readKey<Root>(cursor: Cursor, finish: (value: KeyData) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["KeyNull", "KeyString", "KeyNumber", "KeyBoolean", "KeyBigint", "KeyRecord", "KeyArray"]), kind =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields = { given: new Set<string>() };
      const complete = (value: KeyData): TextStep<Root> => atomicText(cursor, next => closeRecord(next, fields), () => acceptText(value, finish));
      switch (kind) {
        case "KeyNull": return complete(null);
        case "KeyString": return fieldText<string, Root>(cursor, fields, "value", (next, done) => atomicText(next, readString, done), complete);
        case "KeyNumber": return fieldText<number, Root>(cursor, fields, "value", (next, done) => atomicText(next, readNumber, done), complete);
        case "KeyBoolean": return fieldText<boolean, Root>(cursor, fields, "value", (next, done) => atomicText(next, readBoolean, done), complete);
        case "KeyBigint": return fieldText<bigint, Root>(cursor, fields, "value", (next, done) => atomicText(next, readBigInt, done), complete);
        case "KeyRecord": return fieldText<KeyRecord["fields"], Root>(cursor, fields, "fields", (next, done) => arrayText(next, readKeyField, done),
          values => complete({ kind: "record", fields: values }));
        case "KeyArray": return fieldText<readonly KeyData[], Root>(cursor, fields, "values", (next, done) => arrayText(next, readKey, done), complete);
      }
    }));
}

function readRequest<Root>(cursor: Cursor, finish: (value: UnitRequest) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "UnitRequest"), fields => fieldText<string, Root>(cursor, fields, "query",
    (next, done) => atomicText(next, readString, done), query => fieldText<KeyData, Root>(cursor, fields, "key", readKey, key =>
      atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ query, key }, finish)))));
}

function readPosition<Root>(cursor: Cursor, finish: (value: UnitPosition) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["result", "module-node", "source-node", "component", "inference-variable"]), kind =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields = { given: new Set<string>() };
      const complete = (value: UnitPosition): TextStep<Root> => atomicText(cursor, next => closeRecord(next, fields), () => acceptText(value, finish));
      switch (kind) {
        case "result": return complete({ kind });
        case "module-node": return fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), module =>
          fieldText<NodeId, Root>(cursor, fields, "node", (next, done) => atomicText(next, readNodeId, done), node => complete({ kind, module, node })));
        case "source-node": return fieldText<SourceNodeRef, Root>(cursor, fields, "node", (next, done) => atomicText(next, readSourceNodeRef, done), node => complete({ kind, node }));
        case "component": return fieldText<readonly KeyData[], Root>(cursor, fields, "path", (next, done) => arrayText(next, readKey, done), path => complete({ kind, path }));
        case "inference-variable": return fieldText<GroupId, Root>(cursor, fields, "group", (next, done) => atomicText(next, current => {
          const text = readString(current);
          if (text.kind !== "parsed") return text;
          const decoded = decodeGroupId(text.value);
          return decoded.kind === "decoded" ? { kind: "parsed", value: encodeGroupId([decoded.value]) }
            : invalid(current, current.offset, ["canonical inference group"]);
        }, done), group =>
          fieldText<number, Root>(cursor, fields, "variable", (next, done) => atomicText(next, readNumber, done), variable => complete({ kind, group, variable })));
      }
    }));
}

function readUnit<Root>(cursor: Cursor, finish: (value: UnitRef) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "UnitRef"), fields => fieldText<UnitRequest, Root>(cursor, fields, "request", readRequest, request =>
    fieldText<UnitPosition, Root>(cursor, fields, "position", readPosition, position => atomicText(cursor, next => closeRecord(next, fields),
      () => acceptText({ request, position }, finish)))));
}

function readIdentity<Root>(cursor: Cursor, finish: (value: DiagnosticIdentity) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["checker", "host"]), kind => atomicText(cursor, next => delimiter(next, "("), () => {
    const fields = { given: new Set<string>() };
    if (kind === "checker") return fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), module =>
      fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), index => atomicText(cursor,
        next => closeRecord(next, fields), () => acceptText({ kind, diagnostic: { module, index } }, finish))));
    return fieldText<UnitRef, Root>(cursor, fields, "unit", readUnit, unit => fieldText<Extract<DiagnosticIdentity, { readonly kind: "host" }>["code"], Root>(
      cursor, fields, "code", (next, done) => atomicText(next, readHostCode, done), code => atomicText(cursor, next => closeRecord(next, fields),
        () => acceptText({ kind, unit, code }, finish))));
  }));
}

export function readCauseText<Root>(cursor: Cursor, finish: (value: Cause) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["diagnostic", "unit"]), kind => atomicText(cursor, next => delimiter(next, "("), () => {
    const fields = { given: new Set<string>() };
    if (kind === "unit") return fieldText<UnitRef, Root>(cursor, fields, "unit", readUnit, unit => atomicText(cursor, next => closeRecord(next, fields),
      () => acceptText({ kind, unit }, finish)));
    return fieldText<DiagnosticIdentity, Root>(cursor, fields, "diagnostic", readIdentity, diagnostic => atomicText(cursor, next => closeRecord(next, fields),
      () => acceptText({ kind, diagnostic }, finish)));
  }));
}

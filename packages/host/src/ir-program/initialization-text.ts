import type { TextParseResult } from "../diag/contract.js";
import type { ModuleStaticCellRef } from "../ir-facts/contract.js";
import type { ProgramInitialization, ResolvedExternalEntry } from "./contract.js";
import type { Cursor } from "./parse-values.js";
import { closeRecord, invalid, openRecord, readArray, readDefinitionId, readField, readModuleId, readNumber, readString } from "./parse-values.js";
import { readExecution } from "./parse-types.js";
import { textExecution } from "./text-types.js";
import type { TextWork } from "./text-values.js";
import { deferred, field, identity, numeric, record, sequence, text } from "./text-values.js";

function readStaticCell(cursor: Cursor): TextParseResult<ModuleStaticCellRef> {
  const opened = openRecord(cursor, "ModuleStaticCellRef");
  if (opened.kind === "invalid-text") return opened;
  const execution = readField(cursor, opened.value, "execution", readExecution);
  if (execution.kind === "invalid-text") return execution;
  const cell = readField(cursor, opened.value, "cell", readNumber);
  if (cell.kind === "invalid-text") return cell;
  if (!Number.isSafeInteger(cell.value) || cell.value < 0 || Object.is(cell.value, -0))
    return invalid(cursor, cursor.offset, ["nonnegative cell index"]);
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed",
    value: { owner: { kind: "summary", key: { kind: "body", execution: execution.value } }, cell: cell.value } };
}

function textStaticCell(value: ModuleStaticCellRef): TextWork {
  return deferred(value, () => record("ModuleStaticCellRef", [
    field("execution", textExecution(value.owner.key.execution)), field("cell", numeric(value.cell)),
  ]));
}

function readExternalEntry(cursor: Cursor): TextParseResult<ResolvedExternalEntry> {
  const opened = openRecord(cursor, "ResolvedExternalEntry");
  if (opened.kind === "invalid-text") return opened;
  const module = readField(cursor, opened.value, "module", readModuleId);
  if (module.kind === "invalid-text") return module;
  const name = readField(cursor, opened.value, "name", readString);
  if (name.kind === "invalid-text") return name;
  const definitions = readField(cursor, opened.value, "definitions", next => readArray(next, readDefinitionId));
  if (definitions.kind === "invalid-text") return definitions;
  const [first, ...rest] = definitions.value;
  if (first === undefined) return invalid(cursor, cursor.offset, ["nonempty declaration group"]);
  const storage = readField(cursor, opened.value, "storage", next => readArray(next, readStaticCell));
  if (storage.kind === "invalid-text") return storage;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed
    : { kind: "parsed", value: { module: module.value, name: name.value, definitions: [first, ...rest], storage: storage.value } };
}

export function readProgramInitialization(cursor: Cursor): TextParseResult<ProgramInitialization> {
  const opened = openRecord(cursor, "ProgramInitialization");
  if (opened.kind === "invalid-text") return opened;
  const entry = readField(cursor, opened.value, "entry", readModuleId);
  if (entry.kind === "invalid-text") return entry;
  const external = readField(cursor, opened.value, "external", next => readArray(next, readExternalEntry));
  if (external.kind === "invalid-text") return external;
  const modules = readField(cursor, opened.value, "modules", next => readArray(next, readExecution));
  if (modules.kind === "invalid-text") return modules;
  const entries = readField(cursor, opened.value, "entries", next => readArray(next, readExecution));
  if (entries.kind === "invalid-text") return entries;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed
    : { kind: "parsed", value: { entry: entry.value, external: external.value, modules: modules.value, entries: entries.value } };
}

export function textProgramInitialization(value: ProgramInitialization): TextWork {
  return deferred(value, () => record("ProgramInitialization", [
    field("entry", identity("mod", value.entry)),
    field("external", sequence(value.external, selection => deferred(selection, () => record("ResolvedExternalEntry", [
      field("module", identity("mod", selection.module)), field("name", text(selection.name)),
      field("definitions", sequence(selection.definitions, definition => identity("def", definition))),
      field("storage", sequence(selection.storage, textStaticCell)),
    ])))),
    field("modules", sequence(value.modules, textExecution)),
    field("entries", sequence(value.entries, textExecution)),
  ]));
}

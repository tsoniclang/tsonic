import type { CapturedFact, HirBindingTarget, HirExportTarget, HirModuleBinding, HirModuleExport } from "../ir-hir/contract.js";
import type { CheckerDiagnosticRef } from "../diag/contract.js";
import type { DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { Cursor, RecordFields, TextStep } from "./parse-values.js";
import { acceptText, arrayText, atomicText, choice, closeRecord, delimiter, fieldText, invalid, openRecord,
  readDefinitionId, readModuleId, readNumber, readString } from "./parse-values.js";
import { readSourceNodeRef } from "./parse-diagnostics.js";
import { readCapturedFactText } from "./parse-core.js";
import { readMemberKeyText, readMemberOriginText } from "./parse-types.js";
import type { TextWork } from "./text-values.js";
import { deferred, field, identity, numeric, record, sequence, text, textSourceNodeRef } from "./text-values.js";
import { textCapturedFact } from "./text-core.js";
import { textMemberKey, textMemberOrigin } from "./text-types.js";

export function textExportTarget(value: HirExportTarget): TextWork {
  return deferred(value, () => value.kind === "declarations"
    ? record(value.kind, [field("definitions", sequence(value.definitions, definition => identity("def", definition)))])
    : record(value.kind, [field("occurrence", textSourceNodeRef(value.occurrence))]));
}

function textBindingTarget(value: HirBindingTarget): TextWork {
  switch (value.kind) {
    case "declarations": case "binding": return textExportTarget(value);
    case "module": return deferred(value, () => record(value.kind, [field("module", identity("mod", value.module))]));
    case "member": return deferred(value, () => record(value.kind, [field("through", textExportTarget(value.through)),
      field("key", textCapturedFact(value.key, textMemberKey)), field("origins", textCapturedFact(value.origins, origins => sequence(origins, textMemberOrigin)))]));
    case "unresolved": return deferred(value, () => record(value.kind, [field("diagnostics", sequence(value.diagnostics, diagnostic =>
      deferred(diagnostic, () => record("CheckerDiagnosticRef", [field("module", identity("mod", diagnostic.module)), field("index", numeric(diagnostic.index))]))))]));
  }
}

export function textModuleExport(value: HirModuleExport): TextWork {
  return deferred(value, () => record("HirModuleExport", [field("name", text(value.name)), field("target", textExportTarget(value.target))]));
}

export function textModuleBinding(value: HirModuleBinding): TextWork {
  return deferred(value, () => record("HirModuleBinding", [field("occurrence", textSourceNodeRef(value.occurrence)),
    field("target", textCapturedFact(value.target, textBindingTarget))]));
}

function readDeclarationTarget<Root>(cursor: Cursor, fields: RecordFields,
  finish: (value: Extract<HirExportTarget, { readonly kind: "declarations" }>) => TextStep<Root>): TextStep<Root> {
  return fieldText<readonly DefId[], Root>(cursor, fields, "definitions", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), definitions => {
    const first = definitions[0];
    if (first === undefined) return { kind: "complete", result: invalid(cursor, cursor.offset, ["nonempty declaration group"]) };
    return atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind: "declarations", definitions: [first, ...definitions.slice(1)] }, finish));
  });
}

export function readExportTargetText<Root>(cursor: Cursor, finish: (value: HirExportTarget) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["declarations", "binding"]), kind =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set() };
      if (kind === "declarations") return readDeclarationTarget(cursor, fields, finish);
      return fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrence =>
        atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind, occurrence }, finish)));
    }));
}

function readCheckerDiagnosticText<Root>(cursor: Cursor, finish: (value: CheckerDiagnosticRef) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "CheckerDiagnosticRef"), fields =>
    fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), module =>
      fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), index =>
        atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ module, index }, finish)))));
}

function readBindingTargetText<Root>(cursor: Cursor, finish: (value: HirBindingTarget) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["declarations", "binding", "module", "member", "unresolved"]), kind =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set() };
      switch (kind) {
        case "declarations": return readDeclarationTarget(cursor, fields, finish);
        case "binding": return fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrence =>
          atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind, occurrence }, finish)));
        case "module": return fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), module =>
          atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind, module }, finish)));
        case "member": return fieldText<HirExportTarget, Root>(cursor, fields, "through", readExportTargetText, through =>
          fieldText<CapturedFact<MemberKey>, Root>(cursor, fields, "key", (next, done) => readCapturedFactText(next, readMemberKeyText, done), key =>
            fieldText<CapturedFact<readonly MemberOrigin[]>, Root>(cursor, fields, "origins", (next, done) => readCapturedFactText(next,
              (next, done) => arrayText(next, readMemberOriginText, done), done), origins =>
              atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind, through, key, origins }, finish)))));
        case "unresolved": return fieldText<readonly CheckerDiagnosticRef[], Root>(cursor, fields, "diagnostics",
          (next, done) => arrayText(next, readCheckerDiagnosticText, done), diagnostics => {
            const first = diagnostics[0];
            if (first === undefined) return { kind: "complete", result: invalid(cursor, cursor.offset, ["original checker diagnostic root"]) };
            return atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ kind, diagnostics: [first, ...diagnostics.slice(1)] }, finish));
          });
      }
    }));
}

export function readModuleExportText<Root>(cursor: Cursor, finish: (value: HirModuleExport) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirModuleExport"), fields =>
    fieldText<string, Root>(cursor, fields, "name", (next, done) => atomicText(next, readString, done), name =>
      fieldText<HirExportTarget, Root>(cursor, fields, "target", readExportTargetText, target =>
        atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ name, target }, finish)))));
}

export function readModuleBindingText<Root>(cursor: Cursor, finish: (value: HirModuleBinding) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirModuleBinding"), fields =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrence =>
      fieldText<CapturedFact<HirBindingTarget>, Root>(cursor, fields, "target", (next, done) => readCapturedFactText(next, readBindingTargetText, done), target =>
        atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ occurrence, target }, finish)))));
}

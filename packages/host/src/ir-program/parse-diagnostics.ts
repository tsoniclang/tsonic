import type { TextParseResult } from "../diag/contract.js";
import type { Origin, Derivation, SourceNodeRef, LocalRef, NodeRef, ItemNodeRef, LibraryModuleIdentity } from "../ids/contract.js";
import type { Diagnostic, DiagnosticCode, DiagnosticSite, MessageArgument, RelatedDiagnostic, DiagnosticFix, TextEdit } from "../diag/contract.js";
import type { Cursor, RecordFields } from "./parse-values.js";
import { choice, closeRecord, delimiter, readField, readString, readNumber, readBigInt, readStringChoice, readExpansionId, readHostCode, readModuleId, readArray, nullable, readBodyId, readDefinitionId, readNodeId, readLocalId } from "./parse-values.js";

export function readSourceNodeRef(cursor: Cursor): TextParseResult<SourceNodeRef> {
  const kind = choice(cursor, ["body","item"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "body": {
      const value = readField(cursor, fields, "value", readNodeRef);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
    case "item": {
      const value = readField(cursor, fields, "value", readItemNodeRef);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
  }
}

export function readLocalRef(cursor: Cursor): TextParseResult<LocalRef> {
  const kind = choice(cursor, ["LocalRef"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const body = readField(cursor, fields, "body", readBodyId);
  if (body.kind === "invalid-text") return body;
  const local = readField(cursor, fields, "local", readLocalId);
  if (local.kind === "invalid-text") return local;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    body: body.value, local: local.value
  } };
}

export function readNodeRef(cursor: Cursor): TextParseResult<NodeRef> {
  const kind = choice(cursor, ["NodeRef"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const body = readField(cursor, fields, "body", readBodyId);
  if (body.kind === "invalid-text") return body;
  const node = readField(cursor, fields, "node", readNodeId);
  if (node.kind === "invalid-text") return node;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    body: body.value, node: node.value
  } };
}

export function readItemNodeRef(cursor: Cursor): TextParseResult<ItemNodeRef> {
  const kind = choice(cursor, ["ItemNodeRef"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const owner = readField(cursor, fields, "owner", readDefinitionId);
  if (owner.kind === "invalid-text") return owner;
  const node = readField(cursor, fields, "node", readNodeId);
  if (node.kind === "invalid-text") return node;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    owner: owner.value, node: node.value
  } };
}

export function readLibraryModuleIdentity(cursor: Cursor): TextParseResult<LibraryModuleIdentity> {
  const kind = choice(cursor, ["LibraryModuleIdentity"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const providerId = readField(cursor, fields, "providerId", readString);
  if (providerId.kind === "invalid-text") return providerId;
  const providerVersion = readField(cursor, fields, "providerVersion", readString);
  if (providerVersion.kind === "invalid-text") return providerVersion;
  const packageName = readField(cursor, fields, "packageName", next => nullable(next, readString));
  if (packageName.kind === "invalid-text") return packageName;
  const moduleSpecifier = readField(cursor, fields, "moduleSpecifier", readString);
  if (moduleSpecifier.kind === "invalid-text") return moduleSpecifier;
  const providerModuleId = readField(cursor, fields, "providerModuleId", readString);
  if (providerModuleId.kind === "invalid-text") return providerModuleId;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    providerId: providerId.value, providerVersion: providerVersion.value, packageName: packageName.value, moduleSpecifier: moduleSpecifier.value, providerModuleId: providerModuleId.value
  } };
}

export function readDiagnostic(cursor: Cursor): TextParseResult<Diagnostic> {
  const kind = choice(cursor, ["Diagnostic"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const code = readField(cursor, fields, "code", readDiagnosticCode);
  if (code.kind === "invalid-text") return code;
  const severity = readField(cursor, fields, "severity", next => readStringChoice(next, ["error","warning","suggestion"]));
  if (severity.kind === "invalid-text") return severity;
  const site = readField(cursor, fields, "site", readDiagnosticSite);
  if (site.kind === "invalid-text") return site;
  const source = readField(cursor, fields, "source", next => nullable(next, readString));
  if (source.kind === "invalid-text") return source;
  const evidence = readField(cursor, fields, "evidence", next => readArray(next, readString));
  if (evidence.kind === "invalid-text") return evidence;
  const message = readField(cursor, fields, "message", readString);
  if (message.kind === "invalid-text") return message;
  const argumentsValue = readField(cursor, fields, "arguments", next => readArray(next, readMessageArgument));
  if (argumentsValue.kind === "invalid-text") return argumentsValue;
  const related = readField(cursor, fields, "related", next => readArray(next, readRelatedDiagnostic));
  if (related.kind === "invalid-text") return related;
  const fix = readField(cursor, fields, "fix", next => nullable(next, readDiagnosticFix));
  if (fix.kind === "invalid-text") return fix;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    code: code.value, severity: severity.value, site: site.value, source: source.value, evidence: evidence.value, message: message.value, arguments: argumentsValue.value, related: related.value, fix: fix.value
  } };
}

export function readOrigin(cursor: Cursor): TextParseResult<Origin> {
  const kind = choice(cursor, ["Origin"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const module = readField(cursor, fields, "module", readModuleId);
  if (module.kind === "invalid-text") return module;
  const start = readField(cursor, fields, "start", readNumber);
  if (start.kind === "invalid-text") return start;
  const length = readField(cursor, fields, "length", readNumber);
  if (length.kind === "invalid-text") return length;
  const derived = readField(cursor, fields, "derived", next => readArray(next, readDerivation));
  if (derived.kind === "invalid-text") return derived;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    module: module.value, start: start.value, length: length.value, derived: derived.value
  } };
}

export function readDerivation(cursor: Cursor): TextParseResult<Derivation> {
  const kind = choice(cursor, ["lowering","expansion"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "lowering": {
      const pass = readField(cursor, fields, "pass", next => readStringChoice(next, ["front","decls","infer","elaborate","validate","lower-mir","evaluate","metadata","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","summaries","pipeline"]));
      if (pass.kind === "invalid-text") return pass;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        pass: pass.value
      } };
    }
    case "expansion": {
      const expansion = readField(cursor, fields, "expansion", readExpansionId);
      if (expansion.kind === "invalid-text") return expansion;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        expansion: expansion.value
      } };
    }
  }
}

export function readDiagnosticCode(cursor: Cursor): TextParseResult<DiagnosticCode> {
  const kind = choice(cursor, ["host","checker","extension"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "host": {
      const name = readField(cursor, fields, "name", readHostCode);
      if (name.kind === "invalid-text") return name;
      const rendered = readField(cursor, fields, "rendered", readString);
      if (rendered.kind === "invalid-text") return rendered;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        name: name.value, rendered: rendered.value
      } };
    }
    case "checker": {
      const number = readField(cursor, fields, "number", readNumber);
      if (number.kind === "invalid-text") return number;
      const rendered = readField(cursor, fields, "rendered", readString);
      if (rendered.kind === "invalid-text") return rendered;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        number: number.value, rendered: rendered.value
      } };
    }
    case "extension": {
      const number = readField(cursor, fields, "number", readNumber);
      if (number.kind === "invalid-text") return number;
      const extensionCode = readField(cursor, fields, "extensionCode", readString);
      if (extensionCode.kind === "invalid-text") return extensionCode;
      const rendered = readField(cursor, fields, "rendered", readString);
      if (rendered.kind === "invalid-text") return rendered;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        number: number.value, extensionCode: extensionCode.value, rendered: rendered.value
      } };
    }
  }
}

export function readDiagnosticSite(cursor: Cursor): TextParseResult<DiagnosticSite> {
  const kind = choice(cursor, ["source","file","none"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "source": {
      const origin = readField(cursor, fields, "origin", readOrigin);
      if (origin.kind === "invalid-text") return origin;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        origin: origin.value
      } };
    }
    case "file": {
      const path = readField(cursor, fields, "path", readString);
      if (path.kind === "invalid-text") return path;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        path: path.value
      } };
    }
    case "none": {
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value } };
    }
  }
}

export function readMessageArgument(cursor: Cursor): TextParseResult<MessageArgument> {
  const kind = choice(cursor, ["text","integer","number","origin"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "text": {
      const value = readField(cursor, fields, "value", readString);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
    case "integer": {
      const value = readField(cursor, fields, "value", readBigInt);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
    case "number": {
      const value = readField(cursor, fields, "value", readNumber);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
    case "origin": {
      const value = readField(cursor, fields, "value", readOrigin);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        value: value.value
      } };
    }
  }
}

export function readRelatedDiagnostic(cursor: Cursor): TextParseResult<RelatedDiagnostic> {
  const kind = choice(cursor, ["RelatedDiagnostic"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const site = readField(cursor, fields, "site", readDiagnosticSite);
  if (site.kind === "invalid-text") return site;
  const code = readField(cursor, fields, "code", readDiagnosticCode);
  if (code.kind === "invalid-text") return code;
  const message = readField(cursor, fields, "message", readString);
  if (message.kind === "invalid-text") return message;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    site: site.value, code: code.value, message: message.value
  } };
}

export function readDiagnosticFix(cursor: Cursor): TextParseResult<DiagnosticFix> {
  const kind = choice(cursor, ["DiagnosticFix"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const description = readField(cursor, fields, "description", readString);
  if (description.kind === "invalid-text") return description;
  const edits = readField(cursor, fields, "edits", next => readArray(next, readTextEdit));
  if (edits.kind === "invalid-text") return edits;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    description: description.value, edits: edits.value
  } };
}

export function readTextEdit(cursor: Cursor): TextParseResult<TextEdit> {
  const kind = choice(cursor, ["TextEdit"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const origin = readField(cursor, fields, "origin", readOrigin);
  if (origin.kind === "invalid-text") return origin;
  const replacement = readField(cursor, fields, "replacement", readString);
  if (replacement.kind === "invalid-text") return replacement;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    origin: origin.value, replacement: replacement.value
  } };
}

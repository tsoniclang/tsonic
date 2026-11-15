import type { Cause, DiagnosticIdentity, UnitPosition, UnitRef, UnitRequest } from "../diag/contract.js";
import type { GroupId, KeyData, KeyRecord, SourceNodeRef } from "../ids/contract.js";
import { decodeGroupId, encodeGroupId } from "../ids/index.js";
import { lazyReader, scalarReader, sequenceReader } from "./text-construction.js";
import type { TirReader } from "./text-construction.js";
import type { TirRecordCodec, TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { referenceWork, scalarWork, sequenceWork, unionRecord } from "./text-layouts.js";

export function createCausesText(kernel: TirTextKernel, source: TirRecordCodec<SourceNodeRef>): TirRecordCodec<Cause> {
  const { defineRecord } = kernel;
  function scalar<Value extends string | number | bigint | boolean | null>(name: string, type: string, reader: TirReader<Value>): TirRecordCodec<{ readonly value: Value }> {
    return defineRecord<{ readonly value: Value }>(name, name, null, name, null, null, fields => fields
      .field("value", type, value => scalarWork(type, value.value), reader).finish(value => ({ value })));
  }
  const keyString = scalar("KeyString", "string", kernel.stringReader);
  const keyNumber = scalar("KeyNumber", "number", kernel.numberReader);
  const keyBoolean = scalar("KeyBoolean", "boolean", kernel.booleanReader);
  const keyBigint = scalar("KeyBigint", "bigint", kernel.bigintReader);
  const keyNull = defineRecord<object>("KeyNull", "KeyNull", null, "KeyNull", null, null, fields => fields.finish(() => ({})));
  const keyArray = defineRecord<{ readonly values: readonly KeyData[] }>("KeyArray", "KeyArray", null, "KeyArray", null, null, fields => fields
    .field("values", "[KeyData]", value => sequenceWork("[KeyData]", value.values, keyWork),
      sequenceReader("[KeyData]", lazyReader(() => keyReader)))
    .finish(values => ({ values })));
  const keyField = defineRecord<readonly [string, KeyData]>("KeyField", "KeyField", null, "KeyField", null, null, fields => fields
    .field("name", "string", value => scalarWork("string", value[0]), kernel.stringReader)
    .field("value", "KeyData", value => keyWork(value[1]), lazyReader(() => keyReader))
    .finish((name, value) => [name, value]));
  const keyRecord = defineRecord<KeyRecord>("KeyRecord", "KeyRecord", null, "KeyRecord", null, null, fields => fields
    .field("fields", "[KeyField]", value => sequenceWork("[KeyField]", value.fields, entry => keyField.write(entry)),
      sequenceReader("[KeyField]", keyField.reader))
    .finish(fields => ({ kind: "record", fields })));
  function keyWork(value: KeyData): TirTypedRecordWork {
    if (value === null) return keyNull.write({});
    if (typeof value === "string") return keyString.write({ value });
    if (typeof value === "number") return keyNumber.write({ value });
    if (typeof value === "boolean") return keyBoolean.write({ value });
    if (typeof value === "bigint") return keyBigint.write({ value });
    return "fields" in value ? keyRecord.write(value) : keyArray.write({ values: value });
  }
  const keyReader: TirReader<KeyData> = { literalSets: [], requests: accept => [
    ...keyNull.reader.requests(value => accept({ run: next => value.run(() => next(null)) })),
    ...keyString.reader.requests(value => accept({ run: next => value.run(actual => next(actual.value)) })),
    ...keyNumber.reader.requests(value => accept({ run: next => value.run(actual => next(actual.value)) })),
    ...keyBoolean.reader.requests(value => accept({ run: next => value.run(actual => next(actual.value)) })),
    ...keyBigint.reader.requests(value => accept({ run: next => value.run(actual => next(actual.value)) })),
    ...keyArray.reader.requests(value => accept({ run: next => value.run(actual => next(actual.values)) })),
    ...keyRecord.reader.requests(accept),
  ] };
  const request = defineRecord<UnitRequest>("UnitRequest", "UnitRequest", null, "UnitRequest", null, null, fields => fields
    .field("query", "string", value => scalarWork("string", value.query), kernel.stringReader)
    .field("key", "KeyData", value => keyWork(value.key), keyReader)
    .finish((query, key) => ({ query, key })));
  const result = defineRecord<Extract<UnitPosition, { readonly kind: "result" }>>("ResultPosition", "UnitPosition",
    { field: "kind", value: "result" }, "result", null, null, fields => fields.finish(() => ({ kind: "result" })));
  const moduleNode = defineRecord<Extract<UnitPosition, { readonly kind: "module-node" }>>("ModulePosition", "UnitPosition",
    { field: "kind", value: "module-node" }, "module-node", null, null, fields => fields
      .field("module", "mod", value => scalarWork("mod", value.module), kernel.moduleReader)
      .field("node", "n", value => referenceWork("n", value.node), kernel.nodeReader)
      .finish((module, node) => ({ kind: "module-node", module, node })));
  const sourceNode = defineRecord<Extract<UnitPosition, { readonly kind: "source-node" }>>("SourcePosition", "UnitPosition",
    { field: "kind", value: "source-node" }, "source-node", null, null, fields => fields
      .field("node", "SourceNodeRef", value => source.write(value.node), source.reader)
      .finish(node => ({ kind: "source-node", node })));
  const component = defineRecord<Extract<UnitPosition, { readonly kind: "component" }>>("ComponentPosition", "UnitPosition",
    { field: "kind", value: "component" }, "component", null, null, fields => fields
      .field("path", "[KeyData]", value => sequenceWork("[KeyData]", value.path, keyWork), sequenceReader("[KeyData]", keyReader))
      .finish(path => ({ kind: "component", path })));
  const variable = defineRecord<Extract<UnitPosition, { readonly kind: "inference-variable" }>>("VariablePosition", "UnitPosition",
    { field: "kind", value: "inference-variable" }, "inference-variable", null, null, fields => fields
      .field("group", "string", value => scalarWork("string", value.group), scalarReader<GroupId>("string", input => {
        if (typeof input !== "string") return null;
        const decoded = decodeGroupId(input);
        return decoded.kind === "decoded" ? { value: encodeGroupId([decoded.value]) } : null;
      }))
      .field("variable", "number", value => scalarWork("number", value.variable), kernel.numberReader)
      .finish((group, variable) => ({ kind: "inference-variable", group, variable })));
  const position = unionRecord<UnitPosition>("UnitPosition", value => {
    switch (value.kind) {
      case "result": return result.write(value);
      case "module-node": return moduleNode.write(value);
      case "source-node": return sourceNode.write(value);
      case "component": return component.write(value);
      case "inference-variable": return variable.write(value);
    }
  }, () => [result.reader, moduleNode.reader, sourceNode.reader, component.reader, variable.reader]);
  const unit = defineRecord<UnitRef>("UnitRef", "UnitRef", null, "UnitRef", null, null, fields => fields
    .field("request", "UnitRequest", value => request.write(value.request), request.reader)
    .field("position", "UnitPosition", value => position.write(value.position), position.reader)
    .finish((request, position) => ({ request, position })));
  const checker = defineRecord<Extract<DiagnosticIdentity, { readonly kind: "checker" }>>("CheckerIdentity", "DiagnosticIdentity",
    { field: "kind", value: "checker" }, "checker", null, null, fields => fields
      .field("module", "mod", value => scalarWork("mod", value.diagnostic.module), kernel.moduleReader)
      .field("index", "number", value => scalarWork("number", value.diagnostic.index), kernel.numberReader)
      .finish((module, index) => ({ kind: "checker", diagnostic: { module, index } })));
  const host = defineRecord<Extract<DiagnosticIdentity, { readonly kind: "host" }>>("HostIdentity", "DiagnosticIdentity",
    { field: "kind", value: "host" }, "host", null, null, fields => fields
      .field("unit", "UnitRef", value => unit.write(value.unit), unit.reader)
      .field("code", "HostDiagnosticCode", value => scalarWork("HostDiagnosticCode", value.code), kernel.diagnosticCodeReader)
      .finish((unit, code) => ({ kind: "host", unit, code })));
  const identity = unionRecord<DiagnosticIdentity>("DiagnosticIdentity", value => value.kind === "checker"
    ? checker.write(value) : host.write(value), () => [checker.reader, host.reader]);
  const diagnostic = defineRecord<Extract<Cause, { readonly kind: "diagnostic" }>>("DiagnosticCause", "Cause",
    { field: "kind", value: "diagnostic" }, "diagnostic", null, null, fields => fields
      .field("diagnostic", "DiagnosticIdentity", value => identity.write(value.diagnostic), identity.reader)
      .finish(diagnostic => ({ kind: "diagnostic", diagnostic })));
  const dependency = defineRecord<Extract<Cause, { readonly kind: "unit" }>>("UnitCause", "Cause",
    { field: "kind", value: "unit" }, "unit", null, null, fields => fields
      .field("unit", "UnitRef", value => unit.write(value.unit), unit.reader)
      .finish(unit => ({ kind: "unit", unit })));
  return unionRecord<Cause>("Cause", value => value.kind === "unit" ? dependency.write(value)
    : diagnostic.write(value), () => [diagnostic.reader, dependency.reader]);
}

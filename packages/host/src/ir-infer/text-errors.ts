import type { Cause, DiagnosticIdentity, ErrorValue, UnitPosition, UnitRef, UnitRequest } from "../diag/contract.js";
import type { KeyData, KeyRecord } from "../ids/contract.js";
import type { InferenceValue } from "./contract.js";
import type { DataSchemas, RecordSchema, Schema } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import { arraySchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";

export interface ErrorSchemas {
  readonly errorSchema: RecordSchema<ErrorValue>;
  readonly inferenceValueSchema: RecordSchema<InferenceValue>;
}

function keyScalar<Value extends number | string | bigint | boolean>(label: string, schema: Schema<Value>): RecordSchema<Value> {
  const boxed = recordSchema<{ readonly value: Value }>(label, label, read => {
    const value = read("value", () => schema, entry => entry.value);
    return { fields: [value], value: () => ({ value: value.value() }) };
  });
  return { name: label, shape: boxed.shape, reader: receive => boxed.reader(entry => receive(entry.value)),
    stage: value => boxed.stage({ value }) };
}

export function createErrorSchemas(data: DataSchemas, evidence: EvidenceSchemas): ErrorSchemas {
  const { numberSchema, stringSchema, bigintSchema, booleanSchema, groupSchema, modSchema, nSchema,
    sourceNodeRefSchema, hostCodeNameSchema } = data;
  const keyNumber = keyScalar("KeyNumber", numberSchema);
  const keyString = keyScalar("KeyString", stringSchema);
  const keyBigint = keyScalar("KeyBigint", bigintSchema);
  const keyBoolean = keyScalar("KeyBoolean", booleanSchema);
  const nullRecord = recordSchema<object>("KeyNull", "KeyNull", () => ({ fields: [], value: () => ({}) }));
  const keyNull: RecordSchema<null> = { name: "KeyNull", shape: nullRecord.shape,
    reader: receive => nullRecord.reader(() => receive(null)), stage: () => nullRecord.stage({}) };
  const arrayRecord = recordSchema<{ readonly values: readonly KeyData[] }>("KeyArray", "KeyArray", read => {
    const values = read("values", () => arraySchema(keySchema), entry => entry.values);
    return { fields: [values], value: () => ({ values: values.value() }) };
  });
  const keyArray: RecordSchema<readonly KeyData[]> = { name: "KeyArray", shape: arrayRecord.shape,
    reader: receive => arrayRecord.reader(entry => receive(entry.values)), stage: values => arrayRecord.stage({ values }) };
  const field = recordSchema<readonly [string, KeyData]>("KeyField", "KeyField", read => {
    const name = read("name", () => stringSchema, entry => entry[0]);
    const value = read("value", () => keySchema, entry => entry[1]);
    return { fields: [name, value], value: () => [name.value(), value.value()] };
  });
  const keyRecord = recordSchema<KeyRecord>("KeyRecord", "KeyRecord", read => {
    const fields = read("fields", () => arraySchema(field), entry => entry.fields);
    return { fields: [fields], value: () => ({ kind: "record", fields: fields.value() }) };
  });
  const keySchema: RecordSchema<KeyData> = unionSchema<KeyData>("KeyData",
    () => [keyNull, keyNumber, keyString, keyBigint, keyBoolean, keyArray, keyRecord], value => {
      if (value === null) return keyNull.stage(value);
      if (typeof value === "number") return keyNumber.stage(value);
      if (typeof value === "string") return keyString.stage(value);
      if (typeof value === "bigint") return keyBigint.stage(value);
      if (typeof value === "boolean") return keyBoolean.stage(value);
      if ("kind" in value) return keyRecord.stage(value);
      return keyArray.stage(value);
    });
  const request = recordSchema<UnitRequest>("UnitRequest", "UnitRequest", read => {
    const query = read("query", () => stringSchema, entry => entry.query);
    const key = read("key", () => keySchema, entry => entry.key);
    return { fields: [query, key], value: () => ({ query: query.value(), key: key.value() }) };
  });
  const result = recordSchema<Extract<UnitPosition, { readonly kind: "result" }>>("ResultPosition", "result", () =>
    ({ fields: [], value: () => ({ kind: "result" }) }));
  const moduleNode = recordSchema<Extract<UnitPosition, { readonly kind: "module-node" }>>("ModulePosition", "module-node", read => {
    const module = read("module", () => modSchema, entry => entry.module);
    const node = read("node", () => nSchema, entry => entry.node);
    return { fields: [module, node], value: () => ({ kind: "module-node", module: module.value(), node: node.value() }) };
  });
  const sourceNode = recordSchema<Extract<UnitPosition, { readonly kind: "source-node" }>>("SourcePosition", "source-node", read => {
    const node = read("node", () => sourceNodeRefSchema, entry => entry.node);
    return { fields: [node], value: () => ({ kind: "source-node", node: node.value() }) };
  });
  const variable = recordSchema<Extract<UnitPosition, { readonly kind: "inference-variable" }>>("VariablePosition", "inference-variable", read => {
    const group = read("group", () => groupSchema, entry => entry.group);
    const variable = read("variable", () => numberSchema, entry => entry.variable);
    return { fields: [group, variable], value: () => ({ kind: "inference-variable", group: group.value(), variable: variable.value() }) };
  });
  const component = recordSchema<Extract<UnitPosition, { readonly kind: "component" }>>("ComponentPosition", "component", read => {
    const path = read("path", () => arraySchema(keySchema), entry => entry.path);
    return { fields: [path], value: () => ({ kind: "component", path: path.value() }) };
  });
  const position: RecordSchema<UnitPosition> = unionSchema<UnitPosition>("UnitPosition", () => [result, moduleNode, sourceNode, variable, component], value => {
    switch (value.kind) {
      case "result": return result.stage(value);
      case "module-node": return moduleNode.stage(value);
      case "source-node": return sourceNode.stage(value);
      case "inference-variable": return variable.stage(value);
      case "component": return component.stage(value);
    }
  });
  const unit = recordSchema<UnitRef>("UnitRef", "UnitRef", read => {
    const requested = read("request", () => request, entry => entry.request);
    const at = read("position", () => position, entry => entry.position);
    return { fields: [requested, at], value: () => ({ request: requested.value(), position: at.value() }) };
  });
  const checker = recordSchema<Extract<DiagnosticIdentity, { readonly kind: "checker" }>>("CheckerIdentity", "checker", read => {
    const module = read("module", () => modSchema, entry => entry.diagnostic.module);
    const index = read("index", () => numberSchema, entry => entry.diagnostic.index);
    return { fields: [module, index], value: () => ({ kind: "checker", diagnostic: { module: module.value(), index: index.value() } }) };
  });
  const host = recordSchema<Extract<DiagnosticIdentity, { readonly kind: "host" }>>("HostIdentity", "host", read => {
    const origin = read("unit", () => unit, entry => entry.unit);
    const code = read("code", () => hostCodeNameSchema, entry => entry.code);
    return { fields: [origin, code], value: () => ({ kind: "host", unit: origin.value(), code: code.value() }) };
  });
  const identity: RecordSchema<DiagnosticIdentity> = unionSchema<DiagnosticIdentity>("DiagnosticIdentity", () => [checker, host], value =>
    value.kind === "checker" ? checker.stage(value) : host.stage(value));
  const diagnostic = recordSchema<Extract<Cause, { readonly kind: "diagnostic" }>>("DiagnosticCause", "diagnostic", read => {
    const origin = read("diagnostic", () => identity, entry => entry.diagnostic);
    return { fields: [origin], value: () => ({ kind: "diagnostic", diagnostic: origin.value() }) };
  });
  const absorbed = recordSchema<Extract<Cause, { readonly kind: "unit" }>>("UnitCause", "unit", read => {
    const origin = read("unit", () => unit, entry => entry.unit);
    return { fields: [origin], value: () => ({ kind: "unit", unit: origin.value() }) };
  });
  const cause: RecordSchema<Cause> = unionSchema<Cause>("Cause", () => [diagnostic, absorbed], value =>
    value.kind === "diagnostic" ? diagnostic.stage(value) : absorbed.stage(value));
  const tail = arraySchema(cause);
  const additional: Schema<readonly Cause[]> = { ...tail,
    stage: causes => ({ kind: "array", source: causes, length: causes.length - 1, read: index => {
      const next = causes[index + 1];
      return next === undefined ? undefined : cause.stage(next);
    } }) };
  const errorSchema = recordSchema<ErrorValue>("ErrorValue", "ErrorValue", read => {
    const first = read("first", () => cause, entry => entry.causes[0]);
    const rest = read("rest", () => additional, entry => entry.causes);
    return { fields: [first, rest], value: () => ({ kind: "error", causes: [first.value(), ...rest.value()] }) };
  });
  const inferenceValueSchema = recordSchema<InferenceValue>("InferenceValue", "InferenceValue", read => {
    const value = read("value", () => evidence.typeEvidenceSchema, entry => entry.value);
    const error = read("error", () => nullableSchema(errorSchema), entry => entry.error);
    return { fields: [value, error], value: () => ({ value: value.value(), error: error.value() }) };
  });
  return { errorSchema, inferenceValueSchema };
}

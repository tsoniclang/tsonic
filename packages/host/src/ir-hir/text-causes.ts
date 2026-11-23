import type { Cause, DiagnosticIdentity, UnitPosition, UnitRef, UnitRequest } from "../diag/contract.js";
import type { GroupId, KeyData, KeyRecord, SourceNodeRef } from "../ids/contract.js";
import { decodeGroupId, encodeGroupId } from "../ids/index.js";
import type { HirDataWork } from "./walk.js";
import { hirArrayData, hirFieldData, hirIdentityData, hirNodeRefData, hirRecordData, hirScalarData, hirSourceRefData } from "./walk.js";
import type { HirReader } from "./text-construction.js";
import { constructionValue, recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";

function keyData(value: KeyData): HirDataWork {
  if (value === null || typeof value !== "object") return hirScalarData(value);
  if ("fields" in value) return hirRecordData("KeyRecord", value, () => [hirFieldData("fields", hirArrayData(value.fields, entry =>
    hirRecordData("KeyField", entry, () => [hirFieldData("name", hirScalarData(entry[0])), hirFieldData("value", keyData(entry[1]))])))]);
  return hirArrayData(value, keyData);
}

function requestData(value: UnitRequest): HirDataWork {
  return hirRecordData("UnitRequest", value, () => [hirFieldData("query", hirScalarData(value.query)), hirFieldData("key", keyData(value.key))]);
}

function positionData(value: UnitPosition): HirDataWork {
  return hirRecordData(value.kind, value, () => {
    switch (value.kind) {
      case "result": return [];
      case "module-node": return [hirFieldData("module", hirIdentityData("mod", value.module)), hirFieldData("node", hirIdentityData("n", value.node))];
      case "source-node": return [hirFieldData("node", hirSourceRefData(value.node))];
      case "execution-result": return [hirFieldData("execution", hirScalarData(value.execution))];
      case "execution-source-node": return [hirFieldData("execution", hirScalarData(value.execution)), hirFieldData("node", hirNodeRefData(value.node))];
      case "component": return [hirFieldData("path", hirArrayData(value.path, keyData))];
      case "inference-variable": return [hirFieldData("group", hirScalarData(value.group)), hirFieldData("variable", hirScalarData(value.variable))];
    }
  });
}

function unitData(value: UnitRef): HirDataWork {
  return hirRecordData("UnitRef", value, () => [hirFieldData("request", requestData(value.request)), hirFieldData("position", positionData(value.position))]);
}

function identityData(value: DiagnosticIdentity): HirDataWork {
  if (value.kind === "checker") return hirRecordData(value.kind, value, () => [
    hirFieldData("module", hirIdentityData("mod", value.diagnostic.module)), hirFieldData("index", hirScalarData(value.diagnostic.index)),
  ], { kind: "CheckerDiagnosticRef", value: value.diagnostic });
  return hirRecordData(value.kind, value, () => [hirFieldData("unit", unitData(value.unit)), hirFieldData("code", hirScalarData(value.code))]);
}

export function causeData(value: Cause): HirDataWork {
  return hirRecordData(value.kind, value, () => value.kind === "unit"
    ? [hirFieldData("unit", unitData(value.unit))] : [hirFieldData("diagnostic", identityData(value.diagnostic))]);
}

export function createCauseReader(readers: () => HirTextReaders): HirReader<Cause> {
  const key: HirReader<KeyData> = unionReader<KeyData>(() => [readers().scalar_string, readers().scalar_number, readers().scalar_boolean,
    readers().scalar_bigint, readers().scalar_null, sequenceReader(key), keyRecord]);
  const keyField = recordReader<readonly [string, KeyData]>("KeyField", read => {
    const name = read("name", readers().scalar_string);
    const value = read("value", key);
    return { fields: [name, value], value: (): readonly [string, KeyData] => [name.value(), value.value()] };
  });
  const keyRecord = recordReader<KeyRecord>("KeyRecord", read => {
    const fields = read("fields", sequenceReader(keyField));
    return { fields: [fields], value: () => ({ kind: "record", fields: fields.value() }) };
  });
  const request = recordReader<UnitRequest>("UnitRequest", read => {
    const query = read("query", readers().scalar_string);
    const value = read("key", key);
    return { fields: [query, value], value: () => ({ query: query.value(), key: value.value() }) };
  });
  const result = recordReader<Extract<UnitPosition, { readonly kind: "result" }>>("result", () => ({ fields: [], value: () => ({ kind: "result" }) }));
  const moduleNode = recordReader<Extract<UnitPosition, { readonly kind: "module-node" }>>("module-node", read => {
    const module = read("module", readers().identity_mod); const node = read("node", readers().identity_n);
    return { fields: [module, node], value: () => ({ kind: "module-node", module: module.value(), node: node.value() }) };
  });
  const sourceNode = recordReader<Extract<UnitPosition, { readonly kind: "source-node" }>>("source-node", read => {
    const node = read("node", unionReader<SourceNodeRef>(() => [readers().record_5, readers().record_7]));
    return { fields: [node], value: () => ({ kind: "source-node", node: node.value() }) };
  });
  const executionResult = recordReader<Extract<UnitPosition, { readonly kind: "execution-result" }>>("execution-result", read => {
    const execution = read("execution", readers().scalar_string);
    return { fields: [execution], value: () => ({ kind: "execution-result", execution: execution.value() }) };
  });
  const executionNode = recordReader<Extract<UnitPosition, { readonly kind: "execution-source-node" }>>("execution-source-node", read => {
    const execution = read("execution", readers().scalar_string);
    const node = read("node", readers().record_6);
    return { fields: [execution, node], value: () => ({ kind: "execution-source-node", execution: execution.value(), node: node.value() }) };
  });
  const component = recordReader<Extract<UnitPosition, { readonly kind: "component" }>>("component", read => {
    const path = read("path", sequenceReader(key));
    return { fields: [path], value: () => ({ kind: "component", path: path.value() }) };
  });
  const groupReader: HirReader<GroupId> = { requests: accept => [{ kind: "string", read: value => {
    const decoded = decodeGroupId(value);
    if (decoded.kind === "decoded") accept(constructionValue(encodeGroupId([decoded.value])));
  } }] };
  const variable = recordReader<Extract<UnitPosition, { readonly kind: "inference-variable" }>>("inference-variable", read => {
    const group = read("group", groupReader);
    const variable = read("variable", readers().scalar_number);
    return { fields: [group, variable], value: () => ({ kind: "inference-variable", group: group.value(), variable: variable.value() }) };
  });
  const position = unionReader<UnitPosition>(() => [result, moduleNode, sourceNode, executionResult, executionNode, component, variable]);
  const unit = recordReader<UnitRef>("UnitRef", read => {
    const actual = read("request", request); const at = read("position", position);
    return { fields: [actual, at], value: () => ({ request: actual.value(), position: at.value() }) };
  });
  const checker = recordReader<Extract<DiagnosticIdentity, { readonly kind: "checker" }>>("checker", read => {
    const module = read("module", readers().identity_mod); const index = read("index", readers().scalar_number);
    return { fields: [module, index], value: () => ({ kind: "checker", diagnostic: { module: module.value(), index: index.value() } }) };
  });
  const host = recordReader<Extract<DiagnosticIdentity, { readonly kind: "host" }>>("host", read => {
    const actual = read("unit", unit); const code = read("code", readers().scalar_diagnostic);
    return { fields: [actual, code], value: () => ({ kind: "host", unit: actual.value(), code: code.value() }) };
  });
  const diagnostic = recordReader<Extract<Cause, { readonly kind: "diagnostic" }>>("diagnostic", read => {
    const identity = read("diagnostic", unionReader<DiagnosticIdentity>(() => [checker, host]));
    return { fields: [identity], value: () => ({ kind: "diagnostic", diagnostic: identity.value() }) };
  });
  const dependency = recordReader<Extract<Cause, { readonly kind: "unit" }>>("unit", read => {
    const actual = read("unit", unit);
    return { fields: [actual], value: () => ({ kind: "unit", unit: actual.value() }) };
  });
  return unionReader<Cause>(() => [diagnostic, dependency]);
}

import type { bool, byte } from "@tsonic/core/types.js";
import type { GoError, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { NewOrderedMapWithSizeHint, OrderedMap_Set } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { NewSetWithSizeHint, Set_Add } from "../collections/set.js";
import type { Set } from "../collections/set.js";
import { AllowDuplicateNames, Unmarshal } from "../json/json.js";
import { Expected_GetValue } from "./expected.js";
import type { Expected } from "./expected.js";
import type { ExportsOrImports } from "./exportsorimports.js";
import { JSONValueTypeArray, JSONValueTypeBoolean, JSONValueTypeNotPresent, JSONValueTypeNull, JSONValueTypeNumber, JSONValueTypeObject, JSONValueTypeString } from "./jsonvalue.js";
import type { JSONValue, JSONValueType } from "./jsonvalue.js";
import { objectKindUnknown } from "./exportsorimports.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::type::HeaderFields","kind":"type","status":"implemented","sigHash":"6558504c2fd9f243450ea189f22d05ceb3b0e27a987c4c06e2a16703307569ff","bodyHash":"53b0a2eea4b006f3eb6b5358b44a248fb246d2ee70f900c64dd96a8aacd569ee"}
 *
 * Go source:
 * HeaderFields struct {
 * 	Name    Expected[string] `json:"name"`
 * 	Version Expected[string] `json:"version"`
 * 	Type    Expected[string] `json:"type"`
 * }
 */
export interface HeaderFields {
  Name: Expected<string>;
  Version: Expected<string>;
  Type: Expected<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::type::PathFields","kind":"type","status":"implemented","sigHash":"b6ff792acf7ce424b67cb3471cc4058a50087e75a054c4b570caeebcf09f6826","bodyHash":"bb4571732db48e0078e3bb1a2e7fb90f929764c31df44dc5248ff205fe235001"}
 *
 * Go source:
 * PathFields struct {
 * 	TSConfig      Expected[string] `json:"tsconfig"`
 * 	Main          Expected[string] `json:"main"`
 * 	Types         Expected[string] `json:"types"`
 * 	Typings       Expected[string] `json:"typings"`
 * 	TypesVersions JSONValue        `json:"typesVersions"`
 * 	Imports       ExportsOrImports `json:"imports"`
 * 	Exports       ExportsOrImports `json:"exports"`
 * }
 */
export interface PathFields {
  TSConfig: Expected<string>;
  Main: Expected<string>;
  Types: Expected<string>;
  Typings: Expected<string>;
  TypesVersions: JSONValue;
  Imports: ExportsOrImports;
  Exports: ExportsOrImports;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::type::DependencyFields","kind":"type","status":"implemented","sigHash":"3ef5e9d174e2b24601466fcdfce76ae5cc24cf3e77a984764fa4f4222c6766ea","bodyHash":"b6f01b351f12cdbcd6b15f041f7df48778d8dac5a9fa8b5206ac232f4f194fe1"}
 *
 * Go source:
 * DependencyFields struct {
 * 	Dependencies         Expected[map[string]string] `json:"dependencies"`
 * 	DevDependencies      Expected[map[string]string] `json:"devDependencies"`
 * 	PeerDependencies     Expected[map[string]string] `json:"peerDependencies"`
 * 	OptionalDependencies Expected[map[string]string] `json:"optionalDependencies"`
 * }
 */
export interface DependencyFields {
  Dependencies: Expected<GoMap<string, string>>;
  DevDependencies: Expected<GoMap<string, string>>;
  PeerDependencies: Expected<GoMap<string, string>>;
  OptionalDependencies: Expected<GoMap<string, string>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::method::DependencyFields.HasDependency","kind":"method","status":"implemented","sigHash":"6ee04c0f2499ce3c35a63e9efba1454b7a2109d17d30be4edc87e38b69cc7507","bodyHash":"906a190f1a5a1aa008ec0ecfe50149df2229e5dd28a1089ee7284005fb22e03b"}
 *
 * Go source:
 * func (df *DependencyFields) HasDependency(name string) bool {
 * 	if deps, ok := df.Dependencies.GetValue(); ok {
 * 		if _, ok := deps[name]; ok {
 * 			return true
 * 		}
 * 	}
 * 	if devDeps, ok := df.DevDependencies.GetValue(); ok {
 * 		if _, ok := devDeps[name]; ok {
 * 			return true
 * 		}
 * 	}
 * 	if peerDeps, ok := df.PeerDependencies.GetValue(); ok {
 * 		if _, ok := peerDeps[name]; ok {
 * 			return true
 * 		}
 * 	}
 * 	if optDeps, ok := df.OptionalDependencies.GetValue(); ok {
 * 		if _, ok := optDeps[name]; ok {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function DependencyFields_HasDependency(receiver: GoPtr<DependencyFields>, name: string): bool {
  const [deps, depsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.Dependencies);
  if (depsOk && deps.has(name)) {
    return true;
  }
  const [devDeps, devDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.DevDependencies);
  if (devDepsOk && devDeps.has(name)) {
    return true;
  }
  const [peerDeps, peerDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.PeerDependencies);
  if (peerDepsOk && peerDeps.has(name)) {
    return true;
  }
  const [optDeps, optDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.OptionalDependencies);
  if (optDepsOk && optDeps.has(name)) {
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::method::DependencyFields.RangeDependencies","kind":"method","status":"implemented","sigHash":"3e2999e702b551a2564f69f51a687f69eb3e72fbd88a047c264202a57c47abfa","bodyHash":"cb66b7d018bf3d4ffb1e15aecd8e1e3ee4794185b407e74e407424a5284f66c7"}
 *
 * Go source:
 * func (df *DependencyFields) RangeDependencies(f func(name, version, dependencyField string) bool) {
 * 	if deps, ok := df.Dependencies.GetValue(); ok {
 * 		for name, version := range deps {
 * 			if !f(name, version, "dependencies") {
 * 				return
 * 			}
 * 		}
 * 	}
 * 	if devDeps, ok := df.DevDependencies.GetValue(); ok {
 * 		for name, version := range devDeps {
 * 			if !f(name, version, "devDependencies") {
 * 				return
 * 			}
 * 		}
 * 	}
 * 	if peerDeps, ok := df.PeerDependencies.GetValue(); ok {
 * 		for name, version := range peerDeps {
 * 			if !f(name, version, "peerDependencies") {
 * 				return
 * 			}
 * 		}
 * 	}
 * 	if optDeps, ok := df.OptionalDependencies.GetValue(); ok {
 * 		for name, version := range optDeps {
 * 			if !f(name, version, "optionalDependencies") {
 * 				return
 * 			}
 * 		}
 * 	}
 * }
 */
export function DependencyFields_RangeDependencies(receiver: GoPtr<DependencyFields>, f: (name: string, version: string, dependencyField: string) => bool): void {
  const [deps, depsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.Dependencies);
  if (depsOk) {
    for (const [name, version] of deps) {
      if (!f(name, version, "dependencies")) {
        return;
      }
    }
  }
  const [devDeps, devDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.DevDependencies);
  if (devDepsOk) {
    for (const [name, version] of devDeps) {
      if (!f(name, version, "devDependencies")) {
        return;
      }
    }
  }
  const [peerDeps, peerDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.PeerDependencies);
  if (peerDepsOk) {
    for (const [name, version] of peerDeps) {
      if (!f(name, version, "peerDependencies")) {
        return;
      }
    }
  }
  const [optDeps, optDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.OptionalDependencies);
  if (optDepsOk) {
    for (const [name, version] of optDeps) {
      if (!f(name, version, "optionalDependencies")) {
        return;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::method::DependencyFields.GetRuntimeDependencyNames","kind":"method","status":"implemented","sigHash":"78f5048058b002df283b649e5c3fc1b56dec075de8f7caf8eda15b572f46affd","bodyHash":"f4961e8f86f3d920fb022cc7f04a089e2a739954c8c909ed5096db81c9256a60"}
 *
 * Go source:
 * func (df *DependencyFields) GetRuntimeDependencyNames() *collections.Set[string] {
 * 	var count int
 * 	deps, _ := df.Dependencies.GetValue()
 * 	count += len(deps)
 * 	peerDeps, _ := df.PeerDependencies.GetValue()
 * 	count += len(peerDeps)
 * 	optDeps, _ := df.OptionalDependencies.GetValue()
 * 	count += len(optDeps)
 * 	names := collections.NewSetWithSizeHint[string](count)
 * 	for name := range deps {
 * 		names.Add(name)
 * 	}
 * 	for name := range peerDeps {
 * 		names.Add(name)
 * 	}
 * 	for name := range optDeps {
 * 		names.Add(name)
 * 	}
 * 	return names
 * }
 */
export function DependencyFields_GetRuntimeDependencyNames(receiver: GoPtr<DependencyFields>): GoPtr<Set> {
  const [deps, depsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.Dependencies);
  const [peerDeps, peerDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.PeerDependencies);
  const [optDeps, optDepsOk] = Expected_GetValue<GoMap<string, string>>(receiver!.OptionalDependencies);
  const count = (depsOk ? deps.size : 0) + (peerDepsOk ? peerDeps.size : 0) + (optDepsOk ? optDeps.size : 0);
  const names = NewSetWithSizeHint<string>(count);
  if (depsOk) {
    for (const name of deps.keys()) {
      Set_Add(names, name);
    }
  }
  if (peerDepsOk) {
    for (const name of peerDeps.keys()) {
      Set_Add(names, name);
    }
  }
  if (optDepsOk) {
    for (const name of optDeps.keys()) {
      Set_Add(names, name);
    }
  }
  return names;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::type::Fields","kind":"type","status":"implemented","sigHash":"07b7331f58005d91aa00ef0dc8b73696c8b48b2261c6396262880ed6e41bf3de","bodyHash":"3b407cb3d92da19d9b9f6ba909084f10a1bbc29e24c5a86304e6af6a19886035"}
 *
 * Go source:
 * Fields struct {
 * 	HeaderFields
 * 	PathFields
 * 	DependencyFields
 * }
 */
export interface Fields {
  readonly __tsgoEmbedded0?: HeaderFields;
  readonly __tsgoEmbedded1?: PathFields;
  readonly __tsgoEmbedded2?: DependencyFields;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/packagejson.go::func::Parse","kind":"func","status":"implemented","sigHash":"4c992a9162975647c2c2d8ab3d90f1b0489695032a2311c82949afc07c4e45d3","bodyHash":"fa47abb81da5366c35b09cf693a9e82c424f521ee3c68a5f2b256a297aa43b12"}
 *
 * Go source:
 * func Parse(data []byte) (Fields, error) {
 * 	var f Fields
 * 	if err := json.Unmarshal(data, &f, json.AllowDuplicateNames(true)); err != nil {
 * 		return Fields{}, err
 * 	}
 * 	return f, nil
 * }
 */
export function Parse(data: GoSlice<byte>): [Fields, GoError] {
  const f: Fields = {};
  const err = Unmarshal(data, f, AllowDuplicateNames(true));
  if (err !== undefined) {
    return [{}, err];
  }
  try {
    return [decodeFields(globalThis.JSON.parse(new globalThis.TextDecoder("utf-8").decode(new globalThis.Uint8Array(data as Array<number>)))), undefined];
  } catch (error) {
    return [{}, error instanceof globalThis.Error ? error : new globalThis.Error(String(error))];
  }
}

function decodeFields(value: unknown): Fields {
  const object = isPlainObject(value) ? value : {};
  return {
    __tsgoEmbedded0: {
      Name: expectedString(object.name),
      Version: expectedString(object.version),
      Type: expectedString(object.type),
    },
    __tsgoEmbedded1: {
      TSConfig: expectedString(object.tsconfig),
      Main: expectedString(object.main),
      Types: expectedString(object.types),
      Typings: expectedString(object.typings),
      TypesVersions: decodeJSONValue(object.typesVersions),
      Imports: decodeExportsOrImports(object.imports),
      Exports: decodeExportsOrImports(object.exports),
    },
    __tsgoEmbedded2: {
      Dependencies: expectedStringMap(object.dependencies),
      DevDependencies: expectedStringMap(object.devDependencies),
      PeerDependencies: expectedStringMap(object.peerDependencies),
      OptionalDependencies: expectedStringMap(object.optionalDependencies),
    },
  };
}

function expectedString(value: unknown): Expected<string> {
  return {
    actualJSONType: actualJSONType(value),
    Null: (value === null) as bool,
    Valid: (typeof value === "string") as bool,
    Value: typeof value === "string" ? value : "",
  };
}

function expectedStringMap(value: unknown): Expected<GoMap<string, string>> {
  const map = new globalThis.Map<string, string>();
  const object = isPlainObject(value) ? value : undefined;
  let valid = object !== undefined;
  if (object !== undefined) {
    for (const [key, entry] of globalThis.Object.entries(object)) {
      if (typeof entry !== "string") {
        valid = false;
        continue;
      }
      map.set(key, entry);
    }
  }
  return {
    actualJSONType: actualJSONType(value),
    Null: (value === null) as bool,
    Valid: valid as bool,
    Value: map,
  };
}

function decodeExportsOrImports(value: unknown): ExportsOrImports {
  return {
    __tsgoEmbedded0: decodeJSONValue(value, nested => decodeExportsOrImportsFromJSONValue(nested)),
    objectKind: objectKindUnknown,
  };
}

function decodeExportsOrImportsFromJSONValue(value: JSONValue): ExportsOrImports {
  return {
    __tsgoEmbedded0: value,
    objectKind: objectKindUnknown,
  };
}

function decodeJSONValue<T = JSONValue>(value: unknown, elementFactory: (value: JSONValue) => T = value => value as T): JSONValue {
  if (value === undefined) {
    return { Type: JSONValueTypeNotPresent, Value: undefined };
  }
  if (value === null) {
    return { Type: JSONValueTypeNull, Value: undefined };
  }
  if (typeof value === "string") {
    return { Type: JSONValueTypeString, Value: value };
  }
  if (typeof value === "number") {
    return { Type: JSONValueTypeNumber, Value: value };
  }
  if (typeof value === "boolean") {
    return { Type: JSONValueTypeBoolean, Value: value };
  }
  if (globalThis.Array.isArray(value)) {
    return {
      Type: JSONValueTypeArray,
      Value: value.map(element => elementFactory(decodeJSONValue(element, elementFactory))) as GoSlice<T>,
    };
  }
  if (typeof value === "object") {
    const entries = globalThis.Object.entries(value as Record<string, unknown>);
    const map = NewOrderedMapWithSizeHint<string, T>(entries.length as byte)!;
    for (const [key, entry] of entries) {
      OrderedMap_Set(map, key, elementFactory(decodeJSONValue(entry, elementFactory)));
    }
    return { Type: JSONValueTypeObject, Value: map };
  }
  return { Type: JSONValueTypeNotPresent, Value: undefined };
}

function actualJSONType(value: unknown): string {
  return jsonValueTypeName(jsonValueTypeOf(value));
}

function jsonValueTypeOf(value: unknown): JSONValueType {
  if (value === undefined) return JSONValueTypeNotPresent;
  if (value === null) return JSONValueTypeNull;
  if (typeof value === "string") return JSONValueTypeString;
  if (typeof value === "number") return JSONValueTypeNumber;
  if (typeof value === "boolean") return JSONValueTypeBoolean;
  if (globalThis.Array.isArray(value)) return JSONValueTypeArray;
  if (typeof value === "object") return JSONValueTypeObject;
  return JSONValueTypeNotPresent;
}

function jsonValueTypeName(valueType: JSONValueType): string {
  switch (valueType) {
    case JSONValueTypeNull:
      return "null";
    case JSONValueTypeString:
      return "string";
    case JSONValueTypeNumber:
      return "number";
    case JSONValueTypeBoolean:
      return "boolean";
    case JSONValueTypeArray:
      return "array";
    case JSONValueTypeObject:
      return "object";
    default:
      return "";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !globalThis.Array.isArray(value);
}

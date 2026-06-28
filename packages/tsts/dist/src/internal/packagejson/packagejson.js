import { NewOrderedMapWithSizeHint, OrderedMap_Set } from "../collections/ordered_map.js";
import { NewSetWithSizeHint, Set_Add } from "../collections/set.js";
import { AllowDuplicateNames, Unmarshal } from "../json/json.js";
import { Expected_GetValue } from "./expected.js";
import { JSONValueTypeArray, JSONValueTypeBoolean, JSONValueTypeNotPresent, JSONValueTypeNull, JSONValueTypeNumber, JSONValueTypeObject, JSONValueTypeString } from "./jsonvalue.js";
import { objectKindUnknown } from "./exportsorimports.js";
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
export function DependencyFields_HasDependency(receiver, name) {
    const [deps, depsOk] = Expected_GetValue(receiver.Dependencies);
    if (depsOk && deps.has(name)) {
        return true;
    }
    const [devDeps, devDepsOk] = Expected_GetValue(receiver.DevDependencies);
    if (devDepsOk && devDeps.has(name)) {
        return true;
    }
    const [peerDeps, peerDepsOk] = Expected_GetValue(receiver.PeerDependencies);
    if (peerDepsOk && peerDeps.has(name)) {
        return true;
    }
    const [optDeps, optDepsOk] = Expected_GetValue(receiver.OptionalDependencies);
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
export function DependencyFields_RangeDependencies(receiver, f) {
    const [deps, depsOk] = Expected_GetValue(receiver.Dependencies);
    if (depsOk) {
        for (const [name, version] of deps) {
            if (!f(name, version, "dependencies")) {
                return;
            }
        }
    }
    const [devDeps, devDepsOk] = Expected_GetValue(receiver.DevDependencies);
    if (devDepsOk) {
        for (const [name, version] of devDeps) {
            if (!f(name, version, "devDependencies")) {
                return;
            }
        }
    }
    const [peerDeps, peerDepsOk] = Expected_GetValue(receiver.PeerDependencies);
    if (peerDepsOk) {
        for (const [name, version] of peerDeps) {
            if (!f(name, version, "peerDependencies")) {
                return;
            }
        }
    }
    const [optDeps, optDepsOk] = Expected_GetValue(receiver.OptionalDependencies);
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
export function DependencyFields_GetRuntimeDependencyNames(receiver) {
    const [deps, depsOk] = Expected_GetValue(receiver.Dependencies);
    const [peerDeps, peerDepsOk] = Expected_GetValue(receiver.PeerDependencies);
    const [optDeps, optDepsOk] = Expected_GetValue(receiver.OptionalDependencies);
    const count = (depsOk ? deps.size : 0) + (peerDepsOk ? peerDeps.size : 0) + (optDepsOk ? optDeps.size : 0);
    const names = NewSetWithSizeHint(count);
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
export function Parse(data) {
    const f = {};
    const err = Unmarshal(data, f, AllowDuplicateNames(true));
    if (err !== undefined) {
        return [{}, err];
    }
    try {
        return [decodeFields(globalThis.JSON.parse(new globalThis.TextDecoder("utf-8").decode(new globalThis.Uint8Array(data)))), undefined];
    }
    catch (error) {
        return [{}, error instanceof globalThis.Error ? error : new globalThis.Error(String(error))];
    }
}
function decodeFields(value) {
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
function expectedString(value) {
    return {
        actualJSONType: actualJSONType(value),
        Null: (value === null),
        Valid: (typeof value === "string"),
        Value: typeof value === "string" ? value : "",
    };
}
function expectedStringMap(value) {
    const map = new globalThis.Map();
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
        Null: (value === null),
        Valid: valid,
        Value: map,
    };
}
function decodeExportsOrImports(value) {
    return {
        __tsgoEmbedded0: decodeJSONValue(value, nested => decodeExportsOrImportsFromJSONValue(nested)),
        objectKind: objectKindUnknown,
    };
}
function decodeExportsOrImportsFromJSONValue(value) {
    return {
        __tsgoEmbedded0: value,
        objectKind: objectKindUnknown,
    };
}
function decodeJSONValue(value, elementFactory = value => value) {
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
            Value: value.map(element => elementFactory(decodeJSONValue(element, elementFactory))),
        };
    }
    if (typeof value === "object") {
        const entries = globalThis.Object.entries(value);
        const map = NewOrderedMapWithSizeHint(entries.length);
        for (const [key, entry] of entries) {
            OrderedMap_Set(map, key, elementFactory(decodeJSONValue(entry, elementFactory)));
        }
        return { Type: JSONValueTypeObject, Value: map };
    }
    return { Type: JSONValueTypeNotPresent, Value: undefined };
}
function actualJSONType(value) {
    return jsonValueTypeName(jsonValueTypeOf(value));
}
function jsonValueTypeOf(value) {
    if (value === undefined)
        return JSONValueTypeNotPresent;
    if (value === null)
        return JSONValueTypeNull;
    if (typeof value === "string")
        return JSONValueTypeString;
    if (typeof value === "number")
        return JSONValueTypeNumber;
    if (typeof value === "boolean")
        return JSONValueTypeBoolean;
    if (globalThis.Array.isArray(value))
        return JSONValueTypeArray;
    if (typeof value === "object")
        return JSONValueTypeObject;
    return JSONValueTypeNotPresent;
}
function jsonValueTypeName(valueType) {
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
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !globalThis.Array.isArray(value);
}
//# sourceMappingURL=packagejson.js.map
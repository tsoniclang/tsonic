import { NewOrderedMapWithSizeHint, OrderedMap_Set } from "../collections/ordered_map.js";
import { NewSetWithSizeHint, Set_Add } from "../collections/set.js";
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
 * @tsgo-override {"category":"runtime-correctness","allow":["body"],"reason":"The Go body unmarshals the bytes once into Fields with the pinned JSON library. Here the bytes are decoded once (keeping a leading byte-order mark, which JSON.parse rejects, and refusing ill-formed UTF-8, as the library does) and parsed once by JSON.parse, which takes the last of duplicate names as AllowDuplicateNames does; decodeFields builds the fields from that one parse. JSON.parse accepts two inputs the library refuses, and both are refused here before the fields are built: an escaped surrogate that is not half of an escaped pair, in any string token of the text, member names and the values of discarded duplicate names included (one pass over the string tokens of the accepted text, since the parsed value no longer holds a discarded duplicate); and a root that is an array, a string, a number or a boolean (null and an object are accepted, as by the library). The order is the library's: an array root is refused before its strings are read; for any other root the string tokens are checked first, then the root's kind. One difference in the error only: for an array root whose content is not valid JSON (a trailing comma, an unclosed array) the library names the array, refusing it at its first token, while JSON.parse here reports the syntax error; both are errors with empty fields. An earlier form parsed the same bytes twice, each time with a decoder that removed a mark. Limit: the refusal of ill-formed UTF-8 holds for bytes given to Parse. Module resolution does not give it a file's bytes: the file read replaces ill-formed bytes by U+FFFD and the resolver re-encodes that text, so a package.json file with ill-formed UTF-8 is still read here, where the Go resolver, which passes the file's bytes, refuses it."}
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
    // One decode and one parse of the bytes, as the Go body's single Unmarshal. The decoder keeps a leading byte-order
    // mark, which JSON.parse rejects, and throws on ill-formed UTF-8; JSON.parse takes the last of duplicate names.
    try {
        const text = new globalThis.TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new globalThis.Uint8Array(data));
        const value = globalThis.JSON.parse(text);
        // The library's order: an array root is refused at its first token, before any string in it is read; for every
        // other root the string tokens are read first, then the root's kind decides.
        if (globalThis.Array.isArray(value)) {
            return [{}, new globalThis.Error(`cannot unmarshal a JSON array into package.json fields`)];
        }
        const unpaired = firstUnpairedSurrogateEscape(text);
        if (unpaired >= 0) {
            return [{}, new globalThis.Error(`invalid surrogate pair in a string at offset ${unpaired}`)];
        }
        if (value !== null && typeof value !== "object") {
            return [{}, new globalThis.Error(`cannot unmarshal a JSON ${jsonRootKind(value)} into package.json fields`)];
        }
        return [decodeFields(value), undefined];
    }
    catch (error) {
        return [{}, error instanceof globalThis.Error ? error : new globalThis.Error(String(error))];
    }
}
/**
 * The offset of the first escaped surrogate that is not half of an escaped pair, in any string token of `text`, or
 * -1. The pinned JSON library refuses such an escape wherever it is (a member name, an ignored member, a value later
 * replaced by a duplicate name); JSON.parse accepts it, and its value no longer holds a replaced duplicate, so the
 * check reads the text: the same decoded string JSON.parse has just accepted.
 *
 * Because JSON.parse accepted the text, outside its string tokens there is no quotation mark and no backslash, so a
 * quotation mark outside a token opens one; inside a token a backslash escapes exactly the next character, or `u`
 * and four hexadecimal digits. An escaped high surrogate must be followed at once by an escaped low surrogate:
 * anything else after it (the closing quotation mark, a plain character, any other escape, a second high) is the
 * error, and so is an escaped low surrogate that does not follow an escaped high one. Raw characters are not checked:
 * no raw surrogate can reach JSON.parse, because the bytes passed the fatal UTF-8 decoder, which refuses an encoded
 * surrogate.
 */
function firstUnpairedSurrogateEscape(text) {
    let state = "outside";
    let highEscape = -1;
    let index = 0;
    while (index < text.length) {
        const code = text.charCodeAt(index);
        switch (state) {
            case "outside":
                if (code === 0x22) {
                    state = "inside";
                }
                index += 1;
                break;
            case "inside":
                if (code === 0x5c) {
                    state = "after-backslash";
                }
                else if (code === 0x22) {
                    state = "outside";
                }
                index += 1;
                break;
            case "after-backslash":
                if (code === 0x75) {
                    const unit = hexUnit(text, index + 1);
                    if (unit >= 0xdc00 && unit <= 0xdfff) {
                        return index - 1;
                    }
                    if (unit >= 0xd800 && unit <= 0xdbff) {
                        highEscape = index - 1;
                        state = "after-high-escape";
                    }
                    else {
                        state = "inside";
                    }
                    index += 5;
                }
                else {
                    state = "inside";
                    index += 1;
                }
                break;
            case "after-high-escape":
                if (code === 0x5c && text.charCodeAt(index + 1) === 0x75) {
                    const unit = hexUnit(text, index + 2);
                    if (unit >= 0xdc00 && unit <= 0xdfff) {
                        state = "inside";
                        index += 6;
                        break;
                    }
                }
                return highEscape;
        }
    }
    return state === "after-high-escape" ? highEscape : -1;
}
/**
 * The code unit of the four hexadecimal digits at `start`, upper or lower case alike. JSON.parse has accepted the
 * escape, so they are hexadecimal digits.
 */
function hexUnit(text, start) {
    let unit = 0;
    for (let index = start; index < start + 4; index += 1) {
        const code = text.charCodeAt(index);
        const digit = code <= 0x39 ? code - 0x30 : (code | 0x20) - 0x57;
        unit = unit * 16 + digit;
    }
    return unit;
}
function jsonRootKind(value) {
    return typeof value === "string" ? "string" : typeof value === "number" ? "number" : "boolean";
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
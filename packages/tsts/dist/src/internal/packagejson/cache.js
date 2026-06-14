import { Map as SyncGoMap, Once } from "../../go/sync.js";
import { NewOrderedMapWithSizeHint, OrderedMap_Entries, OrderedMap_Set } from "../collections/ordered_map.js";
import { SyncMap_Load, SyncMap_LoadOrStore } from "../collections/syncmap.js";
import { Version } from "../core/version.js";
import { VersionMajorMinor } from "../core/version.js";
import { Expected_type_of_0_field_in_package_json_to_be_1_got_2, X_package_json_does_not_have_a_0_field, X_package_json_does_not_have_a_typesVersions_entry_that_matches_version_0, X_package_json_has_a_typesVersions_entry_0_that_is_not_a_valid_semver_range, X_package_json_has_a_typesVersions_field_with_version_specific_path_mappings, } from "../diagnostics/generated/messages.js";
import { MustParse } from "../semver/version.js";
import { TryParseVersionRange, VersionRange_Test } from "../semver/version_range.js";
import { ToPath } from "../tspath/path.js";
import { JSONValue_AsArray, JSONValue_AsObject, JSONValueType_String, JSONValueTypeArray, JSONValueTypeObject, JSONValueTypeString, JSONValueTypeNotPresent } from "./jsonvalue.js";
import { objectKindUnknown } from "./exportsorimports.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::varGroup::typeScriptVersion","kind":"varGroup","status":"implemented","sigHash":"5ea790652197b354557a923968e58da28d67b2ec3f25c5727cf388cf991ad24a","bodyHash":"aa456a24b17567514562ee03f13a59f6391067b1c2ff7f896b46df2dde1f4bfb"}
 *
 * Go source:
 * var typeScriptVersion = semver.MustParse(core.Version())
 */
export const typeScriptVersion = MustParse(Version());
const packageJsonMissingString = () => ({
    actualJSONType: "",
    Null: false,
    Valid: false,
    Value: "",
});
const packageJsonMissingStringMap = () => ({
    actualJSONType: "",
    Null: false,
    Valid: false,
    Value: new globalThis.Map(),
});
const packageJsonNotPresentValue = () => ({ Type: JSONValueTypeNotPresent, Value: undefined });
const packageJsonNotPresentExportsOrImports = () => ({
    __tsgoEmbedded0: packageJsonNotPresentValue(),
    objectKind: objectKindUnknown,
});
export function PackageJson_GetHeaderFields(receiver) {
    return receiver?.__tsgoEmbedded0?.__tsgoEmbedded0 ?? {
        Name: packageJsonMissingString(),
        Version: packageJsonMissingString(),
        Type: packageJsonMissingString(),
    };
}
export function PackageJson_GetPathFields(receiver) {
    return receiver?.__tsgoEmbedded0?.__tsgoEmbedded1 ?? {
        TSConfig: packageJsonMissingString(),
        Main: packageJsonMissingString(),
        Types: packageJsonMissingString(),
        Typings: packageJsonMissingString(),
        TypesVersions: packageJsonNotPresentValue(),
        Imports: packageJsonNotPresentExportsOrImports(),
        Exports: packageJsonNotPresentExportsOrImports(),
    };
}
export function PackageJson_GetDependencyFields(receiver) {
    return receiver?.__tsgoEmbedded0?.__tsgoEmbedded2 ?? {
        Dependencies: packageJsonMissingStringMap(),
        DevDependencies: packageJsonMissingStringMap(),
        PeerDependencies: packageJsonMissingStringMap(),
        OptionalDependencies: packageJsonMissingStringMap(),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::PackageJson.GetVersionPaths","kind":"method","status":"implemented","sigHash":"888fae93a66c70412eaf06a9942942a14018d83915e6ae2ac4862f96c785f016","bodyHash":"c7efabe915992ee2dfa1546d85e467770f22babaf91790ca552f5b0af40edc37"}
 *
 * Go source:
 * func (p *PackageJson) GetVersionPaths(trace func(m *diagnostics.Message, args ...any)) VersionPaths {
 * 	p.once.Do(func() {
 * 		if p.Fields.TypesVersions.Type == JSONValueTypeNotPresent {
 * 			p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 				diagnostics.X_package_json_does_not_have_a_0_field,
 * 				[]any{"typesVersions"},
 * 			})
 * 			return
 * 		}
 * 		if p.Fields.TypesVersions.Type != JSONValueTypeObject {
 * 			p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 				diagnostics.Expected_type_of_0_field_in_package_json_to_be_1_got_2,
 * 				[]any{"typesVersions", "object", p.Fields.TypesVersions.Type.String()},
 * 			})
 * 			return
 * 		}
 *
 * 		p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 			diagnostics.X_package_json_has_a_typesVersions_field_with_version_specific_path_mappings,
 * 			[]any{"typesVersions"},
 * 		})
 *
 * 		for key, value := range p.Fields.TypesVersions.AsObject().Entries() {
 * 			keyRange, ok := semver.TryParseVersionRange(key)
 * 			if !ok {
 * 				p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 					diagnostics.X_package_json_has_a_typesVersions_entry_0_that_is_not_a_valid_semver_range,
 * 					[]any{key},
 * 				})
 * 				continue
 * 			}
 * 			if keyRange.Test(&typeScriptVersion) {
 * 				if value.Type != JSONValueTypeObject {
 * 					p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 						diagnostics.Expected_type_of_0_field_in_package_json_to_be_1_got_2,
 * 						[]any{"typesVersions['" + key + "']", "object", value.Type.String()},
 * 					})
 * 					return
 * 				}
 * 				p.versionPaths = VersionPaths{
 * 					Version:   key,
 * 					pathsJSON: value.AsObject(),
 * 				}
 * 				return
 * 			}
 * 		}
 *
 * 		p.versionTraces = append(p.versionTraces, diagnosticAndArgs{
 * 			diagnostics.X_package_json_does_not_have_a_typesVersions_entry_that_matches_version_0,
 * 			[]any{core.VersionMajorMinor()},
 * 		})
 * 	})
 * 	if trace != nil {
 * 		for _, msg := range p.versionTraces {
 * 			trace(msg.message, msg.args...)
 * 		}
 * 	}
 * 	return p.versionPaths
 * }
 */
export function PackageJson_GetVersionPaths(receiver, trace) {
    receiver.once.Do(() => {
        const typesVersions = receiver.__tsgoEmbedded0?.__tsgoEmbedded1?.TypesVersions ?? { Type: JSONValueTypeNotPresent, Value: undefined };
        receiver.versionTraces ??= [];
        receiver.versionPaths ??= { Version: "", pathsJSON: undefined, paths: undefined };
        if (typesVersions.Type === JSONValueTypeNotPresent) {
            receiver.versionTraces = [...receiver.versionTraces, {
                    message: X_package_json_does_not_have_a_0_field,
                    args: ["typesVersions"],
                }];
            return;
        }
        if (typesVersions.Type !== JSONValueTypeObject) {
            receiver.versionTraces = [...receiver.versionTraces, {
                    message: Expected_type_of_0_field_in_package_json_to_be_1_got_2,
                    args: ["typesVersions", "object", JSONValueType_String(typesVersions.Type)],
                }];
            return;
        }
        receiver.versionTraces = [...receiver.versionTraces, {
                message: X_package_json_has_a_typesVersions_field_with_version_specific_path_mappings,
                args: ["typesVersions"],
            }];
        const obj = JSONValue_AsObject(typesVersions);
        let done = false;
        OrderedMap_Entries(obj)((key, value) => {
            if (done)
                return false;
            const [keyRange, ok] = TryParseVersionRange(key);
            if (!ok) {
                receiver.versionTraces = [...receiver.versionTraces, {
                        message: X_package_json_has_a_typesVersions_entry_0_that_is_not_a_valid_semver_range,
                        args: [key],
                    }];
                return false;
            }
            if (VersionRange_Test(keyRange, typeScriptVersion)) {
                if (value.Type !== JSONValueTypeObject) {
                    receiver.versionTraces = [...receiver.versionTraces, {
                            message: Expected_type_of_0_field_in_package_json_to_be_1_got_2,
                            args: ["typesVersions['" + key + "']", "object", JSONValueType_String(value.Type)],
                        }];
                    done = true;
                    return false;
                }
                receiver.versionPaths = {
                    Version: key,
                    pathsJSON: JSONValue_AsObject(value),
                    paths: undefined,
                };
                done = true;
                return false;
            }
            return false;
        });
        if (!done) {
            receiver.versionTraces = [...receiver.versionTraces, {
                    message: X_package_json_does_not_have_a_typesVersions_entry_that_matches_version_0,
                    args: [VersionMajorMinor()],
                }];
        }
    });
    if (trace !== undefined) {
        for (const msg of receiver.versionTraces) {
            trace(msg.message, ...msg.args);
        }
    }
    return receiver.versionPaths;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::VersionPaths.Exists","kind":"method","status":"implemented","sigHash":"34439786381057eda8f0d8776f37ac13dd14b508d044c25d2984a8b470e959ca","bodyHash":"ba406a3fcc9a3685f5bad8a55babe1a723ee9675850dff33225f742e7e43508d"}
 *
 * Go source:
 * func (v *VersionPaths) Exists() bool {
 * 	return v != nil && v.Version != "" && v.pathsJSON != nil
 * }
 */
export function VersionPaths_Exists(receiver) {
    return receiver !== undefined && receiver.Version !== "" && receiver.pathsJSON !== undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::VersionPaths.GetPaths","kind":"method","status":"implemented","sigHash":"3a2791874b63d6effdeaf3f52d5c347b193a6cf002e9d48227af1e02ef7c0e61","bodyHash":"07828b36d1788f5e46a6f3d50444a0e5d54c9ecf658ab2d2529042d485d8a5c1"}
 *
 * Go source:
 * func (v *VersionPaths) GetPaths() *collections.OrderedMap[string, []string] {
 * 	if !v.Exists() {
 * 		return nil
 * 	}
 * 	if v.paths != nil {
 * 		return v.paths
 * 	}
 * 	paths := collections.NewOrderedMapWithSizeHint[string, []string](v.pathsJSON.Size())
 * 	for key, value := range v.pathsJSON.Entries() {
 * 		if value.Type != JSONValueTypeArray {
 * 			continue
 * 		}
 * 		slice := make([]string, len(value.AsArray()))
 * 		for i, path := range value.AsArray() {
 * 			if path.Type != JSONValueTypeString {
 * 				continue
 * 			}
 * 			slice[i] = path.Value.(string)
 * 		}
 * 		paths.Set(key, slice)
 * 	}
 * 	v.paths = paths
 * 	return v.paths
 * }
 */
export function VersionPaths_GetPaths(receiver) {
    if (!VersionPaths_Exists(receiver)) {
        return undefined;
    }
    if (receiver.paths !== undefined) {
        return receiver.paths;
    }
    const paths = NewOrderedMapWithSizeHint(0);
    OrderedMap_Entries(receiver.pathsJSON)((key, value) => {
        if (value.Type !== JSONValueTypeArray) {
            return false;
        }
        const arr = JSONValue_AsArray(value);
        const slice = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
            const elem = arr[i];
            if (elem === undefined || elem.Type !== JSONValueTypeString) {
                continue;
            }
            slice[i] = elem.Value;
        }
        OrderedMap_Set(paths, key, slice);
        return false;
    });
    receiver.paths = paths;
    return receiver.paths;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::InfoCacheEntry.Exists","kind":"method","status":"implemented","sigHash":"51cb912680e1329b8bec38d754cff44821de635498592d98d51ff14b8e42a412","bodyHash":"f280fbe300c6719f716615731c5531345a0ac4d4fdd4e3553e460551bd7fcb44"}
 *
 * Go source:
 * func (p *InfoCacheEntry) Exists() bool {
 * 	return p != nil && p.Contents != nil
 * }
 */
export function InfoCacheEntry_Exists(receiver) {
    return receiver !== undefined && receiver.Contents !== undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::InfoCacheEntry.GetContents","kind":"method","status":"implemented","sigHash":"24f53032da88827fc763766ed857de00a754f6985aa44ff54493943dd2b19aa1","bodyHash":"9b25eff7b6c0289d52a7e76126e76f181c89b7ade589c82bc699d846765e4b4f"}
 *
 * Go source:
 * func (p *InfoCacheEntry) GetContents() *PackageJson {
 * 	if p == nil || p.Contents == nil {
 * 		return nil
 * 	}
 * 	return p.Contents
 * }
 */
export function InfoCacheEntry_GetContents(receiver) {
    if (receiver === undefined || receiver.Contents === undefined) {
        return undefined;
    }
    return receiver.Contents;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::InfoCacheEntry.GetDirectory","kind":"method","status":"implemented","sigHash":"4d8e7bde8993a8da88ab321f592fce8cb25ddc350580513997e826e35d7b40ed","bodyHash":"7571dd44bd225a572ff27c272b494ff017ca0a7e0069687b94cf1dc37e86f5bf"}
 *
 * Go source:
 * func (p *InfoCacheEntry) GetDirectory() string {
 * 	if p == nil {
 * 		return ""
 * 	}
 * 	return p.PackageDirectory
 * }
 */
export function InfoCacheEntry_GetDirectory(receiver) {
    if (receiver === undefined) {
        return "";
    }
    return receiver.PackageDirectory;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::func::NewInfoCache","kind":"func","status":"implemented","sigHash":"e84c94a43c0d290893548669cb07f3dff1ab556548d9127347925823ddf55291","bodyHash":"5f491cb27a529e9edc6ec9121e31c2a13ab3b167b3aa9387f4a92558fa89578f"}
 *
 * Go source:
 * func NewInfoCache(currentDirectory string, useCaseSensitiveFileNames bool) *InfoCache {
 * 	return &InfoCache{
 * 		currentDirectory:          currentDirectory,
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 	}
 * }
 */
export function NewInfoCache(currentDirectory, useCaseSensitiveFileNames) {
    return {
        cache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() },
        currentDirectory,
        useCaseSensitiveFileNames,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::InfoCache.Get","kind":"method","status":"implemented","sigHash":"c7d1fbde61854488c2b4bf92965aebecb24a28bcd97d7a7f2fd1a01b00d32370","bodyHash":"7a00ae04ccdedb2ae97a871b6fb9bd7c46b369341c8d2adddaa7940dced4216c"}
 *
 * Go source:
 * func (p *InfoCache) Get(packageJsonPath string) *InfoCacheEntry {
 * 	key := tspath.ToPath(packageJsonPath, p.currentDirectory, p.useCaseSensitiveFileNames)
 * 	if value, ok := p.cache.Load(key); ok {
 * 		return value
 * 	}
 * 	return nil
 * }
 */
export function InfoCache_Get(receiver, packageJsonPath) {
    const key = ToPath(packageJsonPath, receiver.currentDirectory, receiver.useCaseSensitiveFileNames);
    const [value, ok] = SyncMap_Load(receiver.cache, key);
    if (ok) {
        return value;
    }
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/cache.go::method::InfoCache.Set","kind":"method","status":"implemented","sigHash":"de605db13977fc8d29b33b5835d3f62120f906d689e99c7409485ea823a4e05a","bodyHash":"cf901e911033d8cb90d28092520d75f70ca709e04d08a7d6807b2b51b2c30fbe"}
 *
 * Go source:
 * func (p *InfoCache) Set(packageJsonPath string, info *InfoCacheEntry) *InfoCacheEntry {
 * 	key := tspath.ToPath(packageJsonPath, p.currentDirectory, p.useCaseSensitiveFileNames)
 * 	actual, _ := p.cache.LoadOrStore(key, info)
 * 	return actual
 * }
 */
export function InfoCache_Set(receiver, packageJsonPath, info) {
    const key = ToPath(packageJsonPath, receiver.currentDirectory, receiver.useCaseSensitiveFileNames);
    const [actual] = SyncMap_LoadOrStore(receiver.cache, key, info);
    return actual;
}
//# sourceMappingURL=cache.js.map
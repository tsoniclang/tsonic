import type { bool, byte } from "@tsonic/core/types.js";
import type { GoError, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Set } from "../collections/set.js";
import type { Expected } from "./expected.js";
import type { ExportsOrImports } from "./exportsorimports.js";
import type { JSONValue } from "./jsonvalue.js";
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
export declare function DependencyFields_HasDependency(receiver: GoPtr<DependencyFields>, name: string): bool;
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
export declare function DependencyFields_RangeDependencies(receiver: GoPtr<DependencyFields>, f: (name: string, version: string, dependencyField: string) => bool): void;
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
export declare function DependencyFields_GetRuntimeDependencyNames(receiver: GoPtr<DependencyFields>): GoPtr<Set>;
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
export declare function Parse(data: GoSlice<byte>): [Fields, GoError];
//# sourceMappingURL=packagejson.d.ts.map
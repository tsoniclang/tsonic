import * as fmt from "../../go/fmt.js";
import * as strings from "../../go/strings.js";
import * as extension from "../tspath/extension.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::constGroup::NodeResolutionFeaturesImports+NodeResolutionFeaturesSelfName+NodeResolutionFeaturesExports+NodeResolutionFeaturesExportsPatternTrailers+NodeResolutionFeaturesImportsPatternRoot+NodeResolutionFeaturesNone+NodeResolutionFeaturesAll+NodeResolutionFeaturesNode16Default+NodeResolutionFeaturesNodeNextDefault+NodeResolutionFeaturesBundlerDefault","kind":"constGroup","status":"implemented","sigHash":"ac7ac108ee6d3db6c3609da81ab6a0b1fbf3f931b8e132ae6b4c14fb0eedd87b","bodyHash":"c664aff0abf30b0f1a3f1d9c94f4af8eb0d43af9e57138381ff4ac6862c9d21a"}
 *
 * Go source:
 * const (
 * 	NodeResolutionFeaturesImports NodeResolutionFeatures = 1 << iota
 * 	NodeResolutionFeaturesSelfName
 * 	NodeResolutionFeaturesExports
 * 	NodeResolutionFeaturesExportsPatternTrailers
 * 	// allowing `#/` root imports in package.json imports field
 * 	// not supported until mass adoption - https://github.com/nodejs/node/pull/60864
 * 	NodeResolutionFeaturesImportsPatternRoot
 *
 * 	NodeResolutionFeaturesNone            NodeResolutionFeatures = 0
 * 	NodeResolutionFeaturesAll                                    = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot
 * 	NodeResolutionFeaturesNode16Default                          = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers
 * 	NodeResolutionFeaturesNodeNextDefault                        = NodeResolutionFeaturesAll
 * 	NodeResolutionFeaturesBundlerDefault                         = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot
 * )
 */
export const NodeResolutionFeaturesImports = 1 << 0;
export const NodeResolutionFeaturesSelfName = 1 << 1;
export const NodeResolutionFeaturesExports = 1 << 2;
export const NodeResolutionFeaturesExportsPatternTrailers = 1 << 3;
export const NodeResolutionFeaturesImportsPatternRoot = 1 << 4;
export const NodeResolutionFeaturesNone = 0;
export const NodeResolutionFeaturesAll = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot;
export const NodeResolutionFeaturesNode16Default = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers;
export const NodeResolutionFeaturesNodeNextDefault = NodeResolutionFeaturesAll;
export const NodeResolutionFeaturesBundlerDefault = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::PackageId.String","kind":"method","status":"implemented","sigHash":"07e1145105c8a286c58ed064a7a513d0a23b765a7ed2b3aea9bb26105dc8e3f3","bodyHash":"58ee473c24f3041f71218f310262fba14511d52c8053f8e927d15aea610e1384"}
 *
 * Go source:
 * func (p *PackageId) String() string {
 * 	return fmt.Sprintf("%s@%s%s", p.PackageName(), p.Version, p.PeerDependencies)
 * }
 */
export function PackageId_String(receiver) {
    const p = receiver;
    return fmt.Sprintf("%s@%s%s", PackageId_PackageName(p), p.Version, p.PeerDependencies);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::PackageId.PackageName","kind":"method","status":"implemented","sigHash":"0c9f9971b224ff800cfd18708fd154439a18723a9b2c5e92f0065bf8d6d6121d","bodyHash":"e3087434064739ecc363b51ff5f4b86b2d4c627e5634ecec218743837fdb1abf"}
 *
 * Go source:
 * func (p *PackageId) PackageName() string {
 * 	if p.SubModuleName != "" {
 * 		return p.Name + "/" + p.SubModuleName
 * 	}
 * 	return p.Name
 * }
 */
export function PackageId_PackageName(receiver) {
    const p = receiver;
    if (p.SubModuleName !== "") {
        return p.Name + "/" + p.SubModuleName;
    }
    return p.Name;
}
export const ResolvedModuleExtensionProviderVirtual = "provider-virtual";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::ResolvedModule.IsResolved","kind":"method","status":"implemented","sigHash":"e902c2aac26780befbbd09abc7d82ad51bcbfb33ce82087c272c87179e971f7f","bodyHash":"5e6fb759efff60795350b740b4a605f47c7b7d28e141c5f74f53e2fdf78e176a"}
 *
 * Go source:
 * func (r *ResolvedModule) IsResolved() bool {
 * 	return r != nil && r.ResolvedFileName != ""
 * }
 */
export function ResolvedModule_IsResolved(receiver) {
    return receiver !== undefined && receiver.ResolvedFileName !== "";
}
export function ResolvedModule_IsProviderVirtual(receiver) {
    return receiver !== undefined && receiver.ProviderVirtual !== undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::ResolvedTypeReferenceDirective.IsResolved","kind":"method","status":"implemented","sigHash":"f76972df25a94a35fdaf138c5f78e76310995da67456057a47b8f4a1aa93f9b2","bodyHash":"6485d03102f5f2f79e82611d99f41b3b1404a3c1a47d2092aaa08024d83736c2"}
 *
 * Go source:
 * func (r *ResolvedTypeReferenceDirective) IsResolved() bool {
 * 	return r.ResolvedFileName != ""
 * }
 */
export function ResolvedTypeReferenceDirective_IsResolved(receiver) {
    return receiver.ResolvedFileName !== "";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::constGroup::extensionsTypeScript+extensionsJavaScript+extensionsDeclaration+extensionsJson+extensionsImplementationFiles","kind":"constGroup","status":"implemented","sigHash":"1fc1ab3f2ee5066caa15b0f0943ea1631fb606d3606b4f0c6e2cc8b4f39f418a","bodyHash":"f5b0db3c5f90277e1888db954d57aaa01edc0eaddd5ba551bf254d247cdea3a6"}
 *
 * Go source:
 * const (
 * 	extensionsTypeScript extensions = 1 << iota
 * 	extensionsJavaScript
 * 	extensionsDeclaration
 * 	extensionsJson
 *
 * 	extensionsImplementationFiles = extensionsTypeScript | extensionsJavaScript
 * )
 */
export const extensionsTypeScript = 1 << 0;
export const extensionsJavaScript = 1 << 1;
export const extensionsDeclaration = 1 << 2;
export const extensionsJson = 1 << 3;
export const extensionsImplementationFiles = extensionsTypeScript | extensionsJavaScript;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::extensions.String","kind":"method","status":"implemented","sigHash":"07c9b49ec98b86cccfff9d2d466581e555912d4ff447fb9314c2d5a239c0b035","bodyHash":"ed85dc3fb27e85045b5d5a019f7720a3964acac3e1622c07b90fb71bff154ba1"}
 *
 * Go source:
 * func (e extensions) String() string {
 * 	result := make([]string, 0, bits.OnesCount(uint(e)))
 * 	if e&extensionsTypeScript != 0 {
 * 		result = append(result, "TypeScript")
 * 	}
 * 	if e&extensionsJavaScript != 0 {
 * 		result = append(result, "JavaScript")
 * 	}
 * 	if e&extensionsDeclaration != 0 {
 * 		result = append(result, "Declaration")
 * 	}
 * 	if e&extensionsJson != 0 {
 * 		result = append(result, "JSON")
 * 	}
 * 	return strings.Join(result, ", ")
 * }
 */
export function extensions_String(receiver) {
    const e = receiver;
    const result = [];
    if ((e & extensionsTypeScript) !== 0) {
        result.push("TypeScript");
    }
    if ((e & extensionsJavaScript) !== 0) {
        result.push("JavaScript");
    }
    if ((e & extensionsDeclaration) !== 0) {
        result.push("Declaration");
    }
    if ((e & extensionsJson) !== 0) {
        result.push("JSON");
    }
    return strings.Join(result, ", ");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::extensions.Array","kind":"method","status":"implemented","sigHash":"be5c4e0d3a7afd7d458e356ca120da96c474cc05096ef3a59a73e52feb71dfec","bodyHash":"330bf4b29d9166ccbee737ee9d826e15dbe3664ddea6ff6a03b507224837e5ca"}
 *
 * Go source:
 * func (e extensions) Array() []string {
 * 	result := []string{}
 * 	if e&extensionsTypeScript != 0 {
 * 		result = append(result, tspath.SupportedTSImplementationExtensions...)
 * 	}
 * 	if e&extensionsJavaScript != 0 {
 * 		result = append(result, tspath.SupportedJSExtensionsFlat...)
 * 	}
 * 	if e&extensionsDeclaration != 0 {
 * 		result = append(result, tspath.SupportedDeclarationExtensions...)
 * 	}
 * 	if e&extensionsJson != 0 {
 * 		result = append(result, tspath.ExtensionJson)
 * 	}
 * 	return result
 * }
 */
export function extensions_Array(receiver) {
    const e = receiver;
    const result = [];
    if ((e & extensionsTypeScript) !== 0) {
        result.push(...extension.SupportedTSImplementationExtensions);
    }
    if ((e & extensionsJavaScript) !== 0) {
        result.push(...extension.SupportedJSExtensionsFlat);
    }
    if ((e & extensionsDeclaration) !== 0) {
        result.push(...extension.SupportedDeclarationExtensions);
    }
    if ((e & extensionsJson) !== 0) {
        result.push(extension.ExtensionJson);
    }
    return result;
}
//# sourceMappingURL=types.js.map
import { CombinePaths, FileExtensionIs } from "../tspath/path.js";
import { ExtensionJson } from "../tspath/extension.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/projectreference.go::func::ResolveProjectReferencePath","kind":"func","status":"implemented","sigHash":"c383cf92b1484acd16331e92d5f29bb9efa43eb8d9113091eb7090a4299ce75e","bodyHash":"4d84a486db05d340271c3cf6e8c7179da7f3563572189d3e31101911862a227e"}
 *
 * Go source:
 * func ResolveProjectReferencePath(ref *ProjectReference) string {
 * 	return ResolveConfigFileNameOfProjectReference(ref.Path)
 * }
 */
export function ResolveProjectReferencePath(ref) {
    return ResolveConfigFileNameOfProjectReference(ref.Path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/projectreference.go::func::ResolveConfigFileNameOfProjectReference","kind":"func","status":"implemented","sigHash":"a02e1f6ac5e4bf85ec1def08a2f934122abf3a7d848db4ccc935248e91549829","bodyHash":"92daea1df2d831b14907e01a1760fe6546537a83f958d1a6f83ebdfa1ab5d346"}
 *
 * Go source:
 * func ResolveConfigFileNameOfProjectReference(path string) string {
 * 	if tspath.FileExtensionIs(path, tspath.ExtensionJson) {
 * 		return path
 * 	}
 * 	return tspath.CombinePaths(path, "tsconfig.json")
 * }
 */
export function ResolveConfigFileNameOfProjectReference(path) {
    if (FileExtensionIs(path, ExtensionJson)) {
        return path;
    }
    return CombinePaths(path, "tsconfig.json");
}
//# sourceMappingURL=projectreference.js.map
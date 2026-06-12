import type { bool, int, sbyte } from "@tsonic/core/types.js";
import type { GoPtr, GoRune, GoSlice } from "../../../go/compat.js";
import { MaxInt } from "../../../go/math.js";
import { SortStableFunc } from "../../../go/slices.js";
import { Every, Flatten, LastOrNil } from "../../core/core.js";
import { NewSetWithSizeHint, Set_Add, Set_Has } from "../../collections/set.js";
import type { Set } from "../../collections/set.js";
import { FileExtensionIsOneOf } from "../../tspath/extension.js";
import { ComparePathsOptions_GetComparer, CombinePaths, ContainsPath, GetCanonicalFileName, GetDirectoryPath, GetNormalizedPathComponents, HasExtension, IsRootedDiskPath, NormalizePath, RemoveTrailingDirectorySeparator } from "../../tspath/path.js";
import type { ComparePathsOptions } from "../../tspath/path.js";
import type { FS } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::Usage","kind":"type","status":"implemented","sigHash":"47e8ee4b4da9d149b50eedf7a872fae159481b92e688730c131fe23c21e25fbf","bodyHash":"56c72bc27d92dabb6a98e08c0218812331e176b895533580d85b7591ec37069d"}
 *
 * Go source:
 * Usage int8
 */
export type Usage = sbyte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::constGroup::UsageFiles+UsageDirectories+UsageExclude","kind":"constGroup","status":"implemented","sigHash":"a53d6d662e8ca29c2d0fa9fec4b00d1a7fc4952b2991d601cb7799374510f440","bodyHash":"951aca00c806bad6e498aec253e74f97521185aa8ca351f29373368d11c45c30"}
 *
 * Go source:
 * const (
 * 	UsageFiles Usage = iota
 * 	UsageDirectories
 * 	UsageExclude
 * )
 */
export const UsageFiles: Usage = 0 as Usage;
export const UsageDirectories: Usage = 1 as Usage;
export const UsageExclude: Usage = 2 as Usage;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::constGroup::UnlimitedDepth","kind":"constGroup","status":"implemented","sigHash":"014f91465101a37e9f3d5e3d2269e6189ded89b9430d014ea987228d62bc25f5","bodyHash":"149f35c49dfd7dc3818eb9917c518953feb4f1a3c47b34a53135f2b53bdecfa7"}
 *
 * Go source:
 * const UnlimitedDepth = math.MaxInt
 */
export const UnlimitedDepth: int = MaxInt;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::ReadDirectory","kind":"func","status":"implemented","sigHash":"d4e3e6106bc8f65e288e603282ad88d4ff63bd888990ec2d2e1136aa420b27e0","bodyHash":"4c8d9a4776bfded31a67d3ea6a7bf82c5e229d06d2efab36d4768b2a7479725f"}
 *
 * Go source:
 * func ReadDirectory(host vfs.FS, currentDir string, path string, extensions []string, excludes []string, includes []string, depth int) []string {
 * 	return matchFiles(path, extensions, excludes, includes, host.UseCaseSensitiveFileNames(), currentDir, depth, host)
 * }
 */
export function ReadDirectory(host: FS, currentDir: string, path: string, extensions: GoSlice<string>, excludes: GoSlice<string>, includes: GoSlice<string>, depth: int): GoSlice<string> {
  return matchFiles(path, extensions, excludes, includes, host.UseCaseSensitiveFileNames(), currentDir, depth, host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::IsImplicitGlob","kind":"func","status":"implemented","sigHash":"2d31e1769b8918d7248ff122f1df44979f642208bcd229eb61f1a743f4f59282","bodyHash":"abb9d43b95d70edb2b0ea8c223555f23195bd7e71d22cb9bbaaf622e0d338f1a"}
 *
 * Go source:
 * func IsImplicitGlob(lastPathComponent string) bool {
 * 	return !strings.ContainsAny(lastPathComponent, ".*?")
 * }
 */
export function IsImplicitGlob(lastPathComponent: string): bool {
  return !lastPathComponent.includes(".") && !lastPathComponent.includes("*") && !lastPathComponent.includes("?") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::varGroup::wildcardCharCodes","kind":"varGroup","status":"implemented","sigHash":"2b0c76c5c3cbfae697e8362c3f5706232dc2854a327a1d5121f0a95235850929","bodyHash":"260b8dc9dcb50655a22c16a47f99b61e3f950f5da7614a3ef29337bf39561911"}
 *
 * Go source:
 * var wildcardCharCodes = []rune{'*', '?'}
 */
export let wildcardCharCodes: GoSlice<GoRune> = [0x2a, 0x3f] as GoSlice<GoRune>; // '*', '?'

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::getIncludeBasePath","kind":"func","status":"implemented","sigHash":"8d50a317ffb7fb224ecf550f5c6cee8f39ba6f9c84401ed760249cc559bd9a70","bodyHash":"0f7e4b2610803f0cf46a924db1bb35f53e0d9eb95102ff13f1dc44bd73efbf43"}
 *
 * Go source:
 * func getIncludeBasePath(absolute string) string {
 * 	wildcardOffset := strings.IndexAny(absolute, string(wildcardCharCodes))
 * 	if wildcardOffset < 0 {
 * 		// No "*" or "?" in the path
 * 		if !tspath.HasExtension(absolute) {
 * 			return absolute
 * 		} else {
 * 			return tspath.RemoveTrailingDirectorySeparator(tspath.GetDirectoryPath(absolute))
 * 		}
 * 	}
 * 	return absolute[:max(strings.LastIndex(absolute[:wildcardOffset], string(tspath.DirectorySeparator)), 0)]
 * }
 */
export function getIncludeBasePath(absolute: string): string {
  // strings.IndexAny(absolute, string(wildcardCharCodes)) — find first * or ?
  const wildcardOffset = findFirstWildcard(absolute);
  if (wildcardOffset < 0) {
    // No "*" or "?" in the path
    if (!HasExtension(absolute)) {
      return absolute;
    } else {
      return RemoveTrailingDirectorySeparator(GetDirectoryPath(absolute));
    }
  }
  // absolute[:max(strings.LastIndex(absolute[:wildcardOffset], string(tspath.DirectorySeparator)), 0)]
  const prefix = absolute.slice(0, wildcardOffset);
  const lastSlash = prefix.lastIndexOf("/");
  return absolute.slice(0, Math.max(lastSlash, 0));
}

function findFirstWildcard(s: string): int {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "*" || s[i] === "?") {
      return i as int;
    }
  }
  return -1 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::getBasePaths","kind":"func","status":"implemented","sigHash":"979ce35f7d356d25332b0898eccc14986ef19c73e864ec995fb40c2c4590a767","bodyHash":"b1ce1df8bd5fc810112af9f041b1987ec67bf48bb2dc35827b70ebfef039b485"}
 *
 * Go source:
 * func getBasePaths(path string, includes []string, useCaseSensitiveFileNames bool) []string {
 * 	// Storage for our results in the form of literal paths (e.g. the paths as written by the user).
 * 	basePaths := []string{path}
 * 
 * 	if len(includes) > 0 {
 * 		comparePathsOptions := tspath.ComparePathsOptions{CurrentDirectory: path, UseCaseSensitiveFileNames: useCaseSensitiveFileNames}
 * 		stringComparer := comparePathsOptions.GetComparer()
 * 
 * 		// Storage for literal base paths amongst the include patterns.
 * 		includeBasePaths := []string{}
 * 		for _, include := range includes {
 * 			// We also need to check the relative paths by converting them to absolute and normalizing
 * 			// in case they escape the base path (e.g "..\somedirectory")
 * 			var absolute string
 * 			if tspath.IsRootedDiskPath(include) {
 * 				absolute = include
 * 			} else {
 * 				absolute = tspath.NormalizePath(tspath.CombinePaths(path, include))
 * 			}
 * 			// Append the literal and canonical candidate base paths.
 * 			includeBasePaths = append(includeBasePaths, getIncludeBasePath(absolute))
 * 		}
 * 
 * 		// Sort the offsets array using either the literal or canonical path representations.
 * 		slices.SortStableFunc(includeBasePaths, stringComparer)
 * 
 * 		// Iterate over each include base path and include unique base paths that are not a
 * 		// subpath of an existing base path
 * 		for _, includeBasePath := range includeBasePaths {
 * 			if core.Every(basePaths, func(basepath string) bool {
 * 				return !tspath.ContainsPath(basepath, includeBasePath, comparePathsOptions)
 * 			}) {
 * 				basePaths = append(basePaths, includeBasePath)
 * 			}
 * 		}
 * 	}
 * 
 * 	return basePaths
 * }
 */
export function getBasePaths(path: string, includes: GoPtr<GoSlice<string>>, useCaseSensitiveFileNames: bool): GoSlice<string> {
  const basePaths: string[] = [path];
  const includeList = includes ?? [];

  if (includeList.length > 0) {
    const comparePathsOptions: ComparePathsOptions = { CurrentDirectory: path, UseCaseSensitiveFileNames: useCaseSensitiveFileNames };
    const stringComparer = ComparePathsOptions_GetComparer(comparePathsOptions);

    const includeBasePaths: string[] = [];
    for (const include of includeList) {
      let absolute: string;
      if (IsRootedDiskPath(include)) {
        absolute = include;
      } else {
        absolute = NormalizePath(CombinePaths(path, include));
      }
      includeBasePaths.push(getIncludeBasePath(absolute));
    }

    SortStableFunc(includeBasePaths, stringComparer);

    for (const includeBasePath of includeBasePaths) {
      if (Every(basePaths, (basepath: string) => !ContainsPath(basepath, includeBasePath, comparePathsOptions) as bool)) {
        basePaths.push(includeBasePath);
      }
    }
  }

  return basePaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::globPattern","kind":"type","status":"implemented","sigHash":"073759b00fb56a17d01343148759131d7f1fe08d7f2dcd158f69ab45fb458865","bodyHash":"b6ad296dea8a6b88c65b0cd490b00b4353a2cee9c54e873d328df823e5c34a5d"}
 *
 * Go source:
 * globPattern struct {
 * 	components    []component // path segments to match (e.g., ["src", "**", "*.ts"])
 * 	isExclude     bool        // exclude patterns have different matching rules
 * 	caseSensitive bool
 * 	excludeMinJs  bool // for "files" patterns, exclude .min.js by default
 * }
 */
export interface globPattern {
  components: GoSlice<component>;
  isExclude: bool;
  caseSensitive: bool;
  excludeMinJs: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::component","kind":"type","status":"implemented","sigHash":"a263a079c092653238449adb9d078ed32c79a17b563a595ec00faf22c27fea6f","bodyHash":"2db8da8f1069d478e904f4889fb517c7e39d30ad67330a1042ba975203792081"}
 *
 * Go source:
 * component struct {
 * 	kind     componentKind
 * 	literal  string    // for kindLiteral: the exact string to match
 * 	segments []segment // for kindWildcard: parsed wildcard pattern
 * 	// Include patterns with wildcards skip common package folders (node_modules, etc.)
 * 	skipPackageFolders bool
 * }
 */
export interface component {
  kind: componentKind;
  literal: string;
  segments: GoSlice<segment>;
  skipPackageFolders: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::componentKind","kind":"type","status":"implemented","sigHash":"28243866ad66398833f148a1c476e8a10c84f142727b77519a8ae2e87be7e376","bodyHash":"d24512119ee1c70f0a621c39e9b7f9569b8d5fc782f67e45c5f5bc11eaf33895"}
 *
 * Go source:
 * componentKind int
 */
export type componentKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::constGroup::kindLiteral+kindWildcard+kindDoubleAsterisk","kind":"constGroup","status":"implemented","sigHash":"e8a05df27f88e9ed290cfcc84175116fe54f88bcb4fefcb8232f8bb4f7b52ad1","bodyHash":"44e371906d92af9a02f13cb4448c11b7f534888439be6b52e3232e80a23b1c1b"}
 *
 * Go source:
 * const (
 * 	kindLiteral        componentKind = iota // exact match (e.g., "src")
 * 	kindWildcard                            // contains * or ? (e.g., "*.ts")
 * 	kindDoubleAsterisk                      // ** matches zero or more directories
 * )
 */
export const kindLiteral: componentKind = 0 as componentKind;
export const kindWildcard: componentKind = 1 as componentKind;
export const kindDoubleAsterisk: componentKind = 2 as componentKind;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::segment","kind":"type","status":"implemented","sigHash":"45f4e296cff4b805c8121b192a03684b3d2ed5b9db5ced879965b380d4d8d459","bodyHash":"f2f71cb560baf8146d57432a1843a4a85c0b1234d053e46e8269fcd1a4a61674"}
 *
 * Go source:
 * segment struct {
 * 	kind    segmentKind
 * 	literal string // only for segLiteral
 * }
 */
export interface segment {
  kind: segmentKind;
  literal: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::segmentKind","kind":"type","status":"implemented","sigHash":"19c985deb44e2f58b8f824be1bed5e98f45a9a84822253c1fc77a90f7afa6aef","bodyHash":"138b5917537a844639cfdad997d1d26a478082269b62b91fda21f7124d5d4b36"}
 *
 * Go source:
 * segmentKind int
 */
export type segmentKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::constGroup::segLiteral+segStar+segQuestion","kind":"constGroup","status":"implemented","sigHash":"6d13ee50d992180fda91fde9a5782fa860b016bee1041851d2dc324dc4ca13cb","bodyHash":"ec20df886a8ab77c384b393c3699b0b571234c235a1cdba5df43cd6207ec3bf9"}
 *
 * Go source:
 * const (
 * 	segLiteral  segmentKind = iota // exact text
 * 	segStar                        // * matches any chars except /
 * 	segQuestion                    // ? matches single char except /
 * )
 */
export const segLiteral: segmentKind = 0 as segmentKind;
export const segStar: segmentKind = 1 as segmentKind;
export const segQuestion: segmentKind = 2 as segmentKind;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::compileGlobPattern","kind":"func","status":"implemented","sigHash":"73acfa566b73726ec1696d86eac308b62bff6e3e92f0a3c793543142e2d25bb9","bodyHash":"1e49ebedb0bb17d63689443975670d468cba20da50f0bc8164c622890852e06c"}
 *
 * Go source:
 * func compileGlobPattern(spec string, basePath string, usage Usage, caseSensitive bool) (globPattern, bool) {
 * 	parts := tspath.GetNormalizedPathComponents(spec, basePath)
 * 
 * 	// "src/**" without a filename matches nothing (for include patterns)
 * 	if usage != UsageExclude && core.LastOrNil(parts) == "**" {
 * 		return globPattern{}, false
 * 	}
 * 
 * 	// Normalize root: "/home/" -> "/home"
 * 	parts[0] = tspath.RemoveTrailingDirectorySeparator(parts[0])
 * 
 * 	// Directories implicitly match all files: "src" -> "src/** /*"
 * 	if IsImplicitGlob(core.LastOrNil(parts)) {
 * 		parts = append(parts, "**", "*")
 * 	}
 * 
 * 	p := globPattern{
 * 		isExclude:     usage == UsageExclude,
 * 		caseSensitive: caseSensitive,
 * 		excludeMinJs:  usage == UsageFiles,
 * 		// Avoid slice growth during compilation.
 * 		components: make([]component, 0, len(parts)),
 * 	}
 * 
 * 	for _, part := range parts {
 * 		p.components = append(p.components, parseComponent(part, usage != UsageExclude))
 * 	}
 * 	return p, true
 * }
 */
export function compileGlobPattern(spec: string, basePath: string, usage: Usage, caseSensitive: bool): [globPattern, bool] {
  const parts = GetNormalizedPathComponents(spec, basePath);

  // "src/**" without a filename matches nothing (for include patterns)
  if (usage !== UsageExclude && LastOrNil(parts) === "**") {
    return [{ components: [], isExclude: false, caseSensitive: false, excludeMinJs: false }, false];
  }

  // Normalize root: "/home/" -> "/home"
  parts[0] = RemoveTrailingDirectorySeparator(parts[0]!);

  // Directories implicitly match all files: "src" -> "src/** /*"
  if (IsImplicitGlob(LastOrNil(parts))) {
    parts.push("**", "*");
  }

  const p: globPattern = {
    isExclude: usage === UsageExclude,
    caseSensitive: caseSensitive,
    excludeMinJs: usage === UsageFiles,
    components: [],
  };

  for (const part of parts) {
    p.components.push(parseComponent(part, usage !== UsageExclude));
  }
  return [p, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::parseComponent","kind":"func","status":"implemented","sigHash":"63a4282a73c6ff2b67e20fc041d4263b1217b7d4d741703cd6eed7268bc07cbe","bodyHash":"9cc87507b99d066b8295e7cf1418bff6919f3b94c934575330af6adafe8b5c84"}
 *
 * Go source:
 * func parseComponent(s string, isInclude bool) component {
 * 	if s == "**" {
 * 		return component{kind: kindDoubleAsterisk}
 * 	}
 * 	if !strings.ContainsAny(s, "*?") {
 * 		return component{kind: kindLiteral, literal: s}
 * 	}
 * 	return component{
 * 		kind:               kindWildcard,
 * 		segments:           parseSegments(s),
 * 		skipPackageFolders: isInclude,
 * 	}
 * }
 */
export function parseComponent(s: string, isInclude: bool): component {
  if (s === "**") {
    return { kind: kindDoubleAsterisk, literal: "", segments: [], skipPackageFolders: false };
  }
  if (!s.includes("*") && !s.includes("?")) {
    return { kind: kindLiteral, literal: s, segments: [], skipPackageFolders: false };
  }
  return {
    kind: kindWildcard,
    literal: "",
    segments: parseSegments(s),
    skipPackageFolders: isInclude,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::parseSegments","kind":"func","status":"implemented","sigHash":"28122925789061e4ae9d16f2b676a3fbcebd22985d3f7d2f6815f3c85b2c86b3","bodyHash":"73cbc3b03adb12a609d5899dec386384698fb41d9040d09c65541bf30896f653"}
 *
 * Go source:
 * func parseSegments(s string) []segment {
 * 	// Preallocate based on wildcard count: each wildcard contributes 1 segment,
 * 	// and each wildcard can split literals into at most one extra literal segment.
 * 	wildcards := 0
 * 	for i := range len(s) {
 * 		if s[i] == '*' || s[i] == '?' {
 * 			wildcards++
 * 		}
 * 	}
 * 	result := make([]segment, 0, 2*wildcards+1)
 * 	start := 0
 * 	for i := range len(s) {
 * 		switch s[i] {
 * 		case '*', '?':
 * 			if i > start {
 * 				result = append(result, segment{kind: segLiteral, literal: s[start:i]})
 * 			}
 * 			if s[i] == '*' {
 * 				result = append(result, segment{kind: segStar})
 * 			} else {
 * 				result = append(result, segment{kind: segQuestion})
 * 			}
 * 			start = i + 1
 * 		}
 * 	}
 * 	if start < len(s) {
 * 		result = append(result, segment{kind: segLiteral, literal: s[start:]})
 * 	}
 * 	return result
 * }
 */
export function parseSegments(s: string): GoSlice<segment> {
  const result: segment[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "*" || s[i] === "?") {
      if (i > start) {
        result.push({ kind: segLiteral, literal: s.slice(start, i) });
      }
      if (s[i] === "*") {
        result.push({ kind: segStar, literal: "" });
      } else {
        result.push({ kind: segQuestion, literal: "" });
      }
      start = i + 1;
    }
  }
  if (start < s.length) {
    result.push({ kind: segLiteral, literal: s.slice(start) });
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matches","kind":"method","status":"implemented","sigHash":"51f1aa6c9ff4fb020b8e6b007b3a83e4950193a75231083759a71416cdce7541","bodyHash":"df3b558296caac30b46dfe49ce5d5cb25dea31f8a871a8da22ea264f6805579e"}
 *
 * Go source:
 * func (p *globPattern) matches(path string) bool {
 * 	return p.matchPathParts(path, "", 0, 0, false)
 * }
 */
export function globPattern_matches(receiver: GoPtr<globPattern>, path: string): bool {
  return globPattern_matchPathParts(receiver, path, "", 0 as int, 0 as int, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matchesParts","kind":"method","status":"implemented","sigHash":"e7cf518b6ff47b161ce6ad80bf71628861197c5d3061e6b9c2d9be202a814df0","bodyHash":"e39c10b4ae8310c8603e4e1418194ab921476bd054e9bcc4318ce601ea52efea"}
 *
 * Go source:
 * func (p *globPattern) matchesParts(prefix, suffix string) bool {
 * 	return p.matchPathParts(prefix, suffix, 0, 0, false)
 * }
 */
export function globPattern_matchesParts(receiver: GoPtr<globPattern>, prefix: string, suffix: string): bool {
  return globPattern_matchPathParts(receiver, prefix, suffix, 0 as int, 0 as int, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matchesPrefixParts","kind":"method","status":"implemented","sigHash":"5cf142c057cf6051b8ee3d9143d47080ba474552f4718c302ffa518c946e7e02","bodyHash":"461b177c637e12f6279d8098db55f315c219a501fa4214e65bd3e4950eb91714"}
 *
 * Go source:
 * func (p *globPattern) matchesPrefixParts(prefix, suffix string) bool {
 * 	return p.matchPathParts(prefix, suffix, 0, 0, true)
 * }
 */
export function globPattern_matchesPrefixParts(receiver: GoPtr<globPattern>, prefix: string, suffix: string): bool {
  return globPattern_matchPathParts(receiver, prefix, suffix, 0 as int, 0 as int, true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matchPathParts","kind":"method","status":"implemented","sigHash":"94e3333c819df5b86d152ff8b01cbf0c26c00eb798cac7c1259f528a37ce0ca6","bodyHash":"cbedbde2941b7688d46b7c04b495d5a0013e1f8896ea9154a446ba1a00e76860"}
 *
 * Go source:
 * func (p *globPattern) matchPathParts(prefix, suffix string, pathOffset, compIdx int, prefixOnly bool) bool {
 * 	for {
 * 		pathPart, nextOffset, ok := nextPathPartParts(prefix, suffix, pathOffset)
 * 		if !ok {
 * 			if prefixOnly {
 * 				return true
 * 			}
 * 			return p.patternSatisfied(compIdx)
 * 		}
 * 
 * 		if compIdx >= len(p.components) {
 * 			return p.isExclude && !prefixOnly
 * 		}
 * 
 * 		comp := p.components[compIdx]
 * 		switch comp.kind {
 * 		case kindDoubleAsterisk:
 * 			if p.matchPathParts(prefix, suffix, pathOffset, compIdx+1, prefixOnly) {
 * 				return true
 * 			}
 * 			if !p.isExclude && (isHiddenPath(pathPart) || isPackageFolder(pathPart)) {
 * 				return false
 * 			}
 * 			pathOffset = nextOffset
 * 			continue
 * 		case kindLiteral:
 * 			if comp.skipPackageFolders && isPackageFolder(pathPart) {
 * 				panic("unreachable: literal components never have skipPackageFolders")
 * 			}
 * 			if !p.stringsEqual(comp.literal, pathPart) {
 * 				return false
 * 			}
 * 		case kindWildcard:
 * 			if comp.skipPackageFolders && isPackageFolder(pathPart) {
 * 				return false
 * 			}
 * 			if !p.matchWildcard(comp.segments, pathPart) {
 * 				return false
 * 			}
 * 		}
 * 
 * 		pathOffset = nextOffset
 * 		compIdx++
 * 	}
 * }
 */
export function globPattern_matchPathParts(receiver: GoPtr<globPattern>, prefix: string, suffix: string, pathOffset: int, compIdx: int, prefixOnly: bool): bool {
  let curPathOffset = pathOffset;
  let curCompIdx = compIdx;
  while (true) {
    const [pathPart, nextOffset, ok] = nextPathPartParts(prefix, suffix, curPathOffset);
    if (!ok) {
      if (prefixOnly) {
        return true;
      }
      return globPattern_patternSatisfied(receiver, curCompIdx);
    }

    if (curCompIdx >= receiver!.components.length) {
      return receiver!.isExclude && !prefixOnly;
    }

    const comp = receiver!.components[curCompIdx]!;
    if (comp.kind === kindDoubleAsterisk) {
      if (globPattern_matchPathParts(receiver, prefix, suffix, curPathOffset, curCompIdx + 1 as int, prefixOnly)) {
        return true;
      }
      if (!receiver!.isExclude && (isHiddenPath(pathPart) || isPackageFolder(pathPart))) {
        return false;
      }
      curPathOffset = nextOffset;
      // continue
    } else if (comp.kind === kindLiteral) {
      if (!globPattern_stringsEqual(receiver, comp.literal, pathPart)) {
        return false;
      }
      curPathOffset = nextOffset;
      curCompIdx = curCompIdx + 1 as int;
    } else {
      // kindWildcard
      if (comp.skipPackageFolders && isPackageFolder(pathPart)) {
        return false;
      }
      if (!globPattern_matchWildcard(receiver, comp.segments, pathPart)) {
        return false;
      }
      curPathOffset = nextOffset;
      curCompIdx = curCompIdx + 1 as int;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.patternSatisfied","kind":"method","status":"implemented","sigHash":"135482bf64d60ed39955c49a4242d2a1bc02ae29bac39d7521cb66eb9472621f","bodyHash":"2b2501bbdf1d01f21e54eb5c2a5f50f17e4ed81c5097886db720f3fa20efb0b9"}
 *
 * Go source:
 * func (p *globPattern) patternSatisfied(compIdx int) bool {
 * 	// A pattern is satisfied when remaining components can match empty input.
 * 	// For both include and exclude patterns, only trailing "**" components may match nothing.
 * 	for _, c := range p.components[compIdx:] {
 * 		if c.kind != kindDoubleAsterisk {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function globPattern_patternSatisfied(receiver: GoPtr<globPattern>, compIdx: int): bool {
  for (const c of receiver!.components.slice(compIdx)) {
    if (c.kind !== kindDoubleAsterisk) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::nextPathPartSingle","kind":"func","status":"implemented","sigHash":"1c44748f692241fd2f9e1f87a56e8a79237a2ebacb26e1686d68120392528f2f","bodyHash":"55fbc7247dff9f607929b530545115f7296401575dd2678a341f57481f7dbca8"}
 *
 * Go source:
 * func nextPathPartSingle(s string, offset int) (part string, nextOffset int, ok bool) {
 * 	if offset >= len(s) {
 * 		return "", offset, false
 * 	}
 * 	if offset == 0 && len(s) > 0 && s[0] == '/' {
 * 		return "", 1, true
 * 	}
 * 	for offset < len(s) && s[offset] == '/' {
 * 		offset++
 * 	}
 * 	if offset >= len(s) {
 * 		return "", offset, false
 * 	}
 * 	rest := s[offset:]
 * 	if idx := strings.IndexByte(rest, '/'); idx >= 0 {
 * 		return rest[:idx], offset + idx, true
 * 	}
 * 	return rest, len(s), true
 * }
 */
export function nextPathPartSingle(s: string, offset: int): [string, int, bool] {
  let off = offset as number;
  if (off >= s.length) {
    return ["", off as int, false];
  }
  if (off === 0 && s.length > 0 && s[0] === "/") {
    return ["", 1 as int, true];
  }
  while (off < s.length && s[off] === "/") {
    off++;
  }
  if (off >= s.length) {
    return ["", off as int, false];
  }
  const rest = s.slice(off);
  const idx = rest.indexOf("/");
  if (idx >= 0) {
    return [rest.slice(0, idx), (off + idx) as int, true];
  }
  return [rest, s.length as int, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::nextPathPartParts","kind":"func","status":"implemented","sigHash":"73943580feb1e39ee4d91fe6233a98aa09c17f864c51c10143929d4a6078c99e","bodyHash":"59d446d892bf179341fb616a5f406ba911afa76f0cbfbd5536b58ea607498cf6"}
 *
 * Go source:
 * func nextPathPartParts(prefix, suffix string, offset int) (part string, nextOffset int, ok bool) {
 * 	// Fast paths: keep the hot single-string scan tight.
 * 	if len(suffix) == 0 {
 * 		return nextPathPartSingle(prefix, offset)
 * 	}
 * 	if len(prefix) == 0 {
 * 		return nextPathPartSingle(suffix, offset)
 * 	}
 * 
 * 	// For matchFilesNoRegex call sites, prefix is a directory path ending in '/',
 * 	// and suffix is a single entry name (no '/'). That makes this significantly
 * 	// simpler than a general-purpose "virtual concatenation" scanner.
 * 
 * 	totalLen := len(prefix) + len(suffix)
 * 	if offset >= totalLen {
 * 		return "", offset, false
 * 	}
 * 
 * 	// Handle leading slash (root of absolute path)
 * 	if offset == 0 && prefix[0] == '/' {
 * 		return "", 1, true
 * 	}
 * 
 * 	// Scan within prefix.
 * 	if offset < len(prefix) {
 * 		for offset < len(prefix) && prefix[offset] == '/' {
 * 			offset++
 * 		}
 * 		if offset < len(prefix) {
 * 			rest := prefix[offset:]
 * 			idx := strings.IndexByte(rest, '/')
 * 			// idx is guaranteed >= 0 for the call sites we care about because prefix ends in '/'.
 * 			return rest[:idx], offset + idx, true
 * 		}
 * 		// Fall through into suffix region.
 * 	}
 * 
 * 	// Scan suffix: it's a single component.
 * 	sOff := offset - len(prefix)
 * 	if sOff >= len(suffix) {
 * 		return "", offset, false
 * 	}
 * 	return suffix[sOff:], totalLen, true
 * }
 */
export function nextPathPartParts(prefix: string, suffix: string, offset: int): [string, int, bool] {
  // Fast paths: keep the hot single-string scan tight.
  if (suffix.length === 0) {
    return nextPathPartSingle(prefix, offset);
  }
  if (prefix.length === 0) {
    return nextPathPartSingle(suffix, offset);
  }

  const totalLen = prefix.length + suffix.length;
  let off = offset as number;
  if (off >= totalLen) {
    return ["", off as int, false];
  }

  // Handle leading slash (root of absolute path)
  if (off === 0 && prefix[0] === "/") {
    return ["", 1 as int, true];
  }

  // Scan within prefix.
  if (off < prefix.length) {
    while (off < prefix.length && prefix[off] === "/") {
      off++;
    }
    if (off < prefix.length) {
      const rest = prefix.slice(off);
      const idx = rest.indexOf("/");
      // idx is guaranteed >= 0 for the call sites we care about because prefix ends in '/'.
      return [rest.slice(0, idx), (off + idx) as int, true];
    }
    // Fall through into suffix region.
  }

  // Scan suffix: it's a single component.
  const sOff = off - prefix.length;
  if (sOff >= suffix.length) {
    return ["", off as int, false];
  }
  return [suffix.slice(sOff), totalLen as int, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matchWildcard","kind":"method","status":"implemented","sigHash":"0dc89760f1b9fe918dbbb81b82b6e006b5f868ea5da9d6a797f156122af78a23","bodyHash":"b310548205877b0a2f96afa6fc2b16c8c843a9fb45b53d9f75d893175b1ab45e"}
 *
 * Go source:
 * func (p *globPattern) matchWildcard(segs []segment, s string) bool {
 * 	// Include patterns: wildcards at start cannot match hidden files
 * 	if !p.isExclude && len(segs) > 0 && isHiddenPath(s) && (segs[0].kind == segStar || segs[0].kind == segQuestion) {
 * 		return false
 * 	}
 * 
 * 	// Fast path: single * followed by literal suffix (e.g., "*.ts")
 * 	if len(segs) == 2 && segs[0].kind == segStar && segs[1].kind == segLiteral {
 * 		suffix := segs[1].literal
 * 		if len(s) < len(suffix) || !p.stringsEqual(suffix, s[len(s)-len(suffix):]) {
 * 			return false
 * 		}
 * 		return p.shouldIncludeMinJs(s, segs)
 * 	}
 * 
 * 	return p.matchSegments(segs, s) && p.shouldIncludeMinJs(s, segs)
 * }
 */
export function globPattern_matchWildcard(receiver: GoPtr<globPattern>, segs: GoSlice<segment>, s: string): bool {
  // Include patterns: wildcards at start cannot match hidden files
  if (!receiver!.isExclude && segs.length > 0 && isHiddenPath(s) && (segs[0]!.kind === segStar || segs[0]!.kind === segQuestion)) {
    return false;
  }

  // Fast path: single * followed by literal suffix (e.g., "*.ts")
  if (segs.length === 2 && segs[0]!.kind === segStar && segs[1]!.kind === segLiteral) {
    const sfx = segs[1]!.literal;
    if (s.length < sfx.length || !globPattern_stringsEqual(receiver, sfx, s.slice(s.length - sfx.length))) {
      return false;
    }
    return globPattern_shouldIncludeMinJs(receiver, s, segs);
  }

  return globPattern_matchSegments(receiver, segs, s) && globPattern_shouldIncludeMinJs(receiver, s, segs);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.matchSegments","kind":"method","status":"implemented","sigHash":"c58ca1b78f9a701ba1ea205284a3fd135967be4f023cb04ef335a6cedbc566d3","bodyHash":"a209f26a48636575d6c7299acc345af98f973dc553208c5a35f4b5372f5cc497"}
 *
 * Go source:
 * func (p *globPattern) matchSegments(segs []segment, s string) bool {
 * 	segIdx, sIdx := 0, 0
 * 	starSegIdx, starSIdx := -1, 0
 * 
 * 	for sIdx < len(s) {
 * 		if segIdx < len(segs) {
 * 			seg := segs[segIdx]
 * 			switch seg.kind {
 * 			case segLiteral:
 * 				end := sIdx + len(seg.literal)
 * 				if end <= len(s) && p.stringsEqual(seg.literal, s[sIdx:end]) {
 * 					sIdx = end
 * 					segIdx++
 * 					continue
 * 				}
 * 			case segQuestion:
 * 				if s[sIdx] != '/' {
 * 					_, size := utf8.DecodeRuneInString(s[sIdx:])
 * 					sIdx += size
 * 					segIdx++
 * 					continue
 * 				}
 * 			case segStar:
 * 				// Record star position for backtracking, then try matching zero chars.
 * 				starSegIdx = segIdx
 * 				starSIdx = sIdx
 * 				segIdx++
 * 				continue
 * 			}
 * 		}
 * 
 * 		// Current segment didn't match. Backtrack to last star if possible.
 * 		if starSegIdx >= 0 && starSIdx < len(s) && s[starSIdx] != '/' {
 * 			// Star consumes one more character (rune), retry from segment after star.
 * 			_, size := utf8.DecodeRuneInString(s[starSIdx:])
 * 			starSIdx += size
 * 			sIdx = starSIdx
 * 			segIdx = starSegIdx + 1
 * 			continue
 * 		}
 * 
 * 		return false
 * 	}
 * 
 * 	// Consume any trailing stars.
 * 	for segIdx < len(segs) && segs[segIdx].kind == segStar {
 * 		segIdx++
 * 	}
 * 	return segIdx >= len(segs)
 * }
 */
export function globPattern_matchSegments(receiver: GoPtr<globPattern>, segs: GoSlice<segment>, s: string): bool {
  let segIdx = 0;
  let sIdx = 0;
  let starSegIdx = -1;
  let starSIdx = 0;

  while (sIdx < s.length) {
    if (segIdx < segs.length) {
      const seg = segs[segIdx]!;
      if (seg.kind === segLiteral) {
        const end = sIdx + seg.literal.length;
        if (end <= s.length && globPattern_stringsEqual(receiver, seg.literal, s.slice(sIdx, end))) {
          sIdx = end;
          segIdx++;
          continue;
        }
      } else if (seg.kind === segQuestion) {
        if (s[sIdx] !== "/") {
          // utf8.DecodeRuneInString: advance by one unicode code point
          const cp = s.codePointAt(sIdx)!;
          const size = cp > 0xffff ? 2 : 1;
          sIdx += size;
          segIdx++;
          continue;
        }
      } else {
        // segStar: record star position for backtracking, try matching zero chars
        starSegIdx = segIdx;
        starSIdx = sIdx;
        segIdx++;
        continue;
      }
    }

    // Current segment didn't match. Backtrack to last star if possible.
    if (starSegIdx >= 0 && starSIdx < s.length && s[starSIdx] !== "/") {
      // Star consumes one more character (rune), retry from segment after star.
      const cp = s.codePointAt(starSIdx)!;
      const size = cp > 0xffff ? 2 : 1;
      starSIdx += size;
      sIdx = starSIdx;
      segIdx = starSegIdx + 1;
      continue;
    }

    return false;
  }

  // Consume any trailing stars.
  while (segIdx < segs.length && segs[segIdx]!.kind === segStar) {
    segIdx++;
  }
  return segIdx >= segs.length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.shouldIncludeMinJs","kind":"method","status":"implemented","sigHash":"1483e3bca64f4fc7597d01cae97a7e363454b834eccdb14c77c6c5bf9b6478c6","bodyHash":"09a9ffa1b61caabd2f5a65df7bc20b180946938f620ab7062ec847bbfe163c8b"}
 *
 * Go source:
 * func (p *globPattern) shouldIncludeMinJs(filename string, segs []segment) bool {
 * 	if !p.excludeMinJs {
 * 		return true
 * 	}
 * 
 * 	// Preserve legacy behavior:
 * 	// - When matching is case-sensitive, only the exact ".min.js" suffix is excluded by default.
 * 	// - When matching is case-insensitive, any casing variant is excluded by default.
 * 	if !p.hasMinJsSuffix(filename) {
 * 		return true
 * 	}
 * 	// Allow when the user's pattern explicitly references the .min. suffix.
 * 	if p.patternMentionsMinSuffix(segs) {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function globPattern_shouldIncludeMinJs(receiver: GoPtr<globPattern>, filename: string, segs: GoSlice<segment>): bool {
  if (!receiver!.excludeMinJs) {
    return true;
  }
  if (!globPattern_hasMinJsSuffix(receiver, filename)) {
    return true;
  }
  // Allow when the user's pattern explicitly references the .min. suffix.
  if (globPattern_patternMentionsMinSuffix(receiver, segs)) {
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.hasMinJsSuffix","kind":"method","status":"implemented","sigHash":"7249efc0bd57d472b1ae95fd1ff0e5552008414fb0f5e0aca550a9b253e49f22","bodyHash":"81de31b4fe8bd5fee0d55fb9b1af443c703e2cfd6d65abfa0125d37b19015589"}
 *
 * Go source:
 * func (p *globPattern) hasMinJsSuffix(filename string) bool {
 * 	if p.caseSensitive {
 * 		return strings.HasSuffix(filename, ".min.js")
 * 	}
 * 	const minJs = ".min.js"
 * 	if len(filename) < len(minJs) {
 * 		return false
 * 	}
 * 	// Avoid allocating via strings.ToLower; compare suffix case-insensitively.
 * 	return strings.EqualFold(filename[len(filename)-len(minJs):], minJs)
 * }
 */
export function globPattern_hasMinJsSuffix(receiver: GoPtr<globPattern>, filename: string): bool {
  const minJs = ".min.js";
  if (receiver!.caseSensitive) {
    return filename.endsWith(minJs) as bool;
  }
  if (filename.length < minJs.length) {
    return false;
  }
  // case-insensitive suffix comparison
  return (filename.slice(filename.length - minJs.length).toLowerCase() === minJs) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.patternMentionsMinSuffix","kind":"method","status":"implemented","sigHash":"90b5d254a5e437042f85bcc978995bd102f79551a19b0c2b3242120a85294673","bodyHash":"2cc2f80f237349f9bf9b8153cca0fa465ba0a47fd132fe22aae7527ef6c74888"}
 *
 * Go source:
 * func (p *globPattern) patternMentionsMinSuffix(segs []segment) bool {
 * 	for _, seg := range segs {
 * 		if seg.kind != segLiteral {
 * 			continue
 * 		}
 * 		lit := seg.literal
 * 		if !p.caseSensitive {
 * 			lit = strings.ToLower(lit)
 * 		}
 * 		if strings.Contains(lit, ".min.js") || strings.Contains(lit, ".min.") {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function globPattern_patternMentionsMinSuffix(receiver: GoPtr<globPattern>, segs: GoSlice<segment>): bool {
  for (const seg of segs) {
    if (seg.kind !== segLiteral) {
      continue;
    }
    let lit = seg.literal;
    if (!receiver!.caseSensitive) {
      lit = lit.toLowerCase();
    }
    if (lit.includes(".min.js") || lit.includes(".min.")) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globPattern.stringsEqual","kind":"method","status":"implemented","sigHash":"fdf01a92a6ca468f1e28eac73831fe7b5efab24048011f77a06c04f3b108d435","bodyHash":"914dcfea83f165140e37b767727efb786f96cccdf48144aa3757c17973ee3b9c"}
 *
 * Go source:
 * func (p *globPattern) stringsEqual(a, b string) bool {
 * 	if p.caseSensitive {
 * 		return a == b
 * 	}
 * 	return strings.EqualFold(a, b)
 * }
 */
export function globPattern_stringsEqual(receiver: GoPtr<globPattern>, a: string, b: string): bool {
  if (receiver!.caseSensitive) {
    return (a === b) as bool;
  }
  return (a.toLowerCase() === b.toLowerCase()) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::isHiddenPath","kind":"func","status":"implemented","sigHash":"14ca41a53f57f797dbd1b5666bb431ffa904c73b2823446388d5cd3fd44c5595","bodyHash":"47bcb1b2dbec268bb22e9426607ec93b1da0f95de662ca7aefe84a72b78a479e"}
 *
 * Go source:
 * func isHiddenPath(name string) bool {
 * 	return len(name) > 0 && name[0] == '.'
 * }
 */
export function isHiddenPath(name: string): bool {
  return (name.length > 0 && name[0] === ".") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::isPackageFolder","kind":"func","status":"implemented","sigHash":"a179e864919179b2a389038992e97e6cc4e0c591de0467473b5b278ed637f3e8","bodyHash":"7de120dfa3114fdc96a9943ceb1926b0cf90789c6611535062b4a3ff858f24f5"}
 *
 * Go source:
 * func isPackageFolder(name string) bool {
 * 	switch len(name) {
 * 	case len("node_modules"):
 * 		return strings.EqualFold(name, "node_modules")
 * 	case len("jspm_packages"):
 * 		return strings.EqualFold(name, "jspm_packages")
 * 	case len("bower_components"):
 * 		return strings.EqualFold(name, "bower_components")
 * 	}
 * 	return false
 * }
 */
export function isPackageFolder(name: string): bool {
  switch (name.length) {
    case "node_modules".length:
      return (name.toLowerCase() === "node_modules") as bool;
    case "jspm_packages".length:
      return (name.toLowerCase() === "jspm_packages") as bool;
    case "bower_components".length:
      return (name.toLowerCase() === "bower_components") as bool;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::ensureTrailingSlash","kind":"func","status":"implemented","sigHash":"d765a88e09ac1b8b43ec682681714ee1448f58ff5ebf848ab86099accf287c0f","bodyHash":"4d07de59aa2193ea7a8cf67b1d841434eac35e82a70f3807483cbcfac1ceeebb"}
 *
 * Go source:
 * func ensureTrailingSlash(s string) string {
 * 	if len(s) > 0 && s[len(s)-1] != '/' {
 * 		return s + "/"
 * 	}
 * 	return s
 * }
 */
export function ensureTrailingSlash(s: string): string {
  if (s.length > 0 && s[s.length - 1] !== "/") {
    return s + "/";
  }
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::globMatcher","kind":"type","status":"implemented","sigHash":"9210470a7c612ec2a7991ce49741a6ff3321bb129500529970d5983b3c31e3b1","bodyHash":"d905b9008e73b76351d900df492b73c157ec49b5abf1428173b9e0123ae51456"}
 *
 * Go source:
 * globMatcher struct {
 * 	includes    []globPattern
 * 	excludes    []globPattern
 * 	hadIncludes bool // true if include specs were provided (even if none compiled)
 * }
 */
export interface globMatcher {
  includes: GoSlice<globPattern>;
  excludes: GoSlice<globPattern>;
  hadIncludes: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::newGlobMatcher","kind":"func","status":"implemented","sigHash":"00dce2ed78e83667a0cfbf819df8ed59a3868b43b0b8b4d158720574825a955c","bodyHash":"0eaa12fc88b375a2e90ae95932e74e917c27aa8c4dc0a6275f1dd13cda67dd9d"}
 *
 * Go source:
 * func newGlobMatcher(includeSpecs, excludeSpecs []string, basePath string, caseSensitive bool, usage Usage) *globMatcher {
 * 	m := &globMatcher{
 * 		hadIncludes: len(includeSpecs) > 0,
 * 		includes:    make([]globPattern, 0, len(includeSpecs)),
 * 		excludes:    make([]globPattern, 0, len(excludeSpecs)),
 * 	}
 * 
 * 	for _, spec := range includeSpecs {
 * 		if p, ok := compileGlobPattern(spec, basePath, usage, caseSensitive); ok {
 * 			m.includes = append(m.includes, p)
 * 		}
 * 	}
 * 	for _, spec := range excludeSpecs {
 * 		if p, ok := compileGlobPattern(spec, basePath, UsageExclude, caseSensitive); ok {
 * 			m.excludes = append(m.excludes, p)
 * 		}
 * 	}
 * 	return m
 * }
 */
export function newGlobMatcher(includeSpecs: GoPtr<GoSlice<string>>, excludeSpecs: GoPtr<GoSlice<string>>, basePath: string, caseSensitive: bool, usage: Usage): GoPtr<globMatcher> {
  const includeList = includeSpecs ?? [];
  const excludeList = excludeSpecs ?? [];
  const m: globMatcher = {
    hadIncludes: includeList.length > 0,
    includes: [],
    excludes: [],
  };

  for (const spec of includeList) {
    const [p, ok] = compileGlobPattern(spec, basePath, usage, caseSensitive);
    if (ok) {
      m.includes.push(p);
    }
  }
  for (const spec of excludeList) {
    const [p, ok] = compileGlobPattern(spec, basePath, UsageExclude, caseSensitive);
    if (ok) {
      m.excludes.push(p);
    }
  }
  return m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globMatcher.matchesFileParts","kind":"method","status":"implemented","sigHash":"5d85bff380c3c971da290b2a5416b74bc3ea9dea72f40f15d0672337f4922b12","bodyHash":"722e4715ecf8aadc4344e47f3885c209b0c1742fbe3f9574f95559b491e57db0"}
 *
 * Go source:
 * func (m *globMatcher) matchesFileParts(prefix, suffix string) (int, bool) {
 * 	for i := range m.excludes {
 * 		if m.excludes[i].matchesParts(prefix, suffix) {
 * 			return 0, false
 * 		}
 * 	}
 * 	if len(m.includes) == 0 {
 * 		if m.hadIncludes {
 * 			return 0, false
 * 		}
 * 		return 0, true
 * 	}
 * 	for i := range m.includes {
 * 		if m.includes[i].matchesParts(prefix, suffix) {
 * 			return i, true
 * 		}
 * 	}
 * 	return 0, false
 * }
 */
export function globMatcher_matchesFileParts(receiver: GoPtr<globMatcher>, prefix: string, suffix: string): [int, bool] {
  for (let i = 0; i < receiver!.excludes.length; i++) {
    if (globPattern_matchesParts(receiver!.excludes[i], prefix, suffix)) {
      return [0 as int, false];
    }
  }
  if (receiver!.includes.length === 0) {
    if (receiver!.hadIncludes) {
      return [0 as int, false];
    }
    return [0 as int, true];
  }
  for (let i = 0; i < receiver!.includes.length; i++) {
    if (globPattern_matchesParts(receiver!.includes[i], prefix, suffix)) {
      return [i as int, true];
    }
  }
  return [0 as int, false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globMatcher.matchesDirectoryParts","kind":"method","status":"implemented","sigHash":"6ce3df45e74aff0c708eb4f0e414a3b3bfc82d8a2987814126d1008e0a078228","bodyHash":"682a90eff36629eeaea8d0141dd41459f3bc08d615afe5f05c788ef57aefad69"}
 *
 * Go source:
 * func (m *globMatcher) matchesDirectoryParts(prefix, suffix string) bool {
 * 	for i := range m.excludes {
 * 		if m.excludes[i].matchesParts(prefix, suffix) {
 * 			return false
 * 		}
 * 	}
 * 	if len(m.includes) == 0 {
 * 		return !m.hadIncludes
 * 	}
 * 	for i := range m.includes {
 * 		if m.includes[i].matchesPrefixParts(prefix, suffix) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function globMatcher_matchesDirectoryParts(receiver: GoPtr<globMatcher>, prefix: string, suffix: string): bool {
  for (let i = 0; i < receiver!.excludes.length; i++) {
    if (globPattern_matchesParts(receiver!.excludes[i], prefix, suffix)) {
      return false;
    }
  }
  if (receiver!.includes.length === 0) {
    return !receiver!.hadIncludes as bool;
  }
  for (let i = 0; i < receiver!.includes.length; i++) {
    if (globPattern_matchesPrefixParts(receiver!.includes[i], prefix, suffix)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::globVisitor","kind":"type","status":"implemented","sigHash":"0206a31108ef60284a4f39e2bc49ac759903fa60d3d4f5296eaf6fd443b68225","bodyHash":"83b834331519256a5881e74c55ffabd7cb21e9b4f7d846c37c07fdf9e16a5b75"}
 *
 * Go source:
 * globVisitor struct {
 * 	host                      vfs.FS
 * 	fileMatcher               *globMatcher
 * 	directoryMatcher          *globMatcher
 * 	extensions                []string
 * 	useCaseSensitiveFileNames bool
 * 	visited                   collections.Set[string]
 * 	results                   [][]string
 * }
 */
export interface globVisitor {
  host: FS;
  fileMatcher: GoPtr<globMatcher>;
  directoryMatcher: GoPtr<globMatcher>;
  extensions: GoSlice<string>;
  useCaseSensitiveFileNames: bool;
  visited: Set;
  results: GoSlice<GoSlice<string>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::globVisitor.visit","kind":"method","status":"implemented","sigHash":"9e854e1ea80d1aa8d831f20ebaf1d8a759dc1c1fb21aae86fb273c4fdd50ebc6","bodyHash":"5e57b408897ffdaa7ad111b272c6d653276715ccfbb9e729c8266d4faac056d6"}
 *
 * Go source:
 * func (v *globVisitor) visit(path, absolutePath string, depth int) {
 * 	// Detect symlink cycles
 * 	realPath := v.host.Realpath(absolutePath)
 * 	canonicalPath := tspath.GetCanonicalFileName(realPath, v.useCaseSensitiveFileNames)
 * 	if v.visited.Has(canonicalPath) {
 * 		return
 * 	}
 * 	v.visited.Add(canonicalPath)
 * 
 * 	entries := v.host.GetAccessibleEntries(absolutePath)
 * 
 * 	pathPrefix := ensureTrailingSlash(path)
 * 	absPrefix := ensureTrailingSlash(absolutePath)
 * 
 * 	for _, file := range entries.Files {
 * 		if len(v.extensions) > 0 && !tspath.FileExtensionIsOneOf(file, v.extensions) {
 * 			continue
 * 		}
 * 		if idx, ok := v.fileMatcher.matchesFileParts(absPrefix, file); ok {
 * 			v.results[idx] = append(v.results[idx], pathPrefix+file)
 * 		}
 * 	}
 * 
 * 	if depth != UnlimitedDepth {
 * 		depth--
 * 		if depth == 0 {
 * 			return
 * 		}
 * 	}
 * 
 * 	for _, dir := range entries.Directories {
 * 		if !v.directoryMatcher.matchesDirectoryParts(absPrefix, dir) {
 * 			continue
 * 		}
 * 		absDir := absPrefix + dir
 * 		v.visit(pathPrefix+dir, absDir, depth)
 * 	}
 * }
 */
export function globVisitor_visit(receiver: GoPtr<globVisitor>, path: string, absolutePath: string, depth: int): void {
  // Detect symlink cycles
  const realPath = receiver!.host.Realpath(absolutePath);
  const canonicalPath = GetCanonicalFileName(realPath, receiver!.useCaseSensitiveFileNames);
  if (Set_Has(receiver!.visited, canonicalPath)) {
    return;
  }
  Set_Add(receiver!.visited, canonicalPath);

  const entries = receiver!.host.GetAccessibleEntries(absolutePath);

  const pathPrefix = ensureTrailingSlash(path);
  const absPrefix = ensureTrailingSlash(absolutePath);

  for (const file of entries.Files) {
    if ((receiver!.extensions?.length ?? 0) > 0 && !FileExtensionIsOneOf(file, receiver!.extensions)) {
      continue;
    }
    const [idx, ok] = globMatcher_matchesFileParts(receiver!.fileMatcher, absPrefix, file);
    if (ok) {
      receiver!.results[idx]!.push(pathPrefix + file);
    }
  }

  let curDepth = depth as number;
  if (curDepth !== (UnlimitedDepth as number)) {
    curDepth--;
    if (curDepth === 0) {
      return;
    }
  }

  for (const dir of entries.Directories) {
    if (!globMatcher_matchesDirectoryParts(receiver!.directoryMatcher, absPrefix, dir)) {
      continue;
    }
    const absDir = absPrefix + dir;
    globVisitor_visit(receiver, pathPrefix + dir, absDir, curDepth as int);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::matchFiles","kind":"func","status":"implemented","sigHash":"d49c8a50798469b5926e6428bff9230615efa440d458dc3a93315cae332efe5f","bodyHash":"aa18c5216d6d70f9d6820e89fad1335a894983be199d985c81ef5f58a2f43eb9"}
 *
 * Go source:
 * func matchFiles(path string, extensions, excludes, includes []string, useCaseSensitiveFileNames bool, currentDirectory string, depth int, host vfs.FS) []string {
 * 	path = tspath.NormalizePath(path)
 * 	currentDirectory = tspath.NormalizePath(currentDirectory)
 * 	absolutePath := tspath.CombinePaths(currentDirectory, path)
 * 
 * 	fileMatcher := newGlobMatcher(includes, excludes, absolutePath, useCaseSensitiveFileNames, UsageFiles)
 * 	directoryMatcher := newGlobMatcher(includes, excludes, absolutePath, useCaseSensitiveFileNames, UsageDirectories)
 * 
 * 	v := globVisitor{
 * 		host:                      host,
 * 		fileMatcher:               fileMatcher,
 * 		directoryMatcher:          directoryMatcher,
 * 		extensions:                extensions,
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		results:                   make([][]string, max(len(fileMatcher.includes), 1)),
 * 	}
 * 
 * 	for _, basePath := range getBasePaths(path, includes, useCaseSensitiveFileNames) {
 * 		v.visit(basePath, tspath.CombinePaths(currentDirectory, basePath), depth)
 * 	}
 * 
 * 	// Fast path: a single include bucket (or no includes) doesn't need flattening.
 * 	if len(v.results) == 1 {
 * 		return v.results[0]
 * 	}
 * 	return core.Flatten(v.results)
 * }
 */
export function matchFiles(path: string, extensions: GoPtr<GoSlice<string>>, excludes: GoPtr<GoSlice<string>>, includes: GoPtr<GoSlice<string>>, useCaseSensitiveFileNames: bool, currentDirectory: string, depth: int, host: FS): GoSlice<string> {
  const normalizedPath = NormalizePath(path);
  const normalizedCurrentDir = NormalizePath(currentDirectory);
  const absolutePath = CombinePaths(normalizedCurrentDir, normalizedPath);
  const extensionList = extensions ?? [];

  const fileMatcher = newGlobMatcher(includes, excludes, absolutePath, useCaseSensitiveFileNames, UsageFiles);
  const directoryMatcher = newGlobMatcher(includes, excludes, absolutePath, useCaseSensitiveFileNames, UsageDirectories);

  const resultsLen = Math.max(fileMatcher!.includes.length, 1);
  const results: string[][] = [];
  for (let i = 0; i < resultsLen; i++) {
    results.push([]);
  }

  const v: globVisitor = {
    host: host,
    fileMatcher: fileMatcher,
    directoryMatcher: directoryMatcher,
    extensions: extensionList,
    useCaseSensitiveFileNames: useCaseSensitiveFileNames,
    visited: NewSetWithSizeHint<string>(0 as int)!,
    results: results,
  };

  for (const basePath of getBasePaths(normalizedPath, includes, useCaseSensitiveFileNames)) {
    globVisitor_visit(v, basePath, CombinePaths(normalizedCurrentDir, basePath), depth);
  }

  // Fast path: a single include bucket (or no includes) doesn't need flattening.
  if (v.results.length === 1) {
    return v.results[0]!;
  }
  return Flatten(v.results);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::type::SpecMatcher","kind":"type","status":"implemented","sigHash":"efa1ded7d567802084fc0773e49becda42e0afb57421471b94ab81ecdffe7941","bodyHash":"3f47c690592ccf63c71407d3509460a38e69aa7f7260d365e10dd3a414b43147"}
 *
 * Go source:
 * SpecMatcher struct {
 * 	patterns []globPattern
 * }
 */
export interface SpecMatcher {
  patterns: GoSlice<globPattern>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::SpecMatcher.MatchString","kind":"method","status":"implemented","sigHash":"d9de923b5bccf93191c028b5375691ad5cd2dd88c0bb2412e5c570a29c62551a","bodyHash":"4b4610c3ef1594b9963f0ddf9499fb02fc906fe611e981f5e433a6782eae72eb"}
 *
 * Go source:
 * func (m *SpecMatcher) MatchString(path string) bool {
 * 	for i := range m.patterns {
 * 		if m.patterns[i].matches(path) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function SpecMatcher_MatchString(receiver: GoPtr<SpecMatcher>, path: string): bool {
  for (let i = 0; i < receiver!.patterns.length; i++) {
    if (globPattern_matches(receiver!.patterns[i], path)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::method::SpecMatcher.MatchIndex","kind":"method","status":"implemented","sigHash":"0f9647190b3e6245530173e738fb1dbe9476a265716ca8c6254a4314dd050aea","bodyHash":"c89a96f098a0fce69f11bb70095f6da42169cce9d4a16d6c9976df4fc8fbbe16"}
 *
 * Go source:
 * func (m *SpecMatcher) MatchIndex(path string) int {
 * 	for i := range m.patterns {
 * 		if m.patterns[i].matches(path) {
 * 			return i
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function SpecMatcher_MatchIndex(receiver: GoPtr<SpecMatcher>, path: string): int {
  for (let i = 0; i < receiver!.patterns.length; i++) {
    if (globPattern_matches(receiver!.patterns[i], path)) {
      return i as int;
    }
  }
  return -1 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/vfsmatch.go::func::NewSpecMatcher","kind":"func","status":"implemented","sigHash":"9bc9a9376484f8f61e0698cdec2a3c491a79c77d02d8d2a7ffc2f283d097ce1c","bodyHash":"a6778307ad2d9dd12a180334f13af3e354a612fe3c56842e00e137546d4a243b"}
 *
 * Go source:
 * func NewSpecMatcher(specs []string, basePath string, usage Usage, useCaseSensitiveFileNames bool) *SpecMatcher {
 * 	if len(specs) == 0 {
 * 		return nil
 * 	}
 * 	patterns := make([]globPattern, 0, len(specs))
 * 	for _, spec := range specs {
 * 		if p, ok := compileGlobPattern(spec, basePath, usage, useCaseSensitiveFileNames); ok {
 * 			patterns = append(patterns, p)
 * 		}
 * 	}
 * 	if len(patterns) == 0 {
 * 		return nil
 * 	}
 * 	return &SpecMatcher{patterns: patterns}
 * }
 */
export function NewSpecMatcher(specs: GoSlice<string>, basePath: string, usage: Usage, useCaseSensitiveFileNames: bool): GoPtr<SpecMatcher> {
  if (specs.length === 0) {
    return undefined;
  }
  const patterns: globPattern[] = [];
  for (const spec of specs) {
    const [p, ok] = compileGlobPattern(spec, basePath, usage, useCaseSensitiveFileNames);
    if (ok) {
      patterns.push(p);
    }
  }
  if (patterns.length === 0) {
    return undefined;
  }
  return { patterns: patterns };
}

import type { bool, byte, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { NewGoStructMap } from "../../go/compat.js";
import type { Regexp } from "../../go/regexp.js";
import { Compile } from "../../go/regexp.js";
import * as strings from "../../go/strings.js";
import { RWMutex } from "../../go/sync.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { CompareBooleans, IndexAfter } from "../core/core.js";
import { TSTrue } from "../core/tristate.js";
import { EndingChangeable, EndingFixed } from "../module/resolver.js";
import type { ResolvedEntrypoint } from "../module/resolver.js";
import { TryGetJSExtensionForFile } from "../module/util.js";
import type { ExportsOrImports } from "../packagejson/exportsorimports.js";
import type { SourceFile } from "../ast/ast.js";
import { GetSupportedExtensions } from "../tsoptions/tsconfigparsing.js";
import type { FileExtensionInfo } from "../tsoptions/tsconfigparsing.js";
import { ScriptKindExternal, ScriptKindJSON } from "../core/scriptkind.js";
import { ChangeAnyExtension, ExtensionCjs, ExtensionCts, ExtensionDcts, ExtensionDmts, ExtensionDts, ExtensionJs, ExtensionJsx, ExtensionMjs, ExtensionMts, ExtensionTs, ExtensionTsx, FileExtensionIsOneOf, RemoveExtension, RemoveFileExtension, TryGetExtensionFromPath, GetDeclarationFileExtension } from "../tspath/extension.js";
import { ComparePaths, CompareNumberOfDirectorySeparators, GetBaseFileName, GetNormalizedAbsolutePath, GetRelativePathToDirectoryOrUrl, IsRootedDiskPath, PathIsAbsolute, PathIsRelative } from "../tspath/path.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import { GetAllowedEndingsInPreferredOrder } from "./preferences.js";
import { getAllModulePaths, getInfo, tryGetModuleNameAsNodeModule } from "./specifiers.js";
import type { ModulePath, ModuleSpecifierEnding, ModuleSpecifierGenerationHost, ModuleSpecifierOptions, SourceFileForSpecifierGeneration, UserPreferences } from "./types.js";
import { ModuleSpecifierEndingIndex, ModuleSpecifierEndingJsExtension, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingTsExtension } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::type::regexPatternCacheKey","kind":"type","status":"implemented","sigHash":"6cf9e1799f70755daf645d55437ce8e3421da2ff8fddba8a26cfcd6873f8587b","bodyHash":"63f8dffdde16d3c433e1fb857a621811381ec4edabce90ea5657ef97194fce9d"}
 *
 * Go source:
 * regexPatternCacheKey struct {
 * 	pattern         string
 * 	caseInsensitive bool
 * }
 */
export interface regexPatternCacheKey {
  pattern: string;
  caseInsensitive: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::varGroup::regexPatternCacheMu+regexPatternCache","kind":"varGroup","status":"implemented","sigHash":"9aa64f47467bebf8cb5b1a1b9d133408f03862539e109acd33e64e21801860c4","bodyHash":"ab41eec103afbd8f2e6d0700874b0bbd6630c1281f4561292c47e087f435e010"}
 *
 * Go source:
 * var (
 * 	regexPatternCacheMu sync.RWMutex
 * 	regexPatternCache   = make(map[regexPatternCacheKey]*regexp.Regexp)
 * )
 */
export const regexPatternCacheMu: RWMutex = new RWMutex();
export const regexPatternCache: GoMap<regexPatternCacheKey, GoPtr<Regexp>> = NewGoStructMap<regexPatternCacheKey, GoPtr<Regexp>>();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::comparePathsByRedirect","kind":"func","status":"implemented","sigHash":"d1ddf359d6332eede302f451c3e819b0bbd2485ea838b6b05debfaf1aaf63eca","bodyHash":"fdfc55605498de1fa827e50b1eda9800918b2bab712c7736842daf17ba308196"}
 *
 * Go source:
 * func comparePathsByRedirect(a ModulePath, b ModulePath, useCaseSensitiveFileNames bool) int {
 * 	// Redirects sort first, matching Strada's compareBooleans(b.isRedirect, a.isRedirect).
 * 	if c := core.CompareBooleans(b.IsRedirect, a.IsRedirect); c != 0 {
 * 		return c
 * 	}
 * 	if c := tspath.CompareNumberOfDirectorySeparators(a.FileName, b.FileName); c != 0 {
 * 		return c
 * 	}
 * 	// Strada relies on Map insertion order to break remaining ties deterministically;
 * 	// Go maps are unordered, so compare paths to keep the ordering stable.
 * 	return tspath.ComparePaths(a.FileName, b.FileName, tspath.ComparePathsOptions{UseCaseSensitiveFileNames: useCaseSensitiveFileNames})
 * }
 */
export function comparePathsByRedirect(a: ModulePath, b: ModulePath, useCaseSensitiveFileNames: bool): int {
  // Redirects sort first, matching Strada's compareBooleans(b.isRedirect, a.isRedirect).
  const c1 = CompareBooleans(b.IsRedirect, a.IsRedirect);
  if (c1 !== 0) {
    return c1;
  }
  const c2 = CompareNumberOfDirectorySeparators(a.FileName, b.FileName);
  if (c2 !== 0) {
    return c2;
  }
  // Strada relies on Map insertion order to break remaining ties deterministically;
  // Go maps are unordered, so compare paths to keep the ordering stable.
  return ComparePaths(a.FileName, b.FileName, { UseCaseSensitiveFileNames: useCaseSensitiveFileNames, CurrentDirectory: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::PathIsBareSpecifier","kind":"func","status":"implemented","sigHash":"e59b4811fe0e34ed3b74950fc46499f254549350ae7d13280b2d9f4fff06438b","bodyHash":"61cd1c107caa1c2536bd2012042871d4a3c07ffe8240fd19784b8af753d740ce"}
 *
 * Go source:
 * func PathIsBareSpecifier(path string) bool {
 * 	return !tspath.PathIsAbsolute(path) && !tspath.PathIsRelative(path)
 * }
 */
export function PathIsBareSpecifier(path: string): bool {
  return !PathIsAbsolute(path) && !PathIsRelative(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::IsExcludedByRegex","kind":"func","status":"implemented","sigHash":"d77979a7983433a8c124750563e010d31e2e8efc64386b59c2c56d3a0b4aee38","bodyHash":"8cd304bfec550ded5f379473b23ea14a65614d616b0cc701d93e9078b9863587"}
 *
 * Go source:
 * func IsExcludedByRegex(moduleSpecifier string, excludes []string) bool {
 * 	for _, pattern := range excludes {
 * 		re := stringToRegex(pattern)
 * 		if re == nil {
 * 			continue
 * 		}
 * 		if re.MatchString(moduleSpecifier) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsExcludedByRegex(moduleSpecifier: string, excludes: GoSlice<string>): bool {
  for (const pattern of excludes) {
    const re = stringToRegex(pattern);
    if (re === undefined) {
      continue;
    }
    if (re.MatchString(moduleSpecifier)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::stringToRegex","kind":"func","status":"implemented","sigHash":"98e2fa5bb16ffdc03a7579f0c689e066e1489319a37a366d4f1077123e53ed09","bodyHash":"48ec5cf3b473926d08fd0b76e35fa9ca0803f5bac804c3ce984fb77d1735bf01"}
 *
 * Go source:
 * func stringToRegex(pattern string) *regexp.Regexp {
 * 	caseInsensitive := false
 *
 * 	if len(pattern) > 2 && pattern[0] == '/' {
 * 		lastSlash := strings.LastIndex(pattern, "/")
 * 		if lastSlash > 0 {
 * 			hasUnescapedMiddleSlash := false
 * 			for i := 1; i < lastSlash; i++ {
 * 				if pattern[i] == '/' && (i == 0 || pattern[i-1] != '\\') {
 * 					hasUnescapedMiddleSlash = true
 * 					break
 * 				}
 * 			}
 *
 * 			if !hasUnescapedMiddleSlash {
 * 				flags := pattern[lastSlash+1:]
 * 				pattern = pattern[1:lastSlash]
 *
 * 				for _, flag := range flags {
 * 					switch flag {
 * 					case 'i':
 * 						caseInsensitive = true
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	key := regexPatternCacheKey{pattern, caseInsensitive}
 *
 * 	regexPatternCacheMu.RLock()
 * 	re, ok := regexPatternCache[key]
 * 	regexPatternCacheMu.RUnlock()
 * 	if ok {
 * 		return re
 * 	}
 *
 * 	regexPatternCacheMu.Lock()
 * 	defer regexPatternCacheMu.Unlock()
 *
 * 	re, ok = regexPatternCache[key]
 * 	if ok {
 * 		return re
 * 	}
 *
 * 	if len(regexPatternCache) > 1000 {
 * 		clear(regexPatternCache)
 * 	}
 *
 * 	pattern = strings.Clone(pattern)
 * 	key.pattern = pattern
 *
 * 	compilePattern := pattern
 * 	if caseInsensitive {
 * 		compilePattern = "(?i:" + pattern + ")"
 * 	}
 *
 * 	compiled, err := regexp.Compile(compilePattern)
 * 	if err != nil {
 * 		regexPatternCache[key] = nil
 * 		return nil
 * 	}
 * 	regexPatternCache[key] = compiled
 * 	return compiled
 * }
 */
// Internal string-keyed cache used at runtime (Go uses struct key; TS uses serialized string key)
const _regexPatternCacheInternal = new Map<string, GoPtr<Regexp>>();

export function stringToRegex(pattern: string): GoPtr<Regexp> {
  let caseInsensitive = false;

  if (pattern.length > 2 && pattern[0] === "/") {
    const lastSlash = strings.LastIndex(pattern, "/");
    if (lastSlash > 0) {
      let hasUnescapedMiddleSlash = false;
      for (let i = 1; i < lastSlash; i++) {
        if (pattern[i] === "/" && (i === 0 || pattern[i - 1] !== "\\")) {
          hasUnescapedMiddleSlash = true;
          break;
        }
      }

      if (!hasUnescapedMiddleSlash) {
        const flags = pattern.slice(lastSlash + 1);
        pattern = pattern.slice(1, lastSlash);

        for (const flag of flags) {
          switch (flag) {
            case "i":
              caseInsensitive = true;
              break;
          }
        }
      }
    }
  }

  const cacheKey = `${caseInsensitive ? "i" : ""}:${pattern}`;

  if (_regexPatternCacheInternal.has(cacheKey)) {
    return _regexPatternCacheInternal.get(cacheKey)!;
  }

  if (_regexPatternCacheInternal.size > 1000) {
    _regexPatternCacheInternal.clear();
  }

  const compilePattern = caseInsensitive ? `(?i:${pattern})` : pattern;

  const [compiled, err] = Compile(compilePattern);
  if (err !== undefined) {
    _regexPatternCacheInternal.set(cacheKey, undefined);
    return undefined;
  }
  _regexPatternCacheInternal.set(cacheKey, compiled);
  return compiled;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::ensurePathIsNonModuleName","kind":"func","status":"implemented","sigHash":"386342ce11d16d6684c275ef553033719f84bec9e63fe84dcb34a1948216b9f9","bodyHash":"2b915b2bc7f3bb9e8a9e509bd37a42ebcc135f811b59272ead17a8f475fc7122"}
 *
 * Go source:
 * func ensurePathIsNonModuleName(path string) string {
 * 	if PathIsBareSpecifier(path) {
 * 		return "./" + path
 * 	}
 * 	return path
 * }
 */
export function ensurePathIsNonModuleName(path: string): string {
  if (PathIsBareSpecifier(path)) {
    return "./" + path;
  }
  return path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::GetJSExtensionForDeclarationFileExtension","kind":"func","status":"implemented","sigHash":"8b21c9b04ee113cb934ce555238dba65f6e5dd03a0c67ee95e7042466a4c73a7","bodyHash":"d199d8cc20e26bb47cbd344bb6c62537ba65463b884252732594d0c825106398"}
 *
 * Go source:
 * func GetJSExtensionForDeclarationFileExtension(ext string) string {
 * 	switch ext {
 * 	case tspath.ExtensionDts:
 * 		return tspath.ExtensionJs
 * 	case tspath.ExtensionDmts:
 * 		return tspath.ExtensionMjs
 * 	case tspath.ExtensionDcts:
 * 		return tspath.ExtensionCjs
 * 	default:
 * 		// .d.json.ts and the like
 * 		return ext[len(".d") : len(ext)-len(tspath.ExtensionTs)]
 * 	}
 * }
 */
export function GetJSExtensionForDeclarationFileExtension(ext: string): string {
  switch (ext) {
    case ExtensionDts:
      return ExtensionJs;
    case ExtensionDmts:
      return ExtensionMjs;
    case ExtensionDcts:
      return ExtensionCjs;
    default:
      // .d.json.ts and the like
      return ext.slice(".d".length, ext.length - ExtensionTs.length);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::TryGetRealFileNameForNonJSDeclarationFileName","kind":"func","status":"implemented","sigHash":"afc447100640847c4bd64eda9e82d71088ce73bfa2f52ca64de070d599d07745","bodyHash":"402a0fcda7f348347ef6eb45c4a06bdbc541a8d977040e085f4a7e45e2edfe69"}
 *
 * Go source:
 * func TryGetRealFileNameForNonJSDeclarationFileName(fileName string) string {
 * 	baseName := tspath.GetBaseFileName(fileName)
 * 	// Ends with .ts, contains ".d.", and is NOT a standard .d.ts file
 * 	if !strings.HasSuffix(fileName, tspath.ExtensionTs) ||
 * 		!strings.Contains(baseName, ".d.") ||
 * 		strings.HasSuffix(baseName, tspath.ExtensionDts) {
 * 		return ""
 * 	}
 * 	noExtension := tspath.RemoveExtension(fileName, tspath.ExtensionTs)
 * 	lastDotIndex := strings.LastIndex(noExtension, ".")
 * 	ext := noExtension[lastDotIndex:]
 * 	before, _, _ := strings.Cut(noExtension, ".d.")
 * 	return before + ext
 * }
 */
export function TryGetRealFileNameForNonJSDeclarationFileName(fileName: string): string {
  const baseName = GetBaseFileName(fileName);
  // Ends with .ts, contains ".d.", and is NOT a standard .d.ts file
  if (!strings.HasSuffix(fileName, ExtensionTs) ||
    !strings.Contains(baseName, ".d.") ||
    strings.HasSuffix(baseName, ExtensionDts)) {
    return "";
  }
  const noExtension = RemoveExtension(fileName, ExtensionTs);
  const lastDotIndex = strings.LastIndex(noExtension, ".");
  const ext = noExtension.slice(lastDotIndex);
  const [before] = strings.Cut(noExtension, ".d.");
  return before + ext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::getJSExtensionForFile","kind":"func","status":"implemented","sigHash":"9126c08bec1e238bb1410328f11e9a883788db20301c6a5dfd9ce7c149e9d929","bodyHash":"d5e50961d0c62f4f7b0be92c6d1e6630b4cea737d4fdbb67525a25f4b782a421"}
 *
 * Go source:
 * func getJSExtensionForFile(fileName string, options *core.CompilerOptions) string {
 * 	result := module.TryGetJSExtensionForFile(fileName, options)
 * 	if len(result) == 0 {
 * 		panic(fmt.Sprintf("Extension %s is unsupported:: FileName:: %s", extensionFromPath(fileName), fileName))
 * 	}
 * 	return result
 * }
 */
export function getJSExtensionForFile(fileName: string, options: GoPtr<CompilerOptions>): string {
  const result = TryGetJSExtensionForFile(fileName, options);
  if (result.length === 0) {
    throw new globalThis.Error(`Extension ${extensionFromPath(fileName)} is unsupported:: FileName:: ${fileName}`);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::extensionFromPath","kind":"func","status":"implemented","sigHash":"7508b784e333e0f622d78d17f2ba7597327389ebb55af53a52cf989613892b81","bodyHash":"9dfc1fefbe9699e5cd998a816135501092b5684421b10a7434a8129de173103a"}
 *
 * Go source:
 * func extensionFromPath(path string) string {
 * 	ext := tspath.TryGetExtensionFromPath(path)
 * 	if len(ext) == 0 {
 * 		panic(fmt.Sprintf("File %s has unknown extension.", path))
 * 	}
 * 	return ext
 * }
 */
export function extensionFromPath(path: string): string {
  const ext = TryGetExtensionFromPath(path);
  if (ext.length === 0) {
    throw new globalThis.Error(`File ${path} has unknown extension.`);
  }
  return ext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::tryGetAnyFileFromPath","kind":"func","status":"implemented","sigHash":"541dbc1ea92bd9de4c7a3d0064593109947b80011ebc08efb1291cf75500351d","bodyHash":"19edef099f4422cd891912518ac9444ababda4a5c648d27e68e2131556b869da"}
 *
 * Go source:
 * func tryGetAnyFileFromPath(host ModuleSpecifierGenerationHost, path string) bool {
 * 	// !!! TODO: shouldn't this use readdir instead of fileexists for perf?
 * 	// We check all js, `node` and `json` extensions in addition to TS, since node module resolution would also choose those over the directory
 * 	extGroups := tsoptions.GetSupportedExtensions(
 * 		&core.CompilerOptions{
 * 			AllowJs: core.TSTrue,
 * 		},
 * 		[]tsoptions.FileExtensionInfo{
 * 			{
 * 				Extension:      "node",
 * 				IsMixedContent: false,
 * 				ScriptKind:     core.ScriptKindExternal,
 * 			},
 * 			{
 * 				Extension:      "json",
 * 				IsMixedContent: false,
 * 				ScriptKind:     core.ScriptKindJSON,
 * 			},
 * 		},
 * 	)
 * 	for _, exts := range extGroups {
 * 		for _, e := range exts {
 * 			fullPath := path + e
 * 			if host.FileExists(tspath.GetNormalizedAbsolutePath(fullPath, host.GetCurrentDirectory())) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function tryGetAnyFileFromPath(host: ModuleSpecifierGenerationHost, path: string): bool {
  // !!! TODO: shouldn't this use readdir instead of fileexists for perf?
  // We check all js, `node` and `json` extensions in addition to TS, since node module resolution would also choose those over the directory
  const extGroups = GetSupportedExtensions(
    { AllowJs: TSTrue } as Parameters<typeof GetSupportedExtensions>[0],
    [
      {
        Extension: "node",
        IsMixedContent: false,
        ScriptKind: ScriptKindExternal,
      } as FileExtensionInfo,
      {
        Extension: "json",
        IsMixedContent: false,
        ScriptKind: ScriptKindJSON,
      } as FileExtensionInfo,
    ],
  );
  for (const exts of extGroups) {
    for (const e of exts) {
      const fullPath = path + e;
      if (host.FileExists(GetNormalizedAbsolutePath(fullPath, host.GetCurrentDirectory()))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::getPathsRelativeToRootDirs","kind":"func","status":"implemented","sigHash":"d6d5537ab878449108d49d28c8d9905405110a0ac7b953a8154da83967f93fbe","bodyHash":"138aae75db3f2a38f76b2b171e1f68fd12accab4fe4d8f5178796b67eab15020"}
 *
 * Go source:
 * func getPathsRelativeToRootDirs(path string, rootDirs []string, useCaseSensitiveFileNames bool) []string {
 * 	var results []string
 * 	for _, rootDir := range rootDirs {
 * 		relativePath := getRelativePathIfInSameVolume(path, rootDir, useCaseSensitiveFileNames)
 * 		if !isPathRelativeToParent(relativePath) {
 * 			results = append(results, relativePath)
 * 		}
 * 	}
 * 	return results
 * }
 */
export function getPathsRelativeToRootDirs(path: string, rootDirs: GoSlice<string>, useCaseSensitiveFileNames: bool): GoSlice<string> {
  const results: string[] = [];
  for (const rootDir of rootDirs) {
    const relativePath = getRelativePathIfInSameVolume(path, rootDir, useCaseSensitiveFileNames);
    if (!isPathRelativeToParent(relativePath)) {
      results.push(relativePath);
    }
  }
  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::isPathRelativeToParent","kind":"func","status":"implemented","sigHash":"58a8a5550c8c2a3d9f4a40ca1ff903ae991a245c6b223aeee7c9ec72f5d26961","bodyHash":"8a60d30bf6d9f43487ce96e862c0c727215e3d8ca8050061fbfde5b7777fa381"}
 *
 * Go source:
 * func isPathRelativeToParent(path string) bool {
 * 	return strings.HasPrefix(path, "..")
 * }
 */
export function isPathRelativeToParent(path: string): bool {
  return strings.HasPrefix(path, "..");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::getRelativePathIfInSameVolume","kind":"func","status":"implemented","sigHash":"6040e78b03b84605583949d1c472133636db53cbe8b4d50fdaaa7db205765494","bodyHash":"094edaaa2bc32eeee9b66932539bc2d18339d6b7a4725235cff849655e11cbb5"}
 *
 * Go source:
 * func getRelativePathIfInSameVolume(path string, directoryPath string, useCaseSensitiveFileNames bool) string {
 * 	relativePath := tspath.GetRelativePathToDirectoryOrUrl(directoryPath, path, false, tspath.ComparePathsOptions{
 * 		UseCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		CurrentDirectory:          directoryPath,
 * 	})
 * 	if tspath.IsRootedDiskPath(relativePath) {
 * 		return ""
 * 	}
 * 	return relativePath
 * }
 */
export function getRelativePathIfInSameVolume(path: string, directoryPath: string, useCaseSensitiveFileNames: bool): string {
  const relativePath = GetRelativePathToDirectoryOrUrl(directoryPath, path, false, {
    UseCaseSensitiveFileNames: useCaseSensitiveFileNames,
    CurrentDirectory: directoryPath,
  });
  if (IsRootedDiskPath(relativePath)) {
    return "";
  }
  return relativePath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::packageJsonPathsAreEqual","kind":"func","status":"implemented","sigHash":"83030f2af64b2fec7efe3ff10c17b7cb9d2e219a3c8e2a59acc1eb2ae7bfc94e","bodyHash":"109f3063524b454b9e46f00290a784ea596a189ec83d607b6f4d85d0f0af6d63"}
 *
 * Go source:
 * func packageJsonPathsAreEqual(a string, b string, options tspath.ComparePathsOptions) bool {
 * 	if a == b {
 * 		return true
 * 	}
 * 	if len(a) == 0 || len(b) == 0 {
 * 		return false
 * 	}
 * 	return tspath.ComparePaths(a, b, options) == 0
 * }
 */
export function packageJsonPathsAreEqual(a: string, b: string, options: ComparePathsOptions): bool {
  if (a === b) {
    return true;
  }
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  return ComparePaths(a, b, options) === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::prefersTsExtension","kind":"func","status":"implemented","sigHash":"e5024ba6bb6cb39fcda5e8d225edce1100732a540592a9a7d74f279f7c3bda77","bodyHash":"a7df49bdf9b8022c001d735f6d4c85379a1354c65c4e9572dc8cde101735f894"}
 *
 * Go source:
 * func prefersTsExtension(allowedEndings []ModuleSpecifierEnding) bool {
 * 	jsPriority := slices.Index(allowedEndings, ModuleSpecifierEndingJsExtension)
 * 	tsPriority := slices.Index(allowedEndings, ModuleSpecifierEndingTsExtension)
 * 	if tsPriority > -1 {
 * 		return tsPriority < jsPriority
 * 	}
 * 	return false
 * }
 */
export function prefersTsExtension(allowedEndings: GoSlice<ModuleSpecifierEnding>): bool {
  const jsPriority = allowedEndings.indexOf(ModuleSpecifierEndingJsExtension);
  const tsPriority = allowedEndings.indexOf(ModuleSpecifierEndingTsExtension);
  if (tsPriority > -1) {
    return tsPriority < jsPriority;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::replaceFirstStar","kind":"func","status":"implemented","sigHash":"4f49d9372d7ff3145ef69e0e99af26e1de7c253cf22edb11ad3b353f2d1fe5fe","bodyHash":"390d725d99e3c353e7cf21081db44931a14de7f2ecc190056346aaf06ae74ec7"}
 *
 * Go source:
 * func replaceFirstStar(s string, replacement string) string {
 * 	return strings.Replace(s, "*", replacement, 1)
 * }
 */
export function replaceFirstStar(s: string, replacement: string): string {
  return strings.Replace(s, "*", replacement, 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::type::NodeModulePathParts","kind":"type","status":"implemented","sigHash":"b5b1cb01bfc5393dcce61ab60ef38adbc62a27daea33325719a4f99ae2e1f2ec","bodyHash":"8ff5af92e2086ff0ddaf52d0a7a4e62f2d7b728000ebf6f87223fb7f0f59768b"}
 *
 * Go source:
 * NodeModulePathParts struct {
 * 	TopLevelNodeModulesIndex int
 * 	TopLevelPackageNameIndex int
 * 	PackageRootIndex         int
 * 	FileNameIndex            int
 * }
 */
export interface NodeModulePathParts {
  TopLevelNodeModulesIndex: int;
  TopLevelPackageNameIndex: int;
  PackageRootIndex: int;
  FileNameIndex: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::type::nodeModulesPathParseState","kind":"type","status":"implemented","sigHash":"c7e33d4d1d27a2a7752f47b946cee24ae2ff3b5eedae3bed43cfff2b86b1f30f","bodyHash":"b05bf61b23d305f8385e94b756f3438334561a1892f455a44d76116610b2c95a"}
 *
 * Go source:
 * nodeModulesPathParseState uint8
 */
export type nodeModulesPathParseState = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::constGroup::nodeModulesPathParseStateBeforeNodeModules+nodeModulesPathParseStateNodeModules+nodeModulesPathParseStateScope+nodeModulesPathParseStatePackageContent","kind":"constGroup","status":"implemented","sigHash":"753250fdf882228fe5327d20747e9e160fd30dec4a9e6d4c57084ae1110288f1","bodyHash":"b1766c5c6fff88a0a3b75b734c5f1a5e42a16104ac10fb56889308db3dc1817b"}
 *
 * Go source:
 * const (
 * 	nodeModulesPathParseStateBeforeNodeModules nodeModulesPathParseState = iota
 * 	nodeModulesPathParseStateNodeModules
 * 	nodeModulesPathParseStateScope
 * 	nodeModulesPathParseStatePackageContent
 * )
 */
export const nodeModulesPathParseStateBeforeNodeModules: nodeModulesPathParseState = 0 as nodeModulesPathParseState;
export const nodeModulesPathParseStateNodeModules: nodeModulesPathParseState = 1 as nodeModulesPathParseState;
export const nodeModulesPathParseStateScope: nodeModulesPathParseState = 2 as nodeModulesPathParseState;
export const nodeModulesPathParseStatePackageContent: nodeModulesPathParseState = 3 as nodeModulesPathParseState;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::GetNodeModulePathParts","kind":"func","status":"implemented","sigHash":"0961c5f0b343f13e819fe5d56f9be2c49ab4a9030236c73015ebe892f2f1ec65","bodyHash":"4b625131d14340319fda0199e956969168702cfbbe7f3fb86bee9f8c2cbd9b37"}
 *
 * Go source:
 * func GetNodeModulePathParts(fullPath string) *NodeModulePathParts {
 * 	// If fullPath can't be valid module file within node_modules, returns undefined.
 * 	// Example of expected pattern: /base/path/node_modules/[@scope/otherpackage/@otherscope/node_modules/]package/[subdirectory/]file.js
 * 	// Returns indices:                       ^            ^                                                      ^             ^
 *
 * 	topLevelNodeModulesIndex := 0
 * 	topLevelPackageNameIndex := 0
 * 	packageRootIndex := 0
 * 	fileNameIndex := 0
 *
 * 	partStart := 0
 * 	partEnd := 0
 * 	state := nodeModulesPathParseStateBeforeNodeModules
 *
 * 	for partEnd >= 0 {
 * 		partStart = partEnd
 * 		partEnd = core.IndexAfter(fullPath, "/", partStart+1)
 * 		switch state {
 * 		case nodeModulesPathParseStateBeforeNodeModules:
 * 			if strings.Index(fullPath[partStart:], "/node_modules/") == 0 {
 * 				topLevelNodeModulesIndex = partStart
 * 				topLevelPackageNameIndex = partEnd
 * 				state = nodeModulesPathParseStateNodeModules
 * 			}
 * 		case nodeModulesPathParseStateNodeModules, nodeModulesPathParseStateScope:
 * 			if state == nodeModulesPathParseStateNodeModules && fullPath[partStart+1] == '@' {
 * 				state = nodeModulesPathParseStateScope
 * 			} else {
 * 				packageRootIndex = partEnd
 * 				state = nodeModulesPathParseStatePackageContent
 * 			}
 * 		case nodeModulesPathParseStatePackageContent:
 * 			if strings.Index(fullPath[partStart:], "/node_modules/") == 0 {
 * 				state = nodeModulesPathParseStateNodeModules
 * 			} else {
 * 				state = nodeModulesPathParseStatePackageContent
 * 			}
 * 		}
 * 	}
 *
 * 	fileNameIndex = partStart
 *
 * 	if state > nodeModulesPathParseStateNodeModules {
 * 		return &NodeModulePathParts{
 * 			TopLevelNodeModulesIndex: topLevelNodeModulesIndex,
 * 			TopLevelPackageNameIndex: topLevelPackageNameIndex,
 * 			PackageRootIndex:         packageRootIndex,
 * 			FileNameIndex:            fileNameIndex,
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetNodeModulePathParts(fullPath: string): GoPtr<NodeModulePathParts> {
  // If fullPath can't be valid module file within node_modules, returns undefined.
  // Example of expected pattern: /base/path/node_modules/[@scope/otherpackage/@otherscope/node_modules/]package/[subdirectory/]file.js
  // Returns indices:                       ^            ^                                                      ^             ^

  let topLevelNodeModulesIndex = 0;
  let topLevelPackageNameIndex = 0;
  let packageRootIndex = 0;
  let fileNameIndex = 0;

  let partStart = 0;
  let partEnd = 0;
  let state: nodeModulesPathParseState = nodeModulesPathParseStateBeforeNodeModules;

  for (; partEnd >= 0;) {
    partStart = partEnd;
    partEnd = IndexAfter(fullPath, "/", partStart + 1);
    switch (state) {
      case nodeModulesPathParseStateBeforeNodeModules:
        if (strings.Index(fullPath.slice(partStart), "/node_modules/") === 0) {
          topLevelNodeModulesIndex = partStart;
          topLevelPackageNameIndex = partEnd;
          state = nodeModulesPathParseStateNodeModules;
        }
        break;
      case nodeModulesPathParseStateNodeModules:
      case nodeModulesPathParseStateScope:
        if (state === nodeModulesPathParseStateNodeModules && fullPath[partStart + 1] === "@") {
          state = nodeModulesPathParseStateScope;
        } else {
          packageRootIndex = partEnd;
          state = nodeModulesPathParseStatePackageContent;
        }
        break;
      case nodeModulesPathParseStatePackageContent:
        if (strings.Index(fullPath.slice(partStart), "/node_modules/") === 0) {
          state = nodeModulesPathParseStateNodeModules;
        } else {
          state = nodeModulesPathParseStatePackageContent;
        }
        break;
    }
  }

  fileNameIndex = partStart;

  if (state > nodeModulesPathParseStateNodeModules) {
    return {
      TopLevelNodeModulesIndex: topLevelNodeModulesIndex,
      TopLevelPackageNameIndex: topLevelPackageNameIndex,
      PackageRootIndex: packageRootIndex,
      FileNameIndex: fileNameIndex,
    };
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::GetNodeModulesPackageName","kind":"func","status":"implemented","sigHash":"5cd549e10f17cb8a849869e457a62a71542819f5867c4dc7319fe1be6b0f83cd","bodyHash":"2a9af476d9942b8b7e5708ba43fb05f2606813dea9fa8d1f3fd288f2af2ae24d"}
 *
 * Go source:
 * func GetNodeModulesPackageName(
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile *ast.SourceFile, // !!! | FutureSourceFile
 * 	nodeModulesFileName string,
 * 	host ModuleSpecifierGenerationHost,
 * 	preferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * ) string {
 * 	info := getInfo(importingSourceFile.FileName(), host)
 * 	modulePaths := getAllModulePaths(info, nodeModulesFileName, host, compilerOptions, preferences, options)
 * 	for _, modulePath := range modulePaths {
 * 		if result := tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile, host, compilerOptions, preferences, true /*packageNameOnly* /, options.OverrideImportMode); len(result) > 0 {
 * 			return result
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function GetNodeModulesPackageName(compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: GoPtr<SourceFile>, nodeModulesFileName: string, host: ModuleSpecifierGenerationHost, preferences: UserPreferences, options: ModuleSpecifierOptions): string {
  const info = getInfo(importingSourceFile!.FileName(), host);
  const modulePaths = getAllModulePaths(info, nodeModulesFileName, host, compilerOptions, preferences, options);
  for (const modulePath of modulePaths) {
    const result = tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile!, host, compilerOptions, preferences, true /*packageNameOnly*/, options.OverrideImportMode);
    if (result.length > 0) {
      return result;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::allKeysStartWithDot","kind":"func","status":"implemented","sigHash":"dfa5c55d4674d12fc3b95a141a92945a864c82bd85523123c90b446a77c056f0","bodyHash":"9a7ec67e9db7e3cab7c1dab3a81a8c35ec99fb2fbdaf86759e2f50d18c9d165f"}
 *
 * Go source:
 * func allKeysStartWithDot(obj *collections.OrderedMap[string, packagejson.ExportsOrImports]) bool {
 * 	for k := range obj.Keys() {
 * 		if !strings.HasPrefix(k, ".") {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function allKeysStartWithDot(obj: GoPtr<OrderedMap<string, ExportsOrImports>>): bool {
  const keys = obj!.keys as string[];
  for (const k of keys) {
    if (!strings.HasPrefix(k, ".")) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::GetPackageNameFromDirectory","kind":"func","status":"implemented","sigHash":"3b2e3fcad19d78ba20ab33a0053b33a11058268a0a83345145900fbb7d12f693","bodyHash":"6197a9da9db26234fda13ea631f59833c711508d930f132f9a5e5a8b0fd79d8a"}
 *
 * Go source:
 * func GetPackageNameFromDirectory(fileOrDirectoryPath string) string {
 * 	idx := strings.LastIndex(fileOrDirectoryPath, "/node_modules/")
 * 	if idx == -1 {
 * 		return ""
 * 	}
 *
 * 	basename := fileOrDirectoryPath[idx+len("/node_modules/"):]
 * 	if basename[0] == '.' {
 * 		return ""
 * 	}
 *
 * 	nextSlash := strings.Index(basename, "/")
 * 	if nextSlash == -1 {
 * 		return basename
 * 	}
 *
 * 	if basename[0] != '@' || nextSlash == len(basename)-1 {
 * 		return basename[:nextSlash]
 * 	}
 *
 * 	secondSlash := strings.Index(basename[nextSlash+1:], "/")
 * 	if secondSlash == -1 {
 * 		return basename
 * 	}
 *
 * 	return basename[:nextSlash+1+secondSlash]
 * }
 */
export function GetPackageNameFromDirectory(fileOrDirectoryPath: string): string {
  const idx = strings.LastIndex(fileOrDirectoryPath, "/node_modules/");
  if (idx === -1) {
    return "";
  }

  const basename = fileOrDirectoryPath.slice(idx + "/node_modules/".length);
  if (basename[0] === ".") {
    return "";
  }

  const nextSlash = strings.Index(basename, "/");
  if (nextSlash === -1) {
    return basename;
  }

  if (basename[0] !== "@" || nextSlash === basename.length - 1) {
    return basename.slice(0, nextSlash);
  }

  const secondSlash = strings.Index(basename.slice(nextSlash + 1), "/");
  if (secondSlash === -1) {
    return basename;
  }

  return basename.slice(0, nextSlash + 1 + secondSlash);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/util.go::func::ProcessEntrypointEnding","kind":"func","status":"implemented","sigHash":"9868fe736421f3848b18b83dc1538893cf8f892b2361de5d6f0555d8ec7ad21b","bodyHash":"1e00589f7b6405538b4eaa1ac5109e73cd61a808582daa32aad6ca624ae45b27"}
 *
 * Go source:
 * func ProcessEntrypointEnding(
 * 	entrypoint *module.ResolvedEntrypoint,
 * 	prefs UserPreferences,
 * 	host ModuleSpecifierGenerationHost,
 * 	options *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	allowedEndings []ModuleSpecifierEnding,
 * ) string {
 * 	specifier := entrypoint.ModuleSpecifier
 * 	if entrypoint.Ending == module.EndingFixed {
 * 		return specifier
 * 	}
 *
 * 	if len(allowedEndings) == 0 {
 * 		allowedEndings = GetAllowedEndingsInPreferredOrder(
 * 			prefs,
 * 			host,
 * 			options,
 * 			importingSourceFile,
 * 			"",
 * 			host.GetDefaultResolutionModeForFile(importingSourceFile),
 * 		)
 * 	}
 *
 * 	preferredEnding := allowedEndings[0]
 *
 * 	// Handle declaration file extensions
 * 	dtsExtension := tspath.GetDeclarationFileExtension(specifier)
 * 	if dtsExtension != "" {
 * 		switch preferredEnding {
 * 		case ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingJsExtension:
 * 			// Map .d.ts -> .js, .d.mts -> .mjs, .d.cts -> .cjs
 * 			jsExtension := GetJSExtensionForDeclarationFileExtension(dtsExtension)
 * 			return tspath.ChangeAnyExtension(specifier, jsExtension, []string{dtsExtension}, false)
 * 		case ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex:
 * 			if entrypoint.Ending == module.EndingChangeable {
 * 				// .d.mts/.d.cts must keep an extension; rewrite to .mjs/.cjs instead of dropping
 * 				if dtsExtension == tspath.ExtensionDts {
 * 					specifier = tspath.RemoveExtension(specifier, dtsExtension)
 * 					if preferredEnding == ModuleSpecifierEndingMinimal {
 * 						specifier = strings.TrimSuffix(specifier, "/index")
 * 					}
 * 					return specifier
 * 				}
 * 				jsExtension := GetJSExtensionForDeclarationFileExtension(dtsExtension)
 * 				return tspath.ChangeAnyExtension(specifier, jsExtension, []string{dtsExtension}, false)
 * 			}
 * 			// EndingExtensionChangeable - can only change extension, not remove it
 * 			jsExtension := GetJSExtensionForDeclarationFileExtension(dtsExtension)
 * 			return tspath.ChangeAnyExtension(specifier, jsExtension, []string{dtsExtension}, false)
 * 		}
 * 		return specifier
 * 	}
 *
 * 	// Handle .ts/.tsx/.mts/.cts extensions
 * 	if tspath.FileExtensionIsOneOf(specifier, []string{tspath.ExtensionTs, tspath.ExtensionTsx, tspath.ExtensionMts, tspath.ExtensionCts}) {
 * 		switch preferredEnding {
 * 		case ModuleSpecifierEndingTsExtension:
 * 			return specifier
 * 		case ModuleSpecifierEndingJsExtension:
 * 			if jsExtension := module.TryGetJSExtensionForFile(specifier, options); jsExtension != "" {
 * 				return tspath.RemoveFileExtension(specifier) + jsExtension
 * 			}
 * 			return specifier
 * 		case ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex:
 * 			if entrypoint.Ending == module.EndingChangeable {
 * 				specifier = tspath.RemoveFileExtension(specifier)
 * 				if preferredEnding == ModuleSpecifierEndingMinimal {
 * 					specifier = strings.TrimSuffix(specifier, "/index")
 * 				}
 * 				return specifier
 * 			}
 * 			// EndingExtensionChangeable - can only change extension, not remove it
 * 			if jsExtension := module.TryGetJSExtensionForFile(specifier, options); jsExtension != "" {
 * 				return tspath.RemoveFileExtension(specifier) + jsExtension
 * 			}
 * 			return specifier
 * 		}
 * 		return specifier
 * 	}
 *
 * 	// Handle .js/.jsx/.mjs/.cjs extensions
 * 	if tspath.FileExtensionIsOneOf(specifier, []string{tspath.ExtensionJs, tspath.ExtensionJsx, tspath.ExtensionMjs, tspath.ExtensionCjs}) {
 * 		switch preferredEnding {
 * 		case ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingJsExtension:
 * 			return specifier
 * 		case ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex:
 * 			if entrypoint.Ending == module.EndingChangeable {
 * 				specifier = tspath.RemoveFileExtension(specifier)
 * 				if preferredEnding == ModuleSpecifierEndingMinimal {
 * 					specifier = strings.TrimSuffix(specifier, "/index")
 * 				}
 * 				return specifier
 * 			}
 * 			// EndingExtensionChangeable - keep the extension
 * 			return specifier
 * 		}
 * 		return specifier
 * 	}
 *
 * 	// For other extensions (like .json), return as-is
 * 	return specifier
 * }
 */
export function ProcessEntrypointEnding(entrypoint: GoPtr<ResolvedEntrypoint>, prefs: UserPreferences, host: ModuleSpecifierGenerationHost, options: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, allowedEndings: GoSlice<ModuleSpecifierEnding>): string {
  let specifier = entrypoint!.ModuleSpecifier;
  if (entrypoint!.Ending === EndingFixed) {
    return specifier;
  }

  if (allowedEndings.length === 0) {
    allowedEndings = GetAllowedEndingsInPreferredOrder(
      prefs,
      host,
      options,
      importingSourceFile,
      "",
      host.GetDefaultResolutionModeForFile(importingSourceFile),
    );
  }

  const preferredEnding = allowedEndings[0];

  // Handle declaration file extensions
  const dtsExtension = GetDeclarationFileExtension(specifier);
  if (dtsExtension !== "") {
    switch (preferredEnding) {
      case ModuleSpecifierEndingTsExtension:
      case ModuleSpecifierEndingJsExtension: {
        // Map .d.ts -> .js, .d.mts -> .mjs, .d.cts -> .cjs
        const jsExtension = GetJSExtensionForDeclarationFileExtension(dtsExtension);
        return ChangeAnyExtension(specifier, jsExtension, [dtsExtension], false);
      }
      case ModuleSpecifierEndingMinimal:
      case ModuleSpecifierEndingIndex:
        if (entrypoint!.Ending === EndingChangeable) {
          // .d.mts/.d.cts must keep an extension; rewrite to .mjs/.cjs instead of dropping
          if (dtsExtension === ExtensionDts) {
            specifier = RemoveExtension(specifier, dtsExtension);
            if (preferredEnding === ModuleSpecifierEndingMinimal) {
              specifier = strings.TrimSuffix(specifier, "/index");
            }
            return specifier;
          }
          const jsExtension2 = GetJSExtensionForDeclarationFileExtension(dtsExtension);
          return ChangeAnyExtension(specifier, jsExtension2, [dtsExtension], false);
        }
        // EndingExtensionChangeable - can only change extension, not remove it
        {
          const jsExtension3 = GetJSExtensionForDeclarationFileExtension(dtsExtension);
          return ChangeAnyExtension(specifier, jsExtension3, [dtsExtension], false);
        }
    }
    return specifier;
  }

  // Handle .ts/.tsx/.mts/.cts extensions
  if (FileExtensionIsOneOf(specifier, [ExtensionTs, ExtensionTsx, ExtensionMts, ExtensionCts])) {
    switch (preferredEnding) {
      case ModuleSpecifierEndingTsExtension:
        return specifier;
      case ModuleSpecifierEndingJsExtension: {
        const jsExtension = TryGetJSExtensionForFile(specifier, options);
        if (jsExtension !== "") {
          return RemoveFileExtension(specifier) + jsExtension;
        }
        return specifier;
      }
      case ModuleSpecifierEndingMinimal:
      case ModuleSpecifierEndingIndex:
        if (entrypoint!.Ending === EndingChangeable) {
          specifier = RemoveFileExtension(specifier);
          if (preferredEnding === ModuleSpecifierEndingMinimal) {
            specifier = strings.TrimSuffix(specifier, "/index");
          }
          return specifier;
        }
        // EndingExtensionChangeable - can only change extension, not remove it
        {
          const jsExtension2 = TryGetJSExtensionForFile(specifier, options);
          if (jsExtension2 !== "") {
            return RemoveFileExtension(specifier) + jsExtension2;
          }
          return specifier;
        }
    }
    return specifier;
  }

  // Handle .js/.jsx/.mjs/.cjs extensions
  if (FileExtensionIsOneOf(specifier, [ExtensionJs, ExtensionJsx, ExtensionMjs, ExtensionCjs])) {
    switch (preferredEnding) {
      case ModuleSpecifierEndingTsExtension:
      case ModuleSpecifierEndingJsExtension:
        return specifier;
      case ModuleSpecifierEndingMinimal:
      case ModuleSpecifierEndingIndex:
        if (entrypoint!.Ending === EndingChangeable) {
          specifier = RemoveFileExtension(specifier);
          if (preferredEnding === ModuleSpecifierEndingMinimal) {
            specifier = strings.TrimSuffix(specifier, "/index");
          }
          return specifier;
        }
        // EndingExtensionChangeable - keep the extension
        return specifier;
    }
    return specifier;
  }

  // For other extensions (like .json), return as-is
  return specifier;
}

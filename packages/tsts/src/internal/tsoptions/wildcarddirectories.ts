import type { bool } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import * as strings from "../../go/strings.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import {
  CombinePaths,
  ContainsPath,
  DirectorySeparator,
  NormalizeSlashes,
  RemoveTrailingDirectorySeparator,
} from "../tspath/path.js";
import { IsImplicitGlob, NewSpecMatcher, SpecMatcher_MatchString, UsageExclude } from "../vfs/vfsmatch/vfsmatch.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/wildcarddirectories.go::func::getWildcardDirectories","kind":"func","status":"implemented","sigHash":"b28e9bda9ec15acd9b0664a3466d8c69e2ffb017497fc37e43d86c9d83e55cc2","bodyHash":"90afd2eb741b92625e581f99a44751a737fc8fdc2e18ec4fd42fdf37abbaef62"}
 *
 * Go source:
 * func getWildcardDirectories(include []string, exclude []string, comparePathsOptions tspath.ComparePathsOptions) map[string]bool {
 * 	// We watch a directory recursively if it contains a wildcard anywhere in a directory segment
 * 	// of the pattern:
 * 	//
 * 	//  /a/b/** /d   - Watch /a/b recursively to catch changes to any d in any subfolder recursively
 * 	//  /a/b/* /d    - Watch /a/b recursively to catch any d in any immediate subfolder, even if a new subfolder is added
 * 	//  /a/b        - Watch /a/b recursively to catch changes to anything in any recursive subfoler
 * 	//
 * 	// We watch a directory without recursion if it contains a wildcard in the file segment of
 * 	// the pattern:
 * 	//
 * 	//  /a/b/*      - Watch /a/b directly to catch any new file
 * 	//  /a/b/a?z    - Watch /a/b directly to catch any new file matching a?z
 *
 * 	if len(include) == 0 {
 * 		return nil
 * 	}
 *
 * 	excludeMatcher := vfsmatch.NewSpecMatcher(exclude, comparePathsOptions.CurrentDirectory, vfsmatch.UsageExclude, comparePathsOptions.UseCaseSensitiveFileNames)
 *
 * 	wildcardDirectories := make(map[string]bool)
 * 	wildCardKeyToPath := make(map[string]string)
 *
 * 	var recursiveKeys []string
 *
 * 	for _, file := range include {
 * 		spec := tspath.NormalizeSlashes(tspath.CombinePaths(comparePathsOptions.CurrentDirectory, file))
 * 		if excludeMatcher != nil && excludeMatcher.MatchString(spec) {
 * 			continue
 * 		}
 *
 * 		match := getWildcardDirectoryFromSpec(spec, comparePathsOptions.UseCaseSensitiveFileNames)
 * 		if match != nil {
 * 			key := match.Key
 * 			path := match.Path
 * 			recursive := match.Recursive
 *
 * 			existingPath, existsPath := wildCardKeyToPath[key]
 * 			var existingRecursive bool
 *
 * 			if existsPath {
 * 				existingRecursive = wildcardDirectories[existingPath]
 * 			}
 *
 * 			if !existsPath || (!existingRecursive && recursive) {
 * 				pathToUse := path
 * 				if existsPath {
 * 					pathToUse = existingPath
 * 				}
 * 				wildcardDirectories[pathToUse] = recursive
 *
 * 				if !existsPath {
 * 					wildCardKeyToPath[key] = path
 * 				}
 *
 * 				if recursive {
 * 					recursiveKeys = append(recursiveKeys, key)
 * 				}
 * 			}
 * 		}
 *
 * 		// Remove any subpaths under an existing recursively watched directory
 * 		for path := range wildcardDirectories {
 * 			for _, recursiveKey := range recursiveKeys {
 * 				key := toCanonicalKey(path, comparePathsOptions.UseCaseSensitiveFileNames)
 * 				if key != recursiveKey && tspath.ContainsPath(recursiveKey, key, comparePathsOptions) {
 * 					delete(wildcardDirectories, path)
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	return wildcardDirectories
 * }
 */
export function getWildcardDirectories(
  include: GoSlice<string>,
  exclude: GoSlice<string>,
  comparePathsOptions: ComparePathsOptions,
): GoMap<string, bool> {
  // We watch a directory recursively if it contains a wildcard anywhere in a directory segment
  // of the pattern:
  //
  //  /a/b/**/d   - Watch /a/b recursively to catch changes to any d in any subfolder recursively
  //  /a/b/*/d    - Watch /a/b recursively to catch any d in any immediate subfolder, even if a new subfolder is added
  //  /a/b        - Watch /a/b recursively to catch changes to anything in any recursive subfoler
  //
  // We watch a directory without recursion if it contains a wildcard in the file segment of
  // the pattern:
  //
  //  /a/b/*      - Watch /a/b directly to catch any new file
  //  /a/b/a?z    - Watch /a/b directly to catch any new file matching a?z

  const excludeMatcher = NewSpecMatcher(
    exclude,
    comparePathsOptions.CurrentDirectory,
    UsageExclude,
    comparePathsOptions.UseCaseSensitiveFileNames,
  );

  const wildcardDirectories: GoMap<string, bool> = new globalThis.Map<string, bool>();
  if (include.length === 0) {
    return wildcardDirectories;
  }
  const wildCardKeyToPath: GoMap<string, string> = new globalThis.Map<string, string>();

  const recursiveKeys: GoSlice<string> = [];

  for (const file of include) {
    const spec = NormalizeSlashes(CombinePaths(comparePathsOptions.CurrentDirectory, file));
    if (excludeMatcher !== undefined && SpecMatcher_MatchString(excludeMatcher, spec)) {
      continue;
    }

    const match = getWildcardDirectoryFromSpec(spec, comparePathsOptions.UseCaseSensitiveFileNames);
    if (match !== undefined) {
      const key = match.Key;
      const path = match.Path;
      const recursive = match.Recursive;

      const existsPath = wildCardKeyToPath.has(key);
      const existingPath = existsPath ? wildCardKeyToPath.get(key)! : "";
      const existingRecursive = existsPath ? (wildcardDirectories.get(existingPath) ?? false) : false;

      if (!existsPath || (!existingRecursive && recursive)) {
        const pathToUse = existsPath ? existingPath : path;
        wildcardDirectories.set(pathToUse, recursive);

        if (!existsPath) {
          wildCardKeyToPath.set(key, path);
        }

        if (recursive) {
          recursiveKeys.push(key);
        }
      }
    }

    // Remove any subpaths under an existing recursively watched directory
    for (const path of [...wildcardDirectories.keys()]) {
      for (const recursiveKey of recursiveKeys) {
        const key = toCanonicalKey(path, comparePathsOptions.UseCaseSensitiveFileNames);
        if (key !== recursiveKey && ContainsPath(recursiveKey, key, comparePathsOptions)) {
          wildcardDirectories.delete(path);
        }
      }
    }
  }

  return wildcardDirectories;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/wildcarddirectories.go::func::toCanonicalKey","kind":"func","status":"implemented","sigHash":"a13efd0f04a066b6b6a69172e340eea0affc0171456380b8f90194ff37e864cf","bodyHash":"9d3b178da52a597ea987047d5d844c3bcfcc882bb1f45fe1b7d9cc1e1711656d"}
 *
 * Go source:
 * func toCanonicalKey(path string, useCaseSensitiveFileNames bool) string {
 * 	if useCaseSensitiveFileNames {
 * 		return path
 * 	}
 * 	return strings.ToLower(path)
 * }
 */
export function toCanonicalKey(path: string, useCaseSensitiveFileNames: bool): string {
  if (useCaseSensitiveFileNames) {
    return path;
  }
  return strings.ToLower(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/wildcarddirectories.go::type::wildcardDirectoryMatch","kind":"type","status":"implemented","sigHash":"1f3dd5db5c192667ae73746111a4f7ee18c5e1d26b9dec2e6fbfd0dc40b2a314","bodyHash":"9284185e9bd7682bcd9e7be33c5e2f90668fe9e890bc270ee986137029f8bcfb"}
 *
 * Go source:
 * wildcardDirectoryMatch struct {
 * 	Key       string
 * 	Path      string
 * 	Recursive bool
 * }
 */
export interface wildcardDirectoryMatch {
  Key: string;
  Path: string;
  Recursive: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/wildcarddirectories.go::func::getWildcardDirectoryFromSpec","kind":"func","status":"implemented","sigHash":"f52fa1ea7625d193fb6dd5583fca1e55d314d3b702596b3a9b418130efc5341b","bodyHash":"753a9737032c47051253e4ca2e2c37182daccf481f164b20fec83609d47d7748"}
 *
 * Go source:
 * func getWildcardDirectoryFromSpec(spec string, useCaseSensitiveFileNames bool) *wildcardDirectoryMatch {
 * 	// Find the first occurrence of a wildcard character
 * 	firstWildcard := strings.IndexAny(spec, "*?")
 * 	if firstWildcard != -1 {
 * 		// Find the last directory separator before the wildcard
 * 		lastSepBeforeWildcard := strings.LastIndexByte(spec[:firstWildcard], tspath.DirectorySeparator)
 * 		if lastSepBeforeWildcard != -1 {
 * 			path := spec[:lastSepBeforeWildcard]
 * 			lastDirectorySeparatorIndex := strings.LastIndexByte(spec, tspath.DirectorySeparator)
 *
 * 			// Determine if this should be watched recursively:
 * 			// recursive if the wildcard appears in a directory segment (not just the final file segment)
 * 			recursive := firstWildcard < lastDirectorySeparatorIndex
 *
 * 			return &wildcardDirectoryMatch{
 * 				Key:       toCanonicalKey(path, useCaseSensitiveFileNames),
 * 				Path:      path,
 * 				Recursive: recursive,
 * 			}
 * 		}
 * 	}
 *
 * 	if lastSepIndex := strings.LastIndexByte(spec, tspath.DirectorySeparator); lastSepIndex != -1 {
 * 		lastSegment := spec[lastSepIndex+1:]
 * 		if vfsmatch.IsImplicitGlob(lastSegment) {
 * 			path := tspath.RemoveTrailingDirectorySeparator(spec)
 * 			return &wildcardDirectoryMatch{
 * 				Key:       toCanonicalKey(path, useCaseSensitiveFileNames),
 * 				Path:      path,
 * 				Recursive: true,
 * 			}
 * 		}
 * 	}
 *
 * 	return nil
 * }
 */
export function getWildcardDirectoryFromSpec(
  spec: string,
  useCaseSensitiveFileNames: bool,
): GoPtr<wildcardDirectoryMatch> {
  // Find the first occurrence of a wildcard character
  const firstWildcard = strings.IndexAny(spec, "*?");
  if (firstWildcard !== -1) {
    // Find the last directory separator before the wildcard
    const lastSepBeforeWildcard = strings.LastIndexByte(spec.slice(0, firstWildcard), DirectorySeparator);
    if (lastSepBeforeWildcard !== -1) {
      const path = spec.slice(0, lastSepBeforeWildcard);
      const lastDirectorySeparatorIndex = strings.LastIndexByte(spec, DirectorySeparator);

      // Determine if this should be watched recursively:
      // recursive if the wildcard appears in a directory segment (not just the final file segment)
      const recursive = firstWildcard < lastDirectorySeparatorIndex;

      return {
        Key: toCanonicalKey(path, useCaseSensitiveFileNames),
        Path: path,
        Recursive: recursive,
      };
    }
  }

  const lastSepIndex = strings.LastIndexByte(spec, DirectorySeparator);
  if (lastSepIndex !== -1) {
    const lastSegment = spec.slice(lastSepIndex + 1);
    if (IsImplicitGlob(lastSegment)) {
      const path = RemoveTrailingDirectorySeparator(spec);
      return {
        Key: toCanonicalKey(path, useCaseSensitiveFileNames),
        Path: path,
        Recursive: true,
      };
    }
  }

  return undefined;
}

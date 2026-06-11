import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import {
  EnsureTrailingDirectorySeparator,
  GetCanonicalFileName,
  GetDirectoryPath,
  GetNormalizedPathComponents,
  GetPathFromPathComponents,
} from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/commonsourcedirectory.go::func::computeCommonSourceDirectoryOfFilenames","kind":"func","status":"implemented","sigHash":"4239085a76e414c3bc2d225bca263ee0fdb177ca3c2f317fd883f6bd2075ecee","bodyHash":"4d14dbf06ddec1e393fa6148971c980f674629b338d92277cd22652c87587038"}
 *
 * Go source:
 * func computeCommonSourceDirectoryOfFilenames(fileNames []string, currentDirectory string, useCaseSensitiveFileNames bool) string {
 * 	var commonPathComponents []string
 * 	for _, sourceFile := range fileNames {
 * 		// Each file contributes into common source file path
 * 		sourcePathComponents := tspath.GetNormalizedPathComponents(sourceFile, currentDirectory)
 * 
 * 		// The base file name is not part of the common directory path
 * 		sourcePathComponents = sourcePathComponents[:len(sourcePathComponents)-1]
 * 
 * 		if commonPathComponents == nil {
 * 			// first file
 * 			commonPathComponents = sourcePathComponents
 * 			continue
 * 		}
 * 
 * 		n := min(len(commonPathComponents), len(sourcePathComponents))
 * 		for i := range n {
 * 			if tspath.GetCanonicalFileName(commonPathComponents[i], useCaseSensitiveFileNames) != tspath.GetCanonicalFileName(sourcePathComponents[i], useCaseSensitiveFileNames) {
 * 				if i == 0 {
 * 					// Failed to find any common path component
 * 					return ""
 * 				}
 * 
 * 				// New common path found that is 0 -> i-1
 * 				commonPathComponents = commonPathComponents[:i]
 * 				break
 * 			}
 * 		}
 * 
 * 		// If the sourcePathComponents was shorter than the commonPathComponents, truncate to the sourcePathComponents
 * 		if len(sourcePathComponents) < len(commonPathComponents) {
 * 			commonPathComponents = commonPathComponents[:len(sourcePathComponents)]
 * 		}
 * 	}
 * 
 * 	if len(commonPathComponents) == 0 {
 * 		// Can happen when all input files are .d.ts files
 * 		return currentDirectory
 * 	}
 * 
 * 	return tspath.GetPathFromPathComponents(commonPathComponents)
 * }
 */
// null sentinel means "no common path found at all" (immediate return "")
// undefined means "no files processed yet"
const computeNextComponents = (
  commonPathComponents: GoSlice<string> | null | undefined,
  sourceFile: string,
  currentDirectory: string,
  useCaseSensitiveFileNames: bool,
): GoSlice<string> | null => {
  // Already failed — propagate
  if (commonPathComponents === null) {
    return null;
  }

  const allComponents = GetNormalizedPathComponents(sourceFile, currentDirectory);
  // The base file name is not part of the common directory path
  const sourcePathComponents = allComponents.slice(0, allComponents.length - 1);

  if (commonPathComponents === undefined) {
    // first file
    return sourcePathComponents;
  }

  const currentCommonPathComponents = commonPathComponents;
  const n = Math.min(currentCommonPathComponents.length, sourcePathComponents.length);
  const foundIdx = globalThis.Array.from({ length: n }, (_, i) => i).findIndex(
    (i) =>
      GetCanonicalFileName(currentCommonPathComponents[i]!, useCaseSensitiveFileNames) !==
      GetCanonicalFileName(sourcePathComponents[i]!, useCaseSensitiveFileNames)
  );
  const divergeAt = foundIdx === -1 ? n : foundIdx;

  if (divergeAt < n) {
    if (divergeAt === 0) {
      // Failed to find any common path component
      return null;
    }
    return currentCommonPathComponents.slice(0, divergeAt);
  }

  // No divergence within n; truncate to shorter if sourcePathComponents is shorter
  if (sourcePathComponents.length < commonPathComponents.length) {
    return sourcePathComponents;
  }

  return commonPathComponents;
};

export function computeCommonSourceDirectoryOfFilenames(fileNames: GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool): string {
  const commonPathComponents = fileNames.reduce(
    (acc: GoSlice<string> | null | undefined, sourceFile: string) =>
      computeNextComponents(acc, sourceFile, currentDirectory, useCaseSensitiveFileNames),
    undefined as GoSlice<string> | null | undefined,
  );

  if (commonPathComponents === null) {
    // Failed to find any common path component
    return "";
  }

  if (commonPathComponents === undefined || commonPathComponents.length === 0) {
    // Can happen when all input files are .d.ts files
    return currentDirectory;
  }

  return GetPathFromPathComponents(commonPathComponents);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/commonsourcedirectory.go::func::GetComputedCommonSourceDirectory","kind":"func","status":"implemented","sigHash":"514fd7379da62c201eb92d26a6c0689f3db1331fff4a46f6e682c811bc8f2c7b","bodyHash":"624c5fd43c0f9da8df77048dce90d3d5239cd894faa9effabff80d66b75d6de2"}
 *
 * Go source:
 * func GetComputedCommonSourceDirectory(emittedFiles []string, currentDirectory string, useCaseSensitiveFileNames bool) string {
 * 	commonSourceDirectory := computeCommonSourceDirectoryOfFilenames(emittedFiles, currentDirectory, useCaseSensitiveFileNames)
 * 	if len(commonSourceDirectory) > 0 {
 * 		commonSourceDirectory = tspath.EnsureTrailingDirectorySeparator(commonSourceDirectory)
 * 	}
 * 	return commonSourceDirectory
 * }
 */
export function GetComputedCommonSourceDirectory(emittedFiles: GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool): string {
  const commonSourceDirectory = computeCommonSourceDirectoryOfFilenames(emittedFiles, currentDirectory, useCaseSensitiveFileNames);
  if (commonSourceDirectory.length > 0) {
    return EnsureTrailingDirectorySeparator(commonSourceDirectory);
  }
  return commonSourceDirectory;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/commonsourcedirectory.go::func::GetCommonSourceDirectory","kind":"func","status":"implemented","sigHash":"000736e221ec25c2d2dfd76fc6d2a30955ca089fbb761cb99c201c95c75bcb07","bodyHash":"00ea823a149c7259b2c1a843c407181be95bdd5ca91b8fcc7cf9899c968ffeb9"}
 *
 * Go source:
 * func GetCommonSourceDirectory(options *core.CompilerOptions, files func() []string, currentDirectory string, useCaseSensitiveFileNames bool) string {
 * 	var commonSourceDirectory string
 * 	if options.RootDir != "" {
 * 		// If a rootDir is specified use it as the commonSourceDirectory
 * 		commonSourceDirectory = options.RootDir
 * 	} else if options.ConfigFilePath != "" {
 * 		// If the rootDir is not specified, then the common source directory is the directory of the config file.
 * 		commonSourceDirectory = tspath.GetDirectoryPath(options.ConfigFilePath)
 * 	} else {
 * 		commonSourceDirectory = computeCommonSourceDirectoryOfFilenames(files(), currentDirectory, useCaseSensitiveFileNames)
 * 	}
 * 
 * 	if len(commonSourceDirectory) > 0 {
 * 		// Make sure directory path ends with directory separator so this string can directly
 * 		// used to replace with "" to get the relative path of the source file and the relative path doesn't
 * 		// start with / making it rooted path
 * 		commonSourceDirectory = tspath.EnsureTrailingDirectorySeparator(commonSourceDirectory)
 * 	}
 * 
 * 	return commonSourceDirectory
 * }
 */
export function GetCommonSourceDirectory(options: GoPtr<CompilerOptions>, files: () => GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool): string {
  const rawCommonSourceDirectory =
    options!.RootDir !== ""
      ? options!.RootDir
      : options!.ConfigFilePath !== ""
        ? GetDirectoryPath(options!.ConfigFilePath)
        : computeCommonSourceDirectoryOfFilenames(files(), currentDirectory, useCaseSensitiveFileNames);

  if (rawCommonSourceDirectory.length > 0) {
    return EnsureTrailingDirectorySeparator(rawCommonSourceDirectory);
  }

  return rawCommonSourceDirectory;
}

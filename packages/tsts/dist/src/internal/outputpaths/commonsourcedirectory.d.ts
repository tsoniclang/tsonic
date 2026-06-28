import type { bool } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { CompilerOptions } from "../core/compileroptions.js";
export declare function computeCommonSourceDirectoryOfFilenames(fileNames: GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool): string;
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
export declare function GetComputedCommonSourceDirectory(emittedFiles: GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/commonsourcedirectory.go::func::GetCommonSourceDirectory","kind":"func","status":"implemented","sigHash":"2c7827f05d0d724bf245e7a3b1356d6464dafafd2dbd8feb9afaa8e05acd8542","bodyHash":"7589510d85e966ad258b4b4cf9da51f4be757c70fc484b0a5be68ec3fb267f8b"}
 *
 * Go source:
 * func GetCommonSourceDirectory(options *core.CompilerOptions, files func() []string, currentDirectory string, useCaseSensitiveFileNames bool, checkSourceFilesBelongToPath func([]string, string) bool) string {
 * 	var commonSourceDirectory string
 * 	if options.RootDir != "" {
 * 		// If a rootDir is specified use it as the commonSourceDirectory
 * 		commonSourceDirectory = options.RootDir
 * 		if checkSourceFilesBelongToPath != nil {
 * 			checkSourceFilesBelongToPath(files(), options.RootDir)
 * 		}
 * 	} else if options.ConfigFilePath != "" {
 * 		// If the rootDir is not specified, then the common source directory is the directory of the config file.
 * 		commonSourceDirectory = tspath.GetDirectoryPath(options.ConfigFilePath)
 * 		if checkSourceFilesBelongToPath != nil {
 * 			checkSourceFilesBelongToPath(files(), commonSourceDirectory)
 * 		}
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
export declare function GetCommonSourceDirectory(options: GoPtr<CompilerOptions>, files: () => GoSlice<string>, currentDirectory: string, useCaseSensitiveFileNames: bool, checkSourceFilesBelongToPath: ((sourceFiles: GoSlice<string>, rootDirectory: string) => bool) | undefined): string;
//# sourceMappingURL=commonsourcedirectory.d.ts.map
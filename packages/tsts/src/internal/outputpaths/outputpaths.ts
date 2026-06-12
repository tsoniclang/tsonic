import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { SourceFile_FileName } from "../ast/ast.js";
import type { SourceFile } from "../ast/ast.js";
import { IsJsonSourceFile } from "../ast/utilities.js";
import { CompilerOptions_GetAreDeclarationMapsEnabled, CompilerOptions_GetEmitDeclarations, CompilerOptions_IsIncremental } from "../core/compileroptions.js";
import { JsxEmitPreserve } from "../core/compileroptions.js";
import type { CompilerOptions, JsxEmit } from "../core/compileroptions.js";
import { TSTrue, Tristate_IsTrue } from "../core/tristate.js";
import {
  ChangeExtension,
  ExtensionCjs,
  ExtensionCts,
  ExtensionJson,
  ExtensionJs,
  ExtensionJsx,
  ExtensionMjs,
  ExtensionMts,
  ExtensionTsBuildInfo,
  FileExtensionIsOneOf,
  GetDeclarationEmitExtensionForPath,
  RemoveFileExtension,
} from "../tspath/extension.js";
import {
  CombinePaths,
  ComparePaths,
  ContainsPath,
  EnsureTrailingDirectorySeparator,
  FileExtensionIs,
  GetBaseFileName,
  GetCanonicalFileName,
  GetNormalizedAbsolutePath,
  GetRelativePathFromDirectory,
  ResolvePath,
} from "../tspath/path.js";
import type { ComparePathsOptions } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::type::OutputPathsHost","kind":"type","status":"implemented","sigHash":"1e12f35d02217e114e4083de9d178399222d522e51f79aa12010f64642b9fb88","bodyHash":"bfbed8e873d098b9f9cc0c3a1025dabea3cb6c66d64becd251d8702a56a0f73e"}
 *
 * Go source:
 * OutputPathsHost interface {
 * 	CommonSourceDirectory() string
 * 	GetCurrentDirectory() string
 * 	UseCaseSensitiveFileNames() bool
 * }
 */
export interface OutputPathsHost {
  CommonSourceDirectory(): string;
  GetCurrentDirectory(): string;
  UseCaseSensitiveFileNames(): bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::type::OutputPaths","kind":"type","status":"implemented","sigHash":"d35e924fca977a1b40eebff0ac0ec0cf47f7e439e28474912507e4195725f24d","bodyHash":"2576e11e659ded2d203ac3ecbe53641e3f080047013f9a0fb7181a9f25b85279"}
 *
 * Go source:
 * OutputPaths struct {
 * 	jsFilePath          string
 * 	sourceMapFilePath   string
 * 	declarationFilePath string
 * 	declarationMapPath  string
 * }
 */
export interface OutputPaths {
  jsFilePath: string;
  sourceMapFilePath: string;
  declarationFilePath: string;
  declarationMapPath: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::method::OutputPaths.DeclarationFilePath","kind":"method","status":"implemented","sigHash":"eddd52991e0c9705a7252109abc7370acb5a1074db37aa4b3ebb3f3933ea16ca","bodyHash":"44a5e7e38d0f16303ac10cd21ff28afe7dff1aa0b7255e4bbd0a11a4c33e4b13"}
 *
 * Go source:
 * func (o *OutputPaths) DeclarationFilePath() string {
 * 	return o.declarationFilePath
 * }
 */
export function OutputPaths_DeclarationFilePath(receiver: GoPtr<OutputPaths>): string {
  return receiver!.declarationFilePath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::method::OutputPaths.JsFilePath","kind":"method","status":"implemented","sigHash":"421a6821e79c2dc6e969ef4d07a86b56964c913ae40c04d7242babb0f1ea2923","bodyHash":"6fdbefce4ed510c4f01121a08a3aeced30804ba2869947fea9611b06cff01e3e"}
 *
 * Go source:
 * func (o *OutputPaths) JsFilePath() string {
 * 	return o.jsFilePath
 * }
 */
export function OutputPaths_JsFilePath(receiver: GoPtr<OutputPaths>): string {
  return receiver!.jsFilePath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::method::OutputPaths.SourceMapFilePath","kind":"method","status":"implemented","sigHash":"0186c57ce1de38230289b19589023909d25b195006d18f214e1f8c2e88148005","bodyHash":"b917686a1a19a17021334b9267e3f390c527cef64cfe2c9edbfd95adf95d8e77"}
 *
 * Go source:
 * func (o *OutputPaths) SourceMapFilePath() string {
 * 	return o.sourceMapFilePath
 * }
 */
export function OutputPaths_SourceMapFilePath(receiver: GoPtr<OutputPaths>): string {
  return receiver!.sourceMapFilePath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::method::OutputPaths.DeclarationMapPath","kind":"method","status":"implemented","sigHash":"4b134e72ca9e4722b5faf71800f097482f20af1a6a07dce36ee6907417ba27e5","bodyHash":"7c5534122ccdfcf9081d33c391f643b2993cfc43d9b83dfc83fd8c9b33a34af0"}
 *
 * Go source:
 * func (o *OutputPaths) DeclarationMapPath() string {
 * 	return o.declarationMapPath
 * }
 */
export function OutputPaths_DeclarationMapPath(receiver: GoPtr<OutputPaths>): string {
  return receiver!.declarationMapPath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetOutputPathsFor","kind":"func","status":"implemented","sigHash":"e8730dfaed8cd674f52490cbfeefca36552b439f8cc4af0514fa7ad4c2a519df","bodyHash":"e65d80082203c56b295c69389448998c815d68e9c99a224c073c95c24d23a7db"}
 *
 * Go source:
 * func GetOutputPathsFor(sourceFile *ast.SourceFile, options *core.CompilerOptions, host OutputPathsHost, forceDtsEmit bool) *OutputPaths {
 * 	ownOutputFilePath := getOwnEmitOutputFilePath(sourceFile.FileName(), options, host, GetOutputExtension(sourceFile.FileName(), options.Jsx))
 * 	isJsonFile := ast.IsJsonSourceFile(sourceFile)
 * 	// If json file emits to the same location skip writing it, if emitDeclarationOnly skip writing it
 * 	isJsonEmittedToSameLocation := isJsonFile &&
 * 		tspath.ComparePaths(sourceFile.FileName(), ownOutputFilePath, tspath.ComparePathsOptions{
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 		}) == 0
 * 	paths := &OutputPaths{}
 * 	if options.EmitDeclarationOnly != core.TSTrue && !isJsonEmittedToSameLocation {
 * 		paths.jsFilePath = ownOutputFilePath
 * 		if !ast.IsJsonSourceFile(sourceFile) {
 * 			paths.sourceMapFilePath = GetSourceMapFilePath(paths.jsFilePath, options)
 * 		}
 * 	}
 * 	if forceDtsEmit || options.GetEmitDeclarations() && !isJsonFile {
 * 		paths.declarationFilePath = GetDeclarationEmitOutputFilePath(sourceFile.FileName(), options, host)
 * 		if options.GetAreDeclarationMapsEnabled() {
 * 			paths.declarationMapPath = paths.declarationFilePath + ".map"
 * 		}
 * 	}
 * 	return paths
 * }
 */
export function GetOutputPathsFor(sourceFile: GoPtr<SourceFile>, options: GoPtr<CompilerOptions>, host: OutputPathsHost, forceDtsEmit: bool): GoPtr<OutputPaths> {
  const fileName = SourceFile_FileName(sourceFile);
  const ownOutputFilePath = getOwnEmitOutputFilePath(fileName, options, host, GetOutputExtension(fileName, options!.Jsx));
  const isJsonFile = IsJsonSourceFile(sourceFile);
  // If json file emits to the same location skip writing it, if emitDeclarationOnly skip writing it
  const isJsonEmittedToSameLocation = isJsonFile &&
    ComparePaths(fileName, ownOutputFilePath, {
      CurrentDirectory: host.GetCurrentDirectory(),
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
    }) === 0;
  const paths: OutputPaths = {
    jsFilePath: "",
    sourceMapFilePath: "",
    declarationFilePath: "",
    declarationMapPath: "",
  };
  if (options!.EmitDeclarationOnly !== TSTrue && !isJsonEmittedToSameLocation) {
    paths.jsFilePath = ownOutputFilePath;
    if (!IsJsonSourceFile(sourceFile)) {
      paths.sourceMapFilePath = GetSourceMapFilePath(paths.jsFilePath, options);
    }
  }
  if (forceDtsEmit || CompilerOptions_GetEmitDeclarations(options) && !isJsonFile) {
    paths.declarationFilePath = GetDeclarationEmitOutputFilePath(fileName, options, host);
    if (CompilerOptions_GetAreDeclarationMapsEnabled(options)) {
      paths.declarationMapPath = paths.declarationFilePath + ".map";
    }
  }
  return paths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::ForEachEmittedFile","kind":"func","status":"implemented","sigHash":"dda7d655f93778cbbfdb55decd16abe89e1729e947b700a2712491d35eb3eea6","bodyHash":"c64113e38c2823d27918a03e8896fa1a8dda39bd0ff13626946b73222a7c44f1"}
 *
 * Go source:
 * func ForEachEmittedFile(host OutputPathsHost, options *core.CompilerOptions, action func(emitFileNames *OutputPaths, sourceFile *ast.SourceFile) bool, sourceFiles []*ast.SourceFile, forceDtsEmit bool) bool {
 * 	for _, sourceFile := range sourceFiles {
 * 		if action(GetOutputPathsFor(sourceFile, options, host, forceDtsEmit), sourceFile) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function ForEachEmittedFile(host: OutputPathsHost, options: GoPtr<CompilerOptions>, action: (emitFileNames: GoPtr<OutputPaths>, sourceFile: GoPtr<SourceFile>) => bool, sourceFiles: GoSlice<GoPtr<SourceFile>>, forceDtsEmit: bool): bool {
  for (const sourceFile of sourceFiles) {
    if (action(GetOutputPathsFor(sourceFile, options, host, forceDtsEmit), sourceFile)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetOutputJSFileName","kind":"func","status":"implemented","sigHash":"1b19116c98e2929ac23890a4c346dc0a0c8ecab53253d83718515dea285b395a","bodyHash":"fcc5ed4c054dd7caade18dc4a3600a0500df5c8cfe090e41e80fabf4cd10305b"}
 *
 * Go source:
 * func GetOutputJSFileName(inputFileName string, options *core.CompilerOptions, host OutputPathsHost) string {
 * 	if options.EmitDeclarationOnly.IsTrue() {
 * 		return ""
 * 	}
 * 	outputFileName := GetOutputJSFileNameWorker(inputFileName, options, host)
 * 	if !tspath.FileExtensionIs(outputFileName, tspath.ExtensionJson) ||
 * 		tspath.ComparePaths(inputFileName, outputFileName, tspath.ComparePathsOptions{
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 		}) != 0 {
 * 		return outputFileName
 * 	}
 * 	return ""
 * }
 */
export function GetOutputJSFileName(inputFileName: string, options: GoPtr<CompilerOptions>, host: OutputPathsHost): string {
  if (Tristate_IsTrue(options!.EmitDeclarationOnly)) {
    return "";
  }
  const outputFileName = GetOutputJSFileNameWorker(inputFileName, options, host);
  if (!FileExtensionIs(outputFileName, ExtensionJson) ||
    ComparePaths(inputFileName, outputFileName, {
      CurrentDirectory: host.GetCurrentDirectory(),
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
    }) !== 0) {
    return outputFileName;
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetOutputJSFileNameWorker","kind":"func","status":"implemented","sigHash":"755b2db536a9caf389f60ceecbd33328d7bfdb216bd3af6ef3525ccbb88d23d7","bodyHash":"e6107da79b25ece05a5875cc7348a793e7d6bba45e894d2de61813833819876b"}
 *
 * Go source:
 * func GetOutputJSFileNameWorker(inputFileName string, options *core.CompilerOptions, host OutputPathsHost) string {
 * 	return tspath.ChangeExtension(
 * 		getOutputPathWithoutChangingExtension(inputFileName, options.OutDir, host),
 * 		GetOutputExtension(inputFileName, options.Jsx),
 * 	)
 * }
 */
export function GetOutputJSFileNameWorker(inputFileName: string, options: GoPtr<CompilerOptions>, host: OutputPathsHost): string {
  return ChangeExtension(
    getOutputPathWithoutChangingExtension(inputFileName, options!.OutDir, host),
    GetOutputExtension(inputFileName, options!.Jsx),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetOutputDeclarationFileNameWorker","kind":"func","status":"implemented","sigHash":"68948d7b6859735341e395c6659d0133c046ea513624fdc4784d89b09bbf4eb8","bodyHash":"dd5391c406e5a359cf87a65280a3abfcc75f0d576158c3ec4ad927c6b631a7ca"}
 *
 * Go source:
 * func GetOutputDeclarationFileNameWorker(inputFileName string, options *core.CompilerOptions, host OutputPathsHost) string {
 * 	dir := options.DeclarationDir
 * 	if len(dir) == 0 {
 * 		dir = options.OutDir
 * 	}
 * 	return tspath.ChangeExtension(
 * 		getOutputPathWithoutChangingExtension(inputFileName, dir, host),
 * 		tspath.GetDeclarationEmitExtensionForPath(inputFileName),
 * 	)
 * }
 */
export function GetOutputDeclarationFileNameWorker(inputFileName: string, options: GoPtr<CompilerOptions>, host: OutputPathsHost): string {
  let dir = options!.DeclarationDir;
  if (dir.length === 0) {
    dir = options!.OutDir;
  }
  return ChangeExtension(
    getOutputPathWithoutChangingExtension(inputFileName, dir, host),
    GetDeclarationEmitExtensionForPath(inputFileName),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetOutputExtension","kind":"func","status":"implemented","sigHash":"29a8f547fe18871cc42a6fcea4a076079885a637852cfa2766cc448f2889b32d","bodyHash":"4d7d011b635973cebb21da83d75a6d8b3c38474a2fedbb79c5f5ec71a00bc2ed"}
 *
 * Go source:
 * func GetOutputExtension(fileName string, jsx core.JsxEmit) string {
 * 	switch {
 * 	case tspath.FileExtensionIs(fileName, tspath.ExtensionJson):
 * 		return tspath.ExtensionJson
 * 	case jsx == core.JsxEmitPreserve && tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionJsx, tspath.ExtensionTsx}):
 * 		return tspath.ExtensionJsx
 * 	case tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionMts, tspath.ExtensionMjs}):
 * 		return tspath.ExtensionMjs
 * 	case tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionCts, tspath.ExtensionCjs}):
 * 		return tspath.ExtensionCjs
 * 	default:
 * 		return tspath.ExtensionJs
 * 	}
 * }
 */
export function GetOutputExtension(fileName: string, jsx: JsxEmit): string {
  if (FileExtensionIs(fileName, ExtensionJson)) {
    return ExtensionJson;
  }
  if (jsx === JsxEmitPreserve && FileExtensionIsOneOf(fileName, [ExtensionJsx, ".tsx"])) {
    return ExtensionJsx;
  }
  if (FileExtensionIsOneOf(fileName, [ExtensionMts, ExtensionMjs])) {
    return ExtensionMjs;
  }
  if (FileExtensionIsOneOf(fileName, [ExtensionCts, ExtensionCjs])) {
    return ExtensionCjs;
  }
  return ExtensionJs;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetDeclarationEmitOutputFilePath","kind":"func","status":"implemented","sigHash":"66ffe904157b961152df6254602fc9aa36c33fce9ca6122e81043eaac28afb0e","bodyHash":"d73a6fd2e74bef0855f6e6a97af9a7187411cc9cf982e41514e6b54a18ba1fa3"}
 *
 * Go source:
 * func GetDeclarationEmitOutputFilePath(file string, options *core.CompilerOptions, host OutputPathsHost) string {
 * 	var outputDir *string
 * 	if len(options.DeclarationDir) > 0 {
 * 		outputDir = &options.DeclarationDir
 * 	} else if len(options.OutDir) > 0 {
 * 		outputDir = &options.OutDir
 * 	}
 * 
 * 	var path string
 * 	if outputDir != nil {
 * 		path = GetSourceFilePathInNewDirWorker(file, *outputDir, host.GetCurrentDirectory(), host.CommonSourceDirectory(), host.UseCaseSensitiveFileNames())
 * 	} else {
 * 		path = file
 * 	}
 * 	declarationExtension := tspath.GetDeclarationEmitExtensionForPath(path)
 * 	return tspath.RemoveFileExtension(path) + declarationExtension
 * }
 */
export function GetDeclarationEmitOutputFilePath(file: string, options: GoPtr<CompilerOptions>, host: OutputPathsHost): string {
  let outputDir: string | undefined;
  if (options!.DeclarationDir.length > 0) {
    outputDir = options!.DeclarationDir;
  } else if (options!.OutDir.length > 0) {
    outputDir = options!.OutDir;
  }

  let path: string;
  if (outputDir !== undefined) {
    path = GetSourceFilePathInNewDirWorker(file, outputDir, host.GetCurrentDirectory(), host.CommonSourceDirectory(), host.UseCaseSensitiveFileNames());
  } else {
    path = file;
  }
  const declarationExtension = GetDeclarationEmitExtensionForPath(path);
  return RemoveFileExtension(path) + declarationExtension;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetSourceFilePathInNewDir","kind":"func","status":"implemented","sigHash":"d6c7d0145be3ac6ab5fd049706b52dcfec8b99d8951d2d975c0b37a00e9d5119","bodyHash":"b3554ee5cfba647193e189557d10c26d525af50c65487c6ced7ca9fc3f4a1b47"}
 *
 * Go source:
 * func GetSourceFilePathInNewDir(fileName string, newDirPath string, currentDirectory string, commonSourceDirectory string, useCaseSensitiveFileNames bool) string {
 * 	sourceFilePath := tspath.GetNormalizedAbsolutePath(fileName, currentDirectory)
 * 	commonSourceDirectory = tspath.EnsureTrailingDirectorySeparator(commonSourceDirectory)
 * 	isSourceFileInCommonSourceDirectory := tspath.ContainsPath(commonSourceDirectory, sourceFilePath, tspath.ComparePathsOptions{
 * 		UseCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		CurrentDirectory:          currentDirectory,
 * 	})
 * 	if isSourceFileInCommonSourceDirectory {
 * 		sourceFilePath = sourceFilePath[len(commonSourceDirectory):]
 * 	}
 * 	return tspath.CombinePaths(newDirPath, sourceFilePath)
 * }
 */
export function GetSourceFilePathInNewDir(fileName: string, newDirPath: string, currentDirectory: string, commonSourceDirectory: string, useCaseSensitiveFileNames: bool): string {
  let sourceFilePath = GetNormalizedAbsolutePath(fileName, currentDirectory);
  const commonSourceDirectoryWithSep = EnsureTrailingDirectorySeparator(commonSourceDirectory);
  const isSourceFileInCommonSourceDirectory = ContainsPath(commonSourceDirectoryWithSep, sourceFilePath, {
    UseCaseSensitiveFileNames: useCaseSensitiveFileNames,
    CurrentDirectory: currentDirectory,
  });
  if (isSourceFileInCommonSourceDirectory) {
    sourceFilePath = sourceFilePath.slice(commonSourceDirectoryWithSep.length);
  }
  return CombinePaths(newDirPath, sourceFilePath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::getOutputPathWithoutChangingExtension","kind":"func","status":"implemented","sigHash":"763bd1dbc6aceda8779688ffbf74e81508ff9d3596c6e86ce0618cf1aef1670b","bodyHash":"2e53c3b9012425eea48d736ecb1230d8a17eb7ec9ccdd314cbe11e436bbb3f85"}
 *
 * Go source:
 * func getOutputPathWithoutChangingExtension(inputFileName string, outputDirectory string, host OutputPathsHost) string {
 * 	if len(outputDirectory) > 0 {
 * 		return tspath.ResolvePath(outputDirectory, tspath.GetRelativePathFromDirectory(host.CommonSourceDirectory(), inputFileName, tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		}))
 * 	}
 * 	return inputFileName
 * }
 */
export function getOutputPathWithoutChangingExtension(inputFileName: string, outputDirectory: string, host: OutputPathsHost): string {
  if (outputDirectory.length > 0) {
    return ResolvePath(outputDirectory, GetRelativePathFromDirectory(host.CommonSourceDirectory(), inputFileName, {
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
      CurrentDirectory: host.GetCurrentDirectory(),
    }));
  }
  return inputFileName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetSourceFilePathInNewDirWorker","kind":"func","status":"implemented","sigHash":"8de2a6ebf1499d462837e0fd8a9ea166985a84ea98b77737ba4fc91c291a880e","bodyHash":"055152467b3f83c5d0e98cbd7fcd42f29a750df864c066c2e0e69fd156d482cb"}
 *
 * Go source:
 * func GetSourceFilePathInNewDirWorker(fileName string, newDirPath string, currentDirectory string, commonSourceDirectory string, useCaseSensitiveFileNames bool) string {
 * 	sourceFilePath := tspath.GetNormalizedAbsolutePath(fileName, currentDirectory)
 * 	commonDir := tspath.GetCanonicalFileName(commonSourceDirectory, useCaseSensitiveFileNames)
 * 	canonFile := tspath.GetCanonicalFileName(sourceFilePath, useCaseSensitiveFileNames)
 * 	isSourceFileInCommonSourceDirectory := strings.HasPrefix(canonFile, commonDir)
 * 	if isSourceFileInCommonSourceDirectory {
 * 		sourceFilePath = sourceFilePath[len(commonSourceDirectory):]
 * 	}
 * 	return tspath.CombinePaths(newDirPath, sourceFilePath)
 * }
 */
export function GetSourceFilePathInNewDirWorker(fileName: string, newDirPath: string, currentDirectory: string, commonSourceDirectory: string, useCaseSensitiveFileNames: bool): string {
  let sourceFilePath = GetNormalizedAbsolutePath(fileName, currentDirectory);
  const commonDir = GetCanonicalFileName(commonSourceDirectory, useCaseSensitiveFileNames);
  const canonFile = GetCanonicalFileName(sourceFilePath, useCaseSensitiveFileNames);
  const isSourceFileInCommonSourceDirectory = canonFile.startsWith(commonDir);
  if (isSourceFileInCommonSourceDirectory) {
    sourceFilePath = sourceFilePath.slice(commonSourceDirectory.length);
  }
  return CombinePaths(newDirPath, sourceFilePath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::getOwnEmitOutputFilePath","kind":"func","status":"implemented","sigHash":"40c0257fb4ad70537f386955ea41774bc03e8332986ee016df4dae4b029bcae3","bodyHash":"ec8939f785ff4ac35306452c713fec16c78b3896fabbb16156b9a6a27b67794a"}
 *
 * Go source:
 * func getOwnEmitOutputFilePath(fileName string, options *core.CompilerOptions, host OutputPathsHost, extension string) string {
 * 	var emitOutputFilePathWithoutExtension string
 * 	if len(options.OutDir) > 0 {
 * 		currentDirectory := host.GetCurrentDirectory()
 * 		emitOutputFilePathWithoutExtension = tspath.RemoveFileExtension(GetSourceFilePathInNewDir(
 * 			fileName,
 * 			options.OutDir,
 * 			currentDirectory,
 * 			host.CommonSourceDirectory(),
 * 			host.UseCaseSensitiveFileNames(),
 * 		))
 * 	} else {
 * 		emitOutputFilePathWithoutExtension = tspath.RemoveFileExtension(fileName)
 * 	}
 * 	return emitOutputFilePathWithoutExtension + extension
 * }
 */
export function getOwnEmitOutputFilePath(fileName: string, options: GoPtr<CompilerOptions>, host: OutputPathsHost, extension: string): string {
  let emitOutputFilePathWithoutExtension: string;
  if (options!.OutDir.length > 0) {
    const currentDirectory = host.GetCurrentDirectory();
    emitOutputFilePathWithoutExtension = RemoveFileExtension(GetSourceFilePathInNewDir(
      fileName,
      options!.OutDir,
      currentDirectory,
      host.CommonSourceDirectory(),
      host.UseCaseSensitiveFileNames(),
    ));
  } else {
    emitOutputFilePathWithoutExtension = RemoveFileExtension(fileName);
  }
  return emitOutputFilePathWithoutExtension + extension;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetSourceMapFilePath","kind":"func","status":"implemented","sigHash":"ea6d36a50977f18de7ce108243a9f4915e84dbcb8cae52b3f4d985dd69d3d792","bodyHash":"4e4fb9c8c3107f5ccf955798b7743a23d42a4769fafef21f3a133bf4d35e43ad"}
 *
 * Go source:
 * func GetSourceMapFilePath(jsFilePath string, options *core.CompilerOptions) string {
 * 	if options.SourceMap.IsTrue() && !options.InlineSourceMap.IsTrue() {
 * 		return jsFilePath + ".map"
 * 	}
 * 	return ""
 * }
 */
export function GetSourceMapFilePath(jsFilePath: string, options: GoPtr<CompilerOptions>): string {
  if (Tristate_IsTrue(options!.SourceMap) && !Tristate_IsTrue(options!.InlineSourceMap)) {
    return jsFilePath + ".map";
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/outputpaths/outputpaths.go::func::GetBuildInfoFileName","kind":"func","status":"implemented","sigHash":"7de6d0015631873c1f58461d404006ffdc40f4727da124cbf64313f98ff910d5","bodyHash":"4ddb8a3000bbddd3341de52a5785987a885b64ef572e0d2de8da6b5a4b94f94d"}
 *
 * Go source:
 * func GetBuildInfoFileName(options *core.CompilerOptions, opts tspath.ComparePathsOptions) string {
 * 	if !options.IsIncremental() && !options.Build.IsTrue() {
 * 		return ""
 * 	}
 * 	if options.TsBuildInfoFile != "" {
 * 		return options.TsBuildInfoFile
 * 	}
 * 	if options.ConfigFilePath == "" {
 * 		return ""
 * 	}
 * 	configFileExtensionLess := tspath.RemoveFileExtension(options.ConfigFilePath)
 * 	var buildInfoExtensionLess string
 * 	if options.OutDir != "" {
 * 		if options.RootDir != "" {
 * 			buildInfoExtensionLess = tspath.ResolvePath(options.OutDir, tspath.GetRelativePathFromDirectory(options.RootDir, configFileExtensionLess, opts))
 * 		} else {
 * 			buildInfoExtensionLess = tspath.CombinePaths(options.OutDir, tspath.GetBaseFileName(configFileExtensionLess))
 * 		}
 * 	} else {
 * 		buildInfoExtensionLess = configFileExtensionLess
 * 	}
 * 	return buildInfoExtensionLess + tspath.ExtensionTsBuildInfo
 * }
 */
export function GetBuildInfoFileName(options: GoPtr<CompilerOptions>, opts: ComparePathsOptions): string {
  if (!CompilerOptions_IsIncremental(options) && !Tristate_IsTrue(options!.Build)) {
    return "";
  }
  if (options!.TsBuildInfoFile !== "") {
    return options!.TsBuildInfoFile;
  }
  if (options!.ConfigFilePath === "") {
    return "";
  }
  const configFileExtensionLess = RemoveFileExtension(options!.ConfigFilePath);
  let buildInfoExtensionLess: string;
  if (options!.OutDir !== "") {
    if (options!.RootDir !== "") {
      buildInfoExtensionLess = ResolvePath(options!.OutDir, GetRelativePathFromDirectory(options!.RootDir, configFileExtensionLess, opts));
    } else {
      buildInfoExtensionLess = CombinePaths(options!.OutDir, GetBaseFileName(configFileExtensionLess));
    }
  } else {
    buildInfoExtensionLess = configFileExtensionLess;
  }
  return buildInfoExtensionLess + ExtensionTsBuildInfo;
}

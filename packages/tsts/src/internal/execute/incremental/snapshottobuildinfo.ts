import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import * as maps from "../../../go/maps.js";
import * as slices from "../../../go/slices.js";
import type { SourceFile } from "../../ast/ast.js";
import { IsJsonSourceFile } from "../../ast/utilities.js";
import type { Diagnostic, RepopulateDiagnosticInfo } from "../../ast/diagnostic.js";
import {
  Diagnostic_Code,
  Diagnostic_Category,
  Diagnostic_File,
  Diagnostic_MessageArgs,
  Diagnostic_MessageChain,
  Diagnostic_MessageKey,
  Diagnostic_Pos,
  Diagnostic_End,
  Diagnostic_RelatedInformation,
  Diagnostic_RepopulateInfo,
  Diagnostic_ReportsDeprecated,
  Diagnostic_ReportsUnnecessary,
  Diagnostic_SkippedOnNoEmit,
} from "../../ast/diagnostic.js";
import { SourceFile_Path } from "../../ast/ast.js";
import type { Set } from "../../collections/set.js";
import { Set_Keys } from "../../collections/set.js";
import { SyncMap_Keys, SyncMap_Load } from "../../collections/syncmap.js";
import type { SyncSet } from "../../collections/syncset.js";
import { SyncSet_Has, SyncSet_Keys } from "../../collections/syncset.js";
import type { Program } from "../../compiler/program.js";
import { Program_GetCurrentDirectory, Program_GetDefaultLibFile, Program_GetSourceFiles, Program_SourceFileMayBeEmitted, Program_UseCaseSensitiveFileNames, Program_GetSourceFileByPath, Program_CommandLine, Program_GetSourceFile, Program_GetParseFileRedirect } from "../../compiler/program.js";
import * as core from "../../core/core.js";
import { Version } from "../../core/version.js";
import { CompilerOptions_IsIncremental } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { ForEachCompilerOptionValue } from "../../tsoptions/declscompiler.js";
import type { CommandLineOption } from "../../tsoptions/commandlineoption.js";
import { CommandLineOptionTypeList } from "../../tsoptions/commandlineoption.js";
import { CommandLineOption_Elements } from "../../tsoptions/commandlineoption.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { ParsedCommandLine_FileNames } from "../../tsoptions/parsedcommandline.js";
import type { ComparePathsOptions, Path } from "../../tspath/path.js";
import { ToPath, GetDirectoryPath, GetRelativePathFromDirectory, EnsurePathIsNonModuleName } from "../../tspath/path.js";
import type { int } from "@tsonic/core/types.js";
import type { Value } from "../../../go/reflect.js";
import type { BuildInfo, BuildInfoDiagnostic, BuildInfoDiagnosticsOfFile, BuildInfoFileId, BuildInfoFileIdListId, BuildInfoRepopulateInfo } from "./buildInfo.js";
import type { BuildInfoEmitSignature, BuildInfoFilePendingEmit, BuildInfoResolvedRoot, BuildInfoRoot, BuildInfoSemanticDiagnostic, BuildInfoReferenceMapEntry } from "./buildInfo.js";
import { newBuildInfoFileInfo } from "./buildInfo.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import { OrderedMap_Set, newMapWithSizeHint } from "../../collections/ordered_map.js";
import type { buildInfoDiagnosticWithFileName, DiagnosticsOrBuildInfoDiagnosticsWithFileName, snapshot } from "./snapshot.js";
import { GetFileEmitKind } from "./snapshot.js";
import type { referenceMap } from "./referencemap.js";
import { referenceMap_getPathsWithReferences, referenceMap_getReferences } from "./referencemap.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::func::snapshotToBuildInfo","kind":"func","status":"implemented","sigHash":"6d176d3df057485735ebe643c8b26bb4e8bdaa0ebe0bc252431ac701006b52f2","bodyHash":"de743fa263f68b0cd9e06c3f2f2dae58a8e4e0eeb1f770ac613a8f76c04a5928"}
 *
 * Go source:
 * func snapshotToBuildInfo(snapshot *snapshot, program *compiler.Program, buildInfoFileName string) *BuildInfo {
 * 	buildInfo := &BuildInfo{
 * 		Version: core.Version(),
 * 	}
 * 	to := &toBuildInfo{
 * 		snapshot:           snapshot,
 * 		program:            program,
 * 		buildInfo:          buildInfo,
 * 		buildInfoDirectory: tspath.GetDirectoryPath(buildInfoFileName),
 * 		comparePathsOptions: tspath.ComparePathsOptions{
 * 			CurrentDirectory:          program.GetCurrentDirectory(),
 * 			UseCaseSensitiveFileNames: program.UseCaseSensitiveFileNames(),
 * 		},
 * 		fileNameToFileId:        make(map[string]BuildInfoFileId),
 * 		fileNamesToFileIdListId: make(map[string]BuildInfoFileIdListId),
 * 		roots:                   make(map[*ast.SourceFile]tspath.Path),
 * 	}
 * 
 * 	if snapshot.options.IsIncremental() {
 * 		to.collectRootFiles()
 * 		to.setFileInfoAndEmitSignatures()
 * 		to.setRootOfIncrementalProgram()
 * 		to.setCompilerOptions()
 * 		to.setReferencedMap()
 * 		to.setChangeFileSet()
 * 		to.setSemanticDiagnostics()
 * 		to.setEmitDiagnostics()
 * 		to.setAffectedFilesPendingEmit()
 * 		if snapshot.latestChangedDtsFile != "" {
 * 			buildInfo.LatestChangedDtsFile = to.relativeToBuildInfo(snapshot.latestChangedDtsFile)
 * 		}
 * 	} else {
 * 		to.setRootOfNonIncrementalProgram()
 * 	}
 * 	buildInfo.Errors = snapshot.hasErrors.IsTrue()
 * 	buildInfo.SemanticErrors = snapshot.hasSemanticErrors
 * 	buildInfo.CheckPending = snapshot.checkPending
 * 	return buildInfo
 * }
 */
export function snapshotToBuildInfo(snapshot: GoPtr<snapshot>, program: GoPtr<Program>, buildInfoFileName: string): GoPtr<BuildInfo> {
  const buildInfo: BuildInfo = {
    Version: Version(),
    Errors: false,
    CheckPending: false,
    Root: [],
    FileNames: [],
    FileInfos: [],
    FileIdsList: [],
    Options: undefined,
    ReferencedMap: [],
    SemanticDiagnosticsPerFile: [],
    EmitDiagnosticsPerFile: [],
    ChangeFileSet: [],
    AffectedFilesPendingEmit: [],
    LatestChangedDtsFile: "",
    EmitSignatures: [],
    ResolvedRoot: [],
    SemanticErrors: false,
  };
  const to: toBuildInfo = {
    snapshot: snapshot,
    program: program,
    buildInfo: buildInfo,
    buildInfoDirectory: GetDirectoryPath(buildInfoFileName),
    comparePathsOptions: {
      CurrentDirectory: Program_GetCurrentDirectory(program),
      UseCaseSensitiveFileNames: Program_UseCaseSensitiveFileNames(program),
    } as ComparePathsOptions,
    fileNameToFileId: new Map<string, BuildInfoFileId>(),
    fileNamesToFileIdListId: new Map<string, BuildInfoFileIdListId>(),
    roots: new Map<GoPtr<SourceFile>, Path>(),
  };

  if (CompilerOptions_IsIncremental(snapshot!.options)) {
    toBuildInfo_collectRootFiles(to);
    toBuildInfo_setFileInfoAndEmitSignatures(to);
    toBuildInfo_setRootOfIncrementalProgram(to);
    toBuildInfo_setCompilerOptions(to);
    toBuildInfo_setReferencedMap(to);
    toBuildInfo_setChangeFileSet(to);
    toBuildInfo_setSemanticDiagnostics(to);
    toBuildInfo_setEmitDiagnostics(to);
    toBuildInfo_setAffectedFilesPendingEmit(to);
    if (snapshot!.latestChangedDtsFile !== "") {
      buildInfo.LatestChangedDtsFile = toBuildInfo_relativeToBuildInfo(to, snapshot!.latestChangedDtsFile);
    }
  } else {
    toBuildInfo_setRootOfNonIncrementalProgram(to);
  }
  buildInfo.Errors = Tristate_IsTrue(snapshot!.hasErrors);
  buildInfo.SemanticErrors = snapshot!.hasSemanticErrors;
  buildInfo.CheckPending = snapshot!.checkPending;
  return buildInfo;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::type::toBuildInfo","kind":"type","status":"implemented","sigHash":"9cf6e7abf9c792a675cd2ed765514398c73a219d972b9a0a2c4741388eb0b13c","bodyHash":"b959a411e0d31652c41cc1a57f691ec3d9660e7cc85fbdf886feea7d820f3a56"}
 *
 * Go source:
 * toBuildInfo struct {
 * 	snapshot                *snapshot
 * 	program                 *compiler.Program
 * 	buildInfo               *BuildInfo
 * 	buildInfoDirectory      string
 * 	comparePathsOptions     tspath.ComparePathsOptions
 * 	fileNameToFileId        map[string]BuildInfoFileId
 * 	fileNamesToFileIdListId map[string]BuildInfoFileIdListId
 * 	roots                   map[*ast.SourceFile]tspath.Path
 * }
 */
export interface toBuildInfo {
  snapshot: GoPtr<snapshot>;
  program: GoPtr<Program>;
  buildInfo: GoPtr<BuildInfo>;
  buildInfoDirectory: string;
  comparePathsOptions: ComparePathsOptions;
  fileNameToFileId: GoMap<string, BuildInfoFileId>;
  fileNamesToFileIdListId: GoMap<string, BuildInfoFileIdListId>;
  roots: GoMap<GoPtr<SourceFile>, Path>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.relativeToBuildInfo","kind":"method","status":"implemented","sigHash":"b4c08c15e3c78879a7aad6a76a890e08361d997a83fe2d183b4c749aeb15c6cc","bodyHash":"c2dc2f3d45edb4c6f1eea85f5d6e7158169dd49d593dddb3e57a01559110fa4e"}
 *
 * Go source:
 * func (t *toBuildInfo) relativeToBuildInfo(path string) string {
 * 	return tspath.EnsurePathIsNonModuleName(tspath.GetRelativePathFromDirectory(t.buildInfoDirectory, path, t.comparePathsOptions))
 * }
 */
export function toBuildInfo_relativeToBuildInfo(receiver: GoPtr<toBuildInfo>, path: string): string {
  return EnsurePathIsNonModuleName(GetRelativePathFromDirectory(receiver!.buildInfoDirectory, path, receiver!.comparePathsOptions));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toFileId","kind":"method","status":"implemented","sigHash":"4d2aae678808b7bb307ac0bca982ec0223bf83c0d896a3a31f13d8787ce83d33","bodyHash":"be9445538d57fada4c130543c2e21c685306a79c351bd3b25c5313c3de30a353"}
 *
 * Go source:
 * func (t *toBuildInfo) toFileId(path tspath.Path) BuildInfoFileId {
 * 	fileId := t.fileNameToFileId[string(path)]
 * 	if fileId == 0 {
 * 		if libFile := t.program.GetDefaultLibFile(path); libFile != nil && !libFile.Replaced {
 * 			t.buildInfo.FileNames = append(t.buildInfo.FileNames, libFile.Name)
 * 		} else {
 * 			t.buildInfo.FileNames = append(t.buildInfo.FileNames, t.relativeToBuildInfo(string(path)))
 * 		}
 * 		fileId = BuildInfoFileId(len(t.buildInfo.FileNames))
 * 		t.fileNameToFileId[string(path)] = fileId
 * 	}
 * 	return fileId
 * }
 */
export function toBuildInfo_toFileId(receiver: GoPtr<toBuildInfo>, path: Path): BuildInfoFileId {
  let fileId = receiver!.fileNameToFileId.get(path as string);
  if (fileId === undefined || fileId === 0) {
    const libFile = Program_GetDefaultLibFile(receiver!.program, path);
    if (libFile !== undefined && !libFile.Replaced) {
      receiver!.buildInfo!.FileNames.push(libFile.Name);
    } else {
      receiver!.buildInfo!.FileNames.push(toBuildInfo_relativeToBuildInfo(receiver, path as string));
    }
    fileId = receiver!.buildInfo!.FileNames.length as BuildInfoFileId;
    receiver!.fileNameToFileId.set(path as string, fileId);
  }
  return fileId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toFileIdListId","kind":"method","status":"implemented","sigHash":"094585bf2744a0981f8041ff25f577c849a9a120efd8eedc82473534802e4eb8","bodyHash":"20687928f1bef5687df548a4b91a5fdeb2e6593ce6320cf075d362caf593170d"}
 *
 * Go source:
 * func (t *toBuildInfo) toFileIdListId(set *collections.Set[tspath.Path]) BuildInfoFileIdListId {
 * 	fileIds := core.Map(slices.Collect(maps.Keys(set.Keys())), t.toFileId)
 * 	slices.Sort(fileIds)
 * 	key := strings.Join(core.Map(fileIds, func(id BuildInfoFileId) string {
 * 		return fmt.Sprintf("%d", id)
 * 	}), ",")
 * 
 * 	fileIdListId := t.fileNamesToFileIdListId[key]
 * 	if fileIdListId == 0 {
 * 		t.buildInfo.FileIdsList = append(t.buildInfo.FileIdsList, fileIds)
 * 		fileIdListId = BuildInfoFileIdListId(len(t.buildInfo.FileIdsList))
 * 		t.fileNamesToFileIdListId[key] = fileIdListId
 * 	}
 * 	return fileIdListId
 * }
 */
export function toBuildInfo_toFileIdListId(receiver: GoPtr<toBuildInfo>, set_: GoPtr<Set>): BuildInfoFileIdListId {
  const fileIds = core.Map(slices.Collect(maps.Keys(Set_Keys(set_ as GoPtr<import("../../collections/set.js").Set<Path>>))), (id: Path) => toBuildInfo_toFileId(receiver, id));
  slices.Sort(fileIds);
  const key = core.Map(fileIds, (id: BuildInfoFileId) => String(id)).join(",");

  let fileIdListId = receiver!.fileNamesToFileIdListId.get(key);
  if (fileIdListId === undefined || fileIdListId === 0) {
    receiver!.buildInfo!.FileIdsList.push(fileIds);
    fileIdListId = receiver!.buildInfo!.FileIdsList.length as BuildInfoFileIdListId;
    receiver!.fileNamesToFileIdListId.set(key, fileIdListId);
  }
  return fileIdListId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toRelativeToBuildInfoCompilerOptionValue","kind":"method","status":"implemented","sigHash":"929bb452eddabbc5b8c55e7be00919579328472fad15ebf1f846e83bb28be3c1","bodyHash":"5caaf290489167b6a095e7a14ff04f9139baa4e284b6c6cd31f796a5b6d1d38d"}
 *
 * Go source:
 * func (t *toBuildInfo) toRelativeToBuildInfoCompilerOptionValue(option *tsoptions.CommandLineOption, v any) any {
 * 	if option.Kind == "list" {
 * 		if option.Elements().IsFilePath {
 * 			if arr, ok := v.([]string); ok {
 * 				return core.Map(arr, t.relativeToBuildInfo)
 * 			}
 * 		}
 * 	} else if option.IsFilePath {
 * 		if str, ok := v.(string); ok && str != "" {
 * 			return t.relativeToBuildInfo(v.(string))
 * 		}
 * 	}
 * 	return v
 * }
 */
export function toBuildInfo_toRelativeToBuildInfoCompilerOptionValue(receiver: GoPtr<toBuildInfo>, option: GoPtr<CommandLineOption>, v: unknown): unknown {
  if (option!.Kind === CommandLineOptionTypeList) {
    if (CommandLineOption_Elements(option)!.IsFilePath) {
      const arr = v as string[] | undefined;
      if (arr !== undefined) {
        return core.Map(arr, (s: string) => toBuildInfo_relativeToBuildInfo(receiver, s));
      }
    }
  } else if (option!.IsFilePath) {
    const str = v as string | undefined;
    if (str !== undefined && str !== "") {
      return toBuildInfo_relativeToBuildInfo(receiver, str);
    }
  }
  return v;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toBuildInfoDiagnosticsFromFileNameDiagnostics","kind":"method","status":"implemented","sigHash":"b6713f72041b90272369d4b68d9bff359e1560d858ca2af87ff09fb8e9a91075","bodyHash":"a74c78b66d4bdd36fccb9197faa6f3e24a3c709ae2aded86182a2f4d126ddb1d"}
 *
 * Go source:
 * func (t *toBuildInfo) toBuildInfoDiagnosticsFromFileNameDiagnostics(diagnostics []*buildInfoDiagnosticWithFileName) []*BuildInfoDiagnostic {
 * 	return core.Map(diagnostics, func(d *buildInfoDiagnosticWithFileName) *BuildInfoDiagnostic {
 * 		var file BuildInfoFileId
 * 		if d.file != "" {
 * 			file = t.toFileId(d.file)
 * 		}
 * 		return &BuildInfoDiagnostic{
 * 			File:               file,
 * 			NoFile:             d.noFile,
 * 			Pos:                d.pos,
 * 			End:                d.end,
 * 			Code:               d.code,
 * 			Category:           d.category,
 * 			MessageKey:         d.messageKey,
 * 			MessageArgs:        d.messageArgs,
 * 			MessageChain:       t.toBuildInfoDiagnosticsFromFileNameDiagnostics(d.messageChain),
 * 			RelatedInformation: t.toBuildInfoDiagnosticsFromFileNameDiagnostics(d.relatedInformation),
 * 			ReportsUnnecessary: d.reportsUnnecessary,
 * 			ReportsDeprecated:  d.reportsDeprecated,
 * 			SkippedOnNoEmit:    d.skippedOnNoEmit,
 * 			RepopulateInfo:     toBuildInfoRepopulateInfo(d.repopulateInfo),
 * 		}
 * 	})
 * }
 */
export function toBuildInfo_toBuildInfoDiagnosticsFromFileNameDiagnostics(receiver: GoPtr<toBuildInfo>, diagnostics: GoSlice<GoPtr<buildInfoDiagnosticWithFileName>>): GoSlice<GoPtr<BuildInfoDiagnostic>> {
  return core.Map(diagnostics, (d: GoPtr<buildInfoDiagnosticWithFileName>) => {
    let file: BuildInfoFileId = 0;
    if (d!.file !== "") {
      file = toBuildInfo_toFileId(receiver, d!.file);
    }
    const result: BuildInfoDiagnostic = {
      File: file,
      NoFile: d!.noFile,
      Pos: d!.pos,
      End: d!.end,
      Code: d!.code,
      Category: d!.category,
      MessageKey: d!.messageKey,
      MessageArgs: d!.messageArgs,
      MessageChain: toBuildInfo_toBuildInfoDiagnosticsFromFileNameDiagnostics(receiver, d!.messageChain),
      RelatedInformation: toBuildInfo_toBuildInfoDiagnosticsFromFileNameDiagnostics(receiver, d!.relatedInformation),
      ReportsUnnecessary: d!.reportsUnnecessary,
      ReportsDeprecated: d!.reportsDeprecated,
      SkippedOnNoEmit: d!.skippedOnNoEmit,
      RepopulateInfo: toBuildInfoRepopulateInfo(d!.repopulateInfo),
    };
    return result;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toBuildInfoDiagnosticsFromDiagnostics","kind":"method","status":"implemented","sigHash":"34e29f08d348dd21770391689653487e6b804b4e2a2cc24bd1ce11f224475f5c","bodyHash":"db74156070ae6482138180201dbd04948967b68a31dacb1a5ef1d9ae8e1baab4"}
 *
 * Go source:
 * func (t *toBuildInfo) toBuildInfoDiagnosticsFromDiagnostics(filePath tspath.Path, diagnostics []*ast.Diagnostic) []*BuildInfoDiagnostic {
 * 	return core.Map(diagnostics, func(d *ast.Diagnostic) *BuildInfoDiagnostic {
 * 		var file BuildInfoFileId
 * 		noFile := false
 * 		if d.File() == nil {
 * 			noFile = true
 * 		} else if d.File().Path() != filePath {
 * 			file = t.toFileId(d.File().Path())
 * 		}
 * 		return &BuildInfoDiagnostic{
 * 			File:               file,
 * 			NoFile:             noFile,
 * 			Pos:                d.Loc().Pos(),
 * 			End:                d.Loc().End(),
 * 			Code:               d.Code(),
 * 			Category:           d.Category(),
 * 			MessageKey:         d.MessageKey(),
 * 			MessageArgs:        d.MessageArgs(),
 * 			MessageChain:       t.toBuildInfoDiagnosticsFromDiagnostics(filePath, d.MessageChain()),
 * 			RelatedInformation: t.toBuildInfoDiagnosticsFromDiagnostics(filePath, d.RelatedInformation()),
 * 			ReportsUnnecessary: d.ReportsUnnecessary(),
 * 			ReportsDeprecated:  d.ReportsDeprecated(),
 * 			SkippedOnNoEmit:    d.SkippedOnNoEmit(),
 * 			RepopulateInfo:     toBuildInfoRepopulateInfo(d.RepopulateInfo()),
 * 		}
 * 	})
 * }
 */
export function toBuildInfo_toBuildInfoDiagnosticsFromDiagnostics(receiver: GoPtr<toBuildInfo>, filePath: Path, diagnostics: GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<BuildInfoDiagnostic>> {
  return core.Map(diagnostics, (d: GoPtr<Diagnostic>) => {
    let file: BuildInfoFileId = 0;
    let noFile = false;
    if (Diagnostic_File(d) === undefined) {
      noFile = true;
    } else if (SourceFile_Path(Diagnostic_File(d)) !== filePath) {
      file = toBuildInfo_toFileId(receiver, SourceFile_Path(Diagnostic_File(d)));
    }
    const result: BuildInfoDiagnostic = {
      File: file,
      NoFile: noFile,
      Pos: Diagnostic_Pos(d),
      End: Diagnostic_End(d),
      Code: Diagnostic_Code(d),
      Category: Diagnostic_Category(d),
      MessageKey: Diagnostic_MessageKey(d),
      MessageArgs: Diagnostic_MessageArgs(d),
      MessageChain: toBuildInfo_toBuildInfoDiagnosticsFromDiagnostics(receiver, filePath, Diagnostic_MessageChain(d)),
      RelatedInformation: toBuildInfo_toBuildInfoDiagnosticsFromDiagnostics(receiver, filePath, Diagnostic_RelatedInformation(d)),
      ReportsUnnecessary: Diagnostic_ReportsUnnecessary(d),
      ReportsDeprecated: Diagnostic_ReportsDeprecated(d),
      SkippedOnNoEmit: Diagnostic_SkippedOnNoEmit(d),
      RepopulateInfo: toBuildInfoRepopulateInfo(Diagnostic_RepopulateInfo(d)),
    };
    return result;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::func::toBuildInfoRepopulateInfo","kind":"func","status":"implemented","sigHash":"b8873a15ffdabbb7972e489fd564b2befa0a1aea7c03b6af74fd60ebf0e1c3c5","bodyHash":"c3bdf94d358e3377d6e44cab5fcd042afb82f850ff5c02129db7cad571acc205"}
 *
 * Go source:
 * func toBuildInfoRepopulateInfo(info *ast.RepopulateDiagnosticInfo) *BuildInfoRepopulateInfo {
 * 	if info == nil {
 * 		return nil
 * 	}
 * 	return &BuildInfoRepopulateInfo{
 * 		Kind:            info.Kind,
 * 		ModuleReference: info.ModuleReference,
 * 		Mode:            info.Mode,
 * 		PackageName:     info.PackageName,
 * 	}
 * }
 */
export function toBuildInfoRepopulateInfo(info: GoPtr<RepopulateDiagnosticInfo>): GoPtr<BuildInfoRepopulateInfo> {
  if (info === undefined) {
    return undefined;
  }
  return {
    Kind: info.Kind,
    ModuleReference: info.ModuleReference,
    Mode: info.Mode,
    PackageName: info.PackageName,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.toBuildInfoDiagnosticsOfFile","kind":"method","status":"implemented","sigHash":"0b7dac020c978363c0861bc8b9c401ff7b697315e02443fabd7f7f1f47141e04","bodyHash":"d95cd3fd2da278735e2ee58fe71fb94c58cc945cfc44e7876deeff8efc2c2888"}
 *
 * Go source:
 * func (t *toBuildInfo) toBuildInfoDiagnosticsOfFile(filePath tspath.Path, diags *DiagnosticsOrBuildInfoDiagnosticsWithFileName) *BuildInfoDiagnosticsOfFile {
 * 	if len(diags.diagnostics) > 0 {
 * 		return &BuildInfoDiagnosticsOfFile{
 * 			FileId:      t.toFileId(filePath),
 * 			Diagnostics: t.toBuildInfoDiagnosticsFromDiagnostics(filePath, diags.diagnostics),
 * 		}
 * 	}
 * 	if len(diags.buildInfoDiagnostics) > 0 {
 * 		return &BuildInfoDiagnosticsOfFile{
 * 			FileId:      t.toFileId(filePath),
 * 			Diagnostics: t.toBuildInfoDiagnosticsFromFileNameDiagnostics(diags.buildInfoDiagnostics),
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function toBuildInfo_toBuildInfoDiagnosticsOfFile(receiver: GoPtr<toBuildInfo>, filePath: Path, diags: GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>): GoPtr<BuildInfoDiagnosticsOfFile> {
  if (diags!.diagnostics.length > 0) {
    return {
      FileId: toBuildInfo_toFileId(receiver, filePath),
      Diagnostics: toBuildInfo_toBuildInfoDiagnosticsFromDiagnostics(receiver, filePath, diags!.diagnostics),
    };
  }
  if (diags!.buildInfoDiagnostics.length > 0) {
    return {
      FileId: toBuildInfo_toFileId(receiver, filePath),
      Diagnostics: toBuildInfo_toBuildInfoDiagnosticsFromFileNameDiagnostics(receiver, diags!.buildInfoDiagnostics),
    };
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.collectRootFiles","kind":"method","status":"implemented","sigHash":"196feab729639542da05fcef1c8b665a7e0bfc61e7c4585af3d864068a185da8","bodyHash":"8bd4a056bd241258d8d9949ba9571a98ff8850011226254d9233e9d6d5688509"}
 *
 * Go source:
 * func (t *toBuildInfo) collectRootFiles() {
 * 	for _, fileName := range t.program.CommandLine().FileNames() {
 * 		var file *ast.SourceFile
 * 		if redirect := t.program.GetParseFileRedirect(fileName); redirect != "" {
 * 			file = t.program.GetSourceFile(redirect)
 * 		} else {
 * 			file = t.program.GetSourceFile(fileName)
 * 		}
 * 		if file != nil {
 * 			t.roots[file] = tspath.ToPath(fileName, t.comparePathsOptions.CurrentDirectory, t.comparePathsOptions.UseCaseSensitiveFileNames)
 * 		}
 * 	}
 * }
 */
export function toBuildInfo_collectRootFiles(receiver: GoPtr<toBuildInfo>): void {
  for (const fileName of ParsedCommandLine_FileNames(Program_CommandLine(receiver!.program))) {
    let file;
    const redirect = Program_GetParseFileRedirect(receiver!.program, fileName);
    if (redirect !== "") {
      file = Program_GetSourceFile(receiver!.program, redirect);
    } else {
      file = Program_GetSourceFile(receiver!.program, fileName);
    }
    if (file !== undefined) {
      receiver!.roots.set(file, ToPath(fileName, receiver!.comparePathsOptions.CurrentDirectory, receiver!.comparePathsOptions.UseCaseSensitiveFileNames));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setFileInfoAndEmitSignatures","kind":"method","status":"implemented","sigHash":"b01647a3a23a9f5ac05f0200f3b21d65b22c117eab573386ccd0e2ad43e41bb5","bodyHash":"227e686e346d7379ab7a7c246817a744af2729d8e538a2f51f44921ac5168d67"}
 *
 * Go source:
 * func (t *toBuildInfo) setFileInfoAndEmitSignatures() {
 * 	t.buildInfo.FileInfos = core.Map(t.program.GetSourceFiles(), func(file *ast.SourceFile) *BuildInfoFileInfo {
 * 		info, _ := t.snapshot.fileInfos.Load(file.Path())
 * 		fileId := t.toFileId(file.Path())
 * 		//  tryAddRoot(key, fileId);
 * 		if t.buildInfo.FileNames[fileId-1] != t.relativeToBuildInfo(string(file.Path())) {
 * 			if libFile := t.program.GetDefaultLibFile(file.Path()); libFile == nil || libFile.Replaced || t.buildInfo.FileNames[fileId-1] != libFile.Name {
 * 				panic(fmt.Sprintf("File name at index %d does not match expected relative path or libName: %s != %s", fileId-1, t.buildInfo.FileNames[fileId-1], t.relativeToBuildInfo(string(file.Path()))))
 * 			}
 * 		}
 * 		if t.snapshot.options.Composite.IsTrue() {
 * 			if !ast.IsJsonSourceFile(file) && t.program.SourceFileMayBeEmitted(file, false) {
 * 				if emitSignature, loaded := t.snapshot.emitSignatures.Load(file.Path()); !loaded {
 * 					t.buildInfo.EmitSignatures = append(t.buildInfo.EmitSignatures, &BuildInfoEmitSignature{
 * 						FileId: fileId,
 * 					})
 * 				} else if emitSignature.signature != info.signature {
 * 					incrementalEmitSignature := &BuildInfoEmitSignature{
 * 						FileId: fileId,
 * 					}
 * 					if emitSignature.signature != "" {
 * 						incrementalEmitSignature.Signature = emitSignature.signature
 * 					} else if emitSignature.signatureWithDifferentOptions[0] == info.signature {
 * 						incrementalEmitSignature.DiffersOnlyInDtsMap = true
 * 					} else {
 * 						incrementalEmitSignature.Signature = emitSignature.signatureWithDifferentOptions[0]
 * 						incrementalEmitSignature.DiffersInOptions = true
 * 					}
 * 					t.buildInfo.EmitSignatures = append(t.buildInfo.EmitSignatures, incrementalEmitSignature)
 * 				}
 * 			}
 * 		}
 * 		return newBuildInfoFileInfo(info)
 * 	})
 * }
 */
export function toBuildInfo_setFileInfoAndEmitSignatures(receiver: GoPtr<toBuildInfo>): void {
  receiver!.buildInfo!.FileInfos = core.Map(Program_GetSourceFiles(receiver!.program), (file: GoPtr<import("../../ast/ast.js").SourceFile>) => {
    const [info] = SyncMap_Load(receiver!.snapshot!.fileInfos as import("../../collections/syncmap.js").SyncMap<Path, import("./snapshot.js").FileInfo>, SourceFile_Path(file));
    const fileId = toBuildInfo_toFileId(receiver, SourceFile_Path(file));
    if (receiver!.buildInfo!.FileNames[fileId - 1] !== toBuildInfo_relativeToBuildInfo(receiver, SourceFile_Path(file) as string)) {
      const libFile = Program_GetDefaultLibFile(receiver!.program, SourceFile_Path(file));
      if (libFile === undefined || libFile.Replaced || receiver!.buildInfo!.FileNames[fileId - 1] !== libFile.Name) {
        throw new globalThis.Error(`File name at index ${fileId - 1} does not match expected relative path or libName: ${receiver!.buildInfo!.FileNames[fileId - 1]} != ${toBuildInfo_relativeToBuildInfo(receiver, SourceFile_Path(file) as string)}`);
      }
    }
    if (Tristate_IsTrue(receiver!.snapshot!.options!.Composite)) {
      if (!IsJsonSourceFile(file) && Program_SourceFileMayBeEmitted(receiver!.program, file, false)) {
        const [emitSignature, loaded] = SyncMap_Load(receiver!.snapshot!.emitSignatures as import("../../collections/syncmap.js").SyncMap<Path, import("./snapshot.js").emitSignature>, SourceFile_Path(file));
        if (!loaded) {
          receiver!.buildInfo!.EmitSignatures.push({ FileId: fileId, Signature: "", DiffersOnlyInDtsMap: false, DiffersInOptions: false });
        } else if (emitSignature!.signature !== info!.signature) {
          const incrementalEmitSignature: BuildInfoEmitSignature = { FileId: fileId, Signature: "", DiffersOnlyInDtsMap: false, DiffersInOptions: false };
          if (emitSignature!.signature !== "") {
            incrementalEmitSignature.Signature = emitSignature!.signature;
          } else if (emitSignature!.signatureWithDifferentOptions[0] === info!.signature) {
            incrementalEmitSignature.DiffersOnlyInDtsMap = true;
          } else {
            incrementalEmitSignature.Signature = emitSignature!.signatureWithDifferentOptions[0]!;
            incrementalEmitSignature.DiffersInOptions = true;
          }
          receiver!.buildInfo!.EmitSignatures.push(incrementalEmitSignature);
        }
      }
    }
    return newBuildInfoFileInfo(info);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setRootOfIncrementalProgram","kind":"method","status":"implemented","sigHash":"29728102bf2233b7edb34b773c6412376c0e1f6cffb4af39d4e5d5148089076d","bodyHash":"dfbdb0ef9d10ae793a7c061151160771f58605242e0c19d04a83e20f13fcd281"}
 *
 * Go source:
 * func (t *toBuildInfo) setRootOfIncrementalProgram() {
 * 	keys := slices.Collect(maps.Keys(t.roots))
 * 	slices.SortFunc(keys, func(a, b *ast.SourceFile) int {
 * 		return int(t.toFileId(a.Path())) - int(t.toFileId(b.Path()))
 * 	})
 * 	for _, file := range keys {
 * 		root := t.toFileId(t.roots[file])
 * 		resolved := t.toFileId(file.Path())
 * 		if t.buildInfo.Root == nil {
 * 			// First fileId as is
 * 			t.buildInfo.Root = append(t.buildInfo.Root, &BuildInfoRoot{Start: resolved})
 * 		} else {
 * 			last := t.buildInfo.Root[len(t.buildInfo.Root)-1]
 * 			if last.End == resolved-1 {
 * 				// If its [..., last = [start, end = fileId - 1]], update last to [start, fileId]
 * 				last.End = resolved
 * 			} else if last.End == 0 && last.Start == resolved-1 {
 * 				// If its [..., last = start = fileId - 1 ], update last to [start, fileId]
 * 				last.End = resolved
 * 			} else {
 * 				t.buildInfo.Root = append(t.buildInfo.Root, &BuildInfoRoot{Start: resolved})
 * 			}
 * 		}
 * 		if root != resolved {
 * 			t.buildInfo.ResolvedRoot = append(t.buildInfo.ResolvedRoot, &BuildInfoResolvedRoot{
 * 				Resolved: resolved,
 * 				Root:     root,
 * 			})
 * 		}
 * 	}
 * }
 */
export function toBuildInfo_setRootOfIncrementalProgram(receiver: GoPtr<toBuildInfo>): void {
  const keys = slices.Collect(maps.Keys(receiver!.roots));
  slices.SortFunc(keys, (a: GoPtr<SourceFile>, b: GoPtr<SourceFile>) => {
    return (toBuildInfo_toFileId(receiver, SourceFile_Path(a)) as number) - (toBuildInfo_toFileId(receiver, SourceFile_Path(b)) as number);
  });
  for (const file of keys) {
    const rootPath = receiver!.roots.get(file);
    const root = toBuildInfo_toFileId(receiver, rootPath!);
    const resolved = toBuildInfo_toFileId(receiver, SourceFile_Path(file));
    if (receiver!.buildInfo!.Root.length === 0) {
      receiver!.buildInfo!.Root.push({ Start: resolved, End: 0, NonIncremental: "" });
    } else {
      const last = receiver!.buildInfo!.Root[receiver!.buildInfo!.Root.length - 1]!;
      if (last.End === resolved - 1) {
        last.End = resolved;
      } else if (last.End === 0 && last.Start === resolved - 1) {
        last.End = resolved;
      } else {
        receiver!.buildInfo!.Root.push({ Start: resolved, End: 0, NonIncremental: "" });
      }
    }
    if (root !== resolved) {
      receiver!.buildInfo!.ResolvedRoot.push({ Resolved: resolved, Root: root });
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setCompilerOptions","kind":"method","status":"implemented","sigHash":"e8ed06013ee9779b8eceeb71417d7e513dbcbee3bb0db878ef98fa27ea86831d","bodyHash":"4c482c03e74966ec116a07e23fa5c21d7d572922a7939e781b59d754933aa5a1"}
 *
 * Go source:
 * func (t *toBuildInfo) setCompilerOptions() {
 * 	tsoptions.ForEachCompilerOptionValue(
 * 		t.snapshot.options,
 * 		func(option *tsoptions.CommandLineOption) bool {
 * 			return option.AffectsBuildInfo
 * 		},
 * 		func(option *tsoptions.CommandLineOption, value reflect.Value, i int) bool {
 * 			if value.IsZero() {
 * 				return false
 * 			}
 * 			// Make it relative to buildInfo directory if file path
 * 			if t.buildInfo.Options == nil {
 * 				t.buildInfo.Options = &collections.OrderedMap[string, any]{}
 * 			}
 * 			t.buildInfo.Options.Set(option.Name, t.toRelativeToBuildInfoCompilerOptionValue(option, value.Interface()))
 * 			return false
 * 		},
 * 	)
 * }
 */
export function toBuildInfo_setCompilerOptions(receiver: GoPtr<toBuildInfo>): void {
  ForEachCompilerOptionValue(
    receiver!.snapshot!.options,
    (option: GoPtr<CommandLineOption>) => option!.AffectsBuildInfo,
    (option: GoPtr<CommandLineOption>, value: Value, _i: int) => {
      if (value.IsZero()) {
        return false;
      }
      if (receiver!.buildInfo!.Options === undefined) {
        receiver!.buildInfo!.Options = newMapWithSizeHint<string, unknown>(0) as GoPtr<OrderedMap>;
      }
      OrderedMap_Set(receiver!.buildInfo!.Options as GoPtr<OrderedMap<string, unknown>>, option!.Name, toBuildInfo_toRelativeToBuildInfoCompilerOptionValue(receiver, option, value.Interface()));
      return false;
    },
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setReferencedMap","kind":"method","status":"implemented","sigHash":"767530a0c819d9ad48e30aa697c4bc97ec9ebf9d31afc3191bdd97ee2e4e9fb0","bodyHash":"375d637141980bb3c102e2c055af048f015d2b3ccdd843cab329c31a22af5312"}
 *
 * Go source:
 * func (t *toBuildInfo) setReferencedMap() {
 * 	keys := t.snapshot.referencedMap.getPathsWithReferences()
 * 	slices.Sort(keys)
 * 	t.buildInfo.ReferencedMap = core.Map(keys, func(filePath tspath.Path) *BuildInfoReferenceMapEntry {
 * 		references, _ := t.snapshot.referencedMap.getReferences(filePath)
 * 		return &BuildInfoReferenceMapEntry{
 * 			FileId:       t.toFileId(filePath),
 * 			FileIdListId: t.toFileIdListId(references),
 * 		}
 * 	})
 * }
 */
export function toBuildInfo_setReferencedMap(receiver: GoPtr<toBuildInfo>): void {
  const keys = referenceMap_getPathsWithReferences(receiver!.snapshot!.referencedMap as GoPtr<import("./referencemap.js").referenceMap>);
  slices.Sort(keys);
  receiver!.buildInfo!.ReferencedMap = core.Map(keys, (filePath: Path) => {
    const [references] = referenceMap_getReferences(receiver!.snapshot!.referencedMap as GoPtr<import("./referencemap.js").referenceMap>, filePath);
    return {
      FileId: toBuildInfo_toFileId(receiver, filePath),
      FileIdListId: toBuildInfo_toFileIdListId(receiver, references as GoPtr<Set>),
    } as BuildInfoReferenceMapEntry;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setChangeFileSet","kind":"method","status":"implemented","sigHash":"6a03b4fb9d004c0c32fecc728e66c9f0bfc529643d5aa20ebbe741b84b2b2308","bodyHash":"7c4f804a42c5053003a24091fb70145dabc8c2f0af7794fed47d4c5e29a52a92"}
 *
 * Go source:
 * func (t *toBuildInfo) setChangeFileSet() {
 * 	files := slices.Collect(t.snapshot.changedFilesSet.Keys())
 * 	slices.Sort(files)
 * 	t.buildInfo.ChangeFileSet = core.Map(files, t.toFileId)
 * }
 */
export function toBuildInfo_setChangeFileSet(receiver: GoPtr<toBuildInfo>): void {
  const files = slices.Collect(SyncSet_Keys(receiver!.snapshot!.changedFilesSet as import("../../collections/syncset.js").SyncSet<Path>));
  slices.Sort(files);
  receiver!.buildInfo!.ChangeFileSet = core.Map(files, (f: Path) => toBuildInfo_toFileId(receiver, f));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setSemanticDiagnostics","kind":"method","status":"implemented","sigHash":"02c8c79702690517d40e7640932f6e8f00e75a3e0d5663aebb86656e69d0e994","bodyHash":"0db45fd346a5d626d45c4800937e07795aab8eda863c4aca7a83cf8b08de5117"}
 *
 * Go source:
 * func (t *toBuildInfo) setSemanticDiagnostics() {
 * 	for _, file := range t.program.GetSourceFiles() {
 * 		value, ok := t.snapshot.semanticDiagnosticsPerFile.Load(file.Path())
 * 		if !ok {
 * 			if !t.snapshot.changedFilesSet.Has(file.Path()) {
 * 				t.buildInfo.SemanticDiagnosticsPerFile = append(t.buildInfo.SemanticDiagnosticsPerFile, &BuildInfoSemanticDiagnostic{
 * 					FileId: t.toFileId(file.Path()),
 * 				})
 * 			}
 * 		} else {
 * 			diagnostics := t.toBuildInfoDiagnosticsOfFile(file.Path(), value)
 * 			if diagnostics != nil {
 * 				t.buildInfo.SemanticDiagnosticsPerFile = append(t.buildInfo.SemanticDiagnosticsPerFile, &BuildInfoSemanticDiagnostic{
 * 					Diagnostics: diagnostics,
 * 				})
 * 			}
 * 		}
 * 	}
 * }
 */
export function toBuildInfo_setSemanticDiagnostics(receiver: GoPtr<toBuildInfo>): void {
  for (const file of Program_GetSourceFiles(receiver!.program)) {
    const [value, ok] = SyncMap_Load(receiver!.snapshot!.semanticDiagnosticsPerFile as import("../../collections/syncmap.js").SyncMap<Path, DiagnosticsOrBuildInfoDiagnosticsWithFileName>, SourceFile_Path(file));
    if (!ok) {
      if (!SyncSet_Has(receiver!.snapshot!.changedFilesSet as import("../../collections/syncset.js").SyncSet<Path>, SourceFile_Path(file))) {
        receiver!.buildInfo!.SemanticDiagnosticsPerFile.push({ FileId: toBuildInfo_toFileId(receiver, SourceFile_Path(file)), Diagnostics: undefined });
      }
    } else {
      const diagnostics = toBuildInfo_toBuildInfoDiagnosticsOfFile(receiver, SourceFile_Path(file), value);
      if (diagnostics !== undefined) {
        receiver!.buildInfo!.SemanticDiagnosticsPerFile.push({ FileId: 0, Diagnostics: diagnostics });
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setEmitDiagnostics","kind":"method","status":"implemented","sigHash":"0022e7fdf96188a4906eb2c56d42e6d3e0f3a8b030423a55bf9268b06f9f4925","bodyHash":"56468c2b2c592a753cad80619101cfc4b61f5b1fa1721b1a244e63fa9b4d3941"}
 *
 * Go source:
 * func (t *toBuildInfo) setEmitDiagnostics() {
 * 	files := slices.Collect(t.snapshot.emitDiagnosticsPerFile.Keys())
 * 	slices.Sort(files)
 * 	t.buildInfo.EmitDiagnosticsPerFile = core.Map(files, func(filePath tspath.Path) *BuildInfoDiagnosticsOfFile {
 * 		value, _ := t.snapshot.emitDiagnosticsPerFile.Load(filePath)
 * 		return t.toBuildInfoDiagnosticsOfFile(filePath, value)
 * 	})
 * }
 */
export function toBuildInfo_setEmitDiagnostics(receiver: GoPtr<toBuildInfo>): void {
  const files = slices.Collect(SyncMap_Keys(receiver!.snapshot!.emitDiagnosticsPerFile as import("../../collections/syncmap.js").SyncMap<Path, DiagnosticsOrBuildInfoDiagnosticsWithFileName>));
  slices.Sort(files);
  receiver!.buildInfo!.EmitDiagnosticsPerFile = core.Map(files, (filePath: Path) => {
    const [value] = SyncMap_Load(receiver!.snapshot!.emitDiagnosticsPerFile as import("../../collections/syncmap.js").SyncMap<Path, DiagnosticsOrBuildInfoDiagnosticsWithFileName>, filePath);
    return toBuildInfo_toBuildInfoDiagnosticsOfFile(receiver, filePath, value);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"237934bc704bff50e94a4dfd3a2f074c8ee5c4d0bf4ab3b36a09df07a188bc60","bodyHash":"1c6ac98bff07152471d4e79edf3cf76eea8b14e32e89eab6b3ad6c7c411ab1c0"}
 *
 * Go source:
 * func (t *toBuildInfo) setAffectedFilesPendingEmit() {
 * 	files := slices.Collect(t.snapshot.affectedFilesPendingEmit.Keys())
 * 	slices.Sort(files)
 * 	fullEmitKind := GetFileEmitKind(t.snapshot.options)
 * 	for _, filePath := range files {
 * 		file := t.program.GetSourceFileByPath(filePath)
 * 		if file == nil || !t.program.SourceFileMayBeEmitted(file, false) {
 * 			continue
 * 		}
 * 		pendingEmit, _ := t.snapshot.affectedFilesPendingEmit.Load(filePath)
 * 		t.buildInfo.AffectedFilesPendingEmit = append(t.buildInfo.AffectedFilesPendingEmit, &BuildInfoFilePendingEmit{
 * 			FileId:   t.toFileId(filePath),
 * 			EmitKind: core.IfElse(pendingEmit == fullEmitKind, 0, pendingEmit),
 * 		})
 * 	}
 * }
 */
export function toBuildInfo_setAffectedFilesPendingEmit(receiver: GoPtr<toBuildInfo>): void {
  const files = slices.Collect(SyncMap_Keys(receiver!.snapshot!.affectedFilesPendingEmit as import("../../collections/syncmap.js").SyncMap<Path, import("./snapshot.js").FileEmitKind>));
  slices.Sort(files);
  const fullEmitKind = GetFileEmitKind(receiver!.snapshot!.options);
  for (const filePath of files) {
    const file = Program_GetSourceFileByPath(receiver!.program, filePath);
    if (file === undefined || !Program_SourceFileMayBeEmitted(receiver!.program, file, false)) {
      continue;
    }
    const [pendingEmit] = SyncMap_Load(receiver!.snapshot!.affectedFilesPendingEmit as import("../../collections/syncmap.js").SyncMap<Path, import("./snapshot.js").FileEmitKind>, filePath);
    receiver!.buildInfo!.AffectedFilesPendingEmit.push({
      FileId: toBuildInfo_toFileId(receiver, filePath),
      EmitKind: core.IfElse(pendingEmit === fullEmitKind, 0, pendingEmit),
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshottobuildinfo.go::method::toBuildInfo.setRootOfNonIncrementalProgram","kind":"method","status":"implemented","sigHash":"74a0353458ec866f6c2188031fb1815ffc4a328495e5c9816b45e18667956bfe","bodyHash":"55fedd37113ad879a25bd78a1e0d42f99f1f9f45ac1fa344ecb92b70dbdaa992"}
 *
 * Go source:
 * func (t *toBuildInfo) setRootOfNonIncrementalProgram() {
 * 	t.buildInfo.Root = core.Map(t.program.CommandLine().FileNames(), func(fileName string) *BuildInfoRoot {
 * 		return &BuildInfoRoot{
 * 			NonIncremental: t.relativeToBuildInfo(string(tspath.ToPath(fileName, t.comparePathsOptions.CurrentDirectory, t.comparePathsOptions.UseCaseSensitiveFileNames))),
 * 		}
 * 	})
 * }
 */
export function toBuildInfo_setRootOfNonIncrementalProgram(receiver: GoPtr<toBuildInfo>): void {
  receiver!.buildInfo!.Root = core.Map(ParsedCommandLine_FileNames(Program_CommandLine(receiver!.program)), (fileName: string) => {
    return {
      Start: 0,
      End: 0,
      NonIncremental: toBuildInfo_relativeToBuildInfo(receiver, ToPath(fileName, receiver!.comparePathsOptions.CurrentDirectory, receiver!.comparePathsOptions.UseCaseSensitiveFileNames) as string),
    } as BuildInfoRoot;
  });
}

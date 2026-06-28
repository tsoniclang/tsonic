import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { RepopulateDiagnosticInfo } from "../../ast/diagnostic.js";
import type { Set } from "../../collections/set.js";
import type { CompilerHost } from "../../compiler/host.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import type { Path } from "../../tspath/path.js";
import type { BuildInfo, BuildInfoDiagnostic, BuildInfoDiagnosticsOfFile, BuildInfoFileId, BuildInfoFileIdListId, BuildInfoRepopulateInfo } from "./buildInfo.js";
import type { buildInfoDiagnosticWithFileName, DiagnosticsOrBuildInfoDiagnosticsWithFileName, snapshot } from "./snapshot.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::func::buildInfoToSnapshot","kind":"func","status":"implemented","sigHash":"a5b857c399f4dc273e9d03408127a705fbfa13c5abb98a71ff6e2864571a4cb1","bodyHash":"591b7456d6d272a9feea0c4f529143950aa14f5975aa69ccaf5054b0b5d6036c"}
 *
 * Go source:
 * func buildInfoToSnapshot(buildInfo *BuildInfo, config *tsoptions.ParsedCommandLine, host compiler.CompilerHost) *snapshot {
 * 	to := &toSnapshot{
 * 		buildInfo:          buildInfo,
 * 		buildInfoDirectory: tspath.GetDirectoryPath(tspath.GetNormalizedAbsolutePath(config.GetBuildInfoFileName(), config.GetCurrentDirectory())),
 * 		filePaths:          make([]tspath.Path, 0, len(buildInfo.FileNames)),
 * 		filePathSet:        make([]*collections.Set[tspath.Path], 0, len(buildInfo.FileIdsList)),
 * 	}
 * 	to.filePaths = core.Map(buildInfo.FileNames, func(fileName string) tspath.Path {
 * 		if !strings.HasPrefix(fileName, ".") {
 * 			return tspath.ToPath(tspath.CombinePaths(host.DefaultLibraryPath(), fileName), host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames())
 * 		}
 * 		return tspath.ToPath(fileName, to.buildInfoDirectory, config.UseCaseSensitiveFileNames())
 * 	})
 * 	to.filePathSet = core.Map(buildInfo.FileIdsList, func(fileIdList []BuildInfoFileId) *collections.Set[tspath.Path] {
 * 		fileSet := collections.NewSetWithSizeHint[tspath.Path](len(fileIdList))
 * 		for _, fileId := range fileIdList {
 * 			fileSet.Add(to.toFilePath(fileId))
 * 		}
 * 		return fileSet
 * 	})
 * 	to.setCompilerOptions()
 * 	to.setFileInfoAndEmitSignatures()
 * 	to.setReferencedMap()
 * 	to.setChangeFileSet()
 * 	to.setSemanticDiagnostics()
 * 	to.setEmitDiagnostics()
 * 	to.setAffectedFilesPendingEmit()
 * 	if buildInfo.LatestChangedDtsFile != "" {
 * 		to.snapshot.latestChangedDtsFile = to.toAbsolutePath(buildInfo.LatestChangedDtsFile)
 * 	}
 * 	to.snapshot.hasErrors = core.IfElse(buildInfo.Errors, core.TSTrue, core.TSFalse)
 * 	to.snapshot.hasSemanticErrors = buildInfo.SemanticErrors
 * 	to.snapshot.checkPending = buildInfo.CheckPending
 * 	return &to.snapshot
 * }
 */
export declare function buildInfoToSnapshot(buildInfo: GoPtr<BuildInfo>, config: GoPtr<ParsedCommandLine>, host: CompilerHost): GoPtr<snapshot>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::type::toSnapshot","kind":"type","status":"implemented","sigHash":"87952872505b39563a1c8966efccb244aafdb71adf51674bf1b17d4db57b868a","bodyHash":"2543ab814bce1fdd102f1625f331af5bd6091f34bbdca7d754cda06005763683"}
 *
 * Go source:
 * toSnapshot struct {
 * 	buildInfo          *BuildInfo
 * 	buildInfoDirectory string
 * 	snapshot           snapshot
 * 	filePaths          []tspath.Path
 * 	filePathSet        []*collections.Set[tspath.Path]
 * }
 */
export interface toSnapshot {
    buildInfo: GoPtr<BuildInfo>;
    buildInfoDirectory: string;
    snapshot: snapshot;
    filePaths: GoSlice<Path>;
    filePathSet: GoSlice<GoPtr<Set<Path>>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.toAbsolutePath","kind":"method","status":"implemented","sigHash":"65e30bc689b7d01df494f8a455626dfc246bfdd4848e84136b3c98f47bf8e9d7","bodyHash":"71aff4067c2fa39709ad11e1107dd920eef1f33c345ad57c265bea98e87d9063"}
 *
 * Go source:
 * func (t *toSnapshot) toAbsolutePath(path string) string {
 * 	return tspath.GetNormalizedAbsolutePath(path, t.buildInfoDirectory)
 * }
 */
export declare function toSnapshot_toAbsolutePath(receiver: GoPtr<toSnapshot>, path: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.toFilePath","kind":"method","status":"implemented","sigHash":"9dce48820cc7e6cc5f6caa5e26c7356eb67a8dc7faf34679dcc36b0d2452e5c3","bodyHash":"09e4e814a2c64d936c81bad5033ac8eb94caf3570bf8963aa06becc5fbb333d9"}
 *
 * Go source:
 * func (t *toSnapshot) toFilePath(fileId BuildInfoFileId) tspath.Path {
 * 	return t.filePaths[fileId-1]
 * }
 */
export declare function toSnapshot_toFilePath(receiver: GoPtr<toSnapshot>, fileId: BuildInfoFileId): Path;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.toFilePathSet","kind":"method","status":"implemented","sigHash":"1dc4e5d11f717d07f6920eb4c0840714aceeabd1071ef74da2f256be68d18092","bodyHash":"c686202241cbfd3c6c4c546b3efdc3c6168cdb380c4261a178de3bb175433336"}
 *
 * Go source:
 * func (t *toSnapshot) toFilePathSet(fileIdListId BuildInfoFileIdListId) *collections.Set[tspath.Path] {
 * 	return t.filePathSet[fileIdListId-1]
 * }
 */
export declare function toSnapshot_toFilePathSet(receiver: GoPtr<toSnapshot>, fileIdListId: BuildInfoFileIdListId): GoPtr<Set<Path>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.toBuildInfoDiagnosticsWithFileName","kind":"method","status":"implemented","sigHash":"a7f2f85451e1d721ba5e067f9ad6e4fb7deb8265917c10fac3719d6eaa00dc5a","bodyHash":"85b93ba96be8aca86d363e259d60f7e233a4eeeb182181e580b51601765fcdbf"}
 *
 * Go source:
 * func (t *toSnapshot) toBuildInfoDiagnosticsWithFileName(diagnostics []*BuildInfoDiagnostic) []*buildInfoDiagnosticWithFileName {
 * 	return core.Map(diagnostics, func(d *BuildInfoDiagnostic) *buildInfoDiagnosticWithFileName {
 * 		var file tspath.Path
 * 		if d.File != 0 {
 * 			file = t.toFilePath(d.File)
 * 		}
 * 		return &buildInfoDiagnosticWithFileName{
 * 			file:               file,
 * 			noFile:             d.NoFile,
 * 			pos:                d.Pos,
 * 			end:                d.End,
 * 			code:               d.Code,
 * 			category:           d.Category,
 * 			messageKey:         d.MessageKey,
 * 			messageArgs:        d.MessageArgs,
 * 			messageChain:       t.toBuildInfoDiagnosticsWithFileName(d.MessageChain),
 * 			relatedInformation: t.toBuildInfoDiagnosticsWithFileName(d.RelatedInformation),
 * 			reportsUnnecessary: d.ReportsUnnecessary,
 * 			reportsDeprecated:  d.ReportsDeprecated,
 * 			skippedOnNoEmit:    d.SkippedOnNoEmit,
 * 			repopulateInfo:     fromBuildInfoRepopulateInfo(d.RepopulateInfo),
 * 		}
 * 	})
 * }
 */
export declare function toSnapshot_toBuildInfoDiagnosticsWithFileName(receiver: GoPtr<toSnapshot>, diagnostics: GoSlice<GoPtr<BuildInfoDiagnostic>>): GoSlice<GoPtr<buildInfoDiagnosticWithFileName>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.toDiagnosticsOrBuildInfoDiagnosticsWithFileName","kind":"method","status":"implemented","sigHash":"f202f0b46a0adacdeff85c8c4bea6b77f9b2b47dc3b90ef5b030d482ead06485","bodyHash":"e409979d5b50a4ac34d17117927e7028d22e921b03552a8d136b80a3dead8791"}
 *
 * Go source:
 * func (t *toSnapshot) toDiagnosticsOrBuildInfoDiagnosticsWithFileName(dig *BuildInfoDiagnosticsOfFile) *DiagnosticsOrBuildInfoDiagnosticsWithFileName {
 * 	return &DiagnosticsOrBuildInfoDiagnosticsWithFileName{
 * 		buildInfoDiagnostics: t.toBuildInfoDiagnosticsWithFileName(dig.Diagnostics),
 * 	}
 * }
 */
export declare function toSnapshot_toDiagnosticsOrBuildInfoDiagnosticsWithFileName(receiver: GoPtr<toSnapshot>, dig: GoPtr<BuildInfoDiagnosticsOfFile>): GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::func::fromBuildInfoRepopulateInfo","kind":"func","status":"implemented","sigHash":"3952d55bed31e2f0406137312f69583794d70b051e71eb4f74db436d78cd88ad","bodyHash":"66463eef1276b60085d40052e7e44c4eb6f9e301c164e7718806686768729316"}
 *
 * Go source:
 * func fromBuildInfoRepopulateInfo(info *BuildInfoRepopulateInfo) *ast.RepopulateDiagnosticInfo {
 * 	if info == nil {
 * 		return nil
 * 	}
 * 	return &ast.RepopulateDiagnosticInfo{
 * 		Kind:            info.Kind,
 * 		ModuleReference: info.ModuleReference,
 * 		Mode:            info.Mode,
 * 		PackageName:     info.PackageName,
 * 	}
 * }
 */
export declare function fromBuildInfoRepopulateInfo(info: GoPtr<BuildInfoRepopulateInfo>): GoPtr<RepopulateDiagnosticInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setCompilerOptions","kind":"method","status":"implemented","sigHash":"25854ec5b49b0bd2a24d592e30dfee773f55eb95876eb0f93e01d213eb6982df","bodyHash":"b725f65b5866f09cce76721bc15b762993fefc48ef78a4e57492c4879e9182fa"}
 *
 * Go source:
 * func (t *toSnapshot) setCompilerOptions() {
 * 	t.snapshot.options = t.buildInfo.GetCompilerOptions(t.buildInfoDirectory)
 * }
 */
export declare function toSnapshot_setCompilerOptions(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setFileInfoAndEmitSignatures","kind":"method","status":"implemented","sigHash":"bd7aebb934918f65cb7e5eff67f974a5b521022093e1c9379cec023ff336f6b4","bodyHash":"1942c4c392e7033807c01e359128bd8a6d0842016bae2dd8b91df672163bf7cc"}
 *
 * Go source:
 * func (t *toSnapshot) setFileInfoAndEmitSignatures() {
 * 	isComposite := t.snapshot.options.Composite.IsTrue()
 * 	for index, buildInfoFileInfo := range t.buildInfo.FileInfos {
 * 		path := t.toFilePath(BuildInfoFileId(index + 1))
 * 		info := buildInfoFileInfo.GetFileInfo()
 * 		t.snapshot.fileInfos.Store(path, info)
 * 		// Add default emit signature as file's signature
 * 		if info.signature != "" && isComposite {
 * 			t.snapshot.emitSignatures.Store(path, &emitSignature{signature: info.signature})
 * 		}
 * 	}
 * 	// Fix up emit signatures
 * 	for _, value := range t.buildInfo.EmitSignatures {
 * 		if value.noEmitSignature() {
 * 			t.snapshot.emitSignatures.Delete(t.toFilePath(value.FileId))
 * 		} else {
 * 			path := t.toFilePath(value.FileId)
 * 			t.snapshot.emitSignatures.Store(path, value.toEmitSignature(path, &t.snapshot.emitSignatures))
 * 		}
 * 	}
 * }
 */
export declare function toSnapshot_setFileInfoAndEmitSignatures(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setReferencedMap","kind":"method","status":"implemented","sigHash":"8dab099a6133826b6a99a6efcb73208facc5d179f7e97caad8a6c7fd1d583dc2","bodyHash":"6fd0e66bedc9e375b5fe6206d731a90ce3fede60acbbf2b53f29e899732fa6c3"}
 *
 * Go source:
 * func (t *toSnapshot) setReferencedMap() {
 * 	for _, entry := range t.buildInfo.ReferencedMap {
 * 		t.snapshot.referencedMap.storeReferences(t.toFilePath(entry.FileId), t.toFilePathSet(entry.FileIdListId))
 * 	}
 * }
 */
export declare function toSnapshot_setReferencedMap(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setChangeFileSet","kind":"method","status":"implemented","sigHash":"bda3f69db9150a895f6d1f32bdd2bd3993586ffca899b8860026e0e658ac78b9","bodyHash":"9b5bcf4f76a948425e883022fda3323e6ee9f5ec44eb6cf896ae8886324d4333"}
 *
 * Go source:
 * func (t *toSnapshot) setChangeFileSet() {
 * 	for _, fileId := range t.buildInfo.ChangeFileSet {
 * 		filePath := t.toFilePath(fileId)
 * 		t.snapshot.changedFilesSet.Add(filePath)
 * 	}
 * }
 */
export declare function toSnapshot_setChangeFileSet(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setSemanticDiagnostics","kind":"method","status":"implemented","sigHash":"cfbb68cb17546cafd653c45832cbd7e327091e9972d43532d3f793d1508270cc","bodyHash":"340c10ff3b81f7596d82aa343f7111fe392e72df4cb7186967abda793b4f6ff2"}
 *
 * Go source:
 * func (t *toSnapshot) setSemanticDiagnostics() {
 * 	t.snapshot.fileInfos.Range(func(path tspath.Path, info *FileInfo) bool {
 * 		// Initialize to have no diagnostics if its not changed file
 * 		if !t.snapshot.changedFilesSet.Has(path) {
 * 			t.snapshot.semanticDiagnosticsPerFile.Store(path, &DiagnosticsOrBuildInfoDiagnosticsWithFileName{})
 * 		}
 * 		return true
 * 	})
 * 	for _, diagnostic := range t.buildInfo.SemanticDiagnosticsPerFile {
 * 		if diagnostic.FileId != 0 {
 * 			filePath := t.toFilePath(diagnostic.FileId)
 * 			t.snapshot.semanticDiagnosticsPerFile.Delete(filePath) // does not have cached diagnostics
 * 		} else {
 * 			filePath := t.toFilePath(diagnostic.Diagnostics.FileId)
 * 			t.snapshot.semanticDiagnosticsPerFile.Store(filePath, t.toDiagnosticsOrBuildInfoDiagnosticsWithFileName(diagnostic.Diagnostics))
 * 		}
 * 	}
 * }
 */
export declare function toSnapshot_setSemanticDiagnostics(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setEmitDiagnostics","kind":"method","status":"implemented","sigHash":"f65a6ca2d848db12bb4532f33ca4b47b2ba182d40ac60e05f831b4882440d1ea","bodyHash":"f3a5ea28dd90d24e34b5043d43c1b8909d8d272ccb955df0b2c432d1da7a4904"}
 *
 * Go source:
 * func (t *toSnapshot) setEmitDiagnostics() {
 * 	for _, diagnostic := range t.buildInfo.EmitDiagnosticsPerFile {
 * 		filePath := t.toFilePath(diagnostic.FileId)
 * 		t.snapshot.emitDiagnosticsPerFile.Store(filePath, t.toDiagnosticsOrBuildInfoDiagnosticsWithFileName(diagnostic))
 * 	}
 * }
 */
export declare function toSnapshot_setEmitDiagnostics(receiver: GoPtr<toSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildinfotosnapshot.go::method::toSnapshot.setAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"c7b79008537cca7198e5a0bc2ed242d3a1b8c3d3b3f00ed19bd2947fce2ee385","bodyHash":"b0f14f97e7e0df110a38e67240c90f2763d28d375a4cf7e1d410b00a935fb828"}
 *
 * Go source:
 * func (t *toSnapshot) setAffectedFilesPendingEmit() {
 * 	if len(t.buildInfo.AffectedFilesPendingEmit) == 0 {
 * 		return
 * 	}
 * 	ownOptionsEmitKind := GetFileEmitKind(t.snapshot.options)
 * 	for _, pendingEmit := range t.buildInfo.AffectedFilesPendingEmit {
 * 		t.snapshot.affectedFilesPendingEmit.Store(t.toFilePath(pendingEmit.FileId), core.IfElse(pendingEmit.EmitKind == 0, ownOptionsEmitKind, pendingEmit.EmitKind))
 * 	}
 * }
 */
export declare function toSnapshot_setAffectedFilesPendingEmit(receiver: GoPtr<toSnapshot>): void;
//# sourceMappingURL=buildinfotosnapshot.d.ts.map
import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoRef, GoSlice } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import { Bool } from "../../../go/sync/atomic.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Set } from "../../collections/set.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { EmitOptions, EmitResult, WriteFileData } from "../../compiler/program.js";
import type { Path } from "../../tspath/path.js";
import type { Program } from "./program.js";
import type { emitSignature, FileEmitKind } from "./snapshot.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::type::emitUpdate","kind":"type","status":"implemented","sigHash":"31f6da710657a6cf30883c75b819cbb029dc74228219b5ef999776b1d3e26e59","bodyHash":"b514029a6cc46f502243219e2a3c85568fca34dadd062aa2a02a0ca0bd34f46e"}
 *
 * Go source:
 * emitUpdate struct {
 * 	pendingKind        FileEmitKind
 * 	result             *compiler.EmitResult
 * 	dtsErrorsFromCache bool
 * }
 */
export interface emitUpdate {
    pendingKind: FileEmitKind;
    result: GoPtr<EmitResult>;
    dtsErrorsFromCache: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::type::emitFilesHandler","kind":"type","status":"implemented","sigHash":"641c2242c0bbd61cdb0125738752919a03f29a2aac06b2b5b4ecb8b86fb70512","bodyHash":"bdf74c91c73866c87bf90476ae3ad5ca75eaaa2313a1e5c68c36fee7ab3d7ac9"}
 *
 * Go source:
 * emitFilesHandler struct {
 * 	ctx                   context.Context
 * 	program               *Program
 * 	isForDtsErrors        bool
 * 	signatures            collections.SyncMap[tspath.Path, string]
 * 	emitSignatures        collections.SyncMap[tspath.Path, *emitSignature]
 * 	latestChangedDtsFiles collections.SyncMap[tspath.Path, string]
 * 	deletedPendingKinds   collections.Set[tspath.Path]
 * 	emitUpdates           collections.SyncMap[tspath.Path, *emitUpdate]
 * 	hasEmitDiagnostics    atomic.Bool
 * }
 */
export interface emitFilesHandler {
    ctx: Context;
    program: GoPtr<Program>;
    isForDtsErrors: bool;
    signatures: SyncMap<Path, string>;
    emitSignatures: SyncMap<Path, GoPtr<emitSignature>>;
    latestChangedDtsFiles: SyncMap<Path, string>;
    deletedPendingKinds: Set<Path>;
    emitUpdates: SyncMap<Path, GoPtr<emitUpdate>>;
    hasEmitDiagnostics: Bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.getPendingEmitKindForEmitOptions","kind":"method","status":"implemented","sigHash":"71c9abb4f704230ce9d3c421d06aa0d99ac298d12e7907d3329ea0a88908d317","bodyHash":"3d49e0d4497061ea11daa73eae97d477b4074505ad087d3ea48b7fa59a1f8eac"}
 *
 * Go source:
 * func (h *emitFilesHandler) getPendingEmitKindForEmitOptions(emitKind FileEmitKind, options compiler.EmitOptions) FileEmitKind {
 * 	pendingKind := getPendingEmitKind(emitKind, 0)
 * 	if options.EmitOnly == compiler.EmitOnlyDts {
 * 		pendingKind &= FileEmitKindAllDts
 * 	}
 * 	if h.isForDtsErrors {
 * 		pendingKind &= FileEmitKindDtsErrors
 * 	}
 * 	return pendingKind
 * }
 */
export declare function emitFilesHandler_getPendingEmitKindForEmitOptions(receiver: GoPtr<emitFilesHandler>, emitKind: FileEmitKind, options: EmitOptions): FileEmitKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.emitAllAffectedFiles","kind":"method","status":"implemented","sigHash":"693a69404b60b64335936450eda86838aee783c76edccaaa2cc8f18ab1c3cccb","bodyHash":"dc0f0a41ddeab4c2ec59a3daef86d8cbe64c6df62a0f77cb343720fd97aeb9ef"}
 *
 * Go source:
 * func (h *emitFilesHandler) emitAllAffectedFiles(options compiler.EmitOptions) *compiler.EmitResult {
 * 	// Emit all affected files
 * 	if h.program.snapshot.canUseIncrementalState() {
 * 		results := h.emitFilesIncremental(options)
 * 		if h.isForDtsErrors {
 * 			if options.TargetSourceFile != nil {
 * 				// Result from cache
 * 				diagnostics, _ := h.program.snapshot.emitDiagnosticsPerFile.Load(options.TargetSourceFile.Path())
 * 				result := &compiler.EmitResult{
 * 					EmitSkipped: true,
 * 					Diagnostics: diagnostics.getDiagnostics(h.program.program, options.TargetSourceFile),
 * 				}
 * 				h.updateHasEmitDiagnostics(result)
 * 				return result
 * 			}
 * 			for _, result := range results {
 * 				h.updateHasEmitDiagnostics(result)
 * 			}
 * 			return compiler.CombineEmitResults(results)
 * 		} else {
 * 			// Combine results and update buildInfo
 * 			result := compiler.CombineEmitResults(results)
 * 			h.updateHasEmitDiagnostics(result)
 * 			h.emitBuildInfo(options, result)
 * 			return result
 * 		}
 * 	} else if !h.isForDtsErrors {
 * 		result := h.program.program.Emit(h.ctx, h.getEmitOptions(options))
 * 		h.updateHasEmitDiagnostics(result)
 * 		h.updateSnapshot()
 * 		h.emitBuildInfo(options, result)
 * 		return result
 * 	} else {
 * 		result := &compiler.EmitResult{
 * 			EmitSkipped: true,
 * 			Diagnostics: h.program.program.GetDeclarationDiagnostics(h.ctx, options.TargetSourceFile),
 * 		}
 * 		if len(result.Diagnostics) != 0 {
 * 			h.updateHasEmitDiagnostics(result)
 * 			h.program.snapshot.hasEmitDiagnostics = true
 * 		}
 * 		return result
 * 	}
 * }
 */
export declare function emitFilesHandler_emitAllAffectedFiles(receiver: GoPtr<emitFilesHandler>, options: EmitOptions): GoPtr<EmitResult>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.updateHasEmitDiagnostics","kind":"method","status":"implemented","sigHash":"7343a65eab3249e36bd520e46203928833f0c161ed8bd40cea32080b64304654","bodyHash":"7e480667ab6b0b1dc78e8d7baec97e26289d08271bdd0cd4c9363ee0ca402c61"}
 *
 * Go source:
 * func (h *emitFilesHandler) updateHasEmitDiagnostics(result *compiler.EmitResult) {
 * 	if result != nil && len(result.Diagnostics) != 0 {
 * 		h.hasEmitDiagnostics.Store(true)
 * 	}
 * }
 */
export declare function emitFilesHandler_updateHasEmitDiagnostics(receiver: GoPtr<emitFilesHandler>, result: GoPtr<EmitResult>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.emitBuildInfo","kind":"method","status":"implemented","sigHash":"209c276792f309f9dfedac0aea3a67dbe60ffc14f2c4c6bf3c152d3bc132b865","bodyHash":"2901ec246aaddc2c722cff94145ce00e31abae529fc54cdc875e1cda04798333"}
 *
 * Go source:
 * func (h *emitFilesHandler) emitBuildInfo(options compiler.EmitOptions, result *compiler.EmitResult) {
 * 	buildInfoResult := h.program.emitBuildInfo(h.ctx, options)
 * 	if buildInfoResult != nil {
 * 		result.Diagnostics = append(result.Diagnostics, buildInfoResult.Diagnostics...)
 * 		result.EmittedFiles = append(result.EmittedFiles, buildInfoResult.EmittedFiles...)
 * 	}
 * }
 */
export declare function emitFilesHandler_emitBuildInfo(receiver: GoPtr<emitFilesHandler>, options: EmitOptions, result: GoPtr<EmitResult>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.emitFilesIncremental","kind":"method","status":"implemented","sigHash":"84b023c59ee6b24b6903d5f902f6a8d8418707943db49df2b2165ff38b473ce5","bodyHash":"0cadfad93b339fda2effedbc80aa76c359490bc20a9f9e6fc85a4745e607eca2"}
 *
 * Go source:
 * func (h *emitFilesHandler) emitFilesIncremental(options compiler.EmitOptions) []*compiler.EmitResult {
 * 	collectAllAffectedFiles(h.ctx, h.program)
 * 	if h.ctx.Err() != nil {
 * 		return nil
 * 	}
 *
 * 	wg := core.NewWorkGroup(h.program.program.SingleThreaded())
 * 	h.program.snapshot.affectedFilesPendingEmit.Range(func(path tspath.Path, emitKind FileEmitKind) bool {
 * 		affectedFile := h.program.program.GetSourceFileByPath(path)
 * 		if affectedFile == nil || !h.program.program.SourceFileMayBeEmitted(affectedFile, false) {
 * 			h.deletedPendingKinds.Add(path)
 * 			return true
 * 		}
 * 		pendingKind := h.getPendingEmitKindForEmitOptions(emitKind, options)
 * 		if pendingKind != 0 {
 * 			wg.Queue(func() {
 * 				var emitOnly compiler.EmitOnly
 * 				if (pendingKind & FileEmitKindAllJs) != 0 {
 * 					emitOnly = compiler.EmitOnlyJs
 * 				}
 * 				if (pendingKind & FileEmitKindAllDts) != 0 {
 * 					if emitOnly == compiler.EmitOnlyJs {
 * 						emitOnly = compiler.EmitAll
 * 					} else {
 * 						emitOnly = compiler.EmitOnlyDts
 * 					}
 * 				}
 * 				var result *compiler.EmitResult
 * 				if !h.isForDtsErrors {
 * 					result = h.program.program.Emit(h.ctx, h.getEmitOptions(compiler.EmitOptions{
 * 						TargetSourceFile: affectedFile,
 * 						EmitOnly:         emitOnly,
 * 						WriteFile:        options.WriteFile,
 * 					}))
 * 				} else {
 * 					result = &compiler.EmitResult{
 * 						EmitSkipped: true,
 * 						Diagnostics: h.program.program.GetDeclarationDiagnostics(h.ctx, affectedFile),
 * 					}
 * 				}
 * 				h.updateHasEmitDiagnostics(result)
 *
 * 				// Update the pendingEmit for the file
 * 				h.emitUpdates.Store(path, &emitUpdate{pendingKind: getPendingEmitKind(emitKind, pendingKind), result: result})
 * 			})
 * 		}
 * 		return true
 * 	})
 * 	wg.RunAndWait()
 * 	if h.ctx.Err() != nil {
 * 		return nil
 * 	}
 *
 * 	h.program.snapshot.emitDiagnosticsPerFile.Range(func(path tspath.Path, diagnostics *DiagnosticsOrBuildInfoDiagnosticsWithFileName) bool {
 * 		if _, ok := h.emitUpdates.Load(path); !ok {
 * 			affectedFile := h.program.program.GetSourceFileByPath(path)
 * 			if affectedFile == nil || !h.program.program.SourceFileMayBeEmitted(affectedFile, false) {
 * 				h.deletedPendingKinds.Add(path)
 * 				return true
 * 			}
 * 			pendingKind, _ := h.program.snapshot.affectedFilesPendingEmit.Load(path)
 * 			h.emitUpdates.Store(path, &emitUpdate{
 * 				pendingKind: pendingKind,
 * 				result: &compiler.EmitResult{
 * 					EmitSkipped: true,
 * 					Diagnostics: diagnostics.getDiagnostics(h.program.program, affectedFile),
 * 				},
 * 				dtsErrorsFromCache: true,
 * 			})
 * 		}
 * 		return true
 * 	})
 *
 * 	return h.updateSnapshot()
 * }
 */
export declare function emitFilesHandler_emitFilesIncremental(receiver: GoPtr<emitFilesHandler>, options: EmitOptions): GoSlice<GoPtr<EmitResult>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.getEmitOptions","kind":"method","status":"implemented","sigHash":"633754844181eb4783be72fffe98840d53ba104a71987010466c99e25eb7e2b7","bodyHash":"89ed75dee539ff603df55777165c7bde3eeabd765562882b9ce06c9baa923490"}
 *
 * Go source:
 * func (h *emitFilesHandler) getEmitOptions(options compiler.EmitOptions) compiler.EmitOptions {
 * 	if !h.program.snapshot.options.GetEmitDeclarations() {
 * 		return options
 * 	}
 * 	canUseIncrementalState := h.program.snapshot.canUseIncrementalState()
 * 	return compiler.EmitOptions{
 * 		TargetSourceFile: options.TargetSourceFile,
 * 		EmitOnly:         options.EmitOnly,
 * 		WriteFile: func(fileName string, text string, data *compiler.WriteFileData) error {
 * 			var differsOnlyInMap bool
 * 			if tspath.IsDeclarationFileName(fileName) {
 * 				if canUseIncrementalState {
 * 					var emitSignature string
 * 					info, _ := h.program.snapshot.fileInfos.Load(options.TargetSourceFile.Path())
 * 					if info.signature == info.version {
 * 						signature := h.program.snapshot.computeSignatureWithDiagnostics(options.TargetSourceFile, text, data)
 * 						if len(data.Diagnostics) == 0 {
 * 							emitSignature = signature
 * 						}
 * 						if signature != info.version {
 * 							h.signatures.Store(options.TargetSourceFile.Path(), signature)
 * 						}
 * 					}
 * 					if h.skipDtsOutputOfComposite(options.TargetSourceFile, fileName, text, data, emitSignature, &differsOnlyInMap) {
 * 						return nil
 * 					}
 * 				}
 * 			}
 * 			var aTime time.Time
 * 			if differsOnlyInMap {
 * 				aTime = h.program.host.GetMTime(fileName)
 * 			}
 * 			var err error
 * 			if options.WriteFile != nil {
 * 				err = options.WriteFile(fileName, text, data)
 * 			} else {
 * 				err = h.program.program.Host().FS().WriteFile(fileName, text)
 * 			}
 * 			if err == nil && differsOnlyInMap {
 * 				err = h.program.host.SetMTime(fileName, aTime)
 * 			}
 * 			return err
 * 		},
 * 	}
 * }
 */
export declare function emitFilesHandler_getEmitOptions(receiver: GoPtr<emitFilesHandler>, options: EmitOptions): EmitOptions;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.skipDtsOutputOfComposite","kind":"method","status":"implemented","sigHash":"7240360e91e809fc2ed741ce9ca6fe8e27683d21d8ab3947f0496fecd480c78a","bodyHash":"05ce1ca3e3dc9735d3c20a9fb97e6b901db45dec647c06ec9fdb4b7a7ae89707"}
 *
 * Go source:
 * func (h *emitFilesHandler) skipDtsOutputOfComposite(file *ast.SourceFile, outputFileName string, text string, data *compiler.WriteFileData, newSignature string, differsOnlyInMap *bool) bool {
 * 	if !h.program.snapshot.options.Composite.IsTrue() {
 * 		return false
 * 	}
 * 	var oldSignature string
 * 	oldSignatureFormat, ok := h.program.snapshot.emitSignatures.Load(file.Path())
 * 	if ok {
 * 		if oldSignatureFormat.signature != "" {
 * 			oldSignature = oldSignatureFormat.signature
 * 		} else {
 * 			oldSignature = oldSignatureFormat.signatureWithDifferentOptions[0]
 * 		}
 * 	}
 * 	if newSignature == "" {
 * 		newSignature = h.program.snapshot.computeHash(getTextHandlingSourceMapForSignature(text, data))
 * 	}
 * 	if newSignature == oldSignature {
 * 		if oldSignatureFormat != nil && oldSignatureFormat.signature == oldSignature {
 * 			data.SkippedDtsWrite = true
 * 			return true
 * 		} else {
 * 			*differsOnlyInMap = h.program.Options().Build.IsTrue()
 * 		}
 * 	} else {
 * 		h.latestChangedDtsFiles.Store(file.Path(), outputFileName)
 * 	}
 * 	h.emitSignatures.Store(file.Path(), &emitSignature{signature: newSignature})
 * 	return false
 * }
 */
export declare function emitFilesHandler_skipDtsOutputOfComposite(receiver: GoPtr<emitFilesHandler>, file: GoPtr<SourceFile>, outputFileName: string, text: string, data: GoPtr<WriteFileData>, newSignature: string, differsOnlyInMap: GoRef<bool>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.updateSnapshot","kind":"method","status":"implemented","sigHash":"d746a8744172bdd615efa10298af1a71a60321eb4d38fb478c2e861093f54551","bodyHash":"c16c104bcdb1f2e01fd684c072d2953351f7faa5da996453390ad740f809fca9"}
 *
 * Go source:
 * func (h *emitFilesHandler) updateSnapshot() []*compiler.EmitResult {
 * 	if h.program.snapshot.canUseIncrementalState() {
 * 		h.signatures.Range(func(file tspath.Path, signature string) bool {
 * 			info, _ := h.program.snapshot.fileInfos.Load(file)
 * 			info.signature = signature
 * 			if h.program.testingData != nil {
 * 				h.program.testingData.UpdatedSignatureKinds[file] = SignatureUpdateKindStoredAtEmit
 * 			}
 * 			h.program.snapshot.buildInfoEmitPending.Store(true)
 * 			return true
 * 		})
 * 		h.emitSignatures.Range(func(file tspath.Path, signature *emitSignature) bool {
 * 			h.program.snapshot.emitSignatures.Store(file, signature)
 * 			h.program.snapshot.buildInfoEmitPending.Store(true)
 * 			return true
 * 		})
 * 		for file := range h.deletedPendingKinds.Keys() {
 * 			h.program.snapshot.affectedFilesPendingEmit.Delete(file)
 * 			h.program.snapshot.buildInfoEmitPending.Store(true)
 * 		}
 * 		var results []*compiler.EmitResult
 * 		for _, file := range h.program.GetSourceFiles() {
 * 			if latestChangedDtsFile, ok := h.latestChangedDtsFiles.Load(file.Path()); ok {
 * 				h.program.snapshot.latestChangedDtsFile = latestChangedDtsFile
 * 				h.program.snapshot.buildInfoEmitPending.Store(true)
 * 				h.program.snapshot.hasChangedDtsFile = true
 * 			}
 * 			if update, ok := h.emitUpdates.Load(file.Path()); ok {
 * 				if !update.dtsErrorsFromCache {
 * 					if update.pendingKind == 0 {
 * 						h.program.snapshot.affectedFilesPendingEmit.Delete(file.Path())
 * 					} else {
 * 						h.program.snapshot.affectedFilesPendingEmit.Store(file.Path(), update.pendingKind)
 * 					}
 * 					h.program.snapshot.buildInfoEmitPending.Store(true)
 * 				}
 * 				if update.result != nil {
 * 					results = append(results, update.result)
 * 					if len(update.result.Diagnostics) != 0 {
 * 						h.program.snapshot.emitDiagnosticsPerFile.Store(file.Path(), &DiagnosticsOrBuildInfoDiagnosticsWithFileName{diagnostics: update.result.Diagnostics})
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return results
 * 	} else if h.hasEmitDiagnostics.Load() {
 * 		h.program.snapshot.hasEmitDiagnostics = true
 * 	}
 * 	return nil
 * }
 */
export declare function emitFilesHandler_updateSnapshot(receiver: GoPtr<emitFilesHandler>): GoSlice<GoPtr<EmitResult>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::func::emitFiles","kind":"func","status":"implemented","sigHash":"075ee0bdedb2935bed38f8f79ff52b742ca43133b48bac8676c4b36dde01a7d8","bodyHash":"c9ac4fdcb7350b5da041aaad9e7d300338617dc78e4dcfa8259cff7200506b59"}
 *
 * Go source:
 * func emitFiles(ctx context.Context, program *Program, options compiler.EmitOptions, isForDtsErrors bool) *compiler.EmitResult {
 * 	emitHandler := &emitFilesHandler{ctx: ctx, program: program, isForDtsErrors: isForDtsErrors}
 *
 * 	// Single file emit - do direct from program
 * 	if !isForDtsErrors && options.TargetSourceFile != nil {
 * 		result := program.program.Emit(ctx, emitHandler.getEmitOptions(options))
 * 		emitHandler.updateHasEmitDiagnostics(result)
 * 		if ctx.Err() != nil {
 * 			return nil
 * 		}
 * 		emitHandler.updateSnapshot()
 * 		return result
 * 	}
 *
 * 	return emitHandler.emitAllAffectedFiles(options)
 * }
 */
export declare function emitFiles(ctx: Context, program: GoPtr<Program>, options: EmitOptions, isForDtsErrors: bool): GoPtr<EmitResult>;
//# sourceMappingURL=emitfileshandler.d.ts.map
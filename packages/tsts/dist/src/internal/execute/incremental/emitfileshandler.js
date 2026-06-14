import { Map as SyncMapImpl } from "../../../go/sync.js";
import { Bool } from "../../../go/sync/atomic.js";
import { Time } from "../../../go/time.js";
import { SourceFile_Path } from "../../ast/ast.js";
import { Set_Add, Set_Keys } from "../../collections/set.js";
import { SyncMap_Delete, SyncMap_Load, SyncMap_Range, SyncMap_Store } from "../../collections/syncmap.js";
import { EmitAll, EmitOnlyDts, EmitOnlyJs, } from "../../compiler/emitter.js";
import { CombineEmitResults, Program_Emit as compiler_Program_Emit, Program_GetDeclarationDiagnostics, Program_GetSourceFileByPath as compiler_Program_GetSourceFileByPath, Program_Host as compiler_Program_Host, Program_SingleThreaded as compiler_Program_SingleThreaded, Program_SourceFileMayBeEmitted, } from "../../compiler/program.js";
import { CompilerOptions_GetEmitDeclarations } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { NewWorkGroup } from "../../core/workgroup.js";
import { IsDeclarationFileName } from "../../tspath/extension.js";
import { Program_emitBuildInfo, Program_GetSourceFiles as incremental_Program_GetSourceFiles, Program_Options as incremental_Program_Options, SignatureUpdateKindStoredAtEmit, } from "./program.js";
import { DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics, FileEmitKindAllDts, FileEmitKindAllJs, FileEmitKindDtsErrors, getPendingEmitKind, getTextHandlingSourceMapForSignature, snapshot_canUseIncrementalState, snapshot_computeHash, snapshot_computeSignatureWithDiagnostics, } from "./snapshot.js";
import { collectAllAffectedFiles } from "./affectedfileshandler.js";
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
export function emitFilesHandler_getPendingEmitKindForEmitOptions(receiver, emitKind, options) {
    let pendingKind = getPendingEmitKind(emitKind, 0);
    if (options.EmitOnly === EmitOnlyDts) {
        pendingKind = (pendingKind & FileEmitKindAllDts);
    }
    if (receiver.isForDtsErrors) {
        pendingKind = (pendingKind & FileEmitKindDtsErrors);
    }
    return pendingKind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.emitAllAffectedFiles","kind":"method","status":"implemented","sigHash":"693a69404b60b64335936450eda86838aee783c76edccaaa2cc8f18ab1c3cccb","bodyHash":"bd7247fca0c4ef48c6f61cc7fb2e79eaca3563e8966dc1600fe78720c4e3569c"}
 *
 * Go source:
 * func (h *emitFilesHandler) emitAllAffectedFiles(options compiler.EmitOptions) *compiler.EmitResult {
 * 	if h.program.snapshot.canUseIncrementalState() {
 * 		results := h.emitFilesIncremental(options)
 * 		if h.isForDtsErrors {
 * 			if options.TargetSourceFile != nil {
 * 				diagnostics, _ := h.program.snapshot.emitDiagnosticsPerFile.Load(options.TargetSourceFile.Path())
 * 				return &compiler.EmitResult{
 * 					EmitSkipped: true,
 * 					Diagnostics: diagnostics.getDiagnostics(h.program.program, options.TargetSourceFile),
 * 				}
 * 			}
 * 			return compiler.CombineEmitResults(results)
 * 		} else {
 * 			result := compiler.CombineEmitResults(results)
 * 			h.emitBuildInfo(options, result)
 * 			return result
 * 		}
 * 	} else if !h.isForDtsErrors {
 * 		result := h.program.program.Emit(h.ctx, h.getEmitOptions(options))
 * 		h.updateSnapshot()
 * 		h.emitBuildInfo(options, result)
 * 		return result
 * 	} else {
 * 		result := &compiler.EmitResult{
 * 			EmitSkipped: true,
 * 			Diagnostics: h.program.program.GetDeclarationDiagnostics(h.ctx, options.TargetSourceFile),
 * 		}
 * 		if len(result.Diagnostics) != 0 {
 * 			h.program.snapshot.hasEmitDiagnostics = true
 * 		}
 * 		return result
 * 	}
 * }
 */
export function emitFilesHandler_emitAllAffectedFiles(receiver, options) {
    if (snapshot_canUseIncrementalState(receiver.program.snapshot)) {
        const results = emitFilesHandler_emitFilesIncremental(receiver, options);
        if (receiver.isForDtsErrors) {
            if (options.TargetSourceFile !== undefined) {
                const [diagnostics] = SyncMap_Load(receiver.program.snapshot.emitDiagnosticsPerFile, SourceFile_Path(options.TargetSourceFile));
                return {
                    EmitSkipped: true,
                    Diagnostics: DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics(diagnostics, receiver.program.program, options.TargetSourceFile),
                    EmittedFiles: [],
                    SourceMaps: [],
                };
            }
            return CombineEmitResults(results);
        }
        else {
            const result = CombineEmitResults(results);
            emitFilesHandler_emitBuildInfo(receiver, options, result);
            return result;
        }
    }
    else if (!receiver.isForDtsErrors) {
        const result = compiler_Program_Emit(receiver.program.program, receiver.ctx, emitFilesHandler_getEmitOptions(receiver, options));
        emitFilesHandler_updateSnapshot(receiver);
        emitFilesHandler_emitBuildInfo(receiver, options, result);
        return result;
    }
    else {
        const result = {
            EmitSkipped: true,
            Diagnostics: Program_GetDeclarationDiagnostics(receiver.program.program, receiver.ctx, options.TargetSourceFile),
            EmittedFiles: [],
            SourceMaps: [],
        };
        if (result.Diagnostics.length !== 0) {
            receiver.program.snapshot.hasEmitDiagnostics = true;
        }
        return result;
    }
}
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
export function emitFilesHandler_emitBuildInfo(receiver, options, result) {
    const buildInfoResult = Program_emitBuildInfo(receiver.program, receiver.ctx, options);
    if (buildInfoResult !== undefined) {
        result.Diagnostics = [...result.Diagnostics, ...buildInfoResult.Diagnostics];
        result.EmittedFiles = [...result.EmittedFiles, ...buildInfoResult.EmittedFiles];
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.emitFilesIncremental","kind":"method","status":"implemented","sigHash":"84b023c59ee6b24b6903d5f902f6a8d8418707943db49df2b2165ff38b473ce5","bodyHash":"d4742cca164f29c6faa87ecaaa36fca625c7154c52bf7321094e23fa84721f48"}
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
export function emitFilesHandler_emitFilesIncremental(receiver, options) {
    collectAllAffectedFiles(receiver.ctx, receiver.program);
    if (receiver.ctx.Err() !== undefined) {
        return [];
    }
    const wg = NewWorkGroup(compiler_Program_SingleThreaded(receiver.program.program));
    SyncMap_Range(receiver.program.snapshot.affectedFilesPendingEmit, (path, emitKind) => {
        const affectedFile = compiler_Program_GetSourceFileByPath(receiver.program.program, path);
        if (affectedFile === undefined || !Program_SourceFileMayBeEmitted(receiver.program.program, affectedFile, false)) {
            Set_Add(receiver.deletedPendingKinds, path);
            return true;
        }
        const pendingKind = emitFilesHandler_getPendingEmitKindForEmitOptions(receiver, emitKind, options);
        if (pendingKind !== 0) {
            wg.Queue(() => {
                let emitOnly = EmitAll;
                if ((pendingKind & FileEmitKindAllJs) !== 0) {
                    emitOnly = EmitOnlyJs;
                }
                if ((pendingKind & FileEmitKindAllDts) !== 0) {
                    if (emitOnly === EmitOnlyJs) {
                        emitOnly = EmitAll;
                    }
                    else {
                        emitOnly = EmitOnlyDts;
                    }
                }
                let result;
                if (!receiver.isForDtsErrors) {
                    result = compiler_Program_Emit(receiver.program.program, receiver.ctx, emitFilesHandler_getEmitOptions(receiver, {
                        TargetSourceFile: affectedFile,
                        EmitOnly: emitOnly,
                        WriteFile: options.WriteFile,
                    }));
                }
                else {
                    result = {
                        EmitSkipped: true,
                        Diagnostics: Program_GetDeclarationDiagnostics(receiver.program.program, receiver.ctx, affectedFile),
                        EmittedFiles: [],
                        SourceMaps: [],
                    };
                }
                SyncMap_Store(receiver.emitUpdates, path, { pendingKind: getPendingEmitKind(emitKind, pendingKind), result: result, dtsErrorsFromCache: false });
            });
        }
        return true;
    });
    wg.RunAndWait();
    if (receiver.ctx.Err() !== undefined) {
        return [];
    }
    SyncMap_Range(receiver.program.snapshot.emitDiagnosticsPerFile, (path, diagnostics) => {
        const [, ok] = SyncMap_Load(receiver.emitUpdates, path);
        if (!ok) {
            const affectedFile = compiler_Program_GetSourceFileByPath(receiver.program.program, path);
            if (affectedFile === undefined || !Program_SourceFileMayBeEmitted(receiver.program.program, affectedFile, false)) {
                Set_Add(receiver.deletedPendingKinds, path);
                return true;
            }
            const [pendingKind] = SyncMap_Load(receiver.program.snapshot.affectedFilesPendingEmit, path);
            SyncMap_Store(receiver.emitUpdates, path, {
                pendingKind: pendingKind,
                result: {
                    EmitSkipped: true,
                    Diagnostics: DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics(diagnostics, receiver.program.program, affectedFile),
                    EmittedFiles: [],
                    SourceMaps: [],
                },
                dtsErrorsFromCache: true,
            });
        }
        return true;
    });
    return emitFilesHandler_updateSnapshot(receiver);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::method::emitFilesHandler.getEmitOptions","kind":"method","status":"implemented","sigHash":"633754844181eb4783be72fffe98840d53ba104a71987010466c99e25eb7e2b7","bodyHash":"d1d19ba214cb27a2e40842f8ced4c9e99cd3cef3c469515d18941b5cc7e79a7c"}
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
 * 				} else if len(data.Diagnostics) > 0 {
 * 					h.hasEmitDiagnostics.Store(true)
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
export function emitFilesHandler_getEmitOptions(receiver, options) {
    if (!CompilerOptions_GetEmitDeclarations(receiver.program.snapshot.options)) {
        return options;
    }
    const canUseIncrementalState = snapshot_canUseIncrementalState(receiver.program.snapshot);
    return {
        TargetSourceFile: options.TargetSourceFile,
        EmitOnly: options.EmitOnly,
        WriteFile: (fileName, text, data) => {
            const differsOnlyInMapBox = { v: false };
            if (IsDeclarationFileName(fileName)) {
                if (canUseIncrementalState) {
                    let emitSig = "";
                    const [info] = SyncMap_Load(receiver.program.snapshot.fileInfos, SourceFile_Path(options.TargetSourceFile));
                    if (info.signature === info.version) {
                        const signature = snapshot_computeSignatureWithDiagnostics(receiver.program.snapshot, options.TargetSourceFile, text, data);
                        if (data.Diagnostics.length === 0) {
                            emitSig = signature;
                        }
                        if (signature !== info.version) {
                            SyncMap_Store(receiver.signatures, SourceFile_Path(options.TargetSourceFile), signature);
                        }
                    }
                    if (emitFilesHandler_skipDtsOutputOfComposite(receiver, options.TargetSourceFile, fileName, text, data, emitSig, differsOnlyInMapBox)) {
                        return undefined;
                    }
                }
                else if (data.Diagnostics.length > 0) {
                    receiver.hasEmitDiagnostics.Store(true);
                }
            }
            let aTime = new Time();
            if (differsOnlyInMapBox.v) {
                aTime = receiver.program.host.GetMTime(fileName);
            }
            let err;
            if (options.WriteFile !== undefined) {
                err = options.WriteFile(fileName, text, data);
            }
            else {
                err = compiler_Program_Host(receiver.program.program).FS().WriteFile(fileName, text);
            }
            if (err === undefined && differsOnlyInMapBox.v) {
                err = receiver.program.host.SetMTime(fileName, aTime);
            }
            return err;
        },
    };
}
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
export function emitFilesHandler_skipDtsOutputOfComposite(receiver, file, outputFileName, text, data, newSignature, differsOnlyInMap) {
    if (!Tristate_IsTrue(receiver.program.snapshot.options.Composite)) {
        return false;
    }
    let oldSignature = "";
    const [oldSignatureFormat, ok] = SyncMap_Load(receiver.program.snapshot.emitSignatures, SourceFile_Path(file));
    if (ok) {
        if (oldSignatureFormat.signature !== "") {
            oldSignature = oldSignatureFormat.signature;
        }
        else {
            oldSignature = oldSignatureFormat.signatureWithDifferentOptions[0];
        }
    }
    if (newSignature === "") {
        newSignature = snapshot_computeHash(receiver.program.snapshot, getTextHandlingSourceMapForSignature(text, data));
    }
    if (newSignature === oldSignature) {
        if (oldSignatureFormat !== undefined && oldSignatureFormat.signature === oldSignature) {
            data.SkippedDtsWrite = true;
            return true;
        }
        else {
            differsOnlyInMap.v = Tristate_IsTrue(incremental_Program_Options(receiver.program).Build);
        }
    }
    else {
        SyncMap_Store(receiver.latestChangedDtsFiles, SourceFile_Path(file), outputFileName);
    }
    SyncMap_Store(receiver.emitSignatures, SourceFile_Path(file), { signature: newSignature, signatureWithDifferentOptions: [] });
    return false;
}
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
export function emitFilesHandler_updateSnapshot(receiver) {
    if (snapshot_canUseIncrementalState(receiver.program.snapshot)) {
        SyncMap_Range(receiver.signatures, (file, signature) => {
            const [info] = SyncMap_Load(receiver.program.snapshot.fileInfos, file);
            info.signature = signature;
            if (receiver.program.testingData !== undefined) {
                receiver.program.testingData.UpdatedSignatureKinds.set(file, SignatureUpdateKindStoredAtEmit);
            }
            receiver.program.snapshot.buildInfoEmitPending.Store(true);
            return true;
        });
        SyncMap_Range(receiver.emitSignatures, (file, signature) => {
            SyncMap_Store(receiver.program.snapshot.emitSignatures, file, signature);
            receiver.program.snapshot.buildInfoEmitPending.Store(true);
            return true;
        });
        for (const [file] of Set_Keys(receiver.deletedPendingKinds)) {
            SyncMap_Delete(receiver.program.snapshot.affectedFilesPendingEmit, file);
            receiver.program.snapshot.buildInfoEmitPending.Store(true);
        }
        const results = [];
        for (const file of incremental_Program_GetSourceFiles(receiver.program)) {
            const [latestChangedDtsFile, ok1] = SyncMap_Load(receiver.latestChangedDtsFiles, SourceFile_Path(file));
            if (ok1) {
                receiver.program.snapshot.latestChangedDtsFile = latestChangedDtsFile;
                receiver.program.snapshot.buildInfoEmitPending.Store(true);
                receiver.program.snapshot.hasChangedDtsFile = true;
            }
            const [update, ok2] = SyncMap_Load(receiver.emitUpdates, SourceFile_Path(file));
            if (ok2) {
                if (!update.dtsErrorsFromCache) {
                    if (update.pendingKind === 0) {
                        SyncMap_Delete(receiver.program.snapshot.affectedFilesPendingEmit, SourceFile_Path(file));
                    }
                    else {
                        SyncMap_Store(receiver.program.snapshot.affectedFilesPendingEmit, SourceFile_Path(file), update.pendingKind);
                    }
                    receiver.program.snapshot.buildInfoEmitPending.Store(true);
                }
                if (update.result !== undefined) {
                    results.push(update.result);
                    if (update.result.Diagnostics.length !== 0) {
                        SyncMap_Store(receiver.program.snapshot.emitDiagnosticsPerFile, SourceFile_Path(file), { diagnostics: update.result.Diagnostics, buildInfoDiagnostics: [] });
                    }
                }
            }
        }
        return results;
    }
    else if (receiver.hasEmitDiagnostics.Load()) {
        receiver.program.snapshot.hasEmitDiagnostics = true;
    }
    return [];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/emitfileshandler.go::func::emitFiles","kind":"func","status":"implemented","sigHash":"075ee0bdedb2935bed38f8f79ff52b742ca43133b48bac8676c4b36dde01a7d8","bodyHash":"7eb7352cd24b086cf5f8c618b99ecdeeeeaca4bd0bf2d78dc00229e9c5b4590b"}
 *
 * Go source:
 * func emitFiles(ctx context.Context, program *Program, options compiler.EmitOptions, isForDtsErrors bool) *compiler.EmitResult {
 * 	emitHandler := &emitFilesHandler{ctx: ctx, program: program, isForDtsErrors: isForDtsErrors}
 *
 * 	if !isForDtsErrors && options.TargetSourceFile != nil {
 * 		result := program.program.Emit(ctx, emitHandler.getEmitOptions(options))
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
export function emitFiles(ctx, program, options, isForDtsErrors) {
    const emitHandler = {
        ctx: ctx,
        program: program,
        isForDtsErrors: isForDtsErrors,
        signatures: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        emitSignatures: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        latestChangedDtsFiles: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        deletedPendingKinds: { M: new Map() },
        emitUpdates: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        hasEmitDiagnostics: new Bool(),
    };
    if (!isForDtsErrors && options.TargetSourceFile !== undefined) {
        const result = compiler_Program_Emit(program.program, ctx, emitFilesHandler_getEmitOptions(emitHandler, options));
        if (ctx.Err() !== undefined) {
            return undefined;
        }
        emitFilesHandler_updateSnapshot(emitHandler);
        return result;
    }
    return emitFilesHandler_emitAllAffectedFiles(emitHandler, options);
}
//# sourceMappingURL=emitfileshandler.js.map
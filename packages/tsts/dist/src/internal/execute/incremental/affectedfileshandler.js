import { Map as SyncMapImpl, Mutex, Once } from "../../../go/sync.js";
import { Bool } from "../../../go/sync/atomic.js";
import { Node_Symbol, SourceFile_Path } from "../../ast/ast.js";
import { NodeDefault_AsNode } from "../../ast/spine.js";
import { SymbolFlagsConstEnum } from "../../ast/symbolflags.js";
import { GetSourceFileOfNode } from "../../ast/utilities.js";
import { SkipAlias } from "../../checker/utilities.js";
import { SyncMap_Delete, SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Range, SyncMap_Store } from "../../collections/syncmap.js";
import { SyncSet_Add, SyncSet_Has, SyncSet_Range, SyncSet_Size } from "../../collections/syncset.js";
import { Filter, IfElse } from "../../core/core.js";
import { CompilerOptions_GetEmitDeclarations } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { Program_Emit as compiler_Program_Emit, Program_GetSourceFileByPath as compiler_Program_GetSourceFileByPath, Program_GetTypeCheckerForFileExclusive as compiler_Program_GetTypeCheckerForFileExclusive, Program_IsSourceFileDefaultLibrary as compiler_Program_IsSourceFileDefaultLibrary, Program_SingleThreaded as compiler_Program_SingleThreaded, Program_SkipTypeChecking as compiler_Program_SkipTypeChecking, } from "../../compiler/program.js";
import { EmitOnlyForcedDts } from "../../compiler/emitter.js";
import { IsDeclarationFileName } from "../../tspath/extension.js";
import { NewWorkGroup } from "../../core/workgroup.js";
import { SignatureUpdateKindUsedVersion } from "./program.js";
import { FileEmitKindAllDts, FileEmitKindDts, GetFileEmitKind, snapshot_addFileToAffectedFilesPendingEmit, snapshot_computeSignatureWithDiagnostics, snapshot_getAllFilesExcludingDefaultLibraryFile, } from "./snapshot.js";
import { referenceMap_getReferencedBy } from "./referencemap.js";
import { Program_GetSourceFiles as incremental_Program_GetSourceFiles } from "./program.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::dtsMayChange.addFileToAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"3393389a6d76c22f5ef2391904b34a5d766ea6c80f05a565c681787e5fa5b97f","bodyHash":"6dfa4b78a33764a0029c279b715dc4f4b608baaf1978109a1f8d479b68780e57"}
 *
 * Go source:
 * func (c dtsMayChange) addFileToAffectedFilesPendingEmit(filePath tspath.Path, emitKind FileEmitKind) {
 * 	c[filePath] = emitKind
 * }
 */
export function dtsMayChange_addFileToAffectedFilesPendingEmit(receiver, filePath, emitKind) {
    receiver.set(filePath, emitKind);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.getDtsMayChange","kind":"method","status":"implemented","sigHash":"d835a53fa87c78ee1ebeccb9347073eeaa237e14601a9d9ec46a76084687b5be","bodyHash":"7d280776ac75013b9bebaacb20d3d9e1ae85460ae78f2af5d929a6c4682c1b30"}
 *
 * Go source:
 * func (h *affectedFilesHandler) getDtsMayChange(affectedFilePath tspath.Path, affectedFileEmitKind FileEmitKind) dtsMayChange {
 * 	result := dtsMayChange(map[tspath.Path]FileEmitKind{affectedFilePath: affectedFileEmitKind})
 * 	h.dtsMayChange = append(h.dtsMayChange, result)
 * 	return result
 * }
 */
export function affectedFilesHandler_getDtsMayChange(receiver, affectedFilePath, affectedFileEmitKind) {
    const result = new Map();
    result.set(affectedFilePath, affectedFileEmitKind);
    receiver.dtsMayChange.push(result);
    return result;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.isChangedSignature","kind":"method","status":"implemented","sigHash":"4564fef6d5fb9de9b63d08a2fadb3eca3ba493c556b82ca956b747b99ebbfeb3","bodyHash":"21cf6b7180feedb2390dd6f450fdf940e1da998510296862fcd6afdddb7a3926"}
 *
 * Go source:
 * func (h *affectedFilesHandler) isChangedSignature(path tspath.Path) bool {
 * 	newSignature, _ := h.updatedSignatures.Load(path)
 * 	oldInfo, _ := h.program.snapshot.fileInfos.Load(path)
 * 	return newSignature.signature != oldInfo.signature
 * }
 */
export function affectedFilesHandler_isChangedSignature(receiver, path) {
    const [newSignature] = SyncMap_Load(receiver.updatedSignatures, path);
    const [oldInfo] = SyncMap_Load(receiver.program.snapshot.fileInfos, path);
    return (newSignature.signature !== oldInfo.signature);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.removeSemanticDiagnosticsOf","kind":"method","status":"implemented","sigHash":"0a1e9519798812a989e36b9b6328ddfc0aafde758494f9c9cc670b544d51fd33","bodyHash":"318381405326e0156613fc94b0af0cca3eb8a5dd9760f554a97f952d698a1c8a"}
 *
 * Go source:
 * func (h *affectedFilesHandler) removeSemanticDiagnosticsOf(path tspath.Path) {
 * 	h.filesToRemoveDiagnostics.Add(path)
 * }
 */
export function affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, path) {
    SyncSet_Add(receiver.filesToRemoveDiagnostics, path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.removeDiagnosticsOfLibraryFiles","kind":"method","status":"implemented","sigHash":"3c97f238cbae0e190e5870c4eaf52516ba2abbacfc02bf5ea37c5b9e0fe92d50","bodyHash":"1529dee63377190eb19c06ea5aa640c548093f5bb75cdf6b95ca09f17cf40a23"}
 *
 * Go source:
 * func (h *affectedFilesHandler) removeDiagnosticsOfLibraryFiles() {
 * 	h.cleanedDiagnosticsOfLibFiles.Do(func() {
 * 		for _, file := range h.program.GetSourceFiles() {
 * 			if h.program.program.IsSourceFileDefaultLibrary(file.Path()) && !h.program.program.SkipTypeChecking(file, true) {
 * 				h.removeSemanticDiagnosticsOf(file.Path())
 * 			}
 * 		}
 * 	})
 * }
 */
export function affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver) {
    receiver.cleanedDiagnosticsOfLibFiles.Do(() => {
        for (const file of incremental_Program_GetSourceFiles(receiver.program)) {
            if (compiler_Program_IsSourceFileDefaultLibrary(receiver.program.program, SourceFile_Path(file)) &&
                !compiler_Program_SkipTypeChecking(receiver.program.program, file, true)) {
                affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, SourceFile_Path(file));
            }
        }
    });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.computeDtsSignature","kind":"method","status":"implemented","sigHash":"271a4ef527f323ca43afe123eaca3814a900255dcebf44e1ccf22db26c5f1d20","bodyHash":"494b355ac096b56c8ea31064845f956f158069cb6937cfd0fb2dfbcf204a9ce3"}
 *
 * Go source:
 * func (h *affectedFilesHandler) computeDtsSignature(file *ast.SourceFile) string {
 * 	var signature string
 * 	h.program.program.Emit(h.ctx, compiler.EmitOptions{
 * 		TargetSourceFile: file,
 * 		EmitOnly:         compiler.EmitOnlyForcedDts,
 * 		WriteFile: func(fileName string, text string, data *compiler.WriteFileData) error {
 * 			if !tspath.IsDeclarationFileName(fileName) {
 * 				panic("File extension for signature expected to be dts, got : " + fileName)
 * 			}
 * 			signature = h.program.snapshot.computeSignatureWithDiagnostics(file, text, data)
 * 			return nil
 * 		},
 * 	})
 * 	return signature
 * }
 */
export function affectedFilesHandler_computeDtsSignature(receiver, file) {
    let signature = "";
    compiler_Program_Emit(receiver.program.program, receiver.ctx, {
        TargetSourceFile: file,
        EmitOnly: EmitOnlyForcedDts,
        WriteFile: (fileName, text, data) => {
            if (!IsDeclarationFileName(fileName)) {
                throw new globalThis.Error("File extension for signature expected to be dts, got : " + fileName);
            }
            signature = snapshot_computeSignatureWithDiagnostics(receiver.program.snapshot, file, text, data);
            return undefined;
        },
    });
    return signature;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.updateShapeSignature","kind":"method","status":"implemented","sigHash":"538f3579da29c0b11c175eaac9f241e78072f3416c8ac0f7267c9a38dea9de39","bodyHash":"4e973d4b66a6741b6af66919878f23be8c53ed86040c8098fc6beba69e8d9179"}
 *
 * Go source:
 * func (h *affectedFilesHandler) updateShapeSignature(file *ast.SourceFile, useFileVersionAsSignature bool) bool {
 * 	update := &updatedSignature{}
 * 	update.mu.Lock()
 * 	defer update.mu.Unlock()
 * 	if existing, ok := h.updatedSignatures.LoadOrStore(file.Path(), update); ok {
 * 		existing.mu.Lock()
 * 		defer existing.mu.Unlock()
 * 		return false
 * 	}
 *
 * 	info, _ := h.program.snapshot.fileInfos.Load(file.Path())
 * 	prevSignature := info.signature
 * 	if !file.IsDeclarationFile && !useFileVersionAsSignature {
 * 		update.signature = h.computeDtsSignature(file)
 * 	}
 * 	if update.signature == "" {
 * 		update.signature = info.version
 * 		update.kind = SignatureUpdateKindUsedVersion
 * 	}
 * 	return update.signature != prevSignature
 * }
 */
export function affectedFilesHandler_updateShapeSignature(receiver, file, useFileVersionAsSignature) {
    const update = { mu: new Mutex(), signature: "", kind: SignatureUpdateKindUsedVersion };
    update.mu.Lock();
    const [existing, ok] = SyncMap_LoadOrStore(receiver.updatedSignatures, SourceFile_Path(file), update);
    if (ok) {
        existing.mu.Lock();
        existing.mu.Unlock();
        update.mu.Unlock();
        return false;
    }
    const [info] = SyncMap_Load(receiver.program.snapshot.fileInfos, SourceFile_Path(file));
    const prevSignature = info.signature;
    if (!file.IsDeclarationFile && !useFileVersionAsSignature) {
        update.signature = affectedFilesHandler_computeDtsSignature(receiver, file);
    }
    if (update.signature === "") {
        update.signature = info.version;
        update.kind = SignatureUpdateKindUsedVersion;
    }
    update.mu.Unlock();
    return (update.signature !== prevSignature);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.getFilesAffectedBy","kind":"method","status":"implemented","sigHash":"63550bf101d9f5bd623f821ada8a72c7b04277d056c6c0be1f582c23b8f95431","bodyHash":"cfe51ec4211f2cec1da72f64de9ac262b8bd5cbbf128b0bafc4a9f95d812f58f"}
 *
 * Go source:
 * func (h *affectedFilesHandler) getFilesAffectedBy(path tspath.Path) []*ast.SourceFile {
 * 	file := h.program.program.GetSourceFileByPath(path)
 * 	if file == nil {
 * 		return nil
 * 	}
 *
 * 	if !h.updateShapeSignature(file, false) {
 * 		return []*ast.SourceFile{file}
 * 	}
 *
 * 	if info, _ := h.program.snapshot.fileInfos.Load(file.Path()); info.affectsGlobalScope {
 * 		h.hasAllFilesExcludingDefaultLibraryFile.Store(true)
 * 		h.program.snapshot.getAllFilesExcludingDefaultLibraryFile(h.program.program, file)
 * 	}
 *
 * 	if h.program.snapshot.options.IsolatedModules.IsTrue() {
 * 		return []*ast.SourceFile{file}
 * 	}
 *
 * 	seenFileNamesMap := h.forEachFileReferencedBy(
 * 		file,
 * 		func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool) {
 * 			if currentFile != nil && h.updateShapeSignature(currentFile, false) {
 * 				return true, false
 * 			}
 * 			return false, false
 * 		},
 * 	)
 * 	return core.Filter(slices.Collect(maps.Values(seenFileNamesMap)), func(file *ast.SourceFile) bool {
 * 		return file != nil
 * 	})
 * }
 */
export function affectedFilesHandler_getFilesAffectedBy(receiver, path) {
    const file = compiler_Program_GetSourceFileByPath(receiver.program.program, path);
    if (file === undefined) {
        return [];
    }
    if (!affectedFilesHandler_updateShapeSignature(receiver, file, false)) {
        return [file];
    }
    const [info] = SyncMap_Load(receiver.program.snapshot.fileInfos, SourceFile_Path(file));
    if (info.affectsGlobalScope) {
        receiver.hasAllFilesExcludingDefaultLibraryFile.Store(true);
        snapshot_getAllFilesExcludingDefaultLibraryFile(receiver.program.snapshot, receiver.program.program, file);
    }
    if (Tristate_IsTrue(receiver.program.snapshot.options.IsolatedModules)) {
        return [file];
    }
    const seenFileNamesMap = affectedFilesHandler_forEachFileReferencedBy(receiver, file, (currentFile, _currentPath) => {
        if (currentFile !== undefined && affectedFilesHandler_updateShapeSignature(receiver, currentFile, false)) {
            return [true, false];
        }
        return [false, false];
    });
    const values = [];
    for (const v of seenFileNamesMap.values()) {
        values.push(v);
    }
    return Filter(values, (f) => (f !== undefined));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.forEachFileReferencedBy","kind":"method","status":"implemented","sigHash":"af4ac7216943a39b59e9e8c6a57bbe66a008f5109c2004fc7f37d0bb55dc7e8e","bodyHash":"e2700b17e9d91141a1549c34d2d48de38a1fffdae7be903747ef36b446292c5d"}
 *
 * Go source:
 * func (h *affectedFilesHandler) forEachFileReferencedBy(file *ast.SourceFile, fn func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool)) map[tspath.Path]*ast.SourceFile {
 * 	seenFileNamesMap := map[tspath.Path]*ast.SourceFile{}
 * 	seenFileNamesMap[file.Path()] = file
 * 	queue := slices.Collect(h.program.snapshot.referencedMap.getReferencedBy(file.Path()))
 * 	for len(queue) > 0 {
 * 		currentPath := queue[len(queue)-1]
 * 		queue = queue[:len(queue)-1]
 * 		if _, ok := seenFileNamesMap[currentPath]; !ok {
 * 			currentFile := h.program.program.GetSourceFileByPath(currentPath)
 * 			seenFileNamesMap[currentPath] = currentFile
 * 			queueForFile, fastReturn := fn(currentFile, currentPath)
 * 			if fastReturn {
 * 				return seenFileNamesMap
 * 			}
 * 			if queueForFile {
 * 				for ref := range h.program.snapshot.referencedMap.getReferencedBy(currentFile.Path()) {
 * 					queue = append(queue, ref)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return seenFileNamesMap
 * }
 */
export function affectedFilesHandler_forEachFileReferencedBy(receiver, file, fn) {
    const seenFileNamesMap = new Map();
    seenFileNamesMap.set(SourceFile_Path(file), file);
    const queue = [];
    referenceMap_getReferencedBy(receiver.program.snapshot.referencedMap, SourceFile_Path(file))((p) => {
        queue.push(p);
        return true;
    });
    while (queue.length > 0) {
        const currentPath = queue[queue.length - 1];
        queue.splice(queue.length - 1, 1);
        if (!seenFileNamesMap.has(currentPath)) {
            const currentFile = compiler_Program_GetSourceFileByPath(receiver.program.program, currentPath);
            seenFileNamesMap.set(currentPath, currentFile);
            const [queueForFile, fastReturn] = fn(currentFile, currentPath);
            if (fastReturn) {
                return seenFileNamesMap;
            }
            if (queueForFile) {
                referenceMap_getReferencedBy(receiver.program.snapshot.referencedMap, SourceFile_Path(currentFile))((ref) => {
                    queue.push(ref);
                    return true;
                });
            }
        }
    }
    return seenFileNamesMap;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfAffectedFile","kind":"method","status":"implemented","sigHash":"a5c0e8df65875fc9df4b7b89abfc1b81628a2baafeecdbf120e79761625ea059","bodyHash":"83361289b5d5a1794c003fa4cae94fee55a497ac4b5b5035b3fb743ddf699fbf"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfAffectedFile(dtsMayChange dtsMayChange, affectedFile *ast.SourceFile) {
 * 	h.removeSemanticDiagnosticsOf(affectedFile.Path())
 *
 * 	if h.hasAllFilesExcludingDefaultLibraryFile.Load() {
 * 		h.removeDiagnosticsOfLibraryFiles()
 * 		h.updateShapeSignature(affectedFile, false)
 * 		return
 * 	}
 *
 * 	if h.program.snapshot.options.AssumeChangesOnlyAffectDirectDependencies.IsTrue() {
 * 		return
 * 	}
 *
 * 	if !h.program.snapshot.changedFilesSet.Has(affectedFile.Path()) ||
 * 		!h.isChangedSignature(affectedFile.Path()) {
 * 		return
 * 	}
 *
 * 	if h.program.snapshot.options.IsolatedModules.IsTrue() {
 * 		h.forEachFileReferencedBy(
 * 			affectedFile,
 * 			func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool) {
 * 				if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, currentPath, false) {
 * 					return false, true
 * 				}
 * 				h.handleDtsMayChangeOf(dtsMayChange, currentPath, false)
 * 				if h.isChangedSignature(currentPath) {
 * 					return true, false
 * 				}
 * 				return false, false
 * 			},
 * 		)
 * 	}
 *
 * 	invalidateJsFiles := false
 * 	var typeChecker *checker.Checker
 * 	var done func()
 * 	if affectedFile.Symbol != nil {
 * 		for _, exported := range affectedFile.Symbol.Exports {
 * 			if exported.Flags&ast.SymbolFlagsConstEnum != 0 {
 * 				invalidateJsFiles = true
 * 				break
 * 			}
 * 			if typeChecker == nil {
 * 				typeChecker, done = h.program.program.GetTypeCheckerForFileExclusive(h.ctx, affectedFile)
 * 			}
 * 			aliased := checker.SkipAlias(exported, typeChecker)
 * 			if aliased == exported {
 * 				continue
 * 			}
 * 			if (aliased.Flags & ast.SymbolFlagsConstEnum) != 0 {
 * 				if slices.ContainsFunc(aliased.Declarations, func(d *ast.Node) bool {
 * 					return ast.GetSourceFileOfNode(d) == affectedFile
 * 				}) {
 * 					invalidateJsFiles = true
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if done != nil {
 * 		done()
 * 	}
 *
 * 	for fileReferencingChangedFile := range h.program.snapshot.referencedMap.getReferencedBy(affectedFile.Path()) {
 * 		if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, fileReferencingChangedFile, invalidateJsFiles) {
 * 			return
 * 		}
 * 		for fileReferencingAffectedFile := range h.program.snapshot.referencedMap.getReferencedBy(fileReferencingChangedFile) {
 * 			if h.handleDtsMayChangeOfFileAndReferences(dtsMayChange, fileReferencingAffectedFile, invalidateJsFiles) {
 * 				return
 * 			}
 * 		}
 * 	}
 * }
 */
export function affectedFilesHandler_handleDtsMayChangeOfAffectedFile(receiver, dtsMayChange, affectedFile) {
    affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, SourceFile_Path(affectedFile));
    if (receiver.hasAllFilesExcludingDefaultLibraryFile.Load()) {
        affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver);
        affectedFilesHandler_updateShapeSignature(receiver, affectedFile, false);
        return;
    }
    if (Tristate_IsTrue(receiver.program.snapshot.options.AssumeChangesOnlyAffectDirectDependencies)) {
        return;
    }
    if (!SyncSet_Has(receiver.program.snapshot.changedFilesSet, SourceFile_Path(affectedFile)) ||
        !affectedFilesHandler_isChangedSignature(receiver, SourceFile_Path(affectedFile))) {
        return;
    }
    if (Tristate_IsTrue(receiver.program.snapshot.options.IsolatedModules)) {
        affectedFilesHandler_forEachFileReferencedBy(receiver, affectedFile, (_currentFile, currentPath) => {
            if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, currentPath, false)) {
                return [false, true];
            }
            affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, currentPath, false);
            if (affectedFilesHandler_isChangedSignature(receiver, currentPath)) {
                return [true, false];
            }
            return [false, false];
        });
    }
    let invalidateJsFiles = false;
    let typeChecker;
    let done;
    const affectedFileSymbol = Node_Symbol(NodeDefault_AsNode(affectedFile));
    if (affectedFileSymbol !== undefined) {
        const exports = affectedFileSymbol.Exports;
        if (exports !== undefined) {
            outer: for (const [, exported] of exports) {
                if ((exported.Flags & SymbolFlagsConstEnum) !== 0) {
                    invalidateJsFiles = true;
                    break;
                }
                if (typeChecker === undefined) {
                    [typeChecker, done] = compiler_Program_GetTypeCheckerForFileExclusive(receiver.program.program, receiver.ctx, affectedFile);
                }
                const aliased = SkipAlias(exported, typeChecker);
                if (aliased === exported) {
                    continue;
                }
                if ((aliased.Flags & SymbolFlagsConstEnum) !== 0) {
                    for (const d of aliased.Declarations ?? []) {
                        if (GetSourceFileOfNode(d) === affectedFile) {
                            invalidateJsFiles = true;
                            break outer;
                        }
                    }
                }
            }
        }
    }
    if (done !== undefined) {
        done();
    }
    let earlyReturn = false;
    referenceMap_getReferencedBy(receiver.program.snapshot.referencedMap, SourceFile_Path(affectedFile))((fileReferencingChangedFile) => {
        if (earlyReturn) {
            return false;
        }
        if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, fileReferencingChangedFile, invalidateJsFiles)) {
            earlyReturn = true;
            return false;
        }
        referenceMap_getReferencedBy(receiver.program.snapshot.referencedMap, fileReferencingChangedFile)((fileReferencingAffectedFile) => {
            if (affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver, dtsMayChange, fileReferencingAffectedFile, invalidateJsFiles)) {
                earlyReturn = true;
                return false;
            }
            return true;
        });
        if (earlyReturn) {
            return false;
        }
        return true;
    });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfFileAndReferences","kind":"method","status":"implemented","sigHash":"05426c7cae7863d90d89d13c766af77c24fc5da5ce4eec4e3954d6e52588ccf2","bodyHash":"93d16f0c9cbef91987abf3e00abda416c800f4c7328774c4043e57b32cdb6773"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfFileAndReferences(dtsMayChange dtsMayChange, filePath tspath.Path, invalidateJsFiles bool) bool {
 * 	if existing, loaded := h.seenFileAndReferences.LoadOrStore(filePath, invalidateJsFiles); loaded && (existing || !invalidateJsFiles) {
 * 		return false
 * 	} else if loaded && invalidateJsFiles {
 * 		h.seenFileAndReferences.Store(filePath, true)
 * 	}
 *
 * 	if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, filePath, invalidateJsFiles) {
 * 		return true
 * 	}
 * 	h.handleDtsMayChangeOf(dtsMayChange, filePath, invalidateJsFiles)
 *
 * 	for referencingFilePath := range h.program.snapshot.referencedMap.getReferencedBy(filePath) {
 * 		if h.handleDtsMayChangeOfFileAndReferences(dtsMayChange, referencingFilePath, invalidateJsFiles) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver, dtsMayChange, filePath, invalidateJsFiles) {
    const [existing, loaded] = SyncMap_LoadOrStore(receiver.seenFileAndReferences, filePath, invalidateJsFiles);
    if (loaded && (existing || !invalidateJsFiles)) {
        return false;
    }
    else if (loaded && invalidateJsFiles) {
        SyncMap_Store(receiver.seenFileAndReferences, filePath, true);
    }
    if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, filePath, invalidateJsFiles)) {
        return true;
    }
    affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, filePath, invalidateJsFiles);
    let earlyReturn = false;
    referenceMap_getReferencedBy(receiver.program.snapshot.referencedMap, filePath)((referencingFilePath) => {
        if (affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver, dtsMayChange, referencingFilePath, invalidateJsFiles)) {
            earlyReturn = true;
            return false;
        }
        return true;
    });
    if (earlyReturn) {
        return true;
    }
    return false;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfGlobalScope","kind":"method","status":"implemented","sigHash":"32845cbb1b64f3d05801f2f34eac3d658d2207fd06280317517db727cbe5eabd","bodyHash":"dce8722b5f32bfebbd472f38560782dbaacd41bf76338c789abd032c22c13cb2"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfGlobalScope(dtsMayChange dtsMayChange, filePath tspath.Path, invalidateJsFiles bool) bool {
 * 	if info, ok := h.program.snapshot.fileInfos.Load(filePath); !ok || !info.affectsGlobalScope {
 * 		return false
 * 	}
 * 	for _, file := range h.program.snapshot.getAllFilesExcludingDefaultLibraryFile(h.program.program, nil) {
 * 		h.handleDtsMayChangeOf(dtsMayChange, file.Path(), invalidateJsFiles)
 * 	}
 * 	h.removeDiagnosticsOfLibraryFiles()
 * 	return true
 * }
 */
export function affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, filePath, invalidateJsFiles) {
    const [info, ok] = SyncMap_Load(receiver.program.snapshot.fileInfos, filePath);
    if (!ok || !info.affectsGlobalScope) {
        return false;
    }
    for (const file of snapshot_getAllFilesExcludingDefaultLibraryFile(receiver.program.snapshot, receiver.program.program, undefined)) {
        affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, SourceFile_Path(file), invalidateJsFiles);
    }
    affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver);
    return true;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOf","kind":"method","status":"implemented","sigHash":"05651f99a079f94f485234aed5ec7b1f4c8ef05b64bdb62eba5220ffba6e27b6","bodyHash":"8869d6284b49133634e117d17f5483b0b437338a5d7b180283c85be98bad1999"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOf(dtsMayChange dtsMayChange, path tspath.Path, invalidateJsFiles bool) {
 * 	if h.program.snapshot.changedFilesSet.Has(path) {
 * 		return
 * 	}
 * 	file := h.program.program.GetSourceFileByPath(path)
 * 	if file == nil {
 * 		return
 * 	}
 * 	h.removeSemanticDiagnosticsOf(path)
 * 	h.updateShapeSignature(file, true)
 * 	if invalidateJsFiles {
 * 		dtsMayChange.addFileToAffectedFilesPendingEmit(path, GetFileEmitKind(h.program.snapshot.options))
 * 	} else if h.program.snapshot.options.GetEmitDeclarations() {
 * 		dtsMayChange.addFileToAffectedFilesPendingEmit(path, core.IfElse(h.program.snapshot.options.DeclarationMap.IsTrue(), FileEmitKindAllDts, FileEmitKindDts))
 * 	}
 * }
 */
export function affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, path, invalidateJsFiles) {
    if (SyncSet_Has(receiver.program.snapshot.changedFilesSet, path)) {
        return;
    }
    const file = compiler_Program_GetSourceFileByPath(receiver.program.program, path);
    if (file === undefined) {
        return;
    }
    affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, path);
    affectedFilesHandler_updateShapeSignature(receiver, file, true);
    if (invalidateJsFiles) {
        dtsMayChange_addFileToAffectedFilesPendingEmit(dtsMayChange, path, GetFileEmitKind(receiver.program.snapshot.options));
    }
    else if (CompilerOptions_GetEmitDeclarations(receiver.program.snapshot.options)) {
        dtsMayChange_addFileToAffectedFilesPendingEmit(dtsMayChange, path, IfElse(Tristate_IsTrue(receiver.program.snapshot.options.DeclarationMap), FileEmitKindAllDts, FileEmitKindDts));
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.updateSnapshot","kind":"method","status":"implemented","sigHash":"01be83442012fb2e3a0e61a76f0e83d903ce5501c119fb43ff7b4fed99ed0604","bodyHash":"d9c07bbfe0ef2aaa79db2b17f0528d9f5755d63d20c5e9516b104697bb8a59ba"}
 *
 * Go source:
 * func (h *affectedFilesHandler) updateSnapshot() {
 * 	if h.ctx.Err() != nil {
 * 		return
 * 	}
 * 	h.updatedSignatures.Range(func(filePath tspath.Path, update *updatedSignature) bool {
 * 		if info, ok := h.program.snapshot.fileInfos.Load(filePath); ok {
 * 			info.signature = update.signature
 * 			if h.program.testingData != nil {
 * 				h.program.testingData.UpdatedSignatureKinds[filePath] = update.kind
 * 			}
 * 		}
 * 		return true
 * 	})
 * 	h.filesToRemoveDiagnostics.Range(func(file tspath.Path) bool {
 * 		h.program.snapshot.semanticDiagnosticsPerFile.Delete(file)
 * 		return true
 * 	})
 * 	for _, change := range h.dtsMayChange {
 * 		for filePath, emitKind := range change {
 * 			h.program.snapshot.addFileToAffectedFilesPendingEmit(filePath, emitKind)
 * 		}
 * 	}
 * 	h.program.snapshot.changedFilesSet = collections.SyncSet[tspath.Path]{}
 * 	h.program.snapshot.buildInfoEmitPending.Store(true)
 * }
 */
export function affectedFilesHandler_updateSnapshot(receiver) {
    if (receiver.ctx.Err() !== undefined) {
        return;
    }
    SyncMap_Range(receiver.updatedSignatures, (filePath, update) => {
        const [info, ok] = SyncMap_Load(receiver.program.snapshot.fileInfos, filePath);
        if (ok) {
            info.signature = update.signature;
            if (receiver.program.testingData !== undefined) {
                receiver.program.testingData.UpdatedSignatureKinds.set(filePath, update.kind);
            }
        }
        return true;
    });
    SyncSet_Range(receiver.filesToRemoveDiagnostics, (file) => {
        SyncMap_Delete(receiver.program.snapshot.semanticDiagnosticsPerFile, file);
        return true;
    });
    for (const change of receiver.dtsMayChange) {
        for (const [filePath, emitKind] of change) {
            snapshot_addFileToAffectedFilesPendingEmit(receiver.program.snapshot, filePath, emitKind);
        }
    }
    receiver.program.snapshot.changedFilesSet = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } };
    receiver.program.snapshot.buildInfoEmitPending.Store(true);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::func::collectAllAffectedFiles","kind":"func","status":"implemented","sigHash":"dd3355e58c8cb4813bf452aba0d3fb52a3b39e3d6b8b2b7a2850093517b6833f","bodyHash":"f2f0a32ab60b4df94a683b381bc79effe737933ebbfdb99af23cd5af19fa9755"}
 *
 * Go source:
 * func collectAllAffectedFiles(ctx context.Context, program *Program) {
 * 	if program.snapshot.changedFilesSet.Size() == 0 {
 * 		return
 * 	}
 *
 * 	handler := affectedFilesHandler{ctx: ctx, program: program}
 * 	wg := core.NewWorkGroup(handler.program.program.SingleThreaded())
 * 	var result collections.SyncSet[*ast.SourceFile]
 * 	program.snapshot.changedFilesSet.Range(func(file tspath.Path) bool {
 * 		wg.Queue(func() {
 * 			for _, affectedFile := range handler.getFilesAffectedBy(file) {
 * 				result.Add(affectedFile)
 * 			}
 * 		})
 * 		return true
 * 	})
 * 	wg.RunAndWait()
 *
 * 	if ctx.Err() != nil {
 * 		return
 * 	}
 *
 * 	wg = core.NewWorkGroup(program.program.SingleThreaded())
 * 	emitKind := GetFileEmitKind(program.snapshot.options)
 * 	result.Range(func(file *ast.SourceFile) bool {
 * 		dtsMayChange := handler.getDtsMayChange(file.Path(), emitKind)
 * 		wg.Queue(func() {
 * 			handler.handleDtsMayChangeOfAffectedFile(dtsMayChange, file)
 * 		})
 * 		return true
 * 	})
 * 	wg.RunAndWait()
 *
 * 	handler.updateSnapshot()
 * }
 */
export function collectAllAffectedFiles(ctx, program) {
    if (SyncSet_Size(program.snapshot.changedFilesSet) === 0) {
        return;
    }
    const handler = {
        ctx: ctx,
        program: program,
        hasAllFilesExcludingDefaultLibraryFile: new Bool(),
        updatedSignatures: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        dtsMayChange: [],
        filesToRemoveDiagnostics: { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } },
        cleanedDiagnosticsOfLibFiles: new Once(),
        seenFileAndReferences: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
    };
    let wg = NewWorkGroup(compiler_Program_SingleThreaded(program.program));
    const result = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } };
    SyncSet_Range(program.snapshot.changedFilesSet, (file) => {
        wg.Queue(() => {
            for (const affectedFile of affectedFilesHandler_getFilesAffectedBy(handler, file)) {
                SyncSet_Add(result, affectedFile);
            }
        });
        return true;
    });
    wg.RunAndWait();
    if (ctx.Err() !== undefined) {
        return;
    }
    wg = NewWorkGroup(compiler_Program_SingleThreaded(program.program));
    const emitKind = GetFileEmitKind(program.snapshot.options);
    SyncSet_Range(result, (file) => {
        const dtsChange = affectedFilesHandler_getDtsMayChange(handler, SourceFile_Path(file), emitKind);
        wg.Queue(() => {
            affectedFilesHandler_handleDtsMayChangeOfAffectedFile(handler, dtsChange, file);
        });
        return true;
    });
    wg.RunAndWait();
    affectedFilesHandler_updateSnapshot(handler);
}
//# sourceMappingURL=affectedfileshandler.js.map
import type { bool } from "../../../go/scalars.js";
import type { GoError, GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import { Map as SyncMapImpl, Mutex, Once } from "../../../go/sync.js";
import type { Bool as AtomicBool } from "../../../go/sync/atomic.js";
import { Bool } from "../../../go/sync/atomic.js";
import { Node_Symbol, SourceFile_Path } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import { NodeDefault_AsNode } from "../../ast/spine.js";
import { SymbolFlagsConstEnum } from "../../ast/symbolflags.js";
import { GetSourceFileOfNode } from "../../ast/utilities.js";
import { SkipAlias } from "../../checker/utilities.js";
import type { Checker } from "../../checker/checker/state.js";
import type { SyncMap } from "../../collections/syncmap.js";
import { SyncMap_Delete, SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Range, SyncMap_Store } from "../../collections/syncmap.js";
import type { SyncSet } from "../../collections/syncset.js";
import { SyncSet_Add, SyncSet_Has, SyncSet_Range, SyncSet_Size } from "../../collections/syncset.js";
import { Filter, IfElse } from "../../core/core.js";
import { CompilerOptions_GetEmitDeclarations } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import {
  Program_Emit as compiler_Program_Emit,
  Program_GetSourceFileByPath as compiler_Program_GetSourceFileByPath,
  Program_GetTypeCheckerForFileExclusive as compiler_Program_GetTypeCheckerForFileExclusive,
  Program_IsSourceFileDefaultLibrary as compiler_Program_IsSourceFileDefaultLibrary,
  Program_SingleThreaded as compiler_Program_SingleThreaded,
  Program_SkipTypeChecking as compiler_Program_SkipTypeChecking,
} from "../../compiler/program.js";
import type { EmitOptions, WriteFileData } from "../../compiler/program.js";
import { EmitOnlyForcedDts } from "../../compiler/emitter.js";
import { IsDeclarationFileName } from "../../tspath/extension.js";
import type { Path } from "../../tspath/path.js";
import { NewWorkGroup } from "../../core/workgroup.js";
import type { Program, SignatureUpdateKind } from "./program.js";
import { SignatureUpdateKindUsedVersion } from "./program.js";
import type { DiagnosticsOrBuildInfoDiagnosticsWithFileName, FileEmitKind, FileInfo } from "./snapshot.js";
import {
  FileEmitKindAllDts,
  FileEmitKindDts,
  GetFileEmitKind,
  snapshot_addFileToAffectedFilesPendingEmit,
  snapshot_computeSignatureWithDiagnostics,
  snapshot_getAllFilesExcludingDefaultLibraryFile,
} from "./snapshot.js";
import { referenceMap_getReferencedBy } from "./referencemap.js";
import { Program_GetSourceFiles as incremental_Program_GetSourceFiles } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::dtsMayChange","kind":"type","status":"implemented","sigHash":"161a83db43532f7d6c3498aef7567079f27b3d88380b01283197b3f6270c1465","bodyHash":"f687f6a1dbb7e16ef44dcc273af4b914bcfd2ce0fb20ddb880d9ec40e20ca30f"}
 *
 * Go source:
 * dtsMayChange map[tspath.Path]FileEmitKind
 */
export type dtsMayChange = GoMap<Path, FileEmitKind>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::dtsMayChange.addFileToAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"3393389a6d76c22f5ef2391904b34a5d766ea6c80f05a565c681787e5fa5b97f","bodyHash":"6dfa4b78a33764a0029c279b715dc4f4b608baaf1978109a1f8d479b68780e57"}
 *
 * Go source:
 * func (c dtsMayChange) addFileToAffectedFilesPendingEmit(filePath tspath.Path, emitKind FileEmitKind) {
 * 	c[filePath] = emitKind
 * }
 */
export function dtsMayChange_addFileToAffectedFilesPendingEmit(receiver: dtsMayChange, filePath: Path, emitKind: FileEmitKind): void {
  receiver.set(filePath, emitKind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::updatedSignature","kind":"type","status":"implemented","sigHash":"5d9dd1705a97a588213f44611880b83735dbe0fea78525cf843869b5195b25c5","bodyHash":"d87702b650739f69847e8c24ebbdc85732143490b212a73924a6c58d5b75d424"}
 *
 * Go source:
 * updatedSignature struct {
 * 	mu        sync.Mutex
 * 	signature string
 * 	kind      SignatureUpdateKind
 * }
 */
export interface updatedSignature {
  mu: Mutex;
  signature: string;
  kind: SignatureUpdateKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::affectedFilesHandler","kind":"type","status":"implemented","sigHash":"4be39f50583d43bff718a0a5d34c122692a7799c97890e3fcdaad96aab5a63d0","bodyHash":"e64aeb2963fa8f97b2c4d77547821721ca1cae8771e41515d2ecaea950d1e24c"}
 *
 * Go source:
 * affectedFilesHandler struct {
 * 	ctx                                    context.Context
 * 	program                                *Program
 * 	hasAllFilesExcludingDefaultLibraryFile atomic.Bool
 * 	updatedSignatures                      collections.SyncMap[tspath.Path, *updatedSignature]
 * 	dtsMayChange                           []dtsMayChange
 * 	filesToRemoveDiagnostics               collections.SyncSet[tspath.Path]
 * 	cleanedDiagnosticsOfLibFiles           sync.Once
 * 	seenFileAndReferences                  collections.SyncMap[tspath.Path, bool]
 * }
 */
export interface affectedFilesHandler {
  ctx: Context;
  program: GoPtr<Program>;
  hasAllFilesExcludingDefaultLibraryFile: AtomicBool;
  updatedSignatures: SyncMap<Path, GoPtr<updatedSignature>>;
  dtsMayChange: GoSlice<dtsMayChange>;
  filesToRemoveDiagnostics: SyncSet<Path>;
  cleanedDiagnosticsOfLibFiles: Once;
  seenFileAndReferences: SyncMap<Path, bool>;
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
export function affectedFilesHandler_getDtsMayChange(receiver: GoPtr<affectedFilesHandler>, affectedFilePath: Path, affectedFileEmitKind: FileEmitKind): dtsMayChange {
  const result: dtsMayChange = new Map<Path, FileEmitKind>();
  result.set(affectedFilePath, affectedFileEmitKind);
  receiver!.dtsMayChange.push(result);
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
export function affectedFilesHandler_isChangedSignature(receiver: GoPtr<affectedFilesHandler>, path: Path): bool {
  const [newSignature] = SyncMap_Load<Path, GoPtr<updatedSignature>>(
    receiver!.updatedSignatures as SyncMap<Path, GoPtr<updatedSignature>>,
    path
  );
  const [oldInfo] = SyncMap_Load<Path, GoPtr<FileInfo>>(
    receiver!.program!.snapshot!.fileInfos as SyncMap<Path, GoPtr<FileInfo>>,
    path
  );
  return (newSignature!.signature !== oldInfo!.signature) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.removeSemanticDiagnosticsOf","kind":"method","status":"implemented","sigHash":"0a1e9519798812a989e36b9b6328ddfc0aafde758494f9c9cc670b544d51fd33","bodyHash":"318381405326e0156613fc94b0af0cca3eb8a5dd9760f554a97f952d698a1c8a"}
 *
 * Go source:
 * func (h *affectedFilesHandler) removeSemanticDiagnosticsOf(path tspath.Path) {
 * 	h.filesToRemoveDiagnostics.Add(path)
 * }
 */
export function affectedFilesHandler_removeSemanticDiagnosticsOf(receiver: GoPtr<affectedFilesHandler>, path: Path): void {
  SyncSet_Add<Path>(receiver!.filesToRemoveDiagnostics as SyncSet<Path>, path);
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
export function affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver: GoPtr<affectedFilesHandler>): void {
  receiver!.cleanedDiagnosticsOfLibFiles.Do((): void => {
    for (const file of incremental_Program_GetSourceFiles(receiver!.program)) {
      if (
        compiler_Program_IsSourceFileDefaultLibrary(receiver!.program!.program, SourceFile_Path(file)) &&
        !compiler_Program_SkipTypeChecking(receiver!.program!.program, file, true as bool)
      ) {
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
export function affectedFilesHandler_computeDtsSignature(receiver: GoPtr<affectedFilesHandler>, file: GoPtr<SourceFile>): string {
  let signature = "";
  compiler_Program_Emit(receiver!.program!.program, receiver!.ctx, {
    TargetSourceFile: file,
    EmitOnly: EmitOnlyForcedDts,
    WriteFile: (fileName: string, text: string, data: GoPtr<WriteFileData>): GoError => {
      if (!IsDeclarationFileName(fileName)) {
        throw new globalThis.Error("File extension for signature expected to be dts, got : " + fileName);
      }
      signature = snapshot_computeSignatureWithDiagnostics(receiver!.program!.snapshot, file, text, data);
      return undefined;
    },
  } as EmitOptions);
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
export function affectedFilesHandler_updateShapeSignature(receiver: GoPtr<affectedFilesHandler>, file: GoPtr<SourceFile>, useFileVersionAsSignature: bool): bool {
  const update: updatedSignature = { mu: new Mutex(), signature: "", kind: SignatureUpdateKindUsedVersion };
  update.mu.Lock();

  const [existing, ok] = SyncMap_LoadOrStore<Path, GoPtr<updatedSignature>>(
    receiver!.updatedSignatures as SyncMap<Path, GoPtr<updatedSignature>>,
    SourceFile_Path(file),
    update
  );
  if (ok) {
    existing!.mu.Lock();
    existing!.mu.Unlock();
    update.mu.Unlock();
    return false as bool;
  }

  const [info] = SyncMap_Load<Path, GoPtr<FileInfo>>(
    receiver!.program!.snapshot!.fileInfos as SyncMap<Path, GoPtr<FileInfo>>,
    SourceFile_Path(file)
  );
  const prevSignature = info!.signature;
  if (!file!.IsDeclarationFile && !useFileVersionAsSignature) {
    update.signature = affectedFilesHandler_computeDtsSignature(receiver, file);
  }
  if (update.signature === "") {
    update.signature = info!.version;
    update.kind = SignatureUpdateKindUsedVersion;
  }
  update.mu.Unlock();
  return (update.signature !== prevSignature) as bool;
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
export function affectedFilesHandler_getFilesAffectedBy(receiver: GoPtr<affectedFilesHandler>, path: Path): GoSlice<GoPtr<SourceFile>> {
  const file = compiler_Program_GetSourceFileByPath(receiver!.program!.program, path);
  if (file === undefined) {
    return [];
  }

  if (!affectedFilesHandler_updateShapeSignature(receiver, file, false as bool)) {
    return [file];
  }

  const [info] = SyncMap_Load<Path, GoPtr<FileInfo>>(
    receiver!.program!.snapshot!.fileInfos as SyncMap<Path, GoPtr<FileInfo>>,
    SourceFile_Path(file)
  );
  if (info!.affectsGlobalScope) {
    receiver!.hasAllFilesExcludingDefaultLibraryFile.Store(true as bool);
    snapshot_getAllFilesExcludingDefaultLibraryFile(receiver!.program!.snapshot, receiver!.program!.program, file);
  }

  if (Tristate_IsTrue(receiver!.program!.snapshot!.options!.IsolatedModules)) {
    return [file];
  }

  const seenFileNamesMap = affectedFilesHandler_forEachFileReferencedBy(
    receiver,
    file,
    (currentFile: GoPtr<SourceFile>, _currentPath: Path): [bool, bool] => {
      if (currentFile !== undefined && affectedFilesHandler_updateShapeSignature(receiver, currentFile, false as bool)) {
        return [true as bool, false as bool];
      }
      return [false as bool, false as bool];
    }
  );
  const values: GoPtr<SourceFile>[] = [];
  for (const v of seenFileNamesMap.values()) {
    values.push(v);
  }
  return Filter(values, (f: GoPtr<SourceFile>): bool => (f !== undefined) as bool);
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
export function affectedFilesHandler_forEachFileReferencedBy(
  receiver: GoPtr<affectedFilesHandler>,
  file: GoPtr<SourceFile>,
  fn: (currentFile: GoPtr<SourceFile>, currentPath: Path) => [bool, bool]
): GoMap<Path, GoPtr<SourceFile>> {
  const seenFileNamesMap: GoMap<Path, GoPtr<SourceFile>> = new Map<Path, GoPtr<SourceFile>>();
  seenFileNamesMap.set(SourceFile_Path(file), file);

  const queue: Path[] = [];
  referenceMap_getReferencedBy(receiver!.program!.snapshot!.referencedMap, SourceFile_Path(file))((p: Path): bool => {
    queue.push(p);
    return true as bool;
  });

  while (queue.length > 0) {
    const currentPath = queue[queue.length - 1];
    queue.splice(queue.length - 1, 1);
    if (!seenFileNamesMap.has(currentPath!)) {
      const currentFile = compiler_Program_GetSourceFileByPath(receiver!.program!.program, currentPath!);
      seenFileNamesMap.set(currentPath!, currentFile);
      const [queueForFile, fastReturn] = fn(currentFile, currentPath!);
      if (fastReturn) {
        return seenFileNamesMap;
      }
      if (queueForFile) {
        referenceMap_getReferencedBy(receiver!.program!.snapshot!.referencedMap, SourceFile_Path(currentFile))((ref: Path): bool => {
          queue.push(ref);
          return true as bool;
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
export function affectedFilesHandler_handleDtsMayChangeOfAffectedFile(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, affectedFile: GoPtr<SourceFile>): void {
  affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, SourceFile_Path(affectedFile));

  if (receiver!.hasAllFilesExcludingDefaultLibraryFile.Load()) {
    affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver);
    affectedFilesHandler_updateShapeSignature(receiver, affectedFile, false as bool);
    return;
  }

  if (Tristate_IsTrue(receiver!.program!.snapshot!.options!.AssumeChangesOnlyAffectDirectDependencies)) {
    return;
  }

  if (
    !SyncSet_Has<Path>(receiver!.program!.snapshot!.changedFilesSet as SyncSet<Path>, SourceFile_Path(affectedFile)) ||
    !affectedFilesHandler_isChangedSignature(receiver, SourceFile_Path(affectedFile))
  ) {
    return;
  }

  if (Tristate_IsTrue(receiver!.program!.snapshot!.options!.IsolatedModules)) {
    affectedFilesHandler_forEachFileReferencedBy(
      receiver,
      affectedFile,
      (_currentFile: GoPtr<SourceFile>, currentPath: Path): [bool, bool] => {
        if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, currentPath, false as bool)) {
          return [false as bool, true as bool];
        }
        affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, currentPath, false as bool);
        if (affectedFilesHandler_isChangedSignature(receiver, currentPath)) {
          return [true as bool, false as bool];
        }
        return [false as bool, false as bool];
      }
    );
  }

  let invalidateJsFiles = false;
  let typeChecker: GoPtr<Checker>;
  let done: (() => void) | undefined;

  const affectedFileSymbol = Node_Symbol(NodeDefault_AsNode(affectedFile));
  if (affectedFileSymbol !== undefined) {
    const exports = affectedFileSymbol!.Exports;
    if (exports !== undefined) {
      outer: for (const [, exported] of exports) {
        if ((exported!.Flags & SymbolFlagsConstEnum) !== 0) {
          invalidateJsFiles = true;
          break;
        }
        if (typeChecker === undefined) {
          [typeChecker, done] = compiler_Program_GetTypeCheckerForFileExclusive(receiver!.program!.program, receiver!.ctx, affectedFile);
        }
        const aliased = SkipAlias(exported, typeChecker);
        if (aliased === exported) {
          continue;
        }
        if ((aliased!.Flags & SymbolFlagsConstEnum) !== 0) {
          for (const d of aliased!.Declarations ?? []) {
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
  referenceMap_getReferencedBy(receiver!.program!.snapshot!.referencedMap, SourceFile_Path(affectedFile))((fileReferencingChangedFile: Path): bool => {
    if (earlyReturn) {
      return false as bool;
    }
    if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, fileReferencingChangedFile, invalidateJsFiles as bool)) {
      earlyReturn = true;
      return false as bool;
    }
    referenceMap_getReferencedBy(receiver!.program!.snapshot!.referencedMap, fileReferencingChangedFile)((fileReferencingAffectedFile: Path): bool => {
      if (affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver, dtsMayChange, fileReferencingAffectedFile, invalidateJsFiles as bool)) {
        earlyReturn = true;
        return false as bool;
      }
      return true as bool;
    });
    if (earlyReturn) {
      return false as bool;
    }
    return true as bool;
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
export function affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, filePath: Path, invalidateJsFiles: bool): bool {
  const [existing, loaded] = SyncMap_LoadOrStore<Path, bool>(
    receiver!.seenFileAndReferences as SyncMap<Path, bool>,
    filePath,
    invalidateJsFiles
  );
  if (loaded && (existing || !invalidateJsFiles)) {
    return false as bool;
  } else if (loaded && invalidateJsFiles) {
    SyncMap_Store<Path, bool>(
      receiver!.seenFileAndReferences as SyncMap<Path, bool>,
      filePath,
      true as bool
    );
  }

  if (affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver, dtsMayChange, filePath, invalidateJsFiles)) {
    return true as bool;
  }
  affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, filePath, invalidateJsFiles);

  let earlyReturn = false;
  referenceMap_getReferencedBy(receiver!.program!.snapshot!.referencedMap, filePath)((referencingFilePath: Path): bool => {
    if (affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver, dtsMayChange, referencingFilePath, invalidateJsFiles)) {
      earlyReturn = true;
      return false as bool;
    }
    return true as bool;
  });
  if (earlyReturn) {
    return true as bool;
  }
  return false as bool;
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
export function affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, filePath: Path, invalidateJsFiles: bool): bool {
  const [info, ok] = SyncMap_Load<Path, GoPtr<FileInfo>>(
    receiver!.program!.snapshot!.fileInfos as SyncMap<Path, GoPtr<FileInfo>>,
    filePath
  );
  if (!ok || !info!.affectsGlobalScope) {
    return false as bool;
  }
  for (const file of snapshot_getAllFilesExcludingDefaultLibraryFile(receiver!.program!.snapshot, receiver!.program!.program, undefined)) {
    affectedFilesHandler_handleDtsMayChangeOf(receiver, dtsMayChange, SourceFile_Path(file), invalidateJsFiles);
  }
  affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver);
  return true as bool;
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
export function affectedFilesHandler_handleDtsMayChangeOf(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, path: Path, invalidateJsFiles: bool): void {
  if (SyncSet_Has<Path>(receiver!.program!.snapshot!.changedFilesSet as SyncSet<Path>, path)) {
    return;
  }
  const file = compiler_Program_GetSourceFileByPath(receiver!.program!.program, path);
  if (file === undefined) {
    return;
  }
  affectedFilesHandler_removeSemanticDiagnosticsOf(receiver, path);
  affectedFilesHandler_updateShapeSignature(receiver, file, true as bool);
  if (invalidateJsFiles) {
    dtsMayChange_addFileToAffectedFilesPendingEmit(dtsMayChange, path, GetFileEmitKind(receiver!.program!.snapshot!.options));
  } else if (CompilerOptions_GetEmitDeclarations(receiver!.program!.snapshot!.options)) {
    dtsMayChange_addFileToAffectedFilesPendingEmit(
      dtsMayChange,
      path,
      IfElse(Tristate_IsTrue(receiver!.program!.snapshot!.options!.DeclarationMap), FileEmitKindAllDts, FileEmitKindDts)
    );
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
export function affectedFilesHandler_updateSnapshot(receiver: GoPtr<affectedFilesHandler>): void {
  if (receiver!.ctx.Err() !== undefined) {
    return;
  }
  SyncMap_Range<Path, GoPtr<updatedSignature>>(
    receiver!.updatedSignatures as SyncMap<Path, GoPtr<updatedSignature>>,
    (filePath: Path, update: GoPtr<updatedSignature>): bool => {
      const [info, ok] = SyncMap_Load<Path, GoPtr<FileInfo>>(
        receiver!.program!.snapshot!.fileInfos as SyncMap<Path, GoPtr<FileInfo>>,
        filePath
      );
      if (ok) {
        info!.signature = update!.signature;
        if (receiver!.program!.testingData !== undefined) {
          receiver!.program!.testingData.UpdatedSignatureKinds.set(filePath, update!.kind);
        }
      }
      return true as bool;
    }
  );
  SyncSet_Range<Path>(
    receiver!.filesToRemoveDiagnostics as SyncSet<Path>,
    (file: Path): bool => {
      SyncMap_Delete<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>(
        receiver!.program!.snapshot!.semanticDiagnosticsPerFile as SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>,
        file
      );
      return true as bool;
    }
  );
  for (const change of receiver!.dtsMayChange) {
    for (const [filePath, emitKind] of change) {
      snapshot_addFileToAffectedFilesPendingEmit(receiver!.program!.snapshot, filePath, emitKind);
    }
  }
  receiver!.program!.snapshot!.changedFilesSet = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } } as unknown as SyncSet<Path>;
  receiver!.program!.snapshot!.buildInfoEmitPending.Store(true as bool);
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
export function collectAllAffectedFiles(ctx: Context, program: GoPtr<Program>): void {
  if (SyncSet_Size<Path>(program!.snapshot!.changedFilesSet as SyncSet<Path>) === 0) {
    return;
  }

  const handler: affectedFilesHandler = {
    ctx: ctx,
    program: program,
    hasAllFilesExcludingDefaultLibraryFile: new Bool(),
    updatedSignatures: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } as SyncMap<Path, GoPtr<updatedSignature>>,
    dtsMayChange: [],
    filesToRemoveDiagnostics: { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } } as SyncSet<Path>,
    cleanedDiagnosticsOfLibFiles: new Once(),
    seenFileAndReferences: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } as SyncMap<Path, bool>,
  };

  let wg = NewWorkGroup(compiler_Program_SingleThreaded(program!.program));
  const result: SyncSet<GoPtr<SourceFile>> = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() } } as SyncSet<GoPtr<SourceFile>>;

  SyncSet_Range<Path>(
    program!.snapshot!.changedFilesSet as SyncSet<Path>,
    (file: Path): bool => {
      wg.Queue((): void => {
        for (const affectedFile of affectedFilesHandler_getFilesAffectedBy(handler, file)) {
          SyncSet_Add<GoPtr<SourceFile>>(result, affectedFile);
        }
      });
      return true as bool;
    }
  );
  wg.RunAndWait();

  if (ctx.Err() !== undefined) {
    return;
  }

  wg = NewWorkGroup(compiler_Program_SingleThreaded(program!.program));
  const emitKind = GetFileEmitKind(program!.snapshot!.options);
  SyncSet_Range<GoPtr<SourceFile>>(
    result,
    (file: GoPtr<SourceFile>): bool => {
      const dtsChange = affectedFilesHandler_getDtsMayChange(handler, SourceFile_Path(file), emitKind);
      wg.Queue((): void => {
        affectedFilesHandler_handleDtsMayChangeOfAffectedFile(handler, dtsChange, file);
      });
      return true as bool;
    }
  );
  wg.RunAndWait();

  affectedFilesHandler_updateSnapshot(handler);
}

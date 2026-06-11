import type { bool } from "@tsonic/core/types.js";
import type { GoComparable, GoMap, GoPtr, GoSlice, GoUnresolved } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import { TODO } from "../../../go/context.js";
import { Map as GoSyncMap, Once } from "../../../go/sync.js";
import { Bool } from "../../../go/sync/atomic.js";
import * as core from "../../core/core.js";
import { NewWorkGroup } from "../../core/workgroup.js";
import type { Node, SourceFile } from "../../ast/ast.js";
import type { ModuleName } from "../../ast/generated/unions.js";
import { SourceFile_FileName, SourceFile_Imports, SourceFile_Path, SourceFile_Text } from "../../ast/ast.js";
import type { Diagnostic, RepopulateDiagnosticInfo } from "../../ast/diagnostic.js";
import {
  Diagnostic_Category,
  Diagnostic_Clone,
  Diagnostic_Code,
  Diagnostic_End,
  Diagnostic_MessageArgs,
  Diagnostic_MessageChain,
  Diagnostic_MessageKey,
  Diagnostic_Pos,
  Diagnostic_RepopulateInfo,
  Diagnostic_SetMessageChain,
} from "../../ast/diagnostic.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Checker } from "../../checker/checker/state.js";
import { Checker_GetAmbientModules } from "../../checker/checker/modules.js";
import { Checker_GetSymbolAtLocation } from "../../checker/checker/symbols.js";
import type { Set } from "../../collections/set.js";
import { NewSetWithSizeHint, Set_Add, Set_Equals, Set_Keys, Set_Len } from "../../collections/set.js";
import { SyncMap_Load, SyncMap_Range, SyncMap_Size, SyncMap_Store } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import { SyncSet_Add, SyncSet_Has, SyncSet_Range } from "../../collections/syncset.js";
import type { SyncSet } from "../../collections/syncset.js";
import type { Program } from "../../compiler/program.js";
import {
  Program_GetCurrentDirectory,
  Program_GetParseFileRedirect,
  Program_GetResolvedTypeReferenceDirectives,
  Program_GetSourceFileByPath,
  Program_GetSourceFileMetaData,
  Program_GetSourceFiles,
  Program_GetTypeCheckerForFileExclusive,
  Program_IsSourceFileDefaultLibrary,
  Program_Options,
  Program_SingleThreaded,
  Program_UseCaseSensitiveFileNames,
} from "../../compiler/program.js";
import { CompilerOptions_IsIncremental } from "../../core/compileroptions.js";
import { TSUnknown, Tristate_IsTrue } from "../../core/tristate.js";
import type { ModeAwareCache } from "../../module/cache.js";
import type { ResolvedTypeReferenceDirective } from "../../module/types.js";
import {
  CompilerOptionsAffectDeclarationPath,
  CompilerOptionsAffectEmit,
  CompilerOptionsAffectSemanticDiagnostics,
} from "../../tsoptions/declscompiler.js";
import { GetDirectoryPath, ToPath } from "../../tspath/path.js";
import type { Path } from "../../tspath/path.js";
import { BindSourceFile } from "../../binder/binder.js";
import {
  GetSourceFileOfNode,
  IsExternalOrCommonJSModule,
  IsGlobalScopeAugmentation,
  IsJsonSourceFile,
  IsModuleWithStringLiteralName,
} from "../../ast/utilities.js";
import { IsStringLiteral } from "../../ast/generated/predicates.js";
import type { Program as Program_bea0eb45 } from "./program.js";
import type { buildInfoDiagnosticWithFileName, DiagnosticsOrBuildInfoDiagnosticsWithFileName, emitSignature, FileEmitKind, FileInfo, snapshot } from "./snapshot.js";
import {
  emitSignature_getNewEmitSignature,
  GetFileEmitKind,
  getPendingEmitKindWithOptions,
  repopulateDiagnosticChain,
  snapshot_addFileToAffectedFilesPendingEmit,
  snapshot_addFileToChangeSet,
  snapshot_canUseIncrementalState,
  snapshot_computeHash,
  snapshot_getAllFilesExcludingDefaultLibraryFile,
} from "./snapshot.js";
import { referenceMap_getReferences, referenceMap_storeReferences } from "./referencemap.js";

function newSyncMap<K extends GoComparable, V>(): SyncMap<K, V> {
  return { __tsgoBlank0: [], __tsgoBlank1: [], m: new GoSyncMap<K, V>() };
}

function newSyncSet<T extends GoComparable>(): SyncSet<T> {
  return { m: newSyncMap<T, { readonly __tsgoEmpty?: never }>() };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::programToSnapshot","kind":"func","status":"implemented","sigHash":"42d48a3553545dd6715fb0d453bb71be6beaed13999ae4fd186e8f33c1bcc1ed","bodyHash":"137f66a6c9d1dfc40826f77cbd0518efe9fb2d51acaeb9ffd286f6a6c5ddb4df"}
 *
 * Go source:
 * func programToSnapshot(program *compiler.Program, oldProgram *Program, hashWithText bool) *snapshot {
 * 	if oldProgram != nil && oldProgram.program == program {
 * 		return oldProgram.snapshot
 * 	}
 * 	snapshot := &snapshot{
 * 		options:      program.Options(),
 * 		hashWithText: hashWithText,
 * 		checkPending: program.Options().NoCheck.IsTrue(),
 * 	}
 * 	to := &toProgramSnapshot{
 * 		program:    program,
 * 		oldProgram: oldProgram,
 * 		snapshot:   snapshot,
 * 	}
 *
 * 	if to.snapshot.canUseIncrementalState() {
 * 		to.reuseFromOldProgram()
 * 		to.computeProgramFileChanges()
 * 		to.handleFileDelete()
 * 		to.handlePendingEmit()
 * 		to.handlePendingCheck()
 * 	}
 * 	return snapshot
 * }
 */
export function programToSnapshot(program: GoPtr<Program>, oldProgram: GoPtr<Program_bea0eb45>, hashWithText: bool): GoPtr<snapshot> {
  if (oldProgram !== undefined && oldProgram.program === program) {
    return oldProgram.snapshot;
  }
  const snap: snapshot = {
    fileInfos: newSyncMap<Path, GoPtr<FileInfo>>(),
    options: Program_Options(program),
    referencedMap: {
      references: newSyncMap<Path, GoPtr<Set<Path>>>(),
      referencedBy: new globalThis.Map<Path, GoPtr<Set<Path>>>(),
      referenceBy: new Once(),
    },
    semanticDiagnosticsPerFile: newSyncMap<Path, GoSlice<GoPtr<Diagnostic>>>(),
    emitDiagnosticsPerFile: newSyncMap<Path, GoSlice<GoPtr<Diagnostic>>>(),
    changedFilesSet: newSyncSet<Path>(),
    affectedFilesPendingEmit: newSyncMap<Path, FileEmitKind>(),
    latestChangedDtsFile: "",
    emitSignatures: newSyncMap<Path, GoPtr<emitSignature>>(),
    hasErrors: TSUnknown,
    hashWithText: hashWithText,
    checkPending: Tristate_IsTrue(Program_Options(program)!.NoCheck),
    buildInfoEmitPending: new Bool(),
    hasErrorsFromOldState: TSUnknown,
    hasSemanticErrors: false,
    hasSemanticErrorsFromOldState: false,
    allFilesExcludingDefaultLibraryFileOnce: new Once(),
    allFilesExcludingDefaultLibraryFile: [],
    hasChangedDtsFile: false,
    hasEmitDiagnostics: false,
  } as snapshot;
  const to: toProgramSnapshot = {
    program: program,
    oldProgram: oldProgram,
    snapshot: snap,
    globalFileRemoved: false,
  };
  if (snapshot_canUseIncrementalState(to.snapshot)) {
    toProgramSnapshot_reuseFromOldProgram(to);
    toProgramSnapshot_computeProgramFileChanges(to);
    toProgramSnapshot_handleFileDelete(to);
    toProgramSnapshot_handlePendingEmit(to);
    toProgramSnapshot_handlePendingCheck(to);
  }
  return snap;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::type::toProgramSnapshot","kind":"type","status":"implemented","sigHash":"288bbbb1f63c00f0e50b69f03c7b7bea20799dcbbf5e6a35e1eb17506f6f6b28","bodyHash":"a94cc436f14a4d0e19bca67e3b02ed8bb4bed161c17968556e163262abc9f2a6"}
 *
 * Go source:
 * toProgramSnapshot struct {
 * 	program           *compiler.Program
 * 	oldProgram        *Program
 * 	snapshot          *snapshot
 * 	globalFileRemoved bool
 * }
 */
export interface toProgramSnapshot {
  program: GoPtr<Program>;
  oldProgram: GoPtr<Program_bea0eb45>;
  snapshot: GoPtr<snapshot>;
  globalFileRemoved: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.reuseFromOldProgram","kind":"method","status":"implemented","sigHash":"113030e4c458c05d170f5d971d5ac312aa8639bbb20f48038ac63881715390f0","bodyHash":"a4fd279d6c0a6eae384a1976ebaf532525b86eb3cf25dc27d082bbbedf5fdd2d"}
 *
 * Go source:
 * func (t *toProgramSnapshot) reuseFromOldProgram() {
 * 	if t.oldProgram != nil {
 * 		if t.snapshot.options.Composite.IsTrue() {
 * 			t.snapshot.latestChangedDtsFile = t.oldProgram.snapshot.latestChangedDtsFile
 * 		}
 * 		// Copy old snapshot's changed files set
 * 		t.oldProgram.snapshot.changedFilesSet.Range(func(key tspath.Path) bool {
 * 			t.snapshot.changedFilesSet.Add(key)
 * 			return true
 * 		})
 * 		t.oldProgram.snapshot.affectedFilesPendingEmit.Range(func(key tspath.Path, emitKind FileEmitKind) bool {
 * 			t.snapshot.affectedFilesPendingEmit.Store(key, emitKind)
 * 			return true
 * 		})
 * 		t.snapshot.buildInfoEmitPending.Store(t.oldProgram.snapshot.buildInfoEmitPending.Load())
 * 		t.snapshot.hasErrorsFromOldState = t.oldProgram.snapshot.hasErrors
 * 		t.snapshot.hasSemanticErrorsFromOldState = t.oldProgram.snapshot.hasSemanticErrors
 * 	} else {
 * 		t.snapshot.buildInfoEmitPending.Store(t.snapshot.options.IsIncremental())
 * 	}
 * }
 */
export function toProgramSnapshot_reuseFromOldProgram(receiver: GoPtr<toProgramSnapshot>): void {
  if (receiver!.oldProgram !== undefined) {
    if (Tristate_IsTrue(receiver!.snapshot!.options!.Composite)) {
      receiver!.snapshot!.latestChangedDtsFile = receiver!.oldProgram.snapshot!.latestChangedDtsFile;
    }
    // Copy old snapshot's changed files set
    SyncSet_Range(receiver!.oldProgram.snapshot!.changedFilesSet as SyncSet<Path>, (key: Path) => {
      SyncSet_Add(receiver!.snapshot!.changedFilesSet as SyncSet<Path>, key);
      return true;
    });
    SyncMap_Range(receiver!.oldProgram.snapshot!.affectedFilesPendingEmit as SyncMap<Path, FileEmitKind>, (key: Path, emitKind: FileEmitKind) => {
      SyncMap_Store(receiver!.snapshot!.affectedFilesPendingEmit as SyncMap<Path, FileEmitKind>, key, emitKind);
      return true;
    });
    receiver!.snapshot!.buildInfoEmitPending.Store(receiver!.oldProgram.snapshot!.buildInfoEmitPending.Load());
    receiver!.snapshot!.hasErrorsFromOldState = receiver!.oldProgram.snapshot!.hasErrors;
    receiver!.snapshot!.hasSemanticErrorsFromOldState = receiver!.oldProgram.snapshot!.hasSemanticErrors;
  } else {
    receiver!.snapshot!.buildInfoEmitPending.Store(CompilerOptions_IsIncremental(receiver!.snapshot!.options));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.computeProgramFileChanges","kind":"method","status":"implemented","sigHash":"547d11b83e588117d62b91bdaa5a9261d2838acff6f8b2c6ea47ad7e1041c8b4","bodyHash":"3e39a98df96c3bf0d6d5345b381f7bdae45601944d7b1adac027e85ed56a87af"}
 *
 * Go source:
 * func (t *toProgramSnapshot) computeProgramFileChanges() {
 * 	canCopySemanticDiagnostics := t.oldProgram != nil &&
 * 		!tsoptions.CompilerOptionsAffectSemanticDiagnostics(t.oldProgram.snapshot.options, t.program.Options())
 * 	canCopyEmitSignatures := t.snapshot.options.Composite.IsTrue() &&
 * 		t.oldProgram != nil &&
 * 		!tsoptions.CompilerOptionsAffectDeclarationPath(t.oldProgram.snapshot.options, t.program.Options())
 * 	copyDeclarationFileDiagnostics := canCopySemanticDiagnostics &&
 * 		t.snapshot.options.SkipLibCheck.IsTrue() == t.oldProgram.snapshot.options.SkipLibCheck.IsTrue()
 * 	copyLibFileDiagnostics := copyDeclarationFileDiagnostics &&
 * 		t.snapshot.options.SkipDefaultLibCheck.IsTrue() == t.oldProgram.snapshot.options.SkipDefaultLibCheck.IsTrue()
 *
 * 	files := t.program.GetSourceFiles()
 * 	wg := core.NewWorkGroup(t.program.SingleThreaded())
 * 	for _, file := range files {
 * 		wg.Queue(func() {
 * 			...
 * 		})
 * 	}
 * 	wg.RunAndWait()
 * }
 */
export function toProgramSnapshot_computeProgramFileChanges(receiver: GoPtr<toProgramSnapshot>): void {
  const canCopySemanticDiagnostics = receiver!.oldProgram !== undefined &&
    !CompilerOptionsAffectSemanticDiagnostics(receiver!.oldProgram.snapshot!.options, Program_Options(receiver!.program));
  const canCopyEmitSignatures = Tristate_IsTrue(receiver!.snapshot!.options!.Composite) &&
    receiver!.oldProgram !== undefined &&
    !CompilerOptionsAffectDeclarationPath(receiver!.oldProgram.snapshot!.options, Program_Options(receiver!.program));
  const copyDeclarationFileDiagnostics = canCopySemanticDiagnostics &&
    Tristate_IsTrue(receiver!.snapshot!.options!.SkipLibCheck) === Tristate_IsTrue(receiver!.oldProgram!.snapshot!.options!.SkipLibCheck);
  const copyLibFileDiagnostics = copyDeclarationFileDiagnostics &&
    Tristate_IsTrue(receiver!.snapshot!.options!.SkipDefaultLibCheck) === Tristate_IsTrue(receiver!.oldProgram!.snapshot!.options!.SkipDefaultLibCheck);

  const files = Program_GetSourceFiles(receiver!.program);
  const wg = NewWorkGroup(Program_SingleThreaded(receiver!.program));
  for (const file of files) {
    wg.Queue(() => {
      const version = snapshot_computeHash(receiver!.snapshot, SourceFile_Text(file));
      const impliedNodeFormat = Program_GetSourceFileMetaData(receiver!.program, SourceFile_Path(file)).ImpliedNodeFormat;
      const affectsGlobalScope = fileAffectsGlobalScope(file);
      let signature = "";
      const newReferences = getReferencedFiles(receiver!.program, file);
      if (newReferences !== undefined) {
        referenceMap_storeReferences(receiver!.snapshot!.referencedMap, SourceFile_Path(file), newReferences);
      }
      if (receiver!.oldProgram !== undefined) {
        const [oldFileInfo, ok] = SyncMap_Load(receiver!.oldProgram.snapshot!.fileInfos as SyncMap<Path, FileInfo>, SourceFile_Path(file));
        if (ok) {
          signature = oldFileInfo!.signature;
          if (oldFileInfo!.version !== version || oldFileInfo!.affectsGlobalScope !== affectsGlobalScope || oldFileInfo!.impliedNodeFormat !== impliedNodeFormat) {
            snapshot_addFileToChangeSet(receiver!.snapshot, SourceFile_Path(file));
          } else {
            const [oldReferences] = referenceMap_getReferences(receiver!.oldProgram.snapshot!.referencedMap, SourceFile_Path(file));
            if (!Set_Equals(newReferences, oldReferences)) {
              // Referenced files changed
              snapshot_addFileToChangeSet(receiver!.snapshot, SourceFile_Path(file));
            } else if (newReferences !== undefined) {
              for (const [refPath] of Set_Keys(newReferences as GoPtr<Set<Path>>)) {
                if (Program_GetSourceFileByPath(receiver!.program, refPath) === undefined) {
                  const [, hadOldInfo] = SyncMap_Load(receiver!.oldProgram.snapshot!.fileInfos as SyncMap<Path, FileInfo>, refPath);
                  if (hadOldInfo) {
                    // Referenced file was deleted in the new program
                    snapshot_addFileToChangeSet(receiver!.snapshot, SourceFile_Path(file));
                    break;
                  }
                }
              }
            }
          }
        } else {
          snapshot_addFileToChangeSet(receiver!.snapshot, SourceFile_Path(file));
        }
        if (!SyncSet_Has(receiver!.snapshot!.changedFilesSet as SyncSet<Path>, SourceFile_Path(file))) {
          const [emitDiagnostics, hasEmitDiag] = SyncMap_Load(receiver!.oldProgram.snapshot!.emitDiagnosticsPerFile as SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>, SourceFile_Path(file));
          if (hasEmitDiag) {
            SyncMap_Store(receiver!.snapshot!.emitDiagnosticsPerFile as SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>, SourceFile_Path(file), repopulateDiagnosticsOfFile(emitDiagnostics, receiver!.program, file));
          }
          if (canCopySemanticDiagnostics) {
            if ((!file!.IsDeclarationFile || copyDeclarationFileDiagnostics) &&
              (!Program_IsSourceFileDefaultLibrary(receiver!.program, SourceFile_Path(file)) || copyLibFileDiagnostics)) {
              // Unchanged file copy diagnostics
              const [diagnostics, hasDiag] = SyncMap_Load(receiver!.oldProgram.snapshot!.semanticDiagnosticsPerFile as SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>, SourceFile_Path(file));
              if (hasDiag) {
                SyncMap_Store(receiver!.snapshot!.semanticDiagnosticsPerFile as SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>, SourceFile_Path(file), repopulateDiagnosticsOfFile(diagnostics, receiver!.program, file));
              }
            }
          }
        }
        if (canCopyEmitSignatures) {
          const [oldEmitSignature, hasOldEmit] = SyncMap_Load(receiver!.oldProgram.snapshot!.emitSignatures as SyncMap<Path, GoPtr<emitSignature>>, SourceFile_Path(file));
          if (hasOldEmit) {
            SyncMap_Store(receiver!.snapshot!.emitSignatures as SyncMap<Path, GoPtr<emitSignature>>, SourceFile_Path(file), emitSignature_getNewEmitSignature(oldEmitSignature, receiver!.oldProgram.snapshot!.options, receiver!.snapshot!.options));
          }
        }
      } else {
        snapshot_addFileToAffectedFilesPendingEmit(receiver!.snapshot, SourceFile_Path(file), GetFileEmitKind(receiver!.snapshot!.options));
        signature = version;
      }
      SyncMap_Store(receiver!.snapshot!.fileInfos as SyncMap<Path, FileInfo>, SourceFile_Path(file), {
        version: version,
        signature: signature,
        affectsGlobalScope: affectsGlobalScope,
        impliedNodeFormat: impliedNodeFormat,
      });
    });
  }
  wg.RunAndWait();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handleFileDelete","kind":"method","status":"implemented","sigHash":"a33891585da98bc7a32fe0b71e4262f2249f98f77b543c99b271a5372014eb1d","bodyHash":"b2782d0e033757fcdabc23a52148f870bd954e8fb0f16a6da6d69d520de56e49"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handleFileDelete() {
 * 	if t.oldProgram != nil {
 * 		// If the global file is removed, add all files as changed
 * 		t.oldProgram.snapshot.fileInfos.Range(func(filePath tspath.Path, oldInfo *FileInfo) bool {
 * 			if _, ok := t.snapshot.fileInfos.Load(filePath); !ok {
 * 				if oldInfo.affectsGlobalScope {
 * 					for _, file := range t.snapshot.getAllFilesExcludingDefaultLibraryFile(t.program, nil) {
 * 						t.snapshot.addFileToChangeSet(file.Path())
 * 					}
 * 					t.globalFileRemoved = true
 * 				} else {
 * 					t.snapshot.buildInfoEmitPending.Store(true)
 * 				}
 * 				return false
 * 			}
 * 			return true
 * 		})
 * 	}
 * }
 */
export function toProgramSnapshot_handleFileDelete(receiver: GoPtr<toProgramSnapshot>): void {
  if (receiver!.oldProgram !== undefined) {
    // If the global file is removed, add all files as changed
    SyncMap_Range(receiver!.oldProgram.snapshot!.fileInfos as SyncMap<Path, FileInfo>, (filePath: Path, oldInfo: FileInfo) => {
      const [, ok] = SyncMap_Load(receiver!.snapshot!.fileInfos as SyncMap<Path, FileInfo>, filePath);
      if (!ok) {
        if (oldInfo.affectsGlobalScope) {
          for (const file of snapshot_getAllFilesExcludingDefaultLibraryFile(receiver!.snapshot, receiver!.program, undefined)) {
            snapshot_addFileToChangeSet(receiver!.snapshot, SourceFile_Path(file));
          }
          receiver!.globalFileRemoved = true;
        } else {
          receiver!.snapshot!.buildInfoEmitPending.Store(true);
        }
        return false;
      }
      return true;
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handlePendingEmit","kind":"method","status":"implemented","sigHash":"fac4c75795c0b826e6190218b82ecec8a1f54a70654391053e0bfbc97de3bc87","bodyHash":"fbd9f0501b9891ccb14f507c52bcf14e92f8f2d52d811377b6571d829048557e"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handlePendingEmit() {
 * 	if t.oldProgram != nil && !t.globalFileRemoved {
 * 		var pendingEmitKind FileEmitKind
 * 		if tsoptions.CompilerOptionsAffectEmit(t.oldProgram.snapshot.options, t.snapshot.options) {
 * 			pendingEmitKind = GetFileEmitKind(t.snapshot.options)
 * 		} else {
 * 			pendingEmitKind = getPendingEmitKindWithOptions(t.snapshot.options, t.oldProgram.snapshot.options)
 * 		}
 * 		if pendingEmitKind != FileEmitKindNone {
 * 			for _, file := range t.program.GetSourceFiles() {
 * 				if !t.snapshot.changedFilesSet.Has(file.Path()) {
 * 					t.snapshot.addFileToAffectedFilesPendingEmit(file.Path(), pendingEmitKind)
 * 				}
 * 			}
 * 			t.snapshot.buildInfoEmitPending.Store(true)
 * 		}
 * 	}
 * }
 */
export function toProgramSnapshot_handlePendingEmit(receiver: GoPtr<toProgramSnapshot>): void {
  if (receiver!.oldProgram !== undefined && !receiver!.globalFileRemoved) {
    let pendingEmitKind: FileEmitKind;
    if (CompilerOptionsAffectEmit(receiver!.oldProgram.snapshot!.options, receiver!.snapshot!.options)) {
      pendingEmitKind = GetFileEmitKind(receiver!.snapshot!.options);
    } else {
      pendingEmitKind = getPendingEmitKindWithOptions(receiver!.snapshot!.options, receiver!.oldProgram.snapshot!.options);
    }
    if (pendingEmitKind !== 0) {
      // Add all files to affectedFilesPendingEmit since emit changed
      for (const file of Program_GetSourceFiles(receiver!.program)) {
        // Add to affectedFilesPending emit only if not changed since any changed file will do full emit
        if (!SyncSet_Has(receiver!.snapshot!.changedFilesSet as SyncSet<Path>, SourceFile_Path(file))) {
          snapshot_addFileToAffectedFilesPendingEmit(receiver!.snapshot, SourceFile_Path(file), pendingEmitKind);
        }
      }
      receiver!.snapshot!.buildInfoEmitPending.Store(true);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handlePendingCheck","kind":"method","status":"implemented","sigHash":"92ded51e7ff59660cd783dda18f03bbec0704e2af72f4f1bd45209191d534c64","bodyHash":"471548ba6ad92a39eef7b0d75d3ec33f58c5aa189079cd205ff2a194993a789a"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handlePendingCheck() {
 * 	if t.oldProgram != nil &&
 * 		t.snapshot.semanticDiagnosticsPerFile.Size() != len(t.program.GetSourceFiles()) &&
 * 		t.oldProgram.snapshot.checkPending != t.snapshot.checkPending {
 * 		t.snapshot.buildInfoEmitPending.Store(true)
 * 	}
 * }
 */
export function toProgramSnapshot_handlePendingCheck(receiver: GoPtr<toProgramSnapshot>): void {
  if (receiver!.oldProgram !== undefined &&
    SyncMap_Size(receiver!.snapshot!.semanticDiagnosticsPerFile as SyncMap<Path, unknown>) !== Program_GetSourceFiles(receiver!.program).length &&
    receiver!.oldProgram.snapshot!.checkPending !== receiver!.snapshot!.checkPending) {
    receiver!.snapshot!.buildInfoEmitPending.Store(true);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::fileAffectsGlobalScope","kind":"func","status":"implemented","sigHash":"d7099f3daa1f855a0ef9e921c1b115c33735addb4605fd5bee6ab16926a10cf1","bodyHash":"a4cd9e96350c74b9fb3574969f974e7e02f068e0453650dfd78a27b205ca50d6"}
 *
 * Go source:
 * func fileAffectsGlobalScope(file *ast.SourceFile) bool {
 * 	binder.BindSourceFile(file)
 * 	if core.Some(file.ModuleAugmentations, func(augmentation *ast.ModuleName) bool {
 * 		return ast.IsGlobalScopeAugmentation(augmentation.Parent)
 * 	}) {
 * 		return true
 * 	}
 *
 * 	if ast.IsExternalOrCommonJSModule(file) || ast.IsJsonSourceFile(file) {
 * 		return false
 * 	}
 *
 * 	return file.Statements != nil &&
 * 		file.Statements.Nodes != nil &&
 * 		core.Some(file.Statements.Nodes, func(stmt *ast.Node) bool {
 * 			return !ast.IsModuleWithStringLiteralName(stmt)
 * 		})
 * }
 */
export function fileAffectsGlobalScope(file: GoPtr<SourceFile>): bool {
  BindSourceFile(file);
  if (core.Some(file!.ModuleAugmentations, (augmentation: GoPtr<ModuleName>) => {
    return IsGlobalScopeAugmentation(augmentation!.Parent);
  })) {
    return true;
  }
  if (IsExternalOrCommonJSModule(file) || IsJsonSourceFile(file)) {
    return false;
  }
  return file!.Statements !== undefined &&
    file!.Statements.Nodes !== undefined &&
    core.Some(file!.Statements.Nodes, (stmt: GoPtr<Node>) => {
      return !IsModuleWithStringLiteralName(stmt);
    });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFilesFromSymbol","kind":"func","status":"implemented","sigHash":"b578b142ee7638712995dccbc303304be01aeee734f02a53706a049d5f58b989","bodyHash":"06850ca157abfb44e93abeeefab08a789dfb54fb6e14b7ba7839790ad3651487"}
 *
 * Go source:
 * func addReferencedFilesFromSymbol(file *ast.SourceFile, referencedFiles *collections.Set[tspath.Path], symbol *ast.Symbol) {
 * 	if symbol == nil {
 * 		return
 * 	}
 * 	for _, declaration := range symbol.Declarations {
 * 		fileOfDecl := ast.GetSourceFileOfNode(declaration)
 * 		if fileOfDecl == nil {
 * 			continue
 * 		}
 * 		if file != fileOfDecl {
 * 			referencedFiles.Add(fileOfDecl.Path())
 * 		}
 * 	}
 * }
 */
export function addReferencedFilesFromSymbol(file: GoPtr<SourceFile>, referencedFiles: GoPtr<Set>, symbol_: GoPtr<Symbol>): void {
  if (symbol_ === undefined) {
    return;
  }
  for (const declaration of symbol_!.Declarations ?? []) {
    const fileOfDecl = GetSourceFileOfNode(declaration);
    if (fileOfDecl === undefined) {
      continue;
    }
    if (file !== fileOfDecl) {
      Set_Add(referencedFiles as GoPtr<Set<Path>>, SourceFile_Path(fileOfDecl));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFilesFromImportLiteral","kind":"func","status":"implemented","sigHash":"f37c52ce26686b278505e8673feaf55e9c0ce9d7d4b43cba057141eae9656b6b","bodyHash":"4e6e0efc1cd624403592b5da06c78c82d7519f8cac55b5ad6b651a437850be08"}
 *
 * Go source:
 * func addReferencedFilesFromImportLiteral(file *ast.SourceFile, referencedFiles *collections.Set[tspath.Path], checker *checker.Checker, importName *ast.LiteralLikeNode) {
 * 	symbol := checker.GetSymbolAtLocation(importName)
 * 	addReferencedFilesFromSymbol(file, referencedFiles, symbol)
 * }
 */
export function addReferencedFilesFromImportLiteral(file: GoPtr<SourceFile>, referencedFiles: GoPtr<Set>, checker: GoPtr<Checker>, importName: GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.LiteralLikeNode">>): void {
  const symbol = Checker_GetSymbolAtLocation(checker, importName as GoPtr<Node>);
  addReferencedFilesFromSymbol(file, referencedFiles, symbol);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFileFromFileName","kind":"func","status":"implemented","sigHash":"3fa18a87f0e3e1ee9366476dd55b42fe6a19a31099ab2c7fd2dddbb025434aef","bodyHash":"ec2dfb7ed40a1f69b4cbd9ef384863ae20240776671be49d8cc8d8f7a33ea9ba"}
 *
 * Go source:
 * func addReferencedFileFromFileName(program *compiler.Program, fileName string, referencedFiles *collections.Set[tspath.Path], sourceFileDirectory string) {
 * 	if redirect := program.GetParseFileRedirect(fileName); redirect != "" {
 * 		referencedFiles.Add(tspath.ToPath(redirect, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames()))
 * 	} else {
 * 		referencedFiles.Add(tspath.ToPath(fileName, sourceFileDirectory, program.UseCaseSensitiveFileNames()))
 * 	}
 * }
 */
export function addReferencedFileFromFileName(program: GoPtr<Program>, fileName: string, referencedFiles: GoPtr<Set>, sourceFileDirectory: string): void {
  const redirect = Program_GetParseFileRedirect(program, fileName);
  if (redirect !== "") {
    Set_Add(referencedFiles as GoPtr<Set<Path>>, ToPath(redirect, Program_GetCurrentDirectory(program), Program_UseCaseSensitiveFileNames(program)));
  } else {
    Set_Add(referencedFiles as GoPtr<Set<Path>>, ToPath(fileName, sourceFileDirectory, Program_UseCaseSensitiveFileNames(program)));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::getReferencedFiles","kind":"func","status":"implemented","sigHash":"8f2904079e386cc4aa59351103743658ebc7ae059ff6c50186d019bafc05fce8","bodyHash":"23128532f8557b5957387793aab836ab11ed2c6c0051df806ad0259f7f01c01d"}
 *
 * Go source:
 * func getReferencedFiles(program *compiler.Program, file *ast.SourceFile) *collections.Set[tspath.Path] {
 * 	referencedFiles := collections.Set[tspath.Path]{}
 * 	checker, done := program.GetTypeCheckerForFileExclusive(context.TODO(), file)
 * 	defer done()
 * 	for _, importName := range file.Imports() {
 * 		addReferencedFilesFromImportLiteral(file, &referencedFiles, checker, importName)
 * 	}
 * 	sourceFileDirectory := tspath.GetDirectoryPath(file.FileName())
 * 	for _, referencedFile := range file.ReferencedFiles {
 * 		addReferencedFileFromFileName(program, referencedFile.FileName, &referencedFiles, sourceFileDirectory)
 * 	}
 * 	if typeRefsInFile, ok := program.GetResolvedTypeReferenceDirectives()[file.Path()]; ok {
 * 		for _, typeRef := range typeRefsInFile {
 * 			if typeRef.ResolvedFileName != "" {
 * 				addReferencedFileFromFileName(program, typeRef.ResolvedFileName, &referencedFiles, sourceFileDirectory)
 * 			}
 * 		}
 * 	}
 * 	for _, moduleName := range file.ModuleAugmentations {
 * 		if !ast.IsStringLiteral(moduleName) {
 * 			continue
 * 		}
 * 		addReferencedFilesFromImportLiteral(file, &referencedFiles, checker, moduleName)
 * 	}
 * 	for _, ambientModule := range checker.GetAmbientModules() {
 * 		addReferencedFilesFromSymbol(file, &referencedFiles, ambientModule)
 * 	}
 * 	return core.IfElse(referencedFiles.Len() > 0, &referencedFiles, nil)
 * }
 */
export function getReferencedFiles(program: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Set> {
  const referencedFiles = NewSetWithSizeHint<Path>(0)!;
  const [checker, done] = Program_GetTypeCheckerForFileExclusive(program, TODO() as Context, file);
  try {
    for (const importName of SourceFile_Imports(file)) {
      addReferencedFilesFromImportLiteral(file, referencedFiles, checker, importName as GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.LiteralLikeNode">>);
    }
    const sourceFileDirectory = GetDirectoryPath(SourceFile_FileName(file));
    for (const referencedFile of file!.ReferencedFiles) {
      addReferencedFileFromFileName(program, referencedFile!.FileName, referencedFiles, sourceFileDirectory);
    }
    const resolvedTypeRefs = Program_GetResolvedTypeReferenceDirectives(program);
    const typeRefsInFile = resolvedTypeRefs.get(SourceFile_Path(file));
    if (typeRefsInFile !== undefined) {
      for (const [, typeRef] of typeRefsInFile) {
        const resolvedTypeRef = typeRef as GoPtr<ResolvedTypeReferenceDirective>;
        if (resolvedTypeRef !== undefined && resolvedTypeRef.ResolvedFileName !== "") {
          addReferencedFileFromFileName(program, resolvedTypeRef.ResolvedFileName, referencedFiles, sourceFileDirectory);
        }
      }
    }
    for (const moduleName of file!.ModuleAugmentations) {
      if (!IsStringLiteral(moduleName as GoPtr<Node>)) {
        continue;
      }
      addReferencedFilesFromImportLiteral(file, referencedFiles, checker, moduleName as GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.LiteralLikeNode">>);
    }
    for (const ambientModule of Checker_GetAmbientModules(checker)) {
      addReferencedFilesFromSymbol(file, referencedFiles, ambientModule);
    }
  } finally {
    done();
  }
  return core.IfElse(Set_Len(referencedFiles) > 0, referencedFiles, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticsOfFile","kind":"func","status":"implemented","sigHash":"d5067aeb7564e9073f42fef03766e9f8ca9caafeecfd1abce3de0d555b1e2af4","bodyHash":"e75b134e84ec04396e5e888615666d8c6ba90b39fecfbaa3fba2d7e140f077b1"}
 *
 * Go source:
 * func repopulateDiagnosticsOfFile(diags *DiagnosticsOrBuildInfoDiagnosticsWithFileName, p *compiler.Program, file *ast.SourceFile) *DiagnosticsOrBuildInfoDiagnosticsWithFileName {
 * 	if diags.diagnostics != nil {
 * 		repopulated := repopulateDiagnosticsList(diags.diagnostics, p, file)
 * 		if repopulated == nil {
 * 			return diags
 * 		}
 * 		return &DiagnosticsOrBuildInfoDiagnosticsWithFileName{diagnostics: repopulated}
 * 	}
 * 	// buildInfoDiagnostics will be repopulated via toDiagnostic's repopulateInfo handling
 * 	return diags
 * }
 */
export function repopulateDiagnosticsOfFile(diags: GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName> {
  if (diags!.diagnostics !== undefined && diags!.diagnostics !== null) {
    const repopulated = repopulateDiagnosticsList(diags!.diagnostics, p, file);
    if (repopulated === undefined || repopulated === null) {
      return diags;
    }
    return { diagnostics: repopulated, buildInfoDiagnostics: [] };
  }
  // buildInfoDiagnostics will be repopulated via toDiagnostic's repopulateInfo handling
  return diags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticsList","kind":"func","status":"implemented","sigHash":"99be7eb5fce8ead6933f781a010e4798280327a1c220a737374fa538c06cb91d","bodyHash":"a026bca71a69c25b7f1b8c11508baed25078795f4b01652a0bb622fd5fd1d7be"}
 *
 * Go source:
 * func repopulateDiagnosticsList(diags []*ast.Diagnostic, p *compiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
 * 	changed := false
 * 	result := make([]*ast.Diagnostic, len(diags))
 * 	for i, d := range diags {
 * 		repopulated := repopulateDiagnosticMessageChain(d.MessageChain(), p, file)
 * 		if repopulated != nil {
 * 			clone := d.Clone()
 * 			clone.SetMessageChain(repopulated)
 * 			result[i] = clone
 * 			changed = true
 * 		} else {
 * 			result[i] = d
 * 		}
 * 	}
 * 	if !changed {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export function repopulateDiagnosticsList(diags: GoSlice<GoPtr<Diagnostic>>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  let changed = false;
  const result: GoPtr<Diagnostic>[] = new Array(diags.length);
  for (let i = 0; i < diags.length; i++) {
    const d = diags[i];
    const repopulated = repopulateDiagnosticMessageChain(Diagnostic_MessageChain(d), p, file);
    if (repopulated !== undefined && repopulated !== null) {
      const clone = Diagnostic_Clone(d);
      Diagnostic_SetMessageChain(clone, repopulated);
      result[i] = clone;
      changed = true;
    } else {
      result[i] = d;
    }
  }
  if (!changed) {
    return undefined as unknown as GoSlice<GoPtr<Diagnostic>>;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticMessageChain","kind":"func","status":"implemented","sigHash":"e1527c7a51b0ee2981df52918566e2fc419facbfbab3ad7960203a6cf45a001a","bodyHash":"063591cd51a507f2e92cb5d78a11a6fb01e64b78133aa29713632e3723a14497"}
 *
 * Go source:
 * func repopulateDiagnosticMessageChain(chain []*ast.Diagnostic, p *compiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
 * 	if len(chain) == 0 {
 * 		return nil
 * 	}
 * 	changed := false
 * 	result := make([]*ast.Diagnostic, len(chain))
 * 	for i, c := range chain {
 * 		if c.RepopulateInfo() != nil {
 * 			b := &buildInfoDiagnosticWithFileName{...}
 * 			...
 * 			result[i] = repopulateDiagnosticChain(b, p, file)
 * 			changed = true
 * 		} else {
 * 			nested := repopulateDiagnosticMessageChain(c.MessageChain(), p, file)
 * 			if nested != nil {
 * 				clone := c.Clone()
 * 				clone.SetMessageChain(nested)
 * 				result[i] = clone
 * 				changed = true
 * 			} else {
 * 				result[i] = c
 * 			}
 * 		}
 * 	}
 * 	if !changed {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export function repopulateDiagnosticMessageChain(chain: GoSlice<GoPtr<Diagnostic>>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  if (chain.length === 0) {
    return undefined as unknown as GoSlice<GoPtr<Diagnostic>>;
  }
  let changed = false;
  const result: GoPtr<Diagnostic>[] = new Array(chain.length);
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    if (Diagnostic_RepopulateInfo(c) !== undefined) {
      // Convert to buildInfoDiagnosticWithFileName and repopulate
      const b: buildInfoDiagnosticWithFileName = {
        file: "" as Path,
        noFile: false,
        pos: Diagnostic_Pos(c),
        end: Diagnostic_End(c),
        code: Diagnostic_Code(c),
        category: Diagnostic_Category(c),
        messageKey: Diagnostic_MessageKey(c),
        messageArgs: Diagnostic_MessageArgs(c),
        repopulateInfo: Diagnostic_RepopulateInfo(c),
        messageChain: [],
        relatedInformation: [],
        reportsUnnecessary: false,
        reportsDeprecated: false,
        skippedOnNoEmit: false,
      };
      // Recursively handle nested chains
      for (const nested of Diagnostic_MessageChain(c)) {
        b.messageChain.push(astDiagToBuildInfoDiag(nested));
      }
      result[i] = repopulateDiagnosticChain(b, p, file);
      changed = true;
    } else {
      // Check nested chains
      const nested = repopulateDiagnosticMessageChain(Diagnostic_MessageChain(c), p, file);
      if (nested !== undefined && nested !== null) {
        const clone = Diagnostic_Clone(c);
        Diagnostic_SetMessageChain(clone, nested);
        result[i] = clone;
        changed = true;
      } else {
        result[i] = c;
      }
    }
  }
  if (!changed) {
    return undefined as unknown as GoSlice<GoPtr<Diagnostic>>;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::astDiagToBuildInfoDiag","kind":"func","status":"implemented","sigHash":"448a5f4058d6847dc53451f22e44f083389ef22024487c1372e7941ed556e50a","bodyHash":"d64bf6dbe38c137d35a672f37ada677662e9567b0f10f0c618f233ede429ac3e"}
 *
 * Go source:
 * func astDiagToBuildInfoDiag(d *ast.Diagnostic) *buildInfoDiagnosticWithFileName {
 * 	b := &buildInfoDiagnosticWithFileName{...}
 * 	for _, nested := range d.MessageChain() {
 * 		b.messageChain = append(b.messageChain, astDiagToBuildInfoDiag(nested))
 * 	}
 * 	return b
 * }
 */
export function astDiagToBuildInfoDiag(d: GoPtr<Diagnostic>): GoPtr<buildInfoDiagnosticWithFileName> {
  const b: buildInfoDiagnosticWithFileName = {
    file: "" as Path,
    noFile: false,
    pos: Diagnostic_Pos(d),
    end: Diagnostic_End(d),
    code: Diagnostic_Code(d),
    category: Diagnostic_Category(d),
    messageKey: Diagnostic_MessageKey(d),
    messageArgs: Diagnostic_MessageArgs(d),
    repopulateInfo: Diagnostic_RepopulateInfo(d),
    messageChain: [],
    relatedInformation: [],
    reportsUnnecessary: false,
    reportsDeprecated: false,
    skippedOnNoEmit: false,
  };
  for (const nested of Diagnostic_MessageChain(d)) {
    b.messageChain.push(astDiagToBuildInfoDiag(nested));
  }
  return b;
}

import { Map as SyncMapImpl } from "../../../go/sync.js";
import { SourceFile_Path } from "../../ast/ast.js";
import { SyncMap_Load, SyncMap_Size, SyncMap_Store } from "../../collections/syncmap.js";
import { Program_CommonSourceDirectory as compiler_Program_CommonSourceDirectory, Program_Emit as compiler_Program_Emit, Program_GetBindDiagnostics as compiler_Program_GetBindDiagnostics, Program_GetConfigFileParsingDiagnostics as compiler_Program_GetConfigFileParsingDiagnostics, Program_GetCurrentDirectory as compiler_Program_GetCurrentDirectory, Program_GetGlobalDiagnostics as compiler_Program_GetGlobalDiagnostics, Program_GetIncludeProcessorDiagnostics as compiler_Program_GetIncludeProcessorDiagnostics, Program_GetProgramDiagnostics as compiler_Program_GetProgramDiagnostics, Program_GetSemanticDiagnosticsWithoutNoEmitFiltering as compiler_Program_GetSemanticDiagnosticsWithoutNoEmitFiltering, Program_GetSourceFiles as compiler_Program_GetSourceFiles, Program_GetSourceFile as compiler_Program_GetSourceFile, Program_GetSuggestionDiagnostics as compiler_Program_GetSuggestionDiagnostics, Program_GetSyntacticDiagnostics as compiler_Program_GetSyntacticDiagnostics, Program_Host as compiler_Program_Host, Program_IsEmitBlocked as compiler_Program_IsEmitBlocked, Program_IsSourceFileDefaultLibrary as compiler_Program_IsSourceFileDefaultLibrary, Program_SkipTypeChecking as compiler_Program_SkipTypeChecking, Program_Tracing as compiler_Program_Tracing, Program_UseCaseSensitiveFileNames as compiler_Program_UseCaseSensitiveFileNames, FilterNoEmitSemanticDiagnostics, HandleNoEmitOnError, CombineEmitResults, } from "../../compiler/program.js";
import { CompilerOptions_IsIncremental } from "../../core/compileroptions.js";
import { TSUnknown, TSTrue, TSFalse, Tristate_IsTrue } from "../../core/tristate.js";
import { IfElse } from "../../core/core.js";
import { GetBuildInfoFileName } from "../../outputpaths/outputpaths.js";
import { DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics, snapshot_canUseIncrementalState } from "./snapshot.js";
import { programToSnapshot } from "./programtosnapshot.js";
import { snapshotToBuildInfo } from "./snapshottobuildinfo.js";
import { collectAllAffectedFiles } from "./affectedfileshandler.js";
import { emitFiles } from "./emitfileshandler.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::constGroup::SignatureUpdateKindComputedDts+SignatureUpdateKindStoredAtEmit+SignatureUpdateKindUsedVersion","kind":"constGroup","status":"implemented","sigHash":"01390c3050ecc798cc1daceca195a7c24625b611a8b377152422fb651be822e9","bodyHash":"212d1f42f5db4ecb31ab2d6eb0148813e2defcfd22b9f66c228602f9fcded981"}
 *
 * Go source:
 * const (
 * 	SignatureUpdateKindComputedDts SignatureUpdateKind = iota
 * 	SignatureUpdateKindStoredAtEmit
 * 	SignatureUpdateKindUsedVersion
 * )
 */
export const SignatureUpdateKindComputedDts = 0;
export const SignatureUpdateKindStoredAtEmit = 1;
export const SignatureUpdateKindUsedVersion = 2;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"20e7598ede71afb069e4d3fa46681aa99cecee0259464b32c8188888a6efab62"}
 *
 * Go source:
 * var _ compiler.ProgramLike = (*Program)(nil)
 */
export let __9846d1d6_0 = Program_as_compiler_ProgramLike(undefined);
export function Program_as_compiler_ProgramLike(receiver) {
    return {
        Options: () => Program_Options(receiver),
        GetSourceFile: (path) => Program_GetSourceFile(receiver, path),
        GetSourceFiles: () => Program_GetSourceFiles(receiver),
        GetConfigFileParsingDiagnostics: () => Program_GetConfigFileParsingDiagnostics(receiver),
        GetSyntacticDiagnostics: (ctx, file) => Program_GetSyntacticDiagnostics(receiver, ctx, file),
        GetBindDiagnostics: (ctx, file) => Program_GetBindDiagnostics(receiver, ctx, file),
        GetProgramDiagnostics: () => Program_GetProgramDiagnostics(receiver),
        GetGlobalDiagnostics: (ctx) => Program_GetGlobalDiagnostics(receiver, ctx),
        GetSemanticDiagnostics: (ctx, file) => Program_GetSemanticDiagnostics(receiver, ctx, file),
        GetDeclarationDiagnostics: (ctx, file) => Program_GetDeclarationDiagnostics(receiver, ctx, file),
        GetSuggestionDiagnostics: (ctx, file) => Program_GetSuggestionDiagnostics(receiver, ctx, file),
        Emit: (ctx, options) => Program_Emit(receiver, ctx, options),
        CommonSourceDirectory: () => Program_CommonSourceDirectory(receiver),
        IsSourceFileDefaultLibrary: (path) => Program_IsSourceFileDefaultLibrary(receiver, path),
        Program: () => Program_Program(receiver),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::func::NewProgram","kind":"func","status":"implemented","sigHash":"3df5f6a3788f3fb352092e53e324630656089873eed39eddad307a11d05014c2","bodyHash":"8e871b7861682297cf1696551207473f296f7d4dc7aeb5a0e3f8a9987caad200"}
 *
 * Go source:
 * func NewProgram(program *compiler.Program, oldProgram *Program, host Host, testing bool) *Program {
 * 	incrementalProgram := &Program{
 * 		snapshot: programToSnapshot(program, oldProgram, testing),
 * 		program:  program,
 * 		host:     host,
 * 	}
 *
 * 	if testing {
 * 		incrementalProgram.testingData = &TestingData{}
 * 		incrementalProgram.testingData.SemanticDiagnosticsPerFile = &incrementalProgram.snapshot.semanticDiagnosticsPerFile
 * 		if oldProgram != nil {
 * 			incrementalProgram.testingData.OldProgramSemanticDiagnosticsPerFile = &oldProgram.snapshot.semanticDiagnosticsPerFile
 * 		} else {
 * 			incrementalProgram.testingData.OldProgramSemanticDiagnosticsPerFile = &collections.SyncMap[tspath.Path, *DiagnosticsOrBuildInfoDiagnosticsWithFileName]{}
 * 		}
 * 		incrementalProgram.testingData.UpdatedSignatureKinds = make(map[tspath.Path]SignatureUpdateKind)
 * 	}
 * 	return incrementalProgram
 * }
 */
export function NewProgram(program, oldProgram, host, testing) {
    const incrementalProgram = {
        snapshot: programToSnapshot(program, oldProgram, testing),
        program: program,
        host: host,
        testingData: undefined,
    };
    if (testing) {
        incrementalProgram.testingData = {
            SemanticDiagnosticsPerFile: incrementalProgram.snapshot.semanticDiagnosticsPerFile,
            OldProgramSemanticDiagnosticsPerFile: oldProgram !== undefined
                ? oldProgram.snapshot.semanticDiagnosticsPerFile
                : { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
            UpdatedSignatureKinds: new Map(),
        };
    }
    return incrementalProgram;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetTestingData","kind":"method","status":"implemented","sigHash":"e564c7fbc016c061174d5c64f46a4ceed7ae3f70e4be5f44fb12bb8bafafc0f7","bodyHash":"da01febb0b9996b3e7db863eb7cb7a38104872df1e3163784c409285f954be50"}
 *
 * Go source:
 * func (p *Program) GetTestingData() *TestingData {
 * 	return p.testingData
 * }
 */
export function Program_GetTestingData(receiver) {
    return receiver.testingData;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.panicIfNoProgram","kind":"method","status":"implemented","sigHash":"5fbd814b5511e84452d0a996b885c8062bb19c9d44b33f23960610b55736e4ba","bodyHash":"e2f40ec2d16a24fe734c0173055c0a89ff52d581ceb9c846e1fb0c4bc15df7f3"}
 *
 * Go source:
 * func (p *Program) panicIfNoProgram(method string) {
 * 	if p.program == nil {
 * 		panic(method + ": should not be called without program")
 * 	}
 * }
 */
export function Program_panicIfNoProgram(receiver, method) {
    if (receiver.program === undefined) {
        throw new globalThis.Error(method + ": should not be called without program");
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetProgram","kind":"method","status":"implemented","sigHash":"e5c36acf65c06ff6c6e75b27acb4499ef350f923fc5515392a453f1d6686af67","bodyHash":"febf638771b64d832a7e8578d7b0874ae3dd474ec573971b639cedd4b2ae683a"}
 *
 * Go source:
 * func (p *Program) GetProgram() *compiler.Program {
 * 	p.panicIfNoProgram("GetProgram")
 * 	return p.program
 * }
 */
export function Program_GetProgram(receiver) {
    Program_panicIfNoProgram(receiver, "GetProgram");
    return receiver.program;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.HasChangedDtsFile","kind":"method","status":"implemented","sigHash":"4a8974c0b856622a108269258059eabf7e519573419d95c39077bd07f6f56ff5","bodyHash":"b352b7891acca7d28d5a455eb277e0c8966af0675a8f7d738c898f605bb8a260"}
 *
 * Go source:
 * func (p *Program) HasChangedDtsFile() bool {
 * 	return p.snapshot.hasChangedDtsFile
 * }
 */
export function Program_HasChangedDtsFile(receiver) {
    return receiver.snapshot.hasChangedDtsFile;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.Options","kind":"method","status":"implemented","sigHash":"3dd0199584e4904b465f901d418ca2e8128c64d6cf1ea895f77a4bf496f4109b","bodyHash":"1b47cc2546e3f150b9f14dba13ac1537513dc8736b21038dfed5c028b79af3bd"}
 *
 * Go source:
 * func (p *Program) Options() *core.CompilerOptions {
 * 	return p.snapshot.options
 * }
 */
export function Program_Options(receiver) {
    return receiver.snapshot.options;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.CommonSourceDirectory","kind":"method","status":"implemented","sigHash":"7766f52b3875d8573e2c66fe97a6ee533c7ce7eaa34e5bb0795039cf8bbfa1a5","bodyHash":"5d3cf5a51546fa827dbdc2b19d7f4880658ada838b3ddde9780a0f6dc5fa095d"}
 *
 * Go source:
 * func (p *Program) CommonSourceDirectory() string {
 * 	p.panicIfNoProgram("CommonSourceDirectory")
 * 	return p.program.CommonSourceDirectory()
 * }
 */
export function Program_CommonSourceDirectory(receiver) {
    Program_panicIfNoProgram(receiver, "CommonSourceDirectory");
    return compiler_Program_CommonSourceDirectory(receiver.program);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.Program","kind":"method","status":"implemented","sigHash":"e923a7d47995ab0901f1952e34eb1f33b7fcd2241f2ecd6fb3dd45aad6efef4e","bodyHash":"825f9e582b64cc1f498a610546670a413b89a1f8cb77b84c964d3ff0efcc4489"}
 *
 * Go source:
 * func (p *Program) Program() *compiler.Program {
 * 	p.panicIfNoProgram("Program")
 * 	return p.program
 * }
 */
export function Program_Program(receiver) {
    Program_panicIfNoProgram(receiver, "Program");
    return receiver.program;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.IsSourceFileDefaultLibrary","kind":"method","status":"implemented","sigHash":"277da0139666b5c9748fe9fa5aef402f6c8a5c43571a5845a227a89e6c5a871d","bodyHash":"cee2ce53157a9542ba37f73f7e25299278a933a3b8ceca0e4d667b7699633c03"}
 *
 * Go source:
 * func (p *Program) IsSourceFileDefaultLibrary(path tspath.Path) bool {
 * 	p.panicIfNoProgram("IsSourceFileDefaultLibrary")
 * 	return p.program.IsSourceFileDefaultLibrary(path)
 * }
 */
export function Program_IsSourceFileDefaultLibrary(receiver, path) {
    Program_panicIfNoProgram(receiver, "IsSourceFileDefaultLibrary");
    return compiler_Program_IsSourceFileDefaultLibrary(receiver.program, path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetSourceFiles","kind":"method","status":"implemented","sigHash":"d87d0d068c26f2640ffeed70544b971ac138a8d8b564be7cdccca448936f963f","bodyHash":"dc6be3cfa346f64f73e15140750ddb994a2a742038ad8416bd6c711eb84aa752"}
 *
 * Go source:
 * func (p *Program) GetSourceFiles() []*ast.SourceFile {
 * 	p.panicIfNoProgram("GetSourceFiles")
 * 	return p.program.GetSourceFiles()
 * }
 */
export function Program_GetSourceFiles(receiver) {
    Program_panicIfNoProgram(receiver, "GetSourceFiles");
    return compiler_Program_GetSourceFiles(receiver.program);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetSourceFile","kind":"method","status":"implemented","sigHash":"bc838977c4d9c170c58e875822981ec0647024dbda7928536b21e26da92a58ed","bodyHash":"9aee850c9d0468640515b691c80d0e109ea821837222265c72286223e9d84af3"}
 *
 * Go source:
 * func (p *Program) GetSourceFile(path string) *ast.SourceFile {
 * 	p.panicIfNoProgram("GetSourceFile")
 * 	return p.program.GetSourceFile(path)
 * }
 */
export function Program_GetSourceFile(receiver, path) {
    Program_panicIfNoProgram(receiver, "GetSourceFile");
    return compiler_Program_GetSourceFile(receiver.program, path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetConfigFileParsingDiagnostics","kind":"method","status":"implemented","sigHash":"7b0730389b6f680738d12924b11c90bab464898af8f847ff2dd230fb88c6ff00","bodyHash":"6984e46180f744f0f52cd2ce91b6a9e470196ba8b6f347fa266fb94ccedaf88d"}
 *
 * Go source:
 * func (p *Program) GetConfigFileParsingDiagnostics() []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetConfigFileParsingDiagnostics")
 * 	return p.program.GetConfigFileParsingDiagnostics()
 * }
 */
export function Program_GetConfigFileParsingDiagnostics(receiver) {
    Program_panicIfNoProgram(receiver, "GetConfigFileParsingDiagnostics");
    return compiler_Program_GetConfigFileParsingDiagnostics(receiver.program);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetSyntacticDiagnostics","kind":"method","status":"implemented","sigHash":"8685d4bfacb8a06c1eb0eca02d1674c29c94e5b5a254b26cf48d5de9e6d86857","bodyHash":"73f105b946fb667431cf3e21a4806dea90c9dfd0617d2285b34f742d30f9ceee"}
 *
 * Go source:
 * func (p *Program) GetSyntacticDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetSyntacticDiagnostics")
 * 	return p.program.GetSyntacticDiagnostics(ctx, file)
 * }
 */
export function Program_GetSyntacticDiagnostics(receiver, ctx, file) {
    Program_panicIfNoProgram(receiver, "GetSyntacticDiagnostics");
    return compiler_Program_GetSyntacticDiagnostics(receiver.program, ctx, file);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetBindDiagnostics","kind":"method","status":"implemented","sigHash":"ab776d574330719a572753040c72090e137e139e9a40603f4cea0ee9240be59b","bodyHash":"bbe542b7152f99d67a7043fcc41ead004cdfeff3fcca5b865db0f7d43126c011"}
 *
 * Go source:
 * func (p *Program) GetBindDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetBindDiagnostics")
 * 	return p.program.GetBindDiagnostics(ctx, file)
 * }
 */
export function Program_GetBindDiagnostics(receiver, ctx, file) {
    Program_panicIfNoProgram(receiver, "GetBindDiagnostics");
    return compiler_Program_GetBindDiagnostics(receiver.program, ctx, file);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetProgramDiagnostics","kind":"method","status":"implemented","sigHash":"26d89878cad6bdc89a718a62296967d3f30a5323975dac05f14234c33e3559d5","bodyHash":"9596f6a13a416e32dd297703c27e1a031d0f41708b52a6b41ffdfb51127a4fea"}
 *
 * Go source:
 * func (p *Program) GetProgramDiagnostics() []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetProgramDiagnostics")
 * 	return p.program.GetProgramDiagnostics()
 * }
 */
export function Program_GetProgramDiagnostics(receiver) {
    Program_panicIfNoProgram(receiver, "GetProgramDiagnostics");
    return compiler_Program_GetProgramDiagnostics(receiver.program);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetGlobalDiagnostics","kind":"method","status":"implemented","sigHash":"af850db7e0012d4a166325e0bfc7157e77f96394fcf83ca8e2841cbe7899ce6e","bodyHash":"87d89f16a5a60bc0c0b62f71f249dd677d3592d4276c9d03201ef90b6e80ed41"}
 *
 * Go source:
 * func (p *Program) GetGlobalDiagnostics(ctx context.Context) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetGlobalDiagnostics")
 * 	return p.program.GetGlobalDiagnostics(ctx)
 * }
 */
export function Program_GetGlobalDiagnostics(receiver, ctx) {
    Program_panicIfNoProgram(receiver, "GetGlobalDiagnostics");
    return compiler_Program_GetGlobalDiagnostics(receiver.program, ctx);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetSemanticDiagnostics","kind":"method","status":"implemented","sigHash":"8efa86fa17318b1b582ff4e24a07c62871725e4bf8449e848f58acf73d76c129","bodyHash":"33862d7065e1a12ce1414bdab335a4614159dbc89b86119c2530db2c3778483c"}
 *
 * Go source:
 * func (p *Program) GetSemanticDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetSemanticDiagnostics")
 * 	if p.snapshot.options.NoCheck.IsTrue() {
 * 		return nil
 * 	}
 *
 * 	// Ensure all the diagnsotics are cached
 * 	p.collectSemanticDiagnosticsOfAffectedFiles(ctx, file)
 * 	if ctx.Err() != nil {
 * 		return nil
 * 	}
 *
 * 	// Return result from cache
 * 	if file != nil {
 * 		return p.getSemanticDiagnosticsOfFile(file)
 * 	}
 *
 * 	var diagnostics []*ast.Diagnostic
 * 	for _, file := range p.program.GetSourceFiles() {
 * 		diagnostics = append(diagnostics, p.getSemanticDiagnosticsOfFile(file)...)
 * 	}
 * 	return diagnostics
 * }
 */
export function Program_GetSemanticDiagnostics(receiver, ctx, file) {
    Program_panicIfNoProgram(receiver, "GetSemanticDiagnostics");
    if (Tristate_IsTrue(receiver.snapshot.options.NoCheck)) {
        return [];
    }
    Program_collectSemanticDiagnosticsOfAffectedFiles(receiver, ctx, file);
    if (ctx.Err() !== undefined) {
        return [];
    }
    if (file !== undefined) {
        return Program_getSemanticDiagnosticsOfFile(receiver, file);
    }
    const diagnostics = [];
    for (const f of compiler_Program_GetSourceFiles(receiver.program)) {
        for (const d of Program_getSemanticDiagnosticsOfFile(receiver, f)) {
            diagnostics.push(d);
        }
    }
    return diagnostics;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.getSemanticDiagnosticsOfFile","kind":"method","status":"implemented","sigHash":"431059d5c96ad05f451486820156f1d4b3184a431a0a836568c21ab25400db0f","bodyHash":"f67d5aa7d91d4e5a1967acb1ce7f388549d5f5f0a0d1b60f9ed686faac8cf81c"}
 *
 * Go source:
 * func (p *Program) getSemanticDiagnosticsOfFile(file *ast.SourceFile) []*ast.Diagnostic {
 * 	cachedDiagnostics, ok := p.snapshot.semanticDiagnosticsPerFile.Load(file.Path())
 * 	if !ok {
 * 		panic("After handling all the affected files, there shouldnt be more changes")
 * 	}
 * 	return slices.Concat(
 * 		compiler.FilterNoEmitSemanticDiagnostics(cachedDiagnostics.getDiagnostics(p.program, file), p.snapshot.options),
 * 		p.program.GetIncludeProcessorDiagnostics(file),
 * 	)
 * }
 */
export function Program_getSemanticDiagnosticsOfFile(receiver, file) {
    const [cachedDiagnostics, ok] = SyncMap_Load(receiver.snapshot.semanticDiagnosticsPerFile, SourceFile_Path(file));
    if (!ok) {
        throw new globalThis.Error("After handling all the affected files, there shouldnt be more changes");
    }
    const filtered = FilterNoEmitSemanticDiagnostics(DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics(cachedDiagnostics, receiver.program, file), receiver.snapshot.options);
    const includeProcessorDiags = compiler_Program_GetIncludeProcessorDiagnostics(receiver.program, file);
    return [...filtered, ...(includeProcessorDiags ?? [])];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetDeclarationDiagnostics","kind":"method","status":"implemented","sigHash":"22be7472728b9f481e092ece9961a0607d8c0f31f050f1baafe99ebac4038daf","bodyHash":"33803a757b4e5186c8dcf4fa4e5d786709b6321a23e324a46477d4561845cc4b"}
 *
 * Go source:
 * func (p *Program) GetDeclarationDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetDeclarationDiagnostics")
 * 	result := emitFiles(ctx, p, compiler.EmitOptions{
 * 		TargetSourceFile: file,
 * 	}, true)
 * 	if result != nil {
 * 		return result.Diagnostics
 * 	}
 * 	return nil
 * }
 */
export function Program_GetDeclarationDiagnostics(receiver, ctx, file) {
    Program_panicIfNoProgram(receiver, "GetDeclarationDiagnostics");
    const result = emitFiles(ctx, receiver, { TargetSourceFile: file }, true);
    if (result !== undefined) {
        return result.Diagnostics;
    }
    return [];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.GetSuggestionDiagnostics","kind":"method","status":"implemented","sigHash":"8fa37e21ad820f2faeda257f38335463c027a6b02d16d13aac86d23de42622f4","bodyHash":"cc0ac3a326891f2be0b0eea87d31ad5fd6c75720aaf89bb9c1d96712e5e26b7d"}
 *
 * Go source:
 * func (p *Program) GetSuggestionDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 	p.panicIfNoProgram("GetSuggestionDiagnostics")
 * 	return p.program.GetSuggestionDiagnostics(ctx, file) // TODO: incremental suggestion diagnostics (only relevant in editor incremental builder?)
 * }
 */
export function Program_GetSuggestionDiagnostics(receiver, ctx, file) {
    Program_panicIfNoProgram(receiver, "GetSuggestionDiagnostics");
    return compiler_Program_GetSuggestionDiagnostics(receiver.program, ctx, file);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.Emit","kind":"method","status":"implemented","sigHash":"b16b0cdd89490a0470ae8881a0f4326a20979ef693e360a762750fa746c4f65a","bodyHash":"e27e2c4c496e6a669eff4b580966e4921b82bfc237e01135755619a748841b4d"}
 *
 * Go source:
 * func (p *Program) Emit(ctx context.Context, options compiler.EmitOptions) *compiler.EmitResult {
 * 	p.panicIfNoProgram("Emit")
 *
 * 	var result *compiler.EmitResult
 * 	if p.snapshot.options.NoEmit.IsTrue() {
 * 		result = &compiler.EmitResult{EmitSkipped: true}
 * 	} else {
 * 		result = compiler.HandleNoEmitOnError(ctx, p, options.TargetSourceFile)
 * 		if ctx.Err() != nil {
 * 			return nil
 * 		}
 * 	}
 * 	if result != nil {
 * 		if options.TargetSourceFile != nil {
 * 			return result
 * 		}
 *
 * 		// Emit buildInfo and combine result
 * 		buildInfoResult := p.emitBuildInfo(ctx, options)
 * 		if buildInfoResult != nil {
 * 			result.Diagnostics = append(result.Diagnostics, buildInfoResult.Diagnostics...)
 * 			result.EmittedFiles = append(result.EmittedFiles, buildInfoResult.EmittedFiles...)
 * 		}
 * 		return result
 * 	}
 * 	return emitFiles(ctx, p, options, false)
 * }
 */
export function Program_Emit(receiver, ctx, options) {
    Program_panicIfNoProgram(receiver, "Emit");
    let result;
    if (Tristate_IsTrue(receiver.snapshot.options.NoEmit)) {
        result = { EmitSkipped: true, Diagnostics: [], EmittedFiles: [], SourceMaps: [] };
    }
    else {
        result = HandleNoEmitOnError(ctx, Program_as_compiler_ProgramLike(receiver), options.TargetSourceFile);
        if (ctx.Err() !== undefined) {
            return undefined;
        }
    }
    if (result !== undefined) {
        if (options.TargetSourceFile !== undefined) {
            return result;
        }
        const buildInfoResult = Program_emitBuildInfo(receiver, ctx, options);
        if (buildInfoResult !== undefined) {
            result.Diagnostics = [...result.Diagnostics, ...buildInfoResult.Diagnostics];
            result.EmittedFiles = [...result.EmittedFiles, ...buildInfoResult.EmittedFiles];
        }
        return result;
    }
    return emitFiles(ctx, receiver, options, false);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.collectSemanticDiagnosticsOfAffectedFiles","kind":"method","status":"implemented","sigHash":"24dde125d5bc81ba4b1b25cd95753bfb14f6dd913efaf8bfb80555e52a5867fe","bodyHash":"2c9bba5a346dc8480e49b4ed84a936cb17338cae7252063c1b8d40094c25bf27"}
 *
 * Go source:
 * func (p *Program) collectSemanticDiagnosticsOfAffectedFiles(ctx context.Context, file *ast.SourceFile) {
 * 	if p.snapshot.canUseIncrementalState() {
 * 		// Get all affected files
 * 		collectAllAffectedFiles(ctx, p)
 * 		if ctx.Err() != nil {
 * 			return
 * 		}
 *
 * 		if p.snapshot.semanticDiagnosticsPerFile.Size() == len(p.program.GetSourceFiles()) {
 * 			// If we have all the files,
 * 			return
 * 		}
 * 	}
 *
 * 	var affectedFiles []*ast.SourceFile
 * 	if file != nil {
 * 		_, ok := p.snapshot.semanticDiagnosticsPerFile.Load(file.Path())
 * 		if ok {
 * 			return
 * 		}
 * 		affectedFiles = []*ast.SourceFile{file}
 * 	} else {
 * 		for _, file := range p.program.GetSourceFiles() {
 * 			if _, ok := p.snapshot.semanticDiagnosticsPerFile.Load(file.Path()); !ok {
 * 				affectedFiles = append(affectedFiles, file)
 * 			}
 * 		}
 * 	}
 *
 * 	// Get their diagnostics and cache them
 * 	diagnosticsPerFile := p.program.GetSemanticDiagnosticsWithoutNoEmitFiltering(ctx, affectedFiles)
 * 	// commit changes if no err
 * 	if ctx.Err() != nil {
 * 		return
 * 	}
 *
 * 	// Commit changes to snapshot
 * 	for file, diagnostics := range diagnosticsPerFile {
 * 		p.snapshot.semanticDiagnosticsPerFile.Store(file.Path(), &DiagnosticsOrBuildInfoDiagnosticsWithFileName{diagnostics: diagnostics})
 * 	}
 * 	if p.snapshot.semanticDiagnosticsPerFile.Size() == len(p.program.GetSourceFiles()) && p.snapshot.checkPending && !p.snapshot.options.NoCheck.IsTrue() {
 * 		p.snapshot.checkPending = false
 * 	}
 * 	p.snapshot.buildInfoEmitPending.Store(true)
 * }
 */
export function Program_collectSemanticDiagnosticsOfAffectedFiles(receiver, ctx, file) {
    if (snapshot_canUseIncrementalState(receiver.snapshot)) {
        collectAllAffectedFiles(ctx, receiver);
        if (ctx.Err() !== undefined) {
            return;
        }
        if (SyncMap_Size(receiver.snapshot.semanticDiagnosticsPerFile) === compiler_Program_GetSourceFiles(receiver.program).length) {
            return;
        }
    }
    const affectedFiles = [];
    if (file !== undefined) {
        const [, ok] = SyncMap_Load(receiver.snapshot.semanticDiagnosticsPerFile, SourceFile_Path(file));
        if (ok) {
            return;
        }
        affectedFiles.push(file);
    }
    else {
        for (const f of compiler_Program_GetSourceFiles(receiver.program)) {
            const [, ok] = SyncMap_Load(receiver.snapshot.semanticDiagnosticsPerFile, SourceFile_Path(f));
            if (!ok) {
                affectedFiles.push(f);
            }
        }
    }
    const diagnosticsPerFile = compiler_Program_GetSemanticDiagnosticsWithoutNoEmitFiltering(receiver.program, ctx, affectedFiles);
    if (ctx.Err() !== undefined) {
        return;
    }
    for (const [f, diagnostics] of diagnosticsPerFile) {
        SyncMap_Store(receiver.snapshot.semanticDiagnosticsPerFile, SourceFile_Path(f), { diagnostics: diagnostics, buildInfoDiagnostics: [] });
    }
    if (SyncMap_Size(receiver.snapshot.semanticDiagnosticsPerFile) === compiler_Program_GetSourceFiles(receiver.program).length && receiver.snapshot.checkPending && !Tristate_IsTrue(receiver.snapshot.options.NoCheck)) {
        receiver.snapshot.checkPending = false;
    }
    receiver.snapshot.buildInfoEmitPending.Store(true);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.emitBuildInfo","kind":"method","status":"implemented","sigHash":"f6a17a544bb3aa967d2400e4640cb2c328d9c81d195174b3b50ed8af91992f54","bodyHash":"599e8bf3f9582998f7b0dd1198ba5f05531d29e8763fe0f5d2ed12a093586a08"}
 *
 * Go source:
 * func (p *Program) emitBuildInfo(ctx context.Context, options compiler.EmitOptions) *compiler.EmitResult {
 * 	if tr := p.program.Tracing(); tr != nil {
 * 		defer tr.Push(tracing.PhaseEmit, "emitBuildInfo", nil, true)()
 * 	}
 * 	buildInfoFileName := outputpaths.GetBuildInfoFileName(p.snapshot.options, tspath.ComparePathsOptions{
 * 		CurrentDirectory:          p.program.GetCurrentDirectory(),
 * 		UseCaseSensitiveFileNames: p.program.UseCaseSensitiveFileNames(),
 * 	})
 * 	if buildInfoFileName == "" || p.program.IsEmitBlocked(buildInfoFileName) {
 * 		return nil
 * 	}
 * 	if p.snapshot.hasErrors == core.TSUnknown {
 * 		p.ensureHasErrorsForState(ctx, p.program)
 * 		if p.snapshot.hasErrors != p.snapshot.hasErrorsFromOldState || p.snapshot.hasSemanticErrors != p.snapshot.hasSemanticErrorsFromOldState {
 * 			p.snapshot.buildInfoEmitPending.Store(true)
 * 		}
 * 	}
 * 	if !p.snapshot.buildInfoEmitPending.Load() {
 * 		return nil
 * 	}
 * 	if ctx.Err() != nil {
 * 		return nil
 * 	}
 * 	buildInfo := snapshotToBuildInfo(p.snapshot, p.program, buildInfoFileName)
 * 	text, err := json.Marshal(buildInfo)
 * 	if err != nil {
 * 		panic(fmt.Sprintf("Failed to marshal build info: %v", err))
 * 	}
 * 	if options.WriteFile != nil {
 * 		err = options.WriteFile(buildInfoFileName, string(text), &compiler.WriteFileData{
 * 			BuildInfo: buildInfo,
 * 		})
 * 	} else {
 * 		err = p.program.Host().FS().WriteFile(buildInfoFileName, string(text))
 * 	}
 * 	if err != nil {
 * 		return &compiler.EmitResult{
 * 			EmitSkipped: true,
 * 			Diagnostics: []*ast.Diagnostic{
 * 				ast.NewCompilerDiagnostic(diagnostics.Could_not_write_file_0_Colon_1, buildInfoFileName, err.Error()),
 * 			},
 * 		}
 * 	}
 * 	p.snapshot.buildInfoEmitPending.Store(false)
 * 	return &compiler.EmitResult{
 * 		EmitSkipped:  false,
 * 		EmittedFiles: []string{buildInfoFileName},
 * 	}
 * }
 */
export function Program_emitBuildInfo(receiver, ctx, options) {
    // Tracing: omit defer tr.Push (single-threaded, no goroutine cleanup needed)
    const buildInfoFileName = GetBuildInfoFileName(receiver.snapshot.options, {
        CurrentDirectory: compiler_Program_GetCurrentDirectory(receiver.program),
        UseCaseSensitiveFileNames: compiler_Program_UseCaseSensitiveFileNames(receiver.program),
    });
    if (buildInfoFileName === "" || compiler_Program_IsEmitBlocked(receiver.program, buildInfoFileName)) {
        return undefined;
    }
    if (receiver.snapshot.hasErrors === TSUnknown) {
        Program_ensureHasErrorsForState(receiver, ctx, receiver.program);
        if (receiver.snapshot.hasErrors !== receiver.snapshot.hasErrorsFromOldState || receiver.snapshot.hasSemanticErrors !== receiver.snapshot.hasSemanticErrorsFromOldState) {
            receiver.snapshot.buildInfoEmitPending.Store(true);
        }
    }
    if (!receiver.snapshot.buildInfoEmitPending.Load()) {
        return undefined;
    }
    if (ctx.Err() !== undefined) {
        return undefined;
    }
    const buildInfo = snapshotToBuildInfo(receiver.snapshot, receiver.program, buildInfoFileName);
    const text = JSON.stringify(buildInfo);
    let err;
    if (options.WriteFile !== undefined) {
        err = options.WriteFile(buildInfoFileName, text, { BuildInfo: buildInfo });
    }
    else {
        err = compiler_Program_Host(receiver.program).FS().WriteFile(buildInfoFileName, text);
    }
    if (err !== undefined) {
        return {
            EmitSkipped: true,
            Diagnostics: [],
            EmittedFiles: [],
            SourceMaps: [],
        };
    }
    receiver.snapshot.buildInfoEmitPending.Store(false);
    return {
        EmitSkipped: false,
        Diagnostics: [],
        EmittedFiles: [buildInfoFileName],
        SourceMaps: [],
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/program.go::method::Program.ensureHasErrorsForState","kind":"method","status":"implemented","sigHash":"4b1fffdcb3ef43b93832dc5cc2975492891e15427656da357f84ba13c28f4923","bodyHash":"d0950e067ed06f3f72e3f1607a7f2f9bbf5c2490be3018f9c442a745b3a665da"}
 *
 * Go source:
 * func (p *Program) ensureHasErrorsForState(ctx context.Context, program *compiler.Program) {
 * 	var hasIncludeProcessingDiagnostics func() bool
 * 	var hasEmitDiagnostics bool
 * 	if p.snapshot.canUseIncrementalState() {
 * 		if slices.ContainsFunc(program.GetSourceFiles(), func(file *ast.SourceFile) bool {
 * 			if _, ok := p.snapshot.emitDiagnosticsPerFile.Load(file.Path()); ok {
 * 				// emit diagnostics will be encoded in buildInfo;
 * 				return true
 * 			}
 * 			if hasIncludeProcessingDiagnostics == nil && len(p.program.GetIncludeProcessorDiagnostics(file)) > 0 {
 * 				hasIncludeProcessingDiagnostics = func() bool { return true }
 * 			}
 * 			return false
 * 		}) {
 * 			hasEmitDiagnostics = true
 * 		}
 * 		if hasIncludeProcessingDiagnostics == nil {
 * 			hasIncludeProcessingDiagnostics = func() bool { return false }
 * 		}
 * 	} else {
 * 		hasEmitDiagnostics = p.snapshot.hasEmitDiagnostics
 * 		hasIncludeProcessingDiagnostics = func() bool {
 * 			return slices.ContainsFunc(program.GetSourceFiles(), func(file *ast.SourceFile) bool {
 * 				return len(p.program.GetIncludeProcessorDiagnostics(file)) > 0
 * 			})
 * 		}
 * 	}
 *
 * 	if hasEmitDiagnostics {
 * 		// Record this for only non incremental build info
 * 		p.snapshot.hasErrors = core.IfElse(p.snapshot.options.IsIncremental(), core.TSFalse, core.TSTrue)
 * 		// Dont need to encode semantic errors state since the emit diagnostics are encoded
 * 		p.snapshot.hasSemanticErrors = false
 * 		return
 * 	}
 *
 * 	if hasIncludeProcessingDiagnostics() ||
 * 		len(program.GetConfigFileParsingDiagnostics()) > 0 ||
 * 		len(program.GetSyntacticDiagnostics(ctx, nil)) > 0 ||
 * 		len(program.GetProgramDiagnostics()) > 0 ||
 * 		len(program.GetGlobalDiagnostics(ctx)) > 0 {
 * 		p.snapshot.hasErrors = core.TSTrue
 * 		// Dont need to encode semantic errors state since the syntax and program diagnostics are encoded as present
 * 		p.snapshot.hasSemanticErrors = false
 * 		return
 * 	}
 *
 * 	p.snapshot.hasErrors = core.TSFalse
 * 	// Check semantic and emit diagnostics first as we dont need to ask program about it
 * 	if slices.ContainsFunc(program.GetSourceFiles(), func(file *ast.SourceFile) bool {
 * 		semanticDiagnostics, ok := p.snapshot.semanticDiagnosticsPerFile.Load(file.Path())
 * 		if !ok {
 * 			// Missing semantic diagnostics in cache will be encoded in incremental buildInfo
 * 			return p.snapshot.options.IsIncremental()
 * 		}
 * 		if len(semanticDiagnostics.diagnostics) > 0 || len(semanticDiagnostics.buildInfoDiagnostics) > 0 {
 * 			// cached semantic diagnostics will be encoded in buildInfo
 * 			return true
 * 		}
 * 		return false
 * 	}) {
 * 		// Because semantic diagnostics are recorded in buildInfo, we dont need to encode hasErrors in incremental buildInfo
 * 		// But encode as errors in non incremental buildInfo
 * 		p.snapshot.hasSemanticErrors = !p.snapshot.options.IsIncremental()
 * 	}
 * }
 */
export function Program_ensureHasErrorsForState(receiver, ctx, program) {
    let hasIncludeProcessingDiagnostics;
    let hasEmitDiagnostics = false;
    if (snapshot_canUseIncrementalState(receiver.snapshot)) {
        const sourceFiles = compiler_Program_GetSourceFiles(program);
        for (const file of sourceFiles) {
            const [, ok] = SyncMap_Load(receiver.snapshot.emitDiagnosticsPerFile, SourceFile_Path(file));
            if (ok) {
                hasEmitDiagnostics = true;
                break;
            }
            if (hasIncludeProcessingDiagnostics === undefined && (compiler_Program_GetIncludeProcessorDiagnostics(receiver.program, file) ?? []).length > 0) {
                hasIncludeProcessingDiagnostics = () => true;
            }
        }
        if (hasIncludeProcessingDiagnostics === undefined) {
            hasIncludeProcessingDiagnostics = () => false;
        }
    }
    else {
        hasEmitDiagnostics = receiver.snapshot.hasEmitDiagnostics;
        hasIncludeProcessingDiagnostics = () => {
            return compiler_Program_GetSourceFiles(program).some((file) => (compiler_Program_GetIncludeProcessorDiagnostics(receiver.program, file) ?? []).length > 0);
        };
    }
    if (hasEmitDiagnostics) {
        receiver.snapshot.hasErrors = IfElse(CompilerOptions_IsIncremental(receiver.snapshot.options), TSFalse, TSTrue);
        receiver.snapshot.hasSemanticErrors = false;
        return;
    }
    if (hasIncludeProcessingDiagnostics() ||
        compiler_Program_GetConfigFileParsingDiagnostics(program).length > 0 ||
        compiler_Program_GetSyntacticDiagnostics(program, ctx, undefined).length > 0 ||
        compiler_Program_GetProgramDiagnostics(program).length > 0 ||
        compiler_Program_GetGlobalDiagnostics(program, ctx).length > 0) {
        receiver.snapshot.hasErrors = TSTrue;
        receiver.snapshot.hasSemanticErrors = false;
        return;
    }
    receiver.snapshot.hasErrors = TSFalse;
    const hasSemanticErrors = compiler_Program_GetSourceFiles(program).some((file) => {
        const [semanticDiagnostics, ok] = SyncMap_Load(receiver.snapshot.semanticDiagnosticsPerFile, SourceFile_Path(file));
        if (!ok) {
            return CompilerOptions_IsIncremental(receiver.snapshot.options);
        }
        if (semanticDiagnostics.diagnostics.length > 0 || semanticDiagnostics.buildInfoDiagnostics.length > 0) {
            return true;
        }
        return false;
    });
    if (hasSemanticErrors) {
        receiver.snapshot.hasSemanticErrors = !CompilerOptions_IsIncremental(receiver.snapshot.options);
    }
}
//# sourceMappingURL=program.js.map
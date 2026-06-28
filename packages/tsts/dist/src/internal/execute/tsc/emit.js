import { Background } from "../../../go/context.js";
import { Fprint, Fprintln } from "../../../go/fmt.js";
import { GetDiagnosticsOfAnyProgram, Program_ExplainFiles, Program_GetCurrentDirectory, Program_GetSourceFiles, Program_Options, SortAndDeduplicateDiagnostics, } from "../../compiler/program.js";
import { Message_Localize } from "../../diagnostics/diagnostics.js";
import { Tracing_Push } from "../../tracing/tracing.js";
import { PhaseBind, PhaseCheck } from "../../tracing/tracing.js";
import { ParsedCommandLine_CompilerOptions, ParsedCommandLine_Locale } from "../../tsoptions/parsedcommandline.js";
import { GetNormalizedAbsolutePath } from "../../tspath/path.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { SourceFile_FileName } from "../../ast/ast.js";
import { ExitStatusDiagnosticsPresent_OutputsGenerated, ExitStatusDiagnosticsPresent_OutputsSkipped, ExitStatusSuccess } from "./compile.js";
import { statisticsFromProgram, Statistics_Report } from "./statistics.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/emit.go::func::GetTraceWithWriterFromSys","kind":"func","status":"implemented","sigHash":"17a6384118d8903f7afa1b67bba22dbd81d93ed58d4f8ce909a645b6a1202124","bodyHash":"76b0ac1f82c5140960e3030c49fb947d1cfb8ec5538145aa47b05d3011859c09"}
 *
 * Go source:
 * func GetTraceWithWriterFromSys(w io.Writer, locale locale.Locale, testing CommandLineTesting) func(msg *diagnostics.Message, args ...any) {
 * 	if testing == nil {
 * 		return func(msg *diagnostics.Message, args ...any) {
 * 			fmt.Fprintln(w, msg.Localize(locale, args...))
 * 		}
 * 	} else {
 * 		return testing.GetTrace(w, locale)
 * 	}
 * }
 */
export function GetTraceWithWriterFromSys(w, locale, testing) {
    if (testing === undefined) {
        return (msg, ...args) => {
            Fprintln(w, Message_Localize(msg, locale, ...args));
        };
    }
    else {
        return testing.GetTrace(w, locale);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/emit.go::func::EmitAndReportStatistics","kind":"func","status":"implemented","sigHash":"0b6652d302c0ecd13cc0e43a0892d4fe5e1af322263827515001ca00f9320be2","bodyHash":"6942f5466c22b3dee2dfc58f230f798a08fba0f3e3187ba534b77c3a103ee9d8"}
 *
 * Go source:
 * func EmitAndReportStatistics(input EmitInput) (CompileAndEmitResult, *Statistics) {
 * 	var statistics *Statistics
 * 	result := EmitFilesAndReportErrors(input)
 * 	if result.Status != ExitStatusSuccess {
 * 		// compile exited early
 * 		return result, nil
 * 	}
 * 	result.times.totalTime = input.Sys.SinceStart()
 *
 * 	if input.Config.CompilerOptions().Diagnostics.IsTrue() || input.Config.CompilerOptions().ExtendedDiagnostics.IsTrue() {
 * 		var memStats runtime.MemStats
 * 		// GC must be called twice to allow things to settle.
 * 		runtime.GC()
 * 		runtime.GC()
 * 		runtime.ReadMemStats(&memStats)
 *
 * 		statistics = statisticsFromProgram(input, &memStats)
 * 		statistics.Report(input.Writer, input.Testing)
 * 	}
 *
 * 	if result.EmitResult.EmitSkipped && len(result.Diagnostics) > 0 {
 * 		result.Status = ExitStatusDiagnosticsPresent_OutputsSkipped
 * 	} else if len(result.Diagnostics) > 0 {
 * 		result.Status = ExitStatusDiagnosticsPresent_OutputsGenerated
 * 	}
 * 	return result, statistics
 * }
 */
export function EmitAndReportStatistics(input) {
    let statistics = undefined;
    let result = EmitFilesAndReportErrors(input);
    if (result.Status !== ExitStatusSuccess) {
        return [result, undefined];
    }
    result = { ...result, times: { ...result.times, totalTime: input.Sys.SinceStart() } };
    const options = ParsedCommandLine_CompilerOptions(input.Config);
    if (Tristate_IsTrue(options.Diagnostics) || Tristate_IsTrue(options.ExtendedDiagnostics)) {
        const memStats = {};
        // Note: runtime.GC() and runtime.ReadMemStats() are Go runtime facades not available in TS.
        statistics = statisticsFromProgram(input, memStats);
        Statistics_Report(statistics, input.Writer, input.Testing);
    }
    let finalResult = result;
    if (result.EmitResult.EmitSkipped && result.Diagnostics.length > 0) {
        finalResult = { ...result, Status: ExitStatusDiagnosticsPresent_OutputsSkipped };
    }
    else if (result.Diagnostics.length > 0) {
        finalResult = { ...result, Status: ExitStatusDiagnosticsPresent_OutputsGenerated };
    }
    return [finalResult, statistics];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/emit.go::func::EmitFilesAndReportErrors","kind":"func","status":"implemented","sigHash":"12d76c9302d5e22db5dd76c803b8d9282528114327cfa745a89986a7067f9559","bodyHash":"6d90ae6ffaff1722e0a0fb6244dfeeba85fd98688819688ff62470c0bc3c1490"}
 *
 * Go source:
 * func EmitFilesAndReportErrors(input EmitInput) (result CompileAndEmitResult) {
 * 	result.times = input.CompileTimes
 * 	ctx := context.Background()
 *
 * 	allDiagnostics := compiler.GetDiagnosticsOfAnyProgram(
 * 		ctx,
 * 		input.ProgramLike,
 * 		nil,
 * 		false,
 * 		func(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 			// Options diagnostics include global diagnostics (even though we collect them separately),
 * 			// and global diagnostics create checkers, which then bind all of the files. Do this binding
 * 			// early so we can track the time.
 * 			if tr := input.Tracing; tr != nil {
 * 				defer tr.Push(tracing.PhaseBind, "bindSourceFiles", nil, true)()
 * 			}
 * 			bindStart := input.Sys.Now()
 * 			diags := input.ProgramLike.GetBindDiagnostics(ctx, file)
 * 			result.times.bindTime = input.Sys.Now().Sub(bindStart)
 * 			return diags
 * 		},
 * 		func(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 			if tr := input.Tracing; tr != nil {
 * 				defer tr.Push(tracing.PhaseCheck, "checkSourceFiles", nil, true)()
 * 			}
 * 			checkStart := input.Sys.Now()
 * 			diags := input.ProgramLike.GetSemanticDiagnostics(ctx, file)
 * 			result.times.checkTime = input.Sys.Now().Sub(checkStart)
 * 			return diags
 * 		},
 * 	)
 *
 * 	emitResult := &compiler.EmitResult{EmitSkipped: true, Diagnostics: []*ast.Diagnostic{}}
 * 	if !input.ProgramLike.Options().ListFilesOnly.IsTrue() {
 * 		emitStart := input.Sys.Now()
 * 		emitResult = input.ProgramLike.Emit(ctx, compiler.EmitOptions{
 * 			WriteFile: input.WriteFile,
 * 		})
 * 		result.times.emitTime = input.Sys.Now().Sub(emitStart)
 * 	}
 * 	if emitResult != nil {
 * 		allDiagnostics = append(allDiagnostics, emitResult.Diagnostics...)
 * 	}
 * 	if input.Testing != nil {
 * 		input.Testing.OnEmittedFiles(emitResult, input.TestingMTimesCache)
 * 	}
 *
 * 	allDiagnostics = compiler.SortAndDeduplicateDiagnostics(allDiagnostics)
 * 	for _, diagnostic := range allDiagnostics {
 * 		input.ReportDiagnostic(diagnostic)
 * 	}
 *
 * 	listFiles(input, emitResult)
 *
 * 	input.ReportErrorSummary(allDiagnostics)
 * 	result.Diagnostics = allDiagnostics
 * 	result.EmitResult = emitResult
 * 	result.Status = ExitStatusSuccess
 * 	return result
 * }
 */
export function EmitFilesAndReportErrors(input) {
    const result = {
        Diagnostics: [],
        EmitResult: undefined,
        Status: ExitStatusSuccess,
        times: input.CompileTimes,
    };
    const ctx = Background();
    let allDiagnostics = GetDiagnosticsOfAnyProgram(ctx, input.ProgramLike, undefined, false, (innerCtx, file) => {
        // Options diagnostics include global diagnostics (even though we collect them separately),
        // and global diagnostics create checkers, which then bind all of the files. Do this binding
        // early so we can track the time.
        let pop;
        if (input.Tracing !== undefined) {
            pop = Tracing_Push(input.Tracing, PhaseBind, "bindSourceFiles", undefined, true);
        }
        const bindStart = input.Sys.Now();
        const diags = input.ProgramLike.GetBindDiagnostics(innerCtx, file);
        result.times.bindTime = input.Sys.Now().Sub(bindStart);
        if (pop !== undefined) {
            pop();
        }
        return diags;
    }, (innerCtx, file) => {
        let pop;
        if (input.Tracing !== undefined) {
            pop = Tracing_Push(input.Tracing, PhaseCheck, "checkSourceFiles", undefined, true);
        }
        const checkStart = input.Sys.Now();
        const diags = input.ProgramLike.GetSemanticDiagnostics(innerCtx, file);
        result.times.checkTime = input.Sys.Now().Sub(checkStart);
        if (pop !== undefined) {
            pop();
        }
        return diags;
    });
    let emitResult = { EmitSkipped: true, Diagnostics: [], EmittedFiles: [], SourceMaps: [] };
    if (!Tristate_IsTrue(input.ProgramLike.Options().ListFilesOnly)) {
        const emitStart = input.Sys.Now();
        emitResult = input.ProgramLike.Emit(ctx, { TargetSourceFile: undefined, EmitOnly: 0, WriteFile: input.WriteFile });
        result.times.emitTime = input.Sys.Now().Sub(emitStart);
    }
    if (emitResult !== undefined) {
        allDiagnostics = [...allDiagnostics, ...emitResult.Diagnostics];
    }
    if (input.Testing !== undefined) {
        input.Testing.OnEmittedFiles(emitResult, input.TestingMTimesCache);
    }
    allDiagnostics = SortAndDeduplicateDiagnostics(allDiagnostics);
    for (const diagnostic of allDiagnostics) {
        input.ReportDiagnostic(diagnostic);
    }
    listFiles(input, emitResult);
    input.ReportErrorSummary(allDiagnostics);
    return { ...result, Diagnostics: allDiagnostics, EmitResult: emitResult, Status: ExitStatusSuccess };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/emit.go::func::listFiles","kind":"func","status":"implemented","sigHash":"c1f5f67217ce85c6c591d40b9ac34c43184044573f9c9b4a988d0f9bcaa411fc","bodyHash":"56b9fcccc04558ed5ee238c6254c1064e649b5471a5c0fcbe2e5b115f88cbc63"}
 *
 * Go source:
 * func listFiles(input EmitInput, emitResult *compiler.EmitResult) {
 * 	if input.Testing != nil {
 * 		input.Testing.OnListFilesStart(input.Writer)
 * 		defer input.Testing.OnListFilesEnd(input.Writer)
 * 	}
 * 	options := input.Program.Options()
 * 	if options.ListEmittedFiles.IsTrue() {
 * 		for _, file := range emitResult.EmittedFiles {
 * 			fmt.Fprintln(input.Writer, "TSFILE: ", tspath.GetNormalizedAbsolutePath(file, input.Program.GetCurrentDirectory()))
 * 		}
 * 	}
 * 	if options.ExplainFiles.IsTrue() {
 * 		input.Program.ExplainFiles(input.Writer, input.Config.Locale())
 * 	} else if options.ListFiles.IsTrue() || options.ListFilesOnly.IsTrue() {
 * 		for _, file := range input.Program.GetSourceFiles() {
 * 			fmt.Fprintln(input.Writer, file.FileName())
 * 		}
 * 	}
 * }
 */
export function listFiles(input, emitResult) {
    if (input.Testing !== undefined) {
        input.Testing.OnListFilesStart(input.Writer);
    }
    try {
        const options = Program_Options(input.Program);
        if (Tristate_IsTrue(options.ListEmittedFiles)) {
            for (const file of emitResult.EmittedFiles) {
                Fprintln(input.Writer, "TSFILE: ", GetNormalizedAbsolutePath(file, Program_GetCurrentDirectory(input.Program)));
            }
        }
        if (Tristate_IsTrue(options.ExplainFiles)) {
            Program_ExplainFiles(input.Program, input.Writer, ParsedCommandLine_Locale(input.Config));
        }
        else if (Tristate_IsTrue(options.ListFiles) || Tristate_IsTrue(options.ListFilesOnly)) {
            for (const file of Program_GetSourceFiles(input.Program)) {
                Fprintln(input.Writer, SourceFile_FileName(file));
            }
        }
    }
    finally {
        if (input.Testing !== undefined) {
            input.Testing.OnListFilesEnd(input.Writer);
        }
    }
}
//# sourceMappingURL=emit.js.map
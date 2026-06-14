import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Locale } from "../locale/locale.js";
import type { Tracing } from "../tracing/tracing.js";
import type { ParsedBuildCommandLine } from "../tsoptions/parsedbuildcommandline.js";
import type { ParsedCommandLine } from "../tsoptions/parsedcommandline.js";
import { type ExtendedConfigCache } from "./tsc/extendedconfigcache.js";
import type { CommandLineResult, CommandLineTesting, CompileTimes, ExitStatus, System } from "./tsc/compile.js";
import type { DiagnosticReporter, DiagnosticsReporter } from "./tsc/diagnostics.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::startTracingIfNeeded","kind":"func","status":"implemented","sigHash":"42f5eed2c85a5deb3027e6f19fe244c4decd9026a0423e345d4350618fe06017","bodyHash":"5f6e018002e7f04d00870f5ff47c7da112138a4523fe860bc9a0ad20c70a064a"}
 *
 * Go source:
 * func startTracingIfNeeded(sys tsc.System, config *tsoptions.ParsedCommandLine, testing tsc.CommandLineTesting) *tracing.Tracing {
 * 	traceDir := config.CompilerOptions().GenerateTrace
 * 	if traceDir == "" {
 * 		return nil
 * 	}
 * 	configFilePath := ""
 * 	if config.ConfigFile != nil && config.ConfigFile.SourceFile != nil {
 * 		configFilePath = config.ConfigFile.SourceFile.FileName()
 * 	}
 * 	tr, err := tracing.StartTracing(sys.FS(), traceDir, configFilePath, testing != nil)
 * 	if err != nil {
 * 		fmt.Fprintf(sys.Writer(), "Warning: Failed to start tracing: %v\n", err)
 * 	}
 * 	return tr
 * }
 */
export declare function startTracingIfNeeded(sys: System, config: GoPtr<ParsedCommandLine>, testing: CommandLineTesting | undefined): GoPtr<Tracing>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::stopTracing","kind":"func","status":"implemented","sigHash":"a7be03439973a163aed48797f2aa5538cf18b0311c47062c9efe57dc3f67fdc9","bodyHash":"b807c42bacad338d92451f9380bfccf602a36879e7096b7dfe058850304b56a2"}
 *
 * Go source:
 * func stopTracing(sys tsc.System, tr *tracing.Tracing) {
 * 	if tr == nil {
 * 		return
 * 	}
 * 	if err := tr.StopTracing(); err != nil {
 * 		fmt.Fprintf(sys.Writer(), "Warning: Failed to stop tracing: %v\n", err)
 * 	}
 * }
 */
export declare function stopTracing(sys: System, tr: GoPtr<Tracing>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::CommandLine","kind":"func","status":"implemented","sigHash":"5797dcadb4cf7887837174e4a3ba707391da9ac4af4966c7c44f58d4b5c8cd9c","bodyHash":"a166b544e8133a1ff0688af339e26e4e979311679b4fc7152ff9fefae54afa48"}
 *
 * Go source:
 * func CommandLine(sys tsc.System, commandLineArgs []string, testing tsc.CommandLineTesting) tsc.CommandLineResult {
 * 	if len(commandLineArgs) > 0 {
 * 		switch strings.ToLower(commandLineArgs[0]) {
 * 		case "-b", "--b", "-build", "--build":
 * 			return tscBuildCompilation(sys, tsoptions.ParseBuildCommandLine(commandLineArgs, sys), testing)
 * 			// case "-f":
 * 			// 	return fmtMain(sys, commandLineArgs[1], commandLineArgs[1])
 * 		}
 * 	}
 *
 * 	return tscCompilation(sys, tsoptions.ParseCommandLine(commandLineArgs, sys), testing)
 * }
 */
export declare function CommandLine(sys: System, commandLineArgs: GoSlice<string>, testing: CommandLineTesting | undefined): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::fmtMain","kind":"func","status":"implemented","sigHash":"da127cff3293af38cd957b37a51b78581941a59bee0bbd029f7d33fd43104037","bodyHash":"b51a441f80594e1b419fa6072455251dab4311d66e51b0dbe8dc3e84297bb067"}
 *
 * Go source:
 * func fmtMain(sys tsc.System, input, output string) tsc.ExitStatus {
 * 	ctx := format.WithFormatCodeSettings(context.Background(), lsutil.GetDefaultFormatCodeSettings(), "\n")
 * 	input = string(tspath.ToPath(input, sys.GetCurrentDirectory(), sys.FS().UseCaseSensitiveFileNames()))
 * 	output = string(tspath.ToPath(output, sys.GetCurrentDirectory(), sys.FS().UseCaseSensitiveFileNames()))
 * 	fileContent, ok := sys.FS().ReadFile(input)
 * 	if !ok {
 * 		fmt.Fprintln(sys.Writer(), "File not found:", input)
 * 		return tsc.ExitStatusNotImplemented
 * 	}
 * 	text := fileContent
 * 	pathified := tspath.ToPath(input, sys.GetCurrentDirectory(), true)
 * 	sourceFile := parser.ParseSourceFile(ast.SourceFileParseOptions{
 * 		FileName: string(pathified),
 * 		Path:     pathified,
 * 	}, text, core.GetScriptKindFromFileName(string(pathified)))
 * 	edits := format.FormatDocument(ctx, sourceFile)
 * 	newText := core.ApplyBulkEdits(text, edits)
 *
 * 	if err := sys.FS().WriteFile(output, newText); err != nil {
 * 		fmt.Fprintln(sys.Writer(), err.Error())
 * 		return tsc.ExitStatusNotImplemented
 * 	}
 * 	return tsc.ExitStatusSuccess
 * }
 */
export declare function fmtMain(sys: System, input: string, output: string): ExitStatus;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::tscBuildCompilation","kind":"func","status":"implemented","sigHash":"f68645a75c9c070321c836ada363a304ee5283c27b43e1f2a137ddbfc7fa4394","bodyHash":"fff529fcf5bf7956e4f6cceb9c35ce769e63e2d00928fd6a8c5157cc8a7d393e"}
 *
 * Go source:
 * func tscBuildCompilation(sys tsc.System, buildCommand *tsoptions.ParsedBuildCommandLine, testing tsc.CommandLineTesting) tsc.CommandLineResult {
 * 	locale := buildCommand.Locale()
 * 	reportDiagnostic := tsc.CreateDiagnosticReporter(sys, sys.Writer(), locale, buildCommand.CompilerOptions)
 *
 * 	if len(buildCommand.Errors) > 0 {
 * 		for _, err := range buildCommand.Errors {
 * 			reportDiagnostic(err)
 * 		}
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 	}
 *
 * 	if pprofDir := buildCommand.CompilerOptions.PprofDir; pprofDir != "" {
 * 		// !!! stderr?
 * 		profileSession := pprof.BeginProfiling(pprofDir, sys.Writer())
 * 		defer profileSession.Stop()
 * 	}
 *
 * 	if buildCommand.CompilerOptions.Help.IsTrue() {
 * 		tsc.PrintVersion(sys, locale)
 * 		tsc.PrintBuildHelp(sys, locale, tsoptions.BuildOpts)
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess}
 * 	}
 *
 * 	orchestrator := build.NewOrchestrator(build.Options{
 * 		Sys:     sys,
 * 		Command: buildCommand,
 * 		Testing: testing,
 * 	})
 * 	return orchestrator.Start()
 * }
 */
export declare function tscBuildCompilation(sys: System, buildCommand: GoPtr<ParsedBuildCommandLine>, testing: CommandLineTesting | undefined): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::tscCompilation","kind":"func","status":"implemented","sigHash":"722977dd38b813663a6cec00a0d2cb0e0888e26f96b7161d3d2c955916140761","bodyHash":"68b95caca66db42d24329581b03f519352198d6963e10201299ae1937cc3546d"}
 *
 * Go source:
 * func tscCompilation(sys tsc.System, commandLine *tsoptions.ParsedCommandLine, testing tsc.CommandLineTesting) tsc.CommandLineResult {
 * 	configFileName := ""
 * 	locale := commandLine.Locale()
 * 	reportDiagnostic := tsc.CreateDiagnosticReporter(sys, sys.Writer(), locale, commandLine.CompilerOptions())
 *
 * 	if len(commandLine.Errors) > 0 {
 * 		for _, e := range commandLine.Errors {
 * 			reportDiagnostic(e)
 * 		}
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 	}
 *
 * 	if pprofDir := commandLine.CompilerOptions().PprofDir; pprofDir != "" {
 * 		// !!! stderr?
 * 		profileSession := pprof.BeginProfiling(pprofDir, sys.Writer())
 * 		defer profileSession.Stop()
 * 	}
 *
 * 	if commandLine.CompilerOptions().Init.IsTrue() {
 * 		tsc.WriteConfigFile(sys, locale, reportDiagnostic, commandLine.Raw.(*collections.OrderedMap[string, any]))
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess}
 * 	}
 *
 * 	if commandLine.CompilerOptions().Version.IsTrue() {
 * 		tsc.PrintVersion(sys, locale)
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess}
 * 	}
 *
 * 	if commandLine.CompilerOptions().Help.IsTrue() || commandLine.CompilerOptions().All.IsTrue() {
 * 		tsc.PrintHelp(sys, locale, commandLine)
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess}
 * 	}
 *
 * 	if commandLine.CompilerOptions().Watch.IsTrue() && commandLine.CompilerOptions().ListFilesOnly.IsTrue() {
 * 		reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Options_0_and_1_cannot_be_combined, "watch", "listFilesOnly"))
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 	}
 *
 * 	if commandLine.CompilerOptions().Project != "" {
 * 		if len(commandLine.FileNames()) != 0 {
 * 			reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Option_project_cannot_be_mixed_with_source_files_on_a_command_line))
 * 			return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 		}
 *
 * 		fileOrDirectory := tspath.NormalizePath(commandLine.CompilerOptions().Project)
 * 		if sys.FS().DirectoryExists(fileOrDirectory) {
 * 			configFileName = tspath.CombinePaths(fileOrDirectory, "tsconfig.json")
 * 			if !sys.FS().FileExists(configFileName) {
 * 				reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Cannot_find_a_tsconfig_json_file_at_the_current_directory_Colon_0, configFileName))
 * 				return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 			}
 * 		} else {
 * 			configFileName = fileOrDirectory
 * 			if !sys.FS().FileExists(configFileName) {
 * 				reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.The_specified_path_does_not_exist_Colon_0, fileOrDirectory))
 * 				return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 			}
 * 		}
 * 	} else if !commandLine.CompilerOptions().IgnoreConfig.IsTrue() || len(commandLine.FileNames()) == 0 {
 * 		searchPath := tspath.NormalizePath(sys.GetCurrentDirectory())
 * 		configFileName = findConfigFile(searchPath, sys.FS().FileExists, "tsconfig.json")
 * 		if len(commandLine.FileNames()) != 0 {
 * 			if configFileName != "" {
 * 				// Error to not specify config file
 * 				reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.X_tsconfig_json_is_present_but_will_not_be_loaded_if_files_are_specified_on_commandline_Use_ignoreConfig_to_skip_this_error))
 * 				return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 			}
 * 		} else if configFileName == "" {
 * 			if commandLine.CompilerOptions().ShowConfig.IsTrue() {
 * 				reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Cannot_find_a_tsconfig_json_file_at_the_current_directory_Colon_0, tspath.NormalizePath(sys.GetCurrentDirectory())))
 * 			} else {
 * 				tsc.PrintVersion(sys, locale)
 * 				tsc.PrintHelp(sys, locale, commandLine)
 * 			}
 * 			return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsSkipped}
 * 		}
 * 	}
 *
 * 	// !!! convert to options with absolute paths is usually done here, but for ease of implementation, it's done in `tsoptions.ParseCommandLine()`
 * 	compilerOptionsFromCommandLine := commandLine.CompilerOptions()
 * 	configForCompilation := commandLine
 * 	extendedConfigCache := &tsc.ExtendedConfigCache{}
 * 	var compileTimes tsc.CompileTimes
 * 	if configFileName != "" {
 * 		configStart := sys.Now()
 * 		var commandLineRaw *collections.OrderedMap[string, any]
 * 		if raw, ok := commandLine.Raw.(*collections.OrderedMap[string, any]); ok {
 * 			// Wrap command line options in a "compilerOptions" key to match tsconfig.json structure
 * 			wrapped := &collections.OrderedMap[string, any]{}
 * 			wrapped.Set("compilerOptions", raw)
 * 			commandLineRaw = wrapped
 * 		}
 * 		configParseResult, errors := tsoptions.GetParsedCommandLineOfConfigFile(configFileName, compilerOptionsFromCommandLine, commandLineRaw, sys, extendedConfigCache)
 * 		compileTimes.ConfigTime = sys.Now().Sub(configStart)
 * 		if len(errors) != 0 {
 * 			// these are unrecoverable errors--exit to report them as diagnostics
 * 			for _, e := range errors {
 * 				reportDiagnostic(e)
 * 			}
 * 			return tsc.CommandLineResult{Status: tsc.ExitStatusDiagnosticsPresent_OutputsGenerated}
 * 		}
 * 		configForCompilation = configParseResult
 * 		// Updater to reflect pretty
 * 		reportDiagnostic = tsc.CreateDiagnosticReporter(sys, sys.Writer(), locale, commandLine.CompilerOptions())
 * 	}
 *
 * 	reportErrorSummary := tsc.CreateReportErrorSummary(sys, locale, configForCompilation.CompilerOptions())
 * 	if compilerOptionsFromCommandLine.ShowConfig.IsTrue() {
 * 		showConfig(sys, configForCompilation, configFileName)
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess}
 * 	}
 * 	if configForCompilation.CompilerOptions().Watch.IsTrue() {
 * 		watcher := createWatcher(
 * 			sys,
 * 			configForCompilation,
 * 			compilerOptionsFromCommandLine,
 * 			reportDiagnostic,
 * 			reportErrorSummary,
 * 			testing,
 * 		)
 * 		watcher.start()
 * 		return tsc.CommandLineResult{Status: tsc.ExitStatusSuccess, Watcher: watcher}
 * 	} else if configForCompilation.CompilerOptions().IsIncremental() {
 * 		return performIncrementalCompilation(
 * 			sys,
 * 			configForCompilation,
 * 			reportDiagnostic,
 * 			reportErrorSummary,
 * 			extendedConfigCache,
 * 			&compileTimes,
 * 			testing,
 * 		)
 * 	}
 * 	return performCompilation(
 * 		sys,
 * 		configForCompilation,
 * 		reportDiagnostic,
 * 		reportErrorSummary,
 * 		extendedConfigCache,
 * 		&compileTimes,
 * 		testing,
 * 	)
 * }
 */
export declare function tscCompilation(sys: System, commandLine: GoPtr<ParsedCommandLine>, testing: CommandLineTesting | undefined): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::findConfigFile","kind":"func","status":"implemented","sigHash":"d702bbf4bc17ebc59dee27e9e80ab2c611032cf4bd330c93db068c1c72532ebb","bodyHash":"960b9b07852c4d9cc57a187241abf5479aa51424b8d34deb71b9d4d72db2e993"}
 *
 * Go source:
 * func findConfigFile(searchPath string, fileExists func(string) bool, configName string) string {
 * 	result, ok := tspath.ForEachAncestorDirectory(searchPath, func(ancestor string) (string, bool) {
 * 		fullConfigName := tspath.CombinePaths(ancestor, configName)
 * 		if fileExists(fullConfigName) {
 * 			return fullConfigName, true
 * 		}
 * 		return fullConfigName, false
 * 	})
 * 	if !ok {
 * 		return ""
 * 	}
 * 	return result
 * }
 */
export declare function findConfigFile(searchPath: string, fileExists: (arg0: string) => bool, configName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::getTraceFromSys","kind":"func","status":"implemented","sigHash":"26a8b1e54054f27c17d5a0e2a6253c861e66ba3abcc1087307625fa0b57ef2a0","bodyHash":"ae54e619360e678865b25c086b9d9d08cfe7b87d54a02af94635f11027be9c47"}
 *
 * Go source:
 * func getTraceFromSys(sys tsc.System, locale locale.Locale, testing tsc.CommandLineTesting) func(msg *diagnostics.Message, args ...any) {
 * 	return tsc.GetTraceWithWriterFromSys(sys.Writer(), locale, testing)
 * }
 */
export declare function getTraceFromSys(sys: System, locale: Locale, testing: CommandLineTesting | undefined): (msg: GoPtr<Message>, ...args: Array<unknown>) => void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::performIncrementalCompilation","kind":"func","status":"implemented","sigHash":"593fecfb418fefe8150bdab265f8e5c548179753da64fb8eddc983fe9cbc0a80","bodyHash":"b45eb41deaecd915d895adeaaebebae11391118737fd44522cd6e7a311582747"}
 *
 * Go source:
 * func performIncrementalCompilation(
 * 	sys tsc.System,
 * 	config *tsoptions.ParsedCommandLine,
 * 	reportDiagnostic tsc.DiagnosticReporter,
 * 	reportErrorSummary tsc.DiagnosticsReporter,
 * 	extendedConfigCache tsoptions.ExtendedConfigCache,
 * 	compileTimes *tsc.CompileTimes,
 * 	testing tsc.CommandLineTesting,
 * ) tsc.CommandLineResult {
 * 	host := compiler.NewCachedFSCompilerHost(sys.GetCurrentDirectory(), sys.FS(), sys.DefaultLibraryPath(), extendedConfigCache, getTraceFromSys(sys, config.Locale(), testing))
 * 	buildInfoReadStart := sys.Now()
 * 	oldProgram := incremental.ReadBuildInfoProgram(config, incremental.NewBuildInfoReader(host), host)
 * 	compileTimes.BuildInfoReadTime = sys.Now().Sub(buildInfoReadStart)
 *
 * 	tr := startTracingIfNeeded(sys, config, testing)
 *
 * 	parseStart := sys.Now()
 * 	program := compiler.NewProgram(compiler.ProgramOptions{
 * 		Config:  config,
 * 		Host:    host,
 * 		Tracing: tr,
 * 	})
 * 	compileTimes.ParseTime = sys.Now().Sub(parseStart)
 * 	changesComputeStart := sys.Now()
 * 	incrementalProgram := incremental.NewProgram(program, oldProgram, incremental.CreateHost(host), testing != nil)
 * 	compileTimes.ChangesComputeTime = sys.Now().Sub(changesComputeStart)
 * 	result, _ := tsc.EmitAndReportStatistics(tsc.EmitInput{
 * 		Sys:                sys,
 * 		ProgramLike:        incrementalProgram,
 * 		Program:            incrementalProgram.GetProgram(),
 * 		Config:             config,
 * 		ReportDiagnostic:   reportDiagnostic,
 * 		ReportErrorSummary: reportErrorSummary,
 * 		Writer:             sys.Writer(),
 * 		CompileTimes:       compileTimes,
 * 		Testing:            testing,
 * 		Tracing:            tr,
 * 	})
 *
 * 	stopTracing(sys, tr)
 *
 * 	if testing != nil {
 * 		testing.OnProgram(incrementalProgram)
 * 	}
 * 	return tsc.CommandLineResult{
 * 		Status: result.Status,
 * 	}
 * }
 */
export declare function performIncrementalCompilation(sys: System, config: GoPtr<ParsedCommandLine>, reportDiagnostic: DiagnosticReporter, reportErrorSummary: DiagnosticsReporter, extendedConfigCache: ExtendedConfigCache, compileTimes: GoPtr<CompileTimes>, testing: CommandLineTesting | undefined): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::performCompilation","kind":"func","status":"implemented","sigHash":"91ae4296a5aaa288af685711d362d69a8ec00b7260539386ac2d6200ad207606","bodyHash":"9cef4b345235762cc8a66e2ddfd26baf4de775fe6521044f12a6e812b88e95d4"}
 *
 * Go source:
 * func performCompilation(
 * 	sys tsc.System,
 * 	config *tsoptions.ParsedCommandLine,
 * 	reportDiagnostic tsc.DiagnosticReporter,
 * 	reportErrorSummary tsc.DiagnosticsReporter,
 * 	extendedConfigCache tsoptions.ExtendedConfigCache,
 * 	compileTimes *tsc.CompileTimes,
 * 	testing tsc.CommandLineTesting,
 * ) tsc.CommandLineResult {
 * 	host := compiler.NewCachedFSCompilerHost(sys.GetCurrentDirectory(), sys.FS(), sys.DefaultLibraryPath(), extendedConfigCache, getTraceFromSys(sys, config.Locale(), testing))
 *
 * 	tr := startTracingIfNeeded(sys, config, testing)
 *
 * 	parseStart := sys.Now()
 * 	program := compiler.NewProgram(compiler.ProgramOptions{
 * 		Config:  config,
 * 		Host:    host,
 * 		Tracing: tr,
 * 	})
 * 	compileTimes.ParseTime = sys.Now().Sub(parseStart)
 * 	result, _ := tsc.EmitAndReportStatistics(tsc.EmitInput{
 * 		Sys:                sys,
 * 		ProgramLike:        program,
 * 		Program:            program,
 * 		Config:             config,
 * 		ReportDiagnostic:   reportDiagnostic,
 * 		ReportErrorSummary: reportErrorSummary,
 * 		Writer:             sys.Writer(),
 * 		CompileTimes:       compileTimes,
 * 		Testing:            testing,
 * 		Tracing:            tr,
 * 	})
 *
 * 	stopTracing(sys, tr)
 *
 * 	return tsc.CommandLineResult{
 * 		Status: result.Status,
 * 	}
 * }
 */
export declare function performCompilation(sys: System, config: GoPtr<ParsedCommandLine>, reportDiagnostic: DiagnosticReporter, reportErrorSummary: DiagnosticsReporter, extendedConfigCache: ExtendedConfigCache, compileTimes: GoPtr<CompileTimes>, testing: CommandLineTesting | undefined): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc.go::func::showConfig","kind":"func","status":"implemented","sigHash":"fb31fc22d8a290c2c2e43d2f600b70396b98e43b992e9f6c4b247f9a204035b4","bodyHash":"24a2edb0efd5abdc7a5461dc8d3e8b39e5957f44e4f25935b792dcefb383172d"}
 *
 * Go source:
 * func showConfig(sys tsc.System, config *tsoptions.ParsedCommandLine, configFileName string) {
 * 	tsConfig := tsoptions.ConvertToTSConfig(config, configFileName)
 * 	_ = json.MarshalIndentWrite(sys.Writer(), tsConfig, "", "    ")
 * }
 */
export declare function showConfig(sys: System, config: GoPtr<ParsedCommandLine>, configFileName: string): void;
//# sourceMappingURL=tsc.d.ts.map
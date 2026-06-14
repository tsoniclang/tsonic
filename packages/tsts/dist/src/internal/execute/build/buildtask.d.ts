import type { bool, int, uint } from "@tsonic/core/types.js";
import type { GoChan, GoError, GoPtr, GoSlice } from "../../../go/compat.js";
import { Builder } from "../../../go/strings.js";
import type { Mutex } from "../../../go/sync.js";
import type { Bool } from "../../../go/sync/atomic.js";
import type { Time } from "../../../go/time.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Set } from "../../collections/set.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { WriteFileData } from "../../compiler/program.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import type { Path } from "../../tspath/path.js";
import type { BuildInfo } from "../incremental/buildInfo.js";
import type { Program } from "../incremental/program.js";
import type { ExitStatus } from "../tsc/compile.js";
import type { DiagnosticReporter } from "../tsc/diagnostics.js";
import type { Statistics } from "../tsc/statistics.js";
import type { Orchestrator, orchestratorResult } from "./orchestrator.js";
import type { upToDateStatus } from "./uptodatestatus.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::updateKind","kind":"type","status":"implemented","sigHash":"8c03b00054d12667434aa9865344ed51a963464cc953ccc045330af752ae7f64","bodyHash":"bb679ff4d632cbca47e250b78139b0d261ac5dea6fb7c63c797f9312068c508b"}
 *
 * Go source:
 * updateKind uint
 */
export type updateKind = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::constGroup::updateKindNone+updateKindConfig+updateKindUpdate","kind":"constGroup","status":"implemented","sigHash":"a5d457b54660f38232795bb983bd57b5b7bce14a61e2f316ad6620ba2b1c262b","bodyHash":"f9a76f53f60a0171cc2dbed0d17a54adc9febffb0980c99c093963bd61577c0c"}
 *
 * Go source:
 * const (
 * 	updateKindNone updateKind = iota
 * 	updateKindConfig
 * 	updateKindUpdate
 * )
 */
export declare const updateKindNone: updateKind;
export declare const updateKindConfig: updateKind;
export declare const updateKindUpdate: updateKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::buildKind","kind":"type","status":"implemented","sigHash":"344994cd5c7b5b4023a9a5209b718b11244bbabd359d09d6df83f09865209774","bodyHash":"ff5be7e5f52df5284afb3fbf58630c5bc89f63dee0247bf307e20e1c5ad8d5b4"}
 *
 * Go source:
 * buildKind uint
 */
export type buildKind = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::constGroup::buildKindNone+buildKindPseudo+buildKindProgram","kind":"constGroup","status":"implemented","sigHash":"c01cdf8ee6f0dab110ef0219e4efad40a8e6dbecb19170cd7fe46629981dfa94","bodyHash":"66bbd15d7fca3248a13b1e9459a8a9252edaeae704292a57f354ea27e154ce3d"}
 *
 * Go source:
 * const (
 * 	buildKindNone buildKind = iota
 * 	buildKindPseudo
 * 	buildKindProgram
 * )
 */
export declare const buildKindNone: buildKind;
export declare const buildKindPseudo: buildKind;
export declare const buildKindProgram: buildKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::upstreamTask","kind":"type","status":"implemented","sigHash":"227681c3f47bb373dca94fb4d279a918b60a446fbf2501a402c14af12657eeac","bodyHash":"8ea69ca73f4ebeb538abf00c43cb66c6b73bb728438aea8361f4a215ce2c0a62"}
 *
 * Go source:
 * upstreamTask struct {
 * 	task     *BuildTask
 * 	refIndex int
 * }
 */
export interface upstreamTask {
    task: GoPtr<BuildTask>;
    refIndex: int;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::buildInfoEntry","kind":"type","status":"implemented","sigHash":"6b1d91b1a61c8b3a905f09c065f92527fdb7ffffff4590076d05cf5d3073c8a5","bodyHash":"bd18acdcaf6efc722395fa960730bb76d3528edf0316e01de4c69b1fc7f772fc"}
 *
 * Go source:
 * buildInfoEntry struct {
 * 	buildInfo *incremental.BuildInfo
 * 	path      tspath.Path
 * 	mTime     time.Time
 * 	dtsTime   *time.Time
 * }
 */
export interface buildInfoEntry {
    buildInfo: GoPtr<BuildInfo>;
    path: Path;
    mTime: Time;
    dtsTime: GoPtr<Time>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::taskResult","kind":"type","status":"implemented","sigHash":"3baf60fd109fc43e5ff90f3be3e9e9b4ccddc36f859229075bf2b8db3f660529","bodyHash":"e2750beffd04a5d3b74c19ad1c42e608e59c4a19232087aa168e234d1c4977e0"}
 *
 * Go source:
 * taskResult struct {
 * 	builder            strings.Builder
 * 	reportStatus       tsc.DiagnosticReporter
 * 	diagnosticReporter tsc.DiagnosticReporter
 * 	exitStatus         tsc.ExitStatus
 * 	statistics         *tsc.Statistics
 * 	program            *incremental.Program
 * 	buildKind          buildKind
 * 	filesToDelete      []string
 * }
 */
export interface taskResult {
    builder: Builder;
    reportStatus: DiagnosticReporter;
    diagnosticReporter: DiagnosticReporter;
    exitStatus: ExitStatus;
    statistics: GoPtr<Statistics>;
    program: GoPtr<Program>;
    buildKind: buildKind;
    filesToDelete: GoSlice<string>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::type::BuildTask","kind":"type","status":"implemented","sigHash":"8ef3499f641ea3f1a8e77d8e314ababe95b98a958114957a486eb90328ced7f4","bodyHash":"9dd475e2fed102340bfc05a450a05d80a6bd5bafd1641dc23a11889f2eaf04f5"}
 *
 * Go source:
 * BuildTask struct {
 * 	config     string
 * 	resolved   *tsoptions.ParsedCommandLine
 * 	upStream   []*upstreamTask
 * 	downStream []*BuildTask // Only set and used in watch mode
 * 	status     *upToDateStatus
 * 	done       chan struct{}
 *
 * 	// task reporting
 * 	result       *taskResult
 * 	prevReporter *BuildTask
 * 	reportDone   chan struct{}
 *
 * 	// Watching things
 * 	configTime          time.Time
 * 	extendedConfigTimes []time.Time
 * 	inputFiles          []time.Time
 *
 * 	buildInfoEntry   *buildInfoEntry
 * 	buildInfoEntryMu sync.Mutex
 *
 * 	errors             []*ast.Diagnostic
 * 	pending            atomic.Bool
 * 	isInitialCycle     bool
 * 	downStreamUpdateMu sync.Mutex
 * 	dirty              bool
 * }
 */
export interface BuildTask {
    config: string;
    resolved: GoPtr<ParsedCommandLine>;
    upStream: GoSlice<GoPtr<upstreamTask>>;
    downStream: GoSlice<GoPtr<BuildTask>>;
    status: GoPtr<upToDateStatus>;
    done: GoChan<{
        readonly __tsgoEmpty?: never;
    }, "bidirectional">;
    result: GoPtr<taskResult>;
    prevReporter: GoPtr<BuildTask>;
    reportDone: GoChan<{
        readonly __tsgoEmpty?: never;
    }, "bidirectional">;
    configTime: Time;
    extendedConfigTimes: GoSlice<Time>;
    inputFiles: GoSlice<Time>;
    buildInfoEntry: GoPtr<buildInfoEntry>;
    buildInfoEntryMu: Mutex;
    errors: GoSlice<GoPtr<Diagnostic>>;
    pending: Bool;
    isInitialCycle: bool;
    downStreamUpdateMu: Mutex;
    dirty: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.waitOnUpstream","kind":"method","status":"implemented","sigHash":"701bc79680eb4398d9fb875fb6f8b4788558d34039a39485776dfdc62ddcea1b","bodyHash":"b98ea9aaa1e9fabc901aa80d9d70fcf8ce23595b82fc5a78f5f5b5acdc311060"}
 *
 * Go source:
 * func (t *BuildTask) waitOnUpstream() {
 * 	for _, upstream := range t.upStream {
 * 		<-upstream.task.done
 * 	}
 * }
 */
export declare function BuildTask_waitOnUpstream(receiver: GoPtr<BuildTask>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.unblockDownstream","kind":"method","status":"implemented","sigHash":"ccb268314bcee29f17784df57b79d979da3587766d3fb9ae319a0fc63b38500a","bodyHash":"9d2968d2810a9aaec27ad0fbff2976d60c5316f963386aca8432a99cc217a5aa"}
 *
 * Go source:
 * func (t *BuildTask) unblockDownstream() {
 * 	t.pending.Store(false)
 * 	t.isInitialCycle = false
 * 	close(t.done)
 * }
 */
export declare function BuildTask_unblockDownstream(receiver: GoPtr<BuildTask>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.reportDiagnostic","kind":"method","status":"implemented","sigHash":"9d2edd2e9feca9344d524bec03d9d1afed212d8d35f5f5fea99757fff3a592c8","bodyHash":"8a4ee616693cb3000b2bf951d0b06af670ca0675b3d11be3eab765b00138b931"}
 *
 * Go source:
 * func (t *BuildTask) reportDiagnostic(err *ast.Diagnostic) {
 * 	t.errors = append(t.errors, err)
 * 	t.result.diagnosticReporter(err)
 * }
 */
export declare function BuildTask_reportDiagnostic(receiver: GoPtr<BuildTask>, err: GoPtr<Diagnostic>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.report","kind":"method","status":"implemented","sigHash":"ab9bdba31c07d18ba0147728b0daec51d0f8f56f2c041513ccbb4fc0d9482d8d","bodyHash":"e12f112beda55afe0aeb7526b065f2f4fa6f8ede44d65b9eb70582ba03b33454"}
 *
 * Go source:
 * func (t *BuildTask) report(orchestrator *Orchestrator, configPath tspath.Path, buildResult *orchestratorResult) {
 * 	if t.prevReporter != nil {
 * 		<-t.prevReporter.reportDone
 * 	}
 * 	if len(t.errors) > 0 {
 * 		buildResult.errors = append(core.IfElse(buildResult.errors != nil, buildResult.errors, []*ast.Diagnostic{}), t.errors...)
 * 	}
 * 	fmt.Fprint(orchestrator.opts.Sys.Writer(), t.result.builder.String())
 * 	if t.result.exitStatus > buildResult.result.Status {
 * 		buildResult.result.Status = t.result.exitStatus
 * 	}
 * 	if t.result.statistics != nil {
 * 		buildResult.statistics.Aggregate(t.result.statistics)
 * 	}
 * 	// If we built the program, or updated timestamps, or had errors, we need to
 * 	// delete files that are no longer needed
 * 	switch t.result.buildKind {
 * 	case buildKindProgram:
 * 		if orchestrator.opts.Testing != nil {
 * 			orchestrator.opts.Testing.OnProgram(t.result.program)
 * 		}
 * 		buildResult.statistics.ProjectsBuilt++
 * 	case buildKindPseudo:
 * 		buildResult.statistics.TimestampUpdates++
 * 	}
 * 	buildResult.filesToDelete = append(buildResult.filesToDelete, t.result.filesToDelete...)
 * 	t.result = nil
 * 	close(t.reportDone)
 * }
 */
export declare function BuildTask_report(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, configPath: Path, buildResult: GoPtr<orchestratorResult>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.buildProject","kind":"method","status":"implemented","sigHash":"fe58335ed03fbfd0bcc3952849d8a2af1033a266edc21b48f65fee181b58e08f","bodyHash":"26e6b282b1b7ae67a98e086e388472aaf7828d1f9fa08a08d5bb35c911ebd8a2"}
 *
 * Go source:
 * func (t *BuildTask) buildProject(orchestrator *Orchestrator, path tspath.Path) {
 * 	// Wait on upstream tasks to complete
 * 	t.waitOnUpstream()
 * 	if t.pending.Load() {
 * 		t.status = t.getUpToDateStatus(orchestrator, path)
 * 		t.reportUpToDateStatus(orchestrator)
 * 		if !t.handleStatusThatDoesntRequireBuild(orchestrator) {
 * 			t.compileAndEmit(orchestrator, path)
 * 			t.updateDownstream(orchestrator, path)
 * 		} else {
 * 			if t.resolved != nil {
 * 				for _, diagnostic := range t.resolved.GetConfigFileParsingDiagnostics() {
 * 					t.reportDiagnostic(diagnostic)
 * 				}
 * 			}
 * 			if len(t.errors) > 0 {
 * 				t.result.exitStatus = tsc.ExitStatusDiagnosticsPresent_OutputsSkipped
 * 			}
 * 		}
 * 	} else {
 * 		if len(t.errors) > 0 {
 * 			t.reportUpToDateStatus(orchestrator)
 * 			for _, err := range t.errors {
 * 				// Should not add the diagnostics so just reporting
 * 				t.result.diagnosticReporter(err)
 * 			}
 * 		}
 * 	}
 * 	t.unblockDownstream()
 * }
 */
export declare function BuildTask_buildProject(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.updateDownstream","kind":"method","status":"implemented","sigHash":"32f9052ce57cc2a07e8b7e8ba95bb4c19d85bc3d97845506431c2d03ff176b0a","bodyHash":"c3adbbba9cfd60aa447b20f6af3616b06acf5043204e604fcf0d793665f3fe9c"}
 *
 * Go source:
 * func (t *BuildTask) updateDownstream(orchestrator *Orchestrator, path tspath.Path) {
 * 	if t.isInitialCycle {
 * 		return
 * 	}
 * 	if orchestrator.opts.Command.BuildOptions.StopBuildOnErrors.IsTrue() && t.status.isError() {
 * 		return
 * 	}
 *
 * 	for _, downStream := range t.downStream {
 * 		downStream.downStreamUpdateMu.Lock()
 * 		if downStream.status != nil {
 * 			switch downStream.status.kind {
 * 			case upToDateStatusTypeUpToDate:
 * 				if !t.result.program.HasChangedDtsFile() {
 * 					downStream.status = &upToDateStatus{kind: upToDateStatusTypeUpToDateWithUpstreamTypes, data: downStream.status.data}
 * 					break
 * 				}
 * 				fallthrough
 * 			case upToDateStatusTypeUpToDateWithUpstreamTypes,
 * 				upToDateStatusTypeUpToDateWithInputFileText:
 * 				if t.result.program.HasChangedDtsFile() {
 * 					downStream.status = &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{t.config, downStream.status.oldestOutputFileName()}}
 * 				}
 * 			case upToDateStatusTypeUpstreamErrors:
 * 				upstreamErrors := downStream.status.upstreamErrors()
 * 				refConfig := core.ResolveConfigFileNameOfProjectReference(upstreamErrors.ref)
 * 				if orchestrator.toPath(refConfig) == path {
 * 					downStream.resetStatus()
 * 				}
 * 			}
 * 		}
 * 		downStream.pending.Store(true)
 * 		downStream.downStreamUpdateMu.Unlock()
 * 	}
 * }
 */
export declare function BuildTask_updateDownstream(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.compileAndEmit","kind":"method","status":"implemented","sigHash":"c5f4fb9cf3bff3a6a79b75b20f199fe8e45d7baa095e068e1025ff0cd4115d6f","bodyHash":"f5584563c40eab2cd5db88a6edf3eee7dd63fbef2cfc3010a4f5ff7df5b2ec7d"}
 *
 * Go source:
 * func (t *BuildTask) compileAndEmit(orchestrator *Orchestrator, path tspath.Path) {
 * 	t.errors = nil
 * 	if orchestrator.opts.Command.BuildOptions.Verbose.IsTrue() {
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(diagnostics.Building_project_0, orchestrator.relativeFileName(t.config)))
 * 	}
 *
 * 	// Real build
 * 	var compileTimes tsc.CompileTimes
 * 	configTime, _ := orchestrator.host.configTimes.Load(path)
 * 	compileTimes.ConfigTime = configTime
 * 	buildInfoReadStart := orchestrator.opts.Sys.Now()
 * 	var oldProgram *incremental.Program
 * 	if !orchestrator.opts.Command.BuildOptions.Force.IsTrue() {
 * 		oldProgram = incremental.ReadBuildInfoProgram(t.resolved, orchestrator.host, orchestrator.host)
 * 	}
 * 	compileTimes.BuildInfoReadTime = orchestrator.opts.Sys.Now().Sub(buildInfoReadStart)
 * 	parseStart := orchestrator.opts.Sys.Now()
 * 	program := compiler.NewProgram(compiler.ProgramOptions{
 * 		Config: t.resolved,
 * 		Host: &compilerHost{
 * 			host:  orchestrator.host,
 * 			trace: tsc.GetTraceWithWriterFromSys(&t.result.builder, orchestrator.opts.Command.Locale(), orchestrator.opts.Testing),
 * 		},
 * 	})
 * 	compileTimes.ParseTime = orchestrator.opts.Sys.Now().Sub(parseStart)
 * 	changesComputeStart := orchestrator.opts.Sys.Now()
 * 	t.result.program = incremental.NewProgram(program, oldProgram, orchestrator.host, orchestrator.opts.Testing != nil)
 * 	compileTimes.ChangesComputeTime = orchestrator.opts.Sys.Now().Sub(changesComputeStart)
 *
 * 	result, statistics := tsc.EmitAndReportStatistics(tsc.EmitInput{
 * 		Sys:                orchestrator.opts.Sys,
 * 		ProgramLike:        t.result.program,
 * 		Program:            program,
 * 		Config:             t.resolved,
 * 		ReportDiagnostic:   t.reportDiagnostic,
 * 		ReportErrorSummary: tsc.QuietDiagnosticsReporter,
 * 		Writer:             &t.result.builder,
 * 		WriteFile: func(fileName, text string, data *compiler.WriteFileData) error {
 * 			return t.writeFile(orchestrator, fileName, text, data)
 * 		},
 * 		CompileTimes:       &compileTimes,
 * 		Testing:            orchestrator.opts.Testing,
 * 		TestingMTimesCache: orchestrator.host.mTimes,
 * 	})
 * 	t.result.exitStatus = result.Status
 * 	t.result.statistics = statistics
 * 	if (!program.Options().NoEmitOnError.IsTrue() || len(result.Diagnostics) == 0) &&
 * 		(len(result.EmitResult.EmittedFiles) > 0 || t.status.kind != upToDateStatusTypeOutOfDateBuildInfoWithErrors) {
 * 		// Update time stamps for rest of the outputs
 * 		t.updateTimeStamps(orchestrator, result.EmitResult.EmittedFiles, diagnostics.Updating_unchanged_output_timestamps_of_project_0)
 * 	}
 * 	t.result.buildKind = buildKindProgram
 * 	if result.Status == tsc.ExitStatusDiagnosticsPresent_OutputsSkipped || result.Status == tsc.ExitStatusDiagnosticsPresent_OutputsGenerated {
 * 		t.status = &upToDateStatus{kind: upToDateStatusTypeBuildErrors}
 * 	} else {
 * 		var oldestOutputFileName string
 * 		if len(result.EmitResult.EmittedFiles) > 0 {
 * 			oldestOutputFileName = result.EmitResult.EmittedFiles[0]
 * 		} else {
 * 			oldestOutputFileName = core.FirstOrNilSeq(t.resolved.GetOutputFileNames())
 * 		}
 * 		t.status = &upToDateStatus{kind: upToDateStatusTypeUpToDate, data: oldestOutputFileName}
 * 	}
 * }
 */
export declare function BuildTask_compileAndEmit(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.handleStatusThatDoesntRequireBuild","kind":"method","status":"implemented","sigHash":"c2a8d21449468b1359ea82f6e909b51215d0aa84af91d2d7a382c5b7300b7b45","bodyHash":"7f79bb95737cb5a7efefbca675dc037cfb234ecc5cc321df22fab4760e0d3b6e"}
 *
 * Go source:
 * func (t *BuildTask) handleStatusThatDoesntRequireBuild(orchestrator *Orchestrator) bool {
 * 	switch t.status.kind {
 * 	case upToDateStatusTypeUpToDate:
 * 		if orchestrator.opts.Command.BuildOptions.Dry.IsTrue() {
 * 			t.result.reportStatus(ast.NewCompilerDiagnostic(diagnostics.Project_0_is_up_to_date, t.config))
 * 		}
 * 		return true
 * 	case upToDateStatusTypeUpstreamErrors:
 * 		upstreamStatus := t.status.upstreamErrors()
 * 		if orchestrator.opts.Command.BuildOptions.Verbose.IsTrue() {
 * 			t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 				core.IfElse(
 * 					upstreamStatus.refHasUpstreamErrors,
 * 					diagnostics.Skipping_build_of_project_0_because_its_dependency_1_was_not_built,
 * 					diagnostics.Skipping_build_of_project_0_because_its_dependency_1_has_errors,
 * 				),
 * 				orchestrator.relativeFileName(t.config),
 * 				orchestrator.relativeFileName(upstreamStatus.ref),
 * 			))
 * 		}
 * 		return true
 * 	case upToDateStatusTypeSolution:
 * 		return true
 * 	case upToDateStatusTypeConfigFileNotFound:
 * 		t.reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.File_0_not_found, t.config))
 * 		return true
 * 	}
 *
 * 	// update timestamps
 * 	if t.status.isPseudoBuild() {
 * 		if orchestrator.opts.Command.BuildOptions.Dry.IsTrue() {
 * 			t.result.reportStatus(ast.NewCompilerDiagnostic(diagnostics.A_non_dry_build_would_update_timestamps_for_output_of_project_0, t.config))
 * 			t.status = &upToDateStatus{kind: upToDateStatusTypeUpToDate}
 * 			return true
 * 		}
 *
 * 		t.updateTimeStamps(orchestrator, nil, diagnostics.Updating_output_timestamps_of_project_0)
 * 		t.status = &upToDateStatus{kind: upToDateStatusTypeUpToDate, data: t.status.data}
 * 		t.result.buildKind = buildKindPseudo
 * 		return true
 * 	}
 *
 * 	if orchestrator.opts.Command.BuildOptions.Dry.IsTrue() {
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(diagnostics.A_non_dry_build_would_build_project_0, t.config))
 * 		t.status = &upToDateStatus{kind: upToDateStatusTypeUpToDate}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function BuildTask_handleStatusThatDoesntRequireBuild(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.getUpToDateStatus","kind":"method","status":"implemented","sigHash":"2cd1159ce54e3529478bf9de91739ac80c8e06310d8bad85abba63836fac4c49","bodyHash":"92ee3d3dc5b4a60fef46d5bd629a3848cda9986be80bbd58d7952d95f30ff9da"}
 *
 * Go source:
 * func (t *BuildTask) getUpToDateStatus(orchestrator *Orchestrator, configPath tspath.Path) *upToDateStatus {
 * 	if t.status != nil {
 * 		return t.status
 * 	}
 * 	// Config file not found
 * 	if t.resolved == nil {
 * 		return &upToDateStatus{kind: upToDateStatusTypeConfigFileNotFound}
 * 	}
 *
 * 	// Solution - nothing to build
 * 	if len(t.resolved.FileNames()) == 0 && t.resolved.ProjectReferences() != nil {
 * 		return &upToDateStatus{kind: upToDateStatusTypeSolution}
 * 	}
 *
 * 	for _, upstream := range t.upStream {
 * 		if orchestrator.opts.Command.BuildOptions.StopBuildOnErrors.IsTrue() && upstream.task.status.isError() {
 * 			// Upstream project has errors, so we cannot build this project
 * 			return &upToDateStatus{kind: upToDateStatusTypeUpstreamErrors, data: &upstreamErrors{t.resolved.ProjectReferences()[upstream.refIndex].Path, upstream.task.status.kind == upToDateStatusTypeUpstreamErrors}}
 * 		}
 * 	}
 *
 * 	if orchestrator.opts.Command.BuildOptions.Force.IsTrue() {
 * 		return &upToDateStatus{kind: upToDateStatusTypeForceBuild}
 * 	}
 *
 * 	// Check the build info
 * 	buildInfoPath := t.resolved.GetBuildInfoFileName()
 * 	buildInfo, buildInfoTime := t.loadOrStoreBuildInfo(orchestrator, configPath, buildInfoPath)
 * 	if buildInfo == nil {
 * 		return &upToDateStatus{kind: upToDateStatusTypeOutputMissing, data: buildInfoPath}
 * 	}
 *
 * 	// build info version
 * 	if !buildInfo.IsValidVersion() {
 * 		return &upToDateStatus{kind: upToDateStatusTypeTsVersionOutputOfDate, data: buildInfo.Version}
 * 	}
 *
 * 	// Report errors if build info indicates errors
 * 	if buildInfo.Errors || // Errors that need to be reported irrespective of "--noCheck"
 * 		(!t.resolved.CompilerOptions().NoCheck.IsTrue() && (buildInfo.SemanticErrors || buildInfo.CheckPending)) { // Errors without --noCheck
 * 		return &upToDateStatus{kind: upToDateStatusTypeOutOfDateBuildInfoWithErrors, data: buildInfoPath}
 * 	}
 *
 * 	if t.resolved.CompilerOptions().IsIncremental() {
 * 		if !buildInfo.IsIncremental() {
 * 			// Program options out of date
 * 			return &upToDateStatus{kind: upToDateStatusTypeOutOfDateOptions, data: buildInfoPath}
 * 		}
 *
 * 		// Errors need to be reported if build info has errors
 * 		if (t.resolved.CompilerOptions().GetEmitDeclarations() && buildInfo.EmitDiagnosticsPerFile != nil) || // Always reported errors
 * 			(!t.resolved.CompilerOptions().NoCheck.IsTrue() && // Semantic errors if not --noCheck
 * 				(buildInfo.ChangeFileSet != nil || buildInfo.SemanticDiagnosticsPerFile != nil)) {
 * 			return &upToDateStatus{kind: upToDateStatusTypeOutOfDateBuildInfoWithErrors, data: buildInfoPath}
 * 		}
 *
 * 		// Pending emit files
 * 		if !t.resolved.CompilerOptions().NoEmit.IsTrue() &&
 * 			(buildInfo.ChangeFileSet != nil || buildInfo.AffectedFilesPendingEmit != nil) {
 * 			return &upToDateStatus{kind: upToDateStatusTypeOutOfDateBuildInfoWithPendingEmit, data: buildInfoPath}
 * 		}
 *
 * 		// Some of the emit files like source map or dts etc are not yet done
 * 		if buildInfo.IsEmitPending(t.resolved, tspath.GetDirectoryPath(tspath.GetNormalizedAbsolutePath(buildInfoPath, orchestrator.comparePathsOptions.CurrentDirectory))) {
 * 			return &upToDateStatus{kind: upToDateStatusTypeOutOfDateOptions, data: buildInfoPath}
 * 		}
 * 	}
 * 	var inputTextUnchanged bool
 * 	oldestOutputFileAndTime := fileAndTime{buildInfoPath, buildInfoTime}
 * 	var newestInputFileAndTime fileAndTime
 * 	var seenRoots collections.Set[tspath.Path]
 * 	var buildInfoRootInfoReader *incremental.BuildInfoRootInfoReader
 * 	for _, inputFile := range t.resolved.FileNames() {
 * 		inputTime := orchestrator.host.GetMTime(inputFile)
 * 		if inputTime.IsZero() {
 * 			return &upToDateStatus{kind: upToDateStatusTypeInputFileMissing, data: inputFile}
 * 		}
 * 		inputPath := orchestrator.toPath(inputFile)
 * 		if inputTime.After(oldestOutputFileAndTime.time) {
 * 			var version string
 * 			var currentVersion string
 * 			if buildInfo.IsIncremental() {
 * 				if buildInfoRootInfoReader == nil {
 * 					buildInfoRootInfoReader = buildInfo.GetBuildInfoRootInfoReader(tspath.GetDirectoryPath(tspath.GetNormalizedAbsolutePath(buildInfoPath, orchestrator.comparePathsOptions.CurrentDirectory)), orchestrator.comparePathsOptions)
 * 				}
 * 				buildInfoFileInfo, resolvedInputPath := buildInfoRootInfoReader.GetBuildInfoFileInfo(inputPath)
 * 				if fileInfo := buildInfoFileInfo.GetFileInfo(); fileInfo != nil && fileInfo.Version() != "" {
 * 					version = fileInfo.Version()
 * 					if text, ok := orchestrator.host.FS().ReadFile(string(resolvedInputPath)); ok {
 * 						currentVersion = incremental.ComputeHash(text, orchestrator.opts.Testing != nil)
 * 						if version == currentVersion {
 * 							inputTextUnchanged = true
 * 						}
 * 					}
 * 				}
 * 			}
 *
 * 			if version == "" || version != currentVersion {
 * 				return &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{inputFile, buildInfoPath}}
 * 			}
 * 		}
 * 		if inputTime.After(newestInputFileAndTime.time) {
 * 			newestInputFileAndTime = fileAndTime{inputFile, inputTime}
 * 		}
 * 		seenRoots.Add(inputPath)
 * 	}
 *
 * 	if buildInfoRootInfoReader == nil {
 * 		buildInfoRootInfoReader = buildInfo.GetBuildInfoRootInfoReader(tspath.GetDirectoryPath(tspath.GetNormalizedAbsolutePath(buildInfoPath, orchestrator.comparePathsOptions.CurrentDirectory)), orchestrator.comparePathsOptions)
 * 	}
 * 	for root := range buildInfoRootInfoReader.Roots() {
 * 		if !seenRoots.Has(root) {
 * 			// File was root file when project was built but its not any more
 * 			return &upToDateStatus{kind: upToDateStatusTypeOutOfDateRoots, data: &inputOutputName{string(root), buildInfoPath}}
 * 		}
 * 	}
 *
 * 	if !t.resolved.CompilerOptions().IsIncremental() {
 * 		// Check output file stamps
 * 		for outputFile := range t.resolved.GetOutputFileNames() {
 * 			outputTime := orchestrator.host.GetMTime(outputFile)
 * 			if outputTime.IsZero() {
 * 				// Output file missing
 * 				return &upToDateStatus{kind: upToDateStatusTypeOutputMissing, data: outputFile}
 * 			}
 *
 * 			if outputTime.Before(newestInputFileAndTime.time) {
 * 				// Output file is older than input file
 * 				return &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{newestInputFileAndTime.file, outputFile}}
 * 			}
 *
 * 			if outputTime.Before(oldestOutputFileAndTime.time) {
 * 				oldestOutputFileAndTime = fileAndTime{outputFile, outputTime}
 * 			}
 * 		}
 * 	}
 *
 * 	var refDtsUnchanged bool
 * 	for _, upstream := range t.upStream {
 * 		if upstream.task.status.kind == upToDateStatusTypeSolution {
 * 			// Not dependent on the status or this upstream project
 * 			// (eg: expected cycle was detected and hence skipped, or is solution)
 * 			continue
 * 		}
 *
 * 		// If the upstream project's newest file is older than our oldest output,
 * 		// we can't be out of date because of it
 * 		// inputTime will not be present if we just built this project or updated timestamps
 * 		// - in that case we do want to either build or update timestamps
 * 		refInputOutputFileAndTime := upstream.task.status.inputOutputFileAndTime()
 * 		if refInputOutputFileAndTime != nil && !refInputOutputFileAndTime.input.time.IsZero() && refInputOutputFileAndTime.input.time.Before(oldestOutputFileAndTime.time) {
 * 			continue
 * 		}
 *
 * 		// Check if tsbuildinfo path is shared, then we need to rebuild
 * 		if t.hasConflictingBuildInfo(orchestrator, upstream.task) {
 * 			// We have an output older than an upstream output - we are out of date
 * 			return &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{t.resolved.ProjectReferences()[upstream.refIndex].Path, oldestOutputFileAndTime.file}}
 * 		}
 *
 * 		// If the upstream project has only change .d.ts files, and we've built
 * 		// *after* those files, then we're "pseudo up to date" and eligible for a fast rebuild
 * 		newestDtsChangeTime := upstream.task.getLatestChangedDtsMTime(orchestrator)
 * 		if !newestDtsChangeTime.IsZero() && newestDtsChangeTime.Before(oldestOutputFileAndTime.time) {
 * 			refDtsUnchanged = true
 * 			continue
 * 		}
 *
 * 		// We have an output older than an upstream output - we are out of date
 * 		return &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{t.resolved.ProjectReferences()[upstream.refIndex].Path, oldestOutputFileAndTime.file}}
 * 	}
 *
 * 	checkInputFileTime := func(inputFile string) *upToDateStatus {
 * 		inputTime := orchestrator.host.GetMTime(inputFile)
 * 		if inputTime.After(oldestOutputFileAndTime.time) {
 * 			// Output file is older than input file
 * 			return &upToDateStatus{kind: upToDateStatusTypeInputFileNewer, data: &inputOutputName{inputFile, oldestOutputFileAndTime.file}}
 * 		}
 * 		return nil
 * 	}
 *
 * 	configStatus := checkInputFileTime(t.config)
 * 	if configStatus != nil {
 * 		return configStatus
 * 	}
 *
 * 	for _, extendedConfig := range t.resolved.ExtendedSourceFiles() {
 * 		extendedConfigStatus := checkInputFileTime(extendedConfig)
 * 		if extendedConfigStatus != nil {
 * 			return extendedConfigStatus
 * 		}
 * 	}
 *
 * 	// !!! sheetal TODO : watch??
 * 	// // Check package file time
 * 	// const packageJsonLookups = state.lastCachedPackageJsonLookups.get(resolvedPath);
 * 	// const dependentPackageFileStatus = packageJsonLookups && forEachKey(
 * 	//     packageJsonLookups,
 * 	//     path => checkConfigFileUpToDateStatus(state, path, oldestOutputFileTime, oldestOutputFileName),
 * 	// );
 * 	// if (dependentPackageFileStatus) return dependentPackageFileStatus;
 *
 * 	return &upToDateStatus{
 * 		kind: core.IfElse(
 * 			refDtsUnchanged,
 * 			upToDateStatusTypeUpToDateWithUpstreamTypes,
 * 			core.IfElse(inputTextUnchanged, upToDateStatusTypeUpToDateWithInputFileText, upToDateStatusTypeUpToDate),
 * 		),
 * 		data: &inputOutputFileAndTime{newestInputFileAndTime, oldestOutputFileAndTime, buildInfoPath},
 * 	}
 * }
 */
export declare function BuildTask_getUpToDateStatus(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, configPath: Path): GoPtr<upToDateStatus>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.reportUpToDateStatus","kind":"method","status":"implemented","sigHash":"4c279ffbff2640149781ded46234383b67f7cbef27d0efa148f1af0705039a89","bodyHash":"82461d501704d001d2b176cdc72ce50d64ec17b75e50a942e56357866a2ea000"}
 *
 * Go source:
 * func (t *BuildTask) reportUpToDateStatus(orchestrator *Orchestrator) {
 * 	if !orchestrator.opts.Command.BuildOptions.Verbose.IsTrue() {
 * 		return
 * 	}
 * 	switch t.status.kind {
 * 	case upToDateStatusTypeConfigFileNotFound:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_config_file_does_not_exist,
 * 			orchestrator.relativeFileName(t.config),
 * 		))
 * 	case upToDateStatusTypeUpstreamErrors:
 * 		upstreamStatus := t.status.upstreamErrors()
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			core.IfElse(
 * 				upstreamStatus.refHasUpstreamErrors,
 * 				diagnostics.Project_0_can_t_be_built_because_its_dependency_1_was_not_built,
 * 				diagnostics.Project_0_can_t_be_built_because_its_dependency_1_has_errors,
 * 			),
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(upstreamStatus.ref),
 * 		))
 * 	case upToDateStatusTypeBuildErrors:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_it_has_errors,
 * 			orchestrator.relativeFileName(t.config),
 * 		))
 * 	case upToDateStatusTypeUpToDate:
 * 		// This is to ensure skipping verbose log for projects that were built,
 * 		// and then some other package changed but this package doesnt need update
 * 		if inputOutputFileAndTime := t.status.inputOutputFileAndTime(); inputOutputFileAndTime != nil {
 * 			t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 				diagnostics.Project_0_is_up_to_date_because_newest_input_1_is_older_than_output_2,
 * 				orchestrator.relativeFileName(t.config),
 * 				orchestrator.relativeFileName(inputOutputFileAndTime.input.file),
 * 				orchestrator.relativeFileName(inputOutputFileAndTime.output.file),
 * 			))
 * 		}
 * 	case upToDateStatusTypeUpToDateWithUpstreamTypes:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_up_to_date_with_d_ts_files_from_its_dependencies,
 * 			orchestrator.relativeFileName(t.config),
 * 		))
 * 	case upToDateStatusTypeUpToDateWithInputFileText:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_up_to_date_but_needs_to_update_timestamps_of_output_files_that_are_older_than_input_files,
 * 			orchestrator.relativeFileName(t.config),
 * 		))
 * 	case upToDateStatusTypeInputFileMissing:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_input_1_does_not_exist,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 		))
 * 	case upToDateStatusTypeOutputMissing:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_output_file_1_does_not_exist,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 		))
 * 	case upToDateStatusTypeInputFileNewer:
 * 		inputOutput := t.status.inputOutputName()
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_output_1_is_older_than_input_2,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(inputOutput.output),
 * 			orchestrator.relativeFileName(inputOutput.input),
 * 		))
 * 	case upToDateStatusTypeOutOfDateBuildInfoWithPendingEmit:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_buildinfo_file_1_indicates_that_some_of_the_changes_were_not_emitted,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 		))
 * 	case upToDateStatusTypeOutOfDateBuildInfoWithErrors:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_buildinfo_file_1_indicates_that_program_needs_to_report_errors,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 		))
 * 	case upToDateStatusTypeOutOfDateOptions:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_buildinfo_file_1_indicates_there_is_change_in_compilerOptions,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 		))
 * 	case upToDateStatusTypeOutOfDateRoots:
 * 		inputOutput := t.status.inputOutputName()
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_buildinfo_file_1_indicates_that_file_2_was_root_file_of_compilation_but_not_any_more,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(inputOutput.output),
 * 			orchestrator.relativeFileName(inputOutput.input),
 * 		))
 * 	case upToDateStatusTypeTsVersionOutputOfDate:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_out_of_date_because_output_for_it_was_generated_with_version_1_that_differs_with_current_version_2,
 * 			orchestrator.relativeFileName(t.config),
 * 			orchestrator.relativeFileName(t.status.data.(string)),
 * 			core.Version(),
 * 		))
 * 	case upToDateStatusTypeForceBuild:
 * 		t.result.reportStatus(ast.NewCompilerDiagnostic(
 * 			diagnostics.Project_0_is_being_forcibly_rebuilt,
 * 			orchestrator.relativeFileName(t.config),
 * 		))
 * 	case upToDateStatusTypeSolution:
 * 		// Does not need to report status
 * 	default:
 * 		panic(fmt.Sprintf("Unknown up to date status kind: %v", t.status.kind))
 * 	}
 * }
 */
export declare function BuildTask_reportUpToDateStatus(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.canUpdateJsDtsOutputTimestamps","kind":"method","status":"implemented","sigHash":"325df5efbf406683065d0f70bf7814bd8e2845a6dee8aec23d8151bc568ace04","bodyHash":"253bf2cf0349b1e35ce5a260f60cc1085fb759f246e9fac3c3c93b48453143e3"}
 *
 * Go source:
 * func (t *BuildTask) canUpdateJsDtsOutputTimestamps() bool {
 * 	return !t.resolved.CompilerOptions().NoEmit.IsTrue() && !t.resolved.CompilerOptions().IsIncremental()
 * }
 */
export declare function BuildTask_canUpdateJsDtsOutputTimestamps(receiver: GoPtr<BuildTask>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.updateTimeStamps","kind":"method","status":"implemented","sigHash":"fd2d0c7a27cc644f427d4bff22505e6cdae2b146cd8c3fd72dc1938be5719408","bodyHash":"ee96e0068ac70211f4459244bbee7290bd36a6e93d906a74f95c7fda893d10d0"}
 *
 * Go source:
 * func (t *BuildTask) updateTimeStamps(orchestrator *Orchestrator, emittedFiles []string, verboseMessage *diagnostics.Message) {
 * 	emitted := collections.NewSetFromItems(emittedFiles...)
 * 	var verboseMessageReported bool
 * 	buildInfoName := t.resolved.GetBuildInfoFileName()
 * 	now := orchestrator.opts.Sys.Now()
 * 	updateTimeStamp := func(file string) {
 * 		if emitted.Has(file) {
 * 			return
 * 		}
 * 		if !verboseMessageReported && orchestrator.opts.Command.BuildOptions.Verbose.IsTrue() {
 * 			t.result.reportStatus(ast.NewCompilerDiagnostic(verboseMessage, orchestrator.relativeFileName(t.config)))
 * 			verboseMessageReported = true
 * 		}
 * 		err := orchestrator.host.SetMTime(file, now)
 * 		if err == nil {
 * 			if file == buildInfoName {
 * 				t.buildInfoEntryMu.Lock()
 * 				if t.buildInfoEntry != nil {
 * 					t.buildInfoEntry.mTime = now
 * 				}
 * 				t.buildInfoEntryMu.Unlock()
 * 			} else if t.storeOutputTimeStamp(orchestrator) {
 * 				orchestrator.host.storeMTime(file, now)
 * 			}
 * 		}
 * 	}
 *
 * 	if t.canUpdateJsDtsOutputTimestamps() {
 * 		for outputFile := range t.resolved.GetOutputFileNames() {
 * 			updateTimeStamp(outputFile)
 * 		}
 * 	}
 * 	updateTimeStamp(t.resolved.GetBuildInfoFileName())
 * }
 */
export declare function BuildTask_updateTimeStamps(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, emittedFiles: GoSlice<string>, verboseMessage: GoPtr<Message>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.cleanProject","kind":"method","status":"implemented","sigHash":"322013814233b0c90b7781210d598ae5e8dfe9acdf46a5387e1d31f71ba63b25","bodyHash":"0379be06f65114b9fe2e1e2ce6154663462b44e6a30f5fe6c9f765abaec97216"}
 *
 * Go source:
 * func (t *BuildTask) cleanProject(orchestrator *Orchestrator, path tspath.Path) {
 * 	if t.resolved == nil {
 * 		t.reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.File_0_not_found, t.config))
 * 		t.result.exitStatus = tsc.ExitStatusDiagnosticsPresent_OutputsSkipped
 * 		return
 * 	}
 *
 * 	inputs := collections.NewSetFromItems(core.Map(t.resolved.FileNames(), orchestrator.toPath)...)
 * 	for outputFile := range t.resolved.GetOutputFileNames() {
 * 		t.cleanProjectOutput(orchestrator, outputFile, inputs)
 * 	}
 * 	t.cleanProjectOutput(orchestrator, t.resolved.GetBuildInfoFileName(), inputs)
 * }
 */
export declare function BuildTask_cleanProject(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.cleanProjectOutput","kind":"method","status":"implemented","sigHash":"dab7738052c94577b4dfd66dc9d60bc14b04c920b8fe4e727202cc6f79202b61","bodyHash":"8bb494260af78a10926b3b119e9a95a99d1618eb86cc11b02d44446ff0a6a08c"}
 *
 * Go source:
 * func (t *BuildTask) cleanProjectOutput(orchestrator *Orchestrator, outputFile string, inputs *collections.Set[tspath.Path]) {
 * 	outputPath := orchestrator.toPath(outputFile)
 * 	// If output name is same as input file name, do not delete and ignore the error
 * 	if inputs.Has(outputPath) {
 * 		return
 * 	}
 * 	if orchestrator.host.FS().FileExists(outputFile) {
 * 		if !orchestrator.opts.Command.BuildOptions.Dry.IsTrue() {
 * 			err := orchestrator.host.FS().Remove(outputFile)
 * 			if err != nil {
 * 				t.reportDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Failed_to_delete_file_0, outputFile))
 * 			}
 * 		} else {
 * 			t.result.filesToDelete = append(t.result.filesToDelete, outputFile)
 * 		}
 * 	}
 * }
 */
export declare function BuildTask_cleanProjectOutput(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, outputFile: string, inputs: GoPtr<Set<Path>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.updateWatch","kind":"method","status":"implemented","sigHash":"6647f68924aa0f60f2b47c821905ad2b95d49487702f8fceb8b6ffbe7f8a3ed0","bodyHash":"228f9462d032b117104a78d387fa24e0caab94c6e464b272dc83145a07ad3c77"}
 *
 * Go source:
 * func (t *BuildTask) updateWatch(orchestrator *Orchestrator, oldCache *collections.SyncMap[tspath.Path, time.Time]) {
 * 	t.configTime = orchestrator.host.loadOrStoreMTime(t.config, oldCache, false)
 * 	if t.resolved != nil {
 * 		t.extendedConfigTimes = core.Map(t.resolved.ExtendedSourceFiles(), func(p string) time.Time {
 * 			return orchestrator.host.loadOrStoreMTime(p, oldCache, false)
 * 		})
 * 		t.inputFiles = core.Map(t.resolved.FileNames(), func(p string) time.Time {
 * 			return orchestrator.host.loadOrStoreMTime(p, oldCache, false)
 * 		})
 * 		if t.canUpdateJsDtsOutputTimestamps() {
 * 			for outputFile := range t.resolved.GetOutputFileNames() {
 * 				orchestrator.host.storeMTimeFromOldCache(outputFile, oldCache)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function BuildTask_updateWatch(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, oldCache: GoPtr<SyncMap>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.resetStatus","kind":"method","status":"implemented","sigHash":"a9e7587c7d13780b196dc0234c71e9fae4f88445ff5716963f4c949e7b81255b","bodyHash":"695d5ccee3f7f42403602fd882b0c716d4156e0adc6ca1d32af7e5f83d686612"}
 *
 * Go source:
 * func (t *BuildTask) resetStatus() {
 * 	t.status = nil
 * 	t.pending.Store(true)
 * 	t.errors = nil
 * }
 */
export declare function BuildTask_resetStatus(receiver: GoPtr<BuildTask>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.resetConfig","kind":"method","status":"implemented","sigHash":"3e64133c2a592749043a87456af812b235ebbd11d8b0ad6089e3d201e63316d0","bodyHash":"6a346254744503f41688cf38d3223415c298629fafd2938f7e91324d0e498bc6"}
 *
 * Go source:
 * func (t *BuildTask) resetConfig(orchestrator *Orchestrator, path tspath.Path) {
 * 	t.dirty = true
 * 	orchestrator.host.resolvedReferences.delete(path)
 * }
 */
export declare function BuildTask_resetConfig(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.hasUpdate","kind":"method","status":"implemented","sigHash":"3f1978cffe852858f9820591ade9fd39e05462ff2172c33f58daf3bbb2e13a93","bodyHash":"f0307144a8c4c6a77c3697bebc95ed20e3e2a1c9bca8801f336972cdd912d68c"}
 *
 * Go source:
 * func (t *BuildTask) hasUpdate(orchestrator *Orchestrator, path tspath.Path) updateKind {
 * 	var needsConfigUpdate bool
 * 	var needsUpdate bool
 * 	if configTime := orchestrator.host.GetMTime(t.config); configTime != t.configTime {
 * 		t.resetConfig(orchestrator, path)
 * 		needsConfigUpdate = true
 * 	}
 * 	if t.resolved != nil {
 * 		for index, file := range t.resolved.ExtendedSourceFiles() {
 * 			if orchestrator.host.GetMTime(file) != t.extendedConfigTimes[index] {
 * 				t.resetConfig(orchestrator, path)
 * 				needsConfigUpdate = true
 * 			}
 * 		}
 * 		for index, file := range t.resolved.FileNames() {
 * 			if orchestrator.host.GetMTime(file) != t.inputFiles[index] {
 * 				t.resetStatus()
 * 				needsUpdate = true
 * 			}
 * 		}
 * 		if !needsConfigUpdate {
 * 			configStart := orchestrator.opts.Sys.Now()
 * 			newConfig := t.resolved.ReloadFileNamesOfParsedCommandLine(orchestrator.host.FS())
 * 			configTime := orchestrator.opts.Sys.Now().Sub(configStart)
 * 			// Make new channels if needed later
 * 			t.reportDone = make(chan struct{})
 * 			t.done = make(chan struct{})
 * 			if !slices.Equal(t.resolved.FileNames(), newConfig.FileNames()) {
 * 				orchestrator.host.resolvedReferences.store(path, newConfig)
 * 				orchestrator.host.configTimes.Store(path, configTime)
 * 				t.resolved = newConfig
 * 				t.resetStatus()
 * 				needsUpdate = true
 * 			}
 * 		}
 * 	}
 * 	return core.IfElse(needsConfigUpdate, updateKindConfig, core.IfElse(needsUpdate, updateKindUpdate, updateKindNone))
 * }
 */
export declare function BuildTask_hasUpdate(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, path: Path): updateKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.loadOrStoreBuildInfo","kind":"method","status":"implemented","sigHash":"bedc3d24bfa7e97fe9c3aa4245d2c82aa6cd1c487a3c14366b153cf08a2bf20a","bodyHash":"98c06af78bae156b6dce48234f7a25c1a28217d26601b15e1463f497184c3b91"}
 *
 * Go source:
 * func (t *BuildTask) loadOrStoreBuildInfo(orchestrator *Orchestrator, configPath tspath.Path, buildInfoFileName string) (*incremental.BuildInfo, time.Time) {
 * 	path := orchestrator.toPath(buildInfoFileName)
 * 	t.buildInfoEntryMu.Lock()
 * 	defer t.buildInfoEntryMu.Unlock()
 * 	if t.buildInfoEntry != nil && t.buildInfoEntry.path == path {
 * 		return t.buildInfoEntry.buildInfo, t.buildInfoEntry.mTime
 * 	}
 * 	t.buildInfoEntry = &buildInfoEntry{
 * 		buildInfo: incremental.NewBuildInfoReader(orchestrator.host).ReadBuildInfo(t.resolved),
 * 		path:      path,
 * 	}
 * 	var mTime time.Time
 * 	if t.buildInfoEntry.buildInfo != nil {
 * 		mTime = orchestrator.host.GetMTime(buildInfoFileName)
 * 	}
 * 	t.buildInfoEntry.mTime = mTime
 * 	return t.buildInfoEntry.buildInfo, mTime
 * }
 */
export declare function BuildTask_loadOrStoreBuildInfo(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, configPath: Path, buildInfoFileName: string): [GoPtr<BuildInfo>, Time];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.onBuildInfoEmit","kind":"method","status":"implemented","sigHash":"311c0312172119444ef34e81c82db94aa7d082ba0a9f7ad4624aa8d95bb15551","bodyHash":"118e97188f82c3a34c5d2a25d9381fcfaedb498e99744ab8db4d32eeefe2fb37"}
 *
 * Go source:
 * func (t *BuildTask) onBuildInfoEmit(orchestrator *Orchestrator, buildInfoFileName string, buildInfo *incremental.BuildInfo, hasChangedDtsFile bool) {
 * 	t.buildInfoEntryMu.Lock()
 * 	defer t.buildInfoEntryMu.Unlock()
 * 	var dtsTime *time.Time
 * 	mTime := orchestrator.opts.Sys.Now()
 * 	if hasChangedDtsFile {
 * 		dtsTime = &mTime
 * 	} else if t.buildInfoEntry != nil {
 * 		dtsTime = t.buildInfoEntry.dtsTime
 * 	}
 * 	t.buildInfoEntry = &buildInfoEntry{
 * 		buildInfo: buildInfo,
 * 		path:      orchestrator.toPath(buildInfoFileName),
 * 		mTime:     mTime,
 * 		dtsTime:   dtsTime,
 * 	}
 * }
 */
export declare function BuildTask_onBuildInfoEmit(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, buildInfoFileName: string, buildInfo: GoPtr<BuildInfo>, hasChangedDtsFile: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.hasConflictingBuildInfo","kind":"method","status":"implemented","sigHash":"58df7733626e9b95cdd7e72cdb55e3b02985e4a638cfc6278f1cc928ccef6331","bodyHash":"2db8a77fb2c280e659abadac70d992bf90a21933a0ebea17fedc3f4b72b3404e"}
 *
 * Go source:
 * func (t *BuildTask) hasConflictingBuildInfo(orchestrator *Orchestrator, upstream *BuildTask) bool {
 * 	if t.buildInfoEntry != nil && upstream.buildInfoEntry != nil {
 * 		return t.buildInfoEntry.path == upstream.buildInfoEntry.path
 * 	}
 * 	return false
 * }
 */
export declare function BuildTask_hasConflictingBuildInfo(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, upstream: GoPtr<BuildTask>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.getLatestChangedDtsMTime","kind":"method","status":"implemented","sigHash":"d3aa3fbd5f837310efdfde132209649f34353f64ed4c74405c3e9beb5715970f","bodyHash":"49ba263ee31f57e6419dcb9338408355b31cbe73dd6791f316c80cde345670c3"}
 *
 * Go source:
 * func (t *BuildTask) getLatestChangedDtsMTime(orchestrator *Orchestrator) time.Time {
 * 	t.buildInfoEntryMu.Lock()
 * 	defer t.buildInfoEntryMu.Unlock()
 * 	if t.buildInfoEntry.dtsTime != nil {
 * 		return *t.buildInfoEntry.dtsTime
 * 	}
 * 	dtsTime := orchestrator.host.GetMTime(
 * 		tspath.GetNormalizedAbsolutePath(
 * 			t.buildInfoEntry.buildInfo.LatestChangedDtsFile,
 * 			tspath.GetDirectoryPath(string(t.buildInfoEntry.path)),
 * 		),
 * 	)
 * 	t.buildInfoEntry.dtsTime = &dtsTime
 * 	return dtsTime
 * }
 */
export declare function BuildTask_getLatestChangedDtsMTime(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>): Time;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.storeOutputTimeStamp","kind":"method","status":"implemented","sigHash":"f24e91a90fc062273b7cf249c2a7ffede804dd593353858b057cb1a533999f33","bodyHash":"11bcea1a8c54a50cb450835b9677782dfa7a6f70e926f872e03686f45bea3802"}
 *
 * Go source:
 * func (t *BuildTask) storeOutputTimeStamp(orchestrator *Orchestrator) bool {
 * 	return orchestrator.opts.Command.CompilerOptions.Watch.IsTrue() && !t.resolved.CompilerOptions().IsIncremental()
 * }
 */
export declare function BuildTask_storeOutputTimeStamp(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/buildtask.go::method::BuildTask.writeFile","kind":"method","status":"implemented","sigHash":"abe813fe114b58158cbd2b6136cfcbe72efee6e5351f159b4332646009213f5e","bodyHash":"93f8a73db6839049ae563b8bca6763b20a78374c95bd3a5d8c418cb29f47d7c2"}
 *
 * Go source:
 * func (t *BuildTask) writeFile(orchestrator *Orchestrator, fileName string, text string, data *compiler.WriteFileData) error {
 * 	err := orchestrator.host.FS().WriteFile(fileName, text)
 * 	if err == nil {
 * 		if data != nil && data.BuildInfo != nil {
 * 			t.onBuildInfoEmit(orchestrator, fileName, data.BuildInfo.(*incremental.BuildInfo), t.result.program.HasChangedDtsFile())
 * 		} else if t.storeOutputTimeStamp(orchestrator) {
 * 			// Store time stamps
 * 			orchestrator.host.storeMTime(fileName, orchestrator.opts.Sys.Now())
 * 		}
 * 	}
 * 	return err
 * }
 */
export declare function BuildTask_writeFile(receiver: GoPtr<BuildTask>, orchestrator: GoPtr<Orchestrator>, fileName: string, text: string, data: GoPtr<WriteFileData>): GoError;
//# sourceMappingURL=buildtask.d.ts.map
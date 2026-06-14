import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Writer } from "../../../go/io.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Set } from "../../collections/set.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { WorkGroup } from "../../core/workgroup.js";
import type { ParsedBuildCommandLine } from "../../tsoptions/parsedbuildcommandline.js";
import type { ComparePathsOptions, Path } from "../../tspath/path.js";
import type { CommandLineResult, CommandLineTesting, System, Watcher } from "../tsc/compile.js";
import type { DiagnosticReporter, DiagnosticsReporter } from "../tsc/diagnostics.js";
import type { Statistics } from "../tsc/statistics.js";
import type { BuildTask } from "./buildtask.js";
import type { host } from "./host.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::type::Options","kind":"type","status":"implemented","sigHash":"ea173f48959bb5742f1a055b1561015dbc45fb79cf6ff15219753c2abb245e1f","bodyHash":"69628808be0501ab69e7a2e5cf9c349ab1129718bc63d4ddc222553efb32cabf"}
 *
 * Go source:
 * Options struct {
 * 	Sys     tsc.System
 * 	Command *tsoptions.ParsedBuildCommandLine
 * 	Testing tsc.CommandLineTesting
 * }
 */
export interface Options {
    Sys: System;
    Command: GoPtr<ParsedBuildCommandLine>;
    Testing: CommandLineTesting | undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::type::orchestratorResult","kind":"type","status":"implemented","sigHash":"8ed1815afef001927a40cb48a20d8e8330f1a075fcfae11e8581fd64a39186c9","bodyHash":"a1ed589b2a0d747bea2ec47282401deff0ac2f3a723cabe23cd94ac831dca679"}
 *
 * Go source:
 * orchestratorResult struct {
 * 	result        tsc.CommandLineResult
 * 	errors        []*ast.Diagnostic
 * 	statistics    tsc.Statistics
 * 	filesToDelete []string
 * }
 */
export interface orchestratorResult {
    result: CommandLineResult;
    errors: GoSlice<GoPtr<Diagnostic>>;
    statistics: Statistics;
    filesToDelete: GoSlice<string>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::orchestratorResult.report","kind":"method","status":"implemented","sigHash":"0a59edbd01202a17ebdb418c50376b520766b371a8e8f72da922342822877d92","bodyHash":"025b45545cb40bbb15ca144e1d379a0aeb57b810b8f9bf637f2e43f07113dcaf"}
 *
 * Go source:
 * func (b *orchestratorResult) report(o *Orchestrator) {
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		o.watchStatusReporter(ast.NewCompilerDiagnostic(core.IfElse(len(b.errors) == 1, diagnostics.Found_1_error_Watching_for_file_changes, diagnostics.Found_0_errors_Watching_for_file_changes), len(b.errors)))
 * 	} else {
 * 		o.errorSummaryReporter(b.errors)
 * 	}
 * 	if b.filesToDelete != nil {
 * 		o.createBuilderStatusReporter(nil)(
 * 			ast.NewCompilerDiagnostic(
 * 				diagnostics.A_non_dry_build_would_delete_the_following_files_Colon_0,
 * 				strings.Join(core.Map(b.filesToDelete, func(f string) string {
 * 					return "\r\n * " + f
 * 				}), ""),
 * 			))
 * 	}
 * 	if !o.opts.Command.CompilerOptions.Diagnostics.IsTrue() && !o.opts.Command.CompilerOptions.ExtendedDiagnostics.IsTrue() {
 * 		return
 * 	}
 * 	b.statistics.SetTotalTime(o.opts.Sys.SinceStart())
 * 	b.statistics.Report(o.opts.Sys.Writer(), o.opts.Testing)
 * }
 */
export declare function orchestratorResult_report(receiver: GoPtr<orchestratorResult>, o: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::type::Orchestrator","kind":"type","status":"implemented","sigHash":"cc9f01c813767aac83bd2edb634eabe00c8a752fffaf005f38e8353e8a25796e","bodyHash":"e05f5ba48f3744ecc8508f03d5b85fa7b27841fc13a92d0513c3cdfe66c8b8eb"}
 *
 * Go source:
 * Orchestrator struct {
 * 	opts                Options
 * 	comparePathsOptions tspath.ComparePathsOptions
 * 	host                *host
 *
 * 	// order generation result
 * 	tasks  *collections.SyncMap[tspath.Path, *BuildTask]
 * 	order  []string
 * 	errors []*ast.Diagnostic
 *
 * 	errorSummaryReporter tsc.DiagnosticsReporter
 * 	watchStatusReporter  tsc.DiagnosticReporter
 * }
 */
export interface Orchestrator {
    opts: Options;
    comparePathsOptions: ComparePathsOptions;
    host: GoPtr<host>;
    tasks: GoPtr<SyncMap>;
    order: GoSlice<string>;
    errors: GoSlice<GoPtr<Diagnostic>>;
    errorSummaryReporter: DiagnosticsReporter | undefined;
    watchStatusReporter: DiagnosticReporter | undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"8df5ee902b902bae8873b016f2fdb528c344be93f113c5f408fde2185f0ff258"}
 *
 * Go source:
 * var _ tsc.Watcher = (*Orchestrator)(nil)
 */
export declare let __a05f111f_0: Watcher;
export declare function Orchestrator_as_tsc_Watcher(receiver: GoPtr<Orchestrator>): Watcher;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.relativeFileName","kind":"method","status":"implemented","sigHash":"72ff97cf7be6af75d0bcb0a972d3c887eec0137ae80fdd7bf9ec0abf11edc9b4","bodyHash":"ff945d4da9c439fd6783fed02507cb9daab99b679d06699e3d94c0ebfe74591a"}
 *
 * Go source:
 * func (o *Orchestrator) relativeFileName(fileName string) string {
 * 	return tspath.ConvertToRelativePath(fileName, o.comparePathsOptions)
 * }
 */
export declare function Orchestrator_relativeFileName(receiver: GoPtr<Orchestrator>, fileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.toPath","kind":"method","status":"implemented","sigHash":"9e61b62a405e313d1ad17028e975890f0df3e6fd78ea274d85c7a5b9cc01edf0","bodyHash":"27d7a1b912fa68839612692b556aa464ef54d9b75be35d445a69f2b54dfa83b8"}
 *
 * Go source:
 * func (o *Orchestrator) toPath(fileName string) tspath.Path {
 * 	return tspath.ToPath(fileName, o.comparePathsOptions.CurrentDirectory, o.comparePathsOptions.UseCaseSensitiveFileNames)
 * }
 */
export declare function Orchestrator_toPath(receiver: GoPtr<Orchestrator>, fileName: string): Path;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Order","kind":"method","status":"implemented","sigHash":"1301e30f674ef1c608aefd50ccd0739e9612b69d9bfa3960f0ef286873c97219","bodyHash":"4d8ffbdd713ca06f0061502658a991f0f4b41925550afae89b90caedec18b6c3"}
 *
 * Go source:
 * func (o *Orchestrator) Order() []string {
 * 	return o.order
 * }
 */
export declare function Orchestrator_Order(receiver: GoPtr<Orchestrator>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Upstream","kind":"method","status":"implemented","sigHash":"7f3b0fb743b122979e2b074f6444231c3de0eb3ea6cb87465543694f936a5c96","bodyHash":"23c05c9394d5ca6d1c76bbdc069efae890cad6211b8c439e6aaf7b5a493d34be"}
 *
 * Go source:
 * func (o *Orchestrator) Upstream(configName string) []string {
 * 	path := o.toPath(configName)
 * 	task := o.getTask(path)
 * 	return core.Map(task.upStream, func(t *upstreamTask) string {
 * 		return t.task.config
 * 	})
 * }
 */
export declare function Orchestrator_Upstream(receiver: GoPtr<Orchestrator>, configName: string): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Downstream","kind":"method","status":"implemented","sigHash":"0fa4b32ce78c45e5133b8fb53e268a74704700b01972ead882fc5c003b17aecc","bodyHash":"03be9d1de6a867a66869ac312c9957bbc6b03232bf02d21178bc49708106611e"}
 *
 * Go source:
 * func (o *Orchestrator) Downstream(configName string) []string {
 * 	path := o.toPath(configName)
 * 	task := o.getTask(path)
 * 	return core.Map(task.downStream, func(t *BuildTask) string {
 * 		return t.config
 * 	})
 * }
 */
export declare function Orchestrator_Downstream(receiver: GoPtr<Orchestrator>, configName: string): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.getTask","kind":"method","status":"implemented","sigHash":"4b2b5e6cba576241e54fc1ab31c9ede92bcb74dad862d5ecdc3676ff0de82092","bodyHash":"3a1a10a118892df43330e92f0f3df5571c3669d7f320c7cf0b7fd82acd1e116d"}
 *
 * Go source:
 * func (o *Orchestrator) getTask(path tspath.Path) *BuildTask {
 * 	task, ok := o.tasks.Load(path)
 * 	if !ok {
 * 		panic("No build task found for " + path)
 * 	}
 * 	return task
 * }
 */
export declare function Orchestrator_getTask(receiver: GoPtr<Orchestrator>, path: Path): GoPtr<BuildTask>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.createBuildTasks","kind":"method","status":"implemented","sigHash":"329dee7541b89ead2d2bbc950f66b9ac5355421b6feb4025adf54d1652414d57","bodyHash":"e9072f6f2ffedf70a1212c48bb2a9a80bdc89d01adeaa6a2a1401f84c8fb1a3f"}
 *
 * Go source:
 * func (o *Orchestrator) createBuildTasks(oldTasks *collections.SyncMap[tspath.Path, *BuildTask], configs []string, wg core.WorkGroup) {
 * 	for _, config := range configs {
 * 		wg.Queue(func() {
 * 			path := o.toPath(config)
 * 			var task *BuildTask
 * 			var buildInfo *buildInfoEntry
 * 			if oldTasks != nil {
 * 				if existing, ok := oldTasks.Load(path); ok {
 * 					if !existing.dirty {
 * 						// Reuse existing task if config is same
 * 						task = existing
 * 					} else {
 * 						buildInfo = existing.buildInfoEntry
 * 					}
 * 				}
 * 			}
 * 			if task == nil {
 * 				task = &BuildTask{config: config, isInitialCycle: oldTasks == nil}
 * 				task.pending.Store(true)
 * 				task.buildInfoEntry = buildInfo
 * 			}
 * 			if _, loaded := o.tasks.LoadOrStore(path, task); loaded {
 * 				return
 * 			}
 * 			task.resolved = o.host.GetResolvedProjectReference(config, path)
 * 			task.upStream = nil
 * 			if task.resolved != nil {
 * 				o.createBuildTasks(oldTasks, task.resolved.ResolvedProjectReferencePaths(), wg)
 * 			}
 * 		})
 * 	}
 * }
 */
export declare function Orchestrator_createBuildTasks(receiver: GoPtr<Orchestrator>, oldTasks: GoPtr<SyncMap>, configs: GoSlice<string>, wg: WorkGroup): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.setupBuildTask","kind":"method","status":"implemented","sigHash":"66425ad7812e87b4684055d1970a30cb40f0863fef9394515cbb0c54bdf123e2","bodyHash":"5c7444a439956b4871099f7866500401575250c81213dd03e31f5c8c534afc42"}
 *
 * Go source:
 * func (o *Orchestrator) setupBuildTask(
 * 	configName string,
 * 	downStream *BuildTask,
 * 	inCircularContext bool,
 * 	completed *collections.Set[tspath.Path],
 * 	analyzing *collections.Set[tspath.Path],
 * 	circularityStack []string,
 * ) *BuildTask {
 * 	path := o.toPath(configName)
 * 	task := o.getTask(path)
 * 	if !completed.Has(path) {
 * 		if analyzing.Has(path) {
 * 			if !inCircularContext {
 * 				o.errors = append(o.errors, ast.NewCompilerDiagnostic(
 * 					diagnostics.Project_references_may_not_form_a_circular_graph_Cycle_detected_Colon_0,
 * 					strings.Join(circularityStack, "\n"),
 * 				))
 * 			}
 * 			return nil
 * 		}
 * 		analyzing.Add(path)
 * 		circularityStack = append(circularityStack, configName)
 * 		if task.resolved != nil {
 * 			for index, subReference := range task.resolved.ResolvedProjectReferencePaths() {
 * 				upstream := o.setupBuildTask(subReference, task, inCircularContext || task.resolved.ProjectReferences()[index].Circular, completed, analyzing, circularityStack)
 * 				if upstream != nil {
 * 					task.upStream = append(task.upStream, &upstreamTask{task: upstream, refIndex: index})
 * 				}
 * 			}
 * 		}
 * 		circularityStack = circularityStack[:len(circularityStack)-1]
 * 		completed.Add(path)
 * 		task.reportDone = make(chan struct{})
 * 		prev := core.LastOrNil(o.order)
 * 		if prev != "" {
 * 			task.prevReporter = o.getTask(o.toPath(prev))
 * 		}
 * 		task.done = make(chan struct{})
 * 		o.order = append(o.order, configName)
 * 	}
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() && downStream != nil {
 * 		task.downStream = append(task.downStream, downStream)
 * 	}
 * 	return task
 * }
 */
export declare function Orchestrator_setupBuildTask(receiver: GoPtr<Orchestrator>, configName: string, downStream: GoPtr<BuildTask>, inCircularContext: bool, completed: GoPtr<Set>, analyzing: GoPtr<Set>, circularityStack: GoSlice<string>): GoPtr<BuildTask>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.GenerateGraphReusingOldTasks","kind":"method","status":"implemented","sigHash":"169d3ccca94606a2a402942539df2105a48962d215156c2d8c57714504cbb3ca","bodyHash":"d2f511d69049e087e9db651d732b979d6313bd4b0bcec8abfd688cb0536221b3"}
 *
 * Go source:
 * func (o *Orchestrator) GenerateGraphReusingOldTasks() {
 * 	tasks := o.tasks
 * 	o.tasks = &collections.SyncMap[tspath.Path, *BuildTask]{}
 * 	o.order = nil
 * 	o.errors = nil
 * 	o.GenerateGraph(tasks)
 * }
 */
export declare function Orchestrator_GenerateGraphReusingOldTasks(receiver: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.GenerateGraph","kind":"method","status":"implemented","sigHash":"279f8f4940231b9f3a890093603ccd86df99c79f77cdc4ff810389693aee4527","bodyHash":"2bb6f987d23dcbb34ebbb64effb83fa4d3b2fbba960f585e03c3e385e2ba611a"}
 *
 * Go source:
 * func (o *Orchestrator) GenerateGraph(oldTasks *collections.SyncMap[tspath.Path, *BuildTask]) {
 * 	projects := o.opts.Command.ResolvedProjectPaths()
 * 	// Parse all config files in parallel
 * 	wg := core.NewWorkGroup(o.opts.Command.CompilerOptions.SingleThreaded.IsTrue())
 * 	o.createBuildTasks(oldTasks, projects, wg)
 * 	wg.RunAndWait()
 *
 * 	// Generate the graph
 * 	completed := collections.Set[tspath.Path]{}
 * 	analyzing := collections.Set[tspath.Path]{}
 * 	circularityStack := []string{}
 * 	for _, project := range projects {
 * 		o.setupBuildTask(project, nil, false, &completed, &analyzing, circularityStack)
 * 	}
 * }
 */
export declare function Orchestrator_GenerateGraph(receiver: GoPtr<Orchestrator>, oldTasks: GoPtr<SyncMap>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Start","kind":"method","status":"implemented","sigHash":"72d2253f47f06d4f835deebdd88a0f4311c20683113bd4562c8b742de70fadd4","bodyHash":"04f53d05a08f5a0c01b6ba34ba87f0b88906dc900679bbeeb3b08efd4517b781"}
 *
 * Go source:
 * func (o *Orchestrator) Start() tsc.CommandLineResult {
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		o.watchStatusReporter(ast.NewCompilerDiagnostic(diagnostics.Starting_compilation_in_watch_mode))
 * 	}
 * 	o.GenerateGraph(nil)
 * 	result := o.buildOrClean()
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		o.Watch()
 * 		result.Watcher = o
 * 	}
 * 	return result
 * }
 */
export declare function Orchestrator_Start(receiver: GoPtr<Orchestrator>): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Watch","kind":"method","status":"implemented","sigHash":"32f25fe26837c2ce16ef240d6f7edc7e9b2fa184a324d2396dca322f114688d1","bodyHash":"fc35bb0a775f937e29e712e9bf669b31db8dc27ed3afc71dccac79a5752eb36f"}
 *
 * Go source:
 * func (o *Orchestrator) Watch() {
 * 	o.updateWatch()
 * 	o.resetCaches()
 *
 * 	// Start watching for file changes
 * 	if o.opts.Testing == nil {
 * 		watchInterval := o.opts.Command.WatchOptions.WatchInterval()
 * 		for {
 * 			// Testing mode: run a single cycle and exit
 * 			time.Sleep(watchInterval)
 * 			o.DoCycle()
 * 		}
 * 	}
 * }
 */
export declare function Orchestrator_Watch(receiver: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.updateWatch","kind":"method","status":"implemented","sigHash":"218642ad6c3469aad6172a9e74ede9f4e4b3fdbaa9b0d8bb5632c9fc24105acb","bodyHash":"e12c9ed62a55b971ba42148f882fa9177c659094ad824046eb9ed92650e96cbf"}
 *
 * Go source:
 * func (o *Orchestrator) updateWatch() {
 * 	oldCache := o.host.mTimes
 * 	o.host.mTimes = &collections.SyncMap[tspath.Path, time.Time]{}
 * 	o.rangeTask(func(path tspath.Path, task *BuildTask) {
 * 		task.updateWatch(o, oldCache)
 * 	})
 * }
 */
export declare function Orchestrator_updateWatch(receiver: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.resetCaches","kind":"method","status":"implemented","sigHash":"6f412b8cdfba3231f801add4772a3c2119ffe5da7faf908703e3f75f0a233891","bodyHash":"fe4d07e47deb072bbe6569496a0a2327ccfda4d89b66f833660a2d86f5c70898"}
 *
 * Go source:
 * func (o *Orchestrator) resetCaches() {
 * 	// Clean out all the caches
 * 	cachesVfs := o.host.host.FS().(*cachedvfs.FS)
 * 	cachesVfs.ClearCache()
 * 	o.host.extendedConfigCache = tsc.ExtendedConfigCache{}
 * 	o.host.sourceFiles.reset()
 * 	o.host.configTimes = collections.SyncMap[tspath.Path, time.Duration]{}
 * }
 */
export declare function Orchestrator_resetCaches(receiver: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.DoCycle","kind":"method","status":"implemented","sigHash":"640ff407c09d9786aebcad8d144723150eab5e178d0af93c3f933d63211b0fc1","bodyHash":"bc85a31c27c89f3120b5e823a12c49dc5bd468a6384f3c77a907db2b214badf3"}
 *
 * Go source:
 * func (o *Orchestrator) DoCycle() {
 * 	var needsConfigUpdate atomic.Bool
 * 	var needsUpdate atomic.Bool
 * 	mTimes := o.host.mTimes.Clone()
 * 	o.rangeTask(func(path tspath.Path, task *BuildTask) {
 * 		if updateKind := task.hasUpdate(o, path); updateKind != updateKindNone {
 * 			needsUpdate.Store(true)
 * 			if updateKind == updateKindConfig {
 * 				needsConfigUpdate.Store(true)
 * 			}
 * 		}
 * 	})
 *
 * 	if !needsUpdate.Load() {
 * 		o.host.mTimes = mTimes
 * 		o.resetCaches()
 * 		return
 * 	}
 *
 * 	o.watchStatusReporter(ast.NewCompilerDiagnostic(diagnostics.File_change_detected_Starting_incremental_compilation))
 * 	if needsConfigUpdate.Load() {
 * 		// Generate new tasks
 * 		o.GenerateGraphReusingOldTasks()
 * 	}
 *
 * 	o.buildOrClean()
 * 	o.updateWatch()
 * 	o.resetCaches()
 * }
 */
export declare function Orchestrator_DoCycle(receiver: GoPtr<Orchestrator>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.buildOrClean","kind":"method","status":"implemented","sigHash":"7d5f56d191ca2a8f9d05270b4da82798ad439398eca2dc68d650841d8dc293df","bodyHash":"88ac0456847aa9d5045c16d1a9046e9534c7dce6b3f83c5cdec3e43990285fcc"}
 *
 * Go source:
 * func (o *Orchestrator) buildOrClean() tsc.CommandLineResult {
 * 	if !o.opts.Command.BuildOptions.Clean.IsTrue() && o.opts.Command.BuildOptions.Verbose.IsTrue() {
 * 		o.createBuilderStatusReporter(nil)(ast.NewCompilerDiagnostic(
 * 			diagnostics.Projects_in_this_build_Colon_0,
 * 			strings.Join(core.Map(o.Order(), func(p string) string {
 * 				return "\r\n    * " + o.relativeFileName(p)
 * 			}), ""),
 * 		))
 * 	}
 * 	var buildResult orchestratorResult
 * 	if len(o.errors) == 0 {
 * 		buildResult.statistics.Projects = len(o.Order())
 * 		o.rangeTask(func(path tspath.Path, task *BuildTask) {
 * 			o.buildOrCleanProject(task, path, &buildResult)
 * 		})
 * 	} else {
 * 		// Circularity errors prevent any project from being built
 * 		buildResult.result.Status = tsc.ExitStatusProjectReferenceCycle_OutputsSkipped
 * 		reportDiagnostic := o.createDiagnosticReporter(nil)
 * 		for _, err := range o.errors {
 * 			reportDiagnostic(err)
 * 		}
 * 		buildResult.errors = o.errors
 * 	}
 * 	buildResult.report(o)
 * 	return buildResult.result
 * }
 */
export declare function Orchestrator_buildOrClean(receiver: GoPtr<Orchestrator>): CommandLineResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.rangeTask","kind":"method","status":"implemented","sigHash":"c4b50a219b88c1e7ec3b1256d39ac98a97be09a55a8454631350f17e5bc19ad4","bodyHash":"659a424cabd1c3239753710c7f79a5ba56041d2200f577e3c31f3e8d52e50805"}
 *
 * Go source:
 * func (o *Orchestrator) rangeTask(f func(path tspath.Path, task *BuildTask)) {
 * 	numRoutines := 4
 * 	if o.opts.Command.CompilerOptions.SingleThreaded.IsTrue() {
 * 		numRoutines = 1
 * 	} else if builders := o.opts.Command.BuildOptions.Builders; builders != nil {
 * 		numRoutines = *builders
 * 	}
 *
 * 	var currentTaskIndex atomic.Int64
 * 	getNextTask := func() (tspath.Path, *BuildTask, bool) {
 * 		index := int(currentTaskIndex.Add(1) - 1)
 * 		if index >= len(o.order) {
 * 			return "", nil, false
 * 		}
 * 		config := o.order[index]
 * 		path := o.toPath(config)
 * 		task := o.getTask(path)
 * 		return path, task, true
 * 	}
 * 	runTask := func() {
 * 		for path, task, ok := getNextTask(); ok; path, task, ok = getNextTask() {
 * 			f(path, task)
 * 		}
 * 	}
 *
 * 	if numRoutines == 1 {
 * 		runTask()
 * 	} else {
 * 		wg := core.NewWorkGroup(false)
 * 		for range numRoutines {
 * 			wg.Queue(runTask)
 * 		}
 * 		wg.RunAndWait()
 * 	}
 * }
 */
export declare function Orchestrator_rangeTask(receiver: GoPtr<Orchestrator>, f: (path: Path, task: GoPtr<BuildTask>) => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.buildOrCleanProject","kind":"method","status":"implemented","sigHash":"1fe90a62f3e8d0f67ade2d3b056d1511c739e6bce2ef44d2f38b28503225a083","bodyHash":"9c8b3bb4a7a120085a1feb0288f06bd91c55c47c1aff26cd1f56e21b46963b7f"}
 *
 * Go source:
 * func (o *Orchestrator) buildOrCleanProject(task *BuildTask, path tspath.Path, buildResult *orchestratorResult) {
 * 	task.result = &taskResult{}
 * 	task.result.reportStatus = o.createBuilderStatusReporter(task)
 * 	task.result.diagnosticReporter = o.createDiagnosticReporter(task)
 * 	if !o.opts.Command.BuildOptions.Clean.IsTrue() {
 * 		task.buildProject(o, path)
 * 	} else {
 * 		task.cleanProject(o, path)
 * 	}
 * 	task.report(o, path, buildResult)
 * }
 */
export declare function Orchestrator_buildOrCleanProject(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>, path: Path, buildResult: GoPtr<orchestratorResult>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.getWriter","kind":"method","status":"implemented","sigHash":"eb31e4ddd1f9d2150d9180a488576cad040605f79e0fc3515053d60ad08a916b","bodyHash":"d2bf80af84724134737bd5fd3fb39b774a888effd1f2f0c0372acd83cae2bd23"}
 *
 * Go source:
 * func (o *Orchestrator) getWriter(task *BuildTask) io.Writer {
 * 	if task == nil {
 * 		return o.opts.Sys.Writer()
 * 	}
 * 	return &task.result.builder
 * }
 */
export declare function Orchestrator_getWriter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): Writer;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.createBuilderStatusReporter","kind":"method","status":"implemented","sigHash":"6e00f36032a39c9ef392399b0e87a956867a3efb0a14c29e98ec6711d7c6316b","bodyHash":"60499118067602279b4673b4653c9d6af2bf4b4f5412899c6630632eb483fcea"}
 *
 * Go source:
 * func (o *Orchestrator) createBuilderStatusReporter(task *BuildTask) tsc.DiagnosticReporter {
 * 	return tsc.CreateBuilderStatusReporter(o.opts.Sys, o.getWriter(task), o.opts.Command.Locale(), o.opts.Command.CompilerOptions, o.opts.Testing)
 * }
 */
export declare function Orchestrator_createBuilderStatusReporter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): DiagnosticReporter;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.createDiagnosticReporter","kind":"method","status":"implemented","sigHash":"737739d0bc4bc0efb4d794ff61c7d898082f295487378cb9bc77eb1f84fd2dc9","bodyHash":"fc665a57c15d5bafd44fec3d7c45c3e77dd42e2562e984a7a502c66dfed8275c"}
 *
 * Go source:
 * func (o *Orchestrator) createDiagnosticReporter(task *BuildTask) tsc.DiagnosticReporter {
 * 	return tsc.CreateDiagnosticReporter(o.opts.Sys, o.getWriter(task), o.opts.Command.Locale(), o.opts.Command.CompilerOptions)
 * }
 */
export declare function Orchestrator_createDiagnosticReporter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): DiagnosticReporter;
export declare function NewOrchestrator(opts: Options): GoPtr<Orchestrator>;
//# sourceMappingURL=orchestrator.d.ts.map
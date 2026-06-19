import type { bool, int } from "../../../go/scalars.js";
import type { GoComparable, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import type { Writer } from "../../../go/io.js";
import type { Time } from "../../../go/time.js";
import { NewCompilerDiagnostic } from "../../ast/diagnostic.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { Set_Has, Set_Add, NewSetFromItems } from "../../collections/set.js";
import type { Set } from "../../collections/set.js";
import { SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Store, SyncMap_Clone, SyncMap_Range } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import { Map as core_Map, LastOrNil, IfElse } from "../../core/core.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { NewWorkGroup } from "../../core/workgroup.js";
import type { WorkGroup } from "../../core/workgroup.js";
import * as diagnostics from "../../diagnostics/generated/messages.js";
import { ParsedBuildCommandLine_ResolvedProjectPaths, ParsedBuildCommandLine_Locale } from "../../tsoptions/parsedbuildcommandline.js";
import type { ParsedBuildCommandLine } from "../../tsoptions/parsedbuildcommandline.js";
import { ParsedCommandLine_ResolvedProjectReferencePaths, ParsedCommandLine_ProjectReferences } from "../../tsoptions/parsedcommandline.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { ConvertToRelativePath, ToPath } from "../../tspath/path.js";
import type { ComparePathsOptions, Path } from "../../tspath/path.js";
import { CreateWatchStatusReporter, CreateReportErrorSummary, CreateBuilderStatusReporter, CreateDiagnosticReporter } from "../tsc/diagnostics.js";
import type { CommandLineResult, CommandLineTesting, System, Watcher } from "../tsc/compile.js";
import { ExitStatusProjectReferenceCycle_OutputsSkipped } from "../tsc/compile.js";
import type { DiagnosticReporter, DiagnosticsReporter } from "../tsc/diagnostics.js";
import { Statistics_SetTotalTime, Statistics_Report, Statistics_Aggregate } from "../tsc/statistics.js";
import type { Statistics } from "../tsc/statistics.js";
import { NewCachedFSCompilerHost } from "../../compiler/host.js";
import type { FS } from "../../vfs/vfs.js";
import { GetTraceWithWriterFromSys } from "../tsc/emit.js";
import { BuildTask_report, BuildTask_buildProject, BuildTask_cleanProject, BuildTask_updateWatch, BuildTask_resetStatus, BuildTask_resetConfig, BuildTask_hasUpdate, updateKindNone, updateKindConfig } from "./buildtask.js";
import type { BuildTask } from "./buildtask.js";
import { host_GetResolvedProjectReference, host_storeMTimeFromOldCache } from "./host.js";
import { parseCache_reset } from "./parseCache.js";
import { FS_ClearCache } from "../../vfs/cachedvfs/cachedvfs.js";
import type { FS as cachedvfs_FS } from "../../vfs/cachedvfs/cachedvfs.js";
import type { ExtendedConfigCache } from "../tsc/extendedconfigcache.js";
import type { host } from "./host.js";
import { Bool } from "../../../go/sync/atomic.js";
import { Map as SyncGoMap } from "../../../go/sync.js";
import * as strings from "../../../go/strings.js";
import { Builder } from "../../../go/strings.js";
import type { parseCache } from "./parseCache.js";

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
export function orchestratorResult_report(receiver: GoPtr<orchestratorResult>, o: GoPtr<Orchestrator>): void {
  if (Tristate_IsTrue(o!.opts.Command!.CompilerOptions!.Watch)) {
    o!.watchStatusReporter!(NewCompilerDiagnostic(
      IfElse(receiver!.errors.length === 1, diagnostics.Found_1_error_Watching_for_file_changes, diagnostics.Found_0_errors_Watching_for_file_changes),
      receiver!.errors.length,
    ));
  } else {
    o!.errorSummaryReporter!(receiver!.errors);
  }
  if (receiver!.filesToDelete !== undefined && receiver!.filesToDelete !== null) {
    Orchestrator_createBuilderStatusReporter(o, undefined)(
      NewCompilerDiagnostic(
        diagnostics.A_non_dry_build_would_delete_the_following_files_Colon_0,
        strings.Join(core_Map(receiver!.filesToDelete, (f: string): string => "\r\n * " + f), ""),
      ),
    );
  }
  if (!Tristate_IsTrue(o!.opts.Command!.CompilerOptions!.Diagnostics) && !Tristate_IsTrue(o!.opts.Command!.CompilerOptions!.ExtendedDiagnostics)) {
    return;
  }
  Statistics_SetTotalTime(receiver!.statistics, o!.opts.Sys.SinceStart());
  Statistics_Report(receiver!.statistics, o!.opts.Sys.Writer(), o!.opts.Testing);
}

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
  tasks: GoPtr<SyncMap<Path, GoPtr<BuildTask>>>;
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
export let __a05f111f_0: Watcher = Orchestrator_as_tsc_Watcher(undefined);

export function Orchestrator_as_tsc_Watcher(receiver: GoPtr<Orchestrator>): Watcher {
  return {
    DoCycle: (): void => Orchestrator_DoCycle(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.relativeFileName","kind":"method","status":"implemented","sigHash":"72ff97cf7be6af75d0bcb0a972d3c887eec0137ae80fdd7bf9ec0abf11edc9b4","bodyHash":"ff945d4da9c439fd6783fed02507cb9daab99b679d06699e3d94c0ebfe74591a"}
 *
 * Go source:
 * func (o *Orchestrator) relativeFileName(fileName string) string {
 * 	return tspath.ConvertToRelativePath(fileName, o.comparePathsOptions)
 * }
 */
export function Orchestrator_relativeFileName(receiver: GoPtr<Orchestrator>, fileName: string): string {
  return ConvertToRelativePath(fileName, receiver!.comparePathsOptions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.toPath","kind":"method","status":"implemented","sigHash":"9e61b62a405e313d1ad17028e975890f0df3e6fd78ea274d85c7a5b9cc01edf0","bodyHash":"27d7a1b912fa68839612692b556aa464ef54d9b75be35d445a69f2b54dfa83b8"}
 *
 * Go source:
 * func (o *Orchestrator) toPath(fileName string) tspath.Path {
 * 	return tspath.ToPath(fileName, o.comparePathsOptions.CurrentDirectory, o.comparePathsOptions.UseCaseSensitiveFileNames)
 * }
 */
export function Orchestrator_toPath(receiver: GoPtr<Orchestrator>, fileName: string): Path {
  return ToPath(fileName, receiver!.comparePathsOptions.CurrentDirectory, receiver!.comparePathsOptions.UseCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Order","kind":"method","status":"implemented","sigHash":"1301e30f674ef1c608aefd50ccd0739e9612b69d9bfa3960f0ef286873c97219","bodyHash":"4d8ffbdd713ca06f0061502658a991f0f4b41925550afae89b90caedec18b6c3"}
 *
 * Go source:
 * func (o *Orchestrator) Order() []string {
 * 	return o.order
 * }
 */
export function Orchestrator_Order(receiver: GoPtr<Orchestrator>): GoSlice<string> {
  return receiver!.order;
}

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
export function Orchestrator_Upstream(receiver: GoPtr<Orchestrator>, configName: string): GoSlice<string> {
  const path = Orchestrator_toPath(receiver, configName);
  const task = Orchestrator_getTask(receiver, path);
  return core_Map(task!.upStream, (t) => t!.task!.config);
}

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
export function Orchestrator_Downstream(receiver: GoPtr<Orchestrator>, configName: string): GoSlice<string> {
  const path = Orchestrator_toPath(receiver, configName);
  const task = Orchestrator_getTask(receiver, path);
  return core_Map(task!.downStream, (t) => t!.config);
}

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
export function Orchestrator_getTask(receiver: GoPtr<Orchestrator>, path: Path): GoPtr<BuildTask> {
  const [task, ok] = SyncMap_Load(receiver!.tasks, path);
  if (!ok) {
    throw new globalThis.Error("No build task found for " + path);
  }
  return task as GoPtr<BuildTask>;
}

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
export function Orchestrator_createBuildTasks(receiver: GoPtr<Orchestrator>, oldTasks: GoPtr<SyncMap<Path, GoPtr<BuildTask>>>, configs: GoSlice<string>, wg: WorkGroup): void {
  for (const config of configs) {
    wg.Queue((): void => {
      const path = Orchestrator_toPath(receiver, config);
      let task: GoPtr<BuildTask> = undefined;
      let buildInfo = undefined;
      if (oldTasks !== undefined) {
        const [existing, ok] = SyncMap_Load(oldTasks, path);
        if (ok) {
          const existingTask = existing as GoPtr<BuildTask>;
          if (!existingTask!.dirty) {
            task = existingTask;
          } else {
            buildInfo = existingTask!.buildInfoEntry;
          }
        }
      }
      if (task === undefined) {
        const pending = new Bool();
        task = {
          config,
          resolved: undefined,
          upStream: [],
          downStream: [],
          status: undefined,
          done: {} as BuildTask["done"],
          result: undefined,
          prevReporter: undefined,
          reportDone: {} as BuildTask["reportDone"],
          configTime: {} as Time,
          extendedConfigTimes: [],
          inputFiles: [],
          buildInfoEntry: buildInfo,
          buildInfoEntryMu: { Lock: () => {}, Unlock: () => {}, TryLock: () => true } as BuildTask["buildInfoEntryMu"],
          errors: [],
          pending,
          isInitialCycle: oldTasks === undefined,
          downStreamUpdateMu: { Lock: () => {}, Unlock: () => {}, TryLock: () => true } as BuildTask["downStreamUpdateMu"],
          dirty: false,
        };
        task!.pending.Store(true as bool);
        task!.buildInfoEntry = buildInfo;
      }
      const [, loaded] = SyncMap_LoadOrStore(receiver!.tasks, path, task);
      if (loaded) {
        return;
      }
      task!.resolved = host_GetResolvedProjectReference(receiver!.host, config, path);
      task!.upStream = [];
      if (task!.resolved !== undefined) {
        const refPaths = ParsedCommandLine_ResolvedProjectReferencePaths(task!.resolved);
        Orchestrator_createBuildTasks(receiver, oldTasks, refPaths, wg);
      }
    });
  }
}

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
export function Orchestrator_setupBuildTask(receiver: GoPtr<Orchestrator>, configName: string, downStream: GoPtr<BuildTask>, inCircularContext: bool, completed: GoPtr<Set<Path>>, analyzing: GoPtr<Set<Path>>, circularityStack: GoSlice<string>): GoPtr<BuildTask> {
  const path = Orchestrator_toPath(receiver, configName);
  const task = Orchestrator_getTask(receiver, path);
  if (!Set_Has(completed, path)) {
    if (Set_Has(analyzing, path)) {
      if (!inCircularContext) {
        receiver!.errors.push(NewCompilerDiagnostic(
          diagnostics.Project_references_may_not_form_a_circular_graph_Cycle_detected_Colon_0,
          strings.Join(circularityStack, "\n"),
        ));
      }
      return undefined;
    }
    Set_Add(analyzing, path);
    circularityStack = [...circularityStack, configName];
    if (task!.resolved !== undefined) {
      const subRefs = ParsedCommandLine_ResolvedProjectReferencePaths(task!.resolved);
      const projectRefs = ParsedCommandLine_ProjectReferences(task!.resolved);
      for (let index = 0; index < subRefs.length; index++) {
        const subReference = subRefs[index]!;
        const upstream = Orchestrator_setupBuildTask(receiver, subReference, task, (inCircularContext || projectRefs[index]!.Circular) as bool, completed, analyzing, circularityStack);
        if (upstream !== undefined) {
          task!.upStream.push({ task: upstream, refIndex: index });
        }
      }
    }
    circularityStack = circularityStack.slice(0, circularityStack.length - 1);
    Set_Add(completed, path);
    task!.reportDone = {} as BuildTask["reportDone"];
    const prev = LastOrNil(receiver!.order);
    if (prev !== "") {
      task!.prevReporter = Orchestrator_getTask(receiver, Orchestrator_toPath(receiver, prev));
    }
    task!.done = {} as BuildTask["done"];
    receiver!.order.push(configName);
  }
  if (Tristate_IsTrue(receiver!.opts.Command!.CompilerOptions!.Watch) && downStream !== undefined) {
    task!.downStream.push(downStream);
  }
  return task;
}

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
export function Orchestrator_GenerateGraphReusingOldTasks(receiver: GoPtr<Orchestrator>): void {
  const tasks = receiver!.tasks;
  receiver!.tasks = newSyncMap<Path, GoPtr<BuildTask>>();
  receiver!.order = [];
  receiver!.errors = [];
  Orchestrator_GenerateGraph(receiver, tasks);
}

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
export function Orchestrator_GenerateGraph(receiver: GoPtr<Orchestrator>, oldTasks: GoPtr<SyncMap<Path, GoPtr<BuildTask>>>): void {
  const projects = ParsedBuildCommandLine_ResolvedProjectPaths(receiver!.opts.Command);
  const wg = NewWorkGroup(Tristate_IsTrue(receiver!.opts.Command!.CompilerOptions!.SingleThreaded));
  Orchestrator_createBuildTasks(receiver, oldTasks, projects, wg);
  wg.RunAndWait();

  const completed: Set<Path> = {} as Set<Path>;
  const analyzing: Set<Path> = {} as Set<Path>;
  const circularityStack: GoSlice<string> = [];
  for (const project of projects) {
    Orchestrator_setupBuildTask(receiver, project, undefined, false as bool, completed, analyzing, circularityStack);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Start","kind":"method","status":"implemented","sigHash":"0262ef5622e64e786c5441a5853ea21c76e8a20aa686c24179e144412a923b89","bodyHash":"9b1c7dea303633b2c3b13b0619e942ee19321e384be7627900742afec2c87dfe"}
 *
 * Go source:
 * func (o *Orchestrator) Start(ctx context.Context) tsc.CommandLineResult {
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		o.watchStatusReporter(ast.NewCompilerDiagnostic(diagnostics.Starting_compilation_in_watch_mode))
 * 	}
 * 	o.GenerateGraph(nil)
 * 	result := o.buildOrClean()
 * 	if o.opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		o.Watch(ctx)
 * 		result.Watcher = o
 * 	}
 * 	return result
 * }
 */
export function Orchestrator_Start(receiver: GoPtr<Orchestrator>, ctx: Context): CommandLineResult {
  if (Tristate_IsTrue(receiver!.opts.Command!.CompilerOptions!.Watch)) {
    receiver!.watchStatusReporter!(NewCompilerDiagnostic(diagnostics.Starting_compilation_in_watch_mode));
  }
  Orchestrator_GenerateGraph(receiver, undefined);
  const result = Orchestrator_buildOrClean(receiver);
  if (Tristate_IsTrue(receiver!.opts.Command!.CompilerOptions!.Watch)) {
    Orchestrator_Watch(receiver, ctx);
    result.Watcher = Orchestrator_as_tsc_Watcher(receiver);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.Watch","kind":"method","status":"implemented","sigHash":"3a5d894f9edb920da49f99bb7ba9f2c595d97d3d4fcd5f67246ea84066ad4839","bodyHash":"b50b16f6fc23b9e22cbdf28744e5dd67df3de1c59667fcbde9f7a031f6042df2"}
 *
 * Go source:
 * func (o *Orchestrator) Watch(ctx context.Context) {
 * 	o.updateWatch()
 * 	o.resetCaches()
 *
 * 	// Start watching for file changes
 * 	if o.opts.Testing == nil {
 * 		watchInterval := o.opts.Command.WatchOptions.WatchInterval()
 * 		ticker := time.NewTicker(watchInterval)
 * 		defer ticker.Stop()
 * 		for {
 * 			select {
 * 			case <-ctx.Done():
 * 				return
 * 			case <-ticker.C:
 * 				o.DoCycle()
 * 			}
 * 		}
 * 	}
 * }
 */
export function Orchestrator_Watch(receiver: GoPtr<Orchestrator>, ctx: Context): void {
  void ctx;
  Orchestrator_updateWatch(receiver);
  Orchestrator_resetCaches(receiver);
  // In single-threaded TSTS, no goroutine loop; testing mode only
  if (receiver!.opts.Testing === undefined || receiver!.opts.Testing === null) {
    // Non-test: the go code would block forever in a ticker/ctx.Done() select
    // loop calling o.DoCycle() — no-op in single-threaded JS.
  }
}

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
export function Orchestrator_updateWatch(receiver: GoPtr<Orchestrator>): void {
  const oldCache = receiver!.host!.mTimes;
  receiver!.host!.mTimes = newSyncMap();
  Orchestrator_rangeTask(receiver, (_path: Path, task: GoPtr<BuildTask>): void => {
    BuildTask_updateWatch(task, receiver, oldCache);
  });
}

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
export function Orchestrator_resetCaches(receiver: GoPtr<Orchestrator>): void {
  const cachesVfs = receiver!.host!.host.FS() as unknown as cachedvfs_FS;
  FS_ClearCache(cachesVfs);
  receiver!.host!.extendedConfigCache = { m: newSyncMap() };
  parseCache_reset(receiver!.host!.sourceFiles);
  receiver!.host!.configTimes = newSyncMap();
}

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
export function Orchestrator_DoCycle(receiver: GoPtr<Orchestrator>): void {
  const needsConfigUpdate = new Bool();
  const needsUpdate = new Bool();
  const mTimes = SyncMap_Clone(receiver!.host!.mTimes);
  Orchestrator_rangeTask(receiver, (path: Path, task: GoPtr<BuildTask>): void => {
    const kind = BuildTask_hasUpdate(task, receiver, path);
    if (kind !== updateKindNone) {
      needsUpdate.Store(true as bool);
      if (kind === updateKindConfig) {
        needsConfigUpdate.Store(true as bool);
      }
    }
  });

  if (!needsUpdate.Load()) {
    receiver!.host!.mTimes = mTimes;
    Orchestrator_resetCaches(receiver);
    return;
  }

  receiver!.watchStatusReporter!(NewCompilerDiagnostic(diagnostics.File_change_detected_Starting_incremental_compilation));
  if (needsConfigUpdate.Load()) {
    Orchestrator_GenerateGraphReusingOldTasks(receiver);
  }

  Orchestrator_buildOrClean(receiver);
  Orchestrator_updateWatch(receiver);
  Orchestrator_resetCaches(receiver);
}

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
export function Orchestrator_buildOrClean(receiver: GoPtr<Orchestrator>): CommandLineResult {
  if (!Tristate_IsTrue(receiver!.opts.Command!.BuildOptions!.Clean) && Tristate_IsTrue(receiver!.opts.Command!.BuildOptions!.Verbose)) {
    Orchestrator_createBuilderStatusReporter(receiver, undefined)(NewCompilerDiagnostic(
      diagnostics.Projects_in_this_build_Colon_0,
      strings.Join(core_Map(Orchestrator_Order(receiver), (p: string): string => "\r\n    * " + Orchestrator_relativeFileName(receiver, p)), ""),
    ));
  }
  const buildResult: orchestratorResult = {
    result: { Status: 0 as import("../tsc/compile.js").ExitStatus, Watcher: undefined },
    errors: [],
    statistics: {
      Projects: 0,
      ProjectsBuilt: 0,
      TimestampUpdates: 0,
    } as import("../tsc/statistics.js").Statistics,
    filesToDelete: [],
  };
  if (receiver!.errors.length === 0) {
    buildResult.statistics.Projects = Orchestrator_Order(receiver).length;
    Orchestrator_rangeTask(receiver, (path: Path, task: GoPtr<BuildTask>): void => {
      Orchestrator_buildOrCleanProject(receiver, task, path, buildResult);
    });
  } else {
    // Circularity errors prevent any project from being built
    buildResult.result.Status = ExitStatusProjectReferenceCycle_OutputsSkipped;
    const reportDiagnostic = Orchestrator_createDiagnosticReporter(receiver, undefined);
    for (const err of receiver!.errors) {
      reportDiagnostic(err);
    }
    buildResult.errors = receiver!.errors;
  }
  orchestratorResult_report(buildResult, receiver);
  return buildResult.result;
}

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
export function Orchestrator_rangeTask(receiver: GoPtr<Orchestrator>, f: (path: Path, task: GoPtr<BuildTask>) => void): void {
  // In single-threaded TSTS, always run sequentially (numRoutines = 1)
  let currentTaskIndex = 0;
  while (currentTaskIndex < receiver!.order.length) {
    const index = currentTaskIndex;
    currentTaskIndex++;
    const config = receiver!.order[index]!;
    const path = Orchestrator_toPath(receiver, config);
    const task = Orchestrator_getTask(receiver, path);
    f(path, task);
  }
}

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
export function Orchestrator_buildOrCleanProject(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>, path: Path, buildResult: GoPtr<orchestratorResult>): void {
  task!.result = {
    builder: new Builder(),
    reportStatus: undefined as unknown as import("../tsc/diagnostics.js").DiagnosticReporter,
    diagnosticReporter: undefined as unknown as import("../tsc/diagnostics.js").DiagnosticReporter,
    exitStatus: 0 as import("../tsc/compile.js").ExitStatus,
    statistics: undefined,
    program: undefined,
    buildKind: 0 as import("./buildtask.js").buildKind,
    filesToDelete: [],
  };
  task!.result.reportStatus = Orchestrator_createBuilderStatusReporter(receiver, task);
  task!.result.diagnosticReporter = Orchestrator_createDiagnosticReporter(receiver, task);
  if (!Tristate_IsTrue(receiver!.opts.Command!.BuildOptions!.Clean)) {
    BuildTask_buildProject(task, receiver, path);
  } else {
    BuildTask_cleanProject(task, receiver, path);
  }
  BuildTask_report(task, receiver, path, buildResult);
}

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
export function Orchestrator_getWriter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): Writer {
  if (task === undefined || task === null) {
    return receiver!.opts.Sys.Writer();
  }
  return task!.result!.builder as unknown as Writer;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.createBuilderStatusReporter","kind":"method","status":"implemented","sigHash":"6e00f36032a39c9ef392399b0e87a956867a3efb0a14c29e98ec6711d7c6316b","bodyHash":"60499118067602279b4673b4653c9d6af2bf4b4f5412899c6630632eb483fcea"}
 *
 * Go source:
 * func (o *Orchestrator) createBuilderStatusReporter(task *BuildTask) tsc.DiagnosticReporter {
 * 	return tsc.CreateBuilderStatusReporter(o.opts.Sys, o.getWriter(task), o.opts.Command.Locale(), o.opts.Command.CompilerOptions, o.opts.Testing)
 * }
 */
export function Orchestrator_createBuilderStatusReporter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): DiagnosticReporter {
  return CreateBuilderStatusReporter(receiver!.opts.Sys, Orchestrator_getWriter(receiver, task), ParsedBuildCommandLine_Locale(receiver!.opts.Command), receiver!.opts.Command!.CompilerOptions, receiver!.opts.Testing);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::method::Orchestrator.createDiagnosticReporter","kind":"method","status":"implemented","sigHash":"737739d0bc4bc0efb4d794ff61c7d898082f295487378cb9bc77eb1f84fd2dc9","bodyHash":"fc665a57c15d5bafd44fec3d7c45c3e77dd42e2562e984a7a502c66dfed8275c"}
 *
 * Go source:
 * func (o *Orchestrator) createDiagnosticReporter(task *BuildTask) tsc.DiagnosticReporter {
 * 	return tsc.CreateDiagnosticReporter(o.opts.Sys, o.getWriter(task), o.opts.Command.Locale(), o.opts.Command.CompilerOptions)
 * }
 */
export function Orchestrator_createDiagnosticReporter(receiver: GoPtr<Orchestrator>, task: GoPtr<BuildTask>): DiagnosticReporter {
  return CreateDiagnosticReporter(receiver!.opts.Sys, Orchestrator_getWriter(receiver, task), ParsedBuildCommandLine_Locale(receiver!.opts.Command), receiver!.opts.Command!.CompilerOptions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/orchestrator.go::func::NewOrchestrator","kind":"func","status":"implemented","sigHash":"6c0049265dfb54baf9553d2875da47942e66e5689268add560602a85932d4175","bodyHash":"7215170db8f3e4e173d2d82f1bc476b230b571c69d88d2452f042b85385c0bd7"}
 *
 * Go source:
 * func NewOrchestrator(opts Options) *Orchestrator {
 * 	orchestrator := &Orchestrator{
 * 		opts: opts,
 * 		comparePathsOptions: tspath.ComparePathsOptions{
 * 			CurrentDirectory:          opts.Sys.GetCurrentDirectory(),
 * 			UseCaseSensitiveFileNames: opts.Sys.FS().UseCaseSensitiveFileNames(),
 * 		},
 * 		tasks: &collections.SyncMap[tspath.Path, *BuildTask]{},
 * 	}
 * 	orchestrator.host = &host{
 * 		orchestrator: orchestrator,
 * 		host: compiler.NewCachedFSCompilerHost(
 * 			orchestrator.opts.Sys.GetCurrentDirectory(),
 * 			orchestrator.opts.Sys.FS(),
 * 			orchestrator.opts.Sys.DefaultLibraryPath(),
 * 			nil,
 * 			nil,
 * 		),
 * 		mTimes: &collections.SyncMap[tspath.Path, time.Time]{},
 * 	}
 * 	if opts.Command.CompilerOptions.Watch.IsTrue() {
 * 		orchestrator.watchStatusReporter = tsc.CreateWatchStatusReporter(opts.Sys, opts.Command.Locale(), opts.Command.CompilerOptions, opts.Testing)
 * 	} else {
 * 		orchestrator.errorSummaryReporter = tsc.CreateReportErrorSummary(opts.Sys, opts.Command.Locale(), opts.Command.CompilerOptions)
 * 	}
 * 	return orchestrator
 * }
 */
function newSyncMap<K extends GoComparable = unknown, V = unknown>(): SyncMap<K, V> {
  return { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<K, V>;
}

function newParseCache(): parseCache {
  return { entries: newSyncMap() };
}

export function NewOrchestrator(opts: Options): GoPtr<Orchestrator> {
  const orchestrator: Orchestrator = {
    opts,
    comparePathsOptions: {
      CurrentDirectory: opts.Sys.GetCurrentDirectory(),
      UseCaseSensitiveFileNames: opts.Sys.FS().UseCaseSensitiveFileNames(),
    },
    host: undefined,
    tasks: newSyncMap<Path, GoPtr<BuildTask>>(),
    order: [],
    errors: [],
    errorSummaryReporter: undefined,
    watchStatusReporter: undefined,
  };
  const extendedConfigCache: ExtendedConfigCache = { m: newSyncMap() };
  const innerHost: host = {
    orchestrator,
    host: NewCachedFSCompilerHost(
      orchestrator.opts.Sys.GetCurrentDirectory(),
      orchestrator.opts.Sys.FS(),
      orchestrator.opts.Sys.DefaultLibraryPath(),
      undefined,
      undefined,
    ),
    extendedConfigCache,
    sourceFiles: newParseCache() as unknown as host["sourceFiles"],
    configTimes: newSyncMap(),
    resolvedReferences: newParseCache() as unknown as host["resolvedReferences"],
    mTimes: newSyncMap(),
  };
  orchestrator.host = innerHost;
  if (Tristate_IsTrue(opts.Command!.CompilerOptions!.Watch)) {
    orchestrator.watchStatusReporter = CreateWatchStatusReporter(opts.Sys, ParsedBuildCommandLine_Locale(opts.Command), opts.Command!.CompilerOptions, opts.Testing);
  } else {
    orchestrator.errorSummaryReporter = CreateReportErrorSummary(opts.Sys, ParsedBuildCommandLine_Locale(opts.Command), opts.Command!.CompilerOptions);
  }
  return orchestrator;
}

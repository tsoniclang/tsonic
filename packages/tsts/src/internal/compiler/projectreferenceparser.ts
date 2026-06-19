import type { GoPtr, GoSlice } from "../../go/compat.js";
import * as maps from "../../go/maps.js";
import { NewSetWithSizeHint, Set_AddIfAbsent } from "../collections/set.js";
import type { Set } from "../collections/set.js";
import { SyncMap_LoadOrStore, SyncMap_Size } from "../collections/syncmap.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { WorkGroup } from "../core/workgroup.js";
import { ParsedCommandLine_ParseInputOutputNames, ParsedCommandLine_ResolvedProjectReferencePaths, ParsedCommandLine_SourceToProjectReference, ParsedCommandLine_OutputDtsToProjectReference, ParsedCommandLine_CompilerOptions } from "../tsoptions/parsedcommandline.js";
import type { ParsedCommandLine } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import { SourceFile_Path } from "../ast/ast.js";
import { fileLoader_toPath } from "./fileloader.js";
import type { fileLoader } from "./fileloader.js";
import { newProjectReferenceDtsFakingHost } from "./projectreferencedtsfakinghost.js";
import { ProgramOptions_canUseProjectReferenceSource } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::type::projectReferenceParseTask","kind":"type","status":"implemented","sigHash":"9514d364f391763c424a5d6d9a870f7696a4a0508cf83e21635c4aa906ea5617","bodyHash":"61316d916f103188ce2627a23ecbc6ee00c8b0b96c663aa59faec2ba5bf0bbea"}
 *
 * Go source:
 * projectReferenceParseTask struct {
 * 	configName string
 * 	resolved   *tsoptions.ParsedCommandLine
 * 	subTasks   []*projectReferenceParseTask
 * }
 */
export interface projectReferenceParseTask {
  configName: string;
  resolved: GoPtr<ParsedCommandLine>;
  subTasks: GoSlice<GoPtr<projectReferenceParseTask>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::method::projectReferenceParseTask.parse","kind":"method","status":"implemented","sigHash":"01f4a2692f3c05edad6fbcf0a75c1a33f952e05c46780f2c6dc927159117716d","bodyHash":"eebc81de7165a5d5e11ae41636a29dfa93dddd1ab1366fb03a94483dcb11dc09"}
 *
 * Go source:
 * func (t *projectReferenceParseTask) parse(projectReferenceParser *projectReferenceParser) {
 * 	loader := projectReferenceParser.loader
 * 	if tr := loader.opts.Tracing; tr != nil {
 * 		defer tr.Push(tracing.PhaseParse, "parseJsonSourceFileConfigFileContent", map[string]any{"path": t.configName}, false)()
 * 	}
 * 	t.resolved = loader.opts.Host.GetResolvedProjectReference(t.configName, loader.toPath(t.configName))
 * 	if t.resolved == nil {
 * 		return
 * 	}
 * 	t.resolved.ParseInputOutputNames()
 * 	if subReferences := t.resolved.ResolvedProjectReferencePaths(); len(subReferences) > 0 {
 * 		t.subTasks = createProjectReferenceParseTasks(subReferences)
 * 	}
 * }
 */
export function projectReferenceParseTask_parse(receiver: GoPtr<projectReferenceParseTask>, projectReferenceParser: GoPtr<projectReferenceParser>): void {
  const loader = projectReferenceParser!.loader;
  receiver!.resolved = loader!.opts.Host.GetResolvedProjectReference(receiver!.configName, fileLoader_toPath(loader, receiver!.configName));
  if (receiver!.resolved === undefined) {
    return;
  }
  ParsedCommandLine_ParseInputOutputNames(receiver!.resolved);
  const subReferences = ParsedCommandLine_ResolvedProjectReferencePaths(receiver!.resolved);
  if (subReferences.length > 0) {
    receiver!.subTasks = createProjectReferenceParseTasks(subReferences);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::func::createProjectReferenceParseTasks","kind":"func","status":"implemented","sigHash":"87bd6887212bc1e174a4fc5c2c83a0d3222051b7e64ef23576e1aeb7acc5e302","bodyHash":"637ba93f58a168856f04607ef9a1e38a11731f4c2fddb7afd631e7371a3f82d1"}
 *
 * Go source:
 * func createProjectReferenceParseTasks(projectReferences []string) []*projectReferenceParseTask {
 * 	return core.Map(projectReferences, func(configName string) *projectReferenceParseTask {
 * 		return &projectReferenceParseTask{
 * 			configName: configName,
 * 		}
 * 	})
 * }
 */
export function createProjectReferenceParseTasks(projectReferences: GoSlice<string>): GoSlice<GoPtr<projectReferenceParseTask>> {
  return projectReferences.map((configName: string): GoPtr<projectReferenceParseTask> => ({
    configName,
    resolved: undefined,
    subTasks: [],
  }));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::type::projectReferenceParser","kind":"type","status":"implemented","sigHash":"c64552523723c535e1cb26bff3953c5eb82adf8f795bbdf0062ed743f83f0b5e","bodyHash":"531a7505b3fff5943224f1141e5a6780c43a499d36704d73d5e91cd2a86d436f"}
 *
 * Go source:
 * projectReferenceParser struct {
 * 	loader          *fileLoader
 * 	wg              core.WorkGroup
 * 	tasksByFileName collections.SyncMap[tspath.Path, *projectReferenceParseTask]
 * }
 */
export interface projectReferenceParser {
  loader: GoPtr<fileLoader>;
  wg: WorkGroup;
  tasksByFileName: SyncMap<Path, GoPtr<projectReferenceParseTask>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::method::projectReferenceParser.parse","kind":"method","status":"implemented","sigHash":"fabca0594513acc562a1de3803d3edb823a809b562b7d846a3da5de2ce25541b","bodyHash":"155e641e27bd745cac80f977648dcd1dcd4a0be34c31b5c93daabd0b058f595a"}
 *
 * Go source:
 * func (p *projectReferenceParser) parse(tasks []*projectReferenceParseTask) {
 * 	p.loader.projectReferenceFileMapper.loader = p.loader
 * 	p.start(tasks)
 * 	p.wg.RunAndWait()
 * 	p.initMapper(tasks)
 * }
 */
export function projectReferenceParser_parse(receiver: GoPtr<projectReferenceParser>, tasks: GoSlice<GoPtr<projectReferenceParseTask>>): void {
  receiver!.loader!.projectReferenceFileMapper!.loader = receiver!.loader;
  projectReferenceParser_start(receiver, tasks);
  receiver!.wg.RunAndWait();
  projectReferenceParser_initMapper(receiver, tasks);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::method::projectReferenceParser.start","kind":"method","status":"implemented","sigHash":"bbd5662f4ee68086118e0ace4b02a494ea625fb38fc900592e84d0aa29e68ed7","bodyHash":"9c6c18aec3ce73766f76e79736edb824c855a5dbdaa3831cf8adc8841e3f263a"}
 *
 * Go source:
 * func (p *projectReferenceParser) start(tasks []*projectReferenceParseTask) {
 * 	for i, task := range tasks {
 * 		path := p.loader.toPath(task.configName)
 * 		if loadedTask, loaded := p.tasksByFileName.LoadOrStore(path, task); loaded {
 * 			// dedup tasks to ensure correct file order, regardless of which task would be started first
 * 			tasks[i] = loadedTask
 * 		} else {
 * 			p.wg.Queue(func() {
 * 				task.parse(p)
 * 				p.start(task.subTasks)
 * 			})
 * 		}
 * 	}
 * }
 */
export function projectReferenceParser_start(receiver: GoPtr<projectReferenceParser>, tasks: GoSlice<GoPtr<projectReferenceParseTask>>): void {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const path = fileLoader_toPath(receiver!.loader, task!.configName);
    const [loadedTask, loaded] = SyncMap_LoadOrStore<Path, GoPtr<projectReferenceParseTask>>(receiver!.tasksByFileName as SyncMap<Path, GoPtr<projectReferenceParseTask>>, path, task);
    if (loaded) {
      // dedup tasks to ensure correct file order, regardless of which task would be started first
      tasks[i] = loadedTask;
    } else {
      receiver!.wg.Queue((): void => {
        projectReferenceParseTask_parse(task, receiver);
        projectReferenceParser_start(receiver, task!.subTasks);
      });
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::method::projectReferenceParser.initMapper","kind":"method","status":"implemented","sigHash":"744b692876244e1f5a7259f071c2df8d37d25fe56420231219ac3e34dfc91d2e","bodyHash":"d2363da29aa7fdf625a040251059488933f82c68609eba160eef033ca09ee5fd"}
 *
 * Go source:
 * func (p *projectReferenceParser) initMapper(tasks []*projectReferenceParseTask) {
 * 	totalReferences := p.tasksByFileName.Size() + 1
 * 	p.loader.projectReferenceFileMapper.configToProjectReference = make(map[tspath.Path]*tsoptions.ParsedCommandLine, totalReferences)
 * 	p.loader.projectReferenceFileMapper.referencesInConfigFile = make(map[tspath.Path][]tspath.Path, totalReferences)
 * 	p.loader.projectReferenceFileMapper.sourceToProjectReference = make(map[tspath.Path]*tsoptions.SourceOutputAndProjectReference)
 * 	p.loader.projectReferenceFileMapper.outputDtsToProjectReference = make(map[tspath.Path]*tsoptions.SourceOutputAndProjectReference)
 * 	p.loader.projectReferenceFileMapper.referencesInConfigFile[p.loader.opts.Config.ConfigFile.SourceFile.Path()] = p.initMapperWorker(tasks, &collections.Set[*projectReferenceParseTask]{})
 * 	if p.loader.projectReferenceFileMapper.opts.canUseProjectReferenceSource() && len(p.loader.projectReferenceFileMapper.outputDtsToProjectReference) != 0 {
 * 		p.loader.projectReferenceFileMapper.host = newProjectReferenceDtsFakingHost(p.loader)
 * 	}
 * }
 */
export function projectReferenceParser_initMapper(receiver: GoPtr<projectReferenceParser>, tasks: GoSlice<GoPtr<projectReferenceParseTask>>): void {
  const totalReferences = SyncMap_Size(receiver!.tasksByFileName) + 1;
  receiver!.loader!.projectReferenceFileMapper!.configToProjectReference = new globalThis.Map<Path, GoPtr<ParsedCommandLine>>();
  receiver!.loader!.projectReferenceFileMapper!.referencesInConfigFile = new globalThis.Map<Path, GoSlice<Path>>();
  receiver!.loader!.projectReferenceFileMapper!.sourceToProjectReference = new globalThis.Map<Path, GoPtr<import("../tsoptions/parsedcommandline.js").SourceOutputAndProjectReference>>();
  receiver!.loader!.projectReferenceFileMapper!.outputDtsToProjectReference = new globalThis.Map<Path, GoPtr<import("../tsoptions/parsedcommandline.js").SourceOutputAndProjectReference>>();
  const seen = NewSetWithSizeHint<GoPtr<projectReferenceParseTask>>(tasks.length);
  receiver!.loader!.projectReferenceFileMapper!.referencesInConfigFile.set(
    SourceFile_Path(receiver!.loader!.opts.Config!.ConfigFile!.SourceFile),
    projectReferenceParser_initMapperWorker(receiver, tasks, seen),
  );
  if (ProgramOptions_canUseProjectReferenceSource(receiver!.loader!.opts) && receiver!.loader!.projectReferenceFileMapper!.outputDtsToProjectReference.size !== 0) {
    receiver!.loader!.projectReferenceFileMapper!.host = newProjectReferenceDtsFakingHost(receiver!.loader);
  }
  void totalReferences;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferenceparser.go::method::projectReferenceParser.initMapperWorker","kind":"method","status":"implemented","sigHash":"79d107e75e614f4bac7db48e20a7ce041020fa8c75a28916513778386f1606c0","bodyHash":"53d62c81467632820dc995b276c26e85c699bf5b22a8181229c67bd73ba73784"}
 *
 * Go source:
 * func (p *projectReferenceParser) initMapperWorker(tasks []*projectReferenceParseTask, seen *collections.Set[*projectReferenceParseTask]) []tspath.Path {
 * 	if len(tasks) == 0 {
 * 		return nil
 * 	}
 * 	results := make([]tspath.Path, 0, len(tasks))
 * 	for _, task := range tasks {
 * 		path := p.loader.toPath(task.configName)
 * 		results = append(results, path)
 * 		// ensure we only walk each task once
 * 		if !seen.AddIfAbsent(task) {
 * 			continue
 * 		}
 * 		p.loader.projectReferenceFileMapper.configToProjectReference[path] = task.resolved
 * 		if task.resolved != nil && p.loader.projectReferenceFileMapper.opts.Config.ConfigFile != task.resolved.ConfigFile {
 * 			// Map current task's files first, before recursing into subtasks.
 * 			// This matches TypeScript's behavior where child project references
 * 			// overwrite parent entries when a file belongs to multiple projects.
 * 			maps.Copy(p.loader.projectReferenceFileMapper.sourceToProjectReference, task.resolved.SourceToProjectReference())
 * 			maps.Copy(p.loader.projectReferenceFileMapper.outputDtsToProjectReference, task.resolved.OutputDtsToProjectReference())
 * 			if p.loader.projectReferenceFileMapper.opts.canUseProjectReferenceSource() {
 * 				declDir := task.resolved.CompilerOptions().DeclarationDir
 * 				if declDir == "" {
 * 					declDir = task.resolved.CompilerOptions().OutDir
 * 				}
 * 				if declDir != "" {
 * 					p.loader.dtsDirectories.Add(p.loader.toPath(declDir))
 * 				}
 * 			}
 * 		}
 * 		referencesInConfig := p.initMapperWorker(task.subTasks, seen)
 * 		p.loader.projectReferenceFileMapper.referencesInConfigFile[path] = referencesInConfig
 * 	}
 * 	return results
 * }
 */
export function projectReferenceParser_initMapperWorker(receiver: GoPtr<projectReferenceParser>, tasks: GoSlice<GoPtr<projectReferenceParseTask>>, seen: GoPtr<Set<GoPtr<projectReferenceParseTask>>>): GoSlice<Path> {
  if (tasks.length === 0) {
    return [];
  }
  const results: Path[] = [];
  for (const task of tasks) {
    const path = fileLoader_toPath(receiver!.loader, task!.configName);
    results.push(path);
    // ensure we only walk each task once
    if (!Set_AddIfAbsent(seen as GoPtr<Set<GoPtr<projectReferenceParseTask>>>, task)) {
      continue;
    }
    receiver!.loader!.projectReferenceFileMapper!.configToProjectReference.set(path, task!.resolved);
    if (task!.resolved !== undefined && receiver!.loader!.opts.Config!.ConfigFile !== task!.resolved.ConfigFile) {
      // Map current task's files first, before recursing into subtasks.
      // This matches TypeScript's behavior where child project references
      // overwrite parent entries when a file belongs to multiple projects.
      maps.Copy(receiver!.loader!.projectReferenceFileMapper!.sourceToProjectReference, ParsedCommandLine_SourceToProjectReference(task!.resolved));
      maps.Copy(receiver!.loader!.projectReferenceFileMapper!.outputDtsToProjectReference, ParsedCommandLine_OutputDtsToProjectReference(task!.resolved));
      if (ProgramOptions_canUseProjectReferenceSource(receiver!.loader!.opts)) {
        let declDir = ParsedCommandLine_CompilerOptions(task!.resolved)!.DeclarationDir;
        if (declDir === "") {
          declDir = ParsedCommandLine_CompilerOptions(task!.resolved)!.OutDir;
        }
        if (declDir !== "") {
          Set_AddIfAbsent(receiver!.loader!.dtsDirectories as GoPtr<Set<Path>>, fileLoader_toPath(receiver!.loader, declDir));
        }
      }
    }
    const referencesInConfig = projectReferenceParser_initMapperWorker(receiver, task!.subTasks, seen);
    receiver!.loader!.projectReferenceFileMapper!.referencesInConfigFile.set(path, referencesInConfig);
  }
  return results;
}

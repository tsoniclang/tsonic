import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import type { Duration, Time } from "../../../go/time.js";
import { Time as TimeClass } from "../../../go/time.js";
import type { SourceFile } from "../../ast/ast.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import { OrderedMap_Set } from "../../collections/ordered_map.js";
import { SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Store } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { CompilerHost } from "../../compiler/host.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { ParsedCommandLine_ConfigName, ParsedCommandLine_GetBuildInfoFileName } from "../../tsoptions/parsedcommandline.js";
import { GetParsedCommandLineOfConfigFilePath } from "../../tsoptions/tsconfigparsing.js";
import { FileExtensionIs } from "../../tspath/path.js";
import type { Path } from "../../tspath/path.js";
import { IsDeclarationFileName, ExtensionJson } from "../../tspath/extension.js";
import type { FS as FS_7f03dc1c } from "../../vfs/vfs.js";
import type { BuildInfo } from "../incremental/buildInfo.js";
import type { Host } from "../incremental/host.js";
import { GetMTime as incremental_GetMTime } from "../incremental/host.js";
import type { BuildInfoReader } from "../incremental/incremental.js";
import { ExtendedConfigCache_as_tsoptions_ExtendedConfigCache, type ExtendedConfigCache } from "../tsc/extendedconfigcache.js";
import type { Orchestrator } from "./orchestrator.js";
import { Orchestrator_toPath, Orchestrator_getTask } from "./orchestrator.js";
import type { parseCache } from "./parseCache.js";
import { parseCache_loadOrStore } from "./parseCache.js";
import { BuildTask_loadOrStoreBuildInfo } from "./buildtask.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::type::host","kind":"type","status":"implemented","sigHash":"4878a075c6246d276432fff1aab5b03ef485e8fc6f147876280d0e8e305a382a","bodyHash":"dee113d37bcff5b2be13c10f7b3d6f2614f02fdc08433c90264f5c0a4dc8b9d2"}
 *
 * Go source:
 * host struct {
 * 	orchestrator *Orchestrator
 * 	host         compiler.CompilerHost
 * 
 * 	// Caches that last only for build cycle and then cleared out
 * 	extendedConfigCache tsc.ExtendedConfigCache
 * 	sourceFiles         parseCache[ast.SourceFileParseOptions, *ast.SourceFile]
 * 	configTimes         collections.SyncMap[tspath.Path, time.Duration]
 * 
 * 	// caches that stay as long as they are needed
 * 	resolvedReferences parseCache[tspath.Path, *tsoptions.ParsedCommandLine]
 * 	mTimes             *collections.SyncMap[tspath.Path, time.Time]
 * }
 */
export interface host {
  orchestrator: GoPtr<Orchestrator>;
  host: CompilerHost;
  extendedConfigCache: ExtendedConfigCache;
  sourceFiles: parseCache<SourceFileParseOptions, GoPtr<SourceFile>>;
  configTimes: SyncMap;
  resolvedReferences: parseCache<Path, GoPtr<ParsedCommandLine>>;
  mTimes: GoPtr<SyncMap>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::varGroup::_+_+_","kind":"varGroup","status":"implemented","sigHash":"5409f96379fff09ec0d93c04933563c7fc89b0b7eabeb5959ec3e982c6a69a9f","bodyHash":"638d6991a3569ce94e574bb91dbe2d9a850feaf3212b618736b2586804dde0fa"}
 *
 * Go source:
 * var (
 * 	_ compiler.CompilerHost       = (*host)(nil)
 * 	_ incremental.BuildInfoReader = (*host)(nil)
 * 	_ incremental.Host            = (*host)(nil)
 * )
 */
export let ______46749447_0: CompilerHost = host_as_compiler_CompilerHost(undefined);
export let ______46749447_1: BuildInfoReader = host_as_incremental_BuildInfoReader(undefined);
export let ______46749447_2: Host = host_as_incremental_Host(undefined);

export function host_as_compiler_CompilerHost(receiver: GoPtr<host>): CompilerHost {
  return {
    FS: (): FS_7f03dc1c => host_FS(receiver),
    DefaultLibraryPath: (): string => host_DefaultLibraryPath(receiver),
    GetCurrentDirectory: (): string => host_GetCurrentDirectory(receiver),
    Trace: (msg: GoPtr<Message>, ...args: Array<unknown>): void => host_Trace(receiver, msg, ...args),
    GetSourceFile: (opts: SourceFileParseOptions): GoPtr<SourceFile> => host_GetSourceFile(receiver, opts),
    GetResolvedProjectReference: (fileName: string, path: Path): GoPtr<ParsedCommandLine> => host_GetResolvedProjectReference(receiver, fileName, path),
  };
}

export function host_as_incremental_BuildInfoReader(receiver: GoPtr<host>): BuildInfoReader {
  return {
    ReadBuildInfo: (config: GoPtr<ParsedCommandLine>): GoPtr<BuildInfo> => host_ReadBuildInfo(receiver, config),
  };
}

export function host_as_incremental_Host(receiver: GoPtr<host>): Host {
  return {
    GetMTime: (fileName: string): Time => host_GetMTime(receiver, fileName),
    SetMTime: (fileName: string, mTime: Time): GoError => host_SetMTime(receiver, fileName, mTime),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.FS","kind":"method","status":"implemented","sigHash":"d45876671f8945bccb97e542ce2ec67006013d8bab7e6cd3ee77196ea144fb66","bodyHash":"b36a5440d8ae5c318b21bc54eac0bd347d8af98e63f610cfa6e0381ec36d4afc"}
 *
 * Go source:
 * func (h *host) FS() vfs.FS {
 * 	return h.host.FS()
 * }
 */
export function host_FS(receiver: GoPtr<host>): FS_7f03dc1c {
  return receiver!.host.FS();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.DefaultLibraryPath","kind":"method","status":"implemented","sigHash":"ea6c90bbc382c499e1c29084fea54eca8edeb4e462074687e9e1e1e84dd5abdd","bodyHash":"af8bc70a0c273ae2720026ed0264e70fd97ec8c6341d325d9888cb07968e212a"}
 *
 * Go source:
 * func (h *host) DefaultLibraryPath() string {
 * 	return h.host.DefaultLibraryPath()
 * }
 */
export function host_DefaultLibraryPath(receiver: GoPtr<host>): string {
  return receiver!.host.DefaultLibraryPath();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"5d6b83f31285d23e6ab3e2444d489804ba46944a3897c98341787b604766632b","bodyHash":"ebe9c494aaab1ab8be349c87648eb34a80e571a627cf95ab498a3166d8337755"}
 *
 * Go source:
 * func (h *host) GetCurrentDirectory() string {
 * 	return h.host.GetCurrentDirectory()
 * }
 */
export function host_GetCurrentDirectory(receiver: GoPtr<host>): string {
  return receiver!.host.GetCurrentDirectory();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.Trace","kind":"method","status":"implemented","sigHash":"1f46650b434b29d014523e301e82281aa4555a2693ae71fca614d3c136da64a2","bodyHash":"a70803919c687fcdee5c726a9f7bafcb0078cca5fa4723d7d02e42f9be3c4fb0"}
 *
 * Go source:
 * func (h *host) Trace(msg *diagnostics.Message, args ...any) {
 * 	panic("build.Orchestrator.host does not support tracing, use a different host for tracing")
 * }
 */
export function host_Trace(receiver: GoPtr<host>, msg: GoPtr<Message>, ...args: Array<unknown>): void {
  throw new globalThis.Error("build.Orchestrator.host does not support tracing, use a different host for tracing");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.GetSourceFile","kind":"method","status":"implemented","sigHash":"637ddd51c03013865d0e2f0a0b086906bda12156a358eb70987b6c1a54fe9306","bodyHash":"3b570a1cbc6f3bdff8cb6978755986dd6bcdc2563d995794523752813a0a29d7"}
 *
 * Go source:
 * func (h *host) GetSourceFile(opts ast.SourceFileParseOptions) *ast.SourceFile {
 * 	if tspath.IsDeclarationFileName(opts.FileName) || tspath.FileExtensionIs(opts.FileName, tspath.ExtensionJson) {
 * 		// Cache dts and json files as they will be reused
 * 		return h.sourceFiles.loadOrStore(opts, h.host.GetSourceFile, false /* allowZero * /)
 * 	}
 * 	return h.host.GetSourceFile(opts)
 * }
 */
export function host_GetSourceFile(receiver: GoPtr<host>, opts: SourceFileParseOptions): GoPtr<SourceFile> {
  if (IsDeclarationFileName(opts.FileName) || FileExtensionIs(opts.FileName, ExtensionJson)) {
    return parseCache_loadOrStore(receiver!.sourceFiles, opts, (o) => receiver!.host.GetSourceFile(o), false);
  }
  return receiver!.host.GetSourceFile(opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.GetResolvedProjectReference","kind":"method","status":"implemented","sigHash":"7e6e6760fb9031adbe0b2bdb544052febb5d8dade4da315f744773cbd0089a30","bodyHash":"3eebeb2d4cb3526d3274d18725f785127c83886a4404df215e6d568be2542609"}
 *
 * Go source:
 * func (h *host) GetResolvedProjectReference(fileName string, path tspath.Path) *tsoptions.ParsedCommandLine {
 * 	return h.resolvedReferences.loadOrStore(path, func(path tspath.Path) *tsoptions.ParsedCommandLine {
 * 		configStart := h.orchestrator.opts.Sys.Now()
 * 		// Wrap command line options in "compilerOptions" key to match tsconfig.json structure
 * 		var commandLineRaw *collections.OrderedMap[string, any]
 * 		if raw, ok := h.orchestrator.opts.Command.Raw.(*collections.OrderedMap[string, any]); ok {
 * 			wrapped := &collections.OrderedMap[string, any]{}
 * 			wrapped.Set("compilerOptions", raw)
 * 			commandLineRaw = wrapped
 * 		}
 * 		commandLine, _ := tsoptions.GetParsedCommandLineOfConfigFilePath(fileName, path, h.orchestrator.opts.Command.CompilerOptions, commandLineRaw, h, &h.extendedConfigCache)
 * 		configTime := h.orchestrator.opts.Sys.Now().Sub(configStart)
 * 		h.configTimes.Store(path, configTime)
 * 		return commandLine
 * 	}, true /* allowZero * /)
 * }
 */
export function host_GetResolvedProjectReference(receiver: GoPtr<host>, fileName: string, path: Path): GoPtr<ParsedCommandLine> {
  return parseCache_loadOrStore(receiver!.resolvedReferences, path, (p: Path): GoPtr<ParsedCommandLine> => {
    const configStart = receiver!.orchestrator!.opts.Sys.Now();
    let commandLineRaw: GoPtr<OrderedMap> = undefined;
    const raw = receiver!.orchestrator!.opts.Command!.Raw;
    if (raw !== undefined && raw !== null) {
      const rawMap = raw as OrderedMap;
      if (rawMap.keys !== undefined) {
        const wrapped: OrderedMap = { __tsgoBlank0: {}, keys: [], mp: new Map() };
        OrderedMap_Set(wrapped, "compilerOptions", rawMap);
        commandLineRaw = wrapped;
      }
    }
    const [commandLine] = GetParsedCommandLineOfConfigFilePath(fileName, p, receiver!.orchestrator!.opts.Command!.CompilerOptions, commandLineRaw, host_as_compiler_CompilerHost(receiver), ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver!.extendedConfigCache));
    const configTime = (receiver!.orchestrator!.opts.Sys.Now() as Time & { Sub(t: Time): Duration }).Sub(configStart);
    SyncMap_Store(receiver!.configTimes, p, configTime);
    return commandLine;
  }, true);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.ReadBuildInfo","kind":"method","status":"implemented","sigHash":"a8da20638b02b990b4e0d2993dd38195cfb2307b479db3dd8f9e909d17f42d84","bodyHash":"d543238b75cfe4029f6124b7873e8797d0ba6705c1e58707fb1638b3ca85fe56"}
 *
 * Go source:
 * func (h *host) ReadBuildInfo(config *tsoptions.ParsedCommandLine) *incremental.BuildInfo {
 * 	configPath := h.orchestrator.toPath(config.ConfigName())
 * 	task := h.orchestrator.getTask(configPath)
 * 	buildInfo, _ := task.loadOrStoreBuildInfo(h.orchestrator, h.orchestrator.toPath(config.ConfigName()), config.GetBuildInfoFileName())
 * 	return buildInfo
 * }
 */
export function host_ReadBuildInfo(receiver: GoPtr<host>, config: GoPtr<ParsedCommandLine>): GoPtr<BuildInfo> {
  const configPath = Orchestrator_toPath(receiver!.orchestrator, ParsedCommandLine_ConfigName(config));
  const task = Orchestrator_getTask(receiver!.orchestrator, configPath);
  const [buildInfo] = BuildTask_loadOrStoreBuildInfo(task, receiver!.orchestrator, Orchestrator_toPath(receiver!.orchestrator, ParsedCommandLine_ConfigName(config)), ParsedCommandLine_GetBuildInfoFileName(config));
  return buildInfo;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.GetMTime","kind":"method","status":"implemented","sigHash":"96f4667cf5398161244daccebaec4df683a74ef1a9fde5714f1d1b92ffbd4293","bodyHash":"7afd677e713560b4a01d5f72d4619cfe4d966375058973137dd967b5060cc8ed"}
 *
 * Go source:
 * func (h *host) GetMTime(file string) time.Time {
 * 	return h.loadOrStoreMTime(file, nil, true)
 * }
 */
export function host_GetMTime(receiver: GoPtr<host>, file: string): Time {
  return host_loadOrStoreMTime(receiver, file, undefined, true);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.SetMTime","kind":"method","status":"implemented","sigHash":"da5212d369f2ec9a58abd78029a56ffca5553c23ba6e92fd1753dbd8fc73006f","bodyHash":"7b004b9b1e9bebe19878d62f6f571e5345cbec45ee5be3ba8d859dc9301d560d"}
 *
 * Go source:
 * func (h *host) SetMTime(file string, mTime time.Time) error {
 * 	return h.FS().Chtimes(file, time.Time{}, mTime)
 * }
 */
export function host_SetMTime(receiver: GoPtr<host>, file: string, mTime: Time): GoError {
  return host_FS(receiver).Chtimes(file, new TimeClass(), mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.loadOrStoreMTime","kind":"method","status":"implemented","sigHash":"2c9ce04ae8a35bb881d703f154e5239afce75bd788f42f70991f4366ec8264e5","bodyHash":"429e8570b402bacf6b8ca28a848086c025dd6c5ef68bcb06750451d32a530602"}
 *
 * Go source:
 * func (h *host) loadOrStoreMTime(file string, oldCache *collections.SyncMap[tspath.Path, time.Time], store bool) time.Time {
 * 	path := h.orchestrator.toPath(file)
 * 	if existing, loaded := h.mTimes.Load(path); loaded {
 * 		return existing
 * 	}
 * 	var found bool
 * 	var mTime time.Time
 * 	if oldCache != nil {
 * 		mTime, found = oldCache.Load(path)
 * 	}
 * 	if !found {
 * 		mTime = incremental.GetMTime(h.host, file)
 * 	}
 * 	if store {
 * 		mTime, _ = h.mTimes.LoadOrStore(path, mTime)
 * 	}
 * 	return mTime
 * }
 */
export function host_loadOrStoreMTime(receiver: GoPtr<host>, file: string, oldCache: GoPtr<SyncMap>, store: bool): Time {
  const path = Orchestrator_toPath(receiver!.orchestrator, file);
  const [existing, loaded] = SyncMap_Load(receiver!.mTimes, path);
  if (loaded) {
    return existing as Time;
  }
  let found = false;
  let mTime: Time = new TimeClass();
  if (oldCache !== undefined) {
    const [oldMTime, oldFound] = SyncMap_Load(oldCache, path);
    if (oldFound) {
      mTime = oldMTime as Time;
      found = true;
    }
  }
  if (!found) {
    mTime = incremental_GetMTime(receiver!.host, file);
  }
  if (store) {
    const [storedMTime] = SyncMap_LoadOrStore(receiver!.mTimes, path, mTime);
    mTime = storedMTime as Time;
  }
  return mTime;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.storeMTime","kind":"method","status":"implemented","sigHash":"cdf1a57be6bcb87e3b52282114723e6abb384ef1d7bb2df62c8ef2611a955ad6","bodyHash":"9585f5af6fcc81710f8bf1c4e84df555da06ca61cdf73a653ef37ded8dd2cb0e"}
 *
 * Go source:
 * func (h *host) storeMTime(file string, mTime time.Time) {
 * 	path := h.orchestrator.toPath(file)
 * 	h.mTimes.Store(path, mTime)
 * }
 */
export function host_storeMTime(receiver: GoPtr<host>, file: string, mTime: Time): void {
  const path = Orchestrator_toPath(receiver!.orchestrator, file);
  SyncMap_Store(receiver!.mTimes, path, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/host.go::method::host.storeMTimeFromOldCache","kind":"method","status":"implemented","sigHash":"8173afa313e5d39962e5017fb38e2475a44bcd3498c68301e9d1b484d7d5f986","bodyHash":"5e05c936f1b6d9b00e258a9213d496920e8ee20d4a2a41aa4da074caac431db8"}
 *
 * Go source:
 * func (h *host) storeMTimeFromOldCache(file string, oldCache *collections.SyncMap[tspath.Path, time.Time]) {
 * 	path := h.orchestrator.toPath(file)
 * 	if mTime, found := oldCache.Load(path); found {
 * 		h.mTimes.Store(path, mTime)
 * 	}
 * }
 */
export function host_storeMTimeFromOldCache(receiver: GoPtr<host>, file: string, oldCache: GoPtr<SyncMap>): void {
  const path = Orchestrator_toPath(receiver!.orchestrator, file);
  const [mTime, found] = SyncMap_Load(oldCache, path);
  if (found) {
    SyncMap_Store(receiver!.mTimes, path, mTime);
  }
}

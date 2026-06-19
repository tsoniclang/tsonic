import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import * as strings from "../../go/strings.js";
import { SourceFile_Path } from "../ast/ast.js";
import type { HasFileName, SourceFile } from "../ast/ast.js";
import { NewSetWithSizeHint, Set_Add, Set_AddIfAbsent } from "../collections/set.js";
import type { Set } from "../collections/set.js";
import { SyncMap_Load, SyncMap_Store } from "../collections/syncmap.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { Tristate_IsTrue } from "../core/tristate.js";
import { GetCompilerOptionsWithRedirect } from "../module/resolver.js";
import { ParsedCommandLine_CompilerOptions, ParsedCommandLine_as_ResolvedProjectReference } from "../tsoptions/parsedcommandline.js";
import type { ResolvedProjectReference, ResolutionHost } from "../module/types.js";
import type { ParsedCommandLine, SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import { fileLoader_toPath } from "./fileloader.js";
import type { fileLoader } from "./fileloader.js";
import { ProgramOptions_canUseProjectReferenceSource } from "./program.js";
import type { ProgramOptions } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::type::projectReferenceFileMapper","kind":"type","status":"implemented","sigHash":"bd29532226153c9421c0d64a9c1657c520691d16f8be0fccc4a85fabb8130ee6","bodyHash":"c70ffa65c0a7cbf4488dcb61bb0f1edc90d7ae2469629d6e4783f50b6301ad94"}
 *
 * Go source:
 * projectReferenceFileMapper struct {
 * 	opts   ProgramOptions
 * 	host   module.ResolutionHost
 * 	loader *fileLoader // Only present during populating the mapper and parsing, released after that
 * 
 * 	configToProjectReference    map[tspath.Path]*tsoptions.ParsedCommandLine // All the resolved references needed
 * 	referencesInConfigFile      map[tspath.Path][]tspath.Path                // Map of config file to its references
 * 	sourceToProjectReference    map[tspath.Path]*tsoptions.SourceOutputAndProjectReference
 * 	outputDtsToProjectReference map[tspath.Path]*tsoptions.SourceOutputAndProjectReference
 * 
 * 	// Store all the realpath from dts in node_modules to source file from project reference needed during parsing so it can be used later
 * 	realpathDtsToSource collections.SyncMap[tspath.Path, *tsoptions.SourceOutputAndProjectReference]
 * }
 */
export interface projectReferenceFileMapper {
  opts: ProgramOptions;
  host: GoPtr<ResolutionHost>;
  loader: GoPtr<fileLoader>;
  configToProjectReference: GoMap<Path, GoPtr<ParsedCommandLine>>;
  referencesInConfigFile: GoMap<Path, GoSlice<Path>>;
  sourceToProjectReference: GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
  outputDtsToProjectReference: GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
  realpathDtsToSource: SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getParseFileRedirect","kind":"method","status":"implemented","sigHash":"443d5fbcdb23fe26450f2b867958ab98864f90a7fd948906f5068179a8889dcc","bodyHash":"b874a38a83ad474eb6682b3bec65bcb60b5f87b4c795f253fa30ec6450e0b4a6"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getParseFileRedirect(file ast.HasFileName) string {
 * 	if mapper.opts.canUseProjectReferenceSource() {
 * 		// Map to source file from project reference
 * 		source := mapper.getProjectReferenceFromOutputDts(file.Path())
 * 		if source == nil {
 * 			source = mapper.getSourceToDtsIfSymlink(file)
 * 		}
 * 		if source != nil {
 * 			return source.Source
 * 		}
 * 	} else {
 * 		// Map to dts file from project reference
 * 		output := mapper.getProjectReferenceFromSource(file.Path())
 * 		if output != nil && output.OutputDts != "" {
 * 			return output.OutputDts
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function projectReferenceFileMapper_getParseFileRedirect(receiver: GoPtr<projectReferenceFileMapper>, file: HasFileName): string {
  if (ProgramOptions_canUseProjectReferenceSource(receiver!.opts)) {
    // Map to source file from project reference
    let source = projectReferenceFileMapper_getProjectReferenceFromOutputDts(receiver, file.Path());
    if (source === undefined) {
      source = projectReferenceFileMapper_getSourceToDtsIfSymlink(receiver, file);
    }
    if (source !== undefined) {
      return source.Source;
    }
  } else {
    // Map to dts file from project reference
    const output = projectReferenceFileMapper_getProjectReferenceFromSource(receiver, file.Path());
    if (output !== undefined && output.OutputDts !== "") {
      return output.OutputDts;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getResolvedProjectReferences","kind":"method","status":"implemented","sigHash":"574bc40821ce53dc86eaadc776ebae140295e7963308985d393cf5a36f3b4243","bodyHash":"80d3985d9f060a57c8fa452f0fe6cae59e933e72fdf12f9576b37535bd395a07"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getResolvedProjectReferences() []*tsoptions.ParsedCommandLine {
 * 	if mapper.opts.Config.ConfigFile == nil {
 * 		return nil
 * 	}
 * 	refs, ok := mapper.referencesInConfigFile[mapper.opts.Config.ConfigFile.SourceFile.Path()]
 * 	var result []*tsoptions.ParsedCommandLine
 * 	if ok {
 * 		result = make([]*tsoptions.ParsedCommandLine, 0, len(refs))
 * 		for _, refPath := range refs {
 * 			refConfig, _ := mapper.configToProjectReference[refPath]
 * 			result = append(result, refConfig)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function projectReferenceFileMapper_getResolvedProjectReferences(receiver: GoPtr<projectReferenceFileMapper>): GoSlice<GoPtr<ParsedCommandLine>> {
  if (receiver!.opts.Config!.ConfigFile === undefined) {
    return [];
  }
  const refs = SourceFile_Path(receiver!.opts.Config!.ConfigFile!.SourceFile);
  const ok = receiver!.referencesInConfigFile?.has(refs) ?? false;
  let result: GoSlice<GoPtr<ParsedCommandLine>> = [];
  if (ok) {
    const refPaths = receiver!.referencesInConfigFile.get(refs)!;
    result = [];
    for (const refPath of refPaths) {
      const refConfig = receiver!.configToProjectReference?.get(refPath);
      result.push(refConfig);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getProjectReferenceFromSource","kind":"method","status":"implemented","sigHash":"0d58e28c39846a67abdcadaca766b3f4d5093b40254947a76625df623286ac5d","bodyHash":"09ffe140fd6e5ea2d25aff278dfa4fbc00d0f883fafd7d5bd1ac7462f3aa3a5c"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
 * 	return mapper.sourceToProjectReference[path]
 * }
 */
export function projectReferenceFileMapper_getProjectReferenceFromSource(receiver: GoPtr<projectReferenceFileMapper>, path: Path): GoPtr<SourceOutputAndProjectReference> {
  return receiver!.sourceToProjectReference?.get(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getProjectReferenceFromOutputDts","kind":"method","status":"implemented","sigHash":"e481e0eb7459bbf651ea47b68269b41f6f4780dd41b99042ac4925173a9c8dc2","bodyHash":"1554eba4056d2e732e9c1b009585333acf016220b4be0600ce81c84c71d15556"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getProjectReferenceFromOutputDts(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
 * 	return mapper.outputDtsToProjectReference[path]
 * }
 */
export function projectReferenceFileMapper_getProjectReferenceFromOutputDts(receiver: GoPtr<projectReferenceFileMapper>, path: Path): GoPtr<SourceOutputAndProjectReference> {
  return receiver!.outputDtsToProjectReference?.get(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.isSourceFromProjectReference","kind":"method","status":"implemented","sigHash":"e60ee5d125e9553239739a0e5e2c3d68f3d8791d55c07cee56ec9824e0a08bf3","bodyHash":"24a987763f278b507986cd48007d977658eee31f800528d4f7600822415d1f20"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) isSourceFromProjectReference(path tspath.Path) bool {
 * 	return mapper.opts.canUseProjectReferenceSource() && mapper.getProjectReferenceFromSource(path) != nil
 * }
 */
export function projectReferenceFileMapper_isSourceFromProjectReference(receiver: GoPtr<projectReferenceFileMapper>, path: Path): bool {
  return ProgramOptions_canUseProjectReferenceSource(receiver!.opts) && projectReferenceFileMapper_getProjectReferenceFromSource(receiver, path) !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getCompilerOptionsForFile","kind":"method","status":"implemented","sigHash":"648ac6345ae46efeb4c78b1f11f11c5b27263be410527329bf2a131eaf3f46bf","bodyHash":"e46f623c4d740cc401770b98254d9778fc128012385ba2b0395302269facacc2"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getCompilerOptionsForFile(file ast.HasFileName) *core.CompilerOptions {
 * 	redirect := mapper.getRedirectParsedCommandLineForResolution(file)
 * 	return module.GetCompilerOptionsWithRedirect(mapper.opts.Config.CompilerOptions(), redirect)
 * }
 */
export function projectReferenceFileMapper_getCompilerOptionsForFile(receiver: GoPtr<projectReferenceFileMapper>, file: HasFileName): GoPtr<CompilerOptions> {
  const redirect = projectReferenceFileMapper_getRedirectParsedCommandLineForResolution(receiver, file);
  const redirectedReference: GoPtr<ResolvedProjectReference> = redirect !== undefined
    ? ParsedCommandLine_as_ResolvedProjectReference(redirect)
    : undefined;
  return GetCompilerOptionsWithRedirect(ParsedCommandLine_CompilerOptions(receiver!.opts.Config), redirectedReference);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getRedirectParsedCommandLineForResolution","kind":"method","status":"implemented","sigHash":"81228748952f1031e9ccb4601ddef04a082645d305150efc155c46b340d5006a","bodyHash":"2afe0acb8bf8d74f30e2a7acd8662e08fb9720c808ee7958e678496d709f5b6f"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getRedirectParsedCommandLineForResolution(file ast.HasFileName) *tsoptions.ParsedCommandLine {
 * 	redirect, _ := mapper.getRedirectForResolution(file)
 * 	return redirect
 * }
 */
export function projectReferenceFileMapper_getRedirectParsedCommandLineForResolution(receiver: GoPtr<projectReferenceFileMapper>, file: HasFileName): GoPtr<ParsedCommandLine> {
  const [redirect] = projectReferenceFileMapper_getRedirectForResolution(receiver, file);
  return redirect;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getRedirectForResolution","kind":"method","status":"implemented","sigHash":"23dffafde00401d006e7f08c2b83e05ac9dedcd9b8354396bf7fabe02332588b","bodyHash":"497d882d21e6e6435e6fc3f68babfe8b05a71ac06775635d1b23e3f99bfcda44"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getRedirectForResolution(file ast.HasFileName) (*tsoptions.ParsedCommandLine, string) {
 * 	path := file.Path()
 * 	// Check if outputdts of source file from project reference
 * 	output := mapper.getProjectReferenceFromSource(path)
 * 	if output != nil {
 * 		return output.Resolved, output.Source
 * 	}
 * 
 * 	// Source file from project reference
 * 	resultFromDts := mapper.getProjectReferenceFromOutputDts(path)
 * 	if resultFromDts != nil {
 * 		return resultFromDts.Resolved, resultFromDts.Source
 * 	}
 * 
 * 	realpathDtsToSource := mapper.getSourceToDtsIfSymlink(file)
 * 	if realpathDtsToSource != nil {
 * 		return realpathDtsToSource.Resolved, realpathDtsToSource.Source
 * 	}
 * 	return nil, file.FileName()
 * }
 */
export function projectReferenceFileMapper_getRedirectForResolution(receiver: GoPtr<projectReferenceFileMapper>, file: HasFileName): [GoPtr<ParsedCommandLine>, string] {
  const path = file.Path();
  // Check if outputdts of source file from project reference
  const output = projectReferenceFileMapper_getProjectReferenceFromSource(receiver, path);
  if (output !== undefined) {
    return [output.Resolved, output.Source];
  }

  // Source file from project reference
  const resultFromDts = projectReferenceFileMapper_getProjectReferenceFromOutputDts(receiver, path);
  if (resultFromDts !== undefined) {
    return [resultFromDts.Resolved, resultFromDts.Source];
  }

  const realpathDtsToSource = projectReferenceFileMapper_getSourceToDtsIfSymlink(receiver, file);
  if (realpathDtsToSource !== undefined) {
    return [realpathDtsToSource.Resolved, realpathDtsToSource.Source];
  }
  return [undefined, file.FileName()];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getResolvedReferenceFor","kind":"method","status":"implemented","sigHash":"5e2d0e4e01d7349b0c9a21f85804d930008798cb003e03b7a6390f70d69ce155","bodyHash":"e5f6f6ca6e2e317cfbf58e99ab9efc6e614ba69276384c1567087c54e60f79bc"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getResolvedReferenceFor(path tspath.Path) (*tsoptions.ParsedCommandLine, bool) {
 * 	config, ok := mapper.configToProjectReference[path]
 * 	return config, ok
 * }
 */
export function projectReferenceFileMapper_getResolvedReferenceFor(receiver: GoPtr<projectReferenceFileMapper>, path: Path): [GoPtr<ParsedCommandLine>, bool] {
  const config = receiver!.configToProjectReference?.get(path);
  const ok = receiver!.configToProjectReference?.has(path) ?? false;
  return [config, ok];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.rangeResolvedProjectReference","kind":"method","status":"implemented","sigHash":"bb49154f76c97e6e48c99f97162d83bf1802886e9adc44a191b9d080f5f3e586","bodyHash":"5b9cd4c0d0d98721ee289b5929f603afdf5eb80fbc1783ffff18743673985577"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) rangeResolvedProjectReference(
 * 	f func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool,
 * ) bool {
 * 	if mapper.opts.Config.ConfigFile == nil {
 * 		return false
 * 	}
 * 	seenRef := collections.NewSetWithSizeHint[tspath.Path](len(mapper.referencesInConfigFile))
 * 	seenRef.Add(mapper.opts.Config.ConfigFile.SourceFile.Path())
 * 	refs := mapper.referencesInConfigFile[mapper.opts.Config.ConfigFile.SourceFile.Path()]
 * 	return mapper.rangeResolvedReferenceWorker(refs, f, mapper.opts.Config, seenRef)
 * }
 */
export function projectReferenceFileMapper_rangeResolvedProjectReference(receiver: GoPtr<projectReferenceFileMapper>, f: (path: Path, config: GoPtr<ParsedCommandLine>, parent: GoPtr<ParsedCommandLine>, index: int) => bool): bool {
  if (receiver!.opts.Config!.ConfigFile === undefined) {
    return false;
  }
  const seenRef = NewSetWithSizeHint<Path>(receiver!.referencesInConfigFile?.size ?? 0);
  Set_Add(seenRef, SourceFile_Path(receiver!.opts.Config!.ConfigFile!.SourceFile));
  const refs = receiver!.referencesInConfigFile?.get(SourceFile_Path(receiver!.opts.Config!.ConfigFile!.SourceFile)) ?? [];
  return projectReferenceFileMapper_rangeResolvedReferenceWorker(receiver, refs, f, receiver!.opts.Config, seenRef);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.rangeResolvedReferenceWorker","kind":"method","status":"implemented","sigHash":"75d3bc5f39713329e257b3eb8767d820b86644eb9468be82762a278a0435bb7b","bodyHash":"162f208ad8ac6ef51b25e11500673e8af530079fb3eb6a217de5bdbf4b900b3e"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) rangeResolvedReferenceWorker(
 * 	references []tspath.Path,
 * 	f func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool,
 * 	parent *tsoptions.ParsedCommandLine,
 * 	seenRef *collections.Set[tspath.Path],
 * ) bool {
 * 	for index, path := range references {
 * 		if !seenRef.AddIfAbsent(path) {
 * 			continue
 * 		}
 * 		config, _ := mapper.configToProjectReference[path]
 * 		if !f(path, config, parent, index) {
 * 			return false
 * 		}
 * 		if !mapper.rangeResolvedReferenceWorker(mapper.referencesInConfigFile[path], f, config, seenRef) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function projectReferenceFileMapper_rangeResolvedReferenceWorker(receiver: GoPtr<projectReferenceFileMapper>, references: GoSlice<Path>, f: (path: Path, config: GoPtr<ParsedCommandLine>, parent: GoPtr<ParsedCommandLine>, index: int) => bool, parent: GoPtr<ParsedCommandLine>, seenRef: GoPtr<Set<Path>>): bool {
  for (let index = 0; index < references.length; index++) {
    const path = references[index]!;
    if (!Set_AddIfAbsent(seenRef as GoPtr<Set<Path>>, path)) {
      continue;
    }
    const config = receiver!.configToProjectReference?.get(path);
    if (!f(path, config, parent, index)) {
      return false;
    }
    if (!projectReferenceFileMapper_rangeResolvedReferenceWorker(receiver, receiver!.referencesInConfigFile?.get(path) ?? [], f, config, seenRef)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.rangeResolvedProjectReferenceInChildConfig","kind":"method","status":"implemented","sigHash":"73e5edd34ec23f6bfd6a48b272b609c4bb6ba0b61f44b4621b481ecc0f469014","bodyHash":"ed5f44aeca629d9c68b82c6376dc703b195e2eeabd34a5df0fd5c96290224f66"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) rangeResolvedProjectReferenceInChildConfig(
 * 	childConfig *tsoptions.ParsedCommandLine,
 * 	f func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool,
 * ) bool {
 * 	if childConfig == nil || childConfig.ConfigFile == nil {
 * 		return false
 * 	}
 * 	seenRef := collections.NewSetWithSizeHint[tspath.Path](len(mapper.referencesInConfigFile))
 * 	seenRef.Add(childConfig.ConfigFile.SourceFile.Path())
 * 	refs := mapper.referencesInConfigFile[childConfig.ConfigFile.SourceFile.Path()]
 * 	return mapper.rangeResolvedReferenceWorker(refs, f, mapper.opts.Config, seenRef)
 * }
 */
export function projectReferenceFileMapper_rangeResolvedProjectReferenceInChildConfig(receiver: GoPtr<projectReferenceFileMapper>, childConfig: GoPtr<ParsedCommandLine>, f: (path: Path, config: GoPtr<ParsedCommandLine>, parent: GoPtr<ParsedCommandLine>, index: int) => bool): bool {
  if (childConfig === undefined || childConfig.ConfigFile === undefined) {
    return false;
  }
  const seenRef = NewSetWithSizeHint<Path>(receiver!.referencesInConfigFile?.size ?? 0);
  Set_Add(seenRef, SourceFile_Path(childConfig.ConfigFile!.SourceFile));
  const refs = receiver!.referencesInConfigFile?.get(SourceFile_Path(childConfig.ConfigFile!.SourceFile)) ?? [];
  return projectReferenceFileMapper_rangeResolvedReferenceWorker(receiver, refs, f, receiver!.opts.Config, seenRef);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencefilemapper.go::method::projectReferenceFileMapper.getSourceToDtsIfSymlink","kind":"method","status":"implemented","sigHash":"b34848f0b911065e69c686d3afddf6ad646fff612b7f76182f3ac1340a2f385a","bodyHash":"69097be86ed3afffa567258058fe3411af21d388810eeece979a951f711fd13c"}
 *
 * Go source:
 * func (mapper *projectReferenceFileMapper) getSourceToDtsIfSymlink(file ast.HasFileName) *tsoptions.SourceOutputAndProjectReference {
 * 	// If preserveSymlinks is true, module resolution wont jump the symlink
 * 	// but the resolved real path may be the .d.ts from project reference
 * 	// Note:: Currently we try the real path only if the
 * 	// file is from node_modules to avoid having to run real path on all file paths
 * 	path := file.Path()
 * 	realpathDtsToSource, ok := mapper.realpathDtsToSource.Load(path)
 * 	if ok {
 * 		return realpathDtsToSource
 * 	}
 * 	if mapper.loader != nil && mapper.opts.Config.CompilerOptions().PreserveSymlinks == core.TSTrue {
 * 		fileName := file.FileName()
 * 		if !strings.Contains(fileName, "/node_modules/") {
 * 			mapper.realpathDtsToSource.Store(path, nil)
 * 		} else {
 * 			realDeclarationPath := mapper.loader.toPath(mapper.host.FS().Realpath(fileName))
 * 			if realDeclarationPath == path {
 * 				mapper.realpathDtsToSource.Store(path, nil)
 * 			} else {
 * 				realpathDtsToSource := mapper.getProjectReferenceFromOutputDts(realDeclarationPath)
 * 				if realpathDtsToSource != nil {
 * 					mapper.realpathDtsToSource.Store(path, realpathDtsToSource)
 * 					return realpathDtsToSource
 * 				}
 * 				mapper.realpathDtsToSource.Store(path, nil)
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function projectReferenceFileMapper_getSourceToDtsIfSymlink(receiver: GoPtr<projectReferenceFileMapper>, file: HasFileName): GoPtr<SourceOutputAndProjectReference> {
  // If preserveSymlinks is true, module resolution wont jump the symlink
  // but the resolved real path may be the .d.ts from project reference
  // Note:: Currently we try the real path only if the
  // file is from node_modules to avoid having to run real path on all file paths
  const path = file.Path();
  const [realpathDtsToSource, ok] = SyncMap_Load<Path, GoPtr<SourceOutputAndProjectReference>>(receiver!.realpathDtsToSource as SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>, path);
  if (ok) {
    return realpathDtsToSource;
  }
  if (receiver!.loader !== undefined && Tristate_IsTrue(ParsedCommandLine_CompilerOptions(receiver!.opts.Config)!.PreserveSymlinks)) {
    const fileName = file.FileName();
    if (!strings.Contains(fileName, "/node_modules/")) {
      SyncMap_Store<Path, GoPtr<SourceOutputAndProjectReference>>(receiver!.realpathDtsToSource as SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>, path, undefined);
    } else {
      const realDeclarationPath = fileLoader_toPath(receiver!.loader, receiver!.host!.FS().Realpath(fileName));
      if (realDeclarationPath === path) {
        SyncMap_Store<Path, GoPtr<SourceOutputAndProjectReference>>(receiver!.realpathDtsToSource as SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>, path, undefined);
      } else {
        const realpathDtsToSourceResult = projectReferenceFileMapper_getProjectReferenceFromOutputDts(receiver, realDeclarationPath);
        if (realpathDtsToSourceResult !== undefined) {
          SyncMap_Store<Path, GoPtr<SourceOutputAndProjectReference>>(receiver!.realpathDtsToSource as SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>, path, realpathDtsToSourceResult);
          return realpathDtsToSourceResult;
        }
        SyncMap_Store<Path, GoPtr<SourceOutputAndProjectReference>>(receiver!.realpathDtsToSource as SyncMap<Path, GoPtr<SourceOutputAndProjectReference>>, path, undefined);
      }
    }
  }
  return undefined;
}

import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import * as maps from "../../go/maps.js";
import * as slices from "../../go/slices.js";
import { Map as SyncGoMap, Once } from "../../go/sync.js";
import * as strings from "../../go/strings.js";
import { NewDiagnostic } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { UndefinedTextRange } from "../core/text.js";
import { OrderedMap_Get, OrderedMap_GetOrZero, OrderedMap_Entries, OrderedMap_Keys, OrderedMap_Size } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { Set_Has, Set_Add, Set_Clone, NewSetWithSizeHint } from "../collections/set.js";
import type { Set } from "../collections/set.js";
import * as core from "../core/core.js";
import {
  CompilerOptions_GetAllowJS,
  CompilerOptions_GetEffectiveTypeRoots,
  CompilerOptions_GetModuleResolutionKind,
  CompilerOptions_GetPathsBasePath,
  CompilerOptions_GetResolveJsonModule,
  CompilerOptions_UsesWildcardTypes,
  ModuleKindCommonJS,
  ModuleKindESNext,
  ModuleKindNone,
  ModuleResolutionKind_String,
  ModuleResolutionKindBundler,
  ModuleResolutionKindNode16,
  ModuleResolutionKindNodeNext,
  ModuleResolutionKindUnknown,
  ResolutionModeCommonJS,
  ResolutionModeESM,
} from "../core/compileroptions.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import { FindBestPatternMatch, Pattern_IsValid, Pattern_MatchedText, TryParsePattern } from "../core/pattern.js";
import type { Pattern } from "../core/pattern.js";
import { TSFalse, TSTrue } from "../core/tristate.js";
import { Version } from "../core/version.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { InfoCache_Get, InfoCache_Set, InfoCacheEntry_Exists, PackageJson_GetVersionPaths, VersionPaths_Exists, VersionPaths_GetPaths } from "../packagejson/cache.js";
import type { InfoCache, InfoCacheEntry, PackageJson, VersionPaths } from "../packagejson/cache.js";
import { Expected_ActualJSONType, Expected_ExpectedJSONType, Expected_GetValue, Expected_IsPresent, Expected_IsValid } from "../packagejson/expected.js";
import type { Expected } from "../packagejson/expected.js";
import { ExportsOrImports_AsArray, ExportsOrImports_AsObject, ExportsOrImports_IsConditions, ExportsOrImports_IsSubpaths, objectKindUnknown } from "../packagejson/exportsorimports.js";
import type { ExportsOrImports } from "../packagejson/exportsorimports.js";
import { JSONValueTypeArray, JSONValueTypeNull, JSONValueTypeNotPresent, JSONValueTypeObject, JSONValueTypeString, JSONValue_AsString, JSONValue_IsFalsy, JSONValue_IsPresent } from "../packagejson/jsonvalue.js";
import type { JSONValue } from "../packagejson/jsonvalue.js";
import { Parse as ParsePackageJson } from "../packagejson/packagejson.js";
import type { Fields as PackageJsonFields } from "../packagejson/packagejson.js";
import type { TypeValidatedField } from "../packagejson/validated.js";
import * as stringutil from "../stringutil/compare.js";
import * as tspath from "../tspath/path.js";
import * as extension from "../tspath/extension.js";
import * as vfsmatch from "../vfs/vfsmatch/vfsmatch.js";
import { getRedirectConfigName, moduleResolutionCache_Get, moduleResolutionCache_Set, typeRefDirectiveResolutionCache_Get, typeRefDirectiveResolutionCache_Set, newCaches } from "./cache.js";
import type { caches, moduleResolutionCacheKey, typeRefDirectiveResolutionCacheKey } from "./cache.js";
import {
  extensions_Array,
  extensions_String,
  extensionsDeclaration,
  extensionsImplementationFiles,
  extensionsJavaScript,
  extensionsJson,
  extensionsTypeScript,
  NodeResolutionFeaturesAll,
  NodeResolutionFeaturesBundlerDefault,
  NodeResolutionFeaturesExports,
  NodeResolutionFeaturesExportsPatternTrailers,
  NodeResolutionFeaturesImports,
  NodeResolutionFeaturesImportsPatternRoot,
  NodeResolutionFeaturesNode16Default,
  NodeResolutionFeaturesNodeNextDefault,
  NodeResolutionFeaturesNone,
  NodeResolutionFeaturesSelfName,
  PackageId_String,
  ResolvedModule_IsResolved,
  ResolvedTypeReferenceDirective_IsResolved,
} from "./types.js";
import type { extensions, NodeResolutionFeatures, PackageId, ResolutionHost, ResolvedModule, ResolvedProjectReference, ResolvedTypeReferenceDirective } from "./types.js";
import { ComparePatternKeys, InferredTypesContainingFile, IsApplicableVersionedTypesKey, MangleScopedPackageName, ParseNodeModuleFromPath, ParsePackageName, TryGetJSExtensionForFile } from "./util.js";

const packageJsonNotPresentValue = (): JSONValue => ({ Type: JSONValueTypeNotPresent, Value: undefined });

const packageJsonZeroExportsOrImports = (): ExportsOrImports => ({
  __tsgoEmbedded0: packageJsonNotPresentValue(),
  objectKind: objectKindUnknown,
});

const packageJsonExports = (packageJson: GoPtr<PackageJson>): ExportsOrImports => {
  const exportsField = packageJson?.__tsgoEmbedded0?.__tsgoEmbedded1?.Exports;
  return exportsField?.__tsgoEmbedded0 !== undefined ? exportsField : packageJsonZeroExportsOrImports();
};

const packageJsonImports = (packageJson: GoPtr<PackageJson>): ExportsOrImports => {
  const importsField = packageJson?.__tsgoEmbedded0?.__tsgoEmbedded1?.Imports;
  return importsField?.__tsgoEmbedded0 !== undefined ? importsField : packageJsonZeroExportsOrImports();
};

const packageJsonMissingExpectedString = (): Expected<string> => ({
  actualJSONType: "",
  Null: false as bool,
  Valid: false as bool,
  Value: "",
});

const packageJsonPathStringField = (
  packageJson: GoPtr<PackageJson>,
  field: "TSConfig" | "Typings" | "Types" | "Main",
): Expected<string> => {
  const pathFields = packageJson?.__tsgoEmbedded0?.__tsgoEmbedded1;
  return pathFields?.[field] ?? packageJsonMissingExpectedString();
};

const packageJsonHeaderStringField = (
  packageJson: GoPtr<PackageJson>,
  field: "Name" | "Version" | "Type",
): Expected<string> => {
  const headerFields = packageJson?.__tsgoEmbedded0?.__tsgoEmbedded0;
  return headerFields?.[field] ?? packageJsonMissingExpectedString();
};

const packageJsonMissingExpectedStringMap = (): Expected<GoMap<string, string>> => ({
  actualJSONType: "",
  Null: false as bool,
  Valid: false as bool,
  Value: new globalThis.Map(),
});

const packageJsonDependencyMapField = (
  packageJson: GoPtr<PackageJson>,
  field: "Dependencies" | "DevDependencies" | "PeerDependencies" | "OptionalDependencies",
): Expected<GoMap<string, string>> => {
  const dependencyFields = packageJson?.__tsgoEmbedded0?.__tsgoEmbedded2;
  return dependencyFields?.[field] ?? packageJsonMissingExpectedStringMap();
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::resolved","kind":"type","status":"implemented","sigHash":"311657b76bbd117570ff3ef10140ca4f7c058399b9bfb21f60da4a7bbfd4fae4","bodyHash":"988536547950ecf65d459f7d1b2920e811bfcc3b4c02eb4fb4c1b7a1ecaeb092"}
 *
 * Go source:
 * resolved struct {
 * 	path                     string
 * 	extension                string
 * 	packageId                PackageId
 * 	originalPath             string
 * 	resolvedUsingTsExtension bool
 * }
 */
export interface resolved {
  path: string;
  extension: string;
  packageId: PackageId;
  originalPath: string;
  resolvedUsingTsExtension: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolved.shouldContinueSearching","kind":"method","status":"implemented","sigHash":"49b3b3ce5f6a7234c0c1c08fa2deb6a7c08832f183d33dace1f44ef0f9626610","bodyHash":"ad9eaca9b459140d9a7a295c3e783be60abaf8a06f10f9993ff7c8d726cdd24c"}
 *
 * Go source:
 * func (r *resolved) shouldContinueSearching() bool {
 * 	return r == nil
 * }
 */
export function resolved_shouldContinueSearching(receiver: GoPtr<resolved>): bool {
  return receiver === undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolved.isResolved","kind":"method","status":"implemented","sigHash":"c03a9c1f65950df783276eaf75b574199165d103c64789e93aa69cca30577555","bodyHash":"b74e6ccfdbd526ed426cb01a823f807a6a01385fd480f89c2dfcde09b271c4f9"}
 *
 * Go source:
 * func (r *resolved) isResolved() bool {
 * 	return r != nil && r.path != ""
 * }
 */
export function resolved_isResolved(receiver: GoPtr<resolved>): bool {
  return receiver !== undefined && receiver.path !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::continueSearching","kind":"func","status":"implemented","sigHash":"a54359b315564b488c1101004f204ab56e84c591719dca752e0e07be63724fa9","bodyHash":"c1b50664df26578b6190fe4780393687ffdd43741ab0c1432ea24db7df0b232e"}
 *
 * Go source:
 * func continueSearching() *resolved {
 * 	return nil
 * }
 */
export function continueSearching(): GoPtr<resolved> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::unresolved","kind":"func","status":"implemented","sigHash":"599e5a0373175e8519a391a621f822197b045553ff563c2fbfb684e5dfe7b47e","bodyHash":"f93d5bf6ed47cda631834352225614e5c2d2d783044feaed79845577d1edf727"}
 *
 * Go source:
 * func unresolved() *resolved {
 * 	return &resolved{}
 * }
 */
export function unresolved(): GoPtr<resolved> {
  return {
    path: "",
    extension: "",
    packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
    originalPath: "",
    resolvedUsingTsExtension: false,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::resolutionKindSpecificLoader","kind":"type","status":"implemented","sigHash":"23eb8adf72d699d4b31312937de3a30d98ac00b03a1294fad4b403fd39343362","bodyHash":"68d9bfd26d332a31dbe5c67a32f5fa622d09997ea17d8a13df55b6d34050d7ad"}
 *
 * Go source:
 * resolutionKindSpecificLoader = func(extensions extensions, candidate string) *resolved
 */
export type resolutionKindSpecificLoader = (extensions: extensions, candidate: string) => GoPtr<resolved>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::tracer","kind":"type","status":"implemented","sigHash":"8050404d5ebf71062a813d6730884efd1d80674c80fc98df74b43c7afe5d103f","bodyHash":"acf39a892c6fa966aead7abd663baf6acee1ca16c85f7d948f1b2cef0eacf8b5"}
 *
 * Go source:
 * tracer struct {
 * 	traces []DiagAndArgs
 * }
 */
export interface tracer {
  traces: GoSlice<DiagAndArgs>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::DiagAndArgs","kind":"type","status":"implemented","sigHash":"92baf5f3de7e610139565ceedfec4200f7fcf3d26fecd28d94e2e976b8ff7925","bodyHash":"5c2e2e818acc9f2db08625a7ba371cbd7e23459570674895c99d6fecf10537ce"}
 *
 * Go source:
 * DiagAndArgs struct {
 * 	Message *diagnostics.Message
 * 	Args    []any
 * }
 */
export interface DiagAndArgs {
  Message: GoPtr<Message>;
  Args: GoSlice<unknown>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::tracer.write","kind":"method","status":"implemented","sigHash":"4d8cb3a77645343498617a5366fbb7fa014f88bb763ebaa803a7f65797cda3e7","bodyHash":"1c7ced6a88a24ec219a798edca3463e4dcc8805afa46d340e98b028153c6f403"}
 *
 * Go source:
 * func (t *tracer) write(diag *diagnostics.Message, args ...any) {
 * 	if t != nil {
 * 		t.traces = append(t.traces, DiagAndArgs{Message: diag, Args: args})
 * 	}
 * }
 */
export function tracer_write(receiver: GoPtr<tracer>, diag: GoPtr<Message>, ...args: Array<unknown>): void {
  if (receiver !== undefined) {
    receiver.traces = [...receiver.traces, { Message: diag, Args: args }];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::tracer.getTraces","kind":"method","status":"implemented","sigHash":"78a3211f0a8d063e3c3ab3e4f702c39c408f6cfc9f0db733f70372eacc864d16","bodyHash":"102d6f55aab30a04eaf445c74319c8b30d603428f3c1aa120af04327e7d1404f"}
 *
 * Go source:
 * func (t *tracer) getTraces() []DiagAndArgs {
 * 	if t != nil {
 * 		return t.traces
 * 	}
 * 	return nil
 * }
 */
export function tracer_getTraces(receiver: GoPtr<tracer>): GoSlice<DiagAndArgs> {
  if (receiver !== undefined) {
    return receiver.traces;
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::resolutionState","kind":"type","status":"implemented","sigHash":"0c26af9a889477ee14bc4a072a45ce13a93c1552da718dabe1bba0e35b3dff75","bodyHash":"ec0b9e9602ea0294972f7784915769dec11cce2bffca0b7e5c6917f0d5c44a15"}
 *
 * Go source:
 * resolutionState struct {
 * 	resolver *Resolver
 * 	tracer   *tracer
 * 
 * 	// request fields
 * 	name                        string
 * 	containingDirectory         string
 * 	isConfigLookup              bool
 * 	features                    NodeResolutionFeatures
 * 	esmMode                     bool
 * 	conditions                  []string
 * 	extensions                  extensions
 * 	compilerOptions             *core.CompilerOptions
 * 	resolvePackageDirectoryOnly bool
 * 
 * 	// state fields
 * 	// candidateEndingIsFromConfig is set when the candidate file extension originated from
 * 	// configuration (package.json fields, tsconfig.json paths entries, or wildcard substitutions)
 * 	// rather than from the module specifier written in source code. When true, resolvedUsingTsExtension
 * 	// is suppressed so the checker does not attempt to extract a TS extension from the original specifier.
 * 	candidateEndingIsFromConfig bool
 * 	resolvedPackageDirectory    bool
 * 	diagnostics                 []*ast.Diagnostic
 * 
 * 	// Similar to whats on resolver but only done if compilerOptions are for project reference redirect
 * 	// Cached representation for `core.CompilerOptions.paths`.
 * 	// Doesn't handle other path patterns like in `typesVersions`.
 * 	parsedPatternsForPathsOnce sync.Once
 * 	parsedPatternsForPaths     *ParsedPatterns
 * }
 */
export interface resolutionState {
  resolver: GoPtr<Resolver>;
  tracer: GoPtr<tracer>;
  name: string;
  containingDirectory: string;
  isConfigLookup: bool;
  features: NodeResolutionFeatures;
  esmMode: bool;
  conditions: GoSlice<string>;
  extensions: extensions;
  compilerOptions: GoPtr<CompilerOptions>;
  resolvePackageDirectoryOnly: bool;
  candidateEndingIsFromConfig: bool;
  resolvedPackageDirectory: bool;
  diagnostics: GoSlice<GoPtr<Diagnostic>>;
  parsedPatternsForPathsOnce: Once;
  parsedPatternsForPaths: GoPtr<ParsedPatterns>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::newResolutionState","kind":"func","status":"implemented","sigHash":"c5b35f1043a1889417c80d6787859e706a3accf19e2ceb72e3affc07a643bfff","bodyHash":"638564ce17cc1609b41276c2a903b4eb986357c38977b1a58fb9fa0015a2e66d"}
 *
 * Go source:
 * func newResolutionState(
 * 	name string,
 * 	containingDirectory string,
 * 	isTypeReferenceDirective bool,
 * 	resolutionMode core.ResolutionMode,
 * 	compilerOptions *core.CompilerOptions,
 * 	redirectedReference ResolvedProjectReference,
 * 	resolver *Resolver,
 * 	traceBuilder *tracer,
 * ) *resolutionState {
 * 	state := &resolutionState{
 * 		name:                name,
 * 		containingDirectory: containingDirectory,
 * 		compilerOptions:     GetCompilerOptionsWithRedirect(compilerOptions, redirectedReference),
 * 		resolver:            resolver,
 * 		tracer:              traceBuilder,
 * 	}
 * 
 * 	if isTypeReferenceDirective {
 * 		state.extensions = extensionsDeclaration
 * 	} else if compilerOptions.NoDtsResolution == core.TSTrue {
 * 		state.extensions = extensionsImplementationFiles
 * 	} else {
 * 		state.extensions = extensionsTypeScript | extensionsJavaScript | extensionsDeclaration
 * 	}
 * 
 * 	if !isTypeReferenceDirective && compilerOptions.GetResolveJsonModule() {
 * 		state.extensions |= extensionsJson
 * 	}
 * 
 * 	switch compilerOptions.GetModuleResolutionKind() {
 * 	case core.ModuleResolutionKindNode16:
 * 		state.features = NodeResolutionFeaturesNode16Default
 * 		state.esmMode = resolutionMode == core.ModuleKindESNext
 * 		state.conditions = GetConditions(compilerOptions, resolutionMode)
 * 	case core.ModuleResolutionKindNodeNext:
 * 		state.features = NodeResolutionFeaturesNodeNextDefault
 * 		state.esmMode = resolutionMode == core.ModuleKindESNext
 * 		state.conditions = GetConditions(compilerOptions, resolutionMode)
 * 	case core.ModuleResolutionKindBundler:
 * 		state.features = getNodeResolutionFeatures(compilerOptions)
 * 		state.conditions = GetConditions(compilerOptions, resolutionMode)
 * 	}
 * 	return state
 * }
 */
export function newResolutionState(name: string, containingDirectory: string, isTypeReferenceDirective: bool, resolutionMode: ResolutionMode, compilerOptions: GoPtr<CompilerOptions>, redirectedReference: GoPtr<ResolvedProjectReference>, resolver: GoPtr<Resolver>, traceBuilder: GoPtr<tracer>): GoPtr<resolutionState> {
  const state: resolutionState = {
    name: name,
    containingDirectory: containingDirectory,
    compilerOptions: GetCompilerOptionsWithRedirect(compilerOptions, redirectedReference),
    resolver: resolver,
    tracer: traceBuilder,
    isConfigLookup: false,
    features: NodeResolutionFeaturesNone,
    esmMode: false,
    conditions: [],
    extensions: 0 as extensions,
    resolvePackageDirectoryOnly: false,
    candidateEndingIsFromConfig: false,
    resolvedPackageDirectory: false,
    diagnostics: [],
    parsedPatternsForPathsOnce: new Once(),
    parsedPatternsForPaths: undefined,
  };

  if (isTypeReferenceDirective) {
    state.extensions = extensionsDeclaration;
  } else if (compilerOptions!.NoDtsResolution === TSTrue) {
    state.extensions = extensionsImplementationFiles;
  } else {
    state.extensions = extensionsTypeScript | extensionsJavaScript | extensionsDeclaration;
  }

  if (!isTypeReferenceDirective && CompilerOptions_GetResolveJsonModule(compilerOptions)) {
    state.extensions |= extensionsJson;
  }

  switch (CompilerOptions_GetModuleResolutionKind(compilerOptions)) {
    case ModuleResolutionKindNode16:
      state.features = NodeResolutionFeaturesNode16Default;
      state.esmMode = resolutionMode === ModuleKindESNext;
      state.conditions = GetConditions(compilerOptions, resolutionMode);
      break;
    case ModuleResolutionKindNodeNext:
      state.features = NodeResolutionFeaturesNodeNextDefault;
      state.esmMode = resolutionMode === ModuleKindESNext;
      state.conditions = GetConditions(compilerOptions, resolutionMode);
      break;
    case ModuleResolutionKindBundler:
      state.features = getNodeResolutionFeatures(compilerOptions);
      state.conditions = GetConditions(compilerOptions, resolutionMode);
      break;
  }
  return state;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::GetCompilerOptionsWithRedirect","kind":"func","status":"implemented","sigHash":"e3d6239768ca0f19fac6e2dc7ed3650e4c96383f3d11db9d91d35094c1e50b24","bodyHash":"3f4e5e3c312bb91bc8f5cd1a66e26e3f4273f93a39c28493feca39b535b5efa6"}
 *
 * Go source:
 * func GetCompilerOptionsWithRedirect(compilerOptions *core.CompilerOptions, redirectedReference ResolvedProjectReference) *core.CompilerOptions {
 * 	if redirectedReference == nil {
 * 		return compilerOptions
 * 	}
 * 	if optionsFromRedirect := redirectedReference.CompilerOptions(); optionsFromRedirect != nil {
 * 		return optionsFromRedirect
 * 	}
 * 	return compilerOptions
 * }
 */
export function GetCompilerOptionsWithRedirect(compilerOptions: GoPtr<CompilerOptions>, redirectedReference: GoPtr<ResolvedProjectReference>): GoPtr<CompilerOptions> {
  if (redirectedReference === undefined) {
    return compilerOptions;
  }
  const optionsFromRedirect = redirectedReference.CompilerOptions();
  if (optionsFromRedirect !== undefined) {
    return optionsFromRedirect;
  }
  return compilerOptions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::Resolver","kind":"type","status":"implemented","sigHash":"fa4ef46d4eb3b7404a6ed9a7a8ff9dcdbd6d1b755ae320b6b1c86e57496c2c57","bodyHash":"da73f485091a3974edf9592745434180802e96f83d50909c8bfff221c9aeb781"}
 *
 * Go source:
 * Resolver struct {
 * 	caches
 * 	host            ResolutionHost
 * 	compilerOptions *core.CompilerOptions
 * 	typingsLocation string
 * 	projectName     string
 * 	// reportDiagnostic: DiagnosticReporter
 * }
 */
export interface Resolver {
  readonly __tsgoEmbedded0?: caches;
  host: ResolutionHost;
  compilerOptions: GoPtr<CompilerOptions>;
  typingsLocation: string;
  projectName: string;
  parsedPatternsForPathsOnce: Once;
  parsedPatternsForPaths: GoPtr<ParsedPatterns>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::ResolverOptions","kind":"type","status":"implemented","sigHash":"dc8b218ee96c0da513584160848a8d5c924c3b1131e03280bf213a28beb897e2","bodyHash":"0388c305cffb955734aef5183f855fa0d618b4f8b9ea6de07bbb89b4d2e3939f"}
 *
 * Go source:
 * ResolverOptions struct {
 * 	PackageJsonCache *packagejson.InfoCache
 * }
 */
export interface ResolverOptions {
  PackageJsonCache: GoPtr<InfoCache>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::NewResolver","kind":"func","status":"implemented","sigHash":"dfcd4a9e8c2c6fdf90d3aae0680ffe0116b0673333fcea75e8bfac480af84e7d","bodyHash":"fd4f12ba64a16f0cafb6fd9fc3ac24358460d930ab4c69985ac24b6e6b28284a"}
 *
 * Go source:
 * func NewResolver(
 * 	host ResolutionHost,
 * 	options *core.CompilerOptions,
 * 	typingsLocation string,
 * 	projectName string,
 * ) *Resolver {
 * 	return &Resolver{
 * 		host:            host,
 * 		caches:          newCaches(host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames(), options),
 * 		compilerOptions: options,
 * 		typingsLocation: typingsLocation,
 * 		projectName:     projectName,
 * 	}
 * }
 */
export function NewResolver(host: ResolutionHost, options: GoPtr<CompilerOptions>, typingsLocation: string, projectName: string): GoPtr<Resolver> {
  const c = newCaches(host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames(), options);
  return {
    __tsgoEmbedded0: c,
    host: host,
    compilerOptions: options,
    typingsLocation: typingsLocation ?? "",
    projectName: projectName ?? "",
    parsedPatternsForPathsOnce: new Once(),
    parsedPatternsForPaths: undefined,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::NewResolverWithOptions","kind":"func","status":"implemented","sigHash":"40ef7ad11b9840ac6b4791bf10dde9d27aa7639beb1f5c6df6afa0ff15d59f27","bodyHash":"e846bd93aff6f325779f8a518f7bc6d71619f55afeaf508f55409b2d121228de"}
 *
 * Go source:
 * func NewResolverWithOptions(
 * 	host ResolutionHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	typingsLocation string,
 * 	projectName string,
 * 	opts ResolverOptions,
 * ) *Resolver {
 * 	r := &Resolver{
 * 		host:            host,
 * 		compilerOptions: compilerOptions,
 * 		typingsLocation: typingsLocation,
 * 		projectName:     projectName,
 * 	}
 * 	if opts.PackageJsonCache != nil {
 * 		r.packageJsonInfoCache = opts.PackageJsonCache
 * 	} else {
 * 		r.caches = newCaches(host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames(), compilerOptions)
 * 	}
 * 	return r
 * }
 */
export function NewResolverWithOptions(host: ResolutionHost, compilerOptions: GoPtr<CompilerOptions>, typingsLocation: string, projectName: string, opts: ResolverOptions): GoPtr<Resolver> {
  let embedded: caches;
  if (opts.PackageJsonCache !== undefined) {
    embedded = {
      packageJsonInfoCache: opts.PackageJsonCache,
      moduleResolutionCache: { cache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } },
      typeRefDirectiveResolutionCache: { cache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } },
      parsedPatternsForPathsOnce: new Once(),
      parsedPatternsForPaths: undefined,
    };
  } else {
    embedded = newCaches(host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames(), compilerOptions);
  }
  return {
    __tsgoEmbedded0: embedded,
    host: host,
    compilerOptions: compilerOptions,
    typingsLocation: typingsLocation ?? "",
    projectName: projectName ?? "",
    parsedPatternsForPathsOnce: new Once(),
    parsedPatternsForPaths: undefined,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.newTraceBuilder","kind":"method","status":"implemented","sigHash":"23c4a59de04090b673abccd1fb71a4914248a09426ceddaa9acefc5e096a9f68","bodyHash":"297c9dca896202b342f9e022d8931f376702b2485a689c0faf52d0afc2099959"}
 *
 * Go source:
 * func (r *Resolver) newTraceBuilder() *tracer {
 * 	if r.compilerOptions.TraceResolution == core.TSTrue {
 * 		return &tracer{}
 * 	}
 * 	return nil
 * }
 */
export function Resolver_newTraceBuilder(receiver: GoPtr<Resolver>): GoPtr<tracer> {
  if (receiver!.compilerOptions!.TraceResolution === TSTrue) {
    return { traces: [] };
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.GetPackageScopeForPath","kind":"method","status":"implemented","sigHash":"205d7ffe29c186ea66f76b608e2b80187e49d6e8c3789fe332228536935dfba6","bodyHash":"6fd4495a45462533967f6d35b6d566e38e143bce99cf27bca3804d3d34ba6fd7"}
 *
 * Go source:
 * func (r *Resolver) GetPackageScopeForPath(directory string) *packagejson.InfoCacheEntry {
 * 	return (&resolutionState{compilerOptions: r.compilerOptions, resolver: r}).getPackageScopeForPath(directory)
 * }
 */
export function Resolver_GetPackageScopeForPath(receiver: GoPtr<Resolver>, directory: string): GoPtr<InfoCacheEntry> {
  const state: resolutionState = {
    resolver: receiver,
    tracer: undefined,
    name: "",
    containingDirectory: "",
    isConfigLookup: false,
    features: NodeResolutionFeaturesNone,
    esmMode: false,
    conditions: [],
    extensions: 0 as extensions,
    compilerOptions: receiver!.compilerOptions,
    resolvePackageDirectoryOnly: false,
    candidateEndingIsFromConfig: false,
    resolvedPackageDirectory: false,
    diagnostics: [],
    parsedPatternsForPathsOnce: new Once(),
    parsedPatternsForPaths: undefined,
  };
  return resolutionState_getPackageScopeForPath(state, directory);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::tracer.traceResolutionUsingProjectReference","kind":"method","status":"implemented","sigHash":"f87db2498f10097e25f484eefb244b16412483684c4f2a6b46a14c5023802afb","bodyHash":"a91e3bc3548a950a819fb1ddc436d42a12b5f6c5e42a975eb8c82591524f44c0"}
 *
 * Go source:
 * func (r *tracer) traceResolutionUsingProjectReference(redirectedReference ResolvedProjectReference) {
 * 	if redirectedReference != nil && redirectedReference.CompilerOptions() != nil {
 * 		r.write(diagnostics.Using_compiler_options_of_project_reference_redirect_0, redirectedReference.ConfigName())
 * 	}
 * }
 */
export function tracer_traceResolutionUsingProjectReference(receiver: GoPtr<tracer>, redirectedReference: GoPtr<ResolvedProjectReference>): void {
  if (redirectedReference !== undefined && redirectedReference.CompilerOptions() !== undefined) {
    tracer_write(receiver, diagnostics.Using_compiler_options_of_project_reference_redirect_0, redirectedReference.ConfigName());
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.ResolveTypeReferenceDirective","kind":"method","status":"implemented","sigHash":"fa96182ff6b8ed76f6634c8a4d8c4a1c11e7f97530b514beefdbb7e7d69e48d5","bodyHash":"6db9e8e7ab1f08ce53ac47600c78429b11ec8908f858286b5f46a45b0686490d"}
 *
 * Go source:
 * func (r *Resolver) ResolveTypeReferenceDirective(
 * 	typeReferenceDirectiveName string,
 * 	containingFile string,
 * 	resolutionMode core.ResolutionMode,
 * 	redirectedReference ResolvedProjectReference,
 * ) (*ResolvedTypeReferenceDirective, []DiagAndArgs) {
 * 	containingDirectory := tspath.GetDirectoryPath(containingFile)
 * 	traceBuilder := r.newTraceBuilder()
 * 
 * 	fromInferredTypesContainingFile := strings.HasSuffix(containingFile, InferredTypesContainingFile)
 * 
 * 	cacheKey := typeRefDirectiveResolutionCacheKey{
 * 		containingDirectory:             containingDirectory,
 * 		typeReferenceName:               typeReferenceDirectiveName,
 * 		resolutionMode:                  resolutionMode,
 * 		redirectConfigName:              getRedirectConfigName(redirectedReference),
 * 		fromInferredTypesContainingFile: fromInferredTypesContainingFile,
 * 	}
 * 
 * 	if traceBuilder == nil {
 * 		if cached, ok := r.typeRefDirectiveResolutionCache.Get(cacheKey); ok {
 * 			return cached, nil
 * 		}
 * 	}
 * 
 * 	compilerOptions := GetCompilerOptionsWithRedirect(r.compilerOptions, redirectedReference)
 * 
 * 	typeRoots, fromConfig := compilerOptions.GetEffectiveTypeRoots(r.host.GetCurrentDirectory())
 * 	if traceBuilder != nil {
 * 		traceBuilder.write(diagnostics.Resolving_type_reference_directive_0_containing_file_1_root_directory_2, typeReferenceDirectiveName, containingFile, strings.Join(typeRoots, ","))
 * 		traceBuilder.traceResolutionUsingProjectReference(redirectedReference)
 * 	}
 * 
 * 	state := newResolutionState(typeReferenceDirectiveName, containingDirectory, true /*isTypeReferenceDirective* /, resolutionMode, compilerOptions, redirectedReference, r, traceBuilder)
 * 	result := state.resolveTypeReferenceDirective(typeRoots, fromConfig, fromInferredTypesContainingFile)
 * 
 * 	if traceBuilder != nil {
 * 		traceBuilder.traceTypeReferenceDirectiveResult(typeReferenceDirectiveName, result)
 * 	}
 * 
 * 	r.typeRefDirectiveResolutionCache.Set(cacheKey, result)
 * 
 * 	return result, traceBuilder.getTraces()
 * }
 */
export function Resolver_ResolveTypeReferenceDirective(receiver: GoPtr<Resolver>, typeReferenceDirectiveName: string, containingFile: string, resolutionMode: ResolutionMode, redirectedReference: GoPtr<ResolvedProjectReference>): [GoPtr<ResolvedTypeReferenceDirective>, GoSlice<DiagAndArgs>] {
  const containingDirectory = tspath.GetDirectoryPath(containingFile);
  const traceBuilder = Resolver_newTraceBuilder(receiver);
  const fromInferredTypesContainingFile = strings.HasSuffix(containingFile, InferredTypesContainingFile);
  const cacheKey: typeRefDirectiveResolutionCacheKey = {
    containingDirectory: containingDirectory,
    typeReferenceName: typeReferenceDirectiveName,
    resolutionMode: resolutionMode,
    redirectConfigName: getRedirectConfigName(redirectedReference),
    fromInferredTypesContainingFile: fromInferredTypesContainingFile,
  };
  if (traceBuilder === undefined) {
    const [cached, ok] = typeRefDirectiveResolutionCache_Get(receiver!.__tsgoEmbedded0!.typeRefDirectiveResolutionCache, cacheKey);
    if (ok) {
      return [cached, []];
    }
  }
  const compilerOptions = GetCompilerOptionsWithRedirect(receiver!.compilerOptions, redirectedReference);
  const [typeRoots, fromConfig] = CompilerOptions_GetEffectiveTypeRoots(compilerOptions, receiver!.host.GetCurrentDirectory());
  if (traceBuilder !== undefined) {
    tracer_write(traceBuilder, diagnostics.Resolving_type_reference_directive_0_containing_file_1_root_directory_2, typeReferenceDirectiveName, containingFile, strings.Join(typeRoots, ","));
    tracer_traceResolutionUsingProjectReference(traceBuilder, redirectedReference);
  }
  const state = newResolutionState(typeReferenceDirectiveName, containingDirectory, true, resolutionMode, compilerOptions, redirectedReference, receiver, traceBuilder);
  const result = resolutionState_resolveTypeReferenceDirective(state, typeRoots, fromConfig, fromInferredTypesContainingFile);
  if (traceBuilder !== undefined) {
    tracer_traceTypeReferenceDirectiveResult(traceBuilder, typeReferenceDirectiveName, result);
  }
  typeRefDirectiveResolutionCache_Set(receiver!.__tsgoEmbedded0!.typeRefDirectiveResolutionCache, cacheKey, result);
  return [result, tracer_getTraces(traceBuilder)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.ResolveModuleName","kind":"method","status":"implemented","sigHash":"3704aaf9c9093b8ba6ae8661e4c52b10730cfa1c8c0068e17445178c074a428c","bodyHash":"94f8255bde09d1f88d0f04d161ca01a8357c57decd56db6c055dcea777d7c913"}
 *
 * Go source:
 * func (r *Resolver) ResolveModuleName(moduleName string, containingFile string, resolutionMode core.ResolutionMode, redirectedReference ResolvedProjectReference) (*ResolvedModule, []DiagAndArgs) {
 * 	containingDirectory := tspath.GetDirectoryPath(containingFile)
 * 	traceBuilder := r.newTraceBuilder()
 * 
 * 	cacheKey := moduleResolutionCacheKey{
 * 		containingDirectory: containingDirectory,
 * 		moduleName:          moduleName,
 * 		resolutionMode:      resolutionMode,
 * 		redirectConfigName:  getRedirectConfigName(redirectedReference),
 * 	}
 * 
 * 	if traceBuilder == nil {
 * 		if cached, ok := r.moduleResolutionCache.Get(cacheKey); ok {
 * 			return cached, nil
 * 		}
 * 	}
 * 
 * 	compilerOptions := GetCompilerOptionsWithRedirect(r.compilerOptions, redirectedReference)
 * 	if traceBuilder != nil {
 * 		traceBuilder.write(diagnostics.Resolving_module_0_from_1, moduleName, containingFile)
 * 		traceBuilder.traceResolutionUsingProjectReference(redirectedReference)
 * 	}
 * 
 * 	moduleResolution := compilerOptions.GetModuleResolutionKind()
 * 	if compilerOptions.ModuleResolution != moduleResolution {
 * 		if traceBuilder != nil {
 * 			traceBuilder.write(diagnostics.Module_resolution_kind_is_not_specified_using_0, moduleResolution.String())
 * 		}
 * 	} else {
 * 		if traceBuilder != nil {
 * 			traceBuilder.write(diagnostics.Explicitly_specified_module_resolution_kind_Colon_0, moduleResolution.String())
 * 		}
 * 	}
 * 
 * 	var result *ResolvedModule
 * 	switch moduleResolution {
 * 	case core.ModuleResolutionKindNode16, core.ModuleResolutionKindNodeNext, core.ModuleResolutionKindBundler:
 * 		state := newResolutionState(moduleName, containingDirectory, false /*isTypeReferenceDirective* /, resolutionMode, compilerOptions, redirectedReference, r, traceBuilder)
 * 		result = state.resolveNodeLike()
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected moduleResolution: %d", moduleResolution))
 * 	}
 * 
 * 	if traceBuilder != nil {
 * 		if result.IsResolved() {
 * 			if result.PackageId.Name != "" {
 * 				traceBuilder.write(diagnostics.Module_name_0_was_successfully_resolved_to_1_with_Package_ID_2, moduleName, result.ResolvedFileName, result.PackageId.String())
 * 			} else {
 * 				traceBuilder.write(diagnostics.Module_name_0_was_successfully_resolved_to_1, moduleName, result.ResolvedFileName)
 * 			}
 * 		} else {
 * 			traceBuilder.write(diagnostics.Module_name_0_was_not_resolved, moduleName)
 * 		}
 * 	}
 * 
 * 	finalResult := r.tryResolveFromTypingsLocation(moduleName, containingDirectory, result, traceBuilder)
 * 	r.moduleResolutionCache.Set(cacheKey, finalResult)
 * 
 * 	return finalResult, traceBuilder.getTraces()
 * }
 */
export function Resolver_ResolveModuleName(receiver: GoPtr<Resolver>, moduleName: string, containingFile: string, resolutionMode: ResolutionMode, redirectedReference: GoPtr<ResolvedProjectReference>): [GoPtr<ResolvedModule>, GoSlice<DiagAndArgs>] {
  const containingDirectory = tspath.GetDirectoryPath(containingFile);
  const traceBuilder = Resolver_newTraceBuilder(receiver);
  const cacheKey: moduleResolutionCacheKey = {
    containingDirectory: containingDirectory,
    moduleName: moduleName,
    resolutionMode: resolutionMode,
    redirectConfigName: getRedirectConfigName(redirectedReference),
  };
  if (traceBuilder === undefined) {
    const [cached, ok] = moduleResolutionCache_Get(receiver!.__tsgoEmbedded0!.moduleResolutionCache, cacheKey);
    if (ok) {
      return [cached, []];
    }
  }
  const compilerOptions = GetCompilerOptionsWithRedirect(receiver!.compilerOptions, redirectedReference);
  if (traceBuilder !== undefined) {
    tracer_write(traceBuilder, diagnostics.Resolving_module_0_from_1, moduleName, containingFile);
    tracer_traceResolutionUsingProjectReference(traceBuilder, redirectedReference);
  }
  const moduleResolution = CompilerOptions_GetModuleResolutionKind(compilerOptions);
  const specifiedModuleResolution = compilerOptions!.ModuleResolution ?? ModuleResolutionKindUnknown;
  if (specifiedModuleResolution !== moduleResolution) {
    if (traceBuilder !== undefined) {
      tracer_write(traceBuilder, diagnostics.Module_resolution_kind_is_not_specified_using_0, ModuleResolutionKind_String(moduleResolution));
    }
  } else {
    if (traceBuilder !== undefined) {
      tracer_write(traceBuilder, diagnostics.Explicitly_specified_module_resolution_kind_Colon_0, ModuleResolutionKind_String(moduleResolution));
    }
  }
  let result: GoPtr<ResolvedModule>;
  switch (moduleResolution) {
    case ModuleResolutionKindNode16:
    case ModuleResolutionKindNodeNext:
    case ModuleResolutionKindBundler: {
      const state = newResolutionState(moduleName, containingDirectory, false, resolutionMode, compilerOptions, redirectedReference, receiver, traceBuilder);
      result = resolutionState_resolveNodeLike(state);
      break;
    }
    default:
      throw new globalThis.Error(`Unexpected moduleResolution: ${moduleResolution}`);
  }
  if (traceBuilder !== undefined) {
    if (ResolvedModule_IsResolved(result)) {
      if (result!.PackageId.Name !== "") {
        tracer_write(traceBuilder, diagnostics.Module_name_0_was_successfully_resolved_to_1_with_Package_ID_2, moduleName, result!.ResolvedFileName, PackageId_String(result!.PackageId));
      } else {
        tracer_write(traceBuilder, diagnostics.Module_name_0_was_successfully_resolved_to_1, moduleName, result!.ResolvedFileName);
      }
    } else {
      tracer_write(traceBuilder, diagnostics.Module_name_0_was_not_resolved, moduleName);
    }
  }
  const finalResult = Resolver_tryResolveFromTypingsLocation(receiver, moduleName, containingDirectory, result, traceBuilder);
  moduleResolutionCache_Set(receiver!.__tsgoEmbedded0!.moduleResolutionCache, cacheKey, finalResult);
  return [finalResult, tracer_getTraces(traceBuilder)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.ResolvePackageDirectory","kind":"method","status":"implemented","sigHash":"00aaf0706d5b866127a21df6b761b99f248ee073c90aece628af4e287ccaccfc","bodyHash":"d7f08ae83d9a956b410bc2f12ad129f3fa2f29e4e739e39dd5465713713ee419"}
 *
 * Go source:
 * func (r *Resolver) ResolvePackageDirectory(moduleName string, containingFile string, resolutionMode core.ResolutionMode, redirectedReference ResolvedProjectReference) *ResolvedModule {
 * 	compilerOptions := GetCompilerOptionsWithRedirect(r.compilerOptions, redirectedReference)
 * 	containingDirectory := tspath.GetDirectoryPath(containingFile)
 * 	state := newResolutionState(moduleName, containingDirectory, false /*isTypeReferenceDirective* /, resolutionMode, compilerOptions, redirectedReference, r, nil)
 * 	state.resolvePackageDirectoryOnly = true
 * 	if result := state.loadModuleFromNearestNodeModulesDirectory(false /*typesScopeOnly* /); result != nil && result.path != "" {
 * 		return state.createResolvedModuleHandlingSymlink(result)
 * 	}
 * 	return nil
 * }
 */
export function Resolver_ResolvePackageDirectory(receiver: GoPtr<Resolver>, moduleName: string, containingFile: string, resolutionMode: ResolutionMode, redirectedReference: GoPtr<ResolvedProjectReference>): GoPtr<ResolvedModule> {
  const compilerOptions = GetCompilerOptionsWithRedirect(receiver!.compilerOptions, redirectedReference);
  const containingDirectory = tspath.GetDirectoryPath(containingFile);
  const state = newResolutionState(moduleName, containingDirectory, false, resolutionMode, compilerOptions, redirectedReference, receiver, undefined);
  state!.resolvePackageDirectoryOnly = true;
  const result = resolutionState_loadModuleFromNearestNodeModulesDirectory(state, false);
  if (!resolved_shouldContinueSearching(result) && result!.path !== "") {
    return resolutionState_createResolvedModuleHandlingSymlink(state, result);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.tryResolveFromTypingsLocation","kind":"method","status":"implemented","sigHash":"84f6f7ce51e31ab93e63bf6df26ed2700a3840e9625e29d61ca082dde889ef94","bodyHash":"c35556bf68757c325b2a2d7a86745cd13095b4740419f4c4c161b16f3eaf586e"}
 *
 * Go source:
 * func (r *Resolver) tryResolveFromTypingsLocation(moduleName string, containingDirectory string, originalResult *ResolvedModule, traceBuilder *tracer) *ResolvedModule {
 * 	if r.typingsLocation == "" ||
 * 		tspath.IsExternalModuleNameRelative(moduleName) ||
 * 		(originalResult.ResolvedFileName != "" && tspath.ExtensionIsOneOf(originalResult.Extension, tspath.SupportedTSExtensionsWithJsonFlat)) {
 * 		return originalResult
 * 	}
 * 
 * 	state := newResolutionState(
 * 		moduleName,
 * 		containingDirectory,
 * 		false,               /*isTypeReferenceDirective* /
 * 		core.ModuleKindNone, // resolutionMode,
 * 		r.compilerOptions,
 * 		nil, // redirectedReference,
 * 		r,
 * 		traceBuilder,
 * 	)
 * 	if traceBuilder != nil {
 * 		traceBuilder.write(diagnostics.Auto_discovery_for_typings_is_enabled_in_project_0_Running_extra_resolution_pass_for_module_1_using_cache_location_2, r.projectName, moduleName, r.typingsLocation)
 * 	}
 * 	globalResolved := state.loadModuleFromImmediateNodeModulesDirectory(extensionsDeclaration, r.typingsLocation, false)
 * 	if globalResolved == nil {
 * 		return originalResult
 * 	}
 * 	result := state.createResolvedModule(globalResolved, true)
 * 	result.ResolutionDiagnostics = append(originalResult.ResolutionDiagnostics, result.ResolutionDiagnostics...)
 * 	return result
 * }
 */
export function Resolver_tryResolveFromTypingsLocation(receiver: GoPtr<Resolver>, moduleName: string, containingDirectory: string, originalResult: GoPtr<ResolvedModule>, traceBuilder: GoPtr<tracer>): GoPtr<ResolvedModule> {
  if (
    receiver!.typingsLocation === "" ||
    tspath.IsExternalModuleNameRelative(moduleName) ||
    (originalResult!.ResolvedFileName !== "" && extension.ExtensionIsOneOf(originalResult!.Extension, extension.SupportedTSExtensionsWithJsonFlat as string[]))
  ) {
    return originalResult;
  }
  const state = newResolutionState(moduleName, containingDirectory, false, ModuleKindNone, receiver!.compilerOptions, undefined, receiver, traceBuilder);
  if (traceBuilder !== undefined) {
    tracer_write(traceBuilder, diagnostics.Auto_discovery_for_typings_is_enabled_in_project_0_Running_extra_resolution_pass_for_module_1_using_cache_location_2, receiver!.projectName, moduleName, receiver!.typingsLocation);
  }
  const globalResolved = resolutionState_loadModuleFromImmediateNodeModulesDirectory(state, extensionsDeclaration, receiver!.typingsLocation, false);
  if (globalResolved === undefined) {
    return originalResult;
  }
  const result = resolutionState_createResolvedModule(state, globalResolved, true);
  result!.ResolutionDiagnostics = [...(originalResult!.ResolutionDiagnostics ?? []), ...(result!.ResolutionDiagnostics ?? [])];
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.resolveConfig","kind":"method","status":"implemented","sigHash":"e02ab7dc8bedb2ef3ffb4ff57a4b101fe5d7d60f40295fae0acea97745a37e49","bodyHash":"913468cd9314e956e220c7eacc2244d3c17e9a01413bff51de49a279a5118066"}
 *
 * Go source:
 * func (r *Resolver) resolveConfig(moduleName string, containingFile string) *ResolvedModule {
 * 	containingDirectory := tspath.GetDirectoryPath(containingFile)
 * 	state := newResolutionState(moduleName, containingDirectory, false /*isTypeReferenceDirective* /, core.ModuleKindCommonJS, r.compilerOptions, nil, r, nil)
 * 	state.isConfigLookup = true
 * 	state.extensions = extensionsJson
 * 	return state.resolveNodeLike()
 * }
 */
export function Resolver_resolveConfig(receiver: GoPtr<Resolver>, moduleName: string, containingFile: string): GoPtr<ResolvedModule> {
  const containingDirectory = tspath.GetDirectoryPath(containingFile);
  const state = newResolutionState(moduleName, containingDirectory, false, ModuleKindCommonJS, receiver!.compilerOptions, undefined, receiver, undefined);
  state!.isConfigLookup = true;
  state!.extensions = extensionsJson;
  return resolutionState_resolveNodeLike(state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::tracer.traceTypeReferenceDirectiveResult","kind":"method","status":"implemented","sigHash":"78cdd1a8e6362e1e4b2bdf66e52f3a8511c27fefadc9b90f285c3470e41398a3","bodyHash":"9e6b13c3d831a9101b691eab07ffc96564466aae8432dbf0952f062a47b42ec6"}
 *
 * Go source:
 * func (r *tracer) traceTypeReferenceDirectiveResult(typeReferenceDirectiveName string, result *ResolvedTypeReferenceDirective) {
 * 	if !result.IsResolved() {
 * 		r.write(diagnostics.Type_reference_directive_0_was_not_resolved, typeReferenceDirectiveName)
 * 	} else if result.PackageId.Name != "" {
 * 		r.write(diagnostics.Type_reference_directive_0_was_successfully_resolved_to_1_with_Package_ID_2_primary_Colon_3,
 * 			typeReferenceDirectiveName,
 * 			result.ResolvedFileName,
 * 			result.PackageId.String(),
 * 			result.Primary,
 * 		)
 * 	} else {
 * 		r.write(diagnostics.Type_reference_directive_0_was_successfully_resolved_to_1_primary_Colon_2,
 * 			typeReferenceDirectiveName,
 * 			result.ResolvedFileName,
 * 			result.Primary,
 * 		)
 * 	}
 * }
 */
export function tracer_traceTypeReferenceDirectiveResult(receiver: GoPtr<tracer>, typeReferenceDirectiveName: string, result: GoPtr<ResolvedTypeReferenceDirective>): void {
  if (!ResolvedTypeReferenceDirective_IsResolved(result)) {
    tracer_write(receiver, diagnostics.Type_reference_directive_0_was_not_resolved, typeReferenceDirectiveName);
  } else if (result!.PackageId.Name !== "") {
    tracer_write(
      receiver,
      diagnostics.Type_reference_directive_0_was_successfully_resolved_to_1_with_Package_ID_2_primary_Colon_3,
      typeReferenceDirectiveName,
      result!.ResolvedFileName,
      PackageId_String(result!.PackageId),
      result!.Primary,
    );
  } else {
    tracer_write(
      receiver,
      diagnostics.Type_reference_directive_0_was_successfully_resolved_to_1_primary_Colon_2,
      typeReferenceDirectiveName,
      result!.ResolvedFileName,
      result!.Primary,
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.resolveTypeReferenceDirective","kind":"method","status":"implemented","sigHash":"da3eb126d62fb9ec1530aacae50a86016197784bda9aca7a48d65188134ae3a8","bodyHash":"41b7bb8bd0a545ee4a59dfbf5eaf0b178d5b23baf17e8797a7eef2de393ae6fd"}
 *
 * Go source:
 * func (r *resolutionState) resolveTypeReferenceDirective(typeRoots []string, fromConfig bool, fromInferredTypesContainingFile bool) *ResolvedTypeReferenceDirective {
 * 	// Primary lookup
 * 	if len(typeRoots) > 0 {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Resolving_with_primary_search_path_0, strings.Join(typeRoots, ", "))
 * 		}
 * 		for _, typeRoot := range typeRoots {
 * 			candidate := r.getCandidateFromTypeRoot(typeRoot)
 * 			directoryExists := r.resolver.host.FS().DirectoryExists(typeRoot)
 * 			if !directoryExists {
 * 				if r.tracer != nil {
 * 					r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, typeRoot)
 * 				}
 * 				continue
 * 			}
 * 			if fromConfig {
 * 				// Custom typeRoots resolve as file or directory just like we do modules
 * 				if resolvedFromFile := r.loadModuleFromFile(extensionsDeclaration, candidate); !resolvedFromFile.shouldContinueSearching() {
 * 					packageDirectory := ParseNodeModuleFromPath(resolvedFromFile.path, false)
 * 					if packageDirectory != "" {
 * 						resolvedFromFile.packageId = r.getPackageId(resolvedFromFile.path, r.getPackageJsonInfo(packageDirectory))
 * 					}
 * 					return r.createResolvedTypeReferenceDirective(resolvedFromFile, true /*primary* /)
 * 				}
 * 			}
 * 			if resolvedFromDirectory := r.loadNodeModuleFromDirectory(extensionsDeclaration, candidate, true /*considerPackageJson* /); !resolvedFromDirectory.shouldContinueSearching() {
 * 				return r.createResolvedTypeReferenceDirective(resolvedFromDirectory, true /*primary* /)
 * 			}
 * 		}
 * 	} else if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Root_directory_cannot_be_determined_skipping_primary_search_paths)
 * 	}
 * 
 * 	// Secondary lookup
 * 	var resolved *resolved
 * 	if !fromConfig || !fromInferredTypesContainingFile {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Looking_up_in_node_modules_folder_initial_location_0, r.containingDirectory)
 * 		}
 * 		if !tspath.IsExternalModuleNameRelative(r.name) {
 * 			resolved = r.loadModuleFromNearestNodeModulesDirectory(false /*typesScopeOnly* /)
 * 		} else {
 * 			candidate := normalizePathForCJSResolution(r.containingDirectory, r.name)
 * 			resolved = r.nodeLoadModuleByRelativeName(extensionsDeclaration, candidate, true /*considerPackageJson* /)
 * 		}
 * 	} else if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Resolving_type_reference_directive_for_program_that_specifies_custom_typeRoots_skipping_lookup_in_node_modules_folder)
 * 	}
 * 	return r.createResolvedTypeReferenceDirective(resolved, false /*primary* /)
 * }
 */
export function resolutionState_resolveTypeReferenceDirective(receiver: GoPtr<resolutionState>, typeRoots: GoSlice<string>, fromConfig: bool, fromInferredTypesContainingFile: bool): GoPtr<ResolvedTypeReferenceDirective> {
  if (typeRoots.length > 0) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Resolving_with_primary_search_path_0, strings.Join(typeRoots, ", "));
    }
    for (const typeRoot of typeRoots) {
      const candidate = resolutionState_getCandidateFromTypeRoot(receiver, typeRoot);
      const directoryExists = receiver!.resolver!.host.FS().DirectoryExists(typeRoot);
      if (!directoryExists) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, typeRoot);
        }
        continue;
      }
      if (fromConfig) {
        const resolvedFromFile = resolutionState_loadModuleFromFile(receiver, extensionsDeclaration, candidate);
        if (!resolved_shouldContinueSearching(resolvedFromFile)) {
          const packageDirectory = ParseNodeModuleFromPath(resolvedFromFile!.path, false);
          if (packageDirectory !== "") {
            resolvedFromFile!.packageId = resolutionState_getPackageId(receiver, resolvedFromFile!.path, resolutionState_getPackageJsonInfo(receiver, packageDirectory));
          }
          return resolutionState_createResolvedTypeReferenceDirective(receiver, resolvedFromFile, true);
        }
      }
      const resolvedFromDirectory = resolutionState_loadNodeModuleFromDirectory(receiver, extensionsDeclaration, candidate, true);
      if (!resolved_shouldContinueSearching(resolvedFromDirectory)) {
        return resolutionState_createResolvedTypeReferenceDirective(receiver, resolvedFromDirectory, true);
      }
    }
  } else if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Root_directory_cannot_be_determined_skipping_primary_search_paths);
  }
  let resolved: GoPtr<resolved> = undefined;
  if (!fromConfig || !fromInferredTypesContainingFile) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Looking_up_in_node_modules_folder_initial_location_0, receiver!.containingDirectory);
    }
    if (!tspath.IsExternalModuleNameRelative(receiver!.name)) {
      resolved = resolutionState_loadModuleFromNearestNodeModulesDirectory(receiver, false);
    } else {
      const candidate = normalizePathForCJSResolution(receiver!.containingDirectory, receiver!.name);
      resolved = resolutionState_nodeLoadModuleByRelativeName(receiver, extensionsDeclaration, candidate, true);
    }
  } else if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Resolving_type_reference_directive_for_program_that_specifies_custom_typeRoots_skipping_lookup_in_node_modules_folder);
  }
  return resolutionState_createResolvedTypeReferenceDirective(receiver, resolved, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getCandidateFromTypeRoot","kind":"method","status":"implemented","sigHash":"48d97192c92cf334b870ab4b533337b38517fbe063575b8bfb6bc4bb67e855d3","bodyHash":"fd00d8ecb1c5dcd1a1de19d982cb9cabf8db00c16ba2f0d916aa4b59d6e460fc"}
 *
 * Go source:
 * func (r *resolutionState) getCandidateFromTypeRoot(typeRoot string) string {
 * 	nameForLookup := r.name
 * 	if strings.HasSuffix(typeRoot, "/node_modules/@types") || strings.HasSuffix(typeRoot, "/node_modules/@types/") {
 * 		nameForLookup = r.mangleScopedPackageName(r.name)
 * 	}
 * 	return tspath.CombinePaths(typeRoot, nameForLookup)
 * }
 */
export function resolutionState_getCandidateFromTypeRoot(receiver: GoPtr<resolutionState>, typeRoot: string): string {
  let nameForLookup = receiver!.name;
  if (strings.HasSuffix(typeRoot, "/node_modules/@types") || strings.HasSuffix(typeRoot, "/node_modules/@types/")) {
    nameForLookup = resolutionState_mangleScopedPackageName(receiver, receiver!.name);
  }
  return tspath.CombinePaths(typeRoot, nameForLookup);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.mangleScopedPackageName","kind":"method","status":"implemented","sigHash":"8b3b1bc1477ef79de601001a2cc9a0d82e9da50137bd5ac965613473cf00eef2","bodyHash":"fc1afcafc42cab16c44b39b45cb1cb07e242194c8cae7dc9415ffb6644d15df1"}
 *
 * Go source:
 * func (r *resolutionState) mangleScopedPackageName(name string) string {
 * 	mangled := MangleScopedPackageName(name)
 * 	if r.tracer != nil && mangled != name {
 * 		r.tracer.write(diagnostics.Scoped_package_detected_looking_in_0, mangled)
 * 	}
 * 	return mangled
 * }
 */
export function resolutionState_mangleScopedPackageName(receiver: GoPtr<resolutionState>, name: string): string {
  const mangled = MangleScopedPackageName(name);
  if (receiver!.tracer !== undefined && mangled !== name) {
    tracer_write(receiver!.tracer, diagnostics.Scoped_package_detected_looking_in_0, mangled);
  }
  return mangled;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.resolveFromTypeRoot","kind":"method","status":"implemented","sigHash":"1c666b09e165983957b899b893b7eccbdbfc01097379125310cf1d0b023f09d1","bodyHash":"bc01cd73efe167bd0ff49107cb5ec8b791d55386a8d30035bd405d697c474a7f"}
 *
 * Go source:
 * func (r *resolutionState) resolveFromTypeRoot() *resolved {
 * 	if r.compilerOptions.TypeRoots == nil {
 * 		return nil
 * 	}
 * 	for _, typeRoot := range r.compilerOptions.TypeRoots {
 * 		candidate := r.getCandidateFromTypeRoot(typeRoot)
 * 		directoryExists := r.resolver.host.FS().DirectoryExists(typeRoot)
 * 		if !directoryExists {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, typeRoot)
 * 			}
 * 			continue
 * 		}
 * 		if resolvedFromFile := r.loadModuleFromFile(extensionsDeclaration, candidate); !resolvedFromFile.shouldContinueSearching() {
 * 			packageDirectory := ParseNodeModuleFromPath(resolvedFromFile.path, false)
 * 			if packageDirectory != "" {
 * 				resolvedFromFile.packageId = r.getPackageId(resolvedFromFile.path, r.getPackageJsonInfo(packageDirectory))
 * 			}
 * 			return resolvedFromFile
 * 		}
 * 		if resolved := r.loadNodeModuleFromDirectory(extensionsDeclaration, candidate, true /*considerPackageJson* /); !resolved.shouldContinueSearching() {
 * 			return resolved
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function resolutionState_resolveFromTypeRoot(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  if (receiver!.compilerOptions!.TypeRoots === undefined) {
    return undefined;
  }
  for (const typeRoot of receiver!.compilerOptions!.TypeRoots) {
    const candidate = resolutionState_getCandidateFromTypeRoot(receiver, typeRoot);
    const directoryExists = receiver!.resolver!.host.FS().DirectoryExists(typeRoot);
    if (!directoryExists) {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, typeRoot);
      }
      continue;
    }
    const resolvedFromFile = resolutionState_loadModuleFromFile(receiver, extensionsDeclaration, candidate);
    if (!resolved_shouldContinueSearching(resolvedFromFile)) {
      const packageDirectory = ParseNodeModuleFromPath(resolvedFromFile!.path, false);
      if (packageDirectory !== "") {
        resolvedFromFile!.packageId = resolutionState_getPackageId(receiver, resolvedFromFile!.path, resolutionState_getPackageJsonInfo(receiver, packageDirectory));
      }
      return resolvedFromFile;
    }
    const resolved = resolutionState_loadNodeModuleFromDirectory(receiver, extensionsDeclaration, candidate, true);
    if (!resolved_shouldContinueSearching(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getPackageScopeForPath","kind":"method","status":"implemented","sigHash":"91e8e3a933862d0d276b0e1d2c3ea27d3c13e1f5facac7fd660820eb72e6c1ad","bodyHash":"bef785859c26c3504facab3bc5a273b8fc94c2b29373c1638bcc21ca0816ae91"}
 *
 * Go source:
 * func (r *resolutionState) getPackageScopeForPath(directory string) *packagejson.InfoCacheEntry {
 * 	result := tspath.ForEachAncestorDirectoryStoppingAtGlobalCache(
 * 		r.resolver.typingsLocation,
 * 		directory,
 * 		func(directory string) (*packagejson.InfoCacheEntry, bool) {
 * 			if result := r.getPackageJsonInfo(directory); result != nil {
 * 				return result, true
 * 			}
 * 			return nil, false
 * 		},
 * 	)
 * 	return result
 * }
 */
export function resolutionState_getPackageScopeForPath(receiver: GoPtr<resolutionState>, directory: string): GoPtr<InfoCacheEntry> {
  const result = tspath.ForEachAncestorDirectoryStoppingAtGlobalCache(
    receiver!.resolver!.typingsLocation,
    directory,
    (dir: string): [GoPtr<InfoCacheEntry>, bool] => {
      const r = resolutionState_getPackageJsonInfo(receiver, dir);
      if (r !== undefined) {
        return [r, true];
      }
      return [undefined, false];
    },
  );
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.resolveNodeLike","kind":"method","status":"implemented","sigHash":"fe9b6240bbd4e1e1f67b9769424e0009c39b69160df512a8945023a2d46995ff","bodyHash":"be1f1401eb23aa5a5e097b061e8099d71b4824c267fba1955ba80da7575d9ef6"}
 *
 * Go source:
 * func (r *resolutionState) resolveNodeLike() *ResolvedModule {
 * 	if r.tracer != nil {
 * 		conditions := strings.Join(core.Map(r.conditions, func(c string) string { return `'` + c + `'` }), ", ")
 * 		if r.esmMode {
 * 			r.tracer.write(diagnostics.Resolving_in_0_mode_with_conditions_1, "ESM", conditions)
 * 		} else {
 * 			r.tracer.write(diagnostics.Resolving_in_0_mode_with_conditions_1, "CJS", conditions)
 * 		}
 * 	}
 * 	result := r.resolveNodeLikeWorker()
 * 	if r.resolvedPackageDirectory &&
 * 		!r.isConfigLookup &&
 * 		r.features&NodeResolutionFeaturesExports != 0 &&
 * 		r.extensions&(extensionsTypeScript|extensionsDeclaration) != 0 &&
 * 		!tspath.IsExternalModuleNameRelative(r.name) &&
 * 		result.IsResolved() &&
 * 		result.IsExternalLibraryImport &&
 * 		!extensionIsOk(extensionsTypeScript|extensionsDeclaration, result.Extension) &&
 * 		slices.Contains(r.conditions, "import") {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Resolution_of_non_relative_name_failed_trying_with_modern_Node_resolution_features_disabled_to_see_if_npm_library_needs_configuration_update)
 * 		}
 * 		r.features = r.features & ^NodeResolutionFeaturesExports
 * 		r.extensions = r.extensions & (extensionsTypeScript | extensionsDeclaration)
 * 		diagnosticsCount := len(r.diagnostics)
 * 		if diagnosticResult := r.resolveNodeLikeWorker(); diagnosticResult.IsResolved() && diagnosticResult.IsExternalLibraryImport {
 * 			result.AlternateResult = diagnosticResult.ResolvedFileName
 * 		}
 * 		r.diagnostics = r.diagnostics[:diagnosticsCount]
 * 	}
 * 	return result
 * }
 */
export function resolutionState_resolveNodeLike(receiver: GoPtr<resolutionState>): GoPtr<ResolvedModule> {
  if (receiver!.tracer !== undefined) {
    const conditions = strings.Join(core.Map(receiver!.conditions, (c: string): string => `'${c}'`), ", ");
    if (receiver!.esmMode) {
      tracer_write(receiver!.tracer, diagnostics.Resolving_in_0_mode_with_conditions_1, "ESM", conditions);
    } else {
      tracer_write(receiver!.tracer, diagnostics.Resolving_in_0_mode_with_conditions_1, "CJS", conditions);
    }
  }
  const result = resolutionState_resolveNodeLikeWorker(receiver);
  if (
    receiver!.resolvedPackageDirectory &&
    !receiver!.isConfigLookup &&
    (receiver!.features & NodeResolutionFeaturesExports) !== 0 &&
    (receiver!.extensions & (extensionsTypeScript | extensionsDeclaration)) !== 0 &&
    !tspath.IsExternalModuleNameRelative(receiver!.name) &&
    ResolvedModule_IsResolved(result) &&
    result!.IsExternalLibraryImport &&
    !extensionIsOk(extensionsTypeScript | extensionsDeclaration, result!.Extension) &&
    slices.Contains(receiver!.conditions, "import")
  ) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Resolution_of_non_relative_name_failed_trying_with_modern_Node_resolution_features_disabled_to_see_if_npm_library_needs_configuration_update);
    }
    receiver!.features = receiver!.features & ~NodeResolutionFeaturesExports;
    receiver!.extensions = receiver!.extensions & (extensionsTypeScript | extensionsDeclaration);
    const diagnosticsCount = receiver!.diagnostics.length;
    const diagnosticResult = resolutionState_resolveNodeLikeWorker(receiver);
    if (ResolvedModule_IsResolved(diagnosticResult) && diagnosticResult!.IsExternalLibraryImport) {
      result!.AlternateResult = diagnosticResult!.ResolvedFileName;
    }
    receiver!.diagnostics = receiver!.diagnostics.slice(0, diagnosticsCount);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.resolveNodeLikeWorker","kind":"method","status":"implemented","sigHash":"c8aef49f1d380b4adc1b0782cc3d23d1af4b90b87a5c7436e1612f24844cdd58","bodyHash":"03980ae2e9b9a8bad50d55cae1d4dcc3780ab5b1b3e3765dfce3f3e344a3c45c"}
 *
 * Go source:
 * func (r *resolutionState) resolveNodeLikeWorker() *ResolvedModule {
 * 	if resolved := r.tryLoadModuleUsingOptionalResolutionSettings(); !resolved.shouldContinueSearching() {
 * 		return r.createResolvedModuleHandlingSymlink(resolved)
 * 	}
 * 
 * 	if !tspath.IsExternalModuleNameRelative(r.name) {
 * 		if r.features&NodeResolutionFeaturesImports != 0 && strings.HasPrefix(r.name, "#") {
 * 			if resolved := r.loadModuleFromImports(); !resolved.shouldContinueSearching() {
 * 				return r.createResolvedModuleHandlingSymlink(resolved)
 * 			}
 * 		}
 * 		if r.features&NodeResolutionFeaturesSelfName != 0 {
 * 			if resolved := r.loadModuleFromSelfNameReference(); !resolved.shouldContinueSearching() {
 * 				return r.createResolvedModuleHandlingSymlink(resolved)
 * 			}
 * 		}
 * 		if strings.Contains(r.name, ":") {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Skipping_module_0_that_looks_like_an_absolute_URI_target_file_types_Colon_1, r.name, r.extensions.String())
 * 			}
 * 			return r.createResolvedModule(nil, false)
 * 		}
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Loading_module_0_from_node_modules_folder_target_file_types_Colon_1, r.name, r.extensions.String())
 * 		}
 * 		if resolved := r.loadModuleFromNearestNodeModulesDirectory(false /*typesScopeOnly* /); !resolved.shouldContinueSearching() {
 * 			return r.createResolvedModuleHandlingSymlink(resolved)
 * 		}
 * 		if r.extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.resolveFromTypeRoot(); !resolved.shouldContinueSearching() {
 * 				return r.createResolvedModuleHandlingSymlink(resolved)
 * 			}
 * 		}
 * 	} else {
 * 		candidate := normalizePathForCJSResolution(r.containingDirectory, r.name)
 * 		resolved := r.nodeLoadModuleByRelativeName(r.extensions, candidate, true)
 * 		return r.createResolvedModule(
 * 			resolved,
 * 			resolved != nil && strings.Contains(resolved.path, "/node_modules/"),
 * 		)
 * 	}
 * 	return r.createResolvedModule(nil, false)
 * }
 */
export function resolutionState_resolveNodeLikeWorker(receiver: GoPtr<resolutionState>): GoPtr<ResolvedModule> {
  const optionalResult = resolutionState_tryLoadModuleUsingOptionalResolutionSettings(receiver);
  if (!resolved_shouldContinueSearching(optionalResult)) {
    return resolutionState_createResolvedModuleHandlingSymlink(receiver, optionalResult);
  }
  if (!tspath.IsExternalModuleNameRelative(receiver!.name)) {
    if ((receiver!.features & NodeResolutionFeaturesImports) !== 0 && strings.HasPrefix(receiver!.name, "#")) {
      const importsResult = resolutionState_loadModuleFromImports(receiver);
      if (!resolved_shouldContinueSearching(importsResult)) {
        return resolutionState_createResolvedModuleHandlingSymlink(receiver, importsResult);
      }
    }
    if ((receiver!.features & NodeResolutionFeaturesSelfName) !== 0) {
      const selfNameResult = resolutionState_loadModuleFromSelfNameReference(receiver);
      if (!resolved_shouldContinueSearching(selfNameResult)) {
        return resolutionState_createResolvedModuleHandlingSymlink(receiver, selfNameResult);
      }
    }
    if (strings.Contains(receiver!.name, ":")) {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Skipping_module_0_that_looks_like_an_absolute_URI_target_file_types_Colon_1, receiver!.name, extensions_String(receiver!.extensions));
      }
      return resolutionState_createResolvedModule(receiver, undefined, false);
    }
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Loading_module_0_from_node_modules_folder_target_file_types_Colon_1, receiver!.name, extensions_String(receiver!.extensions));
    }
    const nodeModulesResult = resolutionState_loadModuleFromNearestNodeModulesDirectory(receiver, false);
    if (!resolved_shouldContinueSearching(nodeModulesResult)) {
      return resolutionState_createResolvedModuleHandlingSymlink(receiver, nodeModulesResult);
    }
    if ((receiver!.extensions & extensionsDeclaration) !== 0) {
      const typeRootResult = resolutionState_resolveFromTypeRoot(receiver);
      if (!resolved_shouldContinueSearching(typeRootResult)) {
        return resolutionState_createResolvedModuleHandlingSymlink(receiver, typeRootResult);
      }
    }
  } else {
    const candidate = normalizePathForCJSResolution(receiver!.containingDirectory, receiver!.name);
    const resolved2 = resolutionState_nodeLoadModuleByRelativeName(receiver, receiver!.extensions, candidate, true);
    return resolutionState_createResolvedModule(
      receiver,
      resolved2,
      resolved2 !== undefined && strings.Contains(resolved2.path, "/node_modules/"),
    );
  }
  return resolutionState_createResolvedModule(receiver, undefined, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromSelfNameReference","kind":"method","status":"implemented","sigHash":"188a9610b1a310482b9d1ab117e3426ee944190be2819ea048f884bd5051e616","bodyHash":"69bbd33610288094095671bad999c11e93845fd3459290199a8e3e50dc6bbec5"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromSelfNameReference() *resolved {
 * 	directoryPath := tspath.GetNormalizedAbsolutePath(r.containingDirectory, r.resolver.host.GetCurrentDirectory())
 * 	scope := r.getPackageScopeForPath(directoryPath)
 * 	if !scope.Exists() || scope.Contents.Exports.IsFalsy() {
 * 		// !!! falsy check seems wrong?
 * 		return continueSearching()
 * 	}
 * 	name, ok := scope.Contents.Name.GetValue()
 * 	if !ok {
 * 		return continueSearching()
 * 	}
 * 	parts := tspath.GetPathComponents(r.name, "")
 * 	nameParts := tspath.GetPathComponents(name, "")
 * 	if len(parts) < len(nameParts) || !slices.Equal(nameParts, parts[:len(nameParts)]) {
 * 		return continueSearching()
 * 	}
 * 	trailingParts := parts[len(nameParts):]
 * 	var subpath string
 * 	if len(trailingParts) > 0 {
 * 		subpath = tspath.CombinePaths(".", trailingParts...)
 * 	} else {
 * 		subpath = "."
 * 	}
 * 	// Maybe TODO: splitting extensions into two priorities should be unnecessary, except
 * 	// https://github.com/microsoft/TypeScript/issues/50762 makes the behavior different.
 * 	// As long as that bug exists, we need to do two passes here in self-name loading
 * 	// in order to be consistent with (non-self) library-name loading in
 * 	// `loadModuleFromNearestNodeModulesDirectoryWorker`, which uses two passes in order
 * 	// to prioritize `@types` packages higher up the directory tree over untyped
 * 	// implementation packages. See the selfNameModuleAugmentation.ts test for why this
 * 	// matters.
 * 	//
 * 	// However, there's an exception. If the user has `allowJs` and `declaration`, we need
 * 	// to ensure that self-name imports of their own package can resolve back to their
 * 	// input JS files via `tryLoadInputFileForPath` at a higher priority than their output
 * 	// declaration files, so we need to do a single pass with all extensions for that case.
 * 	if r.compilerOptions.GetAllowJS() && !strings.Contains(r.containingDirectory, "/node_modules/") {
 * 		return r.loadModuleFromExports(scope, r.extensions, subpath)
 * 	}
 * 	priorityExtensions := r.extensions & (extensionsTypeScript | extensionsDeclaration)
 * 	secondaryExtensions := r.extensions & ^(extensionsTypeScript | extensionsDeclaration)
 * 	if resolved := r.loadModuleFromExports(scope, priorityExtensions, subpath); !resolved.shouldContinueSearching() {
 * 		return resolved
 * 	}
 * 	return r.loadModuleFromExports(scope, secondaryExtensions, subpath)
 * }
 */
export function resolutionState_loadModuleFromSelfNameReference(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  const directoryPath = tspath.GetNormalizedAbsolutePath(receiver!.containingDirectory, receiver!.resolver!.host.GetCurrentDirectory());
  const scope = resolutionState_getPackageScopeForPath(receiver, directoryPath);
  if (!InfoCacheEntry_Exists(scope) || JSONValue_IsFalsy(packageJsonExports(scope!.Contents).__tsgoEmbedded0)) {
    return continueSearching();
  }
  const [name, nameOk] = Expected_GetValue<string>(packageJsonHeaderStringField(scope!.Contents, "Name"));
  if (!nameOk) {
    return continueSearching();
  }
  const parts = tspath.GetPathComponents(receiver!.name, "");
  const nameParts = tspath.GetPathComponents(name, "");
  if (parts.length < nameParts.length || !slices.Equal(nameParts, parts.slice(0, nameParts.length))) {
    return continueSearching();
  }
  const trailingParts = parts.slice(nameParts.length);
  let subpath: string;
  if (trailingParts.length > 0) {
    subpath = tspath.CombinePaths(".", ...trailingParts);
  } else {
    subpath = ".";
  }
  if (CompilerOptions_GetAllowJS(receiver!.compilerOptions) && !strings.Contains(receiver!.containingDirectory, "/node_modules/")) {
    return resolutionState_loadModuleFromExports(receiver, scope, receiver!.extensions, subpath);
  }
  const priorityExtensions = receiver!.extensions & (extensionsTypeScript | extensionsDeclaration);
  const secondaryExtensions = receiver!.extensions & ~(extensionsTypeScript | extensionsDeclaration);
  const priorityResult = resolutionState_loadModuleFromExports(receiver, scope, priorityExtensions, subpath);
  if (!resolved_shouldContinueSearching(priorityResult)) {
    return priorityResult;
  }
  return resolutionState_loadModuleFromExports(receiver, scope, secondaryExtensions, subpath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromImports","kind":"method","status":"implemented","sigHash":"17ac09e020bac151d130788e789de4468b8ff3691c05e87237d52738675e6572","bodyHash":"4019d5c23487e4166d983b4a7dab579caf040108e8575a99fd456fe2d97f8fbd"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromImports() *resolved {
 * 	if r.name == "#" || (strings.HasPrefix(r.name, "#/") && (r.features&NodeResolutionFeaturesImportsPatternRoot) == 0) {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Invalid_import_specifier_0_has_no_possible_resolutions, r.name)
 * 		}
 * 		return continueSearching()
 * 	}
 * 	directoryPath := tspath.GetNormalizedAbsolutePath(r.containingDirectory, r.resolver.host.GetCurrentDirectory())
 * 	scope := r.getPackageScopeForPath(directoryPath)
 * 	if !scope.Exists() {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Directory_0_has_no_containing_package_json_scope_Imports_will_not_resolve, directoryPath)
 * 		}
 * 		return continueSearching()
 * 	}
 * 	if scope.Contents.Imports.Type != packagejson.JSONValueTypeObject {
 * 		// !!! Old compiler only checks for undefined, but then assumes `imports` is an object if present.
 * 		// Maybe should have a new diagnostic for imports of an invalid type. Also, array should be handled?
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.X_package_json_scope_0_has_no_imports_defined, scope.PackageDirectory)
 * 		}
 * 		return continueSearching()
 * 	}
 * 
 * 	if result := r.loadModuleFromExportsOrImports(r.extensions, r.name, scope.Contents.Imports.AsObject(), scope /*isImports* /, true); !result.shouldContinueSearching() {
 * 		return result
 * 	}
 * 
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Import_specifier_0_does_not_exist_in_package_json_scope_at_path_1, r.name, scope.PackageDirectory)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromImports(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  if (receiver!.name === "#" || (strings.HasPrefix(receiver!.name, "#/") && (receiver!.features & NodeResolutionFeaturesImportsPatternRoot) === 0)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Invalid_import_specifier_0_has_no_possible_resolutions, receiver!.name);
    }
    return continueSearching();
  }
  const directoryPath = tspath.GetNormalizedAbsolutePath(receiver!.containingDirectory, receiver!.resolver!.host.GetCurrentDirectory());
  const scope = resolutionState_getPackageScopeForPath(receiver, directoryPath);
  if (!InfoCacheEntry_Exists(scope)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Directory_0_has_no_containing_package_json_scope_Imports_will_not_resolve, directoryPath);
    }
    return continueSearching();
  }
  const scopeImports = packageJsonImports(scope!.Contents);
  if (scopeImports.__tsgoEmbedded0!.Type !== JSONValueTypeObject) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_no_imports_defined, scope!.PackageDirectory);
    }
    return continueSearching();
  }
  const result = resolutionState_loadModuleFromExportsOrImports(receiver, receiver!.extensions, receiver!.name, ExportsOrImports_AsObject(scopeImports), scope, true);
  if (!resolved_shouldContinueSearching(result)) {
    return result;
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Import_specifier_0_does_not_exist_in_package_json_scope_at_path_1, receiver!.name, scope!.PackageDirectory);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromExports","kind":"method","status":"implemented","sigHash":"e23471c1418bec8f0f763a7f543f27fe15610eb7c42c15f0bc2860e8e9048bea","bodyHash":"ba692f0961e4d3871d3c2dc7226ca548506a19b573913ecf946ee798147d6fc4"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromExports(packageInfo *packagejson.InfoCacheEntry, ext extensions, subpath string) *resolved {
 * 	// !!! This is ported exactly, but the falsy check seems wrong
 * 	if !packageInfo.Exists() || packageInfo.Contents.Exports.IsFalsy() {
 * 		return continueSearching()
 * 	}
 * 
 * 	if subpath == "." {
 * 		var mainExport packagejson.ExportsOrImports
 * 		switch packageInfo.Contents.Exports.Type {
 * 		case packagejson.JSONValueTypeString, packagejson.JSONValueTypeArray:
 * 			mainExport = packageInfo.Contents.Exports
 * 		case packagejson.JSONValueTypeObject:
 * 			if packageInfo.Contents.Exports.IsConditions() {
 * 				mainExport = packageInfo.Contents.Exports
 * 			} else if dot, ok := packageInfo.Contents.Exports.AsObject().Get("."); ok {
 * 				mainExport = dot
 * 			}
 * 		}
 * 		if mainExport.Type != packagejson.JSONValueTypeNotPresent {
 * 			return r.loadModuleFromTargetExportOrImport(ext, subpath, packageInfo, false /*isImports* /, mainExport, "", false /*isPattern* /, ".")
 * 		}
 * 	} else if packageInfo.Contents.Exports.Type == packagejson.JSONValueTypeObject && packageInfo.Contents.Exports.IsSubpaths() {
 * 		if result := r.loadModuleFromExportsOrImports(ext, subpath, packageInfo.Contents.Exports.AsObject(), packageInfo, false /*isImports* /); !result.shouldContinueSearching() {
 * 			return result
 * 		}
 * 	}
 * 
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Export_specifier_0_does_not_exist_in_package_json_scope_at_path_1, subpath, packageInfo.PackageDirectory)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromExports(receiver: GoPtr<resolutionState>, packageInfo: GoPtr<InfoCacheEntry>, ext: extensions, subpath: string): GoPtr<resolved> {
  const packageExports = packageJsonExports(packageInfo?.Contents);
  if (!InfoCacheEntry_Exists(packageInfo) || JSONValue_IsFalsy(packageExports.__tsgoEmbedded0)) {
    return continueSearching();
  }
  const exportsType = packageExports.__tsgoEmbedded0!.Type;
  if (subpath === ".") {
    let mainExport: ExportsOrImports | undefined;
    if (exportsType === JSONValueTypeString || exportsType === JSONValueTypeArray) {
      mainExport = packageExports;
    } else if (exportsType === JSONValueTypeObject) {
      if (ExportsOrImports_IsConditions(packageExports)) {
        mainExport = packageExports;
      } else {
        const [dotEntry, dotOk] = OrderedMap_Get<string, ExportsOrImports>(ExportsOrImports_AsObject(packageExports) as GoPtr<OrderedMap<string, ExportsOrImports>>, ".");
        if (dotOk) {
          mainExport = dotEntry;
        }
      }
    }
    if (mainExport !== undefined && mainExport.__tsgoEmbedded0!.Type !== JSONValueTypeNotPresent) {
      return resolutionState_loadModuleFromTargetExportOrImport(receiver, ext, subpath, packageInfo, false, mainExport, "", false, ".");
    }
  } else if (exportsType === JSONValueTypeObject && ExportsOrImports_IsSubpaths(packageExports)) {
    const result = resolutionState_loadModuleFromExportsOrImports(receiver, ext, subpath, ExportsOrImports_AsObject(packageExports) as GoPtr<OrderedMap<string, ExportsOrImports>>, packageInfo, false);
    if (!resolved_shouldContinueSearching(result)) {
      return result;
    }
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Export_specifier_0_does_not_exist_in_package_json_scope_at_path_1, subpath, packageInfo!.PackageDirectory);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromExportsOrImports","kind":"method","status":"implemented","sigHash":"d93978b9d511c39b417784fa90b6568cbfcd76b4b2279190ce3064ba32eb00ad","bodyHash":"c838f27dc5304324c583bcb9e91ea2a45758e0f1b868d6a979658bacacc24744"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromExportsOrImports(
 * 	extensions extensions,
 * 	moduleName string,
 * 	lookupTable *collections.OrderedMap[string, packagejson.ExportsOrImports],
 * 	scope *packagejson.InfoCacheEntry,
 * 	isImports bool,
 * ) *resolved {
 * 	if !strings.HasSuffix(moduleName, "/") && !strings.Contains(moduleName, "*") {
 * 		if target, ok := lookupTable.Get(moduleName); ok {
 * 			return r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, target, "", false /*isPattern* /, moduleName)
 * 		}
 * 	}
 * 
 * 	expandingKeys := make([]string, 0, lookupTable.Size())
 * 	for key := range lookupTable.Keys() {
 * 		if strings.Count(key, "*") == 1 || strings.HasSuffix(key, "/") {
 * 			expandingKeys = append(expandingKeys, key)
 * 		}
 * 	}
 * 	slices.SortFunc(expandingKeys, ComparePatternKeys)
 * 
 * 	for _, potentialTarget := range expandingKeys {
 * 		if r.features&NodeResolutionFeaturesExportsPatternTrailers != 0 && matchesPatternWithTrailer(potentialTarget, moduleName) {
 * 			target, _ := lookupTable.Get(potentialTarget)
 * 			starPos := strings.Index(potentialTarget, "*")
 * 			subpath := moduleName[len(potentialTarget[:starPos]) : len(moduleName)-(len(potentialTarget)-1-starPos)]
 * 			return r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, target, subpath, true, potentialTarget)
 * 		} else if strings.HasSuffix(potentialTarget, "*") && strings.HasPrefix(moduleName, potentialTarget[:len(potentialTarget)-1]) {
 * 			target, _ := lookupTable.Get(potentialTarget)
 * 			subpath := moduleName[len(potentialTarget)-1:]
 * 			return r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, target, subpath, true, potentialTarget)
 * 		} else if strings.HasPrefix(moduleName, potentialTarget) {
 * 			target, _ := lookupTable.Get(potentialTarget)
 * 			subpath := moduleName[len(potentialTarget):]
 * 			return r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, target, subpath, false, potentialTarget)
 * 		}
 * 	}
 * 
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromExportsOrImports(receiver: GoPtr<resolutionState>, extensions: extensions, moduleName: string, lookupTableRaw: GoPtr<OrderedMap>, scope: GoPtr<InfoCacheEntry>, isImports: bool): GoPtr<resolved> {
  const lookupTable = lookupTableRaw as GoPtr<OrderedMap<string, ExportsOrImports>>;
  if (!strings.HasSuffix(moduleName, "/") && !strings.Contains(moduleName, "*")) {
    const [target, targetOk] = OrderedMap_Get<string, ExportsOrImports>(lookupTable, moduleName);
    if (targetOk) {
      return resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, target, "", false, moduleName);
    }
  }
  const expandingKeys: string[] = [];
  OrderedMap_Keys<string, ExportsOrImports>(lookupTable)((key: string): bool => {
    if (strings.Count(key, "*") === 1 || strings.HasSuffix(key, "/")) {
      expandingKeys.push(key);
    }
    return true;
  });
  slices.SortFunc(expandingKeys, ComparePatternKeys);
  for (const potentialTarget of expandingKeys) {
    if ((receiver!.features & NodeResolutionFeaturesExportsPatternTrailers) !== 0 && matchesPatternWithTrailer(potentialTarget, moduleName)) {
      const [target2] = OrderedMap_Get<string, ExportsOrImports>(lookupTable, potentialTarget);
      const starPos = potentialTarget.indexOf("*");
      const subpath = moduleName.slice(potentialTarget.slice(0, starPos).length, moduleName.length - (potentialTarget.length - 1 - starPos));
      return resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, target2, subpath, true, potentialTarget);
    } else if (strings.HasSuffix(potentialTarget, "*") && strings.HasPrefix(moduleName, potentialTarget.slice(0, potentialTarget.length - 1))) {
      const [target3] = OrderedMap_Get<string, ExportsOrImports>(lookupTable, potentialTarget);
      const subpath2 = moduleName.slice(potentialTarget.length - 1);
      return resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, target3, subpath2, true, potentialTarget);
    } else if (strings.HasPrefix(moduleName, potentialTarget)) {
      const [target4] = OrderedMap_Get<string, ExportsOrImports>(lookupTable, potentialTarget);
      const subpath3 = moduleName.slice(potentialTarget.length);
      return resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, target4, subpath3, false, potentialTarget);
    }
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromTargetExportOrImport","kind":"method","status":"implemented","sigHash":"413ae5859495cffad62658f7683190909561bda495e132912d2228fc36265013","bodyHash":"91b20f754755ccca22028049eac2c0b336cbb6a991f34cd9fd3447487821eb04"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromTargetExportOrImport(extensions extensions, moduleName string, scope *packagejson.InfoCacheEntry, isImports bool, target packagejson.ExportsOrImports, subpath string, isPattern bool, key string) *resolved {
 * 	switch target.Type {
 * 	case packagejson.JSONValueTypeString:
 * 		targetString, _ := target.Value.(string)
 * 		if !isPattern && len(subpath) > 0 && !strings.HasSuffix(targetString, "/") {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		if !strings.HasPrefix(targetString, "./") {
 * 			if isImports && !strings.HasPrefix(targetString, "../") && !strings.HasPrefix(targetString, "/") && !tspath.IsRootedDiskPath(targetString) {
 * 				combinedLookup := targetString + subpath
 * 				if isPattern {
 * 					combinedLookup = strings.ReplaceAll(targetString, "*", subpath)
 * 				}
 * 				scopeContainingDirectory := tspath.EnsureTrailingDirectorySeparator(scope.PackageDirectory)
 * 				if r.tracer != nil {
 * 					r.tracer.write(diagnostics.Using_0_subpath_1_with_target_2, "imports", key, combinedLookup)
 * 					r.tracer.write(diagnostics.Resolving_module_0_from_1, combinedLookup, scopeContainingDirectory)
 * 				}
 * 				name, containingDirectory := r.name, r.containingDirectory
 * 				r.name, r.containingDirectory = combinedLookup, scopeContainingDirectory
 * 				defer func() {
 * 					r.name, r.containingDirectory = name, containingDirectory
 * 				}()
 * 				if result := r.resolveNodeLike(); result.IsResolved() {
 * 					return &resolved{
 * 						path:                     result.ResolvedFileName,
 * 						extension:                result.Extension,
 * 						packageId:                result.PackageId,
 * 						originalPath:             result.OriginalPath,
 * 						resolvedUsingTsExtension: result.ResolvedUsingTsExtension,
 * 					}
 * 				}
 * 				return continueSearching()
 * 			}
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		var parts []string
 * 		if tspath.PathIsRelative(targetString) {
 * 			parts = tspath.GetPathComponents(targetString, "")[1:]
 * 		} else {
 * 			parts = tspath.GetPathComponents(targetString, "")
 * 		}
 * 		partsAfterFirst := parts[1:]
 * 		if slices.Contains(partsAfterFirst, "..") || slices.Contains(partsAfterFirst, ".") || slices.Contains(partsAfterFirst, "node_modules") {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		resolvedTarget := tspath.CombinePaths(scope.PackageDirectory, targetString)
 * 		// TODO: Assert that `resolvedTarget` is actually within the package directory? That's what the spec says.... but I'm not sure we need
 * 		// to be in the business of validating everyone's import and export map correctness.
 * 		subpathParts := tspath.GetPathComponents(subpath, "")
 * 		if slices.Contains(subpathParts, "..") || slices.Contains(subpathParts, ".") || slices.Contains(subpathParts, "node_modules") {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 			}
 * 			return continueSearching()
 * 		}
 * 
 * 		if r.tracer != nil {
 * 			var messageTarget string
 * 			if isPattern {
 * 				messageTarget = strings.ReplaceAll(targetString, "*", subpath)
 * 			} else {
 * 				messageTarget = targetString + subpath
 * 			}
 * 			r.tracer.write(diagnostics.Using_0_subpath_1_with_target_2, core.IfElse(isImports, "imports", "exports"), key, messageTarget)
 * 		}
 * 		var finalPath string
 * 		if isPattern {
 * 			finalPath = tspath.GetNormalizedAbsolutePath(strings.ReplaceAll(resolvedTarget, "*", subpath), r.resolver.host.GetCurrentDirectory())
 * 		} else {
 * 			finalPath = tspath.GetNormalizedAbsolutePath(resolvedTarget+subpath, r.resolver.host.GetCurrentDirectory())
 * 		}
 * 		if inputLink := r.tryLoadInputFileForPath(finalPath, subpath, tspath.CombinePaths(scope.PackageDirectory, "package.json"), isImports); !inputLink.shouldContinueSearching() {
 * 			inputLink.packageId = r.getPackageId(inputLink.path, scope)
 * 			return inputLink
 * 		}
 * 		if result := r.loadFileNameFromPackageJSONField(extensions, finalPath, targetString); !result.shouldContinueSearching() {
 * 			result.packageId = r.getPackageId(result.path, scope)
 * 			return result
 * 		}
 * 		return continueSearching()
 * 
 * 	case packagejson.JSONValueTypeObject:
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Entering_conditional_exports)
 * 		}
 * 		for condition := range target.AsObject().Keys() {
 * 			if r.conditionMatches(condition) {
 * 				if r.tracer != nil {
 * 					r.tracer.write(diagnostics.Matched_0_condition_1, core.IfElse(isImports, "imports", "exports"), condition)
 * 				}
 * 				subTarget, _ := target.AsObject().Get(condition)
 * 				if result := r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, subTarget, subpath, isPattern, key); !result.shouldContinueSearching() {
 * 					if result.isResolved() && r.tracer != nil {
 * 						r.tracer.write(diagnostics.Resolved_under_condition_0, condition)
 * 					}
 * 					if r.tracer != nil {
 * 						r.tracer.write(diagnostics.Exiting_conditional_exports)
 * 					}
 * 					return result
 * 				} else if r.tracer != nil {
 * 					r.tracer.write(diagnostics.Failed_to_resolve_under_condition_0, condition)
 * 				}
 * 			} else {
 * 				if r.tracer != nil {
 * 					r.tracer.write(diagnostics.Saw_non_matching_condition_0, condition)
 * 				}
 * 			}
 * 		}
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Exiting_conditional_exports)
 * 		}
 * 		return continueSearching()
 * 	case packagejson.JSONValueTypeArray:
 * 		if len(target.AsArray()) == 0 {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		for _, elem := range target.AsArray() {
 * 			if result := r.loadModuleFromTargetExportOrImport(extensions, moduleName, scope, isImports, elem, subpath, isPattern, key); !result.shouldContinueSearching() {
 * 				return result
 * 			}
 * 		}
 * 
 * 	case packagejson.JSONValueTypeNull:
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.X_package_json_scope_0_explicitly_maps_specifier_1_to_null, scope.PackageDirectory, moduleName)
 * 		}
 * 		return unresolved()
 * 	}
 * 
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope.PackageDirectory, moduleName)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromTargetExportOrImport(receiver: GoPtr<resolutionState>, extensions: extensions, moduleName: string, scope: GoPtr<InfoCacheEntry>, isImports: bool, target: ExportsOrImports, subpath: string, isPattern: bool, key: string): GoPtr<resolved> {
  const targetType = target.__tsgoEmbedded0!.Type;
  switch (targetType) {
    case JSONValueTypeString: {
      const targetString = target.__tsgoEmbedded0!.Value as string;
      if (!isPattern && subpath.length > 0 && !strings.HasSuffix(targetString, "/")) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
        }
        return continueSearching();
      }
      if (!strings.HasPrefix(targetString, "./")) {
        if (isImports && !strings.HasPrefix(targetString, "../") && !strings.HasPrefix(targetString, "/") && !tspath.IsRootedDiskPath(targetString)) {
          let combinedLookup = targetString + subpath;
          if (isPattern) {
            combinedLookup = strings.ReplaceAll(targetString, "*", subpath);
          }
          const scopeContainingDirectory = tspath.EnsureTrailingDirectorySeparator(scope!.PackageDirectory);
          if (receiver!.tracer !== undefined) {
            tracer_write(receiver!.tracer, diagnostics.Using_0_subpath_1_with_target_2, "imports", key, combinedLookup);
            tracer_write(receiver!.tracer, diagnostics.Resolving_module_0_from_1, combinedLookup, scopeContainingDirectory);
          }
          const savedName = receiver!.name;
          const savedContainingDirectory = receiver!.containingDirectory;
          receiver!.name = combinedLookup;
          receiver!.containingDirectory = scopeContainingDirectory;
          const innerResult = resolutionState_resolveNodeLike(receiver);
          receiver!.name = savedName;
          receiver!.containingDirectory = savedContainingDirectory;
          if (ResolvedModule_IsResolved(innerResult)) {
            return {
              path: innerResult!.ResolvedFileName,
              extension: innerResult!.Extension,
              packageId: innerResult!.PackageId,
              originalPath: innerResult!.OriginalPath,
              resolvedUsingTsExtension: innerResult!.ResolvedUsingTsExtension,
            };
          }
          return continueSearching();
        }
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
        }
        return continueSearching();
      }
      let parts: string[];
      if (tspath.PathIsRelative(targetString)) {
        parts = tspath.GetPathComponents(targetString, "").slice(1);
      } else {
        parts = tspath.GetPathComponents(targetString, "");
      }
      const partsAfterFirst = parts.slice(1);
      if (slices.Contains(partsAfterFirst, "..") || slices.Contains(partsAfterFirst, ".") || slices.Contains(partsAfterFirst, "node_modules")) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
        }
        return continueSearching();
      }
      const resolvedTarget = tspath.CombinePaths(scope!.PackageDirectory, targetString);
      const subpathParts = tspath.GetPathComponents(subpath, "");
      if (slices.Contains(subpathParts, "..") || slices.Contains(subpathParts, ".") || slices.Contains(subpathParts, "node_modules")) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
        }
        return continueSearching();
      }
      if (receiver!.tracer !== undefined) {
        let messageTarget: string;
        if (isPattern) {
          messageTarget = strings.ReplaceAll(targetString, "*", subpath);
        } else {
          messageTarget = targetString + subpath;
        }
        tracer_write(receiver!.tracer, diagnostics.Using_0_subpath_1_with_target_2, core.IfElse(isImports, "imports", "exports"), key, messageTarget);
      }
      let finalPath: string;
      if (isPattern) {
        finalPath = tspath.GetNormalizedAbsolutePath(strings.ReplaceAll(resolvedTarget, "*", subpath), receiver!.resolver!.host.GetCurrentDirectory());
      } else {
        finalPath = tspath.GetNormalizedAbsolutePath(resolvedTarget + subpath, receiver!.resolver!.host.GetCurrentDirectory());
      }
      const inputLink = resolutionState_tryLoadInputFileForPath(receiver, finalPath, subpath, tspath.CombinePaths(scope!.PackageDirectory, "package.json"), isImports);
      if (!resolved_shouldContinueSearching(inputLink)) {
        inputLink!.packageId = resolutionState_getPackageId(receiver, inputLink!.path, scope);
        return inputLink;
      }
      const fileNameResult = resolutionState_loadFileNameFromPackageJSONField(receiver, extensions, finalPath, targetString);
      if (!resolved_shouldContinueSearching(fileNameResult)) {
        fileNameResult!.packageId = resolutionState_getPackageId(receiver, fileNameResult!.path, scope);
        return fileNameResult;
      }
      return continueSearching();
    }
    case JSONValueTypeObject: {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Entering_conditional_exports);
      }
      let condResult: GoPtr<resolved> = undefined;
      let done = false;
      OrderedMap_Entries<string, ExportsOrImports>(ExportsOrImports_AsObject(target) as GoPtr<OrderedMap<string, ExportsOrImports>>)((condition: string, subTarget: ExportsOrImports): bool => {
        if (resolutionState_conditionMatches(receiver, condition)) {
          if (receiver!.tracer !== undefined) {
            tracer_write(receiver!.tracer, diagnostics.Matched_0_condition_1, core.IfElse(isImports, "imports", "exports"), condition);
          }
          const subResult = resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, subTarget, subpath, isPattern, key);
          if (!resolved_shouldContinueSearching(subResult)) {
            if (resolved_isResolved(subResult) && receiver!.tracer !== undefined) {
              tracer_write(receiver!.tracer, diagnostics.Resolved_under_condition_0, condition);
            }
            if (receiver!.tracer !== undefined) {
              tracer_write(receiver!.tracer, diagnostics.Exiting_conditional_exports);
            }
            condResult = subResult;
            done = true;
            return false;
          } else if (receiver!.tracer !== undefined) {
            tracer_write(receiver!.tracer, diagnostics.Failed_to_resolve_under_condition_0, condition);
          }
        } else {
          if (receiver!.tracer !== undefined) {
            tracer_write(receiver!.tracer, diagnostics.Saw_non_matching_condition_0, condition);
          }
        }
        return true;
      });
      if (done) {
        return condResult;
      }
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Exiting_conditional_exports);
      }
      return continueSearching();
    }
    case JSONValueTypeArray: {
      const arr = ExportsOrImports_AsArray(target);
      if (arr.length === 0) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
        }
        return continueSearching();
      }
      for (const elem of arr) {
        const elemResult = resolutionState_loadModuleFromTargetExportOrImport(receiver, extensions, moduleName, scope, isImports, elem, subpath, isPattern, key);
        if (!resolved_shouldContinueSearching(elemResult)) {
          return elemResult;
        }
      }
      break;
    }
    case JSONValueTypeNull: {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_explicitly_maps_specifier_1_to_null, scope!.PackageDirectory, moduleName);
      }
      return unresolved();
    }
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.X_package_json_scope_0_has_invalid_type_for_target_of_specifier_1, scope!.PackageDirectory, moduleName);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryLoadInputFileForPath","kind":"method","status":"implemented","sigHash":"73cc54880646df80cb71846074c51f8586d37214897e17b4a3bebf5fb82525bb","bodyHash":"0784025014f3c99d80902bd5b5556aa2aa8c885c735f71b05d8d6592884f8bf8"}
 *
 * Go source:
 * func (r *resolutionState) tryLoadInputFileForPath(finalPath string, entry string, packagePath string, isImports bool) *resolved {
 * 	// Replace any references to outputs for files in the program with the input files to support package self-names used with outDir
 * 	if !r.isConfigLookup &&
 * 		(r.compilerOptions.DeclarationDir != "" || r.compilerOptions.OutDir != "") &&
 * 		!strings.Contains(finalPath, "/node_modules/") &&
 * 		(r.compilerOptions.ConfigFilePath == "" || tspath.ContainsPath(
 * 			tspath.GetDirectoryPath(packagePath),
 * 			r.compilerOptions.ConfigFilePath,
 * 			tspath.ComparePathsOptions{
 * 				UseCaseSensitiveFileNames: r.resolver.host.FS().UseCaseSensitiveFileNames(),
 * 				CurrentDirectory:          r.resolver.host.GetCurrentDirectory(),
 * 			},
 * 		)) {
 * 
 * 		// Note: this differs from Strada's tryLoadInputFileForPath in that it
 * 		// does not attempt to perform "guesses", instead requring a clear root indicator.
 * 
 * 		var rootDir string
 * 		if r.compilerOptions.RootDir != "" {
 * 			// A `rootDir` compiler option strongly indicates the root location
 * 			rootDir = r.compilerOptions.RootDir
 * 		} else if r.compilerOptions.ConfigFilePath != "" {
 * 			// When no explicit rootDir is set, treat the config file's directory as the project root, which establishes the common source directory, so no other locations need to be checked.
 * 			rootDir = tspath.GetDirectoryPath(r.compilerOptions.ConfigFilePath)
 * 		} else {
 * 			diagnostic := ast.NewDiagnostic(
 * 				nil,
 * 				core.TextRange{},
 * 				core.IfElse(isImports,
 * 					diagnostics.The_project_root_is_ambiguous_but_is_required_to_resolve_import_map_entry_0_in_file_1_Supply_the_rootDir_compiler_option_to_disambiguate,
 * 					diagnostics.The_project_root_is_ambiguous_but_is_required_to_resolve_export_map_entry_0_in_file_1_Supply_the_rootDir_compiler_option_to_disambiguate,
 * 				),
 * 				core.IfElse(entry == "", ".", entry), // replace empty string with `.` - the reverse of the operation done when entries are built - so main entrypoint errors don't look weird
 * 				packagePath,
 * 			)
 * 			r.diagnostics = append(r.diagnostics, diagnostic)
 * 			return unresolved()
 * 		}
 * 
 * 		candidateDirectories := r.getOutputDirectoriesForBaseDirectory(rootDir)
 * 		for _, candidateDir := range candidateDirectories {
 * 			if tspath.ContainsPath(candidateDir, finalPath, tspath.ComparePathsOptions{
 * 				UseCaseSensitiveFileNames: r.resolver.host.FS().UseCaseSensitiveFileNames(),
 * 				CurrentDirectory:          r.resolver.host.GetCurrentDirectory(),
 * 			}) {
 * 				// The matched export is looking up something in either the out declaration or js dir, now map the written path back into the source dir and source extension
 * 				pathFragment := finalPath[len(candidateDir)+1:] // +1 to also remove directory separator
 * 				possibleInputBase := tspath.CombinePaths(rootDir, pathFragment)
 * 				jsAndDtsExtensions := []string{tspath.ExtensionMjs, tspath.ExtensionCjs, tspath.ExtensionJs, tspath.ExtensionJson, tspath.ExtensionDmts, tspath.ExtensionDcts, tspath.ExtensionDts}
 * 				for _, ext := range jsAndDtsExtensions {
 * 					if tspath.FileExtensionIs(possibleInputBase, ext) {
 * 						inputExts := tspath.GetPossibleOriginalInputExtensionForExtension(possibleInputBase)
 * 						for _, possibleExt := range inputExts {
 * 							if !extensionIsOk(r.extensions, possibleExt) {
 * 								continue
 * 							}
 * 							possibleInputWithInputExtension := tspath.ChangeExtension(possibleInputBase, possibleExt)
 * 							if r.resolver.host.FS().FileExists(possibleInputWithInputExtension) {
 * 								resolved := r.loadFileNameFromPackageJSONField(r.extensions, possibleInputWithInputExtension, "")
 * 								if !resolved.shouldContinueSearching() {
 * 									return resolved
 * 								}
 * 							}
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_tryLoadInputFileForPath(receiver: GoPtr<resolutionState>, finalPath: string, entry: string, packagePath: string, isImports: bool): GoPtr<resolved> {
  if (
    !receiver!.isConfigLookup &&
    (receiver!.compilerOptions!.DeclarationDir !== "" || receiver!.compilerOptions!.OutDir !== "") &&
    !strings.Contains(finalPath, "/node_modules/") &&
    (receiver!.compilerOptions!.ConfigFilePath === "" || tspath.ContainsPath(
      tspath.GetDirectoryPath(packagePath),
      receiver!.compilerOptions!.ConfigFilePath,
      {
        UseCaseSensitiveFileNames: receiver!.resolver!.host.FS().UseCaseSensitiveFileNames(),
        CurrentDirectory: receiver!.resolver!.host.GetCurrentDirectory(),
      },
    ))
  ) {
    let rootDir: string;
    if (receiver!.compilerOptions!.RootDir !== "") {
      rootDir = receiver!.compilerOptions!.RootDir;
    } else if (receiver!.compilerOptions!.ConfigFilePath !== "") {
      rootDir = tspath.GetDirectoryPath(receiver!.compilerOptions!.ConfigFilePath);
    } else {
      const diagnostic = NewDiagnostic(
        undefined,
        UndefinedTextRange(),
        core.IfElse(
          isImports,
          diagnostics.The_project_root_is_ambiguous_but_is_required_to_resolve_import_map_entry_0_in_file_1_Supply_the_rootDir_compiler_option_to_disambiguate,
          diagnostics.The_project_root_is_ambiguous_but_is_required_to_resolve_export_map_entry_0_in_file_1_Supply_the_rootDir_compiler_option_to_disambiguate,
        ),
        core.IfElse(entry === "", ".", entry),
        packagePath,
      );
      receiver!.diagnostics = [...receiver!.diagnostics, diagnostic];
      return unresolved();
    }
    const candidateDirectories = resolutionState_getOutputDirectoriesForBaseDirectory(receiver, rootDir);
    for (const candidateDir of candidateDirectories) {
      if (tspath.ContainsPath(candidateDir, finalPath, {
        UseCaseSensitiveFileNames: receiver!.resolver!.host.FS().UseCaseSensitiveFileNames(),
        CurrentDirectory: receiver!.resolver!.host.GetCurrentDirectory(),
      })) {
        const pathFragment = finalPath.slice(candidateDir.length + 1);
        const possibleInputBase = tspath.CombinePaths(rootDir, pathFragment);
        const jsAndDtsExtensions = [extension.ExtensionMjs, extension.ExtensionCjs, extension.ExtensionJs, extension.ExtensionJson, extension.ExtensionDmts, extension.ExtensionDcts, extension.ExtensionDts];
        for (const ext of jsAndDtsExtensions) {
          if (tspath.FileExtensionIs(possibleInputBase, ext)) {
            const inputExts = extension.GetPossibleOriginalInputExtensionForExtension(possibleInputBase);
            for (const possibleExt of inputExts) {
              if (!extensionIsOk(receiver!.extensions, possibleExt)) {
                continue;
              }
              const possibleInputWithInputExtension = extension.ChangeExtension(possibleInputBase, possibleExt);
              if (receiver!.resolver!.host.FS().FileExists(possibleInputWithInputExtension)) {
                const result2 = resolutionState_loadFileNameFromPackageJSONField(receiver, receiver!.extensions, possibleInputWithInputExtension, "");
                if (!resolved_shouldContinueSearching(result2)) {
                  return result2;
                }
              }
            }
          }
        }
      }
    }
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getOutputDirectoriesForBaseDirectory","kind":"method","status":"implemented","sigHash":"7f1f40a6afab5ee13596d05c9d907f3e1c242db23ffd395e7542216ccf1a999d","bodyHash":"05aba4ccace02c4550e59f079149d4695a90cd229d4cfffa04899cec3e7d8b88"}
 *
 * Go source:
 * func (r *resolutionState) getOutputDirectoriesForBaseDirectory(commonSourceDirGuess string) []string {
 * 	// Config file output paths are processed to be relative to the host's current directory, while
 * 	// otherwise the paths are resolved relative to the common source dir the compiler puts together
 * 	currentDir := core.IfElse(r.compilerOptions.ConfigFilePath != "", r.resolver.host.GetCurrentDirectory(), commonSourceDirGuess)
 * 	var candidateDirectories []string
 * 	if r.compilerOptions.DeclarationDir != "" {
 * 		candidateDirectories = append(candidateDirectories, tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(currentDir, r.compilerOptions.DeclarationDir), r.resolver.host.GetCurrentDirectory()))
 * 	}
 * 	if r.compilerOptions.OutDir != "" && r.compilerOptions.OutDir != r.compilerOptions.DeclarationDir {
 * 		candidateDirectories = append(candidateDirectories, tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(currentDir, r.compilerOptions.OutDir), r.resolver.host.GetCurrentDirectory()))
 * 	}
 * 	return candidateDirectories
 * }
 */
export function resolutionState_getOutputDirectoriesForBaseDirectory(receiver: GoPtr<resolutionState>, commonSourceDirGuess: string): GoSlice<string> {
  const currentDir = core.IfElse(receiver!.compilerOptions!.ConfigFilePath !== "", receiver!.resolver!.host.GetCurrentDirectory(), commonSourceDirGuess);
  const candidateDirectories: string[] = [];
  if (receiver!.compilerOptions!.DeclarationDir !== "") {
    candidateDirectories.push(tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(currentDir, receiver!.compilerOptions!.DeclarationDir), receiver!.resolver!.host.GetCurrentDirectory()));
  }
  if (receiver!.compilerOptions!.OutDir !== "" && receiver!.compilerOptions!.OutDir !== receiver!.compilerOptions!.DeclarationDir) {
    candidateDirectories.push(tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(currentDir, receiver!.compilerOptions!.OutDir), receiver!.resolver!.host.GetCurrentDirectory()));
  }
  return candidateDirectories;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromNearestNodeModulesDirectory","kind":"method","status":"implemented","sigHash":"413808a944deab49f53c6978c2f63242c5a0157f416289cd2db8ae801ff93d62","bodyHash":"ffdc6a657f87eb8d5194434b78057a1fe63b00022272e2ea486ecd56ba5570ba"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromNearestNodeModulesDirectory(typesScopeOnly bool) *resolved {
 * 	mode := core.ResolutionModeCommonJS
 * 	if r.esmMode || r.conditionMatches("import") {
 * 		mode = core.ResolutionModeESM
 * 	}
 * 	// Do (up to) two passes through node_modules:
 * 	//   1. For each ancestor node_modules directory, try to find:
 * 	//      i.  TS/DTS files in the implementation package
 * 	//      ii. DTS files in the @types package
 * 	//   2. For each ancestor node_modules directory, try to find:
 * 	//      i.  JS files in the implementation package
 * 	priorityExtensions := r.extensions & (extensionsTypeScript | extensionsDeclaration)
 * 	secondaryExtensions := r.extensions & ^(extensionsTypeScript | extensionsDeclaration)
 * 	// (1)
 * 	if priorityExtensions != 0 {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Searching_all_ancestor_node_modules_directories_for_preferred_extensions_Colon_0, priorityExtensions.String())
 * 		}
 * 		if result := r.loadModuleFromNearestNodeModulesDirectoryWorker(priorityExtensions, mode, typesScopeOnly); !result.shouldContinueSearching() {
 * 			return result
 * 		}
 * 	}
 * 	// (2)
 * 	if secondaryExtensions != 0 && !typesScopeOnly {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Searching_all_ancestor_node_modules_directories_for_fallback_extensions_Colon_0, secondaryExtensions.String())
 * 		}
 * 		return r.loadModuleFromNearestNodeModulesDirectoryWorker(secondaryExtensions, mode, typesScopeOnly)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromNearestNodeModulesDirectory(receiver: GoPtr<resolutionState>, typesScopeOnly: bool): GoPtr<resolved> {
  let mode = ResolutionModeCommonJS;
  if (receiver!.esmMode || resolutionState_conditionMatches(receiver, "import")) {
    mode = ResolutionModeESM;
  }
  const priorityExtensions = receiver!.extensions & (extensionsTypeScript | extensionsDeclaration);
  const secondaryExtensions = receiver!.extensions & ~(extensionsTypeScript | extensionsDeclaration);
  if (priorityExtensions !== 0) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Searching_all_ancestor_node_modules_directories_for_preferred_extensions_Colon_0, extensions_String(priorityExtensions));
    }
    const result = resolutionState_loadModuleFromNearestNodeModulesDirectoryWorker(receiver, priorityExtensions, mode, typesScopeOnly);
    if (!resolved_shouldContinueSearching(result)) {
      return result;
    }
  }
  if (secondaryExtensions !== 0 && !typesScopeOnly) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Searching_all_ancestor_node_modules_directories_for_fallback_extensions_Colon_0, extensions_String(secondaryExtensions));
    }
    return resolutionState_loadModuleFromNearestNodeModulesDirectoryWorker(receiver, secondaryExtensions, mode, typesScopeOnly);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromNearestNodeModulesDirectoryWorker","kind":"method","status":"implemented","sigHash":"423bb1eaedc4886dca8ca7f641777725380639fc77ad8e4f316eeec725bad52e","bodyHash":"60d799313d8aabfec14623fac48b4f205b03b7a75ec6f6de6f323c6d34912ff2"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromNearestNodeModulesDirectoryWorker(ext extensions, mode core.ResolutionMode, typesScopeOnly bool) *resolved {
 * 	result, _ := tspath.ForEachAncestorDirectory(
 * 		r.containingDirectory,
 * 		func(directory string) (result *resolved, stop bool) {
 * 			// !!! stop at global cache
 * 			if tspath.GetBaseFileName(directory) != "node_modules" {
 * 				result := r.loadModuleFromImmediateNodeModulesDirectory(ext, directory, typesScopeOnly)
 * 				return result, !result.shouldContinueSearching()
 * 			}
 * 			return continueSearching(), false
 * 		},
 * 	)
 * 	return result
 * }
 */
export function resolutionState_loadModuleFromNearestNodeModulesDirectoryWorker(receiver: GoPtr<resolutionState>, ext: extensions, mode: ResolutionMode, typesScopeOnly: bool): GoPtr<resolved> {
  const [result] = tspath.ForEachAncestorDirectory<GoPtr<resolved>>(
    receiver!.containingDirectory,
    (directory: string): [GoPtr<resolved>, bool] => {
      if (tspath.GetBaseFileName(directory) !== "node_modules") {
        const r = resolutionState_loadModuleFromImmediateNodeModulesDirectory(receiver, ext, directory, typesScopeOnly);
        return [r, !resolved_shouldContinueSearching(r)];
      }
      return [continueSearching(), false];
    },
  );
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromImmediateNodeModulesDirectory","kind":"method","status":"implemented","sigHash":"bc4dedc597dcef1986a382d83bb1bf679eac287b4c8af57e4f5a2149f68ead9f","bodyHash":"cba73c7ee75a64194c1fbc1351d721315c70af47c6b7c008cbbf51bb6f404863"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromImmediateNodeModulesDirectory(extensions extensions, directory string, typesScopeOnly bool) *resolved {
 * 	nodeModulesFolder := tspath.CombinePaths(directory, "node_modules")
 * 	if !r.resolver.host.FS().DirectoryExists(nodeModulesFolder) {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesFolder)
 * 		}
 * 		return continueSearching()
 * 	}
 * 
 * 	if !typesScopeOnly {
 * 		if packageResult := r.loadModuleFromSpecificNodeModulesDirectory(extensions, r.name, nodeModulesFolder); !packageResult.shouldContinueSearching() {
 * 			return packageResult
 * 		}
 * 	}
 * 
 * 	if extensions&extensionsDeclaration != 0 {
 * 		nodeModulesAtTypes := tspath.CombinePaths(nodeModulesFolder, "@types")
 * 		if !r.resolver.host.FS().DirectoryExists(nodeModulesAtTypes) {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesAtTypes)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		return r.loadModuleFromSpecificNodeModulesDirectory(extensionsDeclaration, r.mangleScopedPackageName(r.name), nodeModulesAtTypes)
 * 	}
 * 
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromImmediateNodeModulesDirectory(receiver: GoPtr<resolutionState>, extensions: extensions, directory: string, typesScopeOnly: bool): GoPtr<resolved> {
  const nodeModulesFolder = tspath.CombinePaths(directory, "node_modules");
  if (!receiver!.resolver!.host.FS().DirectoryExists(nodeModulesFolder)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesFolder);
    }
    return continueSearching();
  }
  if (!typesScopeOnly) {
    const packageResult = resolutionState_loadModuleFromSpecificNodeModulesDirectory(receiver, extensions, receiver!.name, nodeModulesFolder);
    if (!resolved_shouldContinueSearching(packageResult)) {
      return packageResult;
    }
  }
  if ((extensions & extensionsDeclaration) !== 0) {
    const nodeModulesAtTypes = tspath.CombinePaths(nodeModulesFolder, "@types");
    if (!receiver!.resolver!.host.FS().DirectoryExists(nodeModulesAtTypes)) {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesAtTypes);
      }
      return continueSearching();
    }
    return resolutionState_loadModuleFromSpecificNodeModulesDirectory(receiver, extensionsDeclaration, resolutionState_mangleScopedPackageName(receiver, receiver!.name), nodeModulesAtTypes);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromSpecificNodeModulesDirectory","kind":"method","status":"implemented","sigHash":"78802dbc4ebad8c03b6098a429ea1131f7923daa173003c9998aba2bc033710a","bodyHash":"df680e53f050e147f113fb4ca47515db747d7392895981907467832d5e75b980"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromSpecificNodeModulesDirectory(ext extensions, moduleName string, nodeModulesDirectory string) *resolved {
 * 	// Strip any trailing directory separator so that imports like `pkg/` and `pkg`
 * 	// produce identical `candidate` and `packageDirectory` strings. Otherwise the
 * 	// `package.json` info cache (which is keyed by normalized path but stores the
 * 	// caller's `PackageDirectory` verbatim) can hand back, under concurrent
 * 	// inserts, an entry whose `PackageDirectory` doesn't match `candidate`,
 * 	// causing `loadNodeModuleFromDirectoryWorker`'s `ComparePaths(candidate, ...)`
 * 	// check to fail and skip loading the package's `main`/`types` entry.
 * 	// https://github.com/microsoft/typescript-go/issues/3526
 * 	candidate := tspath.RemoveTrailingDirectorySeparator(tspath.NormalizePath(tspath.CombinePaths(nodeModulesDirectory, moduleName)))
 * 	packageName, rest := ParsePackageName(moduleName)
 * 	packageDirectory := tspath.CombinePaths(nodeModulesDirectory, packageName)
 * 	if packageName == "" {
 * 		packageDirectory = candidate
 * 	}
 * 
 * 	if r.resolvePackageDirectoryOnly {
 * 		if r.resolver.host.FS().DirectoryExists(packageDirectory) {
 * 			return &resolved{path: packageDirectory}
 * 		}
 * 		return continueSearching()
 * 	}
 * 
 * 	var rootPackageInfo *packagejson.InfoCacheEntry
 * 	// First look for a nested package.json, as in `node_modules/foo/bar/package.json`
 * 	packageInfo := r.getPackageJsonInfo(candidate)
 * 	// But only if we're not respecting export maps (if we are, we might redirect around this location)
 * 	if rest != "" && packageInfo.Exists() {
 * 		if r.features&NodeResolutionFeaturesExports != 0 {
 * 			rootPackageInfo = r.getPackageJsonInfo(packageDirectory)
 * 		}
 * 		if !rootPackageInfo.Exists() || rootPackageInfo.Contents.Exports.Type == packagejson.JSONValueTypeNotPresent {
 * 			if fromFile := r.loadModuleFromFile(ext, candidate); !fromFile.shouldContinueSearching() {
 * 				return fromFile
 * 			}
 * 
 * 			if fromDirectory := r.loadNodeModuleFromDirectoryWorker(ext, candidate, packageInfo); !fromDirectory.shouldContinueSearching() {
 * 				fromDirectory.packageId = r.getPackageId(fromDirectory.path, packageInfo)
 * 				return fromDirectory
 * 			}
 * 		}
 * 	}
 * 
 * 	loader := func(extensions extensions, candidate string) *resolved {
 * 		if rest != "" || !r.esmMode {
 * 			if fromFile := r.loadModuleFromFile(extensions, candidate); !fromFile.shouldContinueSearching() {
 * 				fromFile.packageId = r.getPackageId(fromFile.path, packageInfo)
 * 				return fromFile
 * 			}
 * 		}
 * 		if fromDirectory := r.loadNodeModuleFromDirectoryWorker(extensions, candidate, packageInfo); !fromDirectory.shouldContinueSearching() {
 * 			fromDirectory.packageId = r.getPackageId(fromDirectory.path, packageInfo)
 * 			return fromDirectory
 * 		}
 * 		// !!! this is ported exactly, but checking for null seems wrong?
 * 		if rest == "" && packageInfo.Exists() &&
 * 			(packageInfo.Contents.Exports.Type == packagejson.JSONValueTypeNotPresent || packageInfo.Contents.Exports.Type == packagejson.JSONValueTypeNull) &&
 * 			r.esmMode {
 * 			// EsmMode disables index lookup in `loadNodeModuleFromDirectoryWorker` generally, however non-relative package resolutions still assume
 * 			// a default `index.js` entrypoint if no `main` or `exports` are present
 * 			if indexResult := r.loadModuleFromFile(extensions, tspath.CombinePaths(candidate, "index.js")); !indexResult.shouldContinueSearching() {
 * 				indexResult.packageId = r.getPackageId(indexResult.path, packageInfo)
 * 				return indexResult
 * 			}
 * 		}
 * 		return continueSearching()
 * 	}
 * 
 * 	if rest != "" {
 * 		packageInfo = rootPackageInfo
 * 		if packageInfo == nil {
 * 			// Previous `packageInfo` may have been from a nested package.json; ensure we have the one from the package root now.
 * 			packageInfo = r.getPackageJsonInfo(packageDirectory)
 * 		}
 * 	}
 * 	if packageInfo != nil {
 * 		r.resolvedPackageDirectory = true
 * 		if r.features&NodeResolutionFeaturesExports != 0 &&
 * 			packageInfo.Exists() &&
 * 			packageInfo.Contents.Exports.Type != packagejson.JSONValueTypeNotPresent {
 * 			// package exports are higher priority than file/directory/typesVersions lookups and (and, if there's exports present, blocks them)
 * 			return r.loadModuleFromExports(packageInfo, ext, tspath.CombinePaths(".", rest))
 * 		}
 * 		if rest != "" {
 * 			versionPaths := packageInfo.Contents.GetVersionPaths(r.getTraceFunc())
 * 			if versionPaths.Exists() {
 * 				if r.tracer != nil {
 * 					r.tracer.write(diagnostics.X_package_json_has_a_typesVersions_entry_0_that_matches_compiler_version_1_looking_for_a_pattern_to_match_module_name_2, versionPaths.Version, Version(), rest)
 * 				}
 * 				pathPatterns := TryParsePatterns(versionPaths.GetPaths())
 * 				if fromPaths := r.tryLoadModuleUsingPaths(ext, rest, packageDirectory, versionPaths.GetPaths(), pathPatterns, loader); !fromPaths.shouldContinueSearching() {
 * 					return fromPaths
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return loader(ext, candidate)
 * }
 */
export function resolutionState_loadModuleFromSpecificNodeModulesDirectory(receiver: GoPtr<resolutionState>, ext: extensions, moduleName: string, nodeModulesDirectory: string): GoPtr<resolved> {
  const candidate = tspath.RemoveTrailingDirectorySeparator(tspath.NormalizePath(tspath.CombinePaths(nodeModulesDirectory, moduleName)));
  const [packageName, rest] = ParsePackageName(moduleName);
  let packageDirectory = tspath.CombinePaths(nodeModulesDirectory, packageName);
  if (packageName === "") {
    packageDirectory = candidate;
  }
  if (receiver!.resolvePackageDirectoryOnly) {
    if (receiver!.resolver!.host.FS().DirectoryExists(packageDirectory)) {
      return { path: packageDirectory, extension: "", packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" }, originalPath: "", resolvedUsingTsExtension: false };
    }
    return continueSearching();
  }
  let rootPackageInfo: GoPtr<InfoCacheEntry> = undefined;
  let packageInfo = resolutionState_getPackageJsonInfo(receiver, candidate);
  if (rest !== "" && InfoCacheEntry_Exists(packageInfo)) {
    if ((receiver!.features & NodeResolutionFeaturesExports) !== 0) {
      rootPackageInfo = resolutionState_getPackageJsonInfo(receiver, packageDirectory);
    }
    if (!InfoCacheEntry_Exists(rootPackageInfo) || packageJsonExports(rootPackageInfo!.Contents).__tsgoEmbedded0!.Type === JSONValueTypeNotPresent) {
      const fromFile = resolutionState_loadModuleFromFile(receiver, ext, candidate);
      if (!resolved_shouldContinueSearching(fromFile)) {
        return fromFile;
      }
      const fromDirectory = resolutionState_loadNodeModuleFromDirectoryWorker(receiver, ext, candidate, packageInfo);
      if (!resolved_shouldContinueSearching(fromDirectory)) {
        fromDirectory!.packageId = resolutionState_getPackageId(receiver, fromDirectory!.path, packageInfo);
        return fromDirectory;
      }
    }
  }
  const loader = (loaderExt: extensions, loaderCandidate: string): GoPtr<resolved> => {
    if (rest !== "" || !receiver!.esmMode) {
      const fromFile2 = resolutionState_loadModuleFromFile(receiver, loaderExt, loaderCandidate);
      if (!resolved_shouldContinueSearching(fromFile2)) {
        fromFile2!.packageId = resolutionState_getPackageId(receiver, fromFile2!.path, packageInfo);
        return fromFile2;
      }
    }
    const fromDirectory2 = resolutionState_loadNodeModuleFromDirectoryWorker(receiver, loaderExt, loaderCandidate, packageInfo);
    if (!resolved_shouldContinueSearching(fromDirectory2)) {
      fromDirectory2!.packageId = resolutionState_getPackageId(receiver, fromDirectory2!.path, packageInfo);
      return fromDirectory2;
    }
    if (
      rest === "" &&
      InfoCacheEntry_Exists(packageInfo) &&
      (packageJsonExports(packageInfo!.Contents).__tsgoEmbedded0!.Type === JSONValueTypeNotPresent || packageJsonExports(packageInfo!.Contents).__tsgoEmbedded0!.Type === JSONValueTypeNull) &&
      receiver!.esmMode
    ) {
      const indexResult = resolutionState_loadModuleFromFile(receiver, loaderExt, tspath.CombinePaths(loaderCandidate, "index.js"));
      if (!resolved_shouldContinueSearching(indexResult)) {
        indexResult!.packageId = resolutionState_getPackageId(receiver, indexResult!.path, packageInfo);
        return indexResult;
      }
    }
    return continueSearching();
  };
  if (rest !== "") {
    packageInfo = rootPackageInfo;
    if (packageInfo === undefined) {
      packageInfo = resolutionState_getPackageJsonInfo(receiver, packageDirectory);
    }
  }
  if (packageInfo !== undefined) {
    receiver!.resolvedPackageDirectory = true;
    if (
      (receiver!.features & NodeResolutionFeaturesExports) !== 0 &&
      InfoCacheEntry_Exists(packageInfo) &&
      // Go: Exports.Type != JSONValueTypeNotPresent — a present-but-null "exports"
      // still routes through loadModuleFromExports (blocking main/index fallbacks).
      packageJsonExports(packageInfo!.Contents).__tsgoEmbedded0!.Type !== JSONValueTypeNotPresent
    ) {
      return resolutionState_loadModuleFromExports(receiver, packageInfo, ext, tspath.CombinePaths(".", rest));
    }
    if (rest !== "") {
      const versionPaths = PackageJson_GetVersionPaths(packageInfo!.Contents, resolutionState_getTraceFunc(receiver) ?? ((_m, ..._args) => {}));
      if (VersionPaths_Exists(versionPaths)) {
        if (receiver!.tracer !== undefined) {
          tracer_write(receiver!.tracer, diagnostics.X_package_json_has_a_typesVersions_entry_0_that_matches_compiler_version_1_looking_for_a_pattern_to_match_module_name_2, versionPaths.Version, Version(), rest);
        }
        const pathPatterns = TryParsePatterns(VersionPaths_GetPaths(versionPaths));
        const fromPaths = resolutionState_tryLoadModuleUsingPaths(receiver, ext, rest, packageDirectory, VersionPaths_GetPaths(versionPaths), pathPatterns, loader);
        if (!resolved_shouldContinueSearching(fromPaths)) {
          return fromPaths;
        }
      }
    }
  }
  return loader(ext, candidate);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.createResolvedModuleHandlingSymlink","kind":"method","status":"implemented","sigHash":"00a1dbd5d590c10fd635b074d8580b43034b099e6a972271cdfe0c455267a60d","bodyHash":"d791f94a391628c7e0ccd7f40ed0e96242d8a6c6cd47916ea20d7c61ba836280"}
 *
 * Go source:
 * func (r *resolutionState) createResolvedModuleHandlingSymlink(resolved *resolved) *ResolvedModule {
 * 	isExternalLibraryImport := resolved != nil && strings.Contains(resolved.path, "/node_modules/")
 * 	if r.compilerOptions.PreserveSymlinks != core.TSTrue &&
 * 		isExternalLibraryImport &&
 * 		resolved.originalPath == "" &&
 * 		!tspath.IsExternalModuleNameRelative(r.name) {
 * 		originalPath, resolvedFileName := r.getOriginalAndResolvedFileName(resolved.path)
 * 		if originalPath != "" {
 * 			resolved.path = resolvedFileName
 * 			resolved.originalPath = originalPath
 * 		}
 * 	}
 * 	return r.createResolvedModule(resolved, isExternalLibraryImport)
 * }
 */
export function resolutionState_createResolvedModuleHandlingSymlink(receiver: GoPtr<resolutionState>, resolved: GoPtr<resolved>): GoPtr<ResolvedModule> {
  const isExternalLibraryImport = resolved !== undefined && strings.Contains(resolved.path, "/node_modules/");
  if (
    receiver!.compilerOptions!.PreserveSymlinks !== TSTrue &&
    isExternalLibraryImport &&
    resolved!.originalPath === "" &&
    !tspath.IsExternalModuleNameRelative(receiver!.name)
  ) {
    const [originalPath, resolvedFileName] = resolutionState_getOriginalAndResolvedFileName(receiver, resolved!.path);
    if (originalPath !== "") {
      resolved!.path = resolvedFileName;
      resolved!.originalPath = originalPath;
    }
  }
  return resolutionState_createResolvedModule(receiver, resolved, isExternalLibraryImport);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.createResolvedModule","kind":"method","status":"implemented","sigHash":"ef2d73b4baa7e74ea906d214458d9685b96551c3bf398245896372335d723318","bodyHash":"43c9f9e1aa12dcf4b35587b504f30b807f607b2b063f180865c0bf6a7a54e7f6"}
 *
 * Go source:
 * func (r *resolutionState) createResolvedModule(resolved *resolved, isExternalLibraryImport bool) *ResolvedModule {
 * 	var resolvedModule ResolvedModule
 * 	resolvedModule.ResolutionDiagnostics = r.diagnostics
 * 
 * 	if resolved != nil {
 * 		resolvedModule.ResolvedFileName = resolved.path
 * 		resolvedModule.OriginalPath = resolved.originalPath
 * 		resolvedModule.IsExternalLibraryImport = isExternalLibraryImport
 * 		resolvedModule.ResolvedUsingTsExtension = resolved.resolvedUsingTsExtension
 * 		resolvedModule.Extension = resolved.extension
 * 		resolvedModule.PackageId = resolved.packageId
 * 	}
 * 	return &resolvedModule
 * }
 */
export function resolutionState_createResolvedModule(receiver: GoPtr<resolutionState>, resolved: GoPtr<resolved>, isExternalLibraryImport: bool): GoPtr<ResolvedModule> {
  const resolvedModule: ResolvedModule = {
    ResolutionDiagnostics: receiver!.diagnostics,
    ResolvedFileName: "",
    OriginalPath: "",
    Extension: "",
    ResolvedUsingTsExtension: false,
    PackageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
    IsExternalLibraryImport: false,
    AlternateResult: "",
  };
  if (resolved !== undefined) {
    resolvedModule.ResolvedFileName = resolved.path;
    resolvedModule.OriginalPath = resolved.originalPath;
    resolvedModule.IsExternalLibraryImport = isExternalLibraryImport;
    resolvedModule.ResolvedUsingTsExtension = resolved.resolvedUsingTsExtension;
    resolvedModule.Extension = resolved.extension;
    resolvedModule.PackageId = resolved.packageId;
  }
  return resolvedModule;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.createResolvedTypeReferenceDirective","kind":"method","status":"implemented","sigHash":"672fd837978a865a32e05b573a0642f45df0c9c9e60bf684bac23177db907fa8","bodyHash":"953bc55d69a16498fdbc07429c7e4d47217fefd60c3c2cbd1db12fb65290e98d"}
 *
 * Go source:
 * func (r *resolutionState) createResolvedTypeReferenceDirective(resolved *resolved, primary bool) *ResolvedTypeReferenceDirective {
 * 	var resolvedTypeReferenceDirective ResolvedTypeReferenceDirective
 * 	resolvedTypeReferenceDirective.ResolutionDiagnostics = r.diagnostics
 * 
 * 	if resolved.isResolved() {
 * 		if !tspath.ExtensionIsTs(resolved.extension) {
 * 			panic("expected a TypeScript file extension")
 * 		}
 * 		resolvedTypeReferenceDirective.ResolvedFileName = resolved.path
 * 		resolvedTypeReferenceDirective.Primary = primary
 * 		resolvedTypeReferenceDirective.PackageId = resolved.packageId
 * 		resolvedTypeReferenceDirective.IsExternalLibraryImport = strings.Contains(resolved.path, "/node_modules/")
 * 
 * 		if r.compilerOptions.PreserveSymlinks != core.TSTrue {
 * 			originalPath, resolvedFileName := r.getOriginalAndResolvedFileName(resolved.path)
 * 			if originalPath != "" {
 * 				resolvedTypeReferenceDirective.ResolvedFileName = resolvedFileName
 * 				resolvedTypeReferenceDirective.OriginalPath = originalPath
 * 			}
 * 		}
 * 	}
 * 	return &resolvedTypeReferenceDirective
 * }
 */
export function resolutionState_createResolvedTypeReferenceDirective(receiver: GoPtr<resolutionState>, resolved: GoPtr<resolved>, primary: bool): GoPtr<ResolvedTypeReferenceDirective> {
  const resolvedTypeReferenceDirective: ResolvedTypeReferenceDirective = {
    ResolutionDiagnostics: receiver!.diagnostics,
    Primary: false,
    ResolvedFileName: "",
    OriginalPath: "",
    PackageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
    IsExternalLibraryImport: false,
  };
  if (resolved_isResolved(resolved)) {
    if (!extension.ExtensionIsTs(resolved!.extension)) {
      throw new globalThis.Error("expected a TypeScript file extension");
    }
    resolvedTypeReferenceDirective.ResolvedFileName = resolved!.path;
    resolvedTypeReferenceDirective.Primary = primary;
    resolvedTypeReferenceDirective.PackageId = resolved!.packageId;
    resolvedTypeReferenceDirective.IsExternalLibraryImport = strings.Contains(resolved!.path, "/node_modules/");
    if (receiver!.compilerOptions!.PreserveSymlinks !== TSTrue) {
      const [originalPath, resolvedFileName] = resolutionState_getOriginalAndResolvedFileName(receiver, resolved!.path);
      if (originalPath !== "") {
        resolvedTypeReferenceDirective.ResolvedFileName = resolvedFileName;
        resolvedTypeReferenceDirective.OriginalPath = originalPath;
      }
    }
  }
  return resolvedTypeReferenceDirective;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getOriginalAndResolvedFileName","kind":"method","status":"implemented","sigHash":"36e650434fa561ec6e9e29401b0ee92df907d4e819012a54d0ecc5ef6efc9b01","bodyHash":"f08b7ebb47b3dd343684c49525f2eb6e5fff43e7b895cc0b9b0344704fd6a708"}
 *
 * Go source:
 * func (r *resolutionState) getOriginalAndResolvedFileName(fileName string) (string, string) {
 * 	resolvedFileName := r.realPath(fileName)
 * 	comparePathsOptions := tspath.ComparePathsOptions{
 * 		UseCaseSensitiveFileNames: r.resolver.host.FS().UseCaseSensitiveFileNames(),
 * 		CurrentDirectory:          r.resolver.host.GetCurrentDirectory(),
 * 	}
 * 	if tspath.ComparePaths(fileName, resolvedFileName, comparePathsOptions) == 0 {
 * 		// If the fileName and realpath are differing only in casing, prefer fileName
 * 		// so that we can issue correct errors for casing under forceConsistentCasingInFileNames
 * 		return "", fileName
 * 	}
 * 	return fileName, resolvedFileName
 * }
 */
export function resolutionState_getOriginalAndResolvedFileName(receiver: GoPtr<resolutionState>, fileName: string): [string, string] {
  const resolvedFileName = resolutionState_realPath(receiver, fileName);
  const comparePathsOptions: tspath.ComparePathsOptions = {
    UseCaseSensitiveFileNames: receiver!.resolver!.host.FS().UseCaseSensitiveFileNames(),
    CurrentDirectory: receiver!.resolver!.host.GetCurrentDirectory(),
  };
  if (tspath.ComparePaths(fileName, resolvedFileName, comparePathsOptions) === 0) {
    return ["", fileName];
  }
  return [fileName, resolvedFileName];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryLoadModuleUsingOptionalResolutionSettings","kind":"method","status":"implemented","sigHash":"820c4228f0d639988af2de151509710c7437bba0719f1bcfc69eb160747cf281","bodyHash":"6be059d6e0ea2862a3a2ed72f53b9a151dc5911a3ff76859576873a91c651aa8"}
 *
 * Go source:
 * func (r *resolutionState) tryLoadModuleUsingOptionalResolutionSettings() *resolved {
 * 	if resolved := r.tryLoadModuleUsingPathsIfEligible(); !resolved.shouldContinueSearching() {
 * 		return resolved
 * 	}
 * 
 * 	if !tspath.IsExternalModuleNameRelative(r.name) {
 * 		// No more tryLoadModuleUsingBaseUrl.
 * 		return continueSearching()
 * 	} else {
 * 		return r.tryLoadModuleUsingRootDirs()
 * 	}
 * }
 */
export function resolutionState_tryLoadModuleUsingOptionalResolutionSettings(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  const pathsResult = resolutionState_tryLoadModuleUsingPathsIfEligible(receiver);
  if (!resolved_shouldContinueSearching(pathsResult)) {
    return pathsResult;
  }
  if (!tspath.IsExternalModuleNameRelative(receiver!.name)) {
    return continueSearching();
  } else {
    return resolutionState_tryLoadModuleUsingRootDirs(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getParsedPatternsForPaths","kind":"method","status":"implemented","sigHash":"a72d50c2824954588a27291431495a106ef8001846e6f16a53df247083869593","bodyHash":"ad435b88f1a966e15f037bc286ce8caa8d9a36546bcb9a4185247b16fdfc4e84"}
 *
 * Go source:
 * func (r *resolutionState) getParsedPatternsForPaths() *ParsedPatterns {
 * 	if r.compilerOptions == r.resolver.compilerOptions {
 * 		return r.resolver.getParsedPatternsForPaths()
 * 	}
 * 	r.parsedPatternsForPathsOnce.Do(func() {
 * 		r.parsedPatternsForPaths = TryParsePatterns(r.compilerOptions.Paths)
 * 	})
 * 	return r.parsedPatternsForPaths
 * }
 */
export function resolutionState_getParsedPatternsForPaths(receiver: GoPtr<resolutionState>): GoPtr<ParsedPatterns> {
  if (receiver!.compilerOptions === receiver!.resolver!.compilerOptions) {
    return Resolver_getParsedPatternsForPaths(receiver!.resolver);
  }
  receiver!.parsedPatternsForPathsOnce.Do(() => {
    receiver!.parsedPatternsForPaths = TryParsePatterns(receiver!.compilerOptions!.Paths);
  });
  return receiver!.parsedPatternsForPaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryLoadModuleUsingPathsIfEligible","kind":"method","status":"implemented","sigHash":"495528733a6106c2cf84fc1eb7fdd99c2676f8fcddaecf47885a7d2f6231d289","bodyHash":"8d199f31538635385d3a95bb662d62e9d776cff243314b4f7960ed643d511bd3"}
 *
 * Go source:
 * func (r *resolutionState) tryLoadModuleUsingPathsIfEligible() *resolved {
 * 	if r.compilerOptions.Paths.Size() > 0 && !tspath.PathIsRelative(r.name) {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.X_paths_option_is_specified_looking_for_a_pattern_to_match_module_name_0, r.name)
 * 		}
 * 	} else {
 * 		return continueSearching()
 * 	}
 * 	baseDirectory := r.compilerOptions.GetPathsBasePath(r.resolver.host.GetCurrentDirectory())
 * 	pathPatterns := r.getParsedPatternsForPaths()
 * 	return r.tryLoadModuleUsingPaths(
 * 		r.extensions,
 * 		r.name,
 * 		baseDirectory,
 * 		r.compilerOptions.Paths,
 * 		pathPatterns,
 * 		func(extensions extensions, candidate string) *resolved {
 * 			return r.nodeLoadModuleByRelativeName(extensions, candidate, true /*considerPackageJson* /)
 * 		},
 * 	)
 * }
 */
export function resolutionState_tryLoadModuleUsingPathsIfEligible(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  if (OrderedMap_Size(receiver!.compilerOptions!.Paths) > 0 && !tspath.PathIsRelative(receiver!.name)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.X_paths_option_is_specified_looking_for_a_pattern_to_match_module_name_0, receiver!.name);
    }
  } else {
    return continueSearching();
  }
  const baseDirectory = CompilerOptions_GetPathsBasePath(receiver!.compilerOptions, receiver!.resolver!.host.GetCurrentDirectory());
  const pathPatterns = resolutionState_getParsedPatternsForPaths(receiver);
  return resolutionState_tryLoadModuleUsingPaths(
    receiver,
    receiver!.extensions,
    receiver!.name,
    baseDirectory,
    receiver!.compilerOptions!.Paths,
    pathPatterns,
    (loaderExt: extensions, loaderCandidate: string): GoPtr<resolved> => {
      return resolutionState_nodeLoadModuleByRelativeName(receiver, loaderExt, loaderCandidate, true);
    },
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryLoadModuleUsingPaths","kind":"method","status":"implemented","sigHash":"79508045b37193c8ab5ad0a759e3182ca31bad26ad2dbd50c9f910c4bb1216d4","bodyHash":"d4419cb2124b16008a19aeeedb372df16fd14c38b35b013f404c8cb83994956a"}
 *
 * Go source:
 * func (r *resolutionState) tryLoadModuleUsingPaths(extensions extensions, moduleName string, containingDirectory string, paths *collections.OrderedMap[string, []string], pathPatterns *ParsedPatterns, loader resolutionKindSpecificLoader) *resolved {
 * 	if matchedPattern := MatchPatternOrExact(pathPatterns, moduleName); matchedPattern.IsValid() {
 * 		matchedStar := matchedPattern.MatchedText(moduleName)
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Module_name_0_matched_pattern_1, moduleName, matchedPattern.Text)
 * 		}
 * 		for _, subst := range paths.GetOrZero(matchedPattern.Text) {
 * 			path := strings.Replace(subst, "*", matchedStar, 1)
 * 			candidate := tspath.NormalizePath(tspath.CombinePaths(containingDirectory, path))
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Trying_substitution_0_candidate_module_location_Colon_1, subst, path)
 * 			}
 * 			// A path mapping may have an extension
 * 			extensionFromSubst := tspath.TryGetExtensionFromPath(subst)
 * 			if extensionFromSubst != "" {
 * 				if path, ok := r.tryFile(candidate); ok {
 * 					return &resolved{
 * 						path:      path,
 * 						extension: extensionFromSubst,
 * 					}
 * 				}
 * 			}
 * 			// When the substitution path has an explicit extension, the extension came from the
 * 			// paths config, not the module specifier. Suppress resolvedUsingTsExtension in that case.
 * 			saveCandidateEndingIsFromConfig := r.candidateEndingIsFromConfig
 * 			if extensionFromSubst != "" {
 * 				r.candidateEndingIsFromConfig = true
 * 			}
 * 			resolved := loader(extensions, candidate)
 * 			r.candidateEndingIsFromConfig = saveCandidateEndingIsFromConfig
 * 			if !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_tryLoadModuleUsingPaths(receiver: GoPtr<resolutionState>, extensions: extensions, moduleName: string, containingDirectory: string, paths: GoPtr<OrderedMap>, pathPatterns: GoPtr<ParsedPatterns>, loader: resolutionKindSpecificLoader): GoPtr<resolved> {
  const matchedPattern = MatchPatternOrExact(pathPatterns, moduleName);
  if (Pattern_IsValid(matchedPattern)) {
    const matchedStar = Pattern_MatchedText(matchedPattern, moduleName);
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Module_name_0_matched_pattern_1, moduleName, matchedPattern.Text);
    }
    for (const subst of OrderedMap_GetOrZero<string, GoSlice<string>>(paths as GoPtr<OrderedMap<string, GoSlice<string>>>, matchedPattern.Text)) {
      const path2 = strings.Replace(subst, "*", matchedStar, 1);
      const candidate = tspath.NormalizePath(tspath.CombinePaths(containingDirectory, path2));
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Trying_substitution_0_candidate_module_location_Colon_1, subst, path2);
      }
      const extensionFromSubst = extension.TryGetExtensionFromPath(subst);
      if (extensionFromSubst !== "") {
        const [filePath, fileOk] = resolutionState_tryFile(receiver, candidate);
        if (fileOk) {
          return {
            path: filePath,
            extension: extensionFromSubst,
            packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
            originalPath: "",
            resolvedUsingTsExtension: false,
          };
        }
      }
      const saveCandidateEndingIsFromConfig = receiver!.candidateEndingIsFromConfig;
      if (extensionFromSubst !== "") {
        receiver!.candidateEndingIsFromConfig = true;
      }
      const resolved2 = loader(extensions, candidate);
      receiver!.candidateEndingIsFromConfig = saveCandidateEndingIsFromConfig;
      if (!resolved_shouldContinueSearching(resolved2)) {
        return resolved2;
      }
    }
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryLoadModuleUsingRootDirs","kind":"method","status":"implemented","sigHash":"afaa3551381adf15504cef8d380603f62cdd174a15c9625804529fec9c30b1e0","bodyHash":"87b7b1aaf43fcadf6a2c048aef9f59e46e677c132cc4265e9b9f1d92b2dffe81"}
 *
 * Go source:
 * func (r *resolutionState) tryLoadModuleUsingRootDirs() *resolved {
 * 	if len(r.compilerOptions.RootDirs) == 0 {
 * 		return continueSearching()
 * 	}
 * 
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.X_rootDirs_option_is_set_using_it_to_resolve_relative_module_name_0, r.name)
 * 	}
 * 
 * 	candidate := tspath.NormalizePath(tspath.CombinePaths(r.containingDirectory, r.name))
 * 
 * 	var matchedRootDir string
 * 	var matchedNormalizedPrefix string
 * 	for _, rootDir := range r.compilerOptions.RootDirs {
 * 		// rootDirs are expected to be absolute
 * 		// in case of tsconfig.json this will happen automatically - compiler will expand relative names
 * 		// using location of tsconfig.json as base location
 * 		normalizedRoot := tspath.NormalizePath(rootDir)
 * 		if !strings.HasSuffix(normalizedRoot, "/") {
 * 			normalizedRoot += "/"
 * 		}
 * 		isLongestMatchingPrefix := strings.HasPrefix(candidate, normalizedRoot) &&
 * 			(matchedNormalizedPrefix == "" || len(matchedNormalizedPrefix) < len(normalizedRoot))
 * 
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Checking_if_0_is_the_longest_matching_prefix_for_1_2, normalizedRoot, candidate, isLongestMatchingPrefix)
 * 		}
 * 
 * 		if isLongestMatchingPrefix {
 * 			matchedNormalizedPrefix = normalizedRoot
 * 			matchedRootDir = rootDir
 * 		}
 * 	}
 * 
 * 	if matchedNormalizedPrefix != "" {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Longest_matching_prefix_for_0_is_1, candidate, matchedNormalizedPrefix)
 * 		}
 * 		suffix := candidate[len(matchedNormalizedPrefix):]
 * 
 * 		// first - try to load from a initial location
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, matchedNormalizedPrefix, candidate)
 * 		}
 * 		loader := func(extensions extensions, candidate string) *resolved {
 * 			return r.nodeLoadModuleByRelativeName(extensions, candidate, true /*considerPackageJson* /)
 * 		}
 * 		if resolvedFileName := loader(r.extensions, candidate); !resolvedFileName.shouldContinueSearching() {
 * 			return resolvedFileName
 * 		}
 * 
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Trying_other_entries_in_rootDirs)
 * 		}
 * 		// then try to resolve using remaining entries in rootDirs
 * 		for _, rootDir := range r.compilerOptions.RootDirs {
 * 			if rootDir == matchedRootDir {
 * 				// skip the initially matched entry
 * 				continue
 * 			}
 * 			candidate := tspath.CombinePaths(tspath.NormalizePath(rootDir), suffix)
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, rootDir, candidate)
 * 			}
 * 			if resolvedFileName := loader(r.extensions, candidate); !resolvedFileName.shouldContinueSearching() {
 * 				return resolvedFileName
 * 			}
 * 		}
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Module_resolution_using_rootDirs_has_failed)
 * 		}
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_tryLoadModuleUsingRootDirs(receiver: GoPtr<resolutionState>): GoPtr<resolved> {
  if (!receiver!.compilerOptions!.RootDirs || receiver!.compilerOptions!.RootDirs.length === 0) {
    return continueSearching();
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.X_rootDirs_option_is_set_using_it_to_resolve_relative_module_name_0, receiver!.name);
  }
  const candidate = tspath.NormalizePath(tspath.CombinePaths(receiver!.containingDirectory, receiver!.name));
  let matchedRootDir = "";
  let matchedNormalizedPrefix = "";
  for (const rootDir of receiver!.compilerOptions!.RootDirs) {
    let normalizedRoot = tspath.NormalizePath(rootDir);
    if (!strings.HasSuffix(normalizedRoot, "/")) {
      normalizedRoot += "/";
    }
    const isLongestMatchingPrefix = strings.HasPrefix(candidate, normalizedRoot) &&
      (matchedNormalizedPrefix === "" || matchedNormalizedPrefix.length < normalizedRoot.length);
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Checking_if_0_is_the_longest_matching_prefix_for_1_2, normalizedRoot, candidate, isLongestMatchingPrefix);
    }
    if (isLongestMatchingPrefix) {
      matchedNormalizedPrefix = normalizedRoot;
      matchedRootDir = rootDir;
    }
  }
  if (matchedNormalizedPrefix !== "") {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Longest_matching_prefix_for_0_is_1, candidate, matchedNormalizedPrefix);
    }
    const suffix = candidate.slice(matchedNormalizedPrefix.length);
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, matchedNormalizedPrefix, candidate);
    }
    const loader = (loaderExt: extensions, loaderCandidate: string): GoPtr<resolved> => {
      return resolutionState_nodeLoadModuleByRelativeName(receiver, loaderExt, loaderCandidate, true);
    };
    const firstResult = loader(receiver!.extensions, candidate);
    if (!resolved_shouldContinueSearching(firstResult)) {
      return firstResult;
    }
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Trying_other_entries_in_rootDirs);
    }
    for (const rootDir of receiver!.compilerOptions!.RootDirs) {
      if (rootDir === matchedRootDir) {
        continue;
      }
      const otherCandidate = tspath.CombinePaths(tspath.NormalizePath(rootDir), suffix);
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, rootDir, otherCandidate);
      }
      const otherResult = loader(receiver!.extensions, otherCandidate);
      if (!resolved_shouldContinueSearching(otherResult)) {
        return otherResult;
      }
    }
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Module_resolution_using_rootDirs_has_failed);
    }
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.nodeLoadModuleByRelativeName","kind":"method","status":"implemented","sigHash":"9e93588d2108d1185bbba8c01161bd0d714cf60e51aba6cd20152e019f8c62aa","bodyHash":"768a43f723dbb9606ec6f32c20d557d379c687b8d92c8953df6b98d0fab4c90a"}
 *
 * Go source:
 * func (r *resolutionState) nodeLoadModuleByRelativeName(extensions extensions, candidate string, considerPackageJson bool) *resolved {
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Loading_module_as_file_Slash_folder_candidate_module_location_0_target_file_types_Colon_1, candidate, extensions.String())
 * 	}
 * 	if !tspath.HasTrailingDirectorySeparator(candidate) {
 * 		parentOfCandidate := tspath.GetDirectoryPath(candidate)
 * 		if !r.resolver.host.FS().DirectoryExists(parentOfCandidate) {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, parentOfCandidate)
 * 			}
 * 			return continueSearching()
 * 		}
 * 		resolvedFromFile := r.loadModuleFromFile(extensions, candidate)
 * 		if resolvedFromFile != nil {
 * 			if considerPackageJson {
 * 				if packageDirectory := ParseNodeModuleFromPath(resolvedFromFile.path /*isFolder* /, false); packageDirectory != "" {
 * 					resolvedFromFile.packageId = r.getPackageId(resolvedFromFile.path, r.getPackageJsonInfo(packageDirectory))
 * 				}
 * 			}
 * 			return resolvedFromFile
 * 		}
 * 	}
 * 	if !r.resolver.host.FS().DirectoryExists(candidate) {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, candidate)
 * 		}
 * 		return continueSearching()
 * 	}
 * 	// esm mode relative imports shouldn't do any directory lookups (either inside `package.json`
 * 	// files or implicit `index.js`es). This is a notable departure from cjs norms, where `./foo/pkg`
 * 	// could have been redirected by `./foo/pkg/package.json` to an arbitrary location!
 * 	if !r.esmMode {
 * 		return r.loadNodeModuleFromDirectory(extensions, candidate, considerPackageJson)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_nodeLoadModuleByRelativeName(receiver: GoPtr<resolutionState>, extensions: extensions, candidate: string, considerPackageJson: bool): GoPtr<resolved> {
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Loading_module_as_file_Slash_folder_candidate_module_location_0_target_file_types_Colon_1, candidate, extensions_String(extensions));
  }
  if (!tspath.HasTrailingDirectorySeparator(candidate)) {
    const parentOfCandidate = tspath.GetDirectoryPath(candidate);
    if (!receiver!.resolver!.host.FS().DirectoryExists(parentOfCandidate)) {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, parentOfCandidate);
      }
      return continueSearching();
    }
    const resolvedFromFile = resolutionState_loadModuleFromFile(receiver, extensions, candidate);
    if (resolvedFromFile !== undefined) {
      if (considerPackageJson) {
        const packageDirectory = ParseNodeModuleFromPath(resolvedFromFile.path, false);
        if (packageDirectory !== "") {
          resolvedFromFile.packageId = resolutionState_getPackageId(receiver, resolvedFromFile.path, resolutionState_getPackageJsonInfo(receiver, packageDirectory));
        }
      }
      return resolvedFromFile;
    }
  }
  if (!receiver!.resolver!.host.FS().DirectoryExists(candidate)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, candidate);
    }
    return continueSearching();
  }
  if (!receiver!.esmMode) {
    return resolutionState_loadNodeModuleFromDirectory(receiver, extensions, candidate, considerPackageJson);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromFile","kind":"method","status":"implemented","sigHash":"1c26cf267c1bc8cdb7f072f778a8b388c32890106ab7c9d24271e17a168d944c","bodyHash":"09ff924cb6169061679d7a3b19d8444c32bd9ed2fd3749bfc7a20ff44f713ba1"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromFile(extensions extensions, candidate string) *resolved {
 * 	// ./foo.js -> ./foo.ts
 * 	resolvedByReplacingExtension := r.loadModuleFromFileNoImplicitExtensions(extensions, candidate)
 * 	if resolvedByReplacingExtension != nil {
 * 		return resolvedByReplacingExtension
 * 	}
 * 
 * 	// ./foo -> ./foo.ts
 * 	if !r.esmMode {
 * 		return r.tryAddingExtensions(candidate, extensions, "")
 * 	}
 * 
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadModuleFromFile(receiver: GoPtr<resolutionState>, extensions: extensions, candidate: string): GoPtr<resolved> {
  const resolvedByReplacingExtension = resolutionState_loadModuleFromFileNoImplicitExtensions(receiver, extensions, candidate);
  if (resolvedByReplacingExtension !== undefined) {
    return resolvedByReplacingExtension;
  }
  if (!receiver!.esmMode) {
    return resolutionState_tryAddingExtensions(receiver, candidate, extensions, "");
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadModuleFromFileNoImplicitExtensions","kind":"method","status":"implemented","sigHash":"64eebed29f2585cda53bcab5e3b8ad1dbb0c61d8c95fbbac6a54969e448b4b96","bodyHash":"da0e143444febba303143ada21b7f2d0126e5fb1418654ad72deaf918cf5c8c5"}
 *
 * Go source:
 * func (r *resolutionState) loadModuleFromFileNoImplicitExtensions(extensions extensions, candidate string) *resolved {
 * 	base := tspath.GetBaseFileName(candidate)
 * 	if !strings.Contains(base, ".") {
 * 		return continueSearching() // extensionless import, no lookups performed, since we don't support extensionless files
 * 	}
 * 	extensionless := tspath.RemoveFileExtension(candidate)
 * 	if extensionless == candidate {
 * 		// Once TS native extensions are handled, handle arbitrary extensions for declaration file mapping
 * 		extensionless = candidate[:strings.LastIndex(candidate, ".")]
 * 	}
 * 
 * 	extension := candidate[len(extensionless):]
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.File_name_0_has_a_1_extension_stripping_it, candidate, extension)
 * 	}
 * 	return r.tryAddingExtensions(extensionless, extensions, extension)
 * }
 */
export function resolutionState_loadModuleFromFileNoImplicitExtensions(receiver: GoPtr<resolutionState>, extensions: extensions, candidate: string): GoPtr<resolved> {
  const base = tspath.GetBaseFileName(candidate);
  if (!strings.Contains(base, ".")) {
    return continueSearching();
  }
  let extensionless = extension.RemoveFileExtension(candidate);
  if (extensionless === candidate) {
    extensionless = candidate.slice(0, candidate.lastIndexOf("."));
  }
  const ext2 = candidate.slice(extensionless.length);
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.File_name_0_has_a_1_extension_stripping_it, candidate, ext2);
  }
  return resolutionState_tryAddingExtensions(receiver, extensionless, extensions, ext2);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryAddingExtensions","kind":"method","status":"implemented","sigHash":"bfb611aa6043775176ce074f0ee19b69048833de4bb47876f7fd28ecb02caa04","bodyHash":"54af7eac31ac00b92af633036a3d52fb4787ad010368b0efcf05bce391490391"}
 *
 * Go source:
 * func (r *resolutionState) tryAddingExtensions(extensionless string, extensions extensions, originalExtension string) *resolved {
 * 	directory := tspath.GetDirectoryPath(extensionless)
 * 	if directory != "" && !r.resolver.host.FS().DirectoryExists(directory) {
 * 		return continueSearching()
 * 	}
 * 
 * 	switch originalExtension {
 * 	case tspath.ExtensionMjs, tspath.ExtensionMts, tspath.ExtensionDmts:
 * 		if extensions&extensionsTypeScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionMts, extensionless, originalExtension == tspath.ExtensionMts || originalExtension == tspath.ExtensionDmts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionDmts, extensionless, originalExtension == tspath.ExtensionMts || originalExtension == tspath.ExtensionDmts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsJavaScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionMjs, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	case tspath.ExtensionCjs, tspath.ExtensionCts, tspath.ExtensionDcts:
 * 		if extensions&extensionsTypeScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionCts, extensionless, originalExtension == tspath.ExtensionCts || originalExtension == tspath.ExtensionDcts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionDcts, extensionless, originalExtension == tspath.ExtensionCts || originalExtension == tspath.ExtensionDcts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsJavaScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionCjs, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	case tspath.ExtensionJson:
 * 		if extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.tryExtension(".d.json.ts", extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsJson != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionJson, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	case tspath.ExtensionTsx, tspath.ExtensionJsx:
 * 		// basically idendical to the ts/js case below, but prefers matching tsx and jsx files exactly before falling back to the ts or js file path
 * 		// (historically, we disallow having both a a.ts and a.tsx file in the same compilation, since their outputs clash)
 * 		// TODO: We should probably error if `"./a.tsx"` resolved to `"./a.ts"`, right?
 * 		if extensions&extensionsTypeScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionTsx, extensionless, originalExtension == tspath.ExtensionTsx); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 			if resolved := r.tryExtension(tspath.ExtensionTs, extensionless, originalExtension == tspath.ExtensionTsx); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionDts, extensionless, originalExtension == tspath.ExtensionTsx); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsJavaScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionJsx, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 			if resolved := r.tryExtension(tspath.ExtensionJs, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	case tspath.ExtensionTs, tspath.ExtensionDts, tspath.ExtensionJs, "":
 * 		if extensions&extensionsTypeScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionTs, extensionless, originalExtension == tspath.ExtensionTs || originalExtension == tspath.ExtensionDts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 			if resolved := r.tryExtension(tspath.ExtensionTsx, extensionless, originalExtension == tspath.ExtensionTs || originalExtension == tspath.ExtensionDts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsDeclaration != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionDts, extensionless, originalExtension == tspath.ExtensionTs || originalExtension == tspath.ExtensionDts); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if extensions&extensionsJavaScript != 0 {
 * 			if resolved := r.tryExtension(tspath.ExtensionJs, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 			if resolved := r.tryExtension(tspath.ExtensionJsx, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		if r.isConfigLookup {
 * 			if resolved := r.tryExtension(tspath.ExtensionJson, extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	default:
 * 		if extensions&extensionsDeclaration != 0 && !tspath.IsDeclarationFileName(extensionless+originalExtension) {
 * 			if resolved := r.tryExtension(".d"+originalExtension+".ts", extensionless, false); !resolved.shouldContinueSearching() {
 * 				return resolved
 * 			}
 * 		}
 * 		return continueSearching()
 * 	}
 * }
 */
export function resolutionState_tryAddingExtensions(receiver: GoPtr<resolutionState>, extensionless: string, extensions: extensions, originalExtension: string): GoPtr<resolved> {
  const directory = tspath.GetDirectoryPath(extensionless);
  if (directory !== "" && !receiver!.resolver!.host.FS().DirectoryExists(directory)) {
    return continueSearching();
  }
  switch (originalExtension) {
    case extension.ExtensionMjs:
    case extension.ExtensionMts:
    case extension.ExtensionDmts: {
      if ((extensions & extensionsTypeScript) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionMts, extensionless, originalExtension === extension.ExtensionMts || originalExtension === extension.ExtensionDmts);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsDeclaration) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionDmts, extensionless, originalExtension === extension.ExtensionMts || originalExtension === extension.ExtensionDmts);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsJavaScript) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionMjs, extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      return continueSearching();
    }
    case extension.ExtensionCjs:
    case extension.ExtensionCts:
    case extension.ExtensionDcts: {
      if ((extensions & extensionsTypeScript) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionCts, extensionless, originalExtension === extension.ExtensionCts || originalExtension === extension.ExtensionDcts);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsDeclaration) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionDcts, extensionless, originalExtension === extension.ExtensionCts || originalExtension === extension.ExtensionDcts);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsJavaScript) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionCjs, extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      return continueSearching();
    }
    case extension.ExtensionJson: {
      if ((extensions & extensionsDeclaration) !== 0) {
        const r = resolutionState_tryExtension(receiver, ".d.json.ts", extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsJson) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionJson, extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      return continueSearching();
    }
    case extension.ExtensionTsx:
    case extension.ExtensionJsx: {
      if ((extensions & extensionsTypeScript) !== 0) {
        const r1 = resolutionState_tryExtension(receiver, extension.ExtensionTsx, extensionless, originalExtension === extension.ExtensionTsx);
        if (!resolved_shouldContinueSearching(r1)) return r1;
        const r2 = resolutionState_tryExtension(receiver, extension.ExtensionTs, extensionless, originalExtension === extension.ExtensionTsx);
        if (!resolved_shouldContinueSearching(r2)) return r2;
      }
      if ((extensions & extensionsDeclaration) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionDts, extensionless, originalExtension === extension.ExtensionTsx);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsJavaScript) !== 0) {
        const r1 = resolutionState_tryExtension(receiver, extension.ExtensionJsx, extensionless, false);
        if (!resolved_shouldContinueSearching(r1)) return r1;
        const r2 = resolutionState_tryExtension(receiver, extension.ExtensionJs, extensionless, false);
        if (!resolved_shouldContinueSearching(r2)) return r2;
      }
      return continueSearching();
    }
    case extension.ExtensionTs:
    case extension.ExtensionDts:
    case extension.ExtensionJs:
    case "": {
      if ((extensions & extensionsTypeScript) !== 0) {
        const r1 = resolutionState_tryExtension(receiver, extension.ExtensionTs, extensionless, originalExtension === extension.ExtensionTs || originalExtension === extension.ExtensionDts);
        if (!resolved_shouldContinueSearching(r1)) return r1;
        const r2 = resolutionState_tryExtension(receiver, extension.ExtensionTsx, extensionless, originalExtension === extension.ExtensionTs || originalExtension === extension.ExtensionDts);
        if (!resolved_shouldContinueSearching(r2)) return r2;
      }
      if ((extensions & extensionsDeclaration) !== 0) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionDts, extensionless, originalExtension === extension.ExtensionTs || originalExtension === extension.ExtensionDts);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      if ((extensions & extensionsJavaScript) !== 0) {
        const r1 = resolutionState_tryExtension(receiver, extension.ExtensionJs, extensionless, false);
        if (!resolved_shouldContinueSearching(r1)) return r1;
        const r2 = resolutionState_tryExtension(receiver, extension.ExtensionJsx, extensionless, false);
        if (!resolved_shouldContinueSearching(r2)) return r2;
      }
      if (receiver!.isConfigLookup) {
        const r = resolutionState_tryExtension(receiver, extension.ExtensionJson, extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      return continueSearching();
    }
    default: {
      if ((extensions & extensionsDeclaration) !== 0 && !extension.IsDeclarationFileName(extensionless + originalExtension)) {
        const r = resolutionState_tryExtension(receiver, ".d" + originalExtension + ".ts", extensionless, false);
        if (!resolved_shouldContinueSearching(r)) return r;
      }
      return continueSearching();
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryExtension","kind":"method","status":"implemented","sigHash":"074560f0541c5d6625e54e659beed6ebaf74c4668ff13240c5d168abea0f3572","bodyHash":"e25180d3e3c77282e7e389cafce24f8508d7cfb081addc5c3c9b5c484193a90e"}
 *
 * Go source:
 * func (r *resolutionState) tryExtension(extension string, extensionless string, resolvedUsingTsExtension bool) *resolved {
 * 	fileName := extensionless + extension
 * 	if path, ok := r.tryFile(fileName); ok {
 * 		return &resolved{
 * 			path:                     path,
 * 			extension:                extension,
 * 			resolvedUsingTsExtension: !r.candidateEndingIsFromConfig && resolvedUsingTsExtension,
 * 		}
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_tryExtension(receiver: GoPtr<resolutionState>, extension: string, extensionless: string, resolvedUsingTsExtension: bool): GoPtr<resolved> {
  const fileName = extensionless + extension;
  const [path, ok] = resolutionState_tryFile(receiver, fileName);
  if (ok) {
    return {
      path: path,
      extension: extension,
      resolvedUsingTsExtension: (!receiver!.candidateEndingIsFromConfig && resolvedUsingTsExtension) as bool,
      packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
      originalPath: "",
    };
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryFile","kind":"method","status":"implemented","sigHash":"413f2a4f9cfc4dc17a7a9562ded8c556dc5e1549b8ce0d8f9f73bc7be4e9d880","bodyHash":"a6c9ad80b82a51d0923b80bab6427ee2771d2d21a91cc10fd6b891516e274811"}
 *
 * Go source:
 * func (r *resolutionState) tryFile(fileName string) (string, bool) {
 * 	if len(r.compilerOptions.ModuleSuffixes) == 0 {
 * 		return fileName, r.tryFileLookup(fileName)
 * 	}
 * 
 * 	ext := tspath.TryGetExtensionFromPath(fileName)
 * 	fileNameNoExtension := tspath.RemoveExtension(fileName, ext)
 * 	for _, suffix := range r.compilerOptions.ModuleSuffixes {
 * 		path := fileNameNoExtension + suffix + ext
 * 		if r.tryFileLookup(path) {
 * 			return path, true
 * 		}
 * 	}
 * 	return fileName, false
 * }
 */
export function resolutionState_tryFile(receiver: GoPtr<resolutionState>, fileName: string): [string, bool] {
  if ((receiver!.compilerOptions!.ModuleSuffixes?.length ?? 0) === 0) {
    return [fileName, resolutionState_tryFileLookup(receiver, fileName)];
  }
  const ext = extension.TryGetExtensionFromPath(fileName);
  const fileNameNoExtension = extension.RemoveExtension(fileName, ext);
  for (const suffix of (receiver!.compilerOptions!.ModuleSuffixes ?? [])) {
    const p = fileNameNoExtension + suffix + ext;
    if (resolutionState_tryFileLookup(receiver, p)) {
      return [p, true as bool];
    }
  }
  return [fileName, false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.tryFileLookup","kind":"method","status":"implemented","sigHash":"3967dde06cb200c1978ea86147b0cf1160e8f24ba3d7b2cdd1aad3ece6e50add","bodyHash":"c7ead5154cb1d27b504653d026c47ff6392f24d36d53124c577fb68b8975f94a"}
 *
 * Go source:
 * func (r *resolutionState) tryFileLookup(fileName string) bool {
 * 	if r.resolver.host.FS().FileExists(fileName) {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.File_0_exists_use_it_as_a_name_resolution_result, fileName)
 * 		}
 * 		return true
 * 	} else if r.tracer != nil {
 * 		r.tracer.write(diagnostics.File_0_does_not_exist, fileName)
 * 	}
 * 	return false
 * }
 */
export function resolutionState_tryFileLookup(receiver: GoPtr<resolutionState>, fileName: string): bool {
  if (receiver!.resolver!.host.FS().FileExists(fileName)) {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.File_0_exists_use_it_as_a_name_resolution_result, fileName);
    }
    return true as bool;
  } else if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.File_0_does_not_exist, fileName);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadNodeModuleFromDirectory","kind":"method","status":"implemented","sigHash":"764bba0cd650754a9d5b4afcde9c7dfa331052b75f50f3d2f184713176e499e0","bodyHash":"ecdb85f5faf475f81d8cf1135d33004aab4bd8c80bc8f0f736dbf5ec74ad0da3"}
 *
 * Go source:
 * func (r *resolutionState) loadNodeModuleFromDirectory(extensions extensions, candidate string, considerPackageJson bool) *resolved {
 * 	var packageInfo *packagejson.InfoCacheEntry
 * 	if considerPackageJson {
 * 		packageInfo = r.getPackageJsonInfo(candidate)
 * 	}
 * 
 * 	return r.loadNodeModuleFromDirectoryWorker(extensions, candidate, packageInfo)
 * }
 */
export function resolutionState_loadNodeModuleFromDirectory(receiver: GoPtr<resolutionState>, extensions: extensions, candidate: string, considerPackageJson: bool): GoPtr<resolved> {
  const packageInfo: GoPtr<InfoCacheEntry> = considerPackageJson ? resolutionState_getPackageJsonInfo(receiver, candidate) : undefined;
  return resolutionState_loadNodeModuleFromDirectoryWorker(receiver, extensions, candidate, packageInfo);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadNodeModuleFromDirectoryWorker","kind":"method","status":"implemented","sigHash":"73c24b14fe8974b190ac6935885e89d6893b9eacef8537905db30c4be7a66e74","bodyHash":"13b2e1c039d073cd30bfb956b301c773a18aac9bbdf8b296b2968842d06f9cc5"}
 *
 * Go source:
 * func (r *resolutionState) loadNodeModuleFromDirectoryWorker(ext extensions, candidate string, packageInfo *packagejson.InfoCacheEntry) *resolved {
 * 	var (
 * 		packageFile  string
 * 		versionPaths packagejson.VersionPaths
 * 	)
 * 	if packageInfo.Exists() {
 * 		versionPaths = packageInfo.Contents.GetVersionPaths(r.getTraceFunc())
 * 		if tspath.ComparePaths(candidate, packageInfo.PackageDirectory, tspath.ComparePathsOptions{UseCaseSensitiveFileNames: r.resolver.host.FS().UseCaseSensitiveFileNames()}) == 0 {
 * 			if file, ok := r.getPackageFile(ext, packageInfo); ok {
 * 				packageFile = file
 * 			}
 * 		}
 * 	}
 * 
 * 	loader := func(extensions extensions, candidate string) *resolved {
 * 		if fromFile := r.loadFileNameFromPackageJSONField(extensions, candidate, packageFile); !fromFile.shouldContinueSearching() {
 * 			return fromFile
 * 		}
 * 
 * 		// Even if `extensions == extensionsDeclaration`, we can still look up a .ts file as a result of package.json "types"
 * 		// !!! should we not set this before the filename lookup above?
 * 		expandedExtensions := extensions
 * 		if extensions == extensionsDeclaration {
 * 			expandedExtensions = extensionsTypeScript | extensionsDeclaration
 * 		}
 * 
 * 		// Disable `esmMode` for the resolution of the package path for CJS-mode packages (so the `main` field can omit extensions)
 * 		saveESMMode := r.esmMode
 * 		saveCandidateEndingIsFromConfig := r.candidateEndingIsFromConfig
 * 		r.candidateEndingIsFromConfig = true
 * 		if packageInfo.Exists() && packageInfo.Contents.Type.Value != "module" {
 * 			r.esmMode = false
 * 		}
 * 		result := r.nodeLoadModuleByRelativeName(expandedExtensions, candidate, false /*considerPackageJson* /)
 * 		r.esmMode = saveESMMode
 * 		r.candidateEndingIsFromConfig = saveCandidateEndingIsFromConfig
 * 		return result
 * 	}
 * 
 * 	var indexPath string
 * 	if r.isConfigLookup {
 * 		indexPath = tspath.CombinePaths(candidate, "tsconfig")
 * 	} else {
 * 		indexPath = tspath.CombinePaths(candidate, "index")
 * 	}
 * 
 * 	if versionPaths.Exists() && (packageFile == "" || tspath.ContainsPath(candidate, packageFile, tspath.ComparePathsOptions{})) {
 * 		var moduleName string
 * 		if packageFile != "" {
 * 			moduleName = tspath.GetRelativePathFromDirectory(candidate, packageFile, tspath.ComparePathsOptions{})
 * 		} else {
 * 			moduleName = tspath.GetRelativePathFromDirectory(candidate, indexPath, tspath.ComparePathsOptions{})
 * 		}
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.X_package_json_has_a_typesVersions_entry_0_that_matches_compiler_version_1_looking_for_a_pattern_to_match_module_name_2, versionPaths.Version, Version(), moduleName)
 * 		}
 * 		pathPatterns := TryParsePatterns(versionPaths.GetPaths())
 * 		if result := r.tryLoadModuleUsingPaths(ext, moduleName, candidate, versionPaths.GetPaths(), pathPatterns, loader); !result.shouldContinueSearching() {
 * 			if result.packageId.Name != "" {
 * 				// !!! are these asserts really necessary?
 * 				panic("expected packageId to be empty")
 * 			}
 * 			return result
 * 		}
 * 	}
 * 
 * 	if packageFile != "" {
 * 		if packageFileResult := loader(ext, packageFile); !packageFileResult.shouldContinueSearching() {
 * 			if packageFileResult.packageId.Name != "" {
 * 				// !!! are these asserts really necessary?
 * 				panic("expected packageId to be empty")
 * 			}
 * 			return packageFileResult
 * 		}
 * 	}
 * 
 * 	// ESM mode resolutions don't do package 'index' lookups
 * 	if !r.esmMode {
 * 		if !r.resolver.host.FS().DirectoryExists(candidate) {
 * 			return continueSearching()
 * 		}
 * 		return r.loadModuleFromFile(ext, indexPath)
 * 	}
 * 	return continueSearching()
 * }
 */
export function resolutionState_loadNodeModuleFromDirectoryWorker(receiver: GoPtr<resolutionState>, ext: extensions, candidate: string, packageInfo: GoPtr<InfoCacheEntry>): GoPtr<resolved> {
  let packageFile = "";
  let versionPaths: VersionPaths = { Version: "", pathsJSON: undefined, paths: undefined };
  if (InfoCacheEntry_Exists(packageInfo)) {
    const traceFunc = resolutionState_getTraceFunc(receiver) ?? ((_m: GoPtr<Message>, ..._args: Array<unknown>) => {});
    versionPaths = PackageJson_GetVersionPaths(packageInfo!.Contents, traceFunc);
    const comparePaths0: tspath.ComparePathsOptions = { UseCaseSensitiveFileNames: receiver!.resolver!.host.FS().UseCaseSensitiveFileNames() as bool, CurrentDirectory: "" };
    if (tspath.ComparePaths(candidate, packageInfo!.PackageDirectory, comparePaths0) === 0) {
      const [file, fileOk] = resolutionState_getPackageFile(receiver, ext, packageInfo);
      if (fileOk) {
        packageFile = file;
      }
    }
  }

  const loader = (loaderExtensions: extensions, loaderCandidate: string): GoPtr<resolved> => {
    const fromFile = resolutionState_loadFileNameFromPackageJSONField(receiver, loaderExtensions, loaderCandidate, packageFile);
    if (!resolved_shouldContinueSearching(fromFile)) {
      return fromFile;
    }

    const expandedExtensions = loaderExtensions === extensionsDeclaration
      ? extensionsTypeScript | extensionsDeclaration
      : loaderExtensions;

    const saveESMMode = receiver!.esmMode;
    const saveCandidateEndingIsFromConfig = receiver!.candidateEndingIsFromConfig;
    receiver!.candidateEndingIsFromConfig = true as bool;
    if (InfoCacheEntry_Exists(packageInfo) && packageJsonHeaderStringField(packageInfo!.Contents, "Type").Value !== "module") {
      receiver!.esmMode = false as bool;
    }
    const result = resolutionState_nodeLoadModuleByRelativeName(receiver, expandedExtensions, loaderCandidate, false as bool);
    receiver!.esmMode = saveESMMode;
    receiver!.candidateEndingIsFromConfig = saveCandidateEndingIsFromConfig;
    return result;
  };

  const indexPath = receiver!.isConfigLookup
    ? tspath.CombinePaths(candidate, "tsconfig")
    : tspath.CombinePaths(candidate, "index");

  const emptyComparePathsOptions: tspath.ComparePathsOptions = { UseCaseSensitiveFileNames: false as bool, CurrentDirectory: "" };

  if (VersionPaths_Exists(versionPaths) && (packageFile === "" || tspath.ContainsPath(candidate, packageFile, emptyComparePathsOptions))) {
    const moduleName = packageFile !== ""
      ? tspath.GetRelativePathFromDirectory(candidate, packageFile, emptyComparePathsOptions)
      : tspath.GetRelativePathFromDirectory(candidate, indexPath, emptyComparePathsOptions);
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.X_package_json_has_a_typesVersions_entry_0_that_matches_compiler_version_1_looking_for_a_pattern_to_match_module_name_2, versionPaths.Version, Version(), moduleName);
    }
    const pathPatterns = TryParsePatterns(VersionPaths_GetPaths(versionPaths));
    const result = resolutionState_tryLoadModuleUsingPaths(receiver, ext, moduleName, candidate, VersionPaths_GetPaths(versionPaths), pathPatterns, loader);
    if (!resolved_shouldContinueSearching(result)) {
      if (result!.packageId.Name !== "") {
        throw new globalThis.Error("expected packageId to be empty");
      }
      return result;
    }
  }

  if (packageFile !== "") {
    const packageFileResult = loader(ext, packageFile);
    if (!resolved_shouldContinueSearching(packageFileResult)) {
      if (packageFileResult!.packageId.Name !== "") {
        throw new globalThis.Error("expected packageId to be empty");
      }
      return packageFileResult;
    }
  }

  if (!receiver!.esmMode) {
    if (!receiver!.resolver!.host.FS().DirectoryExists(candidate)) {
      return continueSearching();
    }
    return resolutionState_loadModuleFromFile(receiver, ext, indexPath);
  }
  return continueSearching();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadFileNameFromPackageJSONField","kind":"method","status":"implemented","sigHash":"d15c35ea8d1f1ceec0e0cff09ca5ed96f33e6e944f8002dc3fae1158d15e41a8","bodyHash":"14b16529eb573b10d0b362e76b83753e1160ab20445bf3230076b08bb4ff077e"}
 *
 * Go source:
 * func (r *resolutionState) loadFileNameFromPackageJSONField(extensions extensions, candidate string, packageJSONValue string) *resolved {
 * 	if extensions&extensionsTypeScript != 0 && tspath.HasImplementationTSFileExtension(candidate) || extensions&extensionsDeclaration != 0 && tspath.IsDeclarationFileName(candidate) {
 * 		if path, ok := r.tryFile(candidate); ok {
 * 			extension := tspath.TryExtractTSExtension(path)
 * 			// resolvedUsingTsExtension should be true when the pattern ends with * and the
 * 			// candidate file ends in a TS extension. This means the * matched a TS extension
 * 			// from the module specifier. For example:
 * 			// - import "pkg/foo.ts" with pattern "./*" -> true
 * 			// - import "pkg/foo.ts.omg" with pattern "./*.omg" -> true (star matched .ts)
 * 			// - import "pkg/foo" with pattern "./*.ts" -> false (extension in pattern, not specifier)
 * 			resolvedUsingTsExtension := strings.HasSuffix(packageJSONValue, "*") && extension != ""
 * 			return &resolved{
 * 				path:                     path,
 * 				extension:                extension,
 * 				resolvedUsingTsExtension: resolvedUsingTsExtension,
 * 			}
 * 		}
 * 		return continueSearching()
 * 	}
 * 
 * 	if r.isConfigLookup && extensions&extensionsJson != 0 && tspath.FileExtensionIs(candidate, tspath.ExtensionJson) {
 * 		if path, ok := r.tryFile(candidate); ok {
 * 			return &resolved{
 * 				path:      path,
 * 				extension: tspath.ExtensionJson,
 * 			}
 * 		}
 * 	}
 * 
 * 	return r.loadModuleFromFileNoImplicitExtensions(extensions, candidate)
 * }
 */
export function resolutionState_loadFileNameFromPackageJSONField(receiver: GoPtr<resolutionState>, extensions: extensions, candidate: string, packageJSONValue: string): GoPtr<resolved> {
  if (
    (extensions & extensionsTypeScript) !== 0 && extension.HasImplementationTSFileExtension(candidate) ||
    (extensions & extensionsDeclaration) !== 0 && extension.IsDeclarationFileName(candidate)
  ) {
    const [path, ok] = resolutionState_tryFile(receiver, candidate);
    if (ok) {
      const ext = extension.TryExtractTSExtension(path);
      const resolvedUsingTsExtension = (strings.HasSuffix(packageJSONValue, "*") && ext !== "") as bool;
      return {
        path: path,
        extension: ext,
        resolvedUsingTsExtension: resolvedUsingTsExtension,
        packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
        originalPath: "",
      };
    }
    return continueSearching();
  }

  if (receiver!.isConfigLookup && (extensions & extensionsJson) !== 0 && tspath.FileExtensionIs(candidate, extension.ExtensionJson)) {
    const [path, ok] = resolutionState_tryFile(receiver, candidate);
    if (ok) {
      return {
        path: path,
        extension: extension.ExtensionJson,
        resolvedUsingTsExtension: false as bool,
        packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
        originalPath: "",
      };
    }
  }

  return resolutionState_loadModuleFromFileNoImplicitExtensions(receiver, extensions, candidate);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getPackageFile","kind":"method","status":"implemented","sigHash":"bd28c9cf9c64604ba12992d39bf2c9a3392c770fa82fc4b89feb861f3d094bcd","bodyHash":"a3006865c07ad9f532b326cfd98a67eb4182c1600091d4cc40d1d884d852060c"}
 *
 * Go source:
 * func (r *resolutionState) getPackageFile(extensions extensions, packageInfo *packagejson.InfoCacheEntry) (string, bool) {
 * 	if !packageInfo.Exists() {
 * 		return "", false
 * 	}
 * 	if r.isConfigLookup {
 * 		return r.getPackageJSONPathField("tsconfig", &packageInfo.Contents.TSConfig, packageInfo.PackageDirectory)
 * 	}
 * 	if extensions&extensionsDeclaration != 0 {
 * 		if packageFile, ok := r.getPackageJSONPathField("typings", &packageInfo.Contents.Typings, packageInfo.PackageDirectory); ok {
 * 			return packageFile, ok
 * 		}
 * 		if packageFile, ok := r.getPackageJSONPathField("types", &packageInfo.Contents.Types, packageInfo.PackageDirectory); ok {
 * 			return packageFile, ok
 * 		}
 * 	}
 * 	if extensions&(extensionsImplementationFiles|extensionsDeclaration) != 0 {
 * 		return r.getPackageJSONPathField("main", &packageInfo.Contents.Main, packageInfo.PackageDirectory)
 * 	}
 * 	return "", false
 * }
 */
export function resolutionState_getPackageFile(receiver: GoPtr<resolutionState>, extensions: extensions, packageInfo: GoPtr<InfoCacheEntry>): [string, bool] {
  if (!InfoCacheEntry_Exists(packageInfo)) {
    return ["", false as bool];
  }
  if (receiver!.isConfigLookup) {
    return resolutionState_getPackageJSONPathField(receiver, "tsconfig", packageJsonPathStringField(packageInfo!.Contents, "TSConfig"), packageInfo!.PackageDirectory);
  }
  if ((extensions & extensionsDeclaration) !== 0) {
    const [typingsFile, typingsOk] = resolutionState_getPackageJSONPathField(receiver, "typings", packageJsonPathStringField(packageInfo!.Contents, "Typings"), packageInfo!.PackageDirectory);
    if (typingsOk) {
      return [typingsFile, typingsOk];
    }
    const [typesFile, typesOk] = resolutionState_getPackageJSONPathField(receiver, "types", packageJsonPathStringField(packageInfo!.Contents, "Types"), packageInfo!.PackageDirectory);
    if (typesOk) {
      return [typesFile, typesOk];
    }
  }
  if ((extensions & (extensionsImplementationFiles | extensionsDeclaration)) !== 0) {
    return resolutionState_getPackageJSONPathField(receiver, "main", packageJsonPathStringField(packageInfo!.Contents, "Main"), packageInfo!.PackageDirectory);
  }
  return ["", false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getPackageJsonInfo","kind":"method","status":"implemented","sigHash":"56447a469580d8a0fde408450f9b3ba9973023854fb0a054e81148b76f929984","bodyHash":"70c1216735d64e1393a35c9fa6d22c9c5e30ef3bf9b6b3a3d34dae2cc5dd2cdc"}
 *
 * Go source:
 * func (r *resolutionState) getPackageJsonInfo(packageDirectory string) *packagejson.InfoCacheEntry {
 * 	packageJsonPath := tspath.CombinePaths(packageDirectory, "package.json")
 * 
 * 	if existing := r.resolver.packageJsonInfoCache.Get(packageJsonPath); existing != nil {
 * 		if existing.Contents != nil {
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.File_0_exists_according_to_earlier_cached_lookups, packageJsonPath)
 * 			}
 * 			if existing.PackageDirectory == packageDirectory {
 * 				return existing
 * 			}
 * 			// https://github.com/microsoft/TypeScript/pull/50740
 * 			return &packagejson.InfoCacheEntry{
 * 				PackageDirectory: packageDirectory,
 * 				DirectoryExists:  true,
 * 				Contents:         existing.Contents,
 * 			}
 * 		} else {
 * 			if existing.DirectoryExists && r.tracer != nil {
 * 				r.tracer.write(diagnostics.File_0_does_not_exist_according_to_earlier_cached_lookups, packageJsonPath)
 * 			}
 * 			return nil
 * 		}
 * 	}
 * 
 * 	directoryExists := r.resolver.host.FS().DirectoryExists(packageDirectory)
 * 	if directoryExists && r.resolver.host.FS().FileExists(packageJsonPath) {
 * 		// Ignore error
 * 		contents, _ := r.resolver.host.FS().ReadFile(packageJsonPath)
 * 		packageJsonContent, err := packagejson.Parse([]byte(contents))
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Found_package_json_at_0, packageJsonPath)
 * 		}
 * 		result := &packagejson.InfoCacheEntry{
 * 			PackageDirectory: packageDirectory,
 * 			DirectoryExists:  true,
 * 			Contents: &packagejson.PackageJson{
 * 				Fields:    packageJsonContent,
 * 				Parseable: err == nil,
 * 			},
 * 		}
 * 		result = r.resolver.packageJsonInfoCache.Set(packageJsonPath, result)
 * 		return result
 * 	} else {
 * 		if directoryExists && r.tracer != nil {
 * 			r.tracer.write(diagnostics.File_0_does_not_exist, packageJsonPath)
 * 		}
 * 		_ = r.resolver.packageJsonInfoCache.Set(packageJsonPath, &packagejson.InfoCacheEntry{
 * 			PackageDirectory: packageDirectory,
 * 			DirectoryExists:  directoryExists,
 * 		})
 * 	}
 * 	return nil
 * }
 */
export function resolutionState_getPackageJsonInfo(receiver: GoPtr<resolutionState>, packageDirectory: string): GoPtr<InfoCacheEntry> {
  const packageJsonPath = tspath.CombinePaths(packageDirectory, "package.json");

  const existing = InfoCache_Get(receiver!.resolver!.__tsgoEmbedded0!.packageJsonInfoCache, packageJsonPath);
  if (existing !== undefined) {
    if (existing.Contents !== undefined) {
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.File_0_exists_according_to_earlier_cached_lookups, packageJsonPath);
      }
      if (existing.PackageDirectory === packageDirectory) {
        return existing;
      }
      return {
        PackageDirectory: packageDirectory,
        DirectoryExists: true as bool,
        Contents: existing.Contents,
      };
    } else {
      if (existing.DirectoryExists && receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.File_0_does_not_exist_according_to_earlier_cached_lookups, packageJsonPath);
      }
      return undefined;
    }
  }

  const directoryExists = receiver!.resolver!.host.FS().DirectoryExists(packageDirectory);
  if (directoryExists && receiver!.resolver!.host.FS().FileExists(packageJsonPath)) {
    const [contents] = receiver!.resolver!.host.FS().ReadFile(packageJsonPath);
    const contentsBytes = Array.from(new globalThis.TextEncoder().encode(contents)) as GoSlice<number>;
    const [packageJsonContent, err] = ParsePackageJson(contentsBytes);
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Found_package_json_at_0, packageJsonPath);
    }
    const result: InfoCacheEntry = {
      PackageDirectory: packageDirectory,
      DirectoryExists: true as bool,
      Contents: {
        __tsgoEmbedded0: packageJsonContent,
        Parseable: (err === undefined) as bool,
        versionPaths: { Version: "", pathsJSON: undefined, paths: undefined },
        versionTraces: [],
        once: new Once(),
      },
    };
    return InfoCache_Set(receiver!.resolver!.__tsgoEmbedded0!.packageJsonInfoCache, packageJsonPath, result);
  } else {
    if (directoryExists && receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.File_0_does_not_exist, packageJsonPath);
    }
    InfoCache_Set(receiver!.resolver!.__tsgoEmbedded0!.packageJsonInfoCache, packageJsonPath, {
      PackageDirectory: packageDirectory,
      DirectoryExists: directoryExists as bool,
      Contents: undefined,
    });
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getPackageId","kind":"method","status":"implemented","sigHash":"f96609b41e139b2539bfd67149cf34f348801bb06b0b3dcf48b5b1fdb77e0737","bodyHash":"73a07a59c85db925279337caae377b11899cb6586e479966de0f2825778fa820"}
 *
 * Go source:
 * func (r *resolutionState) getPackageId(resolvedFileName string, packageInfo *packagejson.InfoCacheEntry) PackageId {
 * 	if packageInfo.Exists() {
 * 		packageJsonContent := packageInfo.Contents
 * 		if name, ok := packageJsonContent.Name.GetValue(); ok {
 * 			if version, ok := packageJsonContent.Version.GetValue(); ok {
 * 				var subModuleName string
 * 				if len(resolvedFileName) > len(packageInfo.PackageDirectory) {
 * 					subModuleName = resolvedFileName[len(packageInfo.PackageDirectory)+1:]
 * 				}
 * 				return PackageId{
 * 					Name:             name,
 * 					Version:          version,
 * 					SubModuleName:    subModuleName,
 * 					PeerDependencies: r.readPackageJsonPeerDependencies(packageInfo),
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return PackageId{}
 * }
 */
export function resolutionState_getPackageId(receiver: GoPtr<resolutionState>, resolvedFileName: string, packageInfo: GoPtr<InfoCacheEntry>): PackageId {
  if (InfoCacheEntry_Exists(packageInfo)) {
    const packageJsonContent = packageInfo!.Contents;
    const [name, nameOk] = Expected_GetValue<string>(packageJsonHeaderStringField(packageJsonContent, "Name"));
    if (nameOk) {
      const [ver, verOk] = Expected_GetValue<string>(packageJsonHeaderStringField(packageJsonContent, "Version"));
      if (verOk) {
        const subModuleName = resolvedFileName.length > packageInfo!.PackageDirectory.length
          ? resolvedFileName.slice(packageInfo!.PackageDirectory.length + 1)
          : "";
        return {
          Name: name,
          Version: ver,
          SubModuleName: subModuleName,
          PeerDependencies: resolutionState_readPackageJsonPeerDependencies(receiver, packageInfo),
        };
      }
    }
  }
  return { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.readPackageJsonPeerDependencies","kind":"method","status":"implemented","sigHash":"4d7df9610521a46b180ff58d318ba87a911e2f40e84bd4bf2d3630774beb2aa1","bodyHash":"ef23105ce4d2954bc7f3ebaeb7a51f7d6956eeb703afe03578631708dcc72232"}
 *
 * Go source:
 * func (r *resolutionState) readPackageJsonPeerDependencies(packageJsonInfo *packagejson.InfoCacheEntry) string {
 * 	peerDependencies := packageJsonInfo.Contents.PeerDependencies
 * 	ok := r.validatePackageJSONField("peerDependencies", &peerDependencies)
 * 	if !ok || len(peerDependencies.Value) == 0 {
 * 		return ""
 * 	}
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.X_package_json_has_a_peerDependencies_field)
 * 	}
 * 	packageDirectory := r.realPath(packageJsonInfo.PackageDirectory)
 * 	nodeModulesIndex := strings.LastIndex(packageDirectory, "/node_modules")
 * 	if nodeModulesIndex == -1 {
 * 		return ""
 * 	}
 * 	nodeModules := packageDirectory[:nodeModulesIndex+len("/node_modules")] + "/"
 * 	names := slices.AppendSeq(make([]string, 0, len(peerDependencies.Value)), maps.Keys(peerDependencies.Value))
 * 	slices.Sort(names)
 * 	builder := strings.Builder{}
 * 	for _, name := range names {
 * 		peerPackageJson := r.getPackageJsonInfo(nodeModules + name)
 * 		if peerPackageJson != nil {
 * 			version := peerPackageJson.Contents.Version.Value
 * 			builder.WriteString("+")
 * 			builder.WriteString(name)
 * 			builder.WriteString("@")
 * 			builder.WriteString(version)
 * 			if r.tracer != nil {
 * 				r.tracer.write(diagnostics.Found_peerDependency_0_with_1_version, name, version)
 * 			}
 * 		} else if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Failed_to_find_peerDependency_0, name)
 * 		}
 * 	}
 * 	return builder.String()
 * }
 */
export function resolutionState_readPackageJsonPeerDependencies(receiver: GoPtr<resolutionState>, packageJsonInfo: GoPtr<InfoCacheEntry>): string {
  const peerDependencies = packageJsonDependencyMapField(packageJsonInfo!.Contents, "PeerDependencies");
  const ok = resolutionState_validatePackageJSONField(receiver, "peerDependencies", peerDependencies);
  if (!ok || !Expected_IsValid(peerDependencies) || (peerDependencies.Value?.size ?? 0) === 0) {
    return "";
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.X_package_json_has_a_peerDependencies_field);
  }
  const packageDirectory = resolutionState_realPath(receiver, packageJsonInfo!.PackageDirectory);
  const nodeModulesIndex = strings.LastIndex(packageDirectory, "/node_modules");
  if (nodeModulesIndex === -1) {
    return "";
  }
  const nodeModules = packageDirectory.slice(0, nodeModulesIndex + "/node_modules".length) + "/";
  const names: GoSlice<string> = [];
  maps.Keys<string, string>(peerDependencies.Value!)((key: string): bool => {
    names.push(key);
    return true as bool;
  });
  slices.Sort(names);
  let builder = "";
  for (const name of names) {
    const peerPackageJson = resolutionState_getPackageJsonInfo(receiver, nodeModules + name);
    if (peerPackageJson !== undefined) {
      const version = packageJsonHeaderStringField(peerPackageJson.Contents, "Version").Value;
      builder += "+" + name + "@" + version;
      if (receiver!.tracer !== undefined) {
        tracer_write(receiver!.tracer, diagnostics.Found_peerDependency_0_with_1_version, name, version);
      }
    } else if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Failed_to_find_peerDependency_0, name);
    }
  }
  return builder;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.realPath","kind":"method","status":"implemented","sigHash":"bb1dbf6aae33c2c47fb71d22225b3f0d474fbbb3e536570f3909d5696b4ecd17","bodyHash":"ef51484cdbc9aba63a6d5cecf577d245b92db3fed0678e32e76bc3456232f9a8"}
 *
 * Go source:
 * func (r *resolutionState) realPath(path string) string {
 * 	rp := tspath.NormalizePath(r.resolver.host.FS().Realpath(path))
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.Resolving_real_path_for_0_result_1, path, rp)
 * 	}
 * 	return rp
 * }
 */
export function resolutionState_realPath(receiver: GoPtr<resolutionState>, path: string): string {
  const rp = tspath.NormalizePath(receiver!.resolver!.host.FS().Realpath(path));
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.Resolving_real_path_for_0_result_1, path, rp);
  }
  return rp;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.validatePackageJSONField","kind":"method","status":"implemented","sigHash":"68ade9e57af6b8b0a247eb042ca8cd98fa320a23fa94b7666589e8794711d3f9","bodyHash":"9bad963fb65a63896c6c8564889e6b187a8a1f5a1868bfaea9dc38cee2871b24"}
 *
 * Go source:
 * func (r *resolutionState) validatePackageJSONField(fieldName string, field packagejson.TypeValidatedField) bool {
 * 	if field.IsPresent() {
 * 		if field.IsValid() {
 * 			return true
 * 		}
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.Expected_type_of_0_field_in_package_json_to_be_1_got_2, fieldName, field.ExpectedJSONType(), field.ActualJSONType())
 * 		}
 * 	}
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.X_package_json_does_not_have_a_0_field, fieldName)
 * 	}
 * 	return false
 * }
 */
export function resolutionState_validatePackageJSONField(receiver: GoPtr<resolutionState>, fieldName: string, field: Expected<unknown>): bool {
  if (Expected_IsPresent(field)) {
    if (Expected_IsValid(field)) {
      return true as bool;
    }
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.Expected_type_of_0_field_in_package_json_to_be_1_got_2, fieldName, Expected_ExpectedJSONType(field), Expected_ActualJSONType(field));
    }
  }
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.X_package_json_does_not_have_a_0_field, fieldName);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getPackageJSONPathField","kind":"method","status":"implemented","sigHash":"afc761cb197f7f170b108816418ad347b6a704db8d18403a5ee043e675b941a8","bodyHash":"5008587684a6b6e35feeefb759e8fdc24f6413fec386d6c9171a0ae7d1c5de99"}
 *
 * Go source:
 * func (r *resolutionState) getPackageJSONPathField(fieldName string, field *packagejson.Expected[string], directory string) (string, bool) {
 * 	if !r.validatePackageJSONField(fieldName, field) {
 * 		return "", false
 * 	}
 * 	if field.Value == "" {
 * 		if r.tracer != nil {
 * 			r.tracer.write(diagnostics.X_package_json_had_a_falsy_0_field, fieldName)
 * 		}
 * 		return "", false
 * 	}
 * 	path := tspath.NormalizePath(tspath.CombinePaths(directory, field.Value))
 * 	if r.tracer != nil {
 * 		r.tracer.write(diagnostics.X_package_json_has_0_field_1_that_references_2, fieldName, field.Value, path)
 * 	}
 * 	return path, true
 * }
 */
export function resolutionState_getPackageJSONPathField(receiver: GoPtr<resolutionState>, fieldName: string, field: GoPtr<Expected<string>>, directory: string): [string, bool] {
  if (!resolutionState_validatePackageJSONField(receiver, fieldName, field!)) {
    return ["", false as bool];
  }
  if (field!.Value === "") {
    if (receiver!.tracer !== undefined) {
      tracer_write(receiver!.tracer, diagnostics.X_package_json_had_a_falsy_0_field, fieldName);
    }
    return ["", false as bool];
  }
  const path = tspath.NormalizePath(tspath.CombinePaths(directory, field!.Value));
  if (receiver!.tracer !== undefined) {
    tracer_write(receiver!.tracer, diagnostics.X_package_json_has_0_field_1_that_references_2, fieldName, field!.Value, path);
  }
  return [path, true as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.conditionMatches","kind":"method","status":"implemented","sigHash":"7a5d8143bed3636828a19ef6b0945c6d1453da979b6912a709f3551f52a9712b","bodyHash":"6694472e44aaaa056b52b6fa4a5edcd39f59b97856f3e5377b0e4674ca2045ad"}
 *
 * Go source:
 * func (r *resolutionState) conditionMatches(condition string) bool {
 * 	if condition == "default" || slices.Contains(r.conditions, condition) {
 * 		return true
 * 	}
 * 	if !slices.Contains(r.conditions, "types") {
 * 		return false // only apply versioned types conditions if the types condition is applied
 * 	}
 * 	return IsApplicableVersionedTypesKey(condition)
 * }
 */
export function resolutionState_conditionMatches(receiver: GoPtr<resolutionState>, condition: string): bool {
  if (condition === "default" || slices.Contains(receiver!.conditions, condition)) {
    return true as bool;
  }
  if (!slices.Contains(receiver!.conditions, "types")) {
    return false as bool;
  }
  return IsApplicableVersionedTypesKey(condition);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getTraceFunc","kind":"method","status":"implemented","sigHash":"54a05fda62e771ede480e80053ecfe22f558b755693a7515d0fb946105bc9554","bodyHash":"81c380433b36bce8f5f6a3639413e509edcb5cb0389e592af623d0bb8190dbc5"}
 *
 * Go source:
 * func (r *resolutionState) getTraceFunc() func(m *diagnostics.Message, args ...any) {
 * 	if r.tracer != nil {
 * 		return r.tracer.write
 * 	}
 * 	return nil
 * }
 */
export function resolutionState_getTraceFunc(receiver: GoPtr<resolutionState>): GoPtr<(m: GoPtr<Message>, ...args: Array<unknown>) => void> {
  if (receiver!.tracer !== undefined) {
    return (m: GoPtr<Message>, ...args: Array<unknown>) => tracer_write(receiver!.tracer, m, ...args);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::GetConditions","kind":"func","status":"implemented","sigHash":"65178bd78660a363c4d07323d25811eb301b35f39f66188b8e2fa73d2eff4bbd","bodyHash":"1d8accccb555ec3599d0a0cbd9e4c4fbe03025fa11a0263023b0f96ea774fe72"}
 *
 * Go source:
 * func GetConditions(options *core.CompilerOptions, resolutionMode core.ResolutionMode) []string {
 * 	moduleResolution := options.GetModuleResolutionKind()
 * 	if resolutionMode == core.ModuleKindNone && moduleResolution == core.ModuleResolutionKindBundler {
 * 		resolutionMode = core.ModuleKindESNext
 * 	}
 * 	conditions := make([]string, 0, 3+len(options.CustomConditions))
 * 	if resolutionMode == core.ModuleKindESNext {
 * 		conditions = append(conditions, "import")
 * 	} else {
 * 		conditions = append(conditions, "require")
 * 	}
 * 
 * 	if options.NoDtsResolution != core.TSTrue {
 * 		conditions = append(conditions, "types")
 * 	}
 * 	if moduleResolution != core.ModuleResolutionKindBundler {
 * 		conditions = append(conditions, "node")
 * 	}
 * 	conditions = core.Concatenate(conditions, options.CustomConditions)
 * 	return conditions
 * }
 */
export function GetConditions(options: GoPtr<CompilerOptions>, resolutionMode: ResolutionMode): GoSlice<string> {
  const moduleResolution = CompilerOptions_GetModuleResolutionKind(options);
  if (resolutionMode === ModuleKindNone && moduleResolution === ModuleResolutionKindBundler) {
    resolutionMode = ModuleKindESNext;
  }
  const conditions: GoSlice<string> = [];
  if (resolutionMode === ModuleKindESNext) {
    conditions.push("import");
  } else {
    conditions.push("require");
  }

  if (options!.NoDtsResolution !== TSTrue) {
    conditions.push("types");
  }
  if (moduleResolution !== ModuleResolutionKindBundler) {
    conditions.push("node");
  }
  return core.Concatenate(conditions, options!.CustomConditions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::getNodeResolutionFeatures","kind":"func","status":"implemented","sigHash":"ab5a7796ed0ea24ba41cd21f46450a3c8d700c0eba149dffbeb654f0f291a55b","bodyHash":"8631367b045471d22eb9a4746314ce9293ec72bc0053ed67c796cc98b9fae765"}
 *
 * Go source:
 * func getNodeResolutionFeatures(options *core.CompilerOptions) NodeResolutionFeatures {
 * 	features := NodeResolutionFeaturesNone
 * 
 * 	switch options.GetModuleResolutionKind() {
 * 	case core.ModuleResolutionKindNode16:
 * 		features = NodeResolutionFeaturesNode16Default
 * 	case core.ModuleResolutionKindNodeNext:
 * 		features = NodeResolutionFeaturesNodeNextDefault
 * 	case core.ModuleResolutionKindBundler:
 * 		features = NodeResolutionFeaturesBundlerDefault
 * 	}
 * 	if options.ResolvePackageJsonExports == core.TSTrue {
 * 		features |= NodeResolutionFeaturesExports
 * 	} else if options.ResolvePackageJsonExports == core.TSFalse {
 * 		features &^= NodeResolutionFeaturesExports
 * 	}
 * 	if options.ResolvePackageJsonImports == core.TSTrue {
 * 		features |= NodeResolutionFeaturesImports
 * 	} else if options.ResolvePackageJsonImports == core.TSFalse {
 * 		features &^= NodeResolutionFeaturesImports
 * 	}
 * 	return features
 * }
 */
export function getNodeResolutionFeatures(options: GoPtr<CompilerOptions>): NodeResolutionFeatures {
  let features = NodeResolutionFeaturesNone;

  switch (CompilerOptions_GetModuleResolutionKind(options)) {
    case ModuleResolutionKindNode16:
      features = NodeResolutionFeaturesNode16Default;
      break;
    case ModuleResolutionKindNodeNext:
      features = NodeResolutionFeaturesNodeNextDefault;
      break;
    case ModuleResolutionKindBundler:
      features = NodeResolutionFeaturesBundlerDefault;
      break;
  }
  if (options!.ResolvePackageJsonExports === TSTrue) {
    features |= NodeResolutionFeaturesExports;
  } else if (options!.ResolvePackageJsonExports === TSFalse) {
    features &= ~NodeResolutionFeaturesExports;
  }
  if (options!.ResolvePackageJsonImports === TSTrue) {
    features |= NodeResolutionFeaturesImports;
  } else if (options!.ResolvePackageJsonImports === TSFalse) {
    features &= ~NodeResolutionFeaturesImports;
  }
  return features;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::moveToNextDirectorySeparatorIfAvailable","kind":"func","status":"implemented","sigHash":"83592ca47dfcd1364431d2eab9b41e91b14d2a443a6f8acb191683a94ae59695","bodyHash":"fb1c8bd226b687854a18a20a5cdc6c9441582ae5cea3268b2b1caf5db906bf6d"}
 *
 * Go source:
 * func moveToNextDirectorySeparatorIfAvailable(path string, prevSeparatorIndex int, isFolder bool) int {
 * 	offset := prevSeparatorIndex + 1
 * 	nextSeparatorIndex := strings.Index(path[offset:], "/")
 * 	if nextSeparatorIndex == -1 {
 * 		if isFolder {
 * 			return len(path)
 * 		}
 * 		return prevSeparatorIndex
 * 	}
 * 	return nextSeparatorIndex + offset
 * }
 */
export function moveToNextDirectorySeparatorIfAvailable(path: string, prevSeparatorIndex: int, isFolder: bool): int {
  const offset = prevSeparatorIndex + 1;
  const nextSeparatorIndex = strings.Index(path.slice(offset), "/");
  if (nextSeparatorIndex === -1) {
    if (isFolder) {
      return path.length;
    }
    return prevSeparatorIndex;
  }
  return nextSeparatorIndex + offset;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::ParsedPatterns","kind":"type","status":"implemented","sigHash":"7b099bf1880e095ce74a693d1644647fa9dc076f061682449eba2d08965b1d7e","bodyHash":"f6a94743a61fae15f5f43c52ae960a58d95eabbeb7232aa66d066dc2c4adda08"}
 *
 * Go source:
 * ParsedPatterns struct {
 * 	matchableStringSet collections.Set[string]
 * 	patterns           []core.Pattern
 * }
 */
export interface ParsedPatterns {
  matchableStringSet: Set;
  patterns: GoSlice<Pattern>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.getParsedPatternsForPaths","kind":"method","status":"implemented","sigHash":"f0d69059b635594a8dfafc9d99ab53e007155a23b3ef65c3fa2fa4d9964a2af6","bodyHash":"267b0218b388c74dbe21da13c9aeeac71f9c6e3596aa8d6a43c5c1db3b371af0"}
 *
 * Go source:
 * func (r *Resolver) getParsedPatternsForPaths() *ParsedPatterns {
 * 	r.parsedPatternsForPathsOnce.Do(func() {
 * 		r.parsedPatternsForPaths = TryParsePatterns(r.compilerOptions.Paths)
 * 	})
 * 	return r.parsedPatternsForPaths
 * }
 */
export function Resolver_getParsedPatternsForPaths(receiver: GoPtr<Resolver>): GoPtr<ParsedPatterns> {
  receiver!.parsedPatternsForPathsOnce.Do(() => {
    receiver!.parsedPatternsForPaths = TryParsePatterns(receiver!.compilerOptions!.Paths);
  });
  return receiver!.parsedPatternsForPaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::TryParsePatterns","kind":"func","status":"implemented","sigHash":"d400bcee989ae4b179f68d0dc0b0d0fed02cc5932e98c63bb547e4a5095433e4","bodyHash":"72f3ea4842270a43e9de093244a2278dbe905ccd8f38f5a6a2a03341982392e2"}
 *
 * Go source:
 * func TryParsePatterns(pathMappings *collections.OrderedMap[string, []string]) *ParsedPatterns {
 * 	paths := pathMappings.Keys()
 * 
 * 	numPatterns := 0
 * 	for path := range paths {
 * 		if pattern := core.TryParsePattern(path); pattern.IsValid() && pattern.StarIndex == -1 {
 * 			numPatterns++
 * 		}
 * 	}
 * 	numMatchables := pathMappings.Size() - numPatterns
 * 
 * 	var patterns []core.Pattern
 * 	var matchableStringSet collections.Set[string]
 * 	if numPatterns != 0 {
 * 		patterns = make([]core.Pattern, 0, numPatterns)
 * 	}
 * 	if numMatchables != 0 {
 * 		matchableStringSet = *collections.NewSetWithSizeHint[string](numMatchables)
 * 	}
 * 
 * 	for path := range paths {
 * 		if pattern := core.TryParsePattern(path); pattern.IsValid() {
 * 			if pattern.StarIndex == -1 {
 * 				matchableStringSet.Add(path)
 * 			} else {
 * 				patterns = append(patterns, pattern)
 * 			}
 * 		}
 * 	}
 * 	return &ParsedPatterns{
 * 		matchableStringSet: matchableStringSet,
 * 		patterns:           patterns,
 * 	}
 * }
 */
export function TryParsePatterns(pathMappings: GoPtr<OrderedMap>): GoPtr<ParsedPatterns> {
  if (pathMappings === undefined) {
    return { matchableStringSet: NewSetWithSizeHint<string>(0)!, patterns: [] };
  }
  const typedMappings = pathMappings as GoPtr<OrderedMap<string, GoSlice<string>>>;
  // Count patterns (wildcard) vs matchables (exact)
  let numPatterns = 0;
  OrderedMap_Keys<string, GoSlice<string>>(typedMappings)((p: string): bool => {
    const pattern = TryParsePattern(p);
    if (Pattern_IsValid(pattern) && pattern.StarIndex === -1) {
      numPatterns++;
    }
    return true;
  });
  const numMatchables = OrderedMap_Size(typedMappings) - numPatterns;

  const patterns: GoSlice<Pattern> = [];
  const matchableStringSet: Set<string> = NewSetWithSizeHint<string>(numMatchables)!;

  OrderedMap_Keys<string, GoSlice<string>>(typedMappings)((p: string): bool => {
    const pattern = TryParsePattern(p);
    if (Pattern_IsValid(pattern)) {
      if (pattern.StarIndex === -1) {
        Set_Add(matchableStringSet, p);
      } else {
        patterns.push(pattern);
      }
    }
    return true;
  });

  return {
    matchableStringSet: matchableStringSet,
    patterns: patterns,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::MatchPatternOrExact","kind":"func","status":"implemented","sigHash":"5cb75b429bad3e1e27a6d3375b57570ca554379ace8bfb88a8356da1cdecf9d7","bodyHash":"cdf59d9a5e4a4297232a3ccce1797936d66b5cf9abb2dd3d63dacf9aec34717e"}
 *
 * Go source:
 * func MatchPatternOrExact(patterns *ParsedPatterns, candidate string) core.Pattern {
 * 	if patterns.matchableStringSet.Has(candidate) {
 * 		return core.Pattern{
 * 			Text:      candidate,
 * 			StarIndex: -1,
 * 		}
 * 	}
 * 	if len(patterns.patterns) == 0 {
 * 		return core.Pattern{}
 * 	}
 * 	return core.FindBestPatternMatch(patterns.patterns, core.Identity, candidate)
 * }
 */
export function MatchPatternOrExact(patterns: GoPtr<ParsedPatterns>, candidate: string): Pattern {
  if (Set_Has(patterns!.matchableStringSet, candidate)) {
    return { Text: candidate, StarIndex: -1 };
  }
  if ((patterns!.patterns?.length ?? 0) === 0) {
    return { Text: "", StarIndex: 0 };
  }
  // Go instantiates FindBestPatternMatch with T=core.Pattern, whose zero value is
  // Pattern{} (StarIndex 0, empty Text) — IsValid() false — not nil.
  return FindBestPatternMatch(patterns!.patterns, (v: Pattern) => v, candidate) ?? { Text: "", StarIndex: 0 };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::normalizePathForCJSResolution","kind":"func","status":"implemented","sigHash":"91e02672c2d3688447a9d98679fe489c0a037bd570eec9f29cc8c2e79a8ff9a4","bodyHash":"b67b7312247b142bf898e270763801ebe93dca4a394f160fa03e0303dba8c7f2"}
 *
 * Go source:
 * func normalizePathForCJSResolution(containingDirectory string, moduleName string) string {
 * 	combined := tspath.CombinePaths(containingDirectory, moduleName)
 * 	parts := tspath.GetPathComponents(combined, "")
 * 	lastPart := parts[len(parts)-1]
 * 	if lastPart == "." || lastPart == ".." {
 * 		return tspath.EnsureTrailingDirectorySeparator(tspath.NormalizePath(combined))
 * 	}
 * 	return tspath.NormalizePath(combined)
 * }
 */
export function normalizePathForCJSResolution(containingDirectory: string, moduleName: string): string {
  const combined = tspath.CombinePaths(containingDirectory, moduleName);
  const parts = tspath.GetPathComponents(combined, "");
  const lastPart = parts[parts.length - 1];
  if (lastPart === "." || lastPart === "..") {
    return tspath.EnsureTrailingDirectorySeparator(tspath.NormalizePath(combined));
  }
  return tspath.NormalizePath(combined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::matchesPatternWithTrailer","kind":"func","status":"implemented","sigHash":"36c762b44ceb5507020e0bbc79f9299bccc79b053ac5b3325c3b76009abce3c0","bodyHash":"2a49039b33b665da60a154f71fb3553daf59f56adcedf19cfeff59c30ac4405e"}
 *
 * Go source:
 * func matchesPatternWithTrailer(target string, name string) bool {
 * 	if strings.HasSuffix(target, "*") {
 * 		return false
 * 	}
 * 	before, after, ok := strings.Cut(target, "*")
 * 	if !ok {
 * 		return false
 * 	}
 * 	return strings.HasPrefix(name, before) && strings.HasSuffix(name, after)
 * }
 */
export function matchesPatternWithTrailer(target: string, name: string): bool {
  if (strings.HasSuffix(target, "*")) {
    return false as bool;
  }
  const [before, after, ok] = strings.Cut(target, "*");
  if (!ok) {
    return false as bool;
  }
  return (strings.HasPrefix(name, before) && strings.HasSuffix(name, after)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::extensionIsOk","kind":"func","status":"implemented","sigHash":"af3fd7a2dc2b832a72fefad5ae6c7b587e57fcb9e9e501bbc77eaada6b5907b4","bodyHash":"2aa434cf90121e80fb001465ea1ebaa279ff5a62d0cb8954dd0f41f1871ae639"}
 *
 * Go source:
 * func extensionIsOk(extensions extensions, extension string) bool {
 * 	return (extensions&extensionsJavaScript != 0 && (extension == tspath.ExtensionJs || extension == tspath.ExtensionJsx || extension == tspath.ExtensionMjs || extension == tspath.ExtensionCjs) ||
 * 		(extensions&extensionsTypeScript != 0 && (extension == tspath.ExtensionTs || extension == tspath.ExtensionTsx || extension == tspath.ExtensionMts || extension == tspath.ExtensionCts)) ||
 * 		(extensions&extensionsDeclaration != 0 && (extension == tspath.ExtensionDts || extension == tspath.ExtensionDmts || extension == tspath.ExtensionDcts)) ||
 * 		(extensions&extensionsJson != 0 && extension == tspath.ExtensionJson))
 * }
 */
export function extensionIsOk(extensions: extensions, ext: string): bool {
  return (
    ((extensions & extensionsJavaScript) !== 0 && (ext === extension.ExtensionJs || ext === extension.ExtensionJsx || ext === extension.ExtensionMjs || ext === extension.ExtensionCjs)) ||
    ((extensions & extensionsTypeScript) !== 0 && (ext === extension.ExtensionTs || ext === extension.ExtensionTsx || ext === extension.ExtensionMts || ext === extension.ExtensionCts)) ||
    ((extensions & extensionsDeclaration) !== 0 && (ext === extension.ExtensionDts || ext === extension.ExtensionDmts || ext === extension.ExtensionDcts)) ||
    ((extensions & extensionsJson) !== 0 && ext === extension.ExtensionJson)
  ) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::ResolveConfig","kind":"func","status":"implemented","sigHash":"dc902a88d54806a8428fe3c7c600587b585e34378eed8b4dd0fddab1967aa1ae","bodyHash":"eaa8d6bfe344383813c37142fc055e201ac2e42ac9929d2b8dbfb8a2889d0933"}
 *
 * Go source:
 * func ResolveConfig(moduleName string, containingFile string, host ResolutionHost) *ResolvedModule {
 * 	resolver := NewResolver(host, &core.CompilerOptions{ModuleResolution: core.ModuleResolutionKindNodeNext}, "", "")
 * 	return resolver.resolveConfig(moduleName, containingFile)
 * }
 */
export function ResolveConfig(moduleName: string, containingFile: string, host: ResolutionHost): GoPtr<ResolvedModule> {
  const resolver = NewResolver(host, { ModuleResolution: ModuleResolutionKindNodeNext } as GoPtr<CompilerOptions>, "", "");
  return Resolver_resolveConfig(resolver, moduleName, containingFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::func::GetAutomaticTypeDirectiveNames","kind":"func","status":"implemented","sigHash":"f9a33ffd88dcaeb557d662d596d969d01a48f3a7d1f38d4c7ba60f4066b194e7","bodyHash":"7679d56f2dd8acf2a1896f4e5c615649646e838c81ac2101b26b24cf60ef845e"}
 *
 * Go source:
 * func GetAutomaticTypeDirectiveNames(options *core.CompilerOptions, host ResolutionHost) []string {
 * 	if !options.UsesWildcardTypes() {
 * 		if options.Types != nil {
 * 			return options.Types
 * 		}
 * 		return []string{}
 * 	}
 * 
 * 	// Walk the primary type lookup locations
 * 	var wildcardMatches []string
 * 	typeRoots, _ := options.GetEffectiveTypeRoots(host.GetCurrentDirectory())
 * 	for _, root := range typeRoots {
 * 		if host.FS().DirectoryExists(root) {
 * 			for _, typeDirectivePath := range host.FS().GetAccessibleEntries(root).Directories {
 * 				normalized := tspath.NormalizePath(typeDirectivePath)
 * 				packageJsonPath := tspath.CombinePaths(root, normalized, "package.json")
 * 				isNotNeededPackage := false
 * 				if host.FS().FileExists(packageJsonPath) {
 * 					contents, _ := host.FS().ReadFile(packageJsonPath)
 * 					packageJsonContent, _ := packagejson.Parse([]byte(contents))
 * 					// `types-publisher` sometimes creates packages with `"typings": null` for packages that don't provide their own types.
 * 					// See `createNotNeededPackageJSON` in the types-publisher` repo.
 * 					isNotNeededPackage = packageJsonContent.Typings.Null
 * 				}
 * 				if !isNotNeededPackage {
 * 					baseFileName := tspath.GetBaseFileName(normalized)
 * 					if !strings.HasPrefix(baseFileName, ".") {
 * 						wildcardMatches = append(wildcardMatches, baseFileName)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	// Order potentially matters in program construction, so substitute
 * 	// in the wildcard in the position it was specified in the types array
 * 	var result []string
 * 	for _, t := range options.Types {
 * 		if t == "*" {
 * 			result = append(result, wildcardMatches...)
 * 		} else {
 * 			result = append(result, t)
 * 		}
 * 	}
 * 	return core.Deduplicate(result)
 * }
 */
export function GetAutomaticTypeDirectiveNames(options: GoPtr<CompilerOptions>, host: ResolutionHost): GoSlice<string> {
  if (!CompilerOptions_UsesWildcardTypes(options)) {
    if (options!.Types !== undefined) {
      return options!.Types;
    }
    return [];
  }

  const wildcardMatches: GoSlice<string> = [];
  const [typeRoots] = CompilerOptions_GetEffectiveTypeRoots(options, host.GetCurrentDirectory());
  for (const root of (typeRoots ?? [])) {
    if (host.FS().DirectoryExists(root)) {
      for (const typeDirectivePath of host.FS().GetAccessibleEntries(root).Directories) {
        const normalized = tspath.NormalizePath(typeDirectivePath);
        const packageJsonPath = tspath.CombinePaths(root, normalized, "package.json");
        let isNotNeededPackage = false;
        if (host.FS().FileExists(packageJsonPath)) {
          const [contents] = host.FS().ReadFile(packageJsonPath);
          const contentsBytes = Array.from(new globalThis.TextEncoder().encode(contents)) as GoSlice<number>;
          const [packageJsonContent] = ParsePackageJson(contentsBytes);
          isNotNeededPackage = packageJsonContent.__tsgoEmbedded1?.Typings.Null ?? false as bool;
        }
        if (!isNotNeededPackage) {
          const baseFileName = tspath.GetBaseFileName(normalized);
          if (!strings.HasPrefix(baseFileName, ".")) {
            wildcardMatches.push(baseFileName);
          }
        }
      }
    }
  }

  const result: GoSlice<string> = [];
  for (const t of (options!.Types ?? [])) {
    if (t === "*") {
      result.push(...wildcardMatches);
    } else {
      result.push(t);
    }
  }
  return core.Deduplicate(result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::Ending","kind":"type","status":"implemented","sigHash":"e82423a377d027fb64ee9127d3206ef63309b3e937a67c008fd3ed660232463b","bodyHash":"52b95bd875395d014f7a9d283d3192e45554a5e31e16c0814be864113a0dfe02"}
 *
 * Go source:
 * Ending int
 */
export type Ending = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::constGroup::EndingFixed+EndingExtensionChangeable+EndingChangeable","kind":"constGroup","status":"implemented","sigHash":"3fa2909b817e216e8312d7c689984dc5b0d9f20c9638b94b3798a369933236ec","bodyHash":"9404d0e3f7a3c42201452b8e8b0c49fd718cfadbe9ba34b404adaba461fd8cda"}
 *
 * Go source:
 * const (
 * 	// EndingFixed indicates that the module specifier cannot be changed without changing its resolution.
 * 	EndingFixed Ending = iota
 * 	// EndingExtensionChangeable indicates that the module specifier's extension portion was inferred from a
 * 	// file on disk, so an interchangeable one could be used instead (e.g. replacing .d.ts with .js).
 * 	EndingExtensionChangeable
 * 	// EndingChangeable indicates that the module specifier's file name and extension portion were inferred
 * 	// from a file on disk without being matched as part of an 'exports' pattern, so can be changed according
 * 	// to the importer's module resolution rules (e.g. an /index.d.ts may be dropped entirely in CommonJS settings).
 * 	EndingChangeable
 * )
 */
export const EndingFixed: Ending = 0 as Ending;
export const EndingExtensionChangeable: Ending = 1 as Ending;
export const EndingChangeable: Ending = 2 as Ending;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::type::ResolvedEntrypoint","kind":"type","status":"implemented","sigHash":"2e4388e10cb1213904d30a3875749b5f1bc409d7044146f81a1498855a73cf3e","bodyHash":"d19763d056784a4aa5cfc800c7af81c14faf1bf9c107b1ee40259ca8f885746e"}
 *
 * Go source:
 * ResolvedEntrypoint struct {
 * 	// OriginalFileName is the symlink path if the entrypoint was discovered at a symlink. Empty otherwise.
 * 	OriginalFileName string
 * 	// ResolvedFileName is the real path to the entrypoint file.
 * 	ResolvedFileName string
 * 	ModuleSpecifier  string
 * 	// Ending indicates whether the file name and extension portion of ModuleSpecifier is fixed or can be changed.
 * 	Ending Ending
 * 	// IncludeConditions are the conditions that a resolver must have to reach this entrypoint.
 * 	IncludeConditions *collections.Set[string]
 * 	// ExcludeConditions are the conditions that a resolver must not have to reach this entrypoint.
 * 	ExcludeConditions *collections.Set[string]
 * }
 */
export interface ResolvedEntrypoint {
  OriginalFileName: string;
  ResolvedFileName: string;
  ModuleSpecifier: string;
  Ending: Ending;
  IncludeConditions: GoPtr<Set>;
  ExcludeConditions: GoPtr<Set>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::ResolvedEntrypoint.SymlinkOrRealpath","kind":"method","status":"implemented","sigHash":"3cb2f90ba71db18cfffc8e331dcabd674ef61717c68d2637879fc509d075c6a5","bodyHash":"2c626c6ba5c58f52a402451d2fc40bcf59abb687ef9e0cee77db36e28b110599"}
 *
 * Go source:
 * func (e *ResolvedEntrypoint) SymlinkOrRealpath() string {
 * 	if e.OriginalFileName != "" {
 * 		return e.OriginalFileName
 * 	}
 * 	return e.ResolvedFileName
 * }
 */
export function ResolvedEntrypoint_SymlinkOrRealpath(receiver: GoPtr<ResolvedEntrypoint>): string {
  if (receiver!.OriginalFileName !== "") {
    return receiver!.OriginalFileName;
  }
  return receiver!.ResolvedFileName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.GetEntrypointsFromPackageJsonInfo","kind":"method","status":"implemented","sigHash":"085baad7350f34ae2c467cd60ee871f40cb7a234cff5be1950a57c9ea1b2367d","bodyHash":"31d673e3b059d4d06cac90931d640a95adce5ebc32fe1305c6e89c2b691c5000"}
 *
 * Go source:
 * func (r *Resolver) GetEntrypointsFromPackageJsonInfo(packageJson *packagejson.InfoCacheEntry, packageName string) []*ResolvedEntrypoint {
 * 	extensions := extensionsTypeScript | extensionsDeclaration
 * 	features := NodeResolutionFeaturesAll
 * 	state := &resolutionState{resolver: r, extensions: extensions, features: features, compilerOptions: r.compilerOptions}
 * 	if packageJson.Exists() && packageJson.Contents.Exports.IsPresent() {
 * 		entrypoints := state.loadEntrypointsFromExportMap(packageJson, packageName, packageJson.Contents.Exports)
 * 		return entrypoints
 * 	}
 * 
 * 	var result []*ResolvedEntrypoint
 * 	mainResolution := state.loadNodeModuleFromDirectoryWorker(
 * 		extensions,
 * 		packageJson.PackageDirectory,
 * 		packageJson,
 * 	)
 * 
 * 	otherFiles := vfsmatch.ReadDirectory(
 * 		r.host.FS(),
 * 		r.host.GetCurrentDirectory(),
 * 		packageJson.PackageDirectory,
 * 		extensions.Array(),
 * 		[]string{"node_modules"},
 * 		[]string{"** /*"},
 * 		vfsmatch.UnlimitedDepth,
 * 	)
 * 
 * 	if mainResolution.isResolved() {
 * 		result = append(result, r.createResolvedEntrypointHandlingSymlink(
 * 			mainResolution.path,
 * 			packageName,
 * 			nil,
 * 			nil,
 * 			EndingFixed,
 * 		))
 * 	}
 * 
 * 	comparePathsOptions := tspath.ComparePathsOptions{UseCaseSensitiveFileNames: r.host.FS().UseCaseSensitiveFileNames()}
 * 	for _, file := range otherFiles {
 * 		if mainResolution.isResolved() && tspath.ComparePaths(file, mainResolution.path, comparePathsOptions) == 0 {
 * 			continue
 * 		}
 * 
 * 		result = append(result, r.createResolvedEntrypointHandlingSymlink(
 * 			file,
 * 			tspath.ResolvePath(packageName, tspath.GetRelativePathFromDirectory(packageJson.PackageDirectory, file, comparePathsOptions)),
 * 			nil,
 * 			nil,
 * 			EndingChangeable,
 * 		))
 * 	}
 * 
 * 	if len(result) > 0 {
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export function Resolver_GetEntrypointsFromPackageJsonInfo(receiver: GoPtr<Resolver>, packageJson: GoPtr<InfoCacheEntry>, packageName: string): GoSlice<GoPtr<ResolvedEntrypoint>> {
  const exts = extensionsTypeScript | extensionsDeclaration;
  const features = NodeResolutionFeaturesAll;
  const state: resolutionState = {
    resolver: receiver,
    extensions: exts,
    features: features,
    compilerOptions: receiver!.compilerOptions,
    name: "",
    containingDirectory: "",
    esmMode: false as bool,
    isConfigLookup: false as bool,
    candidateEndingIsFromConfig: false as bool,
    conditions: [],
    resolvePackageDirectoryOnly: false as bool,
    resolvedPackageDirectory: false as bool,
    diagnostics: [],
    parsedPatternsForPaths: undefined,
    parsedPatternsForPathsOnce: new Once(),
    tracer: undefined,
  };

  const exportsField = packageJsonExports(packageJson?.Contents);
  if (InfoCacheEntry_Exists(packageJson) && JSONValue_IsPresent(exportsField.__tsgoEmbedded0)) {
    return resolutionState_loadEntrypointsFromExportMap(state, packageJson, packageName, exportsField);
  }

  const result: GoSlice<GoPtr<ResolvedEntrypoint>> = [];
  const mainResolution = resolutionState_loadNodeModuleFromDirectoryWorker(
    state,
    exts,
    packageJson!.PackageDirectory,
    packageJson,
  );

  const otherFiles = vfsmatch.ReadDirectory(
    receiver!.host.FS(),
    receiver!.host.GetCurrentDirectory(),
    packageJson!.PackageDirectory,
    extensions_Array(exts),
    ["node_modules"],
    ["**/*"],
    vfsmatch.UnlimitedDepth as int,
  );

  if (resolved_isResolved(mainResolution)) {
    result.push(Resolver_createResolvedEntrypointHandlingSymlink(
      receiver,
      mainResolution!.path,
      packageName,
      undefined,
      undefined,
      EndingFixed,
    ));
  }

  const comparePathsOptions: tspath.ComparePathsOptions = { UseCaseSensitiveFileNames: receiver!.host.FS().UseCaseSensitiveFileNames() as bool, CurrentDirectory: "" };
  for (const file of otherFiles) {
    if (resolved_isResolved(mainResolution) && tspath.ComparePaths(file, mainResolution!.path, comparePathsOptions) === 0) {
      continue;
    }

    result.push(Resolver_createResolvedEntrypointHandlingSymlink(
      receiver,
      file,
      tspath.ResolvePath(packageName, tspath.GetRelativePathFromDirectory(packageJson!.PackageDirectory, file, comparePathsOptions)),
      undefined,
      undefined,
      EndingChangeable,
    ));
  }

  if (result.length > 0) {
    return result;
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::Resolver.createResolvedEntrypointHandlingSymlink","kind":"method","status":"implemented","sigHash":"7acf9aa530ec408eea650729d707285287f2112e5dbf32ff0e8f651153d8c0c0","bodyHash":"23461def0b2fed59ce493d9f744f4e033c49e2fad4247086721bfc2fda5b9179"}
 *
 * Go source:
 * func (r *Resolver) createResolvedEntrypointHandlingSymlink(fileName string, moduleSpecifier string, includeConditions *collections.Set[string], excludeConditions *collections.Set[string], ending Ending) *ResolvedEntrypoint {
 * 	var originalFileName string
 * 	resolvedFileName := fileName
 * 	if realPath := r.host.FS().Realpath(fileName); realPath != fileName {
 * 		originalFileName = fileName
 * 		resolvedFileName = realPath
 * 	}
 * 	return &ResolvedEntrypoint{
 * 		OriginalFileName:  originalFileName,
 * 		ResolvedFileName:  resolvedFileName,
 * 		ModuleSpecifier:   moduleSpecifier,
 * 		IncludeConditions: includeConditions,
 * 		ExcludeConditions: excludeConditions,
 * 		Ending:            ending,
 * 	}
 * }
 */
export function Resolver_createResolvedEntrypointHandlingSymlink(receiver: GoPtr<Resolver>, fileName: string, moduleSpecifier: string, includeConditions: GoPtr<Set>, excludeConditions: GoPtr<Set>, ending: Ending): GoPtr<ResolvedEntrypoint> {
  let originalFileName = "";
  let resolvedFileName = fileName;
  const realPath = receiver!.host.FS().Realpath(fileName);
  if (realPath !== fileName) {
    originalFileName = fileName;
    resolvedFileName = realPath;
  }
  return {
    OriginalFileName: originalFileName,
    ResolvedFileName: resolvedFileName,
    ModuleSpecifier: moduleSpecifier,
    IncludeConditions: includeConditions,
    ExcludeConditions: excludeConditions,
    Ending: ending,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.loadEntrypointsFromExportMap","kind":"method","status":"implemented","sigHash":"79d0cb01251aae6024782d34783c8cf21215a6b42a6da28905b545f2a14742db","bodyHash":"0e769c0179632d2032d5db386f9088f82e8a6ab29f737c708ad86d01738037e6"}
 *
 * Go source:
 * func (r *resolutionState) loadEntrypointsFromExportMap(
 * 	packageJson *packagejson.InfoCacheEntry,
 * 	packageName string,
 * 	exports packagejson.ExportsOrImports,
 * ) []*ResolvedEntrypoint {
 * 	var loadEntrypointsFromTargetExports func(subpath string, includeConditions *collections.Set[string], excludeConditions *collections.Set[string], exports packagejson.ExportsOrImports)
 * 	var entrypoints []*ResolvedEntrypoint
 * 
 * 	loadEntrypointsFromTargetExports = func(subpath string, includeConditions *collections.Set[string], excludeConditions *collections.Set[string], exports packagejson.ExportsOrImports) {
 * 		if exports.Type == packagejson.JSONValueTypeString && strings.HasPrefix(exports.AsString(), "./") {
 * 			if strings.ContainsRune(exports.AsString(), '*') {
 * 				if strings.IndexByte(exports.AsString(), '*') != strings.LastIndexByte(exports.AsString(), '*') {
 * 					return
 * 				}
 * 				patternPath := tspath.ResolvePath(packageJson.PackageDirectory, exports.AsString())
 * 				leadingSlice, trailingSlice, _ := strings.Cut(patternPath, "*")
 * 				caseSensitive := r.resolver.host.FS().UseCaseSensitiveFileNames()
 * 				files := vfsmatch.ReadDirectory(
 * 					r.resolver.host.FS(),
 * 					r.resolver.host.GetCurrentDirectory(),
 * 					packageJson.PackageDirectory,
 * 					r.extensions.Array(),
 * 					nil,
 * 					[]string{
 * 						tspath.ChangeFullExtension(strings.Replace(exports.AsString(), "*", "** /*", 1), ".*"),
 * 					},
 * 					vfsmatch.UnlimitedDepth,
 * 				)
 * 				for _, file := range files {
 * 					matchedStar, ok := r.getMatchedStarForPatternEntrypoint(file, leadingSlice, trailingSlice, caseSensitive)
 * 					if !ok {
 * 						continue
 * 					}
 * 					moduleSpecifier := tspath.ResolvePath(packageName, strings.Replace(subpath, "*", matchedStar, 1))
 * 					entrypoints = append(entrypoints, r.resolver.createResolvedEntrypointHandlingSymlink(
 * 						file,
 * 						moduleSpecifier,
 * 						includeConditions,
 * 						excludeConditions,
 * 						core.IfElse(strings.HasSuffix(exports.AsString(), "*"), EndingExtensionChangeable, EndingFixed),
 * 					))
 * 				}
 * 			} else {
 * 				partsAfterFirst := tspath.GetPathComponents(exports.AsString(), "")[2:]
 * 				if slices.Contains(partsAfterFirst, "..") || slices.Contains(partsAfterFirst, ".") || slices.Contains(partsAfterFirst, "node_modules") {
 * 					return
 * 				}
 * 				resolvedTarget := tspath.ResolvePath(packageJson.PackageDirectory, exports.AsString())
 * 				if result := r.loadFileNameFromPackageJSONField(r.extensions, resolvedTarget, exports.AsString()); result.isResolved() {
 * 					entrypoints = append(entrypoints, r.resolver.createResolvedEntrypointHandlingSymlink(
 * 						result.path,
 * 						tspath.ResolvePath(packageName, subpath),
 * 						includeConditions,
 * 						excludeConditions,
 * 						core.IfElse(strings.HasSuffix(exports.AsString(), "*"), EndingExtensionChangeable, EndingFixed),
 * 					))
 * 				}
 * 			}
 * 		} else if exports.Type == packagejson.JSONValueTypeArray {
 * 			for _, element := range exports.AsArray() {
 * 				loadEntrypointsFromTargetExports(subpath, includeConditions, excludeConditions, element)
 * 			}
 * 		} else if exports.Type == packagejson.JSONValueTypeObject {
 * 			var prevConditions []string
 * 			for condition, export := range exports.AsObject().Entries() {
 * 				if excludeConditions != nil && excludeConditions.Has(condition) {
 * 					continue
 * 				}
 * 
 * 				conditionAlwaysMatches := condition == "default" || condition == "types" || IsApplicableVersionedTypesKey(condition)
 * 				newIncludeConditions := includeConditions
 * 				if !(conditionAlwaysMatches) {
 * 					newIncludeConditions = includeConditions.Clone()
 * 					excludeConditions = excludeConditions.Clone()
 * 					if newIncludeConditions == nil {
 * 						newIncludeConditions = &collections.Set[string]{}
 * 					}
 * 					newIncludeConditions.Add(condition)
 * 					for _, prevCondition := range prevConditions {
 * 						if excludeConditions == nil {
 * 							excludeConditions = &collections.Set[string]{}
 * 						}
 * 						excludeConditions.Add(prevCondition)
 * 					}
 * 				}
 * 
 * 				prevConditions = append(prevConditions, condition)
 * 				loadEntrypointsFromTargetExports(subpath, newIncludeConditions, excludeConditions, export)
 * 				if conditionAlwaysMatches {
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	switch exports.Type {
 * 	case packagejson.JSONValueTypeArray:
 * 		for _, element := range exports.AsArray() {
 * 			loadEntrypointsFromTargetExports(".", nil, nil, element)
 * 		}
 * 	case packagejson.JSONValueTypeObject:
 * 		if exports.IsSubpaths() {
 * 			for subpath, export := range exports.AsObject().Entries() {
 * 				loadEntrypointsFromTargetExports(subpath, nil, nil, export)
 * 			}
 * 		} else {
 * 			loadEntrypointsFromTargetExports(".", nil, nil, exports)
 * 		}
 * 	default:
 * 		loadEntrypointsFromTargetExports(".", nil, nil, exports)
 * 	}
 * 
 * 	return entrypoints
 * }
 */
export function resolutionState_loadEntrypointsFromExportMap(receiver: GoPtr<resolutionState>, packageJson: GoPtr<InfoCacheEntry>, packageName: string, exports: ExportsOrImports): GoSlice<GoPtr<ResolvedEntrypoint>> {
  const entrypoints: GoSlice<GoPtr<ResolvedEntrypoint>> = [];

  const loadEntrypointsFromTargetExports = (subpath: string, includeConditions: GoPtr<Set<string>>, excludeConditions: GoPtr<Set<string>>, exp: ExportsOrImports): void => {
    const expType = exp.__tsgoEmbedded0!.Type;
    if (expType === JSONValueTypeString && strings.HasPrefix(JSONValue_AsString(exp.__tsgoEmbedded0!), "./")) {
      const expStr = JSONValue_AsString(exp.__tsgoEmbedded0!);
      if (strings.ContainsRune(expStr, 42)) { // '*'
        if (strings.IndexByte(expStr, 42) !== strings.LastIndexByte(expStr, 42)) {
          return;
        }
        const patternPath = tspath.ResolvePath(packageJson!.PackageDirectory, expStr);
        const [leadingSlice, trailingSlice] = strings.Cut(patternPath, "*");
        const caseSensitive = receiver!.resolver!.host.FS().UseCaseSensitiveFileNames();
        const files = vfsmatch.ReadDirectory(
          receiver!.resolver!.host.FS(),
          receiver!.resolver!.host.GetCurrentDirectory(),
          packageJson!.PackageDirectory,
          extensions_Array(receiver!.extensions),
          undefined as unknown as GoSlice<string>,
          [extension.ChangeFullExtension(strings.Replace(expStr, "*", "**/*", 1), ".*")],
          vfsmatch.UnlimitedDepth as int,
        );
        for (const file of files) {
          const [matchedStar, ok] = resolutionState_getMatchedStarForPatternEntrypoint(receiver, file, leadingSlice, trailingSlice, caseSensitive);
          if (!ok) continue;
          const moduleSpecifier = tspath.ResolvePath(packageName, strings.Replace(subpath, "*", matchedStar, 1));
          entrypoints.push(Resolver_createResolvedEntrypointHandlingSymlink(
            receiver!.resolver,
            file,
            moduleSpecifier,
            includeConditions,
            excludeConditions,
            core.IfElse(strings.HasSuffix(expStr, "*"), EndingExtensionChangeable, EndingFixed),
          ));
        }
      } else {
        const partsAfterFirst = tspath.GetPathComponents(expStr, "").slice(2);
        if (slices.Contains(partsAfterFirst, "..") || slices.Contains(partsAfterFirst, ".") || slices.Contains(partsAfterFirst, "node_modules")) {
          return;
        }
        const resolvedTarget = tspath.ResolvePath(packageJson!.PackageDirectory, expStr);
        const result = resolutionState_loadFileNameFromPackageJSONField(receiver, receiver!.extensions, resolvedTarget, expStr);
        if (resolved_isResolved(result)) {
          entrypoints.push(Resolver_createResolvedEntrypointHandlingSymlink(
            receiver!.resolver,
            result!.path,
            tspath.ResolvePath(packageName, subpath),
            includeConditions,
            excludeConditions,
            core.IfElse(strings.HasSuffix(expStr, "*"), EndingExtensionChangeable, EndingFixed),
          ));
        }
      }
    } else if (expType === JSONValueTypeArray) {
      for (const element of ExportsOrImports_AsArray(exp)!) {
        loadEntrypointsFromTargetExports(subpath, includeConditions, excludeConditions, element);
      }
    } else if (expType === JSONValueTypeObject) {
      const prevConditions: GoSlice<string> = [];
      OrderedMap_Entries<string, ExportsOrImports>(ExportsOrImports_AsObject(exp) as GoPtr<OrderedMap<string, ExportsOrImports>>)((condition: string, subExport: ExportsOrImports): bool => {
        if (excludeConditions !== undefined && Set_Has(excludeConditions, condition)) {
          return true;
        }
        const conditionAlwaysMatches = condition === "default" || condition === "types" || IsApplicableVersionedTypesKey(condition);
        let newIncludeConditions = includeConditions;
        let newExcludeConditions = excludeConditions;
        if (!conditionAlwaysMatches) {
          newIncludeConditions = Set_Clone(includeConditions);
          newExcludeConditions = Set_Clone(excludeConditions);
          if (newIncludeConditions === undefined) {
            newIncludeConditions = NewSetWithSizeHint<string>(0);
          }
          Set_Add(newIncludeConditions!, condition);
          for (const prevCondition of prevConditions) {
            if (newExcludeConditions === undefined) {
              newExcludeConditions = NewSetWithSizeHint<string>(0);
            }
            Set_Add(newExcludeConditions!, prevCondition);
          }
        }
        prevConditions.push(condition);
        loadEntrypointsFromTargetExports(subpath, newIncludeConditions, newExcludeConditions, subExport);
        if (conditionAlwaysMatches) {
          return false; // break
        }
        return true;
      });
    }
  };

  const exportsType = exports.__tsgoEmbedded0!.Type;
  if (exportsType === JSONValueTypeArray) {
    for (const element of ExportsOrImports_AsArray(exports)!) {
      loadEntrypointsFromTargetExports(".", undefined, undefined, element);
    }
  } else if (exportsType === JSONValueTypeObject) {
    if (ExportsOrImports_IsSubpaths(exports)) {
      OrderedMap_Entries<string, ExportsOrImports>(ExportsOrImports_AsObject(exports) as GoPtr<OrderedMap<string, ExportsOrImports>>)((subpath: string, exp: ExportsOrImports): bool => {
        loadEntrypointsFromTargetExports(subpath, undefined, undefined, exp);
        return true;
      });
    } else {
      loadEntrypointsFromTargetExports(".", undefined, undefined, exports);
    }
  } else {
    loadEntrypointsFromTargetExports(".", undefined, undefined, exports);
  }

  return entrypoints;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/resolver.go::method::resolutionState.getMatchedStarForPatternEntrypoint","kind":"method","status":"implemented","sigHash":"26ec0331853153cda213f61b7a07028131d147b7e86db04857d1a813b78775a9","bodyHash":"9a6751b387ab0a76f5f3c12a309cbdd01d3b4d07f0b2ee45bf3fd6ef66fb85a7"}
 *
 * Go source:
 * func (r *resolutionState) getMatchedStarForPatternEntrypoint(file string, leadingSlice string, trailingSlice string, caseSensitive bool) (string, bool) {
 * 	if stringutil.HasPrefixAndSuffixWithoutOverlap(file, leadingSlice, trailingSlice, caseSensitive) {
 * 		return file[len(leadingSlice) : len(file)-len(trailingSlice)], true
 * 	}
 * 
 * 	if jsExtension := TryGetJSExtensionForFile(file, r.compilerOptions); len(jsExtension) > 0 {
 * 		swapped := tspath.ChangeFullExtension(file, jsExtension)
 * 		if stringutil.HasPrefixAndSuffixWithoutOverlap(swapped, leadingSlice, trailingSlice, caseSensitive) {
 * 			return swapped[len(leadingSlice) : len(swapped)-len(trailingSlice)], true
 * 		}
 * 	}
 * 
 * 	return "", false
 * }
 */
export function resolutionState_getMatchedStarForPatternEntrypoint(receiver: GoPtr<resolutionState>, file: string, leadingSlice: string, trailingSlice: string, caseSensitive: bool): [string, bool] {
  if (stringutil.HasPrefixAndSuffixWithoutOverlap(file, leadingSlice, trailingSlice, caseSensitive)) {
    return [file.slice(leadingSlice.length, file.length - trailingSlice.length), true as bool];
  }

  const jsExtension = TryGetJSExtensionForFile(file, receiver!.compilerOptions);
  if (jsExtension.length > 0) {
    const swapped = extension.ChangeFullExtension(file, jsExtension);
    if (stringutil.HasPrefixAndSuffixWithoutOverlap(swapped, leadingSlice, trailingSlice, caseSensitive)) {
      return [swapped.slice(leadingSlice.length, swapped.length - trailingSlice.length), true as bool];
    }
  }

  return ["", false as bool];
}

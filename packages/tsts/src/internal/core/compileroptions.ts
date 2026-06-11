import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { OrderedMap_Size } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import * as slices from "../../go/slices.js";
import * as strings from "../../go/strings.js";
import { CombinePaths, ForEachAncestorDirectory, GetDirectoryPath } from "../tspath/path.js";
import { IsDeclarationFileName } from "../tspath/extension.js";
import {
  Tristate_IsTrue,
  Tristate_IsTrueOrUnknown,
  TSFalse,
  TSTrue,
  TSUnknown,
} from "./tristate.js";
import type { Tristate } from "./tristate.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::CompilerOptions","kind":"type","status":"implemented","sigHash":"b8f0b2cb8e9d5a13c532f0de6afb68d93e5f3809b57efedc4a582202983e7a77","bodyHash":"f6cbee2fa64252d185a4f5af5405a4cc1c37a6a5ce45c2674758eeac2a445370"}
 *
 * Go source:
 * CompilerOptions struct {
 * 	_ noCopy
 * 
 * 	AllowJs                                   Tristate                                  `json:"allowJs,omitzero"`
 * 	AllowArbitraryExtensions                  Tristate                                  `json:"allowArbitraryExtensions,omitzero"`
 * 	AllowImportingTsExtensions                Tristate                                  `json:"allowImportingTsExtensions,omitzero"`
 * 	AllowNonTsExtensions                      Tristate                                  `json:"allowNonTsExtensions,omitzero"`
 * 	AllowUmdGlobalAccess                      Tristate                                  `json:"allowUmdGlobalAccess,omitzero"`
 * 	AllowUnreachableCode                      Tristate                                  `json:"allowUnreachableCode,omitzero"`
 * 	AllowUnusedLabels                         Tristate                                  `json:"allowUnusedLabels,omitzero"`
 * 	AssumeChangesOnlyAffectDirectDependencies Tristate                                  `json:"assumeChangesOnlyAffectDirectDependencies,omitzero"`
 * 	CheckJs                                   Tristate                                  `json:"checkJs,omitzero"`
 * 	CustomConditions                          []string                                  `json:"customConditions,omitzero"`
 * 	Composite                                 Tristate                                  `json:"composite,omitzero"`
 * 	EmitDeclarationOnly                       Tristate                                  `json:"emitDeclarationOnly,omitzero"`
 * 	EmitBOM                                   Tristate                                  `json:"emitBOM,omitzero"`
 * 	EmitDecoratorMetadata                     Tristate                                  `json:"emitDecoratorMetadata,omitzero"`
 * 	Declaration                               Tristate                                  `json:"declaration,omitzero"`
 * 	DeclarationDir                            string                                    `json:"declarationDir,omitzero"`
 * 	DeclarationMap                            Tristate                                  `json:"declarationMap,omitzero"`
 * 	DeduplicatePackages                       Tristate                                  `json:"deduplicatePackages,omitzero"`
 * 	DisableSizeLimit                          Tristate                                  `json:"disableSizeLimit,omitzero"`
 * 	DisableSourceOfProjectReferenceRedirect   Tristate                                  `json:"disableSourceOfProjectReferenceRedirect,omitzero"`
 * 	DisableSolutionSearching                  Tristate                                  `json:"disableSolutionSearching,omitzero"`
 * 	DisableReferencedProjectLoad              Tristate                                  `json:"disableReferencedProjectLoad,omitzero"`
 * 	ErasableSyntaxOnly                        Tristate                                  `json:"erasableSyntaxOnly,omitzero"`
 * 	ExactOptionalPropertyTypes                Tristate                                  `json:"exactOptionalPropertyTypes,omitzero"`
 * 	ExperimentalDecorators                    Tristate                                  `json:"experimentalDecorators,omitzero"`
 * 	ForceConsistentCasingInFileNames          Tristate                                  `json:"forceConsistentCasingInFileNames,omitzero"`
 * 	IsolatedModules                           Tristate                                  `json:"isolatedModules,omitzero"`
 * 	IsolatedDeclarations                      Tristate                                  `json:"isolatedDeclarations,omitzero"`
 * 	IgnoreConfig                              Tristate                                  `json:"ignoreConfig,omitzero"`
 * 	IgnoreDeprecations                        string                                    `json:"ignoreDeprecations,omitzero"`
 * 	ImportHelpers                             Tristate                                  `json:"importHelpers,omitzero"`
 * 	InlineSourceMap                           Tristate                                  `json:"inlineSourceMap,omitzero"`
 * 	InlineSources                             Tristate                                  `json:"inlineSources,omitzero"`
 * 	Init                                      Tristate                                  `json:"init,omitzero"`
 * 	Incremental                               Tristate                                  `json:"incremental,omitzero"`
 * 	Jsx                                       JsxEmit                                   `json:"jsx,omitzero"`
 * 	JsxFactory                                string                                    `json:"jsxFactory,omitzero"`
 * 	JsxFragmentFactory                        string                                    `json:"jsxFragmentFactory,omitzero"`
 * 	JsxImportSource                           string                                    `json:"jsxImportSource,omitzero"`
 * 	Lib                                       []string                                  `json:"lib,omitzero"`
 * 	LibReplacement                            Tristate                                  `json:"libReplacement,omitzero"`
 * 	Locale                                    string                                    `json:"locale,omitzero"`
 * 	MapRoot                                   string                                    `json:"mapRoot,omitzero"`
 * 	Module                                    ModuleKind                                `json:"module,omitzero"`
 * 	ModuleResolution                          ModuleResolutionKind                      `json:"moduleResolution,omitzero"`
 * 	ModuleSuffixes                            []string                                  `json:"moduleSuffixes,omitzero"`
 * 	ModuleDetection                           ModuleDetectionKind                       `json:"moduleDetection,omitzero"`
 * 	NewLine                                   NewLineKind                               `json:"newLine,omitzero"`
 * 	NoEmit                                    Tristate                                  `json:"noEmit,omitzero"`
 * 	NoCheck                                   Tristate                                  `json:"noCheck,omitzero"`
 * 	NoErrorTruncation                         Tristate                                  `json:"noErrorTruncation,omitzero"`
 * 	NoFallthroughCasesInSwitch                Tristate                                  `json:"noFallthroughCasesInSwitch,omitzero"`
 * 	NoImplicitAny                             Tristate                                  `json:"noImplicitAny,omitzero"`
 * 	NoImplicitThis                            Tristate                                  `json:"noImplicitThis,omitzero"`
 * 	NoImplicitReturns                         Tristate                                  `json:"noImplicitReturns,omitzero"`
 * 	NoEmitHelpers                             Tristate                                  `json:"noEmitHelpers,omitzero"`
 * 	NoLib                                     Tristate                                  `json:"noLib,omitzero"`
 * 	NoPropertyAccessFromIndexSignature        Tristate                                  `json:"noPropertyAccessFromIndexSignature,omitzero"`
 * 	NoUncheckedIndexedAccess                  Tristate                                  `json:"noUncheckedIndexedAccess,omitzero"`
 * 	NoEmitOnError                             Tristate                                  `json:"noEmitOnError,omitzero"`
 * 	NoUnusedLocals                            Tristate                                  `json:"noUnusedLocals,omitzero"`
 * 	NoUnusedParameters                        Tristate                                  `json:"noUnusedParameters,omitzero"`
 * 	NoResolve                                 Tristate                                  `json:"noResolve,omitzero"`
 * 	NoImplicitOverride                        Tristate                                  `json:"noImplicitOverride,omitzero"`
 * 	NoUncheckedSideEffectImports              Tristate                                  `json:"noUncheckedSideEffectImports,omitzero"`
 * 	OutDir                                    string                                    `json:"outDir,omitzero"`
 * 	Paths                                     *collections.OrderedMap[string, []string] `json:"paths,omitzero"`
 * 	PreserveConstEnums                        Tristate                                  `json:"preserveConstEnums,omitzero"`
 * 	PreserveSymlinks                          Tristate                                  `json:"preserveSymlinks,omitzero"`
 * 	Project                                   string                                    `json:"project,omitzero"`
 * 	ResolveJsonModule                         Tristate                                  `json:"resolveJsonModule,omitzero"`
 * 	ResolvePackageJsonExports                 Tristate                                  `json:"resolvePackageJsonExports,omitzero"`
 * 	ResolvePackageJsonImports                 Tristate                                  `json:"resolvePackageJsonImports,omitzero"`
 * 	RemoveComments                            Tristate                                  `json:"removeComments,omitzero"`
 * 	RewriteRelativeImportExtensions           Tristate                                  `json:"rewriteRelativeImportExtensions,omitzero"`
 * 	ReactNamespace                            string                                    `json:"reactNamespace,omitzero"`
 * 	RootDir                                   string                                    `json:"rootDir,omitzero"`
 * 	RootDirs                                  []string                                  `json:"rootDirs,omitzero"`
 * 	SkipLibCheck                              Tristate                                  `json:"skipLibCheck,omitzero"`
 * 	StableTypeOrdering                        Tristate                                  `json:"stableTypeOrdering,omitzero"`
 * 	Strict                                    Tristate                                  `json:"strict,omitzero"`
 * 	StrictBindCallApply                       Tristate                                  `json:"strictBindCallApply,omitzero"`
 * 	StrictBuiltinIteratorReturn               Tristate                                  `json:"strictBuiltinIteratorReturn,omitzero"`
 * 	StrictFunctionTypes                       Tristate                                  `json:"strictFunctionTypes,omitzero"`
 * 	StrictNullChecks                          Tristate                                  `json:"strictNullChecks,omitzero"`
 * 	StrictPropertyInitialization              Tristate                                  `json:"strictPropertyInitialization,omitzero"`
 * 	StripInternal                             Tristate                                  `json:"stripInternal,omitzero"`
 * 	SkipDefaultLibCheck                       Tristate                                  `json:"skipDefaultLibCheck,omitzero"`
 * 	SourceMap                                 Tristate                                  `json:"sourceMap,omitzero"`
 * 	SourceRoot                                string                                    `json:"sourceRoot,omitzero"`
 * 	SuppressOutputPathCheck                   Tristate                                  `json:"suppressOutputPathCheck,omitzero"`
 * 	Target                                    ScriptTarget                              `json:"target,omitzero"`
 * 	TraceResolution                           Tristate                                  `json:"traceResolution,omitzero"`
 * 	TsBuildInfoFile                           string                                    `json:"tsBuildInfoFile,omitzero"`
 * 	TypeRoots                                 []string                                  `json:"typeRoots,omitzero"`
 * 	Types                                     []string                                  `json:"types,omitzero"`
 * 	UseDefineForClassFields                   Tristate                                  `json:"useDefineForClassFields,omitzero"`
 * 	UseUnknownInCatchVariables                Tristate                                  `json:"useUnknownInCatchVariables,omitzero"`
 * 	VerbatimModuleSyntax                      Tristate                                  `json:"verbatimModuleSyntax,omitzero"`
 * 	MaxNodeModuleJsDepth                      *int                                      `json:"maxNodeModuleJsDepth,omitzero"`
 * 
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	AllowSyntheticDefaultImports Tristate `json:"allowSyntheticDefaultImports,omitzero"`
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	AlwaysStrict Tristate `json:"alwaysStrict,omitzero"`
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	BaseUrl string `json:"baseUrl,omitzero"`
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	DownlevelIteration Tristate `json:"downlevelIteration,omitzero"`
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ESModuleInterop Tristate `json:"esModuleInterop,omitzero"`
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	OutFile string `json:"outFile,omitzero"`
 * 
 * 	// Internal fields
 * 	ConfigFilePath      string   `json:"configFilePath,omitzero"`
 * 	NoDtsResolution     Tristate `json:"noDtsResolution,omitzero"`
 * 	PathsBasePath       string   `json:"pathsBasePath,omitzero"`
 * 	Diagnostics         Tristate `json:"diagnostics,omitzero"`
 * 	ExtendedDiagnostics Tristate `json:"extendedDiagnostics,omitzero"`
 * 	GenerateCpuProfile  string   `json:"generateCpuProfile,omitzero"`
 * 	GenerateTrace       string   `json:"generateTrace,omitzero"`
 * 	ListEmittedFiles    Tristate `json:"listEmittedFiles,omitzero"`
 * 	ListFiles           Tristate `json:"listFiles,omitzero"`
 * 	ExplainFiles        Tristate `json:"explainFiles,omitzero"`
 * 	ListFilesOnly       Tristate `json:"listFilesOnly,omitzero"`
 * 	NoEmitForJsFiles    Tristate `json:"noEmitForJsFiles,omitzero"`
 * 	PreserveWatchOutput Tristate `json:"preserveWatchOutput,omitzero"`
 * 	Pretty              Tristate `json:"pretty,omitzero"`
 * 	Version             Tristate `json:"version,omitzero"`
 * 	Watch               Tristate `json:"watch,omitzero"`
 * 	ShowConfig          Tristate `json:"showConfig,omitzero"`
 * 	Build               Tristate `json:"build,omitzero"`
 * 	Help                Tristate `json:"help,omitzero"`
 * 	All                 Tristate `json:"all,omitzero"`
 * 
 * 	PprofDir       string   `json:"pprofDir,omitzero"`
 * 	SingleThreaded Tristate `json:"singleThreaded,omitzero"`
 * 	Quiet          Tristate `json:"quiet,omitzero"`
 * 	Checkers       *int     `json:"checkers,omitzero"`
 * }
 */
export interface CompilerOptions {
  __tsgoBlank0: noCopy;
  AllowJs: Tristate;
  AllowArbitraryExtensions: Tristate;
  AllowImportingTsExtensions: Tristate;
  AllowNonTsExtensions: Tristate;
  AllowUmdGlobalAccess: Tristate;
  AllowUnreachableCode: Tristate;
  AllowUnusedLabels: Tristate;
  AssumeChangesOnlyAffectDirectDependencies: Tristate;
  CheckJs: Tristate;
  CustomConditions: GoSlice<string>;
  Composite: Tristate;
  EmitDeclarationOnly: Tristate;
  EmitBOM: Tristate;
  EmitDecoratorMetadata: Tristate;
  Declaration: Tristate;
  DeclarationDir: string;
  DeclarationMap: Tristate;
  DeduplicatePackages: Tristate;
  DisableSizeLimit: Tristate;
  DisableSourceOfProjectReferenceRedirect: Tristate;
  DisableSolutionSearching: Tristate;
  DisableReferencedProjectLoad: Tristate;
  ErasableSyntaxOnly: Tristate;
  ExactOptionalPropertyTypes: Tristate;
  ExperimentalDecorators: Tristate;
  ForceConsistentCasingInFileNames: Tristate;
  IsolatedModules: Tristate;
  IsolatedDeclarations: Tristate;
  IgnoreConfig: Tristate;
  IgnoreDeprecations: string;
  ImportHelpers: Tristate;
  InlineSourceMap: Tristate;
  InlineSources: Tristate;
  Init: Tristate;
  Incremental: Tristate;
  Jsx: JsxEmit;
  JsxFactory: string;
  JsxFragmentFactory: string;
  JsxImportSource: string;
  Lib: GoSlice<string>;
  LibReplacement: Tristate;
  Locale: string;
  MapRoot: string;
  Module: ModuleKind;
  ModuleResolution: ModuleResolutionKind;
  ModuleSuffixes: GoSlice<string>;
  ModuleDetection: ModuleDetectionKind;
  NewLine: NewLineKind;
  NoEmit: Tristate;
  NoCheck: Tristate;
  NoErrorTruncation: Tristate;
  NoFallthroughCasesInSwitch: Tristate;
  NoImplicitAny: Tristate;
  NoImplicitThis: Tristate;
  NoImplicitReturns: Tristate;
  NoEmitHelpers: Tristate;
  NoLib: Tristate;
  NoPropertyAccessFromIndexSignature: Tristate;
  NoUncheckedIndexedAccess: Tristate;
  NoEmitOnError: Tristate;
  NoUnusedLocals: Tristate;
  NoUnusedParameters: Tristate;
  NoResolve: Tristate;
  NoImplicitOverride: Tristate;
  NoUncheckedSideEffectImports: Tristate;
  OutDir: string;
  Paths: GoPtr<OrderedMap>;
  PreserveConstEnums: Tristate;
  PreserveSymlinks: Tristate;
  Project: string;
  ResolveJsonModule: Tristate;
  ResolvePackageJsonExports: Tristate;
  ResolvePackageJsonImports: Tristate;
  RemoveComments: Tristate;
  RewriteRelativeImportExtensions: Tristate;
  ReactNamespace: string;
  RootDir: string;
  RootDirs: GoSlice<string>;
  SkipLibCheck: Tristate;
  StableTypeOrdering: Tristate;
  Strict: Tristate;
  StrictBindCallApply: Tristate;
  StrictBuiltinIteratorReturn: Tristate;
  StrictFunctionTypes: Tristate;
  StrictNullChecks: Tristate;
  StrictPropertyInitialization: Tristate;
  StripInternal: Tristate;
  SkipDefaultLibCheck: Tristate;
  SourceMap: Tristate;
  SourceRoot: string;
  SuppressOutputPathCheck: Tristate;
  Target: ScriptTarget;
  TraceResolution: Tristate;
  TsBuildInfoFile: string;
  TypeRoots: GoSlice<string>;
  Types: GoSlice<string>;
  UseDefineForClassFields: Tristate;
  UseUnknownInCatchVariables: Tristate;
  VerbatimModuleSyntax: Tristate;
  MaxNodeModuleJsDepth: GoPtr<int>;
  AllowSyntheticDefaultImports: Tristate;
  AlwaysStrict: Tristate;
  BaseUrl: string;
  DownlevelIteration: Tristate;
  ESModuleInterop: Tristate;
  OutFile: string;
  ConfigFilePath: string;
  NoDtsResolution: Tristate;
  PathsBasePath: string;
  Diagnostics: Tristate;
  ExtendedDiagnostics: Tristate;
  GenerateCpuProfile: string;
  GenerateTrace: string;
  ListEmittedFiles: Tristate;
  ListFiles: Tristate;
  ExplainFiles: Tristate;
  ListFilesOnly: Tristate;
  NoEmitForJsFiles: Tristate;
  PreserveWatchOutput: Tristate;
  Pretty: Tristate;
  Version: Tristate;
  Watch: Tristate;
  ShowConfig: Tristate;
  Build: Tristate;
  Help: Tristate;
  All: Tristate;
  PprofDir: string;
  SingleThreaded: Tristate;
  Quiet: Tristate;
  Checkers: GoPtr<int>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::noCopy","kind":"type","status":"implemented","sigHash":"b0d7fc76eb2a0820142f0a97003bd894c9dc0c9aa9a6200692eb4d77d21c2e00","bodyHash":"4dcbe9a808682845cced4a8ac867060d272f873cf5c3371f5076d5b05b982b44"}
 *
 * Go source:
 * noCopy struct{}
 */
export interface noCopy {
  readonly __tsgoEmpty?: never;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::noCopy.Lock","kind":"method","status":"implemented","sigHash":"a0089b65a8326a24a9d04c3ffc94c9425d54b9d2d6e4fb86812ce6293debaa5e","bodyHash":"367b046a93d8f76fb5c76496a7a10b29895060a10659adffb66cbad269fab327"}
 *
 * Go source:
 * func (*noCopy) Lock()   {}
 */
export function noCopy_Lock(receiver: GoPtr<noCopy>): void {}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::noCopy.Unlock","kind":"method","status":"implemented","sigHash":"4b8ec101bd0b82416c8a357dd49660645aba927e928d925db66e01338e538acb","bodyHash":"f4189b2f1b33be67ce3bc865ed1c7de849ba1fa2b11ba10ab527304403be31aa"}
 *
 * Go source:
 * func (*noCopy) Unlock() {}
 */
export function noCopy_Unlock(receiver: GoPtr<noCopy>): void {}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::varGroup::EmptyCompilerOptions","kind":"varGroup","status":"implemented","sigHash":"fe09827cedc84dc2dbf63c80902637dcd913c879e5104c0995c36820bf8e5f4c","bodyHash":"0ed6fae679550fe39304ddf4b314f7b89a196c8c8e79955b12eaabf390ab2533"}
 *
 * Go source:
 * var EmptyCompilerOptions = &CompilerOptions{}
 */
export const EmptyCompilerOptions: GoPtr<CompilerOptions> = {} as CompilerOptions;

const compilerOptionStringFields = [
  "DeclarationDir",
  "IgnoreDeprecations",
  "JsxFactory",
  "JsxFragmentFactory",
  "JsxImportSource",
  "Locale",
  "MapRoot",
  "OutDir",
  "Project",
  "ReactNamespace",
  "RootDir",
  "SourceRoot",
  "TsBuildInfoFile",
  "BaseUrl",
  "OutFile",
  "ConfigFilePath",
  "PathsBasePath",
  "GenerateCpuProfile",
  "GenerateTrace",
  "PprofDir",
] as const;

const compilerOptionTristateFields = [
  "AllowJs",
  "AllowArbitraryExtensions",
  "AllowImportingTsExtensions",
  "AllowNonTsExtensions",
  "AllowUmdGlobalAccess",
  "AllowUnreachableCode",
  "AllowUnusedLabels",
  "AssumeChangesOnlyAffectDirectDependencies",
  "CheckJs",
  "Composite",
  "EmitDeclarationOnly",
  "EmitBOM",
  "EmitDecoratorMetadata",
  "Declaration",
  "DeclarationMap",
  "DeduplicatePackages",
  "DisableSizeLimit",
  "DisableSourceOfProjectReferenceRedirect",
  "DisableSolutionSearching",
  "DisableReferencedProjectLoad",
  "ErasableSyntaxOnly",
  "ExactOptionalPropertyTypes",
  "ExperimentalDecorators",
  "ForceConsistentCasingInFileNames",
  "IsolatedModules",
  "IsolatedDeclarations",
  "IgnoreConfig",
  "ImportHelpers",
  "InlineSourceMap",
  "InlineSources",
  "Init",
  "Incremental",
  "LibReplacement",
  "NoEmit",
  "NoCheck",
  "NoErrorTruncation",
  "NoFallthroughCasesInSwitch",
  "NoImplicitAny",
  "NoImplicitThis",
  "NoImplicitReturns",
  "NoEmitHelpers",
  "NoLib",
  "NoPropertyAccessFromIndexSignature",
  "NoUncheckedIndexedAccess",
  "NoEmitOnError",
  "NoUnusedLocals",
  "NoUnusedParameters",
  "NoResolve",
  "NoImplicitOverride",
  "NoUncheckedSideEffectImports",
  "PreserveConstEnums",
  "PreserveSymlinks",
  "ResolveJsonModule",
  "ResolvePackageJsonExports",
  "ResolvePackageJsonImports",
  "RemoveComments",
  "RewriteRelativeImportExtensions",
  "SkipLibCheck",
  "StableTypeOrdering",
  "Strict",
  "StrictBindCallApply",
  "StrictBuiltinIteratorReturn",
  "StrictFunctionTypes",
  "StrictNullChecks",
  "StrictPropertyInitialization",
  "StripInternal",
  "SkipDefaultLibCheck",
  "SourceMap",
  "SuppressOutputPathCheck",
  "TraceResolution",
  "UseDefineForClassFields",
  "UseUnknownInCatchVariables",
  "VerbatimModuleSyntax",
  "AllowSyntheticDefaultImports",
  "AlwaysStrict",
  "DownlevelIteration",
  "ESModuleInterop",
  "NoDtsResolution",
  "Diagnostics",
  "ExtendedDiagnostics",
  "ListEmittedFiles",
  "ListFiles",
  "ExplainFiles",
  "ListFilesOnly",
  "NoEmitForJsFiles",
  "PreserveWatchOutput",
  "Pretty",
  "Version",
  "Watch",
  "ShowConfig",
  "Build",
  "Help",
  "All",
  "SingleThreaded",
  "Quiet",
] as const;

export function NormalizeCompilerOptions(options: GoPtr<CompilerOptions>): GoPtr<CompilerOptions> {
  if (options === undefined) {
    return undefined;
  }
  const target = options as CompilerOptions & Record<string, unknown>;
  target.__tsgoBlank0 ??= {};
  for (const key of compilerOptionStringFields) {
    target[key] ??= "";
  }
  for (const key of compilerOptionTristateFields) {
    target[key] ??= TSUnknown;
  }
  target.Jsx ??= 0 as JsxEmit;
  target.Module ??= 0 as ModuleKind;
  target.ModuleResolution ??= 0 as ModuleResolutionKind;
  target.ModuleDetection ??= 0 as ModuleDetectionKind;
  target.NewLine ??= 0 as NewLineKind;
  target.Target ??= 0 as ScriptTarget;
  return options;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::varGroup::optionsType","kind":"varGroup","status":"implemented","sigHash":"026b7ac8d648bc03100fb2042dd8782d6a90a7449125c3faa845d5339a4847a4","bodyHash":"78d95458b8e87bacaea1c14432a123baf45f19a8dbce2eb144482044b8c81a54"}
 *
 * Go source:
 * var optionsType = reflect.TypeFor[CompilerOptions]()
 */
export const optionsType: unknown = undefined as never;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.Clone","kind":"method","status":"implemented","sigHash":"f7d4a926a50c11b48bf433a036d815a2acc0c65ae5238d38c2ccf8340be890b1","bodyHash":"3bedcaaecca6dcc7cad2f15a08f5ea19fa8855978b0ff2013714458ad0cc3e19"}
 *
 * Go source:
 * func (options *CompilerOptions) Clone() *CompilerOptions {
 * 	// TODO: this could be generated code instead of reflection.
 * 	target := &CompilerOptions{}
 * 
 * 	sourceValue := reflect.ValueOf(options).Elem()
 * 	targetValue := reflect.ValueOf(target).Elem()
 * 
 * 	for i := range sourceValue.NumField() {
 * 		if optionsType.Field(i).IsExported() {
 * 			targetValue.Field(i).Set(sourceValue.Field(i))
 * 		}
 * 	}
 * 
 * 	return target
 * }
 */
export function CompilerOptions_Clone(receiver: GoPtr<CompilerOptions>): GoPtr<CompilerOptions> {
  return { ...receiver! };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEmitScriptTarget","kind":"method","status":"implemented","sigHash":"de9ec2858431b3da2af42a54630ad10f9f9eadf91fefb46df146acb26d00efcb","bodyHash":"c67bf0bc77f74e80bd1fd47999072a432ba6fb448e3eec7f8de3fd9672e9b154"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEmitScriptTarget() ScriptTarget {
 * 	if options.Target != ScriptTargetNone {
 * 		return options.Target
 * 	}
 * 	return ScriptTargetLatestStandard
 * }
 */
export function CompilerOptions_GetEmitScriptTarget(receiver: GoPtr<CompilerOptions>): ScriptTarget {
  const options: GoPtr<CompilerOptions> = receiver;
  if (options!.Target !== ScriptTargetNone) {
    return options!.Target;
  }
  return ScriptTargetLatestStandard;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEmitModuleKind","kind":"method","status":"implemented","sigHash":"7f73705924e97d6c26ee4d8d5b98e456027de41ff022bfa9aca069abd99bbdd1","bodyHash":"c6400c7e90daad851fd76fa2c9e5bc72315b7afa8168f6a03784421079425de2"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEmitModuleKind() ModuleKind {
 * 	if options.Module != ModuleKindNone {
 * 		return options.Module
 * 	}
 *
 * 	target := options.GetEmitScriptTarget()
 * 	if target == ScriptTargetESNext {
 * 		return ModuleKindESNext
 * 	}
 * 	if target >= ScriptTargetES2022 {
 * 		return ModuleKindES2022
 * 	}
 * 	if target >= ScriptTargetES2020 {
 * 		return ModuleKindES2020
 * 	}
 * 	if target >= ScriptTargetES2015 {
 * 		return ModuleKindES2015
 * 	}
 * 	return ModuleKindCommonJS
 * }
 */
export function CompilerOptions_GetEmitModuleKind(receiver: GoPtr<CompilerOptions>): ModuleKind {
  const options: GoPtr<CompilerOptions> = receiver;
  if (options!.Module !== ModuleKindNone) {
    return options!.Module;
  }

  const target = CompilerOptions_GetEmitScriptTarget(options);
  if (target === ScriptTargetESNext) {
    return ModuleKindESNext;
  }
  if (target >= ScriptTargetES2022) {
    return ModuleKindES2022;
  }
  if (target >= ScriptTargetES2020) {
    return ModuleKindES2020;
  }
  if (target >= ScriptTargetES2015) {
    return ModuleKindES2015;
  }
  return ModuleKindCommonJS;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetModuleResolutionKind","kind":"method","status":"implemented","sigHash":"0400ded2dff71a7cd908dbfd292d0890374919f7b88a2237819b82f98b0e0a1e","bodyHash":"1f75b78508282f9bf69522e780da653c6f3fe269784f8ed15ba2b0452d349bb2"}
 *
 * Go source:
 * func (options *CompilerOptions) GetModuleResolutionKind() ModuleResolutionKind {
 * 	switch options.ModuleResolution {
 * 	case ModuleResolutionKindUnknown, ModuleResolutionKindClassic, ModuleResolutionKindNode10:
 * 		switch options.GetEmitModuleKind() {
 * 		case ModuleKindNode16, ModuleKindNode18, ModuleKindNode20:
 * 			return ModuleResolutionKindNode16
 * 		case ModuleKindNodeNext:
 * 			return ModuleResolutionKindNodeNext
 * 		default:
 * 			return ModuleResolutionKindBundler
 * 		}
 * 	default:
 * 		return options.ModuleResolution
 * 	}
 * }
 */
export function CompilerOptions_GetModuleResolutionKind(receiver: GoPtr<CompilerOptions>): ModuleResolutionKind {
  const options: GoPtr<CompilerOptions> = receiver;
  const moduleResolution = options!.ModuleResolution ?? ModuleResolutionKindUnknown;
  switch (moduleResolution) {
    case ModuleResolutionKindUnknown:
    case ModuleResolutionKindClassic:
    case ModuleResolutionKindNode10:
      switch (CompilerOptions_GetEmitModuleKind(options)) {
        case ModuleKindNode16:
        case ModuleKindNode18:
        case ModuleKindNode20:
          return ModuleResolutionKindNode16;
        case ModuleKindNodeNext:
          return ModuleResolutionKindNodeNext;
        default:
          return ModuleResolutionKindBundler;
      }
    default:
      return moduleResolution;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEmitModuleDetectionKind","kind":"method","status":"implemented","sigHash":"e2baa2b2c705f80ef227fd29c4c85feed4f8e7e272dfb6557f60dc88729bda8e","bodyHash":"000f65323c1bb21fee0d60d9b0237a5ee2259702b6ca387905cccc486f7a11e7"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEmitModuleDetectionKind() ModuleDetectionKind {
 * 	if options.ModuleDetection != ModuleDetectionKindNone {
 * 		return options.ModuleDetection
 * 	}
 * 	moduleKind := options.GetEmitModuleKind()
 * 	if ModuleKindNode16 <= moduleKind && moduleKind <= ModuleKindNodeNext {
 * 		return ModuleDetectionKindForce
 * 	}
 * 	return ModuleDetectionKindAuto
 * }
 */
export function CompilerOptions_GetEmitModuleDetectionKind(receiver: GoPtr<CompilerOptions>): ModuleDetectionKind {
  const options: GoPtr<CompilerOptions> = receiver;
  if (options!.ModuleDetection !== ModuleDetectionKindNone) {
    return options!.ModuleDetection;
  }
  const moduleKind = CompilerOptions_GetEmitModuleKind(options);
  if (ModuleKindNode16 <= moduleKind && moduleKind <= ModuleKindNodeNext) {
    return ModuleDetectionKindForce;
  }
  return ModuleDetectionKindAuto;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetResolvePackageJsonExports","kind":"method","status":"implemented","sigHash":"cf719126986561dcaa1e39df5c2169fc7f3d8730146b1967d284ad42df26b9b7","bodyHash":"ea3c0623146b2e5bb9b306e4a5dde46bafcf0cc33738123288aa7e4cb7a6a890"}
 *
 * Go source:
 * func (options *CompilerOptions) GetResolvePackageJsonExports() bool {
 * 	return options.ResolvePackageJsonExports.IsTrueOrUnknown()
 * }
 */
export function CompilerOptions_GetResolvePackageJsonExports(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return Tristate_IsTrueOrUnknown(options!.ResolvePackageJsonExports);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetResolvePackageJsonImports","kind":"method","status":"implemented","sigHash":"90738769bb1a90159b5843691bb3ace2ad6e86067a9bdf0c5eebd28b584d9af6","bodyHash":"de9f28c7a0ed19181fb64b73340f9d47a9ccb1fc70e6adb21a48186a263e2129"}
 *
 * Go source:
 * func (options *CompilerOptions) GetResolvePackageJsonImports() bool {
 * 	return options.ResolvePackageJsonImports.IsTrueOrUnknown()
 * }
 */
export function CompilerOptions_GetResolvePackageJsonImports(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return Tristate_IsTrueOrUnknown(options!.ResolvePackageJsonImports);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetAllowImportingTsExtensions","kind":"method","status":"implemented","sigHash":"08829cd0a81ccb7e4236a28466470157e5f5bd1acd5aaf183e034764320ee140","bodyHash":"e678853a7ac8a25342171dddedd37577f31879da1859c911b07045b853607b10"}
 *
 * Go source:
 * func (options *CompilerOptions) GetAllowImportingTsExtensions() bool {
 * 	return options.AllowImportingTsExtensions.IsTrue() || options.RewriteRelativeImportExtensions.IsTrue()
 * }
 */
export function CompilerOptions_GetAllowImportingTsExtensions(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return Tristate_IsTrue(options!.AllowImportingTsExtensions) || Tristate_IsTrue(options!.RewriteRelativeImportExtensions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.AllowImportingTsExtensionsFrom","kind":"method","status":"implemented","sigHash":"2ee8d29702700cf2511a58098ae2961887cd3972deb0cf584cc93ad7ca2768d2","bodyHash":"7875adc2081b6862a9f4f76a867ed40797119a904ae1ccb438bc34ee61143ecd"}
 *
 * Go source:
 * func (options *CompilerOptions) AllowImportingTsExtensionsFrom(fileName string) bool {
 * 	return options.GetAllowImportingTsExtensions() || tspath.IsDeclarationFileName(fileName)
 * }
 */
export function CompilerOptions_AllowImportingTsExtensionsFrom(receiver: GoPtr<CompilerOptions>, fileName: string): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return CompilerOptions_GetAllowImportingTsExtensions(options) || IsDeclarationFileName(fileName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetResolveJsonModule","kind":"method","status":"implemented","sigHash":"bddc9d959f92480d676bd4c6850b101ba8d71db4ebb403d6b9d371a81cd21631","bodyHash":"1a5403e0ffc788180c523a04d69747e56ef63939b2f438464a0ff53dcdf35390"}
 *
 * Go source:
 * func (options *CompilerOptions) GetResolveJsonModule() bool {
 * 	if options.ResolveJsonModule != TSUnknown {
 * 		return options.ResolveJsonModule == TSTrue
 * 	}
 * 	switch options.GetEmitModuleKind() {
 * 	// TODO in 6.0: add Node16/Node18
 * 	case ModuleKindNode20, ModuleKindNodeNext:
 * 		return true
 * 	}
 * 	return options.GetModuleResolutionKind() == ModuleResolutionKindBundler
 * }
 */
export function CompilerOptions_GetResolveJsonModule(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  const resolveJsonModule = options!.ResolveJsonModule ?? TSUnknown;
  if (resolveJsonModule !== TSUnknown) {
    return resolveJsonModule === TSTrue;
  }
  switch (CompilerOptions_GetEmitModuleKind(options)) {
    // TODO in 6.0: add Node16/Node18
    case ModuleKindNode20:
    case ModuleKindNodeNext:
      return true;
  }
  return CompilerOptions_GetModuleResolutionKind(options) === ModuleResolutionKindBundler;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.ShouldPreserveConstEnums","kind":"method","status":"implemented","sigHash":"ba5aa65c845f68be242da43baf2b8d5a7934a8f36958b2eaba27d31010c2338a","bodyHash":"1e17dd13eb79cfc9e8c06f2c6f4232b109374df737fa1baf36c2807ccaa537f7"}
 *
 * Go source:
 * func (options *CompilerOptions) ShouldPreserveConstEnums() bool {
 * 	return options.PreserveConstEnums == TSTrue || options.GetIsolatedModules()
 * }
 */
export function CompilerOptions_ShouldPreserveConstEnums(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return (options!.PreserveConstEnums ?? TSUnknown) === TSTrue || CompilerOptions_GetIsolatedModules(options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetAllowJS","kind":"method","status":"implemented","sigHash":"5f741467ff09234b754542adf9a2611962c4f66c80818977b9ece96e1b615288","bodyHash":"02d161c63b839582bfc6a1ebca9e176266a21df96da4fef04ffca9ea103103c7"}
 *
 * Go source:
 * func (options *CompilerOptions) GetAllowJS() bool {
 * 	if options.AllowJs != TSUnknown {
 * 		return options.AllowJs == TSTrue
 * 	}
 * 	return options.CheckJs == TSTrue
 * }
 */
export function CompilerOptions_GetAllowJS(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  const allowJs = options!.AllowJs ?? TSUnknown;
  if (allowJs !== TSUnknown) {
    return allowJs === TSTrue;
  }
  return (options!.CheckJs ?? TSUnknown) === TSTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetJSXTransformEnabled","kind":"method","status":"implemented","sigHash":"156b73eb27116a2cbb3da24645d3847ba8f8a2c7721c766cb9cd4f421df5c3d8","bodyHash":"ce97c46741c6bcb78c8339def47c0ec140c14b6def9266783d46312cb0957109"}
 *
 * Go source:
 * func (options *CompilerOptions) GetJSXTransformEnabled() bool {
 * 	jsx := options.Jsx
 * 	return jsx == JsxEmitReact || jsx == JsxEmitReactJSX || jsx == JsxEmitReactJSXDev
 * }
 */
export function CompilerOptions_GetJSXTransformEnabled(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  const jsx = options!.Jsx;
  return jsx === JsxEmitReact || jsx === JsxEmitReactJSX || jsx === JsxEmitReactJSXDev;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetStrictOptionValue","kind":"method","status":"implemented","sigHash":"902e73b6bc019ae1cdb9d0a8cd8073c9c28748ac48d8c0f265d7110ff3a7a564","bodyHash":"55bbe6a562b780b3ee60ad25409707c66ab4f13d1936a05b41d91d28b7a65e75"}
 *
 * Go source:
 * func (options *CompilerOptions) GetStrictOptionValue(value Tristate) bool {
 * 	if value != TSUnknown {
 * 		return value == TSTrue
 * 	}
 * 	return options.Strict != TSFalse
 * }
 */
export function CompilerOptions_GetStrictOptionValue(receiver: GoPtr<CompilerOptions>, value: Tristate): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  const effectiveValue = value ?? TSUnknown;
  if (effectiveValue !== TSUnknown) {
    return effectiveValue === TSTrue;
  }
  return (options!.Strict ?? TSUnknown) !== TSFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEffectiveTypeRoots","kind":"method","status":"implemented","sigHash":"79b9e0013779d08e5f2c2a543cd5677768ee920be194a19189e83aceeb6db399","bodyHash":"5842b3f402811c7c03670a408e62255dfbf0ac30e021433d9013e4533dc7a638"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEffectiveTypeRoots(currentDirectory string) (result []string, fromConfig bool) {
 * 	if options.TypeRoots != nil {
 * 		return options.TypeRoots, true
 * 	}
 * 	var baseDir string
 * 	if options.ConfigFilePath != "" {
 * 		baseDir = tspath.GetDirectoryPath(options.ConfigFilePath)
 * 	} else {
 * 		baseDir = currentDirectory
 * 		if baseDir == "" {
 * 			// This was accounted for in the TS codebase, but only for third-party API usage
 * 			// where the module resolution host does not provide a getCurrentDirectory().
 * 			panic("cannot get effective type roots without a config file path or current directory")
 * 		}
 * 	}
 *
 * 	typeRoots := make([]string, 0, strings.Count(baseDir, "/"))
 * 	tspath.ForEachAncestorDirectory(baseDir, func(dir string) (any, bool) {
 * 		typeRoots = append(typeRoots, tspath.CombinePaths(dir, "node_modules", "@types"))
 * 		return nil, false
 * 	})
 * 	return typeRoots, false
 * }
 */
export function CompilerOptions_GetEffectiveTypeRoots(receiver: GoPtr<CompilerOptions>, currentDirectory: string): [GoSlice<string>, bool] {
  const options: GoPtr<CompilerOptions> = receiver;
  if (options!.TypeRoots !== undefined) {
    return [options!.TypeRoots, true];
  }
  let baseDir: string;
  const configFilePath = options!.ConfigFilePath ?? "";
  if (configFilePath !== "") {
    baseDir = GetDirectoryPath(configFilePath);
  } else {
    baseDir = currentDirectory;
    if (baseDir === "") {
      // This was accounted for in the TS codebase, but only for third-party API usage
      // where the module resolution host does not provide a getCurrentDirectory().
      throw new globalThis.Error("cannot get effective type roots without a config file path or current directory");
    }
  }

  const typeRoots: GoSlice<string> = [];
  void strings.Count(baseDir, "/");
  ForEachAncestorDirectory<unknown>(baseDir, (dir: string): [unknown, bool] => {
    typeRoots.push(CombinePaths(dir, "node_modules", "@types"));
    return [undefined, false];
  });
  return [typeRoots, false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.UsesWildcardTypes","kind":"method","status":"implemented","sigHash":"506ee53756f3be1b153e610aa1b81c45e6c73be882bcc2746d3f3ace5511319c","bodyHash":"609706da6ad596ae59c1d37f09f66f4142bfa053884693c368400f2acf6f3e0f"}
 *
 * Go source:
 * func (options *CompilerOptions) UsesWildcardTypes() bool {
 * 	return slices.Contains(options.Types, "*")
 * }
 */
export function CompilerOptions_UsesWildcardTypes(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return slices.Contains(options!.Types, "*");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetIsolatedModules","kind":"method","status":"implemented","sigHash":"7d20f73c4d8f94d8a6490055742935dcede3f3a95e382e319b38141b17f0b2dd","bodyHash":"ce6f5aae586ea5ad3abe275a6d38f873a6fd8705943b5d33ad587d6f2f8a5136"}
 *
 * Go source:
 * func (options *CompilerOptions) GetIsolatedModules() bool {
 * 	return options.IsolatedModules == TSTrue || options.VerbatimModuleSyntax == TSTrue
 * }
 */
export function CompilerOptions_GetIsolatedModules(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return (options!.IsolatedModules ?? TSUnknown) === TSTrue || (options!.VerbatimModuleSyntax ?? TSUnknown) === TSTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.IsIncremental","kind":"method","status":"implemented","sigHash":"2a5f7840f4fd027ab2f14a4f9252ee151868880e36ef48582e12e9b7aeb31392","bodyHash":"9daf1f635c4361d6332ea550fe07e6b3ce7d24052120d72916ace509ed97cb4d"}
 *
 * Go source:
 * func (options *CompilerOptions) IsIncremental() bool {
 * 	return options.Incremental.IsTrue() || options.Composite.IsTrue()
 * }
 */
export function CompilerOptions_IsIncremental(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return Tristate_IsTrue(options!.Incremental) || Tristate_IsTrue(options!.Composite);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEmitStandardClassFields","kind":"method","status":"implemented","sigHash":"6820304737bd8e7e0a5bbd46c58070611ab3699405b9918adc0a997cfb724161","bodyHash":"4a132352c4eb6549c69ffd2f60b5be90b1bf0c754dbe89c71c5b076c70f2d6a0"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEmitStandardClassFields() bool {
 * 	return options.UseDefineForClassFields != TSFalse && options.GetEmitScriptTarget() >= ScriptTargetES2022
 * }
 */
export function CompilerOptions_GetEmitStandardClassFields(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return (options!.UseDefineForClassFields ?? TSUnknown) !== TSFalse && CompilerOptions_GetEmitScriptTarget(options) >= ScriptTargetES2022;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetUseDefineForClassFields","kind":"method","status":"implemented","sigHash":"7bbcbbeefc963c259ec20eb3d2e1c3babf28923d00187e24720dfafdb10d2a9b","bodyHash":"00f1412895c141d0b86eca43d61022fd9ea079c5e2ae532b367560ef3253f229"}
 *
 * Go source:
 * func (options *CompilerOptions) GetUseDefineForClassFields() bool {
 * 	if options.UseDefineForClassFields == TSUnknown {
 * 		return options.GetEmitScriptTarget() >= ScriptTargetES2022
 * 	}
 * 	return options.UseDefineForClassFields == TSTrue
 * }
 */
export function CompilerOptions_GetUseDefineForClassFields(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  const useDefineForClassFields = options!.UseDefineForClassFields ?? TSUnknown;
  if (useDefineForClassFields === TSUnknown) {
    return CompilerOptions_GetEmitScriptTarget(options) >= ScriptTargetES2022;
  }
  return useDefineForClassFields === TSTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetEmitDeclarations","kind":"method","status":"implemented","sigHash":"6d889a2965e0d06ca23a9a09a4fcf42ebb5e2285b06cba6104f6a15d5754c5aa","bodyHash":"dd646e6317304902448928acf4e5b5017660061335fa5244d7dcbc8ab69603f9"}
 *
 * Go source:
 * func (options *CompilerOptions) GetEmitDeclarations() bool {
 * 	return options.Declaration.IsTrue() || options.Composite.IsTrue()
 * }
 */
export function CompilerOptions_GetEmitDeclarations(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return Tristate_IsTrue(options!.Declaration) || Tristate_IsTrue(options!.Composite);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetAreDeclarationMapsEnabled","kind":"method","status":"implemented","sigHash":"efd86b5088cb13a1ff943af5f60aa4269b31ca5687b4f8229135efcd1b46d840","bodyHash":"af8f56a2f7c80de25f524143849af8dd31ae5e55cb3a23a6bbe044c15caaa048"}
 *
 * Go source:
 * func (options *CompilerOptions) GetAreDeclarationMapsEnabled() bool {
 * 	return options.DeclarationMap == TSTrue && options.GetEmitDeclarations()
 * }
 */
export function CompilerOptions_GetAreDeclarationMapsEnabled(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  return options!.DeclarationMap === TSTrue && CompilerOptions_GetEmitDeclarations(options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.HasJsonModuleEmitEnabled","kind":"method","status":"implemented","sigHash":"ee90ac5838a79c380a38894668e46b56a548d8b95653c85434ea68f05913eef4","bodyHash":"d7eeebea801da676545abf876ffccf635dcb46be893cf2cf9018cc3b91d185c0"}
 *
 * Go source:
 * func (options *CompilerOptions) HasJsonModuleEmitEnabled() bool {
 * 	switch options.GetEmitModuleKind() {
 * 	case ModuleKindSystem, ModuleKindUMD:
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function CompilerOptions_HasJsonModuleEmitEnabled(receiver: GoPtr<CompilerOptions>): bool {
  const options: GoPtr<CompilerOptions> = receiver;
  switch (CompilerOptions_GetEmitModuleKind(options)) {
    case ModuleKindSystem:
    case ModuleKindUMD:
      return false;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::CompilerOptions.GetPathsBasePath","kind":"method","status":"implemented","sigHash":"450a3ccbf5dac0d726749a6b37b48dd3713493dd6fe4b6c5cc73fa03c3bf5744","bodyHash":"0cae1bfcef69e887534639d92f422118aaf2ac27fdf10f7716065231bb0dc4f3"}
 *
 * Go source:
 * func (options *CompilerOptions) GetPathsBasePath(currentDirectory string) string {
 * 	if options.Paths.Size() == 0 {
 * 		return ""
 * 	}
 * 	if options.PathsBasePath != "" {
 * 		return options.PathsBasePath
 * 	}
 * 	return currentDirectory
 * }
 */
export function CompilerOptions_GetPathsBasePath(receiver: GoPtr<CompilerOptions>, currentDirectory: string): string {
  const options: GoPtr<CompilerOptions> = receiver;
  if (OrderedMap_Size(options!.Paths) === 0) {
    return "";
  }
  if (options!.PathsBasePath !== "") {
    return options!.PathsBasePath;
  }
  return currentDirectory;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::ModuleDetectionKind","kind":"type","status":"implemented","sigHash":"00fb30c22d5887c18a8f58f9196ed6170e50da40457ddd4fdfbb05e265f6a778","bodyHash":"846d3c09229f548bd1bfa0dab7c7820157465ce748a7aea7eb67114bc40dc528"}
 *
 * Go source:
 * ModuleDetectionKind int32
 */
export type ModuleDetectionKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::ModuleDetectionKindNone+ModuleDetectionKindAuto+ModuleDetectionKindLegacy+ModuleDetectionKindForce","kind":"constGroup","status":"implemented","sigHash":"c63747caa7cef20bc1b8c3662312b1a1d1021890e3bdd9b120b13a3993238fbc","bodyHash":"f487fd6e304c814f807fcccd21c6d9a1288ae2da10dfeb5b5609c3d95e7784f2"}
 *
 * Go source:
 * const (
 * 	ModuleDetectionKindNone   ModuleDetectionKind = 0
 * 	ModuleDetectionKindAuto   ModuleDetectionKind = 1
 * 	ModuleDetectionKindLegacy ModuleDetectionKind = 2
 * 	ModuleDetectionKindForce  ModuleDetectionKind = 3
 * )
 */
export const ModuleDetectionKindNone: ModuleDetectionKind = 0;
export const ModuleDetectionKindAuto: ModuleDetectionKind = 1;
export const ModuleDetectionKindLegacy: ModuleDetectionKind = 2;
export const ModuleDetectionKindForce: ModuleDetectionKind = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::ModuleKind","kind":"type","status":"implemented","sigHash":"79ba91dd3303a445b09cb561cf00c3ce3fc4f2a8be7c2c08b1bb75a595b748ec","bodyHash":"be89d3a99b4623bbc5eff707e741c28e876b917b4587d4232f81d18127d38061"}
 *
 * Go source:
 * ModuleKind int32
 */
export type ModuleKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::ModuleKindNone+ModuleKindCommonJS+ModuleKindAMD+ModuleKindUMD+ModuleKindSystem+ModuleKindES2015+ModuleKindES2020+ModuleKindES2022+ModuleKindESNext+ModuleKindNode16+ModuleKindNode18+ModuleKindNode20+ModuleKindNodeNext+ModuleKindPreserve","kind":"constGroup","status":"implemented","sigHash":"7380eaa8a0a504cad6a7c4b7ceb2c85dfc1d55b17d1ecbaa96d7869e963b8abe","bodyHash":"738626a0533491f7405bea6deff6f51d8bac5eb984e536040f152ec056a03efe"}
 *
 * Go source:
 * const (
 * 	ModuleKindNone     ModuleKind = 0
 * 	ModuleKindCommonJS ModuleKind = 1
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ModuleKindAMD ModuleKind = 2
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ModuleKindUMD ModuleKind = 3
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ModuleKindSystem ModuleKind = 4
 * 	// NOTE: ES module kinds should be contiguous to more easily check whether a module kind is *any* ES module kind.
 * 	//       Non-ES module kinds should not come between ES2015 (the earliest ES module kind) and ESNext (the last ES
 * 	//       module kind).
 * 	ModuleKindES2015 ModuleKind = 5
 * 	ModuleKindES2020 ModuleKind = 6
 * 	ModuleKindES2022 ModuleKind = 7
 * 	ModuleKindESNext ModuleKind = 99
 * 	// Node16+ is an amalgam of commonjs (albeit updated) and es2022+, and represents a distinct module system from es2020/esnext
 * 	ModuleKindNode16   ModuleKind = 100
 * 	ModuleKindNode18   ModuleKind = 101
 * 	ModuleKindNode20   ModuleKind = 102
 * 	ModuleKindNodeNext ModuleKind = 199
 * 	// Emit as written
 * 	ModuleKindPreserve ModuleKind = 200
 * )
 */
export const ModuleKindNone: ModuleKind = 0;
export const ModuleKindCommonJS: ModuleKind = 1;
// Deprecated: Do not use outside of options parsing and validation.
export const ModuleKindAMD: ModuleKind = 2;
// Deprecated: Do not use outside of options parsing and validation.
export const ModuleKindUMD: ModuleKind = 3;
// Deprecated: Do not use outside of options parsing and validation.
export const ModuleKindSystem: ModuleKind = 4;
// NOTE: ES module kinds should be contiguous to more easily check whether a module kind is *any* ES module kind.
//       Non-ES module kinds should not come between ES2015 (the earliest ES module kind) and ESNext (the last ES
//       module kind).
export const ModuleKindES2015: ModuleKind = 5;
export const ModuleKindES2020: ModuleKind = 6;
export const ModuleKindES2022: ModuleKind = 7;
export const ModuleKindESNext: ModuleKind = 99;
// Node16+ is an amalgam of commonjs (albeit updated) and es2022+, and represents a distinct module system from es2020/esnext
export const ModuleKindNode16: ModuleKind = 100;
export const ModuleKindNode18: ModuleKind = 101;
export const ModuleKindNode20: ModuleKind = 102;
export const ModuleKindNodeNext: ModuleKind = 199;
// Emit as written
export const ModuleKindPreserve: ModuleKind = 200;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::ModuleKind.IsNonNodeESM","kind":"method","status":"implemented","sigHash":"67e21d7f9f381e766df2b5c353282fba829d341984b902111df2c27860ed0a74","bodyHash":"182dad24e3f38e3b1a269e9baad441727bb9dd06f7c8c559669b93d8eb194136"}
 *
 * Go source:
 * func (moduleKind ModuleKind) IsNonNodeESM() bool {
 * 	return moduleKind >= ModuleKindES2015 && moduleKind <= ModuleKindESNext
 * }
 */
export function ModuleKind_IsNonNodeESM(receiver: ModuleKind): bool {
  const moduleKind: ModuleKind = receiver;
  return moduleKind >= ModuleKindES2015 && moduleKind <= ModuleKindESNext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::ModuleKind.SupportsImportAttributes","kind":"method","status":"implemented","sigHash":"5074aacebc86d93799bb776799dee9d4b4d54b43222bded5980c05dd85eba468","bodyHash":"ae471db7946b99ba0a598f4a3157eae7aaada929ceb21cbcd2c576af96212947"}
 *
 * Go source:
 * func (moduleKind ModuleKind) SupportsImportAttributes() bool {
 * 	return ModuleKindNode18 <= moduleKind && moduleKind <= ModuleKindNodeNext ||
 * 		moduleKind == ModuleKindPreserve ||
 * 		moduleKind == ModuleKindESNext
 * }
 */
export function ModuleKind_SupportsImportAttributes(receiver: ModuleKind): bool {
  const moduleKind: ModuleKind = receiver;
  return (
    (ModuleKindNode18 <= moduleKind && moduleKind <= ModuleKindNodeNext) ||
    moduleKind === ModuleKindPreserve ||
    moduleKind === ModuleKindESNext
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::ResolutionMode","kind":"type","status":"implemented","sigHash":"79fa19c648b9fb8dce8f7cd3c5c8ee6c5ff55b918fc1d73fabe7c981a342aa9c","bodyHash":"5b2927ecf51d2d413bfd7cc48c69d758b06224be4856504e2db0a7ce51aa1916"}
 *
 * Go source:
 * ResolutionMode = ModuleKind
 */
export type ResolutionMode = ModuleKind;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::ResolutionModeNone+ResolutionModeCommonJS+ResolutionModeESM","kind":"constGroup","status":"implemented","sigHash":"9d8d40f3d0bb2a581d99c610c4c68b1be231711f5abdb728404f22394081aa96","bodyHash":"a3d9ff7a867a0442c4b1f129b2e08a721e1b47dc408e4f849bb94a46f33f4098"}
 *
 * Go source:
 * const (
 * 	ResolutionModeNone     = ModuleKindNone
 * 	ResolutionModeCommonJS = ModuleKindCommonJS
 * 	ResolutionModeESM      = ModuleKindESNext
 * )
 */
export const ResolutionModeNone: ModuleKind = ModuleKindNone;
export const ResolutionModeCommonJS: ModuleKind = ModuleKindCommonJS;
export const ResolutionModeESM: ModuleKind = ModuleKindESNext;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::ModuleResolutionKind","kind":"type","status":"implemented","sigHash":"b5453466c4b039b8d18c8f0ecd1f34b4fdb8a8655495d9a0a3c79ac2f750d1c7","bodyHash":"0fa5effbcd76e7a7b3eca5e12fb346ce5e1d096d4e36a79cdfd4f8e86b8e4306"}
 *
 * Go source:
 * ModuleResolutionKind int32
 */
export type ModuleResolutionKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::ModuleResolutionKindUnknown+ModuleResolutionKindClassic+ModuleResolutionKindNode10+ModuleResolutionKindNode16+ModuleResolutionKindNodeNext+ModuleResolutionKindBundler","kind":"constGroup","status":"implemented","sigHash":"6b8a62b3ece841273d811d868749e35f62253cc9e2fae213a03197b7512a2aa0","bodyHash":"b208cfb77a13acf464689db32c610b4d5e70645c54261d12a13693b27445ac32"}
 *
 * Go source:
 * const (
 * 	ModuleResolutionKindUnknown ModuleResolutionKind = 0
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ModuleResolutionKindClassic ModuleResolutionKind = 1
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ModuleResolutionKindNode10 ModuleResolutionKind = 2
 * 	// Starting with node16, node's module resolver has significant departures from traditional cjs resolution
 * 	// to better support ECMAScript modules and their use within node - however more features are still being added.
 * 	// TypeScript's Node ESM support was introduced after Node 12 went end-of-life, and Node 14 is the earliest stable
 * 	// version that supports both pattern trailers - *but*, Node 16 is the first version that also supports ECMAScript 2022.
 * 	// In turn, we offer both a `NodeNext` moving resolution target, and a `Node16` version-anchored resolution target
 * 	ModuleResolutionKindNode16   ModuleResolutionKind = 3
 * 	ModuleResolutionKindNodeNext ModuleResolutionKind = 99 // Not simply `Node16` so that compiled code linked against TS can use the `Next` value reliably (same as with `ModuleKind`)
 * 	ModuleResolutionKindBundler  ModuleResolutionKind = 100
 * )
 */
export const ModuleResolutionKindUnknown: ModuleResolutionKind = 0;
// Deprecated: Do not use outside of options parsing and validation.
export const ModuleResolutionKindClassic: ModuleResolutionKind = 1;
// Deprecated: Do not use outside of options parsing and validation.
export const ModuleResolutionKindNode10: ModuleResolutionKind = 2;
// Starting with node16, node's module resolver has significant departures from traditional cjs resolution
// to better support ECMAScript modules and their use within node - however more features are still being added.
// TypeScript's Node ESM support was introduced after Node 12 went end-of-life, and Node 14 is the earliest stable
// version that supports both pattern trailers - *but*, Node 16 is the first version that also supports ECMAScript 2022.
// In turn, we offer both a `NodeNext` moving resolution target, and a `Node16` version-anchored resolution target
export const ModuleResolutionKindNode16: ModuleResolutionKind = 3;
export const ModuleResolutionKindNodeNext: ModuleResolutionKind = 99; // Not simply `Node16` so that compiled code linked against TS can use the `Next` value reliably (same as with `ModuleKind`)
export const ModuleResolutionKindBundler: ModuleResolutionKind = 100;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::varGroup::ModuleKindToModuleResolutionKind","kind":"varGroup","status":"implemented","sigHash":"6a1e9c0e615661aae1eb2abbb606c0463115b6255e320506ef6b6bb689b71b3b","bodyHash":"0536f3480abc2596a3ae7b31f6184c20b9a9459996e05b40b3830e776b0294e4"}
 *
 * Go source:
 * var ModuleKindToModuleResolutionKind = map[ModuleKind]ModuleResolutionKind{
 * 	ModuleKindNode16:   ModuleResolutionKindNode16,
 * 	ModuleKindNodeNext: ModuleResolutionKindNodeNext,
 * }
 */
export let ModuleKindToModuleResolutionKind: GoMap<ModuleKind, ModuleResolutionKind> = new globalThis.Map<ModuleKind, ModuleResolutionKind>([
  [ModuleKindNode16, ModuleResolutionKindNode16],
  [ModuleKindNodeNext, ModuleResolutionKindNodeNext],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::ModuleResolutionKind.String","kind":"method","status":"implemented","sigHash":"f7ee7fa731c70e0a2596cd0a9b68c21e6bc02bb39d39e4f1e774ecea7a03855e","bodyHash":"603756cba2cb5301327e049d639f3654ae8748ac67c01fc6112238dedffc9e79"}
 *
 * Go source:
 * func (m ModuleResolutionKind) String() string {
 * 	switch m {
 * 	case ModuleResolutionKindUnknown:
 * 		panic("should not use zero value of ModuleResolutionKind")
 * 	case ModuleResolutionKindClassic:
 * 		return "Classic"
 * 	case ModuleResolutionKindNode10:
 * 		return "Node10"
 * 	case ModuleResolutionKindNode16:
 * 		return "Node16"
 * 	case ModuleResolutionKindNodeNext:
 * 		return "NodeNext"
 * 	case ModuleResolutionKindBundler:
 * 		return "Bundler"
 * 	default:
 * 		panic("unhandled case in ModuleResolutionKind.String")
 * 	}
 * }
 */
export function ModuleResolutionKind_String(receiver: ModuleResolutionKind): string {
  const m: ModuleResolutionKind = receiver;
  switch (m) {
    case ModuleResolutionKindUnknown:
      throw new globalThis.Error("should not use zero value of ModuleResolutionKind");
    case ModuleResolutionKindClassic:
      return "Classic";
    case ModuleResolutionKindNode10:
      return "Node10";
    case ModuleResolutionKindNode16:
      return "Node16";
    case ModuleResolutionKindNodeNext:
      return "NodeNext";
    case ModuleResolutionKindBundler:
      return "Bundler";
    default:
      throw new globalThis.Error("unhandled case in ModuleResolutionKind.String");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::NewLineKind","kind":"type","status":"implemented","sigHash":"9f314f40554ca4b833e44d0ab7bf211938d7fb59eb3e77a6b6dd48422f1a74ed","bodyHash":"e3443c77092a3fd2b87937cfef97ff4590d1b75f859f4f589fcc21289ccaeaad"}
 *
 * Go source:
 * NewLineKind int32
 */
export type NewLineKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::NewLineKindNone+NewLineKindCRLF+NewLineKindLF","kind":"constGroup","status":"implemented","sigHash":"c94f57dfb4cb3251557cf670d63a036e2ebe94051ad2f6cb05c44d7c39f780b5","bodyHash":"42558e120f7182faf2a070fddceefec25f145f7fd7b1e973893ce842c2f6c1a9"}
 *
 * Go source:
 * const (
 * 	NewLineKindNone NewLineKind = 0
 * 	NewLineKindCRLF NewLineKind = 1
 * 	NewLineKindLF   NewLineKind = 2
 * )
 */
export const NewLineKindNone: NewLineKind = 0;
export const NewLineKindCRLF: NewLineKind = 1;
export const NewLineKindLF: NewLineKind = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::func::GetNewLineKind","kind":"func","status":"implemented","sigHash":"aa4b394574ca877dfd6417c57a23164aa1fa1f4f8a9822be1be179a7529153c4","bodyHash":"5bd91a77359b76a46bfb32910ebd7ec0dcf1a3dd7b900e07c0ab6ca9f27511d7"}
 *
 * Go source:
 * func GetNewLineKind(s string) NewLineKind {
 * 	switch s {
 * 	case "\r\n":
 * 		return NewLineKindCRLF
 * 	case "\n":
 * 		return NewLineKindLF
 * 	default:
 * 		return NewLineKindNone
 * 	}
 * }
 */
export function GetNewLineKind(s: string): NewLineKind {
  switch (s) {
    case "\r\n":
      return NewLineKindCRLF;
    case "\n":
      return NewLineKindLF;
    default:
      return NewLineKindNone;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::NewLineKind.GetNewLineCharacter","kind":"method","status":"implemented","sigHash":"b504b4d26e21808b3f3c5e3d6dd580fad5e18183df9d8916b3a044d0a52e4678","bodyHash":"c8311b628a2c7d48dc24ba3bcf0f926a76251339eeaca262fb279ac08ac090b1"}
 *
 * Go source:
 * func (newLine NewLineKind) GetNewLineCharacter() string {
 * 	switch newLine {
 * 	case NewLineKindCRLF:
 * 		return "\r\n"
 * 	default:
 * 		return "\n"
 * 	}
 * }
 */
export function NewLineKind_GetNewLineCharacter(receiver: NewLineKind): string {
  const newLine: NewLineKind = receiver;
  switch (newLine) {
    case NewLineKindCRLF:
      return "\r\n";
    default:
      return "\n";
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::ScriptTarget","kind":"type","status":"implemented","sigHash":"a72ba3f8209059be336c432167173f42f0d2eca1aeed916bb8a07f5816a25410","bodyHash":"bca37d218829266940f9cad52870ac2ba6847ceedaca63f4a256272464a4ea84"}
 *
 * Go source:
 * ScriptTarget int32
 */
export type ScriptTarget = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::ScriptTargetNone+ScriptTargetES5+ScriptTargetES2015+ScriptTargetES2016+ScriptTargetES2017+ScriptTargetES2018+ScriptTargetES2019+ScriptTargetES2020+ScriptTargetES2021+ScriptTargetES2022+ScriptTargetES2023+ScriptTargetES2024+ScriptTargetES2025+ScriptTargetESNext+ScriptTargetJSON+ScriptTargetLatest+ScriptTargetLatestStandard","kind":"constGroup","status":"implemented","sigHash":"ed77933eeaa00ef618c95492032d688e83a570b51e3dad3f2fe69bf562544060","bodyHash":"051a5da4c4e2e736437d84910e859c0c1cb851c229c9f69e95f7a89847ad2e14"}
 *
 * Go source:
 * const (
 * 	ScriptTargetNone ScriptTarget = 0
 * 	// Deprecated: Do not use outside of options parsing and validation.
 * 	ScriptTargetES5            ScriptTarget = 1
 * 	ScriptTargetES2015         ScriptTarget = 2
 * 	ScriptTargetES2016         ScriptTarget = 3
 * 	ScriptTargetES2017         ScriptTarget = 4
 * 	ScriptTargetES2018         ScriptTarget = 5
 * 	ScriptTargetES2019         ScriptTarget = 6
 * 	ScriptTargetES2020         ScriptTarget = 7
 * 	ScriptTargetES2021         ScriptTarget = 8
 * 	ScriptTargetES2022         ScriptTarget = 9
 * 	ScriptTargetES2023         ScriptTarget = 10
 * 	ScriptTargetES2024         ScriptTarget = 11
 * 	ScriptTargetES2025         ScriptTarget = 12
 * 	ScriptTargetESNext         ScriptTarget = 99
 * 	ScriptTargetJSON           ScriptTarget = 100
 * 	ScriptTargetLatest         ScriptTarget = ScriptTargetESNext
 * 	ScriptTargetLatestStandard ScriptTarget = ScriptTargetES2025
 * )
 */
export const ScriptTargetNone: ScriptTarget = 0;
// Deprecated: Do not use outside of options parsing and validation.
export const ScriptTargetES5: ScriptTarget = 1;
export const ScriptTargetES2015: ScriptTarget = 2;
export const ScriptTargetES2016: ScriptTarget = 3;
export const ScriptTargetES2017: ScriptTarget = 4;
export const ScriptTargetES2018: ScriptTarget = 5;
export const ScriptTargetES2019: ScriptTarget = 6;
export const ScriptTargetES2020: ScriptTarget = 7;
export const ScriptTargetES2021: ScriptTarget = 8;
export const ScriptTargetES2022: ScriptTarget = 9;
export const ScriptTargetES2023: ScriptTarget = 10;
export const ScriptTargetES2024: ScriptTarget = 11;
export const ScriptTargetES2025: ScriptTarget = 12;
export const ScriptTargetESNext: ScriptTarget = 99;
export const ScriptTargetJSON: ScriptTarget = 100;
export const ScriptTargetLatest: ScriptTarget = ScriptTargetESNext;
export const ScriptTargetLatestStandard: ScriptTarget = ScriptTargetES2025;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::type::JsxEmit","kind":"type","status":"implemented","sigHash":"35a7aae13bba9076d57d358b45a1aa2223d5b61e560d4696c4e1d428968a4cd5","bodyHash":"2d5c6ecace49775e98e163631f916965b29249d299ec2b847c3a97a23ac7d3ce"}
 *
 * Go source:
 * JsxEmit int32
 */
export type JsxEmit = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::constGroup::JsxEmitNone+JsxEmitPreserve+JsxEmitReactNative+JsxEmitReact+JsxEmitReactJSX+JsxEmitReactJSXDev","kind":"constGroup","status":"implemented","sigHash":"7a5d2556b8744ab02f35b5975beec92884e2b1e886972ab8317c5f2f90206890","bodyHash":"8eee9e933ca61fdeb0344a107c51205d5aeb1e997777502efadc18450a261cb5"}
 *
 * Go source:
 * const (
 * 	JsxEmitNone        JsxEmit = 0
 * 	JsxEmitPreserve    JsxEmit = 1
 * 	JsxEmitReactNative JsxEmit = 2
 * 	JsxEmitReact       JsxEmit = 3
 * 	JsxEmitReactJSX    JsxEmit = 4
 * 	JsxEmitReactJSXDev JsxEmit = 5
 * )
 */
export const JsxEmitNone: JsxEmit = 0;
export const JsxEmitPreserve: JsxEmit = 1;
export const JsxEmitReactNative: JsxEmit = 2;
export const JsxEmitReact: JsxEmit = 3;
export const JsxEmitReactJSX: JsxEmit = 4;
export const JsxEmitReactJSXDev: JsxEmit = 5;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/compileroptions.go::method::JsxEmit.String","kind":"method","status":"implemented","sigHash":"2f7d6fd6194ea7c34c021351ac0d349a9662bdc34f4243c2e15cdc83b17244a9","bodyHash":"ead6951a49faab2af58f9bd65d5bae3c3476a1f2b01ae2f4d41688a2d54a04db"}
 *
 * Go source:
 * func (j JsxEmit) String() string {
 * 	switch j {
 * 	case JsxEmitNone:
 * 		panic("should not use zero value of JsxEmit")
 * 	case JsxEmitPreserve:
 * 		return "preserve"
 * 	case JsxEmitReactNative:
 * 		return "react-native"
 * 	case JsxEmitReact:
 * 		return "react"
 * 	case JsxEmitReactJSX:
 * 		return "react-jsx"
 * 	case JsxEmitReactJSXDev:
 * 		return "react-jsxdev"
 * 	default:
 * 		panic("unhandled case in JsxEmit.String")
 * 	}
 * }
 */
export function JsxEmit_String(receiver: JsxEmit): string {
  const j: JsxEmit = receiver;
  switch (j) {
    case JsxEmitNone:
      throw new globalThis.Error("should not use zero value of JsxEmit");
    case JsxEmitPreserve:
      return "preserve";
    case JsxEmitReactNative:
      return "react-native";
    case JsxEmitReact:
      return "react";
    case JsxEmitReactJSX:
      return "react-jsx";
    case JsxEmitReactJSXDev:
      return "react-jsxdev";
    default:
      throw new globalThis.Error("unhandled case in JsxEmit.String");
  }
}

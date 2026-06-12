import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { NewOrderedMapWithSizeHint, OrderedMap_Delete, OrderedMap_Entries, OrderedMap_Set, OrderedMap_Keys } from "../collections/ordered_map.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import {
  CompilerOptions_GetAllowImportingTsExtensions,
  CompilerOptions_GetAllowJS,
  CompilerOptions_GetAreDeclarationMapsEnabled,
  CompilerOptions_GetEmitDeclarations,
  CompilerOptions_GetEmitModuleDetectionKind,
  CompilerOptions_GetEmitModuleKind,
  CompilerOptions_GetIsolatedModules,
  CompilerOptions_GetModuleResolutionKind,
  CompilerOptions_GetResolveJsonModule,
  CompilerOptions_GetResolvePackageJsonExports,
  CompilerOptions_GetResolvePackageJsonImports,
  CompilerOptions_GetUseDefineForClassFields,
  CompilerOptions_IsIncremental,
  CompilerOptions_ShouldPreserveConstEnums,
} from "../core/compileroptions.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import { GetNormalizedAbsolutePath, GetRelativePathFromFile } from "../tspath/path.js";
import type { CommandLineOption } from "./commandlineoption.js";
import {
  CommandLineOption_EnumMap,
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeList,
  CommandLineOptionTypeListOrElement,
  CommandLineOptionTypeNumber,
  CommandLineOptionTypeString,
  CommandLineOption_Elements,
} from "./commandlineoption.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import { Tristate_IsTrue, Tristate_IsFalse } from "../core/tristate.js";
import type { Tristate } from "../core/tristate.js";
import { GetDirectoryPath } from "../tspath/path.js";
import { CommandLineCompilerOptionsMap, CommandLineOptionNameMap_Get, defaultIncludeSpec } from "./tsconfigparsing.js";
import type { ParsedCommandLine } from "./parsedcommandline.js";
import {
  ParsedCommandLine_CompilerOptions,
  ParsedCommandLine_FileNames,
  ParsedCommandLine_GetCurrentDirectory,
  ParsedCommandLine_ProjectReferences,
  ParsedCommandLine_UseCaseSensitiveFileNames,
} from "./parsedcommandline.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::computeFn","kind":"func","status":"implemented","sigHash":"ab5b320eb71a492d12e852bdfc827bacfa2e45338162ae7f5b1598b402c04859","bodyHash":"a5d9638c8fe543333c0d477b9882cbbfc378f4f6eff8151648906c5a13c54c9d"}
 *
 * Go source:
 * func computeFn[T any](fn func(*core.CompilerOptions) T) func(*core.CompilerOptions) any {
 * 	return func(opts *core.CompilerOptions) any {
 * 		return fn(opts)
 * 	}
 * }
 */
export function computeFn<T>(fn: (arg0: GoPtr<CompilerOptions>) => T): (arg0: GoPtr<CompilerOptions>) => unknown {
  return (opts: GoPtr<CompilerOptions>): unknown => {
    return fn(opts);
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::type::impliedOption","kind":"type","status":"implemented","sigHash":"dd02aa105566676ac6ecaba59ed1947709af5164c61589707c94b3b23cb8f54e","bodyHash":"ceeaf8376b8b876ea28bca7476b3816a52d85e07854a88d152cc3b75590ad225"}
 *
 * Go source:
 * impliedOption struct {
 * 	// name is the Go struct field name of the CompilerOptions field (e.g., "Module").
 * 	name string
 * 	// dependencies lists the Go struct field names that this option depends on.
 * 	dependencies []string
 * 	// compute returns the effective value of this option given compiler options.
 * 	compute func(opts *core.CompilerOptions) any
 * }
 */
export interface impliedOption {
  name: string;
  dependencies: GoSlice<string>;
  compute: (opts: GoPtr<CompilerOptions>) => unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::varGroup::impliedOptions","kind":"varGroup","status":"implemented","sigHash":"27382624f6369144c3e33f747ef7fa5fa33dcf41c475ff1596cfaeb0ba2851e0","bodyHash":"e64df7aa681c28381a584a314b77ec3443519d3aa0477d0482c3762ffe029452"}
 *
 * Go source:
 * var impliedOptions = []impliedOption{
 * 	{name: "Module", dependencies: []string{"Target"}, compute: computeFn((*core.CompilerOptions).GetEmitModuleKind)},
 * 	{name: "ModuleResolution", dependencies: []string{"Module", "Target"}, compute: computeFn((*core.CompilerOptions).GetModuleResolutionKind)},
 * 	{name: "ModuleDetection", dependencies: []string{"Module", "Target"}, compute: computeFn((*core.CompilerOptions).GetEmitModuleDetectionKind)},
 * 	{name: "IsolatedModules", dependencies: []string{"VerbatimModuleSyntax"}, compute: computeFn((*core.CompilerOptions).GetIsolatedModules)},
 * 	{name: "PreserveConstEnums", dependencies: []string{"IsolatedModules", "VerbatimModuleSyntax"}, compute: computeFn((*core.CompilerOptions).ShouldPreserveConstEnums)},
 * 	{name: "Declaration", dependencies: []string{"Composite"}, compute: computeFn((*core.CompilerOptions).GetEmitDeclarations)},
 * 	{name: "DeclarationMap", dependencies: []string{"Declaration", "Composite"}, compute: computeFn((*core.CompilerOptions).GetAreDeclarationMapsEnabled)},
 * 	{name: "Incremental", dependencies: []string{"Composite"}, compute: computeFn((*core.CompilerOptions).IsIncremental)},
 * 	{name: "UseDefineForClassFields", dependencies: []string{"Target", "Module"}, compute: computeFn((*core.CompilerOptions).GetUseDefineForClassFields)},
 * 	{name: "ResolvePackageJsonExports", dependencies: []string{"ModuleResolution", "Module", "Target"}, compute: computeFn((*core.CompilerOptions).GetResolvePackageJsonExports)},
 * 	{name: "ResolvePackageJsonImports", dependencies: []string{"ModuleResolution", "ResolvePackageJsonExports", "Module", "Target"}, compute: computeFn((*core.CompilerOptions).GetResolvePackageJsonImports)},
 * 	{name: "ResolveJsonModule", dependencies: []string{"ModuleResolution", "Module", "Target"}, compute: computeFn((*core.CompilerOptions).GetResolveJsonModule)},
 * 	{name: "AllowJs", dependencies: []string{"CheckJs"}, compute: computeFn((*core.CompilerOptions).GetAllowJS)},
 * 	{name: "AllowImportingTsExtensions", dependencies: []string{"RewriteRelativeImportExtensions"}, compute: computeFn((*core.CompilerOptions).GetAllowImportingTsExtensions)},
 * }
 */
export const impliedOptions: GoSlice<impliedOption> = [
  { name: "Module", dependencies: ["Target"], compute: computeFn(CompilerOptions_GetEmitModuleKind) },
  { name: "ModuleResolution", dependencies: ["Module", "Target"], compute: computeFn(CompilerOptions_GetModuleResolutionKind) },
  { name: "ModuleDetection", dependencies: ["Module", "Target"], compute: computeFn(CompilerOptions_GetEmitModuleDetectionKind) },
  { name: "IsolatedModules", dependencies: ["VerbatimModuleSyntax"], compute: computeFn(CompilerOptions_GetIsolatedModules) },
  { name: "PreserveConstEnums", dependencies: ["IsolatedModules", "VerbatimModuleSyntax"], compute: computeFn(CompilerOptions_ShouldPreserveConstEnums) },
  { name: "Declaration", dependencies: ["Composite"], compute: computeFn(CompilerOptions_GetEmitDeclarations) },
  { name: "DeclarationMap", dependencies: ["Declaration", "Composite"], compute: computeFn(CompilerOptions_GetAreDeclarationMapsEnabled) },
  { name: "Incremental", dependencies: ["Composite"], compute: computeFn(CompilerOptions_IsIncremental) },
  { name: "UseDefineForClassFields", dependencies: ["Target", "Module"], compute: computeFn(CompilerOptions_GetUseDefineForClassFields) },
  { name: "ResolvePackageJsonExports", dependencies: ["ModuleResolution", "Module", "Target"], compute: computeFn(CompilerOptions_GetResolvePackageJsonExports) },
  { name: "ResolvePackageJsonImports", dependencies: ["ModuleResolution", "ResolvePackageJsonExports", "Module", "Target"], compute: computeFn(CompilerOptions_GetResolvePackageJsonImports) },
  { name: "ResolveJsonModule", dependencies: ["ModuleResolution", "Module", "Target"], compute: computeFn(CompilerOptions_GetResolveJsonModule) },
  { name: "AllowJs", dependencies: ["CheckJs"], compute: computeFn(CompilerOptions_GetAllowJS) },
  { name: "AllowImportingTsExtensions", dependencies: ["RewriteRelativeImportExtensions"], compute: computeFn(CompilerOptions_GetAllowImportingTsExtensions) },
];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::type::TSConfig","kind":"type","status":"implemented","sigHash":"ab01a041699515c279b4d7a9ad597a7527f3f4e3c8709fb0988e30d1c8506bf0","bodyHash":"fe188ede4b798e258eff0105011e7432a7682c798129f743d5906386957c3597"}
 *
 * Go source:
 * TSConfig struct {
 * 	CompilerOptions *collections.OrderedMap[string, any] `json:"compilerOptions"`
 * 	References      []any                                `json:"references,omitzero"`
 * 	Files           []string                             `json:"files,omitzero"`
 * 	Include         []string                             `json:"include,omitzero"`
 * 	Exclude         []string                             `json:"exclude,omitzero"`
 * 	CompileOnSave   *bool                                `json:"compileOnSave,omitzero"`
 * }
 */
export interface TSConfig {
  CompilerOptions: GoPtr<OrderedMap>;
  References: GoSlice<unknown>;
  Files: GoSlice<string>;
  Include: GoSlice<string>;
  Exclude: GoSlice<string>;
  CompileOnSave: GoPtr<bool>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::ConvertToTSConfig","kind":"func","status":"implemented","sigHash":"9f36855e511ad0f1b8807f5d66cb4528095245f4ced190f47176cc0ac39e27db","bodyHash":"87d5f9cde37731adeacdb6cc2f629432e1dabf14f4e731a5a92dee8e67cdb673"}
 *
 * Go source:
 * func ConvertToTSConfig(configParseResult *ParsedCommandLine, configFileName string) *TSConfig {
 * 	if configFileName == "" {
 * 		configFileName = "tsconfig.json"
 * 	}
 * 	normalizedConfigPath := tspath.GetNormalizedAbsolutePath(configFileName, configParseResult.GetCurrentDirectory())
 * 	comparePathsOptions := tspath.ComparePathsOptions{
 * 		CurrentDirectory:          configParseResult.GetCurrentDirectory(),
 * 		UseCaseSensitiveFileNames: configParseResult.UseCaseSensitiveFileNames(),
 * 	}
 *
 * 	// Build the list of all resolved files as relative paths from the config file.
 * 	var files []string
 * 	for _, f := range configParseResult.FileNames() {
 * 		normalizedFilePath := tspath.GetNormalizedAbsolutePath(f, configParseResult.GetCurrentDirectory())
 * 		relativePath := tspath.GetRelativePathFromFile(normalizedConfigPath, normalizedFilePath, comparePathsOptions)
 * 		files = append(files, relativePath)
 * 	}
 *
 * 	// Serialize compiler options
 * 	optionMap := serializeCompilerOptions(configParseResult.CompilerOptions(), normalizedConfigPath, comparePathsOptions)
 *
 * 	// Remove command-line-only options from the output
 * 	for _, name := range []string{
 * 		"showConfig", "configFile", "configFilePath", "help", "init",
 * 		"listFilesOnly", "listEmittedFiles", "project", "build", "version",
 * 	} {
 * 		optionMap.Delete(name)
 * 	}
 *
 * 	// Add implied compiler options (options that are derived from explicitly set options,
 * 	// such as moduleResolution implied by module, or useDefineForClassFields implied by target).
 * 	// This mirrors TypeScript's convertToTSConfig computedOptions logic.
 * 	addImpliedOptions(optionMap, configParseResult.CompilerOptions(), normalizedConfigPath, comparePathsOptions)
 *
 * 	config := &TSConfig{
 * 		CompilerOptions: optionMap,
 * 	}
 *
 * 	// Add references
 * 	if refs := configParseResult.ProjectReferences(); len(refs) > 0 {
 * 		var references []any
 * 		for _, r := range refs {
 * 			ref := &collections.OrderedMap[string, any]{}
 * 			ref.Set("path", r.OriginalPath)
 * 			if r.Circular {
 * 				ref.Set("circular", true)
 * 			}
 * 			references = append(references, ref)
 * 		}
 * 		config.References = references
 * 	}
 *
 * 	// Add files
 * 	if len(files) > 0 {
 * 		config.Files = files
 * 	}
 *
 * 	// Add include/exclude from configFileSpecs
 * 	if configParseResult.ConfigFile != nil && configParseResult.ConfigFile.configFileSpecs != nil {
 * 		specs := configParseResult.ConfigFile.configFileSpecs
 * 		include := filterSameAsDefaultInclude(specs.validatedIncludeSpecs)
 * 		if len(include) > 0 {
 * 			config.Include = include
 * 		}
 * 		config.Exclude = specs.validatedExcludeSpecs
 * 	}
 *
 * 	// Add compileOnSave
 * 	if configParseResult.CompileOnSave != nil && *configParseResult.CompileOnSave {
 * 		t := true
 * 		config.CompileOnSave = &t
 * 	}
 *
 * 	return config
 * }
 */
export function ConvertToTSConfig(configParseResult: GoPtr<ParsedCommandLine>, configFileName: string): GoPtr<TSConfig> {
  const effectiveConfigFileName = configFileName === "" ? "tsconfig.json" : configFileName;
  const normalizedConfigPath = GetNormalizedAbsolutePath(effectiveConfigFileName, ParsedCommandLine_GetCurrentDirectory(configParseResult));
  const comparePathsOptions: ComparePathsOptions = {
    CurrentDirectory: ParsedCommandLine_GetCurrentDirectory(configParseResult),
    UseCaseSensitiveFileNames: ParsedCommandLine_UseCaseSensitiveFileNames(configParseResult),
  };

  // Build the list of all resolved files as relative paths from the config file.
  const files: GoSlice<string> = [];
  for (const f of ParsedCommandLine_FileNames(configParseResult)) {
    const normalizedFilePath = GetNormalizedAbsolutePath(f, ParsedCommandLine_GetCurrentDirectory(configParseResult));
    const relativePath = GetRelativePathFromFile(normalizedConfigPath, normalizedFilePath, comparePathsOptions);
    files.push(relativePath);
  }

  // Serialize compiler options
  const optionMap = serializeCompilerOptions(ParsedCommandLine_CompilerOptions(configParseResult), normalizedConfigPath, comparePathsOptions)!;

  // Remove command-line-only options from the output
  for (const name of ["showConfig", "configFile", "configFilePath", "help", "init", "listFilesOnly", "listEmittedFiles", "project", "build", "version"]) {
    OrderedMap_Delete(optionMap, name);
  }

  // Add implied compiler options
  addImpliedOptions(optionMap, ParsedCommandLine_CompilerOptions(configParseResult), normalizedConfigPath, comparePathsOptions);

  const config: TSConfig = {
    CompilerOptions: optionMap,
    References: [],
    Files: [],
    Include: [],
    Exclude: [],
    CompileOnSave: undefined,
  };

  // Add references
  const refs = ParsedCommandLine_ProjectReferences(configParseResult);
  if (refs.length > 0) {
    const references: GoSlice<unknown> = [];
    for (const r of refs) {
      const ref = NewOrderedMapWithSizeHint<string, unknown>(2 as int);
      OrderedMap_Set(ref, "path", r!.OriginalPath);
      if (r!.Circular) {
        OrderedMap_Set(ref, "circular", true);
      }
      references.push(ref);
    }
    config.References = references;
  }

  // Add files
  if (files.length > 0) {
    config.Files = files;
  }

  // Add include/exclude from configFileSpecs
  const p = configParseResult!;
  if (p.ConfigFile !== undefined && p.ConfigFile.configFileSpecs !== undefined) {
    const specs = p.ConfigFile.configFileSpecs;
    const include = filterSameAsDefaultInclude(specs.validatedIncludeSpecs);
    if (include.length > 0) {
      config.Include = include;
    }
    config.Exclude = specs.validatedExcludeSpecs;
  }

  // Add compileOnSave
  if (p.CompileOnSave !== undefined && p.CompileOnSave === true) {
    config.CompileOnSave = true;
  }

  return config;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::filterSameAsDefaultInclude","kind":"func","status":"implemented","sigHash":"edf7dc87316b17f2bed054b2fa7a2b49e79b2522bfcb7fbdd7e2a380fa092545","bodyHash":"d5d13fca0b9d9e8edea5477276f2bb666a5124066b82369a817bee8be7d396ef"}
 *
 * Go source:
 * func filterSameAsDefaultInclude(specs []string) []string {
 * 	if len(specs) == 0 {
 * 		return nil
 * 	}
 * 	if len(specs) == 1 && specs[0] == defaultIncludeSpec {
 * 		return nil
 * 	}
 * 	return specs
 * }
 */
export function filterSameAsDefaultInclude(specs: GoSlice<string>): GoSlice<string> {
  if (specs.length === 0) {
    return [];
  }
  if (specs.length === 1 && specs[0] === defaultIncludeSpec) {
    return [];
  }
  return specs;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::getNameOfCompilerOptionValue","kind":"func","status":"implemented","sigHash":"940d9dfb59038fdfd207a0c9f85c3476f04573b4f32f56771b04345c8ab2668b","bodyHash":"ac76b232ae56dc88657e281ed2a5ecb77528342aa187eb9bb63faad9568a6d7e"}
 *
 * Go source:
 * func getNameOfCompilerOptionValue(value any, enumMap *collections.OrderedMap[string, any]) string {
 * 	for k, v := range enumMap.Entries() {
 * 		if v == value {
 * 			return k
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function getNameOfCompilerOptionValue(value: unknown, enumMap: GoPtr<OrderedMap>): string {
  const found: { value: string } = { value: "" };
  const matched: { value: bool } = { value: false };
  OrderedMap_Entries(enumMap)((k: unknown, v: unknown): bool => {
    if (v === value) {
      found.value = k as string;
      matched.value = true;
      return false;
    }
    return true;
  });
  if (matched.value) {
    return found.value;
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::serializeCompilerOptions","kind":"func","status":"implemented","sigHash":"0d85c390d98ea221ce3507a7a38faac6ba61032e513b399dcfe742587a74ded6","bodyHash":"037ce6520b4ab738303425b726a88818100612e2d540af934d65cf5e524e2b4e"}
 *
 * Go source:
 * func serializeCompilerOptions(options *core.CompilerOptions, configFilePath string, comparePathsOptions tspath.ComparePathsOptions) *collections.OrderedMap[string, any] {
 * 	result := collections.NewOrderedMapWithSizeHint[string, any](32)
 * 	configDir := tspath.GetDirectoryPath(configFilePath)
 *
 * 	optionsValue := reflect.ValueOf(options).Elem()
 * 	optionsTypeInfo := reflect.TypeFor[core.CompilerOptions]()
 *
 * 	for i := range optionsValue.NumField() {
 * 		field := optionsTypeInfo.Field(i)
 * 		if !field.IsExported() {
 * 			continue
 * 		}
 *
 * 		optionDecl := CommandLineCompilerOptionsMap.Get(field.Name)
 * 		if optionDecl == nil {
 * 			continue
 * 		}
 *
 * 		// Skip command-line-only and output formatting options
 * 		if optionDecl.Category == diagnostics.Command_line_Options || optionDecl.Category == diagnostics.Output_Formatting {
 * 			continue
 * 		}
 *
 * 		fieldValue := optionsValue.Field(i)
 *
 * 		// Skip zero values (unset options)
 * 		if fieldValue.IsZero() {
 * 			continue
 * 		}
 *
 * 		name := optionDecl.Name
 * 		value := fieldValue.Interface()
 *
 * 		enumMap := optionDecl.EnumMap()
 * 		if enumMap != nil {
 * 			// Enum option - convert numeric value to string name
 * 			serialized := serializeEnumValue(value, enumMap)
 * 			if serialized != "" {
 * 				result.Set(name, serialized)
 * 			}
 * 			continue
 * 		}
 *
 * 		switch optionDecl.Kind {
 * 		case CommandLineOptionTypeListOrElement:
 * 			debug.Assert(false, "listOrElement option should not reach serialization")
 * 		case CommandLineOptionTypeList:
 * 			elem := optionDecl.Elements()
 * 			if elem != nil && elem.IsFilePath {
 * 				// List of file paths - make relative
 * 				if strs, ok := value.([]string); ok {
 * 					relPaths := make([]string, len(strs))
 * 					for j, s := range strs {
 * 						absPath := tspath.GetNormalizedAbsolutePath(s, configDir)
 * 						relPaths[j] = tspath.GetRelativePathFromFile(configFilePath, absPath, comparePathsOptions)
 * 					}
 * 					result.Set(name, relPaths)
 * 					continue
 * 				}
 * 			}
 * 			if elem != nil && elem.EnumMap() != nil {
 * 				// List of enum values (e.g., lib)
 * 				elemMap := elem.EnumMap()
 * 				if strs, ok := value.([]string); ok {
 * 					serialized := make([]string, 0, len(strs))
 * 					for _, s := range strs {
 * 						// lib values are already stored as the d.ts filename, need to find original key
 * 						found := getNameOfCompilerOptionValue(s, elemMap)
 * 						if found != "" {
 * 							serialized = append(serialized, found)
 * 						} else {
 * 							serialized = append(serialized, s)
 * 						}
 * 					}
 * 					result.Set(name, serialized)
 * 					continue
 * 				}
 * 			}
 * 			result.Set(name, value)
 *
 * 		case CommandLineOptionTypeString:
 * 			if optionDecl.IsFilePath {
 * 				// File path option - make relative to config
 * 				if s, ok := value.(string); ok && s != "" {
 * 					absPath := tspath.GetNormalizedAbsolutePath(s, configDir)
 * 					result.Set(name, tspath.GetRelativePathFromFile(configFilePath, absPath, comparePathsOptions))
 * 					continue
 * 				}
 * 			}
 * 			result.Set(name, value)
 *
 * 		case CommandLineOptionTypeBoolean:
 * 			if t, ok := value.(core.Tristate); ok {
 * 				if t.IsTrue() {
 * 					result.Set(name, true)
 * 				} else if t.IsFalse() {
 * 					result.Set(name, false)
 * 				}
 * 			} else {
 * 				result.Set(name, value)
 * 			}
 *
 * 		case CommandLineOptionTypeNumber:
 * 			result.Set(name, value)
 *
 * 		default:
 * 			result.Set(name, value)
 * 		}
 * 	}
 *
 * 	return result
 * }
 */
export function serializeCompilerOptions(options: GoPtr<CompilerOptions>, configFilePath: string, comparePathsOptions: ComparePathsOptions): GoPtr<OrderedMap> {
  const result = NewOrderedMapWithSizeHint<string, unknown>(32 as int);
  const configDir = GetDirectoryPath(configFilePath);
  const optionsObj = options as unknown as globalThis.Record<string, unknown>;

  // Iterate over all keys of the CompilerOptions object (corresponds to Go struct fields)
  for (const fieldName of globalThis.Object.keys(optionsObj)) {
    const optionDecl = CommandLineOptionNameMap_Get(CommandLineCompilerOptionsMap, fieldName);
    if (optionDecl === undefined) {
      continue;
    }

    // Skip command-line-only and output formatting options
    if (optionDecl.Category === diagnostics.Command_line_Options || optionDecl.Category === diagnostics.Output_Formatting) {
      continue;
    }

    const fieldValue = optionsObj[fieldName];

    // Skip zero values (unset options)
    if (fieldValue === undefined || fieldValue === null || fieldValue === 0 || fieldValue === false || fieldValue === "") {
      continue;
    }
    if (globalThis.Array.isArray(fieldValue) && (fieldValue as unknown[]).length === 0) {
      continue;
    }

    const name = optionDecl.Name;
    const value = fieldValue;

    const enumMap = CommandLineOption_EnumMap(optionDecl);
    if (enumMap !== undefined) {
      // Enum option - convert numeric value to string name
      const serialized = serializeEnumValue(value, enumMap);
      if (serialized !== "") {
        OrderedMap_Set(result, name, serialized);
      }
      continue;
    }

    switch (optionDecl.Kind) {
      case CommandLineOptionTypeListOrElement:
        // debug.Assert(false, "listOrElement option should not reach serialization")
        break;
      case CommandLineOptionTypeList: {
        const elem = CommandLineOption_Elements(optionDecl);
        if (elem !== undefined && elem.IsFilePath) {
          // List of file paths - make relative
          if (globalThis.Array.isArray(value)) {
            const strs = value as GoSlice<string>;
            const relPaths: GoSlice<string> = [];
            for (const s of strs) {
              const absPath = GetNormalizedAbsolutePath(s, configDir);
              relPaths.push(GetRelativePathFromFile(configFilePath, absPath, comparePathsOptions));
            }
            OrderedMap_Set(result, name, relPaths);
            continue;
          }
        }
        if (elem !== undefined && CommandLineOption_EnumMap(elem) !== undefined) {
          // List of enum values (e.g., lib)
          const elemMap = CommandLineOption_EnumMap(elem)!;
          if (globalThis.Array.isArray(value)) {
            const strs = value as GoSlice<string>;
            const serialized: GoSlice<string> = [];
            for (const s of strs) {
              // lib values are already stored as the d.ts filename, need to find original key
              const found = getNameOfCompilerOptionValue(s, elemMap);
              if (found !== "") {
                serialized.push(found);
              } else {
                serialized.push(s);
              }
            }
            OrderedMap_Set(result, name, serialized);
            continue;
          }
        }
        OrderedMap_Set(result, name, value);
        break;
      }
      case CommandLineOptionTypeString: {
        if (optionDecl.IsFilePath) {
          // File path option - make relative to config
          if (typeof value === "string" && value !== "") {
            const absPath = GetNormalizedAbsolutePath(value, configDir);
            OrderedMap_Set(result, name, GetRelativePathFromFile(configFilePath, absPath, comparePathsOptions));
            continue;
          }
        }
        OrderedMap_Set(result, name, value);
        break;
      }
      case CommandLineOptionTypeBoolean: {
        // value may be a Tristate (number) or a plain boolean
        if (typeof value === "number") {
          const t = value as Tristate;
          if (Tristate_IsTrue(t)) {
            OrderedMap_Set(result, name, true);
          } else if (Tristate_IsFalse(t)) {
            OrderedMap_Set(result, name, false);
          }
        } else {
          OrderedMap_Set(result, name, value);
        }
        break;
      }
      case CommandLineOptionTypeNumber:
        OrderedMap_Set(result, name, value);
        break;
      default:
        OrderedMap_Set(result, name, value);
        break;
    }
  }

  return result as GoPtr<OrderedMap>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::serializeEnumValue","kind":"func","status":"implemented","sigHash":"f8c182bb220faccfdbdac394af92c0d9de62fef019a359520704ff0b5c60b1bc","bodyHash":"fa40c889459956e735b9ddf4711de25a1012edb5332971c0c92d4d10f8a59217"}
 *
 * Go source:
 * func serializeEnumValue(value any, enumMap *collections.OrderedMap[string, any]) string {
 * 	// The enum maps store values as core.ModuleKind, core.ScriptTarget, etc.
 * 	// But those are all int32 underneath. We need to compare by the underlying int32 value.
 * 	rv := reflect.ValueOf(value)
 * 	if rv.CanInt() {
 * 		intVal := rv.Int()
 * 		for k, v := range enumMap.Entries() {
 * 			ev := reflect.ValueOf(v)
 * 			if ev.CanInt() && ev.Int() == intVal {
 * 				return k
 * 			}
 * 		}
 * 	}
 * 	// Fallback: direct comparison
 * 	return getNameOfCompilerOptionValue(value, enumMap)
 * }
 */
export function serializeEnumValue(value: unknown, enumMap: GoPtr<OrderedMap>): string {
  if (typeof value === "number") {
    const container = { result: "" };
    OrderedMap_Entries(enumMap)((k: unknown, v: unknown): bool => {
      if (typeof v === "number" && v === value) {
        container.result = k as string;
        return false as bool;
      }
      return true as bool;
    });
    if (container.result !== "") {
      return container.result;
    }
  }
  return getNameOfCompilerOptionValue(value, enumMap);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::addImpliedOptions","kind":"func","status":"implemented","sigHash":"74256e10878657e2876ffab7f9189602bed544e24d9fc5a4510f514ff40165f2","bodyHash":"11ca71ef15556acc28240d7e2dcac3d2821b49367655cb1a29f10aadfa28739d"}
 *
 * Go source:
 * func addImpliedOptions(
 * 	optionMap *collections.OrderedMap[string, any],
 * 	options *core.CompilerOptions,
 * 	_ string,
 * 	_ tspath.ComparePathsOptions,
 * ) {
 * 	// Build the set of explicitly provided option JSON names (e.g., "module", "target").
 * 	provided := make(map[string]bool, optionMap.Size())
 * 	for k := range optionMap.Keys() {
 * 		provided[k] = true
 * 	}
 *
 * 	defaultOpts := &core.CompilerOptions{}
 *
 * 	for _, entry := range impliedOptions {
 * 		// Get the option declaration for this implied option (using case-insensitive lookup).
 * 		optionDecl := CommandLineCompilerOptionsMap.Get(entry.name)
 * 		if optionDecl == nil {
 * 			continue
 * 		}
 *
 * 		// Skip if this option is already explicitly provided.
 * 		if provided[optionDecl.Name] {
 * 			continue
 * 		}
 *
 * 		// Check if any direct dependency is in the provided set.
 * 		// This mirrors TypeScript's optionDependsOn check.
 * 		if !anyDependencyProvided(entry.dependencies, provided) {
 * 			continue
 * 		}
 *
 * 		// Compute the effective value with current options and the default value with empty options.
 * 		implied := entry.compute(options)
 * 		defaultVal := entry.compute(defaultOpts)
 *
 * 		// If the implied value equals the default, this option doesn't add useful information.
 * 		if reflect.DeepEqual(implied, defaultVal) {
 * 			continue
 * 		}
 *
 * 		// Serialize the implied value and add it to the option map.
 * 		serialized := serializeImpliedOptionValue(optionDecl, implied)
 * 		if serialized == nil {
 * 			continue
 * 		}
 * 		optionMap.Set(optionDecl.Name, serialized)
 * 	}
 * }
 */
export function addImpliedOptions(optionMap: GoPtr<OrderedMap>, options: GoPtr<CompilerOptions>, arg: string, arg1: ComparePathsOptions): void {
  // Build the set of explicitly provided option JSON names (e.g., "module", "target").
  const provided = new globalThis.Map<string, bool>();
  OrderedMap_Keys(optionMap)((k: unknown): bool => {
    provided.set(k as string, true);
    return true;
  });

  const defaultOpts = {} as CompilerOptions;

  for (const entry of impliedOptions) {
    // Get the option declaration for this implied option (using case-insensitive lookup).
    const optionDecl = CommandLineOptionNameMap_Get(CommandLineCompilerOptionsMap, entry.name);
    if (optionDecl === undefined) {
      continue;
    }

    // Skip if this option is already explicitly provided.
    if (provided.get(optionDecl.Name) ?? false) {
      continue;
    }

    // Check if any direct dependency is in the provided set.
    if (!anyDependencyProvided(entry.dependencies, provided)) {
      continue;
    }

    // Compute the effective value with current options and the default value with empty options.
    const implied = entry.compute(options);
    const defaultVal = entry.compute(defaultOpts);

    // If the implied value equals the default, this option doesn't add useful information.
    // For primitives (numbers, booleans, strings), === suffices; arrays we stringify-compare.
    if (implied === defaultVal) {
      continue;
    }
    if (globalThis.Array.isArray(implied) && globalThis.Array.isArray(defaultVal)) {
      if (globalThis.JSON.stringify(implied) === globalThis.JSON.stringify(defaultVal)) {
        continue;
      }
    }

    // Serialize the implied value and add it to the option map.
    const serialized = serializeImpliedOptionValue(optionDecl, implied);
    if (serialized === undefined || serialized === null) {
      continue;
    }
    OrderedMap_Set(optionMap, optionDecl.Name, serialized);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::anyDependencyProvided","kind":"func","status":"implemented","sigHash":"0b7762ef5c7235a3183665f38c1e37550d800437e006513a858c6e8cfd642a91","bodyHash":"46aaf98965ddb594e3afca9a44a940a600d7610a4f548ed36df486cd3b604b75"}
 *
 * Go source:
 * func anyDependencyProvided(dependencies []string, provided map[string]bool) bool {
 * 	for _, dep := range dependencies {
 * 		depDecl := CommandLineCompilerOptionsMap.Get(dep)
 * 		if depDecl != nil && provided[depDecl.Name] {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function anyDependencyProvided(dependencies: GoSlice<string>, provided: GoMap<string, bool>): bool {
  for (const dep of dependencies) {
    const depDecl = CommandLineOptionNameMap_Get(CommandLineCompilerOptionsMap, dep);
    if (depDecl !== undefined && (provided.get(depDecl.Name) ?? false)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/showconfig.go::func::serializeImpliedOptionValue","kind":"func","status":"implemented","sigHash":"454fd699233371eb57b51f8de60a500f051f75414beb7620c5b1de1e01cf93a4","bodyHash":"958ccade7fd915e7845faad52f10fae24bc5c7b4a9d260ab50abd427c6bbbc84"}
 *
 * Go source:
 * func serializeImpliedOptionValue(optionDecl *CommandLineOption, value any) any {
 * 	if value == nil {
 * 		return nil
 * 	}
 * 	enumMap := optionDecl.EnumMap()
 * 	if enumMap != nil {
 * 		s := serializeEnumValue(value, enumMap)
 * 		if s != "" {
 * 			return s
 * 		}
 * 		return nil
 * 	}
 * 	switch v := value.(type) {
 * 	case bool:
 * 		return v
 * 	case core.Tristate:
 * 		if v.IsTrue() {
 * 			return true
 * 		} else if v.IsFalse() {
 * 			return false
 * 		}
 * 		return nil
 * 	}
 * 	return value
 * }
 */
export function serializeImpliedOptionValue(optionDecl: GoPtr<CommandLineOption>, value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  const enumMap = CommandLineOption_EnumMap(optionDecl);
  if (enumMap !== undefined) {
    const s = serializeEnumValue(value, enumMap);
    if (s !== "") {
      return s;
    }
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    // Could be a Tristate
    const t = value as Tristate;
    if (Tristate_IsTrue(t)) {
      return true;
    } else if (Tristate_IsFalse(t)) {
      return false;
    }
    return undefined;
  }
  return value;
}

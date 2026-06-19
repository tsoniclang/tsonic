import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { DeepEqual as reflect_DeepEqual, TypeFor as reflect_TypeFor, ValueOf as reflect_ValueOf } from "../../go/reflect.js";
import type { Type, Value } from "../../go/reflect.js";
import { Concat } from "../../go/slices.js";
import { CompilerOptions_GetAllowJS, CompilerOptions_GetStrictOptionValue, ScriptTargetLatestStandard } from "../core/compileroptions.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { TSTrue, TSUnknown } from "../core/tristate.js";
import type { Tristate } from "../core/tristate.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import {
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeEnum,
  CommandLineOptionTypeList,
  CommandLineOptionTypeNumber,
  CommandLineOptionTypeObject,
  CommandLineOptionTypeString,
  extraValidationLocale,
  extraValidationNone,
  newCommandLineOption,
} from "./commandlineoption.js";
import type { CommandLineOption } from "./commandlineoption.js";


/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::varGroup::OptionsDeclarations","kind":"varGroup","status":"implemented","sigHash":"13c9568bcd832d79be6deb0428dad16819ed913e5ca1740d1c9811ec04b9d830","bodyHash":"250634e4ab39e833a421c31ec41040c09200eb172d38f436f33829244ceebbb1"}
 *
 * Go source:
 * var OptionsDeclarations = slices.Concat(commonOptionsWithBuild, optionsForCompiler)
 */
// Go initializes package-level vars by dependency order; OptionsDeclarations
// depends on commonOptionsWithBuild and optionsForCompiler (both defined below),
// so it is assigned after those declarations to avoid temporal-dead-zone access.
export let OptionsDeclarations: GoSlice<GoPtr<CommandLineOption>> = undefined as never;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::varGroup::commonOptionsWithBuild","kind":"varGroup","status":"implemented","sigHash":"2c17198da8a392c5648ccb2c395f017b90231ded77bd50210550ea220477854b","bodyHash":"f160ff5b514596093f18a27bc5cc6acf24c64dcdae1099e5513290d1b094cc28"}
 *
 * Go source:
 * var commonOptionsWithBuild = []*CommandLineOption{
 * 	//******* commonOptionsWithBuild *******
 * 	{
 * 		Name:                     "help",
 * 		ShortName:                "h",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		IsCommandLineOnly:        true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Print_this_message,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                    "help",
 * 		ShortName:               "?",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		IsCommandLineOnly:       true,
 * 		Category:                diagnostics.Command_line_Options,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                     "watch",
 * 		ShortName:                "w",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		IsCommandLineOnly:        true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Watch_input_files,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                     "preserveWatchOutput",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: false,
 * 		Category:                 diagnostics.Output_Formatting,
 * 		Description:              diagnostics.Disable_wiping_the_console_in_watch_mode,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                    "listFiles",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Print_all_of_the_files_read_during_the_compilation,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "explainFiles",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Print_files_read_during_the_compilation_including_why_it_was_included,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "listEmittedFiles",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Print_the_names_of_emitted_files_after_a_compilation,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                     "pretty",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Output_Formatting,
 * 		Description:              diagnostics.Enable_color_and_formatting_in_TypeScript_s_output_to_make_compiler_errors_easier_to_read,
 * 		DefaultValueDescription:  true,
 * 	},
 * 	{
 * 		Name:                    "traceResolution",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Log_paths_used_during_the_moduleResolution_process,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "diagnostics",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Output_compiler_performance_information_after_building,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "extendedDiagnostics",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Output_more_detailed_compiler_performance_information_after_building,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "generateCpuProfile",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		IsFilePath:              true,
 * 		Category:                diagnostics.Compiler_Diagnostics,
 * 		Description:             diagnostics.Emit_a_v8_CPU_profile_of_the_compiler_run_for_debugging,
 * 		DefaultValueDescription: "profile.cpuprofile",
 * 	},
 * 
 * 	{
 * 		Name:        "generateTrace",
 * 		Kind:        CommandLineOptionTypeString,
 * 		IsFilePath:  true,
 * 		Category:    diagnostics.Compiler_Diagnostics,
 * 		Description: diagnostics.Generates_an_event_trace_and_a_list_of_types,
 * 	},
 * 	{
 * 		Name:                    "incremental",
 * 		ShortName:               "i",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Projects,
 * 		Description:             diagnostics.Save_tsbuildinfo_files_to_allow_for_incremental_compilation_of_projects,
 * 		transpileOptionValue:    core.TSUnknown,
 * 		DefaultValueDescription: diagnostics.X_false_unless_composite_is_set,
 * 	},
 * 	{
 * 		Name:      "declaration",
 * 		ShortName: "d",
 * 		Kind:      CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		transpileOptionValue:     core.TSUnknown,
 * 		Description:              diagnostics.Generate_d_ts_files_from_TypeScript_and_JavaScript_files_in_your_project,
 * 		DefaultValueDescription:  diagnostics.X_false_unless_composite_is_set,
 * 	},
 * 	{
 * 		Name: "declarationMap",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		DefaultValueDescription:  false,
 * 		Description:              diagnostics.Create_sourcemaps_for_d_ts_files,
 * 	},
 * 	{
 * 		Name: "emitDeclarationOnly",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		Description:              diagnostics.Only_output_d_ts_files_and_not_JavaScript_files,
 * 		transpileOptionValue:     core.TSUnknown,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name: "sourceMap",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		DefaultValueDescription:  false,
 * 		Description:              diagnostics.Create_source_map_files_for_emitted_JavaScript_files,
 * 	},
 * 	{
 * 		Name: "inlineSourceMap",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Include_sourcemap_files_inside_the_emitted_JavaScript,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                     "noCheck",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: false,
 * 		Category:                 diagnostics.Compiler_Diagnostics,
 * 		Description:              diagnostics.Disable_full_type_checking_only_critical_parse_and_emit_errors_will_be_reported,
 * 		transpileOptionValue:     core.TSTrue,
 * 		DefaultValueDescription:  false,
 * 		// Not setting affectsSemanticDiagnostics or affectsBuildInfo because we dont want all diagnostics to go away, its handled in builder
 * 	},
 * 	{
 * 		Name:                    "deduplicatePackages",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Type_Checking,
 * 		Description:             diagnostics.Deduplicate_packages_with_the_same_name_and_version,
 * 		DefaultValueDescription: true,
 * 		AffectsProgramStructure: true,
 * 	},
 * 	{
 * 		Name:                     "noEmit",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		Description:              diagnostics.Disable_emitting_files_from_a_compilation,
 * 		transpileOptionValue:     core.TSUnknown,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                       "assumeChangesOnlyAffectDirectDependencies",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsEmit:                true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Watch_and_Build_Modes,
 * 		Description:                diagnostics.Have_recompiles_in_projects_that_use_incremental_and_watch_mode_assume_that_changes_within_a_file_will_only_affect_files_directly_depending_on_it,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                    "locale",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		Category:                diagnostics.Command_line_Options,
 * 		IsCommandLineOnly:       true,
 * 		Description:             diagnostics.Set_the_language_of_the_messaging_from_TypeScript_This_does_not_affect_emit,
 * 		DefaultValueDescription: diagnostics.Platform_specific,
 * 		extraValidation:         extraValidationLocale,
 * 	},
 * 
 * 	{
 * 		Name:        "quiet",
 * 		ShortName:   "q",
 * 		Kind:        CommandLineOptionTypeBoolean,
 * 		Category:    diagnostics.Command_line_Options,
 * 		Description: diagnostics.Do_not_print_diagnostics,
 * 	},
 * 	{
 * 		Name:        "singleThreaded",
 * 		Kind:        CommandLineOptionTypeBoolean,
 * 		Category:    diagnostics.Command_line_Options,
 * 		Description: diagnostics.Run_in_single_threaded_mode,
 * 	},
 * 	{
 * 		Name:        "pprofDir",
 * 		Kind:        CommandLineOptionTypeString,
 * 		IsFilePath:  true,
 * 		Category:    diagnostics.Command_line_Options,
 * 		Description: diagnostics.Generate_pprof_CPU_Slashmemory_profiles_to_the_given_directory,
 * 	},
 * 	{
 * 		Name:                    "checkers",
 * 		Kind:                    CommandLineOptionTypeNumber,
 * 		Category:                diagnostics.Command_line_Options,
 * 		Description:             diagnostics.Set_the_number_of_checkers_per_project,
 * 		DefaultValueDescription: diagnostics.X_4_unless_singleThreaded_is_passed,
 * 		minValue:                1,
 * 	},
 * }
 */
export const commonOptionsWithBuild: GoSlice<GoPtr<CommandLineOption>> = [
  //******* commonOptionsWithBuild *******
  newCommandLineOption({
    Name: "help",
    ShortName: "h",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    IsCommandLineOnly: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Print_this_message,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "help",
    ShortName: "?",
    Kind: CommandLineOptionTypeBoolean,
    IsCommandLineOnly: true,
    Category: diagnostics.Command_line_Options,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "watch",
    ShortName: "w",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    IsCommandLineOnly: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Watch_input_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "preserveWatchOutput",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: false,
    Category: diagnostics.Output_Formatting,
    Description: diagnostics.Disable_wiping_the_console_in_watch_mode,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "listFiles",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Print_all_of_the_files_read_during_the_compilation,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "explainFiles",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Print_files_read_during_the_compilation_including_why_it_was_included,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "listEmittedFiles",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Print_the_names_of_emitted_files_after_a_compilation,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "pretty",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Output_Formatting,
    Description: diagnostics.Enable_color_and_formatting_in_TypeScript_s_output_to_make_compiler_errors_easier_to_read,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "traceResolution",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Log_paths_used_during_the_moduleResolution_process,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "diagnostics",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Output_compiler_performance_information_after_building,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "extendedDiagnostics",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Output_more_detailed_compiler_performance_information_after_building,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "generateCpuProfile",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Emit_a_v8_CPU_profile_of_the_compiler_run_for_debugging,
    DefaultValueDescription: "profile.cpuprofile",
  }),

  newCommandLineOption({
    Name: "generateTrace",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Generates_an_event_trace_and_a_list_of_types,
  }),
  newCommandLineOption({
    Name: "incremental",
    ShortName: "i",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Projects,
    Description: diagnostics.Save_tsbuildinfo_files_to_allow_for_incremental_compilation_of_projects,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: diagnostics.X_false_unless_composite_is_set,
  }),
  newCommandLineOption({
    Name: "declaration",
    ShortName: "d",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    transpileOptionValue: TSUnknown,
    Description: diagnostics.Generate_d_ts_files_from_TypeScript_and_JavaScript_files_in_your_project,
    DefaultValueDescription: diagnostics.X_false_unless_composite_is_set,
  }),
  newCommandLineOption({
    Name: "declarationMap",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    DefaultValueDescription: false,
    Description: diagnostics.Create_sourcemaps_for_d_ts_files,
  }),
  newCommandLineOption({
    Name: "emitDeclarationOnly",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Only_output_d_ts_files_and_not_JavaScript_files,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "sourceMap",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    DefaultValueDescription: false,
    Description: diagnostics.Create_source_map_files_for_emitted_JavaScript_files,
  }),
  newCommandLineOption({
    Name: "inlineSourceMap",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Include_sourcemap_files_inside_the_emitted_JavaScript,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noCheck",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: false,
    Category: diagnostics.Compiler_Diagnostics,
    Description: diagnostics.Disable_full_type_checking_only_critical_parse_and_emit_errors_will_be_reported,
    transpileOptionValue: TSTrue,
    DefaultValueDescription: false,
    // Not setting affectsSemanticDiagnostics or affectsBuildInfo because we dont want all diagnostics to go away, its handled in builder
  }),
  newCommandLineOption({
    Name: "deduplicatePackages",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Deduplicate_packages_with_the_same_name_and_version,
    DefaultValueDescription: true,
    AffectsProgramStructure: true,
  }),
  newCommandLineOption({
    Name: "noEmit",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Disable_emitting_files_from_a_compilation,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "assumeChangesOnlyAffectDirectDependencies",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Watch_and_Build_Modes,
    Description: diagnostics.Have_recompiles_in_projects_that_use_incremental_and_watch_mode_assume_that_changes_within_a_file_will_only_affect_files_directly_depending_on_it,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "locale",
    Kind: CommandLineOptionTypeString,
    Category: diagnostics.Command_line_Options,
    IsCommandLineOnly: true,
    Description: diagnostics.Set_the_language_of_the_messaging_from_TypeScript_This_does_not_affect_emit,
    DefaultValueDescription: diagnostics.Platform_specific,
    extraValidation: extraValidationLocale,
  }),

  newCommandLineOption({
    Name: "quiet",
    ShortName: "q",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Do_not_print_diagnostics,
  }),
  newCommandLineOption({
    Name: "singleThreaded",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Run_in_single_threaded_mode,
  }),
  newCommandLineOption({
    Name: "pprofDir",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Generate_pprof_CPU_Slashmemory_profiles_to_the_given_directory,
  }),
  newCommandLineOption({
    Name: "checkers",
    Kind: CommandLineOptionTypeNumber,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Set_the_number_of_checkers_per_project,
    DefaultValueDescription: diagnostics.X_4_unless_singleThreaded_is_passed,
    minValue: 1,
  }),
];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::varGroup::optionsForCompiler","kind":"varGroup","status":"implemented","sigHash":"fa4bb14e8d99112772f4e0b52ac9a7c0a496523ef68f5707540008ac53356a71","bodyHash":"2ec3d10dffaaa980a091340cb0d53a1b89dca6c6f4f325c7ebe0a79c9d0e983b"}
 *
 * Go source:
 * var optionsForCompiler = []*CommandLineOption{
 * 	//******* compilerOptions not common with --build *******
 * 
 * 	// CommandLine only options
 * 	{
 * 		Name:                     "all",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Show_all_compiler_options,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                     "version",
 * 		ShortName:                "v",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Print_the_compiler_s_version,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                     "init",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Initializes_a_TypeScript_project_and_creates_a_tsconfig_json_file,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                     "project",
 * 		ShortName:                "p",
 * 		Kind:                     CommandLineOptionTypeString,
 * 		IsFilePath:               true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		Description:              diagnostics.Compile_the_project_given_the_path_to_its_configuration_file_or_to_a_folder_with_a_tsconfig_json,
 * 	},
 * 	{
 * 		Name:                     "showConfig",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		IsCommandLineOnly:        true,
 * 		Description:              diagnostics.Print_the_final_configuration_instead_of_building,
 * 		DefaultValueDescription:  false,
 * 	},
 * 	{
 * 		Name:                    "listFilesOnly",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Command_line_Options,
 * 		IsCommandLineOnly:       true,
 * 		Description:             diagnostics.Print_names_of_files_that_are_part_of_the_compilation_and_then_stop_processing,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                     "ignoreConfig",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Command_line_Options,
 * 		IsCommandLineOnly:        true,
 * 		Description:              diagnostics.Ignore_the_tsconfig_found_and_build_with_commandline_options_and_files,
 * 		DefaultValueDescription:  false,
 * 	},
 * 
 * 	// Basic
 * 	// targetOptionDeclaration,
 * 	{
 * 		Name:                     "target",
 * 		ShortName:                "t",
 * 		Kind:                     CommandLineOptionTypeEnum, // targetOptionMap
 * 		AffectsSourceFile:        true,
 * 		AffectsModuleResolution:  true,
 * 		AffectsEmit:              true,
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Language_and_Environment,
 * 		Description:              diagnostics.Set_the_JavaScript_language_version_for_emitted_JavaScript_and_include_compatible_library_declarations,
 * 		DefaultValueDescription:  core.ScriptTargetLatestStandard,
 * 	},
 * 
 * 	// moduleOptionDeclaration,
 * 	{
 * 		Name:                     "module",
 * 		ShortName:                "m",
 * 		Kind:                     CommandLineOptionTypeEnum, // moduleOptionMap
 * 		AffectsModuleResolution:  true,
 * 		AffectsEmit:              true,
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Modules,
 * 		Description:              diagnostics.Specify_what_module_code_is_generated,
 * 		DefaultValueDescription:  core.TSUnknown,
 * 	},
 * 	{
 * 		Name: "lib",
 * 		Kind: CommandLineOptionTypeList,
 * 		// elements: &CommandLineOption{
 * 		// 	name:                    "lib",
 * 		// 	kind:                   CommandLineOptionTypeEnum, // libMap,
 * 		// 	defaultValueDescription: core.TSUnknown,
 * 		// },
 * 		AffectsProgramStructure:  true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Language_and_Environment,
 * 		Description:              diagnostics.Specify_a_set_of_bundled_library_declaration_files_that_describe_the_target_runtime_environment,
 * 		transpileOptionValue:     core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                     "allowJs",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		allowJsFlag:              true,
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.JavaScript_Support,
 * 		Description:              diagnostics.Allow_JavaScript_files_to_be_a_part_of_your_program_Use_the_checkJs_option_to_get_errors_from_these_files,
 * 		DefaultValueDescription:  diagnostics.X_false_unless_checkJs_is_set,
 * 	},
 * 	{
 * 		Name:                       "checkJs",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution:    true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		ShowInSimplifiedHelpView:   true,
 * 		Category:                   diagnostics.JavaScript_Support,
 * 		Description:                diagnostics.Enable_error_reporting_in_type_checked_JavaScript_files,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                    "jsx",
 * 		Kind:                    CommandLineOptionTypeEnum, // jsxOptionMap,
 * 		AffectsSourceFile:       true,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		AffectsModuleResolution: true,
 * 		// The checker emits an error when it sees JSX but this option is not set in compilerOptions.
 * 		// This is effectively a semantic error, so mark this option as affecting semantic diagnostics
 * 		// so we know to refresh errors when this option is changed.
 * 		AffectsSemanticDiagnostics: true,
 * 		ShowInSimplifiedHelpView:   true,
 * 		Category:                   diagnostics.Language_and_Environment,
 * 		Description:                diagnostics.Specify_what_JSX_code_is_generated,
 * 		DefaultValueDescription:    core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                     "outFile",
 * 		Kind:                     CommandLineOptionTypeString,
 * 		AffectsEmit:              true,
 * 		AffectsBuildInfo:         true,
 * 		AffectsDeclarationPath:   true,
 * 		IsFilePath:               true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		Description:              diagnostics.Specify_a_file_that_bundles_all_outputs_into_one_JavaScript_file_If_declaration_is_true_also_designates_a_file_that_bundles_all_d_ts_output,
 * 		transpileOptionValue:     core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                     "outDir",
 * 		Kind:                     CommandLineOptionTypeString,
 * 		AffectsEmit:              true,
 * 		AffectsBuildInfo:         true,
 * 		AffectsDeclarationPath:   true,
 * 		IsFilePath:               true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		Description:              diagnostics.Specify_an_output_folder_for_all_emitted_files,
 * 	},
 * 	{
 * 		Name:                    "rootDir",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		AffectsDeclarationPath:  true,
 * 		IsFilePath:              true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Specify_the_root_folder_within_your_source_files,
 * 		DefaultValueDescription: diagnostics.Computed_from_the_list_of_input_files,
 * 	},
 * 	{
 * 		Name: "composite",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Not setting affectsEmit because we calculate this flag might not affect full emit
 * 		AffectsBuildInfo:        true,
 * 		IsTSConfigOnly:          true,
 * 		Category:                diagnostics.Projects,
 * 		transpileOptionValue:    core.TSUnknown,
 * 		DefaultValueDescription: false,
 * 		Description:             diagnostics.Enable_constraints_that_allow_a_TypeScript_project_to_be_used_with_project_references,
 * 	},
 * 	{
 * 		Name:                    "tsBuildInfoFile",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		IsFilePath:              true,
 * 		Category:                diagnostics.Projects,
 * 		transpileOptionValue:    core.TSUnknown,
 * 		DefaultValueDescription: ".tsbuildinfo",
 * 		Description:             diagnostics.Specify_the_path_to_tsbuildinfo_incremental_compilation_file,
 * 	},
 * 	{
 * 		Name:                     "removeComments",
 * 		Kind:                     CommandLineOptionTypeBoolean,
 * 		AffectsEmit:              true,
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Emit,
 * 		DefaultValueDescription:  false,
 * 		Description:              diagnostics.Disable_emitting_comments,
 * 	},
 * 	{
 * 		Name:                    "importHelpers",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		AffectsSourceFile:       true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Allow_importing_helper_functions_from_tslib_once_per_project_instead_of_including_them_per_file,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "downlevelIteration",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Emit_more_compliant_but_verbose_and_less_performant_JavaScript_for_iteration,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "isolatedModules",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Interop_Constraints,
 * 		Description:             diagnostics.Ensure_that_each_file_can_be_safely_transpiled_without_relying_on_other_imports,
 * 		transpileOptionValue:    core.TSTrue,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                       "verbatimModuleSyntax",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsEmit:                true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Interop_Constraints,
 * 		Description:                diagnostics.Do_not_transform_or_elide_any_imports_or_exports_not_marked_as_type_only_ensuring_they_are_written_in_the_output_file_s_format_based_on_the_module_setting,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "isolatedDeclarations",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		Category:                   diagnostics.Interop_Constraints,
 * 		Description:                diagnostics.Require_sufficient_annotation_on_exports_so_other_tools_can_trivially_generate_declaration_files,
 * 		DefaultValueDescription:    false,
 * 		AffectsBuildInfo:           true,
 * 		AffectsSemanticDiagnostics: true,
 * 	},
 * 	{
 * 		Name:                       "erasableSyntaxOnly",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		Category:                   diagnostics.Interop_Constraints,
 * 		Description:                diagnostics.Do_not_allow_runtime_constructs_that_are_not_part_of_ECMAScript,
 * 		DefaultValueDescription:    false,
 * 		AffectsBuildInfo:           true,
 * 		AffectsSemanticDiagnostics: true,
 * 	},
 * 	{
 * 		Name:                    "libReplacement",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsProgramStructure: true,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		Description:             diagnostics.Enable_lib_replacement,
 * 		DefaultValueDescription: false,
 * 	},
 * 
 * 	// Strict Type Checks
 * 	{
 * 		Name: "strict",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// Though this affects semantic diagnostics, affectsSemanticDiagnostics is not set here
 * 		// The value of each strictFlag depends on own strictFlag value or this and never accessed directly.
 * 		// But we need to store `strict` in builf info, even though it won't be examined directly, so that the
 * 		// flags it controls (e.g. `strictNullChecks`) will be retrieved correctly
 * 		AffectsBuildInfo:         true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Type_Checking,
 * 		Description:              diagnostics.Enable_all_strict_type_checking_options,
 * 		DefaultValueDescription:  true,
 * 	},
 * 	{
 * 		Name:                       "noImplicitAny",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enable_error_reporting_for_expressions_and_declarations_with_an_implied_any_type,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "strictNullChecks",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.When_type_checking_take_into_account_null_and_undefined,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "strictFunctionTypes",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.When_assigning_functions_check_to_ensure_parameters_and_the_return_values_are_subtype_compatible,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "strictBindCallApply",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Check_that_the_arguments_for_bind_call_and_apply_methods_match_the_original_function,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "strictPropertyInitialization",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Check_for_class_properties_that_are_declared_but_not_set_in_the_constructor,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "strictBuiltinIteratorReturn",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Built_in_iterators_are_instantiated_with_a_TReturn_type_of_undefined_instead_of_any,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "noImplicitThis",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enable_error_reporting_when_this_is_given_the_type_any,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                       "useUnknownInCatchVariables",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		strictFlag:                 true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Default_catch_clause_variables_as_unknown_instead_of_any,
 * 		DefaultValueDescription:    diagnostics.X_true_unless_strict_is_false,
 * 	},
 * 	{
 * 		Name:                    "alwaysStrict",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsSourceFile:       true,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Type_Checking,
 * 		Description:             diagnostics.Ensure_use_strict_is_always_emitted,
 * 		DefaultValueDescription: true,
 * 	},
 * 	{
 * 		Name:                       "stableTypeOrdering",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Ensure_types_are_ordered_stably_and_deterministically_across_compilations,
 * 		DefaultValueDescription:    true,
 * 	},
 * 
 * 	// Additional Checks
 * 	{
 * 		Name:                       "noUnusedLocals",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enable_error_reporting_when_local_variables_aren_t_read,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noUnusedParameters",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Raise_an_error_when_a_function_parameter_isn_t_read,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "exactOptionalPropertyTypes",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Interpret_optional_property_types_as_written_rather_than_adding_undefined,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noImplicitReturns",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enable_error_reporting_for_codepaths_that_do_not_explicitly_return_in_a_function,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noFallthroughCasesInSwitch",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsBindDiagnostics:     true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enable_error_reporting_for_fallthrough_cases_in_switch_statements,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noUncheckedIndexedAccess",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Add_undefined_to_a_type_when_accessed_using_an_index,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noImplicitOverride",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Ensure_overriding_members_in_derived_classes_are_marked_with_an_override_modifier,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "noPropertyAccessFromIndexSignature",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		ShowInSimplifiedHelpView:   false,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Enforces_using_indexed_accessors_for_keys_declared_using_an_indexed_type,
 * 		DefaultValueDescription:    false,
 * 	},
 * 
 * 	// Module Resolution
 * 	{
 * 		Name: "moduleResolution",
 * 		Kind: CommandLineOptionTypeEnum,
 * 		//    new Map(Object.entries({
 * 		//         // N.B. The first entry specifies the value shown in `tsc --init`
 * 		//         node10: ModuleResolutionKind.Node10,
 * 		//         node: ModuleResolutionKind.Node10,
 * 		//         classic: ModuleResolutionKind.Classic,
 * 		//         node16: ModuleResolutionKind.Node16,
 * 		//         nodenext: ModuleResolutionKind.NodeNext,
 * 		//         bundler: ModuleResolutionKind.Bundler,
 * 		//     })),
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Specify_how_TypeScript_looks_up_a_file_from_a_given_module_specifier,
 * 		DefaultValueDescription: diagnostics.X_nodenext_if_module_is_nodenext_node16_if_module_is_node16_or_node18_otherwise_bundler,
 * 	},
 * 	{
 * 		Name:                    "baseUrl",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		AffectsModuleResolution: true,
 * 		IsFilePath:              true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Specify_the_base_directory_to_resolve_non_relative_module_names,
 * 	},
 * 	{
 * 		// this option can only be specified in tsconfig.json
 * 		// use type = object to copy the value as-is
 * 		Name:                               "paths",
 * 		Kind:                               CommandLineOptionTypeObject,
 * 		AffectsModuleResolution:            true,
 * 		allowConfigDirTemplateSubstitution: true,
 * 		IsTSConfigOnly:                     true,
 * 		Category:                           diagnostics.Modules,
 * 		Description:                        diagnostics.Specify_a_set_of_entries_that_re_map_imports_to_additional_lookup_locations,
 * 		transpileOptionValue:               core.TSUnknown,
 * 	},
 * 	{
 * 		// this option can only be specified in tsconfig.json
 * 		// use type = object to copy the value as-is
 * 		Name:                               "rootDirs",
 * 		Kind:                               CommandLineOptionTypeList,
 * 		IsTSConfigOnly:                     true,
 * 		AffectsModuleResolution:            true,
 * 		allowConfigDirTemplateSubstitution: true,
 * 		Category:                           diagnostics.Modules,
 * 		Description:                        diagnostics.Allow_multiple_folders_to_be_treated_as_one_when_resolving_modules,
 * 		transpileOptionValue:               core.TSUnknown,
 * 		DefaultValueDescription:            diagnostics.Computed_from_the_list_of_input_files,
 * 	},
 * 	{
 * 		Name:                               "typeRoots",
 * 		Kind:                               CommandLineOptionTypeList,
 * 		AffectsModuleResolution:            true,
 * 		allowConfigDirTemplateSubstitution: true,
 * 		Category:                           diagnostics.Modules,
 * 		Description:                        diagnostics.Specify_multiple_folders_that_act_like_Slashnode_modules_Slash_types,
 * 	},
 * 	{
 * 		Name:                     "types",
 * 		Kind:                     CommandLineOptionTypeList,
 * 		AffectsProgramStructure:  true,
 * 		ShowInSimplifiedHelpView: true,
 * 		Category:                 diagnostics.Modules,
 * 		Description:              diagnostics.Specify_type_package_names_to_be_included_without_being_referenced_in_a_source_file,
 * 		transpileOptionValue:     core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                       "allowSyntheticDefaultImports",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Interop_Constraints,
 * 		Description:                diagnostics.Allow_import_x_from_y_when_a_module_doesn_t_have_a_default_export,
 * 		DefaultValueDescription:    true,
 * 	},
 * 	{
 * 		Name:                       "esModuleInterop",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsEmit:                true,
 * 		AffectsBuildInfo:           true,
 * 		ShowInSimplifiedHelpView:   true,
 * 		Category:                   diagnostics.Interop_Constraints,
 * 		Description:                diagnostics.Emit_additional_JavaScript_to_ease_support_for_importing_CommonJS_modules_This_enables_allowSyntheticDefaultImports_for_type_compatibility,
 * 		DefaultValueDescription:    true,
 * 	},
 * 	{
 * 		Name:                    "preserveSymlinks",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Interop_Constraints,
 * 		Description:             diagnostics.Disable_resolving_symlinks_to_their_realpath_This_correlates_to_the_same_flag_in_node,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                       "allowUmdGlobalAccess",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Modules,
 * 		Description:                diagnostics.Allow_accessing_UMD_globals_from_modules,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                    "moduleSuffixes",
 * 		Kind:                    CommandLineOptionTypeList,
 * 		listPreserveFalsyValues: true,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.List_of_file_name_suffixes_to_search_when_resolving_a_module,
 * 	},
 * 	{
 * 		Name:                       "allowImportingTsExtensions",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Modules,
 * 		Description:                diagnostics.Allow_imports_to_include_TypeScript_file_extensions_Requires_moduleResolution_bundler_and_either_noEmit_or_emitDeclarationOnly_to_be_set,
 * 		DefaultValueDescription:    false,
 * 		transpileOptionValue:       core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                       "rewriteRelativeImportExtensions",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Modules,
 * 		Description:                diagnostics.Rewrite_ts_tsx_mts_and_cts_file_extensions_in_relative_import_paths_to_their_JavaScript_equivalent_in_output_files,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                    "resolvePackageJsonExports",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Use_the_package_json_exports_field_when_resolving_package_imports,
 * 		DefaultValueDescription: diagnostics.X_true_when_moduleResolution_is_node16_nodenext_or_bundler_otherwise_false,
 * 	},
 * 	{
 * 		Name:                    "resolvePackageJsonImports",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Use_the_package_json_imports_field_when_resolving_imports,
 * 		DefaultValueDescription: diagnostics.X_true_when_moduleResolution_is_node16_nodenext_or_bundler_otherwise_false,
 * 	},
 * 	{
 * 		Name:                    "customConditions",
 * 		Kind:                    CommandLineOptionTypeList,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Conditions_to_set_in_addition_to_the_resolver_specific_defaults_when_resolving_imports,
 * 	},
 * 	{
 * 		Name:                       "noUncheckedSideEffectImports",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Modules,
 * 		Description:                diagnostics.Check_side_effect_imports,
 * 		DefaultValueDescription:    true,
 * 	},
 * 
 * 	// Source Maps
 * 	{
 * 		Name:             "sourceRoot",
 * 		Kind:             CommandLineOptionTypeString,
 * 		AffectsEmit:      true,
 * 		AffectsBuildInfo: true,
 * 		Category:         diagnostics.Emit,
 * 		Description:      diagnostics.Specify_the_root_path_for_debuggers_to_find_the_reference_source_code,
 * 	},
 * 	{
 * 		Name:             "mapRoot",
 * 		Kind:             CommandLineOptionTypeString,
 * 		AffectsEmit:      true,
 * 		AffectsBuildInfo: true,
 * 		Category:         diagnostics.Emit,
 * 		Description:      diagnostics.Specify_the_location_where_debugger_should_locate_map_files_instead_of_generated_locations,
 * 	},
 * 	{
 * 		Name:                    "inlineSources",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Include_source_code_in_the_sourcemaps_inside_the_emitted_JavaScript,
 * 		DefaultValueDescription: false,
 * 	},
 * 
 * 	// Experimental
 * 	{
 * 		Name:                       "experimentalDecorators",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsEmit:                true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Language_and_Environment,
 * 		Description:                diagnostics.Enable_experimental_support_for_legacy_experimental_decorators,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                       "emitDecoratorMetadata",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsEmit:                true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Language_and_Environment,
 * 		Description:                diagnostics.Emit_design_type_metadata_for_decorated_declarations_in_source_files,
 * 		DefaultValueDescription:    false,
 * 	},
 * 
 * 	// Advanced
 * 	{
 * 		Name:                    "jsxFactory",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		Description:             diagnostics.Specify_the_JSX_factory_function_used_when_targeting_React_JSX_emit_e_g_React_createElement_or_h,
 * 		DefaultValueDescription: "`React.createElement`",
 * 	},
 * 	{
 * 		Name:                    "jsxFragmentFactory",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		Description:             diagnostics.Specify_the_JSX_Fragment_reference_used_for_fragments_when_targeting_React_JSX_emit_e_g_React_Fragment_or_Fragment,
 * 		DefaultValueDescription: "React.Fragment",
 * 	},
 * 	{
 * 		Name:                       "jsxImportSource",
 * 		Kind:                       CommandLineOptionTypeString,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsEmit:                true,
 * 		AffectsBuildInfo:           true,
 * 		AffectsModuleResolution:    true,
 * 		AffectsSourceFile:          true,
 * 		Category:                   diagnostics.Language_and_Environment,
 * 		Description:                diagnostics.Specify_module_specifier_used_to_import_the_JSX_factory_functions_when_using_jsx_Colon_react_jsx_Asterisk,
 * 		DefaultValueDescription:    "react",
 * 	},
 * 	{
 * 		Name:                    "resolveJsonModule",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Enable_importing_json_files,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "allowArbitraryExtensions",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsProgramStructure: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Enable_importing_files_with_any_extension_provided_a_declaration_file_is_present,
 * 		DefaultValueDescription: false,
 * 	},
 * 
 * 	{
 * 		Name:                    "reactNamespace",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		Description:             diagnostics.Specify_the_object_invoked_for_createElement_This_only_applies_when_targeting_react_JSX_emit,
 * 		DefaultValueDescription: "`React`",
 * 	},
 * 	{
 * 		Name: "skipDefaultLibCheck",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// We need to store these to determine whether `lib` files need to be rechecked
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Completeness,
 * 		Description:             diagnostics.Skip_type_checking_d_ts_files_that_are_included_with_TypeScript,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "emitBOM",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Emit_a_UTF_8_Byte_Order_Mark_BOM_in_the_beginning_of_output_files,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "newLine",
 * 		Kind:                    CommandLineOptionTypeEnum, // newLineOptionMap,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Set_the_newline_character_for_emitting_files,
 * 		DefaultValueDescription: "lf",
 * 	},
 * 	{
 * 		Name:                       "noErrorTruncation",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Output_Formatting,
 * 		Description:                diagnostics.Disable_truncating_types_in_error_messages,
 * 		DefaultValueDescription:    false,
 * 	},
 * 	{
 * 		Name:                    "noLib",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		AffectsProgramStructure: true,
 * 		Description:             diagnostics.Disable_including_any_library_files_including_the_default_lib_d_ts,
 * 		// We are not returning a sourceFile for lib file when asked by the program,
 * 		// so pass --noLib to avoid reporting a file not found error.
 * 		transpileOptionValue:    core.TSTrue,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "noResolve",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Modules,
 * 		Description:             diagnostics.Disallow_import_s_require_s_or_reference_s_from_expanding_the_number_of_files_TypeScript_should_add_to_a_project,
 * 		// We are not doing a full typecheck, we are not resolving the whole context,
 * 		// so pass --noResolve to avoid reporting missing file errors.
 * 		transpileOptionValue:    core.TSTrue,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "stripInternal",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Disable_emitting_declarations_that_have_internal_in_their_JSDoc_comments,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "disableSizeLimit",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsProgramStructure: true,
 * 		Category:                diagnostics.Editor_Support,
 * 		Description:             diagnostics.Remove_the_20mb_cap_on_total_source_code_size_for_JavaScript_files_in_the_TypeScript_language_server,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "disableSourceOfProjectReferenceRedirect",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		IsTSConfigOnly:          true,
 * 		Category:                diagnostics.Projects,
 * 		Description:             diagnostics.Disable_preferring_source_files_instead_of_declaration_files_when_referencing_composite_projects,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "disableSolutionSearching",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		IsTSConfigOnly:          true,
 * 		Category:                diagnostics.Projects,
 * 		Description:             diagnostics.Opt_a_project_out_of_multi_project_reference_checking_when_editing,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "disableReferencedProjectLoad",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		IsTSConfigOnly:          true,
 * 		Category:                diagnostics.Projects,
 * 		Description:             diagnostics.Reduce_the_number_of_projects_loaded_automatically_by_TypeScript,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "noEmitHelpers",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Disable_generating_custom_helper_functions_like_extends_in_compiled_output,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "noEmitOnError",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		transpileOptionValue:    core.TSUnknown,
 * 		Description:             diagnostics.Disable_emitting_files_if_any_type_checking_errors_are_reported,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                    "preserveConstEnums",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsEmit:             true,
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Emit,
 * 		Description:             diagnostics.Disable_erasing_const_enum_declarations_in_generated_code,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                   "declarationDir",
 * 		Kind:                   CommandLineOptionTypeString,
 * 		AffectsEmit:            true,
 * 		AffectsBuildInfo:       true,
 * 		AffectsDeclarationPath: true,
 * 		IsFilePath:             true,
 * 		Category:               diagnostics.Emit,
 * 		transpileOptionValue:   core.TSUnknown,
 * 		Description:            diagnostics.Specify_the_output_directory_for_generated_declaration_files,
 * 	},
 * 	{
 * 		Name: "skipLibCheck",
 * 		Kind: CommandLineOptionTypeBoolean,
 * 		// We need to store these to determine whether `lib` files need to be rechecked
 * 		AffectsBuildInfo:        true,
 * 		Category:                diagnostics.Completeness,
 * 		Description:             diagnostics.Skip_type_checking_all_d_ts_files,
 * 		DefaultValueDescription: false,
 * 	},
 * 	{
 * 		Name:                       "allowUnusedLabels",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsBindDiagnostics:     true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Disable_error_reporting_for_unused_labels,
 * 		DefaultValueDescription:    core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                       "allowUnreachableCode",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsBindDiagnostics:     true,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Type_Checking,
 * 		Description:                diagnostics.Disable_error_reporting_for_unreachable_code,
 * 		DefaultValueDescription:    core.TSUnknown,
 * 	},
 * 	{
 * 		Name:                    "forceConsistentCasingInFileNames",
 * 		Kind:                    CommandLineOptionTypeBoolean,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.Interop_Constraints,
 * 		Description:             diagnostics.Ensure_that_casing_is_correct_in_imports,
 * 		DefaultValueDescription: true,
 * 	},
 * 	{
 * 		Name:                    "maxNodeModuleJsDepth",
 * 		Kind:                    CommandLineOptionTypeNumber,
 * 		AffectsModuleResolution: true,
 * 		Category:                diagnostics.JavaScript_Support,
 * 		Description:             diagnostics.Specify_the_maximum_folder_depth_used_for_checking_JavaScript_files_from_node_modules_Only_applicable_with_allowJs,
 * 		DefaultValueDescription: 0,
 * 	},
 * 	{
 * 		Name:                       "useDefineForClassFields",
 * 		Kind:                       CommandLineOptionTypeBoolean,
 * 		AffectsSemanticDiagnostics: true,
 * 		AffectsEmit:                true,
 * 		AffectsBuildInfo:           true,
 * 		Category:                   diagnostics.Language_and_Environment,
 * 		Description:                diagnostics.Emit_ECMAScript_standard_compliant_class_fields,
 * 		DefaultValueDescription:    diagnostics.X_true_for_ES2022_and_above_including_ESNext,
 * 	},
 * 	{
 * 		// A list of plugins to load in the language service
 * 		Name:           "plugins",
 * 		Kind:           CommandLineOptionTypeList,
 * 		IsTSConfigOnly: true,
 * 		Description:    diagnostics.Specify_a_list_of_language_service_plugins_to_include,
 * 		Category:       diagnostics.Editor_Support,
 * 	},
 * 	{
 * 		Name:                    "moduleDetection",
 * 		Kind:                    CommandLineOptionTypeEnum,
 * 		AffectsSourceFile:       true,
 * 		AffectsModuleResolution: true,
 * 		Description:             diagnostics.Control_what_method_is_used_to_detect_module_format_JS_files,
 * 		Category:                diagnostics.Language_and_Environment,
 * 		DefaultValueDescription: diagnostics.X_auto_Colon_Treat_files_with_imports_exports_import_meta_jsx_with_jsx_Colon_react_jsx_or_esm_format_with_module_Colon_node16_as_modules,
 * 	},
 * 	{
 * 		Name:                    "ignoreDeprecations",
 * 		Kind:                    CommandLineOptionTypeString,
 * 		DefaultValueDescription: core.TSUnknown,
 * 	},
 * }
 */
export const optionsForCompiler: GoSlice<GoPtr<CommandLineOption>> = [
  //******* compilerOptions not common with --build *******

  // CommandLine only options
  newCommandLineOption({
    Name: "all",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Show_all_compiler_options,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "version",
    ShortName: "v",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Print_the_compiler_s_version,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "init",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Initializes_a_TypeScript_project_and_creates_a_tsconfig_json_file,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "project",
    ShortName: "p",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    Description: diagnostics.Compile_the_project_given_the_path_to_its_configuration_file_or_to_a_folder_with_a_tsconfig_json,
  }),
  newCommandLineOption({
    Name: "showConfig",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    IsCommandLineOnly: true,
    Description: diagnostics.Print_the_final_configuration_instead_of_building,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "listFilesOnly",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Command_line_Options,
    IsCommandLineOnly: true,
    Description: diagnostics.Print_names_of_files_that_are_part_of_the_compilation_and_then_stop_processing,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "ignoreConfig",
    Kind: CommandLineOptionTypeBoolean,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Command_line_Options,
    IsCommandLineOnly: true,
    Description: diagnostics.Ignore_the_tsconfig_found_and_build_with_commandline_options_and_files,
    DefaultValueDescription: false,
  }),

  // Basic
  // targetOptionDeclaration,
  newCommandLineOption({
    Name: "target",
    ShortName: "t",
    Kind: CommandLineOptionTypeEnum, // targetOptionMap
    AffectsSourceFile: true,
    AffectsModuleResolution: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Set_the_JavaScript_language_version_for_emitted_JavaScript_and_include_compatible_library_declarations,
    DefaultValueDescription: ScriptTargetLatestStandard,
  }),

  // moduleOptionDeclaration,
  newCommandLineOption({
    Name: "module",
    ShortName: "m",
    Kind: CommandLineOptionTypeEnum, // moduleOptionMap
    AffectsModuleResolution: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_what_module_code_is_generated,
    DefaultValueDescription: TSUnknown,
  }),
  newCommandLineOption({
    Name: "lib",
    Kind: CommandLineOptionTypeList,
    // elements: &CommandLineOption{
    // 	name:                    "lib",
    // 	kind:                   CommandLineOptionTypeEnum, // libMap,
    // 	defaultValueDescription: core.TSUnknown,
    // },
    AffectsProgramStructure: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_a_set_of_bundled_library_declaration_files_that_describe_the_target_runtime_environment,
    transpileOptionValue: TSUnknown,
  }),
  newCommandLineOption({
    Name: "allowJs",
    Kind: CommandLineOptionTypeBoolean,
    allowJsFlag: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.JavaScript_Support,
    Description: diagnostics.Allow_JavaScript_files_to_be_a_part_of_your_program_Use_the_checkJs_option_to_get_errors_from_these_files,
    DefaultValueDescription: diagnostics.X_false_unless_checkJs_is_set,
  }),
  newCommandLineOption({
    Name: "checkJs",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.JavaScript_Support,
    Description: diagnostics.Enable_error_reporting_in_type_checked_JavaScript_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "jsx",
    Kind: CommandLineOptionTypeEnum, // jsxOptionMap,
    AffectsSourceFile: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsModuleResolution: true,
    // The checker emits an error when it sees JSX but this option is not set in compilerOptions.
    // This is effectively a semantic error, so mark this option as affecting semantic diagnostics
    // so we know to refresh errors when this option is changed.
    AffectsSemanticDiagnostics: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_what_JSX_code_is_generated,
    DefaultValueDescription: TSUnknown,
  }),
  newCommandLineOption({
    Name: "outFile",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsDeclarationPath: true,
    IsFilePath: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Specify_a_file_that_bundles_all_outputs_into_one_JavaScript_file_If_declaration_is_true_also_designates_a_file_that_bundles_all_d_ts_output,
    transpileOptionValue: TSUnknown,
  }),
  newCommandLineOption({
    Name: "outDir",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsDeclarationPath: true,
    IsFilePath: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Specify_an_output_folder_for_all_emitted_files,
  }),
  newCommandLineOption({
    Name: "rootDir",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsDeclarationPath: true,
    IsFilePath: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_the_root_folder_within_your_source_files,
    DefaultValueDescription: diagnostics.Computed_from_the_list_of_input_files,
  }),
  newCommandLineOption({
    Name: "composite",
    Kind: CommandLineOptionTypeBoolean,
    // Not setting affectsEmit because we calculate this flag might not affect full emit
    AffectsBuildInfo: true,
    IsTSConfigOnly: true,
    Category: diagnostics.Projects,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: false,
    Description: diagnostics.Enable_constraints_that_allow_a_TypeScript_project_to_be_used_with_project_references,
  }),
  newCommandLineOption({
    Name: "tsBuildInfoFile",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    IsFilePath: true,
    Category: diagnostics.Projects,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: ".tsbuildinfo",
    Description: diagnostics.Specify_the_path_to_tsbuildinfo_incremental_compilation_file,
  }),
  newCommandLineOption({
    Name: "removeComments",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Emit,
    DefaultValueDescription: false,
    Description: diagnostics.Disable_emitting_comments,
  }),
  newCommandLineOption({
    Name: "importHelpers",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsSourceFile: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Allow_importing_helper_functions_from_tslib_once_per_project_instead_of_including_them_per_file,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "downlevelIteration",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Emit_more_compliant_but_verbose_and_less_performant_JavaScript_for_iteration,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "isolatedModules",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Ensure_that_each_file_can_be_safely_transpiled_without_relying_on_other_imports,
    transpileOptionValue: TSTrue,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "verbatimModuleSyntax",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Do_not_transform_or_elide_any_imports_or_exports_not_marked_as_type_only_ensuring_they_are_written_in_the_output_file_s_format_based_on_the_module_setting,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "isolatedDeclarations",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Require_sufficient_annotation_on_exports_so_other_tools_can_trivially_generate_declaration_files,
    DefaultValueDescription: false,
    AffectsBuildInfo: true,
    AffectsSemanticDiagnostics: true,
  }),
  newCommandLineOption({
    Name: "erasableSyntaxOnly",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Do_not_allow_runtime_constructs_that_are_not_part_of_ECMAScript,
    DefaultValueDescription: false,
    AffectsBuildInfo: true,
    AffectsSemanticDiagnostics: true,
  }),
  newCommandLineOption({
    Name: "libReplacement",
    Kind: CommandLineOptionTypeBoolean,
    AffectsProgramStructure: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Enable_lib_replacement,
    DefaultValueDescription: false,
  }),

  // Strict Type Checks
  newCommandLineOption({
    Name: "strict",
    Kind: CommandLineOptionTypeBoolean,
    // Though this affects semantic diagnostics, affectsSemanticDiagnostics is not set here
    // The value of each strictFlag depends on own strictFlag value or this and never accessed directly.
    // But we need to store `strict` in builf info, even though it won't be examined directly, so that the
    // flags it controls (e.g. `strictNullChecks`) will be retrieved correctly
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_all_strict_type_checking_options,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "noImplicitAny",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_error_reporting_for_expressions_and_declarations_with_an_implied_any_type,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "strictNullChecks",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.When_type_checking_take_into_account_null_and_undefined,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "strictFunctionTypes",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.When_assigning_functions_check_to_ensure_parameters_and_the_return_values_are_subtype_compatible,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "strictBindCallApply",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Check_that_the_arguments_for_bind_call_and_apply_methods_match_the_original_function,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "strictPropertyInitialization",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Check_for_class_properties_that_are_declared_but_not_set_in_the_constructor,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "strictBuiltinIteratorReturn",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Built_in_iterators_are_instantiated_with_a_TReturn_type_of_undefined_instead_of_any,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "noImplicitThis",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_error_reporting_when_this_is_given_the_type_any,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "useUnknownInCatchVariables",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    strictFlag: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Default_catch_clause_variables_as_unknown_instead_of_any,
    DefaultValueDescription: diagnostics.X_true_unless_strict_is_false,
  }),
  newCommandLineOption({
    Name: "alwaysStrict",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSourceFile: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Ensure_use_strict_is_always_emitted,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "stableTypeOrdering",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Ensure_types_are_ordered_stably_and_deterministically_across_compilations,
    DefaultValueDescription: true,
  }),

  // Additional Checks
  newCommandLineOption({
    Name: "noUnusedLocals",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_error_reporting_when_local_variables_aren_t_read,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noUnusedParameters",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Raise_an_error_when_a_function_parameter_isn_t_read,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "exactOptionalPropertyTypes",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Interpret_optional_property_types_as_written_rather_than_adding_undefined,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noImplicitReturns",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_error_reporting_for_codepaths_that_do_not_explicitly_return_in_a_function,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noFallthroughCasesInSwitch",
    Kind: CommandLineOptionTypeBoolean,
    AffectsBindDiagnostics: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enable_error_reporting_for_fallthrough_cases_in_switch_statements,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noUncheckedIndexedAccess",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Add_undefined_to_a_type_when_accessed_using_an_index,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noImplicitOverride",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Ensure_overriding_members_in_derived_classes_are_marked_with_an_override_modifier,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noPropertyAccessFromIndexSignature",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: false,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Enforces_using_indexed_accessors_for_keys_declared_using_an_indexed_type,
    DefaultValueDescription: false,
  }),

  // Module Resolution
  newCommandLineOption({
    Name: "moduleResolution",
    Kind: CommandLineOptionTypeEnum,
    //    new Map(Object.entries({
    //         // N.B. The first entry specifies the value shown in `tsc --init`
    //         node10: ModuleResolutionKind.Node10,
    //         node: ModuleResolutionKind.Node10,
    //         classic: ModuleResolutionKind.Classic,
    //         node16: ModuleResolutionKind.Node16,
    //         nodenext: ModuleResolutionKind.NodeNext,
    //         bundler: ModuleResolutionKind.Bundler,
    //     })),
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_how_TypeScript_looks_up_a_file_from_a_given_module_specifier,
    DefaultValueDescription: diagnostics.X_nodenext_if_module_is_nodenext_node16_if_module_is_node16_or_node18_otherwise_bundler,
  }),
  newCommandLineOption({
    Name: "baseUrl",
    Kind: CommandLineOptionTypeString,
    AffectsModuleResolution: true,
    IsFilePath: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_the_base_directory_to_resolve_non_relative_module_names,
  }),
  newCommandLineOption({
    // this option can only be specified in tsconfig.json
    // use type = object to copy the value as-is
    Name: "paths",
    Kind: CommandLineOptionTypeObject,
    AffectsModuleResolution: true,
    allowConfigDirTemplateSubstitution: true,
    IsTSConfigOnly: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_a_set_of_entries_that_re_map_imports_to_additional_lookup_locations,
    transpileOptionValue: TSUnknown,
  }),
  newCommandLineOption({
    // this option can only be specified in tsconfig.json
    // use type = object to copy the value as-is
    Name: "rootDirs",
    Kind: CommandLineOptionTypeList,
    IsTSConfigOnly: true,
    AffectsModuleResolution: true,
    allowConfigDirTemplateSubstitution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Allow_multiple_folders_to_be_treated_as_one_when_resolving_modules,
    transpileOptionValue: TSUnknown,
    DefaultValueDescription: diagnostics.Computed_from_the_list_of_input_files,
  }),
  newCommandLineOption({
    Name: "typeRoots",
    Kind: CommandLineOptionTypeList,
    AffectsModuleResolution: true,
    allowConfigDirTemplateSubstitution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_multiple_folders_that_act_like_Slashnode_modules_Slash_types,
  }),
  newCommandLineOption({
    Name: "types",
    Kind: CommandLineOptionTypeList,
    AffectsProgramStructure: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Specify_type_package_names_to_be_included_without_being_referenced_in_a_source_file,
    transpileOptionValue: TSUnknown,
  }),
  newCommandLineOption({
    Name: "allowSyntheticDefaultImports",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Allow_import_x_from_y_when_a_module_doesn_t_have_a_default_export,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "esModuleInterop",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    ShowInSimplifiedHelpView: true,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Emit_additional_JavaScript_to_ease_support_for_importing_CommonJS_modules_This_enables_allowSyntheticDefaultImports_for_type_compatibility,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "preserveSymlinks",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Disable_resolving_symlinks_to_their_realpath_This_correlates_to_the_same_flag_in_node,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "allowUmdGlobalAccess",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Allow_accessing_UMD_globals_from_modules,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "moduleSuffixes",
    Kind: CommandLineOptionTypeList,
    listPreserveFalsyValues: true,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.List_of_file_name_suffixes_to_search_when_resolving_a_module,
  }),
  newCommandLineOption({
    Name: "allowImportingTsExtensions",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Allow_imports_to_include_TypeScript_file_extensions_Requires_moduleResolution_bundler_and_either_noEmit_or_emitDeclarationOnly_to_be_set,
    DefaultValueDescription: false,
    transpileOptionValue: TSUnknown,
  }),
  newCommandLineOption({
    Name: "rewriteRelativeImportExtensions",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Rewrite_ts_tsx_mts_and_cts_file_extensions_in_relative_import_paths_to_their_JavaScript_equivalent_in_output_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "resolvePackageJsonExports",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Use_the_package_json_exports_field_when_resolving_package_imports,
    DefaultValueDescription: diagnostics.X_true_when_moduleResolution_is_node16_nodenext_or_bundler_otherwise_false,
  }),
  newCommandLineOption({
    Name: "resolvePackageJsonImports",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Use_the_package_json_imports_field_when_resolving_imports,
    DefaultValueDescription: diagnostics.X_true_when_moduleResolution_is_node16_nodenext_or_bundler_otherwise_false,
  }),
  newCommandLineOption({
    Name: "customConditions",
    Kind: CommandLineOptionTypeList,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Conditions_to_set_in_addition_to_the_resolver_specific_defaults_when_resolving_imports,
  }),
  newCommandLineOption({
    Name: "noUncheckedSideEffectImports",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Check_side_effect_imports,
    DefaultValueDescription: true,
  }),

  // Source Maps
  newCommandLineOption({
    Name: "sourceRoot",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Specify_the_root_path_for_debuggers_to_find_the_reference_source_code,
  }),
  newCommandLineOption({
    Name: "mapRoot",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Specify_the_location_where_debugger_should_locate_map_files_instead_of_generated_locations,
  }),
  newCommandLineOption({
    Name: "inlineSources",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Include_source_code_in_the_sourcemaps_inside_the_emitted_JavaScript,
    DefaultValueDescription: false,
  }),

  // Experimental
  newCommandLineOption({
    Name: "experimentalDecorators",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Enable_experimental_support_for_legacy_experimental_decorators,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "emitDecoratorMetadata",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Emit_design_type_metadata_for_decorated_declarations_in_source_files,
    DefaultValueDescription: false,
  }),

  // Advanced
  newCommandLineOption({
    Name: "jsxFactory",
    Kind: CommandLineOptionTypeString,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_the_JSX_factory_function_used_when_targeting_React_JSX_emit_e_g_React_createElement_or_h,
    DefaultValueDescription: "`React.createElement`",
  }),
  newCommandLineOption({
    Name: "jsxFragmentFactory",
    Kind: CommandLineOptionTypeString,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_the_JSX_Fragment_reference_used_for_fragments_when_targeting_React_JSX_emit_e_g_React_Fragment_or_Fragment,
    DefaultValueDescription: "React.Fragment",
  }),
  newCommandLineOption({
    Name: "jsxImportSource",
    Kind: CommandLineOptionTypeString,
    AffectsSemanticDiagnostics: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsModuleResolution: true,
    AffectsSourceFile: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_module_specifier_used_to_import_the_JSX_factory_functions_when_using_jsx_Colon_react_jsx_Asterisk,
    DefaultValueDescription: "react",
  }),
  newCommandLineOption({
    Name: "resolveJsonModule",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Enable_importing_json_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "allowArbitraryExtensions",
    Kind: CommandLineOptionTypeBoolean,
    AffectsProgramStructure: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Enable_importing_files_with_any_extension_provided_a_declaration_file_is_present,
    DefaultValueDescription: false,
  }),

  newCommandLineOption({
    Name: "reactNamespace",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Specify_the_object_invoked_for_createElement_This_only_applies_when_targeting_react_JSX_emit,
    DefaultValueDescription: "`React`",
  }),
  newCommandLineOption({
    Name: "skipDefaultLibCheck",
    Kind: CommandLineOptionTypeBoolean,
    // We need to store these to determine whether `lib` files need to be rechecked
    AffectsBuildInfo: true,
    Category: diagnostics.Completeness,
    Description: diagnostics.Skip_type_checking_d_ts_files_that_are_included_with_TypeScript,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "emitBOM",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Emit_a_UTF_8_Byte_Order_Mark_BOM_in_the_beginning_of_output_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "newLine",
    Kind: CommandLineOptionTypeEnum, // newLineOptionMap,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Set_the_newline_character_for_emitting_files,
    DefaultValueDescription: "lf",
  }),
  newCommandLineOption({
    Name: "noErrorTruncation",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Output_Formatting,
    Description: diagnostics.Disable_truncating_types_in_error_messages,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noLib",
    Kind: CommandLineOptionTypeBoolean,
    Category: diagnostics.Language_and_Environment,
    AffectsProgramStructure: true,
    Description: diagnostics.Disable_including_any_library_files_including_the_default_lib_d_ts,
    // We are not returning a sourceFile for lib file when asked by the program,
    // so pass --noLib to avoid reporting a file not found error.
    transpileOptionValue: TSTrue,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noResolve",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    Category: diagnostics.Modules,
    Description: diagnostics.Disallow_import_s_require_s_or_reference_s_from_expanding_the_number_of_files_TypeScript_should_add_to_a_project,
    // We are not doing a full typecheck, we are not resolving the whole context,
    // so pass --noResolve to avoid reporting missing file errors.
    transpileOptionValue: TSTrue,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "stripInternal",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Disable_emitting_declarations_that_have_internal_in_their_JSDoc_comments,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "disableSizeLimit",
    Kind: CommandLineOptionTypeBoolean,
    AffectsProgramStructure: true,
    Category: diagnostics.Editor_Support,
    Description: diagnostics.Remove_the_20mb_cap_on_total_source_code_size_for_JavaScript_files_in_the_TypeScript_language_server,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "disableSourceOfProjectReferenceRedirect",
    Kind: CommandLineOptionTypeBoolean,
    IsTSConfigOnly: true,
    Category: diagnostics.Projects,
    Description: diagnostics.Disable_preferring_source_files_instead_of_declaration_files_when_referencing_composite_projects,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "disableSolutionSearching",
    Kind: CommandLineOptionTypeBoolean,
    IsTSConfigOnly: true,
    Category: diagnostics.Projects,
    Description: diagnostics.Opt_a_project_out_of_multi_project_reference_checking_when_editing,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "disableReferencedProjectLoad",
    Kind: CommandLineOptionTypeBoolean,
    IsTSConfigOnly: true,
    Category: diagnostics.Projects,
    Description: diagnostics.Reduce_the_number_of_projects_loaded_automatically_by_TypeScript,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noEmitHelpers",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Disable_generating_custom_helper_functions_like_extends_in_compiled_output,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "noEmitOnError",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    transpileOptionValue: TSUnknown,
    Description: diagnostics.Disable_emitting_files_if_any_type_checking_errors_are_reported,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "preserveConstEnums",
    Kind: CommandLineOptionTypeBoolean,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Emit,
    Description: diagnostics.Disable_erasing_const_enum_declarations_in_generated_code,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "declarationDir",
    Kind: CommandLineOptionTypeString,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    AffectsDeclarationPath: true,
    IsFilePath: true,
    Category: diagnostics.Emit,
    transpileOptionValue: TSUnknown,
    Description: diagnostics.Specify_the_output_directory_for_generated_declaration_files,
  }),
  newCommandLineOption({
    Name: "skipLibCheck",
    Kind: CommandLineOptionTypeBoolean,
    // We need to store these to determine whether `lib` files need to be rechecked
    AffectsBuildInfo: true,
    Category: diagnostics.Completeness,
    Description: diagnostics.Skip_type_checking_all_d_ts_files,
    DefaultValueDescription: false,
  }),
  newCommandLineOption({
    Name: "allowUnusedLabels",
    Kind: CommandLineOptionTypeBoolean,
    AffectsBindDiagnostics: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Disable_error_reporting_for_unused_labels,
    DefaultValueDescription: TSUnknown,
  }),
  newCommandLineOption({
    Name: "allowUnreachableCode",
    Kind: CommandLineOptionTypeBoolean,
    AffectsBindDiagnostics: true,
    AffectsSemanticDiagnostics: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Type_Checking,
    Description: diagnostics.Disable_error_reporting_for_unreachable_code,
    DefaultValueDescription: TSUnknown,
  }),
  newCommandLineOption({
    Name: "forceConsistentCasingInFileNames",
    Kind: CommandLineOptionTypeBoolean,
    AffectsModuleResolution: true,
    Category: diagnostics.Interop_Constraints,
    Description: diagnostics.Ensure_that_casing_is_correct_in_imports,
    DefaultValueDescription: true,
  }),
  newCommandLineOption({
    Name: "maxNodeModuleJsDepth",
    Kind: CommandLineOptionTypeNumber,
    AffectsModuleResolution: true,
    Category: diagnostics.JavaScript_Support,
    Description: diagnostics.Specify_the_maximum_folder_depth_used_for_checking_JavaScript_files_from_node_modules_Only_applicable_with_allowJs,
    DefaultValueDescription: 0,
  }),
  newCommandLineOption({
    Name: "useDefineForClassFields",
    Kind: CommandLineOptionTypeBoolean,
    AffectsSemanticDiagnostics: true,
    AffectsEmit: true,
    AffectsBuildInfo: true,
    Category: diagnostics.Language_and_Environment,
    Description: diagnostics.Emit_ECMAScript_standard_compliant_class_fields,
    DefaultValueDescription: diagnostics.X_true_for_ES2022_and_above_including_ESNext,
  }),
  newCommandLineOption({
    // A list of plugins to load in the language service
    Name: "plugins",
    Kind: CommandLineOptionTypeList,
    IsTSConfigOnly: true,
    Description: diagnostics.Specify_a_list_of_language_service_plugins_to_include,
    Category: diagnostics.Editor_Support,
  }),
  newCommandLineOption({
    Name: "moduleDetection",
    Kind: CommandLineOptionTypeEnum,
    AffectsSourceFile: true,
    AffectsModuleResolution: true,
    Description: diagnostics.Control_what_method_is_used_to_detect_module_format_JS_files,
    Category: diagnostics.Language_and_Environment,
    DefaultValueDescription: diagnostics.X_auto_Colon_Treat_files_with_imports_exports_import_meta_jsx_with_jsx_Colon_react_jsx_or_esm_format_with_module_Colon_node16_as_modules,
  }),
  newCommandLineOption({
    Name: "ignoreDeprecations",
    Kind: CommandLineOptionTypeString,
    DefaultValueDescription: TSUnknown,
  }),
];

// Assigned here (after commonOptionsWithBuild and optionsForCompiler) to match
// Go's dependency-ordered package-level var initialization.
OptionsDeclarations = Concat(commonOptionsWithBuild, optionsForCompiler);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::varGroup::optionsType","kind":"varGroup","status":"implemented","sigHash":"026b7ac8d648bc03100fb2042dd8782d6a90a7449125c3faa845d5339a4847a4","bodyHash":"b13bc69109aed716705453512dcfaaa3ee67c6aad075f6d70f0be54c1f4ba73f"}
 *
 * Go source:
 * var optionsType = reflect.TypeFor[core.CompilerOptions]()
 */
export const optionsType: Type = reflect_TypeFor<CompilerOptions>();
const compilerOptionFieldMap: ReadonlyMap<string, GoPtr<CommandLineOption>> = buildCompilerOptionFieldMap();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::func::optionsHaveChanges","kind":"func","status":"implemented","sigHash":"8f8f7713f04420647b7a1527c6c51ba7240f567a9749f7e8dd55855f20013b78","bodyHash":"348d3e9cc9eddf323b8cd92d8978c61042f5c378c468e2405af468d846b6d020"}
 *
 * Go source:
 * func optionsHaveChanges(oldOptions *core.CompilerOptions, newOptions *core.CompilerOptions, declFilter func(*CommandLineOption) bool) bool {
 * 	if oldOptions == newOptions {
 * 		return false
 * 	}
 * 	if oldOptions == nil || newOptions == nil {
 * 		return true
 * 	}
 * 	oldOptionsValue := reflect.ValueOf(oldOptions).Elem()
 * 	return ForEachCompilerOptionValue(newOptions, declFilter, func(option *CommandLineOption, value reflect.Value, i int) bool {
 * 		newValue := value.Interface()
 * 		oldValue := oldOptionsValue.Field(i).Interface()
 * 		if option.strictFlag {
 * 			return oldOptions.GetStrictOptionValue(oldValue.(core.Tristate)) != newOptions.GetStrictOptionValue(newValue.(core.Tristate))
 * 		}
 * 		if option.allowJsFlag {
 * 			return oldOptions.GetAllowJS() != newOptions.GetAllowJS()
 * 		}
 * 		return !reflect.DeepEqual(newValue, oldValue)
 * 	})
 * }
 */
export function optionsHaveChanges(oldOptions: GoPtr<CompilerOptions>, newOptions: GoPtr<CompilerOptions>, declFilter: (arg0: GoPtr<CommandLineOption>) => bool): bool {
  if (oldOptions === newOptions) {
    return false;
  }
  if (oldOptions === undefined || newOptions === undefined) {
    return true;
  }
  return ForEachCompilerOptionValue(newOptions, declFilter, (option: GoPtr<CommandLineOption>, value: Value, _i: int): bool => {
    const fieldName = compilerOptionFieldName(option!.Name);
    const newValue = value.Interface();
    const oldValue = (oldOptions as unknown as Record<string, unknown>)[fieldName];
    if (option!.strictFlag) {
      return CompilerOptions_GetStrictOptionValue(oldOptions, oldValue as Tristate) !== CompilerOptions_GetStrictOptionValue(newOptions, newValue as Tristate);
    }
    if (option!.allowJsFlag) {
      return CompilerOptions_GetAllowJS(oldOptions) !== CompilerOptions_GetAllowJS(newOptions);
    }
    return !reflect_DeepEqual(newValue, oldValue);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::func::ForEachCompilerOptionValue","kind":"func","status":"implemented","sigHash":"92b8bca505ce1ea2d8828aff5574d9575b28bfba99b5fb3b9577a2cdf066367f","bodyHash":"be4dd049b46c7ea416c9d998e55ed8d32f0009e7247b3ee1f8c5bcb314ce2ef9"}
 *
 * Go source:
 * func ForEachCompilerOptionValue(options *core.CompilerOptions, declFilter func(*CommandLineOption) bool, fn func(option *CommandLineOption, value reflect.Value, i int) bool) bool {
 * 	optionsValue := reflect.ValueOf(options).Elem()
 * 	for i := range optionsValue.NumField() {
 * 		field := optionsType.Field(i)
 * 		if !field.IsExported() {
 * 			continue
 * 		}
 * 		if optionDeclaration := CommandLineCompilerOptionsMap.Get(field.Name); optionDeclaration != nil && declFilter(optionDeclaration) {
 * 			if fn(optionDeclaration, optionsValue.Field(i), i) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function ForEachCompilerOptionValue(options: GoPtr<CompilerOptions>, declFilter: (arg0: GoPtr<CommandLineOption>) => bool, fn: (option: GoPtr<CommandLineOption>, value: Value, i: int) => bool): bool {
  if (options === undefined) {
    throw new globalThis.Error("nil CompilerOptions");
  }
  const values = options as unknown as Record<string, unknown>;
  let index = 0;
  for (const [fieldName, optionDeclaration] of compilerOptionFieldMap) {
    if (optionDeclaration !== undefined && declFilter(optionDeclaration)) {
      if (fn(optionDeclaration, reflect_ValueOf(values[fieldName]), index as int)) {
        return true;
      }
    }
    index = index + 1;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::func::CompilerOptionsAffectSemanticDiagnostics","kind":"func","status":"implemented","sigHash":"1826ecc157f3ff1ce7bc4ac0796460a2f99c10e0b8746910d415b33928227632","bodyHash":"ad78d2d224f2d1c43fffaa7d5e4e51eed27761ab415802365ad583e3ce8efa34"}
 *
 * Go source:
 * func CompilerOptionsAffectSemanticDiagnostics(
 * 	oldOptions *core.CompilerOptions,
 * 	newOptions *core.CompilerOptions,
 * ) bool {
 * 	return optionsHaveChanges(oldOptions, newOptions, func(option *CommandLineOption) bool {
 * 		return option.AffectsSemanticDiagnostics
 * 	})
 * }
 */
export function CompilerOptionsAffectSemanticDiagnostics(oldOptions: GoPtr<CompilerOptions>, newOptions: GoPtr<CompilerOptions>): bool {
  return optionsHaveChanges(oldOptions, newOptions, (option: GoPtr<CommandLineOption>): bool => option!.AffectsSemanticDiagnostics);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::func::CompilerOptionsAffectDeclarationPath","kind":"func","status":"implemented","sigHash":"589d73a3730301685b5684d38c58d5449af1ea447ea79e39570217be465f7593","bodyHash":"421d3ab13485658a6200b877acf024eb0fbf1ef152abaad2d4f07a1e42871320"}
 *
 * Go source:
 * func CompilerOptionsAffectDeclarationPath(
 * 	oldOptions *core.CompilerOptions,
 * 	newOptions *core.CompilerOptions,
 * ) bool {
 * 	return optionsHaveChanges(oldOptions, newOptions, func(option *CommandLineOption) bool {
 * 		return option.AffectsDeclarationPath
 * 	})
 * }
 */
export function CompilerOptionsAffectDeclarationPath(oldOptions: GoPtr<CompilerOptions>, newOptions: GoPtr<CompilerOptions>): bool {
  return optionsHaveChanges(oldOptions, newOptions, (option: GoPtr<CommandLineOption>): bool => option!.AffectsDeclarationPath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/declscompiler.go::func::CompilerOptionsAffectEmit","kind":"func","status":"implemented","sigHash":"a1bdd4a65f865bb208842a8f1ba8b1b3aeac5f1987cba3a1709b5f6398bec549","bodyHash":"83b1296cba121d21086449e447e5d90b3e58776479c2825bb1029c820487ca25"}
 *
 * Go source:
 * func CompilerOptionsAffectEmit(oldOptions *core.CompilerOptions, newOptions *core.CompilerOptions) bool {
 * 	return optionsHaveChanges(oldOptions, newOptions, func(option *CommandLineOption) bool {
 * 		return option.AffectsEmit
 * 	})
 * }
 */
export function CompilerOptionsAffectEmit(oldOptions: GoPtr<CompilerOptions>, newOptions: GoPtr<CompilerOptions>): bool {
  return optionsHaveChanges(oldOptions, newOptions, (option: GoPtr<CommandLineOption>): bool => option!.AffectsEmit);
}

function buildCompilerOptionFieldMap(): ReadonlyMap<string, GoPtr<CommandLineOption>> {
  const result = new globalThis.Map<string, GoPtr<CommandLineOption>>();
  for (const option of OptionsDeclarations) {
    if (option !== undefined) {
      result.set(compilerOptionFieldName(option.Name), option);
    }
  }
  return result;
}

function compilerOptionFieldName(optionName: string): string {
  return optionName.length === 0 ? optionName : optionName[0]!.toUpperCase() + optionName.slice(1);
}

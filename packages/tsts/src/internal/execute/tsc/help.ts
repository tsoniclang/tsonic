import type { bool, int } from "@tsonic/core/types.js";
import { GoAppend, type GoPtr, type GoSlice } from "../../../go/compat.js";
import { Fprint } from "../../../go/fmt.js";
import { SortFunc } from "../../../go/slices.js";
import { Clone } from "../../../go/slices.js";
import * as strings from "../../../go/strings.js";
import {
  NewOrderedMapWithSizeHint,
  OrderedMap_Entries,
  OrderedMap_GetOrZero,
  OrderedMap_Set,
  OrderedMap_Size,
  OrderedMap_Values,
} from "../../collections/ordered_map.js";
import { Set_Has } from "../../collections/set.js";
import { Version } from "../../core/version.js";
import {
  Message_Localize,
} from "../../diagnostics/diagnostics.js";
import {
  X_tsc_Colon_The_TypeScript_Compiler,
  Version_0,
  COMMON_COMMANDS,
  COMMAND_LINE_FLAGS,
  COMMON_COMPILER_OPTIONS,
  ALL_COMPILER_OPTIONS,
  WATCH_OPTIONS,
  BUILD_OPTIONS,
  X_default_Colon,
  X_type_Colon,
  X_one_or_more_Colon,
  X_one_of_Colon,
  Command_line_Options,
  Compiles_the_current_project_tsconfig_json_in_the_working_directory,
  Ignoring_tsconfig_json_compiles_the_specified_files_with_default_compiler_options,
  Build_a_composite_project_in_the_working_directory,
  Creates_a_tsconfig_json_with_the_recommended_settings_in_the_working_directory,
  Compiles_the_TypeScript_project_located_at_the_specified_path,
  An_expanded_version_of_this_information_showing_all_possible_compiler_options,
  Compiles_the_current_project_with_additional_settings,
  You_can_learn_about_all_of_the_compiler_options_at_0,
  Including_watch_w_will_start_watching_the_current_project_for_the_file_changes_Once_set_you_can_config_watch_mode_with_Colon,
  Using_build_b_will_make_tsc_behave_more_like_a_build_orchestrator_than_a_compiler_This_is_used_to_trigger_building_composite_projects_which_you_can_learn_more_about_at_0,
} from "../../diagnostics/generated/messages.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { Locale } from "../../locale/locale.js";
import {
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeEnum,
  CommandLineOptionTypeList,
  CommandLineOptionTypeListOrElement,
  CommandLineOptionTypeNumber,
  CommandLineOptionTypeObject,
  CommandLineOptionTypeString,
  CommandLineOption_DeprecatedKeys,
  CommandLineOption_Elements,
  CommandLineOption_EnumMap,
} from "../../tsoptions/commandlineoption.js";
import type { CommandLineOption } from "../../tsoptions/commandlineoption.js";
import {
  Filter,
  IfElse,
} from "../../core/core.js";
import { OptionsDeclarations } from "../../tsoptions/declscompiler.js";
import { TscBuildOption, OptionsForBuild } from "../../tsoptions/declsbuild.js";
import { OptionsForWatch } from "../../tsoptions/declswatch.js";
import {
  ParsedCommandLine_CompilerOptions,
} from "../../tsoptions/parsedcommandline.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { Tristate_IsFalseOrUnknown, Tristate_IsTrue } from "../../core/tristate.js";
import type { System } from "./compile.js";
import type { colors } from "./diagnostics.js";
import { createColors, colors_blue, colors_bold, colors_blueBackground, colors_brightWhite } from "./diagnostics.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::PrintVersion","kind":"func","status":"implemented","sigHash":"81f4b3a8da37e32b22c37f209f6f87ec0f65daff59fe4062f2f5a2db67408068","bodyHash":"2055f3eb7f297d4bfe7990343954ef458d89e7184c3662900463a9af1a189d50"}
 *
 * Go source:
 * func PrintVersion(sys System, locale locale.Locale) {
 * 	fmt.Fprintln(sys.Writer(), diagnostics.Version_0.Localize(locale, core.Version()))
 * }
 */
export function PrintVersion(sys: System, locale: Locale): void {
  Fprint(sys.Writer(), Message_Localize(Version_0, locale, Version()), "\n");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::PrintHelp","kind":"func","status":"implemented","sigHash":"15fcc448486dd047538b29c64cd55f1b8410350f2d58947ae5821cdcae99e7bb","bodyHash":"0f76f8d83bc14736044afa07c5beee05d95cc7a8d0717374c1cc1166776c9d06"}
 *
 * Go source:
 * func PrintHelp(sys System, locale locale.Locale, commandLine *tsoptions.ParsedCommandLine) {
 * 	if commandLine.CompilerOptions().All.IsFalseOrUnknown() {
 * 		printEasyHelp(sys, locale, getOptionsForHelp(commandLine))
 * 	} else {
 * 		printAllHelp(sys, locale, getOptionsForHelp(commandLine))
 * 	}
 * }
 */
export function PrintHelp(sys: System, locale: Locale, commandLine: GoPtr<ParsedCommandLine>): void {
  const compilerOptions = ParsedCommandLine_CompilerOptions(commandLine);
  if (Tristate_IsFalseOrUnknown(compilerOptions!.All)) {
    printEasyHelp(sys, locale, getOptionsForHelp(commandLine));
  } else {
    printAllHelp(sys, locale, getOptionsForHelp(commandLine));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getOptionsForHelp","kind":"func","status":"implemented","sigHash":"084b13b5d5efec4f8e4551a68047978f5c9364a04efaf078cd081e3de4d85197","bodyHash":"46fc1313f83d7a666f311135caeed4b4aa60fc46c96b11d7879489961a2dad5c"}
 *
 * Go source:
 * func getOptionsForHelp(commandLine *tsoptions.ParsedCommandLine) []*tsoptions.CommandLineOption {
 * 	// Sort our options by their names, (e.g. "--noImplicitAny" comes before "--watch")
 * 	opts := slices.Clone(tsoptions.OptionsDeclarations)
 * 	opts = append(opts, &tsoptions.TscBuildOption)
 *
 * 	if commandLine.CompilerOptions().All.IsTrue() {
 * 		slices.SortFunc(opts, func(a, b *tsoptions.CommandLineOption) int {
 * 			return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
 * 		})
 * 		return opts
 * 	} else {
 * 		return core.Filter(opts, func(opt *tsoptions.CommandLineOption) bool {
 * 			return opt.ShowInSimplifiedHelpView
 * 		})
 * 	}
 * }
 */
export function getOptionsForHelp(commandLine: GoPtr<ParsedCommandLine>): GoSlice<GoPtr<CommandLineOption>> {
  let opts: GoSlice<GoPtr<CommandLineOption>> = [...(Clone(OptionsDeclarations) ?? [])];
  opts = [...opts, TscBuildOption];
  const compilerOptions = ParsedCommandLine_CompilerOptions(commandLine);
  if (Tristate_IsTrue(compilerOptions!.All)) {
    SortFunc(opts, (a: GoPtr<CommandLineOption>, b: GoPtr<CommandLineOption>): int =>
      strings.Compare(strings.ToLower(a!.Name), strings.ToLower(b!.Name))
    );
    return opts;
  } else {
    return Filter(opts, (opt: GoPtr<CommandLineOption>): bool => opt!.ShowInSimplifiedHelpView);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getHeader","kind":"func","status":"implemented","sigHash":"375a359485bc3674b4ffa35f2d049559598efcfb10fdd1f0cb4f8b33c29d3d5c","bodyHash":"d58a16c9bf8a921e218130e3c0951eda9457df678cd040a6bd87a537c7ee70ff"}
 *
 * Go source:
 * func getHeader(sys System, message string) []string {
 * 	colors := createColors(sys)
 * 	header := make([]string, 0, 3)
 * 	terminalWidth := sys.GetWidthOfTerminal()
 * 	const tsIcon = "     "
 * 	const tsIconTS = "  TS "
 * 	const tsIconLength = len(tsIcon)
 *
 * 	tsIconFirstLine := colors.blueBackground(tsIcon)
 * 	tsIconSecondLine := colors.blueBackground(colors.brightWhite(tsIconTS))
 * 	// If we have enough space, print TS icon.
 * 	if terminalWidth >= len(message)+tsIconLength {
 * 		// right align of the icon is 120 at most.
 * 		rightAlign := core.IfElse(terminalWidth > 120, 120, terminalWidth)
 * 		leftAlign := rightAlign - tsIconLength
 * 		header = append(header, fmt.Sprintf("%-*s", leftAlign, message), tsIconFirstLine, "\n")
 * 		header = append(header, strings.Repeat(" ", leftAlign), tsIconSecondLine, "\n")
 * 	} else {
 * 		header = append(header, message, "\n", "\n")
 * 	}
 * 	return header
 * }
 */
export function getHeader(sys: System, message: string): GoSlice<string> {
  const clrs = createColors(sys);
  const header: string[] = [];
  const terminalWidth = sys.GetWidthOfTerminal();
  const tsIcon = "     ";
  const tsIconTS = "  TS ";
  const tsIconLength = tsIcon.length;

  const tsIconFirstLine = colors_blueBackground(clrs, tsIcon);
  const tsIconSecondLine = colors_blueBackground(clrs, colors_brightWhite(clrs, tsIconTS));
  // If we have enough space, print TS icon.
  if (terminalWidth >= message.length + tsIconLength) {
    const rightAlign = IfElse(terminalWidth > 120, 120, terminalWidth);
    const leftAlign = rightAlign - tsIconLength;
    header.push(
      `${message.padEnd(leftAlign)}`,
      tsIconFirstLine,
      "\n",
      strings.Repeat(" ", leftAlign),
      tsIconSecondLine,
      "\n"
    );
  } else {
    header.push(message, "\n", "\n");
  }
  return header;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::printEasyHelp","kind":"func","status":"implemented","sigHash":"abdfa5e9aae31210286678b0b7d47ec27ce18e687249fe0673b4648dca21443b","bodyHash":"ff4902875ce058b940902a407f64a19cde6d6a1b70dbbfba50155d08716f9d47"}
 *
 * Go source:
 * func printEasyHelp(sys System, locale locale.Locale, simpleOptions []*tsoptions.CommandLineOption) {
 * 	colors := createColors(sys)
 * 	var output []string
 * 	example := func(examples []string, desc *diagnostics.Message) {
 * 		for _, example := range examples {
 * 			output = append(output, "  ", colors.blue(example), "\n")
 * 		}
 * 		output = append(output, "  ", desc.Localize(locale), "\n", "\n")
 * 	}
 *
 * 	msg := diagnostics.X_tsc_Colon_The_TypeScript_Compiler.Localize(locale) + " - " + diagnostics.Version_0.Localize(locale, core.Version())
 * 	output = append(output, getHeader(sys, msg)...)
 *
 * 	output = append(output, colors.bold(diagnostics.COMMON_COMMANDS.Localize(locale)), "\n", "\n")
 *
 * 	example([]string{"tsc"}, diagnostics.Compiles_the_current_project_tsconfig_json_in_the_working_directory)
 * 	example([]string{"tsc app.ts util.ts"}, diagnostics.Ignoring_tsconfig_json_compiles_the_specified_files_with_default_compiler_options)
 * 	example([]string{"tsc -b"}, diagnostics.Build_a_composite_project_in_the_working_directory)
 * 	example([]string{"tsc --init"}, diagnostics.Creates_a_tsconfig_json_with_the_recommended_settings_in_the_working_directory)
 * 	example([]string{"tsc -p ./path/to/tsconfig.json"}, diagnostics.Compiles_the_TypeScript_project_located_at_the_specified_path)
 * 	example([]string{"tsc --help --all"}, diagnostics.An_expanded_version_of_this_information_showing_all_possible_compiler_options)
 * 	example([]string{"tsc --noEmit", "tsc --target esnext"}, diagnostics.Compiles_the_current_project_with_additional_settings)
 *
 * 	var cliCommands []*tsoptions.CommandLineOption
 * 	var configOpts []*tsoptions.CommandLineOption
 * 	for _, opt := range simpleOptions {
 * 		if opt.IsCommandLineOnly || opt.Category == diagnostics.Command_line_Options {
 * 			cliCommands = append(cliCommands, opt)
 * 		} else {
 * 			configOpts = append(configOpts, opt)
 * 		}
 * 	}
 *
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.COMMAND_LINE_FLAGS.Localize(locale), cliCommands, false, nil, nil)...)
 *
 * 	after := diagnostics.You_can_learn_about_all_of_the_compiler_options_at_0.Localize(locale, "https://aka.ms/tsc")
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.COMMON_COMPILER_OPTIONS.Localize(locale), configOpts, false, nil, &after)...)
 *
 * 	for _, chunk := range output {
 * 		fmt.Fprint(sys.Writer(), chunk)
 * 	}
 * }
 */
export function printEasyHelp(sys: System, locale: Locale, simpleOptions: GoSlice<GoPtr<CommandLineOption>>): void {
  const clrs = createColors(sys);
  const output: string[] = [];
  const example = (examples: GoSlice<string>, desc: GoPtr<Message>): void => {
    for (const ex of examples) {
      output.push("  ", colors_blue(clrs, ex), "\n");
    }
    output.push("  ", Message_Localize(desc, locale), "\n", "\n");
  };

  const msg = Message_Localize(X_tsc_Colon_The_TypeScript_Compiler, locale) + " - " + Message_Localize(Version_0, locale, Version());
  output.push(...getHeader(sys, msg));

  output.push(colors_bold(clrs, Message_Localize(COMMON_COMMANDS, locale)), "\n", "\n");

  example(["tsc"], Compiles_the_current_project_tsconfig_json_in_the_working_directory);
  example(["tsc app.ts util.ts"], Ignoring_tsconfig_json_compiles_the_specified_files_with_default_compiler_options);
  example(["tsc -b"], Build_a_composite_project_in_the_working_directory);
  example(["tsc --init"], Creates_a_tsconfig_json_with_the_recommended_settings_in_the_working_directory);
  example(["tsc -p ./path/to/tsconfig.json"], Compiles_the_TypeScript_project_located_at_the_specified_path);
  example(["tsc --help --all"], An_expanded_version_of_this_information_showing_all_possible_compiler_options);
  example(["tsc --noEmit", "tsc --target esnext"], Compiles_the_current_project_with_additional_settings);

  const cliCommands: GoSlice<GoPtr<CommandLineOption>> = [];
  const configOpts: GoSlice<GoPtr<CommandLineOption>> = [];
  for (const opt of simpleOptions) {
    if (opt!.IsCommandLineOnly || opt!.Category === Command_line_Options) {
      cliCommands.push(opt);
    } else {
      configOpts.push(opt);
    }
  }

  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(COMMAND_LINE_FLAGS, locale), cliCommands, false, undefined, undefined));

  const after = Message_Localize(You_can_learn_about_all_of_the_compiler_options_at_0, locale, "https://aka.ms/tsc");
  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(COMMON_COMPILER_OPTIONS, locale), configOpts, false, undefined, after));

  for (const chunk of output) {
    Fprint(sys.Writer(), chunk);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::printAllHelp","kind":"func","status":"implemented","sigHash":"77c9c5864e1610b01bda4f74a0a8ae6dbc2f1c3af3d23528f774e1c79b201c4c","bodyHash":"b4fb9ea2d0863f540b4aef297c2b15fc073df1155140f84e81730d4a9dd5abca"}
 *
 * Go source:
 * func printAllHelp(sys System, locale locale.Locale, options []*tsoptions.CommandLineOption) {
 * 	var output []string
 * 	msg := diagnostics.X_tsc_Colon_The_TypeScript_Compiler.Localize(locale) + " - " + diagnostics.Version_0.Localize(locale, core.Version())
 * 	output = append(output, getHeader(sys, msg)...)
 *
 * 	// ALL COMPILER OPTIONS section
 * 	afterCompilerOptions := diagnostics.You_can_learn_about_all_of_the_compiler_options_at_0.Localize(locale, "https://aka.ms/tsc")
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.ALL_COMPILER_OPTIONS.Localize(locale), options, true, nil, &afterCompilerOptions)...)
 *
 * 	// WATCH OPTIONS section
 * 	beforeWatchOptions := diagnostics.Including_watch_w_will_start_watching_the_current_project_for_the_file_changes_Once_set_you_can_config_watch_mode_with_Colon.Localize(locale)
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.WATCH_OPTIONS.Localize(locale), tsoptions.OptionsForWatch, false, &beforeWatchOptions, nil)...)
 *
 * 	// BUILD OPTIONS section
 * 	beforeBuildOptions := diagnostics.Using_build_b_will_make_tsc_behave_more_like_a_build_orchestrator_than_a_compiler_This_is_used_to_trigger_building_composite_projects_which_you_can_learn_more_about_at_0.Localize(locale, "https://aka.ms/tsc-composite-builds")
 * 	buildOptions := core.Filter(tsoptions.OptionsForBuild, func(option *tsoptions.CommandLineOption) bool {
 * 		return option != &tsoptions.TscBuildOption
 * 	})
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.BUILD_OPTIONS.Localize(locale), buildOptions, false, &beforeBuildOptions, nil)...)
 *
 * 	for _, chunk := range output {
 * 		fmt.Fprint(sys.Writer(), chunk)
 * 	}
 * }
 */
export function printAllHelp(sys: System, locale: Locale, options: GoSlice<GoPtr<CommandLineOption>>): void {
  const output: string[] = [];
  const msg = Message_Localize(X_tsc_Colon_The_TypeScript_Compiler, locale) + " - " + Message_Localize(Version_0, locale, Version());
  output.push(...getHeader(sys, msg));

  // ALL COMPILER OPTIONS section
  const afterCompilerOptions = Message_Localize(You_can_learn_about_all_of_the_compiler_options_at_0, locale, "https://aka.ms/tsc");
  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(ALL_COMPILER_OPTIONS, locale), options, true, undefined, afterCompilerOptions));

  // WATCH OPTIONS section
  const beforeWatchOptions = Message_Localize(Including_watch_w_will_start_watching_the_current_project_for_the_file_changes_Once_set_you_can_config_watch_mode_with_Colon, locale);
  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(WATCH_OPTIONS, locale), OptionsForWatch, false, beforeWatchOptions, undefined));

  // BUILD OPTIONS section
  const beforeBuildOptions = Message_Localize(Using_build_b_will_make_tsc_behave_more_like_a_build_orchestrator_than_a_compiler_This_is_used_to_trigger_building_composite_projects_which_you_can_learn_more_about_at_0, locale, "https://aka.ms/tsc-composite-builds");
  const buildOptions = Filter(OptionsForBuild, (option: GoPtr<CommandLineOption>): bool => option !== TscBuildOption);
  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(BUILD_OPTIONS, locale), buildOptions, false, beforeBuildOptions, undefined));

  for (const chunk of output) {
    Fprint(sys.Writer(), chunk);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::PrintBuildHelp","kind":"func","status":"implemented","sigHash":"0d33de96405c464d5d89089d6affd92c18544d5d5fc2f5648f0471edca4a479f","bodyHash":"4bdc47f3647a25d7ceccc6b35a6e83cb4cfe31551451dc54316b5e89fa876e74"}
 *
 * Go source:
 * func PrintBuildHelp(sys System, locale locale.Locale, buildOptions []*tsoptions.CommandLineOption) {
 * 	var output []string
 * 	output = append(output, getHeader(sys, diagnostics.X_tsc_Colon_The_TypeScript_Compiler.Localize(locale)+" - "+diagnostics.Version_0.Localize(locale, core.Version()))...)
 * 	before := diagnostics.Using_build_b_will_make_tsc_behave_more_like_a_build_orchestrator_than_a_compiler_This_is_used_to_trigger_building_composite_projects_which_you_can_learn_more_about_at_0.Localize(locale, "https://aka.ms/tsc-composite-builds")
 * 	options := core.Filter(buildOptions, func(option *tsoptions.CommandLineOption) bool {
 * 		return option != &tsoptions.TscBuildOption
 * 	})
 * 	output = append(output, generateSectionOptionsOutput(sys, locale, diagnostics.BUILD_OPTIONS.Localize(locale), options, false, &before, nil)...)
 *
 * 	for _, chunk := range output {
 * 		fmt.Fprint(sys.Writer(), chunk)
 * 	}
 * }
 */
export function PrintBuildHelp(sys: System, locale: Locale, buildOptions: GoSlice<GoPtr<CommandLineOption>>): void {
  const output: string[] = [];
  output.push(...getHeader(sys, Message_Localize(X_tsc_Colon_The_TypeScript_Compiler, locale) + " - " + Message_Localize(Version_0, locale, Version())));
  const before = Message_Localize(Using_build_b_will_make_tsc_behave_more_like_a_build_orchestrator_than_a_compiler_This_is_used_to_trigger_building_composite_projects_which_you_can_learn_more_about_at_0, locale, "https://aka.ms/tsc-composite-builds");
  const options = Filter(buildOptions, (option: GoPtr<CommandLineOption>): bool => option !== TscBuildOption);
  output.push(...generateSectionOptionsOutput(sys, locale, Message_Localize(BUILD_OPTIONS, locale), options, false, before, undefined));

  for (const chunk of output) {
    Fprint(sys.Writer(), chunk);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::generateSectionOptionsOutput","kind":"func","status":"implemented","sigHash":"dbf4cc7423f11e00d1e6a954e2b0cf91d1b83e684f61ff9ddec93496732e0a33","bodyHash":"aac0c23bdd8671ff06a31c3fc0413323f20a85147d00219fb56ba25623ce5d0e"}
 *
 * Go source:
 * func generateSectionOptionsOutput(
 * 	sys System,
 * 	locale locale.Locale,
 * 	sectionName string,
 * 	options []*tsoptions.CommandLineOption,
 * 	subCategory bool,
 * 	beforeOptionsDescription,
 * 	afterOptionsDescription *string,
 * ) (output []string) {
 * 	output = append(output, createColors(sys).bold(sectionName), "\n", "\n")
 *
 * 	if beforeOptionsDescription != nil {
 * 		output = append(output, *beforeOptionsDescription, "\n", "\n")
 * 	}
 * 	if !subCategory {
 * 		output = append(output, generateGroupOptionOutput(sys, locale, options)...)
 * 		if afterOptionsDescription != nil {
 * 			output = append(output, *afterOptionsDescription, "\n", "\n")
 * 		}
 * 		return output
 * 	}
 * 	categoryMap := make(map[string][]*tsoptions.CommandLineOption)
 * 	var categoryOrder []string
 * 	for _, option := range options {
 * 		if option.Category == nil {
 * 			continue
 * 		}
 * 		curCategory := option.Category.Localize(locale)
 * 		if _, exists := categoryMap[curCategory]; !exists {
 * 			categoryOrder = append(categoryOrder, curCategory)
 * 		}
 * 		categoryMap[curCategory] = append(categoryMap[curCategory], option)
 * 	}
 * 	for _, key := range categoryOrder {
 * 		value := categoryMap[key]
 * 		output = append(output, "### ", key, "\n", "\n")
 * 		output = append(output, generateGroupOptionOutput(sys, locale, value)...)
 * 	}
 * 	if afterOptionsDescription != nil {
 * 		output = append(output, *afterOptionsDescription, "\n", "\n")
 * 	}
 *
 * 	return output
 * }
 */
export function generateSectionOptionsOutput(sys: System, locale: Locale, sectionName: string, options: GoSlice<GoPtr<CommandLineOption>>, subCategory: bool, beforeOptionsDescription: GoPtr<string>, afterOptionsDescription: GoPtr<string>): GoSlice<string> {
  const output: string[] = [];
  output.push(colors_bold(createColors(sys), sectionName), "\n", "\n");

  if (beforeOptionsDescription !== undefined) {
    output.push(beforeOptionsDescription, "\n", "\n");
  }
  if (!subCategory) {
    output.push(...generateGroupOptionOutput(sys, locale, options));
    if (afterOptionsDescription !== undefined) {
      output.push(afterOptionsDescription, "\n", "\n");
    }
    return output;
  }
  const categoryMap = new Map<string, GoSlice<GoPtr<CommandLineOption>>>();
  const categoryOrder: string[] = [];
  for (const option of options) {
    if (option!.Category === undefined) {
      continue;
    }
    const curCategory = Message_Localize(option!.Category, locale);
    if (!categoryMap.has(curCategory)) {
      categoryOrder.push(curCategory);
    }
    const existing = categoryMap.get(curCategory);
    categoryMap.set(curCategory, existing !== undefined ? [...existing, option] : [option]);
  }
  for (const key of categoryOrder) {
    const value = categoryMap.get(key)!;
    output.push("### ", key, "\n", "\n");
    output.push(...generateGroupOptionOutput(sys, locale, value));
  }
  if (afterOptionsDescription !== undefined) {
    output.push(afterOptionsDescription, "\n", "\n");
  }

  return output;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::generateGroupOptionOutput","kind":"func","status":"implemented","sigHash":"fa34285a13fa86751478d60f41ed7165c15e5fc33e8285e42518aeb6e5e9f479","bodyHash":"d28629f43b7e84f8c2f0db274f2e308e0549cfe5611dea399fb39260c6d19eb0"}
 *
 * Go source:
 * func generateGroupOptionOutput(sys System, locale locale.Locale, optionsList []*tsoptions.CommandLineOption) []string {
 * 	var maxLength int
 * 	for _, option := range optionsList {
 * 		curLenght := len(getDisplayNameTextOfOption(option))
 * 		maxLength = max(curLenght, maxLength)
 * 	}
 *
 * 	// left part should be right align, right part should be left align
 *
 * 	// assume 2 space between left margin and left part.
 * 	rightAlignOfLeftPart := maxLength + 2
 * 	// assume 2 space between left and right part
 * 	leftAlignOfRightPart := rightAlignOfLeftPart + 2
 *
 * 	var lines []string
 * 	for _, option := range optionsList {
 * 		tmp := generateOptionOutput(sys, locale, option, rightAlignOfLeftPart, leftAlignOfRightPart)
 * 		lines = append(lines, tmp...)
 * 	}
 *
 * 	// make sure always a blank line in the end.
 * 	if len(lines) < 2 || lines[len(lines)-2] != "\n" {
 * 		lines = append(lines, "\n")
 * 	}
 *
 * 	return lines
 * }
 */
export function generateGroupOptionOutput(sys: System, locale: Locale, optionsList: GoSlice<GoPtr<CommandLineOption>>): GoSlice<string> {
  let maxLength = 0;
  for (const option of optionsList) {
    const curLength = getDisplayNameTextOfOption(option).length;
    maxLength = Math.max(curLength, maxLength);
  }

  // left part should be right align, right part should be left align

  // assume 2 space between left margin and left part.
  const rightAlignOfLeftPart = maxLength + 2;
  // assume 2 space between left and right part
  const leftAlignOfRightPart = rightAlignOfLeftPart + 2;

  const lines: string[] = [];
  for (const option of optionsList) {
    const tmp = generateOptionOutput(sys, locale, option, rightAlignOfLeftPart, leftAlignOfRightPart);
    lines.push(...tmp);
  }

  // make sure always a blank line in the end.
  if (lines.length < 2 || lines[lines.length - 2] !== "\n") {
    lines.push("\n");
  }

  return lines;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::generateOptionOutput","kind":"func","status":"implemented","sigHash":"f0629ccbea288710c170299f4827a5a92f4fcb531dfdee63a703eb81a8133e57","bodyHash":"ac53d68b66a08f6514efa9d83da67e5fc87582d07972de6e5c07664e73cfcbae"}
 *
 * Go source:
 * func generateOptionOutput(
 * 	sys System,
 * 	locale locale.Locale,
 * 	option *tsoptions.CommandLineOption,
 * 	rightAlignOfLeft, leftAlignOfRight int,
 * ) []string {
 * 	var text []string
 * 	colors := createColors(sys)
 *
 * 	// name and description
 * 	name := getDisplayNameTextOfOption(option)
 *
 * 	// value type and possible value
 * 	valueCandidates := getValueCandidate(sys, locale, option)
 *
 * 	var defaultValueDescription string
 * 	if msg, ok := option.DefaultValueDescription.(*diagnostics.Message); ok && msg != nil {
 * 		defaultValueDescription = msg.Localize(locale)
 * 	} else {
 * 		defaultValueDescription = formatDefaultValue(
 * 			option.DefaultValueDescription,
 * 			core.IfElse(
 * 				option.Kind == tsoptions.CommandLineOptionTypeList || option.Kind == tsoptions.CommandLineOptionTypeListOrElement,
 * 				option.Elements(), option,
 * 			),
 * 		)
 * 	}
 *
 * 	terminalWidth := sys.GetWidthOfTerminal()
 *
 * 	if terminalWidth >= 80 {
 * 		description := ""
 * 		if option.Description != nil {
 * 			description = option.Description.Localize(locale)
 * 		}
 * 		text = append(text, getPrettyOutput(colors, name, description, rightAlignOfLeft, leftAlignOfRight, terminalWidth, true)...)
 * 		text = append(text, "\n")
 * 		if showAdditionalInfoOutput(valueCandidates, option) {
 * 			if valueCandidates != nil {
 * 				text = append(text, getPrettyOutput(colors, valueCandidates.valueType, valueCandidates.possibleValues, rightAlignOfLeft, leftAlignOfRight, terminalWidth, false)...)
 * 				text = append(text, "\n")
 * 			}
 * 			if defaultValueDescription != "" {
 * 				text = append(text, getPrettyOutput(colors, diagnostics.X_default_Colon.Localize(locale), defaultValueDescription, rightAlignOfLeft, leftAlignOfRight, terminalWidth, false)...)
 * 				text = append(text, "\n")
 * 			}
 * 		}
 * 		text = append(text, "\n")
 * 	} else {
 * 		text = append(text, colors.blue(name), "\n")
 * 		if option.Description != nil {
 * 			text = append(text, option.Description.Localize(locale))
 * 		}
 * 		text = append(text, "\n")
 * 		if showAdditionalInfoOutput(valueCandidates, option) {
 * 			if valueCandidates != nil {
 * 				text = append(text, valueCandidates.valueType, " ", valueCandidates.possibleValues)
 * 			}
 * 			if defaultValueDescription != "" {
 * 				if valueCandidates != nil {
 * 					text = append(text, "\n")
 * 				}
 * 				text = append(text, diagnostics.X_default_Colon.Localize(locale), " ", defaultValueDescription)
 * 			}
 *
 * 			text = append(text, "\n")
 * 		}
 * 		text = append(text, "\n")
 * 	}
 *
 * 	return text
 * }
 */
export function generateOptionOutput(sys: System, locale: Locale, option: GoPtr<CommandLineOption>, rightAlignOfLeft: int, leftAlignOfRight: int): GoSlice<string> {
  const text: string[] = [];
  const clrs = createColors(sys);

  // name and description
  const name = getDisplayNameTextOfOption(option);

  // value type and possible value
  const valueCandidates = getValueCandidate(sys, locale, option);

  let defaultValueDescription: string;
  if (option!.DefaultValueDescription !== null && option!.DefaultValueDescription !== undefined && typeof option!.DefaultValueDescription === "object" && "code" in (option!.DefaultValueDescription as object)) {
    // It's a Message object
    defaultValueDescription = Message_Localize(option!.DefaultValueDescription as GoPtr<Message>, locale);
  } else {
    defaultValueDescription = formatDefaultValue(
      option!.DefaultValueDescription,
      IfElse(
        option!.Kind === CommandLineOptionTypeList || option!.Kind === CommandLineOptionTypeListOrElement,
        CommandLineOption_Elements(option),
        option,
      ),
    );
  }

  const terminalWidth = sys.GetWidthOfTerminal();

  if (terminalWidth >= 80) {
    const description = option!.Description !== undefined ? Message_Localize(option!.Description, locale) : "";
    text.push(...getPrettyOutput(clrs, name, description, rightAlignOfLeft, leftAlignOfRight, terminalWidth, true));
    text.push("\n");
    if (showAdditionalInfoOutput(valueCandidates, option)) {
      if (valueCandidates !== undefined) {
        text.push(...getPrettyOutput(clrs, valueCandidates.valueType, valueCandidates.possibleValues, rightAlignOfLeft, leftAlignOfRight, terminalWidth, false));
        text.push("\n");
      }
      if (defaultValueDescription !== "") {
        text.push(...getPrettyOutput(clrs, Message_Localize(X_default_Colon, locale), defaultValueDescription, rightAlignOfLeft, leftAlignOfRight, terminalWidth, false));
        text.push("\n");
      }
    }
    text.push("\n");
  } else {
    text.push(colors_blue(clrs, name), "\n");
    if (option!.Description !== undefined) {
      text.push(Message_Localize(option!.Description, locale));
    }
    text.push("\n");
    if (showAdditionalInfoOutput(valueCandidates, option)) {
      if (valueCandidates !== undefined) {
        text.push(valueCandidates.valueType, " ", valueCandidates.possibleValues);
      }
      if (defaultValueDescription !== "") {
        if (valueCandidates !== undefined) {
          text.push("\n");
        }
        text.push(Message_Localize(X_default_Colon, locale), " ", defaultValueDescription);
      }

      text.push("\n");
    }
    text.push("\n");
  }

  return text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::formatDefaultValue","kind":"func","status":"implemented","sigHash":"22f96a3650c73616e8356486679056ec572e92089eb51b186f1f1a9f983935c9","bodyHash":"53bb36939e164266679f7de8a4a53efc609697b6e6719231763a1e0a803fb1bc"}
 *
 * Go source:
 * func formatDefaultValue(defaultValue any, option *tsoptions.CommandLineOption) string {
 * 	if defaultValue == nil || defaultValue == core.TSUnknown {
 * 		return "undefined"
 * 	}
 *
 * 	if option.Kind == tsoptions.CommandLineOptionTypeEnum {
 * 		// e.g. ScriptTarget.ES2015 -> "es6/es2015"
 * 		var names []string
 * 		for name, value := range option.EnumMap().Entries() {
 * 			if value == defaultValue {
 * 				names = append(names, name)
 * 			}
 * 		}
 * 		return strings.Join(names, "/")
 * 	}
 * 	return fmt.Sprintf("%v", defaultValue)
 * }
 */
export function formatDefaultValue(defaultValue: unknown, option: GoPtr<CommandLineOption>): string {
  if (defaultValue === null || defaultValue === undefined || defaultValue === 0 /* TSUnknown */) {
    return "undefined";
  }

  if (option!.Kind === CommandLineOptionTypeEnum) {
    // e.g. ScriptTarget.ES2015 -> "es6/es2015"
    const names: string[] = [];
    const enumMap = CommandLineOption_EnumMap(option);
    OrderedMap_Entries(enumMap)((name: unknown, value: unknown): bool => {
      if (value === defaultValue) {
        names.push(name as string);
      }
      return true;
    });
    return strings.Join(names, "/");
  }
  return String(defaultValue);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::type::valueCandidate","kind":"type","status":"implemented","sigHash":"909e3d632acdc7c017c0b6cdcff6ebebc5061a6f1d4e972d12a0cbc0d9314281","bodyHash":"602ea54be0fb38d29e6719985296787c12bd448bd120179610126ad68119a50c"}
 *
 * Go source:
 * valueCandidate struct {
 * 	// "one or more" or "any of"
 * 	valueType      string
 * 	possibleValues string
 * }
 */
export interface valueCandidate {
  valueType: string;
  possibleValues: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::showAdditionalInfoOutput","kind":"func","status":"implemented","sigHash":"66aa789c987b8b0a9890b901b996dd92739fef988760258f917b34c4808527a1","bodyHash":"7497a0f4800bcdfc9b6358c58d83984b5d17bbdc14b724574f49e63ac39c1970"}
 *
 * Go source:
 * func showAdditionalInfoOutput(valueCandidates *valueCandidate, option *tsoptions.CommandLineOption) bool {
 * 	if option.Category == diagnostics.Command_line_Options {
 * 		return false
 * 	}
 * 	if valueCandidates != nil && valueCandidates.possibleValues == "string" &&
 * 		(option.DefaultValueDescription == nil ||
 * 			option.DefaultValueDescription == "false" ||
 * 			option.DefaultValueDescription == "n/a") {
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function showAdditionalInfoOutput(valueCandidates: GoPtr<valueCandidate>, option: GoPtr<CommandLineOption>): bool {
  if (option!.Category === Command_line_Options) {
    return false;
  }
  if (valueCandidates !== undefined && valueCandidates.possibleValues === "string" &&
    (option!.DefaultValueDescription === null ||
      option!.DefaultValueDescription === undefined ||
      option!.DefaultValueDescription === "false" ||
      option!.DefaultValueDescription === "n/a")) {
    return false;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getValueCandidate","kind":"func","status":"implemented","sigHash":"9142fe95cdf47ec0e739ad3fb60441fa560a436bd75c617d769f53b0c6962659","bodyHash":"526541ff62687f065c36b5ceb5f32ad6532b6091c75f3464982ae2f6d2df5332"}
 *
 * Go source:
 * func getValueCandidate(sys System, locale locale.Locale, option *tsoptions.CommandLineOption) *valueCandidate {
 * 	if option.Kind == tsoptions.CommandLineOptionTypeObject {
 * 		return nil
 * 	}
 *
 * 	res := &valueCandidate{}
 * 	if option.Kind == tsoptions.CommandLineOptionTypeListOrElement {
 * 		panic("no value candidate for list or element")
 * 	}
 *
 * 	switch option.Kind {
 * 	case tsoptions.CommandLineOptionTypeString,
 * 		tsoptions.CommandLineOptionTypeNumber,
 * 		tsoptions.CommandLineOptionTypeBoolean:
 * 		res.valueType = diagnostics.X_type_Colon.Localize(locale)
 * 	case tsoptions.CommandLineOptionTypeList:
 * 		res.valueType = diagnostics.X_one_or_more_Colon.Localize(locale)
 * 	default:
 * 		res.valueType = diagnostics.X_one_of_Colon.Localize(locale)
 * 	}
 *
 * 	res.possibleValues = getPossibleValues(option)
 *
 * 	return res
 * }
 */
export function getValueCandidate(sys: System, locale: Locale, option: GoPtr<CommandLineOption>): GoPtr<valueCandidate> {
  if (option!.Kind === CommandLineOptionTypeObject) {
    return undefined;
  }

  const res: valueCandidate = { valueType: "", possibleValues: "" };
  if (option!.Kind === CommandLineOptionTypeListOrElement) {
    throw new globalThis.Error("no value candidate for list or element");
  }

  switch (option!.Kind) {
    case CommandLineOptionTypeString:
    case CommandLineOptionTypeNumber:
    case CommandLineOptionTypeBoolean:
      res.valueType = Message_Localize(X_type_Colon, locale);
      break;
    case CommandLineOptionTypeList:
      res.valueType = Message_Localize(X_one_or_more_Colon, locale);
      break;
    default:
      res.valueType = Message_Localize(X_one_of_Colon, locale);
      break;
  }

  res.possibleValues = getPossibleValues(option);

  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getPossibleValues","kind":"func","status":"implemented","sigHash":"01509938872ae5c9f445f67f05c92565533107500401575291542cfda732c78e","bodyHash":"83aec6a69c310f6ed0ecbe6fda305e7b7bd24e96f48a47897dcfdc5800ca7811"}
 *
 * Go source:
 * func getPossibleValues(option *tsoptions.CommandLineOption) string {
 * 	switch option.Kind {
 * 	case tsoptions.CommandLineOptionTypeString,
 * 		tsoptions.CommandLineOptionTypeNumber,
 * 		tsoptions.CommandLineOptionTypeBoolean:
 * 		return string(option.Kind)
 * 	case tsoptions.CommandLineOptionTypeList,
 * 		tsoptions.CommandLineOptionTypeListOrElement:
 * 		return getPossibleValues(option.Elements())
 * 	case tsoptions.CommandLineOptionTypeObject:
 * 		return ""
 * 	default:
 * 		// Map<string, number | string>
 * 		// Group synonyms: es6/es2015
 * 		enumMap := option.EnumMap()
 * 		inverted := collections.NewOrderedMapWithSizeHint[any, []string](enumMap.Size())
 * 		deprecatedKeys := option.DeprecatedKeys()
 *
 * 		for name, value := range enumMap.Entries() {
 * 			if deprecatedKeys == nil || !deprecatedKeys.Has(name) {
 * 				inverted.Set(value, append(inverted.GetOrZero(value), name))
 * 			}
 * 		}
 * 		var syns []string
 * 		for synonyms := range inverted.Values() {
 * 			syns = append(syns, strings.Join(synonyms, "/"))
 * 		}
 * 		return strings.Join(syns, ", ")
 * 	}
 * }
 */
export function getPossibleValues(option: GoPtr<CommandLineOption>): string {
  switch (option!.Kind) {
    case CommandLineOptionTypeString:
    case CommandLineOptionTypeNumber:
    case CommandLineOptionTypeBoolean:
      return option!.Kind;
    case CommandLineOptionTypeList:
    case CommandLineOptionTypeListOrElement:
      return getPossibleValues(CommandLineOption_Elements(option));
    case CommandLineOptionTypeObject:
      return "";
    default: {
      // Map<string, number | string>
      // Group synonyms: es6/es2015
      const enumMap = CommandLineOption_EnumMap(option);
      const inverted = NewOrderedMapWithSizeHint<unknown, GoSlice<string>>(OrderedMap_Size(enumMap));
      const deprecatedKeys = CommandLineOption_DeprecatedKeys(option);

      OrderedMap_Entries(enumMap)((name: unknown, value: unknown): bool => {
        if (deprecatedKeys === undefined || !Set_Has(deprecatedKeys, name as string)) {
          OrderedMap_Set(inverted, value, GoAppend(OrderedMap_GetOrZero(inverted, value), name as string));
        }
        return true;
      });
      const syns: string[] = [];
      OrderedMap_Values(inverted)((synonyms: GoSlice<string>): bool => {
        syns.push(strings.Join(synonyms, "/"));
        return true;
      });
      return strings.Join(syns, ", ");
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getPrettyOutput","kind":"func","status":"implemented","sigHash":"4c46b3ad7eb089fafaf7b255db69930138ebba5202964b96ec683b88d28df0cc","bodyHash":"aa24ca4e37abdc54af65611b450f93da21f747bfe2712ee45d3769d4f13e7d5e"}
 *
 * Go source:
 * func getPrettyOutput(colors *colors, left string, right string, rightAlignOfLeft int, leftAlignOfRight int, terminalWidth int, colorLeft bool) []string {
 * 	res := make([]string, 0, 4)
 * 	isFirstLine := true
 * 	remainRight := right
 * 	rightCharacterNumber := terminalWidth - leftAlignOfRight
 * 	for len(remainRight) > 0 {
 * 		curLeft := ""
 * 		if isFirstLine {
 * 			curLeft = fmt.Sprintf("%*s", rightAlignOfLeft, left)
 * 			curLeft = fmt.Sprintf("%-*s", leftAlignOfRight, curLeft)
 * 			if colorLeft {
 * 				curLeft = colors.blue(curLeft)
 * 			}
 * 		} else {
 * 			curLeft = strings.Repeat(" ", leftAlignOfRight)
 * 		}
 *
 * 		idx := min(rightCharacterNumber, len(remainRight))
 * 		curRight := remainRight[:idx]
 * 		remainRight = remainRight[idx:]
 * 		res = append(res, curLeft, curRight, "\n")
 * 		isFirstLine = false
 * 	}
 * 	return res
 * }
 */
export function getPrettyOutput(colors: GoPtr<colors>, left: string, right: string, rightAlignOfLeft: int, leftAlignOfRight: int, terminalWidth: int, colorLeft: bool): GoSlice<string> {
  const res: string[] = [];
  let isFirstLine = true;
  let remainRight = right;
  const rightCharacterNumber = terminalWidth - leftAlignOfRight;
  while (remainRight.length > 0) {
    let curLeft = "";
    if (isFirstLine) {
      curLeft = left.padStart(rightAlignOfLeft);
      curLeft = curLeft.padEnd(leftAlignOfRight);
      if (colorLeft) {
        curLeft = colors_blue(colors, curLeft);
      }
    } else {
      curLeft = strings.Repeat(" ", leftAlignOfRight);
    }

    const idx = Math.min(rightCharacterNumber, remainRight.length);
    const curRight = remainRight.slice(0, idx);
    remainRight = remainRight.slice(idx);
    res.push(curLeft, curRight, "\n");
    isFirstLine = false;
  }
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getDisplayNameTextOfOption","kind":"func","status":"implemented","sigHash":"3bde92cee2fca1d7a112b73dcc052b5cc8626e5d3fea680c1d775cdccca3fdcd","bodyHash":"72f6f488c58e091afd6e3e15be8df732b4cb9ab5a0642c758026353f83345b8e"}
 *
 * Go source:
 * func getDisplayNameTextOfOption(option *tsoptions.CommandLineOption) string {
 * 	return "--" + option.Name + core.IfElse(option.ShortName != "", ", -"+option.ShortName, "")
 * }
 */
export function getDisplayNameTextOfOption(option: GoPtr<CommandLineOption>): string {
  return "--" + option!.Name + IfElse(option!.ShortName !== "", ", -" + option!.ShortName, "");
}

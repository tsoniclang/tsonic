import type { bool, int } from "@tsonic/core/types.js";
import { type GoPtr, type GoSlice } from "../../../go/compat.js";
import type { Locale } from "../../locale/locale.js";
import type { CommandLineOption } from "../../tsoptions/commandlineoption.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import type { System } from "./compile.js";
import type { colors } from "./diagnostics.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::PrintVersion","kind":"func","status":"implemented","sigHash":"81f4b3a8da37e32b22c37f209f6f87ec0f65daff59fe4062f2f5a2db67408068","bodyHash":"2055f3eb7f297d4bfe7990343954ef458d89e7184c3662900463a9af1a189d50"}
 *
 * Go source:
 * func PrintVersion(sys System, locale locale.Locale) {
 * 	fmt.Fprintln(sys.Writer(), diagnostics.Version_0.Localize(locale, core.Version()))
 * }
 */
export declare function PrintVersion(sys: System, locale: Locale): void;
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
export declare function PrintHelp(sys: System, locale: Locale, commandLine: GoPtr<ParsedCommandLine>): void;
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
export declare function getOptionsForHelp(commandLine: GoPtr<ParsedCommandLine>): GoSlice<GoPtr<CommandLineOption>>;
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
export declare function getHeader(sys: System, message: string): GoSlice<string>;
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
export declare function printEasyHelp(sys: System, locale: Locale, simpleOptions: GoSlice<GoPtr<CommandLineOption>>): void;
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
export declare function printAllHelp(sys: System, locale: Locale, options: GoSlice<GoPtr<CommandLineOption>>): void;
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
export declare function PrintBuildHelp(sys: System, locale: Locale, buildOptions: GoSlice<GoPtr<CommandLineOption>>): void;
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
export declare function generateSectionOptionsOutput(sys: System, locale: Locale, sectionName: string, options: GoSlice<GoPtr<CommandLineOption>>, subCategory: bool, beforeOptionsDescription: GoPtr<string>, afterOptionsDescription: GoPtr<string>): GoSlice<string>;
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
export declare function generateGroupOptionOutput(sys: System, locale: Locale, optionsList: GoSlice<GoPtr<CommandLineOption>>): GoSlice<string>;
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
export declare function generateOptionOutput(sys: System, locale: Locale, option: GoPtr<CommandLineOption>, rightAlignOfLeft: int, leftAlignOfRight: int): GoSlice<string>;
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
export declare function formatDefaultValue(defaultValue: unknown, option: GoPtr<CommandLineOption>): string;
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
export declare function showAdditionalInfoOutput(valueCandidates: GoPtr<valueCandidate>, option: GoPtr<CommandLineOption>): bool;
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
export declare function getValueCandidate(sys: System, locale: Locale, option: GoPtr<CommandLineOption>): GoPtr<valueCandidate>;
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
export declare function getPossibleValues(option: GoPtr<CommandLineOption>): string;
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
export declare function getPrettyOutput(colors: GoPtr<colors>, left: string, right: string, rightAlignOfLeft: int, leftAlignOfRight: int, terminalWidth: int, colorLeft: bool): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/help.go::func::getDisplayNameTextOfOption","kind":"func","status":"implemented","sigHash":"3bde92cee2fca1d7a112b73dcc052b5cc8626e5d3fea680c1d775cdccca3fdcd","bodyHash":"72f6f488c58e091afd6e3e15be8df732b4cb9ab5a0642c758026353f83345b8e"}
 *
 * Go source:
 * func getDisplayNameTextOfOption(option *tsoptions.CommandLineOption) string {
 * 	return "--" + option.Name + core.IfElse(option.ShortName != "", ", -"+option.ShortName, "")
 * }
 */
export declare function getDisplayNameTextOfOption(option: GoPtr<CommandLineOption>): string;
//# sourceMappingURL=help.d.ts.map
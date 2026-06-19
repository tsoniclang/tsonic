import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Once } from "../../go/sync.js";
import { Atoi, Itoa } from "../../go/strconv.js";
import * as strings from "../../go/strings.js";
import { NewCompilerDiagnostic } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { SourceFile } from "../ast/ast.js";
import type { Expression } from "../ast/generated/unions.js";
import { newMapWithSizeHint, OrderedMap_Clone, OrderedMap_Entries, OrderedMap_Get, OrderedMap_Set } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { MapFiltered } from "../core/core.js";
import { Tristate_IsTrue } from "../core/tristate.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import type { WatchOptions } from "../core/watchoptions.js";
import type { BuildOptions } from "../core/buildoptions.js";
import {
  Cannot_read_file_0,
  Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_false_or_null_on_command_line,
  Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_null_on_command_line,
  Option_0_requires_value_to_be_greater_than_1,
  Options_0_and_1_cannot_be_combined,
  Unterminated_quoted_string_in_response_file_0,
} from "../diagnostics/generated/messages.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { GetNormalizedAbsolutePath } from "../tspath/path.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import type { FS } from "../vfs/vfs.js";
import { IsWhiteSpaceLike } from "../stringutil/util.js";
import type { CommandLineOption } from "./commandlineoption.js";
import {
  CommandLineOption_Elements,
  CommandLineOption_EnumMap,
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeList,
  CommandLineOptionTypeListOrElement,
  CommandLineOptionTypeNumber,
  CommandLineOptionTypeString,
} from "./commandlineoption.js";
import type { AlternateModeDiagnostics, ParseCommandLineWorkerDiagnostics } from "./diagnostics.js";
import { buildOptionsDidYouMeanDiagnostics, CompilerOptionsDidYouMeanDiagnostics, watchOptionsDidYouMeanDiagnostics } from "./diagnostics.js";
import { GetNameMapFromList, NameMap_Get, NameMap_GetOptionDeclarationFromName } from "./namemap.js";
import { BuildNameMap, CompilerNameMap, WatchNameMap } from "./namemap.js";
import type { NameMap } from "./namemap.js";
import type { ParsedBuildCommandLine } from "./parsedbuildcommandline.js";
import { NewParsedCommandLine } from "./parsedcommandline.js";
import type { ParsedCommandLine } from "./parsedcommandline.js";
import { TscBuildOption } from "./declsbuild.js";
import type {
  buildOptionsParser,
  compilerOptionsParser,
  watchOptionsParser,
} from "./parsinghelpers.js";
import {
  buildOptionsParser_as_optionParser,
  compilerOptionsParser_as_optionParser,
  convertToOptionsWithAbsolutePaths,
  ParseCompilerOptions,
  watchOptionsParser_as_optionParser,
} from "./parsinghelpers.js";
import type { ParseConfigHost, CommandLineOptionNameMap } from "./tsconfigparsing.js";
import { CommandLineCompilerOptionsMap, convertMapToOptions, validateJsonOptionValue } from "./tsconfigparsing.js";
import { commandLineParser_createUnknownOptionError, createDiagnosticForInvalidEnumType, getCompilerOptionValueTypeString } from "./errors.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.AlternateMode","kind":"method","status":"implemented","sigHash":"b7a4cccfda5482aa6b416c22abfac4443b53ac96e25e4fbf2233fc1d6c068ac3","bodyHash":"056161029ee4944550f999527abb187aedbb19f7b8abeeaead760247ab8db584"}
 *
 * Go source:
 * func (p *commandLineParser) AlternateMode() *AlternateModeDiagnostics {
 * 	return p.workerDiagnostics.didYouMean.alternateMode
 * }
 */
export function commandLineParser_AlternateMode(receiver: GoPtr<commandLineParser>): GoPtr<AlternateModeDiagnostics> {
  const p = receiver!;
  return p.workerDiagnostics!.didYouMean.alternateMode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.OptionsDeclarations","kind":"method","status":"implemented","sigHash":"97f3f4f181f8583d4a1038ff86438d6f74d2c7e1b956a5c0ee0fbb0a156140b0","bodyHash":"2b9ebfed5341565ee19d79163959f5639ab03808da69985d8c2d8fa1080168cf"}
 *
 * Go source:
 * func (p *commandLineParser) OptionsDeclarations() []*CommandLineOption {
 * 	return p.workerDiagnostics.didYouMean.OptionDeclarations
 * }
 */
export function commandLineParser_OptionsDeclarations(receiver: GoPtr<commandLineParser>): GoSlice<GoPtr<CommandLineOption>> {
  const p = receiver!;
  return p.workerDiagnostics!.didYouMean.OptionDeclarations;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.UnknownOptionDiagnostic","kind":"method","status":"implemented","sigHash":"1994feecac07e08365ebae35690a24a63302cf0f8f3fc9241aa206d29e945f5a","bodyHash":"25cb680289286f8f20a2f52fab2623bdd34c60503de459910957e3aeb9d369e8"}
 *
 * Go source:
 * func (p *commandLineParser) UnknownOptionDiagnostic() *diagnostics.Message {
 * 	return p.workerDiagnostics.didYouMean.UnknownOptionDiagnostic
 * }
 */
export function commandLineParser_UnknownOptionDiagnostic(receiver: GoPtr<commandLineParser>): GoPtr<Message> {
  const p = receiver!;
  return p.workerDiagnostics!.didYouMean.UnknownOptionDiagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.UnknownDidYouMeanDiagnostic","kind":"method","status":"implemented","sigHash":"56af45c4595276168341f6e19deabcb67421480b1ceda0f1ef544368c045b017","bodyHash":"20657e14d95384cfc4dc138965a9afca4ee40365970aed59dbf614a472e8781d"}
 *
 * Go source:
 * func (p *commandLineParser) UnknownDidYouMeanDiagnostic() *diagnostics.Message {
 * 	return p.workerDiagnostics.didYouMean.UnknownDidYouMeanDiagnostic
 * }
 */
export function commandLineParser_UnknownDidYouMeanDiagnostic(receiver: GoPtr<commandLineParser>): GoPtr<Message> {
  const p = receiver!;
  return p.workerDiagnostics!.didYouMean.UnknownDidYouMeanDiagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::type::commandLineParser","kind":"type","status":"implemented","sigHash":"79d325265cbddb5df61fab09767bd110f16ddb7661c5b27191ea9f07420c7d1d","bodyHash":"e7913c62fb7907f966c8f2b7799cf7a9045dfa530c035c42dc698a5aaf5fb208"}
 *
 * Go source:
 * commandLineParser struct {
 * 	workerDiagnostics *ParseCommandLineWorkerDiagnostics
 * 	optionsMap        *NameMap
 * 	fs                vfs.FS
 * 	currentDirectory  string
 * 	options           *collections.OrderedMap[string, any]
 * 	fileNames         []string
 * 	errors            []*ast.Diagnostic
 * }
 */
export interface commandLineParser {
  workerDiagnostics: GoPtr<ParseCommandLineWorkerDiagnostics>;
  optionsMap: GoPtr<NameMap>;
  fs: FS;
  currentDirectory: string;
  options: GoPtr<OrderedMap<string, unknown>>;
  fileNames: GoSlice<string>;
  errors: GoSlice<GoPtr<Diagnostic>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::ParseCommandLine","kind":"func","status":"implemented","sigHash":"562e3a384361cd843bc6d51c8fe529fb5a9fc4d9b2f88128540ac7356f5f8511","bodyHash":"c69d08ac69c7544c2f6963b5789356181e906a65365339bf88071b05253c4d49"}
 *
 * Go source:
 * func ParseCommandLine(
 * 	commandLine []string,
 * 	host ParseConfigHost,
 * ) *ParsedCommandLine {
 * 	if commandLine == nil {
 * 		commandLine = []string{}
 * 	}
 * 	parser := parseCommandLineWorker(CompilerOptionsDidYouMeanDiagnostics, commandLine, host.FS(), host.GetCurrentDirectory())
 * 	optionsWithAbsolutePaths := convertToOptionsWithAbsolutePaths(parser.options.Clone(), CommandLineCompilerOptionsMap, host.GetCurrentDirectory())
 * 	compilerOptions := convertMapToOptions(optionsWithAbsolutePaths, &compilerOptionsParser{&core.CompilerOptions{}}).CompilerOptions
 * 	watchOptions := convertMapToOptions(optionsWithAbsolutePaths, &watchOptionsParser{&core.WatchOptions{}}).WatchOptions
 * 	result := NewParsedCommandLine(compilerOptions, parser.fileNames, tspath.ComparePathsOptions{
 * 		UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
 * 		CurrentDirectory:          host.GetCurrentDirectory(),
 * 	})
 * 	result.ParsedConfig.WatchOptions = watchOptions
 * 	result.Errors = parser.errors
 * 	result.Raw = parser.options
 * 	return result
 * }
 */
export function ParseCommandLine(commandLine: GoSlice<string>, host: ParseConfigHost): GoPtr<ParsedCommandLine> {
  if (commandLine === undefined || commandLine === null) {
    commandLine = [];
  }
  const parser = parseCommandLineWorker(CompilerOptionsDidYouMeanDiagnostics, commandLine, host.FS(), host.GetCurrentDirectory());
  const optionsWithAbsolutePaths = convertToOptionsWithAbsolutePaths(OrderedMap_Clone(parser!.options as GoPtr<OrderedMap<string, unknown>>), CommandLineCompilerOptionsMap, host.GetCurrentDirectory());
  const compilerParser: compilerOptionsParser = { __tsgoEmbedded0: {} as CompilerOptions };
  convertMapToOptions(optionsWithAbsolutePaths as GoPtr<OrderedMap<string, unknown>>, compilerOptionsParser_as_optionParser(compilerParser));
  const compilerOptions = compilerParser.__tsgoEmbedded0;
  const watchParser: watchOptionsParser = { __tsgoEmbedded0: {} as WatchOptions };
  convertMapToOptions(optionsWithAbsolutePaths as GoPtr<OrderedMap<string, unknown>>, watchOptionsParser_as_optionParser(watchParser));
  const watchOptions = watchParser.__tsgoEmbedded0;
  const result = NewParsedCommandLine(compilerOptions, parser!.fileNames, {
    UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
    CurrentDirectory: host.GetCurrentDirectory(),
  });
  result!.ParsedConfig!.WatchOptions = watchOptions;
  result!.Errors = parser!.errors;
  result!.Raw = parser!.options;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::ParseBuildCommandLine","kind":"func","status":"implemented","sigHash":"0bcf99ad375f4adacac48e524467665ecba5dc50fcf1fc301eeb09baf42e5b39","bodyHash":"d9cd9f2b10f6a2a576f3d13cc565e387dbaa796834d587e37b8801e3f1b3323c"}
 *
 * Go source:
 * func ParseBuildCommandLine(
 * 	commandLine []string,
 * 	host ParseConfigHost,
 * ) *ParsedBuildCommandLine {
 * 	if commandLine == nil {
 * 		commandLine = []string{}
 * 	}
 * 	parser := parseCommandLineWorker(buildOptionsDidYouMeanDiagnostics, commandLine, host.FS(), host.GetCurrentDirectory())
 * 	compilerOptions := &core.CompilerOptions{}
 * 	for key, value := range parser.options.Entries() {
 * 		buildOption := BuildNameMap.Get(key)
 * 		if buildOption == &TscBuildOption || buildOption == CompilerNameMap.Get(key) {
 * 			ParseCompilerOptions(key, value, compilerOptions)
 * 		}
 * 	}
 * 	result := &ParsedBuildCommandLine{
 * 		BuildOptions:    convertMapToOptions(parser.options, &buildOptionsParser{&core.BuildOptions{}}).BuildOptions,
 * 		CompilerOptions: compilerOptions,
 * 		WatchOptions:    convertMapToOptions(parser.options, &watchOptionsParser{&core.WatchOptions{}}).WatchOptions,
 * 		Projects:        parser.fileNames,
 * 		Errors:          parser.errors,
 * 		Raw:             parser.options,
 * 
 * 		comparePathsOptions: tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		},
 * 	}
 * 
 * 	if len(result.Projects) == 0 {
 * 		// tsc -b invoked with no extra arguments; act as if invoked with "tsc -b ."
 * 		result.Projects = append(result.Projects, ".")
 * 	}
 * 
 * 	// Nonsensical combinations
 * 	if result.BuildOptions.Clean.IsTrue() && result.BuildOptions.Force.IsTrue() {
 * 		result.Errors = append(result.Errors, ast.NewCompilerDiagnostic(diagnostics.Options_0_and_1_cannot_be_combined, "clean", "force"))
 * 	}
 * 	if result.BuildOptions.Clean.IsTrue() && result.BuildOptions.Verbose.IsTrue() {
 * 		result.Errors = append(result.Errors, ast.NewCompilerDiagnostic(diagnostics.Options_0_and_1_cannot_be_combined, "clean", "verbose"))
 * 	}
 * 	if result.BuildOptions.Clean.IsTrue() && result.CompilerOptions.Watch.IsTrue() {
 * 		result.Errors = append(result.Errors, ast.NewCompilerDiagnostic(diagnostics.Options_0_and_1_cannot_be_combined, "clean", "watch"))
 * 	}
 * 	if result.CompilerOptions.Watch.IsTrue() && result.BuildOptions.Dry.IsTrue() {
 * 		result.Errors = append(result.Errors, ast.NewCompilerDiagnostic(diagnostics.Options_0_and_1_cannot_be_combined, "watch", "dry"))
 * 	}
 * 
 * 	return result
 * }
 */
export function ParseBuildCommandLine(commandLine: GoSlice<string>, host: ParseConfigHost): GoPtr<ParsedBuildCommandLine> {
  if (commandLine === undefined || commandLine === null) {
    commandLine = [];
  }
  const parser = parseCommandLineWorker(buildOptionsDidYouMeanDiagnostics, commandLine, host.FS(), host.GetCurrentDirectory());
  const compilerOptions: CompilerOptions = {} as CompilerOptions;
  OrderedMap_Entries(parser!.options as GoPtr<OrderedMap<string, unknown>>)((key: string, value: unknown): bool => {
    const buildOption = NameMap_Get(BuildNameMap, key);
    if (buildOption === TscBuildOption || buildOption === NameMap_Get(CompilerNameMap, key)) {
      ParseCompilerOptions(key, value, compilerOptions);
    }
    return true;
  });
  const buildParser: buildOptionsParser = { __tsgoEmbedded0: {} as BuildOptions };
  convertMapToOptions(parser!.options as GoPtr<OrderedMap<string, unknown>>, buildOptionsParser_as_optionParser(buildParser));
  const watchParser: watchOptionsParser = { __tsgoEmbedded0: {} as WatchOptions };
  convertMapToOptions(parser!.options as GoPtr<OrderedMap<string, unknown>>, watchOptionsParser_as_optionParser(watchParser));
  let result: ParsedBuildCommandLine = {
    BuildOptions: buildParser.__tsgoEmbedded0,
    CompilerOptions: compilerOptions,
    WatchOptions: watchParser.__tsgoEmbedded0,
    Projects: parser!.fileNames,
    Errors: parser!.errors,
    Raw: parser!.options,
    comparePathsOptions: {
      UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
      CurrentDirectory: host.GetCurrentDirectory(),
    },
    resolvedProjectPaths: [],
    resolvedProjectPathsOnce: new Once(),
    locale: undefined as never,
    localeOnce: new Once(),
  };
  if (result.Projects.length === 0) {
    result = { ...result, Projects: [...result.Projects, "."] };
  }
  // Nonsensical combinations
  if (Tristate_IsTrue(result.BuildOptions!.Clean) && Tristate_IsTrue(result.BuildOptions!.Force)) {
    result = { ...result, Errors: [...result.Errors, NewCompilerDiagnostic(Options_0_and_1_cannot_be_combined, "clean", "force")] };
  }
  if (Tristate_IsTrue(result.BuildOptions!.Clean) && Tristate_IsTrue(result.BuildOptions!.Verbose)) {
    result = { ...result, Errors: [...result.Errors, NewCompilerDiagnostic(Options_0_and_1_cannot_be_combined, "clean", "verbose")] };
  }
  if (Tristate_IsTrue(result.BuildOptions!.Clean) && Tristate_IsTrue(result.CompilerOptions!.Watch)) {
    result = { ...result, Errors: [...result.Errors, NewCompilerDiagnostic(Options_0_and_1_cannot_be_combined, "clean", "watch")] };
  }
  if (Tristate_IsTrue(result.CompilerOptions!.Watch) && Tristate_IsTrue(result.BuildOptions!.Dry)) {
    result = { ...result, Errors: [...result.Errors, NewCompilerDiagnostic(Options_0_and_1_cannot_be_combined, "watch", "dry")] };
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::parseCommandLineWorker","kind":"func","status":"implemented","sigHash":"1c8d65c87a28485582e91bb856a2c8601a55102a1a0ef6544ea09acfdf97e404","bodyHash":"4b0dc6ed5d2e3eb1489506ff424d92c5f1e81992d1ee57ae1623e613df71435a"}
 *
 * Go source:
 * func parseCommandLineWorker(
 * 	parseCommandLineWithDiagnostics *ParseCommandLineWorkerDiagnostics,
 * 	commandLine []string,
 * 	fs vfs.FS,
 * 	currentDirectory string,
 * ) *commandLineParser {
 * 	parser := &commandLineParser{
 * 		fs:                fs,
 * 		currentDirectory:  currentDirectory,
 * 		workerDiagnostics: parseCommandLineWithDiagnostics,
 * 		fileNames:         []string{},
 * 		options:           &collections.OrderedMap[string, any]{},
 * 		errors:            []*ast.Diagnostic{},
 * 	}
 * 	parser.optionsMap = GetNameMapFromList(parser.OptionsDeclarations())
 * 	parser.parseStrings(commandLine)
 * 	return parser
 * }
 */
export function parseCommandLineWorker(parseCommandLineWithDiagnostics: GoPtr<ParseCommandLineWorkerDiagnostics>, commandLine: GoSlice<string>, fs: FS, currentDirectory: string): GoPtr<commandLineParser> {
  const parser: commandLineParser = {
    fs: fs,
    currentDirectory: currentDirectory,
    workerDiagnostics: parseCommandLineWithDiagnostics,
    fileNames: [],
    options: newMapWithSizeHint<string, unknown>(0),
    errors: [],
    optionsMap: undefined,
  };
  parser.optionsMap = GetNameMapFromList(commandLineParser_OptionsDeclarations(parser));
  commandLineParser_parseStrings(parser, commandLine);
  return parser;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.parseStrings","kind":"method","status":"implemented","sigHash":"367937963448225249aa9aa8b0554a96b59a22c7303a30b93f292c039220f30a","bodyHash":"f97740bf1e26f7f2b6ec2ae3c058a9b69f1c79325eb47a8e574e4f8f5c796d45"}
 *
 * Go source:
 * func (p *commandLineParser) parseStrings(args []string) {
 * 	i := 0
 * 	for i < len(args) {
 * 		s := args[i]
 * 		i++
 * 		if s == "" {
 * 			continue
 * 		}
 * 		switch s[0] {
 * 		case '@':
 * 			p.parseResponseFile(s[1:])
 * 		case '-':
 * 			inputOptionName := getInputOptionName(s)
 * 			opt := p.optionsMap.GetOptionDeclarationFromName(inputOptionName, true /*allowShort* /)
 * 			if opt != nil {
 * 				i = p.parseOptionValue(args, i, opt, p.workerDiagnostics.OptionTypeMismatchDiagnostic)
 * 			} else {
 * 				watchOpt := WatchNameMap.GetOptionDeclarationFromName(inputOptionName, true /*allowShort* /)
 * 				if watchOpt != nil {
 * 					i = p.parseOptionValue(args, i, watchOpt, watchOptionsDidYouMeanDiagnostics.OptionTypeMismatchDiagnostic)
 * 				} else {
 * 					p.errors = append(p.errors, p.createUnknownOptionError(inputOptionName, s, nil, nil))
 * 				}
 * 			}
 * 		default:
 * 			p.fileNames = append(p.fileNames, s)
 * 		}
 * 	}
 * }
 */
export function commandLineParser_parseStrings(receiver: GoPtr<commandLineParser>, args: GoSlice<string>): void {
  const p = receiver!;
  let i = 0;
  while (i < args.length) {
    const s = args[i]!;
    i++;
    if (s === "") {
      continue;
    }
    const firstChar = s.charCodeAt(0);
    if (firstChar === 64 /* '@' */) {
      commandLineParser_parseResponseFile(p, s.slice(1));
    } else if (firstChar === 45 /* '-' */) {
      const inputOptionName = getInputOptionName(s);
      const opt = NameMap_GetOptionDeclarationFromName(p.optionsMap, inputOptionName, true /*allowShort*/);
      if (opt !== undefined) {
        i = commandLineParser_parseOptionValue(p, args, i, opt, p.workerDiagnostics!.OptionTypeMismatchDiagnostic);
      } else {
        const watchOpt = NameMap_GetOptionDeclarationFromName(WatchNameMap, inputOptionName, true /*allowShort*/);
        if (watchOpt !== undefined) {
          i = commandLineParser_parseOptionValue(p, args, i, watchOpt, watchOptionsDidYouMeanDiagnostics!.OptionTypeMismatchDiagnostic);
        } else {
          p.errors = [...p.errors, commandLineParser_createUnknownOptionError(p, inputOptionName, s, undefined, undefined)];
        }
      }
    } else {
      p.fileNames = [...p.fileNames, s];
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::getInputOptionName","kind":"func","status":"implemented","sigHash":"3734cf522f5a77cb11e01f1c540b4191e033a462570a16046e36052045d0c351","bodyHash":"25c333e0eaaef3058968244c496fce2af335ab9b123eb8e33343620ddf13c250"}
 *
 * Go source:
 * func getInputOptionName(input string) string {
 * 	// removes at most two leading '-' from the input string
 * 	return strings.TrimPrefix(strings.TrimPrefix(input, "-"), "-")
 * }
 */
export function getInputOptionName(input: string): string {
  // removes at most two leading '-' from the input string
  return strings.TrimPrefix(strings.TrimPrefix(input, "-"), "-");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.parseResponseFile","kind":"method","status":"implemented","sigHash":"2c89dbe560e0fa0c00fa3b994cbd27f49cf846b78df1a09568e024cd5695686e","bodyHash":"4011e519c57a7cafdfd9a3ca5c25ddfbe4c6ad829549fbe575aba24fd8368b71"}
 *
 * Go source:
 * func (p *commandLineParser) parseResponseFile(fileName string) {
 * 	fileName = tspath.GetNormalizedAbsolutePath(fileName, p.currentDirectory)
 * 	fileContents, errors := tryReadFile(fileName, func(fileName string) (string, bool) {
 * 		if p.fs == nil {
 * 			return "", false
 * 		}
 * 		read, err := p.fs.ReadFile(fileName)
 * 		return read, err
 * 	}, p.errors)
 * 	p.errors = errors
 *
 * 	if fileContents == "" {
 * 		return
 * 	}
 *
 * 	var args []string
 * 	text := []rune(fileContents)
 * 	textLength := len(text)
 * 	pos := 0
 * 	for pos < textLength {
 * 		for pos < textLength && text[pos] <= ' ' {
 * 			pos++
 * 		}
 * 		if pos >= textLength {
 * 			break
 * 		}
 * 		start := pos
 * 		if text[pos] == '"' {
 * 			pos++
 * 			for pos < textLength && text[pos] != '"' {
 * 				pos++
 * 			}
 * 			if pos < textLength {
 * 				args = append(args, string(text[start+1:pos]))
 * 				pos++
 * 			} else {
 * 				p.errors = append(p.errors, ast.NewCompilerDiagnostic(diagnostics.Unterminated_quoted_string_in_response_file_0, fileName))
 * 			}
 * 		} else {
 * 			for text[pos] > ' ' {
 * 				pos++
 * 			}
 * 			args = append(args, string(text[start:pos]))
 * 		}
 * 	}
 * 	p.parseStrings(args)
 * }
 */
export function commandLineParser_parseResponseFile(receiver: GoPtr<commandLineParser>, fileName: string): void {
  const p = receiver!;
  fileName = GetNormalizedAbsolutePath(fileName, p.currentDirectory);
  const [fileContents, errors] = tryReadFile(fileName, (fn: string): [string, bool] => {
    if (p.fs === undefined || p.fs === null) {
      return ["", false];
    }
    const [read, err] = p.fs.ReadFile(fn);
    return [read, err];
  }, p.errors);
  p.errors = errors;

  if (fileContents === "") {
    return;
  }

  const args: GoSlice<string> = [];
  const text = [...fileContents]; // split into characters (runes)
  const textLength = text.length;
  let pos = 0;
  while (pos < textLength) {
    while (pos < textLength && text[pos]!.charCodeAt(0) <= 32 /* ' ' */) {
      pos++;
    }
    if (pos >= textLength) {
      break;
    }
    const start = pos;
    if (text[pos]! === '"') {
      pos++;
      while (pos < textLength && text[pos]! !== '"') {
        pos++;
      }
      if (pos < textLength) {
        args.push(text.slice(start + 1, pos).join(""));
        pos++;
      } else {
        p.errors = [...p.errors, NewCompilerDiagnostic(Unterminated_quoted_string_in_response_file_0, fileName)];
      }
    } else {
      while (pos < textLength && text[pos]!.charCodeAt(0) > 32 /* ' ' */) {
        pos++;
      }
      args.push(text.slice(start, pos).join(""));
    }
  }
  commandLineParser_parseStrings(p, args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::tryReadFile","kind":"func","status":"implemented","sigHash":"a24f82b6b66c8b49644f5f0e5467ccdcbf953d690be7396a2707c41188849145","bodyHash":"ccc5df9076d6f626dd9f1a426ca998eba274f909b43a13655cd8d1c4e1270d94"}
 *
 * Go source:
 * func tryReadFile(fileName string, readFile func(string) (string, bool), errors []*ast.Diagnostic) (string, []*ast.Diagnostic) {
 * 	// this function adds a compiler diagnostic if the file cannot be read
 * 	text, e := readFile(fileName)
 *
 * 	if !e {
 * 		// !!! Divergence: the returned error will not give a useful message
 * 		// errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Cannot_read_file_0_Colon_1, *e));
 * 		text = ""
 * 		errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Cannot_read_file_0, fileName))
 * 	}
 * 	return text, errors
 * }
 */
export function tryReadFile(fileName: string, readFile: (arg0: string) => [string, bool], errors: GoSlice<GoPtr<Diagnostic>>): [string, GoSlice<GoPtr<Diagnostic>>] {
  // this function adds a compiler diagnostic if the file cannot be read
  let [text, e] = readFile(fileName);

  if (!e) {
    // !!! Divergence: the returned error will not give a useful message
    // errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Cannot_read_file_0_Colon_1, *e));
    text = "";
    errors = [...errors, NewCompilerDiagnostic(Cannot_read_file_0, fileName)];
  }
  return [text, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.parseOptionValue","kind":"method","status":"implemented","sigHash":"bfa56544e75f49c873c7d19e48baf5368dcb24d80ae936cfd0970c7932e32319","bodyHash":"78b944d1b55172b2794f51a44c25e33eb636c6472fbbbf6175d5a50cc2997647"}
 *
 * Go source:
 * func (p *commandLineParser) parseOptionValue(
 * 	args []string,
 * 	i int,
 * 	opt *CommandLineOption,
 * 	diag *diagnostics.Message,
 * ) int {
 * 	if opt.IsTSConfigOnly && i <= len(args) {
 * 		optValue := ""
 * 		if i < len(args) {
 * 			optValue = args[i]
 * 		}
 * 		if optValue == "null" {
 * 			p.options.Set(opt.Name, nil)
 * 			i++
 * 		} else if opt.Kind == "boolean" {
 * 			if optValue == "false" {
 * 				p.options.Set(opt.Name, false)
 * 				i++
 * 			} else {
 * 				if optValue == "true" {
 * 					i++
 * 				}
 * 				p.errors = append(p.errors, ast.NewCompilerDiagnostic(diagnostics.Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_false_or_null_on_command_line, opt.Name))
 * 			}
 * 		} else {
 * 			p.errors = append(p.errors, ast.NewCompilerDiagnostic(diagnostics.Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_null_on_command_line, opt.Name))
 * 			if len(optValue) != 0 && !strings.HasPrefix(optValue, "-") {
 * 				i++
 * 			}
 * 		}
 * 	} else {
 * 		// Check to see if no argument was provided (e.g. "--locale" is the last command-line argument).
 * 		if i >= len(args) {
 * 			if opt.Kind != "boolean" {
 * 				p.errors = append(p.errors, ast.NewCompilerDiagnostic(diag, opt.Name, getCompilerOptionValueTypeString(opt)))
 * 				if opt.Kind == "list" {
 * 					p.options.Set(opt.Name, []string{})
 * 				} else if opt.Kind == "enum" {
 * 					p.errors = append(p.errors, createDiagnosticForInvalidEnumType(opt, nil, nil))
 * 				}
 * 			} else {
 * 				p.options.Set(opt.Name, true)
 * 			}
 * 			return i
 * 		}
 * 		if args[i] != "null" {
 * 			switch opt.Kind {
 * 			case "number":
 * 				// !!! Make sure this parseInt matches JS parseInt
 * 				num, e := strconv.Atoi(args[i])
 * 				if e == nil {
 * 					if num >= opt.minValue {
 * 						p.options.Set(opt.Name, num)
 * 					} else {
 * 						p.errors = append(p.errors, ast.NewCompilerDiagnostic(diagnostics.Option_0_requires_value_to_be_greater_than_1, opt.Name, strconv.Itoa(opt.minValue)))
 * 					}
 * 				} else {
 * 					p.errors = append(p.errors, ast.NewCompilerDiagnostic(diag, opt.Name, "number"))
 * 				}
 * 				i++
 * 			case "boolean":
 * 				// boolean flag has optional value true, false, others
 * 				optValue := args[i]
 * 
 * 				// check next argument as boolean flag value
 * 				if optValue == "false" {
 * 					p.options.Set(opt.Name, false)
 * 				} else {
 * 					p.options.Set(opt.Name, true)
 * 				}
 * 				// try to consume next argument as value for boolean flag; do not consume argument if it is not "true" or "false"
 * 				if optValue == "false" || optValue == "true" {
 * 					i++
 * 				}
 * 			case "string":
 * 				val, err := validateJsonOptionValue(opt, args[i], nil, nil)
 * 				if err == nil {
 * 					p.options.Set(opt.Name, val)
 * 				} else {
 * 					p.errors = append(p.errors, err...)
 * 				}
 * 				i++
 * 			case "list":
 * 				result, err := p.parseListTypeOption(opt, args[i])
 * 				p.options.Set(opt.Name, result)
 * 				p.errors = append(p.errors, err...)
 * 				if len(result) > 0 || len(err) > 0 {
 * 					i++
 * 				}
 * 			case "listOrElement":
 * 				// If not a primitive, the possible types are specified in what is effectively a map of options.
 * 				panic("listOrElement not supported here")
 * 			default:
 * 				val, err := convertJsonOptionOfEnumType(opt, strings.TrimFunc(args[i], stringutil.IsWhiteSpaceLike), nil, nil)
 * 				p.options.Set(opt.Name, val)
 * 				p.errors = append(p.errors, err...)
 * 				i++
 * 			}
 * 		} else {
 * 			p.options.Set(opt.Name, nil)
 * 			i++
 * 		}
 * 	}
 * 	return i
 * }
 */
export function commandLineParser_parseOptionValue(receiver: GoPtr<commandLineParser>, args: GoSlice<string>, i: int, opt: GoPtr<CommandLineOption>, diag: GoPtr<Message>): int {
  const p = receiver!;
  if (opt!.IsTSConfigOnly && i <= args.length) {
    let optValue = "";
    if (i < args.length) {
      optValue = args[i]!;
    }
    if (optValue === "null") {
      OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, undefined);
      i++;
    } else if (opt!.Kind === CommandLineOptionTypeBoolean) {
      if (optValue === "false") {
        OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, false);
        i++;
      } else {
        if (optValue === "true") {
          i++;
        }
        p.errors = [...p.errors, NewCompilerDiagnostic(Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_false_or_null_on_command_line, opt!.Name)];
      }
    } else {
      p.errors = [...p.errors, NewCompilerDiagnostic(Option_0_can_only_be_specified_in_tsconfig_json_file_or_set_to_null_on_command_line, opt!.Name)];
      if (optValue.length !== 0 && !strings.HasPrefix(optValue, "-")) {
        i++;
      }
    }
  } else {
    // Check to see if no argument was provided (e.g. "--locale" is the last command-line argument).
    if (i >= args.length) {
      if (opt!.Kind !== CommandLineOptionTypeBoolean) {
        p.errors = [...p.errors, NewCompilerDiagnostic(diag, opt!.Name, getCompilerOptionValueTypeString(opt))];
        if (opt!.Kind === CommandLineOptionTypeList) {
          OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, []);
        } else if (opt!.Kind === "enum") {
          p.errors = [...p.errors, createDiagnosticForInvalidEnumType(opt, undefined, undefined)];
        }
      } else {
        OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, true);
      }
      return i;
    }
    if (args[i]! !== "null") {
      switch (opt!.Kind) {
        case CommandLineOptionTypeNumber: {
          // !!! Make sure this parseInt matches JS parseInt
          const [num, e] = Atoi(args[i]!);
          if (e === undefined) {
            if (num >= opt!.minValue) {
              OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, num);
            } else {
              p.errors = [...p.errors, NewCompilerDiagnostic(Option_0_requires_value_to_be_greater_than_1, opt!.Name, Itoa(opt!.minValue))];
            }
          } else {
            p.errors = [...p.errors, NewCompilerDiagnostic(diag, opt!.Name, "number")];
          }
          i++;
          break;
        }
        case CommandLineOptionTypeBoolean: {
          // boolean flag has optional value true, false, others
          const optValue = args[i]!;

          // check next argument as boolean flag value
          if (optValue === "false") {
            OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, false);
          } else {
            OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, true);
          }
          // try to consume next argument as value for boolean flag; do not consume argument if it is not "true" or "false"
          if (optValue === "false" || optValue === "true") {
            i++;
          }
          break;
        }
        case CommandLineOptionTypeString: {
          const [val, err] = validateJsonOptionValue(opt, args[i]!, undefined, undefined);
          if (err === undefined || err.length === 0) {
            OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, val);
          } else {
            p.errors = [...p.errors, ...err];
          }
          i++;
          break;
        }
        case CommandLineOptionTypeList: {
          const [result, err] = commandLineParser_parseListTypeOption(p, opt, args[i]!);
          OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, result);
          p.errors = [...p.errors, ...err];
          if (result.length > 0 || err.length > 0) {
            i++;
          }
          break;
        }
        case CommandLineOptionTypeListOrElement: {
          // If not a primitive, the possible types are specified in what is effectively a map of options.
          throw new globalThis.Error("listOrElement not supported here");
        }
        default: {
          const [val, err] = convertJsonOptionOfEnumType(opt, strings.TrimFunc(args[i]!, IsWhiteSpaceLike), undefined, undefined);
          OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, val);
          p.errors = [...p.errors, ...err];
          i++;
          break;
        }
      }
    } else {
      OrderedMap_Set(p.options as GoPtr<OrderedMap<string, unknown>>, opt!.Name, undefined);
      i++;
    }
  }
  return i;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::method::commandLineParser.parseListTypeOption","kind":"method","status":"implemented","sigHash":"7d6a1ab08c5d4cb9afcd730cefa82a959f433b1b9e785a461614b8c1eccee2c4","bodyHash":"f84a8c07e35e1665c19d576b48c76ee9bd278a07d04c52b918cd6262eb1a7fd4"}
 *
 * Go source:
 * func (p *commandLineParser) parseListTypeOption(opt *CommandLineOption, value string) ([]any, []*ast.Diagnostic) {
 * 	return ParseListTypeOption(opt, value)
 * }
 */
export function commandLineParser_parseListTypeOption(receiver: GoPtr<commandLineParser>, opt: GoPtr<CommandLineOption>, value: string): [GoSlice<unknown>, GoSlice<GoPtr<Diagnostic>>] {
  return ParseListTypeOption(opt, value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::ParseListTypeOption","kind":"func","status":"implemented","sigHash":"9b147c03da5c20135894bb08966266e3a8217ae4e6d3788f64014ae7dfcc7690","bodyHash":"ea80b29e68862134b43504862791160f20ae5c7794a33e1c4a0554b9a271a2c8"}
 *
 * Go source:
 * func ParseListTypeOption(opt *CommandLineOption, value string) ([]any, []*ast.Diagnostic) {
 * 	value = strings.TrimSpace(value)
 * 	var errors []*ast.Diagnostic
 * 	if strings.HasPrefix(value, "-") {
 * 		return []any{}, errors
 * 	}
 * 	if opt.Kind == "listOrElement" && !strings.ContainsRune(value, ',') {
 * 		val, err := validateJsonOptionValue(opt, value, nil, nil)
 * 		if err != nil {
 * 			return []any{}, err
 * 		}
 * 		return []any{val.(string)}, errors
 * 	}
 * 	if value == "" {
 * 		return []any{}, errors
 * 	}
 * 	values := strings.Split(value, ",")
 * 	switch opt.Elements().Kind {
 * 	case "string":
 * 		elements := core.MapFiltered(values, func(v string) (any, bool) {
 * 			val, err := validateJsonOptionValue(opt.Elements(), v, nil, nil)
 * 			if s, ok := val.(string); ok && len(err) == 0 && s != "" {
 * 				return s, true
 * 			}
 * 			errors = append(errors, err...)
 * 			return "", false
 * 		})
 * 		return elements, errors
 * 	case "boolean", "object", "number":
 * 		// do nothing: only string and enum/object types currently allowed as list entries
 * 		// 				!!! we don't actually have number list options, so I didn't implement number list parsing
 * 		panic("List of " + opt.Elements().Kind + " is not yet supported.")
 * 	default:
 * 		result := core.MapFiltered(values, func(v string) (any, bool) {
 * 			val, err := convertJsonOptionOfEnumType(opt.Elements(), strings.TrimFunc(v, stringutil.IsWhiteSpaceLike), nil, nil)
 * 			if s, ok := val.(string); ok && len(err) == 0 && s != "" {
 * 				return s, true
 * 			}
 * 			errors = append(errors, err...)
 * 			return "", false
 * 		})
 * 		return result, errors
 * 	}
 * }
 */
export function ParseListTypeOption(opt: GoPtr<CommandLineOption>, value: string): [GoSlice<unknown>, GoSlice<GoPtr<Diagnostic>>] {
  value = strings.TrimSpace(value);
  let errors: GoSlice<GoPtr<Diagnostic>> = [];
  if (strings.HasPrefix(value, "-")) {
    return [[], errors];
  }
  if (opt!.Kind === CommandLineOptionTypeListOrElement && !strings.ContainsRune(value, ",".charCodeAt(0))) {
    const [val, err] = validateJsonOptionValue(opt, value, undefined, undefined);
    if (err !== undefined && err.length !== 0) {
      return [[], err];
    }
    return [[val as string], errors];
  }
  if (value === "") {
    return [[], errors];
  }
  const values = strings.Split(value, ",");
  const elementsKind = CommandLineOption_Elements(opt)!.Kind;
  switch (elementsKind) {
    case CommandLineOptionTypeString: {
      const elements = MapFiltered(values, (v: string): [unknown, bool] => {
        const [val, err] = validateJsonOptionValue(CommandLineOption_Elements(opt), v, undefined, undefined);
        if (typeof val === "string" && (err === undefined || err.length === 0) && val !== "") {
          return [val, true];
        }
        errors = [...errors, ...(err ?? [])];
        return ["", false];
      });
      return [elements, errors];
    }
    case CommandLineOptionTypeBoolean:
    case "object":
    case CommandLineOptionTypeNumber: {
      // do nothing: only string and enum/object types currently allowed as list entries
      // !!! we don't actually have number list options, so I didn't implement number list parsing
      throw new globalThis.Error("List of " + elementsKind + " is not yet supported.");
    }
    default: {
      const result = MapFiltered(values, (v: string): [unknown, bool] => {
        const [val, err] = convertJsonOptionOfEnumType(CommandLineOption_Elements(opt), strings.TrimFunc(v, IsWhiteSpaceLike), undefined, undefined);
        if (typeof val === "string" && (err === undefined || err.length === 0) && val !== "") {
          return [val, true];
        }
        errors = [...errors, ...(err ?? [])];
        return ["", false];
      });
      return [result, errors];
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineparser.go::func::convertJsonOptionOfEnumType","kind":"func","status":"implemented","sigHash":"1e73b48b6273364dada906e24fa936e03652113afa5c578c3221f861d4629ba1","bodyHash":"fe1ef0b12861440f67da7f5bfd8c3cd49d42965c18d4aa82f38dfa58f8b050ec"}
 *
 * Go source:
 * func convertJsonOptionOfEnumType(
 * 	opt *CommandLineOption,
 * 	value string,
 * 	valueExpression *ast.Expression,
 * 	sourceFile *ast.SourceFile,
 * ) (any, []*ast.Diagnostic) {
 * 	if value == "" {
 * 		return nil, nil
 * 	}
 * 	key := strings.ToLower(value)
 * 	typeMap := opt.EnumMap()
 * 	if typeMap == nil {
 * 		return nil, nil
 * 	}
 * 	val, ok := typeMap.Get(key)
 * 	if ok {
 * 		return validateJsonOptionValue(opt, val, valueExpression, sourceFile)
 * 	}
 * 	return nil, []*ast.Diagnostic{createDiagnosticForInvalidEnumType(opt, sourceFile, valueExpression)}
 * }
 */
export function convertJsonOptionOfEnumType(opt: GoPtr<CommandLineOption>, value: string, valueExpression: GoPtr<Expression>, sourceFile: GoPtr<SourceFile>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  if (value === "") {
    return [undefined, undefined as unknown as GoSlice<GoPtr<Diagnostic>>];
  }
  const key = strings.ToLower(value);
  const typeMap = CommandLineOption_EnumMap(opt);
  if (typeMap === undefined) {
    return [undefined, undefined as unknown as GoSlice<GoPtr<Diagnostic>>];
  }
  const [val, ok] = OrderedMap_Get(typeMap as GoPtr<OrderedMap<string, unknown>>, key);
  if (ok) {
    return validateJsonOptionValue(opt, val, valueExpression, sourceFile);
  }
  return [undefined, [createDiagnosticForInvalidEnumType(opt, sourceFile, valueExpression)]];
}

import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Sprintf } from "../../go/fmt.js";
import { Collect } from "../../go/slices.js";
import { Join, ToLower } from "../../go/strings.js";
import { Node_End } from "../ast/spine.js";
import type { Node } from "../ast/spine.js";
import { SourceFile_Text } from "../ast/ast.js";
import type { SourceFile } from "../ast/ast.js";
import { NewCompilerDiagnostic, NewDiagnostic } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { OrderedMap_Keys } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { NewTextRange, TextRange_Pos } from "../core/text.js";
import { SkipTrivia } from "../scanner/scanner.js";
import { NameMap_Get } from "./namemap.js";
import { Filter } from "../core/core.js";
import { Set_Has } from "../collections/set.js";
import type { Message } from "../diagnostics/diagnostics.js";
import {
  Argument_for_0_option_must_be_Colon_1,
  Compiler_option_0_may_only_be_used_with_build,
  Option_build_must_be_the_first_command_line_argument,
  Unknown_build_option_0,
  Unknown_build_option_0_Did_you_mean_1,
  Unknown_compiler_option_0,
  Unknown_compiler_option_0_Did_you_mean_1,
  Unknown_type_acquisition_option_0,
  Unknown_type_acquisition_option_0_Did_you_mean_1,
  Unknown_watch_option_0,
  Unknown_watch_option_0_Did_you_mean_1,
} from "../diagnostics/generated/messages.js";
import type { CommandLineOption } from "./commandlineoption.js";
import {
  CommandLineOption_DeprecatedKeys,
  CommandLineOption_Elements,
  CommandLineOption_EnumMap,
  CommandLineOptionTypeList,
  CommandLineOptionTypeListOrElement,
} from "./commandlineoption.js";
import { commandLineParser_AlternateMode, commandLineParser_UnknownOptionDiagnostic } from "./commandlineparser.js";
import type { commandLineParser } from "./commandlineparser.js";
import type { AlternateModeDiagnostics } from "./diagnostics.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::createDiagnosticForInvalidEnumType","kind":"func","status":"implemented","sigHash":"03fe639bfd85437ff755cd68f1279354ff634a63a2c793ac24273db2e134d40f","bodyHash":"7a2f9cc2015958551877c480ef9288cde97f01f315edce44827e6c6785745fa9"}
 *
 * Go source:
 * func createDiagnosticForInvalidEnumType(opt *CommandLineOption, sourceFile *ast.SourceFile, node *ast.Node) *ast.Diagnostic {
 * 	namesOfType := slices.Collect(opt.EnumMap().Keys())
 * 	stringNames := formatEnumTypeKeys(opt, namesOfType)
 * 	optName := "--" + opt.Name
 * 	return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, diagnostics.Argument_for_0_option_must_be_Colon_1, optName, stringNames)
 * }
 */
export function createDiagnosticForInvalidEnumType(opt: GoPtr<CommandLineOption>, sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): GoPtr<Diagnostic> {
  const namesOfType = Collect(OrderedMap_Keys<string, unknown>(CommandLineOption_EnumMap(opt) as GoPtr<OrderedMap<string, unknown>>));
  const stringNames = formatEnumTypeKeys(opt, namesOfType);
  const optName = "--" + opt!.Name;
  return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, Argument_for_0_option_must_be_Colon_1, optName, stringNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::formatEnumTypeKeys","kind":"func","status":"implemented","sigHash":"927a7704e01378e3809c9092262aacc20f26ffc1ad2fb1601e0fc7bc64dd5003","bodyHash":"9eae661149ef312f65a42f44c3be1745355f76ae75643c1307feca70d685144b"}
 *
 * Go source:
 * func formatEnumTypeKeys(opt *CommandLineOption, keys []string) string {
 * 	if opt.DeprecatedKeys() != nil {
 * 		keys = core.Filter(keys, func(key string) bool { return !opt.DeprecatedKeys().Has(key) })
 * 	}
 * 	return "'" + strings.Join(keys, "', '") + "'"
 * }
 */
export function formatEnumTypeKeys(opt: GoPtr<CommandLineOption>, keys: GoSlice<string>): string {
  const filtered =
    CommandLineOption_DeprecatedKeys(opt) !== undefined
      ? Filter(keys, (key: string): boolean => !Set_Has(CommandLineOption_DeprecatedKeys(opt), key))
      : keys;
  return "'" + Join(filtered, "', '") + "'";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::getCompilerOptionValueTypeString","kind":"func","status":"implemented","sigHash":"78db46be27cd23bd7714e4ca88c563ddab576ecf24d5ab9165d07e055bbdf505","bodyHash":"d09666917f44e1c0e2633dfc98afcf0448142d3d5aecd3f38cbff4a3ddea4ddb"}
 *
 * Go source:
 * func getCompilerOptionValueTypeString(option *CommandLineOption) string {
 * 	switch option.Kind {
 * 	case CommandLineOptionTypeListOrElement:
 * 		return fmt.Sprintf("%v or Array", getCompilerOptionValueTypeString(option.Elements()))
 * 	case CommandLineOptionTypeList:
 * 		return "Array"
 * 	default:
 * 		return string(option.Kind)
 * 	}
 * }
 */
export function getCompilerOptionValueTypeString(option: GoPtr<CommandLineOption>): string {
  switch (option!.Kind) {
    case CommandLineOptionTypeListOrElement:
      return Sprintf("%v or Array", getCompilerOptionValueTypeString(CommandLineOption_Elements(option)));
    case CommandLineOptionTypeList:
      return "Array";
    default:
      return option!.Kind;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::method::commandLineParser.createUnknownOptionError","kind":"method","status":"implemented","sigHash":"0dee86ecdf3af153093684f4163f78599afd58b4d432fdf051599a5821e6691a","bodyHash":"46f30d3d4ddde845500823f85f5301c1c55e4a4b8eb9cbbaf6f6b7d05b019a9e"}
 *
 * Go source:
 * func (parser *commandLineParser) createUnknownOptionError(
 * 	unknownOption string,
 * 	unknownOptionErrorText string,
 * 	node *ast.Node,
 * 	sourceFile *ast.SourceFile,
 * ) *ast.Diagnostic {
 * 	return createUnknownOptionError(
 * 		unknownOption,
 * 		parser.UnknownOptionDiagnostic(),
 * 		unknownOptionErrorText,
 * 		node,
 * 		sourceFile,
 * 		parser.AlternateMode(),
 * 	)
 * }
 */
export function commandLineParser_createUnknownOptionError(receiver: GoPtr<commandLineParser>, unknownOption: string, unknownOptionErrorText: string, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>): GoPtr<Diagnostic> {
  return createUnknownOptionError(
    unknownOption,
    commandLineParser_UnknownOptionDiagnostic(receiver),
    unknownOptionErrorText,
    node,
    sourceFile,
    commandLineParser_AlternateMode(receiver),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::createUnknownOptionError","kind":"func","status":"implemented","sigHash":"56b100f696629e7b52712870caea559e0447003d0ba5c44351502afaed622674","bodyHash":"ff48bdaf533829f08d2cc00560db48234982fe077c43400cb4d6e1700375885c"}
 *
 * Go source:
 * func createUnknownOptionError(
 * 	unknownOption string,
 * 	unknownOptionDiagnostic *diagnostics.Message,
 * 	unknownOptionErrorText string, // optional
 * 	node *ast.Node, // optional
 * 	sourceFile *ast.SourceFile, // optional
 * 	alternateMode *AlternateModeDiagnostics, // optional
 * ) *ast.Diagnostic {
 * 	if alternateMode != nil && alternateMode.optionsNameMap != nil {
 * 		otherOption := alternateMode.optionsNameMap.Get(strings.ToLower(unknownOption))
 * 		if otherOption != nil {
 * 			// tscbuildoption
 * 			diagnostic := alternateMode.diagnostic
 * 			if otherOption.Name == "build" {
 * 				diagnostic = diagnostics.Option_build_must_be_the_first_command_line_argument
 * 			}
 * 			return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, diagnostic, unknownOption)
 * 		}
 * 	}
 * 	if unknownOptionErrorText == "" {
 * 		unknownOptionErrorText = unknownOption
 * 	}
 * 	// TODO: possibleOption := spelling suggestion
 * 	return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, unknownOptionDiagnostic, unknownOptionErrorText)
 * }
 */
export function createUnknownOptionError(unknownOption: string, unknownOptionDiagnostic: GoPtr<Message>, unknownOptionErrorText: string, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, alternateMode: GoPtr<AlternateModeDiagnostics>): GoPtr<Diagnostic> {
  if (alternateMode !== undefined && alternateMode.optionsNameMap !== undefined) {
    const otherOption = NameMap_Get(alternateMode.optionsNameMap, ToLower(unknownOption));
    if (otherOption !== undefined) {
      const diagnostic = otherOption.Name === "build"
        ? Option_build_must_be_the_first_command_line_argument
        : alternateMode.diagnostic;
      return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, diagnostic, unknownOption);
    }
  }
  const errorText = unknownOptionErrorText === "" ? unknownOption : unknownOptionErrorText;
  return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, node, unknownOptionDiagnostic, errorText);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::CreateDiagnosticForNodeInSourceFile","kind":"func","status":"implemented","sigHash":"9f9766e09406c94acb5f0eaa2d5094eaf93011bb588bab6f00e30c17e7d04a59","bodyHash":"afd49e02933d09f8d81ff1b2f165766b109378664d0c6b720bfa4203f95345c9"}
 *
 * Go source:
 * func CreateDiagnosticForNodeInSourceFile(sourceFile *ast.SourceFile, node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	return ast.NewDiagnostic(sourceFile, core.NewTextRange(scanner.SkipTrivia(sourceFile.Text(), node.Loc.Pos()), node.End()), message, args...)
 * }
 */
export function CreateDiagnosticForNodeInSourceFile(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  const text = SourceFile_Text(sourceFile);
  const pos = SkipTrivia(text, TextRange_Pos(node!.Loc));
  return NewDiagnostic(sourceFile, NewTextRange(pos, Node_End(node)), message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic","kind":"func","status":"implemented","sigHash":"bd11e000677b2f612495a12a668dbcc100f234c47b854c84831bc386df1f2a47","bodyHash":"507646fe087da5ba25b1893861ee96411341e0d46332a274dc6125065eec0bd4"}
 *
 * Go source:
 * func CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile *ast.SourceFile, node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	if sourceFile != nil && node != nil {
 * 		return CreateDiagnosticForNodeInSourceFile(sourceFile, node, message, args...)
 * 	}
 * 	return ast.NewCompilerDiagnostic(message, args...)
 * }
 */
export function CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  if (sourceFile !== undefined && node !== undefined) {
    return CreateDiagnosticForNodeInSourceFile(sourceFile, node, message, ...args);
  }
  return NewCompilerDiagnostic(message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::extraKeyDiagnostics","kind":"func","status":"implemented","sigHash":"93153553c6909a3f537fadd4f059108a43a0b260f882a6592bf27f5f2127974c","bodyHash":"5fffce888f45e2cf90cc81a39ef2e4323ae6b46eb53639c1795d745954384283"}
 *
 * Go source:
 * func extraKeyDiagnostics(s string) *diagnostics.Message {
 * 	switch s {
 * 	case "compilerOptions":
 * 		return diagnostics.Unknown_compiler_option_0
 * 	case "watchOptions":
 * 		return diagnostics.Unknown_watch_option_0
 * 	case "typeAcquisition":
 * 		return diagnostics.Unknown_type_acquisition_option_0
 * 	case "buildOptions":
 * 		return diagnostics.Unknown_build_option_0
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function extraKeyDiagnostics(s: string): GoPtr<Message> {
  switch (s) {
    case "compilerOptions":
      return Unknown_compiler_option_0;
    case "watchOptions":
      return Unknown_watch_option_0;
    case "typeAcquisition":
      return Unknown_type_acquisition_option_0;
    case "buildOptions":
      return Unknown_build_option_0;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/errors.go::func::extraKeyDidYouMeanDiagnostics","kind":"func","status":"implemented","sigHash":"d29991ca5ba5a0e1e6050cf1433f62af4fbc9862f759392b04452b9266b60ea6","bodyHash":"0d5f9b156a85ae4a49189a55c681ba64bffc1de94922a0d441a51d831678de59"}
 *
 * Go source:
 * func extraKeyDidYouMeanDiagnostics(s string) *diagnostics.Message {
 * 	switch s {
 * 	case "compilerOptions":
 * 		return diagnostics.Unknown_compiler_option_0_Did_you_mean_1
 * 	case "watchOptions":
 * 		return diagnostics.Unknown_watch_option_0_Did_you_mean_1
 * 	case "typeAcquisition":
 * 		return diagnostics.Unknown_type_acquisition_option_0_Did_you_mean_1
 * 	case "buildOptions":
 * 		return diagnostics.Unknown_build_option_0_Did_you_mean_1
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function extraKeyDidYouMeanDiagnostics(s: string): GoPtr<Message> {
  switch (s) {
    case "compilerOptions":
      return Unknown_compiler_option_0_Did_you_mean_1;
    case "watchOptions":
      return Unknown_watch_option_0_Did_you_mean_1;
    case "typeAcquisition":
      return Unknown_type_acquisition_option_0_Did_you_mean_1;
    case "buildOptions":
      return Unknown_build_option_0_Did_you_mean_1;
    default:
      return undefined;
  }
}

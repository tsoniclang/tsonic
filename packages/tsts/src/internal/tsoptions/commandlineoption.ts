import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { Set } from "../collections/set.js";
import { NewSetFromItems } from "../collections/set.js";
import type { Tristate } from "../core/tristate.js";
import { TSUnknown } from "../core/tristate.js";
import type { Message } from "../diagnostics/diagnostics.js";
import * as strings from "../../go/strings.js";
import type { CommandLineOptionNameMap } from "./tsconfigparsing.js";
import {
  fallbackEnumMap,
  jsxOptionMap,
  LibMap,
  moduleDetectionOptionMap,
  moduleOptionMap,
  moduleResolutionOptionMap,
  newLineOptionMap,
  targetOptionMap,
  watchDirectoryEnumMap,
  watchFileEnumMap,
} from "./enummaps.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::type::CommandLineOptionKind","kind":"type","status":"implemented","sigHash":"c8f201add3454d31edf99485739310a8aedb1f1cfe566de059b461899ef7913f","bodyHash":"cac4255e78f9d18136c0af3d56004a513fbfef7ff5c62d31d38267e6c8c6ecb5"}
 *
 * Go source:
 * CommandLineOptionKind string
 */
export type CommandLineOptionKind = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::constGroup::CommandLineOptionTypeString+CommandLineOptionTypeNumber+CommandLineOptionTypeBoolean+CommandLineOptionTypeObject+CommandLineOptionTypeList+CommandLineOptionTypeListOrElement+CommandLineOptionTypeEnum","kind":"constGroup","status":"implemented","sigHash":"d8ad767bae6b9baf6382e615e0866640d51278ae68f863a91a7a68926e9ca5a4","bodyHash":"3a457fb7cf9eecbec4a6e290f9a3cd5c21d032d20112a8bf9e33c94399bd54a5"}
 *
 * Go source:
 * const (
 * 	CommandLineOptionTypeString        CommandLineOptionKind = "string"
 * 	CommandLineOptionTypeNumber        CommandLineOptionKind = "number"
 * 	CommandLineOptionTypeBoolean       CommandLineOptionKind = "boolean"
 * 	CommandLineOptionTypeObject        CommandLineOptionKind = "object"
 * 	CommandLineOptionTypeList          CommandLineOptionKind = "list"
 * 	CommandLineOptionTypeListOrElement CommandLineOptionKind = "listOrElement"
 * 	CommandLineOptionTypeEnum          CommandLineOptionKind = "enum" // map
 * )
 */
export const CommandLineOptionTypeString: CommandLineOptionKind = "string";
export const CommandLineOptionTypeNumber: CommandLineOptionKind = "number";
export const CommandLineOptionTypeBoolean: CommandLineOptionKind = "boolean";
export const CommandLineOptionTypeObject: CommandLineOptionKind = "object";
export const CommandLineOptionTypeList: CommandLineOptionKind = "list";
export const CommandLineOptionTypeListOrElement: CommandLineOptionKind = "listOrElement";
export const CommandLineOptionTypeEnum: CommandLineOptionKind = "enum"; // map

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::type::CommandLineOption","kind":"type","status":"implemented","sigHash":"6d590a9acbb33fd67624c842a9ff41b0a9bc6c01548ec6e270e6a3aa10e6a34a","bodyHash":"505bf4252a9c46c83778410e3233f89e896463add11f444e0b2f1263eb4b7e25"}
 *
 * Go source:
 * CommandLineOption struct {
 * 	Name, ShortName string
 * 	Kind            CommandLineOptionKind
 * 
 * 	// used in parsing
 * 	IsFilePath        bool
 * 	IsTSConfigOnly    bool
 * 	IsCommandLineOnly bool
 * 
 * 	// used in output
 * 	Description              *diagnostics.Message
 * 	DefaultValueDescription  any
 * 	ShowInSimplifiedHelpView bool
 * 
 * 	// used in output in serializing and generate tsconfig
 * 	Category *diagnostics.Message
 * 
 * 	// What kind of extra validation `validateJsonOptionValue` should do
 * 	extraValidation extraValidation
 * 
 * 	// checks that option with number type has value >= minValue
 * 	minValue int
 * 
 * 	// true or undefined
 * 	// used for configDirTemplateSubstitutionOptions
 * 	allowConfigDirTemplateSubstitution bool
 * 
 * 	// used for filter in compilerrunner
 * 	AffectsDeclarationPath     bool
 * 	AffectsProgramStructure    bool
 * 	AffectsSemanticDiagnostics bool
 * 	AffectsBuildInfo           bool
 * 	AffectsBindDiagnostics     bool
 * 	AffectsSourceFile          bool
 * 	AffectsModuleResolution    bool
 * 	AffectsEmit                bool
 * 
 * 	allowJsFlag bool
 * 	strictFlag  bool
 * 
 * 	// used in transpileoptions worker
 * 	// todo: revisit to see if this can be reduced to boolean
 * 	transpileOptionValue core.Tristate
 * 
 * 	// used for CommandLineOptionTypeList
 * 	listPreserveFalsyValues bool
 * 	// used for compilerOptionsDeclaration
 * 	ElementOptions CommandLineOptionNameMap
 * }
 */
export interface CommandLineOption {
  Name: string;
  ShortName: string;
  Kind: CommandLineOptionKind;
  IsFilePath: bool;
  IsTSConfigOnly: bool;
  IsCommandLineOnly: bool;
  Description: GoPtr<Message>;
  DefaultValueDescription: unknown;
  ShowInSimplifiedHelpView: bool;
  Category: GoPtr<Message>;
  extraValidation: extraValidation;
  minValue: int;
  allowConfigDirTemplateSubstitution: bool;
  AffectsDeclarationPath: bool;
  AffectsProgramStructure: bool;
  AffectsSemanticDiagnostics: bool;
  AffectsBuildInfo: bool;
  AffectsBindDiagnostics: bool;
  AffectsSourceFile: bool;
  AffectsModuleResolution: bool;
  AffectsEmit: bool;
  allowJsFlag: bool;
  strictFlag: bool;
  transpileOptionValue: Tristate;
  listPreserveFalsyValues: bool;
  ElementOptions: CommandLineOptionNameMap | undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::type::extraValidation","kind":"type","status":"implemented","sigHash":"2ff253eb0160e5def2d0a07bc45cf2c5f91c06c52809acf2c43286acb2391b74","bodyHash":"6465c03adf14ae2569abbc11347d791c253e62212cb76dabb5abe0dc86f3e110"}
 *
 * Go source:
 * extraValidation string
 */
export type extraValidation = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::constGroup::extraValidationNone+extraValidationSpec+extraValidationLocale","kind":"constGroup","status":"implemented","sigHash":"3ad826842f1c29f66ecd43899f2e672e473d9e1cefa44bca14a7a426a381ec67","bodyHash":"2ed57459c3816e38052f7f2a5bfe677b7e84a9ff507e984926ec63bb6768c000"}
 *
 * Go source:
 * const (
 * 	extraValidationNone   extraValidation = ""
 * 	extraValidationSpec   extraValidation = "spec"
 * 	extraValidationLocale extraValidation = "locale"
 * )
 */
export const extraValidationNone: extraValidation = "";
export const extraValidationSpec: extraValidation = "spec";
export const extraValidationLocale: extraValidation = "locale";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::method::CommandLineOption.DeprecatedKeys","kind":"method","status":"implemented","sigHash":"e790a3ee51514f23b325a82d46b9fc408cafc4b46bc90a757fba175f924dea8b","bodyHash":"19e15b66a5d8ceb280ddb3007b5e029ba825f3dc79aa75bc0f536725a0f0ed1b"}
 *
 * Go source:
 * func (o *CommandLineOption) DeprecatedKeys() *collections.Set[string] {
 * 	if o.Kind != CommandLineOptionTypeEnum {
 * 		return nil
 * 	}
 * 	return commandLineOptionDeprecated[o.Name]
 * }
 */
export function CommandLineOption_DeprecatedKeys(receiver: GoPtr<CommandLineOption>): GoPtr<Set<string>> {
  const o = receiver!;
  if (o.Kind !== CommandLineOptionTypeEnum) {
    return undefined;
  }
  return commandLineOptionDeprecated.get(o.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::method::CommandLineOption.EnumMap","kind":"method","status":"implemented","sigHash":"1d0662d29f9c90d3e8e6c3232133c94ffb031dfa222470202d53202b34ec464d","bodyHash":"e3ce7c4aa27f8c9bae94a883b59828c320678b869fd7f79b20f1a6f9993c8e31"}
 *
 * Go source:
 * func (o *CommandLineOption) EnumMap() *collections.OrderedMap[string, any] {
 * 	if o.Kind != CommandLineOptionTypeEnum {
 * 		return nil
 * 	}
 * 	return commandLineOptionEnumMap[o.Name]
 * }
 */
export function CommandLineOption_EnumMap(receiver: GoPtr<CommandLineOption>): GoPtr<OrderedMap<string, unknown>> {
  const o = receiver!;
  if (o.Kind !== CommandLineOptionTypeEnum) {
    return undefined;
  }
  return commandLineOptionEnumMap.get(o.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::method::CommandLineOption.Elements","kind":"method","status":"implemented","sigHash":"638baf76d18c49e25389f63a5fd42066057d203c4f95b8c5bf82a550b344549f","bodyHash":"634731c5ee55ec34645767cd99538636ce5937799294190ae9b976e8ab043782"}
 *
 * Go source:
 * func (o *CommandLineOption) Elements() *CommandLineOption {
 * 	if o.Kind != CommandLineOptionTypeList && o.Kind != CommandLineOptionTypeListOrElement {
 * 		return nil
 * 	}
 * 	return commandLineOptionElements[o.Name]
 * }
 */
export function CommandLineOption_Elements(receiver: GoPtr<CommandLineOption>): GoPtr<CommandLineOption> {
  const o = receiver!;
  if (o.Kind !== CommandLineOptionTypeList && o.Kind !== CommandLineOptionTypeListOrElement) {
    return undefined;
  }
  return commandLineOptionElements.get(o.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::method::CommandLineOption.DisallowNullOrUndefined","kind":"method","status":"implemented","sigHash":"d9feda88c55213c27204d00b602a060eba5e4a5cda23ff793e96a8ba5a3cc4f4","bodyHash":"82f6e5437ddccf8a8087381da807dca74a3f71e0690e1cf5eaa734042ac06362"}
 *
 * Go source:
 * func (o *CommandLineOption) DisallowNullOrUndefined() bool {
 * 	return o.Name == "extends"
 * }
 */
export function CommandLineOption_DisallowNullOrUndefined(receiver: GoPtr<CommandLineOption>): bool {
  const o = receiver!;
  return o.Name === "extends";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::varGroup::commandLineOptionElements","kind":"varGroup","status":"implemented","sigHash":"8a8a530e9218e40f68d7544870a2cef90e2ff234717d659d40227396c4f07112","bodyHash":"cd83d1acb253d1499396e8e81bc6d4ecdbcbe14ff044a807c9312090ee216788"}
 *
 * Go source:
 * var commandLineOptionElements = map[string]*CommandLineOption{
 * 	"lib": {
 * 		Name:                    "lib",
 * 		Kind:                    CommandLineOptionTypeEnum, // libMap,
 * 		DefaultValueDescription: core.TSUnknown,
 * 	},
 * 	"rootDirs": {
 * 		Name:       "rootDirs",
 * 		Kind:       CommandLineOptionTypeString,
 * 		IsFilePath: true,
 * 	},
 * 	"typeRoots": {
 * 		Name:       "typeRoots",
 * 		Kind:       CommandLineOptionTypeString,
 * 		IsFilePath: true,
 * 	},
 * 	"types": {
 * 		Name: "types",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"moduleSuffixes": {
 * 		Name: "moduleSuffixes",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"customConditions": {
 * 		Name: "condition",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"plugins": {
 * 		Name: "plugin",
 * 		Kind: CommandLineOptionTypeObject,
 * 	},
 * 	// For tsconfig root options
 * 	"references": {
 * 		Name: "references",
 * 		Kind: CommandLineOptionTypeObject,
 * 	},
 * 	"files": {
 * 		Name: "files",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"include": {
 * 		Name: "include",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"exclude": {
 * 		Name: "exclude",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	"extends": {
 * 		Name: "extends",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * 	// For Watch options
 * 	"excludeDirectories": {
 * 		Name:            "excludeDirectory",
 * 		Kind:            CommandLineOptionTypeString,
 * 		IsFilePath:      true,
 * 		extraValidation: extraValidationSpec,
 * 	},
 * 	"excludeFiles": {
 * 		Name:            "excludeFile",
 * 		Kind:            CommandLineOptionTypeString,
 * 		IsFilePath:      true,
 * 		extraValidation: extraValidationSpec,
 * 	},
 * 	// Test infra options
 * 	"libFiles": {
 * 		Name: "libFiles",
 * 		Kind: CommandLineOptionTypeString,
 * 	},
 * }
 */
// Constructs a CommandLineOption from a Go composite literal's named fields,
// filling all remaining fields with their Go zero values.
export function newCommandLineOption(fields: Partial<CommandLineOption>): CommandLineOption {
  return {
    Name: "",
    ShortName: "",
    Kind: "",
    IsFilePath: false,
    IsTSConfigOnly: false,
    IsCommandLineOnly: false,
    Description: undefined,
    DefaultValueDescription: undefined,
    ShowInSimplifiedHelpView: false,
    Category: undefined,
    extraValidation: extraValidationNone,
    minValue: 0,
    allowConfigDirTemplateSubstitution: false,
    AffectsDeclarationPath: false,
    AffectsProgramStructure: false,
    AffectsSemanticDiagnostics: false,
    AffectsBuildInfo: false,
    AffectsBindDiagnostics: false,
    AffectsSourceFile: false,
    AffectsModuleResolution: false,
    AffectsEmit: false,
    allowJsFlag: false,
    strictFlag: false,
    transpileOptionValue: TSUnknown,
    listPreserveFalsyValues: false,
    ElementOptions: undefined,
    ...fields,
  };
}

export function commandLineOptionsToMap(compilerOptions: GoSlice<GoPtr<CommandLineOption>>): CommandLineOptionNameMap {
  const result: CommandLineOptionNameMap = new globalThis.Map<string, GoPtr<CommandLineOption>>();
  for (let i = 0; i < compilerOptions.length; i++) {
    result.set(compilerOptions[i]!.Name, compilerOptions[i]);
    result.set(strings.ToLower(compilerOptions[i]!.Name), compilerOptions[i]);
  }
  return result;
}

export const commandLineOptionElements: GoMap<string, GoPtr<CommandLineOption>> = new globalThis.Map<string, GoPtr<CommandLineOption>>([
  ["lib", newCommandLineOption({
    Name: "lib",
    Kind: CommandLineOptionTypeEnum, // libMap,
    DefaultValueDescription: TSUnknown,
  })],
  ["rootDirs", newCommandLineOption({
    Name: "rootDirs",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
  })],
  ["typeRoots", newCommandLineOption({
    Name: "typeRoots",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
  })],
  ["types", newCommandLineOption({
    Name: "types",
    Kind: CommandLineOptionTypeString,
  })],
  ["moduleSuffixes", newCommandLineOption({
    Name: "moduleSuffixes",
    Kind: CommandLineOptionTypeString,
  })],
  ["customConditions", newCommandLineOption({
    Name: "condition",
    Kind: CommandLineOptionTypeString,
  })],
  ["plugins", newCommandLineOption({
    Name: "plugin",
    Kind: CommandLineOptionTypeObject,
  })],
  // For tsconfig root options
  ["references", newCommandLineOption({
    Name: "references",
    Kind: CommandLineOptionTypeObject,
  })],
  ["files", newCommandLineOption({
    Name: "files",
    Kind: CommandLineOptionTypeString,
  })],
  ["include", newCommandLineOption({
    Name: "include",
    Kind: CommandLineOptionTypeString,
  })],
  ["exclude", newCommandLineOption({
    Name: "exclude",
    Kind: CommandLineOptionTypeString,
  })],
  ["extends", newCommandLineOption({
    Name: "extends",
    Kind: CommandLineOptionTypeString,
  })],
  // For Watch options
  ["excludeDirectories", newCommandLineOption({
    Name: "excludeDirectory",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    extraValidation: extraValidationSpec,
  })],
  ["excludeFiles", newCommandLineOption({
    Name: "excludeFile",
    Kind: CommandLineOptionTypeString,
    IsFilePath: true,
    extraValidation: extraValidationSpec,
  })],
  // Test infra options
  ["libFiles", newCommandLineOption({
    Name: "libFiles",
    Kind: CommandLineOptionTypeString,
  })],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::varGroup::commandLineOptionEnumMap","kind":"varGroup","status":"implemented","sigHash":"a301347231d5e418911578fe0680dcf763fce61d2945cb6b036c0a94d068f3cf","bodyHash":"0fb6decef34e751eda6b545f4b806469f2a21064f81bb83bf106fab949e98510"}
 *
 * Go source:
 * var commandLineOptionEnumMap = map[string]*collections.OrderedMap[string, any]{
 * 	"lib":              LibMap,
 * 	"moduleResolution": moduleResolutionOptionMap,
 * 	"module":           moduleOptionMap,
 * 	"target":           targetOptionMap,
 * 	"moduleDetection":  moduleDetectionOptionMap,
 * 	"jsx":              jsxOptionMap,
 * 	"newLine":          newLineOptionMap,
 * 	"watchFile":        watchFileEnumMap,
 * 	"watchDirectory":   watchDirectoryEnumMap,
 * 	"fallbackPolling":  fallbackEnumMap,
 * }
 */
export const commandLineOptionEnumMap: GoMap<string, GoPtr<OrderedMap<string, unknown>>> = new globalThis.Map<string, GoPtr<OrderedMap<string, unknown>>>([
  ["lib", LibMap as GoPtr<OrderedMap<string, unknown>>],
  ["moduleResolution", moduleResolutionOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["module", moduleOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["target", targetOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["moduleDetection", moduleDetectionOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["jsx", jsxOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["newLine", newLineOptionMap as GoPtr<OrderedMap<string, unknown>>],
  ["watchFile", watchFileEnumMap as GoPtr<OrderedMap<string, unknown>>],
  ["watchDirectory", watchDirectoryEnumMap as GoPtr<OrderedMap<string, unknown>>],
  ["fallbackPolling", fallbackEnumMap as GoPtr<OrderedMap<string, unknown>>],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::varGroup::commandLineOptionDeprecated","kind":"varGroup","status":"implemented","sigHash":"e9905821905d457a4ce0cbfd522cb6c6c35d728eeadca17830af492602561c56","bodyHash":"be72e14b58cc46cb333e3d006d08a458cb1277c4333296dde3312255900e8554"}
 *
 * Go source:
 * var commandLineOptionDeprecated = map[string]*collections.Set[string]{
 * 	"module":           collections.NewSetFromItems("none", "amd", "system", "umd"),
 * 	"moduleResolution": collections.NewSetFromItems("node", "classic", "node10"),
 * 	"target":           collections.NewSetFromItems("es5"),
 * }
 */
export const commandLineOptionDeprecated: GoMap<string, GoPtr<Set<string>>> = new globalThis.Map<string, GoPtr<Set<string>>>([
  ["module", NewSetFromItems<string>("none", "amd", "system", "umd")],
  ["moduleResolution", NewSetFromItems<string>("node", "classic", "node10")],
  ["target", NewSetFromItems<string>("es5")],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/commandlineoption.go::type::CompilerOptionsValue","kind":"type","status":"implemented","sigHash":"3a5cbad0e2a88d5da0eb998c39b22419c304ca55e1272d38f591f592495d1d04","bodyHash":"77f4e718f5fa2a50e94d07ca83ad52c8889d713c71e57dd5d8df1d646355d353"}
 *
 * Go source:
 * CompilerOptionsValue any
 */
export type CompilerOptionsValue = unknown;

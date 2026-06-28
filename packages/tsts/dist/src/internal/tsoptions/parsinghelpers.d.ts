import type { bool, int } from "../../go/scalars.js";
import type { GoConstraint, GoPtr, GoSlice } from "../../go/compat.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { BuildOptions } from "../core/buildoptions.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import type { ProjectReference } from "../core/projectreference.js";
import type { Tristate } from "../core/tristate.js";
import type { TypeAcquisition } from "../core/typeacquisition.js";
import type { WatchOptions } from "../core/watchoptions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { CommandLineOptionNameMap } from "./tsconfigparsing.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseTristate","kind":"func","status":"implemented","sigHash":"49c663f5d4d2bfc54d4329d3c33406f6d96155082766b6de7630809dacb0801b","bodyHash":"5c576abd91bbe40ecd51373a6380cc36bcf1cfe3c57c1bf45e846fd8bcd7885f"}
 *
 * Go source:
 * func ParseTristate(value any) core.Tristate {
 * 	if value == nil {
 * 		return core.TSUnknown
 * 	}
 * 	if v, ok := value.(core.Tristate); ok {
 * 		return v
 * 	}
 * 	if value == true {
 * 		return core.TSTrue
 * 	} else {
 * 		return core.TSFalse
 * 	}
 * }
 */
export declare function ParseTristate(value: unknown): Tristate;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseStringArray","kind":"func","status":"implemented","sigHash":"36b233b78f885e44a5986a3a3605e2f65b58c5262604c75af06bdf4918ec8442","bodyHash":"a5b8c8cbb8f98466b8c26e8a3f0b799f81d8ba1dd33b909b42365ddd699b1bf0"}
 *
 * Go source:
 * func ParseStringArray(value any) []string {
 * 	if arr, ok := value.([]any); ok {
 * 		if arr == nil {
 * 			return nil
 * 		}
 * 		result := make([]string, 0, len(arr))
 * 		for _, v := range arr {
 * 			if str, ok := v.(string); ok {
 * 				result = append(result, str)
 * 			}
 * 		}
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export declare function ParseStringArray(value: unknown): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::parseStringMap","kind":"func","status":"implemented","sigHash":"44db66c10f86c995c3674b1cf3c4074a364d8577dba6707a74e44b8bb59004ce","bodyHash":"2559ee4831f78efbceee2502059a69ed20babd3920b5c97f45f49e10a8e517d3"}
 *
 * Go source:
 * func parseStringMap(value any) *collections.OrderedMap[string, []string] {
 * 	if m, ok := value.(*collections.OrderedMap[string, any]); ok {
 * 		result := collections.NewOrderedMapWithSizeHint[string, []string](m.Size())
 * 		for k, v := range m.Entries() {
 * 			result.Set(k, ParseStringArray(v))
 * 		}
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export declare function parseStringMap(value: unknown): GoPtr<OrderedMap<string, GoSlice<string>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseString","kind":"func","status":"implemented","sigHash":"e2e4b2eb4386c97194e65b39bad6355bfc2d7aa1bc2872c43f57a2f826f48c5d","bodyHash":"5c2be08fe320f223e1ad3fd8e78f47a55cf55bd4a04f9c65e270d74b35de7fd6"}
 *
 * Go source:
 * func ParseString(value any) string {
 * 	if str, ok := value.(string); ok {
 * 		return str
 * 	}
 * 	return ""
 * }
 */
export declare function ParseString(value: unknown): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::parseNumber","kind":"func","status":"implemented","sigHash":"c8e2c76e517fa4a8fa061e2c3ce415d7652cdc1d3b38ebea5097e0d79fe4d3e4","bodyHash":"b00067537e686113ed8b821c9f3351b1c44129238827f4c5deadb4327bb529d5"}
 *
 * Go source:
 * func parseNumber(value any) *int {
 * 	if num, ok := value.(int); ok {
 * 		return &num
 * 	}
 * 	if num, ok := value.(float64); ok {
 * 		n := int(num)
 * 		return &n
 * 	}
 * 	return nil
 * }
 */
export declare function parseNumber(value: unknown): GoPtr<int>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::parseProjectReference","kind":"func","status":"implemented","sigHash":"818a4e147f733461a7da20f74182e641116a5c6ae1948c631b811ba9de557c2c","bodyHash":"44f66889a389cd80c1afed083222d24d66affc64f88e6509c7144a41641b00f8"}
 *
 * Go source:
 * func parseProjectReference(json any) []*core.ProjectReference {
 * 	var result []*core.ProjectReference
 * 	if v, ok := json.(*collections.OrderedMap[string, any]); ok {
 * 		var reference core.ProjectReference
 * 		if v, ok := v.Get("path"); ok {
 * 			reference.Path = v.(string)
 * 		}
 * 		if v, ok := v.Get("circular"); ok {
 * 			reference.Circular = v.(bool)
 * 		}
 * 		result = append(result, &reference)
 * 	}
 * 	return result
 * }
 */
export declare function parseProjectReference(json: unknown): GoSlice<GoPtr<ProjectReference>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::parseJsonToStringKey","kind":"func","status":"implemented","sigHash":"e2aa05789812ea7808caa85537dded05e3f9d10f47c7b0e69615566f66b7be8c","bodyHash":"2d1f01d3d00baf2d79696ea4adb225642d19c6fefee267a11cf8f92568f86a45"}
 *
 * Go source:
 * func parseJsonToStringKey(json any) *collections.OrderedMap[string, any] {
 * 	result := collections.NewOrderedMapWithSizeHint[string, any](6)
 * 	if m, ok := json.(*collections.OrderedMap[string, any]); ok {
 * 		if v, ok := m.Get("include"); ok {
 * 			result.Set("include", v)
 * 		}
 * 		if v, ok := m.Get("exclude"); ok {
 * 			result.Set("exclude", v)
 * 		}
 * 		if v, ok := m.Get("files"); ok {
 * 			result.Set("files", v)
 * 		}
 * 		if v, ok := m.Get("references"); ok {
 * 			result.Set("references", v)
 * 		}
 * 		if v, ok := m.Get("extends"); ok {
 * 			if str, ok := v.(string); ok {
 * 				result.Set("extends", []any{str})
 * 			}
 * 			result.Set("extends", v)
 * 		}
 * 		if v, ok := m.Get("compilerOptions"); ok {
 * 			result.Set("compilerOptions", v)
 * 		}
 * 		if v, ok := m.Get("excludes"); ok {
 * 			result.Set("excludes", v)
 * 		}
 * 		if v, ok := m.Get("typeAcquisition"); ok {
 * 			result.Set("typeAcquisition", v)
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function parseJsonToStringKey(json: unknown): GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::type::optionParser","kind":"type","status":"implemented","sigHash":"c409b167b74b0de7c2af5d5f47c3892bfb9612c524b3037b334afec6938063d7","bodyHash":"76bebf033feb06eb908a40f0dadd8562faf33be1877c89ab3bcb91043dd0a47e"}
 *
 * Go source:
 * optionParser interface {
 * 	ParseOption(key string, value any) []*ast.Diagnostic
 * 	UnknownOptionDiagnostic() *diagnostics.Message
 * 	UnknownDidYouMeanDiagnostic() *diagnostics.Message
 * }
 */
export interface optionParser {
    ParseOption(key: string, value: unknown): GoSlice<GoPtr<Diagnostic>>;
    UnknownOptionDiagnostic(): GoPtr<Message>;
    UnknownDidYouMeanDiagnostic(): GoPtr<Message>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::type::compilerOptionsParser","kind":"type","status":"implemented","sigHash":"7546cba537de554a50bcf32a30caa0b79ed2ed6598d92cc94e563f5d75580ba3","bodyHash":"31f1aea80830d374610b6c8a36cf1d579f81302c4617273ab320558d6bbe37fd"}
 *
 * Go source:
 * compilerOptionsParser struct {
 * 	*core.CompilerOptions
 * }
 */
export interface compilerOptionsParser {
    readonly __tsgoEmbedded0?: GoPtr<CompilerOptions>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::compilerOptionsParser.ParseOption","kind":"method","status":"implemented","sigHash":"e3e5d3fa15a6c262a1dda4826b58471a520ff7c14b5aba00a340c7159f58db7a","bodyHash":"5038dce291d6eeaa8ddd6ddd8d6ab18502503877bc566bd94e5c2572f305bcd1"}
 *
 * Go source:
 * func (o *compilerOptionsParser) ParseOption(key string, value any) []*ast.Diagnostic {
 * 	return ParseCompilerOptions(key, value, o.CompilerOptions)
 * }
 */
export declare function compilerOptionsParser_ParseOption(receiver: GoPtr<compilerOptionsParser>, key: string, value: unknown): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::compilerOptionsParser.UnknownOptionDiagnostic","kind":"method","status":"implemented","sigHash":"2805b20c83c398ecca3920b71c5f2cee674c7654617a7d39976a8a73630c56f0","bodyHash":"7b11f2c001ab97c2207804b3278afb761e72933af41b70109b335cd83f475136"}
 *
 * Go source:
 * func (o *compilerOptionsParser) UnknownOptionDiagnostic() *diagnostics.Message {
 * 	return extraKeyDiagnostics("compilerOptions")
 * }
 */
export declare function compilerOptionsParser_UnknownOptionDiagnostic(receiver: GoPtr<compilerOptionsParser>): GoPtr<Message>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::compilerOptionsParser.UnknownDidYouMeanDiagnostic","kind":"method","status":"implemented","sigHash":"600d8c4e070559eeb11c56c6ab4520f80e829d22dc087bb193e74c0d8b1642e5","bodyHash":"1d8011c92f7bc7a8e6bc006c10d57c4d93c3a267c76ca4480fed95795c470b3e"}
 *
 * Go source:
 * func (o *compilerOptionsParser) UnknownDidYouMeanDiagnostic() *diagnostics.Message {
 * 	return extraKeyDidYouMeanDiagnostics("compilerOptions")
 * }
 */
export declare function compilerOptionsParser_UnknownDidYouMeanDiagnostic(receiver: GoPtr<compilerOptionsParser>): GoPtr<Message>;
export declare function compilerOptionsParser_as_optionParser(receiver: GoPtr<compilerOptionsParser>): optionParser;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::type::watchOptionsParser","kind":"type","status":"implemented","sigHash":"717d985b9f4fbd959ea3dfa0bc4cefe234d97044ef558bdc4da4842c6f42d279","bodyHash":"9e3449cfacdb4ce17607d42cf450131ed77f40afdd891dcf5455088da61fc283"}
 *
 * Go source:
 * watchOptionsParser struct {
 * 	*core.WatchOptions
 * }
 */
export interface watchOptionsParser {
    readonly __tsgoEmbedded0?: GoPtr<WatchOptions>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::watchOptionsParser.ParseOption","kind":"method","status":"implemented","sigHash":"b073e29c211f65f8841f95982afe6e4e380896b89bc36a6c6002eb18883d4f14","bodyHash":"fe0efae220519043bd6f2e27e87ebb60a43e25bc168342073403a41dc36d5e92"}
 *
 * Go source:
 * func (o *watchOptionsParser) ParseOption(key string, value any) []*ast.Diagnostic {
 * 	return ParseWatchOptions(key, value, o.WatchOptions)
 * }
 */
export declare function watchOptionsParser_ParseOption(receiver: GoPtr<watchOptionsParser>, key: string, value: unknown): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::watchOptionsParser.UnknownOptionDiagnostic","kind":"method","status":"implemented","sigHash":"386186a0698c47f990c81a35330acf866570e4d9e1774e0c2530c1442fd3e3fb","bodyHash":"560ea20a321b926fc4bda6581edbeafc35f950bc81e6330448f3f1bf6b30bc2d"}
 *
 * Go source:
 * func (o *watchOptionsParser) UnknownOptionDiagnostic() *diagnostics.Message {
 * 	return extraKeyDiagnostics("watchOptions")
 * }
 */
export declare function watchOptionsParser_UnknownOptionDiagnostic(receiver: GoPtr<watchOptionsParser>): GoPtr<Message>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::watchOptionsParser.UnknownDidYouMeanDiagnostic","kind":"method","status":"implemented","sigHash":"e3a95bc3f94b4b568bc7614455cbafed4cc687e33f80f2f764b558b872c6457d","bodyHash":"60d5c228919604de31526837270f0b06d50f362f5a23f462ca8182cc97acd5a3"}
 *
 * Go source:
 * func (o *watchOptionsParser) UnknownDidYouMeanDiagnostic() *diagnostics.Message {
 * 	return extraKeyDidYouMeanDiagnostics("watchOptions")
 * }
 */
export declare function watchOptionsParser_UnknownDidYouMeanDiagnostic(receiver: GoPtr<watchOptionsParser>): GoPtr<Message>;
export declare function watchOptionsParser_as_optionParser(receiver: GoPtr<watchOptionsParser>): optionParser;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::type::typeAcquisitionParser","kind":"type","status":"implemented","sigHash":"77946037483b27af0b0c4ae904e5adb40be26fb99de8e2e96d2044a0bade7d10","bodyHash":"ccff6fccd1a6cc3ab79c03ef8f9c5f1b60c22e80d6d668fdf2d0c2db3b83ebe5"}
 *
 * Go source:
 * typeAcquisitionParser struct {
 * 	*core.TypeAcquisition
 * }
 */
export interface typeAcquisitionParser {
    readonly __tsgoEmbedded0?: GoPtr<TypeAcquisition>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::typeAcquisitionParser.ParseOption","kind":"method","status":"implemented","sigHash":"a227058fff8d5a5170e89c446fec7c0a6d152866673c34452c60ae230209cf79","bodyHash":"4e82fdce2656b2f7f39e2fc554d7a91dfc2728268dfe880c49c208cf1e6b2fc1"}
 *
 * Go source:
 * func (o *typeAcquisitionParser) ParseOption(key string, value any) []*ast.Diagnostic {
 * 	return ParseTypeAcquisition(key, value, o.TypeAcquisition)
 * }
 */
export declare function typeAcquisitionParser_ParseOption(receiver: GoPtr<typeAcquisitionParser>, key: string, value: unknown): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::typeAcquisitionParser.UnknownOptionDiagnostic","kind":"method","status":"implemented","sigHash":"d1f09afba585d4f8a973dd10339e1d133f59e05125fa8848041a796db6038b5d","bodyHash":"fbab6de5544100175e60f90dc36cf5ebdfdcc66ccb5653b1a62d52e94a831e86"}
 *
 * Go source:
 * func (o *typeAcquisitionParser) UnknownOptionDiagnostic() *diagnostics.Message {
 * 	return extraKeyDiagnostics("typeAcquisition")
 * }
 */
export declare function typeAcquisitionParser_UnknownOptionDiagnostic(receiver: GoPtr<typeAcquisitionParser>): GoPtr<Message>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::typeAcquisitionParser.UnknownDidYouMeanDiagnostic","kind":"method","status":"implemented","sigHash":"f5d369b9e515a178f4c19ed221b47f064fd534f030cfd279ae81e0b64fa77856","bodyHash":"56eb4f434cd55edba887f5c78f17da84da8e39d48e69cd9beef0025d18f77e9a"}
 *
 * Go source:
 * func (o *typeAcquisitionParser) UnknownDidYouMeanDiagnostic() *diagnostics.Message {
 * 	return extraKeyDidYouMeanDiagnostics("typeAcquisition")
 * }
 */
export declare function typeAcquisitionParser_UnknownDidYouMeanDiagnostic(receiver: GoPtr<typeAcquisitionParser>): GoPtr<Message>;
export declare function typeAcquisitionParser_as_optionParser(receiver: GoPtr<typeAcquisitionParser>): optionParser;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::type::buildOptionsParser","kind":"type","status":"implemented","sigHash":"2d4b139a2ed61f670d76f2f1f88010d9e88ef2137637c36959d2b404301ea721","bodyHash":"175101c1fd9d6b92c236fa198b07dedeb319571032fee1e7a6362786f043c099"}
 *
 * Go source:
 * buildOptionsParser struct {
 * 	*core.BuildOptions
 * }
 */
export interface buildOptionsParser {
    readonly __tsgoEmbedded0?: GoPtr<BuildOptions>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::buildOptionsParser.ParseOption","kind":"method","status":"implemented","sigHash":"40f437214dbc7c3897c6a71142fcf2eb7a3811c20df1b3be0d75c73585fae2ad","bodyHash":"601ecea15399ca364a39cb21bdc1992ec88ed7d708b07b93804f5cd9679219f9"}
 *
 * Go source:
 * func (o *buildOptionsParser) ParseOption(key string, value any) []*ast.Diagnostic {
 * 	return ParseBuildOptions(key, value, o.BuildOptions)
 * }
 */
export declare function buildOptionsParser_ParseOption(receiver: GoPtr<buildOptionsParser>, key: string, value: unknown): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::buildOptionsParser.UnknownOptionDiagnostic","kind":"method","status":"implemented","sigHash":"127b39babd9dec69bc0bc017310e0790a343dd8c5ac7c097a1ae93edc6443d26","bodyHash":"466e7d71dd5b9e1784bc4e25fc977b3b766281cef656626fd728691eaea4b755"}
 *
 * Go source:
 * func (o *buildOptionsParser) UnknownOptionDiagnostic() *diagnostics.Message {
 * 	return extraKeyDiagnostics("buildOptions")
 * }
 */
export declare function buildOptionsParser_UnknownOptionDiagnostic(receiver: GoPtr<buildOptionsParser>): GoPtr<Message>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::method::buildOptionsParser.UnknownDidYouMeanDiagnostic","kind":"method","status":"implemented","sigHash":"cf3326644424e4708bff1d8fd98c0ae5aea7a4d933ef171f3313e9f9d32f1b08","bodyHash":"3930cd123ded1785611a3c0bdbbca2a9e758c0112d139a839db44dd235aa4a28"}
 *
 * Go source:
 * func (o *buildOptionsParser) UnknownDidYouMeanDiagnostic() *diagnostics.Message {
 * 	return extraKeyDidYouMeanDiagnostics("buildOptions")
 * }
 */
export declare function buildOptionsParser_UnknownDidYouMeanDiagnostic(receiver: GoPtr<buildOptionsParser>): GoPtr<Message>;
export declare function buildOptionsParser_as_optionParser(receiver: GoPtr<buildOptionsParser>): optionParser;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseCompilerOptions","kind":"func","status":"implemented","sigHash":"b68627376cdbbb84d8d916782adb8716c2b1da88ce4f01101eafc26ca2326d87","bodyHash":"8bea9a910d6b027ce1074dfc27dece31e284ab87e395875b051290d6d2c42f2b"}
 *
 * Go source:
 * func ParseCompilerOptions(key string, value any, allOptions *core.CompilerOptions) []*ast.Diagnostic {
 * 	if value == nil {
 * 		return nil
 * 	}
 * 	if allOptions == nil {
 * 		return nil
 * 	}
 * 	parseCompilerOptions(key, value, allOptions)
 * 	return nil
 * }
 */
export declare function ParseCompilerOptions(key: string, value: unknown, allOptions: GoPtr<CompilerOptions>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::parseCompilerOptions","kind":"func","status":"implemented","sigHash":"1232d65ea6f6391fbf016a09a53c9919379e0d6ad020090091e68ddc974f3db0","bodyHash":"9c68f9513226e2a697a9e81840cc3fac984713585a2905457a428372be77bf64"}
 *
 * Go source:
 * func parseCompilerOptions(key string, value any, allOptions *core.CompilerOptions) (foundKey bool) {
 * 	option := CommandLineCompilerOptionsMap.Get(key)
 * 	if option != nil {
 * 		key = option.Name
 * 	}
 * 	switch key {
 * 	case "allowJs":
 * 		allOptions.AllowJs = ParseTristate(value)
 * 	...
 * 	default:
 * 		// different than any key above
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function parseCompilerOptions(key: string, value: unknown, allOptions: GoPtr<CompilerOptions>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::floatOrInt32ToFlag","kind":"func","status":"implemented","sigHash":"20db0255f87e7140b6f355ea9e6fd6c8eb69783915b5e9cb30fc1e919c370e3a","bodyHash":"5e695971846c5a0862cf1487c978e12f30cb85e0aa3b7643e7aed0b0d4532921"}
 *
 * Go source:
 * func floatOrInt32ToFlag[T ~int32](value any) T {
 * 	if v, ok := value.(T); ok {
 * 		return v
 * 	}
 * 	return T(value.(float64))
 * }
 */
export declare function floatOrInt32ToFlag<T extends GoConstraint<"~int32"> & number>(value: unknown): T;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseWatchOptions","kind":"func","status":"implemented","sigHash":"60340ca18f07bdf66135cd8b155722772318c7e04120721cdec472682fefb06b","bodyHash":"ea033c13152dc9f4298e73ba4dca33d6a57f597e9a8cc831f8a27023cbdcbb85"}
 *
 * Go source:
 * func ParseWatchOptions(key string, value any, allOptions *core.WatchOptions) []*ast.Diagnostic {
 * 	if allOptions == nil {
 * 		return nil
 * 	}
 * 	switch key {
 * 	case "watchInterval":
 * 		allOptions.Interval = parseNumber(value)
 * 	case "watchFile":
 * 		if value != nil {
 * 			allOptions.FileKind = value.(core.WatchFileKind)
 * 		}
 * 	case "watchDirectory":
 * 		if value != nil {
 * 			allOptions.DirectoryKind = value.(core.WatchDirectoryKind)
 * 		}
 * 	case "fallbackPolling":
 * 		if value != nil {
 * 			allOptions.FallbackPolling = value.(core.PollingKind)
 * 		}
 * 	case "synchronousWatchDirectory":
 * 		allOptions.SyncWatchDir = ParseTristate(value)
 * 	case "excludeDirectories":
 * 		allOptions.ExcludeDir = ParseStringArray(value)
 * 	case "excludeFiles":
 * 		allOptions.ExcludeFiles = ParseStringArray(value)
 * 	}
 * 	return nil
 * }
 */
export declare function ParseWatchOptions(key: string, value: unknown, allOptions: GoPtr<WatchOptions>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseTypeAcquisition","kind":"func","status":"implemented","sigHash":"e32da4dde2bd378439ee1d87ad6d59f3538a725f0fe450eb0dd91da4eb688e39","bodyHash":"4f234c6cb37fb91a781df4c53cd5e416973a04957101e5ac3c23453eaee47151"}
 *
 * Go source:
 * func ParseTypeAcquisition(key string, value any, allOptions *core.TypeAcquisition) []*ast.Diagnostic {
 * 	if value == nil {
 * 		return nil
 * 	}
 * 	if allOptions == nil {
 * 		return nil
 * 	}
 * 	switch key {
 * 	case "enable":
 * 		allOptions.Enable = ParseTristate(value)
 * 	case "include":
 * 		allOptions.Include = ParseStringArray(value)
 * 	case "exclude":
 * 		allOptions.Exclude = ParseStringArray(value)
 * 	case "disableFilenameBasedTypeAcquisition":
 * 		allOptions.DisableFilenameBasedTypeAcquisition = ParseTristate(value)
 * 	}
 * 	return nil
 * }
 */
export declare function ParseTypeAcquisition(key: string, value: unknown, allOptions: GoPtr<TypeAcquisition>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ParseBuildOptions","kind":"func","status":"implemented","sigHash":"794ee8a4473683f18c2a63b0d15f6baee31adf3dcc2195537a945317ef701a03","bodyHash":"f94ee9fa4666f6bb75f7df2407e865b98657b01a415d63ba912e2a4f7e761555"}
 *
 * Go source:
 * func ParseBuildOptions(key string, value any, allOptions *core.BuildOptions) []*ast.Diagnostic {
 * 	if value == nil {
 * 		return nil
 * 	}
 * 	if allOptions == nil {
 * 		return nil
 * 	}
 * 	option := BuildNameMap.Get(key)
 * 	if option != nil {
 * 		key = option.Name
 * 	}
 * 	switch key {
 * 	case "clean":
 * 		allOptions.Clean = ParseTristate(value)
 * 	case "dry":
 * 		allOptions.Dry = ParseTristate(value)
 * 	case "force":
 * 		allOptions.Force = ParseTristate(value)
 * 	case "builders":
 * 		allOptions.Builders = parseNumber(value)
 * 	case "stopBuildOnErrors":
 * 		allOptions.StopBuildOnErrors = ParseTristate(value)
 * 	case "verbose":
 * 		allOptions.Verbose = ParseTristate(value)
 * 	}
 * 	return nil
 * }
 */
export declare function ParseBuildOptions(key: string, value: unknown, allOptions: GoPtr<BuildOptions>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::mergeCompilerOptions","kind":"func","status":"implemented","sigHash":"7c402d7880eb4e1a48806b603920f87a8449e640da732a4cec56b4a1d42dfb63","bodyHash":"8dd23a1ab9b5f12dd3d4fd9d4fa25e6dd7ef5c9086e369c0f8fdef9977cbf68e"}
 *
 * Go source:
 * func mergeCompilerOptions(targetOptions, sourceOptions *core.CompilerOptions, rawSource any) *core.CompilerOptions {
 * 	if sourceOptions == nil {
 * 		return targetOptions
 * 	}
 *
 * 	// Collect explicitly null field names from raw JSON
 * 	var explicitNullFields collections.Set[string]
 * 	if rawSource != nil {
 * 		if rawMap, ok := rawSource.(*collections.OrderedMap[string, any]); ok && rawMap != nil {
 * 			// Options are nested under "compilerOptions" in both tsconfig.json and wrapped command line options
 * 			if compilerOptionsRaw, exists := rawMap.Get("compilerOptions"); exists {
 * 				if compilerOptionsMap, ok := compilerOptionsRaw.(*collections.OrderedMap[string, any]); ok {
 * 					for key, value := range compilerOptionsMap.Entries() {
 * 						if value == nil {
 * 							explicitNullFields.Add(key)
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	// Do the merge, handling explicit nulls during the normal merge
 * 	targetValue := reflect.ValueOf(targetOptions).Elem()
 * 	sourceValue := reflect.ValueOf(sourceOptions).Elem()
 * 	targetType := targetValue.Type()
 *
 * 	for i := range targetValue.NumField() {
 * 		targetField := targetValue.Field(i)
 * 		sourceField := sourceValue.Field(i)
 *
 * 		// Get the JSON field name for this struct field and check if it's explicitly null
 * 		if jsonTag := targetType.Field(i).Tag.Get("json"); jsonTag != "" {
 * 			if jsonFieldName, _, _ := strings.Cut(jsonTag, ","); jsonFieldName != "" && explicitNullFields.Has(jsonFieldName) {
 * 				targetField.SetZero()
 * 				continue
 * 			}
 * 		}
 *
 * 		// Normal merge behavior: copy non-zero fields
 * 		if !sourceField.IsZero() {
 * 			targetField.Set(sourceField)
 * 		}
 * 	}
 *
 * 	return targetOptions
 * }
 */
export declare function mergeCompilerOptions(targetOptions: GoPtr<CompilerOptions>, sourceOptions: GoPtr<CompilerOptions>, rawSource: unknown): GoPtr<CompilerOptions>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::convertToOptionsWithAbsolutePaths","kind":"func","status":"implemented","sigHash":"01cfcc21dba9256e325c87a22ff7f4d7a177fbddff66a9de40f8e203feb7008e","bodyHash":"894635eebc14ab2dbef1b5c3cd16bbf3a14ce07e92be652ef89cb7918723c5ab"}
 *
 * Go source:
 * func convertToOptionsWithAbsolutePaths(optionsBase *collections.OrderedMap[string, any], optionMap CommandLineOptionNameMap, cwd string) *collections.OrderedMap[string, any] {
 * 	// !!! convert to options with absolute paths was previously done with `CompilerOptions` object, but for ease of implementation, we do it pre-conversion.
 * 	// !!! Revisit this choice if/when refactoring when conversion is done in tsconfig parsing
 * 	if optionsBase == nil {
 * 		return nil
 * 	}
 * 	for o, v := range optionsBase.Entries() {
 * 		result, ok := ConvertOptionToAbsolutePath(o, v, optionMap, cwd)
 * 		if ok {
 * 			optionsBase.Set(o, result)
 * 		}
 * 	}
 * 	return optionsBase
 * }
 */
export declare function convertToOptionsWithAbsolutePaths(optionsBase: GoPtr<OrderedMap<string, unknown>>, optionMap: CommandLineOptionNameMap, cwd: string): GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsinghelpers.go::func::ConvertOptionToAbsolutePath","kind":"func","status":"implemented","sigHash":"a296fdd3a0da9cd23b4001dcceeb1fcb500c53d239df1bb01761c7a0c3d75ad6","bodyHash":"71ddad65eed23c562994b4c8d364a6e30ab3780024c2d7c7a486744d3a5247c8"}
 *
 * Go source:
 * func ConvertOptionToAbsolutePath(o string, v any, optionMap CommandLineOptionNameMap, cwd string) (any, bool) {
 * 	option := optionMap.Get(o)
 * 	if option == nil {
 * 		return nil, false
 * 	}
 * 	if option.Kind == "list" {
 * 		if option.Elements().IsFilePath {
 * 			if arr, ok := v.([]string); ok {
 * 				return core.Map(arr, func(item string) string {
 * 					return tspath.GetNormalizedAbsolutePath(item, cwd)
 * 				}), true
 * 			}
 * 			if arr, ok := v.([]any); ok {
 * 				return core.Map(arr, func(item any) any {
 * 					if s, isStr := item.(string); isStr {
 * 						return tspath.GetNormalizedAbsolutePath(s, cwd)
 * 					}
 * 					return item
 * 				}), true
 * 			}
 * 		}
 * 	} else if option.IsFilePath {
 * 		if value, ok := v.(string); ok {
 * 			return tspath.GetNormalizedAbsolutePath(value, cwd), true
 * 		}
 * 	}
 * 	return nil, false
 * }
 */
export declare function ConvertOptionToAbsolutePath(o: string, v: unknown, optionMap: CommandLineOptionNameMap, cwd: string): [unknown, bool];
//# sourceMappingURL=parsinghelpers.d.ts.map
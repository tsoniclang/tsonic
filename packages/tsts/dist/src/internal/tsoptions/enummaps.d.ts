import type { bool } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { Set } from "../collections/set.js";
import type { CompilerOptions, ScriptTarget } from "../core/compileroptions.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::LibMap","kind":"varGroup","status":"implemented","sigHash":"21c746f7178dcd816b138a028a3217efb05851c01982ee0831e9921f9726c6a7","bodyHash":"0281703e5d785deec5f191c0ec08e9acb5939bf6600934d49386ff05e4fa74de"}
 *
 * Go source:
 * var LibMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	// JavaScript only
 * 	{Key: "es5", Value: "lib.es5.d.ts"},
 * 	{Key: "es6", Value: "lib.es2015.d.ts"},
 * 	{Key: "es2015", Value: "lib.es2015.d.ts"},
 * 	{Key: "es7", Value: "lib.es2016.d.ts"},
 * 	{Key: "es2016", Value: "lib.es2016.d.ts"},
 * 	{Key: "es2017", Value: "lib.es2017.d.ts"},
 * 	{Key: "es2018", Value: "lib.es2018.d.ts"},
 * 	{Key: "es2019", Value: "lib.es2019.d.ts"},
 * 	{Key: "es2020", Value: "lib.es2020.d.ts"},
 * 	{Key: "es2021", Value: "lib.es2021.d.ts"},
 * 	{Key: "es2022", Value: "lib.es2022.d.ts"},
 * 	{Key: "es2023", Value: "lib.es2023.d.ts"},
 * 	{Key: "es2024", Value: "lib.es2024.d.ts"},
 * 	{Key: "es2025", Value: "lib.es2025.d.ts"},
 * 	{Key: "esnext", Value: "lib.esnext.d.ts"},
 * 	// Host only
 * 	{Key: "dom", Value: "lib.dom.d.ts"},
 * 	{Key: "dom.iterable", Value: "lib.dom.iterable.d.ts"},
 * 	{Key: "dom.asynciterable", Value: "lib.dom.asynciterable.d.ts"},
 * 	{Key: "webworker", Value: "lib.webworker.d.ts"},
 * 	{Key: "webworker.importscripts", Value: "lib.webworker.importscripts.d.ts"},
 * 	{Key: "webworker.iterable", Value: "lib.webworker.iterable.d.ts"},
 * 	{Key: "webworker.asynciterable", Value: "lib.webworker.asynciterable.d.ts"},
 * 	{Key: "scripthost", Value: "lib.scripthost.d.ts"},
 * 	// ES2015 and later By-feature options
 * 	{Key: "es2015.core", Value: "lib.es2015.core.d.ts"},
 * 	{Key: "es2015.collection", Value: "lib.es2015.collection.d.ts"},
 * 	{Key: "es2015.generator", Value: "lib.es2015.generator.d.ts"},
 * 	{Key: "es2015.iterable", Value: "lib.es2015.iterable.d.ts"},
 * 	{Key: "es2015.promise", Value: "lib.es2015.promise.d.ts"},
 * 	{Key: "es2015.proxy", Value: "lib.es2015.proxy.d.ts"},
 * 	{Key: "es2015.reflect", Value: "lib.es2015.reflect.d.ts"},
 * 	{Key: "es2015.symbol", Value: "lib.es2015.symbol.d.ts"},
 * 	{Key: "es2015.symbol.wellknown", Value: "lib.es2015.symbol.wellknown.d.ts"},
 * 	{Key: "es2016.array.include", Value: "lib.es2016.array.include.d.ts"},
 * 	{Key: "es2016.intl", Value: "lib.es2016.intl.d.ts"},
 * 	{Key: "es2017.arraybuffer", Value: "lib.es2017.arraybuffer.d.ts"},
 * 	{Key: "es2017.date", Value: "lib.es2017.date.d.ts"},
 * 	{Key: "es2017.object", Value: "lib.es2017.object.d.ts"},
 * 	{Key: "es2017.sharedmemory", Value: "lib.es2017.sharedmemory.d.ts"},
 * 	{Key: "es2017.string", Value: "lib.es2017.string.d.ts"},
 * 	{Key: "es2017.intl", Value: "lib.es2017.intl.d.ts"},
 * 	{Key: "es2017.typedarrays", Value: "lib.es2017.typedarrays.d.ts"},
 * 	{Key: "es2018.asyncgenerator", Value: "lib.es2018.asyncgenerator.d.ts"},
 * 	{Key: "es2018.asynciterable", Value: "lib.es2018.asynciterable.d.ts"},
 * 	{Key: "es2018.intl", Value: "lib.es2018.intl.d.ts"},
 * 	{Key: "es2018.promise", Value: "lib.es2018.promise.d.ts"},
 * 	{Key: "es2018.regexp", Value: "lib.es2018.regexp.d.ts"},
 * 	{Key: "es2019.array", Value: "lib.es2019.array.d.ts"},
 * 	{Key: "es2019.object", Value: "lib.es2019.object.d.ts"},
 * 	{Key: "es2019.string", Value: "lib.es2019.string.d.ts"},
 * 	{Key: "es2019.symbol", Value: "lib.es2019.symbol.d.ts"},
 * 	{Key: "es2019.intl", Value: "lib.es2019.intl.d.ts"},
 * 	{Key: "es2020.bigint", Value: "lib.es2020.bigint.d.ts"},
 * 	{Key: "es2020.date", Value: "lib.es2020.date.d.ts"},
 * 	{Key: "es2020.promise", Value: "lib.es2020.promise.d.ts"},
 * 	{Key: "es2020.sharedmemory", Value: "lib.es2020.sharedmemory.d.ts"},
 * 	{Key: "es2020.string", Value: "lib.es2020.string.d.ts"},
 * 	{Key: "es2020.symbol.wellknown", Value: "lib.es2020.symbol.wellknown.d.ts"},
 * 	{Key: "es2020.intl", Value: "lib.es2020.intl.d.ts"},
 * 	{Key: "es2020.number", Value: "lib.es2020.number.d.ts"},
 * 	{Key: "es2021.promise", Value: "lib.es2021.promise.d.ts"},
 * 	{Key: "es2021.string", Value: "lib.es2021.string.d.ts"},
 * 	{Key: "es2021.weakref", Value: "lib.es2021.weakref.d.ts"},
 * 	{Key: "es2021.intl", Value: "lib.es2021.intl.d.ts"},
 * 	{Key: "es2022.array", Value: "lib.es2022.array.d.ts"},
 * 	{Key: "es2022.error", Value: "lib.es2022.error.d.ts"},
 * 	{Key: "es2022.intl", Value: "lib.es2022.intl.d.ts"},
 * 	{Key: "es2022.object", Value: "lib.es2022.object.d.ts"},
 * 	{Key: "es2022.string", Value: "lib.es2022.string.d.ts"},
 * 	{Key: "es2022.regexp", Value: "lib.es2022.regexp.d.ts"},
 * 	{Key: "es2023.array", Value: "lib.es2023.array.d.ts"},
 * 	{Key: "es2023.collection", Value: "lib.es2023.collection.d.ts"},
 * 	{Key: "es2023.intl", Value: "lib.es2023.intl.d.ts"},
 * 	{Key: "es2024.arraybuffer", Value: "lib.es2024.arraybuffer.d.ts"},
 * 	{Key: "es2024.collection", Value: "lib.es2024.collection.d.ts"},
 * 	{Key: "es2024.object", Value: "lib.es2024.object.d.ts"},
 * 	{Key: "es2024.promise", Value: "lib.es2024.promise.d.ts"},
 * 	{Key: "es2024.regexp", Value: "lib.es2024.regexp.d.ts"},
 * 	{Key: "es2024.sharedmemory", Value: "lib.es2024.sharedmemory.d.ts"},
 * 	{Key: "es2024.string", Value: "lib.es2024.string.d.ts"},
 * 	{Key: "es2025.collection", Value: "lib.es2025.collection.d.ts"},
 * 	{Key: "es2025.float16", Value: "lib.es2025.float16.d.ts"},
 * 	{Key: "es2025.intl", Value: "lib.es2025.intl.d.ts"},
 * 	{Key: "es2025.iterator", Value: "lib.es2025.iterator.d.ts"},
 * 	{Key: "es2025.promise", Value: "lib.es2025.promise.d.ts"},
 * 	{Key: "es2025.regexp", Value: "lib.es2025.regexp.d.ts"},
 * 	// Fallback for backward compatibility
 * 	{Key: "esnext.asynciterable", Value: "lib.es2018.asynciterable.d.ts"},
 * 	{Key: "esnext.symbol", Value: "lib.es2019.symbol.d.ts"},
 * 	{Key: "esnext.bigint", Value: "lib.es2020.bigint.d.ts"},
 * 	{Key: "esnext.weakref", Value: "lib.es2021.weakref.d.ts"},
 * 	{Key: "esnext.object", Value: "lib.es2024.object.d.ts"},
 * 	{Key: "esnext.regexp", Value: "lib.es2024.regexp.d.ts"},
 * 	{Key: "esnext.string", Value: "lib.es2024.string.d.ts"},
 * 	{Key: "esnext.float16", Value: "lib.es2025.float16.d.ts"},
 * 	{Key: "esnext.iterator", Value: "lib.es2025.iterator.d.ts"},
 * 	{Key: "esnext.promise", Value: "lib.es2025.promise.d.ts"},
 * 	// ESNext By-feature options
 * 	{Key: "esnext.array", Value: "lib.esnext.array.d.ts"},
 * 	{Key: "esnext.collection", Value: "lib.esnext.collection.d.ts"},
 * 	{Key: "esnext.date", Value: "lib.esnext.date.d.ts"},
 * 	{Key: "esnext.decorators", Value: "lib.esnext.decorators.d.ts"},
 * 	{Key: "esnext.disposable", Value: "lib.esnext.disposable.d.ts"},
 * 	{Key: "esnext.error", Value: "lib.esnext.error.d.ts"},
 * 	{Key: "esnext.intl", Value: "lib.esnext.intl.d.ts"},
 * 	{Key: "esnext.sharedmemory", Value: "lib.esnext.sharedmemory.d.ts"},
 * 	{Key: "esnext.temporal", Value: "lib.esnext.temporal.d.ts"},
 * 	{Key: "esnext.typedarrays", Value: "lib.esnext.typedarrays.d.ts"},
 * 	// Decorators
 * 	{Key: "decorators", Value: "lib.decorators.d.ts"},
 * 	{Key: "decorators.legacy", Value: "lib.decorators.legacy.d.ts"},
 * })
 */
export declare const LibMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::Libs+LibFilesSet","kind":"varGroup","status":"implemented","sigHash":"7f1bb88b496484fefb9642125ab0f5889147d8de34f5b852bfca1c516b32dc76","bodyHash":"852d3b7073c1d5f5e0baa37c70692af848ce88cbc93aadb342ab3e45eebeb1a7"}
 *
 * Go source:
 * var (
 * 	Libs        = slices.Collect(LibMap.Keys())
 * 	LibFilesSet = collections.NewSetFromItems(core.Map(slices.Collect(LibMap.Values()), func(s any) string { return s.(string) })...)
 * )
 */
export declare const Libs: GoSlice<string>;
export declare const LibFilesSet: GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::func::GetLibFileName","kind":"func","status":"implemented","sigHash":"9e5dd2f3a4780c8c093e5d46faa048ec147d29c4fabc8aa7b5527e09359fcf07","bodyHash":"e1a24c08309af0e582e9a0f91b909e787a087c9a989b1157a67319a2160c6a6c"}
 *
 * Go source:
 * func GetLibFileName(libName string) (string, bool) {
 * 	// checks if the libName is a valid lib name or file name and converts the lib name to the filename if needed
 * 	libName = tspath.ToFileNameLowerCase(libName)
 * 	if LibFilesSet.Has(libName) {
 * 		return libName, true
 * 	}
 * 	lib, ok := LibMap.Get(libName)
 * 	if !ok {
 * 		return "", false
 * 	}
 * 	return lib.(string), true
 * }
 */
export declare function GetLibFileName(libName: string): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::moduleResolutionOptionMap","kind":"varGroup","status":"implemented","sigHash":"7893ed5cd93b19ebe6a5247fbb041439b6d7b0509cb26604a398a6ac4850f21b","bodyHash":"3f47cef0cf1986c6f8734ca70a4b801bae004acdfe81eed4aeed61d40f8cbcaa"}
 *
 * Go source:
 * var moduleResolutionOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "node16", Value: core.ModuleResolutionKindNode16},
 * 	{Key: "nodenext", Value: core.ModuleResolutionKindNodeNext},
 * 	{Key: "bundler", Value: core.ModuleResolutionKindBundler},
 * 	{Key: "classic", Value: core.ModuleResolutionKindClassic},
 * 	{Key: "node", Value: core.ModuleResolutionKindNode10},
 * 	{Key: "node10", Value: core.ModuleResolutionKindNode10},
 * })
 */
export declare const moduleResolutionOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::targetOptionMap","kind":"varGroup","status":"implemented","sigHash":"92a48d3d94cc5a2f462dbcfec9ae6f229dff387c261b19be382e4884767f8961","bodyHash":"da642b11da442ccbdb8664f0dc1a3ecc3f694ab52020f7974274b59ac63e3971"}
 *
 * Go source:
 * var targetOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "es5", Value: core.ScriptTargetES5},
 * 	{Key: "es6", Value: core.ScriptTargetES2015},
 * 	{Key: "es2015", Value: core.ScriptTargetES2015},
 * 	{Key: "es2016", Value: core.ScriptTargetES2016},
 * 	{Key: "es2017", Value: core.ScriptTargetES2017},
 * 	{Key: "es2018", Value: core.ScriptTargetES2018},
 * 	{Key: "es2019", Value: core.ScriptTargetES2019},
 * 	{Key: "es2020", Value: core.ScriptTargetES2020},
 * 	{Key: "es2021", Value: core.ScriptTargetES2021},
 * 	{Key: "es2022", Value: core.ScriptTargetES2022},
 * 	{Key: "es2023", Value: core.ScriptTargetES2023},
 * 	{Key: "es2024", Value: core.ScriptTargetES2024},
 * 	{Key: "es2025", Value: core.ScriptTargetES2025},
 * 	{Key: "esnext", Value: core.ScriptTargetESNext},
 * })
 */
export declare const targetOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::moduleOptionMap","kind":"varGroup","status":"implemented","sigHash":"d0dd550632fe1a8a4dcaae49672b36df2c1ea14aca7968e260f162565c008c60","bodyHash":"e758e48cf1a10e0dedb7ce931e458f95097527cccdf595a9ae7216102b6bf09c"}
 *
 * Go source:
 * var moduleOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "commonjs", Value: core.ModuleKindCommonJS},
 * 	{Key: "amd", Value: core.ModuleKindAMD},
 * 	{Key: "system", Value: core.ModuleKindSystem},
 * 	{Key: "umd", Value: core.ModuleKindUMD},
 * 	{Key: "es6", Value: core.ModuleKindES2015},
 * 	{Key: "es2015", Value: core.ModuleKindES2015},
 * 	{Key: "es2020", Value: core.ModuleKindES2020},
 * 	{Key: "es2022", Value: core.ModuleKindES2022},
 * 	{Key: "esnext", Value: core.ModuleKindESNext},
 * 	{Key: "node16", Value: core.ModuleKindNode16},
 * 	{Key: "node18", Value: core.ModuleKindNode18},
 * 	{Key: "node20", Value: core.ModuleKindNode20},
 * 	{Key: "nodenext", Value: core.ModuleKindNodeNext},
 * 	{Key: "preserve", Value: core.ModuleKindPreserve},
 * })
 */
export declare const moduleOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::moduleDetectionOptionMap","kind":"varGroup","status":"implemented","sigHash":"b1d7ff4c506a30641873666d457d5cfe8de0f7b3c284efc32134614edd7401f4","bodyHash":"d6e15a797fd04675563b8ddf43c5bde403c7da56b5318c18294e7dcb184584c2"}
 *
 * Go source:
 * var moduleDetectionOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "auto", Value: core.ModuleDetectionKindAuto},
 * 	{Key: "legacy", Value: core.ModuleDetectionKindLegacy},
 * 	{Key: "force", Value: core.ModuleDetectionKindForce},
 * })
 */
export declare const moduleDetectionOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::jsxOptionMap","kind":"varGroup","status":"implemented","sigHash":"67a1927d0067927b27a294e7887e3c4828ccb4d7155d1a2c1abbab40e69b6532","bodyHash":"844e1bb3730840f7d32e0613e3afda90fe36d175d2433d429b4c0f6ca0d7f886"}
 *
 * Go source:
 * var jsxOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "preserve", Value: core.JsxEmitPreserve},
 * 	{Key: "react-native", Value: core.JsxEmitReactNative},
 * 	{Key: "react-jsx", Value: core.JsxEmitReactJSX},
 * 	{Key: "react-jsxdev", Value: core.JsxEmitReactJSXDev},
 * 	{Key: "react", Value: core.JsxEmitReact},
 * })
 */
export declare const jsxOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::newLineOptionMap","kind":"varGroup","status":"implemented","sigHash":"1bee69fa1348308e4a98214939c9257767dbb4ac18f27e9953c12fa9b0e3cefd","bodyHash":"a014e6de98c6fdf3266e5aa1987ca797bd9bb5ab28a2252139fbd28ac27590f5"}
 *
 * Go source:
 * var newLineOptionMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "crlf", Value: core.NewLineKindCRLF},
 * 	{Key: "lf", Value: core.NewLineKindLF},
 * })
 */
export declare const newLineOptionMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::targetToLibMap","kind":"varGroup","status":"implemented","sigHash":"1ff6ecd54d75b300816a428a8de0ff6e050ae9d83afbf5df21cdb43fe2991df4","bodyHash":"ceeadc7c0f438435bce0a418e39e1c453d38203ce6627a550d0bb290f42a14f2"}
 *
 * Go source:
 * var targetToLibMap = map[core.ScriptTarget]string{
 * 	core.ScriptTargetESNext: "lib.esnext.full.d.ts",
 * 	core.ScriptTargetES2025: "lib.es2025.full.d.ts",
 * 	core.ScriptTargetES2024: "lib.es2024.full.d.ts",
 * 	core.ScriptTargetES2023: "lib.es2023.full.d.ts",
 * 	core.ScriptTargetES2022: "lib.es2022.full.d.ts",
 * 	core.ScriptTargetES2021: "lib.es2021.full.d.ts",
 * 	core.ScriptTargetES2020: "lib.es2020.full.d.ts",
 * 	core.ScriptTargetES2019: "lib.es2019.full.d.ts",
 * 	core.ScriptTargetES2018: "lib.es2018.full.d.ts",
 * 	core.ScriptTargetES2017: "lib.es2017.full.d.ts",
 * 	core.ScriptTargetES2016: "lib.es2016.full.d.ts",
 * 	core.ScriptTargetES2015: "lib.es6.d.ts", // We don't use lib.es2015.full.d.ts due to breaking change.
 * }
 */
export declare const targetToLibMap: GoMap<ScriptTarget, string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::func::TargetToLibMap","kind":"func","status":"implemented","sigHash":"f9aa6cb95af5e38191479291c367660bf1ff1b7ffe99110fbf8e472e7df01361","bodyHash":"8b0f95281352571392a8d3c9eb0bf3b780ae96b6c621bb64af1f336d1177966a"}
 *
 * Go source:
 * func TargetToLibMap() map[core.ScriptTarget]string {
 * 	return targetToLibMap
 * }
 */
export declare function TargetToLibMap(): GoMap<ScriptTarget, string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::func::GetDefaultLibFileName","kind":"func","status":"implemented","sigHash":"7dad0ba4561e46dc473b018638fed966c97c5418cc88d2002f0687e1183619bf","bodyHash":"675e083b2e768f3c19601888bdee141d92444574c13caf86d4b1d338df163192"}
 *
 * Go source:
 * func GetDefaultLibFileName(options *core.CompilerOptions) string {
 * 	name, ok := targetToLibMap[options.GetEmitScriptTarget()]
 * 	if !ok {
 * 		return "lib.d.ts"
 * 	}
 * 	return name
 * }
 */
export declare function GetDefaultLibFileName(options: GoPtr<CompilerOptions>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::watchFileEnumMap","kind":"varGroup","status":"implemented","sigHash":"36a7b5f54a4afeb3e3e60dcdf77c6653ee1cb85a71327edacc0604c1776ce996","bodyHash":"9b3a8c055d35352ca5dfd61fd17ac8a6bf48ac1f5ec647c19f10bfafb337caa3"}
 *
 * Go source:
 * var watchFileEnumMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "fixedpollinginterval", Value: core.WatchFileKindFixedPollingInterval},
 * 	{Key: "prioritypollinginterval", Value: core.WatchFileKindPriorityPollingInterval},
 * 	{Key: "dynamicprioritypolling", Value: core.WatchFileKindDynamicPriorityPolling},
 * 	{Key: "fixedchunksizepolling", Value: core.WatchFileKindFixedChunkSizePolling},
 * 	{Key: "usefsevents", Value: core.WatchFileKindUseFsEvents},
 * 	{Key: "usefseventsonparentdirectory", Value: core.WatchFileKindUseFsEventsOnParentDirectory},
 * })
 */
export declare const watchFileEnumMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::watchDirectoryEnumMap","kind":"varGroup","status":"implemented","sigHash":"40f83ac41ebf2272716ba8266adcb474c4fdbdd6f8518dace47766b504baef72","bodyHash":"3e99e549018945ec02e548fb8d0c4202517eee11fd8b3475c2948d51497a33dd"}
 *
 * Go source:
 * var watchDirectoryEnumMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "usefsevents", Value: core.WatchDirectoryKindUseFsEvents},
 * 	{Key: "fixedpollinginterval", Value: core.WatchDirectoryKindFixedPollingInterval},
 * 	{Key: "dynamicprioritypolling", Value: core.WatchDirectoryKindDynamicPriorityPolling},
 * 	{Key: "fixedchunksizepolling", Value: core.WatchDirectoryKindFixedChunkSizePolling},
 * })
 */
export declare const watchDirectoryEnumMap: GoPtr<OrderedMap<string, unknown>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/enummaps.go::varGroup::fallbackEnumMap","kind":"varGroup","status":"implemented","sigHash":"c031524664983e24b8bfc74381b1a808b5f6710b4dc6512b27e6bf3964cfa201","bodyHash":"551c3e61c2c5723775d966d3edf7bc420a90b7bc555c46470d5bec5c7b80214c"}
 *
 * Go source:
 * var fallbackEnumMap = collections.NewOrderedMapFromList([]collections.MapEntry[string, any]{
 * 	{Key: "fixedinterval", Value: core.PollingKindFixedInterval},
 * 	{Key: "priorityinterval", Value: core.PollingKindPriorityInterval},
 * 	{Key: "dynamicpriority", Value: core.PollingKindDynamicPriority},
 * 	{Key: "fixedchunksize", Value: core.PollingKindFixedChunkSize},
 * })
 */
export declare const fallbackEnumMap: GoPtr<OrderedMap<string, unknown>>;
//# sourceMappingURL=enummaps.d.ts.map
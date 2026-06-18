/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::ResultKindNone+ResultKindNodeModules+ResultKindPaths+ResultKindRedirect+ResultKindRelative+ResultKindAmbient","kind":"constGroup","status":"implemented","sigHash":"c6a0ef9c3669f1b23224039ce4ce7a7a00d3778fbbc97c0f2659d8bb15029aad","bodyHash":"5c07365792e5c442abcc7c9f4d34b54ec9c18032473603c7bc19a9f9bc26c516"}
 *
 * Go source:
 * const (
 * 	ResultKindNone ResultKind = iota
 * 	ResultKindNodeModules
 * 	ResultKindPaths
 * 	ResultKindRedirect
 * 	ResultKindRelative
 * 	ResultKindAmbient
 * )
 */
export const ResultKindNone = 0;
export const ResultKindNodeModules = 1;
export const ResultKindPaths = 2;
export const ResultKindRedirect = 3;
export const ResultKindRelative = 4;
export const ResultKindAmbient = 5;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::ImportModuleSpecifierPreferenceNone+ImportModuleSpecifierPreferenceShortest+ImportModuleSpecifierPreferenceProjectRelative+ImportModuleSpecifierPreferenceRelative+ImportModuleSpecifierPreferenceNonRelative","kind":"constGroup","status":"implemented","sigHash":"f3476272c68f4df9e63be3e8fcc202567a309efdde8b77f25fbb165105ea895c","bodyHash":"eddb677cd9e93a1662506292721e4277df48fa6d6161d0bd271983858ae06f5e"}
 *
 * Go source:
 * const (
 * 	ImportModuleSpecifierPreferenceNone            ImportModuleSpecifierPreference = "" // !!!
 * 	ImportModuleSpecifierPreferenceShortest        ImportModuleSpecifierPreference = "shortest"
 * 	ImportModuleSpecifierPreferenceProjectRelative ImportModuleSpecifierPreference = "project-relative"
 * 	ImportModuleSpecifierPreferenceRelative        ImportModuleSpecifierPreference = "relative"
 * 	ImportModuleSpecifierPreferenceNonRelative     ImportModuleSpecifierPreference = "non-relative"
 * )
 */
export const ImportModuleSpecifierPreferenceNone = "";
export const ImportModuleSpecifierPreferenceShortest = "shortest";
export const ImportModuleSpecifierPreferenceProjectRelative = "project-relative";
export const ImportModuleSpecifierPreferenceRelative = "relative";
export const ImportModuleSpecifierPreferenceNonRelative = "non-relative";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::ImportModuleSpecifierEndingPreferenceNone+ImportModuleSpecifierEndingPreferenceAuto+ImportModuleSpecifierEndingPreferenceMinimal+ImportModuleSpecifierEndingPreferenceIndex+ImportModuleSpecifierEndingPreferenceJs","kind":"constGroup","status":"implemented","sigHash":"7e4744fd28a5524490e31630b74cefeef5776ac4ef0fcdcc4a158c80752b3b1f","bodyHash":"f63079e1dcea117ca0db12085561bb09ea3de3a225a919b2d63021e59e9577c4"}
 *
 * Go source:
 * const (
 * 	ImportModuleSpecifierEndingPreferenceNone    ImportModuleSpecifierEndingPreference = "" // !!!
 * 	ImportModuleSpecifierEndingPreferenceAuto    ImportModuleSpecifierEndingPreference = "auto"
 * 	ImportModuleSpecifierEndingPreferenceMinimal ImportModuleSpecifierEndingPreference = "minimal"
 * 	ImportModuleSpecifierEndingPreferenceIndex   ImportModuleSpecifierEndingPreference = "index"
 * 	ImportModuleSpecifierEndingPreferenceJs      ImportModuleSpecifierEndingPreference = "js"
 * )
 */
export const ImportModuleSpecifierEndingPreferenceNone = "";
export const ImportModuleSpecifierEndingPreferenceAuto = "auto";
export const ImportModuleSpecifierEndingPreferenceMinimal = "minimal";
export const ImportModuleSpecifierEndingPreferenceIndex = "index";
export const ImportModuleSpecifierEndingPreferenceJs = "js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::RelativePreferenceRelative+RelativePreferenceNonRelative+RelativePreferenceShortest+RelativePreferenceExternalNonRelative","kind":"constGroup","status":"implemented","sigHash":"b9e655ccf21382b52721b409695c99000abf15f39938f866aa0e796b824ff024","bodyHash":"d2168daafbcdceb7b07a56ec8f1f61011c8abbd224b7ab490fd91de28e7491e6"}
 *
 * Go source:
 * const (
 * 	RelativePreferenceRelative RelativePreferenceKind = iota
 * 	RelativePreferenceNonRelative
 * 	RelativePreferenceShortest
 * 	RelativePreferenceExternalNonRelative
 * )
 */
export const RelativePreferenceRelative = 0;
export const RelativePreferenceNonRelative = 1;
export const RelativePreferenceShortest = 2;
export const RelativePreferenceExternalNonRelative = 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::ModuleSpecifierEndingMinimal+ModuleSpecifierEndingIndex+ModuleSpecifierEndingJsExtension+ModuleSpecifierEndingTsExtension","kind":"constGroup","status":"implemented","sigHash":"caa71c9344c149dfd20bab01c9eb96978f52ce7c25d0214e986157c3b6714585","bodyHash":"bb23c033be68275f3c90feb0e41589df487fa1bd2ac31aa33387c916bcae1a1b"}
 *
 * Go source:
 * const (
 * 	ModuleSpecifierEndingMinimal ModuleSpecifierEnding = iota
 * 	ModuleSpecifierEndingIndex
 * 	ModuleSpecifierEndingJsExtension
 * 	ModuleSpecifierEndingTsExtension
 * )
 */
export const ModuleSpecifierEndingMinimal = 0;
export const ModuleSpecifierEndingIndex = 1;
export const ModuleSpecifierEndingJsExtension = 2;
export const ModuleSpecifierEndingTsExtension = 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/types.go::constGroup::MatchingModeExact+MatchingModeDirectory+MatchingModePattern","kind":"constGroup","status":"implemented","sigHash":"aeff72ccc58fe336b2db3630d8e70793d5a33b14c34f38c1736d4f3f39deff6f","bodyHash":"b74e00967b09aa4d175cdd2b9d8a2d423ee5dbc7be2543629c2c5f11dcc4f4f0"}
 *
 * Go source:
 * const (
 * 	MatchingModeExact MatchingMode = iota
 * 	MatchingModeDirectory
 * 	MatchingModePattern
 * )
 */
export const MatchingModeExact = 0;
export const MatchingModeDirectory = 1;
export const MatchingModePattern = 2;
//# sourceMappingURL=types.js.map
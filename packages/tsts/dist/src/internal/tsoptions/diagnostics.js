import { Once } from "../../go/sync.js";
import { BuildNameMap, CompilerNameMap } from "./namemap.js";
import { Build_option_0_requires_a_value_of_type_1, Compiler_option_0_expects_an_argument, Compiler_option_0_may_not_be_used_with_build, Compiler_option_0_may_only_be_used_with_build, Unknown_build_option_0, Unknown_build_option_0_Did_you_mean_1, Unknown_compiler_option_0, Unknown_compiler_option_0_Did_you_mean_1, Unknown_watch_option_0, Unknown_watch_option_0_Did_you_mean_1, Watch_option_0_requires_a_value_of_type_1, } from "../diagnostics/generated/messages.js";
import { BuildOpts } from "./declsbuild.js";
import { OptionsDeclarations } from "./declscompiler.js";
import { OptionsForWatch } from "./declswatch.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/diagnostics.go::varGroup::CompilerOptionsDidYouMeanDiagnostics","kind":"varGroup","status":"implemented","sigHash":"dcdfbf2c1ba0f27124c2d2c9715154c65a51e3d370cd82460a8be1d633b9d777","bodyHash":"74e39f58c6ea5e920af730dedbf319dac03f55cecb38937cc92ca1ff8738978b"}
 *
 * Go source:
 * var CompilerOptionsDidYouMeanDiagnostics = getParseCommandLineWorkerDiagnostics(OptionsDeclarations)
 */
// Go initializes package-level vars by dependency order; assigned after
// OptionsDeclarations is initialized in declscompiler.ts.
export let CompilerOptionsDidYouMeanDiagnostics = undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/diagnostics.go::func::getParseCommandLineWorkerDiagnostics","kind":"func","status":"implemented","sigHash":"5e6ee1a7dbb0b0305303b2ca7598920e4df8215ea06c1b71675ce63417f4e960","bodyHash":"0c9c8651121ba0fec17135a2647d52459090124161cd391e3493c108bdada6c4"}
 *
 * Go source:
 * func getParseCommandLineWorkerDiagnostics(decls []*CommandLineOption) *ParseCommandLineWorkerDiagnostics {
 * 	// this will only return the correct diagnostics for `compiler` mode, and is factored into a function for testing reasons.
 * 	return &ParseCommandLineWorkerDiagnostics{
 * 		didYouMean: DidYouMeanOptionsDiagnostics{
 * 			alternateMode: &AlternateModeDiagnostics{
 * 				diagnostic:     diagnostics.Compiler_option_0_may_only_be_used_with_build,
 * 				optionsNameMap: BuildNameMap,
 * 			},
 * 			OptionDeclarations:          decls,
 * 			UnknownOptionDiagnostic:     diagnostics.Unknown_compiler_option_0,
 * 			UnknownDidYouMeanDiagnostic: diagnostics.Unknown_compiler_option_0_Did_you_mean_1,
 * 		},
 * 		OptionTypeMismatchDiagnostic: diagnostics.Compiler_option_0_expects_an_argument,
 * 	}
 * }
 */
export function getParseCommandLineWorkerDiagnostics(decls) {
    return {
        didYouMean: {
            alternateMode: {
                diagnostic: Compiler_option_0_may_only_be_used_with_build,
                optionsNameMap: BuildNameMap,
            },
            OptionDeclarations: decls,
            UnknownOptionDiagnostic: Unknown_compiler_option_0,
            UnknownDidYouMeanDiagnostic: Unknown_compiler_option_0_Did_you_mean_1,
        },
        optionsNameMap: undefined,
        optionsNameMapOnce: new Once(),
        OptionTypeMismatchDiagnostic: Compiler_option_0_expects_an_argument,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/diagnostics.go::varGroup::watchOptionsDidYouMeanDiagnostics","kind":"varGroup","status":"implemented","sigHash":"8904f04db16550d00bfc933d407974de479ec8b94304d957a3645284087191ef","bodyHash":"791d3b54d8b9d60f778aaaa1a7471e8a649e25ccee9045a080f57c0a5cffe024"}
 *
 * Go source:
 * var watchOptionsDidYouMeanDiagnostics = &ParseCommandLineWorkerDiagnostics{
 * 	didYouMean: DidYouMeanOptionsDiagnostics{
 * 		// no alternateMode
 * 		OptionDeclarations:          OptionsForWatch,
 * 		UnknownOptionDiagnostic:     diagnostics.Unknown_watch_option_0,
 * 		UnknownDidYouMeanDiagnostic: diagnostics.Unknown_watch_option_0_Did_you_mean_1,
 * 	},
 * 	OptionTypeMismatchDiagnostic: diagnostics.Watch_option_0_requires_a_value_of_type_1,
 * }
 */
// Go initializes package-level vars by dependency order; assigned after
// OptionsForWatch is initialized in declswatch.ts.
export let watchOptionsDidYouMeanDiagnostics = undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/diagnostics.go::varGroup::buildOptionsDidYouMeanDiagnostics","kind":"varGroup","status":"implemented","sigHash":"82367338c4879fe397da04e723c5eb0818a1777fa154ea066902967579bff305","bodyHash":"346eda9bb19ecf3695410844f0b33357dfa620ac945c14a2f450d2d7e9df308f"}
 *
 * Go source:
 * var buildOptionsDidYouMeanDiagnostics = &ParseCommandLineWorkerDiagnostics{
 * 	didYouMean: DidYouMeanOptionsDiagnostics{
 * 		alternateMode: &AlternateModeDiagnostics{
 * 			diagnostic:     diagnostics.Compiler_option_0_may_not_be_used_with_build,
 * 			optionsNameMap: CompilerNameMap,
 * 		},
 * 		OptionDeclarations:          BuildOpts,
 * 		UnknownOptionDiagnostic:     diagnostics.Unknown_build_option_0,
 * 		UnknownDidYouMeanDiagnostic: diagnostics.Unknown_build_option_0_Did_you_mean_1,
 * 	},
 * 	OptionTypeMismatchDiagnostic: diagnostics.Build_option_0_requires_a_value_of_type_1,
 * }
 */
// Go initializes package-level vars by dependency order; assigned after
// BuildOpts and CompilerNameMap are initialized.
export let buildOptionsDidYouMeanDiagnostics = undefined;
// Assigned here (after all dependent vars are initialized in their modules)
// to match Go's dependency-ordered package-level var initialization.
CompilerOptionsDidYouMeanDiagnostics = getParseCommandLineWorkerDiagnostics(OptionsDeclarations);
watchOptionsDidYouMeanDiagnostics = {
    didYouMean: {
        alternateMode: undefined,
        OptionDeclarations: OptionsForWatch,
        UnknownOptionDiagnostic: Unknown_watch_option_0,
        UnknownDidYouMeanDiagnostic: Unknown_watch_option_0_Did_you_mean_1,
    },
    optionsNameMap: undefined,
    optionsNameMapOnce: new Once(),
    OptionTypeMismatchDiagnostic: Watch_option_0_requires_a_value_of_type_1,
};
buildOptionsDidYouMeanDiagnostics = {
    didYouMean: {
        alternateMode: {
            diagnostic: Compiler_option_0_may_not_be_used_with_build,
            optionsNameMap: CompilerNameMap,
        },
        OptionDeclarations: BuildOpts,
        UnknownOptionDiagnostic: Unknown_build_option_0,
        UnknownDidYouMeanDiagnostic: Unknown_build_option_0_Did_you_mean_1,
    },
    optionsNameMap: undefined,
    optionsNameMapOnce: new Once(),
    OptionTypeMismatchDiagnostic: Build_option_0_requires_a_value_of_type_1,
};
//# sourceMappingURL=diagnostics.js.map
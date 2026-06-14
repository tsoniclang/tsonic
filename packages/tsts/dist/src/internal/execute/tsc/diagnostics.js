import { Fprint } from "../../../go/fmt.js";
import * as strings from "../../../go/strings.js";
import { Tristate_IsTrue, Tristate_IsUnknown } from "../../core/tristate.js";
import { FormatDiagnosticWithColorAndContext, FormatDiagnosticsStatusAndTime, FormatDiagnosticsStatusWithColorAndTime, FromASTDiagnostics, TryClearScreen, WrapASTDiagnostic, WriteErrorSummaryText, WriteFormatDiagnostic, } from "../../diagnosticwriter/diagnosticwriter.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::getFormatOptsOfSys","kind":"func","status":"implemented","sigHash":"faec7e54856405e6612d20d2df14789aaea7768b85637acae987a722b4c7e25b","bodyHash":"da69f1d35e6665d6983603d9228cbabd850f0bc53980c573a650ace40545c06c"}
 *
 * Go source:
 * func getFormatOptsOfSys(sys System, locale locale.Locale) *diagnosticwriter.FormattingOptions {
 * 	return &diagnosticwriter.FormattingOptions{
 * 		NewLine: "\n",
 * 		ComparePathsOptions: tspath.ComparePathsOptions{
 * 			CurrentDirectory:          sys.GetCurrentDirectory(),
 * 			UseCaseSensitiveFileNames: sys.FS().UseCaseSensitiveFileNames(),
 * 		},
 * 		Locale: locale,
 * 	}
 * }
 */
export function getFormatOptsOfSys(sys, locale) {
    return {
        NewLine: "\n",
        __tsgoEmbedded0: {
            CurrentDirectory: sys.GetCurrentDirectory(),
            UseCaseSensitiveFileNames: sys.FS().UseCaseSensitiveFileNames(),
        },
        Locale: locale,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::QuietDiagnosticReporter","kind":"func","status":"implemented","sigHash":"e477c4e36cf15de44e5d520328fb033786411abb0add8131f9b2d8e7dd0bf142","bodyHash":"968ab8a629c7a0d92f83ecb05bed9f9b6412ccf7508e2a571297f07b88b7ea58"}
 *
 * Go source:
 * func QuietDiagnosticReporter(diagnostic *ast.Diagnostic) {}
 */
export function QuietDiagnosticReporter(_diagnostic) { }
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::CreateDiagnosticReporter","kind":"func","status":"implemented","sigHash":"de120b44738395e97dcd6175ae1bfb9413decd18e84119eddef8cf178a3633d0","bodyHash":"af3ba2a8d264815f64774254bcc66ef12d483e622c3d8f7b179ff610a3ba2fa6"}
 *
 * Go source:
 * func CreateDiagnosticReporter(sys System, w io.Writer, locale locale.Locale, options *core.CompilerOptions) DiagnosticReporter {
 * 	if options.Quiet.IsTrue() {
 * 		return QuietDiagnosticReporter
 * 	}
 * 	formatOpts := getFormatOptsOfSys(sys, locale)
 * 	if shouldBePretty(sys, options) {
 * 		return func(diagnostic *ast.Diagnostic) {
 * 			diagnosticwriter.FormatDiagnosticWithColorAndContext(w, diagnosticwriter.WrapASTDiagnostic(diagnostic), formatOpts)
 * 			fmt.Fprint(w, formatOpts.NewLine)
 * 		}
 * 	}
 * 	return func(diagnostic *ast.Diagnostic) {
 * 		diagnosticwriter.WriteFormatDiagnostic(w, diagnosticwriter.WrapASTDiagnostic(diagnostic), formatOpts)
 * 	}
 * }
 */
export function CreateDiagnosticReporter(sys, w, locale, options) {
    if (Tristate_IsTrue(options.Quiet)) {
        return QuietDiagnosticReporter;
    }
    const formatOpts = getFormatOptsOfSys(sys, locale);
    if (shouldBePretty(sys, options)) {
        return (diagnostic) => {
            FormatDiagnosticWithColorAndContext(w, WrapASTDiagnostic(diagnostic), formatOpts);
            Fprint(w, formatOpts.NewLine);
        };
    }
    return (diagnostic) => {
        WriteFormatDiagnostic(w, WrapASTDiagnostic(diagnostic), formatOpts);
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::defaultIsPretty","kind":"func","status":"implemented","sigHash":"9dc08bd571cf8544b85f99bb120ae94077259d5f49f87d6808ab8ada36d7bfa6","bodyHash":"232060384ce9813b0d005f178b036bf013fca114a39f1bde6ecec501f58f393e"}
 *
 * Go source:
 * func defaultIsPretty(sys System) bool {
 * 	if sys.GetEnvironmentVariable("NO_COLOR") != "" {
 * 		return false
 * 	}
 * 	if sys.GetEnvironmentVariable("FORCE_COLOR") != "" {
 * 		return true
 * 	}
 * 	return sys.WriteOutputIsTTY()
 * }
 */
export function defaultIsPretty(sys) {
    if (sys.GetEnvironmentVariable("NO_COLOR") !== "") {
        return false;
    }
    if (sys.GetEnvironmentVariable("FORCE_COLOR") !== "") {
        return true;
    }
    return sys.WriteOutputIsTTY();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::shouldBePretty","kind":"func","status":"implemented","sigHash":"4dfa83686eb9981e49092712cb5d0dae4896df71186616a4d96b0586e64321cc","bodyHash":"790b7e3de8e5a020a009a1562b0903b3ddc38d3bd0033cd3d7d18abf7e403334"}
 *
 * Go source:
 * func shouldBePretty(sys System, options *core.CompilerOptions) bool {
 * 	if options == nil || options.Pretty.IsUnknown() {
 * 		return defaultIsPretty(sys)
 * 	}
 * 	return options.Pretty.IsTrue()
 * }
 */
export function shouldBePretty(sys, options) {
    if (options === undefined || Tristate_IsUnknown(options.Pretty)) {
        return defaultIsPretty(sys);
    }
    return Tristate_IsTrue(options.Pretty);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::createColors","kind":"func","status":"implemented","sigHash":"b0635a3d12cd7a7a00ee829ba05c056af9a19f8adc07fd58534c7d6ad4e104a9","bodyHash":"5f40ac63700423aeb4881a6b0c6b4181a246d9696218fcfbd7239d52c848c791"}
 *
 * Go source:
 * func createColors(sys System) *colors {
 * 	if !defaultIsPretty(sys) {
 * 		return &colors{showColors: false}
 * 	}
 *
 * 	os := sys.GetEnvironmentVariable("OS")
 * 	isWindows := strings.Contains(strings.ToLower(os), "windows")
 * 	isWindowsTerminal := sys.GetEnvironmentVariable("WT_SESSION") != ""
 * 	isVSCode := sys.GetEnvironmentVariable("TERM_PROGRAM") == "vscode"
 * 	supportsRicherColors := sys.GetEnvironmentVariable("COLORTERM") == "truecolor" || sys.GetEnvironmentVariable("TERM") == "xterm-256color"
 *
 * 	return &colors{
 * 		showColors:           true,
 * 		isWindows:            isWindows,
 * 		isWindowsTerminal:    isWindowsTerminal,
 * 		isVSCode:             isVSCode,
 * 		supportsRicherColors: supportsRicherColors,
 * 	}
 * }
 */
export function createColors(sys) {
    if (!defaultIsPretty(sys)) {
        return { showColors: false, isWindows: false, isWindowsTerminal: false, isVSCode: false, supportsRicherColors: false };
    }
    const os = sys.GetEnvironmentVariable("OS");
    const isWindows = strings.Contains(strings.ToLower(os), "windows");
    const isWindowsTerminal = sys.GetEnvironmentVariable("WT_SESSION") !== "";
    const isVSCode = sys.GetEnvironmentVariable("TERM_PROGRAM") === "vscode";
    const supportsRicherColors = sys.GetEnvironmentVariable("COLORTERM") === "truecolor" || sys.GetEnvironmentVariable("TERM") === "xterm-256color";
    return {
        showColors: true,
        isWindows,
        isWindowsTerminal,
        isVSCode,
        supportsRicherColors,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::method::colors.bold","kind":"method","status":"implemented","sigHash":"ee4f985e0f40ab4b77913714ec636cfa4966368552bed04545c266efedc1f3a8","bodyHash":"ce69ef7071de09fdb4bb42fe720ce5c5a34f7a8a83223394fd6a39b9d95d5f3e"}
 *
 * Go source:
 * func (c *colors) bold(str string) string {
 * 	if !c.showColors {
 * 		return str
 * 	}
 * 	return "\x1b[1m" + str + "\x1b[22m"
 * }
 */
export function colors_bold(receiver, str) {
    const c = receiver;
    if (!c.showColors) {
        return str;
    }
    return "\x1b[1m" + str + "\x1b[22m";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::method::colors.blue","kind":"method","status":"implemented","sigHash":"496410c0ac0bdd7481dbceb4fd478363bc013465b0538f88fef8859670a1cc83","bodyHash":"411266a551e326562b89c7de2ea40a12143ddf8a8a572374c083dd70c25c6afb"}
 *
 * Go source:
 * func (c *colors) blue(str string) string {
 * 	if !c.showColors {
 * 		return str
 * 	}
 *
 * 	// Effectively Powershell and Command prompt users use cyan instead
 * 	// of blue because the default theme doesn't show blue with enough contrast.
 * 	if c.isWindows && !c.isWindowsTerminal && !c.isVSCode {
 * 		return c.brightWhite(str)
 * 	}
 * 	return "\x1b[94m" + str + "\x1b[39m"
 * }
 */
export function colors_blue(receiver, str) {
    const c = receiver;
    if (!c.showColors) {
        return str;
    }
    // Effectively Powershell and Command prompt users use cyan instead
    // of blue because the default theme doesn't show blue with enough contrast.
    if (c.isWindows && !c.isWindowsTerminal && !c.isVSCode) {
        return colors_brightWhite(receiver, str);
    }
    return "\x1b[94m" + str + "\x1b[39m";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::method::colors.blueBackground","kind":"method","status":"implemented","sigHash":"17e051dcc037071140d43b9604d56f7d09f110f4785493adc12e42560d557440","bodyHash":"8dcc5b2321a9207ab8e979a97285dbaa2cd0d42947ba3224686d2cfd1bf852dd"}
 *
 * Go source:
 * func (c *colors) blueBackground(str string) string {
 * 	if !c.showColors {
 * 		return str
 * 	}
 * 	if c.supportsRicherColors {
 * 		return "\x1B[48;5;68m" + str + "\x1B[39;49m"
 * 	} else {
 * 		return "\x1b[44m" + str + "\x1B[39;49m"
 * 	}
 * }
 */
export function colors_blueBackground(receiver, str) {
    const c = receiver;
    if (!c.showColors) {
        return str;
    }
    if (c.supportsRicherColors) {
        return "\x1B[48;5;68m" + str + "\x1B[39;49m";
    }
    else {
        return "\x1b[44m" + str + "\x1B[39;49m";
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::method::colors.brightWhite","kind":"method","status":"implemented","sigHash":"b3a3144d739bd0143cc89baa4734cfe96fe67e6b35749bfb8dd6f3713da3b7dc","bodyHash":"423a19356fdc79c5f3d2baf3aed38afde9576090cb8693f2b10976ed0353ea7e"}
 *
 * Go source:
 * func (c *colors) brightWhite(str string) string {
 * 	if !c.showColors {
 * 		return str
 * 	}
 * 	return "\x1b[97m" + str + "\x1b[39m"
 * }
 */
export function colors_brightWhite(receiver, str) {
    const c = receiver;
    if (!c.showColors) {
        return str;
    }
    return "\x1b[97m" + str + "\x1b[39m";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::QuietDiagnosticsReporter","kind":"func","status":"implemented","sigHash":"5866eb42e1d11e1d6e3d78c27eeff3d02994bf2be70a7674c203bbf5e977ac78","bodyHash":"05884c5312b784d3e6c0913f7342bb374ba210586a6717a99fe11f3b7d6ecf7f"}
 *
 * Go source:
 * func QuietDiagnosticsReporter(diagnostics []*ast.Diagnostic) {}
 */
export function QuietDiagnosticsReporter(_diagnostics) { }
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::CreateReportErrorSummary","kind":"func","status":"implemented","sigHash":"36b641688fde56b26213a3941e5ab3f3137a6483ffe4a73af4b16ad75e068f02","bodyHash":"9f36ed7889632c95ebe2ee5390933292a284e14533a38fb233f83b71568fa672"}
 *
 * Go source:
 * func CreateReportErrorSummary(sys System, locale locale.Locale, options *core.CompilerOptions) DiagnosticsReporter {
 * 	if shouldBePretty(sys, options) {
 * 		formatOpts := getFormatOptsOfSys(sys, locale)
 * 		return func(diagnostics []*ast.Diagnostic) {
 * 			diagnosticwriter.WriteErrorSummaryText(sys.Writer(), diagnosticwriter.FromASTDiagnostics(diagnostics), formatOpts)
 * 		}
 * 	}
 * 	return QuietDiagnosticsReporter
 * }
 */
export function CreateReportErrorSummary(sys, locale, options) {
    if (shouldBePretty(sys, options)) {
        const formatOpts = getFormatOptsOfSys(sys, locale);
        return (diagnostics) => {
            WriteErrorSummaryText(sys.Writer(), FromASTDiagnostics(diagnostics), formatOpts);
        };
    }
    return QuietDiagnosticsReporter;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::CreateBuilderStatusReporter","kind":"func","status":"implemented","sigHash":"1d555eda32cc3d2325209935ff687442bb90bbe38aa5f36ed476f1ab12cb2b54","bodyHash":"f8c2706252e64aabe949638d212ce64d0f9f78ab94158977458fc49de44a568d"}
 *
 * Go source:
 * func CreateBuilderStatusReporter(sys System, w io.Writer, locale locale.Locale, options *core.CompilerOptions, testing CommandLineTesting) DiagnosticReporter {
 * 	if options.Quiet.IsTrue() {
 * 		return QuietDiagnosticReporter
 * 	}
 *
 * 	formatOpts := getFormatOptsOfSys(sys, locale)
 * 	writeStatus := core.IfElse(shouldBePretty(sys, options), diagnosticwriter.FormatDiagnosticsStatusWithColorAndTime, diagnosticwriter.FormatDiagnosticsStatusAndTime)
 * 	return func(diagnostic *ast.Diagnostic) {
 * 		writerDiagnostic := diagnosticwriter.WrapASTDiagnostic(diagnostic)
 * 		if testing != nil {
 * 			testing.OnBuildStatusReportStart(w)
 * 			defer testing.OnBuildStatusReportEnd(w)
 * 		}
 * 		writeStatus(w, sys.Now().Format("03:04:05 PM"), writerDiagnostic, formatOpts)
 * 		fmt.Fprint(w, formatOpts.NewLine, formatOpts.NewLine)
 * 	}
 * }
 */
export function CreateBuilderStatusReporter(sys, w, locale, options, testing) {
    if (Tristate_IsTrue(options.Quiet)) {
        return QuietDiagnosticReporter;
    }
    const formatOpts = getFormatOptsOfSys(sys, locale);
    const writeStatus = shouldBePretty(sys, options) ? FormatDiagnosticsStatusWithColorAndTime : FormatDiagnosticsStatusAndTime;
    return (diagnostic) => {
        const writerDiagnostic = WrapASTDiagnostic(diagnostic);
        if (testing !== undefined) {
            testing.OnBuildStatusReportStart(w);
        }
        try {
            writeStatus(w, sys.Now().toString(), writerDiagnostic, formatOpts);
            Fprint(w, formatOpts.NewLine, formatOpts.NewLine);
        }
        finally {
            if (testing !== undefined) {
                testing.OnBuildStatusReportEnd(w);
            }
        }
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/diagnostics.go::func::CreateWatchStatusReporter","kind":"func","status":"implemented","sigHash":"c50d7a634e73749acffd6d0a3caba50209707f6518cbb528fcee032aa5c8ccc6","bodyHash":"6de896527f03a664bc13d169c665966856cc67800f4babc02face9f6c712d45b"}
 *
 * Go source:
 * func CreateWatchStatusReporter(sys System, locale locale.Locale, options *core.CompilerOptions, testing CommandLineTesting) DiagnosticReporter {
 * 	formatOpts := getFormatOptsOfSys(sys, locale)
 * 	writeStatus := core.IfElse(shouldBePretty(sys, options), diagnosticwriter.FormatDiagnosticsStatusWithColorAndTime, diagnosticwriter.FormatDiagnosticsStatusAndTime)
 * 	return func(diagnostic *ast.Diagnostic) {
 * 		writerDiagnostic := diagnosticwriter.WrapASTDiagnostic(diagnostic)
 * 		writer := sys.Writer()
 * 		if testing != nil {
 * 			testing.OnWatchStatusReportStart()
 * 			defer testing.OnWatchStatusReportEnd()
 * 		}
 * 		diagnosticwriter.TryClearScreen(writer, writerDiagnostic, options)
 * 		writeStatus(writer, sys.Now().Format("03:04:05 PM"), writerDiagnostic, formatOpts)
 * 		fmt.Fprint(writer, formatOpts.NewLine, formatOpts.NewLine)
 * 	}
 * }
 */
export function CreateWatchStatusReporter(sys, locale, options, testing) {
    const formatOpts = getFormatOptsOfSys(sys, locale);
    const writeStatus = shouldBePretty(sys, options) ? FormatDiagnosticsStatusWithColorAndTime : FormatDiagnosticsStatusAndTime;
    return (diagnostic) => {
        const writerDiagnostic = WrapASTDiagnostic(diagnostic);
        const writer = sys.Writer();
        if (testing !== undefined) {
            testing.OnWatchStatusReportStart();
        }
        try {
            TryClearScreen(writer, writerDiagnostic, options);
            writeStatus(writer, sys.Now().toString(), writerDiagnostic, formatOpts);
            Fprint(writer, formatOpts.NewLine, formatOpts.NewLine);
        }
        finally {
            if (testing !== undefined) {
                testing.OnWatchStatusReportEnd();
            }
        }
    };
}
//# sourceMappingURL=diagnostics.js.map
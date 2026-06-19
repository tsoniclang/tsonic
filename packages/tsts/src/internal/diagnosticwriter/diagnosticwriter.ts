import type { bool, int } from "../../go/scalars.js";
import type { GoConstraint, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Fprint, Fprintf, Sprintf } from "../../go/fmt.js";
import type { Writer } from "../../go/io.js";
import { Keys } from "../../go/maps.js";
import { Contains, SortedFunc } from "../../go/slices.js";
import { Builder, Compare, ReplaceAll, Repeat, Split, TrimRightFunc } from "../../go/strings.js";
import { Itoa } from "../../go/strconv.js";
import { IsSpace } from "../../go/unicode.js";
import type { Diagnostic as Diagnostic_34a9f76f } from "../ast/diagnostic.js";
import {
  CompareDiagnostics,
  Diagnostic_Code as ASTDiagnostic_Code,
  Diagnostic_Category as ASTDiagnostic_Category,
  Diagnostic_End as ASTDiagnostic_End,
  Diagnostic_File as ASTDiagnostic_File_inner,
  Diagnostic_Len as ASTDiagnostic_Len,
  Diagnostic_Localize as ASTDiagnostic_Localize,
  Diagnostic_MessageChain as ASTDiagnostic_MessageChain_inner,
  Diagnostic_Pos as ASTDiagnostic_Pos,
  Diagnostic_RelatedInformation as ASTDiagnostic_RelatedInformation_inner,
} from "../ast/diagnostic.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { UTF16Len } from "../core/core.js";
import { byteLen, byteSlice } from "../parser/utilities.js";
import type { TextPos } from "../core/text.js";
import { Tristate_IsTrue } from "../core/tristate.js";
import {
  Category_Name,
  CategoryError,
  CategoryMessage,
  CategorySuggestion,
  CategoryWarning,
} from "../diagnostics/diagnostics.js";
import type { Category } from "../diagnostics/diagnostics.js";
import {
  Errors_Files,
  File_appears_to_be_binary,
  File_change_detected_Starting_incremental_compilation,
  Found_0_errors,
  Found_0_errors_in_1_files,
  Found_0_errors_in_the_same_file_starting_at_Colon_1,
  Found_1_error,
  Found_1_error_in_0,
  Starting_compilation_in_watch_mode,
} from "../diagnostics/generated/messages.js";
import { Message_Code, Message_Localize } from "../diagnostics/diagnostics.js";
import type { Locale } from "../locale/locale.js";
import {
  GetECMALineAndUTF16CharacterOfPosition,
  GetECMALineOfPosition,
  GetECMAPositionOfLineAndByteOffset,
} from "../scanner/scanner.js";
import { ConvertToRelativePath, PathIsAbsolute } from "../tspath/path.js";
import type { ComparePathsOptions } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::FileLike","kind":"type","status":"implemented","sigHash":"c1f2b442a98ac11635887fcdf632a2de167ad0e61b071cd736139c21b5ff5cf1","bodyHash":"86b16b30f106734da4f4f55656622d5ddde2e7076ec0004c1b21ef5df4823e97"}
 *
 * Go source:
 * FileLike interface {
 * 	FileName() string
 * 	Text() string
 * 	ECMALineMap() []core.TextPos
 * }
 */
export interface FileLike {
  FileName(): string;
  Text(): string;
  ECMALineMap(): GoSlice<TextPos>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::Diagnostic","kind":"type","status":"implemented","sigHash":"6400335e13c5640d5feab15f7ba799726dae7af5e3f61bc5e89f4d29d12e8257","bodyHash":"e05d6a1014311d14a01fa12329927e138ec56fe656f3078dd1c05311f4433761"}
 *
 * Go source:
 * Diagnostic interface {
 * 	File() FileLike
 * 	Pos() int
 * 	End() int
 * 	Len() int
 * 	Code() int32
 * 	Category() diagnostics.Category
 * 	Localize(locale locale.Locale) string
 * 	MessageChain() []Diagnostic
 * 	RelatedInformation() []Diagnostic
 * }
 */
export interface Diagnostic {
  File(): FileLike;
  Pos(): int;
  End(): int;
  Len(): int;
  Code(): int;
  Category(): Category;
  Localize(locale: Locale): string;
  MessageChain(): GoSlice<Diagnostic>;
  RelatedInformation(): GoSlice<Diagnostic>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::ASTDiagnostic","kind":"type","status":"implemented","sigHash":"0b1e50f77d7246247789dd1d5c744b407d8cbc250708b719b1691e3f1dbc6400","bodyHash":"7496fe12fecbdc3edadbb76dfca8316a930ef47ba03735b632f355067985fa48"}
 *
 * Go source:
 * ASTDiagnostic struct {
 * 	*ast.Diagnostic
 * }
 */
export interface ASTDiagnostic extends Diagnostic {
  readonly __tsgoEmbedded0?: GoPtr<Diagnostic_34a9f76f>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::method::ASTDiagnostic.RelatedInformation","kind":"method","status":"implemented","sigHash":"7ea90458a0dff881258d54a86b2e9af7573ef5449e3e5e4f97eeb1850bde077b","bodyHash":"f821b714973f922a88aeab527f1a1921621776cbbbb8056b71882f9005dfdc75"}
 *
 * Go source:
 * func (d *ASTDiagnostic) RelatedInformation() []Diagnostic {
 * 	related := d.Diagnostic.RelatedInformation()
 * 	result := make([]Diagnostic, len(related))
 * 	for i, r := range related {
 * 		result[i] = &ASTDiagnostic{r}
 * 	}
 * 	return result
 * }
 */
export function ASTDiagnostic_RelatedInformation(receiver: GoPtr<ASTDiagnostic>): GoSlice<Diagnostic> {
  const related = ASTDiagnostic_RelatedInformation_inner(receiver!.__tsgoEmbedded0);
  const result: Diagnostic[] = new Array(related.length);
  for (let i = 0; i < related.length; i++) {
    result[i] = WrapASTDiagnostic(related[i]) as Diagnostic;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::method::ASTDiagnostic.File","kind":"method","status":"implemented","sigHash":"14c8947d0b4e08f8b94b228666cd09043035b1e56805aa1b6b61cabc4d06ad9e","bodyHash":"6760ed0f5167dfcac83bdfe4ec0de38f464ba1cde830aa818e17ff3266b54d43"}
 *
 * Go source:
 * func (d *ASTDiagnostic) File() FileLike {
 * 	if file := d.Diagnostic.File(); file != nil {
 * 		return file
 * 	}
 * 	return nil
 * }
 */
export function ASTDiagnostic_File(receiver: GoPtr<ASTDiagnostic>): FileLike {
  const file = ASTDiagnostic_File_inner(receiver!.__tsgoEmbedded0);
  if (file !== undefined) {
    return file as unknown as FileLike;
  }
  return undefined as unknown as FileLike;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::method::ASTDiagnostic.MessageChain","kind":"method","status":"implemented","sigHash":"661ae6fb67aff1e0451d120a5aae9cb5384e27580be271af22ea52203a0e38dc","bodyHash":"d33835d5a19ff23a5aa85175f8c36ad1008c95f8c8599fe5eb80ba6894b5d282"}
 *
 * Go source:
 * func (d *ASTDiagnostic) MessageChain() []Diagnostic {
 * 	chain := d.Diagnostic.MessageChain()
 * 	result := make([]Diagnostic, len(chain))
 * 	for i, c := range chain {
 * 		result[i] = &ASTDiagnostic{c}
 * 	}
 * 	return result
 * }
 */
export function ASTDiagnostic_MessageChain(receiver: GoPtr<ASTDiagnostic>): GoSlice<Diagnostic> {
  const chain = ASTDiagnostic_MessageChain_inner(receiver!.__tsgoEmbedded0);
  const result: Diagnostic[] = new Array(chain.length);
  for (let i = 0; i < chain.length; i++) {
    result[i] = WrapASTDiagnostic(chain[i]) as Diagnostic;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WrapASTDiagnostic","kind":"func","status":"implemented","sigHash":"bd70e38dc3337a0fd3f3bef32e4117000072a422f3848a1363ab9460df5adf55","bodyHash":"17a7a4beb3a96870fd04f18638da69692198b763305d6d7c03f489c5d9864333"}
 *
 * Go source:
 * func WrapASTDiagnostic(d *ast.Diagnostic) *ASTDiagnostic {
 * 	return &ASTDiagnostic{d}
 * }
 */
export function WrapASTDiagnostic(d: GoPtr<Diagnostic_34a9f76f>): GoPtr<ASTDiagnostic> {
  const result = {
    __tsgoEmbedded0: d,
  } as ASTDiagnostic;
  result.File = (): FileLike => ASTDiagnostic_File(result);
  result.Pos = (): int => ASTDiagnostic_Pos(result.__tsgoEmbedded0);
  result.End = (): int => ASTDiagnostic_End(result.__tsgoEmbedded0);
  result.Len = (): int => ASTDiagnostic_Len(result.__tsgoEmbedded0);
  result.Code = (): int => ASTDiagnostic_Code(result.__tsgoEmbedded0);
  result.Category = (): Category => ASTDiagnostic_Category(result.__tsgoEmbedded0);
  result.Localize = (locale_: Locale): string => ASTDiagnostic_Localize(result.__tsgoEmbedded0, locale_);
  result.MessageChain = (): GoSlice<Diagnostic> => ASTDiagnostic_MessageChain(result);
  result.RelatedInformation = (): GoSlice<Diagnostic> => ASTDiagnostic_RelatedInformation(result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WrapASTDiagnostics","kind":"func","status":"implemented","sigHash":"3315d29db17790abc2abae3f24f60cfd534e48bf21b799bb3787f56d3ac37754","bodyHash":"400ce356469e5423b522354eee513425376ac980a0bb99e962159105005db571"}
 *
 * Go source:
 * func WrapASTDiagnostics(diags []*ast.Diagnostic) []*ASTDiagnostic {
 * 	result := make([]*ASTDiagnostic, len(diags))
 * 	for i, d := range diags {
 * 		result[i] = WrapASTDiagnostic(d)
 * 	}
 * 	return result
 * }
 */
export function WrapASTDiagnostics(diags: GoSlice<GoPtr<Diagnostic_34a9f76f>>): GoSlice<GoPtr<ASTDiagnostic>> {
  const result: GoPtr<ASTDiagnostic>[] = new Array(diags.length);
  for (let i = 0; i < diags.length; i++) {
    result[i] = WrapASTDiagnostic(diags[i]);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FromASTDiagnostics","kind":"func","status":"implemented","sigHash":"4bf6b6af0e5c45017033b20ce11d3451b91629116fc618124e6d433396f33533","bodyHash":"393f8bdda9f1814341b5ca3704daef5790102dd4652b8101e6865a973144d6b9"}
 *
 * Go source:
 * func FromASTDiagnostics(diags []*ast.Diagnostic) []Diagnostic {
 * 	result := make([]Diagnostic, len(diags))
 * 	for i, d := range diags {
 * 		result[i] = WrapASTDiagnostic(d)
 * 	}
 * 	return result
 * }
 */
export function FromASTDiagnostics(diags: GoSlice<GoPtr<Diagnostic_34a9f76f>>): GoSlice<Diagnostic> {
  const result: Diagnostic[] = new Array(diags.length);
  for (let i = 0; i < diags.length; i++) {
    result[i] = WrapASTDiagnostic(diags[i]) as unknown as Diagnostic;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::ToDiagnostics","kind":"func","status":"implemented","sigHash":"47431ad76b8be000f4b6df8cc774d888e3b39720af7f661de6dd9e4497eabb96","bodyHash":"456ff65781cdf9608db2831e1f15fad3f75da061f0188c6484898b1f77d89da2"}
 *
 * Go source:
 * func ToDiagnostics[T Diagnostic](diags []T) []Diagnostic {
 * 	result := make([]Diagnostic, len(diags))
 * 	for i, d := range diags {
 * 		result[i] = d
 * 	}
 * 	return result
 * }
 */
export function ToDiagnostics<T extends Diagnostic>(diags: GoSlice<T>): GoSlice<Diagnostic> {
  const result: Diagnostic[] = new Array(diags.length);
  for (let i = 0; i < diags.length; i++) {
    result[i] = diags[i] as unknown as Diagnostic;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::CompareASTDiagnostics","kind":"func","status":"implemented","sigHash":"677095d4bff739988a7bb6d4ed2d4f9cfbc920bcdad1253c47ea15580275e78f","bodyHash":"ebfc5f5972aa7222a04cef64ad8f76c64505f02444275ba8bc3e398ee12cea52"}
 *
 * Go source:
 * func CompareASTDiagnostics(a, b *ASTDiagnostic) int {
 * 	return ast.CompareDiagnostics(a.Diagnostic, b.Diagnostic)
 * }
 */
export function CompareASTDiagnostics(a: GoPtr<ASTDiagnostic>, b: GoPtr<ASTDiagnostic>): int {
  return CompareDiagnostics(a!.__tsgoEmbedded0, b!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::FormattingOptions","kind":"type","status":"implemented","sigHash":"8aa377d010e0e40cc5c97fb1ce83a004e64d943dc79e7cdddf138d30ee02b6c1","bodyHash":"500d125b23844b9323be6f5904c3bc1c6fa0447486127d32ffe144cb4888de14"}
 *
 * Go source:
 * FormattingOptions struct {
 * 	Locale locale.Locale
 * 	tspath.ComparePathsOptions
 * 	NewLine string
 * }
 */
export interface FormattingOptions {
  Locale: Locale;
  readonly __tsgoEmbedded0?: ComparePathsOptions;
  NewLine: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::constGroup::foregroundColorEscapeGrey+foregroundColorEscapeRed+foregroundColorEscapeYellow+foregroundColorEscapeBlue+foregroundColorEscapeCyan","kind":"constGroup","status":"implemented","sigHash":"f16191c793ec9b38181d47cd36c7b90d27a4f95bb4940c850b1192a378f382f9","bodyHash":"cece878eef22a258d6c3c1e9718a1d015c7cd00f3f66c1d272d3b13f4e06c103"}
 *
 * Go source:
 * const (
 * 	foregroundColorEscapeGrey   = "[90m"
 * 	foregroundColorEscapeRed    = "[91m"
 * 	foregroundColorEscapeYellow = "[93m"
 * 	foregroundColorEscapeBlue   = "[94m"
 * 	foregroundColorEscapeCyan   = "[96m"
 * )
 */
export const foregroundColorEscapeGrey: string = "[90m";
export const foregroundColorEscapeRed: string = "[91m";
export const foregroundColorEscapeYellow: string = "[93m";
export const foregroundColorEscapeBlue: string = "[94m";
export const foregroundColorEscapeCyan: string = "[96m";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::constGroup::gutterStyleSequence+gutterSeparator+resetEscapeSequence+ellipsis","kind":"constGroup","status":"implemented","sigHash":"8b0348d0bb2c7a18e1a4f0182d24f33252e72ce9f90e41285c04a684a6507326","bodyHash":"a07328217a0e275c2be73434281f047cb715a3f1052a671a8187b8f79895ba61"}
 *
 * Go source:
 * const (
 * 	gutterStyleSequence = "[7m"
 * 	gutterSeparator     = " "
 * 	resetEscapeSequence = "[0m"
 * 	ellipsis            = "..."
 * )
 */
export const gutterStyleSequence: string = "[7m";
export const gutterSeparator: string = " ";
export const resetEscapeSequence: string = "[0m";
export const ellipsis: string = "...";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FormatDiagnosticsWithColorAndContext","kind":"func","status":"implemented","sigHash":"554b3dedf7fe2b11bd309732fae7539ff9ba19f38f7eb4d13739b11af070a657","bodyHash":"287d2ab1f48957c06ecd8077c1230d0bdff844ba71d279806b2edd206326f338"}
 *
 * Go source:
 * func FormatDiagnosticsWithColorAndContext(output io.Writer, diags []Diagnostic, formatOpts *FormattingOptions) {
 * 	if len(diags) == 0 {
 * 		return
 * 	}
 * 	for i, diagnostic := range diags {
 * 		if i > 0 {
 * 			fmt.Fprint(output, formatOpts.NewLine)
 * 		}
 * 		FormatDiagnosticWithColorAndContext(output, diagnostic, formatOpts)
 * 	}
 * }
 */
export function FormatDiagnosticsWithColorAndContext(output: Writer, diags: GoSlice<Diagnostic>, formatOpts: GoPtr<FormattingOptions>): void {
  if (diags.length === 0) {
    return;
  }
  for (let i = 0; i < diags.length; i++) {
    const diagnostic = diags[i]!;
    if (i > 0) {
      Fprint(output, formatOpts!.NewLine);
    }
    FormatDiagnosticWithColorAndContext(output, diagnostic, formatOpts);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FormatDiagnosticWithColorAndContext","kind":"func","status":"implemented","sigHash":"7d02f9cb7b54824e7a9757afa7b493e3a61173e8af074a5b3cc20f06eb63d908","bodyHash":"5d81fb33a4e532b4d15ece709f327b760128908264426a3418db41ae3006e007"}
 *
 * Go source:
 * func FormatDiagnosticWithColorAndContext(output io.Writer, diagnostic Diagnostic, formatOpts *FormattingOptions) {
 * 	if diagnostic.File() != nil {
 * 		file := diagnostic.File()
 * 		pos := diagnostic.Pos()
 * 		WriteLocation(output, file, pos, formatOpts, writeWithStyleAndReset)
 * 		fmt.Fprint(output, " - ")
 * 	}
 *
 * 	writeWithStyleAndReset(output, diagnostic.Category().Name(), getCategoryFormat(diagnostic.Category()))
 * 	fmt.Fprintf(output, "%s TS%d: %s", foregroundColorEscapeGrey, diagnostic.Code(), resetEscapeSequence)
 * 	WriteFlattenedDiagnosticMessage(output, diagnostic, formatOpts.NewLine, formatOpts.Locale)
 *
 * 	if diagnostic.File() != nil && diagnostic.Code() != diagnostics.File_appears_to_be_binary.Code() {
 * 		fmt.Fprint(output, formatOpts.NewLine)
 * 		writeCodeSnippet(output, diagnostic.File(), diagnostic.Pos(), diagnostic.Len(), getCategoryFormat(diagnostic.Category()), "", formatOpts)
 * 		fmt.Fprint(output, formatOpts.NewLine)
 * 	}
 *
 * 	if (diagnostic.RelatedInformation() != nil) && (len(diagnostic.RelatedInformation()) > 0) {
 * 		for _, relatedInformation := range diagnostic.RelatedInformation() {
 * 			file := relatedInformation.File()
 * 			if file != nil {
 * 				fmt.Fprint(output, formatOpts.NewLine)
 * 				fmt.Fprint(output, "  ")
 * 				pos := relatedInformation.Pos()
 * 				WriteLocation(output, file, pos, formatOpts, writeWithStyleAndReset)
 * 				fmt.Fprint(output, " - ")
 * 				WriteFlattenedDiagnosticMessage(output, relatedInformation, formatOpts.NewLine, formatOpts.Locale)
 * 				writeCodeSnippet(output, file, pos, relatedInformation.Len(), foregroundColorEscapeCyan, "    ", formatOpts)
 * 			}
 * 			fmt.Fprint(output, formatOpts.NewLine)
 * 		}
 * 	}
 * }
 */
export function FormatDiagnosticWithColorAndContext(output: Writer, diagnostic: Diagnostic, formatOpts: GoPtr<FormattingOptions>): void {
  if (diagnostic.File() !== undefined) {
    const file = diagnostic.File();
    const pos = diagnostic.Pos();
    WriteLocation(output, file, pos, formatOpts, writeWithStyleAndReset);
    Fprint(output, " - ");
  }

  writeWithStyleAndReset(output, Category_Name(diagnostic.Category()), getCategoryFormat(diagnostic.Category()));
  Fprintf(output, "%s TS%d: %s", foregroundColorEscapeGrey, diagnostic.Code(), resetEscapeSequence);
  WriteFlattenedDiagnosticMessage(output, diagnostic, formatOpts!.NewLine, formatOpts!.Locale);

  if (diagnostic.File() !== undefined && diagnostic.Code() !== Message_Code(File_appears_to_be_binary)) {
    Fprint(output, formatOpts!.NewLine);
    writeCodeSnippet(output, diagnostic.File(), diagnostic.Pos(), diagnostic.Len(), getCategoryFormat(diagnostic.Category()), "", formatOpts);
    Fprint(output, formatOpts!.NewLine);
  }

  const relatedInformation = diagnostic.RelatedInformation();
  if (relatedInformation !== undefined && relatedInformation.length > 0) {
    for (const relatedInfo of relatedInformation) {
      const file = relatedInfo.File();
      if (file !== undefined) {
        Fprint(output, formatOpts!.NewLine);
        Fprint(output, "  ");
        const pos = relatedInfo.Pos();
        WriteLocation(output, file, pos, formatOpts, writeWithStyleAndReset);
        Fprint(output, " - ");
        WriteFlattenedDiagnosticMessage(output, relatedInfo, formatOpts!.NewLine, formatOpts!.Locale);
        writeCodeSnippet(output, file, pos, relatedInfo.Len(), foregroundColorEscapeCyan, "    ", formatOpts);
      }
      Fprint(output, formatOpts!.NewLine);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::writeCodeSnippet","kind":"func","status":"implemented","sigHash":"62a9bbb0e553b64fd15a68c739b8eb820cfd9b7342a4d5627e4c92a1412c7cf9","bodyHash":"7bfbc36b9c37a4eb238e861ea8cfcd4acb100ff2fde07d9861a9262b06816a87"}
 *
 * Go source:
 * func writeCodeSnippet(writer io.Writer, sourceFile FileLike, start int, length int, squiggleColor string, indent string, formatOpts *FormattingOptions) {
 * 	firstLine, firstLineChar := scanner.GetECMALineAndUTF16CharacterOfPosition(sourceFile, start)
 * 	lastLine, lastLineChar := scanner.GetECMALineAndUTF16CharacterOfPosition(sourceFile, start+length)
 * 	if length == 0 {
 * 		lastLineChar++ // When length is zero, squiggle the character right after the start position.
 * 	}
 *
 * 	lastLineOfFile := scanner.GetECMALineOfPosition(sourceFile, len(sourceFile.Text()))
 *
 * 	hasMoreThanFiveLines := lastLine-firstLine >= 4
 * 	gutterWidth := len(strconv.Itoa(lastLine + 1))
 * 	if hasMoreThanFiveLines {
 * 		gutterWidth = max(len(ellipsis), gutterWidth)
 * 	}
 *
 * 	for i := firstLine; i <= lastLine; i++ {
 * 		fmt.Fprint(writer, formatOpts.NewLine)
 *
 * 		// If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
 * 		// so we'll skip ahead to the second-to-last line.
 * 		if hasMoreThanFiveLines && firstLine+1 < i && i < lastLine-1 {
 * 			fmt.Fprint(writer, indent)
 * 			fmt.Fprint(writer, gutterStyleSequence)
 * 			fmt.Fprintf(writer, "%*s", gutterWidth, ellipsis)
 * 			fmt.Fprint(writer, resetEscapeSequence)
 * 			fmt.Fprint(writer, gutterSeparator)
 * 			fmt.Fprint(writer, formatOpts.NewLine)
 * 			i = lastLine - 1
 * 		}
 *
 * 		lineStart := scanner.GetECMAPositionOfLineAndByteOffset(sourceFile, i, 0)
 * 		var lineEnd int
 * 		if i < lastLineOfFile {
 * 			lineEnd = scanner.GetECMAPositionOfLineAndByteOffset(sourceFile, i+1, 0)
 * 		} else {
 * 			lineEnd = len(sourceFile.Text())
 * 		}
 *
 * 		lineContent := strings.TrimRightFunc(sourceFile.Text()[lineStart:lineEnd], unicode.IsSpace) // trim from end
 * 		lineContent = strings.ReplaceAll(lineContent, "\t", " ")                                    // convert tabs to single spaces
 *
 * 		// Output the gutter and the actual contents of the line.
 * 		fmt.Fprint(writer, indent)
 * 		fmt.Fprint(writer, gutterStyleSequence)
 * 		fmt.Fprintf(writer, "%*d", gutterWidth, i+1)
 * 		fmt.Fprint(writer, resetEscapeSequence)
 * 		fmt.Fprint(writer, gutterSeparator)
 * 		fmt.Fprint(writer, lineContent)
 * 		fmt.Fprint(writer, formatOpts.NewLine)
 *
 * 		// Output the gutter and the error span for the line using tildes.
 * 		fmt.Fprint(writer, indent)
 * 		fmt.Fprint(writer, gutterStyleSequence)
 * 		fmt.Fprintf(writer, "%*s", gutterWidth, "")
 * 		fmt.Fprint(writer, resetEscapeSequence)
 * 		fmt.Fprint(writer, gutterSeparator)
 * 		fmt.Fprint(writer, squiggleColor)
 * 		switch i {
 * 		case firstLine:
 * 			// If we're on the last line, then limit it to the last character of the last line.
 * 			// Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
 * 			var lastCharForLine int
 * 			if i == lastLine {
 * 				lastCharForLine = int(lastLineChar)
 * 			} else {
 * 				lastCharForLine = int(core.UTF16Len(lineContent))
 * 			}
 *
 * 			// Fill with spaces until the first character,
 * 			// then squiggle the remainder of the line.
 * 			fmt.Fprint(writer, strings.Repeat(" ", int(firstLineChar)))
 * 			fmt.Fprint(writer, strings.Repeat("~", lastCharForLine-int(firstLineChar)))
 * 		case lastLine:
 * 			// Squiggle until the final character.
 * 			fmt.Fprint(writer, strings.Repeat("~", int(lastLineChar)))
 * 		default:
 * 			// Squiggle the entire line.
 * 			fmt.Fprint(writer, strings.Repeat("~", int(core.UTF16Len(lineContent))))
 * 		}
 *
 * 		fmt.Fprint(writer, resetEscapeSequence)
 * 	}
 * }
 */
export function writeCodeSnippet(writer: Writer, sourceFile: FileLike, start: int, length: int, squiggleColor: string, indent: string, formatOpts: GoPtr<FormattingOptions>): void {
  const [firstLine, firstLineChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFile, start);
  let [lastLine, lastLineChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFile, start + length);
  if (length === 0) {
    lastLineChar++;
  }

  const lastLineOfFile = GetECMALineOfPosition(sourceFile, byteLen(sourceFile.Text()));

  const hasMoreThanFiveLines = lastLine - firstLine >= 4;
  let gutterWidth = Itoa(lastLine + 1).length;
  if (hasMoreThanFiveLines) {
    gutterWidth = Math.max(ellipsis.length, gutterWidth);
  }

  for (let i = firstLine; i <= lastLine; i++) {
    Fprint(writer, formatOpts!.NewLine);

    if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
      Fprint(writer, indent);
      Fprint(writer, gutterStyleSequence);
      Fprintf(writer, "%*s", gutterWidth, ellipsis);
      Fprint(writer, resetEscapeSequence);
      Fprint(writer, gutterSeparator);
      Fprint(writer, formatOpts!.NewLine);
      i = lastLine - 1;
    }

    const lineStart = GetECMAPositionOfLineAndByteOffset(sourceFile, i, 0);
    let lineEnd: int;
    if (i < lastLineOfFile) {
      lineEnd = GetECMAPositionOfLineAndByteOffset(sourceFile, i + 1, 0);
    } else {
      lineEnd = byteLen(sourceFile.Text());
    }

    let lineContent = TrimRightFunc(byteSlice(sourceFile.Text(), lineStart, lineEnd), IsSpace);
    lineContent = ReplaceAll(lineContent, "\t", " ");

    Fprint(writer, indent);
    Fprint(writer, gutterStyleSequence);
    Fprintf(writer, "%*d", gutterWidth, i + 1);
    Fprint(writer, resetEscapeSequence);
    Fprint(writer, gutterSeparator);
    Fprint(writer, lineContent);
    Fprint(writer, formatOpts!.NewLine);

    Fprint(writer, indent);
    Fprint(writer, gutterStyleSequence);
    Fprintf(writer, "%*s", gutterWidth, "");
    Fprint(writer, resetEscapeSequence);
    Fprint(writer, gutterSeparator);
    Fprint(writer, squiggleColor);
    if (i === firstLine) {
      let lastCharForLine: int;
      if (i === lastLine) {
        lastCharForLine = lastLineChar;
      } else {
        lastCharForLine = UTF16Len(lineContent);
      }
      Fprint(writer, Repeat(" ", firstLineChar));
      Fprint(writer, Repeat("~", lastCharForLine - firstLineChar));
    } else if (i === lastLine) {
      Fprint(writer, Repeat("~", lastLineChar));
    } else {
      Fprint(writer, Repeat("~", UTF16Len(lineContent)));
    }

    Fprint(writer, resetEscapeSequence);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FlattenDiagnosticMessage","kind":"func","status":"implemented","sigHash":"360e70a8454b3d249f54037d5b2317c361a6be25d202a470c63d1643272423e5","bodyHash":"7471694052152ab8e481f74606396d1519e1119c891a6665e0a008310e6b54da"}
 *
 * Go source:
 * func FlattenDiagnosticMessage(d Diagnostic, newLine string, locale locale.Locale) string {
 * 	var output strings.Builder
 * 	WriteFlattenedDiagnosticMessage(&output, d, newLine, locale)
 * 	return output.String()
 * }
 */
export function FlattenDiagnosticMessage(d: Diagnostic, newLine: string, locale: Locale): string {
  const output = new Builder();
  WriteFlattenedDiagnosticMessage(output, d, newLine, locale);
  return output.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteFlattenedASTDiagnosticMessage","kind":"func","status":"implemented","sigHash":"d4c8a3f514b3b5d0e205418d1187d41a7120eee4cd6e2ea43471a9064324f93a","bodyHash":"92188be3b2f6ebbdff784272c5ba7e9d2ae9941e67de38a73527202b46283d68"}
 *
 * Go source:
 * func WriteFlattenedASTDiagnosticMessage(writer io.Writer, diagnostic *ast.Diagnostic, newline string, locale locale.Locale) {
 * 	WriteFlattenedDiagnosticMessage(writer, WrapASTDiagnostic(diagnostic), newline, locale)
 * }
 */
export function WriteFlattenedASTDiagnosticMessage(writer: Writer, diagnostic: GoPtr<Diagnostic_34a9f76f>, newline: string, locale: Locale): void {
  WriteFlattenedDiagnosticMessage(writer, WrapASTDiagnostic(diagnostic) as unknown as Diagnostic, newline, locale);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteFlattenedDiagnosticMessage","kind":"func","status":"implemented","sigHash":"61489075e57d3cc16fbc248d9aac66606b9b64f6e1174b19eac33f3e07b2b6e2","bodyHash":"0f69a3115a27ffbbd67372d67732600862f63a97dd6aabd5f4e868c062059b8b"}
 *
 * Go source:
 * func WriteFlattenedDiagnosticMessage(writer io.Writer, diagnostic Diagnostic, newline string, locale locale.Locale) {
 * 	fmt.Fprint(writer, diagnostic.Localize(locale))
 *
 * 	for _, chain := range diagnostic.MessageChain() {
 * 		flattenDiagnosticMessageChain(writer, chain, newline, locale, 1 /*level* /)
 * 	}
 * }
 */
export function WriteFlattenedDiagnosticMessage(writer: Writer, diagnostic: Diagnostic, newline: string, locale: Locale): void {
  Fprint(writer, diagnostic.Localize(locale));

  for (const chain of diagnostic.MessageChain()) {
    flattenDiagnosticMessageChain(writer, chain, newline, locale, 1);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::flattenDiagnosticMessageChain","kind":"func","status":"implemented","sigHash":"c757ec5d631f938fd315411c72ef9ba6115d56f84f92f6a55dba7256a375f3db","bodyHash":"593322641a6cdcc73574962dd7698b32765a4ec7983ce4e826875756dd5b8697"}
 *
 * Go source:
 * func flattenDiagnosticMessageChain(writer io.Writer, chain Diagnostic, newLine string, locale locale.Locale, level int) {
 * 	fmt.Fprint(writer, newLine)
 * 	for range level {
 * 		fmt.Fprint(writer, "  ")
 * 	}
 *
 * 	fmt.Fprint(writer, chain.Localize(locale))
 * 	for _, child := range chain.MessageChain() {
 * 		flattenDiagnosticMessageChain(writer, child, newLine, locale, level+1)
 * 	}
 * }
 */
export function flattenDiagnosticMessageChain(writer: Writer, chain: Diagnostic, newLine: string, locale: Locale, level: int): void {
  Fprint(writer, newLine);
  for (let i = 0; i < level; i++) {
    Fprint(writer, "  ");
  }

  Fprint(writer, chain.Localize(locale));
  for (const child of chain.MessageChain()) {
    flattenDiagnosticMessageChain(writer, child, newLine, locale, level + 1);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::getCategoryFormat","kind":"func","status":"implemented","sigHash":"d8effaa5e10ddc79996f1b36bcf25b241ba327842e00c841a0c21e18bc984526","bodyHash":"094d5072961573f726486439fb997d57b5f2a7b0a0e7f93d8bc6fb64ad94d48a"}
 *
 * Go source:
 * func getCategoryFormat(category diagnostics.Category) string {
 * 	switch category {
 * 	case diagnostics.CategoryError:
 * 		return foregroundColorEscapeRed
 * 	case diagnostics.CategoryWarning:
 * 		return foregroundColorEscapeYellow
 * 	case diagnostics.CategorySuggestion:
 * 		return foregroundColorEscapeGrey
 * 	case diagnostics.CategoryMessage:
 * 		return foregroundColorEscapeBlue
 * 	}
 * 	panic("Unhandled diagnostic category")
 * }
 */
export function getCategoryFormat(category: Category): string {
  switch (category) {
    case CategoryError:
      return foregroundColorEscapeRed;
    case CategoryWarning:
      return foregroundColorEscapeYellow;
    case CategorySuggestion:
      return foregroundColorEscapeGrey;
    case CategoryMessage:
      return foregroundColorEscapeBlue;
  }
  throw new globalThis.Error("Unhandled diagnostic category");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::FormattedWriter","kind":"type","status":"implemented","sigHash":"070590be8512e1f0730458740e3eeb11268aa841f446f4474ae6d33061000d98","bodyHash":"983556c2551514f522f1b832c22e995d1d1a40e518c66e50a922f117ace2df78"}
 *
 * Go source:
 * FormattedWriter func(output io.Writer, text string, formatStyle string)
 */
export type FormattedWriter = (output: Writer, text: string, formatStyle: string) => void;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::writeWithStyleAndReset","kind":"func","status":"implemented","sigHash":"1305615c81a4a4b3f7c9a5255aa3f3f63c28905a1f97394a55a3cd93e59d1ccd","bodyHash":"c0400ff9734c7c57a23c2238da6c8d8c49e1ca819a75106f061ee6e5533ac601"}
 *
 * Go source:
 * func writeWithStyleAndReset(output io.Writer, text string, formatStyle string) {
 * 	fmt.Fprint(output, formatStyle)
 * 	fmt.Fprint(output, text)
 * 	fmt.Fprint(output, resetEscapeSequence)
 * }
 */
export function writeWithStyleAndReset(output: Writer, text: string, formatStyle: string): void {
  Fprint(output, formatStyle);
  Fprint(output, text);
  Fprint(output, resetEscapeSequence);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteLocation","kind":"func","status":"implemented","sigHash":"992e1a8820740a8e9b710d916e7efc53f63afa82ee45b24e7d0e20bbdc1a8d91","bodyHash":"3ef9d672cee7ccd68d4325cca09a5d5a4b1c40f25c15bf203a3bfc4466a1a0d8"}
 *
 * Go source:
 * func WriteLocation(output io.Writer, file FileLike, pos int, formatOpts *FormattingOptions, writeWithStyleAndReset FormattedWriter) {
 * 	firstLine, firstChar := scanner.GetECMALineAndUTF16CharacterOfPosition(file, pos)
 * 	var relativeFileName string
 * 	if formatOpts != nil {
 * 		relativeFileName = tspath.ConvertToRelativePath(file.FileName(), formatOpts.ComparePathsOptions)
 * 	} else {
 * 		relativeFileName = file.FileName()
 * 	}
 *
 * 	writeWithStyleAndReset(output, relativeFileName, foregroundColorEscapeCyan)
 * 	fmt.Fprint(output, ":")
 * 	writeWithStyleAndReset(output, strconv.Itoa(firstLine+1), foregroundColorEscapeYellow)
 * 	fmt.Fprint(output, ":")
 * 	writeWithStyleAndReset(output, strconv.Itoa(int(firstChar)+1), foregroundColorEscapeYellow)
 * }
 */
export function WriteLocation(output: Writer, file: FileLike, pos: int, formatOpts: GoPtr<FormattingOptions>, writeWithStyleAndReset: FormattedWriter): void {
  const [firstLine, firstChar] = GetECMALineAndUTF16CharacterOfPosition(file, pos);
  let relativeFileName: string;
  if (formatOpts !== undefined) {
    relativeFileName = ConvertToRelativePath(file.FileName(), formatOpts.__tsgoEmbedded0 as ComparePathsOptions);
  } else {
    relativeFileName = file.FileName();
  }

  writeWithStyleAndReset(output, relativeFileName, foregroundColorEscapeCyan);
  Fprint(output, ":");
  writeWithStyleAndReset(output, Itoa(firstLine + 1), foregroundColorEscapeYellow);
  Fprint(output, ":");
  writeWithStyleAndReset(output, Itoa(firstChar + 1), foregroundColorEscapeYellow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::type::ErrorSummary","kind":"type","status":"implemented","sigHash":"bee0efb76aa62d69512e9952f325b33c1fe9a58a0c612d7afdee8ba615d056cf","bodyHash":"b64c0e2cd004715933d0c1b5ef63fafb262284183b5acd8360dfd109dca9c474"}
 *
 * Go source:
 * ErrorSummary struct {
 * 	TotalErrorCount int
 * 	GlobalErrors    []Diagnostic
 * 	ErrorsByFile    map[FileLike][]Diagnostic
 * 	SortedFiles     []FileLike
 * }
 */
export interface ErrorSummary {
  TotalErrorCount: int;
  GlobalErrors: GoSlice<Diagnostic>;
  ErrorsByFile: GoMap<FileLike, GoSlice<Diagnostic>>;
  SortedFiles: GoSlice<FileLike>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteErrorSummaryText","kind":"func","status":"implemented","sigHash":"f09ab868591551556892d9d9827259cf38110dd48158244b4bbe52c4e3933562","bodyHash":"e401db5d4343b541bb003947907363510e748c7e38d402a54c14cadd276fbfcf"}
 *
 * Go source:
 * func WriteErrorSummaryText(output io.Writer, allDiagnostics []Diagnostic, formatOpts *FormattingOptions) {
 * 	// Roughly corresponds to 'getErrorSummaryText' from watch.ts
 *
 * 	errorSummary := getErrorSummary(allDiagnostics)
 * 	totalErrorCount := errorSummary.TotalErrorCount
 * 	if totalErrorCount == 0 {
 * 		return
 * 	}
 *
 * 	var firstFile FileLike
 * 	if len(errorSummary.SortedFiles) > 0 {
 * 		firstFile = errorSummary.SortedFiles[0]
 * 	}
 * 	firstFileName := prettyPathForFileError(firstFile, errorSummary.ErrorsByFile[firstFile], formatOpts)
 * 	numErroringFiles := len(errorSummary.ErrorsByFile)
 *
 * 	var message string
 * 	if totalErrorCount == 1 {
 * 		// Special-case a single error.
 * 		if len(errorSummary.GlobalErrors) > 0 || firstFileName == "" {
 * 			message = diagnostics.Found_1_error.Localize(formatOpts.Locale)
 * 		} else {
 * 			message = diagnostics.Found_1_error_in_0.Localize(formatOpts.Locale, firstFileName)
 * 		}
 * 	} else {
 * 		switch numErroringFiles {
 * 		case 0:
 * 			// No file-specific errors.
 * 			message = diagnostics.Found_0_errors.Localize(formatOpts.Locale, totalErrorCount)
 * 		case 1:
 * 			// One file with errors.
 * 			message = diagnostics.Found_0_errors_in_the_same_file_starting_at_Colon_1.Localize(formatOpts.Locale, totalErrorCount, firstFileName)
 * 		default:
 * 			// Multiple files with errors.
 * 			message = diagnostics.Found_0_errors_in_1_files.Localize(formatOpts.Locale, totalErrorCount, numErroringFiles)
 * 		}
 * 	}
 * 	fmt.Fprint(output, formatOpts.NewLine)
 * 	fmt.Fprint(output, message)
 * 	fmt.Fprint(output, formatOpts.NewLine)
 * 	fmt.Fprint(output, formatOpts.NewLine)
 * 	if numErroringFiles > 1 {
 * 		writeTabularErrorsDisplay(output, errorSummary, formatOpts)
 * 		fmt.Fprint(output, formatOpts.NewLine)
 * 	}
 * }
 */
export function WriteErrorSummaryText(output: Writer, allDiagnostics: GoSlice<Diagnostic>, formatOpts: GoPtr<FormattingOptions>): void {
  const errorSummary = getErrorSummary(allDiagnostics);
  const totalErrorCount = errorSummary!.TotalErrorCount;
  if (totalErrorCount === 0) {
    return;
  }

  let firstFile: FileLike | undefined = undefined;
  if (errorSummary!.SortedFiles.length > 0) {
    firstFile = errorSummary!.SortedFiles[0];
  }
  const firstFileName = prettyPathForFileError(firstFile as FileLike, firstFile !== undefined ? (errorSummary!.ErrorsByFile.get(firstFile) ?? []) : [], formatOpts);
  const numErroringFiles = errorSummary!.ErrorsByFile.size;

  let message: string;
  if (totalErrorCount === 1) {
    if (errorSummary!.GlobalErrors.length > 0 || firstFileName === "") {
      message = Message_Localize(Found_1_error, formatOpts!.Locale);
    } else {
      message = Message_Localize(Found_1_error_in_0, formatOpts!.Locale, firstFileName);
    }
  } else {
    switch (numErroringFiles) {
      case 0:
        message = Message_Localize(Found_0_errors, formatOpts!.Locale, totalErrorCount);
        break;
      case 1:
        message = Message_Localize(Found_0_errors_in_the_same_file_starting_at_Colon_1, formatOpts!.Locale, totalErrorCount, firstFileName);
        break;
      default:
        message = Message_Localize(Found_0_errors_in_1_files, formatOpts!.Locale, totalErrorCount, numErroringFiles);
        break;
    }
  }
  Fprint(output, formatOpts!.NewLine);
  Fprint(output, message);
  Fprint(output, formatOpts!.NewLine);
  Fprint(output, formatOpts!.NewLine);
  if (numErroringFiles > 1) {
    writeTabularErrorsDisplay(output, errorSummary, formatOpts);
    Fprint(output, formatOpts!.NewLine);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::getErrorSummary","kind":"func","status":"implemented","sigHash":"ec63157f340802c062ae8e651864860984dfbe3a149076656e4e174950245b9d","bodyHash":"f68709806afcaee2b89055598252d5ace600d0ec92b4d96071a06ab05d8546c2"}
 *
 * Go source:
 * func getErrorSummary(diags []Diagnostic) *ErrorSummary {
 * 	var totalErrorCount int
 * 	var globalErrors []Diagnostic
 * 	var errorsByFile map[FileLike][]Diagnostic
 *
 * 	for _, diagnostic := range diags {
 * 		if diagnostic.Category() != diagnostics.CategoryError {
 * 			continue
 * 		}
 *
 * 		totalErrorCount++
 * 		if diagnostic.File() == nil {
 * 			globalErrors = append(globalErrors, diagnostic)
 * 		} else {
 * 			if errorsByFile == nil {
 * 				errorsByFile = make(map[FileLike][]Diagnostic)
 * 			}
 * 			errorsByFile[diagnostic.File()] = append(errorsByFile[diagnostic.File()], diagnostic)
 * 		}
 * 	}
 *
 * 	// !!!
 * 	// Need an ordered map here, but sorting for consistency.
 * 	sortedFiles := slices.SortedFunc(maps.Keys(errorsByFile), func(a, b FileLike) int {
 * 		return strings.Compare(a.FileName(), b.FileName())
 * 	})
 *
 * 	return &ErrorSummary{
 * 		TotalErrorCount: totalErrorCount,
 * 		GlobalErrors:    globalErrors,
 * 		ErrorsByFile:    errorsByFile,
 * 		SortedFiles:     sortedFiles,
 * 	}
 * }
 */
export function getErrorSummary(diags: GoSlice<Diagnostic>): GoPtr<ErrorSummary> {
  let totalErrorCount = 0;
  let globalErrors: GoSlice<Diagnostic> = [];
  let errorsByFile: GoMap<FileLike, GoSlice<Diagnostic>> | undefined = undefined;

  for (const diagnostic of diags) {
    if (diagnostic.Category() !== CategoryError) {
      continue;
    }

    totalErrorCount++;
    if (diagnostic.File() === undefined) {
      globalErrors = [...globalErrors, diagnostic];
    } else {
      if (errorsByFile === undefined) {
        errorsByFile = new Map<FileLike, GoSlice<Diagnostic>>();
      }
      const existing = errorsByFile.get(diagnostic.File()) ?? [];
      errorsByFile.set(diagnostic.File(), [...existing, diagnostic]);
    }
  }

  const effectiveErrorsByFile: GoMap<FileLike, GoSlice<Diagnostic>> = errorsByFile ?? new Map<FileLike, GoSlice<Diagnostic>>();

  const sortedFiles = SortedFunc(Keys(effectiveErrorsByFile), (a: FileLike, b: FileLike) => {
    return Compare(a.FileName(), b.FileName());
  });

  return {
    TotalErrorCount: totalErrorCount,
    GlobalErrors: globalErrors,
    ErrorsByFile: effectiveErrorsByFile,
    SortedFiles: sortedFiles,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::writeTabularErrorsDisplay","kind":"func","status":"implemented","sigHash":"4ea0bb2035342e7e5aad99bb37917458e701244c92dbb884bc33239c5e2a75eb","bodyHash":"bdce3e8fe369abe013ce97e4485a67ecd5c42d280a19bb6c64c475063195a5e8"}
 *
 * Go source:
 * func writeTabularErrorsDisplay(output io.Writer, errorSummary *ErrorSummary, formatOpts *FormattingOptions) {
 * 	sortedFiles := errorSummary.SortedFiles
 *
 * 	maxErrors := 0
 * 	for _, errorsForFile := range errorSummary.ErrorsByFile {
 * 		maxErrors = max(maxErrors, len(errorsForFile))
 * 	}
 *
 * 	// !!!
 * 	// TODO (drosen): This was never localized.
 * 	// Should make this better.
 * 	headerRow := diagnostics.Errors_Files.Localize(formatOpts.Locale)
 * 	leftColumnHeadingLength := len(strings.Split(headerRow, " ")[0])
 * 	lengthOfBiggestErrorCount := len(strconv.Itoa(maxErrors))
 * 	leftPaddingGoal := max(leftColumnHeadingLength, lengthOfBiggestErrorCount)
 * 	headerPadding := max(lengthOfBiggestErrorCount-leftColumnHeadingLength, 0)
 *
 * 	fmt.Fprint(output, strings.Repeat(" ", headerPadding))
 * 	fmt.Fprint(output, headerRow)
 * 	fmt.Fprint(output, formatOpts.NewLine)
 *
 * 	for _, file := range sortedFiles {
 * 		fileErrors := errorSummary.ErrorsByFile[file]
 * 		errorCount := len(fileErrors)
 *
 * 		fmt.Fprintf(output, "%*d  ", leftPaddingGoal, errorCount)
 * 		fmt.Fprint(output, prettyPathForFileError(file, fileErrors, formatOpts))
 * 		fmt.Fprint(output, formatOpts.NewLine)
 * 	}
 * }
 */
export function writeTabularErrorsDisplay(output: Writer, errorSummary: GoPtr<ErrorSummary>, formatOpts: GoPtr<FormattingOptions>): void {
  const sortedFiles = errorSummary!.SortedFiles;

  let maxErrors = 0;
  for (const errorsForFile of errorSummary!.ErrorsByFile.values()) {
    maxErrors = Math.max(maxErrors, errorsForFile.length);
  }

  const headerRow = Message_Localize(Errors_Files, formatOpts!.Locale);
  const leftColumnHeadingLength = Split(headerRow, " ")[0]!.length;
  const lengthOfBiggestErrorCount = Itoa(maxErrors).length;
  const leftPaddingGoal = Math.max(leftColumnHeadingLength, lengthOfBiggestErrorCount);
  const headerPadding = Math.max(lengthOfBiggestErrorCount - leftColumnHeadingLength, 0);

  Fprint(output, Repeat(" ", headerPadding));
  Fprint(output, headerRow);
  Fprint(output, formatOpts!.NewLine);

  for (const file of sortedFiles) {
    const fileErrors = errorSummary!.ErrorsByFile.get(file) ?? [];
    const errorCount = fileErrors.length;

    Fprintf(output, "%*d  ", leftPaddingGoal, errorCount);
    Fprint(output, prettyPathForFileError(file, fileErrors, formatOpts));
    Fprint(output, formatOpts!.NewLine);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::prettyPathForFileError","kind":"func","status":"implemented","sigHash":"9f82abd402c81c130756a021b0d8e0ceb707e722e5244dbc3179d31c5e38062e","bodyHash":"3ed33f91253f348a93201504aab83e8e01d864bd8dcab7ca31f6e581b10ad9a6"}
 *
 * Go source:
 * func prettyPathForFileError(file FileLike, fileErrors []Diagnostic, formatOpts *FormattingOptions) string {
 * 	if file == nil || len(fileErrors) == 0 {
 * 		return ""
 * 	}
 * 	line := scanner.GetECMALineOfPosition(file, fileErrors[0].Pos())
 * 	fileName := file.FileName()
 * 	if tspath.PathIsAbsolute(fileName) && tspath.PathIsAbsolute(formatOpts.CurrentDirectory) {
 * 		fileName = tspath.ConvertToRelativePath(file.FileName(), formatOpts.ComparePathsOptions)
 * 	}
 * 	return fmt.Sprintf("%s%s:%d%s",
 * 		fileName,
 * 		foregroundColorEscapeGrey,
 * 		line+1,
 * 		resetEscapeSequence,
 * 	)
 * }
 */
export function prettyPathForFileError(file: FileLike, fileErrors: GoSlice<Diagnostic>, formatOpts: GoPtr<FormattingOptions>): string {
  if (file === undefined || fileErrors.length === 0) {
    return "";
  }
  const line = GetECMALineOfPosition(file, fileErrors[0]!.Pos());
  let fileName = file.FileName();
  if (PathIsAbsolute(fileName) && PathIsAbsolute((formatOpts!.__tsgoEmbedded0 as ComparePathsOptions).CurrentDirectory)) {
    fileName = ConvertToRelativePath(file.FileName(), formatOpts!.__tsgoEmbedded0 as ComparePathsOptions);
  }
  return Sprintf(
    "%s%s:%d%s",
    fileName,
    foregroundColorEscapeGrey,
    line + 1,
    resetEscapeSequence,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteFormatDiagnostics","kind":"func","status":"implemented","sigHash":"fc8cd341092c3050d207e32c04a1180ab50df3b96d5044d75220bed784debc6b","bodyHash":"d6242e184792ad8f82ad1a454129846fe5367e178a73eaa796cb7b39bf364988"}
 *
 * Go source:
 * func WriteFormatDiagnostics(output io.Writer, diagnostics []Diagnostic, formatOpts *FormattingOptions) {
 * 	for _, diagnostic := range diagnostics {
 * 		WriteFormatDiagnostic(output, diagnostic, formatOpts)
 * 	}
 * }
 */
export function WriteFormatDiagnostics(output: Writer, diagnostics: GoSlice<Diagnostic>, formatOpts: GoPtr<FormattingOptions>): void {
  for (const diagnostic of diagnostics) {
    WriteFormatDiagnostic(output, diagnostic, formatOpts);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::WriteFormatDiagnostic","kind":"func","status":"implemented","sigHash":"deb7418faa07667cf5f37a854657067b25fca5670f43138b1f5377c6bd61c6b3","bodyHash":"a6880b42a8c814f9d272c35ecd4cbf8e7ce09db1e4551889806169dc5da930b1"}
 *
 * Go source:
 * func WriteFormatDiagnostic(output io.Writer, diagnostic Diagnostic, formatOpts *FormattingOptions) {
 * 	if diagnostic.File() != nil {
 * 		line, character := scanner.GetECMALineAndUTF16CharacterOfPosition(diagnostic.File(), diagnostic.Pos())
 * 		fileName := diagnostic.File().FileName()
 * 		relativeFileName := tspath.ConvertToRelativePath(fileName, formatOpts.ComparePathsOptions)
 * 		fmt.Fprintf(output, "%s(%d,%d): ", relativeFileName, line+1, int(character)+1)
 * 	}
 *
 * 	fmt.Fprintf(output, "%s TS%d: ", diagnostic.Category().Name(), diagnostic.Code())
 * 	WriteFlattenedDiagnosticMessage(output, diagnostic, formatOpts.NewLine, formatOpts.Locale)
 * 	fmt.Fprint(output, formatOpts.NewLine)
 * }
 */
export function WriteFormatDiagnostic(output: Writer, diagnostic: Diagnostic, formatOpts: GoPtr<FormattingOptions>): void {
  if (diagnostic.File() !== undefined) {
    const [line, character] = GetECMALineAndUTF16CharacterOfPosition(diagnostic.File(), diagnostic.Pos());
    const fileName = diagnostic.File().FileName();
    const relativeFileName = ConvertToRelativePath(fileName, formatOpts!.__tsgoEmbedded0 as ComparePathsOptions);
    Fprintf(output, "%s(%d,%d): ", relativeFileName, line + 1, character + 1);
  }

  Fprintf(output, "%s TS%d: ", Category_Name(diagnostic.Category()), diagnostic.Code());
  WriteFlattenedDiagnosticMessage(output, diagnostic, formatOpts!.NewLine, formatOpts!.Locale);
  Fprint(output, formatOpts!.NewLine);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FormatDiagnosticsStatusWithColorAndTime","kind":"func","status":"implemented","sigHash":"0f7c7a5c4e99d7f275b9f27b436405772230f5dda1f79895ae82d122e3e1dc4e","bodyHash":"33661819875ae4f22dba27d301b234f9f00e6989590392e0acc4acebfc557a40"}
 *
 * Go source:
 * func FormatDiagnosticsStatusWithColorAndTime(output io.Writer, time string, diag Diagnostic, formatOpts *FormattingOptions) {
 * 	fmt.Fprint(output, "[")
 * 	writeWithStyleAndReset(output, time, foregroundColorEscapeGrey)
 * 	fmt.Fprint(output, "] ")
 * 	WriteFlattenedDiagnosticMessage(output, diag, formatOpts.NewLine, formatOpts.Locale)
 * }
 */
export function FormatDiagnosticsStatusWithColorAndTime(output: Writer, time: string, diag: Diagnostic, formatOpts: GoPtr<FormattingOptions>): void {
  Fprint(output, "[");
  writeWithStyleAndReset(output, time, foregroundColorEscapeGrey);
  Fprint(output, "] ");
  WriteFlattenedDiagnosticMessage(output, diag, formatOpts!.NewLine, formatOpts!.Locale);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::FormatDiagnosticsStatusAndTime","kind":"func","status":"implemented","sigHash":"5fa04b97bcf2fa4f7db2c9c0d5e2243bf43d320acc1aaf43722337edb61fe90f","bodyHash":"6b103e165ae2f67dee27d13b223c2eb8952e35e12d0e3c1ceef098bf30d0cb1c"}
 *
 * Go source:
 * func FormatDiagnosticsStatusAndTime(output io.Writer, time string, diag Diagnostic, formatOpts *FormattingOptions) {
 * 	fmt.Fprint(output, time, " - ")
 * 	WriteFlattenedDiagnosticMessage(output, diag, formatOpts.NewLine, formatOpts.Locale)
 * }
 */
export function FormatDiagnosticsStatusAndTime(output: Writer, time: string, diag: Diagnostic, formatOpts: GoPtr<FormattingOptions>): void {
  Fprint(output, time, " - ");
  WriteFlattenedDiagnosticMessage(output, diag, formatOpts!.NewLine, formatOpts!.Locale);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::varGroup::ScreenStartingCodes","kind":"varGroup","status":"implemented","sigHash":"f85eb94df5fd9660570b421a62caf462504e63a1e661fddad1ab91d4ba3d44ff","bodyHash":"7b0727d67684f129260f5f54a35be43c0cd333bd80495300cfab10e5714c0818"}
 *
 * Go source:
 * var ScreenStartingCodes = []int32{
 * 	diagnostics.Starting_compilation_in_watch_mode.Code(),
 * 	diagnostics.File_change_detected_Starting_incremental_compilation.Code(),
 * }
 */
export let ScreenStartingCodes: GoSlice<int> = [
  Message_Code(Starting_compilation_in_watch_mode),
  Message_Code(File_change_detected_Starting_incremental_compilation),
];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnosticwriter/diagnosticwriter.go::func::TryClearScreen","kind":"func","status":"implemented","sigHash":"60beee6514b86b5739fd9eaf27ff072f8460c6bef7a5a96a5cdbda1ea79c9463","bodyHash":"6cbe3af442f174683dd3d6c25016397b5eeb1c75736a7c5415474094fb62fbb7"}
 *
 * Go source:
 * func TryClearScreen(output io.Writer, diag Diagnostic, options *core.CompilerOptions) bool {
 * 	if !options.PreserveWatchOutput.IsTrue() &&
 * 		!options.ExtendedDiagnostics.IsTrue() &&
 * 		!options.Diagnostics.IsTrue() &&
 * 		slices.Contains(ScreenStartingCodes, diag.Code()) {
 * 		fmt.Fprint(output, "\x1B[2J\x1B[3J\x1B[H") // Clear screen and move cursor to home position
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function TryClearScreen(output: Writer, diag: Diagnostic, options: GoPtr<CompilerOptions>): bool {
  if (
    !Tristate_IsTrue(options!.PreserveWatchOutput) &&
    !Tristate_IsTrue(options!.ExtendedDiagnostics) &&
    !Tristate_IsTrue(options!.Diagnostics) &&
    Contains(ScreenStartingCodes, diag.Code())
  ) {
    Fprint(output, "\x1B[2J\x1B[3J\x1B[H");
    return true;
  }
  return false;
}

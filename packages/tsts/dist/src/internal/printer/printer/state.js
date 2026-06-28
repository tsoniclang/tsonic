/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::constGroup::WriteKindNone+WriteKindKeyword+WriteKindOperator+WriteKindPunctuation+WriteKindStringLiteral+WriteKindParameter+WriteKindProperty+WriteKindComment+WriteKindLiteral","kind":"constGroup","status":"implemented","sigHash":"f857e88bbd770a526a1409900bf938f7c504daa712f75842be7b9b8a96a57f4f","bodyHash":"98067c5f12d438bbee5189e77a0ab115d66989aff33acc3e8c4e9d20b7fafa68"}
 *
 * Go source:
 * const (
 * 	WriteKindNone WriteKind = iota
 * 	WriteKindKeyword
 * 	WriteKindOperator
 * 	WriteKindPunctuation
 * 	WriteKindStringLiteral
 * 	WriteKindParameter
 * 	WriteKindProperty
 * 	WriteKindComment
 * 	WriteKindLiteral
 * )
 */
export const WriteKindNone = 0;
export const WriteKindKeyword = 1;
export const WriteKindOperator = 2;
export const WriteKindPunctuation = 3;
export const WriteKindStringLiteral = 4;
export const WriteKindParameter = 5;
export const WriteKindProperty = 6;
export const WriteKindComment = 7;
export const WriteKindLiteral = 8;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::constGroup::commentSeparatorNone+commentSeparatorBefore+commentSeparatorAfter","kind":"constGroup","status":"implemented","sigHash":"a2a79165f3b5e5fbbbc4c2b324ec30896284bed59c16f00ba415b9f8252fad08","bodyHash":"bc5a40dfeaef1fd2298fea9d89aab404cfb5b603428bc6f67e2dae1e2f82cf91"}
 *
 * Go source:
 * const (
 * 	commentSeparatorNone commentSeparator = iota
 * 	commentSeparatorBefore
 * 	commentSeparatorAfter
 * )
 */
export const commentSeparatorNone = 0;
export const commentSeparatorBefore = 1;
export const commentSeparatorAfter = 2;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::constGroup::tefNoComments+tefIndentLeadingComments+tefNoSourceMaps+tefNone","kind":"constGroup","status":"implemented","sigHash":"a86d6c8334930890a3002ea14ea47b2d7ea6aadfaff0ddd13d668ae2263ec45d","bodyHash":"c6000ff791a40b622bcf7cee63934f3e0c5f809e1fde39ade5b9b16390513d13"}
 *
 * Go source:
 * const (
 * 	tefNoComments tokenEmitFlags = 1 << iota
 * 	tefIndentLeadingComments
 * 	tefNoSourceMaps
 *
 * 	tefNone tokenEmitFlags = 0
 * )
 */
export const tefNoComments = 1 << 0;
export const tefIndentLeadingComments = 1 << 1;
export const tefNoSourceMaps = 1 << 2;
export const tefNone = 0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::constGroup::LFNone+LFSingleLine+LFMultiLine+LFPreserveLines+LFLinesMask+LFNotDelimited+LFBarDelimited+LFAmpersandDelimited+LFCommaDelimited+LFAsteriskDelimited+LFDelimitersMask+LFAllowTrailingComma+LFIndented+LFSpaceBetweenBraces+LFSpaceBetweenSiblings+LFBraces+LFParenthesis+LFAngleBrackets+LFSquareBrackets+LFBracketsMask+LFOptionalIfNil+LFOptionalIfEmpty+LFOptional+LFPreferNewLine+LFNoTrailingNewLine+LFNoInterveningComments+LFNoSpaceIfEmpty+LFSingleElement+LFSpaceAfterList+LFModifiers+LFHeritageClauses+LFSingleLineTypeLiteralMembers+LFMultiLineTypeLiteralMembers+LFSingleLineTupleTypeElements+LFMultiLineTupleTypeElements+LFUnionTypeConstituents+LFIntersectionTypeConstituents+LFObjectBindingPatternElements+LFArrayBindingPatternElements+LFObjectLiteralExpressionProperties+LFImportAttributes+LFArrayLiteralExpressionElements+LFCommaListElements+LFCallExpressionArguments+LFNewExpressionArguments+LFTemplateExpressionSpans+LFSingleLineBlockStatements+LFMultiLineBlockStatements+LFVariableDeclarationList+LFSingleLineFunctionBodyStatements+LFMultiLineFunctionBodyStatements+LFClassHeritageClauses+LFClassMembers+LFInterfaceMembers+LFEnumMembers+LFCaseBlockClauses+LFNamedImportsOrExportsElements+LFJsxElementOrFragmentChildren+LFJsxElementAttributes+LFCaseOrDefaultClauseStatements+LFHeritageClauseTypes+LFSourceFileStatements+LFDecorators+LFTypeArguments+LFTypeParameters+LFParameters+LFSingleArrowParameter+LFIndexSignatureParameters+LFJSDocComment+LFImportClauseEntries","kind":"constGroup","status":"implemented","sigHash":"b6a4554872a04b2300e984ead8bb621efc9cdfe93ac9df72242d803e71c69416","bodyHash":"15139928f8518dd260c3c0bc322390f7c3efaba40a56b25d7220e914734a1b02"}
 *
 * Go source:
 * const (
 * 	LFNone ListFormat = 0
 *
 * 	// Line separators
 * 	LFSingleLine    ListFormat = 0      // Prints the list on a single line (default).
 * 	LFMultiLine     ListFormat = 1 << 0 // Prints the list on multiple lines.
 * 	LFPreserveLines ListFormat = 1 << 1 // Prints the list using line preservation if possible.
 * 	LFLinesMask     ListFormat = LFSingleLine | LFMultiLine | LFPreserveLines
 *
 * 	// Delimiters
 * 	LFNotDelimited       ListFormat = 0      // There is no delimiter between list items (default).
 * 	LFBarDelimited       ListFormat = 1 << 2 // Each list item is space-and-bar (" |") delimited.
 * 	LFAmpersandDelimited ListFormat = 1 << 3 // Each list item is space-and-ampersand (" &") delimited.
 * 	LFCommaDelimited     ListFormat = 1 << 4 // Each list item is comma (",") delimited.
 * 	LFAsteriskDelimited  ListFormat = 1 << 5 // Each list item is asterisk ("\n *") delimited, used with JSDoc.
 * 	LFDelimitersMask     ListFormat = LFBarDelimited | LFAmpersandDelimited | LFCommaDelimited | LFAsteriskDelimited
 *
 * 	LFAllowTrailingComma ListFormat = 1 << 6 // Write a trailing comma (",") if present.
 *
 * 	// Whitespace
 * 	LFIndented             ListFormat = 1 << 7 // The list should be indented.
 * 	LFSpaceBetweenBraces   ListFormat = 1 << 8 // Inserts a space after the opening brace and before the closing brace.
 * 	LFSpaceBetweenSiblings ListFormat = 1 << 9 // Inserts a space between each sibling node.
 *
 * 	// Brackets/Braces
 * 	LFBraces         ListFormat = 1 << 10 // The list is surrounded by "{" and "}".
 * 	LFParenthesis    ListFormat = 1 << 11 // The list is surrounded by "(" and ")".
 * 	LFAngleBrackets  ListFormat = 1 << 12 // The list is surrounded by "<" and ">".
 * 	LFSquareBrackets ListFormat = 1 << 13 // The list is surrounded by "[" and "]".
 * 	LFBracketsMask   ListFormat = LFBraces | LFParenthesis | LFAngleBrackets | LFSquareBrackets
 *
 * 	LFOptionalIfNil   ListFormat = 1 << 14 // Do not emit brackets if the list is nil.
 * 	LFOptionalIfEmpty ListFormat = 1 << 15 // Do not emit brackets if the list is empty.
 * 	LFOptional        ListFormat = LFOptionalIfNil | LFOptionalIfEmpty
 *
 * 	// Other
 * 	LFPreferNewLine         ListFormat = 1 << 16 // Prefer adding a LineTerminator between synthesized nodes.
 * 	LFNoTrailingNewLine     ListFormat = 1 << 17 // Do not emit a trailing NewLine for a MultiLine list.
 * 	LFNoInterveningComments ListFormat = 1 << 18 // Do not emit comments between each node
 * 	LFNoSpaceIfEmpty        ListFormat = 1 << 19 // If the literal is empty, do not add spaces between braces.
 * 	LFSingleElement         ListFormat = 1 << 20
 * 	LFSpaceAfterList        ListFormat = 1 << 21 // Add space after list
 *
 * 	// Precomputed Formats
 * 	LFModifiers                    ListFormat = LFSingleLine | LFSpaceBetweenSiblings | LFNoInterveningComments | LFSpaceAfterList
 * 	LFHeritageClauses              ListFormat = LFSingleLine | LFSpaceBetweenSiblings
 * 	LFSingleLineTypeLiteralMembers ListFormat = LFSingleLine | LFSpaceBetweenBraces | LFSpaceBetweenSiblings
 * 	LFMultiLineTypeLiteralMembers  ListFormat = LFMultiLine | LFIndented | LFOptionalIfEmpty
 *
 * 	LFSingleLineTupleTypeElements       ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFMultiLineTupleTypeElements        ListFormat = LFCommaDelimited | LFIndented | LFSpaceBetweenSiblings | LFMultiLine
 * 	LFUnionTypeConstituents             ListFormat = LFBarDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFIntersectionTypeConstituents      ListFormat = LFAmpersandDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFObjectBindingPatternElements      ListFormat = LFSingleLine | LFAllowTrailingComma | LFSpaceBetweenBraces | LFCommaDelimited | LFSpaceBetweenSiblings | LFNoSpaceIfEmpty
 * 	LFArrayBindingPatternElements       ListFormat = LFSingleLine | LFAllowTrailingComma | LFCommaDelimited | LFSpaceBetweenSiblings | LFNoSpaceIfEmpty
 * 	LFObjectLiteralExpressionProperties ListFormat = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFSpaceBetweenBraces | LFIndented | LFBraces | LFNoSpaceIfEmpty
 * 	LFImportAttributes                  ListFormat = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFSpaceBetweenBraces | LFIndented | LFBraces | LFNoSpaceIfEmpty
 * 	LFArrayLiteralExpressionElements    ListFormat = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFAllowTrailingComma | LFIndented | LFSquareBrackets
 * 	LFCommaListElements                 ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFCallExpressionArguments           ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis
 * 	LFNewExpressionArguments            ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis | LFOptionalIfNil
 * 	LFTemplateExpressionSpans           ListFormat = LFSingleLine | LFNoInterveningComments
 * 	LFSingleLineBlockStatements         ListFormat = LFSpaceBetweenBraces | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFMultiLineBlockStatements          ListFormat = LFIndented | LFMultiLine
 * 	LFVariableDeclarationList           ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFSingleLineFunctionBodyStatements  ListFormat = LFSingleLine | LFSpaceBetweenSiblings | LFSpaceBetweenBraces
 * 	LFMultiLineFunctionBodyStatements   ListFormat = LFMultiLine
 * 	LFClassHeritageClauses              ListFormat = LFSingleLine
 * 	LFClassMembers                      ListFormat = LFIndented | LFMultiLine
 * 	LFInterfaceMembers                  ListFormat = LFIndented | LFMultiLine
 * 	LFEnumMembers                       ListFormat = LFCommaDelimited | LFIndented | LFMultiLine
 * 	LFCaseBlockClauses                  ListFormat = LFIndented | LFMultiLine
 * 	LFNamedImportsOrExportsElements     ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFAllowTrailingComma | LFSingleLine | LFSpaceBetweenBraces | LFNoSpaceIfEmpty
 * 	LFJsxElementOrFragmentChildren      ListFormat = LFSingleLine | LFNoInterveningComments
 * 	LFJsxElementAttributes              ListFormat = LFSingleLine | LFSpaceBetweenSiblings | LFNoInterveningComments
 * 	LFCaseOrDefaultClauseStatements     ListFormat = LFIndented | LFMultiLine | LFNoTrailingNewLine | LFOptionalIfEmpty
 * 	LFHeritageClauseTypes               ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFSourceFileStatements              ListFormat = LFMultiLine | LFNoTrailingNewLine
 * 	LFDecorators                        ListFormat = LFMultiLine | LFOptional | LFSpaceAfterList
 * 	LFTypeArguments                     ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFAngleBrackets | LFOptional
 * 	LFTypeParameters                    ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFAngleBrackets | LFOptional
 * 	LFParameters                        ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis
 * 	LFSingleArrowParameter              ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine
 * 	LFIndexSignatureParameters          ListFormat = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFIndented | LFSquareBrackets
 * 	LFJSDocComment                      ListFormat = LFMultiLine | LFAsteriskDelimited
 * 	LFImportClauseEntries               ListFormat = LFImportAttributes // Deprecated: Use LFImportAttributes
 * )
 */
export const LFNone = 0;
// Line separators
export const LFSingleLine = 0; // Prints the list on a single line (default).
export const LFMultiLine = 1 << 0; // Prints the list on multiple lines.
export const LFPreserveLines = 1 << 1; // Prints the list using line preservation if possible.
export const LFLinesMask = LFSingleLine | LFMultiLine | LFPreserveLines;
// Delimiters
export const LFNotDelimited = 0; // There is no delimiter between list items (default).
export const LFBarDelimited = 1 << 2; // Each list item is space-and-bar (" |") delimited.
export const LFAmpersandDelimited = 1 << 3; // Each list item is space-and-ampersand (" &") delimited.
export const LFCommaDelimited = 1 << 4; // Each list item is comma (",") delimited.
export const LFAsteriskDelimited = 1 << 5; // Each list item is asterisk ("\n *") delimited, used with JSDoc.
export const LFDelimitersMask = LFBarDelimited | LFAmpersandDelimited | LFCommaDelimited | LFAsteriskDelimited;
export const LFAllowTrailingComma = 1 << 6; // Write a trailing comma (",") if present.
// Whitespace
export const LFIndented = 1 << 7; // The list should be indented.
export const LFSpaceBetweenBraces = 1 << 8; // Inserts a space after the opening brace and before the closing brace.
export const LFSpaceBetweenSiblings = 1 << 9; // Inserts a space between each sibling node.
// Brackets/Braces
export const LFBraces = 1 << 10; // The list is surrounded by "{" and "}".
export const LFParenthesis = 1 << 11; // The list is surrounded by "(" and ")".
export const LFAngleBrackets = 1 << 12; // The list is surrounded by "<" and ">".
export const LFSquareBrackets = 1 << 13; // The list is surrounded by "[" and "]".
export const LFBracketsMask = LFBraces | LFParenthesis | LFAngleBrackets | LFSquareBrackets;
export const LFOptionalIfNil = 1 << 14; // Do not emit brackets if the list is nil.
export const LFOptionalIfEmpty = 1 << 15; // Do not emit brackets if the list is empty.
export const LFOptional = LFOptionalIfNil | LFOptionalIfEmpty;
// Other
export const LFPreferNewLine = 1 << 16; // Prefer adding a LineTerminator between synthesized nodes.
export const LFNoTrailingNewLine = 1 << 17; // Do not emit a trailing NewLine for a MultiLine list.
export const LFNoInterveningComments = 1 << 18; // Do not emit comments between each node
export const LFNoSpaceIfEmpty = 1 << 19; // If the literal is empty, do not add spaces between braces.
export const LFSingleElement = 1 << 20;
export const LFSpaceAfterList = 1 << 21; // Add space after list
// Precomputed Formats
export const LFModifiers = LFSingleLine | LFSpaceBetweenSiblings | LFNoInterveningComments | LFSpaceAfterList;
export const LFHeritageClauses = LFSingleLine | LFSpaceBetweenSiblings;
export const LFSingleLineTypeLiteralMembers = LFSingleLine | LFSpaceBetweenBraces | LFSpaceBetweenSiblings;
export const LFMultiLineTypeLiteralMembers = LFMultiLine | LFIndented | LFOptionalIfEmpty;
export const LFSingleLineTupleTypeElements = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFMultiLineTupleTypeElements = LFCommaDelimited | LFIndented | LFSpaceBetweenSiblings | LFMultiLine;
export const LFUnionTypeConstituents = LFBarDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFIntersectionTypeConstituents = LFAmpersandDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFObjectBindingPatternElements = LFSingleLine | LFAllowTrailingComma | LFSpaceBetweenBraces | LFCommaDelimited | LFSpaceBetweenSiblings | LFNoSpaceIfEmpty;
export const LFArrayBindingPatternElements = LFSingleLine | LFAllowTrailingComma | LFCommaDelimited | LFSpaceBetweenSiblings | LFNoSpaceIfEmpty;
export const LFObjectLiteralExpressionProperties = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFSpaceBetweenBraces | LFIndented | LFBraces | LFNoSpaceIfEmpty;
export const LFImportAttributes = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFSpaceBetweenBraces | LFIndented | LFBraces | LFNoSpaceIfEmpty;
export const LFArrayLiteralExpressionElements = LFPreserveLines | LFCommaDelimited | LFSpaceBetweenSiblings | LFAllowTrailingComma | LFIndented | LFSquareBrackets;
export const LFCommaListElements = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFCallExpressionArguments = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis;
export const LFNewExpressionArguments = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis | LFOptionalIfNil;
export const LFTemplateExpressionSpans = LFSingleLine | LFNoInterveningComments;
export const LFSingleLineBlockStatements = LFSpaceBetweenBraces | LFSpaceBetweenSiblings | LFSingleLine;
export const LFMultiLineBlockStatements = LFIndented | LFMultiLine;
export const LFVariableDeclarationList = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFSingleLineFunctionBodyStatements = LFSingleLine | LFSpaceBetweenSiblings | LFSpaceBetweenBraces;
export const LFMultiLineFunctionBodyStatements = LFMultiLine;
export const LFClassHeritageClauses = LFSingleLine;
export const LFClassMembers = LFIndented | LFMultiLine;
export const LFInterfaceMembers = LFIndented | LFMultiLine;
export const LFEnumMembers = LFCommaDelimited | LFIndented | LFMultiLine;
export const LFCaseBlockClauses = LFIndented | LFMultiLine;
export const LFNamedImportsOrExportsElements = LFCommaDelimited | LFSpaceBetweenSiblings | LFAllowTrailingComma | LFSingleLine | LFSpaceBetweenBraces | LFNoSpaceIfEmpty;
export const LFJsxElementOrFragmentChildren = LFSingleLine | LFNoInterveningComments;
export const LFJsxElementAttributes = LFSingleLine | LFSpaceBetweenSiblings | LFNoInterveningComments;
export const LFCaseOrDefaultClauseStatements = LFIndented | LFMultiLine | LFNoTrailingNewLine | LFOptionalIfEmpty;
export const LFHeritageClauseTypes = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFSourceFileStatements = LFMultiLine | LFNoTrailingNewLine;
export const LFDecorators = LFMultiLine | LFOptional | LFSpaceAfterList;
export const LFTypeArguments = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFAngleBrackets | LFOptional;
export const LFTypeParameters = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFAngleBrackets | LFOptional;
export const LFParameters = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFParenthesis;
export const LFSingleArrowParameter = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine;
export const LFIndexSignatureParameters = LFCommaDelimited | LFSpaceBetweenSiblings | LFSingleLine | LFIndented | LFSquareBrackets;
export const LFJSDocComment = LFMultiLine | LFAsteriskDelimited;
export const LFImportClauseEntries = LFImportAttributes; // Deprecated: Use LFImportAttributes
//# sourceMappingURL=state.js.map
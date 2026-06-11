import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import { Pool } from "../../../go/sync.js";
import type { CommentRange, Node, Visitor } from "../../ast/ast.js";
import { GetViableKeywordSuggestions } from "../../scanner/scanner.js";
import type { NodeFactory } from "../../ast/ast_generated.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Kind } from "../../ast/kind_generated.js";
import type { NodeFlags } from "../../ast/nodeflags.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import type { Set } from "../../collections/set.js";
import type { Arena } from "../../core/arena.js";
import type { LanguageVariant } from "../../core/languagevariant.js";
import type { ScriptKind } from "../../core/scriptkind.js";
import type { Scanner, ScannerState } from "../../scanner/scanner.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::ParsingContext","kind":"type","status":"implemented","sigHash":"e88bdee551deb9e23eaaefdc2ad9292819b7300308c0bfd185fd7e43395a4285","bodyHash":"845a7f1c8d1b2d145b3d940ab103d6e22ec5fbcb3a99754f98a0cde4ad3acd6a"}
 *
 * Go source:
 * ParsingContext int
 */
export type ParsingContext = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::constGroup::PCSourceElements+PCBlockStatements+PCSwitchClauses+PCSwitchClauseStatements+PCTypeMembers+PCClassMembers+PCEnumMembers+PCHeritageClauseElement+PCVariableDeclarations+PCObjectBindingElements+PCArrayBindingElements+PCArgumentExpressions+PCObjectLiteralMembers+PCJsxAttributes+PCJsxChildren+PCArrayLiteralMembers+PCParameters+PCJSDocParameters+PCRestProperties+PCTypeParameters+PCTypeArguments+PCTupleElementTypes+PCHeritageClauses+PCImportOrExportSpecifiers+PCImportAttributes+PCJSDocComment+PCCount","kind":"constGroup","status":"implemented","sigHash":"900e957e72cd3984a7992b56c31999ec071760458e11fba1b36a351032dbe95c","bodyHash":"69b9ea5ba14c1e06c5e9ea047cf779e518ef85cadb2d1394e1c90951b876cbaf"}
 *
 * Go source:
 * const (
 * 	PCSourceElements           ParsingContext = iota // Elements in source file
 * 	PCBlockStatements                                // Statements in block
 * 	PCSwitchClauses                                  // Clauses in switch statement
 * 	PCSwitchClauseStatements                         // Statements in switch clause
 * 	PCTypeMembers                                    // Members in interface or type literal
 * 	PCClassMembers                                   // Members in class declaration
 * 	PCEnumMembers                                    // Members in enum declaration
 * 	PCHeritageClauseElement                          // Elements in a heritage clause
 * 	PCVariableDeclarations                           // Variable declarations in variable statement
 * 	PCObjectBindingElements                          // Binding elements in object binding list
 * 	PCArrayBindingElements                           // Binding elements in array binding list
 * 	PCArgumentExpressions                            // Expressions in argument list
 * 	PCObjectLiteralMembers                           // Members in object literal
 * 	PCJsxAttributes                                  // Attributes in jsx element
 * 	PCJsxChildren                                    // Things between opening and closing JSX tags
 * 	PCArrayLiteralMembers                            // Members in array literal
 * 	PCParameters                                     // Parameters in parameter list
 * 	PCJSDocParameters                                // JSDoc parameters in parameter list of JSDoc function type
 * 	PCRestProperties                                 // Property names in a rest type list
 * 	PCTypeParameters                                 // Type parameters in type parameter list
 * 	PCTypeArguments                                  // Type arguments in type argument list
 * 	PCTupleElementTypes                              // Element types in tuple element type list
 * 	PCHeritageClauses                                // Heritage clauses for a class or interface declaration.
 * 	PCImportOrExportSpecifiers                       // Named import clause's import specifier list
 * 	PCImportAttributes                               // Import attributes
 * 	PCJSDocComment                                   // Parsing via JSDocParser
 * 	PCCount                                          // Number of parsing contexts
 * )
 */
export const PCSourceElements: ParsingContext = 0;
export const PCBlockStatements: ParsingContext = 1;
export const PCSwitchClauses: ParsingContext = 2;
export const PCSwitchClauseStatements: ParsingContext = 3;
export const PCTypeMembers: ParsingContext = 4;
export const PCClassMembers: ParsingContext = 5;
export const PCEnumMembers: ParsingContext = 6;
export const PCHeritageClauseElement: ParsingContext = 7;
export const PCVariableDeclarations: ParsingContext = 8;
export const PCObjectBindingElements: ParsingContext = 9;
export const PCArrayBindingElements: ParsingContext = 10;
export const PCArgumentExpressions: ParsingContext = 11;
export const PCObjectLiteralMembers: ParsingContext = 12;
export const PCJsxAttributes: ParsingContext = 13;
export const PCJsxChildren: ParsingContext = 14;
export const PCArrayLiteralMembers: ParsingContext = 15;
export const PCParameters: ParsingContext = 16;
export const PCJSDocParameters: ParsingContext = 17;
export const PCRestProperties: ParsingContext = 18;
export const PCTypeParameters: ParsingContext = 19;
export const PCTypeArguments: ParsingContext = 20;
export const PCTupleElementTypes: ParsingContext = 21;
export const PCHeritageClauses: ParsingContext = 22;
export const PCImportOrExportSpecifiers: ParsingContext = 23;
export const PCImportAttributes: ParsingContext = 24;
export const PCJSDocComment: ParsingContext = 25;
export const PCCount: ParsingContext = 26;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::ParsingContexts","kind":"type","status":"implemented","sigHash":"c468153d6bb0378231a600b2e44e401e5114b196946dde4f3f83babed3dd9801","bodyHash":"c574d14c23b3dda30ebaa1471372035fc2d1650a1dc4409d910d9f9cdd86cf18"}
 *
 * Go source:
 * ParsingContexts int
 */
export type ParsingContexts = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::JSDocInfo","kind":"type","status":"implemented","sigHash":"b77c76f5edccfb1bc1347acde568f704c148259bc8dba3eacc5ce3746936cc32","bodyHash":"a0f4b3a151e1949feb1bb23c8b999133cdbb1a3730b0b28415f31041d1c90d70"}
 *
 * Go source:
 * JSDocInfo struct {
 * 	parent *ast.Node
 * 	jsDocs []*ast.Node
 * }
 */
export interface JSDocInfo {
  parent: GoPtr<Node>;
  jsDocs: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::jsdocScannerInfo","kind":"type","status":"implemented","sigHash":"4421a424d91aa770a82e0a72fa6623e2d16f44a60a53d0b1d58b69f6469c13c5","bodyHash":"58afd9558905019b14087fb82ab69d2e16052ceee5b4c6ead6276e4d545162a9"}
 *
 * Go source:
 * jsdocScannerInfo uint8
 */
export type jsdocScannerInfo = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::constGroup::jsdocScannerInfoHasJSDoc+jsdocScannerInfoHasDeprecated+jsdocScannerInfoHasSeeOrLink","kind":"constGroup","status":"implemented","sigHash":"d14440342472ed6adc2d373a946cf2a97fee5fba89872009af0d4c1833534940","bodyHash":"ee85d5f63665fdedd428d310ca7e9eb181f950adf35db021c47a40e40a430894"}
 *
 * Go source:
 * const (
 * 	jsdocScannerInfoHasJSDoc jsdocScannerInfo = 1 << iota
 * 	jsdocScannerInfoHasDeprecated
 * 	jsdocScannerInfoHasSeeOrLink
 * )
 */
export const jsdocScannerInfoHasJSDoc: jsdocScannerInfo = 1;
export const jsdocScannerInfoHasDeprecated: jsdocScannerInfo = 2;
export const jsdocScannerInfoHasSeeOrLink: jsdocScannerInfo = 4;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::Parser","kind":"type","status":"implemented","sigHash":"d25d17b76edf1f29b54bd46ca5698d0b96cbbc0685128f1fd874acbf41ca1522","bodyHash":"7e6d3838c46da994bf718f818ace10cf31a6fa6d76d03a58cbf790dc1836b378"}
 *
 * Go source:
 * Parser struct {
 * 	scanner *scanner.Scanner
 * 	factory ast.NodeFactory
 * 
 * 	opts       ast.SourceFileParseOptions
 * 	sourceText string
 * 
 * 	scriptKind       core.ScriptKind
 * 	languageVariant  core.LanguageVariant
 * 	diagnostics      []*ast.Diagnostic
 * 	jsDiagnostics    []*ast.Diagnostic
 * 	jsdocDiagnostics []*ast.Diagnostic
 * 
 * 	token                       ast.Kind
 * 	sourceFlags                 ast.NodeFlags
 * 	contextFlags                ast.NodeFlags
 * 	parsingContexts             ParsingContexts
 * 	statementHasAwaitIdentifier bool
 * 	hasDeprecatedTag            bool
 * 	hasParseError               bool
 * 
 * 	identifiers                map[string]string
 * 	identifierCount            int
 * 	notParenthesizedArrow      collections.Set[int]
 * 	nodeSliceArena             core.Arena[*ast.Node]
 * 	stringSliceArena           core.Arena[string]
 * 	jsdocInfos                 []JSDocInfo
 * 	possibleAwaitSpans         []int
 * 	jsdocCommentsSpace         []string
 * 	jsdocCommentRangesSpace    []ast.CommentRange
 * 	jsdocTagCommentsSpace      []string
 * 	jsdocTagCommentsPartsSpace []*ast.Node
 * 	reparseList                []*ast.Node
 * 	commonJSModuleIndicator    *ast.Node
 * 
 * 	currentParent        *ast.Node
 * 	setParentFromContext ast.Visitor
 * 	reparsedClones       []*ast.Node
 * }
 */
export interface Parser {
  scanner: GoPtr<Scanner>;
  factory: NodeFactory;
  opts: SourceFileParseOptions;
  sourceText: string;
  scriptKind: ScriptKind;
  languageVariant: LanguageVariant;
  diagnostics: GoSlice<GoPtr<Diagnostic>>;
  jsDiagnostics: GoSlice<GoPtr<Diagnostic>>;
  jsdocDiagnostics: GoSlice<GoPtr<Diagnostic>>;
  token: Kind;
  sourceFlags: NodeFlags;
  contextFlags: NodeFlags;
  parsingContexts: ParsingContexts;
  statementHasAwaitIdentifier: bool;
  hasDeprecatedTag: bool;
  hasParseError: bool;
  identifiers: GoMap<string, string>;
  identifierCount: int;
  notParenthesizedArrow: Set;
  nodeSliceArena: Arena;
  stringSliceArena: Arena;
  jsdocInfos: GoSlice<JSDocInfo>;
  possibleAwaitSpans: GoSlice<int>;
  jsdocCommentsSpace: GoSlice<string>;
  jsdocCommentRangesSpace: GoSlice<CommentRange>;
  jsdocTagCommentsSpace: GoSlice<string>;
  jsdocTagCommentsPartsSpace: GoSlice<GoPtr<Node>>;
  reparseList: GoSlice<GoPtr<Node>>;
  commonJSModuleIndicator: GoPtr<Node>;
  currentParent: GoPtr<Node>;
  setParentFromContext: Visitor;
  reparsedClones: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::viableKeywordSuggestions","kind":"varGroup","status":"implemented","sigHash":"e6cd9371f5ed1b7ffeb2afe3c4c687857686b87a2334d143781443ef765894fb","bodyHash":"24d8dd10485a771c72881ee15a22d6a710b3f7035df48a1f9bf373f03101c58a"}
 *
 * Go source:
 * var viableKeywordSuggestions = scanner.GetViableKeywordSuggestions()
 */
export const viableKeywordSuggestions: GoSlice<string> = GetViableKeywordSuggestions();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::missingListNodes","kind":"varGroup","status":"implemented","sigHash":"d1c5395ca57bcb64c4b3e14d6d59605996440705ff57277a51696d4a8f0480be","bodyHash":"024eaa2a7207faca3efc65b264855dcb1504006bb6eaa8a7d7cf14c4f406787c"}
 *
 * Go source:
 * var missingListNodes = make([]*ast.Node, 0, 1)
 */
export const missingListNodes: GoSlice<GoPtr<Node>> = [];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::parserPool","kind":"varGroup","status":"implemented","sigHash":"3fdc1286c48fa725161e8fd006c829b0d622c73db48a098be9f4f16883c2048e","bodyHash":"85c58e7891de25ca6c28a36cd456c6b0c6075aa9f16595f69f02bfe65b48dae3"}
 *
 * Go source:
 * var parserPool = sync.Pool{
 * 	New: func() any {
 * 		return newParser()
 * 	},
 * }
 */
export const parserPool: Pool<Parser> = new Pool<Parser>();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::type::ParserState","kind":"type","status":"implemented","sigHash":"398a9313b037dfc819ac14636817daed6e0ee86b0e916701d82f4cc1a2715093","bodyHash":"98dab43fce32aad622b8188552a07d113352b087ba76d29cfd982ebe28fee5d3"}
 *
 * Go source:
 * ParserState struct {
 * 	scannerState                scanner.ScannerState
 * 	contextFlags                ast.NodeFlags
 * 	diagnosticsLen              int
 * 	jsDiagnosticsLen            int
 * 	jsdocInfosLen               int
 * 	reparsedClonesLen           int
 * 	statementHasAwaitIdentifier bool
 * 	hasParseError               bool
 * }
 */
export interface ParserState {
  scannerState: ScannerState;
  contextFlags: NodeFlags;
  diagnosticsLen: int;
  jsDiagnosticsLen: int;
  jsdocInfosLen: int;
  reparsedClonesLen: int;
  statementHasAwaitIdentifier: bool;
  hasParseError: bool;
}

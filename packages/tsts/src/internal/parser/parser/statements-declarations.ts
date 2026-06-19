import type { bool, int } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import { Clone, SortFunc, Values } from "../../../go/slices.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindAbstractKeyword,
  KindAccessorKeyword,
  KindAsKeyword,
  KindAssertKeyword,
  KindAsteriskToken,
  KindAsyncKeyword,
  KindAtToken,
  KindAwaitKeyword,
  KindBigIntLiteral,
  KindBreakKeyword,
  KindCatchKeyword,
  KindClassDeclaration,
  KindClassKeyword,
  KindCloseBraceToken,
  KindCloseParenToken,
  KindColonToken,
  KindCommaToken,
  KindConstKeyword,
  KindConstructorKeyword,
  KindContinueKeyword,
  KindDebuggerKeyword,
  KindDeclareKeyword,
  KindDeferKeyword,
  KindDefaultKeyword,
  KindDoKeyword,
  KindDotToken,
  KindElseKeyword,
  KindEndOfFile,
  KindEnumKeyword,
  KindEqualsToken,
  KindExclamationToken,
  KindExportKeyword,
  KindExportSpecifier,
  KindFinallyKeyword,
  KindForKeyword,
  KindFromKeyword,
  KindFunctionKeyword,
  KindGetKeyword,
  KindGetAccessor,
  KindGlobalKeyword,
  KindIdentifier,
  KindIfKeyword,
  KindImportKeyword,
  KindImportSpecifier,
  KindInKeyword,
  KindInterfaceKeyword,
  KindLessThanToken,
  KindLetKeyword,
  KindModuleKeyword,
  KindNamespaceKeyword,
  KindNumericLiteral,
  KindOfKeyword,
  KindCloseBracketToken,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindPrivateIdentifier,
  KindPrivateKeyword,
  KindProtectedKeyword,
  KindPublicKeyword,
  KindQuestionToken,
  KindReadonlyKeyword,
  KindRequireKeyword,
  KindReturnKeyword,
  KindSemicolonToken,
  KindSetKeyword,
  KindSetAccessor,
  KindStaticKeyword,
  KindStringLiteral,
  KindSwitchKeyword,
  KindTaggedTemplateExpression,
  KindThrowKeyword,
  KindTryKeyword,
  KindTypeKeyword,
  KindUnknown,
  KindUsingKeyword,
  KindVarKeyword,
  KindWhileKeyword,
  KindWithKeyword,
  KindForOfStatement,
  KindForInStatement,
} from "../../ast/generated/kinds.js";
import type { NodeFlags } from "../../ast/generated/flags.js";
import {
  NodeFlagsAmbient,
  NodeFlagsAwaitContext,
  NodeFlagsDisallowInContext,
  NodeFlagsInWithStatement,
  NodeFlagsThisNodeHasError,
  NodeFlagsYieldContext,
  NodeFlagsDecoratorContext,
  NodeFlagsNone,
  NodeFlagsLet,
  NodeFlagsConst,
  NodeFlagsUsing,
  NodeFlagsAwaitUsing,
  NodeFlagsReparsed,
} from "../../ast/generated/flags.js";
import {
  ModifierFlagsAsync,
  ModifierFlagsDefault,
  ModifierFlagsExport,
} from "../../ast/modifierflags.js";
import { TokenFlagsSingleQuote } from "../../ast/tokenflags.js";
import type { NodeFactory } from "../../ast/generated/factory.js";
import {
  NewBlock,
  NewBreakStatement,
  NewCaseBlock,
  NewCatchClause,
  NewClassStaticBlockDeclaration,
  NewConstructorDeclaration,
  NewContinueStatement,
  NewDebuggerStatement,
  NewDoStatement,
  NewEmptyStatement,
  NewEnumDeclaration,
  NewExportAssignment,
  NewExportDeclaration,
  NewExportSpecifier,
  NewExternalModuleReference,
  NewForInOrOfStatement,
  NewForStatement,
  NewFunctionDeclaration,
  NewGetAccessorDeclaration,
  NewIfStatement,
  NewImportAttribute,
  NewImportAttributes,
  NewImportClause,
  NewImportDeclaration,
  NewImportEqualsDeclaration,
  NewImportSpecifier,
  NewIndexSignatureDeclaration,
  NewInterfaceDeclaration,
  NewMethodDeclaration,
  NewMissingDeclaration,
  NewModuleBlock,
  NewModuleDeclaration,
  NewNamedExports,
  NewNamedImports,
  NewNamespaceExport,
  NewNamespaceExportDeclaration,
  NewNamespaceImport,
  NewPropertyDeclaration,
  NewReturnStatement,
  NewSemicolonClassElement,
  NewSetAccessorDeclaration,
  NewSwitchStatement,
  NewThrowStatement,
  NewTryStatement,
  NewVariableDeclaration,
  NewVariableDeclarationList,
  NewVariableStatement,
  NewWhileStatement,
  NewWithStatement,
} from "../../ast/generated/factory.js";
import { AsStringLiteral, AsTaggedTemplateExpression } from "../../ast/generated/casts.js";
import { IsStringLiteral } from "../../ast/generated/predicates.js";
import type { Expression, ForInitializer, Statement, TokenNode } from "../../ast/generated/unions.js";
import { Node_Pos, Node_End } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import { Some, IfElse } from "../../core/core.js";
import type { ScriptKind } from "../../core/scriptkind.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange } from "../../core/text.js";
import { Arena_NewSlice1 } from "../../core/arena.js";
import type { Arena } from "../../core/arena.js";
import { GetSpellingSuggestionForStrings } from "../../core/core.js";
import * as diagnostics from "../../diagnostics/generated/messages.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import { Message_Code } from "../../diagnostics/diagnostics.js";
import { NewDiagnostic, Diagnostic_AddRelatedInfo, Diagnostic_Code } from "../../ast/diagnostic.js";
import {
  SourceFile_SetDiagnostics,
  SourceFile_SetJSDocDiagnostics,
  SourceFile_SetJSDiagnostics,
  SourceFile_SetJSDocCache,
  SourceFile_SetHasLazyJSDoc,
  NodeFactory_NewModifier,
  NodeFactory_NewSourceFile,
  AsSourceFile,
  Node_Text,
} from "../../ast/ast.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { NodeFactory_NodeCount, NodeFactory_TextCount } from "../../ast/spine.js";
import { IsKeyword, IsInJSFile, CompareNodePositions } from "../../ast/utilities.js";
import { SetExternalModuleIndicator } from "../../ast/parseoptions.js";
import { IsDeclarationFileName } from "../../tspath/extension.js";
import { ScriptKindJSON } from "../../core/scriptkind.js";
import { collectExternalModuleReferences } from "../references.js";
import {
  SkipTrivia,
  TokenToString,
  Scanner_Scan,
  Scanner_HasPrecedingLineBreak,
  Scanner_TokenStart,
  Scanner_TokenValue,
  Scanner_SetSkipJSDocLeadingAsterisks,
  Scanner_HasPrecedingJSDocLeadingAsterisks,
  Scanner_TokenFullStart,
  Scanner_TokenText,
  Scanner_CommentDirectives,
  Scanner_ContainsNonASCII,
} from "../../scanner/scanner.js";
import { tokenIsIdentifierOrKeyword } from "../utilities.js";
import type { ParseFlags } from "../types.js";
import {
  ParseFlagsNone,
  ParseFlagsYield,
  ParseFlagsAwait,
  ParseFlagsType,
  ParseFlagsIgnoreMissingOpenBrace,
} from "../types.js";
import { Parser_withJSDoc } from "../jsdoc.js";
import type { jsdocScannerInfo, Parser } from "./state.js";
import {
  PCBlockStatements,
  PCClassMembers,
  PCEnumMembers,
  PCImportAttributes,
  PCImportOrExportSpecifiers,
  PCParameters,
  PCSourceElements,
  PCSwitchClauses,
  PCVariableDeclarations,
  viableKeywordSuggestions,
} from "./state.js";
import {
  Parser_canParseSemicolon,
  Parser_finishNode,
  Parser_initializeState,
  Parser_isIndexSignature,
  Parser_isJavaScript,
  Parser_lookAhead,
  Parser_nodePos,
  Parser_parseCaseOrDefaultClause,
  Parser_parseEntityName,
  Parser_parseInitializer,
  Parser_parseJSONText,
  Parser_parseModifiersEx,
  Parser_parseOptional,
  Parser_parseParameter,
  Parser_parsePropertyName,
  Parser_parseSemicolonAfterPropertyName,
  Parser_parseSemicolon,
  Parser_checkJSSyntax,
  Parser_tryParseSemicolon,
  Parser_mark,
  Parser_rewind,
  Parser_canFollowModifier,
  Parser_overrideParentInImmediateChildren,
  getCommentPragmas,
  getParser,
  getSpaceSuggestion,
  isDeclareModifier,
  isReservedWord,
  Parser_processPragmasIntoFields,
  putParser,
} from "./support.js";
import {
  Parser_parseAssignmentExpressionOrHigher,
  Parser_parseExpression,
  Parser_parseExpressionAllowIn,
  Parser_parseExpressionOrLabeledStatement,
  Parser_parseLiteralExpression,
  Parser_isAwaitUsingDeclaration,
  Parser_nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine,
  Parser_nextTokenIsIdentifierOrStringLiteralOnSameLine,
  Parser_parseClassDeclarationOrExpression,
  Parser_parseArrayBindingPattern,
  Parser_parseObjectBindingPattern,
  Parser_parseEnumMember,
  Parser_isStartOfExpression,
  Parser_nextTokenIsTokenStringLiteral,
  Parser_reparseTopLevelAwait,
} from "./expressions.js";
import {
  Parser_createMissingIdentifier,
  Parser_isBindingIdentifier,
  Parser_isIdentifier,
  Parser_parseContextualModifier,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpected,
  Parser_parseExpectedMatchingBrackets,
  Parser_parseExpectedToken,
  Parser_parseOptionalToken,
  Parser_parseTokenNode,
  Parser_nextToken,
  doInContext,
  Parser_nextTokenIsBindingIdentifierOrStartOfDestructuring,
  Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf,
  Parser_nextIsIdentifierAndCloseParen,
  Parser_nextTokenIsOpenBrace,
  Parser_nextTokenIsOpenParen,
  Parser_nextTokenIsIdentifierOrKeywordOnSameLine,
  Parser_nextTokenIsIdentifierOnSameLine,
  Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine,
  Parser_parseBindingIdentifier,
  Parser_parseIdentifier,
  Parser_parseIdentifierName,
  Parser_parsePrivateIdentifier,
  Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence,
  Parser_newIdentifier,
  Parser_internIdentifier,
  Parser_createIdentifier,
  Parser_jsdocScannerInfo,
  Parser_skipRangeTrivia,
  Parser_setContextFlags,
  Parser_parseIdentifierUnlessAtSemicolon,
  Parser_nextTokenIsFromKeywordOrEqualsToken,
} from "./tokens-speculation.js";
import { Parser_parseErrorAt, attachFileToDiagnostics, Parser_parseErrorAtRange } from "./errors-recovery.js";
import {
  Parser_parseList,
  Parser_parseListIndex,
  Parser_parseDelimitedList,
  Parser_parseBracketedList,
  Parser_parseParameters,
  Parser_createMissingList,
  Parser_parseEmptyNodeList,
  modifierListHasAsync,
  Parser_newModifierList,
  Parser_newNodeList,
} from "./lists.js";
import {
  Parser_parseTypeParameters,
  Parser_parseTypeAnnotation,
  Parser_parseReturnType,
  Parser_parseTypeMemberSemicolon,
  Parser_parseHeritageClauses,
  Parser_parseObjectTypeMembers,
  Parser_parseTypeAliasDeclaration,
} from "./types.js";
import { Parser_createJSDocCache } from "./jsx-jsdoc.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::ParseSourceFile","kind":"func","status":"implemented","sigHash":"31f36166c647dbc2dee9793ebd53865364ccab4ac720b10f9e5098b59de22987","bodyHash":"e28cb8452ba15924af7ce7dcd5f32a5414e3a35e32d73f694bf230b5a32a2bd9"}
 *
 * Go source:
 * func ParseSourceFile(opts ast.SourceFileParseOptions, sourceText string, scriptKind core.ScriptKind) *ast.SourceFile {
 * 	p := getParser()
 * 	defer putParser(p)
 * 	p.initializeState(opts, sourceText, scriptKind)
 * 	p.nextToken()
 * 	if p.scriptKind == core.ScriptKindJSON {
 * 		return p.parseJSONText()
 * 	}
 * 	return p.parseSourceFileWorker()
 * }
 */
export function ParseSourceFile(opts: SourceFileParseOptions, sourceText: string, scriptKind: ScriptKind): GoPtr<SourceFile> {
  const p = getParser();
  try {
    Parser_initializeState(p, opts, sourceText, scriptKind);
    Parser_nextToken(p);
    if (p!.scriptKind === ScriptKindJSON) {
      return Parser_parseJSONText(p);
    }
    return Parser_parseSourceFileWorker(p);
  } finally {
    putParser(p);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::getErrorSpanForNode","kind":"func","status":"implemented","sigHash":"f5f8e618b5ac1c2bf3ae3bad9a3623b3c111cc0ae18cffc9d26cc5132d1b06f6","bodyHash":"3cde1799c931135d92ab0056a78223ab5963eeb92e43954c4a01eab941ec02ba"}
 *
 * Go source:
 * func getErrorSpanForNode(sourceText string, node *ast.Node) core.TextRange {
 * 	pos := scanner.SkipTrivia(sourceText, node.Pos())
 * 	return core.NewTextRange(pos, node.End())
 * }
 */
export function getErrorSpanForNode(sourceText: string, node: GoPtr<Node>): TextRange {
  const pos = SkipTrivia(sourceText, Node_Pos(node));
  return NewTextRange(pos, Node_End(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isDoubleQuotedString","kind":"func","status":"implemented","sigHash":"f288a4eaaa47832cb4a305a26c780d5fd0a69928e6296b797c49d3034735b48a","bodyHash":"d8544894bfa3af8c8b1fc04f38a4ccbc28705e35818e72874ca49cbfe3822243"}
 *
 * Go source:
 * func isDoubleQuotedString(node *ast.Node) bool {
 * 	return ast.IsStringLiteral(node) && node.AsStringLiteral().TokenFlags&ast.TokenFlagsSingleQuote == 0
 * }
 */
export function isDoubleQuotedString(node: GoPtr<Node>): bool {
  return IsStringLiteral(node) && (AsStringLiteral(node)!.TokenFlags & TokenFlagsSingleQuote) === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenWithoutCheck","kind":"method","status":"implemented","sigHash":"641829d00258c3f52a73c3ea043b55c7b615a1a9aea04397ce01a88065554712","bodyHash":"baca6b83bf5886860d5c3c7fc71d569ab5055e37cb84f9c46b938668593ce2fc"}
 *
 * Go source:
 * func (p *Parser) nextTokenWithoutCheck() ast.Kind {
 * 	p.token = p.scanner.Scan()
 * 	return p.token
 * }
 */
export function Parser_nextTokenWithoutCheck(receiver: GoPtr<Parser>): Kind {
  receiver!.token = Scanner_Scan(receiver!.scanner);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.hasPrecedingLineBreak","kind":"method","status":"implemented","sigHash":"8b739ea576d4a769a34213e32f9e9dbf462dc63ddbae85cc3ea7c45902d03e10","bodyHash":"2219cece8089f887c0cc1bf1b1845d1b0bcc1034a55a23f8b9fad8a4a5daffcb"}
 *
 * Go source:
 * func (p *Parser) hasPrecedingLineBreak() bool {
 * 	return p.scanner.HasPrecedingLineBreak()
 * }
 */
export function Parser_hasPrecedingLineBreak(receiver: GoPtr<Parser>): bool {
  return Scanner_HasPrecedingLineBreak(receiver!.scanner);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSourceFileWorker","kind":"method","status":"implemented","sigHash":"96a083000013897269103663af94fa2be65d975e84a36a3cac0e0f404dc0993f","bodyHash":"58e6286f13cd60ada2143f8a0b0ae10fa1298b9754e73746c6f31a8299619ebb"}
 *
 * Go source:
 * func (p *Parser) parseSourceFileWorker() *ast.SourceFile {
 * 	isDeclarationFile := tspath.IsDeclarationFileName(p.opts.FileName)
 * 	if isDeclarationFile {
 * 		p.contextFlags |= ast.NodeFlagsAmbient
 * 	}
 * 	pos := p.nodePos()
 * 	statements := p.parseListIndex(PCSourceElements, (*Parser).parseToplevelStatement)
 * 	end := p.nodePos()
 * 	endJSDoc := p.jsdocScannerInfo()
 * 	eof := p.parseTokenNode()
 * 	p.withJSDoc(eof, endJSDoc)
 * 	if eof.Kind != ast.KindEndOfFile {
 * 		panic("Expected end of file token from scanner.")
 * 	}
 * 	if len(p.reparseList) != 0 {
 * 		statements = append(statements, p.reparseList...)
 * 		p.reparseList = nil
 * 	}
 * 	node := p.finishNode(p.factory.NewSourceFile(p.opts, p.sourceText, p.newNodeList(core.NewTextRange(pos, end), statements), eof), pos)
 * 	result := node.AsSourceFile()
 * 	p.finishSourceFile(result, isDeclarationFile)
 * 	if !result.IsDeclarationFile && result.ExternalModuleIndicator != nil && len(p.possibleAwaitSpans) > 0 {
 * 		reparse := p.finishNode(p.reparseTopLevelAwait(result), pos)
 * 		if node != reparse {
 * 			result = reparse.AsSourceFile()
 * 			p.finishSourceFile(result, isDeclarationFile)
 * 		}
 * 	}
 * 	collectExternalModuleReferences(result)
 * 	if ast.IsInJSFile(node) {
 * 		result.SetJSDiagnostics(attachFileToDiagnostics(p.jsDiagnostics, result))
 * 	}
 * 	return result
 * }
 */
export function Parser_parseSourceFileWorker(receiver: GoPtr<Parser>): GoPtr<SourceFile> {
  const isDeclarationFile = IsDeclarationFileName(receiver!.opts!.FileName);
  if (isDeclarationFile) {
    receiver!.contextFlags |= NodeFlagsAmbient;
  }
  const pos = Parser_nodePos(receiver);
  let statements = Parser_parseListIndex(receiver, PCSourceElements, Parser_parseToplevelStatement);
  const end = Parser_nodePos(receiver);
  const endJSDoc = Parser_jsdocScannerInfo(receiver);
  const eof = Parser_parseTokenNode(receiver) as GoPtr<TokenNode>;
  Parser_withJSDoc(receiver, eof, endJSDoc);
  if (eof!.Kind !== KindEndOfFile) {
    throw new globalThis.Error("Expected end of file token from scanner.");
  }
  if (receiver!.reparseList.length !== 0) {
    statements = [...statements, ...receiver!.reparseList];
    receiver!.reparseList = [];
  }
  const node = Parser_finishNode(receiver, NodeFactory_NewSourceFile(receiver!.factory, receiver!.opts!, receiver!.sourceText, Parser_newNodeList(receiver, NewTextRange(pos, end), statements), eof), pos);
  let result = AsSourceFile(node);
  Parser_finishSourceFile(receiver, result, isDeclarationFile);
  if (!result!.IsDeclarationFile && result!.ExternalModuleIndicator !== undefined && receiver!.possibleAwaitSpans.length > 0) {
    const reparse = Parser_finishNode(receiver, Parser_reparseTopLevelAwait(receiver, result), pos);
    if (node !== reparse) {
      result = AsSourceFile(reparse);
      Parser_finishSourceFile(receiver, result, isDeclarationFile);
    }
  }
  collectExternalModuleReferences(result);
  if (IsInJSFile(node)) {
    SourceFile_SetJSDiagnostics(result, attachFileToDiagnostics(receiver!.jsDiagnostics, result));
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.finishSourceFile","kind":"method","status":"implemented","sigHash":"1eb9204e2181d19cbd13fd97fa97570987ac34936c87b268cee8402807f4c0e5","bodyHash":"27dad47bd9df611fdc2ea8853a0d3b498af7ff22d4ccaab0c36ff9fffe44910f"}
 *
 * Go source:
 * func (p *Parser) finishSourceFile(result *ast.SourceFile, isDeclarationFile bool) {
 * 	result.CommentDirectives = p.scanner.CommentDirectives()
 * 	result.Pragmas = getCommentPragmas(&p.factory, p.sourceText)
 * 	p.processPragmasIntoFields(result)
 * 	result.SetDiagnostics(attachFileToDiagnostics(p.diagnostics, result))
 * 	result.SetJSDocDiagnostics(attachFileToDiagnostics(p.jsdocDiagnostics, result))
 * 	result.CommonJSModuleIndicator = p.commonJSModuleIndicator
 * 	result.IsDeclarationFile = isDeclarationFile
 * 	result.ContainsNonASCII = p.scanner.ContainsNonASCII()
 * 	result.LanguageVariant = p.languageVariant
 * 	result.ScriptKind = p.scriptKind
 * 	result.Flags |= p.sourceFlags
 * 	result.Identifiers = p.identifiers
 * 	result.NodeCount = p.factory.NodeCount()
 * 	result.TextCount = p.factory.TextCount()
 * 	result.IdentifierCount = p.identifierCount
 * 	result.SetJSDocCache(p.createJSDocCache())
 * 	// For non-JS files, enable lazy JSDoc parsing on demand
 * 	if !p.isJavaScript() {
 * 		result.SetHasLazyJSDoc(true)
 * 	}
 * 	slices.SortFunc(p.reparsedClones, ast.CompareNodePositions)
 * 	result.ReparsedClones = slices.Clone(p.reparsedClones)
 * 	ast.SetExternalModuleIndicator(result, p.opts.ExternalModuleIndicatorOptions)
 * }
 */
export function Parser_finishSourceFile(receiver: GoPtr<Parser>, result: GoPtr<SourceFile>, isDeclarationFile: bool): void {
  result!.CommentDirectives = Scanner_CommentDirectives(receiver!.scanner);
  result!.Pragmas = getCommentPragmas(receiver!.factory, receiver!.sourceText);
  Parser_processPragmasIntoFields(receiver, result);
  SourceFile_SetDiagnostics(result, attachFileToDiagnostics(receiver!.diagnostics, result));
  SourceFile_SetJSDocDiagnostics(result, attachFileToDiagnostics(receiver!.jsdocDiagnostics, result));
  result!.CommonJSModuleIndicator = receiver!.commonJSModuleIndicator;
  result!.IsDeclarationFile = isDeclarationFile;
  result!.ContainsNonASCII = Scanner_ContainsNonASCII(receiver!.scanner);
  result!.LanguageVariant = receiver!.languageVariant;
  result!.ScriptKind = receiver!.scriptKind;
  result!.Flags |= receiver!.sourceFlags;
  result!.Identifiers = receiver!.identifiers;
  result!.NodeCount = NodeFactory_NodeCount(receiver!.factory);
  result!.TextCount = NodeFactory_TextCount(receiver!.factory);
  result!.IdentifierCount = receiver!.identifierCount;
  SourceFile_SetJSDocCache(result, Parser_createJSDocCache(receiver) as GoMap<GoPtr<Node>, GoSlice<GoPtr<Node>>>);
  // For non-JS files, enable lazy JSDoc parsing on demand
  if (!Parser_isJavaScript(receiver)) {
    SourceFile_SetHasLazyJSDoc(result, true);
  }
  SortFunc(receiver!.reparsedClones, CompareNodePositions);
  result!.ReparsedClones = Clone(receiver!.reparsedClones)!;
  SetExternalModuleIndicator(result, receiver!.opts!.ExternalModuleIndicatorOptions ?? { JSX: false, Force: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseToplevelStatement","kind":"method","status":"implemented","sigHash":"83949e4347aa1b3b88fe6d6dc1425840fc963911952aa2b0d7bd1aa7b1537d60","bodyHash":"899f4d1c4ee32a69da56fd932d90ef4d824e93263770776cbb8f7ca6f565cf9c"}
 *
 * Go source:
 * func (p *Parser) parseToplevelStatement(i int) *ast.Node {
 * 	p.statementHasAwaitIdentifier = false
 * 	statement := p.parseStatement()
 * 	// Reparsed nodes (e.g. JSDoc @typedef) produced while parsing this statement are inserted
 * 	// into the statement list before this statement, so account for them when recording the
 * 	// statement's index for possibleAwaitSpans.
 * 	i += len(p.reparseList)
 * 	if p.statementHasAwaitIdentifier && statement.Flags&ast.NodeFlagsAwaitContext == 0 {
 * 		if len(p.possibleAwaitSpans) == 0 || p.possibleAwaitSpans[len(p.possibleAwaitSpans)-1] != i {
 * 			p.possibleAwaitSpans = append(p.possibleAwaitSpans, i, i+1)
 * 		} else {
 * 			p.possibleAwaitSpans[len(p.possibleAwaitSpans)-1] = i + 1
 * 		}
 * 	}
 * 	return statement
 * }
 */
export function Parser_parseToplevelStatement(receiver: GoPtr<Parser>, i: int): GoPtr<Node> {
  receiver!.statementHasAwaitIdentifier = false;
  const statement = Parser_parseStatement(receiver);
  // Reparsed nodes (e.g. JSDoc @typedef) produced while parsing this statement are inserted
  // into the statement list before this statement, so account for them when recording the
  // statement's index for possibleAwaitSpans.
  i += receiver!.reparseList.length;
  if (receiver!.statementHasAwaitIdentifier && (statement!.Flags & NodeFlagsAwaitContext) === 0) {
    if (receiver!.possibleAwaitSpans.length === 0 || receiver!.possibleAwaitSpans[receiver!.possibleAwaitSpans.length - 1] !== i) {
      receiver!.possibleAwaitSpans.push(i, i + 1);
    } else {
      receiver!.possibleAwaitSpans[receiver!.possibleAwaitSpans.length - 1] = i + 1;
    }
  }
  return statement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedWithoutAdvancing","kind":"method","status":"implemented","sigHash":"2c1f6ed3496f571ec3061cf6f1be2fc5da7c8758b816f888110ccf86074edad6","bodyHash":"95a1e59b879c33aee469d84826e3876d4463f6c694f648763da7bae9aa505354"}
 *
 * Go source:
 * func (p *Parser) parseExpectedWithoutAdvancing(kind ast.Kind) bool {
 * 	return p.parseExpectedWithDiagnostic(kind, nil, false)
 * }
 */
export function Parser_parseExpectedWithoutAdvancing(receiver: GoPtr<Parser>, kind: Kind): bool {
  return Parser_parseExpectedWithDiagnostic(receiver, kind, undefined, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedWithDiagnostic","kind":"method","status":"implemented","sigHash":"88589079045ef39ae616faaaf8b2187441a49b19c95ec8fd09d69a13dafb0768","bodyHash":"40464b6f9872285ebd69da62c8cc6e92198c099f9fc2b48016eaa2c528d421cf"}
 *
 * Go source:
 * func (p *Parser) parseExpectedWithDiagnostic(kind ast.Kind, message *diagnostics.Message, shouldAdvance bool) bool {
 * 	if p.token == kind {
 * 		if shouldAdvance {
 * 			p.nextToken()
 * 		}
 * 		return true
 * 	}
 * 	// Report specific message if provided with one.  Otherwise, report generic fallback message.
 * 	if message != nil {
 * 		p.parseErrorAtCurrentToken(message)
 * 	} else {
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(kind))
 * 	}
 * 	return false
 * }
 */
export function Parser_parseExpectedWithDiagnostic(receiver: GoPtr<Parser>, kind: Kind, message: GoPtr<Message>, shouldAdvance: bool): bool {
  if (receiver!.token === kind) {
    if (shouldAdvance) {
      Parser_nextToken(receiver);
    }
    return true;
  }
  // Report specific message if provided with one.  Otherwise, report generic fallback message.
  if (message !== undefined) {
    Parser_parseErrorAtCurrentToken(receiver, message);
  } else {
    Parser_parseErrorAtCurrentToken(receiver, diagnostics.X_0_expected, TokenToString(kind));
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseStatement","kind":"method","status":"implemented","sigHash":"172cd73c63618c45a56c4a081b47a29c7b4a708e6d126d149f38256ae2fc9a61","bodyHash":"85ba47d4d4613f96246c69f807628b2a5033fc94d4d5d61e1b2fa16ad1257639"}
 *
 * Go source:
 * func (p *Parser) parseStatement() *ast.Statement {
 * 	switch p.token {
 * 	case ast.KindSemicolonToken:
 * 		return p.parseEmptyStatement()
 * 	case ast.KindOpenBraceToken:
 * 		return p.parseBlock(false /*ignoreMissingOpenBrace* /, nil)
 * 	case ast.KindVarKeyword:
 * 		return p.parseVariableStatement(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 	case ast.KindLetKeyword:
 * 		if p.isLetDeclaration() {
 * 			return p.parseVariableStatement(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 		}
 * 	case ast.KindAwaitKeyword:
 * 		if p.isAwaitUsingDeclaration() {
 * 			return p.parseVariableStatement(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 		}
 * 	case ast.KindUsingKeyword:
 * 		if p.isUsingDeclaration() {
 * 			return p.parseVariableStatement(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 		}
 * 	case ast.KindFunctionKeyword:
 * 		return p.parseFunctionDeclaration(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 	case ast.KindClassKeyword:
 * 		return p.parseClassDeclaration(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /)
 * 	case ast.KindIfKeyword:
 * 		return p.parseIfStatement()
 * 	case ast.KindDoKeyword:
 * 		return p.parseDoStatement()
 * 	case ast.KindWhileKeyword:
 * 		return p.parseWhileStatement()
 * 	case ast.KindForKeyword:
 * 		return p.parseForOrForInOrForOfStatement()
 * 	case ast.KindContinueKeyword:
 * 		return p.parseContinueStatement()
 * 	case ast.KindBreakKeyword:
 * 		return p.parseBreakStatement()
 * 	case ast.KindReturnKeyword:
 * 		return p.parseReturnStatement()
 * 	case ast.KindWithKeyword:
 * 		return p.parseWithStatement()
 * 	case ast.KindSwitchKeyword:
 * 		return p.parseSwitchStatement()
 * 	case ast.KindThrowKeyword:
 * 		return p.parseThrowStatement()
 * 	case ast.KindTryKeyword, ast.KindCatchKeyword, ast.KindFinallyKeyword:
 * 		return p.parseTryStatement()
 * 	case ast.KindDebuggerKeyword:
 * 		return p.parseDebuggerStatement()
 * 	case ast.KindAtToken:
 * 		return p.parseDeclaration()
 * 	case ast.KindAsyncKeyword, ast.KindInterfaceKeyword, ast.KindTypeKeyword, ast.KindModuleKeyword, ast.KindNamespaceKeyword,
 * 		ast.KindDeclareKeyword, ast.KindConstKeyword, ast.KindEnumKeyword, ast.KindExportKeyword, ast.KindImportKeyword,
 * 		ast.KindPrivateKeyword, ast.KindProtectedKeyword, ast.KindPublicKeyword, ast.KindAbstractKeyword, ast.KindAccessorKeyword,
 * 		ast.KindStaticKeyword, ast.KindReadonlyKeyword, ast.KindGlobalKeyword:
 * 		if p.isStartOfDeclaration() {
 * 			return p.parseDeclaration()
 * 		}
 * 	}
 * 	return p.parseExpressionOrLabeledStatement()
 * }
 */
export function Parser_parseStatement(receiver: GoPtr<Parser>): GoPtr<Statement> {
  switch (receiver!.token) {
    case KindSemicolonToken:
      return Parser_parseEmptyStatement(receiver);
    case KindOpenBraceToken:
      return Parser_parseBlock(receiver, false /*ignoreMissingOpenBrace*/, undefined);
    case KindVarKeyword:
      return Parser_parseVariableStatement(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
    case KindLetKeyword:
      if (Parser_isLetDeclaration(receiver)) {
        return Parser_parseVariableStatement(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
      }
      break;
    case KindAwaitKeyword:
      if (Parser_isAwaitUsingDeclaration(receiver)) {
        return Parser_parseVariableStatement(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
      }
      break;
    case KindUsingKeyword:
      if (Parser_isUsingDeclaration(receiver)) {
        return Parser_parseVariableStatement(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
      }
      break;
    case KindFunctionKeyword:
      return Parser_parseFunctionDeclaration(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
    case KindClassKeyword:
      return Parser_parseClassDeclaration(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/);
    case KindIfKeyword:
      return Parser_parseIfStatement(receiver);
    case KindDoKeyword:
      return Parser_parseDoStatement(receiver);
    case KindWhileKeyword:
      return Parser_parseWhileStatement(receiver);
    case KindForKeyword:
      return Parser_parseForOrForInOrForOfStatement(receiver);
    case KindContinueKeyword:
      return Parser_parseContinueStatement(receiver);
    case KindBreakKeyword:
      return Parser_parseBreakStatement(receiver);
    case KindReturnKeyword:
      return Parser_parseReturnStatement(receiver);
    case KindWithKeyword:
      return Parser_parseWithStatement(receiver);
    case KindSwitchKeyword:
      return Parser_parseSwitchStatement(receiver);
    case KindThrowKeyword:
      return Parser_parseThrowStatement(receiver);
    case KindTryKeyword:
    case KindCatchKeyword:
    case KindFinallyKeyword:
      return Parser_parseTryStatement(receiver);
    case KindDebuggerKeyword:
      return Parser_parseDebuggerStatement(receiver);
    case KindAtToken:
      return Parser_parseDeclaration(receiver);
    case KindAsyncKeyword:
    case KindInterfaceKeyword:
    case KindTypeKeyword:
    case KindModuleKeyword:
    case KindNamespaceKeyword:
    case KindDeclareKeyword:
    case KindConstKeyword:
    case KindEnumKeyword:
    case KindExportKeyword:
    case KindImportKeyword:
    case KindPrivateKeyword:
    case KindProtectedKeyword:
    case KindPublicKeyword:
    case KindAbstractKeyword:
    case KindAccessorKeyword:
    case KindStaticKeyword:
    case KindReadonlyKeyword:
    case KindGlobalKeyword:
      if (Parser_isStartOfDeclaration(receiver)) {
        return Parser_parseDeclaration(receiver);
      }
      break;
  }
  return Parser_parseExpressionOrLabeledStatement(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDeclaration","kind":"method","status":"implemented","sigHash":"4e5e7bf28d8c0c14b1b63aba4e472e21cd01813379ae4610b8cb8082b14e3e5b","bodyHash":"4a5a678bce41ba19b642c72e6ff0a2a812b15fd850e13d12029fcd2700d1725d"}
 *
 * Go source:
 * func (p *Parser) parseDeclaration() *ast.Statement {
 * 	// `parseListElement` attempted to get the reused node at this position,
 * 	// but the ambient context flag was not yet set, so the node appeared
 * 	// not reusable in that context.
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiersEx( /*allowDecorators* / true, false /*permitConstAsModifier* /, false /*stopOnStartOfClassStaticBlock* /)
 * 	isAmbient := modifiers != nil && core.Some(modifiers.Nodes, isDeclareModifier)
 * 	if isAmbient {
 * 		// !!! incremental parsing
 * 		// node := p.tryReuseAmbientDeclaration(pos)
 * 		// if node {
 * 		// 	return node
 * 		// }
 * 		for _, m := range modifiers.Nodes {
 * 			m.Flags |= ast.NodeFlagsAmbient
 * 		}
 * 		saveContextFlags := p.contextFlags
 * 		p.setContextFlags(ast.NodeFlagsAmbient, true)
 * 		result := p.parseDeclarationWorker(pos, jsdoc, modifiers)
 * 		p.contextFlags = saveContextFlags
 * 		return result
 * 	} else {
 * 		return p.parseDeclarationWorker(pos, jsdoc, modifiers)
 * 	}
 * }
 */
export function Parser_parseDeclaration(receiver: GoPtr<Parser>): GoPtr<Statement> {
  // `parseListElement` attempted to get the reused node at this position,
  // but the ambient context flag was not yet set, so the node appeared
  // not reusable in that context.
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiersEx(receiver, /*allowDecorators*/ true, false /*permitConstAsModifier*/, false /*stopOnStartOfClassStaticBlock*/);
  const isAmbient = modifiers !== undefined && Some(modifiers.Nodes, isDeclareModifier);
  if (isAmbient) {
    // !!! incremental parsing
    // node := p.tryReuseAmbientDeclaration(pos)
    // if node {
    // 	return node
    // }
    for (const m of modifiers!.Nodes) {
      m!.Flags |= NodeFlagsAmbient;
    }
    const saveContextFlags = receiver!.contextFlags;
    Parser_setContextFlags(receiver, NodeFlagsAmbient, true);
    const result = Parser_parseDeclarationWorker(receiver, pos, jsdoc, modifiers);
    receiver!.contextFlags = saveContextFlags;
    return result;
  } else {
    return Parser_parseDeclarationWorker(receiver, pos, jsdoc, modifiers);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDeclarationWorker","kind":"method","status":"implemented","sigHash":"a48caf0e3051d364ac0a97270e4ae468d3a9b5d34567c57dd77cbe6c20f765cd","bodyHash":"30c60afb014e5d39a64f5168e39d13d5f738030c49f0f1f8f4ffb12617d6894b"}
 *
 * Go source:
 * func (p *Parser) parseDeclarationWorker(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Statement {
 * 	switch p.token {
 * 	case ast.KindVarKeyword, ast.KindLetKeyword, ast.KindConstKeyword, ast.KindUsingKeyword:
 * 		return p.parseVariableStatement(pos, jsdoc, modifiers)
 * 	case ast.KindAwaitKeyword:
 * 		if p.isAwaitUsingDeclaration() {
 * 			return p.parseVariableStatement(pos, jsdoc, modifiers)
 * 		}
 * 	case ast.KindFunctionKeyword:
 * 		return p.parseFunctionDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindClassKeyword:
 * 		return p.parseClassDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindInterfaceKeyword:
 * 		return p.parseInterfaceDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindTypeKeyword:
 * 		return p.parseTypeAliasDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindEnumKeyword:
 * 		return p.parseEnumDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindGlobalKeyword, ast.KindModuleKeyword, ast.KindNamespaceKeyword:
 * 		return p.parseModuleDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindImportKeyword:
 * 		return p.parseImportDeclarationOrImportEqualsDeclaration(pos, jsdoc, modifiers)
 * 	case ast.KindExportKeyword:
 * 		p.nextToken()
 * 		switch p.token {
 * 		case ast.KindDefaultKeyword, ast.KindEqualsToken:
 * 			return p.parseExportAssignment(pos, jsdoc, modifiers)
 * 		case ast.KindAsKeyword:
 * 			return p.parseNamespaceExportDeclaration(pos, jsdoc, modifiers)
 * 		default:
 * 			return p.parseExportDeclaration(pos, jsdoc, modifiers)
 * 		}
 * 	}
 * 	if modifiers != nil {
 * 		// We reached this point because we encountered decorators and/or modifiers and assumed a declaration
 * 		// would follow. For recovery and error reporting purposes, return an incomplete declaration.
 * 		p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.Declaration_expected)
 * 		return p.finishNode(p.factory.NewMissingDeclaration(modifiers), pos)
 * 	}
 * 	panic("Unhandled case in parseDeclarationWorker")
 * }
 */
export function Parser_parseDeclarationWorker(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Statement> {
  switch (receiver!.token) {
    case KindVarKeyword:
    case KindLetKeyword:
    case KindConstKeyword:
    case KindUsingKeyword:
      return Parser_parseVariableStatement(receiver, pos, jsdoc, modifiers);
    case KindAwaitKeyword:
      if (Parser_isAwaitUsingDeclaration(receiver)) {
        return Parser_parseVariableStatement(receiver, pos, jsdoc, modifiers);
      }
      break;
    case KindFunctionKeyword:
      return Parser_parseFunctionDeclaration(receiver, pos, jsdoc, modifiers);
    case KindClassKeyword:
      return Parser_parseClassDeclaration(receiver, pos, jsdoc, modifiers);
    case KindInterfaceKeyword:
      return Parser_parseInterfaceDeclaration(receiver, pos, jsdoc, modifiers);
    case KindTypeKeyword:
      return Parser_parseTypeAliasDeclaration(receiver, pos, jsdoc, modifiers);
    case KindEnumKeyword:
      return Parser_parseEnumDeclaration(receiver, pos, jsdoc, modifiers);
    case KindGlobalKeyword:
    case KindModuleKeyword:
    case KindNamespaceKeyword:
      return Parser_parseModuleDeclaration(receiver, pos, jsdoc, modifiers);
    case KindImportKeyword:
      return Parser_parseImportDeclarationOrImportEqualsDeclaration(receiver, pos, jsdoc, modifiers);
    case KindExportKeyword:
      Parser_nextToken(receiver);
      switch (receiver!.token) {
        case KindDefaultKeyword:
        case KindEqualsToken:
          return Parser_parseExportAssignment(receiver, pos, jsdoc, modifiers);
        case KindAsKeyword:
          return Parser_parseNamespaceExportDeclaration(receiver, pos, jsdoc, modifiers);
        default:
          return Parser_parseExportDeclaration(receiver, pos, jsdoc, modifiers);
      }
  }
  if (modifiers !== undefined) {
    // We reached this point because we encountered decorators and/or modifiers and assumed a declaration
    // would follow. For recovery and error reporting purposes, return an incomplete declaration.
    Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), diagnostics.Declaration_expected);
    return Parser_finishNode(receiver, NewMissingDeclaration(receiver!.factory, modifiers), pos);
  }
  throw new globalThis.Error("Unhandled case in parseDeclarationWorker");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isLetDeclaration","kind":"method","status":"implemented","sigHash":"2b2649c8728d60513f636be4488fe7bf180cb82c8c924afef4d2038599628150","bodyHash":"5b6ce7a1290162ec2898f0c7f1954e0d3f9f1c6fa746f13824ac58e8a11aefba"}
 *
 * Go source:
 * func (p *Parser) isLetDeclaration() bool {
 * 	// In ES6 'let' always starts a lexical declaration if followed by an identifier or {
 * 	// or [.
 * 	return p.lookAhead((*Parser).nextTokenIsBindingIdentifierOrStartOfDestructuring)
 * }
 */
export function Parser_isLetDeclaration(receiver: GoPtr<Parser>): bool {
  // In ES6 'let' always starts a lexical declaration if followed by an identifier or {
  // or [.
  return Parser_lookAhead(receiver, Parser_nextTokenIsBindingIdentifierOrStartOfDestructuring);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBlock","kind":"method","status":"implemented","sigHash":"5f68253530f402645ed25e579ff1736eef2e5cf528f5a577adc35ccffcf3d0cc","bodyHash":"e295afb5a036c09ffcd91589e052a2f886cc55cda3be5af16eb542bf3d615759"}
 *
 * Go source:
 * func (p *Parser) parseBlock(ignoreMissingOpenBrace bool, diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	openBracePosition := p.scanner.TokenStart()
 * 	openBraceParsed := p.parseExpectedWithDiagnostic(ast.KindOpenBraceToken, diagnosticMessage, true /*shouldAdvance* /)
 * 	multiline := false
 * 	if openBraceParsed || ignoreMissingOpenBrace {
 * 		multiline = p.hasPrecedingLineBreak()
 * 		statements := p.parseList(PCBlockStatements, (*Parser).parseStatement)
 * 		p.parseExpectedMatchingBrackets(ast.KindOpenBraceToken, ast.KindCloseBraceToken, openBraceParsed, openBracePosition)
 * 		result := p.finishNode(p.factory.NewBlock(statements, multiline), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		if p.token == ast.KindEqualsToken {
 * 			p.parseErrorAtCurrentToken(diagnostics.Declaration_or_statement_expected_This_follows_a_block_of_statements_so_if_you_intended_to_write_a_destructuring_assignment_you_might_need_to_wrap_the_whole_assignment_in_parentheses)
 * 			p.nextToken()
 * 		}
 * 		return result
 * 	}
 * 	result := p.finishNode(p.factory.NewBlock(p.createMissingList(), multiline), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseBlock(receiver: GoPtr<Parser>, ignoreMissingOpenBrace: bool, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const openBracePosition = Scanner_TokenStart(receiver!.scanner);
  const openBraceParsed = Parser_parseExpectedWithDiagnostic(receiver, KindOpenBraceToken, diagnosticMessage, true /*shouldAdvance*/);
  if (openBraceParsed || ignoreMissingOpenBrace) {
    const multiline = Parser_hasPrecedingLineBreak(receiver);
    const statements = Parser_parseList(receiver, PCBlockStatements, Parser_parseStatement);
    Parser_parseExpectedMatchingBrackets(receiver, KindOpenBraceToken, KindCloseBraceToken, openBraceParsed, openBracePosition);
    const result = Parser_finishNode(receiver, NewBlock(receiver!.factory, statements, multiline), pos);
    Parser_withJSDoc(receiver, result, jsdoc);
    if (receiver!.token === KindEqualsToken) {
      Parser_parseErrorAtCurrentToken(receiver, diagnostics.Declaration_or_statement_expected_This_follows_a_block_of_statements_so_if_you_intended_to_write_a_destructuring_assignment_you_might_need_to_wrap_the_whole_assignment_in_parentheses);
      Parser_nextToken(receiver);
    }
    return result;
  }
  const result = Parser_finishNode(receiver, NewBlock(receiver!.factory, Parser_createMissingList(receiver), false), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEmptyStatement","kind":"method","status":"implemented","sigHash":"8f5de59f3e65bad10732bb7785ac19abcf895928bbc275e2f59f62eb01261e80","bodyHash":"acedba24db204ff61d024db84a56c6c389d1c33d7d07651183d1133779409aae"}
 *
 * Go source:
 * func (p *Parser) parseEmptyStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindSemicolonToken)
 * 	result := p.finishNode(p.factory.NewEmptyStatement(), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseEmptyStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindSemicolonToken);
  const result = Parser_finishNode(receiver, NewEmptyStatement(receiver!.factory), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIfStatement","kind":"method","status":"implemented","sigHash":"7268ea45bbba70e1e6ff8debd65078015c653d003a9f07154af0560304b1c316","bodyHash":"d3256e0d1d61842853e9ea3daba973df4542ab1551ad913a4edb18ff7e50baa8"}
 *
 * Go source:
 * func (p *Parser) parseIfStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindIfKeyword)
 * 	openParenPosition := p.scanner.TokenStart()
 * 	openParenParsed := p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenParenToken, ast.KindCloseParenToken, openParenParsed, openParenPosition)
 * 	thenStatement := p.parseStatement()
 * 	var elseStatement *ast.Statement
 * 	if p.parseOptional(ast.KindElseKeyword) {
 * 		elseStatement = p.parseStatement()
 * 	}
 * 	result := p.finishNode(p.factory.NewIfStatement(expression, thenStatement, elseStatement), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseIfStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindIfKeyword);
  const openParenPosition = Scanner_TokenStart(receiver!.scanner);
  const openParenParsed = Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenParenToken, KindCloseParenToken, openParenParsed, openParenPosition);
  const thenStatement = Parser_parseStatement(receiver);
  const elseStatement: GoPtr<Statement> = Parser_parseOptional(receiver, KindElseKeyword) ? Parser_parseStatement(receiver) : undefined;
  const result = Parser_finishNode(receiver, NewIfStatement(receiver!.factory, expression, thenStatement, elseStatement), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDoStatement","kind":"method","status":"implemented","sigHash":"681e83d700917172c8e933750395eeeea040a8788941dc7e43e0059c2e688b73","bodyHash":"bd8bc3ae67c5831a79a1de5295705496e623f51abdb5f27b258b8da377d4cf84"}
 *
 * Go source:
 * func (p *Parser) parseDoStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindDoKeyword)
 * 	statement := p.parseStatement()
 * 	p.parseExpected(ast.KindWhileKeyword)
 * 	openParenPosition := p.scanner.TokenStart()
 * 	openParenParsed := p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenParenToken, ast.KindCloseParenToken, openParenParsed, openParenPosition)
 * 	// From: https://mail.mozilla.org/pipermail/es-discuss/2011-August/016188.html
 * 	// 157 min --- All allen at wirfs-brock.com CONF --- "do{;}while(false)false" prohibited in
 * 	// spec but allowed in consensus reality. Approved -- this is the de-facto standard whereby
 * 	//  do;while(0)x will have a semicolon inserted before x.
 * 	p.parseOptional(ast.KindSemicolonToken)
 * 	result := p.finishNode(p.factory.NewDoStatement(statement, expression), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseDoStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindDoKeyword);
  const statement = Parser_parseStatement(receiver);
  Parser_parseExpected(receiver, KindWhileKeyword);
  const openParenPosition = Scanner_TokenStart(receiver!.scanner);
  const openParenParsed = Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenParenToken, KindCloseParenToken, openParenParsed, openParenPosition);
  // From: https://mail.mozilla.org/pipermail/es-discuss/2011-August/016188.html
  // 157 min --- All allen at wirfs-brock.com CONF --- "do{;}while(false)false" prohibited in
  // spec but allowed in consensus reality. Approved -- this is the de-facto standard whereby
  //  do;while(0)x will have a semicolon inserted before x.
  Parser_parseOptional(receiver, KindSemicolonToken);
  const result = Parser_finishNode(receiver, NewDoStatement(receiver!.factory, statement, expression), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseWhileStatement","kind":"method","status":"implemented","sigHash":"50e9f30e6a0f96de5ef42fbbac40a50611b9d223524b5907933700fb7eab5a43","bodyHash":"9bc334cd20a31ce01961779b9dc4144cc484a7104f9310d1fb695e59d790bea0"}
 *
 * Go source:
 * func (p *Parser) parseWhileStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindWhileKeyword)
 * 	openParenPosition := p.scanner.TokenStart()
 * 	openParenParsed := p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenParenToken, ast.KindCloseParenToken, openParenParsed, openParenPosition)
 * 	statement := p.parseStatement()
 * 	result := p.finishNode(p.factory.NewWhileStatement(expression, statement), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseWhileStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindWhileKeyword);
  const openParenPosition = Scanner_TokenStart(receiver!.scanner);
  const openParenParsed = Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenParenToken, KindCloseParenToken, openParenParsed, openParenPosition);
  const statement = Parser_parseStatement(receiver);
  const result = Parser_finishNode(receiver, NewWhileStatement(receiver!.factory, expression, statement), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseForOrForInOrForOfStatement","kind":"method","status":"implemented","sigHash":"acf82c41bf895baf0b83567e9c77e9522b5857289e313ac342f8cdc556d1f667","bodyHash":"57ab417aaa781b2b255eff0805e8b9c6d762ee1a844d92a51403f60087406e0d"}
 *
 * Go source:
 * func (p *Parser) parseForOrForInOrForOfStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindForKeyword)
 * 	awaitToken := p.parseOptionalToken(ast.KindAwaitKeyword)
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	var initializer *ast.ForInitializer
 * 	if p.token != ast.KindSemicolonToken {
 * 		if p.token == ast.KindVarKeyword || p.token == ast.KindLetKeyword || p.token == ast.KindConstKeyword ||
 * 			p.token == ast.KindUsingKeyword && p.lookAhead((*Parser).nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf) ||
 * 			// this one is meant to allow of
 * 			p.token == ast.KindAwaitKeyword && p.lookAhead((*Parser).nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine) {
 * 			initializer = p.parseVariableDeclarationList(true /*inForStatementInitializer* /)
 * 		} else {
 * 			initializer = doInContext(p, ast.NodeFlagsDisallowInContext, true, (*Parser).parseExpression)
 * 		}
 * 	}
 * 	var result *ast.Statement
 * 	switch {
 * 	case awaitToken != nil && p.parseExpected(ast.KindOfKeyword) || awaitToken == nil && p.parseOptional(ast.KindOfKeyword):
 * 		expression := doInContext(p, ast.NodeFlagsDisallowInContext, false, (*Parser).parseAssignmentExpressionOrHigher)
 * 		p.parseExpected(ast.KindCloseParenToken)
 * 		result = p.factory.NewForInOrOfStatement(ast.KindForOfStatement, awaitToken, initializer, expression, p.parseStatement())
 * 	case p.parseOptional(ast.KindInKeyword):
 * 		expression := p.parseExpressionAllowIn()
 * 		p.parseExpected(ast.KindCloseParenToken)
 * 		result = p.factory.NewForInOrOfStatement(ast.KindForInStatement, nil /*awaitToken* /, initializer, expression, p.parseStatement())
 * 	default:
 * 		p.parseExpected(ast.KindSemicolonToken)
 * 		var condition *ast.Expression
 * 		if p.token != ast.KindSemicolonToken && p.token != ast.KindCloseParenToken {
 * 			condition = p.parseExpressionAllowIn()
 * 		}
 * 		p.parseExpected(ast.KindSemicolonToken)
 * 		var incrementor *ast.Expression
 * 		if p.token != ast.KindCloseParenToken {
 * 			incrementor = p.parseExpressionAllowIn()
 * 		}
 * 		p.parseExpected(ast.KindCloseParenToken)
 * 		result = p.factory.NewForStatement(initializer, condition, incrementor, p.parseStatement())
 * 	}
 * 	p.finishNode(result, pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseForOrForInOrForOfStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindForKeyword);
  const awaitToken = Parser_parseOptionalToken(receiver, KindAwaitKeyword);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const initializer: GoPtr<ForInitializer> =
    receiver!.token !== KindSemicolonToken
      ? receiver!.token === KindVarKeyword ||
        receiver!.token === KindLetKeyword ||
        receiver!.token === KindConstKeyword ||
        (receiver!.token === KindUsingKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf)) ||
        // this one is meant to allow of
        (receiver!.token === KindAwaitKeyword && Parser_lookAhead(receiver, Parser_nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine))
        ? Parser_parseVariableDeclarationList(receiver, true /*inForStatementInitializer*/)
        : doInContext(receiver, NodeFlagsDisallowInContext, true, Parser_parseExpression)
      : undefined;
  const result: GoPtr<Statement> = ((): GoPtr<Statement> => {
    if ((awaitToken !== undefined && Parser_parseExpected(receiver, KindOfKeyword)) || (awaitToken === undefined && Parser_parseOptional(receiver, KindOfKeyword))) {
      const expression = doInContext(receiver, NodeFlagsDisallowInContext, false, Parser_parseAssignmentExpressionOrHigher);
      Parser_parseExpected(receiver, KindCloseParenToken);
      return NewForInOrOfStatement(receiver!.factory, KindForOfStatement, awaitToken, initializer, expression, Parser_parseStatement(receiver));
    } else if (Parser_parseOptional(receiver, KindInKeyword)) {
      const expression = Parser_parseExpressionAllowIn(receiver);
      Parser_parseExpected(receiver, KindCloseParenToken);
      return NewForInOrOfStatement(receiver!.factory, KindForInStatement, undefined /*awaitToken*/, initializer, expression, Parser_parseStatement(receiver));
    } else {
      Parser_parseExpected(receiver, KindSemicolonToken);
      const condition: GoPtr<Expression> =
        receiver!.token !== KindSemicolonToken && receiver!.token !== KindCloseParenToken ? Parser_parseExpressionAllowIn(receiver) : undefined;
      Parser_parseExpected(receiver, KindSemicolonToken);
      const incrementor: GoPtr<Expression> = receiver!.token !== KindCloseParenToken ? Parser_parseExpressionAllowIn(receiver) : undefined;
      Parser_parseExpected(receiver, KindCloseParenToken);
      return NewForStatement(receiver!.factory, initializer, condition, incrementor, Parser_parseStatement(receiver));
    }
  })();
  Parser_finishNode(receiver, result, pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBreakStatement","kind":"method","status":"implemented","sigHash":"12c9250fc4b4441d968285a71057769f7a923929a52c0017f9680ca0535420ce","bodyHash":"52cfd8c915085edb6434c7aaf78b4590818b7156be870b5390829d6221b9a15e"}
 *
 * Go source:
 * func (p *Parser) parseBreakStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindBreakKeyword)
 * 	label := p.parseIdentifierUnlessAtSemicolon()
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewBreakStatement(label), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseBreakStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindBreakKeyword);
  const label = Parser_parseIdentifierUnlessAtSemicolon(receiver);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewBreakStatement(receiver!.factory, label), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseContinueStatement","kind":"method","status":"implemented","sigHash":"707d3430894b31cb9a1af7f14d05d3dc3b779813d3ca6e3f6805861a59220e92","bodyHash":"56ade83d935cefd8071d23c52066e2c8db1cd48a59c46b8ee8e8480fd3e96fcf"}
 *
 * Go source:
 * func (p *Parser) parseContinueStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindContinueKeyword)
 * 	label := p.parseIdentifierUnlessAtSemicolon()
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewContinueStatement(label), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseContinueStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindContinueKeyword);
  const label = Parser_parseIdentifierUnlessAtSemicolon(receiver);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewContinueStatement(receiver!.factory, label), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseReturnStatement","kind":"method","status":"implemented","sigHash":"06d782906067ff22af4e2d23ee0490a87ec906fade95d87a68abee939f6d548f","bodyHash":"5a19ed0b84a0afab077b341ee7183b0496a0d87ae4aa54b1fe195fb80a4b2635"}
 *
 * Go source:
 * func (p *Parser) parseReturnStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindReturnKeyword)
 * 	var expression *ast.Expression
 * 	if !p.canParseSemicolon() {
 * 		expression = p.parseExpressionAllowIn()
 * 	}
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewReturnStatement(expression), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseReturnStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindReturnKeyword);
  const expression: GoPtr<Expression> = !Parser_canParseSemicolon(receiver) ? Parser_parseExpressionAllowIn(receiver) : undefined;
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewReturnStatement(receiver!.factory, expression), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseWithStatement","kind":"method","status":"implemented","sigHash":"5289f4c30aa3692febedd602fc94041f676562dd93afac9d379db6cd4f3b6cba","bodyHash":"78e9002fe5829162ca680d8ab99bec944c6b8e6301a9e436ba7360f6df5cfa7c"}
 *
 * Go source:
 * func (p *Parser) parseWithStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindWithKeyword)
 * 	openParenPosition := p.scanner.TokenStart()
 * 	openParenParsed := p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenParenToken, ast.KindCloseParenToken, openParenParsed, openParenPosition)
 * 	statement := doInContext(p, ast.NodeFlagsInWithStatement, true, (*Parser).parseStatement)
 * 	result := p.finishNode(p.factory.NewWithStatement(expression, statement), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseWithStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindWithKeyword);
  const openParenPosition = Scanner_TokenStart(receiver!.scanner);
  const openParenParsed = Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenParenToken, KindCloseParenToken, openParenParsed, openParenPosition);
  const statement = doInContext(receiver, NodeFlagsInWithStatement, true, Parser_parseStatement);
  const result = Parser_finishNode(receiver, NewWithStatement(receiver!.factory, expression, statement), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseCaseBlock","kind":"method","status":"implemented","sigHash":"950be804dec8f86be693926ad28d520fde5b9e84b358a3f6eef42db73f7aa6b2","bodyHash":"72cfffaef4f09dcd4ea842074c1121e974c6b807a9889707e4235bed08260005"}
 *
 * Go source:
 * func (p *Parser) parseCaseBlock() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindOpenBraceToken)
 * 	clauses := p.parseList(PCSwitchClauses, (*Parser).parseCaseOrDefaultClause)
 * 	p.parseExpected(ast.KindCloseBraceToken)
 * 	result := p.finishNode(p.factory.NewCaseBlock(clauses), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseCaseBlock(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindOpenBraceToken);
  const clauses = Parser_parseList(receiver, PCSwitchClauses, Parser_parseCaseOrDefaultClause);
  Parser_parseExpected(receiver, KindCloseBraceToken);
  const result = Parser_finishNode(receiver, NewCaseBlock(receiver!.factory, clauses), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSwitchStatement","kind":"method","status":"implemented","sigHash":"90eae27c676713bc036840f48b239b5c6f1e070d64540678b21850da991d836b","bodyHash":"ee93bf25b84e44e4caff8fee1886374e6aec26e58f035669e2eb15a8c9fc76e6"}
 *
 * Go source:
 * func (p *Parser) parseSwitchStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindSwitchKeyword)
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	caseBlock := p.parseCaseBlock()
 * 	result := p.finishNode(p.factory.NewSwitchStatement(expression, caseBlock), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseSwitchStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindSwitchKeyword);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpected(receiver, KindCloseParenToken);
  const caseBlock = Parser_parseCaseBlock(receiver);
  const result = Parser_finishNode(receiver, NewSwitchStatement(receiver!.factory, expression, caseBlock), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseThrowStatement","kind":"method","status":"implemented","sigHash":"3af865f71f0cf9b13c2cc3f761c8de1a9711da7b581174763d9b41fe7721bdb0","bodyHash":"bf62c451ea00455e502f26cb292575ac3ed48aba36f1734e057260df59fa9387"}
 *
 * Go source:
 * func (p *Parser) parseThrowStatement() *ast.Node {
 * 	// ThrowStatement[Yield] :
 * 	//      throw [no LineTerminator here]Expression[In, ?Yield];
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindThrowKeyword)
 * 	// Because of automatic semicolon insertion, we need to report error if this
 * 	// throw could be terminated with a semicolon.  Note: we can't call 'parseExpression'
 * 	// directly as that might consume an expression on the following line.
 * 	// Instead, we create a "missing" identifier, but don't report an error. The actual error
 * 	// will be reported in the grammar walker.
 * 	var expression *ast.Expression
 * 	if !p.hasPrecedingLineBreak() {
 * 		expression = p.parseExpressionAllowIn()
 * 	} else {
 * 		expression = p.createMissingIdentifier()
 * 	}
 * 	if !p.tryParseSemicolon() {
 * 		p.parseErrorForMissingSemicolonAfter(expression)
 * 	}
 * 	result := p.finishNode(p.factory.NewThrowStatement(expression), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseThrowStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  // ThrowStatement[Yield] :
  //      throw [no LineTerminator here]Expression[In, ?Yield];
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindThrowKeyword);
  // Because of automatic semicolon insertion, we need to report error if this
  // throw could be terminated with a semicolon.  Note: we can't call 'parseExpression'
  // directly as that might consume an expression on the following line.
  // Instead, we create a "missing" identifier, but don't report an error. The actual error
  // will be reported in the grammar walker.
  const expression: GoPtr<Expression> = !Parser_hasPrecedingLineBreak(receiver) ? Parser_parseExpressionAllowIn(receiver) : Parser_createMissingIdentifier(receiver);
  if (!Parser_tryParseSemicolon(receiver)) {
    Parser_parseErrorForMissingSemicolonAfter(receiver, expression);
  }
  const result = Parser_finishNode(receiver, NewThrowStatement(receiver!.factory, expression), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTryStatement","kind":"method","status":"implemented","sigHash":"fcac15ed11ff279a7071d57aef48e54a832a8736b669dbaad9eec9765696bf90","bodyHash":"8274279984dee10e75b20a1f679618aa826aeb149e419de6fdb0967c2516509c"}
 *
 * Go source:
 * func (p *Parser) parseTryStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindTryKeyword)
 * 	tryBlock := p.parseBlock(false /*ignoreMissingOpenBrace* /, nil)
 * 	var catchClause *ast.Node
 * 	if p.token == ast.KindCatchKeyword {
 * 		catchClause = p.parseCatchClause()
 * 	}
 * 	// If we don't have a catch clause, then we must have a finally clause.  Try to parse
 * 	// one out no matter what.
 * 	var finallyBlock *ast.Node
 * 	if catchClause == nil || p.token == ast.KindFinallyKeyword {
 * 		p.parseExpectedWithDiagnostic(ast.KindFinallyKeyword, diagnostics.X_catch_or_finally_expected, true /*shouldAdvance* /)
 * 		finallyBlock = p.parseBlock(false /*ignoreMissingOpenBrace* /, nil)
 * 	}
 * 	result := p.finishNode(p.factory.NewTryStatement(tryBlock, catchClause, finallyBlock), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseTryStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindTryKeyword);
  const tryBlock = Parser_parseBlock(receiver, false /*ignoreMissingOpenBrace*/, undefined);
  const catchClause: GoPtr<Node> = receiver!.token === KindCatchKeyword ? Parser_parseCatchClause(receiver) : undefined;
  // If we don't have a catch clause, then we must have a finally clause.  Try to parse
  // one out no matter what.
  const finallyBlock: GoPtr<Node> = ((): GoPtr<Node> => {
    if (catchClause === undefined || receiver!.token === KindFinallyKeyword) {
      Parser_parseExpectedWithDiagnostic(receiver, KindFinallyKeyword, diagnostics.X_catch_or_finally_expected, true /*shouldAdvance*/);
      return Parser_parseBlock(receiver, false /*ignoreMissingOpenBrace*/, undefined);
    }
    return undefined;
  })();
  const result = Parser_finishNode(receiver, NewTryStatement(receiver!.factory, tryBlock, catchClause, finallyBlock), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseCatchClause","kind":"method","status":"implemented","sigHash":"9b320fa30a6f753a3d5b0ceab9e63b8277c023ac677dc60a21e63ac075266ebc","bodyHash":"0489a0705a0e7d0a55c11c988844a0cf7b041fc90257217ec1c89f20d23db19a"}
 *
 * Go source:
 * func (p *Parser) parseCatchClause() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindCatchKeyword)
 * 	var variableDeclaration *ast.Node
 * 	if p.parseOptional(ast.KindOpenParenToken) {
 * 		variableDeclaration = p.parseVariableDeclaration()
 * 		p.parseExpected(ast.KindCloseParenToken)
 * 	}
 * 	block := p.parseBlock(false /*ignoreMissingOpenBrace* /, nil)
 * 	result := p.finishNode(p.factory.NewCatchClause(variableDeclaration, block), pos)
 * 	return result
 * }
 */
export function Parser_parseCatchClause(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindCatchKeyword);
  const variableDeclaration: GoPtr<Node> = ((): GoPtr<Node> => {
    if (Parser_parseOptional(receiver, KindOpenParenToken)) {
      const vd = Parser_parseVariableDeclaration(receiver);
      Parser_parseExpected(receiver, KindCloseParenToken);
      return vd;
    }
    return undefined;
  })();
  const block = Parser_parseBlock(receiver, false /*ignoreMissingOpenBrace*/, undefined);
  const result = Parser_finishNode(receiver, NewCatchClause(receiver!.factory, variableDeclaration, block), pos);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDebuggerStatement","kind":"method","status":"implemented","sigHash":"be3e4cdf3ccd08755b1b0cde83207da418f8e298644d773cda1abe019b1bb1c9","bodyHash":"6be1da7c9cee8addc63caedbf30cfbd8a41e0673728816a2d3a32031fa44ab40"}
 *
 * Go source:
 * func (p *Parser) parseDebuggerStatement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindDebuggerKeyword)
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewDebuggerStatement(), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseDebuggerStatement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindDebuggerKeyword);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewDebuggerStatement(receiver!.factory), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVariableStatement","kind":"method","status":"implemented","sigHash":"8759b2ac53839a50a1d9715910e5e78533ee5d4b82ce6bd6b8567bf61ffe13a0","bodyHash":"a6869580cceba03668ba6438039478dcc2b40cef7e7d96ff3495013fbcda8525"}
 *
 * Go source:
 * func (p *Parser) parseVariableStatement(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	declarationList := p.parseVariableDeclarationList(false /*inForStatementInitializer* /)
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewVariableStatement(modifiers, declarationList), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseVariableStatement(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const declarationList = Parser_parseVariableDeclarationList(receiver, false /*inForStatementInitializer*/);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewVariableStatement(receiver!.factory, modifiers, declarationList), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVariableDeclarationList","kind":"method","status":"implemented","sigHash":"8e51e9ba39e320097a76bf1f4770e7249ad382f2600f70fd1f56bfa86e185ec2","bodyHash":"22a634281c80945917fcde093efdf5fb14026622ed7644ff136ab52fd63f3d5f"}
 *
 * Go source:
 * func (p *Parser) parseVariableDeclarationList(inForStatementInitializer bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	var flags ast.NodeFlags
 * 	switch p.token {
 * 	case ast.KindVarKeyword:
 * 		flags = ast.NodeFlagsNone
 * 	case ast.KindLetKeyword:
 * 		flags = ast.NodeFlagsLet
 * 	case ast.KindConstKeyword:
 * 		flags = ast.NodeFlagsConst
 * 	case ast.KindUsingKeyword:
 * 		flags = ast.NodeFlagsUsing
 * 	case ast.KindAwaitKeyword:
 * 		if !p.isAwaitUsingDeclaration() {
 * 			break
 * 		}
 * 		flags = ast.NodeFlagsAwaitUsing
 * 		p.nextToken()
 * 	default:
 * 		panic("Unhandled case in parseVariableDeclarationList")
 * 	}
 * 	p.nextToken()
 * 	// The user may have written the following:
 * 	//
 * 	//    for (let of X) { }
 * 	//
 * 	// In this case, we want to parse an empty declaration list, and then parse 'of'
 * 	// as a keyword. The reason this is not automatic is that 'of' is a valid identifier.
 * 	// So we need to look ahead to determine if 'of' should be treated as a keyword in
 * 	// this context.
 * 	// The checker will then give an error that there is an empty declaration list.
 * 	var declarations *ast.NodeList
 * 	if p.token == ast.KindOfKeyword && p.lookAhead((*Parser).nextIsIdentifierAndCloseParen) {
 * 		declarations = p.createMissingList()
 * 	} else {
 * 		saveContextFlags := p.contextFlags
 * 		p.setContextFlags(ast.NodeFlagsDisallowInContext, inForStatementInitializer)
 * 		declarations = p.parseDelimitedList(PCVariableDeclarations, core.IfElse(inForStatementInitializer, (*Parser).parseVariableDeclaration, (*Parser).parseVariableDeclarationAllowExclamation))
 * 		p.contextFlags = saveContextFlags
 * 	}
 * 	result := p.finishNode(p.factory.NewVariableDeclarationList(declarations, flags), pos)
 * 	return result
 * }
 */
export function Parser_parseVariableDeclarationList(receiver: GoPtr<Parser>, inForStatementInitializer: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const flags = ((): NodeFlags => {
    switch (receiver!.token) {
      case KindVarKeyword:
        return NodeFlagsNone;
      case KindLetKeyword:
        return NodeFlagsLet;
      case KindConstKeyword:
        return NodeFlagsConst;
      case KindUsingKeyword:
        return NodeFlagsUsing;
      case KindAwaitKeyword:
        if (!Parser_isAwaitUsingDeclaration(receiver)) {
          return NodeFlagsNone;
        }
        Parser_nextToken(receiver);
        return NodeFlagsAwaitUsing;
      default:
        throw new globalThis.Error("Unhandled case in parseVariableDeclarationList");
    }
  })();
  Parser_nextToken(receiver);
  // The user may have written the following:
  //
  //    for (let of X) { }
  //
  // In this case, we want to parse an empty declaration list, and then parse 'of'
  // as a keyword. The reason this is not automatic is that 'of' is a valid identifier.
  // So we need to look ahead to determine if 'of' should be treated as a keyword in
  // this context.
  // The checker will then give an error that there is an empty declaration list.
  const declarations: GoPtr<NodeList> = ((): GoPtr<NodeList> => {
    if (receiver!.token === KindOfKeyword && Parser_lookAhead(receiver, Parser_nextIsIdentifierAndCloseParen)) {
      return Parser_createMissingList(receiver);
    } else {
      const saveContextFlags = receiver!.contextFlags;
      Parser_setContextFlags(receiver, NodeFlagsDisallowInContext, inForStatementInitializer);
      const result = Parser_parseDelimitedList(receiver, PCVariableDeclarations, IfElse(inForStatementInitializer, Parser_parseVariableDeclaration, Parser_parseVariableDeclarationAllowExclamation));
      receiver!.contextFlags = saveContextFlags;
      return result;
    }
  })();
  const result = Parser_finishNode(receiver, NewVariableDeclarationList(receiver!.factory, declarations, flags), pos);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVariableDeclaration","kind":"method","status":"implemented","sigHash":"2649ca0527943f8f94593cdf11448a09db120f1aad5820ca640e5e44dd6105d7","bodyHash":"4746769e186a0b4de1a7b9ccafb47cf6d32413ef9b369b67734db931c5784ad7"}
 *
 * Go source:
 * func (p *Parser) parseVariableDeclaration() *ast.Node {
 * 	return p.parseVariableDeclarationWorker(false /*allowExclamation* /)
 * }
 */
export function Parser_parseVariableDeclaration(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseVariableDeclarationWorker(receiver, false /*allowExclamation*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVariableDeclarationAllowExclamation","kind":"method","status":"implemented","sigHash":"33f955e86d5bff9be659b0619127a9976a9de23ed607c1cb8de11e49f3bb4be0","bodyHash":"4a3cc5258e2f1854cc096ce5fa04cc5fce8fdc7ca5d54dc0ca1d9cb88f0b7795"}
 *
 * Go source:
 * func (p *Parser) parseVariableDeclarationAllowExclamation() *ast.Node {
 * 	return p.parseVariableDeclarationWorker(true /*allowExclamation* /)
 * }
 */
export function Parser_parseVariableDeclarationAllowExclamation(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseVariableDeclarationWorker(receiver, true /*allowExclamation*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVariableDeclarationWorker","kind":"method","status":"implemented","sigHash":"3dcfbc9d84bb797750721df311585f8471c9dd2544152a7289dccd21a33ec736","bodyHash":"c0f5421a1ddc0814d1c4aabdc76a013ec9852e5e2d60e962897a68b573c381a9"}
 *
 * Go source:
 * func (p *Parser) parseVariableDeclarationWorker(allowExclamation bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	name := p.parseIdentifierOrPatternWithDiagnostic(diagnostics.Private_identifiers_are_not_allowed_in_variable_declarations)
 * 	var exclamationToken *ast.Node
 * 	if allowExclamation && name.Kind == ast.KindIdentifier && p.token == ast.KindExclamationToken && !p.hasPrecedingLineBreak() {
 * 		exclamationToken = p.parseTokenNode()
 * 	}
 * 	typeNode := p.parseTypeAnnotation()
 * 	var initializer *ast.Expression
 * 	if p.token != ast.KindInKeyword && p.token != ast.KindOfKeyword {
 * 		initializer = p.parseInitializer()
 * 	}
 * 	result := p.finishNode(p.factory.NewVariableDeclaration(name, exclamationToken, typeNode, initializer), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseVariableDeclarationWorker(receiver: GoPtr<Parser>, allowExclamation: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const name = Parser_parseIdentifierOrPatternWithDiagnostic(receiver, diagnostics.Private_identifiers_are_not_allowed_in_variable_declarations);
  const exclamationToken: GoPtr<Node> =
    allowExclamation && name!.Kind === KindIdentifier && receiver!.token === KindExclamationToken && !Parser_hasPrecedingLineBreak(receiver)
      ? Parser_parseTokenNode(receiver)
      : undefined;
  const typeNode = Parser_parseTypeAnnotation(receiver);
  const initializer: GoPtr<Expression> =
    receiver!.token !== KindInKeyword && receiver!.token !== KindOfKeyword ? Parser_parseInitializer(receiver) : undefined;
  const result = Parser_finishNode(receiver, NewVariableDeclaration(receiver!.factory, name, exclamationToken, typeNode, initializer), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierOrPatternWithDiagnostic","kind":"method","status":"implemented","sigHash":"6567ebca759519603d102a0ea6d736c529492ea7d7a5c0b8546b3335966c236f","bodyHash":"66954cf0522850bb356fffdc1541a1f43bd308d03ffb981f9e92d2d42123070d"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierOrPatternWithDiagnostic(privateIdentifierDiagnosticMessage *diagnostics.Message) *ast.Node {
 * 	if p.token == ast.KindOpenBracketToken {
 * 		return p.parseArrayBindingPattern()
 * 	}
 * 	if p.token == ast.KindOpenBraceToken {
 * 		return p.parseObjectBindingPattern()
 * 	}
 * 	return p.parseBindingIdentifierWithDiagnostic(privateIdentifierDiagnosticMessage)
 * }
 */
export function Parser_parseIdentifierOrPatternWithDiagnostic(receiver: GoPtr<Parser>, privateIdentifierDiagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  if (receiver!.token === KindOpenBracketToken) {
    return Parser_parseArrayBindingPattern(receiver);
  }
  if (receiver!.token === KindOpenBraceToken) {
    return Parser_parseObjectBindingPattern(receiver);
  }
  return Parser_parseBindingIdentifierWithDiagnostic(receiver, privateIdentifierDiagnosticMessage);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionDeclaration","kind":"method","status":"implemented","sigHash":"760be5e4b0ee4ad72202ba25820b9516d22a2b61041545569f5ac8bc742c5a2d","bodyHash":"03725a414cad247c95c6c48dcefcd5bf92e1c58312b7c4c69e81e015a01ccfc9"}
 *
 * Go source:
 * func (p *Parser) parseFunctionDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	p.parseExpected(ast.KindFunctionKeyword)
 * 	asteriskToken := p.parseOptionalToken(ast.KindAsteriskToken)
 * 	// We don't parse the name here in await context, instead we will report a grammar error in the checker.
 * 	var name *ast.Node
 * 	if modifiers == nil || modifiers.ModifierFlags&ast.ModifierFlagsDefault == 0 || p.isBindingIdentifier() {
 * 		name = p.parseBindingIdentifier()
 * 	}
 * 	signatureFlags := core.IfElse(asteriskToken != nil, ParseFlagsYield, ParseFlagsNone) | core.IfElse(modifiers != nil && modifiers.ModifierFlags&ast.ModifierFlagsAsync != 0, ParseFlagsAwait, ParseFlagsNone)
 * 	typeParameters := p.parseTypeParameters()
 * 	saveContextFlags := p.contextFlags
 * 	if modifiers != nil && modifiers.ModifierFlags&ast.ModifierFlagsExport != 0 {
 * 		p.setContextFlags(ast.NodeFlagsAwaitContext, true)
 * 	}
 * 	parameters := p.parseParameters(signatureFlags)
 * 	returnType := p.parseReturnType(ast.KindColonToken, false /*isType* /)
 * 	body := p.parseFunctionBlockOrSemicolon(signatureFlags, diagnostics.X_or_expected)
 * 	p.contextFlags = saveContextFlags
 * 	result := p.finishNode(p.factory.NewFunctionDeclaration(modifiers, asteriskToken, name, typeParameters, parameters, returnType, nil /*fullSignature* /, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseFunctionDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  Parser_parseExpected(receiver, KindFunctionKeyword);
  const asteriskToken = Parser_parseOptionalToken(receiver, KindAsteriskToken);
  // We don't parse the name here in await context, instead we will report a grammar error in the checker.
  const name: GoPtr<Node> =
    modifiers === undefined || (modifiers.ModifierFlags & ModifierFlagsDefault) === 0 || Parser_isBindingIdentifier(receiver) ? Parser_parseBindingIdentifier(receiver) : undefined;
  const signatureFlags =
    IfElse(asteriskToken !== undefined, ParseFlagsYield, ParseFlagsNone) |
    IfElse(modifiers !== undefined && (modifiers.ModifierFlags & ModifierFlagsAsync) !== 0, ParseFlagsAwait, ParseFlagsNone);
  const typeParameters = Parser_parseTypeParameters(receiver);
  const saveContextFlags = receiver!.contextFlags;
  if (modifiers !== undefined && (modifiers.ModifierFlags & ModifierFlagsExport) !== 0) {
    Parser_setContextFlags(receiver, NodeFlagsAwaitContext, true);
  }
  const parameters = Parser_parseParameters(receiver, signatureFlags);
  const returnType = Parser_parseReturnType(receiver, KindColonToken, false /*isType*/);
  const body = Parser_parseFunctionBlockOrSemicolon(receiver, signatureFlags, diagnostics.X_or_expected);
  receiver!.contextFlags = saveContextFlags;
  const result = Parser_finishNode(receiver, NewFunctionDeclaration(receiver!.factory, modifiers, asteriskToken, name, typeParameters, parameters, returnType, undefined /*fullSignature*/, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassDeclaration","kind":"method","status":"implemented","sigHash":"918b0ced8645dc500ca4ba71362a517688566a438396840f3407bf826bf9af71","bodyHash":"cb8683f01958488b63c2e48202c606a3bd2265bbba7558243eb9029aae8eeace"}
 *
 * Go source:
 * func (p *Parser) parseClassDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	return p.parseClassDeclarationOrExpression(pos, jsdoc, modifiers, ast.KindClassDeclaration)
 * }
 */
export function Parser_parseClassDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  return Parser_parseClassDeclarationOrExpression(receiver, pos, jsdoc, modifiers, KindClassDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isExportModifier","kind":"func","status":"implemented","sigHash":"511ee50c7c9e63ea74848300b2e6ab468c8971e856819f47753a5c42fef402cc","bodyHash":"2cabc2d93d488ca7cb9790938231b268c201861e957783e2e2f6757304665ae2"}
 *
 * Go source:
 * func isExportModifier(modifier *ast.Node) bool {
 * 	return modifier.Kind == ast.KindExportKeyword
 * }
 */
export function isExportModifier(modifier: GoPtr<Node>): bool {
  return modifier!.Kind === KindExportKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassElement","kind":"method","status":"implemented","sigHash":"4fa00fcaffecdab6582e5aabe4c21f181381de48742559f9b1644c194e858913","bodyHash":"7c05b5f4b136ea5ff758c56b410d1d963c24b7ba0c4a1b9379295baa24395102"}
 *
 * Go source:
 * func (p *Parser) parseClassElement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	if p.token == ast.KindSemicolonToken {
 * 		p.nextToken()
 * 		result := p.finishNode(p.factory.NewSemicolonClassElement(), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		return result
 * 	}
 * 	modifiers := p.parseModifiersEx(true /*allowDecorators* /, true /*permitConstAsModifier* /, true /*stopOnStartOfClassStaticBlock* /)
 * 	if p.token == ast.KindStaticKeyword && p.lookAhead((*Parser).nextTokenIsOpenBrace) {
 * 		return p.parseClassStaticBlockDeclaration(pos, jsdoc, modifiers)
 * 	}
 * 	if p.parseContextualModifier(ast.KindGetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindGetAccessor, ParseFlagsNone)
 * 	}
 * 	if p.parseContextualModifier(ast.KindSetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindSetAccessor, ParseFlagsNone)
 * 	}
 * 	if p.token == ast.KindConstructorKeyword || p.token == ast.KindStringLiteral {
 * 		constructorDeclaration := p.tryParseConstructorDeclaration(pos, jsdoc, modifiers)
 * 		if constructorDeclaration != nil {
 * 			return constructorDeclaration
 * 		}
 * 	}
 * 	if p.isIndexSignature() {
 * 		return p.checkJSSyntax(p.parseIndexSignatureDeclaration(pos, jsdoc, modifiers))
 * 	}
 * 	// It is very important that we check this *after* checking indexers because
 * 	// the [ token can start an index signature or a computed property name
 * 	if tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindStringLiteral || p.token == ast.KindNumericLiteral || p.token == ast.KindBigIntLiteral || p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBracketToken {
 * 		isAmbient := modifiers != nil && core.Some(modifiers.Nodes, isDeclareModifier)
 * 		if isAmbient {
 * 			for _, m := range modifiers.Nodes {
 * 				m.Flags |= ast.NodeFlagsAmbient
 * 			}
 * 			saveContextFlags := p.contextFlags
 * 			p.setContextFlags(ast.NodeFlagsAmbient, true)
 * 			result := p.parsePropertyOrMethodDeclaration(pos, jsdoc, modifiers)
 * 			p.contextFlags = saveContextFlags
 * 			return result
 * 		} else {
 * 			return p.parsePropertyOrMethodDeclaration(pos, jsdoc, modifiers)
 * 		}
 * 	}
 * 	if modifiers != nil {
 * 		// treat this as a property declaration with a missing name.
 * 		p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.Declaration_expected)
 * 		name := p.createMissingIdentifier()
 * 		return p.parsePropertyDeclaration(pos, jsdoc, modifiers, name, nil /*questionToken* /)
 * 	}
 * 	// 'isClassMemberStart' should have hinted not to attempt parsing.
 * 	panic("Should not have attempted to parse class member declaration.")
 * }
 */
export function Parser_parseClassElement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  if (receiver!.token === KindSemicolonToken) {
    Parser_nextToken(receiver);
    const result = Parser_finishNode(receiver, NewSemicolonClassElement(receiver!.factory), pos);
    Parser_withJSDoc(receiver, result, jsdoc);
    return result;
  }
  const modifiers = Parser_parseModifiersEx(receiver, true /*allowDecorators*/, true /*permitConstAsModifier*/, true /*stopOnStartOfClassStaticBlock*/);
  if (receiver!.token === KindStaticKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsOpenBrace)) {
    return Parser_parseClassStaticBlockDeclaration(receiver, pos, jsdoc, modifiers);
  }
  if (Parser_parseContextualModifier(receiver, KindGetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindGetAccessor, ParseFlagsNone);
  }
  if (Parser_parseContextualModifier(receiver, KindSetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindSetAccessor, ParseFlagsNone);
  }
  if (receiver!.token === KindConstructorKeyword || receiver!.token === KindStringLiteral) {
    const constructorDeclaration = Parser_tryParseConstructorDeclaration(receiver, pos, jsdoc, modifiers);
    if (constructorDeclaration !== undefined) {
      return constructorDeclaration;
    }
  }
  if (Parser_isIndexSignature(receiver)) {
    return Parser_checkJSSyntax(receiver, Parser_parseIndexSignatureDeclaration(receiver, pos, jsdoc, modifiers));
  }
  // It is very important that we check this *after* checking indexers because
  // the [ token can start an index signature or a computed property name
  if (
    tokenIsIdentifierOrKeyword(receiver!.token) ||
    receiver!.token === KindStringLiteral ||
    receiver!.token === KindNumericLiteral ||
    receiver!.token === KindBigIntLiteral ||
    receiver!.token === KindAsteriskToken ||
    receiver!.token === KindOpenBracketToken
  ) {
    const isAmbient = modifiers !== undefined && Some(modifiers.Nodes, isDeclareModifier);
    if (isAmbient) {
      for (const m of modifiers!.Nodes) {
        m!.Flags |= NodeFlagsAmbient;
      }
      const saveContextFlags = receiver!.contextFlags;
      Parser_setContextFlags(receiver, NodeFlagsAmbient, true);
      const result = Parser_parsePropertyOrMethodDeclaration(receiver, pos, jsdoc, modifiers);
      receiver!.contextFlags = saveContextFlags;
      return result;
    } else {
      return Parser_parsePropertyOrMethodDeclaration(receiver, pos, jsdoc, modifiers);
    }
  }
  if (modifiers !== undefined) {
    // treat this as a property declaration with a missing name.
    Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), diagnostics.Declaration_expected);
    const name = Parser_createMissingIdentifier(receiver);
    return Parser_parsePropertyDeclaration(receiver, pos, jsdoc, modifiers, name, undefined /*questionToken*/);
  }
  // 'isClassMemberStart' should have hinted not to attempt parsing.
  throw new globalThis.Error("Should not have attempted to parse class member declaration.");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"7d7ac2fec8bd3cb9444c08a55dc773f43c2084ad535771bd65f79f9935a7b8f5","bodyHash":"03625702a3db1839d942ea80cc3be783976a1ad2d8b28db4287dc0d4fb79e359"}
 *
 * Go source:
 * func (p *Parser) parseClassStaticBlockDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	p.parseExpectedToken(ast.KindStaticKeyword)
 * 	body := p.parseClassStaticBlockBody()
 * 	result := p.finishNode(p.factory.NewClassStaticBlockDeclaration(modifiers, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseClassStaticBlockDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  Parser_parseExpectedToken(receiver, KindStaticKeyword);
  const body = Parser_parseClassStaticBlockBody(receiver);
  const result = Parser_finishNode(receiver, NewClassStaticBlockDeclaration(receiver!.factory, modifiers, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassStaticBlockBody","kind":"method","status":"implemented","sigHash":"63f396e9a5410d7a7257521a9f9088ce39d1e38f913c80b156d0deb71f63037e","bodyHash":"88992095ace2bb3d932cc03a73ce905cfe8930039eec2c643fb620515d37c7d2"}
 *
 * Go source:
 * func (p *Parser) parseClassStaticBlockBody() *ast.Node {
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsYieldContext, false)
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, true)
 * 	body := p.parseBlock(false /*ignoreMissingOpenBrace* /, nil /*diagnosticMessage* /)
 * 	p.contextFlags = saveContextFlags
 * 	return body
 * }
 */
export function Parser_parseClassStaticBlockBody(receiver: GoPtr<Parser>): GoPtr<Node> {
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsYieldContext, false);
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, true);
  const body = Parser_parseBlock(receiver, false /*ignoreMissingOpenBrace*/, undefined /*diagnosticMessage*/);
  receiver!.contextFlags = saveContextFlags;
  return body;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseConstructorDeclaration","kind":"method","status":"implemented","sigHash":"4bc3985f91f555adcf80f8907c13c48285f081627518efc08db04dd606e39344","bodyHash":"765b69b048bf17505a1b9874304d1a2e536ed33f3fa8c7d4998f7e75bb813484"}
 *
 * Go source:
 * func (p *Parser) tryParseConstructorDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	state := p.mark()
 * 	if p.token == ast.KindConstructorKeyword || p.token == ast.KindStringLiteral && p.scanner.TokenValue() == "constructor" && p.lookAhead((*Parser).nextTokenIsOpenParen) {
 * 		p.nextToken()
 * 		typeParameters := p.parseTypeParameters()
 * 		parameters := p.parseParameters(ParseFlagsNone)
 * 		returnType := p.parseReturnType(ast.KindColonToken, false /*isType* /)
 * 		body := p.parseFunctionBlockOrSemicolon(ParseFlagsNone, diagnostics.X_or_expected)
 * 		result := p.finishNode(p.factory.NewConstructorDeclaration(modifiers, typeParameters, parameters, returnType, nil /*fullSignature* /, body), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		p.checkJSSyntax(result)
 * 		return result
 * 	}
 * 	p.rewind(state)
 * 	return nil
 * }
 */
export function Parser_tryParseConstructorDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const state = Parser_mark(receiver);
  if (receiver!.token === KindConstructorKeyword || (receiver!.token === KindStringLiteral && Scanner_TokenValue(receiver!.scanner) === "constructor" && Parser_lookAhead(receiver, Parser_nextTokenIsOpenParen))) {
    Parser_nextToken(receiver);
    const typeParameters = Parser_parseTypeParameters(receiver);
    const parameters = Parser_parseParameters(receiver, ParseFlagsNone);
    const returnType = Parser_parseReturnType(receiver, KindColonToken, false /*isType*/);
    const body = Parser_parseFunctionBlockOrSemicolon(receiver, ParseFlagsNone, diagnostics.X_or_expected);
    const result = Parser_finishNode(receiver, NewConstructorDeclaration(receiver!.factory, modifiers, typeParameters, parameters, returnType, undefined /*fullSignature*/, body), pos);
    Parser_withJSDoc(receiver, result, jsdoc);
    Parser_checkJSSyntax(receiver, result);
    return result;
  }
  Parser_rewind(receiver, state);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyOrMethodDeclaration","kind":"method","status":"implemented","sigHash":"c434e9b0feb58b401ed2e3049d5e1930c68103ec7a11d7a731e610a38d6846c0","bodyHash":"dd7ad4eb41e6937796b17bc110529f7e93c57b5c410b879c8ab9241250bc2737"}
 *
 * Go source:
 * func (p *Parser) parsePropertyOrMethodDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	asteriskToken := p.parseOptionalToken(ast.KindAsteriskToken)
 * 	name := p.parsePropertyName()
 * 	// Note: this is not legal as per the grammar.  But we allow it in the parser and
 * 	// report an error in the grammar checker.
 * 	questionToken := p.parseOptionalToken(ast.KindQuestionToken)
 * 	if asteriskToken != nil || p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken {
 * 		return p.parseMethodDeclaration(pos, jsdoc, modifiers, asteriskToken, name, questionToken, diagnostics.X_or_expected)
 * 	}
 * 	return p.parsePropertyDeclaration(pos, jsdoc, modifiers, name, questionToken)
 * }
 */
export function Parser_parsePropertyOrMethodDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const asteriskToken = Parser_parseOptionalToken(receiver, KindAsteriskToken);
  const name = Parser_parsePropertyName(receiver);
  // Note: this is not legal as per the grammar.  But we allow it in the parser and
  // report an error in the grammar checker.
  const questionToken = Parser_parseOptionalToken(receiver, KindQuestionToken);
  if (asteriskToken !== undefined || receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) {
    return Parser_parseMethodDeclaration(receiver, pos, jsdoc, modifiers, asteriskToken, name, questionToken, diagnostics.X_or_expected);
  }
  return Parser_parsePropertyDeclaration(receiver, pos, jsdoc, modifiers, name, questionToken);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseMethodDeclaration","kind":"method","status":"implemented","sigHash":"7d95403a77a868a9e3f4438777a90dae25ea9c2deab494e35065aab57ed943a2","bodyHash":"68216b9f35e37c32ee287767384164532b567f4dab299728759d6dc58e24ff3a"}
 *
 * Go source:
 * func (p *Parser) parseMethodDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, asteriskToken *ast.Node, name *ast.Node, questionToken *ast.Node, diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	signatureFlags := core.IfElse(asteriskToken != nil, ParseFlagsYield, ParseFlagsNone) | core.IfElse(modifierListHasAsync(modifiers), ParseFlagsAwait, ParseFlagsNone)
 * 	typeParameters := p.parseTypeParameters()
 * 	parameters := p.parseParameters(signatureFlags)
 * 	typeNode := p.parseReturnType(ast.KindColonToken, false /*isType* /)
 * 	body := p.parseFunctionBlockOrSemicolon(signatureFlags, diagnosticMessage)
 * 	result := p.finishNode(p.factory.NewMethodDeclaration(modifiers, asteriskToken, name, questionToken, typeParameters, parameters, typeNode, nil /*fullSignature* /, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseMethodDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, asteriskToken: GoPtr<Node>, name: GoPtr<Node>, questionToken: GoPtr<Node>, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  const signatureFlags = IfElse(asteriskToken !== undefined, ParseFlagsYield, ParseFlagsNone) | IfElse(modifierListHasAsync(modifiers), ParseFlagsAwait, ParseFlagsNone);
  const typeParameters = Parser_parseTypeParameters(receiver);
  const parameters = Parser_parseParameters(receiver, signatureFlags);
  const typeNode = Parser_parseReturnType(receiver, KindColonToken, false /*isType*/);
  const body = Parser_parseFunctionBlockOrSemicolon(receiver, signatureFlags, diagnosticMessage);
  const result = Parser_finishNode(receiver, NewMethodDeclaration(receiver!.factory, modifiers, asteriskToken, name, questionToken, typeParameters, parameters, typeNode, undefined /*fullSignature*/, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyDeclaration","kind":"method","status":"implemented","sigHash":"72b36d0155776f915647c576c2898e5adad7a6f4e5807cf28b9fd59087742450","bodyHash":"10ae77126c6e7d552a29944cce0de3b578ea5583395c16eb0163d7c7a66760c3"}
 *
 * Go source:
 * func (p *Parser) parsePropertyDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, name *ast.Node, questionToken *ast.Node) *ast.Node {
 * 	postfixToken := questionToken
 * 	if postfixToken == nil && !p.hasPrecedingLineBreak() {
 * 		postfixToken = p.parseOptionalToken(ast.KindExclamationToken)
 * 	}
 * 	typeNode := p.parseTypeAnnotation()
 * 	initializer := doInContext(p, ast.NodeFlagsYieldContext|ast.NodeFlagsAwaitContext|ast.NodeFlagsDisallowInContext, false, (*Parser).parseInitializer)
 * 	p.parseSemicolonAfterPropertyName(name, typeNode, initializer)
 * 	result := p.finishNode(p.factory.NewPropertyDeclaration(modifiers, name, postfixToken, typeNode, initializer), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parsePropertyDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, name: GoPtr<Node>, questionToken: GoPtr<Node>): GoPtr<Node> {
  const postfixToken: GoPtr<Node> = questionToken === undefined && !Parser_hasPrecedingLineBreak(receiver) ? Parser_parseOptionalToken(receiver, KindExclamationToken) : questionToken;
  const typeNode = Parser_parseTypeAnnotation(receiver);
  const initializer = doInContext(receiver, NodeFlagsYieldContext | NodeFlagsAwaitContext | NodeFlagsDisallowInContext, false, Parser_parseInitializer);
  Parser_parseSemicolonAfterPropertyName(receiver, name, typeNode, initializer);
  const result = Parser_finishNode(receiver, NewPropertyDeclaration(receiver!.factory, modifiers, name, postfixToken, typeNode, initializer), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseErrorForMissingSemicolonAfter","kind":"method","status":"implemented","sigHash":"539d55c11656158e211882de24ec2dfa841fb021f18dae6af059c110b670e9a6","bodyHash":"f1bef6e51a297f800966f27d2d964c4195ae12276a4fbd045e9f51edbccd5618"}
 *
 * Go source:
 * func (p *Parser) parseErrorForMissingSemicolonAfter(node *ast.Node) {
 * 	// Tagged template literals are sometimes used in places where only simple strings are allowed, i.e.:
 * 	//   module `M1` {
 * 	//   ^^^^^^^^^^^ This block is parsed as a template literal like module`M1`.
 * 	if node.Kind == ast.KindTaggedTemplateExpression {
 * 		p.parseErrorAtRange(p.skipRangeTrivia(node.AsTaggedTemplateExpression().Template.Loc), diagnostics.Module_declaration_names_may_only_use_or_quoted_strings)
 * 		return
 * 	}
 * 	// Otherwise, if this isn't a well-known keyword-like identifier, give the generic fallback message.
 * 	var expressionText string
 * 	if node.Kind == ast.KindIdentifier {
 * 		expressionText = node.Text()
 * 	}
 * 	if expressionText == "" {
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindSemicolonToken))
 * 		return
 * 	}
 * 	pos := scanner.SkipTrivia(p.sourceText, node.Pos())
 * 	// Some known keywords are likely signs of syntax being used improperly.
 * 	switch expressionText {
 * 	case "const", "let", "var":
 * 		p.parseErrorAt(pos, node.End(), diagnostics.Variable_declaration_not_allowed_at_this_location)
 * 		return
 * 	case "declare":
 * 		// If a declared node failed to parse, it would have emitted a diagnostic already.
 * 		return
 * 	case "interface":
 * 		p.parseErrorForInvalidName(diagnostics.Interface_name_cannot_be_0, diagnostics.Interface_must_be_given_a_name, ast.KindOpenBraceToken)
 * 		return
 * 	case "is":
 * 		p.parseErrorAt(pos, p.scanner.TokenStart(), diagnostics.A_type_predicate_is_only_allowed_in_return_type_position_for_functions_and_methods)
 * 		return
 * 	case "module", "namespace":
 * 		p.parseErrorForInvalidName(diagnostics.Namespace_name_cannot_be_0, diagnostics.Namespace_must_be_given_a_name, ast.KindOpenBraceToken)
 * 		return
 * 	case "type":
 * 		p.parseErrorForInvalidName(diagnostics.Type_alias_name_cannot_be_0, diagnostics.Type_alias_must_be_given_a_name, ast.KindEqualsToken)
 * 		return
 * 	}
 * 	// The user alternatively might have misspelled or forgotten to add a space after a common keyword.
 * 	suggestion := core.GetSpellingSuggestionForStrings(expressionText, slices.Values(viableKeywordSuggestions))
 * 	if suggestion == "" {
 * 		suggestion = getSpaceSuggestion(expressionText)
 * 	}
 * 	if suggestion != "" {
 * 		p.parseErrorAt(pos, node.End(), diagnostics.Unknown_keyword_or_identifier_Did_you_mean_0, suggestion)
 * 		return
 * 	}
 * 	// Unknown tokens are handled with their own errors in the scanner
 * 	if p.token == ast.KindUnknown {
 * 		return
 * 	}
 * 	// Otherwise, we know this some kind of unknown word, not just a missing expected semicolon.
 * 	p.parseErrorAt(pos, node.End(), diagnostics.Unexpected_keyword_or_identifier)
 * }
 */
export function Parser_parseErrorForMissingSemicolonAfter(receiver: GoPtr<Parser>, node: GoPtr<Node>): void {
  // Tagged template literals are sometimes used in places where only simple strings are allowed, i.e.:
  //   module `M1` {
  //   ^^^^^^^^^^^ This block is parsed as a template literal like module`M1`.
  if (node!.Kind === KindTaggedTemplateExpression) {
    Parser_parseErrorAtRange(receiver, Parser_skipRangeTrivia(receiver, AsTaggedTemplateExpression(node)!.Template!.Loc), diagnostics.Module_declaration_names_may_only_use_or_quoted_strings);
    return;
  }
  // Otherwise, if this isn't a well-known keyword-like identifier, give the generic fallback message.
  let expressionText = "";
  if (node!.Kind === KindIdentifier) {
    expressionText = Node_Text(node);
  }
  if (expressionText === "") {
    Parser_parseErrorAtCurrentToken(receiver, diagnostics.X_0_expected, TokenToString(KindSemicolonToken));
    return;
  }
  const pos = SkipTrivia(receiver!.sourceText, Node_Pos(node));
  // Some known keywords are likely signs of syntax being used improperly.
  switch (expressionText) {
    case "const":
    case "let":
    case "var":
      Parser_parseErrorAt(receiver, pos, Node_End(node), diagnostics.Variable_declaration_not_allowed_at_this_location);
      return;
    case "declare":
      // If a declared node failed to parse, it would have emitted a diagnostic already.
      return;
    case "interface":
      Parser_parseErrorForInvalidName(receiver, diagnostics.Interface_name_cannot_be_0, diagnostics.Interface_must_be_given_a_name, KindOpenBraceToken);
      return;
    case "is":
      Parser_parseErrorAt(receiver, pos, Scanner_TokenStart(receiver!.scanner), diagnostics.A_type_predicate_is_only_allowed_in_return_type_position_for_functions_and_methods);
      return;
    case "module":
    case "namespace":
      Parser_parseErrorForInvalidName(receiver, diagnostics.Namespace_name_cannot_be_0, diagnostics.Namespace_must_be_given_a_name, KindOpenBraceToken);
      return;
    case "type":
      Parser_parseErrorForInvalidName(receiver, diagnostics.Type_alias_name_cannot_be_0, diagnostics.Type_alias_must_be_given_a_name, KindEqualsToken);
      return;
  }
  // The user alternatively might have misspelled or forgotten to add a space after a common keyword.
  let suggestion = GetSpellingSuggestionForStrings(expressionText, Values(viableKeywordSuggestions as GoSlice<string>));
  if (suggestion === "") {
    suggestion = getSpaceSuggestion(expressionText);
  }
  if (suggestion !== "") {
    Parser_parseErrorAt(receiver, pos, Node_End(node), diagnostics.Unknown_keyword_or_identifier_Did_you_mean_0, suggestion);
    return;
  }
  // Unknown tokens are handled with their own errors in the scanner
  if (receiver!.token === KindUnknown) {
    return;
  }
  // Otherwise, we know this some kind of unknown word, not just a missing expected semicolon.
  Parser_parseErrorAt(receiver, pos, Node_End(node), diagnostics.Unexpected_keyword_or_identifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseErrorForInvalidName","kind":"method","status":"implemented","sigHash":"1e38f7e2fea5b18f164093a60864b0d3a4754ec493fd68be7b2bbc2187c667ed","bodyHash":"7142b50ed2d55014d6b7e2505c8b800be8ab8040cc498112bd98a806f57d1f3e"}
 *
 * Go source:
 * func (p *Parser) parseErrorForInvalidName(nameDiagnostic *diagnostics.Message, blankDiagnostic *diagnostics.Message, tokenIfBlankName ast.Kind) {
 * 	if p.token == tokenIfBlankName {
 * 		p.parseErrorAtCurrentToken(blankDiagnostic)
 * 	} else {
 * 		p.parseErrorAtCurrentToken(nameDiagnostic, p.scanner.TokenValue())
 * 	}
 * }
 */
export function Parser_parseErrorForInvalidName(receiver: GoPtr<Parser>, nameDiagnostic: GoPtr<Message>, blankDiagnostic: GoPtr<Message>, tokenIfBlankName: Kind): void {
  if (receiver!.token === tokenIfBlankName) {
    Parser_parseErrorAtCurrentToken(receiver, blankDiagnostic);
  } else {
    Parser_parseErrorAtCurrentToken(receiver, nameDiagnostic, Scanner_TokenValue(receiver!.scanner));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"644e52521343e22d101a91d342214c87d6c9141c65970adef67f2aa4a31ffe80","bodyHash":"d4f3cfef7ea6375904bdfed7ef946cdfa86921080a24deccf0d510c83b71d75f"}
 *
 * Go source:
 * func (p *Parser) parseInterfaceDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	p.parseExpected(ast.KindInterfaceKeyword)
 * 	name := p.parseIdentifier()
 * 	typeParameters := p.parseTypeParameters()
 * 	heritageClauses := p.parseHeritageClauses()
 * 	members := p.parseObjectTypeMembers()
 * 	result := p.finishNode(p.factory.NewInterfaceDeclaration(modifiers, name, typeParameters, heritageClauses, members), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseInterfaceDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  Parser_parseExpected(receiver, KindInterfaceKeyword);
  const name = Parser_parseIdentifier(receiver);
  const typeParameters = Parser_parseTypeParameters(receiver);
  const heritageClauses = Parser_parseHeritageClauses(receiver);
  const members = Parser_parseObjectTypeMembers(receiver);
  const result = Parser_finishNode(receiver, NewInterfaceDeclaration(receiver!.factory, modifiers, name, typeParameters, heritageClauses, members), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsNotDot","kind":"method","status":"implemented","sigHash":"fe1210fca940b5ba364856105af061667ab13941938a002817c778f607900874","bodyHash":"41dc0c60bf73c45bab55a45b873e9affea245d0fd073a8de7d9e4b055d42eb26"}
 *
 * Go source:
 * func (p *Parser) nextIsNotDot() bool {
 * 	return p.nextToken() != ast.KindDotToken
 * }
 */
export function Parser_nextIsNotDot(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) !== KindDotToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEnumDeclaration","kind":"method","status":"implemented","sigHash":"209430ccffb95906a9db77793d192856820104d4fdb97d5816b1320063961b9f","bodyHash":"303c8287c55f4980e32e6a3c02aeac7c3b84e3228b88ecf0c0be3727eb3191b4"}
 *
 * Go source:
 * func (p *Parser) parseEnumDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	p.parseExpected(ast.KindEnumKeyword)
 * 	name := p.parseIdentifier()
 * 	var members *ast.NodeList
 * 	if p.parseExpected(ast.KindOpenBraceToken) {
 * 		saveContextFlags := p.contextFlags
 * 		p.setContextFlags(ast.NodeFlagsYieldContext|ast.NodeFlagsAwaitContext, false)
 * 		members = p.parseDelimitedList(PCEnumMembers, (*Parser).parseEnumMember)
 * 		p.contextFlags = saveContextFlags
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 	} else {
 * 		members = p.createMissingList()
 * 	}
 * 	result := p.finishNode(p.factory.NewEnumDeclaration(modifiers, name, members), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return result
 * }
 */
export function Parser_parseEnumDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  Parser_parseExpected(receiver, KindEnumKeyword);
  const name = Parser_parseIdentifier(receiver);
  const members: GoPtr<NodeList> = ((): GoPtr<NodeList> => {
    if (Parser_parseExpected(receiver, KindOpenBraceToken)) {
      const saveContextFlags = receiver!.contextFlags;
      Parser_setContextFlags(receiver, NodeFlagsYieldContext | NodeFlagsAwaitContext, false);
      const m = Parser_parseDelimitedList(receiver, PCEnumMembers, Parser_parseEnumMember);
      receiver!.contextFlags = saveContextFlags;
      Parser_parseExpected(receiver, KindCloseBraceToken);
      return m;
    } else {
      return Parser_createMissingList(receiver);
    }
  })();
  const result = Parser_finishNode(receiver, NewEnumDeclaration(receiver!.factory, modifiers, name, members), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleDeclaration","kind":"method","status":"implemented","sigHash":"b4aa054cd940aae7f01be39ca1ee7f596073c1376e586bcf5a0a178d4b8729de","bodyHash":"4115e9ce947f8e12e5594fe9864b86ba77b059fe2b8d68213cf4cbf3eaf53e56"}
 *
 * Go source:
 * func (p *Parser) parseModuleDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Statement {
 * 	keyword := ast.KindModuleKeyword
 * 	if p.token == ast.KindGlobalKeyword {
 * 		// global augmentation
 * 		return p.parseAmbientExternalModuleDeclaration(pos, jsdoc, modifiers)
 * 	} else if p.parseOptional(ast.KindNamespaceKeyword) {
 * 		keyword = ast.KindNamespaceKeyword
 * 	} else {
 * 		p.parseExpected(ast.KindModuleKeyword)
 * 		if p.token == ast.KindStringLiteral {
 * 			return p.parseAmbientExternalModuleDeclaration(pos, jsdoc, modifiers)
 * 		}
 * 	}
 * 	return p.parseModuleOrNamespaceDeclaration(pos, jsdoc, modifiers, false /*nested* /, keyword)
 * }
 */
export function Parser_parseModuleDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Statement> {
  if (receiver!.token === KindGlobalKeyword) {
    // global augmentation
    return Parser_parseAmbientExternalModuleDeclaration(receiver, pos, jsdoc, modifiers);
  } else if (Parser_parseOptional(receiver, KindNamespaceKeyword)) {
    return Parser_parseModuleOrNamespaceDeclaration(receiver, pos, jsdoc, modifiers, false /*nested*/, KindNamespaceKeyword);
  } else {
    Parser_parseExpected(receiver, KindModuleKeyword);
    if (receiver!.token === KindStringLiteral) {
      return Parser_parseAmbientExternalModuleDeclaration(receiver, pos, jsdoc, modifiers);
    }
  }
  return Parser_parseModuleOrNamespaceDeclaration(receiver, pos, jsdoc, modifiers, false /*nested*/, KindModuleKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAmbientExternalModuleDeclaration","kind":"method","status":"implemented","sigHash":"4742bb0c072cc403d43f8014b78cd337424233e796616f7a2fc645854fbfdfb2","bodyHash":"30c4c21f1b072159f1e47fb33eae62da85cb1308e4f697e588bd6e4e89e28eeb"}
 *
 * Go source:
 * func (p *Parser) parseAmbientExternalModuleDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	var name *ast.Node
 * 	keyword := ast.KindModuleKeyword
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	if p.token == ast.KindGlobalKeyword {
 * 		// parse 'global' as name of global scope augmentation
 * 		name = p.parseIdentifier()
 * 		keyword = ast.KindGlobalKeyword
 * 	} else {
 * 		// parse string literal
 * 		name = p.parseLiteralExpression(true /*intern* /)
 * 	}
 * 	var body *ast.Node
 * 	if p.token == ast.KindOpenBraceToken {
 * 		body = p.parseModuleBlock()
 * 	} else {
 * 		p.parseSemicolon()
 * 	}
 * 	result := p.finishNode(p.factory.NewModuleDeclaration(modifiers, keyword, name, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return result
 * }
 */
export function Parser_parseAmbientExternalModuleDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const [name, keyword]: [GoPtr<Node>, Kind] =
    receiver!.token === KindGlobalKeyword
      ? // parse 'global' as name of global scope augmentation
        [Parser_parseIdentifier(receiver), KindGlobalKeyword]
      : // parse string literal
        [Parser_parseLiteralExpression(receiver, true /*intern*/), KindModuleKeyword];
  const body: GoPtr<Node> = ((): GoPtr<Node> => {
    if (receiver!.token === KindOpenBraceToken) {
      return Parser_parseModuleBlock(receiver);
    } else {
      Parser_parseSemicolon(receiver);
      return undefined;
    }
  })();
  const result = Parser_finishNode(receiver, NewModuleDeclaration(receiver!.factory, modifiers, keyword, name, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleBlock","kind":"method","status":"implemented","sigHash":"28b7a425e3b92c0045bf1e36d43551f62a9703b8b2844836f3733756e1a13f74","bodyHash":"d5576794f01bc66cb4bbef6631f55df1fabeeaddc7e4429d516fd7a65c839425"}
 *
 * Go source:
 * func (p *Parser) parseModuleBlock() *ast.Node {
 * 	pos := p.nodePos()
 * 	var statements *ast.NodeList
 * 	if p.parseExpected(ast.KindOpenBraceToken) {
 * 		statements = p.parseList(PCBlockStatements, (*Parser).parseStatement)
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 	} else {
 * 		statements = p.createMissingList()
 * 	}
 * 	return p.finishNode(p.factory.NewModuleBlock(statements), pos)
 * }
 */
export function Parser_parseModuleBlock(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const statements: GoPtr<NodeList> = ((): GoPtr<NodeList> => {
    if (Parser_parseExpected(receiver, KindOpenBraceToken)) {
      const s = Parser_parseList(receiver, PCBlockStatements, Parser_parseStatement);
      Parser_parseExpected(receiver, KindCloseBraceToken);
      return s;
    } else {
      return Parser_createMissingList(receiver);
    }
  })();
  return Parser_finishNode(receiver, NewModuleBlock(receiver!.factory, statements), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleOrNamespaceDeclaration","kind":"method","status":"implemented","sigHash":"fe7dd4854096dc00ac97f66c6e7aa53fb4c2a77e31582110d6d6d6a2def9f03e","bodyHash":"a245e6d6391e0241a3f31d25578b7d6434e414b6fb3770c4b6bc446d3a551c54"}
 *
 * Go source:
 * func (p *Parser) parseModuleOrNamespaceDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, nested bool, keyword ast.Kind) *ast.Node {
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	var name *ast.Node
 * 	if nested {
 * 		name = p.parseIdentifierName()
 * 	} else {
 * 		name = p.parseIdentifier()
 * 	}
 * 	var body *ast.Node
 * 	if p.parseOptional(ast.KindDotToken) {
 * 		implicitExport := p.factory.NewModifier(ast.KindExportKeyword)
 * 		implicitExport.Loc = core.NewTextRange(p.nodePos(), p.nodePos())
 * 		implicitExport.Flags = ast.NodeFlagsReparsed
 * 		implicitModifiers := p.newModifierList(implicitExport.Loc, p.nodeSliceArena.NewSlice1(implicitExport))
 * 		body = p.parseModuleOrNamespaceDeclaration(p.nodePos(), 0 /*jsdoc* /, implicitModifiers, true /*nested* /, keyword)
 * 	} else {
 * 		body = p.parseModuleBlock()
 * 	}
 * 	result := p.finishNode(p.factory.NewModuleDeclaration(modifiers, keyword, name, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return result
 * }
 */
export function Parser_parseModuleOrNamespaceDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, nested: bool, keyword: Kind): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const name = nested ? Parser_parseIdentifierName(receiver) : Parser_parseIdentifier(receiver);
  let body: GoPtr<Node>;
  if (Parser_parseOptional(receiver, KindDotToken)) {
    const implicitExport = NodeFactory_NewModifier(receiver!.factory, KindExportKeyword);
    implicitExport!.Loc = NewTextRange(Parser_nodePos(receiver), Parser_nodePos(receiver));
    implicitExport!.Flags = NodeFlagsReparsed;
    const implicitModifiers = Parser_newModifierList(receiver, implicitExport!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, implicitExport));
    body = Parser_parseModuleOrNamespaceDeclaration(receiver, Parser_nodePos(receiver), 0 as jsdocScannerInfo, implicitModifiers, true, keyword);
  } else {
    body = Parser_parseModuleBlock(receiver);
  }
  const result = Parser_finishNode(receiver, NewModuleDeclaration(receiver!.factory, modifiers, keyword, name, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportDeclarationOrImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"a8d325856f2d7e82db9cb8573522e687c2d799ca4767e6be80abb4981c5168c1","bodyHash":"84c9633b7b63547a56e23b599b8863e016b3b2f6282b4a2a71d079368edf9f3e"}
 *
 * Go source:
 * func (p *Parser) parseImportDeclarationOrImportEqualsDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Statement {
 * 	p.parseExpected(ast.KindImportKeyword)
 * 	afterImportPos := p.nodePos()
 * 	// We don't parse the identifier here in await context, instead we will report a grammar error in the checker.
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	var identifier *ast.Node
 * 	if p.isIdentifier() {
 * 		identifier = p.parseIdentifier()
 * 	}
 * 	phaseModifier := ast.KindUnknown
 * 	if identifier != nil && identifier.Text() == "type" &&
 * 		(p.token != ast.KindFromKeyword || p.isIdentifier() && p.lookAhead((*Parser).nextTokenIsFromKeywordOrEqualsToken)) &&
 * 		(p.isIdentifier() || p.tokenAfterImportDefinitelyProducesImportDeclaration()) {
 * 		phaseModifier = ast.KindTypeKeyword
 * 		identifier = nil
 * 		if p.isIdentifier() {
 * 			identifier = p.parseIdentifier()
 * 		}
 * 	} else if identifier != nil && identifier.Text() == "defer" {
 * 		var shouldParseAsDeferModifier bool
 * 		if p.token == ast.KindFromKeyword {
 * 			shouldParseAsDeferModifier = !p.lookAhead((*Parser).nextTokenIsTokenStringLiteral)
 * 		} else {
 * 			shouldParseAsDeferModifier = p.token != ast.KindCommaToken && p.token != ast.KindEqualsToken
 * 		}
 * 		if shouldParseAsDeferModifier {
 * 			phaseModifier = ast.KindDeferKeyword
 * 			identifier = nil
 * 			if p.isIdentifier() {
 * 				identifier = p.parseIdentifier()
 * 			}
 * 		}
 * 	}
 * 	if identifier != nil && !p.tokenAfterImportedIdentifierDefinitelyProducesImportDeclaration() && phaseModifier != ast.KindDeferKeyword {
 * 		importEquals := p.checkJSSyntax(p.parseImportEqualsDeclaration(pos, jsdoc, modifiers, identifier, phaseModifier == ast.KindTypeKeyword))
 * 		p.statementHasAwaitIdentifier = saveHasAwaitIdentifier // Import= declaration is always parsed in an Await context, no need to reparse
 * 		return importEquals
 * 	}
 * 	importClause := p.tryParseImportClause(identifier, afterImportPos, phaseModifier, false /*skipJSDocLeadingAsterisks* /)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier // import clause is always parsed in an Await context
 * 	moduleSpecifier := p.parseModuleSpecifier()
 * 	attributes := p.tryParseImportAttributes()
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewImportDeclaration(modifiers, importClause, moduleSpecifier, attributes), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseImportDeclarationOrImportEqualsDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Statement> {
  Parser_parseExpected(receiver, KindImportKeyword);
  const afterImportPos = Parser_nodePos(receiver);
  // We don't parse the identifier here in await context, instead we will report a grammar error in the checker.
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  let identifier: GoPtr<Node>;
  if (Parser_isIdentifier(receiver)) {
    identifier = Parser_parseIdentifier(receiver);
  }
  let phaseModifier: Kind = KindUnknown;
  if (identifier !== undefined && Node_Text(identifier) === "type" &&
    (receiver!.token !== KindFromKeyword || Parser_isIdentifier(receiver) && Parser_lookAhead(receiver, Parser_nextTokenIsFromKeywordOrEqualsToken)) &&
    (Parser_isIdentifier(receiver) || Parser_tokenAfterImportDefinitelyProducesImportDeclaration(receiver))) {
    phaseModifier = KindTypeKeyword;
    identifier = undefined;
    if (Parser_isIdentifier(receiver)) {
      identifier = Parser_parseIdentifier(receiver);
    }
  } else if (identifier !== undefined && Node_Text(identifier) === "defer") {
    let shouldParseAsDeferModifier: bool;
    if (receiver!.token === KindFromKeyword) {
      shouldParseAsDeferModifier = !Parser_lookAhead(receiver, Parser_nextTokenIsTokenStringLiteral);
    } else {
      shouldParseAsDeferModifier = receiver!.token !== KindCommaToken && receiver!.token !== KindEqualsToken;
    }
    if (shouldParseAsDeferModifier) {
      phaseModifier = KindDeferKeyword;
      identifier = undefined;
      if (Parser_isIdentifier(receiver)) {
        identifier = Parser_parseIdentifier(receiver);
      }
    }
  }
  if (identifier !== undefined && !Parser_tokenAfterImportedIdentifierDefinitelyProducesImportDeclaration(receiver) && phaseModifier !== KindDeferKeyword) {
    const importEquals = Parser_checkJSSyntax(receiver, Parser_parseImportEqualsDeclaration(receiver, pos, jsdoc, modifiers, identifier, phaseModifier === KindTypeKeyword));
    receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier; // Import= declaration is always parsed in an Await context, no need to reparse
    return importEquals;
  }
  const importClause = Parser_tryParseImportClause(receiver, identifier, afterImportPos, phaseModifier, false /*skipJSDocLeadingAsterisks*/);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier; // import clause is always parsed in an Await context
  const moduleSpecifier = Parser_parseModuleSpecifier(receiver);
  const attributes = Parser_tryParseImportAttributes(receiver);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewImportDeclaration(receiver!.factory, modifiers, importClause, moduleSpecifier as GoPtr<Expression>, attributes), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tokenAfterImportDefinitelyProducesImportDeclaration","kind":"method","status":"implemented","sigHash":"80ca2c879ae4937889a0e11d288a38401b775213ce921734e8d1b49e5e167c20","bodyHash":"cda9d0c3d92b7fa22c58cf1990ab20dae73e495d3205ab61549ea46e144ef1dc"}
 *
 * Go source:
 * func (p *Parser) tokenAfterImportDefinitelyProducesImportDeclaration() bool {
 * 	return p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBraceToken
 * }
 */
export function Parser_tokenAfterImportDefinitelyProducesImportDeclaration(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindAsteriskToken || receiver!.token === KindOpenBraceToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tokenAfterImportedIdentifierDefinitelyProducesImportDeclaration","kind":"method","status":"implemented","sigHash":"dacce5c7dc8386c854b803b5df096a3f31fadf7b0196e08e74a959f78d6b6c9d","bodyHash":"e602d620f5c61c25609fe334f1d401487d8f7981c61da1b6c82cc537dabe71c8"}
 *
 * Go source:
 * func (p *Parser) tokenAfterImportedIdentifierDefinitelyProducesImportDeclaration() bool {
 * 	// In `import id ___`, the current token decides whether to produce
 * 	// an ImportDeclaration or ImportEqualsDeclaration.
 * 	return p.token == ast.KindCommaToken || p.token == ast.KindFromKeyword
 * }
 */
export function Parser_tokenAfterImportedIdentifierDefinitelyProducesImportDeclaration(receiver: GoPtr<Parser>): bool {
  // In `import id ___`, the current token decides whether to produce
  // an ImportDeclaration or ImportEqualsDeclaration.
  return receiver!.token === KindCommaToken || receiver!.token === KindFromKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"4a5a6078dff157e94390bee0189eb086a2fb65009f847e39dff0f44dce5a3cb7","bodyHash":"e98369ee593014b7b962e14bb7c5f76dab27596b40ab53d89674c248723fd947"}
 *
 * Go source:
 * func (p *Parser) parseImportEqualsDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, identifier *ast.Node, isTypeOnly bool) *ast.Node {
 * 	p.parseExpected(ast.KindEqualsToken)
 * 	moduleReference := p.parseModuleReference()
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewImportEqualsDeclaration(modifiers, isTypeOnly, identifier, moduleReference), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseImportEqualsDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, identifier: GoPtr<Node>, isTypeOnly: bool): GoPtr<Node> {
  Parser_parseExpected(receiver, KindEqualsToken);
  const moduleReference = Parser_parseModuleReference(receiver);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewImportEqualsDeclaration(receiver!.factory, modifiers, isTypeOnly, identifier, moduleReference), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleReference","kind":"method","status":"implemented","sigHash":"6e628b33dd703bc61aee7852202556c949ade2e02e7519c16454aeabd5539ee6","bodyHash":"68a8b0cda9f29a9d665c10b0f611d219198953bf62ce879a9d319608419f5f91"}
 *
 * Go source:
 * func (p *Parser) parseModuleReference() *ast.Node {
 * 	if p.token == ast.KindRequireKeyword && p.lookAhead((*Parser).nextTokenIsOpenParen) {
 * 		return p.parseExternalModuleReference()
 * 	}
 * 	return p.parseEntityName(false /*allowReservedWords* /, nil /*diagnosticMessage* /)
 * }
 */
export function Parser_parseModuleReference(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (receiver!.token === KindRequireKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsOpenParen)) {
    return Parser_parseExternalModuleReference(receiver);
  }
  return Parser_parseEntityName(receiver, false /*allowReservedWords*/, undefined /*diagnosticMessage*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExternalModuleReference","kind":"method","status":"implemented","sigHash":"a8a098ce49a678319cd8e9d8880fd89253851b68fb5037d07795417e2401aa60","bodyHash":"912d875ae296c50ed3fd64321a83ce51e9ae6ec7e854a4bea13c3f65b7eeffab"}
 *
 * Go source:
 * func (p *Parser) parseExternalModuleReference() *ast.Node {
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindRequireKeyword)
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseModuleSpecifier()
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	result := p.finishNode(p.factory.NewExternalModuleReference(expression), pos)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return result
 * }
 */
export function Parser_parseExternalModuleReference(receiver: GoPtr<Parser>): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindRequireKeyword);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseModuleSpecifier(receiver);
  Parser_parseExpected(receiver, KindCloseParenToken);
  const result = Parser_finishNode(receiver, NewExternalModuleReference(receiver!.factory, expression), pos);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleSpecifier","kind":"method","status":"implemented","sigHash":"a39090b186c83b9f63bc8e35899e9cda22df2e6351154f655a805a410f84cd0e","bodyHash":"629b669b93d3d5ded32b8accbe3939f337322dad4686073807531a29378276b6"}
 *
 * Go source:
 * func (p *Parser) parseModuleSpecifier() *ast.Expression {
 * 	if p.token == ast.KindStringLiteral {
 * 		result := p.parseLiteralExpression(true /*intern* /)
 * 		return result
 * 	}
 * 	// We allow arbitrary expressions here, even though the grammar only allows string
 * 	// literals.  We check to ensure that it is only a string literal later in the grammar
 * 	// check pass.
 * 	return p.parseExpression()
 * }
 */
export function Parser_parseModuleSpecifier(receiver: GoPtr<Parser>): GoPtr<Expression> {
  if (receiver!.token === KindStringLiteral) {
    const result = Parser_parseLiteralExpression(receiver, true /*intern*/);
    return result;
  }
  // We allow arbitrary expressions here, even though the grammar only allows string
  // literals.  We check to ensure that it is only a string literal later in the grammar
  // check pass.
  return Parser_parseExpression(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseImportClause","kind":"method","status":"implemented","sigHash":"a59f138589a11362fc4334c9963f8b93a7264b8129aa843a3eaf30dee5446f18","bodyHash":"ecdadf86c560e94063a79eff49a32c55babf2b9ca411fb172937ec6736fadfc6"}
 *
 * Go source:
 * func (p *Parser) tryParseImportClause(identifier *ast.Node, pos int, phaseModifier ast.Kind, skipJSDocLeadingAsterisks bool) *ast.Node {
 * 	// ImportDeclaration:
 * 	//  import ImportClause from ModuleSpecifier ;
 * 	//  import ModuleSpecifier;
 * 	if identifier != nil || p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBraceToken {
 * 		importClause := p.parseImportClause(identifier, pos, phaseModifier, skipJSDocLeadingAsterisks)
 * 		p.parseExpected(ast.KindFromKeyword)
 * 		return importClause
 * 	}
 * 	return nil
 * }
 */
export function Parser_tryParseImportClause(receiver: GoPtr<Parser>, identifier: GoPtr<Node>, pos: int, phaseModifier: Kind, skipJSDocLeadingAsterisks: bool): GoPtr<Node> {
  // ImportDeclaration:
  //  import ImportClause from ModuleSpecifier ;
  //  import ModuleSpecifier;
  if (identifier !== undefined || receiver!.token === KindAsteriskToken || receiver!.token === KindOpenBraceToken) {
    const importClause = Parser_parseImportClause(receiver, identifier, pos, phaseModifier, skipJSDocLeadingAsterisks);
    Parser_parseExpected(receiver, KindFromKeyword);
    return importClause;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportClause","kind":"method","status":"implemented","sigHash":"e76dae0134edcf4eb9bc4f300a84bde8b32c2dcfeda49ead27bc3bb0e05f6b8c","bodyHash":"bdb77505032b8604a3a2855027c1adb731841c643ab0bf63cbc823f85408bdf8"}
 *
 * Go source:
 * func (p *Parser) parseImportClause(identifier *ast.Node, pos int, phaseModifier ast.Kind, skipJSDocLeadingAsterisks bool) *ast.Node {
 * 	// ImportClause:
 * 	//  ImportedDefaultBinding
 * 	//  NameSpaceImport
 * 	//  NamedImports
 * 	//  ImportedDefaultBinding, NameSpaceImport
 * 	//  ImportedDefaultBinding, NamedImports
 * 	// If there was no default import or if there is comma token after default import
 * 	// parse namespace or named imports
 * 	var namedBindings *ast.Node
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	if identifier == nil || p.parseOptional(ast.KindCommaToken) {
 * 		if skipJSDocLeadingAsterisks {
 * 			p.scanner.SetSkipJSDocLeadingAsterisks(true)
 * 		}
 * 		if p.token == ast.KindAsteriskToken {
 * 			namedBindings = p.parseNamespaceImport()
 * 		} else {
 * 			namedBindings = p.parseNamedImports()
 * 		}
 * 		if skipJSDocLeadingAsterisks {
 * 			p.scanner.SetSkipJSDocLeadingAsterisks(false)
 * 		}
 * 	}
 * 	result := p.finishNode(p.factory.NewImportClause(phaseModifier, identifier, namedBindings), pos)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return result
 * }
 */
export function Parser_parseImportClause(receiver: GoPtr<Parser>, identifier: GoPtr<Node>, pos: int, phaseModifier: Kind, skipJSDocLeadingAsterisks: bool): GoPtr<Node> {
  // ImportClause:
  //  ImportedDefaultBinding
  //  NameSpaceImport
  //  NamedImports
  //  ImportedDefaultBinding, NameSpaceImport
  //  ImportedDefaultBinding, NamedImports
  // If there was no default import or if there is comma token after default import
  // parse namespace or named imports
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const namedBindings: GoPtr<Node> = ((): GoPtr<Node> => {
    if (identifier === undefined || Parser_parseOptional(receiver, KindCommaToken)) {
      if (skipJSDocLeadingAsterisks) {
        Scanner_SetSkipJSDocLeadingAsterisks(receiver!.scanner, true);
      }
      const nb = receiver!.token === KindAsteriskToken ? Parser_parseNamespaceImport(receiver) : Parser_parseNamedImports(receiver);
      if (skipJSDocLeadingAsterisks) {
        Scanner_SetSkipJSDocLeadingAsterisks(receiver!.scanner, false);
      }
      return nb;
    }
    return undefined;
  })();
  const result = Parser_finishNode(receiver, NewImportClause(receiver!.factory, phaseModifier, identifier, namedBindings), pos);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNamespaceImport","kind":"method","status":"implemented","sigHash":"2024ff49c97a6bb211ec4b23c628fbb02ccafb0fe7a2c85f4648e5ada9112b3f","bodyHash":"c006a66d3042578ac8d128e8b545fa85888062e83be97824a039cad566a87a93"}
 *
 * Go source:
 * func (p *Parser) parseNamespaceImport() *ast.Node {
 * 	// NameSpaceImport:
 * 	//  * as ImportedBinding
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindAsteriskToken)
 * 	p.parseExpected(ast.KindAsKeyword)
 * 	name := p.parseIdentifier()
 * 	return p.finishNode(p.factory.NewNamespaceImport(name), pos)
 * }
 */
export function Parser_parseNamespaceImport(receiver: GoPtr<Parser>): GoPtr<Node> {
  // NameSpaceImport:
  //  * as ImportedBinding
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindAsteriskToken);
  Parser_parseExpected(receiver, KindAsKeyword);
  const name = Parser_parseIdentifier(receiver);
  return Parser_finishNode(receiver, NewNamespaceImport(receiver!.factory, name), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNamedImports","kind":"method","status":"implemented","sigHash":"74b2ea779dde5fc0233cf2180c8a9c47b73556a10db5b34b6d4410cc3796d427","bodyHash":"341c01105b4367d399e59a192273d7e0fa334a68f78388a435ac8ee0136d801c"}
 *
 * Go source:
 * func (p *Parser) parseNamedImports() *ast.Node {
 * 	pos := p.nodePos()
 * 	// NamedImports:
 * 	//  { }
 * 	//  { ImportsList }
 * 	//  { ImportsList, }
 * 	imports := p.parseBracketedList(PCImportOrExportSpecifiers, (*Parser).parseImportSpecifier, ast.KindOpenBraceToken, ast.KindCloseBraceToken)
 * 	return p.finishNode(p.factory.NewNamedImports(imports), pos)
 * }
 */
export function Parser_parseNamedImports(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  // NamedImports:
  //  { }
  //  { ImportsList }
  //  { ImportsList, }
  const imports = Parser_parseBracketedList(receiver, PCImportOrExportSpecifiers, Parser_parseImportSpecifier, KindOpenBraceToken, KindCloseBraceToken);
  return Parser_finishNode(receiver, NewNamedImports(receiver!.factory, imports), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportSpecifier","kind":"method","status":"implemented","sigHash":"f99eeb50d14c436d6c02d761d28c349d3ac07c72886e8c74766080b17d859844","bodyHash":"01ca2748d0d9cc45a05fb84ee5af8a6ed9b1a429dcf3587daae0b2ad1cbbb8cb"}
 *
 * Go source:
 * func (p *Parser) parseImportSpecifier() *ast.Node {
 * 	pos := p.nodePos()
 * 	isTypeOnly, propertyName, name := p.parseImportOrExportSpecifier(ast.KindImportSpecifier)
 * 	var identifierName *ast.Node
 * 	if name.Kind == ast.KindIdentifier {
 * 		identifierName = name
 * 	} else {
 * 		p.parseErrorAtRange(p.skipRangeTrivia(name.Loc), diagnostics.Identifier_expected)
 * 		identifierName = p.newIdentifier("")
 * 		p.finishNode(identifierName, name.Pos())
 * 	}
 * 	result := p.checkJSSyntax(p.finishNode(p.factory.NewImportSpecifier(isTypeOnly, propertyName, identifierName), pos))
 * 	return result
 * }
 */
export function Parser_parseImportSpecifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const [isTypeOnly, propertyName, name] = Parser_parseImportOrExportSpecifier(receiver, KindImportSpecifier);
  let identifierName: GoPtr<Node>;
  if (name!.Kind === KindIdentifier) {
    identifierName = name;
  } else {
    Parser_parseErrorAtRange(receiver, Parser_skipRangeTrivia(receiver, name!.Loc), diagnostics.Identifier_expected);
    identifierName = Parser_newIdentifier(receiver, "");
    Parser_finishNode(receiver, identifierName, Node_Pos(name));
  }
  const result = Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewImportSpecifier(receiver!.factory, isTypeOnly, propertyName, identifierName), pos));
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportOrExportSpecifier","kind":"method","status":"implemented","sigHash":"cd00be5710820818368d10866275edc074708129cae333158e961fd8639b37db","bodyHash":"aebb29f0dac6a5c0d3fd60aadf78c41458f82ba94a7d2531f374c9fb7b8a359d"}
 *
 * Go source:
 * func (p *Parser) parseImportOrExportSpecifier(kind ast.Kind) (isTypeOnly bool, propertyName *ast.Node, name *ast.Node) {
 * 	// ImportSpecifier:
 * 	//   BindingIdentifier
 * 	//   ModuleExportName as BindingIdentifier
 * 	// ExportSpecifier:
 * 	//   ModuleExportName
 * 	//   ModuleExportName as ModuleExportName
 * 	// let checkIdentifierIsKeyword = isKeyword(token()) && !isIdentifier();
 * 	// let checkIdentifierStart = scanner.getTokenStart();
 * 	// let checkIdentifierEnd = scanner.getTokenEnd();
 * 	canParseAsKeyword := true
 * 	disallowKeywords := kind == ast.KindImportSpecifier
 * 	var nameOk bool
 * 	name, nameOk = p.parseModuleExportName(disallowKeywords)
 * 	if name.Kind == ast.KindIdentifier && name.Text() == "type" {
 * 		// If the first token of an import specifier is 'type', there are a lot of possibilities,
 * 		// especially if we see 'as' afterwards:
 * 		//
 * 		// import { type } from "mod";          - isTypeOnly: false,   name: type
 * 		// import { type as } from "mod";       - isTypeOnly: true,    name: as
 * 		// import { type as as } from "mod";    - isTypeOnly: false,   name: as,    propertyName: type
 * 		// import { type as as as } from "mod"; - isTypeOnly: true,    name: as,    propertyName: as
 * 		if p.token == ast.KindAsKeyword {
 * 			// { type as ...? }
 * 			firstAs := p.parseIdentifierName()
 * 			if p.token == ast.KindAsKeyword {
 * 				// { type as as ...? }
 * 				secondAs := p.parseIdentifierName()
 * 				if p.canParseModuleExportName() {
 * 					// { type as as something }
 * 					// { type as as "something" }
 * 					isTypeOnly = true
 * 					propertyName = firstAs
 * 					name, nameOk = p.parseModuleExportName(disallowKeywords)
 * 					canParseAsKeyword = false
 * 				} else {
 * 					// { type as as }
 * 					propertyName = name
 * 					name = secondAs
 * 					canParseAsKeyword = false
 * 				}
 * 			} else if p.canParseModuleExportName() {
 * 				// { type as something }
 * 				// { type as "something" }
 * 				propertyName = name
 * 				canParseAsKeyword = false
 * 				name, nameOk = p.parseModuleExportName(disallowKeywords)
 * 			} else {
 * 				// { type as }
 * 				isTypeOnly = true
 * 				name = firstAs
 * 			}
 * 		} else if p.canParseModuleExportName() {
 * 			// { type something ...? }
 * 			// { type "something" ...? }
 * 			isTypeOnly = true
 * 			name, nameOk = p.parseModuleExportName(disallowKeywords)
 * 		}
 * 	}
 * 	if canParseAsKeyword && p.token == ast.KindAsKeyword {
 * 		propertyName = name
 * 		p.parseExpected(ast.KindAsKeyword)
 * 		name, nameOk = p.parseModuleExportName(disallowKeywords)
 * 	}
 * 
 * 	if !nameOk {
 * 		p.parseErrorAtRange(p.skipRangeTrivia(name.Loc), diagnostics.Identifier_expected)
 * 	}
 * 
 * 	return isTypeOnly, propertyName, name
 * }
 */
export function Parser_parseImportOrExportSpecifier(receiver: GoPtr<Parser>, kind: Kind): [bool, GoPtr<Node>, GoPtr<Node>] {
  let canParseAsKeyword = true;
  const disallowKeywords = kind === KindImportSpecifier;
  let [name, nameOk] = Parser_parseModuleExportName(receiver, disallowKeywords);
  let isTypeOnly = false;
  let propertyName: GoPtr<Node>;
  if (name!.Kind === KindIdentifier && Node_Text(name) === "type") {
    // If the first token of an import specifier is 'type', there are a lot of possibilities,
    // especially if we see 'as' afterwards
    if (receiver!.token === KindAsKeyword) {
      // { type as ...? }
      const firstAs = Parser_parseIdentifierName(receiver);
      if (receiver!.token === KindAsKeyword) {
        // { type as as ...? }
        const secondAs = Parser_parseIdentifierName(receiver);
        if (Parser_canParseModuleExportName(receiver)) {
          // { type as as something }
          // { type as as "something" }
          isTypeOnly = true;
          propertyName = firstAs;
          [name, nameOk] = Parser_parseModuleExportName(receiver, disallowKeywords);
          canParseAsKeyword = false;
        } else {
          // { type as as }
          propertyName = name;
          name = secondAs;
          canParseAsKeyword = false;
        }
      } else if (Parser_canParseModuleExportName(receiver)) {
        // { type as something }
        // { type as "something" }
        propertyName = name;
        canParseAsKeyword = false;
        [name, nameOk] = Parser_parseModuleExportName(receiver, disallowKeywords);
      } else {
        // { type as }
        isTypeOnly = true;
        name = firstAs;
      }
    } else if (Parser_canParseModuleExportName(receiver)) {
      // { type something ...? }
      // { type "something" ...? }
      isTypeOnly = true;
      [name, nameOk] = Parser_parseModuleExportName(receiver, disallowKeywords);
    }
  }
  if (canParseAsKeyword && receiver!.token === KindAsKeyword) {
    propertyName = name;
    Parser_parseExpected(receiver, KindAsKeyword);
    [name, nameOk] = Parser_parseModuleExportName(receiver, disallowKeywords);
  }

  if (!nameOk) {
    Parser_parseErrorAtRange(receiver, Parser_skipRangeTrivia(receiver, name!.Loc), diagnostics.Identifier_expected);
  }

  return [isTypeOnly, propertyName, name];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canParseModuleExportName","kind":"method","status":"implemented","sigHash":"d04186d2061066bdd885f07b5d79051b98177591653699362065d5eda25191f5","bodyHash":"4f1e385c2678022280a57b86cc4bac2fe393b62d8a8aa50ed919ec8719c4a31b"}
 *
 * Go source:
 * func (p *Parser) canParseModuleExportName() bool {
 * 	return tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindStringLiteral
 * }
 */
export function Parser_canParseModuleExportName(receiver: GoPtr<Parser>): bool {
  return tokenIsIdentifierOrKeyword(receiver!.token) || receiver!.token === KindStringLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModuleExportName","kind":"method","status":"implemented","sigHash":"080a63cc73f675dc1c5ef057bed9e3be391679c5d6e1b2b2bd4bac287efdb546","bodyHash":"f4c44edcc99cadc0aab91380a900cf0e5b6368e85d906e0806809c68404ea819"}
 *
 * Go source:
 * func (p *Parser) parseModuleExportName(disallowKeywords bool) (node *ast.Node, nameOk bool) {
 * 	nameOk = true
 * 
 * 	if p.token == ast.KindStringLiteral {
 * 		return p.parseLiteralExpression(false /*intern* /), nameOk
 * 	}
 * 	if disallowKeywords && ast.IsKeyword(p.token) && !p.isIdentifier() {
 * 		nameOk = false
 * 	}
 * 	return p.parseIdentifierName(), nameOk
 * }
 */
export function Parser_parseModuleExportName(receiver: GoPtr<Parser>, disallowKeywords: bool): [GoPtr<Node>, bool] {
  let nameOk = true;

  if (receiver!.token === KindStringLiteral) {
    return [Parser_parseLiteralExpression(receiver, false /*intern*/), nameOk];
  }
  if (disallowKeywords && IsKeyword(receiver!.token) && !Parser_isIdentifier(receiver)) {
    nameOk = false;
  }
  return [Parser_parseIdentifierName(receiver), nameOk];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseImportAttributes","kind":"method","status":"implemented","sigHash":"c0c8fa684b724559dd5c39a9808a9ea33f3993f5e6e521ca743df325c9cd954f","bodyHash":"d5eaa596b446a589b5088218e5c7d6f68aaf3a95b6c3a0304addf5785860fa46"}
 *
 * Go source:
 * func (p *Parser) tryParseImportAttributes() *ast.Node {
 * 	if p.token == ast.KindWithKeyword || (p.token == ast.KindAssertKeyword && !p.hasPrecedingLineBreak()) {
 * 		if p.token == ast.KindAssertKeyword {
 * 			p.parseErrorAtCurrentToken(diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert)
 * 		}
 * 		return p.parseImportAttributes(p.token, false /*skipKeyword* /)
 * 	}
 * 	return nil
 * }
 */
export function Parser_tryParseImportAttributes(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (receiver!.token === KindWithKeyword || (receiver!.token === KindAssertKeyword && !Parser_hasPrecedingLineBreak(receiver))) {
    if (receiver!.token === KindAssertKeyword) {
      Parser_parseErrorAtCurrentToken(receiver, diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert);
    }
    return Parser_parseImportAttributes(receiver, receiver!.token, false /*skipKeyword*/);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExportAssignment","kind":"method","status":"implemented","sigHash":"591ba8efea45f7cf074fa5d273319a14885a2e7341174840ff93ecbb9d3ec5bf","bodyHash":"d72eccfbbcc4a074af9a075625d4247bedf004b59d55389ddd7da4117c67bec8"}
 *
 * Go source:
 * func (p *Parser) parseExportAssignment(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	saveContextFlags := p.contextFlags
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, true)
 * 	isExportEquals := false
 * 	if p.parseOptional(ast.KindEqualsToken) {
 * 		isExportEquals = true
 * 	} else {
 * 		p.parseExpected(ast.KindDefaultKeyword)
 * 	}
 * 	expression := p.parseAssignmentExpressionOrHigher()
 * 	p.parseSemicolon()
 * 	p.contextFlags = saveContextFlags
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	result := p.finishNode(p.factory.NewExportAssignment(modifiers, isExportEquals, nil /*typeNode* /, expression), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseExportAssignment(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const saveContextFlags = receiver!.contextFlags;
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, true);
  const isExportEquals = ((): bool => {
    if (Parser_parseOptional(receiver, KindEqualsToken)) {
      return true;
    } else {
      Parser_parseExpected(receiver, KindDefaultKeyword);
      return false;
    }
  })();
  const expression = Parser_parseAssignmentExpressionOrHigher(receiver);
  Parser_parseSemicolon(receiver);
  receiver!.contextFlags = saveContextFlags;
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  const result = Parser_finishNode(receiver, NewExportAssignment(receiver!.factory, modifiers, isExportEquals, undefined /*typeNode*/, expression), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNamespaceExportDeclaration","kind":"method","status":"implemented","sigHash":"a86332aae8d80c57b44037dab0ab1f81fca8bc86ec99de4c1928e9a3a074c8f0","bodyHash":"0673d5172b71371e646e90efd2f425ae793e849131f1a56c39d9e75c475fd324"}
 *
 * Go source:
 * func (p *Parser) parseNamespaceExportDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	p.parseExpected(ast.KindAsKeyword)
 * 	p.parseExpected(ast.KindNamespaceKeyword)
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	name := p.parseIdentifier()
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	p.parseSemicolon()
 * 	// NamespaceExportDeclaration nodes cannot have decorators or modifiers, we attach them here so we can report them in the grammar checker
 * 	result := p.finishNode(p.factory.NewNamespaceExportDeclaration(modifiers, name), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseNamespaceExportDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  Parser_parseExpected(receiver, KindAsKeyword);
  Parser_parseExpected(receiver, KindNamespaceKeyword);
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const name = Parser_parseIdentifier(receiver);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  Parser_parseSemicolon(receiver);
  // NamespaceExportDeclaration nodes cannot have decorators or modifiers, we attach them here so we can report them in the grammar checker
  const result = Parser_finishNode(receiver, NewNamespaceExportDeclaration(receiver!.factory, modifiers, name), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExportDeclaration","kind":"method","status":"implemented","sigHash":"6c5fd5d139970949b3b277fdd4866b5b78ddc88bb10b3850b82e610abf27de81","bodyHash":"023df910233173f0570db7afca04b9a5dca64c7333605965fc17f32075ede524"}
 *
 * Go source:
 * func (p *Parser) parseExportDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	saveContextFlags := p.contextFlags
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, true)
 * 	var exportClause *ast.Node
 * 	var moduleSpecifier *ast.Expression
 * 	var attributes *ast.Node
 * 	isTypeOnly := p.parseOptional(ast.KindTypeKeyword)
 * 	namespaceExportPos := p.nodePos()
 * 	if p.parseOptional(ast.KindAsteriskToken) {
 * 		if p.parseOptional(ast.KindAsKeyword) {
 * 			exportClause = p.parseNamespaceExport(namespaceExportPos)
 * 		}
 * 		p.parseExpected(ast.KindFromKeyword)
 * 		moduleSpecifier = p.parseModuleSpecifier()
 * 	} else {
 * 		exportClause = p.parseNamedExports()
 * 		// It is not uncommon to accidentally omit the 'from' keyword. Additionally, in editing scenarios,
 * 		// the 'from' keyword can be parsed as a named export when the export clause is unterminated (i.e. `export { from "moduleName";`)
 * 		// If we don't have a 'from' keyword, see if we have a string literal such that ASI won't take effect.
 * 		if p.token == ast.KindFromKeyword || (p.token == ast.KindStringLiteral && !p.hasPrecedingLineBreak()) {
 * 			p.parseExpected(ast.KindFromKeyword)
 * 			moduleSpecifier = p.parseModuleSpecifier()
 * 		}
 * 	}
 * 	if moduleSpecifier != nil && (p.token == ast.KindWithKeyword || p.token == ast.KindAssertKeyword) && !p.hasPrecedingLineBreak() {
 * 		if p.token == ast.KindAssertKeyword {
 * 			p.parseErrorAtCurrentToken(diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert)
 * 		}
 * 		attributes = p.parseImportAttributes(p.token, false /*skipKeyword* /)
 * 	}
 * 	p.parseSemicolon()
 * 	p.contextFlags = saveContextFlags
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	result := p.finishNode(p.factory.NewExportDeclaration(modifiers, isTypeOnly, exportClause, moduleSpecifier, attributes), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseExportDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const saveContextFlags = receiver!.contextFlags;
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, true);
  const isTypeOnly = Parser_parseOptional(receiver, KindTypeKeyword);
  const namespaceExportPos = Parser_nodePos(receiver);
  const clauseAndSpecifier: [GoPtr<Node>, GoPtr<Expression>] = ((): [GoPtr<Node>, GoPtr<Expression>] => {
    if (Parser_parseOptional(receiver, KindAsteriskToken)) {
      const ec: GoPtr<Node> = Parser_parseOptional(receiver, KindAsKeyword) ? Parser_parseNamespaceExport(receiver, namespaceExportPos) : undefined;
      Parser_parseExpected(receiver, KindFromKeyword);
      return [ec, Parser_parseModuleSpecifier(receiver)];
    } else {
      const ec = Parser_parseNamedExports(receiver);
      // It is not uncommon to accidentally omit the 'from' keyword. Additionally, in editing scenarios,
      // the 'from' keyword can be parsed as a named export when the export clause is unterminated (i.e. `export { from "moduleName";`)
      // If we don't have a 'from' keyword, see if we have a string literal such that ASI won't take effect.
      if (receiver!.token === KindFromKeyword || (receiver!.token === KindStringLiteral && !Parser_hasPrecedingLineBreak(receiver))) {
        Parser_parseExpected(receiver, KindFromKeyword);
        return [ec, Parser_parseModuleSpecifier(receiver)];
      }
      return [ec, undefined];
    }
  })();
  const exportClause = clauseAndSpecifier[0];
  const moduleSpecifier = clauseAndSpecifier[1];
  const attributes: GoPtr<Node> = ((): GoPtr<Node> => {
    if (moduleSpecifier !== undefined && (receiver!.token === KindWithKeyword || receiver!.token === KindAssertKeyword) && !Parser_hasPrecedingLineBreak(receiver)) {
      if (receiver!.token === KindAssertKeyword) {
        Parser_parseErrorAtCurrentToken(receiver, diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert);
      }
      return Parser_parseImportAttributes(receiver, receiver!.token, false /*skipKeyword*/);
    }
    return undefined;
  })();
  Parser_parseSemicolon(receiver);
  receiver!.contextFlags = saveContextFlags;
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  const result = Parser_finishNode(receiver, NewExportDeclaration(receiver!.factory, modifiers, isTypeOnly, exportClause, moduleSpecifier, attributes), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNamespaceExport","kind":"method","status":"implemented","sigHash":"eeaa5ae0580f90cc2628acfb124b2045771846fe213553f9f771ff118a5e6c65","bodyHash":"92d565c5cfe492664d1ec48b77688563361c592db6c8e28301373e5752113f5c"}
 *
 * Go source:
 * func (p *Parser) parseNamespaceExport(pos int) *ast.Node {
 * 	exportName, _ := p.parseModuleExportName(false /*disallowKeywords* /)
 * 	return p.finishNode(p.factory.NewNamespaceExport(exportName), pos)
 * }
 */
export function Parser_parseNamespaceExport(receiver: GoPtr<Parser>, pos: int): GoPtr<Node> {
  const [exportName] = Parser_parseModuleExportName(receiver, false /*disallowKeywords*/);
  return Parser_finishNode(receiver, NewNamespaceExport(receiver!.factory, exportName), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNamedExports","kind":"method","status":"implemented","sigHash":"6be412aab743fb823c728ea2ec0b1d454c09db8ad5730cdd67c8585ca936c933","bodyHash":"1fc0535a1e8b765ecdd4cb1564d980ad1eeada0c7f9855d4cea726e008c805e2"}
 *
 * Go source:
 * func (p *Parser) parseNamedExports() *ast.Node {
 * 	pos := p.nodePos()
 * 	// NamedImports:
 * 	//  { }
 * 	//  { ImportsList }
 * 	//  { ImportsList, }
 * 	exports := p.parseBracketedList(PCImportOrExportSpecifiers, (*Parser).parseExportSpecifier, ast.KindOpenBraceToken, ast.KindCloseBraceToken)
 * 	return p.finishNode(p.factory.NewNamedExports(exports), pos)
 * }
 */
export function Parser_parseNamedExports(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  // NamedImports:
  //  { }
  //  { ImportsList }
  //  { ImportsList, }
  const exports = Parser_parseBracketedList(receiver, PCImportOrExportSpecifiers, Parser_parseExportSpecifier, KindOpenBraceToken, KindCloseBraceToken);
  return Parser_finishNode(receiver, NewNamedExports(receiver!.factory, exports), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExportSpecifier","kind":"method","status":"implemented","sigHash":"bdad37bcbfad7613d1f32da306b259931cae7854e51d7bd01fab9722c569b6ed","bodyHash":"2ecb7b98f45539dce6ac795406390ba004c25616e06dc8c4ed9b65adb40f3dc8"}
 *
 * Go source:
 * func (p *Parser) parseExportSpecifier() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	isTypeOnly, propertyName, name := p.parseImportOrExportSpecifier(ast.KindExportSpecifier)
 * 	result := p.finishNode(p.factory.NewExportSpecifier(isTypeOnly, propertyName, name), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseExportSpecifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const [isTypeOnly, propertyName, name] = Parser_parseImportOrExportSpecifier(receiver, KindExportSpecifier);
  const result = Parser_finishNode(receiver, NewExportSpecifier(receiver!.factory, isTypeOnly, propertyName, name), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseRightSideOfDot","kind":"method","status":"implemented","sigHash":"df15095157184ddf271df1b27a4c1fc49055f1f938ee9b7a6e93a180b4e3b820","bodyHash":"9850d60e0caa6133739e336313fdb4687e7d3232a9ea445edbdfb003d60b1b2b"}
 *
 * Go source:
 * func (p *Parser) parseRightSideOfDot(allowIdentifierNames bool, allowPrivateIdentifiers bool, allowUnicodeEscapeSequenceInIdentifierName bool) *ast.Node {
 * 	// Technically a keyword is valid here as all identifiers and keywords are identifier names.
 * 	// However, often we'll encounter this in error situations when the identifier or keyword
 * 	// is actually starting another valid construct.
 * 	//
 * 	// So, we check for the following specific case:
 * 	//
 * 	//      name.
 * 	//      identifierOrKeyword identifierNameOrKeyword
 * 	//
 * 	// Note: the newlines are important here.  For example, if that above code
 * 	// were rewritten into:
 * 	//
 * 	//      name.identifierOrKeyword
 * 	//      identifierNameOrKeyword
 * 	//
 * 	// Then we would consider it valid.  That's because ASI would take effect and
 * 	// the code would be implicitly: "name.identifierOrKeyword; identifierNameOrKeyword".
 * 	// In the first case though, ASI will not take effect because there is not a
 * 	// line terminator after the identifier or keyword.
 * 	if p.hasPrecedingLineBreak() && tokenIsIdentifierOrKeyword(p.token) && p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOnSameLine) {
 * 		// Report that we need an identifier.  However, report it right after the dot,
 * 		// and not on the next token.  This is because the next token might actually
 * 		// be an identifier and the error would be quite confusing.
 * 		p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.Identifier_expected)
 * 		return p.createMissingIdentifier()
 * 	}
 * 	if p.token == ast.KindPrivateIdentifier {
 * 		node := p.parsePrivateIdentifier()
 * 		if allowPrivateIdentifiers {
 * 			return node
 * 		}
 * 		p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.Identifier_expected)
 * 		return p.createMissingIdentifier()
 * 	}
 * 	if allowIdentifierNames {
 * 		if allowUnicodeEscapeSequenceInIdentifierName {
 * 			return p.parseIdentifierName()
 * 		}
 * 		return p.parseIdentifierNameErrorOnUnicodeEscapeSequence()
 * 	}
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	id := p.parseIdentifier()
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return id
 * }
 */
export function Parser_parseRightSideOfDot(receiver: GoPtr<Parser>, allowIdentifierNames: bool, allowPrivateIdentifiers: bool, allowUnicodeEscapeSequenceInIdentifierName: bool): GoPtr<Node> {
  // Technically a keyword is valid here as all identifiers and keywords are identifier names.
  // However, often we'll encounter this in error situations when the identifier or keyword
  // is actually starting another valid construct.
  //
  // So, we check for the following specific case:
  //
  //      name.
  //      identifierOrKeyword identifierNameOrKeyword
  //
  // Note: the newlines are important here.  For example, if that above code
  // were rewritten into:
  //
  //      name.identifierOrKeyword
  //      identifierNameOrKeyword
  //
  // Then we would consider it valid.  That's because ASI would take effect and
  // the code would be implicitly: "name.identifierOrKeyword; identifierNameOrKeyword".
  // In the first case though, ASI will not take effect because there is not a
  // line terminator after the identifier or keyword.
  if (Parser_hasPrecedingLineBreak(receiver) && tokenIsIdentifierOrKeyword(receiver!.token) && Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOnSameLine)) {
    // Report that we need an identifier.  However, report it right after the dot,
    // and not on the next token.  This is because the next token might actually
    // be an identifier and the error would be quite confusing.
    Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), diagnostics.Identifier_expected);
    return Parser_createMissingIdentifier(receiver);
  }
  if (receiver!.token === KindPrivateIdentifier) {
    const node = Parser_parsePrivateIdentifier(receiver);
    if (allowPrivateIdentifiers) {
      return node;
    }
    Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), diagnostics.Identifier_expected);
    return Parser_createMissingIdentifier(receiver);
  }
  if (allowIdentifierNames) {
    if (allowUnicodeEscapeSequenceInIdentifierName) {
      return Parser_parseIdentifierName(receiver);
    }
    return Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(receiver);
  }
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const id = Parser_parseIdentifier(receiver);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return id;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportAttribute","kind":"method","status":"implemented","sigHash":"78395178df7c70c74f099f421117c328f0ca45f2a4065369cd7e79a1cd5703f9","bodyHash":"76d1cee37fbc1ce17dd8b6e726f8f172af2f66ff712fcf6e374fddc40a852da6"}
 *
 * Go source:
 * func (p *Parser) parseImportAttribute() *ast.Node {
 * 	pos := p.nodePos()
 * 	var name *ast.Node
 * 	if tokenIsIdentifierOrKeyword(p.token) {
 * 		name = p.parseIdentifierName()
 * 	} else if p.token == ast.KindStringLiteral {
 * 		name = p.parseLiteralExpression(false /*intern* /)
 * 	}
 * 	if name != nil {
 * 		p.parseExpected(ast.KindColonToken)
 * 	} else {
 * 		p.parseErrorAtCurrentToken(diagnostics.Identifier_or_string_literal_expected)
 * 	}
 * 	value := p.parseAssignmentExpressionOrHigher()
 * 	return p.finishNode(p.factory.NewImportAttribute(name, value), pos)
 * }
 */
export function Parser_parseImportAttribute(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const name: GoPtr<Node> = tokenIsIdentifierOrKeyword(receiver!.token)
    ? Parser_parseIdentifierName(receiver)
    : receiver!.token === KindStringLiteral
      ? Parser_parseLiteralExpression(receiver, false /*intern*/)
      : undefined;
  if (name !== undefined) {
    Parser_parseExpected(receiver, KindColonToken);
  } else {
    Parser_parseErrorAtCurrentToken(receiver, diagnostics.Identifier_or_string_literal_expected);
  }
  const value = Parser_parseAssignmentExpressionOrHigher(receiver);
  return Parser_finishNode(receiver, NewImportAttribute(receiver!.factory, name, value), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportAttributes","kind":"method","status":"implemented","sigHash":"d88044dde7886cfe6bb416bea3b958748a46461cabb5d93b47b20e8f91532b00","bodyHash":"55c9fd4e5f0899888a6e8b0ee6c2d53042e2e093d8aae7094c8046eccacc4879"}
 *
 * Go source:
 * func (p *Parser) parseImportAttributes(token ast.Kind, skipKeyword bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	if !skipKeyword {
 * 		p.parseExpected(token)
 * 	}
 * 	var elements *ast.NodeList
 * 	var multiLine bool
 * 	openBracePosition := p.scanner.TokenStart()
 * 	if p.parseExpected(ast.KindOpenBraceToken) {
 * 		multiLine = p.hasPrecedingLineBreak()
 * 		elements = p.parseDelimitedList(PCImportAttributes, (*Parser).parseImportAttribute)
 * 		if !p.parseExpected(ast.KindCloseBraceToken) {
 * 			if len(p.diagnostics) != 0 {
 * 				lastDiagnostic := p.diagnostics[len(p.diagnostics)-1]
 * 				if lastDiagnostic.Code() == diagnostics.X_0_expected.Code() {
 * 					related := ast.NewDiagnostic(nil, core.NewTextRange(openBracePosition, openBracePosition), diagnostics.The_parser_expected_to_find_a_1_to_match_the_0_token_here, "{", "}")
 * 					lastDiagnostic.AddRelatedInfo(related)
 * 				}
 * 			}
 * 		}
 * 	} else {
 * 		elements = p.parseEmptyNodeList()
 * 	}
 * 	return p.finishNode(p.factory.NewImportAttributes(token, elements, multiLine), pos)
 * }
 */
export function Parser_parseImportAttributes(receiver: GoPtr<Parser>, token: Kind, skipKeyword: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  if (!skipKeyword) {
    Parser_parseExpected(receiver, token);
  }
  let elements: GoPtr<NodeList>;
  let multiLine = false;
  const openBracePosition = Scanner_TokenStart(receiver!.scanner);
  if (Parser_parseExpected(receiver, KindOpenBraceToken)) {
    multiLine = Parser_hasPrecedingLineBreak(receiver);
    elements = Parser_parseDelimitedList(receiver, PCImportAttributes, Parser_parseImportAttribute);
    if (!Parser_parseExpected(receiver, KindCloseBraceToken)) {
      if (receiver!.diagnostics.length !== 0) {
        const lastDiagnostic = receiver!.diagnostics[receiver!.diagnostics.length - 1];
        if (Diagnostic_Code(lastDiagnostic) === Message_Code(diagnostics.X_0_expected)) {
          const related = NewDiagnostic(undefined, NewTextRange(openBracePosition, openBracePosition), diagnostics.The_parser_expected_to_find_a_1_to_match_the_0_token_here, "{", "}");
          Diagnostic_AddRelatedInfo(lastDiagnostic, related);
        }
      }
    }
  } else {
    elements = Parser_parseEmptyNodeList(receiver);
  }
  return Parser_finishNode(receiver, NewImportAttributes(receiver!.factory, token, elements, multiLine), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAccessorDeclaration","kind":"method","status":"implemented","sigHash":"28e8832fa9b0ad82e942603fff594f4c3d364c44861b09a8577c0875802891bc","bodyHash":"08ca8a40106d59c089f4e748c623c070be866f1117a8fa0358a0806459c660ad"}
 *
 * Go source:
 * func (p *Parser) parseAccessorDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, kind ast.Kind, flags ParseFlags) *ast.Node {
 * 	name := p.parsePropertyName()
 * 	typeParameters := p.parseTypeParameters()
 * 	parameters := p.parseParameters(ParseFlagsNone)
 * 	returnType := p.parseReturnType(ast.KindColonToken, false /*isType* /)
 * 	body := p.parseFunctionBlockOrSemicolon(flags, nil /*diagnosticMessage* /)
 * 	var result *ast.Node
 * 	// Keep track of `typeParameters` (for both) and `type` (for setters) if they were parsed those indicate grammar errors
 * 	if kind == ast.KindGetAccessor {
 * 		result = p.factory.NewGetAccessorDeclaration(modifiers, name, typeParameters, parameters, returnType, nil /*fullSignature* /, body)
 * 	} else {
 * 		result = p.factory.NewSetAccessorDeclaration(modifiers, name, typeParameters, parameters, returnType, nil /*fullSignature* /, body)
 * 	}
 * 	p.withJSDoc(p.finishNode(result, pos), jsdoc)
 * 	if flags&ParseFlagsType == 0 {
 * 		p.checkJSSyntax(result)
 * 	}
 * 	return result
 * }
 */
export function Parser_parseAccessorDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, kind: Kind, flags: ParseFlags): GoPtr<Node> {
  const name = Parser_parsePropertyName(receiver);
  const typeParameters = Parser_parseTypeParameters(receiver);
  const parameters = Parser_parseParameters(receiver, ParseFlagsNone);
  const returnType = Parser_parseReturnType(receiver, KindColonToken, false /*isType*/);
  const body = Parser_parseFunctionBlockOrSemicolon(receiver, flags, undefined /*diagnosticMessage*/);
  // Keep track of `typeParameters` (for both) and `type` (for setters) if they were parsed those indicate grammar errors
  const result: GoPtr<Node> =
    kind === KindGetAccessor
      ? NewGetAccessorDeclaration(receiver!.factory, modifiers, name, typeParameters, parameters, returnType, undefined /*fullSignature*/, body)
      : NewSetAccessorDeclaration(receiver!.factory, modifiers, name, typeParameters, parameters, returnType, undefined /*fullSignature*/, body);
  Parser_withJSDoc(receiver, Parser_finishNode(receiver, result, pos), jsdoc);
  if ((flags & ParseFlagsType) === 0) {
    Parser_checkJSSyntax(receiver, result);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionBlockOrSemicolon","kind":"method","status":"implemented","sigHash":"67b6865b56fa32a977a03d9557b5fa021883d229dd5e91929405b46116c5ba0b","bodyHash":"c513e9e657236135f02ae4fdec49508b80562f3a408225b5fbc8baea820d5c02"}
 *
 * Go source:
 * func (p *Parser) parseFunctionBlockOrSemicolon(flags ParseFlags, diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	if p.token != ast.KindOpenBraceToken {
 * 		if flags&ParseFlagsType != 0 {
 * 			p.parseTypeMemberSemicolon()
 * 			return nil
 * 		}
 * 		if p.canParseSemicolon() {
 * 			p.parseSemicolon()
 * 			return nil
 * 		}
 * 	}
 * 	return p.parseFunctionBlock(flags, diagnosticMessage)
 * }
 */
export function Parser_parseFunctionBlockOrSemicolon(receiver: GoPtr<Parser>, flags: ParseFlags, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  if (receiver!.token !== KindOpenBraceToken) {
    if ((flags & ParseFlagsType) !== 0) {
      Parser_parseTypeMemberSemicolon(receiver);
      return undefined;
    }
    if (Parser_canParseSemicolon(receiver)) {
      Parser_parseSemicolon(receiver);
      return undefined;
    }
  }
  return Parser_parseFunctionBlock(receiver, flags, diagnosticMessage);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionBlock","kind":"method","status":"implemented","sigHash":"bc04ee927014f4b2a1ab4d739b77f631bac158c941f27e015b093aff841366d3","bodyHash":"43ece02def0e85d24565d99405128b462648a7fa46fe5ddd8e062adc95f7f450"}
 *
 * Go source:
 * func (p *Parser) parseFunctionBlock(flags ParseFlags, diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	saveContextFlags := p.contextFlags
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	p.setContextFlags(ast.NodeFlagsYieldContext, flags&ParseFlagsYield != 0)
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, flags&ParseFlagsAwait != 0)
 * 	// We may be in a [Decorator] context when parsing a function expression or
 * 	// arrow function. The body of the function is not in [Decorator] context.
 * 	p.setContextFlags(ast.NodeFlagsDecoratorContext, false)
 * 	block := p.parseBlock(flags&ParseFlagsIgnoreMissingOpenBrace != 0, diagnosticMessage)
 * 	p.contextFlags = saveContextFlags
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return block
 * }
 */
export function Parser_parseFunctionBlock(receiver: GoPtr<Parser>, flags: ParseFlags, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  const saveContextFlags = receiver!.contextFlags;
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  Parser_setContextFlags(receiver, NodeFlagsYieldContext, (flags & ParseFlagsYield) !== 0);
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, (flags & ParseFlagsAwait) !== 0);
  // We may be in a [Decorator] context when parsing a function expression or
  // arrow function. The body of the function is not in [Decorator] context.
  Parser_setContextFlags(receiver, NodeFlagsDecoratorContext, false);
  const block = Parser_parseBlock(receiver, (flags & ParseFlagsIgnoreMissingOpenBrace) !== 0, diagnosticMessage);
  receiver!.contextFlags = saveContextFlags;
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return block;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIndexSignatureDeclaration","kind":"method","status":"implemented","sigHash":"8734abef0d9de949f372b68bb7f8b8cd1f9edfe0b9cab3d34753800482db284f","bodyHash":"f75569dff45d3285924d7e9520adb355188c10f81474e81ca7b448ba57dea177"}
 *
 * Go source:
 * func (p *Parser) parseIndexSignatureDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	parameters := p.parseBracketedList(PCParameters, (*Parser).parseParameter, ast.KindOpenBracketToken, ast.KindCloseBracketToken)
 * 	typeNode := p.parseTypeAnnotation()
 * 	p.parseTypeMemberSemicolon()
 * 	result := p.finishNode(p.factory.NewIndexSignatureDeclaration(modifiers, parameters, typeNode), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseIndexSignatureDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const parameters = Parser_parseBracketedList(receiver, PCParameters, Parser_parseParameter, KindOpenBracketToken, KindCloseBracketToken);
  const typeNode = Parser_parseTypeAnnotation(receiver);
  Parser_parseTypeMemberSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewIndexSignatureDeclaration(receiver!.factory, modifiers, parameters, typeNode), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsClassKeywordOnSameLine","kind":"method","status":"implemented","sigHash":"f0781cb9a2041732681ff6769ab4c6490a7a63d97949c2c4b450a5683de253f9","bodyHash":"81d8c2ff80853b0a4713f09ee89593352fefd0973d2fc82ab8260a182493dba7"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsClassKeywordOnSameLine() bool {
 * 	return p.nextToken() == ast.KindClassKeyword && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsClassKeywordOnSameLine(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindClassKeyword && !Parser_hasPrecedingLineBreak(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsFunctionKeywordOnSameLine","kind":"method","status":"implemented","sigHash":"cd2822f2930f7b082ebbaa41b44776f452b9684238a9695da851ab1879bf759f","bodyHash":"638905a2bbf41d558cb32d51fab207588a2f5877727a431e2150f20d7b354193"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsFunctionKeywordOnSameLine() bool {
 * 	return p.nextToken() == ast.KindFunctionKeyword && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsFunctionKeywordOnSameLine(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindFunctionKeyword && !Parser_hasPrecedingLineBreak(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenCanFollowExportModifier","kind":"method","status":"implemented","sigHash":"ac80b3eae7c1392d29a650998263e8880ff44fdcef0b8d1406f7f1176121fc62","bodyHash":"1b5009aba1f1685b2ae23899eba07e5b132d1330bc712bee68fc4df05de5b49a"}
 *
 * Go source:
 * func (p *Parser) nextTokenCanFollowExportModifier() bool {
 * 	p.nextToken()
 * 	return p.canFollowExportModifier()
 * }
 */
export function Parser_nextTokenCanFollowExportModifier(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return Parser_canFollowExportModifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canFollowExportModifier","kind":"method","status":"implemented","sigHash":"cac4bae1a26468a5e9f74622f1c9bbd0e78e1cb99cb841ee35980d8ae4444ce5","bodyHash":"bfdfd7239dd1fbdb0ef6b1accf4846ec5507073fc6f72f6d3b6c22e5e6b7a506"}
 *
 * Go source:
 * func (p *Parser) canFollowExportModifier() bool {
 * 	return p.token == ast.KindAtToken || p.token != ast.KindAsteriskToken && p.token != ast.KindAsKeyword && p.token != ast.KindOpenBraceToken && p.canFollowModifier()
 * }
 */
export function Parser_canFollowExportModifier(receiver: GoPtr<Parser>): bool {
  return (
    receiver!.token === KindAtToken ||
    (receiver!.token !== KindAsteriskToken && receiver!.token !== KindAsKeyword && receiver!.token !== KindOpenBraceToken && Parser_canFollowModifier(receiver))
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsDot","kind":"method","status":"implemented","sigHash":"5c39086de9af4f49f41c5b4a805672a83b683b284f8db05d4403f920b86c0596","bodyHash":"71f9f7be531650078dec222f11bd7dcb1d1cc6ba673f1572dc2cf77ee33b8197"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsDot() bool {
 * 	return p.nextToken() == ast.KindDotToken
 * }
 */
export function Parser_nextTokenIsDot(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindDotToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBindingIdentifierWithDiagnostic","kind":"method","status":"implemented","sigHash":"ebadb907e74facaf5bb0b9585e63127a3266ac58e03482745a7164b0dc4f6800","bodyHash":"f6485945de903baff7cde4e1f56e8f434611e84f6b6860ab882eaa9e968eb229"}
 *
 * Go source:
 * func (p *Parser) parseBindingIdentifierWithDiagnostic(privateIdentifierDiagnosticMessage *diagnostics.Message) *ast.Node {
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	id := p.createIdentifierWithDiagnostic(p.isBindingIdentifier(), nil /*diagnosticMessage* /, privateIdentifierDiagnosticMessage)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return id
 * }
 */
export function Parser_parseBindingIdentifierWithDiagnostic(receiver: GoPtr<Parser>, privateIdentifierDiagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const id = Parser_createIdentifierWithDiagnostic(receiver, Parser_isBindingIdentifier(receiver), undefined /*diagnosticMessage*/, privateIdentifierDiagnosticMessage);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return id;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierNameWithDiagnostic","kind":"method","status":"implemented","sigHash":"e6474af5c162ee31b175826839de813a106ac02eaf19c80538b38be4d76bd811","bodyHash":"f17e7b7263ac23cdbb4ebda21f35b3c9979d5cb17133e82ca98ee9cb053f0033"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierNameWithDiagnostic(diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	return p.createIdentifierWithDiagnostic(tokenIsIdentifierOrKeyword(p.token), diagnosticMessage, nil)
 * }
 */
export function Parser_parseIdentifierNameWithDiagnostic(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  return Parser_createIdentifierWithDiagnostic(receiver, tokenIsIdentifierOrKeyword(receiver!.token), diagnosticMessage, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierWithDiagnostic","kind":"method","status":"implemented","sigHash":"dd736f69c954128634776521879af0fe727a38157b138d31d81e02e7a8f029cd","bodyHash":"36590660967fef455696fdc491353cdcc71c3d8e6655c6911c5cb60d2cd29bac"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierWithDiagnostic(diagnosticMessage *diagnostics.Message, privateIdentifierDiagnosticMessage *diagnostics.Message) *ast.Node {
 * 	return p.createIdentifierWithDiagnostic(p.isIdentifier(), diagnosticMessage, privateIdentifierDiagnosticMessage)
 * }
 */
export function Parser_parseIdentifierWithDiagnostic(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>, privateIdentifierDiagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  return Parser_createIdentifierWithDiagnostic(receiver, Parser_isIdentifier(receiver), diagnosticMessage, privateIdentifierDiagnosticMessage);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createIdentifierWithDiagnostic","kind":"method","status":"implemented","sigHash":"e756dfac1ddd3514aad9510cdccb750c370410f7da4b23f1014f191b5a9c2956","bodyHash":"59e52c6d6099adfab50939745335f048d4dd8943a3a512b8cbed80890b2e7820"}
 *
 * Go source:
 * func (p *Parser) createIdentifierWithDiagnostic(isIdentifier bool, diagnosticMessage *diagnostics.Message, privateIdentifierDiagnosticMessage *diagnostics.Message) *ast.Node {
 * 	if isIdentifier {
 * 		var pos int
 * 		if p.scanner.HasPrecedingJSDocLeadingAsterisks() {
 * 			pos = p.scanner.TokenStart()
 * 		} else {
 * 			pos = p.nodePos()
 * 		}
 * 		text := p.scanner.TokenValue()
 * 		p.nextTokenWithoutCheck()
 * 		return p.finishNode(p.newIdentifier(p.internIdentifier(text)), pos)
 * 	}
 * 	if p.token == ast.KindPrivateIdentifier {
 * 		if privateIdentifierDiagnosticMessage != nil {
 * 			p.parseErrorAtCurrentToken(privateIdentifierDiagnosticMessage)
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 		}
 * 		return p.createIdentifier(true /*isIdentifier* /)
 * 	}
 * 	// Only for end of file because the error gets reported incorrectly on embedded script tags.
 * 	reportAtCurrentPosition := p.token == ast.KindEndOfFile
 * 	if diagnosticMessage != nil {
 * 		if reportAtCurrentPosition {
 * 			pos := p.scanner.TokenFullStart()
 * 			p.parseErrorAt(pos, pos, diagnosticMessage)
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnosticMessage)
 * 		}
 * 	} else if isReservedWord(p.token) {
 * 		if reportAtCurrentPosition {
 * 			pos := p.scanner.TokenFullStart()
 * 			p.parseErrorAt(pos, pos, diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, p.scanner.TokenText())
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, p.scanner.TokenText())
 * 		}
 * 	} else {
 * 		if reportAtCurrentPosition {
 * 			pos := p.scanner.TokenFullStart()
 * 			p.parseErrorAt(pos, pos, diagnostics.Identifier_expected)
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Identifier_expected)
 * 		}
 * 	}
 * 	return p.createMissingIdentifier()
 * }
 */
export function Parser_createIdentifierWithDiagnostic(receiver: GoPtr<Parser>, isIdentifier: bool, diagnosticMessage: GoPtr<Message>, privateIdentifierDiagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  if (isIdentifier) {
    const pos = Scanner_HasPrecedingJSDocLeadingAsterisks(receiver!.scanner) ? Scanner_TokenStart(receiver!.scanner) : Parser_nodePos(receiver);
    const text = Scanner_TokenValue(receiver!.scanner);
    Parser_nextTokenWithoutCheck(receiver);
    return Parser_finishNode(receiver, Parser_newIdentifier(receiver, Parser_internIdentifier(receiver, text)), pos);
  }
  if (receiver!.token === KindPrivateIdentifier) {
    if (privateIdentifierDiagnosticMessage !== undefined) {
      Parser_parseErrorAtCurrentToken(receiver, privateIdentifierDiagnosticMessage);
    } else {
      Parser_parseErrorAtCurrentToken(receiver, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies);
    }
    return Parser_createIdentifier(receiver, true /*isIdentifier*/);
  }
  // Only for end of file because the error gets reported incorrectly on embedded script tags.
  const reportAtCurrentPosition = receiver!.token === KindEndOfFile;
  if (diagnosticMessage !== undefined) {
    if (reportAtCurrentPosition) {
      const pos = Scanner_TokenFullStart(receiver!.scanner);
      Parser_parseErrorAt(receiver, pos, pos, diagnosticMessage);
    } else {
      Parser_parseErrorAtCurrentToken(receiver, diagnosticMessage);
    }
  } else if (isReservedWord(receiver!.token)) {
    if (reportAtCurrentPosition) {
      const pos = Scanner_TokenFullStart(receiver!.scanner);
      Parser_parseErrorAt(receiver, pos, pos, diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, Scanner_TokenText(receiver!.scanner));
    } else {
      Parser_parseErrorAtCurrentToken(receiver, diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, Scanner_TokenText(receiver!.scanner));
    }
  } else {
    if (reportAtCurrentPosition) {
      const pos = Scanner_TokenFullStart(receiver!.scanner);
      Parser_parseErrorAt(receiver, pos, pos, diagnostics.Identifier_expected);
    } else {
      Parser_parseErrorAtCurrentToken(receiver, diagnostics.Identifier_expected);
    }
  }
  return Parser_createMissingIdentifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.finishNodeWithEnd","kind":"method","status":"implemented","sigHash":"9f3ff7cf15b1979c95a60afb44a469599188ebfa97f2a6cd8fda5fec086fcc2c","bodyHash":"df23eaf225bbd93696d0f0e68be40bf1490f1ca820edca28ea588ad2e47fc3b9"}
 *
 * Go source:
 * func (p *Parser) finishNodeWithEnd(node *ast.Node, pos int, end int) *ast.Node {
 * 	node.Loc = core.NewTextRange(pos, end)
 * 	node.Flags |= p.contextFlags
 * 	if p.hasParseError {
 * 		node.Flags |= ast.NodeFlagsThisNodeHasError
 * 		p.hasParseError = false
 * 	}
 * 	p.overrideParentInImmediateChildren(node)
 * 	return node
 * }
 */
export function Parser_finishNodeWithEnd(receiver: GoPtr<Parser>, node: GoPtr<Node>, pos: int, end: int): GoPtr<Node> {
  node!.Loc = NewTextRange(pos, end);
  node!.Flags |= receiver!.contextFlags;
  if (receiver!.hasParseError) {
    node!.Flags |= NodeFlagsThisNodeHasError;
    receiver!.hasParseError = false;
  }
  Parser_overrideParentInImmediateChildren(receiver, node);
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfStatement","kind":"method","status":"implemented","sigHash":"65304e1da57e0ec3076b6395fb5efa3c248d61a4583a05ea1b78f278f957c3d0","bodyHash":"894c04a19ce9d2b868b3112e4386f588fd61cf8ea92ea3ea919f20d75bfac04d"}
 *
 * Go source:
 * func (p *Parser) isStartOfStatement() bool {
 * 	switch p.token {
 * 	// 'catch' and 'finally' do not actually indicate that the code is part of a statement,
 * 	// however, we say they are here so that we may gracefully parse them and error later.
 * 	case ast.KindAtToken, ast.KindSemicolonToken, ast.KindOpenBraceToken, ast.KindVarKeyword, ast.KindLetKeyword,
 * 		ast.KindUsingKeyword, ast.KindFunctionKeyword, ast.KindClassKeyword, ast.KindEnumKeyword, ast.KindIfKeyword,
 * 		ast.KindDoKeyword, ast.KindWhileKeyword, ast.KindForKeyword, ast.KindContinueKeyword, ast.KindBreakKeyword,
 * 		ast.KindReturnKeyword, ast.KindWithKeyword, ast.KindSwitchKeyword, ast.KindThrowKeyword, ast.KindTryKeyword,
 * 		ast.KindDebuggerKeyword, ast.KindCatchKeyword, ast.KindFinallyKeyword:
 * 		return true
 * 	case ast.KindImportKeyword:
 * 		return p.isStartOfDeclaration() || p.isNextTokenOpenParenOrLessThanOrDot()
 * 	case ast.KindConstKeyword, ast.KindExportKeyword:
 * 		return p.isStartOfDeclaration()
 * 	case ast.KindAsyncKeyword, ast.KindDeclareKeyword, ast.KindInterfaceKeyword, ast.KindModuleKeyword, ast.KindNamespaceKeyword,
 * 		ast.KindTypeKeyword, ast.KindGlobalKeyword, ast.KindDeferKeyword:
 * 		// When these don't start a declaration, they're an identifier in an expression statement
 * 		return true
 * 	case ast.KindAccessorKeyword, ast.KindPublicKeyword, ast.KindPrivateKeyword, ast.KindProtectedKeyword, ast.KindStaticKeyword,
 * 		ast.KindReadonlyKeyword:
 * 		// When these don't start a declaration, they may be the start of a class member if an identifier
 * 		// immediately follows. Otherwise they're an identifier in an expression statement.
 * 		return p.isStartOfDeclaration() || !p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOnSameLine)
 * 
 * 	default:
 * 		return p.isStartOfExpression()
 * 	}
 * }
 */
export function Parser_isStartOfStatement(receiver: GoPtr<Parser>): bool {
  switch (receiver!.token) {
    // 'catch' and 'finally' do not actually indicate that the code is part of a statement,
    // however, we say they are here so that we may gracefully parse them and error later.
    case KindAtToken:
    case KindSemicolonToken:
    case KindOpenBraceToken:
    case KindVarKeyword:
    case KindLetKeyword:
    case KindUsingKeyword:
    case KindFunctionKeyword:
    case KindClassKeyword:
    case KindEnumKeyword:
    case KindIfKeyword:
    case KindDoKeyword:
    case KindWhileKeyword:
    case KindForKeyword:
    case KindContinueKeyword:
    case KindBreakKeyword:
    case KindReturnKeyword:
    case KindWithKeyword:
    case KindSwitchKeyword:
    case KindThrowKeyword:
    case KindTryKeyword:
    case KindDebuggerKeyword:
    case KindCatchKeyword:
    case KindFinallyKeyword:
      return true;
    case KindImportKeyword:
      return Parser_isStartOfDeclaration(receiver) || Parser_isNextTokenOpenParenOrLessThanOrDot(receiver);
    case KindConstKeyword:
    case KindExportKeyword:
      return Parser_isStartOfDeclaration(receiver);
    case KindAsyncKeyword:
    case KindDeclareKeyword:
    case KindInterfaceKeyword:
    case KindModuleKeyword:
    case KindNamespaceKeyword:
    case KindTypeKeyword:
    case KindGlobalKeyword:
    case KindDeferKeyword:
      // When these don't start a declaration, they're an identifier in an expression statement
      return true;
    case KindAccessorKeyword:
    case KindPublicKeyword:
    case KindPrivateKeyword:
    case KindProtectedKeyword:
    case KindStaticKeyword:
    case KindReadonlyKeyword:
      // When these don't start a declaration, they may be the start of a class member if an identifier
      // immediately follows. Otherwise they're an identifier in an expression statement.
      return Parser_isStartOfDeclaration(receiver) || !Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOnSameLine);

    default:
      return Parser_isStartOfExpression(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfDeclaration","kind":"method","status":"implemented","sigHash":"490c7ab0d3e7021f1ce1921fdd2d25bb4fde9de4804e63fc623e65d90cb44aa9","bodyHash":"189a312d08e2375cfb63c8053cdacacc3935a6c7946f2f13e2804186eba7d5a1"}
 *
 * Go source:
 * func (p *Parser) isStartOfDeclaration() bool {
 * 	return p.lookAhead((*Parser).scanStartOfDeclaration)
 * }
 */
export function Parser_isStartOfDeclaration(receiver: GoPtr<Parser>): bool {
  return Parser_lookAhead(receiver, Parser_scanStartOfDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanStartOfDeclaration","kind":"method","status":"implemented","sigHash":"4275adc4beae6040d5faac94d7cb3075bbe882a58505c8b8a44cbcdbea5dcef1","bodyHash":"6e8eab970733124c0bbf41bf944e5d3190bca4f4d0c702b32628ff71f3dc9b4b"}
 *
 * Go source:
 * func (p *Parser) scanStartOfDeclaration() bool {
 * 	for {
 * 		switch p.token {
 * 		case ast.KindVarKeyword, ast.KindLetKeyword, ast.KindConstKeyword, ast.KindFunctionKeyword, ast.KindClassKeyword,
 * 			ast.KindEnumKeyword:
 * 			return true
 * 		case ast.KindUsingKeyword:
 * 			return p.isUsingDeclaration()
 * 		case ast.KindAwaitKeyword:
 * 			return p.isAwaitUsingDeclaration()
 * 		// 'declare', 'module', 'namespace', 'interface'* and 'type' are all legal JavaScript identifiers;
 * 		// however, an identifier cannot be followed by another identifier on the same line. This is what we
 * 		// count on to parse out the respective declarations. For instance, we exploit this to say that
 * 		//
 * 		//    namespace n
 * 		//
 * 		// can be none other than the beginning of a namespace declaration, but need to respect that JavaScript sees
 * 		//
 * 		//    namespace
 * 		//    n
 * 		//
 * 		// as the identifier 'namespace' on one line followed by the identifier 'n' on another.
 * 		// We need to look one token ahead to see if it permissible to try parsing a declaration.
 * 		//
 * 		// *Note*: 'interface' is actually a strict mode reserved word. So while
 * 		//
 * 		//   "use strict"
 * 		//   interface
 * 		//   I {}
 * 		//
 * 		// could be legal, it would add complexity for very little gain.
 * 		case ast.KindInterfaceKeyword, ast.KindTypeKeyword, ast.KindDeferKeyword:
 * 			return p.nextTokenIsIdentifierOnSameLine()
 * 		case ast.KindModuleKeyword, ast.KindNamespaceKeyword:
 * 			return p.nextTokenIsIdentifierOrStringLiteralOnSameLine()
 * 		case ast.KindAbstractKeyword, ast.KindAccessorKeyword, ast.KindAsyncKeyword, ast.KindDeclareKeyword, ast.KindPrivateKeyword,
 * 			ast.KindProtectedKeyword, ast.KindPublicKeyword, ast.KindReadonlyKeyword:
 * 			previousToken := p.token
 * 			p.nextToken()
 * 			// ASI takes effect for this modifier.
 * 			if p.hasPrecedingLineBreak() {
 * 				return false
 * 			}
 * 			if previousToken == ast.KindDeclareKeyword && p.token == ast.KindTypeKeyword {
 * 				// If we see 'declare type', then commit to parsing a type alias. parseTypeAliasDeclaration will
 * 				// report Line_break_not_permitted_here if needed.
 * 				return true
 * 			}
 * 			continue
 * 		case ast.KindGlobalKeyword:
 * 			p.nextToken()
 * 			return p.token == ast.KindOpenBraceToken || p.token == ast.KindIdentifier || p.token == ast.KindExportKeyword
 * 		case ast.KindImportKeyword:
 * 			p.nextToken()
 * 			return p.token == ast.KindDeferKeyword || p.token == ast.KindStringLiteral || p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBraceToken || tokenIsIdentifierOrKeyword(p.token)
 * 		case ast.KindExportKeyword:
 * 			p.nextToken()
 * 			if p.token == ast.KindEqualsToken || p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBraceToken ||
 * 				p.token == ast.KindDefaultKeyword || p.token == ast.KindAsKeyword || p.token == ast.KindAtToken {
 * 				return true
 * 			}
 * 			if p.token == ast.KindTypeKeyword {
 * 				p.nextToken()
 * 				return p.token == ast.KindAsteriskToken || p.token == ast.KindOpenBraceToken || p.isIdentifier() && !p.hasPrecedingLineBreak()
 * 			}
 * 			continue
 * 		case ast.KindStaticKeyword:
 * 			p.nextToken()
 * 			continue
 * 		}
 * 		return false
 * 	}
 * }
 */
export function Parser_scanStartOfDeclaration(receiver: GoPtr<Parser>): bool {
  while (true) {
    switch (receiver!.token) {
      case KindVarKeyword:
      case KindLetKeyword:
      case KindConstKeyword:
      case KindFunctionKeyword:
      case KindClassKeyword:
      case KindEnumKeyword:
        return true;
      case KindUsingKeyword:
        return Parser_isUsingDeclaration(receiver);
      case KindAwaitKeyword:
        return Parser_isAwaitUsingDeclaration(receiver);
      // 'declare', 'module', 'namespace', 'interface'* and 'type' are all legal JavaScript identifiers;
      // however, an identifier cannot be followed by another identifier on the same line. This is what we
      // count on to parse out the respective declarations. For instance, we exploit this to say that
      //
      //    namespace n
      //
      // can be none other than the beginning of a namespace declaration, but need to respect that JavaScript sees
      //
      //    namespace
      //    n
      //
      // as the identifier 'namespace' on one line followed by the identifier 'n' on another.
      // We need to look one token ahead to see if it permissible to try parsing a declaration.
      //
      // *Note*: 'interface' is actually a strict mode reserved word. So while
      //
      //   "use strict"
      //   interface
      //   I {}
      //
      // could be legal, it would add complexity for very little gain.
      case KindInterfaceKeyword:
      case KindTypeKeyword:
      case KindDeferKeyword:
        return Parser_nextTokenIsIdentifierOnSameLine(receiver);
      case KindModuleKeyword:
      case KindNamespaceKeyword:
        return Parser_nextTokenIsIdentifierOrStringLiteralOnSameLine(receiver);
      case KindAbstractKeyword:
      case KindAccessorKeyword:
      case KindAsyncKeyword:
      case KindDeclareKeyword:
      case KindPrivateKeyword:
      case KindProtectedKeyword:
      case KindPublicKeyword:
      case KindReadonlyKeyword: {
        const previousToken = receiver!.token;
        Parser_nextToken(receiver);
        // ASI takes effect for this modifier.
        if (Parser_hasPrecedingLineBreak(receiver)) {
          return false;
        }
        if (previousToken === KindDeclareKeyword && receiver!.token === KindTypeKeyword) {
          // If we see 'declare type', then commit to parsing a type alias. parseTypeAliasDeclaration will
          // report Line_break_not_permitted_here if needed.
          return true;
        }
        continue;
      }
      case KindGlobalKeyword:
        Parser_nextToken(receiver);
        return receiver!.token === KindOpenBraceToken || receiver!.token === KindIdentifier || receiver!.token === KindExportKeyword;
      case KindImportKeyword:
        Parser_nextToken(receiver);
        return (
          receiver!.token === KindDeferKeyword ||
          receiver!.token === KindStringLiteral ||
          receiver!.token === KindAsteriskToken ||
          receiver!.token === KindOpenBraceToken ||
          tokenIsIdentifierOrKeyword(receiver!.token)
        );
      case KindExportKeyword: {
        Parser_nextToken(receiver);
        if (
          receiver!.token === KindEqualsToken ||
          receiver!.token === KindAsteriskToken ||
          receiver!.token === KindOpenBraceToken ||
          receiver!.token === KindDefaultKeyword ||
          receiver!.token === KindAsKeyword ||
          receiver!.token === KindAtToken
        ) {
          return true;
        }
        if (receiver!.token === KindTypeKeyword) {
          Parser_nextToken(receiver);
          return receiver!.token === KindAsteriskToken || receiver!.token === KindOpenBraceToken || (Parser_isIdentifier(receiver) && !Parser_hasPrecedingLineBreak(receiver));
        }
        continue;
      }
      case KindStaticKeyword:
        Parser_nextToken(receiver);
        continue;
    }
    return false;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isNextTokenOpenParenOrLessThanOrDot","kind":"method","status":"implemented","sigHash":"1bd7ae25e7b75eefdb2d68df50d13e54109f62f687284c10d1f26a2044f1d2cd","bodyHash":"6d0bd447fc0b230347ab700a5a9ca920a6d4800ac8704010511e81a1b2e6b5f7"}
 *
 * Go source:
 * func (p *Parser) isNextTokenOpenParenOrLessThanOrDot() bool {
 * 	return p.lookAhead((*Parser).nextTokenIsOpenParenOrLessThanOrDot)
 * }
 */
export function Parser_isNextTokenOpenParenOrLessThanOrDot(receiver: GoPtr<Parser>): bool {
  return Parser_lookAhead(receiver, Parser_nextTokenIsOpenParenOrLessThanOrDot);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsOpenParenOrLessThanOrDot","kind":"method","status":"implemented","sigHash":"601cbffe735a3c950a5223286df320df0db095c509dbb930e62d40f5623fab44","bodyHash":"133a8ccf7b1e0bd9268f72193b24652cfa217ee7a06b6cfac717cd237d87be7a"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsOpenParenOrLessThanOrDot() bool {
 * 	switch p.nextToken() {
 * 	case ast.KindOpenParenToken, ast.KindLessThanToken, ast.KindDotToken:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Parser_nextTokenIsOpenParenOrLessThanOrDot(receiver: GoPtr<Parser>): bool {
  switch (Parser_nextToken(receiver)) {
    case KindOpenParenToken:
    case KindLessThanToken:
    case KindDotToken:
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isImportAttributeName","kind":"method","status":"implemented","sigHash":"27938beb3857849c7b834c0b2d2116d60eb08fc6566f949a9683512ae005e949","bodyHash":"d3e1002bacc7fb3121a8818999074ad6d5ca9c215eb93c47c55cedb4f8a20913"}
 *
 * Go source:
 * func (p *Parser) isImportAttributeName() bool {
 * 	return tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindStringLiteral
 * }
 */
export function Parser_isImportAttributeName(receiver: GoPtr<Parser>): bool {
  return tokenIsIdentifierOrKeyword(receiver!.token) || receiver!.token === KindStringLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isUsingDeclaration","kind":"method","status":"implemented","sigHash":"3d7f50520d66c51fe6634f5f104ead19b8d6cb4885a227fb77b1b14da49d9016","bodyHash":"679e9e3a8d9de32975b26d233eaaa7f1e8a0ea82364b5b0084ad0e89d0a9cf5d"}
 *
 * Go source:
 * func (p *Parser) isUsingDeclaration() bool {
 * 	// 'using' always starts a lexical declaration if followed by an identifier. We also eagerly parse
 * 	// |ObjectBindingPattern| so that we can report a grammar error during check. We don't parse out
 * 	// |ArrayBindingPattern| since it potentially conflicts with element access (i.e., `using[x]`).
 * 	return p.lookAhead(func(p *Parser) bool {
 * 		return p.nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine( /*disallowOf* / false)
 * 	})
 * }
 */
export function Parser_isUsingDeclaration(receiver: GoPtr<Parser>): bool {
  // 'using' always starts a lexical declaration if followed by an identifier. We also eagerly parse
  // |ObjectBindingPattern| so that we can report a grammar error during check. We don't parse out
  // |ArrayBindingPattern| since it potentially conflicts with element access (i.e., `using[x]`).
  return Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => {
    return Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine(p, /*disallowOf*/ false);
  });
}

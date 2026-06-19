import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import * as slices from "../../../go/slices.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import { AsSourceFile, Node_ArgumentList, Node_ElementList, Node_Initializer, Node_ParameterList, Node_PropertyList, Node_Statement, Node_StatementList, Node_Text, Node_TypeArgumentList, Node_TypeParameterList } from "../../ast/ast.js";
import { Node_AsNode, Node_End, Node_Pos, Node_Modifiers, Node_Name, Node_FunctionLikeData, NodeDefault_AsNode, NodeDefault_Modifiers, NodeDefault_Name, NodeList_End, NodeList_HasTrailingComma, NodeList_Pos, Node_Clone } from "../../ast/spine.js";
import { NodeFlagsNone } from "../../ast/generated/flags.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindArrayBindingPattern,
  KindArrayLiteralExpression,
  KindArrowFunction,
  KindCallExpression,
  KindCallSignature,
  KindCaseClause,
  KindCaseKeyword,
  KindClassDeclaration,
  KindClassExpression,
  KindComputedPropertyName,
  KindConstructor,
  KindConstructorType,
  KindConstructSignature,
  KindDefaultClause,
  KindDefaultKeyword,
  KindEqualsToken,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindGetKeyword,
  KindIdentifier,
  KindImportAttributes,
  KindInterfaceDeclaration,
  KindJsxAttribute,
  KindJsxNamespacedName,
  KindJsxElement,
  KindJsxExpression,
  KindJsxFragment,
  KindJSTypeAliasDeclaration,
  KindJsxSelfClosingElement,
  KindJsxSpreadAttribute,
  KindJsxText,
  KindMethodDeclaration,
  KindNamedExports,
  KindNamedImports,
  KindNewExpression,
  KindNoSubstitutionTemplateLiteral,
  KindNumericLiteral,
  KindBigIntLiteral,
  KindObjectBindingPattern,
  KindObjectLiteralExpression,
  KindPrivateIdentifier,
  KindPropertyAccessExpression,
  KindQualifiedName,
  KindSetAccessor,
  KindSetKeyword,
  KindStringLiteral,
  KindTaggedTemplateExpression,
  KindThisKeyword,
  KindTypeAliasDeclaration,
  KindTypeOfKeyword,
} from "../../ast/generated/kinds.js";
import {
  KindBlock,
  KindBindingElement,
  KindCaseBlock,
  KindCatchClause,
  KindClassStaticBlockDeclaration,
  KindDoStatement,
  KindEnumMember,
  KindExportSpecifier,
  KindExternalModuleReference,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindHeritageClause,
  KindIfStatement,
  KindImportAttribute,
  KindImportClause,
  KindImportDeclaration,
  KindImportSpecifier,
  KindIndexSignature,
  KindJSImportDeclaration,
  KindLabeledStatement,
  KindMethodSignature,
  KindModuleBlock,
  KindNamespaceExport,
  KindNamespaceImport,
  KindNotEmittedTypeElement,
  KindParameter,
  KindPropertyAssignment,
  KindPropertySignature,
  KindSemicolonClassElement,
  KindShorthandPropertyAssignment,
  KindSourceFile,
  KindSpreadAssignment,
  KindSwitchStatement,
  KindTemplateSpan,
  KindTryStatement,
  KindVariableDeclaration,
  KindVariableDeclarationList,
  KindVariableStatement,
  KindCommaToken,
  KindDecorator,
  KindPropertyDeclaration,
  KindJsxAttributes,
  KindJsxOpeningElement,
  KindJsxOpeningFragment,
  KindJsxClosingElement,
  KindJsxClosingFragment,
  KindWhileStatement,
  KindWithStatement,
} from "../../ast/generated/kinds.js";
import { IsBlock, IsDecorator, IsKeywordKind, IsObjectLiteralExpression, IsPunctuationKind, IsStringLiteral } from "../../ast/generated/predicates.js";
import { GetSourceFileOfNode, IsBindingPattern, IsExpression, IsJSDocKind, IsMemberName, IsModifier, IsStatement, IsTypeNode, NodeIsSynthesized, PositionIsSynthesized } from "../../ast/utilities.js";
import { EmitContext_MostOriginal } from "../emitcontext.js";
import { ScriptKindJSON } from "../../core/scriptkind.js";
import { NewLineKind_GetNewLineCharacter, NewLineKindNone } from "../../core/compileroptions.js";
import { GetSourceTextOfNodeFromSourceFile } from "../../scanner/utilities.js";
import { TokenToString } from "../../scanner/scanner.js";
import type { OperatorPrecedence } from "../../ast/precedence.js";
import { GetLeftmostExpression, OperatorPrecedenceComma, OperatorPrecedenceDisallowComma, OperatorPrecedenceLeftHandSide, OperatorPrecedenceLowest, OperatorPrecedenceMember, OperatorPrecedenceSpread, OperatorPrecedenceUnary, OperatorPrecedenceUpdate, OperatorPrecedenceYield } from "../../ast/precedence.js";
import { getLiteralTextFlagsNone, greatestEnd } from "../utilities.js";
import { KindTemplateHead, KindTemplateMiddle, KindTemplateTail } from "../../ast/generated/kinds.js";
import { Printer_getLiteralTextOfNode } from "./expressions.js";
import {
  AsBindingElement,
  AsBindingPattern,
  AsBigIntLiteral,
  AsBlock,
  AsCaseOrDefaultClause,
  AsComputedPropertyName,
  AsDecorator,
  AsIdentifier,
  AsJsxAttribute,
  AsJsxAttributes,
  AsJsxClosingElement,
  AsJsxClosingFragment,
  AsJsxExpression,
  AsJsxElement,
  AsJsxFragment,
  AsJsxNamespacedName,
  AsJsxOpeningElement,
  AsJsxOpeningFragment,
  AsJsxSelfClosingElement,
  AsJsxSpreadAttribute,
  AsJsxText,
  AsKeywordExpression,
  AsNoSubstitutionTemplateLiteral,
  AsNumericLiteral,
  AsParameterDeclaration,
  AsPrivateIdentifier,
  AsPropertyAccessExpression,
  AsQualifiedName,
  AsStringLiteral,
  AsCallSignatureDeclaration,
  AsCaseBlock,
  AsCatchClause,
  AsClassStaticBlockDeclaration,
  AsConstructorDeclaration,
  AsConstructSignatureDeclaration,
  AsEnumMember,
  AsExportSpecifier,
  AsExternalModuleReference,
  AsFunctionDeclaration,
  AsGetAccessorDeclaration,
  AsHeritageClause,
  AsIfStatement,
  AsImportAttribute,
  AsImportAttributes,
  AsImportClause,
  AsImportDeclaration,
  AsImportSpecifier,
  AsIndexSignatureDeclaration,
  AsMethodDeclaration,
  AsMethodSignatureDeclaration,
  AsModuleBlock,
  AsNamedExports,
  AsNamedImports,
  AsNamespaceExport,
  AsNamespaceImport,
  AsNotEmittedTypeElement,
  AsPropertyAssignment,
  AsPropertyDeclaration,
  AsPropertySignatureDeclaration,
  AsSetAccessorDeclaration,
  AsSemicolonClassElement,
  AsShorthandPropertyAssignment,
  AsSpreadAssignment,
  AsTemplateHead,
  AsTemplateMiddle,
  AsTemplateTail,
  AsTemplateSpan,
  AsSwitchStatement,
  AsTryStatement,
  AsVariableDeclaration,
  AsVariableDeclarationList,
  AsVariableStatement,
} from "../../ast/generated/casts.js";
import type { AccessorDeclarationBase } from "../../ast/generated/node.js";
import { NewParenthesizedExpression, NewPropertyAccessExpression } from "../../ast/generated/factory.js";
import type { BindingElement, CaseOrDefaultClause, ComputedPropertyName, ConstructorDeclaration, ConstructSignatureDeclaration, Decorator, GetAccessorDeclaration, Identifier, IfStatement, ForStatement, ImportClause as ImportClauseData, ImportDeclaration, ImportSpecifier, IndexSignatureDeclaration, JsxAttribute, JsxAttributes, JsxClosingElement, JsxClosingFragment, JsxElement, JsxFragment, JsxOpeningElement, JsxOpeningFragment, JsxSelfClosingElement, JsxText, MetaProperty, MethodDeclaration, MethodSignatureDeclaration, ParameterDeclaration, PrivateIdentifier, PropertyAssignment, PropertyDeclaration, PropertySignatureDeclaration, QualifiedName, SetAccessorDeclaration, ShorthandPropertyAssignment } from "../../ast/generated/data.js";
import type { BindingElementNode, BindingName, BlockOrExpression, CaseOrDefaultClauseNode, DeclarationName, EntityName, Expression, IdentifierNode, JsxAttributeLike, JsxAttributeName, JsxAttributeValue, JsxChild, JsxTagNameExpression, LiteralLikeNode, MemberName, ModifierLike, ParameterDeclarationNode, ParameterList, PropertyName, Statement, StringLiteralNode, TokenNode, TypeNode } from "../../ast/generated/unions.js";
import type { Symbol } from "../../ast/symbol.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange, TextRange_End, TextRange_Pos } from "../../core/text.js";
import { Every, IfElse, LastOrNil } from "../../core/core.js";
import type { Generator } from "../../sourcemap/generator.js";
import type { EmitTextWriter } from "../emittextwriter.js";
import { EmitContext_AssignCommentAndSourceMapRanges, EmitContext_CommentRange, EmitContext_EmitFlags, EmitContext_GetEmitHelpers, EmitContext_HasRecordedExternalHelpers } from "../emitcontext.js";
import { EFHelperName, EFIndented, EFNoIndentation, EFNoLeadingComments } from "../emitflags.js";
import type { EmitHelper } from "../helpers.js";
import { compareEmitHelpers } from "../helpers.js";
import { IsFileLevelUniqueName, lineCharacterCache_getLineAndCharacter } from "../utilities.js";
import { Generator_AddSourceMapping } from "../../sourcemap/generator.js";
import { NodeFactory_NewUniqueNameEx } from "../factory.js";
import { GeneratedIdentifierFlagsFileLevel, GeneratedIdentifierFlagsOptimistic } from "../generatedidentifierflags.js";
import { NameGenerator_GenerateName, NameGenerator_PopScope, NameGenerator_PushScope } from "../namegenerator.js";
import { NewTextWriter } from "../textwriter.js";
import { Printer_emitCallSignature, Printer_emitEnumMember, Printer_emitExpression, Printer_emitJsxExpression, Printer_emitJsxSpreadAttribute, Printer_emitKeywordExpression, Printer_emitObjectBindingPattern, Printer_emitArrayBindingPattern, Printer_emitPropertyAccessExpression, Printer_emitSpreadAssignment, Printer_emitStringLiteral, Printer_emitNoSubstitutionTemplateLiteral, Printer_emitNumericLiteral, Printer_emitBigIntLiteral, Printer_emitTemplateHead, Printer_emitTemplateMiddle, Printer_emitTemplateTail, Printer_writeLiteral } from "./expressions.js";
import { Printer_emitHeritageClause, Printer_emitNotEmittedTypeElement, Printer_emitTypeAnnotation, Printer_emitTypeArguments, Printer_emitTypeNodeOutsideExtends, Printer_emitTypeParameters } from "./types.js";
import { Printer_decreaseIndentIf, Printer_emitCaseOrDefaultClauseStatements, Printer_emitCaseBlock, Printer_emitCatchClause, Printer_emitClassStaticBlockDeclaration, Printer_emitExportSpecifier, Printer_emitExternalModuleReference, Printer_emitFunctionBody, Printer_emitFunctionBodyNode, Printer_emitImportAttribute, Printer_emitImportAttributes, Printer_emitImportClause, Printer_emitImportSpecifier, Printer_emitJsxNamespacedName, Printer_emitModuleBlock, Printer_emitNamedExports, Printer_emitNamedImports, Printer_emitNamespaceExport, Printer_emitNamespaceImport, Printer_emitParametersForIndexSignature, Printer_emitSemicolonClassElement, Printer_emitStatement, Printer_emitVariableDeclaration, Printer_emitVariableDeclarationList, Printer_generateNameIfNeeded, Printer_increaseIndentIf, Printer_shouldReuseTempVariableScope, Printer_emitJSDocNode } from "./statements-declarations.js";
import { Printer_emitCommentsAfterNode, Printer_emitCommentsAfterToken, Printer_emitCommentsBeforeNode, Printer_emitCommentsBeforeToken, Printer_emitLeadingComments, Printer_emitTrailingComments, Printer_emitTrailingCommentsOfPosition, Printer_shouldEmitLeadingComments, Printer_shouldEmitTrailingComments, Printer_writeComment } from "./comments.js";
import { Printer_emitListRange, Printer_emitSourceFile, Printer_emitSourceMapsAfterNode, Printer_emitSourceMapsAfterToken, Printer_emitSourceMapsBeforeNode, Printer_emitSourceMapsBeforeToken, Printer_emitTemplateSpan, Printer_getClosingLineTerminatorCount, Printer_getLeadingLineTerminatorCount, Printer_getSeparatingLineTerminatorCount, Printer_setSourceFile, Printer_shouldEmitOnMultipleLines, Printer_writeLine, Printer_writeLines, Printer_writeLineSeparatorsAfter, Printer_writeLineSeparatorsAndIndentBefore } from "./source-maps.js";
import type { ListFormat, Printer, printerState, tokenEmitFlags, WriteKind } from "./state.js";
import {
  LFDecorators,
  LFModifiers,
  LFJsxElementOrFragmentChildren,
  LFJsxElementAttributes,
  LFAsteriskDelimited,
  LFBarDelimited,
  LFAmpersandDelimited,
  LFCommaDelimited,
  LFDelimitersMask,
  LFIndented,
  LFNone,
  LFParameters,
  LFPreferNewLine,
  WriteKindComment,
  WriteKindKeyword,
  WriteKindLiteral,
  WriteKindNone,
  WriteKindOperator,
  WriteKindParameter,
  WriteKindProperty,
  WriteKindPunctuation,
  WriteKindStringLiteral,
  LFAllowTrailingComma,
  LFLinesMask,
  LFNoInterveningComments,
  LFSingleLine,
  LFSpaceAfterList,
  LFSpaceBetweenBraces,
  LFSpaceBetweenSiblings,
  tefNone,
  tefNoComments,
  tefNoSourceMaps,
  commentSeparatorAfter,
} from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getTextOfNode","kind":"method","status":"implemented","sigHash":"5480703edd86ebe112d291bc138a414735d7c543c0c943d8a715eef70dd757d3","bodyHash":"37d5892ab435c6b979d43f9d74d6f5969ea72989a695a1391d964d1345b2aee2"}
 *
 * Go source:
 * func (p *Printer) getTextOfNode(node *ast.Node, includeTrivia bool) string {
 * 	if ast.IsMemberName(node) && p.emitContext.autoGenerate[node] != nil {
 * 		return p.nameGenerator.GenerateName(node)
 * 	}
 * 
 * 	if ast.IsStringLiteral(node) {
 * 		if textSourceNode := p.emitContext.textSource[node]; textSourceNode != nil {
 * 			return p.getTextOfNode(textSourceNode, includeTrivia)
 * 		}
 * 	}
 * 
 * 	canUseSourceFile := p.currentSourceFile != nil && node.Parent != nil && !ast.NodeIsSynthesized(node)
 * 
 * 	switch node.Kind {
 * 	case ast.KindIdentifier,
 * 		ast.KindPrivateIdentifier,
 * 		ast.KindJsxNamespacedName:
 * 		if !canUseSourceFile || ast.GetSourceFileOfNode(node) != p.emitContext.MostOriginal(p.currentSourceFile.AsNode()).AsSourceFile() {
 * 			return node.Text()
 * 		}
 * 	case ast.KindStringLiteral,
 * 		ast.KindNumericLiteral,
 * 		ast.KindBigIntLiteral,
 * 		ast.KindNoSubstitutionTemplateLiteral,
 * 		ast.KindTemplateHead,
 * 		ast.KindTemplateMiddle,
 * 		ast.KindTemplateTail:
 * 		return p.getLiteralTextOfNode(node, nil /*sourceFile* /, getLiteralTextFlagsNone)
 * 	default:
 * 		panic(fmt.Sprintf("unexpected node: %v", node.Kind))
 * 	}
 * 	return scanner.GetSourceTextOfNodeFromSourceFile(p.currentSourceFile, node, includeTrivia)
 * }
 */
export function Printer_getTextOfNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, includeTrivia: bool): string {
  if (IsMemberName(node) && receiver!.emitContext!.autoGenerate.has(node as unknown as MemberName)) {
    return NameGenerator_GenerateName(receiver!.nameGenerator, node as unknown as MemberName);
  }

  if (IsStringLiteral(node)) {
    const textSourceNode = receiver!.emitContext!.textSource.get(node as unknown as StringLiteralNode);
    if (textSourceNode !== undefined) {
      return Printer_getTextOfNode(receiver, textSourceNode, includeTrivia);
    }
  }

  const canUseSourceFile = receiver!.currentSourceFile !== undefined && node!.Parent !== undefined && !NodeIsSynthesized(node);

  switch (node!.Kind) {
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindJsxNamespacedName:
      if (!canUseSourceFile || GetSourceFileOfNode(node) !== AsSourceFile(EmitContext_MostOriginal(receiver!.emitContext, NodeDefault_AsNode(receiver!.currentSourceFile)))) {
        return Node_Text(node);
      }
      break;
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
    case KindTemplateMiddle:
    case KindTemplateTail:
      return Printer_getLiteralTextOfNode(receiver, node as unknown as LiteralLikeNode, undefined, getLiteralTextFlagsNone);
    default:
      throw new globalThis.Error(`unexpected node: ${node!.Kind}`);
  }
  return GetSourceTextOfNodeFromSourceFile(receiver!.currentSourceFile, node, includeTrivia);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeAs","kind":"method","status":"implemented","sigHash":"163b6e13b1798526320f275b3f5501fde68c424c4ed63807715453ce7986f66c","bodyHash":"9be34788ddb42cb69b3ce2a31785c62976324d801ea446eded5859793feb450f"}
 *
 * Go source:
 * func (p *Printer) writeAs(text string, writeKind WriteKind) {
 * 	switch writeKind {
 * 	case WriteKindNone:
 * 		p.writer.Write(text)
 * 	case WriteKindParameter:
 * 		p.writeParameter(text)
 * 	case WriteKindKeyword:
 * 		p.writeKeyword(text)
 * 	case WriteKindOperator:
 * 		p.writeOperator(text)
 * 	case WriteKindProperty:
 * 		p.writeProperty(text)
 * 	case WriteKindPunctuation:
 * 		p.writePunctuation(text)
 * 	case WriteKindStringLiteral:
 * 		p.writer.WriteStringLiteral(text)
 * 	case WriteKindComment:
 * 		p.writeComment(text)
 * 	case WriteKindLiteral:
 * 		p.writeLiteral(text)
 * 	default:
 * 		panic(fmt.Sprintf("unexpected printer.WriteKind: %v", writeKind))
 * 	}
 * }
 */
export function Printer_writeAs(receiver: GoPtr<Printer>, text: string, writeKind: WriteKind): void {
  switch (writeKind) {
    case WriteKindNone:
      receiver!.writer.Write(text);
      break;
    case WriteKindParameter:
      Printer_writeParameter(receiver, text);
      break;
    case WriteKindKeyword:
      Printer_writeKeyword(receiver, text);
      break;
    case WriteKindOperator:
      Printer_writeOperator(receiver, text);
      break;
    case WriteKindProperty:
      Printer_writeProperty(receiver, text);
      break;
    case WriteKindPunctuation:
      Printer_writePunctuation(receiver, text);
      break;
    case WriteKindStringLiteral:
      receiver!.writer.WriteStringLiteral(text);
      break;
    case WriteKindComment:
      Printer_writeComment(receiver, text);
      break;
    case WriteKindLiteral:
      Printer_writeLiteral(receiver, text);
      break;
    default:
      throw new globalThis.Error(`unexpected printer.WriteKind: ${writeKind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.write","kind":"method","status":"implemented","sigHash":"2df47e8f7a651faa2bae4bdef12439b2d92b278b602ffcfba631ca3268e938a9","bodyHash":"d59b16aa5328da7d89b9ea6413e12cddf45cf9df84876826f698ae545f97f1c6"}
 *
 * Go source:
 * func (p *Printer) write(text string) {
 * 	p.writeAs(text, p.writeKind)
 * }
 */
export function Printer_write(receiver: GoPtr<Printer>, text: string): void {
  Printer_writeAs(receiver, text, receiver!.writeKind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.setWriteKind","kind":"method","status":"implemented","sigHash":"04aeb0d74195a42cf1831cd76d9fd57583fe20c3c7d639ff7ff768e1d3fdbe73","bodyHash":"b0c5ac95cfa328cf46748ffab5e9115bc3f2daeea17d610e6b3c831397b34a36"}
 *
 * Go source:
 * func (p *Printer) setWriteKind(kind WriteKind) WriteKind {
 * 	previous := p.writeKind
 * 	p.writeKind = kind
 * 	return previous
 * }
 */
export function Printer_setWriteKind(receiver: GoPtr<Printer>, kind: WriteKind): WriteKind {
  const previous = receiver!.writeKind;
  receiver!.writeKind = kind;
  return previous;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeSymbol","kind":"method","status":"implemented","sigHash":"93b0edf567d9d70cace716b647f3528dee1f076d98e12431e43b6368a8837ad2","bodyHash":"d50dd2efff5698e44fbe209cb82e1421f81c415258508c0de6b7a44ad350ddc2"}
 *
 * Go source:
 * func (p *Printer) writeSymbol(text string, optSymbol *ast.Symbol) {
 * 	if optSymbol == nil {
 * 		p.write(text)
 * 	} else {
 * 		p.writer.WriteSymbol(text, optSymbol)
 * 	}
 * }
 */
export function Printer_writeSymbol(receiver: GoPtr<Printer>, text: string, optSymbol: GoPtr<Symbol>): void {
  if (optSymbol === undefined) {
    Printer_write(receiver, text);
  } else {
    receiver!.writer.WriteSymbol(text, optSymbol);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writePunctuation","kind":"method","status":"implemented","sigHash":"5b0fb3025d6d43ec82420fe55f85afccf278225c5c088422ffc73492b40c2469","bodyHash":"2f7b78c3d38b029968594c433831f4fad92ff1fbd8204277fc6f8a4488c44613"}
 *
 * Go source:
 * func (p *Printer) writePunctuation(text string) {
 * 	p.writer.WritePunctuation(text)
 * }
 */
export function Printer_writePunctuation(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WritePunctuation(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeOperator","kind":"method","status":"implemented","sigHash":"7378add848eee637fee861b621144c853e2e148edc9da6f566cdb7ab45ab4699","bodyHash":"aaeb7da31bfc7883e519da15455e8de53e9ec02e8c8a2b52e026250acc16e968"}
 *
 * Go source:
 * func (p *Printer) writeOperator(text string) {
 * 	p.writer.WriteOperator(text)
 * }
 */
export function Printer_writeOperator(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WriteOperator(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeKeyword","kind":"method","status":"implemented","sigHash":"2cf413838788067bd89856b8841a937d251397e452601cf5e83f8798c248f4b2","bodyHash":"951bcf58db7e9cf3c288c989336157565ab14b3b97f5c629fc74fa567eaf09b1"}
 *
 * Go source:
 * func (p *Printer) writeKeyword(text string) {
 * 	p.writer.WriteKeyword(text)
 * }
 */
export function Printer_writeKeyword(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WriteKeyword(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeProperty","kind":"method","status":"implemented","sigHash":"a96a548aaf313aef635cd41447cd08c5f0d945492263d18d2fc9bc4921ebbb97","bodyHash":"16693b5a3bd19520a0ab2dd96d901ea5ecf130366392f2ee2dd4c7e711d581af"}
 *
 * Go source:
 * func (p *Printer) writeProperty(text string) {
 * 	p.writer.WriteProperty(text)
 * }
 */
export function Printer_writeProperty(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WriteProperty(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeParameter","kind":"method","status":"implemented","sigHash":"f3ebcf7655d9db53f49151e23f90acf7d711d6d2d9f37c90cf4ace62d88dc2c7","bodyHash":"3e40aea9817878976529f2c87a3b53a97ea23c6878eb92a08b7ad9a71c6bd19d"}
 *
 * Go source:
 * func (p *Printer) writeParameter(text string) {
 * 	p.writer.WriteParameter(text)
 * }
 */
export function Printer_writeParameter(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WriteParameter(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeSpace","kind":"method","status":"implemented","sigHash":"e5ddccd41de57e8f0e1efdbc3776ebbb334b97495247044f39fb9f649afb9708","bodyHash":"9b9aa083301a37d4d2f3074ac24b1f3fc065ac15ba9af6038e7ac416fd095944"}
 *
 * Go source:
 * func (p *Printer) writeSpace() {
 * 	p.writer.WriteSpace(" ")
 * }
 */
export function Printer_writeSpace(receiver: GoPtr<Printer>): void {
  receiver!.writer.WriteSpace(" ");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeTrailingSemicolon","kind":"method","status":"implemented","sigHash":"5198846a706e11b6cb073e72fa948d91c1d81f8de50cd2c1c55976a3dfb8deb8","bodyHash":"1231f25738355b6a4b9bb269fda329c2dfdcbdf7cfabb5e3b26d1a95462e3748"}
 *
 * Go source:
 * func (p *Printer) writeTrailingSemicolon() {
 * 	p.writer.WriteTrailingSemicolon(";")
 * }
 */
export function Printer_writeTrailingSemicolon(receiver: GoPtr<Printer>): void {
  receiver!.writer.WriteTrailingSemicolon(";");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.increaseIndent","kind":"method","status":"implemented","sigHash":"1328b22638fbbd4219971e4692c7cd82ff2fed4cac8252a0ce58036da90120d5","bodyHash":"155ada15ec37615e5d825754d84048b58e47ecbe0d598a88b86bbfbaf1212a4d"}
 *
 * Go source:
 * func (p *Printer) increaseIndent() {
 * 	p.writer.IncreaseIndent()
 * }
 */
export function Printer_increaseIndent(receiver: GoPtr<Printer>): void {
  receiver!.writer.IncreaseIndent();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.decreaseIndent","kind":"method","status":"implemented","sigHash":"4ef172e8b2acaf9261cc2fd32cc5b655d4cc0af22ee635178fe68aca418e986f","bodyHash":"0f1cb11bad60276c1e418977bb9047ce668553930b9fa949673993d4d6b84986"}
 *
 * Go source:
 * func (p *Printer) decreaseIndent() {
 * 	p.writer.DecreaseIndent()
 * }
 */
export function Printer_decreaseIndent(receiver: GoPtr<Printer>): void {
  receiver!.writer.DecreaseIndent();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitIndented","kind":"method","status":"implemented","sigHash":"3a272c7953ee13de5fc3eed53f4a4cb2248fdce3f05b8011e26e4e3713890ed0","bodyHash":"b99f1795f1f6ddf93b23c727f0f2b59bd9a3f34fec59a6fe8e3e0420727742e5"}
 *
 * Go source:
 * func (p *Printer) shouldEmitIndented(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFIndented != 0
 * }
 */
export function Printer_shouldEmitIndented(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFIndented) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldElideIndentation","kind":"method","status":"implemented","sigHash":"e244d7efa6f088d745bcbf3ebfba17896aea6ea9817f7cf870934a74ac84f125","bodyHash":"ced2900cff8a9a1d22e4aa3d6c9f6c5c15762cf9840062886ddaa19a92ac12e1"}
 *
 * Go source:
 * func (p *Printer) shouldElideIndentation(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFNoIndentation != 0
 * }
 */
export function Printer_shouldElideIndentation(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFNoIndentation) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldAllowTrailingComma","kind":"method","status":"implemented","sigHash":"0e3dcaf39d71ff175c29d0f561c1094ddbae22c151c80c4bd760e742e4c220f0","bodyHash":"31a4f502eb2c6c579f189b6542114819ac8fd823ae7130fb11a358e94657bc07"}
 *
 * Go source:
 * func (p *Printer) shouldAllowTrailingComma(node *ast.Node, list *ast.NodeList) bool {
 * 	if p.currentSourceFile == nil || p.currentSourceFile.ScriptKind == core.ScriptKindJSON {
 * 		return false
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindObjectLiteralExpression:
 * 		return true
 * 	case ast.KindArrayLiteralExpression,
 * 		ast.KindArrowFunction,
 * 		ast.KindConstructor,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindFunctionType,
 * 		ast.KindConstructorType,
 * 		ast.KindCallSignature,
 * 		ast.KindConstructSignature,
 * 		ast.KindTaggedTemplateExpression,
 * 		ast.KindObjectBindingPattern,
 * 		ast.KindArrayBindingPattern,
 * 		ast.KindNamedImports,
 * 		ast.KindNamedExports,
 * 		ast.KindImportAttributes:
 * 		return true
 * 	case ast.KindClassExpression,
 * 		ast.KindClassDeclaration,
 * 		ast.KindInterfaceDeclaration:
 * 		return list == node.TypeParameterList()
 * 	case ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression,
 * 		ast.KindMethodDeclaration:
 * 		return true
 * 	case ast.KindCallExpression:
 * 		return true
 * 	case ast.KindNewExpression:
 * 		return true
 * 	}
 * 
 * 	return false
 * }
 */
export function Printer_shouldAllowTrailingComma(receiver: GoPtr<Printer>, node: GoPtr<Node>, list: GoPtr<NodeList>): bool {
  if (receiver!.currentSourceFile === undefined || receiver!.currentSourceFile!.ScriptKind === ScriptKindJSON) {
    return false as bool;
  }

  switch (node!.Kind) {
    case KindObjectLiteralExpression:
      return true as bool;
    case KindArrayLiteralExpression:
    case KindArrowFunction:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindFunctionType:
    case KindConstructorType:
    case KindCallSignature:
    case KindConstructSignature:
    case KindTaggedTemplateExpression:
    case KindObjectBindingPattern:
    case KindArrayBindingPattern:
    case KindNamedImports:
    case KindNamedExports:
    case KindImportAttributes:
      return true as bool;
    case KindClassExpression:
    case KindClassDeclaration:
    case KindInterfaceDeclaration:
      return (list === Node_TypeParameterList(node)) as bool;
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindMethodDeclaration:
      return true as bool;
    case KindCallExpression:
      return true as bool;
    case KindNewExpression:
      return true as bool;
  }

  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeTokenText","kind":"method","status":"implemented","sigHash":"b5ea478befe5b5c6729accc329a9d1aba75b0c7734093587e681f4ab61886011","bodyHash":"3066906df5a0d54272b9a64f6ff0e91f1a3c20fcd167368a4d1f206a0e8f6ffa"}
 *
 * Go source:
 * func (p *Printer) writeTokenText(token ast.Kind, writeKind WriteKind, pos int) int {
 * 	// !!! emit leading and trailing comments
 * 	// !!! emit leading and trailing source maps
 * 	tokenString := scanner.TokenToString(token)
 * 	p.writeAs(tokenString, writeKind)
 * 	if ast.PositionIsSynthesized(pos) {
 * 		return pos
 * 	} else {
 * 		return pos + len(tokenString)
 * 	}
 * }
 */
export function Printer_writeTokenText(receiver: GoPtr<Printer>, token: Kind, writeKind: WriteKind, pos: int): int {
  // !!! emit leading and trailing comments
  // !!! emit leading and trailing source maps
  const tokenString = TokenToString(token);
  Printer_writeAs(receiver, tokenString, writeKind);
  if (PositionIsSynthesized(pos)) {
    return pos;
  } else {
    return pos + tokenString.length;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitToken","kind":"method","status":"implemented","sigHash":"ee16373372254e313f7690ede61992afe8c00e9cf689349e2f0c5c03e74f3d73","bodyHash":"c6e0321ad70dc450aa3065e0d54be052fced6167fdb2b60b10e0f04cade4a16c"}
 *
 * Go source:
 * func (p *Printer) emitToken(token ast.Kind, pos int, writeKind WriteKind, contextNode *ast.Node) int {
 * 	return p.emitTokenEx(token, pos, writeKind, contextNode, tefNone)
 * }
 */
export function Printer_emitToken(receiver: GoPtr<Printer>, token: Kind, pos: int, writeKind: WriteKind, contextNode: GoPtr<Node>): int {
  return Printer_emitTokenEx(receiver, token, pos, writeKind, contextNode, tefNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTokenEx","kind":"method","status":"implemented","sigHash":"15e0c504bca114dd9a2ea8463ca5ee0000463df345b701cc8877bec50cc43a37","bodyHash":"5601fb1e1626c6afa89c7ac597a8385b4805d27477f7d5f8bae5c27a88e44419"}
 *
 * Go source:
 * func (p *Printer) emitTokenEx(token ast.Kind, pos int, writeKind WriteKind, contextNode *ast.Node, flags tokenEmitFlags) int {
 * 	state, pos := p.enterToken(token, pos, contextNode, flags)
 * 	pos = p.writeTokenText(token, writeKind, pos)
 * 	p.exitToken(token, pos, contextNode, state)
 * 	return pos
 * }
 */
export function Printer_emitTokenEx(receiver: GoPtr<Printer>, token: Kind, pos: int, writeKind: WriteKind, contextNode: GoPtr<Node>, flags: tokenEmitFlags): int {
  const [state, pos1] = Printer_enterToken(receiver, token, pos, contextNode, flags);
  const pos2 = Printer_writeTokenText(receiver, token, writeKind, pos1);
  Printer_exitToken(receiver, token, pos2, contextNode, state);
  return pos2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitKeywordNode","kind":"method","status":"implemented","sigHash":"a3c4cab842efa9089553989301a8d1618a2cffe1dcc8eb328c4e608b2c480b99","bodyHash":"96c30ea54c558927c784a62c4d33c533831409c8b625481fd9ba144f334c37da"}
 *
 * Go source:
 * func (p *Printer) emitKeywordNode(node *ast.TokenNode) {
 * 	p.emitKeywordNodeEx(node, tefNone)
 * }
 */
export function Printer_emitKeywordNode(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>): void {
  Printer_emitKeywordNodeEx(receiver, node, tefNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitKeywordNodeEx","kind":"method","status":"implemented","sigHash":"ac6b84daf31b5894436ecb67c61cab5437b65f43e9ccf1f86de4a7171ae5e3e6","bodyHash":"a6541aa2c3f3d4c218cf24031d32d44419abb89b21a6b52cf9359a065d498825"}
 *
 * Go source:
 * func (p *Printer) emitKeywordNodeEx(node *ast.TokenNode, flags tokenEmitFlags) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	state := p.enterTokenNode(node, flags)
 * 	p.writeTokenText(node.Kind, WriteKindKeyword, node.Pos())
 * 	p.exitTokenNode(node, state)
 * }
 */
export function Printer_emitKeywordNodeEx(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>, flags: tokenEmitFlags): void {
  if (node === undefined) {
    return;
  }

  const state = Printer_enterTokenNode(receiver, node, flags);
  Printer_writeTokenText(receiver, node!.Kind, WriteKindKeyword, Node_Pos(node));
  Printer_exitTokenNode(receiver, node, state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPunctuationNode","kind":"method","status":"implemented","sigHash":"746c606c062607f21f703e921b27aff4f0c242940479ae3af28865a3781e767f","bodyHash":"26cd60f68173bae9b5064b3ad04a94ecc042c30cbba880bab5fa0834b1c6848f"}
 *
 * Go source:
 * func (p *Printer) emitPunctuationNode(node *ast.TokenNode) {
 * 	p.emitPunctuationNodeEx(node, tefNone)
 * }
 */
export function Printer_emitPunctuationNode(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>): void {
  Printer_emitPunctuationNodeEx(receiver, node, tefNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPunctuationNodeEx","kind":"method","status":"implemented","sigHash":"178d8a08f6d522d1c9b3f134dc7b54ffa6aee722efd868ce3420c9cb709b14ba","bodyHash":"fccb88693f165e18551bccbe98ddabf56e76dcc0a88a5f024a6b7e9de9a37d84"}
 *
 * Go source:
 * func (p *Printer) emitPunctuationNodeEx(node *ast.TokenNode, flags tokenEmitFlags) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	state := p.enterTokenNode(node, flags)
 * 	p.writeTokenText(node.Kind, WriteKindPunctuation, node.Pos())
 * 	p.exitTokenNode(node, state)
 * }
 */
export function Printer_emitPunctuationNodeEx(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>, flags: tokenEmitFlags): void {
  if (node === undefined) {
    return;
  }

  const state = Printer_enterTokenNode(receiver, node, flags);
  Printer_writeTokenText(receiver, node!.Kind, WriteKindPunctuation, Node_Pos(node));
  Printer_exitTokenNode(receiver, node, state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTokenNode","kind":"method","status":"implemented","sigHash":"eebd65f292f8e069ed41ad74d9517015cc631a6aafa0ba5999c3d56aa5733bfa","bodyHash":"1a4e8f773a42a9a43ced08de2d9bd7c55cd6a20ec2717f81b5563a7a4023c44c"}
 *
 * Go source:
 * func (p *Printer) emitTokenNode(node *ast.TokenNode) {
 * 	p.emitTokenNodeEx(node, tefNone)
 * }
 */
export function Printer_emitTokenNode(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>): void {
  Printer_emitTokenNodeEx(receiver, node, tefNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTokenNodeEx","kind":"method","status":"implemented","sigHash":"7673319bfae58c9b142ae4e35d4b99d460d68af102b79c342624fa41bb51b2ac","bodyHash":"bedac1b505a1350c1e9492cf3e91fe9eec6aae1d4a35cfb262367402d908bd8f"}
 *
 * Go source:
 * func (p *Printer) emitTokenNodeEx(node *ast.TokenNode, flags tokenEmitFlags) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch {
 * 	case ast.IsKeywordKind(node.Kind):
 * 		p.emitKeywordNodeEx(node, flags)
 * 	case ast.IsPunctuationKind(node.Kind):
 * 		p.emitPunctuationNodeEx(node, flags)
 * 	default:
 * 		panic(fmt.Sprintf("unexpected TokenNode: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitTokenNodeEx(receiver: GoPtr<Printer>, node: GoPtr<TokenNode>, flags: tokenEmitFlags): void {
  if (node === undefined) {
    return;
  }

  if (IsKeywordKind(node!.Kind)) {
    Printer_emitKeywordNodeEx(receiver, node, flags);
  } else if (IsPunctuationKind(node!.Kind)) {
    Printer_emitPunctuationNodeEx(receiver, node, flags);
  } else {
    throw new globalThis.Error(`unexpected TokenNode: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIdentifierText","kind":"method","status":"implemented","sigHash":"8c4990541e384f4c262fc663c6ee26fc65ecbb84af2afce445782b05c782c9b7","bodyHash":"a7d4ceb896b37670755e1f88b9852c04e9d0a5e6419d38adca0538701ecf8bdf"}
 *
 * Go source:
 * func (p *Printer) emitIdentifierText(node *ast.Identifier) {
 * 	f := ast.GetSourceFileOfNode(node.AsNode())
 * 	debug.Assert(f == nil || p.currentSourceFile == nil || f.FileName() == p.currentSourceFile.FileName())
 * 	text := p.getTextOfNode(node.AsNode(), false /*includeTrivia* /)
 *
 * 	if p.IdToSymbol != nil {
 * 		if symbol, ok := p.IdToSymbol[node.AsNode()]; ok {
 * 			p.writeSymbol(text, symbol)
 * 			return
 * 		}
 * 	}
 * 	p.write(text)
 * }
 */
export function Printer_emitIdentifierText(receiver: GoPtr<Printer>, node: GoPtr<Identifier>): void {
  const f = GetSourceFileOfNode(NodeDefault_AsNode(node));
  // debug.Assert(f == nil || p.currentSourceFile == nil || f.FileName() == p.currentSourceFile.FileName())
  const text = Printer_getTextOfNode(receiver, NodeDefault_AsNode(node), false as bool);

  if (receiver!.IdToSymbol !== undefined) {
    const symbol = receiver!.IdToSymbol.get(NodeDefault_AsNode(node));
    if (symbol !== undefined) {
      Printer_writeSymbol(receiver, text, symbol);
      return;
    }
  }
  Printer_write(receiver, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIdentifierName","kind":"method","status":"implemented","sigHash":"61f363a1eac3d9af37c5d81c84ceb30adf6172d3cf27f3c8427c72a964c6eb0a","bodyHash":"d2075ecf12c24020e724f152aac6855382aaa97741d740e3e61f2e4751cf5160"}
 *
 * Go source:
 * func (p *Printer) emitIdentifierName(node *ast.Identifier) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitIdentifierText(node)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIdentifierName(receiver: GoPtr<Printer>, node: GoPtr<Identifier>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitIdentifierText(receiver, node);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIdentifierNameNode","kind":"method","status":"implemented","sigHash":"03cc084bf3dfa4d80c7095420d608ac80e95e38caca12aeeb448486997671f20","bodyHash":"5e180f75022f042797a3817a72198c8def28a5271a60ef1ac83fe9aff96a0f0e"}
 *
 * Go source:
 * func (p *Printer) emitIdentifierNameNode(node *ast.IdentifierNode) {
 * 	if node == nil {
 * 		return
 * 	}
 * 	p.emitIdentifierName(node.AsIdentifier())
 * }
 */
export function Printer_emitIdentifierNameNode(receiver: GoPtr<Printer>, node: GoPtr<IdentifierNode>): void {
  if (node === undefined) {
    return;
  }
  Printer_emitIdentifierName(receiver, AsIdentifier(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getUniqueHelperName","kind":"method","status":"implemented","sigHash":"81cf2cc152c5172459d93e9a4b6ff48f92205259350f0974fd13b16b28cd6506","bodyHash":"ea1ef78c5725e6d71cfc80ae73c86d5a5897349d910bccfc209251a5642a8049"}
 *
 * Go source:
 * func (p *Printer) getUniqueHelperName(name string) *ast.IdentifierNode {
 * 	helperName := p.uniqueHelperNames[name]
 * 	if helperName == nil {
 * 		helperName := p.emitContext.Factory.NewUniqueNameEx(name, AutoGenerateOptions{Flags: GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsOptimistic})
 * 		p.generateName(helperName)
 * 		p.uniqueHelperNames[name] = helperName
 * 		return helperName
 * 	}
 * 	return helperName.Clone(p.emitContext.Factory)
 * }
 */
export function Printer_getUniqueHelperName(receiver: GoPtr<Printer>, name: string): GoPtr<IdentifierNode> {
  const helperName = receiver!.uniqueHelperNames!.get(name);
  if (helperName === undefined) {
    const newHelperName = NodeFactory_NewUniqueNameEx(
      receiver!.emitContext!.Factory,
      name,
      {
        Flags: (GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsOptimistic) >>> 0,
        Prefix: "",
        Suffix: "",
      },
    );
    Printer_generateName(receiver, newHelperName);
    receiver!.uniqueHelperNames!.set(name, newHelperName);
    return newHelperName;
  }
  return Node_Clone(helperName, receiver!.emitContext!.Factory!) as GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIdentifierReference","kind":"method","status":"implemented","sigHash":"8f1a2e31d1447ca33a227720bdf4b093e5880b8700cd159b7b7091c8f42cea19","bodyHash":"c3d688806c9ec79ae4a896c8395745a53d12249be6af6e9f2096c62563361575"}
 *
 * Go source:
 * func (p *Printer) emitIdentifierReference(node *ast.Identifier) {
 * 	if (p.externalHelpersModuleName != nil || p.uniqueHelperNames != nil) &&
 * 		p.emitContext.EmitFlags(node.AsNode())&EFHelperName != 0 {
 * 		if p.externalHelpersModuleName != nil {
 * 			// Substitute `__helper` with `tslib_1.__helper`
 * 			helper := p.emitContext.Factory.NewPropertyAccessExpression(
 * 				p.externalHelpersModuleName.Clone(p.emitContext.Factory),
 * 				nil, /*questionDotToken* /
 * 				node.Clone(p.emitContext.Factory),
 * 				ast.NodeFlagsNone,
 * 			)
 * 			p.emitContext.AssignCommentAndSourceMapRanges(helper, node.AsNode())
 * 			p.emitPropertyAccessExpression(helper.AsPropertyAccessExpression())
 * 			return
 * 		}
 * 		if p.uniqueHelperNames != nil {
 * 			// Substitute `__helper` with `__helper_1` if there is a conflict in an ES module.
 * 			helperName := p.getUniqueHelperName(node.Text)
 * 			p.emitContext.AssignCommentAndSourceMapRanges(helperName, node.AsNode())
 * 			node = helperName.AsIdentifier()
 * 		}
 * 	}
 * 
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitIdentifierText(node)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIdentifierReference(receiver: GoPtr<Printer>, node: GoPtr<Identifier>): void {
  if ((receiver!.externalHelpersModuleName !== undefined || receiver!.uniqueHelperNames !== undefined) &&
    (EmitContext_EmitFlags(receiver!.emitContext, NodeDefault_AsNode(node)) & EFHelperName) !== 0) {
    if (receiver!.externalHelpersModuleName !== undefined) {
      const helper = NewPropertyAccessExpression(
        receiver!.emitContext!.Factory!.AsNodeFactory(),
        Node_Clone(receiver!.externalHelpersModuleName, receiver!.emitContext!.Factory!) as GoPtr<Expression>,
        undefined,
        Node_Clone(NodeDefault_AsNode(node), receiver!.emitContext!.Factory!) as GoPtr<MemberName>,
        NodeFlagsNone,
      );
      EmitContext_AssignCommentAndSourceMapRanges(receiver!.emitContext, helper, NodeDefault_AsNode(node));
      Printer_emitPropertyAccessExpression(receiver, AsPropertyAccessExpression(helper));
      return;
    }
    if (receiver!.uniqueHelperNames !== undefined) {
      const helperName = Printer_getUniqueHelperName(receiver, node!.Text);
      EmitContext_AssignCommentAndSourceMapRanges(receiver!.emitContext, helperName, NodeDefault_AsNode(node));
      node = AsIdentifier(helperName);
    }
  }

  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitIdentifierText(receiver, node);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBindingIdentifier","kind":"method","status":"implemented","sigHash":"a50ca91e024ce8c8e0520c5788989e3f7a6e1ee48e4d3c21a649707dd38b9365","bodyHash":"1a83eb9b4b675a438e76e1f569df547f67c58807d46c237b1d98175128bce2de"}
 *
 * Go source:
 * func (p *Printer) emitBindingIdentifier(node *ast.Identifier) {
 * 	if p.uniqueHelperNames != nil &&
 * 		p.emitContext.EmitFlags(node.AsNode())&EFHelperName != 0 {
 * 		// Substitute `__helper` with `__helper_1` if there is a conflict in an ES module.
 * 		helperName := p.getUniqueHelperName(node.Text)
 * 		p.emitContext.AssignCommentAndSourceMapRanges(helperName, node.AsNode())
 * 		node = helperName.AsIdentifier()
 * 	}
 *
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitIdentifierText(node)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitBindingIdentifier(receiver: GoPtr<Printer>, node: GoPtr<Identifier>): void {
  let n = node;
  if (receiver!.uniqueHelperNames !== undefined &&
    (EmitContext_EmitFlags(receiver!.emitContext, NodeDefault_AsNode(node)) & EFHelperName) !== 0) {
    // Substitute `__helper` with `__helper_1` if there is a conflict in an ES module.
    const helperName = Printer_getUniqueHelperName(receiver, node!.Text);
    EmitContext_AssignCommentAndSourceMapRanges(receiver!.emitContext, helperName, NodeDefault_AsNode(node));
    n = AsIdentifier(helperName);
  }

  const state = Printer_enterNode(receiver, NodeDefault_AsNode(n));
  Printer_emitIdentifierText(receiver, n);
  Printer_exitNode(receiver, NodeDefault_AsNode(n), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLabelIdentifier","kind":"method","status":"implemented","sigHash":"5a169b0fc84c83ec698c943d93375c933dbdc388243bd692a115c573c1184bfb","bodyHash":"e3b57a9d9d939761f8ca17a615e6686f1eedfbe13a1ade5c365b9bcadf324b14"}
 *
 * Go source:
 * func (p *Printer) emitLabelIdentifier(node *ast.Identifier) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitIdentifierText(node)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitLabelIdentifier(receiver: GoPtr<Printer>, node: GoPtr<Identifier>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitIdentifierText(receiver, node);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPrivateIdentifier","kind":"method","status":"implemented","sigHash":"314c691437a75726a20d0dbae2c3cb5e3aac909c41cb3476a184da35fb7938e1","bodyHash":"232d6f3a630ee554864597289fe2f3e52cc1cdd01ccf5b8ad2ecb85693709772"}
 *
 * Go source:
 * func (p *Printer) emitPrivateIdentifier(node *ast.PrivateIdentifier) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.write(p.getTextOfNode(node.AsNode(), false /*includeTrivia* /))
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitPrivateIdentifier(receiver: GoPtr<Printer>, node: GoPtr<PrivateIdentifier>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_write(receiver, Printer_getTextOfNode(receiver, NodeDefault_AsNode(node), false as bool));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitQualifiedName","kind":"method","status":"implemented","sigHash":"0d0b057d7f2814667ce2d17823dd4a89f5f7c0987d6b1e19f62c47dfd8d8f065","bodyHash":"e8a6e835bd0b9b569e340ef798ceb1ce7dd9336df28b54a7219a799a9a893ce0"}
 *
 * Go source:
 * func (p *Printer) emitQualifiedName(node *ast.QualifiedName) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitEntityName(node.Left)
 * 	p.writePunctuation(".")
 * 	p.emitIdentifierName(node.Right.AsIdentifier())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitQualifiedName(receiver: GoPtr<Printer>, node: GoPtr<QualifiedName>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitEntityName(receiver, node!.Left);
  Printer_writePunctuation(receiver, ".");
  Printer_emitIdentifierName(receiver, AsIdentifier(node!.Right));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitComputedPropertyName","kind":"method","status":"implemented","sigHash":"8b3a9067a6128bddc0505d337af1ff3923b67bc1ac58174fcafd0d88dd0f5892","bodyHash":"805c74511dd9bdc15db5f216a2a9cdc5fb63864ebc354f737a1b9fee0404a380"}
 *
 * Go source:
 * func (p *Printer) emitComputedPropertyName(node *ast.ComputedPropertyName) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("[")
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 	p.writePunctuation("]")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitComputedPropertyName(receiver: GoPtr<Printer>, node: GoPtr<ComputedPropertyName>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "[");
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceDisallowComma);
  Printer_writePunctuation(receiver, "]");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEntityName","kind":"method","status":"implemented","sigHash":"dab6e703fe553ccf1a4701b80dca23d467d7ef64a325594f606b4e514a9f165c","bodyHash":"f6062d2bfac39ddeda4b4b6d2272d27c86ad8be847690dc30ce9585bed27fda4"}
 *
 * Go source:
 * func (p *Printer) emitEntityName(node *ast.EntityName) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierReference(node.AsIdentifier())
 * 	case ast.KindQualifiedName:
 * 		p.emitQualifiedName(node.AsQualifiedName())
 * 	case ast.KindPropertyAccessExpression:
 * 		// TypeQuery nodes may have PropertyAccessExpression as exprName (e.g. typeof foo.x).
 * 		// TS's emitter handles this via generic emit(); we dispatch to expression emitter here.
 * 		p.emitExpression(node, ast.OperatorPrecedenceDisallowComma)
 * 	default:
 * 		panic(fmt.Sprintf("unexpected EntityName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitEntityName(receiver: GoPtr<Printer>, node: GoPtr<EntityName>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierReference(receiver, AsIdentifier(node));
      break;
    case KindQualifiedName:
      Printer_emitQualifiedName(receiver, AsQualifiedName(node));
      break;
    case KindPropertyAccessExpression:
      // TypeQuery nodes may have PropertyAccessExpression as exprName (e.g. typeof foo.x).
      Printer_emitExpression(receiver, node as unknown as Expression, OperatorPrecedenceDisallowComma);
      break;
    default:
      throw new globalThis.Error(`unexpected EntityName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBindingName","kind":"method","status":"implemented","sigHash":"f64994717043cee465b7f2dbde1d4eb02da3e96fb55a4e1fc3346670f2585952","bodyHash":"44c5badd1463f97173578b78a6cea7c5faa472efc8ea7c4632c03451f2e9b96d"}
 *
 * Go source:
 * func (p *Printer) emitBindingName(node *ast.BindingName) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitBindingIdentifier(node.AsIdentifier())
 * 	case ast.KindObjectBindingPattern:
 * 		p.emitObjectBindingPattern(node.AsBindingPattern())
 * 	case ast.KindArrayBindingPattern:
 * 		p.emitArrayBindingPattern(node.AsBindingPattern())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected BindingName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitBindingName(receiver: GoPtr<Printer>, node: GoPtr<BindingName>): void {
  if (node === undefined) {
    return;
  }

  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitBindingIdentifier(receiver, AsIdentifier(node));
      break;
    case KindObjectBindingPattern:
      Printer_emitObjectBindingPattern(receiver, AsBindingPattern(node));
      break;
    case KindArrayBindingPattern:
      Printer_emitArrayBindingPattern(receiver, AsBindingPattern(node));
      break;
    default:
      throw new globalThis.Error(`unexpected BindingName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPropertyName","kind":"method","status":"implemented","sigHash":"ef4ce4fb2d7f8199ad6b7343d16915bf7ff2d9f22231a65dcb19309a365853de","bodyHash":"0f311751320286eef5f83dd7da4e801fb14baac3158e89eb507c7ff4a05c6664"}
 *
 * Go source:
 * func (p *Printer) emitPropertyName(node *ast.PropertyName) {
 * 	if node == nil {
 * 		return
 * 	}
 * 
 * 	savedWriteKind := p.writeKind
 * 	p.writeKind = WriteKindProperty
 * 
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindPrivateIdentifier:
 * 		p.emitPrivateIdentifier(node.AsPrivateIdentifier())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	case ast.KindNoSubstitutionTemplateLiteral:
 * 		p.emitNoSubstitutionTemplateLiteral(node.AsNoSubstitutionTemplateLiteral())
 * 	case ast.KindNumericLiteral:
 * 		p.emitNumericLiteral(node.AsNumericLiteral())
 * 	case ast.KindBigIntLiteral:
 * 		p.emitBigIntLiteral(node.AsBigIntLiteral())
 * 	case ast.KindComputedPropertyName:
 * 		p.emitComputedPropertyName(node.AsComputedPropertyName())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected PropertyName: %v", node.Kind))
 * 	}
 * 
 * 	p.writeKind = savedWriteKind
 * }
 */
export function Printer_emitPropertyName(receiver: GoPtr<Printer>, node: GoPtr<PropertyName>): void {
  if (node === undefined) {
    return;
  }

  const savedWriteKind = receiver!.writeKind;
  receiver!.writeKind = WriteKindProperty;

  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    case KindPrivateIdentifier:
      Printer_emitPrivateIdentifier(receiver, AsPrivateIdentifier(node));
      break;
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    case KindNoSubstitutionTemplateLiteral:
      Printer_emitNoSubstitutionTemplateLiteral(receiver, AsNoSubstitutionTemplateLiteral(node));
      break;
    case KindNumericLiteral:
      Printer_emitNumericLiteral(receiver, AsNumericLiteral(node));
      break;
    case KindBigIntLiteral:
      Printer_emitBigIntLiteral(receiver, AsBigIntLiteral(node));
      break;
    case KindComputedPropertyName:
      Printer_emitComputedPropertyName(receiver, AsComputedPropertyName(node));
      break;
    default:
      throw new globalThis.Error(`unexpected PropertyName: ${node!.Kind}`);
  }

  receiver!.writeKind = savedWriteKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModifierList","kind":"method","status":"implemented","sigHash":"989355473ee6c9a7d07534b1f6ec83f2a8cb81718a69617225f521e8b322c369","bodyHash":"03e5f6496f6bf7551aa4dd937ae842b79c0cdf9ce4ca5fdbb42eaa938716e345"}
 *
 * Go source:
 * func (p *Printer) emitModifierList(parentNode *ast.Node, modifiers *ast.ModifierList, allowDecorators bool) int {
 * 	if modifiers == nil || len(modifiers.Nodes) == 0 {
 * 		return parentNode.Pos()
 * 	}
 * 
 * 	if core.Every(modifiers.Nodes, ast.IsModifier) {
 * 		// if all modifier-likes are `Modifier`, simply emit the list as modifiers.
 * 		p.emitList((*Printer).emitKeywordNode, parentNode, &modifiers.NodeList, LFModifiers)
 * 	} else if core.Every(modifiers.Nodes, ast.IsDecorator) {
 * 		if !allowDecorators {
 * 			return parentNode.Pos()
 * 		}
 * 
 * 		// if all modifier-likes are `Decorator`, simply emit the list as decorators.
 * 		p.emitList((*Printer).emitModifierLike, parentNode, &modifiers.NodeList, LFDecorators)
 * 	} else {
 * 		if p.OnBeforeEmitNodeList != nil {
 * 			p.OnBeforeEmitNodeList(&modifiers.NodeList)
 * 		}
 * 
 * 		// partition modifiers into contiguous chunks of `Modifier` or `Decorator` so as to
 * 		// use consistent formatting for each chunk
 * 		type Mode int
 * 		const (
 * 			ModeNone Mode = iota
 * 			ModeModifiers
 * 			ModeDecorators
 * 		)
 * 
 * 		lastMode := ModeNone
 * 		mode := ModeNone
 * 		start := 0
 * 		pos := 0
 * 
 * 		var lastModifier *ast.ModifierLike
 * 		for start < len(modifiers.Nodes) {
 * 			for pos < len(modifiers.Nodes) {
 * 				lastModifier = modifiers.Nodes[pos]
 * 				if ast.IsDecorator(lastModifier) {
 * 					mode = ModeDecorators
 * 				} else {
 * 					mode = ModeModifiers
 * 				}
 * 				if lastMode == ModeNone {
 * 					lastMode = mode
 * 				} else if mode != lastMode {
 * 					break
 * 				}
 * 				pos++
 * 			}
 * 
 * 			textRange := core.NewTextRange(-1, -1)
 * 			if start == 0 {
 * 				textRange = core.NewTextRange(modifiers.Pos(), textRange.End())
 * 			}
 * 			if pos == len(modifiers.Nodes)-1 {
 * 				textRange = core.NewTextRange(textRange.Pos(), modifiers.End())
 * 			}
 * 			if allowDecorators || lastMode == ModeModifiers {
 * 				p.emitListItems(
 * 					(*Printer).emitModifierLike,
 * 					parentNode,
 * 					modifiers.Nodes[start:pos],
 * 					core.IfElse(lastMode == ModeModifiers, LFModifiers, LFDecorators),
 * 					false, /*hasTrailingComma* /
 * 					textRange,
 * 				)
 * 			}
 * 			start = pos
 * 			lastMode = mode
 * 			pos++
 * 		}
 * 
 * 		if p.OnAfterEmitNodeList != nil {
 * 			p.OnAfterEmitNodeList(&modifiers.NodeList)
 * 		}
 * 	}
 * 
 * 	return greatestEnd(parentNode.Pos(), core.LastOrNil(modifiers.Nodes))
 * }
 */
export function Printer_emitModifierList(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, modifiers: GoPtr<ModifierList>, allowDecorators: bool): int {
  if (modifiers === undefined || modifiers!.Nodes.length === 0) {
    return Node_Pos(parentNode);
  }

  if (Every(modifiers!.Nodes, IsModifier)) {
    // if all modifier-likes are `Modifier`, simply emit the list as modifiers.
    Printer_emitList(receiver, Printer_emitKeywordNode, parentNode, modifiers as unknown as GoPtr<NodeList>, LFModifiers);
  } else if (Every(modifiers!.Nodes, IsDecorator)) {
    if (!allowDecorators) {
      return Node_Pos(parentNode);
    }

    // if all modifier-likes are `Decorator`, simply emit the list as decorators.
    Printer_emitList(receiver, Printer_emitModifierLike, parentNode, modifiers as unknown as GoPtr<NodeList>, LFDecorators);
  } else {
    if (receiver!.__tsgoEmbedded0?.OnBeforeEmitNodeList !== undefined) {
      receiver!.__tsgoEmbedded0!.OnBeforeEmitNodeList(modifiers as unknown as GoPtr<NodeList>);
    }

    // partition modifiers into contiguous chunks of `Modifier` or `Decorator`
    const ModeNone = 0;
    const ModeModifiers = 1;
    const ModeDecorators = 2;

    let lastMode = ModeNone;
    let mode = ModeNone;
    let start = 0;
    let pos = 0;

    while (start < modifiers!.Nodes.length) {
      while (pos < modifiers!.Nodes.length) {
        const lastModifier = modifiers!.Nodes[pos];
        if (IsDecorator(lastModifier)) {
          mode = ModeDecorators;
        } else {
          mode = ModeModifiers;
        }
        if (lastMode === ModeNone) {
          lastMode = mode;
        } else if (mode !== lastMode) {
          break;
        }
        pos++;
      }

      const textRangePos = start === 0 ? NodeList_Pos(modifiers as unknown as GoPtr<NodeList>) : -1;
      const textRangeEnd = pos === modifiers!.Nodes.length - 1 ? NodeList_End(modifiers as unknown as GoPtr<NodeList>) : -1;
      const textRange = NewTextRange(textRangePos, textRangeEnd);
      if (allowDecorators || lastMode === ModeModifiers) {
        Printer_emitListItems(
          receiver,
          Printer_emitModifierLike,
          parentNode,
          modifiers!.Nodes.slice(start, pos),
          IfElse(lastMode === ModeModifiers, LFModifiers, LFDecorators),
          false as bool,
          textRange,
        );
      }
      start = pos;
      lastMode = mode;
      pos++;
    }

    if (receiver!.__tsgoEmbedded0?.OnAfterEmitNodeList !== undefined) {
      receiver!.__tsgoEmbedded0!.OnAfterEmitNodeList(modifiers as unknown as GoPtr<NodeList>);
    }
  }

  return greatestEnd(Node_Pos(parentNode), LastOrNil(modifiers!.Nodes) as unknown as { End: () => int });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParameterName","kind":"method","status":"implemented","sigHash":"2e047ded2946076332f9a97dc1517f6cc1703e651e677778892d2b0d2a3ee473","bodyHash":"0ecc8b055a5fa3972941f45d1cefb63e254c5d3aa26cb19acbe22721418ea54d"}
 *
 * Go source:
 * func (p *Printer) emitParameterName(node *ast.BindingName) {
 * 	savedWriteKind := p.writeKind
 * 	p.writeKind = WriteKindParameter
 * 	p.emitBindingName(node)
 * 	p.writeKind = savedWriteKind
 * }
 */
export function Printer_emitParameterName(receiver: GoPtr<Printer>, node: GoPtr<BindingName>): void {
  const savedWriteKind = receiver!.writeKind;
  receiver!.writeKind = WriteKindParameter;
  Printer_emitBindingName(receiver, node);
  receiver!.writeKind = savedWriteKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParameter","kind":"method","status":"implemented","sigHash":"624f89851b7946b35c33a2a52578a88e65eacfedfa7f00ce6774caf9605a5b35","bodyHash":"bf0707a3fdeebf2b1e4387b4e18f70e7e0975da30a1ad5ee129d95307b75e2f8"}
 *
 * Go source:
 * func (p *Printer) emitParameter(node *ast.ParameterDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitTokenNode(node.DotDotDotToken)
 * 	p.emitParameterName(node.Name())
 * 	p.emitTokenNode(node.QuestionToken)
 * 
 * 	p.emitTypeAnnotation(node.Type)
 * 
 * 	// The comment position has to fallback to any present node within the parameter declaration because as it turns
 * 	// out, the parser can make parameter declarations with _just_ an initializer.
 * 	p.emitInitializer(node.Initializer, greatestEnd(node.Pos(), node.Type, node.QuestionToken, node.Name(), node.Modifiers()), node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitParameter(receiver: GoPtr<Printer>, node: GoPtr<ParameterDeclaration>): void {
  const parameterNode = NodeDefault_AsNode(node);
  const parameterName = Node_Name(parameterNode);
  const parameterModifiers = Node_Modifiers(parameterNode);
  const state = Printer_enterNode(receiver, parameterNode);
  Printer_emitModifierList(receiver, parameterNode, parameterModifiers, true as bool);
  Printer_emitTokenNode(receiver, node!.DotDotDotToken);
  Printer_emitParameterName(receiver, parameterName as unknown as GoPtr<BindingName>);
  Printer_emitTokenNode(receiver, node!.QuestionToken);
  Printer_emitTypeAnnotation(receiver, node!.Type);
  // The comment position has to fallback to any present node within the parameter declaration because as it turns
  // out, the parser can make parameter declarations with _just_ an initializer.
  Printer_emitInitializer(
    receiver,
    node!.Initializer,
    greatestEnd(
      Node_Pos(parameterNode),
      node!.Type as unknown as { End: () => int },
      node!.QuestionToken as unknown as { End: () => int },
      parameterName as unknown as { End: () => int },
      parameterModifiers as unknown as { End: () => int },
    ),
    parameterNode,
  );
  Printer_exitNode(receiver, parameterNode, state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParameterDeclarationNode","kind":"method","status":"implemented","sigHash":"e99a41f42fd5a770d5e4409346e8b8253b0d848e3a727485628c8ec249becdf4","bodyHash":"3201dcd47da3b86d137789d320a6fea167c80583848eff872be7e6f320370486"}
 *
 * Go source:
 * func (p *Printer) emitParameterDeclarationNode(node *ast.ParameterDeclarationNode) {
 * 	p.emitParameter(node.AsParameterDeclaration())
 * }
 */
export function Printer_emitParameterDeclarationNode(receiver: GoPtr<Printer>, node: GoPtr<ParameterDeclarationNode>): void {
  Printer_emitParameter(receiver, AsParameterDeclaration(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDecorator","kind":"method","status":"implemented","sigHash":"eb50ea820a072d8ff0d1473280cdc2c80b0c34afabc4d7b9e58193ebb23d8e81","bodyHash":"3cfa389efff4e35e69bdd722b129ddcacfa9efe0883d5faf14b0303f1358cc77"}
 *
 * Go source:
 * func (p *Printer) emitDecorator(node *ast.Decorator) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("@")
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLeftHandSide)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitDecorator(receiver: GoPtr<Printer>, node: GoPtr<Decorator>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "@");
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLeftHandSide);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModifierLike","kind":"method","status":"implemented","sigHash":"b57e899526d36712e5527ad5ec6a9f547d4ea34fcb92262f381866f9cd7b61ee","bodyHash":"a98626c8413c4863cec8887dc6b86faf537180500ce3ed64d2f0af09c0872e99"}
 *
 * Go source:
 * func (p *Printer) emitModifierLike(node *ast.ModifierLike) {
 * 	switch {
 * 	case ast.IsDecorator(node):
 * 		p.emitDecorator(node.AsDecorator())
 * 	case ast.IsModifier(node):
 * 		p.emitKeywordNode(node)
 * 	default:
 * 		panic(fmt.Sprintf("unhandled ModifierLike: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitModifierLike(receiver: GoPtr<Printer>, node: GoPtr<ModifierLike>): void {
  if (IsDecorator(node)) {
    Printer_emitDecorator(receiver, AsDecorator(node));
  } else if (IsModifier(node)) {
    Printer_emitKeywordNode(receiver, node);
  } else {
    throw new globalThis.Error(`unhandled ModifierLike: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitInitializer","kind":"method","status":"implemented","sigHash":"1298ea360549f1423eb9067ef03d950b83546bc569da0d23ff2bb3dc443e42c8","bodyHash":"addb0c57b9453d4c210720ee28f81c68bf59f0d126cbc4ecccc546ddebeea76c"}
 *
 * Go source:
 * func (p *Printer) emitInitializer(node *ast.Expression, equalTokenPos int, contextNode *ast.Node) {
 * 	if node == nil {
 * 		return
 * 	}
 * 
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindEqualsToken, equalTokenPos, WriteKindOperator, contextNode)
 * 	p.writeSpace()
 * 	p.emitExpression(node, ast.OperatorPrecedenceDisallowComma)
 * }
 */
export function Printer_emitInitializer(receiver: GoPtr<Printer>, node: GoPtr<Expression>, equalTokenPos: int, contextNode: GoPtr<Node>): void {
  if (node === undefined) {
    return;
  }
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindEqualsToken, equalTokenPos, WriteKindOperator, contextNode);
  Printer_writeSpace(receiver);
  Printer_emitExpression(receiver, node, OperatorPrecedenceDisallowComma);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParameters","kind":"method","status":"implemented","sigHash":"783b50cfa63d886f9650ac928a22aec4bce595776a9758a7a10b52630917047e","bodyHash":"b4a036f8bfddf216e4e1acc8fbc6b50b65670e9cabc3ccdb73821e80ff3bde94"}
 *
 * Go source:
 * func (p *Printer) emitParameters(parentNode *ast.Node, parameters *ast.ParameterList) {
 * 	p.generateAllNames(parameters)
 * 	p.emitList((*Printer).emitParameterDeclarationNode, parentNode, parameters, LFParameters /*|core.IfElse(p.shouldAllowTrailingComma(parentNode, parameters), LFAllowTrailingComma, LFNone)* /) // TODO: preserve trailing comma after Strada migration
 * }
 */
export function Printer_emitParameters(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, parameters: GoPtr<ParameterList>): void {
  Printer_generateAllNames(receiver, parameters);
  Printer_emitList(receiver, Printer_emitParameterDeclarationNode, parentNode, parameters, LFParameters);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSignature","kind":"method","status":"implemented","sigHash":"969857a0909a32214bcf3f0a97d2b296c30949dddcd5890154247caf4e5d05ae","bodyHash":"09eb0de441f21ff9c3710545617f913c1dad5b5c3a68e282e85c364c118ce78d"}
 *
 * Go source:
 * func (p *Printer) emitSignature(node *ast.Node) {
 * 	n := node.FunctionLikeData()
 * 
 * 	// !!! In old emitter, quickinfo used type arguments in place of type parameters on instantiated signatures
 * 	////if n.TypeArguments != nil {
 * 	////	p.emitTypeArguments(node, n.TypeArguments)
 * 	////} else {
 * 	p.emitTypeParameters(node, n.TypeParameters)
 * 	////}
 * 
 * 	p.emitParameters(node, n.Parameters)
 * 	p.emitTypeAnnotation(n.Type)
 * }
 */
export function Printer_emitSignature(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  const n = Node_FunctionLikeData(node);

  // !!! In old emitter, quickinfo used type arguments in place of type parameters on instantiated signatures
  ////if n.TypeArguments != nil {
  ////	p.emitTypeArguments(node, n.TypeArguments)
  ////} else {
  Printer_emitTypeParameters(receiver, node, n!.TypeParameters);
  ////}

  Printer_emitParameters(receiver, node, n!.Parameters);
  Printer_emitTypeAnnotation(receiver, n!.Type);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPropertySignature","kind":"method","status":"implemented","sigHash":"fc6926a0748d0e99de360675248f83aaebc33f2a65f0dddf8106eb25749f6df6","bodyHash":"1b36a03863266c511f87f32128d8447c606534b2d09aeb92f2f48fd7a794399d"}
 *
 * Go source:
 * func (p *Printer) emitPropertySignature(node *ast.PropertySignatureDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.emitPropertyName(node.Name())
 * 	p.emitTokenNode(node.PostfixToken)
 * 	p.emitTypeAnnotation(node.Type)
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitPropertySignature(receiver: GoPtr<Printer>, node: GoPtr<PropertySignatureDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false as bool);
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  Printer_emitTokenNode(receiver, node!.PostfixToken);
  Printer_emitTypeAnnotation(receiver, node!.Type);
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPropertyDeclaration","kind":"method","status":"implemented","sigHash":"05c814fb37e5b4e6ce7b754afe7e25741f9628f77442f1ae4b3018f9b0f601eb","bodyHash":"94eb6e433fb8b1925bc57dd2ec9573f3a05e0a0fd6b58026dfe55af193b9928d"}
 *
 * Go source:
 * func (p *Printer) emitPropertyDeclaration(node *ast.PropertyDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitPropertyName(node.Name())
 * 	p.emitTokenNode(node.PostfixToken)
 * 	p.emitTypeAnnotation(node.Type)
 * 	p.emitInitializer(node.Initializer, greatestEnd(node.Name().End(), node.Type, node.PostfixToken), node.AsNode())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitPropertyDeclaration(receiver: GoPtr<Printer>, node: GoPtr<PropertyDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), true as bool);
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  Printer_emitTokenNode(receiver, node!.PostfixToken);
  Printer_emitTypeAnnotation(receiver, node!.Type);
  Printer_emitInitializer(
    receiver,
    node!.Initializer,
    greatestEnd(
      Node_End(Node_Name(NodeDefault_AsNode(node)) as unknown as GoPtr<Node>),
      node!.Type as unknown as { End: () => int },
      node!.PostfixToken as unknown as { End: () => int },
    ),
    NodeDefault_AsNode(node),
  );
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMethodSignature","kind":"method","status":"implemented","sigHash":"9dc63029c17352317cbfa638b550ebe73810b2d3eca9deb86cd3c2f1e0deddb5","bodyHash":"6b434d80d9c21e5cd29e233eb18aea1274745324a2ea0ba2e35d7ebf43e962d6"}
 *
 * Go source:
 * func (p *Printer) emitMethodSignature(node *ast.MethodSignatureDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.emitPropertyName(node.Name())
 * 	p.emitTokenNode(node.PostfixToken)
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitSignature(node.AsNode())
 * 	p.writeTrailingSemicolon()
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitMethodSignature(receiver: GoPtr<Printer>, node: GoPtr<MethodSignatureDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false as bool);
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  Printer_emitTokenNode(receiver, node!.PostfixToken);
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitSignature(receiver, NodeDefault_AsNode(node));
  Printer_writeTrailingSemicolon(receiver);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMethodDeclaration","kind":"method","status":"implemented","sigHash":"03cd76571e715cae37d9bea8ee443829368ad20b5536f8b5a43d6e5bf50ddb8c","bodyHash":"1f50175caaa7e06e0bb1c99be09651ad467aacb3704ff77add24aaae28ece5b1"}
 *
 * Go source:
 * func (p *Printer) emitMethodDeclaration(node *ast.MethodDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitTokenNode(node.AsteriskToken)
 * 	p.emitPropertyName(node.Name())
 * 	p.emitTokenNode(node.PostfixToken)
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitSignature(node.AsNode())
 * 	p.emitFunctionBodyNode(node.Body)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitMethodDeclaration(receiver: GoPtr<Printer>, node: GoPtr<MethodDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), true as bool);
  Printer_emitTokenNode(receiver, node!.AsteriskToken);
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  Printer_emitTokenNode(receiver, node!.PostfixToken);
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitSignature(receiver, NodeDefault_AsNode(node));
  Printer_emitFunctionBodyNode(receiver, node!.Body);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConstructor","kind":"method","status":"implemented","sigHash":"5aeaedded2234b144ef13f929ad2bc08b9417fd8f9a1da9dcc964a73e5cfce10","bodyHash":"be244a665242ee034f4959167e538900c4a94e79d8e58d2957552b145f15b3bf"}
 *
 * Go source:
 * func (p *Printer) emitConstructor(node *ast.ConstructorDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("constructor")
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitSignature(node.AsNode())
 * 	p.emitFunctionBodyNode(node.Body)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitConstructor(receiver: GoPtr<Printer>, node: GoPtr<ConstructorDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false as bool);
  Printer_writeKeyword(receiver, "constructor");
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitSignature(receiver, NodeDefault_AsNode(node));
  Printer_emitFunctionBodyNode(receiver, node!.Body);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitAccessorDeclaration","kind":"method","status":"implemented","sigHash":"cd0aa1301fb3c70f4d78a1474a088a964307289a1abfdafa5dfaaf5c4d29b325","bodyHash":"bf0c7d90a86390490790c1b3fcd6736f310649fe3d6d082fd8a94714514e9b60"}
 *
 * Go source:
 * func (p *Printer) emitAccessorDeclaration(token ast.Kind, node *ast.AccessorDeclarationBase) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitToken(token, pos, WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitPropertyName(node.Name())
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitSignature(node.AsNode())
 * 	p.emitFunctionBodyNode(node.Body)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitAccessorDeclaration(receiver: GoPtr<Printer>, token: Kind, node: GoPtr<AccessorDeclarationBase>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  const pos = Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), true as bool);
  Printer_emitToken(receiver, token, pos, WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitSignature(receiver, NodeDefault_AsNode(node));
  Printer_emitFunctionBodyNode(receiver, node!.Body);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"682f66277d857b5cc36c98d20314f20868032c3b061a0454e0a54098fd77e47d","bodyHash":"c33aad5619ec7ab3165f08b0e31b5612c93301927a86dbb253ae1e1f3f614be7"}
 *
 * Go source:
 * func (p *Printer) emitGetAccessorDeclaration(node *ast.GetAccessorDeclaration) {
 * 	p.emitAccessorDeclaration(ast.KindGetKeyword, &node.AccessorDeclarationBase)
 * }
 */
export function Printer_emitGetAccessorDeclaration(receiver: GoPtr<Printer>, node: GoPtr<GetAccessorDeclaration>): void {
  Printer_emitAccessorDeclaration(receiver, KindGetKeyword, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"451d3d18e3bd15293f544912df5f26d356d6743752758b5a730689b4fe2743bb","bodyHash":"8410cada78057883da2d4f4897926c5c1b52cef70f7f1299e4375b03b8eb2207"}
 *
 * Go source:
 * func (p *Printer) emitSetAccessorDeclaration(node *ast.SetAccessorDeclaration) {
 * 	p.emitAccessorDeclaration(ast.KindSetKeyword, &node.AccessorDeclarationBase)
 * }
 */
export function Printer_emitSetAccessorDeclaration(receiver: GoPtr<Printer>, node: GoPtr<SetAccessorDeclaration>): void {
  Printer_emitAccessorDeclaration(receiver, KindSetKeyword, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConstructSignature","kind":"method","status":"implemented","sigHash":"f8ef2911fd7b7afd963770f4a88a1a06e205db2bb3927fca007882ad2ae6d254","bodyHash":"a89fbbc6c0e9b1866370c3a700b82396350884dd792473a060151840eb365262"}
 *
 * Go source:
 * func (p *Printer) emitConstructSignature(node *ast.ConstructSignatureDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("new")
 * 	p.writeSpace()
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitSignature(node.AsNode())
 * 	p.writeTrailingSemicolon()
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitConstructSignature(receiver: GoPtr<Printer>, node: GoPtr<ConstructSignatureDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writeKeyword(receiver, "new");
  Printer_writeSpace(receiver);
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitSignature(receiver, NodeDefault_AsNode(node));
  Printer_writeTrailingSemicolon(receiver);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIndexSignature","kind":"method","status":"implemented","sigHash":"a53097f8cafe5ca44e36f0dc1a52abc3b9a8b980f1a7dad33c9f284ae5d50681","bodyHash":"a02e5c703403e0dc6bc5c5e805f01fbc7e1f1680f7d2dc48e55011528eaf1594"}
 *
 * Go source:
 * func (p *Printer) emitIndexSignature(node *ast.IndexSignatureDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitParametersForIndexSignature(node.AsNode(), node.Parameters)
 * 	p.emitTypeAnnotation(node.Type)
 * 	p.writeTrailingSemicolon()
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIndexSignature(receiver: GoPtr<Printer>, node: GoPtr<IndexSignatureDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false as bool);
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitParametersForIndexSignature(receiver, NodeDefault_AsNode(node), node!.Parameters);
  Printer_emitTypeAnnotation(receiver, node!.Type);
  Printer_writeTrailingSemicolon(receiver);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBindingElement","kind":"method","status":"implemented","sigHash":"450a0bd3494df4559016183905de663aa28432e16b98f8c89793814325a0b04a","bodyHash":"7be32142c92b4a63d5995e6d47ce0962fd38ff65fcfcd0428985c7ac82be5a9c"}
 *
 * Go source:
 * func (p *Printer) emitBindingElement(node *ast.BindingElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTokenNode(node.DotDotDotToken)
 * 	if node.PropertyName != nil {
 * 		p.emitPropertyName(node.PropertyName)
 * 		p.writePunctuation(":")
 * 		p.writeSpace()
 * 	}
 * 	// Old parser used `OmittedExpression` as a substitute for `Elision`. New parser uses a `BindingElement` with nil members
 * 	if name := node.Name(); name != nil {
 * 		p.emitBindingName(name)
 * 		p.emitInitializer(node.Initializer, node.Name().End(), node.AsNode())
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitBindingElement(receiver: GoPtr<Printer>, node: GoPtr<BindingElement>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitTokenNode(receiver, node!.DotDotDotToken);
  if (node!.PropertyName !== undefined) {
    Printer_emitPropertyName(receiver, node!.PropertyName);
    Printer_writePunctuation(receiver, ":");
    Printer_writeSpace(receiver);
  }
  // Old parser used `OmittedExpression` as a substitute for `Elision`. New parser uses a `BindingElement` with nil members
  const name = Node_Name(NodeDefault_AsNode(node));
  if (name !== undefined) {
    Printer_emitBindingName(receiver, name as unknown as GoPtr<BindingName>);
    Printer_emitInitializer(receiver, node!.Initializer, Node_End(name as unknown as GoPtr<Node>), NodeDefault_AsNode(node));
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBindingElementNode","kind":"method","status":"implemented","sigHash":"f2f278b512e0bc19729592a42b71d93122e130696123ed785b5944dbfaa9d653","bodyHash":"5a3180083d23fae48efc04589906dba6b98ab5bf5aaa7bcb1e3b98daa647c681"}
 *
 * Go source:
 * func (p *Printer) emitBindingElementNode(node *ast.BindingElementNode) {
 * 	p.emitBindingElement(node.AsBindingElement())
 * }
 */
export function Printer_emitBindingElementNode(receiver: GoPtr<Printer>, node: GoPtr<BindingElementNode>): void {
  Printer_emitBindingElement(receiver, AsBindingElement(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArgument","kind":"method","status":"implemented","sigHash":"f6d315a193ed92ba1d318747e2836c0f4215f1a6ec329503dfe61be38361aa3e","bodyHash":"62abd1d52fe9e84dea4ca44d3ee3a9503fa62c2c27d56ffa9183b3c0a2d628c2"}
 *
 * Go source:
 * func (p *Printer) emitArgument(node *ast.Expression) {
 * 	p.emitExpression(node, ast.OperatorPrecedenceSpread)
 * }
 */
export function Printer_emitArgument(receiver: GoPtr<Printer>, node: GoPtr<Expression>): void {
  Printer_emitExpression(receiver, node, OperatorPrecedenceSpread);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConciseBody","kind":"method","status":"implemented","sigHash":"88b0a3de6b7b8b8a6d2949746fb3ea5cfa04e4924baf40adaef43d58131e8b21","bodyHash":"d1cb4b06bcf7f5e457c22292d5af277c27eb5f0283c90fb01c7ea7807b45c0f2"}
 *
 * Go source:
 * func (p *Printer) emitConciseBody(node *ast.BlockOrExpression) {
 * 	switch {
 * 	case ast.IsBlock(node):
 * 		p.emitFunctionBody(node.AsBlock())
 * 	case ast.IsObjectLiteralExpression(ast.GetLeftmostExpression(node, false /*stopAtCallExpressions* /)):
 * 		// Wrap in ParenthesizedExpression to ensure parens are emitted after any leading
 * 		// PartiallyEmittedExpression comments, matching TypeScript's factory-time wrapping
 * 		// via parenthesizeConciseBodyOfArrowFunction.
 * 		paren := p.emitContext.Factory.NewParenthesizedExpression(node)
 * 		paren.Loc = node.Loc
 * 		p.emitExpression(paren, ast.OperatorPrecedenceLowest)
 * 	case ast.IsExpression(node):
 * 		p.emitExpression(node, ast.OperatorPrecedenceYield)
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ConciseBody: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitConciseBody(receiver: GoPtr<Printer>, node: GoPtr<BlockOrExpression>): void {
  if (IsBlock(node)) {
    Printer_emitFunctionBody(receiver, AsBlock(node));
  } else if (IsObjectLiteralExpression(GetLeftmostExpression(node as unknown as GoPtr<Expression>, false as bool))) {
    // Wrap in ParenthesizedExpression to ensure parens are emitted after any leading
    // PartiallyEmittedExpression comments, matching TypeScript's factory-time wrapping
    // via parenthesizeConciseBodyOfArrowFunction.
    const paren = NewParenthesizedExpression(receiver!.emitContext!.Factory!.__tsgoEmbedded0, node as unknown as GoPtr<Expression>);
    paren!.Loc = (node as unknown as GoPtr<Node>)!.Loc;
    Printer_emitExpression(receiver, paren as unknown as GoPtr<Expression>, OperatorPrecedenceLowest);
  } else if (IsExpression(node)) {
    Printer_emitExpression(receiver, node as unknown as GoPtr<Expression>, OperatorPrecedenceYield);
  } else {
    throw new globalThis.Error(`unexpected ConciseBody: ${(node as unknown as GoPtr<Node>)!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMetaProperty","kind":"method","status":"implemented","sigHash":"c904949834c880d03961cb382f906cffac36c2d9965a63d59077b9668ee3b9b4","bodyHash":"03c9cb3f9128513d66d641c41552672cd43520f9bca288dfb6de13ee90a2d8cb"}
 *
 * Go source:
 * func (p *Printer) emitMetaProperty(node *ast.MetaProperty) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(node.KeywordToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	p.writePunctuation(".")
 * 	p.emitIdentifierName(node.Name().AsIdentifier())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitMetaProperty(receiver: GoPtr<Printer>, node: GoPtr<MetaProperty>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitToken(receiver, node!.KeywordToken, Node_Pos(NodeDefault_AsNode(node)), WriteKindPunctuation, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, ".");
  Printer_emitIdentifierName(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxElement","kind":"method","status":"implemented","sigHash":"529eb4e67a6646f7496e8fdf96c3d73ef515510b1848c96e81e08339618a31bb","bodyHash":"aaa701ccec6eb205e1a3ffcb27baf10514369a0a1d68d8259f0baf659f24ff4a"}
 *
 * Go source:
 * func (p *Printer) emitJsxElement(node *ast.JsxElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitJsxOpeningElement(node.OpeningElement.AsJsxOpeningElement())
 * 	p.emitList((*Printer).emitJsxChild, node.AsNode(), node.Children, LFJsxElementOrFragmentChildren)
 * 	p.emitJsxClosingElement(node.ClosingElement.AsJsxClosingElement())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxElement(receiver: GoPtr<Printer>, node: GoPtr<JsxElement>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitJsxOpeningElement(receiver, AsJsxOpeningElement(node!.OpeningElement));
  Printer_emitList(receiver, Printer_emitJsxChild, NodeDefault_AsNode(node), node!.Children as unknown as GoPtr<NodeList>, LFJsxElementOrFragmentChildren);
  Printer_emitJsxClosingElement(receiver, AsJsxClosingElement(node!.ClosingElement));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxSelfClosingElement","kind":"method","status":"implemented","sigHash":"442cb0ff8ea92daeeb33c9f5107535b4eb0489f2ddad928ed8c1ac5e6cfca36d","bodyHash":"13359eec807d93857e6ec3764a8a73683ae548f28e1816b671014f4ff998a5e0"}
 *
 * Go source:
 * func (p *Printer) emitJsxSelfClosingElement(node *ast.JsxSelfClosingElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("<")
 * 	p.emitJsxTagName(node.TagName)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.writeSpace()
 * 	p.emitJsxAttributes(node.Attributes.AsJsxAttributes())
 * 	p.writePunctuation("/>")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxSelfClosingElement(receiver: GoPtr<Printer>, node: GoPtr<JsxSelfClosingElement>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "<");
  Printer_emitJsxTagName(receiver, node!.TagName);
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments as unknown as GoPtr<NodeList>);
  Printer_writeSpace(receiver);
  Printer_emitJsxAttributes(receiver, AsJsxAttributes(node!.Attributes));
  Printer_writePunctuation(receiver, "/>");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxFragment","kind":"method","status":"implemented","sigHash":"e514a56d1a661acf6f12238d36e94be073754bc66e614a740b1e0339af225eb6","bodyHash":"945951a9cc8a643a9044662b1abe81b111506014d45746000065572973db7a7b"}
 *
 * Go source:
 * func (p *Printer) emitJsxFragment(node *ast.JsxFragment) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitJsxOpeningFragment(node.OpeningFragment.AsJsxOpeningFragment())
 * 	p.emitList((*Printer).emitJsxChild, node.AsNode(), node.Children, LFJsxElementOrFragmentChildren)
 * 	p.emitJsxClosingFragment(node.ClosingFragment.AsJsxClosingFragment())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxFragment(receiver: GoPtr<Printer>, node: GoPtr<JsxFragment>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitJsxOpeningFragment(receiver, AsJsxOpeningFragment(node!.OpeningFragment));
  Printer_emitList(receiver, Printer_emitJsxChild, NodeDefault_AsNode(node), node!.Children as unknown as GoPtr<NodeList>, LFJsxElementOrFragmentChildren);
  Printer_emitJsxClosingFragment(receiver, AsJsxClosingFragment(node!.ClosingFragment));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxOpeningElement","kind":"method","status":"implemented","sigHash":"f76b325d1bdb7c16cd5bb8e4330f33a6aaecda5a74667b97d9c9afbb30a7d9a3","bodyHash":"e8c3162f4efe0c6a4b0de44181566a3c3f058982d56bcdaa35a1f797e68c7ae0"}
 *
 * Go source:
 * func (p *Printer) emitJsxOpeningElement(node *ast.JsxOpeningElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("<")
 * 	indented := p.writeLineSeparatorsAndIndentBefore(node.TagName, node.AsNode())
 * 	p.emitJsxTagName(node.TagName)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	if len(node.Attributes.Properties()) > 0 {
 * 		p.writeSpace()
 * 	}
 * 	p.emitJsxAttributes(node.Attributes.AsJsxAttributes())
 * 	p.writeLineSeparatorsAfter(node.Attributes, node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.writePunctuation(">")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxOpeningElement(receiver: GoPtr<Printer>, node: GoPtr<JsxOpeningElement>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "<");
  const indented = Printer_writeLineSeparatorsAndIndentBefore(receiver, node!.TagName, NodeDefault_AsNode(node));
  Printer_emitJsxTagName(receiver, node!.TagName);
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments as unknown as GoPtr<NodeList>);
  const jsxAttrs = AsJsxAttributes(node!.Attributes);
  if (jsxAttrs !== undefined && jsxAttrs!.Properties !== undefined && jsxAttrs!.Properties!.Nodes.length > 0) {
    Printer_writeSpace(receiver);
  }
  Printer_emitJsxAttributes(receiver, jsxAttrs);
  Printer_writeLineSeparatorsAfter(receiver, node!.Attributes, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_writePunctuation(receiver, ">");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxClosingElement","kind":"method","status":"implemented","sigHash":"c55361f3b25d42a92e17593bcc7dd20f95e812732f88c048377192e9bb3f5400","bodyHash":"22846852c88170ef26a00c742d3cda08a57215f285b3982b7171914993c4a73b"}
 *
 * Go source:
 * func (p *Printer) emitJsxClosingElement(node *ast.JsxClosingElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("</")
 * 	p.emitJsxTagName(node.TagName)
 * 	p.writePunctuation(">")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxClosingElement(receiver: GoPtr<Printer>, node: GoPtr<JsxClosingElement>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "</");
  Printer_emitJsxTagName(receiver, node!.TagName);
  Printer_writePunctuation(receiver, ">");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxOpeningFragment","kind":"method","status":"implemented","sigHash":"9ceafd92be09b6847b33841a443d6db9ea328e7627d5f815095d62d1aa381a90","bodyHash":"217a216c58d2f9cfc7f883567e854f8df499a520d7f57c298e4d8396d5dbf334"}
 *
 * Go source:
 * func (p *Printer) emitJsxOpeningFragment(node *ast.JsxOpeningFragment) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("<")
 * 	p.writePunctuation(">")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxOpeningFragment(receiver: GoPtr<Printer>, node: GoPtr<JsxOpeningFragment>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "<");
  Printer_writePunctuation(receiver, ">");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxClosingFragment","kind":"method","status":"implemented","sigHash":"0f5aa57e28bf03ed5f63d73bcd13b330b3c5a50f4a5ea699a7609ec34df681c8","bodyHash":"4ff7cb4f7f48ef07bdf98ecfdd97d600d3ce081cb63dad0cabee923ed121c542"}
 *
 * Go source:
 * func (p *Printer) emitJsxClosingFragment(node *ast.JsxClosingFragment) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("</")
 * 	p.writePunctuation(">")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxClosingFragment(receiver: GoPtr<Printer>, node: GoPtr<JsxClosingFragment>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "</");
  Printer_writePunctuation(receiver, ">");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxText","kind":"method","status":"implemented","sigHash":"32a51baa3c2567be08227bfcd2f3d448a986cf110c606db64c607982ca946952","bodyHash":"7a17f6a68f502dc456fe92e14fa06435da75f0a8ab0f41f6b0b05aa337dfd3af"}
 *
 * Go source:
 * func (p *Printer) emitJsxText(node *ast.JsxText) {
 * 	state := p.enterNode(node.AsNode())
 * 	// TODO(rbuckton): Should this be using `getLiteralTextOfNode` instead?
 * 	p.writeLiteral(node.Text)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxText(receiver: GoPtr<Printer>, node: GoPtr<JsxText>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  // TODO: Should this be using getLiteralTextOfNode instead?
  Printer_writeLiteral(receiver, node!.Text);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxAttributes","kind":"method","status":"implemented","sigHash":"fb0df2e11ff229c7b209f1bf3e9fedee2e6201f5af73708b4b5d94022d49d56e","bodyHash":"a817a154323fc502953b3c075f19286a28d541abfcf4bc8915336ce75a3a115d"}
 *
 * Go source:
 * func (p *Printer) emitJsxAttributes(node *ast.JsxAttributes) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitList((*Printer).emitJsxAttributeLike, node.AsNode(), node.Properties, LFJsxElementAttributes)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxAttributes(receiver: GoPtr<Printer>, node: GoPtr<JsxAttributes>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitList(receiver, Printer_emitJsxAttributeLike, NodeDefault_AsNode(node), node!.Properties as unknown as GoPtr<NodeList>, LFJsxElementAttributes);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxAttribute","kind":"method","status":"implemented","sigHash":"d6936a8d4a9aacaa797b0c6adb88660ecb1b49c2b9b7d159697a27d11f70d197","bodyHash":"ab90874be2e1b79be450b0bd2ad1cbd8e0e5580ae7af576c78b0435be3960dd2"}
 *
 * Go source:
 * func (p *Printer) emitJsxAttribute(node *ast.JsxAttribute) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitJsxAttributeName(node.Name())
 * 	if node.Initializer != nil {
 * 		p.writePunctuation("=")
 * 		p.emitJsxAttributeValue(node.Initializer)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxAttribute(receiver: GoPtr<Printer>, node: GoPtr<JsxAttribute>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitJsxAttributeName(receiver, Node_Name(NodeDefault_AsNode(node)) as unknown as GoPtr<JsxAttributeName>);
  if (node!.Initializer !== undefined) {
    Printer_writePunctuation(receiver, "=");
    Printer_emitJsxAttributeValue(receiver, node!.Initializer);
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxAttributeLike","kind":"method","status":"implemented","sigHash":"0c6ebdee4ffa6653d42efd4eadde3a23b8e38548af62300dba4b4efadaa4703b","bodyHash":"a353a0d02905dcf6da012fd7aac10c6ebabd9f5936a53e402da50412dff1e1ba"}
 *
 * Go source:
 * func (p *Printer) emitJsxAttributeLike(node *ast.JsxAttributeLike) {
 * 	switch node.Kind {
 * 	case ast.KindJsxAttribute:
 * 		p.emitJsxAttribute(node.AsJsxAttribute())
 * 	case ast.KindJsxSpreadAttribute:
 * 		p.emitJsxSpreadAttribute(node.AsJsxSpreadAttribute())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled JsxAttributeLike: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitJsxAttributeLike(receiver: GoPtr<Printer>, node: GoPtr<JsxAttributeLike>): void {
  switch (node!.Kind) {
    case KindJsxAttribute:
      Printer_emitJsxAttribute(receiver, AsJsxAttribute(node));
      break;
    case KindJsxSpreadAttribute:
      Printer_emitJsxSpreadAttribute(receiver, AsJsxSpreadAttribute(node));
      break;
    default:
      throw new globalThis.Error(`unhandled JsxAttributeLike: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxChild","kind":"method","status":"implemented","sigHash":"140fa2fcc9fe7af962783e87a2e6e0d95993bf3b8ba01513c453aeacf0745a29","bodyHash":"ecf63c85f0babcc09fba55df5cd916ab9089681801c9bd11472b726aefc70a9f"}
 *
 * Go source:
 * func (p *Printer) emitJsxChild(node *ast.JsxChild) {
 * 	switch node.Kind {
 * 	case ast.KindJsxText:
 * 		p.emitJsxText(node.AsJsxText())
 * 	case ast.KindJsxExpression:
 * 		p.emitJsxExpression(node.AsJsxExpression())
 * 	case ast.KindJsxElement:
 * 		p.emitJsxElement(node.AsJsxElement())
 * 	case ast.KindJsxSelfClosingElement:
 * 		p.emitJsxSelfClosingElement(node.AsJsxSelfClosingElement())
 * 	case ast.KindJsxFragment:
 * 		p.emitJsxFragment(node.AsJsxFragment())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled JsxChild: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitJsxChild(receiver: GoPtr<Printer>, node: GoPtr<JsxChild>): void {
  switch (node!.Kind) {
    case KindJsxText:
      Printer_emitJsxText(receiver, AsJsxText(node));
      break;
    case KindJsxExpression:
      Printer_emitJsxExpression(receiver, AsJsxExpression(node));
      break;
    case KindJsxElement:
      Printer_emitJsxElement(receiver, AsJsxElement(node));
      break;
    case KindJsxSelfClosingElement:
      Printer_emitJsxSelfClosingElement(receiver, AsJsxSelfClosingElement(node));
      break;
    case KindJsxFragment:
      Printer_emitJsxFragment(receiver, AsJsxFragment(node));
      break;
    default:
      throw new globalThis.Error(`unhandled JsxChild: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxTagName","kind":"method","status":"implemented","sigHash":"6e8e86f805ed2afcd32fa2c2903ffe19a8f69bd139cbac154a20315ea5bf25f5","bodyHash":"08b1f33c6ef7ba06b5f5c081c797ca5a0bb99160d4f0dc010907799869c69418"}
 *
 * Go source:
 * func (p *Printer) emitJsxTagName(node *ast.JsxTagNameExpression) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierReference(node.AsIdentifier())
 * 	case ast.KindThisKeyword:
 * 		p.emitKeywordExpression(node.AsKeywordExpression())
 * 	case ast.KindJsxNamespacedName:
 * 		p.emitJsxNamespacedName(node.AsJsxNamespacedName())
 * 	case ast.KindPropertyAccessExpression:
 * 		p.emitPropertyAccessExpression(node.AsPropertyAccessExpression())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled JsxTagName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitJsxTagName(receiver: GoPtr<Printer>, node: GoPtr<JsxTagNameExpression>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierReference(receiver, AsIdentifier(node));
      break;
    case KindThisKeyword:
      Printer_emitKeywordExpression(receiver, AsKeywordExpression(node));
      break;
    case KindJsxNamespacedName:
      Printer_emitJsxNamespacedName(receiver, AsJsxNamespacedName(node));
      break;
    case KindPropertyAccessExpression:
      Printer_emitPropertyAccessExpression(receiver, AsPropertyAccessExpression(node));
      break;
    default:
      throw new globalThis.Error(`unhandled JsxTagName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxAttributeName","kind":"method","status":"implemented","sigHash":"a53e2de4360c13200e5111b6adef8349ca5afb909e206a887e61a54eaf64bff8","bodyHash":"43c430b4fe7dd8cba8b55b2cdb86890863deb6675c061e1232c5449f364dd79c"}
 *
 * Go source:
 * func (p *Printer) emitJsxAttributeName(node *ast.JsxAttributeName) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindJsxNamespacedName:
 * 		p.emitJsxNamespacedName(node.AsJsxNamespacedName())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled JsxAttributeName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitJsxAttributeName(receiver: GoPtr<Printer>, node: GoPtr<JsxAttributeName>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    case KindJsxNamespacedName:
      Printer_emitJsxNamespacedName(receiver, AsJsxNamespacedName(node));
      break;
    default:
      throw new globalThis.Error(`unhandled JsxAttributeName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxAttributeValue","kind":"method","status":"implemented","sigHash":"7ef38ffb411588fdac02314057f8ad0c90b83c73388f3816ef4cf6c4bada7184","bodyHash":"e473722e174f058a446e4dc76c6e177d393c72ebecee1dbd06d64ea2f47f9ee0"}
 *
 * Go source:
 * func (p *Printer) emitJsxAttributeValue(node *ast.JsxAttributeValue) {
 * 	switch node.Kind {
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	case ast.KindJsxExpression:
 * 		p.emitJsxExpression(node.AsJsxExpression())
 * 	case ast.KindJsxElement:
 * 		p.emitJsxElement(node.AsJsxElement())
 * 	case ast.KindJsxSelfClosingElement:
 * 		p.emitJsxSelfClosingElement(node.AsJsxSelfClosingElement())
 * 	case ast.KindJsxFragment:
 * 		p.emitJsxFragment(node.AsJsxFragment())
 * 	default:
 * 		p.emitExpression(node, ast.OperatorPrecedenceLowest)
 * 	}
 * }
 */
export function Printer_emitJsxAttributeValue(receiver: GoPtr<Printer>, node: GoPtr<JsxAttributeValue>): void {
  switch (node!.Kind) {
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    case KindJsxExpression:
      Printer_emitJsxExpression(receiver, AsJsxExpression(node));
      break;
    case KindJsxElement:
      Printer_emitJsxElement(receiver, AsJsxElement(node));
      break;
    case KindJsxSelfClosingElement:
      Printer_emitJsxSelfClosingElement(receiver, AsJsxSelfClosingElement(node));
      break;
    case KindJsxFragment:
      Printer_emitJsxFragment(receiver, AsJsxFragment(node));
      break;
    default:
      Printer_emitExpression(receiver, node as unknown as GoPtr<Expression>, OperatorPrecedenceLowest);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCaseClause","kind":"method","status":"implemented","sigHash":"2bfba9e7f245a96851cdfae18c04489c508b409a055550de7877950060193037","bodyHash":"473d3fd2d9ab0877047a7282928b3f0fa6bb1b74a6825c05d6137722709ca88f"}
 *
 * Go source:
 * func (p *Printer) emitCaseClause(node *ast.CaseOrDefaultClause) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindCaseKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitCaseOrDefaultClauseStatements(node, node.Expression.End())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitCaseClause(receiver: GoPtr<Printer>, node: GoPtr<CaseOrDefaultClause>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitToken(receiver, KindCaseKeyword, Node_Pos(NodeDefault_AsNode(node)), WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitCaseOrDefaultClauseStatements(receiver, node, Node_End(node!.Expression));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDefaultClause","kind":"method","status":"implemented","sigHash":"17f6e0f889dfc3713a1c5d195baeb76449aca2b0ef46438a028304a6f4ca38bb","bodyHash":"b341f311bf703779b533a92b32cc2f6b1a39e51a735a9328ff0a033848cfbb27"}
 *
 * Go source:
 * func (p *Printer) emitDefaultClause(node *ast.CaseOrDefaultClause) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindDefaultKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.emitCaseOrDefaultClauseStatements(node, pos)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitDefaultClause(receiver: GoPtr<Printer>, node: GoPtr<CaseOrDefaultClause>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  const pos = Printer_emitToken(receiver, KindDefaultKeyword, Node_Pos(NodeDefault_AsNode(node)), WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_emitCaseOrDefaultClauseStatements(receiver, node, pos);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCaseOrDefaultClauseNode","kind":"method","status":"implemented","sigHash":"62bdb48f8ec0b6cb516f45f1be48ccba24e1febb0492a42b55afbf1e96adab12","bodyHash":"7e6d3d7b0f461ab86d8da3baa48df19a7476fd9cb4b7fcf9ba229f829c0336d2"}
 *
 * Go source:
 * func (p *Printer) emitCaseOrDefaultClauseNode(node *ast.CaseOrDefaultClauseNode) {
 * 	switch node.Kind {
 * 	case ast.KindCaseClause:
 * 		p.emitCaseClause(node.AsCaseOrDefaultClause())
 * 	case ast.KindDefaultClause:
 * 		p.emitDefaultClause(node.AsCaseOrDefaultClause())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled CaseOrDefaultClause: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitCaseOrDefaultClauseNode(receiver: GoPtr<Printer>, node: GoPtr<CaseOrDefaultClauseNode>): void {
  switch (node!.Kind) {
    case KindCaseClause:
      Printer_emitCaseClause(receiver, AsCaseOrDefaultClause(node));
      break;
    case KindDefaultClause:
      Printer_emitDefaultClause(receiver, AsCaseOrDefaultClause(node));
      break;
    default:
      throw new globalThis.Error(`unhandled CaseOrDefaultClause: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPropertyAssignment","kind":"method","status":"implemented","sigHash":"7d46587abb556a2218ca94120858c068018b6d89bbfda74f49fc2e602c119bb7","bodyHash":"684c15595bfb4fef047f079387d55363e50bc3aa1b0ab968e006c964aa8e5165"}
 *
 * Go source:
 * func (p *Printer) emitPropertyAssignment(node *ast.PropertyAssignment) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPropertyName(node.Name())
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	// This is to ensure that we emit comment in the following case:
 * 	//      For example:
 * 	//          obj = {
 * 	//              id: /*comment1* / ()=>void
 * 	//          }
 * 	// "comment1" is not considered to be leading comment for node.initializer
 * 	// but rather a trailing comment on the previous node.
 * 	initializer := node.Initializer
 * 	if p.emitContext.EmitFlags(initializer)&EFNoLeadingComments == 0 {
 * 		commentRange := p.emitContext.CommentRange(initializer)
 * 		p.emitTrailingComments(commentRange.Pos(), commentSeparatorAfter)
 * 	}
 * 	p.emitExpression(initializer, ast.OperatorPrecedenceDisallowComma)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitPropertyAssignment(receiver: GoPtr<Printer>, node: GoPtr<PropertyAssignment>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  const initializer = node!.Initializer;
  if ((EmitContext_EmitFlags(receiver!.emitContext, initializer) & EFNoLeadingComments) === 0) {
    const commentRange = EmitContext_CommentRange(receiver!.emitContext, initializer);
    Printer_emitTrailingComments(receiver, TextRange_Pos(commentRange), commentSeparatorAfter);
  }
  Printer_emitExpression(receiver, initializer, OperatorPrecedenceDisallowComma);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"6046060351012d89e671538b5197fe8b52024da75b647356d1fa14f3d45c1453","bodyHash":"970f2327994296acd132ff02563c54fea6d48b542aa8ceafdf42e644c11116d4"}
 *
 * Go source:
 * func (p *Printer) emitShorthandPropertyAssignment(node *ast.ShorthandPropertyAssignment) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPropertyName(node.Name())
 * 	if node.ObjectAssignmentInitializer != nil {
 * 		p.writeSpace()
 * 		p.writePunctuation("=")
 * 		p.writeSpace()
 * 		p.emitExpression(node.ObjectAssignmentInitializer, ast.OperatorPrecedenceDisallowComma)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitShorthandPropertyAssignment(receiver: GoPtr<Printer>, node: GoPtr<ShorthandPropertyAssignment>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitPropertyName(receiver, Node_Name(NodeDefault_AsNode(node)));
  if (node!.ObjectAssignmentInitializer !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writePunctuation(receiver, "=");
    Printer_writeSpace(receiver);
    Printer_emitExpression(receiver, node!.ObjectAssignmentInitializer, OperatorPrecedenceDisallowComma);
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitHelpers","kind":"method","status":"implemented","sigHash":"66d0bda2761068a67a878ff543467d3c6c1d5f4ed63d05233743442339fac954","bodyHash":"6167fddb57cbdb23e029e12e2ddc56197f93b710023a22a8a0816969831bff6c"}
 *
 * Go source:
 * func (p *Printer) emitHelpers(node *ast.Node) bool {
 * 	helpersEmitted := false
 * 	sourceFile := p.currentSourceFile
 * 	shouldSkip := p.Options.NoEmitHelpers || (sourceFile != nil && p.emitContext.HasRecordedExternalHelpers(sourceFile))
 * 	helpers := slices.Clone(p.emitContext.GetEmitHelpers(node))
 * 	if len(helpers) > 0 {
 * 		slices.SortStableFunc(helpers, compareEmitHelpers)
 * 		for _, helper := range helpers {
 * 			if !helper.Scoped {
 * 				// Skip the helper if it can be skipped and the noEmitHelpers compiler
 * 				// option is set, or if it can be imported and the importHelpers compiler
 * 				// option is set.
 * 				if shouldSkip {
 * 					continue
 * 				}
 * 			}
 * 			if helper.TextCallback != nil {
 * 				p.writeLines(helper.TextCallback(p.makeFileLevelOptimisticUniqueName))
 * 			} else {
 * 				p.writeLines(helper.Text)
 * 			}
 * 			helpersEmitted = true
 * 		}
 * 	}
 * 
 * 	return helpersEmitted
 * }
 */
export function Printer_emitHelpers(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  let helpersEmitted = false as bool;
  const sourceFile = receiver!.currentSourceFile;
  const shouldSkip = receiver!.Options.NoEmitHelpers || (sourceFile !== undefined && EmitContext_HasRecordedExternalHelpers(receiver!.emitContext, sourceFile));
  const helpers = slices.Clone(EmitContext_GetEmitHelpers(receiver!.emitContext, node)) ?? [];
  if (helpers.length > 0) {
    slices.SortStableFunc(helpers, compareEmitHelpers);
    for (const helper of helpers) {
      if (helper === undefined) { continue; }
      if (!helper.Scoped) {
        if (shouldSkip) {
          continue;
        }
      }
      if (helper.TextCallback !== undefined) {
        Printer_writeLines(receiver, helper.TextCallback(receiver!.makeFileLevelOptimisticUniqueName));
      } else {
        Printer_writeLines(receiver, helper.Text);
      }
      helpersEmitted = true as bool;
    }
  }
  return helpersEmitted;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitList","kind":"method","status":"implemented","sigHash":"c318ff96bbbfa424b5d38f273de1f853ac1cf9c678b454b215ef18ecee4b89af","bodyHash":"884d44a53cde9b577a037902efab2f9b248e210bfc53ceaeb3b1ffa9e1725705"}
 *
 * Go source:
 * func (p *Printer) emitList(emit func(p *Printer, node *ast.Node), parentNode *ast.Node, children *ast.NodeList, format ListFormat) {
 * 	if p.shouldEmitOnMultipleLines(parentNode) {
 * 		format |= LFPreferNewLine | LFIndented
 * 	}
 * 
 * 	p.emitListRange(emit, parentNode, children, format, -1 /*start* /, -1 /*count* /)
 * }
 */
export function Printer_emitList(receiver: GoPtr<Printer>, emit: (p: GoPtr<Printer>, node: GoPtr<Node>) => void, parentNode: GoPtr<Node>, children: GoPtr<NodeList>, format: ListFormat): void {
  if (Printer_shouldEmitOnMultipleLines(receiver, parentNode)) {
    format = (format | LFPreferNewLine | LFIndented) as ListFormat;
  }
  Printer_emitListRange(receiver, emit, parentNode, children, format, -1, -1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.hasTrailingComma","kind":"method","status":"implemented","sigHash":"fde3ba9bea515fc9197fd5eb3a4677e86ded0c72a057ba56215e41fa96824611","bodyHash":"02443c4778f18c8af7c228e58ad013b70ee51006ca5d58601877142ad0cf46a5"}
 *
 * Go source:
 * func (p *Printer) hasTrailingComma(parentNode *ast.Node, children *ast.NodeList) bool {
 * 	// NodeList.HasTrailingComma() is unreliable on transformed nodes as some nodes may have been removed. In the event
 * 	// we believe we may need to emit a trailing comma, we must first look to the respective node list on the original
 * 	// node first.
 * 	if !children.HasTrailingComma() {
 * 		return false
 * 	}
 * 
 * 	originalParent := p.emitContext.MostOriginal(parentNode)
 * 	if originalParent == parentNode {
 * 		// if this node is the original node, we can trust the result
 * 		return true
 * 	}
 * 
 * 	if originalParent.Kind != parentNode.Kind {
 * 		// if the original node is some other kind of node, we cannot correlate the list
 * 		return false
 * 	}
 * 
 * 	// find the respective node list on the original parent
 * 	originalList := children
 * 	switch originalParent.Kind {
 * 	case ast.KindObjectLiteralExpression:
 * 		originalList = originalParent.PropertyList()
 * 	case ast.KindArrayLiteralExpression:
 * 		originalList = originalParent.ElementList()
 * 	case ast.KindCallExpression, ast.KindNewExpression:
 * 		switch children {
 * 		case parentNode.TypeArgumentList():
 * 			originalList = originalParent.TypeArgumentList()
 * 		case parentNode.ArgumentList():
 * 			originalList = originalParent.ArgumentList()
 * 		}
 * 	case ast.KindConstructor,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression,
 * 		ast.KindArrowFunction,
 * 		ast.KindFunctionType,
 * 		ast.KindConstructorType,
 * 		ast.KindCallSignature,
 * 		ast.KindConstructSignature:
 * 		switch children {
 * 		case parentNode.TypeParameterList():
 * 			originalList = originalParent.TypeParameterList()
 * 		case parentNode.ParameterList():
 * 			originalList = originalParent.ParameterList()
 * 		}
 * 	case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindInterfaceDeclaration, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		switch children {
 * 		case parentNode.TypeParameterList():
 * 			originalList = originalParent.TypeParameterList()
 * 		}
 * 	case ast.KindObjectBindingPattern, ast.KindArrayBindingPattern:
 * 		switch children {
 * 		case parentNode.ElementList():
 * 			originalList = originalParent.ElementList()
 * 		}
 * 	case ast.KindNamedImports, ast.KindNamedExports:
 * 		originalList = originalParent.ElementList()
 * 	case ast.KindImportAttributes:
 * 		originalList = originalParent.AsImportAttributes().Attributes
 * 	}
 * 
 * 	// if we have the original list, we can use it's result.
 * 	if originalList != nil {
 * 		return originalList.HasTrailingComma()
 * 	}
 * 
 * 	return false
 * }
 */
export function Printer_hasTrailingComma(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, children: GoPtr<NodeList>): bool {
  if (!NodeList_HasTrailingComma(children)) {
    return false as bool;
  }
  const originalParent = EmitContext_MostOriginal(receiver!.emitContext, parentNode);
  if (originalParent === parentNode) {
    return true as bool;
  }
  if (originalParent!.Kind !== parentNode!.Kind) {
    return false as bool;
  }
  let originalList = children;
  switch (originalParent!.Kind) {
    case KindObjectLiteralExpression:
      originalList = Node_PropertyList(originalParent);
      break;
    case KindArrayLiteralExpression:
      originalList = Node_ElementList(originalParent);
      break;
    case KindCallExpression:
    case KindNewExpression:
      if (children === Node_TypeArgumentList(parentNode)) {
        originalList = Node_TypeArgumentList(originalParent);
      } else if (children === Node_ArgumentList(parentNode)) {
        originalList = Node_ArgumentList(originalParent);
      }
      break;
    case KindConstructor:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindFunctionType:
    case KindConstructorType:
    case KindCallSignature:
    case KindConstructSignature:
      if (children === Node_TypeParameterList(parentNode)) {
        originalList = Node_TypeParameterList(originalParent);
      } else if (children === Node_ParameterList(parentNode)) {
        originalList = Node_ParameterList(originalParent);
      }
      break;
    case KindClassDeclaration:
    case KindClassExpression:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
      if (children === Node_TypeParameterList(parentNode)) {
        originalList = Node_TypeParameterList(originalParent);
      }
      break;
    case KindObjectBindingPattern:
    case KindArrayBindingPattern:
      if (children === Node_ElementList(parentNode)) {
        originalList = Node_ElementList(originalParent);
      }
      break;
    case KindNamedImports:
    case KindNamedExports:
      originalList = Node_ElementList(originalParent);
      break;
    case KindImportAttributes:
      originalList = AsImportAttributes(originalParent)!.Attributes as unknown as GoPtr<NodeList>;
      break;
  }
  if (originalList !== undefined) {
    return NodeList_HasTrailingComma(originalList);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeDelimiter","kind":"method","status":"implemented","sigHash":"8c628b93cf9cee7894aa2f1504a117c5234f54f9a4fdb349f13f5180d9bd8bbf","bodyHash":"2d16e5293a04f8d89acabf12a998130c4548a0f3767cdbe1e4389d249efabd6e"}
 *
 * Go source:
 * func (p *Printer) writeDelimiter(format ListFormat) {
 * 	switch format & LFDelimitersMask {
 * 	case LFNone:
 * 		break
 * 	case LFCommaDelimited:
 * 		p.writePunctuation(",")
 * 	case LFBarDelimited:
 * 		p.writeSpace()
 * 		p.writePunctuation("|")
 * 	case LFAsteriskDelimited:
 * 		p.writeSpace()
 * 		p.writePunctuation("*")
 * 		p.writeSpace()
 * 	case LFAmpersandDelimited:
 * 		p.writeSpace()
 * 		p.writePunctuation("&")
 * 	}
 * }
 */
export function Printer_writeDelimiter(receiver: GoPtr<Printer>, format: ListFormat): void {
  switch ((format & LFDelimitersMask) as ListFormat) {
    case LFNone:
      break;
    case LFCommaDelimited:
      Printer_writePunctuation(receiver, ",");
      break;
    case LFBarDelimited:
      Printer_writeSpace(receiver);
      Printer_writePunctuation(receiver, "|");
      break;
    case LFAsteriskDelimited:
      Printer_writeSpace(receiver);
      Printer_writePunctuation(receiver, "*");
      Printer_writeSpace(receiver);
      break;
    case LFAmpersandDelimited:
      Printer_writeSpace(receiver);
      Printer_writePunctuation(receiver, "&");
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitListItems","kind":"method","status":"implemented","sigHash":"fb5f38e3a182cb55c0ff097da7b81ba78a5c816bfd8bbfdae804854c4fad141c","bodyHash":"b407b8eb4c08e9e826fd08edd9eb86dabc9135db28929bf2bb0f5727af0e8271"}
 *
 * Go source:
 * func (p *Printer) emitListItems(
 * 	emit func(p *Printer, node *ast.Node),
 * 	parentNode *ast.Node,
 * 	children []*ast.Node,
 * 	format ListFormat,
 * 	hasTrailingComma bool,
 * 	childrenTextRange core.TextRange,
 * ) {
 * 	// Write the opening line terminator or leading whitespace.
 * 	mayEmitInterveningComments := format&LFNoInterveningComments == 0
 * 	shouldEmitInterveningComments := mayEmitInterveningComments
 * 
 * 	leadingLineTerminatorCount := 0
 * 	if len(children) > 0 {
 * 		leadingLineTerminatorCount = p.getLeadingLineTerminatorCount(parentNode, children[0], format)
 * 	}
 * 	if leadingLineTerminatorCount > 0 {
 * 		for range leadingLineTerminatorCount {
 * 			p.writeLine()
 * 		}
 * 		shouldEmitInterveningComments = false
 * 	} else if format&LFSpaceBetweenBraces != 0 {
 * 		p.writeSpace()
 * 	}
 * 
 * 	// Increase the indent, if requested.
 * 	if format&LFIndented != 0 {
 * 		p.increaseIndent()
 * 	}
 * 
 * 	parentEnd := greatestEnd(-1, parentNode)
 * 
 * 	// Emit each child.
 * 	var previousSibling *ast.Node
 * 	shouldDecreaseIndentAfterEmit := false
 * 	for _, child := range children {
 * 		// Write the delimiter if this is not the first node.
 * 		if format&LFAsteriskDelimited != 0 {
 * 			// always write JSDoc in the format "\n *"
 * 			p.writeLine()
 * 			p.writeDelimiter(format)
 * 		} else if previousSibling != nil {
 * 			// i.e
 * 			//      function commentedParameters(
 * 			//          /* Parameter a * /
 * 			//          a
 * 			//          /* End of parameter a * / -> this comment isn't considered to be trailing comment of parameter "a" due to newline
 * 			//          ,
 * 			if format&LFDelimitersMask != 0 && previousSibling.End() != parentEnd {
 * 				if !p.commentsDisabled && p.shouldEmitTrailingComments(previousSibling) {
 * 					p.emitLeadingComments(previousSibling.End(), false /*elided* /)
 * 				}
 * 			}
 * 
 * 			p.writeDelimiter(format)
 * 
 * 			// Write either a line terminator or whitespace to separate the elements.
 * 			separatingLineTerminatorCount := p.getSeparatingLineTerminatorCount(previousSibling, child, format)
 * 			if separatingLineTerminatorCount > 0 {
 * 				// If a synthesized node in a single-line list starts on a new
 * 				// line, we should increase the indent.
 * 				if format&(LFLinesMask|LFIndented) == LFSingleLine {
 * 					p.increaseIndent()
 * 					shouldDecreaseIndentAfterEmit = true
 * 				}
 * 
 * 				if shouldEmitInterveningComments && format&LFDelimitersMask != 0 && !ast.PositionIsSynthesized(child.Pos()) && p.shouldEmitLeadingComments(child) {
 * 					commentRange := p.emitContext.CommentRange(child)
 * 					p.emitTrailingCommentsOfPosition(commentRange.Pos(), format&LFSpaceBetweenSiblings != 0, true /*forceNoNewline* /)
 * 				}
 * 
 * 				for range separatingLineTerminatorCount {
 * 					p.writeLine()
 * 				}
 * 
 * 				shouldEmitInterveningComments = false
 * 			} else if format&LFSpaceBetweenSiblings != 0 {
 * 				p.writeSpace()
 * 			}
 * 		}
 * 
 * 		// Emit this child.
 * 		if shouldEmitInterveningComments && p.shouldEmitLeadingComments(child) {
 * 			commentRange := p.emitContext.CommentRange(child)
 * 			p.emitTrailingCommentsOfPosition(commentRange.Pos(), false /*prefixSpace* /, false /*forceNoNewline* /)
 * 		} else {
 * 			shouldEmitInterveningComments = mayEmitInterveningComments
 * 		}
 * 
 * 		p.nextListElementPos = child.Pos()
 * 		emit(p, child)
 * 
 * 		if shouldDecreaseIndentAfterEmit {
 * 			p.decreaseIndent()
 * 			shouldDecreaseIndentAfterEmit = false
 * 		}
 * 
 * 		previousSibling = child
 * 	}
 * 
 * 	// Write a trailing comma, if requested.
 * 	skipTrailingComments := p.commentsDisabled || !p.shouldEmitTrailingComments(previousSibling)
 * 	emitTrailingComma := hasTrailingComma && format&LFAllowTrailingComma != 0 && format&LFCommaDelimited != 0
 * 	if emitTrailingComma {
 * 		if previousSibling != nil && !skipTrailingComments {
 * 			p.emitToken(ast.KindCommaToken, previousSibling.End(), WriteKindPunctuation, previousSibling)
 * 		} else {
 * 			p.writePunctuation(",")
 * 		}
 * 	}
 * 
 * 	// Emit any trailing comment of the last element in the list
 * 	// i.e
 * 	//       var array = [...
 * 	//          2
 * 	//          /* end of element 2 * /
 * 	//       ];
 * 	if previousSibling != nil && parentEnd != previousSibling.End() && format&LFDelimitersMask != 0 && !skipTrailingComments {
 * 		var commentsPos int
 * 		if emitTrailingComma && childrenTextRange.End() > 0 {
 * 			commentsPos = childrenTextRange.End()
 * 		} else {
 * 			commentsPos = previousSibling.End()
 * 		}
 * 		p.emitLeadingComments(commentsPos, false /*elided* /)
 * 	}
 * 
 * 	// Decrease the indent, if requested.
 * 	if format&LFIndented != 0 {
 * 		p.decreaseIndent()
 * 	}
 * 
 * 	// Write the closing line terminator or closing whitespace.
 * 	closingLineTerminatorCount := p.getClosingLineTerminatorCount(parentNode, core.LastOrNil(children), format, childrenTextRange)
 * 	if closingLineTerminatorCount > 0 {
 * 		for range closingLineTerminatorCount {
 * 			p.writeLine()
 * 		}
 * 	} else if format&(LFSpaceAfterList|LFSpaceBetweenBraces) != 0 {
 * 		p.writeSpace()
 * 	}
 * }
 */
export function Printer_emitListItems(receiver: GoPtr<Printer>, emit: (p: GoPtr<Printer>, node: GoPtr<Node>) => void, parentNode: GoPtr<Node>, children: GoSlice<GoPtr<Node>>, format: ListFormat, hasTrailingComma: bool, childrenTextRange: TextRange): void {
  const mayEmitInterveningComments = ((format & LFNoInterveningComments) === 0) as unknown as bool;
  let shouldEmitInterveningComments = mayEmitInterveningComments;

  let leadingLineTerminatorCount = 0;
  if (children.length > 0) {
    leadingLineTerminatorCount = Printer_getLeadingLineTerminatorCount(receiver, parentNode, children[0], format);
  }
  if (leadingLineTerminatorCount > 0) {
    for (let i = 0; i < leadingLineTerminatorCount; i++) {
      Printer_writeLine(receiver);
    }
    shouldEmitInterveningComments = false as bool;
  } else if ((format & LFSpaceBetweenBraces) !== 0) {
    Printer_writeSpace(receiver);
  }

  if ((format & LFIndented) !== 0) {
    Printer_increaseIndent(receiver);
  }

  const parentEnd = greatestEnd(-1, parentNode as unknown as { End: () => int });

  let previousSibling: GoPtr<Node> = undefined;
  let shouldDecreaseIndentAfterEmit = false as bool;
  for (const child of children) {
    if ((format & LFAsteriskDelimited) !== 0) {
      Printer_writeLine(receiver);
      Printer_writeDelimiter(receiver, format);
    } else if (previousSibling !== undefined) {
      if ((format & LFDelimitersMask) !== 0 && Node_End(previousSibling) !== parentEnd) {
        if (!receiver!.commentsDisabled && Printer_shouldEmitTrailingComments(receiver, previousSibling)) {
          Printer_emitLeadingComments(receiver, Node_End(previousSibling), false as bool);
        }
      }
      Printer_writeDelimiter(receiver, format);
      const separatingLineTerminatorCount = Printer_getSeparatingLineTerminatorCount(receiver, previousSibling, child, format);
      if (separatingLineTerminatorCount > 0) {
        if ((format & (LFLinesMask | LFIndented)) === LFSingleLine) {
          Printer_increaseIndent(receiver);
          shouldDecreaseIndentAfterEmit = true as bool;
        }
        if (shouldEmitInterveningComments && (format & LFDelimitersMask) !== 0 && !PositionIsSynthesized(Node_Pos(child)) && Printer_shouldEmitLeadingComments(receiver, child)) {
          const commentRange = EmitContext_CommentRange(receiver!.emitContext, child);
          Printer_emitTrailingCommentsOfPosition(receiver, TextRange_Pos(commentRange), ((format & LFSpaceBetweenSiblings) !== 0) as unknown as bool, true as bool);
        }
        for (let i = 0; i < separatingLineTerminatorCount; i++) {
          Printer_writeLine(receiver);
        }
        shouldEmitInterveningComments = false as bool;
      } else if ((format & LFSpaceBetweenSiblings) !== 0) {
        Printer_writeSpace(receiver);
      }
    }

    if (shouldEmitInterveningComments && Printer_shouldEmitLeadingComments(receiver, child)) {
      const commentRange = EmitContext_CommentRange(receiver!.emitContext, child);
      Printer_emitTrailingCommentsOfPosition(receiver, TextRange_Pos(commentRange), false as bool, false as bool);
    } else {
      shouldEmitInterveningComments = mayEmitInterveningComments;
    }

    receiver!.nextListElementPos = Node_Pos(child);
    emit(receiver, child);

    if (shouldDecreaseIndentAfterEmit) {
      Printer_decreaseIndent(receiver);
      shouldDecreaseIndentAfterEmit = false as bool;
    }

    previousSibling = child;
  }

  const skipTrailingComments = receiver!.commentsDisabled || !Printer_shouldEmitTrailingComments(receiver, previousSibling);
  const emitTrailingComma = hasTrailingComma && (format & LFAllowTrailingComma) !== 0 && (format & LFCommaDelimited) !== 0;
  if (emitTrailingComma) {
    if (previousSibling !== undefined && !skipTrailingComments) {
      Printer_emitToken(receiver, KindCommaToken, Node_End(previousSibling), WriteKindPunctuation, previousSibling);
    } else {
      Printer_writePunctuation(receiver, ",");
    }
  }

  if (previousSibling !== undefined && parentEnd !== Node_End(previousSibling) && (format & LFDelimitersMask) !== 0 && !skipTrailingComments) {
    let commentsPos: int;
    if (emitTrailingComma && TextRange_End(childrenTextRange) > 0) {
      commentsPos = TextRange_End(childrenTextRange);
    } else {
      commentsPos = Node_End(previousSibling);
    }
    Printer_emitLeadingComments(receiver, commentsPos, false as bool);
  }

  if ((format & LFIndented) !== 0) {
    Printer_decreaseIndent(receiver);
  }

  const closingLineTerminatorCount = Printer_getClosingLineTerminatorCount(receiver, parentNode, LastOrNil(children), format, childrenTextRange);
  if (closingLineTerminatorCount > 0) {
    for (let i = 0; i < closingLineTerminatorCount; i++) {
      Printer_writeLine(receiver);
    }
  } else if ((format & (LFSpaceAfterList | LFSpaceBetweenBraces)) !== 0) {
    Printer_writeSpace(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.Emit","kind":"method","status":"implemented","sigHash":"86083b2e4cc26137c432e756967b8bec2a70df3d26ab5b5233364d198d6ada43","bodyHash":"ae3e430aaef1c49b93d656fbf0572bc02ea85a80e5d60b70872d50c3d5466f66"}
 *
 * Go source:
 * func (p *Printer) Emit(node *ast.Node, sourceFile *ast.SourceFile) string {
 * 	// ensure a reusable writer
 * 	if p.ownWriter == nil {
 * 		p.ownWriter = NewTextWriter(p.Options.NewLine.GetNewLineCharacter(), 0)
 * 	}
 * 
 * 	p.Write(node, sourceFile, p.ownWriter, nil /*sourceMapGenerator* /)
 * 	text := p.ownWriter.String()
 * 
 * 	p.ownWriter.Clear()
 * 	return text
 * }
 */
export function Printer_Emit(receiver: GoPtr<Printer>, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>): string {
  if (receiver!.ownWriter === undefined) {
    receiver!.ownWriter = NewTextWriter(NewLineKind_GetNewLineCharacter(receiver!.Options.NewLine ?? NewLineKindNone), 0);
  }
  Printer_Write(receiver, node, sourceFile, receiver!.ownWriter, undefined);
  const text = receiver!.ownWriter.String();
  receiver!.ownWriter.Clear();
  return text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.Write","kind":"method","status":"implemented","sigHash":"4f5aa7aa2cbb040a0c6defceedff2df572c7f561114aeeac57289c53085be046","bodyHash":"1a613384e8bcf52974724baddc05cba113e0e221f4490a822eee4977e5149a97"}
 *
 * Go source:
 * func (p *Printer) Write(node *ast.Node, sourceFile *ast.SourceFile, writer EmitTextWriter, sourceMapGenerator *sourcemap.Generator) {
 * 	savedCurrentSourceFile := p.currentSourceFile
 * 	savedWriter := p.writer
 * 	savedUniqueHelperNames := p.uniqueHelperNames
 * 	savedSourceMapsDisabled := p.sourceMapsDisabled
 * 	savedSourceMapGenerator := p.sourceMapGenerator
 * 	savedSourceMapSource := p.sourceMapSource
 * 	savedSourceMapSourceIndex := p.sourceMapSourceIndex
 * 	savedSourceMapLineCharCache := p.sourceMapLineCharCache
 * 
 * 	p.sourceMapsDisabled = sourceMapGenerator == nil
 * 	p.sourceMapGenerator = sourceMapGenerator
 * 	p.sourceMapSource = nil
 * 	p.sourceMapSourceIndex = -1
 * 	p.sourceMapLineCharCache = nil
 * 
 * 	p.setSourceFile(sourceFile)
 * 	p.writer = writer
 * 	p.writer.Clear()
 * 	if sourceFile != nil {
 * 		if grower, ok := p.writer.(interface{ Grow(n int) }); ok {
 * 			grower.Grow(len(sourceFile.Text()))
 * 		}
 * 	}
 * 
 * 	switch node.Kind {
 * 	// Pseudo-literals
 * 	case ast.KindTemplateHead:
 * 		p.emitTemplateHead(node.AsTemplateHead())
 * 	case ast.KindTemplateMiddle:
 * 		p.emitTemplateMiddle(node.AsTemplateMiddle())
 * 	case ast.KindTemplateTail:
 * 		p.emitTemplateTail(node.AsTemplateTail())
 * 
 * 	// Identifiers
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 
 * 	// PrivateIdentifiers
 * 	case ast.KindPrivateIdentifier:
 * 		p.emitPrivateIdentifier(node.AsPrivateIdentifier())
 * 
 * 	// Parse tree nodes
 * 	// Names
 * 	case ast.KindQualifiedName:
 * 		p.emitQualifiedName(node.AsQualifiedName())
 * 	case ast.KindComputedPropertyName:
 * 		p.emitComputedPropertyName(node.AsComputedPropertyName())
 * 
 * 	// Signature elements
 * 	case ast.KindTypeParameter:
 * 		p.emitTypeParameter(node.AsTypeParameterDeclaration())
 * 	case ast.KindParameter:
 * 		p.emitParameter(node.AsParameterDeclaration())
 * 	case ast.KindDecorator:
 * 		p.emitDecorator(node.AsDecorator())
 * 
 * 	// Type members
 * 	case ast.KindPropertySignature:
 * 		p.emitPropertySignature(node.AsPropertySignatureDeclaration())
 * 	case ast.KindPropertyDeclaration:
 * 		p.emitPropertyDeclaration(node.AsPropertyDeclaration())
 * 	case ast.KindMethodSignature:
 * 		p.emitMethodSignature(node.AsMethodSignatureDeclaration())
 * 	case ast.KindMethodDeclaration:
 * 		p.emitMethodDeclaration(node.AsMethodDeclaration())
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		p.emitClassStaticBlockDeclaration(node.AsClassStaticBlockDeclaration())
 * 	case ast.KindConstructor:
 * 		p.emitConstructor(node.AsConstructorDeclaration())
 * 	case ast.KindGetAccessor:
 * 		p.emitGetAccessorDeclaration(node.AsGetAccessorDeclaration())
 * 	case ast.KindSetAccessor:
 * 		p.emitSetAccessorDeclaration(node.AsSetAccessorDeclaration())
 * 	case ast.KindCallSignature:
 * 		p.emitCallSignature(node.AsCallSignatureDeclaration())
 * 	case ast.KindConstructSignature:
 * 		p.emitConstructSignature(node.AsConstructSignatureDeclaration())
 * 	case ast.KindIndexSignature:
 * 		p.emitIndexSignature(node.AsIndexSignatureDeclaration())
 * 
 * 	// Binding patterns
 * 	case ast.KindObjectBindingPattern:
 * 		p.emitObjectBindingPattern(node.AsBindingPattern())
 * 	case ast.KindArrayBindingPattern:
 * 		p.emitArrayBindingPattern(node.AsBindingPattern())
 * 	case ast.KindBindingElement:
 * 		p.emitBindingElement(node.AsBindingElement())
 * 
 * 	// Misc
 * 	case ast.KindTemplateSpan:
 * 		p.emitTemplateSpan(node.AsTemplateSpan())
 * 	case ast.KindSemicolonClassElement:
 * 		p.emitSemicolonClassElement(node.AsSemicolonClassElement())
 * 
 * 	// Declarations (non-statement)
 * 	case ast.KindVariableDeclaration:
 * 		p.emitVariableDeclaration(node.AsVariableDeclaration())
 * 	case ast.KindVariableDeclarationList:
 * 		p.emitVariableDeclarationList(node.AsVariableDeclarationList())
 * 	case ast.KindModuleBlock:
 * 		p.emitModuleBlock(node.AsModuleBlock())
 * 	case ast.KindCaseBlock:
 * 		p.emitCaseBlock(node.AsCaseBlock())
 * 	case ast.KindImportClause:
 * 		p.emitImportClause(node.AsImportClause())
 * 	case ast.KindNamespaceImport:
 * 		p.emitNamespaceImport(node.AsNamespaceImport())
 * 	case ast.KindNamespaceExport:
 * 		p.emitNamespaceExport(node.AsNamespaceExport())
 * 	case ast.KindNamedImports:
 * 		p.emitNamedImports(node.AsNamedImports())
 * 	case ast.KindImportSpecifier:
 * 		p.emitImportSpecifier(node.AsImportSpecifier())
 * 	case ast.KindNamedExports:
 * 		p.emitNamedExports(node.AsNamedExports())
 * 	case ast.KindExportSpecifier:
 * 		p.emitExportSpecifier(node.AsExportSpecifier())
 * 	case ast.KindImportAttributes:
 * 		p.emitImportAttributes(node.AsImportAttributes())
 * 	case ast.KindImportAttribute:
 * 		p.emitImportAttribute(node.AsImportAttribute())
 * 
 * 	// Module references
 * 	case ast.KindExternalModuleReference:
 * 		p.emitExternalModuleReference(node.AsExternalModuleReference())
 * 
 * 	// JSX (non-expression)
 * 	case ast.KindJsxText:
 * 		p.emitJsxText(node.AsJsxText())
 * 	case ast.KindJsxOpeningElement:
 * 		p.emitJsxOpeningElement(node.AsJsxOpeningElement())
 * 	case ast.KindJsxOpeningFragment:
 * 		p.emitJsxOpeningFragment(node.AsJsxOpeningFragment())
 * 	case ast.KindJsxClosingElement:
 * 		p.emitJsxClosingElement(node.AsJsxClosingElement())
 * 	case ast.KindJsxClosingFragment:
 * 		p.emitJsxClosingFragment(node.AsJsxClosingFragment())
 * 	case ast.KindJsxAttribute:
 * 		p.emitJsxAttribute(node.AsJsxAttribute())
 * 	case ast.KindJsxAttributes:
 * 		p.emitJsxAttributes(node.AsJsxAttributes())
 * 	case ast.KindJsxSpreadAttribute:
 * 		p.emitJsxSpreadAttribute(node.AsJsxSpreadAttribute())
 * 	case ast.KindJsxExpression:
 * 		p.emitJsxExpression(node.AsJsxExpression())
 * 	case ast.KindJsxNamespacedName:
 * 		p.emitJsxNamespacedName(node.AsJsxNamespacedName())
 * 
 * 	// Clauses
 * 	case ast.KindCaseClause:
 * 		p.emitCaseClause(node.AsCaseOrDefaultClause())
 * 	case ast.KindDefaultClause:
 * 		p.emitDefaultClause(node.AsCaseOrDefaultClause())
 * 	case ast.KindHeritageClause:
 * 		p.emitHeritageClause(node.AsHeritageClause())
 * 	case ast.KindCatchClause:
 * 		p.emitCatchClause(node.AsCatchClause())
 * 
 * 	// Property assignments
 * 	case ast.KindPropertyAssignment:
 * 		p.emitPropertyAssignment(node.AsPropertyAssignment())
 * 	case ast.KindShorthandPropertyAssignment:
 * 		p.emitShorthandPropertyAssignment(node.AsShorthandPropertyAssignment())
 * 	case ast.KindSpreadAssignment:
 * 		p.emitSpreadAssignment(node.AsSpreadAssignment())
 * 
 * 	// Enum
 * 	case ast.KindEnumMember:
 * 		p.emitEnumMember(node.AsEnumMember())
 * 
 * 		// Top-level nodes
 * 	case ast.KindSourceFile:
 * 		p.emitSourceFile(node.AsSourceFile())
 * 
 * 	// Transformation nodes
 * 	case ast.KindNotEmittedTypeElement:
 * 		p.emitNotEmittedTypeElement(node.AsNotEmittedTypeElement())
 * 
 * 	default:
 * 		switch {
 * 		case ast.IsTypeNode(node):
 * 			p.emitTypeNodeOutsideExtends(node)
 * 		case ast.IsStatement(node):
 * 			p.emitStatement(node)
 * 		case ast.IsExpression(node):
 * 			p.emitExpression(node, ast.OperatorPrecedenceLowest)
 * 		case ast.IsKeywordKind(node.Kind):
 * 			p.emitKeywordNode(node)
 * 		case ast.IsPunctuationKind(node.Kind):
 * 			p.emitPunctuationNode(node)
 * 		case ast.IsJSDocKind(node.Kind):
 * 			p.emitJSDocNode(node)
 * 		default:
 * 			panic(fmt.Sprintf("unhandled Node: %v", node.Kind))
 * 		}
 * 	}
 * 
 * 	p.currentSourceFile = savedCurrentSourceFile
 * 	p.writer = savedWriter
 * 	p.uniqueHelperNames = savedUniqueHelperNames
 * 	p.sourceMapsDisabled = savedSourceMapsDisabled
 * 	p.sourceMapGenerator = savedSourceMapGenerator
 * 	p.sourceMapSource = savedSourceMapSource
 * 	p.sourceMapSourceIndex = savedSourceMapSourceIndex
 * 	p.sourceMapLineCharCache = savedSourceMapLineCharCache
 * }
 */
export function Printer_Write(receiver: GoPtr<Printer>, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, writer: EmitTextWriter, sourceMapGenerator: GoPtr<Generator>): void {
  const savedCurrentSourceFile = receiver!.currentSourceFile;
  const savedWriter = receiver!.writer;
  const savedUniqueHelperNames = receiver!.uniqueHelperNames;
  const savedSourceMapsDisabled = receiver!.sourceMapsDisabled;
  const savedSourceMapGenerator = receiver!.sourceMapGenerator;
  const savedSourceMapSource = receiver!.sourceMapSource;
  const savedSourceMapSourceIndex = receiver!.sourceMapSourceIndex;
  const savedSourceMapLineCharCache = receiver!.sourceMapLineCharCache;

  receiver!.sourceMapsDisabled = (sourceMapGenerator === undefined) as unknown as bool;
  receiver!.sourceMapGenerator = sourceMapGenerator;
  receiver!.sourceMapSource = undefined as never;
  receiver!.sourceMapSourceIndex = -1;
  receiver!.sourceMapLineCharCache = undefined;

  Printer_setSourceFile(receiver, sourceFile);
  receiver!.writer = writer;
  receiver!.writer.Clear();
  if (sourceFile !== undefined) {
    const w = receiver!.writer as unknown as { Grow?: (n: int) => void };
    if (w.Grow !== undefined) {
      w.Grow(Node_Text(NodeDefault_AsNode(sourceFile)).length);
    }
  }

  switch (node!.Kind) {
    // Pseudo-literals
    case KindTemplateHead:
      Printer_emitTemplateHead(receiver, AsTemplateHead(node));
      break;
    case KindTemplateMiddle:
      Printer_emitTemplateMiddle(receiver, AsTemplateMiddle(node));
      break;
    case KindTemplateTail:
      Printer_emitTemplateTail(receiver, AsTemplateTail(node));
      break;
    // Identifiers
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    // PrivateIdentifiers
    case KindPrivateIdentifier:
      Printer_emitPrivateIdentifier(receiver, AsPrivateIdentifier(node));
      break;
    // Names
    case KindQualifiedName:
      Printer_emitQualifiedName(receiver, AsQualifiedName(node));
      break;
    case KindComputedPropertyName:
      Printer_emitComputedPropertyName(receiver, AsComputedPropertyName(node));
      break;
    // Signature elements
    case KindParameter:
      Printer_emitParameter(receiver, AsParameterDeclaration(node));
      break;
    case KindDecorator:
      Printer_emitDecorator(receiver, AsDecorator(node));
      break;
    // Type members
    case KindPropertySignature:
      Printer_emitPropertySignature(receiver, AsPropertySignatureDeclaration(node));
      break;
    case KindPropertyDeclaration:
      Printer_emitPropertyDeclaration(receiver, AsPropertyDeclaration(node));
      break;
    case KindMethodSignature:
      Printer_emitMethodSignature(receiver, AsMethodSignatureDeclaration(node));
      break;
    case KindMethodDeclaration:
      Printer_emitMethodDeclaration(receiver, AsMethodDeclaration(node));
      break;
    case KindClassStaticBlockDeclaration:
      Printer_emitClassStaticBlockDeclaration(receiver, AsClassStaticBlockDeclaration(node));
      break;
    case KindConstructor:
      Printer_emitConstructor(receiver, AsConstructorDeclaration(node));
      break;
    case KindGetAccessor:
      Printer_emitGetAccessorDeclaration(receiver, AsGetAccessorDeclaration(node));
      break;
    case KindSetAccessor:
      Printer_emitSetAccessorDeclaration(receiver, AsSetAccessorDeclaration(node));
      break;
    case KindCallSignature:
      Printer_emitCallSignature(receiver, AsCallSignatureDeclaration(node));
      break;
    case KindConstructSignature:
      Printer_emitConstructSignature(receiver, AsConstructSignatureDeclaration(node));
      break;
    case KindIndexSignature:
      Printer_emitIndexSignature(receiver, AsIndexSignatureDeclaration(node));
      break;
    // Binding patterns
    case KindObjectBindingPattern:
      Printer_emitObjectBindingPattern(receiver, AsBindingPattern(node));
      break;
    case KindArrayBindingPattern:
      Printer_emitArrayBindingPattern(receiver, AsBindingPattern(node));
      break;
    case KindBindingElement:
      Printer_emitBindingElement(receiver, AsBindingElement(node));
      break;
    // Misc
    case KindTemplateSpan:
      Printer_emitTemplateSpan(receiver, AsTemplateSpan(node));
      break;
    case KindSemicolonClassElement:
      Printer_emitSemicolonClassElement(receiver, AsSemicolonClassElement(node));
      break;
    // Declarations (non-statement)
    case KindVariableDeclaration:
      Printer_emitVariableDeclaration(receiver, AsVariableDeclaration(node));
      break;
    case KindVariableDeclarationList:
      Printer_emitVariableDeclarationList(receiver, AsVariableDeclarationList(node));
      break;
    case KindModuleBlock:
      Printer_emitModuleBlock(receiver, AsModuleBlock(node));
      break;
    case KindCaseBlock:
      Printer_emitCaseBlock(receiver, AsCaseBlock(node));
      break;
    case KindImportClause:
      Printer_emitImportClause(receiver, AsImportClause(node));
      break;
    case KindNamespaceImport:
      Printer_emitNamespaceImport(receiver, AsNamespaceImport(node));
      break;
    case KindNamespaceExport:
      Printer_emitNamespaceExport(receiver, AsNamespaceExport(node));
      break;
    case KindNamedImports:
      Printer_emitNamedImports(receiver, AsNamedImports(node));
      break;
    case KindImportSpecifier:
      Printer_emitImportSpecifier(receiver, AsImportSpecifier(node));
      break;
    case KindNamedExports:
      Printer_emitNamedExports(receiver, AsNamedExports(node));
      break;
    case KindExportSpecifier:
      Printer_emitExportSpecifier(receiver, AsExportSpecifier(node));
      break;
    case KindImportAttributes:
      Printer_emitImportAttributes(receiver, AsImportAttributes(node));
      break;
    case KindImportAttribute:
      Printer_emitImportAttribute(receiver, AsImportAttribute(node));
      break;
    // Module references
    case KindExternalModuleReference:
      Printer_emitExternalModuleReference(receiver, AsExternalModuleReference(node));
      break;
    // JSX (non-expression)
    case KindJsxText:
      Printer_emitJsxText(receiver, AsJsxText(node));
      break;
    case KindJsxOpeningElement:
      Printer_emitJsxOpeningElement(receiver, AsJsxOpeningElement(node));
      break;
    case KindJsxOpeningFragment:
      Printer_emitJsxOpeningFragment(receiver, AsJsxOpeningFragment(node));
      break;
    case KindJsxClosingElement:
      Printer_emitJsxClosingElement(receiver, AsJsxClosingElement(node));
      break;
    case KindJsxClosingFragment:
      Printer_emitJsxClosingFragment(receiver, AsJsxClosingFragment(node));
      break;
    case KindJsxAttribute:
      Printer_emitJsxAttribute(receiver, AsJsxAttribute(node));
      break;
    case KindJsxAttributes:
      Printer_emitJsxAttributes(receiver, AsJsxAttributes(node));
      break;
    case KindJsxSpreadAttribute:
      Printer_emitJsxSpreadAttribute(receiver, AsJsxSpreadAttribute(node));
      break;
    case KindJsxExpression:
      Printer_emitJsxExpression(receiver, AsJsxExpression(node));
      break;
    case KindJsxNamespacedName:
      Printer_emitJsxNamespacedName(receiver, AsJsxNamespacedName(node));
      break;
    // Clauses
    case KindCaseClause:
      Printer_emitCaseClause(receiver, AsCaseOrDefaultClause(node));
      break;
    case KindDefaultClause:
      Printer_emitDefaultClause(receiver, AsCaseOrDefaultClause(node));
      break;
    case KindHeritageClause:
      Printer_emitHeritageClause(receiver, AsHeritageClause(node));
      break;
    case KindCatchClause:
      Printer_emitCatchClause(receiver, AsCatchClause(node));
      break;
    // Property assignments
    case KindPropertyAssignment:
      Printer_emitPropertyAssignment(receiver, AsPropertyAssignment(node));
      break;
    case KindShorthandPropertyAssignment:
      Printer_emitShorthandPropertyAssignment(receiver, AsShorthandPropertyAssignment(node));
      break;
    case KindSpreadAssignment:
      Printer_emitSpreadAssignment(receiver, AsSpreadAssignment(node));
      break;
    // Enum
    case KindEnumMember:
      Printer_emitEnumMember(receiver, AsEnumMember(node));
      break;
    // Top-level nodes
    case KindSourceFile:
      Printer_emitSourceFile(receiver, AsSourceFile(NodeDefault_AsNode(node)));
      break;
    // Transformation nodes
    case KindNotEmittedTypeElement:
      Printer_emitNotEmittedTypeElement(receiver, AsNotEmittedTypeElement(node));
      break;
    default:
      if (IsTypeNode(node)) {
        Printer_emitTypeNodeOutsideExtends(receiver, node as unknown as GoPtr<TypeNode>);
      } else if (IsStatement(node)) {
        Printer_emitStatement(receiver, node as unknown as GoPtr<Statement>);
      } else if (IsExpression(node)) {
        Printer_emitExpression(receiver, node as unknown as GoPtr<Expression>, OperatorPrecedenceLowest);
      } else if (IsKeywordKind(node!.Kind)) {
        Printer_emitKeywordNode(receiver, node as unknown as GoPtr<TokenNode>);
      } else if (IsPunctuationKind(node!.Kind)) {
        Printer_emitPunctuationNode(receiver, node as unknown as GoPtr<TokenNode>);
      } else if (IsJSDocKind(node!.Kind)) {
        Printer_emitJSDocNode(receiver, node);
      } else {
        throw new globalThis.Error(`unhandled Node: ${node!.Kind}`);
      }
      break;
  }

  receiver!.currentSourceFile = savedCurrentSourceFile;
  receiver!.writer = savedWriter;
  receiver!.uniqueHelperNames = savedUniqueHelperNames;
  receiver!.sourceMapsDisabled = savedSourceMapsDisabled;
  receiver!.sourceMapGenerator = savedSourceMapGenerator;
  receiver!.sourceMapSource = savedSourceMapSource;
  receiver!.sourceMapSourceIndex = savedSourceMapSourceIndex;
  receiver!.sourceMapLineCharCache = savedSourceMapLineCharCache;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPos","kind":"method","status":"implemented","sigHash":"1b47bbb50e55f8089fbaf2acf3cc21521e7c90386cda55443b3718b36649ed09","bodyHash":"98e39f7601672ec5728e3baefe3872e09ac7ff4bb7c05a0a256a55ca7180600b"}
 *
 * Go source:
 * func (p *Printer) emitPos(pos int) {
 * 	if p.sourceMapsDisabled || p.sourceMapSource == nil || p.sourceMapGenerator == nil || p.sourceMapSourceIsJson || ast.PositionIsSynthesized(pos) {
 * 		return
 * 	}
 * 
 * 	sourceLine, sourceCharacter := p.sourceMapLineCharCache.getLineAndCharacter(pos)
 * 	if err := p.sourceMapGenerator.AddSourceMapping(
 * 		p.writer.GetLine(),
 * 		p.writer.GetColumn(),
 * 		p.sourceMapSourceIndex,
 * 		sourceLine,
 * 		sourceCharacter,
 * 	); err != nil {
 * 		panic(err)
 * 	}
 * }
 */
export function Printer_emitPos(receiver: GoPtr<Printer>, pos: int): void {
  if (receiver!.sourceMapsDisabled || receiver!.sourceMapSource === undefined || receiver!.sourceMapGenerator === undefined || receiver!.sourceMapSourceIsJson || PositionIsSynthesized(pos)) {
    return;
  }
  const [sourceLine, sourceCharacter] = lineCharacterCache_getLineAndCharacter(receiver!.sourceMapLineCharCache, pos);
  const err = Generator_AddSourceMapping(receiver!.sourceMapGenerator, receiver!.writer.GetLine(), receiver!.writer.GetColumn(), receiver!.sourceMapSourceIndex, sourceLine, sourceCharacter);
  if (err !== undefined) {
    throw new globalThis.Error(String(err));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.pushNameGenerationScope","kind":"method","status":"implemented","sigHash":"6704bfe1cc7afbaebb13ba7bda2c58383bcdd4eafffc713bd9e196dfd31fd415","bodyHash":"4c9698030556c1e3a1124601bb30e5e106116c250b75195e9990c9f6859ab6ee"}
 *
 * Go source:
 * func (p *Printer) pushNameGenerationScope(node *ast.Node) {
 * 	p.nameGenerator.PushScope(p.shouldReuseTempVariableScope(node))
 * }
 */
export function Printer_pushNameGenerationScope(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  NameGenerator_PushScope(receiver!.nameGenerator, Printer_shouldReuseTempVariableScope(receiver, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.popNameGenerationScope","kind":"method","status":"implemented","sigHash":"1fc431eaa109f53e404fd050ca5099889294aa4398a46db52b74304686860c6f","bodyHash":"0f930e61780ce3de06c49cc335a3e3c151a90785fafa045026fde7356f8b7098"}
 *
 * Go source:
 * func (p *Printer) popNameGenerationScope(node *ast.Node) {
 * 	p.nameGenerator.PopScope(p.shouldReuseTempVariableScope(node))
 * }
 */
export function Printer_popNameGenerationScope(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  NameGenerator_PopScope(receiver!.nameGenerator, Printer_shouldReuseTempVariableScope(receiver, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateAllNames","kind":"method","status":"implemented","sigHash":"a3d8fbd0878513f4aef1412597e8ff79be057b0e6ee9559a521edd0ff851f3a3","bodyHash":"8115f9078752312b35e7b7f352fd2ff9d792c86502f3d13a6b1b08207666b40e"}
 *
 * Go source:
 * func (p *Printer) generateAllNames(nodes *ast.NodeList) {
 * 	if nodes == nil {
 * 		return
 * 	}
 * 	for _, node := range nodes.Nodes {
 * 		p.generateNames(node)
 * 	}
 * }
 */
export function Printer_generateAllNames(receiver: GoPtr<Printer>, nodes: GoPtr<NodeList>): void {
  if (nodes === undefined) {
    return;
  }
  for (const node of nodes!.Nodes) {
    Printer_generateNames(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateNames","kind":"method","status":"implemented","sigHash":"c475132ac2fe89a49f768a2be7315146038e7b37bd7398820fc8aaf0e0f14bfa","bodyHash":"21edd1711ac2299c4084caa44b0b928ff2f019c6dc7b89df5df21258af6251d4"}
 *
 * Go source:
 * func (p *Printer) generateNames(node *ast.Node) {
 * 	if node == nil {
 * 		return
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindBlock, ast.KindCaseClause, ast.KindDefaultClause:
 * 		p.generateAllNames(node.StatementList())
 * 	case ast.KindLabeledStatement, ast.KindWithStatement, ast.KindDoStatement, ast.KindWhileStatement:
 * 		p.generateNames(node.Statement())
 * 	case ast.KindIfStatement:
 * 		p.generateNames(node.AsIfStatement().ThenStatement)
 * 		p.generateNames(node.AsIfStatement().ElseStatement)
 * 	case ast.KindForStatement, ast.KindForOfStatement, ast.KindForInStatement:
 * 		p.generateNames(node.Initializer())
 * 		p.generateNames(node.Statement())
 * 	case ast.KindSwitchStatement:
 * 		p.generateNames(node.AsSwitchStatement().CaseBlock)
 * 	case ast.KindCaseBlock:
 * 		p.generateAllNames(node.AsCaseBlock().Clauses)
 * 	case ast.KindTryStatement:
 * 		p.generateNames(node.AsTryStatement().TryBlock)
 * 		p.generateNames(node.AsTryStatement().CatchClause)
 * 		p.generateNames(node.AsTryStatement().FinallyBlock)
 * 	case ast.KindCatchClause:
 * 		p.generateNames(node.AsCatchClause().VariableDeclaration)
 * 		p.generateNames(node.AsCatchClause().Block)
 * 	case ast.KindVariableStatement:
 * 		p.generateNames(node.AsVariableStatement().DeclarationList)
 * 	case ast.KindVariableDeclarationList:
 * 		p.generateAllNames(node.AsVariableDeclarationList().Declarations)
 * 	case ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement, ast.KindClassDeclaration:
 * 		p.generateNameIfNeeded(node.Name())
 * 	case ast.KindFunctionDeclaration:
 * 		p.generateNameIfNeeded(node.Name())
 * 		if p.shouldReuseTempVariableScope(node) {
 * 			p.generateAllNames(node.AsFunctionDeclaration().Parameters)
 * 			p.generateNames(node.AsFunctionDeclaration().Body)
 * 		}
 * 	case ast.KindObjectBindingPattern, ast.KindArrayBindingPattern:
 * 		p.generateAllNames(node.ElementList())
 * 	case ast.KindImportDeclaration, ast.KindJSImportDeclaration:
 * 		p.generateNames(node.AsImportDeclaration().ImportClause)
 * 	case ast.KindImportClause:
 * 		p.generateNameIfNeeded(node.AsImportClause().Name())
 * 		p.generateNames(node.AsImportClause().NamedBindings)
 * 	case ast.KindNamespaceImport, ast.KindNamespaceExport:
 * 		p.generateNameIfNeeded(node.Name())
 * 	case ast.KindNamedImports:
 * 		p.generateAllNames(node.ElementList())
 * 	case ast.KindImportSpecifier:
 * 		n := node.AsImportSpecifier()
 * 		if n.PropertyName != nil {
 * 			p.generateNameIfNeeded(n.PropertyName)
 * 		} else {
 * 			p.generateNameIfNeeded(n.Name())
 * 		}
 * 	}
 * }
 */
export function Printer_generateNames(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  if (node === undefined) {
    return;
  }
  switch (node!.Kind) {
    case KindBlock:
    case KindCaseClause:
    case KindDefaultClause:
      Printer_generateAllNames(receiver, Node_StatementList(node));
      break;
    case KindLabeledStatement:
    case KindWithStatement:
    case KindDoStatement:
    case KindWhileStatement:
      Printer_generateNames(receiver, Node_AsNode(Node_Statement(node)));
      break;
    case KindIfStatement: {
      const ifStmt = AsIfStatement(node);
      Printer_generateNames(receiver, ifStmt!.ThenStatement as unknown as GoPtr<Node>);
      Printer_generateNames(receiver, ifStmt!.ElseStatement as unknown as GoPtr<Node>);
      break;
    }
    case KindForStatement:
    case KindForOfStatement:
    case KindForInStatement:
      Printer_generateNames(receiver, Node_Initializer(node));
      Printer_generateNames(receiver, Node_AsNode(Node_Statement(node)));
      break;
    case KindSwitchStatement:
      Printer_generateNames(receiver, AsSwitchStatement(node)!.CaseBlock as unknown as GoPtr<Node>);
      break;
    case KindCaseBlock:
      Printer_generateAllNames(receiver, AsCaseBlock(node)!.Clauses as unknown as GoPtr<NodeList>);
      break;
    case KindTryStatement: {
      const tryStmt = AsTryStatement(node);
      Printer_generateNames(receiver, tryStmt!.TryBlock as unknown as GoPtr<Node>);
      Printer_generateNames(receiver, tryStmt!.CatchClause as unknown as GoPtr<Node>);
      Printer_generateNames(receiver, tryStmt!.FinallyBlock as unknown as GoPtr<Node>);
      break;
    }
    case KindCatchClause: {
      const catchClause = AsCatchClause(node);
      Printer_generateNames(receiver, catchClause!.VariableDeclaration as unknown as GoPtr<Node>);
      Printer_generateNames(receiver, catchClause!.Block as unknown as GoPtr<Node>);
      break;
    }
    case KindVariableStatement:
      Printer_generateNames(receiver, AsVariableStatement(node)!.DeclarationList as unknown as GoPtr<Node>);
      break;
    case KindVariableDeclarationList:
      Printer_generateAllNames(receiver, AsVariableDeclarationList(node)!.Declarations as unknown as GoPtr<NodeList>);
      break;
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
    case KindClassDeclaration:
      Printer_generateNameIfNeeded(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>);
      break;
    case KindFunctionDeclaration: {
      const fnDecl = AsFunctionDeclaration(node);
      Printer_generateNameIfNeeded(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>);
      if (Printer_shouldReuseTempVariableScope(receiver, node)) {
        Printer_generateAllNames(receiver, fnDecl!.Parameters as unknown as GoPtr<NodeList>);
        Printer_generateNames(receiver, fnDecl!.Body as unknown as GoPtr<Node>);
      }
      break;
    }
    case KindObjectBindingPattern:
    case KindArrayBindingPattern:
      Printer_generateAllNames(receiver, Node_ElementList(node));
      break;
    case KindImportDeclaration:
    case KindJSImportDeclaration:
      Printer_generateNames(receiver, AsImportDeclaration(node)!.ImportClause as unknown as GoPtr<Node>);
      break;
    case KindImportClause: {
      const importClause = AsImportClause(node);
      Printer_generateNameIfNeeded(receiver, importClause!.name as unknown as GoPtr<DeclarationName>);
      Printer_generateNames(receiver, importClause!.NamedBindings as unknown as GoPtr<Node>);
      break;
    }
    case KindNamespaceImport:
    case KindNamespaceExport:
      Printer_generateNameIfNeeded(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>);
      break;
    case KindNamedImports:
      Printer_generateAllNames(receiver, Node_ElementList(node));
      break;
    case KindImportSpecifier: {
      const importSpecifier = AsImportSpecifier(node);
      if (importSpecifier!.PropertyName !== undefined) {
        Printer_generateNameIfNeeded(receiver, importSpecifier!.PropertyName as unknown as GoPtr<DeclarationName>);
      } else {
        Printer_generateNameIfNeeded(receiver, importSpecifier!.name as unknown as GoPtr<DeclarationName>);
      }
      break;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateName","kind":"method","status":"implemented","sigHash":"5846b4004418c626ef547292194935cbebbdd11e2cbf68985adc39badfba9a6f","bodyHash":"8582fe23c5fe4511ed0dc9a3a6cff905a093484f0c5b7bc754f57f73cb436085"}
 *
 * Go source:
 * func (p *Printer) generateName(name *ast.MemberName) {
 * 	_ = p.nameGenerator.GenerateName(name)
 * }
 */
export function Printer_generateName(receiver: GoPtr<Printer>, name: GoPtr<MemberName>): void {
  NameGenerator_GenerateName(receiver!.nameGenerator, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.isFileLevelUniqueNameInCurrentFile","kind":"method","status":"implemented","sigHash":"7eaa150456908423d7c42729f9358530e46125b7fec1c9b3e8a23887a3c1709a","bodyHash":"9f1b3ee7a08a329672eff643004ad04564ef0c02eaa51b063222fa89fa4b1e86"}
 *
 * Go source:
 * func (p *Printer) isFileLevelUniqueNameInCurrentFile(name string, _ bool) bool {
 * 	if p.currentSourceFile != nil {
 * 		return IsFileLevelUniqueName(p.currentSourceFile, name, p.HasGlobalName)
 * 	} else {
 * 		return true
 * 	}
 * }
 */
export function Printer_isFileLevelUniqueNameInCurrentFile(receiver: GoPtr<Printer>, name: string, _arg: bool): bool {
  if (receiver!.currentSourceFile !== undefined) {
    return IsFileLevelUniqueName(receiver!.currentSourceFile, name, receiver!.__tsgoEmbedded0?.HasGlobalName);
  } else {
    return true as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.enterNode","kind":"method","status":"implemented","sigHash":"46a2128c5be674ec85cf0a1f66163132a2c0913f83784b675952214c965091ae","bodyHash":"e9a9c8db84d479802acb8e1cb9f2a6094af12847f091c0fad5379b5bff3a1f59"}
 *
 * Go source:
 * func (p *Printer) enterNode(node *ast.Node) printerState {
 * 	state := printerState{}
 * 
 * 	if p.OnBeforeEmitNode != nil {
 * 		p.OnBeforeEmitNode(node)
 * 	}
 * 
 * 	state.commentState = p.emitCommentsBeforeNode(node)
 * 	state.sourceMapState = p.emitSourceMapsBeforeNode(node)
 * 	return state
 * }
 */
export function Printer_enterNode(receiver: GoPtr<Printer>, node: GoPtr<Node>): printerState {
  const state = {} as printerState;
  if (receiver!.__tsgoEmbedded0?.OnBeforeEmitNode !== undefined) {
    receiver!.__tsgoEmbedded0!.OnBeforeEmitNode(node);
  }
  state.commentState = Printer_emitCommentsBeforeNode(receiver, node);
  state.sourceMapState = Printer_emitSourceMapsBeforeNode(receiver, node);
  return state;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.exitNode","kind":"method","status":"implemented","sigHash":"3d543ac3c656424adafb5ca7cd8fea43bad1f8171154dc3d85403693bfa3f202","bodyHash":"fa707f2debb399b59e98a2f34aa3752c0071077930e0abd1583907345191856c"}
 *
 * Go source:
 * func (p *Printer) exitNode(node *ast.Node, previousState printerState) {
 * 	p.emitSourceMapsAfterNode(node, previousState.sourceMapState)
 * 	p.emitCommentsAfterNode(node, previousState.commentState)
 * 
 * 	if p.OnAfterEmitNode != nil {
 * 		p.OnAfterEmitNode(node)
 * 	}
 * }
 */
export function Printer_exitNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, previousState: printerState): void {
  Printer_emitSourceMapsAfterNode(receiver, node, previousState.sourceMapState);
  Printer_emitCommentsAfterNode(receiver, node, previousState.commentState);
  if (receiver!.__tsgoEmbedded0?.OnAfterEmitNode !== undefined) {
    receiver!.__tsgoEmbedded0!.OnAfterEmitNode(node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.enterTokenNode","kind":"method","status":"implemented","sigHash":"1c1631ee565ecd49c6d1019f72e0b95e6a29aee0b7fece52d0570ab7e96f9cb8","bodyHash":"22bdb52178b2a65a795e121d5acb1bcfd087a423803285882cbe4132acb7b403"}
 *
 * Go source:
 * func (p *Printer) enterTokenNode(node *ast.Node, flags tokenEmitFlags) printerState {
 * 	state := printerState{}
 * 
 * 	if p.OnBeforeEmitToken != nil {
 * 		p.OnBeforeEmitToken(node)
 * 	}
 * 
 * 	if flags&tefNoComments == 0 {
 * 		state.commentState = p.emitCommentsBeforeNode(node)
 * 	}
 * 	if flags&tefNoSourceMaps == 0 {
 * 		state.sourceMapState = p.emitSourceMapsBeforeNode(node)
 * 	}
 * 	return state
 * }
 */
export function Printer_enterTokenNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, flags: tokenEmitFlags): printerState {
  const state = {} as printerState;
  if (receiver!.__tsgoEmbedded0?.OnBeforeEmitToken !== undefined) {
    receiver!.__tsgoEmbedded0!.OnBeforeEmitToken(node);
  }
  if ((flags & tefNoComments) === 0) {
    state.commentState = Printer_emitCommentsBeforeNode(receiver, node);
  }
  if ((flags & tefNoSourceMaps) === 0) {
    state.sourceMapState = Printer_emitSourceMapsBeforeNode(receiver, node);
  }
  return state;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.exitTokenNode","kind":"method","status":"implemented","sigHash":"1769c92cc0bdbbe855b2772bd6f257f20b10816480e38b8d63638b01f23f5667","bodyHash":"3c6c0ff995cbdd86e2bf1dce9467dda2e8bcbc158362918010dbd7a61c97a0f6"}
 *
 * Go source:
 * func (p *Printer) exitTokenNode(node *ast.Node, previousState printerState) {
 * 	p.emitSourceMapsAfterNode(node, previousState.sourceMapState)
 * 	p.emitCommentsAfterNode(node, previousState.commentState)
 * 
 * 	if p.OnAfterEmitToken != nil {
 * 		p.OnAfterEmitToken(node)
 * 	}
 * }
 */
export function Printer_exitTokenNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, previousState: printerState): void {
  Printer_emitSourceMapsAfterNode(receiver, node, previousState.sourceMapState);
  Printer_emitCommentsAfterNode(receiver, node, previousState.commentState);
  if (receiver!.__tsgoEmbedded0?.OnAfterEmitToken !== undefined) {
    receiver!.__tsgoEmbedded0!.OnAfterEmitToken(node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.enterToken","kind":"method","status":"implemented","sigHash":"197f0ac2189efdab5762d1e5d139179ca047e1e2028ae18f0554572b97c1fbde","bodyHash":"991434989e484a142a7ed33f1cd5d8403a3c9752ff43453b8f6b180790dedd23"}
 *
 * Go source:
 * func (p *Printer) enterToken(token ast.Kind, pos int, contextNode *ast.Node, flags tokenEmitFlags) (printerState, int) {
 * 	state := printerState{}
 * 	state.commentState, pos = p.emitCommentsBeforeToken(token, pos, contextNode, flags)
 * 	state.sourceMapState = p.emitSourceMapsBeforeToken(token, pos, contextNode, flags)
 * 	return state, pos
 * }
 */
export function Printer_enterToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): [printerState, int] {
  const state = {} as printerState;
  let newPos = pos;
  const [commentState, updatedPos] = Printer_emitCommentsBeforeToken(receiver, token, newPos, contextNode, flags);
  state.commentState = commentState;
  newPos = updatedPos;
  state.sourceMapState = Printer_emitSourceMapsBeforeToken(receiver, token, newPos, contextNode, flags);
  return [state, newPos];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.exitToken","kind":"method","status":"implemented","sigHash":"86f438a8bcab51623e5978920cd508f2f3827b7ea6df3e171a999b32565ad81d","bodyHash":"e2a3afee268a29b567cad84d6ed9c4c0c84337ab278c2e96a851eb1421673809"}
 *
 * Go source:
 * func (p *Printer) exitToken(token ast.Kind, pos int, contextNode *ast.Node, previousState printerState) {
 * 	p.emitSourceMapsAfterToken(token, pos, contextNode, previousState.sourceMapState)
 * 	p.emitCommentsAfterToken(token, pos, contextNode, previousState.commentState)
 * }
 */
export function Printer_exitToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, previousState: printerState): void {
  Printer_emitSourceMapsAfterToken(receiver, token, pos, contextNode, previousState.sourceMapState);
  Printer_emitCommentsAfterToken(receiver, token, pos, contextNode, previousState.commentState);
}

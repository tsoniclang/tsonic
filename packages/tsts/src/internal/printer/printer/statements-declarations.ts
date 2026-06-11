import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { Node_AsNode, Node_End, Node_Name, Node_Modifiers, Node_Pos, NodeList_End } from "../../ast/spine.js";
// `SourceFile` (the hand-written AST struct) is owned by the not-yet-landed
// internal/ast/ast.ts; the entire codebase imports it from ../../ast/ast.js.
// Only the blocked `emitShebangIfNeeded` stub references it.
import type { SourceFile } from "../../ast/ast.js";
import {
  KindAsKeyword,
  KindAsteriskToken,
  KindBreakKeyword,
  KindClassKeyword,
  KindCatchKeyword,
  KindCloseBraceToken,
  KindCloseParenToken,
  KindColonToken,
  KindCommaToken,
  KindContinueKeyword,
  KindDebuggerKeyword,
  KindDoKeyword,
  KindElseKeyword,
  KindEqualsToken,
  KindFinallyKeyword,
  KindForKeyword,
  KindFromKeyword,
  KindGlobalKeyword,
  KindTryKeyword,
  KindIdentifier,
  KindIfKeyword,
  KindImportKeyword,
  KindInKeyword,
  KindMissingDeclaration,
  KindNamespaceKeyword,
  KindOfKeyword,
  KindOpenBraceToken,
  KindOpenParenToken,
  KindReturnKeyword,
  KindSemicolonToken,
  KindStringLiteral,
  KindTypeKeyword,
  KindUnknown,
  KindVariableDeclarationList,
  KindWhileKeyword,
  KindWithKeyword,
  KindBlock,
  KindEmptyStatement,
  KindVariableStatement,
  KindExpressionStatement,
  KindIfStatement,
  KindDoStatement,
  KindWhileStatement,
  KindForStatement,
  KindForInStatement,
  KindForOfStatement,
  KindContinueStatement,
  KindBreakStatement,
  KindReturnStatement,
  KindSwitchStatement,
  KindLabeledStatement,
  KindThrowStatement,
  KindTryStatement,
  KindDebuggerStatement,
  KindNotEmittedStatement,
  KindFunctionDeclaration,
  KindClassDeclaration,
  KindInterfaceDeclaration,
  KindTypeAliasDeclaration,
  KindJSTypeAliasDeclaration,
  KindEnumDeclaration,
  KindModuleDeclaration,
  KindNamespaceExportDeclaration,
  KindImportEqualsDeclaration,
  KindImportDeclaration,
  KindExportAssignment,
  KindExportDeclaration,
  KindPropertyDeclaration,
  KindMethodDeclaration,
  KindClassStaticBlockDeclaration,
  KindConstructor,
  KindGetAccessor,
  KindSetAccessor,
  KindIndexSignature,
  KindSemicolonClassElement,
  KindQualifiedName,
  KindExternalModuleReference,
  KindNamespaceImport,
  KindNamedImports,
  KindNamespaceExport,
  KindNamedExports,
  KindSwitchKeyword,
  KindThrowKeyword,
  KindExportKeyword,
  KindDefaultKeyword,
  KindWithStatement,
} from "../../ast/generated/kinds.js";
import {
  AsBlock,
  AsBreakStatement,
  AsCaseBlock,
  AsCatchClause,
  AsClassDeclaration,
  AsClassStaticBlockDeclaration,
  AsConstructorDeclaration,
  AsContinueStatement,
  AsDebuggerStatement,
  AsDoStatement,
  AsEmptyStatement,
  AsEnumDeclaration,
  AsExportAssignment,
  AsExportDeclaration,
  AsExportSpecifier,
  AsExternalModuleReference,
  AsForInOrOfStatement,
  AsForStatement,
  AsFunctionDeclaration,
  AsGetAccessorDeclaration,
  AsIdentifier,
  AsIfStatement,
  AsImportAttribute,
  AsImportAttributes,
  AsImportClause,
  AsImportDeclaration,
  AsImportEqualsDeclaration,
  AsImportSpecifier,
  AsIndexSignatureDeclaration,
  AsInterfaceDeclaration,
  AsLabeledStatement,
  AsMethodDeclaration,
  AsModuleBlock,
  AsModuleDeclaration,
  AsNamedExports,
  AsNamedImports,
  AsNamespaceExport,
  AsNamespaceExportDeclaration,
  AsNamespaceImport,
  AsNotEmittedStatement,
  AsPropertyDeclaration,
  AsQualifiedName,
  AsReturnStatement,
  AsSemicolonClassElement,
  AsSetAccessorDeclaration,
  AsStringLiteral,
  AsSwitchStatement,
  AsThrowStatement,
  AsTryStatement,
  AsTypeAliasDeclaration,
  AsExpressionStatement,
  AsVariableDeclaration,
  AsVariableDeclarationList,
  AsVariableStatement,
  AsWhileStatement,
  AsWithStatement,
} from "../../ast/generated/casts.js";
import { IsBlock, IsClassExpression, IsFunctionExpression, IsModuleDeclaration } from "../../ast/generated/predicates.js";
import { IsMemberName, IsBindingPattern, NodeIsSynthesized, IsVarAwaitUsing, IsVarConst, IsVarLet, IsVarUsing } from "../../ast/utilities.js";
import { GetLeftmostExpression, OperatorPrecedenceLowest, OperatorPrecedenceAssignment, OperatorPrecedenceParentheses, OperatorPrecedenceDisallowComma } from "../../ast/precedence.js";
import { GetShebang } from "../../scanner/scanner.js";
import { Node_Text, SourceFile_Text } from "../../ast/ast.js";
import type { Block, BreakStatement, CaseBlock, CaseOrDefaultClause, CatchClause, ClassDeclaration, ClassStaticBlockDeclaration, ContinueStatement, DebuggerStatement, DoStatement, EmptyStatement, EnumDeclaration, ExportAssignment, ExportDeclaration, ExportSpecifier, ExternalModuleReference, ForInOrOfStatement, ForStatement, FunctionDeclaration, IfStatement, ImportAttribute, ImportAttributes, ImportClause, ImportDeclaration, ImportEqualsDeclaration, ImportSpecifier, InterfaceDeclaration, JsxNamespacedName, LabeledStatement, ModuleBlock, ModuleDeclaration, NamedExports, NamedImports, NamespaceExport, NamespaceExportDeclaration, NamespaceImport, NotEmittedStatement, ReturnStatement, SemicolonClassElement, SwitchStatement, ThrowStatement, TryStatement, VariableDeclaration, VariableDeclarationList, VariableStatement, WhileStatement, WithStatement } from "../../ast/generated/data.js";
import type { BlockNode, ClassElement, DeclarationName, ExportSpecifierNode, Expression, ForInitializer, ImportAttributeName, ImportAttributeNode, ImportSpecifierNode, ModuleExportName, ModuleName, ModuleReference, NamedExportBindings, NamedImportBindings, ParameterList, Statement, StatementList, VariableDeclarationNode } from "../../ast/generated/unions.js";
import { Coalesce, IfElse } from "../../core/core.js";
import { TextRange_Pos } from "../../core/text.js";
import {
  Printer_decreaseIndent,
  Printer_emitBindingIdentifier,
  Printer_emitBindingName,
  Printer_emitCaseOrDefaultClauseNode,
  Printer_emitConstructor,
  Printer_emitGetAccessorDeclaration,
  Printer_emitIdentifierName,
  Printer_emitIdentifierReference,
  Printer_emitIndexSignature,
  Printer_emitInitializer,
  Printer_emitKeywordNode,
  Printer_emitLabelIdentifier,
  Printer_emitList,
  Printer_emitMethodDeclaration,
  Printer_emitModifierList,
  Printer_emitParameterDeclarationNode,
  Printer_emitPropertyDeclaration,
  Printer_emitPunctuationNode,
  Printer_emitQualifiedName,
  Printer_emitSetAccessorDeclaration,
  Printer_emitSignature,
  Printer_emitToken,
  Printer_emitTokenEx,
  Printer_emitTokenNode,
  Printer_enterNode,
  Printer_exitNode,
  Printer_emitHelpers,
  Printer_generateAllNames,
  Printer_generateName,
  Printer_generateNames,
  Printer_increaseIndent,
  Printer_popNameGenerationScope,
  Printer_pushNameGenerationScope,
  Printer_shouldEmitIndented,
  Printer_writeKeyword,
  Printer_writePunctuation,
  Printer_writeSpace,
  Printer_writeTokenText,
  Printer_writeTrailingSemicolon,
} from "./emit-core.js";
import {
  Printer_getLeadingLineTerminatorCount,
  Printer_shouldEmitBlockFunctionBodyOnSingleLine,
  Printer_shouldEmitOnSingleLine,
  Printer_writeLine,
  Printer_writeLineOrSpace,
} from "./source-maps.js";
import { Printer_emitEnumMemberNode, Printer_emitExpression, Printer_emitExpressionNoASI, Printer_emitExpressionStatement, Printer_emitStringLiteral, Printer_generateAllMemberNames } from "./expressions.js";
import { Printer_emitHeritageClauseNode, Printer_emitTypeAliasDeclaration, Printer_emitTypeAnnotation, Printer_emitTypeElement, Printer_emitTypeParameters } from "./types.js";
import { Printer_emitListRange } from "./source-maps.js";
import { Printer_emitDetachedCommentsAfterStatementList, Printer_emitDetachedCommentsBeforeStatementList, Printer_emitPrologueDirectives, Printer_emitTrailingComments, Printer_writeComment } from "./comments.js";
import { rangeEndIsOnSameLineAsRangeStart, rangeStartPositionsAreOnSameLine, greatestEnd } from "../utilities.js";
import { EFNoLeadingComments, EFNoSourceMap, EFReuseTempVariableScope } from "../emitflags.js";
import { EmitContext_AddEmitFlags, EmitContext_CommentRange, EmitContext_EmitFlags, EmitContext_GetTypeNode } from "../emitcontext.js";
import type { Printer } from "./state.js";
import {
  LFCaseBlockClauses,
  LFCaseOrDefaultClauseStatements,
  LFClassHeritageClauses,
  LFClassMembers,
  LFEnumMembers,
  LFHeritageClauses,
  LFImportAttributes,
  LFIndexSignatureParameters,
  LFIndented,
  LFInterfaceMembers,
  LFMultiLine,
  LFMultiLineBlockStatements,
  LFMultiLineFunctionBodyStatements,
  LFNamedImportsOrExportsElements,
  LFNone,
  LFSingleLineBlockStatements,
  LFSingleLineFunctionBodyStatements,
  LFVariableDeclarationList,
  WriteKindKeyword,
  WriteKindOperator,
  WriteKindPunctuation,
  commentSeparatorAfter,
  tefIndentLeadingComments,
  tefNoComments,
  tefNone,
} from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.increaseIndentIf","kind":"method","status":"implemented","sigHash":"479f9aa12e4722ac256ccd029c43dc7fcd4338acd7ef864a05ceb2f1ddf6adb8","bodyHash":"f285b23f8d0ac6c09e4a15f68d41e65458f6292069dfcf1d9857f534c718d011"}
 *
 * Go source:
 * func (p *Printer) increaseIndentIf(indentRequested bool) {
 * 	if indentRequested {
 * 		p.increaseIndent()
 * 	}
 * }
 */
export function Printer_increaseIndentIf(receiver: GoPtr<Printer>, indentRequested: bool): void {
  if (indentRequested) {
    Printer_increaseIndent(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.decreaseIndentIf","kind":"method","status":"implemented","sigHash":"10068a0df6455667f32c7246bcdc1f29af3ab3a9020f8ed00642701d35fe7165","bodyHash":"acb40928702ada0d453aceb839e0dae06e3a7e4916a4edd7b4f4b2d1aede4e8c"}
 *
 * Go source:
 * func (p *Printer) decreaseIndentIf(indentRequested bool) {
 * 	if indentRequested {
 * 		p.decreaseIndent()
 * 	}
 * }
 */
export function Printer_decreaseIndentIf(receiver: GoPtr<Printer>, indentRequested: bool): void {
  if (indentRequested) {
    Printer_decreaseIndent(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModuleName","kind":"method","status":"implemented","sigHash":"2621dddf05b7e01f90e27015cd6b55c74ffbe792d77721875447f46a691a7686","bodyHash":"0e5dfb3db47085ff283c777b99cc48cfbef28197db263dfac998aed5ad89d40f"}
 *
 * Go source:
 * func (p *Printer) emitModuleName(node *ast.ModuleName) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitBindingIdentifier(node.AsIdentifier())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ModuleName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitModuleName(receiver: GoPtr<Printer>, node: GoPtr<ModuleName>): void {
  if (node === undefined) {
    return;
  }

  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitBindingIdentifier(receiver, AsIdentifier(node));
      break;
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    default:
      throw new globalThis.Error(`unexpected ModuleName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModuleExportName","kind":"method","status":"implemented","sigHash":"ffdd7e342569303e3fe03ca3ba00027b652f0ebebe68ea61165744a36e43a5e6","bodyHash":"537862ef703a57effb1c3d74e17dff7cefb8024b5d2bd13b7975b9d7a5b1adb5"}
 *
 * Go source:
 * func (p *Printer) emitModuleExportName(node *ast.ModuleExportName) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ModuleExportName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitModuleExportName(receiver: GoPtr<Printer>, node: GoPtr<ModuleExportName>): void {
  if (node === undefined) {
    return;
  }

  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    default:
      throw new globalThis.Error(`unexpected ModuleExportName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportAttributeName","kind":"method","status":"implemented","sigHash":"612222ae4fef1a7440967f82bdd8bca4369809731354226cf2161758f91e1214","bodyHash":"85aae4461f51fac5a7a948c5bf38b0f0e5e52b2f8e247de3a831bb98f2474eb4"}
 *
 * Go source:
 * func (p *Printer) emitImportAttributeName(node *ast.ImportAttributeName) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ImportAttributeName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitImportAttributeName(receiver: GoPtr<Printer>, node: GoPtr<ImportAttributeName>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    default:
      throw new globalThis.Error(`unexpected ImportAttributeName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNestedModuleName","kind":"method","status":"implemented","sigHash":"344db9bd0e7a995390cca24179e4496b56bd4cd0e6509a1ee69d448c3c51b6fd","bodyHash":"24ecdb42127961a10aeba01f378e52fc8891d6e4c0a9cece23b275a7962232ce"}
 *
 * Go source:
 * func (p *Printer) emitNestedModuleName(node *ast.ModuleName) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ModuleName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitNestedModuleName(receiver: GoPtr<Printer>, node: GoPtr<ModuleName>): void {
  if (node === undefined) {
    return;
  }

  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierName(receiver, AsIdentifier(node));
      break;
    case KindStringLiteral:
      Printer_emitStringLiteral(receiver, AsStringLiteral(node));
      break;
    default:
      throw new globalThis.Error(`unexpected ModuleName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParametersForIndexSignature","kind":"method","status":"implemented","sigHash":"074d771f8f15b0a12c46672cb10c4d3b4dfc5f55d87e0ef7c32aba0573693b0a","bodyHash":"83c21d694e9d57e4d9f2c3827182712a0b9cca244fd5b681f6fd00c9587ed18f"}
 *
 * Go source:
 * func (p *Printer) emitParametersForIndexSignature(parentNode *ast.Node, parameters *ast.ParameterList) {
 * 	p.generateAllNames(parameters)
 * 	p.emitList((*Printer).emitParameterDeclarationNode, parentNode, parameters, LFIndexSignatureParameters)
 * }
 */
export function Printer_emitParametersForIndexSignature(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, parameters: GoPtr<ParameterList>): void {
  Printer_generateAllNames(receiver, parameters);
  Printer_emitList(receiver, Printer_emitParameterDeclarationNode, parentNode, parameters, LFIndexSignatureParameters);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitFunctionBody","kind":"method","status":"implemented","sigHash":"41e84308d37ac75da4d34c2415fb10f524032c324033742a2be61a4e547d247a","bodyHash":"a960d9ff7f1669159006e077ab2196287240d321604e565916d76f11e1e79647"}
 *
 * Go source:
 * func (p *Printer) emitFunctionBody(body *ast.Block) {
 * 	p.emitContext.AddEmitFlags(body.AsNode(), EFNoSourceMap)
 * 
 * 	// Use only notification hooks for the body block, not the full comment pipeline.
 * 	// Without this, trailing comments from the original method declaration
 * 	// (e.g., "// Error") leak into synthesized comma expressions when methods
 * 	// are hoisted into pending expressions.
 * 	if p.OnBeforeEmitNode != nil {
 * 		p.OnBeforeEmitNode(body.AsNode())
 * 	}
 * 
 * 	p.generateNames(body.AsNode())
 * 
 * 	// !!! Emit with comment after Strada migration
 * 	////p.emitTokenWithComment(ast.KindOpenBraceToken, body.Pos(), WriteKindPunctuation, body.AsNode())
 * 	p.writePunctuation("{")
 * 
 * 	p.increaseIndent()
 * 	detachedState := p.emitDetachedCommentsBeforeStatementList(body.AsNode(), body.Statements.Loc)
 * 	statementOffset := p.emitPrologueDirectives(body.Statements)
 * 	pos := p.writer.GetTextPos()
 * 	p.emitHelpers(body.AsNode())
 * 
 * 	if p.shouldEmitBlockFunctionBodyOnSingleLine(body) && statementOffset == 0 && pos == p.writer.GetTextPos() {
 * 		p.decreaseIndent()
 * 		p.emitListRange((*Printer).emitStatement, body.AsNode(), body.Statements, LFSingleLineFunctionBodyStatements, statementOffset, -1)
 * 		p.increaseIndent()
 * 	} else {
 * 		p.emitListRange((*Printer).emitStatement, body.AsNode(), body.Statements, LFMultiLineFunctionBodyStatements, statementOffset, -1)
 * 	}
 * 
 * 	p.emitDetachedCommentsAfterStatementList(body.AsNode(), body.Statements.Loc, detachedState)
 * 	p.decreaseIndent()
 * 
 * 	// !!! Emit comment after Strada migration
 * 	////p.emitTokenEx(ast.KindCloseBraceToken, body.Statements.End(), WriteKindPunctuation, body.AsNode(), tefNone)
 * 	p.emitTokenEx(ast.KindCloseBraceToken, body.Statements.End(), WriteKindPunctuation, body.AsNode(), tefNoComments)
 * 
 * 	if p.OnAfterEmitNode != nil {
 * 		p.OnAfterEmitNode(body.AsNode())
 * 	}
 * }
 */
export function Printer_emitFunctionBody(receiver: GoPtr<Printer>, body: GoPtr<Block>): void {
  EmitContext_AddEmitFlags(receiver!.emitContext, Node_AsNode(body), EFNoSourceMap);

  // Use only notification hooks for the body block, not the full comment pipeline.
  // Without this, trailing comments from the original method declaration
  // (e.g., "// Error") leak into synthesized comma expressions when methods
  // are hoisted into pending expressions.
  if (receiver!.__tsgoEmbedded0?.OnBeforeEmitNode !== undefined) {
    receiver!.__tsgoEmbedded0!.OnBeforeEmitNode(Node_AsNode(body));
  }

  Printer_generateNames(receiver, Node_AsNode(body));

  // !!! Emit with comment after Strada migration
  ////p.emitTokenWithComment(ast.KindOpenBraceToken, body.Pos(), WriteKindPunctuation, body.AsNode())
  Printer_writePunctuation(receiver, "{");

  Printer_increaseIndent(receiver);
  const detachedState = Printer_emitDetachedCommentsBeforeStatementList(receiver, Node_AsNode(body), body!.Statements!.Loc);
  const statementOffset = Printer_emitPrologueDirectives(receiver, body!.Statements);
  const pos = receiver!.writer.GetTextPos();
  Printer_emitHelpers(receiver, Node_AsNode(body));

  if (Printer_shouldEmitBlockFunctionBodyOnSingleLine(receiver, body) && statementOffset === 0 && pos === receiver!.writer.GetTextPos()) {
    Printer_decreaseIndent(receiver);
    Printer_emitListRange(receiver, Printer_emitStatement, Node_AsNode(body), body!.Statements, LFSingleLineFunctionBodyStatements, statementOffset, -1);
    Printer_increaseIndent(receiver);
  } else {
    Printer_emitListRange(receiver, Printer_emitStatement, Node_AsNode(body), body!.Statements, LFMultiLineFunctionBodyStatements, statementOffset, -1);
  }

  Printer_emitDetachedCommentsAfterStatementList(receiver, Node_AsNode(body), body!.Statements!.Loc, detachedState);
  Printer_decreaseIndent(receiver);

  // !!! Emit comment after Strada migration
  ////p.emitTokenEx(ast.KindCloseBraceToken, body.Statements.End(), WriteKindPunctuation, body.AsNode(), tefNone)
  Printer_emitTokenEx(receiver, KindCloseBraceToken, NodeList_End(body!.Statements), WriteKindPunctuation, Node_AsNode(body), tefNoComments);

  if (receiver!.__tsgoEmbedded0?.OnAfterEmitNode !== undefined) {
    receiver!.__tsgoEmbedded0!.OnAfterEmitNode(Node_AsNode(body));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitFunctionBodyNode","kind":"method","status":"implemented","sigHash":"f451b84cb3dc03b0cb4611ba20d7a1ff5537949f5c46020380f6de31f092aa95","bodyHash":"0c9f272dd29aacac8a93575f502c535fd44a386c8ac8708d2c3ce7a271dd6824"}
 *
 * Go source:
 * func (p *Printer) emitFunctionBodyNode(node *ast.BlockNode) {
 * 	if node == nil {
 * 		p.writeTrailingSemicolon()
 * 		return
 * 	}
 *
 * 	p.writeSpace()
 * 	p.emitFunctionBody(node.AsBlock())
 * }
 */
export function Printer_emitFunctionBodyNode(receiver: GoPtr<Printer>, node: GoPtr<BlockNode>): void {
  if (node === undefined) {
    Printer_writeTrailingSemicolon(receiver);
    return;
  }

  Printer_writeSpace(receiver);
  Printer_emitFunctionBody(receiver, AsBlock(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"7124b8f21397a5b131b57330f72b63a9bf1ad8c0030e06e9f6727dcdf94ce622","bodyHash":"7efbb3df5cccbb3b5b217f2aff388d19908c003e1eec10844b33a03491f33a91"}
 *
 * Go source:
 * func (p *Printer) emitClassStaticBlockDeclaration(node *ast.ClassStaticBlockDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("static")
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitFunctionBodyNode(node.Body)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitClassStaticBlockDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ClassStaticBlockDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_writeKeyword(receiver, "static");
  Printer_pushNameGenerationScope(receiver, Node_AsNode(node));
  Printer_emitFunctionBodyNode(receiver, node!.Body);
  Printer_popNameGenerationScope(receiver, Node_AsNode(node));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitClassElement","kind":"method","status":"implemented","sigHash":"35068c3d30aeb5f0d8a326f2e731427aa289f0ce6cc1215bb692d80aae87ae42","bodyHash":"efbe6ecc28b96425f4286a02f111a5c0609d7ddc1032b0b5269402f67b4bba95"}
 *
 * Go source:
 * func (p *Printer) emitClassElement(node *ast.ClassElement) {
 * 	switch node.Kind {
 * 	case ast.KindPropertyDeclaration:
 * 		p.emitPropertyDeclaration(node.AsPropertyDeclaration())
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
 * 	case ast.KindIndexSignature:
 * 		p.emitIndexSignature(node.AsIndexSignatureDeclaration())
 * 	case ast.KindSemicolonClassElement:
 * 		p.emitSemicolonClassElement(node.AsSemicolonClassElement())
 * 	case ast.KindNotEmittedStatement:
 * 		p.emitNotEmittedStatement(node.AsNotEmittedStatement())
 * 	case ast.KindJSTypeAliasDeclaration:
 * 		p.emitTypeAliasDeclaration(node.AsTypeAliasDeclaration())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected ClassElement: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitClassElement(receiver: GoPtr<Printer>, node: GoPtr<ClassElement>): void {
  switch (node!.Kind) {
    case KindPropertyDeclaration:
      Printer_emitPropertyDeclaration(receiver, AsPropertyDeclaration(node));
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
    case KindIndexSignature:
      Printer_emitIndexSignature(receiver, AsIndexSignatureDeclaration(node));
      break;
    case KindSemicolonClassElement:
      Printer_emitSemicolonClassElement(receiver, AsSemicolonClassElement(node));
      break;
    case KindNotEmittedStatement:
      Printer_emitNotEmittedStatement(receiver, AsNotEmittedStatement(node));
      break;
    case KindJSTypeAliasDeclaration:
      Printer_emitTypeAliasDeclaration(receiver, AsTypeAliasDeclaration(node));
      break;
    default:
      throw new globalThis.Error(`unexpected ClassElement: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSemicolonClassElement","kind":"method","status":"implemented","sigHash":"217d2fd99476d4d654a620681603c054219051375ba59efbfea64339b2a394a1","bodyHash":"ca9e9bb7db94ff4f935c88f3590e7bfe7eb9f1617a071407d78d1dd7120db7be"}
 *
 * Go source:
 * func (p *Printer) emitSemicolonClassElement(node *ast.SemicolonClassElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitSemicolonClassElement(receiver: GoPtr<Printer>, node: GoPtr<SemicolonClassElement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.isEmptyBlock","kind":"method","status":"implemented","sigHash":"eff297a81f000da369eff40d140f87acf453dd56ba69da3f19aaa744b8cff74b","bodyHash":"9320a6674c8d9db47100e7d3a75ab2a2a9ec0b0f1a79cb8c8e9213b62cf12243"}
 *
 * Go source:
 * func (p *Printer) isEmptyBlock(block *ast.Node, statements *ast.StatementList) bool {
 * 	return len(statements.Nodes) == 0 &&
 * 		(p.currentSourceFile == nil || rangeEndIsOnSameLineAsRangeStart(block.Loc, block.Loc, p.currentSourceFile))
 * }
 */
export function Printer_isEmptyBlock(receiver: GoPtr<Printer>, block: GoPtr<Node>, statements: GoPtr<StatementList>): bool {
  return (statements!.Nodes.length === 0 &&
    (receiver!.currentSourceFile === undefined || rangeEndIsOnSameLineAsRangeStart(block!.Loc, block!.Loc, receiver!.currentSourceFile))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBlock","kind":"method","status":"implemented","sigHash":"b3d707bd648cbb3e865e1386412ba33716854c9dc2622089251047fc6b9160ce","bodyHash":"f0de6f675c01019f2f977e3edc9f436b6502127283a055f681bcd5b463d451e6"}
 *
 * Go source:
 * func (p *Printer) emitBlock(node *ast.Block) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNames(node.AsNode())
 * 	p.emitToken(ast.KindOpenBraceToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 *
 * 	format := core.IfElse(!node.MultiLine && p.isEmptyBlock(node.AsNode(), node.Statements) || p.shouldEmitOnSingleLine(node.AsNode()),
 * 		LFSingleLineBlockStatements,
 * 		LFMultiLineBlockStatements)
 * 	p.emitList((*Printer).emitStatement, node.AsNode(), node.Statements, format)
 *
 * 	p.emitTokenEx(ast.KindCloseBraceToken, node.Statements.End(), WriteKindPunctuation, node.AsNode(), core.IfElse(format&LFMultiLine != 0, tefIndentLeadingComments, tefNone))
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitBlock(receiver: GoPtr<Printer>, node: GoPtr<Block>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_generateNames(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindOpenBraceToken, Node_Pos(node), WriteKindPunctuation, Node_AsNode(node));

  const format = IfElse(
    ((!node!.MultiLine && Printer_isEmptyBlock(receiver, Node_AsNode(node), node!.Statements)) || Printer_shouldEmitOnSingleLine(receiver, Node_AsNode(node))) as bool,
    LFSingleLineBlockStatements,
    LFMultiLineBlockStatements,
  );
  Printer_emitList(receiver, Printer_emitStatement, Node_AsNode(node), node!.Statements, format);

  Printer_emitTokenEx(receiver, KindCloseBraceToken, NodeList_End(node!.Statements), WriteKindPunctuation, Node_AsNode(node), IfElse(((format & LFMultiLine) !== 0) as bool, tefIndentLeadingComments, tefNone));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitVariableStatement","kind":"method","status":"implemented","sigHash":"775a290f9228df102b979a6ccf1ae2c46eb110d35453c59c5dcab95bf1c675b0","bodyHash":"774e85a1a61032f828ef9c3a40426298e73cbfa7771624c8c186bbc0ac93e0bc"}
 *
 * Go source:
 * func (p *Printer) emitVariableStatement(node *ast.VariableStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.emitVariableDeclarationList(node.DeclarationList.AsVariableDeclarationList())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitVariableStatement(receiver: GoPtr<Printer>, node: GoPtr<VariableStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  Printer_emitVariableDeclarationList(receiver, AsVariableDeclarationList(node!.DeclarationList));
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEmptyStatement","kind":"method","status":"implemented","sigHash":"11233e115df93a57b704b5ba3e68d6e5d5b48cc5751a6265e5bb5c0cdeef6e4a","bodyHash":"89a23838c52ada7e8ca431ccbea46b204f0c9340eae14b75a50ca059e8e84e02"}
 *
 * Go source:
 * func (p *Printer) emitEmptyStatement(node *ast.EmptyStatement, isEmbeddedStatement bool) {
 * 	state := p.enterNode(node.AsNode())
 *
 * 	// While most trailing semicolons are possibly insignificant, an embedded "empty"
 * 	// statement is significant and cannot be elided by a trailing-semicolon-omitting writer.
 * 	if isEmbeddedStatement {
 * 		p.writePunctuation(";")
 * 	} else {
 * 		p.writeTrailingSemicolon()
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitEmptyStatement(receiver: GoPtr<Printer>, node: GoPtr<EmptyStatement>, isEmbeddedStatement: bool): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));

  // While most trailing semicolons are possibly insignificant, an embedded "empty"
  // statement is significant and cannot be elided by a trailing-semicolon-omitting writer.
  if (isEmbeddedStatement) {
    Printer_writePunctuation(receiver, ";");
  } else {
    Printer_writeTrailingSemicolon(receiver);
  }
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIfStatement","kind":"method","status":"implemented","sigHash":"62a78529edfec8c8feced444c3f97f5883e0e8a358510415a8beae0708c38c66","bodyHash":"de4e06c37ef83bb641b8a4ed2ce795599d3fc10c57a17366b8309c20d412ec38"}
 *
 * Go source:
 * func (p *Printer) emitIfStatement(node *ast.IfStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindIfKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.ThenStatement)
 * 	if node.ElseStatement != nil {
 * 		p.writeLineOrSpace(node.AsNode(), node.ThenStatement, node.ElseStatement)
 * 		p.emitToken(ast.KindElseKeyword, node.ThenStatement.End(), WriteKindKeyword, node.AsNode())
 * 		if node.ElseStatement.Kind == ast.KindIfStatement {
 * 			p.writeSpace()
 * 			p.emitIfStatement(node.ElseStatement.AsIfStatement())
 * 		} else {
 * 			p.emitEmbeddedStatement(node.AsNode(), node.ElseStatement)
 * 		}
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIfStatement(receiver: GoPtr<Printer>, node: GoPtr<IfStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindIfKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.Expression), WriteKindPunctuation, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.ThenStatement);
  if (node!.ElseStatement !== undefined) {
    Printer_writeLineOrSpace(receiver, Node_AsNode(node), node!.ThenStatement, node!.ElseStatement);
    Printer_emitToken(receiver, KindElseKeyword, Node_End(node!.ThenStatement), WriteKindKeyword, Node_AsNode(node));
    if (node!.ElseStatement!.Kind === KindIfStatement) {
      Printer_writeSpace(receiver);
      Printer_emitIfStatement(receiver, AsIfStatement(node!.ElseStatement));
    } else {
      Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.ElseStatement);
    }
  }
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitWhileClause","kind":"method","status":"implemented","sigHash":"ef462c7afdbd8fca61e55c2cd7805eb84c1979efa4a220eb5444505260147ad0","bodyHash":"ee414d36a0ac4e292d154ed8b2398887f15698114512b3d795d983dcca2c9b44"}
 *
 * Go source:
 * func (p *Printer) emitWhileClause(node *ast.Node, expression *ast.Expression, startPos int) {
 * 	pos := p.emitToken(ast.KindWhileKeyword, startPos, WriteKindKeyword, node)
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node)
 * 	p.emitExpression(expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, expression.End(), WriteKindPunctuation, node)
 * }
 */
export function Printer_emitWhileClause(receiver: GoPtr<Printer>, node: GoPtr<Node>, expression: GoPtr<Expression>, startPos: int): void {
  const pos = Printer_emitToken(receiver, KindWhileKeyword, startPos, WriteKindKeyword, node);
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, node);
  Printer_emitExpression(receiver, expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(expression), WriteKindPunctuation, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDoStatement","kind":"method","status":"implemented","sigHash":"9504075cdacc0e1fa05d58c3ab5d7d8e7c8970e1d1c958573e168831879b4c4a","bodyHash":"eee2abdd94401aabff0db3740fc26bbca63f13300954780906a6d75f06d8e7a0"}
 *
 * Go source:
 * func (p *Printer) emitDoStatement(node *ast.DoStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindDoKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	if ast.IsBlock(node.Statement) && !p.Options.PreserveSourceNewlines {
 * 		p.writeSpace()
 * 	} else {
 * 		p.writeLineOrSpace(node.AsNode(), node.Statement, node.Expression)
 * 	}
 *
 * 	p.emitWhileClause(node.AsNode(), node.Expression, node.Statement.End())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitDoStatement(receiver: GoPtr<Printer>, node: GoPtr<DoStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindDoKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  if (IsBlock(node!.Statement) && !receiver!.Options.PreserveSourceNewlines) {
    Printer_writeSpace(receiver);
  } else {
    Printer_writeLineOrSpace(receiver, Node_AsNode(node), node!.Statement, node!.Expression);
  }

  Printer_emitWhileClause(receiver, Node_AsNode(node), node!.Expression, Node_End(node!.Statement));
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitWhileStatement","kind":"method","status":"implemented","sigHash":"d2927bf3129cb881952c9a21cf67339b1bdc53b7dad46db38c0cbbd91d6511ab","bodyHash":"7f7f5d5c0121639b381bb05f77554244e1e18cbaa24637639da0b2da6aca65c0"}
 *
 * Go source:
 * func (p *Printer) emitWhileStatement(node *ast.WhileStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitWhileClause(node.AsNode(), node.Expression, node.Pos())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitWhileStatement(receiver: GoPtr<Printer>, node: GoPtr<WhileStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitWhileClause(receiver, Node_AsNode(node), node!.Expression, Node_Pos(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitForInitializer","kind":"method","status":"implemented","sigHash":"50e3d774097539be7d40de12140515f964b554edb02d56ea314aa3705f58398b","bodyHash":"383e3eef769bc476cb35d800bf7d436813fec71cf15d4300a3478b22ba600e8e"}
 *
 * Go source:
 * func (p *Printer) emitForInitializer(node *ast.ForInitializer) {
 * 	if node.Kind == ast.KindVariableDeclarationList {
 * 		p.emitVariableDeclarationList(node.AsVariableDeclarationList())
 * 	} else {
 * 		p.emitExpression(node, ast.OperatorPrecedenceLowest)
 * 	}
 * }
 */
export function Printer_emitForInitializer(receiver: GoPtr<Printer>, node: GoPtr<ForInitializer>): void {
  if (node!.Kind === KindVariableDeclarationList) {
    Printer_emitVariableDeclarationList(receiver, AsVariableDeclarationList(node));
  } else {
    Printer_emitExpression(receiver, node, OperatorPrecedenceLowest);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitForStatement","kind":"method","status":"implemented","sigHash":"3c62848e3169e823d1644fa9de2afda7c7c10baa7526b2f2d52d86767264c4ea","bodyHash":"40656a571ea08b52b9b5a76b3ba0eddce7a9d8f99aa0dbe383f7555bbbaaf4c5"}
 *
 * Go source:
 * func (p *Printer) emitForStatement(node *ast.ForStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindForKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	pos = p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	if node.Initializer != nil {
 * 		p.emitForInitializer(node.Initializer)
 * 		pos = node.Initializer.End()
 * 	}
 * 	pos = p.emitToken(ast.KindSemicolonToken, pos, WriteKindPunctuation, node.AsNode())
 * 	if node.Condition != nil {
 * 		p.writeSpace()
 * 		p.emitExpression(node.Condition, ast.OperatorPrecedenceLowest)
 * 		pos = node.Condition.End()
 * 	}
 * 	pos = p.emitToken(ast.KindSemicolonToken, pos, WriteKindPunctuation, node.AsNode())
 * 	if node.Incrementor != nil {
 * 		p.writeSpace()
 * 		p.emitExpression(node.Incrementor, ast.OperatorPrecedenceLowest)
 * 		pos = node.Incrementor.End()
 * 	}
 * 	p.emitToken(ast.KindCloseParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitForStatement(receiver: GoPtr<Printer>, node: GoPtr<ForStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  let pos = Printer_emitToken(receiver, KindForKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  pos = Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  if (node!.Initializer !== undefined) {
    Printer_emitForInitializer(receiver, node!.Initializer);
    pos = Node_End(node!.Initializer);
  }
  pos = Printer_emitToken(receiver, KindSemicolonToken, pos, WriteKindPunctuation, Node_AsNode(node));
  if (node!.Condition !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitExpression(receiver, node!.Condition, OperatorPrecedenceLowest);
    pos = Node_End(node!.Condition);
  }
  pos = Printer_emitToken(receiver, KindSemicolonToken, pos, WriteKindPunctuation, Node_AsNode(node));
  if (node!.Incrementor !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitExpression(receiver, node!.Incrementor, OperatorPrecedenceLowest);
    pos = Node_End(node!.Incrementor);
  }
  Printer_emitToken(receiver, KindCloseParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitForInStatement","kind":"method","status":"implemented","sigHash":"33bd4c3b4283e098f228b50abd6d96b9cf6baa9ed035ceb9ea21ebd15eaabda9","bodyHash":"dbe656135c007d489070a14ded5b44751eaefbf7dc4ec9cda4558745078e9efc"}
 *
 * Go source:
 * func (p *Printer) emitForInStatement(node *ast.ForInOrOfStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindForKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	p.emitForInitializer(node.Initializer)
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindInKeyword, node.Initializer.End(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitForInStatement(receiver: GoPtr<Printer>, node: GoPtr<ForInOrOfStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindForKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitForInitializer(receiver, node!.Initializer);
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindInKeyword, Node_End(node!.Initializer), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.Expression), WriteKindPunctuation, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitForOfStatement","kind":"method","status":"implemented","sigHash":"94ad354346278efda45bfb369e30353eaf1803d2458e111f073c1768e5002f0c","bodyHash":"915c9d3eb8a82d992f810e243e8877d6192bf57e198b8f957cc7cfa75d6bd0d6"}
 *
 * Go source:
 * func (p *Printer) emitForOfStatement(node *ast.ForInOrOfStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	openParenPos := p.emitToken(ast.KindForKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if node.AwaitModifier != nil {
 * 		p.emitKeywordNode(node.AwaitModifier)
 * 		p.writeSpace()
 * 	}
 * 	p.emitToken(ast.KindOpenParenToken, openParenPos, WriteKindPunctuation, node.AsNode())
 * 	p.emitForInitializer(node.Initializer)
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOfKeyword, node.Initializer.End(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitForOfStatement(receiver: GoPtr<Printer>, node: GoPtr<ForInOrOfStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const openParenPos = Printer_emitToken(receiver, KindForKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  if (node!.AwaitModifier !== undefined) {
    Printer_emitKeywordNode(receiver, node!.AwaitModifier);
    Printer_writeSpace(receiver);
  }
  Printer_emitToken(receiver, KindOpenParenToken, openParenPos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitForInitializer(receiver, node!.Initializer);
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOfKeyword, Node_End(node!.Initializer), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.Expression), WriteKindPunctuation, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitContinueStatement","kind":"method","status":"implemented","sigHash":"b611bc69ad0fd8430dda12257bc0180f14137896a56d8c4fb153d2f9ae006e1c","bodyHash":"176cb56dccee996812498961962b71ad6401eacfb71b7c8e91b1d147ca0ee18a"}
 *
 * Go source:
 * func (p *Printer) emitContinueStatement(node *ast.ContinueStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindContinueKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	if node.Label != nil {
 * 		p.writeSpace()
 * 		p.emitLabelIdentifier(node.Label.AsIdentifier())
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitContinueStatement(receiver: GoPtr<Printer>, node: GoPtr<ContinueStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindContinueKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  if (node!.Label !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitLabelIdentifier(receiver, AsIdentifier(node!.Label));
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBreakStatement","kind":"method","status":"implemented","sigHash":"ef00920c8ccf75e859e370234a19c598997e2a32d0fc5d88f7025e5dc041bc50","bodyHash":"b39d02d5abc7fc3e1e9efa83b288540d3740eb88af59c7f233a48f12e9425022"}
 *
 * Go source:
 * func (p *Printer) emitBreakStatement(node *ast.BreakStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindBreakKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	if node.Label != nil {
 * 		p.writeSpace()
 * 		p.emitLabelIdentifier(node.Label.AsIdentifier())
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitBreakStatement(receiver: GoPtr<Printer>, node: GoPtr<BreakStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindBreakKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  if (node!.Label !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitLabelIdentifier(receiver, AsIdentifier(node!.Label));
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitReturnStatement","kind":"method","status":"implemented","sigHash":"5907b03df4f1229ba5af7c779b94b471359a4f44abb156e9e215c875b57271d2","bodyHash":"b89a4f04c211660d742413754046deebb4f2fc1e9046bd9d77d9a406681e82bf"}
 *
 * Go source:
 * func (p *Printer) emitReturnStatement(node *ast.ReturnStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindReturnKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	if node.Expression != nil {
 * 		p.writeSpace()
 * 		p.emitExpressionNoASI(node.Expression, ast.OperatorPrecedenceLowest)
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitReturnStatement(receiver: GoPtr<Printer>, node: GoPtr<ReturnStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindReturnKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  if (node!.Expression !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitExpressionNoASI(receiver, node!.Expression, OperatorPrecedenceLowest);
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitWithStatement","kind":"method","status":"implemented","sigHash":"5bfd484de3dbf5a4ad134d950392afe84c0198a13c1695d58c54d923ca978250","bodyHash":"0191f00b91f7b9a5e4c97ac1d7738454159c3d0f2155501895ea4810b60d9299"}
 *
 * Go source:
 * func (p *Printer) emitWithStatement(node *ast.WithStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindWithKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitWithStatement(receiver: GoPtr<Printer>, node: GoPtr<WithStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindWithKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.Expression), WriteKindPunctuation, Node_AsNode(node));
  Printer_emitEmbeddedStatement(receiver, Node_AsNode(node), node!.Statement);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSwitchStatement","kind":"method","status":"implemented","sigHash":"aace42f8f092b668337c3e6f2714266973d265d70420abf123a6ee958e10f0ac","bodyHash":"73d0719877b99311f4ff323fd6dab94dda3b3593b37a678b96928e63e2b2089a"}
 *
 * Go source:
 * func (p *Printer) emitSwitchStatement(node *ast.SwitchStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindSwitchKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindOpenParenToken, pos, WriteKindPunctuation, node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.emitToken(ast.KindCloseParenToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitCaseBlock(node.CaseBlock.AsCaseBlock())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitSwitchStatement(receiver: GoPtr<Printer>, node: GoPtr<SwitchStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindSwitchKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindOpenParenToken, pos, WriteKindPunctuation, Node_AsNode(node));
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.Expression), WriteKindPunctuation, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitCaseBlock(receiver, AsCaseBlock(node!.CaseBlock));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLabeledStatement","kind":"method","status":"implemented","sigHash":"3d11284ad4c1a8e0c0219e8cb1d34670dd2cd06f8dd554ba173135b2639b0f8d","bodyHash":"728098641d6258b95e81f0725e851fa444c64175df0424b21fdcb64c84dfd5f3"}
 *
 * Go source:
 * func (p *Printer) emitLabeledStatement(node *ast.LabeledStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLabelIdentifier(node.Label.AsIdentifier())
 * 	p.emitToken(ast.KindColonToken, node.Label.End(), WriteKindPunctuation, node.AsNode())
 *
 * 	// TODO: use emitEmbeddedStatement rather than writeSpace/emitStatement here after Strada migration as it is
 * 	//       more consistent with similar emit elsewhere. writeSpace/emitStatement is used here to reduce spurious
 * 	//       diffs when testing the Strada migration.
 * 	////p.emitEmbeddedStatement(node.AsNode(), node.Statement)
 *
 * 	p.writeSpace()
 * 	p.emitStatement(node.Statement)
 *
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitLabeledStatement(receiver: GoPtr<Printer>, node: GoPtr<LabeledStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitLabelIdentifier(receiver, AsIdentifier(node!.Label));
  Printer_emitToken(receiver, KindColonToken, Node_End(node!.Label), WriteKindPunctuation, Node_AsNode(node));

  // TODO: use emitEmbeddedStatement rather than writeSpace/emitStatement here after Strada migration as it is
  //       more consistent with similar emit elsewhere. writeSpace/emitStatement is used here to reduce spurious
  //       diffs when testing the Strada migration.
  ////p.emitEmbeddedStatement(node.AsNode(), node.Statement)

  Printer_writeSpace(receiver);
  Printer_emitStatement(receiver, node!.Statement);

  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitThrowStatement","kind":"method","status":"implemented","sigHash":"93a63fe05c923fbb02698bbd4b72bc5790a0a36bbd819f80effd26252e31d39e","bodyHash":"a50d57a310a176ac9851bb7db9f9e43d30789b144fe26ab2a729b8f774df1f2d"}
 *
 * Go source:
 * func (p *Printer) emitThrowStatement(node *ast.ThrowStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindThrowKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpressionNoASI(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitThrowStatement(receiver: GoPtr<Printer>, node: GoPtr<ThrowStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindThrowKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitExpressionNoASI(receiver, node!.Expression, OperatorPrecedenceLowest);
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTryStatement","kind":"method","status":"implemented","sigHash":"7d58c3c86aa5a9b4b9e7bf95c5ab1ad45dda578503e3787ac2ff68dc3ba3d79f","bodyHash":"9fdee6869cd689fe0a5239d1383aa67074fb7408c51c3adfa334da3f6c699046"}
 *
 * Go source:
 * func (p *Printer) emitTryStatement(node *ast.TryStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindTryKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitBlock(node.TryBlock.AsBlock())
 * 	if node.CatchClause != nil {
 * 		p.writeLineOrSpace(node.AsNode(), node.TryBlock, node.CatchClause)
 * 		p.emitCatchClause(node.CatchClause.AsCatchClause())
 * 	}
 * 	if node.FinallyBlock != nil {
 * 		p.writeLineOrSpace(node.AsNode(), core.Coalesce(node.CatchClause, node.TryBlock), node.FinallyBlock)
 * 		p.emitToken(ast.KindFinallyKeyword, core.Coalesce(node.CatchClause, node.TryBlock).End(), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 		p.emitBlock(node.FinallyBlock.AsBlock())
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTryStatement(receiver: GoPtr<Printer>, node: GoPtr<TryStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindTryKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitBlock(receiver, AsBlock(node!.TryBlock));
  if (node!.CatchClause !== undefined) {
    Printer_writeLineOrSpace(receiver, Node_AsNode(node), node!.TryBlock, node!.CatchClause);
    Printer_emitCatchClause(receiver, AsCatchClause(node!.CatchClause));
  }
  if (node!.FinallyBlock !== undefined) {
    Printer_writeLineOrSpace(receiver, Node_AsNode(node), Coalesce(node!.CatchClause, node!.TryBlock), node!.FinallyBlock);
    Printer_emitToken(receiver, KindFinallyKeyword, Node_End(Coalesce(node!.CatchClause, node!.TryBlock)), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
    Printer_emitBlock(receiver, AsBlock(node!.FinallyBlock));
  }
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDebuggerStatement","kind":"method","status":"implemented","sigHash":"f683271707d150d6a26f74ac4bc4698feb07b7ce1dcac0e713e4a78d61a805be","bodyHash":"50d4ea1a1c4a5ff34c7ac0f4ec8634e65f8a877bbc183b9aca3fe3f3a774bf56"}
 *
 * Go source:
 * func (p *Printer) emitDebuggerStatement(node *ast.DebuggerStatement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindDebuggerKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitDebuggerStatement(receiver: GoPtr<Printer>, node: GoPtr<DebuggerStatement>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindDebuggerKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNotEmittedStatement","kind":"method","status":"implemented","sigHash":"e61cc963a7948f5239f234a9c87240e91fd8530fb42da4b4573e5b39b192f056","bodyHash":"101908a59d206929123c939340eca5b8fdddc159b4e9fce063d655a637fdcbaa"}
 *
 * Go source:
 * func (p *Printer) emitNotEmittedStatement(node *ast.NotEmittedStatement) {
 * 	p.exitNode(node.AsNode(), p.enterNode(node.AsNode()))
 * }
 */
export function Printer_emitNotEmittedStatement(receiver: GoPtr<Printer>, node: GoPtr<NotEmittedStatement>): void {
  Printer_exitNode(receiver, Node_AsNode(node), Printer_enterNode(receiver, Node_AsNode(node)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitVariableDeclaration","kind":"method","status":"implemented","sigHash":"7c4991870899483ee91a82bfd119d07d34e4722c01da553e191260c730b5d3c4","bodyHash":"f80a67fdf075db24ff73cd1ee707a929ac1e7f5a82949ebea1625d9fbc6ffb4c"}
 *
 * Go source:
 * func (p *Printer) emitVariableDeclaration(node *ast.VariableDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitBindingName(node.Name())
 * 	p.emitPunctuationNode(node.ExclamationToken)
 * 	p.emitTypeAnnotation(node.Type)
 * 	p.emitInitializer(node.Initializer, greatestEnd(node.Name().End(), node.Type, p.emitContext.GetTypeNode(node.Name())), node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitVariableDeclaration(receiver: GoPtr<Printer>, node: GoPtr<VariableDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitBindingName(receiver, Node_Name(node));
  Printer_emitPunctuationNode(receiver, node!.ExclamationToken);
  Printer_emitTypeAnnotation(receiver, node!.Type);
  Printer_emitInitializer(receiver, node!.Initializer, greatestEnd(Node_End(Node_Name(node)), node!.Type as unknown as { End: () => int }, EmitContext_GetTypeNode(receiver!.emitContext, Node_Name(node)) as unknown as { End: () => int }), Node_AsNode(node));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitVariableDeclarationNode","kind":"method","status":"implemented","sigHash":"adbf573d44cf2dc624ebb7a46204761e6c16e5c3d66f2959ae20c2826c21997b","bodyHash":"d20f67851b1d072805828b0817aaa766e22a60390ed895dac648cc8e361804e9"}
 *
 * Go source:
 * func (p *Printer) emitVariableDeclarationNode(node *ast.VariableDeclarationNode) {
 * 	p.emitVariableDeclaration(node.AsVariableDeclaration())
 * }
 */
export function Printer_emitVariableDeclarationNode(receiver: GoPtr<Printer>, node: GoPtr<VariableDeclarationNode>): void {
  Printer_emitVariableDeclaration(receiver, AsVariableDeclaration(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitVariableDeclarationList","kind":"method","status":"implemented","sigHash":"e776c666dbf448c561c80143ee736e5f619e43abd8b60bf9d24e3df5134a6b6f","bodyHash":"24f540e5f1605faf4301649d61d2aeed79781c1f1412ecb4dcfdec71558a32ed"}
 *
 * Go source:
 * func (p *Printer) emitVariableDeclarationList(node *ast.VariableDeclarationList) {
 * 	state := p.enterNode(node.AsNode())
 * 	switch {
 * 	case ast.IsVarLet(node.AsNode()):
 * 		p.writeKeyword("let")
 * 	case ast.IsVarConst(node.AsNode()):
 * 		p.writeKeyword("const")
 * 	case ast.IsVarUsing(node.AsNode()):
 * 		p.writeKeyword("using")
 * 	case ast.IsVarAwaitUsing(node.AsNode()):
 * 		p.writeKeyword("await")
 * 		p.writeSpace()
 * 		p.writeKeyword("using")
 * 	default:
 * 		p.writeKeyword("var")
 * 	}
 * 	p.writeSpace()
 * 	p.emitList((*Printer).emitVariableDeclarationNode, node.AsNode(), node.Declarations, LFVariableDeclarationList)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitVariableDeclarationList(receiver: GoPtr<Printer>, node: GoPtr<VariableDeclarationList>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  if (IsVarLet(Node_AsNode(node))) {
    Printer_writeKeyword(receiver, "let");
  } else if (IsVarConst(Node_AsNode(node))) {
    Printer_writeKeyword(receiver, "const");
  } else if (IsVarUsing(Node_AsNode(node))) {
    Printer_writeKeyword(receiver, "using");
  } else if (IsVarAwaitUsing(Node_AsNode(node))) {
    Printer_writeKeyword(receiver, "await");
    Printer_writeSpace(receiver);
    Printer_writeKeyword(receiver, "using");
  } else {
    Printer_writeKeyword(receiver, "var");
  }
  Printer_writeSpace(receiver);
  Printer_emitList(receiver, Printer_emitVariableDeclarationNode, Node_AsNode(node), node!.Declarations, LFVariableDeclarationList);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"7174c9f869d98c795c8c16ea86d99fc8590897256ffe9aaf7af61e39a5861216","bodyHash":"c0efbd08ddc44cf84f15865b0e09868a4f401498c4b2d99a4e114878ebb462a0"}
 *
 * Go source:
 * func (p *Printer) emitFunctionDeclaration(node *ast.FunctionDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNameIfNeeded(node.Name())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("function")
 * 	p.emitTokenNode(node.AsteriskToken)
 * 	p.writeSpace()
 * 	if name := node.Name(); name != nil {
 * 		p.emitIdentifierName(name.AsIdentifier())
 * 	}
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
export function Printer_emitFunctionDeclaration(receiver: GoPtr<Printer>, node: GoPtr<FunctionDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_generateNameIfNeeded(receiver, Node_Name(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  Printer_writeKeyword(receiver, "function");
  Printer_emitTokenNode(receiver, node!.AsteriskToken);
  Printer_writeSpace(receiver);
  const name = Node_Name(node);
  if (name !== undefined) {
    Printer_emitIdentifierName(receiver, AsIdentifier(name));
  }
  const indented = Printer_shouldEmitIndented(receiver, Node_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, Node_AsNode(node));
  Printer_emitSignature(receiver, Node_AsNode(node));
  Printer_emitFunctionBodyNode(receiver, node!.Body);
  Printer_popNameGenerationScope(receiver, Node_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitClassDeclaration","kind":"method","status":"implemented","sigHash":"5fd7fdbe17b33f40f341b27d1b20505dd0bf880a526e1353795290d69cc93053","bodyHash":"2b3c369fa442d62301fc67c41e44c5f0c7415bba3a73a50324c6c356fa6de0f2"}
 *
 * Go source:
 * func (p *Printer) emitClassDeclaration(node *ast.ClassDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNameIfNeeded(node.Name())
 * 	pos := p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitToken(ast.KindClassKeyword, pos, WriteKindKeyword, node.AsNode())
 * 	if node.Name() != nil {
 * 		p.writeSpace()
 * 		p.emitIdentifierName(node.Name().AsIdentifier())
 * 	}
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitList((*Printer).emitHeritageClauseNode, node.AsNode(), node.HeritageClauses, LFClassHeritageClauses)
 * 	p.writeSpace()
 * 	p.writePunctuation("{")
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllMemberNames(node.Members)
 * 	p.emitList((*Printer).emitClassElement, node.AsNode(), node.Members, LFClassMembers)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.writePunctuation("}")
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitClassDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ClassDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_generateNameIfNeeded(receiver, Node_Name(node));
  const pos = Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), true as bool);
  Printer_emitToken(receiver, KindClassKeyword, pos, WriteKindKeyword, Node_AsNode(node));
  if (Node_Name(node) !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitIdentifierName(receiver, AsIdentifier(Node_Name(node)));
  }
  const indented = Printer_shouldEmitIndented(receiver, Node_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_emitTypeParameters(receiver, Node_AsNode(node), node!.TypeParameters);
  Printer_emitList(receiver, Printer_emitHeritageClauseNode, Node_AsNode(node), node!.HeritageClauses, LFClassHeritageClauses);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "{");
  Printer_pushNameGenerationScope(receiver, Node_AsNode(node));
  Printer_generateAllMemberNames(receiver, node!.Members);
  Printer_emitList(receiver, Printer_emitClassElement, Node_AsNode(node), node!.Members, LFClassMembers);
  Printer_popNameGenerationScope(receiver, Node_AsNode(node));
  Printer_writePunctuation(receiver, "}");
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"0094f569bdfb09b0bb57f72bb630b256eecbe4608f1fcf2ddfb5dae92e22abd6","bodyHash":"f8cc46eae6eb15b0e593f76d0de013e8751859d3f881e7cc74a48e4caee24d72"}
 *
 * Go source:
 * func (p *Printer) emitInterfaceDeclaration(node *ast.InterfaceDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("interface")
 * 	p.writeSpace()
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitList((*Printer).emitHeritageClauseNode, node.AsNode(), node.HeritageClauses, LFHeritageClauses)
 * 	p.writeSpace()
 * 	p.writePunctuation("{")
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllMemberNames(node.Members)
 * 	p.emitList((*Printer).emitTypeElement, node.AsNode(), node.Members, LFInterfaceMembers)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitInterfaceDeclaration(receiver: GoPtr<Printer>, node: GoPtr<InterfaceDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  Printer_writeKeyword(receiver, "interface");
  Printer_writeSpace(receiver);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_emitTypeParameters(receiver, Node_AsNode(node), node!.TypeParameters);
  Printer_emitList(receiver, Printer_emitHeritageClauseNode, Node_AsNode(node), node!.HeritageClauses, LFHeritageClauses);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "{");
  Printer_pushNameGenerationScope(receiver, Node_AsNode(node));
  Printer_generateAllMemberNames(receiver, node!.Members);
  Printer_emitList(receiver, Printer_emitTypeElement, Node_AsNode(node), node!.Members, LFInterfaceMembers);
  Printer_popNameGenerationScope(receiver, Node_AsNode(node));
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEnumDeclaration","kind":"method","status":"implemented","sigHash":"70d31a6f9230c5c40b0484a8e684d4819714c0c8f9d20f5a316cd370c9a07b83","bodyHash":"f0a6eae642a2333ff906b60b2ed7aad814ec8f1ce8f6f4fc687ab06511d1fa96"}
 *
 * Go source:
 * func (p *Printer) emitEnumDeclaration(node *ast.EnumDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("enum")
 * 	p.writeSpace()
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.writeSpace()
 * 	p.writePunctuation("{")
 * 	p.emitList((*Printer).emitEnumMemberNode, node.AsNode(), node.Members, LFEnumMembers)
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitEnumDeclaration(receiver: GoPtr<Printer>, node: GoPtr<EnumDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  Printer_writeKeyword(receiver, "enum");
  Printer_writeSpace(receiver);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "{");
  Printer_emitList(receiver, Printer_emitEnumMemberNode, Node_AsNode(node), node!.Members, LFEnumMembers);
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModuleDeclaration","kind":"method","status":"implemented","sigHash":"f295e0f83814f1977fdb8acaaaa047bae0c5ae5c30f10b9aefeaabb8354e873b","bodyHash":"bd58260dd80740ed44139e51b7233650e6c14fab569cfabae7f55c5fd1888995"}
 *
 * Go source:
 * func (p *Printer) emitModuleDeclaration(node *ast.ModuleDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	if node.Keyword != ast.KindGlobalKeyword {
 * 		p.writeKeyword(core.IfElse(node.Keyword == ast.KindNamespaceKeyword, "namespace", "module"))
 * 		p.writeSpace()
 * 	}
 * 	p.emitModuleName(node.Name())
 * 	body := node.Body
 * 	for body != nil && ast.IsModuleDeclaration(body) {
 * 		module := body.AsModuleDeclaration()
 * 		p.writePunctuation(".")
 * 		p.emitNestedModuleName(module.Name())
 * 		body = module.Body
 * 	}
 * 	if body == nil {
 * 		p.writeTrailingSemicolon()
 * 	} else {
 * 		p.writeSpace()
 * 		p.emitModuleBlock(body.AsModuleBlock())
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitModuleDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ModuleDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  if (node!.Keyword !== KindGlobalKeyword) {
    Printer_writeKeyword(receiver, IfElse((node!.Keyword === KindNamespaceKeyword) as bool, "namespace", "module"));
    Printer_writeSpace(receiver);
  }
  Printer_emitModuleName(receiver, Node_Name(node));
  const processBody = (body: GoPtr<Node>): GoPtr<Node> => {
    if (body === undefined || !IsModuleDeclaration(body)) return body;
    const module = AsModuleDeclaration(body);
    Printer_writePunctuation(receiver, ".");
    Printer_emitNestedModuleName(receiver, Node_Name(module));
    return processBody(module!.Body);
  };
  const finalBody = processBody(node!.Body);
  if (finalBody === undefined) {
    Printer_writeTrailingSemicolon(receiver);
  } else {
    Printer_writeSpace(receiver);
    Printer_emitModuleBlock(receiver, AsModuleBlock(finalBody));
  }
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModuleBlock","kind":"method","status":"implemented","sigHash":"b2e0a92c069dfa074425474d4deb89fd3dbffb303aab704c6989b9b36615dd1f","bodyHash":"18a2d202204a622cfdf1c51be74ad6a58e5b2c906fcb1659d7ae51ce3e098961"}
 *
 * Go source:
 * func (p *Printer) emitModuleBlock(node *ast.ModuleBlock) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNames(node.AsNode())
 * 	p.emitToken(ast.KindOpenBraceToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	format := core.IfElse(p.isEmptyBlock(node.AsNode(), node.Statements) || p.shouldEmitOnSingleLine(node.AsNode()),
 * 		LFSingleLineBlockStatements,
 * 		LFMultiLineBlockStatements)
 * 	p.emitList((*Printer).emitStatement, node.AsNode(), node.Statements, format)
 * 	p.emitTokenEx(ast.KindCloseBraceToken, node.Statements.End(), WriteKindPunctuation, node.AsNode(), core.IfElse(format&LFMultiLine != 0, tefIndentLeadingComments, tefNone))
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitModuleBlock(receiver: GoPtr<Printer>, node: GoPtr<ModuleBlock>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_generateNames(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindOpenBraceToken, Node_Pos(node), WriteKindPunctuation, Node_AsNode(node));
  const format = (Printer_isEmptyBlock(receiver, Node_AsNode(node), node!.Statements) || Printer_shouldEmitOnSingleLine(receiver, Node_AsNode(node)))
    ? LFSingleLineBlockStatements
    : LFMultiLineBlockStatements;
  Printer_emitList(receiver, Printer_emitStatement, Node_AsNode(node), node!.Statements, format);
  Printer_emitTokenEx(receiver, KindCloseBraceToken, NodeList_End(node!.Statements), WriteKindPunctuation, Node_AsNode(node), ((format & LFMultiLine) !== 0 ? tefIndentLeadingComments : tefNone));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCaseBlock","kind":"method","status":"implemented","sigHash":"70293f394a83592ab77a5602c2c10b02de3b16ad19192ecfc2bb518242840949","bodyHash":"d4cd2031c7b7be032c7a1efab651c8c5bbf25db482f3aebb615f004e63eb5951"}
 *
 * Go source:
 * func (p *Printer) emitCaseBlock(node *ast.CaseBlock) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindOpenBraceToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	p.emitList((*Printer).emitCaseOrDefaultClauseNode, node.AsNode(), node.Clauses, LFCaseBlockClauses)
 * 	p.emitTokenEx(ast.KindCloseBraceToken, node.Clauses.End(), WriteKindPunctuation, node.AsNode(), tefIndentLeadingComments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitCaseBlock(receiver: GoPtr<Printer>, node: GoPtr<CaseBlock>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, KindOpenBraceToken, Node_Pos(node), WriteKindPunctuation, Node_AsNode(node));
  Printer_emitList(receiver, Printer_emitCaseOrDefaultClauseNode, Node_AsNode(node), node!.Clauses, LFCaseBlockClauses);
  Printer_emitTokenEx(receiver, KindCloseBraceToken, NodeList_End(node!.Clauses), WriteKindPunctuation, Node_AsNode(node), tefIndentLeadingComments);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"f3c3c87915229b94b16ac140a94841c0f65b142c7b7fa315a6cf53152bbc9c46","bodyHash":"3016de10a5fb1d8464a6d198cfa6f5b59f337abb4b440fee1302bd75cdd3cc97"}
 *
 * Go source:
 * func (p *Printer) emitImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	pos := p.emitToken(ast.KindImportKeyword, greatestEnd(node.Pos(), node.Modifiers()), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if node.IsTypeOnly {
 * 		p.emitToken(ast.KindTypeKeyword, pos, WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindEqualsToken, node.Name().End(), WriteKindPunctuation, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitModuleReference(node.ModuleReference)
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportEqualsDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ImportEqualsDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  let pos = Printer_emitToken(receiver, KindImportKeyword, greatestEnd(Node_Pos(node), Node_Modifiers(node) as unknown as { End: () => int }), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  if (node!.IsTypeOnly) {
    pos = Printer_emitToken(receiver, KindTypeKeyword, pos, WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindEqualsToken, Node_End(Node_Name(node)), WriteKindPunctuation, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitModuleReference(receiver, node!.ModuleReference);
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitModuleReference","kind":"method","status":"implemented","sigHash":"a452222891f249d619807f50a4207fc31805f66c5809193a3653a5f13073094b","bodyHash":"f7aee55713c579750ca6c903baca2e271364f040ad01762c2c3aeb937744ced4"}
 *
 * Go source:
 * func (p *Printer) emitModuleReference(node *ast.ModuleReference) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierReference(node.AsIdentifier())
 * 	case ast.KindQualifiedName:
 * 		p.emitQualifiedName(node.AsQualifiedName())
 * 	case ast.KindExternalModuleReference:
 * 		p.emitExternalModuleReference(node.AsExternalModuleReference())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled ModuleReference: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitModuleReference(receiver: GoPtr<Printer>, node: GoPtr<ModuleReference>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierReference(receiver, AsIdentifier(node));
      break;
    case KindQualifiedName:
      Printer_emitQualifiedName(receiver, AsQualifiedName(node));
      break;
    case KindExternalModuleReference:
      Printer_emitExternalModuleReference(receiver, AsExternalModuleReference(node));
      break;
    default:
      throw new globalThis.Error(`unhandled ModuleReference: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportDeclaration","kind":"method","status":"implemented","sigHash":"784c58e110ac81cdb810fa99c57e1ef58bbf47b9f65139d8aed4a90a0901888a","bodyHash":"102c4a06b29eec410435713c1faab8d3c975de6c4a225b13558a46b99bb91a68"}
 *
 * Go source:
 * func (p *Printer) emitImportDeclaration(node *ast.ImportDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.emitToken(ast.KindImportKeyword, greatestEnd(node.Pos(), node.Modifiers()), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if node.ImportClause != nil {
 * 		p.emitImportClause(node.ImportClause.AsImportClause())
 * 		p.writeSpace()
 * 		p.emitToken(ast.KindFromKeyword, node.ImportClause.End(), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	p.emitExpression(node.ModuleSpecifier, ast.OperatorPrecedenceLowest)
 * 	if node.Attributes != nil {
 * 		p.writeSpace()
 * 		p.emitImportAttributes(node.Attributes.AsImportAttributes())
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ImportDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  Printer_emitToken(receiver, KindImportKeyword, greatestEnd(Node_Pos(node), Node_Modifiers(node) as unknown as { End: () => int }), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  if (node!.ImportClause !== undefined) {
    Printer_emitImportClause(receiver, AsImportClause(node!.ImportClause));
    Printer_writeSpace(receiver);
    Printer_emitToken(receiver, KindFromKeyword, Node_End(node!.ImportClause), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  Printer_emitExpression(receiver, node!.ModuleSpecifier, OperatorPrecedenceLowest);
  if (node!.Attributes !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitImportAttributes(receiver, AsImportAttributes(node!.Attributes));
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportClause","kind":"method","status":"implemented","sigHash":"3a68a55f522a01c1082a861bec7cdf8ea0e94d24ffe705074b49727937629506","bodyHash":"aa9687d3c4747966eeea3d123a2d5ded47574d842f921aec80ea3de86637475f"}
 *
 * Go source:
 * func (p *Printer) emitImportClause(node *ast.ImportClause) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.PhaseModifier != ast.KindUnknown {
 * 		p.emitToken(node.PhaseModifier, node.Pos(), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	if name := node.Name(); name != nil {
 * 		p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 		if node.NamedBindings != nil {
 * 			p.emitToken(ast.KindCommaToken, name.End(), WriteKindPunctuation, node.AsNode())
 * 			p.writeSpace()
 * 		}
 * 	}
 * 	p.emitNamedImportBindings(node.NamedBindings)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportClause(receiver: GoPtr<Printer>, node: GoPtr<ImportClause>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  if (node!.PhaseModifier !== KindUnknown) {
    Printer_emitToken(receiver, node!.PhaseModifier, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  const name = node!.name;
  if (name !== undefined) {
    Printer_emitBindingIdentifier(receiver, AsIdentifier(name));
    if (node!.NamedBindings !== undefined) {
      Printer_emitToken(receiver, KindCommaToken, Node_End(name), WriteKindPunctuation, Node_AsNode(node));
      Printer_writeSpace(receiver);
    }
  }
  Printer_emitNamedImportBindings(receiver, node!.NamedBindings);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamespaceImport","kind":"method","status":"implemented","sigHash":"0eac4e45260277716eef9d519653154448d3ddb0a6acb5139271d7769be79ab1","bodyHash":"693f26736eddea3b0c490fe50cb9b87a33a04d29e8911cc963392a697c71bea0"}
 *
 * Go source:
 * func (p *Printer) emitNamespaceImport(node *ast.NamespaceImport) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindAsteriskToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindAsKeyword, pos, WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamespaceImport(receiver: GoPtr<Printer>, node: GoPtr<NamespaceImport>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindAsteriskToken, Node_Pos(node), WriteKindPunctuation, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindAsKeyword, pos, WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamedImports","kind":"method","status":"implemented","sigHash":"6e67fddebb134028b2e2afebee72f4f93c4dc3ef1de612dca1c1509876aea630","bodyHash":"d935529d6715ca121a2e2eaf2b1aae285e6bb5cf4917b6d1b432e3ea8ff0f4cf"}
 *
 * Go source:
 * func (p *Printer) emitNamedImports(node *ast.NamedImports) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("{")
 * 	p.emitList((*Printer).emitImportSpecifierNode, node.AsNode(), node.Elements, LFNamedImportsOrExportsElements)
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamedImports(receiver: GoPtr<Printer>, node: GoPtr<NamedImports>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_writePunctuation(receiver, "{");
  Printer_emitList(receiver, Printer_emitImportSpecifierNode, Node_AsNode(node), node!.Elements, LFNamedImportsOrExportsElements);
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamedImportBindings","kind":"method","status":"implemented","sigHash":"fed4ad83dbe777b350c7c6503d9e15ca62cc338d3616582382f1902c84bc76ab","bodyHash":"dd537481a21954360a85215722864361252b8ce771d10e74fc88085a2a7f8c58"}
 *
 * Go source:
 * func (p *Printer) emitNamedImportBindings(node *ast.NamedImportBindings) {
 * 	if node == nil {
 * 		return
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindNamespaceImport:
 * 		p.emitNamespaceImport(node.AsNamespaceImport())
 * 	case ast.KindNamedImports:
 * 		p.emitNamedImports(node.AsNamedImports())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled NamedImportBindings: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitNamedImportBindings(receiver: GoPtr<Printer>, node: GoPtr<NamedImportBindings>): void {
  if (node === undefined) {
    return;
  }
  switch (node!.Kind) {
    case KindNamespaceImport:
      Printer_emitNamespaceImport(receiver, AsNamespaceImport(node));
      break;
    case KindNamedImports:
      Printer_emitNamedImports(receiver, AsNamedImports(node));
      break;
    default:
      throw new globalThis.Error(`unhandled NamedImportBindings: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportSpecifier","kind":"method","status":"implemented","sigHash":"e8b07c13d52a82a2b4d7f46494537b7e31d700ffba9a19595c50f3cdcd06bbb5","bodyHash":"e9c47a987e582a77ad7ce97c9d52fadff81375e9c769f8240e69fcc5f960290b"}
 *
 * Go source:
 * func (p *Printer) emitImportSpecifier(node *ast.ImportSpecifier) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.IsTypeOnly {
 * 		p.writeKeyword("type")
 * 		p.writeSpace()
 * 	}
 * 	if node.PropertyName != nil {
 * 		p.emitModuleExportName(node.PropertyName)
 * 		p.writeSpace()
 * 		p.emitToken(ast.KindAsKeyword, node.PropertyName.End(), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportSpecifier(receiver: GoPtr<Printer>, node: GoPtr<ImportSpecifier>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  if (node!.IsTypeOnly) {
    Printer_writeKeyword(receiver, "type");
    Printer_writeSpace(receiver);
  }
  if (node!.PropertyName !== undefined) {
    Printer_emitModuleExportName(receiver, node!.PropertyName);
    Printer_writeSpace(receiver);
    Printer_emitToken(receiver, KindAsKeyword, Node_End(node!.PropertyName), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportSpecifierNode","kind":"method","status":"implemented","sigHash":"e3bd315fa1d86254848a3d10171b327767fcb1e23875735304b0e15f96deea9c","bodyHash":"d5d4074972b490227061df4cf06421a608aad0c22f9d822cfd3574b60515f5fd"}
 *
 * Go source:
 * func (p *Printer) emitImportSpecifierNode(node *ast.ImportSpecifierNode) {
 * 	p.emitImportSpecifier(node.AsImportSpecifier())
 * }
 */
export function Printer_emitImportSpecifierNode(receiver: GoPtr<Printer>, node: GoPtr<ImportSpecifierNode>): void {
  Printer_emitImportSpecifier(receiver, AsImportSpecifier(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExportAssignment","kind":"method","status":"implemented","sigHash":"ea3074b1028be6ec49e185218019866a2e3731cb7878b29aad95361833f31a19","bodyHash":"58e84c953494c7788f83513955ade59697362f1c404cac0ac6ef88e6785c0dfc"}
 *
 * Go source:
 * func (p *Printer) emitExportAssignment(node *ast.ExportAssignment) {
 * 	state := p.enterNode(node.AsNode())
 * 	nextPos := p.emitToken(ast.KindExportKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if node.IsExportEquals {
 * 		p.emitToken(ast.KindEqualsToken, nextPos, WriteKindOperator, node.AsNode())
 * 	} else {
 * 		p.emitToken(ast.KindDefaultKeyword, nextPos, WriteKindKeyword, node.AsNode())
 * 	}
 * 	p.writeSpace()
 * 	if node.IsExportEquals {
 * 		p.emitExpression(node.Expression, ast.OperatorPrecedenceAssignment)
 * 	} else {
 * 		// parenthesize `class` and `function` expressions so as not to conflict with exported `class` and `function` declarations
 * 		expr := ast.GetLeftmostExpression(node.Expression, false /*stopAtCallExpressions* /)
 * 		if ast.IsClassExpression(expr) || ast.IsFunctionExpression(expr) {
 * 			p.emitExpression(node.Expression, ast.OperatorPrecedenceParentheses)
 * 		} else {
 * 			p.emitExpression(node.Expression, ast.OperatorPrecedenceAssignment)
 * 		}
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitExportAssignment(receiver: GoPtr<Printer>, node: GoPtr<ExportAssignment>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const nextPos = Printer_emitToken(receiver, KindExportKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  if (node!.IsExportEquals) {
    Printer_emitToken(receiver, KindEqualsToken, nextPos, WriteKindOperator, Node_AsNode(node));
  } else {
    Printer_emitToken(receiver, KindDefaultKeyword, nextPos, WriteKindKeyword, Node_AsNode(node));
  }
  Printer_writeSpace(receiver);
  if (node!.IsExportEquals) {
    Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceAssignment);
  } else {
    // parenthesize `class` and `function` expressions so as not to conflict with exported `class` and `function` declarations
    const expr = GetLeftmostExpression(node!.Expression, false as bool);
    if (IsClassExpression(expr) || IsFunctionExpression(expr)) {
      Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceParentheses);
    } else {
      Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceAssignment);
    }
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExportDeclaration","kind":"method","status":"implemented","sigHash":"3be989c44915f42d52517a53a7577ad53a5c3a54bf01c17d1249cffb279e5265","bodyHash":"9dbabc1f6f6b61733b37321c91ac56e668c3634d5d217bd21bda87b57c3bde95"}
 *
 * Go source:
 * func (p *Printer) emitExportDeclaration(node *ast.ExportDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	pos := p.emitToken(ast.KindExportKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if node.IsTypeOnly {
 * 		pos = p.emitToken(ast.KindTypeKeyword, pos, WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	if node.ExportClause != nil {
 * 		p.emitNamedExportBindings(node.ExportClause)
 * 	} else {
 * 		pos = p.emitToken(ast.KindAsteriskToken, pos, WriteKindPunctuation, node.AsNode())
 * 	}
 * 	if node.ModuleSpecifier != nil {
 * 		p.writeSpace()
 * 		p.emitToken(ast.KindFromKeyword, greatestEnd(pos, node.ExportClause), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 		p.emitExpression(node.ModuleSpecifier, ast.OperatorPrecedenceLowest)
 * 	}
 * 	if node.Attributes != nil {
 * 		p.writeSpace()
 * 		p.emitImportAttributes(node.Attributes.AsImportAttributes())
 * 	}
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitExportDeclaration(receiver: GoPtr<Printer>, node: GoPtr<ExportDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitModifierList(receiver, Node_AsNode(node), Node_Modifiers(node), false as bool);
  let pos = Printer_emitToken(receiver, KindExportKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  if (node!.IsTypeOnly) {
    pos = Printer_emitToken(receiver, KindTypeKeyword, pos, WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  if (node!.ExportClause !== undefined) {
    Printer_emitNamedExportBindings(receiver, node!.ExportClause);
  } else {
    pos = Printer_emitToken(receiver, KindAsteriskToken, pos, WriteKindPunctuation, Node_AsNode(node));
  }
  if (node!.ModuleSpecifier !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitToken(receiver, KindFromKeyword, greatestEnd(pos, node!.ExportClause as unknown as { End: () => int }), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
    Printer_emitExpression(receiver, node!.ModuleSpecifier, OperatorPrecedenceLowest);
  }
  if (node!.Attributes !== undefined) {
    Printer_writeSpace(receiver);
    Printer_emitImportAttributes(receiver, AsImportAttributes(node!.Attributes));
  }
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportAttributes","kind":"method","status":"implemented","sigHash":"92361e6e1cbc375f3b3ca32497220c841fda0275f284c8ef77c26acdbdd1d25e","bodyHash":"d7897941d68dc8c91c9aa766badc64f79f7caf5b0d0379665ca4900bf1d2e5c4"}
 *
 * Go source:
 * func (p *Printer) emitImportAttributes(node *ast.ImportAttributes) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(node.Token, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitList((*Printer).emitImportAttributeNode, node.AsNode(), node.Attributes, LFImportAttributes)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportAttributes(receiver: GoPtr<Printer>, node: GoPtr<ImportAttributes>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitToken(receiver, node!.Token, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitList(receiver, Printer_emitImportAttributeNode, Node_AsNode(node), node!.Attributes, LFImportAttributes);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportAttribute","kind":"method","status":"implemented","sigHash":"e93d81d1070c5f881f15eab05a3fdc8d149ff783d828d3ddd8e3b0ef3614c52b","bodyHash":"fe6ee8aaad5bad03cc573db61086956bde97efd7321b4326e3f309c335cc0373"}
 *
 * Go source:
 * func (p *Printer) emitImportAttribute(node *ast.ImportAttribute) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitImportAttributeName(node.Name())
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	value := node.Value
 * 	if p.emitContext.EmitFlags(node.Value)&EFNoLeadingComments == 0 {
 * 		commentRange := p.emitContext.CommentRange(value)
 * 		p.emitTrailingComments(commentRange.Pos(), commentSeparatorAfter)
 * 	}
 * 	p.emitExpression(value, ast.OperatorPrecedenceDisallowComma)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportAttribute(receiver: GoPtr<Printer>, node: GoPtr<ImportAttribute>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitImportAttributeName(receiver, node!.name);
  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  const value = node!.Value;
  if ((EmitContext_EmitFlags(receiver!.emitContext, Node_AsNode(value)) & EFNoLeadingComments) === 0) {
    const commentRange = EmitContext_CommentRange(receiver!.emitContext, Node_AsNode(value));
    Printer_emitTrailingComments(receiver, TextRange_Pos(commentRange), commentSeparatorAfter);
  }
  Printer_emitExpression(receiver, value, OperatorPrecedenceDisallowComma);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportAttributeNode","kind":"method","status":"implemented","sigHash":"918c81ac9b57a08de5213cd7c3bd35673942997b0f432f45ab5c5c4761dea38c","bodyHash":"d3278026973716a7b1486ea5e91155f40d19cd602c33ae3b5fec263d4a06a88e"}
 *
 * Go source:
 * func (p *Printer) emitImportAttributeNode(node *ast.ImportAttributeNode) {
 * 	p.emitImportAttribute(node.AsImportAttribute())
 * }
 */
export function Printer_emitImportAttributeNode(receiver: GoPtr<Printer>, node: GoPtr<ImportAttributeNode>): void {
  Printer_emitImportAttribute(receiver, AsImportAttribute(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamespaceExportDeclaration","kind":"method","status":"implemented","sigHash":"6f3d75fbbd82c8f4293dcda89f77553947f2506f6588a67c46a8c684e8b7b6da","bodyHash":"6da47f9aede45603c2c2392c0ceab34fee7bb328f55fd0978e39b8f63f7f8070"}
 *
 * Go source:
 * func (p *Printer) emitNamespaceExportDeclaration(node *ast.NamespaceExportDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindExportKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	pos = p.emitToken(ast.KindAsKeyword, pos, WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindNamespaceKeyword, pos, WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamespaceExportDeclaration(receiver: GoPtr<Printer>, node: GoPtr<NamespaceExportDeclaration>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  let pos = Printer_emitToken(receiver, KindExportKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  pos = Printer_emitToken(receiver, KindAsKeyword, pos, WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindNamespaceKeyword, pos, WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(node)));
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamespaceExport","kind":"method","status":"implemented","sigHash":"cb48d93522e32945f8a23791b9fce1e38ecca830f17641409aa7b603392730fa","bodyHash":"89f4960396b3fd7c88c382a00b808f229d89f50a6c79a87dbb32c8dc508b2ac3"}
 *
 * Go source:
 * func (p *Printer) emitNamespaceExport(node *ast.NamespaceExport) {
 * 	state := p.enterNode(node.AsNode())
 * 	pos := p.emitToken(ast.KindAsteriskToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(ast.KindAsKeyword, pos, WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitModuleExportName(node.Name())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamespaceExport(receiver: GoPtr<Printer>, node: GoPtr<NamespaceExport>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const pos = Printer_emitToken(receiver, KindAsteriskToken, Node_Pos(node), WriteKindPunctuation, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, KindAsKeyword, pos, WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitModuleExportName(receiver, Node_Name(node));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamedExports","kind":"method","status":"implemented","sigHash":"7b98b3aa8cd2f31491ecac63c73a103acaea9583b37a41c15fcd3aaeea421c3c","bodyHash":"baed2321388a6bf63f72c67b6f7b13c8e44d3f75aa2c2a3369717d6a50e6b465"}
 *
 * Go source:
 * func (p *Printer) emitNamedExports(node *ast.NamedExports) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("{")
 * 	p.emitList((*Printer).emitExportSpecifierNode, node.AsNode(), node.Elements, LFNamedImportsOrExportsElements)
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamedExports(receiver: GoPtr<Printer>, node: GoPtr<NamedExports>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_writePunctuation(receiver, "{");
  Printer_emitList(receiver, Printer_emitExportSpecifierNode, Node_AsNode(node), node!.Elements, LFNamedImportsOrExportsElements);
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamedExportBindings","kind":"method","status":"implemented","sigHash":"11be4d4d5e86391f27e8ff1a33f846c03e91e248f1c8d46a10de37afb1a1b625","bodyHash":"cf7aa59794e0215b43217534b8b2a53577e20e6895f6de505fa30da778de5e8b"}
 *
 * Go source:
 * func (p *Printer) emitNamedExportBindings(node *ast.NamedExportBindings) {
 * 	switch node.Kind {
 * 	case ast.KindNamespaceExport:
 * 		p.emitNamespaceExport(node.AsNamespaceExport())
 * 	case ast.KindNamedExports:
 * 		p.emitNamedExports(node.AsNamedExports())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled NamedExportBindings: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitNamedExportBindings(receiver: GoPtr<Printer>, node: GoPtr<NamedExportBindings>): void {
  switch (node!.Kind) {
    case KindNamespaceExport:
      Printer_emitNamespaceExport(receiver, AsNamespaceExport(node));
      break;
    case KindNamedExports:
      Printer_emitNamedExports(receiver, AsNamedExports(node));
      break;
    default:
      throw new globalThis.Error(`unhandled NamedExportBindings: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExportSpecifier","kind":"method","status":"implemented","sigHash":"e570c60864e5d2ba032e4380883c8daeaba42f34575862bbe48944ac100d3622","bodyHash":"e63678f4b27c5b10734c1cbba646b1ae1fd520d0bd32a36e37134f8b373891c9"}
 *
 * Go source:
 * func (p *Printer) emitExportSpecifier(node *ast.ExportSpecifier) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.IsTypeOnly {
 * 		p.writeKeyword("type")
 * 		p.writeSpace()
 * 	}
 * 	if node.PropertyName != nil {
 * 		p.emitModuleExportName(node.PropertyName)
 * 		p.writeSpace()
 * 		p.emitToken(ast.KindAsKeyword, node.PropertyName.End(), WriteKindKeyword, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 	p.emitModuleExportName(node.Name())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitExportSpecifier(receiver: GoPtr<Printer>, node: GoPtr<ExportSpecifier>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  if (node!.IsTypeOnly) {
    Printer_writeKeyword(receiver, "type");
    Printer_writeSpace(receiver);
  }
  if (node!.PropertyName !== undefined) {
    Printer_emitModuleExportName(receiver, node!.PropertyName);
    Printer_writeSpace(receiver);
    Printer_emitToken(receiver, KindAsKeyword, Node_End(node!.PropertyName), WriteKindKeyword, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }
  Printer_emitModuleExportName(receiver, node!.name);
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExportSpecifierNode","kind":"method","status":"implemented","sigHash":"f9bf310f3db181a6aefc3238c823952fd7e96f6ba3ea8056d92f69e5db7f5674","bodyHash":"e70dfa79fee6acd18b47222fd3a973b103c02220776faba82701be7753eb4fb7"}
 *
 * Go source:
 * func (p *Printer) emitExportSpecifierNode(node *ast.ExportSpecifierNode) {
 * 	p.emitExportSpecifier(node.AsExportSpecifier())
 * }
 */
export function Printer_emitExportSpecifierNode(receiver: GoPtr<Printer>, node: GoPtr<ExportSpecifierNode>): void {
  Printer_emitExportSpecifier(receiver, AsExportSpecifier(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEmbeddedStatement","kind":"method","status":"implemented","sigHash":"63b5d1425fdb574aa84cf37a9bed5308d896ea4a1dfae08892d775be703e5e1f","bodyHash":"04c544dc461a87a21b1d73e3b39795ee6d33baf3691a1863a46428712815136d"}
 *
 * Go source:
 * func (p *Printer) emitEmbeddedStatement(parentNode *ast.Node, node *ast.Statement) {
 * 	if ast.IsBlock(node) ||
 * 		p.shouldEmitOnSingleLine(parentNode) ||
 * 		p.Options.PreserveSourceNewlines && p.getLeadingLineTerminatorCount(parentNode, node, LFNone) == 0 {
 * 		p.writeSpace()
 * 		p.emitStatement(node)
 * 	} else {
 * 		p.writeLine()
 * 		p.increaseIndent()
 * 		if node.Kind == ast.KindEmptyStatement {
 * 			p.emitEmptyStatement(node.AsEmptyStatement(), true /*isEmbeddedStatement* /)
 * 		} else {
 * 			p.emitStatement(node)
 * 		}
 * 		p.decreaseIndent()
 * 	}
 * }
 */
export function Printer_emitEmbeddedStatement(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, node: GoPtr<Statement>): void {
  if (
    IsBlock(node) ||
    Printer_shouldEmitOnSingleLine(receiver, parentNode) ||
    (receiver!.Options.PreserveSourceNewlines && Printer_getLeadingLineTerminatorCount(receiver, parentNode, node, LFNone) === 0)
  ) {
    Printer_writeSpace(receiver);
    Printer_emitStatement(receiver, node);
  } else {
    Printer_writeLine(receiver);
    Printer_increaseIndent(receiver);
    if (node!.Kind === KindEmptyStatement) {
      Printer_emitEmptyStatement(receiver, AsEmptyStatement(node), true as bool);
    } else {
      Printer_emitStatement(receiver, node);
    }
    Printer_decreaseIndent(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitStatement","kind":"method","status":"implemented","sigHash":"9093cce692846c5e98dd3ec550d4f00164760655bb6679bea77d4f11317e855e","bodyHash":"5565ddd9b23f84dadc4cc7fc73ed44bd25af5689e761ad4485d2efe265b408cc"}
 *
 * Go source:
 * func (p *Printer) emitStatement(node *ast.Statement) {
 * 	switch node.Kind {
 * 	// Statements
 * 	case ast.KindBlock:
 * 		p.emitBlock(node.AsBlock())
 * 	case ast.KindEmptyStatement:
 * 		p.emitEmptyStatement(node.AsEmptyStatement(), false /*isEmbeddedStatement* /)
 * 	case ast.KindVariableStatement:
 * 		p.emitVariableStatement(node.AsVariableStatement())
 * 	case ast.KindExpressionStatement:
 * 		p.emitExpressionStatement(node.AsExpressionStatement())
 * 	case ast.KindIfStatement:
 * 		p.emitIfStatement(node.AsIfStatement())
 * 	case ast.KindDoStatement:
 * 		p.emitDoStatement(node.AsDoStatement())
 * 	case ast.KindWhileStatement:
 * 		p.emitWhileStatement(node.AsWhileStatement())
 * 	case ast.KindForStatement:
 * 		p.emitForStatement(node.AsForStatement())
 * 	case ast.KindForInStatement:
 * 		p.emitForInStatement(node.AsForInOrOfStatement())
 * 	case ast.KindForOfStatement:
 * 		p.emitForOfStatement(node.AsForInOrOfStatement())
 * 	case ast.KindContinueStatement:
 * 		p.emitContinueStatement(node.AsContinueStatement())
 * 	case ast.KindBreakStatement:
 * 		p.emitBreakStatement(node.AsBreakStatement())
 * 	case ast.KindReturnStatement:
 * 		p.emitReturnStatement(node.AsReturnStatement())
 * 	case ast.KindWithStatement:
 * 		p.emitWithStatement(node.AsWithStatement())
 * 	case ast.KindSwitchStatement:
 * 		p.emitSwitchStatement(node.AsSwitchStatement())
 * 	case ast.KindLabeledStatement:
 * 		p.emitLabeledStatement(node.AsLabeledStatement())
 * 	case ast.KindThrowStatement:
 * 		p.emitThrowStatement(node.AsThrowStatement())
 * 	case ast.KindTryStatement:
 * 		p.emitTryStatement(node.AsTryStatement())
 * 	case ast.KindDebuggerStatement:
 * 		p.emitDebuggerStatement(node.AsDebuggerStatement())
 * 	case ast.KindNotEmittedStatement:
 * 		p.emitNotEmittedStatement(node.AsNotEmittedStatement())
 * 
 * 	// Declaration Statements
 * 	case ast.KindFunctionDeclaration:
 * 		p.emitFunctionDeclaration(node.AsFunctionDeclaration())
 * 	case ast.KindClassDeclaration:
 * 		p.emitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindInterfaceDeclaration:
 * 		p.emitInterfaceDeclaration(node.AsInterfaceDeclaration())
 * 	case ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		p.emitTypeAliasDeclaration(node.AsTypeAliasDeclaration())
 * 	case ast.KindEnumDeclaration:
 * 		p.emitEnumDeclaration(node.AsEnumDeclaration())
 * 	case ast.KindModuleDeclaration:
 * 		p.emitModuleDeclaration(node.AsModuleDeclaration())
 * 	case ast.KindMissingDeclaration:
 * 		break
 * 
 * 	// Import/Export Statements
 * 	case ast.KindNamespaceExportDeclaration:
 * 		p.emitNamespaceExportDeclaration(node.AsNamespaceExportDeclaration())
 * 	case ast.KindImportEqualsDeclaration:
 * 		p.emitImportEqualsDeclaration(node.AsImportEqualsDeclaration())
 * 	case ast.KindImportDeclaration:
 * 		p.emitImportDeclaration(node.AsImportDeclaration())
 * 	case ast.KindExportAssignment:
 * 		p.emitExportAssignment(node.AsExportAssignment())
 * 	case ast.KindExportDeclaration:
 * 		p.emitExportDeclaration(node.AsExportDeclaration())
 * 
 * 	default:
 * 		panic(fmt.Sprintf("unhandled statement: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitStatement(receiver: GoPtr<Printer>, node: GoPtr<Statement>): void {
  switch (node!.Kind) {
    // Statements
    case KindBlock:
      Printer_emitBlock(receiver, AsBlock(node));
      break;
    case KindEmptyStatement:
      Printer_emitEmptyStatement(receiver, AsEmptyStatement(node), false as bool);
      break;
    case KindVariableStatement:
      Printer_emitVariableStatement(receiver, AsVariableStatement(node));
      break;
    case KindExpressionStatement:
      Printer_emitExpressionStatement(receiver, AsExpressionStatement(node));
      break;
    case KindIfStatement:
      Printer_emitIfStatement(receiver, AsIfStatement(node));
      break;
    case KindDoStatement:
      Printer_emitDoStatement(receiver, AsDoStatement(node));
      break;
    case KindWhileStatement:
      Printer_emitWhileStatement(receiver, AsWhileStatement(node));
      break;
    case KindForStatement:
      Printer_emitForStatement(receiver, AsForStatement(node));
      break;
    case KindForInStatement:
      Printer_emitForInStatement(receiver, AsForInOrOfStatement(node));
      break;
    case KindForOfStatement:
      Printer_emitForOfStatement(receiver, AsForInOrOfStatement(node));
      break;
    case KindContinueStatement:
      Printer_emitContinueStatement(receiver, AsContinueStatement(node));
      break;
    case KindBreakStatement:
      Printer_emitBreakStatement(receiver, AsBreakStatement(node));
      break;
    case KindReturnStatement:
      Printer_emitReturnStatement(receiver, AsReturnStatement(node));
      break;
    case KindWithStatement:
      Printer_emitWithStatement(receiver, AsWithStatement(node));
      break;
    case KindSwitchStatement:
      Printer_emitSwitchStatement(receiver, AsSwitchStatement(node));
      break;
    case KindLabeledStatement:
      Printer_emitLabeledStatement(receiver, AsLabeledStatement(node));
      break;
    case KindThrowStatement:
      Printer_emitThrowStatement(receiver, AsThrowStatement(node));
      break;
    case KindTryStatement:
      Printer_emitTryStatement(receiver, AsTryStatement(node));
      break;
    case KindDebuggerStatement:
      Printer_emitDebuggerStatement(receiver, AsDebuggerStatement(node));
      break;
    case KindNotEmittedStatement:
      Printer_emitNotEmittedStatement(receiver, AsNotEmittedStatement(node));
      break;
    // Declaration Statements
    case KindFunctionDeclaration:
      Printer_emitFunctionDeclaration(receiver, AsFunctionDeclaration(node));
      break;
    case KindClassDeclaration:
      Printer_emitClassDeclaration(receiver, AsClassDeclaration(node));
      break;
    case KindInterfaceDeclaration:
      Printer_emitInterfaceDeclaration(receiver, AsInterfaceDeclaration(node));
      break;
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
      Printer_emitTypeAliasDeclaration(receiver, AsTypeAliasDeclaration(node));
      break;
    case KindEnumDeclaration:
      Printer_emitEnumDeclaration(receiver, AsEnumDeclaration(node));
      break;
    case KindModuleDeclaration:
      Printer_emitModuleDeclaration(receiver, AsModuleDeclaration(node));
      break;
    case KindMissingDeclaration:
      break;
    // Import/Export Statements
    case KindNamespaceExportDeclaration:
      Printer_emitNamespaceExportDeclaration(receiver, AsNamespaceExportDeclaration(node));
      break;
    case KindImportEqualsDeclaration:
      Printer_emitImportEqualsDeclaration(receiver, AsImportEqualsDeclaration(node));
      break;
    case KindImportDeclaration:
      Printer_emitImportDeclaration(receiver, AsImportDeclaration(node));
      break;
    case KindExportAssignment:
      Printer_emitExportAssignment(receiver, AsExportAssignment(node));
      break;
    case KindExportDeclaration:
      Printer_emitExportDeclaration(receiver, AsExportDeclaration(node));
      break;
    default:
      throw new globalThis.Error(`unhandled statement: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExternalModuleReference","kind":"method","status":"implemented","sigHash":"ffe7347e36717b56d8f4d3163003f05602b1d914c0c772c93ea7f5097678cb39","bodyHash":"ccb4c53062de57c41cf25c68e4fdba6566cbcd9df55d9027d2f68f8f5320f840"}
 *
 * Go source:
 * func (p *Printer) emitExternalModuleReference(node *ast.ExternalModuleReference) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("require")
 * 	p.writePunctuation("(")
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 	p.writePunctuation(")")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitExternalModuleReference(receiver: GoPtr<Printer>, node: GoPtr<ExternalModuleReference>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_writeKeyword(receiver, "require");
  Printer_writePunctuation(receiver, "(");
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceDisallowComma);
  Printer_writePunctuation(receiver, ")");
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxNamespacedName","kind":"method","status":"implemented","sigHash":"14dd936794f0143918a38b82113ae8e4bb6ec3fce967ddd3769fe109b77d0ce4","bodyHash":"863adcdc9beeb8c03332e4c556a32dfae6d5b980fbb74cb88deb42669a92d47e"}
 *
 * Go source:
 * func (p *Printer) emitJsxNamespacedName(node *ast.JsxNamespacedName) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitIdentifierName(node.Namespace.AsIdentifier())
 * 	p.writePunctuation(":")
 * 	p.emitIdentifierName(node.Name().AsIdentifier())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJsxNamespacedName(receiver: GoPtr<Printer>, node: GoPtr<JsxNamespacedName>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  Printer_emitIdentifierName(receiver, AsIdentifier(node!.Namespace));
  Printer_writePunctuation(receiver, ":");
  Printer_emitIdentifierName(receiver, AsIdentifier(node!.name));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCaseOrDefaultClauseStatements","kind":"method","status":"implemented","sigHash":"be7449cee2ca2b07abaf69d0a2cd312760b706591ff0f105775c813e7f199e93","bodyHash":"f0158b87bdad6024d47164a250fee1bae8ab4964dcbecf3a2f27bf3ab53d7efb"}
 *
 * Go source:
 * func (p *Printer) emitCaseOrDefaultClauseStatements(node *ast.CaseOrDefaultClause, colonPos int) {
 * 	emitAsSingleStatement := len(node.Statements.Nodes) == 1 &&
 * 		// treat synthesized nodes as located on the same line for emit purposes
 * 		(p.currentSourceFile == nil ||
 * 			ast.NodeIsSynthesized(node.AsNode()) ||
 * 			ast.NodeIsSynthesized(node.Statements.Nodes[0]) ||
 * 			rangeStartPositionsAreOnSameLine(node.Loc, node.Statements.Nodes[0].Loc, p.currentSourceFile))
 * 
 * 	format := LFCaseOrDefaultClauseStatements
 * 	if emitAsSingleStatement {
 * 		// When emitting as a single statement, use writeToken (no comments) for the colon
 * 		// to avoid duplicating trailing comments that will be picked up by the statement list.
 * 		p.writeTokenText(ast.KindColonToken, WriteKindPunctuation, colonPos)
 * 		p.writeSpace()
 * 		format &^= LFMultiLine | LFIndented
 * 	} else {
 * 		p.emitToken(ast.KindColonToken, colonPos, WriteKindPunctuation, node.AsNode())
 * 	}
 * 
 * 	p.emitList((*Printer).emitStatement, node.AsNode(), node.Statements, format)
 * }
 */
export function Printer_emitCaseOrDefaultClauseStatements(receiver: GoPtr<Printer>, node: GoPtr<CaseOrDefaultClause>, colonPos: int): void {
  const emitAsSingleStatement =
    node!.Statements!.Nodes.length === 1 &&
    // treat synthesized nodes as located on the same line for emit purposes
    (receiver!.currentSourceFile === undefined ||
      NodeIsSynthesized(Node_AsNode(node)) ||
      NodeIsSynthesized(node!.Statements!.Nodes[0]) ||
      rangeStartPositionsAreOnSameLine(node!.Loc, node!.Statements!.Nodes[0]!.Loc, receiver!.currentSourceFile));

  let format: int = LFCaseOrDefaultClauseStatements;
  if (emitAsSingleStatement) {
    // When emitting as a single statement, use writeToken (no comments) for the colon
    // to avoid duplicating trailing comments that will be picked up by the statement list.
    Printer_writeTokenText(receiver, KindColonToken, WriteKindPunctuation, colonPos);
    Printer_writeSpace(receiver);
    format = format & ~(LFMultiLine | LFIndented);
  } else {
    Printer_emitToken(receiver, KindColonToken, colonPos, WriteKindPunctuation, Node_AsNode(node));
  }

  Printer_emitList(receiver, Printer_emitStatement, Node_AsNode(node), node!.Statements, format);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCatchClause","kind":"method","status":"implemented","sigHash":"c245a666fd5bfc35b9e83bd9ee2c99e1ca9154a1bb9335541996c930df4f63ee","bodyHash":"1b452c48fd7ee7288f8f66ce9b395bff6d62386fe62d900a3bfecb5d6ec95c5d"}
 *
 * Go source:
 * func (p *Printer) emitCatchClause(node *ast.CatchClause) {
 * 	state := p.enterNode(node.AsNode())
 * 	openParenPos := p.emitToken(ast.KindCatchKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 
 * 	if node.VariableDeclaration != nil {
 * 		p.emitToken(ast.KindOpenParenToken, openParenPos, WriteKindPunctuation, node.AsNode())
 * 		p.emitVariableDeclaration(node.VariableDeclaration.AsVariableDeclaration())
 * 		p.emitToken(ast.KindCloseParenToken, node.VariableDeclaration.End(), WriteKindPunctuation, node.AsNode())
 * 		p.writeSpace()
 * 	}
 * 
 * 	p.emitBlock(node.Block.AsBlock())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitCatchClause(receiver: GoPtr<Printer>, node: GoPtr<CatchClause>): void {
  const state = Printer_enterNode(receiver, Node_AsNode(node));
  const openParenPos = Printer_emitToken(receiver, KindCatchKeyword, Node_Pos(node), WriteKindKeyword, Node_AsNode(node));
  Printer_writeSpace(receiver);

  if (node!.VariableDeclaration !== undefined) {
    Printer_emitToken(receiver, KindOpenParenToken, openParenPos, WriteKindPunctuation, Node_AsNode(node));
    Printer_emitVariableDeclaration(receiver, AsVariableDeclaration(node!.VariableDeclaration));
    Printer_emitToken(receiver, KindCloseParenToken, Node_End(node!.VariableDeclaration), WriteKindPunctuation, Node_AsNode(node));
    Printer_writeSpace(receiver);
  }

  Printer_emitBlock(receiver, AsBlock(node!.Block));
  Printer_exitNode(receiver, Node_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocNode","kind":"method","status":"implemented","sigHash":"85bd24b8ba7f3a6f1e5d0dcc615a047707d7e9482a863b17f74c905273458a04","bodyHash":"0462ef6530c092accbdc4956cb613188d43c27721b463a3afd4ac97a214606e8"}
 *
 * Go source:
 * func (p *Printer) emitJSDocNode(node *ast.Node) {
 * 	// !!!
 * 	panic("not implemented")
 * }
 */
export function Printer_emitJSDocNode(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  // !!!
  throw new globalThis.Error("not implemented");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitShebangIfNeeded","kind":"method","status":"implemented","sigHash":"50c1ddbfd70dec9ee18f6af122692a14c04eef35bd9763e7fa53f27987fd5f04","bodyHash":"c31d4b99b75a0bb03f3189e05d7f1e637c30258805d8904b562ef0c80bd263c5"}
 *
 * Go source:
 * func (p *Printer) emitShebangIfNeeded(node *ast.SourceFile) {
 * 	if ast.NodeIsSynthesized(node.AsNode()) {
 * 		return
 * 	}
 * 	shebang := scanner.GetShebang(node.Text())
 * 	if shebang != "" {
 * 		p.writeComment(shebang)
 * 		p.writeLine()
 * 	}
 * }
 */
export function Printer_emitShebangIfNeeded(receiver: GoPtr<Printer>, node: GoPtr<SourceFile>): void {
  if (NodeIsSynthesized(Node_AsNode(node))) {
    return;
  }
  const shebang = GetShebang(SourceFile_Text(node));
  if (shebang !== "") {
    Printer_writeComment(receiver, shebang);
    Printer_writeLine(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldReuseTempVariableScope","kind":"method","status":"implemented","sigHash":"d668204d4ec68db70fd0fe4a9b3c91cf0e58a1eda8e47d3a93bbc194ce2fb37e","bodyHash":"454952310f68bc304157bd0f5bf3afa956b3e0f3dc3e66ab89bcf646155ef765"}
 *
 * Go source:
 * func (p *Printer) shouldReuseTempVariableScope(node *ast.Node) bool {
 * 	return node != nil && p.emitContext.EmitFlags(node)&EFReuseTempVariableScope != 0
 * }
 */
export function Printer_shouldReuseTempVariableScope(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return (node !== undefined && (EmitContext_EmitFlags(receiver!.emitContext, node) & EFReuseTempVariableScope) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateNameIfNeeded","kind":"method","status":"implemented","sigHash":"e4b967098a6252dfca209ab5e3c67ffd3786f23f253d41c52df90b15aefe3a98","bodyHash":"8ec847c84cc2874d1b3f790a533f722ebce77ce15237b6cc7897a92021ed6b1c"}
 *
 * Go source:
 * func (p *Printer) generateNameIfNeeded(name *ast.DeclarationName) {
 * 	if name != nil {
 * 		if ast.IsMemberName(name) {
 * 			p.generateName(name)
 * 		} else if ast.IsBindingPattern(name) {
 * 			p.generateNames(name)
 * 		}
 * 	}
 * }
 */
export function Printer_generateNameIfNeeded(receiver: GoPtr<Printer>, name: GoPtr<DeclarationName>): void {
  if (name !== undefined) {
    if (IsMemberName(name)) {
      Printer_generateName(receiver, name);
    } else if (IsBindingPattern(name)) {
      Printer_generateNames(receiver, name);
    }
  }
}

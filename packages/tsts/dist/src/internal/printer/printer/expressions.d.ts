import type { bool } from "../../../go/scalars.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node, NodeList } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { ArrayLiteralExpression, ArrowFunction, AsExpression, AwaitExpression, BigIntLiteral, BinaryExpression, BindingPattern, CallExpression, CallSignatureDeclaration, ClassExpression, ConditionalExpression, DeleteExpression, ElementAccessExpression, EnumMember, ExpressionStatement, FunctionExpression, JsxExpression, JsxSpreadAttribute, KeywordExpression, NewExpression, NonNullExpression, NoSubstitutionTemplateLiteral, NumericLiteral, ObjectLiteralExpression, ParenthesizedExpression, PartiallyEmittedExpression, PostfixUnaryExpression, PrefixUnaryExpression, PropertyAccessExpression, RegularExpressionLiteral, SatisfiesExpression, SpreadAssignment, SpreadElement, StringLiteral, TaggedTemplateExpression, TemplateExpression, TemplateHead, TemplateMiddle, TemplateTail, VoidExpression, YieldExpression } from "../../ast/generated/data.js";
import type { EnumMemberNode, Expression, LiteralLikeNode, MemberName, ObjectLiteralElement, ParameterList, TemplateLiteral, TemplateMiddleOrTail } from "../../ast/generated/unions.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { OperatorPrecedence } from "../../ast/precedence.js";
import type { EmitContext } from "../emitcontext.js";
import type { getLiteralTextFlags } from "../utilities.js";
import type { Printer, PrinterOptions, PrintHandlers } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::func::NewPrinter","kind":"func","status":"implemented","sigHash":"925479666aa66f6fd4bf95732fac23255b36fdf6b9810635f7d1f9c54c7ce832","bodyHash":"ab59c158dca42e909a2ec6b5f1470205d16f21e55aca716de8ed602b1c210a9e"}
 *
 * Go source:
 * func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
 * 	printer := &Printer{
 * 		PrintHandlers: handlers,
 * 		Options:       options,
 * 		emitContext:   emitContext,
 * 	}
 * 	// wire up name generator
 * 	if printer.emitContext == nil {
 * 		printer.emitContext = NewEmitContext()
 * 	}
 * 	printer.nameGenerator.Context = printer.emitContext
 * 	printer.nameGenerator.GetTextOfNode = func(node *ast.Node) string { return printer.getTextOfNode(node, false) }
 * 	printer.nameGenerator.IsFileLevelUniqueNameInCurrentFile = printer.isFileLevelUniqueNameInCurrentFile
 * 	printer.makeFileLevelOptimisticUniqueName = func(name string) string {
 * 		return printer.nameGenerator.MakeFileLevelOptimisticUniqueName(name)
 * 	}
 * 	printer.containerPos = -1
 * 	printer.containerEnd = -1
 * 	printer.declarationListContainerEnd = -1
 * 	printer.commentsDisabled = options.RemoveComments
 * 	return printer
 * }
 */
export declare function NewPrinter(options: PrinterOptions, handlers: PrintHandlers, emitContext: GoPtr<EmitContext>): GoPtr<Printer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getLiteralTextOfNode","kind":"method","status":"implemented","sigHash":"cd58c94045da8b27762e49d9fa864a0e4c96c0b9799f15840ec50dc19225ed59","bodyHash":"d4b2c82b1717c4a41762e4505663e16534db379b68adce2091e85bc333732080"}
 *
 * Go source:
 * func (p *Printer) getLiteralTextOfNode(node *ast.LiteralLikeNode, sourceFile *ast.SourceFile, flags getLiteralTextFlags) string {
 * 	if ast.IsStringLiteral(node) {
 * 		if textSourceNode, ok := p.emitContext.textSource[node]; ok && textSourceNode != nil {
 * 			var text string
 * 			switch textSourceNode.Kind {
 * 			default:
 * 				return p.getLiteralTextOfNode(textSourceNode, ast.GetSourceFileOfNode(textSourceNode), flags)
 * 			case ast.KindNumericLiteral:
 * 				text = textSourceNode.Text()
 * 			case ast.KindIdentifier, ast.KindPrivateIdentifier, ast.KindJsxNamespacedName:
 * 				text = p.getTextOfNode(textSourceNode, false)
 * 			}
 *
 * 			switch {
 * 			case flags&getLiteralTextFlagsJsxAttributeEscape != 0:
 * 				return "\"" + escapeJsxAttributeString(text, QuoteCharDoubleQuote) + "\""
 * 			case flags&getLiteralTextFlagsNeverAsciiEscape != 0 || p.emitContext.EmitFlags(node)&EFNoAsciiEscaping != 0:
 * 				return "\"" + EscapeString(text, QuoteCharDoubleQuote) + "\""
 * 			default:
 * 				return "\"" + escapeNonAsciiString(text, QuoteCharDoubleQuote) + "\""
 * 			}
 * 		}
 * 	}
 * 	// !!! Printer option to control whether to terminate unterminated literals
 * 	if p.emitContext.EmitFlags(node)&EFNoAsciiEscaping != 0 {
 * 		flags |= getLiteralTextFlagsNeverAsciiEscape
 * 	}
 * 	if p.Options.Target >= core.ScriptTargetES2021 {
 * 		flags |= getLiteralTextFlagsAllowNumericSeparator
 * 	}
 * 	return getLiteralText(node, core.Coalesce(sourceFile, p.currentSourceFile), flags)
 * }
 */
export declare function Printer_getLiteralTextOfNode(receiver: GoPtr<Printer>, node: GoPtr<LiteralLikeNode>, sourceFile: GoPtr<SourceFile>, flags: getLiteralTextFlags): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLiteral","kind":"method","status":"implemented","sigHash":"1bef00cc64e24d2f0fa0a0341c765e8bf917b7da1a45e2d9cac7dbb7dfa9a67a","bodyHash":"61e3a2739022d40845d89db88d2cc66c47fef7c2aa43897f89d7a7695515e643"}
 *
 * Go source:
 * func (p *Printer) writeLiteral(text string) {
 * 	p.writer.WriteLiteral(text)
 * }
 */
export declare function Printer_writeLiteral(receiver: GoPtr<Printer>, text: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitIndirectCall","kind":"method","status":"implemented","sigHash":"4829fd2d7985a5b4e01729231a9f376b34e85356129d7d0d9af45a9901b7b40c","bodyHash":"6f3b796b66cb92da5c9631fb78a0f31531d806e288404cff6aaea09e808b1fdc"}
 *
 * Go source:
 * func (p *Printer) shouldEmitIndirectCall(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFIndirectCall != 0
 * }
 */
export declare function Printer_shouldEmitIndirectCall(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLiteral","kind":"method","status":"implemented","sigHash":"dc0cab02a383a7f4f00366fded82c9c25a2041a82480a56336fa65bce9ae3fd4","bodyHash":"f408002e5466fb7cc5940be46037dffa7f2b43b1de874ba58711415495b377d6"}
 *
 * Go source:
 * func (p *Printer) emitLiteral(node *ast.LiteralLikeNode, flags getLiteralTextFlags) {
 * 	// Add NeverAsciiEscape flag if the printer option is set
 * 	if p.Options.NeverAsciiEscape {
 * 		flags |= getLiteralTextFlagsNeverAsciiEscape
 * 	}
 * 	if p.Options.TerminateUnterminatedLiterals {
 * 		flags |= getLiteralTextFlagsTerminateUnterminatedLiterals
 * 	}
 *
 * 	text := p.getLiteralTextOfNode(node, nil /*sourceFile* /, flags)
 *
 * 	// !!! Printer option to control source map emit, which causes us to use a different write method on the
 * 	// emit text writer:
 *
 * 	////if (
 * 	////	(printerOptions.sourceMap || printerOptions.inlineSourceMap)
 * 	////	&& (node.kind === SyntaxKindStringLiteral || isTemplateLiteralKind(node.kind))
 * 	////) {
 * 	////	writeLiteral(text);
 * 	////} else {
 *
 * 	// Quick info expects all literals to be called with writeStringLiteral, as there's no specific type for
 * 	// numberLiterals
 * 	p.writer.WriteStringLiteral(text)
 *
 * 	// }
 * }
 */
export declare function Printer_emitLiteral(receiver: GoPtr<Printer>, node: GoPtr<LiteralLikeNode>, flags: getLiteralTextFlags): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNumericLiteral","kind":"method","status":"implemented","sigHash":"9e908d68cab0525d2c31c93efd9a46ba8078f08b233d6dce6b971a0540d6621d","bodyHash":"57d7938090a6c2766e6bda5fbec6f25f94e03083762c914068679b14ff52dc55"}
 *
 * Go source:
 * func (p *Printer) emitNumericLiteral(node *ast.NumericLiteral) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitNumericLiteral(receiver: GoPtr<Printer>, node: GoPtr<NumericLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBigIntLiteral","kind":"method","status":"implemented","sigHash":"5d9128e42ade92e0757655e342d399e556867beea2b973d78b186f8ea8260dd5","bodyHash":"e455f762f92d40bbc1ffb22256980e0c67e9306b35cfce585933a7b5822a699c"}
 *
 * Go source:
 * func (p *Printer) emitBigIntLiteral(node *ast.BigIntLiteral) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone) // TODO: Preserve numeric literal separators after Strada migration
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitBigIntLiteral(receiver: GoPtr<Printer>, node: GoPtr<BigIntLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitStringLiteral","kind":"method","status":"implemented","sigHash":"4786d50277937f0598cbd08580ecfc1db5bd5373caca679866b15e67a1ec8552","bodyHash":"2c425e796b67a8abea8af4bba1b0cdfbcffbd03539a18b76d258c161ed4f748a"}
 *
 * Go source:
 * func (p *Printer) emitStringLiteral(node *ast.StringLiteral) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitStringLiteral(receiver: GoPtr<Printer>, node: GoPtr<StringLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNoSubstitutionTemplateLiteral","kind":"method","status":"implemented","sigHash":"fb15483025fad0631aa8fdb61c7238b1f50e6041bb1178d9c864c9e705cbb833","bodyHash":"df8aade792a83b8764d514cec4481be70806a3a9fca46b304bad520538334950"}
 *
 * Go source:
 * func (p *Printer) emitNoSubstitutionTemplateLiteral(node *ast.NoSubstitutionTemplateLiteral) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitNoSubstitutionTemplateLiteral(receiver: GoPtr<Printer>, node: GoPtr<NoSubstitutionTemplateLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitRegularExpressionLiteral","kind":"method","status":"implemented","sigHash":"635d4d38212ee89237e8a03335c7b708382102f972162a4d915577f83a0125a5","bodyHash":"a49747480f8e556c377d6d6476ece5327bfb2eebfb24caf608d873a35e34bce7"}
 *
 * Go source:
 * func (p *Printer) emitRegularExpressionLiteral(node *ast.RegularExpressionLiteral) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitRegularExpressionLiteral(receiver: GoPtr<Printer>, node: GoPtr<RegularExpressionLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateHead","kind":"method","status":"implemented","sigHash":"e7746c3f8f1590a1c9d68e9d3a30ae3db9d2595cc5bde91e02e0850cb3332ff9","bodyHash":"83f9ae3b461ea2f5e6c9de092833e0c685874c03d853692dbbf86d07b7400e49"}
 *
 * Go source:
 * func (p *Printer) emitTemplateHead(node *ast.TemplateHead) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateHead(receiver: GoPtr<Printer>, node: GoPtr<TemplateHead>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateMiddle","kind":"method","status":"implemented","sigHash":"ebab7f5038cbe00e434bb8ed64b52824bf9a991ff1acea1dc42474be3f6a246b","bodyHash":"8a5bc62a178e9fadfb649befa158ec27a3ae4ce1bd2afdd9ab930f0a40146d96"}
 *
 * Go source:
 * func (p *Printer) emitTemplateMiddle(node *ast.TemplateMiddle) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateMiddle(receiver: GoPtr<Printer>, node: GoPtr<TemplateMiddle>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateTail","kind":"method","status":"implemented","sigHash":"c5050010c029b9055e52dcaccd179e93fa50419f0d4931f4abf10787578d3f2a","bodyHash":"e0a2de351b30588f670a515c97a48942820d674b03e18ddd39618c0ed638bbe3"}
 *
 * Go source:
 * func (p *Printer) emitTemplateTail(node *ast.TemplateTail) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitLiteral(node.AsNode(), getLiteralTextFlagsNone)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateTail(receiver: GoPtr<Printer>, node: GoPtr<TemplateTail>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateMiddleTail","kind":"method","status":"implemented","sigHash":"83c72ce3422a79501122c1c480a44d8befdb43546cdf7645b5035b82e1f801c1","bodyHash":"1a0a8ea14b619f3eb91fcb21ff138a20b82f73664902e9b5440ca8a5a5bb0380"}
 *
 * Go source:
 * func (p *Printer) emitTemplateMiddleTail(node *ast.TemplateMiddleOrTail) {
 * 	switch node.Kind {
 * 	case ast.KindTemplateMiddle:
 * 		p.emitTemplateMiddle(node.AsTemplateMiddle())
 * 	case ast.KindTemplateTail:
 * 		p.emitTemplateTail(node.AsTemplateTail())
 * 	}
 * }
 */
export declare function Printer_emitTemplateMiddleTail(receiver: GoPtr<Printer>, node: GoPtr<TemplateMiddleOrTail>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMemberName","kind":"method","status":"implemented","sigHash":"3345bef65f48715872f5bdc70958d9a285ee4b1b0b3759d62a369348cc446492","bodyHash":"80cdffbbaa21ab28710fdb52a76ee0ac3a088f620613c3737b82db69b8943049"}
 *
 * Go source:
 * func (p *Printer) emitMemberName(node *ast.MemberName) {
 * 	if node == nil {
 * 		return
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierName(node.AsIdentifier())
 * 	case ast.KindPrivateIdentifier:
 * 		p.emitPrivateIdentifier(node.AsPrivateIdentifier())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected MemberName: %v", node.Kind))
 * 	}
 * }
 */
export declare function Printer_emitMemberName(receiver: GoPtr<Printer>, node: GoPtr<MemberName>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::func::canEmitSimpleArrowHead","kind":"func","status":"implemented","sigHash":"d25b8cb5cb5d567d89753512a1de6674e527f29d6f647d234f7003b0195266b3","bodyHash":"3ddf92618c60f73e0423e0ce3c1f0fed6f6805f462a450fd6d34722d8b870612"}
 *
 * Go source:
 * func canEmitSimpleArrowHead(parentNode *ast.Node, parameters *ast.ParameterList) bool {
 * 	// only arrow functions with a single parameter may have simple arrow head
 * 	if !ast.IsArrowFunction(parentNode) || len(parameters.Nodes) != 1 {
 * 		return false
 * 	}
 *
 * 	parent := parentNode.AsArrowFunction()
 * 	parameter := parameters.Nodes[0].AsParameterDeclaration()
 *
 * 	return parameter.Pos() == parent.Pos() && // may not have parsed tokens between start of parent and parameter
 * 		parent.TypeParameters == nil && // parent may not have type parameters
 * 		parent.Type == nil && // parent may not have return type annotation
 * 		(parent.Modifiers() == nil || len(parent.Modifiers().Nodes) == 0) && // parent may not have modifiers
 * 		!parameters.HasTrailingComma() && // parameters may not have a trailing comma
 * 		parameter.Modifiers() == nil && // parameter may not have decorators or modifiers
 * 		parameter.DotDotDotToken == nil && // parameter may not be rest
 * 		parameter.QuestionToken == nil && // parameter may not be optional
 * 		parameter.Type == nil && // parameter may not have a type annotation
 * 		parameter.Initializer == nil && // parameter may not have an initializer
 * 		ast.IsIdentifier(parameter.Name()) // parameter name must be identifier
 * }
 */
export declare function canEmitSimpleArrowHead(parentNode: GoPtr<Node>, parameters: GoPtr<ParameterList>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParametersForArrow","kind":"method","status":"implemented","sigHash":"1e3f353449382704b9e6281c54707e151486170adbb00048a8753ce21a9ccf3c","bodyHash":"562ca0c2945c8787eb502c814886199f90746257d2c75a7cdb4d5adfabcff0de"}
 *
 * Go source:
 * func (p *Printer) emitParametersForArrow(parentNode *ast.Node /*FunctionType | ConstructorType | ArrowFunction* /, parameters *ast.ParameterList) {
 * 	if canEmitSimpleArrowHead(parentNode, parameters) {
 * 		p.generateAllNames(parameters)
 * 		p.emitList((*Printer).emitParameterDeclarationNode, parentNode, parameters, LFSingleArrowParameter)
 * 	} else {
 * 		p.emitParameters(parentNode, parameters)
 * 	}
 * }
 */
export declare function Printer_emitParametersForArrow(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, parameters: GoPtr<ParameterList>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCallSignature","kind":"method","status":"implemented","sigHash":"2d07400bc0e548d5e6334d2363a08f2a820fa21752cfc17ce45a5be9419a1fe4","bodyHash":"f2c2ff1da89ef88029e921ea20da676e0bf31dc1c31da008e787cf04f1fec059"}
 *
 * Go source:
 * func (p *Printer) emitCallSignature(node *ast.CallSignatureDeclaration) {
 * 	state := p.enterNode(node.AsNode())
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
export declare function Printer_emitCallSignature(receiver: GoPtr<Printer>, node: GoPtr<CallSignatureDeclaration>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitObjectLiteralElement","kind":"method","status":"implemented","sigHash":"e330961dcec58805ce30f0efc11ca5c63f0c07ac517eceee034fc9cce7815bd9","bodyHash":"ca3618db1318cf38fd10a15cace00e293e1c70c600d2a6c98aac9268f0e9c324"}
 *
 * Go source:
 * func (p *Printer) emitObjectLiteralElement(node *ast.ObjectLiteralElement) {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAssignment:
 * 		p.emitPropertyAssignment(node.AsPropertyAssignment())
 * 	case ast.KindShorthandPropertyAssignment:
 * 		p.emitShorthandPropertyAssignment(node.AsShorthandPropertyAssignment())
 * 	case ast.KindSpreadAssignment:
 * 		p.emitSpreadAssignment(node.AsSpreadAssignment())
 * 	case ast.KindMethodDeclaration:
 * 		p.emitMethodDeclaration(node.AsMethodDeclaration())
 * 	case ast.KindGetAccessor:
 * 		p.emitGetAccessorDeclaration(node.AsGetAccessorDeclaration())
 * 	case ast.KindSetAccessor:
 * 		p.emitSetAccessorDeclaration(node.AsSetAccessorDeclaration())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled ObjectLiteralElement: %v", node.Kind))
 * 	}
 * }
 */
export declare function Printer_emitObjectLiteralElement(receiver: GoPtr<Printer>, node: GoPtr<ObjectLiteralElement>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitObjectBindingPattern","kind":"method","status":"implemented","sigHash":"8283833f0e539e151296886a862849d28810efaf96344a179c199336f28d184b","bodyHash":"8b949e05af37546aba2fcbc649accc32c97fe7d0dc8af1a7002b65a62154f099"}
 *
 * Go source:
 * func (p *Printer) emitObjectBindingPattern(node *ast.BindingPattern) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("{")
 * 	p.emitList((*Printer).emitBindingElementNode, node.AsNode(), node.Elements, LFObjectBindingPatternElements)
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitObjectBindingPattern(receiver: GoPtr<Printer>, node: GoPtr<BindingPattern>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArrayBindingPattern","kind":"method","status":"implemented","sigHash":"2a6a5645f9b4f41603873bfefcf60d4a88ec089aa84b6c6f74cdcf0caacefbe1","bodyHash":"21e1b871d665cc4d54822dc7bcc8d346d22d309de2240a64222d693f09c92d60"}
 *
 * Go source:
 * func (p *Printer) emitArrayBindingPattern(node *ast.BindingPattern) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("[")
 * 	p.emitList((*Printer).emitBindingElementNode, node.AsNode(), node.Elements, LFArrayBindingPatternElements)
 * 	p.writePunctuation("]")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitArrayBindingPattern(receiver: GoPtr<Printer>, node: GoPtr<BindingPattern>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitKeywordExpression","kind":"method","status":"implemented","sigHash":"09077ab9af8fe0eae8549fdc93c2d6b944e5d27baa100bdec319bd7be81c842c","bodyHash":"e714ef7cac8e9dd09afa29d63430c156a8b2cc9183e894870f1b78c38244f579"}
 *
 * Go source:
 * func (p *Printer) emitKeywordExpression(node *ast.KeywordExpression) {
 * 	p.emitKeywordNode(node.AsNode())
 * }
 */
export declare function Printer_emitKeywordExpression(receiver: GoPtr<Printer>, node: GoPtr<KeywordExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArrayLiteralExpressionElement","kind":"method","status":"implemented","sigHash":"0c47e8f220800c99d31704c27d54c9728cb1d0889cc76659f80c8ddb22c0fb57","bodyHash":"8b98f8b50061701387ac1223b4dff2ea37941217eae6d327bcf147311d718ad2"}
 *
 * Go source:
 * func (p *Printer) emitArrayLiteralExpressionElement(node *ast.Expression) {
 * 	p.emitExpression(node, ast.OperatorPrecedenceSpread)
 * }
 */
export declare function Printer_emitArrayLiteralExpressionElement(receiver: GoPtr<Printer>, node: GoPtr<Expression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArrayLiteralExpression","kind":"method","status":"implemented","sigHash":"cd650c5652d3ad10ac5357e07c6481b93fe2ed3c7ea94812df29e41552f111ac","bodyHash":"0bd8bc1a25733faca444f5d3df36d951c61c0e0422c3b6ddaa6c447a425c959c"}
 *
 * Go source:
 * func (p *Printer) emitArrayLiteralExpression(node *ast.ArrayLiteralExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitList((*Printer).emitArrayLiteralExpressionElement, node.AsNode(), node.Elements, LFArrayLiteralExpressionElements|core.IfElse(node.MultiLine, LFPreferNewLine, LFNone))
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitArrayLiteralExpression(receiver: GoPtr<Printer>, node: GoPtr<ArrayLiteralExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitObjectLiteralExpression","kind":"method","status":"implemented","sigHash":"58fb166cb00d29f5b486d0b8da1b3f8c471973c00090f7dff6eed55b3fcc154a","bodyHash":"6b80e3916035c89e122e3b88f7b6da4d3887294eb97e81b3fa5dc4b7477d21d3"}
 *
 * Go source:
 * func (p *Printer) emitObjectLiteralExpression(node *ast.ObjectLiteralExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllMemberNames(node.Properties)
 * 	p.emitList((*Printer).emitObjectLiteralElement, node.AsNode(), node.Properties, LFObjectLiteralExpressionProperties|
 * 		core.IfElse(node.MultiLine, LFPreferNewLine, LFNone)|
 * 		core.IfElse(p.shouldAllowTrailingComma(node.AsNode(), node.Properties), LFAllowTrailingComma, LFNone))
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitObjectLiteralExpression(receiver: GoPtr<Printer>, node: GoPtr<ObjectLiteralExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.mayNeedDotDotForPropertyAccess","kind":"method","status":"implemented","sigHash":"f193e9a520b5d63b30d3d7101da59d46228c5b4389fa04c2f2d6606019486012","bodyHash":"294eea5f4060e0b2dd0798abb5d55042bfbcb9674b4b6427cd04cf4deeb577de"}
 *
 * Go source:
 * func (p *Printer) mayNeedDotDotForPropertyAccess(expression *ast.Expression) bool {
 * 	expression = ast.SkipPartiallyEmittedExpressions(expression)
 * 	if ast.IsNumericLiteral(expression) {
 * 		// check if numeric literal is a decimal literal that was originally written with a dot
 * 		text := p.getLiteralTextOfNode(expression /*sourceFile* /, nil, getLiteralTextFlagsNeverAsciiEscape)
 * 		// If the number will be printed verbatim and it doesn't already contain a dot or an exponent indicator, add one
 * 		// if the expression doesn't have any comments that will be emitted.
 * 		return expression.AsNumericLiteral().TokenFlags&ast.TokenFlagsWithSpecifier == 0 &&
 * 			!strings.Contains(text, scanner.TokenToString(ast.KindDotToken)) &&
 * 			!strings.Contains(text, "E") &&
 * 			!strings.Contains(text, "e")
 * 	}
 * 	return false
 * }
 */
export declare function Printer_mayNeedDotDotForPropertyAccess(receiver: GoPtr<Printer>, expression: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"3cbeb4214d6119d1e66e7548bf2c874f3c8550c7734f69119a8ca4262312f6ba","bodyHash":"0248fd7094fe499449e32b232b877bf92af68ef054598c0761c4bcb16c71cc05"}
 *
 * Go source:
 * func (p *Printer) emitPropertyAccessExpression(node *ast.PropertyAccessExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, core.IfElse(ast.IsOptionalChain(node.AsNode()), ast.OperatorPrecedenceOptionalChain, ast.OperatorPrecedenceMember))
 * 	token := node.QuestionDotToken
 * 	if token == nil {
 * 		token = p.emitContext.Factory.NewToken(ast.KindDotToken)
 * 		token.Loc = core.NewTextRange(node.Expression.End(), node.Name().Pos())
 * 		p.emitContext.AddEmitFlags(token, EFNoSourceMap)
 * 	}
 * 	linesBeforeDot := p.getLinesBetweenNodes(node.AsNode(), node.Expression, token)
 * 	p.writeLineRepeat(linesBeforeDot)
 * 	p.increaseIndentIf(linesBeforeDot > 0)
 * 	shouldEmitDotDot := token.Kind != ast.KindQuestionDotToken &&
 * 		p.mayNeedDotDotForPropertyAccess(node.Expression) &&
 * 		!p.writer.HasTrailingComment() &&
 * 		!p.writer.HasTrailingWhitespace()
 * 	if shouldEmitDotDot {
 * 		p.writePunctuation(".")
 * 	}
 * 	if node.QuestionDotToken != nil {
 * 		p.emitTokenNode(token)
 * 	} else {
 * 		p.emitToken(ast.KindDotToken, node.Expression.End(), WriteKindPunctuation, node.AsNode())
 * 	}
 * 	linesAfterDot := p.getLinesBetweenNodes(node.AsNode(), token, node.Name())
 * 	p.writeLineRepeat(linesAfterDot)
 * 	p.increaseIndentIf(linesAfterDot > 0)
 * 	p.emitMemberName(node.Name())
 * 	p.decreaseIndentIf(linesAfterDot > 0)
 * 	p.decreaseIndentIf(linesBeforeDot > 0)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitPropertyAccessExpression(receiver: GoPtr<Printer>, node: GoPtr<PropertyAccessExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitElementAccessExpression","kind":"method","status":"implemented","sigHash":"edb98533d2fc343e8ffe24454a496c0f148900f90849952f5f42dece32ff272f","bodyHash":"3db341c0dd4c2900c78d029757bfa39370d13e34006f74b3c5398919cf821410"}
 *
 * Go source:
 * func (p *Printer) emitElementAccessExpression(node *ast.ElementAccessExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, core.IfElse(ast.IsOptionalChain(node.AsNode()), ast.OperatorPrecedenceOptionalChain, ast.OperatorPrecedenceMember))
 * 	p.emitTokenNode(node.QuestionDotToken)
 * 	p.emitToken(ast.KindOpenBracketToken, greatestEnd(-1, node.Expression, node.QuestionDotToken), WriteKindPunctuation, node.AsNode())
 * 	p.emitExpression(node.ArgumentExpression, ast.OperatorPrecedenceComma)
 * 	p.emitToken(ast.KindCloseBracketToken, node.ArgumentExpression.End(), WriteKindPunctuation, node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitElementAccessExpression(receiver: GoPtr<Printer>, node: GoPtr<ElementAccessExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCallee","kind":"method","status":"implemented","sigHash":"dc251a6bc9a44064d677d642060409248a8717daa63133562bb1c21f2b71ed39","bodyHash":"a2a3a38468e125db1ee3b82e9e999015f3e028f7e27441c272ee5ccaff92fad7"}
 *
 * Go source:
 * func (p *Printer) emitCallee(callee *ast.Expression, parentNode *ast.Node) {
 * 	if p.shouldEmitIndirectCall(parentNode) {
 * 		p.writePunctuation("(")
 * 		p.writeLiteral("0")
 * 		p.writePunctuation(",")
 * 		p.writeSpace()
 * 		p.emitExpression(callee, ast.OperatorPrecedenceComma)
 * 		p.writePunctuation(")")
 * 	} else if parentNode.Kind == ast.KindCallExpression && isNewExpressionWithoutArguments(ast.SkipPartiallyEmittedExpressions(callee)) {
 * 		// Parenthesize `new C` inside of a CallExpression so it is treated as `(new C)()` and not `new C()`
 * 		p.emitExpression(callee, ast.OperatorPrecedenceParentheses)
 * 	} else {
 * 		p.emitExpression(callee, core.IfElse(ast.IsOptionalChain(parentNode), ast.OperatorPrecedenceOptionalChain, ast.OperatorPrecedenceMember))
 * 	}
 * }
 */
export declare function Printer_emitCallee(receiver: GoPtr<Printer>, callee: GoPtr<Expression>, parentNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCallExpression","kind":"method","status":"implemented","sigHash":"1994ccbe01bcfb3897e9db58cb64e272d9371f5544bdfc849af042959f5c7ece","bodyHash":"d5aee93be355193554920d8818bb90b486c56bb3125c58186e97e0702de75767"}
 *
 * Go source:
 * func (p *Printer) emitCallExpression(node *ast.CallExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitCallee(node.Expression, node.AsNode())
 * 	p.emitTokenNode(node.QuestionDotToken)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.emitList((*Printer).emitArgument, node.AsNode(), node.Arguments, LFCallExpressionArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitCallExpression(receiver: GoPtr<Printer>, node: GoPtr<CallExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNewExpression","kind":"method","status":"implemented","sigHash":"f5c512608dec1df270e647a42649d4e0d14172341b57fb8d922363d861a5eedc","bodyHash":"794606f532e331e72e32e605c1d4d4941182187a9cf04d8d2227faf739f1bf30"}
 *
 * Go source:
 * func (p *Printer) emitNewExpression(node *ast.NewExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindNewKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	if ast.SkipPartiallyEmittedExpressions(node.Expression).Kind == ast.KindCallExpression {
 * 		// Parenthesize `C()` inside of a NewExpression so it is treated as `new (C())` and not `new C()`
 * 		p.emitExpression(node.Expression, ast.OperatorPrecedenceParentheses)
 * 	} else {
 * 		p.emitExpression(node.Expression, ast.OperatorPrecedenceMember)
 * 	}
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.emitList((*Printer).emitArgument, node.AsNode(), node.Arguments, LFNewExpressionArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitNewExpression(receiver: GoPtr<Printer>, node: GoPtr<NewExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateLiteral","kind":"method","status":"implemented","sigHash":"495bb9ee7c5389100497b4e2b3a9cd366a37dee44d67f4fcad36cfe352bc2ce4","bodyHash":"3f997ad71e690a344e286794d88feb8e1632169e06cf7b4677551b5889ae4ea5"}
 *
 * Go source:
 * func (p *Printer) emitTemplateLiteral(node *ast.TemplateLiteral) {
 * 	switch node.Kind {
 * 	case ast.KindNoSubstitutionTemplateLiteral:
 * 		p.emitNoSubstitutionTemplateLiteral(node.AsNoSubstitutionTemplateLiteral())
 * 	case ast.KindTemplateExpression:
 * 		p.emitTemplateExpression(node.AsTemplateExpression())
 * 	default:
 * 		panic(fmt.Sprintf("unhandled TemplateLiteral: %v", node.Kind))
 * 	}
 * }
 */
export declare function Printer_emitTemplateLiteral(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"97bf872b5922572f01211cfadc1ffef227b0a4bc83c6ab8560e09b8b8fa020da","bodyHash":"be1d11e885853072c943e2700bdd34c8057384486e4934d4242e0cec46786cc5"}
 *
 * Go source:
 * func (p *Printer) emitTaggedTemplateExpression(node *ast.TaggedTemplateExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitCallee(node.Tag, node.AsNode())
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.writeSpace()
 * 	p.emitTemplateLiteral(node.Template)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTaggedTemplateExpression(receiver: GoPtr<Printer>, node: GoPtr<TaggedTemplateExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"4073eb94b72a8c15465cd80bbc4a245e7bcbdaaa5d58ed74161cf252b20ea3cf","bodyHash":"345c5e0d0ec260154c82d077fde5bedc1f9e1ee2ca7908571b44c0777cdc693b"}
 *
 * Go source:
 * func (p *Printer) emitParenthesizedExpression(node *ast.ParenthesizedExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	openParenPos := p.emitToken(ast.KindOpenParenToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	indented := p.writeLineSeparatorsAndIndentBefore(node.Expression, node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceComma)
 * 	p.writeLineSeparatorsAfter(node.Expression, node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	closeParenPos := openParenPos
 * 	if node.Expression != nil {
 * 		closeParenPos = node.Expression.End()
 * 	}
 * 	p.emitToken(ast.KindCloseParenToken, closeParenPos, WriteKindPunctuation, node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitParenthesizedExpression(receiver: GoPtr<Printer>, node: GoPtr<ParenthesizedExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitFunctionExpression","kind":"method","status":"implemented","sigHash":"9898c078cf9caef289711b35d90b302843c3f2e8d20f8aebf5ac2d8ea2b5a66c","bodyHash":"d320a22669ad4182040c4d4c9a69a93f6cc295c5b1856ad6468c9e1acbd509e8"}
 *
 * Go source:
 * func (p *Printer) emitFunctionExpression(node *ast.FunctionExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNameIfNeeded(node.Name())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("function")
 * 	p.emitTokenNode(node.AsteriskToken)
 * 	p.writeSpace()
 * 	p.emitIdentifierNameNode(node.Name())
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
export declare function Printer_emitFunctionExpression(receiver: GoPtr<Printer>, node: GoPtr<FunctionExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArrowFunction","kind":"method","status":"implemented","sigHash":"138c4bd0ce6895a1b8b9b4d35b33fa1bdd711e14047477aefa16fb09e41cdc3a","bodyHash":"fd484b08a21301c9a600584c42a626a78c88d16a0f3b8ce2b96bb96ffe0f9690"}
 *
 * Go source:
 * func (p *Printer) emitArrowFunction(node *ast.ArrowFunction) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitParametersForArrow(node.AsNode(), node.Parameters)
 * 	p.emitTypeAnnotation(node.Type)
 * 	p.writeSpace()
 * 	p.emitTokenNode(node.EqualsGreaterThanToken)
 * 	p.writeSpace()
 * 	p.emitConciseBody(node.Body)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitArrowFunction(receiver: GoPtr<Printer>, node: GoPtr<ArrowFunction>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDeleteExpression","kind":"method","status":"implemented","sigHash":"34320705393a0499b99134e0af42ccc61ac1065afd8372b22514b557f67101dd","bodyHash":"b7c0927dd7d0deb8f61ae1cf78462ae2c62a8277c55905f8354bbcfa660f49a0"}
 *
 * Go source:
 * func (p *Printer) emitDeleteExpression(node *ast.DeleteExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindDeleteKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceUnary)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitDeleteExpression(receiver: GoPtr<Printer>, node: GoPtr<DeleteExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitVoidExpression","kind":"method","status":"implemented","sigHash":"8b3df196be7e770d45d21b7b0bee0bcb82c241d6acc9827e0d5315a3706d1dd9","bodyHash":"fb37725af761923646bff57f0883ca479cfa00ccc1d2411393056c6de837a110"}
 *
 * Go source:
 * func (p *Printer) emitVoidExpression(node *ast.VoidExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindVoidKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceUnary)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitVoidExpression(receiver: GoPtr<Printer>, node: GoPtr<VoidExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitAwaitExpression","kind":"method","status":"implemented","sigHash":"8554c82b464983d364e365af1cf8f5a7447b5bdd65c4a3ad0b987ba98ea83777","bodyHash":"368615266d2c6380ba30239dfbfd8915982e9777d81edbc0aeb4d4113f9faaf6"}
 *
 * Go source:
 * func (p *Printer) emitAwaitExpression(node *ast.AwaitExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindAwaitKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceUnary)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitAwaitExpression(receiver: GoPtr<Printer>, node: GoPtr<AwaitExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPrefixUnaryExpression","kind":"method","status":"implemented","sigHash":"ef03203ae33a2afdfa02e93cea8f5cd35c3fc4bfbe36c49a6ddab5b5b527af23","bodyHash":"2f4ac562378ec667f61171887ea49663f664280ddf8eec23ab97874ca75d262a"}
 *
 * Go source:
 * func (p *Printer) emitPrefixUnaryExpression(node *ast.PrefixUnaryExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	operator := node.Operator
 * 	operand := node.Operand
 * 	p.emitToken(operator, node.Pos(), WriteKindOperator, node.AsNode())
 *
 * 	// In some cases, we need to emit a space between the operator and the operand. One obvious case
 * 	// is when the operator is an identifier, like delete or typeof. We also need to do this for plus
 * 	// and minus expressions in certain cases. Specifically, consider the following two cases (parens
 * 	// are just for clarity of exposition, and not part of the source code):
 * 	//
 * 	//  (+(+1))
 * 	//  (+(++1))
 * 	//
 * 	// We need to emit a space in both cases. In the first case, the absence of a space will make
 * 	// the resulting expression a prefix increment operation. And in the second, it will make the resulting
 * 	// expression a prefix increment whose operand is a plus expression - (++(+x))
 * 	// The same is true of minus of course.
 * 	if operand.Kind == ast.KindPrefixUnaryExpression {
 * 		inner := operand.AsPrefixUnaryExpression().Operator
 * 		if (operator == ast.KindPlusToken && (inner == ast.KindPlusToken || inner == ast.KindPlusPlusToken)) ||
 * 			(operator == ast.KindMinusToken && (inner == ast.KindMinusToken || inner == ast.KindMinusMinusToken)) {
 * 			p.writeSpace()
 * 		}
 * 	}
 *
 * 	p.emitExpression(node.Operand, ast.OperatorPrecedenceUnary)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitPrefixUnaryExpression(receiver: GoPtr<Printer>, node: GoPtr<PrefixUnaryExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"eccf8baa9cf66c374508b2b034b3e12a6d3723a021b0b6300b3a4a195102de59","bodyHash":"ffc6d7ec6ef15d00c11f8a8be215d70749c6470898edc6af9e57ce5335f8250f"}
 *
 * Go source:
 * func (p *Printer) emitPostfixUnaryExpression(node *ast.PostfixUnaryExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Operand, ast.OperatorPrecedenceLeftHandSide)
 * 	p.emitToken(node.Operator, node.Operand.End(), WriteKindOperator, node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitPostfixUnaryExpression(receiver: GoPtr<Printer>, node: GoPtr<PostfixUnaryExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getLiteralKindOfBinaryPlusOperand","kind":"method","status":"implemented","sigHash":"704a5db1ef12049fd0c246876c7fde89fc92a48cc8a41d25d1c8ab0b9bdfd322","bodyHash":"c1cf19714a043cddcdd8dcedef53986c8fb5e73e66e7b7fc2e7b19b4fc0f8d14"}
 *
 * Go source:
 * func (p *Printer) getLiteralKindOfBinaryPlusOperand(node *ast.Expression) ast.Kind {
 * 	node = ast.SkipPartiallyEmittedExpressions(node)
 *
 * 	if ast.IsLiteralKind(node.Kind) {
 * 		return node.Kind
 * 	}
 *
 * 	if node.Kind == ast.KindBinaryExpression {
 * 		if n := node.AsBinaryExpression(); n.OperatorToken.Kind == ast.KindPlusToken {
 * 			// !!! Determine if caching this is worthwhile over recomputing
 * 			////if n.cachedLiteralKind != KindUnknown {
 * 			////	return n.cachedLiteralKind;
 * 			////}
 *
 * 			leftKind := p.getLiteralKindOfBinaryPlusOperand(n.Left)
 * 			literalKind := ast.KindUnknown
 * 			if ast.IsLiteralKind(leftKind) && leftKind == p.getLiteralKindOfBinaryPlusOperand(n.Right) {
 * 				literalKind = leftKind
 * 			}
 *
 * 			////n.cachedLiteralKind = literalKind;
 * 			return literalKind
 * 		}
 * 	}
 *
 * 	return ast.KindUnknown
 * }
 */
export declare function Printer_getLiteralKindOfBinaryPlusOperand(receiver: GoPtr<Printer>, node: GoPtr<Expression>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getBinaryExpressionPrecedence","kind":"method","status":"implemented","sigHash":"72213047859f17c84ce14a87f8f3fce62582b9762d13ea160dc8e7795a20e555","bodyHash":"c99a733aea09d91f03fdd81a54b534cbaa305bd95df0f009df0baf71c739c61d"}
 *
 * Go source:
 * func (p *Printer) getBinaryExpressionPrecedence(node *ast.BinaryExpression) (leftPrec ast.OperatorPrecedence, rightPrec ast.OperatorPrecedence) {
 * 	precedence := ast.GetExpressionPrecedence(node.AsNode())
 * 	leftPrec = precedence
 * 	rightPrec = precedence
 * 	switch precedence {
 * 	case ast.OperatorPrecedenceComma:
 * 		// No need to parenthesize the right operand when the binary operator and
 * 		// operand are both ,:
 * 		//  x,(a,b)     => x,a,b
 * 		break
 * 	case ast.OperatorPrecedenceAssignment:
 * 		// assignment is right-associative
 * 		leftPrec = ast.OperatorPrecedenceConditional
 * 		rightPrec = ast.OperatorPrecedenceYield
 * 	case ast.OperatorPrecedenceLogicalOR:
 * 		rightPrec = ast.OperatorPrecedenceLogicalAND
 * 	case ast.OperatorPrecedenceLogicalAND:
 * 		rightPrec = ast.OperatorPrecedenceBitwiseOR
 * 	case ast.OperatorPrecedenceBitwiseOR:
 * 		// No need to parenthesize the right operand when the binary operator and
 * 		// operand are both | due to the associative property of mathematics:
 * 		//  x|(a|b)     => x|a|b
 * 		break
 * 	case ast.OperatorPrecedenceBitwiseXOR:
 * 		// No need to parenthesize the right operand when the binary operator and
 * 		// operand are both ^ due to the associative property of mathematics:
 * 		//  x^(a^b)     => x^a^b
 * 		break
 * 	case ast.OperatorPrecedenceBitwiseAND:
 * 		// No need to parenthesize the right operand when the binary operator and
 * 		// operand are both & due to the associative property of mathematics:
 * 		//  x&(a&b)     => x&a&b
 * 		break
 * 	case ast.OperatorPrecedenceEquality:
 * 		rightPrec = ast.OperatorPrecedenceRelational
 * 	case ast.OperatorPrecedenceRelational:
 * 		rightPrec = ast.OperatorPrecedenceShift
 * 	case ast.OperatorPrecedenceShift:
 * 		rightPrec = ast.OperatorPrecedenceAdditive
 * 	case ast.OperatorPrecedenceAdditive:
 * 		if node.OperatorToken.Kind == ast.KindPlusToken && isBinaryOperation(node.Right, ast.KindPlusToken) {
 * 			leftKind := p.getLiteralKindOfBinaryPlusOperand(node.Left)
 * 			if ast.IsLiteralKind(leftKind) && leftKind == p.getLiteralKindOfBinaryPlusOperand(node.Right) {
 * 				// No need to parenthesize the right operand when the binary operator
 * 				// is plus (+) if both the left and right operands consist solely of either
 * 				// literals of the same kind or binary plus (+) expressions for literals of
 * 				// the same kind (recursively).
 * 				//  "a"+(1+2)       => "a"+(1+2)
 * 				//  "a"+("b"+"c")   => "a"+"b"+"c"
 * 				break
 * 			}
 * 		}
 * 		rightPrec = ast.OperatorPrecedenceMultiplicative
 * 	case ast.OperatorPrecedenceMultiplicative:
 * 		if node.OperatorToken.Kind == ast.KindAsteriskToken && isBinaryOperation(node.Right, ast.KindAsteriskToken) {
 * 			// No need to parenthesize the right operand when the binary operator and
 * 			// operand are both * due to the associative property of mathematics:
 * 			//  x*(a*b)     => x*a*b
 * 			break
 * 		}
 * 		rightPrec = ast.OperatorPrecedenceExponentiation
 * 	case ast.OperatorPrecedenceExponentiation:
 * 		// exponentiation is right-associative
 * 		leftPrec = ast.OperatorPrecedenceUpdate
 * 	default:
 * 		panic(fmt.Sprintf("unhandled precedence: %v", precedence))
 * 	}
 * 	return leftPrec, rightPrec
 * }
 */
export declare function Printer_getBinaryExpressionPrecedence(receiver: GoPtr<Printer>, node: GoPtr<BinaryExpression>): [OperatorPrecedence, OperatorPrecedence];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitBinaryExpression","kind":"method","status":"implemented","sigHash":"e4a7380c7cd96de717cb6d1665535f40b3176d9281bcb70122567e463b839417","bodyHash":"c0eb920a4f84854c02b2d22a721232f38fe330f486a2ad73d15b99691352a540"}
 *
 * Go source:
 * func (p *Printer) emitBinaryExpression(node *ast.BinaryExpression) {
 * 	leftPrec, rightPrec := p.getBinaryExpressionPrecedence(node)
 * 	if emittedLeft := ast.SkipPartiallyEmittedExpressions(node.Left); ast.NodeIsSynthesized(emittedLeft) && emittedLeft.Kind == ast.KindBinaryExpression && mixingBinaryOperatorsRequiresParentheses(node.OperatorToken.Kind, emittedLeft.AsBinaryExpression().OperatorToken.Kind) {
 * 		leftPrec = ast.OperatorPrecedenceHighest
 * 	}
 * 	if emittedRight := ast.SkipPartiallyEmittedExpressions(node.Right); ast.NodeIsSynthesized(emittedRight) && emittedRight.Kind == ast.KindBinaryExpression && mixingBinaryOperatorsRequiresParentheses(node.OperatorToken.Kind, emittedRight.AsBinaryExpression().OperatorToken.Kind) {
 * 		rightPrec = ast.OperatorPrecedenceHighest
 * 	}
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Left, leftPrec)
 * 	linesBeforeOperator := p.getLinesBetweenNodes(node.AsNode(), node.Left, node.OperatorToken)
 * 	linesAfterOperator := p.getLinesBetweenNodes(node.AsNode(), node.OperatorToken, node.Right)
 * 	p.writeLinesAndIndent(linesBeforeOperator, node.OperatorToken.Kind != ast.KindCommaToken /*writeSpaceIfNotIndenting* /)
 * 	p.emitTokenNodeEx(node.OperatorToken, tefNoSourceMaps)
 * 	p.writeLinesAndIndent(linesAfterOperator, true /*writeSpaceIfNotIndenting* /) // Binary operators should have a space before the comment starts
 * 	p.emitExpression(node.Right, rightPrec)
 * 	p.decreaseIndentIf(linesAfterOperator > 0)
 * 	p.decreaseIndentIf(linesBeforeOperator > 0)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitBinaryExpression(receiver: GoPtr<Printer>, node: GoPtr<BinaryExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitShortCircuitExpression","kind":"method","status":"implemented","sigHash":"9ea404e59d9e4bdee066638e7f80e9fb418de1af10c732337bd990206b518d78","bodyHash":"3d80cc07c77807dd82a98c58f49e35024fc52f1ff7dc1581f80863875f905cf3"}
 *
 * Go source:
 * func (p *Printer) emitShortCircuitExpression(node *ast.Expression) {
 * 	if isBinaryOperation(ast.SkipPartiallyEmittedExpressions(node), ast.KindQuestionQuestionToken) {
 * 		p.emitExpression(node, ast.OperatorPrecedenceCoalesce)
 * 	} else {
 * 		p.emitExpression(node, ast.OperatorPrecedenceLogicalOR)
 * 	}
 * }
 */
export declare function Printer_emitShortCircuitExpression(receiver: GoPtr<Printer>, node: GoPtr<Expression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConditionalExpression","kind":"method","status":"implemented","sigHash":"af70a982bbeccf8eccd49471f39ed72916728c8b53b58632e1a716966e7c4e83","bodyHash":"0bb92cb7e4f4e3874ce973bd88a24d41bd2594d18e80641acd8d0f73fc6e0dd4"}
 *
 * Go source:
 * func (p *Printer) emitConditionalExpression(node *ast.ConditionalExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	linesBeforeQuestion := p.getLinesBetweenNodes(node.AsNode(), node.Condition, node.QuestionToken)
 * 	linesAfterQuestion := p.getLinesBetweenNodes(node.AsNode(), node.QuestionToken, node.WhenTrue)
 * 	linesBeforeColon := p.getLinesBetweenNodes(node.AsNode(), node.WhenTrue, node.ColonToken)
 * 	linesAfterColon := p.getLinesBetweenNodes(node.AsNode(), node.ColonToken, node.WhenFalse)
 * 	p.emitShortCircuitExpression(node.Condition)
 * 	p.writeLinesAndIndent(linesBeforeQuestion /*writeSpaceIfNotIndenting* /, true)
 * 	p.emitPunctuationNode(node.QuestionToken)
 * 	p.writeLinesAndIndent(linesAfterQuestion /*writeSpaceIfNotIndenting* /, true)
 * 	p.emitExpression(node.WhenTrue, ast.OperatorPrecedenceYield)
 * 	p.decreaseIndentIf(linesAfterQuestion > 0)
 * 	p.decreaseIndentIf(linesBeforeQuestion > 0)
 * 	p.writeLinesAndIndent(linesBeforeColon /*writeSpaceIfNotIndenting* /, true)
 * 	p.emitPunctuationNode(node.ColonToken)
 * 	p.writeLinesAndIndent(linesAfterColon /*writeSpaceIfNotIndenting* /, true)
 * 	p.emitExpression(node.WhenFalse, ast.OperatorPrecedenceYield)
 * 	p.decreaseIndentIf(linesAfterColon > 0)
 * 	p.decreaseIndentIf(linesBeforeColon > 0)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitConditionalExpression(receiver: GoPtr<Printer>, node: GoPtr<ConditionalExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateExpression","kind":"method","status":"implemented","sigHash":"1545ee2ced4c03b3465b4cdcee6bb86a370c8d260bd32de3fed0afea20a4c556","bodyHash":"f33e4e1676c3528c849b30e0054c81b63f1436fa662ca5424601fbdf152294c3"}
 *
 * Go source:
 * func (p *Printer) emitTemplateExpression(node *ast.TemplateExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTemplateHead(node.Head.AsTemplateHead())
 * 	p.emitList((*Printer).emitTemplateSpanNode, node.AsNode(), node.TemplateSpans, LFTemplateExpressionSpans)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateExpression(receiver: GoPtr<Printer>, node: GoPtr<TemplateExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitYieldExpression","kind":"method","status":"implemented","sigHash":"5d4ce5a4a222682faf5c4b9280cb2b2e6e2161f34a4c8d0b89860f48fa9ed8f3","bodyHash":"73e29d4ce5845f9fc1c08d1bff87d6680e5780a4e2202d8854fc65c0f87fa812"}
 *
 * Go source:
 * func (p *Printer) emitYieldExpression(node *ast.YieldExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindYieldKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.emitPunctuationNode(node.AsteriskToken)
 * 	if node.Expression != nil {
 * 		p.writeSpace()
 * 		p.emitExpressionNoASI(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitYieldExpression(receiver: GoPtr<Printer>, node: GoPtr<YieldExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSpreadElement","kind":"method","status":"implemented","sigHash":"6ecf99d373ff24f3328fef9fb38e279b21474f533aaa8ee369fc7684fa297a5b","bodyHash":"6b1251f6a50fb491120ec0ebf41f3b522bf7695fc35168a1a4c38a146e639d2a"}
 *
 * Go source:
 * func (p *Printer) emitSpreadElement(node *ast.SpreadElement) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindDotDotDotToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitSpreadElement(receiver: GoPtr<Printer>, node: GoPtr<SpreadElement>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitClassExpression","kind":"method","status":"implemented","sigHash":"7e68029a47a1bf53d67d9060ddcf79c047f9f0e0bd2912aa6e767942d45dc4e8","bodyHash":"88440b11e3c704db7a6e008a74e3a602dcbf137d5db9a2e33e4a4e67e78aaba2"}
 *
 * Go source:
 * func (p *Printer) emitClassExpression(node *ast.ClassExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.generateNameIfNeeded(node.Name())
 *
 * 	pos := p.emitModifierList(node.AsNode(), node.Modifiers(), true /*allowDecorators* /)
 * 	p.emitToken(ast.KindClassKeyword, pos, WriteKindKeyword, node.AsNode())
 *
 * 	if node.Name() != nil {
 * 		p.writeSpace()
 * 		p.emitIdentifierName(node.Name().AsIdentifier())
 * 	}
 *
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 *
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitList((*Printer).emitHeritageClauseNode, node.AsNode(), node.HeritageClauses, LFClassHeritageClauses)
 * 	p.writeSpace()
 * 	p.writePunctuation("{")
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllMemberNames(node.Members)
 * 	p.emitList((*Printer).emitClassElement, node.AsNode(), node.Members, LFClassMembers)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.writePunctuation("}")
 *
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitClassExpression(receiver: GoPtr<Printer>, node: GoPtr<ClassExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitOmittedExpression","kind":"method","status":"implemented","sigHash":"a6870896f6b9f9db561b121dbf1dd803b3850ec787f271c5a0a19c648d5974fd","bodyHash":"91adcc357f64339635e648632f2a0f2d39025a75e0d9376d1c520a1a246486ee"}
 *
 * Go source:
 * func (p *Printer) emitOmittedExpression(node *ast.Node) {
 * 	p.exitNode(node, p.enterNode(node))
 * }
 */
export declare function Printer_emitOmittedExpression(receiver: GoPtr<Printer>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitAsExpression","kind":"method","status":"implemented","sigHash":"762f96c2b8bf0d7dee98c4a8a2c3c3aae8c8e173384f5dc27e6ce9c71891e029","bodyHash":"a74da5c2a393868759befedcbe99576c63e7631ba53ee11f2e424917e078d8ef"}
 *
 * Go source:
 * func (p *Printer) emitAsExpression(node *ast.AsExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceRelational)
 * 	p.writeSpace()
 * 	p.writeKeyword("as")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitAsExpression(receiver: GoPtr<Printer>, node: GoPtr<AsExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSatisfiesExpression","kind":"method","status":"implemented","sigHash":"b4a3a7efa5c1acad7769723759e6966acb782d6c12a4623201aaeae7b2b6d67f","bodyHash":"b3fb60c91b643d2f10ed2ce3e1036fb768a3c5e22c03af395daf5b407e7d4728"}
 *
 * Go source:
 * func (p *Printer) emitSatisfiesExpression(node *ast.SatisfiesExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceRelational)
 * 	p.writeSpace()
 * 	p.writeKeyword("satisfies")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitSatisfiesExpression(receiver: GoPtr<Printer>, node: GoPtr<SatisfiesExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNonNullExpression","kind":"method","status":"implemented","sigHash":"fd72d17f883936d8e8f68e5319f66b507fa4c33bcc90d7a28ec385d0163c3de1","bodyHash":"45458c0ac74b943f545ec0ec4d43ef976d159456a8d20c52b59c7dd8aae78e9d"}
 *
 * Go source:
 * func (p *Printer) emitNonNullExpression(node *ast.NonNullExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceMember)
 * 	p.writeOperator("!")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitNonNullExpression(receiver: GoPtr<Printer>, node: GoPtr<NonNullExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPartiallyEmittedExpression","kind":"method","status":"implemented","sigHash":"119b7079e17c9915b1e1efd7db4301b349dcbe256d7c2561f74a1d8a93fc3c67","bodyHash":"5346b51bb99a0e5d3afd5320daa90af2739871231f54cc3f83245a9e35529826"}
 *
 * Go source:
 * func (p *Printer) emitPartiallyEmittedExpression(node *ast.PartiallyEmittedExpression) {
 * 	// avoid reprinting parens for nested partially emitted expressions
 * 	type entry struct {
 * 		node  *ast.PartiallyEmittedExpression
 * 		state printerState
 * 	}
 * 	var stack core.Stack[entry]
 * 	for {
 * 		state := p.enterNode(node.AsNode())
 * 		emitFlags := p.emitContext.EmitFlags(node.AsNode())
 * 		if emitFlags&EFNoLeadingComments == 0 && node.Pos() != node.Expression.Pos() {
 * 			p.emitTrailingCommentsOfPosition(node.Expression.Pos(), false /*prefixSpace* /, false /*forceNoNewline* /)
 * 		}
 * 		stack.Push(entry{node, state})
 * 		if !ast.IsPartiallyEmittedExpression(node.Expression) {
 * 			break
 * 		}
 * 		node = node.Expression.AsPartiallyEmittedExpression()
 * 	}
 *
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 *
 * 	// unwind stack
 * 	for stack.Len() > 0 {
 * 		entry := stack.Pop()
 * 		emitFlags := p.emitContext.EmitFlags(node.AsNode())
 * 		if emitFlags&EFNoTrailingComments == 0 && node.End() != node.Expression.End() {
 * 			p.emitLeadingCommentsOfPosition(node.Expression.End())
 * 		}
 * 		p.exitNode(node.AsNode(), entry.state)
 * 		node = entry.node
 * 	}
 * }
 */
export declare function Printer_emitPartiallyEmittedExpression(receiver: GoPtr<Printer>, node: GoPtr<PartiallyEmittedExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.parenthesizeExpressionForNoAsi","kind":"method","status":"implemented","sigHash":"f71dbabc7310ab330d34af2a55c0731a1c2b920d75c05644b76c025784262b0b","bodyHash":"07cd171e7dd5fef1e776a8a543187fd78d4d8ca22c81da13fc77a8647cbe3d6e"}
 *
 * Go source:
 * func (p *Printer) parenthesizeExpressionForNoAsi(node *ast.Expression) *ast.Expression {
 * 	if !p.commentsDisabled {
 * 		switch node.Kind {
 * 		case ast.KindPartiallyEmittedExpression:
 * 			if p.willEmitLeadingNewLine(node) {
 * 				pee := node.AsPartiallyEmittedExpression()
 * 				parseNode := p.emitContext.ParseNode(node)
 * 				if parseNode != nil && ast.IsParenthesizedExpression(parseNode) {
 * 					// If the original node was a parenthesized expression, restore it to preserve comment and source map emit
 * 					parens := p.emitContext.Factory.NewParenthesizedExpression(pee.Expression)
 * 					p.emitContext.SetOriginal(parens, node)
 * 					parens.Loc = parseNode.Loc
 * 					return parens
 * 				}
 * 				return p.emitContext.Factory.NewParenthesizedExpression(node)
 * 			}
 * 			pee := node.AsPartiallyEmittedExpression()
 * 			return p.emitContext.Factory.UpdatePartiallyEmittedExpression(
 * 				pee,
 * 				p.parenthesizeExpressionForNoAsi(pee.Expression),
 * 			)
 * 		case ast.KindPropertyAccessExpression:
 * 			pae := node.AsPropertyAccessExpression()
 * 			return p.emitContext.Factory.UpdatePropertyAccessExpression(
 * 				pae,
 * 				p.parenthesizeExpressionForNoAsi(pae.Expression),
 * 				pae.QuestionDotToken,
 * 				pae.Name(),
 * 				pae.Flags,
 * 			)
 * 		case ast.KindElementAccessExpression:
 * 			eae := node.AsElementAccessExpression()
 * 			return p.emitContext.Factory.UpdateElementAccessExpression(
 * 				eae,
 * 				p.parenthesizeExpressionForNoAsi(eae.Expression),
 * 				eae.QuestionDotToken,
 * 				eae.ArgumentExpression,
 * 				eae.Flags,
 * 			)
 * 		case ast.KindCallExpression:
 * 			ce := node.AsCallExpression()
 * 			return p.emitContext.Factory.UpdateCallExpression(
 * 				ce,
 * 				p.parenthesizeExpressionForNoAsi(ce.Expression),
 * 				ce.QuestionDotToken,
 * 				ce.TypeArguments,
 * 				ce.Arguments,
 * 				ce.Flags,
 * 			)
 * 		case ast.KindTaggedTemplateExpression:
 * 			tte := node.AsTaggedTemplateExpression()
 * 			return p.emitContext.Factory.UpdateTaggedTemplateExpression(
 * 				tte,
 * 				p.parenthesizeExpressionForNoAsi(tte.Tag),
 * 				tte.QuestionDotToken,
 * 				tte.TypeArguments,
 * 				tte.Template,
 * 				tte.Flags,
 * 			)
 * 		case ast.KindPostfixUnaryExpression:
 * 			pue := node.AsPostfixUnaryExpression()
 * 			return p.emitContext.Factory.UpdatePostfixUnaryExpression(
 * 				pue,
 * 				p.parenthesizeExpressionForNoAsi(pue.Operand),
 * 				pue.Operator,
 * 			)
 * 		case ast.KindBinaryExpression:
 * 			be := node.AsBinaryExpression()
 * 			return p.emitContext.Factory.UpdateBinaryExpression(
 * 				be,
 * 				be.Modifiers(),
 * 				p.parenthesizeExpressionForNoAsi(be.Left),
 * 				be.Type,
 * 				be.OperatorToken,
 * 				be.Right,
 * 			)
 * 		case ast.KindConditionalExpression:
 * 			ce := node.AsConditionalExpression()
 * 			return p.emitContext.Factory.UpdateConditionalExpression(
 * 				ce,
 * 				p.parenthesizeExpressionForNoAsi(ce.Condition),
 * 				ce.QuestionToken,
 * 				ce.WhenTrue,
 * 				ce.ColonToken,
 * 				ce.WhenFalse,
 * 			)
 * 		case ast.KindAsExpression:
 * 			ae := node.AsAsExpression()
 * 			return p.emitContext.Factory.UpdateAsExpression(
 * 				ae,
 * 				p.parenthesizeExpressionForNoAsi(ae.Expression),
 * 				ae.Type,
 * 			)
 * 		case ast.KindSatisfiesExpression:
 * 			se := node.AsSatisfiesExpression()
 * 			return p.emitContext.Factory.UpdateSatisfiesExpression(
 * 				se,
 * 				p.parenthesizeExpressionForNoAsi(se.Expression),
 * 				se.Type,
 * 			)
 * 		case ast.KindNonNullExpression:
 * 			nne := node.AsNonNullExpression()
 * 			return p.emitContext.Factory.UpdateNonNullExpression(
 * 				nne,
 * 				p.parenthesizeExpressionForNoAsi(nne.Expression),
 * 				nne.Flags,
 * 			)
 * 		}
 * 	}
 * 	return node
 * }
 */
export declare function Printer_parenthesizeExpressionForNoAsi(receiver: GoPtr<Printer>, node: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExpressionNoASI","kind":"method","status":"implemented","sigHash":"bec7a8e31f1f232984ec490d1b3dfde76ed9fbfa176623b15177980cbd01d33b","bodyHash":"20154102d3da80b50c61a1d1528730106a813464229b262e3bbf796bc62d14f4"}
 *
 * Go source:
 * func (p *Printer) emitExpressionNoASI(node *ast.Expression, precedence ast.OperatorPrecedence) {
 * 	node = p.parenthesizeExpressionForNoAsi(node)
 * 	p.emitExpression(node, precedence)
 * }
 */
export declare function Printer_emitExpressionNoASI(receiver: GoPtr<Printer>, node: GoPtr<Expression>, precedence: OperatorPrecedence): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExpression","kind":"method","status":"implemented","sigHash":"34b08548ebae602b66a1dca09de6ee389531e48eabbb57d1d3a226b5ce4e1aee","bodyHash":"b4c3d3fb80126b6adc55290a36a070bd3f99b8e918542b2bb2640b4fb8d17e65"}
 *
 * Go source:
 * func (p *Printer) emitExpression(node *ast.Expression, precedence ast.OperatorPrecedence) {
 * 	parens := ast.GetExpressionPrecedence(ast.SkipPartiallyEmittedExpressions(node)) < precedence
 * 	if parens {
 * 		p.writePunctuation("(")
 * 	}
 *
 * 	switch node.Kind {
 * 	// Keywords
 * 	case ast.KindTrueKeyword, ast.KindFalseKeyword, ast.KindNullKeyword:
 * 		p.emitTokenNode(node)
 * 	case ast.KindThisKeyword, ast.KindSuperKeyword, ast.KindImportKeyword:
 * 		p.emitKeywordExpression(node.AsKeywordExpression())
 *
 * 	// Literals
 * 	case ast.KindNumericLiteral:
 * 		p.emitNumericLiteral(node.AsNumericLiteral())
 * 	case ast.KindBigIntLiteral:
 * 		p.emitBigIntLiteral(node.AsBigIntLiteral())
 * 	case ast.KindStringLiteral:
 * 		p.emitStringLiteral(node.AsStringLiteral())
 * 	case ast.KindRegularExpressionLiteral:
 * 		p.emitRegularExpressionLiteral(node.AsRegularExpressionLiteral())
 * 	case ast.KindNoSubstitutionTemplateLiteral:
 * 		p.emitNoSubstitutionTemplateLiteral(node.AsNoSubstitutionTemplateLiteral())
 *
 * 	// Identifiers
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierReference(node.AsIdentifier())
 * 	case ast.KindPrivateIdentifier:
 * 		p.emitPrivateIdentifier(node.AsPrivateIdentifier())
 *
 * 	// Expressions
 * 	case ast.KindArrayLiteralExpression:
 * 		p.emitArrayLiteralExpression(node.AsArrayLiteralExpression())
 * 	case ast.KindObjectLiteralExpression:
 * 		p.emitObjectLiteralExpression(node.AsObjectLiteralExpression())
 * 	case ast.KindPropertyAccessExpression:
 * 		p.emitPropertyAccessExpression(node.AsPropertyAccessExpression())
 * 	case ast.KindElementAccessExpression:
 * 		p.emitElementAccessExpression(node.AsElementAccessExpression())
 * 	case ast.KindCallExpression:
 * 		p.emitCallExpression(node.AsCallExpression())
 * 	case ast.KindNewExpression:
 * 		p.emitNewExpression(node.AsNewExpression())
 * 	case ast.KindTaggedTemplateExpression:
 * 		p.emitTaggedTemplateExpression(node.AsTaggedTemplateExpression())
 * 	case ast.KindTypeAssertionExpression:
 * 		p.emitTypeAssertionExpression(node.AsTypeAssertion())
 * 	case ast.KindParenthesizedExpression:
 * 		p.emitParenthesizedExpression(node.AsParenthesizedExpression())
 * 	case ast.KindFunctionExpression:
 * 		p.emitFunctionExpression(node.AsFunctionExpression())
 * 	case ast.KindArrowFunction:
 * 		p.emitArrowFunction(node.AsArrowFunction())
 * 	case ast.KindDeleteExpression:
 * 		p.emitDeleteExpression(node.AsDeleteExpression())
 * 	case ast.KindTypeOfExpression:
 * 		p.emitTypeOfExpression(node.AsTypeOfExpression())
 * 	case ast.KindVoidExpression:
 * 		p.emitVoidExpression(node.AsVoidExpression())
 * 	case ast.KindAwaitExpression:
 * 		p.emitAwaitExpression(node.AsAwaitExpression())
 * 	case ast.KindPrefixUnaryExpression:
 * 		p.emitPrefixUnaryExpression(node.AsPrefixUnaryExpression())
 * 	case ast.KindPostfixUnaryExpression:
 * 		p.emitPostfixUnaryExpression(node.AsPostfixUnaryExpression())
 * 	case ast.KindBinaryExpression:
 * 		p.emitBinaryExpression(node.AsBinaryExpression())
 * 	case ast.KindConditionalExpression:
 * 		p.emitConditionalExpression(node.AsConditionalExpression())
 * 	case ast.KindTemplateExpression:
 * 		p.emitTemplateExpression(node.AsTemplateExpression())
 * 	case ast.KindYieldExpression:
 * 		p.emitYieldExpression(node.AsYieldExpression())
 * 	case ast.KindSpreadElement:
 * 		p.emitSpreadElement(node.AsSpreadElement())
 * 	case ast.KindClassExpression:
 * 		p.emitClassExpression(node.AsClassExpression())
 * 	case ast.KindOmittedExpression:
 * 		p.emitOmittedExpression(node)
 * 	case ast.KindAsExpression:
 * 		p.emitAsExpression(node.AsAsExpression())
 * 	case ast.KindNonNullExpression:
 * 		p.emitNonNullExpression(node.AsNonNullExpression())
 * 	case ast.KindExpressionWithTypeArguments:
 * 		p.emitExpressionWithTypeArguments(node.AsExpressionWithTypeArguments())
 * 	case ast.KindSatisfiesExpression:
 * 		p.emitSatisfiesExpression(node.AsSatisfiesExpression())
 * 	case ast.KindMetaProperty:
 * 		p.emitMetaProperty(node.AsMetaProperty())
 * 	case ast.KindSyntheticExpression:
 * 		panic("SyntheticExpression should never be printed.")
 * 	case ast.KindMissingDeclaration:
 * 		break
 *
 * 	// JSX
 * 	case ast.KindJsxElement:
 * 		p.emitJsxElement(node.AsJsxElement())
 * 	case ast.KindJsxSelfClosingElement:
 * 		p.emitJsxSelfClosingElement(node.AsJsxSelfClosingElement())
 * 	case ast.KindJsxFragment:
 * 		p.emitJsxFragment(node.AsJsxFragment())
 *
 * 	// Synthesized list
 * 	case ast.KindSyntaxList:
 * 		panic("SyntaxList should not be printed")
 *
 * 	// Transformation nodes
 * 	case ast.KindNotEmittedStatement:
 * 		return
 * 	case ast.KindPartiallyEmittedExpression:
 * 		p.emitPartiallyEmittedExpression(node.AsPartiallyEmittedExpression())
 * 	case ast.KindSyntheticReferenceExpression:
 * 		panic("SyntheticReferenceExpression should not be printed")
 *
 * 	default:
 * 		panic(fmt.Sprintf("unexpected Expression: %v", node.Kind))
 * 	}
 *
 * 	if parens {
 * 		p.writePunctuation(")")
 * 	}
 * }
 */
export declare function Printer_emitExpression(receiver: GoPtr<Printer>, node: GoPtr<Expression>, precedence: OperatorPrecedence): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExpressionStatement","kind":"method","status":"implemented","sigHash":"142d8b5af3132ac535d6baf016a72db592b0127b92b1532cc19f335613055d9b","bodyHash":"e2d642f917b5d0db8d2eb505a6ec21813cbcf1870f53c98e47ef14cea5d4b6dd"}
 *
 * Go source:
 * func (p *Printer) emitExpressionStatement(node *ast.ExpressionStatement) {
 * 	state := p.enterNode(node.AsNode())
 *
 * 	if p.currentSourceFile != nil && p.currentSourceFile.ScriptKind == core.ScriptKindJSON {
 * 		// !!! In strada, this was handled by an undefined parenthesizerRule, so this is a hack.
 * 		p.emitExpression(node.Expression, ast.OperatorPrecedenceComma)
 * 	} else if isImmediatelyInvokedFunctionExpressionOrArrowFunction(node.Expression) {
 * 		// For IIFEs, parenthesize just the callee (not the whole call), matching TypeScript's
 * 		// parenthesizeExpressionOfExpressionStatement which wraps the function/arrow in parens:
 * 		//   (function() { })()  -- not (function() { }())
 * 		p.emitIIFEWithParenthesizedCallee(node.Expression)
 * 	} else {
 * 		switch ast.GetLeftmostExpression(node.Expression, false /*stopAtCallExpression* /).Kind {
 * 		case ast.KindFunctionExpression, ast.KindObjectLiteralExpression:
 * 			p.emitExpression(node.Expression, ast.OperatorPrecedenceParentheses)
 * 		default:
 * 			p.emitExpression(node.Expression, ast.OperatorPrecedenceComma)
 * 		}
 * 	}
 *
 * 	// Emit semicolon in non json files
 * 	// or if json file that created synthesized expression(eg.define expression statement when --out and amd code generation)
 * 	if p.currentSourceFile == nil ||
 * 		p.currentSourceFile.ScriptKind != core.ScriptKindJSON ||
 * 		ast.NodeIsSynthesized(node.Expression) {
 * 		p.writeTrailingSemicolon()
 * 	}
 *
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitExpressionStatement(receiver: GoPtr<Printer>, node: GoPtr<ExpressionStatement>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIIFEWithParenthesizedCallee","kind":"method","status":"implemented","sigHash":"47d76dfc50cee17f81512e78c873b3d9a32ae2bc77ee0e6726133c0e056e0522","bodyHash":"b554e05bc2fd968201babd6e1819353a7d69a226375669e378791bf4c83c2761"}
 *
 * Go source:
 * func (p *Printer) emitIIFEWithParenthesizedCallee(node *ast.Expression) {
 * 	// Walk through PartiallyEmittedExpression wrappers to find the call
 * 	call := ast.SkipPartiallyEmittedExpressions(node).AsCallExpression()
 * 	state := p.enterNode(call.AsNode())
 * 	// Emit the callee wrapped in parens
 * 	p.writePunctuation("(")
 * 	p.emitExpression(call.Expression, ast.OperatorPrecedenceLowest)
 * 	p.writePunctuation(")")
 * 	p.emitTokenNode(call.QuestionDotToken)
 * 	p.emitTypeArguments(call.AsNode(), call.TypeArguments)
 * 	p.emitList((*Printer).emitArgument, call.AsNode(), call.Arguments, LFCallExpressionArguments)
 * 	p.exitNode(call.AsNode(), state)
 * }
 */
export declare function Printer_emitIIFEWithParenthesizedCallee(receiver: GoPtr<Printer>, node: GoPtr<Expression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxSpreadAttribute","kind":"method","status":"implemented","sigHash":"f297418bbdf32defca5a26a523319136d81afeea5bffd53cb6afdb370aa91282","bodyHash":"5f6be0929fe9310d25c63c45d8f70f38a5a9b2e304be88a47e8df3ee24fc885b"}
 *
 * Go source:
 * func (p *Printer) emitJsxSpreadAttribute(node *ast.JsxSpreadAttribute) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("{...")
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceLowest)
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitJsxSpreadAttribute(receiver: GoPtr<Printer>, node: GoPtr<JsxSpreadAttribute>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJsxExpression","kind":"method","status":"implemented","sigHash":"7e7fdb308b77a214a349468c719b241da633c105fb39fa477281577a86144686","bodyHash":"8e535d456779e7070d23b5ec3695bdba7905733787db7179d61a0d91f8e072dc"}
 *
 * Go source:
 * func (p *Printer) emitJsxExpression(node *ast.JsxExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.Expression != nil || !p.commentsDisabled && !ast.NodeIsSynthesized(node.AsNode()) && p.hasCommentsAtPosition(node.Pos()) { // preserve empty expressions if they contain comments!
 * 		indented := p.currentSourceFile != nil && !ast.NodeIsSynthesized(node.AsNode()) && GetLinesBetweenPositions(p.currentSourceFile, node.Pos(), node.End()) != 0
 * 		p.increaseIndentIf(indented)
 * 		end := p.emitToken(ast.KindOpenBraceToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 		p.emitTokenNode(node.DotDotDotToken)
 * 		if node.Expression != nil {
 * 			p.emitExpression(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 		}
 * 		p.emitToken(ast.KindCloseBraceToken, greatestEnd(end, node.Expression, node.DotDotDotToken), WriteKindPunctuation, node.AsNode())
 * 		p.decreaseIndentIf(indented)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitJsxExpression(receiver: GoPtr<Printer>, node: GoPtr<JsxExpression>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSpreadAssignment","kind":"method","status":"implemented","sigHash":"ea2f307118d06bc97a316acf6625eb68267ed3ec90e24200530b355225ea8c84","bodyHash":"7898adc8b7d34034ddc450c12e058bcb51c756a5d2a6825a42467f983c10be2a"}
 *
 * Go source:
 * func (p *Printer) emitSpreadAssignment(node *ast.SpreadAssignment) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.Expression != nil {
 * 		p.emitToken(ast.KindDotDotDotToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 		p.emitExpression(node.Expression, ast.OperatorPrecedenceDisallowComma)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitSpreadAssignment(receiver: GoPtr<Printer>, node: GoPtr<SpreadAssignment>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEnumMember","kind":"method","status":"implemented","sigHash":"5b2a4d51b14a5c4140c6dba6a90f7bed7496d14ea56f6a9e59291d18f039cc70","bodyHash":"e7212487408c7a5d9ac477676a1e44916cefb35c09c39185323e182131216a37"}
 *
 * Go source:
 * func (p *Printer) emitEnumMember(node *ast.EnumMember) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPropertyName(node.Name())
 * 	p.emitInitializer(node.Initializer, node.Name().End(), node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitEnumMember(receiver: GoPtr<Printer>, node: GoPtr<EnumMember>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitEnumMemberNode","kind":"method","status":"implemented","sigHash":"df0d083d32dba6f41ed2d89d93f66a9e3621a56aada513b91581bfdf13d592d5","bodyHash":"e7ae9eef72ee518e9989927236058a61d9495f27497520c00b4f5160e72214e5"}
 *
 * Go source:
 * func (p *Printer) emitEnumMemberNode(node *ast.EnumMemberNode) {
 * 	p.emitEnumMember(node.AsEnumMember())
 * }
 */
export declare function Printer_emitEnumMemberNode(receiver: GoPtr<Printer>, node: GoPtr<EnumMemberNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateAllMemberNames","kind":"method","status":"implemented","sigHash":"a23416451356c44211f88519022b33a5f6e4c1769503d7f30ca3d7ca70a0c694","bodyHash":"bebf80718c9413c292db6b61345df8865c7f385aeb4b5d9c6b8cf161b2472853"}
 *
 * Go source:
 * func (p *Printer) generateAllMemberNames(nodes *ast.NodeList) {
 * 	if nodes == nil {
 * 		return
 * 	}
 * 	for _, node := range nodes.Nodes {
 * 		p.generateMemberNames(node)
 * 	}
 * }
 */
export declare function Printer_generateAllMemberNames(receiver: GoPtr<Printer>, nodes: GoPtr<NodeList>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.generateMemberNames","kind":"method","status":"implemented","sigHash":"820532bba79a6600ab3e2adb5115b9aa6c4514b732a5e7ba9ff3d20b19aa4b4f","bodyHash":"d30dd7790696e42c539c0eb7cdcfea37e91cc8ef586f1a7c0f5bd9a30aabd757"}
 *
 * Go source:
 * func (p *Printer) generateMemberNames(node *ast.Node) {
 * 	if node == nil {
 * 		return
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindPropertyAssignment,
 * 		ast.KindShorthandPropertyAssignment,
 * 		ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindMethodSignature,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor:
 * 		p.generateNameIfNeeded(node.Name())
 * 	}
 * }
 */
export declare function Printer_generateMemberNames(receiver: GoPtr<Printer>, node: GoPtr<Node>): void;
//# sourceMappingURL=expressions.d.ts.map
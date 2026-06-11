import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Itoa } from "../../go/strconv.js";
import type { Node, NodeList, NodeFactoryCoercible } from "../ast/spine.js";
import { NewNodeFactory as NewAstNodeFactory, NodeFactory_AsNodeFactory, NodeFactory_NewNodeList, Node_Clone, Node_Name } from "../ast/spine.js";
import type { NodeFactory as NodeFactory_88523d1c } from "../ast/generated/factory.js";
import type { LabeledStatement, NonNullExpression, ParenthesizedExpression, PartiallyEmittedExpression, SatisfiesExpression, AsExpression, ExpressionWithTypeArguments, VariableDeclaration, VariableDeclarationList } from "../ast/generated/data.js";
import { GetNonAssignedNameOfDeclaration, GetNameOfDeclaration, HasSyntacticModifier, IsMemberName, IsNodeDescendantOf, IsPrologueDirective, NodeIsSynthesized, RangeIsSynthesized, GetNodeId, TryGetPropertyNameOfBindingOrAssignmentElement, IsOuterExpression, OEKAll } from "../ast/utilities.js";
import { Node_Expression, Node_Text, Node_Type, Node_TypeArgumentList, NodeFactory_UpdateAsExpression, NodeFactory_UpdateExpressionWithTypeArguments, NodeFactory_UpdateLabeledStatement, NodeFactory_UpdateNonNullExpression, NodeFactory_UpdateParenthesizedExpression, NodeFactory_UpdatePartiallyEmittedExpression, NodeFactory_UpdateSatisfiesExpression, NodeFactory_UpdateVariableDeclaration, NodeFactory_UpdateVariableDeclarationList } from "../ast/ast.js";
import { ModifierFlagsExport } from "../ast/modifierflags.js";
import { FormatGeneratedName } from "./utilities.js";
import {
  NewArrayLiteralExpression,
  NewArrowFunction,
  NewBinaryExpression,
  NewBlock,
  NewCallExpression,
  NewConditionalExpression,
  NewElementAccessExpression,
  NewExportAssignment,
  NewExportDeclaration,
  NewExportSpecifier,
  NewExpressionStatement,
  NewFunctionExpression,
  NewIdentifier,
  NewKeywordExpression,
  NewNamedExports,
  NewNumericLiteral,
  NewObjectLiteralExpression,
  NewParameterDeclaration,
  NewParenthesizedExpression,
  NewPrivateIdentifier,
  NewPropertyAccessExpression,
  NewPropertyAssignment,
  NewSetAccessorDeclaration,
  NewStringLiteral,
  NewToken,
  NewTypeOfExpression,
  NewVariableDeclarationList,
  NewVariableStatement,
  NewVoidExpression,
} from "../ast/generated/factory.js";
import type { BlockNode, Declaration, Expression, IdentifierNode, PrivateIdentifierNode, Statement, StringLiteralNode, VariableDeclarationNodeList } from "../ast/generated/unions.js";
import { AsBinaryExpression, AsAsExpression, AsExpressionWithTypeArguments, AsLabeledStatement, AsNonNullExpression, AsParenthesizedExpression, AsPartiallyEmittedExpression, AsQualifiedName, AsSatisfiesExpression, AsTypeAssertion, AsVariableDeclaration, AsVariableDeclarationList } from "../ast/generated/casts.js";
import { IsBinaryExpression, IsCallExpression, IsComputedPropertyName, IsIdentifier, IsLabeledStatement, IsParenthesizedExpression, IsPrivateIdentifier, IsQualifiedName, IsVariableDeclarationList } from "../ast/generated/predicates.js";
import type { NodeFlags } from "../ast/generated/flags.js";
import { NodeFlagsNone, NodeFlagsOptionalChain } from "../ast/generated/flags.js";
import { KindAmpersandAmpersandToken, KindAsExpression, KindAsteriskToken, KindBarBarToken, KindBigIntLiteral, KindColonToken, KindCommaToken, KindEqualsEqualsEqualsToken, KindEqualsGreaterThanToken, KindEqualsToken, KindExclamationEqualsEqualsToken, KindExpressionWithTypeArguments, KindFalseKeyword, KindIdentifier, KindInKeyword, KindJsxNamespacedName, KindNoSubstitutionTemplateLiteral, KindNonNullExpression, KindNullKeyword, KindNumericLiteral, KindPartiallyEmittedExpression, KindParenthesizedExpression, KindPlusToken, KindPrivateIdentifier, KindQuestionToken, KindRegularExpressionLiteral, KindSatisfiesExpression, KindStringLiteral, KindTemplateTail, KindTemplateHead, KindTemplateMiddle, KindThisKeyword, KindTrueKeyword, KindTypeAssertionExpression } from "../ast/generated/kinds.js";
import { TokenFlagsNone } from "../ast/tokenflags.js";
import { IfElse } from "../core/core.js";
import type { ScriptTarget } from "../core/compileroptions.js";
import type { TextRange } from "../core/text.js";
import type { AutoGenerateOptions, EmitContext, AutoGenerateId, AutoGenerateInfo } from "./emitcontext.js";
import { EmitContext_AddEmitFlags, EmitContext_AssignCommentAndSourceMapRanges, EmitContext_CommentRange, EmitContext_EmitFlags, EmitContext_HasAutoGenerateInfo, EmitContext_RequestEmitHelper, EmitContext_SetEmitFlags, EmitContext_SourceMapRange, EmitContext_getNodeForGeneratedNameWorker, EmitContext_onClone, EmitContext_onCreate, EmitContext_onUpdate, nextAutoGenerateId } from "./emitcontext.js";
import type { EmitFlags } from "./emitflags.js";
import { EFAsyncFunctionBody, EFCustomPrologue, EFExportName, EFHelperName, EFLocalName, EFNoComments, EFNoSourceMap, EFNone, EFReuseTempVariableScope } from "./emitflags.js";
import { addDisposableResourceHelper, asyncDelegatorHelper, asyncGeneratorHelper, asyncValuesHelper, awaiterHelper, awaitHelper, classPrivateFieldGetHelper, classPrivateFieldInHelper, classPrivateFieldSetHelper, decorateHelper, disposeResourcesHelper, esDecorateHelper, exportStarHelper, importDefaultHelper, importStarHelper, makeTemplateObjectHelper, metadataHelper, paramHelper, propKeyHelper, restHelper, rewriteRelativeImportExtensionsHelper, runInitializersHelper, setFunctionNameHelper } from "./helpers.js";
import type { GeneratedIdentifierFlags } from "./generatedidentifierflags.js";
import { GeneratedIdentifierFlagsAuto, GeneratedIdentifierFlagsKindMask, GeneratedIdentifierFlagsLoop, GeneratedIdentifierFlagsNode, GeneratedIdentifierFlagsOptimistic, GeneratedIdentifierFlagsUnique } from "./generatedidentifierflags.js";

// `OuterExpressionKinds` is defined in `ast/utilities.go`, which has not yet
// been ported. It is forward-declared here as the numeric flag type it will
// be (Go `int16`) so the signature of the (still-stubbed) RestoreOuterExpressions
// compiles. The only consumer in this file is a stub blocked on the unported
// ast/utilities package.
type OuterExpressionKinds = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::type::NodeFactory","kind":"type","status":"implemented","sigHash":"090eeeccd7a9312c831c8c23dfcfe79fc09da23cd3a387758c5fda1591b6992f","bodyHash":"a712ecc9d60b4ded4861ea18bb957773602cb73b7775e87938062ca2de6cfd5f"}
 *
 * Go source:
 * NodeFactory struct {
 * 	ast.NodeFactory
 * 	emitContext *EmitContext
 * }
 */
export interface NodeFactory {
  readonly __tsgoEmbedded0?: NodeFactory_88523d1c;
  AsNodeFactory(): GoPtr<NodeFactory_88523d1c>;
  emitContext: GoPtr<EmitContext>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::func::NewNodeFactory","kind":"func","status":"implemented","sigHash":"580750f8820bc9f53e1feb77e23e6325616c0c74c53aab83bf8128ee179d8a45","bodyHash":"448c9362a2cae9a3cd611ffc4f4097d9636456f71756041efb063dfea92b55e6"}
 *
 * Go source:
 * func NewNodeFactory(context *EmitContext) *NodeFactory {
 * 	return &NodeFactory{
 * 		NodeFactory: *ast.NewNodeFactory(ast.NodeFactoryHooks{
 * 			OnCreate: context.onCreate,
 * 			OnUpdate: context.onUpdate,
 * 			OnClone:  context.onClone,
 * 		}),
 * 		emitContext: context,
 * 	}
 * }
 */
export function NewNodeFactory(context: GoPtr<EmitContext>): GoPtr<NodeFactory> {
  const embedded = NewAstNodeFactory({
    OnCreate: (node) => EmitContext_onCreate(context, node),
    OnUpdate: (updated, original) => EmitContext_onUpdate(context, updated, original),
    OnClone: (updated, original) => EmitContext_onClone(context, updated, original),
  })!;
  return {
    // Go embeds the value `*ast.NewNodeFactory(...)`; the `*` dereference is
    // expressed here via the non-null assertion on the returned GoPtr.
    __tsgoEmbedded0: embedded,
    AsNodeFactory: () => NodeFactory_AsNodeFactory(embedded),
    emitContext: context,
  };
}

function normalizeAutoGenerateOptions(options: GoPtr<AutoGenerateOptions>): AutoGenerateOptions {
  return {
    Flags: (options?.Flags ?? 0) as GeneratedIdentifierFlags,
    Prefix: options?.Prefix ?? "",
    Suffix: options?.Suffix ?? "",
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.newGeneratedIdentifier","kind":"method","status":"implemented","sigHash":"bd65bc9bb79cb9b5e957beb9597f38912038626f7684e4bfd9a342fcfddaf2b3","bodyHash":"4898d8a55f5291f9d781f03e48d9a81c8794f8ff23cb3966643119aba03aa716"}
 *
 * Go source:
 * func (f *NodeFactory) newGeneratedIdentifier(kind GeneratedIdentifierFlags, text string, node *ast.Node, options AutoGenerateOptions) *ast.IdentifierNode {
 * 	id := AutoGenerateId(nextAutoGenerateId.Add(1))
 * 
 * 	if len(text) == 0 {
 * 		switch {
 * 		case node == nil:
 * 			text = fmt.Sprintf("(auto@%d)", id)
 * 		case ast.IsMemberName(node):
 * 			text = node.Text()
 * 		default:
 * 			text = fmt.Sprintf("(generated@%v)", ast.GetNodeId(f.emitContext.getNodeForGeneratedNameWorker(node, id)))
 * 		}
 * 		text = FormatGeneratedName(false /*privateName* /, options.Prefix, text, options.Suffix)
 * 	}
 * 
 * 	name := f.NewIdentifier(text)
 * 	autoGenerate := &AutoGenerateInfo{
 * 		Id:     id,
 * 		Flags:  kind | (options.Flags & ^GeneratedIdentifierFlagsKindMask),
 * 		Prefix: options.Prefix,
 * 		Suffix: options.Suffix,
 * 		Node:   node,
 * 	}
 * 	if f.emitContext.autoGenerate == nil {
 * 		f.emitContext.autoGenerate = make(map[*ast.MemberName]*AutoGenerateInfo)
 * 	}
 * 	f.emitContext.autoGenerate[name] = autoGenerate
 * 	return name
 * }
 */
export function NodeFactory_newGeneratedIdentifier(receiver: GoPtr<NodeFactory>, kind: GeneratedIdentifierFlags, text: string, node: GoPtr<Node>, options: AutoGenerateOptions): GoPtr<IdentifierNode> {
  options = normalizeAutoGenerateOptions(options);
  const id = nextAutoGenerateId.Add(1 as never) as AutoGenerateId;

  if (text.length === 0) {
    if (node === undefined) {
      text = `(auto@${id})`;
    } else if (IsMemberName(node)) {
      text = Node_Text(node);
    } else {
      text = `(generated@${GetNodeId(EmitContext_getNodeForGeneratedNameWorker(receiver!.emitContext, node, id))})`;
    }
    text = FormatGeneratedName(false, options.Prefix, text, options.Suffix);
  }

  const name = NewIdentifier(receiver!.__tsgoEmbedded0!, text);
  const autoGenerate: AutoGenerateInfo = {
    Id: id,
    Flags: (kind | (options.Flags & ~GeneratedIdentifierFlagsKindMask)) as GeneratedIdentifierFlags,
    Prefix: options.Prefix,
    Suffix: options.Suffix,
    Node: node,
  };
  if (receiver!.emitContext!.autoGenerate === undefined) {
    receiver!.emitContext!.autoGenerate = new globalThis.Map();
  }
  receiver!.emitContext!.autoGenerate.set(name, autoGenerate);
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewTempVariable","kind":"method","status":"implemented","sigHash":"3c3fe94ccb05f0e146eaa728c4dfcbe7dba8e437ebac923484a480af37b974eb","bodyHash":"109b9570d64a18cbb52603676032c6c1b7b692b44ff2c5691b6d756aa300ad81"}
 *
 * Go source:
 * func (f *NodeFactory) NewTempVariable() *ast.IdentifierNode {
 * 	return f.NewTempVariableEx(AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewTempVariable(receiver: GoPtr<NodeFactory>): GoPtr<IdentifierNode> {
  return NodeFactory_NewTempVariableEx(receiver, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewTempVariableEx","kind":"method","status":"implemented","sigHash":"2765e567212e8bd92d2750f20e4e54662ca08bf9ba9020adb7ba1cefec3c700e","bodyHash":"b7d72a9bfc172a67704ab0f047d4a7c44ab7b2b8f4e5850f46bd2151d6584666"}
 *
 * Go source:
 * func (f *NodeFactory) NewTempVariableEx(options AutoGenerateOptions) *ast.IdentifierNode {
 * 	return f.newGeneratedIdentifier(GeneratedIdentifierFlagsAuto, "", nil /*node* /, options)
 * }
 */
export function NodeFactory_NewTempVariableEx(receiver: GoPtr<NodeFactory>, options: AutoGenerateOptions): GoPtr<IdentifierNode> {
  return NodeFactory_newGeneratedIdentifier(receiver, GeneratedIdentifierFlagsAuto, "", undefined, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewLoopVariable","kind":"method","status":"implemented","sigHash":"f79fa4035202bc9dfc78dcf42e917f6a48ac60eca10d276c007cf1b2427b2efe","bodyHash":"2207fe251c9f4112ad60ae179b276f97ea99ff4f2c3b661546e648310c8c5fc1"}
 *
 * Go source:
 * func (f *NodeFactory) NewLoopVariable() *ast.IdentifierNode {
 * 	return f.NewLoopVariableEx(AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewLoopVariable(receiver: GoPtr<NodeFactory>): GoPtr<IdentifierNode> {
  return NodeFactory_NewLoopVariableEx(receiver, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewLoopVariableEx","kind":"method","status":"implemented","sigHash":"11103854ba70849c1760ca1b8f7fb076e579ad9d1384acba12af4d8e7c8ddc1b","bodyHash":"df0a88678b1e56071f9ee334b5d29a5dfbe83c76b3309d3340ddecea7d20d8d3"}
 *
 * Go source:
 * func (f *NodeFactory) NewLoopVariableEx(options AutoGenerateOptions) *ast.IdentifierNode {
 * 	return f.newGeneratedIdentifier(GeneratedIdentifierFlagsLoop, "", nil /*node* /, options)
 * }
 */
export function NodeFactory_NewLoopVariableEx(receiver: GoPtr<NodeFactory>, options: AutoGenerateOptions): GoPtr<IdentifierNode> {
  return NodeFactory_newGeneratedIdentifier(receiver, GeneratedIdentifierFlagsLoop, "", undefined, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewUniqueName","kind":"method","status":"implemented","sigHash":"5e0acbadc9e15055cc197c25d72d6489ab51d85d00500550a9ecc89c0280dd02","bodyHash":"c8167aa23ad3a76fcd00fbb18043c2e83aeaf8cc5fdb6e4f7c6dd33b840971e5"}
 *
 * Go source:
 * func (f *NodeFactory) NewUniqueName(text string) *ast.IdentifierNode {
 * 	return f.NewUniqueNameEx(text, AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewUniqueName(receiver: GoPtr<NodeFactory>, text: string): GoPtr<IdentifierNode> {
  return NodeFactory_NewUniqueNameEx(receiver, text, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewUniqueNameEx","kind":"method","status":"implemented","sigHash":"13cbcf642bd8a4fb65dcd2add1b7498820a0ff49d05960759f8b2605d5673c27","bodyHash":"a433165ff75a53e3159594471e21b8b653cd48683af2136d37035c509d4a6d94"}
 *
 * Go source:
 * func (f *NodeFactory) NewUniqueNameEx(text string, options AutoGenerateOptions) *ast.IdentifierNode {
 * 	return f.newGeneratedIdentifier(GeneratedIdentifierFlagsUnique, text, nil /*node* /, options)
 * }
 */
export function NodeFactory_NewUniqueNameEx(receiver: GoPtr<NodeFactory>, text: string, options: AutoGenerateOptions): GoPtr<IdentifierNode> {
  return NodeFactory_newGeneratedIdentifier(receiver, GeneratedIdentifierFlagsUnique, text, undefined, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewGeneratedNameForNode","kind":"method","status":"implemented","sigHash":"5dbf5625976ed22b2731738ad11a255111fd6c16ed8f3469e0bbe5f78eb1d835","bodyHash":"a925d3248e7a1bcd31d595b279f6df3c330f6899b60c2389c3717f18631da61a"}
 *
 * Go source:
 * func (f *NodeFactory) NewGeneratedNameForNode(node *ast.Node) *ast.IdentifierNode {
 * 	return f.NewGeneratedNameForNodeEx(node, AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewGeneratedNameForNode(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<IdentifierNode> {
  return NodeFactory_NewGeneratedNameForNodeEx(receiver, node, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewGeneratedNameForNodeEx","kind":"method","status":"implemented","sigHash":"ee04af44cabed1692b8a8596a847cf2958dee6454defa09d21fc32f82b27773f","bodyHash":"04c69df2530a72190f0d7b5a77afdeedec6d209747fd10e77f262437c1fcaff5"}
 *
 * Go source:
 * func (f *NodeFactory) NewGeneratedNameForNodeEx(node *ast.Node, options AutoGenerateOptions) *ast.IdentifierNode {
 * 	if len(options.Prefix) > 0 || len(options.Suffix) > 0 {
 * 		options.Flags |= GeneratedIdentifierFlagsOptimistic
 * 	}
 *
 * 	return f.newGeneratedIdentifier(GeneratedIdentifierFlagsNode, "", node, options)
 * }
 */
export function NodeFactory_NewGeneratedNameForNodeEx(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>, options: AutoGenerateOptions): GoPtr<IdentifierNode> {
  options = normalizeAutoGenerateOptions(options);
  // Go passes `options` by value; the |= below mutates that local copy only.
  const opts: AutoGenerateOptions = options.Prefix.length > 0 || options.Suffix.length > 0
    ? { Flags: options.Flags | GeneratedIdentifierFlagsOptimistic, Prefix: options.Prefix, Suffix: options.Suffix }
    : options;
  return NodeFactory_newGeneratedIdentifier(receiver, GeneratedIdentifierFlagsNode, "", node, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.newGeneratedPrivateIdentifier","kind":"method","status":"implemented","sigHash":"a1b3679d9370a830c39f55d9d0440eb130ffa0e6cfd218bf2f6a3c3ed2d47d8c","bodyHash":"9ef46bfeeb3cc494dea57cd0e26acdd96ff7cc6891de810130fa0e533167428d"}
 *
 * Go source:
 * func (f *NodeFactory) newGeneratedPrivateIdentifier(kind GeneratedIdentifierFlags, text string, node *ast.Node, options AutoGenerateOptions) *ast.PrivateIdentifierNode {
 * 	id := AutoGenerateId(nextAutoGenerateId.Add(1))
 * 
 * 	if len(text) == 0 {
 * 		switch {
 * 		case node == nil:
 * 			text = fmt.Sprintf("(auto@%d)", id)
 * 		case ast.IsMemberName(node):
 * 			text = node.Text()
 * 		default:
 * 			text = fmt.Sprintf("(generated@%v)", ast.GetNodeId(f.emitContext.getNodeForGeneratedNameWorker(node, id)))
 * 		}
 * 		text = FormatGeneratedName(true /*privateName* /, options.Prefix, text, options.Suffix)
 * 	} else if !strings.HasPrefix(text, "#") {
 * 		panic("First character of private identifier must be #: " + text)
 * 	}
 * 
 * 	name := f.NewPrivateIdentifier(text)
 * 	autoGenerate := &AutoGenerateInfo{
 * 		Id:     id,
 * 		Flags:  kind | (options.Flags &^ GeneratedIdentifierFlagsKindMask),
 * 		Prefix: options.Prefix,
 * 		Suffix: options.Suffix,
 * 		Node:   node,
 * 	}
 * 	if f.emitContext.autoGenerate == nil {
 * 		f.emitContext.autoGenerate = make(map[*ast.MemberName]*AutoGenerateInfo)
 * 	}
 * 	f.emitContext.autoGenerate[name] = autoGenerate
 * 	return name
 * }
 */
export function NodeFactory_newGeneratedPrivateIdentifier(receiver: GoPtr<NodeFactory>, kind: GeneratedIdentifierFlags, text: string, node: GoPtr<Node>, options: AutoGenerateOptions): GoPtr<PrivateIdentifierNode> {
  options = normalizeAutoGenerateOptions(options);
  const id = nextAutoGenerateId.Add(1 as never) as AutoGenerateId;

  if (text.length === 0) {
    if (node === undefined) {
      text = `(auto@${id})`;
    } else if (IsMemberName(node)) {
      text = Node_Text(node);
    } else {
      text = `(generated@${GetNodeId(EmitContext_getNodeForGeneratedNameWorker(receiver!.emitContext, node, id))})`;
    }
    text = FormatGeneratedName(true, options.Prefix, text, options.Suffix);
  } else if (!text.startsWith("#")) {
    throw new globalThis.Error("First character of private identifier must be #: " + text);
  }

  const name = NewPrivateIdentifier(receiver!.__tsgoEmbedded0!, text);
  const autoGenerate: AutoGenerateInfo = {
    Id: id,
    Flags: (kind | (options.Flags & ~GeneratedIdentifierFlagsKindMask)) as GeneratedIdentifierFlags,
    Prefix: options.Prefix,
    Suffix: options.Suffix,
    Node: node,
  };
  if (receiver!.emitContext!.autoGenerate === undefined) {
    receiver!.emitContext!.autoGenerate = new globalThis.Map();
  }
  receiver!.emitContext!.autoGenerate.set(name, autoGenerate);
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewUniquePrivateName","kind":"method","status":"implemented","sigHash":"0d9283b79d5268e64f721f4dad6b10b4168851f75493914d34809393f259aee3","bodyHash":"c3f54800fef3538824f826b07dbf96dcefc982fa3a99ea45ae2eb97773aea7d3"}
 *
 * Go source:
 * func (f *NodeFactory) NewUniquePrivateName(text string) *ast.PrivateIdentifierNode {
 * 	return f.NewUniquePrivateNameEx(text, AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewUniquePrivateName(receiver: GoPtr<NodeFactory>, text: string): GoPtr<PrivateIdentifierNode> {
  return NodeFactory_NewUniquePrivateNameEx(receiver, text, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewUniquePrivateNameEx","kind":"method","status":"implemented","sigHash":"9d7b41125f600e2a44f321453a6b8f64611af3fa017a018da2d9d2e8f1c0da91","bodyHash":"f8e6f6039b0ef7c3e57cd8c6590b292930fffbef78fd0ccac20d3f21332c1d27"}
 *
 * Go source:
 * func (f *NodeFactory) NewUniquePrivateNameEx(text string, options AutoGenerateOptions) *ast.PrivateIdentifierNode {
 * 	return f.newGeneratedPrivateIdentifier(GeneratedIdentifierFlagsUnique, text, nil /*node* /, options)
 * }
 */
export function NodeFactory_NewUniquePrivateNameEx(receiver: GoPtr<NodeFactory>, text: string, options: AutoGenerateOptions): GoPtr<PrivateIdentifierNode> {
  return NodeFactory_newGeneratedPrivateIdentifier(receiver, GeneratedIdentifierFlagsUnique, text, undefined, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewGeneratedPrivateNameForNode","kind":"method","status":"implemented","sigHash":"844037d4a7680f3eea0049faf7b91d3f60ae0c20b8c3ff7df8c063d9e60d0ee1","bodyHash":"40244d5cca261e8d63a21e00ee72d30c1ad262f3c426d57ecaabe5b67978328a"}
 *
 * Go source:
 * func (f *NodeFactory) NewGeneratedPrivateNameForNode(node *ast.Node) *ast.PrivateIdentifierNode {
 * 	return f.NewGeneratedPrivateNameForNodeEx(node, AutoGenerateOptions{})
 * }
 */
export function NodeFactory_NewGeneratedPrivateNameForNode(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<PrivateIdentifierNode> {
  return NodeFactory_NewGeneratedPrivateNameForNodeEx(receiver, node, { Flags: 0, Prefix: "", Suffix: "" });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewGeneratedPrivateNameForNodeEx","kind":"method","status":"implemented","sigHash":"eb2d7257b49cff05644937865dbd8720ba0db13d231968b6d2bd4dc4ae508f97","bodyHash":"543c49649e9be46eea897f678e3f9619e9170f4489ba0cae1579a0097f52bc66"}
 *
 * Go source:
 * func (f *NodeFactory) NewGeneratedPrivateNameForNodeEx(node *ast.Node, options AutoGenerateOptions) *ast.PrivateIdentifierNode {
 * 	if len(options.Prefix) > 0 || len(options.Suffix) > 0 {
 * 		options.Flags |= GeneratedIdentifierFlagsOptimistic
 * 	}
 *
 * 	return f.newGeneratedPrivateIdentifier(GeneratedIdentifierFlagsNode, "", node, options)
 * }
 */
export function NodeFactory_NewGeneratedPrivateNameForNodeEx(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>, options: AutoGenerateOptions): GoPtr<PrivateIdentifierNode> {
  options = normalizeAutoGenerateOptions(options);
  // Go passes `options` by value; the |= below mutates that local copy only.
  const opts: AutoGenerateOptions = options.Prefix.length > 0 || options.Suffix.length > 0
    ? { Flags: options.Flags | GeneratedIdentifierFlagsOptimistic, Prefix: options.Prefix, Suffix: options.Suffix }
    : options;
  return NodeFactory_newGeneratedPrivateIdentifier(receiver, GeneratedIdentifierFlagsNode, "", node, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewStringLiteralFromNode","kind":"method","status":"implemented","sigHash":"9abaa7a2c78fbb1b5f46bdd6ce5f92a14895489f544492adeacdcec7ba06dcd0","bodyHash":"e74fedc5eda2c3c1cf8f6b849e807bfef836ae0ea704538b8e32355ef7acc85f"}
 *
 * Go source:
 * func (f *NodeFactory) NewStringLiteralFromNode(textSourceNode *ast.Node) *ast.Node {
 * 	var text string
 * 	switch textSourceNode.Kind {
 * 	case ast.KindIdentifier,
 * 		ast.KindPrivateIdentifier,
 * 		ast.KindJsxNamespacedName,
 * 		ast.KindStringLiteral,
 * 		ast.KindNumericLiteral,
 * 		ast.KindBigIntLiteral,
 * 		ast.KindNoSubstitutionTemplateLiteral,
 * 		ast.KindTemplateHead,
 * 		ast.KindTemplateMiddle,
 * 		ast.KindTemplateTail,
 * 		ast.KindRegularExpressionLiteral:
 * 		text = textSourceNode.Text()
 * 	}
 * 	node := f.NewStringLiteral(text, ast.TokenFlagsNone)
 * 	if f.emitContext.textSource == nil {
 * 		f.emitContext.textSource = make(map[*ast.StringLiteralNode]*ast.Node)
 * 	}
 * 	f.emitContext.textSource[node] = textSourceNode
 * 	return node
 * }
 */
export function NodeFactory_NewStringLiteralFromNode(receiver: GoPtr<NodeFactory>, textSourceNode: GoPtr<Node>): GoPtr<Node> {
  let text = "";
  switch (textSourceNode!.Kind) {
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindJsxNamespacedName:
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
    case KindTemplateMiddle:
    case KindTemplateTail:
    case KindRegularExpressionLiteral:
      text = Node_Text(textSourceNode);
      break;
  }
  const node = NewStringLiteral(receiver!.__tsgoEmbedded0!, text, TokenFlagsNone);
  if (receiver!.emitContext!.textSource === undefined) {
    receiver!.emitContext!.textSource = new globalThis.Map();
  }
  receiver!.emitContext!.textSource.set(node as unknown as GoPtr<StringLiteralNode>, textSourceNode);
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewThisExpression","kind":"method","status":"implemented","sigHash":"b3fd6aaa8b941193649a9573517606d71d78d46ee2aea8e16aca4ef7810a6412","bodyHash":"179bbacda19b7f247557b938c1aa83d947b9ea404256fea2a10e5873f4193450"}
 *
 * Go source:
 * func (f *NodeFactory) NewThisExpression() *ast.Expression {
 * 	return f.NewKeywordExpression(ast.KindThisKeyword)
 * }
 */
export function NodeFactory_NewThisExpression(receiver: GoPtr<NodeFactory>): GoPtr<Expression> {
  return NewKeywordExpression(receiver!.__tsgoEmbedded0!, KindThisKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewTrueExpression","kind":"method","status":"implemented","sigHash":"af67827a925e6d2882b472fa4fcad810915abd5a038838ef2927f6eb30b89b9c","bodyHash":"7ad1e29632d26c259f162e233128fad987ede334052f15c08ca17d96e7c53526"}
 *
 * Go source:
 * func (f *NodeFactory) NewTrueExpression() *ast.Expression {
 * 	return f.NewKeywordExpression(ast.KindTrueKeyword)
 * }
 */
export function NodeFactory_NewTrueExpression(receiver: GoPtr<NodeFactory>): GoPtr<Expression> {
  return NewKeywordExpression(receiver!.__tsgoEmbedded0!, KindTrueKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewFalseExpression","kind":"method","status":"implemented","sigHash":"4c87aa011f8ce224ed484f2450e983708cc7f0b5b27ab6800313a0bd2ccb82c3","bodyHash":"d7e5e5b8083ae874cc764b7f89f9d144c82910ec2ea1eed158176eeee39ebdd0"}
 *
 * Go source:
 * func (f *NodeFactory) NewFalseExpression() *ast.Expression {
 * 	return f.NewKeywordExpression(ast.KindFalseKeyword)
 * }
 */
export function NodeFactory_NewFalseExpression(receiver: GoPtr<NodeFactory>): GoPtr<Expression> {
  return NewKeywordExpression(receiver!.__tsgoEmbedded0!, KindFalseKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewCommaExpression","kind":"method","status":"implemented","sigHash":"fa0b315d900205c995a56c4e67ec0e09f1f1243051f7b7b98e7820358dc27769","bodyHash":"3d433274e43c6aa92eae75bf6d46e92e6700fd4a89895e97f83d8290854a22fa"}
 *
 * Go source:
 * func (f *NodeFactory) NewCommaExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindCommaToken), right)
 * }
 */
export function NodeFactory_NewCommaExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindCommaToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAssignmentExpression","kind":"method","status":"implemented","sigHash":"d65469557959ceed9d833db5ac18d0868ff68ecc07bd4b32a65b9915dee5cc88","bodyHash":"d3f76563e2b1ba7903c24b3ebf43fc9cb6082fc503bd8e57d44d2b7e98a64e2b"}
 *
 * Go source:
 * func (f *NodeFactory) NewAssignmentExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindEqualsToken), right)
 * }
 */
export function NodeFactory_NewAssignmentExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindEqualsToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewLogicalORExpression","kind":"method","status":"implemented","sigHash":"108c7f9599666454afe6359498c19d47a99fa459199fce35fb22242f0df40768","bodyHash":"fadb85212a1a3a1eca95493eecbf5c27225c8148bfa32c7bb159f73d939579d4"}
 *
 * Go source:
 * func (f *NodeFactory) NewLogicalORExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindBarBarToken), right)
 * }
 */
export function NodeFactory_NewLogicalORExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindBarBarToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewLogicalANDExpression","kind":"method","status":"implemented","sigHash":"a6eec390aa3a0ee1c49dfadccfc1676df31e10e41beed79c7acf33f1aedb55d4","bodyHash":"f6097dc8604c870836b93058b4b2343e872cf352284ac1a25fc9a8bda5b4039f"}
 *
 * Go source:
 * func (f *NodeFactory) NewLogicalANDExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindAmpersandAmpersandToken), right)
 * }
 */
export function NodeFactory_NewLogicalANDExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindAmpersandAmpersandToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewStrictEqualityExpression","kind":"method","status":"implemented","sigHash":"6058e95570b57fd149bb6e25e0063b859d8d05af3e88ff083906f22d8bbcb317","bodyHash":"3bf78970075fd7d08a5e06c702d25c84cca540f7068daa5a2c94397aeb4def83"}
 *
 * Go source:
 * func (f *NodeFactory) NewStrictEqualityExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindEqualsEqualsEqualsToken), right)
 * }
 */
export function NodeFactory_NewStrictEqualityExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindEqualsEqualsEqualsToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewStrictInequalityExpression","kind":"method","status":"implemented","sigHash":"67135c4626f9343c2e1adcb9267c748ef953743acbf1ca12aa72fe0c44d4fedf","bodyHash":"10c3784396619a5ac816e499447154aca9fe1435dc3af670529baf904bdef4a1"}
 *
 * Go source:
 * func (f *NodeFactory) NewStrictInequalityExpression(left *ast.Expression, right *ast.Expression) *ast.Expression {
 * 	return f.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, f.NewToken(ast.KindExclamationEqualsEqualsToken), right)
 * }
 */
export function NodeFactory_NewStrictInequalityExpression(receiver: GoPtr<NodeFactory>, left: GoPtr<Expression>, right: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewBinaryExpression(f, undefined, left, undefined, NewToken(f, KindExclamationEqualsEqualsToken), right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewVoidZeroExpression","kind":"method","status":"implemented","sigHash":"be9bafc263983f75c771764fc33e2151d15eb1209bd0ef0951e4c2ab0e2fdbd3","bodyHash":"90aa87ed50f3aa733243066b20e32f7415cabbf1c3f197c04b44963e10f1650f"}
 *
 * Go source:
 * func (f *NodeFactory) NewVoidZeroExpression() *ast.Expression {
 * 	return f.NewVoidExpression(f.NewNumericLiteral("0", ast.TokenFlagsNone))
 * }
 */
export function NodeFactory_NewVoidZeroExpression(receiver: GoPtr<NodeFactory>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewVoidExpression(f, NewNumericLiteral(f, "0", TokenFlagsNone));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::func::flattenCommaElement","kind":"func","status":"implemented","sigHash":"4dba9a3211c3451b688f07594b484c6c40d78703109fb320351423438c9a23a1","bodyHash":"866ac93aaf0b486833292b91b567d1f8e8a1b31f9f46d7883ea5c91f0333d260"}
 *
 * Go source:
 * func flattenCommaElement(node *ast.Expression, expressions []*ast.Expression) []*ast.Expression {
 * 	if ast.IsBinaryExpression(node) && ast.NodeIsSynthesized(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
 * 		expressions = flattenCommaElement(node.AsBinaryExpression().Left, expressions)
 * 		expressions = flattenCommaElement(node.AsBinaryExpression().Right, expressions)
 * 	} else {
 * 		expressions = append(expressions, node)
 * 	}
 * 	return expressions
 * }
 */
export function flattenCommaElement(node: GoPtr<Expression>, expressions: GoSlice<GoPtr<Expression>>): GoSlice<GoPtr<Expression>> {
  if (IsBinaryExpression(node) && NodeIsSynthesized(node) && AsBinaryExpression(node)!.OperatorToken!.Kind === KindCommaToken) {
    expressions = flattenCommaElement(AsBinaryExpression(node)!.Left, expressions);
    expressions = flattenCommaElement(AsBinaryExpression(node)!.Right, expressions);
  } else {
    expressions = [...expressions, node];
  }
  return expressions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::func::flattenCommaElements","kind":"func","status":"implemented","sigHash":"84f941a6d494a5d83cacb06a8fe8a6c846c4a9674d329d67355a3de984759259","bodyHash":"634c319aca6097f2770d8f60e781c15afc9573046413b3d026f286de266d3919"}
 *
 * Go source:
 * func flattenCommaElements(expressions []*ast.Expression) []*ast.Expression {
 * 	var result []*ast.Expression
 * 	for _, expression := range expressions {
 * 		result = flattenCommaElement(expression, result)
 * 	}
 * 	return result
 * }
 */
export function flattenCommaElements(expressions: GoSlice<GoPtr<Expression>>): GoSlice<GoPtr<Expression>> {
  let result: GoSlice<GoPtr<Expression>> = [];
  for (const expression of expressions) {
    result = flattenCommaElement(expression, result);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.InlineExpressions","kind":"method","status":"implemented","sigHash":"2bc1eae13585141dba5bfa940201e0f3f8b8f66598c6da167c9b5a180057c4ea","bodyHash":"6e1ef244730734e006aa9b2b4c88c560d871c6358e3e6606f8c26577059d313f"}
 *
 * Go source:
 * func (f *NodeFactory) InlineExpressions(expressions []*ast.Expression) *ast.Expression {
 * 	if len(expressions) == 0 {
 * 		return nil
 * 	}
 * 	if len(expressions) == 1 {
 * 		return expressions[0]
 * 	}
 * 	expressions = flattenCommaElements(expressions)
 * 	expression := expressions[0]
 * 	for _, next := range expressions[1:] {
 * 		expression = f.NewCommaExpression(expression, next)
 * 	}
 * 	return expression
 * }
 */
export function NodeFactory_InlineExpressions(receiver: GoPtr<NodeFactory>, expressions: GoSlice<GoPtr<Expression>>): GoPtr<Expression> {
  if (expressions.length === 0) {
    return undefined;
  }
  if (expressions.length === 1) {
    return expressions[0];
  }
  const flattened = flattenCommaElements(expressions);
  let expression = flattened[0];
  for (const next of flattened.slice(1)) {
    expression = NodeFactory_NewCommaExpression(receiver, expression, next);
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.CreateExpressionFromEntityName","kind":"method","status":"implemented","sigHash":"98ffd03b1ee302a932f4cc71d05fb215e641b285015700c5e08fa7e45ba1ecb9","bodyHash":"ee0a9a9c4276f786a437db40fc7df053be5e80921539f99c4078cda5e3aa0dfb"}
 *
 * Go source:
 * func (f *NodeFactory) CreateExpressionFromEntityName(node *ast.Node) *ast.Expression {
 * 	if ast.IsQualifiedName(node) {
 * 		left := f.CreateExpressionFromEntityName(node.AsQualifiedName().Left)
 * 		right := node.AsQualifiedName().Right.Clone(f.AsNodeFactory())
 * 		right.Loc = node.AsQualifiedName().Right.Loc
 * 		// TODO(rbuckton): Does this need to be parented?
 * 		right.Parent = node.AsQualifiedName().Right.Parent
 * 		propAccess := f.NewPropertyAccessExpression(left, nil, right, ast.NodeFlagsNone)
 * 		propAccess.Loc = node.Loc
 * 		return propAccess
 * 	}
 * 	res := node.Clone(f.AsNodeFactory())
 * 	res.Loc = node.Loc
 * 	// TODO(rbuckton): Does this need to be parented?
 * 	res.Parent = node.Parent
 * 	return res
 * }
 */
export function NodeFactory_CreateExpressionFromEntityName(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<Expression> {
  const f = receiver!;
  if (IsQualifiedName(node)) {
    const left = NodeFactory_CreateExpressionFromEntityName(f, AsQualifiedName(node)!.Left);
    const right = Node_Clone(AsQualifiedName(node)!.Right, NodeFactory_AsNodeFactory(f.__tsgoEmbedded0)! as unknown as NodeFactoryCoercible);
    right!.Loc = AsQualifiedName(node)!.Right!.Loc;
    // TODO(rbuckton): Does this need to be parented?
    right!.Parent = AsQualifiedName(node)!.Right!.Parent;
    const propAccess = NewPropertyAccessExpression(f.__tsgoEmbedded0!, left, undefined, right, NodeFlagsNone);
    propAccess!.Loc = node!.Loc;
    return propAccess;
  }
  const res = Node_Clone(node, NodeFactory_AsNodeFactory(f.__tsgoEmbedded0)! as unknown as NodeFactoryCoercible);
  res!.Loc = node!.Loc;
  // TODO(rbuckton): Does this need to be parented?
  res!.Parent = node!.Parent;
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.RestoreEnclosingLabel","kind":"method","status":"implemented","sigHash":"fff69a5f287d6c3b561a537d1218bfb18105629decea3120ddc567a37c74e817","bodyHash":"d427ab10f2e1d1bfa0dc9c33d9798911718e55b4f4eb28bce5eb98800e7b7da5"}
 *
 * Go source:
 * func (f *NodeFactory) RestoreEnclosingLabel(node *ast.Node, outermostLabeledStatement *ast.LabeledStatement) *ast.Node {
 * 	if outermostLabeledStatement == nil {
 * 		return node
 * 	}
 * 	innerLabel := node
 * 	if ast.IsLabeledStatement(outermostLabeledStatement.Statement) {
 * 		innerLabel = f.RestoreEnclosingLabel(node, outermostLabeledStatement.Statement.AsLabeledStatement())
 * 	}
 * 	return f.UpdateLabeledStatement(
 * 		outermostLabeledStatement,
 * 		outermostLabeledStatement.Label,
 * 		innerLabel,
 * 	)
 * }
 */
export function NodeFactory_RestoreEnclosingLabel(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>, outermostLabeledStatement: GoPtr<LabeledStatement>): GoPtr<Node> {
  if (outermostLabeledStatement === undefined) {
    return node;
  }
  let innerLabel = node;
  if (IsLabeledStatement(outermostLabeledStatement!.Statement)) {
    innerLabel = NodeFactory_RestoreEnclosingLabel(receiver, node, AsLabeledStatement(outermostLabeledStatement!.Statement));
  }
  return NodeFactory_UpdateLabeledStatement(
    receiver!.__tsgoEmbedded0!,
    outermostLabeledStatement,
    outermostLabeledStatement!.Label,
    innerLabel,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.CreateForOfBindingStatement","kind":"method","status":"implemented","sigHash":"5ab3bdf513a608bbf44d098922348b8ab830abe60f6777f1e16816d6196847d4","bodyHash":"508ec0fea3942edfea7ac2b6dd42054050b1b388e6d75fad761774ef1e995678"}
 *
 * Go source:
 * func (f *NodeFactory) CreateForOfBindingStatement(node *ast.Node, boundValue *ast.Node) *ast.Node {
 * 	if ast.IsVariableDeclarationList(node) {
 * 		firstDeclaration := node.AsVariableDeclarationList().Declarations.Nodes[0]
 * 		updatedDeclaration := f.UpdateVariableDeclaration(
 * 			firstDeclaration.AsVariableDeclaration(),
 * 			firstDeclaration.Name(),
 * 			nil, /*exclamationToken* /
 * 			nil, /*type* /
 * 			boundValue,
 * 		)
 * 		statement := f.NewVariableStatement(
 * 			nil,
 * 			f.UpdateVariableDeclarationList(
 * 				node.AsVariableDeclarationList(),
 * 				f.NewNodeList([]*ast.Node{updatedDeclaration}),
 * 				node.AsVariableDeclarationList().Flags,
 * 			),
 * 		)
 * 		statement.Loc = node.Loc
 * 		return statement
 * 	}
 * 	updatedExpression := f.NewAssignmentExpression(node, boundValue)
 * 	updatedExpression.Loc = node.Loc
 * 	statement := f.NewExpressionStatement(updatedExpression)
 * 	statement.Loc = node.Loc
 * 	return statement
 * }
 */
export function NodeFactory_CreateForOfBindingStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>, boundValue: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  if (IsVariableDeclarationList(node)) {
    const firstDeclaration = AsVariableDeclarationList(node)!.Declarations!.Nodes[0];
    const updatedDeclaration = NodeFactory_UpdateVariableDeclaration(
      f,
      AsVariableDeclaration(firstDeclaration),
      Node_Name(firstDeclaration),
      undefined, /*exclamationToken*/
      undefined, /*type*/
      boundValue,
    );
    const updatedList = NodeFactory_UpdateVariableDeclarationList(
      f,
      AsVariableDeclarationList(node),
      NodeFactory_NewNodeList(f, [updatedDeclaration]) as unknown as GoPtr<VariableDeclarationNodeList>,
      AsVariableDeclarationList(node)!.Flags as NodeFlags,
    );
    const statement = NewVariableStatement(f, undefined, updatedList);
    statement!.Loc = node!.Loc;
    return statement;
  }
  const updatedExpression = NodeFactory_NewAssignmentExpression(receiver, node, boundValue);
  updatedExpression!.Loc = node!.Loc;
  const statement = NewExpressionStatement(f, updatedExpression);
  statement!.Loc = node!.Loc;
  return statement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewTypeCheck","kind":"method","status":"implemented","sigHash":"9929c8c20c6a528830ff5b0f95200736c4587d5f365464de75f02ccfa82c7e13","bodyHash":"8ee9ed7fb698af8436b17ea897a4145a399ea7bb203d8f836ffdda7ffac7c34b"}
 *
 * Go source:
 * func (f *NodeFactory) NewTypeCheck(value *ast.Node, tag string) *ast.Node {
 * 	if tag == "null" {
 * 		return f.NewStrictEqualityExpression(value, f.NewKeywordExpression(ast.KindNullKeyword))
 * 	} else if tag == "undefined" {
 * 		return f.NewStrictEqualityExpression(value, f.NewVoidZeroExpression())
 * 	} else {
 * 		return f.NewStrictEqualityExpression(f.NewTypeOfExpression(value), f.NewStringLiteral(tag, ast.TokenFlagsNone))
 * 	}
 * }
 */
export function NodeFactory_NewTypeCheck(receiver: GoPtr<NodeFactory>, value: GoPtr<Node>, tag: string): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  if (tag === "null") {
    return NodeFactory_NewStrictEqualityExpression(receiver, value, NewKeywordExpression(f, KindNullKeyword));
  } else if (tag === "undefined") {
    return NodeFactory_NewStrictEqualityExpression(receiver, value, NodeFactory_NewVoidZeroExpression(receiver));
  } else {
    return NodeFactory_NewStrictEqualityExpression(receiver, NewTypeOfExpression(f, value), NewStringLiteral(f, tag, TokenFlagsNone));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewMethodCall","kind":"method","status":"implemented","sigHash":"1a2b13b373216fc0b93624895eb0f8a7722bda836b6dda25f8ad6480ae7bf466","bodyHash":"bfee906b07f1c369ed647e8277ed68997d9828571ccf53d83e18f0b201906b6e"}
 *
 * Go source:
 * func (f *NodeFactory) NewMethodCall(object *ast.Node, methodName *ast.Node, argumentsList []*ast.Node) *ast.Node {
 * 	// Preserve the optionality of `object`.
 * 	if ast.IsCallExpression(object) && (object.Flags&ast.NodeFlagsOptionalChain != 0) {
 * 		return f.NewCallExpression(
 * 			f.NewPropertyAccessExpression(object, nil, methodName, ast.NodeFlagsNone),
 * 			nil,
 * 			nil,
 * 			f.NewNodeList(argumentsList),
 * 			ast.NodeFlagsOptionalChain,
 * 		)
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(object, nil, methodName, ast.NodeFlagsNone),
 * 		nil,
 * 		nil,
 * 		f.NewNodeList(argumentsList),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewMethodCall(receiver: GoPtr<NodeFactory>, object: GoPtr<Node>, methodName: GoPtr<Node>, argumentsList: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  // Preserve the optionality of `object`.
  if (IsCallExpression(object) && (object!.Flags & NodeFlagsOptionalChain) !== 0) {
    return NewCallExpression(
      f,
      NewPropertyAccessExpression(f, object, undefined, methodName, NodeFlagsNone),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, argumentsList),
      NodeFlagsOptionalChain,
    );
  }
  return NewCallExpression(
    f,
    NewPropertyAccessExpression(f, object, undefined, methodName, NodeFlagsNone),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, argumentsList),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewGlobalMethodCall","kind":"method","status":"implemented","sigHash":"b366904a54ba7f958f3168d517d86f1e788634b2d4960b4e81b21aced8f28da1","bodyHash":"2f893a749483cc792f723b25f5af1fe55c68c5fd6d0466978b734ea68295700e"}
 *
 * Go source:
 * func (f *NodeFactory) NewGlobalMethodCall(globalObjectName string, methodName string, argumentsList []*ast.Node) *ast.Node {
 * 	return f.NewMethodCall(f.NewIdentifier(globalObjectName), f.NewIdentifier(methodName), argumentsList)
 * }
 */
export function NodeFactory_NewGlobalMethodCall(receiver: GoPtr<NodeFactory>, globalObjectName: string, methodName: string, argumentsList: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  return NodeFactory_NewMethodCall(receiver, NewIdentifier(f, globalObjectName), NewIdentifier(f, methodName), argumentsList);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewFunctionCallCall","kind":"method","status":"implemented","sigHash":"bd1019e963afc5048dc8e423c20228f60ef74008c254a64ded70685e797efab4","bodyHash":"cf046faf3f5e6c4d68eb2be95fb664d736591dec31f62a89d9426864ba5830a2"}
 *
 * Go source:
 * func (f *NodeFactory) NewFunctionCallCall(target *ast.Expression, thisArg *ast.Expression, argumentsList []*ast.Node) *ast.Node {
 * 	if thisArg == nil {
 * 		panic("Attempted to construct function call call without this argument expression")
 * 	}
 * 	args := append([]*ast.Expression{thisArg}, argumentsList...)
 * 	return f.NewMethodCall(target, f.NewIdentifier("call"), args)
 * }
 */
export function NodeFactory_NewFunctionCallCall(receiver: GoPtr<NodeFactory>, target: GoPtr<Expression>, thisArg: GoPtr<Expression>, argumentsList: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  if (thisArg === undefined) {
    throw new globalThis.Error("Attempted to construct function call call without this argument expression");
  }
  const args: GoSlice<GoPtr<Node>> = [thisArg, ...argumentsList];
  return NodeFactory_NewMethodCall(receiver, target, NewIdentifier(f, "call"), args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewArraySliceCall","kind":"method","status":"implemented","sigHash":"2b27df829d064d1a78ff952a8ef8673e571bac59793574865d0d4bd30f750b6d","bodyHash":"74912cd9d0ef75d121cc736eaf63049769a6b84df8b29bb766dcd7073841e0c9"}
 *
 * Go source:
 * func (f *NodeFactory) NewArraySliceCall(array *ast.Expression, start int) *ast.Node {
 * 	var args []*ast.Node
 * 	if start != 0 {
 * 		args = append(args, f.NewNumericLiteral(strconv.Itoa(start), ast.TokenFlagsNone))
 * 	}
 * 	return f.NewMethodCall(array, f.NewIdentifier("slice"), args)
 * }
 */
export function NodeFactory_NewArraySliceCall(receiver: GoPtr<NodeFactory>, array: GoPtr<Expression>, start: int): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  let args: GoSlice<GoPtr<Node>> = [];
  if (start !== 0) {
    args = [...args, NewNumericLiteral(f, Itoa(start), TokenFlagsNone)];
  }
  return NodeFactory_NewMethodCall(receiver, array, NewIdentifier(f, "slice"), args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.isIgnorableParen","kind":"method","status":"implemented","sigHash":"a02818fab46f3aa19c55cb8c295f11bfcef701b86805a821cbe7731450e7323e","bodyHash":"a2d5b3d3d8745e0ecf4e1f8ea1329d2fb0f8257f8ce32dd4a01f8584c4cf8c04"}
 *
 * Go source:
 * func (f *NodeFactory) isIgnorableParen(node *ast.Expression) bool {
 * 	return ast.IsParenthesizedExpression(node) &&
 * 		ast.NodeIsSynthesized(node) &&
 * 		ast.RangeIsSynthesized(f.emitContext.SourceMapRange(node)) &&
 * 		ast.RangeIsSynthesized(f.emitContext.CommentRange(node)) // &&
 * 	// len(emitContext.SyntheticLeadingComments(node)) == 0 &&
 * 	// len(emitContext.SyntheticTrailingComments(node)) == 0
 * }
 */
export function NodeFactory_isIgnorableParen(receiver: GoPtr<NodeFactory>, node: GoPtr<Expression>): bool {
  return (IsParenthesizedExpression(node) &&
    NodeIsSynthesized(node) &&
    RangeIsSynthesized(EmitContext_SourceMapRange(receiver!.emitContext, node)) &&
    RangeIsSynthesized(EmitContext_CommentRange(receiver!.emitContext, node))) as bool;
  // &&
  // len(emitContext.SyntheticLeadingComments(node)) == 0 &&
  // len(emitContext.SyntheticTrailingComments(node)) == 0
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.updateOuterExpression","kind":"method","status":"implemented","sigHash":"10888fc30677b7efe8b432e8d2b2e10afa17c9f1af2a181a0a101f666b69080d","bodyHash":"cf9fd459a9c6f62c171591c1c618d3934615e644f0741e2bb78ba588744690d7"}
 *
 * Go source:
 * func (f *NodeFactory) updateOuterExpression(outerExpression *ast.Expression /*OuterExpression* /, expression *ast.Expression) *ast.Expression {
 * 	switch outerExpression.Kind {
 * 	case ast.KindParenthesizedExpression:
 * 		return f.UpdateParenthesizedExpression(outerExpression.AsParenthesizedExpression(), expression)
 * 	case ast.KindTypeAssertionExpression:
 * 		return f.UpdateTypeAssertion(outerExpression.AsTypeAssertion(), outerExpression.Type(), expression)
 * 	case ast.KindAsExpression:
 * 		return f.UpdateAsExpression(outerExpression.AsAsExpression(), expression, outerExpression.Type())
 * 	case ast.KindSatisfiesExpression:
 * 		return f.UpdateSatisfiesExpression(outerExpression.AsSatisfiesExpression(), expression, outerExpression.Type())
 * 	case ast.KindNonNullExpression:
 * 		return f.UpdateNonNullExpression(outerExpression.AsNonNullExpression(), expression, outerExpression.Flags)
 * 	case ast.KindExpressionWithTypeArguments:
 * 		return f.UpdateExpressionWithTypeArguments(outerExpression.AsExpressionWithTypeArguments(), expression, outerExpression.TypeArgumentList())
 * 	case ast.KindPartiallyEmittedExpression:
 * 		return f.UpdatePartiallyEmittedExpression(outerExpression.AsPartiallyEmittedExpression(), expression)
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected outer expression kind: %s", outerExpression.Kind))
 * 	}
 * }
 */
export function NodeFactory_updateOuterExpression(receiver: GoPtr<NodeFactory>, outerExpression: GoPtr<Expression>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  switch (outerExpression!.Kind) {
    case KindParenthesizedExpression:
      return NodeFactory_UpdateParenthesizedExpression(f, AsParenthesizedExpression(outerExpression), expression);
    case KindTypeAssertionExpression:
      throw new globalThis.Error(`Unexpected outer expression kind: ${outerExpression!.Kind}`);
    case KindAsExpression:
      return NodeFactory_UpdateAsExpression(f, AsAsExpression(outerExpression), expression, Node_Type(outerExpression));
    case KindSatisfiesExpression:
      return NodeFactory_UpdateSatisfiesExpression(f, AsSatisfiesExpression(outerExpression), expression, Node_Type(outerExpression));
    case KindNonNullExpression:
      return NodeFactory_UpdateNonNullExpression(f, AsNonNullExpression(outerExpression), expression, outerExpression!.Flags as NodeFlags);
    case KindExpressionWithTypeArguments:
      return NodeFactory_UpdateExpressionWithTypeArguments(f, AsExpressionWithTypeArguments(outerExpression), expression, Node_TypeArgumentList(outerExpression) as unknown as GoPtr<NodeList>);
    case KindPartiallyEmittedExpression:
      return NodeFactory_UpdatePartiallyEmittedExpression(f, AsPartiallyEmittedExpression(outerExpression), expression);
    default:
      throw new globalThis.Error(`Unexpected outer expression kind: ${outerExpression!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.RestoreOuterExpressions","kind":"method","status":"implemented","sigHash":"576a40f626c8cdab8f513253cce9641b9f38598014338e247aa2ad9324473fa5","bodyHash":"1fab13ebb071e3b3407cdcc287a577a74962559eaa1f5cccb5ff229833947df0"}
 *
 * Go source:
 * func (f *NodeFactory) RestoreOuterExpressions(outerExpression *ast.Expression, innerExpression *ast.Expression, kinds ast.OuterExpressionKinds) *ast.Expression {
 * 	if outerExpression != nil && ast.IsOuterExpression(outerExpression, kinds) && !f.isIgnorableParen(outerExpression) {
 * 		return f.updateOuterExpression(
 * 			outerExpression,
 * 			f.RestoreOuterExpressions(outerExpression.Expression(), innerExpression, ast.OEKAll),
 * 		)
 * 	}
 * 	return innerExpression
 * }
 */
export function NodeFactory_RestoreOuterExpressions(receiver: GoPtr<NodeFactory>, outerExpression: GoPtr<Expression>, innerExpression: GoPtr<Expression>, kinds: OuterExpressionKinds): GoPtr<Expression> {
  if (outerExpression !== undefined && IsOuterExpression(outerExpression, kinds as never) && !NodeFactory_isIgnorableParen(receiver, outerExpression)) {
    return NodeFactory_updateOuterExpression(
      receiver,
      outerExpression,
      NodeFactory_RestoreOuterExpressions(receiver, Node_Expression(outerExpression), innerExpression, OEKAll as OuterExpressionKinds),
    );
  }
  return innerExpression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.EnsureUseStrict","kind":"method","status":"implemented","sigHash":"d6e817bbbe2d78ef2a1a8169aa420b12345cc1dc182d43c0dadbce83642848e5","bodyHash":"d41a6f64cd1f54a38d5ee50ce1664a04eafbb5339859998bcfe2304ca4ee776e"}
 *
 * Go source:
 * func (f *NodeFactory) EnsureUseStrict(statements []*ast.Statement) []*ast.Statement {
 * 	for _, statement := range statements {
 * 		if ast.IsPrologueDirective(statement) && statement.Expression().Text() == "use strict" {
 * 			return statements
 * 		} else {
 * 			break
 * 		}
 * 	}
 * 	useStrictPrologue := f.NewExpressionStatement(f.NewStringLiteral("use strict", ast.TokenFlagsNone))
 * 	statements = append([]*ast.Statement{useStrictPrologue}, statements...)
 * 	return statements
 * }
 */
export function NodeFactory_EnsureUseStrict(receiver: GoPtr<NodeFactory>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  const f = receiver!.__tsgoEmbedded0!;
  for (const statement of statements) {
    if (IsPrologueDirective(statement) && Node_Text(Node_Expression(statement)) === "use strict") {
      return statements;
    } else {
      break;
    }
  }
  const useStrictPrologue = NewExpressionStatement(f, NewStringLiteral(f, "use strict", TokenFlagsNone));
  return [useStrictPrologue, ...statements];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.SplitStandardPrologue","kind":"method","status":"implemented","sigHash":"ec1321842bf1a79f3033af884f3af28534183676c6717a8b529bbfb0ea3ec225","bodyHash":"ca05124590515a23008e265ce4f8e41b1a164c619ef2e7a5ae035af9c733089f"}
 *
 * Go source:
 * func (f *NodeFactory) SplitStandardPrologue(source []*ast.Statement) (prologue []*ast.Statement, rest []*ast.Statement) {
 * 	for i, statement := range source {
 * 		if !ast.IsPrologueDirective(statement) {
 * 			return source[:i], source[i:]
 * 		}
 * 	}
 * 	return source, nil
 * }
 */
export function NodeFactory_SplitStandardPrologue(receiver: GoPtr<NodeFactory>, source: GoSlice<GoPtr<Statement>>): [GoSlice<GoPtr<Statement>>, GoSlice<GoPtr<Statement>>] {
  for (let i = 0; i < source.length; i++) {
    if (!IsPrologueDirective(source[i])) {
      return [source.slice(0, i), source.slice(i)];
    }
  }
  return [source, []];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.SplitCustomPrologue","kind":"method","status":"implemented","sigHash":"e91d02a2935b8cdb5f9ff1cb88e21d928afa9bd28e9b7e9e0200e33d3b08f917","bodyHash":"a3f9a0412989deaecfc527140d4815db45a42dee2096028aab24b3466b75213a"}
 *
 * Go source:
 * func (f *NodeFactory) SplitCustomPrologue(source []*ast.Statement) (prologue []*ast.Statement, rest []*ast.Statement) {
 * 	for i, statement := range source {
 * 		if ast.IsPrologueDirective(statement) || f.emitContext.EmitFlags(statement)&EFCustomPrologue == 0 {
 * 			return source[:i], source[i:]
 * 		}
 * 	}
 * 	return nil, source
 * }
 */
export function NodeFactory_SplitCustomPrologue(receiver: GoPtr<NodeFactory>, source: GoSlice<GoPtr<Statement>>): [GoSlice<GoPtr<Statement>>, GoSlice<GoPtr<Statement>>] {
  for (let i = 0; i < source.length; i++) {
    if (IsPrologueDirective(source[i]) || (EmitContext_EmitFlags(receiver!.emitContext, source[i]) & EFCustomPrologue) === 0) {
      return [source.slice(0, i), source.slice(i)];
    }
  }
  return [[], source];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::type::NameOptions","kind":"type","status":"implemented","sigHash":"527393d83b3941274188da203e671265636a8541bf12c1d1d0d3882e893e65a1","bodyHash":"b5e525e776ab1eb4d0bb26748e8950d51c00f94bae8e21b43e0d00c043c5f038"}
 *
 * Go source:
 * NameOptions struct {
 * 	AllowComments   bool // indicates whether comments may be emitted for the name.
 * 	AllowSourceMaps bool // indicates whether source maps may be emitted for the name.
 * }
 */
export interface NameOptions {
  AllowComments: bool;
  AllowSourceMaps: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::type::AssignedNameOptions","kind":"type","status":"implemented","sigHash":"d20864e6de276da9f874cb3434aaf4aa18163b803296bd182288169ecc1c3b90","bodyHash":"45211a23d1de959a1a77d812bff033e1bec13eb2e7393a450c561915e5f4b45e"}
 *
 * Go source:
 * AssignedNameOptions struct {
 * 	AllowComments      bool // indicates whether comments may be emitted for the name.
 * 	AllowSourceMaps    bool // indicates whether source maps may be emitted for the name.
 * 	IgnoreAssignedName bool // indicates whether the assigned name of a declaration shouldn't be considered.
 * }
 */
export interface AssignedNameOptions {
  AllowComments: bool;
  AllowSourceMaps: bool;
  IgnoreAssignedName: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.getName","kind":"method","status":"implemented","sigHash":"29e529817f00078524add6ee54e17af1fd188edd3a47c1c49497c21168be5abe","bodyHash":"506a0269a0cb556c1d28ed185c81343c3e965f3d100d92d03ee09fc4ecc4e6db"}
 *
 * Go source:
 * func (f *NodeFactory) getName(node *ast.Declaration, emitFlags EmitFlags, opts AssignedNameOptions) *ast.IdentifierNode {
 * 	var nodeName *ast.IdentifierNode
 * 	if node != nil {
 * 		if opts.IgnoreAssignedName {
 * 			nodeName = ast.GetNonAssignedNameOfDeclaration(node)
 * 		} else {
 * 			nodeName = ast.GetNameOfDeclaration(node)
 * 		}
 * 	}
 * 
 * 	if nodeName != nil {
 * 		name := nodeName.Clone(f)
 * 		if !opts.AllowComments {
 * 			emitFlags |= EFNoComments
 * 		}
 * 		if !opts.AllowSourceMaps {
 * 			emitFlags |= EFNoSourceMap
 * 		}
 * 		f.emitContext.AddEmitFlags(name, emitFlags)
 * 		return name
 * 	}
 * 
 * 	return f.NewGeneratedNameForNode(node)
 * }
 */
export function NodeFactory_getName(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>, emitFlags: EmitFlags, opts: AssignedNameOptions): GoPtr<IdentifierNode> {
  let nodeName: GoPtr<IdentifierNode> = undefined;
  if (node !== undefined) {
    if (opts.IgnoreAssignedName) {
      nodeName = GetNonAssignedNameOfDeclaration(node as unknown as GoPtr<Node>) as GoPtr<IdentifierNode>;
    } else {
      nodeName = GetNameOfDeclaration(node as unknown as GoPtr<Node>) as GoPtr<IdentifierNode>;
    }
  }

  if (nodeName !== undefined) {
    const name = Node_Clone(nodeName as unknown as GoPtr<Node>, receiver!.__tsgoEmbedded0! as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
    let flags = emitFlags;
    if (!opts.AllowComments) {
      flags = (flags | EFNoComments) as EmitFlags;
    }
    if (!opts.AllowSourceMaps) {
      flags = (flags | EFNoSourceMap) as EmitFlags;
    }
    EmitContext_AddEmitFlags(receiver!.emitContext, name as unknown as GoPtr<Node>, flags);
    return name;
  }

  return NodeFactory_NewGeneratedNameForNode(receiver, node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetLocalName","kind":"method","status":"implemented","sigHash":"c2bd21c2253d3de7d0cac30dcb1095a057e62456b80d3669c641aaf8914cb84e","bodyHash":"53bfcdb8fc049ae59bc5bd4c01aca54fe2fe1f47d56ff687f5b12a6058f4612f"}
 *
 * Go source:
 * func (f *NodeFactory) GetLocalName(node *ast.Declaration) *ast.IdentifierNode {
 * 	return f.GetLocalNameEx(node, AssignedNameOptions{})
 * }
 */
export function NodeFactory_GetLocalName(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>): GoPtr<IdentifierNode> {
  return NodeFactory_GetLocalNameEx(receiver, node, { AllowComments: false, AllowSourceMaps: false, IgnoreAssignedName: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetLocalNameEx","kind":"method","status":"implemented","sigHash":"04632020e49d1e3e57df204399af000906fa539aa4e37706c1e668168bc4d90e","bodyHash":"634f937d65abffbf20bfb3fc36baaeed0f587d42f184c5dec03dbd3a1ac1cea6"}
 *
 * Go source:
 * func (f *NodeFactory) GetLocalNameEx(node *ast.Declaration, opts AssignedNameOptions) *ast.IdentifierNode {
 * 	return f.getName(node, EFLocalName, opts)
 * }
 */
export function NodeFactory_GetLocalNameEx(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>, opts: AssignedNameOptions): GoPtr<IdentifierNode> {
  return NodeFactory_getName(receiver, node, EFLocalName, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetExportName","kind":"method","status":"implemented","sigHash":"3a59c3bc6b1fc124472ab2a64e9b5cd1f5bbd176d8d8d5e887e4a622525f6b24","bodyHash":"994df15a0c66be19a859bc77509bc5479a74ee297658eb86736c519f4941a33a"}
 *
 * Go source:
 * func (f *NodeFactory) GetExportName(node *ast.Declaration) *ast.IdentifierNode {
 * 	return f.GetExportNameEx(node, AssignedNameOptions{})
 * }
 */
export function NodeFactory_GetExportName(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>): GoPtr<IdentifierNode> {
  return NodeFactory_GetExportNameEx(receiver, node, { AllowComments: false, AllowSourceMaps: false, IgnoreAssignedName: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetExportNameEx","kind":"method","status":"implemented","sigHash":"13bf7475c0b13e00ad4571daca9d10c1cd66e93e94f9242d8aaa49e23e896e08","bodyHash":"de1a16fe9ad1bd5da348884071fcac4bbb1f5f021e964ddf68e3bda6a6557634"}
 *
 * Go source:
 * func (f *NodeFactory) GetExportNameEx(node *ast.Declaration, opts AssignedNameOptions) *ast.IdentifierNode {
 * 	return f.getName(node, EFExportName, opts)
 * }
 */
export function NodeFactory_GetExportNameEx(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>, opts: AssignedNameOptions): GoPtr<IdentifierNode> {
  return NodeFactory_getName(receiver, node, EFExportName, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetDeclarationName","kind":"method","status":"implemented","sigHash":"e19ef55638aed93f54546615e2b98453f10bc36f5246c26f77246a1cffd93dcd","bodyHash":"9cddc3da27451cf68b92e61b0de71f81cd3e349abd18f600148bb4e4336e5edc"}
 *
 * Go source:
 * func (f *NodeFactory) GetDeclarationName(node *ast.Declaration) *ast.IdentifierNode {
 * 	return f.GetDeclarationNameEx(node, NameOptions{})
 * }
 */
export function NodeFactory_GetDeclarationName(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>): GoPtr<IdentifierNode> {
  return NodeFactory_GetDeclarationNameEx(receiver, node, { AllowComments: false, AllowSourceMaps: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetDeclarationNameEx","kind":"method","status":"implemented","sigHash":"e1f8c24787ffe4888f6d7da23bfdf725935baa78a99b5a0c1376eff52d78bfbf","bodyHash":"3c37d81db7a3a4fa3c9607be0e1bbaabe15d635a2b5c4d38898342e2994cdf3e"}
 *
 * Go source:
 * func (f *NodeFactory) GetDeclarationNameEx(node *ast.Declaration, opts NameOptions) *ast.IdentifierNode {
 * 	return f.getName(node, EFNone, AssignedNameOptions{AllowComments: opts.AllowComments, AllowSourceMaps: opts.AllowSourceMaps})
 * }
 */
export function NodeFactory_GetDeclarationNameEx(receiver: GoPtr<NodeFactory>, node: GoPtr<Declaration>, opts: NameOptions): GoPtr<IdentifierNode> {
  return NodeFactory_getName(receiver, node, EFNone, { AllowComments: opts.AllowComments, AllowSourceMaps: opts.AllowSourceMaps, IgnoreAssignedName: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetNamespaceMemberName","kind":"method","status":"implemented","sigHash":"a9566c9944a8234ea6946c55f8404e3a308fdff286a6d11a616ed13d135ff159","bodyHash":"2cc552a44b48ec88173d609f1c8012317c3a09b24f38e691253c153716c5953f"}
 *
 * Go source:
 * func (f *NodeFactory) GetNamespaceMemberName(ns *ast.IdentifierNode, name *ast.IdentifierNode, opts NameOptions) *ast.IdentifierNode {
 * 	if !f.emitContext.HasAutoGenerateInfo(name) {
 * 		name = name.Clone(f)
 * 	}
 * 	qualifiedName := f.NewPropertyAccessExpression(ns, nil /*questionDotToken* /, name, ast.NodeFlagsNone)
 * 	f.emitContext.AssignCommentAndSourceMapRanges(qualifiedName, name)
 * 	if !opts.AllowComments {
 * 		f.emitContext.AddEmitFlags(qualifiedName, EFNoComments)
 * 	}
 * 	if !opts.AllowSourceMaps {
 * 		f.emitContext.AddEmitFlags(qualifiedName, EFNoSourceMap)
 * 	}
 * 	return qualifiedName
 * }
 */
export function NodeFactory_GetNamespaceMemberName(receiver: GoPtr<NodeFactory>, ns: GoPtr<IdentifierNode>, name: GoPtr<IdentifierNode>, opts: NameOptions): GoPtr<IdentifierNode> {
  const f = receiver!.__tsgoEmbedded0!;
  if (!EmitContext_HasAutoGenerateInfo(receiver!.emitContext, name)) {
    name = Node_Clone(name as unknown as GoPtr<Node>, f as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
  }
  const qualifiedName = NewPropertyAccessExpression(f, ns, undefined, name, NodeFlagsNone);
  EmitContext_AssignCommentAndSourceMapRanges(receiver!.emitContext, qualifiedName, name as unknown as GoPtr<Node>);
  if (!opts.AllowComments) {
    EmitContext_AddEmitFlags(receiver!.emitContext, qualifiedName, EFNoComments);
  }
  if (!opts.AllowSourceMaps) {
    EmitContext_AddEmitFlags(receiver!.emitContext, qualifiedName, EFNoSourceMap);
  }
  return qualifiedName as unknown as GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.GetExternalModuleOrNamespaceExportName","kind":"method","status":"implemented","sigHash":"ba41712a76476a175a4eedd295d12296933a418d347ec101feb934bf35b364a1","bodyHash":"9af36d3f599c69c95a5c1c355803010a087bf0ecfd1a577ec578262bd9c580a1"}
 *
 * Go source:
 * func (f *NodeFactory) GetExternalModuleOrNamespaceExportName(ns *ast.IdentifierNode, node *ast.Declaration, allowComments bool, allowSourceMaps bool) *ast.Node {
 * 	if ns != nil && ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) {
 * 		nameOpts := NameOptions{AllowComments: allowComments, AllowSourceMaps: allowSourceMaps}
 * 		return f.GetNamespaceMemberName(ns, f.GetDeclarationNameEx(node, nameOpts), nameOpts)
 * 	}
 * 	return f.GetExportNameEx(node, AssignedNameOptions{AllowComments: allowComments, AllowSourceMaps: allowSourceMaps})
 * }
 */
export function NodeFactory_GetExternalModuleOrNamespaceExportName(receiver: GoPtr<NodeFactory>, ns: GoPtr<IdentifierNode>, node: GoPtr<Declaration>, allowComments: bool, allowSourceMaps: bool): GoPtr<Node> {
  if (ns !== undefined && HasSyntacticModifier(node as unknown as GoPtr<Node>, ModifierFlagsExport)) {
    const nameOpts: NameOptions = { AllowComments: allowComments, AllowSourceMaps: allowSourceMaps };
    return NodeFactory_GetNamespaceMemberName(receiver, ns, NodeFactory_GetDeclarationNameEx(receiver, node, nameOpts), nameOpts) as unknown as GoPtr<Node>;
  }
  return NodeFactory_GetExportNameEx(receiver, node, { AllowComments: allowComments, AllowSourceMaps: allowSourceMaps, IgnoreAssignedName: false }) as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewUnscopedHelperName","kind":"method","status":"implemented","sigHash":"f942c1e968f485ef3ea317e3052fa8d7aa841ccd3a3134be4c91965a1cb09ccf","bodyHash":"63a5773beca703e912e99f5e63d17e6d62877db2bc6937654fcaaeefca24daef"}
 *
 * Go source:
 * func (f *NodeFactory) NewUnscopedHelperName(name string) *ast.IdentifierNode {
 * 	node := f.NewIdentifier(name)
 * 	f.emitContext.SetEmitFlags(node, EFHelperName)
 * 	return node
 * }
 */
export function NodeFactory_NewUnscopedHelperName(receiver: GoPtr<NodeFactory>, name: string): GoPtr<IdentifierNode> {
  const f = receiver!.__tsgoEmbedded0!;
  const node = NewIdentifier(f, name);
  EmitContext_SetEmitFlags(receiver!.emitContext, node, EFHelperName);
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewDecorateHelper","kind":"method","status":"implemented","sigHash":"1b391f8443b00f72f6c3263a6ec035c73c121b85b0dcd035777d04eebc46d2cd","bodyHash":"62358f4c549e0f8408819ad9e033681ec76f76c4e9142d57da5c377b0d230cc3"}
 *
 * Go source:
 * func (f *NodeFactory) NewDecorateHelper(decoratorExpressions []*ast.Node, target *ast.Node, memberName *ast.Node, descriptor *ast.Node) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(decorateHelper)
 * 
 * 	var argumentsArray []*ast.Node
 * 	argumentsArray = append(argumentsArray, f.NewArrayLiteralExpression(f.NewNodeList(decoratorExpressions), true))
 * 	argumentsArray = append(argumentsArray, target)
 * 	if memberName != nil {
 * 		argumentsArray = append(argumentsArray, memberName)
 * 		if descriptor != nil {
 * 			argumentsArray = append(argumentsArray, descriptor)
 * 		}
 * 	}
 * 
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__decorate"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(argumentsArray),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewDecorateHelper(receiver: GoPtr<NodeFactory>, decoratorExpressions: GoSlice<GoPtr<Node>>, target: GoPtr<Node>, memberName: GoPtr<Node>, descriptor: GoPtr<Node>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, decorateHelper);

  let argumentsArray: GoSlice<GoPtr<Node>> = [];
  argumentsArray = [...argumentsArray, NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, decoratorExpressions), true)];
  argumentsArray = [...argumentsArray, target];
  if (memberName !== undefined) {
    argumentsArray = [...argumentsArray, memberName];
    if (descriptor !== undefined) {
      argumentsArray = [...argumentsArray, descriptor];
    }
  }

  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__decorate"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, argumentsArray),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewMetadataHelper","kind":"method","status":"implemented","sigHash":"764b5e2b774c71d7333d0c02183dec99a9cef57a2f32523cd67d85dc1b043d8a","bodyHash":"8c3e1f3d98ca0feea955b108146d64b0575700392372407b9ce55c0588ce91ad"}
 *
 * Go source:
 * func (f *NodeFactory) NewMetadataHelper(metadataKey string, metadataValue *ast.Node) *ast.Node {
 * 	f.emitContext.RequestEmitHelper(metadataHelper)
 * 
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__metadata"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Node{
 * 			f.NewStringLiteral(metadataKey, ast.TokenFlagsNone),
 * 			metadataValue,
 * 		}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewMetadataHelper(receiver: GoPtr<NodeFactory>, metadataKey: string, metadataValue: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, metadataHelper);

  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__metadata"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [
      NewStringLiteral(f, metadataKey, TokenFlagsNone),
      metadataValue,
    ]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewParamHelper","kind":"method","status":"implemented","sigHash":"111982e09290ccc02bc3e72e65f614382bf60f3c781ae397d9a3e62896a4b149","bodyHash":"848c2e40090e8f0734d6b7610e76fd2c433f40e49d3482d7f262429d4c5c6852"}
 *
 * Go source:
 * func (f *NodeFactory) NewParamHelper(expression *ast.Node, parameterOffset int, location core.TextRange) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(paramHelper)
 * 	helper := f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__param"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{f.NewNumericLiteral(strconv.Itoa(parameterOffset), ast.TokenFlagsNone), expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	helper.Loc = location
 * 	return helper
 * }
 */
export function NodeFactory_NewParamHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Node>, parameterOffset: int, location: TextRange): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, paramHelper);
  const helper = NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__param"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [NewNumericLiteral(f, Itoa(parameterOffset), TokenFlagsNone), expression]),
    NodeFlagsNone,
  );
  helper!.Loc = location;
  return helper;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAddDisposableResourceHelper","kind":"method","status":"implemented","sigHash":"c45019fade4d6c661675e0a87e8f5aa881644d131f420997d4a730a042069c20","bodyHash":"91bed8f9b1c9b187503d7181fc368956b33814d14515bf5da1a54450d3b9f6ad"}
 *
 * Go source:
 * func (f *NodeFactory) NewAddDisposableResourceHelper(envBinding *ast.Expression, value *ast.Expression, async bool) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(addDisposableResourceHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__addDisposableResource"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{envBinding, value, f.NewKeywordExpression(core.IfElse(async, ast.KindTrueKeyword, ast.KindFalseKeyword))}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAddDisposableResourceHelper(receiver: GoPtr<NodeFactory>, envBinding: GoPtr<Expression>, value: GoPtr<Expression>, async: bool): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, addDisposableResourceHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__addDisposableResource"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [envBinding, value, NewKeywordExpression(f, IfElse(async, KindTrueKeyword, KindFalseKeyword))]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewDisposeResourcesHelper","kind":"method","status":"implemented","sigHash":"7bb268ed7b228c99940f0b8c37c27f7306a5973a897430ef0b5860cdd6beeef0","bodyHash":"087233c6a5f686cdf002c5cda95d631838aa9c2cd417f633052ff525a8716afe"}
 *
 * Go source:
 * func (f *NodeFactory) NewDisposeResourcesHelper(envBinding *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(disposeResourcesHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__disposeResources"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{envBinding}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewDisposeResourcesHelper(receiver: GoPtr<NodeFactory>, envBinding: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, disposeResourcesHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__disposeResources"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [envBinding]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::type::PrivateIdentifierKind","kind":"type","status":"implemented","sigHash":"21c0c107db435d0d5364c3bd032bd9d83b8ccf23ba027eb41afc19869fa6852f","bodyHash":"7e75697350348a6dae519f26d69517ffa7831f77c3377a212224d3bf7352b67e"}
 *
 * Go source:
 * PrivateIdentifierKind string
 */
export type PrivateIdentifierKind = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::constGroup::PrivateIdentifierKindField+PrivateIdentifierKindMethod+PrivateIdentifierKindAccessor+PrivateIdentifierKindUntransformed","kind":"constGroup","status":"implemented","sigHash":"ec138418501a02f702e9572e8a2a1fff47c001f67dcdf958880f9e8d66eccef7","bodyHash":"68c8b9e2b3ff99988487469eb7ca4b2de4f6e1fc63d57736c39063b24a63efb0"}
 *
 * Go source:
 * const (
 * 	PrivateIdentifierKindField         PrivateIdentifierKind = "f"
 * 	PrivateIdentifierKindMethod        PrivateIdentifierKind = "m"
 * 	PrivateIdentifierKindAccessor      PrivateIdentifierKind = "a"
 * 	PrivateIdentifierKindUntransformed PrivateIdentifierKind = "untransformed"
 * )
 */
export const PrivateIdentifierKindField: PrivateIdentifierKind = "f";
export const PrivateIdentifierKindMethod: PrivateIdentifierKind = "m";
export const PrivateIdentifierKindAccessor: PrivateIdentifierKind = "a";
export const PrivateIdentifierKindUntransformed: PrivateIdentifierKind = "untransformed";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewClassPrivateFieldGetHelper","kind":"method","status":"implemented","sigHash":"ab4b8de627f79e3d6558803188fb5edc4e5365911a604b0b24da1f2e5ad15b11","bodyHash":"7d22abcd052b7202164d7f320c4d0ad7e0ce10eede8786528032b28bffdfd8a7"}
 *
 * Go source:
 * func (f *NodeFactory) NewClassPrivateFieldGetHelper(receiver *ast.Expression, state *ast.IdentifierNode, kind PrivateIdentifierKind, fn *ast.IdentifierNode) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(classPrivateFieldGetHelper)
 * 	var args []*ast.Node
 * 	if fn == nil {
 * 		args = []*ast.Node{receiver, state, f.NewStringLiteral(string(kind), ast.TokenFlagsNone)}
 * 	} else {
 * 		args = []*ast.Node{receiver, state, f.NewStringLiteral(string(kind), ast.TokenFlagsNone), fn}
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__classPrivateFieldGet"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(args),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewClassPrivateFieldGetHelper(receiver: GoPtr<NodeFactory>, receiver1: GoPtr<Expression>, state: GoPtr<IdentifierNode>, kind: PrivateIdentifierKind, fn: GoPtr<IdentifierNode>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, classPrivateFieldGetHelper);
  const args: GoSlice<GoPtr<Node>> = fn === undefined
    ? [receiver1, state, NewStringLiteral(f, kind, TokenFlagsNone)]
    : [receiver1, state, NewStringLiteral(f, kind, TokenFlagsNone), fn];
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__classPrivateFieldGet"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, args),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewClassPrivateFieldSetHelper","kind":"method","status":"implemented","sigHash":"1b56046fc2bc4eafe319fb043be190c7046902f734259e910e973a8bfc11f37f","bodyHash":"b109748d311cc488a9db42c27b65d857aeb7391c97b3a8b9a535a334b5a5e39f"}
 *
 * Go source:
 * func (f *NodeFactory) NewClassPrivateFieldSetHelper(receiver *ast.Expression, state *ast.IdentifierNode, value *ast.Expression, kind PrivateIdentifierKind, fn *ast.IdentifierNode) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(classPrivateFieldSetHelper)
 * 	var args []*ast.Node
 * 	if fn == nil {
 * 		args = []*ast.Node{receiver, state, value, f.NewStringLiteral(string(kind), ast.TokenFlagsNone)}
 * 	} else {
 * 		args = []*ast.Node{receiver, state, value, f.NewStringLiteral(string(kind), ast.TokenFlagsNone), fn}
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__classPrivateFieldSet"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(args),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewClassPrivateFieldSetHelper(receiver: GoPtr<NodeFactory>, receiver1: GoPtr<Expression>, state: GoPtr<IdentifierNode>, value: GoPtr<Expression>, kind: PrivateIdentifierKind, fn: GoPtr<IdentifierNode>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, classPrivateFieldSetHelper);
  const args: GoSlice<GoPtr<Node>> = fn === undefined
    ? [receiver1, state, value, NewStringLiteral(f, kind, TokenFlagsNone)]
    : [receiver1, state, value, NewStringLiteral(f, kind, TokenFlagsNone), fn];
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__classPrivateFieldSet"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, args),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewClassPrivateFieldInHelper","kind":"method","status":"implemented","sigHash":"a342b0ffe1e442de1c97fbc55bdf3d9735417401751c82f25cf0e3651eb524f5","bodyHash":"0cfc2e92ca6ae63fdd6cf1550b90363f73d5e3d9aef3d74160451471222c702f"}
 *
 * Go source:
 * func (f *NodeFactory) NewClassPrivateFieldInHelper(state *ast.IdentifierNode, receiver *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(classPrivateFieldInHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__classPrivateFieldIn"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{state, receiver}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewClassPrivateFieldInHelper(receiver: GoPtr<NodeFactory>, state: GoPtr<IdentifierNode>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, classPrivateFieldInHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__classPrivateFieldIn"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [state, receiver1]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewObjectDefinePropertyCall","kind":"method","status":"implemented","sigHash":"9ae7510f60635f6310ca57a83c42ae63eab79f0c6761fad4a702dbf9e5ecdb6f","bodyHash":"0ad2d4a20a689cc95ed5fbbfac81b6599bd939b2737593097c7b056c76f3c370"}
 *
 * Go source:
 * func (f *NodeFactory) NewObjectDefinePropertyCall(target *ast.Expression, name *ast.Expression, descriptor *ast.Expression) *ast.Expression {
 * 	return f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(
 * 			f.NewIdentifier("Object"),
 * 			nil,
 * 			f.NewIdentifier("defineProperty"),
 * 			ast.NodeFlagsNone,
 * 		),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{target, name, descriptor}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewObjectDefinePropertyCall(receiver: GoPtr<NodeFactory>, target: GoPtr<Expression>, name: GoPtr<Expression>, descriptor: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewCallExpression(
    f,
    NewPropertyAccessExpression(
      f,
      NewIdentifier(f, "Object"),
      undefined,
      NewIdentifier(f, "defineProperty"),
      NodeFlagsNone,
    ),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [target, name, descriptor]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewReflectGetCall","kind":"method","status":"implemented","sigHash":"bb88bd22904e3722d5bbe72b1c658c82b6b5f4ef5c1a742178e66d7b5169a785","bodyHash":"6b2438104820948c03ded5bfd3884116f4b703e22ca3853df41542ab0fc2a3f0"}
 *
 * Go source:
 * func (f *NodeFactory) NewReflectGetCall(target *ast.Expression, propertyKey *ast.Expression, receiver *ast.Expression) *ast.Expression {
 * 	return f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(
 * 			f.NewIdentifier("Reflect"),
 * 			nil,
 * 			f.NewIdentifier("get"),
 * 			ast.NodeFlagsNone,
 * 		),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{target, propertyKey, receiver}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewReflectGetCall(receiver: GoPtr<NodeFactory>, target: GoPtr<Expression>, propertyKey: GoPtr<Expression>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewCallExpression(
    f,
    NewPropertyAccessExpression(
      f,
      NewIdentifier(f, "Reflect"),
      undefined,
      NewIdentifier(f, "get"),
      NodeFlagsNone,
    ),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [target, propertyKey, receiver1]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewReflectSetCall","kind":"method","status":"implemented","sigHash":"63d8b3668e4e11fa6c820073c918ebd5d6daa9a3719384e152a511e048606948","bodyHash":"b1c1a8933f2cd9037d14b89fd31a06ed890003fffdc07c4c9f9491a341daee1d"}
 *
 * Go source:
 * func (f *NodeFactory) NewReflectSetCall(target *ast.Expression, propertyKey *ast.Expression, value *ast.Expression, receiver *ast.Expression) *ast.Expression {
 * 	return f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(
 * 			f.NewIdentifier("Reflect"),
 * 			nil,
 * 			f.NewIdentifier("set"),
 * 			ast.NodeFlagsNone,
 * 		),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{target, propertyKey, value, receiver}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewReflectSetCall(receiver: GoPtr<NodeFactory>, target: GoPtr<Expression>, propertyKey: GoPtr<Expression>, value: GoPtr<Expression>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewCallExpression(
    f,
    NewPropertyAccessExpression(
      f,
      NewIdentifier(f, "Reflect"),
      undefined,
      NewIdentifier(f, "set"),
      NodeFlagsNone,
    ),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [target, propertyKey, value, receiver1]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewFunctionBindCall","kind":"method","status":"implemented","sigHash":"3611c1be12258bcd25732d0966b65ba0464de768dd021a51a073d8355b9da506","bodyHash":"8340ac6f84dabe901a7e5b83e52010cd14cca96714a89236cc4df44039330b0e"}
 *
 * Go source:
 * func (f *NodeFactory) NewFunctionBindCall(target *ast.Expression, thisArg *ast.Expression, argumentsList []*ast.Node) *ast.Expression {
 * 	args := make([]*ast.Node, 0, 1+len(argumentsList))
 * 	args = append(args, thisArg)
 * 	args = append(args, argumentsList...)
 * 	return f.NewMethodCall(target, f.NewIdentifier("bind"), args)
 * }
 */
export function NodeFactory_NewFunctionBindCall(receiver: GoPtr<NodeFactory>, target: GoPtr<Expression>, thisArg: GoPtr<Expression>, argumentsList: GoSlice<GoPtr<Node>>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  const args: GoSlice<GoPtr<Node>> = [thisArg, ...argumentsList];
  return NodeFactory_NewMethodCall(receiver, target, NewIdentifier(f, "bind"), args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewImmediatelyInvokedArrowFunction","kind":"method","status":"implemented","sigHash":"8e73b2aea8d69635da903f7060bd06bebcea32fc76fb92a3358d240e43a85214","bodyHash":"7a6bc9282e46767adef14203a6729021a20e94aa685fefb24536592a25dfcc3a"}
 *
 * Go source:
 * func (f *NodeFactory) NewImmediatelyInvokedArrowFunction(statements []*ast.Statement) *ast.Expression {
 * 	arrow := f.NewArrowFunction(
 * 		nil,                          /*modifiers* /
 * 		nil,                          /*typeParameters* /
 * 		f.NewNodeList([]*ast.Node{}), /*parameters* /
 * 		nil,                          /*returnType* /
 * 		nil,                          /*fullSignature* /
 * 		f.NewToken(ast.KindEqualsGreaterThanToken), /*equalsGreaterThanToken* /
 * 		f.NewBlock(f.NewNodeList(statements), true),
 * 	)
 * 	return f.NewCallExpression(
 * 		f.NewParenthesizedExpression(arrow),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Node{}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewImmediatelyInvokedArrowFunction(receiver: GoPtr<NodeFactory>, statements: GoSlice<GoPtr<Statement>>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  const arrow = NewArrowFunction(
    f,
    undefined, /*modifiers*/
    undefined, /*typeParameters*/
    NodeFactory_NewNodeList(f, []), /*parameters*/
    undefined, /*returnType*/
    undefined, /*fullSignature*/
    NewToken(f, KindEqualsGreaterThanToken), /*equalsGreaterThanToken*/
    NewBlock(f, NodeFactory_NewNodeList(f, statements), true),
  );
  return NewCallExpression(
    f,
    NewParenthesizedExpression(f, arrow),
    undefined, /*questionDotToken*/
    undefined, /*typeArguments*/
    NodeFactory_NewNodeList(f, []),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewExportDefault","kind":"method","status":"implemented","sigHash":"2ac6504a00202c826551b66028975237c3440700a506fd9018c3cd3e974099f4","bodyHash":"a54f39c6adfb8ef1e97e64a4a31ded037dd8a6a9f4e200caeaa318259e79edde"}
 *
 * Go source:
 * func (f *NodeFactory) NewExportDefault(expression *ast.Expression) *ast.Statement {
 * 	return f.NewExportAssignment(nil, false, nil, expression)
 * }
 */
export function NodeFactory_NewExportDefault(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Statement> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewExportAssignment(f, undefined, false, undefined, expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewExternalModuleExport","kind":"method","status":"implemented","sigHash":"02af76eafa36b21182345f41deba09e72379c15972c7b44175b407b6c5e6f819","bodyHash":"b931302e2cdcbe8392c833c49420a5df766ac379c1adc3094433a5e3b9f6cf38"}
 *
 * Go source:
 * func (f *NodeFactory) NewExternalModuleExport(name *ast.IdentifierNode) *ast.Statement {
 * 	specifier := f.NewExportSpecifier(false, nil, name)
 * 	namedExports := f.NewNamedExports(f.NewNodeList([]*ast.Node{specifier}))
 * 	return f.NewExportDeclaration(nil, false, namedExports, nil, nil)
 * }
 */
export function NodeFactory_NewExternalModuleExport(receiver: GoPtr<NodeFactory>, name: GoPtr<IdentifierNode>): GoPtr<Statement> {
  const f = receiver!.__tsgoEmbedded0!;
  const specifier = NewExportSpecifier(f, false, undefined, name);
  const namedExports = NewNamedExports(f, NodeFactory_NewNodeList(f, [specifier]));
  return NewExportDeclaration(f, undefined, false, namedExports, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAssignHelper","kind":"method","status":"implemented","sigHash":"b05953b344be84fd5df77d771e4abf427312ec7a1ccf104d17ca6da6044100ad","bodyHash":"73b0ac887357bafb7a823cc4318f4a09b37ee63f75541cfd49c1b7668ea68253"}
 *
 * Go source:
 * func (f *NodeFactory) NewAssignHelper(attributesSegments []*ast.Expression, scriptTarget core.ScriptTarget) *ast.Expression {
 * 	return f.NewCallExpression(f.NewPropertyAccessExpression(f.NewIdentifier("Object"), nil, f.NewIdentifier("assign"), ast.NodeFlagsNone), nil, nil, f.NewNodeList(attributesSegments), ast.NodeFlagsNone)
 * }
 */
export function NodeFactory_NewAssignHelper(receiver: GoPtr<NodeFactory>, attributesSegments: GoSlice<GoPtr<Expression>>, scriptTarget: ScriptTarget): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  return NewCallExpression(f, NewPropertyAccessExpression(f, NewIdentifier(f, "Object"), undefined, NewIdentifier(f, "assign"), NodeFlagsNone), undefined, undefined, NodeFactory_NewNodeList(f, attributesSegments), NodeFlagsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewRestHelper","kind":"method","status":"implemented","sigHash":"9a928547e1de56ea38e37be92f4e72e874087e78064bae6f92b7ce2b86e25153","bodyHash":"323157021063964b424e1cc893759bb39a7cc38c0a9c46d7e5fe0b0383f274a6"}
 *
 * Go source:
 * func (f *NodeFactory) NewRestHelper(value *ast.Expression, elements []*ast.Node, computedTempVariables []*ast.Node, location core.TextRange) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(restHelper)
 * 	var propertyNames []*ast.Node
 * 	computedTempVariableOffset := 0
 * 	for i, element := range elements {
 * 		if i == len(elements)-1 {
 * 			break
 * 		}
 * 		propertyName := ast.TryGetPropertyNameOfBindingOrAssignmentElement(element)
 * 		if propertyName != nil {
 * 			if ast.IsComputedPropertyName(propertyName) {
 * 				debug.Assert(computedTempVariables != nil, "Encountered computed property name but 'computedTempVariables' argument was not provided.")
 * 				temp := computedTempVariables[computedTempVariableOffset]
 * 				computedTempVariableOffset++
 * 				// typeof _tmp === "symbol" ? _tmp : _tmp + ""
 * 				propertyNames = append(propertyNames, f.NewConditionalExpression(
 * 					f.NewTypeCheck(temp, "symbol"),
 * 					f.NewToken(ast.KindQuestionToken),
 * 					temp,
 * 					f.NewToken(ast.KindColonToken),
 * 					f.NewBinaryExpression(nil, temp, nil, f.NewToken(ast.KindPlusToken), f.NewStringLiteral("", ast.TokenFlagsNone)),
 * 				))
 * 			} else {
 * 				propertyNames = append(propertyNames, f.NewStringLiteralFromNode(propertyName))
 * 			}
 * 		}
 * 	}
 * 	propNames := f.NewArrayLiteralExpression(f.NewNodeList(propertyNames), false)
 * 	propNames.Loc = location
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__rest"),
 * 		nil,
 * 		nil,
 * 		f.NewNodeList([]*ast.Node{
 * 			value,
 * 			propNames,
 * 		}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewRestHelper(receiver: GoPtr<NodeFactory>, value: GoPtr<Expression>, elements: GoSlice<GoPtr<Node>>, computedTempVariables: GoSlice<GoPtr<Node>>, location: TextRange): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, restHelper);
  let propertyNames: GoSlice<GoPtr<Node>> = [];
  let computedTempVariableOffset = 0;
  for (let i = 0; i < elements.length; i++) {
    if (i === elements.length - 1) {
      break;
    }
    const element = elements[i];
    const propertyName = TryGetPropertyNameOfBindingOrAssignmentElement(element);
    if (propertyName !== undefined) {
      if (IsComputedPropertyName(propertyName)) {
        const temp = computedTempVariables[computedTempVariableOffset];
        computedTempVariableOffset++;
        // typeof _tmp === "symbol" ? _tmp : _tmp + ""
        propertyNames = [...propertyNames, NewConditionalExpression(
          f,
          NodeFactory_NewTypeCheck(receiver, temp, "symbol"),
          NewToken(f, KindQuestionToken),
          temp,
          NewToken(f, KindColonToken),
          NewBinaryExpression(f, undefined, temp, undefined, NewToken(f, KindPlusToken), NewStringLiteral(f, "", TokenFlagsNone)),
        )];
      } else {
        propertyNames = [...propertyNames, NodeFactory_NewStringLiteralFromNode(receiver, propertyName)];
      }
    }
  }
  const propNames = NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, propertyNames), false);
  propNames!.Loc = location;
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__rest"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [
      value,
      propNames,
    ]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAwaitHelper","kind":"method","status":"implemented","sigHash":"3e7e2a412eb3b9d14802c7c421641f70eeb41903b4632ca9e81050d115c058ca","bodyHash":"f8873de7d90deab86398851e1eafc67a39870ddfe953071e7c005d1714f7aae7"}
 *
 * Go source:
 * func (f *NodeFactory) NewAwaitHelper(expression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(awaitHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__await"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAwaitHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, awaitHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__await"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAsyncGeneratorHelper","kind":"method","status":"implemented","sigHash":"e6091bc42778e164f97f9af33da320ef535252224573c68258fdbdfac457b0eb","bodyHash":"f695aad4250759cec6a1b7f5fd7390b907e250935ff550663ad99e12fa04c621"}
 *
 * Go source:
 * func (f *NodeFactory) NewAsyncGeneratorHelper(
 * 	generatorFunc *ast.Expression,
 * 	hasLexicalThis bool,
 * ) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(awaitHelper)
 * 	f.emitContext.RequestEmitHelper(asyncGeneratorHelper)
 * 
 * 	// Mark this node as originally an async function body
 * 	f.emitContext.AddEmitFlags(generatorFunc, EFAsyncFunctionBody|EFReuseTempVariableScope)
 * 
 * 	var thisArg *ast.Expression
 * 	if hasLexicalThis {
 * 		thisArg = f.NewKeywordExpression(ast.KindThisKeyword)
 * 	} else {
 * 		thisArg = f.NewVoidZeroExpression()
 * 	}
 * 
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__asyncGenerator"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{
 * 			thisArg,
 * 			f.NewIdentifier("arguments"),
 * 			generatorFunc,
 * 		}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAsyncGeneratorHelper(receiver: GoPtr<NodeFactory>, generatorFunc: GoPtr<Expression>, hasLexicalThis: bool): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, awaitHelper);
  EmitContext_RequestEmitHelper(receiver!.emitContext, asyncGeneratorHelper);

  // Mark this node as originally an async function body
  EmitContext_AddEmitFlags(receiver!.emitContext, generatorFunc, EFAsyncFunctionBody | EFReuseTempVariableScope);

  const thisArg: GoPtr<Expression> = hasLexicalThis
    ? NewKeywordExpression(f, KindThisKeyword)
    : NodeFactory_NewVoidZeroExpression(receiver);

  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__asyncGenerator"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [
      thisArg,
      NewIdentifier(f, "arguments"),
      generatorFunc,
    ]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAsyncDelegatorHelper","kind":"method","status":"implemented","sigHash":"66928c0f84acf9eb280db80b7e8686ade10b5b04cf537d70c0f17133b023ebf1","bodyHash":"6ec05eadf95f0fdaa7bf3bf3393130d0b29e01a2fa19a587597a7772198d9a01"}
 *
 * Go source:
 * func (f *NodeFactory) NewAsyncDelegatorHelper(expression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(awaitHelper)
 * 	f.emitContext.RequestEmitHelper(asyncDelegatorHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__asyncDelegator"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAsyncDelegatorHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, awaitHelper);
  EmitContext_RequestEmitHelper(receiver!.emitContext, asyncDelegatorHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__asyncDelegator"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAsyncValuesHelper","kind":"method","status":"implemented","sigHash":"37a801db66a3bbd9302528e3aa0a3dce8bd4b4657daf6682aca3b9dfa2d96993","bodyHash":"38f8ebb11a912b198c6baeabc70fbac35c41fb6992a54bca97090f85f8700722"}
 *
 * Go source:
 * func (f *NodeFactory) NewAsyncValuesHelper(expression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(asyncValuesHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__asyncValues"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAsyncValuesHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, asyncValuesHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__asyncValues"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAwaiterHelper","kind":"method","status":"implemented","sigHash":"2ca8ea6275361f73ac951bfa929b568e6ef7f9491c6446c77719a64dee880dee","bodyHash":"939ebb562f2205c8bc82638a12fada3835a914de6c1e3cb0435c327ac45ca6a6"}
 *
 * Go source:
 * func (f *NodeFactory) NewAwaiterHelper(
 * 	hasLexicalThis bool,
 * 	argumentsExpression *ast.Expression,
 * 	parameters *ast.NodeList,
 * 	body *ast.BlockNode,
 * ) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(awaiterHelper)
 * 
 * 	var params *ast.NodeList
 * 	if parameters != nil {
 * 		params = parameters
 * 	} else {
 * 		params = f.NewNodeList([]*ast.Node{})
 * 	}
 * 
 * 	generatorFunc := f.NewFunctionExpression(
 * 		nil, /*modifiers* /
 * 		f.NewToken(ast.KindAsteriskToken),
 * 		nil, /*name* /
 * 		nil, /*typeParameters* /
 * 		params,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 
 * 	// Mark this node as originally an async function body
 * 	f.emitContext.AddEmitFlags(generatorFunc, EFAsyncFunctionBody|EFReuseTempVariableScope)
 * 
 * 	var thisArg *ast.Expression
 * 	if hasLexicalThis {
 * 		thisArg = f.NewKeywordExpression(ast.KindThisKeyword)
 * 	} else {
 * 		thisArg = f.NewVoidZeroExpression()
 * 	}
 * 
 * 	var argsArg *ast.Expression
 * 	if argumentsExpression != nil {
 * 		argsArg = argumentsExpression
 * 	} else {
 * 		argsArg = f.NewVoidZeroExpression()
 * 	}
 * 
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__awaiter"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{
 * 			thisArg,
 * 			argsArg,
 * 			f.NewVoidZeroExpression(),
 * 			generatorFunc,
 * 		}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAwaiterHelper(receiver: GoPtr<NodeFactory>, hasLexicalThis: bool, argumentsExpression: GoPtr<Expression>, parameters: GoPtr<NodeList>, body: GoPtr<BlockNode>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, awaiterHelper);

  const params: GoPtr<NodeList> = parameters !== undefined ? parameters : NodeFactory_NewNodeList(f, []);

  const generatorFunc = NewFunctionExpression(
    f,
    undefined, /*modifiers*/
    NewToken(f, KindAsteriskToken),
    undefined, /*name*/
    undefined, /*typeParameters*/
    params,
    undefined, /*returnType*/
    undefined, /*fullSignature*/
    body,
  );

  // Mark this node as originally an async function body
  EmitContext_AddEmitFlags(receiver!.emitContext, generatorFunc, EFAsyncFunctionBody | EFReuseTempVariableScope);

  const thisArg: GoPtr<Expression> = hasLexicalThis
    ? NewKeywordExpression(f, KindThisKeyword)
    : NodeFactory_NewVoidZeroExpression(receiver);

  const argsArg: GoPtr<Expression> = argumentsExpression !== undefined
    ? argumentsExpression
    : NodeFactory_NewVoidZeroExpression(receiver);

  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__awaiter"),
    undefined, /*questionDotToken*/
    undefined, /*typeArguments*/
    NodeFactory_NewNodeList(f, [
      thisArg,
      argsArg,
      NodeFactory_NewVoidZeroExpression(receiver),
      generatorFunc,
    ]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassContextObject","kind":"method","status":"implemented","sigHash":"04d9f16cffa994e2e2bdc43eaed2446579dc1e2ba94b5bd5bdc03373831038b1","bodyHash":"0ca2c2c33238a1abcbd3ed30a6b5175e5fd856cfe8d25f7281525eed268c781b"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassContextObject(nameExpr *ast.Expression, metadata *ast.IdentifierNode) *ast.Expression {
 * 	props := []*ast.Node{
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("kind"), nil, nil, f.NewStringLiteral("class", 0)),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("name"), nil, nil, nameExpr),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("metadata"), nil, nil, metadata),
 * 	}
 * 	return f.NewObjectLiteralExpression(f.NewNodeList(props), false)
 * }
 */
export function NodeFactory_NewESDecorateClassContextObject(receiver: GoPtr<NodeFactory>, nameExpr: GoPtr<Expression>, metadata: GoPtr<IdentifierNode>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  const props: GoSlice<GoPtr<Node>> = [
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "kind"), undefined, undefined, NewStringLiteral(f, "class", 0)),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "name"), undefined, undefined, nameExpr),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "metadata"), undefined, undefined, metadata),
  ];
  return NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, props), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassElementAccessGetMethod","kind":"method","status":"implemented","sigHash":"f2d59a8a96c952737cf7e7bf24d8e9f9ed4967a5b8b48a43acfca66b52d2a04e","bodyHash":"6c07d5c690735987e2eb5cfcb9276d1166731487cc3913c6933ae0a740f2f6e0"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassElementAccessGetMethod(
 * 	nameComputed bool,
 * 	nameExpr *ast.Expression,
 * ) *ast.Node {
 * 	var accessor *ast.Expression
 * 	if nameComputed {
 * 		accessor = f.NewElementAccessExpression(f.NewIdentifier("obj"), nil, nameExpr, ast.NodeFlagsNone)
 * 	} else {
 * 		accessor = f.NewPropertyAccessExpression(f.NewIdentifier("obj"), nil, nameExpr, ast.NodeFlagsNone)
 * 	}
 * 
 * 	objParam := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("obj"), nil, nil, nil)
 * 
 * 	arrow := f.NewArrowFunction(
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Node{objParam}),
 * 		nil, nil,
 * 		f.NewToken(ast.KindEqualsGreaterThanToken),
 * 		accessor,
 * 	)
 * 
 * 	return f.NewPropertyAssignment(nil, f.NewIdentifier("get"), nil, nil, arrow)
 * }
 */
export function NodeFactory_NewESDecorateClassElementAccessGetMethod(receiver: GoPtr<NodeFactory>, nameComputed: bool, nameExpr: GoPtr<Expression>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  const accessor: GoPtr<Expression> = nameComputed
    ? NewElementAccessExpression(f, NewIdentifier(f, "obj"), undefined, nameExpr, NodeFlagsNone)
    : NewPropertyAccessExpression(f, NewIdentifier(f, "obj"), undefined, nameExpr, NodeFlagsNone);

  const objParam = NewParameterDeclaration(f, undefined, undefined, NewIdentifier(f, "obj"), undefined, undefined, undefined);

  const arrow = NewArrowFunction(
    f,
    undefined, undefined,
    NodeFactory_NewNodeList(f, [objParam]),
    undefined, undefined,
    NewToken(f, KindEqualsGreaterThanToken),
    accessor,
  );

  return NewPropertyAssignment(f, undefined, NewIdentifier(f, "get"), undefined, undefined, arrow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassElementAccessSetMethod","kind":"method","status":"implemented","sigHash":"d2e100872bdee7c96c6b9b7e5263226098044a27b0f9c541d75b694f3de37ba9","bodyHash":"d76271ca318c00f82e56f74f409cf09a72ab93eeecaaf2fd4d67704a4d4a89b8"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassElementAccessSetMethod(
 * 	nameComputed bool,
 * 	nameExpr *ast.Expression,
 * ) *ast.Node {
 * 	var accessor *ast.Expression
 * 	if nameComputed {
 * 		accessor = f.NewElementAccessExpression(f.NewIdentifier("obj"), nil, nameExpr, ast.NodeFlagsNone)
 * 	} else {
 * 		accessor = f.NewPropertyAccessExpression(f.NewIdentifier("obj"), nil, nameExpr, ast.NodeFlagsNone)
 * 	}
 * 
 * 	assignment := f.NewAssignmentExpression(accessor, f.NewIdentifier("value"))
 * 	stmt := f.NewExpressionStatement(assignment)
 * 	body := f.NewBlock(f.NewNodeList([]*ast.Node{stmt}), false)
 * 
 * 	objParam := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("obj"), nil, nil, nil)
 * 	valueParam := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("value"), nil, nil, nil)
 * 
 * 	arrow := f.NewArrowFunction(
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Node{objParam, valueParam}),
 * 		nil, nil,
 * 		f.NewToken(ast.KindEqualsGreaterThanToken),
 * 		body,
 * 	)
 * 
 * 	return f.NewPropertyAssignment(nil, f.NewIdentifier("set"), nil, nil, arrow)
 * }
 */
export function NodeFactory_NewESDecorateClassElementAccessSetMethod(receiver: GoPtr<NodeFactory>, nameComputed: bool, nameExpr: GoPtr<Expression>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  const accessor: GoPtr<Expression> = nameComputed
    ? NewElementAccessExpression(f, NewIdentifier(f, "obj"), undefined, nameExpr, NodeFlagsNone)
    : NewPropertyAccessExpression(f, NewIdentifier(f, "obj"), undefined, nameExpr, NodeFlagsNone);

  const assignment = NodeFactory_NewAssignmentExpression(receiver, accessor, NewIdentifier(f, "value"));
  const stmt = NewExpressionStatement(f, assignment);
  const body = NewBlock(f, NodeFactory_NewNodeList(f, [stmt]), false);

  const objParam = NewParameterDeclaration(f, undefined, undefined, NewIdentifier(f, "obj"), undefined, undefined, undefined);
  const valueParam = NewParameterDeclaration(f, undefined, undefined, NewIdentifier(f, "value"), undefined, undefined, undefined);

  const arrow = NewArrowFunction(
    f,
    undefined, undefined,
    NodeFactory_NewNodeList(f, [objParam, valueParam]),
    undefined, undefined,
    NewToken(f, KindEqualsGreaterThanToken),
    body,
  );

  return NewPropertyAssignment(f, undefined, NewIdentifier(f, "set"), undefined, undefined, arrow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassElementAccessHasMethod","kind":"method","status":"implemented","sigHash":"66d14160c85fc63bd2adf59f53701720c1acefce2df6ead64cf7b017eac6a51e","bodyHash":"184bee1ce54396f2419daa47bf3b4ae597cbec47531b3b2d65eae26c3606b7c1"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassElementAccessHasMethod(
 * 	nameComputed bool,
 * 	nameExpr *ast.Expression,
 * ) *ast.Node {
 * 	// The property name for the "in" expression
 * 	var propertyName *ast.Expression
 * 	if !nameComputed && nameExpr != nil && ast.IsIdentifier(nameExpr) {
 * 		propertyName = f.NewStringLiteralFromNode(nameExpr)
 * 	} else {
 * 		propertyName = nameExpr
 * 	}
 * 
 * 	objParam := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("obj"), nil, nil, nil)
 * 	inExpr := f.NewBinaryExpression(nil, propertyName, nil, f.NewToken(ast.KindInKeyword), f.NewIdentifier("obj"))
 * 
 * 	arrow := f.NewArrowFunction(
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Node{objParam}),
 * 		nil, nil,
 * 		f.NewToken(ast.KindEqualsGreaterThanToken),
 * 		inExpr,
 * 	)
 * 
 * 	return f.NewPropertyAssignment(nil, f.NewIdentifier("has"), nil, nil, arrow)
 * }
 */
export function NodeFactory_NewESDecorateClassElementAccessHasMethod(receiver: GoPtr<NodeFactory>, nameComputed: bool, nameExpr: GoPtr<Expression>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  // The property name for the "in" expression
  const propertyName: GoPtr<Expression> = !nameComputed && nameExpr !== undefined && IsIdentifier(nameExpr)
    ? NodeFactory_NewStringLiteralFromNode(receiver, nameExpr)
    : nameExpr;

  const objParam = NewParameterDeclaration(f, undefined, undefined, NewIdentifier(f, "obj"), undefined, undefined, undefined);
  const inExpr = NewBinaryExpression(f, undefined, propertyName, undefined, NewToken(f, KindInKeyword), NewIdentifier(f, "obj"));

  const arrow = NewArrowFunction(
    f,
    undefined, undefined,
    NodeFactory_NewNodeList(f, [objParam]),
    undefined, undefined,
    NewToken(f, KindEqualsGreaterThanToken),
    inExpr,
  );

  return NewPropertyAssignment(f, undefined, NewIdentifier(f, "has"), undefined, undefined, arrow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassElementAccessObject","kind":"method","status":"implemented","sigHash":"24a9d76fa683c9193fd9dac4c817dbaa2c9c6810f15844767b7cc65a1574aeec","bodyHash":"3afa2af5c9450a44fd8b9c77ab64385903d51977fdbbcb56c96d9e1214eab80f"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassElementAccessObject(
 * 	nameComputed bool,
 * 	nameExpr *ast.Expression,
 * 	hasGet bool,
 * 	hasSet bool,
 * ) *ast.Expression {
 * 	accessProps := []*ast.Node{}
 * 
 * 	// "has" method: obj => name in obj
 * 	accessProps = append(accessProps, f.NewESDecorateClassElementAccessHasMethod(nameComputed, nameExpr))
 * 
 * 	// "get" method: obj => obj.name or obj => obj[name]
 * 	if hasGet {
 * 		accessProps = append(accessProps, f.NewESDecorateClassElementAccessGetMethod(nameComputed, nameExpr))
 * 	}
 * 
 * 	// "set" method: (obj, value) => { obj.name = value; } or (obj, value) => { obj[name] = value; }
 * 	if hasSet {
 * 		accessProps = append(accessProps, f.NewESDecorateClassElementAccessSetMethod(nameComputed, nameExpr))
 * 	}
 * 
 * 	return f.NewObjectLiteralExpression(f.NewNodeList(accessProps), false)
 * }
 */
export function NodeFactory_NewESDecorateClassElementAccessObject(receiver: GoPtr<NodeFactory>, nameComputed: bool, nameExpr: GoPtr<Expression>, hasGet: bool, hasSet: bool): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  let accessProps: GoSlice<GoPtr<Node>> = [];

  // "has" method: obj => name in obj
  accessProps = [...accessProps, NodeFactory_NewESDecorateClassElementAccessHasMethod(receiver, nameComputed, nameExpr)];

  // "get" method: obj => obj.name or obj => obj[name]
  if (hasGet) {
    accessProps = [...accessProps, NodeFactory_NewESDecorateClassElementAccessGetMethod(receiver, nameComputed, nameExpr)];
  }

  // "set" method: (obj, value) => { obj.name = value; } or (obj, value) => { obj[name] = value; }
  if (hasSet) {
    accessProps = [...accessProps, NodeFactory_NewESDecorateClassElementAccessSetMethod(receiver, nameComputed, nameExpr)];
  }

  return NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, accessProps), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateClassElementContextObject","kind":"method","status":"implemented","sigHash":"5c0e1d5157ce59a555d52660509de2afca8d5cb4498f3649d703a2de1e13283c","bodyHash":"7c39c538636cf6485a333145f5154464ed85fd5d26d727c5b90b7292f1672499"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateClassElementContextObject(
 * 	kind string,
 * 	nameComputed bool,
 * 	nameExpr *ast.Expression,
 * 	isStatic bool,
 * 	isPrivate bool,
 * 	hasGet bool,
 * 	hasSet bool,
 * 	metadata *ast.IdentifierNode,
 * ) *ast.Expression {
 * 	// Build the name value for the context's "name" property
 * 	var nameValue *ast.Expression
 * 	if !nameComputed && nameExpr != nil && (ast.IsPrivateIdentifier(nameExpr) || ast.IsIdentifier(nameExpr)) {
 * 		nameValue = f.NewStringLiteralFromNode(nameExpr)
 * 	} else {
 * 		nameValue = nameExpr
 * 	}
 * 
 * 	// Build the access object with has/get/set arrow functions
 * 	accessObj := f.NewESDecorateClassElementAccessObject(nameComputed, nameExpr, hasGet, hasSet)
 * 
 * 	var staticExpr *ast.Node
 * 	if isStatic {
 * 		staticExpr = f.NewTrueExpression()
 * 	} else {
 * 		staticExpr = f.NewFalseExpression()
 * 	}
 * 
 * 	var privateExpr *ast.Node
 * 	if isPrivate {
 * 		privateExpr = f.NewTrueExpression()
 * 	} else {
 * 		privateExpr = f.NewFalseExpression()
 * 	}
 * 
 * 	props := []*ast.Node{
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("kind"), nil, nil, f.NewStringLiteral(kind, 0)),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("name"), nil, nil, nameValue),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("static"), nil, nil, staticExpr),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("private"), nil, nil, privateExpr),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("access"), nil, nil, accessObj),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("metadata"), nil, nil, metadata),
 * 	}
 * 	return f.NewObjectLiteralExpression(f.NewNodeList(props), false)
 * }
 */
export function NodeFactory_NewESDecorateClassElementContextObject(receiver: GoPtr<NodeFactory>, kind: string, nameComputed: bool, nameExpr: GoPtr<Expression>, isStatic: bool, isPrivate: bool, hasGet: bool, hasSet: bool, metadata: GoPtr<IdentifierNode>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  // Build the name value for the context's "name" property
  const nameValue: GoPtr<Expression> = !nameComputed && nameExpr !== undefined && (IsPrivateIdentifier(nameExpr) || IsIdentifier(nameExpr))
    ? NodeFactory_NewStringLiteralFromNode(receiver, nameExpr)
    : nameExpr;

  // Build the access object with has/get/set arrow functions
  const accessObj = NodeFactory_NewESDecorateClassElementAccessObject(receiver, nameComputed, nameExpr, hasGet, hasSet);

  const staticExpr: GoPtr<Node> = isStatic
    ? NodeFactory_NewTrueExpression(receiver)
    : NodeFactory_NewFalseExpression(receiver);

  const privateExpr: GoPtr<Node> = isPrivate
    ? NodeFactory_NewTrueExpression(receiver)
    : NodeFactory_NewFalseExpression(receiver);

  const props: GoSlice<GoPtr<Node>> = [
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "kind"), undefined, undefined, NewStringLiteral(f, kind, 0)),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "name"), undefined, undefined, nameValue),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "static"), undefined, undefined, staticExpr),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "private"), undefined, undefined, privateExpr),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "access"), undefined, undefined, accessObj),
    NewPropertyAssignment(f, undefined, NewIdentifier(f, "metadata"), undefined, undefined, metadata),
  ];
  return NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, props), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewESDecorateHelper","kind":"method","status":"implemented","sigHash":"7aa36484b4618d77aa789b48d01a12a3f9f7059bd6419bb846384a9d9a86645c","bodyHash":"1cfc210f8bd3a5d7a1ced1095ddd71f819f517c0947f956deff646ddcd08a3f9"}
 *
 * Go source:
 * func (f *NodeFactory) NewESDecorateHelper(ctor *ast.Expression, descriptorIn *ast.Expression, decorators *ast.Expression, contextIn *ast.Expression, initializers *ast.Expression, extraInitializers *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(esDecorateHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__esDecorate"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewESDecorateHelper(receiver: GoPtr<NodeFactory>, ctor: GoPtr<Expression>, descriptorIn: GoPtr<Expression>, decorators: GoPtr<Expression>, contextIn: GoPtr<Expression>, initializers: GoPtr<Expression>, extraInitializers: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, esDecorateHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__esDecorate"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewRunInitializersHelper","kind":"method","status":"implemented","sigHash":"567cc8687e3e3bab4c30805b51dd7c5bde2e1d09807a7d2f9a0dc05e3a572b94","bodyHash":"1cf51f716342ee4e701f43bc7e73f8a2e98a15eadaeb4fe65a2cf912430c729c"}
 *
 * Go source:
 * func (f *NodeFactory) NewRunInitializersHelper(thisArg *ast.Expression, initializers *ast.Expression, value *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(runInitializersHelper)
 * 	var arguments []*ast.Expression
 * 	if value != nil {
 * 		arguments = []*ast.Expression{thisArg, initializers, value}
 * 	} else {
 * 		arguments = []*ast.Expression{thisArg, initializers}
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__runInitializers"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(arguments),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewRunInitializersHelper(receiver: GoPtr<NodeFactory>, thisArg: GoPtr<Expression>, initializers: GoPtr<Expression>, value: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, runInitializersHelper);
  const args: GoSlice<GoPtr<Expression>> = value !== undefined
    ? [thisArg, initializers, value]
    : [thisArg, initializers];
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__runInitializers"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, args),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewTemplateObjectHelper","kind":"method","status":"implemented","sigHash":"a42d9cb8d3bca58bea97ad02778210b0ba04414f97e50782e72b63cfdc0c7c33","bodyHash":"c725feccb906db65aeaa13bce4dfe9c0bcb8f6608f21a4075b54dc78ff8c4715"}
 *
 * Go source:
 * func (f *NodeFactory) NewTemplateObjectHelper(cookedArray *ast.Expression, rawArray *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(makeTemplateObjectHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__makeTemplateObject"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{cookedArray, rawArray}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewTemplateObjectHelper(receiver: GoPtr<NodeFactory>, cookedArray: GoPtr<Expression>, rawArray: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, makeTemplateObjectHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__makeTemplateObject"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [cookedArray, rawArray]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewPropKeyHelper","kind":"method","status":"implemented","sigHash":"2cd1c9c62c0f6f25c024e3ef7395e371378fc84491c6bad996f7f12f18e4c4bb","bodyHash":"4a293f8cec28280a6d19a0e7737f23c2a5897f586068815ec40a0f6c29edb1dc"}
 *
 * Go source:
 * func (f *NodeFactory) NewPropKeyHelper(expr *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(propKeyHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__propKey"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expr}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewPropKeyHelper(receiver: GoPtr<NodeFactory>, expr: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, propKeyHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__propKey"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expr]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewSetFunctionNameHelper","kind":"method","status":"implemented","sigHash":"84921489cb579917fb5c8c19e69d04a621f6ff185b956e7a34f25cea691c2ad7","bodyHash":"0c64d608ab60c543256ae1af586eee71293449804469716e5af1136cf2fa158a"}
 *
 * Go source:
 * func (f *NodeFactory) NewSetFunctionNameHelper(fn *ast.Expression, name *ast.Expression, prefix string) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(setFunctionNameHelper)
 * 	var arguments []*ast.Expression
 * 	if len(prefix) > 0 {
 * 		arguments = []*ast.Expression{fn, name, f.NewStringLiteral(prefix, ast.TokenFlagsNone)}
 * 	} else {
 * 		arguments = []*ast.Expression{fn, name}
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__setFunctionName"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(arguments),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewSetFunctionNameHelper(receiver: GoPtr<NodeFactory>, fn: GoPtr<Expression>, name: GoPtr<Expression>, prefix: string): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, setFunctionNameHelper);
  const args: GoSlice<GoPtr<Expression>> = prefix.length > 0
    ? [fn, name, NewStringLiteral(f, prefix, TokenFlagsNone)]
    : [fn, name];
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__setFunctionName"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, args),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewImportDefaultHelper","kind":"method","status":"implemented","sigHash":"c6c296d9fd3cce207cdb96300cb718d5ee5bcdc59db27904a9f879e02325fc48","bodyHash":"c90990871cfa14f7150bd025c1044a40402b9fd32895f7dcb8f5c637acc249c8"}
 *
 * Go source:
 * func (f *NodeFactory) NewImportDefaultHelper(expression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(importDefaultHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__importDefault"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewImportDefaultHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, importDefaultHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__importDefault"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewImportStarHelper","kind":"method","status":"implemented","sigHash":"57e9001a2db105331bd5488f02ce4e1a95f73a39d283a518cf00cdafa3237a93","bodyHash":"2e5109f07dbc7821e7bf41a72ee8521b4f8f7fb2c3f32974c2537b821af05c2d"}
 *
 * Go source:
 * func (f *NodeFactory) NewImportStarHelper(expression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(importStarHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__importStar"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{expression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewImportStarHelper(receiver: GoPtr<NodeFactory>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, importStarHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__importStar"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [expression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewExportStarHelper","kind":"method","status":"implemented","sigHash":"2047e20bfd90f2d08bf061fdeabb7757c3b4ac760a18f5ae8d8dded65c2a0618","bodyHash":"f52d1f755e19d2f2284d4d63c557bf9a032a59ee2ed8d90031d987e3e81fe7c9"}
 *
 * Go source:
 * func (f *NodeFactory) NewExportStarHelper(moduleExpression *ast.Expression, exportsExpression *ast.Expression) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(exportStarHelper)
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__exportStar"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList([]*ast.Expression{moduleExpression, exportsExpression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewExportStarHelper(receiver: GoPtr<NodeFactory>, moduleExpression: GoPtr<Expression>, exportsExpression: GoPtr<Expression>): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, exportStarHelper);
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__exportStar"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [moduleExpression, exportsExpression]),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewAssignmentTargetWrapper","kind":"method","status":"implemented","sigHash":"05292a8713012246c159c10364eb72c643dbf05e2c5516adeb73b74bdc24442c","bodyHash":"4df8beba57244ba8ac8276acc0be3acaa85166a8084bf845e3f02da3eae7f25b"}
 *
 * Go source:
 * func (f *NodeFactory) NewAssignmentTargetWrapper(paramName *ast.IdentifierNode, expression *ast.Expression) *ast.Node {
 * 	setAccessor := f.NewSetAccessorDeclaration(
 * 		nil, /*modifiers* /
 * 		f.NewIdentifier("value"),
 * 		nil, /*typeParameters* /
 * 		f.NewNodeList([]*ast.Node{
 * 			f.NewParameterDeclaration(nil, nil, paramName, nil, nil, nil),
 * 		}),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		f.NewBlock(f.NewNodeList([]*ast.Node{
 * 			f.NewExpressionStatement(expression),
 * 		}), false),
 * 	)
 * 	objLiteral := f.NewObjectLiteralExpression(f.NewNodeList([]*ast.Node{setAccessor}), false)
 * 	// Explicit parens required because of v8 regression (https://bugs.chromium.org/p/v8/issues/detail?id=9560)
 * 	return f.NewPropertyAccessExpression(
 * 		f.NewParenthesizedExpression(objLiteral),
 * 		nil, /*questionDotToken* /
 * 		f.NewIdentifier("value"),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewAssignmentTargetWrapper(receiver: GoPtr<NodeFactory>, paramName: GoPtr<IdentifierNode>, expression: GoPtr<Expression>): GoPtr<Node> {
  const f = receiver!.__tsgoEmbedded0!;
  const setAccessor = NewSetAccessorDeclaration(
    f,
    undefined,
    NewIdentifier(f, "value"),
    undefined,
    NodeFactory_NewNodeList(f, [
      NewParameterDeclaration(f, undefined, undefined, paramName, undefined, undefined, undefined),
    ]),
    undefined,
    undefined,
    NewBlock(f, NodeFactory_NewNodeList(f, [NewExpressionStatement(f, expression)]), false),
  );
  const objLiteral = NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, [setAccessor]), false);
  return NewPropertyAccessExpression(
    f,
    NewParenthesizedExpression(f, objLiteral),
    undefined,
    NewIdentifier(f, "value"),
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/factory.go::method::NodeFactory.NewRewriteRelativeImportExtensionsHelper","kind":"method","status":"implemented","sigHash":"362075c24bca367e7b2db84c9262709635adae5017c875e9fdf3e51798e4cccb","bodyHash":"0f50bc349f8859315c6c1f8cc7e335cbb03912fa23521da69d884df169899bfb"}
 *
 * Go source:
 * func (f *NodeFactory) NewRewriteRelativeImportExtensionsHelper(firstArgument *ast.Node, preserveJsx bool) *ast.Expression {
 * 	f.emitContext.RequestEmitHelper(rewriteRelativeImportExtensionsHelper)
 * 	var arguments []*ast.Expression
 * 	if preserveJsx {
 * 		arguments = []*ast.Expression{firstArgument, f.NewToken(ast.KindTrueKeyword)}
 * 	} else {
 * 		arguments = []*ast.Expression{firstArgument}
 * 	}
 * 	return f.NewCallExpression(
 * 		f.NewUnscopedHelperName("__rewriteRelativeImportExtension"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		f.NewNodeList(arguments),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function NodeFactory_NewRewriteRelativeImportExtensionsHelper(receiver: GoPtr<NodeFactory>, firstArgument: GoPtr<Node>, preserveJsx: bool): GoPtr<Expression> {
  const f = receiver!.__tsgoEmbedded0!;
  EmitContext_RequestEmitHelper(receiver!.emitContext, rewriteRelativeImportExtensionsHelper);
  const args: GoSlice<GoPtr<Expression>> = preserveJsx
    ? [firstArgument, NewToken(f, KindTrueKeyword)]
    : [firstArgument];
  return NewCallExpression(
    f,
    NodeFactory_NewUnscopedHelperName(receiver, "__rewriteRelativeImportExtension"),
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, args),
    NodeFlagsNone,
  );
}

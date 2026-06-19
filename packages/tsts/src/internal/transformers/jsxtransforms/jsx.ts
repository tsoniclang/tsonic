import type { bool, int, long } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoRune, GoSlice } from "../../../go/compat.js";
import type { GoError } from "../../../go/compat.js";
import { Builder, IndexByte } from "../../../go/strings.js";
import { FormatInt, ParseInt } from "../../../go/strconv.js";
import { DecodeRuneInStringAt, StringByteAt, StringByteLen, StringByteSlice } from "../../../go/unicode/utf8.js";
import type { Node, NodeList } from "../../ast/spine.js";
import { Node_AsNode, Node_End, Node_Name, Node_Pos, Node_SubtreeFacts } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import { Node_Attributes, Node_Expression, Node_Initializer, Node_Properties, Node_PropertyName, Node_Statements, Node_TagName, Node_Text, SourceFile_FileName, SourceFile_Text } from "../../ast/ast.js";
import type { JsxAttribute, JsxElement, JsxExpression, JsxFragment, JsxOpeningFragment, JsxSelfClosingElement, JsxSpreadAttribute, JsxText, ObjectLiteralExpression } from "../../ast/generated/data.js";
import type { Expression, JsxChild, ObjectLiteralElement } from "../../ast/generated/unions.js";
import { AsIdentifier, AsImportSpecifier, AsJsxAttribute, AsJsxElement, AsJsxExpression, AsJsxFragment, AsJsxNamespacedName, AsJsxOpeningFragment, AsJsxSelfClosingElement, AsJsxSpreadAttribute, AsJsxText, AsObjectLiteralExpression, AsQualifiedName, AsStringLiteral, AsVariableDeclaration } from "../../ast/generated/casts.js";
import { NewArrayLiteralExpression, NewBindingElement, NewBindingPattern, NewCallExpression, NewIdentifier, NewImportClause, NewImportDeclaration, NewImportSpecifier, NewKeywordExpression, NewNamedImports, NewNumericLiteral, NewObjectLiteralExpression, NewPropertyAccessExpression, NewPropertyAssignment, NewSpreadAssignment, NewSpreadElement, NewStringLiteral, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement } from "../../ast/generated/factory.js";
import { KindJsxAttribute, KindJsxElement, KindJsxExpression, KindJsxFragment, KindJsxOpeningElement, KindJsxOpeningFragment, KindJsxSelfClosingElement, KindJsxSpreadAttribute, KindJsxText, KindNullKeyword, KindObjectBindingPattern, KindSourceFile, KindString, KindStringLiteral, KindUnknown } from "../../ast/generated/kinds.js";
import { IsIdentifier, IsJsxAttribute, IsJsxElement, IsJsxExpression, IsJsxFragment, IsJsxNamespacedName, IsJsxSelfClosingElement, IsJsxSpreadAttribute, IsModuleDeclaration, IsObjectLiteralExpression, IsPropertyAssignment, IsQualifiedName, IsSourceFile, IsSpreadAssignment, IsStringLiteral } from "../../ast/generated/predicates.js";
import { NodeFlagsConst, NodeFlagsNone, NodeFlagsSynthesized } from "../../ast/nodeflags.js";
import { SubtreeContainsJsx } from "../../ast/subtreefacts.js";
import type { SourceFileLike } from "../../ast/ast.js";
import { AsSourceFile, NodeFactory_UpdateSourceFile } from "../../ast/ast.js";
import { GetJSXImplicitImportBase, GetJSXRuntimeImport, GetSemanticJsxChildren, IsExternalModule, IsExternalOrCommonJSModule, IsPrologueDirective, SetParentInChildren } from "../../ast/utilities.js";
import { IsJsxOpeningLikeElement } from "../../ast/utilities.js";
import { OrderedMap_Clear, OrderedMap_Entries, OrderedMap_Get, OrderedMap_Set, OrderedMap_Size } from "../../collections/ordered_map.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { CompilerOptions_GetEmitScriptTarget, JsxEmitReactJSXDev, ScriptTargetES2018 } from "../../core/compileroptions.js";
import { LanguageVariantStandard } from "../../core/languagevariant.js";
import { NewTextRange } from "../../core/text.js";
import type { TextRange } from "../../core/text.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { EncodeJSStringRune, IsDigit, IsHexDigit, IsLineBreak, IsWhiteSpaceSingleLine } from "../../stringutil/util.js";
import { CompareStringsCaseSensitive } from "../../stringutil/compare.js";
import { EFCustomPrologue, EFStartOnNewLine } from "../../printer/emitflags.js";
import { EmitContext_AddEmitFlags, EmitContext_EmitFlags, EmitContext_MostOriginal, EmitContext_ParseNode, EmitContext_ReadEmitHelpers, EmitContext_SetEmitFlags, EmitContext_AddEmitHelper } from "../../printer/emitcontext.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { GeneratedIdentifierFlagsAllowNameSubstitution, GeneratedIdentifierFlagsFileLevel, GeneratedIdentifierFlagsOptimistic } from "../../printer/generatedidentifierflags.js";
import type { NodeFactory } from "../../printer/factory.js";
import { NodeFactory_CreateExpressionFromEntityName, NodeFactory_NewAssignHelper, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewThisExpression, NodeFactory_NewTrueExpression, NodeFactory_NewFalseExpression, NodeFactory_NewVoidZeroExpression, NodeFactory_NewUniqueNameEx } from "../../printer/factory.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import { IsIntrinsicJsxName } from "../../scanner/utilities.js";
import { IsIdentifierText } from "../../scanner/utilities.js";
import { GetECMALineAndUTF16CharacterOfPosition, SkipTrivia } from "../../scanner/scanner.js";
import { NodeFactory_NewNodeList } from "../../ast/spine.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length,
// `s[i]` is a byte, and slices like `s[i:j]` operate on byte offsets. The
// standard-library facades (strings/strconv/utf8) follow that contract, so we
// mirror it here by operating over the UTF-8 byte view and converting back to a
// JS string at the boundaries.
const byteLen = StringByteLen;
const byteAt = StringByteAt;
const byteSlice = StringByteSlice;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::type::JSXTransformer","kind":"type","status":"implemented","sigHash":"f4d543aef50805c0daf1acbda906f9cd8582889e57dcbb274d9f2ec3142daf12","bodyHash":"24ca0c04864e6acfd1ba4c73accb3e3aa06410a4ba673b1275c2b2a13b39311c"}
 *
 * Go source:
 * JSXTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions *core.CompilerOptions
 * 	emitResolver    printer.EmitResolver
 * 
 * 	importSpecifier                string
 * 	filenameDeclaration            *ast.Node
 * 	utilizedImplicitRuntimeImports collections.OrderedMap[string, map[string]*ast.Node]
 * 	inJsxChild                     bool
 * 
 * 	currentSourceFile *ast.SourceFile
 * }
 */
export interface JSXTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  emitResolver: EmitResolver;
  importSpecifier: string;
  filenameDeclaration: GoPtr<Node>;
  utilizedImplicitRuntimeImports: OrderedMap<string, GoMap<string, GoPtr<Node>>>;
  inJsxChild: bool;
  currentSourceFile: GoPtr<SourceFile>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::NewJSXTransformer","kind":"func","status":"implemented","sigHash":"29835ab7065cb1ebe8fb083beca71c929e309981dbe55498b53a24467274d575","bodyHash":"fb1cf81a0ed533b3afc438d422dca6c6c9e60164c88fb9bb40f38f623d97c725"}
 *
 * Go source:
 * func NewJSXTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opts.CompilerOptions
 * 	emitContext := opts.Context
 * 	tx := &JSXTransformer{
 * 		compilerOptions: compilerOptions,
 * 		emitResolver:    opts.EmitResolver,
 * 	}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export function NewJSXTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const compilerOptions = opts!.CompilerOptions;
  const emitContext = opts!.Context;
  const tx: JSXTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    compilerOptions: compilerOptions,
    emitResolver: opts!.EmitResolver,
    importSpecifier: "",
    filenameDeclaration: undefined,
    utilizedImplicitRuntimeImports: { __tsgoBlank0: {}, keys: [], mp: new globalThis.Map() },
    inJsxChild: false,
    currentSourceFile: undefined,
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => JSXTransformer_visit(tx, node), emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getCurrentFileNameExpression","kind":"method","status":"implemented","sigHash":"f67f49fed61267f6058d23cb6f62a0ba7a6af24279aa0de90ccbe3d710bd853f","bodyHash":"346beda3bd2ffc4a4f553a765b103a1c0366a83298bf81c7d652d812ed672457"}
 *
 * Go source:
 * func (tx *JSXTransformer) getCurrentFileNameExpression() *ast.Node {
 * 	if tx.filenameDeclaration != nil {
 * 		return tx.filenameDeclaration.AsVariableDeclaration().Name()
 * 	}
 * 	d := tx.Factory().NewVariableDeclaration(
 * 		tx.Factory().NewUniqueNameEx("_jsxFileName", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		}),
 * 		nil,
 * 		nil,
 * 		tx.Factory().NewStringLiteral(tx.currentSourceFile.FileName(), ast.TokenFlagsNone),
 * 	)
 * 	tx.filenameDeclaration = d
 * 	return d.AsVariableDeclaration().Name()
 * }
 */
export function JSXTransformer_getCurrentFileNameExpression(receiver: GoPtr<JSXTransformer>): GoPtr<Node> {
  if (receiver!.filenameDeclaration !== undefined) {
    return AsVariableDeclaration(receiver!.filenameDeclaration)!.name;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const d = NewVariableDeclaration(
    astFactory,
    NodeFactory_NewUniqueNameEx(factory, "_jsxFileName", {
      Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel,
      Prefix: "",
      Suffix: "",
    }),
    undefined,
    undefined,
    NewStringLiteral(astFactory, SourceFile_FileName(receiver!.currentSourceFile), TokenFlagsNone),
  );
  receiver!.filenameDeclaration = d;
  return AsVariableDeclaration(d)!.name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getJsxFactoryCalleePrimitive","kind":"method","status":"implemented","sigHash":"66f6956c88a560d3d6356d9b430ce453ce8777a7b1e22041625f6434716efb90","bodyHash":"85664336374ba7f4439c2d21f567be62673ca2c0e093a6bd2697f6ba14ee0825"}
 *
 * Go source:
 * func (tx *JSXTransformer) getJsxFactoryCalleePrimitive(isStaticChildren bool) string {
 * 	if tx.compilerOptions.Jsx == core.JsxEmitReactJSXDev {
 * 		return "jsxDEV"
 * 	}
 * 	if isStaticChildren {
 * 		return "jsxs"
 * 	}
 * 	return "jsx"
 * }
 */
export function JSXTransformer_getJsxFactoryCalleePrimitive(receiver: GoPtr<JSXTransformer>, isStaticChildren: bool): string {
  if (receiver!.compilerOptions!.Jsx === JsxEmitReactJSXDev) {
    return "jsxDEV";
  }
  if (isStaticChildren) {
    return "jsxs";
  }
  return "jsx";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getJsxFactoryCallee","kind":"method","status":"implemented","sigHash":"d2ef3b46db25829b7a7083fb6ef490a8e8213431b2d714b383a43b2f2da3dad7","bodyHash":"ffa40e046d3ddf1b12e4f291a6e0e9f7911b237f8de6191ce7219abb45a9c4b3"}
 *
 * Go source:
 * func (tx *JSXTransformer) getJsxFactoryCallee(isStaticChildren bool) *ast.Node {
 * 	t := tx.getJsxFactoryCalleePrimitive(isStaticChildren)
 * 	return tx.getImplicitImportForName(t)
 * }
 */
export function JSXTransformer_getJsxFactoryCallee(receiver: GoPtr<JSXTransformer>, isStaticChildren: bool): GoPtr<Node> {
  const t = JSXTransformer_getJsxFactoryCalleePrimitive(receiver, isStaticChildren);
  return JSXTransformer_getImplicitImportForName(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getImplicitJsxFragmentReference","kind":"method","status":"implemented","sigHash":"32cdb023740a4398d1f0cef995d6f2faf36082cbc27bb7fed228da6849902c10","bodyHash":"79bf6a15a9fc6ddd9f06ffb15324d92ef3d32aeece534a3bf622d69921a94b50"}
 *
 * Go source:
 * func (tx *JSXTransformer) getImplicitJsxFragmentReference() *ast.Node {
 * 	return tx.getImplicitImportForName("Fragment")
 * }
 */
export function JSXTransformer_getImplicitJsxFragmentReference(receiver: GoPtr<JSXTransformer>): GoPtr<Node> {
  return JSXTransformer_getImplicitImportForName(receiver, "Fragment");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getImplicitImportForName","kind":"method","status":"implemented","sigHash":"bf50e5f1a91428d2c425223ed98145487b875045253e761c4d1a2ca68bc895eb","bodyHash":"c595260d9c743edec5d120f59e4174bfe95fee142ee435edd4afa84aa17c5289"}
 *
 * Go source:
 * func (tx *JSXTransformer) getImplicitImportForName(name string) *ast.Node {
 * 	importSource := tx.importSpecifier
 * 	if name != "createElement" {
 * 		importSource = ast.GetJSXRuntimeImport(importSource, tx.compilerOptions)
 * 	}
 * 	existing, ok := tx.utilizedImplicitRuntimeImports.Get(importSource)
 * 	if ok {
 * 		elem, ok := existing[name]
 * 		if ok {
 * 			return elem.AsImportSpecifier().Name()
 * 		}
 * 	} else {
 * 		existing = make(map[string]*ast.Node)
 * 		tx.utilizedImplicitRuntimeImports.Set(importSource, existing)
 * 	}
 * 
 * 	generatedName := tx.Factory().NewUniqueNameEx("_"+name, printer.AutoGenerateOptions{
 * 		Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel | printer.GeneratedIdentifierFlagsAllowNameSubstitution,
 * 	})
 * 	specifier := tx.Factory().NewImportSpecifier(false, tx.Factory().NewIdentifier(name), generatedName)
 * 	tx.emitResolver.SetReferencedImportDeclaration(generatedName, specifier)
 * 	existing[name] = specifier
 * 	return specifier.Name()
 * }
 */
export function JSXTransformer_getImplicitImportForName(receiver: GoPtr<JSXTransformer>, name: string): GoPtr<Node> {
  let importSource = receiver!.importSpecifier;
  if (name !== "createElement") {
    importSource = GetJSXRuntimeImport(importSource, receiver!.compilerOptions);
  }
  const [existing, ok] = OrderedMap_Get<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>, importSource);
  if (ok) {
    const elem = existing!.get(name);
    if (elem !== undefined) {
      return AsImportSpecifier(elem)!.name;
    }
  } else {
    OrderedMap_Set<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>, importSource, new globalThis.Map<string, GoPtr<Node>>());
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const generatedName = NodeFactory_NewUniqueNameEx(factory, "_" + name, {
    Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsAllowNameSubstitution,
    Prefix: "",
    Suffix: "",
  });
  const specifier = NewImportSpecifier(astFactory, false, NewIdentifier(astFactory, name), generatedName);
  receiver!.emitResolver.SetReferencedImportDeclaration(generatedName, specifier);
  const [existingMap] = OrderedMap_Get<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>, importSource);
  existingMap!.set(name, specifier);
  return AsImportSpecifier(specifier)!.name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.setInChild","kind":"method","status":"implemented","sigHash":"8036f65d1d9fa194dab5f84c27b6fa065622b82de6e6d732017fdbca7d49f28a","bodyHash":"82ed2ac87c1d950f9bec65412049107d7936964f565861895e4ac992b579dbcb"}
 *
 * Go source:
 * func (tx *JSXTransformer) setInChild(v bool) {
 * 	tx.inJsxChild = v
 * }
 */
export function JSXTransformer_setInChild(receiver: GoPtr<JSXTransformer>, v: bool): void {
  receiver!.inJsxChild = v;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visit","kind":"method","status":"implemented","sigHash":"d506fd405ffb5b15f0c87fe4693328c29a4a0665ee9ae8d67bd3eccf913d8dc9","bodyHash":"5eb77053b6db23d39256c06e25dc4f5a3482aeff3993d96eded095e7f42ba85f"}
 *
 * Go source:
 * func (tx *JSXTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	if node.SubtreeFacts()&ast.SubtreeContainsJsx == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		tx.setInChild(false)
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindJsxElement:
 * 		return tx.visitJsxElement(node.AsJsxElement())
 * 	case ast.KindJsxSelfClosingElement:
 * 		return tx.visitJsxSelfClosingElement(node.AsJsxSelfClosingElement())
 * 	case ast.KindJsxFragment:
 * 		return tx.visitJsxFragment(node.AsJsxFragment())
 * 	case ast.KindJsxOpeningElement:
 * 		panic("JsxOpeningElement should not be visited, handled in visitJsxElement")
 * 	case ast.KindJsxOpeningFragment:
 * 		panic("JsxOpeningFragment should not be visited, handled in visitJsxFragment")
 * 	case ast.KindJsxText:
 * 		tx.setInChild(false)
 * 		return tx.visitJsxText(node.AsJsxText())
 * 	case ast.KindJsxExpression:
 * 		tx.setInChild(false)
 * 		return tx.visitJsxExpression(node.AsJsxExpression())
 * 	}
 * 	tx.setInChild(false)
 * 	return tx.Visitor().VisitEachChild(node) // by default, do nothing
 * }
 */
export function JSXTransformer_visit(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node === undefined) {
    return undefined;
  }
  if ((Node_SubtreeFacts(node) & SubtreeContainsJsx) === 0) {
    return node;
  }
  switch (node!.Kind) {
    case KindSourceFile:
      JSXTransformer_setInChild(receiver, false);
      return JSXTransformer_visitSourceFile(receiver, AsSourceFile(node));
    case KindJsxElement:
      return JSXTransformer_visitJsxElement(receiver, AsJsxElement(node));
    case KindJsxSelfClosingElement:
      return JSXTransformer_visitJsxSelfClosingElement(receiver, AsJsxSelfClosingElement(node));
    case KindJsxFragment:
      return JSXTransformer_visitJsxFragment(receiver, AsJsxFragment(node));
    case KindJsxOpeningElement:
      throw new globalThis.Error("JsxOpeningElement should not be visited, handled in visitJsxElement");
    case KindJsxOpeningFragment:
      throw new globalThis.Error("JsxOpeningFragment should not be visited, handled in visitJsxFragment");
    case KindJsxText:
      JSXTransformer_setInChild(receiver, false);
      return JSXTransformer_visitJsxText(receiver, AsJsxText(node));
    case KindJsxExpression:
      JSXTransformer_setInChild(receiver, false);
      return JSXTransformer_visitJsxExpression(receiver, AsJsxExpression(node));
  }
  JSXTransformer_setInChild(receiver, false);
  return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver!.__tsgoEmbedded0), node); // by default, do nothing
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::hasKeyAfterPropsSpread","kind":"func","status":"implemented","sigHash":"410dfa82121e57aa7b00154093b4c575db0069df96b273cff1976c9d3f473443","bodyHash":"fc27af3a69cdac8503d810a1950d3929869e54b206d19e0f3f56ae5945e6fcc1"}
 *
 * Go source:
 * func hasKeyAfterPropsSpread(node *ast.Node) bool {
 * 	spread := false
 * 	opener := node
 * 	if node.Kind == ast.KindJsxElement {
 * 		opener = node.AsJsxElement().OpeningElement
 * 	} // otherwise self-closing
 * 	for _, elem := range opener.Attributes().Properties() {
 * 		if ast.IsJsxSpreadAttribute(elem) && (!ast.IsObjectLiteralExpression(elem.Expression()) || core.Some(elem.Expression().Properties(), ast.IsSpreadAssignment)) {
 * 			spread = true
 * 		} else if spread && ast.IsJsxAttribute(elem) && ast.IsIdentifier(elem.Name()) && elem.Name().Text() == "key" {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasKeyAfterPropsSpread(node: GoPtr<Node>): bool {
  let spread = false;
  let opener = node;
  if (node!.Kind === KindJsxElement) {
    opener = AsJsxElement(node)!.OpeningElement;
  } // otherwise self-closing
  const attrs = Node_Properties(Node_Attributes(opener)) ?? [];
  for (const elem of attrs) {
    if (IsJsxSpreadAttribute(elem) && (!IsObjectLiteralExpression(Node_Expression(elem)) || (Node_Properties(Node_Expression(elem)) ?? []).some((p) => IsSpreadAssignment(p)))) {
      spread = true;
    } else if (spread && IsJsxAttribute(elem) && IsIdentifier(Node_Name(elem)) && Node_Text(Node_Name(elem)) === "key") {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.shouldUseCreateElement","kind":"method","status":"implemented","sigHash":"85963fef37ebdbcb7cfef0d68279d27d72c74fe95928a8760b3327cfcfaabac1","bodyHash":"e45525fc060c4b0ef0be4fd8aec5c20f2f7f0a3e393edb56c3b08c07b4867b45"}
 *
 * Go source:
 * func (tx *JSXTransformer) shouldUseCreateElement(node *ast.Node) bool {
 * 	return len(tx.importSpecifier) == 0 || hasKeyAfterPropsSpread(node)
 * }
 */
export function JSXTransformer_shouldUseCreateElement(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): bool {
  return byteLen(receiver!.importSpecifier) === 0 || hasKeyAfterPropsSpread(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::insertStatementAfterPrologue","kind":"func","status":"implemented","sigHash":"f832143b0e7f3a7f35e765c94ce2612ab78265ee196bc795a362822f5bc88bf1","bodyHash":"2d74604c56f163f5feaf55de653a94b72ea34f26a6748da67b7c1e28a4294e6e"}
 *
 * Go source:
 * func insertStatementAfterPrologue[T any](to []*ast.Node, statement *ast.Node, isPrologueDirective func(callee T, node *ast.Node) bool, callee T) []*ast.Node {
 * 	if statement == nil {
 * 		return to
 * 	}
 * 	statementIdx := 0
 * 	// skip all prologue directives to insert at the correct position
 * 	for ; statementIdx < len(to); statementIdx++ {
 * 		if !isPrologueDirective(callee, to[statementIdx]) {
 * 			break
 * 		}
 * 	}
 * 	return slices.Insert(to, statementIdx, statement)
 * }
 */
export function insertStatementAfterPrologue<T>(to: GoSlice<GoPtr<Node>>, statement: GoPtr<Node>, isPrologueDirective: (callee: T, node: GoPtr<Node>) => bool, callee: T): GoSlice<GoPtr<Node>> {
  if (statement === undefined) {
    return to;
  }
  let statementIdx = 0;
  // skip all prologue directives to insert at the correct position
  for (; statementIdx < to.length; statementIdx++) {
    if (!isPrologueDirective(callee, to[statementIdx])) {
      break;
    }
  }
  return [...to.slice(0, statementIdx), statement, ...to.slice(statementIdx)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.isAnyPrologueDirective","kind":"method","status":"implemented","sigHash":"0bbb36cd4cfc35cc05d92623a458f1b9bb6c9dc9fb0f6665966884e6f3488ca7","bodyHash":"adba537c945702e36a64fe190b401f31ecf6d7965326d3fd4f63aa0b2f0636f0"}
 *
 * Go source:
 * func (tx *JSXTransformer) isAnyPrologueDirective(node *ast.Node) bool {
 * 	return ast.IsPrologueDirective(node) || (tx.EmitContext().EmitFlags(node)&printer.EFCustomPrologue != 0)
 * }
 */
export function JSXTransformer_isAnyPrologueDirective(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): bool {
  return IsPrologueDirective(node) || (EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node) & EFCustomPrologue) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.insertStatementAfterCustomPrologue","kind":"method","status":"implemented","sigHash":"25161bbccce5a2455bf329eaccafa851964941e9369eb14802004bde26ac1c07","bodyHash":"d4f0f8f172e24794906f74faaf9333f58646370d378a9c1304cbcab0d55d5204"}
 *
 * Go source:
 * func (tx *JSXTransformer) insertStatementAfterCustomPrologue(to []*ast.Node, statement *ast.Node) []*ast.Node {
 * 	return insertStatementAfterPrologue(to, statement, (*JSXTransformer).isAnyPrologueDirective, tx)
 * }
 */
export function JSXTransformer_insertStatementAfterCustomPrologue(receiver: GoPtr<JSXTransformer>, to: GoSlice<GoPtr<Node>>, statement: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  return insertStatementAfterPrologue(to, statement, JSXTransformer_isAnyPrologueDirective, receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::sortImportSpecifiers","kind":"func","status":"implemented","sigHash":"13eedef921187722636169983beb3233354db81cc50dedd588a28c37565ed5fd","bodyHash":"adab7f7f9aed4dd065e7ecf0450f0d49732c7ee1a804953ee80784a5a5a65796"}
 *
 * Go source:
 * func sortImportSpecifiers(a *ast.Node, b *ast.Node) int {
 * 	res := stringutil.CompareStringsCaseSensitive(a.PropertyName().Text(), b.PropertyName().Text())
 * 	if res != 0 {
 * 		return res
 * 	}
 * 	return stringutil.CompareStringsCaseSensitive(a.AsImportSpecifier().Name().Text(), b.AsImportSpecifier().Name().Text())
 * }
 */
export function sortImportSpecifiers(a: GoPtr<Node>, b: GoPtr<Node>): int {
  const res = CompareStringsCaseSensitive(Node_Text(Node_PropertyName(a)), Node_Text(Node_PropertyName(b)));
  if (res !== 0) {
    return res;
  }
  return CompareStringsCaseSensitive(Node_Text(AsImportSpecifier(a)!.name), Node_Text(AsImportSpecifier(b)!.name));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::getSortedSpecifiers","kind":"func","status":"implemented","sigHash":"45b6fde0106693ef0478f9fb2a78ec492c9812d6fd06fd650a62a326bfcb1874","bodyHash":"6337134fd4fa77b10c72dcdfcc592339d7b79ab82c897c466a6aeb3d936659c5"}
 *
 * Go source:
 * func getSortedSpecifiers(m map[string]*ast.Node) []*ast.Node {
 * 	res := slices.Collect(maps.Values(m))
 * 	slices.SortFunc(res, sortImportSpecifiers)
 * 	return res
 * }
 */
export function getSortedSpecifiers(m: GoMap<string, GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  const res: GoSlice<GoPtr<Node>> = [...m.values()];
  res.sort(sortImportSpecifiers);
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"cce2e0463e5a5aa3ed9661f146af4a491bd5546ac199d1fc0a02643fab6e9a23","bodyHash":"94c819c7a71033a35b4b9ad11a7869f92fe95a52d5ea56ad85d824b560b51827"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitSourceFile(file *ast.SourceFile) *ast.Node {
 * 	if file.IsDeclarationFile {
 * 		return file.AsNode()
 * 	}
 * 
 * 	tx.currentSourceFile = file
 * 	tx.importSpecifier = ast.GetJSXImplicitImportBase(tx.compilerOptions, file)
 * 	tx.filenameDeclaration = nil
 * 	tx.utilizedImplicitRuntimeImports.Clear()
 * 
 * 	visited := tx.Visitor().VisitEachChild(file.AsNode())
 * 	tx.EmitContext().AddEmitHelper(visited.AsNode(), tx.EmitContext().ReadEmitHelpers()...)
 * 	statements := visited.Statements()
 * 	statementsUpdated := false
 * 	if tx.filenameDeclaration != nil {
 * 		statements = tx.insertStatementAfterCustomPrologue(statements, tx.Factory().NewVariableStatement(nil, tx.Factory().NewVariableDeclarationList(
 * 			tx.Factory().NewNodeList([]*ast.Node{tx.filenameDeclaration}),
 * 			ast.NodeFlagsConst,
 * 		)))
 * 		statementsUpdated = true
 * 	}
 * 
 * 	if tx.utilizedImplicitRuntimeImports.Size() > 0 {
 * 		if ast.IsExternalModule(file) {
 * 			statementsUpdated = true
 * 			newStatements := make([]*ast.Node, 0, tx.utilizedImplicitRuntimeImports.Size())
 * 			for importSource, importSpecifiersMap := range tx.utilizedImplicitRuntimeImports.Entries() {
 * 				s := tx.Factory().NewImportDeclaration(
 * 					nil,
 * 					tx.Factory().NewImportClause(ast.KindUnknown, nil, tx.Factory().NewNamedImports(tx.Factory().NewNodeList(getSortedSpecifiers(importSpecifiersMap)))),
 * 					tx.Factory().NewStringLiteral(importSource, ast.TokenFlagsNone),
 * 					nil,
 * 				)
 * 				ast.SetParentInChildren(s)
 * 				newStatements = append(newStatements, s)
 * 
 * 			}
 * 			for _, e := range newStatements {
 * 				statements = tx.insertStatementAfterCustomPrologue(statements, e)
 * 			}
 * 		} else if ast.IsExternalOrCommonJSModule(file) {
 * 			statementsUpdated = true
 * 			newStatements := make([]*ast.Node, 0, tx.utilizedImplicitRuntimeImports.Size())
 * 			for importSource, importSpecifiersMap := range tx.utilizedImplicitRuntimeImports.Entries() {
 * 				sorted := getSortedSpecifiers(importSpecifiersMap)
 * 				asBindingElems := make([]*ast.Node, 0, len(sorted))
 * 				for _, elem := range sorted {
 * 					asBindingElems = append(asBindingElems, tx.Factory().NewBindingElement(nil, elem.PropertyName(), elem.AsImportSpecifier().Name(), nil))
 * 				}
 * 				s := tx.Factory().NewVariableStatement(nil, tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{tx.Factory().NewVariableDeclaration(
 * 					tx.Factory().NewBindingPattern(ast.KindObjectBindingPattern, tx.Factory().NewNodeList(asBindingElems)),
 * 					nil,
 * 					nil,
 * 					tx.Factory().NewCallExpression(
 * 						tx.Factory().NewIdentifier("require"),
 * 						nil,
 * 						nil,
 * 						tx.Factory().NewNodeList([]*ast.Node{tx.Factory().NewStringLiteral(importSource, ast.TokenFlagsNone)}), ast.NodeFlagsNone),
 * 				)}), ast.NodeFlagsConst))
 * 				ast.SetParentInChildren(s)
 * 				newStatements = append(newStatements, s)
 * 			}
 * 			for _, e := range newStatements {
 * 				statements = tx.insertStatementAfterCustomPrologue(statements, e)
 * 			}
 * 		} else {
 * 			// Do nothing (script file) - consider an error in the checker?
 * 		}
 * 	}
 * 
 * 	if statementsUpdated {
 * 		visited = tx.Factory().UpdateSourceFile(file, tx.Factory().NewNodeList(statements), file.EndOfFileToken)
 * 	}
 * 
 * 	tx.currentSourceFile = nil
 * 	tx.importSpecifier = ""
 * 	tx.filenameDeclaration = nil
 * 	tx.utilizedImplicitRuntimeImports.Clear()
 * 
 * 	return visited
 * }
 */
export function JSXTransformer_visitSourceFile(receiver: GoPtr<JSXTransformer>, file: GoPtr<SourceFile>): GoPtr<Node> {
  if (file!.IsDeclarationFile) {
    return file as unknown as GoPtr<Node>;
  }

  receiver!.currentSourceFile = file;
  receiver!.importSpecifier = GetJSXImplicitImportBase(receiver!.compilerOptions, file);
  receiver!.filenameDeclaration = undefined;
  OrderedMap_Clear<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>);

  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  let visited = NodeVisitor_VisitEachChild(Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as ConcreteNodeVisitor, file as unknown as GoPtr<Node>);
  EmitContext_AddEmitHelper(emitContext, visited!, ...EmitContext_ReadEmitHelpers(emitContext));
  let statements: GoSlice<GoPtr<Node>> = Node_Statements(visited) ?? [];
  let statementsUpdated = false;
  if (receiver!.filenameDeclaration !== undefined) {
    statements = JSXTransformer_insertStatementAfterCustomPrologue(
      receiver,
      statements,
      NewVariableStatement(
        astFactory,
        undefined,
        NewVariableDeclarationList(
          astFactory,
          NodeFactory_NewNodeList(astFactory, [receiver!.filenameDeclaration]),
          NodeFlagsConst,
        ),
      ),
    );
    statementsUpdated = true;
  }

  if (OrderedMap_Size<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>) > 0) {
    if (IsExternalModule(file)) {
      statementsUpdated = true;
      const newStatements: GoSlice<GoPtr<Node>> = [];
      OrderedMap_Entries<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>)((importSource, importSpecifiersMap) => {
        const s = NewImportDeclaration(
          astFactory,
          undefined,
          NewImportClause(astFactory, KindUnknown, undefined, NewNamedImports(astFactory, NodeFactory_NewNodeList(astFactory, getSortedSpecifiers(importSpecifiersMap)))),
          NewStringLiteral(astFactory, importSource, TokenFlagsNone),
          undefined,
        );
        SetParentInChildren(s);
        newStatements.push(s);
        return true;
      });
      for (const e of newStatements) {
        statements = JSXTransformer_insertStatementAfterCustomPrologue(receiver, statements, e);
      }
    } else if (IsExternalOrCommonJSModule(file)) {
      statementsUpdated = true;
      const newStatements: GoSlice<GoPtr<Node>> = [];
      OrderedMap_Entries<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>)((importSource, importSpecifiersMap) => {
        const sorted = getSortedSpecifiers(importSpecifiersMap);
        const asBindingElems: GoSlice<GoPtr<Node>> = [];
        for (const elem of sorted) {
          asBindingElems.push(NewBindingElement(astFactory, undefined, Node_PropertyName(elem), AsImportSpecifier(elem)!.name, undefined));
        }
        const s = NewVariableStatement(
          astFactory,
          undefined,
          NewVariableDeclarationList(
            astFactory,
            NodeFactory_NewNodeList(astFactory, [
              NewVariableDeclaration(
                astFactory,
                NewBindingPattern(astFactory, KindObjectBindingPattern, NodeFactory_NewNodeList(astFactory, asBindingElems)),
                undefined,
                undefined,
                NewCallExpression(
                  astFactory,
                  NewIdentifier(astFactory, "require"),
                  undefined,
                  undefined,
                  NodeFactory_NewNodeList(astFactory, [NewStringLiteral(astFactory, importSource, TokenFlagsNone)]),
                  NodeFlagsNone,
                ),
              ),
            ]),
            NodeFlagsConst,
          ),
        );
        SetParentInChildren(s);
        newStatements.push(s);
        return true;
      });
      for (const e of newStatements) {
        statements = JSXTransformer_insertStatementAfterCustomPrologue(receiver, statements, e);
      }
    } else {
      // Do nothing (script file) - consider an error in the checker?
    }
  }

  if (statementsUpdated) {
    visited = NodeFactory_UpdateSourceFile(astFactory, file, NodeFactory_NewNodeList(astFactory, statements), file!.EndOfFileToken);
  }

  receiver!.currentSourceFile = undefined;
  receiver!.importSpecifier = "";
  receiver!.filenameDeclaration = undefined;
  OrderedMap_Clear<string, GoMap<string, GoPtr<Node>>>(receiver!.utilizedImplicitRuntimeImports as unknown as GoPtr<OrderedMap<string, GoMap<string, GoPtr<Node>>>>);

  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxElement","kind":"method","status":"implemented","sigHash":"d5761f92ca2ec4e98cb3af820f783572e895782cdaa60e5b0285a6447ea81e86","bodyHash":"b6632afad8016fcce673709eb3b9ccdf74b8f77f3309c1034253488d7f28ca86"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxElement(element *ast.JsxElement) *ast.Node {
 * 	tagTransform := (*JSXTransformer).visitJsxOpeningLikeElementJSX
 * 	if tx.shouldUseCreateElement(element.AsNode()) {
 * 		tagTransform = (*JSXTransformer).visitJsxOpeningLikeElementCreateElement
 * 	}
 * 	location := core.NewTextRange(scanner.SkipTrivia(tx.currentSourceFile.Text(), element.Pos()), element.End())
 * 	return tagTransform(tx, element.OpeningElement, element.Children, location)
 * }
 */
export function JSXTransformer_visitJsxElement(receiver: GoPtr<JSXTransformer>, element: GoPtr<JsxElement>): GoPtr<Node> {
  let tagTransform = JSXTransformer_visitJsxOpeningLikeElementJSX;
  if (JSXTransformer_shouldUseCreateElement(receiver, element as unknown as GoPtr<Node>)) {
    tagTransform = JSXTransformer_visitJsxOpeningLikeElementCreateElement;
  }
  const location = NewTextRange(
    SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), Node_Pos(element as unknown as GoPtr<Node>)),
    Node_End(element as unknown as GoPtr<Node>),
  );
  return tagTransform(receiver, element!.OpeningElement, element!.Children, location);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxSelfClosingElement","kind":"method","status":"implemented","sigHash":"a6a4e323adf8a41eb524b3f4f7306ff26f08f35fdf40194ec37e221382bf5ca2","bodyHash":"ad08192f77f7e268612bb664b6cec4d2535c39a60614ab352962d0a938c3d8e0"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxSelfClosingElement(element *ast.JsxSelfClosingElement) *ast.Node {
 * 	tagTransform := (*JSXTransformer).visitJsxOpeningLikeElementJSX
 * 	if tx.shouldUseCreateElement(element.AsNode()) {
 * 		tagTransform = (*JSXTransformer).visitJsxOpeningLikeElementCreateElement
 * 	}
 * 	location := core.NewTextRange(scanner.SkipTrivia(tx.currentSourceFile.Text(), element.Pos()), element.End())
 * 	return tagTransform(tx, element.AsNode(), nil, location)
 * }
 */
export function JSXTransformer_visitJsxSelfClosingElement(receiver: GoPtr<JSXTransformer>, element: GoPtr<JsxSelfClosingElement>): GoPtr<Node> {
  let tagTransform = JSXTransformer_visitJsxOpeningLikeElementJSX;
  if (JSXTransformer_shouldUseCreateElement(receiver, element as unknown as GoPtr<Node>)) {
    tagTransform = JSXTransformer_visitJsxOpeningLikeElementCreateElement;
  }
  const location = NewTextRange(
    SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), Node_Pos(element as unknown as GoPtr<Node>)),
    Node_End(element as unknown as GoPtr<Node>),
  );
  return tagTransform(receiver, element as unknown as GoPtr<Node>, undefined, location);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxFragment","kind":"method","status":"implemented","sigHash":"76e42a60a7a34f843c07e67935a221e526a4ed806001756dd6cbcbf7b0b71a0a","bodyHash":"165ababa17163779967211f053946e3d2fca8c7126d2774e6a666ed783c2eca7"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxFragment(fragment *ast.JsxFragment) *ast.Node {
 * 	tagTransform := (*JSXTransformer).visitJsxOpeningFragmentJSX
 * 	if len(tx.importSpecifier) == 0 {
 * 		tagTransform = (*JSXTransformer).visitJsxOpeningFragmentCreateElement
 * 	}
 * 	location := core.NewTextRange(scanner.SkipTrivia(tx.currentSourceFile.Text(), fragment.Pos()), fragment.End())
 * 	return tagTransform(tx, fragment.OpeningFragment.AsJsxOpeningFragment(), fragment.Children, location)
 * }
 */
export function JSXTransformer_visitJsxFragment(receiver: GoPtr<JSXTransformer>, fragment: GoPtr<JsxFragment>): GoPtr<Node> {
  let tagTransform = JSXTransformer_visitJsxOpeningFragmentJSX;
  if (byteLen(receiver!.importSpecifier) === 0) {
    tagTransform = JSXTransformer_visitJsxOpeningFragmentCreateElement;
  }
  const location = NewTextRange(
    SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), Node_Pos(fragment as unknown as GoPtr<Node>)),
    Node_End(fragment as unknown as GoPtr<Node>),
  );
  return tagTransform(receiver, AsJsxOpeningFragment(fragment!.OpeningFragment), fragment!.Children, location);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.convertJsxChildrenToChildrenPropObject","kind":"method","status":"implemented","sigHash":"02106466e4197ee5402fdbbd492c44fe3cab7c9e4b5132b24570771553bb253a","bodyHash":"16411bb922b8c38faa104ab778e53b8fc65221550431e7395ff54d053d6fabd3"}
 *
 * Go source:
 * func (tx *JSXTransformer) convertJsxChildrenToChildrenPropObject(children []*ast.JsxChild) *ast.Node {
 * 	prop := tx.convertJsxChildrenToChildrenPropAssignment(children)
 * 	if prop == nil {
 * 		return nil
 * 	}
 * 	return tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Node{prop}), false)
 * }
 */
export function JSXTransformer_convertJsxChildrenToChildrenPropObject(receiver: GoPtr<JSXTransformer>, children: GoSlice<GoPtr<JsxChild>>): GoPtr<Node> {
  const prop = JSXTransformer_convertJsxChildrenToChildrenPropAssignment(receiver, children);
  if (prop === undefined) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  return NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, [prop]), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxChildToExpression","kind":"method","status":"implemented","sigHash":"1e346b779434456b9ca346c734bbd66f823cb5217411c3c7880476c837af44fa","bodyHash":"447d6ac7461afebabd738131b66243d4fb317e3751c5158f5ab9cc1145fcdb9b"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxChildToExpression(node *ast.Node) *ast.Node {
 * 	prev := tx.inJsxChild
 * 	tx.setInChild(true)
 * 	defer tx.setInChild(prev)
 * 	return tx.Visitor().Visit(node)
 * }
 */
export function JSXTransformer_transformJsxChildToExpression(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const prev = receiver!.inJsxChild;
  JSXTransformer_setInChild(receiver, true);
  try {
    return (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(node);
  } finally {
    JSXTransformer_setInChild(receiver, prev);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.convertJsxChildrenToChildrenPropAssignment","kind":"method","status":"implemented","sigHash":"f8adc13a5c690fe86ac97a56fa6ebe0c881888e65609a6f16c5c19db82bfa647","bodyHash":"755e7b267f1c52a2cbc5c437e2dc9856323a407ce775f13f3de02e2df31043f9"}
 *
 * Go source:
 * func (tx *JSXTransformer) convertJsxChildrenToChildrenPropAssignment(children []*ast.JsxChild) *ast.Node {
 * 	nonWhitespceChildren := ast.GetSemanticJsxChildren(children)
 * 	if len(nonWhitespceChildren) == 1 && (nonWhitespceChildren[0].Kind != ast.KindJsxExpression || nonWhitespceChildren[0].AsJsxExpression().DotDotDotToken == nil) {
 * 		result := tx.transformJsxChildToExpression(nonWhitespceChildren[0])
 * 		if result == nil {
 * 			return nil
 * 		}
 * 		return tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("children"), nil, nil, result)
 * 	}
 * 	// For multiple children in the children property array, don't set StartOnNewLine
 * 	// on child elements — the array literal is single-line.
 * 	results := make([]*ast.Node, 0, len(nonWhitespceChildren))
 * 	for _, child := range nonWhitespceChildren {
 * 		res := tx.transformJsxChildToExpression(child)
 * 		if res == nil {
 * 			continue
 * 		}
 * 		tx.EmitContext().SetEmitFlags(res, tx.EmitContext().EmitFlags(res) & ^printer.EFStartOnNewLine)
 * 		results = append(results, res)
 * 	}
 * 	if len(results) == 0 {
 * 		return nil
 * 	}
 * 	return tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("children"), nil, nil, tx.Factory().NewArrayLiteralExpression(tx.Factory().NewNodeList(results), false))
 * }
 */
export function JSXTransformer_convertJsxChildrenToChildrenPropAssignment(receiver: GoPtr<JSXTransformer>, children: GoSlice<GoPtr<JsxChild>>): GoPtr<Node> {
  const nonWhitespaceChildren = GetSemanticJsxChildren(children);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  if (nonWhitespaceChildren.length === 1 && (nonWhitespaceChildren[0]!.Kind !== KindJsxExpression || AsJsxExpression(nonWhitespaceChildren[0])!.DotDotDotToken === undefined)) {
    const result = JSXTransformer_transformJsxChildToExpression(receiver, nonWhitespaceChildren[0] as unknown as GoPtr<Node>);
    if (result === undefined) {
      return undefined;
    }
    return NewPropertyAssignment(astFactory, undefined, NewIdentifier(astFactory, "children"), undefined, undefined, result);
  }
  // For multiple children in the children property array, don't set StartOnNewLine
  // on child elements — the array literal is single-line.
  const results: GoSlice<GoPtr<Node>> = [];
  for (const child of nonWhitespaceChildren) {
    const res = JSXTransformer_transformJsxChildToExpression(receiver, child as unknown as GoPtr<Node>);
    if (res === undefined) {
      continue;
    }
    EmitContext_SetEmitFlags(emitContext, res, (EmitContext_EmitFlags(emitContext, res) & ~EFStartOnNewLine) >>> 0);
    results.push(res);
  }
  if (results.length === 0) {
    return undefined;
  }
  return NewPropertyAssignment(astFactory, undefined, NewIdentifier(astFactory, "children"), undefined, undefined, NewArrayLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, results), false));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getTagName","kind":"method","status":"implemented","sigHash":"391d8292148fcef36d5507213d02d50717168b47816d49b9fa4b77e19ee0f43c","bodyHash":"80e6f25c46f253b99a0f130b16b1350e31538c06c3969a22e574cb4a6cdfaf7e"}
 *
 * Go source:
 * func (tx *JSXTransformer) getTagName(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindJsxElement {
 * 		return tx.getTagName(node.AsJsxElement().OpeningElement)
 * 	} else if ast.IsJsxOpeningLikeElement(node) {
 * 		tagName := node.TagName()
 * 		if ast.IsIdentifier(tagName) && scanner.IsIntrinsicJsxName(tagName.Text()) {
 * 			return tx.Factory().NewStringLiteral(tagName.Text(), ast.TokenFlagsNone)
 * 		} else if ast.IsJsxNamespacedName(tagName) {
 * 			return tx.Factory().NewStringLiteral(
 * 				tagName.AsJsxNamespacedName().Namespace.Text()+":"+tagName.AsJsxNamespacedName().Name().Text(), ast.TokenFlagsNone,
 * 			)
 * 		} else {
 * 			return tx.Factory().CreateExpressionFromEntityName(tagName)
 * 		}
 * 	} else {
 * 		panic("unhandled node kind passed to getTagName: " + node.Kind.String())
 * 	}
 * }
 */
export function JSXTransformer_getTagName(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (node!.Kind === KindJsxElement) {
    return JSXTransformer_getTagName(receiver, AsJsxElement(node)!.OpeningElement);
  } else if (IsJsxOpeningLikeElement(node)) {
    const tagName = Node_TagName(node);
    if (IsIdentifier(tagName) && IsIntrinsicJsxName(Node_Text(tagName))) {
      return NewStringLiteral(astFactory, Node_Text(tagName), TokenFlagsNone);
    } else if (IsJsxNamespacedName(tagName)) {
      return NewStringLiteral(
        astFactory,
        Node_Text(AsJsxNamespacedName(tagName)!.Namespace) + ":" + Node_Text(AsJsxNamespacedName(tagName)!.name),
        TokenFlagsNone,
      );
    } else {
      return NodeFactory_CreateExpressionFromEntityName(factory, tagName);
    }
  } else {
    throw new globalThis.Error("unhandled node kind passed to getTagName: " + KindString(node!.Kind));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxOpeningLikeElementJSX","kind":"method","status":"implemented","sigHash":"6f2cee7e0bb8987f9d608a701b8d8908570f8cad3e60f0f9365acd8ec31f426d","bodyHash":"cc37a8bc8ffccbda13197a68d678249243f66a4f7746eb70e8d1a673817a5b7e"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxOpeningLikeElementJSX(element *ast.Node, children *ast.NodeList, location core.TextRange) *ast.Node {
 * 	tagName := tx.getTagName(element)
 * 	var childrenProp *ast.Node
 * 	if children != nil && len(children.Nodes) > 0 {
 * 		childrenProp = tx.convertJsxChildrenToChildrenPropAssignment(children.Nodes)
 * 	}
 * 	var keyAttr *ast.Node
 * 	attrs := element.Attributes().Properties()
 * 	for i, p := range attrs {
 * 		if p.Kind == ast.KindJsxAttribute && p.AsJsxAttribute().Name() != nil && ast.IsIdentifier(p.AsJsxAttribute().Name()) && p.AsJsxAttribute().Name().Text() == "key" {
 * 			keyAttr = p
 * 			attrs = slices.Clone(attrs)
 * 			attrs = slices.Delete(attrs, i, i+1)
 * 			break
 * 		}
 * 	}
 * 	var object *ast.Node
 * 	if len(attrs) > 0 {
 * 		object = tx.transformJsxAttributesToObjectProps(attrs, childrenProp)
 * 	} else {
 * 		objectChildren := []*ast.Node{}
 * 		if childrenProp != nil {
 * 			objectChildren = append(objectChildren, childrenProp)
 * 		}
 * 		object = tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList(objectChildren), false) // When there are no attributes, React wants {}
 * 	}
 * 	return tx.visitJsxOpeningLikeElementOrFragmentJSX(
 * 		tagName,
 * 		object,
 * 		keyAttr,
 * 		children,
 * 		location,
 * 	)
 * }
 */
export function JSXTransformer_visitJsxOpeningLikeElementJSX(receiver: GoPtr<JSXTransformer>, element: GoPtr<Node>, children: GoPtr<NodeList>, location: TextRange): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const tagName = JSXTransformer_getTagName(receiver, element);
  let childrenProp: GoPtr<Node> = undefined;
  if (children !== undefined && children!.Nodes.length > 0) {
    childrenProp = JSXTransformer_convertJsxChildrenToChildrenPropAssignment(receiver, children!.Nodes as GoSlice<GoPtr<JsxChild>>);
  }
  let keyAttr: GoPtr<Node> = undefined;
  let attrs: GoSlice<GoPtr<Node>> = Node_Properties(Node_Attributes(element)) ?? [];
  for (let i = 0; i < attrs.length; i++) {
    const p = attrs[i]!;
    if (p!.Kind === KindJsxAttribute && Node_Name(p) !== undefined && IsIdentifier(Node_Name(p)) && Node_Text(Node_Name(p)) === "key") {
      keyAttr = p;
      attrs = [...attrs.slice(0, i), ...attrs.slice(i + 1)];
      break;
    }
  }
  let object: GoPtr<Node>;
  if (attrs.length > 0) {
    object = JSXTransformer_transformJsxAttributesToObjectProps(receiver, attrs, childrenProp);
  } else {
    const objectChildren: GoSlice<GoPtr<Node>> = [];
    if (childrenProp !== undefined) {
      objectChildren.push(childrenProp);
    }
    object = NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, objectChildren), false); // When there are no attributes, React wants {}
  }
  return JSXTransformer_visitJsxOpeningLikeElementOrFragmentJSX(
    receiver,
    tagName,
    object,
    keyAttr,
    children,
    location,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxAttributesToObjectProps","kind":"method","status":"implemented","sigHash":"a727ebb6c31c5d6a5f8db5db7c8c4abfd36c90ed88bd89a606ddf4e9783703b6","bodyHash":"e5ec2b7f47235718468b7768e16582f863d7fdefed5fd97c3527743e28b4842c"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxAttributesToObjectProps(attrs []*ast.Node, childrenProp *ast.Node) *ast.Node {
 * 	target := tx.compilerOptions.GetEmitScriptTarget()
 * 	if target >= core.ScriptTargetES2018 {
 * 		// target has object spreads, can keep as-is
 * 		return tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList(tx.transformJsxAttributesToProps(attrs, childrenProp)), false)
 * 	}
 * 	return tx.transformJsxAttributesToExpression(attrs, childrenProp)
 * }
 */
export function JSXTransformer_transformJsxAttributesToObjectProps(receiver: GoPtr<JSXTransformer>, attrs: GoSlice<GoPtr<Node>>, childrenProp: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const target = CompilerOptions_GetEmitScriptTarget(receiver!.compilerOptions);
  if (target >= ScriptTargetES2018) {
    // target has object spreads, can keep as-is
    return NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, JSXTransformer_transformJsxAttributesToProps(receiver, attrs, childrenProp)), false);
  }
  return JSXTransformer_transformJsxAttributesToExpression(receiver, attrs, childrenProp);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxAttributesToExpression","kind":"method","status":"implemented","sigHash":"096a5d938414fe75c743c0cb6cd3c152131082656fc2a51751f5fb5aff89ed11","bodyHash":"75a14f92ddde5f8b879c046bcc4e23cc3aabd60a3f945f924d48deb4afbf0ee0"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxAttributesToExpression(attrs []*ast.Node, childrenProp *ast.Node) *ast.Node {
 * 	expressions := make([]*ast.Expression, 0, 2)
 * 	properties := make([]*ast.ObjectLiteralElement, 0, len(attrs))
 * 
 * 	for _, attr := range attrs {
 * 		if ast.IsJsxSpreadAttribute(attr) {
 * 			// as an optimization we try to flatten the first level of spread inline object
 * 			// as if its props would be passed as JSX attributes
 * 			if ast.IsObjectLiteralExpression(attr.Expression()) && !hasProto(attr.Expression().AsObjectLiteralExpression()) {
 * 				for _, prop := range attr.Expression().Properties() {
 * 					if ast.IsSpreadAssignment(prop) {
 * 						expressions, properties = tx.combinePropertiesIntoNewExpression(expressions, properties)
 * 						expressions = append(expressions, tx.Visitor().Visit(prop.Expression()))
 * 						continue
 * 					}
 * 					properties = append(properties, tx.Visitor().Visit(prop))
 * 				}
 * 				continue
 * 			}
 * 			expressions, properties = tx.combinePropertiesIntoNewExpression(expressions, properties)
 * 			expressions = append(expressions, tx.Visitor().Visit(attr.Expression()))
 * 			continue
 * 		}
 * 		properties = append(properties, tx.transformJsxAttributeToObjectLiteralElement(attr.AsJsxAttribute()))
 * 	}
 * 
 * 	if childrenProp != nil {
 * 		properties = append(properties, childrenProp)
 * 	}
 * 
 * 	expressions, _ = tx.combinePropertiesIntoNewExpression(expressions, properties)
 * 
 * 	if len(expressions) > 0 && !ast.IsObjectLiteralExpression(expressions[0]) {
 * 		// We must always emit at least one object literal before a spread attribute
 * 		// as the JSX always factory expects a fresh object, so we need to make a copy here
 * 		// we also avoid mutating an external reference by doing this (first expression is used as assign's target)
 * 		expressions = append([]*ast.Expression{tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Node{}), false)}, expressions...)
 * 	}
 * 
 * 	if len(expressions) == 1 {
 * 		return expressions[0]
 * 	}
 * 	return tx.Factory().NewAssignHelper(expressions, tx.compilerOptions.GetEmitScriptTarget())
 * }
 */
export function JSXTransformer_transformJsxAttributesToExpression(receiver: GoPtr<JSXTransformer>, attrs: GoSlice<GoPtr<Node>>, childrenProp: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  let expressions: GoSlice<GoPtr<Expression>> = [];
  let properties: GoSlice<GoPtr<ObjectLiteralElement>> = [];

  for (const attr of attrs) {
    if (IsJsxSpreadAttribute(attr)) {
      // as an optimization we try to flatten the first level of spread inline object
      // as if its props would be passed as JSX attributes
      if (IsObjectLiteralExpression(Node_Expression(attr)) && !hasProto(AsObjectLiteralExpression(Node_Expression(attr)))) {
        for (const prop of Node_Properties(Node_Expression(attr)) ?? []) {
          if (IsSpreadAssignment(prop)) {
            [expressions, properties] = JSXTransformer_combinePropertiesIntoNewExpression(receiver, expressions, properties);
            expressions = [...expressions, (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(Node_Expression(prop))];
            continue;
          }
          properties = [...properties, (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(prop)];
        }
        continue;
      }
      [expressions, properties] = JSXTransformer_combinePropertiesIntoNewExpression(receiver, expressions, properties);
      expressions = [...expressions, (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(Node_Expression(attr))];
      continue;
    }
    properties = [...properties, JSXTransformer_transformJsxAttributeToObjectLiteralElement(receiver, AsJsxAttribute(attr))];
  }

  if (childrenProp !== undefined) {
    properties = [...properties, childrenProp];
  }

  [expressions] = JSXTransformer_combinePropertiesIntoNewExpression(receiver, expressions, properties);

  if (expressions.length > 0 && !IsObjectLiteralExpression(expressions[0])) {
    // We must always emit at least one object literal before a spread attribute
    // as the JSX always factory expects a fresh object, so we need to make a copy here
    // we also avoid mutating an external reference by doing this (first expression is used as assign's target)
    expressions = [NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, []), false), ...expressions];
  }

  if (expressions.length === 1) {
    return expressions[0];
  }
  return NodeFactory_NewAssignHelper(factory, expressions, CompilerOptions_GetEmitScriptTarget(receiver!.compilerOptions));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.combinePropertiesIntoNewExpression","kind":"method","status":"implemented","sigHash":"5a0fac7dfda6d2247e496d797fc22b2a9adc5570cd18c6ccd50bc7d28f216539","bodyHash":"c96d3b385d24749305210b9f559b73af32fc96bb7c49a39c01aec4e05693c136"}
 *
 * Go source:
 * func (tx *JSXTransformer) combinePropertiesIntoNewExpression(expressions []*ast.Expression, props []*ast.ObjectLiteralElement) ([]*ast.Expression, []*ast.ObjectLiteralElement) {
 * 	if len(props) == 0 {
 * 		return expressions, props
 * 	}
 * 	newObj := tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList(props), false)
 * 	expressions = append(expressions, newObj)
 * 	return expressions, nil
 * }
 */
export function JSXTransformer_combinePropertiesIntoNewExpression(receiver: GoPtr<JSXTransformer>, expressions: GoSlice<GoPtr<Expression>>, props: GoSlice<GoPtr<ObjectLiteralElement>>): [GoSlice<GoPtr<Expression>>, GoSlice<GoPtr<ObjectLiteralElement>>] {
  if (props.length === 0) {
    return [expressions, props];
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const newObj = NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, props), false);
  const newExpressions = [...expressions, newObj];
  return [newExpressions, []];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxAttributesToProps","kind":"method","status":"implemented","sigHash":"769720f39f3d89219d911d9edc628adec9dbfd2fda8983f30b7a9604a84d8011","bodyHash":"dc41db1c97a9339d3ddc4f58be1d67823802ddf603c2a1e6c074274d1559612d"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxAttributesToProps(attrs []*ast.Node, childrenProp *ast.Node) []*ast.Node {
 * 	props := make([]*ast.Node, 0, len(attrs))
 * 	for _, attr := range attrs {
 * 		if attr.Kind == ast.KindJsxSpreadAttribute {
 * 			res := tx.transformJsxSpreadAttributesToProps(attr.AsJsxSpreadAttribute())
 * 			props = append(props, res...)
 * 		} else {
 * 			props = append(props, tx.transformJsxAttributeToObjectLiteralElement(attr.AsJsxAttribute()))
 * 		}
 * 	}
 * 	if childrenProp != nil {
 * 		props = append(props, childrenProp)
 * 	}
 * 	return props
 * }
 */
export function JSXTransformer_transformJsxAttributesToProps(receiver: GoPtr<JSXTransformer>, attrs: GoSlice<GoPtr<Node>>, childrenProp: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const props: GoSlice<GoPtr<Node>> = [];
  for (const attr of attrs) {
    if (attr!.Kind === KindJsxSpreadAttribute) {
      const res = JSXTransformer_transformJsxSpreadAttributesToProps(receiver, AsJsxSpreadAttribute(attr));
      props.push(...res);
    } else {
      props.push(JSXTransformer_transformJsxAttributeToObjectLiteralElement(receiver, AsJsxAttribute(attr)));
    }
  }
  if (childrenProp !== undefined) {
    props.push(childrenProp);
  }
  return props;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::hasProto","kind":"func","status":"implemented","sigHash":"8d95351a84f4bc2ae415834ab3d41bb981c05e55c24cfeedc6ff815025e15330","bodyHash":"d64fa2c1b9665ca0771b894c15bcabf9780cb958eb1654c4bb08c45e3376b524"}
 *
 * Go source:
 * func hasProto(obj *ast.ObjectLiteralExpression) bool {
 * 	for _, p := range obj.Properties.Nodes {
 * 		if ast.IsPropertyAssignment(p) && (ast.IsStringLiteral(p.Name()) || ast.IsIdentifier(p.Name())) && p.Name().Text() == "__proto__" {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasProto(obj: GoPtr<ObjectLiteralExpression>): bool {
  for (const p of obj!.Properties!.Nodes) {
    if (IsPropertyAssignment(p) && (IsStringLiteral(Node_Name(p)) || IsIdentifier(Node_Name(p))) && Node_Text(Node_Name(p)) === "__proto__") {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxSpreadAttributesToProps","kind":"method","status":"implemented","sigHash":"d18800099aa396872b1797984584d6102eef25d9f9c431ab09974a7641256fa5","bodyHash":"c649130bc66ab2a46c97fe5bd8717b11456f94d3851cdb275204b4df47da2cd5"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxSpreadAttributesToProps(node *ast.JsxSpreadAttribute) []*ast.Node {
 * 	if ast.IsObjectLiteralExpression(node.Expression) && !hasProto(node.Expression.AsObjectLiteralExpression()) {
 * 		res, _ := tx.Visitor().VisitSlice(node.Expression.Properties())
 * 		return res
 * 	}
 * 	return []*ast.Node{tx.Factory().NewSpreadAssignment(tx.Visitor().Visit(node.Expression))}
 * }
 */
export function JSXTransformer_transformJsxSpreadAttributesToProps(receiver: GoPtr<JSXTransformer>, node: GoPtr<JsxSpreadAttribute>): GoSlice<GoPtr<Node>> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (IsObjectLiteralExpression(node!.Expression) && !hasProto(AsObjectLiteralExpression(node!.Expression))) {
    const [res] = NodeVisitor_VisitSlice(Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as ConcreteNodeVisitor, Node_Properties(node!.Expression) ?? []);
    return res;
  }
  return [NewSpreadAssignment(astFactory, (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(node!.Expression))];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxAttributeToObjectLiteralElement","kind":"method","status":"implemented","sigHash":"773dbf9e494f64d11be73d404f338adf4ed8a1e73527c767ba00681c94cd9351","bodyHash":"7dfd0d0ed6fe122b1073cc781cc20c546dffe1e43d0f4c86b14a7b8beb91b8f8"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxAttributeToObjectLiteralElement(node *ast.JsxAttribute) *ast.Node {
 * 	name := tx.getAttributeName(node)
 * 	expression := tx.transformJsxAttributeInitializer(node.Initializer)
 * 	return tx.Factory().NewPropertyAssignment(nil, name, nil, nil, expression)
 * }
 */
export function JSXTransformer_transformJsxAttributeToObjectLiteralElement(receiver: GoPtr<JSXTransformer>, node: GoPtr<JsxAttribute>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const name = JSXTransformer_getAttributeName(receiver, node);
  const expression = JSXTransformer_transformJsxAttributeInitializer(receiver, node!.Initializer as unknown as GoPtr<Node>);
  return NewPropertyAssignment(astFactory, undefined, name, undefined, undefined, expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.getAttributeName","kind":"method","status":"implemented","sigHash":"e164f6c3b366746481f32e6ec8643428d4b7b03c4e270d03d6b9014b0f5bff67","bodyHash":"03efd43451396c58ae7a0d84cde26e787f61a369f10af9f6c85e0e5dd5f16d01"}
 *
 * Go source:
 * func (tx *JSXTransformer) getAttributeName(node *ast.JsxAttribute) *ast.Node {
 * 	name := node.Name()
 * 	if ast.IsIdentifier(name) {
 * 		text := name.Text()
 * 		if scanner.IsIdentifierText(text, core.LanguageVariantStandard) {
 * 			return name
 * 		}
 * 		return tx.Factory().NewStringLiteral(text, ast.TokenFlagsNone)
 * 	}
 * 	// must be jsx namespace
 * 	return tx.Factory().NewStringLiteral(
 * 		name.AsJsxNamespacedName().Namespace.Text()+":"+name.AsJsxNamespacedName().Name().Text(), ast.TokenFlagsNone,
 * 	)
 * }
 */
export function JSXTransformer_getAttributeName(receiver: GoPtr<JSXTransformer>, node: GoPtr<JsxAttribute>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const name = node!.name as unknown as GoPtr<Node>;
  if (IsIdentifier(name)) {
    const text = Node_Text(name);
    if (IsIdentifierText(text, LanguageVariantStandard)) {
      return name;
    }
    return NewStringLiteral(astFactory, text, TokenFlagsNone);
  }
  // must be jsx namespace
  return NewStringLiteral(
    astFactory,
    Node_Text(AsJsxNamespacedName(name)!.Namespace) + ":" + Node_Text(AsJsxNamespacedName(name)!.name),
    TokenFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.transformJsxAttributeInitializer","kind":"method","status":"implemented","sigHash":"992a1b432f04a4f8c4c54860261947e8dc740d85db48926d8b9acd53973a8a43","bodyHash":"c71c56322e634623a1ea54b4e2012c49d105b6311800cc97f1bf676475b365ec"}
 *
 * Go source:
 * func (tx *JSXTransformer) transformJsxAttributeInitializer(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return tx.Factory().NewTrueExpression()
 * 	}
 * 	if node.Kind == ast.KindStringLiteral {
 * 		// Always recreate the literal to escape any escape sequences or newlines which may be in the original jsx string and which
 * 		// Need to be escaped to be handled correctly in a normal string
 * 		res := tx.Factory().NewStringLiteral(decodeEntities(node.Text()), node.AsStringLiteral().TokenFlags)
 * 		res.Loc = node.Loc
 * 		// Preserve the original quote style (single vs double quotes)
 * 		res.AsStringLiteral().TokenFlags = node.AsStringLiteral().TokenFlags
 * 		return res
 * 	}
 * 	if node.Kind == ast.KindJsxExpression {
 * 		if node.Expression() == nil {
 * 			return tx.Factory().NewTrueExpression()
 * 		}
 * 		return tx.Visitor().Visit(node.Expression())
 * 	}
 * 	if ast.IsJsxElement(node) || ast.IsJsxSelfClosingElement(node) || ast.IsJsxFragment(node) {
 * 		tx.setInChild(false)
 * 		return tx.Visitor().Visit(node)
 * 	}
 * 	panic("Unhandled node kind found in jsx initializer: " + node.Kind.String())
 * }
 */
export function JSXTransformer_transformJsxAttributeInitializer(receiver: GoPtr<JSXTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (node === undefined) {
    return NodeFactory_NewTrueExpression(factory);
  }
  if (node!.Kind === KindStringLiteral) {
    // Always recreate the literal to escape any escape sequences or newlines which may be in the original jsx string and which
    // Need to be escaped to be handled correctly in a normal string
    const res = NewStringLiteral(astFactory, decodeEntities(Node_Text(node)), AsStringLiteral(node)!.TokenFlags);
    res!.Loc = node!.Loc;
    // Preserve the original quote style (single vs double quotes)
    AsStringLiteral(res)!.TokenFlags = AsStringLiteral(node)!.TokenFlags;
    return res;
  }
  if (node!.Kind === KindJsxExpression) {
    if (AsJsxExpression(node)!.Expression === undefined) {
      return NodeFactory_NewTrueExpression(factory);
    }
    return (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(AsJsxExpression(node)!.Expression as unknown as GoPtr<Node>);
  }
  if (IsJsxElement(node) || IsJsxSelfClosingElement(node) || IsJsxFragment(node)) {
    JSXTransformer_setInChild(receiver, false);
    return (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(node);
  }
  throw new globalThis.Error("Unhandled node kind found in jsx initializer: " + KindString(node!.Kind));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxOpeningLikeElementOrFragmentJSX","kind":"method","status":"implemented","sigHash":"5ad4943db7b62c70024513125b0c4c95406c1a83f951fb1bd3a6affce95b3784","bodyHash":"da74b1ee3b0a58a64ee05ce57e0adf5ef3220d5f18eea0db1c45699727f67483"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxOpeningLikeElementOrFragmentJSX(
 * 	tagName *ast.Expression,
 * 	object *ast.Expression,
 * 	keyAttr *ast.Node,
 * 	children *ast.NodeList,
 * 	location core.TextRange,
 * ) *ast.Node {
 * 	var nonWhitespaceChildren []*ast.Node
 * 	if children != nil {
 * 		nonWhitespaceChildren = ast.GetSemanticJsxChildren(children.Nodes)
 * 	}
 * 	isStaticChildren := len(nonWhitespaceChildren) > 1 || (len(nonWhitespaceChildren) == 1 && ast.IsJsxExpression(nonWhitespaceChildren[0]) && nonWhitespaceChildren[0].AsJsxExpression().DotDotDotToken != nil)
 * 	args := make([]*ast.Node, 0, 3)
 * 	args = append(args, tagName, object)
 * 	// function jsx(type, config, maybeKey) {}
 * 	// "maybeKey" is optional. It is acceptable to use "_jsx" without a third argument
 * 	if keyAttr != nil {
 * 		args = append(args, tx.transformJsxAttributeInitializer(keyAttr.Initializer()))
 * 	}
 * 
 * 	if tx.compilerOptions.Jsx == core.JsxEmitReactJSXDev {
 * 		originalFile := tx.EmitContext().MostOriginal(tx.currentSourceFile.AsNode())
 * 		if originalFile != nil && ast.IsSourceFile(originalFile) {
 * 			// "maybeKey" has to be replaced with "void 0" to not break the jsxDEV signature
 * 			if keyAttr == nil {
 * 				args = append(args, tx.Factory().NewVoidZeroExpression())
 * 			}
 * 			// isStaticChildren development flag
 * 			if isStaticChildren {
 * 				args = append(args, tx.Factory().NewTrueExpression())
 * 			} else {
 * 				args = append(args, tx.Factory().NewFalseExpression())
 * 			}
 * 			// __source development flag
 * 			line, col := scanner.GetECMALineAndUTF16CharacterOfPosition(originalFile.AsSourceFile(), location.Pos())
 * 			args = append(args, tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Node{
 * 				tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("fileName"), nil, nil, tx.getCurrentFileNameExpression()),
 * 				tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("lineNumber"), nil, nil, tx.Factory().NewNumericLiteral(strconv.FormatInt(int64(line+1), 10), ast.TokenFlagsNone)),
 * 				tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("columnNumber"), nil, nil, tx.Factory().NewNumericLiteral(strconv.FormatInt(int64(col)+1, 10), ast.TokenFlagsNone)),
 * 			}), false))
 * 			// __self development flag
 * 			args = append(args, tx.Factory().NewThisExpression())
 * 		}
 * 	}
 * 
 * 	element := tx.Factory().NewCallExpression(tx.getJsxFactoryCallee(isStaticChildren), nil, nil, tx.Factory().NewNodeList(args), ast.NodeFlagsNone)
 * 	element.Loc = location
 * 
 * 	if tx.inJsxChild {
 * 		tx.EmitContext().AddEmitFlags(element, printer.EFStartOnNewLine)
 * 	}
 * 
 * 	return element
 * }
 */
export function JSXTransformer_visitJsxOpeningLikeElementOrFragmentJSX(receiver: GoPtr<JSXTransformer>, tagName: GoPtr<Expression>, object: GoPtr<Expression>, keyAttr: GoPtr<Node>, children: GoPtr<NodeList>, location: TextRange): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  let nonWhitespaceChildren: GoSlice<GoPtr<Node>> = [];
  if (children !== undefined) {
    nonWhitespaceChildren = GetSemanticJsxChildren(children!.Nodes as GoSlice<GoPtr<JsxChild>>);
  }
  const isStaticChildren =
    nonWhitespaceChildren.length > 1 ||
    (nonWhitespaceChildren.length === 1 && IsJsxExpression(nonWhitespaceChildren[0]) && AsJsxExpression(nonWhitespaceChildren[0])!.DotDotDotToken !== undefined);
  const args: GoSlice<GoPtr<Node>> = [];
  args.push(tagName as unknown as GoPtr<Node>);
  args.push(object as unknown as GoPtr<Node>);
  // function jsx(type, config, maybeKey) {}
  // "maybeKey" is optional. It is acceptable to use "_jsx" without a third argument
  if (keyAttr !== undefined) {
    args.push(JSXTransformer_transformJsxAttributeInitializer(receiver, Node_Initializer(keyAttr)));
  }

  if (receiver!.compilerOptions!.Jsx === JsxEmitReactJSXDev) {
    const originalFile = EmitContext_MostOriginal(emitContext, receiver!.currentSourceFile as unknown as GoPtr<Node>);
    if (originalFile !== undefined && IsSourceFile(originalFile)) {
      // "maybeKey" has to be replaced with "void 0" to not break the jsxDEV signature
      if (keyAttr === undefined) {
        args.push(NodeFactory_NewVoidZeroExpression(factory) as unknown as GoPtr<Node>);
      }
      // isStaticChildren development flag
      if (isStaticChildren) {
        args.push(NodeFactory_NewTrueExpression(factory) as unknown as GoPtr<Node>);
      } else {
        args.push(NodeFactory_NewFalseExpression(factory) as unknown as GoPtr<Node>);
      }
      // __source development flag
      const [line, col] = GetECMALineAndUTF16CharacterOfPosition(AsSourceFile(originalFile) as unknown as SourceFileLike, location.pos);
      args.push(
        NewObjectLiteralExpression(
          astFactory,
          NodeFactory_NewNodeList(astFactory, [
            NewPropertyAssignment(astFactory, undefined, NewIdentifier(astFactory, "fileName"), undefined, undefined, JSXTransformer_getCurrentFileNameExpression(receiver) as unknown as GoPtr<Node>),
            NewPropertyAssignment(astFactory, undefined, NewIdentifier(astFactory, "lineNumber"), undefined, undefined, NewNumericLiteral(astFactory, FormatInt(line + 1, 10), TokenFlagsNone) as unknown as GoPtr<Node>),
            NewPropertyAssignment(astFactory, undefined, NewIdentifier(astFactory, "columnNumber"), undefined, undefined, NewNumericLiteral(astFactory, FormatInt(col + 1, 10), TokenFlagsNone) as unknown as GoPtr<Node>),
          ]),
          false,
        ) as unknown as GoPtr<Node>,
      );
      // __self development flag
      args.push(NodeFactory_NewThisExpression(factory) as unknown as GoPtr<Node>);
    }
  }

  const element = NewCallExpression(astFactory, JSXTransformer_getJsxFactoryCallee(receiver, isStaticChildren) as unknown as GoPtr<Node>, undefined, undefined, NodeFactory_NewNodeList(astFactory, args), NodeFlagsNone);
  element!.Loc = location;

  if (receiver!.inJsxChild) {
    EmitContext_AddEmitFlags(emitContext, element as unknown as GoPtr<Node>, EFStartOnNewLine);
  }

  return element as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxOpeningFragmentJSX","kind":"method","status":"implemented","sigHash":"ee40516ff6c23ef634ea95583d0e4cb6a4d8f85238a7524bc14236cbf8f17086","bodyHash":"ee18639fc0c685d5a90af15a5beac0155a75ef87aaf8ddab4a0abbfe7fb7132b"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxOpeningFragmentJSX(fragment *ast.JsxOpeningFragment, children *ast.NodeList, location core.TextRange) *ast.Node {
 * 	var childrenProps *ast.Expression
 * 	if children != nil && len(children.Nodes) > 0 {
 * 		result := tx.convertJsxChildrenToChildrenPropObject(children.Nodes)
 * 		if result != nil {
 * 			childrenProps = result
 * 		}
 * 	}
 * 	if childrenProps == nil {
 * 		childrenProps = tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Node{}), false)
 * 	}
 * 	return tx.visitJsxOpeningLikeElementOrFragmentJSX(
 * 		tx.getImplicitJsxFragmentReference(),
 * 		childrenProps,
 * 		nil,
 * 		children,
 * 		location,
 * 	)
 * }
 */
export function JSXTransformer_visitJsxOpeningFragmentJSX(receiver: GoPtr<JSXTransformer>, fragment: GoPtr<JsxOpeningFragment>, children: GoPtr<NodeList>, location: TextRange): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  let childrenProps: GoPtr<Expression> = undefined;
  if (children !== undefined && children!.Nodes.length > 0) {
    const result = JSXTransformer_convertJsxChildrenToChildrenPropObject(receiver, children!.Nodes as GoSlice<GoPtr<JsxChild>>);
    if (result !== undefined) {
      childrenProps = result as unknown as GoPtr<Expression>;
    }
  }
  if (childrenProps === undefined) {
    childrenProps = NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, []), false) as unknown as GoPtr<Expression>;
  }
  return JSXTransformer_visitJsxOpeningLikeElementOrFragmentJSX(
    receiver,
    JSXTransformer_getImplicitJsxFragmentReference(receiver) as unknown as GoPtr<Expression>,
    childrenProps,
    undefined,
    children,
    location,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.createReactNamespace","kind":"method","status":"implemented","sigHash":"d18c67a2e8e841a49ac09ddd532c5c3677623b64c54a90f8ea17e51812a46a10","bodyHash":"37581b853ca0f40a5f3c77d0e7c9c862d47f9fa0eedd0b52f2124a6f2e2b2980"}
 *
 * Go source:
 * func (tx *JSXTransformer) createReactNamespace(reactNamespace string, parent *ast.Node) *ast.Node {
 * 	// To ensure the emit resolver can properly resolve the namespace, we need to
 * 	// treat this identifier as if it were a source tree node by clearing the `Synthesized`
 * 	// flag and setting a parent node. TODO: Is this still true? The emit resolver is supposed to be
 * 	// hardened aginast this, so long as the node retains original node pointers back to a parsed node
 * 	if len(reactNamespace) == 0 {
 * 		reactNamespace = "React"
 * 	}
 * 	react := tx.Factory().NewIdentifier(reactNamespace)
 * 	react.Flags &^= ast.NodeFlagsSynthesized
 * 
 * 	// Set the parent that is in parse tree
 * 	// this makes sure that parent chain is intact for checker to traverse complete scope tree
 * 	react.Parent = tx.EmitContext().ParseNode(parent) //nolint:customlint // Parent is intentionally wired to a parse-tree node for resolver traversal.
 * 
 * 	// If the identifier refers to an exported member of a namespace, substitute with
 * 	// a qualified namespace property access (e.g., `React` -> `M.React`).
 * 	// See also: RuntimeSyntaxTransformer.visitExpressionIdentifier in runtimesyntax.go
 * 	if container := tx.emitResolver.GetReferencedExportContainer(react, false /*prefixLocals* /); container != nil && ast.IsModuleDeclaration(container) {
 * 		containerName := tx.Factory().NewGeneratedNameForNode(container)
 * 		return tx.Factory().NewPropertyAccessExpression(containerName, nil, react, ast.NodeFlagsNone)
 * 	}
 * 
 * 	return react
 * }
 */
export function JSXTransformer_createReactNamespace(receiver: GoPtr<JSXTransformer>, reactNamespace: string, parent: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  // To ensure the emit resolver can properly resolve the namespace, we need to
  // treat this identifier as if it were a source tree node by clearing the `Synthesized`
  // flag and setting a parent node.
  const ns = reactNamespace.length === 0 ? "React" : reactNamespace;
  const react = NewIdentifier(astFactory, ns);
  react!.Flags = (react!.Flags & ~NodeFlagsSynthesized) >>> 0;

  // Set the parent that is in parse tree
  // this makes sure that parent chain is intact for checker to traverse complete scope tree
  react!.Parent = EmitContext_ParseNode(emitContext, parent); // Parent is intentionally wired to a parse-tree node for resolver traversal.

  // If the identifier refers to an exported member of a namespace, substitute with
  // a qualified namespace property access (e.g., `React` -> `M.React`).
  const container = receiver!.emitResolver!.GetReferencedExportContainer(AsIdentifier(react as unknown as GoPtr<Node>)!, false /*prefixLocals*/);
  if (container !== undefined && IsModuleDeclaration(container as unknown as GoPtr<Node>)) {
    const containerName = NodeFactory_NewGeneratedNameForNode(factory, container as unknown as GoPtr<Node>);
    return NewPropertyAccessExpression(astFactory, containerName, undefined, react as unknown as GoPtr<Node>, NodeFlagsNone);
  }

  return react as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.createJsxFactoryExpressionFromEntityName","kind":"method","status":"implemented","sigHash":"f10375993dbd1f03075f6372af5c6bfa4ba55d2c60e08cdd88cda529e8116928","bodyHash":"d4bd43371721963dec7b536feb41df61e366b1703ff89a3447018ec6fb9cb7ec"}
 *
 * Go source:
 * func (tx *JSXTransformer) createJsxFactoryExpressionFromEntityName(e *ast.Node, parent *ast.Node) *ast.Node {
 * 	if ast.IsQualifiedName(e) {
 * 		left := tx.createJsxFactoryExpressionFromEntityName(e.AsQualifiedName().Left, parent)
 * 		right := tx.Factory().NewIdentifier(e.AsQualifiedName().Right.Text())
 * 		return tx.Factory().NewPropertyAccessExpression(left, nil, right, ast.NodeFlagsNone)
 * 	}
 * 	return tx.createReactNamespace(e.Text(), parent)
 * }
 */
export function JSXTransformer_createJsxFactoryExpressionFromEntityName(receiver: GoPtr<JSXTransformer>, e: GoPtr<Node>, parent: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (IsQualifiedName(e)) {
    const left = JSXTransformer_createJsxFactoryExpressionFromEntityName(receiver, AsQualifiedName(e)!.Left as unknown as GoPtr<Node>, parent);
    const right = NewIdentifier(astFactory, Node_Text(AsQualifiedName(e)!.Right as unknown as GoPtr<Node>));
    return NewPropertyAccessExpression(astFactory, left, undefined, right as unknown as GoPtr<Node>, NodeFlagsNone);
  }
  return JSXTransformer_createReactNamespace(receiver, Node_Text(e), parent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.createJsxPseudoFactoryExpression","kind":"method","status":"implemented","sigHash":"77be78769325668cbeac36ec71745d7051f8f9619dcb9d9b18999e13ce5b2ab6","bodyHash":"d5fa84b5232dfebbd22e26a60d34539091101162b37faefafd6c34d759e89ba2"}
 *
 * Go source:
 * func (tx *JSXTransformer) createJsxPseudoFactoryExpression(parent *ast.Node, e *ast.Node, target string) *ast.Node {
 * 	if e != nil {
 * 		return tx.createJsxFactoryExpressionFromEntityName(e, parent)
 * 	}
 * 	return tx.Factory().NewPropertyAccessExpression(
 * 		tx.createReactNamespace(tx.compilerOptions.ReactNamespace, parent),
 * 		nil,
 * 		tx.Factory().NewIdentifier(target),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function JSXTransformer_createJsxPseudoFactoryExpression(receiver: GoPtr<JSXTransformer>, parent: GoPtr<Node>, e: GoPtr<Node>, target: string): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (e !== undefined) {
    return JSXTransformer_createJsxFactoryExpressionFromEntityName(receiver, e, parent);
  }
  return NewPropertyAccessExpression(
    astFactory,
    JSXTransformer_createReactNamespace(receiver, receiver!.compilerOptions!.ReactNamespace, parent),
    undefined,
    NewIdentifier(astFactory, target) as unknown as GoPtr<Node>,
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.createJsxFactoryExpression","kind":"method","status":"implemented","sigHash":"af223043145f5d5727d5424d8e8411b4355e5aef7122d8527bcf5bea106c9e08","bodyHash":"71ccc2393509e696a5ecc5a2c27c7f90b7d2a1bf122c8b51bdee3372d7b07491"}
 *
 * Go source:
 * func (tx *JSXTransformer) createJsxFactoryExpression(parent *ast.Node) *ast.Node {
 * 	e := tx.emitResolver.GetJsxFactoryEntity(tx.currentSourceFile.AsNode())
 * 	return tx.createJsxPseudoFactoryExpression(parent, e, "createElement")
 * }
 */
export function JSXTransformer_createJsxFactoryExpression(receiver: GoPtr<JSXTransformer>, parent: GoPtr<Node>): GoPtr<Node> {
  const e = receiver!.emitResolver!.GetJsxFactoryEntity(receiver!.currentSourceFile as unknown as GoPtr<Node>);
  return JSXTransformer_createJsxPseudoFactoryExpression(receiver, parent, e, "createElement");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.createJsxFragmentFactoryExpression","kind":"method","status":"implemented","sigHash":"eef477f14fe925ed7203e644439a87ef8557bf1eb94db83eb87a360fad79731b","bodyHash":"c61c6a131ac5fe16beaf992bed0b88edfa9b7cc2fb262e91b0ceb1002d415b89"}
 *
 * Go source:
 * func (tx *JSXTransformer) createJsxFragmentFactoryExpression(parent *ast.Node) *ast.Node {
 * 	e := tx.emitResolver.GetJsxFragmentFactoryEntity(tx.currentSourceFile.AsNode())
 * 	return tx.createJsxPseudoFactoryExpression(parent, e, "Fragment")
 * }
 */
export function JSXTransformer_createJsxFragmentFactoryExpression(receiver: GoPtr<JSXTransformer>, parent: GoPtr<Node>): GoPtr<Node> {
  const e = receiver!.emitResolver!.GetJsxFragmentFactoryEntity(receiver!.currentSourceFile as unknown as GoPtr<Node>);
  return JSXTransformer_createJsxPseudoFactoryExpression(receiver, parent, e, "Fragment");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxOpeningLikeElementCreateElement","kind":"method","status":"implemented","sigHash":"5aa5881cbd88d11788e6e2386acc7e6036dee885c48cbb1e1ad117adbe99d843","bodyHash":"e928e1e7bb85e27ddc87240dbc25e2e6fb9b42427ad08718436d526ea20dddb7"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxOpeningLikeElementCreateElement(element *ast.Node, children *ast.NodeList, location core.TextRange) *ast.Node {
 * 	tagName := tx.getTagName(element)
 * 	attrs := element.Attributes().Properties()
 * 	var objectProperties *ast.Expression
 * 	if len(attrs) > 0 {
 * 		objectProperties = tx.transformJsxAttributesToObjectProps(attrs, nil)
 * 	} else {
 * 		objectProperties = tx.Factory().NewKeywordExpression(ast.KindNullKeyword) // When there are no attributes, React wants "null"
 * 	}
 * 
 * 	var callee *ast.Expression
 * 	if len(tx.importSpecifier) == 0 {
 * 		callee = tx.createJsxFactoryExpression(element)
 * 	} else {
 * 		callee = tx.getImplicitImportForName("createElement")
 * 	}
 * 
 * 	var newChildren []*ast.Node
 * 	if children != nil && len(children.Nodes) > 0 {
 * 		for _, c := range children.Nodes {
 * 			res := tx.transformJsxChildToExpression(c)
 * 			if res != nil {
 * 				newChildren = append(newChildren, res)
 * 			}
 * 		}
 * 	}
 * 
 * 	// Add StartOnNewLine flag only if there are multiple actual children (after filtering)
 * 	if len(newChildren) > 1 {
 * 		for _, child := range newChildren {
 * 			tx.EmitContext().AddEmitFlags(child, printer.EFStartOnNewLine)
 * 		}
 * 	}
 * 
 * 	args := make([]*ast.Expression, 0, len(newChildren)+2)
 * 	args = append(args, tagName)
 * 	args = append(args, objectProperties)
 * 	args = append(args, newChildren...)
 * 
 * 	result := tx.Factory().NewCallExpression(
 * 		callee,
 * 		nil,
 * 		nil,
 * 		tx.Factory().NewNodeList(args),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	result.Loc = location
 * 
 * 	if tx.inJsxChild {
 * 		tx.EmitContext().AddEmitFlags(result, printer.EFStartOnNewLine)
 * 	}
 * 	return result
 * }
 */
export function JSXTransformer_visitJsxOpeningLikeElementCreateElement(receiver: GoPtr<JSXTransformer>, element: GoPtr<Node>, children: GoPtr<NodeList>, location: TextRange): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const tagName = JSXTransformer_getTagName(receiver, element);
  const attrs = Node_Properties(Node_Attributes(element)) ?? [];
  let objectProperties: GoPtr<Expression>;
  if (attrs.length > 0) {
    objectProperties = JSXTransformer_transformJsxAttributesToObjectProps(receiver, attrs, undefined) as unknown as GoPtr<Expression>;
  } else {
    objectProperties = NewKeywordExpression(astFactory, KindNullKeyword) as unknown as GoPtr<Expression>; // When there are no attributes, React wants "null"
  }

  let callee: GoPtr<Expression>;
  if (receiver!.importSpecifier.length === 0) {
    callee = JSXTransformer_createJsxFactoryExpression(receiver, element) as unknown as GoPtr<Expression>;
  } else {
    callee = JSXTransformer_getImplicitImportForName(receiver, "createElement") as unknown as GoPtr<Expression>;
  }

  const newChildren: GoSlice<GoPtr<Node>> = [];
  if (children !== undefined && children!.Nodes.length > 0) {
    for (const c of children!.Nodes) {
      const res = JSXTransformer_transformJsxChildToExpression(receiver, c as unknown as GoPtr<Node>);
      if (res !== undefined) {
        newChildren.push(res);
      }
    }
  }

  // Add StartOnNewLine flag only if there are multiple actual children (after filtering)
  if (newChildren.length > 1) {
    for (const child of newChildren) {
      EmitContext_AddEmitFlags(emitContext, child, EFStartOnNewLine);
    }
  }

  const args: GoSlice<GoPtr<Node>> = [];
  args.push(tagName);
  args.push(objectProperties as unknown as GoPtr<Node>);
  args.push(...newChildren);

  const result = NewCallExpression(
    astFactory,
    callee as unknown as GoPtr<Node>,
    undefined,
    undefined,
    NodeFactory_NewNodeList(astFactory, args),
    NodeFlagsNone,
  );
  result!.Loc = location;

  if (receiver!.inJsxChild) {
    EmitContext_AddEmitFlags(emitContext, result as unknown as GoPtr<Node>, EFStartOnNewLine);
  }
  return result as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxOpeningFragmentCreateElement","kind":"method","status":"implemented","sigHash":"e34d68ca7a2a072a5a80c653f20618329581ac3fe489b095177582757f9bd99d","bodyHash":"5d2b9d9b6b9eaaa8fea5581de6e1d2e0425eb4ca8d4d5acf470c17ea90e29e5d"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxOpeningFragmentCreateElement(fragment *ast.JsxOpeningFragment, children *ast.NodeList, location core.TextRange) *ast.Node {
 * 	tagName := tx.createJsxFragmentFactoryExpression(fragment.AsNode())
 * 	callee := tx.createJsxFactoryExpression(fragment.AsNode())
 * 
 * 	var newChildren []*ast.Node
 * 	if children != nil && len(children.Nodes) > 0 {
 * 		for _, c := range children.Nodes {
 * 			res := tx.transformJsxChildToExpression(c)
 * 			if res != nil {
 * 				newChildren = append(newChildren, res)
 * 			}
 * 		}
 * 	}
 * 
 * 	// Add StartOnNewLine flag only if there are multiple actual children (after filtering)
 * 	if len(newChildren) > 1 {
 * 		for _, child := range newChildren {
 * 			tx.EmitContext().AddEmitFlags(child, printer.EFStartOnNewLine)
 * 		}
 * 	}
 * 
 * 	args := make([]*ast.Expression, 0, len(newChildren)+2)
 * 	args = append(args, tagName)
 * 	args = append(args, tx.Factory().NewKeywordExpression(ast.KindNullKeyword))
 * 	args = append(args, newChildren...)
 * 
 * 	result := tx.Factory().NewCallExpression(
 * 		callee,
 * 		nil,
 * 		nil,
 * 		tx.Factory().NewNodeList(args),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	result.Loc = location
 * 
 * 	if tx.inJsxChild {
 * 		tx.EmitContext().AddEmitFlags(result, printer.EFStartOnNewLine)
 * 	}
 * 	return result
 * }
 */
export function JSXTransformer_visitJsxOpeningFragmentCreateElement(receiver: GoPtr<JSXTransformer>, fragment: GoPtr<JsxOpeningFragment>, children: GoPtr<NodeList>, location: TextRange): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const tagName = JSXTransformer_createJsxFragmentFactoryExpression(receiver, fragment as unknown as GoPtr<Node>);
  const callee = JSXTransformer_createJsxFactoryExpression(receiver, fragment as unknown as GoPtr<Node>);

  const newChildren: GoSlice<GoPtr<Node>> = [];
  if (children !== undefined && children!.Nodes.length > 0) {
    for (const c of children!.Nodes) {
      const res = JSXTransformer_transformJsxChildToExpression(receiver, c as unknown as GoPtr<Node>);
      if (res !== undefined) {
        newChildren.push(res);
      }
    }
  }

  // Add StartOnNewLine flag only if there are multiple actual children (after filtering)
  if (newChildren.length > 1) {
    for (const child of newChildren) {
      EmitContext_AddEmitFlags(emitContext, child, EFStartOnNewLine);
    }
  }

  const args: GoSlice<GoPtr<Node>> = [];
  args.push(tagName);
  args.push(NewKeywordExpression(astFactory, KindNullKeyword) as unknown as GoPtr<Node>);
  args.push(...newChildren);

  const result = NewCallExpression(
    astFactory,
    callee as unknown as GoPtr<Node>,
    undefined,
    undefined,
    NodeFactory_NewNodeList(astFactory, args),
    NodeFlagsNone,
  );
  result!.Loc = location;

  if (receiver!.inJsxChild) {
    EmitContext_AddEmitFlags(emitContext, result as unknown as GoPtr<Node>, EFStartOnNewLine);
  }
  return result as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxText","kind":"method","status":"implemented","sigHash":"dcea0b5d1d62ee7eccf9d3e721415c810dd34819039e0ed4f8cd74624b8f4376","bodyHash":"7d4e840d3930a133ece20ffd6742a4d2e59f954257e7a7688a932202cc186b20"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxText(text *ast.JsxText) *ast.Node {
 * 	fixed := fixupWhitespaceAndDecodeEntities(text.Text)
 * 	if len(fixed) == 0 {
 * 		return nil
 * 	}
 * 	return tx.Factory().NewStringLiteral(fixed, ast.TokenFlagsNone)
 * }
 */
export function JSXTransformer_visitJsxText(receiver: GoPtr<JSXTransformer>, text: GoPtr<JsxText>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const fixed = fixupWhitespaceAndDecodeEntities(text!.Text);
  if (fixed.length === 0) {
    return undefined;
  }
  return NewStringLiteral(astFactory, fixed, TokenFlagsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::addLineOfJsxText","kind":"func","status":"implemented","sigHash":"8b9ec69ca75e105770ebdacaa19351647925d4ce3746b3404b453e49554feb0e","bodyHash":"fddcbfbf47283e3d1a3ed0247abd55a1a7209479445ad631cbc2f53fdef81a92"}
 *
 * Go source:
 * func addLineOfJsxText(b *strings.Builder, trimmedLine string, isInitial bool) {
 * 	// We do not escape the string here as that is handled by the printer
 * 	// when it emits the literal. We do, however, need to decode JSX entities.
 * 	decoded := decodeEntities(trimmedLine)
 * 	if !isInitial {
 * 		b.WriteString(" ")
 * 	}
 * 	b.WriteString(decoded)
 * }
 */
export function addLineOfJsxText(b: GoPtr<Builder>, trimmedLine: string, isInitial: bool): void {
  // We do not escape the string here as that is handled by the printer
  // when it emits the literal. We do, however, need to decode JSX entities.
  const decoded = decodeEntities(trimmedLine);
  if (!isInitial) {
    b!.WriteString(" ");
  }
  b!.WriteString(decoded);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::fixupWhitespaceAndDecodeEntities","kind":"func","status":"implemented","sigHash":"fcb43910d27aa4159bdedd9732075c712e12d22a52f13a46ed5fc3bae9a5cdca","bodyHash":"0cfc3eb238e50ad2a27c892d458a4f40925c01b5f1c530453a782bceeec654df"}
 *
 * Go source:
 * func fixupWhitespaceAndDecodeEntities(text string) string {
 * 	acc := &strings.Builder{}
 * 	initial := true
 * 	// First non-whitespace character on this line.
 * 	firstNonWhitespace := 0
 * 	// End byte position of the last non-whitespace character on this line.
 * 	lastNonWhitespaceEnd := -1
 * 	// These initial values are special because the first line is:
 * 	// firstNonWhitespace = 0 to indicate that we want leading whitespace,
 * 	// but lastNonWhitespaceEnd = -1 as a special flag to indicate that we *don't* include the line if it's all whitespace.
 * 	for i := 0; i < len(text); i++ {
 * 		c, size := utf8.DecodeRuneInString(text[i:])
 * 		if stringutil.IsLineBreak(c) {
 * 			// If we've seen any non-whitespace characters on this line, add the 'trim' of the line.
 * 			// (lastNonWhitespaceEnd === -1 is a special flag to detect whether the first line is all whitespace.)
 * 			if firstNonWhitespace != -1 && lastNonWhitespaceEnd != -1 {
 * 				addLineOfJsxText(acc, text[firstNonWhitespace:lastNonWhitespaceEnd+1], initial)
 * 				initial = false
 * 			}
 * 
 * 			// Reset firstNonWhitespace for the next line.
 * 			// Don't bother to reset lastNonWhitespaceEnd because we ignore it if firstNonWhitespace = -1.
 * 			firstNonWhitespace = -1
 * 		} else if !stringutil.IsWhiteSpaceSingleLine(c) {
 * 			lastNonWhitespaceEnd = i + size - 1 // Store the end byte position of the character
 * 			if firstNonWhitespace == -1 {
 * 				firstNonWhitespace = i
 * 			}
 * 		}
 * 
 * 		if size > 1 {
 * 			i += (size - 1)
 * 		}
 * 	}
 * 
 * 	if firstNonWhitespace != -1 {
 * 		// Last line had a non-whitespace character. Emit the 'trimLeft', meaning keep trailing whitespace.
 * 		addLineOfJsxText(acc, text[firstNonWhitespace:], initial)
 * 	}
 * 	return acc.String()
 * }
 */
export function fixupWhitespaceAndDecodeEntities(text: string): string {
  const acc: Builder = new Builder();
  let initial = true;
  // First non-whitespace character on this line.
  let firstNonWhitespace = 0;
  // End byte position of the last non-whitespace character on this line.
  let lastNonWhitespaceEnd = -1;
  // These initial values are special because the first line is:
  // firstNonWhitespace = 0 to indicate that we want leading whitespace,
  // but lastNonWhitespaceEnd = -1 as a special flag to indicate that we *don't* include the line if it's all whitespace.
  const textLen = byteLen(text);
  for (let i = 0; i < textLen; i++) {
    const [c, size] = DecodeRuneInStringAt(text, i);
    if (IsLineBreak(c)) {
      // If we've seen any non-whitespace characters on this line, add the 'trim' of the line.
      // (lastNonWhitespaceEnd === -1 is a special flag to detect whether the first line is all whitespace.)
      if (firstNonWhitespace !== -1 && lastNonWhitespaceEnd !== -1) {
        addLineOfJsxText(acc, byteSlice(text, firstNonWhitespace, lastNonWhitespaceEnd + 1), initial);
        initial = false;
      }

      // Reset firstNonWhitespace for the next line.
      // Don't bother to reset lastNonWhitespaceEnd because we ignore it if firstNonWhitespace = -1.
      firstNonWhitespace = -1;
    } else if (!IsWhiteSpaceSingleLine(c)) {
      lastNonWhitespaceEnd = i + size - 1; // Store the end byte position of the character
      if (firstNonWhitespace === -1) {
        firstNonWhitespace = i;
      }
    }

    if (size > 1) {
      i += size - 1;
    }
  }

  if (firstNonWhitespace !== -1) {
    // Last line had a non-whitespace character. Emit the 'trimLeft', meaning keep trailing whitespace.
    addLineOfJsxText(acc, byteSlice(text, firstNonWhitespace), initial);
  }
  return acc.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::method::JSXTransformer.visitJsxExpression","kind":"method","status":"implemented","sigHash":"16aa083d8146d82cdf8ef39a1825bdf6a10c05c98365ef2db031c15f22f23ea2","bodyHash":"b4a0734cb89f0d59c3c82adb4727a3c02c1a65b444fa0d86c82a3d7e236ddb67"}
 *
 * Go source:
 * func (tx *JSXTransformer) visitJsxExpression(expression *ast.JsxExpression) *ast.Node {
 * 	e := tx.Visitor().Visit(expression.Expression)
 * 	if expression.DotDotDotToken != nil {
 * 		return tx.Factory().NewSpreadElement(e)
 * 	}
 * 	return e
 * }
 */
export function JSXTransformer_visitJsxExpression(receiver: GoPtr<JSXTransformer>, expression: GoPtr<JsxExpression>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const e = (Transformer_Visitor(receiver!.__tsgoEmbedded0) as unknown as GoPtr<ConcreteNodeVisitor>)!.Visit(expression!.Expression as unknown as GoPtr<Node>);
  if (expression!.DotDotDotToken !== undefined) {
    return NewSpreadElement(astFactory, e);
  }
  return e;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::decodeEntities","kind":"func","status":"implemented","sigHash":"ba81d1a1c2207e3826d333a469d95b3918d58f513134444890792e50b4a023f0","bodyHash":"f8373dd13dbfbc6784c4a24bca91941922906e9d69c29599d71a94aac81eb4f1"}
 *
 * Go source:
 * func decodeEntities(text string) string {
 * 	i := strings.IndexByte(text, '&')
 * 	if i < 0 {
 * 		return text
 * 	}
 *
 * 	var result strings.Builder
 * 	result.Grow(len(text))
 * 	for {
 * 		result.WriteString(text[:i])
 * 		text = text[i:]
 *
 * 		semi := strings.IndexByte(text, ';')
 * 		if semi < 0 {
 * 			break
 * 		}
 *
 * 		// Skip past any intervening '&' characters between the current '&'
 * 		// and the ';'. Each such '&' is not part of a valid entity, so emit
 * 		// it (and any text before the next '&') as literals.
 * 		for {
 * 			nextAmp := strings.IndexByte(text[1:semi], '&')
 * 			if nextAmp < 0 {
 * 				break
 * 			}
 * 			result.WriteString(text[:nextAmp+1])
 * 			text = text[nextAmp+1:]
 * 			semi -= nextAmp + 1
 * 		}
 *
 * 		entity := text[1:semi]
 * 		decoded, ok := decodeEntity(entity)
 * 		if ok {
 * 			// Use the JS-string encoder so lone surrogates (e.g. "&#xD800;")
 * 			// are preserved rather than being lost to U+FFFD by WriteRune.
 * 			result.WriteString(stringutil.EncodeJSStringRune(decoded))
 * 		} else {
 * 			result.WriteString(text[:semi+1])
 * 		}
 * 		text = text[semi+1:]
 *
 * 		i = strings.IndexByte(text, '&')
 * 		if i < 0 {
 * 			break
 * 		}
 * 	}
 * 	result.WriteString(text)
 * 	return result.String()
 * }
 */
export function decodeEntities(text: string): string {
  let i = IndexByte(text, 0x26 /* '&' */);
  if (i < 0) {
    return text;
  }

  const result: Builder = new Builder();
  result.Grow(byteLen(text));
  let cur = text;
  for (;;) {
    result.WriteString(byteSlice(cur, 0, i));
    cur = byteSlice(cur, i);

    let semi = IndexByte(cur, 0x3b /* ';' */);
    if (semi < 0) {
      break;
    }

    // Skip past any intervening '&' characters between the current '&'
    // and the ';'. Each such '&' is not part of a valid entity, so emit
    // it (and any text before the next '&') as literals.
    for (;;) {
      const nextAmp = IndexByte(byteSlice(cur, 1, semi), 0x26 /* '&' */);
      if (nextAmp < 0) {
        break;
      }
      result.WriteString(byteSlice(cur, 0, nextAmp + 1));
      cur = byteSlice(cur, nextAmp + 1);
      semi -= nextAmp + 1;
    }

    const entity = byteSlice(cur, 1, semi);
    const [decoded, ok] = decodeEntity(entity);
    if (ok) {
      // Use the JS-string encoder so lone surrogates (e.g. "&#xD800;")
      // are preserved rather than being lost to U+FFFD by WriteRune.
      result.WriteString(EncodeJSStringRune(decoded));
    } else {
      result.WriteString(byteSlice(cur, 0, semi + 1));
    }
    cur = byteSlice(cur, semi + 1);

    i = IndexByte(cur, 0x26 /* '&' */);
    if (i < 0) {
      break;
    }
  }
  result.WriteString(cur);
  return result.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::func::decodeEntity","kind":"func","status":"implemented","sigHash":"4bb9aac76a120e8bbe20916b93f1ac0c265495822afaba8e4cc07923912ced7c","bodyHash":"94bedc7259efeeb9f316aee33ca968399723144efbb30fd68d51d8b919810646"}
 *
 * Go source:
 * func decodeEntity(entity string) (rune, bool) {
 * 	if len(entity) == 0 {
 * 		return 0, false
 * 	}
 *
 * 	if entity[0] == '#' {
 * 		entity = entity[1:]
 * 		if len(entity) == 0 {
 * 			return 0, false
 * 		}
 *
 * 		base := 10
 * 		if entity[0] == 'x' {
 * 			base = 16
 * 			entity = entity[1:]
 * 		}
 *
 * 		if len(entity) == 0 {
 * 			return 0, false
 * 		}
 *
 * 		for _, c := range entity {
 * 			if base == 16 && !stringutil.IsHexDigit(c) {
 * 				return 0, false
 * 			}
 * 			if base == 10 && !stringutil.IsDigit(c) {
 * 				return 0, false
 * 			}
 * 		}
 *
 * 		parsed, err := strconv.ParseInt(entity, base, 32)
 * 		if err != nil {
 * 			return 0, false
 * 		}
 * 		return rune(parsed), true
 * 	}
 *
 * 	r, ok := entities[entity]
 * 	return r, ok
 * }
 */
export function decodeEntity(entity: string): [GoRune, bool] {
  if (byteLen(entity) === 0) {
    return [0, false];
  }

  if (byteAt(entity, 0) === 0x23 /* '#' */) {
    let rest = byteSlice(entity, 1);
    if (byteLen(rest) === 0) {
      return [0, false];
    }

    let base = 10;
    if (byteAt(rest, 0) === 0x78 /* 'x' */) {
      base = 16;
      rest = byteSlice(rest, 1);
    }

    if (byteLen(rest) === 0) {
      return [0, false];
    }

    const restLen = byteLen(rest);
    for (let j = 0; j < restLen; ) {
      const [c, size] = DecodeRuneInStringAt(rest, j);
      if (base === 16 && !IsHexDigit(c)) {
        return [0, false];
      }
      if (base === 10 && !IsDigit(c)) {
        return [0, false];
      }
      j += size;
    }

    const [parsed, err]: [long, GoError] = ParseInt(rest, base, 32);
    if (err !== undefined) {
      return [0, false];
    }
    return [parsed as GoRune, true];
  }

  const r = entities.get(entity);
  const ok = entities.has(entity);
  return [ok ? r! : 0, ok];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/jsxtransforms/jsx.go::varGroup::entities","kind":"varGroup","status":"implemented","sigHash":"51404371608f057592af4d34bb1c92b8d1a5e5983a57acc92602ab706c0a4ca8","bodyHash":"71bd3ae041595410d72be25f78a4c529c0a344d00900e897c8275b4ce16844fb"}
 *
 * Go source:
 * var entities = map[string]rune{
 * 	"quot":     0x0022,
 * 	"amp":      0x0026,
 * 	"apos":     0x0027,
 * 	"lt":       0x003C,
 * 	"gt":       0x003E,
 * 	"nbsp":     0x00A0,
 * 	"iexcl":    0x00A1,
 * 	"cent":     0x00A2,
 * 	"pound":    0x00A3,
 * 	"curren":   0x00A4,
 * 	"yen":      0x00A5,
 * 	"brvbar":   0x00A6,
 * 	"sect":     0x00A7,
 * 	"uml":      0x00A8,
 * 	"copy":     0x00A9,
 * 	"ordf":     0x00AA,
 * 	"laquo":    0x00AB,
 * 	"not":      0x00AC,
 * 	"shy":      0x00AD,
 * 	"reg":      0x00AE,
 * 	"macr":     0x00AF,
 * 	"deg":      0x00B0,
 * 	"plusmn":   0x00B1,
 * 	"sup2":     0x00B2,
 * 	"sup3":     0x00B3,
 * 	"acute":    0x00B4,
 * 	"micro":    0x00B5,
 * 	"para":     0x00B6,
 * 	"middot":   0x00B7,
 * 	"cedil":    0x00B8,
 * 	"sup1":     0x00B9,
 * 	"ordm":     0x00BA,
 * 	"raquo":    0x00BB,
 * 	"frac14":   0x00BC,
 * 	"frac12":   0x00BD,
 * 	"frac34":   0x00BE,
 * 	"iquest":   0x00BF,
 * 	"Agrave":   0x00C0,
 * 	"Aacute":   0x00C1,
 * 	"Acirc":    0x00C2,
 * 	"Atilde":   0x00C3,
 * 	"Auml":     0x00C4,
 * 	"Aring":    0x00C5,
 * 	"AElig":    0x00C6,
 * 	"Ccedil":   0x00C7,
 * 	"Egrave":   0x00C8,
 * 	"Eacute":   0x00C9,
 * 	"Ecirc":    0x00CA,
 * 	"Euml":     0x00CB,
 * 	"Igrave":   0x00CC,
 * 	"Iacute":   0x00CD,
 * 	"Icirc":    0x00CE,
 * 	"Iuml":     0x00CF,
 * 	"ETH":      0x00D0,
 * 	"Ntilde":   0x00D1,
 * 	"Ograve":   0x00D2,
 * 	"Oacute":   0x00D3,
 * 	"Ocirc":    0x00D4,
 * 	"Otilde":   0x00D5,
 * 	"Ouml":     0x00D6,
 * 	"times":    0x00D7,
 * 	"Oslash":   0x00D8,
 * 	"Ugrave":   0x00D9,
 * 	"Uacute":   0x00DA,
 * 	"Ucirc":    0x00DB,
 * 	"Uuml":     0x00DC,
 * 	"Yacute":   0x00DD,
 * 	"THORN":    0x00DE,
 * 	"szlig":    0x00DF,
 * 	"agrave":   0x00E0,
 * 	"aacute":   0x00E1,
 * 	"acirc":    0x00E2,
 * 	"atilde":   0x00E3,
 * 	"auml":     0x00E4,
 * 	"aring":    0x00E5,
 * 	"aelig":    0x00E6,
 * 	"ccedil":   0x00E7,
 * 	"egrave":   0x00E8,
 * 	"eacute":   0x00E9,
 * 	"ecirc":    0x00EA,
 * 	"euml":     0x00EB,
 * 	"igrave":   0x00EC,
 * 	"iacute":   0x00ED,
 * 	"icirc":    0x00EE,
 * 	"iuml":     0x00EF,
 * 	"eth":      0x00F0,
 * 	"ntilde":   0x00F1,
 * 	"ograve":   0x00F2,
 * 	"oacute":   0x00F3,
 * 	"ocirc":    0x00F4,
 * 	"otilde":   0x00F5,
 * 	"ouml":     0x00F6,
 * 	"divide":   0x00F7,
 * 	"oslash":   0x00F8,
 * 	"ugrave":   0x00F9,
 * 	"uacute":   0x00FA,
 * 	"ucirc":    0x00FB,
 * 	"uuml":     0x00FC,
 * 	"yacute":   0x00FD,
 * 	"thorn":    0x00FE,
 * 	"yuml":     0x00FF,
 * 	"OElig":    0x0152,
 * 	"oelig":    0x0153,
 * 	"Scaron":   0x0160,
 * 	"scaron":   0x0161,
 * 	"Yuml":     0x0178,
 * 	"fnof":     0x0192,
 * 	"circ":     0x02C6,
 * 	"tilde":    0x02DC,
 * 	"Alpha":    0x0391,
 * 	"Beta":     0x0392,
 * 	"Gamma":    0x0393,
 * 	"Delta":    0x0394,
 * 	"Epsilon":  0x0395,
 * 	"Zeta":     0x0396,
 * 	"Eta":      0x0397,
 * 	"Theta":    0x0398,
 * 	"Iota":     0x0399,
 * 	"Kappa":    0x039A,
 * 	"Lambda":   0x039B,
 * 	"Mu":       0x039C,
 * 	"Nu":       0x039D,
 * 	"Xi":       0x039E,
 * 	"Omicron":  0x039F,
 * 	"Pi":       0x03A0,
 * 	"Rho":      0x03A1,
 * 	"Sigma":    0x03A3,
 * 	"Tau":      0x03A4,
 * 	"Upsilon":  0x03A5,
 * 	"Phi":      0x03A6,
 * 	"Chi":      0x03A7,
 * 	"Psi":      0x03A8,
 * 	"Omega":    0x03A9,
 * 	"alpha":    0x03B1,
 * 	"beta":     0x03B2,
 * 	"gamma":    0x03B3,
 * 	"delta":    0x03B4,
 * 	"epsilon":  0x03B5,
 * 	"zeta":     0x03B6,
 * 	"eta":      0x03B7,
 * 	"theta":    0x03B8,
 * 	"iota":     0x03B9,
 * 	"kappa":    0x03BA,
 * 	"lambda":   0x03BB,
 * 	"mu":       0x03BC,
 * 	"nu":       0x03BD,
 * 	"xi":       0x03BE,
 * 	"omicron":  0x03BF,
 * 	"pi":       0x03C0,
 * 	"rho":      0x03C1,
 * 	"sigmaf":   0x03C2,
 * 	"sigma":    0x03C3,
 * 	"tau":      0x03C4,
 * 	"upsilon":  0x03C5,
 * 	"phi":      0x03C6,
 * 	"chi":      0x03C7,
 * 	"psi":      0x03C8,
 * 	"omega":    0x03C9,
 * 	"thetasym": 0x03D1,
 * 	"upsih":    0x03D2,
 * 	"piv":      0x03D6,
 * 	"ensp":     0x2002,
 * 	"emsp":     0x2003,
 * 	"thinsp":   0x2009,
 * 	"zwnj":     0x200C,
 * 	"zwj":      0x200D,
 * 	"lrm":      0x200E,
 * 	"rlm":      0x200F,
 * 	"ndash":    0x2013,
 * 	"mdash":    0x2014,
 * 	"lsquo":    0x2018,
 * 	"rsquo":    0x2019,
 * 	"sbquo":    0x201A,
 * 	"ldquo":    0x201C,
 * 	"rdquo":    0x201D,
 * 	"bdquo":    0x201E,
 * 	"dagger":   0x2020,
 * 	"Dagger":   0x2021,
 * 	"bull":     0x2022,
 * 	"hellip":   0x2026,
 * 	"permil":   0x2030,
 * 	"prime":    0x2032,
 * 	"Prime":    0x2033,
 * 	"lsaquo":   0x2039,
 * 	"rsaquo":   0x203A,
 * 	"oline":    0x203E,
 * 	"frasl":    0x2044,
 * 	"euro":     0x20AC,
 * 	"image":    0x2111,
 * 	"weierp":   0x2118,
 * 	"real":     0x211C,
 * 	"trade":    0x2122,
 * 	"alefsym":  0x2135,
 * 	"larr":     0x2190,
 * 	"uarr":     0x2191,
 * 	"rarr":     0x2192,
 * 	"darr":     0x2193,
 * 	"harr":     0x2194,
 * 	"crarr":    0x21B5,
 * 	"lArr":     0x21D0,
 * 	"uArr":     0x21D1,
 * 	"rArr":     0x21D2,
 * 	"dArr":     0x21D3,
 * 	"hArr":     0x21D4,
 * 	"forall":   0x2200,
 * 	"part":     0x2202,
 * 	"exist":    0x2203,
 * 	"empty":    0x2205,
 * 	"nabla":    0x2207,
 * 	"isin":     0x2208,
 * 	"notin":    0x2209,
 * 	"ni":       0x220B,
 * 	"prod":     0x220F,
 * 	"sum":      0x2211,
 * 	"minus":    0x2212,
 * 	"lowast":   0x2217,
 * 	"radic":    0x221A,
 * 	"prop":     0x221D,
 * 	"infin":    0x221E,
 * 	"ang":      0x2220,
 * 	"and":      0x2227,
 * 	"or":       0x2228,
 * 	"cap":      0x2229,
 * 	"cup":      0x222A,
 * 	"int":      0x222B,
 * 	"there4":   0x2234,
 * 	"sim":      0x223C,
 * 	"cong":     0x2245,
 * 	"asymp":    0x2248,
 * 	"ne":       0x2260,
 * 	"equiv":    0x2261,
 * 	"le":       0x2264,
 * 	"ge":       0x2265,
 * 	"sub":      0x2282,
 * 	"sup":      0x2283,
 * 	"nsub":     0x2284,
 * 	"sube":     0x2286,
 * 	"supe":     0x2287,
 * 	"oplus":    0x2295,
 * 	"otimes":   0x2297,
 * 	"perp":     0x22A5,
 * 	"sdot":     0x22C5,
 * 	"lceil":    0x2308,
 * 	"rceil":    0x2309,
 * 	"lfloor":   0x230A,
 * 	"rfloor":   0x230B,
 * 	"lang":     0x2329,
 * 	"rang":     0x232A,
 * 	"loz":      0x25CA,
 * 	"spades":   0x2660,
 * 	"clubs":    0x2663,
 * 	"hearts":   0x2665,
 * 	"diams":    0x2666,
 * }
 */
export let entities: GoMap<string, GoRune> = new globalThis.Map<string, GoRune>([
  ["quot", 0x0022],
  ["amp", 0x0026],
  ["apos", 0x0027],
  ["lt", 0x003c],
  ["gt", 0x003e],
  ["nbsp", 0x00a0],
  ["iexcl", 0x00a1],
  ["cent", 0x00a2],
  ["pound", 0x00a3],
  ["curren", 0x00a4],
  ["yen", 0x00a5],
  ["brvbar", 0x00a6],
  ["sect", 0x00a7],
  ["uml", 0x00a8],
  ["copy", 0x00a9],
  ["ordf", 0x00aa],
  ["laquo", 0x00ab],
  ["not", 0x00ac],
  ["shy", 0x00ad],
  ["reg", 0x00ae],
  ["macr", 0x00af],
  ["deg", 0x00b0],
  ["plusmn", 0x00b1],
  ["sup2", 0x00b2],
  ["sup3", 0x00b3],
  ["acute", 0x00b4],
  ["micro", 0x00b5],
  ["para", 0x00b6],
  ["middot", 0x00b7],
  ["cedil", 0x00b8],
  ["sup1", 0x00b9],
  ["ordm", 0x00ba],
  ["raquo", 0x00bb],
  ["frac14", 0x00bc],
  ["frac12", 0x00bd],
  ["frac34", 0x00be],
  ["iquest", 0x00bf],
  ["Agrave", 0x00c0],
  ["Aacute", 0x00c1],
  ["Acirc", 0x00c2],
  ["Atilde", 0x00c3],
  ["Auml", 0x00c4],
  ["Aring", 0x00c5],
  ["AElig", 0x00c6],
  ["Ccedil", 0x00c7],
  ["Egrave", 0x00c8],
  ["Eacute", 0x00c9],
  ["Ecirc", 0x00ca],
  ["Euml", 0x00cb],
  ["Igrave", 0x00cc],
  ["Iacute", 0x00cd],
  ["Icirc", 0x00ce],
  ["Iuml", 0x00cf],
  ["ETH", 0x00d0],
  ["Ntilde", 0x00d1],
  ["Ograve", 0x00d2],
  ["Oacute", 0x00d3],
  ["Ocirc", 0x00d4],
  ["Otilde", 0x00d5],
  ["Ouml", 0x00d6],
  ["times", 0x00d7],
  ["Oslash", 0x00d8],
  ["Ugrave", 0x00d9],
  ["Uacute", 0x00da],
  ["Ucirc", 0x00db],
  ["Uuml", 0x00dc],
  ["Yacute", 0x00dd],
  ["THORN", 0x00de],
  ["szlig", 0x00df],
  ["agrave", 0x00e0],
  ["aacute", 0x00e1],
  ["acirc", 0x00e2],
  ["atilde", 0x00e3],
  ["auml", 0x00e4],
  ["aring", 0x00e5],
  ["aelig", 0x00e6],
  ["ccedil", 0x00e7],
  ["egrave", 0x00e8],
  ["eacute", 0x00e9],
  ["ecirc", 0x00ea],
  ["euml", 0x00eb],
  ["igrave", 0x00ec],
  ["iacute", 0x00ed],
  ["icirc", 0x00ee],
  ["iuml", 0x00ef],
  ["eth", 0x00f0],
  ["ntilde", 0x00f1],
  ["ograve", 0x00f2],
  ["oacute", 0x00f3],
  ["ocirc", 0x00f4],
  ["otilde", 0x00f5],
  ["ouml", 0x00f6],
  ["divide", 0x00f7],
  ["oslash", 0x00f8],
  ["ugrave", 0x00f9],
  ["uacute", 0x00fa],
  ["ucirc", 0x00fb],
  ["uuml", 0x00fc],
  ["yacute", 0x00fd],
  ["thorn", 0x00fe],
  ["yuml", 0x00ff],
  ["OElig", 0x0152],
  ["oelig", 0x0153],
  ["Scaron", 0x0160],
  ["scaron", 0x0161],
  ["Yuml", 0x0178],
  ["fnof", 0x0192],
  ["circ", 0x02c6],
  ["tilde", 0x02dc],
  ["Alpha", 0x0391],
  ["Beta", 0x0392],
  ["Gamma", 0x0393],
  ["Delta", 0x0394],
  ["Epsilon", 0x0395],
  ["Zeta", 0x0396],
  ["Eta", 0x0397],
  ["Theta", 0x0398],
  ["Iota", 0x0399],
  ["Kappa", 0x039a],
  ["Lambda", 0x039b],
  ["Mu", 0x039c],
  ["Nu", 0x039d],
  ["Xi", 0x039e],
  ["Omicron", 0x039f],
  ["Pi", 0x03a0],
  ["Rho", 0x03a1],
  ["Sigma", 0x03a3],
  ["Tau", 0x03a4],
  ["Upsilon", 0x03a5],
  ["Phi", 0x03a6],
  ["Chi", 0x03a7],
  ["Psi", 0x03a8],
  ["Omega", 0x03a9],
  ["alpha", 0x03b1],
  ["beta", 0x03b2],
  ["gamma", 0x03b3],
  ["delta", 0x03b4],
  ["epsilon", 0x03b5],
  ["zeta", 0x03b6],
  ["eta", 0x03b7],
  ["theta", 0x03b8],
  ["iota", 0x03b9],
  ["kappa", 0x03ba],
  ["lambda", 0x03bb],
  ["mu", 0x03bc],
  ["nu", 0x03bd],
  ["xi", 0x03be],
  ["omicron", 0x03bf],
  ["pi", 0x03c0],
  ["rho", 0x03c1],
  ["sigmaf", 0x03c2],
  ["sigma", 0x03c3],
  ["tau", 0x03c4],
  ["upsilon", 0x03c5],
  ["phi", 0x03c6],
  ["chi", 0x03c7],
  ["psi", 0x03c8],
  ["omega", 0x03c9],
  ["thetasym", 0x03d1],
  ["upsih", 0x03d2],
  ["piv", 0x03d6],
  ["ensp", 0x2002],
  ["emsp", 0x2003],
  ["thinsp", 0x2009],
  ["zwnj", 0x200c],
  ["zwj", 0x200d],
  ["lrm", 0x200e],
  ["rlm", 0x200f],
  ["ndash", 0x2013],
  ["mdash", 0x2014],
  ["lsquo", 0x2018],
  ["rsquo", 0x2019],
  ["sbquo", 0x201a],
  ["ldquo", 0x201c],
  ["rdquo", 0x201d],
  ["bdquo", 0x201e],
  ["dagger", 0x2020],
  ["Dagger", 0x2021],
  ["bull", 0x2022],
  ["hellip", 0x2026],
  ["permil", 0x2030],
  ["prime", 0x2032],
  ["Prime", 0x2033],
  ["lsaquo", 0x2039],
  ["rsaquo", 0x203a],
  ["oline", 0x203e],
  ["frasl", 0x2044],
  ["euro", 0x20ac],
  ["image", 0x2111],
  ["weierp", 0x2118],
  ["real", 0x211c],
  ["trade", 0x2122],
  ["alefsym", 0x2135],
  ["larr", 0x2190],
  ["uarr", 0x2191],
  ["rarr", 0x2192],
  ["darr", 0x2193],
  ["harr", 0x2194],
  ["crarr", 0x21b5],
  ["lArr", 0x21d0],
  ["uArr", 0x21d1],
  ["rArr", 0x21d2],
  ["dArr", 0x21d3],
  ["hArr", 0x21d4],
  ["forall", 0x2200],
  ["part", 0x2202],
  ["exist", 0x2203],
  ["empty", 0x2205],
  ["nabla", 0x2207],
  ["isin", 0x2208],
  ["notin", 0x2209],
  ["ni", 0x220b],
  ["prod", 0x220f],
  ["sum", 0x2211],
  ["minus", 0x2212],
  ["lowast", 0x2217],
  ["radic", 0x221a],
  ["prop", 0x221d],
  ["infin", 0x221e],
  ["ang", 0x2220],
  ["and", 0x2227],
  ["or", 0x2228],
  ["cap", 0x2229],
  ["cup", 0x222a],
  ["int", 0x222b],
  ["there4", 0x2234],
  ["sim", 0x223c],
  ["cong", 0x2245],
  ["asymp", 0x2248],
  ["ne", 0x2260],
  ["equiv", 0x2261],
  ["le", 0x2264],
  ["ge", 0x2265],
  ["sub", 0x2282],
  ["sup", 0x2283],
  ["nsub", 0x2284],
  ["sube", 0x2286],
  ["supe", 0x2287],
  ["oplus", 0x2295],
  ["otimes", 0x2297],
  ["perp", 0x22a5],
  ["sdot", 0x22c5],
  ["lceil", 0x2308],
  ["rceil", 0x2309],
  ["lfloor", 0x230a],
  ["rfloor", 0x230b],
  ["lang", 0x2329],
  ["rang", 0x232a],
  ["loz", 0x25ca],
  ["spades", 0x2660],
  ["clubs", 0x2663],
  ["hearts", 0x2665],
  ["diams", 0x2666],
]);

import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { SourceFile } from "../../ast/ast.js";
import type { ModifierList, Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import type { ClassDeclaration, ClassExpression, ParameterDeclaration } from "../../ast/generated/data.js";
import type { Expression, IdentifierNode, Statement, TokenNode } from "../../ast/generated/unions.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import type { NodeFactory } from "../../printer/factory.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::lexicalEntryKind","kind":"type","status":"implemented","sigHash":"15b8208208520c37a488f4f4ecbd5583df43ca92f4096e7e3644b1e26e32ee3f","bodyHash":"cb5c9ef2bdd53cb23eda7bf23bfa663a0beadca94c7ac4ad7393708c268dc92d"}
 *
 * Go source:
 * lexicalEntryKind int
 */
export type lexicalEntryKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::constGroup::lexicalEntryKindClass+lexicalEntryKindClassElement+lexicalEntryKindName+lexicalEntryKindOther","kind":"constGroup","status":"implemented","sigHash":"7c10f7e120828a806712afeb06f905b2b92998433acd6210a37c8e0db94870ff","bodyHash":"b9d6c17eaf140dd0f546d26897907c7061dbf7fc682728e8242938f33551f02e"}
 *
 * Go source:
 * const (
 * 	lexicalEntryKindClass lexicalEntryKind = iota
 * 	lexicalEntryKindClassElement
 * 	lexicalEntryKindName
 * 	lexicalEntryKindOther
 * )
 */
export declare const lexicalEntryKindClass: lexicalEntryKind;
export declare const lexicalEntryKindClassElement: lexicalEntryKind;
export declare const lexicalEntryKindName: lexicalEntryKind;
export declare const lexicalEntryKindOther: lexicalEntryKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::lexicalEntry","kind":"type","status":"implemented","sigHash":"7be7b19d4b29317b33f7dc2c053a3ef94da44aedf4683bb442f359b660cb3f09","bodyHash":"681e1a0d04fdec1aedb3e64033039befab3e709d7d3bb55cd7385a70b985e55e"}
 *
 * Go source:
 * lexicalEntry struct {
 * 	kind                    lexicalEntryKind
 * 	next                    *lexicalEntry
 * 	classInfoData           *classInfo
 * 	savedPendingExpressions []*ast.Expression
 * 	classThisData           *ast.IdentifierNode
 * 	classSuperData          *ast.IdentifierNode
 * 	depth                   int
 * }
 */
export interface lexicalEntry {
    kind: lexicalEntryKind;
    next: GoPtr<lexicalEntry>;
    classInfoData: GoPtr<classInfo>;
    savedPendingExpressions: GoSlice<GoPtr<Expression>>;
    classThisData: GoPtr<IdentifierNode>;
    classSuperData: GoPtr<IdentifierNode>;
    depth: int;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::memberInfo","kind":"type","status":"implemented","sigHash":"28e25d39aaf825c5e90cbd17c9b44908314ffcef8c8ae46e0eaa800de7341ebc","bodyHash":"354f246802c0607809b4f199cd898cdcee5713a76df4899230502e56d63d270e"}
 *
 * Go source:
 * memberInfo struct {
 * 	memberDecoratorsName        *ast.IdentifierNode // used in class definition step 4.a
 * 	memberInitializersName      *ast.IdentifierNode // used in class definition step 12 and constructor evaluation step 2.a
 * 	memberExtraInitializersName *ast.IdentifierNode // used in class definition step 12 and constructor evaluation step 2.b
 * 	memberDescriptorName        *ast.IdentifierNode
 * }
 */
export interface memberInfo {
    memberDecoratorsName: GoPtr<IdentifierNode>;
    memberInitializersName: GoPtr<IdentifierNode>;
    memberExtraInitializersName: GoPtr<IdentifierNode>;
    memberDescriptorName: GoPtr<IdentifierNode>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::classInfo","kind":"type","status":"implemented","sigHash":"4826cee7287a01c420b0bd76f621f844847c227d068a52555bb70710786d39c9","bodyHash":"18893e8f84f74beef60202e4f8d009c5820dc6b43d93275b26d2bfcde8c15315"}
 *
 * Go source:
 * classInfo struct {
 * 	class                                 *ast.Node
 * 	classDecoratorsName                   *ast.IdentifierNode // used in class definition step 2
 * 	classDescriptorName                   *ast.IdentifierNode // used in class definition step 10
 * 	classExtraInitializersName            *ast.IdentifierNode // used in class definition step 13
 * 	classThis                             *ast.IdentifierNode // `_classThis`, if needed.
 * 	classSuper                            *ast.IdentifierNode // `_classSuper`, if needed.
 * 	metadataReference                     *ast.IdentifierNode
 * 	memberInfos                           collections.OrderedMap[*ast.Node, *memberInfo] // used in class definition step 4.a, 12, and constructor evaluation
 * 	instanceMethodExtraInitializersName   *ast.IdentifierNode                            // used in constructor evaluation step 1
 * 	staticMethodExtraInitializersName     *ast.IdentifierNode                            // used in class definition step 11
 * 	staticNonFieldDecorationStatements    []*ast.Statement
 * 	nonStaticNonFieldDecorationStatements []*ast.Statement
 * 	staticFieldDecorationStatements       []*ast.Statement
 * 	nonStaticFieldDecorationStatements    []*ast.Statement
 * 	hasStaticInitializers                 bool
 * 	hasNonAmbientInstanceFields           bool
 * 	hasStaticPrivateClassElements         bool
 * 	pendingStaticInitializers             []*ast.Expression
 * 	pendingInstanceInitializers           []*ast.Expression
 * }
 */
export interface classInfo {
    "class": GoPtr<Node>;
    classDecoratorsName: GoPtr<IdentifierNode>;
    classDescriptorName: GoPtr<IdentifierNode>;
    classExtraInitializersName: GoPtr<IdentifierNode>;
    classThis: GoPtr<IdentifierNode>;
    classSuper: GoPtr<IdentifierNode>;
    metadataReference: GoPtr<IdentifierNode>;
    memberInfos: OrderedMap<GoPtr<Node>, GoPtr<memberInfo>>;
    instanceMethodExtraInitializersName: GoPtr<IdentifierNode>;
    staticMethodExtraInitializersName: GoPtr<IdentifierNode>;
    staticNonFieldDecorationStatements: GoSlice<GoPtr<Statement>>;
    nonStaticNonFieldDecorationStatements: GoSlice<GoPtr<Statement>>;
    staticFieldDecorationStatements: GoSlice<GoPtr<Statement>>;
    nonStaticFieldDecorationStatements: GoSlice<GoPtr<Statement>>;
    hasStaticInitializers: bool;
    hasNonAmbientInstanceFields: bool;
    hasStaticPrivateClassElements: bool;
    pendingStaticInitializers: GoSlice<GoPtr<Expression>>;
    pendingInstanceInitializers: GoSlice<GoPtr<Expression>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::esDecoratorTransformer","kind":"type","status":"implemented","sigHash":"2dc39066eaadf8edb717da9c480ca2da8426d2ed0704064e39a7d2067fb1042b","bodyHash":"3c3ae45b5946c2becb5c73cb48e6e47c39354c7e273c288cf800a3a81351d7c6"}
 *
 * Go source:
 * esDecoratorTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions                            *core.CompilerOptions
 * 	top                                        *lexicalEntry
 * 	classInfoStack                             *classInfo
 * 	classThis                                  *ast.IdentifierNode
 * 	classSuper                                 *ast.IdentifierNode
 * 	pendingExpressions                         []*ast.Expression
 * 	outerThis                                  *ast.IdentifierNode
 * 	shouldTransformPrivateStaticElementsInFile bool
 * 	outerThisVisitor                           *ast.NodeVisitor
 * 	discardedVisitor                           *ast.NodeVisitor
 * 	modifierVisitor                            *ast.NodeVisitor
 * 	exportStrippingModifierVisitor             *ast.NodeVisitor
 * 	classElementVisitor                        *ast.NodeVisitor
 * 	nonConstructorClassElementVisitor          *ast.NodeVisitor
 * 	constructorClassElementVisitor             *ast.NodeVisitor
 * 	arrayAssignmentVisitor                     *ast.NodeVisitor
 * 	objectAssignmentVisitor                    *ast.NodeVisitor
 * 	staticOnlyModifierVisitor                  *ast.NodeVisitor
 * 	asyncOnlyModifierVisitor                   *ast.NodeVisitor
 * 	accessorStrippingModifierVisitor           *ast.NodeVisitor
 * }
 */
export interface esDecoratorTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    top: GoPtr<lexicalEntry>;
    classInfoStack: GoPtr<classInfo>;
    classThis: GoPtr<IdentifierNode>;
    classSuper: GoPtr<IdentifierNode>;
    pendingExpressions: GoSlice<GoPtr<Expression>>;
    outerThis: GoPtr<IdentifierNode>;
    shouldTransformPrivateStaticElementsInFile: bool;
    outerThisVisitor: GoPtr<NodeVisitor>;
    discardedVisitor: GoPtr<NodeVisitor>;
    modifierVisitor: GoPtr<NodeVisitor>;
    exportStrippingModifierVisitor: GoPtr<NodeVisitor>;
    classElementVisitor: GoPtr<NodeVisitor>;
    nonConstructorClassElementVisitor: GoPtr<NodeVisitor>;
    constructorClassElementVisitor: GoPtr<NodeVisitor>;
    arrayAssignmentVisitor: GoPtr<NodeVisitor>;
    objectAssignmentVisitor: GoPtr<NodeVisitor>;
    staticOnlyModifierVisitor: GoPtr<NodeVisitor>;
    asyncOnlyModifierVisitor: GoPtr<NodeVisitor>;
    accessorStrippingModifierVisitor: GoPtr<NodeVisitor>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::newESDecoratorTransformer","kind":"func","status":"implemented","sigHash":"1a2210c574c651da50f43d5efe2294b77a8a71451840fe9b60161c5882154bde","bodyHash":"0fd3ac61fadb08625a156b1034e51fdd0a42931f4d29006d16de3c16958f11e1"}
 *
 * Go source:
 * func newESDecoratorTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	// When experimentalDecorators is set, the legacy decorator transformer handles all
 * 	// decorators. When targeting ESNext with useDefineForClassFields, there's nothing to
 * 	// transform. In either case every node would be returned unchanged, so skip entirely.
 * 	if opts.CompilerOptions.ExperimentalDecorators.IsTrue() ||
 * 		(opts.CompilerOptions.GetEmitScriptTarget() >= core.ScriptTargetESNext && opts.CompilerOptions.GetUseDefineForClassFields()) {
 * 		return nil
 * 	}
 * 	tx := &esDecoratorTransformer{compilerOptions: opts.CompilerOptions}
 * 	result := tx.NewTransformer(tx.visit, opts.Context)
 * 	ec := tx.EmitContext()
 * 	tx.outerThisVisitor = ec.NewNodeVisitor(tx.outerThisVisit)
 * 	tx.discardedVisitor = ec.NewNodeVisitor(tx.discardedValueVisit)
 * 	tx.modifierVisitor = ec.NewNodeVisitor(tx.modifierVisitorVisit)
 * 	tx.exportStrippingModifierVisitor = ec.NewNodeVisitor(tx.exportStrippingModifierVisit)
 * 	tx.classElementVisitor = ec.NewNodeVisitor(tx.classElementVisitorVisit)
 * 	tx.nonConstructorClassElementVisitor = ec.NewNodeVisitor(tx.nonConstructorClassElementVisit)
 * 	tx.constructorClassElementVisitor = ec.NewNodeVisitor(tx.constructorClassElementVisit)
 * 	tx.arrayAssignmentVisitor = ec.NewNodeVisitor(tx.visitArrayAssignmentElement)
 * 	tx.objectAssignmentVisitor = ec.NewNodeVisitor(tx.visitObjectAssignmentElement)
 * 	tx.staticOnlyModifierVisitor = ec.NewNodeVisitor(func(node *ast.Node) *ast.Node {
 * 		if node.Kind == ast.KindStaticKeyword {
 * 			return node
 * 		}
 * 		return nil
 * 	})
 * 	tx.asyncOnlyModifierVisitor = ec.NewNodeVisitor(func(node *ast.Node) *ast.Node {
 * 		if node.Kind == ast.KindAsyncKeyword {
 * 			return node
 * 		}
 * 		return nil
 * 	})
 * 	tx.accessorStrippingModifierVisitor = ec.NewNodeVisitor(func(node *ast.Node) *ast.Node {
 * 		if node.Kind == ast.KindAccessorKeyword {
 * 			return nil
 * 		}
 * 		return node
 * 	})
 * 	return result
 * }
 */
export declare function newESDecoratorTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.updateState","kind":"method","status":"implemented","sigHash":"f611b4e4fa3b9136cc94a1b77f521619ebbf5418d9faec261632991828006470","bodyHash":"bc7edfca67deb54c9d40b2c77d29576a32cdb8a7b8c4d8c32d1e05deaa4b47f1"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) updateState() {
 * 	tx.classInfoStack = nil
 * 	tx.classThis = nil
 * 	tx.classSuper = nil
 * 	if tx.top == nil {
 * 		return
 * 	}
 * 	switch tx.top.kind {
 * 	case lexicalEntryKindClass:
 * 		tx.classInfoStack = tx.top.classInfoData
 * 	case lexicalEntryKindClassElement:
 * 		tx.classInfoStack = tx.top.next.classInfoData
 * 		tx.classThis = tx.top.classThisData
 * 		tx.classSuper = tx.top.classSuperData
 * 	case lexicalEntryKindName:
 * 		grandparent := tx.top.next.next.next
 * 		if grandparent != nil && grandparent.kind == lexicalEntryKindClassElement {
 * 			tx.classInfoStack = grandparent.next.classInfoData
 * 			tx.classThis = grandparent.classThisData
 * 			tx.classSuper = grandparent.classSuperData
 * 		}
 * 	}
 * }
 */
export declare function esDecoratorTransformer_updateState(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.enterClass","kind":"method","status":"implemented","sigHash":"59c54ae882822caa67270bcbc8571c3ddea4af1e25ac7a5ce34451aeb0669186","bodyHash":"06b88b2094deb0da16ccde62b3dbeecd4f4ea73992221f130a312d5522e9eff2"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) enterClass(ci *classInfo) {
 * 	tx.top = &lexicalEntry{
 * 		kind:                    lexicalEntryKindClass,
 * 		next:                    tx.top,
 * 		classInfoData:           ci,
 * 		savedPendingExpressions: tx.pendingExpressions,
 * 	}
 * 	tx.pendingExpressions = nil
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_enterClass(receiver: GoPtr<esDecoratorTransformer>, ci: GoPtr<classInfo>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.exitClass","kind":"method","status":"implemented","sigHash":"f7d1d7518c72a88becd786fb35f7b2c391d2a43a9c28586cc03edbd0797405c4","bodyHash":"ba5d0d041438661a5064a96d44885f668f20295f06d995ecd4fb73ab159611fc"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) exitClass() {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindClass, "Incorrect value for top.kind. Expected top.kind to be 'class' but got '", tx.top.kind, "' instead.")
 * 	tx.pendingExpressions = tx.top.savedPendingExpressions
 * 	tx.top = tx.top.next
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_exitClass(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.enterClassElement","kind":"method","status":"implemented","sigHash":"b2cd493049882a5bb7b4aceee1533fb15d4b98d4549ed1f92674402d1e74d9f3","bodyHash":"804a9f95e3c39b39efcb959607ca0bcf6d5c591bd0ea8bff70fde849b17ea4c0"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) enterClassElement(node *ast.Node) {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindClass, "Incorrect value for top.kind. Expected top.kind to be 'class' but got '", tx.top.kind, "' instead.")
 * 	tx.top = &lexicalEntry{
 * 		kind: lexicalEntryKindClassElement,
 * 		next: tx.top,
 * 	}
 * 	if ast.IsClassStaticBlockDeclaration(node) || ast.IsPropertyDeclaration(node) && ast.HasStaticModifier(node) {
 * 		if tx.top.next.classInfoData != nil {
 * 			tx.top.classThisData = tx.top.next.classInfoData.classThis
 * 			tx.top.classSuperData = tx.top.next.classInfoData.classSuper
 * 		}
 * 	}
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_enterClassElement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.exitClassElement","kind":"method","status":"implemented","sigHash":"723f18d1ad2286d11ae52178670be55bc3df42f3149e13db11c236fcf98509df","bodyHash":"ea6bac8d11f9dda6c21d5cb15d4566b0f893930d4e82b0a3bf59a68e7e3c4c84"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) exitClassElement() {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindClassElement, "Incorrect value for top.kind. Expected top.kind to be 'class-element' but got '", tx.top.kind, "' instead.")
 * 	debug.Assert(tx.top.next != nil && tx.top.next.kind == lexicalEntryKindClass, "Incorrect value for top.next.kind. Expected top.next.kind to be 'class' but got '", tx.top.next.kind, "' instead.")
 * 	tx.top = tx.top.next
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_exitClassElement(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.enterName","kind":"method","status":"implemented","sigHash":"46d719779c183a47a4ca27b30cd89f5a90bf015b154ff711c09b180cd3582896","bodyHash":"0f22dacaaeaa1c36eefcf0af5d5ebe7e3e7e4a9cf0415fc7f504a8b74fc92bba"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) enterName() {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindClassElement, "Incorrect value for top.kind. Expected top.kind to be 'class-element' but got '", tx.top.kind, "' instead.")
 * 	tx.top = &lexicalEntry{
 * 		kind: lexicalEntryKindName,
 * 		next: tx.top,
 * 	}
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_enterName(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.exitName","kind":"method","status":"implemented","sigHash":"bca0631052cfdf78a957c41d7b5cb859f621f0b80d799b41ca7f0592306ca9cf","bodyHash":"2c7ec2681b1e76c0fb0d1319075e958d73072bdc7808776c813ac02210e0b82c"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) exitName() {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindName, "Incorrect value for top.kind. Expected top.kind to be 'name' but got '", tx.top.kind, "' instead.")
 * 	tx.top = tx.top.next
 * 	tx.updateState()
 * }
 */
export declare function esDecoratorTransformer_exitName(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.enterOther","kind":"method","status":"implemented","sigHash":"ac58d9069d8b0ecb38fee4d8b2b09ae0577e142364cbf520f50816f3c8854218","bodyHash":"53d17e5a50e3999a38065c64699001e2b98e2b0d82feb494bb3aa10d3c862d28"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) enterOther() {
 * 	if tx.top != nil && tx.top.kind == lexicalEntryKindOther {
 * 		debug.Assert(len(tx.pendingExpressions) == 0)
 * 		tx.top.depth++
 * 	} else {
 * 		tx.top = &lexicalEntry{
 * 			kind:                    lexicalEntryKindOther,
 * 			next:                    tx.top,
 * 			savedPendingExpressions: tx.pendingExpressions,
 * 		}
 * 		tx.pendingExpressions = nil
 * 		tx.updateState()
 * 	}
 * }
 */
export declare function esDecoratorTransformer_enterOther(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.exitOther","kind":"method","status":"implemented","sigHash":"19f09d348625fadb82e053d3e66db8cb37124c42fbe911e67a5f93f3fe1251a3","bodyHash":"98236d96540f256eea5a4b57019674253ec0b0347097c913274fe6092919aafb"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) exitOther() {
 * 	debug.Assert(tx.top != nil && tx.top.kind == lexicalEntryKindOther, "Incorrect value for top.kind. Expected top.kind to be 'other' but got '", tx.top.kind, "' instead.")
 * 	if tx.top.depth > 0 {
 * 		debug.Assert(len(tx.pendingExpressions) == 0)
 * 		tx.top.depth--
 * 	} else {
 * 		tx.pendingExpressions = tx.top.savedPendingExpressions
 * 		tx.top = tx.top.next
 * 		tx.updateState()
 * 	}
 * }
 */
export declare function esDecoratorTransformer_exitOther(receiver: GoPtr<esDecoratorTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"2075d87c20a8e9e840d2cd9577c4aceb07a8afa83b5cd5d68dfcb08da35024eb","bodyHash":"53f234389738750c748ad4981c99e5d897c51ac88e5e9ae2b3f761b7eb65c706"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	tx.top = nil
 * 	tx.shouldTransformPrivateStaticElementsInFile = false
 * 	visited := tx.Visitor().VisitEachChild(node.AsNode())
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	if tx.shouldTransformPrivateStaticElementsInFile {
 * 		tx.EmitContext().AddEmitFlags(visited, printer.EFTransformPrivateStaticElements)
 * 		tx.shouldTransformPrivateStaticElementsInFile = false
 * 	}
 * 	return visited
 * }
 */
export declare function esDecoratorTransformer_visitSourceFile(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.outerThisVisit","kind":"method","status":"implemented","sigHash":"e76285bf601b5e4d884ec579eb61ab09f19ec1120a324ef52767703312c1fe1d","bodyHash":"a5dd650e5779469249dceed3002b124c366c077cbdc9b45792f0978c00d88efa"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) outerThisVisit(n *ast.Node) *ast.Node {
 * 	if n.SubtreeFacts()&ast.SubtreeContainsLexicalThis == 0 && n.Kind != ast.KindThisKeyword {
 * 		return n
 * 	}
 * 	if n.Kind == ast.KindThisKeyword {
 * 		if tx.outerThis == nil {
 * 			tx.outerThis = tx.Factory().NewUniqueNameEx("_outerThis", printer.AutoGenerateOptions{
 * 				Flags: printer.GeneratedIdentifierFlagsOptimistic,
 * 			})
 * 		}
 * 		return tx.outerThis
 * 	}
 * 	return tx.outerThisVisitor.VisitEachChild(n)
 * }
 */
export declare function esDecoratorTransformer_outerThisVisit(receiver: GoPtr<esDecoratorTransformer>, n: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.shouldVisitNode","kind":"method","status":"implemented","sigHash":"5ccbd1211c97a43e54a45a6fca031230ecbb4327910373ffaf0065e083d499b0","bodyHash":"032bbe4e7a5718aace5f32727d891af1d7a7de4e9c34f7a1169eacd75fe19d35"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) shouldVisitNode(node *ast.Node) bool {
 * 	return node.SubtreeFacts()&ast.SubtreeContainsDecorators != 0 ||
 * 		(tx.classThis != nil && node.SubtreeFacts()&ast.SubtreeContainsLexicalThis != 0) ||
 * 		(tx.classThis != nil && tx.classSuper != nil && node.SubtreeFacts()&ast.SubtreeContainsLexicalSuper != 0)
 * }
 */
export declare function esDecoratorTransformer_shouldVisitNode(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visit","kind":"method","status":"implemented","sigHash":"6404da5eaf5d257d34ffc5546b58c4c33c87c2a91f3f019a027bde3428246fbc","bodyHash":"82f0fd20cfa7dad27e6383bbebb766c623db291b489406c351129a4b9803f6f4"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindSourceFile {
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	}
 * 	if !tx.shouldVisitNode(node) {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindDecorator:
 * 		// Decorators are elided. In Strada, a separate `modifierVisitor` drops decorators
 * 		// before they reach `visitor` via visitEachChild. Here, `visit` serves as both
 * 		// visitors, so decorators from modifier lists reach it directly.
 * 		return nil
 * 	case ast.KindClassDeclaration:
 * 		return tx.visitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindClassExpression:
 * 		return tx.visitClassExpression(node.AsClassExpression())
 * 	case ast.KindConstructor, ast.KindPropertyDeclaration, ast.KindClassStaticBlockDeclaration:
 * 		debug.Fail("Not supported outside of a class. Use 'classElementVisitor' instead.")
 * 		return nil
 * 	case ast.KindParameter:
 * 		return tx.visitParameterDeclaration(node.AsParameterDeclaration())
 * 	// Support NamedEvaluation to ensure the correct class name for class expressions.
 * 	case ast.KindBinaryExpression:
 * 		return tx.visitBinaryExpression(node, false /*discarded* /)
 * 	case ast.KindPropertyAssignment, ast.KindVariableDeclaration, ast.KindBindingElement:
 * 		return tx.visitNamedEvaluationSite(node, node.Initializer())
 * 	case ast.KindExportAssignment:
 * 		return tx.visitExportAssignment(node)
 * 	case ast.KindThisKeyword:
 * 		return tx.visitThisExpression(node)
 * 	case ast.KindForStatement:
 * 		return tx.visitForStatement(node)
 * 	case ast.KindExpressionStatement:
 * 		return tx.visitExpressionStatement(node)
 * 	case ast.KindParenthesizedExpression:
 * 		return tx.visitParenthesizedExpression(node, false /*discarded* /)
 * 	case ast.KindPartiallyEmittedExpression:
 * 		return tx.visitPartiallyEmittedExpression(node, false /*discarded* /)
 * 	case ast.KindCallExpression:
 * 		return tx.visitCallExpression(node)
 * 	case ast.KindTaggedTemplateExpression:
 * 		return tx.visitTaggedTemplateExpression(node)
 * 	case ast.KindPrefixUnaryExpression, ast.KindPostfixUnaryExpression:
 * 		return tx.visitPreOrPostfixUnaryExpression(node, false /*discarded* /)
 * 	case ast.KindPropertyAccessExpression:
 * 		return tx.visitPropertyAccessExpression(node)
 * 	case ast.KindElementAccessExpression:
 * 		return tx.visitElementAccessExpression(node)
 * 	case ast.KindComputedPropertyName:
 * 		return tx.visitComputedPropertyName(node)
 * 	case ast.KindMethodDeclaration,
 * 		ast.KindSetAccessor,
 * 		ast.KindGetAccessor,
 * 		ast.KindFunctionExpression,
 * 		ast.KindFunctionDeclaration:
 * 		tx.enterOther()
 * 		result := tx.Visitor().VisitEachChild(node)
 * 		tx.exitOther()
 * 		return result
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export declare function esDecoratorTransformer_visit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.modifierVisitorVisit","kind":"method","status":"implemented","sigHash":"1d5945c3cb720cd216c29b2faa1b9a128ff45adc36b777760f5c4fb652c25742","bodyHash":"9b310b9a6c6f278c1907230468c16769caae22be032ebb052ccfdcd6e54b2792"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) modifierVisitorVisit(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindDecorator {
 * 		return nil
 * 	}
 * 	return node
 * }
 */
export declare function esDecoratorTransformer_modifierVisitorVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.classElementVisitorVisit","kind":"method","status":"implemented","sigHash":"76d5c4a0d86c3f7aa71ac192f7f47aa9a3b156e2d8d215a575fc7576063f9d9c","bodyHash":"2c5682bf774279be0517815320db20db1d34acb5f9b0ddb51be773d72bf2b162"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) classElementVisitorVisit(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindConstructor:
 * 		return tx.visitConstructorDeclaration(node)
 * 	case ast.KindMethodDeclaration:
 * 		return tx.visitMethodDeclaration(node)
 * 	case ast.KindGetAccessor:
 * 		return tx.visitGetAccessorDeclaration(node)
 * 	case ast.KindSetAccessor:
 * 		return tx.visitSetAccessorDeclaration(node)
 * 	case ast.KindPropertyDeclaration:
 * 		return tx.visitPropertyDeclaration(node)
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		return tx.visitClassStaticBlockDeclaration(node)
 * 	default:
 * 		return tx.visit(node)
 * 	}
 * }
 */
export declare function esDecoratorTransformer_classElementVisitorVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.discardedValueVisit","kind":"method","status":"implemented","sigHash":"51de25c9daf6e9d3d5d54ab5fadc2480445fd1696205fc6c9f53e66594ac720d","bodyHash":"84889db45b40eb39e571006aff5d73ca382a1d28c457c34cb2924b65b59af2c0"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) discardedValueVisit(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindPrefixUnaryExpression, ast.KindPostfixUnaryExpression:
 * 		return tx.visitPreOrPostfixUnaryExpression(node, true /*discarded* /)
 * 	case ast.KindBinaryExpression:
 * 		return tx.visitBinaryExpression(node, true /*discarded* /)
 * 	case ast.KindParenthesizedExpression:
 * 		return tx.visitParenthesizedExpression(node, true /*discarded* /)
 * 	case ast.KindPartiallyEmittedExpression:
 * 		return tx.visitPartiallyEmittedExpression(node, true /*discarded* /)
 * 	default:
 * 		return tx.visit(node)
 * 	}
 * }
 */
export declare function esDecoratorTransformer_discardedValueVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.nonConstructorClassElementVisit","kind":"method","status":"implemented","sigHash":"10be0422bcddcd54a9b72b8b5c5f42a0dd49fea1491006f9cd6dcc1ec12a8146","bodyHash":"52747cf381be56022a5a3c0ec56750ecee53870347fcfa055cf4b285b12d0260"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) nonConstructorClassElementVisit(node *ast.Node) *ast.Node {
 * 	if ast.IsConstructorDeclaration(node) {
 * 		return node // skip constructors in pass 1
 * 	}
 * 	return tx.classElementVisitorVisit(node)
 * }
 */
export declare function esDecoratorTransformer_nonConstructorClassElementVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.constructorClassElementVisit","kind":"method","status":"implemented","sigHash":"c32c8b08346845f0bc1061f7c8ea558a2cccddd633139a1ca14a8b41e33feb00","bodyHash":"6386e213b64c760892b48e812f4b94ca639e1815adc3124188ae31a7bbf9a43c"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) constructorClassElementVisit(node *ast.Node) *ast.Node {
 * 	if ast.IsConstructorDeclaration(node) {
 * 		return tx.classElementVisitorVisit(node)
 * 	}
 * 	return node
 * }
 */
export declare function esDecoratorTransformer_constructorClassElementVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.exportStrippingModifierVisit","kind":"method","status":"implemented","sigHash":"c409b32115f5bdaf7e594ba06fe132341ed7b2e9cc9f754c5864cc40eeeccb27","bodyHash":"19089959a451ffaf4b51ec735f4eed40c7083f76405f642f6f8377830f7aa537"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) exportStrippingModifierVisit(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindExportKeyword {
 * 		return nil
 * 	}
 * 	return tx.modifierVisitorVisit(node)
 * }
 */
export declare function esDecoratorTransformer_exportStrippingModifierVisit(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::getHelperVariableName","kind":"func","status":"implemented","sigHash":"79431dcc1c1ea7bdabc1fefe7b8552a65d6f425a3395a7cd1c4da2032b5baf48","bodyHash":"87ce8c3fa1f533474f3c1e1e9c19402febf299f38a4a9489757aeb8dce910317"}
 *
 * Go source:
 * func getHelperVariableName(ec *printer.EmitContext, node *ast.Node) string {
 * 	name := node.Name()
 * 	declarationName := ""
 * 	switch {
 * 	case name != nil && ast.IsIdentifier(name) && !transformers.IsGeneratedIdentifier(ec, name):
 * 		declarationName = name.Text()
 * 	case name != nil && ast.IsPrivateIdentifier(name) && !ec.HasAutoGenerateInfo(name):
 * 		if text := name.Text(); len(text) > 1 {
 * 			declarationName = text[1:]
 * 		}
 * 	case name != nil && ast.IsStringLiteral(name) && scanner.IsIdentifierText(name.Text(), core.LanguageVariantStandard):
 * 		declarationName = name.Text()
 * 	case ast.IsClassLike(node):
 * 		declarationName = "class"
 * 	default:
 * 		declarationName = "member"
 * 	}
 *
 * 	if ast.IsGetAccessorDeclaration(node) {
 * 		declarationName = "get_" + declarationName
 * 	}
 * 	if ast.IsSetAccessorDeclaration(node) {
 * 		declarationName = "set_" + declarationName
 * 	}
 * 	if name != nil && ast.IsPrivateIdentifier(name) {
 * 		declarationName = "private_" + declarationName
 * 	}
 * 	if ast.IsStatic(node) {
 * 		declarationName = "static_" + declarationName
 * 	}
 * 	return "_" + declarationName
 * }
 */
export declare function getHelperVariableName(ec: GoPtr<EmitContext>, node: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createHelperVariable","kind":"method","status":"implemented","sigHash":"1385615178b8801eb22b02f2b451449522aa5581c7e1ef63e35cbf6ea8885680","bodyHash":"5ac8b9a348407bd9d012f6a4301c5f40398d2441cec741ff34ce6317a948fa29"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createHelperVariable(node *ast.Node, suffix string) *ast.IdentifierNode {
 * 	return tx.Factory().NewUniqueNameEx(
 * 		getHelperVariableName(tx.EmitContext(), node)+"_"+suffix,
 * 		printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsReservedInNestedScopes},
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createHelperVariable(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createLet","kind":"method","status":"implemented","sigHash":"da0ea479f9854004fb685f70f0a6994c12c56c518b987036019961699b25c198","bodyHash":"0ae8d870669ca83791d8b482e5e9a1d38686ca959f6e95888c721201b68c6bff"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createLet(name *ast.IdentifierNode, initializer *ast.Expression) *ast.Statement {
 * 	return tx.Factory().NewVariableStatement(
 * 		nil,
 * 		tx.Factory().NewVariableDeclarationList(
 * 			tx.Factory().NewNodeList([]*ast.Node{
 * 				tx.Factory().NewVariableDeclaration(name, nil, nil, initializer),
 * 			}),
 * 			ast.NodeFlagsLet,
 * 		),
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createLet(receiver: GoPtr<esDecoratorTransformer>, name: GoPtr<IdentifierNode>, initializer: GoPtr<Expression>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createClassInfo","kind":"method","status":"implemented","sigHash":"00779fa947a2ae59d9ca3c0e54d98c83bd71652d1be437977440083d6ea9daa7","bodyHash":"bc4918b1ba75a8850be41ce4f02d1b971cf9076f829deeb01cf7d4730ab82a94"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createClassInfo(node *ast.Node) *classInfo {
 * 	f := tx.Factory()
 * 	ci := &classInfo{
 * 		class: node,
 * 		metadataReference: f.NewUniqueNameEx("_metadata", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		}),
 * 	}
 *
 * 	// Before visiting we perform a first pass to collect information we'll need
 * 	// as we descend.
 *
 * 	// If the class itself is decorated, create a _classThis binding
 * 	if ast.NodeIsDecorated(false, node, nil, nil) {
 * 		needsUniqueClassThis := core.Some(node.Members(), func(member *ast.Node) bool {
 * 			return (ast.IsPrivateIdentifierClassElementDeclaration(member) || ast.IsAutoAccessorPropertyDeclaration(member)) && ast.HasStaticModifier(member)
 * 		})
 * 		// We do not mark _classThis as FileLevel if it may be reused by class private fields, which requires the
 * 		// ability access the captured `_classThis` of outer scopes.
 * 		var flags printer.GeneratedIdentifierFlags = printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel
 * 		if needsUniqueClassThis {
 * 			flags = printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsReservedInNestedScopes
 * 		}
 * 		ci.classThis = f.NewUniqueNameEx("_classThis", printer.AutoGenerateOptions{Flags: flags})
 * 	}
 *
 * 	for _, member := range node.Members() {
 * 		if ast.IsMethodOrAccessor(member) && ast.NodeOrChildIsDecorated(false, member, node, nil) {
 * 			if ast.HasStaticModifier(member) {
 * 				if ci.staticMethodExtraInitializersName == nil {
 * 					ci.staticMethodExtraInitializersName = f.NewUniqueNameEx("_staticExtraInitializers", printer.AutoGenerateOptions{
 * 						Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 					})
 * 					var renamedClassThis *ast.Node
 * 					if ci.classThis != nil {
 * 						renamedClassThis = ci.classThis
 * 					} else {
 * 						renamedClassThis = f.NewThisExpression()
 * 					}
 * 					initializer := f.NewRunInitializersHelper(renamedClassThis, ci.staticMethodExtraInitializersName, nil)
 * 					nameRange := node.Name()
 * 					if nameRange != nil {
 * 						tx.EmitContext().SetSourceMapRange(initializer, nameRange.Loc)
 * 					} else {
 * 						tx.EmitContext().SetSourceMapRange(initializer, transformers.MoveRangePastDecorators(node))
 * 					}
 * 					ci.pendingStaticInitializers = append(ci.pendingStaticInitializers, initializer)
 * 				}
 * 			} else {
 * 				if ci.instanceMethodExtraInitializersName == nil {
 * 					ci.instanceMethodExtraInitializersName = f.NewUniqueNameEx("_instanceExtraInitializers", printer.AutoGenerateOptions{
 * 						Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 					})
 * 					initializer := f.NewRunInitializersHelper(f.NewThisExpression(), ci.instanceMethodExtraInitializersName, nil)
 * 					nameRange := node.Name()
 * 					if nameRange != nil {
 * 						tx.EmitContext().SetSourceMapRange(initializer, nameRange.Loc)
 * 					} else {
 * 						tx.EmitContext().SetSourceMapRange(initializer, transformers.MoveRangePastDecorators(node))
 * 					}
 * 					ci.pendingInstanceInitializers = append(ci.pendingInstanceInitializers, initializer)
 * 				}
 * 			}
 * 		}
 *
 * 		if ast.IsClassStaticBlockDeclaration(member) {
 * 			if !isClassNamedEvaluationHelperBlock(tx.EmitContext(), member) {
 * 				ci.hasStaticInitializers = true
 * 			}
 * 		} else if ast.IsPropertyDeclaration(member) {
 * 			if ast.HasStaticModifier(member) {
 * 				ci.hasStaticInitializers = ci.hasStaticInitializers || member.Initializer() != nil || ast.HasDecorators(member)
 * 			} else {
 * 				ci.hasNonAmbientInstanceFields = ci.hasNonAmbientInstanceFields || !ast.HasSyntacticModifier(member, ast.ModifierFlagsAmbient)
 * 			}
 * 		}
 *
 * 		if (ast.IsPrivateIdentifierClassElementDeclaration(member) || ast.IsAutoAccessorPropertyDeclaration(member)) && ast.HasStaticModifier(member) {
 * 			ci.hasStaticPrivateClassElements = true
 * 		}
 *
 * 		// exit early if possible
 * 		if ci.staticMethodExtraInitializersName != nil &&
 * 			ci.instanceMethodExtraInitializersName != nil &&
 * 			ci.hasStaticInitializers &&
 * 			ci.hasNonAmbientInstanceFields &&
 * 			ci.hasStaticPrivateClassElements {
 * 			break
 * 		}
 * 	}
 *
 * 	return ci
 * }
 */
export declare function esDecoratorTransformer_createClassInfo(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<classInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.transformClassLike","kind":"method","status":"implemented","sigHash":"9d0b0bdcbb628f7415cd7913cb3016846984c225e1e42279f9fbf579a863ca3d","bodyHash":"9c1b46d090b20724db38a729c8d7f48c9468a501c4888d8672a88ceba4c897a5"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) transformClassLike(node *ast.Node) *ast.Expression {
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 *
 * 	ec.StartVariableEnvironment()
 *
 * 	// When a class has class decorators we end up transforming it into a statement that would otherwise give it an
 * 	// assigned name. If the class doesn't have an assigned name, we'll give it an assigned name of `""`.
 * 	if !classHasDeclaredOrExplicitlyAssignedName(ec, node) && ast.ClassOrConstructorParameterIsDecorated(false, node) {
 * 		node = injectClassNamedEvaluationHelperBlockIfMissing(ec, node, f.NewStringLiteral("", 0), nil)
 * 	}
 *
 * 	classReference := f.GetLocalNameEx(node, printer.AssignedNameOptions{})
 * 	ci := tx.createClassInfo(node)
 * 	classDefinitionStatements := []*ast.Statement{}
 * 	var leadingBlockStatements []*ast.Statement
 * 	var trailingBlockStatements []*ast.Statement
 * 	var syntheticConstructor *ast.Node
 * 	var heritageClauses *ast.NodeList
 * 	shouldTransformPrivateStaticElementsInClass := false
 *
 * 	// 1. Class decorators are evaluated outside the private name scope of the class.
 * 	//
 * 	// - Since class decorators don't have privileged access to private names defined inside the class,
 * 	//   they must be evaluated outside of the class body.
 * 	// - Since a class decorator can replace the class constructor, we must define a variable to keep track
 * 	//   of the mutated class.
 * 	// - Since a class decorator can add extra initializers, we must define a variable to keep track of
 * 	//   extra initializers.
 * 	classDecorators := tx.transformAllDecoratorsOfDeclaration(node.Decorators())
 * 	if len(classDecorators) > 0 {
 * 		debug.Assert(ci.classThis != nil)
 *
 * 		ci.classDecoratorsName = f.NewUniqueNameEx("_classDecorators", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		})
 * 		ci.classDescriptorName = f.NewUniqueNameEx("_classDescriptor", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		})
 * 		ci.classExtraInitializersName = f.NewUniqueNameEx("_classExtraInitializers", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		})
 *
 * 		decoratorsArray := f.NewArrayLiteralExpression(
 * 			f.NewNodeList(classDecorators),
 * 			false,
 * 		)
 * 		classDefinitionStatements = append(classDefinitionStatements,
 * 			tx.createLet(ci.classDecoratorsName, decoratorsArray),
 * 			tx.createLet(ci.classDescriptorName, nil),
 * 			tx.createLet(ci.classExtraInitializersName, f.NewArrayLiteralExpression(f.NewNodeList(nil), false)),
 * 			tx.createLet(ci.classThis, nil),
 * 		)
 *
 * 		if len(classDecorators) > 0 && ci.hasStaticPrivateClassElements {
 * 			shouldTransformPrivateStaticElementsInClass = true
 * 			tx.shouldTransformPrivateStaticElementsInFile = true
 * 		}
 * 	}
 *
 * 	// 2. ClassHeritage clause is evaluated outside of the private name scope of the class.
 * 	extendsClause := ast.GetHeritageClause(node, ast.KindExtendsKeyword)
 * 	var extendsElement *ast.Node
 * 	if extendsClause != nil {
 * 		hc := extendsClause.AsHeritageClause()
 * 		if hc.Types != nil && len(hc.Types.Nodes) > 0 {
 * 			extendsElement = hc.Types.Nodes[0]
 * 		}
 * 	}
 * 	var extendsExpression *ast.Expression
 * 	if extendsElement != nil {
 * 		extendsExpression = tx.Visitor().VisitNode(extendsElement.AsExpressionWithTypeArguments().Expression)
 * 	}
 *
 * 	if extendsExpression != nil {
 * 		// Rewrite `super` in static initializers so that we can use the correct `this`.
 * 		ci.classSuper = f.NewUniqueNameEx("_classSuper", printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel,
 * 		})
 *
 * 		// Ensure we do not give the class or function an assigned name due to the variable by prefixing it
 * 		// with `0, `.
 * 		unwrapped := ast.SkipOuterExpressions(extendsExpression, ast.OEKAll)
 * 		safeExtendsExpression := extendsExpression
 * 		if (ast.IsClassExpression(unwrapped) && unwrapped.Name() == nil) ||
 * 			(ast.IsFunctionExpression(unwrapped) && unwrapped.Name() == nil) ||
 * 			ast.IsArrowFunction(unwrapped) {
 * 			safeExtendsExpression = f.NewCommaExpression(
 * 				f.NewNumericLiteral("0", 0),
 * 				extendsExpression,
 * 			)
 * 		}
 * 		classDefinitionStatements = append(classDefinitionStatements, tx.createLet(ci.classSuper, safeExtendsExpression))
 *
 * 		updatedExtendsElement := f.UpdateExpressionWithTypeArguments(extendsElement.AsExpressionWithTypeArguments(), ci.classSuper, nil)
 * 		hc := extendsClause.AsHeritageClause()
 * 		updatedExtendsClause := f.UpdateHeritageClause(hc, hc.Token, f.NewNodeList([]*ast.Node{updatedExtendsElement}))
 * 		heritageClauses = f.NewNodeList([]*ast.Node{updatedExtendsClause})
 * 	}
 *
 * 	var renamedClassThis *ast.Node
 * 	if ci.classThis != nil {
 * 		renamedClassThis = ci.classThis
 * 	} else {
 * 		renamedClassThis = f.NewThisExpression()
 * 	}
 *
 * 	// 3. The name of the class is assigned.
 * 	//
 * 	// If the class did not have a name, the caller should have performed injectClassNamedEvaluationHelperBlockIfMissing
 * 	// prior to calling this function if a name was needed.
 *
 * 	// 4. For each member:
 * 	//    a. Member Decorators are evaluated
 * 	//    b. Computed Property Name is evaluated, if present
 * 	//
 * 	// We visit members in two passes:
 * 	// - The first pass visits methods, accessors, and fields to collect decorators and computed property names.
 * 	// - The second pass visits the constructor to add instance initializers.
 * 	//
 * 	// NOTE: If there are no constructors, but there are instance initializers, a synthetic constructor is added.
 * 	tx.enterClass(ci)
 *
 * 	leadingBlockStatements = append(leadingBlockStatements, tx.createMetadata(ci.metadataReference, ci.classSuper))
 *
 * 	// Since the constructor can appear anywhere in the class body and its transform depends on other class elements,
 * 	// we must first visit all non-constructor members, then visit the constructor, all while maintaining document order.
 * 	members := tx.nonConstructorClassElementVisitor.VisitNodes(node.MemberList())
 * 	members = tx.constructorClassElementVisitor.VisitNodes(members)
 *
 * 	// Handle pending expressions (computed property names and decorator evaluations)
 * 	if len(tx.pendingExpressions) > 0 {
 * 		// If a pending expression contains a lexical `this`, we'll need to capture the lexical `this` of the
 * 		// container and transform it in the expression. This ensures we use the correct `this` in the resulting
 * 		// class `static` block. We don't use substitution here because the size of the tree we are visiting
 * 		// is likely to be small and doesn't justify the complexity of introducing substitution.
 * 		tx.outerThis = nil
 * 		for _, expr := range tx.pendingExpressions {
 * 			// If a pending expression contains lexical `this`, capture it
 * 			if expr.SubtreeFacts()&ast.SubtreeContainsLexicalThis != 0 {
 * 				expr = tx.outerThisVisitor.VisitNode(expr)
 * 			}
 * 			statement := f.NewExpressionStatement(expr)
 * 			leadingBlockStatements = append(leadingBlockStatements, statement)
 * 		}
 * 		if tx.outerThis != nil {
 * 			classDefinitionStatements = append(
 * 				[]*ast.Statement{tx.createLet(tx.outerThis, f.NewThisExpression())},
 * 				classDefinitionStatements...,
 * 			)
 * 		}
 * 		tx.pendingExpressions = nil
 * 	}
 * 	tx.exitClass()
 *
 * 	// If there are instance initializers but no constructor, synthesize one
 * 	if len(ci.pendingInstanceInitializers) > 0 && ast.GetFirstConstructorWithBody(node) == nil {
 * 		initializerStatements := tx.prepareConstructor(ci)
 * 		if len(initializerStatements) > 0 {
 * 			isDerivedClass := extendsElement != nil && ast.SkipOuterExpressions(extendsElement.AsExpressionWithTypeArguments().Expression, ast.OEKAll).Kind != ast.KindNullKeyword
 * 			constructorStatements := []*ast.Statement{}
 * 			if isDerivedClass {
 * 				spreadArguments := f.NewSpreadElement(f.NewIdentifier("arguments"))
 * 				superCall := f.NewCallExpression(f.NewKeywordExpression(ast.KindSuperKeyword), nil, nil, f.NewNodeList([]*ast.Expression{spreadArguments}), ast.NodeFlagsNone)
 * 				constructorStatements = append(constructorStatements, f.NewExpressionStatement(superCall))
 * 			}
 * 			constructorStatements = append(constructorStatements, initializerStatements...)
 * 			constructorBody := f.NewBlock(f.NewNodeList(constructorStatements), true)
 * 			syntheticConstructor = f.NewConstructorDeclaration(nil, nil, f.NewNodeList(nil), nil, nil, constructorBody)
 * 		}
 * 	}
 *
 * 	// Used in class definition steps 5,7,11
 * 	if ci.staticMethodExtraInitializersName != nil {
 * 		classDefinitionStatements = append(classDefinitionStatements,
 * 			tx.createLet(ci.staticMethodExtraInitializersName, f.NewArrayLiteralExpression(f.NewNodeList(nil), false)),
 * 		)
 * 	}
 *
 * 	// Used in class definition steps 6,8, and construction
 * 	if ci.instanceMethodExtraInitializersName != nil {
 * 		classDefinitionStatements = append(classDefinitionStatements,
 * 			tx.createLet(ci.instanceMethodExtraInitializersName, f.NewArrayLiteralExpression(f.NewNodeList(nil), false)),
 * 		)
 * 	}
 *
 * 	// Used in class definition steps 7, 8, 12, and construction.
 * 	// Emit member info variable declarations; the reference implementation emits static member vars first, then non-static.
 * 	if ci.memberInfos.Size() > 0 {
 * 		classDefinitionStatements = append(classDefinitionStatements, tx.emitMemberInfoDeclarations(ci, true /*isStatic* /)...)
 * 		classDefinitionStatements = append(classDefinitionStatements, tx.emitMemberInfoDeclarations(ci, false /*isStatic* /)...)
 * 	}
 *
 * 	// 5. Static non-field element decorators are applied
 * 	leadingBlockStatements = append(leadingBlockStatements, ci.staticNonFieldDecorationStatements...)
 *
 * 	// 6. Non-static non-field element decorators are applied
 * 	leadingBlockStatements = append(leadingBlockStatements, ci.nonStaticNonFieldDecorationStatements...)
 *
 * 	// 7. Static field element decorators are applied
 * 	leadingBlockStatements = append(leadingBlockStatements, ci.staticFieldDecorationStatements...)
 *
 * 	// 8. Non-static field element decorators are applied
 * 	leadingBlockStatements = append(leadingBlockStatements, ci.nonStaticFieldDecorationStatements...)
 *
 * 	// 9. Class decorators are applied
 * 	// 10. Class binding is initialized
 * 	//
 * 	// produces:
 * 	//   __esDecorate(null, _classDescriptor = { value: this }, _classDecorators, { kind: "class", name: this.name, metadata }, null, _classExtraInitializers);
 * 	if ci.classDescriptorName != nil && ci.classDecoratorsName != nil && ci.classExtraInitializersName != nil && ci.classThis != nil {
 * 		valueProperty := f.NewPropertyAssignment(nil, f.NewIdentifier("value"), nil, nil, renamedClassThis)
 * 		classDescriptor := f.NewObjectLiteralExpression(f.NewNodeList([]*ast.Node{valueProperty}), false)
 * 		classDescriptorAssignment := f.NewAssignmentExpression(ci.classDescriptorName, classDescriptor)
 * 		classNameReference := f.NewPropertyAccessExpression(renamedClassThis, nil, f.NewIdentifier("name"), ast.NodeFlagsNone)
 *
 * 		contextObj := f.NewESDecorateClassContextObject(classNameReference, ci.metadataReference)
 *
 * 		esDecorateHelper := f.NewESDecorateHelper(
 * 			f.NewToken(ast.KindNullKeyword),
 * 			classDescriptorAssignment,
 * 			ci.classDecoratorsName,
 * 			contextObj,
 * 			f.NewToken(ast.KindNullKeyword),
 * 			ci.classExtraInitializersName,
 * 		)
 * 		esDecorateStatement := f.NewExpressionStatement(esDecorateHelper)
 * 		ec.SetSourceMapRange(esDecorateStatement, transformers.MoveRangePastDecorators(node))
 * 		leadingBlockStatements = append(leadingBlockStatements, esDecorateStatement)
 *
 * 		// produces:
 * 		//   C = _classThis = _classDescriptor.value;
 * 		classDescriptorValueRef := f.NewPropertyAccessExpression(ci.classDescriptorName, nil, f.NewIdentifier("value"), ast.NodeFlagsNone)
 * 		classThisAssignment := f.NewAssignmentExpression(ci.classThis, classDescriptorValueRef)
 * 		classReferenceAssignment := f.NewAssignmentExpression(classReference, classThisAssignment)
 * 		leadingBlockStatements = append(leadingBlockStatements, f.NewExpressionStatement(classReferenceAssignment))
 * 	}
 *
 * 	// produces:
 * 	//   if (metadata) Object.defineProperty(C, Symbol.metadata, { configurable: true, writable: true, value: metadata });
 * 	leadingBlockStatements = append(leadingBlockStatements, tx.createSymbolMetadata(renamedClassThis, ci.metadataReference))
 *
 * 	// 11. Static extra initializers
 * 	// 12. Static fields are initialized
 * 	if len(ci.pendingStaticInitializers) > 0 {
 * 		for _, initializer := range ci.pendingStaticInitializers {
 * 			initializerStatement := f.NewExpressionStatement(initializer)
 * 			ec.SetSourceMapRange(initializerStatement, ec.SourceMapRange(initializer))
 * 			trailingBlockStatements = append(trailingBlockStatements, initializerStatement)
 * 		}
 * 		ci.pendingStaticInitializers = nil
 * 	}
 *
 * 	// 13. Class extra initializers
 * 	if ci.classExtraInitializersName != nil {
 * 		runClassInitializersHelper := f.NewRunInitializersHelper(renamedClassThis, ci.classExtraInitializersName, nil)
 * 		runClassInitializersStatement := f.NewExpressionStatement(runClassInitializersHelper)
 * 		if node.Name() != nil {
 * 			ec.SetSourceMapRange(runClassInitializersStatement, node.Name().Loc)
 * 		} else {
 * 			ec.SetSourceMapRange(runClassInitializersStatement, transformers.MoveRangePastDecorators(node))
 * 		}
 * 		trailingBlockStatements = append(trailingBlockStatements, runClassInitializersStatement)
 * 	}
 *
 * 	// If there are no other static initializers to run, combine the leading and trailing block statements
 * 	if len(leadingBlockStatements) > 0 && len(trailingBlockStatements) > 0 && !ci.hasStaticInitializers {
 * 		leadingBlockStatements = append(leadingBlockStatements, trailingBlockStatements...)
 * 		trailingBlockStatements = nil
 * 	}
 *
 * 	// prepare a leading `static {}` block, if necessary
 * 	//
 * 	// produces:
 * 	//   class C {
 * 	//       static { ... }
 * 	//       ...
 * 	//   }
 * 	var leadingStaticBlock *ast.Node
 * 	if len(leadingBlockStatements) > 0 {
 * 		leadingStaticBlock = f.NewClassStaticBlockDeclaration(
 * 			nil,
 * 			f.NewBlock(f.NewNodeList(leadingBlockStatements), true),
 * 		)
 * 	}
 *
 * 	if leadingStaticBlock != nil && shouldTransformPrivateStaticElementsInClass {
 * 		// We use EFTransformPrivateStaticElements as a marker on a class static block
 * 		// to inform the classFields transform that it shouldn't rename `this` to `_classThis` in the
 * 		// transformed class static block.
 * 		ec.SetEmitFlags(leadingStaticBlock, printer.EFTransformPrivateStaticElements)
 * 	}
 *
 * 	// prepare a trailing `static {}` block, if necessary
 * 	//
 * 	// produces:
 * 	//   class C {
 * 	//       ...
 * 	//       static { ... }
 * 	//   }
 * 	var trailingStaticBlock *ast.Node
 * 	if len(trailingBlockStatements) > 0 {
 * 		trailingStaticBlock = f.NewClassStaticBlockDeclaration(
 * 			nil,
 * 			f.NewBlock(f.NewNodeList(trailingBlockStatements), true),
 * 		)
 * 	}
 *
 * 	// Assemble new members list
 * 	if leadingStaticBlock != nil || syntheticConstructor != nil || trailingStaticBlock != nil {
 * 		newMembers := make([]*ast.Node, 0, len(members.Nodes)+3)
 *
 * 		// Find the existing NamedEvaluation helper block index
 * 		existingNamedEvaluationHelperBlockIndex := -1
 * 		for i, m := range members.Nodes {
 * 			if isClassNamedEvaluationHelperBlock(ec, m) {
 * 				existingNamedEvaluationHelperBlockIndex = i
 * 				break
 * 			}
 * 		}
 *
 * 		// add the leading `static {}` block
 * 		if leadingStaticBlock != nil {
 * 			// add the `static {}` block after any existing NamedEvaluation helper block, if one exists.
 * 			newMembers = append(newMembers, members.Nodes[:existingNamedEvaluationHelperBlockIndex+1]...)
 * 			newMembers = append(newMembers, leadingStaticBlock)
 * 			newMembers = append(newMembers, members.Nodes[existingNamedEvaluationHelperBlockIndex+1:]...)
 * 		} else {
 * 			newMembers = append(newMembers, members.Nodes...)
 * 		}
 *
 * 		// append the synthetic constructor, if necessary
 * 		if syntheticConstructor != nil {
 * 			newMembers = append(newMembers, syntheticConstructor)
 * 		}
 *
 * 		// append a trailing `static {}` block, if necessary
 * 		if trailingStaticBlock != nil {
 * 			newMembers = append(newMembers, trailingStaticBlock)
 * 		}
 *
 * 		membersList := f.NewNodeList(newMembers)
 * 		membersList.Loc = members.Loc
 * 		members = membersList
 * 	}
 *
 * 	lexicalEnvironment := ec.EndVariableEnvironment()
 *
 * 	var classExpression *ast.Node
 * 	if len(classDecorators) > 0 {
 * 		classExpression = f.NewClassExpression(nil, nil, nil, heritageClauses, members)
 * 		ec.SetOriginal(classExpression, node)
 * 		if ci.classThis != nil {
 * 			classExpression = injectClassThisAssignmentIfMissing(ec, f, classExpression, ci.classThis)
 * 		}
 *
 * 		// We use `var` instead of `let` so we can leverage NamedEvaluation to define the class name
 * 		// and still be able to ensure it is initialized prior to any use in `static {}`.
 *
 * 		// produces:
 * 		//   (() => {
 * 		//       let _classDecorators = [...];
 * 		//       let _classDescriptor;
 * 		//       let _classExtraInitializers = [];
 * 		//       let _classThis;
 * 		//       ...
 * 		//       var C = class {
 * 		//           static {
 * 		//               __esDecorate(null, _classDescriptor = { value: this }, _classDecorators, ...);
 * 		//               C = _classThis = _classDescriptor.value;
 * 		//           }
 * 		//           static x = 1;
 * 		//           static y = C.x; // `C` will already be defined here.
 * 		//           static { ... }
 * 		//       };
 * 		//       return C;
 * 		//   })();
 *
 * 		classReferenceDeclaration := f.NewVariableDeclaration(classReference, nil, nil, classExpression)
 * 		classReferenceVarDeclList := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{classReferenceDeclaration}), ast.NodeFlagsNone)
 * 		var returnExpr *ast.Expression
 * 		if ci.classThis != nil {
 * 			returnExpr = f.NewAssignmentExpression(classReference, ci.classThis)
 * 		} else {
 * 			returnExpr = classReference
 * 		}
 * 		classDefinitionStatements = append(classDefinitionStatements,
 * 			f.NewVariableStatement(nil, classReferenceVarDeclList),
 * 			f.NewReturnStatement(returnExpr),
 * 		)
 * 	} else {
 * 		// produces:
 * 		//   return <classExpression>;
 * 		classExpression = f.NewClassExpression(nil, node.Name(), nil, heritageClauses, members)
 * 		ec.SetOriginal(classExpression, node)
 * 		classDefinitionStatements = append(classDefinitionStatements, f.NewReturnStatement(classExpression))
 * 	}
 *
 * 	if shouldTransformPrivateStaticElementsInClass {
 * 		ec.AddEmitFlags(classExpression, printer.EFTransformPrivateStaticElements)
 * 		for _, member := range classExpression.Members() {
 * 			if (ast.IsPrivateIdentifierClassElementDeclaration(member) || ast.IsAutoAccessorPropertyDeclaration(member)) && ast.HasStaticModifier(member) {
 * 				ec.AddEmitFlags(member, printer.EFTransformPrivateStaticElements)
 * 			}
 * 		}
 * 	}
 *
 * 	mergedStatements := ec.MergeEnvironment(classDefinitionStatements, lexicalEnvironment)
 * 	return f.NewImmediatelyInvokedArrowFunction(mergedStatements)
 * }
 */
export declare function esDecoratorTransformer_transformClassLike(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.emitMemberInfoDeclarations","kind":"method","status":"implemented","sigHash":"a8e72cd9e40df1cefb53fa81befb34f539521ae4ea0b664e5b5dead9e387e98c","bodyHash":"858aeb9fca609a4559b3bf29dfe2799ef52841c2731f347774f0176913647ec9"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) emitMemberInfoDeclarations(ci *classInfo, isStatic bool) []*ast.Statement {
 * 	f := tx.Factory()
 * 	var stmts []*ast.Statement
 * 	for member, mi := range ci.memberInfos.Entries() {
 * 		if ast.IsStatic(member) != isStatic {
 * 			continue
 * 		}
 * 		stmts = append(stmts, tx.createLet(mi.memberDecoratorsName, nil))
 * 		if mi.memberInitializersName != nil {
 * 			stmts = append(stmts, tx.createLet(mi.memberInitializersName, f.NewArrayLiteralExpression(f.NewNodeList(nil), false)))
 * 		}
 * 		if mi.memberExtraInitializersName != nil {
 * 			stmts = append(stmts, tx.createLet(mi.memberExtraInitializersName, f.NewArrayLiteralExpression(f.NewNodeList(nil), false)))
 * 		}
 * 		if mi.memberDescriptorName != nil {
 * 			stmts = append(stmts, tx.createLet(mi.memberDescriptorName, nil))
 * 		}
 * 	}
 * 	return stmts
 * }
 */
export declare function esDecoratorTransformer_emitMemberInfoDeclarations(receiver: GoPtr<esDecoratorTransformer>, ci: GoPtr<classInfo>, isStatic: bool): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::isDecoratedClassLike","kind":"func","status":"implemented","sigHash":"27faa00f080f02cb20483e37cffb5786ded07bebf9d0107fef6c6e7792c9d343","bodyHash":"b195e2487fd74306976ebdde275b6757f121d0a0ca9dfc174cb27fefe3f9089d"}
 *
 * Go source:
 * func isDecoratedClassLike(node *ast.Node) bool {
 * 	return ast.ClassOrConstructorParameterIsDecorated(false, node) ||
 * 		ast.ChildIsDecorated(false, node, nil)
 * }
 */
export declare function isDecoratedClassLike(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"f0cb07f2b29c8ece8a4261d9c883bb15d647bff2e5c08b59fc455eef712cde8c","bodyHash":"24b1a3f24ba71a90b6d44d1b3895fd64ed3a2681a7858c33cd4e61dc2e3ebf7a"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	if isDecoratedClassLike(node.AsNode()) {
 * 		f := tx.Factory()
 * 		ec := tx.EmitContext()
 * 		statements := []*ast.Statement{}
 *
 * 		originalClass := ec.MostOriginal(node.AsNode())
 * 		if !ast.IsClassLike(originalClass) {
 * 			originalClass = node.AsNode()
 * 		}
 * 		var className *ast.Expression
 * 		if originalClass.Name() != nil {
 * 			className = f.NewStringLiteralFromNode(originalClass.Name())
 * 		} else {
 * 			className = f.NewStringLiteral("default", 0)
 * 		}
 *
 * 		isExport := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport)
 * 		isDefault := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsDefault)
 *
 * 		classNode := node.AsNode()
 * 		if node.Name() == nil {
 * 			classNode = injectClassNamedEvaluationHelperBlockIfMissing(ec, classNode, className, nil)
 * 		}
 *
 * 		if isExport && isDefault {
 * 			iife := tx.transformClassLike(classNode)
 * 			if classNode.Name() != nil {
 * 				// produces:
 * 				//   let C = (() => { ... })();
 * 				//   export default C;
 * 				varDecl := f.NewVariableDeclaration(f.GetLocalName(classNode), nil, nil, iife)
 * 				ec.SetOriginal(varDecl, classNode)
 * 				varDecls := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsLet)
 * 				varStatement := f.NewVariableStatement(nil, varDecls)
 * 				statements = append(statements, varStatement)
 *
 * 				exportStatement := f.NewExportDefault(f.GetDeclarationName(classNode))
 * 				ec.SetOriginal(exportStatement, classNode)
 * 				ec.AssignCommentRange(exportStatement, classNode)
 * 				ec.SetSourceMapRange(exportStatement, transformers.MoveRangePastDecorators(classNode))
 * 				statements = append(statements, exportStatement)
 * 			} else {
 * 				// produces:
 * 				//   export default (() => { ... })();
 * 				exportStatement := f.NewExportDefault(iife)
 * 				ec.SetOriginal(exportStatement, classNode)
 * 				ec.AssignCommentRange(exportStatement, classNode)
 * 				ec.SetSourceMapRange(exportStatement, transformers.MoveRangePastDecorators(classNode))
 * 				statements = append(statements, exportStatement)
 * 			}
 * 		} else {
 * 			debug.Assert(classNode.Name() != nil, "A class declaration that is not a default export must have a name.")
 * 			// produces:
 * 			//   let C = (() => { ... })();
 * 			iife := tx.transformClassLike(classNode)
 * 			modifiers := tx.exportStrippingModifierVisitor.VisitModifiers(classNode.Modifiers())
 *
 * 			declName := f.GetLocalNameEx(classNode, printer.AssignedNameOptions{AllowSourceMaps: true})
 * 			varDecl := f.NewVariableDeclaration(declName, nil, nil, iife)
 * 			ec.SetOriginal(varDecl, classNode)
 * 			varDecls := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsLet)
 * 			varStatement := f.NewVariableStatement(modifiers, varDecls)
 * 			ec.SetOriginal(varStatement, classNode)
 * 			ec.AssignCommentRange(varStatement, classNode)
 * 			statements = append(statements, varStatement)
 *
 * 			if isExport {
 * 				// produces:
 * 				//   export { C };
 * 				exportStatement := f.NewExternalModuleExport(declName)
 * 				ec.SetOriginal(exportStatement, classNode)
 * 				statements = append(statements, exportStatement)
 * 			}
 * 		}
 *
 * 		return transformers.SingleOrMany(statements, f)
 * 	}
 *
 * 	// Non-decorated class
 * 	modifiers := tx.modifierVisitor.VisitModifiers(node.Modifiers())
 * 	heritageClauses := tx.Visitor().VisitNodes(node.HeritageClauses)
 * 	tx.enterClass(nil)
 * 	members := tx.classElementVisitor.VisitNodes(node.Members)
 * 	tx.exitClass()
 * 	return tx.Factory().UpdateClassDeclaration(node, modifiers, node.Name(), nil, heritageClauses, members)
 * }
 */
export declare function esDecoratorTransformer_visitClassDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"8196c682ee9c50652dc9f03f62aa48dbc413039baae1fe98f77dca15e73fa956","bodyHash":"94dbb6747417a835f840a8dd598f66054716d3ca3e8179fe1443847bf11b1129"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	if isDecoratedClassLike(node.AsNode()) {
 * 		iife := tx.transformClassLike(node.AsNode())
 * 		tx.EmitContext().SetOriginal(iife, node.AsNode())
 * 		return iife
 * 	}
 *
 * 	modifiers := tx.modifierVisitor.VisitModifiers(node.Modifiers())
 * 	heritageClauses := tx.Visitor().VisitNodes(node.HeritageClauses)
 * 	tx.enterClass(nil)
 * 	members := tx.classElementVisitor.VisitNodes(node.Members)
 * 	tx.exitClass()
 * 	return tx.Factory().UpdateClassExpression(node, modifiers, node.Name(), nil, heritageClauses, members)
 * }
 */
export declare function esDecoratorTransformer_visitClassExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.prepareConstructor","kind":"method","status":"implemented","sigHash":"db4506134c0d2318b6029411fd3dbc1b1ca28c1b6360dc49f6acc9b6790b6f19","bodyHash":"167c0b490c021c53e2a1b21f70cc3a82809301902b97e54912afce5887e41b7c"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) prepareConstructor(ci *classInfo) []*ast.Statement {
 * 	// Decorated instance members can add "extra" initializers to the instance. If a class contains any instance
 * 	// fields, we'll inject the `__runInitializers()` call for these extra initializers into the initializer of
 * 	// the first class member that will be initialized. However, if the class does not contain any fields that
 * 	// we can piggyback on, we need to synthesize a `__runInitializers()` call in the constructor instead.
 * 	if len(ci.pendingInstanceInitializers) == 0 {
 * 		return nil
 * 	}
 * 	f := tx.Factory()
 * 	statements := []*ast.Statement{
 * 		f.NewExpressionStatement(f.InlineExpressions(ci.pendingInstanceInitializers)),
 * 	}
 * 	ci.pendingInstanceInitializers = nil
 * 	return statements
 * }
 */
export declare function esDecoratorTransformer_prepareConstructor(receiver: GoPtr<esDecoratorTransformer>, ci: GoPtr<classInfo>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.transformConstructorBodyWorker","kind":"method","status":"implemented","sigHash":"4d2f19c2200475789bffc9b14698f4847eaa200b3b669a179dd4072ccce5362e","bodyHash":"e1a35674ae9e92f0fbb47b6107684775ec23ce87b23970de5be908e1e8d0d8ab"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) transformConstructorBodyWorker(statementsOut []*ast.Statement, statementsIn []*ast.Statement, statementOffset int, superPath []int, superPathDepth int, initializerStatements []*ast.Statement) []*ast.Statement {
 * 	superStatementIndex := superPath[superPathDepth]
 * 	// Visit statements before super
 * 	if superStatementIndex > statementOffset {
 * 		for _, s := range statementsIn[statementOffset:superStatementIndex] {
 * 			statementsOut = append(statementsOut, tx.Visitor().VisitNode(s))
 * 		}
 * 	}
 *
 * 	superStatement := statementsIn[superStatementIndex]
 * 	if ast.IsTryStatement(superStatement) {
 * 		// Recurse into try block
 * 		tryBlockNode := superStatement.AsTryStatement().TryBlock
 * 		tryBlock := tryBlockNode.AsBlock()
 * 		tryBlockStatements := tx.transformConstructorBodyWorker(nil, tryBlock.Statements.Nodes, 0, superPath, superPathDepth+1, initializerStatements)
 *
 * 		newTryBlock := tx.Factory().NewBlock(tx.Factory().NewNodeList(tryBlockStatements), true)
 * 		// Use the original try block's range even though the statements may differ due to
 * 		// injected initializer statements. This preserves source map fidelity for the enclosing
 * 		// try statement.
 * 		newTryBlock.Loc = tryBlockNode.Loc
 *
 * 		var catchClause *ast.Node
 * 		if superStatement.AsTryStatement().CatchClause != nil {
 * 			catchClause = tx.Visitor().VisitNode(superStatement.AsTryStatement().CatchClause)
 * 		}
 * 		var finallyBlock *ast.Node
 * 		if superStatement.AsTryStatement().FinallyBlock != nil {
 * 			finallyBlock = tx.Visitor().VisitNode(superStatement.AsTryStatement().FinallyBlock)
 * 		}
 * 		updated := tx.Factory().UpdateTryStatement(superStatement.AsTryStatement(), newTryBlock, catchClause, finallyBlock)
 * 		statementsOut = append(statementsOut, updated)
 * 	} else {
 * 		statementsOut = append(statementsOut, tx.Visitor().VisitNode(superStatement))
 * 		statementsOut = append(statementsOut, initializerStatements...)
 * 	}
 *
 * 	// Visit statements after super
 * 	if superStatementIndex+1 < len(statementsIn) {
 * 		for _, s := range statementsIn[superStatementIndex+1:] {
 * 			statementsOut = append(statementsOut, tx.Visitor().VisitNode(s))
 * 		}
 * 	}
 * 	return statementsOut
 * }
 */
export declare function esDecoratorTransformer_transformConstructorBodyWorker(receiver: GoPtr<esDecoratorTransformer>, statementsOut: GoSlice<GoPtr<Statement>>, statementsIn: GoSlice<GoPtr<Statement>>, statementOffset: int, superPath: GoSlice<int>, superPathDepth: int, initializerStatements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"61427c088f99b28f2482da17bb629c11af31acfb6c01887482931ec2858cc04b","bodyHash":"16ce6d24cee3ef365639dae5b287747fb96a99403b8b4d880f1f0d05e792d284"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitConstructorDeclaration(node *ast.Node) *ast.Node {
 * 	tx.enterClassElement(node)
 * 	modifiers := tx.modifierVisitor.VisitModifiers(node.Modifiers())
 * 	parameters := tx.Visitor().VisitNodes(node.ParameterList())
 *
 * 	var body *ast.Node
 * 	ctor := node.AsConstructorDeclaration()
 * 	if ctor.Body != nil && tx.classInfoStack != nil {
 * 		// If there are instance extra initializers we need to add them to the body along with any
 * 		// field initializers
 * 		initializerStatements := tx.prepareConstructor(tx.classInfoStack)
 * 		if len(initializerStatements) > 0 {
 * 			stmts := []*ast.Statement{}
 * 			prologue, rest := tx.Factory().SplitStandardPrologue(ctor.Body.AsBlock().Statements.Nodes)
 * 			stmts = append(stmts, prologue...)
 *
 * 			superStatementIndices := transformers.FindSuperStatementIndexPath(rest, 0)
 * 			if len(superStatementIndices) > 0 {
 * 				stmts = tx.transformConstructorBodyWorker(stmts, rest, 0, superStatementIndices, 0, initializerStatements)
 * 			} else {
 * 				stmts = append(stmts, initializerStatements...)
 * 				visited, _ := tx.Visitor().VisitSlice(rest)
 * 				stmts = append(stmts, visited...)
 * 			}
 *
 * 			body = tx.Factory().NewBlock(tx.Factory().NewNodeList(stmts), true)
 * 			tx.EmitContext().SetOriginal(body, ctor.Body.AsNode())
 * 			body.Loc = ctor.Body.Loc
 * 		}
 * 	}
 *
 * 	if body == nil {
 * 		body = tx.Visitor().VisitNode(ctor.Body.AsNode())
 * 	}
 * 	tx.exitClassElement()
 * 	return tx.Factory().UpdateConstructorDeclaration(ctor, modifiers, nil, parameters, nil, nil, body)
 * }
 */
export declare function esDecoratorTransformer_visitConstructorDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.finishClassElement","kind":"method","status":"implemented","sigHash":"55909d77e69578d2635dee4163e309d83db38fe78367ef563f3c5e2a4c8cf8b9","bodyHash":"a86d150ce45ff1e0dda126203f729ff729e83f8a1d7d08ea2a140b58605b1bbd"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) finishClassElement(updated *ast.Node, original *ast.Node) *ast.Node {
 * 	if updated != original {
 * 		// While we emit the source map for the node after skipping decorators and modifiers,
 * 		// we need to emit the comments for the original range.
 * 		tx.EmitContext().AssignCommentRange(updated, original)
 * 		tx.EmitContext().SetSourceMapRange(updated, transformers.MoveRangePastDecorators(original))
 * 	}
 * 	return updated
 * }
 */
export declare function esDecoratorTransformer_finishClassElement(receiver: GoPtr<esDecoratorTransformer>, updated: GoPtr<Node>, original: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::partialResult","kind":"type","status":"implemented","sigHash":"3e422d34c00b855fe4f45a15dbf0bdf8c333484d0cb1e33a7445eda343fe603c","bodyHash":"b1273ea36a63f2b6127ca9452ac778e2ca7b7fb21db914c213e07b30148722f3"}
 *
 * Go source:
 * partialResult struct {
 * 	modifiers             *ast.ModifierList
 * 	referencedName        *ast.Expression
 * 	name                  *ast.Node
 * 	initializersName      *ast.IdentifierNode
 * 	extraInitializersName *ast.IdentifierNode
 * 	descriptorName        *ast.IdentifierNode
 * 	thisArg               *ast.IdentifierNode
 * }
 */
export interface partialResult {
    modifiers: GoPtr<ModifierList>;
    referencedName: GoPtr<Expression>;
    name: GoPtr<Node>;
    initializersName: GoPtr<IdentifierNode>;
    extraInitializersName: GoPtr<IdentifierNode>;
    descriptorName: GoPtr<IdentifierNode>;
    thisArg: GoPtr<IdentifierNode>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::type::createDescriptorFunc","kind":"type","status":"implemented","sigHash":"c983f2fcea410691ffce40d34366b148568c36f53dd378796b83ccdfe1439bb7","bodyHash":"d58fc9f2e8b545f208c5cec76b11b3772ce13f06585f9787a1d8cc4654b880c1"}
 *
 * Go source:
 * createDescriptorFunc func(member *ast.Node, modifiers *ast.ModifierList) *ast.Expression
 */
export type createDescriptorFunc = (member: GoPtr<Node>, modifiers: GoPtr<ModifierList>) => GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.partialTransformClassElement","kind":"method","status":"implemented","sigHash":"1eeeb665ac2d759c9c5cbf3f5a46cc3c54e4aedc08704b06036bc9833d00b8ea","bodyHash":"5f55874871d1c4bfc655f1f8a77f69b068089a8ba880dd322c1454d16855d347"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) partialTransformClassElement(member *ast.Node, ci *classInfo, createDescriptor createDescriptorFunc) partialResult {
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 *
 * 	if ci == nil {
 * 		modifiers := tx.modifierVisitor.VisitModifiers(member.Modifiers())
 * 		tx.enterName()
 * 		name := tx.visitPropertyName(member.Name())
 * 		tx.exitName()
 * 		return partialResult{modifiers: modifiers, name: name}
 * 	}
 *
 * 	// Member decorators require privileged access to private names. However, computed property
 * 	// evaluation occurs interspersed with decorator evaluation. This means that if we encounter
 * 	// a computed property name we must inline decorator evaluation.
 *
 * 	// Collect decorators for this member. Decorator expressions evaluate outside the class body,
 * 	// so `this` should NOT be replaced with `_classThis`.
 * 	savedClassThis := tx.classThis
 * 	tx.classThis = nil
 * 	memberDecorators := tx.transformAllDecoratorsOfDeclaration(member.Decorators())
 * 	tx.classThis = savedClassThis
 * 	modifiers := tx.modifierVisitor.VisitModifiers(member.Modifiers())
 *
 * 	var result partialResult
 * 	result.modifiers = modifiers
 *
 * 	if len(memberDecorators) > 0 {
 * 		memberDecoratorsName := tx.createHelperVariable(member, "decorators")
 * 		memberDecoratorsArray := f.NewArrayLiteralExpression(
 * 			f.NewNodeList(memberDecorators),
 * 			false,
 * 		)
 * 		memberDecoratorsAssignment := f.NewAssignmentExpression(memberDecoratorsName, memberDecoratorsArray)
 * 		mi := &memberInfo{memberDecoratorsName: memberDecoratorsName}
 * 		ci.memberInfos.Set(member, mi)
 * 		tx.pendingExpressions = append(tx.pendingExpressions, memberDecoratorsAssignment)
 *
 * 		// 5. Static non-field (method/getter/setter/auto-accessor) element decorators are applied
 * 		// 6. Non-static non-field (method/getter/setter/auto-accessor) element decorators are applied
 * 		// 7. Static field (excl. auto-accessor) element decorators are applied
 * 		// 8. Non-static field (excl. auto-accessor) element decorators are applied
 *
 * 		// Determine decorator kind
 * 		var kind string
 * 		switch {
 * 		case ast.IsGetAccessorDeclaration(member):
 * 			kind = "getter"
 * 		case ast.IsSetAccessorDeclaration(member):
 * 			kind = "setter"
 * 		case ast.IsMethodDeclaration(member):
 * 			kind = "method"
 * 		case ast.IsAutoAccessorPropertyDeclaration(member):
 * 			kind = "accessor"
 * 		case ast.IsPropertyDeclaration(member):
 * 			kind = "field"
 * 		default:
 * 			debug.Fail("Unexpected class element kind.")
 * 		}
 *
 * 		// Determine the property name for the context
 * 		var propertyNameComputed bool
 * 		var propertyNameExpr *ast.Expression
 * 		if member.Name() != nil && (ast.IsIdentifier(member.Name()) || ast.IsPrivateIdentifier(member.Name())) {
 * 			propertyNameComputed = false
 * 			propertyNameExpr = member.Name()
 * 		} else if member.Name() != nil && ast.IsPropertyNameLiteral(member.Name()) {
 * 			propertyNameComputed = true
 * 			propertyNameExpr = f.NewStringLiteralFromNode(member.Name())
 * 		} else if member.Name() != nil && ast.IsComputedPropertyName(member.Name()) {
 * 			cpn := member.Name().AsComputedPropertyName()
 * 			if ast.IsPropertyNameLiteral(cpn.Expression) && !ast.IsIdentifier(cpn.Expression) {
 * 				propertyNameComputed = true
 * 				propertyNameExpr = f.NewStringLiteralFromNode(cpn.Expression)
 * 			} else {
 * 				tx.enterName()
 * 				result.referencedName, result.name = tx.visitReferencedPropertyName(member.Name())
 * 				tx.exitName()
 * 				propertyNameComputed = true
 * 				propertyNameExpr = result.referencedName
 * 			}
 * 		}
 *
 * 		contextObj := f.NewESDecorateClassElementContextObject(
 * 			kind,
 * 			propertyNameComputed,
 * 			propertyNameExpr,
 * 			ast.IsStatic(member),
 * 			member.Name() != nil && ast.IsPrivateIdentifier(member.Name()),
 * 			// 15.7.3 CreateDecoratorAccessObject (kind, name)
 * 			// 2. If _kind_ is ~field~, ~method~, ~accessor~, or ~getter~, then ...
 * 			ast.IsPropertyDeclaration(member) || ast.IsGetAccessorDeclaration(member) || ast.IsMethodDeclaration(member),
 * 			// 3. If _kind_ is ~field~, ~accessor~, or ~setter~, then ...
 * 			ast.IsPropertyDeclaration(member) || ast.IsSetAccessorDeclaration(member),
 * 			ci.metadataReference,
 * 		)
 *
 * 		if ast.IsMethodOrAccessor(member) {
 * 			// produces (public elements):
 * 			//   __esDecorate(this, null, _static_member_decorators, { kind: "method", name: "...", static: true, private: false, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, null, _member_decorators, { kind: "method", name: "...", static: false, private: false, access: { ... } }, _instanceExtraInitializers);
 * 			//   __esDecorate(this, null, _static_member_decorators, { kind: "getter", name: "...", static: true, private: false, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, null, _member_decorators, { kind: "getter", name: "...", static: false, private: false, access: { ... } }, _instanceExtraInitializers);
 * 			//   __esDecorate(this, null, _static_member_decorators, { kind: "setter", name: "...", static: true, private: false, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, null, _member_decorators, { kind: "setter", name: "...", static: false, private: false, access: { ... } }, _instanceExtraInitializers);
 * 			//
 * 			// produces (private elements):
 * 			//   __esDecorate(this, _static_member_descriptor = { value() { ... } }, _static_member_decorators, { kind: "method", name: "...", static: true, private: true, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, _member_descriptor = { value() { ... } }, _member_decorators, { kind: "method", name: "...", static: false, private: true, access: { ... } }, _instanceExtraInitializers);
 * 			//   __esDecorate(this, _static_member_descriptor = { get() { ... } }, _static_member_decorators, { kind: "getter", name: "...", static: true, private: true, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, _member_descriptor = { get() { ... } }, _member_decorators, { kind: "getter", name: "...", static: false, private: true, access: { ... } }, _instanceExtraInitializers);
 * 			//   __esDecorate(this, _static_member_descriptor = { set() { ... } }, _static_member_decorators, { kind: "setter", name: "...", static: true, private: true, access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(this, _member_descriptor = { set() { ... } }, _member_decorators, { kind: "setter", name: "...", static: false, private: true, access: { ... } }, _instanceExtraInitializers);
 * 			methodExtraInitializersName := ci.instanceMethodExtraInitializersName
 * 			if ast.IsStatic(member) {
 * 				methodExtraInitializersName = ci.staticMethodExtraInitializersName
 * 			}
 * 			debug.Assert(methodExtraInitializersName != nil, "methodExtraInitializersName should be defined")
 *
 * 			var descriptorArg *ast.Expression
 * 			if ast.IsPrivateIdentifierClassElementDeclaration(member) && createDescriptor != nil {
 * 				// For private members, extract the method/accessor body into a descriptor object.
 * 				// Filter modifiers to only keep async.
 * 				asyncMods := tx.asyncOnlyModifierVisitor.VisitModifiers(modifiers)
 * 				descriptor := createDescriptor(member, asyncMods)
 * 				mi.memberDescriptorName = tx.createHelperVariable(member, "descriptor")
 * 				result.descriptorName = mi.memberDescriptorName
 * 				descriptorArg = f.NewAssignmentExpression(mi.memberDescriptorName, descriptor)
 * 			} else {
 * 				descriptorArg = f.NewToken(ast.KindNullKeyword)
 * 			}
 *
 * 			esDecorateExpr := f.NewESDecorateHelper(
 * 				f.NewThisExpression(),
 * 				descriptorArg,
 * 				memberDecoratorsName,
 * 				contextObj,
 * 				f.NewToken(ast.KindNullKeyword),
 * 				methodExtraInitializersName,
 * 			)
 * 			esDecorateStatement := f.NewExpressionStatement(esDecorateExpr)
 * 			ec.SetSourceMapRange(esDecorateStatement, transformers.MoveRangePastDecorators(member))
 * 			tx.appendDecorationStatement(ci, member, esDecorateStatement)
 * 		} else if ast.IsPropertyDeclaration(member) {
 * 			mi.memberInitializersName = tx.createHelperVariable(member, "initializers")
 * 			mi.memberExtraInitializersName = tx.createHelperVariable(member, "extraInitializers")
 * 			result.initializersName = mi.memberInitializersName
 * 			result.extraInitializersName = mi.memberExtraInitializersName
 * 			if ast.IsStatic(member) {
 * 				result.thisArg = ci.classThis
 * 			}
 *
 * 			var ctorArg *ast.Node
 * 			if ast.IsAutoAccessorPropertyDeclaration(member) {
 * 				ctorArg = f.NewThisExpression()
 * 			} else {
 * 				ctorArg = f.NewToken(ast.KindNullKeyword)
 * 			}
 *
 * 			var descriptorArg *ast.Expression
 * 			if ast.IsPrivateIdentifierClassElementDeclaration(member) && ast.HasAccessorModifier(member) && createDescriptor != nil {
 * 				descriptor := createDescriptor(member, nil)
 * 				mi.memberDescriptorName = tx.createHelperVariable(member, "descriptor")
 * 				result.descriptorName = mi.memberDescriptorName
 * 				descriptorArg = f.NewAssignmentExpression(mi.memberDescriptorName, descriptor)
 * 			} else {
 * 				descriptorArg = f.NewToken(ast.KindNullKeyword)
 * 			}
 *
 * 			// produces:
 * 			//   __esDecorate(null, null, _static_member_decorators, { kind: "field", name: "...", static: true, private: ..., access: { ... } }, _staticExtraInitializers);
 * 			//   __esDecorate(null, null, _member_decorators, { kind: "field", name: "...", static: false, private: ..., access: { ... } }, _instanceExtraInitializers);
 * 			esDecorateExpr := f.NewESDecorateHelper(
 * 				ctorArg,
 * 				descriptorArg,
 * 				memberDecoratorsName,
 * 				contextObj,
 * 				mi.memberInitializersName,
 * 				mi.memberExtraInitializersName,
 * 			)
 * 			esDecorateStatement := f.NewExpressionStatement(esDecorateExpr)
 * 			ec.SetSourceMapRange(esDecorateStatement, transformers.MoveRangePastDecorators(member))
 * 			tx.appendDecorationStatement(ci, member, esDecorateStatement)
 * 		}
 * 	}
 *
 * 	if result.name == nil {
 * 		tx.enterName()
 * 		result.name = tx.visitPropertyName(member.Name())
 * 		tx.exitName()
 * 	}
 *
 * 	if (modifiers == nil || len(modifiers.Nodes) == 0) && (ast.IsMethodDeclaration(member) || ast.IsPropertyDeclaration(member)) {
 * 		// Don't emit leading comments on the name for methods and properties without modifiers, otherwise we
 * 		// will end up printing duplicate comments.
 * 		ec.SetEmitFlags(result.name, printer.EFNoLeadingComments)
 * 	}
 *
 * 	return result
 * }
 */
export declare function esDecoratorTransformer_partialTransformClassElement(receiver: GoPtr<esDecoratorTransformer>, member: GoPtr<Node>, ci: GoPtr<classInfo>, createDescriptor: GoPtr<createDescriptorFunc>): partialResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.appendDecorationStatement","kind":"method","status":"implemented","sigHash":"1173e134fa5c50f0509cbb9601baf309bdc84abe55d25637b70ba5c73f767616","bodyHash":"fcaa0060e2936c039fa03f9fcf0e47a0d1bf5b39c620c3f55f9b00832587d4ae"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) appendDecorationStatement(ci *classInfo, member *ast.Node, stmt *ast.Statement) {
 * 	if ast.IsMethodOrAccessor(member) || ast.IsAutoAccessorPropertyDeclaration(member) {
 * 		if ast.IsStatic(member) {
 * 			ci.staticNonFieldDecorationStatements = append(ci.staticNonFieldDecorationStatements, stmt)
 * 		} else {
 * 			ci.nonStaticNonFieldDecorationStatements = append(ci.nonStaticNonFieldDecorationStatements, stmt)
 * 		}
 * 	} else if ast.IsPropertyDeclaration(member) && !ast.IsAutoAccessorPropertyDeclaration(member) {
 * 		if ast.IsStatic(member) {
 * 			ci.staticFieldDecorationStatements = append(ci.staticFieldDecorationStatements, stmt)
 * 		} else {
 * 			ci.nonStaticFieldDecorationStatements = append(ci.nonStaticFieldDecorationStatements, stmt)
 * 		}
 * 	} else {
 * 		debug.Fail("Unexpected class element kind.")
 * 	}
 * }
 */
export declare function esDecoratorTransformer_appendDecorationStatement(receiver: GoPtr<esDecoratorTransformer>, ci: GoPtr<classInfo>, member: GoPtr<Node>, stmt: GoPtr<Statement>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"937056e65299d7f86fb429a653ec0cef03db97f5119329f5e99d9be3ba328e36","bodyHash":"a7b56fab80e4c84608f720a8ae9953c0aa1294fb2adc5c493ac75611c4211f82"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitMethodDeclaration(node *ast.Node) *ast.Node {
 * 	tx.enterClassElement(node)
 * 	result := tx.partialTransformClassElement(node, tx.classInfoStack, tx.createMethodDescriptorObject)
 * 	if result.descriptorName != nil {
 * 		tx.exitClassElement()
 * 		return tx.finishClassElement(tx.createMethodDescriptorForwarder(result.modifiers, result.name, result.descriptorName), node)
 * 	}
 * 	parameters := tx.Visitor().VisitNodes(node.ParameterList())
 * 	body := tx.Visitor().VisitNode(node.Body())
 * 	tx.exitClassElement()
 * 	method := node.AsMethodDeclaration()
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateMethodDeclaration(method, result.modifiers, method.AsteriskToken, result.name, nil, nil, parameters, nil, nil, body),
 * 		node,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_visitMethodDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"b5a5eb568ea97e1bfbc513b6260d0c4639b2a2194f83d17bdf4a180c84f37bf7","bodyHash":"e290e8f79f373efcff71d0a6767e0257ecd3e79ef6256e7dfe7dab5f8cec4a3e"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitGetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	tx.enterClassElement(node)
 * 	result := tx.partialTransformClassElement(node, tx.classInfoStack, tx.createGetAccessorDescriptorObject)
 * 	if result.descriptorName != nil {
 * 		tx.exitClassElement()
 * 		return tx.finishClassElement(tx.createGetAccessorDescriptorForwarder(result.modifiers, result.name, result.descriptorName), node)
 * 	}
 * 	parameters := tx.Visitor().VisitNodes(node.ParameterList())
 * 	body := tx.Visitor().VisitNode(node.Body())
 * 	tx.exitClassElement()
 * 	accessor := node.AsGetAccessorDeclaration()
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateGetAccessorDeclaration(accessor, result.modifiers, result.name, nil, parameters, nil, nil, body),
 * 		node,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_visitGetAccessorDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"fdcb03180f7f96c51e9da455a966fdc17541355aef1cc997a4b86112e94d0eca","bodyHash":"68aa943b701ec3abb0bfc059902b15aeb25f49664cffc296c5179e807d959556"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitSetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	tx.enterClassElement(node)
 * 	result := tx.partialTransformClassElement(node, tx.classInfoStack, tx.createSetAccessorDescriptorObject)
 * 	if result.descriptorName != nil {
 * 		tx.exitClassElement()
 * 		return tx.finishClassElement(tx.createSetAccessorDescriptorForwarder(result.modifiers, result.name, result.descriptorName), node)
 * 	}
 * 	parameters := tx.Visitor().VisitNodes(node.ParameterList())
 * 	body := tx.Visitor().VisitNode(node.Body())
 * 	tx.exitClassElement()
 * 	accessor := node.AsSetAccessorDeclaration()
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateSetAccessorDeclaration(accessor, result.modifiers, result.name, nil, parameters, nil, nil, body),
 * 		node,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_visitSetAccessorDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"68e73fb4e7e01d7084c40073a009d85b664a605d93754a5e9efdddd728ec40ae","bodyHash":"7ec61c5d2094c4bdaae1039bdc0c8ae7a6df95e5c059d8b8a111413c8b16db8c"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitClassStaticBlockDeclaration(node *ast.Node) *ast.Node {
 * 	tx.enterClassElement(node)
 * 	f := tx.Factory()
 *
 * 	var result *ast.Node
 * 	if isClassNamedEvaluationHelperBlock(tx.EmitContext(), node) {
 * 		result = tx.Visitor().VisitEachChild(node)
 * 		// Transfer AssignedName metadata to the new node so isClassNamedEvaluationHelperBlock
 * 		// can still find it after visiting (visiting may create a new node when this->_classThis)
 * 		if assignedName := tx.EmitContext().AssignedName(node); assignedName != nil && result != node {
 * 			tx.EmitContext().SetAssignedName(result, assignedName)
 * 		}
 * 	} else if isClassThisAssignmentBlock(tx.EmitContext(), node) {
 * 		savedClassThis := tx.classThis
 * 		tx.classThis = nil
 * 		result = tx.Visitor().VisitEachChild(node)
 * 		tx.classThis = savedClassThis
 * 	} else {
 * 		// Use a nested variable environment so temp vars generated during static block
 * 		// content transformation (e.g., super access temps) stay scoped to the static block.
 * 		ec := tx.EmitContext()
 * 		ec.StartVariableEnvironment()
 * 		result = tx.Visitor().VisitEachChild(node)
 * 		varStatements := ec.EndVariableEnvironment()
 * 		if len(varStatements) > 0 {
 * 			// Inject var declarations at the start of the static block's body
 * 			blockBody := result.AsClassStaticBlockDeclaration().Body.AsBlock()
 * 			newStmts := make([]*ast.Statement, 0, len(varStatements)+len(blockBody.Statements.Nodes))
 * 			newStmts = append(newStmts, varStatements...)
 * 			newStmts = append(newStmts, blockBody.Statements.Nodes...)
 * 			result = f.NewClassStaticBlockDeclaration(nil, f.NewBlock(f.NewNodeList(newStmts), blockBody.MultiLine))
 * 		}
 * 		if tx.classInfoStack != nil {
 * 			tx.classInfoStack.hasStaticInitializers = true
 * 			if len(tx.classInfoStack.pendingStaticInitializers) > 0 {
 * 				// If we tried to inject the pending initializers into the current block, we might run into
 * 				// variable name collisions due to sharing this blocks scope. To avoid this, we inject a new
 * 				// static block that contains the pending initializers that precedes this block.
 * 				stmts := []*ast.Node{}
 * 				for _, init := range tx.classInfoStack.pendingStaticInitializers {
 * 					initStmt := f.NewExpressionStatement(init)
 * 					tx.EmitContext().SetSourceMapRange(initStmt, tx.EmitContext().SourceMapRange(init))
 * 					stmts = append(stmts, initStmt)
 * 				}
 * 				body := f.NewBlock(f.NewNodeList(stmts), true)
 * 				staticBlock := f.NewClassStaticBlockDeclaration(nil, body)
 * 				tx.classInfoStack.pendingStaticInitializers = nil
 * 				// Return both the new static block and the original
 * 				tx.exitClassElement()
 * 				return transformers.SingleOrMany([]*ast.Node{staticBlock, result}, tx.Factory())
 * 			}
 * 		}
 * 	}
 *
 * 	tx.exitClassElement()
 * 	return result
 * }
 */
export declare function esDecoratorTransformer_visitClassStaticBlockDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitPropertyDeclaration","kind":"method","status":"implemented","sigHash":"234faa4838c3936f28614148a24f25e1a297784151b8708445259f156427d7b3","bodyHash":"30249e0c013be5bff468a99a36064120ee78cdd83532d8b6faa30e3363308d32"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitPropertyDeclaration(node *ast.Node) *ast.Node {
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node, isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node, canIgnoreEmptyStringLiteralInAssignedName(node.Initializer()), "")
 * 	}
 *
 * 	tx.enterClassElement(node)
 *
 * 	// TODO(rbuckton): We support decorating `declare x` fields with legacyDecorators, but we currently don't
 * 	//                 support them with esDecorators. We need to consider whether we will support them in the
 * 	//                 future, and how. For now, these should be elided by the `ts` transform.
 * 	debug.Assert(!ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient), "Not yet implemented.")
 *
 * 	// 10.2.1.3 RS: EvaluateBody
 * 	//   Initializer : `=` AssignmentExpression
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _functionObject_.[[ClassFieldInitializerName]].
 * 	//     ...
 *
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 *
 * 	var createDescriptor createDescriptorFunc
 * 	if ast.HasAccessorModifier(node) {
 * 		createDescriptor = tx.createAccessorPropertyDescriptorObject
 * 	}
 * 	result := tx.partialTransformClassElement(node, tx.classInfoStack, createDescriptor)
 *
 * 	ec.StartVariableEnvironment()
 *
 * 	initializer := tx.Visitor().VisitNode(node.Initializer())
 * 	if result.initializersName != nil {
 * 		var thisArg *ast.Node
 * 		if result.thisArg != nil {
 * 			thisArg = result.thisArg
 * 		} else {
 * 			thisArg = f.NewThisExpression()
 * 		}
 * 		if initializer == nil {
 * 			initializer = f.NewVoidZeroExpression()
 * 		}
 * 		initializer = f.NewRunInitializersHelper(thisArg, result.initializersName, initializer)
 * 	}
 *
 * 	if ast.IsStatic(node) && tx.classInfoStack != nil && initializer != nil {
 * 		tx.classInfoStack.hasStaticInitializers = true
 * 	}
 *
 * 	declarations := ec.EndVariableEnvironment()
 * 	if len(declarations) > 0 {
 * 		stmts := make([]*ast.Statement, len(declarations)+1)
 * 		copy(stmts, declarations)
 * 		stmts[len(declarations)] = f.NewReturnStatement(initializer)
 * 		initializer = f.NewImmediatelyInvokedArrowFunction(stmts)
 * 	}
 *
 * 	if tx.classInfoStack != nil {
 * 		if ast.IsStatic(node) {
 * 			initializer = tx.injectPendingInitializers(tx.classInfoStack, true, initializer)
 * 			if result.extraInitializersName != nil {
 * 				var thisArg *ast.Node
 * 				if tx.classInfoStack.classThis != nil {
 * 					thisArg = tx.classInfoStack.classThis
 * 				} else {
 * 					thisArg = f.NewThisExpression()
 * 				}
 * 				tx.classInfoStack.pendingStaticInitializers = append(tx.classInfoStack.pendingStaticInitializers,
 * 					f.NewRunInitializersHelper(thisArg, result.extraInitializersName, nil),
 * 				)
 * 			}
 * 		} else {
 * 			initializer = tx.injectPendingInitializers(tx.classInfoStack, false, initializer)
 * 			if result.extraInitializersName != nil {
 * 				tx.classInfoStack.pendingInstanceInitializers = append(tx.classInfoStack.pendingInstanceInitializers,
 * 					f.NewRunInitializersHelper(f.NewThisExpression(), result.extraInitializersName, nil),
 * 				)
 * 			}
 * 		}
 * 	}
 *
 * 	tx.exitClassElement()
 *
 * 	if ast.HasAccessorModifier(node) && result.descriptorName != nil {
 * 		// given:
 * 		//  accessor #x = 1;
 * 		//
 * 		// emits:
 * 		//  static {
 * 		//      _esDecorate(null, _private_x_descriptor = { get() { return this.#x_1; }, set(value) { this.#x_1 = value; } }, ...)
 * 		//  }
 * 		//  ...
 * 		//  #x_1 = 1;
 * 		//  get #x() { return _private_x_descriptor.get.call(this); }
 * 		//  set #x(value) { _private_x_descriptor.set.call(this, value); }
 *
 * 		commentRange := ec.CommentRange(node)
 * 		sourceMapRange := ec.SourceMapRange(node)
 *
 * 		// Since we're creating two declarations where there was previously one, cache
 * 		// the expression for any computed property names.
 * 		propName := node.Name()
 * 		getterName := result.name
 * 		setterName := result.name
 * 		if ast.IsComputedPropertyName(propName) && !transformers.IsSimpleInlineableExpression(propName.Expression()) {
 * 			cacheAssignment := findComputedPropertyNameCacheAssignment(ec, propName)
 * 			if cacheAssignment != nil {
 * 				getterName = f.UpdateComputedPropertyName(propName.AsComputedPropertyName(), tx.Visitor().VisitNode(propName.Expression()))
 * 				setterName = f.UpdateComputedPropertyName(propName.AsComputedPropertyName(), cacheAssignment.Left)
 * 			} else {
 * 				temp := f.NewTempVariable()
 * 				ec.SetSourceMapRange(temp, propName.Expression().Loc)
 * 				ec.AddVariableDeclaration(temp)
 * 				expression := tx.Visitor().VisitNode(propName.Expression())
 * 				assignment := f.NewAssignmentExpression(temp, expression)
 * 				ec.SetSourceMapRange(assignment, propName.Expression().Loc)
 * 				getterName = f.UpdateComputedPropertyName(propName.AsComputedPropertyName(), assignment)
 * 				setterName = f.UpdateComputedPropertyName(propName.AsComputedPropertyName(), temp)
 * 			}
 * 		}
 *
 * 		modifiersWithoutAccessor := tx.accessorStrippingModifierVisitor.VisitModifiers(result.modifiers)
 *
 * 		backingField := createAccessorPropertyBackingField(f, node.AsPropertyDeclaration(), modifiersWithoutAccessor, initializer)
 * 		ec.SetOriginal(backingField, node)
 * 		ec.SetEmitFlags(backingField, printer.EFNoComments)
 * 		ec.SetSourceMapRange(backingField, sourceMapRange)
 * 		ec.SetSourceMapRange(backingField.AsPropertyDeclaration().Name(), ec.SourceMapRange(node.Name()))
 *
 * 		getter := tx.createGetAccessorDescriptorForwarder(modifiersWithoutAccessor, getterName, result.descriptorName)
 * 		ec.SetOriginal(getter, node)
 * 		ec.SetCommentRange(getter, commentRange)
 * 		ec.SetSourceMapRange(getter, sourceMapRange)
 *
 * 		setter := tx.createSetAccessorDescriptorForwarder(modifiersWithoutAccessor, setterName, result.descriptorName)
 * 		ec.SetOriginal(setter, node)
 * 		ec.SetEmitFlags(setter, printer.EFNoComments)
 * 		ec.SetSourceMapRange(setter, sourceMapRange)
 *
 * 		return transformers.SingleOrMany([]*ast.Node{backingField, getter, setter}, f)
 * 	}
 *
 * 	prop := node.AsPropertyDeclaration()
 * 	return tx.finishClassElement(
 * 		f.UpdatePropertyDeclaration(prop, result.modifiers, result.name, nil, nil, initializer),
 * 		node,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_visitPropertyDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitThisExpression","kind":"method","status":"implemented","sigHash":"073192ddd8b6f8119303e3951837a9762a070d4af13ddea95b9f969f0ccbc9f2","bodyHash":"0dafef751e14ff99afb4ee4d241d888141d0cc48fc3bb4af3737e7d59fd5735f"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitThisExpression(node *ast.Node) *ast.Node {
 * 	if tx.classThis != nil {
 * 		return tx.classThis
 * 	}
 * 	return node
 * }
 */
export declare function esDecoratorTransformer_visitThisExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"c24ab9a5fff984d823d26198659bf6ad0b3a5d7c188f2a9a8fab4d04effbec0f","bodyHash":"66451dfac3418c5c979fccd6379e9539422c802105f27162a1e96ecc5ad6e340"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitCallExpression(node *ast.Node) *ast.Node {
 * 	call := node.AsCallExpression()
 * 	if ast.IsSuperProperty(call.Expression) && tx.classThis != nil {
 * 		expression := tx.Visitor().VisitNode(call.Expression)
 * 		argumentsList := tx.Visitor().VisitNodes(call.Arguments)
 * 		invocation := tx.Factory().NewFunctionCallCall(expression, tx.classThis, argumentsList.Nodes)
 * 		tx.EmitContext().SetOriginal(invocation, node)
 * 		invocation.Loc = node.Loc
 * 		return invocation
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitCallExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"3f0fe7c0e62ed06587dea63f60b3effdf5c5081187dda5c8ea87e4575664d5c2","bodyHash":"f6d5c687c90a4bab1f0711d9233c9340b532d9c217dc564e2f9fcfb0998d3adc"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitTaggedTemplateExpression(node *ast.Node) *ast.Node {
 * 	tte := node.AsTaggedTemplateExpression()
 * 	if ast.IsSuperProperty(tte.Tag) && tx.classThis != nil {
 * 		tag := tx.Visitor().VisitNode(tte.Tag)
 * 		boundTag := tx.Factory().NewFunctionBindCall(tag, tx.classThis, []*ast.Expression{})
 * 		tx.EmitContext().SetOriginal(boundTag, node)
 * 		boundTag.Loc = node.Loc
 * 		template := tx.Visitor().VisitNode(tte.Template)
 * 		return tx.Factory().UpdateTaggedTemplateExpression(tte, boundTag, nil, nil, template, tte.Flags)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitTaggedTemplateExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"51c0ff21ba51e102959cb09ffd81a9c084534709dda50a096e2475177a7ce7a8","bodyHash":"a8885101ed5638386eb93cb52693113ed33227c1808f36daaa317e4ebafa286a"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitPropertyAccessExpression(node *ast.Node) *ast.Node {
 * 	pa := node.AsPropertyAccessExpression()
 * 	if ast.IsSuperProperty(node) && ast.IsIdentifier(pa.Name()) && tx.classThis != nil && tx.classSuper != nil {
 * 		propertyName := tx.Factory().NewStringLiteralFromNode(pa.Name())
 * 		superProperty := tx.Factory().NewReflectGetCall(tx.classSuper, propertyName, tx.classThis)
 * 		tx.EmitContext().SetOriginal(superProperty, pa.Expression)
 * 		superProperty.Loc = pa.Expression.Loc
 * 		return superProperty
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitPropertyAccessExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitElementAccessExpression","kind":"method","status":"implemented","sigHash":"d68544ba0f8ba2dca636ff7abdb0be6b000c5f345b847158d3b2669c81f82209","bodyHash":"9107421c3c04f849b997cd9f5d7310e2bb5ed5ae3b3a655ea383299a92869d69"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitElementAccessExpression(node *ast.Node) *ast.Node {
 * 	ea := node.AsElementAccessExpression()
 * 	if ast.IsSuperProperty(node) && tx.classThis != nil && tx.classSuper != nil {
 * 		propertyName := tx.Visitor().VisitNode(ea.ArgumentExpression)
 * 		superProperty := tx.Factory().NewReflectGetCall(tx.classSuper, propertyName, tx.classThis)
 * 		tx.EmitContext().SetOriginal(superProperty, ea.Expression)
 * 		superProperty.Loc = ea.Expression.Loc
 * 		return superProperty
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitElementAccessExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitParameterDeclaration","kind":"method","status":"implemented","sigHash":"b1fb9485870e40d6c6b6afef130f00d121a5a52c9d5aacfcbe8ef46931dde28b","bodyHash":"4f66e21884222c9178061a89ea2c083cca9794cd3d5a1083a6fe165eade0e118"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitParameterDeclaration(node *ast.ParameterDeclaration) *ast.Node {
 * 	paramNode := node.AsNode()
 * 	if isNamedEvaluationAnd(tx.EmitContext(), paramNode, isAnonymousClassNeedingAssignedName) {
 * 		paramNode = transformNamedEvaluation(tx.EmitContext(), paramNode, canIgnoreEmptyStringLiteralInAssignedName(paramNode.Initializer()), "")
 * 		node = paramNode.AsParameterDeclaration()
 * 	}
 *
 * 	updated := tx.Factory().UpdateParameterDeclaration(
 * 		node,
 * 		nil, // modifiers - strip all modifiers (including decorators)
 * 		node.DotDotDotToken,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		nil, // questionToken
 * 		nil, // type
 * 		tx.Visitor().VisitNode(node.Initializer),
 * 	)
 * 	if updated != paramNode {
 * 		// While we emit the source map for the node after skipping decorators and modifiers,
 * 		// we need to emit the comments for the original range.
 * 		tx.EmitContext().SetCommentRange(updated, paramNode.Loc)
 * 		newLoc := transformers.MoveRangePastModifiers(paramNode)
 * 		updated.Loc = newLoc
 * 		tx.EmitContext().SetSourceMapRange(updated, newLoc)
 * 		tx.EmitContext().SetEmitFlags(updated.Name(), printer.EFNoTrailingSourceMap)
 * 	}
 * 	return updated
 * }
 */
export declare function esDecoratorTransformer_visitParameterDeclaration(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<ParameterDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitNamedEvaluationSite","kind":"method","status":"implemented","sigHash":"22996007d81b6df749c59cfe907ea2a41fbefc0ef910ce656b1d3db827ef94b0","bodyHash":"4f63062a04e7e46dc57cf12b1845e6dd089d0342efa3be3bb9d10f25922dccdc"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitNamedEvaluationSite(node *ast.Node, classExpr *ast.Node) *ast.Node {
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node, isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node, canIgnoreEmptyStringLiteralInAssignedName(classExpr), "")
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitNamedEvaluationSite(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, classExpr: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::isAnonymousClassNeedingAssignedName","kind":"func","status":"implemented","sigHash":"b92230107445d0d742fc8fc4583e9e4c286276ac47130c38d69e8fdfb89ff6ea","bodyHash":"84a8018c8a161429f503c10024ad909dd9e75a46d675d861fd45fde22140bc82"}
 *
 * Go source:
 * func isAnonymousClassNeedingAssignedName(node *ast.Node) bool {
 * 	return ast.IsClassExpression(node) && node.Name() == nil && isDecoratedClassLike(node)
 * }
 */
export declare function isAnonymousClassNeedingAssignedName(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::canIgnoreEmptyStringLiteralInAssignedName","kind":"func","status":"implemented","sigHash":"9a19eee0a74c02b7b29de49be0094a2b822265529005824627736c9c8d2c4637","bodyHash":"221275853761cd657a910c2b1490a2935c426c49027abc7b05670e0a27dbcae7"}
 *
 * Go source:
 * func canIgnoreEmptyStringLiteralInAssignedName(node *ast.Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	innerExpression := ast.SkipOuterExpressions(node, ast.OEKAll)
 * 	return ast.IsClassExpression(innerExpression) && innerExpression.Name() == nil && !ast.ClassOrConstructorParameterIsDecorated(false, innerExpression)
 * }
 */
export declare function canIgnoreEmptyStringLiteralInAssignedName(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitForStatement","kind":"method","status":"implemented","sigHash":"b94010f3cde89054e1360b6ae84d40b635a0d6387eedf480d0a79f63fa21181d","bodyHash":"c0b68dfbf01d3d37f2a777cd89c6c699167b663bf612b57721b43dfc2c8e225f"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitForStatement(node *ast.Node) *ast.Node {
 * 	f := tx.Factory()
 * 	forStmt := node.AsForStatement()
 * 	return f.UpdateForStatement(
 * 		forStmt,
 * 		tx.discardedVisitor.VisitNode(forStmt.Initializer),
 * 		tx.Visitor().VisitNode(forStmt.Condition),
 * 		tx.discardedVisitor.VisitNode(forStmt.Incrementor),
 * 		tx.EmitContext().VisitIterationBody(forStmt.Statement, tx.Visitor()),
 * 	)
 * }
 */
export declare function esDecoratorTransformer_visitForStatement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitExpressionStatement","kind":"method","status":"implemented","sigHash":"9ece62f7700ea316251d21621cd37d810709b8fabd24e227e8b29a01b88d9548","bodyHash":"d007644838357b94d6622ebf3931562dd549276a2fcdc95536a74b9ef22fdf40"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitExpressionStatement(node *ast.Node) *ast.Node {
 * 	return tx.discardedVisitor.VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitExpressionStatement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"fc6b5077a76e0374500057f43cd4a48cdb7a29e6096aec9de27abd8c399219d9","bodyHash":"9b7b798354e6e5d7609996e354a3046631fd97db8a5056420cd0fb5a279d3c0a"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitBinaryExpression(node *ast.Node, discarded bool) *ast.Node {
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 * 	bin := node.AsBinaryExpression()
 *
 * 	if ast.IsDestructuringAssignment(node) {
 * 		left := tx.visitAssignmentPattern(bin.Left)
 * 		right := tx.Visitor().VisitNode(bin.Right)
 * 		return f.UpdateBinaryExpression(bin, nil, left, nil, bin.OperatorToken, right)
 * 	}
 *
 * 	if ast.IsAssignmentExpression(node, false) {
 * 		// 13.15.2 RS: Evaluation
 * 		//   AssignmentExpression : LeftHandSideExpression `=` AssignmentExpression
 * 		//     1. If |LeftHandSideExpression| is neither an |ObjectLiteral| nor an |ArrayLiteral|, then
 * 		//        a. Let _lref_ be ? Evaluation of |LeftHandSideExpression|.
 * 		//        b. If IsAnonymousFunctionDefinition(|AssignmentExpression|) and IsIdentifierRef of |LeftHandSideExpression| are both *true*, then
 * 		//           i. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `&&=` AssignmentExpression
 * 		//     ...
 * 		//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `||=` AssignmentExpression
 * 		//     ...
 * 		//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `??=` AssignmentExpression
 * 		//     ...
 * 		//     4. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 *
 * 		if isNamedEvaluationAnd(ec, node, isAnonymousClassNeedingAssignedName) {
 * 			node = transformNamedEvaluation(ec, node, canIgnoreEmptyStringLiteralInAssignedName(bin.Right), "")
 * 			return tx.Visitor().VisitEachChild(node)
 * 		}
 *
 * 		if ast.IsSuperProperty(bin.Left) && tx.classThis != nil && tx.classSuper != nil {
 * 			var setterName *ast.Expression
 * 			if ast.IsElementAccessExpression(bin.Left) {
 * 				setterName = tx.Visitor().VisitNode(bin.Left.AsElementAccessExpression().ArgumentExpression)
 * 			} else if ast.IsPropertyAccessExpression(bin.Left) && ast.IsIdentifier(bin.Left.AsPropertyAccessExpression().Name()) {
 * 				setterName = f.NewStringLiteralFromNode(bin.Left.AsPropertyAccessExpression().Name())
 * 			}
 * 			if setterName != nil {
 * 				// super.x = ...
 * 				// super.x += ...
 * 				// super[x] = ...
 * 				// super[x] += ...
 * 				expression := tx.Visitor().VisitNode(bin.Right)
 * 				if ast.IsCompoundAssignment(bin.OperatorToken.Kind) {
 * 					getterName := setterName
 * 					if !transformers.IsSimpleInlineableExpression(setterName) {
 * 						getterName = f.NewTempVariable()
 * 						ec.AddVariableDeclaration(getterName)
 * 						setterName = f.NewAssignmentExpression(getterName, setterName)
 * 					}
 * 					superPropertyGet := f.NewReflectGetCall(tx.classSuper, getterName, tx.classThis)
 * 					ec.SetOriginal(superPropertyGet, bin.Left)
 * 					superPropertyGet.Loc = bin.Left.Loc
 * 					expression = f.AsNodeFactory().NewBinaryExpression(
 * 						nil,
 * 						superPropertyGet,
 * 						nil,
 * 						f.NewToken(transformers.GetNonAssignmentOperatorForCompoundAssignment(bin.OperatorToken.Kind)),
 * 						expression,
 * 					)
 * 					expression.Loc = node.Loc
 * 				}
 * 				var temp *ast.Expression
 * 				if !discarded {
 * 					temp = f.NewTempVariable()
 * 					ec.AddVariableDeclaration(temp)
 * 				}
 * 				if temp != nil {
 * 					expression = f.NewAssignmentExpression(temp, expression)
 * 					expression.Loc = node.Loc
 * 				}
 * 				expression = f.NewReflectSetCall(tx.classSuper, setterName, expression, tx.classThis)
 * 				ec.SetOriginal(expression, node)
 * 				expression.Loc = node.Loc
 * 				if temp != nil {
 * 					expression = f.NewCommaExpression(expression, temp)
 * 					expression.Loc = node.Loc
 * 				}
 * 				return expression
 * 			}
 * 		}
 * 	}
 *
 * 	if bin.OperatorToken.Kind == ast.KindCommaToken {
 * 		left := tx.discardedVisitor.VisitNode(bin.Left)
 * 		var right *ast.Node
 * 		if discarded {
 * 			right = tx.discardedVisitor.VisitNode(bin.Right)
 * 		} else {
 * 			right = tx.Visitor().VisitNode(bin.Right)
 * 		}
 * 		return f.UpdateBinaryExpression(bin, nil, left, nil, bin.OperatorToken, right)
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitBinaryExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitPreOrPostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"6d206b64986a5834a16dfe4c61b5697d2f79674cbfe9152ff7ce29f222b3cfc4","bodyHash":"970d59af85839a881a5f1cde2c3c1f234676b50d580e88d3235bea47bca33af7"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitPreOrPostfixUnaryExpression(node *ast.Node, discarded bool) *ast.Node {
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 *
 * 	var operator ast.Kind
 * 	var operandNode *ast.Node
 * 	if ast.IsPrefixUnaryExpression(node) {
 * 		operator = node.AsPrefixUnaryExpression().Operator
 * 		operandNode = node.AsPrefixUnaryExpression().Operand
 * 	} else {
 * 		operator = node.AsPostfixUnaryExpression().Operator
 * 		operandNode = node.AsPostfixUnaryExpression().Operand
 * 	}
 *
 * 	if operator == ast.KindPlusPlusToken || operator == ast.KindMinusMinusToken {
 * 		operand := ast.SkipParentheses(operandNode)
 * 		if ast.IsSuperProperty(operand) && tx.classThis != nil && tx.classSuper != nil {
 * 			var setterName *ast.Expression
 * 			if ast.IsElementAccessExpression(operand) {
 * 				setterName = tx.Visitor().VisitNode(operand.AsElementAccessExpression().ArgumentExpression)
 * 			} else if ast.IsPropertyAccessExpression(operand) && ast.IsIdentifier(operand.AsPropertyAccessExpression().Name()) {
 * 				setterName = f.NewStringLiteralFromNode(operand.AsPropertyAccessExpression().Name())
 * 			}
 * 			if setterName != nil {
 * 				getterName := setterName
 * 				if !transformers.IsSimpleInlineableExpression(setterName) {
 * 					getterName = f.NewTempVariable()
 * 					ec.AddVariableDeclaration(getterName)
 * 					setterName = f.NewAssignmentExpression(getterName, setterName)
 * 				}
 *
 * 				expression := f.NewReflectGetCall(tx.classSuper, getterName, tx.classThis)
 * 				ec.SetOriginal(expression, node)
 * 				expression.Loc = node.Loc
 *
 * 				// If the result of this expression is discarded (i.e., it's in a position where the result
 * 				// will be otherwise unused, such as in an expression statement or the left side of a comma), we
 * 				// don't need to create an extra temp variable to hold the result:
 * 				//
 * 				//  source (discarded):
 * 				//    super.x++;
 * 				//  generated:
 * 				//    _a = Reflect.get(_super, "x"), _a++, Reflect.set(_super, "x", _a);
 * 				//
 * 				// Above, the temp variable `_a` is used to perform the correct coercion (i.e., number or
 * 				// bigint). Since the result of the postfix unary is discarded, we don't need to capture the
 * 				// result of the expression.
 * 				//
 * 				//  source (not discarded):
 * 				//    y = super.x++;
 * 				//  generated:
 * 				//    y = (_a = Reflect.get(_super, "x"), _b = _a++, Reflect.set(_super, "x", _a), _b);
 * 				//
 * 				// When the result isn't discarded, we introduce a new temp variable (`_b`) to capture the
 * 				// result of the operation so that we can provide it to `y` when the assignment is complete.
 * 				var temp *ast.IdentifierNode
 * 				if !discarded {
 * 					temp = f.NewTempVariable()
 * 					ec.AddVariableDeclaration(temp)
 * 				}
 *
 * 				expression = expandPreOrPostfixIncrementOrDecrementExpression(f, ec, node, expression, temp)
 *
 * 				expression = f.NewReflectSetCall(tx.classSuper, setterName, expression, tx.classThis)
 * 				ec.SetOriginal(expression, node)
 * 				expression.Loc = node.Loc
 *
 * 				if temp != nil {
 * 					expression = f.NewCommaExpression(expression, temp)
 * 					expression.Loc = node.Loc
 * 				}
 *
 * 				return expression
 * 			}
 * 		}
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitPreOrPostfixUnaryExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitReferencedPropertyName","kind":"method","status":"implemented","sigHash":"4c7d5245c7c8f7e54edb35fcc29aa12da8d46dc2c90953e02be877c57fb62a1e","bodyHash":"c46dac2752b92b0fa910de5778d56c53a8a8f694eae7cd277c60dd89c30f8bbc"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitReferencedPropertyName(node *ast.Node) (*ast.Expression, *ast.Node) {
 * 	if ast.IsPropertyNameLiteral(node) || ast.IsPrivateIdentifier(node) {
 * 		return tx.Factory().NewStringLiteralFromNode(node), tx.Visitor().VisitNode(node)
 * 	}
 *
 * 	cpn := node.AsComputedPropertyName()
 * 	if ast.IsPropertyNameLiteral(cpn.Expression) && !ast.IsIdentifier(cpn.Expression) {
 * 		return tx.Factory().NewStringLiteralFromNode(cpn.Expression), tx.Visitor().VisitNode(node)
 * 	}
 *
 * 	referencedName := tx.Factory().NewGeneratedNameForNode(node)
 * 	tx.EmitContext().AddVariableDeclaration(referencedName)
 *
 * 	key := tx.Factory().NewPropKeyHelper(tx.Visitor().VisitNode(cpn.Expression))
 * 	assignment := tx.Factory().NewAssignmentExpression(referencedName, key)
 * 	updatedName := tx.Factory().UpdateComputedPropertyName(cpn, tx.injectPendingExpressions(assignment))
 * 	return referencedName, updatedName
 * }
 */
export declare function esDecoratorTransformer_visitReferencedPropertyName(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): [GoPtr<Expression>, GoPtr<Node>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitPropertyName","kind":"method","status":"implemented","sigHash":"1d834d7d54459ae07ffd4eca179843dde5051537abd8df2204d2f52878f0b7df","bodyHash":"4f13060986b83218e5f56b9925b3f5d062d7b9b387dedb675c756e160f9323ec"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitPropertyName(node *ast.Node) *ast.Node {
 * 	if ast.IsComputedPropertyName(node) {
 * 		return tx.visitComputedPropertyName(node)
 * 	}
 * 	return tx.Visitor().VisitNode(node)
 * }
 */
export declare function esDecoratorTransformer_visitPropertyName(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitComputedPropertyName","kind":"method","status":"implemented","sigHash":"aee4754d8544fa33f4fe241261a8c15cbde29d12790605445d1f4f9e5ff74a39","bodyHash":"0af8c2b786d30a5b1b038cce417fe0d9a60f6130e95dbf42b999d9824b079603"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitComputedPropertyName(node *ast.Node) *ast.Node {
 * 	cpn := node.AsComputedPropertyName()
 * 	expression := tx.Visitor().VisitNode(cpn.Expression)
 * 	if !transformers.IsSimpleInlineableExpression(expression) {
 * 		expression = tx.injectPendingExpressions(expression)
 * 	}
 * 	return tx.Factory().UpdateComputedPropertyName(cpn, expression)
 * }
 */
export declare function esDecoratorTransformer_visitComputedPropertyName(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitDestructuringAssignmentTarget","kind":"method","status":"implemented","sigHash":"4aa992fecc54d45d5d5a7ef4c5708228a7230eaa00648988db9a8e1ff7c3483f","bodyHash":"26901737afcfa55648bc66e7954c5a7e7baedff73b3f0545668c829e6ea2fc93"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitDestructuringAssignmentTarget(node *ast.Node) *ast.Node {
 * 	if ast.IsObjectLiteralExpression(node) || ast.IsArrayLiteralExpression(node) {
 * 		return tx.visitAssignmentPattern(node)
 * 	}
 *
 * 	if ast.IsSuperProperty(node) && tx.classThis != nil && tx.classSuper != nil {
 * 		f := tx.Factory()
 * 		ec := tx.EmitContext()
 * 		var propertyName *ast.Expression
 * 		if ast.IsElementAccessExpression(node) {
 * 			propertyName = tx.Visitor().VisitNode(node.AsElementAccessExpression().ArgumentExpression)
 * 		} else if ast.IsPropertyAccessExpression(node) && ast.IsIdentifier(node.AsPropertyAccessExpression().Name()) {
 * 			propertyName = f.NewStringLiteralFromNode(node.AsPropertyAccessExpression().Name())
 * 		}
 * 		if propertyName != nil {
 * 			paramName := f.NewTempVariable()
 * 			expression := f.NewAssignmentTargetWrapper(
 * 				paramName,
 * 				f.NewReflectSetCall(
 * 					tx.classSuper,
 * 					propertyName,
 * 					paramName,
 * 					tx.classThis,
 * 				),
 * 			)
 * 			ec.SetOriginal(expression, node)
 * 			expression.Loc = node.Loc
 * 			return expression
 * 		}
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitDestructuringAssignmentTarget(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitAssignmentElement","kind":"method","status":"implemented","sigHash":"263494fdbb174f4ec3565c4a1dc63aba62729f3f8a83b6ff651ae9e99c82168a","bodyHash":"9238688b2532179436ddb49efc815861e8e088fe8499674f4092b8a16089efb5"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitAssignmentElement(node *ast.Node) *ast.Node {
 * 	// 13.15.5.5 RS: IteratorDestructuringAssignmentEvaluation
 * 	//   AssignmentElement : DestructuringAssignmentTarget Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _value_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
 * 	//           i. Let _v_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 	if ast.IsAssignmentExpression(node, true /*excludeCompoundAssignment* /) {
 * 		f := tx.Factory()
 * 		bin := node.AsBinaryExpression()
 * 		if isNamedEvaluationAnd(tx.EmitContext(), node, isAnonymousClassNeedingAssignedName) {
 * 			node = transformNamedEvaluation(tx.EmitContext(), node, canIgnoreEmptyStringLiteralInAssignedName(bin.Right), "")
 * 			bin = node.AsBinaryExpression()
 * 		}
 * 		assignmentTarget := tx.visitDestructuringAssignmentTarget(bin.Left)
 * 		initializer := tx.Visitor().VisitNode(bin.Right)
 * 		return f.UpdateBinaryExpression(bin, nil, assignmentTarget, nil, bin.OperatorToken, initializer)
 * 	}
 * 	return tx.visitDestructuringAssignmentTarget(node)
 * }
 */
export declare function esDecoratorTransformer_visitAssignmentElement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitAssignmentRestElement","kind":"method","status":"implemented","sigHash":"7e1a2145e2f8f50d73a74b87cc2f2a997d2738e7fb4fb071c2c35ce20308d3c8","bodyHash":"9b2409b2960155a12e5ca62907416188a77d24c1828ce7d53aa54424a3922e3b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitAssignmentRestElement(node *ast.Node) *ast.Node {
 * 	se := node.AsSpreadElement()
 * 	if ast.IsLeftHandSideExpression(se.Expression) {
 * 		f := tx.Factory()
 * 		expression := tx.visitDestructuringAssignmentTarget(se.Expression)
 * 		return f.UpdateSpreadElement(se, expression)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitAssignmentRestElement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitArrayAssignmentElement","kind":"method","status":"implemented","sigHash":"ac84e1fb739a64e2e3012466e3134aafa1045a3c9df60b6d379a9878ba84e90c","bodyHash":"f563f3d78b391cd8493328fff949978df08036cea0a087631c2b6334922a2dea"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitArrayAssignmentElement(node *ast.Node) *ast.Node {
 * 	debug.Assert(ast.IsArrayBindingOrAssignmentElement(node))
 * 	if ast.IsSpreadElement(node) {
 * 		return tx.visitAssignmentRestElement(node)
 * 	}
 * 	if !ast.IsOmittedExpression(node) {
 * 		return tx.visitAssignmentElement(node)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitArrayAssignmentElement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitAssignmentPropertyNode","kind":"method","status":"implemented","sigHash":"e9b2399cd431c72087a17de45c53e34f9c3ccab6ed3a4902853dc56eb8ae33e6","bodyHash":"fb2215a11e6042a4e90616425fde2548171efe156ce7700ed984db0a43ffe87b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitAssignmentPropertyNode(node *ast.Node) *ast.Node {
 * 	// AssignmentProperty : PropertyName `:` AssignmentElement
 * 	// AssignmentElement : DestructuringAssignmentTarget Initializer?
 *
 * 	// 13.15.5.6 RS: KeyedDestructuringAssignmentEvaluation
 * 	//   AssignmentElement : DestructuringAssignmentTarget Initializer?
 * 	//     ...
 * 	//     3. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousfunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
 * 	//           i. Let _rhsValue_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 *
 * 	f := tx.Factory()
 * 	pa := node.AsPropertyAssignment()
 * 	name := tx.Visitor().VisitNode(pa.Name())
 * 	if ast.IsAssignmentExpression(pa.Initializer, true /*excludeCompoundAssignment* /) {
 * 		assignmentElement := tx.visitAssignmentElement(pa.Initializer)
 * 		return f.UpdatePropertyAssignment(pa, nil, name, nil, nil, assignmentElement)
 * 	}
 * 	if ast.IsLeftHandSideExpression(pa.Initializer) {
 * 		assignmentElement := tx.visitDestructuringAssignmentTarget(pa.Initializer)
 * 		return f.UpdatePropertyAssignment(pa, nil, name, nil, nil, assignmentElement)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitAssignmentPropertyNode(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitShorthandAssignmentProperty","kind":"method","status":"implemented","sigHash":"d3513be894a8a09a5b8e5eb3d8fce4b7f3234430919761d590553b8d4dc746ae","bodyHash":"f85b32b26dbd02b076a9818b1f3b62d47b84ec9f478d039b8313648931e360ec"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitShorthandAssignmentProperty(node *ast.Node) *ast.Node {
 * 	// AssignmentProperty : IdentifierReference Initializer?
 *
 * 	// 13.15.5.3 RS: PropertyDestructuringAssignmentEvaluation
 * 	//   AssignmentProperty : IdentifierReference Initializer?
 * 	//     ...
 * 	//     4. If |Initializer?| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _P_.
 * 	//     ...
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node, isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node, canIgnoreEmptyStringLiteralInAssignedName(node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer), "")
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitShorthandAssignmentProperty(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitAssignmentRestProperty","kind":"method","status":"implemented","sigHash":"cb62133c090717df26dd55f7a64bc4f3667b88e5ea00d37862430d77c7c5a544","bodyHash":"1933c2dc57d09a5ab99789c9d1bae35d774719f4e04bd3621d6c139684e49c6b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitAssignmentRestProperty(node *ast.Node) *ast.Node {
 * 	sa := node.AsSpreadAssignment()
 * 	if ast.IsLeftHandSideExpression(sa.Expression) {
 * 		f := tx.Factory()
 * 		expression := tx.visitDestructuringAssignmentTarget(sa.Expression)
 * 		return f.UpdateSpreadAssignment(sa, expression)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitAssignmentRestProperty(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitObjectAssignmentElement","kind":"method","status":"implemented","sigHash":"0ec1b13e7d6374e0c7c6917c00c9098ef8fc78dcd78351e543ab99b2b553bb4e","bodyHash":"11cd8b10e8fbbeea14407b02c44d58c8f2760b71a6a0d82cf4ffddd14656d5ea"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitObjectAssignmentElement(node *ast.Node) *ast.Node {
 * 	debug.Assert(ast.IsObjectBindingOrAssignmentElement(node))
 * 	if ast.IsSpreadAssignment(node) {
 * 		return tx.visitAssignmentRestProperty(node)
 * 	}
 * 	if ast.IsShorthandPropertyAssignment(node) {
 * 		return tx.visitShorthandAssignmentProperty(node)
 * 	}
 * 	if ast.IsPropertyAssignment(node) {
 * 		return tx.visitAssignmentPropertyNode(node)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function esDecoratorTransformer_visitObjectAssignmentElement(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitAssignmentPattern","kind":"method","status":"implemented","sigHash":"9f9eae48991ec6f7131416d08f5158884a908a6d08b3cfa095b04b484c2e297e","bodyHash":"7dd7ea608bfa6b708fcce0e6f0ffcc1ddcca3df3a4ac9e96fe03d84f2bc6c167"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitAssignmentPattern(node *ast.Node) *ast.Node {
 * 	f := tx.Factory()
 * 	if ast.IsArrayLiteralExpression(node) {
 * 		ale := node.AsArrayLiteralExpression()
 * 		elements := tx.arrayAssignmentVisitor.VisitNodes(ale.Elements)
 * 		return f.UpdateArrayLiteralExpression(ale, elements, ale.MultiLine)
 * 	}
 * 	ole := node.AsObjectLiteralExpression()
 * 	properties := tx.objectAssignmentVisitor.VisitNodes(ole.Properties)
 * 	return f.UpdateObjectLiteralExpression(ole, properties, ole.MultiLine)
 * }
 */
export declare function esDecoratorTransformer_visitAssignmentPattern(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitExportAssignment","kind":"method","status":"implemented","sigHash":"0dcac4ed626217133aaf5ac871cee440d081e4068441140ef750c75830ed8f5d","bodyHash":"47f1dd8642b1e9b751acf4c9eaf2de408b82ac9d043f45c1bb772f4f5d0fb56b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitExportAssignment(node *ast.Node) *ast.Node {
 * 	// 16.2.3.7 RS: Evaluation
 * 	//   ExportDeclaration : `export` `default` AssignmentExpression `;`
 * 	//     1. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |AssignmentExpression| with argument `"default"`.
 * 	//     ...
 * 	return tx.visitNamedEvaluationSite(node, node.Expression())
 * }
 */
export declare function esDecoratorTransformer_visitExportAssignment(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"cf4a3b06c4b9a43b90b8cc45dcabf7e43f2a184114de0e115f017c9ed87e9533","bodyHash":"97f936da409bf49fabb84f2c1d74a6aa3d0bcba4e9dc8fa9511034b5f6170a11"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitParenthesizedExpression(node *ast.Node, discarded bool) *ast.Node {
 * 	// 8.4.5 RS: NamedEvaluation
 * 	//   ParenthesizedExpression : `(` Expression `)`
 * 	//     ...
 * 	//     2. Return ? NamedEvaluation of |Expression| with argument _name_.
 *
 * 	f := tx.Factory()
 * 	pe := node.AsParenthesizedExpression()
 * 	var expression *ast.Node
 * 	if discarded {
 * 		expression = tx.discardedVisitor.VisitNode(pe.Expression)
 * 	} else {
 * 		expression = tx.Visitor().VisitNode(pe.Expression)
 * 	}
 * 	return f.UpdateParenthesizedExpression(pe, expression)
 * }
 */
export declare function esDecoratorTransformer_visitParenthesizedExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.visitPartiallyEmittedExpression","kind":"method","status":"implemented","sigHash":"9ac3fe754bbdf8ba2b6d42adcf53e85c16389b637bd0a389ff39ede6644ded8e","bodyHash":"d8a06cb232b9072b327b6f23662fe4e7788f14252cafa92dd40923e44206ad84"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) visitPartiallyEmittedExpression(node *ast.Node, discarded bool) *ast.Node {
 * 	// Emulates 8.4.5 RS: NamedEvaluation
 * 	pe := node.AsPartiallyEmittedExpression()
 * 	var expression *ast.Node
 * 	if discarded {
 * 		expression = tx.discardedVisitor.VisitNode(pe.Expression)
 * 	} else {
 * 		expression = tx.Visitor().VisitNode(pe.Expression)
 * 	}
 * 	return tx.Factory().UpdatePartiallyEmittedExpression(pe, expression)
 * }
 */
export declare function esDecoratorTransformer_visitPartiallyEmittedExpression(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.prependExpressions","kind":"method","status":"implemented","sigHash":"4b105178398cb2703a7813b9f4f5a61f75520112a7c6fc6933d62f2b364aca33","bodyHash":"cba9e20376065cb7502948f3fc8a1a4cac973bff5e75bbb723767f5654c15bd2"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) prependExpressions(pending []*ast.Expression, expression *ast.Expression) *ast.Expression {
 * 	f := tx.Factory()
 * 	if len(pending) == 0 {
 * 		return expression
 * 	}
 * 	if expression == nil {
 * 		return f.InlineExpressions(pending)
 * 	}
 * 	if ast.IsParenthesizedExpression(expression) {
 * 		pe := expression.AsParenthesizedExpression()
 * 		exprs := make([]*ast.Expression, len(pending)+1)
 * 		copy(exprs, pending)
 * 		exprs[len(pending)] = pe.Expression
 * 		return f.UpdateParenthesizedExpression(pe, f.InlineExpressions(exprs))
 * 	}
 * 	exprs := make([]*ast.Expression, len(pending)+1)
 * 	copy(exprs, pending)
 * 	exprs[len(pending)] = expression
 * 	return f.InlineExpressions(exprs)
 * }
 */
export declare function esDecoratorTransformer_prependExpressions(receiver: GoPtr<esDecoratorTransformer>, pending: GoSlice<GoPtr<Expression>>, expression: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.injectPendingExpressions","kind":"method","status":"implemented","sigHash":"3ffc9c5e311d7016ee2a505cc8af90c768354071c64f9655c290c29133868534","bodyHash":"4dc525d33906fa6bcac32349cefccb5c3b5c6fd9f89fec010353d33a9e0ff6ff"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) injectPendingExpressions(expression *ast.Expression) *ast.Expression {
 * 	result := tx.prependExpressions(tx.pendingExpressions, expression)
 * 	debug.Assert(result != nil)
 * 	if result != expression {
 * 		tx.pendingExpressions = nil
 * 	}
 * 	return result
 * }
 */
export declare function esDecoratorTransformer_injectPendingExpressions(receiver: GoPtr<esDecoratorTransformer>, expression: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.injectPendingInitializers","kind":"method","status":"implemented","sigHash":"c77713618206ab99fe6cb850700400df4dbee5af502af4a0ead18e1a4f7bf9f8","bodyHash":"2e171f8f85dcdca7b1e75a8ba8635dba6036c5669daff8a11142dc93e8cf96a9"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) injectPendingInitializers(ci *classInfo, isStatic bool, expression *ast.Expression) *ast.Expression {
 * 	var pending *[]*ast.Expression
 * 	if isStatic {
 * 		pending = &ci.pendingStaticInitializers
 * 	} else {
 * 		pending = &ci.pendingInstanceInitializers
 * 	}
 * 	result := tx.prependExpressions(*pending, expression)
 * 	if result != expression {
 * 		*pending = nil
 * 	}
 * 	return result
 * }
 */
export declare function esDecoratorTransformer_injectPendingInitializers(receiver: GoPtr<esDecoratorTransformer>, ci: GoPtr<classInfo>, isStatic: bool, expression: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.transformAllDecoratorsOfDeclaration","kind":"method","status":"implemented","sigHash":"5fee98380f8d0cca3dc2f35dfb773936ee06b4e309ca8bce73ab95ab55b9f264","bodyHash":"33af8734708a43955cbb03f74920582056d6860a23ba157ffd6af23ebbdacd6d"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) transformAllDecoratorsOfDeclaration(decorators []*ast.Node) []*ast.Expression {
 * 	if len(decorators) == 0 {
 * 		return nil
 * 	}
 * 	result := make([]*ast.Expression, 0, len(decorators))
 * 	for _, d := range decorators {
 * 		result = append(result, tx.transformDecorator(d))
 * 	}
 * 	return result
 * }
 */
export declare function esDecoratorTransformer_transformAllDecoratorsOfDeclaration(receiver: GoPtr<esDecoratorTransformer>, decorators: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Expression>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.transformDecorator","kind":"method","status":"implemented","sigHash":"041babbbdb49b89bed5962e9de7ec457312bf6762a56e9bd0a45b6bc25016ae0","bodyHash":"affe33611704c31f68773883fda8066b5739025243ee08d40e34c03b2778e701"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) transformDecorator(decorator *ast.Node) *ast.Expression {
 * 	expression := tx.Visitor().VisitNode(decorator.AsDecorator().Expression)
 * 	tx.EmitContext().SetEmitFlags(expression, printer.EFNoComments)
 *
 * 	// preserve the 'this' binding for an access expression
 * 	innerExpression := ast.SkipOuterExpressions(expression, ast.OEKAll)
 * 	if ast.IsAccessExpression(innerExpression) {
 * 		target, thisArg := tx.createCallBinding(expression)
 * 		bindCall := tx.Factory().NewFunctionBindCall(target, thisArg, nil)
 * 		return tx.Factory().RestoreOuterExpressions(expression, bindCall, ast.OEKAll)
 * 	}
 * 	return expression
 * }
 */
export declare function esDecoratorTransformer_transformDecorator(receiver: GoPtr<esDecoratorTransformer>, decorator: GoPtr<Node>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createCallBinding","kind":"method","status":"implemented","sigHash":"6c51f9e8f13a5eee2f232388dc146475781983d7077fcbd0795011f747567b8f","bodyHash":"05300884fde871854deb51f43c402ef8bf8c29114af3b99e7a95bef741352ad4"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createCallBinding(expression *ast.Expression) (*ast.Expression, *ast.Expression) {
 * 	f := tx.Factory()
 * 	callee := ast.SkipOuterExpressions(expression, ast.OEKAll)
 * 	if ast.IsSuperProperty(callee) {
 * 		return callee, f.NewThisExpression()
 * 	}
 * 	if callee.Kind == ast.KindSuperKeyword {
 * 		return callee, f.NewThisExpression()
 * 	}
 * 	if tx.EmitContext().EmitFlags(callee)&printer.EFHelperName != 0 {
 * 		return callee, f.NewVoidZeroExpression()
 * 	}
 * 	if ast.IsPropertyAccessExpression(callee) {
 * 		pa := callee.AsPropertyAccessExpression()
 * 		if tx.shouldBeCapturedInTempVariable(pa.Expression) {
 * 			thisArg := f.NewTempVariable()
 * 			tx.EmitContext().AddVariableDeclaration(thisArg)
 * 			assign := f.NewAssignmentExpression(thisArg, pa.Expression)
 * 			assign.Loc = pa.Expression.Loc
 * 			target := f.NewPropertyAccessExpression(assign, nil, pa.Name(), ast.NodeFlagsNone)
 * 			target.Loc = callee.Loc
 * 			return target, thisArg
 * 		}
 * 		return callee, pa.Expression
 * 	}
 * 	if ast.IsElementAccessExpression(callee) {
 * 		ea := callee.AsElementAccessExpression()
 * 		if tx.shouldBeCapturedInTempVariable(ea.Expression) {
 * 			thisArg := f.NewTempVariable()
 * 			tx.EmitContext().AddVariableDeclaration(thisArg)
 * 			assign := f.NewAssignmentExpression(thisArg, ea.Expression)
 * 			assign.Loc = ea.Expression.Loc
 * 			target := f.NewElementAccessExpression(assign, nil, ea.ArgumentExpression, ast.NodeFlagsNone)
 * 			target.Loc = callee.Loc
 * 			return target, thisArg
 * 		}
 * 		return callee, ea.Expression
 * 	}
 * 	return expression, f.NewVoidZeroExpression()
 * }
 */
export declare function esDecoratorTransformer_createCallBinding(receiver: GoPtr<esDecoratorTransformer>, expression: GoPtr<Expression>): [GoPtr<Expression>, GoPtr<Expression>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.shouldBeCapturedInTempVariable","kind":"method","status":"implemented","sigHash":"1cd75c59664fc21353883aec9d164338b7b6f00b5e22a3dcd200d3b6170193a8","bodyHash":"584cf4dff07b0ad67d745cf0e5e3b8e8bc4657bc3df7216551cb4fdfe9459362"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) shouldBeCapturedInTempVariable(node *ast.Expression) bool {
 * 	// This is a simplified version of the general shouldBeCapturedInTempVariable from
 * 	// nodeFactory with cacheIdentifiers=true, since createCallBinding in this transform
 * 	// always caches identifiers.
 * 	target := ast.SkipParentheses(node)
 * 	switch target.Kind {
 * 	case ast.KindIdentifier:
 * 		// cacheIdentifiers is always true for this transform's createCallBinding
 * 		return true
 * 	case ast.KindThisKeyword,
 * 		ast.KindNumericLiteral,
 * 		ast.KindBigIntLiteral,
 * 		ast.KindStringLiteral:
 * 		return false
 * 	default:
 * 		return true
 * 	}
 * }
 */
export declare function esDecoratorTransformer_shouldBeCapturedInTempVariable(receiver: GoPtr<esDecoratorTransformer>, node: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createDescriptorMethod","kind":"method","status":"implemented","sigHash":"226c29e32c9bf2c55c93c2db00b290d6ebc50792c1bd7d052986fe23c2e2d772","bodyHash":"4a2a282e463a48de5c952d7fb6528cd80bd335f4d6a31f89f68c2d82160d3319"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createDescriptorMethod(
 * 	original *ast.Node,
 * 	name *ast.Node, // PrivateIdentifier
 * 	modifiers *ast.ModifierList,
 * 	asteriskToken *ast.TokenNode,
 * 	kind string,
 * 	parameters *ast.NodeList,
 * 	body *ast.Node,
 * ) *ast.Node {
 * 	f := tx.Factory()
 * 	ec := tx.EmitContext()
 *
 * 	if body == nil {
 * 		body = f.NewBlock(f.NewNodeList([]*ast.Node{}), false)
 * 	}
 *
 * 	funcExpr := f.NewFunctionExpression(
 * 		modifiers,
 * 		asteriskToken,
 * 		nil, // name
 * 		nil, // typeParameters
 * 		parameters,
 * 		nil, // type
 * 		nil, // fullSignature
 * 		body,
 * 	)
 * 	ec.SetOriginal(funcExpr, original)
 * 	ec.SetSourceMapRange(funcExpr, transformers.MoveRangePastDecorators(original))
 * 	ec.SetEmitFlags(funcExpr, printer.EFNoComments)
 *
 * 	var prefix string
 * 	if kind == "get" || kind == "set" {
 * 		prefix = kind
 * 	}
 * 	functionName := f.NewStringLiteralFromNode(name)
 * 	namedFunction := f.NewSetFunctionNameHelper(funcExpr, functionName, prefix)
 *
 * 	method := f.NewPropertyAssignment(nil, f.NewIdentifier(kind), nil, nil, namedFunction)
 * 	ec.SetOriginal(method, original)
 * 	ec.SetSourceMapRange(method, transformers.MoveRangePastDecorators(original))
 * 	ec.SetEmitFlags(method, printer.EFNoComments)
 * 	return method
 * }
 */
export declare function esDecoratorTransformer_createDescriptorMethod(receiver: GoPtr<esDecoratorTransformer>, original: GoPtr<Node>, name: GoPtr<Node>, modifiers: GoPtr<ModifierList>, asteriskToken: GoPtr<TokenNode>, kind: string, parameters: GoPtr<NodeList>, body: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createMethodDescriptorObject","kind":"method","status":"implemented","sigHash":"06ba01c8f90f00c1e17856834e0a637fd06135907d8626e5cd71832b19c6b2ec","bodyHash":"2513b429f6915d5089014a5168909cfc6080bad9ceacafee282cb5714ba36460"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createMethodDescriptorObject(member *ast.Node, modifiers *ast.ModifierList) *ast.Expression {
 * 	f := tx.Factory()
 * 	parameters := tx.Visitor().VisitNodes(member.ParameterList())
 * 	body := tx.Visitor().VisitNode(member.Body())
 * 	method := member.AsMethodDeclaration()
 * 	return f.NewObjectLiteralExpression(
 * 		f.NewNodeList([]*ast.Node{
 * 			tx.createDescriptorMethod(member, member.Name(), modifiers, method.AsteriskToken, "value", parameters, body),
 * 		}),
 * 		false,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createMethodDescriptorObject(receiver: GoPtr<esDecoratorTransformer>, member: GoPtr<Node>, modifiers: GoPtr<ModifierList>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createGetAccessorDescriptorObject","kind":"method","status":"implemented","sigHash":"643badf7140fbe90541a86b32088f4557693e771038e2b7ef5c31c7a3c299820","bodyHash":"a526fde67a3d7eb7c3c2c07c834c3d475c57d5de2f0ff83282e649248c94f9d4"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createGetAccessorDescriptorObject(member *ast.Node, modifiers *ast.ModifierList) *ast.Expression {
 * 	f := tx.Factory()
 * 	body := tx.Visitor().VisitNode(member.Body())
 * 	return f.NewObjectLiteralExpression(
 * 		f.NewNodeList([]*ast.Node{
 * 			tx.createDescriptorMethod(member, member.Name(), modifiers, nil, "get", f.NewNodeList([]*ast.Node{}), body),
 * 		}),
 * 		false,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createGetAccessorDescriptorObject(receiver: GoPtr<esDecoratorTransformer>, member: GoPtr<Node>, modifiers: GoPtr<ModifierList>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createSetAccessorDescriptorObject","kind":"method","status":"implemented","sigHash":"30d48a5bae6f9e2e7011d93538a991109326e5ab051ed362484644336926952f","bodyHash":"71d84c001d38af1735a2a6019f2f4d00e5c629bd474e43bce50313adc153901b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createSetAccessorDescriptorObject(member *ast.Node, modifiers *ast.ModifierList) *ast.Expression {
 * 	f := tx.Factory()
 * 	parameters := tx.Visitor().VisitNodes(member.ParameterList())
 * 	body := tx.Visitor().VisitNode(member.Body())
 * 	return f.NewObjectLiteralExpression(
 * 		f.NewNodeList([]*ast.Node{
 * 			tx.createDescriptorMethod(member, member.Name(), modifiers, nil, "set", parameters, body),
 * 		}),
 * 		false,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createSetAccessorDescriptorObject(receiver: GoPtr<esDecoratorTransformer>, member: GoPtr<Node>, modifiers: GoPtr<ModifierList>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createAccessorPropertyDescriptorObject","kind":"method","status":"implemented","sigHash":"79c03f1bae1daa2fe173a31a13e727e6839250efc1df8fdbe48a193f8779984f","bodyHash":"18284814ae487143f255e6f52eb003813dfb0a2d201587c05bd21f977335143b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createAccessorPropertyDescriptorObject(member *ast.Node, _ *ast.ModifierList) *ast.Expression {
 * 	//  {
 * 	//      get() { return this.${privateName}; },
 * 	//      set(value) { this.${privateName} = value; },
 * 	//  }
 * 	f := tx.Factory()
 * 	backingFieldName := f.NewGeneratedPrivateNameForNodeEx(member.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"})
 * 	return f.NewObjectLiteralExpression(
 * 		f.NewNodeList([]*ast.Node{
 * 			tx.createDescriptorMethod(
 * 				member, member.Name(), nil, nil, "get",
 * 				f.NewNodeList([]*ast.Node{}),
 * 				f.NewBlock(f.NewNodeList([]*ast.Node{
 * 					f.NewReturnStatement(
 * 						f.NewPropertyAccessExpression(f.NewThisExpression(), nil, backingFieldName, ast.NodeFlagsNone),
 * 					),
 * 				}), false),
 * 			),
 * 			tx.createDescriptorMethod(
 * 				member, member.Name(), nil, nil, "set",
 * 				f.NewNodeList([]*ast.Node{
 * 					f.NewParameterDeclaration(nil, nil, f.NewIdentifier("value"), nil, nil, nil),
 * 				}),
 * 				f.NewBlock(f.NewNodeList([]*ast.Node{
 * 					f.NewExpressionStatement(
 * 						f.NewAssignmentExpression(
 * 							f.NewPropertyAccessExpression(f.NewThisExpression(), nil, backingFieldName, ast.NodeFlagsNone),
 * 							f.NewIdentifier("value"),
 * 						),
 * 					),
 * 				}), false),
 * 			),
 * 		}),
 * 		false,
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createAccessorPropertyDescriptorObject(receiver: GoPtr<esDecoratorTransformer>, member: GoPtr<Node>, arg: GoPtr<ModifierList>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createMethodDescriptorForwarder","kind":"method","status":"implemented","sigHash":"2ba4795d38854f711cc6e9869760d67461088260b46aa683a41a963651dad05c","bodyHash":"1950edb98d81c0648cbbae2018eb53118434740ad560a633b8f8fe7d217c52ca"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createMethodDescriptorForwarder(modifiers *ast.ModifierList, name *ast.Node, descriptorName *ast.IdentifierNode) *ast.Node {
 * 	f := tx.Factory()
 * 	staticOnly := tx.staticOnlyModifierVisitor.VisitModifiers(modifiers)
 * 	return f.NewGetAccessorDeclaration(
 * 		staticOnly,
 * 		name,
 * 		nil, // typeParameters
 * 		f.NewNodeList([]*ast.Node{}),
 * 		nil, // type
 * 		nil, // fullSignature
 * 		f.NewBlock(f.NewNodeList([]*ast.Node{
 * 			f.NewReturnStatement(
 * 				f.NewPropertyAccessExpression(descriptorName, nil, f.NewIdentifier("value"), ast.NodeFlagsNone),
 * 			),
 * 		}), false),
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createMethodDescriptorForwarder(receiver: GoPtr<esDecoratorTransformer>, modifiers: GoPtr<ModifierList>, name: GoPtr<Node>, descriptorName: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createGetAccessorDescriptorForwarder","kind":"method","status":"implemented","sigHash":"ccb82363be6c88821a6b393ed2902b364a005503527f0853aaf3cc06acacbd13","bodyHash":"a4e311081dea54324727f5c1e0fc0d6f61803897dad89f7993771effe8865f8b"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createGetAccessorDescriptorForwarder(modifiers *ast.ModifierList, name *ast.Node, descriptorName *ast.IdentifierNode) *ast.Node {
 * 	f := tx.Factory()
 * 	staticOnly := tx.staticOnlyModifierVisitor.VisitModifiers(modifiers)
 * 	return f.NewGetAccessorDeclaration(
 * 		staticOnly,
 * 		name,
 * 		nil, // typeParameters
 * 		f.NewNodeList([]*ast.Node{}),
 * 		nil, // type
 * 		nil, // fullSignature
 * 		f.NewBlock(f.NewNodeList([]*ast.Node{
 * 			f.NewReturnStatement(
 * 				f.NewFunctionCallCall(
 * 					f.NewPropertyAccessExpression(descriptorName, nil, f.NewIdentifier("get"), ast.NodeFlagsNone),
 * 					f.NewThisExpression(),
 * 					nil,
 * 				),
 * 			),
 * 		}), false),
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createGetAccessorDescriptorForwarder(receiver: GoPtr<esDecoratorTransformer>, modifiers: GoPtr<ModifierList>, name: GoPtr<Node>, descriptorName: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createSetAccessorDescriptorForwarder","kind":"method","status":"implemented","sigHash":"df3286350a344232120820005d3660f67caf22fce8e8ce52f869b4769d124597","bodyHash":"7d6a47423b34f76fe7daf95bbec7368f40babd91d8a6f1001c133e8a6a6a4864"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createSetAccessorDescriptorForwarder(modifiers *ast.ModifierList, name *ast.Node, descriptorName *ast.IdentifierNode) *ast.Node {
 * 	f := tx.Factory()
 * 	staticOnly := tx.staticOnlyModifierVisitor.VisitModifiers(modifiers)
 * 	return f.NewSetAccessorDeclaration(
 * 		staticOnly,
 * 		name,
 * 		nil, // typeParameters
 * 		f.NewNodeList([]*ast.Node{
 * 			f.NewParameterDeclaration(nil, nil, f.NewIdentifier("value"), nil, nil, nil),
 * 		}),
 * 		nil, // type
 * 		nil, // fullSignature
 * 		f.NewBlock(f.NewNodeList([]*ast.Node{
 * 			f.NewReturnStatement(
 * 				f.NewFunctionCallCall(
 * 					f.NewPropertyAccessExpression(descriptorName, nil, f.NewIdentifier("set"), ast.NodeFlagsNone),
 * 					f.NewThisExpression(),
 * 					[]*ast.Node{f.NewIdentifier("value")},
 * 				),
 * 			),
 * 		}), false),
 * 	)
 * }
 */
export declare function esDecoratorTransformer_createSetAccessorDescriptorForwarder(receiver: GoPtr<esDecoratorTransformer>, modifiers: GoPtr<ModifierList>, name: GoPtr<Node>, descriptorName: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createMetadata","kind":"method","status":"implemented","sigHash":"9b15440a6dd5fd92258c67e51773b7c7a3c6b3357744c6ab422eec9efe1669c1","bodyHash":"c521151b3cfdfaeabe6b62742eae98d570591332e51c3e18245663ba1588aa20"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createMetadata(name *ast.IdentifierNode, classSuper *ast.IdentifierNode) *ast.Statement {
 * 	f := tx.Factory()
 *
 * 	var superMetadata *ast.Expression
 * 	if classSuper != nil {
 * 		superMetadata = tx.createSymbolMetadataReference(classSuper)
 * 	} else {
 * 		superMetadata = f.NewToken(ast.KindNullKeyword)
 * 	}
 *
 * 	objectCreate := f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(f.NewIdentifier("Object"), nil, f.NewIdentifier("create"), ast.NodeFlagsNone),
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Expression{superMetadata}),
 * 		ast.NodeFlagsNone,
 * 	)
 *
 * 	symbolCheck := f.NewLogicalANDExpression(
 * 		f.NewTypeCheck(f.NewIdentifier("Symbol"), "function"),
 * 		f.NewPropertyAccessExpression(f.NewIdentifier("Symbol"), nil, f.NewIdentifier("metadata"), ast.NodeFlagsNone),
 * 	)
 *
 * 	conditional := f.NewConditionalExpression(
 * 		symbolCheck,
 * 		f.NewToken(ast.KindQuestionToken),
 * 		objectCreate,
 * 		f.NewToken(ast.KindColonToken),
 * 		f.NewVoidZeroExpression(),
 * 	)
 *
 * 	varDecl := f.NewVariableDeclaration(name, nil, nil, conditional)
 * 	varDeclList := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsConst)
 * 	return f.NewVariableStatement(nil, varDeclList)
 * }
 */
export declare function esDecoratorTransformer_createMetadata(receiver: GoPtr<esDecoratorTransformer>, name: GoPtr<IdentifierNode>, classSuper: GoPtr<IdentifierNode>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createSymbolMetadata","kind":"method","status":"implemented","sigHash":"39ed0c1629e47f506c8342114f7128aad8677ba6100a4abbeb349941bbd8032e","bodyHash":"d11d9d63999b58a4ada362e9122cf08115570514ffc477095dc328da2f908b1f"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createSymbolMetadata(target *ast.Expression, value *ast.IdentifierNode) *ast.Statement {
 * 	f := tx.Factory()
 *
 * 	// Object.defineProperty(target, Symbol.metadata, { configurable: true, writable: true, enumerable: true, value })
 * 	symbolMetadata := f.NewPropertyAccessExpression(f.NewIdentifier("Symbol"), nil, f.NewIdentifier("metadata"), ast.NodeFlagsNone)
 *
 * 	descriptorProps := []*ast.Node{
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("enumerable"), nil, nil, f.NewTrueExpression()),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("configurable"), nil, nil, f.NewTrueExpression()),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("writable"), nil, nil, f.NewTrueExpression()),
 * 		f.NewPropertyAssignment(nil, f.NewIdentifier("value"), nil, nil, value),
 * 	}
 * 	descriptor := f.NewObjectLiteralExpression(f.NewNodeList(descriptorProps), false)
 *
 * 	defineProperty := f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(f.NewIdentifier("Object"), nil, f.NewIdentifier("defineProperty"), ast.NodeFlagsNone),
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Expression{target, symbolMetadata, descriptor}),
 * 		ast.NodeFlagsNone,
 * 	)
 *
 * 	ifStatement := f.NewIfStatement(value, f.NewExpressionStatement(defineProperty), nil)
 * 	tx.EmitContext().SetEmitFlags(ifStatement, printer.EFSingleLine)
 * 	return ifStatement
 * }
 */
export declare function esDecoratorTransformer_createSymbolMetadata(receiver: GoPtr<esDecoratorTransformer>, target: GoPtr<Expression>, value: GoPtr<IdentifierNode>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::method::esDecoratorTransformer.createSymbolMetadataReference","kind":"method","status":"implemented","sigHash":"e968b334b04b930f8bf47f43ae8186e3bf35cc7d2535c42120c4792f95128ce2","bodyHash":"71f1e8835c00d6e422ee88b160706d9fc92fd76c1735909247c399c26a27597f"}
 *
 * Go source:
 * func (tx *esDecoratorTransformer) createSymbolMetadataReference(classSuper *ast.IdentifierNode) *ast.Expression {
 * 	f := tx.Factory()
 * 	symbolMetadata := f.NewPropertyAccessExpression(f.NewIdentifier("Symbol"), nil, f.NewIdentifier("metadata"), ast.NodeFlagsNone)
 * 	elementAccess := f.NewElementAccessExpression(classSuper, nil, symbolMetadata, ast.NodeFlagsNone)
 * 	return f.NewBinaryExpression(nil, elementAccess, nil, f.NewToken(ast.KindQuestionQuestionToken), f.NewToken(ast.KindNullKeyword))
 * }
 */
export declare function esDecoratorTransformer_createSymbolMetadataReference(receiver: GoPtr<esDecoratorTransformer>, classSuper: GoPtr<IdentifierNode>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/esdecorator.go::func::injectClassThisAssignmentIfMissing","kind":"func","status":"implemented","sigHash":"5d50dcf67cf793e9c7cd9854e3d5786f7064205afe1e602003111b9760a2235c","bodyHash":"d3b497c249eddcd4e28375797ffb714f61ffcc6e1d4a4fb745bb145db4117836"}
 *
 * Go source:
 * func injectClassThisAssignmentIfMissing(ec *printer.EmitContext, f *printer.NodeFactory, node *ast.Node, classThis *ast.IdentifierNode) *ast.Node {
 * 	if classHasClassThisAssignment(ec, node) {
 * 		return node
 * 	}
 *
 * 	// Create: static { _classThis = this; }
 * 	expression := f.NewAssignmentExpression(classThis, f.NewThisExpression())
 * 	statement := f.NewExpressionStatement(expression)
 * 	body := f.NewBlock(f.NewNodeList([]*ast.Node{statement}), false)
 * 	staticBlock := f.NewClassStaticBlockDeclaration(nil, body)
 * 	ec.SetClassThis(staticBlock, classThis)
 *
 * 	if node.Name() != nil {
 * 		ec.SetSourceMapRange(statement, node.Name().Loc)
 * 	}
 *
 * 	newMembers := make([]*ast.Node, 0, 1+len(node.Members()))
 * 	newMembers = append(newMembers, staticBlock)
 * 	newMembers = append(newMembers, node.Members()...)
 * 	membersList := f.NewNodeList(newMembers)
 * 	membersList.Loc = node.MemberList().Loc
 *
 * 	var updatedNode *ast.Node
 * 	if ast.IsClassDeclaration(node) {
 * 		cd := node.AsClassDeclaration()
 * 		updatedNode = f.UpdateClassDeclaration(cd, cd.Modifiers(), cd.Name(), nil, cd.HeritageClauses, membersList)
 * 	} else {
 * 		ce := node.AsClassExpression()
 * 		updatedNode = f.UpdateClassExpression(ce, ce.Modifiers(), ce.Name(), nil, ce.HeritageClauses, membersList)
 * 	}
 * 	ec.SetClassThis(updatedNode, classThis)
 * 	return updatedNode
 * }
 */
export declare function injectClassThisAssignmentIfMissing(ec: GoPtr<EmitContext>, f: GoPtr<NodeFactory>, node: GoPtr<Node>, classThis: GoPtr<IdentifierNode>): GoPtr<Node>;
//# sourceMappingURL=esdecorator.d.ts.map
import type { bool } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Mutex } from "../../go/sync.js";
import type { Node, SourceFile } from "../ast/ast.js";
import type { Declaration, ElementAccessExpression, IdentifierNode, ImportDeclaration, SignatureDeclaration } from "../ast/ast_generated.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import type { ReferenceResolver } from "../binder/referenceresolver.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import type { LinkStore } from "../core/linkstore.js";
import type { Tristate } from "../core/tristate.js";
import type { Result } from "../evaluator/evaluator.js";
import type { Flags, InternalFlags, SymbolTracker } from "../nodebuilder/types.js";
import type { EmitContext } from "../printer/emitcontext.js";
import type { EmitResolver as EmitResolver_969b36a1, SymbolAccessibilityResult, TypeReferenceSerializationKind } from "../printer/emitresolver.js";
import type { Checker } from "./checker/state.js";
import type { Symbol } from "../ast/symbol.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::type::JSXLinks","kind":"type","status":"implemented","sigHash":"dae8f8bc0fb4104dad60016e0fd4d5fcac487340e2f883962794096e4647f2c3","bodyHash":"b8a690f05f4e1e07abd521eeb0dff42e8ed3e1b8ee3c000e2464d886b8c9b3ba"}
 *
 * Go source:
 * JSXLinks struct {
 * 	importRef *ast.Node
 * }
 */
export interface JSXLinks {
    importRef: GoPtr<Node>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::type::DeclarationLinks","kind":"type","status":"implemented","sigHash":"f204cf15bed1d10379ef0b41e207ca327ce5cd16805fc59e249893eac963e39f","bodyHash":"4247c597fb66dc2dfad3458c2912b3b42c005bf1f8dea782fccf70811374cea3"}
 *
 * Go source:
 * DeclarationLinks struct {
 * 	isVisible core.Tristate // if declaration is depended upon by exported declarations
 * }
 */
export interface DeclarationLinks {
    isVisible: Tristate;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::type::DeclarationFileLinks","kind":"type","status":"implemented","sigHash":"4b6661a892f88bfe2a8477813e21bb4b2de659e69882e5cfd0d1a59df7fcd548","bodyHash":"dc7bbcbb9771249fa55f7f164d48be2cd6184f594940d3f43789d52a0b05fa0c"}
 *
 * Go source:
 * DeclarationFileLinks struct {
 * 	aliasesMarked bool // if file has had alias visibility marked
 * }
 */
export interface DeclarationFileLinks {
    aliasesMarked: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::type::EmitResolver","kind":"type","status":"implemented","sigHash":"aa28f97bdefb2b251294f9bbc7d012089c1646af46f1fb8a64ab0574d6228e00","bodyHash":"75694d31ff3949f18166efae478181368e56a6430bd72bd6ab2fd9e0264a86b1"}
 *
 * Go source:
 * EmitResolver struct {
 * 	checker                 *Checker
 * 	checkerMu               *sync.Mutex
 * 	isValueAliasDeclaration func(node *ast.Node) bool
 * 	aliasMarkingVisitor     func(node *ast.Node) bool
 * 	referenceResolver       binder.ReferenceResolver
 * 	jsxLinks                core.LinkStore[*ast.Node, JSXLinks]
 * 	declarationLinks        core.LinkStore[*ast.Node, DeclarationLinks]
 * 	declarationFileLinks    core.LinkStore[*ast.Node, DeclarationFileLinks]
 * }
 */
export interface EmitResolver {
    checker: GoPtr<Checker>;
    checkerMu: GoPtr<Mutex>;
    isValueAliasDeclaration: (node: GoPtr<Node>) => bool;
    aliasMarkingVisitor: (node: GoPtr<Node>) => bool;
    referenceResolver: ReferenceResolver | undefined;
    jsxLinks: LinkStore<GoPtr<Node>, JSXLinks>;
    declarationLinks: LinkStore<GoPtr<Node>, DeclarationLinks>;
    declarationFileLinks: LinkStore<GoPtr<Node>, DeclarationFileLinks>;
}
export declare function EmitResolver_as_printer_EmitResolver(receiver: GoPtr<EmitResolver>): EmitResolver_969b36a1;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"e1a5f15cb940355789a75a1e6811da03657057f2f3447bd2d7e304ca1756361f"}
 *
 * Go source:
 * var _ printer.EmitResolver = (*EmitResolver)(nil)
 */
export declare let __69112d2a_0: EmitResolver_969b36a1;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::func::newEmitResolver","kind":"func","status":"implemented","sigHash":"e8ab1c6cca31adfe867b8620cfea290b7ce4f2d6e1342ae750685f5756b1de15","bodyHash":"ca19d30b08865c24a57e04c917429eba0e918d3edda07e6a54617098e0b9a378"}
 *
 * Go source:
 * func newEmitResolver(checker *Checker) *EmitResolver {
 * 	e := &EmitResolver{checker: checker}
 * 	e.isValueAliasDeclaration = e.isValueAliasDeclarationWorker
 * 	e.aliasMarkingVisitor = e.aliasMarkingVisitorWorker
 * 	e.checkerMu = &checker.mu
 * 	return e
 * }
 */
export declare function newEmitResolver(checker: GoPtr<Checker>): GoPtr<EmitResolver>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetJsxFactoryEntity","kind":"method","status":"implemented","sigHash":"48811d3b32a461b8e9260a5236c9e7eee2a91892b780a0e082e441ee484ba895","bodyHash":"99805f3b75a48e223134e452676fbae81002b0b2e31fa84d92fba3cd2bcdcf78"}
 *
 * Go source:
 * func (r *EmitResolver) GetJsxFactoryEntity(location *ast.Node) *ast.Node {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.getJsxFactoryEntity(location)
 * }
 */
export declare function EmitResolver_GetJsxFactoryEntity(receiver: GoPtr<EmitResolver>, location: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetJsxFragmentFactoryEntity","kind":"method","status":"implemented","sigHash":"391a5ece983dbdef0ed273a64947b54043948529d952cce3ad40f7a7b9ce6f9e","bodyHash":"bfec593eebf5482051797d3029d8e06ffd6376a4accbbc0c81e70ed07c251f93"}
 *
 * Go source:
 * func (r *EmitResolver) GetJsxFragmentFactoryEntity(location *ast.Node) *ast.Node {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.getJsxFragmentFactoryEntity(location)
 * }
 */
export declare function EmitResolver_GetJsxFragmentFactoryEntity(receiver: GoPtr<EmitResolver>, location: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsOptionalParameter","kind":"method","status":"implemented","sigHash":"4be6bdc63134406a858bf6af28b8f909468ae7f98de164b837676eb6959535d5","bodyHash":"cbaba86465c794adc8280a0a5f6fba441a5cc00019fae04f584f16d6cde53088"}
 *
 * Go source:
 * func (r *EmitResolver) IsOptionalParameter(node *ast.Node) bool {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.isOptionalParameter(node)
 * }
 */
export declare function EmitResolver_IsOptionalParameter(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetBaseDeclarationsForPropertyDeclaration","kind":"method","status":"implemented","sigHash":"615a139be292cc3af844256e43ae6d33a7216a83504b7b5d0a8b64c4e1d64a21","bodyHash":"97d4300010e17b340b886d7cdd8c18f8b437ee4d6827c770fea7a437b575eb67"}
 *
 * Go source:
 * func (r *EmitResolver) GetBaseDeclarationsForPropertyDeclaration(node *ast.Node) []*ast.Node {
 * 	if node == nil {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	s := r.checker.getSymbolOfDeclaration(node)
 * 	if s == nil || s.Parent == nil {
 * 		return nil
 * 	}
 * 	parentType := r.checker.getDeclaredTypeOfSymbol(s.Parent)
 * 	if parentType == nil {
 * 		return nil
 * 	}
 * 	bases := r.checker.getBaseTypes(parentType)
 * 	for _, b := range bases {
 * 		baseProp := r.checker.getPropertyOfObjectType(b, s.Name)
 * 		if baseProp != nil {
 * 			return baseProp.Declarations
 * 			// TODO: return base declarations from all base types if any callers actually look at the list
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function EmitResolver_GetBaseDeclarationsForPropertyDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsLateBound","kind":"method","status":"implemented","sigHash":"8bc7b0142db1d96cbe36ebe5319f65d7fd7e44f761b1f2716e1ce5f8cefb8042","bodyHash":"0ceb8c2a66c059964c1df16236394698e84f28c435c8847e47470438a28f7453"}
 *
 * Go source:
 * func (r *EmitResolver) IsLateBound(node *ast.Node) bool {
 * 	// TODO: Require an emitContext to construct an EmitResolver, remove all emitContext arguments
 * 	// node = r.emitContext.ParseNode(node)
 * 	if node == nil {
 * 		return false
 * 	}
 * 	if !ast.IsParseTreeNode(node) {
 * 		return false
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	symbol := r.checker.getSymbolOfDeclaration(node)
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	return symbol.CheckFlags&ast.CheckFlagsLate != 0
 * }
 */
export declare function EmitResolver_IsLateBound(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetEnumMemberValue","kind":"method","status":"implemented","sigHash":"000f02614ac21b848af114ba7d8b0665733da9c32031f0fa7032f298848bc576","bodyHash":"9197b906feb3b18d5fe4efe69b6807bae35ded4214e3888ebdf5299d7000ba75"}
 *
 * Go source:
 * func (r *EmitResolver) GetEnumMemberValue(node *ast.Node) evaluator.Result {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(node) {
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	r.checker.computeEnumMemberValues(node.Parent)
 * 	if !r.checker.enumMemberLinks.Has(node) {
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	return r.checker.enumMemberLinks.Get(node).value
 * }
 */
export declare function EmitResolver_GetEnumMemberValue(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsDeclarationVisible","kind":"method","status":"implemented","sigHash":"fb5ee706d7525063da859419fae23cb14c4764dca6afb17d402083886f4f42ca","bodyHash":"e475576aa398dd3bc3d49c43487a44990a8ad870de475e9d0f7d06536512811b"}
 *
 * Go source:
 * func (r *EmitResolver) IsDeclarationVisible(node *ast.Node) bool {
 * 	// Only lock on external API func to prevent deadlocks
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.isDeclarationVisible(node)
 * }
 */
export declare function EmitResolver_IsDeclarationVisible(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isDeclarationVisible","kind":"method","status":"implemented","sigHash":"097e7a8746029b2299d4651cf03f87811dbe9c8d58f3ad8a06191d201e382ef8","bodyHash":"f1751c00390295497c6522c60cdd51e0b7fd963a06c6ca16e0a376a68b57aace"}
 *
 * Go source:
 * func (r *EmitResolver) isDeclarationVisible(node *ast.Node) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(node) {
 * 		return false
 * 	}
 * 	if node == nil {
 * 		return false
 * 	}
 *
 * 	links := r.declarationLinks.Get(node)
 * 	if links.isVisible == core.TSUnknown {
 * 		if r.determineIfDeclarationIsVisible(node) {
 * 			links.isVisible = core.TSTrue
 * 		} else {
 * 			links.isVisible = core.TSFalse
 * 		}
 * 	}
 * 	return links.isVisible == core.TSTrue
 * }
 */
export declare function EmitResolver_isDeclarationVisible(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.determineIfDeclarationIsVisible","kind":"method","status":"implemented","sigHash":"6f08c0b5cf33c9224bd91083d723cb9406cb16c293c0c798c0ff0c21ad5d55d7","bodyHash":"411cc970503a2b3017b2a1fbca01d6845e4c4586e920fac86f5b00135ed7a7fd"}
 *
 * Go source:
 * func (r *EmitResolver) determineIfDeclarationIsVisible(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindJSDocCallbackTag,
 * 		// ast.KindJSDocEnumTag, // !!! TODO: JSDoc @enum support?
 * 		ast.KindJSDocTypedefTag:
 * 		// Top-level jsdoc type aliases are considered exported
 * 		// First parent is comment node, second is hosting declaration or token; we only care about those tokens or declarations whose parent is a source file
 * 		return node.Parent != nil && node.Parent.Parent != nil && node.Parent.Parent.Parent != nil && ast.IsSourceFile(node.Parent.Parent.Parent)
 * 	case ast.KindBindingElement:
 * 		return r.isDeclarationVisible(node.Parent.Parent)
 * 	case ast.KindVariableDeclaration,
 * 		ast.KindModuleDeclaration,
 * 		ast.KindClassDeclaration,
 * 		ast.KindInterfaceDeclaration,
 * 		ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindFunctionDeclaration,
 * 		ast.KindEnumDeclaration,
 * 		ast.KindImportEqualsDeclaration:
 * 		if ast.IsVariableDeclaration(node) {
 * 			if ast.IsBindingPattern(node.Name()) &&
 * 				len(node.Name().Elements()) == 0 {
 * 				// If the binding pattern is empty, this variable declaration is not visible
 * 				return false
 * 			}
 * 			// falls through
 * 		}
 * 		// External module augmentation is always visible
 * 		// A @typedef at top-level in an external module is always visible
 * 		if ast.IsExternalModuleAugmentation(node) || ast.IsImplicitlyExportedJSDocDeclaration(node) {
 * 			return true
 * 		}
 * 		parent := ast.GetDeclarationContainer(node)
 * 		// If the node is not exported or it is not ambient module element (except import declaration)
 * 		if r.checker.getCombinedModifierFlagsCached(node)&ast.ModifierFlagsExport == 0 &&
 * 			!(node.Kind != ast.KindImportEqualsDeclaration && parent.Kind != ast.KindSourceFile && parent.Flags&ast.NodeFlagsAmbient != 0) {
 * 			return ast.IsGlobalSourceFile(parent)
 * 		}
 * 		// Exported members/ambient module elements (exception import declaration) are visible if parent is visible
 * 		return r.isDeclarationVisible(parent)
 *
 * 	case ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindMethodSignature:
 * 		if r.checker.GetEffectiveDeclarationFlags(node, ast.ModifierFlagsPrivate|ast.ModifierFlagsProtected) != 0 {
 * 			// Private/protected properties/methods are not visible
 * 			return false
 * 		}
 * 		// Public properties/methods are visible if its parents are visible, so:
 * 		return r.isDeclarationVisible(node.Parent)
 *
 * 	case ast.KindConstructor,
 * 		ast.KindConstructSignature,
 * 		ast.KindCallSignature,
 * 		ast.KindIndexSignature,
 * 		ast.KindParameter,
 * 		ast.KindModuleBlock,
 * 		ast.KindFunctionType,
 * 		ast.KindConstructorType,
 * 		ast.KindTypeLiteral,
 * 		ast.KindTypeReference,
 * 		ast.KindArrayType,
 * 		ast.KindTupleType,
 * 		ast.KindUnionType,
 * 		ast.KindIntersectionType,
 * 		ast.KindParenthesizedType,
 * 		ast.KindNamedTupleMember:
 * 		return r.isDeclarationVisible(node.Parent)
 *
 * 	// Default binding, import specifier and namespace import is visible
 * 	// only on demand so by default it is not visible
 * 	case ast.KindImportClause,
 * 		ast.KindNamespaceImport,
 * 		ast.KindImportSpecifier:
 * 		return false
 *
 * 	// Type parameters are always visible
 * 	case ast.KindTypeParameter:
 * 		return true
 * 	// Source file and namespace export are always visible
 * 	case ast.KindSourceFile,
 * 		ast.KindNamespaceExportDeclaration:
 * 		return true
 *
 * 	// Export assignments do not create name bindings outside the module
 * 	case ast.KindExportAssignment:
 * 		return false
 *
 * 	// An `export {X}` (without a module specifier) is itself a visible re-export of
 * 	// the named binding; it contributes to the symbol's external visibility.
 * 	case ast.KindExportSpecifier:
 * 		exportDecl := node.Parent.Parent
 * 		if ast.IsExportDeclaration(exportDecl) && exportDecl.AsExportDeclaration().ModuleSpecifier == nil {
 * 			return r.isDeclarationVisible(exportDecl.Parent)
 * 		}
 * 		return false
 *
 * 	default:
 * 		return false
 * 	}
 * }
 */
export declare function EmitResolver_determineIfDeclarationIsVisible(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.PrecalculateDeclarationEmitVisibility","kind":"method","status":"implemented","sigHash":"f6f8f8a6684aeadd310cc11084a290147abba767b41286ec52550ae76a54d0b5","bodyHash":"30421fbc9cec649abe734babb4ba2a784255db8b8baf295dd59a32956f8e643b"}
 *
 * Go source:
 * func (r *EmitResolver) PrecalculateDeclarationEmitVisibility(file *ast.SourceFile) {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	if r.declarationFileLinks.Get(file.AsNode()).aliasesMarked {
 * 		return
 * 	}
 * 	r.declarationFileLinks.Get(file.AsNode()).aliasesMarked = true
 * 	// TODO: Does this even *have* to be an upfront walk? If it's not possible for a
 * 	// import a = a.b.c statement to chain into exposing a statement in a sibling scope,
 * 	// it could at least be pushed into scope entry -  then it wouldn't need to be recursive.
 * 	file.AsNode().ForEachChild(r.aliasMarkingVisitor)
 * }
 */
export declare function EmitResolver_PrecalculateDeclarationEmitVisibility(receiver: GoPtr<EmitResolver>, file: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::func::isCommonJSModuleExports","kind":"func","status":"implemented","sigHash":"8ccb2e98766ce184a43abfe5143beefe8e4522fd7b88a85d15401897c8df4e0f","bodyHash":"a9ee055914debccf2dfa4e003b2b4e37a2eb567322ce5fc442f88d28af9482c4"}
 *
 * Go source:
 * func isCommonJSModuleExports(node *ast.Node) bool {
 * 	if ast.IsBinaryExpression(node) && ast.IsExpressionStatement(node.Parent) && ast.IsSourceFile(node.Parent.Parent) &&
 * 		node.Parent.Parent.AsSourceFile().CommonJSModuleIndicator != nil {
 * 		switch ast.GetAssignmentDeclarationKind(node) {
 * 		case ast.JSDeclarationKindModuleExports, ast.JSDeclarationKindExportsProperty:
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function isCommonJSModuleExports(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.aliasMarkingVisitorWorker","kind":"method","status":"implemented","sigHash":"cf4d20b8590294141094f1debdc9d746b78a021b5edc7d0b6417ac08937c0222","bodyHash":"4ccefce07c29a742dd7c1cea7866be4e50db3a1c864bf033ece8ad02924b1b96"}
 *
 * Go source:
 * func (r *EmitResolver) aliasMarkingVisitorWorker(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindBinaryExpression:
 * 		if isCommonJSModuleExports(node) && ast.IsIdentifier(node.AsBinaryExpression().Right) {
 * 			r.markLinkedAliases(node.AsBinaryExpression().Right)
 * 		}
 * 	case ast.KindExportAssignment:
 * 		if node.Expression().Kind == ast.KindIdentifier {
 * 			r.markLinkedAliases(node.Expression())
 * 		}
 * 	case ast.KindExportSpecifier:
 * 		r.markLinkedAliases(node.PropertyNameOrName())
 * 	}
 * 	return node.ForEachChild(r.aliasMarkingVisitor)
 * }
 */
export declare function EmitResolver_aliasMarkingVisitorWorker(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.markLinkedAliases","kind":"method","status":"implemented","sigHash":"4e39c6dd2acfd1d1196df1191bdbca6603e0508ecd4234498bf101740dcd6d95","bodyHash":"956fd8a9123101fdcb8547f0a4c96233800982091cb7eae7f664abd7f75bf11c"}
 *
 * Go source:
 * func (r *EmitResolver) markLinkedAliases(node *ast.Node) {
 * 	var exportSymbol *ast.Symbol
 * 	if node.Kind != ast.KindStringLiteral && node.Parent != nil && (ast.IsExportAssignment(node.Parent) || isCommonJSModuleExports(node.Parent)) {
 * 		exportSymbol = r.checker.resolveName(node, node.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias /*nameNotFoundMessage* /, nil /*isUse* /, false, false)
 * 	} else if node.Parent.Kind == ast.KindExportSpecifier {
 * 		exportSymbol = r.checker.getTargetOfExportSpecifier(node.Parent, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias, false)
 * 	}
 *
 * 	visited := make(map[ast.SymbolId]struct{}, 2) // guard against circular imports
 * 	for exportSymbol != nil {
 * 		_, seen := visited[ast.GetSymbolId(exportSymbol)]
 * 		if seen {
 * 			break
 * 		}
 * 		visited[ast.GetSymbolId(exportSymbol)] = struct{}{}
 *
 * 		var nextSymbol *ast.Symbol
 * 		for _, declaration := range exportSymbol.Declarations {
 * 			r.declarationLinks.Get(declaration).isVisible = core.TSTrue
 *
 * 			if ast.IsInternalModuleImportEqualsDeclaration(declaration) {
 * 				// Add the referenced top container visible
 * 				internalModuleReference := declaration.AsImportEqualsDeclaration().ModuleReference
 * 				firstIdentifier := ast.GetFirstIdentifier(internalModuleReference)
 * 				importSymbol := r.checker.resolveName(declaration, firstIdentifier.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias /*nameNotFoundMessage* /, nil /*isUse* /, false, false)
 * 				nextSymbol = importSymbol
 * 			}
 * 		}
 *
 * 		exportSymbol = nextSymbol
 * 	}
 * }
 */
export declare function EmitResolver_markLinkedAliases(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::func::getMeaningOfEntityNameReference","kind":"func","status":"implemented","sigHash":"3729dff87f8b2ea885b02693d35cd230bef54dcbe5652a8ef7517a74e70ff5ef","bodyHash":"0ec8ce458cc2f52786bcb535dda050f7887523f9492887228d0daec2c8af416b"}
 *
 * Go source:
 * func getMeaningOfEntityNameReference(entityName *ast.Node) ast.SymbolFlags {
 * 	// get symbol of the first identifier of the entityName
 * 	if entityName.Parent.Kind == ast.KindTypeQuery ||
 * 		entityName.Parent.Kind == ast.KindExpressionWithTypeArguments && !ast.IsPartOfTypeNode(entityName.Parent) ||
 * 		entityName.Parent.Kind == ast.KindComputedPropertyName ||
 * 		entityName.Parent.Kind == ast.KindTypePredicate && entityName.Parent.AsTypePredicateNode().ParameterName == entityName {
 * 		// Typeof value
 * 		return ast.SymbolFlagsValue | ast.SymbolFlagsExportValue
 * 	}
 * 	if entityName.Kind == ast.KindQualifiedName || entityName.Kind == ast.KindPropertyAccessExpression ||
 * 		entityName.Parent.Kind == ast.KindImportEqualsDeclaration ||
 * 		(entityName.Parent.Kind == ast.KindQualifiedName && entityName.Parent.AsQualifiedName().Left == entityName) ||
 * 		(entityName.Parent.Kind == ast.KindPropertyAccessExpression && entityName.Parent.Expression() == entityName) ||
 * 		(entityName.Parent.Kind == ast.KindElementAccessExpression && entityName.Parent.Expression() == entityName) {
 * 		// Left identifier from type reference or TypeAlias
 * 		// Entity name of the import declaration
 * 		return ast.SymbolFlagsNamespace
 * 	}
 * 	// Type Reference or TypeAlias entity = Identifier
 * 	return ast.SymbolFlagsType
 * }
 */
export declare function getMeaningOfEntityNameReference(entityName: GoPtr<Node>): SymbolFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsEntityNameVisible","kind":"method","status":"implemented","sigHash":"700d552adab0d278c6ca221fd7edd9d9628c9263db483124e69b68518e67b32a","bodyHash":"00470a143dafbcbe6a3c0fb46750af2a887b7c75b1a3c4da0ff78ee87e3ea48c"}
 *
 * Go source:
 * func (r *EmitResolver) IsEntityNameVisible(entityName *ast.Node, enclosingDeclaration *ast.Node) printer.SymbolAccessibilityResult {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.isEntityNameVisible(entityName, enclosingDeclaration, true)
 * }
 */
export declare function EmitResolver_IsEntityNameVisible(receiver: GoPtr<EmitResolver>, entityName: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>): SymbolAccessibilityResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isEntityNameVisible","kind":"method","status":"implemented","sigHash":"f2b45853068ecd1c33b89a75d7eec11c0e0617e0401e84ea4815d30ac33ea794","bodyHash":"7939b2cab303dea54b79e2c1d760872b1c3dfeb0fa5c896efa8ab69736c80ae7"}
 *
 * Go source:
 * func (r *EmitResolver) isEntityNameVisible(entityName *ast.Node, enclosingDeclaration *ast.Node, shouldComputeAliasToMakeVisible bool) printer.SymbolAccessibilityResult {
 * 	// node = r.emitContext.ParseNode(entityName)
 * 	if !ast.IsParseTreeNode(entityName) {
 * 		return printer.SymbolAccessibilityResult{Accessibility: printer.SymbolAccessibilityNotAccessible}
 * 	}
 *
 * 	meaning := getMeaningOfEntityNameReference(entityName)
 * 	firstIdentifier := ast.GetFirstIdentifier(entityName)
 *
 * 	symbol := r.checker.resolveName(enclosingDeclaration, firstIdentifier.Text(), meaning, nil, false, false)
 *
 * 	if symbol != nil && symbol.Flags&ast.SymbolFlagsTypeParameter != 0 && meaning&ast.SymbolFlagsType != 0 {
 * 		return printer.SymbolAccessibilityResult{Accessibility: printer.SymbolAccessibilityAccessible}
 * 	}
 *
 * 	if symbol == nil && ast.IsThisIdentifier(firstIdentifier) {
 * 		sym := r.checker.getSymbolOfDeclaration(r.checker.getThisContainer(firstIdentifier, false, false))
 * 		if r.isSymbolAccessible(sym, enclosingDeclaration, meaning, false).Accessibility == printer.SymbolAccessibilityAccessible {
 * 			return printer.SymbolAccessibilityResult{Accessibility: printer.SymbolAccessibilityAccessible}
 * 		}
 * 	}
 *
 * 	if symbol == nil {
 * 		return printer.SymbolAccessibilityResult{
 * 			Accessibility:   printer.SymbolAccessibilityNotResolved,
 * 			ErrorSymbolName: firstIdentifier.Text(),
 * 			ErrorNode:       firstIdentifier,
 * 		}
 * 	}
 *
 * 	visible := r.hasVisibleDeclarations(symbol, shouldComputeAliasToMakeVisible)
 * 	if visible != nil {
 * 		return *visible
 * 	}
 *
 * 	return printer.SymbolAccessibilityResult{
 * 		Accessibility:   printer.SymbolAccessibilityNotAccessible,
 * 		ErrorSymbolName: firstIdentifier.Text(),
 * 		ErrorNode:       firstIdentifier,
 * 	}
 * }
 */
export declare function EmitResolver_isEntityNameVisible(receiver: GoPtr<EmitResolver>, entityName: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, shouldComputeAliasToMakeVisible: bool): SymbolAccessibilityResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::func::noopAddVisibleAlias","kind":"func","status":"implemented","sigHash":"fc2ad9fda54b706c25a9356c5575abc4f7d3f2526a7085fda654fec76520c55d","bodyHash":"b533e171de09ba8ce7a0b6b751184b6f8862a5b41d3c56eb460650ab818ee45d"}
 *
 * Go source:
 * func noopAddVisibleAlias(declaration *ast.Node, aliasingStatement *ast.Node) {}
 */
export declare function noopAddVisibleAlias(declaration: GoPtr<Node>, aliasingStatement: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.hasVisibleDeclarations","kind":"method","status":"implemented","sigHash":"7f6f6b0f5d5a418367521d600da9f364fb3d1a87ebb112c0bf3ec672aa9af8dc","bodyHash":"f32ac17609006397967a769f19a3a2a35ea2ad1e189c8dd521b43bfcf3f6d561"}
 *
 * Go source:
 * func (r *EmitResolver) hasVisibleDeclarations(symbol *ast.Symbol, shouldComputeAliasToMakeVisible bool) *printer.SymbolAccessibilityResult {
 * 	var aliasesToMakeVisibleSet map[ast.NodeId]*ast.Node
 *
 * 	var addVisibleAlias func(declaration *ast.Node, aliasingStatement *ast.Node)
 * 	if shouldComputeAliasToMakeVisible {
 * 		addVisibleAlias = func(declaration *ast.Node, aliasingStatement *ast.Node) {
 * 			r.declarationLinks.Get(declaration).isVisible = core.TSTrue
 * 			if aliasesToMakeVisibleSet == nil {
 * 				aliasesToMakeVisibleSet = make(map[ast.NodeId]*ast.Node)
 * 			}
 * 			aliasesToMakeVisibleSet[ast.GetNodeId(declaration)] = aliasingStatement
 * 		}
 * 	} else {
 * 		addVisibleAlias = noopAddVisibleAlias
 * 	}
 *
 * 	for _, declaration := range symbol.Declarations {
 * 		if ast.IsIdentifier(declaration) {
 * 			continue
 * 		}
 *
 * 		if !r.isDeclarationVisible(declaration) {
 * 			// Mark the unexported alias as visible if its parent is visible
 * 			// because these kind of aliases can be used to name types in declaration file
 * 			anyImportSyntax := getAnyImportSyntax(declaration)
 * 			if anyImportSyntax != nil &&
 * 				!ast.HasSyntacticModifier(anyImportSyntax, ast.ModifierFlagsExport) && // import clause without export
 * 				r.isDeclarationVisible(anyImportSyntax.Parent) {
 * 				addVisibleAlias(declaration, anyImportSyntax)
 * 				continue
 * 			}
 * 			if ast.IsVariableDeclaration(declaration) && ast.IsVariableStatement(declaration.Parent.Parent) &&
 * 				!ast.HasSyntacticModifier(declaration.Parent.Parent, ast.ModifierFlagsExport) && // unexported variable statement
 * 				r.isDeclarationVisible(declaration.Parent.Parent.Parent) {
 * 				addVisibleAlias(declaration, declaration.Parent.Parent)
 * 				continue
 * 			}
 * 			if ast.IsLateVisibilityPaintedStatement(declaration) && // unexported top-level statement
 * 				!ast.HasSyntacticModifier(declaration, ast.ModifierFlagsExport) &&
 * 				r.isDeclarationVisible(declaration.Parent) {
 * 				addVisibleAlias(declaration, declaration)
 * 				continue
 * 			}
 * 			if ast.IsBindingElement(declaration) {
 * 				if symbol.Flags&ast.SymbolFlagsAlias != 0 && ast.IsInJSFile(declaration) && declaration.Parent != nil && declaration.Parent.Parent != nil && // exported import-like top-level JS require statement
 * 					ast.IsVariableDeclaration(declaration.Parent.Parent) &&
 * 					declaration.Parent.Parent.Parent.Parent != nil && ast.IsVariableStatement(declaration.Parent.Parent.Parent.Parent) &&
 * 					!ast.HasSyntacticModifier(declaration.Parent.Parent.Parent.Parent, ast.ModifierFlagsExport) &&
 * 					declaration.Parent.Parent.Parent.Parent.Parent != nil && // check if the thing containing the variable statement is visible (ie, the file)
 * 					r.isDeclarationVisible(declaration.Parent.Parent.Parent.Parent.Parent) {
 * 					addVisibleAlias(declaration, declaration.Parent.Parent.Parent.Parent)
 * 					continue
 * 				}
 * 				if symbol.Flags&ast.SymbolFlagsBlockScopedVariable != 0 {
 * 					rootDeclaration := ast.WalkUpBindingElementsAndPatterns(declaration)
 * 					if ast.IsParameterDeclaration(rootDeclaration) {
 * 						return nil
 * 					}
 * 					variableStatement := rootDeclaration.Parent.Parent
 * 					if !ast.IsVariableStatement(variableStatement) {
 * 						return nil
 * 					}
 * 					if ast.HasSyntacticModifier(variableStatement, ast.ModifierFlagsExport) {
 * 						continue // no alias to add, already exported
 * 					}
 * 					if !r.isDeclarationVisible(variableStatement.Parent) {
 * 						return nil // not visible
 * 					}
 * 					addVisibleAlias(declaration, variableStatement)
 * 					continue
 * 				}
 * 			}
 *
 * 			// Declaration is not visible
 * 			return nil
 * 		}
 * 	}
 *
 * 	return &printer.SymbolAccessibilityResult{
 * 		Accessibility:        printer.SymbolAccessibilityAccessible,
 * 		AliasesToMakeVisible: slices.Collect(maps.Values(aliasesToMakeVisibleSet)),
 * 	}
 * }
 */
export declare function EmitResolver_hasVisibleDeclarations(receiver: GoPtr<EmitResolver>, symbol_: GoPtr<Symbol>, shouldComputeAliasToMakeVisible: bool): GoPtr<SymbolAccessibilityResult>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsImplementationOfOverload","kind":"method","status":"implemented","sigHash":"66c3ad541e51fe25a94d32832151e888cbe0878952ed16a395891f0353e579e8","bodyHash":"a1b24b955988a91b6b95a5ae4d16a54df6a4a61d12896c55c0718174a28b46e4"}
 *
 * Go source:
 * func (r *EmitResolver) IsImplementationOfOverload(node *ast.SignatureDeclaration) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(node) {
 * 		return false
 * 	}
 * 	if ast.NodeIsPresent(node.Body()) {
 * 		if ast.IsGetAccessorDeclaration(node) || ast.IsSetAccessorDeclaration(node) {
 * 			return false // Get or set accessors can never be overload implementations, but can have up to 2 signatures
 * 		}
 * 		r.checkerMu.Lock()
 * 		defer r.checkerMu.Unlock()
 * 		symbol := r.checker.getSymbolOfDeclaration(node)
 * 		signaturesOfSymbol := r.checker.getSignaturesOfSymbol(symbol)
 * 		// If this function body corresponds to function with multiple signature, it is implementation of overload
 * 		// e.g.: function foo(a: string): string;
 * 		//       function foo(a: number): number;
 * 		//       function foo(a: any) { // This is implementation of the overloads
 * 		//           return a;
 * 		//       }
 * 		if len(signaturesOfSymbol) > 1 {
 * 			return true
 * 		}
 * 		// If there is single signature for the symbol, it is overload if that signature isn't coming from the node
 * 		// e.g.: function foo(a: string): string;
 * 		//       function foo(a: any) { // This is implementation of the overloads
 * 		//           return a;
 * 		//       }
 * 		if len(signaturesOfSymbol) == 1 {
 * 			declaration := signaturesOfSymbol[0].declaration
 * 			if declaration != node && declaration.Flags&ast.NodeFlagsJSDoc == 0 {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_IsImplementationOfOverload(receiver: GoPtr<EmitResolver>, node: GoPtr<SignatureDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsImportRequiredByAugmentation","kind":"method","status":"implemented","sigHash":"4647631fa3bf2e4bebe392ae2967b466e0b1249e785afaccdf8257f36f47af20","bodyHash":"6c3b0856e274935f2964e7091d736eafde209515c4bc93e5e375f28dd562012f"}
 *
 * Go source:
 * func (r *EmitResolver) IsImportRequiredByAugmentation(decl *ast.ImportDeclaration) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(decl.AsNode()) {
 * 		return false
 * 	}
 * 	file := ast.GetSourceFileOfNode(decl.AsNode())
 * 	if file.Symbol == nil {
 * 		// script file
 * 		return false
 * 	}
 * 	importTarget := r.GetExternalModuleFileFromDeclaration(decl.AsNode())
 * 	if importTarget == nil {
 * 		return false
 * 	}
 * 	if importTarget == file {
 * 		return false
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	exports := r.checker.getExportsOfModule(file.Symbol)
 * 	for s := range maps.Values(exports) {
 * 		merged := r.checker.getMergedSymbol(s)
 * 		if merged != s {
 * 			if len(merged.Declarations) > 0 {
 * 				for _, d := range merged.Declarations {
 * 					declFile := ast.GetSourceFileOfNode(d)
 * 					if declFile == importTarget {
 * 						return true
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_IsImportRequiredByAugmentation(receiver: GoPtr<EmitResolver>, decl: GoPtr<ImportDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsDefinitelyReferenceToGlobalSymbolObject","kind":"method","status":"implemented","sigHash":"da1baeedd0c8da5b0a26c499b2daebb1cae5efb2311a07f7223dbdecd2439bf3","bodyHash":"54ffa4beaac204ecc601b969303a11d8b5f0466fd4f1122db64029816280c196"}
 *
 * Go source:
 * func (r *EmitResolver) IsDefinitelyReferenceToGlobalSymbolObject(node *ast.Node) bool {
 * 	if !ast.IsPropertyAccessExpression(node) ||
 * 		!ast.IsIdentifier(node.Name()) ||
 * 		!ast.IsPropertyAccessExpression(node.Expression()) && !ast.IsIdentifier(node.Expression()) {
 * 		return false
 * 	}
 * 	if node.Expression().Kind == ast.KindIdentifier {
 * 		if node.Expression().Text() != "Symbol" {
 * 			return false
 * 		}
 * 		r.checkerMu.Lock()
 * 		defer r.checkerMu.Unlock()
 * 		// Exactly `Symbol.something` and `Symbol` either does not resolve or definitely resolves to the global Symbol
 * 		return r.checker.getResolvedSymbol(node.Expression()) == r.checker.getGlobalSymbol("Symbol", ast.SymbolFlagsValue|ast.SymbolFlagsExportValue, nil /*diagnostic* /)
 * 	}
 * 	if node.Expression().Expression().Kind != ast.KindIdentifier || node.Expression().Expression().Text() != "globalThis" || node.Expression().Name().Text() != "Symbol" {
 * 		return false
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	// Exactly `globalThis.Symbol.something` and `globalThis` resolves to the global `globalThis`
 * 	return r.checker.getResolvedSymbol(node.Expression().Expression()) == r.checker.globalThisSymbol
 * }
 */
export declare function EmitResolver_IsDefinitelyReferenceToGlobalSymbolObject(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.RequiresAddingImplicitUndefined","kind":"method","status":"implemented","sigHash":"eb5111ea421498d8e4b45b5e374dd93dee124ac25c7782e47fe828d6a504f700","bodyHash":"dae3caf67f226bac3b7a09d0e194c6a05b75b541abdf9147b909a4f64f398c6d"}
 *
 * Go source:
 * func (r *EmitResolver) RequiresAddingImplicitUndefined(declaration *ast.Node, symbol *ast.Symbol, enclosingDeclaration *ast.Node) bool {
 * 	if !ast.IsParseTreeNode(declaration) {
 * 		return false
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.requiresAddingImplicitUndefined(declaration, symbol, enclosingDeclaration)
 * }
 */
export declare function EmitResolver_RequiresAddingImplicitUndefined(receiver: GoPtr<EmitResolver>, declaration: GoPtr<Node>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.RequiresAddingImplicitUndefinedUnsafe","kind":"method","status":"implemented","sigHash":"b076fb4e59621c7f6956a8c130f18b787a52cfe5a578156b57895cedbb18e5b7","bodyHash":"5bcd1c3e273bcaded67ad8deedbfc543a2ca42423eea3e27f5a0fca10ea6ade3"}
 *
 * Go source:
 * func (r *EmitResolver) RequiresAddingImplicitUndefinedUnsafe(declaration *ast.Node, symbol *ast.Symbol, enclosingDeclaration *ast.Node) bool {
 * 	if !ast.IsParseTreeNode(declaration) {
 * 		return false
 * 	}
 * 	// NO LOCKING - only should be called in contexts that already have a checker lock
 * 	return r.requiresAddingImplicitUndefined(declaration, symbol, enclosingDeclaration)
 * }
 */
export declare function EmitResolver_RequiresAddingImplicitUndefinedUnsafe(receiver: GoPtr<EmitResolver>, declaration: GoPtr<Node>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.requiresAddingImplicitUndefined","kind":"method","status":"implemented","sigHash":"00a49f3511a7d9bb6d8adff81ad7f071eddcab42983eb6fdcafaef69e079489b","bodyHash":"634b0a127b317f4be0c942e1000ac4e55841fa53f347dc19644caa99647eb2c5"}
 *
 * Go source:
 * func (r *EmitResolver) requiresAddingImplicitUndefined(declaration *ast.Node, symbol *ast.Symbol, enclosingDeclaration *ast.Node) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(declaration) {
 * 		return false
 * 	}
 * 	switch declaration.Kind {
 * 	case ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindJSDocPropertyTag:
 * 		if symbol == nil {
 * 			symbol = r.checker.getSymbolOfDeclaration(declaration)
 * 		}
 * 		t := r.checker.getTypeOfSymbol(symbol)
 * 		r.checker.mappedSymbolLinks.Has(symbol)
 * 		return (symbol.Flags&ast.SymbolFlagsProperty != 0) && (symbol.Flags&ast.SymbolFlagsOptional != 0) && isOptionalDeclaration(declaration) && r.checker.ReverseMappedSymbolLinks.Has(symbol) && r.checker.ReverseMappedSymbolLinks.Get(symbol).mappedType != nil && containsNonMissingUndefinedType(r.checker, t)
 * 	case ast.KindParameter, ast.KindJSDocParameterTag:
 * 		return r.requiresAddingImplicitUndefinedWorker(declaration, enclosingDeclaration)
 * 	default:
 * 		panic("Node cannot possibly require adding undefined")
 * 	}
 * }
 */
export declare function EmitResolver_requiresAddingImplicitUndefined(receiver: GoPtr<EmitResolver>, declaration: GoPtr<Node>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.requiresAddingImplicitUndefinedWorker","kind":"method","status":"implemented","sigHash":"7c4d341cd258348d4b1fbf88b8b220f3d027c6044447d1d359df2a50066fa16b","bodyHash":"53237a8b50798adba0585a36172ddce293d633622c0441dd4845db490856687e"}
 *
 * Go source:
 * func (r *EmitResolver) requiresAddingImplicitUndefinedWorker(parameter *ast.Node, enclosingDeclaration *ast.Node) bool {
 * 	return (r.isRequiredInitializedParameter(parameter, enclosingDeclaration) || r.isOptionalUninitializedParameterProperty(parameter)) && !r.declaredParameterTypeContainsUndefined(parameter)
 * }
 */
export declare function EmitResolver_requiresAddingImplicitUndefinedWorker(receiver: GoPtr<EmitResolver>, parameter: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.declaredParameterTypeContainsUndefined","kind":"method","status":"implemented","sigHash":"9aebeb6532826c197c29671210921fa9ffe23c7eddf515d412ea13195987fc52","bodyHash":"b0ee11d123c7e7a03b6f782015a32fab3b761a5724a0f06e8d64c79ff5214cf7"}
 *
 * Go source:
 * func (r *EmitResolver) declaredParameterTypeContainsUndefined(parameter *ast.Node) bool {
 * 	// typeNode := getNonlocalEffectiveTypeAnnotationNode(parameter); // !!! JSDoc Support
 * 	typeNode := parameter.Type()
 * 	if typeNode == nil {
 * 		return false
 * 	}
 * 	t := r.checker.getTypeFromTypeNode(typeNode)
 * 	// allow error type here to avoid confusing errors that the annotation has to contain undefined when it does in cases like this:
 * 	//
 * 	// export function fn(x?: Unresolved | undefined): void {}
 * 	return r.checker.isErrorType(t) || r.checker.containsUndefinedType(t)
 * }
 */
export declare function EmitResolver_declaredParameterTypeContainsUndefined(receiver: GoPtr<EmitResolver>, parameter: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isOptionalUninitializedParameterProperty","kind":"method","status":"implemented","sigHash":"28e7c6942fba0ceaf1b740ba85f6996f414baec006ae92f88cc3c3bf45b4ef7c","bodyHash":"31ef2b5b99a909987e95d8f225c84a48ad19e8ec80b05e04cf58c5c2c475b3bc"}
 *
 * Go source:
 * func (r *EmitResolver) isOptionalUninitializedParameterProperty(parameter *ast.Node) bool {
 * 	return r.checker.strictNullChecks &&
 * 		r.isOptionalParameter(parameter) &&
 * 		( /*isJSDocParameterTag(parameter) ||* / parameter.Initializer() == nil) && // !!! TODO: JSDoc support
 * 		ast.HasSyntacticModifier(parameter, ast.ModifierFlagsParameterPropertyModifier)
 * }
 */
export declare function EmitResolver_isOptionalUninitializedParameterProperty(receiver: GoPtr<EmitResolver>, parameter: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isRequiredInitializedParameter","kind":"method","status":"implemented","sigHash":"6535d89b3fab6380348a900164647716e2ed4015f825a4303080983ad82bce31","bodyHash":"979526ec82b83eb74d0665dcf40029b7cbebcc4d866e59744c01bff78cf20317"}
 *
 * Go source:
 * func (r *EmitResolver) isRequiredInitializedParameter(parameter *ast.Node, enclosingDeclaration *ast.Node) bool {
 * 	if !r.checker.strictNullChecks || r.isOptionalParameter(parameter) || /*isJSDocParameterTag(parameter) ||* / parameter.Initializer() == nil { // !!! TODO: JSDoc Support
 * 		return false
 * 	}
 * 	if ast.HasSyntacticModifier(parameter, ast.ModifierFlagsParameterPropertyModifier) {
 * 		return enclosingDeclaration != nil && ast.IsFunctionLikeDeclaration(enclosingDeclaration)
 * 	}
 * 	return true
 * }
 */
export declare function EmitResolver_isRequiredInitializedParameter(receiver: GoPtr<EmitResolver>, parameter: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isOptionalParameter","kind":"method","status":"implemented","sigHash":"cbdad5682cd469be2d6b817b518cdb94eef85b190e0e76e6c9b4e1ac0e13bff5","bodyHash":"8add18d817130b79a06c99b4e717dc51381f70920c0417951deee07ce3dfe105"}
 *
 * Go source:
 * func (r *EmitResolver) isOptionalParameter(node *ast.Node) bool {
 * 	return r.checker.isOptionalParameter(node)
 * }
 */
export declare function EmitResolver_isOptionalParameter(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsLiteralConstDeclaration","kind":"method","status":"implemented","sigHash":"b435651d1125685d2a357275bab64b122b2c8e923bd57f2841a8725acfb70a4e","bodyHash":"89e94b860c31440dc4100cb8348d620f9c33b535c799430f6927cd801f82b93a"}
 *
 * Go source:
 * func (r *EmitResolver) IsLiteralConstDeclaration(node *ast.Node) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(node) {
 * 		return false
 * 	}
 * 	if isDeclarationReadonly(node) || ast.IsVariableDeclaration(node) && ast.IsVarConst(node) {
 * 		r.checkerMu.Lock()
 * 		defer r.checkerMu.Unlock()
 * 		return isFreshLiteralType(r.checker.getTypeOfSymbol(r.checker.getSymbolOfDeclaration(node)))
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_IsLiteralConstDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsExpandoFunctionDeclarationUnsafe","kind":"method","status":"implemented","sigHash":"d879c3cb5459a3775b59e7f71c0ef4120bd1c85910019c6dc8f04d5cfef6f410","bodyHash":"a969920964043f4c569643a69a0e533159df1091de5fa29a2f081c1e1e7d36f0"}
 *
 * Go source:
 * func (r *EmitResolver) IsExpandoFunctionDeclarationUnsafe(node *ast.Node) bool {
 * 	// node = r.emitContext.ParseNode(node)
 * 	if !ast.IsParseTreeNode(node) {
 * 		return false
 * 	}
 * 	// this is substantially different from strada, but so is expando property checking
 * 	props := r.GetPropertiesOfContainerFunction(node)
 * 	for _, p := range props {
 * 		if ast.IsExpandoPropertyDeclaration(p.ValueDeclaration) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_IsExpandoFunctionDeclarationUnsafe(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsExpandoFunctionDeclaration","kind":"method","status":"implemented","sigHash":"ef85f65cf3f392cd8bea618b857ab46b1a2b6b76d6ed3a060353568a2577d218","bodyHash":"7639c03b624c3f991535833de9ebe9c40ecdc71dc5d6a4dcf0d8e23aece9ea2f"}
 *
 * Go source:
 * func (r *EmitResolver) IsExpandoFunctionDeclaration(node *ast.Node) bool {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.IsExpandoFunctionDeclarationUnsafe(node)
 * }
 */
export declare function EmitResolver_IsExpandoFunctionDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isSymbolAccessible","kind":"method","status":"implemented","sigHash":"1a060ae5a6cdfa7ed0c0274d6b40a47feaf66f8f6c3748adb0d349b9a78d83a6","bodyHash":"482f80e6b6325524081003d7f2af01ad4e5c916d36f612c84584bf2817c59ff5"}
 *
 * Go source:
 * func (r *EmitResolver) isSymbolAccessible(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, shouldComputeAliasToMarkVisible bool) printer.SymbolAccessibilityResult {
 * 	return r.checker.IsSymbolAccessible(symbol, enclosingDeclaration, meaning, shouldComputeAliasToMarkVisible)
 * }
 */
export declare function EmitResolver_isSymbolAccessible(receiver: GoPtr<EmitResolver>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, shouldComputeAliasToMarkVisible: bool): SymbolAccessibilityResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsSymbolAccessible","kind":"method","status":"implemented","sigHash":"25a09ce277e54cfcae1d28a15d5af3ec5ce19d118ae88dd8de7629983c1cff28","bodyHash":"203ad94a55b328c6bea6e5726fd3e00f00e21d4041310edb3b1cca203430ac31"}
 *
 * Go source:
 * func (r *EmitResolver) IsSymbolAccessible(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, shouldComputeAliasToMarkVisible bool) printer.SymbolAccessibilityResult {
 * 	// TODO: Split into locking and non-locking API methods - only current usage is the symbol tracker, which is non-locking,
 * 	// as all tracker calls happen within a CreateX call below, which already holds a lock
 * 	// r.checkerMu.Lock()
 * 	// defer r.checkerMu.Unlock()
 * 	return r.isSymbolAccessible(symbol, enclosingDeclaration, meaning, shouldComputeAliasToMarkVisible)
 * }
 */
export declare function EmitResolver_IsSymbolAccessible(receiver: GoPtr<EmitResolver>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, shouldComputeAliasToMarkVisible: bool): SymbolAccessibilityResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsReferencedAliasDeclaration","kind":"method","status":"implemented","sigHash":"717f24e25b198ea905902e5cda747cbff3ba8b6d3aa86cafaaba334235f3d48f","bodyHash":"37852013bca78e03c6af2ec1602a79d633852eb992a50268562fa9ed7d7f1581"}
 *
 * Go source:
 * func (r *EmitResolver) IsReferencedAliasDeclaration(node *ast.Node) bool {
 * 	c := r.checker
 * 	if !c.canCollectSymbolAliasAccessibilityData || !ast.IsParseTreeNode(node) {
 * 		return true
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	if ast.IsAliasSymbolDeclaration(node) {
 * 		if symbol := c.getSymbolOfDeclaration(node); symbol != nil {
 * 			aliasLinks := c.aliasSymbolLinks.Get(symbol)
 * 			if aliasLinks.referenced {
 * 				return true
 * 			}
 * 			target := aliasLinks.aliasTarget
 * 			if target != nil && node.ModifierFlags()&ast.ModifierFlagsExport != 0 &&
 * 				c.getSymbolFlags(target)&ast.SymbolFlagsValue != 0 &&
 * 				(c.compilerOptions.ShouldPreserveConstEnums() || !isConstEnumOrConstEnumOnlyModule(target)) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_IsReferencedAliasDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsValueAliasDeclaration","kind":"method","status":"implemented","sigHash":"6eb06098100beddb69c05b21b1f82ac058a34aa8688bb865973d4f65252e1d29","bodyHash":"713d138434ef0b7ecd5c2ce8db971c9204b985bb1b504b24e796b48e71d1b4b3"}
 *
 * Go source:
 * func (r *EmitResolver) IsValueAliasDeclaration(node *ast.Node) bool {
 * 	c := r.checker
 * 	if !c.canCollectSymbolAliasAccessibilityData || !ast.IsParseTreeNode(node) {
 * 		return true
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.isValueAliasDeclarationWorker(node)
 * }
 */
export declare function EmitResolver_IsValueAliasDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isValueAliasDeclarationWorker","kind":"method","status":"implemented","sigHash":"650d97f1b4538d75dede6bc80cb02898b55bdb549d465bc418225789a66cc083","bodyHash":"0c1f3a58c356bfe8783c1a253ca3fe932dbd5448c17995cd428b375d4ee4044a"}
 *
 * Go source:
 * func (r *EmitResolver) isValueAliasDeclarationWorker(node *ast.Node) bool {
 * 	c := r.checker
 *
 * 	switch node.Kind {
 * 	case ast.KindImportEqualsDeclaration:
 * 		return r.isAliasResolvedToValue(c.getSymbolOfDeclaration(node), false /*excludeTypeOnlyValues* /)
 * 	case ast.KindImportClause,
 * 		ast.KindNamespaceImport,
 * 		ast.KindImportSpecifier,
 * 		ast.KindExportSpecifier:
 * 		symbol := c.getSymbolOfDeclaration(node)
 * 		return symbol != nil && r.isAliasResolvedToValue(symbol, true /*excludeTypeOnlyValues* /)
 * 	case ast.KindExportDeclaration:
 * 		exportClause := node.AsExportDeclaration().ExportClause
 * 		return exportClause != nil && (ast.IsNamespaceExport(exportClause) ||
 * 			core.Some(exportClause.Elements(), r.isValueAliasDeclaration))
 * 	case ast.KindExportAssignment:
 * 		if node.Expression() != nil && node.Expression().Kind == ast.KindIdentifier {
 * 			return r.isAliasResolvedToValue(c.getSymbolOfDeclaration(node), true /*excludeTypeOnlyValues* /)
 * 		}
 * 		return true
 * 	case ast.KindBinaryExpression:
 * 		if isCommonJSModuleExports(node) && ast.IsIdentifier(node.AsBinaryExpression().Right) {
 * 			return r.isAliasResolvedToValue(c.getSymbolOfDeclaration(node), true /*excludeTypeOnlyValues* /)
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function EmitResolver_isValueAliasDeclarationWorker(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.isAliasResolvedToValue","kind":"method","status":"implemented","sigHash":"b5795d926058ff57cae27d522ffbc91d550208b22e1532ec95646f7dfb851b43","bodyHash":"aabb566cc4e6b2f01a3fdbb34991c76dd5074350267826da3ec3691c14beee5e"}
 *
 * Go source:
 * func (r *EmitResolver) isAliasResolvedToValue(symbol *ast.Symbol, excludeTypeOnlyValues bool) bool {
 * 	c := r.checker
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	if symbol.ValueDeclaration != nil {
 * 		if container := ast.GetSourceFileOfNode(symbol.ValueDeclaration); container != nil {
 * 			fileSymbol := c.getSymbolOfDeclaration(container.AsNode())
 * 			// Ensures cjs export assignment is setup, since this symbol may point at, and merge with, the file itself.
 * 			// If we don't, the merge may not have yet occurred, and the flags check below will be missing flags that
 * 			// are added as a result of the merge.
 * 			c.resolveExternalModuleSymbol(fileSymbol, false /*dontResolveAlias* /)
 * 		}
 * 	}
 * 	target := c.getExportSymbolOfValueSymbolIfExported(c.resolveAlias(symbol))
 * 	if target == c.unknownSymbol {
 * 		return !excludeTypeOnlyValues || c.getTypeOnlyAliasDeclaration(symbol) == nil
 * 	}
 * 	// const enums and modules that contain only const enums are not considered values from the emit perspective
 * 	// unless 'preserveConstEnums' option is set to true
 * 	return c.getSymbolFlagsEx(symbol, excludeTypeOnlyValues, true /*excludeLocalMeanings* /)&ast.SymbolFlagsValue != 0 &&
 * 		(c.compilerOptions.ShouldPreserveConstEnums() ||
 * 			!isConstEnumOrConstEnumOnlyModule(target))
 * }
 */
export declare function EmitResolver_isAliasResolvedToValue(receiver: GoPtr<EmitResolver>, symbol_: GoPtr<Symbol>, excludeTypeOnlyValues: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.IsTopLevelValueImportEqualsWithEntityName","kind":"method","status":"implemented","sigHash":"d7740a9ec1a77e662fef5b7050f33bb691439aa61a55e83a0ec00e0898928802","bodyHash":"37c124c02032a5b721519b499521a81ffa90e400c32a954f4d7753f87d0d6007"}
 *
 * Go source:
 * func (r *EmitResolver) IsTopLevelValueImportEqualsWithEntityName(node *ast.Node) bool {
 * 	c := r.checker
 * 	if !c.canCollectSymbolAliasAccessibilityData {
 * 		return true
 * 	}
 * 	if !ast.IsParseTreeNode(node) || node.Kind != ast.KindImportEqualsDeclaration || node.Parent.Kind != ast.KindSourceFile {
 * 		return false
 * 	}
 * 	if ast.IsImportEqualsDeclaration(node) &&
 * 		(ast.NodeIsMissing(node.AsImportEqualsDeclaration().ModuleReference) || node.AsImportEqualsDeclaration().ModuleReference.Kind == ast.KindExternalModuleReference) {
 * 		return false
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.isAliasResolvedToValue(c.getSymbolOfDeclaration(node), false /*excludeTypeOnlyValues* /)
 * }
 */
export declare function EmitResolver_IsTopLevelValueImportEqualsWithEntityName(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.MarkLinkedReferencesRecursively","kind":"method","status":"implemented","sigHash":"474ac0a224404c1495e94bb611991095ec65e482008121a7f8f5df45f861b99c","bodyHash":"ff63d59a057dd43e7f41ad1a872b6fdeada0fa90704228268fd7a5470d38a590"}
 *
 * Go source:
 * func (r *EmitResolver) MarkLinkedReferencesRecursively(file *ast.SourceFile) {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	if file != nil {
 * 		var visit ast.Visitor
 * 		visit = func(n *ast.Node) bool {
 * 			if ast.IsImportEqualsDeclaration(n) && n.ModifierFlags()&ast.ModifierFlagsExport == 0 {
 * 				return false // These are deferred and marked in a chain when referenced
 * 			}
 * 			if ast.IsImportDeclaration(n) {
 * 				return false // likewise, these are ultimately what get marked by calls on other nodes - we want to skip them
 * 			}
 * 			r.checker.markLinkedReferences(n, ReferenceHintUnspecified, nil /*propSymbol* /, nil /*parentType* /)
 * 			n.ForEachChild(visit)
 * 			return false
 * 		}
 * 		file.ForEachChild(visit)
 * 	}
 * }
 */
export declare function EmitResolver_MarkLinkedReferencesRecursively(receiver: GoPtr<EmitResolver>, file: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetExternalModuleFileFromDeclaration","kind":"method","status":"implemented","sigHash":"f71583282ec6da51469717f1202d4fae5c11dc8e85065d015eb84f17a5128b7d","bodyHash":"66bbe4ce5b39d9a494b64409d08de979fbe910ffa140aa1980ae462f2088276d"}
 *
 * Go source:
 * func (r *EmitResolver) GetExternalModuleFileFromDeclaration(declaration *ast.Node) *ast.SourceFile {
 * 	if !ast.IsParseTreeNode(declaration) {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.getExternalModuleFileFromDeclaration(declaration)
 * }
 */
export declare function EmitResolver_GetExternalModuleFileFromDeclaration(receiver: GoPtr<EmitResolver>, declaration: GoPtr<Node>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.getReferenceResolver","kind":"method","status":"implemented","sigHash":"9a7d1e2f7a6101fef19047756bfa994288dc43f36c7a16b6710d0f26af62619e","bodyHash":"3d16b11bd0b9143f43ed644052bba279ce9fde4cfe6f154a28df57519c42c766"}
 *
 * Go source:
 * func (r *EmitResolver) getReferenceResolver() binder.ReferenceResolver {
 * 	if r.referenceResolver == nil {
 * 		r.referenceResolver = binder.NewReferenceResolver(r.checker.compilerOptions, binder.ReferenceResolverHooks{
 * 			ResolveName:                            r.checker.resolveName,
 * 			GetResolvedSymbol:                      r.checker.getResolvedSymbolOrNil,
 * 			GetMergedSymbol:                        r.checker.getMergedSymbol,
 * 			GetParentOfSymbol:                      r.checker.getParentOfSymbol,
 * 			GetSymbolOfDeclaration:                 r.checker.getSymbolOfDeclaration,
 * 			GetTypeOnlyAliasDeclaration:            r.checker.getTypeOnlyAliasDeclarationEx,
 * 			GetExportSymbolOfValueSymbolIfExported: r.checker.getExportSymbolOfValueSymbolIfExported,
 * 			GetElementAccessExpressionName:         r.checker.tryGetElementAccessExpressionName,
 * 		})
 * 	}
 * 	return r.referenceResolver
 * }
 */
export declare function EmitResolver_getReferenceResolver(receiver: GoPtr<EmitResolver>): ReferenceResolver;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetReferencedExportContainer","kind":"method","status":"implemented","sigHash":"3ca25ab164d051213a962f34d38323c06ec0ef2c68029cecb60892f7513dd9ad","bodyHash":"d87c2036c6993a2015ffbe297777de85fd7a2d456e2959de78c1d58d9d059965"}
 *
 * Go source:
 * func (r *EmitResolver) GetReferencedExportContainer(node *ast.IdentifierNode, prefixLocals bool) *ast.Node /*SourceFile|ModuleDeclaration|EnumDeclaration* / {
 * 	if !ast.IsParseTreeNode(node) {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.getReferenceResolver().GetReferencedExportContainer(node, prefixLocals)
 * }
 */
export declare function EmitResolver_GetReferencedExportContainer(receiver: GoPtr<EmitResolver>, node: GoPtr<IdentifierNode>, prefixLocals: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.SetReferencedImportDeclaration","kind":"method","status":"implemented","sigHash":"b5b8412c2f0ef7be54ea2e7290ca9d4f3999d88e46509c479c9d3e66d0c77dba","bodyHash":"7aeb570c71739686b9b807ad8064f82ea31fb4560e25deecb2621ade1739e860"}
 *
 * Go source:
 * func (r *EmitResolver) SetReferencedImportDeclaration(node *ast.IdentifierNode, ref *ast.Declaration) {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	r.jsxLinks.Get(node).importRef = ref
 * }
 */
export declare function EmitResolver_SetReferencedImportDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<IdentifierNode>, ref: GoPtr<Declaration>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetReferencedMemberValueDeclaration","kind":"method","status":"implemented","sigHash":"c70e3392c1f83d613660fb70bb502ef2c4f5ec1deb38881c42f7add9514e2772","bodyHash":"dcf691686c68eab4d7d31118e5f964ddc3038369148067c1d66b83a775debe9d"}
 *
 * Go source:
 * func (r *EmitResolver) GetReferencedMemberValueDeclaration(node *ast.Node) *ast.Declaration {
 * 	if !ast.IsParseTreeNode(node) {
 * 		return nil
 * 	}
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.getReferenceResolver().GetReferencedMemberValueDeclaration(node)
 * }
 */
export declare function EmitResolver_GetReferencedMemberValueDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetReferencedImportDeclaration","kind":"method","status":"implemented","sigHash":"9777eb7297cb07d97a36464f0547131283dd17a9d0dc18aabdb565192e36b5c5","bodyHash":"98df8d2c6b056e1e00281fb2c30cdbcabd40f498d7bf56cb6213d417da4124b6"}
 *
 * Go source:
 * func (r *EmitResolver) GetReferencedImportDeclaration(node *ast.IdentifierNode) *ast.Declaration {
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	if !ast.IsParseTreeNode(node) {
 * 		return r.jsxLinks.Get(node).importRef
 * 	}
 *
 * 	symbol := r.checker.getReferencedValueOrAliasSymbol(node)
 * 	if ast.IsNonLocalAlias(symbol, ast.SymbolFlagsValue) && r.checker.getTypeOnlyAliasDeclarationEx(symbol, ast.SymbolFlagsValue) == nil {
 * 		return r.checker.getDeclarationOfAliasSymbol(symbol)
 * 	}
 * 	return nil
 * }
 */
export declare function EmitResolver_GetReferencedImportDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetReferencedValueDeclaration","kind":"method","status":"implemented","sigHash":"803806a7359f7d4db410f9b3040a67107fb7b683612295599c65908a68d08546","bodyHash":"a8bf1e38bd7b83104c1823513c43e67653098f08488e96986e395a23fbfc1889"}
 *
 * Go source:
 * func (r *EmitResolver) GetReferencedValueDeclaration(node *ast.IdentifierNode) *ast.Declaration {
 * 	if !ast.IsParseTreeNode(node) {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.getReferenceResolver().GetReferencedValueDeclaration(node)
 * }
 */
export declare function EmitResolver_GetReferencedValueDeclaration(receiver: GoPtr<EmitResolver>, node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetReferencedValueDeclarations","kind":"method","status":"implemented","sigHash":"674b6496f4eee784f978466051e5fe86f2d4c34405d21aa6c01df25bfed8a8aa","bodyHash":"5e5adc4ee3583ab55fe00181c683b78596a409630cbafb6c93aa40f111942e1a"}
 *
 * Go source:
 * func (r *EmitResolver) GetReferencedValueDeclarations(node *ast.IdentifierNode) []*ast.Declaration {
 * 	if !ast.IsParseTreeNode(node) {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.getReferenceResolver().GetReferencedValueDeclarations(node)
 * }
 */
export declare function EmitResolver_GetReferencedValueDeclarations(receiver: GoPtr<EmitResolver>, node: GoPtr<IdentifierNode>): GoSlice<GoPtr<Declaration>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetElementAccessExpressionName","kind":"method","status":"implemented","sigHash":"b5d005c2b4dd3f43d471430fc55e53e10fd5357e33710abfd06d2247654f668a","bodyHash":"89f5953ca1d7ec68fc7ffbbb8d6b7b2aab44b38ccdebb889566543ef13b45226"}
 *
 * Go source:
 * func (r *EmitResolver) GetElementAccessExpressionName(expression *ast.ElementAccessExpression) string {
 * 	if !ast.IsParseTreeNode(expression.AsNode()) {
 * 		return ""
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	return r.getReferenceResolver().GetElementAccessExpressionName(expression)
 * }
 */
export declare function EmitResolver_GetElementAccessExpressionName(receiver: GoPtr<EmitResolver>, expression: GoPtr<ElementAccessExpression>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateReturnTypeOfSignatureDeclaration","kind":"method","status":"implemented","sigHash":"1a2680bf5618571ce947ed90902047c5033baed332592cc9f346e864102acc80","bodyHash":"e255af27842ef1b34f4421e8e46bb20e15bc0d96ea9bea546b2664d04c68171b"}
 *
 * Go source:
 * func (r *EmitResolver) CreateReturnTypeOfSignatureDeclaration(emitContext *printer.EmitContext, signatureDeclaration *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	original := emitContext.ParseNode(signatureDeclaration)
 * 	if original == nil {
 * 		return emitContext.Factory.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 	return requestNodeBuilder.SerializeReturnTypeForSignature(original, enclosingDeclaration, flags, internalFlags, tracker)
 * }
 */
export declare function EmitResolver_CreateReturnTypeOfSignatureDeclaration(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, signatureDeclaration: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateTypeParametersOfSignatureDeclaration","kind":"method","status":"implemented","sigHash":"6466a396d096c01f245287f104f1633a0e572256787db5e30693470a34eea12b","bodyHash":"f88b18ad8f3f0d47e4dfe7373c3a983abc31cad91eb94da0505d65e2daa0f368"}
 *
 * Go source:
 * func (r *EmitResolver) CreateTypeParametersOfSignatureDeclaration(emitContext *printer.EmitContext, signatureDeclaration *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) []*ast.Node {
 * 	original := emitContext.ParseNode(signatureDeclaration)
 * 	if original == nil {
 * 		return nil
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 	return requestNodeBuilder.SerializeTypeParametersForSignature(original, enclosingDeclaration, flags, internalFlags, tracker)
 * }
 */
export declare function EmitResolver_CreateTypeParametersOfSignatureDeclaration(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, signatureDeclaration: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateTypeOfDeclaration","kind":"method","status":"implemented","sigHash":"002a759d421486c3c242547b4729cccdbad972368be538ab1db9d4cad356f4e4","bodyHash":"48f04ac22cbc427d5ef7e70b07e96f10552eed92eac74f519a8c3411b1a43c14"}
 *
 * Go source:
 * func (r *EmitResolver) CreateTypeOfDeclaration(emitContext *printer.EmitContext, declaration *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	original := emitContext.ParseNode(declaration)
 * 	if original == nil {
 * 		return emitContext.Factory.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 	// // Get type of the symbol if this is the valid symbol otherwise get type at location
 * 	symbol := r.checker.getSymbolOfDeclaration(declaration)
 * 	return requestNodeBuilder.SerializeTypeForDeclaration(declaration, symbol, enclosingDeclaration, flags|nodebuilder.FlagsMultilineObjectLiterals, internalFlags, tracker)
 * }
 */
export declare function EmitResolver_CreateTypeOfDeclaration(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, declaration: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateLiteralConstValue","kind":"method","status":"implemented","sigHash":"a794bda91b85e84d21a485fc3a7755da54ab0e72e126c175ece2179067231e63","bodyHash":"c75a8b46903824c77536a4baaaa8bd451c2da9ecd610e4ac802080c6266beacd"}
 *
 * Go source:
 * func (r *EmitResolver) CreateLiteralConstValue(emitContext *printer.EmitContext, node *ast.Node, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	node = emitContext.ParseNode(node)
 * 	r.checkerMu.Lock()
 * 	t := r.checker.getTypeOfSymbol(r.checker.getSymbolOfDeclaration(node))
 * 	r.checkerMu.Unlock()
 * 	if t == nil {
 * 		return nil // TODO: How!? Maybe this should be a panic. All symbols should have a type.
 * 	}
 *
 * 	var enumResult *ast.Node
 * 	if t.flags&TypeFlagsEnumLike != 0 {
 * 		r.checkerMu.Lock()
 * 		defer r.checkerMu.Unlock()
 * 		requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 		enumResult = requestNodeBuilder.SymbolToExpression(t.symbol, ast.SymbolFlagsValue, node, nodebuilder.FlagsNone, nodebuilder.InternalFlagsNone, tracker)
 * 		// What about regularTrueType/regularFalseType - since those aren't fresh, we never make initializers from them
 * 		// TODO: handle those if this function is ever used for more than initializers in declaration emit
 * 	} else if t == r.checker.trueType {
 * 		enumResult = emitContext.Factory.NewKeywordExpression(ast.KindTrueKeyword)
 * 	} else if t == r.checker.falseType {
 * 		enumResult = emitContext.Factory.NewKeywordExpression(ast.KindFalseKeyword)
 * 	}
 * 	if enumResult != nil {
 * 		return enumResult
 * 	}
 * 	if t.flags&TypeFlagsLiteral == 0 {
 * 		return nil // non-literal type
 * 	}
 * 	switch value := t.AsLiteralType().value.(type) {
 * 	case string:
 * 		return emitContext.Factory.NewStringLiteral(value, ast.TokenFlagsNone)
 * 	case jsnum.Number:
 * 		if value.IsInf() {
 * 			if value > 0 {
 * 				return emitContext.Factory.NewIdentifier("Infinity")
 * 			}
 * 			return emitContext.Factory.NewPrefixUnaryExpression(ast.KindMinusToken, emitContext.Factory.NewIdentifier("Infinity"))
 * 		}
 * 		if value.IsNaN() {
 * 			return emitContext.Factory.NewIdentifier("NaN")
 * 		}
 * 		if value.Abs() != value {
 * 			// negative
 * 			return emitContext.Factory.NewPrefixUnaryExpression(
 * 				ast.KindMinusToken,
 * 				emitContext.Factory.NewNumericLiteral(value.String()[1:], ast.TokenFlagsNone),
 * 			)
 * 		}
 * 		return emitContext.Factory.NewNumericLiteral(value.String(), ast.TokenFlagsNone)
 * 	case jsnum.PseudoBigInt:
 * 		return emitContext.Factory.NewBigIntLiteral(pseudoBigIntToString(value)+"n", ast.TokenFlagsNone)
 * 	case bool:
 * 		kind := ast.KindFalseKeyword
 * 		if value {
 * 			kind = ast.KindTrueKeyword
 * 		}
 * 		return emitContext.Factory.NewKeywordExpression(kind)
 * 	}
 * 	panic("unhandled literal const value kind")
 * }
 */
export declare function EmitResolver_CreateLiteralConstValue(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, node: GoPtr<Node>, tracker: SymbolTracker): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateTypeOfExpression","kind":"method","status":"implemented","sigHash":"9ed2ff39a8869ad7e1dd39470c2ac06db3aabb6af0cde5e5440237c6be11d6d2","bodyHash":"a70e60ebe798a1b737f90024ba0c716c9a550772ec14cbf603d72ff338561d36"}
 *
 * Go source:
 * func (r *EmitResolver) CreateTypeOfExpression(emitContext *printer.EmitContext, expression *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	expression = emitContext.ParseNode(expression)
 * 	if expression == nil {
 * 		return emitContext.Factory.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 *
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 	return requestNodeBuilder.SerializeTypeForExpression(expression, enclosingDeclaration, flags|nodebuilder.FlagsMultilineObjectLiterals, internalFlags, tracker)
 * }
 */
export declare function EmitResolver_CreateTypeOfExpression(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, expression: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.CreateLateBoundIndexSignatures","kind":"method","status":"implemented","sigHash":"0d29f2b50850d24cede0425c1ece2503aa0e34e10d939d6a80b47870f30090c3","bodyHash":"b5a25f4a31e0fde34f7eb9d711b75a8baa76c96db0bfcebc0d21f5e76180e03e"}
 *
 * Go source:
 * func (r *EmitResolver) CreateLateBoundIndexSignatures(emitContext *printer.EmitContext, container *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) []*ast.Node {
 * 	container = emitContext.ParseNode(container)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	sym := container.Symbol()
 * 	staticInfos := r.checker.getIndexInfosOfType(r.checker.getTypeOfSymbol(sym))
 * 	instanceIndexSymbol := r.checker.getIndexSymbol(sym)
 * 	var instanceInfos []*IndexInfo
 * 	if instanceIndexSymbol != nil {
 * 		siblingSymbols := slices.Collect(maps.Values(r.checker.getMembersOfSymbol(sym)))
 * 		instanceInfos = r.checker.getIndexInfosOfIndexSymbol(instanceIndexSymbol, siblingSymbols)
 * 	}
 *
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 *
 * 	var result []*ast.Node
 * 	for i, infoList := range [][]*IndexInfo{staticInfos, instanceInfos} {
 * 		isStatic := true
 * 		if i > 0 {
 * 			isStatic = false
 * 		}
 * 		if len(infoList) == 0 {
 * 			continue
 * 		}
 * 		for _, info := range infoList {
 * 			if info.declaration != nil {
 * 				continue
 * 			}
 * 			if info == r.checker.anyBaseTypeIndexInfo {
 * 				continue // inherited, but looks like a late-bound signature because it has no declarations
 * 			}
 * 			if len(info.components) != 0 {
 * 				// !!! TODO: Complete late-bound index info support - getObjectLiteralIndexInfo does not yet add late bound components to index signatures
 * 				allComponentComputedNamesSerializable := enclosingDeclaration != nil && core.Every(info.components, func(c *ast.Node) bool {
 * 					return c.Name() != nil &&
 * 						ast.IsComputedPropertyName(c.Name()) &&
 * 						ast.IsEntityNameExpression(c.Name().Expression()) &&
 * 						r.isEntityNameVisible(c.Name().Expression(), enclosingDeclaration, false).Accessibility == printer.SymbolAccessibilityAccessible
 * 				})
 * 				if allComponentComputedNamesSerializable {
 * 					for _, c := range info.components {
 * 						if r.checker.hasLateBindableName(c) {
 * 							// skip late bound props that contribute to the index signature - they'll be preserved via other means
 * 							continue
 * 						}
 *
 * 						firstIdentifier := ast.GetFirstIdentifier(c.Name().Expression())
 * 						name := r.checker.resolveName(firstIdentifier, firstIdentifier.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsExportValue, nil /*nameNotFoundMessage* /, true /*isUse* /, false /*excludeGlobals* /)
 * 						if name != nil {
 * 							tracker.TrackSymbol(name, enclosingDeclaration, ast.SymbolFlagsValue)
 * 						}
 *
 * 						mods := core.IfElse(isStatic, []*ast.Node{emitContext.Factory.NewModifier(ast.KindStaticKeyword)}, nil)
 * 						if info.isReadonly {
 * 							mods = append(mods, emitContext.Factory.NewModifier(ast.KindReadonlyKeyword))
 * 						}
 *
 * 						decl := emitContext.Factory.NewPropertyDeclaration(
 * 							core.IfElse(mods != nil, emitContext.Factory.NewModifierList(mods), nil),
 * 							c.Name(),
 * 							c.QuestionToken(),
 * 							requestNodeBuilder.TypeToTypeNode(r.checker.getTypeOfSymbol(c.Symbol()), enclosingDeclaration, flags, internalFlags, tracker),
 * 							nil,
 * 						)
 * 						result = append(result, decl)
 * 					}
 * 					continue
 * 				}
 * 			}
 * 			node := requestNodeBuilder.IndexInfoToIndexSignatureDeclaration(info, enclosingDeclaration, flags, internalFlags, tracker)
 * 			if node != nil && isStatic {
 * 				modNodes := []*ast.Node{emitContext.Factory.NewModifier(ast.KindStaticKeyword)}
 * 				modNodes = append(modNodes, node.ModifierNodes()...)
 * 				mods := emitContext.Factory.NewModifierList(modNodes)
 * 				node = emitContext.Factory.UpdateIndexSignatureDeclaration(
 * 					node.AsIndexSignatureDeclaration(),
 * 					mods,
 * 					node.ParameterList(),
 * 					node.Type(),
 * 				)
 * 			}
 * 			if node != nil {
 * 				result = append(result, node)
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function EmitResolver_CreateLateBoundIndexSignatures(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, container: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetEffectiveDeclarationFlags","kind":"method","status":"implemented","sigHash":"1e043b732317cd93874d4740b14f57712e4335a8afb6dca6cdddd39f38c48be4","bodyHash":"5e77199275d3e3525ed5bdf3485960b53755f4fa7a3b0aec677bd352131cfb94"}
 *
 * Go source:
 * func (r *EmitResolver) GetEffectiveDeclarationFlags(node *ast.Node, flags ast.ModifierFlags) ast.ModifierFlags {
 * 	// node = emitContext.ParseNode(node)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.GetEffectiveDeclarationFlags(node, flags)
 * }
 */
export declare function EmitResolver_GetEffectiveDeclarationFlags(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetResolutionModeOverride","kind":"method","status":"implemented","sigHash":"14879ac14cac097914423faf8123a337a64b1dd0529f976802f7cf4de737bec7","bodyHash":"769115bc13bb8c1ea3c937f94c9c27157c3c68f0ffa69dfc92b327cf5b52681e"}
 *
 * Go source:
 * func (r *EmitResolver) GetResolutionModeOverride(node *ast.Node) core.ResolutionMode {
 * 	// node = emitContext.ParseNode(node)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.GetResolutionModeOverride(node.AsImportAttributes(), false)
 * }
 */
export declare function EmitResolver_GetResolutionModeOverride(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetConstantValue","kind":"method","status":"implemented","sigHash":"ff77f5b3959c6a3f74d72f5b42423dda582d2a92d36ef5994d8aa8101ca04cbc","bodyHash":"c7131a9edfa8c6f9c52a8e649d6211972bad1de2039d594cfe1d05efa65b2091"}
 *
 * Go source:
 * func (r *EmitResolver) GetConstantValue(node *ast.Node) any {
 * 	// node = emitContext.ParseNode(node)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 * 	return r.checker.GetConstantValue(node)
 * }
 */
export declare function EmitResolver_GetConstantValue(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): unknown;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetTypeReferenceSerializationKind","kind":"method","status":"implemented","sigHash":"f415b56fd496cfc8d7577a3f4313d293be0d5f6a89d528a076072e36acf50491","bodyHash":"a8a3f0547d9dfe3786a577524386d46827c4fb082146cb8bfc1ba0a52dc7af2e"}
 *
 * Go source:
 * func (r *EmitResolver) GetTypeReferenceSerializationKind(typeName *ast.Node, location *ast.Node) printer.TypeReferenceSerializationKind {
 * 	// typeName = emitContext.ParseNode(typeName)
 * 	// location = emitContext.ParseNode(location)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	if typeName == nil || location == nil {
 * 		return printer.TypeReferenceSerializationKindUnknown
 * 	}
 *
 * 	// Resolve the symbol as a value to ensure the type can be reached at runtime during emit.
 * 	isTypeOnly := false
 * 	if ast.IsQualifiedName(typeName) {
 * 		rootValueSymbol := r.checker.resolveEntityName(ast.GetFirstIdentifier(typeName), ast.SymbolFlagsValue, true, true, location)
 *
 * 		if rootValueSymbol != nil && len(rootValueSymbol.Declarations) > 0 {
 * 			isTypeOnly = core.Every(rootValueSymbol.Declarations, ast.IsTypeOnlyImportOrExportDeclaration)
 * 		}
 * 	}
 * 	valueSymbol := r.checker.resolveEntityName(typeName, ast.SymbolFlagsValue, true, true, location)
 * 	resolvedValueSymbol := valueSymbol
 * 	if valueSymbol != nil && valueSymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		resolvedValueSymbol = r.checker.resolveAlias(valueSymbol)
 * 	}
 *
 * 	isTypeOnly = isTypeOnly || (valueSymbol != nil && r.checker.getTypeOnlyAliasDeclarationEx(valueSymbol, ast.SymbolFlagsValue) != nil)
 *
 * 	// Resolve the symbol as a type so that we can provide a more useful hint for the type serializer.
 * 	typeSymbol := r.checker.resolveEntityName(typeName, ast.SymbolFlagsType, true, true, location)
 * 	resolvedTypeSymbol := typeSymbol
 * 	if typeSymbol != nil && typeSymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		resolvedTypeSymbol = r.checker.resolveAlias(typeSymbol)
 * 	}
 * 	// In case the value symbol can't be resolved (e.g. because of missing declarations), use type symbol for reachability check.
 * 	isTypeOnly = isTypeOnly || (typeSymbol != nil && r.checker.getTypeOnlyAliasDeclarationEx(typeSymbol, ast.SymbolFlagsType) != nil)
 *
 * 	if resolvedValueSymbol != nil && resolvedValueSymbol == resolvedTypeSymbol {
 * 		globalPromiseSymbol := r.checker.getGlobalPromiseConstructorSymbol()
 * 		if globalPromiseSymbol != nil && resolvedValueSymbol == globalPromiseSymbol {
 * 			return printer.TypeReferenceSerializationKindPromise
 * 		}
 *
 * 		constructorType := r.checker.getTypeOfSymbol(resolvedValueSymbol)
 * 		if constructorType != nil && r.checker.isConstructorType(constructorType) {
 * 			if isTypeOnly {
 * 				return printer.TypeReferenceSerializationKindTypeWithCallSignature
 * 			}
 * 			return printer.TypeReferenceSerializationKindTypeWithConstructSignatureAndValue
 * 		}
 * 	}
 *
 * 	// We might not be able to resolve type symbol so use unknown type in that case (eg error case)
 * 	if resolvedTypeSymbol == nil {
 * 		if isTypeOnly {
 * 			return printer.TypeReferenceSerializationKindObjectType
 * 		}
 * 		return printer.TypeReferenceSerializationKindUnknown
 * 	}
 *
 * 	type_ := r.checker.getDeclaredTypeOfSymbol(resolvedTypeSymbol)
 * 	if r.checker.isErrorType(type_) {
 * 		if isTypeOnly {
 * 			return printer.TypeReferenceSerializationKindObjectType
 * 		}
 * 		return printer.TypeReferenceSerializationKindUnknown
 * 	}
 *
 * 	if type_.flags&TypeFlagsAnyOrUnknown != 0 {
 * 		return printer.TypeReferenceSerializationKindObjectType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsVoid|TypeFlagsNullable|TypeFlagsNever) {
 * 		return printer.TypeReferenceSerializationKindVoidNullableOrNeverType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsBooleanLike) {
 * 		return printer.TypeReferenceSerializationKindBooleanType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsNumberLike) {
 * 		return printer.TypeReferenceSerializationKindNumberLikeType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsBigIntLike) {
 * 		return printer.TypeReferenceSerializationKindBigIntLikeType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsStringLike) {
 * 		return printer.TypeReferenceSerializationKindStringLikeType
 * 	} else if isTupleType(type_) {
 * 		return printer.TypeReferenceSerializationKindArrayLikeType
 * 	} else if r.checker.isTypeAssignableToKind(type_, TypeFlagsESSymbolLike) {
 * 		return printer.TypeReferenceSerializationKindESSymbolType
 * 	} else if r.checker.isFunctionType(type_) {
 * 		return printer.TypeReferenceSerializationKindTypeWithCallSignature
 * 	} else if r.checker.isArrayType(type_) {
 * 		return printer.TypeReferenceSerializationKindArrayLikeType
 * 	} else {
 * 		return printer.TypeReferenceSerializationKindObjectType
 * 	}
 * }
 */
export declare function EmitResolver_GetTypeReferenceSerializationKind(receiver: GoPtr<EmitResolver>, typeName: GoPtr<Node>, location: GoPtr<Node>): TypeReferenceSerializationKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.GetPropertiesOfContainerFunction","kind":"method","status":"implemented","sigHash":"7e97da3a092cb9f8f383787ad8d6b688d469b559048c069fca1a57744db2d17d","bodyHash":"b8569f40bafa10f9d9fbeb46850ccf1a752c3005dcb8d1e95a6d71d701b45b83"}
 *
 * Go source:
 * func (r *EmitResolver) GetPropertiesOfContainerFunction(node *ast.Node) []*ast.Symbol {
 * 	// This is explicitly _not locked_ because it is only called via error reporters invoked via node builder calls
 * 	// to the symbol tracker already within locked contexts.
 * 	// r.checkerMu.Lock()
 * 	// defer r.checkerMu.Unlock()
 * 	if node == nil {
 * 		return []*ast.Symbol{}
 * 	}
 * 	s := r.checker.getSymbolOfDeclaration(node)
 * 	if s == nil {
 * 		return []*ast.Symbol{}
 * 	}
 * 	return r.checker.getPropertiesOfType(r.checker.getTypeOfSymbol(s))
 * }
 */
export declare function EmitResolver_GetPropertiesOfContainerFunction(receiver: GoPtr<EmitResolver>, node: GoPtr<Node>): GoSlice<GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::method::EmitResolver.TryJSTypeNodeToTypeNode","kind":"method","status":"implemented","sigHash":"ee8dc85998dd6dcb905630a62ebbab7edd668cac04808df9ff9d96185cf5c554","bodyHash":"22aa569defec857bdda9a59e482498445ce97a4cfd9a9a955916009f5a7e67ec"}
 *
 * Go source:
 * func (r *EmitResolver) TryJSTypeNodeToTypeNode(emitContext *printer.EmitContext, typeNode *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	typeNode = emitContext.ParseNode(typeNode)
 * 	r.checkerMu.Lock()
 * 	defer r.checkerMu.Unlock()
 *
 * 	requestNodeBuilder := NewNodeBuilder(r.checker, emitContext) // TODO: cache per-context
 * 	return requestNodeBuilder.TryJSTypeNodeToTypeNode(typeNode, enclosingDeclaration, flags, internalFlags, tracker)
 * }
 */
export declare function EmitResolver_TryJSTypeNodeToTypeNode(receiver: GoPtr<EmitResolver>, emitContext: GoPtr<EmitContext>, typeNode: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: SymbolTracker): GoPtr<Node>;
//# sourceMappingURL=emitresolver.d.ts.map
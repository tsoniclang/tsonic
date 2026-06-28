import type { bool } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { ElementAccessExpression } from "../ast/generated/data.js";
import type { Declaration, IdentifierNode } from "../ast/generated/unions.js";
import type { Symbol } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { NameResolver } from "./nameresolver.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::type::ReferenceResolver","kind":"type","status":"implemented","sigHash":"116c7dbca6419fe3a56769e505765cff79fed3244bc81b4465a5b4fa4058737d","bodyHash":"23c7bfe98262f5cb06698ba14803aa4c1ecaea7af86f4da690c2c05961d68630"}
 *
 * Go source:
 * ReferenceResolver interface {
 * 	GetReferencedExportContainer(node *ast.IdentifierNode, prefixLocals bool) *ast.Node
 * 	GetReferencedImportDeclaration(node *ast.IdentifierNode) *ast.Declaration
 * 	GetReferencedValueDeclaration(node *ast.IdentifierNode) *ast.Declaration
 * 	GetReferencedValueDeclarations(node *ast.IdentifierNode) []*ast.Declaration
 * 	GetElementAccessExpressionName(expression *ast.ElementAccessExpression) string
 * 	GetReferencedMemberValueDeclaration(node *ast.Node) *ast.Declaration
 * }
 */
export interface ReferenceResolver {
    GetReferencedExportContainer(node: GoPtr<IdentifierNode>, prefixLocals: bool): GoPtr<Node>;
    GetReferencedImportDeclaration(node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
    GetReferencedValueDeclaration(node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
    GetReferencedValueDeclarations(node: GoPtr<IdentifierNode>): GoSlice<GoPtr<Declaration>>;
    GetElementAccessExpressionName(expression: GoPtr<ElementAccessExpression>): string;
    GetReferencedMemberValueDeclaration(node: GoPtr<Node>): GoPtr<Declaration>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::type::ReferenceResolverHooks","kind":"type","status":"implemented","sigHash":"afa0bd5df77f55a410bd96e8f9b76de4c6af96c22d1e8eed3c0fd3c674b48f9d","bodyHash":"efabe0e4f89da5388f36ad96fb3378825427007e2e956e76bd25f34ecfe0340f"}
 *
 * Go source:
 * ReferenceResolverHooks struct {
 * 	ResolveName                            func(location *ast.Node, name string, meaning ast.SymbolFlags, nameNotFoundMessage *diagnostics.Message, isUse bool, excludeGlobals bool) *ast.Symbol
 * 	GetResolvedSymbol                      func(*ast.Node) *ast.Symbol
 * 	GetMergedSymbol                        func(*ast.Symbol) *ast.Symbol
 * 	GetParentOfSymbol                      func(*ast.Symbol) *ast.Symbol
 * 	GetSymbolOfDeclaration                 func(*ast.Declaration) *ast.Symbol
 * 	GetTypeOnlyAliasDeclaration            func(symbol *ast.Symbol, include ast.SymbolFlags) *ast.Declaration
 * 	GetExportSymbolOfValueSymbolIfExported func(*ast.Symbol) *ast.Symbol
 * 	GetElementAccessExpressionName         func(*ast.ElementAccessExpression) (string, bool)
 * }
 */
export interface ReferenceResolverHooks {
    ResolveName: (location: GoPtr<Node>, name: string, meaning: SymbolFlags, nameNotFoundMessage: GoPtr<Message>, isUse: bool, excludeGlobals: bool) => GoPtr<Symbol>;
    GetResolvedSymbol: (arg0: GoPtr<Node>) => GoPtr<Symbol>;
    GetMergedSymbol: (arg0: GoPtr<Symbol>) => GoPtr<Symbol>;
    GetParentOfSymbol: (arg0: GoPtr<Symbol>) => GoPtr<Symbol>;
    GetSymbolOfDeclaration: (arg0: GoPtr<Declaration>) => GoPtr<Symbol>;
    GetTypeOnlyAliasDeclaration: (symbol_: GoPtr<Symbol>, include: SymbolFlags) => GoPtr<Declaration>;
    GetExportSymbolOfValueSymbolIfExported: (arg0: GoPtr<Symbol>) => GoPtr<Symbol>;
    GetElementAccessExpressionName: (arg0: GoPtr<ElementAccessExpression>) => [string, bool];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"7eec38edc86a7918083e72681c153c62ad2df3d5c8dc7fc6cb04cab4db51e2fb"}
 *
 * Go source:
 * var _ ReferenceResolver = &referenceResolver{}
 */
export declare const __e8d524b9_0: ReferenceResolver;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::type::referenceResolver","kind":"type","status":"implemented","sigHash":"d9982ff89ac466401b9be499c4e336677e27f5d99e85f70e986f3c1b31e445a2","bodyHash":"526b8552c7473fb06681cba007d61d87d8e29c929c14074b6f5dea4f927cbd2e"}
 *
 * Go source:
 * referenceResolver struct {
 * 	resolver *NameResolver
 * 	options  *core.CompilerOptions
 * 	hooks    ReferenceResolverHooks
 * }
 */
export interface referenceResolver {
    resolver: GoPtr<NameResolver>;
    options: GoPtr<CompilerOptions>;
    hooks: ReferenceResolverHooks;
}
export declare function NewReferenceResolver(options: GoPtr<CompilerOptions>, hooks: ReferenceResolverHooks): ReferenceResolver;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getResolvedSymbol","kind":"method","status":"implemented","sigHash":"16459d3c9352e0a3966f15f846f0e563c91b04b891d6e93b1d31ca282be27789","bodyHash":"276b1306c2dded7ec6df1094269073faa72d2b46869333e063e7ec9bd9ef391f"}
 *
 * Go source:
 * func (r *referenceResolver) getResolvedSymbol(node *ast.Node) *ast.Symbol {
 * 	if node != nil {
 * 		if r.hooks.GetResolvedSymbol != nil {
 * 			return r.hooks.GetResolvedSymbol(node)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_getResolvedSymbol(receiver: GoPtr<referenceResolver>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getMergedSymbol","kind":"method","status":"implemented","sigHash":"fd08f7722334c86ac60a66b5d62921818ab3ce11b7c475bbda588a82d5cb0b1e","bodyHash":"b1dd183a7b2e22b542c1771dba784cc1088950028a0f001cb177c39418898e26"}
 *
 * Go source:
 * func (r *referenceResolver) getMergedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol != nil {
 * 		if r.hooks.GetMergedSymbol != nil {
 * 			return r.hooks.GetMergedSymbol(symbol)
 * 		}
 * 		return symbol
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_getMergedSymbol(receiver: GoPtr<referenceResolver>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getParentOfSymbol","kind":"method","status":"implemented","sigHash":"49b601c55b6eab5d43fb9578c8195a5cfd937f5cc71e407ecf80e722988afac8","bodyHash":"499cb42368a993be778ec31f268a7615d2f749e99eb3c1e161177f6b954e0a2f"}
 *
 * Go source:
 * func (r *referenceResolver) getParentOfSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol != nil {
 * 		if r.hooks.GetParentOfSymbol != nil {
 * 			return r.hooks.GetParentOfSymbol(symbol)
 * 		}
 * 		return symbol.Parent
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_getParentOfSymbol(receiver: GoPtr<referenceResolver>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getSymbolOfDeclaration","kind":"method","status":"implemented","sigHash":"f4e180358811236e2393285cd4c5c87e451ac162f085f1e4fddcdcdcade4e6b7","bodyHash":"6288387865039a66cd553a9cbdd01b4491d8f0a6d02ad5cf54944cddda02cd2d"}
 *
 * Go source:
 * func (r *referenceResolver) getSymbolOfDeclaration(declaration *ast.Declaration) *ast.Symbol {
 * 	if declaration != nil {
 * 		if r.hooks.GetSymbolOfDeclaration != nil {
 * 			return r.hooks.GetSymbolOfDeclaration(declaration)
 * 		}
 * 		return declaration.Symbol()
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_getSymbolOfDeclaration(receiver: GoPtr<referenceResolver>, declaration: GoPtr<Declaration>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getReferencedValueSymbol","kind":"method","status":"implemented","sigHash":"bb79436e805eb797f57d8174e65811f5b851b5383b10f7ae2b58d26936e0ed85","bodyHash":"e4e44b2358312f30f0a599946d4ab828d534258162ba5ab947fa6b540fe8c6a3"}
 *
 * Go source:
 * func (r *referenceResolver) getReferencedValueSymbol(reference *ast.IdentifierNode, startInDeclarationContainer bool) *ast.Symbol {
 * 	resolvedSymbol := r.getResolvedSymbol(reference)
 * 	if resolvedSymbol != nil {
 * 		return resolvedSymbol
 * 	}
 *
 * 	location := reference
 * 	if startInDeclarationContainer && reference.Parent != nil && ast.IsDeclaration(reference.Parent) && reference.Parent.Name() == reference {
 * 		location = ast.GetDeclarationContainer(reference.Parent)
 * 	}
 *
 * 	if r.hooks.ResolveName != nil {
 * 		return r.hooks.ResolveName(location, reference.Text(), ast.SymbolFlagsExportValue|ast.SymbolFlagsValue|ast.SymbolFlagsAlias, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /)
 * 	}
 *
 * 	if r.resolver == nil {
 * 		r.resolver = &NameResolver{
 * 			CompilerOptions: r.options,
 * 		}
 * 	}
 *
 * 	return r.resolver.Resolve(location, reference.Text(), ast.SymbolFlagsExportValue|ast.SymbolFlagsValue|ast.SymbolFlagsAlias, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /)
 * }
 */
export declare function referenceResolver_getReferencedValueSymbol(receiver: GoPtr<referenceResolver>, reference: GoPtr<IdentifierNode>, startInDeclarationContainer: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.isTypeOnlyAliasDeclaration","kind":"method","status":"implemented","sigHash":"390ec139fdee1fb264dfd80b8200c141c8339f20c0b7e6fbe742ee66226b8dc5","bodyHash":"e66eae3a7641f70184794f9939ca904bef95f9f89d912058c9000178110f2c50"}
 *
 * Go source:
 * func (r *referenceResolver) isTypeOnlyAliasDeclaration(symbol *ast.Symbol) bool {
 * 	if symbol != nil {
 * 		if r.hooks.GetTypeOnlyAliasDeclaration != nil {
 * 			return r.hooks.GetTypeOnlyAliasDeclaration(symbol, ast.SymbolFlagsValue) != nil
 * 		}
 *
 * 		node := r.getDeclarationOfAliasSymbol(symbol)
 * 		for node != nil {
 * 			switch node.Kind {
 * 			case ast.KindImportEqualsDeclaration, ast.KindExportDeclaration:
 * 				return node.IsTypeOnly()
 * 			case ast.KindImportClause, ast.KindImportSpecifier, ast.KindExportSpecifier:
 * 				if node.IsTypeOnly() {
 * 					return true
 * 				}
 * 				node = node.Parent
 * 				continue
 * 			case ast.KindNamedImports, ast.KindNamedExports:
 * 				node = node.Parent
 * 				continue
 * 			}
 * 			break
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function referenceResolver_isTypeOnlyAliasDeclaration(receiver: GoPtr<referenceResolver>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getDeclarationOfAliasSymbol","kind":"method","status":"implemented","sigHash":"dcec728a41d3c4fdab0f005793f43d54b5ab20c639e0b511173988e01b28ddd7","bodyHash":"63b7f12f5e8353a39db34863d2177ed5fe6db3d661fa37dcd7351a36c160d25a"}
 *
 * Go source:
 * func (r *referenceResolver) getDeclarationOfAliasSymbol(symbol *ast.Symbol) *ast.Declaration {
 * 	return core.FindLast(symbol.Declarations, ast.IsAliasSymbolDeclaration)
 * }
 */
export declare function referenceResolver_getDeclarationOfAliasSymbol(receiver: GoPtr<referenceResolver>, symbol_: GoPtr<Symbol>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.getExportSymbolOfValueSymbolIfExported","kind":"method","status":"implemented","sigHash":"7e51b4a844ba037afc1fa77c11a4c27bae7e6484303a549372ea9ebee5513f90","bodyHash":"a4ac5086752d6bf391b281a2f049be18adb60c35bb8e5cd698fba6206bfe6aba"}
 *
 * Go source:
 * func (r *referenceResolver) getExportSymbolOfValueSymbolIfExported(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol != nil {
 * 		if r.hooks.GetExportSymbolOfValueSymbolIfExported != nil {
 * 			return r.hooks.GetExportSymbolOfValueSymbolIfExported(symbol)
 * 		}
 * 		if symbol.Flags&ast.SymbolFlagsExportValue != 0 && symbol.ExportSymbol != nil {
 * 			symbol = symbol.ExportSymbol
 * 		}
 * 		return r.getMergedSymbol(symbol)
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_getExportSymbolOfValueSymbolIfExported(receiver: GoPtr<referenceResolver>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetReferencedExportContainer","kind":"method","status":"implemented","sigHash":"6ca27a644888b56ef1bdd7412e826e8f07c33e83434f7ba991950fa8190d0ca8","bodyHash":"784c64b8f5928dff365773c33fcbad23d7c75ad445072cedf6b8e4c29d1c62d1"}
 *
 * Go source:
 * func (r *referenceResolver) GetReferencedExportContainer(node *ast.IdentifierNode, prefixLocals bool) *ast.Node /*SourceFile|ModuleDeclaration|EnumDeclaration* / {
 * 	// When resolving the export for the name of a module or enum
 * 	// declaration, we need to start resolution at the declaration's container.
 * 	// Otherwise, we could incorrectly resolve the export as the
 * 	// declaration if it contains an exported member with the same name.
 * 	startInDeclarationContainer := node.Parent != nil && (node.Parent.Kind == ast.KindModuleDeclaration || node.Parent.Kind == ast.KindEnumDeclaration) && node == node.Parent.Name()
 * 	if symbol := r.getReferencedValueSymbol(node, startInDeclarationContainer); symbol != nil {
 * 		if symbol.Flags&ast.SymbolFlagsExportValue != 0 {
 * 			// If we reference an exported entity within the same module declaration, then whether
 * 			// we prefix depends on the kind of entity. SymbolFlags.ExportHasLocal encompasses all the
 * 			// kinds that we do NOT prefix.
 * 			exportSymbol := r.getMergedSymbol(symbol.ExportSymbol)
 * 			if !prefixLocals && exportSymbol.Flags&ast.SymbolFlagsExportHasLocal != 0 && exportSymbol.Flags&ast.SymbolFlagsVariable == 0 {
 * 				return nil
 * 			}
 * 			symbol = exportSymbol
 * 		}
 * 		parentSymbol := r.getParentOfSymbol(symbol)
 * 		if parentSymbol != nil {
 * 			if parentSymbol.Flags&ast.SymbolFlagsValueModule != 0 && parentSymbol.ValueDeclaration != nil && parentSymbol.ValueDeclaration.Kind == ast.KindSourceFile {
 * 				symbolFile := parentSymbol.ValueDeclaration.AsSourceFile()
 * 				referenceFile := ast.GetSourceFileOfNode(node)
 * 				// If `node` accesses an export and that export isn't in the same file, then symbol is a namespace export, so return nil.
 * 				symbolIsUmdExport := symbolFile != referenceFile
 * 				if symbolIsUmdExport {
 * 					return nil
 * 				}
 * 				return symbolFile.AsNode()
 * 			}
 * 			isMatchingContainer := func(n *ast.Node) bool {
 * 				return (n.Kind == ast.KindModuleDeclaration || n.Kind == ast.KindEnumDeclaration) && r.getSymbolOfDeclaration(n) == parentSymbol
 * 			}
 * 			return ast.FindAncestor(node.Parent, isMatchingContainer)
 * 		}
 * 	}
 *
 * 	return nil
 * }
 */
export declare function referenceResolver_GetReferencedExportContainer(receiver: GoPtr<referenceResolver>, node: GoPtr<IdentifierNode>, prefixLocals: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetReferencedImportDeclaration","kind":"method","status":"implemented","sigHash":"f79ee5f24e9ac5224edcc61714cf1326e03ce1ab5cc85cc6bf77612b509a308b","bodyHash":"221aabe5cb3795f02f140f361266b33f7ecd6e2cc73d16c85c16fd43fbdd2b50"}
 *
 * Go source:
 * func (r *referenceResolver) GetReferencedImportDeclaration(node *ast.IdentifierNode) *ast.Declaration {
 * 	if symbol := r.getReferencedValueSymbol(node, false /*startInDeclarationContainer* /); symbol != nil {
 * 		// We should only get the declaration of an alias if there isn't a local value
 * 		// declaration for the symbol
 * 		if ast.IsNonLocalAlias(symbol, ast.SymbolFlagsValue /*excludes* /) && !r.isTypeOnlyAliasDeclaration(symbol) {
 * 			return r.getDeclarationOfAliasSymbol(symbol)
 * 		}
 * 	}
 *
 * 	return nil
 * }
 */
export declare function referenceResolver_GetReferencedImportDeclaration(receiver: GoPtr<referenceResolver>, node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetReferencedValueDeclaration","kind":"method","status":"implemented","sigHash":"42bd3c17f392be3b02d0c4ebc85cc4a08605df617d99ecf44f565008f39f0cc1","bodyHash":"9f783fe3a87577f05a5038906f70fd187d6ad2e82778a0460956f7c2bd28d72d"}
 *
 * Go source:
 * func (r *referenceResolver) GetReferencedValueDeclaration(node *ast.IdentifierNode) *ast.Declaration {
 * 	if symbol := r.getReferencedValueSymbol(node, false /*startInDeclarationContainer* /); symbol != nil {
 * 		return r.getExportSymbolOfValueSymbolIfExported(symbol).ValueDeclaration
 * 	}
 * 	return nil
 * }
 */
export declare function referenceResolver_GetReferencedValueDeclaration(receiver: GoPtr<referenceResolver>, node: GoPtr<IdentifierNode>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetReferencedValueDeclarations","kind":"method","status":"implemented","sigHash":"a3d9679e1913650645bee1fc3f393223b6b2b7ef53262eccab4acb000fc1d613","bodyHash":"45579779989c5cca63af855533dcf26543c398437eac68913efa284337205c79"}
 *
 * Go source:
 * func (r *referenceResolver) GetReferencedValueDeclarations(node *ast.IdentifierNode) []*ast.Declaration {
 * 	var declarations []*ast.Declaration
 * 	if symbol := r.getReferencedValueSymbol(node, false /*startInDeclarationContainer* /); symbol != nil {
 * 		symbol = r.getExportSymbolOfValueSymbolIfExported(symbol)
 * 		for _, declaration := range symbol.Declarations {
 * 			switch declaration.Kind {
 * 			case ast.KindVariableDeclaration,
 * 				ast.KindParameter,
 * 				ast.KindBindingElement,
 * 				ast.KindPropertyDeclaration,
 * 				ast.KindPropertyAssignment,
 * 				ast.KindShorthandPropertyAssignment,
 * 				ast.KindEnumMember,
 * 				ast.KindObjectLiteralExpression,
 * 				ast.KindFunctionDeclaration,
 * 				ast.KindFunctionExpression,
 * 				ast.KindArrowFunction,
 * 				ast.KindClassDeclaration,
 * 				ast.KindClassExpression,
 * 				ast.KindEnumDeclaration,
 * 				ast.KindMethodDeclaration,
 * 				ast.KindGetAccessor,
 * 				ast.KindSetAccessor,
 * 				ast.KindModuleDeclaration:
 * 				declarations = append(declarations, declaration)
 * 			}
 * 		}
 * 	}
 * 	return declarations
 * }
 */
export declare function referenceResolver_GetReferencedValueDeclarations(receiver: GoPtr<referenceResolver>, node: GoPtr<IdentifierNode>): GoSlice<GoPtr<Declaration>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetElementAccessExpressionName","kind":"method","status":"implemented","sigHash":"dd077d1f1f4f5dcfcdb0b948b002d75d0160c3ad74ec3e5f7435b5e6b9c7c05a","bodyHash":"ecbde15c346537caed89d9e5f83486cf9e7031b3f4cb7fb43bb66dffe9ee71ab"}
 *
 * Go source:
 * func (r *referenceResolver) GetElementAccessExpressionName(expression *ast.ElementAccessExpression) string {
 * 	if expression != nil {
 * 		if r.hooks.GetElementAccessExpressionName != nil {
 * 			if name, ok := r.hooks.GetElementAccessExpressionName(expression); ok {
 * 				return name
 * 			}
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function referenceResolver_GetElementAccessExpressionName(receiver: GoPtr<referenceResolver>, expression: GoPtr<ElementAccessExpression>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/referenceresolver.go::method::referenceResolver.GetReferencedMemberValueDeclaration","kind":"method","status":"implemented","sigHash":"42ea677a7cc7f2b3129dc968cbaf00f111375ff7a24c311bb005ad842a8246df","bodyHash":"29eafcdbf4f1621c83c4352c44fa4552701fdb8e453e2c2aa8cd5fe33502bd54"}
 *
 * Go source:
 * func (r *referenceResolver) GetReferencedMemberValueDeclaration(node *ast.Node) *ast.Declaration {
 * 	// member references are `this.something` or `this[something]`, so should always simply have a resolved symbol
 * 	s := r.getResolvedSymbol(node)
 * 	if s == nil && node.Symbol() != nil {
 * 		// might be a declaration instead of a ref, get the merged declaration symbol
 * 		s = r.getMergedSymbol(node.Symbol())
 * 	}
 * 	if s == nil {
 * 		return nil
 * 	}
 * 	return r.getExportSymbolOfValueSymbolIfExported(s).ValueDeclaration
 * }
 */
export declare function referenceResolver_GetReferencedMemberValueDeclaration(receiver: GoPtr<referenceResolver>, node: GoPtr<Node>): GoPtr<Declaration>;
//# sourceMappingURL=referenceresolver.d.ts.map
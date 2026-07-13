import type { bool, int } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Declaration, ExportDeclarationNode, ExportSpecifierNode, Expression, IdentifierNode, ImportDeclarationNode, PropertyName } from "../../ast/generated/unions.js";
import type { CheckFlags } from "../../ast/checkflags.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import type { NodeFlags, SymbolFlags } from "../../ast/generated/flags.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import type { NameResolver } from "../../binder/nameresolver.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import type { ResolutionMode } from "../../core/compileroptions.js";
import type { Tristate } from "../../core/tristate.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { Result } from "../../evaluator/evaluator.js";
import type { Number } from "../../jsnum/jsnum.js";
import type { TypeMapper } from "../mapper.js";
import type { AccessFlags, ContextFlags, IndexFlags, IndexInfo, InterfaceType, MembersOrExportsResolutionKind, Signature, StructuredType, Type, TypeAlias, TypeFlags, TypeReference } from "../types.js";
import type { Checker, CheckMode, DeclarationSpaces, ExportCollisionTable, keyBuilder, MappedTypeNameTypeKind, TypeResolution, TypeSystemEntity, TypeSystemPropertyName, WideningContext } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalTypeResolver","kind":"method","status":"implemented","sigHash":"b7162538f53e2dd277927f7a92feb877cea155a3acd551202bdf5db7b187c06d","bodyHash":"ae676d3d0631edb5444cbe7274192e8b34763ec468969261be4dbef03d2d70f9"}
 *
 * Go source:
 * func (c *Checker) getGlobalTypeResolver(name string, arity int, reportErrors bool) func() *Type {
 * 	return core.Memoize(func() *Type {
 * 		return c.getGlobalType(name, arity, reportErrors)
 * 	})
 * }
 */
export declare function Checker_getGlobalTypeResolver(receiver: GoPtr<Checker>, name: string, arity: int, reportErrors: bool): () => GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalTypeAliasResolver","kind":"method","status":"implemented","sigHash":"7e38249c5f1a253e924b7daa001f70af7a7375c8405b2d77281768559ca0a2a1","bodyHash":"cf7179f0807365be89ebe971c72a3f04a55ff5a78ba01b539c6289d176e93d9e"}
 *
 * Go source:
 * func (c *Checker) getGlobalTypeAliasResolver(name string, arity int, reportErrors bool) func() *ast.Symbol {
 * 	return core.Memoize(func() *ast.Symbol {
 * 		return c.getGlobalTypeAliasSymbol(name, arity, reportErrors)
 * 	})
 * }
 */
export declare function Checker_getGlobalTypeAliasResolver(receiver: GoPtr<Checker>, name: string, arity: int, reportErrors: bool): () => GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalValueSymbolResolver","kind":"method","status":"implemented","sigHash":"934b728e7ffd63cf1ef4a9cca6f831259193f35aa5b71f0b6be5bd7af6b78a6f","bodyHash":"eabe894178de5117d745da6ae12de257d2422885e2e5be8d2b361ae6f2a0ba9c"}
 *
 * Go source:
 * func (c *Checker) getGlobalValueSymbolResolver(name string, reportErrors bool) func() *ast.Symbol {
 * 	return core.Memoize(func() *ast.Symbol {
 * 		return c.getGlobalSymbol(name, ast.SymbolFlagsValue, core.IfElse(reportErrors, diagnostics.Cannot_find_global_value_0, nil))
 * 	})
 * }
 */
export declare function Checker_getGlobalValueSymbolResolver(receiver: GoPtr<Checker>, name: string, reportErrors: bool): () => GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalTypeSymbolResolver","kind":"method","status":"implemented","sigHash":"d69ede9f7938ed55e084b229d4a96ca3730e2c971bd429957c5d8c602720520b","bodyHash":"bd8e950ffb97965123d60b4993f50007a309e3b5ee064ac6b4ed9a88e026ed70"}
 *
 * Go source:
 * func (c *Checker) getGlobalTypeSymbolResolver(name string, reportErrors bool) func() *ast.Symbol {
 * 	return core.Memoize(func() *ast.Symbol {
 * 		return c.getGlobalSymbol(name, ast.SymbolFlagsType, core.IfElse(reportErrors, diagnostics.Cannot_find_global_type_0, nil))
 * 	})
 * }
 */
export declare function Checker_getGlobalTypeSymbolResolver(receiver: GoPtr<Checker>, name: string, reportErrors: bool): () => GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalTypesResolver","kind":"method","status":"implemented","sigHash":"cb84c3a0f1b3e5e1cb1f88ea84beb6aa94aa43e2ef5b78ceea3236a576fccf16","bodyHash":"030faf3dd0c3a56f8fc7b51aadff2d3a65954921ecfe3cf6877d3485f4ebdf21"}
 *
 * Go source:
 * func (c *Checker) getGlobalTypesResolver(names []string, arity int, reportErrors bool) func() []*Type {
 * 	return core.Memoize(func() []*Type {
 * 		return core.Map(names, func(name string) *Type {
 * 			return c.getGlobalType(name, arity, reportErrors)
 * 		})
 * 	})
 * }
 */
export declare function Checker_getGlobalTypesResolver(receiver: GoPtr<Checker>, names: GoSlice<string>, arity: int, reportErrors: bool): () => GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalTypeAliasSymbol","kind":"method","status":"implemented","sigHash":"a8f25af34eebba563beb8b45d848462ce8ac562b39c88838f2733acf50d9612f","bodyHash":"5e281b96791d1fa25c2e123658e053c9d10b26ef1ab2fee9e3a3e565b6c29731"}
 *
 * Go source:
 * func (c *Checker) getGlobalTypeAliasSymbol(name string, arity int, reportErrors bool) *ast.Symbol {
 * 	symbol := c.getGlobalSymbol(name, ast.SymbolFlagsTypeAlias, core.IfElse(reportErrors, diagnostics.Cannot_find_global_type_0, nil))
 * 	if symbol == nil {
 * 		return nil
 * 	}
 * 	// Resolve the declared type of the symbol. This resolves type parameters for the type alias so that we can check arity.
 * 	c.getDeclaredTypeOfSymbol(symbol)
 * 	if len(c.typeAliasLinks.Get(symbol).typeParameters) != arity {
 * 		if reportErrors {
 * 			decl := core.Find(symbol.Declarations, ast.IsTypeAliasDeclaration)
 * 			c.error(decl, diagnostics.Global_type_0_must_have_1_type_parameter_s, ast.SymbolName(symbol), arity)
 * 		}
 * 		return nil
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_getGlobalTypeAliasSymbol(receiver: GoPtr<Checker>, name: string, arity: int, reportErrors: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalType","kind":"method","status":"implemented","sigHash":"fee7eaf0e6402d2e8491a60b5feadecc002db43584de2b172431cc21a9a09942","bodyHash":"b0e23b740732580d8aeb8fa5024bc6efb5c769db9dbd3e7bae31b4fb9e5d0a8c"}
 *
 * Go source:
 * func (c *Checker) getGlobalType(name string, arity int, reportErrors bool) *Type {
 * 	symbol := c.getGlobalSymbol(name, ast.SymbolFlagsType, core.IfElse(reportErrors, diagnostics.Cannot_find_global_type_0, nil))
 * 	if symbol != nil {
 * 		if symbol.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsInterface) != 0 {
 * 			t := c.getDeclaredTypeOfSymbol(symbol)
 * 			if len(t.AsInterfaceType().TypeParameters()) == arity {
 * 				return t
 * 			}
 * 			if reportErrors {
 * 				c.error(getGlobalTypeDeclaration(symbol), diagnostics.Global_type_0_must_have_1_type_parameter_s, ast.SymbolName(symbol), arity)
 * 			}
 * 		} else if reportErrors {
 * 			c.error(getGlobalTypeDeclaration(symbol), diagnostics.Global_type_0_must_be_a_class_or_interface_type, ast.SymbolName(symbol))
 * 		}
 * 	}
 * 	if arity != 0 {
 * 		return c.emptyGenericType
 * 	}
 * 	return c.emptyObjectType
 * }
 */
export declare function Checker_getGlobalType(receiver: GoPtr<Checker>, name: string, arity: int, reportErrors: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalSymbol","kind":"method","status":"implemented","sigHash":"7e6b2087484b96d608cfe104a6b6e6d357d3dee4c2929ba694fa5487d07b85f5","bodyHash":"b0ed180d30064b965e57459c9aac2e514e0e7b481a744bb44d18cf49cc6fb97d"}
 *
 * Go source:
 * func (c *Checker) getGlobalSymbol(name string, meaning ast.SymbolFlags, diagnostic *diagnostics.Message) *ast.Symbol {
 * 	// Don't track references for global symbols anyway, so value if `isReference` is arbitrary
 * 	return c.resolveName(nil, name, meaning, diagnostic, false /*isUse* /, false /*excludeGlobals* /)
 * }
 */
export declare function Checker_getGlobalSymbol(receiver: GoPtr<Checker>, name: string, meaning: SymbolFlags, diagnostic: GoPtr<Message>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createNameResolver","kind":"method","status":"implemented","sigHash":"8fd7515253e7a753c17c76bce5bcd2e991e84840279af0dd5bfb22dca6b536d1","bodyHash":"a1fea20b2285a3e4b6ad2935e9863bb1a2e1d6259854354788f9bd0413719e3d"}
 *
 * Go source:
 * func (c *Checker) createNameResolver() *binder.NameResolver {
 * 	return &binder.NameResolver{
 * 		CompilerOptions:                  c.compilerOptions,
 * 		GetSymbolOfDeclaration:           c.getSymbolOfDeclaration,
 * 		Error:                            c.error,
 * 		Globals:                          c.globals,
 * 		ArgumentsSymbol:                  c.argumentsSymbol,
 * 		RequireSymbol:                    c.requireSymbol,
 * 		Lookup:                           c.getSymbol,
 * 		SymbolReferenced:                 c.symbolReferenced,
 * 		SetRequiresScopeChangeCache:      c.setRequiresScopeChangeCache,
 * 		GetRequiresScopeChangeCache:      c.getRequiresScopeChangeCache,
 * 		OnPropertyWithInvalidInitializer: c.checkAndReportErrorForInvalidInitializer,
 * 		OnFailedToResolveSymbol:          c.onFailedToResolveSymbol,
 * 		OnSuccessfullyResolvedSymbol:     c.onSuccessfullyResolvedSymbol,
 * 	}
 * }
 */
export declare function Checker_createNameResolver(receiver: GoPtr<Checker>): GoPtr<NameResolver>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createNameResolverForSuggestion","kind":"method","status":"implemented","sigHash":"cb393713d0f9edea7275b3a25c672e7e99b9c1b5e167e3e6d96bc22f87e13246","bodyHash":"c1d2a69f003a311d6bf824eb3545cbb6a3e7734024674cd80a27ee0326cb3fab"}
 *
 * Go source:
 * func (c *Checker) createNameResolverForSuggestion() *binder.NameResolver {
 * 	return &binder.NameResolver{
 * 		CompilerOptions:             c.compilerOptions,
 * 		GetSymbolOfDeclaration:      c.getSymbolOfDeclaration,
 * 		Error:                       c.error,
 * 		Globals:                     c.globals,
 * 		ArgumentsSymbol:             c.argumentsSymbol,
 * 		RequireSymbol:               c.requireSymbol,
 * 		Lookup:                      c.getSuggestionForSymbolNameLookup,
 * 		SymbolReferenced:            c.symbolReferenced,
 * 		SetRequiresScopeChangeCache: c.setRequiresScopeChangeCache,
 * 		GetRequiresScopeChangeCache: c.getRequiresScopeChangeCache,
 * 	}
 * }
 */
export declare function Checker_createNameResolverForSuggestion(receiver: GoPtr<Checker>): GoPtr<NameResolver>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRequiresScopeChangeCache","kind":"method","status":"implemented","sigHash":"4ec497a52337bdb5d8753beaf4e3731940fc451212f9b258bf4c05e9d3ba65f7","bodyHash":"c4a254ba8dc6c929691792dbdfa8cc2a44c90f481eec567f27140e342683d5c8"}
 *
 * Go source:
 * func (c *Checker) getRequiresScopeChangeCache(node *ast.Node) core.Tristate {
 * 	return c.nodeLinks.Get(node).declarationRequiresScopeChange
 * }
 */
export declare function Checker_getRequiresScopeChangeCache(receiver: GoPtr<Checker>, node: GoPtr<Node>): Tristate;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.setRequiresScopeChangeCache","kind":"method","status":"implemented","sigHash":"6193ebaf045446e2da782504fb4d34eca5959141f3c303bf5e8474b613e6f2df","bodyHash":"b3aeea0e2b1591f8b04ad3bc2246b0ead3538cc662d92f08ab73d995f6385b47"}
 *
 * Go source:
 * func (c *Checker) setRequiresScopeChangeCache(node *ast.Node, value core.Tristate) {
 * 	c.nodeLinks.Get(node).declarationRequiresScopeChange = value
 * }
 */
export declare function Checker_setRequiresScopeChangeCache(receiver: GoPtr<Checker>, node: GoPtr<Node>, value: Tristate): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.onFailedToResolveSymbol","kind":"method","status":"implemented","sigHash":"1b3f268b58f74d1ec2633504901de9e8981b7ffee588780473b6915298c69a42","bodyHash":"3802e3fc0ef406c635b993dfb682fa8b3bd99a4a806de296b59759067eb1e29f"}
 *
 * Go source:
 * func (c *Checker) onFailedToResolveSymbol(errorLocation *ast.Node, name string, meaning ast.SymbolFlags, nameNotFoundMessage *diagnostics.Message) {
 * 	if errorLocation != nil && (errorLocation.Parent.Kind == ast.KindJSDocLink ||
 * 		c.checkAndReportErrorForMissingPrefix(errorLocation, name) ||
 * 		c.checkAndReportErrorForExtendingInterface(errorLocation) ||
 * 		c.checkAndReportErrorForUsingTypeAsNamespace(errorLocation, name, meaning) ||
 * 		c.checkAndReportErrorForExportingPrimitiveType(errorLocation, name) ||
 * 		c.checkAndReportErrorForUsingNamespaceAsTypeOrValue(errorLocation, name, meaning) ||
 * 		c.checkAndReportErrorForUsingTypeAsValue(errorLocation, name, meaning) ||
 * 		c.checkAndReportErrorForUsingValueAsType(errorLocation, name, meaning)) {
 * 		return
 * 	}
 * 	declarationName := name
 * 	if errorLocation != nil && ast.IsIdentifier(errorLocation) && errorLocation.Text() == name {
 * 		declarationName = scanner.DeclarationNameToString(errorLocation) // use escape sequences from original file
 * 	}
 * 	// Report missing lib first
 * 	suggestedLib := c.getSuggestedLibForNonExistentName(name)
 * 	if suggestedLib != "" {
 * 		c.error(errorLocation, nameNotFoundMessage, declarationName, suggestedLib)
 * 		return
 * 	}
 * 	// Then spelling suggestions
 * 	suggestion := c.getSuggestedSymbolForNonexistentSymbol(errorLocation, name, meaning)
 * 	if suggestion != nil && !(suggestion.ValueDeclaration != nil && ast.IsAmbientModule(suggestion.ValueDeclaration) && ast.IsGlobalScopeAugmentation(suggestion.ValueDeclaration)) {
 * 		suggestionName := c.symbolToString(suggestion)
 * 		isUncheckedJS := c.isUncheckedJSSuggestion(errorLocation, suggestion, false /*excludeClasses* /)
 * 		message := core.IfElse(meaning == ast.SymbolFlagsNamespace, diagnostics.Cannot_find_namespace_0_Did_you_mean_1,
 * 			core.IfElse(isUncheckedJS, diagnostics.Could_not_find_name_0_Did_you_mean_1, diagnostics.Cannot_find_name_0_Did_you_mean_1))
 * 		diagnostic := NewDiagnosticForNode(errorLocation, message, declarationName, suggestionName)
 * 		if suggestion.ValueDeclaration != nil {
 * 			diagnostic.AddRelatedInfo(NewDiagnosticForNode(suggestion.ValueDeclaration, diagnostics.X_0_is_declared_here, suggestionName))
 * 		}
 * 		c.addErrorOrSuggestion(!isUncheckedJS, diagnostic)
 * 		return
 * 	}
 * 	// And then fall back to unspecified "not found"
 * 	c.error(errorLocation, nameNotFoundMessage, declarationName)
 * }
 */
export declare function Checker_onFailedToResolveSymbol(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, meaning: SymbolFlags, nameNotFoundMessage: GoPtr<Message>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedLibForNonExistentName","kind":"method","status":"implemented","sigHash":"876ffb76ceb669a67e450f4a726f950decdf0268cb9b7928908311849651691f","bodyHash":"2e4eef27ddaf284b9a41ee35548a05641b95c6d6196db75fdab1af57fb9c0be9"}
 *
 * Go source:
 * func (c *Checker) getSuggestedLibForNonExistentName(name string) string {
 * 	featureMap := getFeatureMap()
 * 	if typeFeatures, ok := featureMap[name]; ok {
 * 		return typeFeatures[0].lib
 * 	}
 * 	return ""
 * }
 */
export declare function Checker_getSuggestedLibForNonExistentName(receiver: GoPtr<Checker>, name: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedSymbolForNonexistentSymbol","kind":"method","status":"implemented","sigHash":"ec8071e00ca8386ea35d919b3d9e9459b44528efb8174c173301b77d937ccbe1","bodyHash":"0e9e264d5f3792c33a17412e3975021b69cc7184075da6fdc03313d9035da7bf"}
 *
 * Go source:
 * func (c *Checker) getSuggestedSymbolForNonexistentSymbol(location *ast.Node, outerName string, meaning ast.SymbolFlags) *ast.Symbol {
 * 	return c.resolveNameForSymbolSuggestion(location, outerName, meaning, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /)
 * }
 */
export declare function Checker_getSuggestedSymbolForNonexistentSymbol(receiver: GoPtr<Checker>, location: GoPtr<Node>, outerName: string, meaning: SymbolFlags): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestionForSymbolNameLookup","kind":"method","status":"implemented","sigHash":"c89b3c38a06f9e7922ed0d75c0fed7ac55e85428ef2454a3a47fc39c235114b9","bodyHash":"4d47fdc0c51d1e8522af8cbb3a05b45f2b4efd16e66cb4b2fda7e893ef0c6b89"}
 *
 * Go source:
 * func (c *Checker) getSuggestionForSymbolNameLookup(symbols ast.SymbolTable, name string, meaning ast.SymbolFlags) *ast.Symbol {
 * 	symbol := c.getSymbol(symbols, name, meaning)
 * 	if symbol != nil {
 * 		return symbol
 * 	}
 * 	var extras iter.Seq[*ast.Symbol]
 * 	if meaning&ast.SymbolFlagsGlobalLookup != 0 {
 * 		extras = getPrimitiveTypeAliasSuggestions(symbols)
 * 	}
 * 	return c.getSpellingSuggestionForName(name, core.ConcatenateSeq(maps.Values(symbols), extras), meaning)
 * }
 */
export declare function Checker_getSuggestionForSymbolNameLookup(receiver: GoPtr<Checker>, symbols: SymbolTable | undefined, name: string, meaning: SymbolFlags): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSpellingSuggestionForName","kind":"method","status":"implemented","sigHash":"bc02672c1e2a8e463cbed4eb689e0647c5cbbea185fda405d6389fd28c0d55d1","bodyHash":"51d3163f8fc570c72d00c4d2add30107efd6969f470c454cdd16ba663891ddf9"}
 *
 * Go source:
 * func (c *Checker) getSpellingSuggestionForName(name string, symbols iter.Seq[*ast.Symbol], meaning ast.SymbolFlags) *ast.Symbol {
 * 	getCandidateName := func(candidate *ast.Symbol) string {
 * 		candidateName := ast.SymbolName(candidate)
 * 		if len(candidateName) == 0 || candidateName[0] == '"' || candidateName[0] == '\xFE' {
 * 			return ""
 * 		}
 * 		if candidate.Flags&meaning != 0 {
 * 			return candidateName
 * 		}
 * 		if candidate.Flags&ast.SymbolFlagsAlias != 0 {
 * 			alias := c.tryResolveAlias(candidate)
 * 			if alias != nil && alias.Flags&meaning != 0 {
 * 				return candidateName
 * 			}
 * 		}
 * 		return ""
 * 	}
 * 	return core.GetSpellingSuggestion(name, symbols, getCandidateName, c.compareSymbols)
 * }
 */
export declare function Checker_getSpellingSuggestionForName(receiver: GoPtr<Checker>, name: string, symbols: GoSeq<GoPtr<Symbol>>, meaning: SymbolFlags): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.onSuccessfullyResolvedSymbol","kind":"method","status":"implemented","sigHash":"21b3c0f3b697b0abe50a4d6cb7622e77f35f962ccce9e52f3ccf9b57bd457ba7","bodyHash":"fbcba0fc41febaec41b8f85e8a96fc4936051d9091261db6ba769fc12260e933"}
 *
 * Go source:
 * func (c *Checker) onSuccessfullyResolvedSymbol(errorLocation *ast.Node, result *ast.Symbol, meaning ast.SymbolFlags, lastLocation *ast.Node, associatedDeclarationForContainingInitializerOrBindingName *ast.Node, withinDeferredContext bool) {
 * 	name := result.Name
 * 	isInExternalModule := lastLocation != nil && ast.IsSourceFile(lastLocation) && ast.IsExternalOrCommonJSModule(lastLocation.AsSourceFile())
 * 	// Only check for block-scoped variable if we have an error location and are looking for the
 * 	// name with variable meaning
 * 	//      For example,
 * 	//          declare module foo {
 * 	//              interface bar {}
 * 	//          }
 * 	//      const foo/*1* /: foo/*2* /.bar;
 * 	// The foo at /*1* / and /*2* / will share same symbol with two meanings:
 * 	// block-scoped variable and namespace module. However, only when we
 * 	// try to resolve name in /*1* / which is used in variable position,
 * 	// we want to check for block-scoped
 * 	if errorLocation != nil && (meaning&ast.SymbolFlagsBlockScopedVariable != 0 || meaning&(ast.SymbolFlagsClass|ast.SymbolFlagsEnum) != 0 && meaning&ast.SymbolFlagsValue == ast.SymbolFlagsValue) {
 * 		exportOrLocalSymbol := c.getExportSymbolOfValueSymbolIfExported(result)
 * 		if exportOrLocalSymbol.Flags&(ast.SymbolFlagsBlockScopedVariable|ast.SymbolFlagsClass|ast.SymbolFlagsEnum) != 0 {
 * 			c.checkResolvedBlockScopedVariable(exportOrLocalSymbol, errorLocation)
 * 		}
 * 	}
 * 	// If we're in an external module, we can't reference value symbols created from UMD export declarations
 * 	if isInExternalModule && (meaning&ast.SymbolFlagsValue) == ast.SymbolFlagsValue && errorLocation.Flags&ast.NodeFlagsJSDoc == 0 {
 * 		merged := c.getMergedSymbol(result)
 * 		if len(merged.Declarations) != 0 && core.Every(merged.Declarations, func(d *ast.Node) bool {
 * 			return ast.IsNamespaceExportDeclaration(d) || ast.IsSourceFile(d) && d.AsSourceFile().GlobalExports != nil
 * 		}) {
 * 			c.errorOrSuggestion(c.compilerOptions.AllowUmdGlobalAccess != core.TSTrue, errorLocation, diagnostics.X_0_refers_to_a_UMD_global_but_the_current_file_is_a_module_Consider_adding_an_import_instead, name)
 * 		}
 * 	}
 * 	// If we're in a parameter initializer or binding name, we can't reference the values of the parameter whose initializer we're within or parameters to the right
 * 	if associatedDeclarationForContainingInitializerOrBindingName != nil && !withinDeferredContext && (meaning&ast.SymbolFlagsValue) == ast.SymbolFlagsValue {
 * 		candidate := c.getMergedSymbol(c.getLateBoundSymbol(result))
 * 		root := ast.GetRootDeclaration(associatedDeclarationForContainingInitializerOrBindingName)
 * 		// A parameter initializer or binding pattern initializer within a parameter cannot refer to itself
 * 		if candidate == c.getSymbolOfDeclaration(associatedDeclarationForContainingInitializerOrBindingName) {
 * 			c.error(errorLocation, diagnostics.Parameter_0_cannot_reference_itself, scanner.DeclarationNameToString(associatedDeclarationForContainingInitializerOrBindingName.Name()))
 * 		} else if candidate.ValueDeclaration != nil && candidate.ValueDeclaration.Pos() > associatedDeclarationForContainingInitializerOrBindingName.Pos() && root.Parent.Locals() != nil && c.getSymbol(root.Parent.Locals(), candidate.Name, meaning) == candidate {
 * 			c.error(errorLocation, diagnostics.Parameter_0_cannot_reference_identifier_1_declared_after_it, scanner.DeclarationNameToString(associatedDeclarationForContainingInitializerOrBindingName.Name()), scanner.DeclarationNameToString(errorLocation))
 * 		}
 * 	}
 * 	if errorLocation != nil && meaning&ast.SymbolFlagsValue != 0 && result.Flags&ast.SymbolFlagsAlias != 0 && result.Flags&ast.SymbolFlagsValue == 0 && !ast.IsValidTypeOnlyAliasUseSite(errorLocation) {
 * 		typeOnlyDeclaration := c.getTypeOnlyAliasDeclarationEx(result, ast.SymbolFlagsValue)
 * 		if typeOnlyDeclaration != nil {
 * 			message := core.IfElse(ast.NodeKindIs(typeOnlyDeclaration, ast.KindExportSpecifier, ast.KindExportDeclaration, ast.KindNamespaceExport),
 * 				diagnostics.X_0_cannot_be_used_as_a_value_because_it_was_exported_using_export_type,
 * 				diagnostics.X_0_cannot_be_used_as_a_value_because_it_was_imported_using_import_type)
 * 			c.addTypeOnlyDeclarationRelatedInfo(c.error(errorLocation, message, name), typeOnlyDeclaration, name)
 * 		}
 * 	}
 * 	// Look at 'compilerOptions.isolatedModules' and not 'getIsolatedModules(...)' (which considers 'verbatimModuleSyntax')
 * 	// here because 'verbatimModuleSyntax' will already have an error for importing a type without 'import type'.
 * 	if c.compilerOptions.IsolatedModules == core.TSTrue && result != nil && isInExternalModule && (meaning&ast.SymbolFlagsValue) == ast.SymbolFlagsValue {
 * 		isGlobal := c.getSymbol(c.globals, name, meaning) == result
 * 		var nonValueSymbol *ast.Symbol
 * 		if isGlobal && ast.IsSourceFile(lastLocation) {
 * 			nonValueSymbol = c.getSymbol(lastLocation.Locals(), name, ^ast.SymbolFlagsValue)
 * 		}
 * 		if nonValueSymbol != nil {
 * 			importDecl := core.Find(nonValueSymbol.Declarations, func(d *ast.Node) bool {
 * 				return ast.NodeKindIs(d, ast.KindImportSpecifier, ast.KindImportClause, ast.KindNamespaceImport, ast.KindImportEqualsDeclaration)
 * 			})
 * 			if importDecl != nil && !ast.IsTypeOnlyImportDeclaration(importDecl) {
 * 				c.error(importDecl, diagnostics.Import_0_conflicts_with_global_value_used_in_this_file_so_must_be_declared_with_a_type_only_import_when_isolatedModules_is_enabled, name)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_onSuccessfullyResolvedSymbol(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, result: GoPtr<Symbol>, meaning: SymbolFlags, lastLocation: GoPtr<Node>, associatedDeclarationForContainingInitializerOrBindingName: GoPtr<Node>, withinDeferredContext: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkResolvedBlockScopedVariable","kind":"method","status":"implemented","sigHash":"1c2ed0ad5c053754bb76aef8898b6f3d0346bc137f633ad19082b52e1269784d","bodyHash":"73402d4e5b6e9355d43bccc6a031189c94560164a4018b824f17284014527ad5"}
 *
 * Go source:
 * func (c *Checker) checkResolvedBlockScopedVariable(result *ast.Symbol, errorLocation *ast.Node) {
 * 	debug.Assert(result.Flags&ast.SymbolFlagsBlockScopedVariable != 0 || result.Flags&ast.SymbolFlagsClass != 0 || result.Flags&ast.SymbolFlagsEnum != 0)
 * 	if result.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsFunctionScopedVariable|ast.SymbolFlagsAssignment) != 0 && result.Flags&ast.SymbolFlagsClass != 0 {
 * 		// constructor functions aren't block scoped
 * 		return
 * 	}
 * 	// Block-scoped variables cannot be used before their definition
 * 	declaration := core.Find(result.Declarations, func(d *ast.Node) bool {
 * 		return ast.IsBlockOrCatchScoped(d) || ast.IsClassLike(d) || ast.IsEnumDeclaration(d)
 * 	})
 * 	if declaration == nil {
 * 		panic("checkResolvedBlockScopedVariable could not find block-scoped declaration")
 * 	}
 * 	if declaration.Flags&ast.NodeFlagsAmbient == 0 && !c.isBlockScopedNameDeclaredBeforeUse(declaration, errorLocation) {
 * 		var diagnostic *ast.Diagnostic
 * 		declarationName := scanner.DeclarationNameToString(ast.GetNameOfDeclaration(declaration))
 * 		if result.Flags&ast.SymbolFlagsBlockScopedVariable != 0 {
 * 			diagnostic = c.error(errorLocation, diagnostics.Block_scoped_variable_0_used_before_its_declaration, declarationName)
 * 		} else if result.Flags&ast.SymbolFlagsClass != 0 {
 * 			diagnostic = c.error(errorLocation, diagnostics.Class_0_used_before_its_declaration, declarationName)
 * 		} else if result.Flags&ast.SymbolFlagsRegularEnum != 0 {
 * 			diagnostic = c.error(errorLocation, diagnostics.Enum_0_used_before_its_declaration, declarationName)
 * 		} else {
 * 			debug.Assert(result.Flags&ast.SymbolFlagsConstEnum != 0)
 * 			if c.compilerOptions.GetIsolatedModules() {
 * 				diagnostic = c.error(errorLocation, diagnostics.Enum_0_used_before_its_declaration, declarationName)
 * 			}
 * 		}
 * 		if diagnostic != nil {
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(declaration, diagnostics.X_0_is_declared_here, declarationName))
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkResolvedBlockScopedVariable(receiver: GoPtr<Checker>, result: GoPtr<Symbol>, errorLocation: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isBlockScopedNameDeclaredBeforeUse","kind":"method","status":"implemented","sigHash":"6e4600e09e59ec2c1962d04301955e544908f8ddc94a84dfc47a2c33c1cf52ec","bodyHash":"3e523cc217da236ba3439806cd10c8e00bab8ac8b5efbcc86220f45f5f85beb5"}
 *
 * Go source:
 * func (c *Checker) isBlockScopedNameDeclaredBeforeUse(declaration *ast.Node, usage *ast.Node) bool {
 * 	declarationFile := ast.GetSourceFileOfNode(declaration)
 * 	useFile := ast.GetSourceFileOfNode(usage)
 * 	declContainer := ast.GetEnclosingBlockScopeContainer(declaration)
 * 	if declarationFile != useFile {
 * 		// nodes are in different files and order cannot be determined
 * 		return true
 * 	}
 * 	// deferred usage in a type context is always OK regardless of the usage position:
 * 	if usage.Flags&ast.NodeFlagsJSDoc != 0 || IsInTypeQuery(usage) || c.isInAmbientOrTypeNode(usage) {
 * 		return true
 * 	}
 * 	if declaration.Pos() <= usage.Pos() && !(ast.IsPropertyDeclaration(declaration) && isThisProperty(usage.Parent) && declaration.Initializer() == nil && !isExclamationToken(declaration.PostfixToken())) {
 * 		// declaration is before usage
 * 		switch {
 * 		case declaration.Kind == ast.KindBindingElement:
 * 			// still might be illegal if declaration and usage are both binding elements (eg var [a = b, b = b] = [1, 2])
 * 			errorBindingElement := ast.FindAncestorKind(usage, ast.KindBindingElement)
 * 			if errorBindingElement != nil {
 * 				return ast.FindAncestor(errorBindingElement, ast.IsBindingElement) != ast.FindAncestor(declaration, ast.IsBindingElement) || declaration.Pos() < errorBindingElement.Pos()
 * 			}
 * 			// or it might be illegal if usage happens before parent variable is declared (eg var [a] = a)
 * 			return c.isBlockScopedNameDeclaredBeforeUse(ast.FindAncestorKind(declaration, ast.KindVariableDeclaration), usage)
 * 		case declaration.Kind == ast.KindVariableDeclaration:
 * 			// still might be illegal if usage is in the initializer of the variable declaration (eg var a = a)
 * 			return !isImmediatelyUsedInInitializerOfBlockScopedVariable(declaration, usage, declContainer)
 * 		case ast.IsClassLike(declaration):
 * 			// still might be illegal if the usage is within a computed property name in the class (eg class A { static p = "a"; [A.p]() {} })
 * 			// or when used within a decorator in the class (e.g. `@dec(A.x) class A { static x = "x" }`),
 * 			// except when used in a function that is not an IIFE (e.g., `@dec(() => A.x) class A { ... }`)
 * 			container := usage
 * 			for container != nil && container != declaration {
 * 				if ast.IsComputedPropertyName(container) && container.Parent.Parent == declaration ||
 * 					!c.legacyDecorators && ast.IsDecorator(container) && (container.Parent == declaration ||
 * 						ast.IsMethodDeclaration(container.Parent) && container.Parent.Parent == declaration ||
 * 						ast.IsAccessor(container.Parent) && container.Parent.Parent == declaration ||
 * 						ast.IsPropertyDeclaration(container.Parent) && container.Parent.Parent == declaration ||
 * 						ast.IsParameterDeclaration(container.Parent) && container.Parent.Parent.Parent == declaration) {
 * 					break
 * 				}
 * 				container = container.Parent
 * 			}
 * 			if container == nil || container == declaration {
 * 				return true
 * 			}
 * 			if !c.legacyDecorators && ast.IsDecorator(container) {
 * 				n := usage
 * 				for n != nil && n != container {
 * 					if ast.IsFunctionLike(n) && ast.GetImmediatelyInvokedFunctionExpression(n) == nil {
 * 						break
 * 					}
 * 					n = n.Parent
 * 				}
 * 				return n != nil && n != container
 * 			}
 * 			return false
 * 		case ast.IsPropertyDeclaration(declaration):
 * 			// still might be illegal if a self-referencing property initializer (eg private x = this.x)
 * 			return !isPropertyImmediatelyReferencedWithinDeclaration(declaration, usage, false /*stopAtAnyPropertyDeclaration* /)
 * 		case ast.IsParameterPropertyDeclaration(declaration, declaration.Parent):
 * 			// foo = this.bar is illegal in emitStandardClassFields when bar is a parameter property
 * 			return !(c.emitStandardClassFields && ast.GetContainingClass(declaration) == ast.GetContainingClass(usage) && c.isUsedInFunctionOrInstanceProperty(usage, declaration, declContainer))
 * 		}
 * 		return true
 * 	}
 * 	// declaration is after usage, but it can still be legal if usage is deferred:
 * 	// 1. inside an export specifier
 * 	// 2. inside a function
 * 	// 3. inside an instance property initializer, a reference to a non-instance property
 * 	//    (except when emitStandardClassFields: true and the reference is to a parameter property)
 * 	// 4. inside a static property initializer, a reference to a static method in the same class
 * 	// 5. inside a TS export= declaration (since we will move the export statement during emit to avoid TDZ)
 * 	if ast.IsExportSpecifier(usage.Parent) || ast.IsExportAssignment(usage.Parent) && usage.Parent.AsExportAssignment().IsExportEquals {
 * 		// export specifiers do not use the variable, they only make it available for use
 * 		return true
 * 	}
 * 	// When resolving symbols for exports, the `usage` location passed in can be the export site directly
 * 	if ast.IsExportAssignment(usage) && usage.AsExportAssignment().IsExportEquals {
 * 		return true
 * 	}
 * 	if c.isUsedInFunctionOrInstanceProperty(usage, declaration, declContainer) {
 * 		if c.emitStandardClassFields && ast.GetContainingClass(declaration) != nil && (ast.IsPropertyDeclaration(declaration) || ast.IsParameterPropertyDeclaration(declaration, declaration.Parent)) {
 * 			return !isPropertyImmediatelyReferencedWithinDeclaration(declaration, usage, true /*stopAtAnyPropertyDeclaration* /)
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isBlockScopedNameDeclaredBeforeUse(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, usage: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUsedInFunctionOrInstanceProperty","kind":"method","status":"implemented","sigHash":"7ecaa94b1a7da51827fc31980e75b073a936bb674f97fba7e30589678ac2d558","bodyHash":"89a2817eeb15d45d08eea66b46e823be94952fe8e7cdc9c7767e6b4e82e38127"}
 *
 * Go source:
 * func (c *Checker) isUsedInFunctionOrInstanceProperty(usage *ast.Node, declaration *ast.Node, declContainer *ast.Node) bool {
 * 	return ast.FindAncestorOrQuit(usage, func(current *ast.Node) ast.FindAncestorResult {
 * 		if current == declContainer {
 * 			return ast.FindAncestorQuit
 * 		}
 * 		if ast.IsFunctionLike(current) {
 * 			return ast.ToFindAncestorResult(ast.GetImmediatelyInvokedFunctionExpression(current) == nil)
 * 		}
 * 		if ast.IsClassStaticBlockDeclaration(current) {
 * 			return ast.ToFindAncestorResult(declaration.Pos() < usage.Pos())
 * 		}
 *
 * 		if current.Parent != nil && ast.IsPropertyDeclaration(current.Parent) {
 * 			propertyDeclaration := current.Parent
 * 			initializerOfProperty := propertyDeclaration.Initializer() == current
 * 			if initializerOfProperty {
 * 				if ast.IsStatic(current.Parent) {
 * 					if ast.IsMethodDeclaration(declaration) {
 * 						return ast.FindAncestorTrue
 * 					}
 * 					if ast.IsPropertyDeclaration(declaration) && ast.GetContainingClass(usage) == ast.GetContainingClass(declaration) {
 * 						propName := declaration.Name()
 * 						if ast.IsIdentifier(propName) || ast.IsPrivateIdentifier(propName) {
 * 							t := c.getTypeOfSymbol(c.getSymbolOfDeclaration(declaration))
 * 							staticBlocks := core.Filter(declaration.Parent.Members(), ast.IsClassStaticBlockDeclaration)
 * 							if c.isPropertyInitializedInStaticBlocks(propName, t, staticBlocks, declaration.Parent.Pos(), current.Pos()) {
 * 								return ast.FindAncestorTrue
 * 							}
 * 						}
 * 					}
 * 				} else {
 * 					isDeclarationInstanceProperty := ast.IsPropertyDeclaration(declaration) && !ast.IsStatic(declaration)
 * 					if !isDeclarationInstanceProperty || ast.GetContainingClass(usage) != ast.GetContainingClass(declaration) {
 * 						return ast.FindAncestorTrue
 * 					}
 * 				}
 * 			}
 * 		}
 *
 * 		if current.Parent != nil && ast.IsDecorator(current.Parent) {
 * 			decorator := current.Parent.AsDecorator()
 * 			if decorator.Expression == current {
 * 				if ast.IsParameterDeclaration(decorator.Parent) {
 * 					if c.isUsedInFunctionOrInstanceProperty(decorator.Parent.Parent.Parent, declaration, declContainer) {
 * 						return ast.FindAncestorTrue
 * 					}
 * 					return ast.FindAncestorQuit
 * 				}
 * 				if ast.IsMethodDeclaration(decorator.Parent) {
 * 					if c.isUsedInFunctionOrInstanceProperty(decorator.Parent.Parent, declaration, declContainer) {
 * 						return ast.FindAncestorTrue
 * 					}
 * 					return ast.FindAncestorQuit
 * 				}
 * 			}
 * 		}
 *
 * 		return ast.FindAncestorFalse
 * 	}) != nil
 * }
 */
export declare function Checker_isUsedInFunctionOrInstanceProperty(receiver: GoPtr<Checker>, usage: GoPtr<Node>, declaration: GoPtr<Node>, declContainer: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOnlyAliasDeclaration","kind":"method","status":"implemented","sigHash":"a5c4e7df30e5b487124cc655582e27143f194de3085a84b7fd2055f3560e9d15","bodyHash":"1e49881bd4be94ea07ee67c15b03b8f5bb94a20da73e00219dcd6dc3d1c1da6c"}
 *
 * Go source:
 * func (c *Checker) getTypeOnlyAliasDeclaration(symbol *ast.Symbol) *ast.Node {
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		c.resolveAlias(symbol)
 * 		return c.aliasSymbolLinks.Get(symbol).typeOnlyDeclaration
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeOnlyAliasDeclaration(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOnlyAliasDeclarationEx","kind":"method","status":"implemented","sigHash":"f2fee28c9f043169d61a0895c84f40cbdec23f2aabd47775ef344a4ddbae8d6d","bodyHash":"6081de1e28a569c095aa26e2c4db86fe2ae0e50ae6544be3ae14081d89ce22fe"}
 *
 * Go source:
 * func (c *Checker) getTypeOnlyAliasDeclarationEx(symbol *ast.Symbol, meaning ast.SymbolFlags) *ast.Node {
 * 	for symbol.Flags&ast.SymbolFlagsAlias != 0 && symbol.Flags&meaning == 0 {
 * 		resolved := c.resolveAlias(symbol)
 * 		links := c.aliasSymbolLinks.Get(symbol)
 * 		if links.typeOnlyDeclaration != nil {
 * 			return links.typeOnlyDeclaration
 * 		}
 * 		symbol = resolved
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeOnlyAliasDeclarationEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getImmediateAliasedSymbol","kind":"method","status":"implemented","sigHash":"dd5af1686061c9a59193a4456eaea2f6d68d32d45cdbb746ec071ebc7fcd57f0","bodyHash":"08e1448324b814c84cfff4a82abbb3a1174d1b451eaa17bb36532c2efff756df"}
 *
 * Go source:
 * func (c *Checker) getImmediateAliasedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	debug.Assert(symbol.Flags&ast.SymbolFlagsAlias != 0, "Should only get Alias here.")
 * 	links := c.aliasSymbolLinks.Get(symbol)
 * 	if links.immediateTarget == nil {
 * 		node := c.getDeclarationOfAliasSymbol(symbol)
 * 		if node == nil {
 * 			panic("Unexpected nil in getImmediateAliasedSymbol")
 * 		}
 * 		links.immediateTarget = c.getTargetOfAliasDeclaration(node)
 * 	}
 * 	return links.immediateTarget
 * }
 */
export declare function Checker_getImmediateAliasedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbol","kind":"method","status":"implemented","sigHash":"1825262d8c7066dd508f69a67d58cfe305ec3cdccd4c559ebc726bc78f28e8e5","bodyHash":"50c3ef6afb17aaeefc6c4bc78043e23262c3a5a33f7b24af06715383dbbf2e03"}
 *
 * Go source:
 * func (c *Checker) getSymbol(symbols ast.SymbolTable, name string, meaning ast.SymbolFlags) *ast.Symbol {
 * 	if meaning&ast.SymbolFlagsAll != 0 {
 * 		symbol := c.getMergedSymbol(symbols[name])
 * 		if symbol != nil {
 * 			if symbol.Flags&meaning != 0 {
 * 				return symbol
 * 			}
 * 			if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 				targetFlags := c.getSymbolFlags(symbol)
 * 				// `targetFlags` will be `SymbolFlags.All` if an error occurred in alias resolution; this avoids cascading errors
 * 				if targetFlags&meaning != 0 {
 * 					return symbol
 * 				}
 * 			}
 * 		}
 * 	}
 * 	// return nil if we can't find a symbol
 * 	return nil
 * }
 */
export declare function Checker_getSymbol(receiver: GoPtr<Checker>, symbols: SymbolTable | undefined, name: string, meaning: SymbolFlags): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveJSDocMemberName","kind":"method","status":"implemented","sigHash":"33cbfa129abe7f4d3f9fb764fa9b7126b07d81e72851b8db3244d87047626aa3","bodyHash":"29550308a230639826ef8ca18ff45b74e17eb22e85eadf24ad321873f880546f"}
 *
 * Go source:
 * func (c *Checker) resolveJSDocMemberName(name *ast.Node) *ast.Symbol {
 * 	if name != nil && ast.IsEntityName(name) {
 * 		meaning := ast.SymbolFlagsType | ast.SymbolFlagsNamespace | ast.SymbolFlagsValue
 * 		if symbol := c.resolveEntityName(name, meaning, true /*ignoreErrors* /, true /*dontResolveAlias* /, ast.GetHostSignatureFromJSDoc(name)); symbol != nil {
 * 			return symbol
 * 		}
 * 		if ast.IsQualifiedName(name) {
 * 			if symbol := c.resolveJSDocMemberName(name.AsQualifiedName().Left); symbol != nil {
 * 				var t *Type
 * 				if symbol.Flags&ast.SymbolFlagsValue != 0 {
 * 					proto := c.getPropertyOfType(c.getTypeOfSymbol(symbol), "prototype")
 * 					if proto != nil {
 * 						t = c.getTypeOfSymbol(proto)
 * 					}
 * 				}
 * 				if t == nil {
 * 					t = c.getDeclaredTypeOfSymbol(symbol)
 * 				}
 * 				return c.getPropertyOfType(t, name.AsQualifiedName().Right.Text())
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_resolveJSDocMemberName(receiver: GoPtr<Checker>, name: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyDeclaration","kind":"method","status":"implemented","sigHash":"b368a177575a79fe0d4f7e127ff70df6245ff84cab233081895969f7ce050700","bodyHash":"b28480cb4503d85d08830ed1f0abffcbe0b0e64c009c51e43000cef3ed2c3b2b"}
 *
 * Go source:
 * func (c *Checker) checkPropertyDeclaration(node *ast.Node) {
 * 	// Grammar checking
 * 	if !c.checkGrammarModifiers(node) && !c.checkGrammarProperty(node) {
 * 		c.checkGrammarComputedPropertyName(node.Name())
 * 	}
 * 	c.checkVariableLikeDeclaration(node)
 * 	c.setNodeLinksForPrivateIdentifierScope(node)
 * 	// property signatures already report "initializer not allowed in ambient context" elsewhere
 * 	if ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) && ast.IsPropertyDeclaration(node) {
 * 		if node.Initializer() != nil {
 * 			c.error(node, diagnostics.Property_0_cannot_have_an_initializer_because_it_is_marked_abstract, scanner.DeclarationNameToString(node.Name()))
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkPropertyDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMethodDeclaration","kind":"method","status":"implemented","sigHash":"b74493f952a4f44f06e682afae55c7ae965f832c12b3444ddbdc7fb20752a765","bodyHash":"0f306d40b14c5adeb7f12a76b92297e89458767f40b8b66a5b25a7484d379a9f"}
 *
 * Go source:
 * func (c *Checker) checkMethodDeclaration(node *ast.Node) {
 * 	// Grammar checking
 * 	if !c.checkGrammarMethod(node) {
 * 		c.checkGrammarComputedPropertyName(node.Name())
 * 		if ast.IsMethodDeclaration(node) && node.AsMethodDeclaration().AsteriskToken != nil && ast.IsIdentifier(node.Name()) && node.Name().Text() == "constructor" {
 * 			c.error(node.Name(), diagnostics.Class_constructor_may_not_be_a_generator)
 * 		}
 * 	}
 * 	// Grammar checking for modifiers is done inside the function checkGrammarFunctionLikeDeclaration
 * 	c.checkFunctionOrMethodDeclaration(node)
 * 	// method signatures already report "implementation not allowed in ambient context" elsewhere
 * 	if ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) && ast.IsMethodDeclaration(node) && node.Body() != nil {
 * 		c.error(node, diagnostics.Method_0_cannot_have_an_implementation_because_it_is_marked_abstract, scanner.DeclarationNameToString(node.Name()))
 * 	}
 * 	// Private named methods are only allowed in class declarations
 * 	if ast.IsPrivateIdentifier(node.Name()) && ast.GetContainingClass(node) == nil {
 * 		c.error(node, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 	}
 * 	c.setNodeLinksForPrivateIdentifierScope(node)
 * }
 */
export declare function Checker_checkMethodDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"a9bb84871b7d32a833fafd2b58d0d287121392e18844d655e1ba011dd7aeccf1","bodyHash":"6c7b61f980d4afa3a165d058122f804679bfa9855848bf5991ffc3ded821c87b"}
 *
 * Go source:
 * func (c *Checker) checkClassStaticBlockDeclaration(node *ast.Node) {
 * 	// Grammar checking
 * 	c.checkGrammarModifiers(node)
 * 	node.ForEachChild(c.checkSourceElement)
 * }
 */
export declare function Checker_checkClassStaticBlockDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAccessorDeclaration","kind":"method","status":"implemented","sigHash":"f74b691d3739b484808839e30656a56e2bc3d6c3db6001c49caf6c1d8b018d3b","bodyHash":"5540a1d9ff1d5020eb6ccec44db5d4823f445a62f0d6fe16e6bf3335c7dd6038"}
 *
 * Go source:
 * func (c *Checker) checkAccessorDeclaration(node *ast.Node) {
 * 	// Grammar checking accessors
 * 	if !c.checkGrammarFunctionLikeDeclaration(node) && !c.checkGrammarAccessor(node) {
 * 		c.checkGrammarComputedPropertyName(node.Name())
 * 	}
 * 	name := node.Name()
 * 	if ast.IsIdentifier(name) && name.Text() == "constructor" && ast.IsClassLike(node.Parent) {
 * 		c.error(node.Name(), diagnostics.Class_constructor_may_not_be_an_accessor)
 * 	}
 * 	c.checkDecorators(node)
 * 	c.checkSignatureDeclaration(node)
 * 	if ast.IsGetAccessorDeclaration(node) {
 * 		if node.Flags&ast.NodeFlagsAmbient == 0 && ast.NodeIsPresent(node.Body()) && node.Flags&ast.NodeFlagsHasImplicitReturn != 0 {
 * 			if node.Flags&ast.NodeFlagsHasExplicitReturn == 0 {
 * 				c.error(name, diagnostics.A_get_accessor_must_return_a_value)
 * 			}
 * 		}
 * 	}
 * 	// Do not use hasDynamicName here, because that returns false for well known symbols.
 * 	// We want to perform checkComputedPropertyName for all computed properties, including
 * 	// well known symbols.
 * 	if ast.IsComputedPropertyName(name) {
 * 		c.checkComputedPropertyName(name)
 * 	}
 * 	if c.hasBindableName(node) {
 * 		// TypeScript 1.0 spec (April 2014): 8.4.3
 * 		// Accessors for the same member name must specify the same accessibility.
 * 		symbol := c.getSymbolOfDeclaration(node)
 * 		getter := ast.GetDeclarationOfKind(symbol, ast.KindGetAccessor)
 * 		setter := ast.GetDeclarationOfKind(symbol, ast.KindSetAccessor)
 * 		if getter != nil && setter != nil && c.nodeLinks.Get(getter).flags&NodeCheckFlagsTypeChecked == 0 {
 * 			c.nodeLinks.Get(getter).flags |= NodeCheckFlagsTypeChecked
 * 			getterFlags := getter.ModifierFlags()
 * 			setterFlags := setter.ModifierFlags()
 * 			if (getterFlags & ast.ModifierFlagsAbstract) != (setterFlags & ast.ModifierFlagsAbstract) {
 * 				c.error(getter.Name(), diagnostics.Accessors_must_both_be_abstract_or_non_abstract)
 * 				c.error(setter.Name(), diagnostics.Accessors_must_both_be_abstract_or_non_abstract)
 * 			}
 * 			if ((getterFlags&ast.ModifierFlagsProtected != 0) && setterFlags&(ast.ModifierFlagsProtected|ast.ModifierFlagsPrivate) == 0) || ((getterFlags&ast.ModifierFlagsPrivate != 0) && setterFlags&ast.ModifierFlagsPrivate == 0) {
 * 				c.error(getter.Name(), diagnostics.A_get_accessor_must_be_at_least_as_accessible_as_the_setter)
 * 				c.error(setter.Name(), diagnostics.A_get_accessor_must_be_at_least_as_accessible_as_the_setter)
 * 			}
 * 		}
 * 	}
 * 	returnType := c.getTypeOfAccessors(c.getSymbolOfDeclaration(node))
 * 	if node.Kind == ast.KindGetAccessor {
 * 		c.checkAllCodePathsInNonVoidFunctionReturnOrThrow(node, returnType)
 * 	}
 * 	c.checkSourceElement(node.Body())
 * 	c.setNodeLinksForPrivateIdentifierScope(node)
 * }
 */
export declare function Checker_checkAccessorDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeReferenceOrImport","kind":"method","status":"implemented","sigHash":"04b368dc482ffe366538f2c25eef6b3d9e8871a15205960541f052fc94c89c38","bodyHash":"c8ef9a8ebce1492de9507cb93fd09697981c0215a4c611277a70ed7c1fd8fa57"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go type-reference checking, extension-enabled programs may ask the registered provider to validate target-only generic constraints and record runtime carrier facts carried by provider virtual modules; no-extension programs and unowned types remain on the exact TS-Go path."}
 *
 * Go source:
 * func (c *Checker) checkTypeReferenceOrImport(node *ast.Node) {
 * 	t := c.getTypeFromTypeNode(node)
 * 	if !c.isErrorType(t) {
 * 		if len(node.TypeArguments()) != 0 {
 * 			typeParameters := c.getTypeParametersForTypeReferenceOrImport(node)
 * 			if len(typeParameters) != 0 {
 * 				c.checkTypeArgumentConstraints(node, typeParameters)
 * 			}
 * 		}
 * 		symbol := c.getResolvedSymbolOrNil(node)
 * 		if symbol != nil {
 * 			if core.Some(symbol.Declarations, func(d *ast.Node) bool { return ast.IsTypeDeclaration(d) && c.IsDeprecatedDeclaration(d) }) {
 * 				c.addDeprecatedSuggestion(c.getDeprecatedSuggestionNode(node), symbol.Declarations, symbol.Name)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkTypeReferenceOrImport(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkObjectTypeForDuplicateDeclarations","kind":"method","status":"implemented","sigHash":"13c957fe37a0eebb4686f69353cd66d874aff817d6a8bd800f1622b3630d9090","bodyHash":"4b6a8820168c77b6504d1befa6c2fbbd86f6941ec030512ef0434018e7cae53a"}
 *
 * Go source:
 * func (c *Checker) checkObjectTypeForDuplicateDeclarations(node *ast.Node, checkPrivateNames bool) {
 * 	var instanceNames map[string]int
 * 	var staticNames map[string]int
 * 	var privateNames map[string]int
 * 	nodeInAmbientContext := node.Flags&ast.NodeFlagsAmbient != 0
 * 	checkPropertyOrAccessor := func(symbol *ast.Symbol, kind int, isStatic bool) {
 * 		if len(symbol.Declarations) > 1 {
 * 			var names map[string]int
 * 			if isStatic {
 * 				if staticNames == nil {
 * 					staticNames = make(map[string]int)
 * 				}
 * 				names = staticNames
 * 			} else {
 * 				if instanceNames == nil {
 * 					instanceNames = make(map[string]int)
 * 				}
 * 				names = instanceNames
 * 			}
 * 			state := names[symbol.Name]
 * 			switch {
 * 			case state == 0:
 * 				// On first occurrence just record the kind
 * 				names[symbol.Name] = kind
 * 			case state == 1 || state == 2 && kind != 2:
 * 				// Error on second property or combination of property and accessor
 * 				c.reportDuplicateMemberErrors(node, symbol.Name, true, isStatic, diagnostics.Duplicate_identifier_0)
 * 				// Record that errors have been reported
 * 				names[symbol.Name] = 3
 * 			}
 * 		}
 * 	}
 * 	for _, member := range node.Members() {
 * 		if ast.IsConstructorDeclaration(member) {
 * 			for _, param := range member.Parameters() {
 * 				if ast.IsParameterPropertyDeclaration(param, member) && !ast.IsBindingPattern(param.Name()) {
 * 					checkPropertyOrAccessor(c.getSymbolOfDeclaration(param), 1, false /*isStatic* /)
 * 				}
 * 			}
 * 		} else {
 * 			symbol := c.getSymbolOfDeclaration(member)
 * 			isStatic := ast.HasStaticModifier(member)
 * 			// In non-ambient contexts, check that static members are not named 'prototype'.
 * 			if !nodeInAmbientContext && isStatic && symbol != nil && symbol.Name == "prototype" {
 * 				c.error(member.Name(), diagnostics.Static_property_0_conflicts_with_built_in_property_Function_0_of_constructor_function_1, symbol.Name, c.symbolToString(c.getSymbolOfDeclaration(node)))
 * 			}
 * 			// Check that this object type declaration doesn't contain multiple declarations of the same property,
 * 			// or accessor and property declarations with the same name.
 * 			if ast.IsPropertyDeclaration(member) && !ast.HasAccessorModifier(member) || ast.IsPropertySignatureDeclaration(member) {
 * 				checkPropertyOrAccessor(symbol, 1, isStatic)
 * 			} else if ast.IsAccessor(member) || ast.IsPropertyDeclaration(member) && ast.HasAccessorModifier(member) {
 * 				checkPropertyOrAccessor(symbol, 2, isStatic)
 * 			}
 * 			// Check that each private identifier is used only for instance members or only for static members. It is an
 * 			// error for an instance and a static member to have the same private identifier.
 * 			if checkPrivateNames && member.Name() != nil && ast.IsPrivateIdentifier(member.Name()) {
 * 				if flags := privateNames[symbol.Name]; flags != 3 {
 * 					flags |= core.IfElse(ast.IsStatic(member), 2, 1)
 * 					if privateNames == nil {
 * 						privateNames = make(map[string]int)
 * 					}
 * 					privateNames[symbol.Name] = flags
 * 					if flags == 3 {
 * 						c.reportDuplicateMemberErrors(node, symbol.Name, false, false, diagnostics.Duplicate_identifier_0_Static_and_instance_elements_cannot_share_the_same_private_name)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkObjectTypeForDuplicateDeclarations(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkPrivateNames: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportType","kind":"method","status":"implemented","sigHash":"603b174d29d3d0f9cf724fc446cf0d42fb8543d33e3c4d40f09b84249833c38d","bodyHash":"196c4772db32b90b332c7bf2f614dc993cc8dcab7dbbbef590bce3b7e184bc2f"}
 *
 * Go source:
 * func (c *Checker) checkImportType(node *ast.Node) {
 * 	c.checkSourceElement(node.AsImportTypeNode().Argument)
 * 	if attributes := node.AsImportTypeNode().Attributes; attributes != nil {
 * 		c.getResolutionModeOverride(attributes.AsImportAttributes(), true /*reportErrors* /)
 * 	}
 * 	c.checkTypeReferenceOrImport(node)
 * }
 */
export declare function Checker_checkImportType(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNamedTupleMember","kind":"method","status":"implemented","sigHash":"039084a2eb6c9957fc7286d179ef5318af6f629837c9c44847baf1b82a02a892","bodyHash":"8f42ad3b02af17513b65935949a1f0a067d1f61f4b29794c9999241584feaf2b"}
 *
 * Go source:
 * func (c *Checker) checkNamedTupleMember(node *ast.Node) {
 * 	tupleMember := node.AsNamedTupleMember()
 * 	if tupleMember.DotDotDotToken != nil && tupleMember.QuestionToken != nil {
 * 		c.grammarErrorOnNode(node, diagnostics.A_tuple_member_cannot_be_both_optional_and_rest)
 * 	}
 * 	if tupleMember.Type.Kind == ast.KindOptionalType {
 * 		c.grammarErrorOnNode(tupleMember.Type, diagnostics.A_labeled_tuple_element_is_declared_as_optional_with_a_question_mark_after_the_name_and_before_the_colon_rather_than_after_the_type)
 * 	}
 * 	if tupleMember.Type.Kind == ast.KindRestType {
 * 		c.grammarErrorOnNode(tupleMember.Type, diagnostics.A_labeled_tuple_element_is_declared_as_rest_with_a_before_the_name_rather_than_before_the_type)
 * 	}
 * 	c.checkSourceElement(node.Type())
 * 	c.getTypeFromTypeNode(node)
 * }
 */
export declare function Checker_checkNamedTupleMember(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexedAccessType","kind":"method","status":"implemented","sigHash":"afa8652ae5cd4dd8d3bac3066bf4f1b0169864d3e8814ce2ee62bda1a3efa951","bodyHash":"912b2d9480d1dd6367b3d918f86b1778447b754712d296b5805c050f1e31b4a0"}
 *
 * Go source:
 * func (c *Checker) checkIndexedAccessType(node *ast.Node) {
 * 	node.ForEachChild(c.checkSourceElement)
 * 	c.checkIndexedAccessIndexType(c.getTypeFromIndexedAccessTypeNode(node), node)
 * }
 */
export declare function Checker_checkIndexedAccessType(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkFunctionDeclaration","kind":"method","status":"implemented","sigHash":"814fd7964148f9eb87a1d1ef5531f90fa51c2e9a6c4b32443480b2c2481b326c","bodyHash":"f5ed414499cb415ef0da02d13795e91c2f5d2a6d758de4484e1453772386399d"}
 *
 * Go source:
 * func (c *Checker) checkFunctionDeclaration(node *ast.Node) {
 * 	c.checkFunctionOrMethodDeclaration(node)
 * 	c.checkGrammarForGenerator(node)
 * 	c.checkCollisionsForDeclarationName(node, node.Name())
 * }
 */
export declare function Checker_checkFunctionDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkFunctionOrMethodDeclaration","kind":"method","status":"implemented","sigHash":"43dfb6b232dc1d5aee0369d01dce41c2d2ad4f53b4ffca9d4ee1332eb0f6c4e2","bodyHash":"ec8b3f4421e84fe8d5f910e693a8501651c049e92687f0b27d0760470296157e"}
 *
 * Go source:
 * func (c *Checker) checkFunctionOrMethodDeclaration(node *ast.Node) {
 * 	c.checkDecorators(node)
 * 	c.checkSignatureDeclaration(node)
 * 	functionFlags := ast.GetFunctionFlags(node)
 * 	// Do not use hasDynamicName here, because that returns false for well known symbols.
 * 	// We want to perform checkComputedPropertyName for all computed properties, including
 * 	// well known symbols.
 * 	if node.Name() != nil && ast.IsComputedPropertyName(node.Name()) {
 * 		// This check will account for methods in class/interface declarations,
 * 		// as well as accessors in classes/object literals
 * 		c.checkComputedPropertyName(node.Name())
 * 	}
 * 	if c.hasBindableName(node) {
 * 		// first we want to check the local symbol that contain this declaration
 * 		// - if node.localSymbol !== undefined - this is current declaration is exported and localSymbol points to the local symbol
 * 		// - if node.localSymbol === undefined - this node is non-exported so we can just pick the result of getSymbolOfNode
 * 		symbol := c.getSymbolOfDeclaration(node)
 * 		localSymbol := core.OrElse(node.LocalSymbol(), symbol)
 * 		// Since the javascript won't do semantic analysis like typescript, ignore javascript function
 * 		// declarations so that redeclaring a function in a JS file is not reported as a duplicate.
 * 		if node.Flags&ast.NodeFlagsJavaScriptFile == 0 {
 * 			c.checkFunctionOrConstructorSymbol(localSymbol)
 * 		}
 * 		if symbol.Parent != nil {
 * 			// run check on export symbol to check that modifiers agree across all exported declarations
 * 			c.checkFunctionOrConstructorSymbol(symbol)
 * 		}
 * 	}
 * 	body := node.Body()
 * 	c.checkSourceElement(body)
 * 	c.checkAllCodePathsInNonVoidFunctionReturnOrThrow(node, c.getReturnTypeFromAnnotation(node))
 * 	if node.FunctionLikeData().FullSignature != nil {
 * 		if c.getContextualCallSignature(c.getTypeFromTypeNode(node.FunctionLikeData().FullSignature), node) == nil {
 * 			c.error(node.FunctionLikeData().FullSignature, diagnostics.A_JSDoc_type_tag_on_a_function_must_have_a_signature_with_the_correct_number_of_arguments)
 * 		}
 * 	}
 * 	if node.Type() == nil {
 * 		// Report an implicit any error if there is no body, no explicit return type, and node is not a private method
 * 		// in an ambient context
 * 		if ast.NodeIsMissing(body) && !isPrivateWithinAmbient(node) {
 * 			c.reportImplicitAny(node, c.anyType, WideningKindNormal)
 * 		}
 * 		if functionFlags&ast.FunctionFlagsGenerator != 0 && ast.NodeIsPresent(body) {
 * 			// A generator with a body and no type annotation can still cause errors. It can error if the
 * 			// yielded values have no common supertype, or it can give an implicit any error if it has no
 * 			// yielded values. The only way to trigger these errors is to try checking its return type.
 * 			c.getReturnTypeOfSignature(c.getSignatureFromDeclaration(node))
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkFunctionOrMethodDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveDeclarationFlags","kind":"method","status":"implemented","sigHash":"cbba6d06e5eea6a049036d5a60384351355bd4bf854309370d1c254cb9a7d068","bodyHash":"e4f7deffa44a21902a4993d2c7f7df143bde5d818ed9f7f9a60c4c33b7b5f08a"}
 *
 * Go source:
 * func (c *Checker) getEffectiveDeclarationFlags(n *ast.Node, flagsToCheck ast.ModifierFlags) ast.ModifierFlags {
 * 	flags := c.getCombinedModifierFlagsCached(n)
 * 	// children of classes (even ambient classes) should not be marked as ambient or export
 * 	// because those flags have no useful semantics there.
 * 	if !ast.IsInterfaceDeclaration(n.Parent) && !ast.IsClassDeclaration(n.Parent) && !ast.IsClassExpression(n.Parent) && n.Flags&ast.NodeFlagsAmbient != 0 {
 * 		container := getEnclosingContainer(n)
 * 		if container != nil && container.Flags&ast.NodeFlagsExportContext != 0 && flags&ast.ModifierFlagsAmbient == 0 && !(ast.IsModuleBlock(n.Parent) && ast.IsGlobalScopeAugmentation(n.Parent.Parent)) {
 * 			// It is nested in an ambient export context, which means it is automatically exported
 * 			flags |= ast.ModifierFlagsExport
 * 		}
 * 		flags |= ast.ModifierFlagsAmbient
 * 	}
 * 	return flags & flagsToCheck
 * }
 */
export declare function Checker_getEffectiveDeclarationFlags(receiver: GoPtr<Checker>, n: GoPtr<Node>, flagsToCheck: ModifierFlags): ModifierFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolUsedInBinaryExpressionChain","kind":"method","status":"implemented","sigHash":"16817b66098c33e0f1f7bb9922eda8487c0cfcf121057fbfd78ca99015fdda40","bodyHash":"39b94a9be64cc109143ed3ec64dc9e6173456c45cbacc4355f92521fb06fbe65"}
 *
 * Go source:
 * func (c *Checker) isSymbolUsedInBinaryExpressionChain(node *ast.Node, testedSymbol *ast.Symbol) bool {
 * 	var visit func(*ast.Node) bool
 * 	visit = func(child *ast.Node) bool {
 * 		if ast.IsIdentifier(child) {
 * 			symbol := c.getSymbolAtLocation(child, false)
 * 			if symbol != nil && symbol == testedSymbol {
 * 				return true
 * 			}
 * 		}
 * 		return child.ForEachChild(visit)
 * 	}
 * 	for ast.IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindAmpersandAmpersandToken {
 * 		isUsed := node.AsBinaryExpression().Right.ForEachChild(visit)
 * 		if isUsed {
 * 			return true
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSymbolUsedInBinaryExpressionChain(receiver: GoPtr<Checker>, node: GoPtr<Node>, testedSymbol: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolUsedInConditionBody","kind":"method","status":"implemented","sigHash":"d1725ffb38493eb07e3300d63474ebf6533227f643e8662475eef5af1dcaaa6d","bodyHash":"7549e770487ea6e1121eda2f7294be73d516b6a6941fff29bbf1f6c593d388b8"}
 *
 * Go source:
 * func (c *Checker) isSymbolUsedInConditionBody(expr *ast.Node, body *ast.Node, testedNode *ast.Node, testedSymbol *ast.Symbol) bool {
 * 	var visit func(*ast.Node) bool
 * 	visit = func(childNode *ast.Node) bool {
 * 		if ast.IsIdentifier(childNode) {
 * 			childSymbol := c.getSymbolAtLocation(childNode, false)
 * 			if childSymbol != nil && childSymbol == testedSymbol {
 * 				// If the test was a simple identifier, the above check is sufficient
 * 				if ast.IsIdentifier(expr) || ast.IsIdentifier(testedNode) && ast.IsBinaryExpression(testedNode.Parent) {
 * 					return true
 * 				}
 * 				// Otherwise we need to ensure the symbol is called on the same target
 * 				testedExpression := testedNode.Parent
 * 				childExpression := childNode.Parent
 * 				for testedExpression != nil && childExpression != nil {
 * 					if ast.IsIdentifier(testedExpression) && ast.IsIdentifier(childExpression) || testedExpression.Kind == ast.KindThisKeyword && childExpression.Kind == ast.KindThisKeyword {
 * 						return c.getSymbolAtLocation(testedExpression, false) == c.getSymbolAtLocation(childExpression, false)
 * 					} else if ast.IsPropertyAccessExpression(testedExpression) && ast.IsPropertyAccessExpression(childExpression) {
 * 						if c.getSymbolAtLocation(testedExpression.Name(), false) != c.getSymbolAtLocation(childExpression.Name(), false) {
 * 							return false
 * 						}
 * 						childExpression = childExpression.Expression()
 * 						testedExpression = testedExpression.Expression()
 * 					} else if ast.IsCallExpression(testedExpression) && ast.IsCallExpression(childExpression) {
 * 						childExpression = childExpression.Expression()
 * 						testedExpression = testedExpression.Expression()
 * 					} else {
 * 						return false
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return childNode.ForEachChild(visit)
 * 	}
 * 	return body.ForEachChild(visit)
 * }
 */
export declare function Checker_isSymbolUsedInConditionBody(receiver: GoPtr<Checker>, expr: GoPtr<Node>, body: GoPtr<Node>, testedNode: GoPtr<Node>, testedSymbol: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeOrString","kind":"method","status":"implemented","sigHash":"2be4d1deba9d600866dce32edab88bfdeda6376ebbbadeca3e93cd5b51874071","bodyHash":"563c01d2907ea4395b36e718df00e137d62e9798abcb1189df1d778a7760dafe"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeOrString(t *Type) *Type {
 * 	indexType := c.getExtractStringType(c.getIndexType(t))
 * 	return core.IfElse(indexType.flags&TypeFlagsNever != 0, c.stringType, indexType)
 * }
 */
export declare function Checker_getIndexTypeOrString(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassDeclaration","kind":"method","status":"implemented","sigHash":"26f7c9a294e0038021935c5daa1d6f8b23ad53247fce6b4006094e2213ffaef8","bodyHash":"54aea3d0b96fb8ce80261b445c763c8c4ded36cfc6003716ed345e7714bc3ffb"}
 *
 * Go source:
 * func (c *Checker) checkClassDeclaration(node *ast.Node) {
 * 	firstDecorator := core.Find(node.ModifierNodes(), ast.IsDecorator)
 * 	if c.legacyDecorators && firstDecorator != nil && core.Some(node.Members(), func(p *ast.Node) bool {
 * 		return ast.HasStaticModifier(p) && ast.IsPrivateIdentifierClassElementDeclaration(p)
 * 	}) {
 * 		c.grammarErrorOnNode(firstDecorator, diagnostics.Class_decorators_can_t_be_used_with_static_private_identifier_Consider_removing_the_experimental_decorator)
 * 	}
 * 	if node.Name() == nil && !ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault) {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.A_class_declaration_without_the_default_modifier_must_have_a_name)
 * 	}
 * 	c.checkClassLikeDeclaration(node)
 * 	c.checkSourceElements(node.Members())
 * 	c.registerForUnusedIdentifiersCheck(node)
 * }
 */
export declare function Checker_checkClassDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassLikeDeclaration","kind":"method","status":"implemented","sigHash":"9b2cca9afe363c01bf5d1db98001b4c42a196af14bb5929d68bcadce57638ab9","bodyHash":"8d21b4b00a28102146f169683a73dc7f9331b68f2839d1df367e6902c017ecb2"}
 *
 * Go source:
 * func (c *Checker) checkClassLikeDeclaration(node *ast.Node) {
 * 	c.checkGrammarClassLikeDeclaration(node)
 * 	c.checkDecorators(node)
 * 	c.checkCollisionsForDeclarationName(node, node.Name())
 * 	c.checkTypeParameters(node.TypeParameters())
 * 	c.checkExportsOnMergedDeclarations(node)
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	classType := c.getDeclaredTypeOfSymbol(symbol)
 * 	classTypeData := classType.AsInterfaceType()
 * 	typeWithThis := c.getTypeWithThisArgument(classType, nil, false)
 * 	staticType := c.getTypeOfSymbol(symbol)
 * 	c.checkTypeParameterListsIdentical(symbol)
 * 	c.checkFunctionOrConstructorSymbol(symbol)
 * 	c.checkObjectTypeForDuplicateDeclarations(node, true /*checkPrivateNames* /)
 *
 * 	// Only check for reserved static identifiers on non-ambient context.
 * 	nodeInAmbientContext := node.Flags&ast.NodeFlagsAmbient != 0
 * 	if !nodeInAmbientContext {
 * 		c.checkClassForStaticPropertyNameConflicts(node)
 * 	}
 *
 * 	baseTypeNode := ast.GetExtendsHeritageClauseElement(node)
 * 	if baseTypeNode != nil {
 * 		c.checkSourceElements(baseTypeNode.TypeArguments())
 * 		baseTypes := c.getBaseTypes(classType)
 * 		if len(baseTypes) != 0 {
 * 			baseType := baseTypes[0]
 * 			baseConstructorType := c.getBaseConstructorTypeOfClass(classType)
 * 			staticBaseType := c.getApparentType(baseConstructorType)
 * 			c.checkBaseTypeAccessibility(staticBaseType, baseTypeNode)
 * 			c.checkSourceElement(baseTypeNode.Expression())
 * 			if len(baseTypeNode.TypeArguments()) != 0 {
 * 				c.checkSourceElements(baseTypeNode.TypeArguments())
 * 				for _, constructor := range c.getConstructorsForTypeArguments(staticBaseType, baseTypeNode.TypeArguments(), baseTypeNode) {
 * 					if !c.checkTypeArgumentConstraints(baseTypeNode, constructor.typeParameters) {
 * 						break
 * 					}
 * 				}
 * 			}
 * 			baseWithThis := c.getTypeWithThisArgument(baseType, classTypeData.thisType, false)
 * 			if !c.checkTypeAssignableTo(typeWithThis, baseWithThis, nil, nil) {
 * 				c.issueMemberSpecificError(node, typeWithThis, baseWithThis, diagnostics.Class_0_incorrectly_extends_base_class_1)
 * 			} else {
 * 				// Report static side error only when instance type is assignable
 * 				c.checkTypeAssignableTo(staticType, c.getTypeWithoutSignatures(staticBaseType), core.OrElse(node.Name(), node), diagnostics.Class_static_side_0_incorrectly_extends_base_class_static_side_1)
 * 			}
 * 			if baseConstructorType.flags&TypeFlagsTypeVariable != 0 {
 * 				if !c.isMixinConstructorType(staticType) {
 * 					c.error(core.OrElse(node.Name(), node), diagnostics.A_mixin_class_must_have_a_constructor_with_a_single_rest_parameter_of_type_any)
 * 				} else {
 * 					constructSignatures := c.getSignaturesOfType(baseConstructorType, SignatureKindConstruct)
 * 					if core.Some(constructSignatures, func(signature *Signature) bool {
 * 						return signature.flags&SignatureFlagsAbstract != 0
 * 					}) && !ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 						c.error(core.OrElse(node.Name(), node), diagnostics.A_mixin_class_that_extends_from_a_type_variable_containing_an_abstract_construct_signature_must_also_be_declared_abstract)
 * 					}
 * 				}
 * 			}
 * 			if !(staticBaseType.symbol != nil && staticBaseType.symbol.Flags&ast.SymbolFlagsClass != 0) && baseConstructorType.flags&TypeFlagsTypeVariable == 0 {
 * 				// When the static base type is a "class-like" constructor function (but not actually a class), we verify
 * 				// that all instantiated base constructor signatures return the same type.
 * 				constructors := c.getInstantiatedConstructorsForTypeArguments(staticBaseType, baseTypeNode.TypeArguments(), baseTypeNode)
 * 				if !core.Every(constructors, func(sig *Signature) bool {
 * 					return c.isTypeIdenticalTo(c.getReturnTypeOfSignature(sig), baseType)
 * 				}) {
 * 					c.error(baseTypeNode.Expression(), diagnostics.Base_constructors_must_all_have_the_same_return_type)
 * 				}
 * 			}
 * 			c.checkKindsOfPropertyMemberOverrides(classType, baseType)
 * 		}
 * 	}
 * 	c.checkMembersForOverrideModifier(node, classType, typeWithThis, staticType)
 * 	implementedTypeNodes := ast.GetImplementsHeritageClauseElements(node)
 * 	for _, typeRefNode := range implementedTypeNodes {
 * 		expr := typeRefNode.Expression()
 * 		if !ast.IsEntityNameExpression(expr) || ast.IsOptionalChain(expr) {
 * 			c.error(expr, diagnostics.A_class_can_only_implement_an_identifier_Slashqualified_name_with_optional_type_arguments)
 * 		}
 * 		c.checkTypeReferenceNode(typeRefNode)
 * 		t := c.getReducedType(c.getTypeFromTypeNode(typeRefNode))
 * 		if !c.isErrorType(t) {
 * 			if c.isValidBaseType(t) {
 * 				genericDiag := core.IfElse(t.symbol != nil && t.symbol.Flags&ast.SymbolFlagsClass != 0,
 * 					diagnostics.Class_0_incorrectly_implements_class_1_Did_you_mean_to_extend_1_and_inherit_its_members_as_a_subclass,
 * 					diagnostics.Class_0_incorrectly_implements_interface_1)
 * 				baseWithThis := c.getTypeWithThisArgument(t, classType.AsInterfaceType().thisType, false)
 * 				if !c.checkTypeAssignableTo(typeWithThis, baseWithThis, nil, nil) {
 * 					c.issueMemberSpecificError(node, typeWithThis, baseWithThis, genericDiag)
 * 				}
 * 			} else {
 * 				c.error(typeRefNode, diagnostics.A_class_can_only_implement_an_object_type_or_intersection_of_object_types_with_statically_known_members)
 * 			}
 * 		}
 * 	}
 * 	c.checkIndexConstraints(classType, symbol, false /*isStaticIndex* /)
 * 	c.checkIndexConstraints(staticType, symbol, true /*isStaticIndex* /)
 * 	c.checkClassOrInterfaceForDuplicateIndexSignatures(node)
 * 	c.checkPropertyInitialization(node)
 * }
 */
export declare function Checker_checkClassLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getClassOrInterfaceDeclarationsOfSymbol","kind":"method","status":"implemented","sigHash":"578d35fa361681eaa45ba1e94f65c9d297b1a9b3a346d3e2aff32d62b918e7e3","bodyHash":"34e2fd5b7591e7cd37d3636dbe201d8be52daa8859ba80475d355e5fc93cf32e"}
 *
 * Go source:
 * func (c *Checker) getClassOrInterfaceDeclarationsOfSymbol(symbol *ast.Symbol) []*ast.Node {
 * 	return core.Filter(symbol.Declarations, func(d *ast.Node) bool {
 * 		return ast.IsClassDeclaration(d) || ast.IsInterfaceDeclaration(d)
 * 	})
 * }
 */
export declare function Checker_getClassOrInterfaceDeclarationsOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkKindsOfPropertyMemberOverrides","kind":"method","status":"implemented","sigHash":"c2abe65686efdd7f87217d5211c8a19d1523d43c7bbf88b26c30d443728f76db","bodyHash":"c61205436647104c367d8c952836959ab77b50a30c72c81b24b19cbd4a88ac8b"}
 *
 * Go source:
 * func (c *Checker) checkKindsOfPropertyMemberOverrides(t *Type, baseType *Type) {
 * 	// TypeScript 1.0 spec (April 2014): 8.2.3
 * 	// A derived class inherits all members from its base class it doesn't override.
 * 	// Inheritance means that a derived class implicitly contains all non - overridden members of the base class.
 * 	// Both public and private property members are inherited, but only public property members can be overridden.
 * 	// A property member in a derived class is said to override a property member in a base class
 * 	// when the derived class property member has the same name and kind(instance or static)
 * 	// as the base class property member.
 * 	// The type of an overriding property member must be assignable(section 3.8.4)
 * 	// to the type of the overridden property member, or otherwise a compile - time error occurs.
 * 	// Base class instance member functions can be overridden by derived class instance member functions,
 * 	// but not by other kinds of members.
 * 	// Base class instance member variables and accessors can be overridden by
 * 	// derived class instance member variables and accessors, but not by other kinds of members.
 * 	// NOTE: assignability is checked in checkClassDeclaration
 * 	type MemberInfo struct {
 * 		missedProperties []string
 * 		baseTypeName     string
 * 		typeName         string
 * 	}
 * 	var notImplementedInfo map[*ast.Node]MemberInfo
 * basePropertyCheck:
 * 	for _, baseProperty := range c.getPropertiesOfType(baseType) {
 * 		base := c.getTargetSymbol(baseProperty)
 * 		if base.Flags&ast.SymbolFlagsPrototype != 0 {
 * 			continue
 * 		}
 * 		baseSymbol := c.getPropertyOfObjectType(t, base.Name)
 * 		if baseSymbol == nil {
 * 			continue
 * 		}
 * 		derived := c.getTargetSymbol(baseSymbol)
 * 		baseDeclarationFlags := getDeclarationModifierFlagsFromSymbol(base)
 * 		// In order to resolve whether the inherited method was overridden in the base class or not,
 * 		// we compare the Symbols obtained. Since getTargetSymbol returns the symbol on the *uninstantiated*
 * 		// type declaration, derived and base resolve to the same symbol even in the case of generic classes.
 * 		if derived == base {
 * 			// derived class inherits base without override/redeclaration.
 * 			if baseDeclarationFlags&ast.ModifierFlagsAbstract != 0 {
 * 				// It is an error to inherit an abstract member without implementing it or being declared abstract.
 * 				// If there is no declaration for the derived class (as in the case of class expressions),
 * 				// then the class cannot be declared abstract.
 * 				derivedClassDecl := ast.GetClassLikeDeclarationOfSymbol(t.symbol)
 * 				if derivedClassDecl == nil || !ast.HasSyntacticModifier(derivedClassDecl, ast.ModifierFlagsAbstract) {
 * 					// Searches other base types for a declaration that would satisfy the inherited abstract member.
 * 					// (The class may have more than one base type via declaration merging with an interface with the
 * 					// same name.)
 * 					for _, otherBaseType := range c.getBaseTypes(t) {
 * 						if otherBaseType == baseType {
 * 							continue
 * 						}
 * 						if baseSymbol := c.getPropertyOfObjectType(otherBaseType, base.Name); baseSymbol != nil && base != c.getTargetSymbol(baseSymbol) {
 * 							// Derived property exists elsewhere.
 * 							continue basePropertyCheck
 * 						}
 * 					}
 * 					baseTypeName := c.TypeToString(baseType)
 * 					typeName := c.TypeToString(t)
 * 					missedProperties := append(notImplementedInfo[derivedClassDecl].missedProperties, c.symbolToString(baseProperty))
 * 					if notImplementedInfo == nil {
 * 						notImplementedInfo = make(map[*ast.Node]MemberInfo)
 * 					}
 * 					notImplementedInfo[derivedClassDecl] = MemberInfo{
 * 						baseTypeName:     baseTypeName,
 * 						typeName:         typeName,
 * 						missedProperties: missedProperties,
 * 					}
 * 				}
 * 			}
 * 		} else {
 * 			// derived overrides base.
 * 			derivedDeclarationFlags := getDeclarationModifierFlagsFromSymbol(derived)
 * 			if baseDeclarationFlags&ast.ModifierFlagsPrivate != 0 || derivedDeclarationFlags&ast.ModifierFlagsPrivate != 0 {
 * 				// either base or derived property is private - not override, skip it
 * 				continue
 * 			}
 * 			var errorMessage *diagnostics.Message
 * 			basePropertyFlags := base.Flags & ast.SymbolFlagsPropertyOrAccessor
 * 			derivedPropertyFlags := derived.Flags & ast.SymbolFlagsPropertyOrAccessor
 * 			if basePropertyFlags != 0 && derivedPropertyFlags != 0 {
 * 				// property/accessor is overridden with property/accessor
 * 				if base.CheckFlags&ast.CheckFlagsMapped != 0 ||
 * 					derived.ValueDeclaration != nil && ast.IsBinaryExpression(derived.ValueDeclaration) ||
 * 					c.arePropertiesAbstractOrInterface(base, baseDeclarationFlags) {
 * 					// when the base property is abstract or from an interface, base/derived flags don't need to match
 * 					// for intersection properties, this must be true of *any* of the declarations, for others it must be true of *all*
 * 					// same when the derived property is from an assignment
 * 					continue
 * 				}
 * 				overriddenInstanceProperty := basePropertyFlags != ast.SymbolFlagsProperty && derivedPropertyFlags == ast.SymbolFlagsProperty
 * 				overriddenInstanceAccessor := basePropertyFlags == ast.SymbolFlagsProperty && derivedPropertyFlags != ast.SymbolFlagsProperty
 * 				if overriddenInstanceProperty || overriddenInstanceAccessor {
 * 					errorMessage := core.IfElse(overriddenInstanceProperty,
 * 						diagnostics.X_0_is_defined_as_an_accessor_in_class_1_but_is_overridden_here_in_2_as_an_instance_property,
 * 						diagnostics.X_0_is_defined_as_a_property_in_class_1_but_is_overridden_here_in_2_as_an_accessor)
 * 					c.error(core.OrElse(ast.GetNameOfDeclaration(derived.ValueDeclaration), derived.ValueDeclaration), errorMessage, c.symbolToString(base), c.TypeToString(baseType), c.TypeToString(t))
 * 				} else if c.compilerOptions.GetUseDefineForClassFields() {
 * 					uninitialized := core.Find(derived.Declarations, func(d *ast.Node) bool {
 * 						return ast.IsPropertyDeclaration(d) && d.Initializer() == nil
 * 					})
 * 					if uninitialized != nil && derived.Flags&ast.SymbolFlagsTransient == 0 && baseDeclarationFlags&ast.ModifierFlagsAbstract == 0 && derivedDeclarationFlags&ast.ModifierFlagsAbstract == 0 && !core.Some(derived.Declarations, func(d *ast.Node) bool {
 * 						return d.Flags&ast.NodeFlagsAmbient != 0
 * 					}) {
 * 						constructor := ast.FindConstructorDeclaration(ast.GetClassLikeDeclarationOfSymbol(t.symbol))
 * 						propName := uninitialized.Name()
 * 						if isExclamationToken(uninitialized.PostfixToken()) || constructor == nil || !ast.IsIdentifier(propName) || !c.strictNullChecks || !c.isPropertyInitializedInConstructor(propName, t, constructor) {
 * 							errorMessage := diagnostics.Property_0_will_overwrite_the_base_property_in_1_If_this_is_intentional_add_an_initializer_Otherwise_add_a_declare_modifier_or_remove_the_redundant_declaration
 * 							c.error(core.OrElse(ast.GetNameOfDeclaration(derived.ValueDeclaration), derived.ValueDeclaration), errorMessage, c.symbolToString(base), c.TypeToString(baseType))
 * 						}
 * 					}
 * 				}
 * 				// correct case
 * 				continue
 * 			} else if isPrototypeProperty(base) {
 * 				if isPrototypeProperty(derived) || derived.Flags&ast.SymbolFlagsProperty != 0 {
 * 					// method is overridden with method or property -- correct case
 * 					continue
 * 				} else {
 * 					errorMessage = diagnostics.Class_0_defines_instance_member_function_1_but_extended_class_2_defines_it_as_instance_member_accessor
 * 				}
 * 			} else if base.Flags&ast.SymbolFlagsAccessor != 0 {
 * 				errorMessage = diagnostics.Class_0_defines_instance_member_accessor_1_but_extended_class_2_defines_it_as_instance_member_function
 * 			} else {
 * 				errorMessage = diagnostics.Class_0_defines_instance_member_property_1_but_extended_class_2_defines_it_as_instance_member_function
 * 			}
 * 			c.error(core.OrElse(ast.GetNameOfDeclaration(derived.ValueDeclaration), derived.ValueDeclaration), errorMessage, c.TypeToString(baseType), c.symbolToString(base), c.TypeToString(t))
 * 		}
 * 	}
 * 	for errorNode, memberInfo := range notImplementedInfo {
 * 		switch {
 * 		case len(memberInfo.missedProperties) == 1:
 * 			missedProperty := memberInfo.missedProperties[0]
 * 			if ast.IsClassExpression(errorNode) {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_expression_does_not_implement_inherited_abstract_member_0_from_class_1, missedProperty, memberInfo.baseTypeName)
 * 			} else {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_0_does_not_implement_inherited_abstract_member_1_from_class_2, memberInfo.typeName, missedProperty, memberInfo.baseTypeName)
 * 			}
 * 		case len(memberInfo.missedProperties) > 5:
 * 			missedProperties := strings.Join(core.Map(memberInfo.missedProperties[:4], func(prop string) string { return "'" + prop + "'" }), ", ")
 * 			remainingMissedProperties := len(memberInfo.missedProperties) - 4
 * 			if ast.IsClassExpression(errorNode) {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_expression_is_missing_implementations_for_the_following_members_of_0_Colon_1_and_2_more, memberInfo.baseTypeName, missedProperties, remainingMissedProperties)
 * 			} else {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_0_is_missing_implementations_for_the_following_members_of_1_Colon_2_and_3_more, memberInfo.typeName, memberInfo.baseTypeName, missedProperties, remainingMissedProperties)
 * 			}
 * 		default:
 * 			missedProperties := strings.Join(core.Map(memberInfo.missedProperties, func(prop string) string { return "'" + prop + "'" }), ", ")
 * 			if ast.IsClassExpression(errorNode) {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_expression_is_missing_implementations_for_the_following_members_of_0_Colon_1, memberInfo.baseTypeName, missedProperties)
 * 			} else {
 * 				c.error(errorNode, diagnostics.Non_abstract_class_0_is_missing_implementations_for_the_following_members_of_1_Colon_2, memberInfo.typeName, memberInfo.baseTypeName, missedProperties)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkKindsOfPropertyMemberOverrides(receiver: GoPtr<Checker>, t: GoPtr<Type>, baseType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyAbstractOrInterface","kind":"method","status":"implemented","sigHash":"e938029d009ec8370c7bfac6288c0739ebeefbb2abd034ae8de70d30d1433bc6","bodyHash":"43282ccba31ae6de0bfa1127e9476c1c5680ac882e6d657e71fb0ec3775a08fa"}
 *
 * Go source:
 * func (c *Checker) isPropertyAbstractOrInterface(declaration *ast.Node, baseDeclarationFlags ast.ModifierFlags) bool {
 * 	return ast.IsInterfaceDeclaration(declaration.Parent) ||
 * 		baseDeclarationFlags&ast.ModifierFlagsAbstract != 0 && (!ast.IsPropertyDeclaration(declaration) || declaration.Initializer() == nil)
 * }
 */
export declare function Checker_isPropertyAbstractOrInterface(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, baseDeclarationFlags: ModifierFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMembersForOverrideModifier","kind":"method","status":"implemented","sigHash":"ba38f096ac20ddb9696f36f80bf6e2982c87e5695d51bd746f9246bbae828d81","bodyHash":"c6e30856bbc96342743564895a9d7e03eb6b5077ac42d2a40af46be4daea0ed4"}
 *
 * Go source:
 * func (c *Checker) checkMembersForOverrideModifier(node *ast.Node, t *Type, typeWithThis *Type, staticType *Type) {
 * 	var baseWithThis *Type
 * 	baseTypeNode := ast.GetExtendsHeritageClauseElement(node)
 * 	if baseTypeNode != nil {
 * 		baseTypes := c.getBaseTypes(t)
 * 		if len(baseTypes) > 0 {
 * 			baseWithThis = c.getTypeWithThisArgument(core.FirstOrNil(baseTypes), t.AsInterfaceType().thisType, false)
 * 		}
 * 	}
 * 	baseStaticType := c.getBaseConstructorTypeOfClass(t)
 * 	for _, member := range node.Members() {
 * 		if !ast.HasAmbientModifier(member) {
 * 			if ast.IsConstructorDeclaration(member) {
 * 				for _, param := range member.Parameters() {
 * 					if ast.IsParameterPropertyDeclaration(param, member) {
 * 						c.checkMemberForOverrideModifier(node, staticType, baseStaticType, baseWithThis, t, typeWithThis, param)
 * 					}
 * 				}
 * 			} else {
 * 				c.checkMemberForOverrideModifier(node, staticType, baseStaticType, baseWithThis, t, typeWithThis, member)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkMembersForOverrideModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, t: GoPtr<Type>, typeWithThis: GoPtr<Type>, staticType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMemberForOverrideModifier","kind":"method","status":"implemented","sigHash":"7dd9f8276d7cf002ce7274070ea15cd084c7dad8685de33f48bcb08d37efad61","bodyHash":"7fa7269781684b0c0fc9327f9faf1afce33925025fde282b4084f243ab997e5a"}
 *
 * Go source:
 * func (c *Checker) checkMemberForOverrideModifier(node *ast.Node, staticType *Type, baseStaticType *Type, baseWithThis *Type, t *Type, typeWithThis *Type, member *ast.Node) {
 * 	isJs := ast.IsInJSFile(node)
 * 	memberHasOverrideModifier := hasOverrideModifier(member)
 * 	if baseWithThis == nil {
 * 		if memberHasOverrideModifier {
 * 			c.error(member, core.IfElse(isJs, diagnostics.This_member_cannot_have_a_JSDoc_comment_with_an_override_tag_because_its_containing_class_0_does_not_extend_another_class, diagnostics.This_member_cannot_have_an_override_modifier_because_its_containing_class_0_does_not_extend_another_class), c.TypeToString(t))
 * 		}
 * 		return
 * 	}
 * 	if sym := member.Symbol(); memberHasOverrideModifier && sym != nil && sym.ValueDeclaration != nil && ast.IsClassElement(member) && member.Name() != nil && c.isNonBindableDynamicName(member.Name()) {
 * 		c.error(member, core.IfElse(isJs, diagnostics.This_member_cannot_have_a_JSDoc_comment_with_an_override_tag_because_its_name_is_dynamic, diagnostics.This_member_cannot_have_an_override_modifier_because_its_name_is_dynamic))
 * 		return
 * 	}
 * 	if !memberHasOverrideModifier && !c.compilerOptions.NoImplicitOverride.IsTrue() {
 * 		return
 * 	}
 * 	// Here we have a base class and also an override modifier or no override modifier in noImplicitOverride mode
 * 	symbol := c.getSymbolOfDeclaration(member)
 * 	if symbol == nil {
 * 		return
 * 	}
 * 	memberIsStatic := ast.IsStatic(member)
 * 	thisType := core.IfElse(memberIsStatic, staticType, typeWithThis)
 * 	prop := c.getPropertyOfType(thisType, symbol.Name)
 * 	if prop == nil {
 * 		return
 * 	}
 * 	baseType := core.IfElse(memberIsStatic, baseStaticType, baseWithThis)
 * 	baseProp := c.getPropertyOfType(baseType, symbol.Name)
 * 	if baseProp == nil && memberHasOverrideModifier {
 * 		suggestion := c.getSuggestedSymbolForNonexistentClassMember(ast.SymbolName(symbol), baseType)
 * 		if suggestion != nil {
 * 			c.error(member, core.IfElse(isJs, diagnostics.This_member_cannot_have_a_JSDoc_comment_with_an_override_tag_because_it_is_not_declared_in_the_base_class_0_Did_you_mean_1, diagnostics.This_member_cannot_have_an_override_modifier_because_it_is_not_declared_in_the_base_class_0_Did_you_mean_1), c.TypeToString(baseWithThis), c.symbolToString(suggestion))
 * 			return
 * 		}
 * 		c.error(member, core.IfElse(isJs, diagnostics.This_member_cannot_have_a_JSDoc_comment_with_an_override_tag_because_it_is_not_declared_in_the_base_class_0, diagnostics.This_member_cannot_have_an_override_modifier_because_it_is_not_declared_in_the_base_class_0), c.TypeToString(baseWithThis))
 * 		return
 * 	}
 * 	if baseProp != nil && len(baseProp.Declarations) != 0 && !memberHasOverrideModifier && c.compilerOptions.NoImplicitOverride.IsTrue() && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		baseHasAbstract := core.Some(baseProp.Declarations, ast.HasAbstractModifier)
 * 		if !baseHasAbstract {
 * 			message := core.IfElse(ast.IsParameterDeclaration(member),
 * 				core.IfElse(isJs, diagnostics.This_parameter_property_must_have_a_JSDoc_comment_with_an_override_tag_because_it_overrides_a_member_in_the_base_class_0, diagnostics.This_parameter_property_must_have_an_override_modifier_because_it_overrides_a_member_in_base_class_0),
 * 				core.IfElse(isJs, diagnostics.This_member_must_have_a_JSDoc_comment_with_an_override_tag_because_it_overrides_a_member_in_the_base_class_0, diagnostics.This_member_must_have_an_override_modifier_because_it_overrides_a_member_in_the_base_class_0))
 * 			c.error(member, message, c.TypeToString(baseWithThis))
 * 			return
 * 		}
 * 		if ast.HasAbstractModifier(member) && baseHasAbstract {
 * 			c.error(member, diagnostics.This_member_must_have_an_override_modifier_because_it_overrides_an_abstract_method_that_is_declared_in_the_base_class_0, c.TypeToString(baseWithThis))
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkMemberForOverrideModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, staticType: GoPtr<Type>, baseStaticType: GoPtr<Type>, baseWithThis: GoPtr<Type>, t: GoPtr<Type>, typeWithThis: GoPtr<Type>, member: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedSymbolForNonexistentClassMember","kind":"method","status":"implemented","sigHash":"f4b5001f94259023f28142e4107ee9adc897520ed59645e1e92c89b7d07f6962","bodyHash":"616f33e3a38f5fb550886c006e5c97ecd8970520513987d192edbb67c199fde0"}
 *
 * Go source:
 * func (c *Checker) getSuggestedSymbolForNonexistentClassMember(name string, baseType *Type) *ast.Symbol {
 * 	return c.getSpellingSuggestionForName(name, slices.Values(c.getPropertiesOfType(baseType)), ast.SymbolFlagsClassMember)
 * }
 */
export declare function Checker_getSuggestedSymbolForNonexistentClassMember(receiver: GoPtr<Checker>, name: string, baseType: GoPtr<Type>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyInitialization","kind":"method","status":"implemented","sigHash":"f851821ebd529460d0d8112962045b4aa24358301be26aaafb604b619de0eb49","bodyHash":"1dfcb622874daf55cfc87d521304f264a52d53db2a3c54fb296ee3114dc52f6c"}
 *
 * Go source:
 * func (c *Checker) checkPropertyInitialization(node *ast.Node) {
 * 	if !c.strictNullChecks || !c.strictPropertyInitialization || node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		return
 * 	}
 * 	constructor := ast.FindConstructorDeclaration(node)
 * 	for _, member := range node.Members() {
 * 		if member.ModifierFlags()&ast.ModifierFlagsAmbient != 0 {
 * 			continue
 * 		}
 * 		if !ast.IsStatic(member) && c.isPropertyWithoutInitializer(member) {
 * 			propName := member.Name()
 * 			if ast.IsIdentifier(propName) || ast.IsPrivateIdentifier(propName) || ast.IsComputedPropertyName(propName) {
 * 				t := c.getTypeOfSymbol(c.getSymbolOfDeclaration(member))
 * 				if !(t.flags&TypeFlagsAnyOrUnknown != 0 || c.containsUndefinedType(t)) {
 * 					if constructor == nil || !c.isPropertyInitializedInConstructor(propName, t, constructor) {
 * 						c.error(member.Name(), diagnostics.Property_0_has_no_initializer_and_is_not_definitely_assigned_in_the_constructor, scanner.DeclarationNameToString(propName))
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkPropertyInitialization(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyWithoutInitializer","kind":"method","status":"implemented","sigHash":"b08432c591b3bdbc19cefed8b718cd94af6754a7c63748811029f1c0f7df3b8a","bodyHash":"94f190e95186d980b3548f8903e090b1967a3da2352d5ee6746ba3427ca15dc6"}
 *
 * Go source:
 * func (c *Checker) isPropertyWithoutInitializer(node *ast.Node) bool {
 * 	return ast.IsPropertyDeclaration(node) && !ast.HasAbstractModifier(node) && !isExclamationToken(node.PostfixToken()) && node.Initializer() == nil
 * }
 */
export declare function Checker_isPropertyWithoutInitializer(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyInitializedInStaticBlocks","kind":"method","status":"implemented","sigHash":"197d041597202acdb1b7b2be704d2c2f0e283e8a390a9d3d5bb530d640fb60b8","bodyHash":"1830f8e9d926c377c0891c78cf4335656cdb37980748b8f21e5b9f62085946aa"}
 *
 * Go source:
 * func (c *Checker) isPropertyInitializedInStaticBlocks(propName *ast.Node, propType *Type, staticBlocks []*ast.Node, startPos int, endPos int) bool {
 * 	for _, staticBlock := range staticBlocks {
 * 		// static block must be within the provided range as they are evaluated in document order (unlike constructors)
 * 		if staticBlock.Pos() >= startPos && staticBlock.Pos() <= endPos {
 * 			reference := c.factory.NewPropertyAccessExpression(c.factory.NewKeywordExpression(ast.KindThisKeyword), nil, propName, ast.NodeFlagsNone)
 * 			reference.Expression().Parent = reference
 * 			reference.Parent = staticBlock
 * 			reference.FlowNodeData().FlowNode = staticBlock.AsClassStaticBlockDeclaration().ReturnFlowNode
 * 			flowType := c.getFlowTypeOfReferenceEx(reference, propType, c.getOptionalType(propType, false), nil, nil)
 * 			if !c.containsUndefinedType(flowType) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isPropertyInitializedInStaticBlocks(receiver: GoPtr<Checker>, propName: GoPtr<Node>, propType: GoPtr<Type>, staticBlocks: GoSlice<GoPtr<Node>>, startPos: int, endPos: int): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"433162408eabe73ece28785851236ee064f8a0dc25334c4e0e5f4b22adf7417e","bodyHash":"0ed8e3d1a4f127718bd013347a4d706391a91b7ed3e15e1020ea8e7d465f3ea2"}
 *
 * Go source:
 * func (c *Checker) checkInterfaceDeclaration(node *ast.Node) {
 * 	if !c.checkGrammarModifiers(node) {
 * 		c.checkGrammarInterfaceDeclaration(node.AsInterfaceDeclaration())
 * 	}
 * 	if !c.containerAllowsBlockScopedVariable(node.Parent) {
 * 		c.grammarErrorOnNode(node, diagnostics.X_0_declarations_can_only_be_declared_inside_a_block, "interface")
 * 	}
 * 	c.checkTypeParameters(node.TypeParameters())
 * 	c.checkTypeNameIsReserved(node.Name(), diagnostics.Interface_name_cannot_be_0)
 * 	c.checkExportsOnMergedDeclarations(node)
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	c.checkTypeParameterListsIdentical(symbol)
 * 	// Only check this symbol once
 * 	if links := c.declaredTypeLinks.Get(symbol); !links.interfaceChecked {
 * 		links.interfaceChecked = true
 * 		t := c.getDeclaredTypeOfSymbol(symbol)
 * 		typeWithThis := c.getTypeWithThisArgument(t, nil, false)
 * 		// run subsequent checks only if first set succeeded
 * 		if c.checkInheritedPropertiesAreIdentical(t, node.Name()) {
 * 			for _, baseType := range c.getBaseTypes(t) {
 * 				c.checkTypeAssignableTo(typeWithThis, c.getTypeWithThisArgument(baseType, t.AsInterfaceType().thisType, false), node.Name(), diagnostics.Interface_0_incorrectly_extends_interface_1)
 * 			}
 * 			c.checkIndexConstraints(t, symbol /*isStaticIndex* /, false)
 * 		}
 * 	}
 * 	c.checkObjectTypeForDuplicateDeclarations(node, false /*checkPrivateNames* /)
 * 	for _, heritageElement := range ast.GetExtendsHeritageClauseElements(node) {
 * 		expr := heritageElement.Expression()
 * 		if !ast.IsEntityNameExpression(expr) || ast.IsOptionalChain(expr) {
 * 			c.error(expr, diagnostics.An_interface_can_only_extend_an_identifier_Slashqualified_name_with_optional_type_arguments)
 * 		}
 * 		c.checkTypeReferenceNode(heritageElement)
 * 	}
 * 	c.checkSourceElements(node.Members())
 * 	c.checkClassOrInterfaceForDuplicateIndexSignatures(node)
 * 	c.registerForUnusedIdentifiersCheck(node)
 * }
 */
export declare function Checker_checkInterfaceDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkEnumDeclaration","kind":"method","status":"implemented","sigHash":"442575c07f1de55321cc456fd99013c24c7597037ae10a5b7a2afd97ae4c84d1","bodyHash":"885a6295abc552608c543f71bf441d660b7a44a3855cd74033dfe543b0cdeed4"}
 *
 * Go source:
 * func (c *Checker) checkEnumDeclaration(node *ast.Node) {
 * 	c.checkGrammarModifiers(node)
 * 	c.checkCollisionsForDeclarationName(node, node.Name())
 * 	c.checkExportsOnMergedDeclarations(node)
 * 	c.checkSourceElements(node.Members())
 *
 * 	if c.shouldCheckErasableSyntax(node) && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		c.error(node, diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled)
 * 	}
 *
 * 	c.computeEnumMemberValues(node)
 * 	// Spec 2014 - Section 9.3:
 * 	// It isn't possible for one enum declaration to continue the automatic numbering sequence of another,
 * 	// and when an enum type has multiple declarations, only one declaration is permitted to omit a value
 * 	// for the first member.
 * 	//
 * 	// Only perform this check once per symbol
 * 	enumSymbol := c.getSymbolOfDeclaration(node)
 * 	if links := c.declaredTypeLinks.Get(enumSymbol); !links.enumChecked {
 * 		links.enumChecked = true
 * 		if len(enumSymbol.Declarations) > 1 {
 * 			enumIsConst := ast.IsEnumConst(node)
 * 			// check that const is placed\omitted on all enum declarations
 * 			for _, decl := range enumSymbol.Declarations {
 * 				if ast.IsEnumDeclaration(decl) && ast.IsEnumConst(decl) != enumIsConst {
 * 					c.error(ast.GetNameOfDeclaration(decl), diagnostics.Enum_declarations_must_all_be_const_or_non_const)
 * 				}
 * 			}
 * 		}
 * 		seenEnumMissingInitialInitializer := false
 * 		for _, declaration := range enumSymbol.Declarations {
 * 			// return true if we hit a violation of the rule, false otherwise
 * 			if declaration.Kind != ast.KindEnumDeclaration {
 * 				continue
 * 			}
 * 			members := declaration.Members()
 * 			if len(members) == 0 {
 * 				continue
 * 			}
 * 			firstEnumMember := members[0]
 * 			if firstEnumMember.Initializer() == nil {
 * 				if seenEnumMissingInitialInitializer {
 * 					c.error(firstEnumMember.Name(), diagnostics.In_an_enum_with_multiple_declarations_only_one_declaration_can_omit_an_initializer_for_its_first_enum_element)
 * 				} else {
 * 					seenEnumMissingInitialInitializer = true
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkEnumDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkEnumMember","kind":"method","status":"implemented","sigHash":"28b7526a7c38dff462d926c78d53b5eeed5df30ab8bcbdf7d859ca24f6d4320e","bodyHash":"428c578d31f218e21d79b74c0320d8ca6e44cf5ba80bf1a5d7c8cc21b571e134"}
 *
 * Go source:
 * func (c *Checker) checkEnumMember(node *ast.Node) {
 * 	if ast.IsPrivateIdentifier(node.Name()) {
 * 		c.error(node, diagnostics.An_enum_member_cannot_be_named_with_a_private_identifier)
 * 	}
 * 	if node.Initializer() != nil {
 * 		c.checkExpression(node.Initializer())
 * 	}
 * }
 */
export declare function Checker_checkEnumMember(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkModuleDeclaration","kind":"method","status":"implemented","sigHash":"9bcf705bbb240f2bd19cefeba94b53b537975625cc3ae27df7afa3e093dc5130","bodyHash":"c32f37eb3ac7debd92eaa3a4123fd3d48d716ae7a2eea7b5d408800a7c904812"}
 *
 * Go source:
 * func (c *Checker) checkModuleDeclaration(node *ast.Node) {
 * 	if body := node.Body(); body != nil {
 * 		c.checkSourceElement(body)
 * 		if !ast.IsGlobalScopeAugmentation(node) {
 * 			c.registerForUnusedIdentifiersCheck(node)
 * 		}
 * 	}
 * 	isGlobalAugmentation := ast.IsGlobalScopeAugmentation(node)
 * 	inAmbientContext := node.Flags&ast.NodeFlagsAmbient != 0
 * 	if isGlobalAugmentation && !inAmbientContext {
 * 		c.error(node.Name(), diagnostics.Augmentations_for_the_global_scope_should_have_declare_modifier_unless_they_appear_in_already_ambient_context)
 * 	}
 * 	isAmbientExternalModule := ast.IsAmbientModule(node)
 * 	contextErrorMessage := core.IfElse(isAmbientExternalModule,
 * 		diagnostics.An_ambient_module_declaration_is_only_allowed_at_the_top_level_in_a_file,
 * 		diagnostics.A_namespace_declaration_is_only_allowed_at_the_top_level_of_a_namespace_or_module)
 * 	if c.checkGrammarModuleElementContext(node, contextErrorMessage) {
 * 		// If we hit a module declaration in an illegal context, just bail out to avoid cascading errors.
 * 		return
 * 	}
 * 	if !c.checkGrammarModifiers(node) {
 * 		if !inAmbientContext && ast.IsStringLiteral(node.Name()) {
 * 			c.grammarErrorOnNode(node.Name(), diagnostics.Only_ambient_modules_can_use_quoted_names)
 * 		}
 * 	}
 * 	if ast.IsIdentifier(node.Name()) {
 * 		c.checkCollisionsForDeclarationName(node, node.Name())
 * 		if node.AsModuleDeclaration().Keyword == ast.KindModuleKeyword {
 * 			c.error(node.Name(), diagnostics.A_namespace_declaration_should_not_be_declared_using_the_module_keyword_Please_use_the_namespace_keyword_instead)
 * 		}
 * 	}
 * 	c.checkExportsOnMergedDeclarations(node)
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	// The following checks only apply on a non-ambient instantiated module declaration.
 * 	if symbol.Flags&ast.SymbolFlagsValueModule != 0 && !inAmbientContext && isInstantiatedModule(node, c.compilerOptions.ShouldPreserveConstEnums()) {
 * 		if c.shouldCheckErasableSyntax(node) {
 * 			c.error(node, diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled)
 * 		}
 * 		if c.compilerOptions.GetIsolatedModules() && ast.GetSourceFileOfNode(node).ExternalModuleIndicator == nil {
 * 			// This could be loosened a little if needed. The only problem we are trying to avoid is unqualified
 * 			// references to namespace members declared in other files. But use of namespaces is discouraged anyway,
 * 			// so for now we will just not allow them in scripts, which is the only place they can merge cross-file.
 * 			c.error(node.Name(), diagnostics.Namespaces_are_not_allowed_in_global_script_files_when_0_is_enabled_If_this_file_is_not_intended_to_be_a_global_script_set_moduleDetection_to_force_or_add_an_empty_export_statement, c.getIsolatedModulesLikeFlagName())
 * 		}
 * 		if len(symbol.Declarations) > 1 {
 * 			firstNonAmbientClassOrFunc := getFirstNonAmbientClassOrFunctionDeclaration(symbol)
 * 			if firstNonAmbientClassOrFunc != nil {
 * 				if ast.GetSourceFileOfNode(node) != ast.GetSourceFileOfNode(firstNonAmbientClassOrFunc) {
 * 					c.error(node.Name(), diagnostics.A_namespace_declaration_cannot_be_in_a_different_file_from_a_class_or_function_with_which_it_is_merged)
 * 				} else if node.Pos() < firstNonAmbientClassOrFunc.Pos() {
 * 					c.error(node.Name(), diagnostics.A_namespace_declaration_cannot_be_located_prior_to_a_class_or_function_with_which_it_is_merged)
 * 				}
 * 			}
 * 		}
 * 		if c.compilerOptions.VerbatimModuleSyntax.IsTrue() && ast.IsSourceFile(node.Parent) && node.ModifierFlags()&ast.ModifierFlagsExport != 0 && c.program.GetEmitModuleFormatOfFile(node.Parent.AsSourceFile()) == core.ModuleKindCommonJS {
 * 			exportModifier := core.Find(node.ModifierNodes(), func(m *ast.Node) bool { return m.Kind == ast.KindExportKeyword })
 * 			c.error(exportModifier, diagnostics.A_top_level_export_modifier_cannot_be_used_on_value_declarations_in_a_CommonJS_module_when_verbatimModuleSyntax_is_enabled)
 * 		}
 * 	}
 * 	if isAmbientExternalModule {
 * 		if ast.IsExternalModuleAugmentation(node) {
 * 			// body of the augmentation should be checked for consistency only if augmentation was applied to its target (either global scope or module)
 * 			// otherwise we'll be swamped in cascading errors.
 * 			// We can detect if augmentation was applied using following rules:
 * 			// - augmentation for a global scope is always applied
 * 			// - augmentation for some external module is applied if symbol for augmentation is merged (it was combined with target module).
 * 			checkBody := isGlobalAugmentation || c.getSymbolOfDeclaration(node).Flags&ast.SymbolFlagsTransient != 0
 * 			if checkBody && node.Body() != nil {
 * 				for _, statement := range node.Body().Statements() {
 * 					c.checkModuleAugmentationElement(statement)
 * 				}
 * 			}
 * 		} else if ast.IsGlobalSourceFile(node.Parent) {
 * 			if isGlobalAugmentation {
 * 				c.error(node.Name(), diagnostics.Augmentations_for_the_global_scope_can_only_be_directly_nested_in_external_modules_or_ambient_module_declarations)
 * 			} else if tspath.IsExternalModuleNameRelative(node.Name().Text()) {
 * 				c.error(node.Name(), diagnostics.Ambient_module_declaration_cannot_specify_relative_module_name)
 * 			}
 * 		} else {
 * 			if isGlobalAugmentation {
 * 				c.error(node.Name(), diagnostics.Augmentations_for_the_global_scope_can_only_be_directly_nested_in_external_modules_or_ambient_module_declarations)
 * 			} else {
 * 				// Node is not an augmentation and is not located on the script level.
 * 				// This means that this is declaration of ambient module that is located in other module or namespace which is prohibited.
 * 				c.error(node.Name(), diagnostics.Ambient_modules_cannot_be_nested_in_other_modules_or_namespaces)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkModuleDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIsolatedModulesLikeFlagName","kind":"method","status":"implemented","sigHash":"46452b4f455b7e4d9d2c69e0e289a5cb0768f2c2fd6e34c27875ef4e3aa3415d","bodyHash":"0f57a8168e4946bc514754ed7bd4a6f69d8535c8e4da34cee399c8a71fbb1a0b"}
 *
 * Go source:
 * func (c *Checker) getIsolatedModulesLikeFlagName() string {
 * 	return core.IfElse(c.compilerOptions.VerbatimModuleSyntax.IsTrue(), "verbatimModuleSyntax", "isolatedModules")
 * }
 */
export declare function Checker_getIsolatedModulesLikeFlagName(receiver: GoPtr<Checker>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportDeclaration","kind":"method","status":"implemented","sigHash":"dbc0a7752c2e92eae8b1c1b072aff7ebfad3669bdafbe879a8d227651180770b","bodyHash":"69f059f95bdfb45c4125d0e3b964459a71d9e8f8b1f788b5aaae9767614d0ec0"}
 *
 * Go source:
 * func (c *Checker) checkImportDeclaration(node *ast.ImportDeclarationNode) {
 * 	// Grammar checking
 * 	var diagnostic *diagnostics.Message
 * 	if ast.IsInJSFile(node) {
 * 		diagnostic = diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_module
 * 	} else {
 * 		diagnostic = diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_namespace_or_module
 * 	}
 * 	if c.checkGrammarModuleElementContext(node, diagnostic) {
 * 		// If we hit an import declaration in an illegal context, just bail out to avoid cascading errors.
 * 		return
 * 	}
 * 	if !c.checkGrammarModifiers(node) && node.Modifiers() != nil {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.An_import_declaration_cannot_have_modifiers)
 * 	}
 * 	if c.checkExternalImportOrExportDeclaration(node) {
 * 		var resolvedModule *ast.Symbol
 * 		importClause := node.ImportClause()
 * 		moduleSpecifier := node.ModuleSpecifier()
 * 		if importClause != nil && !c.checkGrammarImportClause(importClause.AsImportClause()) {
 * 			if importClause.Name() != nil {
 * 				c.checkImportBinding(importClause)
 * 			}
 * 			var needsImportStar bool
 * 			namedBindings := importClause.AsImportClause().NamedBindings
 * 			if namedBindings != nil {
 * 				if ast.IsNamespaceImport(namedBindings) {
 * 					c.checkImportBinding(namedBindings)
 * 					if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 						// import * as ns from "foo";
 * 						needsImportStar = true
 * 						c.checkExternalEmitHelpers(node, ExternalEmitHelpersImportStar)
 * 					}
 * 				} else {
 * 					resolvedModule = c.resolveExternalModuleName(node, node.ModuleSpecifier(), false)
 * 					if resolvedModule != nil {
 * 						for _, binding := range namedBindings.Elements() {
 * 							c.checkImportBinding(binding)
 * 						}
 * 					}
 * 				}
 * 			}
 * 			if importClause.Name() != nil &&
 * 				!needsImportStar &&
 * 				c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 				// import d from "foo";
 * 				c.checkExternalEmitHelpers(node, ExternalEmitHelpersImportDefault)
 * 			}
 *
 * 			if !importClause.IsTypeOnly() &&
 * 				core.ModuleKindNode18 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext &&
 * 				c.isOnlyImportableAsDefault(moduleSpecifier, resolvedModule) &&
 * 				!hasTypeJsonImportAttribute(node) {
 * 				c.error(moduleSpecifier, diagnostics.Importing_a_JSON_file_into_an_ECMAScript_module_requires_a_type_Colon_json_import_attribute_when_module_is_set_to_0, c.moduleKind.String())
 * 			}
 * 		} else if c.compilerOptions.NoUncheckedSideEffectImports.IsTrueOrUnknown() && importClause == nil {
 * 			ignoreErrors := c.compilerOptions.NoCheck.IsTrue()
 * 			var errorMessage *diagnostics.Message
 * 			if !ignoreErrors {
 * 				errorMessage = diagnostics.Cannot_find_module_or_type_declarations_for_side_effect_import_of_0
 * 			}
 * 			c.resolveExternalModuleNameWorker(node, moduleSpecifier, errorMessage, ignoreErrors, false /*isForAugmentation* /)
 * 		}
 * 	}
 * 	c.checkImportAttributes(node)
 * }
 */
export declare function Checker_checkImportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<ImportDeclarationNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExternalImportOrExportDeclaration","kind":"method","status":"implemented","sigHash":"925a42a7758d8dedc2d387711476b75abfc7a2608c26d3212b2e6bc171f6f050","bodyHash":"d1cfd3f5a8521f92739ef5228343778f7666806e97900a14a3f435234490fb96"}
 *
 * Go source:
 * func (c *Checker) checkExternalImportOrExportDeclaration(node *ast.Node) bool {
 * 	moduleName := ast.GetExternalModuleName(node)
 * 	if moduleName == nil || ast.NodeIsMissing(moduleName) {
 * 		// Should be a parse error.
 * 		return false
 * 	}
 * 	if !ast.IsStringLiteral(moduleName) {
 * 		c.error(moduleName, diagnostics.String_literal_expected)
 * 		return false
 * 	}
 * 	inAmbientExternalModule := ast.IsModuleBlock(node.Parent) && ast.IsAmbientModule(node.Parent.Parent)
 * 	if !ast.IsSourceFile(node.Parent) && !inAmbientExternalModule {
 * 		c.error(moduleName, core.IfElse(ast.IsExportDeclaration(node), diagnostics.Export_declarations_are_not_permitted_in_a_namespace, diagnostics.Import_declarations_in_a_namespace_cannot_reference_a_module))
 * 		return false
 * 	}
 * 	if inAmbientExternalModule && tspath.IsExternalModuleNameRelative(moduleName.Text()) {
 * 		// we have already reported errors on top level imports/exports in external module augmentations in checkModuleDeclaration
 * 		// no need to do this again.
 * 		if !isTopLevelInExternalModuleAugmentation(node) {
 * 			// TypeScript 1.0 spec (April 2013): 12.1.6
 * 			// An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference
 * 			// other external modules only through top - level external module names.
 * 			// Relative external module names are not permitted.
 * 			c.error(node, diagnostics.Import_or_export_declaration_in_an_ambient_module_declaration_cannot_reference_module_through_relative_module_name)
 * 			return false
 * 		}
 * 	}
 * 	if !ast.IsImportEqualsDeclaration(node) {
 * 		attributes := ast.GetImportAttributes(node)
 * 		if attributes != nil {
 * 			hasError := false
 * 			for _, attr := range attributes.AsImportAttributes().Attributes.Nodes {
 * 				if !ast.IsStringLiteral(attr.AsImportAttribute().Value) {
 * 					hasError = true
 * 					c.error(attr.AsImportAttribute().Value, diagnostics.Import_attribute_values_must_be_string_literal_expressions)
 * 				}
 * 			}
 * 			return !hasError
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function Checker_checkExternalImportOrExportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportBinding","kind":"method","status":"implemented","sigHash":"8cc5ce6e26cd8d1155c5ec5924eaf2371d327827404fcea38cea3237f4fd064f","bodyHash":"f531713f26e7186bdf77eb3e19872a9001468fc4e3171daeb4324462de1944c9"}
 *
 * Go source:
 * func (c *Checker) checkImportBinding(node *ast.Node) {
 * 	c.checkCollisionsForDeclarationName(node, node.Name())
 * 	c.checkAliasSymbol(node)
 * 	if ast.IsImportSpecifier(node) {
 * 		c.checkModuleExportName(node.PropertyName(), true /*allowStringLiteral* /)
 * 		if ast.ModuleExportNameIsDefault(node.PropertyNameOrName()) &&
 * 			c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 			c.checkExternalEmitHelpers(node, ExternalEmitHelpersImportDefault)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkImportBinding(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkModuleExportName","kind":"method","status":"implemented","sigHash":"6e790c70f171c61c9720e2a1b34b1ae1a5ad671f63802401be78a00f77cf1947","bodyHash":"b12145bb738ba7a08526c29e75378755fba11c0af326da3b408229d7c8ce3b52"}
 *
 * Go source:
 * func (c *Checker) checkModuleExportName(name *ast.Node, allowStringLiteral bool) {
 * 	if name == nil || name.Kind != ast.KindStringLiteral {
 * 		return
 * 	}
 * 	if !allowStringLiteral {
 * 		c.grammarErrorOnNode(name, diagnostics.Identifier_expected)
 * 	} else if c.moduleKind == core.ModuleKindES2015 || c.moduleKind == core.ModuleKindES2020 {
 * 		if !ast.GetSourceFileOfNode(name).IsDeclarationFile {
 * 			c.grammarErrorOnNode(name, diagnostics.String_literal_import_and_export_names_are_not_supported_when_the_module_flag_is_set_to_es2015_or_es2020)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkModuleExportName(receiver: GoPtr<Checker>, name: GoPtr<Node>, allowStringLiteral: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportAttributes","kind":"method","status":"implemented","sigHash":"d28f8d8ddf181621bfec0f2b4e47404dcb0c9e32ddd87bb6c876259344318784","bodyHash":"d32031e30805e67821d91edd4adb82965421947d18ad0f3f42d33fdbd4e2ed3e"}
 *
 * Go source:
 * func (c *Checker) checkImportAttributes(declaration *ast.Node) {
 * 	node := ast.GetImportAttributes(declaration)
 * 	if node == nil {
 * 		return
 * 	}
 * 	importAttributesType := c.getGlobalImportAttributesTypeChecked()
 * 	if importAttributesType != c.emptyObjectType {
 * 		c.checkTypeAssignableTo(c.getTypeFromImportAttributes(node), c.getNullableType(importAttributesType, TypeFlagsUndefined), node, nil)
 * 	}
 * 	isTypeOnly := ast.IsExclusivelyTypeOnlyImportOrExport(declaration)
 * 	override := c.getResolutionModeOverride(node.AsImportAttributes(), isTypeOnly)
 * 	if isTypeOnly && override != core.ResolutionModeNone {
 * 		return // Other grammar checks do not apply to type-only imports with resolution mode attributes
 * 	}
 *
 * 	if !c.moduleKind.SupportsImportAttributes() {
 * 		c.grammarErrorOnNode(node, diagnostics.Import_attributes_are_only_supported_when_the_module_option_is_set_to_esnext_node18_node20_nodenext_or_preserve)
 * 		return
 * 	}
 *
 * 	if moduleSpecifier := getModuleSpecifierFromNode(declaration); moduleSpecifier != nil {
 * 		if c.getEmitSyntaxForModuleSpecifierExpression(moduleSpecifier) == core.ModuleKindCommonJS {
 * 			c.grammarErrorOnNode(node, diagnostics.Import_attributes_are_not_allowed_on_statements_that_compile_to_CommonJS_require_calls)
 * 			return
 * 		}
 * 	}
 *
 * 	if isTypeOnly {
 * 		c.grammarErrorOnNode(node, diagnostics.Import_attributes_cannot_be_used_with_type_only_imports_or_exports)
 * 		return
 * 	}
 * 	if override != core.ResolutionModeNone {
 * 		c.grammarErrorOnNode(node, diagnostics.X_resolution_mode_can_only_be_set_for_type_only_imports)
 * 	}
 * }
 */
export declare function Checker_checkImportAttributes(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromImportAttributes","kind":"method","status":"implemented","sigHash":"7a0f9f51c3e86814f3415882427b013cd3514f47ffce7706b6b05d4788b6b253","bodyHash":"a28632abbd50f41500cf28ec7b5537478b5bb15abb2d1e333c491ac7b6ba533c"}
 *
 * Go source:
 * func (c *Checker) getTypeFromImportAttributes(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		symbol := c.newSymbol(ast.SymbolFlagsObjectLiteral, ast.InternalSymbolNameImportAttributes)
 * 		members := make(ast.SymbolTable)
 * 		for _, attr := range node.AsImportAttributes().Attributes.Nodes {
 * 			member := c.newSymbol(ast.SymbolFlagsProperty, attr.Name().Text())
 * 			c.valueSymbolLinks.Get(member).resolvedType = c.getRegularTypeOfLiteralType(c.checkExpression(attr.AsImportAttribute().Value))
 * 			members[member.Name] = member
 * 		}
 * 		t := c.newAnonymousType(symbol, members, nil, nil, nil)
 * 		t.objectFlags |= ObjectFlagsObjectLiteral | ObjectFlagsNonInferrableType
 * 		links.resolvedType = t
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeFromImportAttributes(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"27c21cb4c11d7a556c508db5f2975fc45fb37cd32b2af6e883b127101811dc2e","bodyHash":"a9f64d3cb88d84400de5899f60fdc4161d3cff38ac939f1fd093004e7a59ed65"}
 *
 * Go source:
 * func (c *Checker) checkImportEqualsDeclaration(node *ast.Node) {
 * 	diagnostic := core.IfElse(ast.IsInJSFile(node),
 * 		diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_module,
 * 		diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_namespace_or_module)
 * 	if c.checkGrammarModuleElementContext(node, diagnostic) {
 * 		return // If we hit an import declaration in an illegal context, just bail out to avoid cascading errors.
 * 	}
 * 	c.checkGrammarModifiers(node)
 * 	if c.shouldCheckErasableSyntax(node) && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		c.error(node, diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled)
 * 	}
 * 	if ast.IsInternalModuleImportEqualsDeclaration(node) || c.checkExternalImportOrExportDeclaration(node) {
 * 		c.checkImportBinding(node)
 * 		c.markLinkedReferences(node, ReferenceHintExportImportEquals, nil, nil)
 * 		moduleReference := node.AsImportEqualsDeclaration().ModuleReference
 * 		if !ast.IsExternalModuleReference(moduleReference) {
 * 			target := c.resolveAlias(c.getSymbolOfDeclaration(node))
 * 			if target != c.unknownSymbol {
 * 				targetFlags := c.getSymbolFlags(target)
 * 				if targetFlags&ast.SymbolFlagsValue != 0 {
 * 					// Target is a value symbol, check that it is not hidden by a local declaration with the same name
 * 					moduleName := ast.GetFirstIdentifier(moduleReference)
 * 					if c.resolveEntityName(moduleName, ast.SymbolFlagsValue|ast.SymbolFlagsNamespace, false, false, nil).Flags&ast.SymbolFlagsNamespace == 0 {
 * 						c.error(moduleName, diagnostics.Module_0_is_hidden_by_a_local_declaration_with_the_same_name, scanner.DeclarationNameToString(moduleName))
 * 					}
 * 				}
 * 				if targetFlags&ast.SymbolFlagsType != 0 {
 * 					c.checkTypeNameIsReserved(node.Name(), diagnostics.Import_name_cannot_be_0)
 * 				}
 * 			}
 * 			if node.IsTypeOnly() {
 * 				c.grammarErrorOnNode(node, diagnostics.An_import_alias_cannot_use_import_type)
 * 			}
 * 		} else {
 * 			if core.ModuleKindES2015 <= c.moduleKind && c.moduleKind <= core.ModuleKindESNext && !node.IsTypeOnly() && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 				// Import equals declaration cannot be emitted as ESM
 * 				c.grammarErrorOnNode(node, diagnostics.Import_assignment_cannot_be_used_when_targeting_ECMAScript_modules_Consider_using_import_Asterisk_as_ns_from_mod_import_a_from_mod_import_d_from_mod_or_another_module_format_instead)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkImportEqualsDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExportDeclaration","kind":"method","status":"implemented","sigHash":"8c854a2ef8a0dd3f09499fc07039fc83f08b6dbb0ae73f111a5b2dd04a1f3d3d","bodyHash":"5c1d98f3f22818847baf8d3018996a5c02951274d96d49b25326628adb0e6b65"}
 *
 * Go source:
 * func (c *Checker) checkExportDeclaration(node *ast.ExportDeclarationNode) {
 * 	diagnostic := core.IfElse(ast.IsInJSFile(node),
 * 		diagnostics.An_export_declaration_can_only_be_used_at_the_top_level_of_a_module,
 * 		diagnostics.An_export_declaration_can_only_be_used_at_the_top_level_of_a_namespace_or_module)
 * 	if c.checkGrammarModuleElementContext(node, diagnostic) {
 * 		return // If we hit an export in an illegal context, just bail out to avoid cascading errors.
 * 	}
 * 	exportDecl := node.AsExportDeclaration()
 * 	if !c.checkGrammarModifiers(node) && exportDecl.Modifiers() != nil {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.An_export_declaration_cannot_have_modifiers)
 * 	}
 * 	c.checkGrammarExportDeclaration(exportDecl)
 * 	if exportDecl.ModuleSpecifier == nil || c.checkExternalImportOrExportDeclaration(node) {
 * 		if exportDecl.ExportClause != nil && !ast.IsNamespaceExport(exportDecl.ExportClause) {
 * 			// export { x, y }
 * 			// export { x, y } from "foo"
 * 			for _, binding := range exportDecl.ExportClause.Elements() {
 * 				c.checkExportSpecifier(binding)
 * 			}
 * 			inAmbientExternalModule := ast.IsModuleBlock(node.Parent) && ast.IsAmbientModule(node.Parent.Parent)
 * 			inAmbientNamespaceDeclaration := !inAmbientExternalModule && ast.IsModuleBlock(node.Parent) && exportDecl.ModuleSpecifier == nil && node.Flags&ast.NodeFlagsAmbient != 0
 * 			if !ast.IsSourceFile(node.Parent) && !inAmbientExternalModule && !inAmbientNamespaceDeclaration {
 * 				c.error(node, diagnostics.Export_declarations_are_not_permitted_in_a_namespace)
 * 			}
 * 		} else {
 * 			// export * from "foo"
 * 			// export * as ns from "foo";
 * 			moduleSymbol := c.resolveExternalModuleName(node, exportDecl.ModuleSpecifier, false)
 * 			if moduleSymbol != nil && hasExportAssignmentSymbol(moduleSymbol) {
 * 				c.error(exportDecl.ModuleSpecifier, diagnostics.Module_0_uses_export_and_cannot_be_used_with_export_Asterisk, c.symbolToString(moduleSymbol))
 * 			} else if exportDecl.ExportClause != nil {
 * 				c.checkAliasSymbol(exportDecl.ExportClause)
 * 				c.checkModuleExportName(exportDecl.ExportClause.Name(), true /*allowStringLiteral* /)
 * 			}
 * 			if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 				if node.AsExportDeclaration().ExportClause != nil {
 * 					// export * as ns from "foo";
 * 					c.checkExternalEmitHelpers(node, ExternalEmitHelpersImportStar)
 * 				} else {
 * 					// export * from "foo"
 * 					c.checkExternalEmitHelpers(node, ExternalEmitHelpersExportStar)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.checkImportAttributes(node)
 * }
 */
export declare function Checker_checkExportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<ExportDeclarationNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExportSpecifier","kind":"method","status":"implemented","sigHash":"5da6048ba76cb6921d99471b0900ffbed20a2a6b347fb5d7a180a1a6f754326d","bodyHash":"b5cd45281494c7a126279dbb7666b9e092941cbc52b3763cbd51836dec084ff9"}
 *
 * Go source:
 * func (c *Checker) checkExportSpecifier(node *ast.ExportSpecifierNode) {
 * 	c.checkAliasSymbol(node)
 * 	hasModuleSpecifier := node.Parent.Parent.ModuleSpecifier() != nil
 * 	c.checkModuleExportName(node.PropertyName(), hasModuleSpecifier)
 * 	c.checkModuleExportName(node.Name(), true /*allowStringLiteral* /)
 *
 * 	if !hasModuleSpecifier {
 * 		exportedName := node.PropertyNameOrName()
 * 		if exportedName.Kind == ast.KindStringLiteral {
 * 			return // Skip for invalid syntax like this: export { "x" }
 * 		}
 * 		// find immediate value referenced by exported name (SymbolFlags.Alias is set so we don't chase down aliases)
 * 		symbol := c.resolveName(exportedName, exportedName.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias, nil /*nameNotFoundMessage* /, true /*isUse* /, false)
 * 		if symbol != nil && (symbol == c.undefinedSymbol || symbol == c.globalThisSymbol || symbol.Declarations != nil && ast.IsGlobalSourceFile(ast.GetDeclarationContainer(symbol.Declarations[0]))) {
 * 			c.error(exportedName, diagnostics.Cannot_export_0_Only_local_declarations_can_be_exported_from_a_module, exportedName.Text())
 * 		} else {
 * 			c.markLinkedReferences(node, ReferenceHintExportSpecifier, nil /*propSymbol* /, nil /*parentType* /)
 * 		}
 * 	} else if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS &&
 * 		ast.ModuleExportNameIsDefault(node.PropertyNameOrName()) {
 * 		c.checkExternalEmitHelpers(node, ExternalEmitHelpersImportDefault)
 * 	}
 * }
 */
export declare function Checker_checkExportSpecifier(receiver: GoPtr<Checker>, node: GoPtr<ExportSpecifierNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExternalModuleExports","kind":"method","status":"implemented","sigHash":"fb3605672a5fe0538b717840fc4a708424d63fffc0e0c00451aeeff31cbdd9f6","bodyHash":"5920758f5f4355ab62775a6e9705aa2e1ed330ba535375bf66cf3a2bd0aeaf52"}
 *
 * Go source:
 * func (c *Checker) checkExternalModuleExports(node *ast.Node) {
 * 	moduleSymbol := c.getSymbolOfDeclaration(node)
 * 	links := c.moduleSymbolLinks.Get(moduleSymbol)
 * 	if !links.exportsChecked {
 * 		exportEqualsSymbol := moduleSymbol.Exports[ast.InternalSymbolNameExportEquals]
 * 		// An export assignment is in error if (a) the module exports value members or (b) if the module exports type or
 * 		// namespace members and the exported entity also exports type or namespace members.
 * 		if exportEqualsSymbol != nil && (c.hasExportedMembersOfKind(moduleSymbol, ast.SymbolFlagsValue) || c.hasShadowedNamespace(exportEqualsSymbol)) {
 * 			declaration := core.OrElse(c.getDeclarationOfAliasSymbol(exportEqualsSymbol), exportEqualsSymbol.ValueDeclaration)
 * 			if declaration != nil && !isTopLevelInExternalModuleAugmentation(declaration) {
 * 				c.error(declaration, diagnostics.An_export_assignment_cannot_be_used_in_a_module_with_other_exported_elements)
 * 			}
 * 		}
 * 		// Checks for export * conflicts
 * 		for id, symbol := range c.getExportsOfModule(moduleSymbol) {
 * 			if id == ast.InternalSymbolNameExportStar {
 * 				continue
 * 			}
 * 			// ECMA262: 15.2.1.1 It is a Syntax Error if the ExportedNames of ModuleItemList contains any duplicate entries.
 * 			// (TS Exceptions: namespaces, function overloads, enums, and interfaces)
 * 			if symbol.Flags&(ast.SymbolFlagsNamespace|ast.SymbolFlagsEnum) != 0 {
 * 				continue
 * 			}
 * 			exportedDeclarationsCount := core.CountWhere(symbol.Declarations, func(d *ast.Node) bool {
 * 				return isNotOverload(d) && !ast.IsAccessor(d) && !ast.IsInterfaceDeclaration(d)
 * 			})
 * 			if symbol.Flags&ast.SymbolFlagsTypeAlias != 0 && exportedDeclarationsCount <= 2 {
 * 				// it is legal to merge type alias with other values
 * 				// so count should be either 1 (just type alias) or 2 (type alias + merged value)
 * 				continue
 * 			}
 * 			if exportedDeclarationsCount > 1 && !core.Every(symbol.Declarations, func(node *ast.Node) bool {
 * 				return ast.GetAssignmentDeclarationKind(node) == ast.JSDeclarationKindExportsProperty
 * 			}) {
 * 				for _, declaration := range symbol.Declarations {
 * 					if isNotOverload(declaration) {
 * 						c.error(declaration, diagnostics.Cannot_redeclare_exported_variable_0, id)
 * 					}
 * 				}
 * 			}
 * 		}
 * 		links.exportsChecked = true
 * 	}
 * }
 */
export declare function Checker_checkExternalModuleExports(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasExportedMembersOfKind","kind":"method","status":"implemented","sigHash":"bab80ed0c3307f7b3ede5429908f01d39510f5cab0684ee3885c4ab0bb6f3983","bodyHash":"777c85eb88226b021080c4086e30518870da4692c5419a215d3553e8029d2235"}
 *
 * Go source:
 * func (c *Checker) hasExportedMembersOfKind(moduleSymbol *ast.Symbol, kind ast.SymbolFlags) bool {
 * 	for _, symbol := range moduleSymbol.Exports {
 * 		if symbol.Name != ast.InternalSymbolNameExportEquals && c.getSymbolFlags(symbol)&kind != 0 {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_hasExportedMembersOfKind(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, kind: SymbolFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasShadowedNamespace","kind":"method","status":"implemented","sigHash":"33a33f64e423a321c606b00472f65a916e07bf5bb5b56e0db365c0689d3d9446","bodyHash":"f7b5031b75030fe28d2895cf28ed4f9825fb29f3c72aad92b355b4da3a21ba91"}
 *
 * Go source:
 * func (c *Checker) hasShadowedNamespace(symbol *ast.Symbol) bool {
 * 	if symbol.Flags&ast.SymbolFlagsNamespaceModule != 0 && symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		if target := c.resolveAlias(symbol); target.Flags&ast.SymbolFlagsNamespace != 0 && c.hasExportedMembersOfKind(target, ast.SymbolFlagsType|ast.SymbolFlagsNamespace) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_hasShadowedNamespace(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMissingDeclaration","kind":"method","status":"implemented","sigHash":"328b0eb876046e88b6cd03a2afff034b650e887da3da09bc8bdf2dbf78b21a64","bodyHash":"c6f8040e8e0bed4dbbe9a5820ba2c148deb8444b0d506ab482cf3e8d3d90386d"}
 *
 * Go source:
 * func (c *Checker) checkMissingDeclaration(node *ast.Node) {
 * 	c.checkDecorators(node)
 * }
 */
export declare function Checker_checkMissingDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkVariableDeclarationList","kind":"method","status":"implemented","sigHash":"730ac402348c063c7739ad43114b9b764aae8b7b464f945dac29aa6266cc4584","bodyHash":"610f23c994f8cc6b415d25d8aa8b2fe1f2e4b89f3a2c8ea7f802f88363bf39a3"}
 *
 * Go source:
 * func (c *Checker) checkVariableDeclarationList(node *ast.Node) {
 * 	blockScopeKind := ast.GetCombinedNodeFlags(node) & ast.NodeFlagsBlockScoped
 * 	if (blockScopeKind == ast.NodeFlagsUsing || blockScopeKind == ast.NodeFlagsAwaitUsing) && c.languageVersion < LanguageFeatureMinimumTarget.UsingAndAwaitUsing {
 * 		c.checkExternalEmitHelpers(node, ExternalEmitHelpersAddDisposableResourceAndDisposeResources)
 * 	}
 * 	c.checkSourceElements(node.AsVariableDeclarationList().Declarations.Nodes)
 * }
 */
export declare function Checker_checkVariableDeclarationList(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkVariableDeclaration","kind":"method","status":"implemented","sigHash":"a49a0e78c9f2f3f6d538b59d947fba8217f916b950926208dbb22da35d360ee7","bodyHash":"ea95f1f87508fceec7496b3d90eb284efed9e7b2326b9dc9c96c956fa753a6c8"}
 *
 * Go source:
 * func (c *Checker) checkVariableDeclaration(node *ast.Node) {
 * 	if tr := c.tracer; tr != nil {
 * 		defer tr.Push(tracing.PhaseCheck, "checkVariableDeclaration", map[string]any{"kind": node.Kind, "pos": node.Pos(), "end": node.End(), "path": ast.GetSourceFileOfNode(node).FileName()}, false)()
 * 	}
 * 	c.checkGrammarVariableDeclaration(node.AsVariableDeclaration())
 * 	c.checkVariableLikeDeclaration(node)
 * }
 */
export declare function Checker_checkVariableDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkVariableLikeDeclaration","kind":"method","status":"implemented","sigHash":"04f4aeaad71bbafcd82cfee0bb8b94309a79fd0fdcde901b117ca0a37851378d","bodyHash":"aacb58660a81797f808e3b4525ac078b04bdc085c2c55737bc786cfecf3c731a"}
 *
 * Go source:
 * func (c *Checker) checkVariableLikeDeclaration(node *ast.Node) {
 * 	c.checkDecorators(node)
 * 	name := node.Name()
 * 	if name == nil {
 * 		return // Missing array binding elements have no name
 * 	}
 * 	typeNode := node.Type()
 * 	initializer := node.Initializer()
 * 	if !ast.IsBindingElement(node) {
 * 		c.checkSourceElement(typeNode)
 * 	}
 * 	// For a computed property, just check the initializer and exit
 * 	// Do not use hasDynamicName here, because that returns false for well known symbols.
 * 	// We want to perform checkComputedPropertyName for all computed properties, including
 * 	// well known symbols.
 * 	if ast.IsComputedPropertyName(name) {
 * 		c.checkComputedPropertyName(name)
 * 		if initializer != nil {
 * 			c.checkExpressionCached(initializer)
 * 		}
 * 	}
 * 	if ast.IsBindingElement(node) {
 * 		propName := node.PropertyName()
 * 		if propName != nil && ast.IsIdentifier(node.Name()) && ast.IsPartOfParameterDeclaration(node) && ast.NodeIsMissing(ast.GetContainingFunction(node).Body()) {
 * 			// type F = ({a: string}) => void;
 * 			//               ^^^^^^
 * 			// variable renaming in function type notation is confusing,
 * 			// so we forbid it even if noUnusedLocals is not enabled
 * 			c.renamedBindingElementsInTypes = append(c.renamedBindingElementsInTypes, node)
 * 			return
 * 		}
 * 		if ast.IsObjectBindingPattern(node.Parent) && hasDotDotDotToken(node) && c.languageVersion < LanguageFeatureMinimumTarget.ObjectSpreadRest {
 * 			c.checkExternalEmitHelpers(node, ExternalEmitHelpersRest)
 * 		}
 * 		// check computed properties inside property names of binding elements
 * 		if propName != nil && ast.IsComputedPropertyName(propName) {
 * 			c.checkComputedPropertyName(propName)
 * 		}
 * 		// check private/protected variable access
 * 		parent := node.Parent.Parent
 * 		parentCheckMode := core.IfElse(hasDotDotDotToken(node), CheckModeRestBindingElement, CheckModeNormal)
 * 		parentType := c.getTypeForBindingElementParent(parent, parentCheckMode)
 * 		propNameName := node.PropertyNameOrName()
 * 		if parentType != nil && !ast.IsBindingPattern(propNameName) {
 * 			exprType := c.getLiteralTypeFromPropertyName(propNameName)
 * 			if isTypeUsableAsPropertyName(exprType) {
 * 				nameText := getPropertyNameFromType(exprType)
 * 				property := c.getPropertyOfType(parentType, nameText)
 * 				if property != nil {
 * 					c.markPropertyAsReferenced(property, nil /*nodeForCheckWriteOnly* /, false /*isSelfTypeAccess* /)
 * 					// A destructuring is never a write-only reference.
 * 					c.checkPropertyAccessibility(node, parent.Initializer() != nil && parent.Initializer().Kind == ast.KindSuperKeyword, false /*writing* /, parentType, property)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	// For a binding pattern, check contained binding elements
 * 	if ast.IsBindingPattern(name) {
 * 		c.checkSourceElements(name.Elements())
 * 	}
 * 	// For a parameter declaration with an initializer, error and exit if the containing function doesn't have a body
 * 	if initializer != nil && ast.IsPartOfParameterDeclaration(node) && ast.NodeIsMissing(ast.GetContainingFunction(node).Body()) {
 * 		c.error(node, diagnostics.A_parameter_initializer_is_only_allowed_in_a_function_or_constructor_implementation)
 * 		return
 * 	}
 * 	// For a binding pattern, validate the initializer and exit
 * 	if ast.IsBindingPattern(name) {
 * 		if isInAmbientOrTypeNode(node) {
 * 			return
 * 		}
 * 		needCheckInitializer := initializer != nil && node.Parent.Parent.Kind != ast.KindForInStatement
 * 		needCheckWidenedType := !core.Some(name.Elements(), func(n *ast.Node) bool { return n.Name() != nil })
 * 		if needCheckInitializer || needCheckWidenedType {
 * 			// Don't validate for-in initializer as it is already an error
 * 			widenedType := c.getWidenedTypeForVariableLikeDeclaration(node, false /*reportErrors* /)
 * 			if needCheckInitializer {
 * 				initializerType := c.checkExpressionCached(initializer)
 * 				if c.strictNullChecks && needCheckWidenedType {
 * 					c.checkNonNullNonVoidType(initializerType, node)
 * 				} else {
 * 					c.checkTypeAssignableToAndOptionallyElaborate(initializerType, c.getWidenedTypeForVariableLikeDeclaration(node, false), node, initializer, nil, nil)
 * 				}
 * 			}
 * 			// check the binding pattern with empty elements
 * 			if needCheckWidenedType {
 * 				if ast.IsArrayBindingPattern(name) {
 * 					c.checkIteratedTypeOrElementType(IterationUseDestructuring, widenedType, c.undefinedType, node)
 * 				} else if c.strictNullChecks {
 * 					c.checkNonNullNonVoidType(widenedType, node)
 * 				}
 * 			}
 * 		}
 * 		return
 * 	}
 * 	// For a commonjs `const x = require`, validate the alias and exit
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 && ast.IsVariableDeclarationInitializedToRequire(node) {
 * 		c.checkAliasSymbol(node)
 * 		return
 * 	}
 * 	if ast.IsBigIntLiteral(name) {
 * 		c.error(name, diagnostics.A_bigint_literal_cannot_be_used_as_a_property_name)
 * 	}
 * 	t := c.convertAutoToAny(c.getTypeOfSymbol(symbol))
 * 	if node == symbol.ValueDeclaration {
 * 		// Node is the primary declaration of the symbol, just validate the initializer
 * 		// Don't validate for-in initializer as it is already an error
 * 		if initializer != nil && !ast.IsForInStatement(node.Parent.Parent) {
 * 			initializerType := c.checkExpressionCached(initializer)
 * 			c.checkTypeAssignableToAndOptionallyElaborate(initializerType, t, node, initializer, nil /*headMessage* /, nil)
 * 			blockScopeKind := c.getCombinedNodeFlagsCached(node) & ast.NodeFlagsBlockScoped
 * 			if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 				globalAsyncDisposableType := c.getGlobalAsyncDisposableType()
 * 				globalDisposableType := c.getGlobalDisposableType()
 * 				if globalAsyncDisposableType != c.emptyObjectType && globalDisposableType != c.emptyObjectType {
 * 					optionalDisposableType := c.getUnionType([]*Type{globalAsyncDisposableType, globalDisposableType, c.nullType, c.undefinedType})
 * 					c.checkTypeAssignableTo(c.widenTypeForVariableLikeDeclaration(initializerType, node, false), optionalDisposableType, initializer,
 * 						diagnostics.The_initializer_of_an_await_using_declaration_must_be_either_an_object_with_a_Symbol_asyncDispose_or_Symbol_dispose_method_or_be_null_or_undefined)
 * 				}
 * 			} else if blockScopeKind == ast.NodeFlagsUsing {
 * 				globalDisposableType := c.getGlobalDisposableType()
 * 				if globalDisposableType != c.emptyObjectType {
 * 					optionalDisposableType := c.getUnionType([]*Type{globalDisposableType, c.nullType, c.undefinedType})
 * 					c.checkTypeAssignableTo(c.widenTypeForVariableLikeDeclaration(initializerType, node, false), optionalDisposableType, initializer,
 * 						diagnostics.The_initializer_of_a_using_declaration_must_be_either_an_object_with_a_Symbol_dispose_method_or_be_null_or_undefined)
 * 				}
 * 			}
 * 		}
 * 		if len(symbol.Declarations) > 1 {
 * 			if core.Some(symbol.Declarations, func(d *ast.Declaration) bool {
 * 				return d != node && ast.IsVariableLike(d) && !c.areDeclarationFlagsIdentical(d, node)
 * 			}) {
 * 				c.error(name, diagnostics.All_declarations_of_0_must_have_identical_modifiers, scanner.DeclarationNameToString(name))
 * 			}
 * 		}
 * 	} else {
 * 		// Node is a secondary declaration, check that type is identical to primary declaration and check that
 * 		// initializer is consistent with type associated with the node
 * 		declarationType := c.convertAutoToAny(c.getWidenedTypeForVariableLikeDeclaration(node, false))
 * 		if !c.isErrorType(t) && !c.isErrorType(declarationType) && !c.isTypeIdenticalTo(t, declarationType) && symbol.Flags&ast.SymbolFlagsAssignment == 0 {
 * 			c.errorNextVariableOrPropertyDeclarationMustHaveSameType(symbol.ValueDeclaration, t, node, declarationType)
 * 		}
 * 		if initializer != nil {
 * 			c.checkTypeAssignableToAndOptionallyElaborate(c.checkExpressionCached(initializer), declarationType, node, initializer, nil /*headMessage* /, nil)
 * 		}
 * 		if symbol.ValueDeclaration != nil && !c.areDeclarationFlagsIdentical(node, symbol.ValueDeclaration) {
 * 			c.error(name, diagnostics.All_declarations_of_0_must_have_identical_modifiers, scanner.DeclarationNameToString(name))
 * 		}
 * 	}
 * 	if !ast.IsPropertyDeclaration(node) && !ast.IsPropertySignatureDeclaration(node) {
 * 		// We know we don't have a binding pattern or computed name here
 * 		c.checkExportsOnMergedDeclarations(node)
 * 		if ast.IsVariableDeclaration(node) || ast.IsBindingElement(node) {
 * 			c.checkVarDeclaredNamesNotShadowed(node)
 * 		}
 * 		c.checkCollisionsForDeclarationName(node, node.Name())
 * 	}
 * }
 */
export declare function Checker_checkVariableLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorNextVariableOrPropertyDeclarationMustHaveSameType","kind":"method","status":"implemented","sigHash":"ab5874dc849a0ce91a5e00637013bc9a9557034a2be752be3a50bf9f818a4e31","bodyHash":"959428a6ebc8dc5c74499e3f911a005a87941b65de7d91c380c4ecf3a4492ba8"}
 *
 * Go source:
 * func (c *Checker) errorNextVariableOrPropertyDeclarationMustHaveSameType(firstDeclaration *ast.Declaration, firstType *Type, nextDeclaration *ast.Declaration, nextType *Type) {
 * 	nextDeclarationName := ast.GetNameOfDeclaration(nextDeclaration)
 * 	message := core.IfElse(ast.IsPropertyDeclaration(nextDeclaration) || ast.IsPropertySignatureDeclaration(nextDeclaration),
 * 		diagnostics.Subsequent_property_declarations_must_have_the_same_type_Property_0_must_be_of_type_1_but_here_has_type_2,
 * 		diagnostics.Subsequent_variable_declarations_must_have_the_same_type_Variable_0_must_be_of_type_1_but_here_has_type_2)
 * 	declName := scanner.DeclarationNameToString(nextDeclarationName)
 * 	err := c.error(nextDeclarationName, message, declName, c.TypeToString(firstType), c.TypeToString(nextType))
 * 	if firstDeclaration != nil {
 * 		err.AddRelatedInfo(createDiagnosticForNode(firstDeclaration, diagnostics.X_0_was_also_declared_here, declName))
 * 	}
 * }
 */
export declare function Checker_errorNextVariableOrPropertyDeclarationMustHaveSameType(receiver: GoPtr<Checker>, firstDeclaration: GoPtr<Declaration>, firstType: GoPtr<Type>, nextDeclaration: GoPtr<Declaration>, nextType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkVarDeclaredNamesNotShadowed","kind":"method","status":"implemented","sigHash":"2c91800596362d236d4be72464a35d4512d682b7305aca6c72dd8740bd33a85f","bodyHash":"074288b1aed9cf234a3a77adfab0ff283feed0c0f40ea852ff05085ba8a28c2b"}
 *
 * Go source:
 * func (c *Checker) checkVarDeclaredNamesNotShadowed(node *ast.Node) {
 * 	// - ScriptBody : StatementList
 * 	// It is a Syntax Error if any element of the LexicallyDeclaredNames of StatementList
 * 	// also occurs in the VarDeclaredNames of StatementList.
 *
 * 	// - Block : { StatementList }
 * 	// It is a Syntax Error if any element of the LexicallyDeclaredNames of StatementList
 * 	// also occurs in the VarDeclaredNames of StatementList.
 *
 * 	// Variable declarations are hoisted to the top of their function scope. They can shadow
 * 	// block scoped declarations, which bind tighter. this will not be flagged as duplicate definition
 * 	// by the binder as the declaration scope is different.
 * 	// A non-initialized declaration is a no-op as the block declaration will resolve before the var
 * 	// declaration. the problem is if the declaration has an initializer. this will act as a write to the
 * 	// block declared value. this is fine for let, but not const.
 * 	// Only consider declarations with initializers, uninitialized const declarations will not
 * 	// step on a let/const variable.
 * 	// Do not consider const and const declarations, as duplicate block-scoped declarations
 * 	// are handled by the binder.
 * 	// We are only looking for const declarations that step on let\const declarations from a
 * 	// different scope. e.g.:
 * 	//      {
 * 	//          const x = 0; // localDeclarationSymbol obtained after name resolution will correspond to this declaration
 * 	//          const x = 0; // symbol for this declaration will be 'symbol'
 * 	//      }
 *
 * 	// skip block-scoped variables and parameters
 * 	if (c.getCombinedNodeFlagsCached(node)&ast.NodeFlagsBlockScoped) != 0 || ast.IsPartOfParameterDeclaration(node) {
 * 		return
 * 	}
 * 	// NOTE: in ES6 spec initializer is required in variable declarations where name is binding pattern
 * 	// so we'll always treat binding elements as initialized
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	name := node.Name()
 * 	if symbol.Flags&ast.SymbolFlagsFunctionScopedVariable != 0 {
 * 		if !ast.IsIdentifier(name) {
 * 			panic("Identifier expected")
 * 		}
 * 		localDeclarationSymbol := c.resolveName(node, name.Text(), ast.SymbolFlagsVariable, nil /*nameNotFoundMessage* /, false /*isUse* /, false)
 * 		if localDeclarationSymbol != nil && localDeclarationSymbol != symbol && localDeclarationSymbol.Flags&ast.SymbolFlagsBlockScopedVariable != 0 {
 * 			if c.getDeclarationNodeFlagsFromSymbol(localDeclarationSymbol)&ast.NodeFlagsBlockScoped != 0 {
 * 				varDeclList := ast.FindAncestorKind(localDeclarationSymbol.ValueDeclaration, ast.KindVariableDeclarationList)
 * 				var container *ast.Node
 * 				if ast.IsVariableStatement(varDeclList.Parent) && varDeclList.Parent.Parent != nil {
 * 					container = varDeclList.Parent.Parent
 * 				}
 * 				// names of block-scoped and function scoped variables can collide only
 * 				// if block scoped variable is defined in the function\module\source file scope (because of variable hoisting)
 * 				namesShareScope := container != nil && (ast.IsBlock(container) && ast.IsFunctionLike(container.Parent) ||
 * 					ast.IsModuleBlock(container) || ast.IsModuleDeclaration(container) || ast.IsSourceFile(container))
 * 				// here we know that function scoped variable is "shadowed" by block scoped one
 * 				// a var declaration can't hoist past a lexical declaration and it results in a SyntaxError at runtime
 * 				if !namesShareScope {
 * 					name := c.symbolToString(localDeclarationSymbol)
 * 					c.error(node, diagnostics.Cannot_initialize_outer_scoped_variable_0_in_the_same_scope_as_block_scoped_declaration_1, name, name)
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkVarDeclaredNamesNotShadowed(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAliasSymbol","kind":"method","status":"implemented","sigHash":"ffd3ccf791dfbd1ca1ccf67a95ead2d349f74c50ab3a30d31522ceeab317c87b","bodyHash":"66aa2dd021348cad9026f83e4d89a243458d0ae9a97f53db0d63b62bc8d38a94"}
 *
 * Go source:
 * func (c *Checker) checkAliasSymbol(node *ast.Node) {
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	target := c.resolveAlias(symbol)
 * 	if target == c.unknownSymbol {
 * 		return
 * 	}
 * 	// For external modules, `symbol` represents the local symbol for an alias.
 * 	// This local symbol will merge any other local declarations (excluding other aliases)
 * 	// and symbol.flags will contains combined representation for all merged declaration.
 * 	// Based on symbol.flags we can compute a set of excluded meanings (meaning that resolved alias should not have,
 * 	// otherwise it will conflict with some local declaration). Note that in addition to normal flags we include matching SymbolFlags.Export*
 * 	// in order to prevent collisions with declarations that were exported from the current module (they still contribute to local names).
 * 	symbol = c.getMergedSymbol(core.OrElse(symbol.ExportSymbol, symbol))
 * 	targetFlags := c.getSymbolFlags(target)
 * 	// A type-only import/export will already have a grammar error in a JS file, so no need to issue more errors within
 * 	if ast.IsInJSFile(node) && targetFlags&ast.SymbolFlagsValue == 0 && !ast.IsTypeOnlyImportOrExportDeclaration(node) {
 * 		errorNode := core.OrElse(node.PropertyNameOrName(), node)
 * 		debug.Assert(node.Kind != ast.KindNamespaceExport)
 * 		if ast.IsExportSpecifier(node) {
 * 			diag := c.error(errorNode, diagnostics.Types_cannot_appear_in_export_declarations_in_JavaScript_files)
 * 			if sourceSymbol := ast.GetSourceFileOfNode(node).AsNode().Symbol(); sourceSymbol != nil {
 * 				if alreadyExportedSymbol := sourceSymbol.Exports[node.PropertyNameOrName().Text()]; alreadyExportedSymbol == target {
 * 					if exportingDeclaration := core.Find(alreadyExportedSymbol.Declarations, ast.IsJSTypeAliasDeclaration); exportingDeclaration != nil {
 * 						diag.AddRelatedInfo(NewDiagnosticForNode(exportingDeclaration, diagnostics.X_0_is_automatically_exported_here, alreadyExportedSymbol.Name))
 * 					}
 * 				}
 * 			}
 * 		} else {
 * 			identifierText := symbol.Name
 * 			if ast.IsIdentifier(errorNode) {
 * 				identifierText = errorNode.Text()
 * 			}
 * 			specifierText := "..."
 * 			if importDeclaration := ast.FindAncestor(node, func(n *ast.Node) bool {
 * 				return ast.IsImportOrImportEqualsDeclaration(n) || ast.IsVariableDeclaration(n)
 * 			}); importDeclaration != nil {
 * 				if moduleSpecifier := TryGetModuleSpecifierFromDeclaration(importDeclaration); moduleSpecifier != nil {
 * 					specifierText = moduleSpecifier.Text()
 * 				}
 * 			}
 * 			importText := "import(\"" + specifierText + "\")"
 * 			if ast.IsImportSpecifier(node) {
 * 				importText = importText + "." + identifierText
 * 			}
 * 			c.error(errorNode, diagnostics.X_0_is_a_type_and_cannot_be_imported_in_JavaScript_files_Use_1_in_a_JSDoc_type_annotation, identifierText, importText)
 * 		}
 * 		return
 * 	}
 * 	excludedMeanings := core.IfElse(symbol.Flags&(ast.SymbolFlagsValue|ast.SymbolFlagsExportValue) != 0, ast.SymbolFlagsValue, 0) |
 * 		core.IfElse(symbol.Flags&ast.SymbolFlagsType != 0, ast.SymbolFlagsType, 0) |
 * 		core.IfElse(symbol.Flags&ast.SymbolFlagsNamespace != 0, ast.SymbolFlagsNamespace, 0)
 * 	if targetFlags&excludedMeanings != 0 {
 * 		message := core.IfElse(ast.IsExportSpecifier(node),
 * 			diagnostics.Export_declaration_conflicts_with_exported_declaration_of_0,
 * 			diagnostics.Import_declaration_conflicts_with_local_declaration_of_0)
 * 		c.error(node, message, c.symbolToString(symbol))
 * 	} else if !ast.IsExportSpecifier(node) {
 * 		// Look at 'compilerOptions.isolatedModules' and not 'getIsolatedModules(...)' (which considers 'verbatimModuleSyntax')
 * 		// here because 'verbatimModuleSyntax' will already have an error for importing a type without 'import type'.
 * 		appearsValueyToTranspiler := c.compilerOptions.IsolatedModules.IsTrue() && ast.FindAncestor(node, ast.IsTypeOnlyImportOrExportDeclaration) == nil
 * 		if appearsValueyToTranspiler && symbol.Flags&(ast.SymbolFlagsValue|ast.SymbolFlagsExportValue) != 0 {
 * 			c.error(node, diagnostics.Import_0_conflicts_with_local_value_so_must_be_declared_with_a_type_only_import_when_isolatedModules_is_enabled, c.symbolToString(symbol), c.getIsolatedModulesLikeFlagName())
 * 		}
 * 	}
 * 	if c.compilerOptions.GetIsolatedModules() && !ast.IsTypeOnlyImportOrExportDeclaration(node) && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		typeOnlyAlias := c.getTypeOnlyAliasDeclaration(symbol)
 * 		isType := targetFlags&ast.SymbolFlagsValue == 0
 * 		if isType || typeOnlyAlias != nil {
 * 			switch node.Kind {
 * 			case ast.KindImportClause, ast.KindImportSpecifier, ast.KindImportEqualsDeclaration:
 * 				if c.compilerOptions.VerbatimModuleSyntax.IsTrue() {
 * 					debug.Assert(node.Name() != nil, "An ImportClause with a symbol should have a name")
 * 					var message *diagnostics.Message
 * 					switch {
 * 					case c.compilerOptions.VerbatimModuleSyntax.IsTrue() && ast.IsInternalModuleImportEqualsDeclaration(node):
 * 						message = diagnostics.An_import_alias_cannot_resolve_to_a_type_or_type_only_declaration_when_verbatimModuleSyntax_is_enabled
 * 					case isType:
 * 						message = diagnostics.X_0_is_a_type_and_must_be_imported_using_a_type_only_import_when_verbatimModuleSyntax_is_enabled
 * 					default:
 * 						message = diagnostics.X_0_resolves_to_a_type_only_declaration_and_must_be_imported_using_a_type_only_import_when_verbatimModuleSyntax_is_enabled
 * 					}
 * 					name := node.PropertyNameOrName().Text()
 * 					c.addTypeOnlyDeclarationRelatedInfo(c.error(node, message, name), core.IfElse(isType, nil, typeOnlyAlias), name)
 * 				}
 * 				if isType && node.Kind == ast.KindImportEqualsDeclaration && ast.HasModifier(node, ast.ModifierFlagsExport) {
 * 					c.error(node, diagnostics.Cannot_use_export_import_on_a_type_or_type_only_namespace_when_0_is_enabled, c.getIsolatedModulesLikeFlagName())
 * 				}
 * 			case ast.KindExportSpecifier:
 * 				// Don't allow re-exporting an export that will be elided when `--isolatedModules` is set.
 * 				// The exception is that `import type { A } from './a'; export { A }` is allowed
 * 				// because single-file analysis can determine that the export should be dropped.
 * 				if c.compilerOptions.VerbatimModuleSyntax.IsTrue() || ast.GetSourceFileOfNode(typeOnlyAlias) != ast.GetSourceFileOfNode(node) {
 * 					name := node.PropertyNameOrName().Text()
 * 					var diagnostic *ast.Diagnostic
 * 					if isType {
 * 						diagnostic = c.error(node, diagnostics.Re_exporting_a_type_when_0_is_enabled_requires_using_export_type, c.getIsolatedModulesLikeFlagName())
 * 					} else {
 * 						diagnostic = c.error(node, diagnostics.X_0_resolves_to_a_type_only_declaration_and_must_be_re_exported_using_a_type_only_re_export_when_1_is_enabled, name, c.getIsolatedModulesLikeFlagName())
 * 					}
 * 					c.addTypeOnlyDeclarationRelatedInfo(diagnostic, core.IfElse(isType, nil, typeOnlyAlias), name)
 * 				}
 * 			}
 * 		}
 * 		if c.compilerOptions.VerbatimModuleSyntax.IsTrue() && !ast.IsImportEqualsDeclaration(node) && !ast.IsInJSFile(node) && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 			c.error(node, getVerbatimModuleSyntaxErrorMessage(node))
 * 		} else if c.moduleKind == core.ModuleKindPreserve && !ast.IsImportEqualsDeclaration(node) && !ast.IsVariableDeclaration(node) && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 			// In `--module preserve`, ESM input syntax emits ESM output syntax, but there will be times
 * 			// when we look at the `impliedNodeFormat` of this file and decide it's CommonJS (i.e., currently,
 * 			// only if the file extension is .cjs/.cts). To avoid that inconsistency, we disallow ESM syntax
 * 			// in files that are unambiguously CommonJS in this mode.
 * 			c.error(node, diagnostics.ECMAScript_module_syntax_is_not_allowed_in_a_CommonJS_module_when_module_is_set_to_preserve)
 * 		}
 * 		if c.compilerOptions.VerbatimModuleSyntax.IsTrue() && !ast.IsTypeOnlyImportOrExportDeclaration(node) && node.Flags&ast.NodeFlagsAmbient == 0 && targetFlags&ast.SymbolFlagsConstEnum != 0 {
 * 			constEnumDeclaration := target.ValueDeclaration
 * 			redirect := c.program.GetProjectReferenceFromOutputDts(ast.GetSourceFileOfNode(constEnumDeclaration).Path())
 * 			if constEnumDeclaration.Flags&ast.NodeFlagsAmbient != 0 && (redirect == nil || !redirect.Resolved.CompilerOptions().ShouldPreserveConstEnums()) {
 * 				c.error(node, diagnostics.Cannot_access_ambient_const_enums_when_0_is_enabled, c.getIsolatedModulesLikeFlagName())
 * 			}
 * 		}
 * 	}
 * 	if ast.IsImportSpecifier(node) {
 * 		targetSymbol := c.resolveAliasWithDeprecationCheck(symbol, node)
 * 		if c.isDeprecatedSymbol(targetSymbol) && targetSymbol.Declarations != nil {
 * 			c.addDeprecatedSuggestion(node, targetSymbol.Declarations, targetSymbol.Name)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkAliasSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeAliasDeclaration","kind":"method","status":"implemented","sigHash":"74c2202d1aa04d423ee48acbbf3e437a6e7296220a6db631ff8bf01a5fd32f01","bodyHash":"69c334d72e8d0a5fd06d01155859b178cf653c35c94e7a2da4b703419edb6932"}
 *
 * Go source:
 * func (c *Checker) checkTypeAliasDeclaration(node *ast.Node) {
 * 	// Grammar checking
 * 	c.checkGrammarModifiers(node)
 * 	c.checkTypeNameIsReserved(node.Name(), diagnostics.Type_alias_name_cannot_be_0)
 * 	if !c.containerAllowsBlockScopedVariable(node.Parent) {
 * 		c.grammarErrorOnNode(node, diagnostics.X_0_declarations_can_only_be_declared_inside_a_block, "type")
 * 	}
 * 	c.checkExportsOnMergedDeclarations(node)
 *
 * 	typeNode := node.Type()
 * 	typeParameters := node.TypeParameters()
 * 	c.checkTypeParameters(typeParameters)
 * 	if typeNode != nil && typeNode.Kind == ast.KindIntrinsicKeyword {
 * 		if !(len(typeParameters) == 0 && node.Name().Text() == "BuiltinIteratorReturn" ||
 * 			len(typeParameters) == 1 && intrinsicTypeKinds[node.Name().Text()] != IntrinsicTypeKindUnknown) {
 * 			c.error(typeNode, diagnostics.The_intrinsic_keyword_can_only_be_used_to_declare_compiler_provided_intrinsic_types)
 * 		}
 * 		return
 * 	}
 * 	c.checkSourceElement(typeNode)
 * 	c.registerForUnusedIdentifiersCheck(node)
 * }
 */
export declare function Checker_checkTypeAliasDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeNameIsReserved","kind":"method","status":"implemented","sigHash":"2789e00e8f6306c33dac399504a9c880fdaecc6551523c7bcd3f4d09945ee10f","bodyHash":"f48d8525c0a3f6e5691a005be7b786d27caba575ed5faec11bf392ad016047c6"}
 *
 * Go source:
 * func (c *Checker) checkTypeNameIsReserved(name *ast.Node, message *diagnostics.Message) {
 * 	// TS 1.0 spec (April 2014): 3.6.1
 * 	// The predefined type keywords are reserved and cannot be used as names of user defined types.
 * 	switch name.Text() {
 * 	case "any", "unknown", "never", "number", "bigint", "boolean", "string", "symbol", "void", "object", "undefined":
 * 		c.error(name, message, name.Text())
 * 	}
 * }
 */
export declare function Checker_checkTypeNameIsReserved(receiver: GoPtr<Checker>, name: GoPtr<Node>, message: GoPtr<Message>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExportsOnMergedDeclarations","kind":"method","status":"implemented","sigHash":"6601e4c7a10f8cd087c6210d64becd61b75972945e21fec00aa89dda2529233a","bodyHash":"b41c85f8c866e83ce2b34aed7a45302abc9997d82d6cb9df09cb60f1e12b528c"}
 *
 * Go source:
 * func (c *Checker) checkExportsOnMergedDeclarations(node *ast.Node) {
 * 	// If localSymbol is defined on node then node itself is exported - check is required.
 * 	symbol := node.LocalSymbol()
 * 	if symbol == nil {
 * 		// Local symbol is undefined => this declaration is non-exported.
 * 		// However, symbol might contain other declarations that are exported.
 * 		symbol = c.getSymbolOfDeclaration(node)
 * 		if symbol.ExportSymbol == nil {
 * 			// This is a pure local symbol (all declarations are non-exported) - no need to check anything.
 * 			return
 * 		}
 * 	}
 * 	// Run the check only for the first declaration in the list.
 * 	if ast.GetDeclarationOfKind(symbol, node.Kind) != node {
 * 		return
 * 	}
 * 	exportedDeclarationSpaces := DeclarationSpacesNone
 * 	nonExportedDeclarationSpaces := DeclarationSpacesNone
 * 	defaultExportedDeclarationSpaces := DeclarationSpacesNone
 * 	for _, d := range symbol.Declarations {
 * 		declarationSpaces := c.getDeclarationSpaces(d)
 * 		effectiveDeclarationFlags := c.getEffectiveDeclarationFlags(d, ast.ModifierFlagsExport|ast.ModifierFlagsDefault)
 * 		if effectiveDeclarationFlags&ast.ModifierFlagsExport != 0 {
 * 			if effectiveDeclarationFlags&ast.ModifierFlagsDefault != 0 {
 * 				defaultExportedDeclarationSpaces |= declarationSpaces
 * 			} else {
 * 				exportedDeclarationSpaces |= declarationSpaces
 * 			}
 * 		} else {
 * 			nonExportedDeclarationSpaces |= declarationSpaces
 * 		}
 * 	}
 * 	// Spaces for anything not declared a 'default export'.
 * 	nonDefaultExportedDeclarationSpaces := exportedDeclarationSpaces | nonExportedDeclarationSpaces
 * 	commonDeclarationSpacesForExportsAndLocals := exportedDeclarationSpaces & nonExportedDeclarationSpaces
 * 	commonDeclarationSpacesForDefaultAndNonDefault := defaultExportedDeclarationSpaces & nonDefaultExportedDeclarationSpaces
 * 	if commonDeclarationSpacesForExportsAndLocals != 0 || commonDeclarationSpacesForDefaultAndNonDefault != 0 {
 * 		// declaration spaces for exported and non-exported declarations intersect
 * 		for _, d := range symbol.Declarations {
 * 			declarationSpaces := c.getDeclarationSpaces(d)
 * 			name := ast.GetNameOfDeclaration(d)
 * 			// Only error on the declarations that contributed to the intersecting spaces.
 * 			if declarationSpaces&commonDeclarationSpacesForDefaultAndNonDefault != 0 {
 * 				c.error(name, diagnostics.Merged_declaration_0_cannot_include_a_default_export_declaration_Consider_adding_a_separate_export_default_0_declaration_instead, scanner.DeclarationNameToString(name))
 * 			} else if declarationSpaces&commonDeclarationSpacesForExportsAndLocals != 0 {
 * 				c.error(name, diagnostics.Individual_declarations_in_merged_declaration_0_must_be_all_exported_or_all_local, scanner.DeclarationNameToString(name))
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkExportsOnMergedDeclarations(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclarationSpaces","kind":"method","status":"implemented","sigHash":"a377e6b144b9a7a090f71fbac74ec07eb832385feed2e47cfe4407c0aac4419f","bodyHash":"a119e693213bfd3b31764e6c1200a3c2256f913bb88c704cb30d8f8b17e667e9"}
 *
 * Go source:
 * func (c *Checker) getDeclarationSpaces(node *ast.Declaration) DeclarationSpaces {
 * 	switch node.Kind {
 * 	case ast.KindInterfaceDeclaration, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindJSDocTypedefTag, ast.KindJSDocCallbackTag:
 * 		return DeclarationSpacesExportType
 * 	case ast.KindModuleDeclaration:
 * 		if ast.IsAmbientModule(node) || ast.GetModuleInstanceState(node) != ast.ModuleInstanceStateNonInstantiated {
 * 			return DeclarationSpacesExportNamespace | DeclarationSpacesExportValue
 * 		}
 * 		return DeclarationSpacesExportNamespace
 * 	case ast.KindClassDeclaration, ast.KindEnumDeclaration, ast.KindEnumMember:
 * 		return DeclarationSpacesExportType | DeclarationSpacesExportValue
 * 	case ast.KindSourceFile:
 * 		return DeclarationSpacesExportType | DeclarationSpacesExportValue | DeclarationSpacesExportNamespace
 * 	case ast.KindExportAssignment, ast.KindBinaryExpression:
 * 		var expression *ast.Node
 * 		if ast.IsExportAssignment(node) {
 * 			expression = node.Expression()
 * 		} else {
 * 			expression = node.AsBinaryExpression().Right
 * 		}
 * 		// Export assigned entity name expressions act as aliases and should fall through, otherwise they export values.
 * 		if !ast.IsEntityNameExpression(expression) || c.getSymbolOfDeclaration(node).Flags&ast.SymbolFlagsAlias == 0 {
 * 			return DeclarationSpacesExportValue
 * 		}
 * 		// The below options all declare an Alias, which is allowed to merge with other values within the importing module.
 * 		fallthrough
 * 	case ast.KindImportEqualsDeclaration, ast.KindNamespaceImport, ast.KindImportClause:
 * 		result := DeclarationSpacesNone
 * 		target := c.resolveAlias(c.getSymbolOfDeclaration(node))
 * 		for _, d := range target.Declarations {
 * 			result |= c.getDeclarationSpaces(d)
 * 		}
 * 		return result
 * 	case ast.KindVariableDeclaration, ast.KindBindingElement, ast.KindFunctionDeclaration, ast.KindImportSpecifier:
 * 		return DeclarationSpacesExportValue
 * 	case ast.KindMethodSignature, ast.KindPropertySignature:
 * 		return DeclarationSpacesExportType
 * 	}
 * 	panic("Unhandled case in getDeclarationSpaces: " + node.Kind.String())
 * }
 */
export declare function Checker_getDeclarationSpaces(receiver: GoPtr<Checker>, node: GoPtr<Declaration>): DeclarationSpaces;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.registerForUnusedIdentifiersCheck","kind":"method","status":"implemented","sigHash":"8a9fd4ba917bf07e0ca5642c6be33210431d826d1b866471b64e63323e3f325e","bodyHash":"20db2779c8ba7fc431f2604620517a534f22985c2ab656a44bc04ed68ab72ffd"}
 *
 * Go source:
 * func (c *Checker) registerForUnusedIdentifiersCheck(node *ast.Node) {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	links := c.sourceFileLinks.Get(sourceFile)
 * 	links.identifierCheckNodes = append(links.identifierCheckNodes, node)
 * }
 */
export declare function Checker_registerForUnusedIdentifiersCheck(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedIdentifiers","kind":"method","status":"implemented","sigHash":"edf22db51bc932be2dd4053913074e054b67e6031f36b34807edecc32b77fecd","bodyHash":"21a9d35d9d2ff1bc7a0675e1340c317742cc51efdba9634c87fab19abcab3ac1"}
 *
 * Go source:
 * func (c *Checker) checkUnusedIdentifiers(potentiallyUnusedIdentifiers []*ast.Node) {
 * 	for _, node := range potentiallyUnusedIdentifiers {
 * 		switch node.Kind {
 * 		case ast.KindClassDeclaration, ast.KindClassExpression:
 * 			c.checkUnusedClassMembers(node)
 * 			c.checkUnusedTypeParameters(node)
 * 		case ast.KindSourceFile, ast.KindModuleDeclaration, ast.KindBlock, ast.KindCaseBlock, ast.KindForStatement, ast.KindForInStatement,
 * 			ast.KindForOfStatement:
 * 			c.checkUnusedLocalsAndParameters(node)
 * 		case ast.KindConstructor, ast.KindFunctionExpression, ast.KindFunctionDeclaration, ast.KindArrowFunction, ast.KindMethodDeclaration,
 * 			ast.KindGetAccessor, ast.KindSetAccessor:
 * 			// Only report unused parameters on the implementation, not overloads.
 * 			if node.Body() != nil {
 * 				c.checkUnusedLocalsAndParameters(node)
 * 			}
 * 			c.checkUnusedTypeParameters(node)
 * 		case ast.KindMethodSignature, ast.KindCallSignature, ast.KindConstructSignature, ast.KindFunctionType, ast.KindConstructorType,
 * 			ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindInterfaceDeclaration:
 * 			c.checkUnusedTypeParameters(node)
 * 		case ast.KindInferType:
 * 			c.checkUnusedInferTypeParameter(node)
 * 		default:
 * 			panic("Unhandled case in checkUnusedIdentifiers")
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkUnusedIdentifiers(receiver: GoPtr<Checker>, potentiallyUnusedIdentifiers: GoSlice<GoPtr<Node>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedClassMembers","kind":"method","status":"implemented","sigHash":"866227c2d30d954d6d7dfc5a60d9c662e5a0b49239a3c1ee7d6f6a0ceda211bc","bodyHash":"ac76dc9404b57956790bc2746b2175b09d35dfa03d67409f07fd890e0ffe3fb1"}
 *
 * Go source:
 * func (c *Checker) checkUnusedClassMembers(node *ast.Node) {
 * 	for _, member := range node.Members() {
 * 		switch member.Kind {
 * 		case ast.KindMethodDeclaration, ast.KindPropertyDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 			if ast.IsSetAccessorDeclaration(member) && member.Symbol().Flags&ast.SymbolFlagsGetAccessor != 0 {
 * 				break // Already would have reported an error on the getter.
 * 			}
 * 			symbol := c.getSymbolOfDeclaration(member)
 * 			if !c.isReferenced(symbol) && (ast.HasModifier(member, ast.ModifierFlagsPrivate) || member.Name() != nil && ast.IsPrivateIdentifier(member.Name())) && member.Flags&ast.NodeFlagsAmbient == 0 {
 * 				c.reportUnused(member, UnusedKindLocal, NewDiagnosticForNode(member.Name(), diagnostics.X_0_is_declared_but_its_value_is_never_read, c.symbolToString(symbol)))
 * 			}
 * 		case ast.KindConstructor:
 * 			for _, parameter := range member.AsConstructorDeclaration().Parameters.Nodes {
 * 				if !c.isReferenced(parameter.Symbol()) && ast.HasSyntacticModifier(parameter, ast.ModifierFlagsPrivate) {
 * 					c.reportUnused(parameter, UnusedKindLocal, NewDiagnosticForNode(parameter.Name(), diagnostics.Property_0_is_declared_but_its_value_is_never_read, ast.SymbolName(parameter.Symbol())))
 * 				}
 * 			}
 * 		case ast.KindIndexSignature, ast.KindSemicolonClassElement, ast.KindClassStaticBlockDeclaration, ast.KindJSTypeAliasDeclaration:
 * 			// Can't be private
 * 		default:
 * 			panic("Unhandled case in checkUnusedClassMembers")
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkUnusedClassMembers(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedLocal","kind":"method","status":"implemented","sigHash":"c9ba0acf509a9870dfcfad0c4c4df5daed431ab3894d96dbd2338e0e3525cde8","bodyHash":"b42bab690af21fb8c19430fffe911c5b32081518abe3395787fb26201fb6b9f3"}
 *
 * Go source:
 * func (c *Checker) reportUnusedLocal(node *ast.Node, name string) {
 * 	message := core.IfElse(ast.IsTypeDeclaration(node), diagnostics.X_0_is_declared_but_never_used, diagnostics.X_0_is_declared_but_its_value_is_never_read)
 * 	c.reportUnused(node, UnusedKindLocal, NewDiagnosticForNode(core.OrElse(node.Name(), node), message, name))
 * }
 */
export declare function Checker_reportUnusedLocal(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedVariableDeclarations","kind":"method","status":"implemented","sigHash":"335a9b64636a3d3648fe2a6657a6aba495b1cffea82f10d4086b6b8513ab251d","bodyHash":"0a993712199ab42fc5ebed77b32e80995b8b859ae668f3c4bebb186ce5563384"}
 *
 * Go source:
 * func (c *Checker) reportUnusedVariableDeclarations(declarations []*ast.Node) {
 * 	for _, declaration := range declarations {
 * 		name := declaration.Name()
 * 		if name != nil && !ast.IsParameterPropertyDeclaration(declaration, declaration.Parent) && !ast.IsThisParameter(declaration) {
 * 			if ast.IsBindingPattern(name) {
 * 				c.reportUnusedBindingElements(name)
 * 			} else if c.isUnreferencedVariableDeclaration(declaration) {
 * 				c.reportUnusedVariable(declaration, NewDiagnosticForNode(name, diagnostics.X_0_is_declared_but_its_value_is_never_read, name.Text()))
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_reportUnusedVariableDeclarations(receiver: GoPtr<Checker>, declarations: GoSlice<GoPtr<Node>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUnreferencedVariableDeclaration","kind":"method","status":"implemented","sigHash":"a1bc293f64ee0137ed663553e12a7906d55818082d5991f61aea50001ebe8010","bodyHash":"bcb162e3602463ab755f2d668975ce03d56bde333b35c3b53d848bf3c572e418"}
 *
 * Go source:
 * func (c *Checker) isUnreferencedVariableDeclaration(node *ast.Node) bool {
 * 	name := node.Name()
 * 	if name == nil {
 * 		return true
 * 	}
 * 	if ast.IsBindingPattern(name) {
 * 		return core.Every(node.Name().Elements(), c.isUnreferencedVariableDeclaration)
 * 	}
 * 	if c.symbolReferenceLinks.Get(c.getSymbolOfDeclaration(node)).referenceKinds&ast.SymbolFlagsVariable != 0 {
 * 		return false
 * 	}
 * 	if ast.IsBindingElement(node) && ast.IsObjectBindingPattern(node.Parent) {
 * 		// In `{ a, ...b }, `a` is considered used since it removes a property from `b`. `b` may still be unused though.
 * 		lastElement := core.LastOrNil(node.Parent.Elements())
 * 		if node != lastElement && hasDotDotDotToken(lastElement) {
 * 			return false
 * 		}
 * 	}
 * 	if (ast.IsParameterDeclaration(node) ||
 * 		ast.IsVariableDeclaration(node) && (ast.IsForInOrOfStatement(node.Parent.Parent) || c.getCombinedNodeFlagsCached(node)&ast.NodeFlagsUsing != 0) ||
 * 		ast.IsBindingElement(node) && !(ast.IsObjectBindingPattern(node.Parent) && node.PropertyName() == nil)) &&
 * 		isIdentifierThatStartsWithUnderscore(name) {
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function Checker_isUnreferencedVariableDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedImports","kind":"method","status":"implemented","sigHash":"2ab6c60bdf8b4cdcee2f4cdf7bcff0fe0cd1e0a7f18616f98a7d4cb7c709f7dc","bodyHash":"67df61bc53c836ac17fadef12bde0ec82333eb6b6248d9d053dfc4ef70e2b969"}
 *
 * Go source:
 * func (c *Checker) reportUnusedImports(node *ast.Node, unuseds []*ast.Node) {
 * 	declarationCount := core.IfElse(node.Name() != nil, 1, 0)
 * 	namedBindings := node.AsImportClause().NamedBindings
 * 	if namedBindings != nil {
 * 		if ast.IsNamespaceImport(namedBindings) {
 * 			declarationCount++
 * 		} else {
 * 			declarationCount += len(namedBindings.Elements())
 * 		}
 * 	}
 * 	if declarationCount > 1 && declarationCount == len(unuseds) {
 * 		c.reportUnused(node, UnusedKindLocal, NewDiagnosticForNode(node.Parent, diagnostics.All_imports_in_import_declaration_are_unused))
 * 	} else {
 * 		for _, unused := range unuseds {
 * 			c.reportUnusedLocal(unused, unused.Name().Text())
 * 		}
 * 	}
 * }
 */
export declare function Checker_reportUnusedImports(receiver: GoPtr<Checker>, node: GoPtr<Node>, unuseds: GoSlice<GoPtr<Node>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPrivateIdentifierExpression","kind":"method","status":"implemented","sigHash":"17a29deecd9561130cb7e63bcdc450429ac86104212e8c2e5d14afa8574a7422","bodyHash":"13b2a070f643abd46987979fd2fcdac3aa076ab9354cfe6896eccf925a35382d"}
 *
 * Go source:
 * func (c *Checker) checkPrivateIdentifierExpression(node *ast.Node) *Type {
 * 	c.checkGrammarPrivateIdentifierExpression(node.AsPrivateIdentifier())
 * 	symbol := c.getSymbolForPrivateIdentifierExpression(node)
 * 	if symbol != nil {
 * 		c.markPropertyAsReferenced(symbol, nil /*nodeForCheckWriteOnly* /, false /*isSelfTypeAccess* /)
 * 	}
 * 	return c.anyType
 * }
 */
export declare function Checker_checkPrivateIdentifierExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolForPrivateIdentifierExpression","kind":"method","status":"implemented","sigHash":"6398f24f5f54d05be28b5db26e7bd71d9bbf66de127c821934c342c3d0b30e07","bodyHash":"ae409da80ac1f0b9d737d727b22d92d84d0bae326b144042b0d9dfb4d37a8b89"}
 *
 * Go source:
 * func (c *Checker) getSymbolForPrivateIdentifierExpression(node *ast.Node) *ast.Symbol {
 * 	links := c.symbolNodeLinks.Get(node)
 * 	if links.resolvedSymbol == nil {
 * 		links.resolvedSymbol = c.lookupSymbolForPrivateIdentifierDeclaration(node.Text(), node)
 * 	}
 * 	return links.resolvedSymbol
 * }
 */
export declare function Checker_getSymbolForPrivateIdentifierExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkQualifiedName","kind":"method","status":"implemented","sigHash":"0f29ca6d9cedc439804cc0df55d060e7d8d91f1eb78d085315121c63d9c07ea1","bodyHash":"bea21d8ef83c0f8419fec2d8796112940615c84f478f23fb3da23fef68f00790"}
 *
 * Go source:
 * func (c *Checker) checkQualifiedName(node *ast.Node, checkMode CheckMode) *Type {
 * 	left := node.AsQualifiedName().Left
 * 	var leftType *Type
 * 	if ast.IsPartOfTypeQuery(node) && ast.IsThisIdentifier(left) {
 * 		leftType = c.checkNonNullType(c.checkThisExpression(left), left)
 * 	} else {
 * 		leftType = c.checkNonNullExpression(left)
 * 	}
 * 	return c.checkPropertyAccessExpressionOrQualifiedName(node, left, leftType, node.AsQualifiedName().Right, checkMode, false)
 * }
 */
export declare function Checker_checkQualifiedName(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexedAccess","kind":"method","status":"implemented","sigHash":"32fa0a002cb05468dc7def68493137d7aedba03aeb689f7a70ba4ca9a71ad6b7","bodyHash":"889b5dc89357c094a4d04e010b1e12026e834b898e2ef917803c8abceca31716"}
 *
 * Go source:
 * func (c *Checker) checkIndexedAccess(node *ast.Node, checkMode CheckMode) *Type {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return c.checkElementAccessChain(node, checkMode)
 * 	}
 * 	return c.checkElementAccessExpression(node, c.checkNonNullExpression(node.Expression()), checkMode)
 * }
 */
export declare function Checker_checkIndexedAccess(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkElementAccessChain","kind":"method","status":"implemented","sigHash":"87c91ac1dd6b496bfe2958fdb3dd1e0df6978e08f1f8ab4c9f61519478895348","bodyHash":"16ff9421739abc3918fc26481c0c7b7e280cd0bb97dbb046bbd9febfbfd2f23b"}
 *
 * Go source:
 * func (c *Checker) checkElementAccessChain(node *ast.Node, checkMode CheckMode) *Type {
 * 	exprType := c.checkExpression(node.Expression())
 * 	nonOptionalType := c.getOptionalExpressionType(exprType, node.Expression())
 * 	return c.propagateOptionalTypeMarker(c.checkElementAccessExpression(node, c.checkNonNullType(nonOptionalType, node.Expression()), checkMode), node, nonOptionalType != exprType)
 * }
 */
export declare function Checker_checkElementAccessChain(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkElementAccessExpression","kind":"method","status":"implemented","sigHash":"2f39be35c54aa297aa6da29e087ef31836844e9c96d08ac4a5d6679bc793bbda","bodyHash":"11932af46c7b11e3fd365479ad08c039f5afd3b81ae23f567ec842c2f141ef7e"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go element selection has resolved the effective receiver, selected symbol, and result type, extension-enabled programs record that exact evidence, including a fixed tuple ordinal when every selected receiver constituent proves it."}
 *
 * Go source:
 * func (c *Checker) checkElementAccessExpression(node *ast.Node, exprType *Type, checkMode CheckMode) *Type {
 * 	objectType := exprType
 * 	if getAssignmentTargetKind(node) != AssignmentKindNone || c.isMethodAccessForCall(node) {
 * 		objectType = c.getWidenedType(objectType)
 * 	}
 * 	indexExpression := node.AsElementAccessExpression().ArgumentExpression
 * 	indexType := c.checkExpression(indexExpression)
 * 	if c.isErrorType(objectType) || objectType == c.silentNeverType {
 * 		return objectType
 * 	}
 * 	if isConstEnumObjectType(objectType) && !ast.IsStringLiteralLike(indexExpression) {
 * 		c.error(indexExpression, diagnostics.A_const_enum_member_can_only_be_accessed_using_a_string_literal)
 * 		return c.errorType
 * 	}
 * 	effectiveIndexType := indexType
 * 	if c.isForInVariableForNumericPropertyNames(indexExpression) {
 * 		effectiveIndexType = c.numberType
 * 	}
 * 	assignmentTargetKind := getAssignmentTargetKind(node)
 * 	var accessFlags AccessFlags
 * 	if assignmentTargetKind == AssignmentKindNone {
 * 		accessFlags = AccessFlagsExpressionPosition
 * 	} else {
 * 		accessFlags = AccessFlagsWriting |
 * 			core.IfElse(assignmentTargetKind == AssignmentKindCompound, AccessFlagsExpressionPosition, 0) |
 * 			core.IfElse(c.isGenericObjectType(objectType) && !isThisTypeParameter(objectType), AccessFlagsNoIndexSignatures, 0)
 * 	}
 * 	indexedAccessType := core.OrElse(c.getIndexedAccessTypeOrUndefined(objectType, effectiveIndexType, accessFlags, node, nil), c.errorType)
 * 	return c.checkIndexedAccessIndexType(c.getFlowTypeOfAccessExpression(node, c.getResolvedSymbolOrNil(node), indexedAccessType, indexExpression, checkMode), node)
 * }
 */
export declare function Checker_checkElementAccessExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, exprType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isForInVariableForNumericPropertyNames","kind":"method","status":"implemented","sigHash":"82601ddae714cee228e98f32cf1c7a1dcce43471aea4e3478c9359c3c4816f2b","bodyHash":"070ed4e5c450a954fbbde2e6c60a694dd5c1766d496995219eed7571ac56ec18"}
 *
 * Go source:
 * func (c *Checker) isForInVariableForNumericPropertyNames(expr *ast.Node) bool {
 * 	e := ast.SkipParentheses(expr)
 * 	if ast.IsIdentifier(e) {
 * 		symbol := c.getResolvedSymbol(e)
 * 		if symbol.Flags&ast.SymbolFlagsVariable != 0 {
 * 			child := expr
 * 			node := expr.Parent
 * 			for node != nil {
 * 				if ast.IsForInStatement(node) && child == node.AsForInOrOfStatement().Statement && c.getForInVariableSymbol(node) == symbol && c.hasNumericPropertyNames(c.getTypeOfExpression(node.Expression())) {
 * 					return true
 * 				}
 * 				child = node
 * 				node = node.Parent
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isForInVariableForNumericPropertyNames(receiver: GoPtr<Checker>, expr: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getForInVariableSymbol","kind":"method","status":"implemented","sigHash":"6b49654af380fa5a66234cfc89739f5b03efd373ecfb89371d57b51748140440","bodyHash":"0c935ad9acbd1980f02462349553014ee29173c9fd832a01f35bf2df4502b586"}
 *
 * Go source:
 * func (c *Checker) getForInVariableSymbol(node *ast.Node) *ast.Symbol {
 * 	initializer := node.Initializer()
 * 	if ast.IsVariableDeclarationList(initializer) {
 * 		declarations := initializer.AsVariableDeclarationList().Declarations.Nodes
 * 		if len(declarations) > 0 {
 * 			variable := declarations[0]
 * 			if variable != nil && !ast.IsBindingPattern(variable.Name()) {
 * 				return c.getSymbolOfDeclaration(variable)
 * 			}
 * 		}
 * 	} else if ast.IsIdentifier(initializer) {
 * 		return c.getResolvedSymbol(initializer)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getForInVariableSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasNumericPropertyNames","kind":"method","status":"implemented","sigHash":"e61c07647acfec8a97326c66da3467ca83c7dfd9e1492afbe4ab76bc21040cc3","bodyHash":"d4ef3596f64e7c8ac57ed3c04b6494a8ad3d8dbe926885552716c5e945f4232c"}
 *
 * Go source:
 * func (c *Checker) hasNumericPropertyNames(t *Type) bool {
 * 	return len(c.getIndexInfosOfType(t)) == 1 && c.getIndexInfoOfType(t, c.numberType) != nil
 * }
 */
export declare function Checker_hasNumericPropertyNames(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexedAccessIndexType","kind":"method","status":"implemented","sigHash":"b9df9d9966092d5dbfb5d7c0a5d4af2f2ea2927d0b752347cd3e815ce3b35abe","bodyHash":"0e136fbdc86aa53dcb2198dc35ee878c401ebc7fed4a1bffcc4a2abd041a30d7"}
 *
 * Go source:
 * func (c *Checker) checkIndexedAccessIndexType(t *Type, accessNode *ast.Node) *Type {
 * 	if t.flags&TypeFlagsIndexedAccess == 0 {
 * 		return t
 * 	}
 * 	// Check if the index type is assignable to 'keyof T' for the object type.
 * 	objectType := t.AsIndexedAccessType().objectType
 * 	indexType := t.AsIndexedAccessType().indexType
 * 	// skip index type deferral on remapping mapped types
 * 	var objectIndexType *Type
 * 	if c.isGenericMappedType(objectType) && c.getMappedTypeNameTypeKind(objectType) == MappedTypeNameTypeKindRemapping {
 * 		objectIndexType = c.getIndexTypeForMappedType(objectType, IndexFlagsNone)
 * 	} else {
 * 		objectIndexType = c.getIndexTypeEx(objectType, IndexFlagsNone)
 * 	}
 * 	hasNumberIndexInfo := c.getIndexInfoOfType(objectType, c.numberType) != nil
 * 	if everyType(indexType, func(t *Type) bool {
 * 		return c.isTypeAssignableTo(t, objectIndexType) || hasNumberIndexInfo && c.isApplicableIndexType(t, c.numberType)
 * 	}) {
 * 		if accessNode.Kind == ast.KindElementAccessExpression && ast.IsAssignmentTarget(accessNode) && objectType.objectFlags&ObjectFlagsMapped != 0 && getMappedTypeModifiers(objectType)&MappedTypeModifiersIncludeReadonly != 0 {
 * 			c.error(accessNode, diagnostics.Index_signature_in_type_0_only_permits_reading, c.TypeToString(objectType))
 * 		}
 * 		return t
 * 	}
 * 	if c.isGenericObjectType(objectType) {
 * 		propertyName := c.getPropertyNameFromIndex(indexType, accessNode)
 * 		if propertyName != ast.InternalSymbolNameMissing {
 * 			propertySymbol := c.getConstituentProperty(objectType, propertyName)
 * 			if propertySymbol != nil && getDeclarationModifierFlagsFromSymbol(propertySymbol)&ast.ModifierFlagsNonPublicAccessibilityModifier != 0 {
 * 				c.error(accessNode, diagnostics.Private_or_protected_member_0_cannot_be_accessed_on_a_type_parameter, propertyName)
 * 				return c.errorType
 * 			}
 * 		}
 * 	}
 * 	c.error(accessNode, diagnostics.Type_0_cannot_be_used_to_index_type_1, c.TypeToString(indexType), c.TypeToString(objectType))
 * 	return c.errorType
 * }
 */
export declare function Checker_checkIndexedAccessIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>, accessNode: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstituentProperty","kind":"method","status":"implemented","sigHash":"45510c75d076b6a8d1eb1e31944266d0761631600088266e412c52d4623614b9","bodyHash":"9ec00c93db3c34276d5b034c9074fe7fb21e42cccc95fc2d9ac06a40655eb0c0"}
 *
 * Go source:
 * func (c *Checker) getConstituentProperty(objectType *Type, propertyName string) *ast.Symbol {
 * 	for _, t := range c.getApparentType(objectType).Distributed() {
 * 		prop := c.getPropertyOfType(t, propertyName)
 * 		if prop != nil {
 * 			return prop
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstituentProperty(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, propertyName: string): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createCombinedSymbolFromTypes","kind":"method","status":"implemented","sigHash":"3a0d36488055be8e6822f0c4f1fdda0677de767dd3f041ba62dfb642845ec300","bodyHash":"40398dc4b92339f8f37f116ad82972e256adb7366864fd4e8574900e532b839b"}
 *
 * Go source:
 * func (c *Checker) createCombinedSymbolFromTypes(sources []*ast.Symbol, types []*Type) *ast.Symbol {
 * 	return c.createCombinedSymbolForOverloadFailure(sources, c.getUnionTypeEx(types, UnionReductionSubtype, nil, nil))
 * }
 */
export declare function Checker_createCombinedSymbolFromTypes(receiver: GoPtr<Checker>, sources: GoSlice<GoPtr<Symbol>>, types: GoSlice<GoPtr<Type>>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCollisionsForDeclarationName","kind":"method","status":"implemented","sigHash":"9adc4831d913a8402239b4c1dab32cd99eeb30ca5ffcd48c9508236039b153d9","bodyHash":"f2cc59e9cc65f424ee94bc4b0eee8b47b56b9655f69ccd3188a8c4d2b4875c33"}
 *
 * Go source:
 * func (c *Checker) checkCollisionsForDeclarationName(node *ast.Node, name *ast.Node) {
 * 	if name == nil {
 * 		return
 * 	}
 * 	c.checkCollisionWithRequireExportsInGeneratedCode(node, name)
 * 	c.checkCollisionWithGlobalObjectInGeneratedCode(node, name)
 * 	c.checkCollisionWithGlobalPromiseInGeneratedCode(node, name)
 * 	c.recordPotentialCollisionWithWeakMapSetInGeneratedCode(node, name)
 * 	c.recordPotentialCollisionWithReflectInGeneratedCode(node, name)
 * 	if ast.IsClassLike(node) {
 * 		c.checkTypeNameIsReserved(name, diagnostics.Class_name_cannot_be_0)
 * 		if node.Flags&ast.NodeFlagsAmbient == 0 {
 * 			c.checkClassNameCollisionWithObject(name)
 * 		}
 * 	} else if ast.IsEnumDeclaration(node) {
 * 		c.checkTypeNameIsReserved(name, diagnostics.Enum_name_cannot_be_0)
 * 	}
 * }
 */
export declare function Checker_checkCollisionsForDeclarationName(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCollisionWithRequireExportsInGeneratedCode","kind":"method","status":"implemented","sigHash":"e39d14a484f3a32256f30a4f48cf7caa454e703f0fef04488df57bb18b7d711f","bodyHash":"317d67b397791cb5a220286bc9e371d4f788ad03a0d992bbafae5ecd91b1da46"}
 *
 * Go source:
 * func (c *Checker) checkCollisionWithRequireExportsInGeneratedCode(node *ast.Node, name *ast.Node) {
 * 	// No need to check for require or exports for ES6 modules and later
 * 	if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) >= core.ModuleKindES2015 {
 * 		return
 * 	}
 * 	if name == nil || !c.needCollisionCheckForIdentifier(node, name, "require") && !c.needCollisionCheckForIdentifier(node, name, "exports") {
 * 		return
 * 	}
 * 	// Uninstantiated modules shouldnt do this check
 * 	if ast.IsModuleDeclaration(node) && ast.GetModuleInstanceState(node) != ast.ModuleInstanceStateInstantiated {
 * 		return
 * 	}
 * 	// In case of variable declaration, node.parent is variable statement so look at the variable statement's parent
 * 	parent := ast.GetDeclarationContainer(node)
 * 	if ast.IsSourceFile(parent) && ast.IsExternalOrCommonJSModule(parent.AsSourceFile()) {
 * 		// If the declaration happens to be in external module, report error that require and exports are reserved keywords
 * 		c.errorSkippedOnNoEmit(name, diagnostics.Duplicate_identifier_0_Compiler_reserves_name_1_in_top_level_scope_of_a_module, scanner.DeclarationNameToString(name), scanner.DeclarationNameToString(name))
 * 	}
 * }
 */
export declare function Checker_checkCollisionWithRequireExportsInGeneratedCode(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.needCollisionCheckForIdentifier","kind":"method","status":"implemented","sigHash":"04cd7e8b9baf4dd1d21eab4eb8cc92262a50b9f3c882592825873738a8027462","bodyHash":"7d63e531389237d7a702e5d974eedf138ce0b639622841002c872a7b83ab3241"}
 *
 * Go source:
 * func (c *Checker) needCollisionCheckForIdentifier(node *ast.Node, identifier *ast.Node, name string) bool {
 * 	if identifier != nil && identifier.Text() != name {
 * 		return false
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindMethodDeclaration, ast.KindMethodSignature,
 * 		ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyAssignment:
 * 		// it is ok to have member named '_super', '_this', `Promise`, etc. - member access is always qualified
 * 		return false
 * 	}
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		// ambient context - no codegen impact
 * 		return false
 * 	}
 * 	if ast.IsImportClause(node) || ast.IsImportEqualsDeclaration(node) || ast.IsImportSpecifier(node) {
 * 		// type-only imports do not require collision checks against runtime values.
 * 		if ast.IsTypeOnlyImportOrExportDeclaration(node) {
 * 			return false
 * 		}
 * 	}
 * 	root := ast.GetRootDeclaration(node)
 * 	if ast.IsParameterDeclaration(root) && ast.NodeIsMissing(root.Parent.Body()) {
 * 		// just an overload - no codegen impact
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function Checker_needCollisionCheckForIdentifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, identifier: GoPtr<Node>, name: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.setNodeLinksForPrivateIdentifierScope","kind":"method","status":"implemented","sigHash":"037fb52d36fbfaf1891e5569cf0b88904a837ba64ca63aa3451c59919e1688d2","bodyHash":"4f322733cb4b182ae2825b8954454451c6a67cb16b1d22e2f3e6ddd9ec47d28b"}
 *
 * Go source:
 * func (c *Checker) setNodeLinksForPrivateIdentifierScope(node *ast.Node) {
 * 	if name := node.Name(); ast.IsPrivateIdentifier(name) {
 * 		if c.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks ||
 * 			c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators ||
 * 			!c.compilerOptions.GetUseDefineForClassFields() {
 * 			for lexicalScope := ast.GetEnclosingBlockScopeContainer(node); lexicalScope != nil; lexicalScope = ast.GetEnclosingBlockScopeContainer(lexicalScope) {
 * 				c.nodeLinks.Get(lexicalScope).flags |= NodeCheckFlagsContainsClassWithPrivateIdentifiers
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_setNodeLinksForPrivateIdentifierScope(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCollisionWithGlobalPromiseInGeneratedCode","kind":"method","status":"implemented","sigHash":"0f8a6b81325fe8025d14cf48c9382cf99a0466a7ba012824d9a12903251c3d88","bodyHash":"700a25ba618a9f29399877fe734236e464e16e892c8c1448e385feb197a8f748"}
 *
 * Go source:
 * func (c *Checker) checkCollisionWithGlobalPromiseInGeneratedCode(node *ast.Node, name *ast.Node) {
 * 	if name == nil || c.languageVersion >= core.ScriptTargetES2017 || !c.needCollisionCheckForIdentifier(node, name, "Promise") {
 * 		return
 * 	}
 * 	// Uninstantiated modules shouldn't do this check
 * 	if ast.IsModuleDeclaration(node) && ast.GetModuleInstanceState(node) != ast.ModuleInstanceStateInstantiated {
 * 		return
 * 	}
 * 	// In case of variable declaration, node.parent is variable statement so look at the variable statement's parent
 * 	parent := ast.GetDeclarationContainer(node)
 * 	if ast.IsSourceFile(parent) && ast.IsExternalOrCommonJSModule(parent.AsSourceFile()) && parent.Flags&ast.NodeFlagsHasAsyncFunctions != 0 {
 * 		// If the declaration happens to be in external module, report error that Promise is a reserved identifier.
 * 		c.errorSkippedOnNoEmit(name, diagnostics.Duplicate_identifier_0_Compiler_reserves_name_1_in_top_level_scope_of_a_module_containing_async_functions, scanner.DeclarationNameToString(name), scanner.DeclarationNameToString(name))
 * 	}
 * }
 */
export declare function Checker_checkCollisionWithGlobalPromiseInGeneratedCode(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassNameCollisionWithObject","kind":"method","status":"implemented","sigHash":"4bad603197eee1fa838a346339721928179fad0334ddd22f91d11308a9086dc2","bodyHash":"42be77277168140bdf50787c8e32c03ce13e17e4e8d6a4ac6dd9a5e927c29910"}
 *
 * Go source:
 * func (c *Checker) checkClassNameCollisionWithObject(name *ast.Node) {
 * 	if name.Text() == "Object" && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(name)) < core.ModuleKindES2015 {
 * 		c.error(name, diagnostics.Class_name_cannot_be_Object_when_targeting_ES5_and_above_with_module_0, c.moduleKind.String())
 * 	}
 * }
 */
export declare function Checker_checkClassNameCollisionWithObject(receiver: GoPtr<Checker>, name: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMetaProperty","kind":"method","status":"implemented","sigHash":"e4d7b3eb8cb4f0800c49282ad225573f14665c187b6510627a56e15b25ad2410","bodyHash":"391f53dea57b66c77a7ac64be09ecb651b5cd1872ae064d478d968457ee9a1f0"}
 *
 * Go source:
 * func (c *Checker) checkMetaProperty(node *ast.Node) *Type {
 * 	c.checkGrammarMetaProperty(node.AsMetaProperty())
 * 	switch node.AsMetaProperty().KeywordToken {
 * 	case ast.KindNewKeyword:
 * 		return c.checkNewTargetMetaProperty(node)
 * 	case ast.KindImportKeyword:
 * 		if node.Name().Text() == "defer" {
 * 			debug.Assert(!ast.IsCallExpression(node.Parent) || node.Parent.Expression() != node, "Trying to get the type of `import.defer` in `import.defer(...)`")
 * 			return c.errorType
 * 		}
 * 		return c.checkImportMetaProperty(node)
 * 	}
 * 	panic("Unhandled case in checkMetaProperty")
 * }
 */
export declare function Checker_checkMetaProperty(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNewTargetMetaProperty","kind":"method","status":"implemented","sigHash":"589935b3698252f9696842857394afe9160b50f1ea9b6cbdcaa24518b67445ce","bodyHash":"eb2770b2ac3ea35e2adae58c21f7be5f33096ba0efa360c6643d9039966d4752"}
 *
 * Go source:
 * func (c *Checker) checkNewTargetMetaProperty(node *ast.Node) *Type {
 * 	container := ast.GetNewTargetContainer(node)
 * 	if container == nil {
 * 		c.error(node, diagnostics.Meta_property_0_is_only_allowed_in_the_body_of_a_function_declaration_function_expression_or_constructor, "new.target")
 * 		return c.errorType
 * 	}
 * 	if ast.IsConstructorDeclaration(container) {
 * 		symbol := c.getSymbolOfDeclaration(container.Parent)
 * 		return c.getTypeOfSymbol(symbol)
 * 	}
 * 	symbol := c.getSymbolOfDeclaration(container)
 * 	return c.getTypeOfSymbol(symbol)
 * }
 */
export declare function Checker_checkNewTargetMetaProperty(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportMetaProperty","kind":"method","status":"implemented","sigHash":"14bba0d821147f9110207c2be308c844d73e6a0fb2bc0102f4d1b720e63a58f0","bodyHash":"3969eb3ed6d98072afb14353f509982c91d5e164019caf6aa553df0d50f09e1d"}
 *
 * Go source:
 * func (c *Checker) checkImportMetaProperty(node *ast.Node) *Type {
 * 	if core.ModuleKindNode16 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext {
 * 		sourceFileMetaData := c.program.GetSourceFileMetaData(ast.GetSourceFileOfNode(node).Path())
 * 		if sourceFileMetaData.ImpliedNodeFormat != core.ModuleKindESNext {
 * 			c.error(node, diagnostics.The_import_meta_meta_property_is_not_allowed_in_files_which_will_build_into_CommonJS_output)
 * 		}
 * 	} else if c.moduleKind < core.ModuleKindES2020 && c.moduleKind != core.ModuleKindSystem {
 * 		c.error(node, diagnostics.The_import_meta_meta_property_is_only_allowed_when_the_module_option_is_es2020_es2022_esnext_system_node16_node18_node20_or_nodenext)
 * 	}
 * 	file := ast.GetSourceFileOfNode(node)
 * 	debug.Assert(file.Flags&ast.NodeFlagsPossiblyContainsImportMeta != 0, "Containing file is missing import meta node flag.")
 * 	if node.Name().Text() == "meta" {
 * 		return c.getGlobalImportMetaType()
 * 	}
 * 	return c.errorType
 * }
 */
export declare function Checker_checkImportMetaProperty(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkMetaPropertyKeyword","kind":"method","status":"implemented","sigHash":"c89294aca0017b39c777db9d671aef1ed30f16a847c9e632c23f9244c0b5f7c7","bodyHash":"efc31701422919c40e314847d5b4bb49148d4b946209147cc355f7f19110a934"}
 *
 * Go source:
 * func (c *Checker) checkMetaPropertyKeyword(node *ast.Node) *Type {
 * 	// !!! This is effectively a helper for GetSymbolAtLocation and GetTypeAtLocation
 * 	return c.errorType
 * }
 */
export declare function Checker_checkMetaPropertyKeyword(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIdentifier","kind":"method","status":"implemented","sigHash":"e9a0175eaea65200220166cc3e50540931a8a88829684e8eeacf1be5a4eaeba7","bodyHash":"6ba6f3033cf51bb621524af70f6dc4d76f82fc1d415f1b812cdea626e961305f"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go identifier symbol resolution, extension-enabled programs may validate provider-owned flow/ownership facts attached by source-semantics markers; no-extension programs and unmarked symbols remain on the exact TS-Go path."}
 *
 * Go source:
 * func (c *Checker) checkIdentifier(node *ast.Node, checkMode CheckMode) *Type {
 * 	if ast.IsThisInTypeQuery(node) {
 * 		return c.checkThisExpression(node)
 * 	}
 * 	symbol := c.getResolvedSymbol(node)
 * 	if symbol == c.unknownSymbol {
 * 		return c.errorType
 * 	}
 * 	if symbol == c.argumentsSymbol {
 * 		if c.isInPropertyInitializerOrClassStaticBlock(node, true /*ignoreArrowFunctions* /) {
 * 			c.error(node, diagnostics.X_arguments_cannot_be_referenced_in_property_initializers_or_class_static_initialization_blocks)
 * 			return c.errorType
 * 		}
 * 		return c.getTypeOfSymbol(symbol)
 * 	}
 * 	if shouldMarkIdentifierAliasReferenced(node) {
 * 		c.markLinkedReferences(node, ReferenceHintIdentifier, nil /*propSymbol* /, nil /*parentType* /)
 * 	}
 * 	localOrExportSymbol := c.getExportSymbolOfValueSymbolIfExported(symbol)
 * 	targetSymbol := c.resolveAliasWithDeprecationCheck(localOrExportSymbol, node)
 * 	if len(targetSymbol.Declarations) != 0 && c.isDeprecatedSymbol(targetSymbol) && c.isUncalledFunctionReference(node, targetSymbol) {
 * 		c.addDeprecatedSuggestion(node, targetSymbol.Declarations, node.Text())
 * 	}
 * 	declaration := localOrExportSymbol.ValueDeclaration
 * 	immediateDeclaration := declaration
 * 	// If the identifier is declared in a binding pattern for which we're currently computing the implied type and the
 * 	// reference occurs with the same binding pattern, return the non-inferrable any type. This for example occurs in
 * 	// 'const [a, b = a + 1] = [2]' when we're computing the contextual type for the array literal '[2]'.
 * 	if declaration != nil && declaration.Kind == ast.KindBindingElement && slices.Contains(c.contextualBindingPatterns, declaration.Parent) &&
 * 		ast.FindAncestor(node, func(parent *ast.Node) bool { return parent == declaration.Parent }) != nil {
 * 		return c.nonInferrableAnyType
 * 	}
 * 	t := c.getNarrowedTypeOfSymbol(localOrExportSymbol, node)
 * 	assignmentKind := getAssignmentTargetKind(node)
 * 	if assignmentKind != AssignmentKindNone {
 * 		if localOrExportSymbol.Flags&ast.SymbolFlagsVariable == 0 && !(ast.IsInJSFile(node) && localOrExportSymbol.Flags&ast.SymbolFlagsValueModule != 0) {
 * 			var assignmentError *diagnostics.Message
 * 			switch {
 * 			case localOrExportSymbol.Flags&ast.SymbolFlagsEnum != 0:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_an_enum
 * 			case localOrExportSymbol.Flags&ast.SymbolFlagsClass != 0:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_a_class
 * 			case localOrExportSymbol.Flags&ast.SymbolFlagsModule != 0:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_a_namespace
 * 			case localOrExportSymbol.Flags&ast.SymbolFlagsFunction != 0:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_a_function
 * 			case localOrExportSymbol.Flags&ast.SymbolFlagsAlias != 0:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_an_import
 * 			default:
 * 				assignmentError = diagnostics.Cannot_assign_to_0_because_it_is_not_a_variable
 * 			}
 * 			c.error(node, assignmentError, c.symbolToString(symbol))
 * 			return c.errorType
 * 		}
 * 		if c.isReadonlySymbol(localOrExportSymbol) {
 * 			if localOrExportSymbol.Flags&ast.SymbolFlagsVariable != 0 {
 * 				c.error(node, diagnostics.Cannot_assign_to_0_because_it_is_a_constant, c.symbolToString(symbol))
 * 			} else {
 * 				c.error(node, diagnostics.Cannot_assign_to_0_because_it_is_a_read_only_property, c.symbolToString(symbol))
 * 			}
 * 			return c.errorType
 * 		}
 * 	}
 * 	isAlias := localOrExportSymbol.Flags&ast.SymbolFlagsAlias != 0
 * 	// We only narrow variables and parameters occurring in a non-assignment position. For all other
 * 	// entities we simply return the declared type.
 * 	if localOrExportSymbol.Flags&ast.SymbolFlagsVariable != 0 {
 * 		if assignmentKind == AssignmentKindDefinite {
 * 			if isInCompoundLikeAssignment(node) {
 * 				return c.getBaseTypeOfLiteralType(t)
 * 			}
 * 			return t
 * 		}
 * 	} else if isAlias {
 * 		declaration = c.getDeclarationOfAliasSymbol(symbol)
 * 	} else {
 * 		return t
 * 	}
 * 	if declaration == nil {
 * 		return t
 * 	}
 * 	t = c.getNarrowableTypeForReference(t, node, checkMode)
 * 	// The declaration container is the innermost function that encloses the declaration of the variable
 * 	// or parameter. The flow container is the innermost function starting with which we analyze the control
 * 	// flow graph to determine the control flow based type.
 * 	isParameter := ast.GetRootDeclaration(declaration).Kind == ast.KindParameter
 * 	declarationContainer := c.getControlFlowContainer(declaration)
 * 	flowContainer := c.getControlFlowContainer(node)
 * 	isOuterVariable := flowContainer != declarationContainer
 * 	isSpreadDestructuringAssignmentTarget := node.Parent != nil && node.Parent.Parent != nil && ast.IsSpreadAssignment(node.Parent) && c.isDestructuringAssignmentTarget(node.Parent.Parent)
 * 	isModuleExports := symbol.Flags&ast.SymbolFlagsModuleExports != 0
 * 	typeIsAutomatic := t == c.autoType || t == c.autoArrayType
 * 	isAutomaticTypeInNonNull := typeIsAutomatic && node.Parent.Kind == ast.KindNonNullExpression
 * 	// When the control flow originates in a function expression, arrow function, method, or accessor, and
 * 	// we are referencing a closed-over const variable or parameter or mutable local variable past its last
 * 	// assignment, we extend the origin of the control flow analysis to include the immediately enclosing
 * 	// control flow container.
 * 	for flowContainer != declarationContainer &&
 * 		(ast.IsFunctionExpressionOrArrowFunction(flowContainer) || ast.IsObjectLiteralOrClassExpressionMethodOrAccessor(flowContainer)) &&
 * 		(c.isConstantVariable(localOrExportSymbol) && t != c.autoArrayType || c.isParameterOrMutableLocalVariable(localOrExportSymbol) && c.isPastLastAssignment(localOrExportSymbol, node)) {
 * 		flowContainer = c.getControlFlowContainer(flowContainer)
 * 	}
 * 	// We only look for uninitialized variables in strict null checking mode, and only when we can analyze
 * 	// the entire control flow graph from the variable's declaration (i.e. when the flow container and
 * 	// declaration container are the same).
 * 	isNeverInitialized := immediateDeclaration != nil && ast.IsVariableDeclaration(immediateDeclaration) && !ast.IsForInOrOfStatement(immediateDeclaration.Parent.Parent) &&
 * 		immediateDeclaration.Initializer() == nil && immediateDeclaration.AsVariableDeclaration().ExclamationToken == nil &&
 * 		c.isMutableLocalVariableDeclaration(immediateDeclaration) && !c.isSymbolAssignedDefinitely(symbol)
 * 	assumeInitialized := isParameter ||
 * 		isAlias ||
 * 		(isOuterVariable && !isNeverInitialized) ||
 * 		isSpreadDestructuringAssignmentTarget ||
 * 		isModuleExports ||
 * 		c.isSameScopedBindingElement(node, declaration) ||
 * 		t != c.autoType && t != c.autoArrayType && (!c.strictNullChecks || t.flags&(TypeFlagsAnyOrUnknown|TypeFlagsVoid) != 0 || IsInTypeQuery(node) || c.isInAmbientOrTypeNode(node) || node.Parent.Kind == ast.KindExportSpecifier) ||
 * 		ast.IsNonNullExpression(node.Parent) ||
 * 		ast.IsVariableDeclaration(declaration) && declaration.AsVariableDeclaration().ExclamationToken != nil ||
 * 		declaration.Flags&ast.NodeFlagsAmbient != 0
 * 	var initialType *Type
 * 	switch {
 * 	case isAutomaticTypeInNonNull:
 * 		initialType = c.undefinedType
 * 	case assumeInitialized && isParameter:
 * 		initialType = c.removeOptionalityFromDeclaredType(t, declaration)
 * 	case assumeInitialized:
 * 		initialType = t
 * 	case typeIsAutomatic:
 * 		initialType = c.undefinedType
 * 	default:
 * 		initialType = c.getOptionalType(t, false /*isProperty* /)
 * 	}
 * 	var flowType *Type
 * 	if isAutomaticTypeInNonNull {
 * 		flowType = c.GetNonNullableType(c.getFlowTypeOfReferenceEx(node, t, initialType, flowContainer, nil))
 * 	} else {
 * 		flowType = c.getFlowTypeOfReferenceEx(node, t, initialType, flowContainer, nil)
 * 	}
 * 	// A variable is considered uninitialized when it is possible to analyze the entire control flow graph
 * 	// from declaration to use, and when the variable's declared type doesn't include undefined but the
 * 	// control flow based type does include undefined.
 * 	if !c.isEvolvingArrayOperationTarget(node) && (t == c.autoType || t == c.autoArrayType) {
 * 		if flowType == c.autoType || flowType == c.autoArrayType {
 * 			if c.noImplicitAny {
 * 				c.error(ast.GetNameOfDeclaration(declaration), diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined, c.symbolToString(symbol), c.TypeToString(flowType))
 * 				c.error(node, diagnostics.Variable_0_implicitly_has_an_1_type, c.symbolToString(symbol), c.TypeToString(flowType))
 * 			}
 * 			return c.convertAutoToAny(flowType)
 * 		}
 * 	} else if !assumeInitialized && !c.containsUndefinedType(t) && c.containsUndefinedType(flowType) {
 * 		c.error(node, diagnostics.Variable_0_is_used_before_being_assigned, c.symbolToString(symbol))
 * 		// Return the declared type to reduce follow-on errors
 * 		return t
 * 	}
 * 	if assignmentKind != AssignmentKindNone {
 * 		// Identifier is target of a compound assignment
 * 		return c.getBaseTypeOfLiteralType(flowType)
 * 	}
 * 	return flowType
 * }
 */
export declare function Checker_checkIdentifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSameScopedBindingElement","kind":"method","status":"implemented","sigHash":"0c94d25b3a3360fa77b93505dce16379ea6647e22b5efd6d710a09560c57addb","bodyHash":"fae5dc54923815f24012047ccc2b4655e0439900daf2ebde54e34357f95cd4b5"}
 *
 * Go source:
 * func (c *Checker) isSameScopedBindingElement(node *ast.Node, declaration *ast.Node) bool {
 * 	if ast.IsBindingElement(declaration) {
 * 		bindingElement := ast.FindAncestor(node, ast.IsBindingElement)
 * 		return bindingElement != nil && ast.GetRootDeclaration(bindingElement) == ast.GetRootDeclaration(declaration)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSameScopedBindingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, declaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"febcba979df4bee97ff9b0d6a44f3b1d8f0f4d8f43952819b5bcda4e8c2e880e","bodyHash":"82b3a1ac1890b83ce90db47cb21a1598249772e581ef1fe94cf9180ba2495e26"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go property access checking, extension-enabled programs may record provider-selected surface/target member facts for consumers; no-extension programs and unowned accesses remain on the exact TS-Go path."}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessExpression(node *ast.Node, checkMode CheckMode, writeOnly bool) *Type {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return c.checkPropertyAccessChain(node, checkMode)
 * 	}
 * 	expr := node.Expression()
 * 	return c.checkPropertyAccessExpressionOrQualifiedName(node, expr, c.checkNonNullExpression(expr), node.AsPropertyAccessExpression().Name(), checkMode, writeOnly)
 * }
 */
export declare function Checker_checkPropertyAccessExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode, writeOnly: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessChain","kind":"method","status":"implemented","sigHash":"8fddaeae38c55291a27039fd3e34d4f23b91a1185f6450fd8a87c8ef77aeb85e","bodyHash":"8d099873c74d1d2075853d42ef27cf852f70d2462e0b439c46f9177816bb5aa8"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go optional-chain property access checking, extension-enabled programs record the same selected source evidence exposed for non-optional property access."}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessChain(node *ast.Node, checkMode CheckMode) *Type {
 * 	leftType := c.checkExpression(node.Expression())
 * 	nonOptionalType := c.getOptionalExpressionType(leftType, node.Expression())
 * 	return c.propagateOptionalTypeMarker(c.checkPropertyAccessExpressionOrQualifiedName(node, node.Expression(), c.checkNonNullType(nonOptionalType, node.Expression()), node.Name(), checkMode, false), node, nonOptionalType != leftType)
 * }
 */
export declare function Checker_checkPropertyAccessChain(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessExpressionOrQualifiedName","kind":"method","status":"implemented","sigHash":"9215f415f7607d418e5a3a390b0bf838e9a2f44b6cd177065016f5a85a4714b1","bodyHash":"c9ee642c0561d3b1c6f6fcf3a43fb2def31c2e6dcf98504b1f6a3169813218e3"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"When TS-Go selects an index signature for property access, extension-selected evidence needs the same resolved-symbol cache that TS-Go already creates for public symbol queries."}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessExpressionOrQualifiedName(node *ast.Node, left *ast.Node, leftType *Type, right *ast.Node, checkMode CheckMode, writeOnly bool) *Type {
 * 	parentSymbol := c.getResolvedSymbolOrNil(left)
 * 	assignmentKind := getAssignmentTargetKind(node)
 * 	widenedType := leftType
 * 	if assignmentKind != AssignmentKindNone || c.isMethodAccessForCall(node) {
 * 		widenedType = c.getWidenedType(leftType)
 * 	}
 * 	apparentType := c.getApparentType(widenedType)
 * 	isAnyLike := IsTypeAny(apparentType) || apparentType == c.silentNeverType
 * 	var prop *ast.Symbol
 * 	if ast.IsPrivateIdentifier(right) {
 * 		if c.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks ||
 * 			c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators ||
 * 			!c.compilerOptions.GetUseDefineForClassFields() {
 * 			if assignmentKind != AssignmentKindNone {
 * 				c.checkExternalEmitHelpers(node, ExternalEmitHelpersClassPrivateFieldSet)
 * 			}
 * 			if assignmentKind != AssignmentKindDefinite {
 * 				c.checkExternalEmitHelpers(node, ExternalEmitHelpersClassPrivateFieldGet)
 * 			}
 * 		}
 * 		lexicallyScopedSymbol := c.lookupSymbolForPrivateIdentifierDeclaration(right.Text(), right)
 * 		if assignmentKind != AssignmentKindNone && lexicallyScopedSymbol != nil && lexicallyScopedSymbol.ValueDeclaration != nil && ast.IsMethodDeclaration(lexicallyScopedSymbol.ValueDeclaration) {
 * 			c.grammarErrorOnNode(right, diagnostics.Cannot_assign_to_private_method_0_Private_methods_are_not_writable, right.Text())
 * 		}
 * 		if isAnyLike {
 * 			if lexicallyScopedSymbol != nil {
 * 				if c.isErrorType(apparentType) {
 * 					return c.errorType
 * 				}
 * 				return apparentType
 * 			}
 * 			if getContainingClassExcludingClassDecorators(right) == nil {
 * 				c.grammarErrorOnNode(right, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 				return c.anyType
 * 			}
 * 		}
 * 		if lexicallyScopedSymbol != nil {
 * 			prop = c.getPrivateIdentifierPropertyOfType(leftType, lexicallyScopedSymbol)
 * 		}
 * 		if prop == nil {
 * 			// Check for private-identifier-specific shadowing and lexical-scoping errors.
 * 			if c.checkPrivateIdentifierPropertyAccess(leftType, right, lexicallyScopedSymbol) {
 * 				return c.errorType
 * 			}
 * 			containingClass := getContainingClassExcludingClassDecorators(right)
 * 			if containingClass != nil && ast.IsPlainJSFile(ast.GetSourceFileOfNode(containingClass), c.compilerOptions.CheckJs) {
 * 				c.grammarErrorOnNode(right, diagnostics.Private_field_0_must_be_declared_in_an_enclosing_class, right.Text())
 * 			}
 * 		} else {
 * 			isSetonlyAccessor := prop.Flags&ast.SymbolFlagsSetAccessor != 0 && prop.Flags&ast.SymbolFlagsGetAccessor == 0
 * 			if isSetonlyAccessor && assignmentKind != AssignmentKindDefinite {
 * 				c.error(node, diagnostics.Private_accessor_was_defined_without_a_getter)
 * 			}
 * 		}
 * 	} else {
 * 		if isAnyLike {
 * 			if ast.IsIdentifier(left) && parentSymbol != nil {
 * 				c.markLinkedReferences(node, ReferenceHintProperty, nil /*propSymbol* /, leftType)
 * 			}
 * 			if c.isErrorType(apparentType) {
 * 				return c.errorType
 * 			}
 * 			return apparentType
 * 		}
 * 		prop = c.getPropertyOfTypeEx(apparentType, right.Text(), isConstEnumObjectType(apparentType) /*skipObjectFunctionPropertyAugment* /, node.Kind == ast.KindQualifiedName /*includeTypeOnlyMembers* /)
 * 	}
 * 	c.markLinkedReferences(node, ReferenceHintProperty, prop, leftType)
 * 	var propType *Type
 * 	if prop == nil {
 * 		var indexInfo *IndexInfo
 * 		if !ast.IsPrivateIdentifier(right) && (assignmentKind == AssignmentKindNone || !c.isGenericObjectType(leftType) || isThisTypeParameter(leftType)) {
 * 			indexInfo = c.getApplicableIndexInfoForName(apparentType, right.Text())
 * 		}
 * 		if indexInfo == nil {
 * 			isUncheckedJS := c.isUncheckedJSSuggestion(node, leftType.symbol, true /*excludeClasses* /)
 * 			if !isUncheckedJS && c.isJSLiteralType(leftType) {
 * 				return c.anyType
 * 			}
 * 			if leftType.symbol == c.globalThisSymbol {
 * 				globalSymbol := c.globalThisSymbol.Exports[right.Text()]
 * 				if globalSymbol != nil && globalSymbol.Flags&ast.SymbolFlagsBlockScoped != 0 {
 * 					c.error(right, diagnostics.Property_0_does_not_exist_on_type_1, right.Text(), c.TypeToString(leftType))
 * 				} else if c.noImplicitAny {
 * 					c.error(right, diagnostics.Element_implicitly_has_an_any_type_because_type_0_has_no_index_signature, c.TypeToString(leftType))
 * 				}
 * 				return c.anyType
 * 			}
 * 			if right.Text() != "" && !c.checkAndReportErrorForExtendingInterface(node) {
 * 				c.reportNonexistentProperty(right, core.IfElse(isThisTypeParameter(leftType), apparentType, leftType), isUncheckedJS)
 * 			}
 * 			return c.errorType
 * 		}
 * 		if indexInfo.isReadonly && (ast.IsAssignmentTarget(node) || isDeleteTarget(node)) {
 * 			c.error(node, diagnostics.Index_signature_in_type_0_only_permits_reading, c.TypeToString(apparentType))
 * 		}
 * 		propType = indexInfo.valueType
 * 		if c.compilerOptions.NoUncheckedIndexedAccess == core.TSTrue && getAssignmentTargetKind(node) != AssignmentKindDefinite {
 * 			propType = c.getUnionType([]*Type{propType, c.missingType})
 * 		}
 * 		if c.compilerOptions.NoPropertyAccessFromIndexSignature == core.TSTrue && ast.IsPropertyAccessExpression(node) {
 * 			c.error(right, diagnostics.Property_0_comes_from_an_index_signature_so_it_must_be_accessed_with_0, right.Text())
 * 		}
 * 		if indexInfo.declaration != nil && c.IsDeprecatedDeclaration(indexInfo.declaration) {
 * 			c.addDeprecatedSuggestion(right, []*ast.Node{indexInfo.declaration}, right.Text())
 * 		}
 * 	} else {
 * 		targetPropSymbol := c.resolveAliasWithDeprecationCheck(prop, right)
 * 		if c.isDeprecatedSymbol(targetPropSymbol) && c.isUncalledFunctionReference(node, targetPropSymbol) && targetPropSymbol.Declarations != nil {
 * 			c.addDeprecatedSuggestion(right, targetPropSymbol.Declarations, right.Text())
 * 		}
 * 		c.checkPropertyNotUsedBeforeDeclaration(prop, node, right)
 * 		c.markPropertyAsReferenced(prop, node, c.isSelfTypeAccess(left, parentSymbol))
 * 		c.symbolNodeLinks.Get(node).resolvedSymbol = prop
 * 		c.checkPropertyAccessibility(node, left.Kind == ast.KindSuperKeyword, ast.IsWriteAccess(node), apparentType, prop)
 * 		if c.isAssignmentToReadonlyEntity(node, prop, assignmentKind) {
 * 			c.error(right, diagnostics.Cannot_assign_to_0_because_it_is_a_read_only_property, right.Text())
 * 			return c.errorType
 * 		}
 * 		switch {
 * 		case c.isThisPropertyAccessInConstructor(node, prop):
 * 			propType = c.autoType
 * 		case writeOnly || ast.IsWriteOnlyAccess(node):
 * 			propType = c.getWriteTypeOfSymbol(prop)
 * 		default:
 * 			propType = c.getTypeOfSymbol(prop)
 * 		}
 * 	}
 * 	return c.getFlowTypeOfAccessExpression(node, prop, propType, right, checkMode)
 * }
 */
export declare function Checker_checkPropertyAccessExpressionOrQualifiedName(receiver: GoPtr<Checker>, node: GoPtr<Node>, left: GoPtr<Node>, leftType: GoPtr<Type>, right: GoPtr<Node>, checkMode: CheckMode, writeOnly: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPropertyInBaseClass","kind":"method","status":"implemented","sigHash":"f429e3448e243a96790f7e608ac1240f166fa762fbd29c79e0b3abd8d52fa687","bodyHash":"5844e62bf2a33e6d735f57fb4a67188f1a2ba554a76c00b10bdb8f0a1bdc3faa"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyInBaseClass(property *ast.Symbol) *Type {
 * 	classType := c.getDeclaringClass(property)
 * 	if classType != nil {
 * 		baseClassTypes := c.getBaseTypes(classType)
 * 		if len(baseClassTypes) > 0 {
 * 			return c.getTypeOfPropertyOfType(baseClassTypes[0], property.Name)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeOfPropertyInBaseClass(receiver: GoPtr<Checker>, property: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.lookupSymbolForPrivateIdentifierDeclaration","kind":"method","status":"implemented","sigHash":"228da7e6fecbdcea04a2feea0cee5d819018506fd02fac88922a9c21626a2fa3","bodyHash":"7940199551b00668e4e1a0c2ea929ea65fc4bca4c050ea5ce2d231a077be1d06"}
 *
 * Go source:
 * func (c *Checker) lookupSymbolForPrivateIdentifierDeclaration(propName string, location *ast.Node) *ast.Symbol {
 * 	for containingClass := getContainingClassExcludingClassDecorators(location); containingClass != nil; containingClass = ast.GetContainingClass(containingClass) {
 * 		symbol := containingClass.Symbol()
 * 		name := binder.GetSymbolNameForPrivateIdentifier(symbol, propName)
 * 		prop := symbol.Members[name]
 * 		if prop != nil {
 * 			return prop
 * 		}
 * 		prop = symbol.Exports[name]
 * 		if prop != nil {
 * 			return prop
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_lookupSymbolForPrivateIdentifierDeclaration(receiver: GoPtr<Checker>, propName: string, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPrivateIdentifierPropertyOfType","kind":"method","status":"implemented","sigHash":"9b744f3853454aca92d4a772beb6b5c1cca487c06713daac748704b45e73e722","bodyHash":"165e01a4cae35c2426332ce60f6f1f7c9dfb63fa259956f60c1c7e043805aa9d"}
 *
 * Go source:
 * func (c *Checker) getPrivateIdentifierPropertyOfType(leftType *Type, lexicallyScopedIdentifier *ast.Symbol) *ast.Symbol {
 * 	return c.getPropertyOfType(leftType, lexicallyScopedIdentifier.Name)
 * }
 */
export declare function Checker_getPrivateIdentifierPropertyOfType(receiver: GoPtr<Checker>, leftType: GoPtr<Type>, lexicallyScopedIdentifier: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPrivateIdentifierPropertyAccess","kind":"method","status":"implemented","sigHash":"d909c8271107403f30d54f3678fd9ce848a3222424dd133e81bdc0594c0fd99a","bodyHash":"1507f723c6240a904a6f3b56c8e93b0d2ee306f096e59a29429faa1dfe46e5bb"}
 *
 * Go source:
 * func (c *Checker) checkPrivateIdentifierPropertyAccess(leftType *Type, right *ast.Node, lexicallyScopedIdentifier *ast.Symbol) bool {
 * 	// Either the identifier could not be looked up in the lexical scope OR the lexically scoped identifier did not exist on the type.
 * 	// Find a private identifier with the same description on the type.
 * 	properties := c.getPropertiesOfType(leftType)
 * 	var propertyOnType *ast.Symbol
 * 	for _, symbol := range properties {
 * 		decl := symbol.ValueDeclaration
 * 		if decl != nil && decl.Name() != nil && ast.IsPrivateIdentifier(decl.Name()) && decl.Name().Text() == right.Text() {
 * 			propertyOnType = symbol
 * 			break
 * 		}
 * 	}
 * 	diagName := scanner.DeclarationNameToString(right)
 * 	if propertyOnType != nil {
 * 		typeValueDecl := propertyOnType.ValueDeclaration
 * 		typeClass := ast.GetContainingClass(typeValueDecl)
 * 		// We found a private identifier property with the same description.
 * 		// Either:
 * 		// - There is a lexically scoped private identifier AND it shadows the one we found on the type.
 * 		// - It is an attempt to access the private identifier outside of the class.
 * 		if lexicallyScopedIdentifier != nil && lexicallyScopedIdentifier.ValueDeclaration != nil {
 * 			lexicalValueDecl := lexicallyScopedIdentifier.ValueDeclaration
 * 			lexicalClass := ast.GetContainingClass(lexicalValueDecl)
 * 			if ast.FindAncestor(lexicalClass, func(n *ast.Node) bool { return typeClass == n }) != nil {
 * 				diagnostic := c.error(right, diagnostics.The_property_0_cannot_be_accessed_on_type_1_within_this_class_because_it_is_shadowed_by_another_private_identifier_with_the_same_spelling, diagName, c.TypeToString(leftType))
 * 				diagnostic.AddRelatedInfo(createDiagnosticForNode(lexicalValueDecl, diagnostics.The_shadowing_declaration_of_0_is_defined_here, diagName))
 * 				diagnostic.AddRelatedInfo(createDiagnosticForNode(typeValueDecl, diagnostics.The_declaration_of_0_that_you_probably_intended_to_use_is_defined_here, diagName))
 * 				return true
 * 			}
 * 		}
 * 		c.error(right, diagnostics.Property_0_is_not_accessible_outside_class_1_because_it_has_a_private_identifier, diagName, c.SymbolToString(typeClass.Symbol()))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkPrivateIdentifierPropertyAccess(receiver: GoPtr<Checker>, leftType: GoPtr<Type>, right: GoPtr<Node>, lexicallyScopedIdentifier: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportNonexistentProperty","kind":"method","status":"implemented","sigHash":"9aec8730ebf63baf20d6c599892368db404e7f9b2ef28b13b82272c1d806a0d7","bodyHash":"5677ccfb03e627239cd2122c19fe0bc5c9587664844674c608306761b1bad64b"}
 *
 * Go source:
 * func (c *Checker) reportNonexistentProperty(propNode *ast.Node, containingType *Type, isUncheckedJS bool) {
 * 	key := NonExistentPropertyKey{propNode, containingType, isUncheckedJS}
 * 	if c.nonExistentProperties.Has(key) {
 * 		return
 * 	}
 * 	c.nonExistentProperties.Add(key)
 * 	links := c.nodeLinks.Get(propNode)
 * 	if links.flags&NodeCheckFlagsTypeChecked != 0 {
 * 		return // error already made/in progress
 * 	}
 * 	links.flags |= NodeCheckFlagsTypeChecked
 * 	if ast.IsJSDocNameReferenceContext(propNode) {
 * 		return
 * 	}
 * 	var diagnostic *ast.Diagnostic
 * 	if !ast.IsPrivateIdentifier(propNode) && containingType.flags&TypeFlagsUnion != 0 && containingType.flags&TypeFlagsPrimitive == 0 {
 * 		for _, subtype := range containingType.Types() {
 * 			if c.getPropertyOfType(subtype, propNode.Text()) == nil && c.getApplicableIndexInfoForName(subtype, propNode.Text()) == nil {
 * 				diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, diagnostics.Property_0_does_not_exist_on_type_1, scanner.DeclarationNameToString(propNode), c.TypeToString(subtype))
 * 				break
 * 			}
 * 		}
 * 	}
 * 	if c.typeHasStaticProperty(propNode.Text(), containingType) {
 * 		propName := scanner.DeclarationNameToString(propNode)
 * 		typeName := c.TypeToString(containingType)
 * 		diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_to_access_the_static_member_2_instead, propName, typeName, typeName+"."+propName)
 * 	} else {
 * 		promisedType := c.GetPromisedTypeOfPromise(containingType)
 * 		if promisedType != nil && c.getPropertyOfType(promisedType, propNode.Text()) != nil {
 * 			diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, diagnostics.Property_0_does_not_exist_on_type_1, scanner.DeclarationNameToString(propNode), c.TypeToString(containingType))
 * 			diagnostic.AddRelatedInfo(NewDiagnosticForNode(propNode, diagnostics.Did_you_forget_to_use_await))
 * 		} else {
 * 			missingProperty := scanner.DeclarationNameToString(propNode)
 * 			container := c.TypeToString(containingType)
 * 			libSuggestion := c.getSuggestedLibForNonExistentProperty(missingProperty, containingType)
 * 			if libSuggestion != "" {
 * 				diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, diagnostics.Property_0_does_not_exist_on_type_1_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_2_or_later, missingProperty, container, libSuggestion)
 * 			} else {
 * 				suggestion := c.getSuggestedSymbolForNonexistentProperty(propNode, containingType)
 * 				if suggestion != nil {
 * 					suggestedName := ast.SymbolName(suggestion)
 * 					message := core.IfElse(isUncheckedJS, diagnostics.Property_0_may_not_exist_on_type_1_Did_you_mean_2, diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2)
 * 					diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, message, missingProperty, container, suggestedName)
 * 					if suggestion.ValueDeclaration != nil {
 * 						diagnostic.AddRelatedInfo(NewDiagnosticForNode(suggestion.ValueDeclaration, diagnostics.X_0_is_declared_here, suggestedName))
 * 					}
 * 				} else {
 * 					diagnostic = c.elaborateNeverIntersection(diagnostic, propNode, containingType)
 * 					var message *diagnostics.Message
 * 					if c.containerSeemsToBeEmptyDomElement(containingType) {
 * 						message = diagnostics.Property_0_does_not_exist_on_type_1_Try_changing_the_lib_compiler_option_to_include_dom
 * 					} else {
 * 						message = diagnostics.Property_0_does_not_exist_on_type_1
 * 					}
 * 					diagnostic = NewDiagnosticChainForNode(diagnostic, propNode, message, missingProperty, container)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.addErrorOrSuggestion(!isUncheckedJS || diagnostic.Code() != diagnostics.Property_0_may_not_exist_on_type_1_Did_you_mean_2.Code(), diagnostic)
 * }
 */
export declare function Checker_reportNonexistentProperty(receiver: GoPtr<Checker>, propNode: GoPtr<Node>, containingType: GoPtr<Type>, isUncheckedJS: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedLibForNonExistentProperty","kind":"method","status":"implemented","sigHash":"ae2390239ec144b258e7cfd6cf608a5bcf2a8f7673fa1f62590f93388802f3da","bodyHash":"3e1951d2e561bb688cb6a57ac806ec45c31c54ff49d4b92550a27c12cd3c41fd"}
 *
 * Go source:
 * func (c *Checker) getSuggestedLibForNonExistentProperty(missingProperty string, containingType *Type) string {
 * 	container := c.getApparentType(containingType).symbol
 * 	if container != nil {
 * 		featureMap := getFeatureMap()
 * 		if typeFeatures, ok := featureMap[container.Name]; ok {
 * 			for _, entry := range typeFeatures {
 * 				if slices.Contains(entry.props, missingProperty) {
 * 					return entry.lib
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function Checker_getSuggestedLibForNonExistentProperty(receiver: GoPtr<Checker>, missingProperty: string, containingType: GoPtr<Type>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedSymbolForNonexistentProperty","kind":"method","status":"implemented","sigHash":"92aac3c310bd0a970680d631e78082d6d872accefe2cadfdac7b0f8e07317c69","bodyHash":"af8188a7091ddf600ac1f602084e5ecc543125fcfe240ca29810528ac9e2b106"}
 *
 * Go source:
 * func (c *Checker) getSuggestedSymbolForNonexistentProperty(name *ast.Node, containingType *Type) *ast.Symbol {
 * 	props := c.getPropertiesOfType(containingType)
 * 	parent := name.Parent
 * 	if ast.IsPropertyAccessExpression(parent) {
 * 		props = core.Filter(props, func(prop *ast.Symbol) bool {
 * 			return c.isValidPropertyAccessForCompletions(parent, containingType, prop)
 * 		})
 * 	}
 * 	return c.getSpellingSuggestionForName(name.Text(), slices.Values(props), ast.SymbolFlagsValue)
 * }
 */
export declare function Checker_getSuggestedSymbolForNonexistentProperty(receiver: GoPtr<Checker>, name: GoPtr<Node>, containingType: GoPtr<Type>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isValidPropertyAccessForCompletions","kind":"method","status":"implemented","sigHash":"6d90fa826728d88aea4b23b8e4f4a2e5d80d46f335661beeb74807b9e00c3ff3","bodyHash":"4baa06d544b3af48378b847f2daf94bb8cf610b8e5d90b04e1348000eca26187"}
 *
 * Go source:
 * func (c *Checker) isValidPropertyAccessForCompletions(node *ast.Node, t *Type, property *ast.Symbol) bool {
 * 	return c.isPropertyAccessible(node, ast.IsPropertyAccessExpression(node) && node.Expression().Kind == ast.KindSuperKeyword, false /*isWrite* /, t, property)
 * 	// Previously we validated the 'this' type of methods but this adversely affected performance. See #31377 for more context.
 * }
 */
export declare function Checker_isValidPropertyAccessForCompletions(receiver: GoPtr<Checker>, node: GoPtr<Node>, t: GoPtr<Type>, property: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyAccessible","kind":"method","status":"implemented","sigHash":"ad67536a218705c47ab37d562364c1be01a8c9d1f5c8504f51eeffffb5d7e96a","bodyHash":"9b6983825a56b1ea8d40538a3b5ecec0aa5b16b61ed7baf2406b66d6058f5e48"}
 *
 * Go source:
 * func (c *Checker) isPropertyAccessible(node *ast.Node, isSuper bool, isWrite bool, containingType *Type, property *ast.Symbol) bool {
 * 	// Short-circuiting for improved performance.
 * 	if IsTypeAny(containingType) {
 * 		return true
 * 	}
 * 	// A #private property access in an optional chain is an error dealt with by the parser.
 * 	// The checker does not check for it, so we need to do our own check here.
 * 	if property.ValueDeclaration != nil && ast.IsPrivateIdentifierClassElementDeclaration(property.ValueDeclaration) {
 * 		declClass := ast.GetContainingClass(property.ValueDeclaration)
 * 		return !ast.IsOptionalChain(node) && ast.IsNodeDescendantOf(node, declClass)
 * 	}
 * 	return c.checkPropertyAccessibilityAtLocation(node, isSuper, isWrite, containingType, property, nil)
 * }
 */
export declare function Checker_isPropertyAccessible(receiver: GoPtr<Checker>, node: GoPtr<Node>, isSuper: bool, isWrite: bool, containingType: GoPtr<Type>, property: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEntityNameForExtendingInterface","kind":"method","status":"implemented","sigHash":"a699674ddc501deee94ed040b3c76de0a42f219f8dbc33de4089254dc474efa6","bodyHash":"9fb4029120f93bc7f51341e296b795e7cc6f0111fd64e4587184223e83149234"}
 *
 * Go source:
 * func (c *Checker) getEntityNameForExtendingInterface(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier, ast.KindPropertyAccessExpression:
 * 		if node.Parent != nil {
 * 			return c.getEntityNameForExtendingInterface(node.Parent)
 * 		}
 * 	case ast.KindExpressionWithTypeArguments:
 * 		if ast.IsEntityNameExpression(node.Expression()) {
 * 			return node.Expression()
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getEntityNameForExtendingInterface(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyNotUsedBeforeDeclaration","kind":"method","status":"implemented","sigHash":"700e677986f74862ed71ae4d3c0fa4780cf63c46bd22d471ade6f0e057867aba","bodyHash":"9b442474d3086d7136673ff0a0338815187382ff1fe1c9be7bfdab7ef027d7ad"}
 *
 * Go source:
 * func (c *Checker) checkPropertyNotUsedBeforeDeclaration(prop *ast.Symbol, node *ast.Node, right *ast.Node) {
 * 	valueDeclaration := prop.ValueDeclaration
 * 	if valueDeclaration == nil || ast.GetSourceFileOfNode(node).IsDeclarationFile {
 * 		return
 * 	}
 * 	var diagnostic *ast.Diagnostic
 * 	declarationName := right.Text()
 * 	if c.isInPropertyInitializerOrClassStaticBlock(node, false /*ignoreArrowFunctions* /) &&
 * 		!c.isOptionalPropertyDeclaration(valueDeclaration) &&
 * 		!(ast.IsAccessExpression(node) && ast.IsAccessExpression(node.Expression())) &&
 * 		!c.isBlockScopedNameDeclaredBeforeUse(valueDeclaration, right) &&
 * 		!(ast.IsMethodDeclaration(valueDeclaration) && c.getCombinedModifierFlagsCached(valueDeclaration)&ast.ModifierFlagsStatic != 0) &&
 * 		(c.compilerOptions.GetUseDefineForClassFields() || !c.isPropertyDeclaredInAncestorClass(prop)) {
 * 		diagnostic = c.error(right, diagnostics.Property_0_is_used_before_its_initialization, declarationName)
 * 	} else if ast.IsClassDeclaration(valueDeclaration) && !ast.IsTypeReferenceNode(node.Parent) && valueDeclaration.Flags&ast.NodeFlagsAmbient == 0 && !c.isBlockScopedNameDeclaredBeforeUse(valueDeclaration, right) {
 * 		diagnostic = c.error(right, diagnostics.Class_0_used_before_its_declaration, declarationName)
 * 	}
 * 	if diagnostic != nil {
 * 		diagnostic.AddRelatedInfo(NewDiagnosticForNode(valueDeclaration, diagnostics.X_0_is_declared_here, declarationName))
 * 	}
 * }
 */
export declare function Checker_checkPropertyNotUsedBeforeDeclaration(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, node: GoPtr<Node>, right: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isOptionalPropertyDeclaration","kind":"method","status":"implemented","sigHash":"fcf35a0219556f2c77ac9caabef8141bccfc1a3570326cf81e94d7687f5abc45","bodyHash":"1bafb468bc91ed93d833f02174f2a5d966c1d1eae48a08084df08ee1f8a03575"}
 *
 * Go source:
 * func (c *Checker) isOptionalPropertyDeclaration(node *ast.Node) bool {
 * 	return ast.IsPropertyDeclaration(node) && !ast.HasAccessorModifier(node) && ast.IsQuestionToken(node.PostfixToken())
 * }
 */
export declare function Checker_isOptionalPropertyDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyDeclaredInAncestorClass","kind":"method","status":"implemented","sigHash":"12fc17155fa7d3acc70821572331ac908ef73ee64460ef588abd990e670922fe","bodyHash":"280ba2eafb4af8d48502eb4af5c326cf9263edd147cf5324545dcf4413ababa0"}
 *
 * Go source:
 * func (c *Checker) isPropertyDeclaredInAncestorClass(prop *ast.Symbol) bool {
 * 	if prop.Parent.Flags&ast.SymbolFlagsClass != 0 {
 * 		if baseTypes := c.getBaseTypes(c.getDeclaredTypeOfSymbol(prop.Parent)); len(baseTypes) != 0 {
 * 			superProperty := c.getPropertyOfType(baseTypes[0], prop.Name)
 * 			return superProperty != nil && superProperty.ValueDeclaration != nil
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isPropertyDeclaredInAncestorClass(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessibility","kind":"method","status":"implemented","sigHash":"a17a85c827ee53151f11fc929ddf479020e626ed860c80127b7347b8cbb8f9ef","bodyHash":"006126fe7d3af277c8e904a9c462c63e05c53501944c71edf82441d97b5ac095"}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessibility(node *ast.Node, isSuper bool, writing bool, t *Type, prop *ast.Symbol) bool {
 * 	return c.checkPropertyAccessibilityEx(node, isSuper, writing, t, prop, true /*reportError* /)
 * }
 */
export declare function Checker_checkPropertyAccessibility(receiver: GoPtr<Checker>, node: GoPtr<Node>, isSuper: bool, writing: bool, t: GoPtr<Type>, prop: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessibilityEx","kind":"method","status":"implemented","sigHash":"f33d929107a1191bc8315149b905462b97122873930c6a92df2fafc5ac7d3d55","bodyHash":"1ee990652549e3215482b3c40365dcf21e9b32d43a2dc1addb976bd08de18c87"}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessibilityEx(node *ast.Node, isSuper bool, writing bool, t *Type, prop *ast.Symbol, reportError bool /*  = true * /) bool {
 * 	var errorNode *ast.Node
 * 	if reportError {
 * 		switch node.Kind {
 * 		case ast.KindPropertyAccessExpression:
 * 			errorNode = node.AsPropertyAccessExpression().Name()
 * 		case ast.KindQualifiedName:
 * 			errorNode = node.AsQualifiedName().Right
 * 		case ast.KindImportType:
 * 			errorNode = node
 * 		case ast.KindBindingElement:
 * 			errorNode = getBindingElementPropertyName(node)
 * 		default:
 * 			errorNode = node.Name()
 * 		}
 * 	}
 * 	return c.checkPropertyAccessibilityAtLocation(node, isSuper, writing, t, prop, errorNode)
 * }
 */
export declare function Checker_checkPropertyAccessibilityEx(receiver: GoPtr<Checker>, node: GoPtr<Node>, isSuper: bool, writing: bool, t: GoPtr<Type>, prop: GoPtr<Symbol>, reportError: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAccessibilityAtLocation","kind":"method","status":"implemented","sigHash":"b4da106df205ccc06fc7f92bd9cf7ede921ab6f795924a28ed1483dc5a516ab0","bodyHash":"ccc0b0942ca2c4a744dc44bdb938517bccccd84ddb3d304b13bf84c56221ab77"}
 *
 * Go source:
 * func (c *Checker) checkPropertyAccessibilityAtLocation(location *ast.Node, isSuper bool, writing bool, containingType *Type, prop *ast.Symbol, errorNode *ast.Node) bool {
 * 	flags := getDeclarationModifierFlagsFromSymbolEx(prop, writing)
 * 	if isSuper {
 * 		// TS 1.0 spec (April 2014): 4.8.2
 * 		// - In a constructor, instance member function, instance member accessor, or
 * 		//   instance member variable initializer where this references a derived class instance,
 * 		//   a super property access is permitted and must specify a public instance member function of the base class.
 * 		// - In a static member function or static member accessor
 * 		//   where this references the constructor function object of a derived class,
 * 		//   a super property access is permitted and must specify a public static member function of the base class.
 * 		if flags&ast.ModifierFlagsAbstract != 0 {
 * 			// A method cannot be accessed in a super property access if the method is abstract.
 * 			// This error could mask a private property access error. But, a member
 * 			// cannot simultaneously be private and abstract, so this will trigger an
 * 			// additional error elsewhere.
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Abstract_method_0_in_class_1_cannot_be_accessed_via_super_expression, c.symbolToString(prop), c.TypeToString(c.getDeclaringClass(prop)))
 * 			}
 * 			return false
 * 		}
 * 		// A class field cannot be accessed via super.* from a derived class.
 * 		// This is true for both [[Set]] (old) and [[Define]] (ES spec) semantics.
 * 		if flags&ast.ModifierFlagsStatic == 0 && core.Some(prop.Declarations, isClassInstanceProperty) {
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Class_field_0_defined_by_the_parent_class_is_not_accessible_in_the_child_class_via_super, c.symbolToString(prop))
 * 			}
 * 			return false
 * 		}
 * 	}
 * 	// Referencing abstract properties within their own constructors is not allowed
 * 	if flags&ast.ModifierFlagsAbstract != 0 && c.symbolHasNonMethodDeclaration(prop) && (isThisProperty(location) ||
 * 		isThisInitializedObjectBindingExpression(location) ||
 * 		ast.IsObjectBindingPattern(location.Parent) && isThisInitializedDeclaration(location.Parent.Parent)) {
 * 		parentSymbol := c.getParentOfSymbol(prop)
 * 		if parentSymbol != nil && parentSymbol.Flags&ast.SymbolFlagsClass != 0 && c.isNodeUsedDuringClassInitialization(location) {
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Abstract_property_0_in_class_1_cannot_be_accessed_in_the_constructor, c.symbolToString(prop), c.symbolToString(parentSymbol))
 * 			}
 * 			return false
 * 		}
 * 	}
 * 	// Public properties are otherwise accessible.
 * 	if flags&ast.ModifierFlagsNonPublicAccessibilityModifier == 0 {
 * 		return true
 * 	}
 * 	// Property is known to be private or protected at this point
 * 	// Private property is accessible if the property is within the declaring class
 * 	if flags&ast.ModifierFlagsPrivate != 0 {
 * 		declaringClassDeclaration := ast.GetClassLikeDeclarationOfSymbol(c.getParentOfSymbol(prop))
 * 		if !c.isNodeWithinClass(location, declaringClassDeclaration) {
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Property_0_is_private_and_only_accessible_within_class_1, c.symbolToString(prop), c.TypeToString(c.getDeclaringClass(prop)))
 * 			}
 * 			return false
 * 		}
 * 		return true
 * 	}
 * 	// Property is known to be protected at this point
 * 	// All protected properties of a supertype are accessible in a super access
 * 	if isSuper {
 * 		return true
 * 	}
 * 	// Find the first enclosing class that has the declaring classes of the protected constituents
 * 	// of the property as base classes
 * 	var enclosingClass *Type
 * 	container := ast.GetContainingClass(location)
 * 	for container != nil {
 * 		class := c.getDeclaredTypeOfSymbol(c.getSymbolOfDeclaration(container))
 * 		if c.isClassDerivedFromDeclaringClasses(class, prop, writing) {
 * 			enclosingClass = class
 * 			break
 * 		}
 * 		container = ast.GetContainingClass(container)
 * 	}
 * 	// A protected property is accessible if the property is within the declaring class or classes derived from it
 * 	if enclosingClass == nil {
 * 		// allow PropertyAccessibility if context is in function with this parameter
 * 		// static member access is disallowed
 * 		class := c.getEnclosingClassFromThisParameter(location)
 * 		if class != nil && c.isClassDerivedFromDeclaringClasses(class, prop, writing) {
 * 			enclosingClass = class
 * 		}
 * 		if flags&ast.ModifierFlagsStatic != 0 || enclosingClass == nil {
 * 			if errorNode != nil {
 * 				class := c.getDeclaringClass(prop)
 * 				if class == nil {
 * 					class = containingType
 * 				}
 * 				c.error(errorNode, diagnostics.Property_0_is_protected_and_only_accessible_within_class_1_and_its_subclasses, c.symbolToString(prop), c.TypeToString(class))
 * 			}
 * 			return false
 * 		}
 * 	}
 * 	// No further restrictions for static properties
 * 	if flags&ast.ModifierFlagsStatic != 0 {
 * 		return true
 * 	}
 * 	if containingType.flags&TypeFlagsTypeParameter != 0 {
 * 		// get the original type -- represented as the type constraint of the 'this' type
 * 		if containingType.AsTypeParameter().isThisType {
 * 			containingType = c.getConstraintOfTypeParameter(containingType)
 * 		} else {
 * 			containingType = c.getBaseConstraintOfType(containingType)
 * 		}
 * 	}
 * 	if containingType == nil || !c.hasBaseType(containingType, enclosingClass) {
 * 		if errorNode != nil && containingType != nil {
 * 			c.error(errorNode, diagnostics.Property_0_is_protected_and_only_accessible_through_an_instance_of_class_1_This_is_an_instance_of_class_2, c.symbolToString(prop), c.TypeToString(enclosingClass), c.TypeToString(containingType))
 * 		}
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function Checker_checkPropertyAccessibilityAtLocation(receiver: GoPtr<Checker>, location: GoPtr<Node>, isSuper: bool, writing: bool, containingType: GoPtr<Type>, prop: GoPtr<Symbol>, errorNode: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.symbolHasNonMethodDeclaration","kind":"method","status":"implemented","sigHash":"37a1f6d6430cb7479ff53356e52641eb347ac21076c283db53db229f47ebb0ce","bodyHash":"50de700783caad7ad2c66fbb20d1a3c311dbc97924bbe8207076206775e06c13"}
 *
 * Go source:
 * func (c *Checker) symbolHasNonMethodDeclaration(symbol *ast.Symbol) bool {
 * 	return c.forEachProperty(symbol, func(prop *ast.Symbol) bool { return prop.Flags&ast.SymbolFlagsMethod == 0 })
 * }
 */
export declare function Checker_symbolHasNonMethodDeclaration(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.forEachProperty","kind":"method","status":"implemented","sigHash":"306a2016424241098e939de2bb3f7b2f9cb5846ba8e8e72e63b272e8c3fe149c","bodyHash":"1fc96d07adc07c562e1165fb22d98e27b903d605a3f00870b7c26a818c5e9010"}
 *
 * Go source:
 * func (c *Checker) forEachProperty(prop *ast.Symbol, callback func(p *ast.Symbol) bool) bool {
 * 	if prop.CheckFlags&ast.CheckFlagsSynthetic == 0 {
 * 		return callback(prop)
 * 	}
 * 	for _, t := range c.valueSymbolLinks.Get(prop).containingType.Types() {
 * 		p := c.getPropertyOfType(t, prop.Name)
 * 		if p != nil && c.forEachProperty(p, callback) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_forEachProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, callback: (p: GoPtr<Symbol>) => bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyInClassDerivedFrom","kind":"method","status":"implemented","sigHash":"84211c6f0b174a105f4c95139396d6ddb891dd6a7283048409d401382b21d1b1","bodyHash":"35a7437efcf5f441d5369e8abf618d2f84ca685b821a3fd4ce8c9da1e3f64939"}
 *
 * Go source:
 * func (c *Checker) isPropertyInClassDerivedFrom(prop *ast.Symbol, baseClass *Type) bool {
 * 	return c.forEachProperty(prop, func(sp *ast.Symbol) bool {
 * 		sourceClass := c.getDeclaringClass(sp)
 * 		if sourceClass != nil {
 * 			return c.hasBaseType(sourceClass, baseClass)
 * 		}
 * 		return false
 * 	})
 * }
 */
export declare function Checker_isPropertyInClassDerivedFrom(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, baseClass: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.classDeclarationExtendsNull","kind":"method","status":"implemented","sigHash":"2f951f9452e8b15d0eafef6ca23f9bf8fbec61b89aea21ac6d84a3e192632fa4","bodyHash":"723a0c39c278600201eccafd669975db6eeaa2e17851348a99e23c3b41da7eed"}
 *
 * Go source:
 * func (c *Checker) classDeclarationExtendsNull(classDecl *ast.Node) bool {
 * 	classSymbol := c.getSymbolOfDeclaration(classDecl)
 * 	classInstanceType := c.getDeclaredTypeOfSymbol(classSymbol)
 * 	baseConstructorType := c.getBaseConstructorTypeOfClass(classInstanceType)
 * 	return baseConstructorType == c.nullWideningType
 * }
 */
export declare function Checker_classDeclarationExtendsNull(receiver: GoPtr<Checker>, classDecl: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkForDisallowedESSymbolOperand","kind":"method","status":"implemented","sigHash":"a1e58978962bf4a8a4331d7f009affb98408d1e6f125ae98556c3701b9c48e58","bodyHash":"1638e683d695711202d1b82835aab673ba078b5b2026551ff72fd8644ae8c0ae"}
 *
 * Go source:
 * func (c *Checker) checkForDisallowedESSymbolOperand(left *ast.Node, right *ast.Node, leftType *Type, rightType *Type, operator ast.Kind) bool {
 * 	var offendingSymbolOperand *ast.Node
 * 	switch {
 * 	case c.maybeTypeOfKindConsideringBaseConstraint(leftType, TypeFlagsESSymbolLike):
 * 		offendingSymbolOperand = left
 * 	case c.maybeTypeOfKindConsideringBaseConstraint(rightType, TypeFlagsESSymbolLike):
 * 		offendingSymbolOperand = right
 * 	}
 * 	if offendingSymbolOperand != nil {
 * 		c.error(offendingSymbolOperand, diagnostics.The_0_operator_cannot_be_applied_to_type_symbol, scanner.TokenToString(operator))
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function Checker_checkForDisallowedESSymbolOperand(receiver: GoPtr<Checker>, left: GoPtr<Node>, right: GoPtr<Node>, leftType: GoPtr<Type>, rightType: GoPtr<Type>, operator: Kind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGlobalNaN","kind":"method","status":"implemented","sigHash":"18c5c1c190d428d3dd8461bae7988f52df7522e9c24c434dc41e07a5fdfa793d","bodyHash":"ee4fd33701943e239d83eccf46b5d430f99ea94ba909b917116ced20e526b46b"}
 *
 * Go source:
 * func (c *Checker) isGlobalNaN(expr *ast.Expression) bool {
 * 	if ast.IsIdentifier(expr) && expr.Text() == "NaN" {
 * 		globalNaNSymbol := c.getGlobalNaNSymbolOrNil()
 * 		return globalNaNSymbol != nil && globalNaNSymbol == c.getResolvedSymbol(expr)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isGlobalNaN(receiver: GoPtr<Checker>, expr: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isExactOptionalPropertyMismatch","kind":"method","status":"implemented","sigHash":"48836524b38bf413fd3531da5976e96420b74c344bdcda9ef3156e259b7deced","bodyHash":"0558320ed8d9bdb2019ce0b3110d0fd2dde51dc1dac4b9fc45376e24c055a2b3"}
 *
 * Go source:
 * func (c *Checker) isExactOptionalPropertyMismatch(source *Type, target *Type) bool {
 * 	return source != nil && target != nil && c.maybeTypeOfKind(source, TypeFlagsUndefined) && c.containsMissingType(target)
 * }
 */
export declare function Checker_isExactOptionalPropertyMismatch(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfoWithReadonly","kind":"method","status":"implemented","sigHash":"765207f32448fbfbea1c0ad79056eccf956d8957d11f7417266450388b1241de","bodyHash":"37f3d2548186081ae5658d663645bd79db99caebf972b21e24f718f89f67e343"}
 *
 * Go source:
 * func (c *Checker) getIndexInfoWithReadonly(info *IndexInfo, readonly bool) *IndexInfo {
 * 	if info.isReadonly != readonly {
 * 		return c.newIndexInfo(info.keyType, info.valueType, readonly, info.declaration, info.components)
 * 	}
 * 	return info
 * }
 */
export declare function Checker_getIndexInfoWithReadonly(receiver: GoPtr<Checker>, info: GoPtr<IndexInfo>, readonly: bool): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUnionIndexInfos","kind":"method","status":"implemented","sigHash":"8c69462c533360820c7e04e96ebeb5dddd031398016f24259623ec08450dda1d","bodyHash":"09ca1dbd4b196c59f5e8bddf1ecbdadb088e708a96f15d331f2d22e97ff609ce"}
 *
 * Go source:
 * func (c *Checker) getUnionIndexInfos(types []*Type) []*IndexInfo {
 * 	sourceInfos := c.getIndexInfosOfType(types[0])
 * 	var result []*IndexInfo
 * 	for _, info := range sourceInfos {
 * 		indexType := info.keyType
 * 		if core.Every(types, func(t *Type) bool { return c.getIndexInfoOfType(t, indexType) != nil }) {
 * 			valueType := c.getUnionType(core.Map(types, func(t *Type) *Type {
 * 				return c.getIndexTypeOfType(t, indexType)
 * 			}))
 * 			isReadonly := core.Some(types, func(t *Type) bool { return c.getIndexInfoOfType(t, indexType).isReadonly })
 * 			result = append(result, c.newIndexInfo(indexType, valueType, isReadonly, nil, nil))
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getUnionIndexInfos(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSpreadableProperty","kind":"method","status":"implemented","sigHash":"72726c888eecf201fde3293fd5c3dfc72bf6e416e415faa180c5d7769d703740","bodyHash":"b22e0ae4c4f4147472015250a83701261cba2dc45f4b9de3d083ee56fbd142d4"}
 *
 * Go source:
 * func (c *Checker) isSpreadableProperty(prop *ast.Symbol) bool {
 * 	return !core.Some(prop.Declarations, ast.IsPrivateIdentifierClassElementDeclaration) && prop.Flags&(ast.SymbolFlagsMethod|ast.SymbolFlagsGetAccessor|ast.SymbolFlagsSetAccessor) == 0 ||
 * 		!core.Some(prop.Declarations, func(d *ast.Node) bool { return d.Parent != nil && ast.IsClassLike(d.Parent) })
 * }
 */
export declare function Checker_isSpreadableProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSpreadSymbol","kind":"method","status":"implemented","sigHash":"cc8a21a48f46f09fe4b18c420fb1f0502e811069e08bbf7d374890985990e480","bodyHash":"2224d8e08e91316c71f11361c81ca22e1abb7fbb1759edef2c88efe79491a639"}
 *
 * Go source:
 * func (c *Checker) getSpreadSymbol(prop *ast.Symbol, readonly bool) *ast.Symbol {
 * 	isSetonlyAccessor := prop.Flags&ast.SymbolFlagsSetAccessor != 0 && prop.Flags&ast.SymbolFlagsGetAccessor == 0
 * 	if !isSetonlyAccessor && readonly == c.isReadonlySymbol(prop) {
 * 		return prop
 * 	}
 * 	flags := ast.SymbolFlagsProperty | (prop.Flags & ast.SymbolFlagsOptional)
 * 	result := c.newSymbolEx(flags, prop.Name, prop.CheckFlags&ast.CheckFlagsLate|core.IfElse(readonly, ast.CheckFlagsReadonly, 0))
 * 	links := c.valueSymbolLinks.Get(result)
 * 	if isSetonlyAccessor {
 * 		links.resolvedType = c.undefinedType
 * 	} else {
 * 		links.resolvedType = c.getTypeOfSymbol(prop)
 * 	}
 * 	result.Declarations = prop.Declarations
 * 	links.nameType = c.valueSymbolLinks.Get(prop).nameType
 * 	c.mappedSymbolLinks.Get(result).syntheticOrigin = prop
 * 	return result
 * }
 */
export declare function Checker_getSpreadSymbol(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, readonly: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isInPropertyInitializerOrClassStaticBlock","kind":"method","status":"implemented","sigHash":"10b8aecdf1f80cdb5733611d191f39ac64164364ea9e463780ed3d468fce01cc","bodyHash":"2461033cabb609f38276b99bdda8417e1820029f566484efe2520c519191bd3c"}
 *
 * Go source:
 * func (c *Checker) isInPropertyInitializerOrClassStaticBlock(node *ast.Node, ignoreArrowFunctions bool) bool {
 * 	return ast.FindAncestorOrQuit(node, func(node *ast.Node) ast.FindAncestorResult {
 * 		switch node.Kind {
 * 		case ast.KindPropertyDeclaration, ast.KindClassStaticBlockDeclaration:
 * 			return ast.FindAncestorTrue
 * 		case ast.KindTypeQuery, ast.KindJsxClosingElement:
 * 			return ast.FindAncestorQuit
 * 		case ast.KindArrowFunction:
 * 			return core.IfElse(ignoreArrowFunctions, ast.FindAncestorFalse, ast.FindAncestorQuit)
 * 		case ast.KindBlock:
 * 			return core.IfElse(ast.IsFunctionLikeDeclaration(node.Parent) && node.Parent.Kind != ast.KindArrowFunction, ast.FindAncestorQuit, ast.FindAncestorFalse)
 * 		default:
 * 			return ast.FindAncestorFalse
 * 		}
 * 	}) != nil
 * }
 */
export declare function Checker_isInPropertyInitializerOrClassStaticBlock(receiver: GoPtr<Checker>, node: GoPtr<Node>, ignoreArrowFunctions: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isReadonlySymbol","kind":"method","status":"implemented","sigHash":"7a2ce88a6d613e7ccff1f07d84e98cbf67067705cf409f609b4a1150d7cc7ea4","bodyHash":"ce25c428bffa79ba22f6824c3a2d4bbb2f7332829d89b3f3fd825adf6448345e"}
 *
 * Go source:
 * func (c *Checker) isReadonlySymbol(symbol *ast.Symbol) bool {
 * 	// The following symbols are considered read-only:
 * 	// Properties with a 'readonly' modifier
 * 	// Variables declared with 'const'
 * 	// Get accessors without matching set accessors
 * 	// Enum members
 * 	// Object.defineProperty assignments with writable false or no setter
 * 	// Unions and intersections of the above (unions and intersections eagerly set isReadonly on creation)
 * 	return symbol.CheckFlags&ast.CheckFlagsReadonly != 0 ||
 * 		symbol.Flags&ast.SymbolFlagsProperty != 0 && getDeclarationModifierFlagsFromSymbol(symbol)&ast.ModifierFlagsReadonly != 0 ||
 * 		symbol.Flags&ast.SymbolFlagsVariable != 0 && c.getDeclarationNodeFlagsFromSymbol(symbol)&ast.NodeFlagsConstant != 0 ||
 * 		symbol.Flags&ast.SymbolFlagsAccessor != 0 && symbol.Flags&ast.SymbolFlagsSetAccessor == 0 ||
 * 		symbol.Flags&ast.SymbolFlagsEnumMember != 0 ||
 * 		core.Some(symbol.Declarations, c.isReadonlyAssignmentDeclaration)
 * }
 */
export declare function Checker_isReadonlySymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedSymbol","kind":"method","status":"implemented","sigHash":"69b7754da2e6d7e294fb76b110a3b8cc3d5c6ae735db0956077d33f642f7b732","bodyHash":"9e28f794d6cc3df21005db918e58a886234d170b81b6fa4dde1ca57239058a89"}
 *
 * Go source:
 * func (c *Checker) getResolvedSymbol(node *ast.Node) *ast.Symbol {
 * 	links := c.symbolNodeLinks.Get(node)
 * 	if links.resolvedSymbol == nil {
 * 		var symbol *ast.Symbol
 * 		if !ast.NodeIsMissing(node) {
 * 			symbol = c.resolveName(node, node.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsExportValue,
 * 				c.getCannotFindNameDiagnosticForName(node), !ast.IsWriteOnlyAccess(node), false /*excludeGlobals* /)
 * 		}
 * 		links.resolvedSymbol = core.OrElse(symbol, c.unknownSymbol)
 * 	}
 * 	return links.resolvedSymbol
 * }
 */
export declare function Checker_getResolvedSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedSymbolOrNil","kind":"method","status":"implemented","sigHash":"235107603e4ad70aaa9b0ccbb0fc3231698242e838f8f150b0f1fabef34f59e7","bodyHash":"7158f6ab3da8cd7bf7cd02ac22e13936aa8f7e05d177ed1061fdc3402368eac8"}
 *
 * Go source:
 * func (c *Checker) getResolvedSymbolOrNil(node *ast.Node) *ast.Symbol {
 * 	return c.symbolNodeLinks.Get(node).resolvedSymbol
 * }
 */
export declare function Checker_getResolvedSymbolOrNil(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReferencedValueOrAliasSymbol","kind":"method","status":"implemented","sigHash":"ce802f6bff3fbaf4566840f9dce963cdbc7e2cca308b14a6d1f072589f905798","bodyHash":"62c825ab6d589ba97f22c29b638cc219988e01cc68ef2f3c4e46c2512c2758b3"}
 *
 * Go source:
 * func (c *Checker) getReferencedValueOrAliasSymbol(reference *ast.Node) *ast.Symbol {
 * 	resolvedSymbol := c.symbolNodeLinks.Get(reference).resolvedSymbol
 * 	if resolvedSymbol != nil && resolvedSymbol != c.unknownSymbol {
 * 		return resolvedSymbol
 * 	}
 * 	return c.resolveName(reference, reference.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsExportValue|ast.SymbolFlagsAlias, nil, true /*isUse* /, false /*excludeGlobals* /)
 * }
 */
export declare function Checker_getReferencedValueOrAliasSymbol(receiver: GoPtr<Checker>, reference: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newSymbol","kind":"method","status":"implemented","sigHash":"e8d8f0b308e72006129ca9b78faebb81856c853d490f53a68746fd0c141ae9a8","bodyHash":"b8e4744cb38e6532ead13a3352361c766b75237a7f95bf7e98f6c3552094853c"}
 *
 * Go source:
 * func (c *Checker) newSymbol(flags ast.SymbolFlags, name string) *ast.Symbol {
 * 	c.SymbolCount++
 * 	result := c.symbolArena.New()
 * 	result.Flags = flags | ast.SymbolFlagsTransient
 * 	result.Name = name
 * 	return result
 * }
 */
export declare function Checker_newSymbol(receiver: GoPtr<Checker>, flags: SymbolFlags, name: string): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newSymbolEx","kind":"method","status":"implemented","sigHash":"e343953fcf4aa7d92aa7829bf4ccdb8f0f343a317d715f2154163ab6971365e1","bodyHash":"a2bb26c4bb78c1d3869d4b3aabe3c7049738018929431b660c7db217e3624f05"}
 *
 * Go source:
 * func (c *Checker) newSymbolEx(flags ast.SymbolFlags, name string, checkFlags ast.CheckFlags) *ast.Symbol {
 * 	result := c.newSymbol(flags, name)
 * 	result.CheckFlags = checkFlags
 * 	return result
 * }
 */
export declare function Checker_newSymbolEx(receiver: GoPtr<Checker>, flags: SymbolFlags, name: string, checkFlags: CheckFlags): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newProperty","kind":"method","status":"implemented","sigHash":"0515781d95a8803bdaf2962db1bc99269e956ec23198c458aa04f21884f11d9b","bodyHash":"f21ea6e0aa24d927d95c177bb37b4d51598f49e6e997c5222122ea6b6fc52599"}
 *
 * Go source:
 * func (c *Checker) newProperty(name string, t *Type) *ast.Symbol {
 * 	symbol := c.newSymbol(ast.SymbolFlagsProperty, name)
 * 	c.valueSymbolLinks.Get(symbol).resolvedType = t
 * 	return symbol
 * }
 */
export declare function Checker_newProperty(receiver: GoPtr<Checker>, name: string, t: GoPtr<Type>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.combineSymbolTables","kind":"method","status":"implemented","sigHash":"a1d72bcd91eeb2a80cec30e840f2303930437c46f7ea17775066c4358cf22e5a","bodyHash":"50c97476be9d5b923129ed2ee2cac80211cf28e14627be46ed2e5056a4831369"}
 *
 * Go source:
 * func (c *Checker) combineSymbolTables(first ast.SymbolTable, second ast.SymbolTable) ast.SymbolTable {
 * 	if len(first) == 0 {
 * 		return second
 * 	}
 * 	if len(second) == 0 {
 * 		return first
 * 	}
 * 	combined := make(ast.SymbolTable)
 * 	c.mergeSymbolTable(combined, first, false, nil)
 * 	c.mergeSymbolTable(combined, second, false, nil)
 * 	return combined
 * }
 */
export declare function Checker_combineSymbolTables(receiver: GoPtr<Checker>, first: SymbolTable, second: SymbolTable): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mergeSymbolTable","kind":"method","status":"implemented","sigHash":"2dd109a71bd36a54cb176ba0fe9dd1bc93a7bffcf73731be9d80570825291351","bodyHash":"5b2f93b208a7282284cfc28fd710564750230200a2dab40c74740a1b0f1404bd"}
 *
 * Go source:
 * func (c *Checker) mergeSymbolTable(target ast.SymbolTable, source ast.SymbolTable, unidirectional bool, mergedParent *ast.Symbol) {
 * 	for id, sourceSymbol := range source {
 * 		targetSymbol := target[id]
 * 		var merged *ast.Symbol
 * 		if targetSymbol != nil {
 * 			merged = c.mergeSymbol(targetSymbol, sourceSymbol, unidirectional)
 * 		} else {
 * 			merged = c.getMergedSymbol(sourceSymbol)
 * 		}
 * 		if mergedParent != nil && targetSymbol != nil {
 * 			// If a merge was performed on the target symbol, set its parent to the merged parent that initiated the merge
 * 			// of its exports. Otherwise, `merged` came only from `sourceSymbol` and can keep its parent:
 * 			//
 * 			// // a.ts
 * 			// export interface A { x: number; }
 * 			//
 * 			// // b.ts
 * 			// declare module "./a" {
 * 			//   interface A { y: number; }
 * 			//   interface B {}
 * 			// }
 * 			//
 * 			// When merging the module augmentation into a.ts, the symbol for `A` will itself be merged, so its parent
 * 			// should be the merged module symbol. But the symbol for `B` has only one declaration, so its parent should
 * 			// be the module augmentation symbol, which contains its only declaration.
 * 			if merged.Flags&ast.SymbolFlagsTransient != 0 {
 * 				merged.Parent = mergedParent
 * 			}
 * 		}
 * 		target[id] = merged
 * 	}
 * }
 */
export declare function Checker_mergeSymbolTable(receiver: GoPtr<Checker>, target: SymbolTable, source: SymbolTable, unidirectional: bool, mergedParent: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mergeSymbol","kind":"method","status":"implemented","sigHash":"549d4016720d25406a29634111412e0818b6a366ec376693679996cb899ae475","bodyHash":"4cbf61fd4e80bccd30478a793bb12951fa777d163e99738d5849f70946412b5c"}
 *
 * Go source:
 * func (c *Checker) mergeSymbol(target *ast.Symbol, source *ast.Symbol, unidirectional bool) *ast.Symbol {
 * 	if target.Flags&getExcludedSymbolFlags(source.Flags) == 0 || (source.Flags|target.Flags)&ast.SymbolFlagsAssignment != 0 {
 * 		if source == target {
 * 			// This can happen when an export assigned namespace exports something also erroneously exported at the top level
 * 			// See `declarationFileNoCrashOnExtraExportModifier` for an example
 * 			return target
 * 		}
 * 		if target.Flags&ast.SymbolFlagsTransient == 0 {
 * 			resolvedTarget := c.resolveSymbol(target)
 * 			if resolvedTarget == c.unknownSymbol {
 * 				return source
 * 			}
 * 			if resolvedTarget.Flags&getExcludedSymbolFlags(source.Flags) == 0 || (source.Flags|resolvedTarget.Flags)&ast.SymbolFlagsAssignment != 0 {
 * 				target = c.cloneSymbol(resolvedTarget)
 * 			} else {
 * 				c.reportMergeSymbolError(target, source)
 * 				return source
 * 			}
 * 		}
 * 		// Javascript static-property-assignment declarations always merge, even though they are also values
 * 		if source.Flags&ast.SymbolFlagsValueModule != 0 && target.Flags&ast.SymbolFlagsValueModule != 0 && target.Flags&ast.SymbolFlagsConstEnumOnlyModule != 0 && source.Flags&ast.SymbolFlagsConstEnumOnlyModule == 0 {
 * 			// reset flag when merging instantiated module into value module that has only const enums
 * 			target.Flags &^= ast.SymbolFlagsConstEnumOnlyModule
 * 		}
 * 		target.Flags |= source.Flags
 * 		if source.ValueDeclaration != nil {
 * 			binder.SetValueDeclaration(target, source.ValueDeclaration)
 * 		}
 * 		target.Declarations = append(target.Declarations, source.Declarations...)
 * 		if source.Members != nil {
 * 			c.mergeSymbolTable(ast.GetSymbolTable(&target.Members), source.Members, unidirectional, nil)
 * 		}
 * 		if source.Exports != nil {
 * 			c.mergeSymbolTable(ast.GetSymbolTable(&target.Exports), source.Exports, unidirectional, target)
 * 		}
 * 		if !unidirectional {
 * 			c.recordMergedSymbol(target, source)
 * 		}
 * 	} else if target.Flags&ast.SymbolFlagsNamespaceModule != 0 {
 * 		// Do not report an error when merging `var globalThis` with the built-in `globalThis`,
 * 		// as we will already report a "Declaration name conflicts..." error, and this error
 * 		// won't make much sense.
 * 		if target != c.globalThisSymbol {
 * 			c.error(ast.GetNameOfDeclaration(getFirstDeclaration(source)), diagnostics.Cannot_augment_module_0_with_value_exports_because_it_resolves_to_a_non_module_entity, c.symbolToString(target))
 * 		}
 * 	} else {
 * 		c.reportMergeSymbolError(target, source)
 * 	}
 * 	return target
 * }
 */
export declare function Checker_mergeSymbol(receiver: GoPtr<Checker>, target: GoPtr<Symbol>, source: GoPtr<Symbol>, unidirectional: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.cloneSymbol","kind":"method","status":"implemented","sigHash":"3c2f1db0d6708a640c321f62e31830154de2c369a1921baeb8dae4878af80807","bodyHash":"eb0f3944f68d874e8993334a89816413b77d3b76d86ede3b8cc31a5dd57a3e50"}
 *
 * Go source:
 * func (c *Checker) cloneSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	result := c.newSymbol(symbol.Flags, symbol.Name)
 * 	// Force reallocation if anything is ever appended to declarations
 * 	result.Declarations = symbol.Declarations[0:len(symbol.Declarations):len(symbol.Declarations)]
 * 	result.Parent = symbol.Parent
 * 	result.ValueDeclaration = symbol.ValueDeclaration
 * 	result.Members = maps.Clone(symbol.Members)
 * 	result.Exports = maps.Clone(symbol.Exports)
 * 	c.recordMergedSymbol(result, symbol)
 * 	return result
 * }
 */
export declare function Checker_cloneSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getMergedSymbol","kind":"method","status":"implemented","sigHash":"394b0c690835c5edfcca893acd433cc773c656e1df4cb39b96f1692a4ff4bae9","bodyHash":"3e4febd7b6220c67afcde6945cc24d99cb17fb718fb9d5082a917a04795a49b2"}
 *
 * Go source:
 * func (c *Checker) getMergedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol != nil {
 * 		merged := c.mergedSymbols[symbol]
 * 		if merged != nil {
 * 			return merged
 * 		}
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_getMergedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getParentOfSymbol","kind":"method","status":"implemented","sigHash":"3ee74edce035ff1f0006030fac5cca1e47ea3ce2779e7783690a002f4b00ebba","bodyHash":"3e95706a831fa9b0c568744916588445a6cb9a43fe2621d989a201785c9999df"}
 *
 * Go source:
 * func (c *Checker) getParentOfSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol.Parent != nil {
 * 		return c.getMergedSymbol(c.getLateBoundSymbol(symbol.Parent))
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getParentOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.recordMergedSymbol","kind":"method","status":"implemented","sigHash":"eb500b00ce836196dbfc459306e92833ec70157b885f079950690328534576ad","bodyHash":"b93f8ae5f58b3d188d1f14aecf0522a7e5559769bb6c80c2169a6f0fcfda8dda"}
 *
 * Go source:
 * func (c *Checker) recordMergedSymbol(target *ast.Symbol, source *ast.Symbol) {
 * 	c.mergedSymbols[source] = target
 * }
 */
export declare function Checker_recordMergedSymbol(receiver: GoPtr<Checker>, target: GoPtr<Symbol>, source: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolIfSameReference","kind":"method","status":"implemented","sigHash":"cbf895c056870f21f0bbc6c4750a6b0fa3957e19ba763f99a46e5a38464ee5d2","bodyHash":"cff34ec3aeab561c7adbe345604ad8dfeb3daed5b38dbbae38dea94e432cf139"}
 *
 * Go source:
 * func (c *Checker) getSymbolIfSameReference(s1 *ast.Symbol, s2 *ast.Symbol) *ast.Symbol {
 * 	// An instantiated symbol (e.g. a parameter of a signature instantiated to substitute `this`)
 * 	// refers to the same declaration as its instantiation target. Whether a given context yields the
 * 	// original symbol or an instantiated copy can depend on incidental checker cache state (see
 * 	// instantiateSymbol, whose reuse shortcut is gated on the type already being resolved), so unwrap
 * 	// instantiations here to keep "same reference" answers deterministic.
 * 	if c.getMergedSymbol(c.resolveSymbol(c.getMergedSymbol(c.getTargetSymbol(s1)))) == c.getMergedSymbol(c.resolveSymbol(c.getMergedSymbol(c.getTargetSymbol(s2)))) {
 * 		return s1
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getSymbolIfSameReference(receiver: GoPtr<Checker>, s1: GoPtr<Symbol>, s2: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExportSymbolOfValueSymbolIfExported","kind":"method","status":"implemented","sigHash":"27e3671d529695ec6703c8814dcecf7650accdb537bc1af9d0e56cba439d7d7f","bodyHash":"8ca818a931e88c9258df259236d7a23d07fc206fb63196d4b8f52c3fd0cc063b"}
 *
 * Go source:
 * func (c *Checker) getExportSymbolOfValueSymbolIfExported(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol != nil && symbol.Flags&ast.SymbolFlagsExportValue != 0 && symbol.ExportSymbol != nil {
 * 		symbol = symbol.ExportSymbol
 * 	}
 * 	return c.getMergedSymbol(symbol)
 * }
 */
export declare function Checker_getExportSymbolOfValueSymbolIfExported(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolOfDeclaration","kind":"method","status":"implemented","sigHash":"af162eca3a95c118553bd2b408f78285c832f4b1d738347d43a64cc18a9d0c6a","bodyHash":"33f83edc374a8c07823187941d904230ea7453a3862eefa62428259d2cf86d5d"}
 *
 * Go source:
 * func (c *Checker) getSymbolOfDeclaration(node *ast.Node) *ast.Symbol {
 * 	symbol := node.Symbol()
 * 	if symbol != nil {
 * 		return c.getMergedSymbol(c.getLateBoundSymbol(symbol))
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getSymbolOfDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolOfNode","kind":"method","status":"implemented","sigHash":"b968930645cdc05be62206e5a97be231fa7273c398bdabb5828064953a59fa4b","bodyHash":"01d40edb6d0396523eec962d1da6f0367a89e7a51a2af47e0cf73b77fd8e37d8"}
 *
 * Go source:
 * func (c *Checker) getSymbolOfNode(node *ast.Node) *ast.Symbol {
 * 	data := node.DeclarationData()
 * 	if data != nil && data.Symbol != nil {
 * 		return c.getMergedSymbol(c.getLateBoundSymbol(data.Symbol))
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getSymbolOfNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLateBoundSymbol","kind":"method","status":"implemented","sigHash":"c4edbfcb4541868964d2f855dddbd9a862133956c8b015b2e51ef629adf5574b","bodyHash":"548bd5521a476834033140a6179b173c47c9ba95be5ff5b79e4787fc28cfd5d6"}
 *
 * Go source:
 * func (c *Checker) getLateBoundSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsClassMember == 0 || symbol.Name != ast.InternalSymbolNameComputed {
 * 		return symbol
 * 	}
 * 	links := c.lateBoundLinks.Get(symbol)
 * 	if links.lateSymbol == nil && core.Some(symbol.Declarations, c.hasLateBindableName) {
 * 		// force late binding of members/exports. This will set the late-bound symbol
 * 		parent := c.getMergedSymbol(symbol.Parent)
 * 		if core.Some(symbol.Declarations, ast.HasStaticModifier) {
 * 			c.getExportsOfSymbol(parent)
 * 		} else {
 * 			c.getMembersOfSymbol(parent)
 * 		}
 * 	}
 * 	if links.lateSymbol == nil {
 * 		links.lateSymbol = symbol
 * 	}
 * 	return links.lateSymbol
 * }
 */
export declare function Checker_getLateBoundSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveSymbol","kind":"method","status":"implemented","sigHash":"3991c1c1ce244f5384696330d7d902f596775342b22bb9839cffc448a5201505","bodyHash":"3abd1a0c7aba609d2f4f45286a68b59533cf5c7b63b996d93ec0a6da2c65959d"}
 *
 * Go source:
 * func (c *Checker) resolveSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.resolveSymbolEx(symbol, false /*dontResolveAlias* /)
 * }
 */
export declare function Checker_resolveSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveSymbolEx","kind":"method","status":"implemented","sigHash":"aa5be2d941b76f8be07976b8d35179c0d5f238d2929c416095cafb0dd4f3e32a","bodyHash":"641112877f1e025fc31faa829d2e9f885089e717e04177bffcb3119ce735fb04"}
 *
 * Go source:
 * func (c *Checker) resolveSymbolEx(symbol *ast.Symbol, dontResolveAlias bool) *ast.Symbol {
 * 	if !dontResolveAlias && ast.IsNonLocalAlias(symbol, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace) {
 * 		return c.resolveAlias(symbol)
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_resolveSymbolEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"d1343fa252ccb43ff4d227682fa23b885a7dd3a8f757c0f15b04129af66d5f36","bodyHash":"1001d2d043f4847de0bb7c6ed74c7604c82cfa8ba06a67ac4270d2f0bb9d7540"}
 *
 * Go source:
 * func (c *Checker) getTargetOfImportEqualsDeclaration(node *ast.Node) *ast.Symbol {
 * 	// Node is ImportEqualsDeclaration | VariableDeclaration
 * 	if ast.IsVariableDeclaration(node) || node.AsImportEqualsDeclaration().ModuleReference.Kind == ast.KindExternalModuleReference {
 * 		moduleReference := getExternalModuleRequireArgument(node)
 * 		if moduleReference == nil {
 * 			moduleReference = ast.GetExternalModuleImportEqualsDeclarationExpression(node)
 * 		}
 * 		immediate := c.resolveExternalModuleName(node, moduleReference, false /*ignoreErrors* /)
 * 		resolved := c.resolveExternalModuleSymbol(immediate, true /*dontResolveAlias* /)
 * 		if resolved != nil && core.ModuleKindNode20 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext {
 * 			moduleExports := c.getExportOfModule(resolved, ast.InternalSymbolNameModuleExports, node, true /*dontResolveAlias* /)
 * 			if moduleExports != nil {
 * 				return moduleExports
 * 			}
 * 		}
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 		return resolved
 * 	}
 * 	resolved := c.getSymbolOfPartOfRightHandSideOfImportEquals(node.AsImportEqualsDeclaration().ModuleReference)
 * 	c.checkAndReportErrorForResolvingImportAliasToTypeOnlySymbol(node, resolved)
 * 	return resolved
 * }
 */
export declare function Checker_getTargetOfImportEqualsDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolOfPartOfRightHandSideOfImportEquals","kind":"method","status":"implemented","sigHash":"3a388399fc17d2be46ba9f964f01acff689b05a5b57f211394efe90c58a5a9db","bodyHash":"bd0dec06265688045841f096e5a869c1093b3196a347aeaafc4cd3f1ee8716ee"}
 *
 * Go source:
 * func (c *Checker) getSymbolOfPartOfRightHandSideOfImportEquals(entityName *ast.Node) *ast.Symbol {
 * 	// There are three things we might try to look for. In the following examples,
 * 	// the search term is enclosed in |...|:
 * 	//
 * 	//     import a = |b|; // Namespace
 * 	//     import a = |b.c|; // Value, type, namespace
 * 	//     import a = |b.c|.d; // Namespace
 * 	if entityName.Kind == ast.KindIdentifier && ast.IsRightSideOfQualifiedNameOrPropertyAccess(entityName) {
 * 		entityName = entityName.Parent // QualifiedName
 * 	}
 * 	// Check for case 1 and 3 in the above example
 * 	if entityName.Kind == ast.KindIdentifier || entityName.Parent.Kind == ast.KindQualifiedName {
 * 		return c.resolveEntityName(entityName, ast.SymbolFlagsNamespace, false /*ignoreErrors* /, true /*dontResolveAlias* /, nil /*location* /)
 * 	}
 * 	// Case 2 in above example
 * 	// entityName.kind could be a QualifiedName or a Missing identifier
 * 	debug.Assert(entityName.Parent.Kind == ast.KindImportEqualsDeclaration)
 * 	return c.resolveEntityName(entityName, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, false /*ignoreErrors* /, true /*dontResolveAlias* /, nil /*location* /)
 * }
 */
export declare function Checker_getSymbolOfPartOfRightHandSideOfImportEquals(receiver: GoPtr<Checker>, entityName: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOnlyDeclarationOfEntityName","kind":"method","status":"implemented","sigHash":"f13dcaee0b8aa3b44159f9554a0cd5e82b48d4d15a087607360f806cfa594f36","bodyHash":"d631e3d14794ddb9ba73969f0ea505319a24853cd567083f7696a64c5a4194f1"}
 *
 * Go source:
 * func (c *Checker) getTypeOnlyDeclarationOfEntityName(name *ast.Node) *ast.Node {
 * 	if symbol := c.resolveEntityName(name, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, true /*ignoreErrors* /, true /*dontResolveAlias* /, nil /*location* /); symbol != nil {
 * 		return c.getTypeOnlyAliasDeclaration(symbol)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeOnlyDeclarationOfEntityName(receiver: GoPtr<Checker>, name: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfImportClause","kind":"method","status":"implemented","sigHash":"3a44f734f5c3348615788e85c74f98276c7fb796a0c324ce1896a0c9ef68a432","bodyHash":"b9b8ba77393bdc87e2a4c33930292bfed9708444873cc458e3f53d40f69a6ad6"}
 *
 * Go source:
 * func (c *Checker) getTargetOfImportClause(node *ast.Node) *ast.Symbol {
 * 	moduleSymbol := c.resolveExternalModuleName(node, getModuleSpecifierFromNode(node.Parent), false /*ignoreErrors* /)
 * 	if moduleSymbol != nil {
 * 		return c.getTargetOfModuleDefault(moduleSymbol, node, true /*dontResolveAlias* /)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTargetOfImportClause(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportNonDefaultExport","kind":"method","status":"implemented","sigHash":"dcb94c3ae648989e934e41f351b44cc15bb340ec9fe287381e3c617385ec0c31","bodyHash":"1a190ba481b0dfe18eed935c122ca16a8b1afa3ad89e0d223a3b31047232c147"}
 *
 * Go source:
 * func (c *Checker) reportNonDefaultExport(moduleSymbol *ast.Symbol, node *ast.Node) {
 * 	if moduleSymbol.Exports != nil && moduleSymbol.Exports[node.Symbol().Name] != nil {
 * 		c.error(node, diagnostics.Module_0_has_no_default_export_Did_you_mean_to_use_import_1_from_0_instead, c.symbolToString(moduleSymbol), c.symbolToString(node.Symbol()))
 * 	} else {
 * 		diagnostic := c.error(node.Name(), diagnostics.Module_0_has_no_default_export, c.symbolToString(moduleSymbol))
 * 		var exportStar *ast.Symbol
 * 		if moduleSymbol.Exports != nil {
 * 			exportStar = moduleSymbol.Exports[ast.InternalSymbolNameExportStar]
 * 		}
 * 		if exportStar != nil {
 * 			defaultExport := core.Find(exportStar.Declarations, func(decl *ast.Declaration) bool {
 * 				if !(ast.IsExportDeclaration(decl) && decl.ModuleSpecifier() != nil) {
 * 					return false
 * 				}
 * 				resolvedExternalModuleName := c.resolveExternalModuleName(decl, decl.ModuleSpecifier(), false /*ignoreErrors* /)
 * 				return resolvedExternalModuleName != nil && resolvedExternalModuleName.Exports[ast.InternalSymbolNameDefault] != nil
 * 			})
 * 			if defaultExport != nil {
 * 				diagnostic.AddRelatedInfo(createDiagnosticForNode(defaultExport, diagnostics.X_export_Asterisk_does_not_re_export_a_default))
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_reportNonDefaultExport(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveExportByName","kind":"method","status":"implemented","sigHash":"d6d466f0cc7c702cdfcc39db24cb873b7602d02d591fdaf7d99942890d449585","bodyHash":"5d0f062d424c5d2d75bb11ae34d4fa587dec05ada111f5961a7357b8257ae607"}
 *
 * Go source:
 * func (c *Checker) resolveExportByName(moduleSymbol *ast.Symbol, name string, sourceNode *ast.Node, dontResolveAlias bool) *ast.Symbol {
 * 	exportValue := moduleSymbol.Exports[ast.InternalSymbolNameExportEquals]
 * 	var exportSymbol *ast.Symbol
 * 	if exportValue != nil {
 * 		exportSymbol = c.getPropertyOfTypeEx(c.getTypeOfSymbol(exportValue), name, true /*skipObjectFunctionPropertyAugment* /, false /*includeTypeOnlyMembers* /)
 * 	} else {
 * 		exportSymbol = moduleSymbol.Exports[name]
 * 	}
 * 	resolved := c.resolveSymbolEx(exportSymbol, dontResolveAlias)
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(sourceNode, nil)
 * 	return resolved
 * }
 */
export declare function Checker_resolveExportByName(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, name: string, sourceNode: GoPtr<Node>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfNamespaceImport","kind":"method","status":"implemented","sigHash":"1e2acc501b32f56218e6da30e25121b79f4e014b48889c522db920119a4fc6a6","bodyHash":"c0713420e0c24cdea62e4fb00b5541e32cb9065d7d72a5f7adf3a9f04bbc3319"}
 *
 * Go source:
 * func (c *Checker) getTargetOfNamespaceImport(node *ast.Node) *ast.Symbol {
 * 	moduleSpecifier := c.getModuleSpecifierForImportOrExport(node)
 * 	immediate := c.resolveExternalModuleName(node, moduleSpecifier, false /*ignoreErrors* /)
 * 	resolved := c.resolveESModuleSymbol(immediate, node, moduleSpecifier)
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return resolved
 * }
 */
export declare function Checker_getTargetOfNamespaceImport(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfNamespaceExport","kind":"method","status":"implemented","sigHash":"96040417e140d2764523ee81b9f83d212920920a2db996408ff5626939b4dffe","bodyHash":"718b1cd9fb4545453a3ecd096881ffe1b6626b527133d2211a32ae3697b41f8b"}
 *
 * Go source:
 * func (c *Checker) getTargetOfNamespaceExport(node *ast.Node) *ast.Symbol {
 * 	moduleSpecifier := c.getModuleSpecifierForImportOrExport(node)
 * 	if moduleSpecifier != nil {
 * 		immediate := c.resolveExternalModuleName(node, moduleSpecifier, false /*ignoreErrors* /)
 * 		resolved := c.resolveESModuleSymbol(immediate, node, moduleSpecifier)
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 		return resolved
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTargetOfNamespaceExport(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfImportSpecifier","kind":"method","status":"implemented","sigHash":"8a4b1490545810ac8eaf06356a0539cfa5f322186286acbbbf399647d27c97b7","bodyHash":"d92d91ab6e2baeb345ab822a5fd4f023cb2b2803c7e5df6f453b56489e2baae5"}
 *
 * Go source:
 * func (c *Checker) getTargetOfImportSpecifier(node *ast.Node) *ast.Symbol {
 * 	name := node.PropertyNameOrName()
 * 	if ast.IsImportSpecifier(node) && ast.ModuleExportNameIsDefault(name) {
 * 		specifier := c.getModuleSpecifierForImportOrExport(node)
 * 		if specifier != nil {
 * 			moduleSymbol := c.resolveExternalModuleName(node, specifier, false /*ignoreErrors* /)
 * 			if moduleSymbol != nil {
 * 				return c.getTargetOfModuleDefault(moduleSymbol, node, true /*dontResolveAlias* /)
 * 			}
 * 		}
 * 	}
 * 	root := node.Parent.Parent.Parent // ImportDeclaration
 * 	if ast.IsBindingElement(node) {
 * 		root = ast.GetRootDeclaration(node)
 * 	}
 * 	resolved := c.getExternalModuleMember(root, node, true /*dontResolveAlias* /)
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return resolved
 * }
 */
export declare function Checker_getTargetOfImportSpecifier(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExternalModuleMember","kind":"method","status":"implemented","sigHash":"abaa43949fcd7f7c039de1c8af63516023aa8192306544dfe8942f0850662f22","bodyHash":"9645fd33c48e6fada47179eaf4cf2b7596bff247d0b35cddf361703e214dc9b2"}
 *
 * Go source:
 * func (c *Checker) getExternalModuleMember(node *ast.Node, specifier *ast.Node, dontResolveAlias bool) *ast.Symbol {
 * 	// node is ImportDeclaration | ExportDeclaration | VariableDeclaration
 * 	// specifier is ImportSpecifier | ExportSpecifier | BindingElement | PropertyAccessExpression
 * 	moduleSpecifier := getExternalModuleRequireArgument(node)
 * 	if moduleSpecifier == nil {
 * 		moduleSpecifier = ast.GetExternalModuleName(node)
 * 	}
 * 	moduleSymbol := c.resolveExternalModuleName(node, moduleSpecifier, false /*ignoreErrors* /)
 * 	var name *ast.Node
 * 	if !ast.IsPropertyAccessExpression(specifier) {
 * 		name = specifier.PropertyNameOrName()
 * 	} else {
 * 		name = specifier.Name()
 * 	}
 * 	if !ast.IsIdentifier(name) && !ast.IsStringLiteral(name) {
 * 		return nil
 * 	}
 * 	nameText := name.Text()
 * 	targetSymbol := c.resolveESModuleSymbol(moduleSymbol, specifier, moduleSpecifier)
 * 	if targetSymbol != nil {
 * 		// Note: The empty string is a valid module export name:
 * 		//
 * 		//   import { "" as foo } from "./foo";
 * 		//   export { foo as "" };
 * 		//
 * 		if nameText != "" || name.Kind == ast.KindStringLiteral {
 * 			if isShorthandAmbientModuleSymbol(moduleSymbol) {
 * 				return moduleSymbol
 * 			}
 * 			var symbolFromVariable *ast.Symbol
 * 			// First check if module was specified with "export=". If so, get the member from the resolved type
 * 			if moduleSymbol != nil && moduleSymbol.Exports[ast.InternalSymbolNameExportEquals] != nil {
 * 				symbolFromVariable = c.getPropertyOfTypeEx(c.getTypeOfSymbol(targetSymbol), nameText, true /*skipObjectFunctionPropertyAugment* /, false /*includeTypeOnlyMembers* /)
 * 			} else {
 * 				symbolFromVariable = c.getPropertyOfVariable(targetSymbol, nameText)
 * 			}
 * 			// if symbolFromVariable is export - get its final target
 * 			symbolFromVariable = c.resolveSymbolEx(symbolFromVariable, dontResolveAlias)
 * 			exportContainer := targetSymbol
 * 			if moduleSymbol != nil && moduleSymbol.Exports[ast.InternalSymbolNameExportEquals] != nil {
 * 				// For `export =` modules, supplemental type/namespace exports live on the original module symbol.
 * 				exportContainer = moduleSymbol
 * 			}
 * 			symbolFromModule := c.getExportOfModule(exportContainer, nameText, specifier, dontResolveAlias)
 * 			if symbolFromModule == nil && nameText == ast.InternalSymbolNameDefault {
 * 				file := core.Find(moduleSymbol.Declarations, ast.IsSourceFile)
 * 				if c.isOnlyImportableAsDefault(moduleSpecifier, moduleSymbol) || c.canHaveSyntheticDefault(file, moduleSymbol, dontResolveAlias, moduleSpecifier) {
 * 					symbolFromModule = c.resolveExternalModuleSymbol(moduleSymbol, dontResolveAlias)
 * 					if symbolFromModule == nil {
 * 						symbolFromModule = c.resolveSymbolEx(moduleSymbol, dontResolveAlias)
 * 					}
 * 				}
 * 			}
 * 			symbol := symbolFromVariable
 * 			if symbolFromModule != nil {
 * 				symbol = symbolFromModule
 * 				if symbolFromVariable != nil {
 * 					symbol = c.combineValueAndTypeSymbols(symbolFromVariable, symbolFromModule)
 * 				}
 * 			}
 * 			if ast.IsImportOrExportSpecifier(specifier) && c.isOnlyImportableAsDefault(moduleSpecifier, moduleSymbol) && nameText != ast.InternalSymbolNameDefault {
 * 				c.error(name, diagnostics.Named_imports_from_a_JSON_file_into_an_ECMAScript_module_are_not_allowed_when_module_is_set_to_0, c.moduleKind.String())
 * 			} else if symbol == nil {
 * 				c.errorNoModuleMemberSymbol(moduleSymbol, targetSymbol, node, name)
 * 			}
 * 			return symbol
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getExternalModuleMember(receiver: GoPtr<Checker>, node: GoPtr<Node>, specifier: GoPtr<Node>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyOfVariable","kind":"method","status":"implemented","sigHash":"0c8ca2db6f7a299545cc69a3788fc31af31ad7f248c5ed536a776d52f4b40480","bodyHash":"2b53859522751ea91d6ef178cc9cd3663daed4535496a54891f2d5ce61ba0024"}
 *
 * Go source:
 * func (c *Checker) getPropertyOfVariable(symbol *ast.Symbol, name string) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsVariable != 0 {
 * 		typeAnnotation := symbol.ValueDeclaration.Type()
 * 		if typeAnnotation != nil {
 * 			return c.resolveSymbol(c.getPropertyOfType(c.getTypeFromTypeNode(typeAnnotation), name))
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getPropertyOfVariable(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, name: string): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.combineValueAndTypeSymbols","kind":"method","status":"implemented","sigHash":"fb21ee69496638af5edfcff79c6fdffb21ab1ad720ffba6e2997f4dbcd0b54b3","bodyHash":"ce8e82565e803d7862ff47bc967fd28cd0cd5580c6107dcd9f4a4b3671e61898"}
 *
 * Go source:
 * func (c *Checker) combineValueAndTypeSymbols(valueSymbol *ast.Symbol, typeSymbol *ast.Symbol) *ast.Symbol {
 * 	if valueSymbol == c.unknownSymbol && typeSymbol == c.unknownSymbol {
 * 		return c.unknownSymbol
 * 	}
 * 	if typeSymbol.Flags&ast.SymbolFlagsValue != 0 {
 * 		return typeSymbol
 * 	}
 * 	if valueSymbol.Flags&(ast.SymbolFlagsType|ast.SymbolFlagsNamespace) != 0 {
 * 		return valueSymbol
 * 	}
 * 	result := c.newSymbol(valueSymbol.Flags|typeSymbol.Flags, valueSymbol.Name)
 * 	debug.Assert(len(valueSymbol.Declarations) > 0 || len(typeSymbol.Declarations) > 0)
 * 	result.Declarations = slices.Compact(slices.Concat(valueSymbol.Declarations, typeSymbol.Declarations))
 * 	result.Parent = valueSymbol.Parent
 * 	if result.Parent == nil {
 * 		result.Parent = typeSymbol.Parent
 * 	}
 * 	result.ValueDeclaration = valueSymbol.ValueDeclaration
 * 	result.Members = maps.Clone(typeSymbol.Members)
 * 	result.Exports = maps.Clone(valueSymbol.Exports)
 * 	return result
 * }
 */
export declare function Checker_combineValueAndTypeSymbols(receiver: GoPtr<Checker>, valueSymbol: GoPtr<Symbol>, typeSymbol: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExportOfModule","kind":"method","status":"implemented","sigHash":"7205888ebba057d76a40126cb3c33a681330651c4c1b1fa710c7c8095e97847a","bodyHash":"6635e03bb2814d03c0e67de5e24831f93f4965c7d3cf5fac2cdf64a2421f5216"}
 *
 * Go source:
 * func (c *Checker) getExportOfModule(symbol *ast.Symbol, nameText string, specifier *ast.Node, dontResolveAlias bool) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsModule != 0 {
 * 		exportSymbol := c.getExportsOfSymbol(symbol)[nameText]
 * 		resolved := c.resolveSymbolEx(exportSymbol, dontResolveAlias)
 * 		exportStarDeclaration := c.moduleSymbolLinks.Get(symbol).typeOnlyExportStarMap[nameText]
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(specifier, exportStarDeclaration)
 * 		return resolved
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getExportOfModule(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, nameText: string, specifier: GoPtr<Node>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isOnlyImportableAsDefault","kind":"method","status":"implemented","sigHash":"8febfd7dd8fc801967a50a5ec60ff421ef0aa43ec4de9eaeeb8ce27f4b06b26d","bodyHash":"d17aa112ed8c61761e5c385e238d233e995dc0f039932355f88fca7d75f42211"}
 *
 * Go source:
 * func (c *Checker) isOnlyImportableAsDefault(usage *ast.Node, resolvedModule *ast.Symbol) bool {
 * 	// In Node.js, JSON modules don't get named exports
 * 	if core.ModuleKindNode16 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext {
 * 		usageMode := c.getEmitSyntaxForModuleSpecifierExpression(usage)
 * 		if usageMode == core.ModuleKindESNext {
 * 			if resolvedModule == nil {
 * 				resolvedModule = c.resolveExternalModuleName(usage, usage, true /*ignoreErrors* /)
 * 			}
 * 			var targetFile *ast.SourceFile
 * 			if resolvedModule != nil {
 * 				targetFile = ast.GetSourceFileOfModule(resolvedModule)
 * 			}
 * 			return targetFile != nil && (ast.IsJsonSourceFile(targetFile) || tspath.GetDeclarationFileExtension(targetFile.FileName()) == ".d.json.ts")
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isOnlyImportableAsDefault(receiver: GoPtr<Checker>, usage: GoPtr<Node>, resolvedModule: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorNoModuleMemberSymbol","kind":"method","status":"implemented","sigHash":"866dc9a79f60e29e4f2ce018974eba5c1c802c1a607f8f2a77a8f94e9acfa3de","bodyHash":"35e72ca56f62792f8c9371a74ee7acc8596a93c42011d2a01a23a4a8f2f6692a"}
 *
 * Go source:
 * func (c *Checker) errorNoModuleMemberSymbol(moduleSymbol *ast.Symbol, targetSymbol *ast.Symbol, node *ast.Node, name *ast.Node) {
 * 	if c.compilerOptions.NoCheck.IsTrue() {
 * 		return
 * 	}
 * 	moduleName := c.getFullyQualifiedName(moduleSymbol, node)
 * 	declarationName := scanner.DeclarationNameToString(name)
 * 	var suggestion *ast.Symbol
 * 	if ast.IsIdentifier(name) {
 * 		suggestion = c.getSuggestedSymbolForNonexistentModule(name, targetSymbol)
 * 	}
 * 	if suggestion != nil {
 * 		suggestionName := c.symbolToString(suggestion)
 * 		diagnostic := c.error(name, diagnostics.X_0_has_no_exported_member_named_1_Did_you_mean_2, moduleName, declarationName, suggestionName)
 * 		if suggestion.ValueDeclaration != nil {
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(suggestion.ValueDeclaration, diagnostics.X_0_is_declared_here, suggestionName))
 * 		}
 * 	} else {
 * 		if moduleSymbol.Exports[ast.InternalSymbolNameDefault] != nil {
 * 			c.error(name, diagnostics.Module_0_has_no_exported_member_1_Did_you_mean_to_use_import_1_from_0_instead, moduleName, declarationName)
 * 		} else {
 * 			c.reportNonExportedMember(name, declarationName, moduleSymbol, moduleName)
 * 		}
 * 	}
 * }
 */
export declare function Checker_errorNoModuleMemberSymbol(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, targetSymbol: GoPtr<Symbol>, node: GoPtr<Node>, name: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportNonExportedMember","kind":"method","status":"implemented","sigHash":"aef89fbc532c7c456a9b5965659e699be8eabf2983f1ba66feda0b576be3aafb","bodyHash":"50f54d6f30aaa60bae0ca2af8c4be2e2069204def3bd6a2c344e3eca9062ca15"}
 *
 * Go source:
 * func (c *Checker) reportNonExportedMember(name *ast.Node, declarationName string, moduleSymbol *ast.Symbol, moduleName string) {
 * 	var localSymbol *ast.Symbol
 * 	if locals := moduleSymbol.ValueDeclaration.Locals(); locals != nil {
 * 		localSymbol = locals[name.Text()]
 * 	}
 * 	exports := moduleSymbol.Exports
 * 	if localSymbol != nil {
 * 		if exportedEqualsSymbol := exports[ast.InternalSymbolNameExportEquals]; exportedEqualsSymbol != nil {
 * 			if c.getSymbolIfSameReference(exportedEqualsSymbol, localSymbol) != nil {
 * 				c.reportInvalidImportEqualsExportMember(name, declarationName, moduleName)
 * 			} else {
 * 				c.error(name, diagnostics.Module_0_has_no_exported_member_1, moduleName, declarationName)
 * 			}
 * 		} else {
 * 			exportedSymbol := findInMap(exports, func(symbol *ast.Symbol) bool {
 * 				return c.getSymbolIfSameReference(symbol, localSymbol) != nil
 * 			})
 * 			var diagnostic *ast.Diagnostic
 * 			if exportedSymbol != nil {
 * 				diagnostic = c.error(name, diagnostics.Module_0_declares_1_locally_but_it_is_exported_as_2, moduleName, declarationName, c.symbolToString(exportedSymbol))
 * 			} else {
 * 				diagnostic = c.error(name, diagnostics.Module_0_declares_1_locally_but_it_is_not_exported, moduleName, declarationName)
 * 			}
 * 			for i, decl := range localSymbol.Declarations {
 * 				diagnostic.AddRelatedInfo(createDiagnosticForNode(decl, core.IfElse(i == 0, diagnostics.X_0_is_declared_here, diagnostics.X_and_here), declarationName))
 * 			}
 * 		}
 * 	} else {
 * 		c.error(name, diagnostics.Module_0_has_no_exported_member_1, moduleName, declarationName)
 * 	}
 * }
 */
export declare function Checker_reportNonExportedMember(receiver: GoPtr<Checker>, name: GoPtr<Node>, declarationName: string, moduleSymbol: GoPtr<Symbol>, moduleName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportInvalidImportEqualsExportMember","kind":"method","status":"implemented","sigHash":"6f50a8d118bbbd1fcb50050ab69ee22b08ca88b9f62a570aff00f58aae26e0e7","bodyHash":"57664677160a641fded1a90580e5f2776212b8dff998c3e3b8f1b41dfb2c6bee"}
 *
 * Go source:
 * func (c *Checker) reportInvalidImportEqualsExportMember(name *ast.Node, declarationName string, moduleName string) {
 * 	if c.moduleKind >= core.ModuleKindES2015 {
 * 		c.error(name, diagnostics.X_0_can_only_be_imported_by_using_a_default_import, declarationName)
 * 	} else if ast.IsInJSFile(name) {
 * 		c.error(name, diagnostics.X_0_can_only_be_imported_by_using_a_require_call_or_by_using_a_default_import, declarationName)
 * 	} else {
 * 		c.error(name, diagnostics.X_0_can_only_be_imported_by_using_import_1_require_2_or_a_default_import, declarationName, declarationName, moduleName)
 * 	}
 * }
 */
export declare function Checker_reportInvalidImportEqualsExportMember(receiver: GoPtr<Checker>, name: GoPtr<Node>, declarationName: string, moduleName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfExportSpecifier","kind":"method","status":"implemented","sigHash":"416bad269bcce8594f88d3eb57064e727ee44f87341fb0781865bb7e0460ff62","bodyHash":"01beaae4a8d22cd77f5cfa3ac3bb22e72c35722f68b3f6497a60098be3027784"}
 *
 * Go source:
 * func (c *Checker) getTargetOfExportSpecifier(node *ast.Node, meaning ast.SymbolFlags, dontResolveAlias bool) *ast.Symbol {
 * 	name := node.PropertyNameOrName()
 * 	if ast.ModuleExportNameIsDefault(name) {
 * 		specifier := c.getModuleSpecifierForImportOrExport(node)
 * 		if specifier != nil {
 * 			moduleSymbol := c.resolveExternalModuleName(node, specifier, false /*ignoreErrors* /)
 * 			if moduleSymbol != nil {
 * 				return c.getTargetOfModuleDefault(moduleSymbol, node, dontResolveAlias)
 * 			}
 * 		}
 * 	}
 * 	exportDeclaration := node.Parent.Parent
 * 	var resolved *ast.Symbol
 * 	switch {
 * 	case exportDeclaration.ModuleSpecifier() != nil:
 * 		resolved = c.getExternalModuleMember(exportDeclaration, node, dontResolveAlias)
 * 	case ast.IsStringLiteral(name):
 * 		resolved = nil
 * 	default:
 * 		resolved = c.resolveEntityName(name, meaning, false /*ignoreErrors* /, dontResolveAlias, nil /*location* /)
 * 	}
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return resolved
 * }
 */
export declare function Checker_getTargetOfExportSpecifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, meaning: SymbolFlags, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfAliasLikeExpression","kind":"method","status":"implemented","sigHash":"73c87afe4e39f95e2e2a744c4c7490ab1a65ae52f73650bc1ebe12afd946fdbf","bodyHash":"5eaa442286b8673807b7224c955f7a84499eea8a813d90f57f8dfdc2316067a2"}
 *
 * Go source:
 * func (c *Checker) getTargetOfAliasLikeExpression(expression *ast.Node) *ast.Symbol {
 * 	if ast.IsClassExpression(expression) {
 * 		return c.checkExpressionCached(expression).symbol
 * 	}
 * 	if !ast.IsEntityName(expression) && !ast.IsEntityNameExpression(expression) {
 * 		return nil
 * 	}
 * 	aliasLike := c.resolveEntityName(expression, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, true /*ignoreErrors* /, true /*dontResolveAlias* /, nil /*location* /)
 * 	if aliasLike != nil {
 * 		return aliasLike
 * 	}
 * 	c.checkExpressionCached(expression)
 * 	return c.getResolvedSymbolOrNil(expression)
 * }
 */
export declare function Checker_getTargetOfAliasLikeExpression(receiver: GoPtr<Checker>, expression: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfNamespaceExportDeclaration","kind":"method","status":"implemented","sigHash":"25087b270395d84874ecca307686bec92991586c0c6271f6fde81a25b5a347b7","bodyHash":"cb5df8d5e74a22b48d970574a8b6c2a24f27c845f7ff498992450a31e751000d"}
 *
 * Go source:
 * func (c *Checker) getTargetOfNamespaceExportDeclaration(node *ast.Node) *ast.Symbol {
 * 	if ast.CanHaveSymbol(node.Parent) {
 * 		resolved := c.resolveExternalModuleSymbol(node.Parent.Symbol(), true /*dontResolveAlias* /)
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 		return resolved
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTargetOfNamespaceExportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getModuleSpecifierForImportOrExport","kind":"method","status":"implemented","sigHash":"a989d29721337619616e074e5ef68e7705122f0c929f8b0819ee80d882d59569","bodyHash":"fd6e41c52795e0939ce76fd88ecf02965124ca881fa80d2f5c4772eda2ae3d56"}
 *
 * Go source:
 * func (c *Checker) getModuleSpecifierForImportOrExport(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindImportClause:
 * 		return getModuleSpecifierFromNode(node.Parent)
 * 	case ast.KindImportEqualsDeclaration:
 * 		if ast.IsExternalModuleReference(node.AsImportEqualsDeclaration().ModuleReference) {
 * 			return node.AsImportEqualsDeclaration().ModuleReference.Expression()
 * 		} else {
 * 			return nil
 * 		}
 * 	case ast.KindNamespaceImport:
 * 		return getModuleSpecifierFromNode(node.Parent.Parent)
 * 	case ast.KindImportSpecifier:
 * 		return getModuleSpecifierFromNode(node.Parent.Parent.Parent)
 * 	case ast.KindNamespaceExport:
 * 		return getModuleSpecifierFromNode(node.Parent)
 * 	case ast.KindExportSpecifier:
 * 		return getModuleSpecifierFromNode(node.Parent.Parent)
 * 	}
 * 	panic("Unhandled case in getModuleSpecifierForImportOrExport")
 * }
 */
export declare function Checker_getModuleSpecifierForImportOrExport(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markSymbolOfAliasDeclarationIfTypeOnly","kind":"method","status":"implemented","sigHash":"4974f8dfc0fb2138a3c8ce4a32b30f8236aa7ebb6cbb137dd095847d2a987522","bodyHash":"b6fad9cce2d3d6d21fba638ea70fd72e6adbfc53a6ab456c7968aa728776bfc9"}
 *
 * Go source:
 * func (c *Checker) markSymbolOfAliasDeclarationIfTypeOnly(aliasDeclaration *ast.Node, exportStarDeclaration *ast.Node) bool {
 * 	if aliasDeclaration == nil || !ast.IsDeclarationNode(aliasDeclaration) {
 * 		return false
 * 	}
 * 	// If the declaration itself is type-only, mark it and return. No need to check what it resolves to.
 * 	sourceSymbol := c.getSymbolOfDeclaration(aliasDeclaration)
 * 	links := c.aliasSymbolLinks.Get(sourceSymbol)
 * 	if links.typeOnlyDeclaration == nil && ast.IsTypeOnlyImportOrExportDeclaration(aliasDeclaration) {
 * 		links.typeOnlyDeclaration = aliasDeclaration
 * 		return true
 * 	}
 * 	if links.typeOnlyDeclaration == nil && exportStarDeclaration != nil {
 * 		links.typeOnlyDeclaration = exportStarDeclaration
 * 		return true
 * 	}
 * 	return links.typeOnlyDeclaration != nil
 * }
 */
export declare function Checker_markSymbolOfAliasDeclarationIfTypeOnly(receiver: GoPtr<Checker>, aliasDeclaration: GoPtr<Node>, exportStarDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveExternalModuleName","kind":"method","status":"implemented","sigHash":"972e3939c43a882c5c1d2d13b63d41126173d73ecab2e189a25fb4c42bc5f023","bodyHash":"05df09ea2511dfa94fdc6a058e2a07179404205b8aac35329329ee3719d388e6"}
 *
 * Go source:
 * func (c *Checker) resolveExternalModuleName(location *ast.Node, moduleReferenceExpression *ast.Node, ignoreErrors bool) *ast.Symbol {
 * 	errorMessage := c.getCannotResolveModuleNameErrorForSpecificModule(moduleReferenceExpression)
 * 	if errorMessage == nil {
 * 		errorMessage = diagnostics.Cannot_find_module_0_or_its_corresponding_type_declarations
 * 	}
 * 	ignoreErrors = ignoreErrors || c.compilerOptions.NoCheck.IsTrue()
 * 	return c.resolveExternalModuleNameWorker(location, moduleReferenceExpression, core.IfElse(ignoreErrors, nil, errorMessage), ignoreErrors, false /*isForAugmentation* /)
 * }
 */
export declare function Checker_resolveExternalModuleName(receiver: GoPtr<Checker>, location: GoPtr<Node>, moduleReferenceExpression: GoPtr<Node>, ignoreErrors: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveExternalModuleNameWorker","kind":"method","status":"implemented","sigHash":"253c2cba5ee1ff42b8859b6b5cdb1fcab9b8d35e5bc7dad7dbd8672df1591a38","bodyHash":"3a92fd9827d13ccff5aaae7583b47d173d9234939f75f24d02e73cf75af41205"}
 *
 * Go source:
 * func (c *Checker) resolveExternalModuleNameWorker(location *ast.Node, moduleReferenceExpression *ast.Node, moduleNotFoundError *diagnostics.Message, ignoreErrors bool, isForAugmentation bool) *ast.Symbol {
 * 	if ast.IsStringLiteralLike(moduleReferenceExpression) {
 * 		return c.resolveExternalModule(location, moduleReferenceExpression.Text(), moduleNotFoundError, core.IfElse(!ignoreErrors, moduleReferenceExpression, nil), isForAugmentation)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_resolveExternalModuleNameWorker(receiver: GoPtr<Checker>, location: GoPtr<Node>, moduleReferenceExpression: GoPtr<Node>, moduleNotFoundError: GoPtr<Message>, ignoreErrors: bool, isForAugmentation: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExternalModuleFileFromDeclaration","kind":"method","status":"implemented","sigHash":"234542e0e35456258a7d12a0e887ec0c95e8c5c4c387e944c36180d02cc0fa9a","bodyHash":"479e89fffbf6cecb19a13b0220a2bac5908c7ef0769974e4fab2552a1594eb0a"}
 *
 * Go source:
 * func (c *Checker) getExternalModuleFileFromDeclaration(declaration *ast.Node) *ast.SourceFile {
 * 	var specifier *ast.Node
 * 	if declaration.Kind == ast.KindModuleDeclaration {
 * 		if ast.IsStringLiteral(declaration.Name()) {
 * 			specifier = declaration.Name()
 * 		}
 * 	} else {
 * 		specifier = ast.GetExternalModuleName(declaration)
 * 	}
 * 	moduleSymbol := c.resolveExternalModuleNameWorker(specifier, specifier /*moduleNotFoundError* /, nil, false, false) // TODO: GH#18217
 * 	if moduleSymbol == nil {
 * 		return nil
 * 	}
 * 	decl := ast.GetDeclarationOfKind(moduleSymbol, ast.KindSourceFile)
 * 	if decl == nil {
 * 		return nil
 * 	}
 * 	return decl.AsSourceFile()
 * }
 */
export declare function Checker_getExternalModuleFileFromDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedImportSource","kind":"method","status":"implemented","sigHash":"f4a384f3eff1481a1326af6624cd937fdadeedf0afbe227a6b2acc62efc2f9dc","bodyHash":"43e3bc7ffc56bcf02d20783e76ca88d42f029a75c403fed624392ff2f01b424b"}
 *
 * Go source:
 * func (c *Checker) getSuggestedImportSource(moduleReference string, tsExtension string, mode core.ResolutionMode) string {
 * 	importSourceWithoutExtension := tspath.RemoveExtension(moduleReference, tsExtension)
 *
 * 	// Direct users to import source with .js extension if outputting an ES module.
 * 	// @see https://github.com/microsoft/TypeScript/issues/42151
 * 	if c.moduleKind.IsNonNodeESM() || mode == core.ModuleKindESNext {
 * 		preferTs := tspath.IsDeclarationFileName(moduleReference) && c.compilerOptions.GetAllowImportingTsExtensions()
 * 		var ext string
 * 		switch {
 * 		case tsExtension == tspath.ExtensionMts || tsExtension == tspath.ExtensionDmts:
 * 			ext = core.IfElse(preferTs, ".mts", ".mjs")
 * 		case tsExtension == tspath.ExtensionCts || tsExtension == tspath.ExtensionDcts:
 * 			ext = core.IfElse(preferTs, ".cts", ".cjs")
 * 		default:
 * 			ext = core.IfElse(preferTs, ".ts", ".js")
 * 		}
 *
 * 		return importSourceWithoutExtension + ext
 * 	}
 *
 * 	return importSourceWithoutExtension
 * }
 */
export declare function Checker_getSuggestedImportSource(receiver: GoPtr<Checker>, moduleReference: string, tsExtension: string, mode: ResolutionMode): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedImportExtension","kind":"method","status":"implemented","sigHash":"e3edab7c597ecc2aae349df96fa7124ae1bcf7dda95c274b9f1c40fa15d8724e","bodyHash":"1d509491bbc486f31804ba5c3af2828a2a9038467d49ca454eb42d6f35a3a026"}
 *
 * Go source:
 * func (c *Checker) getSuggestedImportExtension(extensionlessImportPath string) string {
 * 	switch true {
 * 	case c.program.FileExists(extensionlessImportPath + ".mts"):
 * 		return ".mjs"
 * 	case c.program.FileExists(extensionlessImportPath + ".ts"):
 * 		return ".js"
 * 	case c.program.FileExists(extensionlessImportPath + ".cts"):
 * 		return ".cjs"
 * 	case c.program.FileExists(extensionlessImportPath + ".mjs"):
 * 		return ".mjs"
 * 	case c.program.FileExists(extensionlessImportPath + ".js"):
 * 		return ".js"
 * 	case c.program.FileExists(extensionlessImportPath + ".cjs"):
 * 		return ".cjs"
 * 	case c.program.FileExists(extensionlessImportPath + ".tsx"):
 * 		return core.IfElse(c.compilerOptions.Jsx == core.JsxEmitPreserve, ".jsx", ".js")
 * 	case c.program.FileExists(extensionlessImportPath + ".jsx"):
 * 		return ".jsx"
 * 	case c.program.FileExists(extensionlessImportPath + ".json"):
 * 		return ".json"
 * 	}
 * 	return ""
 * }
 */
export declare function Checker_getSuggestedImportExtension(receiver: GoPtr<Checker>, extensionlessImportPath: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveExternalModuleSymbol","kind":"method","status":"implemented","sigHash":"5b1cf7c2dd7e8c364f23033fedac1f25cf3345e14e2ee1d6c4672c21753c2611","bodyHash":"62520e92505d5d5235376b3a495cf9eca27062be1dc05dc6e314c819394763d3"}
 *
 * Go source:
 * func (c *Checker) resolveExternalModuleSymbol(moduleSymbol *ast.Symbol, dontResolveAlias bool) *ast.Symbol {
 * 	if moduleSymbol != nil {
 * 		exportEquals := c.resolveSymbolEx(moduleSymbol.Exports[ast.InternalSymbolNameExportEquals], dontResolveAlias)
 * 		if exportEquals != nil {
 * 			return c.getMergedSymbol(exportEquals)
 * 		}
 * 	}
 * 	return moduleSymbol
 * }
 */
export declare function Checker_resolveExternalModuleSymbol(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveESModuleSymbol","kind":"method","status":"implemented","sigHash":"f1615f54cc3d30a16ee2016cd9adb905eb5bc943cb2fe5e85f9f5b6ddfca7b21","bodyHash":"d983f72f8a259ae1090a73e4460a1d5f7be6ad14467c98dddbafc07b33e191da"}
 *
 * Go source:
 * func (c *Checker) resolveESModuleSymbol(moduleSymbol *ast.Symbol, node *ast.Node, moduleSpecifier *ast.Node) *ast.Symbol {
 * 	symbol := c.resolveExternalModuleSymbol(moduleSymbol, true /*dontResolveAlias* /)
 * 	if ast.IsNonLocalAlias(symbol, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace) {
 * 		// When the module has an export= with a pure alias, we transitively resolve and propagate any typeOnlyDeclaration
 * 		symbol = c.getMergedSymbol(c.resolveIndirectionAlias(c.getSymbolOfDeclaration(node), symbol))
 * 	}
 * 	if symbol != nil {
 * 		referenceParent := moduleSpecifier.Parent
 * 		var namespaceImport *ast.Node
 * 		if ast.IsImportDeclaration(referenceParent) {
 * 			namespaceImport = ast.GetNamespaceDeclarationNode(referenceParent)
 * 		}
 * 		if namespaceImport != nil || ast.IsImportCall(referenceParent) {
 * 			var reference *ast.Node
 * 			if ast.IsImportCall(referenceParent) {
 * 				reference = referenceParent.Arguments()[0]
 * 			} else {
 * 				reference = referenceParent.ModuleSpecifier()
 * 			}
 * 			typ := c.getTypeOfSymbol(symbol)
 * 			defaultOnlyType := c.getTypeWithSyntheticDefaultOnly(typ, symbol, moduleSymbol, reference)
 * 			if defaultOnlyType != nil {
 * 				return c.cloneTypeAsModuleType(symbol, defaultOnlyType, referenceParent)
 * 			}
 *
 * 			targetFile := core.Find(moduleSymbol.Declarations, ast.IsSourceFile)
 * 			usageMode := c.getEmitSyntaxForModuleSpecifierExpression(reference)
 * 			var exportModuleDotExportsSymbol *ast.Symbol
 * 			if namespaceImport != nil && targetFile != nil &&
 * 				core.ModuleKindNode20 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext &&
 * 				usageMode == core.ModuleKindCommonJS &&
 * 				c.program.GetImpliedNodeFormatForEmit(targetFile.AsSourceFile()) == core.ModuleKindESNext {
 * 				exportModuleDotExportsSymbol = c.getExportOfModule(symbol, ast.InternalSymbolNameModuleExports, namespaceImport, true /*dontResolveAlias* /)
 * 			}
 * 			if exportModuleDotExportsSymbol != nil {
 * 				if c.hasSignatures(typ) {
 * 					return c.cloneTypeAsModuleType(exportModuleDotExportsSymbol, typ, referenceParent)
 * 				}
 * 				return exportModuleDotExportsSymbol
 * 			}
 *
 * 			isEsmCjsRef := targetFile != nil && isESMFormatImportImportingCommonjsFormatFile(usageMode, c.program.GetImpliedNodeFormatForEmit(targetFile.AsSourceFile()))
 * 			if c.hasSignatures(typ) || c.getPropertyOfTypeEx(typ, ast.InternalSymbolNameDefault, true /*skipObjectFunctionPropertyAugment* /, false /*includeTypeOnlyMembers* /) != nil || isEsmCjsRef {
 * 				var moduleType *Type
 * 				if typ.Flags()&TypeFlagsStructuredType != 0 {
 * 					moduleType = c.getTypeWithSyntheticDefaultImportType(typ, symbol, moduleSymbol, reference)
 * 				} else {
 * 					moduleType = c.createDefaultPropertyWrapperForModule(symbol, symbol.Parent, nil)
 * 				}
 * 				return c.cloneTypeAsModuleType(symbol, moduleType, referenceParent)
 * 			}
 * 		}
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_resolveESModuleSymbol(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, node: GoPtr<Node>, moduleSpecifier: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeWithSyntheticDefaultImportType","kind":"method","status":"implemented","sigHash":"3ccd16750ce3c055a159b187e35186cb2ccb591922beb5fb302e01bdefbc436e","bodyHash":"f949cf1f813b45df71dc989a4c1ca15923948f4a865e48d8f557fdf195fc58b5"}
 *
 * Go source:
 * func (c *Checker) getTypeWithSyntheticDefaultImportType(t *Type, symbol *ast.Symbol, originalSymbol *ast.Symbol, moduleSpecifier *ast.Node) *Type {
 * 	if t != nil && !c.isErrorType(t) {
 * 		key := CachedTypeKey{kind: CachedTypeKindSyntheticType, typeId: t.id}
 * 		if cached := c.cachedTypes[key]; cached != nil {
 * 			return cached
 * 		}
 * 		file := core.Find(originalSymbol.Declarations, ast.IsSourceFile)
 * 		hasSyntheticDefault := c.canHaveSyntheticDefault(file, originalSymbol, false /*dontResolveAlias* /, moduleSpecifier)
 * 		var syntheticType *Type
 * 		if hasSyntheticDefault {
 * 			anonymousSymbol := c.newSymbol(ast.SymbolFlagsTypeLiteral, ast.InternalSymbolNameType)
 * 			defaultContainingObject := c.createDefaultPropertyWrapperForModule(symbol, originalSymbol, anonymousSymbol)
 * 			c.valueSymbolLinks.Get(anonymousSymbol).resolvedType = defaultContainingObject
 * 			if c.isValidSpreadType(t) {
 * 				syntheticType = c.getSpreadType(t, defaultContainingObject, anonymousSymbol, 0 /*objectFlags* /, false /*readonly* /)
 * 			} else {
 * 				syntheticType = defaultContainingObject
 * 			}
 * 		} else {
 * 			syntheticType = t
 * 		}
 * 		c.cachedTypes[key] = syntheticType
 * 		return syntheticType
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getTypeWithSyntheticDefaultImportType(receiver: GoPtr<Checker>, t: GoPtr<Type>, symbol_: GoPtr<Symbol>, originalSymbol: GoPtr<Symbol>, moduleSpecifier: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createDefaultPropertyWrapperForModule","kind":"method","status":"implemented","sigHash":"be3759cac24f70c337da650c87f7fe862cc2169962debb1d04020969b99817d5","bodyHash":"6adfd0685cd1d36b52a56a1d9731a82fa4e7f7825ff20441dd60e8adffd26365"}
 *
 * Go source:
 * func (c *Checker) createDefaultPropertyWrapperForModule(symbol *ast.Symbol, originalSymbol *ast.Symbol, anonymousSymbol *ast.Symbol) *Type {
 * 	memberTable := make(ast.SymbolTable)
 * 	newSymbol := c.newSymbol(ast.SymbolFlagsAlias, ast.InternalSymbolNameDefault)
 * 	newSymbol.Parent = originalSymbol
 * 	c.valueSymbolLinks.Get(newSymbol).nameType = c.getStringLiteralType("default")
 * 	c.aliasSymbolLinks.Get(newSymbol).aliasTarget = c.resolveSymbol(symbol)
 * 	memberTable[ast.InternalSymbolNameDefault] = newSymbol
 * 	return c.newAnonymousType(anonymousSymbol, memberTable, nil, nil, nil)
 * }
 */
export declare function Checker_createDefaultPropertyWrapperForModule(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, originalSymbol: GoPtr<Symbol>, anonymousSymbol: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfAliasDeclaration","kind":"method","status":"implemented","sigHash":"0acebbdb94a00d2578d9770d6e463de00dc9eef2f7b484adb14fff60fb2bface","bodyHash":"1c141c3f2ba65b906be02cd3f64e119da5c88ee4cad594faef1eef3d1926c32d"}
 *
 * Go source:
 * func (c *Checker) getTargetOfAliasDeclaration(node *ast.Node) *ast.Symbol {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindImportEqualsDeclaration, ast.KindVariableDeclaration:
 * 		return c.getTargetOfImportEqualsDeclaration(node)
 * 	case ast.KindImportClause:
 * 		return c.getTargetOfImportClause(node)
 * 	case ast.KindNamespaceImport:
 * 		return c.getTargetOfNamespaceImport(node)
 * 	case ast.KindNamespaceExport:
 * 		return c.getTargetOfNamespaceExport(node)
 * 	case ast.KindImportSpecifier, ast.KindBindingElement:
 * 		return c.getTargetOfImportSpecifier(node)
 * 	case ast.KindExportSpecifier:
 * 		return c.getTargetOfExportSpecifier(node, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, true /*dontRecursivelyResolve* /)
 * 	case ast.KindExportAssignment:
 * 		return c.getTargetOfExportAssignment(node)
 * 	case ast.KindBinaryExpression:
 * 		return c.getTargetOfBinaryExpression(node)
 * 	case ast.KindNamespaceExportDeclaration:
 * 		return c.getTargetOfNamespaceExportDeclaration(node)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return c.resolveEntityName(node.AsShorthandPropertyAssignment().Name(), ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, true /*ignoreErrors* /, true /*dontRecursivelyResolve* /, nil /*location* /)
 * 	case ast.KindPropertyAssignment:
 * 		return c.getTargetOfAliasLikeExpression(node.Initializer())
 * 	case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 		return c.getTargetOfAccessExpression(node)
 * 	}
 * 	panic("Unhandled case in getTargetOfAliasDeclaration: " + node.Kind.String())
 * }
 */
export declare function Checker_getTargetOfAliasDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveEntityName","kind":"method","status":"implemented","sigHash":"259244445bf59a6ae4756443de76b86e1c49c3a72177e03835983a5e094f08bc","bodyHash":"4d26db0cb400138ea44741dee99e5ad9373136b4a2c3b027fac86c5e0bd793f0"}
 *
 * Go source:
 * func (c *Checker) resolveEntityName(name *ast.Node, meaning ast.SymbolFlags, ignoreErrors bool, dontResolveAlias bool, location *ast.Node) *ast.Symbol {
 * 	if ast.NodeIsMissing(name) {
 * 		return nil
 * 	}
 * 	var symbol *ast.Symbol
 * 	switch name.Kind {
 * 	case ast.KindIdentifier:
 * 		var message *diagnostics.Message
 * 		if !ignoreErrors {
 * 			if meaning == ast.SymbolFlagsNamespace || ast.NodeIsSynthesized(name) {
 * 				message = diagnostics.Cannot_find_namespace_0
 * 			} else {
 * 				message = c.getCannotFindNameDiagnosticForName(ast.GetFirstIdentifier(name))
 * 			}
 * 		}
 * 		resolveLocation := location
 * 		if resolveLocation == nil {
 * 			resolveLocation = name
 * 		}
 * 		if meaning == ast.SymbolFlagsNamespace {
 * 			symbol = c.getMergedSymbol(c.resolveName(resolveLocation, name.Text(), meaning, nil, true /*isUse* /, false /*excludeGlobals* /))
 * 			if symbol == nil {
 * 				alias := c.getMergedSymbol(c.resolveName(resolveLocation, name.Text(), ast.SymbolFlagsAlias, nil, true /*isUse* /, false /*excludeGlobals* /))
 * 				if alias != nil && alias.Name == ast.InternalSymbolNameExportEquals {
 * 					// resolve typedefs exported from commonjs, stored on the module symbol
 * 					symbol = alias.Parent
 * 				}
 * 			}
 * 			if symbol == nil && message != nil {
 * 				c.resolveName(resolveLocation, name.Text(), meaning, message, true /*isUse* /, false /*excludeGlobals* /)
 * 			}
 * 		} else {
 * 			symbol = c.getMergedSymbol(c.resolveName(resolveLocation, name.Text(), meaning, message, true /*isUse* /, false /*excludeGlobals* /))
 * 		}
 * 	case ast.KindQualifiedName:
 * 		qualified := name.AsQualifiedName()
 * 		symbol = c.resolveQualifiedName(name, qualified.Left, qualified.Right, meaning, ignoreErrors, location)
 * 	case ast.KindPropertyAccessExpression:
 * 		access := name.AsPropertyAccessExpression()
 * 		symbol = c.resolveQualifiedName(name, access.Expression, access.Name(), meaning, ignoreErrors, location)
 * 	default:
 * 		panic("Unknown entity name kind")
 * 	}
 * 	if symbol != nil && symbol != c.unknownSymbol {
 * 		if !ast.NodeIsSynthesized(name) && ast.IsEntityName(name) &&
 * 			(symbol.Flags&ast.SymbolFlagsAlias != 0 || name.Parent != nil && name.Parent.Kind == ast.KindExportAssignment) {
 * 			c.markSymbolOfAliasDeclarationIfTypeOnly(getAliasDeclarationFromName(name), nil)
 * 		}
 * 		// We know a symbol with the given meaning exists along the alias chain, so resolve until we find it.
 * 		for symbol.Flags&meaning == 0 && !dontResolveAlias && symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 			symbol = c.resolveAlias(symbol)
 * 		}
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_resolveEntityName(receiver: GoPtr<Checker>, name: GoPtr<Node>, meaning: SymbolFlags, ignoreErrors: bool, dontResolveAlias: bool, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveQualifiedName","kind":"method","status":"implemented","sigHash":"40b447eb86d05eb570c8335d4a5dfa4ca77b4cdc34317d59694506beebbbf435","bodyHash":"ad86933d9a940cfac3e552e5595c5ee3fa20e13065b58493ca4d7379c42ba4ad"}
 *
 * Go source:
 * func (c *Checker) resolveQualifiedName(name *ast.Node, left *ast.Node, right *ast.Node, meaning ast.SymbolFlags, ignoreErrors bool, location *ast.Node) *ast.Symbol {
 * 	namespace := c.resolveEntityName(left, ast.SymbolFlagsNamespace, ignoreErrors, false /*dontResolveAlias* /, location)
 * 	if namespace == nil || ast.NodeIsMissing(right) {
 * 		return nil
 * 	}
 * 	if namespace == c.unknownSymbol {
 * 		return namespace
 * 	}
 * 	if namespace.ValueDeclaration != nil &&
 * 		ast.IsInJSFile(namespace.ValueDeclaration) &&
 * 		c.compilerOptions.GetModuleResolutionKind() != core.ModuleResolutionKindBundler &&
 * 		ast.IsVariableDeclaration(namespace.ValueDeclaration) &&
 * 		namespace.ValueDeclaration.Initializer() != nil &&
 * 		c.isCommonJSRequire(namespace.ValueDeclaration.Initializer()) {
 * 		moduleName := namespace.ValueDeclaration.Initializer().Arguments()[0]
 * 		moduleSym := c.resolveExternalModuleName(moduleName, moduleName, false /*ignoreErrors* /)
 * 		if moduleSym != nil {
 * 			resolvedModuleSymbol := c.resolveExternalModuleSymbol(moduleSym, false /*dontResolveAlias* /)
 * 			if resolvedModuleSymbol != nil {
 * 				namespace = resolvedModuleSymbol
 * 			}
 * 		}
 * 	}
 * 	text := right.Text()
 * 	symbol := c.getMergedSymbol(c.getSymbol(c.getExportsOfSymbol(namespace), text, meaning))
 * 	if symbol == nil && namespace.Flags&ast.SymbolFlagsAlias != 0 {
 * 		// `namespace` can be resolved further if there was a symbol merge with a re-export
 * 		symbol = c.getMergedSymbol(c.getSymbol(c.getExportsOfSymbol(c.resolveAlias(namespace)), text, meaning))
 * 	}
 * 	if symbol == nil {
 * 		if !ignoreErrors {
 * 			namespaceName := c.getFullyQualifiedName(namespace, nil /*containingLocation* /)
 * 			declarationName := scanner.DeclarationNameToString(right)
 * 			suggestionForNonexistentModule := c.getSuggestedSymbolForNonexistentModule(right, namespace)
 * 			if suggestionForNonexistentModule != nil {
 * 				c.error(right, diagnostics.X_0_has_no_exported_member_named_1_Did_you_mean_2, namespaceName, declarationName, c.symbolToString(suggestionForNonexistentModule))
 * 				return nil
 * 			}
 * 			var containingQualifiedName *ast.Node
 * 			if ast.IsQualifiedName(name) {
 * 				containingQualifiedName = getContainingQualifiedNameNode(name)
 * 			}
 * 			canSuggestTypeof := c.globalObjectType != nil && meaning&ast.SymbolFlagsType != 0 && containingQualifiedName != nil && !ast.IsTypeOfExpression(containingQualifiedName.Parent) && c.tryGetQualifiedNameAsValue(containingQualifiedName) != nil
 * 			if canSuggestTypeof {
 * 				c.error(containingQualifiedName, diagnostics.X_0_refers_to_a_value_but_is_being_used_as_a_type_here_Did_you_mean_typeof_0, entityNameToString(containingQualifiedName))
 * 				return nil
 * 			}
 * 			if meaning&ast.SymbolFlagsNamespace != 0 {
 * 				if ast.IsQualifiedName(name.Parent) {
 * 					exportedTypeSymbol := c.getMergedSymbol(c.getSymbol(c.getExportsOfSymbol(namespace), text, ast.SymbolFlagsType))
 * 					if exportedTypeSymbol != nil {
 * 						qualified := name.Parent.AsQualifiedName()
 * 						c.error(qualified.Right, diagnostics.Cannot_access_0_1_because_0_is_a_type_but_not_a_namespace_Did_you_mean_to_retrieve_the_type_of_the_property_1_in_0_with_0_1, c.symbolToString(exportedTypeSymbol), qualified.Right.Text())
 * 						return nil
 * 					}
 * 				}
 * 			}
 * 			c.error(right, diagnostics.Namespace_0_has_no_exported_member_1, namespaceName, declarationName)
 * 		}
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_resolveQualifiedName(receiver: GoPtr<Checker>, name: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>, meaning: SymbolFlags, ignoreErrors: bool, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetQualifiedNameAsValue","kind":"method","status":"implemented","sigHash":"066983f61301925fd0dd503c058f356d8e78177b9848aad8c0ca0b2995f3272e","bodyHash":"7edec4beda966ad83804d73e18954ffb3c178045f46286db26bd77e812344f9a"}
 *
 * Go source:
 * func (c *Checker) tryGetQualifiedNameAsValue(node *ast.Node) *ast.Symbol {
 * 	id := ast.GetFirstIdentifier(node)
 * 	symbol := c.resolveName(id, id.Text(), ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, true /*isUse* /, false /*excludeGlobals* /)
 * 	if symbol == nil {
 * 		return nil
 * 	}
 * 	n := id
 * 	for ast.IsQualifiedName(n.Parent) {
 * 		t := c.getTypeOfSymbol(symbol)
 * 		symbol = c.getPropertyOfType(t, n.Parent.AsQualifiedName().Right.Text())
 * 		if symbol == nil {
 * 			return nil
 * 		}
 * 		n = n.Parent
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_tryGetQualifiedNameAsValue(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedSymbolForNonexistentModule","kind":"method","status":"implemented","sigHash":"e7783e13ddb424daea42264f72569505000b65d600c3c728af607d678acae632","bodyHash":"4c72f5e8fc7c8e5af6ae32b5cdbe2119301ed8ad59e58de70e926eb03be55dab"}
 *
 * Go source:
 * func (c *Checker) getSuggestedSymbolForNonexistentModule(name *ast.Node, targetModule *ast.Symbol) *ast.Symbol {
 * 	return c.getSpellingSuggestionForName(name.Text(), maps.Values(c.getExportsOfModule(targetModule)), ast.SymbolFlagsModuleMember)
 * }
 */
export declare function Checker_getSuggestedSymbolForNonexistentModule(receiver: GoPtr<Checker>, name: GoPtr<Node>, targetModule: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getFullyQualifiedName","kind":"method","status":"implemented","sigHash":"51908673476e96ec9c4ab66ac09302da844dc35aeb5cc5d95eec86bef588063c","bodyHash":"def24c5ddb1e56518db36b4c90b6efaf96273bff574847e61c4b318dd57d4c36"}
 *
 * Go source:
 * func (c *Checker) getFullyQualifiedName(symbol *ast.Symbol, containingLocation *ast.Node) string {
 * 	if symbol.Parent != nil {
 * 		return c.getFullyQualifiedName(symbol.Parent, containingLocation) + "." + c.symbolToString(symbol)
 * 	}
 * 	return c.symbolToStringEx(symbol, containingLocation, ast.SymbolFlagsAll, SymbolFormatFlagsDoNotIncludeSymbolChain|SymbolFormatFlagsAllowAnyNodeKind)
 * }
 */
export declare function Checker_getFullyQualifiedName(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, containingLocation: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExportsOfSymbol","kind":"method","status":"implemented","sigHash":"82e3cd24072afcca1bc5663da1d5a3e827b6f168c5b9c9220d87fa155f25cb7c","bodyHash":"f3015698fd1ef36ad23e32e60b543672f362fd915d98fd52dfad47513bcf0d28"}
 *
 * Go source:
 * func (c *Checker) getExportsOfSymbol(symbol *ast.Symbol) ast.SymbolTable {
 * 	if symbol.Flags&ast.SymbolFlagsLateBindingContainer != 0 {
 * 		return c.getResolvedMembersOrExportsOfSymbol(symbol, MembersOrExportsResolutionKindResolvedExports)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsModule != 0 {
 * 		return c.getExportsOfModule(symbol)
 * 	}
 * 	return symbol.Exports
 * }
 */
export declare function Checker_getExportsOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedMembersOrExportsOfSymbol","kind":"method","status":"implemented","sigHash":"73ad89fbd997a0028529ad8c8b86328af1f7bacad4ae38b4abe959ab00c96734","bodyHash":"a0d825998c1c0dfc6a7c8572e432352a961f708221cc26da479dc13c3358c6b0"}
 *
 * Go source:
 * func (c *Checker) getResolvedMembersOrExportsOfSymbol(symbol *ast.Symbol, resolutionKind MembersOrExportsResolutionKind) ast.SymbolTable {
 * 	links := c.membersAndExportsLinks.Get(symbol)
 * 	if links[resolutionKind] == nil {
 * 		isStatic := resolutionKind == MembersOrExportsResolutionKindResolvedExports
 * 		earlySymbols := symbol.Exports
 * 		switch {
 * 		case !isStatic:
 * 			earlySymbols = symbol.Members
 * 		case symbol.Flags&ast.SymbolFlagsModule != 0:
 * 			earlySymbols, _ = c.getExportsOfModuleWorker(symbol)
 * 		}
 * 		links[resolutionKind] = earlySymbols
 * 		// fill in any as-yet-unresolved late-bound members.
 * 		var lateSymbols ast.SymbolTable
 * 		for _, decl := range symbol.Declarations {
 * 			for _, member := range getMembersOfDeclaration(decl) {
 * 				if isStatic == ast.HasStaticModifier(member) {
 * 					switch {
 * 					case c.hasLateBindableName(member):
 * 						if lateSymbols == nil {
 * 							lateSymbols = make(ast.SymbolTable)
 * 						}
 * 						c.lateBindMember(symbol, earlySymbols, lateSymbols, member)
 * 					case c.hasLateBindableIndexSignature(member):
 * 						if lateSymbols == nil {
 * 							lateSymbols = make(ast.SymbolTable)
 * 						}
 * 						c.lateBindIndexSignature(symbol, earlySymbols, lateSymbols, member.AsNode() /* as LateBoundDeclaration | LateBoundBinaryExpressionDeclaration * /)
 * 					}
 * 				}
 * 			}
 * 		}
 * 		if isStatic {
 * 			if assignmentSymbol := symbol.Exports[ast.InternalSymbolNameAssignmentDeclaration]; assignmentSymbol != nil {
 * 				for _, member := range assignmentSymbol.Declarations {
 * 					if c.hasLateBindableName(member) {
 * 						if lateSymbols == nil {
 * 							lateSymbols = make(ast.SymbolTable)
 * 						}
 * 						c.lateBindMember(symbol, earlySymbols, lateSymbols, member)
 * 					}
 * 				}
 * 			}
 * 		}
 * 		links[resolutionKind] = c.combineSymbolTables(earlySymbols, lateSymbols)
 * 	}
 * 	return links[resolutionKind]
 * }
 */
export declare function Checker_getResolvedMembersOrExportsOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, resolutionKind: MembersOrExportsResolutionKind): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.lateBindMember","kind":"method","status":"implemented","sigHash":"ec923c6ee955585fda06299b13da397a2d4815d1c60cc3a52c4ccd49fb9e5906","bodyHash":"ded2bda61f3948a31bb5f4838b902814f9512aedc5409414e0e80548c456fc50"}
 *
 * Go source:
 * func (c *Checker) lateBindMember(parent *ast.Symbol, earlySymbols ast.SymbolTable, lateSymbols ast.SymbolTable, decl *ast.Node) *ast.Symbol {
 * 	debug.Assert(decl.Symbol() != nil, "The member is expected to have a symbol.")
 * 	links := c.symbolNodeLinks.Get(decl)
 * 	if links.resolvedSymbol == nil {
 * 		// In the event we attempt to resolve the late-bound name of this member recursively,
 * 		// fall back to the early-bound name of this member.
 * 		links.resolvedSymbol = decl.Symbol()
 * 		var declName *ast.Node
 * 		if ast.IsBinaryExpression(decl) {
 * 			declName = decl.AsBinaryExpression().Left
 * 		} else {
 * 			declName = decl.Name()
 * 		}
 * 		var t *Type
 * 		if ast.IsElementAccessExpression(declName) {
 * 			t = c.checkExpressionCached(declName.AsElementAccessExpression().ArgumentExpression)
 * 		} else {
 * 			t = c.checkComputedPropertyName(declName)
 * 		}
 * 		if isTypeUsableAsPropertyName(t) {
 * 			memberName := getPropertyNameFromType(t)
 * 			symbolFlags := decl.Symbol().Flags
 * 			// Get or add a late-bound symbol for the member. This allows us to merge late-bound accessor declarations.
 * 			lateSymbol := lateSymbols[memberName]
 * 			if lateSymbol == nil {
 * 				lateSymbol = c.newSymbolEx(ast.SymbolFlagsNone, memberName, ast.CheckFlagsLate)
 * 				lateSymbols[memberName] = lateSymbol
 * 			}
 * 			// Report an error if there's a symbol declaration with the same name and conflicting flags.
 * 			earlySymbol := earlySymbols[memberName]
 * 			if lateSymbol.Flags&getExcludedSymbolFlags(symbolFlags) != 0 {
 * 				// If we have an existing early-bound member, combine its declarations so that we can
 * 				// report an error at each declaration.
 * 				var declarations []*ast.Node
 * 				if earlySymbol != nil {
 * 					declarations = core.Concatenate(earlySymbol.Declarations, lateSymbol.Declarations)
 * 				} else {
 * 					declarations = lateSymbol.Declarations
 * 				}
 * 				name := memberName
 * 				if t.flags&TypeFlagsUniqueESSymbol != 0 {
 * 					name = scanner.DeclarationNameToString(declName)
 * 				}
 * 				for _, d := range declarations {
 * 					c.error(core.OrElse(ast.GetNameOfDeclaration(d), d), diagnostics.Duplicate_identifier_0, name)
 * 				}
 * 				c.error(core.OrElse(declName, decl), diagnostics.Duplicate_identifier_0, name)
 * 				if lateSymbol.Flags&ast.SymbolFlagsAccessor != 0 && lateSymbol.Flags&ast.SymbolFlagsAccessor != symbolFlags&ast.SymbolFlagsAccessor {
 * 					lateSymbol.Flags |= ast.SymbolFlagsAccessor
 * 				}
 * 				lateSymbol = c.newSymbolEx(ast.SymbolFlagsNone, memberName, ast.CheckFlagsLate)
 * 			}
 * 			c.valueSymbolLinks.Get(lateSymbol).nameType = t
 * 			c.addDeclarationToLateBoundSymbol(lateSymbol, decl, symbolFlags)
 * 			if lateSymbol.Parent == nil {
 * 				lateSymbol.Parent = parent
 * 			}
 * 			links.resolvedSymbol = lateSymbol
 * 		}
 * 	}
 * 	return links.resolvedSymbol
 * }
 */
export declare function Checker_lateBindMember(receiver: GoPtr<Checker>, parent: GoPtr<Symbol>, earlySymbols: SymbolTable, lateSymbols: SymbolTable, decl: GoPtr<Node>): GoPtr<Symbol>;
export declare function Checker_lateBindIndexSignature(receiver: GoPtr<Checker>, _parent: GoPtr<Symbol>, earlySymbols: SymbolTable, lateSymbols: SymbolTable, decl: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDeclarationToLateBoundSymbol","kind":"method","status":"implemented","sigHash":"5528c302c0620ca9291b1629eb75842f708917acc86e12862902a2f10a922a9a","bodyHash":"2f0093186e97c3ef6995c8135967a957dc865d2c5ba75e314983492891b1755f"}
 *
 * Go source:
 * func (c *Checker) addDeclarationToLateBoundSymbol(symbol *ast.Symbol, member *ast.Node, symbolFlags ast.SymbolFlags) {
 * 	debug.Assert(symbol.CheckFlags&ast.CheckFlagsLate != 0, "Expected a late-bound symbol.")
 * 	symbol.Flags |= symbolFlags
 * 	c.lateBoundLinks.Get(member.Symbol()).lateSymbol = symbol
 * 	if len(symbol.Declarations) == 0 || member.Symbol().Flags&ast.SymbolFlagsReplaceableByMethod == 0 {
 * 		symbol.Declarations = append(symbol.Declarations, member)
 * 	}
 * 	if symbolFlags&ast.SymbolFlagsValue != 0 {
 * 		binder.SetValueDeclaration(symbol, member)
 * 	}
 * }
 */
export declare function Checker_addDeclarationToLateBoundSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, member: GoPtr<Node>, symbolFlags: SymbolFlags): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getMembersOfSymbol","kind":"method","status":"implemented","sigHash":"927e5ba5d2c2e7af7c18eeab14b0e903076210c872750caa77f924b92b57cf07","bodyHash":"d6195ce3ecbc63931e0ed916af241fea53c623df0de6d48943889860e38f323e"}
 *
 * Go source:
 * func (c *Checker) getMembersOfSymbol(symbol *ast.Symbol) ast.SymbolTable {
 * 	if symbol.Flags&ast.SymbolFlagsLateBindingContainer != 0 {
 * 		return c.getResolvedMembersOrExportsOfSymbol(symbol, MembersOrExportsResolutionKindResolvedMembers)
 * 	}
 * 	return symbol.Members
 * }
 */
export declare function Checker_getMembersOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExportsOfModule","kind":"method","status":"implemented","sigHash":"67786a2d86cdf88b9e0852ae3f6e2a6898e83b0808c3be5eb77ce17fdf0753f5","bodyHash":"eceb0ec05d7d6fb9fb7dba9c9293d869f388d5a235e03f1826ff138f35917f4a"}
 *
 * Go source:
 * func (c *Checker) getExportsOfModule(moduleSymbol *ast.Symbol) ast.SymbolTable {
 * 	links := c.moduleSymbolLinks.Get(moduleSymbol)
 * 	if links.resolvedExports == nil {
 * 		exports, typeOnlyExportStarMap := c.getExportsOfModuleWorker(moduleSymbol)
 * 		links.resolvedExports = exports
 * 		links.typeOnlyExportStarMap = typeOnlyExportStarMap
 * 	}
 * 	return links.resolvedExports
 * }
 */
export declare function Checker_getExportsOfModule(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExportsOfModuleWorker","kind":"method","status":"implemented","sigHash":"15dc07fa9c4a955e5335e3896d3e8fa1a70e87ed30340e21001650a0f5236ff7","bodyHash":"6d8699b7b645979bcec70f951d95247297bda3b2e12f671163949687d1fe2ca1"}
 *
 * Go source:
 * func (c *Checker) getExportsOfModuleWorker(moduleSymbol *ast.Symbol) (exports ast.SymbolTable, typeOnlyExportStarMap map[string]*ast.Node) {
 * 	var visitedSymbols []*ast.Symbol
 * 	nonTypeOnlyNames := collections.NewSetWithSizeHint[string](len(moduleSymbol.Exports))
 * 	// The ES6 spec permits export * declarations in a module to circularly reference the module itself. For example,
 * 	// module 'a' can 'export * from "b"' and 'b' can 'export * from "a"' without error.
 * 	var visit func(*ast.Symbol, *ast.Node, bool) ast.SymbolTable
 * 	visit = func(symbol *ast.Symbol, exportStar *ast.Node, isTypeOnly bool) ast.SymbolTable {
 * 		if !isTypeOnly && symbol != nil {
 * 			// Add non-type-only names before checking if we've visited this module,
 * 			// because we might have visited it via an 'export type *', and visiting
 * 			// again with 'export *' will override the type-onlyness of its exports.
 * 			for name := range symbol.Exports {
 * 				nonTypeOnlyNames.Add(name)
 * 			}
 * 		}
 * 		if symbol == nil || symbol.Exports == nil || slices.Contains(visitedSymbols, symbol) {
 * 			return nil
 * 		}
 * 		visitedSymbols = append(visitedSymbols, symbol)
 * 		symbols := maps.Clone(symbol.Exports)
 * 		// All export * declarations are collected in an __export symbol by the binder
 * 		exportStars := symbol.Exports[ast.InternalSymbolNameExportStar]
 * 		if exportStars != nil {
 * 			nestedSymbols := make(ast.SymbolTable)
 * 			lookupTable := make(ExportCollisionTable)
 * 			for _, node := range exportStars.Declarations {
 * 				resolvedModule := c.resolveExternalModuleName(node, node.ModuleSpecifier(), false /*ignoreErrors* /)
 * 				exportedSymbols := visit(resolvedModule, node, isTypeOnly || node.IsTypeOnly())
 * 				c.extendExportSymbols(nestedSymbols, exportedSymbols, lookupTable, node)
 * 			}
 * 			for id, s := range lookupTable {
 * 				// It's not an error if the file with multiple `export *`s with duplicate names exports a member with that name itself
 * 				if id == ast.InternalSymbolNameExportEquals || len(s.exportsWithDuplicate) == 0 || symbols[id] != nil {
 * 					continue
 * 				}
 * 				for _, node := range s.exportsWithDuplicate {
 * 					c.addDiagnostic(createDiagnosticForNode(node, diagnostics.Module_0_has_already_exported_a_member_named_1_Consider_explicitly_re_exporting_to_resolve_the_ambiguity, s.specifierText, id))
 * 				}
 * 			}
 * 			c.extendExportSymbols(symbols, nestedSymbols, nil, nil)
 * 		}
 * 		if exportStar != nil && exportStar.IsTypeOnly() {
 * 			if typeOnlyExportStarMap == nil {
 * 				typeOnlyExportStarMap = make(map[string]*ast.Node)
 * 			}
 * 			for name := range symbols {
 * 				typeOnlyExportStarMap[name] = exportStar
 * 			}
 * 		}
 * 		return symbols
 * 	}
 * 	var originalModule *ast.Symbol
 * 	if moduleSymbol != nil {
 * 		if c.resolveSymbolEx(moduleSymbol.Exports[ast.InternalSymbolNameExportEquals], false /*dontResolveAlias* /) != nil {
 * 			originalModule = moduleSymbol
 * 		}
 * 	}
 * 	// A module defined by an 'export=' consists of one export that needs to be resolved
 * 	moduleSymbol = c.resolveExternalModuleSymbol(moduleSymbol, false /*dontResolveAlias* /)
 * 	exports = visit(moduleSymbol, nil, false)
 * 	if exports == nil {
 * 		exports = make(ast.SymbolTable)
 * 	}
 * 	// A CommonJS module defined by an 'export=' might also export typedefs, stored on the original module
 * 	if originalModule != nil && len(originalModule.Exports) > 1 {
 * 		for _, symbol := range originalModule.Exports {
 * 			if symbol.Name == ast.InternalSymbolNameExportEquals || symbol.Name == ast.InternalSymbolNameExportStar {
 * 				continue
 * 			}
 * 			flags := c.getSymbolFlags(symbol)
 * 			if flags&(ast.SymbolFlagsType|ast.SymbolFlagsNamespace) != 0 &&
 * 				flags&ast.SymbolFlagsValue == 0 &&
 * 				exports[symbol.Name] == nil {
 * 				exports[symbol.Name] = symbol
 * 			}
 * 		}
 * 	}
 * 	for name := range nonTypeOnlyNames.Keys() {
 * 		delete(typeOnlyExportStarMap, name)
 * 	}
 * 	return exports, typeOnlyExportStarMap
 * }
 */
export declare function Checker_getExportsOfModuleWorker(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>): [SymbolTable, GoMap<string, GoPtr<Node>>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.extendExportSymbols","kind":"method","status":"implemented","sigHash":"2be2610054a8b4079eb27d166a202be3803860eb68beac2df17e06f77d5e1691","bodyHash":"d9faa661aaa869ac37296f3d4d9a403e4f950b7c1122a84c294dea0171c5e5e1"}
 *
 * Go source:
 * func (c *Checker) extendExportSymbols(target ast.SymbolTable, source ast.SymbolTable, lookupTable ExportCollisionTable, exportNode *ast.Node) {
 * 	for id, sourceSymbol := range source {
 * 		if id == ast.InternalSymbolNameDefault {
 * 			continue
 * 		}
 * 		targetSymbol := target[id]
 * 		if targetSymbol == nil {
 * 			target[id] = sourceSymbol
 * 			if lookupTable != nil && exportNode != nil {
 * 				lookupTable[id] = &ExportCollision{
 * 					specifierText: scanner.GetTextOfNode(exportNode.ModuleSpecifier()),
 * 				}
 * 			}
 * 		} else if lookupTable != nil && exportNode != nil && c.resolveSymbol(targetSymbol) != c.resolveSymbol(sourceSymbol) {
 * 			s := lookupTable[id]
 * 			s.exportsWithDuplicate = append(s.exportsWithDuplicate, exportNode)
 * 		}
 * 	}
 * }
 */
export declare function Checker_extendExportSymbols(receiver: GoPtr<Checker>, target: SymbolTable, source: SymbolTable, lookupTable: ExportCollisionTable, exportNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.ResolveAlias","kind":"method","status":"implemented","sigHash":"8f2a08ddfbe42a7444a2b0243a51cdaedd22b54f212c4290d7e58a02bc96243d","bodyHash":"3b2b7049beba9581151d414a28ab2ba24450867aaf333b739e4ad5d729b9f473"}
 *
 * Go source:
 * func (c *Checker) ResolveAlias(symbol *ast.Symbol) (*ast.Symbol, bool) {
 * 	if symbol == nil {
 * 		return nil, false
 * 	}
 * 	resolved := c.resolveAlias(symbol)
 * 	return resolved, resolved != c.unknownSymbol
 * }
 */
export declare function Checker_ResolveAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): [GoPtr<Symbol>, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveAlias","kind":"method","status":"implemented","sigHash":"fe3af60f264b53d06848d4030c91f4c4a0f677a5ce0ee23a87ffceb8f80d724f","bodyHash":"5a3c9661c9c3cda880090e94834eebc454537cddb96324c8a6d3edcb9bb25d54"}
 *
 * Go source:
 * func (c *Checker) resolveAlias(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsAlias == 0 {
 * 		panic("Should only get alias here")
 * 	}
 * 	links := c.aliasSymbolLinks.Get(symbol)
 * 	if links.aliasTarget == nil {
 * 		if !c.pushTypeResolution(symbol, TypeSystemPropertyNameAliasTarget) {
 * 			return c.unknownSymbol
 * 		}
 * 		node := c.getDeclarationOfAliasSymbol(symbol)
 * 		if node == nil {
 * 			panic("Unexpected nil in resolveAlias for symbol: " + c.symbolToString(symbol))
 * 		}
 * 		target := c.getTargetOfAliasDeclaration(node)
 * 		if ast.IsNonLocalAlias(target, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace) {
 * 			// When the target is a pure alias, we transitively resolve and propagate any typeOnlyDeclaration
 * 			target = c.resolveIndirectionAlias(symbol, target)
 * 		}
 * 		links.aliasTarget = core.OrElse(target, c.unknownSymbol)
 * 		if !c.popTypeResolution() {
 * 			c.error(node, diagnostics.Circular_definition_of_import_alias_0, c.symbolToString(symbol))
 * 			links.aliasTarget = c.unknownSymbol
 * 		}
 * 	}
 * 	return links.aliasTarget
 * }
 */
export declare function Checker_resolveAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveIndirectionAlias","kind":"method","status":"implemented","sigHash":"e88276f91fc0e4f0f3e892259df0eb06abf43ae0252fc3ec3676698ae851fe6f","bodyHash":"4c210f2faf3425afb2e8aec798f15cfcaf27f390f393608d8d121ae877fb43d9"}
 *
 * Go source:
 * func (c *Checker) resolveIndirectionAlias(source *ast.Symbol, target *ast.Symbol) *ast.Symbol {
 * 	result := c.getMergedSymbol(c.resolveAlias(target))
 * 	if targetLinks := c.aliasSymbolLinks.Get(target); targetLinks.typeOnlyDeclaration != nil {
 * 		if sourceLinks := c.aliasSymbolLinks.Get(source); sourceLinks.typeOnlyDeclaration == nil {
 * 			sourceLinks.typeOnlyDeclaration = targetLinks.typeOnlyDeclaration
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function Checker_resolveIndirectionAlias(receiver: GoPtr<Checker>, source: GoPtr<Symbol>, target: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryResolveAlias","kind":"method","status":"implemented","sigHash":"f7563460aa525803f13d43942b8e94faaf455658ab2da17fbf1b6a13c945d0ac","bodyHash":"53469291792446452e7731ee47565a2c6289bce37a9d0dd5f31311a48af02150"}
 *
 * Go source:
 * func (c *Checker) tryResolveAlias(symbol *ast.Symbol) *ast.Symbol {
 * 	links := c.aliasSymbolLinks.Get(symbol)
 * 	if links.aliasTarget != nil || c.findResolutionCycleStartIndex(symbol, TypeSystemPropertyNameAliasTarget) < 0 {
 * 		return c.resolveAlias(symbol)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_tryResolveAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveAliasWithDeprecationCheck","kind":"method","status":"implemented","sigHash":"c9b9f385352bf280dd523250c5763f2b921dc470ed1b3e1cfb964d00c8e66772","bodyHash":"e945d87ccce14f68c03c3c84e31dfed25d94cf398583adb9c1d1505bdfb332e3"}
 *
 * Go source:
 * func (c *Checker) resolveAliasWithDeprecationCheck(symbol *ast.Symbol, location *ast.Node) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsAlias == 0 || c.isDeprecatedSymbol(symbol) || c.getDeclarationOfAliasSymbol(symbol) == nil {
 * 		return symbol
 * 	}
 * 	targetSymbol := c.resolveAlias(symbol)
 * 	if targetSymbol == c.unknownSymbol {
 * 		return targetSymbol
 * 	}
 * 	for symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		target := c.getImmediateAliasedSymbol(symbol)
 * 		if target != nil {
 * 			if target == targetSymbol {
 * 				break
 * 			}
 * 			if len(target.Declarations) != 0 {
 * 				if c.isDeprecatedSymbol(target) {
 * 					c.addDeprecatedSuggestion(location, target.Declarations, target.Name)
 * 					break
 * 				} else {
 * 					if symbol == targetSymbol {
 * 						break
 * 					}
 * 					symbol = target
 * 				}
 * 			}
 * 		} else {
 * 			break
 * 		}
 * 	}
 * 	return targetSymbol
 * }
 */
export declare function Checker_resolveAliasWithDeprecationCheck(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolFlags","kind":"method","status":"implemented","sigHash":"9947a5970c86d1771d3fd3840e06c83742abe6b9c40b70ed61529b5d1052b9bf","bodyHash":"2f144117ba0ff8d06893cc2f3c85f5d29c97fc53e2fbe7f1b1c6289aca9c9946"}
 *
 * Go source:
 * func (c *Checker) getSymbolFlags(symbol *ast.Symbol) ast.SymbolFlags {
 * 	return c.getSymbolFlagsEx(symbol, false /*excludeTypeOnlyMeanings* /, false /*excludeLocalMeanings* /)
 * }
 */
export declare function Checker_getSymbolFlags(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): SymbolFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolFlagsEx","kind":"method","status":"implemented","sigHash":"d8024d6135b2a6af095fbe0b6e41bc2937439689c247c148bcd541ab66ca574d","bodyHash":"2f6d63407791dcdb9d52cb52b95743733af39c4f018e815cf2d84d57f7b7ebde"}
 *
 * Go source:
 * func (c *Checker) getSymbolFlagsEx(symbol *ast.Symbol, excludeTypeOnlyMeanings bool, excludeLocalMeanings bool) ast.SymbolFlags {
 * 	var seenSymbols collections.Set[*ast.Symbol]
 * 	var flags ast.SymbolFlags
 * 	if !excludeLocalMeanings {
 * 		flags = symbol.Flags
 * 	}
 * 	for symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		if excludeTypeOnlyMeanings && c.getTypeOnlyAliasDeclaration(symbol) != nil {
 * 			break
 * 		}
 * 		target := c.getExportSymbolOfValueSymbolIfExported(c.resolveAlias(symbol))
 * 		if target == c.unknownSymbol {
 * 			return ast.SymbolFlagsAll
 * 		}
 * 		if target.Flags&ast.SymbolFlagsAlias != 0 {
 * 			// Optimization - try to avoid creating or adding to `seenSymbols` if possible
 * 			if target == symbol || seenSymbols.Has(target) {
 * 				break
 * 			}
 * 			if seenSymbols.Len() == 0 {
 * 				seenSymbols.Add(symbol)
 * 			}
 * 			seenSymbols.Add(target)
 * 		}
 * 		flags |= target.Flags
 * 		symbol = target
 * 	}
 * 	return flags
 * }
 */
export declare function Checker_getSymbolFlagsEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, excludeTypeOnlyMeanings: bool, excludeLocalMeanings: bool): SymbolFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclarationOfAliasSymbol","kind":"method","status":"implemented","sigHash":"e79683b5c0bef3c5d1c26bf7dfb4ad0158f8d58fe79b72bb92f4c3f30d84a701","bodyHash":"84dcedca61cfdb2b6aa020ceca1516aecbb6dd15bd84ae298bd1741918d5dbe8"}
 *
 * Go source:
 * func (c *Checker) getDeclarationOfAliasSymbol(symbol *ast.Symbol) *ast.Node {
 * 	return core.FindLast(symbol.Declarations, ast.IsAliasSymbolDeclaration)
 * }
 */
export declare function Checker_getDeclarationOfAliasSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfSymbolWithDeferredType","kind":"method","status":"implemented","sigHash":"235b4b5c839a73d4e5829457eb86fd7fd0d36868abcfad9f896de5ca27a40913","bodyHash":"409a994fdbe8e0ee28b22c00233ab8fa6d59519ab3f450f5051b93d47626fefc"}
 *
 * Go source:
 * func (c *Checker) getTypeOfSymbolWithDeferredType(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		deferred := c.deferredSymbolLinks.Get(symbol)
 * 		if deferred.parent.flags&TypeFlagsUnion != 0 {
 * 			links.resolvedType = c.getUnionType(deferred.constituents)
 * 		} else {
 * 			links.resolvedType = c.getIntersectionType(deferred.constituents)
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfSymbolWithDeferredType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWriteTypeOfSymbolWithDeferredType","kind":"method","status":"implemented","sigHash":"24edc1884362e47c731e9bcc0f1bf67e79969d4f3a56b244a244bff2ede49405","bodyHash":"77a79e9cb87bc2038fffba1d12ced0f365ce7ee578ce6f7a429a4564a40b66b5"}
 *
 * Go source:
 * func (c *Checker) getWriteTypeOfSymbolWithDeferredType(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.writeType == nil {
 * 		deferred := c.deferredSymbolLinks.Get(symbol)
 * 		if len(deferred.writeConstituents) != 0 {
 * 			if deferred.parent.flags&TypeFlagsUnion != 0 {
 * 				links.writeType = c.getUnionType(deferred.writeConstituents)
 * 			} else {
 * 				links.writeType = c.getIntersectionType(deferred.writeConstituents)
 * 			}
 * 		} else {
 * 			links.writeType = c.getTypeOfSymbolWithDeferredType(symbol)
 * 		}
 * 	}
 * 	return links.writeType
 * }
 */
export declare function Checker_getWriteTypeOfSymbolWithDeferredType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWriteTypeOfSymbol","kind":"method","status":"implemented","sigHash":"e24b7643d7d4c332358dc7c7facd763d3170b438cf4520ba650e2512758da430","bodyHash":"2c28e6dfd114f50fca2b23c2cd23d9af03a9edf9fcfebff0840f5785faceb6ae"}
 *
 * Go source:
 * func (c *Checker) getWriteTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	if symbol.CheckFlags&ast.CheckFlagsSyntheticProperty != 0 {
 * 		if symbol.CheckFlags&ast.CheckFlagsDeferredType != 0 {
 * 			return c.getWriteTypeOfSymbolWithDeferredType(symbol)
 * 		}
 * 		links := c.valueSymbolLinks.Get(symbol)
 * 		return core.OrElse(links.writeType, links.resolvedType)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsProperty != 0 {
 * 		return c.removeMissingType(c.getTypeOfSymbol(symbol), symbol.Flags&ast.SymbolFlagsOptional != 0)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsAccessor != 0 {
 * 		if symbol.CheckFlags&ast.CheckFlagsInstantiated != 0 {
 * 			return c.getWriteTypeOfInstantiatedSymbol(symbol)
 * 		}
 * 		return c.getWriteTypeOfAccessors(symbol)
 * 	}
 * 	return c.getTypeOfSymbol(symbol)
 * }
 */
export declare function Checker_getWriteTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetTypeOfSymbolAtLocation","kind":"method","status":"implemented","sigHash":"360d11f6ce9312db4cbe5265698c54b9bf41b960ecca5c854783db77ff4a3d25","bodyHash":"68857fed10d7326702c25e5f8713d8dfea6b179c3f25cde277a0cebbb539886a"}
 *
 * Go source:
 * func (c *Checker) GetTypeOfSymbolAtLocation(symbol *ast.Symbol, location *ast.Node) *Type {
 * 	symbol = c.getExportSymbolOfValueSymbolIfExported(symbol)
 * 	if location != nil {
 * 		// If we have an identifier or a property access at the given location, if the location is
 * 		// an dotted name expression, and if the location is not an assignment target, obtain the type
 * 		// of the expression (which will reflect control flow analysis). If the expression indeed
 * 		// resolved to the given symbol, return the narrowed type.
 * 		if (ast.IsIdentifier(location) || ast.IsPrivateIdentifier(location)) &&
 * 			!(ast.IsJsxTagName(location) || ast.IsJsxAttribute(location.Parent) || ast.IsJsxNamespacedName(location.Parent)) {
 * 			if ast.IsRightSideOfQualifiedNameOrPropertyAccess(location) {
 * 				location = location.Parent
 * 			}
 * 			if ast.IsExpressionNode(location) && (!ast.IsAssignmentTarget(location) || ast.IsWriteAccess(location)) {
 * 				var t *Type
 * 				if ast.IsWriteAccess(location) && location.Kind == ast.KindPropertyAccessExpression {
 * 					t = c.checkPropertyAccessExpression(location, CheckModeNormal, true /*writeOnly* /)
 * 				} else {
 * 					t = c.getTypeOfExpression(location)
 * 				}
 * 				if c.getExportSymbolOfValueSymbolIfExported(c.symbolNodeLinks.Get(location).resolvedSymbol) == symbol {
 * 					return c.removeOptionalTypeMarker(t)
 * 				}
 * 			}
 * 		}
 * 		if ast.IsDeclarationName(location) && ast.IsSetAccessorDeclaration(location.Parent) && c.getAnnotatedAccessorTypeNode(location.Parent) != nil {
 * 			return c.getWriteTypeOfAccessors(location.Parent.Symbol())
 * 		}
 * 		// The location isn't a reference to the given symbol, meaning we're being asked
 * 		// a hypothetical question of what type the symbol would have if there was a reference
 * 		// to it at the given location. Since we have no control flow information for the
 * 		// hypothetical reference (control flow information is created and attached by the
 * 		// binder), we simply return the declared type of the symbol.
 * 		if isRightSideOfAccessExpression(location) && ast.IsWriteAccess(location.Parent) {
 * 			return c.getWriteTypeOfSymbol(symbol)
 * 		}
 * 	}
 * 	return c.getNonMissingTypeOfSymbol(symbol)
 * }
 */
export declare function Checker_GetTypeOfSymbolAtLocation(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfSymbol","kind":"method","status":"implemented","sigHash":"1c24bfaac457b83634b77912c79071e771dd01798fb2ae96c9450d57070ed9cf","bodyHash":"d6db581148c57d65ed82ab1f082b987cdeb5841434bde171d3ec2a520408c4b8"}
 *
 * Go source:
 * func (c *Checker) getTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	if symbol.CheckFlags&ast.CheckFlagsDeferredType != 0 {
 * 		return c.getTypeOfSymbolWithDeferredType(symbol)
 * 	}
 * 	if symbol.CheckFlags&ast.CheckFlagsInstantiated != 0 {
 * 		return c.getTypeOfInstantiatedSymbol(symbol)
 * 	}
 * 	if symbol.CheckFlags&ast.CheckFlagsMapped != 0 {
 * 		return c.getTypeOfMappedSymbol(symbol)
 * 	}
 * 	if symbol.CheckFlags&ast.CheckFlagsReverseMapped != 0 {
 * 		return c.getTypeOfReverseMappedSymbol(symbol)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsAccessor != 0 {
 * 		return c.getTypeOfAccessors(symbol)
 * 	}
 * 	if symbol.Flags&(ast.SymbolFlagsVariable|ast.SymbolFlagsProperty) != 0 {
 * 		return c.getTypeOfVariableOrParameterOrProperty(symbol)
 * 	}
 * 	if symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod|ast.SymbolFlagsClass|ast.SymbolFlagsEnum|ast.SymbolFlagsValueModule) != 0 {
 * 		return c.getTypeOfFuncClassEnumModule(symbol)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsEnumMember != 0 {
 * 		return c.getTypeOfEnumMember(symbol)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		return c.getTypeOfAlias(symbol)
 * 	}
 * 	return c.errorType
 * }
 */
export declare function Checker_getTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNonMissingTypeOfSymbol","kind":"method","status":"implemented","sigHash":"8e59724150e6b2a2631336f0e8f0549f65ebfdb3fc50ac3aff4aa580abd31610","bodyHash":"c64b54d9f6050cf410c3154d2491c4412186abc714fa4fa7b88efb8e24df9270"}
 *
 * Go source:
 * func (c *Checker) getNonMissingTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	return c.removeMissingType(c.getTypeOfSymbol(symbol), symbol.Flags&ast.SymbolFlagsOptional != 0)
 * }
 */
export declare function Checker_getNonMissingTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWidenedTypeForVariableLikeDeclaration","kind":"method","status":"implemented","sigHash":"cbae34914a3fa8eacb5620eb7244d96d37774eb20fca124c3637607bfe06c1cc","bodyHash":"9402348364f737345acde513330c662c2139cf1b4ca1680b1825e6b341b2afa5"}
 *
 * Go source:
 * func (c *Checker) getWidenedTypeForVariableLikeDeclaration(declaration *ast.Node, reportErrors bool) *Type {
 * 	return c.widenTypeForVariableLikeDeclaration(c.getTypeForVariableLikeDeclaration(declaration /*includeOptionality* /, true, CheckModeNormal), declaration, reportErrors)
 * }
 */
export declare function Checker_getWidenedTypeForVariableLikeDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, reportErrors: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeForVariableLikeDeclaration","kind":"method","status":"implemented","sigHash":"be62bcbc15dbbbd93bc8de021bbd565ed8f86a8951a4e70b01a21aba97a8f8c8","bodyHash":"d4a2fdf75052f32ae84cc511b7a3a9e5464dc9608681b02f668240c767564bff"}
 *
 * Go source:
 * func (c *Checker) getTypeForVariableLikeDeclaration(declaration *ast.Node, includeOptionality bool, checkMode CheckMode) *Type {
 * 	// A variable declared in a for..in statement is of type string, or of type keyof T when the
 * 	// right hand expression is of a type parameter type.
 * 	if ast.IsVariableDeclaration(declaration) {
 * 		grandParent := declaration.Parent.Parent
 * 		switch grandParent.Kind {
 * 		case ast.KindForInStatement:
 * 			indexType := c.getIndexType(c.getNonNullableTypeIfNeeded(c.checkExpressionEx(grandParent.Expression(), checkMode /*checkMode* /)))
 * 			if indexType.flags&(TypeFlagsTypeParameter|TypeFlagsIndex) != 0 {
 * 				return c.getExtractStringType(indexType)
 * 			}
 * 			return c.stringType
 * 		case ast.KindForOfStatement:
 * 			// checkRightHandSideOfForOf will return undefined if the for-of expression type was
 * 			// missing properties/signatures required to get its iteratedType (like
 * 			// [Symbol.iterator] or next). This may be because we accessed properties from anyType,
 * 			// or it may have led to an error inside getElementTypeOfIterable.
 * 			return c.checkRightHandSideOfForOf(grandParent)
 * 		}
 * 	} else if ast.IsBindingElement(declaration) {
 * 		return c.getTypeForBindingElement(declaration)
 * 	}
 * 	isProperty := ast.IsPropertyDeclaration(declaration) && !ast.HasAccessorModifier(declaration) || ast.IsPropertySignatureDeclaration(declaration)
 * 	isOptional := includeOptionality && isOptionalDeclaration(declaration)
 * 	// Use type from type annotation if one is present
 * 	declaredType := c.tryGetTypeFromTypeNode(declaration)
 * 	if ast.IsCatchClauseVariableDeclarationOrBindingElement(declaration) {
 * 		if declaredType != nil {
 * 			// If the catch clause is explicitly annotated with any or unknown, accept it, otherwise error.
 * 			if declaredType.flags&TypeFlagsAnyOrUnknown != 0 {
 * 				return declaredType
 * 			}
 * 			return c.errorType
 * 		}
 * 		// If the catch clause is not explicitly annotated, treat it as though it were explicitly
 * 		// annotated with unknown or any, depending on useUnknownInCatchVariables.
 * 		if c.useUnknownInCatchVariables {
 * 			return c.unknownType
 * 		} else {
 * 			return c.anyType
 * 		}
 * 	}
 * 	if declaredType != nil {
 * 		return c.addOptionalityEx(declaredType, isProperty, isOptional)
 * 	}
 * 	if c.noImplicitAny && ast.IsVariableDeclaration(declaration) && !ast.IsBindingPattern(declaration.Name()) &&
 * 		c.getCombinedModifierFlagsCached(declaration)&ast.ModifierFlagsExport == 0 && declaration.Flags&ast.NodeFlagsAmbient == 0 {
 * 		// If --noImplicitAny is on or the declaration is in a Javascript file,
 * 		// use control flow tracked 'any' type for non-ambient, non-exported var or let variables with no
 * 		// initializer or a 'null' or 'undefined' initializer.
 * 		initializer := declaration.Initializer()
 * 		if c.getCombinedNodeFlagsCached(declaration)&ast.NodeFlagsConstant == 0 && (initializer == nil || c.isNullOrUndefined(initializer)) {
 * 			return c.autoType
 * 		}
 * 		// Use control flow tracked 'any[]' type for non-ambient, non-exported variables with an empty array
 * 		// literal initializer.
 * 		if initializer != nil && isEmptyArrayLiteral(initializer) {
 * 			return c.autoArrayType
 * 		}
 * 	}
 * 	if ast.IsParameterDeclaration(declaration) {
 * 		if declaration.Symbol() == nil {
 * 			// parameters of function types defined in JSDoc in TS files don't have symbols
 * 			return nil
 * 		}
 * 		fn := declaration.Parent
 * 		// For a parameter of a set accessor, use the type of the get accessor if one is present
 * 		if ast.IsSetAccessorDeclaration(fn) && c.hasBindableName(fn) {
 * 			getter := ast.GetDeclarationOfKind(c.getSymbolOfDeclaration(declaration.Parent), ast.KindGetAccessor)
 * 			if getter != nil {
 * 				getterSignature := c.getSignatureFromDeclaration(getter)
 * 				thisParameter := c.getAccessorThisParameter(fn)
 * 				if thisParameter != nil && declaration == thisParameter {
 * 					// Use the type from the *getter*
 * 					debug.Assert(thisParameter.Type() == nil)
 * 					return c.getTypeOfSymbol(getterSignature.thisParameter)
 * 				}
 * 				return c.getReturnTypeOfSignature(getterSignature)
 * 			}
 * 		}
 * 		if t := c.getParameterTypeOfFullSignature(fn, declaration); t != nil {
 * 			return t
 * 		}
 * 		// Use contextual parameter type if one is available
 * 		var t *Type
 * 		if declaration.Symbol().Name == ast.InternalSymbolNameThis {
 * 			t = c.getContextualThisParameterType(fn)
 * 		} else {
 * 			t = c.getContextuallyTypedParameterType(declaration)
 * 		}
 * 		if t != nil {
 * 			return c.addOptionalityEx(t, false /*isProperty* /, isOptional)
 * 		}
 * 	}
 * 	// Use the type of the initializer expression if one is present and the declaration is
 * 	// not a parameter of a contextually typed function
 * 	if declaration.Initializer() != nil {
 * 		t := c.widenTypeInferredFromInitializer(declaration, c.checkDeclarationInitializer(declaration, checkMode, nil /*contextualType* /))
 * 		return c.addOptionalityEx(t, isProperty, isOptional)
 * 	}
 * 	if c.noImplicitAny && ast.IsPropertyDeclaration(declaration) {
 * 		// We have a property declaration with no type annotation or initializer, in noImplicitAny mode or a .js file.
 * 		// Use control flow analysis of this.xxx assignments in the constructor or static block to determine the type of the property.
 * 		if !ast.HasStaticModifier(declaration) {
 * 			constructor := ast.FindConstructorDeclaration(declaration.Parent)
 * 			var t *Type
 * 			switch {
 * 			case constructor != nil:
 * 				t = c.getFlowTypeInConstructor(declaration.Symbol(), constructor)
 * 			case declaration.ModifierFlags()&ast.ModifierFlagsAmbient != 0:
 * 				t = c.getTypeOfPropertyInBaseClass(declaration.Symbol())
 * 			}
 * 			if t == nil {
 * 				return nil
 * 			}
 * 			return c.addOptionalityEx(t, true /*isProperty* /, isOptional)
 * 		} else {
 * 			staticBlocks := core.Filter(declaration.Parent.Members(), ast.IsClassStaticBlockDeclaration)
 * 			var t *Type
 * 			switch {
 * 			case len(staticBlocks) != 0:
 * 				t = c.getFlowTypeInStaticBlocks(declaration.Symbol(), staticBlocks)
 * 			case declaration.ModifierFlags()&ast.ModifierFlagsAmbient != 0:
 * 				t = c.getTypeOfPropertyInBaseClass(declaration.Symbol())
 * 			}
 * 			if t == nil {
 * 				return nil
 * 			}
 * 			return c.addOptionalityEx(t, true /*isProperty* /, isOptional)
 * 		}
 * 	}
 * 	if ast.IsJsxAttribute(declaration) {
 * 		// if JSX attribute doesn't have initializer, by default the attribute will have boolean value of true.
 * 		// I.e <Elem attr /> is sugar for <Elem attr={true} />
 * 		return c.trueType
 * 	}
 * 	// If the declaration specifies a binding pattern and is not a parameter of a contextually
 * 	// typed function, use the type implied by the binding pattern
 * 	if ast.IsBindingPattern(declaration.Name()) {
 * 		return c.getTypeFromBindingPattern(declaration.Name() /*includePatternInType* /, false /*reportErrors* /, true)
 * 	}
 * 	// No type specified and nothing can be inferred
 * 	return nil
 * }
 */
export declare function Checker_getTypeForVariableLikeDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, includeOptionality: bool, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeclarationInitializer","kind":"method","status":"implemented","sigHash":"3f6a0999b2e86ff3ca12883bfe4665ebbbe639a27152f8031905820c755a3397","bodyHash":"6ae7ff6d5e77ba301c6a798d9627b64894c45c408ac8a6c7064c675caf5a7026"}
 *
 * Go source:
 * func (c *Checker) checkDeclarationInitializer(declaration *ast.Node, checkMode CheckMode, contextualType *Type) *Type {
 * 	initializer := declaration.Initializer()
 * 	t := c.getQuickTypeOfExpression(initializer)
 * 	if t == nil {
 * 		if contextualType != nil {
 * 			t = c.checkExpressionWithContextualType(initializer, contextualType, nil /*inferenceContext* /, checkMode)
 * 		} else {
 * 			t = c.checkExpressionCachedEx(initializer, checkMode)
 * 		}
 * 	}
 * 	if ast.IsParameterDeclaration(ast.GetRootDeclaration(declaration)) {
 * 		name := declaration.Name()
 * 		switch name.Kind {
 * 		case ast.KindObjectBindingPattern:
 * 			if isObjectLiteralType(t) {
 * 				return c.padObjectLiteralType(t, name)
 * 			}
 * 		case ast.KindArrayBindingPattern:
 * 			if isTupleType(t) {
 * 				return c.padTupleType(t, name)
 * 			}
 * 		}
 * 	}
 * 	return t
 * }
 */
export declare function Checker_checkDeclarationInitializer(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, checkMode: CheckMode, contextualType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyNameFromBindingElement","kind":"method","status":"implemented","sigHash":"83579f741b4c0b0ffa8ab6eac60c4f1747910dacfd4bc0c3e6d1415a0404a4a4","bodyHash":"fa058a908000d7662de3544889803f2573caebe1f7a14c6c7378a6410d02ec4e"}
 *
 * Go source:
 * func (c *Checker) getPropertyNameFromBindingElement(e *ast.Node) string {
 * 	exprType := c.getLiteralTypeFromPropertyName(e.PropertyNameOrName())
 * 	if isTypeUsableAsPropertyName(exprType) {
 * 		return getPropertyNameFromType(exprType)
 * 	}
 * 	return ast.InternalSymbolNameMissing
 * }
 */
export declare function Checker_getPropertyNameFromBindingElement(receiver: GoPtr<Checker>, e: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeSymbol","kind":"method","status":"implemented","sigHash":"81b5bcb2413fe322038a560399cc0699454e5024d13c31c0a8242f67b1fe509d","bodyHash":"c5c5e21b35bd1669f83f70f1103451809760d50d12ee564e1599478381600db3"}
 *
 * Go source:
 * func (b *keyBuilder) writeSymbol(s *ast.Symbol) {
 * 	hashWrite64(&b.h, ast.GetSymbolId(s))
 * }
 */
export declare function keyBuilder_writeSymbol(receiver: GoPtr<keyBuilder>, s: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeAlias","kind":"method","status":"implemented","sigHash":"5f8df4bdfd3f5b49fe78e04beb5fcadc9dcb14fa918cf82f6beef475262e1950","bodyHash":"a483f9e1f4387020b90a9329a48cfc4c39d2991e70e8796d2a143f54d12b0fba"}
 *
 * Go source:
 * func (b *keyBuilder) writeAlias(alias *TypeAlias) {
 * 	if alias != nil {
 * 		b.writeByte(1)
 * 		b.writeSymbol(alias.symbol)
 * 		b.writeTypes(alias.typeArguments)
 * 	} else {
 * 		b.writeByte(0)
 * 	}
 * }
 */
export declare function keyBuilder_writeAlias(receiver: GoPtr<keyBuilder>, alias: GoPtr<TypeAlias>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSyntheticElementAccess","kind":"method","status":"implemented","sigHash":"fa606aa9404ea616a9e08b62388b5b7dca3f25ddd18014ee473585122fae7f17","bodyHash":"6585a9545b8822c8dd2a1b5c9ae6351f338b050206d75fc3b89feb4ed229fe65"}
 *
 * Go source:
 * func (c *Checker) getSyntheticElementAccess(node *ast.Node) *ast.Node {
 * 	parentAccess := c.getParentElementAccess(node)
 * 	if parentAccess != nil && getFlowNodeOfNode(parentAccess) != nil {
 * 		if propName, ok := c.getDestructuringPropertyName(node); ok {
 * 			literal := c.factory.NewStringLiteral(propName, ast.TokenFlagsNone)
 * 			literal.Loc = node.Loc
 * 			lhsExpr := parentAccess
 * 			if !ast.IsLeftHandSideExpression(parentAccess) {
 * 				lhsExpr = c.factory.NewParenthesizedExpression(parentAccess)
 * 				lhsExpr.Loc = node.Loc
 * 			}
 * 			result := c.factory.NewElementAccessExpression(lhsExpr, nil, literal, ast.NodeFlagsNone)
 * 			result.Loc = node.Loc
 * 			literal.Parent = result
 * 			result.Parent = node
 * 			if lhsExpr != parentAccess {
 * 				lhsExpr.Parent = result
 * 			}
 * 			result.FlowNodeData().FlowNode = getFlowNodeOfNode(parentAccess)
 * 			return result
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getSyntheticElementAccess(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getParentElementAccess","kind":"method","status":"implemented","sigHash":"57faa652c09f6558d4c90dff548dadf6c6685e480bc36a16619da75ef035abfc","bodyHash":"13646e23f30ba37ab16c68e10bc1cd90cdbc856134de895060392fc226cf6d6b"}
 *
 * Go source:
 * func (c *Checker) getParentElementAccess(node *ast.Node) *ast.Node {
 * 	ancestor := node.Parent.Parent
 * 	switch ancestor.Kind {
 * 	case ast.KindBindingElement, ast.KindPropertyAssignment:
 * 		return c.getSyntheticElementAccess(ancestor)
 * 	case ast.KindArrayLiteralExpression:
 * 		return c.getSyntheticElementAccess(node.Parent)
 * 	case ast.KindVariableDeclaration:
 * 		return ancestor.Initializer()
 * 	case ast.KindBinaryExpression:
 * 		return ancestor.AsBinaryExpression().Right
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getParentElementAccess(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.declarationBelongsToPrivateAmbientMember","kind":"method","status":"implemented","sigHash":"8545d0e6906c1d17ad1e7d386d51c678e12607536d1fdac7d465716574cee987","bodyHash":"01fe9d760c13237d69b3b0579de9667c813e02884fa5ed11eb9a7d1c06113d94"}
 *
 * Go source:
 * func (c *Checker) declarationBelongsToPrivateAmbientMember(declaration *ast.Node) bool {
 * 	memberDeclaration := ast.GetRootDeclaration(declaration)
 * 	if ast.IsParameterDeclaration(memberDeclaration) {
 * 		memberDeclaration = memberDeclaration.Parent
 * 	}
 * 	return isPrivateWithinAmbient(memberDeclaration)
 * }
 */
export declare function Checker_declarationBelongsToPrivateAmbientMember(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPrototypeProperty","kind":"method","status":"implemented","sigHash":"5469ba403404dfebc1ae38633dc63e3bd8c841365bf02f14c87402410ac1e13f","bodyHash":"2d4c7c702f2967b6ba6eea58b308d9bef0e5af0592ffbb1a8246950f1449c312"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPrototypeProperty(prototype *ast.Symbol) *Type {
 * 	// TypeScript 1.0 spec (April 2014): 8.4
 * 	// Every class automatically contains a static property member named 'prototype',
 * 	// the type of which is an instantiation of the class type with type Any supplied as a type argument for each type parameter.
 * 	// It is an error to explicitly declare a static property member with the name 'prototype'.
 * 	classType := c.getDeclaredTypeOfSymbol(c.getParentOfSymbol(prototype))
 * 	typeParameters := classType.AsInterfaceType().TypeParameters()
 * 	if len(typeParameters) != 0 {
 * 		return c.createTypeReference(classType, core.Map(typeParameters, func(*Type) *Type { return c.anyType }))
 * 	}
 * 	return classType
 * }
 */
export declare function Checker_getTypeOfPrototypeProperty(receiver: GoPtr<Checker>, prototype: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromPropertyDescriptor","kind":"method","status":"implemented","sigHash":"4368259a4e871967214c97bc6ced3a46f7386ce8effb7f2a4e74228384995e1f","bodyHash":"4cfc44ed7864fed96d38d0fef2b3aa3acb5a9eb010de8c01c9bcc96aa0fc12ac"}
 *
 * Go source:
 * func (c *Checker) getTypeFromPropertyDescriptor(node *ast.Node) *Type {
 * 	objectLiteralType := c.checkExpressionCached(node)
 * 	if valueType := c.getTypeOfPropertyOfType(objectLiteralType, "value"); valueType != nil {
 * 		return valueType
 * 	}
 * 	if getFunc := c.getTypeOfPropertyOfType(objectLiteralType, "get"); getFunc != nil {
 * 		if getSig := c.getSingleCallSignature(getFunc); getSig != nil {
 * 			return c.getReturnTypeOfSignature(getSig)
 * 		}
 * 	}
 * 	if setFunc := c.getTypeOfPropertyOfType(objectLiteralType, "set"); setFunc != nil {
 * 		if setSig := c.getSingleCallSignature(setFunc); setSig != nil {
 * 			return c.getTypeOfFirstParameterOfSignature(setSig)
 * 		}
 * 	}
 * 	return c.anyType
 * }
 */
export declare function Checker_getTypeFromPropertyDescriptor(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.widenTypeForVariableLikeDeclaration","kind":"method","status":"implemented","sigHash":"37cf2c67f8928207d5791edf46b0d96002530b7401ab1c53169bffc969b712a2","bodyHash":"c6e6bc4004cb9310b0952e2063c3c91dca6cf338324153fd88a6c91076763012"}
 *
 * Go source:
 * func (c *Checker) widenTypeForVariableLikeDeclaration(t *Type, declaration *ast.Node, reportErrors bool) *Type {
 * 	if t != nil {
 * 		// This special case is required for backwards compatibility with libraries that merge a `symbol` property into `SymbolConstructor`.
 * 		// See https://github.com/microsoft/typescript-go/issues/1212
 * 		if t.flags&TypeFlagsESSymbol != 0 && c.isGlobalSymbolConstructor(declaration.Parent) {
 * 			t = c.getESSymbolLikeTypeForNode(declaration)
 * 		}
 *
 * 		if reportErrors {
 * 			c.reportErrorsFromWidening(declaration, t, WideningKindNormal)
 * 		}
 *
 * 		// always widen a 'unique symbol' type if the type was created for a different declaration.
 * 		if t.flags&TypeFlagsUniqueESSymbol != 0 && (ast.IsBindingElement(declaration) || declaration.Type() == nil) && t.symbol != c.getSymbolOfDeclaration(declaration) {
 * 			t = c.esSymbolType
 * 		}
 * 		return c.getWidenedType(t)
 * 	}
 * 	// Rest parameters default to type any[], other parameters default to type any
 * 	if ast.IsParameterDeclaration(declaration) && declaration.AsParameterDeclaration().DotDotDotToken != nil {
 * 		t = c.anyArrayType
 * 	} else {
 * 		t = c.anyType
 * 	}
 * 	// Report implicit any errors unless this is a private property within an ambient declaration
 * 	if reportErrors {
 * 		if !declarationBelongsToPrivateAmbientMember(declaration) {
 * 			c.reportImplicitAny(declaration, t, WideningKindNormal)
 * 		}
 * 	}
 * 	return t
 * }
 */
export declare function Checker_widenTypeForVariableLikeDeclaration(receiver: GoPtr<Checker>, t: GoPtr<Type>, declaration: GoPtr<Node>, reportErrors: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWidenedProperty","kind":"method","status":"implemented","sigHash":"76968a007c92409fbd0fe9fc77652240113f25736c00a10c51517a94c9a1a7c3","bodyHash":"5ac2527ea0a247cb77bbdd109100632d49097c13b5b373910dcc20c4506c064b"}
 *
 * Go source:
 * func (c *Checker) getWidenedProperty(prop *ast.Symbol, context *WideningContext) *ast.Symbol {
 * 	if prop.Flags&ast.SymbolFlagsProperty == 0 {
 * 		// Since get accessors already widen their return value there is no need to
 * 		// widen accessor based properties here.
 * 		return prop
 * 	}
 * 	original := c.getTypeOfSymbol(prop)
 * 	var propContext *WideningContext
 * 	if context != nil {
 * 		propContext = context.getChildContext(prop.Name)
 * 	}
 * 	widened := c.getWidenedTypeWithContext(original, propContext)
 * 	if widened == original {
 * 		return prop
 * 	}
 * 	return c.createSymbolWithType(prop, widened)
 * }
 */
export declare function Checker_getWidenedProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, context: GoPtr<WideningContext>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUndefinedProperty","kind":"method","status":"implemented","sigHash":"6f24ce82778a3c4eb2129a68569ff5aa9447d9811489f2699889f05012078841","bodyHash":"02ec1bfd81dd11bd3a6bc1345025371178fdcbf7f73257ab678974b426331bdb"}
 *
 * Go source:
 * func (c *Checker) getUndefinedProperty(prop *ast.Symbol) *ast.Symbol {
 * 	if cached := c.undefinedProperties[prop.Name]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.createSymbolWithType(prop, c.undefinedOrMissingType)
 * 	result.Flags |= ast.SymbolFlagsOptional
 * 	c.undefinedProperties[prop.Name] = result
 * 	return result
 * }
 */
export declare function Checker_getUndefinedProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfEnumMember","kind":"method","status":"implemented","sigHash":"cc15a6a36994ffeb72fe41a009eec22670aa830a323873e715704188f61bf349","bodyHash":"2904978b45a472802f2f8967bff16944117785fc22ebb88d95201d9196a99dc7"}
 *
 * Go source:
 * func (c *Checker) getTypeOfEnumMember(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		links.resolvedType = c.getDeclaredTypeOfEnumMember(symbol)
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfEnumMember(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfAlias","kind":"method","status":"implemented","sigHash":"619bfd0dce751da1cf14627d49d91551f0689875581abaeacf896d3861ececcc","bodyHash":"8edf42c97baba715fc09ba2909f9e9235bb7f41f4087be0398291f38815803cd"}
 *
 * Go source:
 * func (c *Checker) getTypeOfAlias(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		if !c.pushTypeResolution(symbol, TypeSystemPropertyNameType) {
 * 			return c.errorType
 * 		}
 * 		targetSymbol := c.resolveAlias(symbol)
 * 		exportSymbol := c.getTargetOfAliasDeclaration(c.getDeclarationOfAliasSymbol(symbol))
 * 		// It only makes sense to get the type of a value symbol. If the result of resolving
 * 		// the alias is not a value, then it has no type. To get the type associated with a
 * 		// type symbol, call getDeclaredTypeOfSymbol.
 * 		// This check is important because without it, a call to getTypeOfSymbol could end
 * 		// up recursively calling getTypeOfAlias, causing a stack overflow.
 * 		if links.resolvedType == nil {
 * 			if c.getSymbolFlags(targetSymbol)&ast.SymbolFlagsValue != 0 {
 * 				links.resolvedType = c.getTypeOfSymbol(targetSymbol)
 * 			} else {
 * 				links.resolvedType = c.errorType
 * 			}
 * 		}
 * 		if !c.popTypeResolution() {
 * 			c.reportCircularityError(core.OrElse(exportSymbol, symbol))
 * 			if links.resolvedType == nil {
 * 				links.resolvedType = c.errorType
 * 			}
 * 			return links.resolvedType
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclarationNodeFlagsFromSymbol","kind":"method","status":"implemented","sigHash":"fa675c8b732cb0d7b4969a0d24aa1db1886350f0c4970f89a030bb9aaaeef28c","bodyHash":"27ea3f9debae900cd70a447e20579498b1eef4730557930ffaecf34f5cb8829d"}
 *
 * Go source:
 * func (c *Checker) getDeclarationNodeFlagsFromSymbol(s *ast.Symbol) ast.NodeFlags {
 * 	if s.ValueDeclaration != nil {
 * 		return c.getCombinedNodeFlagsCached(s.ValueDeclaration)
 * 	}
 * 	return ast.NodeFlagsNone
 * }
 */
export declare function Checker_getDeclarationNodeFlagsFromSymbol(receiver: GoPtr<Checker>, s: GoPtr<Symbol>): NodeFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectivePropertyNameForPropertyNameNode","kind":"method","status":"implemented","sigHash":"09756230a769380d66f25837318bcaed4d6b3466c3308d18b446dd3bbad65aae","bodyHash":"69d8fd804534e863a30b2a68f58cc39441ffa39ff95a390b6e2893a87bc2c49e"}
 *
 * Go source:
 * func (c *Checker) getEffectivePropertyNameForPropertyNameNode(node *ast.PropertyName) (string, bool) {
 * 	name := ast.GetPropertyNameForPropertyNameNode(node)
 * 	switch {
 * 	case name != ast.InternalSymbolNameMissing:
 * 		return name, true
 * 	case ast.IsComputedPropertyName(node):
 * 		return c.tryGetNameFromType(c.getTypeOfExpression(node.Expression()))
 * 	}
 * 	return "", false
 * }
 */
export declare function Checker_getEffectivePropertyNameForPropertyNameNode(receiver: GoPtr<Checker>, node: GoPtr<PropertyName>): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetNameFromType","kind":"method","status":"implemented","sigHash":"32a0479a02e379e168c585efa504227b0ab2892ec6ae34448b9dad3fc75963bb","bodyHash":"92ecfd2efdb96ea0a6ba1d2321911cbd7a39c12a76fd4423e9205a14d36af0d0"}
 *
 * Go source:
 * func (c *Checker) tryGetNameFromType(t *Type) (name string, ok bool) {
 * 	switch {
 * 	case t.flags&TypeFlagsUniqueESSymbol != 0:
 * 		return t.AsUniqueESSymbolType().name, true
 * 	case t.flags&TypeFlagsStringLiteral != 0:
 * 		s := getStringLiteralValue(t)
 * 		return s, true
 * 	case t.flags&TypeFlagsNumberLiteral != 0:
 * 		s := getNumberLiteralValue(t).String()
 * 		return s, true
 * 	default:
 * 		return "", false
 * 	}
 * }
 */
export declare function Checker_tryGetNameFromType(receiver: GoPtr<Checker>, t: GoPtr<Type>): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findResolutionCycleStartIndex","kind":"method","status":"implemented","sigHash":"aa2e5eb7b6849941e7acf6fc866e5eae93584ac98cb132404844df26fdab3fcf","bodyHash":"7215403e5af99e9c8af43c4f801e06639d70a67002e38c149e918a3b9168bd45"}
 *
 * Go source:
 * func (c *Checker) findResolutionCycleStartIndex(target TypeSystemEntity, propertyName TypeSystemPropertyName) int {
 * 	for i := len(c.typeResolutions) - 1; i >= c.resolutionStart; i-- {
 * 		resolution := &c.typeResolutions[i]
 * 		if c.typeResolutionHasProperty(resolution) {
 * 			return -1
 * 		}
 * 		if resolution.target == target && resolution.propertyName == propertyName {
 * 			return i
 * 		}
 * 	}
 * 	return -1
 * }
 */
export declare function Checker_findResolutionCycleStartIndex(receiver: GoPtr<Checker>, target: TypeSystemEntity, propertyName: TypeSystemPropertyName): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.typeResolutionHasProperty","kind":"method","status":"implemented","sigHash":"524153710b03fcbd33bfbd4d91b58457d3fdef5fde47c1faef85559dca830c66","bodyHash":"c52392c74f7fbee2b09bca9a366f5429e11815588085384fd48424ca33ba280b"}
 *
 * Go source:
 * func (c *Checker) typeResolutionHasProperty(r *TypeResolution) bool {
 * 	switch r.propertyName {
 * 	case TypeSystemPropertyNameType:
 * 		return c.valueSymbolLinks.Get(r.target.(*ast.Symbol)).resolvedType != nil
 * 	case TypeSystemPropertyNameDeclaredType:
 * 		return c.typeAliasLinks.Get(r.target.(*ast.Symbol)).declaredType != nil
 * 	case TypeSystemPropertyNameResolvedTypeArguments:
 * 		return r.target.(*Type).AsTypeReference().resolvedTypeArguments != nil
 * 	case TypeSystemPropertyNameResolvedBaseTypes:
 * 		return r.target.(*Type).AsInterfaceType().baseTypesResolved
 * 	case TypeSystemPropertyNameResolvedBaseConstructorType:
 * 		return r.target.(*Type).AsInterfaceType().resolvedBaseConstructorType != nil
 * 	case TypeSystemPropertyNameResolvedReturnType:
 * 		return r.target.(*Signature).resolvedReturnType != nil
 * 	case TypeSystemPropertyNameResolvedBaseConstraint:
 * 		return r.target.(*Type).AsConstrainedType().resolvedBaseConstraint != nil
 * 	case TypeSystemPropertyNameInitializerIsUndefined:
 * 		return c.nodeLinks.Get(r.target.(*ast.Node)).flags&NodeCheckFlagsInitializerIsUndefinedComputed != 0
 * 	case TypeSystemPropertyNameWriteType:
 * 		return c.valueSymbolLinks.Get(r.target.(*ast.Symbol)).writeType != nil
 * 	case TypeSystemPropertyNameAliasTarget:
 * 		return c.aliasSymbolLinks.Get(r.target.(*ast.Symbol)).aliasTarget != nil
 * 	}
 * 	panic("Unhandled case in typeResolutionHasProperty")
 * }
 */
export declare function Checker_typeResolutionHasProperty(receiver: GoPtr<Checker>, r: GoPtr<TypeResolution>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyOfType","kind":"method","status":"implemented","sigHash":"a0c221a01e1309d2be1bbff6b1d58477ad24283209e654db805dcf24133e2701","bodyHash":"aec673a3487140f626fae9ee19e635cc7fc7ce045db81de7c6e27c1df0bbf6a0"}
 *
 * Go source:
 * func (c *Checker) getPropertyOfType(t *Type, name string) *ast.Symbol {
 * 	return c.getPropertyOfTypeEx(t, name, false /*skipObjectFunctionPropertyAugment* /, false /*includeTypeOnlyMembers* /)
 * }
 */
export declare function Checker_getPropertyOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyOfTypeEx","kind":"method","status":"implemented","sigHash":"a1efa07b60ceda0428ace27018185b4f3671e76f24e13b67046ebb607c767f92","bodyHash":"bdb225a8380e0a69ecb9699012bfa6282e0b81f6a8131dd81f65074ca3575154"}
 *
 * Go source:
 * func (c *Checker) getPropertyOfTypeEx(t *Type, name string, skipObjectFunctionPropertyAugment bool, includeTypeOnlyMembers bool) *ast.Symbol {
 * 	t = c.getReducedApparentType(t)
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		resolved := c.resolveStructuredTypeMembers(t)
 * 		symbol := resolved.members[name]
 * 		if symbol != nil {
 * 			if !includeTypeOnlyMembers && t.symbol != nil && t.symbol.Flags&ast.SymbolFlagsValueModule != 0 && c.moduleSymbolLinks.Get(t.symbol).typeOnlyExportStarMap[name] != nil {
 * 				// If this is the type of a module, `resolved.members.get(name)` might have effectively skipped over
 * 				// an `export type * from './foo'`, leaving `symbolIsValue` unable to see that the symbol is being
 * 				// viewed through a type-only export.
 * 				return nil
 * 			}
 * 			if c.symbolIsValueEx(symbol, includeTypeOnlyMembers) {
 * 				return symbol
 * 			}
 * 		}
 * 		if skipObjectFunctionPropertyAugment {
 * 			return nil
 * 		}
 * 		var functionType *Type
 * 		switch {
 * 		case t == c.anyFunctionType:
 * 			functionType = c.globalFunctionType
 * 		case len(resolved.CallSignatures()) != 0:
 * 			functionType = c.globalCallableFunctionType
 * 		case len(resolved.ConstructSignatures()) != 0:
 * 			functionType = c.globalNewableFunctionType
 * 		}
 * 		if functionType != nil {
 * 			symbol = c.getPropertyOfObjectType(functionType, name)
 * 			if symbol != nil {
 * 				return symbol
 * 			}
 * 		}
 * 		return c.getPropertyOfObjectType(c.globalObjectType, name)
 * 	case t.flags&TypeFlagsIntersection != 0:
 * 		prop := c.getPropertyOfUnionOrIntersectionType(t, name, true /*skipObjectFunctionPropertyAugment* /)
 * 		if prop != nil {
 * 			return prop
 * 		}
 * 		if !skipObjectFunctionPropertyAugment {
 * 			return c.getPropertyOfUnionOrIntersectionType(t, name, skipObjectFunctionPropertyAugment)
 * 		}
 * 		return nil
 * 	case t.flags&TypeFlagsUnion != 0:
 * 		return c.getPropertyOfUnionOrIntersectionType(t, name, skipObjectFunctionPropertyAugment)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getPropertyOfTypeEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, skipObjectFunctionPropertyAugment: bool, includeTypeOnlyMembers: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPropertyOfType","kind":"method","status":"implemented","sigHash":"62f5631f6c6ecf993a598f5bbf3848e621c5202df0084440fb7edf8cbf66889d","bodyHash":"11ed03a4f29a0a9c4188b27604690670223946a890d5ef8375e2df1148497d94"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyOfType(t *Type, name string) *Type {
 * 	prop := c.getPropertyOfType(t, name)
 * 	if prop != nil {
 * 		return c.getTypeOfSymbol(prop)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeOfPropertyOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfosOfType","kind":"method","status":"implemented","sigHash":"9d42fde0599af5bef4e541c3b994e5da7d81e2b6cd2134be5d15a1428d197342","bodyHash":"07771f630880ab8bd60a54e8a4d3ffdb7f9a55a7928aaa064a7ce9b241796642"}
 *
 * Go source:
 * func (c *Checker) getIndexInfosOfType(t *Type) []*IndexInfo {
 * 	return c.getIndexInfosOfStructuredType(c.getReducedApparentType(t))
 * }
 */
export declare function Checker_getIndexInfosOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfosOfStructuredType","kind":"method","status":"implemented","sigHash":"1bb3f6ff91c2d207d755117ffaa2719b7fd50fcbd58d668ab995c2b372bdd30a","bodyHash":"dd46d690b939abc3261cd6a54093a657ab72ecdd190e7222ed49c99fa5f1e396"}
 *
 * Go source:
 * func (c *Checker) getIndexInfosOfStructuredType(t *Type) []*IndexInfo {
 * 	if t.flags&TypeFlagsStructuredType != 0 {
 * 		return c.resolveStructuredTypeMembers(t).indexInfos
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getIndexInfosOfStructuredType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfoOfType","kind":"method","status":"implemented","sigHash":"36a80674f10e30cc1fcaf98ef379c70718b06d169047fc8b0eae50622d222873","bodyHash":"9bf2465cb9802caf7de6639b89bfb20168c37be559e537338a4fd859f558039b"}
 *
 * Go source:
 * func (c *Checker) getIndexInfoOfType(t *Type, keyType *Type) *IndexInfo {
 * 	return findIndexInfo(c.getIndexInfosOfType(t), keyType)
 * }
 */
export declare function Checker_getIndexInfoOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeOfType","kind":"method","status":"implemented","sigHash":"da9016f4aa3a5fb51f4dbc213aa291ed8896b6e90f8cbda3450182c1b7ee9ce2","bodyHash":"9dd307777d28542aaa96df14e1af955f18cf5f8e3c59ac3ce881df9c19230efa"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeOfType(t *Type, keyType *Type) *Type {
 * 	info := c.getIndexInfoOfType(t, keyType)
 * 	if info != nil {
 * 		return info.valueType
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getIndexTypeOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeOfTypeEx","kind":"method","status":"implemented","sigHash":"f688a64bfcc4ccb44caa9df172ad9d1bba450db5b18944f5f913627790d0305e","bodyHash":"a70814af719bde061622419bf5c16005c4ec7911e81f0e6fa695627e50546dfa"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeOfTypeEx(t *Type, keyType *Type, defaultType *Type) *Type {
 * 	if result := c.getIndexTypeOfType(t, keyType); result != nil {
 * 		return result
 * 	}
 * 	return defaultType
 * }
 */
export declare function Checker_getIndexTypeOfTypeEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>, defaultType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveStructuredTypeMembers","kind":"method","status":"implemented","sigHash":"22799b7fd0d9966f53fd94f97b761de6beb46635609972401906359a2fde2105","bodyHash":"58068b8c3213a09000e7a24b805968da53a592a7501a098d23414fcc55c086ac"}
 *
 * Go source:
 * func (c *Checker) resolveStructuredTypeMembers(t *Type) *StructuredType {
 * 	if t.objectFlags&ObjectFlagsMembersResolved == 0 {
 * 		switch {
 * 		case t.flags&TypeFlagsObject != 0:
 * 			switch {
 * 			case t.objectFlags&ObjectFlagsReference != 0:
 * 				c.resolveTypeReferenceMembers(t)
 * 			case t.objectFlags&ObjectFlagsClassOrInterface != 0:
 * 				c.resolveClassOrInterfaceMembers(t)
 * 			case t.objectFlags&ObjectFlagsReverseMapped != 0:
 * 				c.resolveReverseMappedTypeMembers(t)
 * 			case t.objectFlags&ObjectFlagsAnonymous != 0:
 * 				c.resolveAnonymousTypeMembers(t)
 * 			case t.objectFlags&ObjectFlagsMapped != 0:
 * 				c.resolveMappedTypeMembers(t)
 * 			default:
 * 				panic("Unhandled case in resolveStructuredTypeMembers")
 * 			}
 * 		case t.flags&TypeFlagsUnion != 0:
 * 			c.resolveUnionTypeMembers(t)
 * 		case t.flags&TypeFlagsIntersection != 0:
 * 			c.resolveIntersectionTypeMembers(t)
 * 		default:
 * 			panic("Unhandled case in resolveStructuredTypeMembers")
 * 		}
 * 	}
 * 	return t.AsStructuredType()
 * }
 */
export declare function Checker_resolveStructuredTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<StructuredType>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveClassOrInterfaceMembers","kind":"method","status":"implemented","sigHash":"26a1b5987171353d6072a709362a04509efdd788ef4fea0540ae3aac92867117","bodyHash":"3390b5653924d611088cd12d6b02bf536f89938355c33c8df09de1baa5159372"}
 *
 * Go source:
 * func (c *Checker) resolveClassOrInterfaceMembers(t *Type) {
 * 	c.resolveObjectTypeMembers(t, t, nil, nil)
 * }
 */
export declare function Checker_resolveClassOrInterfaceMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveTypeReferenceMembers","kind":"method","status":"implemented","sigHash":"30d5aed865b50dde338d0e0fcc1e76ece5a1a61648cbcb4fa8351c9f768a5cc1","bodyHash":"1cdcf036b5acf1cf421f17d25fe66a512dd1fda6d33da38d85b96df31fbf8bb6"}
 *
 * Go source:
 * func (c *Checker) resolveTypeReferenceMembers(t *Type) {
 * 	source := t.Target()
 * 	typeParameters := source.AsInterfaceType().allTypeParameters
 * 	typeArguments := c.getTypeArguments(t)
 * 	paddedTypeArguments := typeArguments
 * 	if len(typeArguments) == len(typeParameters)-1 {
 * 		paddedTypeArguments = core.Concatenate(typeArguments, []*Type{t})
 * 	}
 * 	c.resolveObjectTypeMembers(t, source, typeParameters, paddedTypeArguments)
 * }
 */
export declare function Checker_resolveTypeReferenceMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveObjectTypeMembers","kind":"method","status":"implemented","sigHash":"e295384186d7b85ac1b326e2459c86f58c814740c1039d61d603883cce5f62aa","bodyHash":"39e69dc06f5f662afc7b58d6bef95adc28144304768dd09944dba3ce3b201cc1"}
 *
 * Go source:
 * func (c *Checker) resolveObjectTypeMembers(t *Type, source *Type, typeParameters []*Type, typeArguments []*Type) {
 * 	var mapper *TypeMapper
 * 	var members ast.SymbolTable
 * 	var callSignatures []*Signature
 * 	var constructSignatures []*Signature
 * 	var indexInfos []*IndexInfo
 * 	var instantiated bool
 * 	resolved := c.resolveDeclaredMembers(source)
 * 	if slices.Equal(typeParameters, typeArguments) {
 * 		members = resolved.declaredMembers
 * 		callSignatures = resolved.declaredCallSignatures
 * 		constructSignatures = resolved.declaredConstructSignatures
 * 		indexInfos = resolved.declaredIndexInfos
 * 	} else {
 * 		instantiated = true
 * 		mapper = newTypeMapper(typeParameters, typeArguments)
 * 		members = c.instantiateSymbolTable(resolved.declaredMembers, mapper, len(typeParameters) == 1 /*mappingThisOnly* /)
 * 		callSignatures = c.instantiateSignatures(resolved.declaredCallSignatures, mapper)
 * 		constructSignatures = c.instantiateSignatures(resolved.declaredConstructSignatures, mapper)
 * 		indexInfos = c.instantiateIndexInfos(resolved.declaredIndexInfos, mapper)
 * 	}
 * 	baseTypes := c.getBaseTypes(source)
 * 	if len(baseTypes) != 0 {
 * 		if !instantiated {
 * 			members = maps.Clone(members)
 * 		}
 * 		c.setStructuredTypeMembers(t, members, callSignatures, constructSignatures, indexInfos)
 * 		thisArgument := core.LastOrNil(typeArguments)
 * 		t.objectFlags |= ObjectFlagsUnresolvedMembers
 * 		for _, baseType := range baseTypes {
 * 			instantiatedBaseType := baseType
 * 			if thisArgument != nil {
 * 				instantiatedBaseType = c.getTypeWithThisArgument(c.instantiateType(baseType, mapper), thisArgument, false /*needsApparentType* /)
 * 			}
 * 			members = c.addInheritedMembers(members, c.getPropertiesOfType(instantiatedBaseType))
 * 			callSignatures = core.Concatenate(callSignatures, c.getSignaturesOfType(instantiatedBaseType, SignatureKindCall))
 * 			constructSignatures = core.Concatenate(constructSignatures, c.getSignaturesOfType(instantiatedBaseType, SignatureKindConstruct))
 * 			var inheritedIndexInfos []*IndexInfo
 * 			if instantiatedBaseType != c.anyType {
 * 				inheritedIndexInfos = c.getIndexInfosOfType(instantiatedBaseType)
 * 			} else {
 * 				inheritedIndexInfos = []*IndexInfo{c.anyBaseTypeIndexInfo}
 * 			}
 * 			indexInfos = core.Concatenate(indexInfos, core.Filter(inheritedIndexInfos, func(info *IndexInfo) bool {
 * 				return findIndexInfo(indexInfos, info.keyType) == nil
 * 			}))
 * 		}
 * 		t.objectFlags &^= ObjectFlagsUnresolvedMembers
 * 	}
 * 	c.setStructuredTypeMembers(t, members, callSignatures, constructSignatures, indexInfos)
 * }
 */
export declare function Checker_resolveObjectTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>, source: GoPtr<Type>, typeParameters: GoSlice<GoPtr<Type>>, typeArguments: GoSlice<GoPtr<Type>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addInheritedMembers","kind":"method","status":"implemented","sigHash":"fd610b3605a0d7ac5f006abc9b531092964a234ffc710fd8cdbe047175c735d9","bodyHash":"d6505f2722e36f5749c576036c7376fef08f91e5ab1aa338ff0612b8d3ce1d6b"}
 *
 * Go source:
 * func (c *Checker) addInheritedMembers(symbols ast.SymbolTable, baseSymbols []*ast.Symbol) ast.SymbolTable {
 * 	for _, base := range baseSymbols {
 * 		if !isStaticPrivateIdentifierProperty(base) {
 * 			if s, ok := symbols[base.Name]; !ok || s.Flags&ast.SymbolFlagsValue == 0 {
 * 				if symbols == nil {
 * 					symbols = make(ast.SymbolTable)
 * 				}
 * 				symbols[base.Name] = base
 * 			}
 * 		}
 * 	}
 * 	return symbols
 * }
 */
export declare function Checker_addInheritedMembers(receiver: GoPtr<Checker>, symbols: SymbolTable, baseSymbols: GoSlice<GoPtr<Symbol>>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveDeclaredMembers","kind":"method","status":"implemented","sigHash":"ebbc7376a9f5c3d77dc74d2dd70a2a736293155bb00cd82acf9a265bcc86c8ea","bodyHash":"cd1ec7855c64058bc9603b1f07627bb05ff875bc20d04a0ee0369143bf077220"}
 *
 * Go source:
 * func (c *Checker) resolveDeclaredMembers(t *Type) *InterfaceType {
 * 	d := t.AsInterfaceType()
 * 	if !d.declaredMembersResolved {
 * 		members := c.getMembersOfSymbol(t.symbol)
 * 		d.declaredMembersResolved = true
 * 		d.declaredMembers = members
 * 		d.declaredCallSignatures = c.getSignaturesOfSymbol(d.declaredMembers[ast.InternalSymbolNameCall])
 * 		d.declaredConstructSignatures = c.getSignaturesOfSymbol(d.declaredMembers[ast.InternalSymbolNameNew])
 * 		d.declaredIndexInfos = c.getIndexInfosOfSymbol(t.symbol)
 * 	}
 * 	return d
 * }
 */
export declare function Checker_resolveDeclaredMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<InterfaceType>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfosOfSymbol","kind":"method","status":"implemented","sigHash":"9d7cc73c43c1d2007346b304e6b4258e39c940e8c54f59721efceda6972cf91b","bodyHash":"d64933136345d78b53ca5a9acf3c30011acf3ab28223395301cede6ec5adfbaa"}
 *
 * Go source:
 * func (c *Checker) getIndexInfosOfSymbol(symbol *ast.Symbol) []*IndexInfo {
 * 	indexSymbol := c.getIndexSymbol(symbol)
 * 	if indexSymbol != nil {
 * 		return c.getIndexInfosOfIndexSymbol(indexSymbol, slices.Collect(maps.Values(c.getMembersOfSymbol(symbol))))
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getIndexInfosOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexInfosOfIndexSymbol","kind":"method","status":"implemented","sigHash":"0a9ca6fd6c112885f01655b4dc9888acf94e19aeada5f9964e71c4ec8e8c588e","bodyHash":"de577459fbf6cd7d77fe3434692e52df1eb4552d85f53fa4b7a841186a75cdfb"}
 *
 * Go source:
 * func (c *Checker) getIndexInfosOfIndexSymbol(indexSymbol *ast.Symbol, siblingSymbols []*ast.Symbol) []*IndexInfo {
 * 	var indexInfos []*IndexInfo
 * 	hasComputedStringProperty := false
 * 	hasComputedNumberProperty := false
 * 	hasComputedSymbolProperty := false
 * 	readonlyComputedStringProperty := true
 * 	readonlyComputedNumberProperty := true
 * 	readonlyComputedSymbolProperty := true
 * 	var propertySymbols []*ast.Symbol
 * 	for _, declaration := range indexSymbol.Declarations {
 * 		if ast.IsIndexSignatureDeclaration(declaration) {
 * 			parameters := declaration.Parameters()
 * 			returnTypeNode := declaration.Type()
 * 			if len(parameters) == 1 {
 * 				typeNode := parameters[0].Type()
 * 				if typeNode != nil {
 * 					valueType := c.anyType
 * 					if returnTypeNode != nil {
 * 						valueType = c.getTypeFromTypeNode(returnTypeNode)
 * 					}
 * 					forEachType(c.getTypeFromTypeNode(typeNode), func(keyType *Type) {
 * 						if c.isValidIndexKeyType(keyType) && findIndexInfo(indexInfos, keyType) == nil {
 * 							indexInfo := c.newIndexInfo(keyType, valueType, ast.HasModifier(declaration, ast.ModifierFlagsReadonly), declaration, nil)
 * 							indexInfos = append(indexInfos, indexInfo)
 * 						}
 * 					})
 * 				}
 * 			}
 * 		} else if c.hasLateBindableIndexSignature(declaration) {
 * 			var declName *ast.Node
 * 			if ast.IsBinaryExpression(declaration) {
 * 				declName = declaration.AsBinaryExpression().Left
 * 			} else {
 * 				declName = declaration.Name()
 * 			}
 * 			var keyType *Type
 * 			if ast.IsElementAccessExpression(declName) {
 * 				keyType = c.checkExpressionCached(declName.AsElementAccessExpression().ArgumentExpression)
 * 			} else {
 * 				keyType = c.checkComputedPropertyName(declName)
 * 			}
 * 			if findIndexInfo(indexInfos, keyType) != nil {
 * 				continue
 * 				// Explicit index for key type takes priority
 * 			}
 * 			if c.isTypeAssignableTo(keyType, c.stringNumberSymbolType) {
 * 				if c.isTypeAssignableTo(keyType, c.numberType) {
 * 					hasComputedNumberProperty = true
 * 					if !hasReadonlyModifier(declaration) {
 * 						readonlyComputedNumberProperty = false
 * 					}
 * 				} else if c.isTypeAssignableTo(keyType, c.esSymbolType) {
 * 					hasComputedSymbolProperty = true
 * 					if !hasReadonlyModifier(declaration) {
 * 						readonlyComputedSymbolProperty = false
 * 					}
 * 				} else {
 * 					hasComputedStringProperty = true
 * 					if !hasReadonlyModifier(declaration) {
 * 						readonlyComputedStringProperty = false
 * 					}
 * 				}
 * 				propertySymbols = append(propertySymbols, declaration.Symbol())
 * 			}
 * 		}
 * 	}
 * 	if hasComputedStringProperty || hasComputedNumberProperty || hasComputedSymbolProperty {
 * 		for _, sym := range siblingSymbols {
 * 			if sym != indexSymbol {
 * 				propertySymbols = append(propertySymbols, sym)
 * 			}
 * 		}
 * 		// aggregate similar index infos implied to be the same key to the same combined index info
 * 		if hasComputedStringProperty && findIndexInfo(indexInfos, c.stringType) == nil {
 * 			indexInfos = append(indexInfos, c.getObjectLiteralIndexInfo(readonlyComputedStringProperty, propertySymbols, c.stringType))
 * 		}
 * 		if hasComputedNumberProperty && findIndexInfo(indexInfos, c.numberType) == nil {
 * 			indexInfos = append(indexInfos, c.getObjectLiteralIndexInfo(readonlyComputedNumberProperty, propertySymbols, c.numberType))
 * 		}
 * 		if hasComputedSymbolProperty && findIndexInfo(indexInfos, c.esSymbolType) == nil {
 * 			indexInfos = append(indexInfos, c.getObjectLiteralIndexInfo(readonlyComputedSymbolProperty, propertySymbols, c.esSymbolType))
 * 		}
 * 	}
 * 	return indexInfos
 * }
 */
export declare function Checker_getIndexInfosOfIndexSymbol(receiver: GoPtr<Checker>, indexSymbol: GoPtr<Symbol>, siblingSymbols: GoSlice<GoPtr<Symbol>>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getObjectLiteralIndexInfo","kind":"method","status":"implemented","sigHash":"3fb9c8fe8e8916106d11b5505740f28574d1bc93dbbf78334b4ba4826c16b027","bodyHash":"c3a2c37d6a0a34d5335e73e41e8c2d932bea1a8589ba0ce2c87b4fe1abe14603"}
 *
 * Go source:
 * func (c *Checker) getObjectLiteralIndexInfo(isReadonly bool, properties []*ast.Symbol, keyType *Type) *IndexInfo {
 * 	var propTypes []*Type
 * 	var components []*ast.Node
 * 	for _, prop := range properties {
 * 		if keyType == c.stringType && !c.isSymbolWithSymbolName(prop) ||
 * 			keyType == c.numberType && c.isSymbolWithNumericName(prop) ||
 * 			keyType == c.esSymbolType && c.isSymbolWithSymbolName(prop) {
 * 			propTypes = append(propTypes, c.getTypeOfSymbol(prop))
 * 			if c.isSymbolWithComputedName(prop) {
 * 				components = append(components, prop.Declarations[0])
 * 			}
 * 		}
 * 	}
 * 	unionType := c.undefinedType
 * 	if len(propTypes) != 0 {
 * 		unionType = c.getUnionTypeEx(propTypes, UnionReductionSubtype, nil, nil)
 * 	}
 * 	return c.newIndexInfo(keyType, unionType, isReadonly, nil /*declaration* /, components)
 * }
 */
export declare function Checker_getObjectLiteralIndexInfo(receiver: GoPtr<Checker>, isReadonly: bool, properties: GoSlice<GoPtr<Symbol>>, keyType: GoPtr<Type>): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolWithSymbolName","kind":"method","status":"implemented","sigHash":"b5f7f1b2e7a7b015014e4853a9b807db7815bbe4763a869b137dd331401bc4aa","bodyHash":"707d903573a9f2cca0d0d4d1f73dfac0c9efa8d168a694b3eb301ea8b274fc3a"}
 *
 * Go source:
 * func (c *Checker) isSymbolWithSymbolName(symbol *ast.Symbol) bool {
 * 	if IsKnownSymbol(symbol) {
 * 		return true
 * 	}
 * 	if len(symbol.Declarations) != 0 {
 * 		name := symbol.Declarations[0].Name()
 * 		return name != nil && ast.IsComputedPropertyName(name) && c.isTypeAssignableToKind(c.checkComputedPropertyName(name), TypeFlagsESSymbol)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSymbolWithSymbolName(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolWithNumericName","kind":"method","status":"implemented","sigHash":"3d474f0d11d6c14e2a0b3e29b145df70f6ecea410263631a42a61f3342e243a9","bodyHash":"4e9e283e4fba9f91a3cdb68bc2297ef7f5edb10370469c1d7244863eec7984da"}
 *
 * Go source:
 * func (c *Checker) isSymbolWithNumericName(symbol *ast.Symbol) bool {
 * 	if isNumericLiteralName(symbol.Name) {
 * 		return true
 * 	}
 * 	if len(symbol.Declarations) != 0 {
 * 		name := symbol.Declarations[0].Name()
 * 		return name != nil && c.isNumericName(name)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSymbolWithNumericName(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolWithComputedName","kind":"method","status":"implemented","sigHash":"ff0fa03161111a11c04d1a5a1ae5c72ab30b12c0cfb1348383cf9d3d7d575e48","bodyHash":"6c0a604cecabdc44fae6daa00e78203789fc650e7be72d8aab8026bc535bf20a"}
 *
 * Go source:
 * func (c *Checker) isSymbolWithComputedName(symbol *ast.Symbol) bool {
 * 	if len(symbol.Declarations) != 0 {
 * 		name := symbol.Declarations[0].Name()
 * 		return name != nil && ast.IsComputedPropertyName(name)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSymbolWithComputedName(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNumericName","kind":"method","status":"implemented","sigHash":"f033a8f1bc2f53ea183a22dfd121892c8d3d766d7ce1ad82d0fd8ae71daf7b20","bodyHash":"41b19c240e7e3e2b11929214b899308de21b302c28c5379b555eb1201a8e0a50"}
 *
 * Go source:
 * func (c *Checker) isNumericName(name *ast.Node) bool {
 * 	switch name.Kind {
 * 	case ast.KindComputedPropertyName:
 * 		return c.isNumericComputedName(name)
 * 	case ast.KindIdentifier, ast.KindNumericLiteral, ast.KindStringLiteral:
 * 		return isNumericLiteralName(name.Text())
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isNumericName(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNumericComputedName","kind":"method","status":"implemented","sigHash":"cc1d474073e3ac09fc081a2d49b2fa5468a0b164845594a7cc971e921959bd56","bodyHash":"af0729d0abd2aac7bdef810f8686fea220669cb8f37591e0f74e105632e0f88a"}
 *
 * Go source:
 * func (c *Checker) isNumericComputedName(name *ast.Node) bool {
 * 	// It seems odd to consider an expression of type Any to result in a numeric name,
 * 	// but this behavior is consistent with checkIndexedAccess
 * 	return c.isTypeAssignableToKind(c.checkComputedPropertyName(name), TypeFlagsNumberLike)
 * }
 */
export declare function Checker_isNumericComputedName(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isValidIndexKeyType","kind":"method","status":"implemented","sigHash":"7960164ab80bf195adb89d7e55ce3ba72c80c5653cc8f86bcb93dc5ad34a4e73","bodyHash":"327838924af8f5771d9f205c0c27722c9bb1c18f9f7a0625975a5de0e5734f7d"}
 *
 * Go source:
 * func (c *Checker) isValidIndexKeyType(t *Type) bool {
 * 	return t.flags&(TypeFlagsString|TypeFlagsNumber|TypeFlagsESSymbol) != 0 ||
 * 		c.isPatternLiteralType(t) ||
 * 		t.flags&TypeFlagsIntersection != 0 && !c.isGenericType(t) && core.Some(t.Types(), c.isValidIndexKeyType)
 * }
 */
export declare function Checker_isValidIndexKeyType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findIndexInfo","kind":"method","status":"implemented","sigHash":"2ce3b87c439215cd04e758b4a194181b7ffaad713227b3bbebfa576a810f76a7","bodyHash":"7ea1248dff25eaf7b8318825e11a305c4ab65f23b314afc69c809d29ce5d0fb6"}
 *
 * Go source:
 * func (c *Checker) findIndexInfo(indexInfos []*IndexInfo, keyType *Type) *IndexInfo {
 * 	for _, info := range indexInfos {
 * 		if info.keyType == keyType {
 * 			return info
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_findIndexInfo(receiver: GoPtr<Checker>, indexInfos: GoSlice<GoPtr<IndexInfo>>, keyType: GoPtr<Type>): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexSymbol","kind":"method","status":"implemented","sigHash":"225659459fa9ccbf05af2fcea2a24ab1041ae7d07714cbdcd6723b009d6d3f5c","bodyHash":"065010ce27753f0dcb5174f5976f0d7d9bad229d975b1f02be75b550aad45f89"}
 *
 * Go source:
 * func (c *Checker) getIndexSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.getMembersOfSymbol(symbol)[ast.InternalSymbolNameIndex]
 * }
 */
export declare function Checker_getIndexSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasBindableName","kind":"method","status":"implemented","sigHash":"22785bd430b74d8c91587f4cf0689589eb6c555c25402a56f8ea05cb012ff52b","bodyHash":"f96d5ab026fe3e04f93d6e91ade14baad4108bd9ce102604f5dda6c712f2e9a3"}
 *
 * Go source:
 * func (c *Checker) hasBindableName(node *ast.Node) bool {
 * 	return !ast.HasDynamicName(node) || c.hasLateBindableName(node)
 * }
 */
export declare function Checker_hasBindableName(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasLateBindableName","kind":"method","status":"implemented","sigHash":"774f3843de092bc855042c188b2cea999f169a938788419ae83d650fe90e3057","bodyHash":"7fbcefdeae9a3c2e89fca0f06984ea7f0a364f960e0f262c362dd4345f0f300c"}
 *
 * Go source:
 * func (c *Checker) hasLateBindableName(node *ast.Node) bool {
 * 	name := ast.GetNameOfDeclaration(node)
 * 	return name != nil && c.isLateBindableName(name)
 * }
 */
export declare function Checker_hasLateBindableName(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
export declare function Checker_hasLateBindableIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isLateBindableName","kind":"method","status":"implemented","sigHash":"40a534ec548e09cab636e703f9506c8b99f46f7f1fc81ee4c0b799a6368894bb","bodyHash":"42d3f6bc48f9ec6ea036c03b77531076358739a2b48b50d9f58c48f3d6f32c2b"}
 *
 * Go source:
 * func (c *Checker) isLateBindableName(node *ast.Node) bool {
 * 	if !isLateBindableAST(node) {
 * 		return false
 * 	}
 * 	if ast.IsComputedPropertyName(node) {
 * 		return isTypeUsableAsPropertyName(c.checkComputedPropertyName(node))
 * 	}
 * 	return isTypeUsableAsPropertyName(c.checkExpressionCached(node.AsElementAccessExpression().ArgumentExpression))
 * }
 */
export declare function Checker_isLateBindableName(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
export declare function Checker_isLateBindableIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
export declare function Checker_isTypeUsableAsIndexSignatureDeclaration(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateIndexInfo","kind":"method","status":"implemented","sigHash":"d7b177691a74e5064757b5880163a40d571e7dfcf5293222d13d89fe6f8f7f6d","bodyHash":"8fcd3a7cf23ca7d916d0c6d54b5f3092207378842a8b8d098a257f0e71b0aa29"}
 *
 * Go source:
 * func (c *Checker) instantiateIndexInfo(info *IndexInfo, m *TypeMapper) *IndexInfo {
 * 	newValueType := c.instantiateType(info.valueType, m)
 * 	if newValueType == info.valueType {
 * 		return info
 * 	}
 * 	return c.newIndexInfo(info.keyType, newValueType, info.isReadonly, info.declaration, info.components)
 * }
 */
export declare function Checker_instantiateIndexInfo(receiver: GoPtr<Checker>, info: GoPtr<IndexInfo>, m: GoPtr<TypeMapper>): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveAnonymousTypeMembers","kind":"method","status":"implemented","sigHash":"d4b772955b848a9485d8ea411d304b1fedf08cea50f5c9308403c408cf1574e7","bodyHash":"caa27a9002f4de332c6b5dfa86554c5dd13a72960a7e4448887a8cfd662efe18"}
 *
 * Go source:
 * func (c *Checker) resolveAnonymousTypeMembers(t *Type) {
 * 	d := t.AsObjectType()
 * 	if d.target != nil {
 * 		c.setStructuredTypeMembers(t, nil, nil, nil, nil)
 * 		members := c.createInstantiatedSymbolTable(c.getPropertiesOfObjectType(d.target), d.mapper)
 * 		callSignatures := c.instantiateSignatures(c.getSignaturesOfType(d.target, SignatureKindCall), d.mapper)
 * 		constructSignatures := c.instantiateSignatures(c.getSignaturesOfType(d.target, SignatureKindConstruct), d.mapper)
 * 		indexInfos := c.instantiateIndexInfos(c.getIndexInfosOfType(d.target), d.mapper)
 * 		c.setStructuredTypeMembers(t, members, callSignatures, constructSignatures, indexInfos)
 * 		return
 * 	}
 * 	symbol := c.getMergedSymbol(t.symbol)
 * 	if symbol.Flags&ast.SymbolFlagsTypeLiteral != 0 {
 * 		c.setStructuredTypeMembers(t, nil, nil, nil, nil)
 * 		members := c.getMembersOfSymbol(symbol)
 * 		callSignatures := c.getSignaturesOfSymbol(members[ast.InternalSymbolNameCall])
 * 		constructSignatures := c.getSignaturesOfSymbol(members[ast.InternalSymbolNameNew])
 * 		indexInfos := c.getIndexInfosOfSymbol(symbol)
 * 		c.setStructuredTypeMembers(t, members, callSignatures, constructSignatures, indexInfos)
 * 		return
 * 	}
 * 	// Combinations of function, class, enum and module
 * 	members := c.getExportsOfSymbol(symbol)
 * 	var indexInfos []*IndexInfo
 * 	if symbol == c.globalThisSymbol {
 * 		varsOnly := make(ast.SymbolTable)
 * 		for _, p := range members {
 * 			if p.Flags&ast.SymbolFlagsBlockScoped == 0 && !(p.Flags&ast.SymbolFlagsValueModule != 0 && len(p.Declarations) != 0 && core.Every(p.Declarations, ast.IsAmbientModule)) {
 * 				varsOnly[p.Name] = p
 * 			}
 * 		}
 * 		members = varsOnly
 * 	}
 * 	var baseConstructorIndexInfo *IndexInfo
 * 	c.setStructuredTypeMembers(t, members, nil, nil, nil)
 * 	if symbol.Flags&ast.SymbolFlagsClass != 0 {
 * 		classType := c.getDeclaredTypeOfClassOrInterface(symbol)
 * 		baseConstructorType := c.getBaseConstructorTypeOfClass(classType)
 * 		if baseConstructorType.flags&(TypeFlagsObject|TypeFlagsIntersection|TypeFlagsTypeVariable) != 0 {
 * 			members = maps.Clone(members)
 * 			c.addInheritedMembers(members, c.getPropertiesOfType(baseConstructorType))
 * 			c.setStructuredTypeMembers(t, members, nil, nil, nil)
 * 		} else if baseConstructorType == c.anyType {
 * 			baseConstructorIndexInfo = c.anyBaseTypeIndexInfo
 * 		}
 * 	}
 * 	indexSymbol := members[ast.InternalSymbolNameIndex]
 * 	if indexSymbol != nil {
 * 		indexInfos = c.getIndexInfosOfIndexSymbol(indexSymbol, slices.Collect(maps.Values(members)))
 * 	} else {
 * 		if baseConstructorIndexInfo != nil {
 * 			indexInfos = append(indexInfos, baseConstructorIndexInfo)
 * 		}
 * 		if symbol.Flags&ast.SymbolFlagsEnum != 0 && (c.getDeclaredTypeOfSymbol(symbol).flags&TypeFlagsEnum != 0 || core.Some(d.properties, func(prop *ast.Symbol) bool {
 * 			return c.getTypeOfSymbol(prop).flags&TypeFlagsNumberLike != 0
 * 		})) {
 * 			indexInfos = append(indexInfos, c.enumNumberIndexInfo)
 * 		}
 * 	}
 * 	d.indexInfos = indexInfos
 * 	// We resolve the members before computing the signatures because a signature may use
 * 	// typeof with a qualified name expression that circularly references the type we are
 * 	// in the process of resolving (see issue #6072). The temporarily empty signature list
 * 	// will never be observed because a qualified name can't reference signatures.
 * 	if symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod) != 0 {
 * 		d.signatures = c.getSignaturesOfSymbol(symbol)
 * 		d.callSignatureCount = len(d.signatures)
 * 	}
 * 	// And likewise for construct signatures for classes
 * 	if symbol.Flags&ast.SymbolFlagsClass != 0 {
 * 		classType := c.getDeclaredTypeOfClassOrInterface(symbol)
 * 		constructSignatures := c.getSignaturesOfSymbol(symbol.Members[ast.InternalSymbolNameConstructor])
 * 		if len(constructSignatures) == 0 {
 * 			constructSignatures = c.getDefaultConstructSignatures(classType)
 * 		}
 * 		d.signatures = append(d.signatures, constructSignatures...)
 * 	}
 * }
 */
export declare function Checker_resolveAnonymousTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSymbolTable","kind":"method","status":"implemented","sigHash":"45347b4e074582064485f3615ad1c60f068777de80b5b2990e4a0ba7bd7dffc9","bodyHash":"c3dce63e95bc057491a4a80772517aee51a18fdd5b291e0128b8b1bc94222c46"}
 *
 * Go source:
 * func (c *Checker) instantiateSymbolTable(symbols ast.SymbolTable, m *TypeMapper, mappingThisOnly bool) ast.SymbolTable {
 * 	if len(symbols) == 0 {
 * 		return nil
 * 	}
 * 	result := make(ast.SymbolTable, len(symbols))
 * 	for id, symbol := range symbols {
 * 		if c.isNamedMember(symbol, id) {
 * 			if mappingThisOnly && isThisless(symbol) {
 * 				result[id] = symbol
 * 			} else {
 * 				result[id] = c.instantiateSymbol(symbol, m)
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function Checker_instantiateSymbolTable(receiver: GoPtr<Checker>, symbols: SymbolTable, m: GoPtr<TypeMapper>, mappingThisOnly: bool): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSymbol","kind":"method","status":"implemented","sigHash":"1d1e2e5c09271e693c3e4bb2b86a63c150e473b2655cdb9cdf111b4c5f9fdb65","bodyHash":"bd357dd9569d63a922e22667f9aba2de855eab8e4a548e55148313ff669b23a5"}
 *
 * Go source:
 * func (c *Checker) instantiateSymbol(symbol *ast.Symbol, m *TypeMapper) *ast.Symbol {
 * 	if symbol == nil {
 * 		return nil
 * 	}
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	// If the type of the symbol is already resolved, and if that type could not possibly
 * 	// be affected by instantiation, simply return the symbol itself.
 * 	if links.resolvedType != nil && !c.couldContainTypeVariables(links.resolvedType) {
 * 		if symbol.Flags&ast.SymbolFlagsSetAccessor == 0 {
 * 			return symbol
 * 		}
 * 		// If we're a setter, check writeType.
 * 		if links.writeType != nil && !c.couldContainTypeVariables(links.writeType) {
 * 			return symbol
 * 		}
 * 	}
 * 	if symbol.CheckFlags&ast.CheckFlagsInstantiated != 0 {
 * 		// If symbol being instantiated is itself a instantiation, fetch the original target and combine the
 * 		// type mappers. This ensures that original type identities are properly preserved and that aliases
 * 		// always reference a non-aliases.
 * 		symbol = links.target
 * 		m = c.combineTypeMappers(links.mapper, m)
 * 	}
 * 	// Keep the flags from the symbol we're instantiating.  Mark that is instantiated, and
 * 	// also transient so that we can just store data on it directly.
 * 	result := c.newSymbol(symbol.Flags, symbol.Name)
 * 	result.CheckFlags = ast.CheckFlagsInstantiated | symbol.CheckFlags&(ast.CheckFlagsReadonly|ast.CheckFlagsLate|ast.CheckFlagsOptionalParameter|ast.CheckFlagsRestParameter)
 * 	result.Declarations = symbol.Declarations
 * 	result.Parent = symbol.Parent
 * 	result.ValueDeclaration = symbol.ValueDeclaration
 * 	resultLinks := c.valueSymbolLinks.Get(result)
 * 	resultLinks.target = symbol
 * 	resultLinks.mapper = m
 * 	resultLinks.nameType = links.nameType
 * 	return result
 * }
 */
export declare function Checker_instantiateSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, m: GoPtr<TypeMapper>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveMappedTypeMembers","kind":"method","status":"implemented","sigHash":"7aaf4e0e9bb42c04517a017278b738b6d6ebd78ebe519bf3915960e61e6d516a","bodyHash":"2e45684e4effd16566c797dbeeb34389bb749fe5c1494dbe7148ad0f1bd70ee3"}
 *
 * Go source:
 * func (c *Checker) resolveMappedTypeMembers(t *Type) {
 * 	members := make(ast.SymbolTable)
 * 	var indexInfos []*IndexInfo
 * 	// Resolve upfront such that recursive references see an empty object type.
 * 	c.setStructuredTypeMembers(t, nil, nil, nil, nil)
 * 	// In { [P in K]: T }, we refer to P as the type parameter type, K as the constraint type,
 * 	// and T as the template type.
 * 	typeParameter := c.getTypeParameterFromMappedType(t)
 * 	constraintType := c.getConstraintTypeFromMappedType(t)
 * 	mappedType := core.OrElse(t.AsMappedType().target, t)
 * 	nameType := c.getNameTypeFromMappedType(mappedType)
 * 	shouldLinkPropDeclarations := c.getMappedTypeNameTypeKind(mappedType) != MappedTypeNameTypeKindRemapping
 * 	templateType := c.getTemplateTypeFromMappedType(mappedType)
 * 	modifiersType := c.getApparentType(c.getModifiersTypeFromMappedType(t))
 * 	// The 'T' in 'keyof T'
 * 	templateModifiers := getMappedTypeModifiers(t)
 * 	include := TypeFlagsStringOrNumberLiteralOrUnique
 * 	addMemberForKeyTypeWorker := func(keyType *Type, propNameType *Type) {
 * 		// If the current iteration type constituent is a string literal type, create a property.
 * 		// Otherwise, for type string create a string index signature.
 * 		if isTypeUsableAsPropertyName(propNameType) {
 * 			propName := getPropertyNameFromType(propNameType)
 * 			// String enum members from separate enums with identical values
 * 			// are distinct types with the same property name. Make the resulting
 * 			// property symbol's name type be the union of those enum member types.
 * 			if existingProp := members[propName]; existingProp != nil {
 * 				valueLinks := c.valueSymbolLinks.Get(existingProp)
 * 				valueLinks.nameType = c.getUnionType([]*Type{valueLinks.nameType, propNameType})
 * 				mappedLinks := c.mappedSymbolLinks.Get(existingProp)
 * 				mappedLinks.keyType = c.getUnionType([]*Type{mappedLinks.keyType, keyType})
 * 			} else {
 * 				var modifiersProp *ast.Symbol
 * 				if isTypeUsableAsPropertyName(keyType) {
 * 					modifiersProp = c.getPropertyOfType(modifiersType, getPropertyNameFromType(keyType))
 * 				}
 * 				isOptional := templateModifiers&MappedTypeModifiersIncludeOptional != 0 || templateModifiers&MappedTypeModifiersExcludeOptional == 0 && modifiersProp != nil && modifiersProp.Flags&ast.SymbolFlagsOptional != 0
 * 				isReadonly := templateModifiers&MappedTypeModifiersIncludeReadonly != 0 || templateModifiers&MappedTypeModifiersExcludeReadonly == 0 && modifiersProp != nil && c.isReadonlySymbol(modifiersProp)
 * 				stripOptional := c.strictNullChecks && !isOptional && modifiersProp != nil && modifiersProp.Flags&ast.SymbolFlagsOptional != 0
 * 				var lateFlag ast.CheckFlags
 * 				if modifiersProp != nil {
 * 					lateFlag = modifiersProp.CheckFlags & ast.CheckFlagsLate
 * 				}
 * 				prop := c.newSymbol(ast.SymbolFlagsProperty|core.IfElse(isOptional, ast.SymbolFlagsOptional, 0), propName)
 * 				prop.CheckFlags = lateFlag | ast.CheckFlagsMapped | core.IfElse(isReadonly, ast.CheckFlagsReadonly, 0) | core.IfElse(stripOptional, ast.CheckFlagsStripOptional, 0)
 * 				valueLinks := c.valueSymbolLinks.Get(prop)
 * 				valueLinks.containingType = t
 * 				valueLinks.nameType = propNameType
 * 				mappedLinks := c.mappedSymbolLinks.Get(prop)
 * 				mappedLinks.keyType = keyType
 * 				if modifiersProp != nil {
 * 					mappedLinks.syntheticOrigin = modifiersProp
 * 					if shouldLinkPropDeclarations {
 * 						prop.Declarations = modifiersProp.Declarations
 * 					}
 * 				}
 * 				members[propName] = prop
 * 			}
 * 		} else if c.isValidIndexKeyType(propNameType) || propNameType.flags&(TypeFlagsAny|TypeFlagsEnum) != 0 {
 * 			indexKeyType := propNameType
 * 			switch {
 * 			case propNameType.flags&(TypeFlagsAny|TypeFlagsString) != 0:
 * 				indexKeyType = c.stringType
 * 			case propNameType.flags&(TypeFlagsNumber|TypeFlagsEnum) != 0:
 * 				indexKeyType = c.numberType
 * 			}
 * 			propType := c.instantiateType(templateType, appendTypeMapping(t.AsMappedType().mapper, typeParameter, keyType))
 * 			modifiersIndexInfo := c.getApplicableIndexInfo(modifiersType, propNameType)
 * 			isReadonly := templateModifiers&MappedTypeModifiersIncludeReadonly != 0 || templateModifiers&MappedTypeModifiersExcludeReadonly == 0 && modifiersIndexInfo != nil && modifiersIndexInfo.isReadonly
 * 			indexInfo := c.newIndexInfo(indexKeyType, propType, isReadonly, nil, nil)
 * 			indexInfos = c.appendIndexInfo(indexInfos, indexInfo, true /*union* /)
 * 		}
 * 	}
 * 	addMemberForKeyType := func(keyType *Type) {
 * 		propNameType := keyType
 * 		if nameType != nil {
 * 			propNameType = c.instantiateType(nameType, appendTypeMapping(t.AsMappedType().mapper, typeParameter, keyType))
 * 		}
 * 		forEachType(propNameType, func(t *Type) {
 * 			addMemberForKeyTypeWorker(keyType, t)
 * 		})
 * 	}
 * 	if c.isMappedTypeWithKeyofConstraintDeclaration(t) {
 * 		// We have a { [P in keyof T]: X }
 * 		c.forEachMappedTypePropertyKeyTypeAndIndexSignatureKeyType(modifiersType, include, false /*stringsOnly* /, addMemberForKeyType)
 * 	} else {
 * 		forEachType(c.getLowerBoundOfKeyType(constraintType), addMemberForKeyType)
 * 	}
 * 	c.setStructuredTypeMembers(t, members, nil, nil, indexInfos)
 * }
 */
export declare function Checker_resolveMappedTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfMappedSymbol","kind":"method","status":"implemented","sigHash":"179c1f2caaa95db203e34dc1e89a261bbb7f3a32917f1fb6166dd22adb751a3f","bodyHash":"2c13d97c1e47cec4d36a78888c41ef3df4c6d1ca2be4697fec39ffa2de82a5fc"}
 *
 * Go source:
 * func (c *Checker) getTypeOfMappedSymbol(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		mappedType := links.containingType
 * 		if !c.pushTypeResolution(symbol, TypeSystemPropertyNameType) {
 * 			mappedType.AsMappedType().containsError = true
 * 			return c.errorType
 * 		}
 * 		templateType := c.getTemplateTypeFromMappedType(core.OrElse(mappedType.AsMappedType().target, mappedType))
 * 		mapper := appendTypeMapping(mappedType.AsMappedType().mapper, c.getTypeParameterFromMappedType(mappedType), c.mappedSymbolLinks.Get(symbol).keyType)
 * 		propType := c.instantiateType(templateType, mapper)
 * 		// When creating an optional property in strictNullChecks mode, if 'undefined' isn't assignable to the
 * 		// type, we include 'undefined' in the type. Similarly, when creating a non-optional property in strictNullChecks
 * 		// mode, if the underlying property is optional we remove 'undefined' from the type.
 * 		switch {
 * 		case c.strictNullChecks && symbol.Flags&ast.SymbolFlagsOptional != 0 && !c.maybeTypeOfKind(propType, TypeFlagsUndefined|TypeFlagsVoid):
 * 			propType = c.getOptionalType(propType, true /*isProperty* /)
 * 		case symbol.CheckFlags&ast.CheckFlagsStripOptional != 0:
 * 			propType = c.removeMissingOrUndefinedType(propType)
 * 		}
 * 		if c.popTypeResolution() {
 * 			if links.resolvedType == nil {
 * 				links.resolvedType = propType
 * 			}
 * 		} else {
 * 			if links.resolvedType == nil {
 * 				links.resolvedType = c.errorType
 * 			}
 * 			c.error(c.currentNode, diagnostics.Type_of_property_0_circularly_references_itself_in_mapped_type_1, c.symbolToString(symbol), c.TypeToString(mappedType))
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfMappedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveUnionTypeMembers","kind":"method","status":"implemented","sigHash":"ad012da8f222e973f34eebb8285bb92cc1d10c7d19a72f2bac396e9d75af1843","bodyHash":"2f2e796c975f2bad3af4212dae1c91b8f86655d3cf41b2b2d1eb24a1f56b4ab9"}
 *
 * Go source:
 * func (c *Checker) resolveUnionTypeMembers(t *Type) {
 * 	// The members and properties collections are empty for union types. To get all properties of a union
 * 	// type use getPropertiesOfType (only the language service uses this).
 * 	callSignatures := c.getUnionSignatures(core.Map(t.Types(), func(t *Type) []*Signature {
 * 		if t == c.globalFunctionType {
 * 			return []*Signature{c.unknownSignature}
 * 		}
 * 		return c.getSignaturesOfType(t, SignatureKindCall)
 * 	}))
 * 	if len(callSignatures) == 0 {
 * 		callSignatures = c.getArrayMemberCallSignatures(t)
 * 	}
 * 	constructSignatures := c.getUnionSignatures(core.Map(t.Types(), func(t *Type) []*Signature {
 * 		return c.getSignaturesOfType(t, SignatureKindConstruct)
 * 	}))
 * 	indexInfos := c.getUnionIndexInfos(t.Types())
 * 	c.setStructuredTypeMembers(t, nil, callSignatures, constructSignatures, indexInfos)
 * }
 */
export declare function Checker_resolveUnionTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isArrayOrTupleSymbol","kind":"method","status":"implemented","sigHash":"353a3f61e9009b199c92a2440259ff97c2639211fdaeb15d30a2e576c229829f","bodyHash":"5a72446e7621963650ae95ac09c6387c177be8b0d1b3bec834ee5d87d3970202"}
 *
 * Go source:
 * func (c *Checker) isArrayOrTupleSymbol(symbol *ast.Symbol) bool {
 * 	if symbol == nil || c.globalArrayType.symbol == nil || c.globalReadonlyArrayType.symbol == nil {
 * 		return false
 * 	}
 * 	return c.getSymbolIfSameReference(symbol, c.globalArrayType.symbol) != nil || c.getSymbolIfSameReference(symbol, c.globalReadonlyArrayType.symbol) != nil
 * }
 */
export declare function Checker_isArrayOrTupleSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isReadonlyArraySymbol","kind":"method","status":"implemented","sigHash":"5b8e809c0b4bf63572a35b0c26b775dba9c9c0611d7d0a202101524037d3fe3e","bodyHash":"5dd8393f1d37bcee59129c5ae0b506ae175be2d7fe816f7eaeff4b4f86600f2d"}
 *
 * Go source:
 * func (c *Checker) isReadonlyArraySymbol(symbol *ast.Symbol) bool {
 * 	if symbol == nil || c.globalReadonlyArrayType.symbol == nil {
 * 		return false
 * 	}
 * 	return c.getSymbolIfSameReference(symbol, c.globalReadonlyArrayType.symbol) != nil
 * }
 */
export declare function Checker_isReadonlyArraySymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveIntersectionTypeMembers","kind":"method","status":"implemented","sigHash":"b426068ee0c989e59c0e455483e8357a76080a456d6bcef221cb4170028c0b2b","bodyHash":"b8526ef58824f570a1399081cda9a22800d02bf6a54ab5be5ca10c3c37cb73f3"}
 *
 * Go source:
 * func (c *Checker) resolveIntersectionTypeMembers(t *Type) {
 * 	// The members and properties collections are empty for intersection types. To get all properties of an
 * 	// intersection type use getPropertiesOfType (only the language service uses this).
 * 	var callSignatures []*Signature
 * 	var constructSignatures []*Signature
 * 	var indexInfos []*IndexInfo
 * 	types := t.Types()
 * 	mixinFlags, mixinCount := c.findMixins(types)
 * 	for i, t := range types {
 * 		// When an intersection type contains mixin constructor types, the construct signatures from
 * 		// those types are discarded and their return types are mixed into the return types of all
 * 		// other construct signatures in the intersection type. For example, the intersection type
 * 		// '{ new(...args: any[]) => A } & { new(s: string) => B }' has a single construct signature
 * 		// 'new(s: string) => A & B'.
 * 		if !mixinFlags[i] {
 * 			signatures := c.getSignaturesOfType(t, SignatureKindConstruct)
 * 			if len(signatures) != 0 && mixinCount > 0 {
 * 				signatures = core.Map(signatures, func(s *Signature) *Signature {
 * 					clone := c.cloneSignature(s)
 * 					clone.resolvedReturnType = c.includeMixinType(c.getReturnTypeOfSignature(s), types, mixinFlags, i)
 * 					return clone
 * 				})
 * 			}
 * 			constructSignatures = c.appendSignatures(constructSignatures, signatures)
 * 		}
 * 		callSignatures = c.appendSignatures(callSignatures, c.getSignaturesOfType(t, SignatureKindCall))
 * 		for _, info := range c.getIndexInfosOfType(t) {
 * 			indexInfos = c.appendIndexInfo(indexInfos, info, false /*union* /)
 * 		}
 * 	}
 * 	c.setStructuredTypeMembers(t, nil, callSignatures, constructSignatures, indexInfos)
 * }
 */
export declare function Checker_resolveIntersectionTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.appendIndexInfo","kind":"method","status":"implemented","sigHash":"681f9936750b5e207d8d6940c3b3f99b8564a67587f004e69c31d479e6378368","bodyHash":"0fc77d856010a5c3c22ca560e43e66b9fc0f80421db13bd30c17d56a39f99d04"}
 *
 * Go source:
 * func (c *Checker) appendIndexInfo(indexInfos []*IndexInfo, newInfo *IndexInfo, union bool) []*IndexInfo {
 * 	for i, info := range indexInfos {
 * 		if info.keyType == newInfo.keyType {
 * 			var valueType *Type
 * 			var isReadonly bool
 * 			if union {
 * 				valueType = c.getUnionType([]*Type{info.valueType, newInfo.valueType})
 * 				isReadonly = info.isReadonly || newInfo.isReadonly
 * 			} else {
 * 				valueType = c.getIntersectionType([]*Type{info.valueType, newInfo.valueType})
 * 				isReadonly = info.isReadonly && newInfo.isReadonly
 * 			}
 * 			indexInfos[i] = c.newIndexInfo(info.keyType, valueType, isReadonly, nil, nil)
 * 			return indexInfos
 * 		}
 * 	}
 * 	return append(indexInfos, newInfo)
 * }
 */
export declare function Checker_appendIndexInfo(receiver: GoPtr<Checker>, indexInfos: GoSlice<GoPtr<IndexInfo>>, newInfo: GoPtr<IndexInfo>, union: bool): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyOfObjectType","kind":"method","status":"implemented","sigHash":"498b6276e4546fbd7aab2cbd9f05642eb3795596fdfc2642087cd79dd6553db5","bodyHash":"2498b8b5f77a61c9f645070078b3e4371868856d051825108c7f4673b2d22d10"}
 *
 * Go source:
 * func (c *Checker) getPropertyOfObjectType(t *Type, name string) *ast.Symbol {
 * 	if t.flags&TypeFlagsObject != 0 {
 * 		resolved := c.resolveStructuredTypeMembers(t)
 * 		symbol := resolved.members[name]
 * 		if symbol != nil && c.symbolIsValue(symbol) {
 * 			return symbol
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getPropertyOfObjectType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyOfUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"772b7d78718630346f2e6dfa1a9cfb9878d74ef6017e00d52d7fca211e206b5e","bodyHash":"d4eb90db5c85a71ecdc85ae7c969adcdaff7898479cf8ce86447c2f9d422a738"}
 *
 * Go source:
 * func (c *Checker) getPropertyOfUnionOrIntersectionType(t *Type, name string, skipObjectFunctionPropertyAugment bool) *ast.Symbol {
 * 	prop := c.getUnionOrIntersectionProperty(t, name, skipObjectFunctionPropertyAugment)
 * 	// We need to filter out partial properties in union types
 * 	if prop != nil && prop.CheckFlags&ast.CheckFlagsReadPartial != 0 {
 * 		return nil
 * 	}
 * 	return prop
 * }
 */
export declare function Checker_getPropertyOfUnionOrIntersectionType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, skipObjectFunctionPropertyAugment: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUnionOrIntersectionProperty","kind":"method","status":"implemented","sigHash":"d1035ea62d762b079fae5d4da2ae0a9101fe4bed155cee689bd6088be74474ef","bodyHash":"f71a9ed030349aa302fffbe998cc681e540660d67866783b1aed807a8e38ed1d"}
 *
 * Go source:
 * func (c *Checker) getUnionOrIntersectionProperty(t *Type, name string, skipObjectFunctionPropertyAugment bool) *ast.Symbol {
 * 	var cache ast.SymbolTable
 * 	if skipObjectFunctionPropertyAugment {
 * 		cache = ast.GetSymbolTable(&t.AsUnionOrIntersectionType().propertyCacheWithoutFunctionPropertyAugment)
 * 	} else {
 * 		cache = ast.GetSymbolTable(&t.AsUnionOrIntersectionType().propertyCache)
 * 	}
 * 	if prop := cache[name]; prop != nil {
 * 		return prop
 * 	}
 * 	prop := c.createUnionOrIntersectionProperty(t, name, skipObjectFunctionPropertyAugment)
 * 	if prop != nil {
 * 		cache[name] = prop
 * 		// Propagate an entry from the non-augmented cache to the augmented cache unless the property is partial.
 * 		if skipObjectFunctionPropertyAugment && prop.CheckFlags&ast.CheckFlagsPartial == 0 {
 * 			augmentedCache := ast.GetSymbolTable(&t.AsUnionOrIntersectionType().propertyCache)
 * 			if augmentedCache[name] == nil {
 * 				augmentedCache[name] = prop
 * 			}
 * 		}
 * 	}
 * 	return prop
 * }
 */
export declare function Checker_getUnionOrIntersectionProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, skipObjectFunctionPropertyAugment: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createUnionOrIntersectionProperty","kind":"method","status":"implemented","sigHash":"617241f4a69f9649f2530671ca24c1ad1fad907f0646df4b30c3dc761550b0bb","bodyHash":"c0f21d29ac79cfb8be263542f32b9d7fe2357df61944f397c37e8ad3f320849a"}
 *
 * Go source:
 * func (c *Checker) createUnionOrIntersectionProperty(containingType *Type, name string, skipObjectFunctionPropertyAugment bool) *ast.Symbol {
 * 	propFlags := ast.SymbolFlagsNone
 * 	var singleProp *ast.Symbol
 * 	var propSet collections.OrderedSet[*ast.Symbol]
 * 	var indexTypes []*Type
 * 	isUnion := containingType.flags&TypeFlagsUnion != 0
 * 	// Flags we want to propagate to the result if they exist in all source symbols
 * 	var checkFlags ast.CheckFlags
 * 	var optionalFlag ast.SymbolFlags
 * 	if !isUnion {
 * 		checkFlags = ast.CheckFlagsReadonly
 * 		optionalFlag = ast.SymbolFlagsOptional
 * 	}
 * 	syntheticFlag := ast.CheckFlagsSyntheticMethod
 * 	mergedInstantiations := false
 * 	for _, current := range containingType.Types() {
 * 		t := c.getApparentType(current)
 * 		if !c.isErrorType(t) && t.flags&TypeFlagsNever == 0 {
 * 			prop := c.getPropertyOfTypeEx(t, name, skipObjectFunctionPropertyAugment, false)
 * 			var modifiers ast.ModifierFlags
 * 			if prop != nil {
 * 				modifiers = getDeclarationModifierFlagsFromSymbol(prop)
 * 				if prop.Flags&ast.SymbolFlagsClassMember != 0 {
 * 					if isUnion {
 * 						optionalFlag |= prop.Flags & ast.SymbolFlagsOptional
 * 					} else {
 * 						optionalFlag &= prop.Flags
 * 					}
 * 				}
 * 				if singleProp == nil {
 * 					singleProp = prop
 * 					propFlags = core.OrElse(prop.Flags&ast.SymbolFlagsAccessor, ast.SymbolFlagsProperty)
 * 				} else if prop != singleProp {
 * 					isInstantiation := c.getTargetSymbol(prop) == c.getTargetSymbol(singleProp)
 * 					// If the symbols are instances of one another with identical types - consider the symbols
 * 					// equivalent and just use the first one, which thus allows us to avoid eliding private
 * 					// members when intersecting a (this-)instantiations of a class with its raw base or another instance
 * 					if isInstantiation && c.compareProperties(singleProp, prop, compareTypesEqual) == TernaryTrue {
 * 						// If we merged instantiations of a generic type, we replicate the symbol parent resetting behavior we used
 * 						// to do when we recorded multiple distinct symbols so that we still get, eg, `Array<T>.length` printed
 * 						// back and not `Array<string>.length` when we're looking at a `.length` access on a `string[] | number[]`
 * 						mergedInstantiations = singleProp.Parent != nil && len(c.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(singleProp.Parent)) != 0
 * 					} else {
 * 						if propSet.Size() == 0 {
 * 							propSet.Add(singleProp)
 * 						}
 * 						propSet.Add(prop)
 * 					}
 * 					// classes created by mixins are represented as intersections
 * 					// and overriding a property in a derived class redefines it completely at runtime
 * 					// so a get accessor can't be merged with a set accessor in a base class,
 * 					// for that reason the accessor flags are only used when they are the same in all constituents
 * 					if propFlags&ast.SymbolFlagsAccessor != 0 && (prop.Flags&ast.SymbolFlagsAccessor != (propFlags & ast.SymbolFlagsAccessor)) {
 * 						propFlags = (propFlags &^ ast.SymbolFlagsAccessor) | ast.SymbolFlagsProperty
 * 					}
 * 				}
 * 				if isUnion && c.isReadonlySymbol(prop) {
 * 					checkFlags |= ast.CheckFlagsReadonly
 * 				} else if !isUnion && !c.isReadonlySymbol(prop) {
 * 					checkFlags &^= ast.CheckFlagsReadonly
 * 				}
 * 				if modifiers&ast.ModifierFlagsNonPublicAccessibilityModifier == 0 {
 * 					checkFlags |= ast.CheckFlagsContainsPublic
 * 				}
 * 				if modifiers&ast.ModifierFlagsProtected != 0 {
 * 					checkFlags |= ast.CheckFlagsContainsProtected
 * 				}
 * 				if modifiers&ast.ModifierFlagsPrivate != 0 {
 * 					checkFlags |= ast.CheckFlagsContainsPrivate
 * 				}
 * 				if modifiers&ast.ModifierFlagsStatic != 0 {
 * 					checkFlags |= ast.CheckFlagsContainsStatic
 * 				}
 * 				if !isPrototypeProperty(prop) {
 * 					syntheticFlag = ast.CheckFlagsSyntheticProperty
 * 				}
 * 			} else if isUnion {
 * 				var indexInfo *IndexInfo
 * 				if !isLateBoundName(name) {
 * 					indexInfo = c.getApplicableIndexInfoForName(t, name)
 * 				}
 * 				if indexInfo != nil {
 * 					propFlags = propFlags&^ast.SymbolFlagsAccessor | ast.SymbolFlagsProperty
 * 					checkFlags |= ast.CheckFlagsWritePartial | core.IfElse(indexInfo.isReadonly, ast.CheckFlagsReadonly, 0)
 * 					if isTupleType(t) {
 * 						indexType := c.getRestTypeOfTupleType(t)
 * 						if indexType == nil {
 * 							indexType = c.undefinedType
 * 						}
 * 						indexTypes = append(indexTypes, indexType)
 * 					} else {
 * 						indexTypes = append(indexTypes, indexInfo.valueType)
 * 					}
 * 				} else if isObjectLiteralType(t) && t.objectFlags&ObjectFlagsContainsSpread == 0 {
 * 					checkFlags |= ast.CheckFlagsWritePartial
 * 					indexTypes = append(indexTypes, c.undefinedType)
 * 				} else {
 * 					checkFlags |= ast.CheckFlagsReadPartial
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if singleProp == nil || isUnion &&
 * 		(propSet.Size() != 0 || checkFlags&ast.CheckFlagsPartial != 0) &&
 * 		checkFlags&(ast.CheckFlagsContainsPrivate|ast.CheckFlagsContainsProtected) != 0 &&
 * 		!(propSet.Size() != 0 && c.hasCommonDeclaration(&propSet)) {
 * 		// No property was found, or, in a union, a property has a private or protected declaration in one
 * 		// constituent, but is missing or has a different declaration in another constituent.
 * 		return nil
 * 	}
 * 	if propSet.Size() == 0 && checkFlags&ast.CheckFlagsReadPartial == 0 && len(indexTypes) == 0 {
 * 		if !mergedInstantiations {
 * 			return singleProp
 * 		}
 * 		// No symbol from a union/intersection should have a `.parent` set (since unions/intersections don't act as symbol parents)
 * 		// Unless that parent is "reconstituted" from the "first value declaration" on the symbol (which is likely different than its instantiated parent!)
 * 		// They also have a `.containingType` set, which affects some services endpoints behavior, like `getRootSymbol`
 * 		var singlePropType *Type
 * 		var singlePropMapper *TypeMapper
 * 		if singleProp.Flags&ast.SymbolFlagsTransient != 0 {
 * 			links := c.valueSymbolLinks.Get(singleProp)
 * 			singlePropType = links.resolvedType
 * 			singlePropMapper = links.mapper
 * 		}
 * 		clone := c.createSymbolWithType(singleProp, singlePropType)
 * 		if singleProp.ValueDeclaration != nil {
 * 			clone.Parent = singleProp.ValueDeclaration.Symbol().Parent
 * 		}
 * 		links := c.valueSymbolLinks.Get(clone)
 * 		links.containingType = containingType
 * 		links.mapper = singlePropMapper
 * 		links.writeType = c.getWriteTypeOfSymbol(singleProp)
 * 		return clone
 * 	}
 * 	if propSet.Size() == 0 {
 * 		propSet.Add(singleProp)
 * 	}
 * 	var declarations []*ast.Node
 * 	var firstType *Type
 * 	var nameType *Type
 * 	var propTypes []*Type
 * 	var writeTypes []*Type
 * 	var firstValueDeclaration *ast.Node
 * 	var hasNonUniformValueDeclaration bool
 * 	for prop := range propSet.Values() {
 * 		if firstValueDeclaration == nil {
 * 			firstValueDeclaration = prop.ValueDeclaration
 * 		} else if prop.ValueDeclaration != nil && prop.ValueDeclaration != firstValueDeclaration {
 * 			hasNonUniformValueDeclaration = true
 * 		}
 * 		declarations = append(declarations, prop.Declarations...)
 * 		t := c.getTypeOfSymbol(prop)
 * 		if firstType == nil {
 * 			firstType = t
 * 			nameType = c.valueSymbolLinks.Get(prop).nameType
 * 		}
 * 		writeType := c.getWriteTypeOfSymbol(prop)
 * 		if writeTypes != nil || writeType != t {
 * 			if writeTypes == nil {
 * 				writeTypes = slices.Clone(propTypes)
 * 			}
 * 			writeTypes = append(writeTypes, writeType)
 * 		}
 * 		if t != firstType {
 * 			checkFlags |= ast.CheckFlagsHasNonUniformType
 * 		}
 * 		if isLiteralType(t) || c.isPatternLiteralType(t) {
 * 			checkFlags |= ast.CheckFlagsHasLiteralType
 * 		}
 * 		if t.flags&TypeFlagsNever != 0 && t != c.uniqueLiteralType {
 * 			checkFlags |= ast.CheckFlagsHasNeverType
 * 		}
 * 		propTypes = append(propTypes, t)
 * 	}
 * 	propTypes = append(propTypes, indexTypes...)
 * 	result := c.newSymbolEx(propFlags|optionalFlag, name, checkFlags|syntheticFlag)
 * 	result.Declarations = declarations
 * 	if !hasNonUniformValueDeclaration && firstValueDeclaration != nil {
 * 		result.ValueDeclaration = firstValueDeclaration
 * 		// Inherit information about parent type.
 * 		result.Parent = firstValueDeclaration.Symbol().Parent
 * 	}
 * 	links := c.valueSymbolLinks.Get(result)
 * 	links.containingType = containingType
 * 	links.nameType = nameType
 * 	if len(propTypes) > 2 {
 * 		// When `propTypes` has the potential to explode in size when normalized, defer normalization until absolutely needed
 * 		result.CheckFlags |= ast.CheckFlagsDeferredType
 * 		deferred := c.deferredSymbolLinks.Get(result)
 * 		deferred.parent = containingType
 * 		deferred.constituents = propTypes
 * 		deferred.writeConstituents = writeTypes
 * 		return result
 * 	}
 * 	if isUnion {
 * 		links.resolvedType = c.getUnionType(propTypes)
 * 	} else {
 * 		links.resolvedType = c.getIntersectionType(propTypes)
 * 	}
 * 	if writeTypes != nil {
 * 		if isUnion {
 * 			links.writeType = c.getUnionType(writeTypes)
 * 		} else {
 * 			links.writeType = c.getIntersectionType(writeTypes)
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function Checker_createUnionOrIntersectionProperty(receiver: GoPtr<Checker>, containingType: GoPtr<Type>, name: string, skipObjectFunctionPropertyAugment: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetSymbol","kind":"method","status":"implemented","sigHash":"2a2332b13bc7b8e0d97407989f5f7ec23c369279e3c531307099385b495bccb2","bodyHash":"65a93fbd840500d6b9ce152f46bbb9df570ec7cadcab637cfa527a55c51fab2b"}
 *
 * Go source:
 * func (c *Checker) getTargetSymbol(s *ast.Symbol) *ast.Symbol {
 * 	// if symbol is instantiated its flags are not copied from the 'target'
 * 	// so we'll need to get back original 'target' symbol to work with correct set of flags
 * 	// NOTE: cast to TransientSymbol should be safe because only TransientSymbols have CheckFlags.Instantiated
 * 	if s != nil && s.CheckFlags&ast.CheckFlagsInstantiated != 0 {
 * 		return c.valueSymbolLinks.Get(s).target
 * 	}
 * 	return s
 * }
 */
export declare function Checker_getTargetSymbol(receiver: GoPtr<Checker>, s: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasCommonDeclaration","kind":"method","status":"implemented","sigHash":"ca2baead8e0a6caaab07fa43289c537465e6c3b147c9fd384c640a0c19015710","bodyHash":"869c2ea05eb2c1d194e1ff25739ff8923dcf916e2c3d7dcb81f963d45e38178c"}
 *
 * Go source:
 * func (c *Checker) hasCommonDeclaration(symbols *collections.OrderedSet[*ast.Symbol]) bool {
 * 	var commonDeclarations collections.Set[*ast.Node]
 * 	for symbol := range symbols.Values() {
 * 		if len(symbol.Declarations) == 0 {
 * 			return false
 * 		}
 * 		if commonDeclarations.Len() == 0 {
 * 			for _, d := range symbol.Declarations {
 * 				commonDeclarations.Add(d)
 * 			}
 * 			continue
 * 		}
 * 		for d := range commonDeclarations.Keys() {
 * 			if !slices.Contains(symbol.Declarations, d) {
 * 				commonDeclarations.Delete(d)
 * 			}
 * 		}
 * 		if commonDeclarations.Len() == 0 {
 * 			return false
 * 		}
 * 	}
 * 	return commonDeclarations.Len() != 0
 * }
 */
export declare function Checker_hasCommonDeclaration(receiver: GoPtr<Checker>, symbols: GoPtr<OrderedSet<GoPtr<Symbol>>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createSymbolWithType","kind":"method","status":"implemented","sigHash":"fc0993817049f095ccb81189f3f44b2d282c7c1437df314803918ec11fec2b3e","bodyHash":"546ac849ca63e37f106d38b5231feb97041829f9e9a839ebdde935609cecab24"}
 *
 * Go source:
 * func (c *Checker) createSymbolWithType(source *ast.Symbol, t *Type) *ast.Symbol {
 * 	symbol := c.newSymbolEx(source.Flags, source.Name, source.CheckFlags&ast.CheckFlagsReadonly)
 * 	symbol.Declarations = source.Declarations
 * 	symbol.Parent = source.Parent
 * 	symbol.ValueDeclaration = source.ValueDeclaration
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	links.resolvedType = t
 * 	links.target = source
 * 	links.nameType = c.valueSymbolLinks.Get(source).nameType
 * 	return symbol
 * }
 */
export declare function Checker_createSymbolWithType(receiver: GoPtr<Checker>, source: GoPtr<Symbol>, t: GoPtr<Type>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isMappedTypeGenericIndexedAccess","kind":"method","status":"implemented","sigHash":"040e5ef88630ee034d4e8ab7588cfeb59f7c1000426303964100bf5b0e4c57e7","bodyHash":"6808f2205be6fb0f6ef4458ce110723b5cf00aacb7b66b5266dc6c8b0b16f3e1"}
 *
 * Go source:
 * func (c *Checker) isMappedTypeGenericIndexedAccess(t *Type) bool {
 * 	if t.flags&TypeFlagsIndexedAccess != 0 {
 * 		objectType := t.AsIndexedAccessType().objectType
 * 		return objectType.objectFlags&ObjectFlagsMapped != 0 && !c.isGenericMappedType(objectType) && c.isGenericIndexType(t.AsIndexedAccessType().indexType) &&
 * 			getMappedTypeModifiers(objectType)&MappedTypeModifiersExcludeOptional == 0 && objectType.AsMappedType().declaration.NameType == nil
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isMappedTypeGenericIndexedAccess(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNeverReducedProperty","kind":"method","status":"implemented","sigHash":"c926d7ba5dbacf6f5347e5ecbd492dd600b63fb6f327460010c8a36af983b515","bodyHash":"57d68669909e115b3b27674e5c7cb8c2b9b7000ba700dc4668d0af277effd8e4"}
 *
 * Go source:
 * func (c *Checker) isNeverReducedProperty(prop *ast.Symbol) bool {
 * 	return c.isDiscriminantWithNeverType(prop) || isConflictingPrivateProperty(prop)
 * }
 */
export declare function Checker_isNeverReducedProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNamedMembers","kind":"method","status":"implemented","sigHash":"2ad3737d46034069f7042ebed5019cfb6ed81a788f4a11a3fedf24085c39a45b","bodyHash":"6797aad38b2c087d91d9034e26d6ae5b93da23c16b17dc353fea741ca753d596"}
 *
 * Go source:
 * func (c *Checker) getNamedMembers(members ast.SymbolTable, container *ast.Symbol) []*ast.Symbol {
 * 	if len(members) == 0 {
 * 		return nil
 * 	}
 * 	// For classes and interfaces, we store explicitly declared members ahead of inherited members. This ensures we process
 * 	// explicitly declared members first in type relations, which is beneficial because explicitly declared members are more
 * 	// likely to contain discriminating differences. See for example https://github.com/microsoft/typescript-go/issues/1968.
 * 	result := make([]*ast.Symbol, 0, len(members))
 * 	var containedCount int
 * 	if container != nil && container.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsInterface) != 0 {
 * 		for id, symbol := range members {
 * 			if c.isNamedMember(symbol, id) && c.isDeclarationContainedBy(symbol, container) {
 * 				result = append(result, symbol)
 * 			}
 * 		}
 * 		containedCount = len(result)
 * 	}
 * 	for id, symbol := range members {
 * 		if c.isNamedMember(symbol, id) && (container == nil || container.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsInterface) == 0 || !c.isDeclarationContainedBy(symbol, container)) {
 * 			result = append(result, symbol)
 * 		}
 * 	}
 * 	c.sortSymbols(result[:containedCount])
 * 	c.sortSymbols(result[containedCount:])
 * 	return result
 * }
 */
export declare function Checker_getNamedMembers(receiver: GoPtr<Checker>, members: SymbolTable, container: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isDeclarationContainedBy","kind":"method","status":"implemented","sigHash":"4f8b99d9d37849c589da841472639683ff0454ecb8d94cb907a0a96d88dc4ba3","bodyHash":"d1dc70c7573a1fde8f4761bc1935a81bce496ecb9c28c445ad8c7544b36b768e"}
 *
 * Go source:
 * func (c *Checker) isDeclarationContainedBy(symbol *ast.Symbol, container *ast.Symbol) bool {
 * 	if declaration := symbol.ValueDeclaration; declaration != nil {
 * 		for _, d := range container.Declarations {
 * 			if declaration.Loc.ContainedBy(d.Loc) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isDeclarationContainedBy(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, container: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNamedMember","kind":"method","status":"implemented","sigHash":"b5abf82bd24f647615bc1578965150d45820f14785f6d27af2b8b796d90a65ef","bodyHash":"93bf7e1fcbc4d7562ce112812f86b9d1eb4aae48040131c089061b81aa0d9891"}
 *
 * Go source:
 * func (c *Checker) isNamedMember(symbol *ast.Symbol, id string) bool {
 * 	return !isReservedMemberName(id) && c.symbolIsValue(symbol)
 * }
 */
export declare function Checker_isNamedMember(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, id: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateTypeWithAlias","kind":"method","status":"implemented","sigHash":"03de27e27a37380d5e378575dd89c7c31f0a1db41bdf3d4749703d9b7607f1ee","bodyHash":"e8004c6149bff2519a8014c28bef372f47b6c1b328ba70a150f121383073f0fa"}
 *
 * Go source:
 * func (c *Checker) instantiateTypeWithAlias(t *Type, m *TypeMapper, alias *TypeAlias) *Type {
 * 	// Check for type variables in the alias, so things like `type Brand<T> = number & {}` can potentially be copied with new alias type args, despite them being unreferenced.
 * 	// This is the behavior most people using aliases expect, and prevents the cache from leaking type parameters outside their scope of validity.
 * 	// tests/cases/compiler/declarationEmitArrowFunctionNoRenaming.ts contains an example of this, which previously only worked in strada via some input node reuse logic instead.
 * 	if t == nil || m == nil || !(c.couldContainTypeVariables(t) || (t.alias != nil && len(t.alias.typeArguments) > 0 && core.Some(t.alias.typeArguments, c.couldContainTypeVariables))) {
 * 		return t
 * 	}
 * 	if c.instantiationDepth == 100 || c.instantiationCount >= 5_000_000 {
 * 		// We have reached 100 recursive type instantiations, or 5M type instantiations caused by the same statement
 * 		// or expression. There is a very high likelihood we're dealing with a combination of infinite generic types
 * 		// that perpetually generate new type identities, so we stop the recursion here by yielding the error type.
 * 		if tr := c.tracer; tr != nil {
 * 			tr.Instant(tracing.PhaseCheckTypes, "instantiateType_DepthLimit", map[string]any{"typeId": t.id, "instantiationDepth": c.instantiationDepth, "instantiationCount": c.instantiationCount})
 * 		}
 * 		c.error(c.currentNode, diagnostics.Type_instantiation_is_excessively_deep_and_possibly_infinite)
 * 		return c.errorType
 * 	}
 * 	index := c.findActiveMapper(m)
 * 	if index == -1 {
 * 		c.pushActiveMapper(m)
 * 	}
 * 	var b keyBuilder
 * 	b.writeType(t)
 * 	b.writeAlias(alias)
 * 	key := b.hash()
 * 	cache := c.activeTypeMappersCaches[core.IfElse(index != -1, index, len(c.activeTypeMappersCaches)-1)]
 * 	if cachedType, ok := cache[key]; ok {
 * 		return cachedType
 * 	}
 * 	c.TotalInstantiationCount++
 * 	c.instantiationCount++
 * 	c.instantiationDepth++
 * 	result := c.instantiateTypeWorker(t, m, alias)
 * 	if index == -1 {
 * 		c.popActiveMapper()
 * 	} else {
 * 		cache[key] = result
 * 	}
 * 	c.instantiationDepth--
 * 	return result
 * }
 */
export declare function Checker_instantiateTypeWithAlias(receiver: GoPtr<Checker>, t: GoPtr<Type>, m: GoPtr<TypeMapper>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNameTypeFromMappedType","kind":"method","status":"implemented","sigHash":"a4ed7a8b79ace07f0c6c2431b9b9f839191b6aecc586cec199e2a98a43fa79ba","bodyHash":"ac3aef27321eaf6f815ca14850aeaee8cf8d3757d6c487bf3fdc3a685af9a603"}
 *
 * Go source:
 * func (c *Checker) getNameTypeFromMappedType(t *Type) *Type {
 * 	m := t.AsMappedType()
 * 	if m.declaration.NameType == nil {
 * 		return nil
 * 	}
 * 	if m.nameType == nil {
 * 		m.nameType = c.instantiateType(c.getTypeFromTypeNode(m.declaration.NameType), m.mapper)
 * 	}
 * 	return m.nameType
 * }
 */
export declare function Checker_getNameTypeFromMappedType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateTypeAlias","kind":"method","status":"implemented","sigHash":"0d06087c71cf487e09a5703708feeb33f7b4dd10b939396667464cfe5470b85b","bodyHash":"3b40929087aed4e4046336a7e9ee005165d70688c368ccf6f78d774f0ac75e49"}
 *
 * Go source:
 * func (c *Checker) instantiateTypeAlias(alias *TypeAlias, m *TypeMapper) *TypeAlias {
 * 	if alias == nil {
 * 		return nil
 * 	}
 * 	return &TypeAlias{symbol: alias.symbol, typeArguments: c.instantiateTypes(alias.typeArguments, m)}
 * }
 */
export declare function Checker_instantiateTypeAlias(receiver: GoPtr<Checker>, alias: GoPtr<TypeAlias>, m: GoPtr<TypeMapper>): GoPtr<TypeAlias>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSymbols","kind":"method","status":"implemented","sigHash":"ac8d17801d1e783e90eb971cff053eb6864dda73787cd75c471c4ce075f49cdd","bodyHash":"3a671709c24932efa7bbaf4bbedc4bee3be64158deb30b3a653e8ef3dbd39a5c"}
 *
 * Go source:
 * func (c *Checker) instantiateSymbols(symbols []*ast.Symbol, m *TypeMapper) []*ast.Symbol {
 * 	return instantiateList(c, symbols, m, (*Checker).instantiateSymbol)
 * }
 */
export declare function Checker_instantiateSymbols(receiver: GoPtr<Checker>, symbols: GoSlice<GoPtr<Symbol>>, m: GoPtr<TypeMapper>): GoSlice<GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateIndexInfos","kind":"method","status":"implemented","sigHash":"5c7786356f2ceff2a051c9206491fc5c2b48da3b1791b140e0108648ff2a57f8","bodyHash":"858750af7cb169c68acf66fd2014381adab920d656100fdfcd09a996d317f2f6"}
 *
 * Go source:
 * func (c *Checker) instantiateIndexInfos(indexInfos []*IndexInfo, m *TypeMapper) []*IndexInfo {
 * 	return instantiateList(c, indexInfos, m, (*Checker).instantiateIndexInfo)
 * }
 */
export declare function Checker_instantiateIndexInfos(receiver: GoPtr<Checker>, indexInfos: GoSlice<GoPtr<IndexInfo>>, m: GoPtr<TypeMapper>): GoSlice<GoPtr<IndexInfo>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromIndexedAccessTypeNode","kind":"method","status":"implemented","sigHash":"4d0e11a45cb2fac391f8159acb3d3192a41f4cf3be84efeab493f6944c0191e7","bodyHash":"714822fadd7243ebf38c010a6b47bcdb8e2b8a55b79ac0018abfbcd08a49b400"}
 *
 * Go source:
 * func (c *Checker) getTypeFromIndexedAccessTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		objectType := c.getTypeFromTypeNode(node.AsIndexedAccessTypeNode().ObjectType)
 * 		indexType := c.getTypeFromTypeNode(node.AsIndexedAccessTypeNode().IndexType)
 * 		potentialAlias := c.getAliasForTypeNode(node)
 * 		links.resolvedType = c.getIndexedAccessTypeEx(objectType, indexType, AccessFlagsNone, node, potentialAlias)
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeFromIndexedAccessTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getESSymbolLikeTypeForNode","kind":"method","status":"implemented","sigHash":"58ffe94a906e78875486273cf582edf17b2361b7dd0024849558217df0b2177b","bodyHash":"9867321408d4236fe44c0530f1fac8bdaca216d699ddbc4cebbe53218b9779a1"}
 *
 * Go source:
 * func (c *Checker) getESSymbolLikeTypeForNode(node *ast.Node) *Type {
 * 	if isValidESSymbolDeclaration(node) {
 * 		symbol := c.getSymbolOfNode(node)
 * 		if symbol != nil {
 * 			uniqueType := c.uniqueESSymbolTypes[symbol]
 * 			if uniqueType == nil {
 * 				var b strings.Builder
 * 				b.WriteString(ast.InternalSymbolNamePrefix)
 * 				b.WriteByte('@')
 * 				b.WriteString(symbol.Name)
 * 				b.WriteByte('@')
 * 				b.WriteString(strconv.FormatUint(uint64(ast.GetSymbolId(symbol)), 10))
 * 				uniqueType = c.newUniqueESSymbolType(symbol, b.String())
 * 				c.uniqueESSymbolTypes[symbol] = uniqueType
 * 			}
 * 			return uniqueType
 * 		}
 * 	}
 * 	return c.esSymbolType
 * }
 */
export declare function Checker_getESSymbolLikeTypeForNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolFromTypeReference","kind":"method","status":"implemented","sigHash":"5ab1f23106670b0a2d67b8a678a3d50301ba5687d89e8e5b6bfbc3533dad20d1","bodyHash":"859ba404147c1f3fd57b0d1f8c384d2f7d6faf7a9462fdb52845b9d2032f1328"}
 *
 * Go source:
 * func (c *Checker) getSymbolFromTypeReference(node *ast.Node) *ast.Symbol {
 * 	links := c.symbolNodeLinks.Get(node)
 * 	if links.resolvedSymbol == nil {
 * 		if isConstTypeReference(node) && ast.IsAssertionExpression(node.Parent) {
 * 			links.resolvedSymbol = c.unknownSymbol
 * 		} else {
 * 			links.resolvedSymbol = c.resolveTypeReferenceName(node, ast.SymbolFlagsType, false /*ignoreErrors* /)
 * 		}
 * 	}
 * 	return links.resolvedSymbol
 * }
 */
export declare function Checker_getSymbolFromTypeReference(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveTypeReferenceName","kind":"method","status":"implemented","sigHash":"c48c2d0057916014fbd3303020a61688d6069096aa40ad2e8dafd5bb0a023804","bodyHash":"dbfb92a0fe98fa042f25cb3a804bf2040b6bbd8cd648d8cbb47309f6ee26e66b"}
 *
 * Go source:
 * func (c *Checker) resolveTypeReferenceName(typeReference *ast.Node, meaning ast.SymbolFlags, ignoreErrors bool) *ast.Symbol {
 * 	name := getTypeReferenceName(typeReference)
 * 	if name == nil {
 * 		return c.unknownSymbol
 * 	}
 * 	symbol := c.resolveEntityName(name, meaning, ignoreErrors, false /*dontResolveAlias* /, nil /*location* /)
 * 	if symbol != nil && symbol != c.unknownSymbol {
 * 		return symbol
 * 	}
 * 	if ignoreErrors {
 * 		return c.unknownSymbol
 * 	}
 * 	return c.getUnresolvedSymbolForEntityName(name)
 * }
 */
export declare function Checker_resolveTypeReferenceName(receiver: GoPtr<Checker>, typeReference: GoPtr<Node>, meaning: SymbolFlags, ignoreErrors: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUnresolvedSymbolForEntityName","kind":"method","status":"implemented","sigHash":"d0b4427d0fa6d196b4790b4a5906ff577dcc487aecb9b583b50110004aecea23","bodyHash":"429b46ab2812ea6359fd83fcf704c91841d28039350b64a8c23cf348dcb28481"}
 *
 * Go source:
 * func (c *Checker) getUnresolvedSymbolForEntityName(name *ast.Node) *ast.Symbol {
 * 	var identifier *ast.Node
 * 	switch name.Kind {
 * 	case ast.KindQualifiedName:
 * 		identifier = name.AsQualifiedName().Right
 * 	case ast.KindPropertyAccessExpression:
 * 		identifier = name.Name()
 * 	default:
 * 		identifier = name
 * 	}
 * 	text := identifier.Text()
 * 	if text != "" {
 * 		var parentSymbol *ast.Symbol
 * 		switch name.Kind {
 * 		case ast.KindQualifiedName:
 * 			parentSymbol = c.getUnresolvedSymbolForEntityName(name.AsQualifiedName().Left)
 * 		case ast.KindPropertyAccessExpression:
 * 			parentSymbol = c.getUnresolvedSymbolForEntityName(name.Expression())
 * 		}
 * 		var path string
 * 		if parentSymbol != nil {
 * 			path = getSymbolPath(parentSymbol) + "." + text
 * 		} else {
 * 			path = text
 * 		}
 * 		result := c.unresolvedSymbols[path]
 * 		if result == nil {
 * 			result = c.newSymbolEx(ast.SymbolFlagsTypeAlias, text, ast.CheckFlagsUnresolved)
 * 			c.unresolvedSymbols[path] = result
 * 			result.Parent = parentSymbol
 * 			c.typeAliasLinks.Get(result).declaredType = c.unresolvedType
 * 		}
 * 		return result
 * 	}
 * 	return c.unknownSymbol
 * }
 */
export declare function Checker_getUnresolvedSymbolForEntityName(receiver: GoPtr<Checker>, name: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isResolvedByTypeAlias","kind":"method","status":"implemented","sigHash":"9d5a7345f7005fb8429cb60a888d33c84ddad77e851842b9869be4c9cebf851c","bodyHash":"31a7ae77bdbb1b749bccc32b58eac9a1c8cfee9341ae8ab4748fa2972e3ffb1c"}
 *
 * Go source:
 * func (c *Checker) isResolvedByTypeAlias(node *ast.Node) bool {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case ast.KindParenthesizedType, ast.KindNamedTupleMember, ast.KindTypeReference, ast.KindUnionType, ast.KindIntersectionType,
 * 		ast.KindIndexedAccessType, ast.KindConditionalType, ast.KindTypeOperator, ast.KindArrayType, ast.KindTupleType:
 * 		return c.isResolvedByTypeAlias(parent)
 * 	case ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isResolvedByTypeAlias(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mayResolveTypeAlias","kind":"method","status":"implemented","sigHash":"f0500db236ac104d7c93b7c17db60eee84884965b32ae360dc5ff0e7c45768d1","bodyHash":"5d81be9fb24523d752b612367c5d150feb2bfd519cab28792edce1cc20f051ed"}
 *
 * Go source:
 * func (c *Checker) mayResolveTypeAlias(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindTypeReference:
 * 		return c.resolveTypeReferenceName(node, ast.SymbolFlagsType, false).Flags&ast.SymbolFlagsTypeAlias != 0
 * 	case ast.KindTypeQuery:
 * 		return true
 * 	case ast.KindTypeOperator:
 * 		return node.AsTypeOperatorNode().Operator != ast.KindUniqueKeyword && c.mayResolveTypeAlias(node.Type())
 * 	case ast.KindParenthesizedType, ast.KindOptionalType, ast.KindNamedTupleMember:
 * 		return c.mayResolveTypeAlias(node.Type())
 * 	case ast.KindRestType:
 * 		return node.Type().Kind != ast.KindArrayType || c.mayResolveTypeAlias(node.Type().AsArrayTypeNode().ElementType)
 * 	case ast.KindUnionType:
 * 		return core.Some(node.AsUnionTypeNode().Types.Nodes, c.mayResolveTypeAlias)
 * 	case ast.KindIntersectionType:
 * 		return core.Some(node.AsIntersectionTypeNode().Types.Nodes, c.mayResolveTypeAlias)
 * 	case ast.KindIndexedAccessType:
 * 		return c.mayResolveTypeAlias(node.AsIndexedAccessTypeNode().ObjectType) || c.mayResolveTypeAlias(node.AsIndexedAccessTypeNode().IndexType)
 * 	case ast.KindConditionalType:
 * 		return c.mayResolveTypeAlias(node.AsConditionalTypeNode().CheckType) || c.mayResolveTypeAlias(node.AsConditionalTypeNode().ExtendsType) ||
 * 			c.mayResolveTypeAlias(node.AsConditionalTypeNode().TrueType) || c.mayResolveTypeAlias(node.AsConditionalTypeNode().FalseType)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_mayResolveTypeAlias(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromTypeAliasReference","kind":"method","status":"implemented","sigHash":"5148222a20e40ec70271d545f007174bf1e190de8de945ad9f0b640cbb5f5e3f","bodyHash":"3fb4c44c88a74a9572e44e1d04679babfcbdd18b5d76a3029515cb3c68dc70ca"}
 *
 * Go source:
 * func (c *Checker) getTypeFromTypeAliasReference(node *ast.Node, symbol *ast.Symbol) *Type {
 * 	typeArguments := node.TypeArguments()
 * 	if symbol.CheckFlags&ast.CheckFlagsUnresolved != 0 {
 * 		alias := &TypeAlias{symbol: symbol, typeArguments: core.Map(typeArguments, c.getTypeFromTypeNode)}
 * 		key := getAliasKey(alias)
 * 		errorType := c.errorTypes[key]
 * 		if errorType == nil {
 * 			errorType = c.newIntrinsicType(TypeFlagsAny, "error")
 * 			errorType.alias = alias
 * 			c.errorTypes[key] = errorType
 * 		}
 * 		return errorType
 * 	}
 * 	t := c.getDeclaredTypeOfSymbol(symbol)
 * 	typeParameters := c.typeAliasLinks.Get(symbol).typeParameters
 * 	if len(typeParameters) != 0 {
 * 		numTypeArguments := len(typeArguments)
 * 		minTypeArgumentCount := c.getMinTypeArgumentCount(typeParameters)
 * 		if numTypeArguments < minTypeArgumentCount || numTypeArguments > len(typeParameters) {
 * 			message := core.IfElse(minTypeArgumentCount == len(typeParameters),
 * 				diagnostics.Generic_type_0_requires_1_type_argument_s,
 * 				diagnostics.Generic_type_0_requires_between_1_and_2_type_arguments)
 * 			c.error(node, message, c.symbolToString(symbol), minTypeArgumentCount, len(typeParameters))
 * 			return c.errorType
 * 		}
 * 		// We refrain from associating a local type alias with an instantiation of a top-level type alias
 * 		// because the local alias may end up being referenced in an inferred return type where it is not
 * 		// accessible--which in turn may lead to a large structural expansion of the type when generating
 * 		// a .d.ts file. See #43622 for an example.
 * 		aliasSymbol := c.getAliasSymbolForTypeNode(node)
 * 		var newAliasSymbol *ast.Symbol
 * 		if aliasSymbol != nil && (isLocalTypeAlias(symbol) || !isLocalTypeAlias(aliasSymbol)) {
 * 			newAliasSymbol = aliasSymbol
 * 		}
 * 		var aliasTypeArguments []*Type
 * 		if newAliasSymbol != nil {
 * 			aliasTypeArguments = c.getTypeArgumentsForAliasSymbol(newAliasSymbol)
 * 		} else if ast.IsTypeReferenceType(node) {
 * 			aliasSymbol := c.resolveTypeReferenceName(node, ast.SymbolFlagsAlias, true /*ignoreErrors* /)
 * 			// refers to an alias import/export/reexport - by making sure we use the target as an aliasSymbol,
 * 			// we ensure the exported symbol is used to refer to the type when it is reserialized later
 * 			if aliasSymbol != nil && aliasSymbol != c.unknownSymbol {
 * 				resolved := c.resolveAlias(aliasSymbol)
 * 				if resolved != nil && resolved.Flags&ast.SymbolFlagsTypeAlias != 0 {
 * 					newAliasSymbol = resolved
 * 					aliasTypeArguments = c.getTypeArgumentsFromNode(node)
 * 				}
 * 			}
 * 		}
 * 		var newAlias *TypeAlias
 * 		if newAliasSymbol != nil {
 * 			newAlias = &TypeAlias{symbol: newAliasSymbol, typeArguments: aliasTypeArguments}
 * 		}
 * 		return c.getTypeAliasInstantiation(symbol, c.getTypeArgumentsFromNode(node), newAlias)
 * 	}
 * 	if c.checkNoTypeArguments(node, symbol) {
 * 		return t
 * 	}
 * 	return c.errorType
 * }
 */
export declare function Checker_getTypeFromTypeAliasReference(receiver: GoPtr<Checker>, node: GoPtr<Node>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaredTypeOfSymbol","kind":"method","status":"implemented","sigHash":"c20dabf95e5d6e533928dee8b0e24bf37fe61052caaec8229ed162c32b4dd2a9","bodyHash":"0fe5ad13c26bc1d95f56efa41121cd8c55b62b32a390d27b59acc429447b683f"}
 *
 * Go source:
 * func (c *Checker) getDeclaredTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	result := c.tryGetDeclaredTypeOfSymbol(symbol)
 * 	if result == nil {
 * 		result = c.errorType
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getDeclaredTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetDeclaredTypeOfSymbol","kind":"method","status":"implemented","sigHash":"99019d67cbad88e221917d4f65304cb15d7b4d557b91e17308777214cc798bb9","bodyHash":"11e96997e696851e7beadf4e005a4baee87c31826434da2523e5db4f7fb1246c"}
 *
 * Go source:
 * func (c *Checker) tryGetDeclaredTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	switch {
 * 	case symbol.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsInterface) != 0:
 * 		return c.getDeclaredTypeOfClassOrInterface(symbol)
 * 	case symbol.Flags&ast.SymbolFlagsTypeParameter != 0:
 * 		return c.getDeclaredTypeOfTypeParameter(symbol)
 * 	case symbol.Flags&ast.SymbolFlagsTypeAlias != 0:
 * 		return c.getDeclaredTypeOfTypeAlias(symbol)
 * 	case symbol.Flags&ast.SymbolFlagsEnum != 0:
 * 		return c.getDeclaredTypeOfEnum(symbol)
 * 	case symbol.Flags&ast.SymbolFlagsEnumMember != 0:
 * 		return c.getDeclaredTypeOfEnumMember(symbol)
 * 	case symbol.Flags&ast.SymbolFlagsAlias != 0:
 * 		return c.getDeclaredTypeOfAlias(symbol)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_tryGetDeclaredTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAliasForTypeNode","kind":"method","status":"implemented","sigHash":"68bbd63b4e88f57bb8b5cb139e30a45b3438e887651ae367e32ebeb5163d71e3","bodyHash":"1a516e7d665e4c15e82fa1b8bf68866d746c7594e4aa1a8b2c8a98640ce22dad"}
 *
 * Go source:
 * func (c *Checker) getAliasForTypeNode(node *ast.Node) *TypeAlias {
 * 	symbol := c.getAliasSymbolForTypeNode(node)
 * 	if symbol != nil {
 * 		return &TypeAlias{symbol: symbol, typeArguments: c.getTypeArgumentsForAliasSymbol(symbol)}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getAliasForTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<TypeAlias>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAliasSymbolForTypeNode","kind":"method","status":"implemented","sigHash":"b4cd6c00b81b1c71dce240da5a59eeb63cca36f8479896e0c12bd3ceb044d50c","bodyHash":"656e9a61a20f7ef27f4a131323f7101437727a3f002253d7658206eb31d5312a"}
 *
 * Go source:
 * func (c *Checker) getAliasSymbolForTypeNode(node *ast.Node) *ast.Symbol {
 * 	host := node.Parent
 * 	for ast.IsParenthesizedTypeNode(host) || ast.IsTypeOperatorNode(host) && host.AsTypeOperatorNode().Operator == ast.KindReadonlyKeyword {
 * 		host = host.Parent
 * 	}
 * 	if isTypeAlias(host) {
 * 		return c.getSymbolOfDeclaration(host)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getAliasSymbolForTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaredTypeOfTypeAlias","kind":"method","status":"implemented","sigHash":"75a30f1d6b38871b2d425b0a4d64aef8674d78cb8f4d1c3e755c5dc9ab367d75","bodyHash":"ad5819e814342cd316d50df077b71be4152a0e1317917c7eadcfece13ef2256e"}
 *
 * Go source:
 * func (c *Checker) getDeclaredTypeOfTypeAlias(symbol *ast.Symbol) *Type {
 * 	links := c.typeAliasLinks.Get(symbol)
 * 	if links.declaredType == nil {
 * 		// Note that we use the links object as the target here because the symbol object is used as the unique
 * 		// identity for resolution of the 'type' property in SymbolLinks.
 * 		if !c.pushTypeResolution(symbol, TypeSystemPropertyNameDeclaredType) {
 * 			return c.errorType
 * 		}
 * 		declaration := core.Find(symbol.Declarations, ast.IsTypeOrJSTypeAliasDeclaration)
 * 		typeNode := declaration.Type()
 * 		t := c.getTypeFromTypeNode(typeNode)
 * 		if c.popTypeResolution() {
 * 			typeParameters := c.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 			if len(typeParameters) != 0 {
 * 				// Initialize the instantiation cache for generic type aliases. The declared type corresponds to
 * 				// an instantiation of the type alias with the type parameters supplied as type arguments.
 * 				links.typeParameters = typeParameters
 * 				links.instantiations = make(map[CacheHashKey]*Type)
 * 				links.instantiations[getTypeListKey(typeParameters)] = t
 * 			}
 * 			if t == c.intrinsicMarkerType && symbol.Name == "BuiltinIteratorReturn" {
 * 				t = c.getBuiltinIteratorReturnType()
 * 			}
 * 		} else {
 * 			errorNode := declaration.Name()
 * 			if errorNode == nil {
 * 				errorNode = declaration
 * 			}
 * 			c.error(errorNode, diagnostics.Type_alias_0_circularly_references_itself, c.symbolToString(symbol))
 * 			t = c.errorType
 * 		}
 * 		if links.declaredType == nil {
 * 			links.declaredType = t
 * 		}
 * 	}
 * 	return links.declaredType
 * }
 */
export declare function Checker_getDeclaredTypeOfTypeAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEnumMemberValue","kind":"method","status":"implemented","sigHash":"7e40ea1b3c2e25e2dfd4dea5aa39712f118bdfcb3bb5f2dd62cbc35669d89a82","bodyHash":"bc1ce3b2461e2a4b187412e6244d033c79450a9b03cb3aebdda0d2a934c38136"}
 *
 * Go source:
 * func (c *Checker) getEnumMemberValue(node *ast.Node) evaluator.Result {
 * 	c.computeEnumMemberValues(node.Parent)
 * 	return c.enumMemberLinks.Get(node).value
 * }
 */
export declare function Checker_getEnumMemberValue(receiver: GoPtr<Checker>, node: GoPtr<Node>): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaredTypeOfEnumMember","kind":"method","status":"implemented","sigHash":"b5e56323a1755f2e657fdaf76002b7f012f611a33c4b2ba36f1029c324ab0439","bodyHash":"b0f7dba311187db2ce89734624b89af1487174428b40d553dadc0c7bc29d6b38"}
 *
 * Go source:
 * func (c *Checker) getDeclaredTypeOfEnumMember(symbol *ast.Symbol) *Type {
 * 	links := c.declaredTypeLinks.Get(symbol)
 * 	if !(links.declaredType != nil) {
 * 		enumType := c.getDeclaredTypeOfEnum(c.getParentOfSymbol(symbol))
 * 		if links.declaredType == nil {
 * 			links.declaredType = enumType
 * 		}
 * 	}
 * 	return links.declaredType
 * }
 */
export declare function Checker_getDeclaredTypeOfEnumMember(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.computeEnumMemberValues","kind":"method","status":"implemented","sigHash":"1a37cec56ac619c1e746bf8bdbf5aa7bc770f5c7747e0658607182db238aeebe","bodyHash":"267b95354b655cf4c49058589bc288c8770cc0295c4eec4efe870af48bed6f37"}
 *
 * Go source:
 * func (c *Checker) computeEnumMemberValues(node *ast.Node) {
 * 	nodeLinks := c.nodeLinks.Get(node)
 * 	if !(nodeLinks.flags&NodeCheckFlagsEnumValuesComputed != 0) {
 * 		nodeLinks.flags |= NodeCheckFlagsEnumValuesComputed
 * 		autoValue := new(jsnum.Number)
 * 		var previous *ast.Node
 * 		for _, member := range node.Members() {
 * 			result := c.computeEnumMemberValue(member, autoValue, previous)
 * 			c.enumMemberLinks.Get(member).value = result
 * 			if value, isNumber := result.Value.(jsnum.Number); isNumber {
 * 				nextValue := value + 1
 * 				autoValue = &nextValue
 * 			} else {
 * 				autoValue = nil
 * 			}
 * 			previous = member
 * 		}
 * 	}
 * }
 */
export declare function Checker_computeEnumMemberValues(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.computeEnumMemberValue","kind":"method","status":"implemented","sigHash":"0e9b43df07f7a80162897b6dfb1300aef3e56b544ea2eab858e80327fdc5c8db","bodyHash":"61d375a0a843dd5fcdf22aea2794ea5a006e235ca45ff3e20eb97aa0ad744893"}
 *
 * Go source:
 * func (c *Checker) computeEnumMemberValue(member *ast.Node, autoValue *jsnum.Number, previous *ast.Node) evaluator.Result {
 * 	if ast.IsComputedNonLiteralName(member.Name()) {
 * 		c.error(member.Name(), diagnostics.Computed_property_names_are_not_allowed_in_enums)
 * 	} else if ast.IsBigIntLiteral(member.Name()) {
 * 		c.error(member.Name(), diagnostics.An_enum_member_cannot_have_a_numeric_name)
 * 	} else {
 * 		text := ast.GetTextOfPropertyName(member.Name())
 * 		if isNumericLiteralName(text) && !ast.IsInfinityOrNaNString(text) {
 * 			c.error(member.Name(), diagnostics.An_enum_member_cannot_have_a_numeric_name)
 * 		}
 * 	}
 * 	if member.Initializer() != nil {
 * 		return c.computeConstantEnumMemberValue(member)
 * 	}
 * 	// In ambient non-const numeric enum declarations, enum members without initializers are
 * 	// considered computed members (as opposed to having auto-incremented values).
 * 	if member.Parent.Flags&ast.NodeFlagsAmbient != 0 && !ast.IsEnumConst(member.Parent) {
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	// If the member declaration specifies no value, the member is considered a constant enum member.
 * 	// If the member is the first member in the enum declaration, it is assigned the value zero.
 * 	// Otherwise, it is assigned the value of the immediately preceding member plus one, and an error
 * 	// occurs if the immediately preceding member is not a constant enum member.
 * 	if autoValue == nil {
 * 		c.error(member.Name(), diagnostics.Enum_member_must_have_initializer)
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	if c.compilerOptions.GetIsolatedModules() && previous != nil && previous.Initializer() != nil {
 * 		prevValue := c.getEnumMemberValue(previous)
 * 		_, prevIsNum := prevValue.Value.(jsnum.Number)
 * 		if !prevIsNum || prevValue.ResolvedOtherFiles {
 * 			c.error(member.Name(), diagnostics.Enum_member_following_a_non_literal_numeric_member_must_have_an_initializer_when_isolatedModules_is_enabled)
 * 		}
 * 	}
 * 	return evaluator.NewResult(*autoValue, false, false, false)
 * }
 */
export declare function Checker_computeEnumMemberValue(receiver: GoPtr<Checker>, member: GoPtr<Node>, autoValue: GoPtr<Number>, previous: GoPtr<Node>): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.computeConstantEnumMemberValue","kind":"method","status":"implemented","sigHash":"848c09618c2944f0f1dd104467755672c6e2a22a2f2db862daa0cfb99f5e9b61","bodyHash":"4224cb57640814a384916a703718e8b9998514f94457a62c14bcf3b02bec6b35"}
 *
 * Go source:
 * func (c *Checker) computeConstantEnumMemberValue(member *ast.Node) evaluator.Result {
 * 	isConstEnum := ast.IsEnumConst(member.Parent)
 * 	initializer := member.Initializer()
 * 	result := c.evaluate(initializer, member)
 * 	switch {
 * 	case result.Value != nil:
 * 		if isConstEnum {
 * 			if numValue, isNumber := result.Value.(jsnum.Number); isNumber && (numValue.IsInf() || numValue.IsNaN()) {
 * 				c.error(initializer, core.IfElse(numValue.IsNaN(),
 * 					diagnostics.X_const_enum_member_initializer_was_evaluated_to_disallowed_value_NaN,
 * 					diagnostics.X_const_enum_member_initializer_was_evaluated_to_a_non_finite_value))
 * 			}
 * 		}
 * 		if c.compilerOptions.GetIsolatedModules() {
 * 			if _, isString := result.Value.(string); isString && !result.IsSyntacticallyString {
 * 				memberName := member.Parent.Name().Text() + "." + member.Name().Text()
 * 				c.error(initializer, diagnostics.X_0_has_a_string_type_but_must_have_syntactically_recognizable_string_syntax_when_isolatedModules_is_enabled, memberName)
 * 			}
 * 		}
 * 	case isConstEnum:
 * 		c.error(initializer, diagnostics.X_const_enum_member_initializers_must_be_constant_expressions)
 * 	case member.Parent.Flags&ast.NodeFlagsAmbient != 0:
 * 		c.error(initializer, diagnostics.In_ambient_enum_declarations_member_initializer_must_be_constant_expression)
 * 	default:
 * 		c.checkTypeAssignableTo(c.checkExpression(initializer), c.numberType, initializer, diagnostics.Type_0_is_not_assignable_to_type_1_as_required_for_computed_enum_member_values)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_computeConstantEnumMemberValue(receiver: GoPtr<Checker>, member: GoPtr<Node>): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.evaluateEnumMember","kind":"method","status":"implemented","sigHash":"215d61ac40b06f5191bc5abd2ed3b941d060b6eb5ac7923a1f2e0c11fec3d0ca","bodyHash":"66d9d711748ff5c869cca8a24e0f2d04fc54f6ee404f682548a3f7c635a29ee0"}
 *
 * Go source:
 * func (c *Checker) evaluateEnumMember(expr *ast.Node, symbol *ast.Symbol, location *ast.Node) evaluator.Result {
 * 	declaration := symbol.ValueDeclaration
 * 	if declaration == nil || declaration == location {
 * 		c.error(expr, diagnostics.Property_0_is_used_before_being_assigned, c.symbolToString(symbol))
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	if !c.isBlockScopedNameDeclaredBeforeUse(declaration, location) {
 * 		c.error(expr, diagnostics.A_member_initializer_in_a_enum_declaration_cannot_reference_members_declared_after_it_including_members_defined_in_other_enums)
 * 		return evaluator.NewResult(jsnum.Number(0), false, false, false)
 * 	}
 * 	value := c.getEnumMemberValue(declaration)
 * 	if location.Parent != declaration.Parent {
 * 		return evaluator.NewResult(value.Value, value.IsSyntacticallyString, value.ResolvedOtherFiles, true /*hasExternalReferences* /)
 * 	}
 * 	return value
 * }
 */
export declare function Checker_evaluateEnumMember(receiver: GoPtr<Checker>, expr: GoPtr<Node>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaredTypeOfAlias","kind":"method","status":"implemented","sigHash":"fd43264dd9baa475e230eee954ecb75295bc92960f7ea655a1cce76bea026455","bodyHash":"fc1bbe3acf05b8d6e74679999f064003b2ebd23921ab14bf6381bb2e07126903"}
 *
 * Go source:
 * func (c *Checker) getDeclaredTypeOfAlias(symbol *ast.Symbol) *Type {
 * 	links := c.declaredTypeLinks.Get(symbol)
 * 	if links.declaredType == nil {
 * 		links.declaredType = c.getDeclaredTypeOfSymbol(c.resolveAlias(symbol))
 * 	}
 * 	return links.declaredType
 * }
 */
export declare function Checker_getDeclaredTypeOfAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromNamedTupleTypeNode","kind":"method","status":"implemented","sigHash":"5bf79e4d19b68da46b6052e4c446b16786d363278161ceb5dc17d63a9083aeaf","bodyHash":"5428d1b283573fa74db174fa8b02bed51d645a638a2456bf618f53b1ada6aa58"}
 *
 * Go source:
 * func (c *Checker) getTypeFromNamedTupleTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		if node.AsNamedTupleMember().DotDotDotToken != nil {
 * 			links.resolvedType = c.getTypeFromRestTypeNode(node)
 * 		} else {
 * 			links.resolvedType = c.addOptionalityEx(c.getTypeFromTypeNode(node.Type()), true /*isProperty* /, node.QuestionToken() != nil)
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeFromNamedTupleTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromImportTypeNode","kind":"method","status":"implemented","sigHash":"2e9e0dce333c856f8ee3ee17dbb51d6eb70cecc5a7fac353761b6fe8b2855b94","bodyHash":"782043fdbb5ca29a95bb89853576db753ce4d46537008e601230bd9494200fad"}
 *
 * Go source:
 * func (c *Checker) getTypeFromImportTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		n := node.AsImportTypeNode()
 * 		if !ast.IsLiteralImportTypeNode(node) {
 * 			c.error(n.Argument, diagnostics.String_literal_expected)
 * 			c.symbolNodeLinks.Get(node).resolvedSymbol = c.unknownSymbol
 * 			links.resolvedType = c.errorType
 * 			return links.resolvedType
 * 		}
 * 		targetMeaning := core.IfElse(n.IsTypeOf, ast.SymbolFlagsValue, ast.SymbolFlagsType)
 * 		// TODO: Future work: support unions/generics/whatever via a deferred import-type
 * 		innerModuleSymbol := c.resolveExternalModuleName(node, n.Argument.AsLiteralTypeNode().Literal, false /*ignoreErrors* /)
 * 		if innerModuleSymbol == nil {
 * 			c.symbolNodeLinks.Get(node).resolvedSymbol = c.unknownSymbol
 * 			links.resolvedType = c.errorType
 * 			return links.resolvedType
 * 		}
 * 		moduleSymbol := c.resolveExternalModuleSymbol(innerModuleSymbol, false /*dontResolveAlias* /)
 * 		if !ast.NodeIsMissing(n.Qualifier) {
 * 			nameChain := c.getIdentifierChain(n.Qualifier)
 * 			currentNamespace := moduleSymbol
 * 			for i, current := range nameChain {
 * 				meaning := ast.SymbolFlagsNamespace
 * 				if i == len(nameChain)-1 {
 * 					meaning = targetMeaning
 * 				}
 * 				// typeof a.b.c is normally resolved using `checkExpression` which in turn defers to `checkQualifiedName`
 * 				// That, in turn, ultimately uses `getPropertyOfType` on the type of the symbol, which differs slightly from
 * 				// the `exports` lookup process that only looks up namespace members which is used for most type references
 * 				mergedResolvedSymbol := c.getMergedSymbol(c.resolveSymbol(currentNamespace))
 * 				var symbolFromVariable *ast.Symbol
 * 				var symbolFromModule *ast.Symbol
 * 				if n.IsTypeOf {
 * 					symbolFromVariable = c.getPropertyOfTypeEx(c.getTypeOfSymbol(mergedResolvedSymbol), current.Text(), false /*skipObjectFunctionPropertyAugment* /, true /*includeTypeOnlyMembers* /)
 * 				} else {
 * 					symbolFromModule = c.getSymbol(c.getExportsOfSymbol(mergedResolvedSymbol), current.Text(), meaning)
 * 					if symbolFromModule == nil {
 * 						// a CommonJS module might have typedefs exported alongside an export=
 * 						// !!!
 * 						immediateModuleSymbol := c.resolveExternalModuleSymbol(innerModuleSymbol, true /*dontResolveAlias* /)
 * 						if immediateModuleSymbol != nil && core.Some(immediateModuleSymbol.Declarations, func(d *ast.Node) bool {
 * 							return ast.GetAssignmentDeclarationKind(d) == ast.JSDeclarationKindModuleExports
 * 						}) {
 * 							symbolFromModule = c.getSymbol(c.getExportsOfSymbol(immediateModuleSymbol.Parent), current.Text(), meaning)
 * 						}
 * 					}
 * 				}
 * 				next := core.OrElse(symbolFromModule, symbolFromVariable)
 * 				if next == nil {
 * 					c.error(current, diagnostics.Namespace_0_has_no_exported_member_1, c.getFullyQualifiedName(currentNamespace, nil), scanner.DeclarationNameToString(current))
 * 					links.resolvedType = c.errorType
 * 					return links.resolvedType
 * 				}
 * 				c.symbolNodeLinks.Get(current).resolvedSymbol = next
 * 				c.symbolNodeLinks.Get(current.Parent).resolvedSymbol = next
 * 				currentNamespace = next
 * 			}
 * 			links.resolvedType = c.resolveImportSymbolType(node, currentNamespace, targetMeaning)
 * 		} else {
 * 			if c.getSymbolFlags(moduleSymbol)&targetMeaning != 0 {
 * 				links.resolvedType = c.resolveImportSymbolType(node, moduleSymbol, targetMeaning)
 * 			} else {
 * 				message := core.IfElse(targetMeaning == ast.SymbolFlagsValue,
 * 					diagnostics.Module_0_does_not_refer_to_a_value_but_is_used_as_a_value_here,
 * 					diagnostics.Module_0_does_not_refer_to_a_type_but_is_used_as_a_type_here_Did_you_mean_typeof_import_0)
 * 				c.error(node, message, n.Argument.AsLiteralTypeNode().Literal.Text())
 * 				c.symbolNodeLinks.Get(node).resolvedSymbol = c.unknownSymbol
 * 				links.resolvedType = c.errorType
 * 			}
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeFromImportTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIdentifierChain","kind":"method","status":"implemented","sigHash":"67284138f8557b1a72365e0ce73645e07062905364e07dac4d0bf67481fe93b8","bodyHash":"f60fac8161c2c15607370604810c05c4504d25dbf9cab976f6400f3b90d3711b"}
 *
 * Go source:
 * func (c *Checker) getIdentifierChain(node *ast.Node) []*ast.Node {
 * 	if ast.IsIdentifier(node) {
 * 		return []*ast.Node{node}
 * 	}
 * 	return append(c.getIdentifierChain(node.AsQualifiedName().Left), node.AsQualifiedName().Right)
 * }
 */
export declare function Checker_getIdentifierChain(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveImportSymbolType","kind":"method","status":"implemented","sigHash":"8a2432988a1442f7f802e4b2d3797e42e09e2611545be7cf1097cd3f15e79252","bodyHash":"ddf47c6538d666da4b46ea5e4cb30bcdfa40ae6f4639ac0874de8ec590184440"}
 *
 * Go source:
 * func (c *Checker) resolveImportSymbolType(node *ast.Node, symbol *ast.Symbol, meaning ast.SymbolFlags) *Type {
 * 	resolvedSymbol := c.resolveSymbol(symbol)
 * 	c.symbolNodeLinks.Get(node).resolvedSymbol = resolvedSymbol
 * 	if meaning == ast.SymbolFlagsValue {
 * 		// intentionally doesn't use resolved symbol so type is cached as expected on the alias
 * 		return c.getInstantiationExpressionType(c.getTypeOfSymbol(symbol), node)
 * 	}
 * 	// getTypeReferenceType doesn't handle aliases - it must get the resolved symbol
 * 	return c.getTypeReferenceType(node, resolvedSymbol)
 * }
 */
export declare function Checker_resolveImportSymbolType(receiver: GoPtr<Checker>, node: GoPtr<Node>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createTypeFromGenericGlobalType","kind":"method","status":"implemented","sigHash":"d1b587f33dee8e39390b937b98e2c4ce54831b9013431e19ddda3c5ad9bb9263","bodyHash":"702396da27173cdb8eb366c0e6af70bb8a6d45f561d633ac77fe997229fdd33e"}
 *
 * Go source:
 * func (c *Checker) createTypeFromGenericGlobalType(genericGlobalType *Type, typeArguments []*Type) *Type {
 * 	if genericGlobalType != c.emptyGenericType {
 * 		return c.createTypeReference(genericGlobalType, typeArguments)
 * 	}
 * 	return c.emptyObjectType
 * }
 */
export declare function Checker_createTypeFromGenericGlobalType(receiver: GoPtr<Checker>, genericGlobalType: GoPtr<Type>, typeArguments: GoSlice<GoPtr<Type>>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalStrictFunctionType","kind":"method","status":"implemented","sigHash":"1efd714b794d1d80b770d9d85d34508e7bdba808335701ade8968b159569b9ff","bodyHash":"3fe29c2c679fe437c9a50b99a3dc35f3612ea6abe2fc639b7a6a4cf7dca312ff"}
 *
 * Go source:
 * func (c *Checker) getGlobalStrictFunctionType(name string) *Type {
 * 	if c.strictBindCallApply {
 * 		return c.getGlobalType(name, 0 /*arity* /, true /*reportErrors* /)
 * 	}
 * 	return c.globalFunctionType
 * }
 */
export declare function Checker_getGlobalStrictFunctionType(receiver: GoPtr<Checker>, name: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalImportMetaExpressionType","kind":"method","status":"implemented","sigHash":"02889d51feb6fd7d8b2d00d6813a087c4b419c93877e2f64a585470aa080a15b","bodyHash":"33b72ce5fa74fd34cf6d9c4dfcc11f16b28cde0ff3aac409b93be0641a7eae8e"}
 *
 * Go source:
 * func (c *Checker) getGlobalImportMetaExpressionType() *Type {
 * 	if c.deferredGlobalImportMetaExpressionType == nil {
 * 		// Create a synthetic type `ImportMetaExpression { meta: MetaProperty }`
 * 		symbol := c.newSymbol(ast.SymbolFlagsNone, "ImportMetaExpression")
 * 		importMetaType := c.getGlobalImportMetaType()
 * 		metaPropertySymbol := c.newSymbolEx(ast.SymbolFlagsProperty, "meta", ast.CheckFlagsReadonly)
 * 		metaPropertySymbol.Parent = symbol
 * 		c.valueSymbolLinks.Get(metaPropertySymbol).resolvedType = importMetaType
 * 		members := createSymbolTable([]*ast.Symbol{metaPropertySymbol})
 * 		symbol.Members = members
 * 		c.deferredGlobalImportMetaExpressionType = c.newAnonymousType(symbol, members, nil, nil, nil)
 * 	}
 * 	return c.deferredGlobalImportMetaExpressionType
 * }
 */
export declare function Checker_getGlobalImportMetaExpressionType(receiver: GoPtr<Checker>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGenericIndexType","kind":"method","status":"implemented","sigHash":"de73148d327d29431f2df961d35b43365aafb519ae999887e03b1cb8183002b1","bodyHash":"1bedd36c3de7d7fd62c161b126da57da3f39ebe56ddad6b595f4e04f042aa0b4"}
 *
 * Go source:
 * func (c *Checker) isGenericIndexType(t *Type) bool {
 * 	return c.getGenericObjectFlags(t)&ObjectFlagsIsGenericIndexType != 0
 * }
 */
export declare function Checker_isGenericIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newUniqueESSymbolType","kind":"method","status":"implemented","sigHash":"0aa977f4efcc36d68e56e3c6c9f679188987ba0725d3927c0e948f8c3b7a552c","bodyHash":"565218326d71c27d9eeaec7bcd110195e542058e03d9055b87a7964303c3e229"}
 *
 * Go source:
 * func (c *Checker) newUniqueESSymbolType(symbol *ast.Symbol, name string) *Type {
 * 	data := &UniqueESSymbolType{}
 * 	data.name = name
 * 	t := c.newType(TypeFlagsUniqueESSymbol, ObjectFlagsNone, data)
 * 	t.symbol = symbol
 * 	return t
 * }
 */
export declare function Checker_newUniqueESSymbolType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, name: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.setStructuredTypeMembers","kind":"method","status":"implemented","sigHash":"e649ac184d5bc5716185caa88aca7227728b47c57cf0911559c52bf0ef5b77cf","bodyHash":"2dcec9b0b626b5cc4b4637449daa6b8a758c97a63b9dacd40ea1da6117c1d350"}
 *
 * Go source:
 * func (c *Checker) setStructuredTypeMembers(t *Type, members ast.SymbolTable, callSignatures []*Signature, constructSignatures []*Signature, indexInfos []*IndexInfo) {
 * 	t.objectFlags |= ObjectFlagsMembersResolved
 * 	data := t.AsStructuredType()
 * 	data.members = members
 * 	data.properties = c.getNamedMembers(members, t.symbol)
 * 	if len(callSignatures) != 0 {
 * 		if len(constructSignatures) != 0 {
 * 			data.signatures = core.Concatenate(callSignatures, constructSignatures)
 * 		} else {
 * 			data.signatures = slices.Clip(callSignatures)
 * 		}
 * 		data.callSignatureCount = len(callSignatures)
 * 	} else {
 * 		if len(constructSignatures) != 0 {
 * 			data.signatures = slices.Clip(constructSignatures)
 * 		} else {
 * 			data.signatures = nil
 * 		}
 * 		data.callSignatureCount = 0
 * 	}
 * 	data.indexInfos = slices.Clip(indexInfos)
 * }
 */
export declare function Checker_setStructuredTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>, members: GoPtr<SymbolTable>, callSignatures: GoPtr<GoSlice<GoPtr<Signature>>>, constructSignatures: GoPtr<GoSlice<GoPtr<Signature>>>, indexInfos: GoPtr<GoSlice<GoPtr<IndexInfo>>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newIndexedAccessType","kind":"method","status":"implemented","sigHash":"0e19b5c422cf0d3eaadd76a60825d6d95f4cec94a97640e3d04392aaef4cd859","bodyHash":"f098ecca44cec8b87f41a00d34d1c1f9de9e2d68e6f1ba458182d539e613bf21"}
 *
 * Go source:
 * func (c *Checker) newIndexedAccessType(objectType *Type, indexType *Type, accessFlags AccessFlags) *Type {
 * 	data := &IndexedAccessType{}
 * 	data.objectType = objectType
 * 	data.indexType = indexType
 * 	data.accessFlags = accessFlags
 * 	return c.newType(TypeFlagsIndexedAccess, ObjectFlagsNone, data)
 * }
 */
export declare function Checker_newIndexedAccessType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, accessFlags: AccessFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newIndexType","kind":"method","status":"implemented","sigHash":"0f0e15a28ee75b8d699e9250ebe226712ef8e519e9f082febab95af427ac7125","bodyHash":"8a65a1b241c9a0397b6a298207b0ef4e5da09209e474a92d30cb66a222e3129b"}
 *
 * Go source:
 * func (c *Checker) newIndexType(target *Type, indexFlags IndexFlags) *Type {
 * 	data := &IndexType{}
 * 	data.target = target
 * 	data.indexFlags = indexFlags
 * 	return c.newType(TypeFlagsIndex, ObjectFlagsNone, data)
 * }
 */
export declare function Checker_newIndexType(receiver: GoPtr<Checker>, target: GoPtr<Type>, indexFlags: IndexFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newIndexInfo","kind":"method","status":"implemented","sigHash":"a303c053cfbf39c19ac10ba7c44bd98ee83eee9240ccbfd884c0c17f15f3c3df","bodyHash":"03424b7ceb78a310a370fb55969af186ba261e2f81c638661ee0ddaff1a8a5c8"}
 *
 * Go source:
 * func (c *Checker) newIndexInfo(keyType *Type, valueType *Type, isReadonly bool, declaration *ast.Node, components []*ast.Node) *IndexInfo {
 * 	info := c.indexInfoArena.New()
 * 	info.keyType = keyType
 * 	info.valueType = valueType
 * 	info.isReadonly = isReadonly
 * 	info.declaration = declaration
 * 	info.components = components
 * 	return info
 * }
 */
export declare function Checker_newIndexInfo(receiver: GoPtr<Checker>, keyType: GoPtr<Type>, valueType: GoPtr<Type>, isReadonly: bool, declaration: GoPtr<Node>, components: GoSlice<GoPtr<Node>>): GoPtr<IndexInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWidenedUniqueESSymbolType","kind":"method","status":"implemented","sigHash":"1d191915844a7e99e7d44502157031daa07217dbfa87fa010258fb789918077c","bodyHash":"8e6966d1ce1670fd41eff2bbab6fc437d81d5605c492f2bb906a909743be23bd"}
 *
 * Go source:
 * func (c *Checker) getWidenedUniqueESSymbolType(t *Type) *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsUniqueESSymbol != 0:
 * 		return c.esSymbolType
 * 	case t.flags&TypeFlagsUnion != 0:
 * 		return c.mapType(t, c.getWidenedUniqueESSymbolType)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getWidenedUniqueESSymbolType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mapTypeWithAlias","kind":"method","status":"implemented","sigHash":"dcc50abe737e3a81e86e993399803dd2c1e10b351f1bdb9e45d313165210b913","bodyHash":"a0df570959705ea62d29130b6698264e24decb6677d1b45f0f68ce4faa3c5375"}
 *
 * Go source:
 * func (c *Checker) mapTypeWithAlias(t *Type, f func(t *Type) *Type, alias *TypeAlias) *Type {
 * 	if t.flags&TypeFlagsUnion != 0 && alias != nil {
 * 		return c.getUnionTypeEx(core.Map(t.Types(), f), UnionReductionLiteral, alias, nil)
 * 	}
 * 	return c.mapType(t, f)
 * }
 */
export declare function Checker_mapTypeWithAlias(receiver: GoPtr<Checker>, t: GoPtr<Type>, f: (t: GoPtr<Type>) => GoPtr<Type>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addNamedUnions","kind":"method","status":"implemented","sigHash":"3ab295aaed5eae008f8f28ab10d4a204d780dab0f0ced738f5e8431b5aa27cb9","bodyHash":"6cbd79f328f463e6caef20bb4bc194f74ac464fa7ff6e44cce887582f696d1bc"}
 *
 * Go source:
 * func (c *Checker) addNamedUnions(namedUnions []*Type, types []*Type) []*Type {
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsUnion != 0 {
 * 			u := t.AsUnionType()
 * 			if t.alias != nil || u.origin != nil && u.origin.flags&TypeFlagsUnion == 0 {
 * 				namedUnions = core.AppendIfUnique(namedUnions, t)
 * 			} else if u.origin != nil && u.origin.flags&TypeFlagsUnion != 0 {
 * 				namedUnions = c.addNamedUnions(namedUnions, u.origin.Types())
 * 			}
 * 		}
 * 	}
 * 	return namedUnions
 * }
 */
export declare function Checker_addNamedUnions(receiver: GoPtr<Checker>, namedUnions: GoSlice<GoPtr<Type>>, types: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexType","kind":"method","status":"implemented","sigHash":"c12ea5203dcf2a1ece3f2781ba13bde13d532696dbc1d3085a2e5d23962869ff","bodyHash":"192b54ad7f8b4916679d2dc27101112846cc6d1e2e0f1a091f7295530d582d85"}
 *
 * Go source:
 * func (c *Checker) getIndexType(t *Type) *Type {
 * 	return c.getIndexTypeEx(t, IndexFlagsNone)
 * }
 */
export declare function Checker_getIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeEx","kind":"method","status":"implemented","sigHash":"96e3c993f080c3c25f46635fde0e3b3fa6f6eefa2cc0330339f3dcb0c7a4d7e6","bodyHash":"b08032aaf6c4d915655bfbbf202b9f2121aae8442ee40a14d62c10fef8f2038d"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeEx(t *Type, indexFlags IndexFlags) *Type {
 * 	t = c.getReducedType(t)
 * 	switch {
 * 	case c.isNoInferType(t):
 * 		return c.getNoInferType(c.getIndexTypeEx(t.AsSubstitutionType().baseType, indexFlags))
 * 	case c.shouldDeferIndexType(t, indexFlags):
 * 		return c.getIndexTypeForGenericType(t, indexFlags)
 * 	case t.flags&TypeFlagsUnion != 0:
 * 		return c.getIntersectionType(core.Map(t.Types(), func(t *Type) *Type { return c.getIndexTypeEx(t, indexFlags) }))
 * 	case t.flags&TypeFlagsIntersection != 0:
 * 		return c.getUnionType(core.Map(t.Types(), func(t *Type) *Type { return c.getIndexTypeEx(t, indexFlags) }))
 * 	case t.objectFlags&ObjectFlagsMapped != 0:
 * 		return c.getIndexTypeForMappedType(t, indexFlags)
 * 	case t == c.wildcardType:
 * 		return c.wildcardType
 * 	case t.flags&TypeFlagsUnknown != 0:
 * 		return c.neverType
 * 	case t.flags&(TypeFlagsAny|TypeFlagsNever) != 0:
 * 		return c.stringNumberSymbolType
 * 	}
 * 	include := core.IfElse(indexFlags&IndexFlagsNoIndexSignatures != 0, TypeFlagsStringLiteral, TypeFlagsStringLike) |
 * 		core.IfElse(indexFlags&IndexFlagsStringsOnly != 0, TypeFlagsNone, TypeFlagsNumberLike|TypeFlagsESSymbolLike)
 * 	return c.getLiteralTypeFromProperties(t, include, indexFlags == IndexFlagsNone)
 * }
 */
export declare function Checker_getIndexTypeEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, indexFlags: IndexFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLiteralTypeFromProperty","kind":"method","status":"implemented","sigHash":"90092bba2e3cdcdd451d77b48b85a319e41f7061cc85bbbd6dd0ecee5d08fd1c","bodyHash":"c9915292b16c49fc310316a1100b5184a23c3e2bf84adb41547135ca830ebaa0"}
 *
 * Go source:
 * func (c *Checker) getLiteralTypeFromProperty(prop *ast.Symbol, include TypeFlags, includeNonPublic bool) *Type {
 * 	if includeNonPublic || getDeclarationModifierFlagsFromSymbol(prop)&ast.ModifierFlagsNonPublicAccessibilityModifier == 0 {
 * 		t := c.valueSymbolLinks.Get(c.getLateBoundSymbol(prop)).nameType
 * 		if t == nil {
 * 			if prop.Name == ast.InternalSymbolNameDefault {
 * 				t = c.getStringLiteralType("default")
 * 			} else {
 * 				name := ast.GetNameOfDeclaration(prop.ValueDeclaration)
 * 				if name != nil {
 * 					t = c.getLiteralTypeFromPropertyName(name)
 * 				}
 * 				if t == nil && !IsKnownSymbol(prop) {
 * 					t = c.getStringLiteralType(ast.SymbolName(prop))
 * 				}
 * 			}
 * 		}
 * 		if t != nil && t.flags&include != 0 {
 * 			return t
 * 		}
 * 	}
 * 	return c.neverType
 * }
 */
export declare function Checker_getLiteralTypeFromProperty(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, include: TypeFlags, includeNonPublic: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLiteralTypeFromPropertyName","kind":"method","status":"implemented","sigHash":"6c6cddead0617e979e94e83a2499720bc121d0684f746d8080d78ceacf48335b","bodyHash":"18ea88d0e909861237dda8493b87d64bab7c9455b23ff565184004715f08840d"}
 *
 * Go source:
 * func (c *Checker) getLiteralTypeFromPropertyName(name *ast.Node) *Type {
 * 	if ast.IsPrivateIdentifier(name) {
 * 		return c.neverType
 * 	}
 * 	if ast.IsNumericLiteral(name) {
 * 		return c.getRegularTypeOfLiteralType(c.checkExpression(name))
 * 	}
 * 	if ast.IsComputedPropertyName(name) {
 * 		return c.getRegularTypeOfLiteralType(c.checkComputedPropertyName(name))
 * 	}
 * 	propertyName := ast.GetPropertyNameForPropertyNameNode(name)
 * 	if propertyName != ast.InternalSymbolNameMissing {
 * 		return c.getStringLiteralType(propertyName)
 * 	}
 * 	if ast.IsExpression(name) {
 * 		return c.getRegularTypeOfLiteralType(c.checkExpression(name))
 * 	}
 * 	return c.neverType
 * }
 */
export declare function Checker_getLiteralTypeFromPropertyName(receiver: GoPtr<Checker>, name: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkComputedPropertyName","kind":"method","status":"implemented","sigHash":"8137dd8c29bf59776751c442efc53aa7021c5f592cde61b772fb7e2755d2907c","bodyHash":"eb848dd2289cdc4f108329a434938a043f929fb26c1994e96b1aa4a4e4d24f1f"}
 *
 * Go source:
 * func (c *Checker) checkComputedPropertyName(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node.Expression())
 * 	if links.resolvedType == nil {
 * 		if (ast.IsTypeLiteralNode(node.Parent.Parent) || ast.IsClassLike(node.Parent.Parent) || ast.IsInterfaceDeclaration(node.Parent.Parent)) &&
 * 			ast.IsBinaryExpression(node.Expression()) && node.Expression().AsBinaryExpression().OperatorToken.Kind == ast.KindInKeyword &&
 * 			!ast.IsAccessor(node.Parent) {
 * 			links.resolvedType = c.errorType
 * 			return links.resolvedType
 * 		}
 * 		links.resolvedType = c.checkExpression(node.Expression())
 * 		// This will allow types number, string, symbol or any. It will also allow enums, the unknown
 * 		// type, and any union of these types (like string | number).
 * 		if links.resolvedType.flags&TypeFlagsNullable != 0 ||
 * 			!c.isTypeAssignableToKind(links.resolvedType, TypeFlagsStringLike|TypeFlagsNumberLike|TypeFlagsESSymbolLike) &&
 * 				!c.isTypeAssignableTo(links.resolvedType, c.stringNumberSymbolType) {
 * 			c.error(node, diagnostics.A_computed_property_name_must_be_of_type_string_number_symbol_or_any)
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_checkComputedPropertyName(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.shouldDeferIndexType","kind":"method","status":"implemented","sigHash":"6e86482371497557029a04e80235f0e863f40d57050a4d8e8b57ffebfc2e24b5","bodyHash":"7d1650e4f908a15bb4e7acf0242650421f786b2befffc42e2f56cb8921b74eab"}
 *
 * Go source:
 * func (c *Checker) shouldDeferIndexType(t *Type, indexFlags IndexFlags) bool {
 * 	return t.flags&TypeFlagsInstantiableNonPrimitive != 0 ||
 * 		c.isGenericTupleType(t) ||
 * 		c.isGenericMappedType(t) && c.getNameTypeFromMappedType(t) != nil ||
 * 		t.flags&TypeFlagsUnion != 0 && indexFlags&IndexFlagsNoReducibleCheck == 0 && c.isGenericReducibleType(t) ||
 * 		t.flags&TypeFlagsIntersection != 0 && c.maybeTypeOfKind(t, TypeFlagsInstantiable) && core.Some(t.Types(), c.IsEmptyAnonymousObjectType)
 * }
 */
export declare function Checker_shouldDeferIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>, indexFlags: IndexFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getMappedTypeNameTypeKind","kind":"method","status":"implemented","sigHash":"8316472368c8cbd1bdfa53683e005a9bfc06567c92edeb5c35c6b1eac4468b75","bodyHash":"877365754d5f10a241ca5bb601c1b821418bb18fbfa4a3f18d7ca7522a0d2fae"}
 *
 * Go source:
 * func (c *Checker) getMappedTypeNameTypeKind(t *Type) MappedTypeNameTypeKind {
 * 	nameType := c.getNameTypeFromMappedType(t)
 * 	if nameType == nil {
 * 		return MappedTypeNameTypeKindNone
 * 	}
 * 	if c.isTypeAssignableTo(nameType, c.getTypeParameterFromMappedType(t)) {
 * 		return MappedTypeNameTypeKindFiltering
 * 	}
 * 	return MappedTypeNameTypeKindRemapping
 * }
 */
export declare function Checker_getMappedTypeNameTypeKind(receiver: GoPtr<Checker>, t: GoPtr<Type>): MappedTypeNameTypeKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeForGenericType","kind":"method","status":"implemented","sigHash":"922bc7791644de03e741e0a0ec1ab77faf64f62afcbf398a830971f3d089122c","bodyHash":"4c93768a1970c75cc3636ca5dd9c791e6876d47cf0a66dcdbd177375da77f7ff"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeForGenericType(t *Type, indexFlags IndexFlags) *Type {
 * 	key := CachedTypeKey{
 * 		kind:   core.IfElse(indexFlags&IndexFlagsStringsOnly != 0, CachedTypeKindStringIndexType, CachedTypeKindIndexType),
 * 		typeId: t.id,
 * 	}
 * 	if indexType := c.cachedTypes[key]; indexType != nil {
 * 		return indexType
 * 	}
 * 	indexType := c.newIndexType(t, indexFlags&IndexFlagsStringsOnly)
 * 	c.cachedTypes[key] = indexType
 * 	return indexType
 * }
 */
export declare function Checker_getIndexTypeForGenericType(receiver: GoPtr<Checker>, t: GoPtr<Type>, indexFlags: IndexFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexTypeForMappedType","kind":"method","status":"implemented","sigHash":"f96f7790b057a236fba74493980df47dbe5d41a23b7646cd1dfb6ef449fe48df","bodyHash":"48d1989400135f4595aeee4a7cfd8a195e8da956729fa7b120f3172560d1aeea"}
 *
 * Go source:
 * func (c *Checker) getIndexTypeForMappedType(t *Type, indexFlags IndexFlags) *Type {
 * 	typeParameter := c.getTypeParameterFromMappedType(t)
 * 	constraintType := c.getConstraintTypeFromMappedType(t)
 * 	nameType := c.getNameTypeFromMappedType(core.OrElse(t.AsMappedType().target, t))
 * 	if nameType == nil && indexFlags&IndexFlagsNoIndexSignatures == 0 {
 * 		// no mapping and no filtering required, just quickly bail to returning the constraint in the common case
 * 		return constraintType
 * 	}
 * 	var keyTypes []*Type
 * 	addMemberForKeyType := func(keyType *Type) {
 * 		propNameType := keyType
 * 		if nameType != nil {
 * 			propNameType = c.instantiateType(nameType, appendTypeMapping(t.AsMappedType().mapper, typeParameter, keyType))
 * 		}
 * 		// `keyof` currently always returns `string | number` for concrete `string` index signatures - the below ternary keeps that behavior for mapped types
 * 		// See `getLiteralTypeFromProperties` where there's a similar ternary to cause the same behavior.
 * 		keyTypes = append(keyTypes, core.IfElse(propNameType == c.stringType, c.stringOrNumberType, propNameType))
 * 	}
 * 	// Calling getApparentType on the `T` of a `keyof T` in the constraint type of a generic mapped type can
 * 	// trigger a circularity. For example, `T extends { [P in keyof T & string as Captitalize<P>]: any }` is
 * 	// a circular definition. For this reason, we only eagerly manifest the keys if the constraint is non-generic.
 * 	if c.isGenericIndexType(constraintType) {
 * 		if c.isMappedTypeWithKeyofConstraintDeclaration(t) {
 * 			// We have a generic index and a homomorphic mapping and a key remapping - we need to defer
 * 			// the whole `keyof whatever` for later since it's not safe to resolve the shape of modifier type.
 * 			return c.getIndexTypeForGenericType(t, indexFlags)
 * 		}
 * 		// Include the generic component in the resulting type.
 * 		forEachType(constraintType, addMemberForKeyType)
 * 	} else if c.isMappedTypeWithKeyofConstraintDeclaration(t) {
 * 		modifiersType := c.getApparentType(c.getModifiersTypeFromMappedType(t))
 * 		// The 'T' in 'keyof T'
 * 		c.forEachMappedTypePropertyKeyTypeAndIndexSignatureKeyType(modifiersType, TypeFlagsStringOrNumberLiteralOrUnique, indexFlags&IndexFlagsStringsOnly != 0, addMemberForKeyType)
 * 	} else {
 * 		forEachType(c.getLowerBoundOfKeyType(constraintType), addMemberForKeyType)
 * 	}
 * 	// We had to pick apart the constraintType to potentially map/filter it - compare the final resulting list with the
 * 	// original constraintType, so we can return the union that preserves aliases/origin data if possible.
 * 	var result *Type
 * 	if indexFlags&IndexFlagsNoIndexSignatures != 0 {
 * 		result = c.filterType(c.getUnionType(keyTypes), func(t *Type) bool {
 * 			return t.flags&(TypeFlagsAny|TypeFlagsString) == 0
 * 		})
 * 	} else {
 * 		result = c.getUnionType(keyTypes)
 * 	}
 * 	if result.flags&TypeFlagsUnion != 0 && constraintType.flags&TypeFlagsUnion != 0 && getTypeListKey(result.Types()) == getTypeListKey(constraintType.Types()) {
 * 		return constraintType
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getIndexTypeForMappedType(receiver: GoPtr<Checker>, t: GoPtr<Type>, indexFlags: IndexFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexedAccessType","kind":"method","status":"implemented","sigHash":"8e1f1ba90a111d0046f3c0e55bca49d754abf41de1b2128482457a81addd4fb0","bodyHash":"35f5b12b6dc7b389c3aaf80d84d4a84817cda375cb9ad5011431521b5292ecd5"}
 *
 * Go source:
 * func (c *Checker) getIndexedAccessType(objectType *Type, indexType *Type) *Type {
 * 	return c.getIndexedAccessTypeEx(objectType, indexType, AccessFlagsNone, nil, nil)
 * }
 */
export declare function Checker_getIndexedAccessType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexedAccessTypeEx","kind":"method","status":"implemented","sigHash":"32894fcb9a096bfc5849f0873f8355423ac6b3f55c00fff04ba665ea565493a6","bodyHash":"8db2a59c3289f53029aa74c5bec1a50bbc57e1bdf16fc35732164148b0f6b55d"}
 *
 * Go source:
 * func (c *Checker) getIndexedAccessTypeEx(objectType *Type, indexType *Type, accessFlags AccessFlags, accessNode *ast.Node, alias *TypeAlias) *Type {
 * 	result := c.getIndexedAccessTypeOrUndefined(objectType, indexType, accessFlags, accessNode, alias)
 * 	if result == nil {
 * 		result = core.IfElse(accessNode != nil, c.errorType, c.unknownType)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getIndexedAccessTypeEx(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, accessFlags: AccessFlags, accessNode: GoPtr<Node>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexedAccessTypeOrUndefined","kind":"method","status":"implemented","sigHash":"d3713965735851a9deab87bfb2f9295d6712e67d34c160acab1e88fc8a1a0112","bodyHash":"67cdcb10f24bb41623761bc86627a1638cf3dc86c0448b17d465669ebc7aa244"}
 *
 * Go source:
 * func (c *Checker) getIndexedAccessTypeOrUndefined(objectType *Type, indexType *Type, accessFlags AccessFlags, accessNode *ast.Node, alias *TypeAlias) *Type {
 * 	if objectType == c.wildcardType || indexType == c.wildcardType {
 * 		return c.wildcardType
 * 	}
 * 	objectType = c.getReducedType(objectType)
 * 	// If the object type has a string index signature and no other members we know that the result will
 * 	// always be the type of that index signature and we can simplify accordingly.
 * 	if c.isStringIndexSignatureOnlyType(objectType) && indexType.flags&TypeFlagsNullable == 0 && c.isTypeAssignableToKind(indexType, TypeFlagsString|TypeFlagsNumber) {
 * 		indexType = c.stringType
 * 	}
 * 	// In noUncheckedIndexedAccess mode, indexed access operations that occur in an expression in a read position and resolve to
 * 	// an index signature have 'undefined' included in their type.
 * 	if c.compilerOptions.NoUncheckedIndexedAccess == core.TSTrue && accessFlags&AccessFlagsExpressionPosition != 0 {
 * 		accessFlags |= AccessFlagsIncludeUndefined
 * 	}
 * 	// If the index type is generic, or if the object type is generic and doesn't originate in an expression and
 * 	// the operation isn't exclusively indexing the fixed (non-variadic) portion of a tuple type, we are performing
 * 	// a higher-order index access where we cannot meaningfully access the properties of the object type. Note that
 * 	// for a generic T and a non-generic K, we eagerly resolve T[K] if it originates in an expression. This is to
 * 	// preserve backwards compatibility. For example, an element access 'this["foo"]' has always been resolved
 * 	// eagerly using the constraint type of 'this' at the given location.
 * 	if c.shouldDeferIndexedAccessType(objectType, indexType, accessNode) {
 * 		if objectType.flags&TypeFlagsAnyOrUnknown != 0 {
 * 			return objectType
 * 		}
 * 		// Defer the operation by creating an indexed access type.
 * 		persistentAccessFlags := accessFlags & AccessFlagsPersistent
 * 		key := getIndexedAccessKey(objectType, indexType, accessFlags, alias)
 * 		t := c.indexedAccessTypes[key]
 * 		if t == nil {
 * 			t = c.newIndexedAccessType(objectType, indexType, persistentAccessFlags)
 * 			t.alias = alias
 * 			c.indexedAccessTypes[key] = t
 * 		}
 * 		return t
 * 	}
 * 	// In the following we resolve T[K] to the type of the property in T selected by K.
 * 	// We treat boolean as different from other unions to improve errors;
 * 	// skipping straight to getPropertyTypeForIndexType gives errors with 'boolean' instead of 'true'.
 * 	apparentObjectType := c.getReducedApparentType(objectType)
 * 	if indexType.flags&TypeFlagsUnion != 0 && indexType.flags&TypeFlagsBoolean == 0 {
 * 		var propTypes []*Type
 * 		wasMissingProp := false
 * 		for _, t := range indexType.Types() {
 * 			propType := c.getPropertyTypeForIndexType(objectType, apparentObjectType, t, indexType, accessNode, accessFlags|core.IfElse(wasMissingProp, AccessFlagsSuppressNoImplicitAnyError, 0))
 * 			if propType != nil {
 * 				propTypes = append(propTypes, propType)
 * 			} else if accessNode == nil {
 * 				// If there's no error node, we can immediately stop, since error reporting is off
 * 				return nil
 * 			} else {
 * 				// Otherwise we set a flag and return at the end of the loop so we still mark all errors
 * 				wasMissingProp = true
 * 			}
 * 		}
 * 		if wasMissingProp {
 * 			return nil
 * 		}
 * 		if accessFlags&AccessFlagsWriting != 0 {
 * 			return c.getIntersectionTypeEx(propTypes, IntersectionFlagsNone, alias)
 * 		}
 * 		return c.getUnionTypeEx(propTypes, UnionReductionLiteral, alias, nil)
 * 	}
 * 	return c.getPropertyTypeForIndexType(objectType, apparentObjectType, indexType, indexType, accessNode, accessFlags|AccessFlagsCacheSymbol|AccessFlagsReportDeprecated)
 * }
 */
export declare function Checker_getIndexedAccessTypeOrUndefined(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, accessFlags: AccessFlags, accessNode: GoPtr<Node>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyTypeForIndexType","kind":"method","status":"implemented","sigHash":"b165e26df1bd4167798c456fec8881582ad4a6c35f9d23dd470b4c9da80f6f58","bodyHash":"78ac5563270df952a0013017c2c289f27c217028281aef86cf17062c9ee47126"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"When TS-Go selects an index signature for element access, extension-selected evidence needs the same resolved-symbol cache that TS-Go already creates for public symbol queries."}
 *
 * Go source:
 * func (c *Checker) getPropertyTypeForIndexType(originalObjectType *Type, objectType *Type, indexType *Type, fullIndexType *Type, accessNode *ast.Node, accessFlags AccessFlags) *Type {
 * 	var accessExpression *ast.Node
 * 	if accessNode != nil && ast.IsElementAccessExpression(accessNode) {
 * 		accessExpression = accessNode
 * 	}
 * 	var propName string
 * 	var hasPropName bool
 * 	if !(accessNode != nil && ast.IsPrivateIdentifier(accessNode)) {
 * 		propName = c.getPropertyNameFromIndex(indexType, accessNode)
 * 		hasPropName = propName != ast.InternalSymbolNameMissing
 * 	}
 * 	if hasPropName {
 * 		if accessFlags&AccessFlagsContextual != 0 {
 * 			t := c.getTypeOfPropertyOfContextualType(objectType, propName)
 * 			if t == nil {
 * 				t = c.anyType
 * 			}
 * 			return t
 * 		}
 * 		prop := c.getPropertyOfType(objectType, propName)
 * 		if prop != nil {
 * 			if accessFlags&AccessFlagsReportDeprecated != 0 && accessNode != nil && len(prop.Declarations) != 0 && c.isDeprecatedSymbol(prop) && c.isUncalledFunctionReference(accessNode, prop) {
 * 				var deprecatedNode *ast.Node
 * 				if accessExpression != nil {
 * 					deprecatedNode = accessExpression.AsElementAccessExpression().ArgumentExpression
 * 				} else if ast.IsIndexedAccessTypeNode(accessNode) {
 * 					deprecatedNode = accessNode.AsIndexedAccessTypeNode().IndexType
 * 				} else {
 * 					deprecatedNode = accessNode
 * 				}
 * 				c.addDeprecatedSuggestion(deprecatedNode, prop.Declarations, propName)
 * 			}
 * 			if accessExpression != nil {
 * 				c.markPropertyAsReferenced(prop, accessExpression, c.isSelfTypeAccess(accessExpression.Expression(), objectType.symbol))
 * 				if c.isAssignmentToReadonlyEntity(accessExpression, prop, getAssignmentTargetKind(accessExpression)) {
 * 					c.error(accessExpression.AsElementAccessExpression().ArgumentExpression, diagnostics.Cannot_assign_to_0_because_it_is_a_read_only_property, c.symbolToString(prop))
 * 					return nil
 * 				}
 * 				if accessFlags&AccessFlagsCacheSymbol != 0 {
 * 					c.symbolNodeLinks.Get(accessNode).resolvedSymbol = prop
 * 				}
 * 				if c.isThisPropertyAccessInConstructor(accessExpression, prop) {
 * 					return c.autoType
 * 				}
 * 			}
 * 			var propType *Type
 * 			if accessFlags&AccessFlagsWriting != 0 {
 * 				propType = c.getWriteTypeOfSymbol(prop)
 * 			} else {
 * 				propType = c.getTypeOfSymbol(prop)
 * 			}
 * 			switch {
 * 			case accessExpression != nil && getAssignmentTargetKind(accessExpression) != AssignmentKindDefinite:
 * 				return c.getFlowTypeOfReference(accessExpression, propType)
 * 			case accessNode != nil && ast.IsIndexedAccessTypeNode(accessNode) && c.containsMissingType(propType):
 * 				return c.getUnionType([]*Type{propType, c.undefinedType})
 * 			default:
 * 				return propType
 * 			}
 * 		}
 * 		if everyType(objectType, isTupleType) && isNumericLiteralName(propName) {
 * 			index := jsnum.FromString(propName)
 * 			if accessNode != nil && everyType(objectType, func(t *Type) bool {
 * 				return t.TargetTupleType().combinedFlags&ElementFlagsVariable == 0
 * 			}) && accessFlags&AccessFlagsAllowMissing == 0 {
 * 				indexNode := getIndexNodeForAccessExpression(accessNode)
 * 				if isTupleType(objectType) {
 * 					if index < 0 {
 * 						c.error(indexNode, diagnostics.A_tuple_type_cannot_be_indexed_with_a_negative_value)
 * 						return c.undefinedType
 * 					}
 * 					c.error(indexNode, diagnostics.Tuple_type_0_of_length_1_has_no_element_at_index_2, c.TypeToString(objectType), c.getTypeReferenceArity(objectType), propName)
 * 				} else {
 * 					c.error(indexNode, diagnostics.Property_0_does_not_exist_on_type_1, propName, c.TypeToString(objectType))
 * 				}
 * 			}
 * 			if index >= 0 {
 * 				c.errorIfWritingToReadonlyIndex(c.getIndexInfoOfType(objectType, c.numberType), objectType, accessExpression)
 * 				return c.getTupleElementTypeOutOfStartCount(objectType, index, core.IfElse(accessFlags&AccessFlagsIncludeUndefined != 0, c.missingType, nil))
 * 			}
 * 		}
 * 	}
 * 	if indexType.flags&TypeFlagsNullable == 0 && c.isTypeAssignableToKind(indexType, TypeFlagsStringLike|TypeFlagsNumberLike|TypeFlagsESSymbolLike) {
 * 		if objectType.flags&(TypeFlagsAny|TypeFlagsNever) != 0 {
 * 			return objectType
 * 		}
 * 		// If no index signature is applicable, we default to the string index signature. In effect, this means the string
 * 		// index signature applies even when accessing with a symbol-like type.
 * 		indexInfo := c.getApplicableIndexInfo(objectType, indexType)
 * 		if indexInfo == nil {
 * 			indexInfo = c.getIndexInfoOfType(objectType, c.stringType)
 * 		}
 * 		if indexInfo != nil {
 * 			if accessFlags&AccessFlagsNoIndexSignatures != 0 && indexInfo.keyType != c.numberType {
 * 				if accessExpression != nil {
 * 					if accessFlags&AccessFlagsWriting != 0 {
 * 						c.error(accessExpression, diagnostics.Type_0_is_generic_and_can_only_be_indexed_for_reading, c.TypeToString(originalObjectType))
 * 					} else {
 * 						c.error(accessExpression, diagnostics.Type_0_cannot_be_used_to_index_type_1, c.TypeToString(indexType), c.TypeToString(originalObjectType))
 * 					}
 * 				}
 * 				return nil
 * 			}
 * 			if accessNode != nil && indexInfo.keyType == c.stringType && !c.isTypeAssignableToKind(indexType, TypeFlagsString|TypeFlagsNumber) {
 * 				indexNode := getIndexNodeForAccessExpression(accessNode)
 * 				c.error(indexNode, diagnostics.Type_0_cannot_be_used_as_an_index_type, c.TypeToString(indexType))
 * 				if accessFlags&AccessFlagsIncludeUndefined != 0 {
 * 					return c.getUnionType([]*Type{indexInfo.valueType, c.missingType})
 * 				} else {
 * 					return indexInfo.valueType
 * 				}
 * 			}
 * 			c.errorIfWritingToReadonlyIndex(indexInfo, objectType, accessExpression)
 * 			// When accessing an enum object with its own type,
 * 			// e.g. E[E.A] for enum E { A }, undefined shouldn't
 * 			// be included in the result type
 * 			if accessFlags&AccessFlagsIncludeUndefined != 0 &&
 * 				!(objectType.symbol != nil &&
 * 					objectType.symbol.Flags&(ast.SymbolFlagsRegularEnum|ast.SymbolFlagsConstEnum) != 0 &&
 * 					(indexType.symbol != nil &&
 * 						indexType.flags&TypeFlagsEnumLiteral != 0 &&
 * 						c.getParentOfSymbol(indexType.symbol) == objectType.symbol)) {
 * 				return c.getUnionType([]*Type{indexInfo.valueType, c.missingType})
 * 			}
 * 			return indexInfo.valueType
 * 		}
 * 		if indexType.flags&TypeFlagsNever != 0 {
 * 			return c.neverType
 * 		}
 * 		if c.isJSLiteralType(objectType) {
 * 			return c.anyType
 * 		}
 * 		if accessExpression != nil && !isConstEnumObjectType(objectType) {
 * 			if isObjectLiteralType(objectType) {
 * 				if c.noImplicitAny && indexType.flags&(TypeFlagsStringLiteral|TypeFlagsNumberLiteral) != 0 {
 * 					c.addDiagnostic(createDiagnosticForNode(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, indexType.AsLiteralType().value, c.TypeToString(objectType)))
 * 					return c.undefinedType
 * 				} else if indexType.flags&(TypeFlagsNumber|TypeFlagsString) != 0 {
 * 					types := core.Map(objectType.AsStructuredType().properties, func(prop *ast.Symbol) *Type {
 * 						return c.getTypeOfSymbol(prop)
 * 					})
 * 					return c.getUnionType(append(types, c.undefinedType))
 * 				}
 * 			}
 * 			if objectType.symbol == c.globalThisSymbol && hasPropName && c.globalThisSymbol.Exports[propName] != nil && c.globalThisSymbol.Exports[propName].Flags&ast.SymbolFlagsBlockScoped != 0 {
 * 				c.error(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, propName, c.TypeToString(objectType))
 * 			} else if c.noImplicitAny && accessFlags&AccessFlagsSuppressNoImplicitAnyError == 0 {
 * 				if hasPropName && c.typeHasStaticProperty(propName, objectType) {
 * 					typeName := c.TypeToString(objectType)
 * 					c.error(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_to_access_the_static_member_2_instead, propName /* as string * /, typeName, typeName+"["+scanner.GetTextOfNode(accessExpression.AsElementAccessExpression().ArgumentExpression)+"]")
 * 				} else if c.getIndexTypeOfType(objectType, c.numberType) != nil {
 * 					c.error(accessExpression.AsElementAccessExpression().ArgumentExpression, diagnostics.Element_implicitly_has_an_any_type_because_index_expression_is_not_of_type_number)
 * 				} else {
 * 					var suggestion string
 * 					if hasPropName {
 * 						suggestion = c.getSuggestionForNonexistentProperty(propName, objectType)
 * 					}
 * 					if suggestion != "" {
 * 						c.error(accessExpression.AsElementAccessExpression().ArgumentExpression, diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2, propName /* as string * /, c.TypeToString(objectType), suggestion)
 * 					} else {
 * 						suggestion = c.getSuggestionForNonexistentIndexSignature(objectType, accessExpression, indexType)
 * 						if suggestion != "" {
 * 							c.error(accessExpression, diagnostics.Element_implicitly_has_an_any_type_because_type_0_has_no_index_signature_Did_you_mean_to_call_1, c.TypeToString(objectType), suggestion)
 * 						} else {
 * 							var diagnostic *ast.Diagnostic
 * 							switch {
 * 							case indexType.flags&TypeFlagsEnumLiteral != 0:
 * 								diagnostic = NewDiagnosticForNode(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, "["+c.TypeToString(indexType)+"]", c.TypeToString(objectType))
 * 							case indexType.flags&TypeFlagsUniqueESSymbol != 0:
 * 								symbolName := c.getFullyQualifiedName(indexType.symbol, accessExpression)
 * 								diagnostic = NewDiagnosticForNode(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, "["+symbolName+"]", c.TypeToString(objectType))
 * 							case indexType.flags&TypeFlagsStringLiteral != 0:
 * 								diagnostic = NewDiagnosticForNode(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, indexType.AsLiteralType().value, c.TypeToString(objectType))
 * 							case indexType.flags&TypeFlagsNumberLiteral != 0:
 * 								diagnostic = NewDiagnosticForNode(accessExpression, diagnostics.Property_0_does_not_exist_on_type_1, indexType.AsLiteralType().value, c.TypeToString(objectType))
 * 							case indexType.flags&(TypeFlagsNumber|TypeFlagsString) != 0:
 * 								diagnostic = NewDiagnosticForNode(accessExpression, diagnostics.No_index_signature_with_a_parameter_of_type_0_was_found_on_type_1, c.TypeToString(indexType), c.TypeToString(objectType))
 * 							}
 * 							c.addDiagnostic(NewDiagnosticChainForNode(diagnostic, accessExpression, diagnostics.Element_implicitly_has_an_any_type_because_expression_of_type_0_can_t_be_used_to_index_type_1, c.TypeToString(fullIndexType), c.TypeToString(objectType)))
 * 						}
 * 					}
 * 				}
 * 			}
 * 			return nil
 * 		}
 * 	}
 * 	if accessFlags&AccessFlagsAllowMissing != 0 && isObjectLiteralType(objectType) {
 * 		return c.undefinedType
 * 	}
 * 	if c.isJSLiteralType(objectType) {
 * 		return c.anyType
 * 	}
 * 	if accessNode != nil {
 * 		indexNode := getIndexNodeForAccessExpression(accessNode)
 * 		if indexNode.Kind != ast.KindBigIntLiteral && indexType.flags&(TypeFlagsStringLiteral|TypeFlagsNumberLiteral) != 0 {
 * 			c.error(indexNode, diagnostics.Property_0_does_not_exist_on_type_1, indexType.AsLiteralType().value, c.TypeToString(objectType))
 * 		} else if indexType.flags&(TypeFlagsString|TypeFlagsNumber) != 0 {
 * 			c.error(indexNode, diagnostics.Type_0_has_no_matching_index_signature_for_type_1, c.TypeToString(objectType), c.TypeToString(indexType))
 * 		} else {
 * 			var typeString string
 * 			if indexNode.Kind == ast.KindBigIntLiteral {
 * 				typeString = "bigint"
 * 			} else {
 * 				typeString = c.TypeToString(indexType)
 * 			}
 * 			c.error(indexNode, diagnostics.Type_0_cannot_be_used_as_an_index_type, typeString)
 * 		}
 * 	}
 * 	if IsTypeAny(indexType) {
 * 		return indexType
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getPropertyTypeForIndexType(receiver: GoPtr<Checker>, originalObjectType: GoPtr<Type>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, fullIndexType: GoPtr<Type>, accessNode: GoPtr<Node>, accessFlags: AccessFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.typeHasStaticProperty","kind":"method","status":"implemented","sigHash":"0abb127ac6acdd3eb73f1d9cadd85a1657080c9094f49a03f8676767003d1373","bodyHash":"b34383b42643a1e29df78ae3838f9ce193aaf63b8a7e3c1e5c8bc114518fd84a"}
 *
 * Go source:
 * func (c *Checker) typeHasStaticProperty(propName string, containingType *Type) bool {
 * 	if containingType.symbol != nil {
 * 		prop := c.getPropertyOfType(c.getTypeOfSymbol(containingType.symbol), propName)
 * 		return prop != nil && prop.ValueDeclaration != nil && ast.IsStatic(prop.ValueDeclaration)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_typeHasStaticProperty(receiver: GoPtr<Checker>, propName: string, containingType: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestionForNonexistentProperty","kind":"method","status":"implemented","sigHash":"35712dc49e0495257beccba9f642a7607e3c54a753930e22e77d79683fe129b2","bodyHash":"47b578aeacf7b3ef9726f0070978c2058a291485999826e9362fc4a2c7c79519"}
 *
 * Go source:
 * func (c *Checker) getSuggestionForNonexistentProperty(name string, containingType *Type) string {
 * 	symbol := c.getSpellingSuggestionForName(name, slices.Values(c.getPropertiesOfType(containingType)), ast.SymbolFlagsValue)
 * 	if symbol != nil {
 * 		return symbol.Name
 * 	}
 * 	return ""
 * }
 */
export declare function Checker_getSuggestionForNonexistentProperty(receiver: GoPtr<Checker>, name: string, containingType: GoPtr<Type>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorIfWritingToReadonlyIndex","kind":"method","status":"implemented","sigHash":"5689e1466af31f3a0794cac1d7bbe1820f4415edd0bc6b498be3c7d8e54c5251","bodyHash":"29c2e07dae073293e1e7aad4a208749b481e16933a8f98c0185de05838469cb6"}
 *
 * Go source:
 * func (c *Checker) errorIfWritingToReadonlyIndex(indexInfo *IndexInfo, objectType *Type, accessExpression *ast.Node) {
 * 	if indexInfo != nil && indexInfo.isReadonly && accessExpression != nil && (ast.IsAssignmentTarget(accessExpression) || isDeleteTarget(accessExpression)) {
 * 		c.error(accessExpression, diagnostics.Index_signature_in_type_0_only_permits_reading, c.TypeToString(objectType))
 * 	}
 * }
 */
export declare function Checker_errorIfWritingToReadonlyIndex(receiver: GoPtr<Checker>, indexInfo: GoPtr<IndexInfo>, objectType: GoPtr<Type>, accessExpression: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isAutoTypedProperty","kind":"method","status":"implemented","sigHash":"ed3f9f21258ab36d766e4b8de68cc0678352cdd90a78822306fdb01a8200429f","bodyHash":"8e160f7ad19f84d21f777aff39cd764b43fd0a2167333610f0e1ca456f7d3c51"}
 *
 * Go source:
 * func (c *Checker) isAutoTypedProperty(symbol *ast.Symbol) bool {
 * 	// A property is auto-typed when its declaration has no type annotation or initializer and we're in
 * 	// noImplicitAny mode or a .js file.
 * 	declaration := symbol.ValueDeclaration
 * 	return declaration != nil && ast.IsPropertyDeclaration(declaration) && declaration.Type() == nil && declaration.Initializer() == nil && c.noImplicitAny
 * }
 */
export declare function Checker_isAutoTypedProperty(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertyNameFromIndex","kind":"method","status":"implemented","sigHash":"7123b7f7b7e9f050e8c7904402520238ef9e93a98d609915bf20bcb234e304ce","bodyHash":"f3ffedca47202dacc0fdc4983aa8ed90d64a9bff0a130c8c06560b522ad56613"}
 *
 * Go source:
 * func (c *Checker) getPropertyNameFromIndex(indexType *Type, accessNode *ast.Node) string {
 * 	if isTypeUsableAsPropertyName(indexType) {
 * 		return getPropertyNameFromType(indexType)
 * 	}
 * 	if accessNode != nil && ast.IsPropertyName(accessNode) {
 * 		return ast.GetPropertyNameForPropertyNameNode(accessNode)
 * 	}
 * 	return ast.InternalSymbolNameMissing
 * }
 */
export declare function Checker_getPropertyNameFromIndex(receiver: GoPtr<Checker>, indexType: GoPtr<Type>, accessNode: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.shouldDeferIndexedAccessType","kind":"method","status":"implemented","sigHash":"6ccd4c062999b6a5ea874cf294df55cdd54ca8f2ca46943119b3e90a5a055755","bodyHash":"f0a98711f5c0195e476a5d94d278b2940bde4cc1f21c40d4884f44229cbeaaa9"}
 *
 * Go source:
 * func (c *Checker) shouldDeferIndexedAccessType(objectType *Type, indexType *Type, accessNode *ast.Node) bool {
 * 	if c.isGenericIndexType(indexType) {
 * 		return true
 * 	}
 * 	if accessNode != nil && !ast.IsIndexedAccessTypeNode(accessNode) {
 * 		return c.isGenericTupleType(objectType) && !indexTypeLessThan(indexType, getTotalFixedElementCount(objectType.TargetTupleType()))
 * 	}
 * 	return c.isGenericObjectType(objectType) && !(isTupleType(objectType) && indexTypeLessThan(indexType, getTotalFixedElementCount(objectType.TargetTupleType()))) ||
 * 		c.isGenericReducibleType(objectType)
 * }
 */
export declare function Checker_shouldDeferIndexedAccessType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, accessNode: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markPropertyAsReferenced","kind":"method","status":"implemented","sigHash":"0640385aac63311df4eeda79ceb980efb92c22470e150b81933c4edc8262a6ad","bodyHash":"5b2380b9892f55d40ff07eefe2d9c2e483c6fbba03d47f4f97af5840b32896d9"}
 *
 * Go source:
 * func (c *Checker) markPropertyAsReferenced(prop *ast.Symbol, nodeForCheckWriteOnly *ast.Node, isSelfTypeAccess bool) {
 * 	if prop.Flags&ast.SymbolFlagsClassMember == 0 || prop.ValueDeclaration == nil {
 * 		return
 * 	}
 * 	hasPrivateModifier := ast.HasModifier(prop.ValueDeclaration, ast.ModifierFlagsPrivate)
 * 	hasPrivateIdentifier := prop.ValueDeclaration.Name() != nil && ast.IsPrivateIdentifier(prop.ValueDeclaration.Name())
 * 	if !hasPrivateModifier && !hasPrivateIdentifier {
 * 		return
 * 	}
 * 	if nodeForCheckWriteOnly != nil && ast.IsWriteOnlyAccess(nodeForCheckWriteOnly) && prop.Flags&ast.SymbolFlagsSetAccessor == 0 {
 * 		return
 * 	}
 * 	if isSelfTypeAccess {
 * 		// Find any FunctionLikeDeclaration because those create a new 'this' binding. But this should only matter for methods (or getters/setters).
 * 		containingMethod := ast.FindAncestor(nodeForCheckWriteOnly, ast.IsFunctionLikeDeclaration)
 * 		if containingMethod != nil && containingMethod.Symbol() == prop {
 * 			return
 * 		}
 * 	}
 * 	target := prop
 * 	if prop.CheckFlags&ast.CheckFlagsInstantiated != 0 {
 * 		target = c.valueSymbolLinks.Get(prop).target
 * 	}
 * 	c.symbolReferenceLinks.Get(target).referenceKinds |= ast.SymbolFlagsAll
 * }
 */
export declare function Checker_markPropertyAsReferenced(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>, nodeForCheckWriteOnly: GoPtr<Node>, isSelfTypeAccess: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUniqAssociatedNamesFromTupleType","kind":"method","status":"implemented","sigHash":"4f77f71aa8f9263f9313fc3b41b20bd0553ed168513a1f8c96aa61d012b2115a","bodyHash":"8e92fccb9d623d719c3e357f682fd9694f416dadcd829f9e007d1981a6947ca9"}
 *
 * Go source:
 * func (c *Checker) getUniqAssociatedNamesFromTupleType(t *TypeReference, restSymbol *ast.Symbol) []string {
 * 	elementInfos := t.TargetTupleType().elementInfos
 * 	names := make([]string, len(elementInfos))
 * 	counters := make(map[string]int)
 * 	for i, info := range elementInfos {
 * 		names[i] = c.getTupleElementLabel(info, restSymbol, i)
 * 		// count duplicates using negative values
 * 		counters[names[i]]--
 * 	}
 * 	for i, name := range names {
 * 		if counters[name] == -1 {
 * 			continue
 * 		}
 * 		for {
 * 			if counters[name] < 0 {
 * 				// switch to a positive suffix counter
 * 				counters[name] = 0
 * 			}
 * 			counters[name]++
 * 			candidateName := name + "_" + strconv.Itoa(counters[name])
 * 			if counters[candidateName] == 0 {
 * 				names[i] = candidateName
 * 				break
 * 			}
 * 		}
 * 	}
 * 	return names
 * }
 */
export declare function Checker_getUniqAssociatedNamesFromTupleType(receiver: GoPtr<Checker>, t: GoPtr<TypeReference>, restSymbol: GoPtr<Symbol>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSimplifiedIndexedAccessType","kind":"method","status":"implemented","sigHash":"5e317fd73c98cf376215f0ff734671778bcc0203b57cc5c7d3ca30284eddecea","bodyHash":"4267ea245258c980467bdc055fc914251502baa73ee085f2565f8c2d9bc655e8"}
 *
 * Go source:
 * func (c *Checker) getSimplifiedIndexedAccessType(t *Type, writing bool) *Type {
 * 	key := CachedTypeKey{kind: core.IfElse(writing, CachedTypeKindIndexedAccessForWriting, CachedTypeKindIndexedAccessForReading), typeId: t.id}
 * 	if cached := c.cachedTypes[key]; cached != nil {
 * 		return core.IfElse(cached == c.circularConstraintType, t, cached)
 * 	}
 * 	c.cachedTypes[key] = t
 * 	result := c.getSimplifiedIndexedAccessTypeWorker(t, writing)
 * 	if result != t {
 * 		// If the simplification is a union type that includes t, remove t from the type.
 * 		result = c.removeType(result, t)
 * 		c.cachedTypes[key] = result
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getSimplifiedIndexedAccessType(receiver: GoPtr<Checker>, t: GoPtr<Type>, writing: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.distributeObjectOverIndexType","kind":"method","status":"implemented","sigHash":"eb5b61a67a11968ceb4e1d642036465493938e7ae44a7e24dfbfcbe4ca21109b","bodyHash":"35f72f7804652f29ab73e086a60e9b3f89cdc898676a4cb143ecb18f2a8c5302"}
 *
 * Go source:
 * func (c *Checker) distributeObjectOverIndexType(objectType *Type, indexType *Type, writing bool) *Type {
 * 	// T[A | B] -> T[A] | T[B] (reading)
 * 	// T[A | B] -> T[A] & T[B] (writing)
 * 	if indexType.flags&TypeFlagsUnion != 0 {
 * 		types := core.Map(indexType.Types(), func(t *Type) *Type {
 * 			return c.getSimplifiedType(c.getIndexedAccessType(objectType, t), writing)
 * 		})
 * 		if writing {
 * 			return c.getIntersectionType(types)
 * 		}
 * 		return c.getUnionType(types)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_distributeObjectOverIndexType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, writing: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.distributeIndexOverObjectType","kind":"method","status":"implemented","sigHash":"b2eaa910a7908ecc21bfc00b8d959c37da7c976d163f0f50633d31bf3eea8e81","bodyHash":"0d408a902e5f69a495e617b25b8ba285772574332fa642fb41338f535949d5bf"}
 *
 * Go source:
 * func (c *Checker) distributeIndexOverObjectType(objectType *Type, indexType *Type, writing bool) *Type {
 * 	// (T | U)[K] -> T[K] | U[K] (reading)
 * 	// (T | U)[K] -> T[K] & U[K] (writing)
 * 	// (T & U)[K] -> T[K] & U[K]
 * 	if objectType.flags&TypeFlagsUnion != 0 || objectType.flags&TypeFlagsIntersection != 0 && !c.shouldDeferIndexType(objectType, IndexFlagsNone) {
 * 		types := core.Map(objectType.Types(), func(t *Type) *Type {
 * 			return c.getSimplifiedType(c.getIndexedAccessType(t, indexType), writing)
 * 		})
 * 		if objectType.flags&TypeFlagsIntersection != 0 || writing {
 * 			return c.getIntersectionType(types)
 * 		}
 * 		return c.getUnionType(types)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_distributeIndexOverObjectType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>, writing: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.transformTypeOfMembers","kind":"method","status":"implemented","sigHash":"b65a5846d6b4450ba4f4f722d5be1acc7a6c9856326ec94e1b795cedf7b611be","bodyHash":"d7f5dbb86d3b1dfb68f5549275384a90dd50467d9e3d5960833704a2b640b8b3"}
 *
 * Go source:
 * func (c *Checker) transformTypeOfMembers(t *Type, f func(propertyType *Type) *Type) ast.SymbolTable {
 * 	members := make(ast.SymbolTable)
 * 	for _, property := range c.getPropertiesOfObjectType(t) {
 * 		original := c.getTypeOfSymbol(property)
 * 		updated := f(original)
 * 		if updated != original {
 * 			property = c.createSymbolWithType(property, updated)
 * 		}
 * 		members[property.Name] = property
 * 	}
 * 	return members
 * }
 */
export declare function Checker_transformTypeOfMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>, f: (propertyType: GoPtr<Type>) => GoPtr<Type>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markIdentifierAliasReferenced","kind":"method","status":"implemented","sigHash":"b1b50edbe2bfec4a90cccd1f92f740288f7e283f5a0305a52ee9882e9046beb8","bodyHash":"0f98aeb4862fb09a8f831ba22f11477e4154dd5bdea96d0f7b896e6f325726cb"}
 *
 * Go source:
 * func (c *Checker) markIdentifierAliasReferenced(location *ast.IdentifierNode) {
 * 	symbol := c.getResolvedSymbol(location)
 * 	if symbol != nil && symbol != c.argumentsSymbol && symbol != c.unknownSymbol && !ast.IsThisInTypeQuery(location) {
 * 		c.markAliasReferenced(symbol, location)
 * 	}
 * }
 */
export declare function Checker_markIdentifierAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<IdentifierNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markPropertyAliasReferenced","kind":"method","status":"implemented","sigHash":"dd97300ef9fd90082a0f964eb8babaa65011531aa903609751988688b229da1b","bodyHash":"cd504ffaaeff00efd737e876d57daf443ce898fd591e523d584f7d06e7515db6"}
 *
 * Go source:
 * func (c *Checker) markPropertyAliasReferenced(location *ast.Node /*PropertyAccessExpression | QualifiedName* /, propSymbol *ast.Symbol, parentType *Type) {
 * 	if isPartOfImportEqualsModuleReference(location) {
 * 		return
 * 	}
 * 	var left *ast.Node
 * 	if ast.IsPropertyAccessExpression(location) {
 * 		left = location.Expression()
 * 	} else {
 * 		left = location.AsQualifiedName().Left
 * 	}
 * 	if ast.IsThisIdentifier(left) || !ast.IsIdentifier(left) {
 * 		return
 * 	}
 * 	parentSymbol := c.getResolvedSymbol(left)
 * 	if parentSymbol == nil || parentSymbol == c.unknownSymbol {
 * 		return
 * 	}
 * 	// In `Foo.Bar.Baz`, 'Foo' is not referenced if 'Bar' is a const enum or a module containing only const enums.
 * 	// `Foo` is also not referenced in `enum FooCopy { Bar = Foo.Bar }`, because the enum member value gets inlined
 * 	// here even if `Foo` is not a const enum.
 * 	//
 * 	// The exceptions are:
 * 	//   1. if 'isolatedModules' is enabled, because the const enum value will not be inlined, and
 * 	//   2. if 'preserveConstEnums' is enabled and the expression is itself an export, e.g. `export = Foo.Bar.Baz`.
 * 	//
 * 	// The property lookup is deferred as much as possible, in as many situations as possible, to avoid alias marking
 * 	// pulling on types/symbols it doesn't strictly need to.
 * 	if c.compilerOptions.GetIsolatedModules() || (c.compilerOptions.ShouldPreserveConstEnums() && isExportOrExportExpression(location)) {
 * 		c.markAliasReferenced(parentSymbol, location)
 * 		return
 * 	}
 * 	// Hereafter, this relies on type checking - but every check prior to this only used symbol information
 * 	leftType := parentType
 * 	if leftType == nil {
 * 		leftType = c.checkExpressionCached(left)
 * 	}
 * 	if IsTypeAny(leftType) || leftType == c.silentNeverType {
 * 		c.markAliasReferenced(parentSymbol, location)
 * 		return
 * 	}
 * 	prop := propSymbol
 * 	if prop == nil && parentType == nil {
 * 		var right *ast.Node
 * 		if ast.IsPropertyAccessExpression(location) {
 * 			right = location.AsPropertyAccessExpression().Name()
 * 		} else {
 * 			right = location.AsQualifiedName().Right
 * 		}
 * 		var lexicallyScopedSymbol *ast.Symbol
 * 		if ast.IsPrivateIdentifier(right) {
 * 			lexicallyScopedSymbol = c.lookupSymbolForPrivateIdentifierDeclaration(right.Text(), right)
 * 		}
 * 		assignmentKind := getAssignmentTargetKind(location)
 * 		var apparentType *Type
 * 		if assignmentKind != AssignmentKindNone || c.isMethodAccessForCall(location) {
 * 			apparentType = c.getApparentType(c.getWidenedType(leftType))
 * 		} else {
 * 			apparentType = c.getApparentType(leftType)
 * 		}
 * 		if ast.IsPrivateIdentifier(right) {
 * 			if lexicallyScopedSymbol != nil {
 * 				prop = c.getPrivateIdentifierPropertyOfType(apparentType, lexicallyScopedSymbol)
 * 			}
 * 		} else {
 * 			prop = c.getPropertyOfType(apparentType, right.Text())
 * 		}
 * 	}
 * 	if !(prop != nil && (isConstEnumOrConstEnumOnlyModule(prop) || prop.Flags&ast.SymbolFlagsEnumMember != 0 && location.Parent.Kind == ast.KindEnumMember)) {
 * 		c.markAliasReferenced(parentSymbol, location)
 * 	}
 * }
 */
export declare function Checker_markPropertyAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<Node>, propSymbol: GoPtr<Symbol>, parentType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markJsxAliasReferenced","kind":"method","status":"implemented","sigHash":"2168c520e8aedc06d43ebf6235a9ddc55763d4beff20faf8a5cc9bddb499a467","bodyHash":"6eaa2ff365bd1c63ba7cc08a256c676ec65bd81bc426aaf286282af283864440"}
 *
 * Go source:
 * func (c *Checker) markJsxAliasReferenced(node *ast.Node /*JsxOpeningLikeElement | JsxOpeningFragment* /) {
 * 	if c.getJsxNamespaceContainerForImplicitImport(node) != nil {
 * 		return
 * 	}
 * 	// The reactNamespace/jsxFactory's root symbol should be marked as 'used' so we don't incorrectly elide its import.
 * 	// And if there is no reactNamespace/jsxFactory's symbol in scope when targeting React emit, we should issue an error.
 * 	jsxFactoryRefErr := core.IfElse(c.compilerOptions.Jsx == core.JsxEmitReact, diagnostics.This_JSX_tag_requires_0_to_be_in_scope_but_it_could_not_be_found, nil)
 * 	jsxFactoryNamespace := c.getJsxNamespace(node)
 * 	jsxFactoryLocation := node
 * 	if ast.IsJsxOpeningLikeElement(node) {
 * 		jsxFactoryLocation = node.TagName()
 * 	}
 * 	shouldFactoryRefErr := c.compilerOptions.Jsx != core.JsxEmitPreserve && c.compilerOptions.Jsx != core.JsxEmitReactNative
 * 	// #38720/60122, allow null as jsxFragmentFactory
 * 	var jsxFactorySym *ast.Symbol
 * 	if !(ast.IsJsxOpeningFragment(node) && jsxFactoryNamespace == "null") {
 * 		flags := ast.SymbolFlagsValue
 * 		if !shouldFactoryRefErr {
 * 			flags &^= ast.SymbolFlagsEnum
 * 		}
 * 		jsxFactorySym = c.resolveName(jsxFactoryLocation, jsxFactoryNamespace, flags, jsxFactoryRefErr, true /*isUse* /, false /*excludeGlobals* /)
 * 	}
 * 	if jsxFactorySym != nil {
 * 		// Mark local symbol as referenced here because it might not have been marked
 * 		// if jsx emit was not jsxFactory as there wont be error being emitted
 * 		c.symbolReferenced(jsxFactorySym, ast.SymbolFlagsAll)
 * 		// If react/jsxFactory symbol is alias, mark it as referenced
 * 		if c.canCollectSymbolAliasAccessibilityData && jsxFactorySym.Flags&ast.SymbolFlagsAlias != 0 && c.getTypeOnlyAliasDeclaration(jsxFactorySym) == nil {
 * 			c.markAliasSymbolAsReferenced(jsxFactorySym)
 * 		}
 * 	}
 * 	// if JsxFragment, additionally mark jsx pragma as referenced, since `getJsxNamespace` above would have resolved to only the fragment factory if they are distinct
 * 	if ast.IsJsxOpeningFragment(node) {
 * 		file := ast.GetSourceFileOfNode(node)
 * 		entity := c.getJsxFactoryEntity(file.AsNode())
 * 		if entity != nil {
 * 			localJsxNamespace := ast.GetFirstIdentifier(entity).Text()
 * 			flags := ast.SymbolFlagsValue
 * 			if !shouldFactoryRefErr {
 * 				flags &^= ast.SymbolFlagsEnum
 * 			}
 * 			c.resolveName(jsxFactoryLocation, localJsxNamespace, flags, jsxFactoryRefErr, true /*isUse* /, false /*excludeGlobals* /)
 * 		}
 * 	}
 * }
 */
export declare function Checker_markJsxAliasReferenced(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markImportEqualsAliasReferenced","kind":"method","status":"implemented","sigHash":"e558a74374d8106ef384cc949463fcd8adb1cf5e291e18d14ec0db6724b8a31d","bodyHash":"887674b4b219d8f4033b501862ac31c187984073bdd83ea9dd64df90c1633b39"}
 *
 * Go source:
 * func (c *Checker) markImportEqualsAliasReferenced(location *ast.Node /*ImportEqualsDeclaration* /) {
 * 	if ast.HasSyntacticModifier(location, ast.ModifierFlagsExport) {
 * 		c.markExportAsReferenced(location)
 * 	}
 * }
 */
export declare function Checker_markImportEqualsAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markExportSpecifierAliasReferenced","kind":"method","status":"implemented","sigHash":"c130e52ecf5d616c96141ded62da8ffc7d11b17158286616ef7de42ba8c4c9a0","bodyHash":"cfb8cecb56eb7d23f7cefb94c18074934ca21fb3b1feddc41ea1a33265bf866f"}
 *
 * Go source:
 * func (c *Checker) markExportSpecifierAliasReferenced(location *ast.ExportSpecifierNode) {
 * 	if location.Parent.Parent.ModuleSpecifier() == nil && !location.IsTypeOnly() && !location.Parent.Parent.IsTypeOnly() {
 * 		exportedName := location.PropertyNameOrName()
 * 		if exportedName.Kind == ast.KindStringLiteral {
 * 			return // Skip for invalid syntax like this: export { "x" }
 * 		}
 * 		symbol := c.resolveName(exportedName, exportedName.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias, nil /*nameNotFoundMessage* /, true /*isUse* /, false /*excludeGlobals* /)
 * 		if symbol != nil && (symbol == c.undefinedSymbol || symbol == c.globalThisSymbol || symbol.Declarations != nil && ast.IsGlobalSourceFile(ast.GetDeclarationContainer(symbol.Declarations[0]))) {
 * 			// Do nothing, non-local symbol
 * 		} else {
 * 			target := symbol
 * 			if target != nil && target.Flags&ast.SymbolFlagsAlias != 0 {
 * 				target = c.resolveAlias(target)
 * 			}
 * 			if target == nil || c.getSymbolFlags(target)&ast.SymbolFlagsValue != 0 {
 * 				c.markExportAsReferenced(location)            // marks export as used
 * 				c.markIdentifierAliasReferenced(exportedName) // marks target of export as used
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_markExportSpecifierAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<ExportSpecifierNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markDecoratorAliasReferenced","kind":"method","status":"implemented","sigHash":"1c77fd5659fff95fee6891209cd7380b9f2ea542f72ea2960d7faf30e758bb75","bodyHash":"f7096137510cc88473053fc500d107992ad50058879dbe7fa2212e051f2939c3"}
 *
 * Go source:
 * func (c *Checker) markDecoratorAliasReferenced(node *ast.Node /*HasDecorators* /) {
 * 	if c.compilerOptions.EmitDecoratorMetadata.IsFalseOrUnknown() {
 * 		return
 * 	}
 * 	firstDecorator := core.FirstOrNil(node.Decorators())
 * 	if firstDecorator == nil {
 * 		return
 * 	}
 *
 * 	c.checkExternalEmitHelpers(firstDecorator, ExternalEmitHelpersMetadata)
 *
 * 	// we only need to perform these checks if we are emitting serialized type metadata for the target of a decorator.
 * 	switch node.Kind {
 * 	case ast.KindClassDeclaration:
 * 		ctor := ast.GetFirstConstructorWithBody(node)
 * 		if ctor != nil {
 * 			for _, p := range ctor.Parameters() {
 * 				c.markDecoratorMedataDataTypeNodeAsReferenced(c.getParameterTypeNodeForDecoratorCheck(p))
 * 			}
 * 		}
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		otherKind := ast.KindSetAccessor
 * 		if node.Kind == ast.KindSetAccessor {
 * 			otherKind = ast.KindGetAccessor
 * 		}
 * 		otherAccessor := ast.GetDeclarationOfKind(c.getSymbolOfDeclaration(node), otherKind)
 * 		annotation := c.getAnnotatedAccessorTypeNode(node)
 * 		if annotation == nil && otherAccessor != nil {
 * 			annotation = c.getAnnotatedAccessorTypeNode(otherAccessor)
 * 		}
 * 		c.markDecoratorMedataDataTypeNodeAsReferenced(annotation)
 * 	case ast.KindMethodDeclaration:
 * 		for _, p := range node.Parameters() {
 * 			c.markDecoratorMedataDataTypeNodeAsReferenced(c.getParameterTypeNodeForDecoratorCheck(p))
 * 		}
 * 		c.markDecoratorMedataDataTypeNodeAsReferenced(node.Type())
 * 	case ast.KindPropertyDeclaration:
 * 		c.markDecoratorMedataDataTypeNodeAsReferenced(node.Type())
 * 	case ast.KindParameter:
 * 		c.markDecoratorMedataDataTypeNodeAsReferenced(c.getParameterTypeNodeForDecoratorCheck(node))
 * 		containingSignature := node.Parent
 * 		for _, p := range containingSignature.Parameters() {
 * 			c.markDecoratorMedataDataTypeNodeAsReferenced(c.getParameterTypeNodeForDecoratorCheck(p))
 * 		}
 * 		c.markDecoratorMedataDataTypeNodeAsReferenced(containingSignature.Type())
 * 	}
 * }
 */
export declare function Checker_markDecoratorAliasReferenced(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEntityNameForDecoratorMetadata","kind":"method","status":"implemented","sigHash":"800b93435a3ba5e93f56b1b7638f73ae063a88e48fc0ea57edfe78e27e2c8d2a","bodyHash":"e6dfa775f550c7e7e388bacb0cb8c3b9ef00b0b09f275a9bac1aedca48194b0e"}
 *
 * Go source:
 * func (c *Checker) getEntityNameForDecoratorMetadata(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindIntersectionType:
 * 		return c.getEntityNameForDecoratorMetadataFromTypeList(node.AsIntersectionTypeNode().Types.Nodes)
 * 	case ast.KindUnionType:
 * 		return c.getEntityNameForDecoratorMetadataFromTypeList(node.AsUnionTypeNode().Types.Nodes)
 * 	case ast.KindConditionalType:
 * 		return c.getEntityNameForDecoratorMetadataFromTypeList([]*ast.Node{node.AsConditionalTypeNode().TrueType, node.AsConditionalTypeNode().FalseType})
 * 	case ast.KindParenthesizedType:
 * 		return c.getEntityNameForDecoratorMetadata(node.AsParenthesizedTypeNode().Type)
 * 	case ast.KindNamedTupleMember:
 * 		return c.getEntityNameForDecoratorMetadata(node.AsNamedTupleMember().Type)
 * 	case ast.KindTypeReference:
 * 		return node.AsTypeReferenceNode().TypeName
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getEntityNameForDecoratorMetadata(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEntityNameForDecoratorMetadataFromTypeList","kind":"method","status":"implemented","sigHash":"c41d8d476ceef2d30c820094cf4883709dd15788253280b143d1070f6dcfb46d","bodyHash":"db8b46a7620f783229f206e4c566b2a6b5c4ec354e532494a0b0ed62c81ca242"}
 *
 * Go source:
 * func (c *Checker) getEntityNameForDecoratorMetadataFromTypeList(typeNodes []*ast.Node) *ast.Node {
 * 	var commonEntityName *ast.Node
 * 	for _, typeNode := range typeNodes {
 * 		if typeNode.Kind == ast.KindNeverKeyword {
 * 			continue // Always elide `never` from the union/intersection if possible
 * 		}
 * 		if !c.strictNullChecks && (typeNode.Kind == ast.KindLiteralType && typeNode.AsLiteralTypeNode().Literal.Kind == ast.KindNullKeyword || typeNode.Kind == ast.KindUndefinedKeyword) {
 * 			continue // Elide null and undefined from unions for metadata, just like what we did prior to the implementation of strict null checks
 * 		}
 * 		individualEntityName := c.getEntityNameForDecoratorMetadata(typeNode)
 * 		if individualEntityName == nil {
 * 			// Individual is something like string number
 * 			// So it would be serialized to either that type or object
 * 			// Safe to return here
 * 			return nil
 * 		}
 *
 * 		if commonEntityName == nil {
 * 			commonEntityName = individualEntityName
 * 		} else {
 * 			// Note this is in sync with the transformation that happens for type node.
 * 			// Keep this in sync with serializeUnionOrIntersectionType
 * 			// Verify if they refer to same entity and is identifier
 * 			// return undefined if they dont match because we would emit object
 * 			if !ast.IsIdentifier(commonEntityName) || !ast.IsIdentifier(individualEntityName) || commonEntityName.AsIdentifier().Text != individualEntityName.AsIdentifier().Text {
 * 				return nil
 * 			}
 * 		}
 * 	}
 * 	return commonEntityName
 * }
 */
export declare function Checker_getEntityNameForDecoratorMetadataFromTypeList(receiver: GoPtr<Checker>, typeNodes: GoSlice<GoPtr<Node>>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markAliasReferenced","kind":"method","status":"implemented","sigHash":"ba2595101bcaafc3dd4f7239c1c136d0923828c14d1096172249090f8015b042","bodyHash":"e65e9ee7946c259329bacaf56e813b67e6676b9af82ac670107da7ced86d54a9"}
 *
 * Go source:
 * func (c *Checker) markAliasReferenced(symbol *ast.Symbol, location *ast.Node) {
 * 	if !c.canCollectSymbolAliasAccessibilityData {
 * 		return
 * 	}
 * 	if ast.IsNonLocalAlias(symbol, ast.SymbolFlagsValue /*excludes* /) && !IsInTypeQuery(location) {
 * 		target := c.resolveAlias(symbol)
 * 		if c.getSymbolFlagsEx(symbol, true /*excludeTypeOnlyMeanings* /, false /*excludeLocalMeanings* /)&(ast.SymbolFlagsValue|ast.SymbolFlagsExportValue) != 0 {
 * 			// An alias resolving to a const enum cannot be elided if (1) 'isolatedModules' is enabled
 * 			// (because the const enum value will not be inlined), or if (2) the alias is an export
 * 			// of a const enum declaration that will be preserved.
 * 			if c.compilerOptions.GetIsolatedModules() ||
 * 				c.compilerOptions.ShouldPreserveConstEnums() && isExportOrExportExpression(location) ||
 * 				!isConstEnumOrConstEnumOnlyModule(c.getExportSymbolOfValueSymbolIfExported(target)) {
 * 				c.markAliasSymbolAsReferenced(symbol)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_markAliasReferenced(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markAliasSymbolAsReferenced","kind":"method","status":"implemented","sigHash":"8fe640abdf2888ab80986c01e37cac7f8adb4fcddd2313722dc5ae7bdc31da5a","bodyHash":"e2d3f627de83b744fdf0ef5ebd81d04165297fe5d2e7afa716d37198a63c9a87"}
 *
 * Go source:
 * func (c *Checker) markAliasSymbolAsReferenced(symbol *ast.Symbol) {
 * 	links := c.aliasSymbolLinks.Get(symbol)
 * 	if !links.referenced {
 * 		links.referenced = true
 * 		node := c.getDeclarationOfAliasSymbol(symbol)
 * 		if node == nil {
 * 			panic("Unexpected nil in markAliasSymbolAsReferenced")
 * 		}
 * 		// We defer checking of the reference of an `import =` until the import itself is referenced,
 * 		// This way a chain of imports can be elided if ultimately the final input is only used in a type
 * 		// position.
 * 		if ast.IsImportEqualsDeclaration(node) && node.AsImportEqualsDeclaration().ModuleReference.Kind != ast.KindExternalModuleReference {
 * 			if c.getSymbolFlags(c.resolveSymbol(symbol))&ast.SymbolFlagsValue != 0 {
 * 				// import foo = <symbol>
 * 				left := ast.GetFirstIdentifier(node.AsImportEqualsDeclaration().ModuleReference)
 * 				c.markIdentifierAliasReferenced(left)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_markAliasSymbolAsReferenced(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markExportAsReferenced","kind":"method","status":"implemented","sigHash":"ef483bac4d3f332495d2bd50ce356264520966397812d3e54c8d60c1ecb9cfd8","bodyHash":"5b65f4d9ba64a53989adc3b2cdff346759c69adb3e9fb54cfb734c2c87ca1a3d"}
 *
 * Go source:
 * func (c *Checker) markExportAsReferenced(node *ast.Node /*ImportEqualsDeclaration | ExportSpecifier* /) {
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	target := c.resolveAlias(symbol)
 * 	if target != nil {
 * 		markAlias := target == c.unknownSymbol ||
 * 			((c.getSymbolFlagsEx(symbol, true /*excludeTypeOnlyMeanings* /, false /*excludeLocalMeanings* /)&ast.SymbolFlagsValue != 0) && !isConstEnumOrConstEnumOnlyModule(target))
 * 		if markAlias {
 * 			c.markAliasSymbolAsReferenced(symbol)
 * 		}
 * 	}
 * }
 */
export declare function Checker_markExportAsReferenced(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markEntityNameOrEntityExpressionAsReference","kind":"method","status":"implemented","sigHash":"5ccf7700dad09c3d84b767f300b427cef779f970b85414eb8bd59518407f5905","bodyHash":"f85cf8ba0f2671888e98b3997915fd765020447107dcb48dc4e6f6149be07d6e"}
 *
 * Go source:
 * func (c *Checker) markEntityNameOrEntityExpressionAsReference(typeName *ast.Node /*EntityNameOrEntityNameExpression | nil* /, forDecoratorMetadata bool) {
 * 	if typeName == nil {
 * 		return
 * 	}
 *
 * 	rootName := ast.GetFirstIdentifier(typeName)
 * 	meaning := core.IfElse(typeName.Kind == ast.KindIdentifier, ast.SymbolFlagsType, ast.SymbolFlagsNamespace) | ast.SymbolFlagsAlias
 * 	rootSymbol := c.resolveName(rootName, rootName.Text(), meaning, nil /*nameNotFoundMessage* /, true /*isUse* /, false /*excludeGlobals* /)
 *
 * 	if rootSymbol != nil && rootSymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		if c.canCollectSymbolAliasAccessibilityData &&
 * 			c.symbolIsValue(rootSymbol) &&
 * 			!isConstEnumOrConstEnumOnlyModule(c.resolveAlias(rootSymbol)) &&
 * 			c.getTypeOnlyAliasDeclaration(rootSymbol) == nil {
 * 			c.markAliasSymbolAsReferenced(rootSymbol)
 * 		} else if forDecoratorMetadata &&
 * 			c.compilerOptions.GetIsolatedModules() &&
 * 			c.compilerOptions.GetEmitModuleKind() >= core.ModuleKindES2015 &&
 * 			!c.symbolIsValue(rootSymbol) &&
 * 			!core.Some(rootSymbol.Declarations, ast.IsTypeOnlyImportOrExportDeclaration) {
 * 			diag := c.error(typeName, diagnostics.A_type_referenced_in_a_decorated_signature_must_be_imported_with_import_type_or_a_namespace_import_when_isolatedModules_and_emitDecoratorMetadata_are_enabled)
 * 			var aliasDeclaration *ast.Node
 * 			for _, decl := range rootSymbol.Declarations {
 * 				if ast.IsAliasSymbolDeclaration(decl) {
 * 					aliasDeclaration = decl
 * 					break
 * 				}
 * 			}
 * 			if aliasDeclaration != nil {
 * 				diag.SetRelatedInfo([]*ast.Diagnostic{createDiagnosticForNode(aliasDeclaration, diagnostics.X_0_was_imported_here, rootName.Text())})
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_markEntityNameOrEntityExpressionAsReference(receiver: GoPtr<Checker>, typeName: GoPtr<Node>, forDecoratorMetadata: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.substituteIndexedMappedType","kind":"method","status":"implemented","sigHash":"15e98ce62f75ee583a55f90ed02a623dcd76f01f8f34a8b64317713d817603e0","bodyHash":"2bd3f2dd721791e8b5fb6ea7d23a380c5a0f65d5f6cdad418ec2db9c5c3cbb70"}
 *
 * Go source:
 * func (c *Checker) substituteIndexedMappedType(objectType *Type, index *Type) *Type {
 * 	mapper := newSimpleTypeMapper(c.getTypeParameterFromMappedType(objectType), index)
 * 	templateMapper := c.combineTypeMappers(objectType.AsMappedType().mapper, mapper)
 * 	instantiatedTemplateType := c.instantiateType(c.getTemplateTypeFromMappedType(core.OrElse(objectType.AsMappedType().target, objectType)), templateMapper)
 * 	isOptional := getMappedTypeOptionality(objectType) > 0
 * 	if !isOptional {
 * 		if c.isGenericType(objectType) {
 * 			isOptional = c.getCombinedMappedTypeOptionality(c.getModifiersTypeFromMappedType(objectType)) > 0
 * 		} else {
 * 			isOptional = c.couldAccessOptionalProperty(objectType, index)
 * 		}
 * 	}
 * 	return c.addOptionalityEx(instantiatedTemplateType, true /*isProperty* /, isOptional)
 * }
 */
export declare function Checker_substituteIndexedMappedType(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, index: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.couldAccessOptionalProperty","kind":"method","status":"implemented","sigHash":"0daf0827d9d09daf3a3252c5d18e4f745fb5560349d47ddfbbf866c313aefd4f","bodyHash":"df128eedca2dc0a8925745eaf06a73c47f88fe11fc26d31e4cd3299f2b8f9848"}
 *
 * Go source:
 * func (c *Checker) couldAccessOptionalProperty(objectType *Type, indexType *Type) bool {
 * 	indexConstraint := c.getBaseConstraintOfType(indexType)
 * 	return indexConstraint != nil && core.Some(c.getPropertiesOfType(objectType), func(p *ast.Symbol) bool {
 * 		return p.Flags&ast.SymbolFlagsOptional != 0 && c.isTypeAssignableTo(c.getLiteralTypeFromProperty(p, TypeFlagsStringOrNumberLiteralOrUnique, false), indexConstraint)
 * 	})
 * }
 */
export declare function Checker_couldAccessOptionalProperty(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForVariableLikeDeclaration","kind":"method","status":"implemented","sigHash":"7abc2d2223807fbac2b1d63ecda9bf58cb403dd0fb716e1fd02f765ef3d0f367","bodyHash":"590926d3b047674eca4a3b7fff1adc0ee485dee37b5e28ebd80123f7f71ce4b9"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForVariableLikeDeclaration(declaration *ast.Node, contextFlags ContextFlags) *Type {
 * 	typeNode := declaration.Type()
 * 	if typeNode != nil {
 * 		return c.getTypeFromTypeNode(typeNode)
 * 	}
 * 	switch declaration.Kind {
 * 	case ast.KindParameter:
 * 		return c.getContextuallyTypedParameterType(declaration)
 * 	case ast.KindBindingElement:
 * 		return c.getContextualTypeForBindingElement(declaration, contextFlags)
 * 	case ast.KindPropertyDeclaration:
 * 		if ast.IsStatic(declaration) {
 * 			return c.getContextualTypeForStaticPropertyDeclaration(declaration, contextFlags)
 * 		}
 * 	}
 * 	// By default, do nothing and return nil - only the above cases have context implied by a parent
 * 	return nil
 * }
 */
export declare function Checker_getContextualTypeForVariableLikeDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForStaticPropertyDeclaration","kind":"method","status":"implemented","sigHash":"3956b7e2c0f2de8a0bc11bf02cb75d3c77d717d811b7b0fc1cceb0e5462d48bd","bodyHash":"920d9f205730b4fbee9ab7aeb97f9e7ab8aa75ddfe27cfd4720d9f4dbaf6fe79"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForStaticPropertyDeclaration(declaration *ast.Node, contextFlags ContextFlags) *Type {
 * 	if ast.IsExpression(declaration.Parent) {
 * 		if parentType := c.getContextualType(declaration.Parent, contextFlags); parentType != nil {
 * 			return c.getTypeOfPropertyOfContextualType(parentType, c.getSymbolOfDeclaration(declaration).Name)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getContextualTypeForStaticPropertyDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualImportAttributeType","kind":"method","status":"implemented","sigHash":"8ea88aa52d5e8dfbce623b40c0b568979ea49083df764d5a5492e91d19ffef52","bodyHash":"b7bce2407a89151beb2229ca10a38b944a0b6bca3855a17f7d62ae8fa5087449"}
 *
 * Go source:
 * func (c *Checker) getContextualImportAttributeType(node *ast.Node) *Type {
 * 	return c.getTypeOfPropertyOfContextualType(c.getGlobalImportAttributesType(), node.Name().Text())
 * }
 */
export declare function Checker_getContextualImportAttributeType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getClassMemberDecoratorContextOverrideType","kind":"method","status":"implemented","sigHash":"40b065cf2f4952291f515d5b0150cf525e222aaf049910c2e78dc809d52b3d84","bodyHash":"c0f48c8ae57e206bc38199108ff5defc684a308d07cdb8da6d15c85434ddb414"}
 *
 * Go source:
 * func (c *Checker) getClassMemberDecoratorContextOverrideType(nameType *Type, isPrivate bool, isStatic bool) *Type {
 * 	kind := core.IfElse(isPrivate,
 * 		core.IfElse(isStatic, CachedTypeKindDecoratorContextPrivateStatic, CachedTypeKindDecoratorContextPrivate),
 * 		core.IfElse(isStatic, CachedTypeKindDecoratorContextStatic, CachedTypeKindDecoratorContext),
 * 	)
 * 	key := CachedTypeKey{kind: kind, typeId: nameType.id}
 * 	if overrideType := c.cachedTypes[key]; overrideType != nil {
 * 		return overrideType
 * 	}
 * 	members := make(ast.SymbolTable)
 * 	members["name"] = c.newProperty("name", nameType)
 * 	members["private"] = c.newProperty("private", core.IfElse(isPrivate, c.trueType, c.falseType))
 * 	members["static"] = c.newProperty("static", core.IfElse(isStatic, c.trueType, c.falseType))
 * 	overrideType := c.newAnonymousType(nil, members, nil, nil, nil)
 * 	c.cachedTypes[key] = overrideType
 * 	return overrideType
 * }
 */
export declare function Checker_getClassMemberDecoratorContextOverrideType(receiver: GoPtr<Checker>, nameType: GoPtr<Type>, isPrivate: bool, isStatic: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newClassMemberDecoratorContextTypeForNode","kind":"method","status":"implemented","sigHash":"58aaa49dd032f9fec0c06c4efe0b88412bb850365d9757b7951c9c46989d5151","bodyHash":"809d89f5bf8138e30b277a30c641a993a62ab2299b21da8cfed11edaab77d383"}
 *
 * Go source:
 * func (c *Checker) newClassMemberDecoratorContextTypeForNode(node *ast.Node, thisType *Type, valueType *Type) *Type {
 * 	isStatic := ast.HasStaticModifier(node)
 * 	isPrivate := ast.IsPrivateIdentifier(node.Name())
 * 	var nameType *Type
 * 	if isPrivate {
 * 		nameType = c.getStringLiteralType(node.Name().Text())
 * 	} else {
 * 		nameType = c.getLiteralTypeFromPropertyName(node.Name())
 * 	}
 * 	var contextType *Type
 * 	switch {
 * 	case ast.IsMethodDeclaration(node):
 * 		contextType = c.newClassMethodDecoratorContextType(thisType, valueType)
 * 	case ast.IsGetAccessorDeclaration(node):
 * 		contextType = c.newClassGetterDecoratorContextType(thisType, valueType)
 * 	case ast.IsSetAccessorDeclaration(node):
 * 		contextType = c.newClassSetterDecoratorContextType(thisType, valueType)
 * 	case ast.IsAutoAccessorPropertyDeclaration(node):
 * 		contextType = c.newClassAccessorDecoratorContextType(thisType, valueType)
 * 	case ast.IsPropertyDeclaration(node):
 * 		contextType = c.newClassFieldDecoratorContextType(thisType, valueType)
 * 	default:
 * 		panic("Unhandled case in createClassMemberDecoratorContextTypeForNode")
 * 	}
 * 	overrideType := c.getClassMemberDecoratorContextOverrideType(nameType, isPrivate, isStatic)
 * 	return c.getIntersectionType([]*Type{contextType, overrideType})
 * }
 */
export declare function Checker_newClassMemberDecoratorContextTypeForNode(receiver: GoPtr<Checker>, node: GoPtr<Node>, thisType: GoPtr<Type>, valueType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newTypedPropertyDescriptorType","kind":"method","status":"implemented","sigHash":"3e2aab8a85604e665ffb50f4e71879f6a84ae55597a463f84bed2bc9998f3388","bodyHash":"e0208a6bd0e21a963be996deb3245944ae329c512e32210dad2439c2194be641"}
 *
 * Go source:
 * func (c *Checker) newTypedPropertyDescriptorType(propertyType *Type) *Type {
 * 	return c.createTypeFromGenericGlobalType(c.getGlobalTypedPropertyDescriptorType(), []*Type{propertyType})
 * }
 */
export declare function Checker_newTypedPropertyDescriptorType(receiver: GoPtr<Checker>, propertyType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getClassElementPropertyKeyType","kind":"method","status":"implemented","sigHash":"0ebe0db7d28d1dda3426282fb17c50a203ebd5ba9af5cd4a6d0ce51dde27150c","bodyHash":"b3aaa79b919cdb468efe9be70f0c9276cfd9cabfc0bb4af0e615e38b19d93a0d"}
 *
 * Go source:
 * func (c *Checker) getClassElementPropertyKeyType(element *ast.Node) *Type {
 * 	name := element.Name()
 * 	switch name.Kind {
 * 	case ast.KindIdentifier, ast.KindNumericLiteral, ast.KindStringLiteral:
 * 		return c.getStringLiteralType(name.Text())
 * 	case ast.KindComputedPropertyName:
 * 		nameType := c.checkComputedPropertyName(name)
 * 		if c.isTypeAssignableToKind(nameType, TypeFlagsESSymbolLike) {
 * 			return nameType
 * 		}
 * 		return c.stringType
 * 	}
 * 	return c.errorType
 * }
 */
export declare function Checker_getClassElementPropertyKeyType(receiver: GoPtr<Checker>, element: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPropertyOfContextualType","kind":"method","status":"implemented","sigHash":"0ca38775c783f92efb46ad975c762027abab307d995a3c69c827a48a9e57ed77","bodyHash":"b80cd9e35b0ecf8ab8a09ff13c7bde487bcd8e551c7d377f82bb3a2df41a3581"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyOfContextualType(t *Type, name string) *Type {
 * 	return c.getTypeOfPropertyOfContextualTypeEx(t, name, nil)
 * }
 */
export declare function Checker_getTypeOfPropertyOfContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPropertyOfContextualTypeEx","kind":"method","status":"implemented","sigHash":"bccf0bf12e001dde1bdbc94420b9e4ab8310bcd02c32f8f04303a244d4729ff8","bodyHash":"9e6e37bb88e28cd33f74cf247ef853f43ef1b74e5e5fbdc76b4c5f202912ee04"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyOfContextualTypeEx(t *Type, name string, nameType *Type) *Type {
 * 	return c.mapTypeEx(t, func(t *Type) *Type {
 * 		if t.flags&TypeFlagsIntersection != 0 {
 * 			var types []*Type
 * 			var indexInfoCandidates []*Type
 * 			ignoreIndexInfos := false
 * 			for _, constituentType := range t.Types() {
 * 				if constituentType.flags&TypeFlagsObject == 0 {
 * 					continue
 * 				}
 * 				if c.isGenericMappedType(constituentType) && c.getMappedTypeNameTypeKind(constituentType) != MappedTypeNameTypeKindRemapping {
 * 					substitutedType := c.getIndexedMappedTypeSubstitutedTypeOfContextualType(constituentType, name, nameType)
 * 					types = c.appendContextualPropertyTypeConstituent(types, substitutedType)
 * 					continue
 * 				}
 * 				propertyType := c.getTypeOfConcretePropertyOfContextualType(constituentType, name)
 * 				if propertyType == nil {
 * 					if !ignoreIndexInfos {
 * 						indexInfoCandidates = append(indexInfoCandidates, constituentType)
 * 					}
 * 					continue
 * 				}
 * 				ignoreIndexInfos = true
 * 				indexInfoCandidates = nil
 * 				types = c.appendContextualPropertyTypeConstituent(types, propertyType)
 * 			}
 * 			for _, candidate := range indexInfoCandidates {
 * 				indexInfoType := c.getTypeFromIndexInfosOfContextualType(candidate, name, nameType)
 * 				types = c.appendContextualPropertyTypeConstituent(types, indexInfoType)
 * 			}
 * 			if len(types) == 0 {
 * 				return nil
 * 			}
 * 			if len(types) == 1 {
 * 				return types[0]
 * 			}
 * 			return c.getIntersectionType(types)
 * 		}
 * 		if t.flags&TypeFlagsObject == 0 {
 * 			return nil
 * 		}
 * 		if c.isGenericMappedType(t) && c.getMappedTypeNameTypeKind(t) != MappedTypeNameTypeKindRemapping {
 * 			return c.getIndexedMappedTypeSubstitutedTypeOfContextualType(t, name, nameType)
 * 		}
 * 		result := c.getTypeOfConcretePropertyOfContextualType(t, name)
 * 		if result != nil {
 * 			return result
 * 		}
 * 		return c.getTypeFromIndexInfosOfContextualType(t, name, nameType)
 * 	}, true /*noReductions* /)
 * }
 */
export declare function Checker_getTypeOfPropertyOfContextualTypeEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, nameType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexedMappedTypeSubstitutedTypeOfContextualType","kind":"method","status":"implemented","sigHash":"99a9acdc97acdd106147aad85191fe2aa7684dbea7772393bd41e5528b496e99","bodyHash":"7dd8f8c343f3a3cedf3b272bf5ad8e6a998c0d0e330aa77d3fc6ccfba6545e2b"}
 *
 * Go source:
 * func (c *Checker) getIndexedMappedTypeSubstitutedTypeOfContextualType(t *Type, name string, nameType *Type) *Type {
 * 	propertyNameType := nameType
 * 	if propertyNameType == nil {
 * 		propertyNameType = c.getStringLiteralType(name)
 * 	}
 * 	constraint := c.getConstraintTypeFromMappedType(t)
 * 	// special case for conditional types pretending to be negated types
 * 	if t.AsMappedType().nameType != nil && c.isExcludedMappedPropertyName(t.AsMappedType().nameType, propertyNameType) || c.isExcludedMappedPropertyName(constraint, propertyNameType) {
 * 		return nil
 * 	}
 * 	constraintOfConstraint := c.getBaseConstraintOrType(constraint)
 * 	if !c.isTypeAssignableTo(propertyNameType, constraintOfConstraint) {
 * 		return nil
 * 	}
 * 	return c.substituteIndexedMappedType(t, propertyNameType)
 * }
 */
export declare function Checker_getIndexedMappedTypeSubstitutedTypeOfContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, nameType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isExcludedMappedPropertyName","kind":"method","status":"implemented","sigHash":"115722da509e209f4e38782bfa9993cfb4e5d6b39d0b23e725196bfff31bfe11","bodyHash":"4886e08caa70e751e2fb804e75b1205fbc0f6b2124efedb017e0a6bf5f74559a"}
 *
 * Go source:
 * func (c *Checker) isExcludedMappedPropertyName(t *Type, propertyNameType *Type) bool {
 * 	if t.flags&TypeFlagsConditional != 0 {
 * 		return c.getReducedType(c.getTrueTypeFromConditionalType(t)).flags&TypeFlagsNever != 0 &&
 * 			c.getActualTypeVariable(c.getFalseTypeFromConditionalType(t)) == c.getActualTypeVariable(t.AsConditionalType().checkType) &&
 * 			c.isTypeAssignableTo(propertyNameType, t.AsConditionalType().extendsType)
 * 	}
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Some(t.Types(), func(t *Type) bool {
 * 			return c.isExcludedMappedPropertyName(t, propertyNameType)
 * 		})
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isExcludedMappedPropertyName(receiver: GoPtr<Checker>, t: GoPtr<Type>, propertyNameType: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfConcretePropertyOfContextualType","kind":"method","status":"implemented","sigHash":"8731d840033609a3fc4305fd03405dd9af2a871b593fd620c472bbc30a21d88e","bodyHash":"c0fe6c067565451038be8198f47f75848bd28290b4d05903ce478742a602d987"}
 *
 * Go source:
 * func (c *Checker) getTypeOfConcretePropertyOfContextualType(t *Type, name string) *Type {
 * 	prop := c.getPropertyOfType(t, name)
 * 	if prop == nil || c.isCircularMappedProperty(prop) {
 * 		return nil
 * 	}
 * 	return c.removeMissingType(c.getTypeOfSymbol(prop), prop.Flags&ast.SymbolFlagsOptional != 0)
 * }
 */
export declare function Checker_getTypeOfConcretePropertyOfContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromIndexInfosOfContextualType","kind":"method","status":"implemented","sigHash":"874d1ebcea71c393b4a283de04066cd6f59affe0d5c5675dc09090ddb1e56755","bodyHash":"692d5ebd1efabf66128b754ec0ce60dedf9ef8f219bc345ac48d26d031287886"}
 *
 * Go source:
 * func (c *Checker) getTypeFromIndexInfosOfContextualType(t *Type, name string, nameType *Type) *Type {
 * 	if isTupleType(t) && isNumericLiteralName(name) && jsnum.FromString(name) >= 0 {
 * 		restType := c.getElementTypeOfSliceOfTupleType(t, t.TargetTupleType().fixedLength, 0 /*endSkipCount* /, false /*writing* /, true /*noReductions* /)
 * 		if restType != nil {
 * 			return restType
 * 		}
 * 	}
 * 	if nameType == nil {
 * 		nameType = c.getStringLiteralType(name)
 * 	}
 * 	indexInfo := c.findApplicableIndexInfo(c.getIndexInfosOfStructuredType(t), nameType)
 * 	if indexInfo == nil {
 * 		return nil
 * 	}
 * 	return indexInfo.valueType
 * }
 */
export declare function Checker_getTypeFromIndexInfosOfContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string, nameType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isCircularMappedProperty","kind":"method","status":"implemented","sigHash":"2f05a1aa0710499489eb4eaa0a62482e1608e7e4029c8e5fe2674fc3ecc4f75f","bodyHash":"854f7740a171c918a8c706bb59f5334d037dc35a3b0cb2deab5fba7cc4e58faa"}
 *
 * Go source:
 * func (c *Checker) isCircularMappedProperty(symbol *ast.Symbol) bool {
 * 	if symbol.CheckFlags&ast.CheckFlagsMapped != 0 {
 * 		links := c.valueSymbolLinks.Get(symbol)
 * 		return links.resolvedType == nil && c.findResolutionCycleStartIndex(symbol, TypeSystemPropertyNameType) >= 0
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isCircularMappedProperty(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.appendContextualPropertyTypeConstituent","kind":"method","status":"implemented","sigHash":"de8312f38b351324550fbb03ae3ef50f0e6ebd4144931b7edf7a80cb58e1275e","bodyHash":"beaade94ae7556d3faff2bbc8f243815153c395e1849e22f634a66a6529b4a39"}
 *
 * Go source:
 * func (c *Checker) appendContextualPropertyTypeConstituent(types []*Type, t *Type) []*Type {
 * 	// any doesn't provide any contextual information but could spoil the overall result by nullifying contextual information
 * 	// provided by other intersection constituents so it gets replaced with `unknown` as `T & unknown` is just `T` and all
 * 	// types computed based on the contextual information provided by other constituens are still assignable to any
 * 	if t == nil {
 * 		return types
 * 	}
 * 	if t.flags&TypeFlagsAny != 0 {
 * 		return append(types, c.unknownType)
 * 	}
 * 	return append(types, t)
 * }
 */
export declare function Checker_appendContextualPropertyTypeConstituent(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, t: GoPtr<Type>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.discriminateContextualTypeByObjectMembers","kind":"method","status":"implemented","sigHash":"d9f0d99fb41d0ca101c696c7750dc48a1fb4bf4bd19336287a8039a846726aca","bodyHash":"e817cfc1621cd1e0575425cb546feae3002026598e5ac6c72e249ead9f8d003e"}
 *
 * Go source:
 * func (c *Checker) discriminateContextualTypeByObjectMembers(node *ast.Node, contextualType *Type) *Type {
 * 	key := DiscriminatedContextualTypeKey{nodeId: ast.GetNodeId(node), typeId: contextualType.id}
 * 	if discriminated := c.discriminatedContextualTypes[key]; discriminated != nil {
 * 		return discriminated
 * 	}
 * 	discriminated := c.getMatchingUnionConstituentForObjectLiteral(contextualType, node)
 * 	if discriminated == nil {
 * 		discriminantProperties := core.Filter(node.Properties(), func(p *ast.Node) bool {
 * 			symbol := p.Symbol()
 * 			if symbol == nil {
 * 				return false
 * 			}
 * 			if ast.IsPropertyAssignment(p) {
 * 				return c.isPossiblyDiscriminantValue(p.Initializer()) && c.isDiscriminantProperty(contextualType, symbol.Name)
 * 			}
 * 			if ast.IsShorthandPropertyAssignment(p) {
 * 				return c.isDiscriminantProperty(contextualType, symbol.Name)
 * 			}
 * 			return false
 * 		})
 * 		discriminantMembers := core.Filter(c.getPropertiesOfType(contextualType), func(s *ast.Symbol) bool {
 * 			return s.Flags&ast.SymbolFlagsOptional != 0 && node.Symbol().Members[s.Name] == nil && c.isDiscriminantProperty(contextualType, s.Name)
 * 		})
 * 		discriminator := &ObjectLiteralDiscriminator{c: c, props: discriminantProperties, members: discriminantMembers}
 * 		discriminated = c.discriminateTypeByDiscriminableItems(contextualType, discriminator)
 * 	}
 * 	c.discriminatedContextualTypes[key] = discriminated
 * 	return discriminated
 * }
 */
export declare function Checker_discriminateContextualTypeByObjectMembers(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextualType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isContextSensitiveFunctionLikeDeclaration","kind":"method","status":"implemented","sigHash":"6e3b8c73ac76ddafc2228616dc49738ac1e37eb3e208e324d4ab7725ef640b58","bodyHash":"0dad8f1b9e909944ea780c54d98af09d149821760cdf03d6a87e5e9170aa8f7a"}
 *
 * Go source:
 * func (c *Checker) isContextSensitiveFunctionLikeDeclaration(node *ast.Node) bool {
 * 	return ast.HasContextSensitiveParameters(node) || c.hasContextSensitiveReturnExpression(node) || c.hasContextSensitiveYieldExpression(node)
 * }
 */
export declare function Checker_isContextSensitiveFunctionLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAwaitedTypeNoAlias","kind":"method","status":"implemented","sigHash":"eee597f7291d629b5c7ead55b3bb6448f434fad5b6d45177f7d89eb7d81249ee","bodyHash":"fdfbd6a47470cefef8f46671462bc52f23d16d85aeefa40d876c48fd798cdfa9"}
 *
 * Go source:
 * func (c *Checker) getAwaitedTypeNoAlias(t *Type) *Type {
 * 	return c.getAwaitedTypeNoAliasEx(t, nil, nil)
 * }
 */
export declare function Checker_getAwaitedTypeNoAlias(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAwaitedTypeNoAliasEx","kind":"method","status":"implemented","sigHash":"e5f80b908be9605f28854e590f415cf00c959da91de857159921d27f15dcca5d","bodyHash":"1a4ca509253621df21bfab084e2731a46ea441b61c8349b4e31f8472d1ce5171"}
 *
 * Go source:
 * func (c *Checker) getAwaitedTypeNoAliasEx(t *Type, errorNode *ast.Node, diagnosticMessage *diagnostics.Message, args ...any) *Type {
 * 	if IsTypeAny(t) {
 * 		return t
 * 	}
 * 	// If this is already an `Awaited<T>`, just return it. This avoids `Awaited<Awaited<T>>` in higher-order
 * 	if c.isAwaitedTypeInstantiation(t) {
 * 		return t
 * 	}
 * 	// If we've already cached an awaited type, return a possible `Awaited<T>` for it.
 * 	key := CachedTypeKey{kind: CachedTypeKindAwaitedType, typeId: t.id}
 * 	if awaitedType := c.cachedTypes[key]; awaitedType != nil {
 * 		return awaitedType
 * 	}
 * 	// For a union, get a union of the awaited types of each constituent.
 * 	if t.flags&TypeFlagsUnion != 0 {
 * 		if slices.Contains(c.awaitedTypeStack, t) {
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Type_is_referenced_directly_or_indirectly_in_the_fulfillment_callback_of_its_own_then_method)
 * 			}
 * 			return nil
 * 		}
 * 		c.awaitedTypeStack = append(c.awaitedTypeStack, t)
 * 		mapped := c.mapType(t, func(t *Type) *Type { return c.getAwaitedTypeNoAliasEx(t, errorNode, diagnosticMessage, args...) })
 * 		c.awaitedTypeStack = c.awaitedTypeStack[:len(c.awaitedTypeStack)-1]
 * 		c.cachedTypes[key] = mapped
 * 		return mapped
 * 	}
 * 	// If `type` is generic and should be wrapped in `Awaited<T>`, return it.
 * 	if c.isAwaitedTypeNeeded(t) {
 * 		c.cachedTypes[key] = t
 * 		return t
 * 	}
 * 	var thisTypeForError *Type
 * 	promisedType := c.getPromisedTypeOfPromiseEx(t, nil /*errorNode* /, &thisTypeForError)
 * 	if promisedType != nil {
 * 		if t == promisedType || slices.Contains(c.awaitedTypeStack, promisedType) {
 * 			// Verify that we don't have a bad actor in the form of a promise whose
 * 			// promised type is the same as the promise type, or a mutually recursive
 * 			// promise. If so, we return undefined as we cannot guess the shape. If this
 * 			// were the actual case in the JavaScript, this Promise would never resolve.
 * 			//
 * 			// An example of a bad actor with a singly-recursive promise type might
 * 			// be:
 * 			//
 * 			//  interface BadPromise {
 * 			//      then(
 * 			//          onfulfilled: (value: BadPromise) => any,
 * 			//          onrejected: (error: any) => any): BadPromise;
 * 			//  }
 * 			//
 * 			// The above interface will pass the PromiseLike check, and return a
 * 			// promised type of `BadPromise`. Since this is a self reference, we
 * 			// don't want to keep recursing ad infinitum.
 * 			//
 * 			// An example of a bad actor in the form of a mutually-recursive
 * 			// promise type might be:
 * 			//
 * 			//  interface BadPromiseA {
 * 			//      then(
 * 			//          onfulfilled: (value: BadPromiseB) => any,
 * 			//          onrejected: (error: any) => any): BadPromiseB;
 * 			//  }
 * 			//
 * 			//  interface BadPromiseB {
 * 			//      then(
 * 			//          onfulfilled: (value: BadPromiseA) => any,
 * 			//          onrejected: (error: any) => any): BadPromiseA;
 * 			//  }
 * 			//
 * 			if errorNode != nil {
 * 				c.error(errorNode, diagnostics.Type_is_referenced_directly_or_indirectly_in_the_fulfillment_callback_of_its_own_then_method)
 * 			}
 * 			return nil
 * 		}
 * 		// Keep track of the type we're about to unwrap to avoid bad recursive promise types.
 * 		// See the comments above for more information.
 * 		c.awaitedTypeStack = append(c.awaitedTypeStack, t)
 * 		awaitedType := c.getAwaitedTypeNoAliasEx(promisedType, errorNode, diagnosticMessage, args...)
 * 		c.awaitedTypeStack = c.awaitedTypeStack[:len(c.awaitedTypeStack)-1]
 * 		if awaitedType == nil {
 * 			return nil
 * 		}
 * 		c.cachedTypes[key] = awaitedType
 * 		return awaitedType
 * 	}
 * 	// The type was not a promise, so it could not be unwrapped any further.
 * 	// As long as the type does not have a callable "then" property, it is
 * 	// safe to return the type; otherwise, an error is reported and we return
 * 	// undefined.
 * 	//
 * 	// An example of a non-promise "thenable" might be:
 * 	//
 * 	//  await { then(): void {} }
 * 	//
 * 	// The "thenable" does not match the minimal definition for a promise. When
 * 	// a Promise/A+-compatible or ES6 promise tries to adopt this value, the promise
 * 	// will never settle. We treat this as an error to help flag an early indicator
 * 	// of a runtime problem. If the user wants to return this value from an async
 * 	// function, they would need to wrap it in some other value. If they want it to
 * 	// be treated as a promise, they can cast to <any>.
 * 	if c.isThenableType(t) {
 * 		if errorNode != nil {
 * 			var diagnostic *ast.Diagnostic
 * 			if thisTypeForError != nil {
 * 				diagnostic = NewDiagnosticForNode(errorNode, diagnostics.The_this_context_of_type_0_is_not_assignable_to_method_s_this_of_type_1, c.TypeToString(t), c.TypeToString(thisTypeForError))
 * 			}
 * 			c.addDiagnostic(NewDiagnosticChainForNode(diagnostic, errorNode, diagnosticMessage, args...))
 * 		}
 * 		return nil
 * 	}
 * 	c.cachedTypes[key] = t
 * 	return t
 * }
 */
export declare function Checker_getAwaitedTypeNoAliasEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, errorNode: GoPtr<Node>, diagnosticMessage: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSomeSymbolAssigned","kind":"method","status":"implemented","sigHash":"7abf1804e9a60103cd96133da50bc7289dd901ff9eb3efb31a193b3cdbeca549","bodyHash":"e3ddbf1d040517b8ec6c7ff49ce8ffafec6c5503b6a6954ef77a1f07b92f820b"}
 *
 * Go source:
 * func (c *Checker) isSomeSymbolAssigned(rootDeclaration *ast.Node) bool {
 * 	return c.isSomeSymbolAssignedWorker(rootDeclaration.Name())
 * }
 */
export declare function Checker_isSomeSymbolAssigned(receiver: GoPtr<Checker>, rootDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSomeSymbolAssignedWorker","kind":"method","status":"implemented","sigHash":"905506897f2bd160c292f6029f5eefc6627e03fced63625a9af3b24594247b90","bodyHash":"b38fdfcf2e53b1eaf27f3f50b6aa7fccff339b8ae2db2a0dc9431c1f7c1e125a"}
 *
 * Go source:
 * func (c *Checker) isSomeSymbolAssignedWorker(node *ast.Node) bool {
 * 	if node.Kind == ast.KindIdentifier {
 * 		return c.isSymbolAssigned(c.getSymbolOfDeclaration(node.Parent))
 * 	}
 * 	return core.Some(node.Elements(), func(e *ast.Node) bool {
 * 		return e.Name() != nil && c.isSomeSymbolAssignedWorker(e.Name())
 * 	})
 * }
 */
export declare function Checker_isSomeSymbolAssignedWorker(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetSymbolAtLocation","kind":"method","status":"implemented","sigHash":"cfb3e9b95060ceb831e1fbb4444da922ee41c3af2ce8434b7e76de0b75dd03a6","bodyHash":"01c996cbb7086ed258e2572880ca4e8758227bd43a6fe8a4d5c207a65c94a1af"}
 *
 * Go source:
 * func (c *Checker) GetSymbolAtLocation(node *ast.Node) *ast.Symbol {
 * 	// !!!
 * 	// const node = getParseTreeNode(nodeIn);
 *
 * 	// set ignoreErrors: true because any lookups invoked by the API shouldn't cause any new errors
 * 	return c.getSymbolAtLocation(ast.GetReparsedNodeForNode(node), true /*ignoreErrors* /)
 * }
 */
export declare function Checker_GetSymbolAtLocation(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolAtLocation","kind":"method","status":"implemented","sigHash":"5636ae09b751b8579f2bc6cd2fae0070db770e45aa20a7aff5670e1f68a6e6a3","bodyHash":"4e51d558ea763f45695f9ccf00e43a118a18e62cbd10e65f21b5d865bddcba80"}
 *
 * Go source:
 * func (c *Checker) getSymbolAtLocation(node *ast.Node, ignoreErrors bool) *ast.Symbol {
 * 	if ast.IsSourceFile(node) {
 * 		if ast.IsExternalOrCommonJSModule(node.AsSourceFile()) {
 * 			return c.getMergedSymbol(node.Symbol())
 * 		}
 * 		return nil
 * 	}
 * 	parent := node.Parent
 * 	grandParent := parent.Parent
 *
 * 	if node.Flags&ast.NodeFlagsInWithStatement != 0 {
 * 		// We cannot answer semantic questions within a with block, do not proceed any further
 * 		return nil
 * 	}
 *
 * 	if ast.IsDeclarationNameOrImportPropertyName(node) {
 * 		// This is a declaration, call getSymbolOfNode
 * 		parentSymbol := c.getSymbolOfDeclaration(parent)
 * 		if ast.IsImportOrExportSpecifier(parent) && parent.PropertyName() == node {
 * 			return c.getImmediateAliasedSymbol(parentSymbol)
 * 		}
 * 		return parentSymbol
 * 	} else if ast.IsLiteralComputedPropertyDeclarationName(node) {
 * 		return c.getSymbolOfDeclaration(grandParent)
 * 	}
 *
 * 	if ast.IsIdentifier(node) {
 * 		if isInRightSideOfImportOrExportAssignment(node) {
 * 			return c.getSymbolOfNameOrPropertyAccessExpression(node)
 * 		} else if ast.IsBindingElement(parent) && ast.IsObjectBindingPattern(grandParent) && node == parent.PropertyName() {
 * 			typeOfPattern := c.getTypeOfNode(grandParent)
 * 			if propertyDeclaration := c.getPropertyOfType(typeOfPattern, node.Text()); propertyDeclaration != nil {
 * 				return propertyDeclaration
 * 			}
 * 		} else if ast.IsMetaProperty(parent) && parent.Name() == node {
 * 			metaProp := parent.AsMetaProperty()
 * 			if metaProp.KeywordToken == ast.KindNewKeyword && node.Text() == "target" {
 * 				// `target` in `new.target`
 * 				return c.checkNewTargetMetaProperty(parent).symbol
 * 			}
 * 			// The `meta` in `import.meta` could be given `getTypeOfNode(parent).symbol` (the `ImportMeta` interface symbol), but
 * 			// we have a fake expression type made for other reasons already, whose transient `meta`
 * 			// member should more exactly be the kind of (declarationless) symbol we want.
 * 			// (See #44364 and #45031 for relevant implementation PRs)
 * 			if metaProp.KeywordToken == ast.KindImportKeyword && node.Text() == "meta" {
 * 				return c.getGlobalImportMetaExpressionType().AsObjectType().members["meta"]
 * 			}
 * 			// no other meta properties are valid syntax, thus no others should have symbols
 * 			return nil
 * 		} else if ast.IsJSDocParameterTag(parent) && parent.Name() == node {
 * 			if fn := ast.GetNodeAtPosition(ast.GetSourceFileOfNode(node), node.Pos(), false); fn != nil && ast.IsFunctionLike(fn) {
 * 				for _, param := range fn.Parameters() {
 * 					if ast.IsIdentifier(param.Name()) && param.Name().Text() == node.Text() {
 * 						return c.getSymbolOfNode(param)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier, ast.KindPrivateIdentifier, ast.KindPropertyAccessExpression, ast.KindQualifiedName:
 * 		if !ast.IsThisInTypeQuery(node) {
 * 			return c.getSymbolOfNameOrPropertyAccessExpression(node)
 * 		}
 * 		fallthrough
 * 	case ast.KindThisKeyword:
 * 		container := c.getThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 		if ast.IsFunctionLike(container) {
 * 			sig := c.getSignatureFromDeclaration(container)
 * 			if sig.thisParameter != nil {
 * 				return sig.thisParameter
 * 			}
 * 		}
 * 		if ast.IsInExpressionContext(node) {
 * 			return c.checkExpression(node).symbol
 * 		}
 * 		fallthrough
 * 	case ast.KindThisType:
 * 		return c.getTypeFromThisTypeNode(node).symbol
 * 	case ast.KindSuperKeyword:
 * 		return c.checkExpression(node).symbol
 * 	case ast.KindConstructorKeyword:
 * 		// constructor keyword for an overload, should take us to the definition if it exist
 * 		constructorDeclaration := parent
 * 		if constructorDeclaration != nil && constructorDeclaration.Kind == ast.KindConstructor {
 * 			return constructorDeclaration.Parent.Symbol()
 * 		}
 * 		return nil
 * 	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral:
 * 		// 1). import x = require("./mo/*gotToDefinitionHere* /d")
 * 		// 2). External module name in an import declaration
 * 		// 3). Require in Javascript
 * 		// 4). type A = import("./f/*gotToDefinitionHere* /oo")
 * 		if (ast.IsExternalModuleImportEqualsDeclaration(grandParent) && ast.GetExternalModuleImportEqualsDeclarationExpression(grandParent) == node) ||
 * 			((parent.Kind == ast.KindImportDeclaration || parent.Kind == ast.KindJSImportDeclaration || parent.Kind == ast.KindExportDeclaration) && ast.GetExternalModuleName(parent) == node) ||
 * 			ast.IsVariableDeclarationInitializedToRequire(grandParent) || ast.IsImportCall(parent) ||
 * 			(ast.IsLiteralTypeNode(parent) && ast.IsLiteralImportTypeNode(grandParent) && grandParent.AsImportTypeNode().Argument == parent) {
 * 			return c.resolveExternalModuleName(node, node, ignoreErrors)
 * 		}
 * 		if ast.IsCallExpression(parent) && ast.IsBindableObjectDefinePropertyCall(parent) && parent.Arguments()[1] == node {
 * 			return c.getSymbolOfDeclaration(parent)
 * 		}
 * 		fallthrough
 * 	case ast.KindNumericLiteral:
 * 		// index access
 * 		var objectType *Type
 * 		if ast.IsElementAccessExpression(parent) {
 * 			if parent.AsElementAccessExpression().ArgumentExpression == node {
 * 				objectType = c.getTypeOfExpression(parent.Expression())
 * 			}
 * 		} else if ast.IsLiteralTypeNode(parent) && ast.IsIndexedAccessTypeNode(grandParent) {
 * 			objectType = c.getTypeFromTypeNode(grandParent.AsIndexedAccessTypeNode().ObjectType)
 * 		}
 *
 * 		if objectType != nil {
 * 			return c.getPropertyOfType(objectType, node.Text())
 * 		}
 * 		return nil
 * 	case ast.KindDefaultKeyword, ast.KindFunctionKeyword, ast.KindEqualsGreaterThanToken, ast.KindClassKeyword:
 * 		return c.getSymbolOfNode(node.Parent)
 * 	case ast.KindImportType:
 * 		if ast.IsLiteralImportTypeNode(node) {
 * 			return c.getSymbolAtLocation(node.AsImportTypeNode().Argument.AsLiteralTypeNode().Literal, ignoreErrors)
 * 		}
 * 		return nil
 * 	case ast.KindExportKeyword:
 * 		if ast.IsExportAssignment(parent) {
 * 			if parent.Symbol() == nil {
 * 				panic("Symbol should be defined")
 * 			}
 * 			return parent.Symbol()
 * 		}
 * 		return nil
 * 	case ast.KindImportKeyword:
 * 		if ast.IsMetaProperty(node.Parent) && node.Parent.Text() == "defer" {
 * 			return nil
 * 		}
 * 		fallthrough
 * 	case ast.KindNewKeyword:
 * 		if ast.IsMetaProperty(parent) {
 * 			return c.checkMetaPropertyKeyword(parent).symbol
 * 		}
 * 		return nil
 * 	case ast.KindInstanceOfKeyword:
 * 		if ast.IsBinaryExpression(parent) {
 * 			t := c.getTypeOfExpression(parent.AsBinaryExpression().Right)
 * 			hasInstanceMethodType := c.getSymbolHasInstanceMethodOfObjectType(t)
 * 			if hasInstanceMethodType != nil && hasInstanceMethodType.symbol != nil {
 * 				return hasInstanceMethodType.symbol
 * 			}
 * 			return t.symbol
 * 		}
 * 		return nil
 * 	case ast.KindMetaProperty:
 * 		return c.checkExpression(node).symbol
 * 	case ast.KindJsxNamespacedName:
 * 		if ast.IsJsxTagName(node) && isJsxIntrinsicTagName(node) {
 * 			symbol := c.getIntrinsicTagSymbol(node.Parent)
 * 			if symbol == c.unknownSymbol {
 * 				return nil
 * 			}
 * 			return symbol
 * 		}
 * 		fallthrough
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export declare function Checker_getSymbolAtLocation(receiver: GoPtr<Checker>, node: GoPtr<Node>, ignoreErrors: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSymbolOfNameOrPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"d74d45479e531c2ef5dbf28fe8ccf3340b9560ba16b23cfbeadf03e463abb252","bodyHash":"e17bd0580c532dd1dfe1cebe66c2cc8ce83dc1e1765ba5cf5c5cdce14a27e4b6"}
 *
 * Go source:
 * func (c *Checker) getSymbolOfNameOrPropertyAccessExpression(name *ast.Node) *ast.Symbol {
 * 	if ast.IsDeclarationName(name) {
 * 		return c.getSymbolOfNode(name.Parent)
 * 	}
 * 	if name.Parent.Kind == ast.KindExportAssignment && ast.IsEntityNameExpression(name) {
 * 		// Even an entity name expression that doesn't resolve as an entityname may still typecheck as a property access expression
 * 		success := c.resolveEntityName(
 * 			name,
 * 			/*all meanings* / ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias,
 * 			true /*ignoreErrors* /, false /*dontResolveAlias* /, nil /*location* /)
 * 		if success != nil && success != c.unknownSymbol {
 * 			return success
 * 		}
 * 	} else if ast.IsEntityName(name) && isInRightSideOfImportOrExportAssignment(name) {
 * 		// Since we already checked for ExportAssignment, this really could only be an Import
 * 		importEqualsDeclaration := ast.FindAncestorKind(name, ast.KindImportEqualsDeclaration)
 * 		if importEqualsDeclaration == nil {
 * 			panic("ImportEqualsDeclaration should be defined")
 * 		}
 * 		return c.getSymbolOfPartOfRightHandSideOfImportEquals(name)
 * 	}
 *
 * 	if ast.IsEntityName(name) {
 * 		possibleImportNode := isImportTypeQualifierPart(name)
 * 		if possibleImportNode != nil {
 * 			c.getTypeFromTypeNode(possibleImportNode)
 * 			sym := c.getResolvedSymbolOrNil(name)
 * 			return core.IfElse(sym == c.unknownSymbol, nil, sym)
 * 		}
 * 	}
 *
 * 	for ast.IsRightSideOfQualifiedNameOrPropertyAccess(name) {
 * 		name = name.Parent
 * 	}
 *
 * 	if isInNameOfExpressionWithTypeArguments(name) {
 * 		var meaning ast.SymbolFlags
 * 		if name.Parent.Kind == ast.KindExpressionWithTypeArguments {
 * 			// An 'ExpressionWithTypeArguments' may appear in type space (interface Foo extends Bar<T>),
 * 			// value space (return foo<T>), or both(class Foo extends Bar<T>); ensure the meaning matches.
 * 			meaning = core.IfElse(ast.IsPartOfTypeNode(name), ast.SymbolFlagsType, ast.SymbolFlagsValue)
 *
 * 			// In a class 'extends' clause we are also looking for a value.
 * 			if ast.IsExpressionWithTypeArgumentsInClassExtendsClause(name.Parent) {
 * 				meaning = meaning | ast.SymbolFlagsValue
 * 			}
 * 		} else {
 * 			meaning = ast.SymbolFlagsNamespace
 * 		}
 *
 * 		meaning = meaning | ast.SymbolFlagsAlias
 * 		var entityNameSymbol *ast.Symbol
 * 		if ast.IsEntityNameExpression(name) {
 * 			entityNameSymbol = c.resolveEntityName(name, meaning, true /*ignoreErrors* /, false /*dontResolveAlias* /, nil /*location* /)
 * 		}
 * 		if entityNameSymbol != nil {
 * 			return entityNameSymbol
 * 		}
 * 	}
 *
 * 	if ast.IsExpressionNode(name) {
 * 		if ast.NodeIsMissing(name) {
 * 			// Missing entity name.
 * 			return nil
 * 		}
 * 		isJSDoc := ast.IsJSDocNameReferenceContext(name)
 * 		if ast.IsIdentifier(name) {
 * 			if ast.IsJsxTagName(name) && isJsxIntrinsicTagName(name) {
 * 				symbol := c.getIntrinsicTagSymbol(name.Parent)
 * 				return core.IfElse(symbol == c.unknownSymbol, nil, symbol)
 * 			}
 * 			meaning := core.IfElse(isJSDoc, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace, ast.SymbolFlagsValue)
 * 			var location *ast.Node
 * 			if isJSDoc {
 * 				location = ast.GetHostSignatureFromJSDoc(name)
 * 			}
 * 			result := c.resolveEntityName(name, meaning, true /*ignoreErrors* /, true /*dontResolveAlias* /, location)
 * 			if result == nil && isJSDoc {
 * 				if container := ast.FindAncestor(name, ast.IsClassOrInterfaceLike); container != nil {
 * 					symbol := c.getSymbolOfDeclaration(container)
 * 					// Handle unqualified references to class static members and class or interface instance members
 * 					if result = c.getMergedSymbol(c.getSymbol(c.getExportsOfSymbol(symbol), name.Text(), meaning)); result == nil {
 * 						result = c.getPropertyOfType(c.getDeclaredTypeOfSymbol(symbol), name.Text())
 * 					}
 * 				}
 * 			}
 * 			return result
 * 		} else if ast.IsPrivateIdentifier(name) {
 * 			return c.getSymbolForPrivateIdentifierExpression(name)
 * 		} else if ast.IsPropertyAccessExpression(name) || ast.IsQualifiedName(name) {
 * 			links := c.symbolNodeLinks.Get(name)
 * 			if links.resolvedSymbol != nil {
 * 				return links.resolvedSymbol
 * 			}
 * 			if ast.IsPropertyAccessExpression(name) {
 * 				c.checkPropertyAccessExpression(name, CheckModeNormal, false /*writeOnly* /)
 * 				if links.resolvedSymbol == nil && !ast.IsPrivateIdentifier(name.Name()) {
 * 					links.resolvedSymbol = c.getApplicableIndexSymbol(
 * 						c.checkExpressionCached(name.Expression()),
 * 						c.getLiteralTypeFromPropertyName(name.Name()),
 * 					)
 * 				}
 * 			} else {
 * 				c.checkQualifiedName(name, CheckModeNormal)
 * 			}
 * 			if links.resolvedSymbol == nil && isJSDoc && ast.IsQualifiedName(name) {
 * 				return c.resolveJSDocMemberName(name)
 * 			}
 * 			return links.resolvedSymbol
 * 		}
 * 	} else if ast.IsEntityName(name) && isTypeReferenceIdentifier(name) {
 * 		meaning := core.IfElse(name.Parent.Kind == ast.KindTypeReference, ast.SymbolFlagsType, ast.SymbolFlagsNamespace)
 * 		symbol := c.resolveEntityName(name, meaning, true /*ignoreErrors* /, true /*dontResolveAlias* /, nil /*location* /)
 * 		if symbol != nil && symbol != c.unknownSymbol {
 * 			return symbol
 * 		}
 * 		return c.getUnresolvedSymbolForEntityName(name)
 * 	}
 *
 * 	if name.Parent.Kind == ast.KindTypePredicate {
 * 		return c.resolveEntityName(
 * 			name,
 * 			ast.SymbolFlagsFunctionScopedVariable, /*meaning* /
 * 			true,                                  /*ignoreErrors* /
 * 			false,                                 /*dontResolveAlias* /
 * 			nil,                                   /*location* /
 * 		)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getSymbolOfNameOrPropertyAccessExpression(receiver: GoPtr<Checker>, name: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetAliasedSymbol","kind":"method","status":"implemented","sigHash":"2319ef734fd733ddd70fe88e72a0dbdf96f964bb90a6f2fc7d0b326dc492889c","bodyHash":"33787bdc989f40f33808b546d435c5619b4bee67d8618eb62522c604e76d39e4"}
 *
 * Go source:
 * func (c *Checker) GetAliasedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.resolveAlias(symbol)
 * }
 */
export declare function Checker_GetAliasedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol>;
//# sourceMappingURL=symbols.d.ts.map
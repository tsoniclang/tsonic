import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import { Node_Locals, Node_Body, Node_Type, Node_Parameters, Node_Expression, Node_Symbol, Node_LocalSymbol, AsSourceFile, Node_ModuleSpecifier, Node_Text } from "../ast/ast.js";
import { Node_Name, Node_BodyData, Node_ForEachChild, Node_Pos, Node_End } from "../ast/spine.js";
import type { Node } from "../ast/ast.js";
import { AsConditionalTypeNode, AsFunctionExpression, AsHeritageClause, AsParameterDeclaration, AsBindingElement, AsInferTypeNode, AsExportSpecifier, AsPropertyDeclaration, AsTypeParameterDeclaration } from "../ast/generated/casts.js";
import { KindSourceFile, KindModuleDeclaration, KindEnumDeclaration, KindPropertyDeclaration, KindClassDeclaration, KindClassExpression, KindInterfaceDeclaration, KindExpressionWithTypeArguments, KindComputedPropertyName, KindMethodDeclaration, KindConstructor, KindGetAccessor, KindSetAccessor, KindFunctionDeclaration, KindFunctionExpression, KindDecorator, KindParameter, KindBindingElement, KindInferType, KindExportSpecifier, KindConditionalType, KindTypeParameter, KindExtendsKeyword, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration, KindNamespaceExport, KindArrowFunction, KindPropertyAssignment } from "../ast/generated/kinds.js";
import { NodeFlagsSynthesized, NodeFlagsAmbient, SymbolFlagsFunction } from "../ast/generated/flags.js";
import { SymbolFlagsType, SymbolFlagsTypeParameter, SymbolFlagsVariable, SymbolFlagsFunctionScopedVariable, SymbolFlagsClass, SymbolFlagsGlobalLookup, SymbolFlagsModuleMember, SymbolFlagsEnumMember, SymbolFlagsProperty, SymbolFlagsTransient, SymbolFlagsAlias, SymbolFlagsValue } from "../ast/symbolflags.js";
import { ModifierFlagsDefault, ModifierFlagsAsync } from "../ast/modifierflags.js";
import { InternalSymbolNameDefault } from "../ast/symbol.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { Symbol, SymbolTable } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import {
  IsConstAssertion, IsModuleOrEnumDeclaration, IsGlobalSourceFile, IsFunctionLike,
  IsBindingPattern, IsParameterLike, IsPartOfParameterDeclaration, IsClassLike,
  IsClassElement, IsExternalOrCommonJSModule, IsGlobalScopeAugmentation, GetDeclarationOfKind,
  IsStatic, FindConstructorDeclaration, IsNullishCoalesce, IsOptionalChain, IsTypeNode,
  IsFunctionLikeDeclaration, HasStaticModifier, GetImmediatelyInvokedFunctionExpression,
  HasSyntacticModifier, IsInJSFile, IsRequireCall,
  GetSourceFileOfNode, FindAncestor,
} from "../ast/utilities.js";
import { IsSourceFile, IsModuleDeclaration, IsBindingElement, IsParameterDeclaration, IsClassExpression, IsInterfaceDeclaration, IsHeritageClause, IsObjectBindingPattern, IsTypeQueryNode } from "../ast/generated/predicates.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { CompilerOptions_GetEmitScriptTarget, CompilerOptions_GetEmitStandardClassFields, CompilerOptions_GetIsolatedModules, ScriptTargetES2020, ScriptTargetES2017 } from "../core/compileroptions.js";
import { IfElse, Some } from "../core/core.js";
import type { Tristate } from "../core/tristate.js";
import { TSUnknown, TSTrue, TSFalse } from "../core/tristate.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { Cannot_access_0_from_another_file_without_qualification_when_1_is_enabled_Use_2_instead, Static_members_cannot_reference_class_type_parameters, Base_class_expressions_cannot_reference_class_type_parameters, A_computed_property_name_cannot_reference_a_type_parameter_from_its_containing_type } from "../diagnostics/generated/messages.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::type::NameResolver","kind":"type","status":"implemented","sigHash":"d94405adce18614a3bbc95fd4d2e6a922712412fd7e622beb57b4a8a12dfc016","bodyHash":"19eada1e576611b431560f17e42127ad5d94199b35fc81585e1e566cbe9e761c"}
 *
 * Go source:
 * NameResolver struct {
 * 	CompilerOptions                  *core.CompilerOptions
 * 	GetSymbolOfDeclaration           func(node *ast.Node) *ast.Symbol
 * 	Error                            func(location *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic
 * 	Globals                          ast.SymbolTable
 * 	ArgumentsSymbol                  *ast.Symbol
 * 	RequireSymbol                    *ast.Symbol
 * 	Lookup                           func(symbols ast.SymbolTable, name string, meaning ast.SymbolFlags) *ast.Symbol
 * 	SymbolReferenced                 func(symbol *ast.Symbol, meaning ast.SymbolFlags)
 * 	SetRequiresScopeChangeCache      func(node *ast.Node, value core.Tristate)
 * 	GetRequiresScopeChangeCache      func(node *ast.Node) core.Tristate
 * 	OnPropertyWithInvalidInitializer func(location *ast.Node, name string, declaration *ast.Node, result *ast.Symbol) bool
 * 	OnFailedToResolveSymbol          func(location *ast.Node, name string, meaning ast.SymbolFlags, nameNotFoundMessage *diagnostics.Message)
 * 	OnSuccessfullyResolvedSymbol     func(location *ast.Node, result *ast.Symbol, meaning ast.SymbolFlags, lastLocation *ast.Node, associatedDeclarationForContainingInitializerOrBindingName *ast.Node, withinDeferredContext bool)
 * }
 */
export interface NameResolver {
  CompilerOptions: GoPtr<CompilerOptions>;
  GetSymbolOfDeclaration?: (node: GoPtr<Node>) => GoPtr<Symbol>;
  Error?: (location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>) => GoPtr<Diagnostic>;
  Globals?: SymbolTable;
  ArgumentsSymbol?: GoPtr<Symbol>;
  RequireSymbol?: GoPtr<Symbol>;
  Lookup?: (symbols: SymbolTable | undefined, name: string, meaning: SymbolFlags) => GoPtr<Symbol>;
  SymbolReferenced?: (symbol_: GoPtr<Symbol>, meaning: SymbolFlags) => void;
  SetRequiresScopeChangeCache?: (node: GoPtr<Node>, value: Tristate) => void;
  GetRequiresScopeChangeCache?: (node: GoPtr<Node>) => Tristate;
  OnPropertyWithInvalidInitializer?: (location: GoPtr<Node>, name: string, declaration: GoPtr<Node>, result: GoPtr<Symbol>) => bool;
  OnFailedToResolveSymbol?: (location: GoPtr<Node>, name: string, meaning: SymbolFlags, nameNotFoundMessage: GoPtr<Message>) => void;
  OnSuccessfullyResolvedSymbol?: (location: GoPtr<Node>, result: GoPtr<Symbol>, meaning: SymbolFlags, lastLocation: GoPtr<Node>, associatedDeclarationForContainingInitializerOrBindingName: GoPtr<Node>, withinDeferredContext: bool) => void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.Resolve","kind":"method","status":"implemented","sigHash":"0f4191719b08d3d15de2cc99cabc73488e5180e51315fa460d804c84d8b01a66","bodyHash":"02ed75ae3c423ed6d0fdd4c00e35ffd2745febc8d08f672b84586a65a52acbaa"}
 *
 * Go source:
 * func (r *NameResolver) Resolve(location *ast.Node, name string, meaning ast.SymbolFlags, nameNotFoundMessage *diagnostics.Message, isUse bool, excludeGlobals bool) *ast.Symbol {
 * 	var result *ast.Symbol
 * 	var lastLocation *ast.Node
 * 	var lastSelfReferenceLocation *ast.Node
 * 	var propertyWithInvalidInitializer *ast.Node
 * 	var associatedDeclarationForContainingInitializerOrBindingName *ast.Node
 * 	var withinDeferredContext bool
 * 	var grandparent *ast.Node
 * 	originalLocation := location // needed for did-you-mean error reporting, which gathers candidates starting from the original location
 * 	nameIsConst := name == "const"
 * loop:
 * 	for location != nil {
 * 		if nameIsConst && ast.IsConstAssertion(location) {
 * 			// `const` in an `as const` has no symbol, but issues no error because there is no *actual* lookup of the type
 * 			// (it refers to the constant type of the expression instead)
 * 			return nil
 * 		}
 * 		if ast.IsModuleOrEnumDeclaration(location) && lastLocation != nil && location.Name() == lastLocation {
 * 			// If lastLocation is the name of a namespace or enum, skip the parent since it will have is own locals that could
 * 			// conflict.
 * 			lastLocation = location
 * 			location = location.Parent
 * 		}
 * 		locals := location.Locals()
 * 		// Locals of a source file are not in scope (because they get merged into the global symbol table)
 * 		if locals != nil && !ast.IsGlobalSourceFile(location) {
 * 			result = r.lookup(locals, name, meaning)
 * 			if result != nil {
 * 				useResult := true
 * 				if ast.IsFunctionLike(location) && lastLocation != nil && lastLocation != location.Body() {
 * 					// symbol lookup restrictions for function-like declarations
 * 					// - Type parameters of a function are in scope in the entire function declaration, including the parameter
 * 					//   list and return type. However, local types are only in scope in the function body.
 * 					// - parameters are only in the scope of function body
 * 					if meaning&result.Flags&ast.SymbolFlagsType != 0 {
 * 						useResult = result.Flags&ast.SymbolFlagsTypeParameter != 0 && (lastLocation == location.Type() || ast.IsParameterLike(lastLocation))
 * 					}
 * 					if meaning&result.Flags&ast.SymbolFlagsVariable != 0 {
 * 						// expression inside parameter will lookup as normal variable scope when targeting es2015+
 * 						if r.useOuterVariableScopeInParameter(result, location, lastLocation) {
 * 							useResult = false
 * 						} else if result.Flags&ast.SymbolFlagsFunctionScopedVariable != 0 {
 * 							// parameters are visible only inside function body, parameter list and return type
 * 							// technically for parameter list case here we might mix parameters and variables declared in function,
 * 							// however it is detected separately when checking initializers of parameters
 * 							// to make sure that they reference no variables declared after them.
 * 							useResult = lastLocation.Kind == ast.KindParameter ||
 * 								lastLocation.Flags&ast.NodeFlagsSynthesized != 0 ||
 * 								lastLocation == location.Type() && ast.FindAncestor(result.ValueDeclaration, ast.IsParameterDeclaration) != nil
 * 						}
 * 					}
 * 				} else if location.Kind == ast.KindConditionalType {
 * 					// A type parameter declared using 'infer T' in a conditional type is visible only in
 * 					// the true branch of the conditional type.
 * 					useResult = lastLocation == location.AsConditionalTypeNode().TrueType
 * 				}
 * 				if useResult {
 * 					break loop
 * 				}
 * 				result = nil
 * 			}
 * 		}
 * 		withinDeferredContext = withinDeferredContext || getIsDeferredContext(location, lastLocation)
 * 		switch location.Kind {
 * 		case ast.KindSourceFile:
 * 			if !ast.IsExternalOrCommonJSModule(location.AsSourceFile()) {
 * 				break
 * 			}
 * 			fallthrough
 * 		case ast.KindModuleDeclaration:
 * 			moduleSymbol := r.getSymbolOfDeclaration(location)
 * 			if moduleSymbol == nil {
 * 				break
 * 			}
 * 			moduleExports := moduleSymbol.Exports
 * 			if ast.IsSourceFile(location) || (ast.IsModuleDeclaration(location) && location.Flags&ast.NodeFlagsAmbient != 0 && !ast.IsGlobalScopeAugmentation(location)) {
 * 				// It's an external module. First see if the module has an export default and if the local
 * 				// name of that export default matches.
 * 				result = moduleExports[ast.InternalSymbolNameDefault]
 * 				if result != nil {
 * 					localSymbol := GetLocalSymbolForExportDefault(result)
 * 					if localSymbol != nil && result.Flags&meaning != 0 && localSymbol.Name == name {
 * 						break loop
 * 					}
 * 					result = nil
 * 				}
 * 				// Because of module/namespace merging, a module's exports are in scope,
 * 				// yet we never want to treat an export specifier as putting a member in scope.
 * 				// Therefore, if the name we find is purely an export specifier, it is not actually considered in scope.
 * 				// Two things to note about this:
 * 				//     1. We have to check this without calling getSymbol. The problem with calling getSymbol
 * 				//        on an export specifier is that it might find the export specifier itself, and try to
 * 				//        resolve it as an alias. This will cause the checker to consider the export specifier
 * 				//        a circular alias reference when it might not be.
 * 				//     2. We check === SymbolFlags.Alias in order to check that the symbol is *purely*
 * 				//        an alias. If we used &, we'd be throwing out symbols that have non alias aspects,
 * 				//        which is not the desired behavior.
 * 				moduleExport := moduleExports[name]
 * 				if moduleExport != nil && moduleExport.Flags == ast.SymbolFlagsAlias && (ast.GetDeclarationOfKind(moduleExport, ast.KindExportSpecifier) != nil || ast.GetDeclarationOfKind(moduleExport, ast.KindNamespaceExport) != nil) {
 * 					break
 * 				}
 * 			}
 * 			if name != ast.InternalSymbolNameDefault {
 * 				if result = r.lookup(moduleExports, name, meaning&ast.SymbolFlagsModuleMember); result != nil {
 * 					if ast.IsSourceFile(location) && location.AsSourceFile().CommonJSModuleIndicator != nil && result.Flags&ast.SymbolFlagsType == 0 {
 * 						result = nil
 * 					} else {
 * 						break loop
 * 					}
 * 				}
 * 			}
 * 		case ast.KindEnumDeclaration:
 * 			enumSymbol := r.getSymbolOfDeclaration(location)
 * 			if enumSymbol == nil {
 * 				break
 * 			}
 * 			result = r.lookup(enumSymbol.Exports, name, meaning&ast.SymbolFlagsEnumMember)
 * 			if result != nil {
 * 				if nameNotFoundMessage != nil && r.CompilerOptions.GetIsolatedModules() && location.Flags&ast.NodeFlagsAmbient == 0 && ast.GetSourceFileOfNode(location) != ast.GetSourceFileOfNode(result.ValueDeclaration) {
 * 					isolatedModulesLikeFlagName := core.IfElse(r.CompilerOptions.VerbatimModuleSyntax == core.TSTrue, "verbatimModuleSyntax", "isolatedModules")
 * 					r.error(originalLocation, diagnostics.Cannot_access_0_from_another_file_without_qualification_when_1_is_enabled_Use_2_instead,
 * 						name, isolatedModulesLikeFlagName, enumSymbol.Name+"."+name)
 * 				}
 * 				break loop
 * 			}
 * 		case ast.KindPropertyDeclaration:
 * 			if !ast.IsStatic(location) {
 * 				ctor := ast.FindConstructorDeclaration(location.Parent)
 * 				if ctor != nil && ctor.Locals() != nil {
 * 					if r.lookup(ctor.Locals(), name, meaning&ast.SymbolFlagsValue) != nil {
 * 						// Remember the property node, it will be used later to report appropriate error
 * 						propertyWithInvalidInitializer = location
 * 					}
 * 				}
 * 			}
 * 		case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindInterfaceDeclaration:
 * 			result = r.lookup(r.getSymbolOfDeclaration(location).Members, name, meaning&ast.SymbolFlagsType)
 * 			if result != nil {
 * 				if !isTypeParameterSymbolDeclaredInContainer(result, location) {
 * 					// ignore type parameters not declared in this container
 * 					result = nil
 * 					break
 * 				}
 * 				if lastLocation != nil && ast.IsStatic(lastLocation) {
 * 					// TypeScript 1.0 spec (April 2014): 3.4.1
 * 					// The scope of a type parameter extends over the entire declaration with which the type
 * 					// parameter list is associated, with the exception of static member declarations in classes.
 * 					if nameNotFoundMessage != nil {
 * 						r.error(originalLocation, diagnostics.Static_members_cannot_reference_class_type_parameters)
 * 					}
 * 					return nil
 * 				}
 * 				break loop
 * 			}
 * 			if ast.IsClassExpression(location) && meaning&ast.SymbolFlagsClass != 0 {
 * 				className := location.Name()
 * 				if className != nil && name == className.Text() {
 * 					result = location.Symbol()
 * 					break loop
 * 				}
 * 			}
 * 		case ast.KindExpressionWithTypeArguments:
 * 			if lastLocation == location.Expression() && ast.IsHeritageClause(location.Parent) && location.Parent.AsHeritageClause().Token == ast.KindExtendsKeyword {
 * 				container := location.Parent.Parent
 * 				if ast.IsClassLike(container) {
 * 					result = r.lookup(r.getSymbolOfDeclaration(container).Members, name, meaning&ast.SymbolFlagsType)
 * 					if result != nil {
 * 						if nameNotFoundMessage != nil {
 * 							r.error(originalLocation, diagnostics.Base_class_expressions_cannot_reference_class_type_parameters)
 * 						}
 * 						return nil
 * 					}
 * 				}
 * 			}
 * 		// It is not legal to reference a class's own type parameters from a computed property name that
 * 		// belongs to the class. For example:
 * 		//
 * 		//   function foo<T>() { return '' }
 * 		//   class C<T> { // <-- Class's own type parameter T
 * 		//       [foo<T>()]() { } // <-- Reference to T from class's own computed property
 * 		//   }
 * 		case ast.KindComputedPropertyName:
 * 			grandparent = location.Parent.Parent
 * 			if ast.IsClassLike(grandparent) || ast.IsInterfaceDeclaration(grandparent) {
 * 				// A reference to this grandparent's type parameters would be an error
 * 				result = r.lookup(r.getSymbolOfDeclaration(grandparent).Members, name, meaning&ast.SymbolFlagsType)
 * 				if result != nil {
 * 					if nameNotFoundMessage != nil {
 * 						r.error(originalLocation, diagnostics.A_computed_property_name_cannot_reference_a_type_parameter_from_its_containing_type)
 * 					}
 * 					return nil
 * 				}
 * 			}
 * 		case ast.KindMethodDeclaration, ast.KindConstructor, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindFunctionDeclaration:
 * 			if meaning&ast.SymbolFlagsVariable != 0 && name == "arguments" {
 * 				result = r.argumentsSymbol()
 * 				break loop
 * 			}
 * 		case ast.KindFunctionExpression:
 * 			if meaning&ast.SymbolFlagsVariable != 0 && name == "arguments" {
 * 				result = r.argumentsSymbol()
 * 				break loop
 * 			}
 * 			if meaning&ast.SymbolFlagsFunction != 0 {
 * 				functionName := location.AsFunctionExpression().Name()
 * 				if functionName != nil && name == functionName.Text() {
 * 					result = location.Symbol()
 * 					break loop
 * 				}
 * 			}
 * 		case ast.KindDecorator:
 * 			// Decorators are resolved at the class declaration. Resolving at the parameter
 * 			// or member would result in looking up locals in the method.
 * 			//
 * 			//   function y() {}
 * 			//   class C {
 * 			//       method(@y x, y) {} // <-- decorator y should be resolved at the class declaration, not the parameter.
 * 			//   }
 * 			//
 * 			if location.Parent != nil && location.Parent.Kind == ast.KindParameter {
 * 				location = location.Parent
 * 			}
 * 			//   function y() {}
 * 			//   class C {
 * 			//       @y method(x, y) {} // <-- decorator y should be resolved at the class declaration, not the method.
 * 			//   }
 * 			//
 * 			// class Decorators are resolved outside of the class to avoid referencing type parameters of that class.
 * 			//
 * 			//   type T = number;
 * 			//   declare function y(x: T): any;
 * 			//   @param(1 as T) // <-- T should resolve to the type alias outside of class C
 * 			//   class C<T> {}
 * 			if location.Parent != nil && (ast.IsClassElement(location.Parent) || location.Parent.Kind == ast.KindClassDeclaration) {
 * 				location = location.Parent
 * 			}
 * 		case ast.KindParameter:
 * 			parameterDeclaration := location.AsParameterDeclaration()
 * 			if lastLocation != nil && (lastLocation == parameterDeclaration.Initializer ||
 * 				lastLocation == parameterDeclaration.Name() && ast.IsBindingPattern(lastLocation)) {
 * 				if associatedDeclarationForContainingInitializerOrBindingName == nil {
 * 					associatedDeclarationForContainingInitializerOrBindingName = location
 * 				}
 * 			}
 * 		case ast.KindBindingElement:
 * 			bindingElement := location.AsBindingElement()
 * 			if lastLocation != nil && (lastLocation == bindingElement.Initializer ||
 * 				lastLocation == bindingElement.Name() && ast.IsBindingPattern(lastLocation)) {
 * 				if ast.IsPartOfParameterDeclaration(location) && associatedDeclarationForContainingInitializerOrBindingName == nil {
 * 					associatedDeclarationForContainingInitializerOrBindingName = location
 * 				}
 * 			}
 * 		case ast.KindInferType:
 * 			if meaning&ast.SymbolFlagsTypeParameter != 0 {
 * 				parameterName := location.AsInferTypeNode().TypeParameter.AsTypeParameterDeclaration().Name()
 * 				if parameterName != nil && name == parameterName.Text() {
 * 					result = location.AsInferTypeNode().TypeParameter.Symbol()
 * 					break loop
 * 				}
 * 			}
 * 		case ast.KindExportSpecifier:
 * 			exportSpecifier := location.AsExportSpecifier()
 * 			if lastLocation != nil && lastLocation == exportSpecifier.PropertyName && location.Parent.Parent.ModuleSpecifier() != nil {
 * 				location = location.Parent.Parent.Parent
 * 			}
 * 		}
 * 		if isSelfReferenceLocation(location, lastLocation) {
 * 			lastSelfReferenceLocation = location
 * 		}
 * 		lastLocation = location
 * 		// !!! In Strada, JSDocTemplateTag/JSDocParameterTag/JSDocReturnTag locations skip to
 * 		// getEffectiveContainerForJSDocTemplateTag/getHostSignatureFromJSDoc instead of location.parent.
 * 		// This is a no-op currently because JSDoc nodes have no locals and getEffectiveJSDocHost is not
 * 		// fully ported for JS assignment patterns.
 * 		location = location.Parent
 * 	}
 * 	// We just climbed up parents looking for the name, meaning that we started in a descendant node of `lastLocation`.
 * 	// If `result === lastSelfReferenceLocation.symbol`, that means that we are somewhere inside `lastSelfReferenceLocation` looking up a name, and resolving to `lastLocation` itself.
 * 	// That means that this is a self-reference of `lastLocation`, and shouldn't count this when considering whether `lastLocation` is used.
 * 	if isUse && result != nil && (lastSelfReferenceLocation == nil || result != lastSelfReferenceLocation.Symbol()) {
 * 		if r.SymbolReferenced != nil {
 * 			r.SymbolReferenced(result, meaning)
 * 		}
 * 	}
 * 	if result == nil && !excludeGlobals {
 * 		result = r.lookup(r.Globals, name, meaning|ast.SymbolFlagsGlobalLookup)
 * 	}
 * 	if result == nil {
 * 		if originalLocation != nil && ast.IsInJSFile(originalLocation) && originalLocation.Parent != nil {
 * 			if ast.IsRequireCall(originalLocation.Parent, false /*requireStringLiteralLikeArgument* /) {
 * 				return r.RequireSymbol
 * 			}
 * 		}
 * 	}
 * 	if nameNotFoundMessage != nil {
 * 		if propertyWithInvalidInitializer != nil && r.OnPropertyWithInvalidInitializer != nil && r.OnPropertyWithInvalidInitializer(originalLocation, name, propertyWithInvalidInitializer, result) {
 * 			return nil
 * 		}
 * 		if result == nil {
 * 			if r.OnFailedToResolveSymbol != nil {
 * 				r.OnFailedToResolveSymbol(originalLocation, name, meaning, nameNotFoundMessage)
 * 			}
 * 		} else {
 * 			if r.OnSuccessfullyResolvedSymbol != nil {
 * 				r.OnSuccessfullyResolvedSymbol(originalLocation, result, meaning, lastLocation, associatedDeclarationForContainingInitializerOrBindingName, withinDeferredContext)
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function NameResolver_Resolve(receiver: GoPtr<NameResolver>, location: GoPtr<Node>, name: string, meaning: SymbolFlags, nameNotFoundMessage: GoPtr<Message>, isUse: bool, excludeGlobals: bool): GoPtr<Symbol> {
  let result: GoPtr<Symbol> = undefined;
  let lastLocation: GoPtr<Node> = undefined;
  let lastSelfReferenceLocation: GoPtr<Node> = undefined;
  let propertyWithInvalidInitializer: GoPtr<Node> = undefined;
  let associatedDeclarationForContainingInitializerOrBindingName: GoPtr<Node> = undefined;
  let withinDeferredContext: bool = false;
  let grandparent: GoPtr<Node> = undefined;
  const originalLocation = location; // needed for did-you-mean error reporting, which gathers candidates starting from the original location
  const nameIsConst = name === "const";
  loop: for (; location !== undefined; ) {
    if (nameIsConst && IsConstAssertion(location)) {
      // `const` in an `as const` has no symbol, but issues no error because there is no *actual* lookup of the type
      // (it refers to the constant type of the expression instead)
      return undefined;
    }
    if (IsModuleOrEnumDeclaration(location) && lastLocation !== undefined && Node_Name(location) === lastLocation) {
      // If lastLocation is the name of a namespace or enum, skip the parent since it will have is own locals that could
      // conflict.
      lastLocation = location;
      location = location!.Parent;
    }
    const locals = Node_Locals(location);
    // Locals of a source file are not in scope (because they get merged into the global symbol table)
    if (locals !== undefined && !IsGlobalSourceFile(location)) {
      result = NameResolver_lookup(receiver, locals, name, meaning);
      if (result !== undefined) {
        let useResult = true;
        if (IsFunctionLike(location) && lastLocation !== undefined && lastLocation !== Node_Body(location)) {
          // symbol lookup restrictions for function-like declarations
          // - Type parameters of a function are in scope in the entire function declaration, including the parameter
          //   list and return type. However, local types are only in scope in the function body.
          // - parameters are only in the scope of function body
          if ((meaning & result!.Flags & SymbolFlagsType) !== 0) {
            useResult = (result!.Flags & SymbolFlagsTypeParameter) !== 0 &&
              (lastLocation === Node_Type(location) || IsParameterLike(lastLocation));
          }
          if ((meaning & result!.Flags & SymbolFlagsVariable) !== 0) {
            // expression inside parameter will lookup as normal variable scope when targeting es2015+
            if (NameResolver_useOuterVariableScopeInParameter(receiver, result, location, lastLocation)) {
              useResult = false;
            } else if ((result!.Flags & SymbolFlagsFunctionScopedVariable) !== 0) {
              // parameters are visible only inside function body, parameter list and return type
              // technically for parameter list case here we might mix parameters and variables declared in function,
              // however it is detected separately when checking initializers of parameters
              // to make sure that they reference no variables declared after them.
              useResult = lastLocation!.Kind === KindParameter ||
                (lastLocation!.Flags & NodeFlagsSynthesized) !== 0 ||
                (lastLocation === Node_Type(location) && FindAncestor(result!.ValueDeclaration, IsParameterDeclaration) !== undefined);
            }
          }
        } else if (location!.Kind === KindConditionalType) {
          // A type parameter declared using 'infer T' in a conditional type is visible only in
          // the true branch of the conditional type.
          useResult = lastLocation === AsConditionalTypeNode(location)!.TrueType;
        }
        if (useResult) {
          break loop;
        }
        result = undefined;
      }
    }
    withinDeferredContext = (withinDeferredContext || getIsDeferredContext(location, lastLocation)) as bool;
    switch (location!.Kind) {
      case KindSourceFile:
        if (!IsExternalOrCommonJSModule(AsSourceFile(location))) {
          break;
        }
        // fallthrough
        // falls through
      case KindModuleDeclaration: {
        const moduleSymbol = NameResolver_getSymbolOfDeclaration(receiver, location);
        if (moduleSymbol === undefined) {
          break;
        }
        const moduleExports = moduleSymbol!.Exports;
        if (moduleExports === undefined) {
          break;
        }
        if (IsSourceFile(location) || (IsModuleDeclaration(location) && (location!.Flags & NodeFlagsAmbient) !== 0 && !IsGlobalScopeAugmentation(location))) {
          // It's an external module. First see if the module has an export default and if the local
          // name of that export default matches.
          result = moduleExports.get(InternalSymbolNameDefault);
          if (result !== undefined) {
            const localSymbol = GetLocalSymbolForExportDefault(result);
            if (localSymbol !== undefined && (result!.Flags & meaning) !== 0 && localSymbol!.Name === name) {
              break loop;
            }
            result = undefined;
          }
          // Because of module/namespace merging, a module's exports are in scope,
          // yet we never want to treat an export specifier as putting a member in scope.
          // Therefore, if the name we find is purely an export specifier, it is not actually considered in scope.
          // Two things to note about this:
          //     1. We have to check this without calling getSymbol. The problem with calling getSymbol
          //        on an export specifier is that it might find the export specifier itself, and try to
          //        resolve it as an alias. This will cause the checker to consider the export specifier
          //        a circular alias reference when it might not be.
          //     2. We check === SymbolFlags.Alias in order to check that the symbol is *purely*
          //        an alias. If we used &, we'd be throwing out symbols that have non alias aspects,
          //        which is not the desired behavior.
          const moduleExport = moduleExports.get(name);
          if (moduleExport !== undefined && moduleExport!.Flags === SymbolFlagsAlias && (GetDeclarationOfKind(moduleExport, KindExportSpecifier) !== undefined || GetDeclarationOfKind(moduleExport, KindNamespaceExport) !== undefined)) {
            break;
          }
        }
        if (name !== InternalSymbolNameDefault) {
          result = NameResolver_lookup(receiver, moduleExports, name, meaning & SymbolFlagsModuleMember);
          if (result !== undefined) {
            if (IsSourceFile(location) && AsSourceFile(location)!.CommonJSModuleIndicator !== undefined && (result!.Flags & SymbolFlagsType) === 0) {
              result = undefined;
            } else {
              break loop;
            }
          }
        }
        break;
      }
      case KindEnumDeclaration: {
        const enumSymbol = NameResolver_getSymbolOfDeclaration(receiver, location);
        if (enumSymbol === undefined) {
          break;
        }
        result = NameResolver_lookup(receiver, enumSymbol!.Exports, name, meaning & SymbolFlagsEnumMember);
        if (result !== undefined) {
          if (nameNotFoundMessage !== undefined && CompilerOptions_GetIsolatedModules(receiver!.CompilerOptions) && (location!.Flags & NodeFlagsAmbient) === 0 && GetSourceFileOfNode(location) !== GetSourceFileOfNode(result!.ValueDeclaration)) {
            const isolatedModulesLikeFlagName = IfElse(receiver!.CompilerOptions!.VerbatimModuleSyntax === TSTrue, "verbatimModuleSyntax", "isolatedModules");
            NameResolver_error(receiver, originalLocation, Cannot_access_0_from_another_file_without_qualification_when_1_is_enabled_Use_2_instead,
              name, isolatedModulesLikeFlagName, enumSymbol!.Name + "." + name);
          }
          break loop;
        }
        break;
      }
      case KindPropertyDeclaration:
        if (!IsStatic(location)) {
          const ctor = FindConstructorDeclaration(location!.Parent);
          if (ctor !== undefined) {
            const ctorLocals = Node_Locals(ctor);
            if (ctorLocals !== undefined && NameResolver_lookup(receiver, ctorLocals, name, meaning & SymbolFlagsValue) !== undefined) {
              // Remember the property node, it will be used later to report appropriate error
              propertyWithInvalidInitializer = location;
            }
          }
        }
        break;
      case KindClassDeclaration:
      case KindClassExpression:
      case KindInterfaceDeclaration: {
        result = NameResolver_lookup(receiver, NameResolver_getSymbolOfDeclaration(receiver, location)!.Members, name, meaning & SymbolFlagsType);
        if (result !== undefined) {
          if (!isTypeParameterSymbolDeclaredInContainer(result, location)) {
            // ignore type parameters not declared in this container
            result = undefined;
            break;
          }
          if (lastLocation !== undefined && IsStatic(lastLocation)) {
            // TypeScript 1.0 spec (April 2014): 3.4.1
            // The scope of a type parameter extends over the entire declaration with which the type
            // parameter list is associated, with the exception of static member declarations in classes.
            if (nameNotFoundMessage !== undefined) {
              NameResolver_error(receiver, originalLocation, Static_members_cannot_reference_class_type_parameters);
            }
            return undefined;
          }
          break loop;
        }
        if (IsClassExpression(location) && (meaning & SymbolFlagsClass) !== 0) {
          const className = Node_Name(location);
          if (className !== undefined && name === Node_Text(className)) {
            result = Node_Symbol(location);
            break loop;
          }
        }
        break;
      }
      case KindExpressionWithTypeArguments:
        if (lastLocation === Node_Expression(location) && IsHeritageClause(location!.Parent) && AsHeritageClause(location!.Parent)!.Token === KindExtendsKeyword) {
          const container = location!.Parent!.Parent;
          if (IsClassLike(container)) {
            result = NameResolver_lookup(receiver, NameResolver_getSymbolOfDeclaration(receiver, container)!.Members, name, meaning & SymbolFlagsType);
            if (result !== undefined) {
              if (nameNotFoundMessage !== undefined) {
                NameResolver_error(receiver, originalLocation, Base_class_expressions_cannot_reference_class_type_parameters);
              }
              return undefined;
            }
          }
        }
        break;
      // It is not legal to reference a class's own type parameters from a computed property name that
      // belongs to the class. For example:
      //
      //   function foo<T>() { return '' }
      //   class C<T> { // <-- Class's own type parameter T
      //       [foo<T>()]() { } // <-- Reference to T from class's own computed property
      //   }
      case KindComputedPropertyName:
        grandparent = location!.Parent!.Parent;
        if (IsClassLike(grandparent) || IsInterfaceDeclaration(grandparent)) {
          // A reference to this grandparent's type parameters would be an error
          result = NameResolver_lookup(receiver, NameResolver_getSymbolOfDeclaration(receiver, grandparent)!.Members, name, meaning & SymbolFlagsType);
          if (result !== undefined) {
            if (nameNotFoundMessage !== undefined) {
              NameResolver_error(receiver, originalLocation, A_computed_property_name_cannot_reference_a_type_parameter_from_its_containing_type);
            }
            return undefined;
          }
        }
        break;
      case KindMethodDeclaration:
      case KindConstructor:
      case KindGetAccessor:
      case KindSetAccessor:
      case KindFunctionDeclaration:
        if ((meaning & SymbolFlagsVariable) !== 0 && name === "arguments") {
          result = NameResolver_argumentsSymbol(receiver);
          break loop;
        }
        break;
      case KindFunctionExpression:
        if ((meaning & SymbolFlagsVariable) !== 0 && name === "arguments") {
          result = NameResolver_argumentsSymbol(receiver);
          break loop;
        }
        if ((meaning & SymbolFlagsFunction) !== 0) {
          const functionName = AsFunctionExpression(location)!.name;
          if (functionName !== undefined && name === Node_Text(functionName)) {
            result = Node_Symbol(location);
            break loop;
          }
        }
        break;
      case KindDecorator:
        // Decorators are resolved at the class declaration. Resolving at the parameter
        // or member would result in looking up locals in the method.
        //
        //   function y() {}
        //   class C {
        //       method(@y x, y) {} // <-- decorator y should be resolved at the class declaration, not the parameter.
        //   }
        //
        if (location!.Parent !== undefined && location!.Parent!.Kind === KindParameter) {
          location = location!.Parent;
        }
        //   function y() {}
        //   class C {
        //       @y method(x, y) {} // <-- decorator y should be resolved at the class declaration, not the method.
        //   }
        //
        // class Decorators are resolved outside of the class to avoid referencing type parameters of that class.
        //
        //   type T = number;
        //   declare function y(x: T): any;
        //   @param(1 as T) // <-- T should resolve to the type alias outside of class C
        //   class C<T> {}
        if (location!.Parent !== undefined && (IsClassElement(location!.Parent) || location!.Parent!.Kind === KindClassDeclaration)) {
          location = location!.Parent;
        }
        break;
      case KindParameter: {
        const parameterDeclaration = AsParameterDeclaration(location);
        if (lastLocation !== undefined && (lastLocation === parameterDeclaration!.Initializer ||
          (lastLocation === Node_Name(location) && IsBindingPattern(lastLocation)))) {
          if (associatedDeclarationForContainingInitializerOrBindingName === undefined) {
            associatedDeclarationForContainingInitializerOrBindingName = location;
          }
        }
        break;
      }
      case KindBindingElement: {
        const bindingElement = AsBindingElement(location);
        if (lastLocation !== undefined && (lastLocation === bindingElement!.Initializer ||
          (lastLocation === Node_Name(location) && IsBindingPattern(lastLocation)))) {
          if (IsPartOfParameterDeclaration(location) && associatedDeclarationForContainingInitializerOrBindingName === undefined) {
            associatedDeclarationForContainingInitializerOrBindingName = location;
          }
        }
        break;
      }
      case KindInferType:
        if ((meaning & SymbolFlagsTypeParameter) !== 0) {
          const parameterName = AsTypeParameterDeclaration(AsInferTypeNode(location)!.TypeParameter)!.name;
          if (parameterName !== undefined && name === Node_Text(parameterName)) {
            result = Node_Symbol(AsInferTypeNode(location)!.TypeParameter);
            break loop;
          }
        }
        break;
      case KindExportSpecifier: {
        const exportSpecifier = AsExportSpecifier(location);
        if (lastLocation !== undefined && lastLocation === exportSpecifier!.PropertyName && Node_ModuleSpecifier(location!.Parent!.Parent) !== undefined) {
          location = location!.Parent!.Parent!.Parent;
        }
        break;
      }
    }
    if (isSelfReferenceLocation(location, lastLocation)) {
      lastSelfReferenceLocation = location;
    }
    lastLocation = location;
    // !!! In Strada, JSDocTemplateTag/JSDocParameterTag/JSDocReturnTag locations skip to
    // getEffectiveContainerForJSDocTemplateTag/getHostSignatureFromJSDoc instead of location.parent.
    // This is a no-op currently because JSDoc nodes have no locals and getEffectiveJSDocHost is not
    // fully ported for JS assignment patterns.
    location = location!.Parent;
  }
  // We just climbed up parents looking for the name, meaning that we started in a descendant node of `lastLocation`.
  // If `result === lastSelfReferenceLocation.symbol`, that means that we are somewhere inside `lastSelfReferenceLocation` looking up a name, and resolving to `lastLocation` itself.
  // That means that this is a self-reference of `lastLocation`, and shouldn't count this when considering whether `lastLocation` is used.
  if (isUse && result !== undefined && (lastSelfReferenceLocation === undefined || result !== Node_Symbol(lastSelfReferenceLocation))) {
    if (receiver!.SymbolReferenced !== undefined) {
      receiver!.SymbolReferenced(result, meaning);
    }
  }
  if (result === undefined && !excludeGlobals) {
    result = NameResolver_lookup(receiver, receiver!.Globals, name, meaning | SymbolFlagsGlobalLookup);
  }
  if (result === undefined) {
    if (originalLocation !== undefined && IsInJSFile(originalLocation) && originalLocation!.Parent !== undefined) {
      if (IsRequireCall(originalLocation!.Parent, false /*requireStringLiteralLikeArgument*/)) {
        return receiver!.RequireSymbol;
      }
    }
  }
  if (nameNotFoundMessage !== undefined) {
    if (propertyWithInvalidInitializer !== undefined && receiver!.OnPropertyWithInvalidInitializer !== undefined && receiver!.OnPropertyWithInvalidInitializer(originalLocation, name, propertyWithInvalidInitializer, result)) {
      return undefined;
    }
    if (result === undefined) {
      if (receiver!.OnFailedToResolveSymbol !== undefined) {
        receiver!.OnFailedToResolveSymbol(originalLocation, name, meaning, nameNotFoundMessage);
      }
    } else {
      if (receiver!.OnSuccessfullyResolvedSymbol !== undefined) {
        receiver!.OnSuccessfullyResolvedSymbol(originalLocation, result, meaning, lastLocation, associatedDeclarationForContainingInitializerOrBindingName, withinDeferredContext);
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.useOuterVariableScopeInParameter","kind":"method","status":"implemented","sigHash":"1d4352ffc787afad433db6445d87a5eee41d0c86c9f57dd07406916dc7df45e5","bodyHash":"20cb52e53358e0861e7a5d8ff6bcc66b662b5c0ff304cbd1893a82762ac90268"}
 *
 * Go source:
 * func (r *NameResolver) useOuterVariableScopeInParameter(result *ast.Symbol, location *ast.Node, lastLocation *ast.Node) bool {
 * 	if ast.IsParameterDeclaration(lastLocation) {
 * 		body := location.Body()
 * 		if body != nil && result.ValueDeclaration != nil && result.ValueDeclaration.Pos() >= body.Pos() && result.ValueDeclaration.End() <= body.End() {
 * 			// check for several cases where we introduce temporaries that require moving the name/initializer of the parameter to the body
 * 			// - static field in a class expression
 * 			// - optional chaining pre-es2020
 * 			// - nullish coalesce pre-es2020
 * 			// - spread assignment in binding pattern pre-es2017
 * 			functionLocation := location
 * 			declarationRequiresScopeChange := core.TSUnknown
 * 			if r.GetRequiresScopeChangeCache != nil {
 * 				declarationRequiresScopeChange = r.GetRequiresScopeChangeCache(functionLocation)
 * 			}
 * 			if declarationRequiresScopeChange == core.TSUnknown {
 * 				declarationRequiresScopeChange = core.IfElse(core.Some(functionLocation.Parameters(), r.requiresScopeChange), core.TSTrue, core.TSFalse)
 * 				if r.SetRequiresScopeChangeCache != nil {
 * 					r.SetRequiresScopeChangeCache(functionLocation, declarationRequiresScopeChange)
 * 				}
 * 			}
 * 			return declarationRequiresScopeChange != core.TSTrue
 * 		}
 * 	}
 * 	return false
 * }
 */
export function NameResolver_useOuterVariableScopeInParameter(receiver: GoPtr<NameResolver>, result: GoPtr<Symbol>, location: GoPtr<Node>, lastLocation: GoPtr<Node>): bool {
  if (IsParameterDeclaration(lastLocation)) {
    const body = Node_Body(location);
    if (body !== undefined && result!.ValueDeclaration !== undefined && Node_Pos(result!.ValueDeclaration) >= Node_Pos(body) && Node_End(result!.ValueDeclaration) <= Node_End(body)) {
      // check for several cases where we introduce temporaries that require moving the name/initializer of the parameter to the body
      // - static field in a class expression
      // - optional chaining pre-es2020
      // - nullish coalesce pre-es2020
      // - spread assignment in binding pattern pre-es2017
      const functionLocation = location;
      let declarationRequiresScopeChange: Tristate = TSUnknown;
      if (receiver!.GetRequiresScopeChangeCache !== undefined) {
        declarationRequiresScopeChange = receiver!.GetRequiresScopeChangeCache(functionLocation);
      }
      if (declarationRequiresScopeChange === TSUnknown) {
        declarationRequiresScopeChange = IfElse(Some(Node_Parameters(functionLocation), (n) => NameResolver_requiresScopeChange(receiver, n)), TSTrue, TSFalse);
        if (receiver!.SetRequiresScopeChangeCache !== undefined) {
          receiver!.SetRequiresScopeChangeCache(functionLocation, declarationRequiresScopeChange);
        }
      }
      return (declarationRequiresScopeChange !== TSTrue) as bool;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.requiresScopeChange","kind":"method","status":"implemented","sigHash":"04b68182f1b735e2e10bdcf19dd17253605e7ba108f0b3b25c79eecbab54e2bf","bodyHash":"24fbd9e348dcf3085b990fe2b0982a80bee29f772c0bf5598c92619bd363069c"}
 *
 * Go source:
 * func (r *NameResolver) requiresScopeChange(node *ast.Node) bool {
 * 	d := node.AsParameterDeclaration()
 * 	return r.requiresScopeChangeWorker(d.Name()) || d.Initializer != nil && r.requiresScopeChangeWorker(d.Initializer)
 * }
 */
export function NameResolver_requiresScopeChange(receiver: GoPtr<NameResolver>, node: GoPtr<Node>): bool {
  const d = AsParameterDeclaration(node);
  return (NameResolver_requiresScopeChangeWorker(receiver, Node_Name(node)) || (d!.Initializer !== undefined && NameResolver_requiresScopeChangeWorker(receiver, d!.Initializer))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.requiresScopeChangeWorker","kind":"method","status":"implemented","sigHash":"3c4707a71b853cce51eea068f7677b0bf653105cd32751021a0bd8ffd97d97a2","bodyHash":"83b51c657212ff3cef0c8f797b3974239f513e7af0a2df0a76360d67ab0222fd"}
 *
 * Go source:
 * func (r *NameResolver) requiresScopeChangeWorker(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindArrowFunction, ast.KindFunctionExpression, ast.KindFunctionDeclaration, ast.KindConstructor:
 * 		return false
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyAssignment:
 * 		return r.requiresScopeChangeWorker(node.Name())
 * 	case ast.KindPropertyDeclaration:
 * 		if ast.HasStaticModifier(node) {
 * 			return !r.CompilerOptions.GetEmitStandardClassFields()
 * 		}
 * 		return r.requiresScopeChangeWorker(node.AsPropertyDeclaration().Name())
 * 	default:
 * 		if ast.IsNullishCoalesce(node) || ast.IsOptionalChain(node) {
 * 			return r.CompilerOptions.GetEmitScriptTarget() < core.ScriptTargetES2020
 * 		}
 * 		if ast.IsBindingElement(node) && node.AsBindingElement().DotDotDotToken != nil && ast.IsObjectBindingPattern(node.Parent) {
 * 			return r.CompilerOptions.GetEmitScriptTarget() < core.ScriptTargetES2017
 * 		}
 * 		if ast.IsTypeNode(node) {
 * 			return false
 * 		}
 * 		return node.ForEachChild(r.requiresScopeChangeWorker)
 * 	}
 * }
 */
export function NameResolver_requiresScopeChangeWorker(receiver: GoPtr<NameResolver>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindArrowFunction:
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindConstructor:
      return false;
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindPropertyAssignment:
      return NameResolver_requiresScopeChangeWorker(receiver, Node_Name(node));
    case KindPropertyDeclaration:
      if (HasStaticModifier(node)) {
        return !CompilerOptions_GetEmitStandardClassFields(receiver!.CompilerOptions);
      }
      return NameResolver_requiresScopeChangeWorker(receiver, AsPropertyDeclaration(node)!.name);
    default:
      if (IsNullishCoalesce(node) || IsOptionalChain(node)) {
        return (CompilerOptions_GetEmitScriptTarget(receiver!.CompilerOptions) < ScriptTargetES2020) as bool;
      }
      if (IsBindingElement(node) && AsBindingElement(node)!.DotDotDotToken !== undefined && IsObjectBindingPattern(node!.Parent)) {
        return (CompilerOptions_GetEmitScriptTarget(receiver!.CompilerOptions) < ScriptTargetES2017) as bool;
      }
      if (IsTypeNode(node)) {
        return false;
      }
      return Node_ForEachChild(node, (n: GoPtr<Node>) => NameResolver_requiresScopeChangeWorker(receiver, n));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.error","kind":"method","status":"implemented","sigHash":"d7da2e505aa14dc4e9f3d5f8e3825167291fa40566a2d25576627d08e98f3d84","bodyHash":"9f4e040f14b9604886bea086134b651590c43b3e61c39a9805d13d2c4e8ed820"}
 *
 * Go source:
 * func (r *NameResolver) error(location *ast.Node, message *diagnostics.Message, args ...any) {
 * 	if r.Error != nil {
 * 		r.Error(location, message, args...)
 * 	}
 * 	// Default implementation does not report errors
 * }
 */
export function NameResolver_error(receiver: GoPtr<NameResolver>, location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): void {
  if (receiver!.Error !== undefined) {
    receiver!.Error(location, message, ...args);
  }
  // Default implementation does not report errors
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.getSymbolOfDeclaration","kind":"method","status":"implemented","sigHash":"178239d0bdfe145e610faab1221f806afa4ae6bff70494514c5d05af5ffa655d","bodyHash":"c01189d1efcdec8cb758721f0b77cc7a31b23ebbebc032bd14b3e69de6c54ae0"}
 *
 * Go source:
 * func (r *NameResolver) getSymbolOfDeclaration(node *ast.Node) *ast.Symbol {
 * 	if r.GetSymbolOfDeclaration != nil {
 * 		return r.GetSymbolOfDeclaration(node)
 * 	}
 * 
 * 	// Default implementation does not support merged symbols
 * 	return node.Symbol()
 * }
 */
export function NameResolver_getSymbolOfDeclaration(receiver: GoPtr<NameResolver>, node: GoPtr<Node>): GoPtr<Symbol> {
  if (receiver!.GetSymbolOfDeclaration !== undefined) {
    return receiver!.GetSymbolOfDeclaration(node);
  }

  // Default implementation does not support merged symbols
  return Node_Symbol(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.lookup","kind":"method","status":"implemented","sigHash":"01d17b8fbdf746d53b5016c7d7c4ea40455d0a3548b78944019dce2f1fc84d9c","bodyHash":"981e4e76773094204fcb081702d854f823979ad98c7d9874bd947647f35644d4"}
 *
 * Go source:
 * func (r *NameResolver) lookup(symbols ast.SymbolTable, name string, meaning ast.SymbolFlags) *ast.Symbol {
 * 	if r.Lookup != nil {
 * 		return r.Lookup(symbols, name, meaning)
 * 	}
 * 	// Default implementation does not support following aliases or merged symbols
 * 	if meaning != 0 {
 * 		symbol := symbols[name]
 * 		if symbol != nil {
 * 			if symbol.Flags&meaning != 0 {
 * 				return symbol
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function NameResolver_lookup(receiver: GoPtr<NameResolver>, symbols: SymbolTable | undefined, name: string, meaning: SymbolFlags): GoPtr<Symbol> {
  if (receiver!.Lookup !== undefined) {
    return receiver!.Lookup(symbols, name, meaning);
  }
  // Default implementation does not support following aliases or merged symbols
  if (symbols !== undefined && meaning !== 0) {
    const symbol_ = symbols.get(name);
    if (symbol_ !== undefined) {
      if ((symbol_!.Flags & meaning) !== 0) {
        return symbol_;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::method::NameResolver.argumentsSymbol","kind":"method","status":"implemented","sigHash":"5330eec8752457d11769b8ad62bb1ae8439c2ebd53c477d13df92d3c4e577a33","bodyHash":"91d57b927f9552f5b33862825284535a65000a1642ff104762d1ae8e932b72bf"}
 *
 * Go source:
 * func (r *NameResolver) argumentsSymbol() *ast.Symbol {
 * 	if r.ArgumentsSymbol == nil {
 * 		// Default implementation synthesizes a transient symbol for `arguments`
 * 		r.ArgumentsSymbol = &ast.Symbol{Name: "arguments", Flags: ast.SymbolFlagsProperty | ast.SymbolFlagsTransient}
 * 	}
 * 	return r.ArgumentsSymbol
 * }
 */
export function NameResolver_argumentsSymbol(receiver: GoPtr<NameResolver>): GoPtr<Symbol> {
  if (receiver!.ArgumentsSymbol === undefined) {
    // Default implementation synthesizes a transient symbol for `arguments`
    receiver!.ArgumentsSymbol = { Name: "arguments", Flags: SymbolFlagsProperty | SymbolFlagsTransient } as Symbol;
  }
  return receiver!.ArgumentsSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::func::GetLocalSymbolForExportDefault","kind":"func","status":"implemented","sigHash":"f7fb6e1de79999eb448c60e88565c15a9f5440891d2d50f583734f8fbee89df5","bodyHash":"7ae6def8e648da22a4fafb50b70e8a7ad91dfc822341f7108fba87d2fe4c7d80"}
 *
 * Go source:
 * func GetLocalSymbolForExportDefault(symbol *ast.Symbol) *ast.Symbol {
 * 	if !isExportDefaultSymbol(symbol) || len(symbol.Declarations) == 0 {
 * 		return nil
 * 	}
 * 	for _, decl := range symbol.Declarations {
 * 		localSymbol := decl.LocalSymbol()
 * 		if localSymbol != nil {
 * 			return localSymbol
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetLocalSymbolForExportDefault(symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  const declarations = symbol_!.Declarations ?? [];
  if (!isExportDefaultSymbol(symbol_) || declarations.length === 0) {
    return undefined;
  }
  for (const decl of declarations) {
    const localSymbol = Node_LocalSymbol(decl);
    if (localSymbol !== undefined) {
      return localSymbol;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::func::isExportDefaultSymbol","kind":"func","status":"implemented","sigHash":"c2c8a77c7b157eea6da378e923b373ad3056b6197ca83c0aea530f30c91c3f80","bodyHash":"6a9194a94131b612f0bf3dcab93961154b5e3acf9983dfef924e7b840c11b5f4"}
 *
 * Go source:
 * func isExportDefaultSymbol(symbol *ast.Symbol) bool {
 * 	return symbol != nil && len(symbol.Declarations) > 0 && ast.HasSyntacticModifier(symbol.Declarations[0], ast.ModifierFlagsDefault)
 * }
 */
export function isExportDefaultSymbol(symbol_: GoPtr<Symbol>): bool {
  const declarations = symbol_?.Declarations ?? [];
  return (declarations.length > 0 && HasSyntacticModifier(declarations[0], ModifierFlagsDefault)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::func::getIsDeferredContext","kind":"func","status":"implemented","sigHash":"b1aede0b87122e750056e2b63ca1ae73660286be6f3b71b3c42762e127a29621","bodyHash":"c37f3a372dfd02a70a88915cd848a3dc65166218c36a61e501193b6ac14dd02a"}
 *
 * Go source:
 * func getIsDeferredContext(location *ast.Node, lastLocation *ast.Node) bool {
 * 	if location.Kind != ast.KindArrowFunction && location.Kind != ast.KindFunctionExpression {
 * 		// initializers in instance property declaration of class like entities are executed in constructor and thus deferred
 * 		// A name is evaluated within the enclosing scope - so it shouldn't count as deferred
 * 		return ast.IsTypeQueryNode(location) ||
 * 			(ast.IsFunctionLikeDeclaration(location) || location.Kind == ast.KindPropertyDeclaration && !ast.IsStatic(location)) &&
 * 				(lastLocation == nil || lastLocation != location.Name())
 * 	}
 * 	if lastLocation != nil && lastLocation == location.Name() {
 * 		return false
 * 	}
 * 	// generator functions and async functions are not inlined in control flow when immediately invoked
 * 	if location.BodyData().AsteriskToken != nil || ast.HasSyntacticModifier(location, ast.ModifierFlagsAsync) {
 * 		return true
 * 	}
 * 	return ast.GetImmediatelyInvokedFunctionExpression(location) == nil
 * }
 */
export function getIsDeferredContext(location: GoPtr<Node>, lastLocation: GoPtr<Node>): bool {
  if (location!.Kind !== KindArrowFunction && location!.Kind !== KindFunctionExpression) {
    // initializers in instance property declaration of class like entities are executed in constructor and thus deferred
    // A name is evaluated within the enclosing scope - so it shouldn't count as deferred
    return (IsTypeQueryNode(location) ||
      (IsFunctionLikeDeclaration(location) || (location!.Kind === KindPropertyDeclaration && !IsStatic(location))) &&
        (lastLocation === undefined || lastLocation !== Node_Name(location))) as bool;
  }
  if (lastLocation !== undefined && lastLocation === Node_Name(location)) {
    return false;
  }
  // generator functions and async functions are not inlined in control flow when immediately invoked
  if (Node_BodyData(location)!.AsteriskToken !== undefined || HasSyntacticModifier(location, ModifierFlagsAsync)) {
    return true;
  }
  return (GetImmediatelyInvokedFunctionExpression(location) === undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::func::isTypeParameterSymbolDeclaredInContainer","kind":"func","status":"implemented","sigHash":"6ec59c88e748a97387ad99c5b41f2d7aac09781481d709370877cffa40d81e1f","bodyHash":"18a3d1ab902797dffbb7b5da951cae5215b228f16f215aef6731bd0f27863e1c"}
 *
 * Go source:
 * func isTypeParameterSymbolDeclaredInContainer(symbol *ast.Symbol, container *ast.Node) bool {
 * 	for _, decl := range symbol.Declarations {
 * 		if decl.Kind == ast.KindTypeParameter {
 * 			parent := decl.Parent
 * 			if parent == container {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isTypeParameterSymbolDeclaredInContainer(symbol_: GoPtr<Symbol>, container: GoPtr<Node>): bool {
  for (const decl of symbol_!.Declarations ?? []) {
    if (decl!.Kind === KindTypeParameter) {
      const parent = decl!.Parent;
      if (parent === container) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/nameresolver.go::func::isSelfReferenceLocation","kind":"func","status":"implemented","sigHash":"30c193aacd1a43bce135c9f2ad764e1aa4363386ca557b9b44510289ef509941","bodyHash":"8c140a216e3ed171dee015bd9f9d980c2f431a08eef95656a846849e2df45676"}
 *
 * Go source:
 * func isSelfReferenceLocation(node *ast.Node, lastLocation *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindParameter:
 * 		return lastLocation != nil && lastLocation == node.Name()
 * 	case ast.KindFunctionDeclaration, ast.KindClassDeclaration, ast.KindInterfaceDeclaration, ast.KindEnumDeclaration,
 * 		ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindModuleDeclaration: // For `namespace N { N; }`
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isSelfReferenceLocation(node: GoPtr<Node>, lastLocation: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindParameter:
      return (lastLocation !== undefined && lastLocation === Node_Name(node)) as bool;
    case KindFunctionDeclaration:
    case KindClassDeclaration:
    case KindInterfaceDeclaration:
    case KindEnumDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindModuleDeclaration: // For `namespace N { N; }`
      return true;
  }
  return false;
}

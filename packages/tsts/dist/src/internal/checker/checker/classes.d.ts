import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { ImportAttributes } from "../../ast/generated/data.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import type { ResolutionMode } from "../../core/compileroptions.js";
import type { Type } from "../types.js";
import type { Checker } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolutionModeOverride","kind":"method","status":"implemented","sigHash":"7e0c42fe06d7edb996ccecf014152878148d7b5a6adaa597f78189aa937c483a","bodyHash":"533ae420ff24ef963f94d704452831f7f33c7f85d7cf220232ec2ba973cee1e3"}
 *
 * Go source:
 * func (c *Checker) getResolutionModeOverride(node *ast.ImportAttributes, reportErrors bool) core.ResolutionMode {
 * 	if len(node.Attributes.Nodes) != 1 {
 * 		if reportErrors {
 * 			c.grammarErrorOnNode(node.AsNode(), diagnostics.Type_import_attributes_should_have_exactly_one_key_resolution_mode_with_value_import_or_require)
 * 		}
 * 		return core.ResolutionModeNone
 * 	}
 * 	elem := node.Attributes.Nodes[0]
 * 	if !ast.IsStringLiteralLike(elem.Name()) {
 * 		return core.ResolutionModeNone
 * 	}
 * 	if elem.Name().Text() != "resolution-mode" {
 * 		if reportErrors {
 * 			c.grammarErrorOnNode(elem.Name(), diagnostics.X_resolution_mode_is_the_only_valid_key_for_type_import_attributes)
 * 		}
 * 		return core.ResolutionModeNone
 * 	}
 * 	value := elem.AsImportAttribute().Value
 * 	if !ast.IsStringLiteralLike(value) {
 * 		return core.ResolutionModeNone
 * 	}
 * 	if value.Text() != "import" && value.Text() != "require" {
 * 		if reportErrors {
 * 			c.grammarErrorOnNode(value, diagnostics.X_resolution_mode_should_be_either_require_or_import)
 * 		}
 * 		return core.ResolutionModeNone
 * 	}
 * 	if value.Text() == "import" {
 * 		return core.ResolutionModeESM
 * 	}
 * 	return core.ResolutionModeCommonJS
 * }
 */
export declare function Checker_getResolutionModeOverride(receiver: GoPtr<Checker>, node: GoPtr<ImportAttributes>, reportErrors: bool): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.arePropertiesAbstractOrInterface","kind":"method","status":"implemented","sigHash":"01937021dd3fe6a0bf9564d8d2beda1239172f783261fbb04670d72246921e16","bodyHash":"ce1fc3daf48ff53e41d2ba719e21a077e6723a65930b7f5472bbb36ea5d1da88"}
 *
 * Go source:
 * func (c *Checker) arePropertiesAbstractOrInterface(base *ast.Symbol, baseDeclarationFlags ast.ModifierFlags) bool {
 * 	if base.CheckFlags&ast.CheckFlagsSynthetic != 0 {
 * 		return core.Some(base.Declarations, func(d *ast.Node) bool { return c.isPropertyAbstractOrInterface(d, baseDeclarationFlags) })
 * 	}
 * 	return core.Every(base.Declarations, func(d *ast.Node) bool { return c.isPropertyAbstractOrInterface(d, baseDeclarationFlags) })
 * }
 */
export declare function Checker_arePropertiesAbstractOrInterface(receiver: GoPtr<Checker>, base: GoPtr<Symbol>, baseDeclarationFlags: ModifierFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassExpression","kind":"method","status":"implemented","sigHash":"9a545536ff28711ea40162393524a13ba58e2fec0b4b23bb36cf09742f33b23c","bodyHash":"9f6836279246172950154d1b3bbf2dc4f7d02183114b16b05c29ef9528c3c8c3"}
 *
 * Go source:
 * func (c *Checker) checkClassExpression(node *ast.Node) *Type {
 * 	c.checkClassLikeDeclaration(node)
 * 	c.checkNodeDeferred(node)
 * 	return c.getTypeOfSymbol(c.getSymbolOfDeclaration(node))
 * }
 */
export declare function Checker_checkClassExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassExpressionDeferred","kind":"method","status":"implemented","sigHash":"144cca04f17a5d11426b1bcb3ec77be7da6b04fd31f8461248860aeddc7bb688","bodyHash":"cd1b04f0eda2f7b46660e0f42ad8501762c2d9a6b4954d31f51fccfd3a724263"}
 *
 * Go source:
 * func (c *Checker) checkClassExpressionDeferred(node *ast.Node) {
 * 	c.checkSourceElements(node.Members())
 * 	c.registerForUnusedIdentifiersCheck(node)
 * }
 */
export declare function Checker_checkClassExpressionDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaringClass","kind":"method","status":"implemented","sigHash":"1019caa2db368cd6c0bc0cc7db250a478a73d05ecfc45d8a5418b61174d2e7c6","bodyHash":"14e6669adf5c9e38af54d39af3958a79eac366141455e34026badb9f15249cee"}
 *
 * Go source:
 * func (c *Checker) getDeclaringClass(prop *ast.Symbol) *Type {
 * 	if prop.Parent != nil && prop.Parent.Flags&ast.SymbolFlagsClass != 0 {
 * 		return c.getDeclaredTypeOfSymbol(c.getParentOfSymbol(prop))
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getDeclaringClass(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isValidOverrideOf","kind":"method","status":"implemented","sigHash":"427f7bb664f409a417a4fb3a0b3f5c09aeef0153961bb90f3ef0709e6e4fe653","bodyHash":"c1cc144221acaa770b376fe717fae0e02d9a6ae39d83ccbd70cec0ecbbf84e0a"}
 *
 * Go source:
 * func (c *Checker) isValidOverrideOf(sourceProp *ast.Symbol, targetProp *ast.Symbol) bool {
 * 	return !c.forEachProperty(targetProp, func(tp *ast.Symbol) bool {
 * 		if getDeclarationModifierFlagsFromSymbol(tp)&ast.ModifierFlagsProtected != 0 {
 * 			return !c.isPropertyInClassDerivedFrom(sourceProp, c.getDeclaringClass(tp))
 * 		}
 * 		return false
 * 	})
 * }
 */
export declare function Checker_isValidOverrideOf(receiver: GoPtr<Checker>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNodeUsedDuringClassInitialization","kind":"method","status":"implemented","sigHash":"562764416302843dffdaf044f977d79b8034f6261ee34ba473da928f193ca6ea","bodyHash":"d42f8a0376a93aa48037d2e7a8578b5f630ed45facbec6a41d432bbc2fa904ed"}
 *
 * Go source:
 * func (c *Checker) isNodeUsedDuringClassInitialization(node *ast.Node) bool {
 * 	return ast.FindAncestorOrQuit(node, func(element *ast.Node) ast.FindAncestorResult {
 * 		if ast.IsConstructorDeclaration(element) && ast.NodeIsPresent(element.Body()) || ast.IsPropertyDeclaration(element) {
 * 			return ast.FindAncestorTrue
 * 		} else if ast.IsClassLike(element) || ast.IsFunctionLikeDeclaration(element) {
 * 			return ast.FindAncestorQuit
 * 		}
 * 		return ast.FindAncestorFalse
 * 	}) != nil
 * }
 */
export declare function Checker_isNodeUsedDuringClassInitialization(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNodeWithinClass","kind":"method","status":"implemented","sigHash":"1c43417bac561d9afbfcd113abd1dcd1bc742cd242df0998742a72313b7620d8","bodyHash":"c8fe01deb9b0d569d39cea3a7f056e2431f58f96ad723312b526c7f6a91818f2"}
 *
 * Go source:
 * func (c *Checker) isNodeWithinClass(node *ast.Node, classDeclaration *ast.Node) bool {
 * 	return c.forEachEnclosingClass(node, func(n *ast.Node) bool { return n == classDeclaration })
 * }
 */
export declare function Checker_isNodeWithinClass(receiver: GoPtr<Checker>, node: GoPtr<Node>, classDeclaration: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.forEachEnclosingClass","kind":"method","status":"implemented","sigHash":"34d0ab9e2c969c9319a4cdab5ced974d2bbda073f564c6dfc59a766d52cb588d","bodyHash":"902b71ca107b8d4ba760269734928c4622d94c7c5a9fa0e14956cb9e8af2d51b"}
 *
 * Go source:
 * func (c *Checker) forEachEnclosingClass(node *ast.Node, callback func(node *ast.Node) bool) bool {
 * 	containingClass := ast.GetContainingClass(node)
 * 	for containingClass != nil {
 * 		result := callback(containingClass)
 * 		if result {
 * 			return true
 * 		}
 * 		containingClass = ast.GetContainingClass(containingClass)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_forEachEnclosingClass(receiver: GoPtr<Checker>, node: GoPtr<Node>, callback: (node: GoPtr<Node>) => bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isClassDerivedFromDeclaringClasses","kind":"method","status":"implemented","sigHash":"e1dab0bade28a4036019033395962abbadab5bf022cfc8e554cd9f3da902d26b","bodyHash":"c20a9954688e63dd9fd285af50075b2ecd79b65689cdd2fd6e3442db3a7a5ca2"}
 *
 * Go source:
 * func (c *Checker) isClassDerivedFromDeclaringClasses(checkClass *Type, prop *ast.Symbol, writing bool) bool {
 * 	return !c.forEachProperty(prop, func(p *ast.Symbol) bool {
 * 		if getDeclarationModifierFlagsFromSymbolEx(p, writing)&ast.ModifierFlagsProtected != 0 {
 * 			return !c.hasBaseType(checkClass, c.getDeclaringClass(p))
 * 		}
 * 		return false
 * 	})
 * }
 */
export declare function Checker_isClassDerivedFromDeclaringClasses(receiver: GoPtr<Checker>, checkClass: GoPtr<Type>, prop: GoPtr<Symbol>, writing: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkThisInStaticClassFieldInitializerInDecoratedClass","kind":"method","status":"implemented","sigHash":"e2500996bcbd2817a8c5a429b30ae59ffc477c267fc4033c02a041feaec33ea5","bodyHash":"c7e2abe1839f2634eb55d33b49526ebb7bf25887db89bd3306defd5d2add3716"}
 *
 * Go source:
 * func (c *Checker) checkThisInStaticClassFieldInitializerInDecoratedClass(thisExpression *ast.Node, container *ast.Node) {
 * 	if ast.IsPropertyDeclaration(container) && ast.HasStaticModifier(container) && c.legacyDecorators {
 * 		initializer := container.Initializer()
 * 		if initializer != nil && initializer.Loc.ContainsInclusive(thisExpression.Pos()) && ast.HasDecorators(container.Parent) {
 * 			c.error(thisExpression, diagnostics.Cannot_use_this_in_a_static_property_initializer_of_a_decorated_class)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkThisInStaticClassFieldInitializerInDecoratedClass(receiver: GoPtr<Checker>, thisExpression: GoPtr<Node>, container: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSpreadPropOverrides","kind":"method","status":"implemented","sigHash":"5cbf43942ade7f24a44b8e857aaad6046c344e96f3e4ed13ea8f70cee1888e6b","bodyHash":"2af551bbb4b1c45db0175c25ace546b35a9e3a0bcaf6128a03d47fdeaebcdb08"}
 *
 * Go source:
 * func (c *Checker) checkSpreadPropOverrides(t *Type, props ast.SymbolTable, spread *ast.Node) {
 * 	for _, right := range c.getPropertiesOfType(t) {
 * 		if right.Flags&ast.SymbolFlagsOptional == 0 && right.CheckFlags&ast.CheckFlagsPartial == 0 {
 * 			if left := props[right.Name]; left != nil {
 * 				diagnostic := c.error(left.ValueDeclaration, diagnostics.X_0_is_specified_more_than_once_so_this_usage_will_be_overwritten, left.Name)
 * 				diagnostic.AddRelatedInfo(NewDiagnosticForNode(spread, diagnostics.This_spread_always_overwrites_this_property))
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkSpreadPropOverrides(receiver: GoPtr<Checker>, t: GoPtr<Type>, props: SymbolTable, spread: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isThislessInterface","kind":"method","status":"implemented","sigHash":"0183ae3f5bc64c1e1ce6818eadc2ead8a7c1dd1a454b2171222710b82181cc36","bodyHash":"9289c3ad16cce503af78b741e3ec128626aadbb9bc17dcfcda523e4b783cef54"}
 *
 * Go source:
 * func (c *Checker) isThislessInterface(symbol *ast.Symbol) bool {
 * 	for _, declaration := range symbol.Declarations {
 * 		if ast.IsInterfaceDeclaration(declaration) {
 * 			if declaration.Flags&ast.NodeFlagsContainsThis != 0 {
 * 				return false
 * 			}
 * 			baseTypeNodes := ast.GetExtendsHeritageClauseElements(declaration)
 * 			for _, node := range baseTypeNodes {
 * 				if ast.IsEntityNameExpression(node.Expression()) {
 * 					baseSymbol := c.resolveEntityName(node.Expression(), ast.SymbolFlagsType, true /*ignoreErrors* /, false, nil)
 * 					if baseSymbol == nil || baseSymbol.Flags&ast.SymbolFlagsInterface == 0 || c.getDeclaredTypeOfClassOrInterface(baseSymbol).AsInterfaceType().thisType != nil {
 * 						return false
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function Checker_isThislessInterface(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
//# sourceMappingURL=classes.d.ts.map
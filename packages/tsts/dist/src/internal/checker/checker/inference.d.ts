import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import type { TypeMapper } from "../mapper.js";
import type { RecursionId } from "../relater.js";
import type { Type, TypeAlias, TypeFlags } from "../types.js";
import type { Checker, InferenceContext } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkInferType","kind":"method","status":"implemented","sigHash":"e2af2d9c2cc28901ca0482b7aa53939d3873152da30ef08d2e378c076fb9c8ca","bodyHash":"cf7706d68bec9fdd3bd0a6b82c52601c897c6a31becf66b2de28b9b1627ac4ae"}
 *
 * Go source:
 * func (c *Checker) checkInferType(node *ast.Node) {
 * 	if ast.FindAncestor(node, func(n *ast.Node) bool {
 * 		return n.Parent != nil && n.Parent.Kind == ast.KindConditionalType && (n.Parent.AsConditionalTypeNode()).ExtendsType == n
 * 	}) == nil {
 * 		c.grammarErrorOnNode(node, diagnostics.X_infer_declarations_are_only_permitted_in_the_extends_clause_of_a_conditional_type)
 * 	}
 * 	typeParameterDeclarationNode := node.AsInferTypeNode().TypeParameter
 * 	c.checkSourceElement(typeParameterDeclarationNode)
 * 	symbol := c.getSymbolOfDeclaration(typeParameterDeclarationNode)
 * 	if len(symbol.Declarations) > 1 {
 * 		links := c.declaredTypeLinks.Get(symbol)
 * 		if !links.typeParametersChecked {
 * 			links.typeParametersChecked = true
 * 			typeParameter := c.getDeclaredTypeOfTypeParameter(symbol)
 * 			declarations := getDeclarationsOfKind(symbol, ast.KindTypeParameter)
 * 			if !c.areTypeParametersIdentical(declarations, []*Type{typeParameter}, func(decl *ast.Node) []*ast.Node { return []*ast.Node{decl} }) {
 * 				// Report an error on every conflicting declaration.
 * 				name := c.symbolToString(symbol)
 * 				for _, declaration := range declarations {
 * 					c.error(declaration.Name(), diagnostics.All_declarations_of_0_must_have_identical_constraints, name)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.registerForUnusedIdentifiersCheck(node)
 * }
 */
export declare function Checker_checkInferType(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexConstraints","kind":"method","status":"implemented","sigHash":"976a6dc1100ef9bc4b3cd53da3cf431978679077b5c7bf51d3481d904402546d","bodyHash":"953102bb9298b8ec8d0be3ecf0022e06ff11515372d200f340312a11ef201c91"}
 *
 * Go source:
 * func (c *Checker) checkIndexConstraints(t *Type, symbol *ast.Symbol, isStaticIndex bool) {
 * 	indexInfos := c.getIndexInfosOfType(t)
 * 	if len(indexInfos) == 0 {
 * 		return
 * 	}
 * 	for _, prop := range c.getPropertiesOfObjectType(t) {
 * 		if !(isStaticIndex && prop.Flags&ast.SymbolFlagsPrototype != 0) {
 * 			c.checkIndexConstraintForProperty(t, prop, c.getLiteralTypeFromProperty(prop, TypeFlagsStringOrNumberLiteralOrUnique, true /*includeNonPublic* /), c.getNonMissingTypeOfSymbol(prop))
 * 		}
 * 	}
 * 	typeDeclaration := symbol.ValueDeclaration
 * 	if typeDeclaration != nil && ast.IsClassLike(typeDeclaration) {
 * 		for _, member := range typeDeclaration.Members() {
 * 			// Only process instance properties against instance index signatures and static properties against static index signatures
 * 			if ast.IsStatic(member) == isStaticIndex && !c.hasBindableName(member) {
 * 				symbol := c.getSymbolOfDeclaration(member)
 * 				c.checkIndexConstraintForProperty(t, symbol, c.getTypeOfExpression(member.Name().Expression()), c.getNonMissingTypeOfSymbol(symbol))
 * 			}
 * 		}
 * 	}
 * 	if len(indexInfos) > 1 {
 * 		for _, info := range indexInfos {
 * 			c.checkIndexConstraintForIndexSignature(t, info)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkIndexConstraints(receiver: GoPtr<Checker>, t: GoPtr<Type>, symbol_: GoPtr<Symbol>, isStaticIndex: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexConstraintForProperty","kind":"method","status":"implemented","sigHash":"01de6759e2a5ee826e00911e73fce9ff4b3f115608c6a30561186af53fefdb16","bodyHash":"0f8c443143bf4b18b0b5e11a7484bb38cbb268d84dfa08acac95e6360ee45e69"}
 *
 * Go source:
 * func (c *Checker) checkIndexConstraintForProperty(t *Type, prop *ast.Symbol, propNameType *Type, propType *Type) {
 * 	declaration := prop.ValueDeclaration
 * 	name := ast.GetNameOfDeclaration(declaration)
 * 	if name != nil && ast.IsPrivateIdentifier(name) {
 * 		return
 * 	}
 * 	indexInfos := c.getApplicableIndexInfos(t, propNameType)
 * 	if len(indexInfos) == 0 {
 * 		return
 * 	}
 * 	var interfaceDeclaration *ast.Node
 * 	if t.objectFlags&ObjectFlagsInterface != 0 {
 * 		interfaceDeclaration = ast.GetDeclarationOfKind(t.symbol, ast.KindInterfaceDeclaration)
 * 	}
 * 	var propDeclaration *ast.Node
 * 	if declaration != nil && ast.IsBinaryExpression(declaration) || name != nil && ast.IsComputedPropertyName(name) {
 * 		propDeclaration = declaration
 * 	}
 * 	var localPropDeclaration *ast.Node
 * 	if c.getParentOfSymbol(prop) == t.symbol {
 * 		localPropDeclaration = declaration
 * 	}
 * 	for _, info := range indexInfos {
 * 		var localIndexDeclaration *ast.Node
 * 		if info.declaration != nil && c.getParentOfSymbol(c.getSymbolOfDeclaration(info.declaration)) == t.symbol {
 * 			localIndexDeclaration = info.declaration
 * 		}
 * 		// We check only when (a) the property is declared in the containing type, or (b) the applicable index signature is declared
 * 		// in the containing type, or (c) the containing type is an interface and no base interface contains both the property and
 * 		// the index signature (i.e. property and index signature are declared in separate inherited interfaces).
 * 		errorNode := core.OrElse(localPropDeclaration, localIndexDeclaration)
 * 		if errorNode == nil && interfaceDeclaration != nil && !core.Some(c.getBaseTypes(t), func(base *Type) bool {
 * 			return c.getPropertyOfObjectType(base, prop.Name) != nil && c.getIndexTypeOfType(base, info.keyType) != nil
 * 		}) {
 * 			errorNode = interfaceDeclaration
 * 		}
 * 		if errorNode != nil && !c.isTypeAssignableTo(propType, info.valueType) {
 * 			diagnostic := NewDiagnosticForNode(errorNode, diagnostics.Property_0_of_type_1_is_not_assignable_to_2_index_type_3, c.symbolToString(prop), c.TypeToString(propType), c.TypeToString(info.keyType), c.TypeToString(info.valueType))
 * 			if propDeclaration != nil && errorNode != propDeclaration {
 * 				diagnostic.AddRelatedInfo(NewDiagnosticForNode(propDeclaration, diagnostics.X_0_is_declared_here, c.symbolToString(prop)))
 * 			}
 * 			c.diagnostics.Add(diagnostic)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkIndexConstraintForProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, prop: GoPtr<Symbol>, propNameType: GoPtr<Type>, propType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInstantiationExpressionType","kind":"method","status":"implemented","sigHash":"30bdae0a0981f28505b6363fd0315792d8e4586cf7f8625d62dc7120b6f83356","bodyHash":"6661b77eb6f96aca8ac04665cc3719f08394de8b12f2629f2d9bf0e16e221410"}
 *
 * Go source:
 * func (c *Checker) getInstantiationExpressionType(exprType *Type, node *ast.Node) *Type {
 * 	typeArguments := node.TypeArgumentList()
 * 	if exprType == c.silentNeverType || c.isErrorType(exprType) || typeArguments == nil {
 * 		return exprType
 * 	}
 * 	key := InstantiationExpressionKey{nodeId: ast.GetNodeId(node), typeId: exprType.id}
 * 	if cached := c.instantiationExpressionTypes[key]; cached != nil {
 * 		return cached
 * 	}
 * 	hasSomeApplicableSignature := false
 * 	var nonApplicableType *Type
 * 	getInstantiatedSignatures := func(signatures []*Signature) []*Signature {
 * 		applicableSignatures := core.Filter(signatures, func(sig *Signature) bool {
 * 			return len(sig.typeParameters) != 0 && c.hasCorrectTypeArgumentArity(sig, typeArguments.Nodes)
 * 		})
 * 		return core.SameMap(applicableSignatures, func(sig *Signature) *Signature {
 * 			typeArgumentTypes := c.checkTypeArguments(sig, typeArguments.Nodes, true /*reportErrors* /, nil)
 * 			if typeArgumentTypes != nil {
 * 				return c.getSignatureInstantiation(sig, typeArgumentTypes, ast.IsInJSFile(sig.declaration), nil)
 * 			}
 * 			return sig
 * 		})
 * 	}
 * 	var getInstantiatedType func(*Type) *Type
 * 	getInstantiatedType = func(t *Type) *Type {
 * 		hasSignatures := false
 * 		hasApplicableSignature := false
 * 		var getInstantiatedTypePart func(*Type) *Type
 * 		getInstantiatedTypePart = func(t *Type) *Type {
 * 			if t.flags&TypeFlagsObject != 0 {
 * 				resolved := c.resolveStructuredTypeMembers(t)
 * 				callSignatures := getInstantiatedSignatures(resolved.CallSignatures())
 * 				constructSignatures := getInstantiatedSignatures(resolved.ConstructSignatures())
 * 				hasSignatures = hasSignatures || len(resolved.CallSignatures()) != 0 || len(resolved.ConstructSignatures()) != 0
 * 				hasApplicableSignature = hasApplicableSignature || len(callSignatures) != 0 || len(constructSignatures) != 0
 * 				if !core.Same(callSignatures, resolved.CallSignatures()) || !core.Same(constructSignatures, resolved.ConstructSignatures()) {
 * 					result := c.newObjectType(ObjectFlagsAnonymous|ObjectFlagsInstantiationExpressionType, c.newSymbol(ast.SymbolFlagsNone, ast.InternalSymbolNameInstantiationExpression))
 * 					c.setStructuredTypeMembers(result, resolved.members, callSignatures, constructSignatures, resolved.indexInfos)
 * 					result.AsInstantiationExpressionType().node = node
 * 					return result
 * 				}
 * 			} else if t.flags&TypeFlagsInstantiableNonPrimitive != 0 {
 * 				constraint := c.getBaseConstraintOfType(t)
 * 				if constraint != nil {
 * 					instantiated := getInstantiatedTypePart(constraint)
 * 					if instantiated != constraint {
 * 						return instantiated
 * 					}
 * 				}
 * 			} else if t.flags&TypeFlagsUnion != 0 {
 * 				return c.mapType(t, getInstantiatedType)
 * 			} else if t.flags&TypeFlagsIntersection != 0 {
 * 				return c.getIntersectionType(core.SameMap(t.AsIntersectionType().types, getInstantiatedTypePart))
 * 			}
 * 			return t
 * 		}
 * 		result := getInstantiatedTypePart(t)
 * 		hasSomeApplicableSignature = hasSomeApplicableSignature || hasApplicableSignature
 * 		if hasSignatures && !hasApplicableSignature {
 * 			if nonApplicableType == nil {
 * 				nonApplicableType = t
 * 			}
 * 		}
 * 		return result
 * 	}
 * 	result := getInstantiatedType(exprType)
 * 	c.instantiationExpressionTypes[key] = result
 * 	var errorType *Type
 * 	if hasSomeApplicableSignature {
 * 		errorType = nonApplicableType
 * 	} else {
 * 		errorType = exprType
 * 	}
 * 	if errorType != nil {
 * 		sourceFile := ast.GetSourceFileOfNode(node)
 * 		loc := core.NewTextRange(scanner.SkipTrivia(sourceFile.Text(), typeArguments.Pos()), typeArguments.End())
 * 		c.diagnostics.Add(ast.NewDiagnostic(sourceFile, loc, diagnostics.Type_0_has_no_signatures_for_which_the_type_argument_list_is_applicable, c.TypeToString(errorType)))
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getInstantiationExpressionType(receiver: GoPtr<Checker>, exprType: GoPtr<Type>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfInstantiatedSymbol","kind":"method","status":"implemented","sigHash":"226e4cde8c9362d94ab7d5555b3fb681bd38283e9932ae77da17de3d327b1c7b","bodyHash":"e13ab464d870c7127e4c2058f911b8febb2908068ee9048b37c4d7785734b1b0"}
 *
 * Go source:
 * func (c *Checker) getTypeOfInstantiatedSymbol(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		links.resolvedType = c.instantiateType(c.getTypeOfSymbol(links.target), links.mapper)
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfInstantiatedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWriteTypeOfInstantiatedSymbol","kind":"method","status":"implemented","sigHash":"ab2a3ed55a51cd05172158ba2d5bf8cbb7548cdabf2589cd46c5fecaca8cf739","bodyHash":"2422047381de7a70e86950fbcc18c8e4246c685cf5d62f853fbd42573223c2c7"}
 *
 * Go source:
 * func (c *Checker) getWriteTypeOfInstantiatedSymbol(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.writeType == nil {
 * 		links.writeType = c.instantiateType(c.getWriteTypeOfSymbol(links.target), links.mapper)
 * 	}
 * 	return links.writeType
 * }
 */
export declare function Checker_getWriteTypeOfInstantiatedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.widenTypeInferredFromInitializer","kind":"method","status":"implemented","sigHash":"8bb5db821481fe21aa5ca4312b01e87b22b55e0f9a2a0722ee70bac7ba5d71ca","bodyHash":"3307c37d1f4f5d13122cff4ff34c812443d9784ad6b6bdc137879c0a10ce3f2e"}
 *
 * Go source:
 * func (c *Checker) widenTypeInferredFromInitializer(declaration *ast.Node, t *Type) *Type {
 * 	widened := c.getWidenedLiteralTypeForInitializer(declaration, t)
 * 	if ast.IsInJSFile(declaration) {
 * 		if c.isEmptyLiteralType(widened) {
 * 			c.reportImplicitAny(declaration, c.anyType, WideningKindNormal)
 * 			return c.anyType
 * 		}
 * 		if c.isEmptyArrayLiteralType(widened) {
 * 			c.reportImplicitAny(declaration, c.anyArrayType, WideningKindNormal)
 * 			return c.anyArrayType
 * 		}
 * 	}
 * 	return widened
 * }
 */
export declare function Checker_widenTypeInferredFromInitializer(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOfType","kind":"method","status":"implemented","sigHash":"337014b8626069903f39b7c19b17d829238c71767f9f846c8f22d5b279f8979b","bodyHash":"e788d840448864ff0d7b29075c085bbae4c68622f6fe9b6783d38799c5162c98"}
 *
 * Go source:
 * func (c *Checker) getConstraintOfType(t *Type) *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		return c.getConstraintOfTypeParameter(t)
 * 	case t.flags&TypeFlagsIndexedAccess != 0:
 * 		return c.getConstraintOfIndexedAccess(t)
 * 	case t.flags&TypeFlagsConditional != 0:
 * 		return c.getConstraintOfConditionalType(t)
 * 	}
 * 	return c.getBaseConstraintOfType(t)
 * }
 */
export declare function Checker_getConstraintOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasNonCircularBaseConstraint","kind":"method","status":"implemented","sigHash":"db1d5c955efba5d92827b6132c92d4fd2107815e631957b347e3b17276ea9219","bodyHash":"ea8e235582825835d8aaca51fbe142983b54b563a79815aaa1fa449399a812a0"}
 *
 * Go source:
 * func (c *Checker) hasNonCircularBaseConstraint(t *Type) bool {
 * 	return c.getResolvedBaseConstraint(t, nil) != c.circularConstraintType
 * }
 */
export declare function Checker_hasNonCircularBaseConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOfIndexedAccess","kind":"method","status":"implemented","sigHash":"270a70c407514bff33954aeec10c8291d7bdb5150da712022c2278b9f451ed0f","bodyHash":"fa238b098ef935f0933783fd11bde8bb4287ebe355f8895fbc64f9713e543ba5"}
 *
 * Go source:
 * func (c *Checker) getConstraintOfIndexedAccess(t *Type) *Type {
 * 	if c.hasNonCircularBaseConstraint(t) {
 * 		return c.getConstraintFromIndexedAccess(t)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstraintOfIndexedAccess(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintFromIndexedAccess","kind":"method","status":"implemented","sigHash":"53276662a1fd2b10723892f2f7a4727bafe9d9bf276b6aeb2ed7d14e7828e034","bodyHash":"b1d797f8e1f82770f8527fad9519c943c39cf140322382fe3e0b5cbe6b4ccaf6"}
 *
 * Go source:
 * func (c *Checker) getConstraintFromIndexedAccess(t *Type) *Type {
 * 	d := t.AsIndexedAccessType()
 * 	if c.isMappedTypeGenericIndexedAccess(t) {
 * 		// For indexed access types of the form { [P in K]: E }[X], where K is non-generic and X is generic,
 * 		// we substitute an instantiation of E where P is replaced with X.
 * 		return c.substituteIndexedMappedType(d.objectType, d.indexType)
 * 	}
 * 	indexConstraint := c.getSimplifiedTypeOrConstraint(d.indexType)
 * 	if indexConstraint != nil && indexConstraint != d.indexType {
 * 		indexedAccess := c.getIndexedAccessTypeOrUndefined(d.objectType, indexConstraint, d.accessFlags, nil, nil)
 * 		if indexedAccess != nil {
 * 			return indexedAccess
 * 		}
 * 	}
 * 	objectConstraint := c.getSimplifiedTypeOrConstraint(d.objectType)
 * 	if objectConstraint != nil && objectConstraint != d.objectType {
 * 		return c.getIndexedAccessTypeOrUndefined(objectConstraint, d.indexType, d.accessFlags, nil, nil)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstraintFromIndexedAccess(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOfConditionalType","kind":"method","status":"implemented","sigHash":"928bc6c1716c57f40f1759ff457c9f09f7e407dd5a5c9423859723dbad1edd86","bodyHash":"a037ab2235dfa69990f40c1900870bcea0d69f7d3dbdd8e9223a3b4dd3841e80"}
 *
 * Go source:
 * func (c *Checker) getConstraintOfConditionalType(t *Type) *Type {
 * 	if c.hasNonCircularBaseConstraint(t) {
 * 		return c.getConstraintFromConditionalType(t)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstraintOfConditionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintFromConditionalType","kind":"method","status":"implemented","sigHash":"327186facc88d72f8ea2b7227965adbfb588c3f019fa4b6123e646e8d29c94ba","bodyHash":"4adfe4be7243ba3ba4b3a1986e55f524a27be79e9c3e589d4b7cbd4984410862"}
 *
 * Go source:
 * func (c *Checker) getConstraintFromConditionalType(t *Type) *Type {
 * 	constraint := c.getConstraintOfDistributiveConditionalType(t)
 * 	if constraint != nil {
 * 		return constraint
 * 	}
 * 	return c.getDefaultConstraintOfConditionalType(t)
 * }
 */
export declare function Checker_getConstraintFromConditionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefaultConstraintOfConditionalType","kind":"method","status":"implemented","sigHash":"1105b837a83859bedd556d62ed8ecb77d4ba73a4d2ce9738cd6d548a70a3efbb","bodyHash":"fd9370923fcd522b20c1955bd6504a4959420b15795abc9ef7f85d25a5d936fa"}
 *
 * Go source:
 * func (c *Checker) getDefaultConstraintOfConditionalType(t *Type) *Type {
 * 	d := t.AsConditionalType()
 * 	if d.resolvedDefaultConstraint == nil {
 * 		// An `any` branch of a conditional type would normally be viral - specifically, without special handling here,
 * 		// a conditional type with a single branch of type `any` would be assignable to anything, since it's constraint would simplify to
 * 		// just `any`. This result is _usually_ unwanted - so instead here we elide an `any` branch from the constraint type,
 * 		// in effect treating `any` like `never` rather than `unknown` in this location.
 * 		trueConstraint := c.getInferredTrueTypeFromConditionalType(t)
 * 		falseConstraint := c.getFalseTypeFromConditionalType(t)
 * 		switch {
 * 		case IsTypeAny(trueConstraint):
 * 			d.resolvedDefaultConstraint = falseConstraint
 * 		case IsTypeAny(falseConstraint):
 * 			d.resolvedDefaultConstraint = trueConstraint
 * 		default:
 * 			d.resolvedDefaultConstraint = c.getUnionType([]*Type{trueConstraint, falseConstraint})
 * 		}
 * 	}
 * 	return d.resolvedDefaultConstraint
 * }
 */
export declare function Checker_getDefaultConstraintOfConditionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOfDistributiveConditionalType","kind":"method","status":"implemented","sigHash":"85d264686376c67a4db2926d8c7d5a5c9ab94111d33ab67fbd55625fb6365948","bodyHash":"2df8734a024f4ff0ca9c1e6352c645d36dbedf783d1aba8b31d4ef661d28e3f3"}
 *
 * Go source:
 * func (c *Checker) getConstraintOfDistributiveConditionalType(t *Type) *Type {
 * 	d := t.AsConditionalType()
 * 	if d.resolvedConstraintOfDistributive == nil {
 * 		// Check if we have a conditional type of the form 'T extends U ? X : Y', where T is a constrained
 * 		// type parameter. If so, create an instantiation of the conditional type where T is replaced
 * 		// with its constraint. We do this because if the constraint is a union type it will be distributed
 * 		// over the conditional type and possibly reduced. For example, 'T extends undefined ? never : T'
 * 		// removes 'undefined' from T.
 * 		// We skip returning a distributive constraint for a restrictive instantiation of a conditional type
 * 		// as the constraint for all type params (check type included) have been replace with `unknown`, which
 * 		// is going to produce even more false positive/negative results than the distribute constraint already does.
 * 		// Please note: the distributive constraint is a kludge for emulating what a negated type could to do filter
 * 		// a union - once negated types exist and are applied to the conditional false branch, this "constraint"
 * 		// likely doesn't need to exist.
 * 		if d.root.isDistributive && c.cachedTypes[CachedTypeKey{kind: CachedTypeKindRestrictiveInstantiation, typeId: t.id}] != t {
 * 			constraint := c.getSimplifiedType(d.checkType, false /*writing* /)
 * 			if constraint == d.checkType {
 * 				constraint = c.getConstraintOfType(constraint)
 * 			}
 * 			if constraint != nil && constraint != d.checkType {
 * 				instantiated := c.getConditionalTypeInstantiation(t, prependTypeMapping(d.root.checkType, constraint, d.mapper), true /*forConstraint* /, nil)
 * 				if instantiated.flags&TypeFlagsNever == 0 {
 * 					d.resolvedConstraintOfDistributive = instantiated
 * 					return instantiated
 * 				}
 * 			}
 * 		}
 * 		d.resolvedConstraintOfDistributive = c.noConstraintType
 * 	}
 * 	if d.resolvedConstraintOfDistributive != c.noConstraintType {
 * 		return d.resolvedConstraintOfDistributive
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstraintOfDistributiveConditionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createInstantiatedSymbolTable","kind":"method","status":"implemented","sigHash":"d317a703b102fcfdc86d88892fcd28bfad810a3530b04d7906906177fe3138ba","bodyHash":"a82f1d666c82eb03529c861168d2a44b6099a2cb6ad4675aa64d5cef3659cdae"}
 *
 * Go source:
 * func (c *Checker) createInstantiatedSymbolTable(symbols []*ast.Symbol, m *TypeMapper) ast.SymbolTable {
 * 	if len(symbols) == 0 {
 * 		return nil
 * 	}
 * 	result := make(ast.SymbolTable)
 * 	for _, symbol := range symbols {
 * 		result[symbol.Name] = c.instantiateSymbol(symbol, m)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_createInstantiatedSymbolTable(receiver: GoPtr<Checker>, symbols: GoPtr<GoSlice<GoPtr<Symbol>>>, m: GoPtr<TypeMapper>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.pushActiveMapper","kind":"method","status":"implemented","sigHash":"93bc291b9d8b3e4cabc7eb4c422e92196380229983c3abddbc7c7cf8f59bbf55","bodyHash":"c61ec403d9fb0ca9f091d3ff12a05a482ccaa4cc5e7f4d8c8f768ece7a845a6c"}
 *
 * Go source:
 * func (c *Checker) pushActiveMapper(mapper *TypeMapper) {
 * 	c.activeMappers = append(c.activeMappers, mapper)
 *
 * 	lastIndex := len(c.activeTypeMappersCaches)
 * 	if cap(c.activeTypeMappersCaches) > lastIndex {
 * 		// The cap may contain an empty map from popActiveMapper; reuse it.
 * 		c.activeTypeMappersCaches = c.activeTypeMappersCaches[:lastIndex+1]
 * 		if c.activeTypeMappersCaches[lastIndex] == nil {
 * 			c.activeTypeMappersCaches[lastIndex] = make(map[CacheHashKey]*Type, 1)
 * 		}
 * 	} else {
 * 		c.activeTypeMappersCaches = append(c.activeTypeMappersCaches, make(map[CacheHashKey]*Type, 1))
 * 	}
 * }
 */
export declare function Checker_pushActiveMapper(receiver: GoPtr<Checker>, mapper: GoPtr<TypeMapper>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.popActiveMapper","kind":"method","status":"implemented","sigHash":"1039bd2a84eb88005c94cb9e9520f91218e9961f50ba3e8faeff7e8a1e867d2b","bodyHash":"a87a8c6c96170f1e0af2f5f11b2acd5233951f123e78a53fa32e86fcb80efa8a"}
 *
 * Go source:
 * func (c *Checker) popActiveMapper() {
 * 	c.activeMappers[len(c.activeMappers)-1] = nil
 * 	c.activeMappers = c.activeMappers[:len(c.activeMappers)-1]
 *
 * 	// Clear the map, but leave it in the list for later reuse.
 * 	lastIndex := len(c.activeTypeMappersCaches) - 1
 * 	clear(c.activeTypeMappersCaches[lastIndex])
 * 	c.activeTypeMappersCaches = c.activeTypeMappersCaches[:lastIndex]
 * }
 */
export declare function Checker_popActiveMapper(receiver: GoPtr<Checker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findActiveMapper","kind":"method","status":"implemented","sigHash":"79d350488b6041fb4ca7b4cb3c14c793db83baeb0742a7a2539fe0b200abc2be","bodyHash":"937d646f359d763b0016e7541cf355914f76ded530493892ef5f5f01f83cd570"}
 *
 * Go source:
 * func (c *Checker) findActiveMapper(mapper *TypeMapper) int {
 * 	return core.FindLastIndex(c.activeMappers, func(m *TypeMapper) bool { return m == mapper })
 * }
 */
export declare function Checker_findActiveMapper(receiver: GoPtr<Checker>, mapper: GoPtr<TypeMapper>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.clearActiveMapperCaches","kind":"method","status":"implemented","sigHash":"2fa1de3870b3968d7f05f45d1253351050249b498afb70bd5820bd8ba11ac37c","bodyHash":"d7e1b4a0757461963d3a84a1bfcfb740a68acd75853d85ae1b6346a3cbd705da"}
 *
 * Go source:
 * func (c *Checker) clearActiveMapperCaches() {
 * 	for _, cache := range c.activeTypeMappersCaches {
 * 		clear(cache)
 * 	}
 * }
 */
export declare function Checker_clearActiveMapperCaches(receiver: GoPtr<Checker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getObjectTypeInstantiation","kind":"method","status":"implemented","sigHash":"1a498b6e89216db4d9bc28425e4e1714860d6068cbbecdd6752b2894d57ddffd","bodyHash":"7ea69b598fc81d16151c91e158964c0b1c0121032c9b4c4be6dfe07a91aae0fe"}
 *
 * Go source:
 * func (c *Checker) getObjectTypeInstantiation(t *Type, m *TypeMapper, alias *TypeAlias) *Type {
 * 	var declaration *ast.Node
 * 	var target *Type
 * 	var typeParameters []*Type
 * 	switch {
 * 	case t.objectFlags&ObjectFlagsReference != 0: // Deferred type reference
 * 		declaration = t.AsTypeReference().node
 * 	case t.objectFlags&ObjectFlagsInstantiationExpressionType != 0:
 * 		declaration = t.AsInstantiationExpressionType().node
 * 	default:
 * 		declaration = t.symbol.Declarations[0]
 * 	}
 * 	links := c.typeNodeLinks.Get(declaration)
 * 	switch {
 * 	case t.objectFlags&ObjectFlagsReference != 0: // Deferred type reference
 * 		target = links.resolvedType
 * 	case t.objectFlags&ObjectFlagsInstantiated != 0:
 * 		target = t.Target()
 * 	default:
 * 		target = t
 * 	}
 * 	typeParameters = links.outerTypeParameters
 * 	if typeParameters == nil {
 * 		// The first time an anonymous type is instantiated we compute and store a list of the type
 * 		// parameters that are in scope (and therefore potentially referenced). For type literals that
 * 		// aren't the right hand side of a generic type alias declaration we optimize by reducing the
 * 		// set of type parameters to those that are possibly referenced in the literal.
 * 		typeParameters = c.getOuterTypeParameters(declaration, true /*includeThisTypes* /)
 * 		if len(target.alias.TypeArguments()) == 0 {
 * 			if t.objectFlags&(ObjectFlagsReference|ObjectFlagsInstantiationExpressionType) != 0 {
 * 				typeParameters = core.Filter(typeParameters, func(tp *Type) bool {
 * 					return c.isTypeParameterPossiblyReferenced(tp, declaration)
 * 				})
 * 			} else if target.symbol.Flags&(ast.SymbolFlagsMethod|ast.SymbolFlagsTypeLiteral) != 0 {
 * 				typeParameters = core.Filter(typeParameters, func(tp *Type) bool {
 * 					return core.Some(t.symbol.Declarations, func(d *ast.Node) bool {
 * 						return c.isTypeParameterPossiblyReferenced(tp, d)
 * 					})
 * 				})
 * 			}
 * 		}
 * 		if typeParameters == nil {
 * 			typeParameters = []*Type{}
 * 		}
 * 		links.outerTypeParameters = typeParameters
 * 	}
 * 	if len(typeParameters) == 0 {
 * 		return t
 * 	}
 * 	// We are instantiating an anonymous type that has one or more type parameters in scope. Apply the
 * 	// mapper to the type parameters to produce the effective list of type arguments, and compute the
 * 	// instantiation cache key from the type IDs of the type arguments.
 * 	combinedMapper := c.combineTypeMappers(t.Mapper(), m)
 * 	typeArguments := make([]*Type, len(typeParameters))
 * 	for i, tp := range typeParameters {
 * 		typeArguments[i] = combinedMapper.Map(tp)
 * 	}
 * 	newAlias := alias
 * 	if newAlias == nil {
 * 		newAlias = c.instantiateTypeAlias(t.alias, m)
 * 	}
 * 	data := target.AsObjectType()
 * 	key := getTypeInstantiationKey(typeArguments, newAlias, t.objectFlags&ObjectFlagsSingleSignatureType != 0)
 * 	if data.instantiations == nil {
 * 		data.instantiations = make(map[CacheHashKey]*Type)
 * 		data.instantiations[getTypeInstantiationKey(typeParameters, target.alias, false)] = target
 * 	}
 * 	result := data.instantiations[key]
 * 	if result == nil {
 * 		newMapper := newTypeMapper(typeParameters, typeArguments)
 * 		if target.objectFlags&ObjectFlagsSingleSignatureType != 0 && m != nil {
 * 			newMapper = c.combineTypeMappers(newMapper, m)
 * 		}
 * 		switch {
 * 		case target.objectFlags&ObjectFlagsReference != 0:
 * 			result = c.createDeferredTypeReference(t.Target(), t.AsTypeReference().node, newMapper, newAlias)
 * 		case target.objectFlags&ObjectFlagsMapped != 0:
 * 			result = c.instantiateMappedType(target, newMapper, newAlias)
 * 		default:
 * 			result = c.instantiateAnonymousType(target, newMapper, newAlias)
 * 		}
 * 		data.instantiations[key] = result
 * 		if result.flags&TypeFlagsObjectFlagsType != 0 && result.objectFlags&ObjectFlagsCouldContainTypeVariablesComputed == 0 {
 * 			// if `result` is one of the object types we tried to make (it may not be, due to how `instantiateMappedType` works), we can carry forward the type variable containment check from the input type arguments
 * 			resultCouldContainObjectFlags := core.Some(typeArguments, c.couldContainTypeVariables)
 * 			if result.objectFlags&ObjectFlagsCouldContainTypeVariablesComputed == 0 {
 * 				if result.objectFlags&(ObjectFlagsMapped|ObjectFlagsAnonymous|ObjectFlagsReference) != 0 {
 * 					result.objectFlags |= ObjectFlagsCouldContainTypeVariablesComputed | core.IfElse(resultCouldContainObjectFlags, ObjectFlagsCouldContainTypeVariables, 0)
 * 				} else {
 * 					// If none of the type arguments for the outer type parameters contain type variables, it follows
 * 					// that the instantiated type doesn't reference type variables.
 * 					// Intrinsics have `CouldContainTypeVariablesComputed` pre-set, so this should only cover unions and intersections resulting from `instantiateMappedType`
 * 					result.objectFlags |= core.IfElse(!resultCouldContainObjectFlags, ObjectFlagsCouldContainTypeVariablesComputed, 0)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getObjectTypeInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>, m: GoPtr<TypeMapper>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConditionalTypeInstantiation","kind":"method","status":"implemented","sigHash":"6b968bc364931de58a7e1860c88141bf9e4d160ea626bb1f4d4301dd21243de4","bodyHash":"90ad230272a3961872dd5ed1c18b8cd8769135b6e6ca4e6a717732c2a3650471"}
 *
 * Go source:
 * func (c *Checker) getConditionalTypeInstantiation(t *Type, mapper *TypeMapper, forConstraint bool, alias *TypeAlias) *Type {
 * 	root := t.AsConditionalType().root
 * 	if len(root.outerTypeParameters) != 0 {
 * 		// We are instantiating a conditional type that has one or more type parameters in scope. Apply the
 * 		// mapper to the type parameters to produce the effective list of type arguments, and compute the
 * 		// instantiation cache key from the type IDs of the type arguments.
 * 		typeArguments := core.Map(root.outerTypeParameters, mapper.Map)
 * 		key := getConditionalTypeKey(typeArguments, alias, forConstraint)
 * 		result := root.instantiations[key]
 * 		if result == nil {
 * 			newMapper := newTypeMapper(root.outerTypeParameters, typeArguments)
 * 			checkType := root.checkType
 * 			var distributionType *Type
 * 			if root.isDistributive {
 * 				distributionType = c.getReducedType(newMapper.Map(checkType))
 * 			}
 * 			// Distributive conditional types are distributed over union types. For example, when the
 * 			// distributive conditional type T extends U ? X : Y is instantiated with A | B for T, the
 * 			// result is (A extends U ? X : Y) | (B extends U ? X : Y).
 * 			if distributionType != nil && checkType != distributionType && distributionType.flags&(TypeFlagsUnion|TypeFlagsNever) != 0 {
 * 				result = c.mapTypeWithAlias(distributionType, func(t *Type) *Type {
 * 					return c.getConditionalType(root, prependTypeMapping(checkType, t, newMapper), forConstraint, nil)
 * 				}, alias)
 * 			} else {
 * 				result = c.getConditionalType(root, newMapper, forConstraint, alias)
 * 			}
 * 			root.instantiations[key] = result
 * 		}
 * 		return result
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getConditionalTypeInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>, mapper: GoPtr<TypeMapper>, forConstraint: bool, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasArrayOrTypeTypeConstraint","kind":"method","status":"implemented","sigHash":"a2dc9bbd71713636ead52668b6cbbf291d1360ec62e00a709b310f4668fe8b40","bodyHash":"0f9c8757f2b139fd1e26fdbf96514de7a10450a91b140a748b0f2611a334238e"}
 *
 * Go source:
 * func (c *Checker) hasArrayOrTypeTypeConstraint(typeVariable *Type) bool {
 * 	constraint := c.getConstraintOfTypeParameter(typeVariable)
 * 	return constraint != nil && everyType(constraint, c.isArrayOrTupleType)
 * }
 */
export declare function Checker_hasArrayOrTypeTypeConstraint(receiver: GoPtr<Checker>, typeVariable: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintTypeFromMappedType","kind":"method","status":"implemented","sigHash":"cea7aec5d85e16d9bfd19582a225a25c34348499c80b832bfd478605229f5edd","bodyHash":"eb61a4c9191956ff070f70b74f203c6675ac2e05ff2c0b3e7117d91088144355"}
 *
 * Go source:
 * func (c *Checker) getConstraintTypeFromMappedType(t *Type) *Type {
 * 	m := t.AsMappedType()
 * 	if m.constraintType == nil {
 * 		m.constraintType = core.OrElse(c.getConstraintOfTypeParameter(c.getTypeParameterFromMappedType(t)), c.errorType)
 * 	}
 * 	return m.constraintType
 * }
 */
export declare function Checker_getConstraintTypeFromMappedType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isMappedTypeWithKeyofConstraintDeclaration","kind":"method","status":"implemented","sigHash":"bde337779534158e466b99c19d7ca1ba6a0d4fc2a5a3a116a47cce645c1a081b","bodyHash":"b1362e244c2b39e86d9301f0efe6a1dda91e50c502ea4d8acf31a4307ed10cde"}
 *
 * Go source:
 * func (c *Checker) isMappedTypeWithKeyofConstraintDeclaration(t *Type) bool {
 * 	constraintDeclaration := c.getConstraintDeclarationForMappedType(t)
 * 	return ast.IsTypeOperatorNode(constraintDeclaration) && constraintDeclaration.AsTypeOperatorNode().Operator == ast.KindKeyOfKeyword
 * }
 */
export declare function Checker_isMappedTypeWithKeyofConstraintDeclaration(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintDeclarationForMappedType","kind":"method","status":"implemented","sigHash":"e2597f168a2ae9d6d1695b98b52dc80e55d084ad0e6c15c6eaf5aabe707f2958","bodyHash":"937fb0cd718dd1f53b1739ccfc01a5bfd55e488b2b7a1ec2d3a90a9ffd371f23"}
 *
 * Go source:
 * func (c *Checker) getConstraintDeclarationForMappedType(t *Type) *ast.Node {
 * 	return t.AsMappedType().declaration.TypeParameter.AsTypeParameterDeclaration().Constraint
 * }
 */
export declare function Checker_getConstraintDeclarationForMappedType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeAliasInstantiation","kind":"method","status":"implemented","sigHash":"f6bed79b5fe6c3b11a594664f7e6283bbce7162f58985fb7a9856433761a34d8","bodyHash":"29d45b8fb5ebd9d1a56aa7137cb0fa907b55b3599d7035eceee083124e579c9e"}
 *
 * Go source:
 * func (c *Checker) getTypeAliasInstantiation(symbol *ast.Symbol, typeArguments []*Type, alias *TypeAlias) *Type {
 * 	t := c.getDeclaredTypeOfSymbol(symbol)
 * 	if t == c.intrinsicMarkerType {
 * 		if typeKind, ok := intrinsicTypeKinds[symbol.Name]; ok && len(typeArguments) == 1 {
 * 			switch typeKind {
 * 			case IntrinsicTypeKindNoInfer:
 * 				return c.getNoInferType(typeArguments[0])
 * 			default:
 * 				return c.getStringMappingType(symbol, typeArguments[0])
 * 			}
 * 		}
 * 	}
 * 	links := c.typeAliasLinks.Get(symbol)
 * 	typeParameters := links.typeParameters
 * 	key := getTypeAliasInstantiationKey(typeArguments, alias)
 * 	instantiation := links.instantiations[key]
 * 	if instantiation == nil {
 * 		mapper := newTypeMapper(typeParameters, c.fillMissingTypeArguments(typeArguments, typeParameters, c.getMinTypeArgumentCount(typeParameters), ast.IsInJSFile(symbol.ValueDeclaration)))
 * 		instantiation = c.instantiateTypeWithAlias(t, mapper, alias)
 * 		links.instantiations[key] = instantiation
 * 	}
 * 	return instantiation
 * }
 */
export declare function Checker_getTypeAliasInstantiation(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, typeArguments: GoSlice<GoPtr<Type>>, alias: GoPtr<TypeAlias>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPermissiveInstantiation","kind":"method","status":"implemented","sigHash":"4b7c92ad382a67f3426dd802d512ec5311f33d8de1e01a1d2f7611e10bc2a5b5","bodyHash":"64b6cdbfd071e08202556bdff4616f9062b353a61030cba05c40b9293a7b1796"}
 *
 * Go source:
 * func (c *Checker) getPermissiveInstantiation(t *Type) *Type {
 * 	if t.flags&(TypeFlagsPrimitive|TypeFlagsAnyOrUnknown|TypeFlagsNever) != 0 {
 * 		return t
 * 	}
 * 	key := CachedTypeKey{kind: CachedTypeKindPermissiveInstantiation, typeId: t.id}
 * 	if cached := c.cachedTypes[key]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.instantiateType(t, c.permissiveMapper)
 * 	c.cachedTypes[key] = result
 * 	return result
 * }
 */
export declare function Checker_getPermissiveInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRestrictiveInstantiation","kind":"method","status":"implemented","sigHash":"37433fdccd1923b9e9e34614420ab9a99e648a6b531dca5430fe4c30ecadfcfa","bodyHash":"acd94fe313aef34af0593da7d752111f636539e7b5aeb4981c6a20e29c077a99"}
 *
 * Go source:
 * func (c *Checker) getRestrictiveInstantiation(t *Type) *Type {
 * 	if t.flags&(TypeFlagsPrimitive|TypeFlagsAnyOrUnknown|TypeFlagsNever) != 0 {
 * 		return t
 * 	}
 * 	key := CachedTypeKey{kind: CachedTypeKindRestrictiveInstantiation, typeId: t.id}
 * 	if cached := c.cachedTypes[key]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.instantiateType(t, c.restrictiveMapper)
 * 	c.cachedTypes[key] = result
 * 	// We set the following so we don't attempt to set the restrictive instance of a restrictive instance
 * 	// which is redundant - we'll produce new type identities, but all type params have already been mapped.
 * 	// This also gives us a way to detect restrictive instances upon comparisons and _disable_ the "distributeive constraint"
 * 	// assignability check for them, which is distinctly unsafe, as once you have a restrctive instance, all the type parameters
 * 	// are constrained to `unknown` and produce tons of false positives/negatives!
 * 	c.cachedTypes[CachedTypeKey{kind: CachedTypeKindRestrictiveInstantiation, typeId: result.id}] = result
 * 	return result
 * }
 */
export declare function Checker_getRestrictiveInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.restrictiveMapperWorker","kind":"method","status":"implemented","sigHash":"7acd6d3f7670c2d2cd81bfe277d5960552511c6ccf2e23dbda188c67a50132cf","bodyHash":"c4393bb7d7c5baa711b9ad16b9d2b98b16b34e62affe5692ba1dff8da858ca69"}
 *
 * Go source:
 * func (c *Checker) restrictiveMapperWorker(t *Type) *Type {
 * 	if t.flags&TypeFlagsTypeParameter != 0 {
 * 		return c.getRestrictiveTypeParameter(t)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_restrictiveMapperWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.permissiveMapperWorker","kind":"method","status":"implemented","sigHash":"885439293f97822eef1d4661d6d1ed063960c1a76ada729e9f6847d27c0c7483","bodyHash":"905405adcbc01b6932250d68ebabcfb982a7fcf0d3b2c1fa131428e703dc2d63"}
 *
 * Go source:
 * func (c *Checker) permissiveMapperWorker(t *Type) *Type {
 * 	if t.flags&TypeFlagsTypeParameter != 0 {
 * 		return c.wildcardType
 * 	}
 * 	return t
 * }
 */
export declare function Checker_permissiveMapperWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInferredTrueTypeFromConditionalType","kind":"method","status":"implemented","sigHash":"8ff0321692437dcdcb0e93995d9ea52f93010d12cd08bce24a464e46c49191d1","bodyHash":"f0fc383b7e0b23aafd8ae2e28cc7f6323c5e1d27c4243d66240bfe0050f6bc9a"}
 *
 * Go source:
 * func (c *Checker) getInferredTrueTypeFromConditionalType(t *Type) *Type {
 * 	d := t.AsConditionalType()
 * 	if d.resolvedInferredTrueType == nil {
 * 		if d.combinedMapper != nil {
 * 			d.resolvedInferredTrueType = c.instantiateType(c.getTypeFromTypeNode(d.root.node.TrueType), d.combinedMapper)
 * 		} else {
 * 			d.resolvedInferredTrueType = c.getTrueTypeFromConditionalType(t)
 * 		}
 * 	}
 * 	return d.resolvedInferredTrueType
 * }
 */
export declare function Checker_getInferredTrueTypeFromConditionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromInferTypeNode","kind":"method","status":"implemented","sigHash":"7ec1d168895919a4941a2ef2f6b2d27f88307a127a3a9435e20c056d899859c7","bodyHash":"c84455469d5d1e714742127fa3562261cc761af3c9be080d5785fc622b4bdfd8"}
 *
 * Go source:
 * func (c *Checker) getTypeFromInferTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		links.resolvedType = c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(node.AsInferTypeNode().TypeParameter))
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeFromInferTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getImpliedConstraint","kind":"method","status":"implemented","sigHash":"a028aa244c2c76b51e6685fa2f5347a7c6289b6aa6d7d8aaa34fcbae882b0298","bodyHash":"95d8460f8ca96579fadaa6a489484fd721281481db51c4b488f88e0df56cb9b4"}
 *
 * Go source:
 * func (c *Checker) getImpliedConstraint(t *Type, checkNode *ast.Node, extendsNode *ast.Node) *Type {
 * 	switch {
 * 	case isUnaryTupleTypeNode(checkNode) && isUnaryTupleTypeNode(extendsNode):
 * 		return c.getImpliedConstraint(t, checkNode.Elements()[0], extendsNode.Elements()[0])
 * 	case c.getActualTypeVariable(c.getTypeFromTypeNode(checkNode)) == c.getActualTypeVariable(t):
 * 		return c.getTypeFromTypeNode(extendsNode)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getImpliedConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, checkNode: GoPtr<Node>, extendsNode: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newStringMappingType","kind":"method","status":"implemented","sigHash":"3aff1f05ac8039a689388dcd109d371928a78459b251f300764d172b34a1bc0b","bodyHash":"1db267b70296cad3e096fb8b8fe14fd1feaf297c4ae31093f284205e5f5baa6f"}
 *
 * Go source:
 * func (c *Checker) newStringMappingType(symbol *ast.Symbol, target *Type) *Type {
 * 	data := &StringMappingType{}
 * 	data.target = target
 * 	t := c.newType(TypeFlagsStringMapping, ObjectFlagsNone, data)
 * 	t.symbol = symbol
 * 	return t
 * }
 */
export declare function Checker_newStringMappingType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, target: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newSubstitutionType","kind":"method","status":"implemented","sigHash":"bfc885d6bb16ae7f9b1b30db1782b177801c27e140bf10750146a5be5c64535a","bodyHash":"16f63417758d7ef015caa4db26f24e67408e22610143ad08f0759c1287366c80"}
 *
 * Go source:
 * func (c *Checker) newSubstitutionType(baseType *Type, constraint *Type) *Type {
 * 	data := &SubstitutionType{}
 * 	data.baseType = baseType
 * 	data.constraint = constraint
 * 	return c.newType(TypeFlagsSubstitution, ObjectFlagsNone, data)
 * }
 */
export declare function Checker_newSubstitutionType(receiver: GoPtr<Checker>, baseType: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeMatchedByTemplateLiteralOrStringMapping","kind":"method","status":"implemented","sigHash":"b32a1831fa6ffa7d2debc1cdc204281754fb9a9590e3aacd554b9f29935ee561","bodyHash":"8cb7bce2613bab2fb72b6a17c62efb807840939a6e6af46363727a3e14a7190d"}
 *
 * Go source:
 * func (c *Checker) isTypeMatchedByTemplateLiteralOrStringMapping(t *Type, template *Type) bool {
 * 	if template.flags&TypeFlagsTemplateLiteral != 0 {
 * 		return c.isTypeMatchedByTemplateLiteralType(t, template.AsTemplateLiteralType(), c.compareTypesAssignable)
 * 	}
 * 	return c.isMemberOfStringMapping(t, template)
 * }
 */
export declare function Checker_isTypeMatchedByTemplateLiteralOrStringMapping(receiver: GoPtr<Checker>, t: GoPtr<Type>, template: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNoInferType","kind":"method","status":"implemented","sigHash":"91b278ab0809164789b02edaf07297c6188f1b3380990eca10d23bea10c01ecb","bodyHash":"1dd2f4cd3ec467ef4c2502e3b69cc09973cff323360ccc7a22d421d2c7c96cd6"}
 *
 * Go source:
 * func (c *Checker) isNoInferType(t *Type) bool {
 * 	// A NoInfer<T> type is represented as a substitution type with a TypeFlags.Unknown constraint.
 * 	return t.flags&TypeFlagsSubstitution != 0 && t.AsSubstitutionType().constraint.flags&TypeFlagsUnknown != 0
 * }
 */
export declare function Checker_isNoInferType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSubstitutionIntersection","kind":"method","status":"implemented","sigHash":"fb1644065470b72323a5c0309808cf9d66771e40df55d9c1700457830316b058","bodyHash":"864d9a2604a1e7f58d0194b9258aa53a4a15c57a307a7ed10c5ef67584c2bfb8"}
 *
 * Go source:
 * func (c *Checker) getSubstitutionIntersection(t *Type) *Type {
 * 	if c.isNoInferType(t) {
 * 		return t.AsSubstitutionType().baseType
 * 	}
 * 	return c.getIntersectionType([]*Type{t.AsSubstitutionType().constraint, t.AsSubstitutionType().baseType})
 * }
 */
export declare function Checker_getSubstitutionIntersection(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNoInferType","kind":"method","status":"implemented","sigHash":"01b802188097a8561366d6037e1d94adfa86b71d5eb1cbc87bf44e76c04d5eda","bodyHash":"0a21acca5c5a33e74b5146e0cda64e4bd917fc1b060ca033360072c9216f7152"}
 *
 * Go source:
 * func (c *Checker) getNoInferType(t *Type) *Type {
 * 	if c.isNoInferTargetType(t) {
 * 		return c.getOrCreateSubstitutionType(t, c.unknownType)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getNoInferType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isNoInferTargetType","kind":"method","status":"implemented","sigHash":"ccdc1b4640c03c03b99c21b6aece7d389b4d16873fcc4cd66308acbab2776309","bodyHash":"4c88596090719c378d482c362164da2178ad95a5189a3d936fb9021d87edb161"}
 *
 * Go source:
 * func (c *Checker) isNoInferTargetType(t *Type) bool {
 * 	// This is effectively a more conservative and predictable form of couldContainTypeVariables. We want to
 * 	// preserve NoInfer<T> only for types that could contain type variables, but we don't want to exhaustively
 * 	// examine all object type members.
 * 	return t.flags&TypeFlagsUnionOrIntersection != 0 && core.Some(t.AsUnionOrIntersectionType().types, c.isNoInferTargetType) ||
 * 		t.flags&TypeFlagsSubstitution != 0 && !c.isNoInferType(t) && c.isNoInferTargetType(t.AsSubstitutionType().baseType) ||
 * 		t.flags&TypeFlagsObject != 0 && !c.IsEmptyAnonymousObjectType(t) ||
 * 		t.flags&(TypeFlagsInstantiable & ^TypeFlagsSubstitution) != 0 && !c.isPatternLiteralType(t)
 * }
 */
export declare function Checker_isNoInferTargetType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSubstitutionType","kind":"method","status":"implemented","sigHash":"6e34fad3e2c36df7c8bef21e7c4752bc00a5fcec18f80863d12988bd8c218e79","bodyHash":"163083b56d08b81cfd308e4e72a191dfbc3e69090d6f095f284c7747233b8459"}
 *
 * Go source:
 * func (c *Checker) getSubstitutionType(baseType *Type, constraint *Type) *Type {
 * 	if constraint.flags&TypeFlagsAnyOrUnknown != 0 || constraint == baseType || baseType.flags&TypeFlagsAny != 0 {
 * 		return baseType
 * 	}
 * 	return c.getOrCreateSubstitutionType(baseType, constraint)
 * }
 */
export declare function Checker_getSubstitutionType(receiver: GoPtr<Checker>, baseType: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOrCreateSubstitutionType","kind":"method","status":"implemented","sigHash":"ad5e612d8179f3d02282ad2602f390922fd8e26d0f5b007060ee544adbb88788","bodyHash":"a65fd7f063b88e516be98c482f1ff4d4f3a3ad93feed78490dc48262bc013607"}
 *
 * Go source:
 * func (c *Checker) getOrCreateSubstitutionType(baseType *Type, constraint *Type) *Type {
 * 	key := SubstitutionTypeKey{baseId: baseType.id, constraintId: constraint.id}
 * 	if cached := c.substitutionTypes[key]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.newSubstitutionType(baseType, constraint)
 * 	c.substitutionTypes[key] = result
 * 	return result
 * }
 */
export declare function Checker_getOrCreateSubstitutionType(receiver: GoPtr<Checker>, baseType: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getBaseConstraintOrType","kind":"method","status":"implemented","sigHash":"1863b5191bc1cff735b3799b91c81abfae938ebcfdc6ec83616bb74a0410b792","bodyHash":"324e85c1e4694d240e1e2f6a0731c85f377ddab315ba657f55b4084604a56d1a"}
 *
 * Go source:
 * func (c *Checker) getBaseConstraintOrType(t *Type) *Type {
 * 	constraint := c.getBaseConstraintOfType(t)
 * 	if constraint != nil {
 * 		return constraint
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getBaseConstraintOrType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getBaseConstraintOfType","kind":"method","status":"implemented","sigHash":"6296a84259f1d82a22cf12e036597c8c0ff5d4b6760665d5d93ac78d178bdb6a","bodyHash":"f688e1f42216acdbcfaf14bc427d200d7d7b39f968d9977ee9f0f8118a92d012"}
 *
 * Go source:
 * func (c *Checker) getBaseConstraintOfType(t *Type) *Type {
 * 	if t.flags&(TypeFlagsInstantiableNonPrimitive|TypeFlagsUnionOrIntersection|TypeFlagsTemplateLiteral|TypeFlagsStringMapping|TypeFlagsIndex) != 0 || c.isGenericTupleType(t) {
 * 		constraint := c.getResolvedBaseConstraint(t, nil)
 * 		if constraint != c.noConstraintType && constraint != c.circularConstraintType {
 * 			return constraint
 * 		}
 * 		return nil
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getBaseConstraintOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedBaseConstraint","kind":"method","status":"implemented","sigHash":"b3b0a227a01f8791f125b4ebac3e050a58e91475ff2a5d1dcc2777128b278f6e","bodyHash":"7a2f10fe6b1d15a6e02c23a18fac0c6aaef4e696d65836dde9bec965b11da275"}
 *
 * Go source:
 * func (c *Checker) getResolvedBaseConstraint(t *Type, stack []RecursionId) *Type {
 * 	constrained := t.AsConstrainedType()
 * 	if constrained == nil {
 * 		return t
 * 	}
 * 	if constrained.resolvedBaseConstraint != nil {
 * 		return constrained.resolvedBaseConstraint
 * 	}
 * 	if !c.pushTypeResolution(t, TypeSystemPropertyNameResolvedBaseConstraint) {
 * 		return c.circularConstraintType
 * 	}
 * 	var constraint *Type
 * 	// We always explore at least 10 levels of nested constraints. Thereafter, we continue to explore
 * 	// up to 50 levels of nested constraints provided there are no "deeply nested" types on the stack
 * 	// (i.e. no types for which five instantiations have been recorded on the stack). If we reach 50
 * 	// levels of nesting, we are presumably exploring a repeating pattern with a long cycle that hasn't
 * 	// yet triggered the deeply nested limiter. We have no test cases that actually get to 50 levels of
 * 	// nesting, so it is effectively just a safety stop.
 * 	identity := getRecursionIdentity(t)
 * 	if len(stack) < 10 || len(stack) < 50 && !slices.Contains(stack, identity) {
 * 		constraint = c.computeBaseConstraint(c.getSimplifiedType(t /*writing* /, false), append(stack, identity))
 * 	}
 * 	if !c.popTypeResolution() {
 * 		if t.flags&TypeFlagsTypeParameter != 0 {
 * 			errorNode := c.getConstraintDeclaration(t)
 * 			if errorNode != nil {
 * 				diagnostic := c.error(errorNode, diagnostics.Type_parameter_0_has_a_circular_constraint, c.TypeToString(t))
 * 				if c.currentNode != nil && !isNodeDescendantOf(errorNode, c.currentNode) && !isNodeDescendantOf(c.currentNode, errorNode) {
 * 					diagnostic.AddRelatedInfo(NewDiagnosticForNode(c.currentNode, diagnostics.Circularity_originates_in_type_at_this_location))
 * 				}
 * 			}
 * 		}
 * 		constraint = c.circularConstraintType
 * 	}
 * 	if constraint == nil {
 * 		constraint = c.noConstraintType
 * 	}
 * 	if constrained.resolvedBaseConstraint == nil {
 * 		constrained.resolvedBaseConstraint = constraint
 * 	}
 * 	return constraint
 * }
 */
export declare function Checker_getResolvedBaseConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, stack: GoSlice<RecursionId>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.computeBaseConstraint","kind":"method","status":"implemented","sigHash":"51d003d5e356976a2b87f8d41c22768f42dcc2e7dd2f22e48b209ab236fd75b5","bodyHash":"567218102c362c81af817b157f0d323b7087b2021c4daae4bea3137936932697"}
 *
 * Go source:
 * func (c *Checker) computeBaseConstraint(t *Type, stack []RecursionId) *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		constraint := c.getConstraintFromTypeParameter(t)
 * 		if t.AsTypeParameter().isThisType {
 * 			return constraint
 * 		}
 * 		return c.getNextBaseConstraint(constraint, stack)
 * 	case t.flags&TypeFlagsUnionOrIntersection != 0:
 * 		types := t.Types()
 * 		constraints := make([]*Type, 0, len(types))
 * 		different := false
 * 		for _, s := range types {
 * 			constraint := c.getNextBaseConstraint(s, stack)
 * 			if constraint != nil {
 * 				if constraint != s {
 * 					different = true
 * 				}
 * 				constraints = append(constraints, constraint)
 * 			} else {
 * 				different = true
 * 			}
 * 		}
 * 		if !different {
 * 			return t
 * 		}
 * 		switch {
 * 		case t.flags&TypeFlagsUnion != 0 && len(constraints) == len(types):
 * 			return c.getUnionType(constraints)
 * 		case t.flags&TypeFlagsIntersection != 0 && len(constraints) != 0:
 * 			return c.getIntersectionType(constraints)
 * 		}
 * 		return nil
 * 	case t.flags&TypeFlagsIndex != 0:
 * 		if c.isGenericMappedType(t.AsIndexType().target) {
 * 			mappedType := t.AsIndexType().target
 * 			if c.getNameTypeFromMappedType(mappedType) != nil && !c.isMappedTypeWithKeyofConstraintDeclaration(mappedType) {
 * 				return c.getNextBaseConstraint(c.getIndexTypeForMappedType(mappedType, IndexFlagsNone), stack)
 * 			}
 * 		}
 * 		return c.stringNumberSymbolType
 * 	case t.flags&TypeFlagsTemplateLiteral != 0:
 * 		types := t.Types()
 * 		constraints := make([]*Type, 0, len(types))
 * 		for _, s := range types {
 * 			constraint := c.getNextBaseConstraint(s, stack)
 * 			if constraint != nil {
 * 				constraints = append(constraints, constraint)
 * 			}
 * 		}
 * 		if len(constraints) == len(types) {
 * 			return c.getTemplateLiteralType(t.AsTemplateLiteralType().texts, constraints)
 * 		}
 * 		return c.stringType
 * 	case t.flags&TypeFlagsStringMapping != 0:
 * 		constraint := c.getNextBaseConstraint(t.Target(), stack)
 * 		if constraint != nil && constraint != t.Target() {
 * 			return c.getStringMappingType(t.symbol, constraint)
 * 		}
 * 		return c.stringType
 * 	case t.flags&TypeFlagsIndexedAccess != 0:
 * 		if c.isMappedTypeGenericIndexedAccess(t) {
 * 			// For indexed access types of the form { [P in K]: E }[X], where K is non-generic and X is generic,
 * 			// we substitute an instantiation of E where P is replaced with X.
 * 			return c.getNextBaseConstraint(c.substituteIndexedMappedType(t.AsIndexedAccessType().objectType, t.AsIndexedAccessType().indexType), stack)
 * 		}
 * 		baseObjectType := c.getNextBaseConstraint(t.AsIndexedAccessType().objectType, stack)
 * 		baseIndexType := c.getNextBaseConstraint(t.AsIndexedAccessType().indexType, stack)
 * 		if baseObjectType == nil || baseIndexType == nil {
 * 			return nil
 * 		}
 * 		return c.getNextBaseConstraint(c.getIndexedAccessTypeOrUndefined(baseObjectType, baseIndexType, t.AsIndexedAccessType().accessFlags, nil, nil), stack)
 * 	case t.flags&TypeFlagsConditional != 0:
 * 		return c.getNextBaseConstraint(c.getConstraintFromConditionalType(t), stack)
 * 	case t.flags&TypeFlagsSubstitution != 0:
 * 		return c.getNextBaseConstraint(c.getSubstitutionIntersection(t), stack)
 * 	case c.isGenericTupleType(t):
 * 		// We substitute constraints for variadic elements only when the constraints are array types or
 * 		// non-variadic tuple types as we want to avoid further (possibly unbounded) recursion.
 * 		elementTypes := c.getElementTypes(t)
 * 		elementInfos := t.TargetTupleType().elementInfos
 * 		newElements := make([]*Type, 0, len(elementTypes))
 * 		for i, v := range elementTypes {
 * 			newElement := v
 * 			if v.flags&TypeFlagsTypeParameter != 0 && elementInfos[i].flags&ElementFlagsVariadic != 0 {
 * 				constraint := c.getNextBaseConstraint(v, stack)
 * 				if constraint != nil && constraint != v && everyType(constraint, func(n *Type) bool { return c.isArrayOrTupleType(n) && !c.isGenericTupleType(n) }) {
 * 					newElement = constraint
 * 				}
 * 			}
 * 			newElements = append(newElements, newElement)
 * 		}
 * 		return c.createTupleTypeEx(newElements, elementInfos, t.TargetTupleType().readonly)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_computeBaseConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, stack: GoSlice<RecursionId>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNextBaseConstraint","kind":"method","status":"implemented","sigHash":"efe7a0c9a0ae61755f959a0589eed004e9e207a33712d1a56d330d163a0592db","bodyHash":"e4fcba9b90b7a41ae15cf6beb77584328f73516c6db5b972d3d315d6900dbe73"}
 *
 * Go source:
 * func (c *Checker) getNextBaseConstraint(t *Type, stack []RecursionId) *Type {
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	constraint := c.getResolvedBaseConstraint(t, stack)
 * 	if constraint == c.noConstraintType || constraint == c.circularConstraintType {
 * 		return nil
 * 	}
 * 	return constraint
 * }
 */
export declare function Checker_getNextBaseConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, stack: GoSlice<RecursionId>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.maybeTypeOfKindConsideringBaseConstraint","kind":"method","status":"implemented","sigHash":"652eb053ddd167023249a813dc5b6f4990e62bc29a350a39142eddd1791916e9","bodyHash":"7523ab61470c2ebac613261d6d97fa8eb87bc86ce2a2bc11e119560686399de8"}
 *
 * Go source:
 * func (c *Checker) maybeTypeOfKindConsideringBaseConstraint(t *Type, kind TypeFlags) bool {
 * 	if c.maybeTypeOfKind(t, kind) {
 * 		return true
 * 	}
 * 	baseConstraint := c.getBaseConstraintOrType(t)
 * 	return baseConstraint != nil && c.maybeTypeOfKind(baseConstraint, kind)
 * }
 */
export declare function Checker_maybeTypeOfKindConsideringBaseConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: TypeFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSimplifiedTypeOrConstraint","kind":"method","status":"implemented","sigHash":"9eb862b34c77a2938e7186c8aa65e969e36cbe4f0cb3430df1508a685ee4fa81","bodyHash":"82a0c0c0f7ee8b6191973152d49a467f368fa905f9f31bc6c8efe369a21aa70c"}
 *
 * Go source:
 * func (c *Checker) getSimplifiedTypeOrConstraint(t *Type) *Type {
 * 	if simplified := c.getSimplifiedType(t, false /*writing* /); simplified != t {
 * 		return simplified
 * 	}
 * 	return c.getConstraintOfType(t)
 * }
 */
export declare function Checker_getSimplifiedTypeOrConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintDeclaration","kind":"method","status":"implemented","sigHash":"88116be880e46159687ce44cc65dd721411e2a02b77950f1c96cb469ea851d45","bodyHash":"ab6ac7505d89349cc814ec91f033af69bab736b0076ed3608b0bba360a93cbec"}
 *
 * Go source:
 * func (c *Checker) getConstraintDeclaration(t *Type) *ast.Node {
 * 	if t.symbol != nil {
 * 		for _, d := range t.symbol.Declarations {
 * 			if ast.IsTypeParameterDeclaration(d) {
 * 				if constraint := d.AsTypeParameterDeclaration().Constraint; constraint != nil {
 * 					return constraint
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getConstraintDeclaration(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getStringMappingType","kind":"method","status":"implemented","sigHash":"cc63b497a03f5fbcfd7e7a730c4a773b81dfed9115552b771ff282a39f0ceaf1","bodyHash":"6168724c40b097626ce11ee4e44ad11e9ac184cdeb2995a072fb6ec59a1b2349"}
 *
 * Go source:
 * func (c *Checker) getStringMappingType(symbol *ast.Symbol, t *Type) *Type {
 * 	switch {
 * 	case t.flags&(TypeFlagsUnion|TypeFlagsNever) != 0:
 * 		return c.mapType(t, func(t *Type) *Type { return c.getStringMappingType(symbol, t) })
 * 	case t.flags&TypeFlagsStringLiteral != 0:
 * 		return c.getStringLiteralType(applyStringMapping(symbol, getStringLiteralValue(t)))
 * 	case t.flags&TypeFlagsTemplateLiteral != 0:
 * 		return c.getTemplateLiteralType(c.applyTemplateStringMapping(symbol, t.AsTemplateLiteralType().texts, t.AsTemplateLiteralType().types))
 * 	case t.flags&TypeFlagsStringMapping != 0 && symbol == t.symbol:
 * 		return t
 * 	case t.flags&(TypeFlagsAny|TypeFlagsString|TypeFlagsStringMapping) != 0 || c.isGenericIndexType(t):
 * 		return c.getStringMappingTypeForGenericType(symbol, t)
 * 	case c.isPatternLiteralPlaceholderType(t):
 * 		return c.getStringMappingTypeForGenericType(symbol, c.getTemplateLiteralType([]string{"", ""}, []*Type{t}))
 * 	default:
 * 		return t
 * 	}
 * }
 */
export declare function Checker_getStringMappingType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.applyTemplateStringMapping","kind":"method","status":"implemented","sigHash":"7c08cb35e34a53ae15a6530743c75386163009ced347573c2c00224d9bafd72c","bodyHash":"c14e47ecb5dea4a6a5fc8b3780a2d09acd94849a6ca8f2e5d675ba0874d338f7"}
 *
 * Go source:
 * func (c *Checker) applyTemplateStringMapping(symbol *ast.Symbol, texts []string, types []*Type) ([]string, []*Type) {
 * 	switch intrinsicTypeKinds[symbol.Name] {
 * 	case IntrinsicTypeKindUppercase, IntrinsicTypeKindLowercase:
 * 		return core.Map(texts, func(t string) string { return applyStringMapping(symbol, t) }),
 * 			core.Map(types, func(t *Type) *Type { return c.getStringMappingType(symbol, t) })
 * 	case IntrinsicTypeKindCapitalize, IntrinsicTypeKindUncapitalize:
 * 		if texts[0] != "" {
 * 			newTexts := slices.Clone(texts)
 * 			newTexts[0] = applyStringMapping(symbol, newTexts[0])
 * 			return newTexts, types
 * 		}
 * 		newTypes := slices.Clone(types)
 * 		newTypes[0] = c.getStringMappingType(symbol, newTypes[0])
 * 		return texts, newTypes
 * 	}
 * 	return texts, types
 * }
 */
export declare function Checker_applyTemplateStringMapping(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, texts: GoSlice<string>, types: GoSlice<GoPtr<Type>>): [GoSlice<string>, GoSlice<GoPtr<Type>>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getStringMappingTypeForGenericType","kind":"method","status":"implemented","sigHash":"f5662761c93d7c83221d4990933837d353e53a22d3d00da642b25557acbed97b","bodyHash":"9c312ea2c5887f6e589e97885e384f7c4df26bddf3eb098291dbc22372a83f3e"}
 *
 * Go source:
 * func (c *Checker) getStringMappingTypeForGenericType(symbol *ast.Symbol, t *Type) *Type {
 * 	key := StringMappingKey{s: symbol, t: t}
 * 	result := c.stringMappingTypes[key]
 * 	if result == nil {
 * 		result = c.newStringMappingType(symbol, t)
 * 		c.stringMappingTypes[key] = result
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getStringMappingTypeForGenericType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForSubstitutionExpression","kind":"method","status":"implemented","sigHash":"4f5df8d236258674455550f74447db03aced06c285f7e25fc4a1885f7cf47c59","bodyHash":"7b9d05307ee4b76fec2464287bb97848eeb9d5e3e11d997588104c98edd737a6"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForSubstitutionExpression(template *ast.Node, substitutionExpression *ast.Node) *Type {
 * 	if ast.IsTaggedTemplateExpression(template.Parent) {
 * 		return c.getContextualTypeForArgument(template.Parent, substitutionExpression)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getContextualTypeForSubstitutionExpression(receiver: GoPtr<Checker>, template: GoPtr<Node>, substitutionExpression: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.pushInferenceContext","kind":"method","status":"implemented","sigHash":"29baad4a41669e838f062509de88d529377004d30373abd3d4bebbb4a39f8ef2","bodyHash":"343ddc056f169ac65ff053b73c8e2b1babef4f851aaaf2c08d160647bf9c7acc"}
 *
 * Go source:
 * func (c *Checker) pushInferenceContext(node *ast.Node, context *InferenceContext) {
 * 	c.inferenceContextInfos = append(c.inferenceContextInfos, InferenceContextInfo{node, context})
 * }
 */
export declare function Checker_pushInferenceContext(receiver: GoPtr<Checker>, node: GoPtr<Node>, context: GoPtr<InferenceContext>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.popInferenceContext","kind":"method","status":"implemented","sigHash":"53ec58b9e89420b09877ffa92896776e0f457257e3eddd2fff3716d0e97a777c","bodyHash":"e6d3cb49e8803e5bc4ebf107a7b1cb1c92737fd8f690b45c23029256fc2c884d"}
 *
 * Go source:
 * func (c *Checker) popInferenceContext() {
 * 	lastIndex := len(c.inferenceContextInfos) - 1
 * 	c.inferenceContextInfos[lastIndex] = InferenceContextInfo{}
 * 	c.inferenceContextInfos = c.inferenceContextInfos[:lastIndex]
 * }
 */
export declare function Checker_popInferenceContext(receiver: GoPtr<Checker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInferenceContext","kind":"method","status":"implemented","sigHash":"6d5cc9b0845da019bdc3fa333cb71d86980a70012ddffa23a109b71f3168bb09","bodyHash":"0a97fbe62dc5f65175802ac9a2650f1b6af8f43f6ca035603e1c69de2ef07789"}
 *
 * Go source:
 * func (c *Checker) getInferenceContext(node *ast.Node) *InferenceContext {
 * 	for i := len(c.inferenceContextInfos) - 1; i >= 0; i-- {
 * 		if isNodeDescendantOf(node, c.inferenceContextInfos[i].node) {
 * 			return c.inferenceContextInfos[i].context
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getInferenceContext(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<InferenceContext>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getGlobalNonNullableTypeInstantiation","kind":"method","status":"implemented","sigHash":"706229bba7d6a8c3f68229fbc9fc60e9817055d03b1a51cb71793530e202d4fb","bodyHash":"2b20a6f1479c59c658944b847ab604b436294a2960db2bd3d7b7c5667ccf6d90"}
 *
 * Go source:
 * func (c *Checker) getGlobalNonNullableTypeInstantiation(t *Type) *Type {
 * 	alias := c.getGlobalNonNullableTypeAliasOrNil()
 * 	if alias != nil {
 * 		return c.getTypeAliasInstantiation(alias, []*Type{t}, nil)
 * 	}
 * 	return c.getIntersectionType([]*Type{t, c.emptyObjectType})
 * }
 */
export declare function Checker_getGlobalNonNullableTypeInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isAwaitedTypeInstantiation","kind":"method","status":"implemented","sigHash":"d957e173f3eada38468d142b80114d12d0b8554fea7d696382424b4fb9051079","bodyHash":"05b85a6faeb6b08bf93eca0d9b2da4028c119c2267eab1329c2a047e3fde3245"}
 *
 * Go source:
 * func (c *Checker) isAwaitedTypeInstantiation(t *Type) bool {
 * 	if t.flags&TypeFlagsConditional != 0 {
 * 		awaitedSymbol := c.getGlobalAwaitedSymbolOrNil()
 * 		return awaitedSymbol != nil && t.alias != nil && t.alias.symbol == awaitedSymbol && len(t.alias.typeArguments) == 1
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isAwaitedTypeInstantiation(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isConstraintPosition","kind":"method","status":"implemented","sigHash":"d43b5541640b03985c675b78e6177f3fa1f63be8c40f2402ab4efc1a760dbbe9","bodyHash":"853f38970b5300b25f25e3baf0a3833baa1a5bb257c92860b7ec47e67ac5f8b9"}
 *
 * Go source:
 * func (c *Checker) isConstraintPosition(t *Type, node *ast.Node) bool {
 * 	parent := node.Parent
 * 	// In an element access obj[x], we consider obj to be in a constraint position, except when obj is of
 * 	// a generic type without a nullable constraint and x is a generic type. This is because when both obj
 * 	// and x are of generic types T and K, we want the resulting type to be T[K].
 * 	return ast.IsPropertyAccessExpression(parent) || ast.IsQualifiedName(parent) ||
 * 		(ast.IsCallExpression(parent) || ast.IsNewExpression(parent)) && parent.Expression() == node ||
 * 		ast.IsElementAccessExpression(parent) && parent.Expression() == node && !(someType(t, c.isGenericTypeWithoutNullableConstraint) && c.isGenericIndexType(c.getTypeOfExpression(parent.AsElementAccessExpression().ArgumentExpression)))
 * }
 */
export declare function Checker_isConstraintPosition(receiver: GoPtr<Checker>, t: GoPtr<Type>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGenericTypeWithUnionConstraint","kind":"method","status":"implemented","sigHash":"8149cd6d49fa40123eeb91d5cfc25dabf922962ff81c0b798f0209be27662584","bodyHash":"8637adee6eb7b2cd6ce30b34a3052b3f47583f3012f553a03f996b1907e78510"}
 *
 * Go source:
 * func (c *Checker) isGenericTypeWithUnionConstraint(t *Type) bool {
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Some(t.AsIntersectionType().types, c.isGenericTypeWithUnionConstraint)
 * 	}
 * 	return t.flags&TypeFlagsInstantiable != 0 && c.getBaseConstraintOrType(t).flags&(TypeFlagsNullable|TypeFlagsUnion) != 0
 * }
 */
export declare function Checker_isGenericTypeWithUnionConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGenericTypeWithoutNullableConstraint","kind":"method","status":"implemented","sigHash":"158ba2c370a200aa07e985fc4b3def5cd077c65b1e13f9c4055457f0eb93e6e9","bodyHash":"289ce757c2d79d5b117b2e645669226708680df3b05a2ac6dee6db3a24810345"}
 *
 * Go source:
 * func (c *Checker) isGenericTypeWithoutNullableConstraint(t *Type) bool {
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Some(t.AsIntersectionType().types, c.isGenericTypeWithoutNullableConstraint)
 * 	}
 * 	return t.flags&TypeFlagsInstantiable != 0 && !c.maybeTypeOfKind(c.getBaseConstraintOrType(t), TypeFlagsNullable)
 * }
 */
export declare function Checker_isGenericTypeWithoutNullableConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGenericTypeWithUndefinedConstraint","kind":"method","status":"implemented","sigHash":"54d54d263e671b32bfd96ca35bc4279fe8e47d45d3d8347b0a5e4286ef3b435d","bodyHash":"7f09c336c70adc7ac2cdc52d50ce1b0caa82aa7c1d4aec984271ffeefc8bdc49"}
 *
 * Go source:
 * func (c *Checker) isGenericTypeWithUndefinedConstraint(t *Type) bool {
 * 	if t.flags&TypeFlagsInstantiable != 0 {
 * 		constraint := c.getBaseConstraintOfType(t)
 * 		if constraint != nil {
 * 			return c.maybeTypeOfKind(constraint, TypeFlagsUndefined)
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isGenericTypeWithUndefinedConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
//# sourceMappingURL=inference.d.ts.map
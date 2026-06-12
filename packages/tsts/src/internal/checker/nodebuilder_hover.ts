import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { NodeFactory_NewModifierList, NodeFactory_NewNodeList } from "../ast/spine.js";
import type { ModifierList, Node } from "../ast/spine.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import { NewClassDeclaration, NewConstructorDeclaration, NewEnumDeclaration, NewEnumMember, NewExportDeclaration, NewExportSpecifier, NewExpressionStatement, NewHeritageClause, NewIdentifier, NewInterfaceDeclaration, NewMethodDeclaration, NewModuleBlock, NewModuleDeclaration, NewNamedExports, NewNumericLiteral, NewPropertyDeclaration, NewPropertySignatureDeclaration, NewStringLiteral, NewTypeAliasDeclaration, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement } from "../ast/generated/factory.js";
import { AsMethodSignatureDeclaration, AsPropertySignatureDeclaration } from "../ast/generated/casts.js";
import { KindCallSignature, KindConstructor, KindConstructSignature, KindFunctionDeclaration, KindMethodSignature, KindModuleKeyword, KindNamespaceKeyword, KindPropertySignature } from "../ast/generated/kinds.js";
import {
  SymbolFlagsAlias,
  SymbolFlagsBlockScopedVariable,
  SymbolFlagsClass,
  SymbolFlagsEnum,
  SymbolFlagsFunction,
  SymbolFlagsFunctionScopedVariable,
  SymbolFlagsInterface,
  SymbolFlagsMethod,
  SymbolFlagsNamespace,
  SymbolFlagsNamespaceModule,
  SymbolFlagsProperty,
  SymbolFlagsPrototype,
  SymbolFlagsType,
  SymbolFlagsTypeAlias,
  SymbolFlagsValueModule,
} from "../ast/generated/flags.js";
import { NodeFlagsLet, SymbolFlagsAll } from "../ast/generated/flags.js";
import { CanHaveModifiers, CreateModifiersFromModifierFlags, HasStaticModifier, HasSyntacticModifier, IsClassLike, IsInJSFile, ReplaceModifiers } from "../ast/utilities.js";
import { IsExportDeclaration } from "../ast/generated/predicates.js";
import {
  GetExtendsHeritageClauseElements,
  GetImplementsHeritageClauseElements,
} from "../ast/utilities.js";
import { KindExtendsKeyword, KindImplementsKeyword } from "../ast/generated/kinds.js";
import { NodeFactory_DeepCloneNode } from "../ast/deepclone.js";
import { Node_Modifiers, Node_Name } from "../ast/spine.js";
import { IsEnumMember, IsIdentifier, IsInterfaceDeclaration } from "../ast/generated/predicates.js";
import { AsEnumMember } from "../ast/generated/casts.js";
import { TokenFlagsNone } from "../ast/tokenflags.js";
import type { TokenFlags } from "../ast/tokenflags.js";
import { IsPrivateIdentifier } from "../ast/generated/predicates.js";
import { Find, Filter, Every, Some, Map, FirstOrNil } from "../core/core.js";
import type { Symbol } from "../ast/symbol.js";
import { NewSetWithSizeHint, Set_Add, Set_AddIfAbsent, Set_Has, Set_Len } from "../collections/set.js";
import type { Set } from "../collections/set.js";
import type { NodeBuilderContext, NodeBuilderImpl } from "./nodebuilderimpl.js";
import { NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper, NodeBuilderImpl_serializeTypeForDeclaration } from "./nodebuilderimpl.js";
import { Checker_getIndexInfoOfType, Checker_getIndexInfosOfType } from "./checker/symbols.js";
import { Checker_getBaseConstructorTypeOfClass, Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias, Checker_getSignaturesOfType, Checker_getTypeWithThisArgument } from "./checker/signatures.js";
import { Checker_getDeclaredTypeOfClassOrInterface, Checker_getBaseTypes, Checker_getPropertiesOfType, Checker_getTargetType, Checker_getWidenedType, Checker_getIntersectionType } from "./checker/types.js";
import { Checker_getDeclaredTypeOfTypeAlias, Checker_getMergedSymbol, Checker_getDeclarationOfAliasSymbol, Checker_getTargetOfAliasDeclaration, Checker_resolveSymbol, Checker_getExportsOfSymbol, Checker_resolveStructuredTypeMembers, Checker_getTypeOfSymbol } from "./checker/symbols.js";
import { Checker_isTypeIdenticalTo } from "./relater.js";
import { Checker_GetConstantValue } from "./services.js";
import type { IndexInfo, Signature, StructuredType, Type } from "./types.js";
import { SignatureFlagsAbstract, StructuredType_CallSignatures, StructuredType_ConstructSignatures, StructuredType_Properties, Type_AsInterfaceType } from "./types.js";
import { SymbolName } from "../ast/symbol.js";
import { SymbolFlagsEnumMember } from "../ast/generated/flags.js";
import { ModifierFlagsConst, ModifierFlagsExport, ModifierFlagsNone, ModifierFlagsAsync, ModifierFlagsStatic, ModifierFlagsPrivate, ModifierFlagsProtected } from "../ast/modifierflags.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import { isConstEnumSymbol } from "./checker/state.js";
import { SymbolFormatFlagsUseOnlyExternalAliasing } from "./types.js";
import { IsIdentifierText } from "../scanner/utilities.js";
import { LanguageVariantStandard } from "../core/languagevariant.js";
import { SignatureKindConstruct, SignatureKindCall, TernaryTrue } from "./types.js";
import { Checker_compareSignaturesIdentical, Checker_compareTypesIdentical } from "./relater.js";
import { Node_ModifierFlags, NodeFactory_NewModifier } from "../ast/ast.js";
import type { IdentifierNode, TypeElement } from "../ast/generated/unions.js";
import { Checker_sortSymbols, getDeclarationModifierFlagsFromSymbol } from "./utilities.js";
import { NodeBuilderImpl_addPropertyToElementList, NodeBuilderImpl_checkTruncationLengthIfExpanding, NodeBuilderImpl_saveRestoreFlags, NodeBuilderImpl_signatureToSignatureDeclarationHelper, NodeBuilderImpl_symbolToNode, NodeBuilderImpl_typeParameterToDeclaration, NodeBuilderImpl_typeToTypeNode } from "./nodebuilderimpl.js";
import type { Flags } from "../nodebuilder/types.js";
import { FlagsInTypeAlias, FlagsWriteTypeParametersInQualifiedName } from "../nodebuilder/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::func::isExpanding","kind":"func","status":"implemented","sigHash":"9b279eca2e40e261f2446006fbc1b56d8ce3ba4865e66b15e3b6b8ef7999c75d","bodyHash":"62e25613c92855d0d4521a198c1f9693ba529fb502dc79f384cb5018c53fb6ab"}
 *
 * Go source:
 * func isExpanding(ctx *NodeBuilderContext) bool {
 * 	return ctx.maxExpansionDepth != -1
 * }
 */
export function isExpanding(ctx: GoPtr<NodeBuilderContext>): bool {
  return ctx!.maxExpansionDepth !== -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.expandSymbolForHover","kind":"method","status":"implemented","sigHash":"e651e1aa811c80e2fed5b93f82610a2dc83b41d63ae6fdf2feebacb1dd2c0b03","bodyHash":"22ebabe904fa7c93dfd63d15a49c9a69be8e257de3b3800fed11b0fd29490f72"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) expandSymbolForHover(symbol *ast.Symbol) []*ast.Node {
 * 	var results []*ast.Node
 * 	if symbol.Flags&ast.SymbolFlagsEnum != 0 {
 * 		if node := b.expandEnumDecl(symbol); node != nil {
 * 			results = append(results, node)
 * 		}
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsClass != 0 {
 * 		if node := b.expandClassDecl(symbol); node != nil {
 * 			results = append(results, node)
 * 		}
 * 	}
 * 	// Module/namespace before interface (matching Strada ordering for merged declarations)
 * 	if symbol.Flags&(ast.SymbolFlagsValueModule|ast.SymbolFlagsNamespaceModule) != 0 {
 * 		if node := b.expandModuleDecl(symbol); node != nil {
 * 			results = append(results, node)
 * 		}
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsInterface != 0 && symbol.Flags&ast.SymbolFlagsClass == 0 {
 * 		if node := b.expandInterfaceDecl(symbol); node != nil {
 * 			results = append(results, node)
 * 		}
 * 	}
 * 	return results
 * }
 */
export function NodeBuilderImpl_expandSymbolForHover(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>> {
  let results: GoSlice<GoPtr<Node>> = [];
  if ((symbol_!.Flags & SymbolFlagsEnum) !== 0) {
    const node = NodeBuilderImpl_expandEnumDecl(receiver, symbol_);
    if (node !== undefined) {
      results = [...results, node];
    }
  }
  if ((symbol_!.Flags & SymbolFlagsClass) !== 0) {
    const node = NodeBuilderImpl_expandClassDecl(receiver, symbol_);
    if (node !== undefined) {
      results = [...results, node];
    }
  }
  if ((symbol_!.Flags & (SymbolFlagsValueModule | SymbolFlagsNamespaceModule)) !== 0) {
    const node = NodeBuilderImpl_expandModuleDecl(receiver, symbol_);
    if (node !== undefined) {
      results = [...results, node];
    }
  }
  if ((symbol_!.Flags & SymbolFlagsInterface) !== 0 && (symbol_!.Flags & SymbolFlagsClass) === 0) {
    const node = NodeBuilderImpl_expandInterfaceDecl(receiver, symbol_);
    if (node !== undefined) {
      results = [...results, node];
    }
  }
  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.expandEnumDecl","kind":"method","status":"implemented","sigHash":"6402d0ed08675815471e6e9073e4b07220ce3e1789c3c6273dccd901bff4c69c","bodyHash":"dee0ebf1606fb928d1b66a419a1a9702fd0fea0f002e8cc5c70c1b6568389ddd"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) expandEnumDecl(symbol *ast.Symbol) *ast.Node {
 * 	name := ast.SymbolName(symbol)
 * 	b.ctx.approximateLength += 9 + len(name)
 * 	memberProps := core.Filter(b.ch.getPropertiesOfType(b.ch.getTypeOfSymbol(symbol)), func(p *ast.Symbol) bool {
 * 		return p.Flags&ast.SymbolFlagsEnumMember != 0
 * 	})
 * 	var members []*ast.Node
 * 	for i, p := range memberProps {
 * 		if b.checkTruncationLengthIfExpanding() && i+3 < len(memberProps)-1 {
 * 			b.ctx.expansionTruncated = true
 * 			members = append(members, b.f.NewEnumMember(b.f.NewStringLiteral(fmt.Sprintf(" ... %d more ... ", len(memberProps)-i-1), 0), nil))
 * 			last := memberProps[len(memberProps)-1]
 * 			members = append(members, b.f.NewEnumMember(b.f.NewIdentifier(last.Name), b.enumMemberInitializer(last)))
 * 			break
 * 		}
 * 		memberDecl := core.Find(p.Declarations, ast.IsEnumMember)
 * 		var initializer *ast.Node
 * 		if memberDecl != nil && memberDecl.AsEnumMember().Initializer != nil {
 * 			initializer = b.f.DeepCloneNode(memberDecl.AsEnumMember().Initializer)
 * 		} else {
 * 			initializer = b.enumMemberInitializer(p)
 * 		}
 * 		b.ctx.approximateLength += 4 + len(p.Name)
 * 		if initializer != nil {
 * 			b.ctx.approximateLength += 5 // " = " + value estimate
 * 		}
 * 		members = append(members, b.f.NewEnumMember(b.f.NewIdentifier(p.Name), initializer))
 * 	}
 * 
 * 	constModifier := ast.ModifierFlagsNone
 * 	if isConstEnumSymbol(symbol) {
 * 		constModifier = ast.ModifierFlagsConst
 * 	}
 * 	var mods *ast.ModifierList
 * 	if constModifier != 0 {
 * 		mods = b.f.NewModifierList(ast.CreateModifiersFromModifierFlags(constModifier, b.f.NewModifier))
 * 	}
 * 	return b.f.NewEnumDeclaration(mods, b.f.NewIdentifier(name), b.f.NewNodeList(members))
 * }
 */
export function NodeBuilderImpl_expandEnumDecl(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const name = SymbolName(symbol_);
  receiver!.ctx!.approximateLength += 9 + name.length;
  const memberProps = Filter(Checker_getPropertiesOfType(receiver!.ch, Checker_getTypeOfSymbol(receiver!.ch, symbol_)), (p) => ((p!.Flags & SymbolFlagsEnumMember) !== 0) as bool);
  let members: GoSlice<GoPtr<Node>> = [];
  for (let i = 0; i < memberProps.length; i++) {
    const p = memberProps[i];
    if (NodeBuilderImpl_checkTruncationLengthIfExpanding(receiver) && i + 3 < memberProps.length - 1) {
      receiver!.ctx!.expansionTruncated = true as bool;
      members = [...members, NewEnumMember(receiver!.f, NewStringLiteral(receiver!.f, ` ... ${memberProps.length - i - 1} more ... `, TokenFlagsNone), undefined)];
      const last = memberProps[memberProps.length - 1];
      members = [...members, NewEnumMember(receiver!.f, NewIdentifier(receiver!.f, last!.Name), NodeBuilderImpl_enumMemberInitializer(receiver, last))];
      break;
    }
    const memberDecl = Find(p!.Declarations ?? [], IsEnumMember);
    let initializer: GoPtr<Node>;
    if (memberDecl !== undefined && AsEnumMember(memberDecl)!.Initializer !== undefined) {
      initializer = NodeFactory_DeepCloneNode(receiver!.f, AsEnumMember(memberDecl)!.Initializer);
    } else {
      initializer = NodeBuilderImpl_enumMemberInitializer(receiver, p);
    }
    receiver!.ctx!.approximateLength += 4 + p!.Name.length;
    if (initializer !== undefined) {
      receiver!.ctx!.approximateLength += 5;
    }
    members = [...members, NewEnumMember(receiver!.f, NewIdentifier(receiver!.f, p!.Name), initializer)];
  }
  const constModifier: ModifierFlags = isConstEnumSymbol(symbol_) ? ModifierFlagsConst : ModifierFlagsNone;
  let mods: GoPtr<ModifierList>;
  if (constModifier !== 0) {
    mods = NodeFactory_NewModifierList(receiver!.f, CreateModifiersFromModifierFlags(constModifier, (kind) => NodeFactory_NewModifier(receiver!.f, kind)));
  }
  return NewEnumDeclaration(receiver!.f, mods, NewIdentifier(receiver!.f, name), NodeFactory_NewNodeList(receiver!.f, members));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.enumMemberInitializer","kind":"method","status":"implemented","sigHash":"4eb053c656f3904a6ed52f79c3c8163337866536f2f571f34f59c20154f10e52","bodyHash":"e7bedf5de2b50f08880e2692fe23fa60432eb367275bc9d503cbfef067209d1f"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) enumMemberInitializer(p *ast.Symbol) *ast.Node {
 * 	memberDecl := core.Find(p.Declarations, ast.IsEnumMember)
 * 	if memberDecl == nil {
 * 		return nil
 * 	}
 * 	val := b.ch.GetConstantValue(memberDecl)
 * 	if val == nil {
 * 		return nil
 * 	}
 * 	switch v := val.(type) {
 * 	case string:
 * 		return b.f.NewStringLiteral(v, 0)
 * 	case jsnum.Number:
 * 		return b.f.NewNumericLiteral(v.String(), 0)
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_enumMemberInitializer(receiver: GoPtr<NodeBuilderImpl>, p: GoPtr<Symbol>): GoPtr<Node> {
  const memberDecl = Find(p!.Declarations ?? [], IsEnumMember);
  if (memberDecl === undefined) {
    return undefined;
  }
  const val = Checker_GetConstantValue(receiver!.ch, memberDecl);
  if (val === undefined || val === null) {
    return undefined;
  }
  if (typeof val === "string") {
    return NewStringLiteral(receiver!.f, val, 0 as TokenFlags);
  }
  if (typeof val === "number") {
    return NewNumericLiteral(receiver!.f, val.toString(), 0 as TokenFlags);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.expandClassDecl","kind":"method","status":"implemented","sigHash":"f46e75a17666f236749b92ad3d7a550e668363edc26fbc797e5ca21de3db823e","bodyHash":"dc3b12b893f7160dcfa5a0cce76a3dd559362b38f2c0625211b60e226b16d9f9"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) expandClassDecl(symbol *ast.Symbol) *ast.Node {
 * 	name := ast.SymbolName(symbol)
 * 	b.ctx.approximateLength += 9 + len(name)
 * 
 * 	classLikeDeclarations := core.Filter(symbol.Declarations, ast.IsClassLike)
 * 	originalDecl := core.FirstOrNil(classLikeDeclarations)
 * 	oldEnclosing := b.ctx.enclosingDeclaration
 * 	if originalDecl != nil {
 * 		b.ctx.enclosingDeclaration = originalDecl
 * 	}
 * 	defer func() { b.ctx.enclosingDeclaration = oldEnclosing }()
 * 
 * 	localParams := b.ch.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 	typeParamDecls := core.Map(localParams, func(p *Type) *ast.Node { return b.typeParameterToDeclaration(p) })
 * 
 * 	declaredType := b.ch.getDeclaredTypeOfClassOrInterface(symbol)
 * 	classType := b.ch.getTypeWithThisArgument(declaredType, nil, false)
 * 	baseTypes := b.ch.getBaseTypes(b.ch.getTargetType(classType))
 * 	staticType := b.ch.getTypeOfSymbol(symbol)
 * 	isClass := staticType.symbol != nil && staticType.symbol.ValueDeclaration != nil && ast.IsClassLike(staticType.symbol.ValueDeclaration)
 * 	var staticBaseType *Type
 * 	if isClass {
 * 		staticBaseType = b.ch.getBaseConstructorTypeOfClass(declaredType)
 * 	} else {
 * 		staticBaseType = b.ch.anyType
 * 	}
 * 
 * 	// Heritage clauses
 * 	heritageClauses := b.hoverHeritageClauses(classLikeDeclarations)
 * 
 * 	// Instance members via addPropertyToElementList (reusing existing serialization),
 * 	// then convert TypeElements to ClassElements and add class-specific modifiers
 * 	allProps := b.ch.getPropertiesOfType(classType)
 * 	symbolProps := b.filterInheritedProperties(classType, baseTypes, allProps)
 * 	publicProps := core.Filter(symbolProps, func(s *ast.Symbol) bool { return !isHashPrivate(s) })
 * 	hasPrivate := core.Some(symbolProps, isHashPrivate)
 * 
 * 	var instanceMembers []*ast.Node
 * 	instanceMembers = b.serializePropertiesWithTruncation(publicProps, instanceMembers)
 * 	instanceMembers = typeElementsToClassElements(b.f, instanceMembers)
 * 	instanceMembers = b.addClassModifiers(instanceMembers, false)
 * 
 * 	// Static members
 * 	staticProps := core.Filter(b.ch.getPropertiesOfType(staticType), func(p *ast.Symbol) bool {
 * 		return p.Flags&ast.SymbolFlagsPrototype == 0 && p.Name != "prototype" && !b.isNamespaceMember(p)
 * 	})
 * 	var staticMembers []*ast.Node
 * 	staticMembers = b.serializePropertiesWithTruncation(staticProps, staticMembers)
 * 	staticMembers = typeElementsToClassElements(b.f, staticMembers)
 * 	staticMembers = b.addClassModifiers(staticMembers, true)
 * 
 * 	// Hash-private members
 * 	var privateMembers []*ast.Node
 * 	if hasPrivate {
 * 		privateMembers = b.serializePropertiesWithTruncation(core.Filter(symbolProps, isHashPrivate), privateMembers)
 * 		privateMembers = typeElementsToClassElements(b.f, privateMembers)
 * 	}
 * 
 * 	// Constructors
 * 	constructors := b.serializeConstructors(staticType, staticBaseType, isClass, symbol)
 * 
 * 	// Index signatures
 * 	indexSigs := b.serializeIndexSignaturesOfType(classType, core.FirstOrNil(baseTypes))
 * 
 * 	allMembers := make([]*ast.Node, 0, len(indexSigs)+len(staticMembers)+len(constructors)+len(instanceMembers)+len(privateMembers))
 * 	allMembers = append(allMembers, indexSigs...)
 * 	allMembers = append(allMembers, staticMembers...)
 * 	allMembers = append(allMembers, constructors...)
 * 	allMembers = append(allMembers, instanceMembers...)
 * 	allMembers = append(allMembers, privateMembers...)
 * 
 * 	return b.f.NewClassDeclaration(nil, b.f.NewIdentifier(name), b.f.NewNodeList(typeParamDecls), b.f.NewNodeList(heritageClauses), b.f.NewNodeList(allMembers))
 * }
 */
export function NodeBuilderImpl_expandClassDecl(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const name = SymbolName(symbol_);
  receiver!.ctx!.approximateLength += 9 + name.length;
  const classLikeDeclarations = Filter(symbol_!.Declarations ?? [], IsClassLike);
  const originalDecl = FirstOrNil(classLikeDeclarations);
  const oldEnclosing = receiver!.ctx!.enclosingDeclaration;
  if (originalDecl !== undefined) {
    receiver!.ctx!.enclosingDeclaration = originalDecl;
  }
  const localParams = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver!.ch, symbol_);
  const typeParamDecls = Map(localParams, (p) => NodeBuilderImpl_typeParameterToDeclaration(receiver, p));
  const declaredType = Checker_getDeclaredTypeOfClassOrInterface(receiver!.ch, symbol_);
  const classType = Checker_getTypeWithThisArgument(receiver!.ch, declaredType, undefined, false as bool);
  const baseTypes = Checker_getBaseTypes(receiver!.ch, Checker_getTargetType(receiver!.ch, classType));
  const staticType = Checker_getTypeOfSymbol(receiver!.ch, symbol_);
  const isClass = (staticType!.symbol !== undefined && staticType!.symbol!.ValueDeclaration !== undefined && IsClassLike(staticType!.symbol!.ValueDeclaration)) as bool;
  let staticBaseType: GoPtr<Type>;
  if (isClass) {
    staticBaseType = Checker_getBaseConstructorTypeOfClass(receiver!.ch, declaredType);
  } else {
    staticBaseType = receiver!.ch!.anyType;
  }
  const heritageClauses = NodeBuilderImpl_hoverHeritageClauses(receiver, classLikeDeclarations);
  const allProps = Checker_getPropertiesOfType(receiver!.ch, classType);
  const symbolProps = NodeBuilderImpl_filterInheritedProperties(receiver, classType, baseTypes, allProps);
  const publicProps = Filter(symbolProps, (s) => !isHashPrivate(s));
  const hasPrivate = Some(symbolProps, isHashPrivate);
  let instanceMembers: GoSlice<GoPtr<Node>> = [];
  instanceMembers = NodeBuilderImpl_serializePropertiesWithTruncation(receiver, publicProps, instanceMembers);
  instanceMembers = typeElementsToClassElements(receiver!.f, instanceMembers);
  instanceMembers = NodeBuilderImpl_addClassModifiers(receiver, instanceMembers, false as bool);
  const staticProps = Filter(Checker_getPropertiesOfType(receiver!.ch, staticType), (p) => ((p!.Flags & SymbolFlagsPrototype) === 0 && p!.Name !== "prototype" && !NodeBuilderImpl_isNamespaceMember(receiver, p)) as bool);
  let staticMembers: GoSlice<GoPtr<Node>> = [];
  staticMembers = NodeBuilderImpl_serializePropertiesWithTruncation(receiver, staticProps, staticMembers);
  staticMembers = typeElementsToClassElements(receiver!.f, staticMembers);
  staticMembers = NodeBuilderImpl_addClassModifiers(receiver, staticMembers, true as bool);
  let privateMembers: GoSlice<GoPtr<Node>> = [];
  if (hasPrivate) {
    privateMembers = NodeBuilderImpl_serializePropertiesWithTruncation(receiver, Filter(symbolProps, isHashPrivate), privateMembers);
    privateMembers = typeElementsToClassElements(receiver!.f, privateMembers);
  }
  const constructors = NodeBuilderImpl_serializeConstructors(receiver, staticType, staticBaseType, isClass, symbol_);
  const indexSigs = NodeBuilderImpl_serializeIndexSignaturesOfType(receiver, classType, FirstOrNil(baseTypes));
  const allMembers = [...indexSigs, ...staticMembers, ...constructors, ...instanceMembers, ...privateMembers];
  receiver!.ctx!.enclosingDeclaration = oldEnclosing;
  return NewClassDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, name), NodeFactory_NewNodeList(receiver!.f, typeParamDecls), NodeFactory_NewNodeList(receiver!.f, heritageClauses), NodeFactory_NewNodeList(receiver!.f, allMembers));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.addClassModifiers","kind":"method","status":"implemented","sigHash":"14aeac5943e1e091755d8e76bd9060271bf557eb2cfedfb8379025ab1d9ba050","bodyHash":"255851f29e7f18150057e49c5b6c8efe35c734e2077fc8c7b929a0ae1cb97e67"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) addClassModifiers(members []*ast.Node, isStatic bool) []*ast.Node {
 * 	for i, m := range members {
 * 		// Find the symbol for this member by matching the property name
 * 		var memberSymbol *ast.Symbol
 * 		memberName := m.Name()
 * 		if memberName != nil {
 * 			if sym, ok := b.idToSymbol[memberName]; ok {
 * 				memberSymbol = sym
 * 			}
 * 		}
 * 		if memberSymbol == nil {
 * 			continue
 * 		}
 * 		modFlags := getDeclarationModifierFlagsFromSymbol(memberSymbol) &^ ast.ModifierFlagsAsync
 * 		if isStatic {
 * 			modFlags |= ast.ModifierFlagsStatic
 * 		}
 * 		if modFlags != 0 && ast.CanHaveModifiers(m) {
 * 			existing := m.ModifierFlags()
 * 			if modFlags != existing {
 * 				members[i] = ast.ReplaceModifiers(b.f, m, b.f.NewModifierList(ast.CreateModifiersFromModifierFlags(modFlags|existing, b.f.NewModifier)))
 * 			}
 * 		}
 * 	}
 * 	return members
 * }
 */
export function NodeBuilderImpl_addClassModifiers(receiver: GoPtr<NodeBuilderImpl>, members: GoSlice<GoPtr<Node>>, isStatic: bool): GoSlice<GoPtr<Node>> {
  const result = [...members];
  for (let i = 0; i < result.length; i++) {
    const m = result[i];
    let memberSymbol: GoPtr<Symbol>;
    const memberName = Node_Name(m);
    if (memberName !== undefined) {
      const sym = receiver!.idToSymbol!.get(memberName as unknown as IdentifierNode);
      if (sym !== undefined) {
        memberSymbol = sym;
      }
    }
    if (memberSymbol === undefined) {
      continue;
    }
    let modFlags = getDeclarationModifierFlagsFromSymbol(memberSymbol) & ~ModifierFlagsAsync;
    if (isStatic) {
      modFlags |= ModifierFlagsStatic;
    }
    if (modFlags !== 0 && CanHaveModifiers(m)) {
      const existing = Node_ModifierFlags(m);
      if (modFlags !== existing) {
        result[i] = ReplaceModifiers(receiver!.f, m, NodeFactory_NewModifierList(receiver!.f, CreateModifiersFromModifierFlags(modFlags | existing, (kind) => NodeFactory_NewModifier(receiver!.f, kind))));
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::func::typeElementsToClassElements","kind":"func","status":"implemented","sigHash":"fec6888a4ffce61b40f0c04eecb5093f4b755be9351a399caadac33bc59a9172","bodyHash":"4c77267f193e376662e544769086a5e8d7d9a44d05a9ed2c0e966fc54a62ef52"}
 *
 * Go source:
 * func typeElementsToClassElements(f *ast.NodeFactory, members []*ast.Node) []*ast.Node {
 * 	for i, m := range members {
 * 		switch m.Kind {
 * 		case ast.KindPropertySignature:
 * 			ps := m.AsPropertySignatureDeclaration()
 * 			members[i] = f.NewPropertyDeclaration(m.Modifiers(), ps.Name(), ps.QuestionToken(), ps.Type, nil)
 * 		case ast.KindMethodSignature:
 * 			ms := m.AsMethodSignatureDeclaration()
 * 			members[i] = f.NewMethodDeclaration(m.Modifiers(), nil, ms.Name(), ms.QuestionToken(), ms.TypeParameters, ms.Parameters, ms.Type, nil, nil)
 * 		}
 * 	}
 * 	return members
 * }
 */
export function typeElementsToClassElements(f: GoPtr<NodeFactory>, members: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  return members.map((m) => {
    switch (m!.Kind) {
      case KindPropertySignature: {
        const ps = AsPropertySignatureDeclaration(m)!;
        return NewPropertyDeclaration(f, Node_Modifiers(m), ps.name, ps.PostfixToken, ps.Type, undefined);
      }
      case KindMethodSignature: {
        const ms = AsMethodSignatureDeclaration(m)!;
        return NewMethodDeclaration(f, Node_Modifiers(m), undefined, ms.name, ms.PostfixToken, ms.TypeParameters, ms.Parameters, ms.Type, undefined, undefined);
      }
      default:
        return m;
    }
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.expandInterfaceDecl","kind":"method","status":"implemented","sigHash":"cc36bbe446143225281039c9b6b8a90af895d8f2ff4108007036c303c8bf7e22","bodyHash":"6c400751abb9dd6dd2a007820d1d6a33d88cc0c1dfc826d668e31c47b8c5f1aa"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) expandInterfaceDecl(symbol *ast.Symbol) *ast.Node {
 * 	name := ast.SymbolName(symbol)
 * 	b.ctx.approximateLength += 14 + len(name)
 * 
 * 	interfaceType := b.ch.getDeclaredTypeOfClassOrInterface(symbol)
 * 	interfaceDeclarations := core.Filter(symbol.Declarations, ast.IsInterfaceDeclaration)
 * 	localParams := b.ch.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 	typeParamDecls := core.Map(localParams, func(p *Type) *ast.Node { return b.typeParameterToDeclaration(p) })
 * 	baseTypes := b.ch.getBaseTypes(interfaceType)
 * 	var baseType *Type
 * 	if len(baseTypes) > 0 {
 * 		baseType = b.ch.getIntersectionType(baseTypes)
 * 	}
 * 
 * 	// Members: reuse existing serialization functions
 * 	resolved := b.ch.resolveStructuredTypeMembers(interfaceType)
 * 	var members []*ast.Node
 * 
 * 	// Index signatures, filtering those identical to base
 * 	members = append(members, b.serializeIndexSignaturesOfType(interfaceType, baseType)...)
 * 	// Construct signatures (skip abstract)
 * 	for _, sig := range resolved.ConstructSignatures() {
 * 		if sig.flags&SignatureFlagsAbstract != 0 {
 * 			continue
 * 		}
 * 		members = append(members, b.signatureToSignatureDeclarationHelper(sig, ast.KindConstructSignature, nil))
 * 	}
 * 	// Call signatures
 * 	for _, sig := range resolved.CallSignatures() {
 * 		members = append(members, b.signatureToSignatureDeclarationHelper(sig, ast.KindCallSignature, nil))
 * 	}
 * 	// Properties, filtering inherited
 * 	filteredProps := b.filterInheritedProperties(interfaceType, baseTypes, resolved.properties)
 * 	members = b.serializePropertiesWithTruncation(filteredProps, members)
 * 
 * 	// Heritage clauses
 * 	heritageClauses := b.hoverHeritageClauses(interfaceDeclarations)
 * 
 * 	return b.f.NewInterfaceDeclaration(nil, b.f.NewIdentifier(name), b.f.NewNodeList(typeParamDecls), b.f.NewNodeList(heritageClauses), b.f.NewNodeList(members))
 * }
 */
export function NodeBuilderImpl_expandInterfaceDecl(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const name = SymbolName(symbol_);
  receiver!.ctx!.approximateLength += 14 + name.length;
  const interfaceType = Checker_getDeclaredTypeOfClassOrInterface(receiver!.ch, symbol_);
  const interfaceDeclarations = Filter(symbol_!.Declarations ?? [], IsInterfaceDeclaration);
  const localParams = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver!.ch, symbol_);
  const typeParamDecls = Map(localParams, (p) => NodeBuilderImpl_typeParameterToDeclaration(receiver, p));
  const baseTypes = Checker_getBaseTypes(receiver!.ch, interfaceType);
  let baseType: GoPtr<Type>;
  if (baseTypes.length > 0) {
    baseType = Checker_getIntersectionType(receiver!.ch, baseTypes);
  }
  const resolved = Checker_resolveStructuredTypeMembers(receiver!.ch, interfaceType);
  let members: GoSlice<GoPtr<Node>> = [];
  members = [...members, ...NodeBuilderImpl_serializeIndexSignaturesOfType(receiver, interfaceType, baseType)];
  for (const sig of StructuredType_ConstructSignatures(resolved)) {
    if ((sig!.flags & SignatureFlagsAbstract) !== 0) {
      continue;
    }
    members = [...members, NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, sig, KindConstructSignature, undefined)];
  }
  for (const sig of StructuredType_CallSignatures(resolved)) {
    members = [...members, NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, sig, KindCallSignature, undefined)];
  }
  const filteredProps = NodeBuilderImpl_filterInheritedProperties(receiver, interfaceType, baseTypes, StructuredType_Properties(resolved));
  members = NodeBuilderImpl_serializePropertiesWithTruncation(receiver, filteredProps, members);
  const heritageClauses = NodeBuilderImpl_hoverHeritageClauses(receiver, interfaceDeclarations);
  return NewInterfaceDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, name), NodeFactory_NewNodeList(receiver!.f, typeParamDecls), NodeFactory_NewNodeList(receiver!.f, heritageClauses), NodeFactory_NewNodeList(receiver!.f, members));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.hoverHeritageClauses","kind":"method","status":"implemented","sigHash":"8f17f209a2d455b93eb361b8057b014b4a7401cc480c22b432f587bd518b99a5","bodyHash":"14b73d23eeead1b367aa376481ac8d4916cb7ed7de4905cb7f9603fbe2c2b13a"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) hoverHeritageClauses(declarations []*ast.Node) []*ast.Node {
 * 	var extendsTypes []*ast.Node
 * 	var implementsTypes []*ast.Node
 * 	for _, declaration := range declarations {
 * 		for _, heritageElement := range ast.GetExtendsHeritageClauseElements(declaration) {
 * 			extendsTypes = append(extendsTypes, b.f.DeepCloneNode(heritageElement.AsNode()))
 * 		}
 * 		for _, heritageElement := range ast.GetImplementsHeritageClauseElements(declaration) {
 * 			implementsTypes = append(implementsTypes, b.f.DeepCloneNode(heritageElement.AsNode()))
 * 		}
 * 	}
 * 
 * 	var heritageClauses []*ast.Node
 * 	if len(extendsTypes) > 0 {
 * 		heritageClauses = append(heritageClauses, b.f.NewHeritageClause(ast.KindExtendsKeyword, b.f.NewNodeList(extendsTypes)))
 * 	}
 * 	if len(implementsTypes) > 0 {
 * 		heritageClauses = append(heritageClauses, b.f.NewHeritageClause(ast.KindImplementsKeyword, b.f.NewNodeList(implementsTypes)))
 * 	}
 * 	return heritageClauses
 * }
 */
export function NodeBuilderImpl_hoverHeritageClauses(receiver: GoPtr<NodeBuilderImpl>, declarations: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  let extendsTypes: GoSlice<GoPtr<Node>> = [];
  let implementsTypes: GoSlice<GoPtr<Node>> = [];
  for (const declaration of declarations) {
    for (const heritageElement of GetExtendsHeritageClauseElements(declaration)) {
      extendsTypes = [...extendsTypes, NodeFactory_DeepCloneNode(receiver!.f, heritageElement)];
    }
    for (const heritageElement of GetImplementsHeritageClauseElements(declaration)) {
      implementsTypes = [...implementsTypes, NodeFactory_DeepCloneNode(receiver!.f, heritageElement)];
    }
  }
  let heritageClauses: GoSlice<GoPtr<Node>> = [];
  if (extendsTypes.length > 0) {
    heritageClauses = [...heritageClauses, NewHeritageClause(receiver!.f, KindExtendsKeyword, NodeFactory_NewNodeList(receiver!.f, extendsTypes))];
  }
  if (implementsTypes.length > 0) {
    heritageClauses = [...heritageClauses, NewHeritageClause(receiver!.f, KindImplementsKeyword, NodeFactory_NewNodeList(receiver!.f, implementsTypes))];
  }
  return heritageClauses;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.serializePropertiesWithTruncation","kind":"method","status":"implemented","sigHash":"24195f02a4a59b642d0556cfb545f029f0d8443fbe6a4e9045d9fba0f4248d5d","bodyHash":"489aa119aa2a86e5cc0201f534db8b06a6d1d60b3a087ce408f2b4d262fd83a6"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializePropertiesWithTruncation(properties []*ast.Symbol, elements []*ast.Node) []*ast.Node {
 * 	properties = core.Filter(properties, func(p *ast.Symbol) bool {
 * 		return p.Flags&ast.SymbolFlagsPrototype == 0
 * 	})
 * 	for i, p := range properties {
 * 		if b.checkTruncationLengthIfExpanding() && (i+3 < len(properties)-1) {
 * 			b.ctx.expansionTruncated = true
 * 			text := fmt.Sprintf("... %d more ...", len(properties)-i-1)
 * 			elements = append(elements, b.f.NewPropertySignatureDeclaration(nil, b.f.NewIdentifier(text), nil, nil, nil))
 * 			elements = b.addPropertyToElementList(properties[len(properties)-1], elements)
 * 			break
 * 		}
 * 		elements = b.addPropertyToElementList(p, elements)
 * 	}
 * 	return elements
 * }
 */
export function NodeBuilderImpl_serializePropertiesWithTruncation(receiver: GoPtr<NodeBuilderImpl>, properties: GoSlice<GoPtr<Symbol>>, elements: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  const filtered = Filter(properties, (p) => ((p!.Flags & SymbolFlagsPrototype) === 0) as bool);
  let result = [...elements];
  for (let i = 0; i < filtered.length; i++) {
    const p = filtered[i];
    if (NodeBuilderImpl_checkTruncationLengthIfExpanding(receiver) && (i + 3 < filtered.length - 1)) {
      receiver!.ctx!.expansionTruncated = true as bool;
      const text = `... ${filtered.length - i - 1} more ...`;
      result = [...result, NewPropertySignatureDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, text), undefined, undefined, undefined)];
      result = NodeBuilderImpl_addPropertyToElementList(receiver, filtered[filtered.length - 1], result as GoSlice<GoPtr<TypeElement>>) as GoSlice<GoPtr<Node>>;
      break;
    }
    result = NodeBuilderImpl_addPropertyToElementList(receiver, p, result as GoSlice<GoPtr<TypeElement>>) as GoSlice<GoPtr<Node>>;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.serializeConstructors","kind":"method","status":"implemented","sigHash":"329d188a6482d92263fb23ab57ab2103605fc16b9d1a8630d8d006a6421dc3c4","bodyHash":"5a6583cf5bdc9f8eceb30845df94b9d1bd7733b5eeb5a01bfe155680e4671fe8"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeConstructors(staticType *Type, staticBaseType *Type, isClass bool, symbol *ast.Symbol) []*ast.Node {
 * 	isNonConstructable := !isClass &&
 * 		symbol.ValueDeclaration != nil &&
 * 		ast.IsInJSFile(symbol.ValueDeclaration) &&
 * 		len(b.ch.getSignaturesOfType(staticType, SignatureKindConstruct)) == 0
 * 	if isNonConstructable {
 * 		b.ctx.approximateLength += 21
 * 		modifiers := ast.CreateModifiersFromModifierFlags(ast.ModifierFlagsPrivate, b.f.NewModifier)
 * 		return []*ast.Node{b.f.NewConstructorDeclaration(b.f.NewModifierList(modifiers), nil, b.f.NewNodeList(nil), nil, nil, nil)}
 * 	}
 * 	signatures := b.ch.getSignaturesOfType(staticType, SignatureKindConstruct)
 * 	if staticBaseType != nil {
 * 		baseSigs := b.ch.getSignaturesOfType(staticBaseType, SignatureKindConstruct)
 * 		if len(baseSigs) == 0 && core.Every(signatures, func(sig *Signature) bool { return len(sig.parameters) == 0 }) {
 * 			return nil
 * 		}
 * 		if len(baseSigs) == len(signatures) {
 * 			allMatch := true
 * 			for i := range baseSigs {
 * 				if b.ch.compareSignaturesIdentical(signatures[i], baseSigs[i], false, false, true, b.ch.compareTypesIdentical) != TernaryTrue {
 * 					allMatch = false
 * 					break
 * 				}
 * 			}
 * 			if allMatch {
 * 				return nil
 * 			}
 * 		}
 * 		var privateProtected ast.ModifierFlags
 * 		for _, sig := range signatures {
 * 			if sig.declaration != nil {
 * 				privateProtected |= sig.declaration.ModifierFlags() & (ast.ModifierFlagsPrivate | ast.ModifierFlagsProtected)
 * 			}
 * 		}
 * 		if privateProtected != 0 {
 * 			return []*ast.Node{b.f.NewConstructorDeclaration(
 * 				b.f.NewModifierList(ast.CreateModifiersFromModifierFlags(privateProtected, b.f.NewModifier)),
 * 				nil, b.f.NewNodeList(nil), nil, nil, nil,
 * 			)}
 * 		}
 * 	} else if core.Every(signatures, func(sig *Signature) bool { return len(sig.parameters) == 0 }) {
 * 		return nil
 * 	}
 * 	var result []*ast.Node
 * 	for _, sig := range signatures {
 * 		b.ctx.approximateLength++
 * 		result = append(result, b.signatureToSignatureDeclarationHelper(sig, ast.KindConstructor, nil))
 * 	}
 * 	return result
 * }
 */
export function NodeBuilderImpl_serializeConstructors(receiver: GoPtr<NodeBuilderImpl>, staticType: GoPtr<Type>, staticBaseType: GoPtr<Type>, isClass: bool, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>> {
  const isNonConstructable = (!isClass &&
    symbol_!.ValueDeclaration !== undefined &&
    IsInJSFile(symbol_!.ValueDeclaration) &&
    Checker_getSignaturesOfType(receiver!.ch, staticType, SignatureKindConstruct).length === 0) as bool;
  if (isNonConstructable) {
    receiver!.ctx!.approximateLength += 21;
    const modifiers = CreateModifiersFromModifierFlags(ModifierFlagsPrivate, (kind) => NodeFactory_NewModifier(receiver!.f, kind));
    return [NewConstructorDeclaration(receiver!.f, NodeFactory_NewModifierList(receiver!.f, modifiers), undefined, NodeFactory_NewNodeList(receiver!.f, []), undefined, undefined, undefined)];
  }
  const signatures = Checker_getSignaturesOfType(receiver!.ch, staticType, SignatureKindConstruct);
  if (staticBaseType !== undefined) {
    const baseSigs = Checker_getSignaturesOfType(receiver!.ch, staticBaseType, SignatureKindConstruct);
    if (baseSigs.length === 0 && Every(signatures, (sig) => (sig!.parameters.length === 0) as bool)) {
      return [];
    }
    if (baseSigs.length === signatures.length) {
      let allMatch = true;
      for (let i = 0; i < baseSigs.length; i++) {
        if (Checker_compareSignaturesIdentical(receiver!.ch, signatures[i], baseSigs[i], false as bool, false as bool, true as bool, (s, t) => Checker_compareTypesIdentical(receiver!.ch, s, t)) !== TernaryTrue) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        return [];
      }
    }
    let privateProtected: ModifierFlags = 0;
    for (const sig of signatures) {
      if (sig!.declaration !== undefined) {
        privateProtected |= Node_ModifierFlags(sig!.declaration) & (ModifierFlagsPrivate | ModifierFlagsProtected);
      }
    }
    if (privateProtected !== 0) {
      return [NewConstructorDeclaration(receiver!.f, NodeFactory_NewModifierList(receiver!.f, CreateModifiersFromModifierFlags(privateProtected, (kind) => NodeFactory_NewModifier(receiver!.f, kind))), undefined, NodeFactory_NewNodeList(receiver!.f, []), undefined, undefined, undefined)];
    }
  } else if (Every(signatures, (sig) => (sig!.parameters.length === 0) as bool)) {
    return [];
  }
  let result: GoSlice<GoPtr<Node>> = [];
  for (const sig of signatures) {
    receiver!.ctx!.approximateLength++;
    result = [...result, NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, sig, KindConstructor, undefined)];
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.serializeIndexSignaturesOfType","kind":"method","status":"implemented","sigHash":"4012a72542ff5dc640b4d5dea6020341118b65fafc79767e3a62060ba808cc67","bodyHash":"c9428d6736171798313a646334f0e9fc5564b5a9bd5ea4e053eed9aff9e2e4c1"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeIndexSignaturesOfType(input *Type, baseType *Type) []*ast.Node {
 * 	var result []*ast.Node
 * 	for _, info := range b.ch.getIndexInfosOfType(input) {
 * 		if baseType != nil {
 * 			baseInfo := b.ch.getIndexInfoOfType(baseType, info.keyType)
 * 			if baseInfo != nil && b.ch.isTypeIdenticalTo(info.valueType, baseInfo.valueType) {
 * 				continue
 * 			}
 * 		}
 * 		result = append(result, b.indexInfoToIndexSignatureDeclarationHelper(info, nil))
 * 	}
 * 	return result
 * }
 */
export function NodeBuilderImpl_serializeIndexSignaturesOfType(receiver: GoPtr<NodeBuilderImpl>, input: GoPtr<Type>, baseType: GoPtr<Type>): GoSlice<GoPtr<Node>> {
  let result: GoSlice<GoPtr<Node>> = [];
  for (const info of Checker_getIndexInfosOfType(receiver!.ch, input)) {
    if (baseType !== undefined) {
      const baseInfo = Checker_getIndexInfoOfType(receiver!.ch, baseType, info!.keyType);
      if (baseInfo !== undefined && Checker_isTypeIdenticalTo(receiver!.ch, info!.valueType, baseInfo!.valueType)) {
        continue;
      }
    }
    result = [...result, NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper(receiver, info, undefined)];
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.serializeNamespaceMember","kind":"method","status":"implemented","sigHash":"9b84cbb43a32fad43a71bf5b7715dcfa221bc14be8af0f30712a526b5589d660","bodyHash":"34f27b5f416d88863b98f43c1b1fbb79261e898b60956ca490b1502b89dead63"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeNamespaceMember(resolved *ast.Symbol, name string) *ast.Node {
 * 	switch {
 * 	case resolved.Flags&ast.SymbolFlagsTypeAlias != 0:
 * 		return b.serializeTypeAliasForNamespace(resolved, name)
 * 	case resolved.Flags&ast.SymbolFlagsEnum != 0:
 * 		return b.expandEnumDecl(resolved)
 * 	case resolved.Flags&ast.SymbolFlagsClass != 0:
 * 		return b.expandClassDecl(resolved)
 * 	case resolved.Flags&ast.SymbolFlagsInterface != 0:
 * 		return b.expandInterfaceDecl(resolved)
 * 	case resolved.Flags&(ast.SymbolFlagsValueModule|ast.SymbolFlagsNamespaceModule) != 0:
 * 		return b.expandModuleDecl(resolved)
 * 	default:
 * 		t := b.ch.getWidenedType(b.ch.getTypeOfSymbol(resolved))
 * 		b.ctx.approximateLength += len(name) + 5
 * 		return b.f.NewVariableStatement(
 * 			nil,
 * 			b.f.NewVariableDeclarationList(
 * 				b.f.NewNodeList([]*ast.Node{
 * 					b.f.NewVariableDeclaration(b.f.NewIdentifier(name), nil, b.serializeTypeForDeclaration(nil, t, resolved, true), nil),
 * 				}),
 * 				ast.NodeFlagsLet,
 * 			),
 * 		)
 * 	}
 * }
 */
export function NodeBuilderImpl_serializeNamespaceMember(receiver: GoPtr<NodeBuilderImpl>, resolved: GoPtr<Symbol>, name: string): GoPtr<Node> {
  if ((resolved!.Flags & SymbolFlagsTypeAlias) !== 0) {
    return NodeBuilderImpl_serializeTypeAliasForNamespace(receiver, resolved, name);
  } else if ((resolved!.Flags & SymbolFlagsEnum) !== 0) {
    return NodeBuilderImpl_expandEnumDecl(receiver, resolved);
  } else if ((resolved!.Flags & SymbolFlagsClass) !== 0) {
    return NodeBuilderImpl_expandClassDecl(receiver, resolved);
  } else if ((resolved!.Flags & SymbolFlagsInterface) !== 0) {
    return NodeBuilderImpl_expandInterfaceDecl(receiver, resolved);
  } else if ((resolved!.Flags & (SymbolFlagsValueModule | SymbolFlagsNamespaceModule)) !== 0) {
    return NodeBuilderImpl_expandModuleDecl(receiver, resolved);
  } else {
    const t = Checker_getWidenedType(receiver!.ch, Checker_getTypeOfSymbol(receiver!.ch, resolved));
    receiver!.ctx!.approximateLength += name.length + 5;
    return NewVariableStatement(
      receiver!.f,
      undefined,
      NewVariableDeclarationList(
        receiver!.f,
        NodeFactory_NewNodeList(receiver!.f, [
          NewVariableDeclaration(receiver!.f, NewIdentifier(receiver!.f, name), undefined, NodeBuilderImpl_serializeTypeForDeclaration(receiver, undefined, t, resolved, true as bool), undefined),
        ]),
        NodeFlagsLet,
      ),
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.expandModuleDecl","kind":"method","status":"implemented","sigHash":"78cbacc01ccb9d31f4c80c54a65d8178b34236982c5e98f2cecc4738dc2785fa","bodyHash":"47c0531ae4711f0175bde72cf5d054f9a02dccf35e074a7200d9b812032bfe54"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) expandModuleDecl(symbol *ast.Symbol) *ast.Node {
 * 	exports := b.ch.getExportsOfSymbol(symbol)
 * 	var members []*ast.Symbol
 * 	for _, sym := range exports {
 * 		// Filter to namespace-relevant members
 * 		if !b.isNamespaceMember(sym) {
 * 			continue
 * 		}
 * 		if !scanner.IsIdentifierText(sym.Name, core.LanguageVariantStandard) {
 * 			continue
 * 		}
 * 		members = append(members, sym)
 * 	}
 * 	b.ch.sortSymbols(members)
 * 	b.ctx.approximateLength += 14
 * 
 * 	// Use the same name as symbol display.
 * 	oldFlags := b.ctx.flags
 * 	defer func() { b.ctx.flags = oldFlags }()
 * 	b.ctx.flags |= nodebuilder.FlagsWriteTypeParametersInQualifiedName | nodebuilder.Flags(SymbolFormatFlagsUseOnlyExternalAliasing)
 * 	localName := b.symbolToNode(symbol, ast.SymbolFlagsAll)
 * 	b.ctx.flags = oldFlags
 * 
 * 	type hoverStatement struct {
 * 		node    *ast.Node
 * 		isLocal bool // local declarations (e.g. alias targets) should not get export modifier
 * 	}
 * 	var bodyStmts []hoverStatement
 * 	var emittedLocals collections.Set[*ast.Symbol]
 * 	for i := 0; i < len(members); i++ {
 * 		m := members[i]
 * 		if b.checkTruncationLengthIfExpanding() && i+3 < len(members)-1 {
 * 			b.ctx.expansionTruncated = true
 * 			bodyStmts = append(bodyStmts, hoverStatement{node: b.f.NewExpressionStatement(b.f.NewIdentifier(fmt.Sprintf("... (%d more) ...", len(members)-i-1)))})
 * 			i = len(members) - 2 // skip to last member after i++ at end of iteration
 * 			continue
 * 		}
 * 
 * 		// Handle alias/re-export symbols
 * 		if m.Flags&ast.SymbolFlagsAlias != 0 {
 * 			aliasDecl := b.ch.getDeclarationOfAliasSymbol(m)
 * 			target := b.ch.getMergedSymbol(b.ch.getTargetOfAliasDeclaration(aliasDecl))
 * 			if target != nil {
 * 				// If the alias target is a local symbol (not itself an export), emit its declaration first
 * 				if target.Flags&(ast.SymbolFlagsBlockScopedVariable|ast.SymbolFlagsFunctionScopedVariable|ast.SymbolFlagsProperty) != 0 {
 * 					if emittedLocals.AddIfAbsent(target) {
 * 						localType := b.ch.getWidenedType(b.ch.getTypeOfSymbol(target))
 * 						b.ctx.approximateLength += len(target.Name) + 5
 * 						localStmt := b.f.NewVariableStatement(nil,
 * 							b.f.NewVariableDeclarationList(b.f.NewNodeList([]*ast.Node{
 * 								b.f.NewVariableDeclaration(b.f.NewIdentifier(target.Name), nil, b.serializeTypeForDeclaration(nil, localType, target, true), nil),
 * 							}), ast.NodeFlagsLet))
 * 						bodyStmts = append(bodyStmts, hoverStatement{node: localStmt, isLocal: true})
 * 					}
 * 				}
 * 				targetName := target.Name
 * 				b.ctx.approximateLength += 16 + len(m.Name)
 * 				var propertyName *ast.Node
 * 				if m.Name != targetName {
 * 					propertyName = b.f.NewIdentifier(targetName)
 * 				}
 * 				stmt := b.f.NewExportDeclaration(
 * 					nil, false,
 * 					b.f.NewNamedExports(b.f.NewNodeList([]*ast.Node{
 * 						b.f.NewExportSpecifier(false, propertyName, b.f.NewIdentifier(m.Name)),
 * 					})),
 * 					nil, nil,
 * 				)
 * 				bodyStmts = append(bodyStmts, hoverStatement{node: stmt})
 * 				continue
 * 			}
 * 		}
 * 
 * 		resolved := b.ch.resolveSymbol(m)
 * 
 * 		// Handle functions as function declarations
 * 		if resolved.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod) != 0 {
 * 			t := b.ch.getTypeOfSymbol(resolved)
 * 			sigs := b.ch.getSignaturesOfType(t, SignatureKindCall)
 * 			for _, sig := range sigs {
 * 				b.ctx.approximateLength++
 * 				decl := b.signatureToSignatureDeclarationHelper(sig, ast.KindFunctionDeclaration, &SignatureToSignatureDeclarationOptions{
 * 					name: b.f.NewIdentifier(m.Name),
 * 				})
 * 				bodyStmts = append(bodyStmts, hoverStatement{node: decl})
 * 			}
 * 			// If the function also has namespace characteristics, emit an empty namespace.
 * 			merged := b.ch.getMergedSymbol(resolved)
 * 			hasModuleExports := merged.Flags&(ast.SymbolFlagsValueModule|ast.SymbolFlagsNamespaceModule) != 0 && merged.Exports != nil && len(merged.Exports) != 0
 * 			if !hasModuleExports {
 * 				bodyStmts = append(bodyStmts, hoverStatement{node: b.f.NewModuleDeclaration(nil, ast.KindNamespaceKeyword, b.f.NewIdentifier(m.Name), b.f.NewModuleBlock(b.f.NewNodeList(nil)))})
 * 			}
 * 			continue
 * 		}
 * 
 * 		// Handle remaining member kinds (type alias, enum, class, interface, namespace, variable)
 * 		if node := b.serializeNamespaceMember(resolved, m.Name); node != nil {
 * 			bodyStmts = append(bodyStmts, hoverStatement{node: node})
 * 		}
 * 	}
 * 
 * 	// Add export modifier to exported statements (skip local declarations and ExportDeclarations).
 * 	for i := range bodyStmts {
 * 		s := &bodyStmts[i]
 * 		if s.isLocal || ast.IsExportDeclaration(s.node) {
 * 			continue
 * 		}
 * 		if ast.CanHaveModifiers(s.node) {
 * 			mf := s.node.ModifierFlags() | ast.ModifierFlagsExport
 * 			s.node = ast.ReplaceModifiers(b.f, s.node, b.f.NewModifierList(ast.CreateModifiersFromModifierFlags(mf, b.f.NewModifier)))
 * 		}
 * 	}
 * 
 * 	// Collect nodes, stripping export if all statements are exported.
 * 	bodyStatements := make([]*ast.Node, len(bodyStmts))
 * 	for i := range bodyStmts {
 * 		bodyStatements[i] = bodyStmts[i].node
 * 	}
 * 	allExported := len(bodyStatements) > 0 && core.Every(bodyStatements, func(d *ast.Node) bool {
 * 		return ast.HasSyntacticModifier(d, ast.ModifierFlagsExport)
 * 	})
 * 	if allExported {
 * 		for i, stmt := range bodyStatements {
 * 			if ast.CanHaveModifiers(stmt) {
 * 				mf := stmt.ModifierFlags() &^ ast.ModifierFlagsExport
 * 				bodyStatements[i] = ast.ReplaceModifiers(b.f, stmt, b.f.NewModifierList(ast.CreateModifiersFromModifierFlags(mf, b.f.NewModifier)))
 * 			}
 * 		}
 * 	}
 * 
 * 	keyword := ast.KindNamespaceKeyword
 * 	if !ast.IsIdentifier(localName) {
 * 		keyword = ast.KindModuleKeyword
 * 	}
 * 	return b.f.NewModuleDeclaration(nil, keyword, localName, b.f.NewModuleBlock(b.f.NewNodeList(bodyStatements)))
 * }
 */
export function NodeBuilderImpl_expandModuleDecl(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const exports = Checker_getExportsOfSymbol(receiver!.ch, symbol_);
  let members: GoSlice<GoPtr<Symbol>> = [];
  for (const [, sym] of exports) {
    if (!NodeBuilderImpl_isNamespaceMember(receiver, sym)) {
      continue;
    }
    if (!IsIdentifierText(sym!.Name, LanguageVariantStandard)) {
      continue;
    }
    members = [...members, sym];
  }
  Checker_sortSymbols(receiver!.ch, members);
  receiver!.ctx!.approximateLength += 14;
  const oldFlags = receiver!.ctx!.flags;
  receiver!.ctx!.flags = (receiver!.ctx!.flags | FlagsWriteTypeParametersInQualifiedName | SymbolFormatFlagsUseOnlyExternalAliasing) as Flags;
  const localName = NodeBuilderImpl_symbolToNode(receiver, symbol_, SymbolFlagsAll);
  receiver!.ctx!.flags = oldFlags;

  interface HoverStatement {
    node: GoPtr<Node>;
    isLocal: bool;
  }
  let bodyStmts: GoSlice<HoverStatement> = [];
  const emittedLocals: GoPtr<Set<GoPtr<Symbol>>> = NewSetWithSizeHint<GoPtr<Symbol>>(0);
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (NodeBuilderImpl_checkTruncationLengthIfExpanding(receiver) && i + 3 < members.length - 1) {
      receiver!.ctx!.expansionTruncated = true as bool;
      bodyStmts = [...bodyStmts, { node: NewExpressionStatement(receiver!.f, NewIdentifier(receiver!.f, `... (${members.length - i - 1} more) ...`)), isLocal: false as bool }];
      i = members.length - 2;
      continue;
    }
    if ((m!.Flags & SymbolFlagsAlias) !== 0) {
      const aliasDecl = Checker_getDeclarationOfAliasSymbol(receiver!.ch, m);
      const target = Checker_getMergedSymbol(receiver!.ch, Checker_getTargetOfAliasDeclaration(receiver!.ch, aliasDecl));
      if (target !== undefined) {
        if ((target!.Flags & (SymbolFlagsBlockScopedVariable | SymbolFlagsFunctionScopedVariable | SymbolFlagsProperty)) !== 0) {
          if (Set_AddIfAbsent(emittedLocals, target)) {
            const localType = Checker_getWidenedType(receiver!.ch, Checker_getTypeOfSymbol(receiver!.ch, target));
            receiver!.ctx!.approximateLength += target!.Name.length + 5;
            const localStmt = NewVariableStatement(
              receiver!.f,
              undefined,
              NewVariableDeclarationList(
                receiver!.f,
                NodeFactory_NewNodeList(receiver!.f, [
                  NewVariableDeclaration(receiver!.f, NewIdentifier(receiver!.f, target!.Name), undefined, NodeBuilderImpl_serializeTypeForDeclaration(receiver, undefined, localType, target, true as bool), undefined),
                ]),
                NodeFlagsLet,
              ),
            );
            bodyStmts = [...bodyStmts, { node: localStmt, isLocal: true as bool }];
          }
        }
        const targetName = target!.Name;
        receiver!.ctx!.approximateLength += 16 + m!.Name.length;
        let propertyName: GoPtr<Node>;
        if (m!.Name !== targetName) {
          propertyName = NewIdentifier(receiver!.f, targetName);
        }
        const stmt = NewExportDeclaration(
          receiver!.f,
          undefined,
          false as bool,
          NewNamedExports(receiver!.f, NodeFactory_NewNodeList(receiver!.f, [
            NewExportSpecifier(receiver!.f, false as bool, propertyName, NewIdentifier(receiver!.f, m!.Name)),
          ])),
          undefined,
          undefined,
        );
        bodyStmts = [...bodyStmts, { node: stmt, isLocal: false as bool }];
        continue;
      }
    }
    const resolved = Checker_resolveSymbol(receiver!.ch, m);
    if ((resolved!.Flags & (SymbolFlagsFunction | SymbolFlagsMethod)) !== 0) {
      const t = Checker_getTypeOfSymbol(receiver!.ch, resolved);
      const sigs = Checker_getSignaturesOfType(receiver!.ch, t, SignatureKindCall);
      for (const sig of sigs) {
        receiver!.ctx!.approximateLength++;
        const decl = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, sig, KindFunctionDeclaration, { modifiers: [], name: NewIdentifier(receiver!.f, m!.Name), questionToken: undefined });
        bodyStmts = [...bodyStmts, { node: decl, isLocal: false as bool }];
      }
      const merged = Checker_getMergedSymbol(receiver!.ch, resolved);
      const hasModuleExports = (merged!.Flags & (SymbolFlagsValueModule | SymbolFlagsNamespaceModule)) !== 0 && merged!.Exports !== undefined && merged!.Exports.size !== 0;
      if (!hasModuleExports) {
        bodyStmts = [...bodyStmts, { node: NewModuleDeclaration(receiver!.f, undefined, KindNamespaceKeyword, NewIdentifier(receiver!.f, m!.Name), NewModuleBlock(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []))), isLocal: false as bool }];
      }
      continue;
    }
    const node = NodeBuilderImpl_serializeNamespaceMember(receiver, resolved, m!.Name);
    if (node !== undefined) {
      bodyStmts = [...bodyStmts, { node, isLocal: false as bool }];
    }
  }
  // Add export modifier to exported statements
  const exportedStmts = bodyStmts.map((s) => {
    if ((s.isLocal as bool) || IsExportDeclaration(s.node)) {
      return s;
    }
    if (CanHaveModifiers(s.node)) {
      const mf = Node_ModifierFlags(s.node) | ModifierFlagsExport;
      return { node: ReplaceModifiers(receiver!.f, s.node, NodeFactory_NewModifierList(receiver!.f, CreateModifiersFromModifierFlags(mf, (kind) => NodeFactory_NewModifier(receiver!.f, kind)))), isLocal: s.isLocal };
    }
    return s;
  });
  let bodyStatements = exportedStmts.map((s) => s.node);
  const allExported = bodyStatements.length > 0 && Every(bodyStatements, (d) => HasSyntacticModifier(d, ModifierFlagsExport));
  if (allExported) {
    bodyStatements = bodyStatements.map((stmt) => {
      if (CanHaveModifiers(stmt)) {
        const mf = Node_ModifierFlags(stmt) & ~ModifierFlagsExport;
        return ReplaceModifiers(receiver!.f, stmt, NodeFactory_NewModifierList(receiver!.f, CreateModifiersFromModifierFlags(mf, (kind) => NodeFactory_NewModifier(receiver!.f, kind))));
      }
      return stmt;
    });
  }
  const keyword = IsIdentifier(localName) ? KindNamespaceKeyword : KindModuleKeyword;
  receiver!.ctx!.flags = oldFlags;
  return NewModuleDeclaration(receiver!.f, undefined, keyword, localName, NewModuleBlock(receiver!.f, NodeFactory_NewNodeList(receiver!.f, bodyStatements)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.serializeTypeAliasForNamespace","kind":"method","status":"implemented","sigHash":"5510c0565edec8a849fe4de5b11539a5fa3d11bd6b2595bc958b5e522e795d1b","bodyHash":"ba28ff599497d1dcd3c93fed78ac69cb36cac3d5d78152d4286764bd334f8167"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeTypeAliasForNamespace(symbol *ast.Symbol, name string) *ast.Node {
 * 	aliasType := b.ch.getDeclaredTypeOfTypeAlias(symbol)
 * 	typeParams := b.ch.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 	typeParamDecls := core.Map(typeParams, func(p *Type) *ast.Node { return b.typeParameterToDeclaration(p) })
 * 	restoreFlags := b.saveRestoreFlags()
 * 	b.ctx.flags |= nodebuilder.FlagsInTypeAlias
 * 	typeNode := b.typeToTypeNode(aliasType)
 * 	restoreFlags()
 * 	b.ctx.approximateLength += 8 + len(name)
 * 	return b.f.NewTypeAliasDeclaration(nil, b.f.NewIdentifier(name), b.f.NewNodeList(typeParamDecls), typeNode)
 * }
 */
export function NodeBuilderImpl_serializeTypeAliasForNamespace(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, name: string): GoPtr<Node> {
  const aliasType = Checker_getDeclaredTypeOfTypeAlias(receiver!.ch, symbol_);
  const typeParams = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver!.ch, symbol_);
  const typeParamDecls = Map(typeParams, (p) => NodeBuilderImpl_typeParameterToDeclaration(receiver, p));
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  receiver!.ctx!.flags = (receiver!.ctx!.flags | FlagsInTypeAlias) as Flags;
  const typeNode = NodeBuilderImpl_typeToTypeNode(receiver, aliasType);
  restoreFlags();
  receiver!.ctx!.approximateLength += 8 + name.length;
  return NewTypeAliasDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, name), NodeFactory_NewNodeList(receiver!.f, typeParamDecls), typeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.filterInheritedProperties","kind":"method","status":"implemented","sigHash":"fd93479878ce292c0aa5c857ac9dbbbc007af8616acf9652a3b62395ff3af687","bodyHash":"745fc839994e834e20c185d30aca30737d079b5b8dba2c6d6ebd678292161e9d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) filterInheritedProperties(t *Type, baseTypes []*Type, properties []*ast.Symbol) []*ast.Symbol {
 * 	if len(baseTypes) == 0 {
 * 		return properties
 * 	}
 * 	// Build a lookup from property name to symbol for parent-identity comparison.
 * 	propsByName := make(map[string]*ast.Symbol, len(properties))
 * 	for _, p := range properties {
 * 		propsByName[p.Name] = p
 * 	}
 * 	// Collect names of properties inherited unchanged from base types.
 * 	var inherited collections.Set[string]
 * 	for _, base := range baseTypes {
 * 		baseWithThis := b.ch.getTypeWithThisArgument(base, b.ch.getTargetType(t).AsInterfaceType().thisType, false)
 * 		for _, prop := range b.ch.getPropertiesOfType(baseWithThis) {
 * 			if existing, ok := propsByName[prop.Name]; ok && prop.Parent == existing.Parent {
 * 				inherited.Add(prop.Name)
 * 			}
 * 		}
 * 	}
 * 	if inherited.Len() == 0 {
 * 		return properties
 * 	}
 * 	return core.Filter(properties, func(p *ast.Symbol) bool {
 * 		return !inherited.Has(p.Name)
 * 	})
 * }
 */
export function NodeBuilderImpl_filterInheritedProperties(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, baseTypes: GoSlice<GoPtr<Type>>, properties: GoSlice<GoPtr<Symbol>>): GoSlice<GoPtr<Symbol>> {
  if (baseTypes.length === 0) {
    return properties;
  }
  const propsByName = new globalThis.Map<string, GoPtr<Symbol>>();
  for (const p of properties) {
    propsByName.set(p!.Name, p);
  }
  const inherited: GoPtr<Set<string>> = NewSetWithSizeHint<string>(0);
  for (const base of baseTypes) {
    const baseWithThis = Checker_getTypeWithThisArgument(receiver!.ch, base, Type_AsInterfaceType(Checker_getTargetType(receiver!.ch, t))!.thisType, false as bool);
    for (const prop of Checker_getPropertiesOfType(receiver!.ch, baseWithThis)) {
      const existing = propsByName.get(prop!.Name);
      if (existing !== undefined && prop!.Parent === existing!.Parent) {
        Set_Add(inherited, prop!.Name);
      }
    }
  }
  if (Set_Len(inherited) === 0) {
    return properties;
  }
  return properties.filter((p) => !Set_Has(inherited, p!.Name));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::method::NodeBuilderImpl.isNamespaceMember","kind":"method","status":"implemented","sigHash":"0f3bb9e95e676e9cf8a12b759c20b01fa995697b39d2e5ca0d92a8d9bb4400f9","bodyHash":"5ed6f5f521886176a73bf664bb25730f4adbc9ede831bebcab0e16ba4e49bb2c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isNamespaceMember(p *ast.Symbol) bool {
 * 	return p.Flags&(ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias) != 0 ||
 * 		!(p.Flags&ast.SymbolFlagsPrototype != 0 || p.Name == "prototype" || (p.ValueDeclaration != nil && ast.HasStaticModifier(p.ValueDeclaration) && ast.IsClassLike(p.ValueDeclaration.Parent)))
 * }
 */
export function NodeBuilderImpl_isNamespaceMember(receiver: GoPtr<NodeBuilderImpl>, p: GoPtr<Symbol>): bool {
  return (
    (p!.Flags & (SymbolFlagsType | SymbolFlagsNamespace | SymbolFlagsAlias)) !== 0 ||
    !((p!.Flags & SymbolFlagsPrototype) !== 0 || p!.Name === "prototype" || (p!.ValueDeclaration !== undefined && HasStaticModifier(p!.ValueDeclaration) && IsClassLike(p!.ValueDeclaration!.Parent)))
  ) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder_hover.go::func::isHashPrivate","kind":"func","status":"implemented","sigHash":"ade27b6844259ed8aa42b7f51bfef607fbe7114917c27d0cd6b192ca918bf006","bodyHash":"eb24be276c7b44c6a75d1609ae62293b65385541a1460577e115a22e7fd3304b"}
 *
 * Go source:
 * func isHashPrivate(s *ast.Symbol) bool {
 * 	return s.ValueDeclaration != nil && s.ValueDeclaration.Name() != nil && ast.IsPrivateIdentifier(s.ValueDeclaration.Name())
 * }
 */
export function isHashPrivate(s: GoPtr<Symbol>): bool {
  return (s!.ValueDeclaration !== undefined && Node_Name(s!.ValueDeclaration) !== undefined && IsPrivateIdentifier(Node_Name(s!.ValueDeclaration))) as bool;
}

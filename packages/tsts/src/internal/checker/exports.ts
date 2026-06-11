import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/ast.js";
import { Node_Symbol, Node_Text } from "../ast/ast.js";
import type { ImportAttributes } from "../ast/ast_generated.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import type { Symbol } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import { FindAncestor, GetFirstIdentifier, GetSourceFileOfNode, IsDeclaration } from "../ast/utilities.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Checker, UnionReduction } from "./checker/state.js";
import { CheckModeNormal, isTupleType } from "./checker/state.js";
import { Checker_getApparentType, Checker_getBaseTypeOfLiteralType, Checker_getBaseTypes, Checker_getContextualTypeForObjectLiteralElement, Checker_getPropertiesOfType, Checker_getTypeFromTypeNode, Checker_getUnionType, Checker_getUnionTypeEx, Checker_getWidenedLiteralType, Checker_isArrayLikeType } from "./checker/types.js";
import { Checker_getDeclaredTypeOfSymbol, Checker_getEffectiveDeclarationFlags, Checker_getGlobalSymbol, Checker_getImmediateAliasedSymbol, Checker_getIndexInfosOfType, Checker_getMergedSymbol, Checker_getPropertyOfType, Checker_getResolvedSymbol, Checker_getSymbolFlags, Checker_getTypeOfPropertyOfContextualType, Checker_getTypeOfPropertyOfType, Checker_getTypeOfSymbol, Checker_getTypeOnlyAliasDeclaration, Checker_isPropertyAccessible, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol } from "./checker/symbols.js";
import { Checker_fillMissingTypeArguments, Checker_getBaseConstructorTypeOfClass, Checker_getConstraintOfTypeParameter, Checker_getContextualTypeForArgumentAtIndex, Checker_getDefaultFromTypeParameter, Checker_getIndexSignaturesAtLocation, Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias, Checker_getMinTypeArgumentCount, Checker_getRestTypeOfSignature, Checker_getResolvedSignature, Checker_getReturnTypeOfSignature, Checker_getSignaturesOfType, Checker_getTypeArguments, Checker_typeHasCallOrConstructSignatures } from "./checker/signatures.js";
import { Checker_getBaseConstraintOfType } from "./checker/inference.js";
import { Checker_getResolutionModeOverride } from "./checker/classes.js";
import { Checker_GetEmitResolver } from "./checker/support.js";
import { Checker_isContextSensitive } from "./checker/support-queries.js";
import { Checker_tryFindAmbientModule } from "./checker/modules.js";
import { EmitResolver_RequiresAddingImplicitUndefined } from "./emitresolver.js";
import { Checker_getTypePredicateOfSignature, Checker_hasEffectiveRestParameter, Checker_isTypeAssignableTo } from "./relater.js";
import { Checker_typePredicateToString } from "./printer.js";
import { Checker_getExpandedParameters } from "./nodebuilderimpl.js";
import { Checker_getJsxFragmentFactoryEntity, Checker_getJsxNamespace } from "./jsx.js";
import { getDeclarationModifierFlagsFromSymbol } from "./utilities.js";
import type { ContextFlags, IndexInfo, Signature, SignatureKind, Type, TypePredicate } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetStringType","kind":"method","status":"implemented","sigHash":"db019c1478830dd05eb6b682bc00180d4c92d73dcc9d07a1100694019ea48738","bodyHash":"a254062e89d505ce2b6b6cdf19a5df2ea77765f07bd06267da25c7d59db531ea"}
 *
 * Go source:
 * func (c *Checker) GetStringType() *Type {
 * 	return c.stringType
 * }
 */
export function Checker_GetStringType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.stringType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetNumberType","kind":"method","status":"implemented","sigHash":"45af1cffa156330f2364b7a76b018ea87fd38e35a6237615c82c507ec18bf974","bodyHash":"3c657c3f97455dbba4db9f73c27e470aa647e6859696fd874aaa2d88c8b089c5"}
 *
 * Go source:
 * func (c *Checker) GetNumberType() *Type {
 * 	return c.numberType
 * }
 */
export function Checker_GetNumberType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.numberType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBooleanType","kind":"method","status":"implemented","sigHash":"5c496219ec0a423e26e81524b30b3aefd0a04849d0cfcf2b271beba9ab6e7080","bodyHash":"442ea79dff7041c263d0c684a14c39d6e7b8f004e662604e09597f615f023328"}
 *
 * Go source:
 * func (c *Checker) GetBooleanType() *Type {
 * 	return c.booleanType
 * }
 */
export function Checker_GetBooleanType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.booleanType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetVoidType","kind":"method","status":"implemented","sigHash":"640315ff80faa8472a83f95306086699a4d4940d25af388cfe1300541d0746d4","bodyHash":"201f9b2db7f90a47a8509d16c9fb190903fdd1dbeebcbfc10c48ac9b92609d9f"}
 *
 * Go source:
 * func (c *Checker) GetVoidType() *Type {
 * 	return c.voidType
 * }
 */
export function Checker_GetVoidType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.voidType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetUndefinedType","kind":"method","status":"implemented","sigHash":"5d53e7f8b0df619fbb0521225f23448bf4ea0046a20834675d94227bc572ef47","bodyHash":"d214873f48ede834b0446beb5e53e6fbdf5671ae8af05b03745727e9e2758a30"}
 *
 * Go source:
 * func (c *Checker) GetUndefinedType() *Type {
 * 	return c.undefinedType
 * }
 */
export function Checker_GetUndefinedType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.undefinedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetNullType","kind":"method","status":"implemented","sigHash":"fcbe6ffeabacf743e69ebd55b55d5ebc51f5b60853ff06666348cae4033d605e","bodyHash":"af9748dec955fff81e1f3392fc8e279cad2f91472f316afb9cc341ccd2984917"}
 *
 * Go source:
 * func (c *Checker) GetNullType() *Type {
 * 	return c.nullType
 * }
 */
export function Checker_GetNullType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.nullType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetAnyType","kind":"method","status":"implemented","sigHash":"ceb20b645d3b90f7c91f1897a2803173b439f061261cfd6bf32bb810332a42cd","bodyHash":"558673b1d3e83b954e16207e1dffc8b1a1ade6014821da8d13c537af7e043001"}
 *
 * Go source:
 * func (c *Checker) GetAnyType() *Type {
 * 	return c.anyType
 * }
 */
export function Checker_GetAnyType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.anyType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetErrorType","kind":"method","status":"implemented","sigHash":"2be1394eb094e7b00627459a299a46cc70f6b86258ae27ae02e131b0cd74e5d7","bodyHash":"67d7d01c853bfee55e6def2477b29046d55662bf8ffab4fc4f5e126dffc76e8f"}
 *
 * Go source:
 * func (c *Checker) GetErrorType() *Type {
 * 	return c.errorType
 * }
 */
export function Checker_GetErrorType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetNeverType","kind":"method","status":"implemented","sigHash":"32f5573cf0d1bf1ee68773fc32f207306a5fcef2e804be773e51dd08d95f38f3","bodyHash":"5dc95fe758e8cc3463b3ff710570b4596fdb42fc2ccecf46a52ccbad4d8839bc"}
 *
 * Go source:
 * func (c *Checker) GetNeverType() *Type {
 * 	return c.neverType
 * }
 */
export function Checker_GetNeverType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.neverType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetUnknownType","kind":"method","status":"implemented","sigHash":"b5a260319fa2b9414fb068c5e1fe430b2a3021cb0e7c52ca5185e0589aacab6f","bodyHash":"c30481823e2402e6c5fd444ef5bb9c7173ed7aee3a19cc3450b8e59adbb43f2a"}
 *
 * Go source:
 * func (c *Checker) GetUnknownType() *Type {
 * 	return c.unknownType
 * }
 */
export function Checker_GetUnknownType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.unknownType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBigIntType","kind":"method","status":"implemented","sigHash":"fc8782d5bcd23e3b3945ca279aeceb246246b5f14360a842609e74a1cd0ce4e4","bodyHash":"1878eb226d487c525dcdd0486e7e7432844d2912d3ba35d18f0c39fe0c867331"}
 *
 * Go source:
 * func (c *Checker) GetBigIntType() *Type {
 * 	return c.bigintType
 * }
 */
export function Checker_GetBigIntType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.bigintType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetESSymbolType","kind":"method","status":"implemented","sigHash":"89e2990845a65a38e2b3adce9cf4c0e964d26967751ac6decb46e6f1a708408e","bodyHash":"5eeafa0b1c4e6893e6489a8b85a3618af24643141a6193520c084623c7e93a76"}
 *
 * Go source:
 * func (c *Checker) GetESSymbolType() *Type {
 * 	return c.esSymbolType
 * }
 */
export function Checker_GetESSymbolType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return receiver!.esSymbolType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBaseTypeOfLiteralType","kind":"method","status":"implemented","sigHash":"8c0d6eabf8f103473b833bae12a33d685751582a7cc01f3053f94a8f8a3d2e45","bodyHash":"fc1ef49b2855afe414e85d7668c492572c17f391578e77c70e13da59f825ecd2"}
 *
 * Go source:
 * func (c *Checker) GetBaseTypeOfLiteralType(t *Type) *Type {
 * 	return c.getBaseTypeOfLiteralType(t)
 * }
 */
export function Checker_GetBaseTypeOfLiteralType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getBaseTypeOfLiteralType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetUnknownSymbol","kind":"method","status":"implemented","sigHash":"1bf39502b1d583282d78d69f767d3517890757e9de47c04bfb1b5abd8759c90f","bodyHash":"6c34e984e58a42a03da2809d7ed2848e49f7bd8d66dd416642e66e9dd37f9b36"}
 *
 * Go source:
 * func (c *Checker) GetUnknownSymbol() *ast.Symbol {
 * 	return c.unknownSymbol
 * }
 */
export function Checker_GetUnknownSymbol(receiver: GoPtr<Checker>): GoPtr<Symbol> {
  return receiver!.unknownSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetUnionType","kind":"method","status":"implemented","sigHash":"3cc277d9a375252083042eda762be895e983ac8ce77770c2155423e19bf9a8fb","bodyHash":"16ec5b1e8112ff4ad94c04553d884d7552da5484746a2cff2681486b17bbaffa"}
 *
 * Go source:
 * func (c *Checker) GetUnionType(types []*Type) *Type {
 * 	return c.getUnionType(types)
 * }
 */
export function Checker_GetUnionType(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoPtr<Type> {
  return Checker_getUnionType(receiver, types);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetGlobalSymbol","kind":"method","status":"implemented","sigHash":"588b2c8092099fa399707f84799daa8d78cfe7b84616972d94e6b26efe0ada24","bodyHash":"2320240fb139306679da168ba2e4b38a3ab51c160c53d53d7c314290bdead54a"}
 *
 * Go source:
 * func (c *Checker) GetGlobalSymbol(name string, meaning ast.SymbolFlags, diagnostic *diagnostics.Message) *ast.Symbol {
 * 	return c.getGlobalSymbol(name, meaning, diagnostic)
 * }
 */
export function Checker_GetGlobalSymbol(receiver: GoPtr<Checker>, name: string, meaning: SymbolFlags, diagnostic: GoPtr<Message>): GoPtr<Symbol> {
  return Checker_getGlobalSymbol(receiver, name, meaning, diagnostic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetMergedSymbol","kind":"method","status":"implemented","sigHash":"b4d49bcf1de52a31344eb29c60b45bf3edf66007167aef95b2235f8349dc1e3c","bodyHash":"862bb77fe5d134ee3b64444b8bb2076bd1d8a00cb3bd4321b4a9c8461824412a"}
 *
 * Go source:
 * func (c *Checker) GetMergedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.getMergedSymbol(symbol)
 * }
 */
export function Checker_GetMergedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  return Checker_getMergedSymbol(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.TryFindAmbientModule","kind":"method","status":"implemented","sigHash":"f84ce0380cb14b22c3edd081cc7e0a7ac66974397c6b78e8616ca79bc26e936f","bodyHash":"0f2e92199d45c7e16d521a73fab5ef5454d3190ae35a3b0f6ae169393e1b96c7"}
 *
 * Go source:
 * func (c *Checker) TryFindAmbientModule(moduleName string) *ast.Symbol {
 * 	return c.tryFindAmbientModule(moduleName, true /* withAugmentations * /)
 * }
 */
export function Checker_TryFindAmbientModule(receiver: GoPtr<Checker>, moduleName: string): GoPtr<Symbol> {
  return Checker_tryFindAmbientModule(receiver, moduleName, true /* withAugmentations */);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetImmediateAliasedSymbol","kind":"method","status":"implemented","sigHash":"ffd3224869a3d387ff7204bec215242a0b76ac398515e69165ab1e9eb55bda82","bodyHash":"e0b5c02e29dad62633e24c5d4ca531067edb5d83dae8ed31ee9d3653734710e8"}
 *
 * Go source:
 * func (c *Checker) GetImmediateAliasedSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.getImmediateAliasedSymbol(symbol)
 * }
 */
export function Checker_GetImmediateAliasedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  return Checker_getImmediateAliasedSymbol(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeOnlyAliasDeclaration","kind":"method","status":"implemented","sigHash":"52e542552ea632877e11564324b841dfa0cde9e6aa6e590678ff225751b37f43","bodyHash":"861299cd31d14a604f969f2d79d77dca1cc65885a03436bc99f838bb44888dab"}
 *
 * Go source:
 * func (c *Checker) GetTypeOnlyAliasDeclaration(symbol *ast.Symbol) *ast.Node {
 * 	return c.getTypeOnlyAliasDeclaration(symbol)
 * }
 */
export function Checker_GetTypeOnlyAliasDeclaration(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  return Checker_getTypeOnlyAliasDeclaration(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.ResolveExternalModuleName","kind":"method","status":"implemented","sigHash":"9f041214cd941330bf756b2e89f318f06ca079c4ce0541acde19b849c61640a4","bodyHash":"b7e43b9216f4d99270a51ba010d3df33c23b38732d7d03f4df23ea3d0577d039"}
 *
 * Go source:
 * func (c *Checker) ResolveExternalModuleName(moduleSpecifier *ast.Node) *ast.Symbol {
 * 	return c.resolveExternalModuleName(moduleSpecifier, moduleSpecifier, true /*ignoreErrors* /)
 * }
 */
export function Checker_ResolveExternalModuleName(receiver: GoPtr<Checker>, moduleSpecifier: GoPtr<Node>): GoPtr<Symbol> {
  return Checker_resolveExternalModuleName(receiver, moduleSpecifier, moduleSpecifier, true /*ignoreErrors*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.ResolveExternalModuleSymbol","kind":"method","status":"implemented","sigHash":"accde15f3db69573d87f3c16af365ae2fa6f3ff4fa662de8f89525871a52e3df","bodyHash":"ef6c080212eca1d512bec66aa2c1f34c25c5e684eee90ede4f453fa8496bae64"}
 *
 * Go source:
 * func (c *Checker) ResolveExternalModuleSymbol(moduleSymbol *ast.Symbol) *ast.Symbol {
 * 	return c.resolveExternalModuleSymbol(moduleSymbol, false /*dontResolveAlias* /)
 * }
 */
export function Checker_ResolveExternalModuleSymbol(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>): GoPtr<Symbol> {
  return Checker_resolveExternalModuleSymbol(receiver, moduleSymbol, false /*dontResolveAlias*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeFromTypeNode","kind":"method","status":"implemented","sigHash":"a5aa5d240d23c04e8eccf68154adedb57fa4c0d7f3b276227c4234fa86d6d6e0","bodyHash":"fc95281c0895b54673628228e8787cb8b7268e8155bc2938a43389c9ef842960"}
 *
 * Go source:
 * func (c *Checker) GetTypeFromTypeNode(node *ast.Node) *Type {
 * 	return c.getTypeFromTypeNode(node)
 * }
 */
export function Checker_GetTypeFromTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_getTypeFromTypeNode(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.IsArrayLikeType","kind":"method","status":"implemented","sigHash":"fb84e941ea65cf0a6e0024e99f829993492e72a912c44f93ce2414eb75d8b1f4","bodyHash":"da9d4f2937d8194f56a73b1591af1c7918bc66d8e8cad6f9ab65aa1bb59c7b0c"}
 *
 * Go source:
 * func (c *Checker) IsArrayLikeType(t *Type) bool {
 * 	return c.isArrayLikeType(t)
 * }
 */
export function Checker_IsArrayLikeType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_isArrayLikeType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetPropertiesOfType","kind":"method","status":"implemented","sigHash":"5dadddb3acead50fe38305e9995fd7faaaa1fae8d558c7154f1fc276404a0ea7","bodyHash":"b43cdd1e496fa340e649ccd4d4055e50c7c88ffdb2f357f58c72d05f56fad7b4"}
 *
 * Go source:
 * func (c *Checker) GetPropertiesOfType(t *Type) []*ast.Symbol {
 * 	return c.getPropertiesOfType(t)
 * }
 */
export function Checker_GetPropertiesOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Symbol>> {
  return Checker_getPropertiesOfType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetPropertyOfType","kind":"method","status":"implemented","sigHash":"5c7f45961fb2b004102e406c6d94b938de737588c52880bc2aa42a7d32121fe7","bodyHash":"3ccdd94d8f48a36619af9ff59b5f16a79632ce1d5c65687f757e49b4fc6b19d5"}
 *
 * Go source:
 * func (c *Checker) GetPropertyOfType(t *Type, name string) *ast.Symbol {
 * 	return c.getPropertyOfType(t, name)
 * }
 */
export function Checker_GetPropertyOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Symbol> {
  return Checker_getPropertyOfType(receiver, t, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.TypeHasCallOrConstructSignatures","kind":"method","status":"implemented","sigHash":"a1114b1d6232e6cb531c280117f3d3bc849ab02c9441ddb6b174de27996418bb","bodyHash":"71edd60d2bca82bfc69e2a44253f20f1263782bc912e74e195f1da91f653b637"}
 *
 * Go source:
 * func (c *Checker) TypeHasCallOrConstructSignatures(t *Type) bool {
 * 	return c.typeHasCallOrConstructSignatures(t)
 * }
 */
export function Checker_TypeHasCallOrConstructSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_typeHasCallOrConstructSignatures(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.IsPropertyAccessible","kind":"method","status":"implemented","sigHash":"c07abb979a1056eb19e4d98d2d5425bcd30b315ed295688314c42bfc2c6ca4ff","bodyHash":"f76ed28199ee8c3d73765dc9fc06c54243cc3f74047e5f0cf7b7de92816a938d"}
 *
 * Go source:
 * func (c *Checker) IsPropertyAccessible(node *ast.Node, isSuper bool, isWrite bool, containingType *Type, property *ast.Symbol) bool {
 * 	return c.isPropertyAccessible(node, isSuper, isWrite, containingType, property)
 * }
 */
export function Checker_IsPropertyAccessible(receiver: GoPtr<Checker>, node: GoPtr<Node>, isSuper: bool, isWrite: bool, containingType: GoPtr<Type>, property: GoPtr<Symbol>): bool {
  return Checker_isPropertyAccessible(receiver, node, isSuper, isWrite, containingType, property);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeOfPropertyOfContextualType","kind":"method","status":"implemented","sigHash":"28653a9fc7e5133847658f41ea09f83823f4154e95a6b7f813ebe4e36daf4a9a","bodyHash":"b8982294ab304d9107078515f960beb7b4dd3df890b619f28421f2efdbef9004"}
 *
 * Go source:
 * func (c *Checker) GetTypeOfPropertyOfContextualType(t *Type, name string) *Type {
 * 	return c.getTypeOfPropertyOfContextualType(t, name)
 * }
 */
export function Checker_GetTypeOfPropertyOfContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type> {
  return Checker_getTypeOfPropertyOfContextualType(receiver, t, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::func::GetDeclarationModifierFlagsFromSymbol","kind":"func","status":"implemented","sigHash":"dd4806997ce7524da77b5531d538951b2d90a0f9c486a800d48b037b426d5349","bodyHash":"527d690b75c48244969d8ba4b59762519d7917dfc582d19932af98980401535e"}
 *
 * Go source:
 * func GetDeclarationModifierFlagsFromSymbol(s *ast.Symbol) ast.ModifierFlags {
 * 	return getDeclarationModifierFlagsFromSymbol(s)
 * }
 */
export function GetDeclarationModifierFlagsFromSymbol(s: GoPtr<Symbol>): ModifierFlags {
  return getDeclarationModifierFlagsFromSymbol(s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.WasCanceled","kind":"method","status":"implemented","sigHash":"246ee33eb1f756c291c5710af646cbe6542a3f81d39f4d77ca0224b01fd6828a","bodyHash":"8b8030106903d15852e4078c2a99b36598400a7afad6988b5dbf552a1a047da5"}
 *
 * Go source:
 * func (c *Checker) WasCanceled() bool {
 * 	return c.wasCanceled
 * }
 */
export function Checker_WasCanceled(receiver: GoPtr<Checker>): bool {
  return receiver!.wasCanceled;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetSignaturesOfType","kind":"method","status":"implemented","sigHash":"2543a3830393dfbc072a81d16ae721c0fc32adb8e54f8e1924c2201365a4cc2c","bodyHash":"d63509615f5621dc00cfc948b631ba83288435f2cd2e34cc66af28ac990a18c3"}
 *
 * Go source:
 * func (c *Checker) GetSignaturesOfType(t *Type, kind SignatureKind) []*Signature {
 * 	return c.getSignaturesOfType(t, kind)
 * }
 */
export function Checker_GetSignaturesOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: SignatureKind): GoSlice<GoPtr<Signature>> {
  return Checker_getSignaturesOfType(receiver, t, kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetDeclaredTypeOfSymbol","kind":"method","status":"implemented","sigHash":"a193b3d0c31c3c2e81c4e0c648d5699004db814e8e56b67a4cb924263e9ea015","bodyHash":"bc0fc1531c6d25f7f67edca963832f1395d4c5e5dba82b781211cdac8c269c08"}
 *
 * Go source:
 * func (c *Checker) GetDeclaredTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	return c.getDeclaredTypeOfSymbol(symbol)
 * }
 */
export function Checker_GetDeclaredTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  return Checker_getDeclaredTypeOfSymbol(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeOfSymbol","kind":"method","status":"implemented","sigHash":"d8e160e1e45f4b30739b7b0d428739e020868b9414acca3d84718190736aa04a","bodyHash":"a125c11b485b717bead46600cd776a9c319f92c37c47bd16887d3df3a619c85b"}
 *
 * Go source:
 * func (c *Checker) GetTypeOfSymbol(symbol *ast.Symbol) *Type {
 * 	return c.getTypeOfSymbol(symbol)
 * }
 */
export function Checker_GetTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  return Checker_getTypeOfSymbol(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetConstraintOfTypeParameter","kind":"method","status":"implemented","sigHash":"350ec9a3d6d5791d019856b21c2bf349bfc413b72b5593beeae715c8237aba90","bodyHash":"ce4b64adc1be14f4ea45663e709f7326d35c855b000607906ede77dca2658ada"}
 *
 * Go source:
 * func (c *Checker) GetConstraintOfTypeParameter(typeParameter *Type) *Type {
 * 	return c.getConstraintOfTypeParameter(typeParameter)
 * }
 */
export function Checker_GetConstraintOfTypeParameter(receiver: GoPtr<Checker>, typeParameter: GoPtr<Type>): GoPtr<Type> {
  return Checker_getConstraintOfTypeParameter(receiver, typeParameter);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetDefaultFromTypeParameter","kind":"method","status":"implemented","sigHash":"3c146b7c586e540e7ec9a511b50fd785eb1010a919f66b2023b9c7ae69ce7315","bodyHash":"0cc203386e671a018646649bbb83904fe9099d6657617609bc3bd98d73d91a5c"}
 *
 * Go source:
 * func (c *Checker) GetDefaultFromTypeParameter(typeParameter *Type) *Type {
 * 	return c.getDefaultFromTypeParameter(typeParameter)
 * }
 */
export function Checker_GetDefaultFromTypeParameter(receiver: GoPtr<Checker>, typeParameter: GoPtr<Type>): GoPtr<Type> {
  return Checker_getDefaultFromTypeParameter(receiver, typeParameter);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetResolutionModeOverride","kind":"method","status":"implemented","sigHash":"47b1c6a8b7bf3815e9f017a31474e14eb572bd2d4aa8e97ab87dd6b78316d6c2","bodyHash":"8aa9784aea1837bcae19cbd192d369bf1c8e92b66e170e7018942a6b3ada48e8"}
 *
 * Go source:
 * func (c *Checker) GetResolutionModeOverride(node *ast.ImportAttributes, reportErrors bool) core.ResolutionMode {
 * 	return c.getResolutionModeOverride(node, reportErrors)
 * }
 */
export function Checker_GetResolutionModeOverride(receiver: GoPtr<Checker>, node: GoPtr<ImportAttributes>, reportErrors: bool): ResolutionMode {
  return Checker_getResolutionModeOverride(receiver, node, reportErrors);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetEffectiveDeclarationFlags","kind":"method","status":"implemented","sigHash":"52b5369c5bae83c774e3e66c14a2b2cf2570b761e24e5dc8b341309eec74a48b","bodyHash":"14d11d922c50efe97439138c83c99e7f3affd4d2922c8cd483d31236b06d82d2"}
 *
 * Go source:
 * func (c *Checker) GetEffectiveDeclarationFlags(n *ast.Node, flagsToCheck ast.ModifierFlags) ast.ModifierFlags {
 * 	return c.getEffectiveDeclarationFlags(n, flagsToCheck)
 * }
 */
export function Checker_GetEffectiveDeclarationFlags(receiver: GoPtr<Checker>, n: GoPtr<Node>, flagsToCheck: ModifierFlags): ModifierFlags {
  return Checker_getEffectiveDeclarationFlags(receiver, n, flagsToCheck);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBaseConstraintOfType","kind":"method","status":"implemented","sigHash":"bbbbecb6ba55a14859eb2d37ff3dc0ed1274afafcca581a8bcae7056b5864813","bodyHash":"557d26794be9403678c516111ac8bc69987b6e6128f22b7227b0460a6d3fd9e1"}
 *
 * Go source:
 * func (c *Checker) GetBaseConstraintOfType(t *Type) *Type {
 * 	return c.getBaseConstraintOfType(t)
 * }
 */
export function Checker_GetBaseConstraintOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getBaseConstraintOfType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypePredicateOfSignature","kind":"method","status":"implemented","sigHash":"160c13eac9cc825e72e004d4993dddc21fa23e80c22bc3a050ec9c516340e3b0","bodyHash":"42c1cb2b591c3543a980f3346c3963bb0fa641e913d019a9fdc5f2d0b415c11f"}
 *
 * Go source:
 * func (c *Checker) GetTypePredicateOfSignature(sig *Signature) *TypePredicate {
 * 	return c.getTypePredicateOfSignature(sig)
 * }
 */
export function Checker_GetTypePredicateOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<TypePredicate> {
  return Checker_getTypePredicateOfSignature(receiver, sig);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::func::IsTupleType","kind":"func","status":"implemented","sigHash":"fc12bfcae2ff4b9c35a43a269ce5e7764af19119b3dc7db59404543f45769056","bodyHash":"f4bf7493c766eb084de6093ee55a2cda9c838ae2e569abe35139fb7c03cd18d5"}
 *
 * Go source:
 * func IsTupleType(t *Type) bool {
 * 	return isTupleType(t)
 * }
 */
export function IsTupleType(t: GoPtr<Type>): bool {
  return isTupleType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetReturnTypeOfSignature","kind":"method","status":"implemented","sigHash":"5bf1b806e8a4bc06895a47d6e24e4b86aa0f52b24465df52ab16d04604590e91","bodyHash":"03d15ba7765eb533930ef24b4866f6a780ad8d6beb3afa9dd02fa81f23558a22"}
 *
 * Go source:
 * func (c *Checker) GetReturnTypeOfSignature(sig *Signature) *Type {
 * 	return c.getReturnTypeOfSignature(sig)
 * }
 */
export function Checker_GetReturnTypeOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Type> {
  return Checker_getReturnTypeOfSignature(receiver, sig);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.HasEffectiveRestParameter","kind":"method","status":"implemented","sigHash":"3e298abb97936ed036f928b0e8cb971992a7344bc2a1867140ed8c80f6dd1e32","bodyHash":"4f4797c85a000118c9ca0fcc62c379fed90164283bac0f90e37148942177c35e"}
 *
 * Go source:
 * func (c *Checker) HasEffectiveRestParameter(signature *Signature) bool {
 * 	return c.hasEffectiveRestParameter(signature)
 * }
 */
export function Checker_HasEffectiveRestParameter(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): bool {
  return Checker_hasEffectiveRestParameter(receiver, signature);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetLocalTypeParametersOfClassOrInterfaceOrTypeAlias","kind":"method","status":"implemented","sigHash":"b3476ffd3cd8fb0c435456edc0d8f2445cd02161054e69429333a5a746d174b6","bodyHash":"442dde87e2e51ba152459965af0c8af291656be0944a1987d31c0cab8d0d04d5"}
 *
 * Go source:
 * func (c *Checker) GetLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol *ast.Symbol) []*Type {
 * 	return c.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * }
 */
export function Checker_GetLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  return Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetContextualTypeForObjectLiteralElement","kind":"method","status":"implemented","sigHash":"6a4816b09d2b0ac85e5c43517f19011a5d9d14323c48f77daf1f6ee590ecc1fd","bodyHash":"a9c13106917592b01752272b9cd390e11ef3be04dc71e54af54d2143ce30af18"}
 *
 * Go source:
 * func (c *Checker) GetContextualTypeForObjectLiteralElement(element *ast.Node, contextFlags ContextFlags) *Type {
 * 	return c.getContextualTypeForObjectLiteralElement(element, contextFlags)
 * }
 */
export function Checker_GetContextualTypeForObjectLiteralElement(receiver: GoPtr<Checker>, element: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type> {
  return Checker_getContextualTypeForObjectLiteralElement(receiver, element, contextFlags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.TypePredicateToString","kind":"method","status":"implemented","sigHash":"5fba1ba5caa5cf51ca3ded04ff9a9cd9c5a4c52649bfa901c80dfdbe15c0e86d","bodyHash":"b0beac9003578ffa8fef1a3871233c8dcdaacff5dcc6233a51284f4650b05857"}
 *
 * Go source:
 * func (c *Checker) TypePredicateToString(t *TypePredicate) string {
 * 	return c.typePredicateToString(t)
 * }
 */
export function Checker_TypePredicateToString(receiver: GoPtr<Checker>, t: GoPtr<TypePredicate>): string {
  return Checker_typePredicateToString(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetExpandedParameters","kind":"method","status":"implemented","sigHash":"995306b4f0b037e2dacc99b33ea7b020594e19e51c5293d40d9ae05ac2bebfad","bodyHash":"a30db15fbda685276419f93fe1a5884e7bfeabee22de467ab12bd850cf3c8513"}
 *
 * Go source:
 * func (c *Checker) GetExpandedParameters(signature *Signature, skipUnionExpanding bool) [][]*ast.Symbol {
 * 	return c.getExpandedParameters(signature, skipUnionExpanding)
 * }
 */
export function Checker_GetExpandedParameters(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, skipUnionExpanding: bool): GoSlice<GoSlice<GoPtr<Symbol>>> {
  return Checker_getExpandedParameters(receiver, signature, skipUnionExpanding);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetResolvedSignature","kind":"method","status":"implemented","sigHash":"199bf327aa605ac4f46dbbdd1883b4d69ae25ae43f480c1775320e5641f8adac","bodyHash":"d7e7996db57a92f7309e07e1c9594bc4f45128f3e12006b273508e1f53757322"}
 *
 * Go source:
 * func (c *Checker) GetResolvedSignature(node *ast.Node) *Signature {
 * 	return c.getResolvedSignature(node, nil, CheckModeNormal)
 * }
 */
export function Checker_GetResolvedSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  return Checker_getResolvedSignature(receiver, node, undefined, CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeOfPropertyOfType","kind":"method","status":"implemented","sigHash":"bf7e579fe782f5b955442e52036c9877425786585d15d7ad8d33d73fefbf4fc3","bodyHash":"b3352c3441d24dd064e5634d7356834ff0c785e143ada7819daf3f7f92e072e2"}
 *
 * Go source:
 * func (c *Checker) GetTypeOfPropertyOfType(t *Type, name string) *Type {
 * 	return c.getTypeOfPropertyOfType(t, name)
 * }
 */
export function Checker_GetTypeOfPropertyOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type> {
  return Checker_getTypeOfPropertyOfType(receiver, t, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetContextualTypeForArgumentAtIndex","kind":"method","status":"implemented","sigHash":"7624e082ef2f5d173cfee23537c895345e9cbd2bbf01c284287ddaf48cdb1218","bodyHash":"43ac5fcaf91e2973b813acd97a7fa4f3cb7489ba477d82d7b069b22902ccd693"}
 *
 * Go source:
 * func (c *Checker) GetContextualTypeForArgumentAtIndex(node *ast.Node, argIndex int) *Type {
 * 	return c.getContextualTypeForArgumentAtIndex(node, argIndex)
 * }
 */
export function Checker_GetContextualTypeForArgumentAtIndex(receiver: GoPtr<Checker>, node: GoPtr<Node>, argIndex: int): GoPtr<Type> {
  return Checker_getContextualTypeForArgumentAtIndex(receiver, node, argIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetIndexSignaturesAtLocation","kind":"method","status":"implemented","sigHash":"0023824bdef28da47e1baf1556a0003b2588bd5eacacb2f9ac0dced027fe1dca","bodyHash":"9eafc569b63cbb4e7c7e5820dc208ba9669cec32b30abd1f78d1e1224f7fb265"}
 *
 * Go source:
 * func (c *Checker) GetIndexSignaturesAtLocation(node *ast.Node) []*ast.Node {
 * 	return c.getIndexSignaturesAtLocation(node)
 * }
 */
export function Checker_GetIndexSignaturesAtLocation(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  return Checker_getIndexSignaturesAtLocation(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetResolvedSymbol","kind":"method","status":"implemented","sigHash":"8fea2f91b74f4b573a987489222a629557ba9b7fd30b2efaf744276c0dbce1ad","bodyHash":"7d0756b2f6a30f5de067028610392ac720316167d81f7b051ec75a941640d13a"}
 *
 * Go source:
 * func (c *Checker) GetResolvedSymbol(node *ast.Node) *ast.Symbol {
 * 	return c.getResolvedSymbol(node)
 * }
 */
export function Checker_GetResolvedSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  return Checker_getResolvedSymbol(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetJsxNamespace","kind":"method","status":"implemented","sigHash":"8b6a38949c498a7cc5752ce76bc7bcdff29db472329d458d5a9beffb75bdd005","bodyHash":"77dc1c4f165c75aa5d465ac4a02696cdc18d59091c9994c679fb0ae6c809b4a0"}
 *
 * Go source:
 * func (c *Checker) GetJsxNamespace(location *ast.Node) string {
 * 	return c.getJsxNamespace(location)
 * }
 */
export function Checker_GetJsxNamespace(receiver: GoPtr<Checker>, location: GoPtr<Node>): string {
  return Checker_getJsxNamespace(receiver, location);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetJsxFragmentFactory","kind":"method","status":"implemented","sigHash":"23352382a4789fd2ff1ebc986af2682659fd766517c7559a1595ef835ee89ec4","bodyHash":"886332830da2d0490f3936900df166afb78521627ba7c4d3f61e2643bbfb2f12"}
 *
 * Go source:
 * func (c *Checker) GetJsxFragmentFactory(location *ast.Node) string {
 * 	entity := c.getJsxFragmentFactoryEntity(location)
 * 	if entity != nil {
 * 		return ast.GetFirstIdentifier(entity).Text()
 * 	}
 * 	return ""
 * }
 */
export function Checker_GetJsxFragmentFactory(receiver: GoPtr<Checker>, location: GoPtr<Node>): string {
  const entity = Checker_getJsxFragmentFactoryEntity(receiver, location);
  if (entity !== undefined) {
    return Node_Text(GetFirstIdentifier(entity));
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.ResolveName","kind":"method","status":"implemented","sigHash":"dad4ab91ef0148affc8367e3b9291776daed8078561744c4903c8b2d23d83bfc","bodyHash":"36822481f34b3f8f3f7be8332169ffcdbfd91dcf37ac3bb618fe96016373c250"}
 *
 * Go source:
 * func (c *Checker) ResolveName(name string, location *ast.Node, meaning ast.SymbolFlags, excludeGlobals bool) *ast.Symbol {
 * 	return c.resolveName(location, name, meaning, nil, true, excludeGlobals)
 * }
 */
export function Checker_ResolveName(receiver: GoPtr<Checker>, name: string, location: GoPtr<Node>, meaning: SymbolFlags, excludeGlobals: bool): GoPtr<Symbol> {
  return receiver!.resolveName(location, name, meaning, undefined, true as bool, excludeGlobals);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetSymbolFlags","kind":"method","status":"implemented","sigHash":"09b5db9ad9c5721adc13f5529853920e91f4b7934790ed7fe734e8b09d135627","bodyHash":"616231bcc372d3ed51b7dd86e85c07658eeae09d4f7c6f07aa67192ecf535659"}
 *
 * Go source:
 * func (c *Checker) GetSymbolFlags(symbol *ast.Symbol) ast.SymbolFlags {
 * 	return c.getSymbolFlags(symbol)
 * }
 */
export function Checker_GetSymbolFlags(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): SymbolFlags {
  return Checker_getSymbolFlags(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBaseTypes","kind":"method","status":"implemented","sigHash":"0c278fdf202724806b74b5dea361160fbba2308e30d9bf79503d6c848b27aba2","bodyHash":"2e71200348ddd6f53894d013f23eeab1ca680fa1810f9fbd1ffaa4589180bf36"}
 *
 * Go source:
 * func (c *Checker) GetBaseTypes(t *Type) []*Type {
 * 	return c.getBaseTypes(t)
 * }
 */
export function Checker_GetBaseTypes(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Type>> {
  return Checker_getBaseTypes(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetApparentType","kind":"method","status":"implemented","sigHash":"014077be37d2c05c1e5770982979f79d2e40dc3c8a8956b97cdc9236b6a3b08f","bodyHash":"8d6b866da261334c9796546df49f3c70c2769a8086476eb6a82e7a4bddba7e14"}
 *
 * Go source:
 * func (c *Checker) GetApparentType(t *Type) *Type {
 * 	return c.getApparentType(t)
 * }
 */
export function Checker_GetApparentType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getApparentType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetBaseConstructorTypeOfClass","kind":"method","status":"implemented","sigHash":"ea317e9187ece7c911635f48d6efe6cc42f27dd2bd71ccc1767e70f60ba19fb8","bodyHash":"5711d7a491f184c4801cdffc2574cd558faa6a9393d06afdeefcaae96b6e00c8"}
 *
 * Go source:
 * func (c *Checker) GetBaseConstructorTypeOfClass(t *Type) *Type {
 * 	return c.getBaseConstructorTypeOfClass(t)
 * }
 */
export function Checker_GetBaseConstructorTypeOfClass(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getBaseConstructorTypeOfClass(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetRestTypeOfSignature","kind":"method","status":"implemented","sigHash":"fea6032ea6d9fc0596bf06c4fe25a937fe8b2ac2df34683f62eec3c027d579db","bodyHash":"b58d8250171a2130490ed9633f4125493046140f1b64252dd2e9bc480d9b3fff"}
 *
 * Go source:
 * func (c *Checker) GetRestTypeOfSignature(sig *Signature) *Type {
 * 	return c.getRestTypeOfSignature(sig)
 * }
 */
export function Checker_GetRestTypeOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Type> {
  return Checker_getRestTypeOfSignature(receiver, sig);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetTypeArguments","kind":"method","status":"implemented","sigHash":"d85d0a69bb794bf36f7e11babc2b1539fc6f2203db97110a370cab708edcb3df","bodyHash":"917e9b4ed9b46a6e5b96d1cda2d8bf15c5f1468df5be1bf1cd09cd4cd13ea684"}
 *
 * Go source:
 * func (c *Checker) GetTypeArguments(t *Type) []*Type {
 * 	return c.getTypeArguments(t)
 * }
 */
export function Checker_GetTypeArguments(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Type>> {
  return Checker_getTypeArguments(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetIndexInfosOfType","kind":"method","status":"implemented","sigHash":"8998a315d84ae915a80a9a7ca908a079f98829f653dd03de4bf12dadb92c9e5c","bodyHash":"2e770cba98a8d389e27c050f0820d737596493e7be787728f58ee44edff936f2"}
 *
 * Go source:
 * func (c *Checker) GetIndexInfosOfType(t *Type) []*IndexInfo {
 * 	return c.getIndexInfosOfType(t)
 * }
 */
export function Checker_GetIndexInfosOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<IndexInfo>> {
  return Checker_getIndexInfosOfType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.IsContextSensitive","kind":"method","status":"implemented","sigHash":"cfe08baa73b28197381c47732eaa01e1e140a1346dbbbf12a0376e9757e849f8","bodyHash":"40a873bd33aff492f1aa37afefc3c05d08c12f302a71396c93f75c6d6b13c180"}
 *
 * Go source:
 * func (c *Checker) IsContextSensitive(node *ast.Node) bool {
 * 	return c.isContextSensitive(node)
 * }
 */
export function Checker_IsContextSensitive(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return Checker_isContextSensitive(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.FillMissingTypeArguments","kind":"method","status":"implemented","sigHash":"9838f5c4343e3112344b8d4c4e55c059aa15b9451a6efe47150d20f4bdc445ff","bodyHash":"543a49642179f712012b9085f2e467b74e098fc1de7e6623990e55b4ff8d1065"}
 *
 * Go source:
 * func (c *Checker) FillMissingTypeArguments(typeArguments []*Type, typeParameters []*Type, minTypeArgumentCount int, isJavaScriptImplicitAny bool) []*Type {
 * 	return c.fillMissingTypeArguments(typeArguments, typeParameters, minTypeArgumentCount, isJavaScriptImplicitAny)
 * }
 */
export function Checker_FillMissingTypeArguments(receiver: GoPtr<Checker>, typeArguments: GoSlice<GoPtr<Type>>, typeParameters: GoSlice<GoPtr<Type>>, minTypeArgumentCount: int, isJavaScriptImplicitAny: bool): GoSlice<GoPtr<Type>> {
  return Checker_fillMissingTypeArguments(receiver, typeArguments, typeParameters, minTypeArgumentCount, isJavaScriptImplicitAny);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetMinTypeArgumentCount","kind":"method","status":"implemented","sigHash":"2c9142bc91e8de4b761eeb7c7b686d50f9ed9317bb5d3c523b8a65522897f457","bodyHash":"0f5647c4011146d860b7ddd9924e012377dcab52f18a6482e34e1564ea07d6eb"}
 *
 * Go source:
 * func (c *Checker) GetMinTypeArgumentCount(typeParameters []*Type) int {
 * 	return c.getMinTypeArgumentCount(typeParameters)
 * }
 */
export function Checker_GetMinTypeArgumentCount(receiver: GoPtr<Checker>, typeParameters: GoSlice<GoPtr<Type>>): int {
  return Checker_getMinTypeArgumentCount(receiver, typeParameters);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetWidenedLiteralType","kind":"method","status":"implemented","sigHash":"ce711cfc323c11f17c1abe1669126c60ac87f157b5643db0264d5bbabbf26d8b","bodyHash":"eeae7f508654336bcf7da02940bba95494ec884638869bfc767fd713ed159388"}
 *
 * Go source:
 * func (c *Checker) GetWidenedLiteralType(t *Type) *Type {
 * 	return c.getWidenedLiteralType(t)
 * }
 */
export function Checker_GetWidenedLiteralType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getWidenedLiteralType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.IsTypeAssignableTo","kind":"method","status":"implemented","sigHash":"9468ee8439b2efaeca598959b53bb9c56c764bb4cba8e572201ca375b7538582","bodyHash":"2968d579d02009e024feeb14b1a0cbc2fc270bec079cac25d5d8e7e0a0ccef8d"}
 *
 * Go source:
 * func (c *Checker) IsTypeAssignableTo(source *Type, target *Type) bool {
 * 	return c.isTypeAssignableTo(source, target)
 * }
 */
export function Checker_IsTypeAssignableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeAssignableTo(receiver, source, target);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.GetUnionTypeEx","kind":"method","status":"implemented","sigHash":"3c0c4bff5d4062029716d2b7e64ced259dd64ecf9d9cf60a98c1b2bcda6fab82","bodyHash":"7d6cda419a567d84d0cdae224388d21474df86478b0e87b478d94a3e621f1b7b"}
 *
 * Go source:
 * func (c *Checker) GetUnionTypeEx(types []*Type, unionReduction UnionReduction) *Type {
 * 	return c.getUnionTypeEx(types, unionReduction, nil, nil)
 * }
 */
export function Checker_GetUnionTypeEx(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, unionReduction: UnionReduction): GoPtr<Type> {
  return Checker_getUnionTypeEx(receiver, types, unionReduction, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/exports.go::method::Checker.RequiresAddingImplicitUndefined","kind":"method","status":"implemented","sigHash":"00a90dadba25b302220601f28cef87398dc37f197f5fe8df0222285969eca169","bodyHash":"bc74277e24cca65ee019003bd60231dd339da15433656a812df83bb00ac5d4f4"}
 *
 * Go source:
 * func (c *Checker) RequiresAddingImplicitUndefined(node *ast.Node) bool {
 * 	enclosingDeclaration := ast.FindAncestor(node, ast.IsDeclaration)
 * 	if enclosingDeclaration == nil {
 * 		enclosingDeclaration = ast.GetSourceFileOfNode(node).AsNode()
 * 	}
 * 	symbol := node.Symbol()
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	return c.GetEmitResolver().RequiresAddingImplicitUndefined(node, symbol, enclosingDeclaration)
 * }
 */
export function Checker_RequiresAddingImplicitUndefined(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let enclosingDeclaration = FindAncestor(node, IsDeclaration);
  if (enclosingDeclaration === undefined) {
    enclosingDeclaration = GetSourceFileOfNode(node) as GoPtr<Node>;
  }
  const symbol_ = Node_Symbol(node);
  if (symbol_ === undefined) {
    return false;
  }
  return EmitResolver_RequiresAddingImplicitUndefined(Checker_GetEmitResolver(receiver), node, symbol_, enclosingDeclaration);
}

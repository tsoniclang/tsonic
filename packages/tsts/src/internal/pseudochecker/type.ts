import type { bool, sbyte, short } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { GoInterfaceValue, Node } from "../ast/spine.js";
import { goReceiverKey } from "../ast/spine.js";
import type { TypeParameterDeclaration } from "../ast/generated/data.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeKind","kind":"type","status":"implemented","sigHash":"5f6d05dddcd7c40b06567b6639fcc9e2653dcc7ba9a670dd5bc328b039640dea","bodyHash":"5e0117670ed21a396d4ef334e19781bf70c372e9558cf5ee02dd9a427e6bd841"}
 *
 * Go source:
 * PseudoTypeKind int16
 */
export type PseudoTypeKind = short;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::constGroup::PseudoTypeKindDirect+PseudoTypeKindInferred+PseudoTypeKindNoResult+PseudoTypeKindMaybeConstLocation+PseudoTypeKindUnion+PseudoTypeKindUndefined+PseudoTypeKindNull+PseudoTypeKindAny+PseudoTypeKindString+PseudoTypeKindNumber+PseudoTypeKindBigInt+PseudoTypeKindBoolean+PseudoTypeKindFalse+PseudoTypeKindTrue+PseudoTypeKindSingleCallSignature+PseudoTypeKindTuple+PseudoTypeKindObjectLiteral+PseudoTypeKindStringLiteral+PseudoTypeKindNumericLiteral+PseudoTypeKindBigIntLiteral","kind":"constGroup","status":"implemented","sigHash":"c4a11793330828765f8261ae785733cbfb1ae40dd7050d5f640d136c119af48c","bodyHash":"d9effa70e5d64214654d96b3188a9e9186c0e242860954c5f4b38c13357e6700"}
 *
 * Go source:
 * const (
 * 	PseudoTypeKindDirect PseudoTypeKind = iota
 * 	PseudoTypeKindInferred
 * 	PseudoTypeKindNoResult
 * 	PseudoTypeKindMaybeConstLocation
 * 	PseudoTypeKindUnion
 * 	PseudoTypeKindUndefined
 * 	PseudoTypeKindNull
 * 	PseudoTypeKindAny
 * 	PseudoTypeKindString
 * 	PseudoTypeKindNumber
 * 	PseudoTypeKindBigInt
 * 	PseudoTypeKindBoolean
 * 	PseudoTypeKindFalse
 * 	PseudoTypeKindTrue
 * 	PseudoTypeKindSingleCallSignature
 * 	PseudoTypeKindTuple
 * 	PseudoTypeKindObjectLiteral
 * 	PseudoTypeKindStringLiteral
 * 	PseudoTypeKindNumericLiteral
 * 	PseudoTypeKindBigIntLiteral
 * )
 */
export const PseudoTypeKindDirect: PseudoTypeKind = 0 as short;
export const PseudoTypeKindInferred: PseudoTypeKind = 1 as short;
export const PseudoTypeKindNoResult: PseudoTypeKind = 2 as short;
export const PseudoTypeKindMaybeConstLocation: PseudoTypeKind = 3 as short;
export const PseudoTypeKindUnion: PseudoTypeKind = 4 as short;
export const PseudoTypeKindUndefined: PseudoTypeKind = 5 as short;
export const PseudoTypeKindNull: PseudoTypeKind = 6 as short;
export const PseudoTypeKindAny: PseudoTypeKind = 7 as short;
export const PseudoTypeKindString: PseudoTypeKind = 8 as short;
export const PseudoTypeKindNumber: PseudoTypeKind = 9 as short;
export const PseudoTypeKindBigInt: PseudoTypeKind = 10 as short;
export const PseudoTypeKindBoolean: PseudoTypeKind = 11 as short;
export const PseudoTypeKindFalse: PseudoTypeKind = 12 as short;
export const PseudoTypeKindTrue: PseudoTypeKind = 13 as short;
export const PseudoTypeKindSingleCallSignature: PseudoTypeKind = 14 as short;
export const PseudoTypeKindTuple: PseudoTypeKind = 15 as short;
export const PseudoTypeKindObjectLiteral: PseudoTypeKind = 16 as short;
export const PseudoTypeKindStringLiteral: PseudoTypeKind = 17 as short;
export const PseudoTypeKindNumericLiteral: PseudoTypeKind = 18 as short;
export const PseudoTypeKindBigIntLiteral: PseudoTypeKind = 19 as short;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoType","kind":"type","status":"implemented","sigHash":"6922048c7b65ea28cab3fcfbd9735bdbb4e502e1fced0f0fa92e135f3da7c2b6","bodyHash":"13a346d4a802f947c3798f16bdb2c89ec651d84c7266a5cf11f3f60d95250741"}
 *
 * Go source:
 * PseudoType struct {
 * 	Kind PseudoTypeKind
 * 	data pseudoTypeData
 * }
 */
export interface PseudoType {
  Kind: PseudoTypeKind;
  data: pseudoTypeData;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::newPseudoType","kind":"func","status":"implemented","sigHash":"6937b8889e10a7cd40d04ad1549b4251c47430d175fba073f6a072722ac8e2e1","bodyHash":"9366ca9adda3fa3fa037e81c1837923b0e622685f6a0ac0236ac50b17c866000"}
 *
 * Go source:
 * func newPseudoType(kind PseudoTypeKind, data pseudoTypeData) *PseudoType {
 * 	n := data.AsPseudoType()
 * 	n.Kind = kind
 * 	n.data = data
 * 	return n
 * }
 */
export function newPseudoType(kind: PseudoTypeKind, data: pseudoTypeData): GoPtr<PseudoType> {
  const n = data.AsPseudoType();
  n!.Kind = kind;
  n!.data = data;
  return n;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::pseudoTypeData","kind":"type","status":"implemented","sigHash":"364e55fe8444f9e686ba5a9261d288f7640824100e9fbf5e34b94d2f23645c7e","bodyHash":"1cd120020bff59dbedb7d39329bdb4a5e9092fc363e0a2c8610eed5715d98bf5"}
 *
 * Go source:
 * pseudoTypeData interface {
 * 	AsPseudoType() *PseudoType
 * }
 */
export interface pseudoTypeData extends GoInterfaceValue<unknown> {
  AsPseudoType(): GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeDefault","kind":"type","status":"implemented","sigHash":"971328e16f1aebc78356a48d9a86815f135e5454de8c2f6d190b284e38b01e99","bodyHash":"f1e63826887b8865eea3a692b0b41860923b2d80c1ae61eb96afb77b304badd8"}
 *
 * Go source:
 * PseudoTypeDefault struct {
 * 	PseudoType
 * }
 */
export interface PseudoTypeDefault extends PseudoType {
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoTypeDefault.AsPseudoType","kind":"method","status":"implemented","sigHash":"2c795a57812741a4cd0e11255d67dd53d932fab81b07c379ef9bc28152a500eb","bodyHash":"70f80d6aa65c35ea1a14ce30f0d7d9ec5649560b968f06400c448201b56329ee"}
 *
 * Go source:
 * func (b *PseudoTypeDefault) AsPseudoType() *PseudoType { return &b.PseudoType }
 */
export function PseudoTypeDefault_AsPseudoType(receiver: GoPtr<PseudoTypeDefault>): GoPtr<PseudoType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeBase","kind":"type","status":"implemented","sigHash":"af3b0db064728f381648ac63897561196295370113016748a253bcd0340f2f86","bodyHash":"037d05f16c567001cc1e5a0589f59df9a9148716928c319fb21532e8a635fb77"}
 *
 * Go source:
 * PseudoTypeBase struct {
 * 	PseudoTypeDefault
 * }
 */
export interface PseudoTypeBase extends PseudoTypeDefault {
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::varGroup::PseudoTypeUndefined+PseudoTypeNull+PseudoTypeAny+PseudoTypeString+PseudoTypeNumber+PseudoTypeBigInt+PseudoTypeBoolean+PseudoTypeFalse+PseudoTypeTrue","kind":"varGroup","status":"implemented","sigHash":"4791d024d013554a64e9e6e2f6ca43e65339de790b7773b9988cab3e870bcec9","bodyHash":"bb9185fc8b08826438182717294d478fb4862cacf92f74d73eb862b2f2b9e405"}
 *
 * Go source:
 * var (
 * 	PseudoTypeUndefined = newPseudoType(PseudoTypeKindUndefined, &PseudoTypeBase{})
 * 	PseudoTypeNull      = newPseudoType(PseudoTypeKindNull, &PseudoTypeBase{})
 * 	PseudoTypeAny       = newPseudoType(PseudoTypeKindAny, &PseudoTypeBase{})
 * 	PseudoTypeString    = newPseudoType(PseudoTypeKindString, &PseudoTypeBase{})
 * 	PseudoTypeNumber    = newPseudoType(PseudoTypeKindNumber, &PseudoTypeBase{})
 * 	PseudoTypeBigInt    = newPseudoType(PseudoTypeKindBigInt, &PseudoTypeBase{})
 * 	PseudoTypeBoolean   = newPseudoType(PseudoTypeKindBoolean, &PseudoTypeBase{})
 * 	PseudoTypeFalse     = newPseudoType(PseudoTypeKindFalse, &PseudoTypeBase{})
 * 	PseudoTypeTrue      = newPseudoType(PseudoTypeKindTrue, &PseudoTypeBase{})
 * )
 */
export const PseudoTypeUndefined: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindUndefined, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeNull: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindNull, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeAny: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindAny, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeString: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindString, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeNumber: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindNumber, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeBigInt: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindBigInt, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeBoolean: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindBoolean, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeFalse: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindFalse, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));
export const PseudoTypeTrue: GoPtr<PseudoType> = newPseudoType(PseudoTypeKindTrue, PseudoTypeBase_as_pseudoTypeData({} as PseudoTypeBase));

// Interface satisfaction: a `*PseudoTypeBase`/concrete pseudo-type satisfies
// `pseudoTypeData`. The concrete struct object IS the embedded `PseudoType`
// (flattened embedding), so `AsPseudoType()` returns the receiver itself
// (Go `return &b.PseudoType`). The `goReceiverKey` brand carries the concrete
// receiver for the later `t.data.(*Concrete)` type assertions.
export function PseudoTypeBase_as_pseudoTypeData(receiver: GoPtr<PseudoTypeBase>): pseudoTypeData {
  return {
    [goReceiverKey]: receiver,
    AsPseudoType: (): GoPtr<PseudoType> => PseudoTypeDefault_AsPseudoType(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeDirect","kind":"type","status":"implemented","sigHash":"ae16d0b37acd2e0f8a650ca2db5b12d8652bf41bcaafbaaf370846f35d6008cf","bodyHash":"1605673114a3a5119938a5becc9a84a8fe958d33a02f8bb9b24bcf17bd0c5768"}
 *
 * Go source:
 * PseudoTypeDirect struct {
 * 	PseudoTypeBase
 * 	TypeNode *ast.Node
 * }
 */
export interface PseudoTypeDirect extends PseudoTypeBase {
  TypeNode: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeDirect","kind":"func","status":"implemented","sigHash":"e97af9665f64edefbf10bec7ef1a35f59be09f8aa40bdb4e37ddc9bc154aa4d1","bodyHash":"1322bad7a6d971411b4cb151b5b79f69934c6232c758a393d9aebf6008228caa"}
 *
 * Go source:
 * func NewPseudoTypeDirect(typeNode *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindDirect, &PseudoTypeDirect{TypeNode: typeNode})
 * }
 */
export function NewPseudoTypeDirect(typeNode: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeDirect = {} as PseudoTypeDirect;
  data.TypeNode = typeNode;
  return newPseudoType(PseudoTypeKindDirect, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeDirect","kind":"method","status":"implemented","sigHash":"b51343bf9272b1e25ae87737e43780d561b06bc85bda9114878b480849367f46","bodyHash":"dad56f2149a510d71cfaa05c2deedb4cfe200ef788ae6f3270e3d00f1ace3d21"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeDirect() *PseudoTypeDirect { return t.data.(*PseudoTypeDirect) }
 */
export function PseudoType_AsPseudoTypeDirect(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeDirect> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeDirect>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeInferred","kind":"type","status":"implemented","sigHash":"37e28ee286ee7d687a0ff23130871f0e7c04c9c79e37cfa2fe90cd5032dbc1e5","bodyHash":"8f6e78e38102dc0b42e7ca8814462b9541dab0f1c4aab25d1c2644a0dca60f9b"}
 *
 * Go source:
 * PseudoTypeInferred struct {
 * 	PseudoTypeBase
 * 	Expression *ast.Node
 * 	ErrorNodes []*ast.Node
 * }
 */
export interface PseudoTypeInferred extends PseudoTypeBase {
  Expression: GoPtr<Node>;
  ErrorNodes: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeInferred","kind":"func","status":"implemented","sigHash":"c308eb2c68531c0b5146a5d93959fcd535c7fcb87a846f23d06292968676ce03","bodyHash":"42d14292a4414bf86816cc4f5d62c8d7472a35e12afbfb19f8108470da5fdadb"}
 *
 * Go source:
 * func NewPseudoTypeInferred(expr *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindInferred, &PseudoTypeInferred{Expression: expr})
 * }
 */
export function NewPseudoTypeInferred(expr: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeInferred = {} as PseudoTypeInferred;
  data.Expression = expr;
  data.ErrorNodes = [];
  return newPseudoType(PseudoTypeKindInferred, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeInferredWithErrors","kind":"func","status":"implemented","sigHash":"93ffed57eb52ac9810bc587f44aa2b63c8e9b2a857cf5f5bf138343ddc5d5404","bodyHash":"1d2b942e880c3e0c2330d0faf5f783f5825935aacd19af5cf37b4ff22e98458e"}
 *
 * Go source:
 * func NewPseudoTypeInferredWithErrors(expr *ast.Node, errorNodes []*ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindInferred, &PseudoTypeInferred{Expression: expr, ErrorNodes: errorNodes})
 * }
 */
export function NewPseudoTypeInferredWithErrors(expr: GoPtr<Node>, errorNodes: GoSlice<GoPtr<Node>>): GoPtr<PseudoType> {
  const data: PseudoTypeInferred = {} as PseudoTypeInferred;
  data.Expression = expr;
  data.ErrorNodes = errorNodes;
  return newPseudoType(PseudoTypeKindInferred, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeInferred","kind":"method","status":"implemented","sigHash":"d6ce33c3f721632e02c21d922f8b9fc44028e874434757b529332543a0644eda","bodyHash":"0869a7ad3d69b5979cf3929211498de12e92955d2fb44a6056c5b1cfcd0dbec2"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeInferred() *PseudoTypeInferred { return t.data.(*PseudoTypeInferred) }
 */
export function PseudoType_AsPseudoTypeInferred(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeInferred> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeInferred>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeNoResult","kind":"type","status":"implemented","sigHash":"c51fb71c7f2b31bca6147da3668e9c473fd04b311987dc060391e61a498eb57a","bodyHash":"4c146bb1507b20d73703e1d589db21dd1a38aa6cc6d2e45680cc83b452cf20bc"}
 *
 * Go source:
 * PseudoTypeNoResult struct {
 * 	PseudoTypeBase
 * 	Declaration *ast.Node
 * }
 */
export interface PseudoTypeNoResult extends PseudoTypeBase {
  Declaration: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeNoResult","kind":"func","status":"implemented","sigHash":"8770f7871ee64ee34131dc3b1ad2fbb44ac6b69cb3b0dac0ab1c75649c11c02c","bodyHash":"76c90498192dfbeaae04167b72888ece092332ed1c03b4c48e9cb68583d752c6"}
 *
 * Go source:
 * func NewPseudoTypeNoResult(decl *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindNoResult, &PseudoTypeNoResult{Declaration: decl})
 * }
 */
export function NewPseudoTypeNoResult(decl: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeNoResult = {} as PseudoTypeNoResult;
  data.Declaration = decl;
  return newPseudoType(PseudoTypeKindNoResult, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeNoResult","kind":"method","status":"implemented","sigHash":"19cb7e0addd374dfb96bc7e44b7bc70450c3ec5ff9c89adac3c50f1703e2dc9f","bodyHash":"939c5015bdd85a047498a05a5793b452ae7a353d03361097a25c2a3a65808897"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeNoResult() *PseudoTypeNoResult { return t.data.(*PseudoTypeNoResult) }
 */
export function PseudoType_AsPseudoTypeNoResult(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeNoResult> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeNoResult>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeMaybeConstLocation","kind":"type","status":"implemented","sigHash":"4de0021f15c651d22f0eff636df557dffff1083155899167cb9c8d2e2c0b068d","bodyHash":"64042e0ffa56ad3745214a05696d1ef7c2845c21ed3d21458f995ceb6258d637"}
 *
 * Go source:
 * PseudoTypeMaybeConstLocation struct {
 * 	PseudoTypeBase
 * 	Node        *ast.Node
 * 	ConstType   *PseudoType
 * 	RegularType *PseudoType
 * }
 */
export interface PseudoTypeMaybeConstLocation extends PseudoTypeBase {
  Node: GoPtr<Node>;
  ConstType: GoPtr<PseudoType>;
  RegularType: GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeMaybeConstLocation","kind":"func","status":"implemented","sigHash":"e6e5a9e0201ee743500520ed545c9b34338044297287a9fd12c4163df42a4a9e","bodyHash":"9e044980c9adaa5d83ddf669a9d9fde5a9fb6efcce7141a2cbdc9919db559c5f"}
 *
 * Go source:
 * func NewPseudoTypeMaybeConstLocation(loc *ast.Node, ct *PseudoType, reg *PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindMaybeConstLocation, &PseudoTypeMaybeConstLocation{Node: loc, ConstType: ct, RegularType: reg})
 * }
 */
export function NewPseudoTypeMaybeConstLocation(loc: GoPtr<Node>, ct: GoPtr<PseudoType>, reg: GoPtr<PseudoType>): GoPtr<PseudoType> {
  const data: PseudoTypeMaybeConstLocation = {} as PseudoTypeMaybeConstLocation;
  data.Node = loc;
  data.ConstType = ct;
  data.RegularType = reg;
  return newPseudoType(PseudoTypeKindMaybeConstLocation, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeMaybeConstLocation","kind":"method","status":"implemented","sigHash":"4db17c2a0690534ce5ff18c7e421934a6728e8b382f46622f18b5dcdeeb13263","bodyHash":"2a2c5568935b2db16b2d85aea3abc0c0e7068ebdbdb48811875d5ccc079d303f"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeMaybeConstLocation() *PseudoTypeMaybeConstLocation {
 * 	return t.data.(*PseudoTypeMaybeConstLocation)
 * }
 */
export function PseudoType_AsPseudoTypeMaybeConstLocation(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeMaybeConstLocation> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeMaybeConstLocation>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeUnion","kind":"type","status":"implemented","sigHash":"0cd318d18c24a1b756ef3fab59341dad85609ca775ed87ccb4263325d42ec96e","bodyHash":"117b65c5c6e44dbd460b6d14df45e4d2781bc90eed1368443b0a2b649be0f4b4"}
 *
 * Go source:
 * PseudoTypeUnion struct {
 * 	PseudoTypeBase
 * 	Types []*PseudoType
 * }
 */
export interface PseudoTypeUnion extends PseudoTypeBase {
  Types: GoSlice<GoPtr<PseudoType>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeUnion","kind":"func","status":"implemented","sigHash":"de6ab4aac9ebcffd68af6f3cc6d0f2227729776f4a21718e6c6d11c3f8101072","bodyHash":"e5539b9884ed81e9ec1cbb6d0088d8844bd1869f96889e7b929f478a4e677cae"}
 *
 * Go source:
 * func NewPseudoTypeUnion(types []*PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindUnion, &PseudoTypeUnion{Types: types})
 * }
 */
export function NewPseudoTypeUnion(types: GoSlice<GoPtr<PseudoType>>): GoPtr<PseudoType> {
  const data: PseudoTypeUnion = {} as PseudoTypeUnion;
  data.Types = types;
  return newPseudoType(PseudoTypeKindUnion, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeUnion","kind":"method","status":"implemented","sigHash":"e65d5369af0bd26c44e1d9c8aa480f537dd21b474186ac9931e57c033cecfac2","bodyHash":"6bfac71940b0dfb8507e8e818aa2ffe67e2cdbceecc3828bf1dd01f5d0263f14"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeUnion() *PseudoTypeUnion {
 * 	return t.data.(*PseudoTypeUnion)
 * }
 */
export function PseudoType_AsPseudoTypeUnion(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeUnion> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeUnion>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoParameter","kind":"type","status":"implemented","sigHash":"03a272d502e0e1f4907d96573da9916a949a08d89f9e71b35210044a907c4757","bodyHash":"fd76f136a736b61bfa1830bfec6933cbc2b446081db26a240c619d56dfc5b54d"}
 *
 * Go source:
 * PseudoParameter struct {
 * 	Rest     bool
 * 	Name     *ast.Node
 * 	Optional bool
 * 	Type     *PseudoType
 * }
 */
export interface PseudoParameter {
  Rest: bool;
  Name: GoPtr<Node>;
  Optional: bool;
  Type: GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoParameter","kind":"func","status":"implemented","sigHash":"e70b1452459e602c1ad05b197850cb9f5f2c6b853e955798da8c00d08d1dece4","bodyHash":"49cd8b1530f840321a0ac5499252f7d9532e744d6eb53ff7ba7cd76bb6775251"}
 *
 * Go source:
 * func NewPseudoParameter(isRest bool, name *ast.Node, isOptional bool, t *PseudoType) *PseudoParameter {
 * 	return &PseudoParameter{Rest: isRest, Name: name, Optional: isOptional, Type: t}
 * }
 */
export function NewPseudoParameter(isRest: bool, name: GoPtr<Node>, isOptional: bool, t: GoPtr<PseudoType>): GoPtr<PseudoParameter> {
  const p: PseudoParameter = {} as PseudoParameter;
  p.Rest = isRest;
  p.Name = name;
  p.Optional = isOptional;
  p.Type = t;
  return p;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeSingleCallSignature","kind":"type","status":"implemented","sigHash":"775f2de4e29f116615fc1c1c171970c39b83da346e1616266b17f7fc4eba9d95","bodyHash":"3ce2396888836fbe382731b72b91748a3ff04de62a654eea5385b50fc2f599ca"}
 *
 * Go source:
 * PseudoTypeSingleCallSignature struct {
 * 	PseudoTypeBase
 * 	Signature      *ast.Node
 * 	Parameters     []*PseudoParameter
 * 	TypeParameters []*ast.TypeParameterDeclaration
 * 	ReturnType     *PseudoType
 * }
 */
export interface PseudoTypeSingleCallSignature extends PseudoTypeBase {
  Signature: GoPtr<Node>;
  Parameters: GoSlice<GoPtr<PseudoParameter>>;
  TypeParameters: GoSlice<GoPtr<TypeParameterDeclaration>>;
  ReturnType: GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeSingleCallSignature","kind":"func","status":"implemented","sigHash":"2abedf8c133c6c73caf378944e9b8adcd0b498b912e72e13a5466ef5e0b4c101","bodyHash":"62eaaf89d44a16112cdce11c275e8f6e4aaab5661b2d35c2fd20e387e5059434"}
 *
 * Go source:
 * func NewPseudoTypeSingleCallSignature(signature *ast.Node, parameters []*PseudoParameter, typeParameters []*ast.TypeParameterDeclaration, returnType *PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindSingleCallSignature, &PseudoTypeSingleCallSignature{
 * 		Signature:      signature,
 * 		Parameters:     parameters,
 * 		TypeParameters: typeParameters,
 * 		ReturnType:     returnType,
 * 	})
 * }
 */
export function NewPseudoTypeSingleCallSignature(signature: GoPtr<Node>, parameters: GoSlice<GoPtr<PseudoParameter>>, typeParameters: GoSlice<GoPtr<TypeParameterDeclaration>>, returnType: GoPtr<PseudoType>): GoPtr<PseudoType> {
  const data: PseudoTypeSingleCallSignature = {} as PseudoTypeSingleCallSignature;
  data.Signature = signature;
  data.Parameters = parameters;
  data.TypeParameters = typeParameters;
  data.ReturnType = returnType;
  return newPseudoType(PseudoTypeKindSingleCallSignature, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeSingleCallSignature","kind":"method","status":"implemented","sigHash":"def5e52d01d21adfe7a1e04be55ba2c739aa7ca3a520a7e913a8407864a6624f","bodyHash":"96d2a297d9a568da44471e3a3da0a5c5f56d8244dda6769d13902720dace2ca5"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeSingleCallSignature() *PseudoTypeSingleCallSignature {
 * 	return t.data.(*PseudoTypeSingleCallSignature)
 * }
 */
export function PseudoType_AsPseudoTypeSingleCallSignature(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeSingleCallSignature> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeSingleCallSignature>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeTuple","kind":"type","status":"implemented","sigHash":"bbb542b2b6b3dfd068ad4f26267478d9f3c1e2733da7853563f661c9a789ee41","bodyHash":"90c646c52369ae3856d9f7194a347939e36f211ac782fb5e87939c28031fd27a"}
 *
 * Go source:
 * PseudoTypeTuple struct {
 * 	PseudoTypeBase
 * 	Elements []*PseudoType
 * }
 */
export interface PseudoTypeTuple extends PseudoTypeBase {
  Elements: GoSlice<GoPtr<PseudoType>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeTuple","kind":"func","status":"implemented","sigHash":"6fa3e50938e873fa47caa50fbfc649332b36af67255ef5c665f485af6d5b0e95","bodyHash":"776e9d757a9f1b600238aaf08fafdf34b6acce96747d632b42cb9526f3bb3f83"}
 *
 * Go source:
 * func NewPseudoTypeTuple(elements []*PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindTuple, &PseudoTypeTuple{
 * 		Elements: elements,
 * 	})
 * }
 */
export function NewPseudoTypeTuple(elements: GoSlice<GoPtr<PseudoType>>): GoPtr<PseudoType> {
  const data: PseudoTypeTuple = {} as PseudoTypeTuple;
  data.Elements = elements;
  return newPseudoType(PseudoTypeKindTuple, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeTuple","kind":"method","status":"implemented","sigHash":"c62bed03e8b6c1894a17357afc3adc9d160da81e2b9210275eb4cb6ba5a8d77c","bodyHash":"92e5e760027810207a70d69f0720efefc09d7d62ee34fe10a02c4e2ec479ced7"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeTuple() *PseudoTypeTuple {
 * 	return t.data.(*PseudoTypeTuple)
 * }
 */
export function PseudoType_AsPseudoTypeTuple(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeTuple> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeTuple>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoObjectElement","kind":"type","status":"implemented","sigHash":"3be03c8acb395c988719460d904575ff7f8360d6055d238b42f6e692a15894fa","bodyHash":"4153dfadbf73362865e4678a9a46658660250a48ef649604e6963c42525076b8"}
 *
 * Go source:
 * PseudoObjectElement struct {
 * 	Name     *ast.Node
 * 	Optional bool
 * 	Kind     PseudoObjectElementKind
 * 	data     pseudoObjectElementData
 * }
 */
export interface PseudoObjectElement {
  Name: GoPtr<Node>;
  Optional: bool;
  Kind: PseudoObjectElementKind;
  data: pseudoObjectElementData;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoObjectElement","kind":"method","status":"implemented","sigHash":"10008f09a79768de8bbf886c04a1ba2d2272b2b1515534af4952fa34a2d56013","bodyHash":"d6d218502f64608bc3ee749407a19701100ebc3fc2919684b0520c9b22382ef6"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoObjectElement() *PseudoObjectElement { return e }
 */
export function PseudoObjectElement_AsPseudoObjectElement(receiver: GoPtr<PseudoObjectElement>): GoPtr<PseudoObjectElement> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.Signature","kind":"method","status":"implemented","sigHash":"51a66c9519792b70164ec6c8be6c6970224e6c70b302e51b4a0113676d26b02f","bodyHash":"a44e6a35b6009c3f57eeecab104bf6bca9eebb9a4a1b1127175ee83cf25e071c"}
 *
 * Go source:
 * func (e *PseudoObjectElement) Signature() *ast.Node {
 * 	switch e.Kind {
 * 	case PseudoObjectElementKindMethod:
 * 		return e.AsPseudoObjectMethod().Signature
 * 	case PseudoObjectElementKindSetAccessor:
 * 		return e.AsPseudoSetAccessor().Signature
 * 	case PseudoObjectElementKindGetAccessor:
 * 		return e.AsPseudoGetAccessor().Signature
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function PseudoObjectElement_Signature(receiver: GoPtr<PseudoObjectElement>): GoPtr<Node> {
  switch (receiver!.Kind) {
    case PseudoObjectElementKindMethod:
      return PseudoObjectElement_AsPseudoObjectMethod(receiver)!.Signature;
    case PseudoObjectElementKindSetAccessor:
      return PseudoObjectElement_AsPseudoSetAccessor(receiver)!.Signature;
    case PseudoObjectElementKindGetAccessor:
      return PseudoObjectElement_AsPseudoGetAccessor(receiver)!.Signature;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoObjectElementKind","kind":"type","status":"implemented","sigHash":"75fa05afc2d3767bfcc7613cbe93a77242d6c585729db45c13222b50689c0052","bodyHash":"0fa05fdb4aeebda24017a3a78b0b5205767da699aba2e87d218db8d41b02890b"}
 *
 * Go source:
 * PseudoObjectElementKind int8
 */
export type PseudoObjectElementKind = sbyte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::constGroup::PseudoObjectElementKindMethod+PseudoObjectElementKindPropertyAssignment+PseudoObjectElementKindSetAccessor+PseudoObjectElementKindGetAccessor","kind":"constGroup","status":"implemented","sigHash":"11b5fed49449b1c3353cd98a149d3acb9c29087bcf3a787152ab4c66ff197323","bodyHash":"f6616a692039fe1d0e4936408f7be11931171b85bdbb5d8a3eab8301a35b5542"}
 *
 * Go source:
 * const (
 * 	PseudoObjectElementKindMethod PseudoObjectElementKind = iota
 * 	PseudoObjectElementKindPropertyAssignment
 * 	PseudoObjectElementKindSetAccessor
 * 	PseudoObjectElementKindGetAccessor
 * )
 */
export const PseudoObjectElementKindMethod: PseudoObjectElementKind = 0 as sbyte;
export const PseudoObjectElementKindPropertyAssignment: PseudoObjectElementKind = 1 as sbyte;
export const PseudoObjectElementKindSetAccessor: PseudoObjectElementKind = 2 as sbyte;
export const PseudoObjectElementKindGetAccessor: PseudoObjectElementKind = 3 as sbyte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::pseudoObjectElementData","kind":"type","status":"implemented","sigHash":"84e8709d8b6cabad9571818ae09e4abde1d5cb6e5f91f2e02156cfbb01d1e59d","bodyHash":"229775d39ea08f6de3e31abb27d1516b249b0d4cc805c244b676526cf84cf8b3"}
 *
 * Go source:
 * pseudoObjectElementData interface {
 * 	AsPseudoObjectElement() *PseudoObjectElement
 * }
 */
export interface pseudoObjectElementData extends GoInterfaceValue<unknown> {
  AsPseudoObjectElement(): GoPtr<PseudoObjectElement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::newPseudoObjectElement","kind":"func","status":"implemented","sigHash":"f0e107343c492c6c34aa73673ce8ed9ade0be7af61b460c8999c3d562d4159d9","bodyHash":"572f29c95f0c0c8ea219baeeaa410e8687c508e87103c6a37333767cc0c18035"}
 *
 * Go source:
 * func newPseudoObjectElement(kind PseudoObjectElementKind, name *ast.Node, optional bool, data pseudoObjectElementData) *PseudoObjectElement {
 * 	e := data.AsPseudoObjectElement()
 * 	e.Kind = kind
 * 	e.Name = name
 * 	e.Optional = optional
 * 	e.data = data
 * 	return e
 * }
 */
export function newPseudoObjectElement(kind: PseudoObjectElementKind, name: GoPtr<Node>, optional: bool, data: pseudoObjectElementData): GoPtr<PseudoObjectElement> {
  const e = data.AsPseudoObjectElement();
  e!.Kind = kind;
  e!.Name = name;
  e!.Optional = optional;
  e!.data = data;
  return e;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoObjectMethod","kind":"type","status":"implemented","sigHash":"d0fe35a7f1a42d882d60e8b9c18733821e8d8a5a7fadce7e10f71a2cfd912166","bodyHash":"63ef8f7bddd89c7996cdd5aeb98a7121072de02865103788db0936b96fdf5de0"}
 *
 * Go source:
 * PseudoObjectMethod struct {
 * 	PseudoObjectElement
 * 	Signature      *ast.Node
 * 	TypeParameters []*ast.TypeParameterDeclaration
 * 	Parameters     []*PseudoParameter
 * 	ReturnType     *PseudoType
 * }
 */
export interface PseudoObjectMethod extends PseudoObjectElement {
  Signature: GoPtr<Node>;
  TypeParameters: GoSlice<GoPtr<TypeParameterDeclaration>>;
  Parameters: GoSlice<GoPtr<PseudoParameter>>;
  ReturnType: GoPtr<PseudoType>;
}

// Interface satisfaction: a concrete pseudo-object element (`PseudoObjectMethod`,
// `PseudoPropertyAssignment`, ...) satisfies `pseudoObjectElementData`. The
// concrete struct object IS the embedded `PseudoObjectElement` (flattened
// embedding), so `AsPseudoObjectElement()` returns the receiver itself (Go
// `return e`). The `goReceiverKey` brand carries the concrete receiver for the
// later `e.data.(*Concrete)` type assertions.
export function PseudoObjectElement_as_pseudoObjectElementData(receiver: GoPtr<PseudoObjectElement>): pseudoObjectElementData {
  return {
    [goReceiverKey]: receiver,
    AsPseudoObjectElement: (): GoPtr<PseudoObjectElement> => PseudoObjectElement_AsPseudoObjectElement(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoObjectMethod","kind":"func","status":"implemented","sigHash":"4092aed378242a1721e69c31e61f26bc57300a152f5eddf0445fba25f94da1d7","bodyHash":"7739722fd8ab72e7679b04edce45a675feab387f531cb00121f537b99f161b6f"}
 *
 * Go source:
 * func NewPseudoObjectMethod(signature *ast.Node, name *ast.Node, optional bool, typeParameters []*ast.TypeParameterDeclaration, parameters []*PseudoParameter, returnType *PseudoType) *PseudoObjectElement {
 * 	return newPseudoObjectElement(PseudoObjectElementKindMethod, name, optional, &PseudoObjectMethod{
 * 		Signature:      signature,
 * 		TypeParameters: typeParameters,
 * 		Parameters:     parameters,
 * 		ReturnType:     returnType,
 * 	})
 * }
 */
export function NewPseudoObjectMethod(signature: GoPtr<Node>, name: GoPtr<Node>, optional: bool, typeParameters: GoSlice<GoPtr<TypeParameterDeclaration>>, parameters: GoSlice<GoPtr<PseudoParameter>>, returnType: GoPtr<PseudoType>): GoPtr<PseudoObjectElement> {
  const data: PseudoObjectMethod = {} as PseudoObjectMethod;
  data.Signature = signature;
  data.TypeParameters = typeParameters;
  data.Parameters = parameters;
  data.ReturnType = returnType;
  return newPseudoObjectElement(PseudoObjectElementKindMethod, name, optional, PseudoObjectElement_as_pseudoObjectElementData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoObjectMethod","kind":"method","status":"implemented","sigHash":"fc792984f9e713e6e1b4c20916e0979697d4768803474e193d2be60ae9c6247a","bodyHash":"c13003b8f1f5f2739a5b4d08581ad6da3a2093f31ca99254ad31ef12b7d62fda"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoObjectMethod() *PseudoObjectMethod {
 * 	return e.data.(*PseudoObjectMethod)
 * }
 */
export function PseudoObjectElement_AsPseudoObjectMethod(receiver: GoPtr<PseudoObjectElement>): GoPtr<PseudoObjectMethod> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoObjectMethod>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoPropertyAssignment","kind":"type","status":"implemented","sigHash":"d0cdd2f2d04e8482935967a49d0964636327a6e29bf586079a237a732163ef2a","bodyHash":"0bb016d7b3a582bff44e4777e81fbf94f54b50ab5f824c1bed0a29a7d2b5a5d0"}
 *
 * Go source:
 * PseudoPropertyAssignment struct {
 * 	PseudoObjectElement
 * 	Readonly bool
 * 	Type     *PseudoType
 * }
 */
export interface PseudoPropertyAssignment extends PseudoObjectElement {
  Readonly: bool;
  Type: GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoPropertyAssignment","kind":"func","status":"implemented","sigHash":"a10ea7d043613ca66ab2d1247149632eedb080a95eab4bfdbb80462f032737ea","bodyHash":"7d639c1cc858df0f005cf1e420b84719ab0858062ebafb99303b6e4548990c06"}
 *
 * Go source:
 * func NewPseudoPropertyAssignment(readonly bool, name *ast.Node, optional bool, t *PseudoType) *PseudoObjectElement {
 * 	return newPseudoObjectElement(PseudoObjectElementKindPropertyAssignment, name, optional, &PseudoPropertyAssignment{
 * 		Readonly: readonly,
 * 		Type:     t,
 * 	})
 * }
 */
export function NewPseudoPropertyAssignment(readonly: bool, name: GoPtr<Node>, optional: bool, t: GoPtr<PseudoType>): GoPtr<PseudoObjectElement> {
  const data: PseudoPropertyAssignment = {} as PseudoPropertyAssignment;
  data.Readonly = readonly;
  data.Type = t;
  return newPseudoObjectElement(PseudoObjectElementKindPropertyAssignment, name, optional, PseudoObjectElement_as_pseudoObjectElementData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoPropertyAssignment","kind":"method","status":"implemented","sigHash":"b87e9c790573378347cb63043fab48747ba7bb90f7e88570fc0e18e44ca58524","bodyHash":"bd67936aba50c0eb378765693938053d9b25ff2f8d1e5971df09c35f7fc9a535"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoPropertyAssignment() *PseudoPropertyAssignment {
 * 	return e.data.(*PseudoPropertyAssignment)
 * }
 */
export function PseudoObjectElement_AsPseudoPropertyAssignment(receiver: GoPtr<PseudoObjectElement>): GoPtr<PseudoPropertyAssignment> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoPropertyAssignment>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoSetAccessor","kind":"type","status":"implemented","sigHash":"7f3dd71422cb6536e625c46cbf64c0a616d2d7942d9e679a0b26a488d9329ba2","bodyHash":"b5f44b6e0a864c36a58e8d3ebcbcc86804c53ceb0895e782fb66c1535c584aa5"}
 *
 * Go source:
 * PseudoSetAccessor struct {
 * 	PseudoObjectElement
 * 	Signature *ast.Node
 * 	Parameter *PseudoParameter
 * }
 */
export interface PseudoSetAccessor extends PseudoObjectElement {
  Signature: GoPtr<Node>;
  Parameter: GoPtr<PseudoParameter>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoSetAccessor","kind":"func","status":"implemented","sigHash":"311b865fccdb4cea34e429bfad8b8a428c0ab2e5323481cc22efb3fcdad047af","bodyHash":"3e8d088b2c7bcb817f25b96c224e4b2b77e24581f9a6bcdb24691d0ab5384619"}
 *
 * Go source:
 * func NewPseudoSetAccessor(signature *ast.Node, name *ast.Node, optional bool, p *PseudoParameter) *PseudoObjectElement {
 * 	return newPseudoObjectElement(PseudoObjectElementKindSetAccessor, name, optional, &PseudoSetAccessor{
 * 		Signature: signature,
 * 		Parameter: p,
 * 	})
 * }
 */
export function NewPseudoSetAccessor(signature: GoPtr<Node>, name: GoPtr<Node>, optional: bool, p: GoPtr<PseudoParameter>): GoPtr<PseudoObjectElement> {
  const data: PseudoSetAccessor = {} as PseudoSetAccessor;
  data.Signature = signature;
  data.Parameter = p;
  return newPseudoObjectElement(PseudoObjectElementKindSetAccessor, name, optional, PseudoObjectElement_as_pseudoObjectElementData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoSetAccessor","kind":"method","status":"implemented","sigHash":"4b66eec659dac5fbfb7b0c86078729b63354640371499fc8e21784f6ed7f825b","bodyHash":"e403e5644d4a2a7d1d6ae3b9417b1565c2025d83155a5c05a031e57f32d0224c"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoSetAccessor() *PseudoSetAccessor {
 * 	return e.data.(*PseudoSetAccessor)
 * }
 */
export function PseudoObjectElement_AsPseudoSetAccessor(receiver: GoPtr<PseudoObjectElement>): GoPtr<PseudoSetAccessor> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoSetAccessor>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoGetAccessor","kind":"type","status":"implemented","sigHash":"d4f320ef34206fcfacebead68ec7ab319c1bc26ee7f0146aca5392dce97d9805","bodyHash":"7f0a57dcb2a4e5d3b2985ef8a5a6613426365ac7d9719541722951117ff52547"}
 *
 * Go source:
 * PseudoGetAccessor struct {
 * 	PseudoObjectElement
 * 	Signature *ast.Node
 * 	Type      *PseudoType
 * }
 */
export interface PseudoGetAccessor extends PseudoObjectElement {
  Signature: GoPtr<Node>;
  Type: GoPtr<PseudoType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoGetAccessor","kind":"func","status":"implemented","sigHash":"f32e9241b76a4babc1be01a79d00b857fb6b70e2ed7edbab7f810f50e5d7c02d","bodyHash":"a0943bd4af555ea3b5d7949c5bef6827d09168b0058fe14d588fc89cd4c861b5"}
 *
 * Go source:
 * func NewPseudoGetAccessor(signature *ast.Node, name *ast.Node, optional bool, t *PseudoType) *PseudoObjectElement {
 * 	return newPseudoObjectElement(PseudoObjectElementKindGetAccessor, name, optional, &PseudoGetAccessor{
 * 		Signature: signature,
 * 		Type:      t,
 * 	})
 * }
 */
export function NewPseudoGetAccessor(signature: GoPtr<Node>, name: GoPtr<Node>, optional: bool, t: GoPtr<PseudoType>): GoPtr<PseudoObjectElement> {
  const data: PseudoGetAccessor = {} as PseudoGetAccessor;
  data.Signature = signature;
  data.Type = t;
  return newPseudoObjectElement(PseudoObjectElementKindGetAccessor, name, optional, PseudoObjectElement_as_pseudoObjectElementData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoGetAccessor","kind":"method","status":"implemented","sigHash":"2b9ec410608d40d8cf7cc5397fa3bf4ccc6002269625cb1bab730e51ec40a3d9","bodyHash":"da36de3ea519c347f15e3099fa9c6d386d739e441d432fc5d5f96eb15983f082"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoGetAccessor() *PseudoGetAccessor {
 * 	return e.data.(*PseudoGetAccessor)
 * }
 */
export function PseudoObjectElement_AsPseudoGetAccessor(receiver: GoPtr<PseudoObjectElement>): GoPtr<PseudoGetAccessor> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoGetAccessor>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeObjectLiteral","kind":"type","status":"implemented","sigHash":"377feff4ba5a4d2e5aa6dff27036c4793af1a5e8995e77196469ff2607e8fc66","bodyHash":"6957b55584177826bf7cd76ae4e2a51550593f7eb56b64c6449b757b501ab941"}
 *
 * Go source:
 * PseudoTypeObjectLiteral struct {
 * 	PseudoTypeBase
 * 	Elements []*PseudoObjectElement
 * }
 */
export interface PseudoTypeObjectLiteral extends PseudoTypeBase {
  Elements: GoSlice<GoPtr<PseudoObjectElement>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeObjectLiteral","kind":"func","status":"implemented","sigHash":"3e3857fc04138ddb4d59be4d4dfb16bf1545a07d23f2be7592f7e453c79b4532","bodyHash":"ffdea726db08662fae89552c6d67c2fb0a48221c0d03ac827acc639a68f58b21"}
 *
 * Go source:
 * func NewPseudoTypeObjectLiteral(elements []*PseudoObjectElement) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindObjectLiteral, &PseudoTypeObjectLiteral{
 * 		Elements: elements,
 * 	})
 * }
 */
export function NewPseudoTypeObjectLiteral(elements: GoSlice<GoPtr<PseudoObjectElement>>): GoPtr<PseudoType> {
  const data: PseudoTypeObjectLiteral = {} as PseudoTypeObjectLiteral;
  data.Elements = elements;
  return newPseudoType(PseudoTypeKindObjectLiteral, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeObjectLiteral","kind":"method","status":"implemented","sigHash":"57483ad46767b822fd64f439275ad6d8c4208ac05481fea2609524e95b9cc069","bodyHash":"e01e71a14945ca5bdb07e7e424ff2b5b979c908ea8fee731ee11f17760b36441"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeObjectLiteral() *PseudoTypeObjectLiteral {
 * 	return t.data.(*PseudoTypeObjectLiteral)
 * }
 */
export function PseudoType_AsPseudoTypeObjectLiteral(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeObjectLiteral> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeObjectLiteral>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::type::PseudoTypeLiteral","kind":"type","status":"implemented","sigHash":"1891f91bef35d921093d3b033c48712e9288733839473a73fa9018c89f91217e","bodyHash":"638149efffcd33a0fa9b37731f2a8ad720e3ef130762338f77470437bad3e04c"}
 *
 * Go source:
 * PseudoTypeLiteral struct {
 * 	PseudoTypeBase
 * 	Node *ast.Node
 * }
 */
export interface PseudoTypeLiteral extends PseudoTypeBase {
  Node: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeStringLiteral","kind":"func","status":"implemented","sigHash":"419092da265483021824191954ffee2b51e84ddedc232855137a729bdb37585f","bodyHash":"62402398dd1e1476b88a2953b0a580953d84125586e893ad962a7d74779e2148"}
 *
 * Go source:
 * func NewPseudoTypeStringLiteral(node *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindStringLiteral, &PseudoTypeLiteral{
 * 		Node: node,
 * 	})
 * }
 */
export function NewPseudoTypeStringLiteral(node: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeLiteral = {} as PseudoTypeLiteral;
  data.Node = node;
  return newPseudoType(PseudoTypeKindStringLiteral, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeNumericLiteral","kind":"func","status":"implemented","sigHash":"eebe3f19a120c5c41d057c36530fb954edd604f80e58b795c305893ba418487e","bodyHash":"a4b57306df53c9ceee38d28325e8006618e27075435521b2983efe68143f27ee"}
 *
 * Go source:
 * func NewPseudoTypeNumericLiteral(node *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindNumericLiteral, &PseudoTypeLiteral{
 * 		Node: node,
 * 	})
 * }
 */
export function NewPseudoTypeNumericLiteral(node: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeLiteral = {} as PseudoTypeLiteral;
  data.Node = node;
  return newPseudoType(PseudoTypeKindNumericLiteral, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeBigIntLiteral","kind":"func","status":"implemented","sigHash":"ff6c17add5f3c1f9949d0fda4720d1c2a0e6cae945284e71bfcab7f64790f49b","bodyHash":"c4d12478d5ab9a7f6d67749299af8299003cf99df0267c5c873a55ce393cb81f"}
 *
 * Go source:
 * func NewPseudoTypeBigIntLiteral(node *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindBigIntLiteral, &PseudoTypeLiteral{
 * 		Node: node,
 * 	})
 * }
 */
export function NewPseudoTypeBigIntLiteral(node: GoPtr<Node>): GoPtr<PseudoType> {
  const data: PseudoTypeLiteral = {} as PseudoTypeLiteral;
  data.Node = node;
  return newPseudoType(PseudoTypeKindBigIntLiteral, PseudoTypeBase_as_pseudoTypeData(data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeLiteral","kind":"method","status":"implemented","sigHash":"d653a6c89a059518945ee573aed54cedbbf8a37912edb4e4ab44ca0c830ef253","bodyHash":"bc1d132c0b1611d8c7a377d998203be4906ff06ff3270c13b1adeaf8273ed3bf"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeLiteral() *PseudoTypeLiteral {
 * 	return t.data.(*PseudoTypeLiteral)
 * }
 */
export function PseudoType_AsPseudoTypeLiteral(receiver: GoPtr<PseudoType>): GoPtr<PseudoTypeLiteral> {
  return receiver!.data[goReceiverKey] as GoPtr<PseudoTypeLiteral>;
}

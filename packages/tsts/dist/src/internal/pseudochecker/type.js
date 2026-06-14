import { goReceiverKey } from "../ast/spine.js";
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
export const PseudoTypeKindDirect = 0;
export const PseudoTypeKindInferred = 1;
export const PseudoTypeKindNoResult = 2;
export const PseudoTypeKindMaybeConstLocation = 3;
export const PseudoTypeKindUnion = 4;
export const PseudoTypeKindUndefined = 5;
export const PseudoTypeKindNull = 6;
export const PseudoTypeKindAny = 7;
export const PseudoTypeKindString = 8;
export const PseudoTypeKindNumber = 9;
export const PseudoTypeKindBigInt = 10;
export const PseudoTypeKindBoolean = 11;
export const PseudoTypeKindFalse = 12;
export const PseudoTypeKindTrue = 13;
export const PseudoTypeKindSingleCallSignature = 14;
export const PseudoTypeKindTuple = 15;
export const PseudoTypeKindObjectLiteral = 16;
export const PseudoTypeKindStringLiteral = 17;
export const PseudoTypeKindNumericLiteral = 18;
export const PseudoTypeKindBigIntLiteral = 19;
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
export function newPseudoType(kind, data) {
    const n = data.AsPseudoType();
    n.Kind = kind;
    n.data = data;
    return n;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoTypeDefault.AsPseudoType","kind":"method","status":"implemented","sigHash":"2c795a57812741a4cd0e11255d67dd53d932fab81b07c379ef9bc28152a500eb","bodyHash":"70f80d6aa65c35ea1a14ce30f0d7d9ec5649560b968f06400c448201b56329ee"}
 *
 * Go source:
 * func (b *PseudoTypeDefault) AsPseudoType() *PseudoType { return &b.PseudoType }
 */
export function PseudoTypeDefault_AsPseudoType(receiver) {
    return receiver;
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
export const PseudoTypeUndefined = newPseudoType(PseudoTypeKindUndefined, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeNull = newPseudoType(PseudoTypeKindNull, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeAny = newPseudoType(PseudoTypeKindAny, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeString = newPseudoType(PseudoTypeKindString, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeNumber = newPseudoType(PseudoTypeKindNumber, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeBigInt = newPseudoType(PseudoTypeKindBigInt, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeBoolean = newPseudoType(PseudoTypeKindBoolean, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeFalse = newPseudoType(PseudoTypeKindFalse, PseudoTypeBase_as_pseudoTypeData({}));
export const PseudoTypeTrue = newPseudoType(PseudoTypeKindTrue, PseudoTypeBase_as_pseudoTypeData({}));
// Interface satisfaction: a `*PseudoTypeBase`/concrete pseudo-type satisfies
// `pseudoTypeData`. The concrete struct object IS the embedded `PseudoType`
// (flattened embedding), so `AsPseudoType()` returns the receiver itself
// (Go `return &b.PseudoType`). The `goReceiverKey` brand carries the concrete
// receiver for the later `t.data.(*Concrete)` type assertions.
export function PseudoTypeBase_as_pseudoTypeData(receiver) {
    return {
        [goReceiverKey]: receiver,
        AsPseudoType: () => PseudoTypeDefault_AsPseudoType(receiver),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeDirect","kind":"func","status":"implemented","sigHash":"e97af9665f64edefbf10bec7ef1a35f59be09f8aa40bdb4e37ddc9bc154aa4d1","bodyHash":"1322bad7a6d971411b4cb151b5b79f69934c6232c758a393d9aebf6008228caa"}
 *
 * Go source:
 * func NewPseudoTypeDirect(typeNode *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindDirect, &PseudoTypeDirect{TypeNode: typeNode})
 * }
 */
export function NewPseudoTypeDirect(typeNode) {
    const data = {};
    data.TypeNode = typeNode;
    return newPseudoType(PseudoTypeKindDirect, PseudoTypeBase_as_pseudoTypeData(data));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeDirect","kind":"method","status":"implemented","sigHash":"b51343bf9272b1e25ae87737e43780d561b06bc85bda9114878b480849367f46","bodyHash":"dad56f2149a510d71cfaa05c2deedb4cfe200ef788ae6f3270e3d00f1ace3d21"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeDirect() *PseudoTypeDirect { return t.data.(*PseudoTypeDirect) }
 */
export function PseudoType_AsPseudoTypeDirect(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeInferred","kind":"func","status":"implemented","sigHash":"c308eb2c68531c0b5146a5d93959fcd535c7fcb87a846f23d06292968676ce03","bodyHash":"42d14292a4414bf86816cc4f5d62c8d7472a35e12afbfb19f8108470da5fdadb"}
 *
 * Go source:
 * func NewPseudoTypeInferred(expr *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindInferred, &PseudoTypeInferred{Expression: expr})
 * }
 */
export function NewPseudoTypeInferred(expr) {
    const data = {};
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
export function NewPseudoTypeInferredWithErrors(expr, errorNodes) {
    const data = {};
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
export function PseudoType_AsPseudoTypeInferred(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeNoResult","kind":"func","status":"implemented","sigHash":"8770f7871ee64ee34131dc3b1ad2fbb44ac6b69cb3b0dac0ab1c75649c11c02c","bodyHash":"76c90498192dfbeaae04167b72888ece092332ed1c03b4c48e9cb68583d752c6"}
 *
 * Go source:
 * func NewPseudoTypeNoResult(decl *ast.Node) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindNoResult, &PseudoTypeNoResult{Declaration: decl})
 * }
 */
export function NewPseudoTypeNoResult(decl) {
    const data = {};
    data.Declaration = decl;
    return newPseudoType(PseudoTypeKindNoResult, PseudoTypeBase_as_pseudoTypeData(data));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoType.AsPseudoTypeNoResult","kind":"method","status":"implemented","sigHash":"19cb7e0addd374dfb96bc7e44b7bc70450c3ec5ff9c89adac3c50f1703e2dc9f","bodyHash":"939c5015bdd85a047498a05a5793b452ae7a353d03361097a25c2a3a65808897"}
 *
 * Go source:
 * func (t *PseudoType) AsPseudoTypeNoResult() *PseudoTypeNoResult { return t.data.(*PseudoTypeNoResult) }
 */
export function PseudoType_AsPseudoTypeNoResult(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeMaybeConstLocation","kind":"func","status":"implemented","sigHash":"e6e5a9e0201ee743500520ed545c9b34338044297287a9fd12c4163df42a4a9e","bodyHash":"9e044980c9adaa5d83ddf669a9d9fde5a9fb6efcce7141a2cbdc9919db559c5f"}
 *
 * Go source:
 * func NewPseudoTypeMaybeConstLocation(loc *ast.Node, ct *PseudoType, reg *PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindMaybeConstLocation, &PseudoTypeMaybeConstLocation{Node: loc, ConstType: ct, RegularType: reg})
 * }
 */
export function NewPseudoTypeMaybeConstLocation(loc, ct, reg) {
    const data = {};
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
export function PseudoType_AsPseudoTypeMaybeConstLocation(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoTypeUnion","kind":"func","status":"implemented","sigHash":"de6ab4aac9ebcffd68af6f3cc6d0f2227729776f4a21718e6c6d11c3f8101072","bodyHash":"e5539b9884ed81e9ec1cbb6d0088d8844bd1869f96889e7b929f478a4e677cae"}
 *
 * Go source:
 * func NewPseudoTypeUnion(types []*PseudoType) *PseudoType {
 * 	return newPseudoType(PseudoTypeKindUnion, &PseudoTypeUnion{Types: types})
 * }
 */
export function NewPseudoTypeUnion(types) {
    const data = {};
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
export function PseudoType_AsPseudoTypeUnion(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::func::NewPseudoParameter","kind":"func","status":"implemented","sigHash":"e70b1452459e602c1ad05b197850cb9f5f2c6b853e955798da8c00d08d1dece4","bodyHash":"49cd8b1530f840321a0ac5499252f7d9532e744d6eb53ff7ba7cd76bb6775251"}
 *
 * Go source:
 * func NewPseudoParameter(isRest bool, name *ast.Node, isOptional bool, t *PseudoType) *PseudoParameter {
 * 	return &PseudoParameter{Rest: isRest, Name: name, Optional: isOptional, Type: t}
 * }
 */
export function NewPseudoParameter(isRest, name, isOptional, t) {
    const p = {};
    p.Rest = isRest;
    p.Name = name;
    p.Optional = isOptional;
    p.Type = t;
    return p;
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
export function NewPseudoTypeSingleCallSignature(signature, parameters, typeParameters, returnType) {
    const data = {};
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
export function PseudoType_AsPseudoTypeSingleCallSignature(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoTypeTuple(elements) {
    const data = {};
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
export function PseudoType_AsPseudoTypeTuple(receiver) {
    return receiver.data[goReceiverKey];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/type.go::method::PseudoObjectElement.AsPseudoObjectElement","kind":"method","status":"implemented","sigHash":"10008f09a79768de8bbf886c04a1ba2d2272b2b1515534af4952fa34a2d56013","bodyHash":"d6d218502f64608bc3ee749407a19701100ebc3fc2919684b0520c9b22382ef6"}
 *
 * Go source:
 * func (e *PseudoObjectElement) AsPseudoObjectElement() *PseudoObjectElement { return e }
 */
export function PseudoObjectElement_AsPseudoObjectElement(receiver) {
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
export function PseudoObjectElement_Signature(receiver) {
    switch (receiver.Kind) {
        case PseudoObjectElementKindMethod:
            return PseudoObjectElement_AsPseudoObjectMethod(receiver).Signature;
        case PseudoObjectElementKindSetAccessor:
            return PseudoObjectElement_AsPseudoSetAccessor(receiver).Signature;
        case PseudoObjectElementKindGetAccessor:
            return PseudoObjectElement_AsPseudoGetAccessor(receiver).Signature;
        default:
            return undefined;
    }
}
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
export const PseudoObjectElementKindMethod = 0;
export const PseudoObjectElementKindPropertyAssignment = 1;
export const PseudoObjectElementKindSetAccessor = 2;
export const PseudoObjectElementKindGetAccessor = 3;
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
export function newPseudoObjectElement(kind, name, optional, data) {
    const e = data.AsPseudoObjectElement();
    e.Kind = kind;
    e.Name = name;
    e.Optional = optional;
    e.data = data;
    return e;
}
// Interface satisfaction: a concrete pseudo-object element (`PseudoObjectMethod`,
// `PseudoPropertyAssignment`, ...) satisfies `pseudoObjectElementData`. The
// concrete struct object IS the embedded `PseudoObjectElement` (flattened
// embedding), so `AsPseudoObjectElement()` returns the receiver itself (Go
// `return e`). The `goReceiverKey` brand carries the concrete receiver for the
// later `e.data.(*Concrete)` type assertions.
export function PseudoObjectElement_as_pseudoObjectElementData(receiver) {
    return {
        [goReceiverKey]: receiver,
        AsPseudoObjectElement: () => PseudoObjectElement_AsPseudoObjectElement(receiver),
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
export function NewPseudoObjectMethod(signature, name, optional, typeParameters, parameters, returnType) {
    const data = {};
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
export function PseudoObjectElement_AsPseudoObjectMethod(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoPropertyAssignment(readonly, name, optional, t) {
    const data = {};
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
export function PseudoObjectElement_AsPseudoPropertyAssignment(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoSetAccessor(signature, name, optional, p) {
    const data = {};
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
export function PseudoObjectElement_AsPseudoSetAccessor(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoGetAccessor(signature, name, optional, t) {
    const data = {};
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
export function PseudoObjectElement_AsPseudoGetAccessor(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoTypeObjectLiteral(elements) {
    const data = {};
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
export function PseudoType_AsPseudoTypeObjectLiteral(receiver) {
    return receiver.data[goReceiverKey];
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
export function NewPseudoTypeStringLiteral(node) {
    const data = {};
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
export function NewPseudoTypeNumericLiteral(node) {
    const data = {};
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
export function NewPseudoTypeBigIntLiteral(node) {
    const data = {};
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
export function PseudoType_AsPseudoTypeLiteral(receiver) {
    return receiver.data[goReceiverKey];
}
//# sourceMappingURL=type.js.map
export function reacquireBuiltinType(producer, type) {
    const source = type.checker;
    if (source === undefined)
        throw new TypeError("A native type construction requires its actual producer");
    if (type === source.anyType)
        return producer.anyType;
    if (type === source.autoType)
        return producer.autoType;
    if (type === source.wildcardType)
        return producer.wildcardType;
    if (type === source.blockedStringType)
        return producer.blockedStringType;
    if (type === source.errorType)
        return producer.errorType;
    if (type === source.unresolvedType)
        return producer.unresolvedType;
    if (type === source.nonInferrableAnyType)
        return producer.nonInferrableAnyType;
    if (type === source.intrinsicMarkerType)
        return producer.intrinsicMarkerType;
    if (type === source.unknownType)
        return producer.unknownType;
    if (type === source.undefinedType)
        return producer.undefinedType;
    if (type === source.undefinedWideningType)
        return producer.undefinedWideningType;
    if (type === source.missingType)
        return producer.missingType;
    if (type === source.undefinedOrMissingType)
        return producer.undefinedOrMissingType;
    if (type === source.optionalType)
        return producer.optionalType;
    if (type === source.nullType)
        return producer.nullType;
    if (type === source.nullWideningType)
        return producer.nullWideningType;
    if (type === source.stringType)
        return producer.stringType;
    if (type === source.numberType)
        return producer.numberType;
    if (type === source.bigintType)
        return producer.bigintType;
    if (type === source.regularFalseType)
        return producer.regularFalseType;
    if (type === source.falseType)
        return producer.falseType;
    if (type === source.regularTrueType)
        return producer.regularTrueType;
    if (type === source.trueType)
        return producer.trueType;
    if (type === source.booleanType)
        return producer.booleanType;
    if (type === source.esSymbolType)
        return producer.esSymbolType;
    if (type === source.voidType)
        return producer.voidType;
    if (type === source.neverType)
        return producer.neverType;
    if (type === source.silentNeverType)
        return producer.silentNeverType;
    if (type === source.implicitNeverType)
        return producer.implicitNeverType;
    if (type === source.unreachableNeverType)
        return producer.unreachableNeverType;
    if (type === source.nonPrimitiveType)
        return producer.nonPrimitiveType;
    if (type === source.stringOrNumberType)
        return producer.stringOrNumberType;
    if (type === source.stringNumberSymbolType)
        return producer.stringNumberSymbolType;
    if (type === source.numberOrBigIntType)
        return producer.numberOrBigIntType;
    if (type === source.numericStringType)
        return producer.numericStringType;
    if (type === source.templateConstraintType)
        return producer.templateConstraintType;
    if (type === source.uniqueLiteralType)
        return producer.uniqueLiteralType;
    if (type === source.emptyObjectType)
        return producer.emptyObjectType;
    if (type === source.emptyJsxObjectType)
        return producer.emptyJsxObjectType;
    if (type === source.emptyFreshJsxObjectType)
        return producer.emptyFreshJsxObjectType;
    if (type === source.emptyTypeLiteralType)
        return producer.emptyTypeLiteralType;
    if (type === source.unknownEmptyObjectType)
        return producer.unknownEmptyObjectType;
    if (type === source.unknownUnionType)
        return producer.unknownUnionType;
    if (type === source.emptyGenericType)
        return producer.emptyGenericType;
    if (type === source.anyFunctionType)
        return producer.anyFunctionType;
    if (type === source.noConstraintType)
        return producer.noConstraintType;
    if (type === source.circularConstraintType)
        return producer.circularConstraintType;
    if (type === source.resolvingDefaultType)
        return producer.resolvingDefaultType;
    if (type === source.markerSuperType)
        return producer.markerSuperType;
    if (type === source.markerSubType)
        return producer.markerSubType;
    if (type === source.markerOtherType)
        return producer.markerOtherType;
    if (type === source.markerSuperTypeForCheck)
        return producer.markerSuperTypeForCheck;
    if (type === source.markerSubTypeForCheck)
        return producer.markerSubTypeForCheck;
    if (type === source.emptyStringType)
        return producer.emptyStringType;
    if (type === source.zeroType)
        return producer.zeroType;
    if (type === source.zeroBigIntType)
        return producer.zeroBigIntType;
    if (type === source.typeofType)
        return producer.typeofType;
    return undefined;
}
export function reacquireBuiltinSignature(source, producer, signature) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native signature construction requires its actual producer");
    if (signature === source.anySignature)
        return producer.anySignature;
    if (signature === source.unknownSignature)
        return producer.unknownSignature;
    if (signature === source.resolvingSignature)
        return producer.resolvingSignature;
    if (signature === source.silentNeverSignature)
        return producer.silentNeverSignature;
    return undefined;
}
//# sourceMappingURL=type-normalization-builtins.js.map
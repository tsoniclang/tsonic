export function sourceArrayElementType(type, semantics) {
    if (!semantics.types.isArrayLike(type) || semantics.types.isTuple(type))
        return undefined;
    const indexes = semantics.types.indexInfos(type).filter(index => index.keyType !== undefined && semantics.types.isNumberLike(index.keyType));
    return indexes.length === 1 ? indexes[0].valueType : undefined;
}
//# sourceMappingURL=semantics-array-types.js.map
export function sourceTypeDescriptorsEqual(left, right) {
    if (left === right)
        return true;
    if (left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case "primitive": return right.kind === "primitive" && left.primitive === right.primitive;
        case "string": return right.kind === "string";
        case "intrinsic": return right.kind === "intrinsic" && left.intrinsic === right.intrinsic;
        case "union": return right.kind === "union" && left.types.length === right.types.length &&
            left.types.every(type => right.types.some(selected => sourceTypeDescriptorsEqual(type, selected)));
        case "callable": return right.kind === "callable" && signaturesEqual(left.calls, right.calls) &&
            signaturesEqual(left.constructs, right.constructs);
        case "optional": return right.kind === "optional" && sourceTypeDescriptorsEqual(left.value, right.value);
        case "array": return right.kind === "array" && left.readonly === right.readonly &&
            sourceTypeDescriptorsEqual(left.element, right.element);
        case "tuple": return right.kind === "tuple" && left.readonly === right.readonly &&
            left.elements.length === right.elements.length && left.elements.every((element, index) => element.kind === right.elements[index]?.kind && sourceTypeDescriptorsEqual(element.type, right.elements[index].type));
        case "declared": return right.kind === "declared" && left.declaration === right.declaration &&
            left.extent?.length === right.extent?.length && left.extent?.lengthRuntimeBase === right.extent?.lengthRuntimeBase &&
            left.typeArguments.length === right.typeArguments.length &&
            left.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, right.typeArguments[index]));
        case "shape": return right.kind === "shape" && left.members.length === right.members.length &&
            indexesEqual(left.indexes, right.indexes) && signaturesEqual(left.calls, right.calls) && signaturesEqual(left.constructs, right.constructs) &&
            left.members.every(member => {
                const selected = right.members.find(candidate => candidate.name === member.name);
                return selected !== undefined && member.optional === selected.optional && !!member.readonly === !!selected.readonly &&
                    sourceTypeDescriptorMemberLiteralsKey(member) === sourceTypeDescriptorMemberLiteralsKey(selected) && sourceTypeDescriptorsEqual(member.type, selected.type);
            });
    }
}
/** The value key of a member literal (05 §2a D-2): equal keys are the same literal value. Numbers and bigints share the
 * integer spelling, as literal values do in the discriminant rule; the member's base type keeps them apart. */
export function sourceTypeDescriptorLiteralKey(literal) {
    switch (literal.kind) {
        case "string": return `s:${literal.value}`;
        case "boolean": return `b:${String(literal.value)}`;
        case "bigint": return `n:${literal.value.toString()}`;
        case "number": return Number.isInteger(literal.value) ? `n:${BigInt(literal.value).toString()}` : `n:${String(literal.value)}`;
    }
}
// A member's literal set takes part in shape equality and identity as a set: declaration order never separates two arms.
export function sourceTypeDescriptorMemberLiteralsKey(member) {
    return member.literals === undefined ? "" : JSON.stringify([...new Set(member.literals.map(sourceTypeDescriptorLiteralKey))].sort());
}
function indexesEqual(left, right) {
    return left.length === right.length && left.every(index => right.some(selected => index.readonly === selected.readonly && sourceTypeDescriptorsEqual(index.key, selected.key) &&
        sourceTypeDescriptorsEqual(index.value, selected.value)));
}
function signaturesEqual(left, right) {
    return left.length === right.length && left.every((signature, index) => {
        const selected = right[index];
        return signature.typeParameters.length === selected.typeParameters.length &&
            signature.typeParameters.every((parameter, offset) => parameter === selected.typeParameters[offset]) &&
            signature.parameters.length === selected.parameters.length && signature.parameters.every((parameter, offset) => parameter.kind === selected.parameters[offset]?.kind &&
            sourceTypeDescriptorsEqual(parameter.type, selected.parameters[offset].type)) &&
            sourceTypeDescriptorsEqual(signature.result, selected.result);
    });
}
export function sourceTypeDescriptorTupleValue(type, index) {
    if (!Number.isSafeInteger(index) || index < 0)
        throw new Error("A Source tuple position must be a nonnegative safe integer.");
    const element = type.elements[index];
    if (element !== undefined)
        return element.type;
    const last = type.elements[type.elements.length - 1];
    return last?.kind === "rest" ? last.type : undefined;
}
export function sourceTypeDescriptorStructure(type) {
    let selected = type;
    while (selected.kind === "declared" && selected.definition !== undefined)
        selected = selected.definition;
    return selected;
}
//# sourceMappingURL=descriptor-model.js.map
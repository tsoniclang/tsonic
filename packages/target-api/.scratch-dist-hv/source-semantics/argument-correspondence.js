export function sourceArgumentCorrespondence(binding, argument) {
    const mode = binding.sourceForm === "spread-sequence" ? "spread"
        : binding.sourceParameterForm === "parameter" ? "positional" : "rest-element";
    return Object.freeze({
        argument, argumentIndex: binding.sourceArgumentIndex, effectiveIndex: binding.effectiveArgumentIndex,
        parameterIndex: binding.sourceParameterIndex, mode, form: binding.sourceForm,
        ...(binding.sourceForm === "spread-element" && binding.spreadElementIndex !== undefined
            ? { spreadElement: binding.spreadElementIndex } : {}),
    });
}
/** Two correspondence rows name the same binding of the same call. */
export function sourceArgumentCorrespondencesEqual(left, right) {
    return left.argument === right.argument && left.argumentIndex === right.argumentIndex &&
        left.effectiveIndex === right.effectiveIndex && left.parameterIndex === right.parameterIndex &&
        left.mode === right.mode && left.form === right.form && left.spreadElement === right.spreadElement;
}
//# sourceMappingURL=argument-correspondence.js.map
const targetIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
export function isValidTargetId(value) {
    return targetIdPattern.test(value);
}
export function isValidTargetSurfaceId(value) {
    return targetIdPattern.test(value);
}
export function getTargetIdValidationMessage(subject) {
    return `${subject} must match ${targetIdPattern.source}; use lowercase ASCII letters, digits, and single hyphen-separated segments.`;
}
//# sourceMappingURL=config.js.map
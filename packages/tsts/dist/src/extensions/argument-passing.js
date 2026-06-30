export const ArgumentPassingModes = [
    "by-value",
    "byref-readonly",
    "byref-readwrite",
    "byref-writeonly-must-init",
    "borrow-shared",
    "borrow-mut",
    "move",
];
export function isArgumentPassingMode(value) {
    return typeof value === "string" && ArgumentPassingModes.includes(value);
}
//# sourceMappingURL=argument-passing.js.map
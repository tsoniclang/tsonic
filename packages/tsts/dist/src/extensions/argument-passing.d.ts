export declare const ArgumentPassingModes: readonly ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"];
export type ArgumentPassingMode = typeof ArgumentPassingModes[number];
export declare function isArgumentPassingMode(value: unknown): value is ArgumentPassingMode;
//# sourceMappingURL=argument-passing.d.ts.map
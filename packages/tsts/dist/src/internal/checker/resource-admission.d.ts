import type { Context } from "../../go/context.js";
import type { Checker } from "./checker/state.js";
export type NativeCheckerCost = "work" | "retained";
export type NativeCheckerAdmission<Stop extends object> = (cost: NativeCheckerCost, units: number) => Stop | null;
export type NativeCheckerResult<Value, Stop extends object> = {
    readonly kind: "complete";
    readonly value: Value;
} | {
    readonly kind: "refused";
    readonly stop: Stop;
} | {
    readonly kind: "unavailable";
};
export declare function admitNativeChecker(checker: Checker | undefined, cost: NativeCheckerCost, units?: number): void;
export declare function markNativeCheckerProvisional(checker: Checker | undefined): void;
export declare function runNativeCheckerAcquisition<Value, Stop extends object>(checker: Checker, context: Context, admit: NativeCheckerAdmission<Stop>, terminate: () => void, read: () => Value): NativeCheckerResult<Value, Stop>;
//# sourceMappingURL=resource-admission.d.ts.map
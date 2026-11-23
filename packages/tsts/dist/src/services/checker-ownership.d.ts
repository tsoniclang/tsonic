import type { GoPtr } from "../go/compat.js";
import type { uint } from "../go/scalars.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { Program } from "../internal/compiler/program.js";
import { type NativeCheckerAdmission, type NativeCheckerResult } from "../internal/checker/resource-admission.js";
export declare function withSourceFileChecker<Value>(program: GoPtr<Program>, requester: GoPtr<SourceFile>, sourceFile: GoPtr<SourceFile>, context: Context, read: (checker: Checker) => Value): Value | undefined;
export declare function withCheckerById<Value>(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, checkerId: uint, context: Context, read: (checker: Checker) => Value): Value | undefined;
export declare function withOwnedChecker<Value>(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, owner: GoPtr<Checker>, context: Context, read: (checker: Checker) => Value): Value | undefined;
export declare function withOwnedCheckerAcquisition<Value, Stop extends object>(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, owner: GoPtr<Checker>, context: Context, admit: NativeCheckerAdmission<Stop>, read: (checker: Checker) => Value): NativeCheckerResult<Value, Stop>;
export declare function acquireLeasedChecker<Value, Stop extends object>(checker: Checker, context: Context, admit: NativeCheckerAdmission<Stop>, read: () => Value): NativeCheckerResult<Value, Stop>;
//# sourceMappingURL=checker-ownership.d.ts.map
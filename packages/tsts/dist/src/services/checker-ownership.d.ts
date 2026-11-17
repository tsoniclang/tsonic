import type { GoPtr } from "../go/compat.js";
import type { uint } from "../go/scalars.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { Program } from "../internal/compiler/program.js";
export declare function withCheckerById<Value>(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, checkerId: uint, context: Context, read: (checker: Checker) => Value): Value | undefined;
export declare function withOwnedChecker<Value>(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, owner: GoPtr<Checker>, context: Context, read: (checker: Checker) => Value): Value | undefined;
//# sourceMappingURL=checker-ownership.d.ts.map
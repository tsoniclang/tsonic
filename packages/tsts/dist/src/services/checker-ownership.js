import { SourceFile_FileName } from "../internal/ast/ast.js";
import { Program_GetSourceFile, Program_GetTypeCheckerById } from "../internal/compiler/program.js";
import { CheckerLifetimeAPI, WithCheckerLifetime } from "../internal/core/context.js";
import { getExtensionHost } from "../extensions/host.js";
export function withCheckerById(program, sourceFile, checkerId, context, read) {
    if (program === undefined || sourceFile === undefined ||
        Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile)
        return undefined;
    const [checker, release] = Program_GetTypeCheckerById(program, WithCheckerLifetime(context, CheckerLifetimeAPI), checkerId);
    try {
        return checker !== undefined && checker.id === checkerId ? read(checker) : undefined;
    }
    finally {
        release();
    }
}
export function withOwnedChecker(program, sourceFile, owner, context, read) {
    if (program === undefined || sourceFile === undefined || owner === undefined ||
        Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile)
        return undefined;
    const [selected, release] = Program_GetTypeCheckerById(program, WithCheckerLifetime(context, CheckerLifetimeAPI), owner.id);
    try {
        if (selected !== owner) {
            const host = getExtensionHost(program);
            if (host === undefined || host !== getExtensionHost(owner.program))
                return undefined;
        }
        return read(owner);
    }
    finally {
        release();
    }
}
//# sourceMappingURL=checker-ownership.js.map
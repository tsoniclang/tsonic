import { SourceFile_FileName } from "../internal/ast/ast.js";
import { Program_GetSourceFile, Program_GetTypeCheckerById, Program_GetTypeCheckerForFile, Program_HasUsableCheckerSession, Program_OfChecker, Program_TerminateCheckerSession } from "../internal/compiler/program.js";
import { CheckerLifetimeAPI, CheckerLifetimeDiagnostics, WithCheckerLifetime } from "../internal/core/context.js";
import { getExtensionHost } from "../extensions/host.js";
import { runNativeCheckerAcquisition } from "../internal/checker/resource-admission.js";
export function withSourceFileChecker(program, requester, sourceFile, context, read) {
    if (program === undefined || requester === undefined || sourceFile === undefined || !Program_HasUsableCheckerSession(program) ||
        Program_GetSourceFile(program, SourceFile_FileName(requester)) !== requester ||
        Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile)
        return undefined;
    const [checker, release] = Program_GetTypeCheckerForFile(program, WithCheckerLifetime(context, CheckerLifetimeDiagnostics), sourceFile);
    try {
        return checker === undefined ? undefined : read(checker);
    }
    finally {
        release();
    }
}
export function withCheckerById(program, sourceFile, checkerId, context, read) {
    if (program === undefined || sourceFile === undefined || !Program_HasUsableCheckerSession(program) ||
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
    if (program === undefined || sourceFile === undefined || owner === undefined || !Program_HasUsableCheckerSession(program) ||
        Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile)
        return undefined;
    const ownerProgram = Program_OfChecker(owner);
    if (ownerProgram === undefined || !Program_HasUsableCheckerSession(ownerProgram))
        return undefined;
    if (ownerProgram !== program) {
        const host = getExtensionHost(program);
        if (host === undefined || host !== getExtensionHost(ownerProgram))
            return undefined;
    }
    const [selected, release] = Program_GetTypeCheckerById(ownerProgram, WithCheckerLifetime(context, CheckerLifetimeAPI), owner.id);
    try {
        return selected === owner ? read(selected) : undefined;
    }
    finally {
        release();
    }
}
export function withOwnedCheckerAcquisition(program, sourceFile, owner, context, admit, read) {
    return withOwnedChecker(program, sourceFile, owner, context, checker => acquireLeasedChecker(checker, context, admit, () => read(checker))) ?? { kind: "unavailable" };
}
export function acquireLeasedChecker(checker, context, admit, read) {
    const producer = Program_OfChecker(checker);
    if (producer === undefined)
        throw new Error("An acquired checker must retain its originating program.");
    return runNativeCheckerAcquisition(checker, context, admit, () => Program_TerminateCheckerSession(producer, checker), read);
}
//# sourceMappingURL=checker-ownership.js.map
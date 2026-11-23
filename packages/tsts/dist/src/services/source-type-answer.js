import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import {} from "../internal/compiler/program.js";
import { CheckerLifetimeAPI, CheckerLifetimeDiagnostics, WithCheckerLifetime } from "../internal/core/context.js";
import { Background } from "../go/context.js";
import { Checker_GetReturnTypeOfSignature, Checker_GetTypeFromTypeNode } from "../internal/checker/exports.js";
import { Checker_getContextualType, Checker_GetTypeAtLocation } from "../internal/checker/checker/types.js";
import { ContextFlagsNone } from "../internal/checker/types.js";
import { admitNativeChecker } from "../internal/checker/resource-admission.js";
import { borrowedSourceTypeAnswer, signatureReturnAnswer, sourceTypeAnswer } from "../internal/checker/checker/source-type-answers.js";
import { acquireLeasedChecker, withCheckerById, withSourceFileChecker } from "./checker-ownership.js";
export function admitSourceTypeAnswer(answer, admits) {
    if (admits === undefined || answer.causes.length === 0)
        return answer;
    const causes = answer.causes.filter(admits);
    return causes.length === answer.causes.length ? answer : { ...answer, causes };
}
function readHead(checker, request, admits) {
    admitNativeChecker(checker, "work");
    switch (request.kind) {
        case "expression": return sourceTypeAnswer(checker, request.node, Checker_GetTypeAtLocation(checker, request.node), admits);
        case "annotation": return sourceTypeAnswer(checker, request.node, Checker_GetTypeFromTypeNode(checker, request.node), admits);
        case "signature-return": return signatureReturnAnswer(checker, request.signature, Checker_GetReturnTypeOfSignature(checker, request.signature), admits);
        case "contextual": {
            const output = { value: undefined };
            const type = Checker_getContextualType(checker, request.node, request.flags ?? ContextFlagsNone, output);
            return output.value?.type === type && output.value !== undefined ? admitSourceTypeAnswer(output.value, admits)
                : type === undefined ? undefined : { type, causes: [] };
        }
    }
}
function underLease(checker, context, admit, read) {
    return admit === null ? { kind: "complete", value: read() } : acquireLeasedChecker(checker, context, admit, read);
}
export function readSourceType(program, options, request, admit) {
    const context = options.context ?? Background();
    const lifetime = request.kind === "signature-return" ? CheckerLifetimeAPI : CheckerLifetimeDiagnostics;
    const read = (checker) => underLease(checker, WithCheckerLifetime(context, lifetime), admit, () => readHead(checker, request, options.admitsCheckerDiagnostic));
    const head = request.kind === "signature-return"
        ? request.signature === undefined ? undefined : withCheckerById(program, options.sourceFile, request.signature.checkerId, context, read)
        : withSourceFileChecker(program, options.sourceFile, GetSourceFileOfNode(request.node), context, read);
    if (head === undefined || head.kind === "unavailable")
        return { kind: "unavailable" };
    if (head.kind === "refused")
        return head;
    return settleSourceTypeAnswer(program, options, head.value, admit);
}
export function querySourceType(program, options, request) {
    const result = readSourceType(program, options, request, null);
    return result.kind === "complete" ? result.value : undefined;
}
export function resolveSourceTypeAnswer(program, options, answer) {
    const result = settleSourceTypeAnswer(program, options, answer, null);
    return result.kind === "complete" ? result.value : undefined;
}
function settleSourceTypeAnswer(program, options, answer, admit) {
    if (answer === undefined)
        return { kind: "unavailable" };
    if (answer.borrowedFrom === undefined)
        return { kind: "complete", value: answer };
    const start = admit?.("retained", 3) ?? null;
    if (start !== null)
        return { kind: "refused", stop: start };
    const context = options.context ?? Background();
    const lifetime = WithCheckerLifetime(context, CheckerLifetimeDiagnostics);
    const type = answer.type;
    const pending = [];
    const visited = new Set();
    const causes = new Set();
    let nextSource = answer.typeSource;
    let typeSource;
    let indexedRead;
    const addSource = (source) => {
        const single = "Kind" in source;
        const stop = admit?.("retained", single ? 1 : 2) ?? null;
        if (stop === null) {
            if (single)
                pending.push(source);
            else
                pending.push(source[1], source[0]);
        }
        return stop;
    };
    const entered = addSource(answer.borrowedFrom);
    if (entered !== null)
        return { kind: "refused", stop: entered };
    while (pending.length > 0) {
        const next = admit?.("work", 1) ?? null;
        if (next !== null)
            return { kind: "refused", stop: next };
        const source = pending.pop();
        if (source === undefined)
            throw new Error("A pending source type requires its actual borrowed source.");
        if (visited.has(source))
            continue;
        const retained = admit?.("retained", 1) ?? null;
        if (retained !== null)
            return { kind: "refused", stop: retained };
        visited.add(source);
        const consumed = withSourceFileChecker(program, options.sourceFile, GetSourceFileOfNode(source), context, checker => underLease(checker, lifetime, admit, () => borrowedSourceTypeAnswer(checker, source, type, options.admitsCheckerDiagnostic)));
        if (consumed === undefined || consumed.kind === "unavailable")
            continue;
        if (consumed.kind === "refused")
            return consumed;
        const borrowed = consumed.value;
        if (source === nextSource) {
            typeSource = source;
            nextSource = borrowed.typeSource;
            indexedRead = borrowed.indexedRead;
        }
        for (let index = 0; index < borrowed.causes.length; index += 1) {
            const nextCause = admit?.("work", 1) ?? null;
            if (nextCause !== null)
                return { kind: "refused", stop: nextCause };
            const cause = borrowed.causes[index];
            if (cause === undefined)
                throw new Error("A borrowed source type requires its complete diagnostic vector.");
            if (causes.has(cause))
                continue;
            const retainCause = admit?.("retained", 1) ?? null;
            if (retainCause !== null)
                return { kind: "refused", stop: retainCause };
            causes.add(cause);
        }
        if (borrowed.borrowedFrom !== undefined) {
            const stop = addSource(borrowed.borrowedFrom);
            if (stop !== null)
                return { kind: "refused", stop };
        }
    }
    const output = admit?.("retained", 2 + causes.size) ?? null;
    if (output !== null)
        return { kind: "refused", stop: output };
    const value = causes.size === 0 && typeSource !== undefined && nextSource === undefined
        ? { type, causes: [], typeSource, ...(indexedRead === undefined ? {} : { indexedRead }) }
        : { type, causes: [...causes] };
    return { kind: "complete", value };
}
//# sourceMappingURL=source-type-answer.js.map
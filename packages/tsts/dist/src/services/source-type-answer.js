import { SourceFile_FileName } from "../internal/ast/ast.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Program_GetSourceFile, Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { CheckerLifetimeDiagnostics, WithCheckerLifetime } from "../internal/core/context.js";
import { Background } from "../go/context.js";
import { borrowedSourceTypeAnswer } from "../internal/checker/checker/source-type-answers.js";
export function admitSourceTypeAnswer(answer, admits) {
    if (admits === undefined || answer.causes.length === 0)
        return answer;
    const causes = answer.causes.filter(admits);
    return causes.length === answer.causes.length ? answer : { ...answer, causes };
}
export function resolveSourceTypeAnswer(program, options, answer) {
    if (answer?.borrowedFrom === undefined)
        return answer;
    const context = WithCheckerLifetime(options.context ?? Background(), CheckerLifetimeDiagnostics);
    const type = answer.type;
    const pending = [];
    const visited = new Set();
    const causes = new Set();
    let nextSource = answer.typeSource;
    let typeSource;
    let indexedRead;
    const addSource = (source) => {
        if ("Kind" in source)
            pending.push(source);
        else
            pending.push(source[1], source[0]);
    };
    addSource(answer.borrowedFrom);
    for (let source = pending.pop(); source !== undefined; source = pending.pop()) {
        if (visited.has(source))
            continue;
        visited.add(source);
        const file = GetSourceFileOfNode(source);
        if (file === undefined || Program_GetSourceFile(program, SourceFile_FileName(file)) !== file)
            continue;
        const [owner, done] = Program_GetTypeCheckerForFile(program, context, file);
        let borrowed;
        try {
            if (owner === undefined)
                continue;
            borrowed = borrowedSourceTypeAnswer(owner, source, type, options.admitsCheckerDiagnostic);
        }
        finally {
            done();
        }
        if (source === nextSource) {
            typeSource = source;
            nextSource = borrowed.typeSource;
            indexedRead = borrowed.indexedRead;
        }
        for (const cause of borrowed.causes)
            causes.add(cause);
        if (borrowed.borrowedFrom !== undefined)
            addSource(borrowed.borrowedFrom);
    }
    return causes.size === 0 && typeSource !== undefined && nextSource === undefined
        ? { type, causes: [], typeSource, ...(indexedRead === undefined ? {} : { indexedRead }) }
        : { type, causes: [...causes] };
}
//# sourceMappingURL=source-type-answer.js.map
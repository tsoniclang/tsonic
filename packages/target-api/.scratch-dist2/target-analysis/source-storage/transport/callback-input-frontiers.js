import { sourceStorageInvocationReceiver } from "../model/host-reads.js";
import { sourceAnalysisIncludesFile } from "../../analysis-program.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourceStorageNativeInputSlots } from "../graph/invocation-inputs.js";
export function createSourceStorageCallbackInputFrontiers(source, budget, graphQueries, host) {
    const { ast } = source;
    const step = budget.step;
    const { invocations, callbackEntriesFor, callbackImplementationsFor, invocationTargets, subjectFor, originSubjects, invocationInputs, nativePayloadCandidates } = host;
    let nativeInputs;
    const nativeInputIndex = () => {
        if (nativeInputs === undefined) {
            const rows = budget.createRows();
            const selected = new Map();
            let complete = false;
            try {
                for (const invocation of invocations)
                    for (const callback of callbackEntriesFor(invocation))
                        for (const candidate of callbackImplementationsFor(callback)) {
                            if (!step())
                                return undefined;
                            const parameters = sourceCallableValueParameters(ast, candidate, source.navigation, { kind: "declaration" });
                            if (parameters === undefined) {
                                budget.reject("Source storage native callback frontiers require their exact checked value parameters.");
                                return undefined;
                            }
                            for (const parameter of parameters) {
                                if (!step())
                                    return undefined;
                                const file = parameter === undefined ? undefined : ast.getSourceFile(parameter);
                                if (parameter === undefined || file === undefined || !sourceAnalysisIncludesFile(source, file) ||
                                    !ast.is.IsParameterDeclaration(parameter) || ast.parent(parameter) !== candidate) {
                                    budget.reject("Source storage native callback inputs require exact checked parameter declaration ownership.");
                                    return undefined;
                                }
                                const retained = selected.get(parameter);
                                if (retained?.some(entry => entry.invocation === invocation && entry.callback === callback && entry.candidate === candidate))
                                    continue;
                                if (!rows.add(retained === undefined ? 2 : 1))
                                    return undefined;
                                const entries = retained ?? [];
                                entries.push(Object.freeze({ invocation, candidate, callback }));
                                selected.set(parameter, entries);
                            }
                        }
                for (const entries of selected.values())
                    Object.freeze(entries);
                nativeInputs = selected;
                complete = true;
            }
            finally {
                if (!complete)
                    rows.release();
            }
        }
        return nativeInputs;
    };
    const callbackInputFrontiersFor = graphQueries.query((invocation) => {
        const selected = new Set();
        const nativeArguments = nativeInputIndex();
        if (nativeArguments === undefined)
            return undefined;
        if (nativeArguments.size === 0)
            return selected;
        const operands = [];
        const target = invocationTargets.get(invocation);
        if (target !== undefined)
            operands.push({ subject: target });
        const receiver = subjectFor(sourceStorageInvocationReceiver(source, invocation));
        if (receiver !== undefined && receiver !== target)
            operands.push({ subject: receiver });
        for (const callback of callbackEntriesFor(invocation))
            operands.push({ subject: callback.argument.actual, callback });
        for (const operand of operands) {
            const origins = originSubjects(operand.subject);
            if (origins === undefined)
                return undefined;
            for (const origin of origins) {
                if (!step())
                    return undefined;
                const owner = sourceStorageFormalOwner(origin, source);
                if (owner === undefined || origin.kind !== "input")
                    continue;
                const entries = nativeArguments.get(origin.node) ?? [];
                for (const entry of entries) {
                    if (!step())
                        return undefined;
                    if (entry.candidate !== owner)
                        continue;
                    const bounds = sourceStorageNativeInputSlots(source, owner, origin, host.inputSlotsFor(owner, entry.invocation, entry.callback), step);
                    if (bounds !== undefined && bounds.every(bound => bound.absent))
                        continue;
                    const inputs = invocationInputs(origin, owner, entry.invocation, entry.callback);
                    if (!inputs.calleeSubjects?.includes(origin))
                        continue;
                    const candidates = nativePayloadCandidates(entry.invocation)?.values().next().value;
                    if (candidates === undefined)
                        return undefined;
                    for (const candidate of candidates.values) {
                        if (!step())
                            return undefined;
                        selected.add(Object.freeze({ kind: "unclassified-exposure", subject: candidate, owner: origin, exposure: entry.invocation,
                            ...(operand.callback === undefined ? {} : { callback: operand.callback }) }));
                    }
                    if (!candidates.complete)
                        selected.add(Object.freeze({ kind: "unclassified-exposure", subject: origin, owner: origin,
                            exposure: entry.invocation, ...(operand.callback === undefined ? {} : { callback: operand.callback }) }));
                }
            }
        }
        return selected;
    });
    return callbackInputFrontiersFor;
}
//# sourceMappingURL=callback-input-frontiers.js.map
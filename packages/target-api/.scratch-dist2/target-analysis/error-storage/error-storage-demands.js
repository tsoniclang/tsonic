import { sourceAnalysisIncludesFile } from "../analysis-program.js";
import { sourceStorageRoleDeclaration } from "../source-storage/model/components.js";
import { sourceStorageQueriesProgram } from "../source-storage/queries.js";
import { Node_Expression } from "../../source-navigation/index.js";
import { createSourceErrorInvalidationQuery } from "./error-invalidation.js";
const immutableDemand = Object.freeze({ kind: "immutable" });
const maximumDemandRows = 1048576;
const maximumDemandSteps = 4194304;
export function createSourceErrorStorageDemandQuery(source, protocol, storage) {
    const { ast, navigation } = source;
    const fields = new Set(protocol.fields);
    const constructors = new Set(protocol.constructors);
    const stackCaptures = new Set(protocol.stackCaptures);
    const capturedStackTargets = new Map();
    const writes = new Map();
    const unresolvedWrites = new Map();
    const nativeSubjects = new Set();
    const noBoundaries = Object.freeze([]);
    const retainedBoundaries = [];
    const fieldWrites = [];
    let demandRows = 0;
    let steps = 0;
    let failure = sourceStorageQueriesProgram(storage) === source ? storage.failureReason()
        : "Error storage demand requires the exact shared source transport owner.";
    const failureReason = () => failure ?? storage.failureReason();
    const reject = (reason) => { failure ?? (failure = reason); };
    const step = () => {
        if (++steps > maximumDemandSteps)
            reject("Error storage demand exceeds its finite analysis-work budget.");
        return failureReason() === undefined;
    };
    const reserveRow = (label) => {
        if (++demandRows > maximumDemandRows)
            reject(`Error storage demand exceeds its finite ${label} budget.`);
        return failureReason() === undefined;
    };
    const selectedSubject = (selection) => {
        if (selection.kind === "resolved")
            return selection.subject;
        reject(selection.reason);
        return undefined;
    };
    const subjectFor = (node) => node === undefined ? undefined : selectedSubject(storage.subjectFor(node));
    const storageMutators = new Map();
    let mutatorRows = 0;
    for (const mutator of protocol.storageMutators) {
        const file = ast.getSourceFile(mutator.signature);
        const indexes = storageMutators.get(mutator.signature) ?? new Set();
        if (++mutatorRows > maximumDemandRows || !sourceAnalysisIncludesFile(source, file) ||
            !Number.isSafeInteger(mutator.sourceParameterIndex) || mutator.sourceParameterIndex < 0 || indexes.has(mutator.sourceParameterIndex)) {
            reject("An Error storage mutator requires a unique exact checked signature and finite selected parameter index.");
            break;
        }
        const parameterNode = ast.parameters(mutator.signature)[mutator.sourceParameterIndex];
        const parameter = parameterNode === undefined || !ast.is.IsParameterDeclaration(parameterNode)
            ? undefined : ast.as.AsParameterDeclaration(parameterNode);
        if (parameter === undefined || parameter.DotDotDotToken !== undefined) {
            reject("An Error storage mutator requires an exact scalar signature parameter.");
            break;
        }
        indexes.add(mutator.sourceParameterIndex);
        storageMutators.set(mutator.signature, indexes);
    }
    const recordStorageWrite = (subject, write, receiver) => {
        const selected = writes.get(subject) ?? new Map();
        if (selected.has(write) || !reserveRow("selected-write"))
            return;
        selected.set(write, receiver);
        writes.set(subject, selected);
    };
    const recordWrite = (subject, write) => {
        if (subject === undefined) {
            reject("An admitted Error write has no exact source storage subject.");
            return;
        }
        recordStorageWrite(subject, write, subject);
        const selected = storage.boundValueFrontierFor(subject, storage.emptyBindings, noBoundaries);
        if (selected.kind === "unresolved") {
            if (storage.failureReason() !== undefined)
                reject(storage.failureReason());
            else
                unresolvedWrites.set(subject, selected.reason);
            return;
        }
        for (const origin of selected.frontier) {
            if (!step())
                break;
            recordStorageWrite(origin.subject, write, subject);
        }
    };
    for (const node of storage.nodes) {
        if (!step())
            break;
        if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) || ast.is.IsPropertyAccessExpression(node)) {
            const retention = protocol.retention(node);
            if (retention.kind === "unresolved") {
                reject(retention.reason);
                break;
            }
            if (retention.kind === "retained")
                retainedBoundaries.push(node);
        }
        if (ast.is.IsPropertyAccessExpression(node)) {
            const selected = navigation.memberAccess(node);
            const declaration = selected?.declaration === undefined ? undefined
                : sourceStorageRoleDeclaration(source, selected.declaration, "write") ?? selected.declaration;
            if (selected !== undefined && selected.accessMode !== "read" && declaration !== undefined && fields.has(declaration)) {
                fieldWrites.push(node);
                recordWrite(subjectFor(selected.receiver), node);
            }
        }
        if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node))
            continue;
        const selected = navigation.call(node);
        const signature = selected?.signature;
        if (selected === undefined || signature === undefined)
            continue;
        if (stackCaptures.has(signature) && selected.arguments.length === 1) {
            const owner = subjectFor(selected.arguments[0]);
            if (owner !== undefined)
                capturedStackTargets.set(node, owner);
        }
        for (const index of storageMutators.get(signature) ?? []) {
            const bindings = selected.bindings.filter(binding => binding.sourceParameterIndex === index);
            const binding = bindings.length === 1 ? bindings[0] : undefined;
            const value = binding?.sourceForm === "value" && binding.sourceParameterForm === "parameter"
                ? selected.arguments[binding.sourceArgumentIndex] : undefined;
            if (value === undefined) {
                reject("An Error storage mutation requires its exact selected scalar argument transport.");
                break;
            }
            recordWrite(subjectFor(value), node);
        }
        if (constructors.has(signature) && ast.kindName(Node_Expression(ast, node)) !== "KindSuperKeyword") {
            const subject = selectedSubject(storage.subject(node));
            if (subject !== undefined)
                nativeSubjects.add(subject);
        }
    }
    const selections = new Map();
    const storageFor = subject => {
        const failure = failureReason();
        if (failure !== undefined)
            return Object.freeze({ kind: "unresolved", reason: failure });
        if (unresolvedWrites.size !== 0) {
            const ancestors = storage.ancestorsFor(subject);
            if (ancestors.kind === "unresolved")
                return ancestors;
            for (const ancestor of ancestors.subjects) {
                const reason = unresolvedWrites.get(ancestor);
                if (reason !== undefined)
                    return Object.freeze({ kind: "unresolved", reason });
            }
        }
        const cached = selections.get(subject);
        if (cached !== undefined)
            return cached;
        const frontier = storage.boundValueFrontierFor(subject, storage.emptyBindings, noBoundaries);
        if (frontier.kind === "unresolved")
            return Object.freeze({ kind: "unresolved", reason: frontier.reason });
        const selectedWrites = new Map(writes.get(subject));
        for (const origin of frontier.frontier) {
            if (!step())
                return Object.freeze({ kind: "unresolved", reason: failureReason() });
            const reason = unresolvedWrites.get(origin.subject);
            if (reason !== undefined)
                return Object.freeze({ kind: "unresolved", reason });
            for (const [write, receiver] of writes.get(origin.subject) ?? []) {
                if (!step())
                    return Object.freeze({ kind: "unresolved", reason: failureReason() });
                if (selectedWrites.has(write))
                    continue;
                if (!reserveRow("physical-write-selection"))
                    return Object.freeze({ kind: "unresolved", reason: failureReason() });
                selectedWrites.set(write, receiver);
            }
        }
        const boundaries = Object.freeze([subject]);
        const physicalComponent = subject.projection.length !== 0;
        const demandedWrites = [];
        for (const [write, receiver] of selectedWrites) {
            if (!step())
                return Object.freeze({ kind: "unresolved", reason: failureReason() });
            if (physicalComponent || receiver === subject) {
                demandedWrites.push(write);
                continue;
            }
            const selected = storage.boundValueFrontierFor(receiver, storage.emptyBindings, boundaries);
            if (selected.kind === "unresolved")
                return selected;
            for (const current of selected.frontier) {
                if (!step())
                    return Object.freeze({ kind: "unresolved", reason: failureReason() });
                if (current.kind === "boundary" && current.subject === subject) {
                    demandedWrites.push(write);
                    break;
                }
            }
        }
        const demand = demandedWrites.length === 0 ? immutableDemand
            : Object.freeze({ kind: "writable", writes: Object.freeze(demandedWrites) });
        selections.set(subject, demand);
        return demand;
    };
    const receivesWritableNative = subject => {
        if (storageFor(subject).kind === "unresolved")
            return false;
        const ancestors = storage.ancestorsFor(subject);
        return ancestors.kind === "resolved" && ancestors.subjects.some(subject => nativeSubjects.has(subject) &&
            storageFor(subject).kind === "writable");
    };
    const storageOriginsFor = subject => {
        const failure = failureReason();
        if (failure !== undefined)
            return Object.freeze({ kind: "unresolved", reason: failure });
        const origins = storage.originsFor(subject);
        return origins.kind === "unresolved" ? origins : Object.freeze({ kind: "resolved", origins: Object.freeze(origins.origins
                .map(origin => Object.freeze({ node: origin.subject.node, type: origin.type }))) });
    };
    const closedStorageOriginsFor = subject => {
        const failure = failureReason();
        if (failure !== undefined)
            return Object.freeze({ kind: "unresolved", reason: failure });
        return storage.closedOriginsFor(subject);
    };
    const invalidationFor = createSourceErrorInvalidationQuery(source, storage, storageFor, nativeSubjects, capturedStackTargets, step, failureReason);
    return Object.freeze({ retainedBoundaries: Object.freeze(retainedBoundaries), nativeConstructors: Object.freeze([...nativeSubjects]),
        fieldWrites: Object.freeze(fieldWrites), storageFor, isNativeConstructor: (node) => {
            const selected = storage.subject(node);
            return selected.kind === "resolved" && nativeSubjects.has(selected.subject);
        }, receivesWritableNative, storageOriginsFor, closedStorageOriginsFor, invalidationFor });
}
//# sourceMappingURL=error-storage-demands.js.map
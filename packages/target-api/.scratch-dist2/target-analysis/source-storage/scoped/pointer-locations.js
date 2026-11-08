import { sourceAnalysisValueType } from "../../analysis-program.js";
import { sourceStoragePointerOperation } from "../model/host-reads.js";
import { sourceIndexedStorageProjection, sourceStorageRoleDeclaration } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageProjectionType } from "./projection-views.js";
export function createSourceStoragePointerLocations(source, budget, transport, queries) {
    const address = (operation, scope) => budget.withRows(rows => {
        const { ast, navigation } = source;
        const selected = navigation.memberAccess(operation.storageExpression);
        if (selected === undefined) {
            const subject = transport.locationFor(operation.storageExpression);
            return subject === undefined ? undefined : [Object.freeze({ kind: "leaf", subject,
                    scope: queries.creatorScope(subject.node, scope) })];
        }
        const receiver = transport.subjectFor(selected.receiver);
        const receiverType = sourceAnalysisValueType(source, selected.receiver);
        if (receiverType === undefined)
            return undefined;
        const component = ast.is.IsElementAccessExpression(operation.storageExpression)
            ? sourceIndexedStorageProjection(source, receiverType, ast.as.AsElementAccessExpression(operation.storageExpression)?.ArgumentExpression) : undefined;
        const declaration = selected.declaration === undefined ? undefined
            : sourceStorageRoleDeclaration(source, selected.declaration, "write") ?? selected.declaration;
        if (receiver === undefined || component === undefined && declaration === undefined)
            return undefined;
        const originals = queries.read(sourceStorageReference(receiver, scope));
        if (originals === undefined)
            return undefined;
        const result = [];
        for (const original of originals) {
            if (!budget.step())
                return undefined;
            if (original.kind === "empty" || original.kind === "unresolved") {
                if (!rows.add(1))
                    return undefined;
                result.push(original);
                continue;
            }
            if (original.kind !== "leaf" && original.kind !== "input-frontier")
                return undefined;
            const type = sourceStorageProjectionType(source, original.subject, original.views, transport.sourceFileFor(original.subject));
            if (type === undefined)
                return undefined;
            sourceStorageProjectComponents(original.subject.projection, type, receiverType, component === undefined ? [{ kind: "member", declaration: declaration }] : [component], source, ast, budget, projection => {
                const subject = transport.subject(original.subject.node, original.subject.kind, projection);
                if (subject !== undefined && rows.add(1))
                    result.push(original.kind === "input-frontier"
                        ? Object.freeze({ ...original, subject, preservesInput: false })
                        : Object.freeze({ ...original, subject }));
            });
        }
        return budget.failure() === undefined ? result : undefined;
    });
    const identities = (pointer) => budget.withRows(rows => {
        const pending = [pointer];
        const seen = new Map();
        const result = [];
        while (pending.length !== 0) {
            if (!budget.step())
                return undefined;
            const original = pending.pop();
            if (original.kind === "empty" || original.kind === "unresolved" || original.kind === "input-frontier") {
                result.push(original);
                continue;
            }
            const visited = seen.get(original.scope);
            if (visited?.has(original.subject))
                continue;
            if (!rows.add(visited === undefined ? 3 : 2))
                return undefined;
            const entries = visited ?? new Set();
            entries.add(original.subject);
            seen.set(original.scope, entries);
            const operation = original.subject.kind === "value" && original.subject.projection.length === 0
                ? sourceStoragePointerOperation(source, original.subject.node) : undefined;
            if (operation?.operation === "allocate") {
                result.push(original);
                continue;
            }
            if (operation?.operation === "address-of") {
                const selected = address(operation, original.scope);
                if (selected === undefined)
                    return undefined;
                result.push(...selected);
                continue;
            }
            const expression = operation?.operation === "bind-pointer" ? operation.identityExpression
                : operation?.operation === "project-pointer" ? operation.pointerExpression : undefined;
            const subject = transport.subjectFor(expression);
            if (subject === undefined)
                return undefined;
            const selected = queries.read(sourceStorageReference(subject, original.scope));
            if (selected === undefined)
                return undefined;
            for (const value of selected) {
                if (!budget.step() || !rows.add(1))
                    return undefined;
                if (value.kind === "empty" || value.kind === "unresolved") {
                    result.push(value);
                    continue;
                }
                if (value.kind !== "leaf" && value.kind !== "input-frontier")
                    return undefined;
                if (operation?.operation === "bind-pointer")
                    result.push(value);
                else
                    pending.push(value);
            }
        }
        return result;
    });
    return Object.freeze({ address, identities });
}
//# sourceMappingURL=pointer-locations.js.map
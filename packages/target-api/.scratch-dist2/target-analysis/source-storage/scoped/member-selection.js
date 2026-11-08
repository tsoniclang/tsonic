import { sourceAnalysisValueType } from "../../analysis-program.js";
import { sourcePresentStorageArms, sourceStorageInstanceType } from "../model/components.js";
import { sourceMemberOwner } from "../../../source-model/class-members.js";
import { sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
export function createSourceStoragePhysicalMembers(source, budget, transport, queries) {
    return (receiver, target, receiverType, mode, view) => {
        const { ast, navigation } = source;
        const admits = (declaration) => mode === "read" ? !ast.is.IsSetAccessorDeclaration(declaration)
            : !ast.is.IsGetAccessorDeclaration(declaration);
        const unresolved = (reason) => ({ kind: "known", members: Object.freeze([]), absent: false, excluded: false, reason });
        const allocation = receiver.subject.node;
        const construction = receiver.kind !== "input-frontier" && ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate => navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
            ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
        if (!construction) {
            const symbolic = queries.symbolic(receiver);
            const selectedView = symbolic ? view : receiver.subject;
            // The correspondence of a union receiver is the one of the union member that declares the target.
            const declaring = () => {
                const arms = sourcePresentStorageArms(receiverType);
                const members = arms.length > 1 ? arms.filter(arm => source.facts.objects.joinedMembers(arm)?.some(member => member.declarations.includes(target)) === true) : [];
                return members.length === 1 ? members[0] : receiverType;
            };
            const declared = declaring();
            if (transport.memberFlow.excludes(selectedView, declared))
                return { kind: "known", members: Object.freeze([]), absent: false, excluded: true };
            const correspondence = transport.memberFlow.memberFor(selectedView, target, declared);
            if (correspondence === undefined)
                return unresolved("Source storage members require exact checked correspondence.");
            if (correspondence.kind === "absent") {
                if (!correspondence.destination.optional)
                    return unresolved("Source storage members require exact checked correspondence.");
                const subject = sourceStorageMemberSubject(target, ast, transport.subject);
                const written = subject !== undefined && (transport.storedValuesFor(subject)?.length ?? 0) !== 0;
                return { kind: "known", members: Object.freeze(written ? [{ subject: subject, bindings: receiver.scope }] : []),
                    absent: true, excluded: false };
            }
            const declarations = correspondence.source.declarations;
            const members = [];
            for (const declaration of declarations) {
                if (!budget.step())
                    return undefined;
                if (!admits(declaration))
                    continue;
                const subject = sourceStorageMemberSubject(declaration, ast, transport.subject);
                if (subject === undefined)
                    return undefined;
                members.push(Object.freeze({ subject, bindings: receiver.scope }));
            }
            if (declarations.length > 0 && members.length === 0)
                return unresolved("Source storage correspondence does not provide the actual checked member operation mode.");
            const optional = correspondence.source.optional;
            return { kind: "known", members: Object.freeze(members), absent: members.length === 0 || optional, excluded: false };
        }
        const owner = sourceMemberOwner(ast, target);
        const contract = owner === undefined ? undefined
            : ast.is.IsTypeLiteralNode(owner) || ast.is.IsObjectLiteralExpression(owner) ? sourceAnalysisValueType(source, owner)
                : ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner) ? sourceStorageInstanceType(source, owner)
                    // An interface owner: the receiver arm that applies that interface (its Host descriptor, with its type arguments).
                    : sourcePresentStorageArms(receiverType).find(arm => arm.kind === "declared" && arm.declaration === owner);
        const operand = transport.invocationTargets.get(allocation);
        if (contract === undefined || operand === undefined)
            return unresolved("Source storage members require their checked construction contract.");
        const values = queries.read(sourceStorageReference(operand, receiver.scope));
        if (values === undefined)
            return undefined;
        const members = [];
        let absent = false;
        let excluded = false;
        let completed = false;
        let reason;
        for (const value of values) {
            if (!budget.step())
                return undefined;
            if (value.kind === "unresolved") {
                reason ?? (reason = value.reason);
                continue;
            }
            if (value.kind !== "leaf")
                continue;
            const lineages = queries.lineages(value);
            if (lineages === undefined)
                return undefined;
            for (const lineage of lineages) {
                if (!budget.step())
                    return undefined;
                const root = lineage.classes[0];
                if (!lineage.complete || root === undefined) {
                    reason ?? (reason = "Source storage members require exact checked correspondence.");
                    continue;
                }
                const selected = transport.memberFlow.membersInLineage(lineage, target, contract);
                if (selected === undefined) {
                    reason ?? (reason = "Source storage members require exact checked correspondence.");
                    continue;
                }
                if (selected.members.length !== 0 && !selected.members.some(member => admits(member.declaration))) {
                    reason ?? (reason = "A physical source member does not provide the actual checked member operation mode.");
                    continue;
                }
                for (const member of selected.members) {
                    if (!budget.step())
                        return undefined;
                    if (!admits(member.declaration))
                        continue;
                    const subject = sourceStorageMemberSubject(member.declaration, ast, transport.subject);
                    if (subject === undefined)
                        return undefined;
                    if (!members.some(previous => previous.subject === subject && previous.bindings === member.bindings))
                        members.push(Object.freeze({ subject, bindings: member.bindings }));
                }
                completed = true;
                absent || (absent = selected.absent);
                excluded || (excluded = selected.members.length === 0 && !selected.absent);
            }
        }
        return completed || reason !== undefined ? { kind: "known", members: Object.freeze(members), absent, excluded, reason } : { kind: "pending" };
    };
}
// A member read through an unbound or symbolic input or receiver yields the member's own subject (scoped successors). The
// same member reached as a projection of that input is the same symbolic location, so a store recorded on one is a store
// of the other.
export function sourceStorageSymbolicMemberAlias(transport, symbolic, left, right) {
    for (const [projected, member] of [[left, right], [right, left]]) {
        const last = projected.subject.projection[projected.subject.projection.length - 1];
        if ((projected.subject.kind !== "input" && projected.subject.kind !== "receiver") || last === undefined ||
            !sourceStorageIsMemberProjection(last) || member.subject.projection.length !== 0 || member.subject.node !== last.declaration)
            continue;
        const base = transport.subject(projected.subject.node, projected.subject.kind, projected.subject.projection.slice(0, -1));
        if (base !== undefined && symbolic(base, projected.scope))
            return true;
    }
    return false;
}
//# sourceMappingURL=member-selection.js.map
import { Node_Expression, sourceLexicalCaptures, sourceReceiverOwner } from "../../../source-navigation/index.js";
import { sourceStorageComponents, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageInvocationReceiver } from "../model/host-reads.js";
import { createSourceStorageContextApplications } from "./context-applications.js";
export function createSourceStorageContextInputs(source, budget, queries, graph) {
    const selections = new Map();
    const inputsFor = (origin) => {
        if (!budget.step())
            return undefined;
        const cached = selections.get(origin);
        if (cached !== undefined)
            return cached;
        const { ast, navigation } = source;
        const node = origin.node;
        if ((origin.kind === "input" || origin.kind === "receiver") && origin.projection.length !== 0) {
            const owner = queries.subject(node, origin.kind);
            if (owner === undefined || !budget.row())
                return undefined;
            const inputs = new Set([owner]);
            selections.set(origin, inputs);
            return inputs;
        }
        const invocation = queries.isInvocation(node);
        const access = origin.kind === "value" && (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
        const member = !access ? undefined : navigation.memberAccess(node);
        if (access && member === undefined)
            return undefined;
        const incoming = invocation || access ? undefined : queries.incomingFor(origin);
        const rows = budget.createRows();
        let complete = false;
        try {
            if (!rows.add(1))
                return undefined;
            const inputs = new Set();
            const add = (selected) => {
                const input = selected !== undefined && (selected.kind === "input" || selected.kind === "receiver") &&
                    selected.projection.length !== 0 ? queries.subject(selected.node, selected.kind) : selected;
                if (input !== undefined && !inputs.has(input) && rows.add(1))
                    inputs.add(input);
            };
            for (const input of incoming ?? []) {
                if (!budget.step())
                    return undefined;
                add(input);
            }
            if (member !== undefined) {
                const receiver = queries.subjectFor(member.receiver);
                if (receiver === undefined)
                    return undefined;
                add(receiver);
            }
            if (origin.kind === "value" && origin.projection.length === 0) {
                if (ast.is.IsObjectLiteralExpression(node))
                    for (const property of ast.properties(node)) {
                        if (!budget.step())
                            return undefined;
                        add(queries.subject(property));
                    }
                if (ast.is.IsArrayLiteralExpression(node)) {
                    const file = queries.sourceFileFor(origin);
                    const type = sourceStorageSubjectType(source, origin, file);
                    if (file !== undefined && type !== undefined)
                        for (const component of sourceStorageComponents(type)) {
                            if (!budget.step())
                                return undefined;
                            add(queries.subject(node, "value", [component]));
                        }
                }
                if (ast.body(node) !== undefined || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
                    const captures = sourceLexicalCaptures(node, [node], ast, navigation, "source");
                    for (const capture of captures.captures) {
                        if (!budget.step())
                            return undefined;
                        add(queries.subjectFor(capture.declaration));
                    }
                    for (const receiver of captures.receivers) {
                        for (const reference of receiver.references) {
                            if (!budget.step())
                                return undefined;
                            const owner = sourceReceiverOwner(reference, ast, "storage", budget.step);
                            if (owner === undefined)
                                return undefined;
                            add(queries.subject(owner, "receiver"));
                        }
                    }
                }
            }
            if (invocation) {
                add(queries.subjectFor(Node_Expression(ast, node)));
                add(queries.subjectFor(sourceStorageInvocationReceiver(source, node) ?? navigation.memberAccess(node)?.receiver));
            }
            if (budget.failure() !== undefined)
                return undefined;
            selections.set(origin, inputs);
            complete = true;
            return inputs;
        }
        finally {
            if (!complete)
                rows.release();
        }
    };
    const applicationFor = createSourceStorageContextApplications(source, budget, { ...queries, inputsFor }, graph);
    return Object.assign(inputsFor, { applicationFor });
}
//# sourceMappingURL=context-inputs.js.map
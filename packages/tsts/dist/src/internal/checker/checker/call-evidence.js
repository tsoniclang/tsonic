import { Node_Expression, Node_Type } from "../../ast/ast.js";
import { AsElementAccessExpression } from "../../ast/generated/casts.js";
import { IsParenthesizedExpression } from "../../ast/generated/predicates.js";
import { IsAliasSymbolDeclaration, IsCallOrNewExpression } from "../../ast/utilities.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import { journalSelectedCallEvidence } from "./selected-call-evidence-transaction.js";
import { preserveEquivalentSourceType } from "./source-type-identity.js";
export function callEvidenceWantedForCallee(callee) {
    return checkedCallForCallee(callee) !== undefined;
}
export function retainIdentifierCallCalleeEvidence(checker, identifier, sourceSymbol, selectedSymbol) {
    if (checker === undefined || identifier === undefined) {
        return;
    }
    const callExpression = checkedCallForCallee(identifier);
    if (callExpression === undefined) {
        return;
    }
    const canonicalSourceSymbol = knownSymbol(checker, sourceSymbol);
    const canonicalSelectedSymbol = knownSymbol(checker, selectedSymbol);
    const sourceDeclaration = aliasDeclaration(canonicalSourceSymbol)
        ?? canonicalSourceSymbol?.ValueDeclaration;
    const selectedDeclaration = canonicalSelectedSymbol?.ValueDeclaration;
    const declaration = selectedDeclaration ?? sourceDeclaration;
    const authoredTypeNode = declaration === undefined
        ? undefined
        : Node_Type(declaration);
    retainCallSelectionSeed(checker, callExpression, {
        calleeProvenance: Object.freeze({
            ...(canonicalSourceSymbol === undefined ? {} : { symbol: canonicalSourceSymbol }),
            ...(sourceDeclaration === undefined ? {} : { declaration: sourceDeclaration }),
            ...(canonicalSelectedSymbol === undefined ? {} : { selectedSymbol: canonicalSelectedSymbol }),
            ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
            ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        }),
    });
}
export function retainPropertyCallCalleeEvidence(checker, propertyAccessExpression, evidence) {
    if (checker === undefined || propertyAccessExpression === undefined) {
        return;
    }
    const receiver = Node_Expression(propertyAccessExpression);
    const callExpression = checkedCallForCallee(propertyAccessExpression);
    if (receiver === undefined || callExpression === undefined) {
        return;
    }
    if (evidence.resultType === undefined || evidence.receiverType === undefined) {
        throw new Error("Property call-callee evidence requires exact receiver and result types.");
    }
    const sourceSymbol = knownSymbol(checker, evidence.sourceSymbol);
    const selectedSymbol = knownSymbol(checker, evidence.selectedSymbol);
    const sourceDeclaration = evidence.sourceDeclaration ?? sourceSymbol?.ValueDeclaration;
    const selectedDeclaration = evidence.selectedDeclaration ?? selectedSymbol?.ValueDeclaration;
    const receiverEvidence = Object.freeze({
        expression: receiver,
        type: evidence.receiverType,
        ...(evidence.receiverSymbol === undefined ? {} : { symbol: evidence.receiverSymbol }),
        ...(evidence.receiverDeclaration === undefined ? {} : { declaration: evidence.receiverDeclaration }),
    });
    retainCallSelectionSeed(checker, callExpression, {
        calleeProvenance: selectionProvenance(sourceSymbol, sourceDeclaration, selectedSymbol, selectedDeclaration),
        receiver: receiverEvidence,
        calleeAccess: Object.freeze({
            kind: "property",
            expression: propertyAccessExpression,
            receiver: receiverEvidence,
            resultType: evidence.resultType,
            ...(evidence.sourceSymbol === undefined ? {} : { symbol: evidence.sourceSymbol }),
            ...(evidence.sourceDeclaration === undefined ? {} : { declaration: evidence.sourceDeclaration }),
            ...(evidence.selectedSymbol === undefined ? {} : { selectedSymbol: evidence.selectedSymbol }),
            ...(evidence.selectedDeclaration === undefined ? {} : { selectedDeclaration: evidence.selectedDeclaration }),
        }),
    });
}
export function retainElementCallCalleeEvidence(checker, elementAccessExpression, evidence) {
    if (checker === undefined || elementAccessExpression === undefined) {
        return;
    }
    const receiver = Node_Expression(elementAccessExpression);
    const argument = AsElementAccessExpression(elementAccessExpression)?.ArgumentExpression;
    const callExpression = checkedCallForCallee(elementAccessExpression);
    if (receiver === undefined || argument === undefined || callExpression === undefined) {
        return;
    }
    if (evidence.resultType === undefined
        || evidence.receiverType === undefined
        || evidence.argumentType === undefined) {
        throw new Error("Element call-callee evidence requires exact receiver, argument, and result types.");
    }
    const sourceSymbol = knownSymbol(checker, evidence.sourceSymbol);
    const selectedSymbol = knownSymbol(checker, evidence.selectedSymbol);
    const sourceDeclaration = evidence.sourceDeclaration ?? sourceSymbol?.ValueDeclaration;
    const selectedDeclaration = evidence.selectedDeclaration ?? selectedSymbol?.ValueDeclaration;
    const receiverEvidence = Object.freeze({
        expression: receiver,
        type: evidence.receiverType,
    });
    retainCallSelectionSeed(checker, callExpression, {
        calleeProvenance: selectionProvenance(sourceSymbol, sourceDeclaration, selectedSymbol, selectedDeclaration),
        receiver: receiverEvidence,
        calleeAccess: Object.freeze({
            kind: "element",
            expression: elementAccessExpression,
            receiver: receiverEvidence,
            argument: Object.freeze({
                expression: argument,
                type: evidence.argumentType,
            }),
            resultType: evidence.resultType,
            ...(evidence.selectedElementIndex === undefined
                ? {}
                : { selectedElementIndex: evidence.selectedElementIndex }),
            ...(evidence.sourceSymbol === undefined ? {} : { symbol: evidence.sourceSymbol }),
            ...(evidence.sourceDeclaration === undefined ? {} : { declaration: evidence.sourceDeclaration }),
            ...(evidence.selectedSymbol === undefined ? {} : { selectedSymbol: evidence.selectedSymbol }),
            ...(evidence.selectedDeclaration === undefined ? {} : { selectedDeclaration: evidence.selectedDeclaration }),
        }),
    });
}
function retainCallSelectionSeed(checker, callExpression, incoming) {
    const links = LinkStore_Get(checker.signatureLinks, callExpression);
    journalSelectedCallEvidence(checker, links);
    const existing = links.checkedCallSelectionSeed;
    const calleeProvenance = mergeSelectionProvenance(existing?.calleeProvenance, incoming.calleeProvenance);
    const receiver = mergeSourceValueEvidence(existing?.receiver, incoming.receiver);
    const calleeAccess = mergeCalleeAccessEvidence(existing?.calleeAccess, incoming.calleeAccess);
    const seed = Object.freeze({
        ...(calleeProvenance === undefined ? {} : { calleeProvenance }),
        ...(receiver === undefined ? {} : { receiver }),
        ...(calleeAccess === undefined ? {} : { calleeAccess }),
    });
    links.checkedCallSelectionSeed = seed;
    return seed;
}
function mergeCalleeAccessEvidence(existing, incoming) {
    if (existing === undefined) {
        return incoming;
    }
    if (incoming === undefined) {
        return existing;
    }
    if (existing.kind !== incoming.kind || existing.expression !== incoming.expression) {
        throw new Error("Call callee-access evidence conflicted before signature finalization.");
    }
    const receiver = mergeSourceValueEvidence(existing.receiver, incoming.receiver);
    const resultType = preserveEquivalentSourceType(existing.resultType, incoming.resultType);
    if (receiver === undefined || resultType === undefined) {
        throw new Error("Call callee-access evidence lost its receiver or result type.");
    }
    const provenance = mergeProvenanceFields(existing, incoming, "callee");
    if (existing.kind === "property") {
        return Object.freeze({
            kind: "property",
            expression: existing.expression,
            receiver,
            resultType,
            ...provenance,
        });
    }
    if (incoming.kind !== "element" || existing.selectedElementIndex !== incoming.selectedElementIndex) {
        throw new Error("Element call-callee evidence conflicted before signature finalization.");
    }
    const argument = mergeSourceValueEvidence(existing.argument, incoming.argument);
    if (argument === undefined) {
        throw new Error("Element call-callee evidence lost its argument.");
    }
    return Object.freeze({
        kind: "element",
        expression: existing.expression,
        receiver,
        argument,
        resultType,
        ...(existing.selectedElementIndex === undefined
            ? {}
            : { selectedElementIndex: existing.selectedElementIndex }),
        ...provenance,
    });
}
function mergeSelectionProvenance(existing, incoming) {
    if (existing === undefined) {
        return incoming === undefined ? undefined : Object.freeze({ ...incoming });
    }
    if (incoming === undefined) {
        return existing;
    }
    return Object.freeze(mergeProvenanceFields(existing, incoming, "callee"));
}
function mergeSourceValueEvidence(existing, incoming) {
    if (existing === undefined) {
        return incoming === undefined ? undefined : Object.freeze({ ...incoming });
    }
    if (incoming === undefined) {
        return existing;
    }
    if (existing.expression !== incoming.expression || existing.type !== incoming.type) {
        throw new Error("Call receiver evidence conflicted before signature finalization.");
    }
    return Object.freeze({
        expression: existing.expression,
        type: existing.type,
        ...mergeProvenanceFields(existing, incoming, "receiver"),
    });
}
function mergeProvenanceFields(existing, incoming, subject) {
    const symbol = mergeIdentity(existing.symbol, incoming.symbol, subject, "symbol");
    const declaration = mergeIdentity(existing.declaration, incoming.declaration, subject, "declaration");
    const selectedSymbol = mergeIdentity(existing.selectedSymbol, incoming.selectedSymbol, subject, "selectedSymbol");
    const selectedDeclaration = mergeIdentity(existing.selectedDeclaration, incoming.selectedDeclaration, subject, "selectedDeclaration");
    const authoredTypeNode = mergeIdentity(existing.authoredTypeNode, incoming.authoredTypeNode, subject, "authoredTypeNode");
    return Object.freeze({
        ...(symbol === undefined ? {} : { symbol }),
        ...(declaration === undefined ? {} : { declaration }),
        ...(selectedSymbol === undefined ? {} : { selectedSymbol }),
        ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    });
}
function mergeIdentity(existing, incoming, subject, field) {
    if (existing !== undefined && incoming !== undefined && existing !== incoming) {
        throw new Error(`Call ${subject} ${field} conflicted before signature finalization.`);
    }
    return existing ?? incoming;
}
function selectionProvenance(sourceSymbol, sourceDeclaration, selectedSymbol, selectedDeclaration) {
    const declaration = selectedDeclaration ?? sourceDeclaration;
    const authoredTypeNode = declaration === undefined
        ? undefined
        : Node_Type(declaration);
    return Object.freeze({
        ...(sourceSymbol === undefined ? {} : { symbol: sourceSymbol }),
        ...(sourceDeclaration === undefined ? {} : { declaration: sourceDeclaration }),
        ...(selectedSymbol === undefined ? {} : { selectedSymbol }),
        ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    });
}
function checkedCallForCallee(callee) {
    let current = callee;
    while (current !== undefined && IsParenthesizedExpression(current.Parent)) {
        current = current.Parent;
    }
    const parent = current?.Parent;
    return IsCallOrNewExpression(parent) && Node_Expression(parent) === current
        ? parent
        : undefined;
}
function knownSymbol(checker, symbol) {
    return symbol === undefined || symbol === checker.unknownSymbol ? undefined : symbol;
}
function aliasDeclaration(symbol) {
    const declarations = symbol?.Declarations ?? [];
    for (let index = declarations.length - 1; index >= 0; index--) {
        const declaration = declarations[index];
        if (declaration !== undefined && IsAliasSymbolDeclaration(declaration)) {
            return declaration;
        }
    }
    return undefined;
}
//# sourceMappingURL=call-evidence.js.map
import { Node_Expression, Node_Type } from "../../ast/ast.js";
import { AsElementAccessExpression } from "../../ast/generated/casts.js";
import { IsParenthesizedExpression } from "../../ast/generated/predicates.js";
import { IsAliasSymbolDeclaration, IsCallOrNewExpression } from "../../ast/utilities.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import { journalSelectedCallEvidence } from "./selected-call-evidence-transaction.js";
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
    const seed = Object.freeze({ ...incoming });
    links.checkedCallSelectionSeed = seed;
    return seed;
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
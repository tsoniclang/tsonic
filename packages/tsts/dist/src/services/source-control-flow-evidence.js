import { Node_Expression, Node_Initializer, } from "../internal/ast/ast.js";
import { FunctionFlagsAsync, FunctionFlagsGenerator, GetFunctionFlags, } from "../internal/ast/functionflags.js";
import { NodeFlagsAwaitUsing, NodeFlagsBlockScoped, NodeFlagsUsing, } from "../internal/ast/generated/flags.js";
import { IsComputedPropertyName, IsForOfStatement, IsVariableDeclaration, IsVariableDeclarationList, IsYieldExpression, } from "../internal/ast/generated/predicates.js";
import { AsYieldExpression } from "../internal/ast/generated/casts.js";
import { GetContainingFunction, } from "../internal/ast/utilities.js";
import { Checker_GetReturnTypeOfSignature, } from "../internal/checker/exports.js";
import { Checker_getIterationTypesOfGeneratorFunctionReturnType, Checker_getSignatureFromDeclaration, } from "../internal/checker/checker/signatures.js";
import { Checker_checkExpressionCached, Checker_checkYieldExpression, Checker_getCombinedNodeFlagsCached, Checker_getResolvedSourceIterationInfo, } from "../internal/checker/checker/syntax-checking.js";
import { Checker_checkYieldStarWithExtensionSelection, Checker_GetTypeAtLocation, Checker_getYieldedTypeOfYieldExpression, } from "../internal/checker/checker/types.js";
import { Checker_getPropertyOfType, Checker_getResolvedSymbolOrNil, Checker_getTypeOfSymbol, Checker_widenTypeForVariableLikeDeclaration, } from "../internal/checker/checker/symbols.js";
import { TypeFlagsAny, TypeFlagsNever, TypeFlagsNull, TypeFlagsUndefined, TypeFlagsUnion, Type_Types, } from "../internal/checker/types.js";
import { getPropertyNameFromType } from "../internal/checker/utilities.js";
export function resolveSourceGeneratorInfo(checker, declaration) {
    if (checker === undefined || declaration === undefined) {
        return undefined;
    }
    const functionFlags = GetFunctionFlags(declaration);
    if ((functionFlags & FunctionFlagsGenerator) === 0) {
        return undefined;
    }
    const signature = Checker_getSignatureFromDeclaration(checker, declaration);
    if (signature === undefined) {
        return undefined;
    }
    const sourceReturnType = Checker_GetReturnTypeOfSignature(checker, signature);
    if (sourceReturnType === undefined) {
        return undefined;
    }
    const asynchronous = (functionFlags & FunctionFlagsAsync) !== 0;
    const iterationTypes = Checker_getIterationTypesOfGeneratorFunctionReturnType(checker, sourceReturnType, asynchronous);
    const yieldType = iterationTypes.yieldType;
    const returnType = iterationTypes.returnType;
    const nextType = iterationTypes.nextType;
    if (yieldType === undefined
        || returnType === undefined
        || nextType === undefined) {
        return undefined;
    }
    return Object.freeze({
        declaration,
        generatorKind: asynchronous ? "async" : "sync",
        sourceReturnType,
        iterationTypes: Object.freeze({ yieldType, returnType, nextType }),
    });
}
export function resolveSourceYieldInfo(checker, yieldExpression, generator) {
    if (checker === undefined
        || yieldExpression === undefined
        || generator === undefined
        || !IsYieldExpression(yieldExpression)
        || GetContainingFunction(yieldExpression) !== generator.declaration) {
        return undefined;
    }
    const sourceResumeType = Checker_checkYieldExpression(checker, yieldExpression);
    if (sourceResumeType === undefined) {
        return undefined;
    }
    const expression = Node_Expression(yieldExpression);
    const operandType = expression === undefined
        ? checker.undefinedWideningType
        : Checker_checkExpressionCached(checker, expression);
    if (operandType === undefined) {
        return undefined;
    }
    const asynchronous = generator.generatorKind === "async";
    const sourceYieldType = Checker_getYieldedTypeOfYieldExpression(checker, yieldExpression, operandType, generator.iterationTypes.nextType, asynchronous);
    if (sourceYieldType === undefined) {
        return undefined;
    }
    const isDelegation = AsYieldExpression(yieldExpression)?.AsteriskToken !== undefined;
    if (!isDelegation) {
        return Object.freeze({
            yieldExpression,
            generator,
            yieldKind: "value",
            ...(expression === undefined
                ? {}
                : { operand: Object.freeze({ expression, type: operandType }) }),
            sourceYieldType,
            sourceResumeType,
        });
    }
    const delegation = Checker_checkYieldStarWithExtensionSelection(checker, operandType, generator.iterationTypes.nextType, asynchronous);
    if (delegation === undefined || expression === undefined) {
        return undefined;
    }
    const delegatedYieldType = delegation.iterationTypes.yieldType;
    const delegatedReturnType = delegation.iterationTypes.returnType;
    const delegatedNextType = delegation.iterationTypes.nextType;
    if (delegatedYieldType === undefined
        || delegatedReturnType === undefined
        || delegatedNextType === undefined) {
        return undefined;
    }
    return Object.freeze({
        yieldExpression,
        generator,
        yieldKind: "delegate",
        operand: Object.freeze({ expression, type: operandType }),
        sourceYieldType,
        sourceResumeType,
        delegation: Object.freeze({
            kind: delegation.mechanism.kind,
            sourceIterableType: delegation.sourceIterableType,
            iterationTypes: Object.freeze({
                yieldType: delegatedYieldType,
                returnType: delegatedReturnType,
                nextType: delegatedNextType,
            }),
            mechanism: delegation.mechanism,
        }),
    });
}
export function resolveSourceWellKnownSymbolInfo(checker, node) {
    if (checker === undefined || node === undefined) {
        return undefined;
    }
    const expression = IsComputedPropertyName(node) ? Node_Expression(node) : node;
    if (expression === undefined) {
        return undefined;
    }
    const sourceType = Checker_GetTypeAtLocation(checker, expression);
    if (sourceType === undefined) {
        return undefined;
    }
    for (const [kind, propertyName] of wellKnownSymbolProperties) {
        const selected = resolveGlobalWellKnownSymbol(checker, propertyName);
        if (selected !== undefined && selected.type === sourceType) {
            const sourceSymbol = Checker_getResolvedSymbolOrNil(checker, expression);
            const sourceDeclaration = primaryDeclaration(sourceSymbol);
            const wellKnownDeclaration = primaryDeclaration(selected.symbol);
            return Object.freeze({
                kind,
                expression,
                ...(sourceSymbol === undefined ? {} : { sourceSymbol }),
                ...(sourceDeclaration === undefined ? {} : { sourceDeclaration }),
                wellKnownSymbol: selected.symbol,
                ...(wellKnownDeclaration === undefined ? {} : { wellKnownDeclaration }),
                type: sourceType,
            });
        }
    }
    return undefined;
}
export function resolveSourceResourceManagementInfo(checker, declaration) {
    if (checker === undefined
        || declaration === undefined
        || !IsVariableDeclaration(declaration)) {
        return undefined;
    }
    const flags = Checker_getCombinedNodeFlagsCached(checker, declaration)
        & NodeFlagsBlockScoped;
    const declarationKind = flags === NodeFlagsAwaitUsing
        ? "await using"
        : flags === NodeFlagsUsing
            ? "using"
            : undefined;
    if (declarationKind === undefined) {
        return undefined;
    }
    const acquisition = resolveResourceAcquisition(checker, declaration);
    if (acquisition === undefined) {
        return undefined;
    }
    const sourceResourceType = acquisition.sourceResourceType;
    if ((sourceResourceType.flags & TypeFlagsAny) !== 0) {
        return Object.freeze({
            declaration,
            declarationKind,
            acquisition: acquisition.evidence,
            sourceResourceType,
            acceptsNullish: true,
            disposal: Object.freeze({
                kind: "untyped-dynamic",
                sourceType: sourceResourceType,
            }),
        });
    }
    const alternatives = [];
    for (const sourceType of nonNullishAlternatives(sourceResourceType)) {
        const selected = declarationKind === "await using"
            ? resolveDisposer(checker, sourceType, "async")
                ?? resolveDisposer(checker, sourceType, "sync")
            : resolveDisposer(checker, sourceType, "sync");
        if (selected === undefined) {
            return undefined;
        }
        alternatives.push(selected);
    }
    if (alternatives.length === 0) {
        return undefined;
    }
    return Object.freeze({
        declaration,
        declarationKind,
        acquisition: acquisition.evidence,
        sourceResourceType,
        acceptsNullish: true,
        disposal: Object.freeze({
            kind: "selected",
            alternatives: Object.freeze(alternatives),
        }),
    });
}
function resolveResourceAcquisition(checker, declaration) {
    const initializer = Node_Initializer(declaration);
    if (initializer !== undefined) {
        const sourceType = Checker_checkExpressionCached(checker, initializer);
        const sourceResourceType = Checker_widenTypeForVariableLikeDeclaration(checker, sourceType, declaration, false);
        return sourceType === undefined || sourceResourceType === undefined
            ? undefined
            : {
                evidence: Object.freeze({
                    kind: "initializer",
                    expression: initializer,
                    sourceType,
                }),
                sourceResourceType,
            };
    }
    const declarationList = declaration.Parent;
    const statement = declarationList?.Parent;
    if (declarationList === undefined
        || statement === undefined
        || !IsVariableDeclarationList(declarationList)
        || !IsForOfStatement(statement)) {
        return undefined;
    }
    const iteration = Checker_getResolvedSourceIterationInfo(checker, statement);
    if (iteration === undefined) {
        return undefined;
    }
    return {
        evidence: Object.freeze({
            kind: "iteration",
            statement,
            sourceType: iteration.sourceElementType,
        }),
        sourceResourceType: iteration.sourceElementType,
    };
}
const wellKnownSymbolProperties = Object.freeze([
    ["has-instance", "hasInstance"],
    ["is-concat-spreadable", "isConcatSpreadable"],
    ["iterator", "iterator"],
    ["async-iterator", "asyncIterator"],
    ["match", "match"],
    ["match-all", "matchAll"],
    ["replace", "replace"],
    ["search", "search"],
    ["species", "species"],
    ["split", "split"],
    ["to-primitive", "toPrimitive"],
    ["to-string-tag", "toStringTag"],
    ["unscopables", "unscopables"],
    ["dispose", "dispose"],
    ["async-dispose", "asyncDispose"],
]);
function resolveGlobalWellKnownSymbol(checker, propertyName) {
    const symbolConstructor = checker.getGlobalESSymbolConstructorSymbolOrNil();
    if (symbolConstructor === undefined) {
        return undefined;
    }
    const constructorType = Checker_getTypeOfSymbol(checker, symbolConstructor);
    if (constructorType === undefined) {
        return undefined;
    }
    const symbol = Checker_getPropertyOfType(checker, constructorType, propertyName);
    if (symbol === undefined) {
        return undefined;
    }
    const type = Checker_getTypeOfSymbol(checker, symbol);
    return type === undefined
        ? undefined
        : { symbol, type };
}
function resolveDisposer(checker, sourceType, kind) {
    const global = resolveGlobalWellKnownSymbol(checker, kind === "async" ? "asyncDispose" : "dispose");
    if (global === undefined) {
        return undefined;
    }
    const propertyKey = getPropertyNameFromType(global.type);
    const selectedSymbol = Checker_getPropertyOfType(checker, sourceType, propertyKey);
    if (selectedSymbol === undefined) {
        return undefined;
    }
    const selectedType = Checker_getTypeOfSymbol(checker, selectedSymbol);
    if (selectedType === undefined) {
        return undefined;
    }
    const selectedDeclaration = primaryDeclaration(selectedSymbol);
    return Object.freeze({
        sourceType,
        kind,
        selectedSymbol,
        ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
        selectedType,
    });
}
function nonNullishAlternatives(type) {
    const alternatives = (type.flags & TypeFlagsUnion) !== 0
        ? Type_Types(type)
        : [type];
    return alternatives.filter((alternative) => alternative !== undefined
        && (alternative.flags & (TypeFlagsNull | TypeFlagsUndefined | TypeFlagsNever)) === 0);
}
function primaryDeclaration(symbol) {
    return symbol?.ValueDeclaration
        ?? symbol?.Declarations?.find((declaration) => declaration !== undefined);
}
//# sourceMappingURL=source-control-flow-evidence.js.map

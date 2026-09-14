import { Node_Type, Node_TypeParameters } from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { IsTypeAliasDeclaration, IsTypeParameterDeclaration } from "../internal/ast/generated/predicates.js";
import { AsTypeParameterDeclaration } from "../internal/ast/generated/casts.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Checker_GetDeclaredTypeOfSymbol, Checker_GetTypeFromTypeNode } from "../internal/checker/exports.js";
import { Checker_GetSymbolAtLocation } from "../internal/checker/checker/symbols.js";
import { Checker_instantiateType } from "../internal/checker/checker/types.js";
import { Checker_combineTypeMappers, newTypeMapper } from "../internal/checker/mapper.js";
import { Checker_isTypeAssignableTo, Checker_isTypeIdenticalTo } from "../internal/checker/relater.js";
import { createExtensionConditionalCapture } from "../internal/checker/checker/conditional-evidence.js";
import { Checker_getConditionalTypeInstantiationWithCapture } from "../internal/checker/checker/inference.js";
import { Type_AsConditionalType, TypeFlagsConditional, TypeFlagsTypeParameter } from "../internal/checker/types.js";
export function resolveTypeAliasApplication(checker, declaration, arguments_) {
    if (declaration === undefined || !IsTypeAliasDeclaration(declaration) || !Array.isArray(arguments_))
        return undefined;
    const parameters = Node_TypeParameters(declaration) ?? [];
    if (parameters.length !== arguments_.length)
        return undefined;
    for (const parameter of parameters) {
        if (parameter === undefined)
            return undefined;
    }
    for (const argument of arguments_) {
        if (argument === undefined || argument === null)
            return undefined;
    }
    const sourceFile = GetSourceFileOfNode(declaration);
    if (checker === undefined || sourceFile === undefined || !checker.fileIndexMap.has(sourceFile) ||
        arguments_.some(argument => argument.checker !== checker || argument === checker.errorType))
        return undefined;
    const typeNode = Node_Type(declaration);
    if (typeNode === undefined)
        return undefined;
    const sourceParameters = [];
    for (const parameter of parameters) {
        const symbol = Checker_GetSymbolAtLocation(checker, Node_Name(parameter));
        const type = symbol === undefined ? undefined : Checker_GetDeclaredTypeOfSymbol(checker, symbol);
        if (type === undefined || type.checker !== checker || (type.flags & TypeFlagsTypeParameter) === 0 ||
            sourceParameters.includes(type))
            return undefined;
        sourceParameters.push(type);
    }
    const template = Checker_GetTypeFromTypeNode(checker, typeNode);
    if (template === undefined || template === checker.errorType)
        return undefined;
    const mapper = sourceParameters.length === 0 ? undefined : newTypeMapper(sourceParameters, [...arguments_]);
    for (const [index, parameter] of parameters.entries()) {
        const constraintNode = AsTypeParameterDeclaration(parameter)?.Constraint;
        if (constraintNode === undefined)
            continue;
        const constraint = Checker_GetTypeFromTypeNode(checker, constraintNode);
        const instantiated = constraint === undefined ? undefined : Checker_instantiateType(checker, constraint, mapper);
        if (instantiated === undefined || instantiated === checker.errorType ||
            !Checker_isTypeAssignableTo(checker, arguments_[index], instantiated))
            return undefined;
    }
    const result = Checker_instantiateType(checker, template, mapper);
    if (result === undefined || result === checker.errorType)
        return undefined;
    const conditionalSteps = captureConditionalApplication(checker, template, mapper, result, sourceParameters);
    if (conditionalSteps === undefined)
        return undefined;
    return Object.freeze({
        kind: (template.flags & TypeFlagsConditional) === 0 ? "direct" : "conditional",
        declaration,
        typeNode,
        bindings: Object.freeze(parameters.map((parameter, index) => Object.freeze({
            declaration: parameter, parameter: sourceParameters[index], argument: arguments_[index],
        }))),
        result,
        conditionalSteps,
    });
}
function captureConditionalApplication(checker, template, mapper, result, sourceParameters) {
    if ((template.flags & TypeFlagsConditional) === 0)
        return Object.freeze([]);
    const conditional = Type_AsConditionalType(template);
    if (conditional?.root === undefined)
        return undefined;
    const capture = createExtensionConditionalCapture();
    const selected = Checker_getConditionalTypeInstantiationWithCapture(checker, template, Checker_combineTypeMappers(checker, conditional.mapper, mapper), false, undefined, capture);
    if (!capture.complete || selected === undefined || selected === checker.errorType ||
        !Checker_isTypeIdenticalTo(checker, result, selected))
        return undefined;
    const steps = [];
    for (const step of capture.steps) {
        const bindings = [];
        for (const parameter of step.parameters) {
            const declarations = parameter.symbol?.Declarations;
            if (declarations === undefined || declarations.length === 0 ||
                declarations.some(declaration => declaration === undefined || !IsTypeParameterDeclaration(declaration))) {
                return undefined;
            }
            const argument = Checker_instantiateType(checker, parameter, step.mapper);
            if (argument === undefined || argument === checker.errorType || argument.checker !== checker)
                return undefined;
            const origin = Checker_instantiateType(checker, parameter, conditional.mapper);
            const applicationParameter = sourceParameters.find(candidate => candidate === origin);
            bindings.push(Object.freeze({ parameter, argument,
                ...(applicationParameter === undefined ? {} : { applicationParameter }),
                declarations: Object.freeze([...declarations]) }));
        }
        const selectedType = step.selectedNode === undefined ? undefined : Checker_instantiateType(checker, Checker_GetTypeFromTypeNode(checker, step.selectedNode), step.mapper);
        if (step.selectedNode !== undefined && (selectedType === undefined || selectedType === checker.errorType)) {
            return undefined;
        }
        steps.push(Object.freeze({ conditional: step.conditional, branch: step.branch,
            ...(step.selectedNode === undefined ? {} : { selectedNode: step.selectedNode }),
            ...(selectedType === undefined ? {} : { selectedType }),
            bindings: Object.freeze(bindings) }));
    }
    return Object.freeze(steps);
}
//# sourceMappingURL=type-applications.js.map
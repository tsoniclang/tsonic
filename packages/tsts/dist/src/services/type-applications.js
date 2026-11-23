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
import { createExtensionConditionalCapture } from "../extensions/conditional-type-evidence.js";
import { Checker_getConditionalTypeInstantiationWithCapture } from "../internal/checker/checker/inference.js";
import { Checker_fillMissingTypeArguments, Checker_getMinTypeArgumentCount } from "../internal/checker/checker/signatures.js";
import { getConditionalTypeKey } from "../internal/checker/checker/state.js";
import { Type_AsConditionalType, TypeFlagsConditional, TypeFlagsIndexedAccess, TypeFlagsTypeParameter } from "../internal/checker/types.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { getExtensionHost } from "../extensions/host.js";
import { createTypeNormalization } from "./type-normalization.js";
import { readOwnedIndexedAccess } from "./type-indexed-access.js";
import { flatTypeMapperInputs } from "./type-mapper-inputs.js";
export function readConditionalApplication(checker, result, data) {
    const root = data.root;
    const mapper = data.mapper;
    if (root === undefined || mapper === undefined || root.outerTypeParameters.length === 0)
        return null;
    const inputs = flatTypeMapperInputs(mapper);
    if (inputs === undefined || inputs.sources.length !== root.outerTypeParameters.length
        || inputs.targets.length !== root.outerTypeParameters.length)
        return null;
    const bindings = [];
    for (const [index, parameter] of root.outerTypeParameters.entries()) {
        const argument = inputs.targets[index];
        if (parameter === undefined || inputs.sources[index] !== parameter || parameter.checker !== checker
            || (parameter.flags & TypeFlagsTypeParameter) === 0 || argument === undefined || argument.checker !== checker
            || argument === checker.errorType)
            return null;
        const declarations = parameter.symbol?.Declarations;
        const declaration = declarations?.[0];
        if (declarations?.length !== 1 || declaration === undefined || !IsTypeParameterDeclaration(declaration))
            return null;
        const file = GetSourceFileOfNode(declaration);
        if (file === undefined || !checker.fileIndexMap.has(file))
            return null;
        bindings.push(Object.freeze({ declaration, parameter, argument }));
    }
    if (root.instantiations.get(getConditionalTypeKey(checker, inputs.targets, result.alias, false)) !== result)
        return null;
    return Object.freeze(bindings);
}
export function readTypeAliasApplication(queryChecker, type) {
    const symbol = type?.alias?.symbol;
    if (queryChecker === undefined || type?.checker === undefined || symbol === undefined)
        return undefined;
    const checker = type.checker;
    if (checker !== queryChecker) {
        const owner = getExtensionHost(queryChecker.program);
        if (owner === undefined || getExtensionHost(checker.program) !== owner)
            return undefined;
    }
    if ((type.flags & TypeFlagsIndexedAccess) !== 0 && readOwnedIndexedAccess(checker, type) === undefined)
        return undefined;
    const declarations = symbol.Declarations;
    const declaration = declarations?.[0];
    if (declarations?.length !== 1 || declaration === undefined || !IsTypeAliasDeclaration(declaration))
        return undefined;
    const file = GetSourceFileOfNode(declaration);
    const typeNode = Node_Type(declaration);
    if (file === undefined || !checker.fileIndexMap.has(file) || typeNode === undefined)
        return undefined;
    const links = LinkStore_TryGet(checker.typeAliasLinks, symbol);
    if (links?.declaredType?.checker !== checker || links.declaredType === checker.errorType)
        return undefined;
    const parameters = Node_TypeParameters(declaration) ?? [];
    const sourceParameters = links.typeParameters ?? [];
    const arguments_ = type.alias?.typeArguments ?? [];
    const defaults = type.alias?.defaultTypeArguments ?? [];
    if (sourceParameters.length !== parameters.length || arguments_.length + defaults.length !== parameters.length)
        return undefined;
    const bindings = [];
    for (const [index, source] of parameters.entries()) {
        const parameter = sourceParameters[index];
        const argument = index < arguments_.length ? arguments_[index] : defaults[index - arguments_.length];
        if (source === undefined || parameter?.checker !== checker || (parameter.flags & TypeFlagsTypeParameter) === 0
            || parameter.symbol?.Declarations?.length !== 1 || parameter.symbol.Declarations[0] !== source
            || argument?.checker !== checker || argument === checker.errorType)
            return undefined;
        bindings.push(Object.freeze({ declaration: source, parameter, argument }));
    }
    return Object.freeze({ declaration, typeNode, bindings: Object.freeze(bindings), result: type });
}
export function resolveTypeAliasApplication(queryChecker, declaration, arguments_) {
    if (declaration === undefined || !IsTypeAliasDeclaration(declaration) || !Array.isArray(arguments_))
        return undefined;
    const parameters = Node_TypeParameters(declaration) ?? [];
    if (arguments_.length > parameters.length)
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
    if (queryChecker === undefined || sourceFile === undefined || !queryChecker.fileIndexMap.has(sourceFile))
        return undefined;
    const checker = queryChecker;
    if (!checker.fileIndexMap.has(sourceFile) ||
        arguments_.some(argument => argument.checker === undefined ||
            argument.checker.program.SourceFiles() !== checker.program.SourceFiles() || argument === argument.checker.errorType))
        return undefined;
    let normalization;
    const selectedArguments = arguments_.map(argument => argument.checker === checker ? argument
        : (normalization ??= createTypeNormalization(checker)).type(argument));
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
    const minimumArguments = Checker_getMinTypeArgumentCount(checker, sourceParameters);
    if (arguments_.length < minimumArguments)
        return undefined;
    const effectiveArguments = Checker_fillMissingTypeArguments(checker, selectedArguments, sourceParameters, minimumArguments, false);
    if (effectiveArguments.length !== sourceParameters.length || effectiveArguments.some(argument => argument === undefined || argument === checker.errorType || argument.checker !== checker))
        return undefined;
    const mapper = sourceParameters.length === 0 ? undefined : newTypeMapper(sourceParameters, effectiveArguments);
    for (const [index, parameter] of parameters.entries()) {
        const constraintNode = AsTypeParameterDeclaration(parameter)?.Constraint;
        if (constraintNode === undefined)
            continue;
        const constraint = Checker_GetTypeFromTypeNode(checker, constraintNode);
        const instantiated = constraint === undefined ? undefined : Checker_instantiateType(checker, constraint, mapper);
        if (instantiated === undefined || instantiated === checker.errorType ||
            !Checker_isTypeAssignableTo(checker, effectiveArguments[index], instantiated))
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
            declaration: parameter, parameter: sourceParameters[index], argument: arguments_[index] ?? effectiveArguments[index],
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
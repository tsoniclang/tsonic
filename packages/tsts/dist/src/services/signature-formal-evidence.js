import { Node_Parameters, Node_Symbol, Node_Type } from "../internal/ast/ast.js";
import { CheckFlagsInstantiated } from "../internal/ast/checkflags.js";
import { AsTypeReferenceNode } from "../internal/ast/generated/casts.js";
import { KindIdentifier, KindTypeParameter } from "../internal/ast/generated/kinds.js";
import { IsFunctionLike } from "../internal/ast/utilities.js";
import { originalSignatureDeclaration, completedAnnotationSource } from "../internal/checker/checker/source-type-answers.js";
import { signatureHasRestParameter } from "../internal/checker/checker/state.js";
import { Checker_isOptionalParameter } from "../internal/checker/utilities.js";
import { IsTupleType } from "../internal/checker/exports.js";
import { TypeMapper_Kind, TypeMapper_Map, TypeMapperKindArray, TypeMapperKindSimple } from "../internal/checker/mapper.js";
import { admitNativeChecker } from "../internal/checker/resource-admission.js";
import { SignatureFlagsCallChainFlags, TypeFlagsTypeParameter } from "../internal/checker/types.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
export function readCompletedTupleFormal(checker, signature, ordinal, selected) {
    admitNativeChecker(checker, "work");
    const original = signature.target;
    const mapper = signature.mapper;
    if (signature.checkerId !== checker.id || original?.checkerId !== checker.id || mapper === undefined
        || signature.composite !== undefined || (signature.flags & SignatureFlagsCallChainFlags) !== 0
        || ordinal >= signature.minArgumentCount || ordinal >= original.minArgumentCount
        || selected.checker !== checker || selected.alias !== undefined || !IsTupleType(selected)
        || signatureHasRestParameter(signature) && ordinal === signature.parameters.length - 1
        || signatureHasRestParameter(original) && ordinal === original.parameters.length - 1)
        return undefined;
    const owner = originalSignatureDeclaration(checker, original);
    if (owner === undefined || signature.declaration !== owner || !IsFunctionLike(owner))
        return undefined;
    const parameters = Node_Parameters(owner);
    if (parameters.length !== signature.parameters.length || parameters.length !== original.parameters.length || ordinal >= parameters.length)
        return undefined;
    admitNativeChecker(checker, "work");
    const declaration = parameters[ordinal];
    const originalSymbol = original.parameters[ordinal];
    const selectedSymbol = signature.parameters[ordinal];
    if (declaration === undefined || declaration.Parent !== owner || originalSymbol === undefined || selectedSymbol === undefined
        || Node_Symbol(declaration) !== originalSymbol || selectedSymbol.ValueDeclaration !== declaration
        || (selectedSymbol.CheckFlags & CheckFlagsInstantiated) === 0 || Checker_isOptionalParameter(checker, declaration))
        return undefined;
    const selectedLinks = LinkStore_TryGet(checker.valueSymbolLinks, selectedSymbol);
    const binder = LinkStore_TryGet(checker.valueSymbolLinks, originalSymbol)?.resolvedType;
    if (selectedLinks?.target !== originalSymbol || selectedLinks.resolvedType !== selected || selectedLinks.mapper !== mapper
        || binder === undefined || binder.checker !== checker || (binder.flags & TypeFlagsTypeParameter) === 0)
        return undefined;
    const annotation = Node_Type(declaration);
    const syntax = AsTypeReferenceNode(annotation);
    const written = syntax?.TypeName;
    if (annotation === undefined || syntax === undefined || written?.Kind !== KindIdentifier || syntax.TypeArguments !== undefined
        || completedAnnotationSource(checker, annotation, binder) !== annotation)
        return undefined;
    const group = binder.symbol?.Declarations;
    if (group === undefined || group.length < 2)
        return undefined;
    for (let position = 0; position < group.length; ++position) {
        admitNativeChecker(checker, "work");
        if (group[position]?.Kind !== KindTypeParameter)
            return undefined;
    }
    admitNativeChecker(checker, "work");
    if (LinkStore_TryGet(checker.symbolNodeLinks, annotation)?.resolvedSymbol !== binder.symbol)
        return undefined;
    const kind = TypeMapper_Kind(mapper);
    if (kind !== TypeMapperKindArray && kind !== TypeMapperKindSimple || TypeMapper_Map(mapper, binder) !== selected)
        return undefined;
    admitNativeChecker(checker, "retained");
    return Object.freeze({ original, declaration, binder, selected });
}
//# sourceMappingURL=signature-formal-evidence.js.map
import { Node_Initializer, Node_QuestionToken } from "../ast/ast.js";
import { IsParameterDeclaration } from "../ast/generated/predicates.js";
import { SymbolFlagsOptional } from "../ast/symbolflags.js";
import { SignatureFlagsHasRestParameter } from "./types.js";
export function readOriginalSignature(signature) {
    const declaration = (parameter) => parameter?.ValueDeclaration
        ?? parameter?.Declarations?.find(node => node !== undefined);
    const restIndex = (signature.flags & SignatureFlagsHasRestParameter) !== 0 ? signature.parameters.length - 1 : -1;
    return Object.freeze({ constructorClass: signature.constructorClass,
        composite: signature.composite === undefined ? undefined : Object.freeze({
            isUnion: signature.composite.isUnion,
            signatures: Object.freeze(signature.composite.signatures.map(part => {
                if (part === undefined)
                    throw new Error("An original composite signature requires every actual constituent.");
                return part;
            })),
        }),
        declaration: signature.declaration, target: signature.target,
        parameters: Object.freeze(signature.parameters.map((parameter, index) => {
            const original = declaration(parameter);
            return Object.freeze({ index, declaration: original, rest: index === restIndex,
                optional: parameter !== undefined && ((parameter.Flags & SymbolFlagsOptional) !== 0 ||
                    IsParameterDeclaration(original) && (Node_QuestionToken(original) !== undefined || Node_Initializer(original) !== undefined)) });
        })),
        receiver: signature.thisParameter === undefined ? undefined
            : Object.freeze({ declaration: declaration(signature.thisParameter) }) });
}
//# sourceMappingURL=original-signature-evidence.js.map
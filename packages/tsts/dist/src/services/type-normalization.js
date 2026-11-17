import { LiteralCreation } from "../internal/checker/checker/literal-creation.js";
import { reacquireBuiltinSignature, reacquireBuiltinType } from "./type-normalization-builtins.js";
import { reacquireLiteralType } from "./type-normalization-literals.js";
import { reacquireCompositeType } from "./type-normalization-composites.js";
import { reacquireTypeOperator } from "./type-normalization-operators.js";
import { reacquireContextualArgument } from "./type-normalization-contextual-arguments.js";
import { reacquireLiteralGraph } from "./type-normalization-spreads.js";
import { reacquireCachedObjectExpression, reacquireCachedRestType, reacquireContextWidening, reacquireExpressionConstruction } from "./type-normalization-expressions.js";
import { cachedSignatureArguments, cachedSignatureConstruction, reacquireCachedSignature, reacquireCompositeSignature, reacquireHigherOrderSignature, reacquireMemberSignature, reacquireSignatureInstantiation, reacquireSignatureType } from "./type-normalization-signatures.js";
import { reacquireAnonymousInstantiation, reacquireCachedValueType, reacquireCachedTypeNode, reacquireDeclarationSignature, reacquireMappedParameter, reacquireRestrictiveParameter, reacquireDeclaredType, reacquireTypeAlias, reacquireTypeReference } from "./type-normalization-declarations.js";
export function createTypeNormalization(producer) {
    const types = new Map();
    const signatures = new Map();
    const literalInputs = new Map();
    const literalGraphs = new Map();
    const files = producer.program.SourceFiles();
    const requireSource = (source) => {
        if (source.program.SourceFiles() !== files) {
            throw new TypeError("Native type normalization requires the same actual Program");
        }
    };
    const normalizeSignature = (source, signature) => {
        requireSource(source);
        if (signature.checkerId !== source.id) {
            throw new TypeError("Native signature normalization requires its actual producing checker");
        }
        if (source === producer)
            return signature;
        const known = signatures.get(signature);
        if (known !== undefined)
            return known;
        const builtin = reacquireHigherOrderSignature(source, producer, signature, value => normalizeSignature(source, value))
            ?? reacquireCompositeSignature(source, producer, signature, normalize, value => normalizeSignature(source, value))
            ?? reacquireMemberSignature(source, producer, signature, normalize)
            ?? reacquireBuiltinSignature(source, producer, signature);
        const declared = builtin ?? reacquireDeclarationSignature(source, producer, signature);
        let result = declared;
        if (result === undefined) {
            const construction = cachedSignatureConstruction(source, signature);
            const arguments_ = construction === undefined ? cachedSignatureArguments(source, signature) : undefined;
            if (construction !== undefined || arguments_ !== undefined) {
                const target = signature.target;
                if (target === undefined)
                    throw new TypeError("A cached signature requires its actual source signature");
                const selected = normalizeSignature(source, target);
                if (construction !== undefined) {
                    result = reacquireCachedSignature(producer, construction, selected);
                }
                else if (arguments_ !== undefined) {
                    const argumentsValues = [];
                    for (const argument of arguments_) {
                        if (argument === undefined)
                            throw new TypeError("A cached signature requires its actual type arguments");
                        argumentsValues.push(normalize(argument));
                    }
                    result = reacquireSignatureInstantiation(producer, selected, argumentsValues);
                }
            }
        }
        if (result === undefined) {
            throw new Error("Native signature normalization is unfinished for this producing relation");
        }
        signatures.set(signature, result);
        return result;
    };
    const normalize = (type) => {
        const source = type.checker;
        if (source === undefined)
            throw new TypeError("Native type normalization requires its actual producing checker");
        requireSource(source);
        if (source === producer)
            return type;
        const known = types.get(type);
        if (known !== undefined)
            return known;
        const literal = type.derivation?.kind;
        if ((literal === "object-literal" || literal === "literal-fragment" || literal === "literal-merge" || literal === "literal-partial")
            && LiteralCreation.read(type) === undefined)
            throw new TypeError("A complete literal cannot replace its authenticated actual creation");
        if (type.derivation?.kind === "signature-parameter") {
            const derivation = type.derivation;
            if (derivation.signature.typeParameters[derivation.index] !== type)
                throw new TypeError("A native signature parameter retains its actual producing signature position");
            const selected = normalizeSignature(source, derivation.signature).typeParameters[derivation.index];
            if (selected === undefined || selected.checker !== producer)
                throw new Error("The normalized native signature retains its actual parameter");
            types.set(type, selected);
            return selected;
        }
        let result = reacquireContextualArgument(producer, type)
            ?? reacquireBuiltinType(producer, type)
            ?? reacquireDeclaredType(producer, type)
            ?? reacquireRestrictiveParameter(producer, type, normalize)
            ?? reacquireMappedParameter(producer, type, normalize)
            ?? reacquireSignatureType(producer, type, signature => normalizeSignature(source, signature))
            ?? reacquireTypeAlias(producer, type, normalize)
            ?? reacquireCachedValueType(producer, type)
            ?? reacquireCompositeType(producer, type, normalize)
            ?? reacquireAnonymousInstantiation(producer, type, normalize)
            ?? reacquireLiteralType(producer, type)
            ?? reacquireTypeOperator(producer, type, normalize)
            ?? reacquireTypeReference(producer, type, normalize);
        if (result === undefined && (literal === "object-literal" || literal === "literal-fragment"
            || literal === "literal-merge" || literal === "literal-partial")) {
            result = reacquireLiteralGraph(producer, type, normalize, (original, selected) => {
                const previous = types.get(original);
                if (previous !== undefined && previous !== selected)
                    throw new Error("A native construction preserves its previously admitted normalization");
                types.set(original, selected);
            }, literalInputs, literalGraphs);
            if (result === undefined)
                throw new TypeError("The native literal retains its unambiguous actual source lifetime");
        }
        result ??= reacquireContextWidening(producer, type, normalize)
            ?? reacquireExpressionConstruction(producer, type, normalize)
            ?? reacquireCachedRestType(producer, type)
            ?? reacquireCachedObjectExpression(producer, type)
            ?? reacquireCachedTypeNode(producer, type);
        if (result === undefined) {
            throw new Error("Native type normalization is unfinished for this producing relation");
        }
        types.set(type, result);
        return result;
    };
    return { type: normalize };
}
//# sourceMappingURL=type-normalization.js.map
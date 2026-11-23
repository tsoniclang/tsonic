import { CheckModeNormal, SignatureKeyBase, SignatureKeyCanonical, SignatureKeyErased, SignatureKeyInner, SignatureKeyOuter, getTypeListKey } from "../internal/checker/checker/state.js";
import { Checker_getBaseSignature, Checker_getCanonicalSignature, Checker_getErasedSignature, Checker_getOptionalCallSignature, Checker_getOrCreateTypeFromSignature, Checker_getResolvedSignature, Checker_getSignaturesOfType, Checker_getSignatureInstantiationWithoutFillingInTypeArguments } from "../internal/checker/checker/signatures.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { flatTypeMapperInputs } from "./type-mapper-inputs.js";
import { ObjectFlagsSingleSignatureType, SignatureFlagsIsInnerCallChain, SignatureFlagsIsOuterCallChain, SignatureKindCall, SignatureKindConstruct, TypeFlagsObject, Type_AsStructuredType } from "../internal/checker/types.js";
export function reacquireHigherOrderSignature(source, producer, signature, normalize) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native signature construction requires its actual producer");
    const derivation = signature.derivation;
    if (derivation === undefined)
        return undefined;
    if (source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("A native higher-order signature requires the same actual Program");
    if (derivation.kind === "higher-order") {
        const original = LinkStore_TryGet(source.signatureLinks, derivation.at);
        let result;
        if (original?.resolvedSignature === signature) {
            result = Checker_getResolvedSignature(producer, derivation.at, undefined, CheckModeNormal);
        }
        else {
            const evidence = original?.resolvedCallSelectionEvidence;
            if (evidence?.kind !== "conditional-candidates")
                return undefined;
            const candidates = evidence.candidates.filter(candidate => candidate.application.instantiatedSignature === signature);
            const candidate = candidates.length === 1 ? candidates[0] : undefined;
            if (candidate === undefined)
                return undefined;
            const selected = normalize(candidate.application.signature);
            if (selected.checkerId !== producer.id)
                throw new TypeError("A native conditional candidate requires its normalized original signature producer");
            Checker_getResolvedSignature(producer, derivation.at, undefined, CheckModeNormal);
            const completed = LinkStore_TryGet(producer.signatureLinks, derivation.at)?.resolvedCallSelectionEvidence;
            if (completed?.kind !== "conditional-candidates")
                throw new Error("The native invocation retains its actual conditional candidate answer");
            const matching = completed.candidates.filter(value => value.application.signature === selected
                && value.application.kind === candidate.application.kind);
            if (matching.length !== 1)
                throw new Error("Native conditional candidate normalization is unfinished for this producing relation");
            result = matching[0]?.application.instantiatedSignature;
        }
        if (result === undefined || result.checkerId !== producer.id || result.derivation?.kind !== "higher-order")
            throw new Error("The native invocation retains its actual higher-order result");
        return result;
    }
    if (derivation.kind !== "higher-order-return")
        return undefined;
    const owner = derivation.signature;
    if (owner.checkerId !== source.id || owner.derivation?.kind !== "higher-order"
        || owner.derivation.returned !== signature)
        return undefined;
    const selected = normalize(owner);
    if (selected.checkerId !== producer.id || selected.derivation?.kind !== "higher-order")
        throw new TypeError("A native higher-order return requires its normalized signature producer");
    return selected.derivation.returned;
}
export function reacquireMemberSignature(source, producer, signature, normalize) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native member signature requires its actual producer");
    const derivation = signature.derivation;
    if (derivation?.kind !== "member")
        return undefined;
    if (source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("A native member signature requires the same actual Program");
    if (derivation.owner.checker !== source)
        throw new TypeError("A native member signature retains its actual type owner");
    const kind = derivation.signatureKind === "call" ? SignatureKindCall : SignatureKindConstruct;
    if (Checker_getSignaturesOfType(source, derivation.owner, kind)[derivation.index] !== signature)
        return undefined;
    const owner = normalize(derivation.owner);
    if (owner.checker !== producer)
        throw new TypeError("A native member signature requires its normalized type owner");
    const result = Checker_getSignaturesOfType(producer, owner, kind)[derivation.index];
    if (result === undefined || result.checkerId !== producer.id || result.derivation?.kind !== "member"
        || result.derivation.owner !== owner || result.derivation.signatureKind !== derivation.signatureKind
        || result.derivation.index !== derivation.index)
        throw new Error("The native resolved type retains its actual instantiated member signature");
    return result;
}
export function reacquireCompositeSignature(source, producer, signature, normalizeType, normalizeSignature) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native composite signature retains its actual producer");
    const derivation = signature.derivation;
    if (derivation?.kind !== "union-member" && derivation?.kind !== "intersection-member")
        return undefined;
    if (source.program.SourceFiles() !== producer.program.SourceFiles() || derivation.owner.checker !== source)
        throw new TypeError("A native composite signature retains its actual Program and type owner");
    const kind = derivation.kind === "intersection-member" || derivation.signatureKind === "construct"
        ? SignatureKindConstruct : SignatureKindCall;
    if (!Checker_getSignaturesOfType(source, derivation.owner, kind).includes(signature))
        return undefined;
    const owner = normalizeType(derivation.owner);
    if (owner.checker !== producer)
        throw new TypeError("A native composite signature requires its normalized owner");
    let constituents;
    let selectedSource;
    if (derivation.kind === "union-member") {
        if (!signature.composite?.isUnion || signature.composite.signatures !== derivation.constituents)
            return undefined;
        constituents = new Set();
        for (const member of derivation.constituents) {
            if (member === undefined || member.checkerId !== source.id)
                throw new TypeError("A native union member retains its actual constituent signatures");
            const selected = normalizeSignature(member);
            if (selected.checkerId !== producer.id)
                throw new TypeError("A native union member requires normalized constituents");
            constituents.add(selected);
        }
    }
    else {
        selectedSource = normalizeSignature(derivation.source);
        if (selectedSource.checkerId !== producer.id)
            throw new TypeError("A native mixin member requires its normalized source Signature");
    }
    let result;
    for (const candidate of Checker_getSignaturesOfType(producer, owner, kind)) {
        if (candidate === undefined)
            continue;
        const record = candidate.derivation;
        if (record?.kind !== derivation.kind || record.owner !== owner || candidate.checkerId !== producer.id)
            continue;
        let matches = false;
        if (record.kind === "intersection-member")
            matches = record.source === selectedSource;
        else if (derivation.kind === "union-member" && constituents !== undefined && record.signatureKind === derivation.signatureKind) {
            const actual = new Set(record.constituents);
            matches = actual.size === constituents.size;
            for (const member of actual)
                if (member === undefined || !constituents.has(member))
                    matches = false;
        }
        if (matches) {
            if (result !== undefined)
                throw new Error("A native composite owner has one signature for its actual producing relation");
            result = candidate;
        }
    }
    if (result === undefined)
        throw new Error("The native composite owner retains its normalized producing relation");
    return result;
}
export function cachedSignatureArguments(source, signature) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native signature construction requires its actual producer");
    const target = signature.target;
    const mapper = signature.mapper;
    if (target === undefined || mapper === undefined)
        return undefined;
    const arguments_ = flatTypeMapperInputs(mapper)?.targets;
    if (arguments_ === undefined)
        return undefined;
    if (arguments_.some(type => type === undefined))
        throw new TypeError("A native cached instantiation requires its actual arguments");
    return source.cachedSignatures.get({ sig: target, key: getTypeListKey(arguments_) }) === signature ? arguments_ : undefined;
}
export function reacquireSignatureInstantiation(producer, signature, arguments_) {
    if (signature.checkerId !== producer.id || arguments_.some(type => type.checker !== producer)) {
        throw new TypeError("A native signature instantiation requires its normalized input producer");
    }
    const result = Checker_getSignatureInstantiationWithoutFillingInTypeArguments(producer, signature, arguments_);
    if (result === undefined)
        throw new Error("The native signature instantiation did not return its value");
    return result;
}
export function reacquireSignatureType(producer, type, normalize) {
    if ((type.flags & TypeFlagsObject) === 0 || (type.objectFlags & ObjectFlagsSingleSignatureType) === 0)
        return undefined;
    const data = Type_AsStructuredType(type);
    const signature = data?.signatures?.[0];
    if (data?.signatures?.length !== 1 || signature?.isolatedSignatureType !== type)
        return undefined;
    if (type.checker === undefined || signature.checkerId !== type.checker.id)
        throw new TypeError("A native signature type requires its actual producer");
    const normalized = normalize(signature);
    if (normalized.checkerId !== producer.id)
        throw new TypeError("A native signature type requires its normalized signature producer");
    const result = Checker_getOrCreateTypeFromSignature(producer, normalized);
    if (result === undefined)
        throw new Error("The native isolated signature constructor did not return its value");
    return result;
}
export function cachedSignatureConstruction(source, signature) {
    if (signature.checkerId !== source.id)
        throw new TypeError("A native signature construction requires its actual producer");
    const target = signature.target;
    if (target === undefined)
        return undefined;
    if (source.cachedSignatures.get({ sig: target, key: SignatureKeyErased }) === signature)
        return "erased";
    if (source.cachedSignatures.get({ sig: target, key: SignatureKeyCanonical }) === signature)
        return "canonical";
    if (source.cachedSignatures.get({ sig: target, key: SignatureKeyBase }) === signature)
        return "base";
    if (source.cachedSignatures.get({ sig: target, key: SignatureKeyInner }) === signature)
        return "inner-call";
    if (source.cachedSignatures.get({ sig: target, key: SignatureKeyOuter }) === signature)
        return "outer-call";
    return undefined;
}
export function reacquireCachedSignature(producer, construction, signature) {
    if (signature.checkerId !== producer.id)
        throw new TypeError("A native signature constructor requires its normalized input producer");
    let result;
    switch (construction) {
        case "erased":
            result = Checker_getErasedSignature(producer, signature);
            break;
        case "canonical":
            result = Checker_getCanonicalSignature(producer, signature);
            break;
        case "base":
            result = Checker_getBaseSignature(producer, signature);
            break;
        case "inner-call":
            result = Checker_getOptionalCallSignature(producer, signature, SignatureFlagsIsInnerCallChain);
            break;
        case "outer-call":
            result = Checker_getOptionalCallSignature(producer, signature, SignatureFlagsIsOuterCallChain);
            break;
    }
    if (result === undefined)
        throw new Error("The native cached signature constructor did not return its value");
    return result;
}
//# sourceMappingURL=type-normalization-signatures.js.map
import { argumentPassingFactKey, associatedTypeFactKey, attributeFactKey, canonicalIdentityFactKey, constGenericFactKey, defaultValueFactKey, fieldFactKey, flowStateFactKey, functionPointerFactKey, pointerFactKey, pointerOperationFactKey, rawPointerFactKey, rawPointerOperationFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, sourcePrimitiveFactKey, structFactKey, } from "./facts.js";
export class SourceFactQueries {
    #host;
    constructor(host) {
        if (!host.finalized) {
            throw new Error("Source fact queries require finalized source-extension semantics.");
        }
        this.#host = host;
    }
    getFact(subject, key) {
        return this.#host.facts.get(subject, key);
    }
    getFacts(subject) {
        return this.#host.facts.entries(subject);
    }
    getVirtualDeclarationDocument(uriOrFileName) {
        return this.#host.providers.getVirtualDeclarationDocument(uriOrFileName);
    }
    getCanonicalIdentity(subject) {
        return this.getFact(subject, canonicalIdentityFactKey);
    }
    getSourcePrimitive(subject) {
        return this.getFact(subject, sourcePrimitiveFactKey);
    }
    getArgumentPassing(subject) {
        return this.getFact(subject, argumentPassingFactKey);
    }
    getFunctionPointer(subject) {
        return this.getFact(subject, functionPointerFactKey);
    }
    getPointer(subject) {
        return this.getFact(subject, pointerFactKey);
    }
    getPointerOperation(subject) {
        return this.getFact(subject, pointerOperationFactKey);
    }
    getRawPointer(subject) {
        return this.getFact(subject, rawPointerFactKey);
    }
    getRawPointerOperation(subject) {
        return this.getFact(subject, rawPointerOperationFactKey);
    }
    getStruct(subject) {
        return this.getFact(subject, structFactKey);
    }
    getField(subject) {
        return this.getFact(subject, fieldFactKey);
    }
    getFlowState(subject) {
        return this.getFact(subject, flowStateFactKey);
    }
    getAttribute(subject) {
        return this.getFact(subject, attributeFactKey);
    }
    getDefaultValue(subject) {
        return this.getFact(subject, defaultValueFactKey);
    }
    getAssociatedType(subject) {
        return this.getFact(subject, associatedTypeFactKey);
    }
    getConstGeneric(subject) {
        return this.getFact(subject, constGenericFactKey);
    }
    getProviderDeclaration(subject) {
        return this.getFact(subject, providerVirtualDeclarationFactKey);
    }
    getProviderTypeFamily(subject) {
        return this.getFact(subject, providerTypeFamilyFactKey);
    }
}
export function createSourceFactQueries(host) {
    const queries = new SourceFactQueries(host);
    Object.freeze(queries);
    return queries;
}
//# sourceMappingURL=consumer.js.map

import { argumentPassingFactKey, associatedTypeFactKey, attributeFactKey, canonicalIdentityFactKey, constGenericFactKey, defaultValueFactKey, fieldFactKey, flowStateFactKey, functionPointerFactKey, pointerFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, sourcePrimitiveFactKey, structFactKey, } from "./facts.js";
export class SourceFactQueries {
    #host;
    #consumer;
    constructor(host, consumer) {
        this.#host = host;
        this.#consumer = consumer;
    }
    getFact(subject, key) {
        return this.#host.getFactForConsumer(this.#consumer, subject, key);
    }
    requireFact(subject, key, purpose) {
        return this.#host.requireFactForConsumer(this.#consumer, subject, key, purpose);
    }
    mustFact(subject, key, purpose) {
        return this.#host.mustFactForConsumer(this.#consumer, subject, key, purpose);
    }
    getFacts(subject) {
        return this.#host.getFactsForConsumer(this.#consumer, subject);
    }
    getVirtualDeclarationDocument(uriOrFileName) {
        return this.#host.getVirtualDeclarationDocumentForConsumer(this.#consumer, uriOrFileName);
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
export function createSourceFactQueries(host, consumer) {
    return new SourceFactQueries(host, consumer);
}
//# sourceMappingURL=consumer.js.map
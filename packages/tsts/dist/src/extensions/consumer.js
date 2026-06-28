import { argumentPassingFactKey, associatedTypeFactKey, attributeFactKey, contextualTargetTypeFactKey, constGenericFactKey, defaultValueFactKey, fieldFactKey, functionPointerFactKey, instantiatedTargetTypeFactKey, providerVirtualDeclarationFactKey, pointerFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, structFactKey, targetConversionFactKey, targetBindingFactKey, targetOperationFactKey, } from "./facts.js";
export class ExtensionConsumerQueries {
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
    getSourcePrimitiveFact(subject) {
        return this.getFact(subject, sourcePrimitiveFactKey);
    }
    requireSourcePrimitiveFact(subject, purpose) {
        return this.requireFact(subject, sourcePrimitiveFactKey, purpose);
    }
    mustSourcePrimitiveFact(subject, purpose) {
        return this.mustFact(subject, sourcePrimitiveFactKey, purpose);
    }
    getTargetBindingFact(subject) {
        return this.getFact(subject, targetBindingFactKey);
    }
    requireTargetBindingFact(subject, purpose) {
        return this.requireFact(subject, targetBindingFactKey, purpose);
    }
    mustTargetBindingFact(subject, purpose) {
        return this.mustFact(subject, targetBindingFactKey, purpose);
    }
    getSelectedTargetCall(subject) {
        return this.getFact(subject, selectedTargetSignatureFactKey);
    }
    requireSelectedTargetCall(subject, purpose) {
        return this.requireFact(subject, selectedTargetSignatureFactKey, purpose);
    }
    mustSelectedTargetCall(subject, purpose) {
        return this.mustFact(subject, selectedTargetSignatureFactKey, purpose);
    }
    getContextualTargetTypeFact(subject) {
        return this.getFact(subject, contextualTargetTypeFactKey);
    }
    requireContextualTargetTypeFact(subject, purpose) {
        return this.requireFact(subject, contextualTargetTypeFactKey, purpose);
    }
    mustContextualTargetTypeFact(subject, purpose) {
        return this.mustFact(subject, contextualTargetTypeFactKey, purpose);
    }
    getSelectedTargetProperty(subject) {
        return this.getFact(subject, targetOperationFactKey);
    }
    requireSelectedTargetProperty(subject, purpose) {
        return this.requireFact(subject, targetOperationFactKey, purpose);
    }
    mustSelectedTargetProperty(subject, purpose) {
        return this.mustFact(subject, targetOperationFactKey, purpose);
    }
    getSelectedTargetElementAccess(subject) {
        return this.getFact(subject, targetOperationFactKey);
    }
    requireSelectedTargetElementAccess(subject, purpose) {
        return this.requireFact(subject, targetOperationFactKey, purpose);
    }
    mustSelectedTargetElementAccess(subject, purpose) {
        return this.mustFact(subject, targetOperationFactKey, purpose);
    }
    getSelectedTargetOperator(subject) {
        return this.getFact(subject, targetOperationFactKey);
    }
    requireSelectedTargetOperator(subject, purpose) {
        return this.requireFact(subject, targetOperationFactKey, purpose);
    }
    mustSelectedTargetOperator(subject, purpose) {
        return this.mustFact(subject, targetOperationFactKey, purpose);
    }
    getSelectedTargetIteration(subject) {
        return this.getFact(subject, targetOperationFactKey);
    }
    requireSelectedTargetIteration(subject, purpose) {
        return this.requireFact(subject, targetOperationFactKey, purpose);
    }
    mustSelectedTargetIteration(subject, purpose) {
        return this.mustFact(subject, targetOperationFactKey, purpose);
    }
    getRuntimeCarrierFact(subject) {
        return this.getFact(subject, runtimeCarrierFactKey);
    }
    requireRuntimeCarrierFact(subject, purpose) {
        return this.requireFact(subject, runtimeCarrierFactKey, purpose);
    }
    mustRuntimeCarrierFact(subject, purpose) {
        return this.mustFact(subject, runtimeCarrierFactKey, purpose);
    }
    getTargetConversionFact(subject) {
        return this.getFact(subject, targetConversionFactKey);
    }
    requireTargetConversionFact(subject, purpose) {
        return this.requireFact(subject, targetConversionFactKey, purpose);
    }
    mustTargetConversionFact(subject, purpose) {
        return this.mustFact(subject, targetConversionFactKey, purpose);
    }
    getArgumentPassingFact(subject) {
        return this.getFact(subject, argumentPassingFactKey);
    }
    requireArgumentPassingFact(subject, purpose) {
        return this.requireFact(subject, argumentPassingFactKey, purpose);
    }
    mustArgumentPassingFact(subject, purpose) {
        return this.mustFact(subject, argumentPassingFactKey, purpose);
    }
    getFunctionPointerFact(subject) {
        return this.getFact(subject, functionPointerFactKey);
    }
    requireFunctionPointerFact(subject, purpose) {
        return this.requireFact(subject, functionPointerFactKey, purpose);
    }
    mustFunctionPointerFact(subject, purpose) {
        return this.mustFact(subject, functionPointerFactKey, purpose);
    }
    getPointerFact(subject) {
        return this.getFact(subject, pointerFactKey);
    }
    requirePointerFact(subject, purpose) {
        return this.requireFact(subject, pointerFactKey, purpose);
    }
    mustPointerFact(subject, purpose) {
        return this.mustFact(subject, pointerFactKey, purpose);
    }
    getStructFact(subject) {
        return this.getFact(subject, structFactKey);
    }
    requireStructFact(subject, purpose) {
        return this.requireFact(subject, structFactKey, purpose);
    }
    mustStructFact(subject, purpose) {
        return this.mustFact(subject, structFactKey, purpose);
    }
    getFieldFact(subject) {
        return this.getFact(subject, fieldFactKey);
    }
    requireFieldFact(subject, purpose) {
        return this.requireFact(subject, fieldFactKey, purpose);
    }
    mustFieldFact(subject, purpose) {
        return this.mustFact(subject, fieldFactKey, purpose);
    }
    getAttributeFact(subject) {
        return this.getFact(subject, attributeFactKey);
    }
    requireAttributeFact(subject, purpose) {
        return this.requireFact(subject, attributeFactKey, purpose);
    }
    mustAttributeFact(subject, purpose) {
        return this.mustFact(subject, attributeFactKey, purpose);
    }
    getDefaultValueFact(subject) {
        return this.getFact(subject, defaultValueFactKey);
    }
    requireDefaultValueFact(subject, purpose) {
        return this.requireFact(subject, defaultValueFactKey, purpose);
    }
    mustDefaultValueFact(subject, purpose) {
        return this.mustFact(subject, defaultValueFactKey, purpose);
    }
    getInstantiatedTargetTypeFact(subject) {
        return this.getFact(subject, instantiatedTargetTypeFactKey);
    }
    requireInstantiatedTargetTypeFact(subject, purpose) {
        return this.requireFact(subject, instantiatedTargetTypeFactKey, purpose);
    }
    mustInstantiatedTargetTypeFact(subject, purpose) {
        return this.mustFact(subject, instantiatedTargetTypeFactKey, purpose);
    }
    getAssociatedTypeFact(subject) {
        return this.getFact(subject, associatedTypeFactKey);
    }
    requireAssociatedTypeFact(subject, purpose) {
        return this.requireFact(subject, associatedTypeFactKey, purpose);
    }
    mustAssociatedTypeFact(subject, purpose) {
        return this.mustFact(subject, associatedTypeFactKey, purpose);
    }
    getConstGenericFact(subject) {
        return this.getFact(subject, constGenericFactKey);
    }
    requireConstGenericFact(subject, purpose) {
        return this.requireFact(subject, constGenericFactKey, purpose);
    }
    mustConstGenericFact(subject, purpose) {
        return this.mustFact(subject, constGenericFactKey, purpose);
    }
    getVirtualDeclaration(subject) {
        return this.getFact(subject, providerVirtualDeclarationFactKey);
    }
    requireVirtualDeclaration(subject, purpose) {
        return this.requireFact(subject, providerVirtualDeclarationFactKey, purpose);
    }
    mustVirtualDeclaration(subject, purpose) {
        return this.mustFact(subject, providerVirtualDeclarationFactKey, purpose);
    }
}
export function createExtensionConsumerQueries(host, consumer) {
    return new ExtensionConsumerQueries(host, consumer);
}
//# sourceMappingURL=consumer.js.map
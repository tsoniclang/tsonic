import {
  argumentPassingFactKey,
  associatedTypeFactKey,
  attributeFactKey,
  contextualTargetTypeFactKey,
  constGenericFactKey,
  defaultValueFactKey,
  fieldFactKey,
  functionPointerFactKey,
  instantiatedTargetTypeFactKey,
  providerVirtualDeclarationFactKey,
  pointerFactKey,
  runtimeCarrierFactKey,
  selectedTargetSignatureFactKey,
  sourcePrimitiveFactKey,
  structFactKey,
  targetConversionFactKey,
  targetBindingFactKey,
  targetOperationFactKey,
} from "./facts.js";
import type {
  ArgumentPassingFact,
  AssociatedTypeFact,
  AttributeFact,
  ContextualTargetTypeFact,
  ConstGenericFact,
  DefaultValueFact,
  FieldFact,
  FunctionPointerFact,
  InstantiatedTargetTypeFact,
  PointerFact,
  ProviderVirtualDeclarationFact,
  RuntimeCarrierFact,
  SelectedTargetSignatureFact,
  SourcePrimitiveFact,
  StructFact,
  TargetConversionFact,
  TargetBindingFact,
  TargetOperationFact,
} from "./facts.js";
import type { ExtensionFactEntry, ExtensionFactKey, ExtensionFactSubject, ExtensionHost, ProviderVirtualDeclarationDocument } from "./host.js";

export class ExtensionConsumerQueries {
  readonly #host: ExtensionHost;
  readonly #consumer: string;

  constructor(host: ExtensionHost, consumer: string) {
    this.#host = host;
    this.#consumer = consumer;
  }

  getFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined {
    return this.#host.getFactForConsumer(this.#consumer, subject, key);
  }

  requireFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T | undefined {
    return this.#host.requireFactForConsumer(this.#consumer, subject, key, purpose);
  }

  mustFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T {
    return this.#host.mustFactForConsumer(this.#consumer, subject, key, purpose);
  }

  getFacts(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[] {
    return this.#host.getFactsForConsumer(this.#consumer, subject);
  }

  getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined {
    return this.#host.getVirtualDeclarationDocumentForConsumer(this.#consumer, uriOrFileName);
  }

  getSourcePrimitiveFact(subject: ExtensionFactSubject | undefined): SourcePrimitiveFact | undefined {
    return this.getFact(subject, sourcePrimitiveFactKey);
  }

  requireSourcePrimitiveFact(subject: ExtensionFactSubject, purpose?: string): SourcePrimitiveFact | undefined {
    return this.requireFact(subject, sourcePrimitiveFactKey, purpose);
  }

  mustSourcePrimitiveFact(subject: ExtensionFactSubject, purpose?: string): SourcePrimitiveFact {
    return this.mustFact(subject, sourcePrimitiveFactKey, purpose);
  }

  getTargetBindingFact(subject: ExtensionFactSubject | undefined): TargetBindingFact | undefined {
    return this.getFact(subject, targetBindingFactKey);
  }

  requireTargetBindingFact(subject: ExtensionFactSubject, purpose?: string): TargetBindingFact | undefined {
    return this.requireFact(subject, targetBindingFactKey, purpose);
  }

  mustTargetBindingFact(subject: ExtensionFactSubject, purpose?: string): TargetBindingFact {
    return this.mustFact(subject, targetBindingFactKey, purpose);
  }

  getSelectedTargetCall(subject: ExtensionFactSubject | undefined): SelectedTargetSignatureFact | undefined {
    return this.getFact(subject, selectedTargetSignatureFactKey);
  }

  requireSelectedTargetCall(subject: ExtensionFactSubject, purpose?: string): SelectedTargetSignatureFact | undefined {
    return this.requireFact(subject, selectedTargetSignatureFactKey, purpose);
  }

  mustSelectedTargetCall(subject: ExtensionFactSubject, purpose?: string): SelectedTargetSignatureFact {
    return this.mustFact(subject, selectedTargetSignatureFactKey, purpose);
  }

  getContextualTargetTypeFact(subject: ExtensionFactSubject | undefined): ContextualTargetTypeFact | undefined {
    return this.getFact(subject, contextualTargetTypeFactKey);
  }

  requireContextualTargetTypeFact(subject: ExtensionFactSubject, purpose?: string): ContextualTargetTypeFact | undefined {
    return this.requireFact(subject, contextualTargetTypeFactKey, purpose);
  }

  mustContextualTargetTypeFact(subject: ExtensionFactSubject, purpose?: string): ContextualTargetTypeFact {
    return this.mustFact(subject, contextualTargetTypeFactKey, purpose);
  }

  getSelectedTargetProperty(subject: ExtensionFactSubject | undefined): TargetOperationFact | undefined {
    return this.getFact(subject, targetOperationFactKey);
  }

  requireSelectedTargetProperty(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact | undefined {
    return this.requireFact(subject, targetOperationFactKey, purpose);
  }

  mustSelectedTargetProperty(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact {
    return this.mustFact(subject, targetOperationFactKey, purpose);
  }

  getSelectedTargetElementAccess(subject: ExtensionFactSubject | undefined): TargetOperationFact | undefined {
    return this.getFact(subject, targetOperationFactKey);
  }

  requireSelectedTargetElementAccess(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact | undefined {
    return this.requireFact(subject, targetOperationFactKey, purpose);
  }

  mustSelectedTargetElementAccess(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact {
    return this.mustFact(subject, targetOperationFactKey, purpose);
  }

  getSelectedTargetOperator(subject: ExtensionFactSubject | undefined): TargetOperationFact | undefined {
    return this.getFact(subject, targetOperationFactKey);
  }

  requireSelectedTargetOperator(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact | undefined {
    return this.requireFact(subject, targetOperationFactKey, purpose);
  }

  mustSelectedTargetOperator(subject: ExtensionFactSubject, purpose?: string): TargetOperationFact {
    return this.mustFact(subject, targetOperationFactKey, purpose);
  }

  getRuntimeCarrierFact(subject: ExtensionFactSubject | undefined): RuntimeCarrierFact | undefined {
    return this.getFact(subject, runtimeCarrierFactKey);
  }

  requireRuntimeCarrierFact(subject: ExtensionFactSubject, purpose?: string): RuntimeCarrierFact | undefined {
    return this.requireFact(subject, runtimeCarrierFactKey, purpose);
  }

  mustRuntimeCarrierFact(subject: ExtensionFactSubject, purpose?: string): RuntimeCarrierFact {
    return this.mustFact(subject, runtimeCarrierFactKey, purpose);
  }

  getTargetConversionFact(subject: ExtensionFactSubject | undefined): TargetConversionFact | undefined {
    return this.getFact(subject, targetConversionFactKey);
  }

  requireTargetConversionFact(subject: ExtensionFactSubject, purpose?: string): TargetConversionFact | undefined {
    return this.requireFact(subject, targetConversionFactKey, purpose);
  }

  mustTargetConversionFact(subject: ExtensionFactSubject, purpose?: string): TargetConversionFact {
    return this.mustFact(subject, targetConversionFactKey, purpose);
  }

  getArgumentPassingFact(subject: ExtensionFactSubject | undefined): ArgumentPassingFact | undefined {
    return this.getFact(subject, argumentPassingFactKey);
  }

  requireArgumentPassingFact(subject: ExtensionFactSubject, purpose?: string): ArgumentPassingFact | undefined {
    return this.requireFact(subject, argumentPassingFactKey, purpose);
  }

  mustArgumentPassingFact(subject: ExtensionFactSubject, purpose?: string): ArgumentPassingFact {
    return this.mustFact(subject, argumentPassingFactKey, purpose);
  }

  getFunctionPointerFact(subject: ExtensionFactSubject | undefined): FunctionPointerFact | undefined {
    return this.getFact(subject, functionPointerFactKey);
  }

  requireFunctionPointerFact(subject: ExtensionFactSubject, purpose?: string): FunctionPointerFact | undefined {
    return this.requireFact(subject, functionPointerFactKey, purpose);
  }

  mustFunctionPointerFact(subject: ExtensionFactSubject, purpose?: string): FunctionPointerFact {
    return this.mustFact(subject, functionPointerFactKey, purpose);
  }

  getPointerFact(subject: ExtensionFactSubject | undefined): PointerFact | undefined {
    return this.getFact(subject, pointerFactKey);
  }

  requirePointerFact(subject: ExtensionFactSubject, purpose?: string): PointerFact | undefined {
    return this.requireFact(subject, pointerFactKey, purpose);
  }

  mustPointerFact(subject: ExtensionFactSubject, purpose?: string): PointerFact {
    return this.mustFact(subject, pointerFactKey, purpose);
  }

  getStructFact(subject: ExtensionFactSubject | undefined): StructFact | undefined {
    return this.getFact(subject, structFactKey);
  }

  requireStructFact(subject: ExtensionFactSubject, purpose?: string): StructFact | undefined {
    return this.requireFact(subject, structFactKey, purpose);
  }

  mustStructFact(subject: ExtensionFactSubject, purpose?: string): StructFact {
    return this.mustFact(subject, structFactKey, purpose);
  }

  getFieldFact(subject: ExtensionFactSubject | undefined): FieldFact | undefined {
    return this.getFact(subject, fieldFactKey);
  }

  requireFieldFact(subject: ExtensionFactSubject, purpose?: string): FieldFact | undefined {
    return this.requireFact(subject, fieldFactKey, purpose);
  }

  mustFieldFact(subject: ExtensionFactSubject, purpose?: string): FieldFact {
    return this.mustFact(subject, fieldFactKey, purpose);
  }

  getAttributeFact(subject: ExtensionFactSubject | undefined): AttributeFact | undefined {
    return this.getFact(subject, attributeFactKey);
  }

  requireAttributeFact(subject: ExtensionFactSubject, purpose?: string): AttributeFact | undefined {
    return this.requireFact(subject, attributeFactKey, purpose);
  }

  mustAttributeFact(subject: ExtensionFactSubject, purpose?: string): AttributeFact {
    return this.mustFact(subject, attributeFactKey, purpose);
  }

  getDefaultValueFact(subject: ExtensionFactSubject | undefined): DefaultValueFact | undefined {
    return this.getFact(subject, defaultValueFactKey);
  }

  requireDefaultValueFact(subject: ExtensionFactSubject, purpose?: string): DefaultValueFact | undefined {
    return this.requireFact(subject, defaultValueFactKey, purpose);
  }

  mustDefaultValueFact(subject: ExtensionFactSubject, purpose?: string): DefaultValueFact {
    return this.mustFact(subject, defaultValueFactKey, purpose);
  }

  getInstantiatedTargetTypeFact(subject: ExtensionFactSubject | undefined): InstantiatedTargetTypeFact | undefined {
    return this.getFact(subject, instantiatedTargetTypeFactKey);
  }

  requireInstantiatedTargetTypeFact(subject: ExtensionFactSubject, purpose?: string): InstantiatedTargetTypeFact | undefined {
    return this.requireFact(subject, instantiatedTargetTypeFactKey, purpose);
  }

  mustInstantiatedTargetTypeFact(subject: ExtensionFactSubject, purpose?: string): InstantiatedTargetTypeFact {
    return this.mustFact(subject, instantiatedTargetTypeFactKey, purpose);
  }

  getAssociatedTypeFact(subject: ExtensionFactSubject | undefined): AssociatedTypeFact | undefined {
    return this.getFact(subject, associatedTypeFactKey);
  }

  requireAssociatedTypeFact(subject: ExtensionFactSubject, purpose?: string): AssociatedTypeFact | undefined {
    return this.requireFact(subject, associatedTypeFactKey, purpose);
  }

  mustAssociatedTypeFact(subject: ExtensionFactSubject, purpose?: string): AssociatedTypeFact {
    return this.mustFact(subject, associatedTypeFactKey, purpose);
  }

  getConstGenericFact(subject: ExtensionFactSubject | undefined): ConstGenericFact | undefined {
    return this.getFact(subject, constGenericFactKey);
  }

  requireConstGenericFact(subject: ExtensionFactSubject, purpose?: string): ConstGenericFact | undefined {
    return this.requireFact(subject, constGenericFactKey, purpose);
  }

  mustConstGenericFact(subject: ExtensionFactSubject, purpose?: string): ConstGenericFact {
    return this.mustFact(subject, constGenericFactKey, purpose);
  }

  getVirtualDeclaration(subject: ExtensionFactSubject | undefined): ProviderVirtualDeclarationFact | undefined {
    return this.getFact(subject, providerVirtualDeclarationFactKey);
  }

  requireVirtualDeclaration(subject: ExtensionFactSubject, purpose?: string): ProviderVirtualDeclarationFact | undefined {
    return this.requireFact(subject, providerVirtualDeclarationFactKey, purpose);
  }

  mustVirtualDeclaration(subject: ExtensionFactSubject, purpose?: string): ProviderVirtualDeclarationFact {
    return this.mustFact(subject, providerVirtualDeclarationFactKey, purpose);
  }
}

export function createExtensionConsumerQueries(host: ExtensionHost, consumer: string): ExtensionConsumerQueries {
  return new ExtensionConsumerQueries(host, consumer);
}

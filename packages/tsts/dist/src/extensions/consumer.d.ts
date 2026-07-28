import type { ArgumentPassingFact, AssociatedTypeFact, AttributeFact, ConstGenericFact, DefaultValueFact, ExtensionCanonicalIdentity, FieldFact, FlowStateFact, FunctionPointerFact, PointerFact, ProviderTypeFamilyFact, ProviderVirtualDeclarationFact, SourcePrimitiveFact, StructFact } from "./facts.js";
import type { ExtensionFactEntry, ExtensionFactKey, ExtensionFactSubject, ExtensionHost, ProviderVirtualDeclarationDocument } from "./host.js";
export interface ReadonlySourceFactResolver {
    getFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined;
    requireFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T | undefined;
    mustFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T;
    getFacts(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[];
    getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined;
}
export declare class SourceFactQueries implements ReadonlySourceFactResolver {
    #private;
    constructor(host: ExtensionHost, consumer: string);
    getFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined;
    requireFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T | undefined;
    mustFact<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T;
    getFacts(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[];
    getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined;
    getCanonicalIdentity(subject: ExtensionFactSubject | undefined): ExtensionCanonicalIdentity | undefined;
    getSourcePrimitive(subject: ExtensionFactSubject | undefined): SourcePrimitiveFact | undefined;
    getArgumentPassing(subject: ExtensionFactSubject | undefined): ArgumentPassingFact | undefined;
    getFunctionPointer(subject: ExtensionFactSubject | undefined): FunctionPointerFact | undefined;
    getPointer(subject: ExtensionFactSubject | undefined): PointerFact | undefined;
    getStruct(subject: ExtensionFactSubject | undefined): StructFact | undefined;
    getField(subject: ExtensionFactSubject | undefined): FieldFact | undefined;
    getFlowState(subject: ExtensionFactSubject | undefined): FlowStateFact | undefined;
    getAttribute(subject: ExtensionFactSubject | undefined): AttributeFact | undefined;
    getDefaultValue(subject: ExtensionFactSubject | undefined): DefaultValueFact | undefined;
    getAssociatedType(subject: ExtensionFactSubject | undefined): AssociatedTypeFact | undefined;
    getConstGeneric(subject: ExtensionFactSubject | undefined): ConstGenericFact | undefined;
    getProviderDeclaration(subject: ExtensionFactSubject | undefined): ProviderVirtualDeclarationFact | undefined;
    getProviderTypeFamily(subject: ExtensionFactSubject | undefined): ProviderTypeFamilyFact | undefined;
}
export declare function createSourceFactQueries(host: ExtensionHost, consumer: string): SourceFactQueries;
//# sourceMappingURL=consumer.d.ts.map
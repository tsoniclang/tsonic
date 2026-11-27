import type { NativeFactsKey, NativeArrayExtentOf, NativeArrayHoldingOf, IsNativeBinaryFloatPrimitive, IsNativeIntegerPrimitive, IsNativeSignedIntegerPrimitive, FloatingBitsFit, ExactFloat64LiteralFit, FloatingFormatWidth, NativeCarrierOf, OptionalValueDomainOf, LiteralCompatibilityOf, NativeIntegerGeometryOf, PlatformDeclarationKey, VerifyNativeFacts, MemberStorageData, CreateTypeInterner, AdmitTypeTable, InternType, ReadType, ReadSignature, ViewTypes,
  ExportTypes, Substitute, SubstituteSignature, PrintTypes, ParseTypes, VerifyTypes, EncodeSelectorPath, CompareIndexSignatures, CompareMemberKeys, InstanceKey, SameInstance, ExecutionKey,
  DeclaredExecutionKey, BindingVectorKey, ReadBindingVectorKey, ArtifactBindingsKey, BindingVectorData, ArtifactBindingsData,
  SignatureRequestData, SignatureRequestKey, MemberTypeRequestData, TypeProductionRequestData, ConstantReferenceKey, ProjectBindingValues, HasLexicalTypeDependency, ReadLexicalTypeSupport, RigidBindings,
  AdmitTypePublicationStep, CreateTypePublicationWork, InternTypeGraph, RefuseTypeConstruction, TypePublicationRefusalOf } from "./contract.js";
import { createTypeInterner as create, admitTypeTable as adopt, internType as intern,
  readType as read, readSignature as readCallable, viewTypes as view, exportTypes as publish } from "./interner.js";
import { substitute as transform, substituteSignature as transformSignature, projectBindingValues as projectBindings,
  hasLexicalTypeDependency as dependsOnLexicalType, readLexicalTypeSupport as readLexicalSupport } from "./substitute.js";
import { printTypes as print } from "./print.js";
import { parseTypes as parse } from "./parse.js";
import { verifyTypes as verify } from "./verify.js";
import { internTypeGraph as graph } from "./intern-graph.js";
import type { JoinSourceChoice } from "./contract.js";
import { joinSourceChoice as joinChoice } from "./source-choice.js";
import { admitTypePublicationStep as publicationStep, createTypePublicationWork as publicationWork, publicationRefusalOf as publicationRefusal,
  refuseTypeConstruction as constructionRefusal } from "./work.js";
import { verifyBindings as verifyBindingVectors } from "./verify-bindings.js";
import type { LiteralTypeValuesEqual, VerifyBindings } from "./contract.js";
import { nativeFactsKey as nativeKey, nativeArrayExtentOf as arrayExtent, nativeArrayHoldingOf as arrayHolding, isNativeBinaryFloatPrimitive as binaryFloatPrimitive, isNativeIntegerPrimitive as integerPrimitive, isNativeSignedIntegerPrimitive as signedIntegerPrimitive, nativeIntegerGeometryOf as integerGeometry, floatingBitsFit as floatingFit, floatingFormatWidth as floatingWidth, platformDeclarationKey as platformKey, verifyNativeFacts as verifyNative } from "./native-facts.js";
import { literalTypeValuesEqual as equalLiterals, nativeCarrierOf as carrier, optionalValueDomainOf as optionalValueDomain } from "./native-carrier.js";
import { exactFloat64LiteralFit as exactFloat64, literalCompatibilityOf as literalCompatibility } from "./literal-compatibility.js";
import { selectorPathKey, typeProductionRequestData as projectTypeProductionRequest } from "./selector-path.js";
import { compareMemberKeys as compareMembers } from "./canonical.js";
import { compareIndexSignatures as compareIndexes, artifactBindingsData as projectArtifactBindings, artifactBindingsKeyOf, bindingVectorData as projectBindingVector,
  bindingVectorKeyOf, readBindingVectorKey as readBindingKey, declaredExecutionKeyOf, executionKeyOf, instanceKeyOf, sameInstanceAs,
  signatureRequestData as projectSignatureRequest, signatureRequestKeyOf, memberTypeRequestData as projectMemberTypeRequest,
  constantReferenceKeyOf, rigidBindings as rigid, memberStorageData as projectMemberStorage } from "./value.js";

export const createTypeInterner: CreateTypeInterner = create;
export const createTypePublicationWork: CreateTypePublicationWork = publicationWork;
export const admitTypePublicationStep: AdmitTypePublicationStep = publicationStep;
export const refuseTypeConstruction: RefuseTypeConstruction = constructionRefusal;
export const typePublicationRefusalOf: TypePublicationRefusalOf = publicationRefusal;
export const internTypeGraph: InternTypeGraph = graph;
export const joinSourceChoice: JoinSourceChoice = joinChoice;
export const nativeFactsKey: NativeFactsKey = nativeKey;
export const nativeArrayHoldingOf: NativeArrayHoldingOf = arrayHolding;
export const nativeArrayExtentOf: NativeArrayExtentOf = arrayExtent;
export const isNativeBinaryFloatPrimitive: IsNativeBinaryFloatPrimitive = binaryFloatPrimitive;
export const isNativeIntegerPrimitive: IsNativeIntegerPrimitive = integerPrimitive;
export const isNativeSignedIntegerPrimitive: IsNativeSignedIntegerPrimitive = signedIntegerPrimitive;
export const floatingBitsFit: FloatingBitsFit = floatingFit;
export const floatingFormatWidth: FloatingFormatWidth = floatingWidth;
export const nativeCarrierOf: NativeCarrierOf = carrier;
export const optionalValueDomainOf: OptionalValueDomainOf = optionalValueDomain;
export const literalCompatibilityOf: LiteralCompatibilityOf = literalCompatibility;
export const exactFloat64LiteralFit: ExactFloat64LiteralFit = exactFloat64;
export const nativeIntegerGeometryOf: NativeIntegerGeometryOf = integerGeometry;
export const platformDeclarationKey: PlatformDeclarationKey = platformKey;
export const verifyNativeFacts: VerifyNativeFacts = verifyNative;
export const memberStorageData: MemberStorageData = projectMemberStorage;
export const admitTypeTable: AdmitTypeTable = adopt;
export const internType: InternType = intern;
export const readType: ReadType = read;
export const readSignature: ReadSignature = readCallable;
export const viewTypes: ViewTypes = view;
export const constantReferenceKey: ConstantReferenceKey = constantReferenceKeyOf;
export const exportTypes: ExportTypes = publish;
export const substitute: Substitute = transform;
export const substituteSignature: SubstituteSignature = transformSignature;
export const projectBindingValues: ProjectBindingValues = projectBindings;
export const hasLexicalTypeDependency: HasLexicalTypeDependency = dependsOnLexicalType;
export const readLexicalTypeSupport: ReadLexicalTypeSupport = readLexicalSupport;
export const printTypes: PrintTypes = print;
export const parseTypes: ParseTypes = parse;
export const verifyTypes: VerifyTypes = verify;
export const compareIndexSignatures: CompareIndexSignatures = compareIndexes;
export const compareMemberKeys: CompareMemberKeys = compareMembers;
export const verifyBindings: VerifyBindings = verifyBindingVectors;
export const literalTypeValuesEqual: LiteralTypeValuesEqual = equalLiterals;
export const encodeSelectorPath: EncodeSelectorPath = selectorPathKey;
export const typeProductionRequestData: TypeProductionRequestData = projectTypeProductionRequest;
export const instanceKey: InstanceKey = instanceKeyOf;
export const sameInstance: SameInstance = sameInstanceAs;
export const executionKey: ExecutionKey = executionKeyOf;
export const declaredExecutionKey: DeclaredExecutionKey = declaredExecutionKeyOf;
export const bindingVectorKey: BindingVectorKey = bindingVectorKeyOf;
export const readBindingVectorKey: ReadBindingVectorKey = readBindingKey;
export const artifactBindingsKey: ArtifactBindingsKey = artifactBindingsKeyOf;
export const bindingVectorData: BindingVectorData = projectBindingVector;
export const artifactBindingsData: ArtifactBindingsData = projectArtifactBindings;
export const signatureRequestData: SignatureRequestData = projectSignatureRequest;
export const signatureRequestKey: SignatureRequestKey = signatureRequestKeyOf;
export const memberTypeRequestData: MemberTypeRequestData = projectMemberTypeRequest;
export const rigidBindings: RigidBindings = rigid;

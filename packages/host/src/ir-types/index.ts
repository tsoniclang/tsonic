import type { NativeCarrierOf, NativeFactsKey, FloatingBitsFit, FloatingFormatWidth, PlatformDeclarationKey, VerifyNativeFacts, MemberStorageData, CreateTypeInterner, SeedTypeInterner, InternType, InternSignature, ReadType, ReadSignature, ViewTypes,
  ExportTypes, Substitute, SubstituteSignature, PrintTypes, ParseTypes, VerifyTypes, EncodeSelectorPath, InstanceKey, SameInstance,
  ExecutionKey, DeclaredExecutionKey, BindingVectorData, ArtifactBindingsData, BindingVectorKey, ArtifactBindingsKey,
  SignatureRequestData, SignatureRequestKey, ConstantReferenceKey, SubstituteBindingValues, RigidBindings } from "./contract.js";
import { createTypeInterner as create, seedTypeInterner as seed, internType as intern, internSignature as signature,
  readType as read, readSignature as readCallable, viewTypes as view, exportTypes as publish } from "./interner.js";
import { substitute as transform, substituteSignature as transformSignature, substituteBindingValues as transformBindingValues } from "./substitute.js";
import { printTypes as print } from "./print.js";
import { parseTypes as parse } from "./parse.js";
import { verifyTypes as verify } from "./verify.js";
import { nativeCarrierOf as carrierOf, nativeFactsKey as nativeKey, floatingBitsFit as floatingFit, floatingFormatWidth as floatingWidth, platformDeclarationKey as platformKey, verifyNativeFacts as verifyNative } from "./native-facts.js";
import { selectorPathKey } from "./selector-path.js";
import { artifactBindingsData as projectArtifactBindings, artifactBindingsKeyOf, bindingVectorData as projectBindingVector,
  bindingVectorKeyOf, declaredExecutionKeyOf, executionKeyOf, instanceKeyOf, sameInstanceAs,
  signatureRequestData as projectSignatureRequest, signatureRequestKeyOf, constantReferenceKeyOf, rigidBindings as rigid, memberStorageData as projectMemberStorage } from "./value.js";

export const nativeCarrierOf: NativeCarrierOf = carrierOf;
export const nativeFactsKey: NativeFactsKey = nativeKey;
export const floatingBitsFit: FloatingBitsFit = floatingFit;
export const floatingFormatWidth: FloatingFormatWidth = floatingWidth;
export const platformDeclarationKey: PlatformDeclarationKey = platformKey;
export const verifyNativeFacts: VerifyNativeFacts = verifyNative;
export const memberStorageData: MemberStorageData = projectMemberStorage;

export const createTypeInterner: CreateTypeInterner = create;
export const seedTypeInterner: SeedTypeInterner = seed;
export const internType: InternType = intern;
export const internSignature: InternSignature = signature;
export const readType: ReadType = read;
export const readSignature: ReadSignature = readCallable;
export const viewTypes: ViewTypes = view;
export const exportTypes: ExportTypes = publish;
export const substitute: Substitute = transform;
export const substituteSignature: SubstituteSignature = transformSignature;
export const substituteBindingValues: SubstituteBindingValues = transformBindingValues;
export const constantReferenceKey: ConstantReferenceKey = constantReferenceKeyOf;
export const rigidBindings: RigidBindings = rigid;
export const printTypes: PrintTypes = print;
export const parseTypes: ParseTypes = parse;
export const verifyTypes: VerifyTypes = verify;
export const encodeSelectorPath: EncodeSelectorPath = selectorPathKey;
export const instanceKey: InstanceKey = instanceKeyOf;
export const sameInstance: SameInstance = sameInstanceAs;
export const executionKey: ExecutionKey = executionKeyOf;
export const declaredExecutionKey: DeclaredExecutionKey = declaredExecutionKeyOf;
export const bindingVectorData: BindingVectorData = projectBindingVector;
export const artifactBindingsData: ArtifactBindingsData = projectArtifactBindings;
export const bindingVectorKey: BindingVectorKey = bindingVectorKeyOf;
export const artifactBindingsKey: ArtifactBindingsKey = artifactBindingsKeyOf;
export const signatureRequestData: SignatureRequestData = projectSignatureRequest;
export const signatureRequestKey: SignatureRequestKey = signatureRequestKeyOf;

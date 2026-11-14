import type { CreateTypeInterner, SeedTypeInterner, InternType, InternSignature, ReadType, ReadSignature, ViewTypes,
  ExportTypes, Substitute, SubstituteSignature, PrintTypes, ParseTypes, VerifyTypes, EncodeSelectorPath,
  BindingVectorKey, ArtifactBindingsKey, BindingVectorData, ArtifactBindingsData, SignatureRequestData, SignatureRequestKey, InstanceKey } from "./contract.js";
import { createTypeInterner as create, seedTypeInterner as seed, internType as intern, internSignature as signature,
  readType as read, readSignature as readCallable, viewTypes as view, exportTypes as publish } from "./interner.js";
import { substitute as transform, substituteSignature as transformSignature } from "./substitute.js";
import { printTypes as print } from "./print.js";
import { parseTypes as parse } from "./parse.js";
import { verifyTypes as verify } from "./verify.js";
import { selectorPathKey } from "./selector-path.js";
import { artifactBindingsData as projectArtifactBindings, artifactBindingsKeyOf, bindingVectorData as projectBindingVector,
  bindingVectorKeyOf, instanceKeyOf, signatureRequestData as projectSignatureRequest, signatureRequestKeyOf } from "./value.js";

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
export const printTypes: PrintTypes = print;
export const parseTypes: ParseTypes = parse;
export const verifyTypes: VerifyTypes = verify;
export const encodeSelectorPath: EncodeSelectorPath = selectorPathKey;
export const bindingVectorKey: BindingVectorKey = bindingVectorKeyOf;
export const artifactBindingsKey: ArtifactBindingsKey = artifactBindingsKeyOf;
export const bindingVectorData: BindingVectorData = projectBindingVector;
export const artifactBindingsData: ArtifactBindingsData = projectArtifactBindings;
export const signatureRequestData: SignatureRequestData = projectSignatureRequest;
export const signatureRequestKey: SignatureRequestKey = signatureRequestKeyOf;
export const instanceKey: InstanceKey = instanceKeyOf;

import type { DeclaredSignatureOf, DescribeDefinitions, ErrorSignature, PlaceSignature, ResumeDeclaredSignatureOf } from "./contract.js";
import { placeSignature as place } from "./placement.js";
import { describeDefinitions as describe } from "./definitions.js";
import { declaredSignatureOf as signatureOf, errorSignature as erroneousSignature, resumeDeclaredSignatureOf as resumeSignatureOf } from "./signatures.js";

export const describeDefinitions: DescribeDefinitions = describe;
export const declaredSignatureOf: DeclaredSignatureOf = signatureOf;
export const resumeDeclaredSignatureOf: ResumeDeclaredSignatureOf = resumeSignatureOf;
export const errorSignature: ErrorSignature = erroneousSignature;
export const placeSignature: PlaceSignature = place;

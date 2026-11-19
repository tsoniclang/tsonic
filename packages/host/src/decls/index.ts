import type { ClassifyCycle, DeclaredSignatureOf, DescribeDefinitions, ErrorSignature, MembersOf, PlaceSignature, ResumeDeclaredSignatureOf } from "./contract.js";
import { classifyCycle as classify } from "./cycles.js";
import { membersOf as inventoryOf } from "./members.js";
import { placeSignature as place } from "./placement.js";
import { describeDefinitions as describe } from "./definitions.js";
import { declaredSignatureOf as signatureOf, errorSignature as erroneousSignature, resumeDeclaredSignatureOf as resumeSignatureOf } from "./signatures.js";

export const describeDefinitions: DescribeDefinitions = describe;
export const declaredSignatureOf: DeclaredSignatureOf = signatureOf;
export const resumeDeclaredSignatureOf: ResumeDeclaredSignatureOf = resumeSignatureOf;
export const errorSignature: ErrorSignature = erroneousSignature;
export const placeSignature: PlaceSignature = place;
export const classifyCycle: ClassifyCycle = classify;
export const membersOf: MembersOf = inventoryOf;

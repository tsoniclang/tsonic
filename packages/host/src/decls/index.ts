import type { ClassifyCycle, DeclaredSignatureOf, DescribeDefinitions, ErrorSignature, MembersOf, MemberTypeOf, PlaceSignature, ResumeDeclaredSignatureOf } from "./contract.js";
import { classifyCycle as classify } from "./cycles.js";
import { membersOf as inventoryOf, memberTypeOf as typeOfMember } from "./members.js";
import { placeSignature as place } from "./placement.js";
import { describeDefinitions as describe } from "./definitions.js";
import type { ProduceType, ResumeProduceType } from "./contract.js";
import { produceType as produce, resumeProduceType as resumeProduction } from "./type-production.js";
import { declaredSignatureOf as signatureOf, errorSignature as erroneousSignature, resumeDeclaredSignatureOf as resumeSignatureOf } from "./signatures.js";

export const describeDefinitions: DescribeDefinitions = describe;
export const declaredSignatureOf: DeclaredSignatureOf = signatureOf;
export const resumeDeclaredSignatureOf: ResumeDeclaredSignatureOf = resumeSignatureOf;
export const errorSignature: ErrorSignature = erroneousSignature;
export const placeSignature: PlaceSignature = place;
export const classifyCycle: ClassifyCycle = classify;
export const membersOf: MembersOf = inventoryOf;
export const memberTypeOf: MemberTypeOf = typeOfMember;
export const produceType: ProduceType = produce;
export const resumeProduceType: ResumeProduceType = resumeProduction;

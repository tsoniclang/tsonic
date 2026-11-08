import type { AstReader } from "@tsonic/tsts";
import { type SourceTypeDescriptor } from "./descriptor-model.js";
/** The arms of a descriptor: union members (flattened), the value and absence of an optional, else the descriptor itself. */
export declare function sourceTypeDescriptorArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[];
/** An arm that is only null / undefined / void (A11: void is absence). */
export declare function sourceTypeDescriptorIsAbsentArm(type: SourceTypeDescriptor): boolean;
/** An arm with no values (never). */
export declare function sourceTypeDescriptorIsNeverArm(type: SourceTypeDescriptor): boolean;
/** The whole value is absent: every arm is absence or void (a never type is not absent). */
export declare function sourceTypeDescriptorIsAbsent(type: SourceTypeDescriptor): boolean;
/** The value may be absent at runtime: an absence or void arm, an optional, or a top (any / unknown) arm. */
export declare function sourceTypeDescriptorMayBeAbsent(ast: Pick<AstReader, "is">, type: SourceTypeDescriptor): boolean;
/** The present arms: absence, void and never arms removed. Empty when the value is never present. */
export declare function sourceTypeDescriptorPresentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[];
//# sourceMappingURL=descriptor-arms.d.ts.map
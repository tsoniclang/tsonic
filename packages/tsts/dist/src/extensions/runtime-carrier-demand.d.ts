import type { CheckedOperationObservationPointName, ExtensionObservationRequest } from "./observations.js";
import type { ExtensionFactSubject } from "./host.js";
export interface CheckedOperationRuntimeCarrierDemand {
    readonly type: ExtensionFactSubject;
    readonly sourceOrigin: ExtensionFactSubject;
    readonly sourceTypeReference?: ExtensionFactSubject;
    readonly sourceSymbol?: ExtensionFactSubject;
}
export declare function checkedOperationRuntimeCarrierDemands<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>): readonly CheckedOperationRuntimeCarrierDemand[];
//# sourceMappingURL=runtime-carrier-demand.d.ts.map
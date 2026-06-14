import * as slices from "../../go/slices.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/typeacquisition.go::method::TypeAcquisition.Equals","kind":"method","status":"implemented","sigHash":"5386e30ab6ccfe9cb39062c78348cbd4c2fe7cfdf5bf854c6a4713e20c73162d","bodyHash":"ce4f1e356107c826a51362cbc0aadb34aab77ea1f683c318987ea6db50061d31"}
 *
 * Go source:
 * func (ta *TypeAcquisition) Equals(other *TypeAcquisition) bool {
 * 	if ta == other {
 * 		return true
 * 	}
 * 	if ta == nil || other == nil {
 * 		return false
 * 	}
 *
 * 	return (ta.Enable == other.Enable &&
 * 		slices.Equal(ta.Include, other.Include) &&
 * 		slices.Equal(ta.Exclude, other.Exclude) &&
 * 		ta.DisableFilenameBasedTypeAcquisition == other.DisableFilenameBasedTypeAcquisition)
 * }
 */
export function TypeAcquisition_Equals(receiver, other) {
    const ta = receiver;
    if (ta === other) {
        return true;
    }
    if (ta === undefined || other === undefined) {
        return false;
    }
    return (ta.Enable === other.Enable &&
        slices.Equal(ta.Include, other.Include) &&
        slices.Equal(ta.Exclude, other.Exclude) &&
        ta.DisableFilenameBasedTypeAcquisition === other.DisableFilenameBasedTypeAcquisition);
}
//# sourceMappingURL=typeacquisition.js.map
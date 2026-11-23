import { WithValue } from "../../go/context.js";
const admissionKey = Symbol("native checker acquisition");
class AcquisitionAdmission {
    admit;
    provisional = false;
    constructor(admit) {
        this.admit = admit;
    }
}
export function admitNativeChecker(checker, cost, units = 1) {
    const admission = checker?.ctx?.Value(admissionKey);
    if (admission instanceof AcquisitionAdmission && units !== 0)
        admission.admit(cost, units);
}
export function markNativeCheckerProvisional(checker) {
    const admission = checker?.ctx?.Value(admissionKey);
    if (admission instanceof AcquisitionAdmission)
        admission.provisional = true;
}
export function runNativeCheckerAcquisition(checker, context, admit, terminate, read) {
    const prior = checker.ctx;
    if (prior?.Value(admissionKey) instanceof AcquisitionAdmission) {
        throw new Error("A checked acquisition cannot nest its owning admission scope.");
    }
    const abandoned = {};
    let refusal = null;
    const admission = new AcquisitionAdmission((cost, units) => {
        refusal ??= admit(cost, units);
        if (refusal !== null)
            throw abandoned;
    });
    checker.ctx = WithValue(context, admissionKey, admission);
    try {
        return { kind: "complete", value: read() };
    }
    catch (error) {
        if (error !== abandoned || refusal === null)
            throw error;
        if (admission.provisional)
            terminate();
        return { kind: "refused", stop: refusal };
    }
    finally {
        checker.ctx = prior;
    }
}
//# sourceMappingURL=resource-admission.js.map
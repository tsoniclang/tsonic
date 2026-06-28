import { DeepEqual as reflectDeepEqual } from "../../reflect.js";
import { Sprint, Sprintf } from "../../fmt.js";
export function Assert(t, comparison, ...msgAndArgs) {
    if (!evaluateComparison(comparison)) {
        t.Fatal(failureMessage("assertion failed", msgAndArgs));
    }
}
export function Check(t, comparison, ...msgAndArgs) {
    if (evaluateComparison(comparison)) {
        return true;
    }
    t.Error(failureMessage("check failed", msgAndArgs));
    return false;
}
export function DeepEqual(t, actual, expected, ...msgAndArgs) {
    if (!reflectDeepEqual(actual, expected)) {
        t.Fatal(failureMessage(`not deep equal:\nactual: ${Sprint(actual)}\nexpected: ${Sprint(expected)}`, msgAndArgs));
    }
}
export function Equal(t, actual, expected, ...msgAndArgs) {
    if (actual !== expected) {
        t.Fatal(failureMessage(`not equal: ${Sprint(actual)} != ${Sprint(expected)}`, msgAndArgs));
    }
}
export function Error(t, err, expected, ...msgAndArgs) {
    if (err === undefined || err.message !== expected) {
        t.Fatal(failureMessage(`expected error ${expected}, got ${err?.message ?? "<nil>"}`, msgAndArgs));
    }
}
export function ErrorContains(t, err, expected, ...msgAndArgs) {
    if (err === undefined || !err.message.includes(expected)) {
        t.Fatal(failureMessage(`expected error containing ${expected}, got ${err?.message ?? "<nil>"}`, msgAndArgs));
    }
}
export function NilError(t, err, ...msgAndArgs) {
    if (err !== undefined) {
        t.Fatal(failureMessage(`expected nil error, got ${err.message}`, msgAndArgs));
    }
}
function evaluateComparison(comparison) {
    if (typeof comparison === "function") {
        const result = comparison();
        return (result === undefined || result === true);
    }
    return Boolean(comparison);
}
function failureMessage(defaultMessage, msgAndArgs) {
    if (msgAndArgs.length === 0) {
        return defaultMessage;
    }
    const [format, ...args] = msgAndArgs;
    if (typeof format === "string" && args.length > 0) {
        return `${defaultMessage}: ${Sprintf(format, ...args)}`;
    }
    return `${defaultMessage}: ${msgAndArgs.map((arg) => Sprint(arg)).join(" ")}`;
}
//# sourceMappingURL=assert.js.map
const hostOwnedDiagnostics = new WeakSet();
export function markHostOwnedExtensionDiagnostic(diagnostic) {
    hostOwnedDiagnostics.add(diagnostic);
    return diagnostic;
}
export function isHostOwnedExtensionDiagnostic(diagnostic) {
    return hostOwnedDiagnostics.has(diagnostic);
}
//# sourceMappingURL=diagnostic-ownership.js.map
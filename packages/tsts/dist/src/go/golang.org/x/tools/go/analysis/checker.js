export function Analyze(analyzers, packages) {
    for (const analyzer of analyzers) {
        if (typeof analyzer.Run !== "function") {
            continue;
        }
        for (const pkg of packages) {
            const result = analyzer.Run({ Pkg: pkg });
            const err = Array.isArray(result) ? result[1] : result;
            if (err !== undefined) {
                return err;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=checker.js.map
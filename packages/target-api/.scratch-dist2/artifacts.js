import { formatDiagnosticEvidenceDetails } from "./target-artifacts/diagnostic-evidence.js";
export class TargetCompilerResourceLimitFailure extends Error {
    constructor(source, subject, dimension, limit, sourceNode) {
        super(`${subject} exceeded the compiler resource limit ${dimension}=${limit}.`);
        this.name = "TargetCompilerResourceLimitFailure";
        this.diagnostic = Object.freeze({ code: "TSONIC_COMPILER_RESOURCE_LIMIT", category: "error",
            source, sourceNode, message: this.message, evidence: Object.freeze([`${dimension}=${limit}`]) });
    }
}
export function failTargetCompilerResourceLimit(source, subject, dimension, limit, sourceNode) {
    throw new TargetCompilerResourceLimitFailure(source, subject, dimension, limit, sourceNode);
}
export function targetDiagnosticFromExtension(node, diagnostic) {
    return {
        code: diagnostic.publicCode ?? `TS${diagnostic.numericCode}`,
        category: diagnostic.category,
        source: diagnostic.extensionId,
        message: diagnostic.message,
        ...(node === undefined ? {} : { sourceNode: node }),
        ...(diagnostic.evidence === undefined || diagnostic.evidence.length === 0 ? {} : {
            evidence: Object.freeze([...new Set(diagnostic.evidence.map(entry => entry.details === undefined ? entry.message
                    : `${entry.message}: ${formatDiagnosticEvidenceDetails(entry.details)}`))]),
        }),
    };
}
class TargetCompilationInvariantFailure extends Error {
    constructor(phase, source, message, sourceNode) {
        super(message);
        this.phase = phase;
        this.diagnostic = Object.freeze({
            code: phase === "analysis"
                ? "TSONIC_INTERNAL_ANALYSIS_INVARIANT"
                : "TSONIC_INTERNAL_PLANNER_INVARIANT",
            category: "error",
            source,
            message,
            sourceNode,
        });
    }
}
export function failTargetAnalysisInvariant(source, message, sourceNode) {
    throw new TargetCompilationInvariantFailure("analysis", source, message, sourceNode);
}
export function failTargetPlannerInvariant(source, message, sourceNode) {
    throw new TargetCompilationInvariantFailure("planning", source, message, sourceNode);
}
export function resolvedTargetStage(value, diagnostics = []) {
    if (diagnostics.some((diagnostic) => diagnostic.category === "error")) {
        throw new Error("A resolved target stage cannot contain an error diagnostic.");
    }
    return Object.freeze({
        kind: "resolved",
        value,
        diagnostics: Object.freeze([...diagnostics]),
    });
}
export function rejectedTargetStage(diagnostics) {
    if (!diagnostics.some((diagnostic) => diagnostic.category === "error")) {
        throw new Error("A rejected target stage must contain at least one error diagnostic.");
    }
    return Object.freeze({
        kind: "rejected",
        diagnostics: Object.freeze([...diagnostics]),
    });
}
function compilerResourceFailure(stages, failure) {
    return failure instanceof TargetCompilerResourceLimitFailure ? failure : stages.compilerResourceFailure?.(failure);
}
export function runTargetCompilationStages(stages, observer) {
    let analysis;
    try {
        analysis = stages.analyze();
    }
    catch (failure) {
        const resourceFailure = compilerResourceFailure(stages, failure);
        if (resourceFailure !== undefined)
            return rejectedTargetStage([resourceFailure.diagnostic]);
        if (!(failure instanceof TargetCompilationInvariantFailure) || failure.phase !== "analysis") {
            throw failure;
        }
        return rejectedTargetStage([failure.diagnostic]);
    }
    if (analysis.kind === "rejected") {
        return rejectedTargetStage(analysis.diagnostics);
    }
    observer?.analyzed?.(analysis.value);
    let planning;
    try {
        planning = stages.plan(analysis.value);
    }
    catch (failure) {
        const resourceFailure = compilerResourceFailure(stages, failure);
        if (resourceFailure !== undefined)
            return rejectedTargetStage([...analysis.diagnostics, resourceFailure.diagnostic]);
        if (!(failure instanceof TargetCompilationInvariantFailure) || failure.phase !== "planning") {
            throw failure;
        }
        return rejectedTargetStage([...analysis.diagnostics, failure.diagnostic]);
    }
    const diagnostics = Object.freeze([
        ...analysis.diagnostics,
        ...planning.diagnostics,
    ]);
    if (planning.kind === "rejected") {
        return rejectedTargetStage(diagnostics);
    }
    observer?.planned?.(planning.value);
    try {
        return resolvedTargetStage(stages.materialize(planning.value), diagnostics);
    }
    catch (failure) {
        const resourceFailure = compilerResourceFailure(stages, failure);
        if (resourceFailure === undefined)
            throw failure;
        return rejectedTargetStage([...diagnostics, resourceFailure.diagnostic]);
    }
}
//# sourceMappingURL=artifacts.js.map
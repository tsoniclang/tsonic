import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceLexicalCapture } from "../../source-navigation/lexical-captures.js";
import type { SourceControlFlowGraph, SourceDeclarationFlowExecutionRegion, SourceFlowEdgeKind, SourceFlowLimits, SourceFlowOperation } from "./model.js";
export interface SourceFlowContext {
    readonly returnTo: number;
    readonly throwTo: number;
    readonly breaks: ReadonlyMap<Node, number>;
    readonly continues: ReadonlyMap<Node, number>;
}
export interface SourceFlowConstruction {
    readonly source: SourceAnalysisProgram;
    readonly includes: (node: Node) => boolean;
    readonly initializeSuper: (next: number, context: SourceFlowContext) => number;
    readonly captures: (source: Node) => readonly SourceLexicalCapture[];
    readonly point: (source: Node | undefined, operation: SourceFlowOperation) => number;
    readonly edge: (from: number, to: number, kind?: SourceFlowEdgeKind) => void;
    readonly emit: (source: Node, operation: SourceFlowOperation, next: number, context: SourceFlowContext, mayThrow?: boolean, kind?: SourceFlowEdgeKind) => number;
    readonly expression: (source: Node, next: number, context: SourceFlowContext) => number;
    readonly statement: (source: Node, next: number, context: SourceFlowContext) => number;
    readonly pattern: (source: Node, next: number, context: SourceFlowContext, initialization: boolean, value: Extract<SourceFlowOperation, {
        readonly kind: "write";
    }>["value"]) => number;
    readonly step: (source?: Node) => void;
}
export declare function createSourceFlowConstruction<Region = SourceDeclarationFlowExecutionRegion>(declaration: Node, limits: SourceFlowLimits): {
    point: (origin: Node | undefined, operation: SourceFlowOperation) => number;
    edge: (from: number, to: number, kind?: SourceFlowEdgeKind) => void;
    emit: (source: Node, operation: SourceFlowOperation, next: number, context: SourceFlowContext, mayThrow?: boolean, kind?: SourceFlowEdgeKind) => number;
    step: (source?: Node) => void;
    nested: <Result>(node: Node, visit: () => Result) => Result;
    withExecution<Result>(selected: Region | undefined, visit: () => Result): Result;
    finish(entry: number, exit: number, exceptionExit: number): SourceControlFlowGraph<Region>;
};
export declare function sourceFlowSequence(nodes: readonly (Node | undefined)[], next: number, context: SourceFlowContext, visit: SourceFlowConstruction["expression"]): number;
export interface SourceFlowCleanupScope {
    readonly next: number;
    readonly context: SourceFlowContext;
}
export declare function sourceFlowCleanupScope(build: SourceFlowConstruction, declaration: Node, next: number, context: SourceFlowContext): SourceFlowCleanupScope;
export declare function sourceFlowResourceScope(build: SourceFlowConstruction, declarations: readonly Node[], next: number, context: SourceFlowContext, body: (next: number, context: SourceFlowContext) => number, acquire?: (declaration: Node, next: number, context: SourceFlowContext) => number): number;
//# sourceMappingURL=construction.d.ts.map
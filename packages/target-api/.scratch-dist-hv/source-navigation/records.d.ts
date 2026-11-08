import type { Node, SourceFile } from "@tsonic/tsts";
export interface SourceProjectReference {
    readonly declaration: Node;
    readonly sourceFile: SourceFile;
}
export interface SourceProjectModuleDependency {
    readonly sourceFile: SourceFile;
    readonly declaration: Node;
    readonly moduleSpecifier: Node;
    readonly kind: "import" | "export";
}
export type SourceProjectModuleSpecifierResolution = {
    readonly kind: "project";
    readonly sourceFile: SourceFile;
    readonly moduleSpecifier: Node;
} | {
    readonly kind: "non-project";
    readonly moduleSpecifier: Node;
} | {
    readonly kind: "unresolved";
    readonly moduleSpecifier: Node;
};
export interface SourceProjectModuleExport {
    readonly exportName: string;
    readonly declaration: Node;
    readonly sourceFile: SourceFile;
}
export interface SourceProjectMemberDispatch {
    readonly overridesBase: boolean;
    readonly hasDerivedOverride: boolean;
}
export type SourceProjectMemberImplementationResult = {
    readonly kind: "resolved";
    readonly contractDeclaration: Node;
    readonly implementation: SourceDeclarationReference;
} | {
    readonly kind: "unrelated";
} | {
    readonly kind: "unresolved";
    readonly reason: string;
};
export type SourceProjectMemberContractsResult = {
    readonly kind: "resolved";
    readonly implementationDeclaration: Node;
    readonly contracts: readonly Node[];
} | {
    readonly kind: "unresolved";
    readonly declaration: Node;
    readonly reason: string;
};
export type SourceCallableImplementationResult = SourceProjectMemberImplementationResult;
export interface SourceBindingWrite {
    readonly reference: Node;
    readonly operation: Node;
    readonly kind: "assignment" | "update" | "iteration" | "initialization" | "deletion";
    readonly values: readonly SourceBindingWriteValue[];
}
export interface SourceBindingWriteValue {
    readonly kind: "value" | "iteration-value" | "iteration-key";
    readonly expression: Node;
    readonly projection: readonly Node[];
}
export interface SourceDeclarationReference {
    readonly declaration: Node;
    readonly sourceFile: SourceFile;
    readonly project: boolean;
}
export interface SourceReferenceIndexStatistics {
    readonly constructionPasses: 1;
    readonly sourceFiles: number;
    readonly nodesVisited: number;
    readonly referenceCandidates: number;
    readonly selectedReferences: number;
    readonly selectedDeclarations: number;
    readonly reverseEdges: number;
    readonly moduleExportsExamined: number;
}
export interface SourceExpressionEffects {
    readonly invokes: boolean;
    readonly mutates: boolean;
    readonly suspends: boolean;
    readonly mayThrow: boolean;
}
export interface SourceDeclarationUse {
    readonly reference: Node;
    readonly memberReceiver?: Node;
    readonly kind: "direct-call" | "first-class" | "source-linkage" | "type-only";
    readonly role: "call-target" | "receiver" | "argument" | "return" | "yield" | "write" | "storage" | "comparison" | "condition" | "value" | "source-linkage" | "type-only";
    readonly captured: boolean;
    readonly throughMember: boolean;
}
export type SourceValueEscapeKind = "argument" | "capture" | "export" | "return" | "storage" | "yield";
export interface SourceDeclarationUseSummary {
    readonly declaration: Node;
    readonly uses: readonly SourceDeclarationUse[];
    readonly directCallCount: number;
    readonly firstClassUseCount: number;
    readonly bindingWritten: boolean;
    readonly memberWritten: boolean;
    readonly constructorInitialized: boolean;
    readonly mutatedAfterInitialization: boolean;
    readonly receiverUsed: boolean;
    readonly identityCompared: boolean;
    readonly conditionallyRead: boolean;
    readonly aliasedOrStored: boolean;
    readonly captured: boolean;
    readonly exported: boolean;
    readonly escapeKinds: readonly SourceValueEscapeKind[];
    readonly hasUnclassifiedValueUse: boolean;
}
export interface SourceParameterUseSummary extends SourceDeclarationUseSummary {
    readonly kind: "parameter";
    readonly passedAsArgument: boolean;
    readonly returned: boolean;
    readonly yielded: boolean;
}
export interface SourceCountedLoop {
    readonly statement: Node;
    readonly counterDeclaration: Node;
    readonly start: Node;
    readonly bound: Node;
    readonly body: Node;
    readonly direction: "ascending";
    readonly comparison: "exclusive-upper-bound";
    readonly step: 1;
}
export interface SourceExpressionValueFlowSummary {
    readonly expression: Node;
    readonly aliasDeclarations: readonly Node[];
    readonly uses: readonly SourceDeclarationUse[];
    readonly bindingAliased: boolean;
    readonly memberWritten: boolean;
    readonly receiverUsed: boolean;
    readonly identityCompared: boolean;
    readonly captured: boolean;
    readonly returned: boolean;
    readonly yielded: boolean;
    readonly passedAsArgument: boolean;
    readonly storedOutsideBinding: boolean;
    readonly exported: boolean;
    readonly discarded: boolean;
    readonly hasUnclassifiedUse: boolean;
    readonly escapes: boolean;
}
export interface SourceDeclaredHeritageEdge {
    readonly kind: "extends" | "implements";
    readonly sourceDeclaration: Node;
    readonly heritage: Node;
    readonly target: SourceDeclarationReference;
    readonly typeArguments: readonly Node[];
}
export interface SourceClassConstructorParameter {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterDeclaration: Node;
    readonly authoredTypeNode?: Node;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
}
export interface SourceClassConstructorSignature {
    readonly declaration?: Node;
    readonly parameters: readonly SourceClassConstructorParameter[];
}
export type SourceClassConstructorResult = {
    readonly kind: "resolved";
    readonly declaration: Node;
    readonly implicit: boolean;
    readonly signatures: readonly SourceClassConstructorSignature[];
} | {
    readonly kind: "unresolved";
    readonly declaration: Node;
    readonly reason: string;
};
export type SourceDeclaredHeritageResult = {
    readonly kind: "resolved";
    readonly edges: readonly SourceDeclaredHeritageEdge[];
} | {
    readonly kind: "unresolved";
    readonly heritage: Node;
    readonly reason: string;
};
export type SourceHeritagePathResult = {
    readonly kind: "related";
    readonly edges: readonly SourceDeclaredHeritageEdge[];
} | {
    readonly kind: "unrelated";
} | {
    readonly kind: "unresolved";
    readonly heritage: Node;
    readonly reason: string;
};
//# sourceMappingURL=records.d.ts.map
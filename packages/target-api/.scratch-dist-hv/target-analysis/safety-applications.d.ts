import type { AstReader, ExtensionFactSubject, Node, SourceFile } from "@tsonic/tsts";
import type { SourceIdentityRoles } from "../public/source/roles.js";
export type TargetSafetyApplicationPlacement = "declaration" | "constructor" | "getter" | "setter";
export interface TargetSafetyApplicationFact {
    readonly kind: "application";
    readonly applicationTarget: ExtensionFactSubject;
    readonly selectedMember?: ExtensionFactSubject;
    readonly selectedMemberDeclaration?: Node;
    readonly selectedMemberDeclarations?: readonly Node[];
    readonly applicationPlacement: TargetSafetyApplicationPlacement;
}
export type TargetSafetyBuilderFact = TargetSafetyApplicationFact | (Omit<TargetSafetyApplicationFact, "kind"> & {
    readonly kind: "builder-state";
});
export type TargetSafetyApplication<Fact extends TargetSafetyBuilderFact> = Fact & {
    readonly sourceSubject: Node;
    readonly sourceFile: SourceFile;
    readonly selectedMemberDeclarations: readonly Node[];
    readonly resolvedRootDeclaration?: Node;
    readonly targetDeclarations: readonly Node[];
};
export type TargetSafetyOperation<UnsafeContext, Builder> = {
    readonly kind: "unsafe-context";
    readonly fact: UnsafeContext;
} | {
    readonly kind: "safety-builder";
    readonly fact: Builder;
};
export interface TargetSafetyApplicationIndexInput<UnsafeContext, Builder extends TargetSafetyBuilderFact> {
    readonly ast: AstReader;
    readonly sourceFiles: readonly SourceFile[];
    /** The published identity roles (`facts.navigation.identity`): application targets resolve through them. */
    readonly identity: Pick<SourceIdentityRoles, "target" | "isProjectDeclaration">;
    readUnsafeContext(subject: Node): UnsafeContext | undefined;
    readSafetyBuilder(subject: Node): Builder | undefined;
}
export interface TargetSafetyApplicationIndex<UnsafeContext, Builder, Application> {
    readonly all: readonly Application[];
    forSourceFile(sourceFile: SourceFile): readonly Application[];
    forDeclaration(declaration: Node): readonly Application[];
    isCompileTimeApplicationReference(declaration: Node, reference: Node): boolean;
    operationForSubject(subject: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
    operationForExpression(expression: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
}
export declare function createTargetSafetyApplicationIndex<UnsafeContext, Builder extends TargetSafetyBuilderFact>(input: TargetSafetyApplicationIndexInput<UnsafeContext, Builder>): TargetSafetyApplicationIndex<UnsafeContext, Builder, TargetSafetyApplication<Builder & TargetSafetyApplicationFact>>;
//# sourceMappingURL=safety-applications.d.ts.map
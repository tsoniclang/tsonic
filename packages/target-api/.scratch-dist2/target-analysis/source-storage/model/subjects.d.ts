import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { AstReader, Node } from "@tsonic/tsts";
export type SourceStorageProjection = {
    readonly kind: "array-element";
} | {
    readonly kind: "tuple-element";
    readonly index: number;
} | {
    readonly kind: "member";
    readonly declaration: Node;
} | {
    readonly kind: "method-value";
    readonly declaration: Node;
};
export declare function sourceStorageIsMemberProjection(component: SourceStorageProjection): component is Extract<SourceStorageProjection, {
    readonly kind: "member" | "method-value";
}>;
export interface SourceStorageSubject {
    readonly kind: "input" | "value" | "member" | "return" | "receiver";
    readonly node: Node;
    readonly projection: readonly SourceStorageProjection[];
    readonly projectionKey: string;
}
export type SourceStorageSubjectQuery = (node: Node | undefined, kind?: SourceStorageSubject["kind"], projection?: readonly SourceStorageProjection[]) => SourceStorageSubject | undefined;
export declare function sourceStorageFormalOwner(subject: SourceStorageSubject, source: SourceAnalysisProgram): Node | undefined;
export declare function sourceStorageObjectRestOwner(node: Node, ast: AstReader): Node | undefined;
export declare function sourceStorageIsDataMember(node: Node, ast: AstReader): boolean;
export declare function sourceStorageIsMethodMember(node: Node, ast: AstReader): boolean;
export declare function sourceStorageMemberSubject(node: Node, ast: AstReader, subject: SourceStorageSubjectQuery, projection?: readonly SourceStorageProjection[]): SourceStorageSubject | undefined;
export declare function sourceStorageHasOriginalCallableValue(subject: SourceStorageSubject, ast: AstReader): boolean;
export declare function sourceStorageIsDirectCreation(subject: SourceStorageSubject, ast: AstReader): boolean;
export declare function sourceStorageHasOriginalValue(subject: SourceStorageSubject, ast: AstReader, hasIncoming: boolean): boolean;
export declare function sourceStorageProjectionPath(projection: readonly SourceStorageProjection[]): readonly SourceStorageProjection[] | undefined;
export declare function createSourceStorageSubjects(admit: (cost: number) => boolean, reject: (reason: string) => void): SourceStorageSubjectQuery;
//# sourceMappingURL=subjects.d.ts.map
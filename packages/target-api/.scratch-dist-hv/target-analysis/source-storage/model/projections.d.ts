import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";
export interface SourceStorageWriteProjection {
    readonly subjects: readonly SourceStorageSubject[];
    readonly birth?: readonly {
        readonly origin: SourceStorageSubject;
        readonly destination: SourceStorageSubject;
    }[];
}
export declare function createSourceStorageProjectionFlow(source: SourceAnalysisProgram, step: () => boolean, subject: SourceStorageSubjectQuery, subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined, locationFor: (node: Node | undefined) => SourceStorageSubject | undefined, connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined) => void, unresolved: (subject: SourceStorageSubject, reason: string) => void, sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined): Readonly<{
    indexed: (node: Node, location?: boolean) => SourceStorageSubject | undefined;
    binding: (reference: Node) => SourceStorageSubject | undefined;
    writeValue: (input: SourceBindingWriteValue) => SourceStorageWriteProjection | undefined;
    literal: (node: Node) => void;
    ownerFor: (node: Node, projection?: readonly SourceStorageProjection[]) => SourceStorageSubject | undefined;
}>;
//# sourceMappingURL=projections.d.ts.map
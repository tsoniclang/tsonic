import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageEdgeTypes } from "./relations.js";
export declare function createSourceStorageStructuralFlow(source: SourceAnalysisProgram, step: () => boolean, subject: SourceStorageSubjectQuery, connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined, types?: SourceStorageEdgeTypes) => void, sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined, retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean): (origin: SourceStorageSubject, destination: SourceStorageSubject, types?: SourceStorageEdgeTypes) => void;
//# sourceMappingURL=structural-flow.d.ts.map
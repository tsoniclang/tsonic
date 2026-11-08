import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageProjectionView } from "../graph/scoped-model.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
export declare function sourceStorageProjectionType(source: SourceAnalysisProgram, subject: SourceStorageSubject, views: readonly SourceStorageProjectionView[] | undefined, sourceFile?: SourceFile): SourceTypeDescriptor | undefined;
export declare function sourceStorageProjectionSubject(subject: SourceStorageSubject, views: readonly SourceStorageProjectionView[] | undefined, select: SourceStorageSubjectQuery): SourceStorageSubject | undefined;
export declare function sourceStorageWithProjectionView(views: readonly SourceStorageProjectionView[] | undefined, receiver: SourceStorageSubject, checked: SourceStorageSubject, type: SourceTypeDescriptor): readonly SourceStorageProjectionView[];
//# sourceMappingURL=projection-views.d.ts.map
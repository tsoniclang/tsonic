import type { Node, SourceFile } from "@tsonic/tsts";
import type { HostSourceProgram } from "../source-semantics/types.js";
import type { SourceTypeDescriptor } from "../source-semantics/descriptor-model.js";
export type SourceAnalysisProgram = HostSourceProgram;
/** Whether a source file is one of the program's checked files (project and library files). */
export declare function sourceAnalysisIncludesFile(source: Pick<SourceAnalysisProgram, "sourceFiles">, sourceFile: SourceFile | undefined): boolean;
/** Whether a node lies in one of the program's checked files. */
export declare function sourceAnalysisIncludesNode(source: Pick<SourceAnalysisProgram, "ast" | "sourceFiles">, node: Node): boolean;
/** The Host descriptor of a value node, or undefined when the Host refused the value (the refusal is in facts.refusals()). */
export declare function sourceAnalysisValueType(source: Pick<SourceAnalysisProgram, "facts">, node: Node): SourceTypeDescriptor | undefined;
/** The Host result descriptor of a callable declaration (awaited payload for async non-generator callables), or undefined when refused. */
export declare function sourceAnalysisCallableResult(source: Pick<SourceAnalysisProgram, "ast" | "facts">, declaration: Node): SourceTypeDescriptor | undefined;
/**
 * A scalar arm: a primitive (number family, bool, char), string, bigint, symbol, or an enum (checker
 * isStringLike / isNumberLike / isBooleanLike / isBigIntLike / isSymbolLike on a non-union type).
 */
export declare function sourceAnalysisIsScalar(type: SourceTypeDescriptor, isEnumDeclaration: (node: Node) => boolean): boolean;
/** The callable signatures a descriptor arm carries (call signatures of a callable or shape). */
export declare function sourceAnalysisCallSignatures(type: SourceTypeDescriptor): readonly import("../source-semantics/descriptor-model.js").SourceTypeDescriptorSignature[];
/** The construct signatures a descriptor arm carries. */
export declare function sourceAnalysisConstructSignatures(type: SourceTypeDescriptor): readonly import("../source-semantics/descriptor-model.js").SourceTypeDescriptorSignature[];
//# sourceMappingURL=analysis-program.d.ts.map
import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNullishAdmission, SourceRefusal, SourceSumFacts, SourceUnionRelation } from "../../public/source/facts.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceSolvedValueModel } from "./solver.js";
import type { SourceTypeDescriptor } from "./types.js";
/** The value-model readers the typeof decision reads (all published Host facts; no checker input except host-input). */
export interface SourceTypeofCategoryInputs {
    readonly ast: AstReader;
    readonly input: SourceHostInput;
    readonly solved: Pick<SourceSolvedValueModel, "numberOrigin" | "literal" | "armNumberOriginKinds" | "numberOriginKinds">;
    readonly sums: Pick<SourceSumFacts, "sum" | "sumOf">;
    relationAt(node: Node): SourceUnionRelation | undefined;
    resolvedType(node: Node): SourceTypeDescriptor | undefined;
    requireType(node: Node, purpose: string): SourceTypeDescriptor;
    absence(selected: SourceTypeDescriptor): "never" | "possible" | "always";
}
/** The typeof/nullish record of `operand` at `operation`, or the refusal of an unproven category. Not memoized here. */
export declare function createSourceTypeofCategories(inputs: SourceTypeofCategoryInputs): (operation: Node, operand: Node) => SourceNullishAdmission | SourceRefusal;
//# sourceMappingURL=typeof-categories.d.ts.map
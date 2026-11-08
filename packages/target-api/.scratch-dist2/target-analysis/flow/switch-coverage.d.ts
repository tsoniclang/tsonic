import type { Node } from "@tsonic/tsts";
import { type SourceAnalysisProgram } from "../analysis-program.js";
/**
 * Answers whether a switch statement without a default clause selects a case for every value its discriminant can
 * hold (ruling Q79: baseline capability, units from the Host sum and relation of the subject). Units:
 * - a `boolean` Host type: true / false; an enum Host type: one unit per enum member;
 * - a member read `o.k`: the literal domain of member `k` in every arm of the receiver. The arms are those the Host
 *   per-arm relation at the read selects (a narrowed receiver keeps only its narrowed arms), else the present arms of
 *   the receiver's Host type. Each arm's member must carry its literal domain (descriptor member `literals`);
 * - any other subject: the Host literal domain of the value (values.literalDomain), else the literal-union annotation of
 *   its declaration (through non-generic aliases), declaration input. A narrowed discriminant is not covered.
 * A subject whose Host type may be absent (an optional discriminant, an optional member, an optional chain, a top arm)
 * also has the absence unit, which no case covers: the Host publishes no null / undefined distinction for a case, so
 * the switch keeps its fallthrough exit (baseline: an undefined member had no unit key). Each case contributes the unit
 * of its literal value or the enum member it references. Anything else is not proven covered.
 */
export declare function createSourceSwitchCoverage(source: SourceAnalysisProgram): (switchStatement: Node) => boolean;
//# sourceMappingURL=switch-coverage.d.ts.map
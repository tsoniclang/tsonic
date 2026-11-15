import type { ConstraintsOf, GroupsOf, ResumeConstraintsOf, ResumeSolveGroup, SolveGroup } from "./contract.js";
import { partition } from "./groups.js";
import { constraintsOf as constraintSystem, resumeConstraintsOf as resumeConstraintSystem } from "./constraints.js";
import { resumeSolveGroup as resumeSolution, solveGroup as solution } from "./solve.js";

export const groupsOf: GroupsOf = partition;
export const constraintsOf: ConstraintsOf = constraintSystem;
export const resumeConstraintsOf: ResumeConstraintsOf = resumeConstraintSystem;
export const solveGroup: SolveGroup = solution;
export const resumeSolveGroup: ResumeSolveGroup = resumeSolution;

import type { Result } from "../diag/contract.js";
import type { SelectedNativeFacts, TypeExpansionLimits, TypeInterner, TypeTerm } from "../ir-types/contract.js";
import type {
  ApplicationDecision, CandidateInput, CaptureModeEvidence, CaptureRow, ClosureDecision, ClosureInput, CoreInput, DomainFitInput, EmbedInput,
  EmbeddingDecision, IndexDecision, IndexInput, LibraryInput, LiteralConstructionInput, LiteralFitInput,
  MemoryEquivalentInput, OperationDecision, OperatorInput,
  ProtocolInput, RefinementDecision, RefinementInput, RuleOutcome, RuleTable, RuleWork, TypePatternMatchOutcome,
} from "../ir-infer/contract.js";
import type { Libraries } from "../libraries/contract.js";
import type { MemberSuspension } from "./member-pause.js";

// No synchronous readers of members, signatures, attributes, constants or produced types: a rule's answers arrive in its
// input (COMPONENTS §3 part 9).
export interface RulesDeps {
  readonly libraries: Libraries;
  readonly selectedNativeFacts: SelectedNativeFacts;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
}

export type Embed = (
  deps: RulesDeps,
  input: EmbedInput,
  work: RuleWork,
) => Result<RuleOutcome<EmbeddingDecision>>;

export type DomainFit = (
  deps: RulesDeps,
  input: DomainFitInput,
) => Result<RuleOutcome<boolean>>;

export type MemoryEquivalent = (
  deps: RulesDeps,
  input: MemoryEquivalentInput,
) => Result<RuleOutcome<boolean>>;

export type MemberRuleContinuation = MemberSuspension;
export type TypePatternMatch = (check: TypeTerm, pattern: TypeTerm) => TypePatternMatchOutcome;

export type LookupIndex = (
  deps: RulesDeps,
  input: IndexInput,
) => Result<RuleOutcome<IndexDecision>>;

export type ConstructLiteral = (
  deps: RulesDeps,
  input: LiteralConstructionInput,
  work: RuleWork,
) => Result<RuleOutcome<OperationDecision>>;

export type DecideCandidate = (
  deps: RulesDeps,
  input: CandidateInput,
  work: RuleWork,
) => Result<RuleOutcome<ApplicationDecision>>;

export type Operators = (
  deps: RulesDeps,
  input: OperatorInput,
) => Result<RuleOutcome<OperationDecision>>;

export type LiteralFit = (
  deps: RulesDeps,
  input: LiteralFitInput,
  work: RuleWork,
) => Result<RuleOutcome<EmbeddingDecision>>;

export type Protocols = (
  deps: RulesDeps,
  input: ProtocolInput,
) => Result<RuleOutcome<OperationDecision>>;

export type Refinement = (
  deps: RulesDeps,
  input: RefinementInput,
) => Result<RuleOutcome<RefinementDecision>>;

export type Library = (
  deps: RulesDeps,
  input: LibraryInput,
) => Result<RuleOutcome<OperationDecision>>;

export type Core = (
  deps: RulesDeps,
  input: CoreInput,
) => Result<RuleOutcome<OperationDecision>>;

export type DecideClosure = (
  deps: RulesDeps,
  input: ClosureInput,
) => Result<RuleOutcome<ClosureDecision>>;

export type DecideCaptureModes = (
  deps: RulesDeps,
  input: readonly CaptureModeEvidence[],
) => Result<readonly CaptureRow[]>;

export type CreateRuleTable = (deps: RulesDeps) => RuleTable<MemberRuleContinuation>;

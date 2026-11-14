import type { Result } from "../diag/contract.js";
import type { TypeExpansionLimits, TypeInterner } from "../ir-types/contract.js";
import type {
  ApplicationDecision, CandidateInput, ClosureDecision, ClosureInput, CoreInput, DomainFitInput, EmbedInput,
  EmbeddingDecision, IndexInput, LibraryInput, LiteralConstructionInput, LiteralFitInput,
  MemberDecision, MemberInput, MemoryEquivalentInput, OperationDecision, OperatorInput,
  ProtocolInput, RefinementDecision, RefinementInput, RuleOutcome, RuleTable,
} from "../ir-infer/contract.js";
import type { Libraries } from "../libraries/contract.js";

// No synchronous readers of members, signatures, attributes, constants or produced types: a rule's answers arrive in its
// input (COMPONENTS §3 part 9).
export interface RulesDeps {
  readonly libraries: Libraries;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
}

export type Embed = (
  deps: RulesDeps,
  input: EmbedInput,
) => Result<RuleOutcome<EmbeddingDecision>>;

export type DomainFit = (
  deps: RulesDeps,
  input: DomainFitInput,
) => Result<RuleOutcome<boolean>>;

export type MemoryEquivalent = (
  deps: RulesDeps,
  input: MemoryEquivalentInput,
) => Result<RuleOutcome<boolean>>;

export type LookupMember = (
  deps: RulesDeps,
  input: MemberInput,
) => Result<RuleOutcome<MemberDecision>>;

export type LookupIndex = (
  deps: RulesDeps,
  input: IndexInput,
) => Result<RuleOutcome<MemberDecision>>;

export type ConstructLiteral = (
  deps: RulesDeps,
  input: LiteralConstructionInput,
) => Result<RuleOutcome<OperationDecision>>;

export type DecideCandidate = (
  deps: RulesDeps,
  input: CandidateInput,
) => Result<RuleOutcome<ApplicationDecision>>;

export type Operators = (
  deps: RulesDeps,
  input: OperatorInput,
) => Result<RuleOutcome<OperationDecision>>;

export type LiteralFit = (
  deps: RulesDeps,
  input: LiteralFitInput,
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

// The fourteenth decision operation (COMPONENTS §3 part 1): the logical captures and the creation of a closure value.
export type DecideClosure = (
  deps: RulesDeps,
  input: ClosureInput,
) => Result<RuleOutcome<ClosureDecision>>;

export type CreateRuleTable = (deps: RulesDeps) => RuleTable;

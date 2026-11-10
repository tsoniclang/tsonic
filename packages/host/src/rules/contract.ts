import type { Result } from "../diag/contract.js";
import type { DefId, TyId } from "../ids/contract.js";
import type {
  ArtifactBindings, BodyInstance, ConstantContext, ConstValue, MemberTable, Signature, TypeEvidence, TypeExpansionLimits, TypeInterner, TypeProductionRequest,
} from "../ir-types/contract.js";
import type {
  CheckedPhase, Declaration, HirAttribute,
} from "../ir-hir/contract.js";
import type {
  ApplicationDecision, CandidateInput, CoreInput, DomainFitInput, EmbedInput,
  EmbeddingDecision, IndexInput, LibraryInput, LiteralConstructionInput, LiteralFitInput,
  MemberDecision, MemberInput, MemoryEquivalentInput, OperationDecision, OperatorInput,
  ProtocolInput, RefinementDecision, RefinementInput, RuleOutcome, RuleTable,
} from "../ir-infer/contract.js";
import type { Libraries } from "../libraries/contract.js";

export interface RulesDeps {
  readonly libraries: Libraries;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly membersOf: (type: TyId) => MemberTable;
  readonly signatureOf: (definition: DefId, bindings: ArtifactBindings) => Signature;
  readonly attributesOf: (definition: DefId) => readonly HirAttribute[];
  readonly constValue: (initializer: BodyInstance, context: ConstantContext) => ConstValue;
  readonly produceType: (request: TypeProductionRequest) => TypeEvidence;
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

export type CreateRuleTable = (deps: RulesDeps) => RuleTable;

import type {
  Diagnostic,
  Identity,
  Presence,
  ProgramIdentity,
  ResourceDomain,
  ResourceUsage,
  SourceSite,
} from "../model/contract.js";

export type QuestionKeyPart =
  | string | number | bigint | boolean | null
  | Identity | readonly QuestionKeyPart[];

export interface QuestionIdentity {
  readonly scope: ResourceScope;
  readonly parts: readonly QuestionKeyPart[];
}

declare const questionTypes: unique symbol;

export interface Question<Input, Answer> {
  readonly owner: string;
  readonly name: string;
  readonly [questionTypes]?: {
    readonly input: (input: Input) => Input;
    readonly answer: (answer: Answer) => Answer;
  };
}

type HasKind<Value> = Value extends unknown
  ? "kind" extends keyof Value ? true : false : never;

export type QuestionRetention<Answer> =
  readonly [Answer] extends readonly [never] ? never :
  unknown extends Answer ? never :
  object extends Answer ? never :
  readonly [Answer] extends readonly [{ readonly kind: infer Kind }]
    ? readonly [Kind] extends readonly [string]
      ? string extends Kind ? never : "completed-outcome"
      : never
    : true extends HasKind<Answer> ? never : "immutable";

export interface QuestionDefinition<Input, Answer> {
  readonly owner: string;
  readonly name: string;
  readonly domain: string;
  readonly retention: QuestionRetention<Answer>;
  readonly authenticate: (input: Input) => QuestionIdentity;
}

export interface Registration<Input, Answer> {
  readonly question: Question<Input, Answer>;
  provide(provider: (input: Input, scope: ResourceScope) => Answer): void;
}

export interface Reservation {
  release(): void;
}

export interface ResourceScope {
  readonly programIdentity: ProgramIdentity;
  readonly domain: string;
  readonly owner: Identity;
  charge(dimension: string, amount: bigint): void;
  reserve(dimension: string, amount: bigint,
    retention: "temporary" | "retained"): Reservation;
  withDepth<Value>(dimension: string, action: () => Value): Value;
  close(): void;
}

export interface QuestionUsage {
  readonly owner: string;
  readonly name: string;
  readonly calls: bigint;
  readonly completed: bigint;
  readonly hits: bigint;
  readonly active: bigint;
}

export interface ContextUsage {
  readonly questions: readonly QuestionUsage[];
  readonly resources: readonly ResourceUsage[];
}

export interface ContextOptions {
  readonly resourceDomains: readonly ResourceDomain[];
}

export interface Context {
  readonly programIdentity: ProgramIdentity;
  readonly queryUsage: ContextUsage;
  register<Input, Answer>(definition: QuestionDefinition<Input, Answer>):
    Registration<Input, Answer>;
  sealRegistration(): void;
  query<Input, Answer>(question: Question<Input, Answer>, input: Input): Answer;
  resourceScope(domain: string, owner: Identity,
    site: Presence<SourceSite>): ResourceScope;
  close(): void;
}

export interface ContextFactory {
  readonly create: (options: ContextOptions) => Context;
  readonly resourceLimitDiagnostic: (error: Error) => Presence<Diagnostic>;
}

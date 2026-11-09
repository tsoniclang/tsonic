import type {
  Context, ContextOptions, ContextUsage, Question, QuestionDefinition,
  Registration, ResourceScope,
} from "./contract.js";
import type { Identity, Presence, ProgramIdentity, QueryChainEntry, SourceSite } from "../model/contract.js";
import { invariant } from "./failures.js";
import { Keys } from "./keys.js";
import { QuestionState } from "./question.js";
import type { QuestionMetadata } from "./question.js";
import { Resources, validateOptions } from "./resources.js";

const programAuthority = Symbol("Context program authority");

class Program implements Context {
  readonly programIdentity: ProgramIdentity = Object.freeze({ kind: "program" });
  readonly #resources: Resources;
  readonly #keys: Keys;
  readonly #questions = new Map<object, QuestionMetadata>();
  readonly #names = new Map<string, Set<string>>();
  readonly #chain: QueryChainEntry[] = [];
  #declaring = true;
  #sealed = false;

  constructor(authority: symbol, options: ContextOptions) {
    if (authority !== programAuthority) invariant("INVALID_CONTEXT_INPUT");
    this.#resources = new Resources(this.programIdentity, options);
    this.#keys = new Keys(this.programIdentity, this.#resources);
    Object.freeze(this);
  }

  get queryUsage(): ContextUsage {
    this.#resources.assertOpen();
    return Object.freeze({ questions: Object.freeze([...this.#questions.values()].map(state => state.usage())),
      resources: this.#resources.snapshot() });
  }

  register<Input, Answer>(definition: QuestionDefinition<Input, Answer>): Registration<Input, Answer> {
    this.#resources.assertOpen();
    if (definition === null || typeof definition !== "object"
      || !["owner", "name", "domain", "retention", "authenticate"].every(field => {
        const descriptor = Object.getOwnPropertyDescriptor(definition, field);
        return descriptor !== undefined && Object.hasOwn(descriptor, "value");
      })
      || typeof definition.owner !== "string" || definition.owner.length === 0
      || typeof definition.name !== "string" || definition.name.length === 0
      || typeof definition.authenticate !== "function" || !this.#resources.hasDomain(definition.domain)
      || (definition.retention !== "immutable" && definition.retention !== "completed-outcome")) {
      invariant("INVALID_CONTEXT_INPUT");
    }
    if (!this.#declaring) invariant("REGISTRATION_SEALED", definition.owner, definition.name);
    let names = this.#names.get(definition.owner);
    if (names?.has(definition.name)) invariant("DUPLICATE_QUESTION", definition.owner, definition.name);
    if (names === undefined) {
      names = new Set();
      this.#names.set(definition.owner, names);
    }
    names.add(definition.name);
    const state = new QuestionState(definition);
    const question = state.handle();
    this.#questions.set(question, state);
    const program = this;
    const registration: Registration<Input, Answer> = Object.freeze({
      question,
      provide(provider: (input: Input, scope: ResourceScope) => Answer): void {
        program.#resources.assertOpen();
        if (this !== registration) invariant("FOREIGN_QUESTION", state.owner, state.name);
        if (program.#sealed) invariant("REGISTRATION_SEALED", state.owner, state.name);
        state.provide(provider);
        program.#declaring = false;
      },
    });
    return registration;
  }

  sealRegistration(): void {
    this.#resources.assertOpen();
    if (this.#sealed) invariant("REGISTRATION_SEALED");
    for (const state of this.#questions.values()) {
      if (!state.ready()) invariant("MISSING_PROVIDER", state.owner, state.name);
    }
    this.#declaring = false;
    this.#sealed = true;
  }

  query<Input, Answer>(question: Question<Input, Answer>, input: Input): Answer {
    this.#resources.assertQuery();
    const state = this.#questions.get(question);
    if (state === undefined || !QuestionState.matches(state, question)) invariant("FOREIGN_QUESTION");
    if (!this.#sealed) invariant("REGISTRATION_UNSEALED", state.owner, state.name);
    const ticket = this.#resources.begin(state.domain);
    const chainIndex = this.#chain.length;
    this.#chain.push(Object.freeze({ owner: state.owner, question: state.name, site: Object.freeze({ kind: "none" }) }));
    try {
      return state.run(input, this.#resources, ticket, this.#keys, this.#chain, scope => {
        this.#chain[chainIndex] = Object.freeze({ owner: state.owner, question: state.name,
          site: this.#resources.site(scope) });
      });
    } finally {
      this.#chain.pop();
      this.#resources.end(ticket);
    }
  }

  resourceScope(domain: string, owner: Identity, site: Presence<SourceSite>): ResourceScope {
    return this.#resources.createScope(domain, owner, site);
  }

  close(): void {
    for (const state of this.#questions.values()) state.close();
    this.#questions.clear();
    this.#names.clear();
    this.#keys.clear();
    this.#resources.close();
  }
}

export function createProgram(options: ContextOptions): Context {
  validateOptions(options);
  return new Program(programAuthority, options);
}

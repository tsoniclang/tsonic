import type {
  Question, QuestionDefinition, QuestionIdentity, QuestionUsage, ResourceScope,
} from "./contract.js";
import type { QueryChainEntry } from "../model/contract.js";
import { invariant } from "./failures.js";
import type { Keys } from "./keys.js";
import type { Publication, QueryResources, Resources } from "./resources.js";

export interface QuestionMetadata {
  readonly owner: string;
  readonly name: string;
  readonly domain: string;
  ready(): boolean;
  close(): void;
  usage(): QuestionUsage;
}

interface Memo<Answer> {
  readonly answer: Answer;
  readonly publication: Publication;
}

export class QuestionState<Input, Answer> implements QuestionMetadata {
  declare readonly owner: string;
  declare readonly name: string;
  declare readonly domain: string;
  readonly #handle: Question<Input, Answer>;
  #authenticate: ((input: Input) => QuestionIdentity) | undefined;
  readonly #retention: "immutable" | "completed-outcome";
  readonly #memo = new Map<bigint, Memo<Answer>>();
  readonly #active = new Set<bigint>();
  #provider: ((input: Input, scope: ResourceScope) => Answer) | undefined;
  #calls = 0n;
  #completed = 0n;
  #hits = 0n;

  constructor(definition: QuestionDefinition<Input, Answer>) {
    Object.defineProperties(this, {
      owner: { value: definition.owner, enumerable: true },
      name: { value: definition.name, enumerable: true },
      domain: { value: definition.domain, enumerable: true },
    });
    this.#authenticate = definition.authenticate;
    this.#retention = definition.retention;
    this.#handle = Object.freeze({ owner: this.owner, name: this.name });
    Object.freeze(this);
  }

  static matches<Input, Answer>(metadata: QuestionMetadata,
    handle: Question<Input, Answer>): metadata is QuestionState<Input, Answer> {
    return metadata instanceof QuestionState && metadata.#handle === handle;
  }

  handle(): Question<Input, Answer> {
    return this.#handle;
  }

  provide(provider: (input: Input, scope: ResourceScope) => Answer): void {
    if (this.#provider !== undefined) invariant("DUPLICATE_PROVIDER", this.owner, this.name);
    if (typeof provider !== "function") invariant("INVALID_CONTEXT_INPUT", this.owner, this.name);
    this.#provider = provider;
  }

  ready(): boolean {
    return this.#provider !== undefined;
  }

  run(input: Input, resources: Resources, ticket: QueryResources, keys: Keys,
    chain: readonly QueryChainEntry[], setSite: (scope: ResourceScope) => void): Answer {
    this.#calls += 1n;
    const authenticate = this.#authenticate;
    if (authenticate === undefined) invariant("CONTEXT_CLOSED", this.owner, this.name);
    const identity = resources.authenticate(ticket, () => {
      const projected = authenticate(input);
      if (projected === null || typeof projected !== "object"
        || !["scope", "parts"].every(field => {
          const descriptor = Object.getOwnPropertyDescriptor(projected, field);
          return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value");
        })) {
        invariant("INVALID_QUESTION_KEY", this.owner, this.name);
      }
      resources.validate(projected.scope, ticket);
      setSite(projected.scope);
      return { scope: projected.scope, key: keys.encode(projected.parts, projected.scope) };
    });
    const key = identity.key;
    if (this.#active.has(key)) invariant("QUESTION_CYCLE", this.owner, this.name, chain);
    const cached = this.#memo.get(key);
    if (cached !== undefined) {
      resources.checkHeights(identity.scope, cached.publication.heights);
      resources.read(ticket, cached.publication);
      this.#hits += 1n;
      return cached.answer;
    }
    const provider = this.#provider;
    if (provider === undefined) invariant("MISSING_PROVIDER", this.owner, this.name);
    this.#active.add(key);
    try {
      const answer = provider(input, identity.scope);
      resources.assertOpen();
      if (this.#complete(answer)) {
        const publication = resources.publish(ticket, () => { this.#memo.delete(key); });
        try { resources.read(ticket, publication); }
        catch (error) { publication?.retire(); throw error; }
        if (publication !== undefined) {
          this.#memo.set(key, { answer, publication });
          this.#completed += 1n;
        }
      }
      return answer;
    } finally {
      this.#active.delete(key);
    }
  }

  usage(): QuestionUsage {
    return Object.freeze({ owner: this.owner, name: this.name, calls: this.#calls,
      completed: this.#completed, hits: this.#hits, active: BigInt(this.#active.size) });
  }

  close(): void {
    for (const memo of this.#memo.values()) memo.publication.retire();
    this.#memo.clear();
    this.#active.clear();
    this.#provider = undefined;
    this.#authenticate = undefined;
  }

  #complete(answer: Answer): boolean {
    if ((typeof answer === "object" && answer !== null) || typeof answer === "function") {
      if (!Object.isFrozen(answer)) invariant("INVALID_CONTEXT_INPUT", this.owner, this.name);
      if (this.#retention === "completed-outcome") {
        const kind = Object.getOwnPropertyDescriptor(answer, "kind");
        if (kind === undefined || !Object.prototype.hasOwnProperty.call(kind, "value") || typeof kind.value !== "string") {
          invariant("INVALID_CONTEXT_INPUT", this.owner, this.name);
        }
        return kind.value !== "pending" && kind.value !== "unresolved" && kind.value !== "partial";
      }
    } else if (this.#retention === "completed-outcome") {
      invariant("INVALID_CONTEXT_INPUT", this.owner, this.name);
    }
    return true;
  }
}

import type {
  CompilerResourceLimitFailure,
  ContextInvariantCode,
  ContextInvariantFailure,
  Diagnostic,
  Presence,
  QueryChainEntry,
  SourceSite,
} from "../model/contract.js";

const resourceAuthority = Symbol("Context resource authority");

class ResourceFailure extends Error implements CompilerResourceLimitFailure {
  readonly kind = "compiler-resource-limit";
  readonly dimension: string;
  readonly limit: bigint;
  readonly diagnostic: Diagnostic;
  #authority: symbol;

  constructor(authority: symbol, dimension: string, limit: bigint, diagnostic: Diagnostic) {
    super(diagnostic.message);
    if (authority !== resourceAuthority) throw new TypeError("Invalid resource failure authority");
    this.#authority = authority;
    this.dimension = dimension;
    this.limit = limit;
    this.diagnostic = diagnostic;
    Object.freeze(this);
  }

  static diagnostic(error: Error): Presence<Diagnostic> {
    return error instanceof ResourceFailure && #authority in error
      && error.#authority === resourceAuthority
      ? Object.freeze({ kind: "present", value: error.diagnostic })
      : Object.freeze({ kind: "none" });
  }
}

class InvariantFailure extends Error implements ContextInvariantFailure {
  readonly code: ContextInvariantCode;
  readonly owner: string;
  readonly question: string;
  readonly chain: readonly QueryChainEntry[];

  constructor(code: ContextInvariantCode, owner: string, question: string,
    chain: readonly QueryChainEntry[]) {
    super(`${code}: ${owner}/${question}`);
    this.code = code;
    this.owner = owner;
    this.question = question;
    this.chain = Object.freeze(chain.map(entry => Object.freeze({
      owner: entry.owner, question: entry.question, site: entry.site,
    })));
    Object.freeze(this);
  }
}

export function invariant(code: ContextInvariantCode, owner = "context", question = "",
  chain: readonly QueryChainEntry[] = []): never {
  throw new InvariantFailure(code, owner, question, chain);
}

export function resourceFailure(domain: string, owner: string, dimension: string,
  limit: bigint, attempted: bigint, site: Presence<SourceSite>): never {
  const diagnostic: Diagnostic = Object.freeze({
    category: "error", code: "TSONIC_COMPILER_RESOURCE_LIMIT", source: "tsonic.context",
    owner, message: `Resource limit exceeded: ${domain}/${dimension} (${limit})`, site,
    related: Object.freeze([]),
    evidence: Object.freeze([
      Object.freeze({ name: "domain", value: domain }),
      Object.freeze({ name: "dimension", value: dimension }),
      Object.freeze({ name: "limit", value: limit }),
      Object.freeze({ name: "attempted", value: attempted }),
    ]),
  });
  throw new ResourceFailure(resourceAuthority, dimension, limit, diagnostic);
}

export function resourceLimitDiagnostic(error: Error): Presence<Diagnostic> {
  return ResourceFailure.diagnostic(error);
}

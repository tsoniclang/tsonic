import type {
  CompilerResourceLimitFailure,
  ContextInvariantCode,
  ContextInvariantFailure,
  Diagnostic,
  Presence,
  QueryChainEntry,
  SourceSite,
} from "../model/contract.js";

const failureAuthority = Object.freeze({});

class ResourceFailure extends Error implements CompilerResourceLimitFailure {
  declare readonly kind: "compiler-resource-limit";
  declare readonly dimension: string;
  declare readonly limit: bigint;
  declare readonly diagnostic: Diagnostic;
  #authority: object;

  constructor(authority: object, dimension: string, limit: bigint, diagnostic: Diagnostic) {
    super(diagnostic.message);
    if (authority !== failureAuthority) throw new TypeError("Invalid resource failure authority");
    this.#authority = authority;
    Object.defineProperties(this, {
      kind: { value: "compiler-resource-limit", enumerable: true },
      dimension: { value: dimension, enumerable: true },
      limit: { value: limit, enumerable: true },
      diagnostic: { value: diagnostic, enumerable: true },
    });
    Object.freeze(this);
  }

  static diagnostic(error: Error): Presence<Diagnostic> {
    return error instanceof ResourceFailure && #authority in error
      && error.#authority === failureAuthority
      ? Object.freeze({ kind: "present", value: error.diagnostic })
      : Object.freeze({ kind: "none" });
  }
}

class InvariantFailure extends Error implements ContextInvariantFailure {
  declare readonly code: ContextInvariantCode;
  declare readonly owner: string;
  declare readonly question: string;
  declare readonly chain: readonly QueryChainEntry[];

  constructor(authority: object, code: ContextInvariantCode, owner: string, question: string,
    chain: readonly QueryChainEntry[]) {
    super(`${code}: ${owner}/${question}`);
    if (authority !== failureAuthority) throw new TypeError("Invalid invariant failure authority");
    Object.defineProperties(this, {
      code: { value: code, enumerable: true },
      owner: { value: owner, enumerable: true },
      question: { value: question, enumerable: true },
      chain: { value: Object.freeze(chain.map(entry => Object.freeze({
        owner: entry.owner, question: entry.question, site: entry.site,
      }))), enumerable: true },
    });
    Object.freeze(this);
  }
}

export function invariant(code: ContextInvariantCode, owner = "context", question = "",
  chain: readonly QueryChainEntry[] = []): never {
  throw new InvariantFailure(failureAuthority, code, owner, question, chain);
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
  throw new ResourceFailure(failureAuthority, dimension, limit, diagnostic);
}

export function resourceLimitDiagnostic(error: Error): Presence<Diagnostic> {
  return ResourceFailure.diagnostic(error);
}

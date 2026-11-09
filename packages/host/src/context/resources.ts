import type {
  ContextOptions, Reservation, ResourceScope,
} from "./contract.js";
import type {
  Identity, Presence, ProgramIdentity, ResourceDomain, ResourceUsage, SourceSite,
} from "../model/contract.js";
import { invariant, resourceFailure } from "./failures.js";

interface Counter {
  charged: bigint;
  temporary: bigint;
  retained: bigint;
  depth: bigint;
}

interface Usage extends Counter {
  peak: bigint;
}

interface Domain {
  readonly policy: ResourceDomain;
  readonly limits: ReadonlyMap<string, bigint>;
  readonly cohorts: Map<Identity, Map<string, Counter>>;
  readonly usage: Map<Identity, Map<string, Usage>>;
  operation: Map<string, Counter> | undefined;
}

interface Scope {
  readonly domain: Domain;
  readonly owner: Identity;
  readonly site: Presence<SourceSite>;
  readonly leases: Set<Lease>;
  open: boolean;
}

interface Lease {
  readonly retention: "temporary" | "retained";
  readonly release: () => void;
  active: boolean;
  transferred: boolean;
  invalidate: (() => void) | undefined;
}

export interface Height {
  readonly domain: string;
  readonly owner: Identity;
  readonly dimension: string;
  readonly height: bigint;
}

interface Backing {
  live: boolean;
  published: boolean;
  invalidate: (() => void) | undefined;
  retained: readonly Lease[];
  dependencies: Set<Backing> | undefined;
  dependents: Set<Backing> | undefined;
}

export interface Publication {
  readonly backing: Backing;
  readonly heights: readonly Height[];
  readonly retire: () => void;
}

export interface QueryResources {
  readonly domain: Domain;
  readonly root: boolean;
  readonly leases: Set<Lease>;
  readonly baseline: Map<Counter, bigint>;
  readonly heights: Map<Counter, Height>;
  scope: ResourceScope | undefined;
  backing: Backing | undefined;
}

function immutableRecord(value: object, fields: readonly string[]): boolean {
  return Object.isFrozen(value) && fields.every(field => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value");
  });
}

function dense<Value>(values: readonly Value[]): boolean {
  if (!Array.isArray(values) || !Object.isFrozen(values)) return false;
  for (let index = 0; index < values.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(values, index);
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      return false;
    }
  }
  return true;
}

function nonempty(value: string): boolean {
  return typeof value === "string" && value.length > 0;
}

export function validateOptions(options: ContextOptions): void {
  if (options === null || typeof options !== "object"
    || !immutableRecord(options, ["resourceDomains"]) || !dense(options.resourceDomains)) {
    invariant("INVALID_CONTEXT_INPUT");
  }
  const names = new Set<string>();
  for (const domain of options.resourceDomains) {
    if (domain === null || typeof domain !== "object"
      || !immutableRecord(domain, ["name", "limits", "admission", "keyDimension"])
      || !nonempty(domain.name) || names.has(domain.name)
      || (domain.admission !== "operation" && domain.admission !== "cohort")
      || !nonempty(domain.keyDimension) || !dense(domain.limits)) {
      invariant("INVALID_CONTEXT_INPUT");
    }
    names.add(domain.name);
    const dimensions = new Set<string>();
    for (const limit of domain.limits) {
      if (limit === null || typeof limit !== "object"
        || !immutableRecord(limit, ["dimension", "limit"]) || !nonempty(limit.dimension)
        || dimensions.has(limit.dimension) || typeof limit.limit !== "bigint" || limit.limit < 0n) {
        invariant("INVALID_CONTEXT_INPUT");
      }
      dimensions.add(limit.dimension);
    }
    if (!dimensions.has(domain.keyDimension)) invariant("INVALID_CONTEXT_INPUT");
  }
}

function counter(): Counter {
  return { charged: 0n, temporary: 0n, retained: 0n, depth: 0n };
}

function total(value: Counter): bigint {
  return value.charged + value.temporary + value.retained + value.depth;
}

export class Resources {
  readonly #program: ProgramIdentity;
  readonly #domains = new Map<string, Domain>();
  #scopes = new WeakMap<ResourceScope, Scope>();
  readonly #liveScopes = new Set<Scope>();
  readonly #tickets: QueryResources[] = [];
  readonly #depths = new Set<Counter>();
  #authenticating: QueryResources | undefined;
  #open = true;

  constructor(program: ProgramIdentity, options: ContextOptions) {
    this.#program = program;
    for (const policy of options.resourceDomains) {
      this.#domains.set(policy.name, {
        policy, limits: new Map(policy.limits.map(limit => [limit.dimension, limit.limit])),
        cohorts: new Map(), usage: new Map(), operation: undefined,
      });
    }
  }

  assertOpen(): void {
    if (!this.#open) invariant("CONTEXT_CLOSED");
  }

  assertQuery(): void {
    this.assertOpen();
    if (this.#authenticating !== undefined) invariant("AUTHENTICATION_REENTRANCY");
  }

  hasDomain(name: string): boolean {
    return this.#domains.has(name);
  }

  begin(name: string): QueryResources {
    this.assertQuery();
    const domain = this.#domains.get(name);
    if (domain === undefined) invariant("INVALID_RESOURCE_SCOPE");
    const root = domain.policy.admission === "operation" && domain.operation === undefined;
    if (root) domain.operation = new Map();
    const ticket: QueryResources = {
      domain, root, leases: new Set(), baseline: new Map(), heights: new Map(),
      scope: undefined, backing: undefined,
    };
    for (const value of this.#depths) ticket.baseline.set(value, value.depth);
    this.#tickets.push(ticket);
    return ticket;
  }

  authenticate<Value>(ticket: QueryResources, action: () => Value): Value {
    this.#authenticating = ticket;
    try { return action(); }
    finally { this.#authenticating = undefined; }
  }

  validate(scope: ResourceScope, ticket: QueryResources): void {
    const actual = this.#scope(scope);
    if (actual.domain !== ticket.domain) invariant("INVALID_RESOURCE_SCOPE", actual.owner.owner);
    ticket.scope = scope;
  }

  site(scope: ResourceScope): Presence<SourceSite> {
    return this.#scope(scope).site;
  }

  keyDimension(scope: ResourceScope): string {
    return this.#scope(scope).domain.policy.keyDimension;
  }

  end(ticket: QueryResources): void {
    if (ticket.backing !== undefined && !ticket.backing.published) this.#retire(ticket.backing);
    for (const lease of ticket.leases) {
      if (!lease.transferred) lease.release();
    }
    ticket.leases.clear();
    ticket.baseline.clear();
    ticket.heights.clear();
    this.#tickets.pop();
    if (ticket.root) ticket.domain.operation = undefined;
  }

  publish(ticket: QueryResources, invalidate: () => void): Publication | undefined {
    const backing = this.#backing(ticket);
    if (!backing.live) return undefined;
    const retained = [...ticket.leases].filter(lease => lease.active && lease.retention === "retained");
    const retire = (): void => { this.#retire(backing); };
    backing.invalidate = invalidate;
    backing.retained = retained;
    backing.published = true;
    for (const lease of retained) {
      lease.transferred = true;
      lease.invalidate = retire;
    }
    return Object.freeze({ backing, heights: Object.freeze([...ticket.heights.values()]), retire });
  }

  read(ticket: QueryResources, publication: Publication | undefined): void {
    const parent = this.#tickets[this.#tickets.length - 2];
    if (parent === undefined) return;
    const previous = parent.backing;
    if (previous !== undefined && !previous.live) return;
    if (publication === undefined || !publication.backing.live) {
      this.#retire(this.#backing(parent));
      return;
    }
    const child = publication.backing;
    if (previous?.dependencies?.has(child)) return;
    const scope = parent.scope;
    if (scope === undefined || this.#tickets[this.#tickets.length - 1] !== ticket) {
      invariant("INVALID_RESOURCE_SCOPE");
    }
    scope.charge(this.keyDimension(scope), 8n);
    const backing = this.#backing(parent);
    if (backing.dependencies === undefined) backing.dependencies = new Set();
    if (child.dependents === undefined) child.dependents = new Set();
    backing.dependencies.add(child);
    child.dependents.add(backing);
  }

  checkHeights(scope: ResourceScope, heights: readonly Height[]): void {
    const requesting = this.#scope(scope);
    for (const height of heights) {
      const domain = this.#domains.get(height.domain);
      if (domain === undefined) invariant("INVALID_RESOURCE_SCOPE");
      const budget = domain.policy.admission === "operation"
        ? domain.operation ?? new Map<string, Counter>() : this.#cohort(domain, height.owner);
      const value = this.#counter(budget, height.dimension);
      const limit = domain.limits.get(height.dimension);
      if (limit === undefined) invariant("INVALID_RESOURCE_SCOPE");
      const attempted = total(value) + height.height;
      if (attempted > limit) {
        resourceFailure(height.domain, height.owner.owner, height.dimension, limit, attempted, requesting.site);
      }
      this.#observe(value, height.domain, height.owner, height.dimension, value.depth + height.height);
    }
  }

  createScope(domainName: string, owner: Identity, site: Presence<SourceSite>): ResourceScope {
    this.assertOpen();
    const domain = this.#domains.get(domainName);
    if (domain === undefined || owner === null || typeof owner !== "object"
      || !immutableRecord(owner, ["programIdentity", "owner"])
      || owner.programIdentity !== this.#program || !nonempty(owner.owner)
      || site === null || typeof site !== "object" || !immutableRecord(site, ["kind"])
      || (site.kind !== "none" && site.kind !== "present")
      || !immutableRecord(site, site.kind === "none" ? ["kind"] : ["kind", "value"])) {
      invariant("INVALID_RESOURCE_SCOPE");
    }
    const state: Scope = { domain, owner, site, leases: new Set(), open: true };
    const scope: ResourceScope = Object.freeze({
      programIdentity: this.#program, domain: domainName, owner,
      charge: (dimension: string, amount: bigint): void => {
        const actual = this.#admit(state, dimension, amount);
        actual.value.charged += amount;
        actual.usage.charged += amount;
        this.#peak(actual.usage);
      },
      reserve: (dimension: string, amount: bigint, retention: "temporary" | "retained"): Reservation => {
        this.assertOpen();
        if (retention !== "temporary" && retention !== "retained") invariant("INVALID_RESOURCE_SCOPE", owner.owner);
        const actual = this.#admit(state, dimension, amount);
        actual.value[retention] += amount;
        actual.usage[retention] += amount;
        this.#peak(actual.usage);
        const lease: Lease = {
          retention, active: true, transferred: false, invalidate: undefined,
          release: (): void => {
            if (!lease.active) return;
            lease.active = false;
            const invalidate = lease.invalidate;
            lease.invalidate = undefined;
            invalidate?.();
            actual.value[retention] -= amount;
            actual.usage[retention] -= amount;
            state.leases.delete(lease);
          },
        };
        state.leases.add(lease);
        this.#tickets[this.#tickets.length - 1]?.leases.add(lease);
        return Object.freeze({ release: lease.release });
      },
      withDepth: <Value>(dimension: string, action: () => Value): Value => {
        const actual = this.#admit(state, dimension, 1n);
        actual.value.depth += 1n;
        this.#depths.add(actual.value);
        actual.usage.depth += 1n;
        this.#peak(actual.usage);
        this.#observe(actual.value, domainName, owner, dimension, actual.value.depth);
        try { return action(); }
        finally {
          actual.value.depth -= 1n;
          if (actual.value.depth === 0n) this.#depths.delete(actual.value);
          actual.usage.depth -= 1n;
        }
      },
      close: (): void => {
        if (!state.open) return;
        state.open = false;
        for (const lease of state.leases) if (!lease.transferred) lease.release();
        this.#liveScopes.delete(state);
      },
    });
    this.#scopes.set(scope, state);
    this.#liveScopes.add(state);
    return scope;
  }

  snapshot(): readonly ResourceUsage[] {
    this.assertOpen();
    const result: ResourceUsage[] = [];
    for (const domain of this.#domains.values()) {
      for (const [owner, dimensions] of domain.usage) {
        for (const [dimension, usage] of dimensions) {
          result.push(Object.freeze({ domain: domain.policy.name, owner, dimension,
            charged: usage.charged, temporary: usage.temporary,
            retained: usage.retained, peak: usage.peak }));
        }
      }
    }
    return Object.freeze(result);
  }

  close(): void {
    if (!this.#open) return;
    this.#open = false;
    for (const state of this.#liveScopes) {
      state.open = false;
      for (const lease of state.leases) lease.release();
    }
    this.#scopes = new WeakMap();
    this.#liveScopes.clear();
    this.#depths.clear();
    for (const domain of this.#domains.values()) {
      domain.cohorts.clear();
      domain.usage.clear();
      domain.operation = undefined;
    }
    this.#domains.clear();
  }

  #scope(scope: ResourceScope): Scope {
    this.assertOpen();
    const actual = this.#scopes.get(scope);
    if (actual === undefined || !actual.open) invariant("INVALID_RESOURCE_SCOPE");
    return actual;
  }

  #backing(ticket: QueryResources): Backing {
    if (ticket.backing === undefined) {
      ticket.backing = { live: true, published: false, invalidate: undefined,
        retained: [], dependencies: undefined, dependents: undefined };
    }
    return ticket.backing;
  }

  #retire(backing: Backing): void {
    if (!backing.live) return;
    backing.live = false;
    const pending = [backing];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) invariant("INVALID_RESOURCE_SCOPE");
      const invalidate = current.invalidate;
      current.invalidate = undefined;
      invalidate?.();
      for (const dependent of current.dependents ?? []) {
        if (dependent.live) {
          dependent.live = false;
          pending.push(dependent);
        }
        dependent.dependencies?.delete(current);
      }
      for (const dependency of current.dependencies ?? []) dependency.dependents?.delete(current);
      current.dependencies?.clear();
      current.dependents?.clear();
      const retained = current.retained;
      current.retained = [];
      for (const lease of retained) lease.release();
    }
  }

  #admit(scope: Scope, dimension: string, amount: bigint): { value: Counter; usage: Usage } {
    this.assertOpen();
    if (!scope.open || typeof amount !== "bigint" || amount < 0n
      || (this.#authenticating !== undefined && this.#authenticating.domain !== scope.domain)) {
      invariant("INVALID_RESOURCE_SCOPE", scope.owner.owner);
    }
    const limit = scope.domain.limits.get(dimension);
    if (limit === undefined) invariant("INVALID_RESOURCE_SCOPE", scope.owner.owner);
    const budget = scope.domain.policy.admission === "operation"
      ? scope.domain.operation : this.#cohort(scope.domain, scope.owner);
    if (budget === undefined) invariant("INVALID_RESOURCE_SCOPE", scope.owner.owner);
    const value = this.#counter(budget, dimension);
    const attempted = total(value) + amount;
    if (attempted > limit) {
      resourceFailure(scope.domain.policy.name, scope.owner.owner, dimension, limit, attempted, scope.site);
    }
    let dimensions = scope.domain.usage.get(scope.owner);
    if (dimensions === undefined) {
      dimensions = new Map();
      scope.domain.usage.set(scope.owner, dimensions);
    }
    let usage = dimensions.get(dimension);
    if (usage === undefined) {
      usage = { ...counter(), peak: 0n };
      dimensions.set(dimension, usage);
    }
    return { value, usage };
  }

  #cohort(domain: Domain, owner: Identity): Map<string, Counter> {
    let budget = domain.cohorts.get(owner);
    if (budget === undefined) {
      budget = new Map();
      domain.cohorts.set(owner, budget);
    }
    return budget;
  }

  #counter(budget: Map<string, Counter>, dimension: string): Counter {
    let value = budget.get(dimension);
    if (value === undefined) {
      value = counter();
      budget.set(dimension, value);
    }
    return value;
  }

  #peak(usage: Usage): void {
    const observed = total(usage);
    if (observed > usage.peak) usage.peak = observed;
  }

  #observe(value: Counter, domain: string, owner: Identity, dimension: string, absolute: bigint): void {
    for (const ticket of this.#tickets) {
      const height = absolute - (ticket.baseline.get(value) ?? 0n);
      const previous = ticket.heights.get(value);
      if (previous === undefined || height > previous.height) {
        ticket.heights.set(value, Object.freeze({ domain, owner, dimension, height }));
      }
    }
  }
}

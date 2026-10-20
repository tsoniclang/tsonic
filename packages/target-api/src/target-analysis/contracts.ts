export interface TargetContractRevision<Contract> {
  readonly contract: Contract;
  readonly dependencies: readonly string[];
}

export type TargetContractEvaluation<Contract, Failure = never> =
  | {
      readonly kind: "resolved";
      readonly revision: TargetContractRevision<Contract>;
    }
  | {
      readonly kind: "deferred";
      readonly dependencies: readonly string[];
      readonly reason: string;
    }
  | {
      readonly kind: "rejected";
      readonly reason: string;
      readonly cause?: Failure;
    };

export interface TargetContractEvaluationContext<Contract> {
  get(id: string): Contract | undefined;
  revision(id: string): number | undefined;
}

export interface TargetContractFixedPointRequest<Contract, Failure = never> {
  readonly roots: readonly string[];
  readonly evaluate: (
    id: string,
    context: TargetContractEvaluationContext<Contract>,
  ) => TargetContractEvaluation<Contract, Failure>;
  readonly equals?: (left: Contract, right: Contract) => boolean;
  readonly maximumContracts?: number;
  readonly maximumRevisionsPerContract?: number;
  readonly maximumEvaluations?: number;
}

export interface TargetContractProgram<Contract> {
  readonly ids: readonly string[];
  get(id: string): Contract | undefined;
  revision(id: string): number | undefined;
  dependencies(id: string): readonly string[];
  dependents(id: string): readonly string[];
}

export interface TargetContractFailure<Failure = never> {
  readonly contractId?: string;
  readonly reason: string;
  readonly cause?: Failure;
}

export type TargetContractFixedPointResult<Contract, Failure = never> =
  | {
      readonly kind: "resolved";
      readonly program: TargetContractProgram<Contract>;
    }
  | {
      readonly kind: "rejected";
      readonly failures: readonly TargetContractFailure<Failure>[];
    };

interface ContractRevisionState<Contract> {
  contract: Contract;
  dependencies: readonly string[];
}

interface MutableContractState<Contract> extends ContractRevisionState<Contract> {
  revision: number;
  history: ContractRevisionState<Contract>[];
}

const defaultMaximumContracts = 131_072;
const defaultMaximumRevisionsPerContract = 256;
const defaultMaximumEvaluations = 4_194_304;

export function resolveTargetContractFixedPoint<Contract, Failure = never>(
  request: TargetContractFixedPointRequest<Contract, Failure>,
): TargetContractFixedPointResult<Contract, Failure> {
  const equals = request.equals ?? Object.is;
  const maximumContracts = checkedPositiveLimit(
    request.maximumContracts,
    defaultMaximumContracts,
    "maximumContracts",
  );
  const maximumRevisionsPerContract = checkedPositiveLimit(
    request.maximumRevisionsPerContract,
    defaultMaximumRevisionsPerContract,
    "maximumRevisionsPerContract",
  );
  const maximumEvaluations = checkedPositiveLimit(
    request.maximumEvaluations,
    defaultMaximumEvaluations,
    "maximumEvaluations",
  );
  const roots = normalizeContractIds(request.roots);
  if (roots.kind === "rejected") {
    return rejectedContracts([{ reason: roots.reason }]);
  }

  const states = new Map<string, MutableContractState<Contract>>();
  const dependenciesById = new Map<string, readonly string[]>();
  const reverse = new Map<string, Set<string>>();
  const observedById = new Map<string, readonly string[]>();
  const observedReverse = new Map<string, Set<string>>();
  const failures = new Map<string, TargetContractFailure<Failure>>();
  const blocked = new Set<string>();
  const deferred = new Map<string, string>();
  const queue: string[] = [];
  let queueHead = 0;
  const queued = new Set<string>();
  const discovered = new Set<string>();
  let evaluations = 0;
  let currentReads: Set<string> | undefined;

  const discard = (id: string): void => {
    states.delete(id);
    deferred.delete(id);
    replaceReverseDependencies(id, dependenciesById.get(id) ?? [], [], reverse);
    dependenciesById.delete(id);
  };
  const invalidateDependents = (owner: string, preserveTerminalFailures: boolean): void => {
    const pending = [owner];
    const invalidated = new Set(pending);
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const id = pending[cursor]!;
      const dependents = new Set([...reverse.get(id) ?? [], ...observedReverse.get(id) ?? []]);
      for (const dependent of dependents) {
        if (invalidated.has(dependent) || blocked.has(dependent) || preserveTerminalFailures && failures.has(dependent)) continue;
        invalidated.add(dependent);
        blocked.add(dependent);
        failures.delete(dependent);
        discard(dependent);
        pending.push(dependent);
      }
    }
  };
  const reject = (id: string, failure: TargetContractFailure<Failure>): void => {
    discard(id);
    failures.set(id, Object.freeze(failure));
    invalidateDependents(id, false);
  };
  const block = (id: string): void => {
    blocked.add(id);
    failures.delete(id);
    discard(id);
    invalidateDependents(id, true);
  };
  const fatal = (failure: TargetContractFailure<Failure>): TargetContractFixedPointResult<Contract, Failure> =>
    rejectedContracts([...failures.values(), failure]);

  const enqueue = (
    id: string,
  ): TargetContractFailure<Failure> | undefined => {
    if (failures.has(id) || blocked.has(id)) return undefined;
    if (
      discovered.size >= maximumContracts &&
      !discovered.has(id)
    ) {
      return {
        contractId: id,
        reason:
          `Target contract closure exceeds the ${maximumContracts}-contract limit.`,
      };
    }
    if (!queued.has(id)) {
      discovered.add(id);
      queued.add(id);
      queue.push(id);
    }
    return undefined;
  };

  for (const root of roots.ids) {
    const rejection = enqueue(root);
    if (rejection !== undefined) {
      return fatal(rejection);
    }
  }

  const context: TargetContractEvaluationContext<Contract> = Object.freeze({
    get(id: string) {
      currentReads?.add(id);
      return states.get(id)?.contract;
    },
    revision(id: string) {
      currentReads?.add(id);
      return states.get(id)?.revision;
    },
  });

  while (queueHead < queue.length) {
    const id = queue[queueHead++]!;
    queued.delete(id);
    if (failures.has(id) || blocked.has(id)) continue;
    evaluations += 1;
    if (evaluations > maximumEvaluations) {
      return fatal({
        contractId: id,
        reason:
          `Target contract closure exceeds the ${maximumEvaluations}-evaluation limit.`,
      });
    }

    const reads = new Set<string>();
    let evaluation: TargetContractEvaluation<Contract, Failure>;
    currentReads = reads;
    try { evaluation = request.evaluate(id, context); }
    finally { currentReads = undefined; }
    const observed = normalizeContractIds([...reads]);
    if (observed.kind === "rejected") return fatal({ contractId: id, reason: observed.reason });
    replaceReverseDependencies(id, observedById.get(id) ?? [], observed.ids, observedReverse);
    observedById.set(id, observed.ids);
    const failedDependency = (dependency: string): boolean => dependency !== id &&
      (failures.has(dependency) || blocked.has(dependency));
    if (evaluation.kind === "rejected") {
      if (observed.ids.some(failedDependency)) {
        block(id);
        continue;
      }
      reject(id, {
        contractId: id,
        reason: evaluation.reason,
        ...(evaluation.cause === undefined ? {} : { cause: evaluation.cause }),
      });
      continue;
    }
    const normalizedDependencies = normalizeContractIds(
      evaluation.kind === "resolved"
        ? evaluation.revision.dependencies
        : evaluation.dependencies,
    );
    if (normalizedDependencies.kind === "rejected") {
      return fatal({ contractId: id, reason: normalizedDependencies.reason });
    }
    replaceReverseDependencies(
      id,
      dependenciesById.get(id) ?? [],
      normalizedDependencies.ids,
      reverse,
    );
    dependenciesById.set(id, normalizedDependencies.ids);
    if (observed.ids.some(failedDependency) || normalizedDependencies.ids.some(failedDependency)) {
      block(id);
      continue;
    }
    for (const dependency of normalizedDependencies.ids) {
      if (!states.has(dependency) && !deferred.has(dependency)) {
        const rejection = enqueue(dependency);
        if (rejection !== undefined) {
          return fatal(rejection);
        }
      }
    }

    if (evaluation.kind === "deferred") {
      deferred.set(id, evaluation.reason);
      continue;
    }
    deferred.delete(id);
    const previous = states.get(id);
    if (
      previous !== undefined &&
      equals(previous.contract, evaluation.revision.contract) &&
      stringArraysEqual(previous.dependencies, normalizedDependencies.ids)
    ) {
      continue;
    }
    if (
      previous?.history.some((candidate) =>
        equals(candidate.contract, evaluation.revision.contract) &&
        stringArraysEqual(candidate.dependencies, normalizedDependencies.ids)
      ) === true
    ) {
      reject(id, {
        contractId: id,
        reason: "Target contract analysis oscillated between previous revisions.",
      });
      continue;
    }
    const revision = (previous?.revision ?? 0) + 1;
    if (revision > maximumRevisionsPerContract) {
      reject(id, {
        contractId: id,
        reason:
          `Target contract '${id}' exceeds the ${maximumRevisionsPerContract}-revision limit.`,
      });
      continue;
    }
    states.set(id, {
      contract: evaluation.revision.contract,
      dependencies: normalizedDependencies.ids,
      revision,
      history: previous === undefined
        ? []
        : [...previous.history, Object.freeze({
            contract: previous.contract,
            dependencies: previous.dependencies,
          })],
    });
    for (const dependent of reverse.get(id) ?? []) {
      const rejection = enqueue(dependent);
      if (rejection !== undefined) {
        return fatal(rejection);
      }
    }
    if (queueHead >= 131_072 && queueHead * 2 >= queue.length) {
      queue.splice(0, queueHead);
      queueHead = 0;
    }
  }

  if (deferred.size > 0) {
    for (const [contractId, reason] of [...deferred.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      if (blocked.has(contractId) || failures.has(contractId)) continue;
      reject(contractId, { contractId, reason: `Target contract closure remained deferred. ${reason}` });
    }
  }
  if (failures.size > 0) return rejectedContracts([...failures.values()]);

  const ids = Object.freeze([...states.keys()].sort());
  const frozenStates = new Map([...states].map(([id, state]) => [
    id,
    Object.freeze({
      contract: state.contract,
      dependencies: Object.freeze([...state.dependencies]),
      revision: state.revision,
    }),
  ]));
  const frozenReverse = new Map([...reverse].map(([id, dependents]) => [
    id,
    Object.freeze([...dependents].sort()),
  ]));
  const program: TargetContractProgram<Contract> = Object.freeze({
    ids,
    get(id: string) {
      return frozenStates.get(id)?.contract;
    },
    revision(id: string) {
      return frozenStates.get(id)?.revision;
    },
    dependencies(id: string) {
      return frozenStates.get(id)?.dependencies ?? [];
    },
    dependents(id: string) {
      return frozenReverse.get(id) ?? [];
    },
  });
  return Object.freeze({ kind: "resolved", program });
}

function rejectedContracts<Failure>(
  failures: readonly TargetContractFailure<Failure>[],
): { readonly kind: "rejected"; readonly failures: readonly TargetContractFailure<Failure>[] } {
  return Object.freeze({ kind: "rejected", failures: Object.freeze([...failures]
    .sort((left, right) => (left.contractId ?? "").localeCompare(right.contractId ?? ""))
    .map(failure => Object.freeze({ ...failure }))) });
}

function checkedPositiveLimit(
  candidate: number | undefined,
  fallback: number,
  name: string,
): number {
  const value = candidate ?? fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return value;
}

function normalizeContractIds(
  ids: readonly string[],
):
  | { readonly kind: "resolved"; readonly ids: readonly string[] }
  | { readonly kind: "rejected"; readonly reason: string } {
  const unique = new Set<string>();
  for (const id of ids) {
    if (id.length === 0) {
      return {
        kind: "rejected",
        reason: "Target contract identities must be non-empty strings.",
      };
    }
    unique.add(id);
  }
  return {
    kind: "resolved",
    ids: Object.freeze([...unique].sort()),
  };
}

function replaceReverseDependencies(
  owner: string,
  previous: readonly string[],
  candidate: readonly string[],
  reverse: Map<string, Set<string>>,
): void {
  for (const dependency of previous) {
    if (candidate.includes(dependency)) {
      continue;
    }
    const dependents = reverse.get(dependency);
    dependents?.delete(owner);
    if (dependents?.size === 0) {
      reverse.delete(dependency);
    }
  }
  for (const dependency of candidate) {
    let dependents = reverse.get(dependency);
    if (dependents === undefined) {
      dependents = new Set();
      reverse.set(dependency, dependents);
    }
    dependents.add(owner);
  }
}

function stringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

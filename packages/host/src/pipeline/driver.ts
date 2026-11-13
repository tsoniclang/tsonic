import type { Cause, Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { Query, QueryComputation, QueryContext } from "../query/contract.js";
import type { Step } from "../step/contract.js";

export type Pause<Value, Request, State> = Step<Result<Value>, Request, State, Diagnostic>;

export interface Producer<Inputs, Key, Value, Request, Answer, State> {
  readonly start: (inputs: Inputs, key: Key) => Pause<Value, Request, State>;
  readonly resume: (state: State, answers: readonly Answer[]) => Pause<Value, Request, State>;
}

export interface Application<Inputs, Value, Request, Inner, State, Answer, Witness> {
  readonly start: (inputs: Inputs) => Pause<Value, Request, State>;
  readonly resume: (state: State, answers: readonly Inner[]) => Pause<Value, Request, State>;
  readonly route: (request: Request) => Route<Inputs, Inner, Witness>;
  readonly witness: (request: Request) => Witness;
  readonly answer: (value: Value) => Answer;
}

export type ReadRoute<Inputs, Answer, Witness> = <Out>(
  reader: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness>, key: Key, answer: (value: Value) => Answer) => Out,
) => Out;

export type ApplyRoute<Inputs, Answer, Witness> = <Out>(
  reader: <Value, Request, Inner, State>(application: Application<Inputs, Value, Request, Inner, State, Answer, Witness>) => Out,
) => Out;

export type Route<Inputs, Answer, Witness> =
  | { readonly way: "fact"; readonly read: ReadRoute<Inputs, Answer, Witness> }
  | { readonly way: "projection"; readonly read: ReadRoute<Inputs, Answer, Witness> }
  | { readonly way: "nested"; readonly apply: ApplyRoute<Inputs, Answer, Witness> };

export interface Row<Inputs, Key extends KeyData, Value, Request, Answer, State, Witness> {
  readonly name: string;
  readonly producer: Producer<Inputs, Key, Value, Request, Answer, State>;
  readonly route: (request: Request) => Route<Inputs, Answer, Witness>;
  readonly witness: (request: Request) => Witness;
  readonly errorValue: (key: Key, cause: Cause) => Value;
}

export function factRoute<Inputs, Key extends KeyData, Value, Answer, Witness>(
  query: Query<Inputs, Key, Value, Witness>, key: Key, answer: (value: Value) => Answer,
): Route<Inputs, Answer, Witness> {
  return ({ way: "fact", read: reader => reader(query, key, answer) });
}

export function projectionRoute<Inputs, Key extends KeyData, Value, Answer, Witness>(
  query: Query<Inputs, Key, Value, Witness>, key: Key, project: (value: Value) => Answer,
): Route<Inputs, Answer, Witness> {
  return ({ way: "projection", read: reader => reader(query, key, project) });
}

/**
 * The application is run again for every request that is routed to it: it has no memo entry. A requester that
 * needs one application's answer more than once asks once and holds the answer in its own unfinished state.
 * What the application earns is earned by its requester's computation: each chunk it states and its final
 * diagnostics are stated to the kernel with the requester's next request, abandonment or result. That each is
 * reported once in a run holds only through uniqueness by diagnostic identity where the run's diagnostics are collected.
 */
export function nestedRoute<Inputs, Value, Request, Inner, State, Answer, Witness>(
  application: Application<Inputs, Value, Request, Inner, State, Answer, Witness>,
): Route<Inputs, Answer, Witness> {
  return ({ way: "nested", apply: reader => reader(application) });
}

type Progress<Inputs, Now, Value, Witness> =
  | { readonly kind: "now"; readonly value: Now }
  | { readonly kind: "later"; readonly computation: QueryComputation<Inputs, Value, Witness> };

interface Operations<Inputs, Request, Answer, State, Produced, Witness> {
  readonly resume: (state: State, answers: readonly Answer[]) => Pause<Produced, Request, State>;
  readonly route: (request: Request) => Route<Inputs, Answer, Witness>;
  readonly witness: (request: Request) => Witness;
}

function mapResult<From, To>(result: Result<From>, map: (value: From) => To): Result<To> {
  return result.kind === "ok" ? { kind: "ok", value: map(result.value), diagnostics: result.diagnostics } : result;
}

const refusalFailure: InvariantFailure = ({ owner: "pipeline", query: null, origin: null,
  message: "A refused result must carry its refusing diagnostic." });
const statedTwice = "A producer restated a diagnostic it had already stated: a pause states only what was earned since the previous pause, and a result only what was earned after the last.";

/** One run of one producer: the row's own producer, or one application of a nested route, from its start to its done. */
interface ProducerRun {
  seen: Set<Diagnostic> | undefined;
}

/**
 * One computation of a row. Producers and nested applications state what they earn in chunks (Step); this adapter
 * hands each chunk on to the kernel once, with the computation's next request, its abandonment or its result, and
 * keeps nothing that it has handed on. It adds, drops and repeats no diagnostic.
 *
 * Checked here, per producer run (the row's producer, or one application of a nested route, from start to done):
 * the run does not state a diagnostic object it has already stated. Not checked here: the same diagnostic stated
 * by two different applications or by an application and its requester, and two objects with one identity; both
 * are left to uniqueness by diagnostic identity where a run's diagnostics are collected.
 */
export function defineQuery<Inputs, Key extends KeyData, Value, Request, Answer, State, Witness>(
  row: Row<Inputs, Key, Value, Request, Answer, State, Witness>,
): Query<Inputs, Key, Value, Witness> {
  type Computation = QueryComputation<Inputs, Value, Witness>;
  const compute = (context: QueryContext<Inputs, Witness>, key: Key): Computation => {
    let pending: Diagnostic[] = [];

    function note(run: ProducerRun, source: readonly Diagnostic[]): void {
      if (source.length === 0) return;
      const known = run.seen ?? new Set<Diagnostic>();
      run.seen = known;
      source.forEach(diagnostic => {
        if (known.has(diagnostic)) throwInvariant({ owner: "pipeline", query: { name: row.name, encodedKey: encodeKey(key) }, origin: null, message: statedTwice });
        known.add(diagnostic);
      });
    }

    function earn(source: readonly Diagnostic[]): void {
      source.forEach(diagnostic => { pending.push(diagnostic); });
    }

    function hand(): readonly Diagnostic[] {
      const stated = pending;
      if (stated.length !== 0) pending = [];
      return stated;
    }

    function settle<Now>(progress: Progress<Inputs, Now, Value, Witness>, then: (value: Now) => Computation): Computation {
      return progress.kind === "now" ? then(progress.value) : progress.computation;
    }

    function answerFrom<Request, Answer, State, Produced>(
      requests: Iterator<Request>, operations: Operations<Inputs, Request, Answer, State, Produced, Witness>,
      answers: Answer[], then: (answers: readonly Answer[]) => Computation,
    ): Progress<Inputs, readonly Answer[], Value, Witness> {
      const proceed = (): Computation => settle(answerFrom(requests, operations, answers, then), then);
      for (let next = requests.next(); next.done !== true; next = requests.next()) {
        const request = next.value;
        const selected = operations.route(request);
        if (selected.way !== "nested") {
          return ({ kind: "later", computation: selected.read((query, dependencyKey, answer) =>
            context.get(query, dependencyKey, { witness: operations.witness(request), earned: hand() }, value => {
              answers.push(answer(value));
              return proceed();
            })) });
        }
        const refused = (diagnostics: readonly [Diagnostic, ...Diagnostic[]]): Computation =>
          ({ kind: "abandoned", diagnostics, earned: hand() });
        const nested = selected.apply((application): Progress<Inputs, Result<Answer>, Value, Witness> => {
          const progress = runSteps(application.start(context.inputs), application, result => {
            const outcome = mapResult(result, application.answer);
            if (outcome.kind === "refused") return refused(outcome.diagnostics);
            earn(outcome.diagnostics);
            answers.push(outcome.value);
            return proceed();
          }, { seen: undefined });
          return progress.kind === "now" ? { kind: "now", value: mapResult(progress.value, application.answer) } : progress;
        });
        if (nested.kind === "later") return nested;
        if (nested.value.kind === "refused") return ({ kind: "later", computation: refused(nested.value.diagnostics) });
        earn(nested.value.diagnostics);
        answers.push(nested.value.value);
      }
      return ({ kind: "now", value: answers });
    }

    function runSteps<Request, Answer, State, Produced>(
      initial: Pause<Produced, Request, State>, operations: Operations<Inputs, Request, Answer, State, Produced, Witness>,
      then: (result: Result<Produced>) => Computation, run: ProducerRun,
    ): Progress<Inputs, Result<Produced>, Value, Witness> {
      for (let step = initial; ;) {
        if (step.kind === "done") {
          note(run, step.value.diagnostics);
          return ({ kind: "now", value: step.value });
        }
        const state = step.paused;
        note(run, step.earned);
        earn(step.earned);
        const resumed = (answers: readonly Answer[]): Computation =>
          settle(runSteps(operations.resume(state, answers), operations, then, run), then);
        const progress = answerFrom(step.requests[Symbol.iterator](), operations, [], resumed);
        if (progress.kind === "later") return progress;
        step = operations.resume(state, progress.value);
      }
    }

    const finish = (result: Result<Value>): Computation => {
      earn(result.diagnostics);
      const last = hand();
      if (result.kind === "ok") return ({ kind: "ok", value: result.value, diagnostics: last });
      return ({ kind: "refused", diagnostics: [requirePresent(last[0], refusalFailure), ...last.slice(1)] });
    };
    const operations = { resume: row.producer.resume, route: row.route, witness: row.witness };
    return settle(runSteps(row.producer.start(context.inputs, key), operations, finish, { seen: undefined }), finish);
  };
  return ({ name: row.name, compute, errorValue: row.errorValue });
}

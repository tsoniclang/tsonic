import type { Diagnostic, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import type { Query, QueryComputation, QueryContext } from "../query/contract.js";
import type { Step } from "../step/contract.js";

export type Pause<Value, Request, State> = Step<Result<Value>, Request, State, Diagnostic>;

export interface Producer<Inputs, Key, Value, Request, Answer, State> {
  readonly start: (inputs: Inputs, key: Key) => Pause<Value, Request, State>;
  readonly resume: (state: State, answers: readonly Answer[]) => Pause<Value, Request, State>;
}

export interface Application<Inputs, Value, Request, Inner, State, Answer, Witness, Verdict> {
  readonly start: (inputs: Inputs) => Pause<Value, Request, State>;
  readonly resume: (state: State, answers: readonly Inner[]) => Pause<Value, Request, State>;
  readonly route: (request: Request) => Route<Inputs, Inner, Witness, Verdict>;
  readonly witness: (request: Request) => Witness;
  readonly answer: (value: Value) => Answer;
}

export type ReadRoute<Inputs, Answer, Witness, Verdict> = <Out>(
  reader: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key, answer: (value: Value) => Answer) => Out,
) => Out;

export type ApplyRoute<Inputs, Answer, Witness, Verdict> = <Out>(
  reader: <Value, Request, Inner, State>(application: Application<Inputs, Value, Request, Inner, State, Answer, Witness, Verdict>) => Out,
) => Out;

export type Route<Inputs, Answer, Witness, Verdict> =
  | { readonly way: "fact"; readonly read: ReadRoute<Inputs, Answer, Witness, Verdict> }
  | { readonly way: "projection"; readonly read: ReadRoute<Inputs, Answer, Witness, Verdict> }
  | { readonly way: "nested"; readonly apply: ApplyRoute<Inputs, Answer, Witness, Verdict> };

export interface Row<Inputs, Key extends KeyData, Value, Request, Answer, State, Witness, Verdict> {
  readonly name: string;
  readonly producer: Producer<Inputs, Key, Value, Request, Answer, State>;
  readonly route: (request: Request) => Route<Inputs, Answer, Witness, Verdict>;
  readonly witness: (request: Request) => Witness;
  readonly cycleOutcome: (key: Key, verdict: Verdict) => Result<Value>;
}

export function factRoute<Inputs, Key extends KeyData, Value, Answer, Witness, Verdict>(
  query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key, answer: (value: Value) => Answer,
): Route<Inputs, Answer, Witness, Verdict> {
  return ({ way: "fact", read: reader => reader(query, key, answer) });
}

export function projectionRoute<Inputs, Key extends KeyData, Value, Answer, Witness, Verdict>(
  query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key, project: (value: Value) => Answer,
): Route<Inputs, Answer, Witness, Verdict> {
  return ({ way: "projection", read: reader => reader(query, key, project) });
}

export function nestedRoute<Inputs, Value, Request, Inner, State, Answer, Witness, Verdict>(
  application: Application<Inputs, Value, Request, Inner, State, Answer, Witness, Verdict>,
): Route<Inputs, Answer, Witness, Verdict> {
  return ({ way: "nested", apply: reader => reader(application) });
}

type Progress<Inputs, Now, Value, Witness, Verdict> =
  | { readonly kind: "now"; readonly value: Now }
  | { readonly kind: "later"; readonly computation: QueryComputation<Inputs, Value, Witness, Verdict> };

interface Operations<Inputs, Request, Answer, State, Produced, Witness, Verdict> {
  readonly resume: (state: State, answers: readonly Answer[]) => Pause<Produced, Request, State>;
  readonly route: (request: Request) => Route<Inputs, Answer, Witness, Verdict>;
  readonly witness: (request: Request) => Witness;
}

function append(target: Diagnostic[], source: readonly Diagnostic[]): void {
  source.forEach(diagnostic => { target.push(diagnostic); });
}

function mapResult<From, To>(result: Result<From>, map: (value: From) => To): Result<To> {
  return result.kind === "ok" ? { kind: "ok", value: map(result.value), diagnostics: result.diagnostics } : result;
}

function requireStated<Produced>(stated: readonly Diagnostic[], result: Result<Produced>): void {
  if (stated.length === 0) return;
  const present = new Set(result.diagnostics);
  stated.forEach(diagnostic => {
    if (!present.has(diagnostic)) {
      throwInvariant({ owner: "pipeline", query: null, origin: null,
        message: "A producer's result omits a diagnostic it stated as earned at its last pause." });
    }
  });
}

function joined(first: readonly Diagnostic[], second: readonly Diagnostic[]): Diagnostic[] {
  const all: Diagnostic[] = [];
  append(all, first);
  append(all, second);
  return all;
}

export function defineQuery<Inputs, Key extends KeyData, Value, Request, Answer, State, Witness, Verdict>(
  row: Row<Inputs, Key, Value, Request, Answer, State, Witness, Verdict>,
): Query<Inputs, Key, Value, Witness, Verdict> {
  type Computation = QueryComputation<Inputs, Value, Witness, Verdict>;
  const compute = (context: QueryContext<Inputs, Witness, Verdict>, key: Key): Computation => {
    const carried: Diagnostic[] = [];

    function settle<Now>(progress: Progress<Inputs, Now, Value, Witness, Verdict>, then: (value: Now) => Computation): Computation {
      return progress.kind === "now" ? then(progress.value) : progress.computation;
    }

    function answerFrom<Request, Answer, State, Produced>(
      requests: Iterator<Request>, earned: readonly Diagnostic[],
      operations: Operations<Inputs, Request, Answer, State, Produced, Witness, Verdict>,
      answers: Answer[], then: (answers: readonly Answer[]) => Computation,
    ): Progress<Inputs, readonly Answer[], Value, Witness, Verdict> {
      const proceed = (): Computation => settle(answerFrom(requests, earned, operations, answers, then), then);
      let stated = earned;
      let counted = 0;
      const current = (): readonly Diagnostic[] => {
        if (counted !== carried.length) {
          stated = joined(earned, carried);
          counted = carried.length;
        }
        return stated;
      };
      for (let next = requests.next(); next.done !== true; next = requests.next()) {
        const request = next.value;
        const selected = operations.route(request);
        if (selected.way !== "nested") {
          return ({ kind: "later", computation: selected.read((query, dependencyKey, answer) =>
            context.get(query, dependencyKey, { witness: operations.witness(request), earned: current() }, value => {
              answers.push(answer(value));
              return proceed();
            })) });
        }
        const refused = (diagnostics: readonly [Diagnostic, ...Diagnostic[]]): Computation =>
          ({ kind: "abandoned", diagnostics, earned: current() });
        const nested = selected.apply((application): Progress<Inputs, Result<Answer>, Value, Witness, Verdict> => {
          const progress = runSteps(application.start(context.inputs), application, earned, result => {
            const outcome = mapResult(result, application.answer);
            if (outcome.kind === "refused") return refused(outcome.diagnostics);
            append(carried, outcome.diagnostics);
            answers.push(outcome.value);
            return proceed();
          }, []);
          return progress.kind === "now" ? { kind: "now", value: mapResult(progress.value, application.answer) } : progress;
        });
        if (nested.kind === "later") return nested;
        if (nested.value.kind === "refused") return ({ kind: "later", computation: refused(nested.value.diagnostics) });
        append(carried, nested.value.diagnostics);
        answers.push(nested.value.value);
      }
      return ({ kind: "now", value: answers });
    }

    function runSteps<Request, Answer, State, Produced>(
      initial: Pause<Produced, Request, State>, operations: Operations<Inputs, Request, Answer, State, Produced, Witness, Verdict>,
      enclosing: readonly Diagnostic[], then: (result: Result<Produced>) => Computation, last: readonly Diagnostic[],
    ): Progress<Inputs, Result<Produced>, Value, Witness, Verdict> {
      let stated = last;
      for (let step = initial; ;) {
        if (step.kind === "done") {
          requireStated(stated, step.value);
          return ({ kind: "now", value: step.value });
        }
        const state = step.paused;
        const pausedWith = step.earned;
        stated = pausedWith;
        const resumed = (answers: readonly Answer[]): Computation =>
          settle(runSteps(operations.resume(state, answers), operations, enclosing, then, pausedWith), then);
        const earned = enclosing.length === 0 ? step.earned : joined(enclosing, step.earned);
        const progress = answerFrom(step.requests[Symbol.iterator](), earned, operations, [], resumed);
        if (progress.kind === "later") return progress;
        step = operations.resume(state, progress.value);
      }
    }

    const finish = (result: Result<Value>): Computation => {
      if (carried.length === 0) return result;
      if (result.kind === "ok") return ({ kind: "ok", value: result.value, diagnostics: joined(result.diagnostics, carried) });
      const diagnostics: [Diagnostic, ...Diagnostic[]] = [result.diagnostics[0]];
      append(diagnostics, result.diagnostics.slice(1));
      append(diagnostics, carried);
      return ({ kind: "refused", diagnostics });
    };
    const operations = { resume: row.producer.resume, route: row.route, witness: row.witness };
    return settle(runSteps(row.producer.start(context.inputs, key), operations, [], finish, []), finish);
  };
  return ({ name: row.name, compute, cycleOutcome: row.cycleOutcome });
}

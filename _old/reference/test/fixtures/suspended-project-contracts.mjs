export const suspendedProjectContractsSource = `
import type { int32 } from "@tsonic/core/types.js";
interface Writer { save(path: string): Promise<string>; }
class AsyncWriter implements Writer {
  readonly prefix: string;
  constructor(prefix: string) { this.prefix = prefix; }
  async save(path: string): Promise<string> {
    await Promise.resolve(1);
    return this.prefix + ":" + path;
  }
}
interface InheritedWriter extends Writer {}
class DerivedWriter extends AsyncWriter implements InheritedWriter {}
interface Completion { finish(value: int32): Promise<void>; }
abstract class BaseCompletion implements Completion {
  abstract finish(value: int32): Promise<void>;
}
class EmptyCompletion extends BaseCompletion {
  async finish(value: int32): Promise<void> {
    await Promise.resolve(1);
    if (value !== 7) throw new Error("completion input");
  }
}
interface Failure { fail(): Promise<void>; }
class ImmediateFailure implements Failure {
  readonly failure: Error;
  constructor(failure: Error) { this.failure = failure; }
  fail(): Promise<void> { throw this.failure; }
}
class DeferredFailure implements Failure {
  readonly failure: Error;
  constructor(failure: Error) { this.failure = failure; }
  async fail(): Promise<void> {
    await Promise.resolve(1);
    throw this.failure;
  }
}
async function retainedFailure(value: Failure, expected: Error): Promise<boolean> {
  try { await value.fail(); }
  catch (error) { return error === expected; }
  return false;
}
export async function run(): Promise<boolean> {
  const writer: Writer = new AsyncWriter("native");
  if (await writer.save("payload") !== "native:payload") return false;
  const inherited: InheritedWriter = new DerivedWriter("inherited");
  if (await inherited.save("payload") !== "inherited:payload") return false;
  const completion: Completion = new EmptyCompletion();
  await completion.finish(7);
  const original = new Error("native dispatch identity");
  const immediate: Failure = new ImmediateFailure(original);
  const deferred: Failure = new DeferredFailure(original);
  return await retainedFailure(immediate, original) && await retainedFailure(deferred, original);
}
`;

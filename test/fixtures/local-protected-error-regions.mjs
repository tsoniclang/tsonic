export const localProtectedErrorRegionSource = `
import type { int32 } from "@tsonic/core/types.js";

export function fail(error: Error): never { throw error; }

export function caught(error: Error): boolean {
  try { fail(error); }
  catch (failure) { return failure === error; }
}

export function pureCatch(): boolean {
  try { return true; }
  catch { return false; }
}

export function finallyOnly(error: Error): boolean {
  let finalized = false;
  try {
    try { fail(error); }
    finally { finalized = true; }
  } catch (failure) { return finalized && failure === error; }
}

export function nested(error: Error): boolean {
  let order: int32 = 0;
  try {
    try { fail(error); }
    catch (failure) {
      if (failure !== error) return false;
      order = 1;
      throw failure;
    } finally { order = order * 10 + 2; }
  } catch (failure) { return failure === error && order === 12; }
}

export function fallibleOuter(error: Error, escape: boolean): boolean {
  try { fail(error); }
  catch (failure) { if (failure !== error) return false; }
  if (escape) fail(error);
  return true;
}

export function nestedCallable(error: Error): boolean {
  try {
    function deferred(): never { throw error; }
    deferred();
  } catch (failure) { return failure === error; }
}

export function run(): boolean {
  const error = new Error("protected identity");
  return pureCatch() && caught(error) && finallyOnly(error) && nested(error) &&
    fallibleOuter(error, false) && nestedCallable(error);
}
`;

export const localProtectedAsyncSource = `
import type { int32 } from "@tsonic/core/types.js";
async function failed(error: Error): Promise<void> { throw error; }

export async function run(): Promise<boolean> {
  const error = new Error("protected async identity");
  let finalized: int32 = 0;
  try {
    try { await failed(error); }
    finally { finalized += 1; }
  } catch (failure) { return finalized === 1 && failure === error; }
  return false;
}
`;

export const localProtectedModuleSource = `
const original = new Error("protected initializer identity");
let caught = false;
function fail(): never { throw original; }
try { fail(); }
catch (failure) { caught = failure === original; }
export function run(): boolean { return caught; }
`;

export const localProtectedIntrinsicSource = `
export function sum(values: number[]): number {
  return values.reduce((left, right) => left + right);
}
export function caughtMixed(values: number[], local: boolean): boolean {
  try {
    if (local) throw new Error("protected local channel");
    sum(values);
  } catch { return true; }
  return false;
}
export function run(): boolean {
  let failures = 0;
  try { sum([]); }
  catch (error) {
    if (!(error instanceof TypeError)) return false;
    failures += 1;
  }
  return failures === 1 && sum([1, 2]) === 3 && caughtMixed([1], true) && caughtMixed([], false);
}
`;

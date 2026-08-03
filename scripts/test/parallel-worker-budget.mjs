export const maximumDefaultParallelWorkers = 8;

export function defaultParallelWorkerCount(availableWorkers) {
  if (!Number.isInteger(availableWorkers) || availableWorkers <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(maximumDefaultParallelWorkers, Math.ceil(availableWorkers * 0.75)));
}

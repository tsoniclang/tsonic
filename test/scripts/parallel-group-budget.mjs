export function parallelGroupWorkerCount(
  globalWorkerCount,
  group,
  groupWorkerLimits = {},
) {
  const global = positiveIntegerOrOne(globalWorkerCount);
  const configured = groupWorkerLimits[group];
  return configured === undefined
    ? global
    : Math.min(global, positiveIntegerOrOne(configured));
}

function positiveIntegerOrOne(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

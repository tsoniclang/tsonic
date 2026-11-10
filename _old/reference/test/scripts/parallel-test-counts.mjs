export function testResultCounts(tests) {
  const counts = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 };
  for (const test of tests) {
    if (test.type === "suite") continue;
    if (!["passed", "failed", "skipped", "todo", "cancelled"].includes(test.status)) {
      throw new Error("Test counts require terminal per-test outcomes.");
    }
    counts.total += 1;
    counts[test.status] += 1;
  }
  return counts;
}

export function aggregateTestCounts(results) {
  const completed = results.filter(result => result.summary?.completed === true && Array.isArray(result.tests));
  return { reportedShards: completed.length, ...testResultCounts(completed.flatMap(result => result.tests)) };
}

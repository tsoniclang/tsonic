export function parseTestCounts(logText) {
  return parseNodeTestCounts(logText) ?? parseDotnetTestCounts(logText);
}

export function aggregateTestCounts(results) {
  return results.reduce((counts, result) => {
    if (result.testCounts === undefined) {
      return counts;
    }
    return {
      reportedShards: counts.reportedShards + 1,
      total: counts.total + result.testCounts.total,
      passed: counts.passed + result.testCounts.passed,
      failed: counts.failed + result.testCounts.failed,
      skipped: counts.skipped + result.testCounts.skipped,
    };
  }, {
    reportedShards: 0,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  });
}

function parseNodeTestCounts(logText) {
  const counts = {};
  for (const key of ["tests", "pass", "fail", "skipped"]) {
    const matches = [
      ...logText.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, "gmu")),
    ];
    if (matches.length > 0) {
      counts[key] = Number(matches.at(-1)[1]);
    }
  }
  if (
    counts.tests === undefined &&
    counts.pass === undefined &&
    counts.fail === undefined
  ) {
    return undefined;
  }
  return {
    total: counts.tests ?? 0,
    passed: counts.pass ?? 0,
    failed: counts.fail ?? 0,
    skipped: counts.skipped ?? 0,
    source: "node",
  };
}

function parseDotnetTestCounts(logText) {
  const match = [
    ...logText.matchAll(
      /Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)/gu,
    ),
  ].at(-1);
  if (match === undefined) {
    return undefined;
  }
  return {
    total: Number(match[4]),
    passed: Number(match[2]),
    failed: Number(match[1]),
    skipped: Number(match[3]),
    source: "dotnet",
  };
}

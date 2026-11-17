import { analyzeKeelTypeScript, keelDigest } from "./keel-source-analysis.mjs";

export function keelFixtureModel(entries) {
  return analyzeKeelTypeScript(new Map(entries));
}

export function keelFixtureReview(model, file, symbol, role, evidence) {
  const declaration = model.functions.find(entry => entry.file === file && entry.symbol === symbol);
  if (declaration === undefined) throw new Error(`Fixture has no function '${file}#${symbol}'.`);
  return {
    file, symbol, role, bodySha256: declaration.bodySha256,
    evidence: evidence ?? [{ kind: "parameter", name: declaration.parameters[0] }],
  };
}

export function keelFixtureReference(file, symbol) {
  return { file, symbol };
}

export function keelFixtureHas(findings, check, fragment) {
  return findings.some(entry => entry.check === check &&
    (fragment === undefined || entry.reason.includes(fragment) || entry.subject.includes(fragment)));
}

export function keelFixtureGuard(overrides = {}) {
  return {
    log: ".temp/test-runs/fixture.log", exitCode: 0, swapMax: 0, calibration: false, scopeDrained: true, scopeResult: "success",
    oomBefore: 0, oomAfter: 0, memoryMiB: 7168, tasksMax: 2048, timeoutSeconds: 3600,
    oomScope: "owned-cgroup",
    measurement: { controlGroup: "/user.slice/fixture.scope", swapBytes: 0, oomBefore: 0, oomAfter: 0, exitCode: 0 },
    admission: { admitted: true, unit: "fixture.scope", requestedMiB: 7168 },
    logMaxBytes: 67108864, budget: { workers: 1, childJobs: 2, cpuBudget: 3, memoryMiB: 7168 },
    ...overrides,
  };
}

export function keelFixtureGeneration() {
  const programs = ["tsonic-csharp", "tsonic-rust"].flatMap(target => ["acceptance", "catalogue"].map(family => ({
    target, family, id: `${family}/example`, sourceDigest: keelDigest(`${target}/${family}`),
    pins: { tsonic: "a".repeat(40), [target]: "b".repeat(40) },
  })));
  const samples = programs.map(program => {
    const guard = side => {
      const receipt = keelFixtureGuard();
      const identity = `${program.target}-${program.family}-${side}`;
      const unit = `${identity}.scope`;
      return { ...receipt, log: `.temp/test-runs/${identity}.log`,
        admission: { ...receipt.admission, unit },
        measurement: { ...receipt.measurement, controlGroup: `/user.slice/${unit}` } };
    };
    return { ...program, first: new Map([["source.txt", Buffer.from("native source")]]),
      second: new Map([["source.txt", Buffer.from("native source")]]),
      firstGuard: guard("first"), secondGuard: guard("second") };
  });
  return { programs, samples };
}

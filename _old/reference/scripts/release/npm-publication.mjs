export function publishStagedWave(input, operations) {
  const { version, packages, registryState, packed } = input;
  const artifacts = new Map(packed.packages.map((entry) => [entry.name, entry]));
  const registry = new Map(registryState.map((entry) => [entry.name, entry]));
  if (artifacts.size !== packages.length || registry.size !== packages.length ||
      packed.packages.length !== packages.length || registryState.length !== packages.length) {
    throw new Error("Certified artifacts and registry state must match the complete release wave.");
  }
  const entries = packages.map(({ name }) => {
    const artifact = artifacts.get(name);
    const state = registry.get(name);
    if (artifact === undefined || state === undefined || artifact.version !== version ||
        typeof artifact.tarballPath !== "string" || artifact.tarballPath.length === 0 ||
        typeof artifact.integrity !== "string" || artifact.integrity.length === 0) {
      throw new Error(`Certified release artifact '${name}@${version}' is missing or invalid.`);
    }
    if (state.publishedVersion === undefined) {
      throw new Error(`Package '${name}' has no existing latest baseline; this publisher cannot bootstrap a first release.`);
    }
    if (state.versionIntegrity !== undefined && state.versionIntegrity !== artifact.integrity) {
      throw new Error(`Published package '${name}@${version}' differs from its certified artifact; prepare a new version.`);
    }
    return Object.freeze({ name, artifact, state });
  });
  for (const entry of entries) operations.verifyLocalArtifact(entry.artifact);
  assertLatestBaselines(entries, operations);

  let published = 0;
  for (const entry of entries) {
    if (entry.state.versionIntegrity === undefined) {
      operations.publish(entry.artifact, `staged-${version}`);
      published += 1;
    }
  }
  for (const entry of entries) {
    operations.verifyIntegrity(entry.name, version, entry.artifact.integrity);
  }
  assertLatestBaselines(entries, operations);
  operations.verifyPublicInstall("exact");
  assertLatestBaselines(entries, operations);

  let promoted = 0;
  for (const entry of entries) {
    if (operations.readLatest(entry.name) !== entry.state.publishedVersion) {
      throw new Error(`Package '${entry.name}' changed latest during release; refusing to overwrite it.`);
    }
    if (entry.state.publishedVersion !== version) {
      operations.promote(entry.name, version);
      promoted += 1;
    }
    operations.verifyLatest(entry.name, version);
  }
  operations.verifyPublicInstall("latest");
  return Object.freeze({ published, promoted });
}

function assertLatestBaselines(entries, operations) {
  for (const entry of entries) {
    if (operations.readLatest(entry.name) !== entry.state.publishedVersion) {
      throw new Error(`Package '${entry.name}' changed latest before promotion; refusing to continue.`);
    }
  }
}

export function classifyReleaseState(version, entries) {
  const patchReasons = entries.filter(({ relation, drift }) =>
    relation === "ahead" || drift);
  if (patchReasons.length !== 0) {
    return Object.freeze({
      kind: "prepare-patch",
      version,
      reasons: Object.freeze([...patchReasons]),
    });
  }

  const pending = entries.filter(({ versionIntegrity }) =>
    versionIntegrity === undefined);
  const awaitingPromotion = entries.filter(({ relation }) =>
    relation !== "equal");
  if (pending.length === 0 && awaitingPromotion.length === 0) {
    return Object.freeze({ kind: "current", version });
  }
  return Object.freeze({
    kind: "publish",
    version,
    pending: Object.freeze([...pending]),
    awaitingPromotion: Object.freeze([...awaitingPromotion]),
  });
}

export function formatReleaseChecklist(action, packageCount) {
  const lines = [
    `# npm release ${action.version}`,
    "",
  ];
  if (action.kind === "current") {
    lines.push(
      "Status: current. No npm publication is required.",
      "",
      "- [x] Every package exact version exists on npm.",
      "- [x] Every `latest` tag selects the exact wave version.",
    );
    return `${lines.join("\n")}\n`;
  }
  if (action.kind === "prepare-patch") {
    lines.push(
      "Status: a new patch wave is required.",
      "",
      "Direct reasons:",
      ...action.reasons.map((entry) =>
        `- ${entry.name}: ${entry.relation === "ahead" ? "npm latest is ahead of the local wave" : "published-version content changed"}`),
      "",
      `All ${String(packageCount)} packages must receive the same next patch version because first-party edges are exact.`,
      "",
      "- [ ] Run `./scripts/publish-npm.sh` from a coherent clean `main` workspace.",
      "- [ ] Merge every generated release PR.",
      "- [ ] Pull every repository to exact `origin/main`.",
      "- [ ] Run `./scripts/publish-npm.sh` again.",
    );
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    "Status: the current wave requires publication or promotion.",
    "",
    `Artifacts not yet published at the exact version: ${String(action.pending.length)}.`,
    `Packages not yet exposed through \`latest\`: ${String(action.awaitingPromotion.length)}.`,
    "",
    "- [ ] Authenticate with interactive 2FA or a short-lived read/write granular token with bypass 2FA.",
    "- [ ] Confirm `npm whoami --registry https://registry.npmjs.org/` (identity only; this does not prove publish authorization).",
    "- [ ] Run `./scripts/publish-npm.sh` from a coherent clean `main` workspace.",
    "- [ ] Require complete source, target, runtime, and packed-install certification.",
    "- [ ] Require exact public-registry C#, Rust, and Node execution after direct publication.",
    "- [ ] Confirm `./scripts/release-status.sh` reports `Status: current`.",
  );
  return `${lines.join("\n")}\n`;
}

export function compareSemver(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
}

export function incrementPatch(value) {
  const [major, minor, patch] = parseSemver(value);
  return `${major}.${minor}.${patch + 1}`;
}

function parseSemver(value) {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(value);
  if (match === null) throw new Error(`Unsupported release version '${value}'.`);
  return match.slice(1).map(Number);
}

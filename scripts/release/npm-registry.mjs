import { spawnSync } from "node:child_process";

export const npmRegistry = "https://registry.npmjs.org/";

const registryConvergenceAttempts = 121;
const registryConvergenceDelayMilliseconds = 5_000;

export function requireNpmAuthentication(runNpm = runNpmCommand) {
  const result = runNpm([
    "whoami",
    "--registry",
    npmRegistry,
  ]);
  const username = result.stdout?.trim();
  if (result.status !== 0 || username === undefined || username.length === 0) {
    const details = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error([
      `npm authentication is required before release certification and publication to ${npmRegistry}.`,
      "Use an interactive 2FA session or a short-lived read/write granular token with bypass 2FA, then rerun ./scripts/publish-npm.sh.",
      ...(details.length === 0 ? [] : [details]),
    ].join("\n"));
  }
  return username;
}

export function npmView(name, field, version, runNpm = runNpmCommand) {
  const selector = version === undefined ? name : `${name}@${version}`;
  const result = runNpm([
    "view",
    selector,
    field,
    "--json",
    "--registry",
    npmRegistry,
  ]);
  if (result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (/E404|not found/iu.test(combined)) return undefined;
    throw new Error(`npm view failed for '${selector}':\n${combined}`);
  }
  const output = result.stdout?.trim() ?? "";
  if (output.length === 0) return undefined;
  const value = JSON.parse(output);
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.at(-1);
  }
  throw new Error(`npm returned no scalar '${field}' value for '${selector}'.`);
}

export function waitForNpmViewPresence(name, field, version, options = {}) {
  const view = options.npmView ?? npmView;
  const pause = options.pause ?? pauseSynchronously;
  const attempts = options.attempts ?? registryConvergenceAttempts;
  const delayMilliseconds = options.delayMilliseconds ??
    registryConvergenceDelayMilliseconds;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = view(name, field, version);
    if (value !== undefined) return value;
    if (attempt < attempts - 1) pause(delayMilliseconds);
  }
  throw new Error(
    `npm did not expose '${field}' for '${name}@${version}' after publication.`,
  );
}

export function waitForNpmViewValue(
  name,
  field,
  expectedValue,
  options = {},
) {
  const view = options.npmView ?? npmView;
  const pause = options.pause ?? pauseSynchronously;
  const attempts = options.attempts ?? registryConvergenceAttempts;
  const delayMilliseconds = options.delayMilliseconds ??
    registryConvergenceDelayMilliseconds;
  let value;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    value = view(name, field);
    if (value === expectedValue) return value;
    if (attempt < attempts - 1) pause(delayMilliseconds);
  }
  throw new Error(
    `npm did not expose '${name}@${expectedValue}' through '${field}'; observed '${value ?? "<missing>"}'.`,
  );
}

function runNpmCommand(args) {
  return spawnSync("npm", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pauseSynchronously(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

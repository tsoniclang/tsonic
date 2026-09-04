import { spawnSync } from "node:child_process";

export const npmRegistry = "https://registry.npmjs.org/";

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
      `Run 'npm login --registry ${npmRegistry}' and rerun ./scripts/publish-npm.sh.`,
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

function runNpmCommand(args) {
  return spawnSync("npm", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TSONICLANG_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
WORK_ROOT="${TSONIC_RELEASE_SMOKE_ROOT:-$ROOT_DIR/.tests/release-package-smoke}"
PACK_DIR="$WORK_ROOT/packs"
CONSUMER_DIR="$WORK_ROOT/consumer"

require_path() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo "FAIL: required path does not exist: $path" >&2
    exit 1
  fi
}

pack_package() {
  local package_dir="$1"
  require_path "$package_dir/package.json"
  local pack_json
  pack_json="$(npm pack "$package_dir" --pack-destination "$PACK_DIR" --json)"
  local filename
  filename="$(
    node -e '
      const fs = require("node:fs");
      const data = JSON.parse(fs.readFileSync(0, "utf8"));
      process.stdout.write(data[0].filename);
    ' <<<"$pack_json"
  )"
  printf '%s/%s' "$PACK_DIR" "$filename"
}

echo "=== Release package smoke ==="
echo "root: $ROOT_DIR"
echo "work: $WORK_ROOT"

node - "$ROOT_DIR" "$TSONICLANG_ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.argv[2];
const tsoniclangRoot = process.argv[3];
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));

const expectedPackages = new Map([
  ["@tsonic/tsbindgen", path.join(tsoniclangRoot, "tsbindgen", "package.json")],
  ["@tsonic/core", path.join(tsoniclangRoot, "core", "versions", "10", "package.json")],
  ["@tsonic/dotnet", path.join(tsoniclangRoot, "dotnet", "versions", "10", "package.json")],
  ["@tsonic/globals", path.join(tsoniclangRoot, "globals", "versions", "10", "package.json")],
  ["@tsonic/js", path.join(tsoniclangRoot, "js", "versions", "10", "package.json")],
  ["@tsonic/nodejs", path.join(tsoniclangRoot, "nodejs", "versions", "10", "package.json")],
]);

const allRootDeps = {
  ...(rootPkg.dependencies ?? {}),
  ...(rootPkg.devDependencies ?? {}),
  ...(rootPkg.optionalDependencies ?? {}),
  ...(rootPkg.peerDependencies ?? {}),
};

const failures = [];
for (const [name, packageJsonPath] of expectedPackages) {
  if (!fs.existsSync(packageJsonPath)) {
    failures.push(`${name}: sibling package is missing at ${packageJsonPath}`);
    continue;
  }

  const sibling = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const rootSpec = allRootDeps[name];
  if (rootSpec !== undefined && rootSpec !== sibling.version) {
    failures.push(`${name}: root package.json uses ${rootSpec}, sibling package is ${sibling.version}`);
  }

  const lockPackage = lock.packages?.[`node_modules/${name}`];
  if (rootSpec !== undefined && lockPackage?.version !== sibling.version) {
    failures.push(`${name}: package-lock entry is ${lockPackage?.version ?? "<missing>"}, sibling package is ${sibling.version}`);
  }

  for (const [dependencyName, dependencyVersion] of Object.entries({
    ...(sibling.dependencies ?? {}),
    ...(sibling.peerDependencies ?? {}),
  })) {
    const dependencyPackageJsonPath = expectedPackages.get(dependencyName);
    if (!dependencyPackageJsonPath || !fs.existsSync(dependencyPackageJsonPath)) continue;
    const dependency = JSON.parse(fs.readFileSync(dependencyPackageJsonPath, "utf8"));
    if (dependencyVersion !== dependency.version) {
      failures.push(`${name}: ${dependencyName} dependency is ${dependencyVersion}, sibling package is ${dependency.version}`);
    }
  }
}

const cliPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "packages", "cli", "package.json"), "utf8"));
const tsbindgen = JSON.parse(fs.readFileSync(path.join(tsoniclangRoot, "tsbindgen", "package.json"), "utf8"));
const cliTsbindgenSpec = cliPkg.dependencies?.["@tsonic/tsbindgen"];
if (cliTsbindgenSpec !== tsbindgen.version) {
  failures.push(`@tsonic/cli: @tsonic/tsbindgen dependency is ${cliTsbindgenSpec ?? "<missing>"}, sibling package is ${tsbindgen.version}`);
}

const lockText = JSON.stringify(lock);
for (const stale of [
  "\"@tsonic/tsbindgen\":\"0.7.51\"",
  "\"@tsonic/core\":\"10.0.40\"",
  "\"@tsonic/dotnet\":\"10.0.40\"",
  "\"@tsonic/js\":\"10.0.48\"",
  "\"@tsonic/nodejs\":\"10.0.48\"",
  "\"@tsonic/globals\":\"10.0.41\"",
]) {
  if (lockText.includes(stale)) {
    failures.push(`package-lock still contains stale dependency ${stale}`);
  }
}

if (failures.length > 0) {
  console.error("Release package wave is not synchronized:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
NODE

rm -rf "$WORK_ROOT"
mkdir -p "$PACK_DIR" "$CONSUMER_DIR/packages/app/src"

for built_path in \
  "$ROOT_DIR/packages/frontend/dist/index.js" \
  "$ROOT_DIR/packages/emitter/dist/index.js" \
  "$ROOT_DIR/packages/backend/dist/index.js" \
  "$ROOT_DIR/packages/cli/dist/index.js"; do
  require_path "$built_path"
done

frontend_tgz="$(pack_package "$ROOT_DIR/packages/frontend")"
emitter_tgz="$(pack_package "$ROOT_DIR/packages/emitter")"
backend_tgz="$(pack_package "$ROOT_DIR/packages/backend")"
cli_tgz="$(pack_package "$ROOT_DIR/packages/cli")"
tsonic_tgz="$(pack_package "$ROOT_DIR/npm/tsonic")"
tsbindgen_tgz="$(pack_package "$TSONICLANG_ROOT/tsbindgen")"
core_tgz="$(pack_package "$TSONICLANG_ROOT/core/versions/10")"
dotnet_tgz="$(pack_package "$TSONICLANG_ROOT/dotnet/versions/10")"
globals_tgz="$(pack_package "$TSONICLANG_ROOT/globals/versions/10")"
js_tgz="$(pack_package "$TSONICLANG_ROOT/js/versions/10")"
nodejs_tgz="$(pack_package "$TSONICLANG_ROOT/nodejs/versions/10")"

cat >"$CONSUMER_DIR/package.json" <<'JSON'
{
  "name": "tsonic-release-smoke-consumer",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "tsonic build"
  }
}
JSON

cat >"$CONSUMER_DIR/tsonic.workspace.json" <<'JSON'
{
  "$schema": "https://tsonic.org/schema/workspace/v1.json",
  "dotnetVersion": "net10.0",
  "dotnet": {
    "libraries": [],
    "frameworkReferences": [],
    "packageReferences": []
  }
}
JSON

cat >"$CONSUMER_DIR/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": [
    "packages/app/src/**/*.ts"
  ]
}
JSON

cat >"$CONSUMER_DIR/packages/app/package.json" <<'JSON'
{
  "name": "app",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./index.js": "./src/index.ts"
  }
}
JSON

cat >"$CONSUMER_DIR/packages/app/tsonic.json" <<'JSON'
{
  "$schema": "https://tsonic.org/schema/v1.json",
  "rootNamespace": "ReleaseSmoke",
  "entryPoint": "src/index.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "release-smoke",
  "output": {
    "type": "library"
  }
}
JSON

cat >"$CONSUMER_DIR/packages/app/src/index.ts" <<'TS'
import { attributes as A } from "@tsonic/core/lang.js";
import { KeyAttribute } from "@tsonic/dotnet/System.ComponentModel.DataAnnotations.js";

export class Workspace {
  Id: string = "";
}

A<Workspace>()
  .prop((x) => x.Id)
  .add(KeyAttribute);
TS

(
  cd "$CONSUMER_DIR"
  npm install --no-audit --no-fund --ignore-scripts \
    "$frontend_tgz" \
    "$emitter_tgz" \
    "$backend_tgz" \
    "$cli_tgz" \
    "$tsonic_tgz" \
    "$tsbindgen_tgz" \
    "$core_tgz" \
    "$dotnet_tgz"
)

node - "$CONSUMER_DIR" "$TSONICLANG_ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const consumerDir = process.argv[2];
const tsoniclangRoot = process.argv[3];
const packageVersion = (packageJsonPath) =>
  JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
const versions = new Map([
  ["@tsonic/tsbindgen", packageVersion(path.join(tsoniclangRoot, "tsbindgen", "package.json"))],
  ["@tsonic/core", packageVersion(path.join(tsoniclangRoot, "core", "versions", "10", "package.json"))],
  ["@tsonic/dotnet", packageVersion(path.join(tsoniclangRoot, "dotnet", "versions", "10", "package.json"))],
]);

for (const [name, expected] of versions) {
  const packageJsonPath = path.join(consumerDir, "node_modules", name, "package.json");
  const actual = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
  if (actual !== expected) {
    console.error(`${name}: expected installed version ${expected}, got ${actual}`);
    process.exit(1);
  }
}

const langDts = fs.readFileSync(path.join(consumerDir, "node_modules", "@tsonic", "core", "lang.d.ts"), "utf8");
const attributesApi = /export interface AttributesApi \{([\s\S]*?)\n\}/.exec(langDts)?.[1] ?? "";
if (!/<T>\(\): TypeAttributeBuilder<T>;/.test(attributesApi)) {
  console.error("Installed @tsonic/core does not expose callable A<T>() AttributesApi.");
  process.exit(1);
}
if (/\bon\s*[<(]/.test(attributesApi)) {
  console.error("Installed @tsonic/core still exposes legacy A.on(...) AttributesApi.");
  process.exit(1);
}
if (/export type InstanceOf\b/.test(langDts)) {
  console.error("Installed @tsonic/core still exports the legacy InstanceOf helper.");
  process.exit(1);
}
NODE

(
  cd "$CONSUMER_DIR"
  ./node_modules/.bin/tsc -p tsconfig.json --pretty false
)

set +e
generate_output="$(
  cd "$CONSUMER_DIR"
  node node_modules/tsonic/bin.js generate --project app --config tsonic.workspace.json --quiet 2>&1
)"
generate_status=$?
set -e

if [[ "$generate_status" -ne 0 ]]; then
  echo "$generate_output" >&2
  echo "FAIL: tsonic generate failed in release smoke." >&2
  exit "$generate_status"
fi

if grep -q "InstanceOf" <<<"$generate_output"; then
  echo "$generate_output" >&2
  echo "FAIL: release smoke diagnostics mention legacy InstanceOf." >&2
  exit 1
fi

generated_text="$(
  find "$CONSUMER_DIR/packages/app/generated" -name '*.cs' -type f -print0 \
    | xargs -0 cat
)"

if ! grep -q "KeyAttribute" <<<"$generated_text"; then
  echo "FAIL: generated C# did not include the expected KeyAttribute." >&2
  exit 1
fi

if grep -Eq "attributes|A<|InstanceOf" <<<"$generated_text"; then
  echo "FAIL: generated C# contains an unerased marker or legacy helper." >&2
  exit 1
fi

echo "Release package smoke passed."

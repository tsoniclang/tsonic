# Releasing npm packages

Tsonic's npm release is complete only when a new user can create and run a
project from the public registry. The user needs Node.js, npm, and the native
SDK for the selected target. The user does not need a Tsonic source checkout,
a global Tsonic installation, workspace environment variables, or manual
runtime-package wiring.

npm is the sole distribution for Tsonic's first-party compiler and runtime
packages. C# and Rust runtime source is compiled by the application's native
toolchain. We do not publish separate runtime NuGet packages. C# projects still
restore external NuGet dependencies through normal MSBuild/NuGet restore.

## Decide whether to publish

Run the read-only status command from the Tsonic repository:

```sh
./scripts/release-status.sh
```

The command compares the one release wave with public npm and reports one of
three actions:

| Status | Meaning | Next action |
| --- | --- | --- |
| `current` | Every exact artifact exists, its certified source provenance matches, and every `latest` tag selects it | Do not publish |
| `publish` | The local wave is newer, partially published, or not yet selected by `latest` | Authenticate and run the publisher |
| `prepare-patch` | npm is ahead, source changed since publication, or published source provenance cannot be verified | Run the publisher to create one coordinated patch-release branch per repository |

Changes only to host documentation, host tests, or release tooling outside a
published package do not by themselves require an npm package release. A
change to package source, generated distribution, manifest, dependency,
published README, provider, or runtime does. First-party dependency versions
are exact, so a required package release advances the complete wave in
`scripts/release/npm-wave.json`; maintainers never publish a guessed subset.

Each package declares `sourceInputs` in that wave. Nested host packages include
their shared build configuration and build scripts; repository-root packages
include their complete tracked tree. Changes within those inputs require a
release, even if a stale `dist` directory still contains the previous build.

The packer records a `tsonicRelease` field in the certified package manifest.
It identifies the package, version, repository and package directory, and hashes
the declared inputs together with their committed Git file identities and modes.
The baseline is the source actually packed, not the earlier commit that changed
the version. It works in a fresh clone without local release logs or historical
commits. The same source tree has the same digest after a merge. Uncommitted
selected inputs cannot be certified; missing or malformed published provenance
requires a new version, never a guessed baseline.

Provenance is inserted in an isolated staging directory before packed-install
certification. Tracked manifests are not rewritten, and certified tarballs are
not modified afterward. Source provenance does not replace artifact integrity:
resuming a staged release still requires byte-identical tarballs.

## Prerequisites

Use one coherent sibling workspace. The Tsonic host must be on clean `main`.
Every package repository must be clean and identical to `origin/main`; an exact
detached `origin/main` worktree is allowed for a non-host repository.

Authenticate to the canonical public registry. Use either an interactive npm
session with 2FA or a short-lived granular token with read/write package access
and bypass 2FA enabled. Keep tokens outside every repository. For example,
store `NPM_TOKEN` in a mode-`600` user secret file and reference it from the
user npm configuration:

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Load the secret in the release shell, then confirm the identity:

```sh
set -a
. ~/.secrets/npm.env
set +a
npm whoami --registry https://registry.npmjs.org/
```

`npm whoami` proves identity, not write authorization. Publishing and updating
distribution tags each require the corresponding npm permissions and may
require interactive 2FA. An authorization failure stops the release; it does
not permit bypassing verification or publishing directly under `latest`.

Do not publish packages by hand. Do not use local links, alternate registries,
or global package installations as release evidence.

## Publish

Run:

```sh
./scripts/publish-npm.sh
```

All source and private-registry proofs pass before any public artifact is
published. The publisher requires an existing `latest` baseline for every
package. It updates existing packages; it does not bootstrap first-ever
packages through an unverified promotion path. Run only one release at a time.

The publisher performs these steps in order:

1. verifies branch hygiene and exact `origin/main` identity;
2. inspects exact public artifacts and `latest` tags;
3. validates existing source, target, provider, and runtime certification and
   runs only missing or invalidated checks;
4. rebuilds and packs the complete wave and runs C#, Rust, and Node-capability projects from
   a private tarball registry;
5. checks local tarball hashes and existing `latest` baselines, then publishes
   the certified tarballs under `staged-<version>`, leaving `latest` unchanged;
6. waits for registry metadata convergence and verifies every public artifact
   byte-for-byte against the certified tarball;
7. creates fresh C# and Rust projects using the exact staged version, installs
   matching exact Node capabilities, and verifies ordinary `node:*` execution;
8. rechecks that no `latest` baseline changed, then promotes each verified
   package to `latest` in dependency order and verifies tag convergence;
9. repeats the public proof through `npm create tsonic@latest` and matching
   latest Node capabilities, then prints the aggregate artifact hash.

For example, staging `0.1.1` leaves ordinary users on `0.1.0`. The pre-promotion
proof runs `npm create tsonic@0.1.1` and installs Node capabilities at `0.1.1`.
If installation or execution fails, `latest` remains unchanged. Successful
exact-version verification allows promotion; the final latest-based proof
then verifies the commands ordinary users run.

### Reuse completed verification

Complete `npm test` runs in the Rust target and Rust runtimes, and the host's
complete `./test/scripts/run-all.sh`, write a common certification record. You
can also bring all five release banks up to date, or select one:

```sh
node scripts/release/certify.mjs
node scripts/release/certify.mjs --suite tsonic-rust
```

Commit the tested sources first. A run on a dirty worktree still reports its
test result, but cannot authorize release reuse. The recorder captures the
declared repository closure before and after execution, including exact Git
trees, installed dependency-lock identity, native toolchains and relevant
environment fingerprints. It retains complete test counts and hashes the
underlying reports and bounded process log. Environment values are hashed, not
copied into certification records.

The publisher reuses valid results automatically. After merging, use:

```sh
./scripts/publish-npm.sh
```

The publisher accepts only complete, successful and current evidence from clean
inputs. A merge commit with the same tree is fine. Changed product source,
build configuration, dependencies, execution guards or toolchains invalidate
their affected banks. Filtered runs, calibration runs, missing counts,
changed evidence, resource failures and unfinished newer runs cannot stand in
for complete certification. Rust JS's one existing ignored vendored doctest is
explicitly counted in the release manifest; additional skips are rejected.

Documentation and release-control edits do not require another compiler/runtime
run. The release manifest assigns their exact paths to focused checks. Those
checks use the same bounded runner and immutable record format as source banks.
Only current passing checks can cover those differences in an earlier source
record. Other changed files still require their affected full bank. There is no
blanket Markdown exemption, manually edited certificate or historical-log import.

Original records remain unchanged: release acceptance combines the existing
source results with the necessary focused results. Changes during any recorded
run are rejected, including changes inside a focused scope. Repeated publication
attempts reuse current focused evidence too.

Missing or stale evidence runs only the affected checks. A failed check stops
the sequence before another bank starts. To inspect evidence without running
tests or publishing, use:

```sh
node scripts/release/certify.mjs --check
```

The read-only check reports missing or invalidated evidence as an error. There
is no skip-tests or force-to-publish option. Direct complete test entrypoints
still run their requested banks; publishing does not repeat them unnecessarily.

Records live in `.temp/certification/<repository>/`. Keep that directory and
its referenced logs if you want reuse; scratch cleanup can remove them. Old
human-readable logs are not imported as certificates. These are local trusted
runner records with corruption checks, not signed remote attestations: do not
accept records supplied by an untrusted party.

Reuse never skips rebuilding, packing, the private tarball installations, the
configured framework matrix, the exact public installations or fresh `latest`
installations. These prove the selected artifacts and registry state, not just
unchanged compiler behavior.
Publication still requires every release repository on clean, exact main.
`./scripts/publish-npm.sh --validate` only validates manifests; it does not test
or publish anything.

### Parallelism and resource bounds

The publisher uses the same CPU/memory policy and no-swap process-group guards
as ordinary certification. `TSONIC_TEST_CPUS` and `TSONIC_TEST_MEMORY_MIB` select
finite limits; `TSONIC_TEST_WORKERS`, `TSONIC_TEST_CHILD_JOBS` and
`TSONIC_TEST_HEAP_MIB` can further constrain test workers. Defaults use effective
CPUs and available memory while keeping a system reserve.

Independent C# and Rust installation projects run concurrently, dividing the
total CPU and memory budget between them. Each project's cold/warm and framework
checks stay ordered because they intentionally modify the same project. Single
Cargo test phases use the available native CPU budget. Complete source banks
run in order because they share builds; their internal test workers remain
parallel. Time, task, output-size and OOM guards still apply.

The public-install step uses an isolated npm cache and configuration. It strips
workspace and source-root environment variables, rejects local dependency
specifiers and linked first-party packages, checks the complete npm dependency
tree, and runs only project-local tools. This is the proof that the commands in
[Get started](../manual/get-started.md) work without repository source.

### Verify additional C# frameworks

Set `TSONIC_CSHARP_FRAMEWORK_MATRIX` to an array of exact SDK/framework pairs
before invoking the publisher. Both the private and public installation proofs
use the same matrix. For the SDKs used in the source-distribution certification:

```sh
export TSONIC_CSHARP_FRAMEWORK_MATRIX='[
  {"framework":"net10.0","sdk":"10.0.400"},
  {"framework":"net11.0","sdk":"11.0.100-rc.1.26425.128"},
  {"framework":"net10.0","sdk":"11.0.100-rc.1.26425.128"}
]'
./scripts/publish-npm.sh
```

Use versions actually installed on the release machine. Each selection builds
and executes the native/JS/Node proof twice without reinstalling dependencies.
It checks the runtime major, generated project framework and dependency paths.
Omitting the matrix retains the ordinary starter and Node-capability proofs.

## Interrupted releases

The release is resumable. Exact versions already present on npm are compared
with the newly certified tarballs and are not published again. Public exact
verification runs again before any remaining promotions. A successfully
published package can take several minutes to become visible through all npm
metadata endpoints; the publisher waits for that convergence rather than
republishing the immutable version.

If a process stops after publication but before the public-install proof,
rerunning the publisher executes the source-free public proof even when all
versions and `latest` tags are already current.

If an existing exact artifact differs from the certified tarball, stop. Never
overwrite or reinterpret an immutable npm version. Prepare and merge a new
patch wave, then rerun the publisher.

An unexpected change to a package's `latest` tag stops the release rather than
overwriting another release. npm has no atomic multi-package tag promotion:
an interruption during promotion can leave some verified packages promoted.
Rerunning resumes the remaining promotions after checking the same artifacts
and repeating the exact-version proof.

If the publisher creates release branches, merge every printed PR, update the
coherent release workspace to exact `origin/main`, and rerun the same command.

## Completion record

Record the following values from the successful publisher and final status
output:

- [ ] release version;
- [ ] package count;
- [ ] total packed file count;
- [ ] aggregate SHA-256;
- [ ] exact staged public-install proof passed before any latest promotion;
- [ ] exact public C# starter result;
- [ ] exact public Rust starter result;
- [ ] exact public C# Node-capability result;
- [ ] exact public Rust Node-capability result;
- [ ] every `latest` tag selects the release version;
- [ ] `./scripts/release-status.sh` reports `Status: current`.

Do not call a release complete while any item is unproved.

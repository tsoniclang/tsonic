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
| `current` | Every exact artifact exists and every `latest` tag selects it | Do not publish |
| `publish` | The local wave is newer, partially published, or not yet selected by `latest` | Authenticate and run the publisher |
| `prepare-patch` | npm is ahead, or package content changed after this version was recorded | Run the publisher to create one coordinated patch-release branch per repository |

Changes only to host documentation, host tests, or release tooling outside a
published package do not by themselves require an npm package release. A
change to package source, generated distribution, manifest, dependency,
published README, provider, or runtime does. First-party dependency versions
are exact, so a required package release advances the complete wave in
`scripts/release/npm-wave.json`; maintainers never publish a guessed subset.

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
3. runs the complete source, target, provider, and runtime certification bank;
4. packs the complete wave and runs C#, Rust, and Node-capability projects from
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

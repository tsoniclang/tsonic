# Releasing npm packages

Tsonic's npm release is complete only when a new user can create and run a
project from the public registry. The user needs Node.js, npm, and the native
SDK for the selected target. The user does not need a Tsonic source checkout,
a global Tsonic installation, workspace environment variables, or manual
runtime-package wiring.

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

`npm whoami` proves identity, not write authorization. The first publication
is the authoritative authorization check. A bypass-2FA token can publish but
cannot perform package-governance operations such as changing distribution
tags. An interrupted release that requires tag recovery therefore needs an
interactive 2FA session.

Do not publish packages by hand. Do not use local links, alternate registries,
or global package installations as release evidence.

## Publish

Run:

```sh
./scripts/publish-npm.sh
```

All source and private-registry proofs pass before any public artifact is
published. npm automatically creates `latest` for a package's first published
version even when another tag is requested, so a first release cannot use a
distribution tag as a transaction boundary.

The publisher performs these steps in order:

1. verifies branch hygiene and exact `origin/main` identity;
2. inspects exact public artifacts and `latest` tags;
3. runs the complete source, target, provider, and runtime certification bank;
4. packs the complete wave and runs C#, Rust, and Node-capability projects from
   a private tarball registry;
5. publishes the already-certified tarballs directly under `latest`;
6. waits for registry metadata convergence and verifies every public artifact
   byte-for-byte against the certified tarball;
7. verifies every final `latest` tag;
8. creates fresh C# and Rust projects through `npm create tsonic@latest`,
   builds and runs both, installs the matching Node capability, and runs
   ordinary `node:*` source;
9. prints the aggregate artifact hash.

The public-install step uses an isolated npm cache and configuration. It strips
workspace and source-root environment variables, rejects local dependency
specifiers and linked first-party packages, checks the complete npm dependency
tree, and runs only project-local tools. This is the proof that the commands in
[Get started](../manual/get-started.md) work without repository source.

## Interrupted releases

The release is resumable. Exact versions already present on npm are compared
with the newly certified tarballs and are not published again. A successfully
published package can take several minutes to become visible through all npm
metadata endpoints; the publisher waits for that convergence rather than
republishing the immutable version.

If a process stops after publication but before the public-install proof,
rerunning the publisher executes the source-free public proof even when all
versions and `latest` tags are already current.

If an existing exact artifact differs from the certified tarball, stop. Never
overwrite or reinterpret an immutable npm version. Prepare and merge a new
patch wave, then rerun the publisher.

If the publisher creates release branches, merge every printed PR, update the
coherent release workspace to exact `origin/main`, and rerun the same command.

## Completion record

Record the following values from the successful publisher and final status
output:

- [ ] release version;
- [ ] package count;
- [ ] total packed file count;
- [ ] aggregate SHA-256;
- [ ] exact public C# starter result;
- [ ] exact public Rust starter result;
- [ ] exact public C# Node-capability result;
- [ ] exact public Rust Node-capability result;
- [ ] every `latest` tag selects the release version;
- [ ] `./scripts/release-status.sh` reports `Status: current`.

Do not call a release complete while any item is unproved.

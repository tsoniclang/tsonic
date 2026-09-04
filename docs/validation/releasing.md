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
| `publish` | The local wave is newer, partially staged, or not yet promoted | Authenticate and run the publisher |
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

Authenticate to the canonical public registry:

```sh
npm login --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/
```

Do not publish packages by hand. Do not use local links, alternate registries,
or global package installations as release evidence.

## Publish

Run:

```sh
./scripts/publish-npm.sh
```

The exact public install must pass before changing `latest`.

The publisher performs these steps in order:

1. verifies branch hygiene and exact `origin/main` identity;
2. inspects exact public artifacts and `latest` tags;
3. runs the complete source, target, provider, and runtime certification bank;
4. packs the complete wave and runs C#, Rust, and Node-capability projects from
   a private tarball registry;
5. publishes missing exact artifacts under the staging tag `tsonic-wave`;
6. verifies every public artifact byte-for-byte against the certified tarball;
7. creates fresh C# and Rust projects from public npm, builds and runs both,
   installs the matching Node capability, and runs ordinary `node:*` source;
8. promotes the verified exact versions to `latest`;
9. verifies every final `latest` tag and prints the aggregate artifact hash.

The public-install step uses an isolated npm cache and configuration. It strips
workspace and source-root environment variables, rejects local dependency
specifiers and linked first-party packages, checks the complete npm dependency
tree, and runs only project-local tools. This is the proof that the commands in
[Get started](../manual/get-started.md) work without repository source.

## Interrupted releases

The release is resumable. Exact versions already present on npm are compared
with the newly certified tarballs and are not published again. Missing exact
artifacts are staged, and `latest` remains unchanged until the complete public
install proof succeeds.

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

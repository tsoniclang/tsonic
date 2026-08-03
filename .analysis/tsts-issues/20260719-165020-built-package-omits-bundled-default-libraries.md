# Built TSTS package omits bundled default-library resources

## Status

Blocked at the installed-package boundary. The exact built TSTS artifact advertises bundled library files through generated indexes but does not contain the `.d.ts` resources that the runtime reader opens.

## Exact artifact

- Isolated repository: `/home/jeswin/temp/tsts`
- Branch: `tsts-v0-fixes`
- Vendored commit: `c8b97365aa4dc436a248b69261d36191dc44c5d8`
- Implementation commit: `3407b2f8139877f5c4ff0625131994722ad40147`
- Built and vendored files: `1,808`
- Sorted relative-path/content manifest SHA-256: `c15f97ff87d121116b1de115c3f2f98ffc4bbc87e549fd605a7b9f6fd5e7e9a3`
- Byte equivalence: `diff -qr` produced no output
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout: untouched

## Source-level trigger

Any installed-package program that uses the normal default library reproduces the failure. For example:

```ts
const values = [1, 2, 3];
values.length;
```

The program does not opt into `noLib`. TSTS therefore selects `lib.es2025.full.d.ts`, as its normal standalone TypeScript contract requires.

## Actual failure

```text
Error: ENOENT: no such file or directory, open
  '/home/jeswin/repos/tsoniclang/tsonic/packages/tsts/dist/src/internal/bundled/libs/lib.es2025.full.d.ts'
    at readFileSync
    at readEmbeddedContent (.../dist/src/internal/bundled/embed.js:43:21)
    at wrappedFS_ReadFile (.../dist/src/internal/bundled/embed.js:179:26)
```

The failure is deterministic in tests that create a standalone TSTS program with default libraries, including the runtime-union source-semantics proofs. It occurs before source semantics or C# mapping can run.

## Artifact evidence

The exact source checkout contains generated library resources under:

```text
packages/tsts/src/internal/bundled/libs/*.d.ts
```

The exact built artifact contains only the generated JavaScript/declaration modules under:

```text
packages/tsts/dist/src/internal/bundled/
  bundled.*
  embed.*
  embed_generated.*
  libs_generated.*
  noembed.*
```

It has no directory:

```text
packages/tsts/dist/src/internal/bundled/libs/
```

`packages/tsts/package.json` currently packages only these globs:

```json
[
  "dist/src/**/*.js",
  "dist/src/**/*.js.map",
  "dist/src/**/*.d.ts",
  "dist/src/**/*.d.ts.map"
]
```

Those globs would include `.d.ts` files under `dist` if the build copied them, but `tsc` excludes `src/internal/bundled/libs` and does not copy the resources into `dist`.

## Runtime causal chain

```text
installed consumer creates a TSTS program without noLib
  -> TSTS selects bundled:///libs/lib.es2025.full.d.ts
  -> embed_generated says that logical resource exists
  -> wrapped bundled FS calls readEmbeddedContent
  -> embeddedLibRoot searches package-relative source/vendor candidates
  -> none contains lib.d.ts in the built package
  -> fallback root is dist/src/internal/bundled/libs
  -> readFileSync opens a file absent from the built artifact
  -> ENOENT aborts program creation
```

The generated index and physical package disagree: `embeddedContentNames` proves logical presence while the package omits the physical content required by `readEmbeddedContent`.

## Package-check gap

`packages/tsts/tools/package/check-built-package.mjs` verifies public entrypoints and `npm pack --dry-run` contents, but it does not instantiate TSTS from the packed artifact and compile a default-lib program. A dry-run package listing cannot detect a resource that was never emitted into `dist`.

Tsonic's own vendored-artifact check similarly proves the compiled TSTS API artifact and generated index, not that every indexed bundled resource can be read at runtime.

## Why this is a TSTS packaging blocker

Tsonic product builds intentionally use `noLib`, but `@tsonic/tsts` remains a public compiler package whose standalone default-library behavior must work from its built/npm artifact. The complete C#/host gate also exercises direct TSTS programs with default libraries.

Tsonic must not repair the artifact by copying supplemental resources after vendoring because that would:

- break required byte-for-byte equivalence with the accepted TSTS artifact;
- leave the published TSTS package itself broken;
- create a host-specific alternate package layout;
- and make reproducibility depend on an adjacent source checkout.

## Required generic fix

1. Emit or copy every generated bundled `.d.ts` resource into the canonical built package layout.
2. Include those resources in the deterministic artifact manifest and npm package.
3. Make `embeddedContentNames` and the physical packaged resources mechanically equivalent.
4. Ensure the built package never falls through to an adjacent source/vendor checkout for resources required by its public behavior.
5. Extend `package:check` to install or unpack the built package in isolation and compile a minimal default-lib source program through its public root API.
6. Fail the package check if any indexed bundled resource is absent or unreadable.

## Required neutral regression

From a packed artifact in an isolated directory with no TSTS source checkout nearby:

```ts
const values = [1, 2, 3];
const first = values[0];
```

Prove:

- program creation succeeds without `noLib`;
- `Array<number>` and its default-library members resolve normally;
- every `embeddedContentNames` entry has a packaged physical resource;
- removing one resource makes `package:check` fail deterministically;
- two clean builds retain byte-identical manifests.

## Acceptance after the TSTS fix

1. Vendor the exact isolated artifact byte-for-byte and record count/hash.
2. Run the default-library installed-package regression from the vendored artifact.
3. Run the runtime-union source-semantics tests that currently fail at library loading.
4. Run the selected-evidence and source-profile banks.
5. Run Proof Pudding unchanged.
6. Run the complete parallel host/C#/runtime gate.

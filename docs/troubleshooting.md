# Troubleshooting

## A program builds in TypeScript but fails in Tsonic

Check whether the construct is within the deterministic subset. Tsonic does not
promise to accept every TypeScript pattern.

Useful checks:

- are you depending on dynamic runtime behavior?
- is a generic function value escaping into a context Tsonic cannot monomorphize?
- are overloads relying on inference that needs an explicit annotation?

## A package import fails

Check:

- the active surface
- `tsonic.package.json`
- `tsonic.workspace.json`
- generated binding package installation and restore state

Also check whether you are mixing up:

- surface selection
- authored source packages
- generated CLR binding packages

## `npm ci` fails in a fresh checkout

Check that the root workspace is using the real wrapper package:

- `npm/tsonic/package.json` should be the only workspace package named
  `tsonic`
- root `package.json` and `package-lock.json` should pin the same package
  versions
- `node_modules/.bin/tsonic` should resolve into `packages/cli/dist/index.js`
  through the local workspace, not a global install

A generated sample project named `packages/tsonic` is a repository hygiene bug,
not a valid compiler package.

## Runtime DLL is missing

For compiler development, build the sibling runtime first:

```bash
cd ../runtime
dotnet build -c Release
cd ../tsonic
./test/scripts/run-all.sh
```

The compiler repo intentionally consumes `../runtime` for runtime DLL sync. If
that sibling does not exist, runtime-dependent tests should fail clearly rather
than search arbitrary machine paths.

## Source-package graph test cannot find `../js` or `../nodejs`

The full compiler gate includes frontend tests that validate authored
source-package traversal using the sibling `js` and `nodejs` repos. This is
intentional: the published `@tsonic/js` and `@tsonic/nodejs` binding packages
contain declarations and binding metadata, not the authored
`tsonic.package.json` source package closure those tests are proving.

Use the standard developer layout:

```text
~/repos/tsoniclang/
  tsonic/
  js/
  nodejs/
  runtime/
```

## A downstream app fails but compiler tests are green

That can happen. Real package graphs and published programs expose integration
boundaries that unit tests do not. Use the downstream verifier for the affected
repo.

## A binding package looks wrong

That is usually a `tsbindgen` regen issue, not a first-party source-package
issue. Recheck the generated binding repo and publish-wave state.

## A local multi-project workspace behaves strangely

Check the local package ownership mode in `references.packages`:

- `source` compiles the package into the same generated closure
- `dll` builds a separate assembly boundary

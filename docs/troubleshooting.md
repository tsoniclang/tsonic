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

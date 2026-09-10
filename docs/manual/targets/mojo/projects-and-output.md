# Mojo projects and output

Use target id `mojo`. `packageName` names the generated native package;
`outputType` selects `bin` or `lib` and defaults to `bin`.

For example:

```json
{
  "entryPoint": "App.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [{
    "id": "mojo",
    "options": { "packageName": "example", "outputType": "lib" }
  }]
}
```

The generated project contains native sources under `out/mojo/src`, required
runtime/package inputs under `out/mojo/packages`, and `out/mojo/pixi.toml`.
Native build requirements are recorded in `mojo-native-build.json`.

```sh
./node_modules/.bin/tsonic build
pixi run --manifest-path out/mojo/pixi.toml build
```

Library output uses Mojo precompilation. Binary output uses `mojo build` and
provides a Pixi `run` task. Keep platform, linker and SDK configuration in the
native project rather than adding target-specific settings to the shared host.

## Existing Pixi projects

Set `options.projectFile` to an existing `pixi.toml` outside the generated output
directory. Tsonic does not replace that manifest. You own the native build and
the integration of generated sources and declared native dependencies.

## Formatting and compiler selection

Generation uses `mojo format` before publication. If the selected formatter or
compiler version is unsuitable, generation fails rather than publishing an
unformatted partial project. Imported native package sources stay byte-identical.

`options.compiler` selects the compiler command, working directory and associated
language server. See [configuration](../../../reference/targets/mojo/configuration.md).

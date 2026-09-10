# Mojo target manual

The Mojo target compiles TypeScript into Mojo source and a Pixi project. Mojo
performs the native build. The source remains TypeScript; you do not write a
second implementation in Mojo.

## A first function

```ts
import type { i32 } from "@tsonic/mojo/types.js";

export function add(left: i32, right: i32): i32 {
  return left + right;
}
```

The native proof project produces:

```mojo
def add(left: Int32, right: Int32) -> Int32:
    return left + right
```

`@tsonic/mojo/types.js` is a virtual source module supplied by the target, not a
separate npm package. Ordinary TypeScript `number` uses `Float64`; `i32` asks
for an exact native `Int32`.

## Build a project

The Mojo target currently requires a source-workspace installation. Its npm
package is not published, and `npm create tsonic -- --target mojo` is not a
supported install route. The [target repository](https://github.com/tsoniclang/tsonic-mojo)
owns the source setup and pinned SDK instructions. C# and Rust use the published
[project creator](../../get-started.md).

With the CLI and Mojo target installed in that workspace, put the function in
`src/App.ts` and use:

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

Activate the pinned SDK before generation. The compiler is needed for native
API queries and formatting, not just the final build.

```sh
./node_modules/.bin/tsonic build --project tsonic.json
pixi run --manifest-path out/mojo/pixi.toml build
```

This creates a library. See [projects and output](projects-and-output.md) for
applications and integration with an existing Pixi project.

## Read next

- [Source profile](source-profile.md)
- [Ownership and safety](ownership-and-safety.md)
- [Projects and output](projects-and-output.md)
- [Configuration reference](../../../reference/targets/mojo/configuration.md)
- [Language support](../../../reference/targets/mojo/language-support.md)
- [Limitations](../../../reference/targets/mojo/limitations.md)

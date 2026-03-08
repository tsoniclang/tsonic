# Getting Started

## Requirements

- Node.js `22+`
- .NET `10` SDK

Verify:

```bash
node --version
dotnet --version
```

## Install

Global:

```bash
npm install -g tsonic
```

Local:

```bash
npm install --save-dev tsonic
```

## Initialize a Workspace

### Default CLR surface

```bash
mkdir hello-clr
cd hello-clr
tsonic init
```

This creates:

```text
tsonic.workspace.json
package.json
packages/hello-clr/
  package.json
  tsonic.json
  src/App.ts
  tsonic/package-manifest.json
```

Run it:

```bash
tsonic run
```

### JS surface

```bash
mkdir hello-js
cd hello-js
tsonic init --surface @tsonic/js
tsonic run
```

JS sample:

```ts
export function main(): void {
  const message = "  Hello from Tsonic JS surface!  ".trim();
  console.log(message);
}
```

### Add Node module support

`node:*` APIs are not ambient. Keep the JS surface and add the Node package:

```bash
tsonic init --surface @tsonic/js
tsonic add npm @tsonic/nodejs
```

Then author normal Node imports:

```ts
import * as fs from "node:fs";
import * as path from "node:path";

export function main(): void {
  const file = path.join("src", "App.ts");
  console.log(fs.existsSync(file));
}
```

## Build Commands

Generate C# only:

```bash
tsonic generate
```

Build:

```bash
tsonic build
```

Build and run:

```bash
tsonic run
```

Run tests:

```bash
tsonic test
```

Pack a library project:

```bash
tsonic pack
```

## Add CLR Dependencies

NuGet:

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
```

Local DLL:

```bash
tsonic add package ./libs/MyCompany.MyLib.dll
```

Regenerate local bindings/cache:

```bash
tsonic restore
```

## Source Packages

`tsonic init` makes each project npm-source-package-ready by default. The generated manifest:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "source": {
    "exports": {
      ".": "./src/App.ts"
    }
  }
}
```

Installed packages with that manifest are compiled transitively as TypeScript source, not treated as opaque external modules.

## Next

- `cli.md`
- `configuration.md`
- `language.md`
- `bindings.md`

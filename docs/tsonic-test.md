---
title: Tsonic Test
---

# Tsonic Test

`tsonic test` builds one managed .NET test assembly for a Tsonic project and
runs it through `dotnet test`. The authoring model is intentionally the same
shape as C# xUnit:

- tests live in classes
- test methods are marked with xUnit attributes
- assertions come from xUnit
- one Tsonic project test entry point produces one test DLL
- xUnit discovers `[Fact]` and `[Theory]` methods from that DLL

The Tsonic compiler does not have special test syntax. Tests are ordinary
Tsonic source files that use the same attribute API as other CLR metadata.

## Project configuration

Add a `tests` block to the project `tsonic.json`:

```json
{
  "rootNamespace": "Tsts",
  "entryPoint": "src/index.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "tsts",
  "output": {
    "type": "library",
    "nativeAot": false
  },
  "tests": {
    "entryPoint": "src/tests-index.ts",
    "outputDirectory": ".tsonic/generated-tests",
    "outputName": "tsts.Tests"
  }
}
```

Configure test framework packages in `tsonic.workspace.json`:

```json
{
  "dotnetVersion": "net10.0",
  "testDotnet": {
    "packageReferences": [
      {
        "id": "Microsoft.NET.Test.Sdk",
        "version": "17.11.1",
        "types": false
      },
      {
        "id": "xunit",
        "version": "2.9.2"
      },
      {
        "id": "xunit.runner.visualstudio",
        "version": "2.5.6",
        "types": false
      }
    ]
  }
}
```

`testDotnet` dependencies are merged into the generated test project only for
`tsonic test`. They do not become production dependencies of `tsonic build`.

## Test entry point

The test entry point imports every test file that should be part of the test
assembly:

```ts
// src/tests-index.ts
import "./_smoke.test.ts";
import "./scanner/scanner.test.ts";
import "./parser/parser.test.ts";
```

The entry point is equivalent to the source file list in a C# test project. It
does not need to export anything.

## Basic xUnit test

C# xUnit:

```csharp
using Xunit;

public sealed class SmokeTests
{
    [Fact]
    public void one_plus_one_is_two()
    {
        Assert.Equal(2, 1 + 1);
    }
}
```

Tsonic:

```ts
import { attributes as A } from "@tsonic/core/lang.js";
import { Assert, FactAttribute } from "xunit-types/Xunit.js";

export class SmokeTests {
  one_plus_one_is_two(): void {
    Assert.Equal(2, 1 + 1);
  }
}

A<SmokeTests>()
  .method((t) => t.one_plus_one_is_two)
  .add(FactAttribute);
```

The emitted test assembly contains a normal CLR class with a normal xUnit
`FactAttribute` on the method. xUnit discovery sees the same shape it sees in
C#.

## Testing production code

A test imports the production module it exercises:

```ts
import { attributes as A } from "@tsonic/core/lang.js";
import { Assert, FactAttribute } from "xunit-types/Xunit.js";

import { createScanner } from "../scanner/scanner.ts";

export class ScannerTests {
  reads_identifier_token(): void {
    const scanner = createScanner("hello");
    const token = scanner.next();

    Assert.Equal("identifier", token.kind);
    Assert.Equal("hello", token.text);
  }
}

A<ScannerTests>()
  .method((t) => t.reads_identifier_token)
  .add(FactAttribute);
```

Only files reachable from `tests.entryPoint` are compiled into the test
assembly. If `scanner.test.ts` imports `../scanner/scanner.ts`, the scanner and
its transitive imports are included. If a smoke test imports no production
module, production modules are not typechecked or emitted for that test run.

That mirrors the normal C# model:

```text
Tsts.csproj        -> tsts.dll
Tsts.Tests.csproj  -> tsts.Tests.dll
```

The test DLL contains test classes plus the code those tests import. xUnit
discovers all test methods in that one DLL.

## Theories and data

C# xUnit:

```csharp
using Xunit;

public sealed class ScannerTheoryTests
{
    [Theory]
    [InlineData("hello", "identifier")]
    [InlineData("123", "number")]
    public void reads_token_kind(string source, string expectedKind)
    {
        var token = createScanner(source).Next();
        Assert.Equal(expectedKind, token.Kind);
    }
}
```

Tsonic:

```ts
import { attributes as A } from "@tsonic/core/lang.js";
import {
  Assert,
  InlineDataAttribute,
  TheoryAttribute,
} from "xunit-types/Xunit.js";

import { createScanner } from "../scanner/scanner.ts";

export class ScannerTheoryTests {
  reads_token_kind(source: string, expectedKind: string): void {
    const token = createScanner(source).next();
    Assert.Equal(expectedKind, token.kind);
  }
}

A<ScannerTheoryTests>()
  .method((t) => t.reads_token_kind)
  .add(TheoryAttribute)
  .add(InlineDataAttribute, "hello", "identifier")
  .add(InlineDataAttribute, "123", "number");
```

The method shape, assertion style, and xUnit discovery model match C# xUnit.
The only syntax difference is how Tsonic attaches CLR attributes.

## Assembly output

For this project:

```json
{
  "rootNamespace": "Tsts",
  "entryPoint": "src/index.ts",
  "outputName": "tsts",
  "tests": {
    "entryPoint": "src/tests-index.ts",
    "outputName": "tsts.Tests"
  }
}
```

The outputs are:

```text
tsonic build  -> generated/bin/Release/<tfm>/tsts.dll
tsonic test   -> .tsonic/generated-tests/bin/Release/<tfm>/tsts.Tests.dll
```

All test classes imported by `src/tests-index.ts` live in
`tsts.Tests.dll`. Tsonic does not produce one DLL per test file.

## TSTS team guidance

Use one index file for the current test slice:

```ts
// packages/tsts/src/tests-index.ts
import "./_smoke.test.ts";
import "./scanner/scanner.test.ts";
import "./parser/parser.test.ts";
```

Port tests incrementally by importing only the production module under test:

```ts
import { attributes as A } from "@tsonic/core/lang.js";
import { Assert, FactAttribute } from "xunit-types/Xunit.js";

import { parseSourceFile } from "../parser/parser.ts";

export class ParserTests {
  parses_empty_source_file(): void {
    const result = parseSourceFile("");

    Assert.True(result.ok);
    Assert.Equal(0, result.diagnostics.length);
  }
}

A<ParserTests>()
  .method((t) => t.parses_empty_source_file)
  .add(FactAttribute);
```

Keep incomplete production areas out of a test run by not importing them from
the test entry closure. This is not a workaround; it is the same project
boundary rule used by C# test projects. A test assembly contains exactly the
test entry point closure plus framework and configured dependency references.

Use `tsonic test --project tsts` as the normal gate for TSTS tests. Use
`--verbose` when the generated project or `dotnet test` output is needed for
diagnostics.

## Rules

- Keep the current xUnit class-and-attribute structure.
- Put test-only NuGet packages under `testDotnet`.
- Import production files explicitly from tests that exercise them.
- Do not rely on production `entryPoint` or package exports to load tests.
- Keep all tests for one project in one test DLL.
- Use shell selftests separately for end-to-end process checks.

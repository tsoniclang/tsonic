# Mojo configuration

These are the accepted target `options` fields. Unknown fields are rejected.

| Option | Default | Meaning |
| --- | --- | --- |
| `packageName` | `tsonic_generated` | Native package name, matching `^[a-z][a-z0-9_]*$`. |
| `outputType` | `bin` | `bin` or `lib`. |
| `projectFile` | absent | Existing user-owned `pixi.toml`, outside generated output. |
| `compiler` | commands on PATH | Compiler and language-server command configuration. |
| `providerPackages` | empty | Explicit native package roots and identities. |

## Compiler command

The compiler object accepts `executable`, `arguments`, `workingDirectory`,
`languageServerExecutable` and `languageServerArguments`. `executable` is
required when the object is present. Arguments default to empty; the working
directory defaults to the source project's directory. The language server
defaults to `mojo-lsp-server` on PATH.

For a project with a pinned Pixi SDK:

```json
{
  "id": "mojo",
  "options": {
    "compiler": {
      "executable": "pixi",
      "arguments": ["run", "mojo"],
      "languageServerExecutable": "pixi",
      "languageServerArguments": ["run", "mojo-lsp-server"]
    }
  }
}
```

The current target pins Mojo `1.1.0.dev2026083005` and `linux-64`. A compiler
merely being on PATH is not a promise of version compatibility.

## Native packages

Each `providerPackages` entry requires `kind` (`standard-library` or `package`),
`id`, `alias`, `packageName`, `version`, `importRoot` and `sourceRoot`.
Roots must exist, and `sourceRoot` must be the exact `packageName` directory
under `importRoot`. Identities, aliases and package names must be unique.
At most one standard-library entry is accepted.

These declarations select inputs for native provider queries. They do not
download dependencies or infer native ABI details from import spelling.

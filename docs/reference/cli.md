# CLI reference

The `tsonic` executable currently exposes two commands.

## `tsonic build`

```text
tsonic build --project <tsonic.json>
tsonic build -p <tsonic.json>
```

If `--project` is omitted, the command uses `tsonic.json` in the current
directory.

The command:

1. reads and validates the project file;
2. recovers any interrupted staged-output transaction;
3. discovers installed plugins;
4. checks the source program;
5. compiles every selected target;
6. publishes target artifacts only when no error diagnostic exists.

Successful output reports the project path, entry point, target ids, and
artifact count. Diagnostics are written in this form:

```text
ERROR <source>:<code> <file>:<line>:<column>: <message>
  evidence: <entry>
```

## `tsonic targets`

```text
tsonic targets --project <tsonic.json>
```

This discovers the project's installed plugins and prints one tab-separated
`target-id` and plugin id per available target. Discovery errors cause a
nonzero exit.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Help, target discovery, or build completed successfully |
| `1` | Invalid configuration, plugin failure, compiler diagnostic, target rejection, publication failure, or toolchain failure |
| `2` | Unknown CLI command |

`tsonic build` may print project information even when diagnostics are also
present. Treat the exit code as the build result.

## Output publication

The CLI recovers any interrupted output transaction before compiling. It
publishes the complete output tree only when every selected target resolves
without an error. A failure leaves the previous successful output in place.

## Unsupported commands

There are no `init`, `run`, `add`, or `restore` commands. Project creation,
native execution, package installation, and native dependency restoration
remain owned by npm and the target-native toolchain.

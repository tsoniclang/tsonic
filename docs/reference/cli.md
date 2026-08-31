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

## Unsupported commands

There are no `init`, `run`, `add`, or `restore` commands. Project creation,
native execution, package installation, and native dependency restoration
remain owned by npm and the target-native toolchain.

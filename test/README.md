# Test Layout

Primary full gate:

```bash
./test/scripts/run-all.sh
```

This includes:

- unit tests
- golden tests
- TS typecheck fixtures
- E2E dotnet fixtures
- negative fixtures

Filtered runs are for iteration only. Final verification must use the full gate.

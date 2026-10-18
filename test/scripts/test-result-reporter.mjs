export default async function* reportTestResults(source) {
  const names = [];
  for await (const event of source) {
    const data = event.data;
    if (event.type === "test:start") names[data.nesting] = data.name;
    if (event.type === "test:pass" || event.type === "test:fail") {
      const path = [...names.slice(0, data.nesting), data.name];
      if (path.some(name => typeof name !== "string")) throw new Error("A test result is missing its enclosing name.");
      const message = data.details?.error?.message;
      const skipped = data.skip === true || typeof data.skip === "string";
      const todo = data.todo === true || typeof data.todo === "string";
      yield `${JSON.stringify({ kind: "test", file: data.file ?? null, name: data.name, path,
        nesting: data.nesting, type: data.details?.type ?? "test",
        status: skipped ? "skipped" : todo ? "todo" : event.type === "test:pass" ? "passed" : "failed",
        durationMs: data.details?.duration_ms ?? null, line: data.line ?? null,
        failureType: data.details?.error?.failureType ?? null,
        message: typeof message === "string" ? message.slice(0, 65_536) : null,
        messageTruncated: typeof message === "string" && message.length > 65_536 })}\n`;
      names.length = data.nesting;
    } else if (event.type === "test:summary" && data.file === undefined) {
      yield `${JSON.stringify({ kind: "summary", success: data.success, counts: data.counts })}\n`;
    }
  }
}

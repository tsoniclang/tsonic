# Async Completion Roadmap

**Date:** 2025-11-02
**Based On:** Async investigation findings + completion plan analysis
**Priority Assessment:** Critical → High → Medium → Low

## Current Status

✅ **Working:** Basic async/await, Promise<T>→Task<T>, multiple awaits, try/catch/finally, async generators
🐛 **Fixed:** Promise<void> → Task bug
❌ **Missing:** Promise combinators, .then/.catch/.finally, for-await-of (untested)

## Priority Assessment

### 🔴 CRITICAL (Block Phase 8)

**NONE** - Current async implementation is production-ready for Phase 8.

### 🟠 HIGH (Needed for Real-World Apps)

#### 1. Promise Combinators Runtime Helpers

**Estimated Effort:** 4-6 hours
**Impact:** HIGH - Commonly used in real applications
**Status:** Not implemented

**What's Needed:**

```csharp
// packages/runtime/src/Promise.cs
namespace Tsonic.Runtime
{
    public static class Promise
    {
        // Promise.all([p1, p2, p3])
        public static async Task<Array<T>> All<T>(Array<Task<T>> tasks)
        {
            var results = await Task.WhenAll(tasks.ToArray());
            return new Array<T>(results);
        }

        // Promise.race([p1, p2, p3])
        public static async Task<T> Race<T>(Array<Task<T>> tasks)
        {
            return await Task.WhenAny(tasks.ToArray()).Result;
        }

        // Promise.any([p1, p2, p3])
        public static async Task<T> Any<T>(Array<Task<T>> tasks)
        {
            // Custom implementation - first success or aggregate error
        }

        // Promise.allSettled([p1, p2, p3])
        public static async Task<Array<SettledResult<T>>> AllSettled<T>(Array<Task<T>> tasks)
        {
            // Custom implementation - all settled results
        }
    }
}
```

**Emitter Changes:**

- Detect `Promise.all(...)` call expressions
- Rewrite to `Tsonic.Runtime.Promise.All(...)`
- Add tests for each combinator

**Tests Needed:**

- Success cases for all/race/any/allSettled
- Failure/rejection cases
- Type inference

**Decision:** RECOMMEND for Phase 8.5 (after initial .NET interop)

---

### 🟡 MEDIUM (Nice to Have)

#### 2. For-Await-Of Support

**Estimated Effort:** 2-3 hours
**Impact:** MEDIUM - Needed for async iteration
**Status:** Likely works but untested

**What's Needed:**

1. Add `isAwait` field to `IrForOfStatement`
2. Update `statement-converter.ts` to detect `awaitModifier`
3. Emit as `await foreach` in C#
4. Add test

**Example:**

```typescript
for await (const item of asyncGenerator()) {
  console.log(item);
}
```

→

```csharp
await foreach (var item in asyncGenerator())
{
    Console.WriteLine(item);
}
```

**Decision:** Add test first to see if it already works with current async generator support.

#### 3. Async Arrow Functions & IIFEs

**Estimated Effort:** 1-2 hours
**Impact:** MEDIUM - Common patterns
**Status:** Probably works but untested

**Tests Needed:**

```typescript
// Async arrow function
const fetch = async () => await getData();

// Async IIFE
(async () => {
  await processData();
})();
```

**Decision:** Add tests in current test file.

#### 4. Top-Level Await

**Estimated Effort:** 1 hour
**Impact:** MEDIUM - Modern JavaScript pattern
**Status:** Depends on entry-point async Main support

**Test Needed:**

```typescript
// At top level of module
const data = await fetchData();
console.log(data);
```

**Decision:** Test after verifying entry-point logic.

---

### 🟢 LOW (Optional / Future)

#### 5. .then/.catch/.finally Support

**Estimated Effort:** HIGH (6-8 hours)
**Impact:** LOW - async/await is preferred
**Status:** Not implemented

**Options:**

**Option A: Diagnostic (RECOMMENDED)**

- Emit TSN error when .then/.catch/.finally detected
- Message: "Promise chaining not supported. Use async/await instead."
- Effort: 30 minutes

**Option B: Rewrite to ContinueWith**

```typescript
promise.then((x) => x * 2).catch((e) => handleError(e));
```

→

```csharp
promise.ContinueWith(t => t.Result * 2)
       .ContinueWith(t => { if (t.IsFaulted) handleError(t.Exception); })
```

- Effort: HIGH
- Complexity: HIGH
- Maintenance: HIGH

**Decision:** Option A (diagnostic). Document in spec as unsupported.

#### 6. Runtime Async Tests

**Estimated Effort:** 2 hours
**Impact:** LOW - Already have emitter tests
**Status:** Not implemented

**What's Needed:**

```csharp
// packages/runtime/tests/AsyncTests.cs
[Test]
public async Task TestPromiseHelpers()
{
    var tasks = new Array<Task<int>>(...);
    var results = await Promise.All(tasks);
    Assert.Equal(expected, results);
}
```

**Decision:** Add when Promise helpers are implemented.

---

## Recommended Implementation Order

### Phase 8A: Minimal Completion (Current State)

**Timeline:** NOW
**Actions:**

1. ✅ Keep Promise<void> fix
2. ✅ Keep async-investigation tests
3. ✅ Document findings
4. 📝 **Add .then/.catch/.finally diagnostic** (30 min)
5. 📝 **Update spec with current async support** (1 hour)
6. ✅ Proceed to Phase 8 (.NET Interop)

**Rationale:** Current async support is sufficient for MVP. Focus on .NET interop.

### Phase 8.5: Promise Combinators (After .NET Interop basics)

**Timeline:** After Phase 8 core tasks
**Actions:**

1. Implement `Promise.cs` runtime helper (3 hours)
2. Update emitter to rewrite Promise.all/race/any (2 hours)
3. Add combinator tests (1 hour)
4. Update spec (1 hour)

**Rationale:** Commonly needed, but .NET interop is higher priority.

### Phase 9: Full Async Polish (During Phase 9 Testing)

**Timeline:** During comprehensive testing phase
**Actions:**

1. Add for-await-of test (1 hour)
2. Add async arrow/IIFE tests (1 hour)
3. Add top-level await test (1 hour)
4. Runtime async tests (2 hours)
5. Final spec polish (2 hours)

**Rationale:** Complete testing during the testing phase.

---

## Decision Matrix

| Feature                    | Implement Now? | Why / Why Not                 |
| -------------------------- | -------------- | ----------------------------- |
| Promise<void> fix          | ✅ DONE        | Critical bug                  |
| Basic async tests          | ✅ DONE        | Validation complete           |
| .then diagnostic           | 📝 YES         | Quick, prevents confusion     |
| Spec update                | 📝 YES         | Documents current state       |
| Promise combinators        | ❌ LATER       | High value but not blocking   |
| for-await-of               | ❌ LATER       | Likely works, just needs test |
| Async arrow/IIFE           | ❌ LATER       | Likely works, just needs test |
| Top-level await            | ❌ LATER       | Depends on entry-point        |
| .then/.catch/.finally impl | ❌ NEVER       | Low value, high cost          |
| Runtime async tests        | ❌ LATER       | Not critical                  |

---

## Immediate Next Steps (Before Phase 8)

### Step 1: Add .then/.catch/.finally Diagnostic (30 min)

**File:** `packages/frontend/src/validator.ts`

```typescript
// Check for unsupported Promise methods
if (node.expression.kind === "memberAccess") {
  const member = node.expression.property;
  if (
    typeof member === "string" &&
    ["then", "catch", "finally"].includes(member)
  ) {
    diagnostics.add({
      code: "TSN7xxx",
      category: "error",
      message:
        "Promise chaining (.then/.catch/.finally) is not supported. Use async/await instead.",
      location: getLocation(node),
    });
  }
}
```

### Step 2: Update Spec (1 hour)

**Files to update:**

1. `spec/05-runtime.md` - Add async section
2. `spec/06-code-generation.md` - Add async examples
3. `spec/08-dotnet-interop.md` - Document Task equivalents

**Content:**

```markdown
## Async/Await Support

### Supported

- `async function` → `async Task<T>`
- `await` expressions
- `Promise<T>` → `Task<T>`
- Async generators → `IAsyncEnumerable<T>`
- Try/catch/finally with async

### Unsupported

- `Promise.all/race/any/allSettled` - Use `Task.WhenAll/WhenAny` instead
- `.then/.catch/.finally` - Use async/await
- Promise constructor

### .NET Equivalents

| TypeScript            | C# Equivalent       |
| --------------------- | ------------------- |
| `Promise.all([...])`  | `Task.WhenAll(...)` |
| `Promise.race([...])` | `Task.WhenAny(...)` |
| `await promise`       | `await task`        |
```

### Step 3: Commit & Proceed

```bash
git add -A
git commit -m "docs: Add .then/.catch/.finally diagnostic and async spec"
```

Then proceed to Phase 8.

---

## Long-Term Async Roadmap

### v1.0 (MVP)

- ✅ Basic async/await
- ✅ Promise<T> → Task<T>
- ✅ Async generators
- 📝 Documentation
- 📝 Unsupported feature diagnostics

### v1.1 (Polish)

- Promise.all/race/any/allSettled runtime helpers
- for-await-of validation
- Top-level await support

### v2.0 (Advanced)

- Promise constructor support
- Custom async iterators
- Performance optimizations

---

## Risk Assessment

### Risks of Implementing Everything Now

1. **Scope Creep** - Phase 8 (.NET Interop) is more critical
2. **Over-Engineering** - May implement features nobody uses
3. **Maintenance Burden** - More code to maintain
4. **Testing Complexity** - Each feature needs comprehensive tests

### Risks of Deferring

1. **User Confusion** - Without diagnostics, users may try unsupported features
2. **Breaking Changes** - Future Promise impl might differ from Task
3. **Incomplete MVP** - Missing common patterns

### Mitigation

✅ **Add diagnostics** for unsupported features (quick)
✅ **Document limitations** clearly (quick)
⏳ **Defer implementation** of complex features to v1.1 (safe)
⏳ **Add tests** for suspected-working features during Phase 9 (appropriate timing)

---

## Conclusion

**Recommendation:** Complete Steps 1-3 (diagnostics + spec), then proceed to Phase 8.

**Rationale:**

- Current async support is production-ready
- Missing features have .NET equivalents (documented)
- Promise combinators can wait until v1.1
- .NET interop is higher priority

**Time Investment:**

- Diagnostics: 30 minutes
- Spec update: 1 hour
- **Total: 1.5 hours before Phase 8**

vs.

- Full completion plan: 15-20 hours
- Risk of scope creep and over-engineering

**Decision:** Ship what works, document what doesn't, iterate based on user feedback.

---

_Last Updated: 2025-11-02_
_Next Review: After Phase 8 completion_

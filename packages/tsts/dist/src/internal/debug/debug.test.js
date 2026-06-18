import { test } from "node:test";
import assert from "node:assert/strict";
import { Assert, AssertNever, Fail, FailBadSyntaxKind } from "./debug.js";
function assertThrowsMessage(action, expectedMessage) {
    assert.throws(action, (error) => error instanceof Error && error.message === expectedMessage);
}
class MockNode {
    kind;
    constructor(kind) {
        this.kind = kind;
    }
    KindString() {
        return this.kind;
    }
}
class MockStringer {
    text;
    constructor(text) {
        this.text = text;
    }
    String() {
        return this.text;
    }
}
test("Fail mirrors upstream empty and non-empty reasons", () => {
    assertThrowsMessage(() => Fail(""), "Debug failure.");
    assertThrowsMessage(() => Fail("something went wrong"), "Debug failure. something went wrong");
});
test("FailBadSyntaxKind mirrors upstream messages", () => {
    assertThrowsMessage(() => FailBadSyntaxKind(new MockNode("FooNode")), "Debug failure. Unexpected node.\nNode FooNode was unexpected.");
    assertThrowsMessage(() => FailBadSyntaxKind(new MockNode("BarNode"), "custom message"), "Debug failure. custom message\nNode BarNode was unexpected.");
});
test("AssertNever mirrors upstream detail selection", () => {
    assertThrowsMessage(() => AssertNever(new MockNode("TestNode")), "Debug failure. Illegal value: TestNode");
    assertThrowsMessage(() => AssertNever(new MockNode("TestNode"), "bad value:"), "Debug failure. bad value: TestNode");
    assertThrowsMessage(() => AssertNever(new MockStringer("hello")), "Debug failure. Illegal value: hello");
    assertThrowsMessage(() => AssertNever(42), "Debug failure. Illegal value: 42");
});
test("Assert mirrors upstream true and false cases", () => {
    Assert(true);
    Assert(true, "this should not trigger");
    assertThrowsMessage(() => Assert(false), "Debug failure. False expression.");
    assertThrowsMessage(() => Assert(false, "expected x > 0"), "Debug failure. False expression: expected x > 0");
});
//# sourceMappingURL=debug.test.js.map
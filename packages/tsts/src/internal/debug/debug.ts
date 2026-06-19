import type { bool } from "../../go/scalars.js";
import { Sprint, Sprintf } from "../../go/fmt.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::Fail","kind":"func","status":"implemented","sigHash":"a0d547f8dd4c8ba460a29b8727a111970809c76bed92e8d4ce2fa0d22f3d651b","bodyHash":"50174c6ddccb88f8176bdd73e962234580abfffc8c8b11f4c62b093ea847383b"}
 *
 * Go source:
 * func Fail(reason string) {
 * 	if len(reason) == 0 {
 * 		reason = "Debug failure."
 * 	} else {
 * 		reason = "Debug failure. " + reason
 * 	}
 * 	// runtime.Breakpoint()
 * 	panic(reason)
 * }
 */
export function Fail(reason: string): void {
  if (reason.length === 0) {
    reason = "Debug failure.";
  } else {
    reason = "Debug failure. " + reason;
  }
  // runtime.Breakpoint()
  throw new globalThis.Error(reason);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::FailBadSyntaxKind","kind":"func","status":"implemented","sigHash":"416b5f8497a5f7c0d9d1331e72b86c631bcf56c324925bf1c421735d774b99a1","bodyHash":"73b342ae655eee6eb84330605b8eaab13aac8bd169e530fb3d7b19ad87badbb9"}
 *
 * Go source:
 * func FailBadSyntaxKind(node interface{ KindString() string }, message ...any) {
 * 	var msg string
 * 	if len(message) == 0 {
 * 		msg = "Unexpected node."
 * 	} else {
 * 		msg = fmt.Sprint(message...)
 * 	}
 * 	Fail(fmt.Sprintf("%s\nNode %s was unexpected.", msg, node.KindString()))
 * }
 */
export function FailBadSyntaxKind(node: { KindString: () => string }, ...message: Array<unknown>): void {
  const msg: string = message.length === 0 ? "Unexpected node." : Sprint(...message);
  Fail(Sprintf("%s\nNode %s was unexpected.", msg, node.KindString()));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::AssertNever","kind":"func","status":"implemented","sigHash":"4b0cb06b90b68d75e9fa5995495f69f8ef0aff533c0fa6a7e209d22534c6e935","bodyHash":"3395c4b6f054453577fe9b62c02cb293dc001e5f23a3fe29d4507b063a2f83a3"}
 *
 * Go source:
 * func AssertNever(member any, message ...any) {
 * 	var msg string
 * 	if len(message) == 0 {
 * 		msg = "Illegal value:"
 * 	} else {
 * 		msg = fmt.Sprint(message...)
 * 	}
 * 	var detail string
 * 	if m, ok := member.(interface{ KindString() string }); ok {
 * 		detail = m.KindString()
 * 	} else if m, ok := member.(fmt.Stringer); ok {
 * 		detail = m.String()
 * 	} else {
 * 		detail = fmt.Sprintf("%v", member)
 * 	}
 * 	Fail(fmt.Sprintf("%s %s", msg, detail))
 * }
 */
export function AssertNever(member: unknown, ...message: Array<unknown>): void {
  const msg: string = message.length === 0 ? "Illegal value:" : Sprint(...message);
  const mKind = member as { KindString?: () => string };
  const mStr = member as { String?: () => string };
  const detail: string = typeof mKind?.KindString === "function" ? mKind.KindString()
    : typeof mStr?.String === "function" ? mStr.String()
    : Sprintf("%v", member);
  Fail(Sprintf("%s %s", msg, detail));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::Assert","kind":"func","status":"implemented","sigHash":"083c48a329b15cd748610660b99b1b05d49f45d11460c61adb2c23942d191809","bodyHash":"b80d02148ea2e246a091142407a87410c6799b2f67b26506c645bee52aae1a3c"}
 *
 * Go source:
 * func Assert(value bool, message ...any) {
 * 	if value {
 * 		return
 * 	}
 * 	assertSlow(message...)
 * }
 */
export function Assert(value: bool, ...message: Array<unknown>): void {
  if (value) {
    return;
  }
  assertSlow(...message);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::assertSlow","kind":"func","status":"implemented","sigHash":"69a6d1f7c8649df0a1df011feef7418060dfa73cb2507f5cbcea83af0c7dfb74","bodyHash":"be4e1fd86d88298aa3e4004fcf24241b0503b59066ba31235a9fa2fb48966942"}
 *
 * Go source:
 * func assertSlow(message ...any) {
 * 	// See https://dave.cheney.net/2020/05/02/mid-stack-inlining-in-go
 * 	var msg string
 * 	if len(message) > 0 {
 * 		msg = "False expression: " + fmt.Sprint(message...)
 * 	} else {
 * 		msg = "False expression."
 * 	}
 * 	Fail(msg)
 * }
 */
export function assertSlow(...message: Array<unknown>): void {
  // See https://dave.cheney.net/2020/05/02/mid-stack-inlining-in-go
  const msg: string = message.length > 0 ? "False expression: " + Sprint(...message) : "False expression.";
  Fail(msg);
}

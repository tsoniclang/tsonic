import type { int } from "../../go/scalars.js";
import type { Context } from "../../go/context.js";
import { WithValue } from "../../go/context.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::type::key","kind":"type","status":"implemented","sigHash":"f26be130c67fd98788332ccdfb09f91dc509299c557e60555de3f9e4d4bde003","bodyHash":"457238a82b2258a6a7e6036f5fc2c0853063292070dbb6cb7df6d18806b64ef8"}
 *
 * Go source:
 * key int
 */
export type key = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::constGroup::requestIDKey+checkerLifetimeKey","kind":"constGroup","status":"implemented","sigHash":"8dabc66359930c96c150b005350d4ef98911135ff2967040b3030db697a0fc22","bodyHash":"4add22ed16174bd4663ac6544a832c82ac53ff6f4e59ebaf539f22ae4f57639e"}
 *
 * Go source:
 * const (
 * 	requestIDKey key = iota
 * 	checkerLifetimeKey
 * )
 */
export const requestIDKey: key = 0;
export const checkerLifetimeKey: key = 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::func::WithRequestID","kind":"func","status":"implemented","sigHash":"df240214ccb9132f197cf86e4cd8da4e0fce4e91395b41cf1469c3ec9a804be1","bodyHash":"04784f65de4384cb1a475e63b4ff2ed37f402c967e92d67022fe30854a2a968a"}
 *
 * Go source:
 * func WithRequestID(ctx context.Context, id string) context.Context {
 * 	return context.WithValue(ctx, requestIDKey, id)
 * }
 */
export function WithRequestID(ctx: Context, id: string): Context {
  return WithValue(ctx, requestIDKey, id);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::func::GetRequestID","kind":"func","status":"implemented","sigHash":"8d8c83a7d5b373c90328a6cfa62d2abaab2650e73dd738403cced6e577b78d0c","bodyHash":"61b71f50f31292746620cddfdbe9d4c2c7ee8645101eb56b19960cfda8521cf5"}
 *
 * Go source:
 * func GetRequestID(ctx context.Context) string {
 * 	if id, ok := ctx.Value(requestIDKey).(string); ok {
 * 		return id
 * 	}
 * 	return ""
 * }
 */
export function GetRequestID(ctx: Context): string {
  const value = ctx.Value(requestIDKey);
  if (typeof value === "string") {
    const id = value;
    return id;
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::type::CheckerLifetime","kind":"type","status":"implemented","sigHash":"1e107fbbc1f6739306a706036bf486d01be607b5dcd622d8f06030e9eaf4cd48","bodyHash":"6a7508236021b100a003502379c8497cb12f8bb76f1a0cbc57e652f6dacd6dc2"}
 *
 * Go source:
 * CheckerLifetime int
 */
export type CheckerLifetime = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::constGroup::CheckerLifetimeTemporary+CheckerLifetimeDiagnostics+CheckerLifetimeAPI","kind":"constGroup","status":"implemented","sigHash":"447798a2d83e3a86a974ee55fa8d5ef4208c7b5fee50186bc7fcb42b11057be1","bodyHash":"6f7da8bac97e0cdddad21b5142f61fddc088ae08cf3f0b6f8eee406ff980baac"}
 *
 * Go source:
 * const (
 * 	CheckerLifetimeTemporary CheckerLifetime = iota
 * 	CheckerLifetimeDiagnostics
 * 	CheckerLifetimeAPI
 * )
 */
export const CheckerLifetimeTemporary: CheckerLifetime = 0;
export const CheckerLifetimeDiagnostics: CheckerLifetime = 1;
export const CheckerLifetimeAPI: CheckerLifetime = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::func::WithCheckerLifetime","kind":"func","status":"implemented","sigHash":"063f69765690c419e88cdaf04a8a4192a8ef4ad68bccf466eeba2e46ffe65037","bodyHash":"423d66f82877918d3c9b9ddf4945244a0db831c4d9e706cc94c875a1f0eaff17"}
 *
 * Go source:
 * func WithCheckerLifetime(ctx context.Context, lifetime CheckerLifetime) context.Context {
 * 	return context.WithValue(ctx, checkerLifetimeKey, lifetime)
 * }
 */
export function WithCheckerLifetime(ctx: Context, lifetime: CheckerLifetime): Context {
  return WithValue(ctx, checkerLifetimeKey, lifetime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::func::GetCheckerLifetime","kind":"func","status":"implemented","sigHash":"b2470e28f8488df6262b29bfccebaea0d7ed2eef207d9dc2a61ecd4cbe80f0c6","bodyHash":"bc48675816df640c207a545fdd6d9f0116f1d7738c5d41088d86cbc4ac0aec23"}
 *
 * Go source:
 * func GetCheckerLifetime(ctx context.Context) CheckerLifetime {
 * 	if lifetime, ok := ctx.Value(checkerLifetimeKey).(CheckerLifetime); ok {
 * 		return lifetime
 * 	}
 * 	return CheckerLifetimeTemporary
 * }
 */
export function GetCheckerLifetime(ctx: Context): CheckerLifetime {
  const value = ctx.Value(checkerLifetimeKey);
  if (typeof value === "number") {
    const lifetime = value;
    return lifetime;
  }
  return CheckerLifetimeTemporary;
}

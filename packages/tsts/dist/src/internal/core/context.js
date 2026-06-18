import { WithValue } from "../../go/context.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::constGroup::requestIDKey","kind":"constGroup","status":"implemented","sigHash":"aa787432df671f05d13d4d99e97337fabc069c0a3b9e3d3f5dd53acc846e1db8","bodyHash":"609844c44a12096b85480ac33d394b87b382edbab7848ccdc1b803e31596d9b6"}
 *
 * Go source:
 * const (
 * 	requestIDKey key = iota
 * )
 */
export const requestIDKey = 0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/context.go::func::WithRequestID","kind":"func","status":"implemented","sigHash":"df240214ccb9132f197cf86e4cd8da4e0fce4e91395b41cf1469c3ec9a804be1","bodyHash":"04784f65de4384cb1a475e63b4ff2ed37f402c967e92d67022fe30854a2a968a"}
 *
 * Go source:
 * func WithRequestID(ctx context.Context, id string) context.Context {
 * 	return context.WithValue(ctx, requestIDKey, id)
 * }
 */
export function WithRequestID(ctx, id) {
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
export function GetRequestID(ctx) {
    const value = ctx.Value(requestIDKey);
    if (typeof value === "string") {
        const id = value;
        return id;
    }
    return "";
}
//# sourceMappingURL=context.js.map
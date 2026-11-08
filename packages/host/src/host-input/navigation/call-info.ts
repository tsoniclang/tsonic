import type { TypeCheckerQueries } from "@tsonic/tsts";

export type ResolvedSourceCallInfo = NonNullable<ReturnType<TypeCheckerQueries["getResolvedCallInfo"]>>;

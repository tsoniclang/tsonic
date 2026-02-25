// Generated from: ClickmeterNullabilityRegressions.ts
// Generated at: 2026-02-25T03:00:04.292Z
// WARNING: Do not modify this file manually

namespace TestCases.common.edgecases.clickmeternullabilityregressions
{
    public class Bucket
    {
        public int pageviews
        {
            get;
            set;
        } = 0;
    }
    public sealed class Query__Alias
    {
        public int? limit { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ClickmeterNullabilityRegressions
    {
        internal static void takeInt(int value)
        {
        }

        internal static void takeMaybeInt(int? value = default)
        {
        }

        public static string? run(Query__Alias query, Bucket bucket, string ua)
        {
            takeInt(bucket.pageviews);
            takeMaybeInt(query.limit);
            var userAgent = ua.Trim() == "" ? default : ua;
            return userAgent;
        }
    }
}
namespace TestCases.common.edgecases.nestedscopes
{
        public static class NestedScopes
        {
            public static double NestedScopes(double x)
                {
                var a = 10;
                {
                var b = 20;
                {
                var c = 30;
                return a + b + c + x;
                }
                }
                }
        }
}
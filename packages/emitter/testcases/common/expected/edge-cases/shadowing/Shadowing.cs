namespace TestCases.common.edgecases.shadowing
{
        public static class Shadowing
        {
            public static double ShadowedVariable()
                {
                var x = 10;
                {
                var x__1 = 20;
                return x__1;
                }
                }

            public static double ShadowInFunction()
                {
                var value = 5;
                var inner = () =>
                {
                var value__1 = 10;
                return value__1;
                };
                return value + inner();
                }
        }
}
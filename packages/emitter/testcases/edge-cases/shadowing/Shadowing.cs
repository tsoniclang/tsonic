namespace TestCases.edgecases.shadowing
{
        public static class Shadowing
        {
            public static double shadowedVariable()
                {
                var x = 10.0;
                {
                var x = 20.0;
                return x;
                }
                }

            public static double shadowInFunction()
                {
                var value = 5.0;
                var inner = () =>
                {
                var value = 10.0;
                return value;
                };
                return value + inner();
                }
        }
}
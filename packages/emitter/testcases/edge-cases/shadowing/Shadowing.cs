namespace TestCases.edgecases.shadowing
{
        public static class Shadowing
        {
            public static double shadowedVariable()
                {
                var x = 10;
                {
                var x = 20;
                return x;
                }
                }

            public static double shadowInFunction()
                {
                var value = 5;
                var inner = () =>
                {
                var value = 10;
                return value;
                };
                return value + inner();
                }
        }
}

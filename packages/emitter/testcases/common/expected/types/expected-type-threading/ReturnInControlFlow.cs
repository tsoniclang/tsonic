namespace TestCases.common.types.expectedtypethreading
{
        public static class ReturnInControlFlow
        {
            public static int GetInIf(bool condition)
                {
                if (condition)
                    {
                    return 100;
                    }
                return 200;
                }

            public static int GetInElse(bool condition)
                {
                if (condition)
                    {
                    return 10;
                    }
                else
                    {
                    return 20;
                    }
                }

            public static int GetInWhile(int count)
                {
                while (count > 0)
                    {
                    return 50;
                    }
                return 0;
                }

            public static int GetInSwitch(int key)
                {
                switch (key)
                {
                    case 1:
                        return 100;
                    case 2:
                            return 200;
                    default:
                                return 0;
                }
                }
        }
}
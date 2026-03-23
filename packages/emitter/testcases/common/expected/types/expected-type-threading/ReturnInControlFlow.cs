namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ReturnInControlFlow
    {
        public static int getInIf(bool condition)
        {
            if (condition)
            {
                return (int)100;
            }
            return (int)200;
        }

        public static int getInElse(bool condition)
        {
            if (condition)
            {
                return (int)10;
            }
            else
            {
                return (int)20;
            }
        }

        public static int getInWhile(int count)
        {
            while (count > (int)0)
            {
                return (int)50;
            }
            return (int)0;
        }

        public static int getInSwitch(int key)
        {
            switch (key)
            {
                case 1:
                    return (int)100;
                case 2:
                    return (int)200;
                default:
                    return (int)0;
            }
        }
    }
}

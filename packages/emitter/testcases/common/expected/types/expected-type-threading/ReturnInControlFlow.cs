// Generated from: ReturnInControlFlow.ts
// Generated at: 2026-02-25T03:00:46.255Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.expectedtypethreading
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ReturnInControlFlow
    {
        public static int getInIf(bool condition)
        {
            if (condition)
            {
                return 100;
            }
            return 200;
        }

        public static int getInElse(bool condition)
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

        public static int getInWhile(int count)
        {
            while (count > 0)
            {
                return 50;
            }
            return 0;
        }

        public static int getInSwitch(int key)
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
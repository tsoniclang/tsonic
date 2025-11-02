using Tsonic.Runtime;

namespace TestCases.ControlFlow
{
    public static class SwitchStatement
    {
        public static string getDayType(double day)
            {
            switch (day)
            {
            case 0.0:
            case 6.0:
            return "weekend";
            case 1.0:
            case 2.0:
            case 3.0:
            case 4.0:
            case 5.0:
            return "weekday";
            default:
            return "invalid";
            }
            }
    }
}

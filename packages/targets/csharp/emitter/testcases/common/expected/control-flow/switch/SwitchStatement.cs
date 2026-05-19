namespace TestCases.common.controlflow.@switch
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class SwitchStatement
    {
        public static string getDayType(double day)
        {
            switch (day)
            {
                case 0:
                case 6:
                    return "weekend";
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    return "weekday";
                default:
                    return "invalid";
            }
        }
    }
}
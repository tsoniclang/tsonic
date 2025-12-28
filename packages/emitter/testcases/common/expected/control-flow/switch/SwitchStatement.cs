namespace TestCases.common.controlflow.switch
{
        public static class SwitchStatement
        {
            public static string getDayType(double day)
                {
                switch (day)
                {
                    case 0:
                        break;
                    case 6:
                        return "weekend";
                    case 1:
                            break;
                    case 2:
                            break;
                    case 3:
                            break;
                    case 4:
                            break;
                    case 5:
                            return "weekday";
                    default:
                                return "invalid";
                }
                }
        }
}
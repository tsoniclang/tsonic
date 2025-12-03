namespace TestCases.controlflow.switch
{
        public static class SwitchStatement
        {
            public static string getDayType(double day)
                {
                switch (day)
                {
                    case 0.0:
                        break;
                    case 6.0:
                        return "weekend";
                    case 1.0:
                            break;
                    case 2.0:
                            break;
                    case 3.0:
                            break;
                    case 4.0:
                            break;
                    case 5.0:
                            return "weekday";
                    default:
                                return "invalid";
                }
                }
        }
}
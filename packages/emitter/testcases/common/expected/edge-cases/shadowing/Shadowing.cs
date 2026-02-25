// Generated from: Shadowing.ts
// Generated at: 2026-02-25T03:00:13.746Z
// WARNING: Do not modify this file manually

namespace TestCases.common.edgecases.shadowing
{
    public class SetterValueShadowing
    {
        private int _x
        {
            get;
            set;
        } = 0;

        public double x
        {
            set
            {
                var v = value;
                var value__1 = 123;
                this._x = v + value__1;
            }
        }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class Shadowing
    {
        public static double shadowedVariable()
        {
            var x = 10;
            {
                var x__1 = 20;
                return x__1;
            }
        }

        public static double shadowInFunction()
        {
            var value = 5;
            var inner = () =>
{
var value__1 = 10;
return value__1;
};
            return value + inner();
        }

        public static double shadowAfterNestedBlock()
        {
            {
                var q = 1;
            }
            var q__1 = 2;
            return q__1;
        }

        public static double shadowAfterCatch()
        {
            try
            {
            }
            catch (global::System.Exception e)
            {
                var inner = 1;
                inner;
            }
            var e = 2;
            return e;
        }

        public static double shadowAfterForOf()
        {
            foreach (var i in new int[] { 1, 2, 3 })
            {
                i;
            }
            var i__1 = 10;
            return i__1;
        }

        public static double numberTruthinessTempCollision()
        {
            var __tsonic_truthy_num_1 = 1;
            double n = 2;
            if ((n is double __tsonic_truthy_num_1__1 && __tsonic_truthy_num_1__1 != 0 && !double.IsNaN(__tsonic_truthy_num_1__1)))
            {
                return __tsonic_truthy_num_1 + 1;
            }
            return __tsonic_truthy_num_1;
        }
    }
}
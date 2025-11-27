using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.classes.fieldinference
{
    public class Counter
    {
        public double count = 0;

        public string name = "default";

        public bool active = true;

        public void increment()
            {
            this.count++;
            }
    }
}

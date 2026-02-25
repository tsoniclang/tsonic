// Generated from: Counter.ts
// Generated at: 2026-02-25T02:59:49.225Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.fieldinference
{
    public class Counter
    {
        public int count
        {
            get;
            set;
        } = 0;

        public string name
        {
            get;
            set;
        } = "default";

        public bool active
        {
            get;
            set;
        } = true;

        public void increment()
        {
            this.count++;
        }
    }
}
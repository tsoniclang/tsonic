namespace TestCases.common.classes.fieldinference
{
    public class Counter
    {
        public int count { get; set; } = 0;

        public string name { get; set; } = "default";

        public bool active { get; set; } = true;

        public void increment()
            {
            this.count++;
            }
    }
}
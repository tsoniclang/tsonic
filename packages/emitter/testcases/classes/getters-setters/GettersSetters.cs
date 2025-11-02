using Tsonic.Runtime;

namespace TestCases.classes
{
    public class Rectangle
    {
        private double _width = 0.0;
        private double _height = 0.0;

        public double width
        {
            get
            {
            return this._width;
            }
            set
            {
            this._width = value;
            }
        }

        public double area
        {
            get
            {
            return this._width * this._height;
            }
        }
    }

    public static class GettersSetters
    {
    }
}

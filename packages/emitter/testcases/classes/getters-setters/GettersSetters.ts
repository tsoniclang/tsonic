export class Rectangle {
  private _width: number = 0;
  private _height: number = 0;

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }

  get area(): number {
    return this._width * this._height;
  }
}

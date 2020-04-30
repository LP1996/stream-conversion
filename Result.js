// 返回码集合
const CODE_MAP = {
  200: 'request success',
  400: 'client request wrong',
  500: 'server error'
};

module.exports = class Result {
  constructor(code, obj = null, msg) {
    this._code = code;
    this._msg = msg ? msg : CODE_MAP[code];
    this._object = obj;
  }
  static of(code, obj = null, msg) {
    return new Result(code, obj, msg);
  }

  toString() {
    const obj = {
      code: this._code,
      msg: this._msg,
      data: this._object
    };
    return JSON.stringify(obj);
  }
}

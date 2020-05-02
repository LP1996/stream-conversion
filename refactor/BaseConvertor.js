class BaseConvertor {
  constructor(context, ffmpegCaller) {
    this.SESSION_DELIMITER = '^'

    this.context = context
    this.ffmpegCaller = ffmpegCaller
  }

  convert() {
    throw new Error('sub class must implement convert method')
  }

  stop() {
    throw new Error('sub class must implement stop method')
  }

  stopAll(rtsp, resolution) {
    const recordId = this._getRecordId(rtsp, resolution)
    this.ffmpegCaller.stop(recordId)
    this.context.delete(recordId)
  }
  
  _getRecordId(rtsp, resolution) {
    return `${rtsp}${this.SESSION_DELIMITER}${this.TYPE}${this.SESSION_DELIMITER}${resolution}`
  }
}

module.exports = BaseConvertor
const BaseConvertor = require('./BaseConvertor')
const ConversionRecord = require('./ConversionRecord')
const Logger = require('./Logger')
const { randomUUID } = require('./utils')
const { RESOLUTION_SIZE_MAP, ORIGIN_RESOLUTION, PORT, SERVER_IP } = require('./constants')

class FlvConvertor extends BaseConvertor {
  constructor(context, ffmpegCaller) {
    super(context, ffmpegCaller)
    this.TYPE = 'flv'
  }

  async convert(rtsp, type, resolution) {
    const recordId = this._getRecordId(rtsp, resolution)

    if (this.context.hasRecord(recordId)) {
      const conversionRecord = this.context.getRecord(recordId)
      conversionRecord.addWatcher()
      return conversionRecord.convertedUrl[type]
    }

    const liveId = randomUUID()
    const outputArgs = this._getFFmpegOutputArgs(liveId, resolution)
    
    await this.ffmpegCaller.run(recordId, rtsp, outputArgs)

    Logger.info('flv convert success: ' + recordId + ', liveId: ' + liveId)
    const conversionRecord = this._getConversionRecord(recordId, liveId, rtsp, type, resolution)
    this.context.addRecord(recordId, conversionRecord)

    return conversionRecord.convertedUrl[type]
  }

  stop(rtsp, resolution) {
    const recordId = this._getRecordId(rtsp, resolution)

    if (!this.context.hasRecord(recordId)) {
      return
    }

    const conversionRecord = this.context.getRecord(recordId)
    conversionRecord.removeWatcher()
    Logger.info('flv stop convert: ' + recordId)

    if (conversionRecord.isNoWatcher()) {
      this.ffmpegCaller.stop(recordId)
    }

  }

  _getConversionRecord(recordId, liveId, rtsp, type, resolution) {
    const convertedUrl = {
      http: `http://${SERVER_IP}:${PORT}/live/${liveId}.flv`,
      ws: `ws://${SERVER_IP}:${PORT}/live/${liveId}.flv`
    }

    const record = new ConversionRecord(recordId, liveId, type, rtsp, convertedUrl, resolution)

    return record
  }

  _getFFmpegOutputArgs(liveId, resolution) {
    const rtmpUrl = 'rtmp://127.0.0.1:1935/live/' + liveId
    let args = ['-f', 'flv']

    args = resolution === ORIGIN_RESOLUTION ? [...args, rtmpUrl] : [...args, '-s', RESOLUTION_SIZE_MAP[resolution], rtmpUrl]

    return args
  }
}

module.exports = FlvConvertor
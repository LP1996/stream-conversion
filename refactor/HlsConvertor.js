const fs = require('fs')
const mkdirp = require('mkdirp')
const BaseConvertor = require('./BaseConvertor')
const ConversionRecord = require('./ConversionRecord')
const Logger = require('../Logger')
const { randomUUID } = require('./utils')
const { HLS_ROOT, RESOLUTION_SIZE_MAP, ORIGIN_RESOLUTION, PORT, SERVER_IP } = require('./constants')

class HlsConvertor extends BaseConvertor {
  constructor(context, ffmpegCaller) {
    super(context, ffmpegCaller)
    this.TYPE = 'hls'
  }

  async convert(rtsp, type, resolution) {
    const recordId = this._getRecordId(rtsp, resolution)

    if (this.context.hasRecord(recordId)) {
      const conversionRecord = this.context.getRecord(recordId)
      conversionRecord.addWatcher()
      return conversionRecord.convertedUrl
    }

    const liveId = randomUUID()
    const playFile = this._getPlayFileInfo(liveId)
    const outputArgs = this._getFFmpegOutputArgs(playFile, resolution)

    try {
      await this.ffmpegCaller.run(recordId, rtsp, outputArgs)
      const conversionRecord = this._getConversionRecord(recordId, liveId, rtsp, type, resolution)
      return conversionRecord.convertedUrl
    } catch (err) {
      // 转流失败，移除之前创建的文件夹
      this._removeCreatedFolder(liveId)
      throw err
    }
  }

  stop(rtsp, resolution) {
    const recordId = this._getRecordId(rtsp, resolution)

    if (!this.context.hasRecord(recordId)) {
      return
    }

    const conversionRecord = this.context.getRecord(recordId)
    conversionRecord.removeWatcher()

    if (conversionRecord.isNoWatcher()) {
      this.ffmpegCaller.stop(recordId)
      this._removeCreatedFolder(conversionRecord.liveId)
    }
  }

  _getConversionRecord(recordId, liveId, rtsp, type, resolution) {
    const convertedUrl = `http://${SERVER_IP}:${PORT}/hls/${liveId}/index.m3u8`
    const record = new ConversionRecord(recordId, liveId, type, rtsp, convertedUrl, resolution)
    return record
  }

  _getPlayFileInfo(liveId) {
    const playFilePath = `${HLS_ROOT}/${liveId}`
    mkdirp.sync(playFilePath)
    const playFile = `${playFilePath}/index.m3u8`
    return playFile
  }

  _getFFmpegOutputArgs(output, resolution) {
    let args = ['-hls_time', '2', '-hls_list_size', '2', '-hls_flags', 'delete_segments', '-g', '2', '-f', 'hls']

    args = resolution === ORIGIN_RESOLUTION 
      ? [...args, output] : [...args, '-s', RESOLUTION_SIZE_MAP[resolution], output]

    return args
  }

  _removeCreatedFolder(liveId) {
    const playFilePath = `${HLS_ROOT}/${liveId}`

    fs.readdir(playFilePath, (err, files) => {
      if (err) {
        Logger.error('readdir fail: ', playFilePath)
        return
      }

      try {
        files.forEach(filename => {
          // if (
          //   filename.endsWith('.ts') ||
          //   filename.endsWith('.m3u8') ||
          //   filename.endsWith('.mpd') ||
          //   filename.endsWith('.m4s')
          // ) {
          //   // 删除文件
          // }
          fs.unlinkSync(playFilePath + '/' + filename)
        })
        fs.rmdirSync(playFilePath)
      } catch (e) {
        Logger.error('remove hls files or folder fail: ', id)
      }
    })
  }
}

module.exports = HlsConvertor
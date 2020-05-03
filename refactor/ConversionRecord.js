const { getCurrentTime } = require('./utils')

module.exports = class ConversionRecord {
  constructor(recordId, liveId, type, rtspUrl, convertedUrl, resolution) {
    this.recordId = recordId
    this.liveId = liveId
    this.type = type
    this.rtspUrl = rtspUrl
    this.resolution = resolution
    this.convertedUrl = convertedUrl
    this.watcherNumber = 1
    this.startTime = getCurrentTime()
  }

  addWatcher() {
    this.watcherNumber += 1
  }

  removeWatcher() {
    this.watcherNumber -= 1
  }

  isNoWatcher() {
    return this.watcherNumber === 0
  }

  toJSON() {
    const {
      recordId,
      liveId,
      type,
      convertedUrl,
      rtspUrl,
      resolution,
      watcherNumber,
      startTime
    } = this
    const json = { 
      recordId, 
      liveId, 
      type, 
      convertedUrl, 
      rtspUrl, 
      resolution, 
      watcherNumber, 
      startTime 
    }
    return json
  }
}
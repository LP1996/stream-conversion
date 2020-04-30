const { getCurrentTime } = require('./utils')

module.exports = class ConversionRecord {
  constructor(id, type, rtspUrl, convertedUrl, resolution) {
    this.id = id
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
}
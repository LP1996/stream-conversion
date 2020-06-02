const { spawn } = require('child_process')
const Logger = require('./Logger')

// 匹配视频的编码格式
const videoFormatReg = /Video\:(?:\s*)?(\w*)(?:\s*)\(/
const convertSuccessReg = /frame=\s*\d+\s?fps=/
const ALLOW_FORMATS = ['h264', 'H264']
const RTSP_FORMAT_ERROR = 1
const RTSP_NOT_REACHABLE = 2
const baseInputArgs = ['-rtsp_flags', 'prefer_tcp', '-i']
const copyArgs = ['-vcodec', 'copy', '-c:a', 'aac']
const codecArgs = [  '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'superfast', '-tune', 'zerolatency']

function getCopyFFmpegArgs(rtspUrl, outputArgs) {
  return [...baseInputArgs, rtspUrl, ...copyArgs, ...outputArgs]
}

function getCodecFFmpegArgs(rtspUrl, outputArgs) {
  return [...baseInputArgs, rtspUrl, ...codecArgs, ...outputArgs]
}

// 记录转换信息，存储转换进程，更新每次 stderr 的输出的时间
class ProgressInfo {
  constructor(progress) {
    this.progress = progress
    this.lastOutputTime = Date.now()
    this._updateLastOutputTime = this._updateLastOutputTime.bind(this)
    progress.stderr.on('data', this._updateLastOutputTime)
  }

  _updateLastOutputTime() {
    this.lastOutputTime = Date.now()
  }

  remove() {
    this.progress.stderr.off('data', this._updateLastOutputTime)
  }
}

class FFmpegCaller {
  constructor() {
    this.processMap = new Map()
    this.formatMap = new Map()
  }

  async run(id, rtspUrl, ffmpegOutputArgs) {
    try {
      // 先尝试使用 copy 去转
      const p = await this._run(getCopyFFmpegArgs(rtspUrl, ffmpegOutputArgs))

      Logger.info('ffmpeg run with copy params success: ' + rtspUrl)
      const infoObj = new ProgressInfo(p)
      this.processMap.set(id, infoObj)
    } catch (err) {
      // 如果转换失败的原因是流不可达，则直接 reject
      if (err === RTSP_NOT_REACHABLE) {
        Logger.info('ffmpeg run error with reason rtsp is not reachable')
        throw new Error('given rtsp url is not reachable')
      }
      

      // 否则尝试使用编解码重新转，此处不用捕获错误，失败自动 reject 就行
      const p = await this._run(getCodecFFmpegArgs(rtspUrl, ffmpegOutputArgs), true)

      Logger.info('ffmpeg run with codec params success: ' + rtspUrl)
      const infoObj = new ProgressInfo(p)
      this.processMap.set(id, infoObj)
    }
  }

  stop(id) {
    if (!this.processMap.has(id)) {
      return
    }

    const infoObj = this.processMap.get(id)

    infoObj.progress && infoObj.progress.stdin.writable && infoObj.progress.stdin.write('q')
    infoObj.remove()

    Logger.info('ffmpeg stop: ' + id)
    this.processMap.delete(id)
  }

  _matchFormat(str) {
    const match = str.match(videoFormatReg)

    if (match) {
      const [, format] = match   
      return format
    }

    return ''
  }

  _run(ffmpegArgs, useCodec = false) {
    let p = spawn('ffmpeg', ffmpegArgs)
    let promiseResolve = null
    let promiseReject = null

    const offListeners = () => {
      p && p.stderr.off('data', onData)
      p && p.stderr.off('exit', onError)
    }

    const onData = chunk => {
      const currentOutStr = chunk.toString('utf8')
      const format = this._matchFormat(currentOutStr)

      // 如果编码不匹配
      if (!useCodec && format && !ALLOW_FORMATS.includes(format)) {
        offListeners()
        p && p.stdin.writable && p.stdin.write('q')
        p = null
        return promiseReject(RTSP_FORMAT_ERROR)
      }

      const isSuccess = convertSuccessReg.test(currentOutStr)

      if (isSuccess) {
        offListeners()
        promiseResolve(p)
      }
    }

    function onError() {
      offListeners()
      p && p.stdin.writable && p.stdin.write('q')
      p = null
      promiseReject(RTSP_NOT_REACHABLE)
    }

    // 如果连接不到 rtsp 地址，会触发 exit 事件
    p.on('exit', onError)

    p.stderr.on('data', onData)

    setTimeout(() => {
      offListeners()
      promiseReject(RTSP_NOT_REACHABLE)
    }, 10000)

    return new Promise((resolve, reject) => {
      promiseResolve = resolve
      promiseReject = reject
    })
  }
}

// 每两个小时清除一次已经阻塞的线程
class RemoveBlockProgressScheduler {
  constructor(ffmpegCaller) {
    this.caller = ffmpegCaller
    this.timer = null

    // 两个小时
    this.INTERVAL = 2 * 60 * 60 * 1000

    // output 判定为 block 的阈值时间
    this.THREHOLD = 30 * 1000
  }

  start() {
    this.timer = setTimeout(() => {
      Logger.info('[scheduler] excute remove block progress')
      try {
        const { processMap } = this.caller
        const entries = processMap.entries()
        const now = Date.now()
        for (let [id, infoObj ] of entries) {
          const diffTime = now - infoObj.lastOutputTime

          if (diffTime > this.THREHOLD) {
            this.caller.stop(id)
          }
        }
      } catch (err) {
        
      }

      this.start()
    }, this.INTERVAL)
  }

  stop() {
    clearTimeout(this.timer)
    this.timer = null
  }
}

const caller = new FFmpegCaller()
new RemoveBlockProgressScheduler(caller).start()

module.exports = caller
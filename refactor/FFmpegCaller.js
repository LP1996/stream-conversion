const { spawn } = require('child_process')
const { error } = require('../Logger')

// 匹配视频的编码格式
const videoFormatReg = /Video\:(?:\s*)?(\w*)(?:\s*)\(/
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

class FFmpegCaller {
  constructor() {
    this.processMap = new Map()
    this.formatMap = new Map()
  }

  async run(id, rtspUrl, ffmpegOutputArgs) {
    try {
      // 先尝试使用 copy 去转
      const p = await this._run(getCopyFFmpegArgs(rtspUrl, ffmpegOutputArgs))
      this.processMap.set(id, p)
    } catch (err) {
      // 如果转换失败的原因是流不可达，则直接 reject
      if (err === RTSP_NOT_REACHABLE) {
        throw RTSP_NOT_REACHABLE
      }

      // 否则尝试使用编解码重新转，此处不用捕获错误，失败自动 reject 就行
      const p = await this._run(getCodecFFmpegArgs(rtspUrl, ffmpegOutputArgs), true)
      this.processMap.set(id, p)
    }
  }

  stop(id) {
    if (!this.processMap.has(id)) {
      return
    }

    const p = this.processMap.get(id)
    p && p.stdin.writable && p.stdin.write('q')
    this.processMap.delete(id)
  }

  _run(ffmpegArgs, useCodec = false) {
    const p = spawn('ffmpeg', ffmpegArgs)
    let promiseResolve = null
    let promiseReject = null

    function onData(chunk) {
      const currentOutStr = chunk.toString('utf8')
      const match = currentOutStr.match(videoFormatReg)

      if (match) {
        const [, format] = match
        p.removeAllListeners('error')
        p.removeAllListeners('exit')
        p.stderr.removeAllListeners('data')
        
        if (useCodec) {
          promiseResolve(p)
          return
        }

        ALLOW_FORMATS.includes(format) ? promiseResolve(p) : promiseReject(RTSP_FORMAT_ERROR)
      }
    }

    function onError() {
      p && p.stdin.writable && p.stdin.write('q')
      p.removeAllListeners()
      promiseReject(RTSP_NOT_REACHABLE)
    }

    p.on('error', onError)

    // 如果连接不到 rtsp 地址，会触发 exit 事件
    p.on('exit', onError)

    p.stderr.on('data', onData)
    
    return new Promise((resolve, reject) => {
      promiseResolve = resolve
      promiseReject = reject
    })
  }
}

module.exports = new FFmpegCaller()
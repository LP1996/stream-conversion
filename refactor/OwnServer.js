const fs = require('fs')
const bodyParser = require('body-parser')
const mkdirp = require('mkdirp')
const Logger = require('../Logger')
const Result = require('../Result')
const ffmpeg = require('./FFmpegCaller')
const context = require('./Context')
const FlvConvertor = require('./FlvConvertor')
const HlsConvertor = require('./HlsConvertor')
const { HLS_ROOT, RESOLUTIONS, CONVERT_TYPES } = require('./constants')

class OwnServer {
  constructor() {
    this.requestParamCheck = this.requestParamCheck.bind(this)
    
    const flvConvertor = new FlvConvertor(context, ffmpeg)
    const hlsConvertor = new HlsConvertor(context, ffmpeg)
    this.convertorMap = {
      'hls': hlsConvertor,
      'http': flvConvertor,
      'ws': flvConvertor
    }

    this.clientIps = new Map()
    this._initFolderAndEvents()
  }

  // 在 node-media-server 文件夹下 node_http_server 中注入自己的服务
  setServerRoute(app) {
    // 跨域设置
    app.all('*', function (req, res, next) {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': '*',
        'Content-Type': 'application/jsoncharset=utf-8'
      })
      if (req.method === 'OPTIONS') {
        res.end()
        return
      }
      next()
    })

    // 转流接口, json 请求，
    // 参数： url {string | array}
    //       type {'ws' | 'http' | hls | undefined(default http)}
    app.post(
      '/convert',
      bodyParser.json(),
      this.requestParamCheck,
      (req, res) => {
        const url = req.body.url
        const type = req.body.type
        const resolution = req.body.resolution

        this.convert(url, type, resolution)
          .then(playUrl => res.end(Result.of(200, playUrl).toString()))
          .catch(e => res.end(Result.of(400, null, e.message).toString()))
      }
    )

    // 停止转流接口, json 请求，参数： url {string | array}
    app.post(
      '/stop',
      bodyParser.json(),
      this.requestParamCheck,
      (req, res) => {
        const url = req.body.url
        const type = req.body.type
        const resolution = req.body.resolution

        this.stop(url, resolution, type)
        res.end(Result.of(200).toString())
      }
    )

    app.post(
      '/pageStop', 
      bodyParser.json(), 
      this.requestParamCheck, 
      (req,res) => {
        const url = req.body.url
        const type = req.body.type
        const resolution = req.body.resolution

        this.handlePageStop(url, resolution, type)
        res.end(Result.of(200).toString())
      }
    )
  }

  _initFolderAndEvents() {
    // 初始化 hls 文件夹
    try {
      mkdirp.sync(HLS_ROOT)
      fs.accessSync(HLS_ROOT, fs.constants.W_OK)
    } catch (error) {
      Logger.error(`can not create folder ${HLS_ROOT}`, error)
    }
  }

  // 转换
  async convert(url, type, resolution) {
    try {
      const playUrl = await this.convertorMap[type].convert(url, type, resolution)
      return playUrl
    } catch(e) {
      const convertError = `url=${url} type=${type} resolution=${resolution}`
      Logger.error('[convert fail] ', convertError, '\n', e.message)
      throw e
    }
  }

  // 停止单个转流
  stop(url, resolution, type) {
    try {
      this.convertorMap[type].stop(url, resolution)
    } catch(e) {
      const convertInfo = `url=${url} type=${type} resolution=${resolution}`
      Logger.error('[stop convert error] ', convertInfo, '\n', e)
    }
  }

  // flv 客户端断开连接
  stopByUUID(uuid) {
    try {
      this.convertorMap.http.stopByUUID(uuid)
    } catch (e) {
      const convertInfo = `uuid= ${uuid}`
      Logger.error('[stop convert error] ', convertInfo, '\n', e)
    }
  }

  handlePageStop(url, resolution, type) {
    try {
      this.convertorMap[type].stopAll(url, resolution)
    } catch (e) {
      const convertInfo = `url=${url} type=${type} resolution=${resolution}`
      Logger.error('[pageStop convert error] ', convertInfo, '\n', e)
    }
  }

  // 参数检测
  requestParamCheck(req, res, next) {
    const url = req.body.url
    const type = req.body.type
    const resolution = req.body.resolution
    const isArray = Array.isArray(url)
    if (!isArray && this.isNotRtspUrl(url)) {
      const retStr = Result.of(
        400,
        null,
        'url not provide or is not a rtsp url'
      ).toString()
      res.end(retStr)
      return
    }
    if (type && (typeof type !== 'string' || !CONVERT_TYPES.includes(type))) {
      // 如果 type 存在，但是不是字符串或者不在规定的范围中，返回错误
      const retStr = Result.of(400, null, 'type parameter wrong').toString()
      res.end(retStr)
      return
    }
    if (resolution && (typeof resolution !== 'string' || !RESOLUTIONS.includes(resolution))) {
      const retStr = Result.of(400, null, 'resolution parameter wrong').toString()
      res.end(retStr)
      return
    }
    req.body.type = req.body.type || 'http'
    req.body.resolution = req.body.resolution || 'origin'
    next()
  }

  // 检测字符串参数是否不是以 rtsp 开头
  isNotRtspUrl(url) {
    if (!url || !url.startsWith('rtsp')) {
      return true
    }
    return false
  }
}

module.exports = OwnServer
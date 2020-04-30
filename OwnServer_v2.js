const fs = require('fs');
const bodyParser = require('body-parser');
const mkdirp = require('mkdirp');
const Logger = require('./Logger');
const Result = require('./Result');
const ConvertFlv = require('./ConvertFlv');
const ConvertHls = require('./ConvertHls');
const { emitter } = require('./PageInfo');

class OwnServer {
  constructor(context) {

    /**
     * streamId matched node-media-server sessionId
     * { streamId_http|ws: sessionId }
     */
    this.flvStreamIdSessionIdMap = {};
    this.CONVERT_TYPES = ['http', 'ws', 'hls'];
    this.RESOLUTIONS = ['1080', '720', '480'];
    this.hlsRoot = './hls';
    this.mediaServerContext = context;
    this.requestParamCheck = this.requestParamCheck.bind(this);
    
    const hlsHandler = new ConvertHls(this.hlsRoot);
    const flvHandler = new ConvertFlv();
    this.convertHandler = {
      'hls': hlsHandler,
      'http': flvHandler,
      'ws': flvHandler
    };
    this.clientIps = new Map();
    this.init();
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
        'Content-Type': 'application/json;charset=utf-8'
      });
      if (req.method === 'OPTIONS') {
        res.end();
        return;
      }
      next();
    });

    // 转流接口, json 请求，
    // 参数： url {string | array}
    //       type {'ws' | 'http' | hls | undefined(default http)}
    app.post(
      '/convert',
      bodyParser.json(),
      this.requestParamCheck,
      (req, res) => {       
        const url = req.body.url;
        const type = req.body.type;
        const resolution = req.body.resolution;
        const isArray = Array.isArray(url);
        // const result = isArray
        //   ? this.handleConvertUrls(url, type, resolution)
        //   : this.handleConvertUrl(url, type, resolution);
        this.handleConvertUrl(url, type, resolution).then(
          url =>  {
            res.end(Result.of(200, url).toString());
          }
        ).catch(
          e => {
            res.end(Result.of(400, null, e.message).toString());
          }
        )
        
      }
    );

    // 停止转流接口, json 请求，参数： url {string | array}
    app.post(
      '/stop',
      bodyParser.json(),
      this.requestParamCheck,
      (req, res) => {
        const url = req.body.url;
        const type = req.body.type;
        const resolution = req.body.resolution;
        Logger.info('[res query]: ', req.body);
        const isArray = Array.isArray(url);
        isArray
          ? this.handleStopUrls(url, resolution, type)
          : this.handleStopUrl(url, resolution, type);
        res.end(Result.of(200).toString());
      }
    );

    app.post(
      '/pageStop', 
      bodyParser.json(), 
      this.requestParamCheck, 
      (req,res) => {
        const url = req.body.url;
        const type = req.body.type;
        const resolution = req.body.resolution;
        this.handlePageStop(url, resolution, type);
        res.end(Result.of(200).toString());
      }
    );
  }

  init() {
    // 初始化 hls 文件夹
    try {
      mkdirp.sync(this.hlsRoot);
      fs.accessSync(this.hlsRoot, fs.constants.W_OK);
    } catch (error) {
      Logger.error(`can not create folder ${this.hlsRoot}`, error);
    }
    this.initWebsocketEvents();
    // this.initEvnetListen();
  }
  // 监听浏览器的websocket
  initWebsocketEvents() {
    emitter.on('clientConnect', address => {
      const ip = address.substring(address.lastIndexOf(':') + 1);
      this.clientIps.set(ip, []);
    });
    emitter.on('clientMessage', (address, message) => {
      if(message === 'ping') return;
      const data = JSON.parse(message);
      const ip = address.substring(address.lastIndexOf(':') + 1);
      this.clientIps.set(ip, data.rtsp);
    });
    emitter.on('clientClose', address => {
      const ip = address.substring(address.lastIndexOf(':') + 1);
      const rtspList = this.clientIps.get(ip);
      for(let item of rtspList) {
        this.handleStopUrl(item.url, item.resolution, item.type);
      }
      this.clientIps.delete(ip);
    });
  }
  initEvnetListen() {
    this.mediaServerContext.nodeEvent.on(
      'prePlay',
      (sessionId, streamPath, args) => {
        const streamId = streamPath.slice(streamPath.lastIndexOf('/') + 1);
        const session = this.mediaServerContext.sessions.get(sessionId);
        if (
          session.TAG === 'http-flv' &&
          !this.flvStreamIdSessionIdMap[`${streamId}_http`]
        ) {
          this.flvStreamIdSessionIdMap[`${streamId}_http`] = sessionId;
        }
        if (
          session.TAG === 'websocket-flv' &&
          !this.flvStreamIdSessionIdMap[`${streamId}_ws`]
        ) {
          this.flvStreamIdSessionIdMap[`${streamId}_ws`] = sessionId;
        }
      }
    );

    // rtmp 连接断开时，结束对应的 ffmpeg
    this.mediaServerContext.nodeEvent.on(
      'donePublish',
      (sessionId, streamPath, args) => {
        this.stopFfmpeg(streamPath, true);
      }
    );

    // 客户端断开连接时，shareNum-- 或者 停止 ffmpeg
    this.mediaServerContext.nodeEvent.on('doneConnect', (sessionId, args) => {
      const streamPath = this.mediaServerContext.sessions.get(sessionId)
        .playStreamPath;
      const streamId = streamPath.slice(streamPath.lastIndexOf('/') + 1);
      delete this.flvStreamIdSessionIdMap[streamId];
      this.stopFfmpeg(streamPath, false);
    });
  }

  // 参数检测
  requestParamCheck(req, res, next) {
    const url = req.body.url;
    const type = req.body.type;
    const resolution = req.body.resolution;
    const isArray = Array.isArray(url);
    if (!isArray && this.isNotRtspUrl(url)) {
      const retStr = Result.of(
        400,
        null,
        'url not provide or is not a rtsp url'
      ).toString();
      res.end(retStr);
      return;
    }
    if (type && (typeof type !== 'string' || !this.CONVERT_TYPES.includes(type))) {
      // 如果 type 存在，但是不是字符串或者不在规定的范围中，返回错误
      const retStr = Result.of(400, null, 'type parameter wrong').toString();
      res.end(retStr);
      return;
    }
    if (resolution && (typeof resolution !== 'string' || !this.RESOLUTIONS.includes(resolution))) {
      const retStr = Result.of(400, null, 'resolution parameter wrong').toString();
      res.end(retStr);
      return;
    }
    req.body.type = req.body.type || 'http';
    req.body.resolution = req.body.resolution || 'origin';
    next();
  }

  // 检测字符串参数是否不是以 rtsp 开头
  isNotRtspUrl(url) {
    if (!url || !url.startsWith('rtsp')) {
      return true;
    }
    return false;
  }

  // 转流单个
  async handleConvertUrl(url, type, resolution) {
    const id = this.generateFlvId();
    try {
      const res = await this.convertHandler[type].convert(url, id, resolution);
      // flv返回一个对象包括 http 和 ws 的地址
      return type !== 'hls' ? res[type] : res;
    } catch(e) {
      const convertError = `url=${url} type=${type} resolution=${resolution}`;
      Logger.error('[convert fail] ', convertError, '\n', e);
      throw new Error(e.message);
    }
  }

  // 转流数组
  handleConvertUrls(urls, type) {
    const convertedMap = urls.reduce((map, url) => {
      if (!this.isNotRtspUrl(url)) {
        const converted = this.handleConvertUrl(url, type);
        map[url] = converted;
      }
      return map;
    }, {});
    return convertedMap;
  }

  // 停止单个转流
  handleStopUrl(url, resolution, type) {
    try {
      this.convertHandler[type].stop(url, resolution);
    } catch(e) {
      const convertInfo = `url=${url} type=${type} resolution=${resolution}`
      Logger.error('[stop convert error] ', convertInfo, '\n', e);
    }
  }

  handlePageStop(url, resolution, type) {
    try {
      this.convertHandler[type].stop(url, resolution);
    } catch (e) {
      const convertInfo = `url=${url} type=${type} resolution=${resolution}`
      Logger.error('[pageStop convert error] ', convertInfo, '\n', e);
    }
  }

  // 停止转流数组
  handleStopUrls(urls, resolution, type) {
    Logger.info('[handleStopUrls]: ', urls, resolution, type);
    urls.forEach(url => {
      if (!this.isNotRtspUrl(url)) {
        this.handleStopUrl(url, resolution, type);
      }
    });
  }

  // 生成 6 位 ID
  generateFlvId() {
    return (((1 + Math.random()) * 0x1000000) | 0).toString(16).substring(1);
  }
}

module.exports = OwnServer;

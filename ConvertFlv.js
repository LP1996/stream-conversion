const { spawn } = require('child_process');
const Convert = require('./Convert');
const Logger = require('./Logger');
const { PORT = 8000, SERVER_IP = 'localhost' } = process.env;

class ConvertFlv extends Convert {
  constructor() {
    super();
    this.TYPE = 'flv';
  }

  async convert(url, id, resolutionType) {
    if (this._hasSession(url, resolutionType)) {
      return this._handleHasConverted(url, resolutionType);
    }

    const args = this._generateFFmpegArgs(url, id, resolutionType);
    const p = spawn('ffmpeg', args);
    const now = Date.now();

    p.on('error', code => {
      this.pageInfo.deleteSession(this._getSessionId(url, resolutionType));
      p && p.stdin.writable && p.stdin.write('q');
      Logger.error(
        `[ffmpeg process error] url=${url} id=${id} type=flv resolution=${resolutionType}  ${code}`
      );
    });

    try {
      await this._checkRtspIsReachable(p, now);

      // 如果在转的里已经有，则直接返回地址，处理多个请求并发的情况
      if (this._hasSession(url, resolutionType)) {
        return this._handleHasConverted(url, resolutionType, p);
      }

      const retUrl = this._generateConvertedUrl(url, id, p, resolutionType);
      return retUrl;
    } catch (e) {
      p && p.stdin.writable && p.stdin.write('q');

      // 有时候可能会能到达的rtsp地址也会阻塞，在这里找寻是否有并发的已经在转的返回地址信息
      if (this._hasSession(url, resolutionType)) {
        return this._handleHasConverted(url, resolutionType);
      }
      throw new Error(`can not reach the given url: ${url}`);
    }
  }

  stop(url, resolutionType) {
    if (!this._hasSession(url, resolutionType)) {
      return;
    }
    const sessionId = this._getSessionId(url, resolutionType);
    const cache = this.pageInfo.getSession(sessionId);

    // 如果观看人数大于 1，则只减少 观看人数信息，不关闭 ffmpeg 进程
    if (cache.shareNum > 1) {
      const shareNum = cache.shareNum - 1;
      this.pageInfo.updateSession(sessionId, shareNum);
      return;
    }

    if (cache.shareNum === 1) {
      // 否则，停止对应 ffmpeg 进程，并初始化对应信息
      const p = cache.process;
      // p.stdin.writable && p.stdin.write('q');
      p.kill();
      this.pageInfo.deleteSession(sessionId);
    }
  }

  _generateConvertedUrl(url, id, process, resolutionType) {
    const sessionId = this._getSessionId(url, resolutionType);
    const retUrl = {
      http: `http://${SERVER_IP}:${PORT}/live/${id}.flv`,
      ws: `ws://${SERVER_IP}:${PORT}/live/${id}.flv`
    };
    const session = {
      origin: url,
      resolution: resolutionType,
      converted: retUrl,
      shareNum: 1,
      startTime: this._currentTime(),
      type: this.TYPE,
      logs: [],
      id,
      process
    };
    this.pageInfo.addSession(sessionId, session);
    process.stderr.on('data', ((sessionId) => (chunk) => {
      if(this.pageInfo.hasSession(sessionId)) {
        this.pageInfo.updateLogs(sessionId, chunk.toString());
      }
    })(sessionId));
    return retUrl;
  }

  _generateFFmpegArgs(inPath, id, resolutionType) {
    let args;
    if (resolutionType !== 'origin') {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-vcodec',
        'h264',
        '-f',
        'flv',
        '-s',
        this.RESOLUTION_TYPES[resolutionType],
        'rtmp://127.0.0.1/live/' + id
      ];
    } else {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-vcodec',
        'copy',
        '-f',
        'flv',
        'rtmp://127.0.0.1/live/' + id
      ];
    }

    // 流媒体格式为h.265需先转为h.264
   /*  if (resolutionType !== 'origin') {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-c:v',
        'libx264',
        '-preset',
        'superfast',
        '-tune',
        'zerolatency',
        '-c:a',
        'aac',
        '-f',
        'flv',
        '-s',
        this.RESOLUTION_TYPES[resolutionType],
        'rtmp://127.0.0.1/live/' + id
      ];

    } else {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-c:v',
        'libx264',
        '-preset',
        'superfast',
        '-tune',
        'zerolatency',
        '-c:a',
        'aac',
        '-f',
        'flv',
        'rtmp://127.0.0.1/live/' + id

      ];
    } */
    return args;
  }
}

module.exports = ConvertFlv;
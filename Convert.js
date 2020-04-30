const { pageInfo } = require('./PageInfo');
const Logger = require('./Logger');

class Convert {
  constructor() {
    this.convertedCache = new Map();
    this.pageInfo = pageInfo;
    this.RESOLUTION_TYPES = {
      '1080': '1920x1080',
      '720': '1280x720',
      '480': '854x480'
    };
    this.FFMPEG_PROCESS_STALLED = 250;
    this.FFMPEG_TIMEOUT = 1800;
    this.DELIMITER = '^';
  }

  pageStop(url, resolution) {
    const sessionId = this._getSessionId(url, resolution);
    const session = this.pageInfo.getSession(sessionId);
    if(!session) return;
    const id = session.id;
    const p = session.process;
    p && p.stdin.writable && p.stdin.write('q');
    this.pageInfo.deleteSession(sessionId);
    const stopInfo = `url=${url} type=${this.TYPE} id=${id} resolution=${resolution}`;
    Logger.info('[page stop convert] ', stopInfo);
  }

  //  检测给定的 rtsp 是否可以请求到，返回一个 promise，可以请求到则 resolve，否则 reject
  _checkRtspIsReachable(process, startTime) {
    let lastStdoutTime;

    // 记录 ffmpeg 进程的打印的时间，如果能连接到 rtsp 源，则会不停打印
    process.stderr.on('data', onData);
    function onData(chunk) {
      lastStdoutTime = Date.now();
    }

    // 如果连接不到 rtsp 源，则在 timeout 时间后 kill 子进程, 并且切断 flv
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 当最后一次打印的时间 - 开始的时间小于给定的阻塞时间，则可以认为 rtsp 源不可达
        const timeRange = lastStdoutTime - startTime;
        if (timeRange < this.FFMPEG_PROCESS_STALLED) {
          reject(false);
          process.stderr.removeListener('data', onData);
          return;
        }
        process.stderr.removeListener('data', onData);
        resolve(true);
      }, this.FFMPEG_TIMEOUT);
    });
  }

  // 如果给定分辨率的rtsp地址有在转的，则返回在转的地址
  _handleHasConverted(url, resolutionType, p) {
    // p是并发时，如果已经有对应信息写入 cache，则将该 ffmpeg 进程 p终止，使用已经在 cache 中的地址
    p && p.stdin.writable && p.stdin.write('q');
    const sessionId = this._getSessionId(url, resolutionType);
    const cache = this.pageInfo.getSession(sessionId);
    const retUrl = cache.converted;
    const shareNum = cache.shareNum + 1;
    this.pageInfo.updateSession(sessionId, shareNum);
    return retUrl;
  }

  // 给定分辨率rtsp地址是否在进行转流
  _hasSession(url, resolution) {
    return this.pageInfo.hasSession(this._getSessionId(url, resolution));
  }

  // 根据 url、resolution获取 sessionId，rtspUrl^flv|hls^1080|720|480|origin
  _getSessionId(url, resolution) {
    return `${url}${this.DELIMITER}${this.TYPE}${this.DELIMITER}${resolution}`;
  }

  _currentTime() {
    const nowDate = new Date();
    return (
      nowDate.toLocaleDateString() +
      ' ' +
      nowDate.toLocaleTimeString([], { hour12: false })
    );
  }
}

module.exports = Convert;
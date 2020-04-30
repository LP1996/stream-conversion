const fs = require('fs');
const { spawn } = require('child_process');
const mkdirp = require('mkdirp');
const Convert = require('./Convert');
const Logger = require('./Logger');
const { PORT = 8000, SERVER_IP = 'localhost' } = process.env;

class ConvertHls extends Convert {
  constructor(hlsRoot) {
    super();
    this.hlsRoot = hlsRoot;
    this.TYPE = 'hls';
  }

  // 转流，产生 ffmpeg 子进程
  async convert(url, id, resolutionType) {
    if (this._hasSession(url, resolutionType)) {
      return this._handleHasConverted(url, resolutionType);
    }
    const { outPath, output } = this._initConvertOutpath(id);
    const args = this._generateFFmpegArgs(url, output, resolutionType);
    const p = spawn('ffmpeg', args);
    const now = Date.now();
    const convertInfo = `id=${id} url=${url} resolution=${resolutionType}`;

    p.on('close', this.removeCreated(outPath));
    p.on('error', this.removeCreated(outPath, p));

    try {
      await this._checkRtspIsReachable(p, now);
      Logger.info('[start hls convert] ', convertInfo);

      // 如果在转的里已经有，则直接返回地址
      if (this._hasSession(url, resolutionType)) {
        return this._handleHasConverted(url, resolutionType, p);
      }
      return this._generateConvertedUrl(url, id, p, resolutionType);
    } catch (e) {
      p && p.stdin.writable && p.stdin.write('q');

      // 有时候可能会能到达的rtsp地址也会阻塞，在这里找寻是否有并发的已经在转的返回地址信息
      if (this._hasSession(url, resolutionType)) {
        return this._handleHasConverted(url, resolutionType);
      }
      this.removeCreated(outPath)();
      const errMsg = e.message
        ? e.message
        : `can not reach the given url: ${url}`;
      throw new Error(errMsg);
    }
  }

  // 停止转流
  stop(url, resolutionType) {
    if (!this._hasSession(url, resolutionType)) {
      return;
    }
    const sessionId = this._getSessionId(url, resolutionType);
    const cache = this.pageInfo.getSession(sessionId);
    const id = cache.id;

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

      const stopInfo = `url=${url} type=hls id=${id} resolution=${resolutionType}`;
      Logger.info('[stop hls convert] ', stopInfo);

      this.pageInfo.deleteSession(sessionId);
    }
  }

  // 删除生成的 m3u8、ts 文件以及文件夹
  removeCreated(outPath, p) {
    return code => {
      const id = outPath.slice(outPath.lastIndexOf('/') + 1);
      if (p) {
        Logger.error(
          `[ffmpeg process error] outpath=${outPath} id=${id} type=hls  ${code}`
        );
      }
      fs.readdir(outPath, cb);

      function cb(err, files) {
        if (!err) {
          try {
            files.forEach(filename => {
              if (
                filename.endsWith('.ts') ||
                filename.endsWith('.m3u8') ||
                filename.endsWith('.mpd') ||
                filename.endsWith('.m4s')
              ) {
                // 删除文件
                fs.unlinkSync(outPath + '/' + filename);
              }
            });
            fs.rmdirSync(outPath);
            p && p.stdin.writable && p.stdin.write('q');
          } catch (e) {
            Logger.info('remove hls files or folder fail: ', id);
          }
        } else {
          Logger.info('readdir fail: ', outPath);
        }
      }
    };
  }

  _initConvertOutpath(id) {
    const outPath = `${this.hlsRoot}/${id}`;
    mkdirp.sync(outPath);
    const output = `${outPath}/index.m3u8`;
    return { outPath, output };
  }

  // 生成 cache 中的信息并储存，并返回请求 url
  _generateConvertedUrl(url, id, process, resolutionType) {
    // rtspUrl^hls^1080
    const sessionId = `${url}${this.DELIMITER}${this.TYPE}${
      this.DELIMITER
    }${resolutionType}`;

    // http://xxx:8080/hls/ac5d3a/index.m3u8
    const retUrl = `http://${SERVER_IP}:${PORT}/hls/${id}/index.m3u8`;
    const session = {
      origin: url,
      resolution: resolutionType,
      shareNum: 1,
      converted: retUrl,
      startTime: this._currentTime(),
      type: this.TYPE,
      logs: [],
      id,
      process
    };
    this.pageInfo.addSession(sessionId, session);
    process.stderr.on('data', ((sessionId) => (chunk) => {
      if (this.pageInfo.hasSession(sessionId)) {
        this.pageInfo.updateLogs(sessionId, chunk.toString());
      }
    })(sessionId));
    return retUrl;
  }

  // 生成 ffmpeg 使用的数组参数
  _generateFFmpegArgs(inPath, output, resolutionType) {
    let args;
    if (resolutionType !== 'origin') {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-f',
        'hls',
        '-c:v',
        'h264',
        '-s',
        this.RESOLUTION_TYPES[resolutionType],
        '-hls_time',
        '2',
        '-hls_list_size',
        '2',
        '-hls_flags',
        'delete_segments',
        // 加下面参数来可以改变切片时间大小
        '-g',
        '2',
        output
      ];
    } else {
      args = [
        '-rtsp_flags',
        'prefer_tcp',
        '-i',
        inPath,
        '-f',
        'hls',
        '-vcodec',
        'copy',
        '-hls_time',
        '2',
        '-hls_list_size',
        '2',
        '-hls_flags',
        'delete_segments',
        // 加下面参数来可以改变切片时间大小
        '-g',
        '2',
        output
      ];
    }
    return args;
  }
}

module.exports = ConvertHls;
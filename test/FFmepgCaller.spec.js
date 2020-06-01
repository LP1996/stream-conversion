const ffmpeg = require('../FFmpegCaller')

// 结果：产生两个 ffmpeg 进程

let id = 1

// not reachable
ffmpeg.run(id++, 'rtsp://admin:hik12345+@192.168.205.228:554', ['-f', 'flv', 'rtmp://192.168.205.111:1935/live1'])
  .then(info => console.log('convert success: ', info))
  .catch(err => console.log('convert fail: ', err))

// format need to codec
ffmpeg.run(id++, 'rtsp://admin:a1234567@192.168.20.2:554', ['-f', 'flv', 'rtmp://192.168.205.111:1935/live2'])
  .then(info => console.log('convert success: ', info))
  .catch(err => console.log('convert fail: ', err))

// copy
ffmpeg.run(id++, 'rtsp://admin:hik12345@192.168.205.228:554', ['-f', 'flv', 'rtmp://192.168.205.111:1935/live3'])
  .then(info => console.log('convert success: ', info))
  .catch(err => console.log('convert fail: ', err))


setTimeout(() => {
  ffmpeg.stop(--id)
  ffmpeg.stop(--id)
  ffmpeg.stop(--id)
}, 20 * 1000)
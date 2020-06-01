const fs = require('fs')
const path = require('path')
const URL = require('url')
const Express = require('express')
const { NodeMediaServer } = require('./node-media-server')
const OwnServer = require('./OwnServer')
const context = require('./Context')
const { brigeEmitter, PORT, SERVER_IP, HLS_ROOT } = require('./constants')

// node-media-server config
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 60,
    ping_timeout: 30
  },
  http: {
    port: PORT || 8000,
    allow_origin: '*',
    webroot: path.resolve(__dirname, './')
  },
  brigeEmitter
}

const ownServer = new OwnServer(context)

function onServerInit(app, mediaServerContext) {
  app.use(Express.static(HLS_ROOT))
  ownServer.setServerRoute(app)
  brigeEmitter
}

function onWsConnect(ws, req) {
  const { pathname } = URL.parse(req.url, true)

  if (pathname !== '/data') {
    return
  }

  ws.isGetData = true
  const data = context.getAllRecords()
  ws.send(JSON.stringify(data))
}

brigeEmitter.once('serverInit', onServerInit)

brigeEmitter.on('wsConnect', onWsConnect)

const nms = new NodeMediaServer(config)
nms.run()

// flv 断开播放
nms.on('doneConnect', (id, { streamPath }) => {
  // rtmp doneConnect 没有 streamPath
  if (!streamPath) {
    return
  }

  const splited = streamPath.split('/')
  const uuid = splited[splited.length - 1]
  ownServer.stopByUUID(uuid)
})

const fileData = fs.readFileSync('./assets/js/page.js');
const newData = fileData
  .toString()
  .replace(/(WebSocket\('[^)]+)/, `WebSocket('ws://${SERVER_IP}:${PORT}/data'`);
fs.writeFileSync('./assets/js/page.js', newData);
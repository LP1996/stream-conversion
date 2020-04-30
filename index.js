const path = require('path');
const { NodeMediaServer } = require('./node-media-server');
const { emitter, pageInfo } = require('./PageInfo');

const { PORT } = process.env;

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
    webroot: path.resolve(__dirname)
  },
  externalServerPath: path.resolve(__dirname, 'OwnServer_v2.js'),
  hlsRoot: path.resolve(__dirname, 'hls'),
  emitter,
  pageInfo
};

const nms = new NodeMediaServer(config);
nms.run();
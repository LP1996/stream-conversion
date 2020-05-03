const EventEmitter = require('events')

const RESOLUTIONS = ['1080', '720', '480']
const ORIGIN_RESOLUTION = 'origin'
const RESOLUTION_SIZE_MAP = {
  '1080': '1920x1080',
  '720': '1280x720',
  '480': '854x480'
}

const CONVERT_TYPES = ['http', 'ws', 'hls']
const HLS_ROOT = './hls'

const { PORT = 8000, SERVER_IP = '127.0.0.1' } = process.env

const brigeEmitter = new EventEmitter()

module.exports = {
  RESOLUTIONS,
  RESOLUTION_SIZE_MAP,
  ORIGIN_RESOLUTION,
  CONVERT_TYPES,
  HLS_ROOT,
  PORT,
  SERVER_IP,
  brigeEmitter
}
const EventEmitter = require('events');
const fs = require('fs');
const { PORT = 8000, SERVER_IP = 'localhost' } = process.env;

class PageInfo {
  constructor() {
    this.sessions = new Map();
    this.MAX_LOG = 15;
    this.lastSendData = Date.now();
    this.addSession = this.addSession.bind(this);
    this.deleteSession = this.deleteSession.bind(this);
    this.updateSession = this.updateSession.bind(this);
    this._getSessionsAsArray = this._getSessionsAsArray.bind(this);
  }

  // sessionInfo: { url, converted, resolution, shareNum, startTime, logs, id, type, process }
  addSession(id, sessionInfo) {
    this.sessions.set(id, sessionInfo);
    this._emitSendData(true);
  }

  deleteSession(id) {
    this.sessions.delete(id);
    this._emitSendData(true);
  }

  updateSession(id, shareNum) {
    this.sessions.get(id).shareNum = shareNum;
    this._emitSendData();
  }

  updateLogs(sessionId, log) {
    let session = this.sessions.get(sessionId);
    session.logs.push(log);
    if(session.logs.length >= this.MAX_LOG) {
      session.logs.shift();
    }
    this._emitSendData();
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  _emitSendData(sendAnyway = false) {
    const now = Date.now();

    // 发送速率在 1s 左右
    if(!sendAnyway && now - this.lastSendData < 1000) {
      return;
    }
    const data = JSON.stringify(this._getSessionsAsArray());
    emitter.emit('send', data);
    this.lastSendData = now;
  }

  _getSessionsAsArray() {
    const values = this.sessions.values();
    const result = [];
    for(let value of values) {
      let ret = Object.assign({}, value);
      ret.process = null;
      result.push(ret);
    }
    return result;
  }
}

const pageInfo = new PageInfo();
const emitter = new EventEmitter();
// emitter.on('addSession', pageInfo.addSession);
// emitter.on('deleteSession', pageInfo.deleteSession);
// emitter.on('updateSession', pageInfo.updateSession);

const fileData = fs.readFileSync('./assets/js/page.js');
const newData = fileData
  .toString()
  .replace(/(WebSocket\('[^)]+)/, `WebSocket('ws://${SERVER_IP}:${PORT}/data'`);
fs.writeFileSync('./assets/js/page.js', newData);

module.exports = { emitter, pageInfo };

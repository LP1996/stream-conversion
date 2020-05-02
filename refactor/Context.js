const { brigeEmitter } = require('./constants')

const conversionMap = new Map()

function addRecord(recordId, conversionRecord) {
  conversionMap.set(recordId, conversionRecord)
  emitSendData()
}

function removeRecord(recordId) {
  conversionMap.delete(recordId)
  emitSendData()
}

function getRecord(recordId) {
  return conversionMap.get(recordId)
}

function getAllRecords() {
  return Array.from(conversionMap.values())
}

function hasRecord(recordId) {
  setTimeout(() => emitSendData, 300)
  return conversionMap.has(recordId)
}

// 向页面发送当前信息
function emitSendData() {
  const data = getAllRecords()
  brigeEmitter.emit('sendData', data)
}

const context = {
  addRecord,
  removeRecord,
  getRecord,
  getAllRecords,
  hasRecord
}

module.exports = context
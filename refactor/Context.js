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

function getRecordByUUID(uuid) {
  const conversionRecords = conversionMap.values()
  
  for (let conversionRecord of conversionRecords) {
    if (conversionRecord.liveId && conversionRecord.liveId === uuid) {
      return conversionRecord
    }
  }

  return null
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
  getRecordByUUID,
  getAllRecords,
  hasRecord
}

module.exports = context
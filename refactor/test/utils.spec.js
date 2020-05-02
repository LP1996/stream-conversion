const { randomUUID } = require('../utils')

const times = 1000000
const uuidMap = {}

// 在足够大的数据情况下不会产生相同 uuid 即可
for (let i = 0; i < times; i++) {
  const uuid = randomUUID()
  uuidMap[uuid] ? (uuidMap[uuid] += 1) : (uuidMap[uuid] = 1)
}

const uuids = Object.keys(uuidMap)
const repeated = uuids.filter(uuid => uuidMap[uuid] > 1)
console.log('repeated uuids: ', repeated)


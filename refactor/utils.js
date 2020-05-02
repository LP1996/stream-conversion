const crypto =  require('crypto')

/**
 * @description 返回当前的时间，格式 yyyy-MM-dd HH:mm:ss
 *
 * @returns {string}
 */
function getCurrentTime() {
  const nowDate = new Date()
  return (
    nowDate.toLocaleDateString() +
    ' ' +
    nowDate.toLocaleTimeString([], { hour12: false })
  )
}


const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

/**
 * @description 生成一个 8 位 UUID，copy 自 uuidjs
 * 
 * @returns {string}
 */
function randomUUID() {
  const rnds = crypto.randomBytes(16)
  const bth = byteToHex;
  
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;
  
  let i = 0;
  return [
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
    '-',
    bth[rnds[i++]],
    bth[rnds[i++]],
    '-',
    bth[rnds[i++]],
    bth[rnds[i++]],
    '-',
    bth[rnds[i++]],
    bth[rnds[i++]],
    '-',
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
    bth[rnds[i++]],
  ].join('');
}

module.exports = {
  getCurrentTime,
  randomUUID
}
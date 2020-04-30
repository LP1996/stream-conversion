function getCurrentTime() {
  const nowDate = new Date()
  return (
    nowDate.toLocaleDateString() +
    ' ' +
    nowDate.toLocaleTimeString([], { hour12: false })
  )
}

module.exports = {
  getCurrentTime
}
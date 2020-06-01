const { request } = require('http')

const url = 'http://localhost:8000/convert'
const params = {
  url: 'rtsp://admin:hik12345@192.168.205.228:554'
}


const client = request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})

client.write(JSON.stringify(params))

client.end();

// 不知道有没有事件，找了半天没找明白...
setTimeout(() => {
  client.destroy()
}, 4)

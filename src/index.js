const ipc = require('electron').ipcRenderer
// 読み込まれたらsendを送る
console.log("send send message");
ipc.send('send')
// 送られた方からreceiveを受け取ったら発動
ipc.on('receive', function(event, message) {
    console.log("receive recieve message, and message writing");
    document.getElementById('message').innerHTML = message
})

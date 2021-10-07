const WebSocket = require('ws');
const express = require('express');
const osc = require('osc');

const app = express();
const server = app.listen(5000);
const wss = new WebSocket.Server({
	server: server,
});

console.log(`Starting server…`);

app.use('/', express.static(__dirname + '/'));

const udpPort = new osc.UDPPort({
	localAddress: '0.0.0.0',
	localPort: 7400,
	remoteAddress: '127.0.0.1',
	remotePort: 7500,
});

udpPort.open();

wss.on('connection', (ws, req) => {
	console.log('Connected…');
	const ip = req.socket.remoteAddress;
	ws.on('message', function incoming(data, isBinary) {
		udpPort.send(JSON.parse(data));
		console.log(`Received message => ${data}`);
	});
});

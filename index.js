'use static'

process.env.DEBUG = "w:*";

const express = require('express');
const app = express();
const expressWs = require('express-ws')(app);
const debug = require('debug')('w:main');
const serveStatic = require('serve-static');
const path = require('path');

app.ws('/ws', function (ws, req) {

	ws.on('message', function (msg) {
		console.log(msg);
	});
});

app.use(serveStatic(path.join(__dirname, 'public')));

const port = process.env.PORT || 8080;

app.listen(port, function () {
	debug('Server running on port %d', port);
})
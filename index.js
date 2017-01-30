'use static'

process.env.DEBUG = "w:*";

const express = require('express');
const app = express();
const expressWs = require('express-ws')(app);
const debug = require('debug')('w:main');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const crypto = require('crypto');
const secret = process.env.HMAC_SECRET || Math.random().toString();
const bodyParser = require('body-parser');

const Room = require('./lib/Room.js');

function id(c) {
	return crypto.createHmac('sha256', secret).update(c).digest('hex').substr(0, 10);
}

debug(secret);

app.use(morgan("tiny"));

app.ws('/ws/:room', function (ws, req) {
	console.log(req.params, req.query);

	req.query.name = req.query.name || "GUEST";

	if (!Room.getRoom(req.params.room)) {
		debug('This room doesn\'t exist');
		ws.close();
		return;
	}

	if (!req.query.clientID) {
		debug('Invalid clientID');
		ws.close();
		return;
	}

	let clientHash;
	try {
		clientHash = id(req.query.clientID);
	} catch (err) {
		debug(err);
	}

	debug('Debug %s connected to room %s', clientHash, req.params.room);

	Room.getRoom(req.params.room).connect(clientHash, req.query.name, ws);
});

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.post('/create', function (req, res) {
	debug(req.body);
	let room = new Room(id(req.body.clientID), {
		mode: req.body.mode
	});

	res.json({
		roomID: room.id
	});
});

app.use(serveStatic(path.join(__dirname, 'public')));

app.use(function (req, res) {
	res.redirect('/');
});

const port = process.env.PORT || 8080;

app.listen(port, function () {
	debug('Server running on port %d', port);
})
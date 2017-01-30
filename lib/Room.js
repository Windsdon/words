'use strict';

const crypto = require('crypto');
const debug = require('debug')('w:room');

function makeID() {
	let alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let len = 8;
	let str = '';

	for (let i = 0; i < len; i++) {
		str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}

	return str;
}

let rooms = new Map();

module.exports = class Room {
	constructor(owner) {
		// maps client hashes to websockets
		this.clients = new Map();
		this.id = makeID();
		this.owner = owner;
		this.order = [];
		this.messages = [{
			content: 'Um',
			author: owner,
			order: 0
		}, {
			content: 'dia',
			author: owner,
			order: 1
		}];
		this.listeners = {};

		this.listeners['send'] = this.onClientSendText.bind(this);
		this.listeners['get-all-text'] = this.onClientGetAllText.bind(this);

		rooms.set(this.id, this);

		debug('Room created: %s owned by %s', this.id, this.owner);
	}

	handleMessage(msg, user) {
		debug(msg);
		try {
			msg = JSON.parse(msg);
			this.listeners[msg.m](msg.d, user);
		} catch (err) {
			debug(err);
		}
	}

	onClientSendText(d, user) {
		let message = {
			content: d,
			author: user.id,
			order: this.messages.length
		};
		this.messages.push(message);
		this.sendToAll('text', message);
	}

	onClientGetAllText(d, user) {
		this.sendTo(user, 'all-text', this.messages);
	}

	connect(id, name, ws) {
		debug('Incomming connection: %s %s', id, name)
		let user = this.clients.get(id);
		if (!user) {
			debug('User not present');

			user = {
				id: id,
				name: name,
				ws: ws,
				color: this.nextColor(),
				owner: id === this.owner
			};

			debug('Create new user');

			this.clients.set(id, user);
		} else {
			debug('Closing previous connection');

			if (user.ws) {
				try {
					user.ws.close();
				} catch (err) {
					debug(err);
				}
			}

			user.name = name;

			user.ws = ws;
		}

		user.ws.on('message', (msg) => {
			this.handleMessage(msg, user);
		})

		this.sendTo(user, 'self-id', user.id);

		this.propagateUsers();
		this.onClientGetAllText(null, user);
	}

	propagateUsers() {
		debug('Propagating users');
		try {
			let users = {};
			for (let [k, u] of this.clients) {
				users[k] = ({
					id: u.id,
					name: u.name,
					color: u.color,
					owner: u.owner
				});
			}

			debug('Propagate: %o', users);

			this.sendToAll('set-users', users);
		} catch (err) {
			debug(err);
		}
	}

	sendToAll(message, data) {
		for (let [k, u] of this.clients) {
			try {
				u.ws.send(JSON.stringify({
					m: message,
					d: data
				}));
			} catch (err) {
				debug('Error while sending: %s %s', message, err.message);
			}
		}
	}

	sendTo(user, message, data) {
		try {
			user.ws.send(JSON.stringify({
				m: message,
				d: data
			}));
		} catch (err) {
			debug('Error while sending: %s %s', message, err.message);
		}
	}

	nextColor() {
		let r = Math.floor(Math.random() * 255);
		let g = Math.floor(Math.random() * 255);
		let b = Math.floor(Math.random() * 255);
		return `rgba(${r}, ${g}, ${b}, 0.5)`;
	}

	static getRoom(id) {
		let r = rooms.get(id) || null;
		return r;
	}
};
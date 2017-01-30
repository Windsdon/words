'use strict';

var app = angular.module('words', ['ngRoute', 'ngCookies', 'ngWebSocket']);

app.service('UserSettings', function ($cookies) {
	try {
		var settings = $cookies.getObject('wordsSettings');
		console.log(settings)
		if (!settings.clientID) {
			throw "";
		}
	} catch (err) {
		console.log('Removing settings');
		$cookies.remove('wordsSettings');
	}

	if (!settings) {
		var r = new String(Math.floor((Math.random() * 100000) % 10000));

		if (r.length < 4) {
			r = (new Array(5 - r.length)).join('0') + r;
		}

		settings = {
			username: 'guest#' + r,
			clientID: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			})
		};

		$cookies.putObject('wordsSettings', settings);
	}

	var self = this;

	this.username = settings.username;
	this.clientID = settings.clientID;

	this.save = function () {
		$cookies.putObject('wordsSettings', {
			username: self.username,
			clientID: settings.clientID
		});
	}
})

app.config(function ($routeProvider, $locationProvider) {
	$routeProvider.when('/r/:id', {
		templateUrl: 'include/room.html',
		controller: 'RoomController'
	}).when('/create', {
		templateUrl: 'include/create.html',
		controller: 'CreateController'
	}).when('/config', {
		templateUrl: 'include/config.html',
		controller: 'ConfigController'
	}).when('/', {
		templateUrl: 'include/home.html',
		controller: 'HomeController'
	});
});

app.controller('MainController', function () {

});

app.controller('HomeController', function () {

});

app.controller('RoomController', function ($scope, $websocket, $routeParams, $timeout, UserSettings) {
	var wsurl = 'ws://' + location.host + '/ws/' + $routeParams.id
		+ '?clientID=' + UserSettings.clientID
		+ '&name=' + encodeURIComponent(UserSettings.username);
	console.log(wsurl);
	var ws = $websocket(wsurl);
	var self = this;

	$scope.prefEditorHidden = false;

	this.game = {
		selfID: '',
		input: '',
		yourTurn: false,
		users: {},
		text: []
	}

	$scope.game = this.game;

	$scope.onEditorClick = function () {
		$('.editor').focus();
	}

	$scope.$watch(function () {
		return $scope.game.input;
	}, function () {
		//console.log($scope.game.input);
	});

	$(window).keydown(function (e) {
		$('.editor').focus();
		return self.processKeypress(e);
	});

	$('.editor').keydown(function (e) {
		return self.processKeypress(e);
	});

	this.processKeypress = function (e) {
		if (e.keyCode == 13) { // enter
			e.preventDefault();
			if (!self.game.yourTurn) {
				return false;
			}
			$timeout(function () {
				self.sendInput();
			})
			return false;
		}
	}

	this.sendInput = function () {
		ws.send({
			m: 'send',
			d: self.game.input
		});

		self.game.input = '';
		self.game.yourTurn = false;
	}

	ws.onClose(function () {
		console.log('Websocket Closed!');
	});
	ws.onError(function () {
		alert('Websocket Error!');
	});
	ws.onOpen(function () {
		console.log('Websocket opened!');
	});

	ws.onMessage(function (message) {
		try {
			var d = JSON.parse(message.data);
			self.on[d.m].call(self, d.d);
		} catch (err) {
			console.log(err);
		}
	});

	ws.sendJSON = function (m, d) {
		this.send({
			m: m,
			d: d
		})
	}

	this.on = {};

	this.on['set-users'] = function (d) {
		self.game.users = d;
	}

	this.on['text'] = function (d) {
		if (d.order == self.game.text.length) {
			self.game.text.push(d);
		} else {
			ws.sendJSON('get-all-text');
		}
	}

	this.on['all-text'] = function (d) {
		self.game.text = d;
	}

	this.on['self-id'] = function (d) {
		self.game.selfID = d;
	}
});

app.controller('CreateController', function ($scope, $http, $location, UserSettings) {
	$scope.form = {
		mode: 'single'
	};

	$scope.inputDisabled = false;

	$scope.submit = function () {
		$scope.inputDisabled = true;

		$http.post('/create', {
			clientID: UserSettings.clientID,
			mode: $scope.form.mode
		}).then(function (res) {
			var r = '/r/' + res.data.roomID;
			console.log('Redirect to ' + r);
			$location.path(r);
		}, function () {
			alert('Request failed');
		});

		return false;
	}
});

app.controller('ConfigController', function ($scope, $timeout, UserSettings) {
	$scope.form = {
		username: UserSettings.username
	};
	$scope.showSaved = false;

	$scope.saveUserSettings = function () {
		UserSettings.username = $scope.form.username;
		UserSettings.save();
		$scope.showSaved = true;

		return false;
	}
});
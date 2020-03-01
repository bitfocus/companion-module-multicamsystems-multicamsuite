var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;
	self.actions();
	self.initConnect();
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;
	self.initConnect();
}

//Check Connection 
instance.prototype.initConnect = function () {
	var self = this;
	var cmd;

	if (self.config.host.length > 0 && self.config.port.length > 0 ) {
		cmd = 'http://' + self.config.host + ':' + self.config.port + '/api/application/version';
	} 
	else {
		self.log('error', 'Check your configuration ( ' + self.config.host + ':' + self.config.port + ' )');
	}

	self.system.emit('rest_get', cmd, function (err, result) {
		if (err !== null) {
			self.log('error', 'Network error: connect ' + result.error.code );
			self.status(self.STATUS_ERROR, result.error.code); //Connect Error
		}
		else {
			self.status(self.STATUS_OK); //Connect OK 
		}
	});
}

// Return config fields for web config
instance.prototype.config_fields = function() {
	var self = this;
	return [{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: '<strong>PLEASE READ THIS! </strong>This module is intended for the owner of a multicam. Before you start, activate the multicam API in the settings <b>http://www.multicam-systems.com</b>'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 5,
			default: '127.0.0.1',
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port (Default: 80)',
			width: 3,
			default: 80,
			regex: self.REGEX_PORT
		}
	]
}

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
}

instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'application': {
			label: 'Application',
			options: [
				{
					type: 'dropdown',
					label: 'Select Start Application *',
					id: 'Funcapplication',
					choices: [
						{ id: 'Studio', label: 'Start Application Studio' },
						{ id: 'Radio', label: 'Start Application Radio' },
						{ id: 'Conf', label: 'Start Application Conf' },
						{ id: 'Tracking', label: 'Start Application Tracking' },
					]
				},
			 //{type: 'textinput',label: 'Rooms',id: 'FuncRooms',default: ''},
				{
					type: 'textinput',
					label: 'Templates',
					id: 'FuncTemplates',
					default: ''

				},
			//{type: 'checkbox',label: 'MAN Mode (Radio)',id: 'FuncManAuto',default: false},
			]
		},
		'Audio': {
			label: 'Audio',
			options: [
				{
				type: 'textinput',
				label: 'profile Name *',
				id: 'FuncProfile',
				default: 'Default',
				},
			]
		},
		'Composer': {
			label: 'Composer',
			options: [
				{
					type: 'textinput',
					label: 'Composer file',
					id: 'FuncFile',
					default: 'Default'
				},
				{
					type: 'textinput',
					label: 'Compos in file',
					id: 'FuncCompo',
					default: 'Default'
				},
			]
		},
		'Recording': {
			label: 'Recording',
			options: [
				{
					type: 'dropdown',
					label: 'Recording *',
					id: 'FuncRecord',
					Default: 'start',
					choices: [
							{ id: 'start', label: 'Start' },
							{ id: 'stop', label: 'Stop' },
						]
				},
			]
		},
		'Video': {
			label: 'Video',
			options: [
				{
					type: 'textinput',
					label: 'Select Source *',
					id: 'FuncSource',
					default: 'Source1'
				},
			]
		},
		'Streaming': {
			label: 'Streaming',
			options: [
				{
					type: 'dropdown',
					label: 'Streaming *',
					id: 'FuncStream',
					Default: 'start',
					choices: [
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
					]
				},
			]
		},
		'Medialist': {
			label: 'Medialist',
			options: [
				{
					type: 'dropdown',
					label: 'Media *',
					id: 'FuncMedialistAction',
					Default: 'start',
					choices: [
					{ id: 'start', label: 'Start' },
					{ id: 'stop', label: 'Stop' },
					{ id: 'pause', label: 'Pause' },
					]
				}, 
			]
		},
		'Camera_Preset': {
			label: 'Preset Cam',
			options: [
				{
					type: 'textinput',
					label: 'Camera Number*',
					id: 'FuncSource',
					default: '1'
				},
				{
					type: 'dropdown',
					label: 'Media *',
					id: 'FuncPresetCam',
					Default: 'Preset 1',
					choices: [
						{ id: '1', label: 'Preset 1' },
						{ id: '2', label: 'Preset 2' },
						{ id: '3', label: 'Preset 3' },
						{ id: '4', label: 'Preset 4' },
						{ id: '5', label: 'Preset 5' },
						{ id: '6', label: 'Preset 6' },
						{ id: 'IA', label: 'Autoframe' },
					]
				},
			]
		},
		'Custom commands': {
			label: 'custom',
			options: [{
				type: 'textinput',
				label: 'custom command',
				id: 'FuncCustom',
				default: 'video/live/Source1'
			}, ]
		},
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;
	var opt = action.options;
	var cmd;
	var insert_cmd;
	var body;
	var cmdValue

	switch (id) {

		case 'application':
			if (opt.FuncTemplates > 0) {
				insert_cmd = 'application/startWithTemplate/' + `${opt.Funcapplication}` + '/' + `${opt.FuncTemplates}`;
			}
			else {
				insert_cmd = 'application/start?applicationName=' + `${opt.Funcapplication}`;
			}
			break;	

		case 'Recording':
			insert_cmd = 'recording/' + `${opt.FuncRecord}` ;
			break;

		case 'Video':
			insert_cmd = 'video/live?sourceName=' + `${opt.FuncSource}` ;
			break;

		case 'Custom commands':
			insert_cmd = `${opt.FuncCustom}` ;
			break;

		case 'Audio':
			insert_cmd = `${opt.FuncProfile}` ;
			break;

		case 'Composer':
			insert_cmd = `${opt.FuncFile}` ;
			break;

		case 'Streaming':
			insert_cmd = 'recording/' + `${opt.FuncStream}` ;
			break;

		case 'Medialist':
			insert_cmd = '/medialist/' + `${opt.FuncMedialistAction}` ;
			break;

		case 'Camera_Preset':
			if (opt.FuncPresetCam == "IA" ) {
				insert_cmd = 'studio/autoframe?cameraIndex=' + `${opt.FuncSource}`;
			}
			else {
				insert_cmd = '/studio/preset?cameraIndex=' + `${opt.FuncSource}` + '&presetIndex=' + `${opt.FuncPresetCam}`;
			}
			break;

		}

	if (self.config.host.length > 0 && self.config.port.length > 0 ) {
		cmd = 'http://' + self.config.host + ':' + self.config.port + '/api/' + insert_cmd ;
		self.log('debug', 'Your configuration ( ' + cmd + ' )');
	} 
	else {
		self.log('error', 'Check your configuration ( ' + cmd + ' )');
	}

	self.system.emit('rest', cmd, body, function (err, result, _feedbacks) {
		if (err !== null) {
			self.log('error', 'HTTP POST Request failed (' + result.error.code + ')');
			self.status(self.STATUS_ERROR, result.error.code);
		}
		else {
			self.status(self.STATUS_OK);
			self.log('error', 'HTTP POST Request failed (' + `${_feedbacks}` + ')');
		}
	});
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;
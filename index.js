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

instance.prototype.initConnect = function () {
    var self = this;

    self.log('info', 'Connection TEST');
    self.status(1,'Connecting'); // status ok!
}

// Return config fields for web config
instance.prototype.config_fields = function() {
    var self = this;
    return [{
            type: 'text',
            id: 'info',
            width: 12,
            label: 'Information',
            value: '<strong>PLEASE READ THIS!</strong>BY VINCENT BERRY</strong> TEST TEST TEST <br /><br /> <b>http://www.multicam-systems.com</b>'
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
        },
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
            options: [{
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
                {
                    type: 'textinput',
                    label: 'Rooms',
                    id: 'FuncRooms',
                    default: ''
                },
                {
                    type: 'textinput',
                    label: 'Templates',
                    id: 'FuncTemplates',
                    default: ''

                },
                {
                    type: 'checkbox',
                    label: 'MAN Mode (Radio)',
                    id: 'FuncManAuto',
                    default: false
                },
            ]
        },
        'Audio': {
            label: 'Audio',
            options: [{
                type: 'textinput',
                label: 'profile Name *',
                id: 'FuncProfile',
                default: 'Default'
            }, ]
        },
        'Composer': {
            label: 'Composer',
            options: [{
                    type: 'textinput',
                    label: 'Composer file',
                    id: 'FuncFile',
                    default: ''
                },
                {
                    type: 'textinput',
                    label: 'Compos in file',
                    id: 'FuncCompo',
                    default: ''
                },
            ]
        },
        'Recording': {
            label: 'Recording',
            options: [{
                type: 'dropdown',
                label: 'Select Start Application *',
                id: 'FuncRecord',
                choices: [
                    { id: 'start', label: 'Start' },
                    { id: 'stop', label: 'Stop' },
                ]
            }, ]
        },
        'Video': {
            label: 'Video',
            options: [{
                type: 'textinput',
                label: 'Select Source *',
                id: 'FuncSource',
                default: 'Source1'
            }, ]
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
    var cmd;

    if (self.config.host.length > 0 && self.config.port.length > 0 ) {
        cmd = 'http://' + self.config.host + self.config.port.length + '/api/application/start/studio' + action.options.url;
        self.log('error', 'Check your configuration ( ' + cmd + ' )');
    } 
    else {
        self.log('error', 'Check your configuration ( ' + cmd + ' )');
    }



}

instance_skel.extendedBy(instance);
exports = module.exports = instance;
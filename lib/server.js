/**
 * User: rupin_t
 * Date: 7/19/13
 * Time: 3:55 PM
 */

var MQ = require('mongomq').MongoMQ,
    async = require('async'),
    _ = require('lodash');

var config = require('../config.js'),
    taskProcessor = require('./taskProcessor.js'),
    db = require('./lib/db.js');

var Server = module.exports = function (options) {
    this.options = options = options || {};
    options.client = options.client || null;

    if (!options.client) {
        _.merge(options, config, function (a) { return a; });
        var mqOptions = {
            host: options.db.host,
            port: options.db.port,
            databaseName: options.db.name,
            queueCollection: options.db.mq.collection,
            autoStart: false
        };
        this._mq = new MQ(mqOptions);
    }
};

Server.create = function (options) {
    return new Server(options);
};

Server.prototype.start = function (callback) {
    if (!this.options.client) {
        this._mq.on('task', function (err, task, next) {
            this.onTask(task);
            next();
        }.bind(this));
        this._mq.start(callback);
    }
    else
        callback(null);
};

Server.prototype.onTask = function (task) {
    console.log('Received task : ', task);
    var emit = this.options.client ? this.options.client.onTaskResponse : this._mq.emit;
    taskProcessor.exec(task, function (task) {
        if (task.__error)
            console.log(task.__error);
        emit(task.__cid, task);
    });
};
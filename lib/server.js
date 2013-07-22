/**
 * User: rupin_t
 * Date: 7/19/13
 * Time: 3:55 PM
 */

var MQ = require('mongomq').MongoMQ,
    async = require('async'),
    _ = require('underscore');

var config = require('./config.js'),
    persistence = require('./lib/persistence.js');

var Server = module.exports = function (options) {
    this.options = options || {};

    var mqOptions = {
        host: options.host,
        port: options.port,
        databaseName: options.name,
        queueCollection: options.collection,
        autoStart: false
    };


};

Server.create = function (options) {
    return new Server(options);
};


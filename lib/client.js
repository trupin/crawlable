/**
 * User: rupin_t
 * Date: 7/10/13
 * Time: 5:08 PM
 */

var MQ = require('mongomq').MongoMQ,
    _ = require('underscore'),
    util = require('util'),
    async = require('async');

var tasks = require('./tasks.js'),
    config = require('../config.js'),
    db = require('./db.js'),
    staticable = require('./staticable.js');

/**
 * A client base class to a crawlable server.
 * @type {Function}
 */
var Client = module.exports = function (options) {
    options = _.isObject(options) ? options : {};
    options.mq = _.isObject(options.mq) ? options.mq : {};
    options.mq = _.defaults(options.mq, {
        host: config.db.host,
        port: config.db.port,
        databaseName: config.db.name,
        queueCollection: config.db.mq.collection
    });
    options.mq.autoStart = false;

    this._mq = new MQ(options.mq);
    this._tasks = {};
    this._id = options.id || _.uniqueId(process.pid + +new Date());
    this._ttl = (options.ttl || config.db.cache.ttl) * 1000; // 30s
};

/**
 * Starts the client.
 * @param callback
 */
Client.prototype.start = function (callback) {
    this._mq.on(this._id, function (err, task, next) {
        if (!task) return;
        if (err) return console.log(err);
        if (!task.__id || !this._tasks[task.__id])
            return console.log('Received unknown task response.');
        this._tasks[task.__id](
            task.__error,
            task.__error ? null : task.__result,
            task.__error ? null : task
        );
        next();
    }.bind(this));
    this._mq.start(callback);
};

/**
 * Pushes a task on mongomq
 * @param task
 * @param callback
 */
Client.prototype.exec = function (task, callback) {
    if (!tasks[task] || !_.isFunction(tasks[task]))
        console.log(new Error('Task "' + task + '" not found.'));
    task = tasks[task].apply(null, _.toArray(arguments).slice(2));
    task.__cid = this._id;
    task.__id = _.uniqueId('t');
    this._tasks[task.__id] = _.isFunction(callback) ? callback : function () {
    };
    this._mq.emit('task', task);
};

/**
 * Force the cache generation for one or some urls.
 * @param urls
 * @param callback
 */
Client.prototype.forceComputeCache = function (urls, callback) {
    urls = _.isArray(urls) ? urls : [urls];
    async.each(urls, function (url, done) {
        this.exec('computeCacheForUrl', done, url);
    }.bind(this), callback);
};

/**
 * Creates cache if it's expired or not existing, then get the page html sources.
 * @param url
 * @param callback
 * @param [options]
 *          waitForRegeneration (default := false) -> if true, the callback will be called only when the cache is ready,
 *                                                      otherwise, the html cache is directly returned.
 */
Client.prototype.getStaticHtml = function (req, options, callback) {
    callback = _.isFunction(callback) ? callback : options;
    options = _.isObject(options) ? options : {};
    options.waitForRegeneration = _.isBoolean(options.waitForRegeneration) ? options.waitForRegeneration : false;
    options.forceRegeneration = _.isBoolean(options.forceRegeneration) ? options.forceRegeneration : false;

    var url = req.originalUrl;

    var cb = callback;
    callback = function (err, model) {
        if (err) return cb(err);
        staticable.feed(model.get('html'), req, function (err, res) {
            if (err) return cb(err);
            model.set('html', res);
            cb(null, model);
        });
    };

    async.waterfall([
        function (next) {
            if (options.forceRegeneration)
                return next(null, null);
            db.pages.get(url, function (err, model) {
                next(null, model || null);
            });
        },
        function (model, next) {
            if (!model) options.waitForRegeneration = true;
            if (!model || model.get('luts') + this._ttl < +new Date()) {
                this.forceComputeCache(url, options.waitForRegeneration ? next : function (err) {
                    if (err) return console.log(err);
                    console.log('Page cache has been regenerated.');
                });
                if (options.waitForRegeneration) return;
            }
            callback(null, model);
        }.bind(this),
        function (next) {
            console.log('Page cache has been regenerated');
            db.pages.get(url, next);
        }
    ], callback);
};
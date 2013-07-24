/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 10:49 AM
 */

var _ = require('lodash'),
    async = require('async'),
    Solidify = require('solidify');

var cluster = require('./cluster.js'),
    Cache = require('./cache.js'),
    Renderer = require('./renderer.js');

var processing = 0;

/**
 * Processor class.
 *
 * options = {
 *      Cache: cache class (required)
 *      cacheOptions: options which will be passed to Cache at its creation (optional)
 * }
 *
 * @type {Function}
 */
var Processor = module.exports = function (options) {
    this.options = options = _.isObject(options) ? options : {};

    if (!_.isString(options.host))
        throw new Error("The field 'host' is required.");

    options.Cache = _.isFunction(options.Cache) ? options.Cache : Cache;
    options.cacheOptions = _.isObject(options.cacheOptions) ? options.cacheOptions : {};

    this._cache = new options.Cache(options.cacheOptions);
    if (!(this._cache instanceof Cache))
        throw new Error("The field 'cache' needs to be a Cache instance.");

    this._cache.on('update', this.checkCacheTtl.bind(this));

    options.Renderer = _.isFunction(options.Renderer) ? options.Renderer : Renderer;
    options.rendererOptions = _.isObject(options.rendererOptions) ? options.rendererOptions : {};
    options.rendererOptions = _.defaults(options.rendererOptions, { host: options.host });

    this._renderer = new options.Renderer(options.rendererOptions);
    if (!(this._renderer instanceof Renderer))
        throw new Error("The field 'renderer' needs to be a Renderer instance.");

    options.cacheTtl = (_.isNumber(options.cacheTtl) ? options.cacheTtl : 60 * 60) * 1000;

    this._solidify = Solidify.create();

    processing += 1;
};

Processor.create = function (options) {
    return new Processor(options);
};

/**
 * Starts the processor.
 * You need to call it before doing any action with the processor.
 *
 * Be very careful !!! Starting the processor also start a process pool.
 * The callback will be called only by the Parent process, but every codes placed outside
 * this callback will be called for every children too.
 *
 * You can check if the process is the master or not: "require('cluster').isMaster ? ... : ..."
 *
 * @param callback
 */
Processor.prototype.start = function (callback) {
    cluster.registerTask('render', _.bind(this._renderer.run, this._renderer));
    var that = this;
    async.waterfall([
        function (next) {
            cluster.start(next);
        },
        function (next) {
            that._cache.start(next);
        }
    ], callback);
};

/**
 * Stops the processor.
 * The cluster is stopped only when the last processor instance stops.
 * @param callback
 */
Processor.prototype.stop = function (callback) {
    processing -= 1;
    var fns = [], that = this;
    fns.push(function (done) {
        that._cache.stop(done);
    });
    if (!processing) { // only if there is no started processor.
        fns.push(function (done) {
            cluster.stop(done);
        });
    }
    async.series(fns, callback);
};

/**
 * Renders a page for a specific route.
 * If the "force" option is true, this will get the cache, or generates it if not present.
 * @param route
 * @param options
 * @param callback
 */
Processor.prototype.render = function (route, options, callback) {
    callback = _.isFunction(callback) ? callback : options;
    options = _.isObject(options) ? options : {};
    options.force = _.isBoolean(options.force) ? options.force : false;
    options.wait = _.isBoolean(options.wait) ? options.wait : false;

    var that = this;
    var cb = callback;

    callback = function (err, data) {
        if (err)
            return cb(err);
        var html = data.html;
        return that._solidify.feed({
            requests: html.requests,
            template: html.template,
            context: options.context || {},
            host: options.host || that.options.host
        }, function (err, res) {
            if (err)
                return cb(err);
            data.html = res;
            return cb(null, data);
        });
    };

    async.waterfall([
        function (next) {
            if (options.force)
                return next(null, null);
            return that._cache.read(route, function (err, res) {
                next(null, res || null);
            });
        },
        function (cache, next) {
            if (cache)
                return callback(null, cache);
            if (options.wait)
                return that._render(route, next);
            that._render(route, callback);
            return next(new Error('No cache avalaible at this time, regeneration in process'));
        }
    ], callback);
};

Processor.prototype._render = function (route, callback) {
    var that = this, _data;
    async.waterfall([
        function (next) {
            cluster.exec('render', { route: route }, next);
        },
        function (data, next) {
            _data = data;
            that._cache.read(route, function (__, res) { next(null, res); });
        },
        function (cache, next) {
            if (cache) {
                cache.html = that._solidify.compile(_data);
                that._cache.update(cache._id, cache, next);
            }
            else that._cache.create(
                { _id: route, html: that._solidify.compile(_data) }, next
            );
        }
    ], callback);
};

Processor.prototype.checkCacheTtl = function (data) {
    if (data.luts + this.options.cacheTtl < +new Date())
        this._render(data._id, function (err) {
            if (err) console.log(err);
        });
};
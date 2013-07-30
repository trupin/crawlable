/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 10:49 AM
 */

var _ = require('lodash'),
    async = require('async'),
    Solidify = require('solidify'),
    cookie = require('cookie');

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
        throw new Error('The required field "host" is missing.');

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
 * The callback will be called only by the Parent process, but every code placed outside
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
            if (cluster.isMaster)
                that._cache.start(next);
            else next(null);
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

        var opts = {
            requests: html.requests,
            template: html.template,
            context: options.context || {},
            host: options.host || this.options.host,
            sessionID: options.sessionID
        };

        return that._solidify.feed(opts, function (err, res) {
            if (err)
                return cb(err);
            data.html = res.html;
            data.cookies = res.cookies;
            data.session = res.session;
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
            if (options.wait || !cache)
                return that._render(route, options, callback);
            that._render(route, options);
            return next(new Error('No cache avalaible at this time, regeneration in process'));
        }
    ], callback);
};

/**
 * Renders a page for a specified route.
 * @param route
 * @param options
 * @param callback
 * @private
 */
Processor.prototype._render = function (route, options, callback) {
    var that = this, _data;
    async.waterfall([
        function (next) {
            cluster.exec('render', {
                route: route,
                host: options.host || this.options.host
            }, next);
        },
        function (data, next) {
            _data = data;
            that._cache.read(route, function (__, res) {
                next(null, res);
            });
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
    ], _.isFunction(callback) ? callback : function (err) {
        if (err) return console.log(err);
        console.log('[Crawlable][info] Cache for route="' + route + '" generated');
    });
};

/**
 * Triggered on update to check the time to live, and refresh if necessary.
 * @param data
 */
Processor.prototype.checkCacheTtl = function (data) {
    if (data.luts + this.options.cacheTtl < +new Date())
        this._render(data._id, { host: this.options.host }, function (err) {
            if (err) console.log(err);
        });
};

/**
 * Express middleware.
 * @returns {Function}
 */
Processor.prototype.express = function () {
    var that = this;
    return function (req, res, next) {
        req.crawlable = { html: '' };
        if (req.headers['user-agent'] == 'crawlable' || req.solidify)
            return next();

        req.session.save();

        var options = {
            host: 'http://' + req.headers.host,
            context: _.extend(
                req.query || {},
                req.params || {},
                req.body || {}
            ),
            sessionID: req.sessionID
        };

        if (req.query.regenerate) {
            options.force = true;
            options.wait = true;
        }

        that.render(req._parsedUrl.pathname, options,
            function (err, page) {
                if (err)
                    console.log(err);
                req.crawlable.html = err ? '' : page.html;

                req.session = _.extend(req.session, page.session);

                res.on('header', function () {
                    _.each(page.cookies, function (cookie) {
                        res.setHeader('Set-Cookie', cookie);
                    });
                });

                next();
            }
        );

    };
};
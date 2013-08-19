/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 10:49 AM
 */

var _ = require('lodash'),
    async = require('async'),
    Solidify = require('solidify'),
    cookie = require('cookie'),
    phantom = require('phantom'),
    crypto = require('crypto');

var Cache = require('./cache.js'),
    Renderer = require('./renderer.js'),
    DefaultRenderer = require('../extensions/defaultRenderer.js');

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

    this._cache.on('read', this.checkCacheTtl.bind(this));

    options.Renderer = _.isFunction(options.Renderer) ? options.Renderer : DefaultRenderer;
    options.rendererOptions = _.isObject(options.rendererOptions) ? options.rendererOptions : {};

    this._renderer = new options.Renderer(options.rendererOptions);
    if (!(this._renderer instanceof Renderer))
        throw new Error("The field 'renderer' needs to be a Renderer instance.");

    options.cacheTtl = (_.isNumber(options.cacheTtl) ? options.cacheTtl : 60 * 60) * 1000; // one hour

    this._solidify = Solidify.create({
        requester: _.isFunction(options.requester) ? options.requester : null
    });

    this._pagesInProcess = {};
};

Processor.create = function (options) {
    return new Processor(options);
};

/**
 * Starts the processor.
 * You need to call it before doing any action with the processor.
 * @param callback
 */
Processor.prototype.start = function (callback) {
    var that = this;
    async.parallel([
        function (done) {
            that._phantom = phantom.create({
                binary: __dirname + '/../.utils/phantomjs/bin/phantomjs'
            }, function (ph) {
                if (!ph)
                    return done(new Error('Couldn\'t instanciate the phantom bridge.'));
                that._ph = ph;
                done(null);
            });
        },
        function (done) {
            that._cache.start(done);
        }
    ], function (err) {
        callback(err);
    });
};

/**
 * Stops the processor.
 * @param callback
 */
Processor.prototype.stop = function (callback) {
    this._ph.exit(function () {
        callback(null);
    });
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

        if (data.notFound)
            return cb(null, data);

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
    }.bind(this);

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

    callback = _.isFunction(callback) ? callback : function (err) {
        if (err) return console.log(err);
        console.log('[Crawlable][info] Cache for route="' + route + '" generated');
    };

    var md5 = function (data) {
        var shasum = crypto.createHash('md5');
        return shasum.update(data).digest('hex');
    };

    var id = md5(route + JSON.stringify(options));
    that._pagesInProcess[id] = that._pagesInProcess[id] || [];
    if (that._pagesInProcess[id].length) {
        that._pagesInProcess[id].push(callback);
        return ;
    }
    that._pagesInProcess[id].push(callback);

    async.waterfall([
        function (next) {
            that._ph.createPage(function (page) {
                if (!page)
                    return next(new Error('Couldn\'t create a new phantom page.'));
                next(null, page);
            });
        },
        function (page, next) {
            page.set('settings', {
                userAgent: 'crawlable',
                javascriptEnabled: true,
                loadImages: false
            }, function () {
                next(null, page);
            });
        },
        function (page, next) {
            var url = (options.host || this.options.host) + route;
            page.open(url, function (status) {
                if (status !== 'success')
                    return next(new Error('Couldn\'t load the web page at this address: "' + url + '".'));
                next(null, page);
            });
        },
        function (page, next) {
            that._renderer.run(page, function (err, data) {
                page.close();
                next(err, data);
            });
        },
        function (data, next) {
            _data = data;
            that._cache.read(route, function (__, res) {
                next(null, res);
            });
        },
        function (cache, next) {
            var o = that._solidify.compile(_data);
            if (!o)
                return next(new Error('Cannot compile the template.'));
            if (cache) {
                cache.html = o;
                that._cache.update(cache._id, cache, next);
            }
            else if (options.cacheInputEnabled)
                that._cache.create({ _id: route, html: o }, next);
            else
                next (null, { notFound: true });
        }
    ], function (err, res) {
        async.each(that._pagesInProcess[id], function (fn) { fn(err, res); });
    });
};

/**
 * Triggered on read to check the time to live, and refresh if necessary.
 * @param data
 */
Processor.prototype.checkCacheTtl = function (data) {
//    console.log('Check cache --> ', data.luts + this.options.cacheTtl < +new Date());
    if (data.luts + this.options.cacheTtl < +new Date())
        this._render(data._id, { host: this.options.host }, function (err) {
            if (err) return console.log(err);
//            console.log('[Crawlable] Cache updated for id "' + data._id + '"');
        });
};

/**
 * Express middleware.
 * @returns {Function}
 */
Processor.prototype.express = function (options) {
    var that = this;

    options = _.isObject(options) ? options : {};
    options.filter = _.isFunction(options.filter) ? options.filter : null;

    return function (req, res, next) {

        req.crawlable = req.crawlable || {};

        req.crawlable.cacheInputEnabled = _.isBoolean(req.crawlable.cacheInputEnabled) ?
            req.crawlable.cacheInputEnabled : true;
        req.crawlable.html = '';

        if (req.headers['user-agent'] == 'crawlable' || req.solidify)
            return next();

        if (options.filter && !options.filter(req._parsedUrl.pathname))
            return next();

        req.session.save();

        var opts = {
            host: 'http://' + req.headers.host,
            context: _.extend(
                req.query || {},
                req.params || {},
                req.body || {}
            ),
            sessionID: req.sessionID,
            cacheInputEnabled: req.crawlable.cacheInputEnabled
        };

        if (req.query.regenerate) {
            opts.force = true;
            opts.wait = true;
        }

        that.render(req._parsedUrl.pathname, opts,
            function (err, page) {
                if (err) {
                    console.log(err);
                    req.crawlable.html = '';
                    return next();
                }

                if (!page.notFound) {
                    req.crawlable.html = page.html;
                    req.session = _.extend(req.session, page.session);

                    res.on('header', function () {
                        _.each(page.cookies, function (cookie) {
                            res.setHeader('Set-Cookie', cookie);
                        });
                    });
                }
                else {
                    req.crawlable.notFound = true;
                }
                next();
            }
        );
    };
};

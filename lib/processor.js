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

    options.concurrency = _.isNumber(options.concurrency) ? options.concurrency : 40;

    // store the processing tasks, in order to catch it in case of a critical failure.
    this._tasksInProcess = {};
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

    // create a queue to handle problem of concurrency and the case where phantom crashes.
    that._tasksQueue = async.queue(function (task, callback) {
        // this hack permit us to restart the queue after it has been stopped by setting concurrency to zero.
        if (task.ping)
            return callback(null);
        // otherwise, process the page normally.
        that._render(task.route, task.options, function (err, res) {
            if (task.callback)
                task.callback(err, res);
            callback(null);
        });
    } , 0);

    // just add "stop" and "start" features to our queue.
    that._tasksQueue.stop = function () {
        this.concurrency = 0;
    };

    that._tasksQueue.start = function () {
        this.concurrency = that.options.concurrency;
        // this hack permit us to restart the queue after it has been stopped by setting concurrency to zero.
        this.unshift({ ping: true });
    };

    var phOpts = {
        binary: __dirname + '/../.utils/phantomjs/bin/phantomjs'
    };

    // function called if phantom crashed. We need to restart it immediately in that case.
    phOpts.onCriticalExit = function () {
        console.log('PhantomJS exited with an abnormal error code and will be relaunched.');

        // stop the queue until phantom is not available.
        that._tasksQueue.stop();

        // be sure to firstly compute tasks which were in process at this time.
        _.each(that._tasksInProcess, function (tasks) {
            _.each(tasks, function (task) {
                that._tasksQueue.unshift(task);
            });
        });
        // this will avoid calling callbacks for nothing (also avoid calling it two times, which is very bad :o).
        that._tasksInProcess = {};

        // restart phantom
        that._phantom = phantom.create(phOpts, function (ph) {
            if (!ph) throw new Error('Couldn\'t restart PhantomJs after it crashed.');
            that._ph = ph;

            // restart the workers
            console.log('Worker should restart now.');
            that._tasksQueue.start();
        });
    };

    async.parallel([
        function (done) {
            that._phantom = phantom.create(phOpts, function (ph) {
                if (!ph) return done(new Error('Couldn\'t instanciate the phantom bridge.'));
                that._ph = ph;

                // start the workers
                that._tasksQueue.start();
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
    this._tasksQueue.stop();
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
            host: options.host || that.options.host,
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
            var task = { route: route, options: _.cloneDeep(options) };
            if (options.wait || !cache) {
                task.callback = callback;
                return that._tasksQueue.push(task);
            }
            that._tasksQueue.push(task);
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

    var id = md5(route + JSON.stringify(options)),
        task = { route: route, options: _.cloneDeep(options), callback: callback};

    that._tasksInProcess[id] = that._tasksInProcess[id] || [];
    if (that._tasksInProcess[id].length)
        return that._tasksInProcess[id].push(task);
    that._tasksInProcess[id].push(task);

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
            var url = (options.host || that.options.host) + route;
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
                next(null, { notFound: true });
        }
    ], function (err, res) {
        async.each(that._tasksInProcess[id] || [], function (task) {
            task.callback(err, res);
        });
        that._tasksInProcess[id] = [];
    });
};

/**
 * Triggered on read to check the time to live, and refresh if necessary.
 * @param data
 */
Processor.prototype.checkCacheTtl = function (data) {
//    console.log('Check cache --> ', data.luts + this.options.cacheTtl < +new Date());
    if (data.luts + this.options.cacheTtl < +new Date())
        this._tasksQueue.push({
            route: data._id,
            options: { host: this.options.host },
            callback: function (err) {
                if (err) console.log(err);
            }
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

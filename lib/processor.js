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

var errors = require('./errors.js'),
    Cache = require('./cache.js'),
    Renderer = require('./renderer.js'),
    Persistence = require('./persistence.js'),
    Router = require('./router.js'),
    DefaultRenderer = require('../extensions/defaultRenderer.js'),
    DefaultPersistence = require('../extensions/nedb.js');

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

    options.Persistence = _.isFunction(options.Persistence) ? options.Persistence : DefaultPersistence;
    options.persistenceOptions = _.isObject(options.persistenceOptions) ? options.persistenceOptions : {};

    this._persistence = new options.Persistence(options.persistenceOptions);
    if (!(this._persistence instanceof Persistence))
        throw new Error("The field 'Persistence' needs to be a daughter of the 'Persistence' base class.");

    options.cacheTtl = (_.isNumber(options.cacheTtl) ? options.cacheTtl : 60 * 60) * 1000; // one hour

    this._cache = Cache.create({
        persistence: this._persistence,
        ttl: options.cacheTtl
    });

    options.Renderer = _.isFunction(options.Renderer) ? options.Renderer : DefaultRenderer;
    options.rendererOptions = _.isObject(options.rendererOptions) ? options.rendererOptions : {};

    this._renderer = new options.Renderer(options.rendererOptions);
    if (!(this._renderer instanceof Renderer))
        throw new Error("The field 'Renderer' needs to be a daughter of the 'Renderer' base class.");

    this._solidify = Solidify.create({
        requester: _.isFunction(options.requester) ? options.requester : null
    });

    this._router = Router.create({
        onActualize: this.onCacheActualize.bind(this)
    });

    options.concurrency = _.isNumber(options.concurrency) ? options.concurrency : 40;
    // store the processing tasks, in order to catch it in case of a critical failure.
    this._tasksInProcess = {};
    this._phantomPages = [];
    this._failure = false;
};

Processor.create = function (options) {
    return new Processor(options);
};

Processor._models = {
    /**
     * @param {string} route
     * @returns {object} cached
     */
    cached: function (route) {
        return {
            route: route,
            used: true,
            error: null
//            template: null,
//            requests: []
        };
    },
    /**
     * @param {string} routeId
     * @param {function} [callback]
     * @returns {object} task
     */
    task: function (routeId, callback) {
        return {
            routeId: routeId,
            fns: _.isFunction(callback) ? [callback] : []
        }
    }
};

/**
 * @param {Object} cached model
 * @returns {Function}
 * @private
 */
Processor._setUpContext = function (cached) {
    return function (context, next) {
        if (!_.isString(context.pathname))
            throw new Error('"context.pathname" is missing.');
        context.cached = cached;
        context.options = _.isObject(context.options) ? context.options : {};
        context.options.force = _.isBoolean(context.options.force) ? context.options.force : false;
        context.options.wait = _.isBoolean(context.options.wait) ? context.options.wait : false;
        context.options.solidifyContext = _.isObject(context.options.solidifyContext) ?
            context.options.solidifyContext : {};
        context.options.sessionID = _.isString(context.options.sessionID) ? context.options.sessionID : null;
        next(null);
    };
};

Processor._middlewares = {
    /**
     * Read the cache entry.
     * It should exists, so if it doesn't, the cache has a critical failure.
     * @param {object} context
     * @param {function} next
     */
    readCacheEntry: function (context, next) {
        this._cache.read(context.cached._id, function (err, doc) {
            if (err || !doc)
                return next(err || new Error('Critical failure! A cache entry has mysteriously disappeared...'));
            context.cached = doc;
            // this should happen only for internal phantom errors, not client javascript errors.
            if (context.cached.error) {
                console.log('[Crawlable] the last try gave us an error, try to recompute.');
                context.options.force = true;
            }
            next(null);
        });
    },
    /**
     * Pushes a task in the queue, so it can be processed as soon as possible.
     * @param {object} context
     * @param {function} next
     */
    renderPageIfNecessary: function (context, next) {
        if (context.options.force || !context.cached.template || context.cached.error)
            this._tasksQueue.push(Processor._models.task(
                context.cached._id, context.options.wait ? next : null
            ));
        else next(null);
    },
    /**
     * The page has been rendered, so we check for errors and finalize the template.
     * @param {object} context
     * @param {function} next
     */
    onPageRendered: function (context, next) {
        if (context.cached.error)
            return next(context.cached.error);
        if (!context.cached.template)
            return next(new errors.Internal("For unknowns reasons, the template couldn't have been processed."));

        var opts = {
            requests: context.cached.requests,
            template: context.cached.template,
            context: context.options.solidifyContext,
            host: this.options.host,
            sessionID: options.sessionID
        };

        // solidify the template by feeding it.
        return this._solidify.feed(opts, function (err, result) {
            if (err)
                return next(new error.Internal('Solidify error: ' + err.message));
            context.solidified = result;
            next(null);
        });
    }
};

/**
 * Register a new route in the processor router.
 * @param {RegExp|string|string[]} route
 * @param {function} [callback]
 */
Processor.prototype.route = function (route, callback) {
    var that = this;

    callback = _.isFunction(callback) ? callback : function () {};

    if (_.isArray(route))
        route = route.join('|');

    async.waterfall([
        function (next) {
            // try to get the _id if it exists.
            that._cache.read(route, 'route', next);
        },
        function (doc, next) {
            var cached = Processor._models.cached(route);
            if (doc)
                cached._id = doc._id;
            // save its current active state.
            this._cache.save(cached, next);
        },
        function (doc, next) {
            var fns = [Processor._setUpContext(doc)]
                .concat(_.toArray(Processor.middlewares))
                .concat([next]);

            // create the route.
            that._router.route(route, _.map(fns, function (fn) {
                return fn.bind(that);
            }));
        }
    ], callback);

};

/**
 * Starts the processor.
 * You need to call it before doing any action with the processor.
 * @param {function} callback
 */
Processor.prototype.start = function (callback) {
    var that = this;

    // create a queue to handle problem of concurrency and the case where phantom crashes.
    that._tasksQueue = async.queue(function (task, callback) {
        // this hack permit us to restart the queue after it has been stopped by setting concurrency to zero.
        if (task.ping)
            return callback(null);
        if (that._failure)
            return callback(new Error('PhantomJs is down! We recommend you to restart your server and check the phantom logs.'));
        // otherwise, process the page normally.
        that._render(task.route, task.options, function (err, res) {
            if (task.callback)
                task.callback(err, res);
            callback(null);
        });
    }, 0);

    // just add "stop" and "start" features to our queue.
    that._tasksQueue.stop = function () {
        this.concurrency = 0;
    };

    that._tasksQueue.start = function () {
        this.concurrency = that.options.concurrency;
        // this hack permit us to restart the queue after it has been stopped by setting concurrency to zero.
        this.unshift({ ping: true });
    };

    var oldPush = that._tasksQueue.push;
    that._tasksQueue.push = function (task) {
        // If the same task is already queued, we doesn't push it,
        // but just set the callback in the same existent task,
        // so it will be called with the same result.
        var eqTask = _.where(this.tasks, { routeId: task.routeId });
        if (eqTask)
            eqTask.fns = eqTask.concat(task.fns);
        else
            oldPush.call(this, task);
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
        that._setUpPhantomJs(phOpts, function (err) {
            if (err) {
                that._failure = true;
                return console.log('Couldn\'t restart PhantomJs after it crashed.');
            }
            that._tasksQueue.start();
        });
    };

    async.parallel([
        function (done) {
            that._setUpPhantomJs(phOpts, function (err) {
                if (err)
                    return done(err);
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
 * Sets up the PhantomJs execution context.
 * Immediately create the pages which will be used to render the html templates.
 * @param {object} options
 * @param {function} callback
 * @private
 */
Processor.prototype._setUpPhantomJs = function (options, callback) {
    var that = this;
    that._phantomPages = [];
    that._phantom = phantom.create(options, function (ph) {
        if (!ph) throw new Error('Couldn\'t restart PhantomJs after it crashed.');
        that._ph = ph;
        async.each(_.range(this.options.concurrency), function (i, done) {
            async.waterfall([
                function (next) {
                    that._ph.createPage(function (page) {
                        if (!page)
                            return next(new Error('Couldn\'t properly set up PhantomJs.'));
                        done(null, page);
                    });
                },
                function (page, next) {
                    page.set('settings', {
                        userAgent: 'crawlable',
                        javascriptEnabled: true,
                        loadImages: false
                    }, function () {
                        that._phantomPages.push(page);
                        next(null);
                    });
                }
            ], done);
        }, callback);
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
 * Call the router with a specific pathname.
 * @param {string} pathname
 * @param {function} callback
 */
Processor.prototype.call = function (pathname, callback) {
    this._router.call(pathname, function (err, context) {
        if (err)
            return callback(err);
        callback(null, context.solidified, context.cached);
    });
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
            var url = that.options.host + route;
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
Processor.prototype.onCacheActualize = function (data) {
//    console.log('Check cache --> ', data.luts + this.options.cacheTtl < +new Date());
    if (data.luts + this.options.cacheTtl < +new Date())
        this._tasksQueue.push({
            route: data._id,
            options: {
                host: this.options.host,
                force: true
            },
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

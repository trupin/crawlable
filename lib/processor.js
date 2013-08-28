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
    crypto = require('crypto'),
    RandExp = require('randexp');

var errors = require('./errors.js'),
    Cache = require('./cache.js'),
    Renderer = require('./renderer.js'),
    Persistence = require('./persistence.js'),
    Router = require('./router.js'),
    DefaultRenderer = require('../extensions/defaultRenderer.js'),
    DefaultPersistence = require('../extensions/nedb.js');

/**
 * Processor class.
 * @type {Function} Processor
 */
var Processor = module.exports = function (options) {
    this.options = options = _.isObject(options) ? options : {};

    if (!_.isString(options.host))
        throw new Error('The required field "host" is missing.');

    options.Persistence = _.isFunction(options.Persistence) ? options.Persistence : DefaultPersistence;
    options.persistenceOptions = _.isObject(options.persistenceOptions) ? options.persistenceOptions : {};

    this._persistence = new options.Persistence(options.persistenceOptions);
    if (!(this._persistence instanceof Persistence))
        throw new Error("The field 'Persistence' must be a daughter of the 'Persistence' base class.");

    options.cacheTtl = (_.isNumber(options.cacheTtl) ? options.cacheTtl : 60 * 60) * 1000; // one hour

    this._cache = Cache.create({
        persistence: this._persistence,
        ttl: options.cacheTtl
    });

    options.Renderer = _.isFunction(options.Renderer) ? options.Renderer : DefaultRenderer;
    options.rendererOptions = _.isObject(options.rendererOptions) ? options.rendererOptions : {};

    this._renderer = new options.Renderer(options.rendererOptions);
    if (!(this._renderer instanceof Renderer))
        throw new Error("The field 'Renderer' must be a daughter of the 'Renderer' base class.");

    this._solidify = Solidify.create({
        requester: _.isFunction(options.requester) ? options.requester : null
    });

    this._router = Router.create({
        onActualize: this.onCacheActualize.bind(this)
    });

    options.concurrency = _.isNumber(options.concurrency) ? options.concurrency : 10;
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
     * @param {string} pathname
     * @param {object} cached
     * @param {function} [callback]
     * @returns {object} task
     */
    task: function (routeId, pathname, cached, callback) {
        return {
            routeId: routeId,
            pathname: pathname,
            cached: _.omit(cached, 'template', 'requests'), // will be replaced anyway...
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

Processor._middlewares = [
    /**
     * Read the cache entry.
     * It should exists, so if it doesn't, the cache has a critical failure.
     * @param {object} context
     * @param {function} next
     */
    function (context, next) {
        this._cache.read(context.cached._id, function (err, doc) {
            if (err || !doc)
                return next(err || new Error('Critical failure! A cache entry has mysteriously disappeared...'));
            context.cached = doc;
            // this should happen only for internal phantom errors, not client javascript errors.
            if (context.cached.error) {
                console.log('[Crawlable] The last try gave us an error, try to recompute.');
                context.options.force = true;
                context.options.wait = true;
            }
            next(null);
        });
    },
    /**
     * Pushes a task in the queue, so it can be processed as soon as possible.
     * @param {object} context
     * @param {function} next
     */
    function (context, next) {
        if (context.options.force || !context.cached.template) {
            this._tasksQueue.push(Processor._models.task(
                context.cached._id, context.pathname, context.cached, !context.options.wait ? null :
                    function (err, cached) {
                        if (err) return next(err);
                        context.cached = cached;
                        next(null);
                    }
            ));
            if (!context.options.wait)
                next(null);
        }
        else next(null);
    },
    /**
     * The page has been rendered, so we check for errors and finalize the template.
     * @param {object} context
     * @param {function} next
     */
    function (context, next) {
        if (context.cached.error)
            return next(context.cached.error);
        if (!context.cached.template)
            return next(new errors.Internal("For unknowns reasons, the template couldn't have been processed."));

        var opts = {
            requests: context.cached.requests,
            template: context.cached.template,
            context: context.options.solidifyContext,
            host: this.options.host,
            sessionID: context.options.sessionID
        };

        // solidify the template by feeding it.
        return this._solidify.feed(opts, function (err, result) {
            if (err)
                return next(new errors.Internal('[Crawlable] Solidify error: ' + err.message));
            context.solidified = result;
            next(null);
        });
    }
];

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

    if (_.isString(route)) {
        route = route.replace(/\//g, '\\/').replace(/\*/, '[^/]*');
        route = new RegExp('^(' + route + ')$');
    }

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
            that._cache.save(cached, next);
        },
        function (doc, next) {
            var fns = [Processor._setUpContext(doc)].concat(Processor._middlewares);
            // create the route.
            that._router.route(route, _.map(fns, function (fn) {
                return fn.bind(that);
            }));

            next(null);
        }
    ], function (err) {
        callback(err);
    });
};

Processor.prototype.routes = function (routes, callback) {
    var that = this;
    async.forEachLimit(routes, 20, function (route, done) {
        that.route(route, done);
    }, callback);
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
            return callback(new errors.Internal('PhantomJs is down! We recommend you to restart your server and check the phantom logs.'));
        // otherwise, process the page normally.
        that._tasksInProcess[task.routeId] = task;
        that._render(task.pathname, task.cached, function (err, res) {
            that._tasksInProcess = _.omit(that._tasksInProcess, task.routeId);
            _.each(task.fns, function (fn) {
                fn(err, res);
            });
            callback(null);
        });
    }, 0);

    // just add "stop" and "start" features to our queue.
    that._tasksQueue.stop = function () {
        this.concurrency = 0;
    };

    var oldUnshift = that._tasksQueue.unshift;
    that._tasksQueue.start = function () {
        this.concurrency = that.options.concurrency;
        // this hack permit us to restart the queue after it has been stopped by setting concurrency to zero.
        oldUnshift({ ping: true });
    };

    // If the same task is already queued, we doesn't push/unshift it,
    // but just set the callback in the same existent task,
    // so it will be called with the same result.
    var oldPush = that._tasksQueue.push;
    that._tasksQueue.push = function (task) {
        var eqTask = _.find(that.tasks, { routeId: task.routeId }) || that._tasksInProcess[task.routeId];
        if (eqTask)
            eqTask.fns = eqTask.concat(task.fns);
        else
            oldPush.call(this, task);
    };
    that._tasksQueue.unshift = function (task) {
        var eqTask = _.find(that.tasks, { routeId: task.routeId }) || that._tasksInProcess[task.routeId];
        if (eqTask)
            eqTask.fns = eqTask.concat(task.fns);
        else
            oldUnshift.call(this, task);
    };


    var phOpts = {
        binary: __dirname + '/../.utils/phantomjs/bin/phantomjs'
    };

    // function called if phantom crashed. We need to restart it immediately in that case.
    phOpts.onCriticalExit = function () {
        console.log('[Crawlbale] PhantomJS exited with an abnormal error code and will be relaunched.');

        // stop the queue until phantom is not available.
        that._tasksQueue.stop();

        // be sure to firstly compute tasks which were in process at this time.
        var tasksToRelaunch = _.clone(that._tasksInProcess);
        that._tasksInProcess = {};

        _.each(tasksToRelaunch, function (task) {
            that._tasksQueue.unshift(task);
        });
        // this will avoid calling callbacks for nothing (also avoid calling it two times, which is very bad :o).

        // restart phantom
        that._setUpPhantomJs(phOpts, function (err) {
            if (err) {
                that._failure = true;
                return console.log('[Crawlable] Couldn\'t restart PhantomJs after it crashed.');
            }
            console.log('[Crawlable] Restarted.');
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
        async.forEach(_.range(that.options.concurrency), function (i, done) {
            async.waterfall([
                function (next) {
                    that._ph.createPage(function (page) {
                        if (!page)
                            return next(new Error('Couldn\'t properly set up PhantomJs.'));
                        next(null, page);
                    });
                },
                function (page, next) {
                    page.set('settings', {
                        userAgent: 'crawlable',
                        javascriptEnabled: true,
                        loadImages: false
                    }, function () {
                        that._phantomPages.push({ available: true, page: page });
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
 * @param {object} options
 * @param {function} callback
 */
Processor.prototype.call = function (pathname, options, callback) {
    callback = _.isFunction(callback) ? callback : options;
    options = _.isObject(options) ? options : {};

    var context = {
        pathname: pathname,
        options: options
    };

    this._router.call(pathname, context, function (err, context) {
        if (err)
            return callback(err);
        callback(null, context.solidified, context.cached);
    });
};

/**
 * Renders a page for a specified route.
 * @param {string} pathname
 * @param {object} cached
 * @param {function} callback
 * @private
 */
Processor.prototype._render = function (pathname, cached, callback) {
    var that = this;

    var phPage = _.find(that._phantomPages, { available: true }),
        url = that.options.host + pathname;

    phPage.available = false;

    async.waterfall([
        function (next) {
            phPage.page.open(url, function (status) {
                if (status !== 'success')
                    return next(new Error('Couldn\'t load the web page at this address: "' + url + '".'));
                next(null);
            });
        },
        function (next) {
            that._renderer.run(phPage.page, next);
        },
        function (rawTemplate, next) {
            phPage.available = true;
            var rendered = that._solidify.compile(rawTemplate);
            if (!rendered)
                return next(new Error('Could\'t compile the template.'));
            cached.template = rendered.template;
            cached.requests = rendered.requests;
            that._cache.save(cached, next);
        }
    ], callback);

};

/**
 * Triggered on read to check the time to live, and refresh if necessary.
 * @param data
 */
Processor.prototype.onCacheActualize = function (data) {
    if (data.luts + this.options.cacheTtl < +new Date()) {
        var pathname = new RandExp(data.route).gen();
        this._tasksQueue.push(Processor._models.task(data._id, pathname, data, function (err) {
            if (err)
                return console.log('[Crawlable] Couldn\'t actualize the cache entry for route: "' + data.route + '".');
            console.log('[Crawlable] The cache entry with the route "' + data.route + '" has been actualized.');
        }));
    }
};

/**
 * Generates some random but valid path names in order to compute the cache.
 * This method can be called each time you want to refresh all the cache
 * @param callback
 */
Processor.prototype.crawl = function (callback) {
    var that = this;

    callback = _.isFunction(callback) ? callback : function () {};

    async.forEachLimit(that._router.routes, that.options.concurrency, function (route, done) {
        var pathname = new RandExp(route.regexp).gen();
        that.call(pathname, { force: true, wait: true }, function (err) {
            if (err)
                return done(err);
            console.log('[Crawlable][' + route.regexp + '] Crawled.');
            done(null);
        });
    }, callback);
};

/**
 * Express middleware.
 * @returns {Function}
 */
Processor.prototype.express = function (options) {
    var that = this;

    options = _.isObject(options) ? options : {};
    options.onNotFound = _.isFunction(options.onNotFound) ? options.onNotFound : null;

    return function (req, res, next) {

        req.crawlable = req.crawlable || {};
        req.crawlable.html = '';

        if (req.headers['user-agent'] == 'crawlable' || req.solidify)
            return next();

        req.session.save();

        var opts = {
            solidifyContext: _.extend(
                req.query || {},
                req.params || {},
                req.body || {}
            ),
            sessionID: req.sessionID
        };

        if (req.query.regenerate) {
            opts.force = true;
            opts.wait = true;
        }

        if (!that._router.match(req._parsedUrl.pathname)) {
            if (_.isString(options.notFound))
                return that.call(options.notFound, opts, function (err, page) {
                    if (err) return res.send(404);
                    req.crawlable.html = page.html;
                    next();
                });
            return res.send(404);
        }

        that.call(req._parsedUrl.pathname, opts, function (err, page) {
            if (err) {
                console.log('[Crawlable middleware][' + req._parsedUrl.pathname + ']' + err.message);
                req.crawlable.html = '';
            }
            else {
                req.crawlable.html = page.html;
                req.session = _.extend(req.session, page.session);

                res.on('header', function () {
                    _.each(page.cookies, function (cookie) {
                        res.setHeader('Set-Cookie', cookie);
                    });
                });
            }
            next();
        });
    };
};

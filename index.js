/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 12:08 PM
 */

var that = exports;

var _ = require('underscore');

var throwIfMissing = require('./lib/tools.js').throwIfMissing;

that.Client = require('./lib/client.js');
that.db = require('./lib/db.js');

/**
 * Initializes the cache and automatically creates a client.
 * @param options
 * @param callback
 */
that.initialize = function (options, callback) {
    callback = _.isFunction(callback) ? callback : options;
    options = _.isObject(options) ? options : {};

    that._template = _.isString(options.template) ? options.template : throwIfMissing("template");
    if (options.template !== undefined) delete options.template;

    that.db.initialize(function (err) {
        if (err) return callback(err);
        that.client = that.Client.create(options);
        that.client.start(callback);
    })
};

/**
 * The express route.
 * @param req
 * @param res
 */
that.express = function (req, res) {
//    req.originalUrl = req.originalUrl.replace(/\?.*/, '');

    var context = {
        rootUrl: 'http://' + req.headers.host.replace('http://', '')
    };

    if (req.headers['user-agent'] == 'phantom.js')
        return res.render(that._template, context);

    var options = {
        pathname: req._parsedUrl.pathname,
        host: 'http://' + req.headers.host,
        context: _.extend(
            req.query || {},
            req.params || {},
            req.body || {}
        )
    };
    if (req.query.regenerate) {
        options.forceRegeneration = true;
        options.waitForRegeneration = true;
    }

    that.client.getStaticHtml(options,
        function (err, page) {
            if (err) console.log(err);
            context.staticHtml = err ? '' : page.get('html');
            res.render(that._template, context);
        }
    );
};
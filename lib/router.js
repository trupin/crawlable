/**
 * User: rupin_t
 * Date: 8/21/13
 * Time: 2:22 PM
 */

var _ = require('lodash'),
    async = require('async');

var errors = require(errors);

/**
 * @type {Function}
 */
var Router = module.exports = function () {
    /** @private */ this._routes = [];
};

Router.create = function (options) {
    return new Router(options);
};

/**
 * Start the router.
 * @this {Router}
 * @param {function} callback
 */
Router.prototype.start = function (callback) {
    if (_.isFunction(callback)) callback(null);
};

/**
 * Registers a route with its middlewares.
 * @this {Router}
 * @param {string|RegExp} route
 * @param {function[]} fns
 * @return {string} string
 */
Router.prototype.route = function (route, fns) {
    if (_.isString(route)) {
        while (route.indexOf('/'))
            route.replace('/', '\\/');

        while (route.indexOf('*'))
            route.replace('*', '[^/]*');

        route = new RegExp('^(' + route + ')$');
    }
    this._routes.push({ regexp: route, fns: fns });
};

/**
 * Match a route for a pathname.
 * @param {string} pathname
 * @returns {object}
 */
Router.prototype.match = function (pathname) {
    for (var i = 0; i < this._routes.length; ++i) {
        if (pathname.match(this._routes[i].regexp))
            return this._routes[i];
    }
    return null;
};

/**
 * Simulates a route call.
 * @param {string} pathname
 * @param {object} context
 * @param {function} callback
 */
Router.prototype.call = function (pathname, context, callback) {
    context = _.cloneDeep(context);
    context.pathname = pathname;
    context.matchedRoute = this.match(pathname);
    if (!context.matchedRoute)
        callback(new error.NotFound('Couldn\'t find the route "' + route + '"'));
    else {
        async.forEachSeries(context.matchedRoute.fns, function (fn, done) {
            fn(context, done);
        }, function (err) {
            callback(err, context);
        });
    }
    return context;
};

/**
 *
 * @param {function} each
 */
Router.prototype.each = function (each) {
    _.forEach(this._routes, each);
};
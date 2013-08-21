/**
 * User: rupin_t
 * Date: 8/21/13
 * Time: 2:22 PM
 */

var Router = module.exports = function (options) {
    this.options = options = _.isObject(options) ? options : {};
};

Router.create = function (options) {
    return new Router(options);
};

/**
 * Start the router.
 * @param callback
 */
Router.prototype.start = function (callback) {
};

/**
 * Register a route with its middlewares.
 */
Router.prototype.route = function () {
};


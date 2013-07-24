/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 10:49 AM
 */

var _ = require('lodash'),
    async = require('async'),
    cluster = require('./cluster.js');

var Cache = require('./cache.js'),
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

    options.Renderer = _.isFunction(options.Renderer) ? options.Renderer : Renderer;
    options.rendererOptions = _.isObject(options.rendererOptions) ? options.rendererOptions : {};
    options.rendererOptions = _.defaults(options.rendererOptions, { host: options.host });

    this._renderer = new options.Renderer(options.rendererOptions);
    if (!(this._renderer instanceof Renderer))
        throw new Error("The field 'renderer' needs to be a Renderer instance.");

    processing += 1;
};

Processor.create = function (options) {
    return new Processor(options);
};

Processor.prototype.start = function (callback) {
    cluster.registerTask('render', _.bind(this._renderer.run, this._renderer));
    cluster.start();
    this._cache.start(callback);
};

Processor.prototype.stop = function (callback) {
    processing -= 1;
    var fns = [];
    fns.push(function (done) {
        this._cache.stop(done);
    });
    if (!processing) { // only if there is no started processor.
        fns.push(function (done) {
            cluster.stop(done);
        });
    }
    async.series(fns, callback);
};

Processor.prototype.render = function (route, callback) {
    cluster.exec('render', { route: route }, callback);
};
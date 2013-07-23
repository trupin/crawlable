/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 10:49 AM
 */

var _ = require('lodash'),
    async = require('async'),
    cluster = require('./cluster.js');

var Cache = require('./cache.js');

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
    options.cacheOptions = _isObject(options.cacheOptions) ? options.cacheOptions : {};

    this._cache = new options.Cache(options.cacheOptions);
    if (!(this._cache instanceof Cache))
        throw new Error("The field 'cache' needs to be a Cache instance.");

    processing += 1;
};

Processor.create = function (options) {
    return new Processor(options);
};

Processor.prototype.start = function (callback) {
    cluster.registerTask();
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

Processor.prototype.computeHtml = function (pathname, callback) {

};
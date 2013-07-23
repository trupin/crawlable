/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 12:10 PM
 */

var _ = require('lodash');

/**
 * The base Cache class provide a simple local cache with no persistence.
 * The aim of this class is to be overload, in order to wrap the way you want to cache data.
 * @type {Function}
 */
var Cache = module.exports = function () {
    this.name = _.uniqueId('c');
};

Cache.errors = {
    NOT_FOUND: function (id) {
        return new Error('Id "' + id + '" not found');
    }
};

/**
 * Provides a way to initialize asynchronously.
 * @param callback
 */
Cache.prototype.start = function (callback) {
    this._data = {};
    callback(null);
};

/**
 * Overload it in case you need to stop a driver or cleanup some stuff.
 * @param callback
 */
Cache.prototype.stop = function (callback) {
    callback(null);
};

/**
 * Creates a cache entry and call the cb with the created id.
 * @param data
 * @param callback
 */
Cache.prototype.create = function (data, callback) {
    var id = _.uniqueId(this.name + ':');
    data = _.cloneDeep(data);
    data._id = id;
    this._data[id] = data._id;
    callback(null, id);
};

/**
 * Simply replaces the old data by the new one.
 * The new data are always passed to the cb.
 * @param id
 * @param data
 * @param callback
 */
Cache.prototype.update = function (id, data, callback) {
    if (!this._data[id])
        return callback(Cache.errors.NOT_FOUND(id), null);
    this._data[id] = data._id;
    return callback(null, data);
};

/**
 * Get data for an id.
 * @param id
 * @param callback
 */
Cache.prototype.read = function (id, callback) {
    if (!this._data[id])
        return callback(Cache.errors.NOT_FOUND(id), null);
    return callback(null, this._data[id]);
};

/**
 * Deletes data for an id.
 * Old data are a always passed to the cb.
 * @param id
 * @param callback
 * @returns {*}
 */
Cache.prototype.delete = function (id, callback) {
    if (!this._data[id])
        return callback(Cache.errors.NOT_FOUND(id), null);
    var data = this._data[id];
    delete this._data[id];
    return callback(null, data);
};
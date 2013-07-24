/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 12:10 PM
 */

var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('eventemitter2').EventEmitter2;

/**
 * The base Cache class provide a simple local cache with no persistence.
 * The aim of this class is to be overload, in order to wrap the way you want to cache data.
 * @type {Function}
 */
var Cache = module.exports = function () {
    this.name = _.uniqueId('c');
    this.on('create', this.onCreate.bind(this));
    this.on('update', this.onUpdate.bind(this));
    this.on('delete', this.onDelete.bind(this));
    this.on('read', this.onRead.bind(this));
    EventEmitter.apply(this, arguments);
};

util.inherits(Cache, EventEmitter);

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
    if (_.isFunction(callback))
        callback(null);
};

/**
 * Overload it in case you need to stop a driver or cleanup some stuff.
 * @param callback
 */
Cache.prototype.stop = function (callback) {
    if (_.isFunction(callback))
        callback(null);
};

/**
 * Creates a cache entry.
 * This will generate the field _id.
 * @param data
 * @param callback
 */
Cache.prototype.create = function (data, callback) {
    var id = data._id = data._id || _.uniqueId(this.name + ':');
    data = _.cloneDeep(data);
    this.emit('create', data);
    this._data[id] = data;
    callback(null, _.cloneDeep(data));
};

/**
 * Triggered on create.
 * @param data
 */
Cache.prototype.onCreate = function (data) {
    data.cts = data.luts = +new Date();
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
    data = _.cloneDeep(data);
    this.emit('update', data);
    this._data[id] = data;
    return callback(null, data);
};

/**
 * Triggered on update.
 * @param data
 */
Cache.prototype.onUpdate = function (data) {
    data.luts = +new Date();
};

/**
 * Get data for an id.
 * @param id
 * @param callback
 */
Cache.prototype.read = function (id, callback) {
    var data = this._data[id];
    if (!data)
        return callback(Cache.errors.NOT_FOUND(id), null);
    data = _.cloneDeep(data);
    this.emit('read', data);
    return callback(null, data);
};

/**
 * Triggered on read.
 * @param data
 */
Cache.prototype.onRead = function (data) {};

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
    var data = _.cloneDeep(this._data[id]);
    this._data[id] = null;
    this.emit('delete', data);
    return callback(null, data);
};

/**
 * Triggered on delete.
 * @param data
 */
Cache.prototype.onDelete = function (data) {};
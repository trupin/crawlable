/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 12:10 PM
 */

var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    crypto = require('crypto');

var errors = require('./errors.js');

/**
 * The base Persistence class provide a simple local memory storage.
 * The aim of this class is to be overload, in order to wrap the way you want to cache data.
 * @class Persistence
 */
var Persistence = module.exports = function () {
    EventEmitter.apply(this, arguments);

    this.name = _.uniqueId('c');
    this.on('create', this.onCreate.bind(this));
    this.on('update', this.onUpdate.bind(this));
    this.on('delete', this.onDelete.bind(this));
    this.on('read', this.onRead.bind(this));
};

util.inherits(Persistence, EventEmitter);

/**
 * Provides a way to initialize asynchronously.
 * @param {function} callback
 */
Persistence.prototype.start = function (callback) {
    /** @private */ this._data = {};
    (_.isFunction(callback) ? callback : function () {})(null);
};

/**
 * Overload it in case you need to stop a driver or cleanup some stuff.
 * @param {function} callback
 */
Persistence.prototype.stop = function (callback) {
    if (_.isFunction(callback))
        callback(null);
};

/**
 * Creates a cache entry.
 * This will generate the field _id.
 * @param {object} data
 * @param {function} callback
 */
Persistence.prototype.create = function (data, callback) {
    var id = data._id = data._id || _.uniqueId(this.name + ':');
    data = _.cloneDeep(data);
    this.emit('create', data);
    this._data[id] = data;
    callback(null, _.cloneDeep(data));
};

/**
 * Triggered on create.
 * @param {object} data
 */
Persistence.prototype.onCreate = function (data) {
    data.cts = data.luts = +new Date();
};

/**
 * Simply replaces the old data by the new one.
 * The new data are always passed to the cb.
 * @param {string} id
 * @param {object} data
 * @param {function} callback
 */
Persistence.prototype.update = function (id, data, callback) {
    if (!this._data[id])
        return callback(new errors.NotFound(id), null);
    data = _.cloneDeep(data);
    this.emit('update', data);
    this._data[id] = data;
    return callback(null, data);
};

/**
 * Triggered on update.
 * @param {object} data
 */
Persistence.prototype.onUpdate = function (data) {
    data.luts = +new Date();
};

/**
 * Get data for an id.
 * @param {string} id
 * @param {string} [field] --> should be a unique field.
 * @param callback
 */
Persistence.prototype.read = function (id, field, callback) {
    if (_.isFunction(field))
        callback = field;
    var data = this._data[id];
    if (!data)
        return callback(new errors.NotFound(id), null);
    data = _.cloneDeep(data);
    this.emit('read', data);
};

/**
 * Triggered on read.
 * @param data
 */
Persistence.prototype.onRead = function (data) {
    // Nothing to do here.
};

/**
 * Deletes data for an id.
 * Old data are a always passed to the cb.
 * @param id
 * @param callback
 * @returns {*}
 */
Persistence.prototype.delete = function (id, callback) {
    if (!this._data[id])
        return callback(new errors.NotFound(id), null);
    var data = _.cloneDeep(this._data[id]);
    this._data[id] = null;
    this.emit('delete', data);
    return callback(null, data);
};

/**
 * Triggered on delete.
 * @param data
 */
Persistence.prototype.onDelete = function (data) {
    // Nothing to do there
};
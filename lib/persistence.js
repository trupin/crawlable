/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 12:10 PM
 */

var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    crypto = require('crypto');

/**
 * The base Persistence class provide a simple local memory storage.
 * The aim of this class is to be overload, in order to wrap the way you want to cache data.
 * @type {Function}
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

Persistence.errors = {
    NOT_FOUND: function (id) {
        return new Error('Id "' + id + '" not found');
    }
};

/**
 * Provides a way to initialize asynchronously.
 * @param callback
 */
Persistence.prototype.start = function (callback) {
    this._data = {};
    (_.isFunction(callback) ? callback : function () {})(null);
};

/**
 * Overload it in case you need to stop a driver or cleanup some stuff.
 * @param callback
 */
Persistence.prototype.stop = function (callback) {
    if (_.isFunction(callback))
        callback(null);
};

/**
 * Compute an unique hash from the html template.
 * @param data
 * @returns {*}
 */
Persistence.prototype.hash = function (data) {
    var shasum = crypto.createHash('md5');
    return shasum.update(JSON.stringify(data.html)).digest('hex');
};

/**
 * Check if there is a way to factorize the templates and if so, does it.
 * @param data
 */
Persistence.prototype.factorize = function (data) {
    // Only available with an index support (see nedb extension).
};

/**
 * Check if it is necessary to dereference and if so, fetch the html template.
 * @param data
 * @param callback
 */
Persistence.prototype.dereference = function (data, callback) {
    // Only available with an index support (see nedb extension).
    callback(null, data);
};

/**
 * Creates a cache entry.
 * This will generate the field _id.
 * @param data
 * @param callback
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
 * @param data
 */
Persistence.prototype.onCreate = function (data) {
    data.cts = data.luts = +new Date();
    data._hash = this.hash(data);
    this.factorize(data);
};

/**
 * Simply replaces the old data by the new one.
 * The new data are always passed to the cb.
 * @param id
 * @param data
 * @param callback
 */
Persistence.prototype.update = function (id, data, callback) {
    if (!this._data[id])
        return callback(Persistence.errors.NOT_FOUND(id), null);
    data = _.cloneDeep(data);
    this.emit('update', data);
    this._data[id] = data;
    return callback(null, data);
};

/**
 * Triggered on update.
 * @param data
 */
Persistence.prototype.onUpdate = function (data) {
    data.luts = +new Date();
    data._hash = this.hash(data);
    this.factorize(data);
};

/**
 * Get data for an id.
 * @param id
 * @param [field] --> should be a unique field.
 * @param callback
 */
Persistence.prototype.read = function (id, field, callback) {
    if (_.isFunction(field))
        callback = field;
    var data = this._data[id];
    if (!data)
        return callback(Persistence.errors.NOT_FOUND(id), null);
    data = _.cloneDeep(data);
    this.emit('read', data);
    this.dereference(data, callback);
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
        return callback(Persistence.errors.NOT_FOUND(id), null);
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
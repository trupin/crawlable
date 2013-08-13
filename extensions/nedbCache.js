/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 10:48 AM
 */

var util = require('util'),
    _ = require('lodash'),
    Datastore = require('nedb');

var BaseCache = require('../lib/cache.js');

var Cache = module.exports = function (options) {
    BaseCache.apply(this, arguments);

    options = options || {};

    this.filename = options.filename || (__dirname + '/../.data/neDbCacheStore');
    this.db = new Datastore(_.defaults(options, {
        filename: this.filename
    }));
};

util.inherits(Cache, BaseCache);

Cache.prototype.start = function (callback) {
    this.db.loadDatabase(function (err) {
        if (err) return callback(new Error(err.message));
        this.db.ensureIndex({ fieldName: '_url', unique: true }, callback);
    }.bind(this));
};

Cache.prototype.stop = function (callback) {
    if (_.isFunction(callback)) callback(null);
};

var beforeStore = function (id, data) {
    data._url = id;
    data._id = data.__id__;
    return data;
};

var beforeRetrieve = function (data) {
    data.__id__ = data._id;
    data._id = data._url;
    return data;
};

Cache.prototype.create = function (data, callback) {
//    console.log('create data --->', data);
    data = beforeStore(data._id, _.cloneDeep(data));
    this.emit('create', data);
    this.db.insert(data, function (err, data) {
        if (err) return callback(new Error(err.message));
        callback(null, beforeRetrieve(data));
    });
};

Cache.prototype.update = function (id, data, callback) {
    data = _.cloneDeep(data);
    this.emit('update', data);
    data = beforeStore(id, data);
    this.db.update({ _url: id }, data, {}, function (err, num) {
        if (err) return callback(new Error(err.message));
        if (!num) return callback(BaseCache.errors.NOT_FOUND(id));
        callback(null, beforeRetrieve(data));
    });
};

Cache.prototype.read = function (id, callback) {
//    console.log('read id --->', id);
    this.db.findOne({ _url: id }, function (err, doc) {
        if (err) return callback(new Error(err.message));
        if (doc)
            this.emit('read', beforeRetrieve(doc));
//        console.log('read result --->', doc);
        callback(null, doc);
    }.bind(this));
};

Cache.prototype.delete = function (id, callback) {
    this.read(id, function (err, doc) {
        if (err) return callback(new Error(err.message));
        if (!doc) return callback(BaseCache.errors.NOT_FOUND(id));
        this.db.remove({ _url: id }, {}, function (err, num) {
            if (err) return callback(new Error(err.message));
            if (!num) return callback(BaseCache.errors.NOT_FOUND(id));
            this.emit('delete', doc);
            callback(null, doc);
        }.bind(this));
    }.bind(this));
};

Cache.prototype.search = function (query, callback) {
    if (query instanceof RegExp) {
        this.db.find({ _url: { $regex: query } }, function (err, res) {
            if (err) return callback(err);
            callback(null, _.map(res, beforeRetrieve));
        });
    }
    else callback(null, []);
};
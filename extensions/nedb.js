/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 10:48 AM
 */

var util = require('util'),
    _ = require('lodash'),
    Datastore = require('nedb'),
    async = require('async');

var BasePersistence = require('../lib/persistence.js');

var Persistence = module.exports = function (options) {
    BasePersistence.apply(this, arguments);

    options = options || {};

    this.filename = options.filename || (__dirname + '/../.data/nedb-persistence');

    var opts = _.defaults(options, { filename: this.filename });

    this.db = new Datastore(opts);
};

util.inherits(Persistence, BasePersistence);

Persistence.prototype.start = function (callback) {
    this.db.loadDatabase(function (err) {
        callback(err ? new Error(err.message) : null);
    });
};

Persistence.prototype.stop = function (callback) {
    if (_.isFunction(callback)) callback(null);
};

Persistence.prototype.create = function (doc, callback) {
    var that = this;
    doc = _.cloneDeep(doc);
    that.emit('create', doc);
    that.db.insert(doc, function (err, doc) {
        if (err) return callback(new Error(err.message));
        callback(null, doc);
    });
};

Persistence.prototype.update = function (id, doc, callback) {
    doc = _.cloneDeep(doc);
    this.emit('update', doc);
    this.db.update({ _id: id }, doc, {}, function (err, num) {
        if (err) return callback(new Error(err.message));
        if (!num) return callback(BasePersistence.errors.NOT_FOUND(id));
        callback(null, doc);
    });
};

Persistence.prototype.read = function (id, field, callback) {
    var that = this;
    if (_.isFunction(field)) {
        callback = field;
        field = '_id';
    }
    var query = {};
    query[field] = id;
    this.db.findOne(query, function (err, doc) {
        if (err) return callback(new Error(err.message));
        if (doc) that.emit('read', doc);
        callback(null, doc);
    });
};

Persistence.prototype.delete = function (id, callback) {
    var that = this;
    this.read(id, function (err, doc) {
        if (err) return callback(new Error(err.message));
        if (!doc) return callback(BasePersistence.errors.NOT_FOUND(id));
        that.db.remove({ _id: id }, {}, function (err, num) {
            if (err) return callback(new Error(err.message));
            if (!num) return callback(BasePersistence.errors.NOT_FOUND(id));
            that.emit('delete', doc);
            callback(null, doc);
        });
    });
};

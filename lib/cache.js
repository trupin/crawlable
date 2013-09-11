/**
 * User: rupin_t
 * Date: 8/21/13
 * Time: 3:19 PM
 */

var async = require('async'),
    _ = require('lodash');

var Persistence = require('./persistence');

/**
 * This class manages the cache storage.
 * Its goal is to be able to create, save, delete some cache entries and keep a stable memory impact.
 * @type {Function}
 */
var Cache = module.exports = function (options) {
    this.options = options = _.isObject(options) ? options : {};

    if (!(options.persistence instanceof Persistence))
        throw new Error('The "persistence" options must be of type "Persistence".');
    this._db = options.persistence;

    options.ttl = (_.isNumber(options.ttl) ? options.ttl : (60 * 3)) * 1000;

    options.onActualize = _.isFunction(options.onActualize) ? options.onActualize : null;
    if (options.onActualize)
        options._db.on('read', this._checkTtl.bind(this));
};

Cache.create = function (options) {
    return new Cache(options);
};

Cache.prototype.start = function (callback) {
    this._db.start(callback);
};

Cache.prototype.stop = function (callback) {
    this._db.stop(callback);
};

Cache.prototype.read = function (id, field, callback) {
    this._db.read(id, field, callback);
};

Cache.prototype.save = function (doc, callback) {
    var that = this;
    async.waterfall([
        function (next) {
            if (doc._id)
                that.read(doc._id, next);
            else next(null, null);
        },
        function (exists, next) {
            if (!exists)
                that._db.create(doc, next);
            else
                that._db.update(doc._id, _.omit(doc, '_id'), next);
        }
    ], callback);
};

Cache.prototype.delete = function (doc, callback) {
    this._db.delete(doc._id, callback);
};

Cache.prototype._checkTtl = function (doc) {
    if (doc.luts + this.options.ttl < +new Date())
        this.options.onActualize(doc);
};
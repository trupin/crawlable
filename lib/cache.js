/**
 * User: rupin_t
 * Date: 8/21/13
 * Time: 3:19 PM
 */

var async = require('async'),
    _ = require('lodash');

var Persistence = require('./persistence.js');

var Cache = module.exports = function (options) {
    this.options = options = _.isObject(options) ? options : {};

    this._db = options.persistence = (options.persistence instanceof Persistence) ?
        options.persistence : Persistence.create();

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

Cache.prototype.read = function (pathname, callback) {
    this._db.read(pathname, '_pathname', callback);
};

Cache.prototype.save = function (doc, options, callback) {
    var that = this;

    callback = _.isFunction(callback) ? callback : options;
    options = (_.isObject(options) && !_.isFunction(options)) ? options : {};

    async.waterfall([
        function (next) {
            if (doc._id)
                that._db.read(doc._id, next);
            else next(null, null);
        },
        function (res, next) {
            doc
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
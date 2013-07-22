/**
 * User: rupin_t
 * Date: 6/27/13
 * Time: 4:09 PM
 */

var util = require('util'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    _ = require('underscore'),
    async = require('async');

var Cursor = require('mongodb').Cursor,
    ObjectID = require('mongodb').ObjectID;

var missing = require('./tools.js').missing,
    binded = require('./tools.js').binded;

var errors = require('./error.js');

/**
 * To determine if an ID is valid or not
 * @param id
 * @returns {*}
 */
ObjectID.isValid = function (id) {
    return !!id.match(new RegExp("^[0-9a-fA-F]{24}$"));
};

/**
 * A Model base class to manage the persistence of the data
 * The collection attribute must be overloaded.
 * @constructor
 * @param {object} data
 * @param {object} options -> if collection is not set, all collection linked methods will fail.
 */
exports.Model = function (data, options) {
    options = options || {};
    this.created = !!options.created;
    if (options.created) {
        this.data = {};
        this.storedData = data;
    }
    else {
        this.data = data;
        this.storedData = {};
    }
    this.attachToCollection(options.collection);
};

util.inherits(exports.Model, EventEmitter);

/**
 * Automatically called at construction if options.collection is set.
 * In case you didn't passed options.collection, you can call it manually.
 * @param collection
 */
exports.Model.prototype.attachToCollection = function (collection) {
    if (!collection) return ;
    this.collection = collection;
    if (this.data.id !== undefined) {
        this.data[this.collection.index] = this.data.id;
        delete this.data.id;
    }
    if (this.created && this.getId() === undefined)
        throw new errors.NotFound('Cannot find the model id.');
};

exports.Model.prototype.set = function (attr, value) {
    if (attr == this.collection.index)
        throw new Error('Cannot set the indexed attribute.');
    this.data[attr] = value;
};

exports.Model.prototype.getId = function () {
    return this.storedData[this.collection.index];
};

exports.Model.prototype.get = function (attr) {
    if (attr == 'id')
        return this.storedData[this.collection.index];
    return this.data[attr] || this.storedData[attr];
};

exports.Model.prototype.put = function (data, callback) {
    if (!callback) {
        callback = data;
        data = {};
    }
    this.data = _.extend(this.data, data);
    this.collection.put(this, callback);
};

exports.Model.prototype.delete = function (callback) {
    this.collection.delete(this, callback);
};

/**
 * Gets the serialized JSON object.
 * @param {boolean} pretty
 * @returns {string}
 */
exports.Model.prototype.toJSONString = function (pretty) {
    pretty = pretty !== undefined ? pretty : true;
    if (!pretty)
        return JSON.stringify(this.toJSON());
    return JSON.stringify(this.toJSON(), ' ', 2);
};

/**
 * Gets the JSON object. By default, return the public data.
 * @returns {object}
 */
exports.Model.prototype.toJSON = function () {
    return _.extend(this.storedData || {}, this.data || {});
};

/**
 * A Collection base class to manage the way mongo store the models
 * @param options
 * @constructor
 */
exports.Collection = function (options) {
    var _missing = missing.bind(this);

    options = options || {};
    this.name = options.name || _missing('name');
    this.Model = options.Model || _missing('Model');
    this.index = options.index || '_id';

    if (this._error)
        throw this._error;
};

util.inherits(exports.Collection, EventEmitter);

/**
 * Mongo server configuration --> to overload.
 * @type {{name: string, host: string, port: string}}
 */
exports.database = {
    name: 'test',
    host: '127.0.0.1',
    port: '27017'
};

/**
 * Initialize the unique used database for this application.
 * @param callback
 */
exports.initDatabase = function (callback) {
    var MongoClient = require('mongodb').MongoClient,
        Server = require('mongodb').Server;

    exports.Collection.client = new MongoClient(
        new Server(exports.database.host, exports.database.port, {
            auto_reconnect: true
        })
    );

    exports.Collection.client.open(function (err) {
        if (err) return callback(err);
        exports.Collection.db = exports.Collection.client.db(
            exports.database.name
        );
        return callback(null);
    });
};

/**
 * Initialize a collection by ensuring the collection exists with its indexes.
 * @param callback
 */
exports.Collection.prototype.initialize = function (options, callback) {
    callback = callback || options;
    options = options || {};
    async.waterfall(binded([
        function (next) {
            exports.Collection.db.createCollection(this.name, options, next);
        },
        function (collection, next) {
            this.collection = collection;
            var index = {};
            index[this.index] = 1;
            collection.ensureIndex(index, {unique:true}, next);
        }
    ], this), function (err) { callback(err) });
};

/**
 * Creates a Model in this collection.
 * @param data
 * @param callback
 */
exports.Collection.prototype.post = function (data, callback) {
    if (!(data instanceof exports.Model))
        data = new this.Model(data, { collection: this, created: false });
    data = data.toJSON();
    this.collection.insert(data, function (err, res) {
        if (err)
            return callback(err);
        try {
            callback(null, new this.Model(res[0], { created: true, collection: this }));
        } catch (e) {
            callback(e);
        }
    }.bind(this));
};

/**
 * Put some new data into a model of this collection.
 * @param model
 * @param callback
 * @returns {*}
 */
exports.Collection.prototype.put = function (model, callback) {
    if (model instanceof exports.Model) {
        if (!_.keys(model.storedData).length || !model.created)
            return callback(new errors.Internal('Cannot put on a non created model.'));
    }
    else {
        try {
            model = new this.Model(model, { collection: this, created: true });
        } catch (e) {
            return callback(e);
        }
        model.data = _.omit(model.storedData, this.index);
    }
    var id = model.getId(), req = {};
    req[this.index] = id;
    if (ObjectID.isValid(id))
        req[this.index] = new ObjectID(id);
    async.waterfall(binded([
        function (next) {
            this.collection.findAndModify(req, [], {$set: model.data}, {new:true}, next);
        },
        function (doc, __, next) {
            if (!doc)
                return next(new errors.NotFound('Couldn\'t find the model'));
            model.storedData = doc;
            next(null, model);
        }
    ], this), callback);
};

/**
 * Gets a model from this collection.
 * @param id
 * @param callback
 */
exports.Collection.prototype.get = function (id, callback) {
    var req = {};
    req[this.index] = id;
    if (id === undefined)
        return callback(new errors.NotFound('Cannot find the model id.'));
    if (ObjectID.isValid(id))
        req[this.index] = new ObjectID(id);
    this.collection.find(req).limit(1).toArray(function (err, doc) {
        if (err)
            return callback(err);
        if (!doc.length)
            return callback(new errors.NotFound('The model with id "' + this.index + '" = "' + id + '" doesn\'t exists.'));
        doc = doc[0];
        try {
            return callback(null, new this.Model(doc, { created: true, collection: this }));
        } catch (e) {
            return callback(e);
        }
    }.bind(this));
};

/**
 * Deletes a model from this collection.
 * @param model
 * @param callback
 * @returns {*}
 */
exports.Collection.prototype.delete = function (model, callback) {
    if (model instanceof exports.Model) {
        if (!_.keys(model.storedData).length || !model.created)
            return callback(new Error('Cannot delete a non created model.'));
    }
    else if (_.isObject(model))
        try {
            model = new this.Model(model, { collection: this, created: true });
        } catch (e) {
            return callback(e);
        }
    else if (_.isString(model)) {
        var m = {};
        m[this.index] = model;
        model = new this.Model(m, { collection: this, created: true });
    }
    var id = model.getId(), req = {};
    req[this.index] = id;
    if (ObjectID.isValid(id))
        req[this.index] = new ObjectID(id);
    this.collection.findAndRemove(req, [], function (err) {
        callback(err);
    });
};

/**
 * Just a wrapper for the classic find method.
 * @param query
 * @param options
 */
exports.Collection.prototype.find = function (query, options) {
    query = query || {};
    options = options || {};

    var that = this;
    var cursor = this.collection.find(query, options);

    if (query[this.index] && ObjectID.isValid(query[this.index]))
        query[this.index] = new ObjectID(query[this.index]);

    // wrap the cursor
    cursor.toArray = function (callback) {
        Cursor.prototype.toArray.call(this, function (err, docs) {
            if (err) return callback(err, null);
            var models = [];
            docs.forEach(function (doc) {
                models.push(new that.Model(doc, { collection: that }));
            });
            callback(null, models);
        });
    };

    cursor.each = function (callback) {
        try {
            Cursor.prototype.each.call(this, function (err, doc) {
                callback(err, err ? null : doc ? new that.Model(doc, { collection: that }) : null);
            });
        } catch (e) {
            callback(e);
        }
    };

    cursor.one = function (callback) {
        try {
            cursor = cursor.limit(1);
            Cursor.prototype.each.call(this, function (err, doc) {
                cursor.close();
                callback(err, err ? null : doc ? new that.Model(doc, { collection: that }) : null);
            });
        } catch (e) {
            callback(e);
        }
    };

    return cursor;
};

//exports.StackItem = function (data, options) {
//    data.ts = +new Date();
//    exports.Model.call(this, arguments);
//};
//
//util.inherits(exports.StackItem, exports.Model);
//
//exports.StackCollection = function (options) {
//    options.Model = exports.StackItem;
//    exports.Collection.call(this, arguments);
//};
//
//util.inherits(exports.StackCollection, exports.Collection);
//
//exports.StackCollection.prototype.initialize = function (options, callback) {
//    callback = callback || options;
//    options = options || {};
//
//    options = _.defaults(options, {
//        size: 10000,
//        max: 1000
//    });
//    options.capped = true;
//    async.waterfall(binded([
//        function (next) {
//            exports.Collection.prototype.initialize.call(this, options, next);
//        },
//        function (collection, next) {
//            this.stream = this.find({
//                ts: { $gte: +new Date() }
//            }, {
//                tailable: true,
//                awaitdata: true,
//                numberOfRetries: -1
//            }).stream();
//
//            this.stream.on('data', function (data) {
//                this.emit('stack:pull', new this.Model(data, { collection: this, created: true }));
//            }.bind(this));
//
//            next(null, collection);
//        }
//    ], this), callback);
//};
//
//exports.StackCollection.prototype.push = function (data, callback) {
//    this.push(data, callback);
//};
/**
 * User: rupin_t
 * Date: 7/11/13
 * Time: 12:22 PM
 */

var util = require('util'),
    async = require('async'),
    _ = require('underscore');

var persistence = require('./persistence.js'),
    Collection = persistence.Collection,
    Model = persistence.Model,
    config = require('../config.js'),
    throwIfMissing = require('./tools.js').throwIfMissing,
    staticable = require('./staticable.js');

persistence.database.port = config.db.port;
persistence.database.host = config.db.host;
persistence.database.name = config.db.name;

// ---- Models ----
var Page = function (data, options) {
    data.url = data.url || throwIfMissing('url');
    data.html = data.html || throwIfMissing('html');
    if (!options.created)
        data.cts = +new Date();
    data.cts = data.cts || data.cts;
    data.luts = data.luts || +new Date();
    Model.call(this, data, options);
};

util.inherits(Page, Model);

var Session = function (data, options) {
    data.cid = data.cid || throwIfMissing('cid');
    if (!options.created)
        data.cts = +new Date();
    data.cts = data.cts || data.cts;
    data.luts = data.luts || +new Date();
    Model.call(this, data, options);
};

// ---- Collections ----
var Pages = function () {
    Collection.call(this, {
        name: config.db.cache.collection,
        Model: Page,
        index: 'url'
    });
};

util.inherits(Pages, Collection);

var Sessions = function () {
    Collection.call(this, {
        name: config.db.session.collection,
        Model: Session
    });
};

exports.initialize = function (callback) {
    async.waterfall([
        function (next) {
            persistence.initDatabase(next);
        },
        function (next) {
            exports.pages = new Pages();
            exports.pages.initialize(next);
        },
        function () {
            callback(null);
        }
    ], callback);
};
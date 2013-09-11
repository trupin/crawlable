/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 12:08 PM
 */

exports.create = require('./lib/processor.js').create;
exports.express = require('./lib/app.js');

exports.renderers = {
    'default': require('./lib/renderer/waitFor.js')
};

exports.persistences = {
    'default': require('./lib/persistence/nedb.js')
};

exports.Solidify = require('crawlable-solidify');
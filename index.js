/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 12:08 PM
 */

exports.create = require('./lib/processor.js').create;

exports.renderers = {
    'default': require('./extensions/defaultRenderer.js')
};

exports.persistences = {
    'default': require('./extensions/nedb.js')
};

exports.Solidify = require('solidify');
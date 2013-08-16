/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 12:08 PM
 */

exports.create = require('./lib/processor.js').create;

exports.renderers = {
    'default': require('./extensions/defaultRenderer.js')
};

exports.caches = {
    'default': require('./lib/cache.js'),
    NeDb: require('./extensions/nedbCache.js')
};

exports.Solidify = require('solidify');
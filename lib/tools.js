/**
 * User: rupin_t
 * Date: 6/28/13
 * Time: 2:16 PM
 */

var url = require('url');

exports.binded = function (fns, o) {
    for (var i = 0; i < fns.length; ++i)
        fns[i] = fns[i].bind(o);
    return fns;
};

exports.missing = function (attr) {
    this._error = new Error("missing '" + attr + '" attribute.');
};

exports.throwIfMissing = function (attr) {
    throw new Error("missing '" + attr + '" attribute.');
};

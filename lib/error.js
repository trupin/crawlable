/**
 * User: rupin_t
 * Date: 7/1/13
 * Time: 3:08 PM
 */

var util = require('util');

/**
 * Error base class
 * @param msg
 * @param code
 * @param constr
 * @constructor
 */
var HttpError = exports.HttpError = function (msg, code, constr) {
    Error.captureStackTrace(this, constr || this);
    this.message = msg || 'Error';
    this.code = code || 501;
};

util.inherits(HttpError, Error);

HttpError.prototype.name = 'Abstract Error';

exports.NotFound = function (msg) {
    HttpError.call(this, msg, 404, this.constructor);
};
util.inherits(exports.NotFound, HttpError);

exports.NotFound.prototype.message = 'Not Found Error';

exports.Internal = function (msg) {
    HttpError.call(this, msg, 501, this.constructor);
};
util.inherits(exports.Internal, HttpError);

exports.NotFound.prototype.message = 'Internal Error';
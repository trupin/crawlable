/**
 * User: rupin_t
 * Date: 7/10/13
 * Time: 5:19 PM
 */

exports.computeCacheForUrl = function (url) {
    return {
        __name: 'computeCacheForUrl',
        url: url
    };
};

exports.openSession = function () {
    return {
        __name: 'openSession'
    };
};

exports.closeSession = function () {
    return {
        __name: 'closeSession'
    };
};
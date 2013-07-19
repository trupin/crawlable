/**
 * User: rupin_t
 * Date: 7/15/13
 * Time: 2:47 PM
 */

module.exports = {
    computeCacheForUrl: require('./computeCaheForUrl.js'),
    sessionOpen: require('./session.js').open,
    sessionClose: require('./session.js').close
};
/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 6:20 PM
 */

/**
 * A very simple wrapper for the client side rendering.
 * @type {Function}
 */
var Render = module.exports = function (options) {
    // this userAgent must set be when visiting the pages, otherwise clients cannot know its a crawlable client.
    this.userAgent = 'crawlable';
};

/**
 * Render a page. (Needs to be overloaded)
 *
 * This method can be heavy, it will be executed in a separated process anyway.
 *
 * @param url
 * @param callback
 */
Render.prototype.run = function (url, callback) {
    callback(new Error('Not implemented, you need to overload the Render class'));
};
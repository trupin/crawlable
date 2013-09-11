/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 6:20 PM
 */

/**
 * A very simple wrapper for the client side rendering.
 * @type {Function}
 */
var Renderer = module.exports = function (options) {
    // this userAgent must set be when visiting the pages, otherwise clients cannot know its a crawlable client.
    this.userAgent = 'crawlable';

    this.options = options || {};
};

/**
 * Render a page. (Needs to be overloaded)
 *
 * This method can be heavy, it will be executed in a separated process anyway.
 *
 * @param {object} args
 * @param {function} callback
 */
Renderer.prototype.run = function (args, callback) {
    callback(new Error('Not implemented, you need to overload the Render class'));
};
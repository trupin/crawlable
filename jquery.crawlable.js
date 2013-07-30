/**
 * User: rupin_t
 * Date: 7/22/13
 * Time: 4:07 PM
 */

(function ($) {
    $.isCrawlable = navigator.userAgent == 'crawlable'; // TODO make it dynamic

    /**
     * Crawlable loader jQuery plugin
     * @param options
     * @returns {*}
     */
    $.fn.crawlable = function (options) {
        if (!this.length) return this;

        var that = this;

        that.options = options = options || {};

        options.wait = typeof options.wait == 'number' ? options.wait : 250;
        options.interval = typeof options.interval == 'number' ? options.interval : 20;

        that.$context = $(options.context || 'div');
        that.$context.hide();

        if ($.isCrawlable) {
            that.on('app:load', function () {
                $('body').append('<div id="app-fully-loaded"></div>');
            });
        }
        else {
            that.on('app:load', function () {
                that.remove();
                that.$context.show();
            });
        }

        /**
         * Triggers the document:ajax:inactive event when there is no more pending ajax request at page load.
         * This event will be triggered only one time.
         */
        var t, c = that.options.wait, called = false;

        var onTimeout = function (i) {
            if (!called) {
                called = true;
                that.trigger('app:load');
                clearInterval(i);
            }
        };

        var i = setInterval(function () {
            if ($.active) {
                if (t) clearTimeout(t);
                t = setTimeout(_.bind(onTimeout, i), that.options.wait);
            }
            else if (c <= 0) onTimeout(i);
            c -= that.options.interval;
        }, that.options.interval);

        return that;
    };

})(jQuery);
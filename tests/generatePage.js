/**
 * User: rupin_t
 * Date: 7/8/13
 * Time: 5:35 PM
 */

var casper = require('casper').create({
    verbose: true,
    logLevel: "debug",
    onError: function (self, m) {
        console.log(m);
        self.exit();
    },
    pageSettings: {
        loadImage: false,
        loadPlugins: false,
        userAgent: 'crawlable'
    }
});

//casper.on('remote.message', function(message) {
//    console.log(message);
//});

casper.start(casper.cli.get('url'));

casper.waitForSelector('#app-fully-loaded');

casper.then(function () {
    this.echo(this.getHTML('#app'));
});

casper.then(function () {
    this.exit();
});

casper.run();
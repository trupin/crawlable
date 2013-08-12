/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 12:39 PM
 */

var Processor = require('../lib/processor.js');

var proc = Processor.create({
    host: 'http://localhost:3001',
    Renderer: require('.')
});

proc.start(function () {
    console.log('start');
    try {
        proc.render('/search', {
            context: { q: 'toto' },
            wait: true,
            force: true
        }, function (err, res) {
            if (err) throw err;
            console.log(res.html);
            proc.stop(function () {
                console.log('stop');
            });
        });
    } catch (e) {
        console.log(e);
    }
});

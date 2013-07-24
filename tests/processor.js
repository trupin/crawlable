/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 12:39 PM
 */

var Processor = require('../lib2/processor.js');

try {
    var proc = Processor.create({
        host: 'http://localhost:3001',
        Renderer: require('../extensions/casperRenderer')
    });

    proc.start();

    proc.render('/articles', function (err, res) {
        console.log(err || res);
    });

} catch (e) {
    console.log(e);
}
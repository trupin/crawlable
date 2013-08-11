/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 12:39 PM
 */

//var Processor = require('../lib/processor.js');
//
//var proc = Processor.create({
//    host: 'http://localhost:3001',
//    Renderer: require('../extensions/casperRenderer')
//});
//
//proc.start(function () {
//    console.log('start');
//    try {
//        proc.render('/articles', {
//            context: { subtitle: 'dfwewfwejpiofwejpfmwefmwefmkew' },
//            wait: true,
//            force: true
//        }, function (err, res) {
//            if (err) throw err;
//            if (res.html.indexOf('dfwewfwejpiofwejpfmwefmwefmkew') !== -1)
//                console.log('It\'s working');
//            proc.stop(function () {
//                console.log('stop');
//            });
//        });
//    } catch (e) {
//        console.log(e);
//    }
//});

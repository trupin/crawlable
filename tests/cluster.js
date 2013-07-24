/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 4:02 PM
 */

c = require('./../lib2/cluster.js');

c.registerTask('test', function (args, next) {
    next(null, args.id);
});
c.start();
var id = 0;
var i = setInterval(function () {
    var lastId = id;
    c.exec('test', { id: id++ }, function (err, res) {
        console.log(res, lastId);
        if (res != lastId) throw new Error('Not working');
    });
}, 0);

setTimeout(function () {
    c.stop(function () {
        clearInterval(i);
    });
}, 1000);

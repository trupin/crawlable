/**
 * User: rupin_t
 * Date: 7/11/13
 * Time: 12:49 PM
 */

var tasks = require('./tasks.js'),
    fns = require('../tasks');

exports.exec = function (task, callback) {
    if (!task.__name || !tasks[task.__name] || !fns[task.__name]) {
        task.__error = new Error('This task doesn\'t exist or is not hooked.');
        return callback(task);
    }
    fns[task.__name](task, function (err, res) {
        if (err)
            task.__error = err.message || err;
        task.__result = res;
        return callback(task);
    });
};

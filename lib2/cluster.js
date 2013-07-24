/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 1:00 PM
 */

var cluster = require('cluster'),
    _ = require('lodash');

var numCPUs = require('os').cpus().length,
    stack = [],
    nexts = {},
    listeners = [];

var tasks = {};
var interrupted = false;

exports.registerTask = function (name, fn) {
    tasks[name] = { fn: fn };
};

var masterStart = function () {
    for (var i = 0; i < numCPUs; ++i) {
        var worker = cluster.fork();
        listeners.push(worker);
        worker.on('message', function (task) {
            if (task.error) task.error = new Error(task.error);
            nexts[this.id](task.error, task.error ? null : task.result);
            delete nexts[this.id];

            // if possible directly process another task otherwise, push it for later.
            if (stack.length) {
                var t = stack.shift();
                nexts[this.id] = t.next;
                this.send(t);
            }
            else
                listeners.push(this);
        });
    }
};

var workerStart = function () {
    process.on('message', function (task) {
        var next = function (err, res) {
            task.error = err instanceof Error ? err.message.trim() : err;
            task.result = res;
            process.send(task);
        };
        if (task.args)
            tasks[task.name].fn(task.args, next);
        else
            tasks[task.name].fn(next);
    });
};

exports.start = function () {
    interrupted = false;
    if (cluster.isMaster)
        masterStart();
    else
        workerStart();
};

exports.exec = function (name, args, next) {
    if (interrupted) return;
    var task = tasks[name];
    if (!tasks[name])
        throw new Error('Unknown task, maybe you forgot to register it before starting.');
    if (!_.isFunction(task.fn))
        throw new Error('Missing the "fn" attribute for the task "' + name + '"');

    task = _.clone(task);

    task.name = name;
    task.args = args;
    task.next = next;

    // if possible process directly the task, otherwise push it for later.
    if (!listeners.length || stack.length)
        stack.push(task);
    else {
        var w = listeners.shift();
        nexts[w.id] = next;
        w.send(task);
    }
};

exports.stop = function (callback) {
    callback = _.isFunction(callback) ? callback : function () {};
    interrupted = true;
    var i = setInterval(function () {
        if (!_.size(nexts)) {
            _.each(cluster.workers, function (worker) {
                worker.kill();
            });
            clearInterval(i);
            callback(null);
        }
    }, 0);
};

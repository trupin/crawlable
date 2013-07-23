/**
 * User: rupin_t
 * Date: 7/10/13
 * Time: 3:29 PM
 */

var config = require('./config.js'),
    persistence = require('./lib/persistence.js');

var argv = require('optimist')
    .usage('Usage: node crawlable.js -dbHost [ip] -dbPort [num] -mqDbName [string] -mqCollectionName [string]')
    .argv;

var MQ = require('mongomq').MongoMQ,
    async = require('async');

var taskProcessor = require('./lib/taskProcessor.js'),
    cache = require('./lib/db.js');

var options = {
    host: argv.dbHost || config.db.host,
    port: argv.dbPort || config.db.port,
    databaseName: argv.mqDbName || config.db.name,
    queueCollection: argv.mqCollectionName || config.db.mq.collection,
    autoStart: false
};

var mq = new MQ(options);

mq.on('task', function (err, task, next) {
    if (err)
        return console.log(err);
    console.log('Received task : ', task);
    taskProcessor.exec(task, function (task) {
        if (task.__error)
            console.log(task.__error);
        mq.emit(task.__cid, task);
    });
    next();
});


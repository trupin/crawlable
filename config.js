/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 10:42 AM
 */

module.exports = {
    db: {
        name: 'crawlable',
        host: '127.0.0.1',
        port: 27017,
        mq: {
            collection: 'tasks-channel'
        },
        cache: {
            collection: 'pages',
            ttl: 30 // seconds
        },
        session: {
            collection: 'sessions'
        }
    },
    env: 'prod', // dev || prod
    host: 'http://localhost:3001'
};
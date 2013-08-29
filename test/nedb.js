/**
 * User: rupin_t
 * Date: 8/29/13
 * Time: 12:07 PM
 */

var should = require('should'),
    async = require('async'),
    _ = require('lodash'),
    Persistence = require('../extensions/nedb.js'),
    errors = require('../lib/errors.js');

describe('Persistence', function () {

    beforeEach(function (done) {
        var that = this,
            model = { hello: 'world' };

        that.persistence = new Persistence({ inMemoryOnly: true });

        that.persistence.start(function (err) {
            if (err) return done(err);

            that.persistence.db.remove({}, function (err) {
                if (err) return done(err);

                that.persistence.create(model, function (err, res) {
                    if (err) return done(err);
                    that.model = res;
                    done();
                });
            });
        });
    });

    describe('#create', function () {
        it('create an entry and return it with a new id', function (done) {
            this.persistence.create({ test: true }, function (err, doc) {
                if (err) return done(err);

                doc.should.have.property('test');
                should.strictEqual(doc.test, true);
                doc.should.have.property('_id');
                doc._id.should.be.a('string');

                done();
            });
        });
    });

    describe('#read', function () {
        it('read an entry from its id', function (done) {
            var that = this;
            that.persistence.read(that.model._id, function (err, doc) {
                if (err) return done(err);

                doc.should.have.property('_id');
                doc._id.should.equal(that.model._id);

                done();
            });
        });
        it('read an entry from another field value than its id', function (done) {
            var that = this;
            that.persistence.read(that.model.hello, 'hello', function (err, doc) {
                if (err) return done(err);

                doc.should.have.property('_id');
                doc._id.should.equal(that.model._id);

                done();
            });
        });
    });

    describe('#update', function () {
        it('update a field value which is not the id and return the new doc', function (done) {
            var that = this;
            that.persistence.update(that.model._id, { hello: 'new world' }, function (err, doc) {
                if (err) return done(err);

                doc.should.have.property('hello');
                doc.hello.should.equal('new world');

                that.persistence.read(that.model._id, function (err, doc) {
                    if (err) return done(err);

                    doc.should.have.property('hello');
                    doc.hello.should.equal('new world');

                    done();
                });
            });
        });
    });

    describe('#delete', function () {
        it('delete an entry for a specific id and return the old doc.', function (done) {
            var that = this;
            that.persistence.delete(that.model._id, function (err, doc) {
                if (err) return done(err);

                doc.should.have.property('_id');
                doc._id.should.equal(that.model._id);

                that.persistence.delete(that.model._id, function (err, doc) {
                    should.exist(err);
                    err.should.be.an.instanceof(errors.NotFound);
                    should.not.exist(doc);
                    done();
                });
            });
        });
    });
});

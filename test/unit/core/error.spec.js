var R = require('../../../src/Router');
var noOp = function() {};
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var falcor = require('falcor');
var $ref = falcor.Model.ref;
var $error = falcor.Model.error;
var circularReference = require('./../../../src/exceptions').circularReference;
var Observable = require('rx').Observable;
var Promise = require('promise');

describe('Error', function() {
    it('should throw a non Error thrown by the route handler.', function(done) {
        var router = new R([{
            route: 'videos[{integers:ids}]',
            get: function (alias) {
                /* eslint-disable no-throw-literal */
                throw 'hello world';
                /* eslint-enable no-throw-literal */
            }
        }]);
        var onNote = sinon.spy();

        router.
            get([["videos", 1, "title"]]).
            materialize().
            doAction(onNote).
            doAction(noOp, noOp, function() {
                expect(onNote.calledOnce).to.be.ok;
                var note = onNote.getCall(0).args[0];
                expect(note.kind).to.equal('E');
                expect(note.error).to.equal('hello world')
            }).
            subscribe(noOp, done, done);
    });

    it('should throw an Error thrown by the route handler.', function(done) {
        var router = new R([{
            route: 'videos[{integers:ids}]',
            get: function (alias) {
                throw new Error('hello world');
            }
        }]);
        var onNote = sinon.spy();

        router.
            get([["videos", 1, "title"]]).
            materialize().
            doAction(onNote).
            doAction(noOp, noOp, function() {
                expect(onNote.calledOnce).to.be.ok;
                var note = onNote.getCall(0).args[0];
                expect(note.kind).to.equal('E');
                expect(note.error.name).to.equal('Error');
                expect(note.error.message).to.equal('hello world')
            }).
            subscribe(noOp, done, done);
    });

    it('should throw an error when maxExpansion has been exceeded.', function(done) {
        var router = new R([{
            route: 'videos[{integers:ids}]',
            get: function (alias) {
                return {
                    path: ['videos', 1],
                    value: $ref('videos[1]')
                };
            }
        }]);
        var obs = router.get([["videos", 1, "title"]]);
        var err = false;
        obs.
            doAction(
                noOp,
                function(e) {
                    expect(e.message).to.equals(circularReference);
                    err = true;
                }).
            subscribe(noOp, function(e) {
                if (err) {
                    return done();
                }
                return done(e);
            }, function() {
                done('should not of completed.');
            });
    });

    it('promise rejection of non Error should throw the non Error', function(done) {
        var router = new R([{
            route: 'videos[{integers:id}].rating',
            set: function(json) {
                return Promise.reject('hello world');
            }
        }]);
        var onNote = sinon.spy();

        router.
            set({
                jsonGraph: {
                    videos: {
                        1234: {
                            rating: 5
                        },
                        333: {
                            rating: 5
                        }
                    }
                },
                paths: [
                    ['videos', [1234, 333], 'rating']
                ]
            }).
            materialize().
            doAction(onNote).
            doAction(noOp, noOp, function() {
                expect(onNote.calledOnce).to.be.ok;
                var note = onNote.getCall(0).args[0];
                expect(note.kind).to.equal('E');
                expect(note.error).to.equal('hello world')
            }).
            subscribe(noOp, done, done);
    });

    it('promise rejection of Error should throw the Error', function(done) {
        var router = new R([{
            route: 'videos[{integers:id}].rating',
            set: function(json) {
                return Promise.reject(new Error('hello world'));
            }
        }]);
        var onNote = sinon.spy();

        router.
            set({
                jsonGraph: {
                    videos: {
                        1234: {
                            rating: 5
                        },
                        333: {
                            rating: 5
                        }
                    }
                },
                paths: [
                    ['videos', [1234, 333], 'rating']
                ]
            }).
            materialize().
            doAction(onNote).
            doAction(noOp, noOp, function() {
                expect(onNote.calledOnce).to.be.ok;
                var note = onNote.getCall(0).args[0];
                expect(note.kind).to.equal('E');
                expect(note.error.name).to.equal('Error');
                expect(note.error.message).to.equal('hello world')
            }).
            subscribe(noOp, done, done);
    });

    it('returned $error objects are inserted into the graph (either being set or get).', function(done) {
        var router = new R([{
            route: 'videos[{integers:id}].rating',
            set: function(jsonGraph) {
                return Observable.
                    from(Object.keys(jsonGraph.videos)).
                    map(function(id) {
                        return {
                            path: ['videos', id, 'rating'],
                            value: $error("not authorized", {unauthorized: true})
                        };
                    });
            }
        }]);
        var onNext = sinon.spy();
        router.
            set({
                jsonGraph: {
                    videos: {
                        1234: {
                            rating: 5
                        },
                        333: {
                            rating: 5
                        }
                    }
                },
                paths: [
                    ['videos', [1234, 333], 'rating']
                ]
            }).
            doAction(onNext).
            doAction(noOp, noOp, function() {
                expect(onNext.calledOnce).to.be.ok;
                expect(onNext.getCall(0).args[0]).to.deep.equals({
                    jsonGraph: {
                        videos: {
                            1234: {
                                rating: {
                                    $type: "error",
                                    value: "not authorized",
                                    unauthorized: true
                                }
                            },
                            333: {
                                rating: {
                                    $type: "error",
                                    value: "not authorized",
                                    unauthorized: true
                                }
                            }
                        }
                    }
                });
            }).
            subscribe(noOp, done, done);
    });

});

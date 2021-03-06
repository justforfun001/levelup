/* Copyright (c) 2012-2018 LevelUP contributors
 * See list at <https://github.com/level/levelup#contributing>
 * MIT License <https://github.com/level/levelup/blob/master/LICENSE.md>
 */

const DB_ROOT = __dirname
var path = require('path')
var Benchmark = require('benchmark')
var rimraf = require('rimraf')
var async = require('async')
var engines = require('./engines/')
var tests = require('./tests/')

var dbidx = 0

var printableEngineName = function (engineName) {
  var len = Object.keys(engines).reduce(function (m, c) { return Math.max(c.length, m) }, 0)
  while (engineName.length < len) engineName += ' '
  return engineName
}

var mklocation = function () {
  return path.join(DB_ROOT, '_benchdb_' + dbidx++)
}

var mkdb = function (engine, location, callback) {
  rimraf(location, engine.createDb.bind(null, location, callback))
}

var rmdb = function (engine, db, location, callback) {
  engine.closeDb(db, rimraf.bind(null, location, callback))
}

var run = function (db, name, fn, color, cb) {
  var exec = function () {
    new Benchmark(name, {
      'defer': true,
      'fn': function (deferred) {
        fn(db, deferred.resolve.bind(deferred))
      }
    })
    .on('complete', function (event) {
      console.log(String(event.target)[color].bold)
      cb()
    })
    .run({ async: true })
  }

  if (fn.setup) {
    fn.setup(db, function (err) {
      if (err) return cb(err)
      exec()
    })
  } else { exec() }
}

var runTest = function (testName, callback) {
  async.forEachSeries(
    Object.keys(engines), function (engineKey, callback) {
      var engine = engines[engineKey]
      var location = mklocation()
      mkdb(engine, location, function (err, db) {
        if (err) return callback(err)
        if (!tests[testName][engineKey]) { console.log('Skipping for', testName, engineKey); return callback() }
        run(db,
            printableEngineName(engineKey) + ' ' + testName,
            tests[testName][engineKey],
            engine.color, function (err) {
              rmdb(engine, db, location, function (_err) {
                callback(err || _err)
              })
            })
      })
    }, function (err) {
      if (err) throw err
      console.log()
      callback.apply(null, arguments)
    }
  )
}

var focusKey = Object.keys(tests).filter(function (k) { return (/=>/).test(k) })

if (focusKey.length) {
  var focusTest = tests[focusKey[0]]
  tests = {}
  tests[focusKey[0]] = focusTest
}

require('colors')
async.forEachSeries(Object.keys(tests), runTest)

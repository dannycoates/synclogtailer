#!/usr/bin/env node

var JSONStream = require('json-stream')
var through = require('through2')
var dateformat = require('dateformat')
var Joi = require('joi')

var devices = {}
var FLUSH_INTERVAL = 1000 * 60 * 5

const storageRegex = /\d+\/storage\/(\w+)/
const infoRegex = /info\/(\w+)$/
const desktopRegex = /desktop/

function toRoute(method, path, code) {
  var p = storageRegex.exec(path)
  if (!p) {
    p = infoRegex.exec(path)
  }
  if (!p) {
    return 'todo'
  }
  return (method + '_' + p[1] + '_' + (Math.floor(code / 100) * 100)).toLowerCase()
}

function toType(agent) {
  return desktopRegex.test(agent) ? 'desktop' : 'other'
}

function Rollup(time, uid, dev, type, host) {
  this.start_time = time
  this.end_time = time
  this.uid = uid
  this.dev = dev
  this.type = type
  this.host = host
}

Rollup.prototype.addRoute = function (route, time) {
  if (time < this.start_time) {
    this.start_time = time
  }
  if (time > this.end_time) {
    this.end_time = time
  }
  this[route] = (this[route] || 0) + 1
}

Rollup.prototype.log = function () {
  if (this.end_time - this.start_time > FLUSH_INTERVAL) {
    this.start_time = dateformat(this.start_time, 'yyyy-mm-dd HH:MM:ss')
    this.end_time = dateformat(this.end_time, 'yyyy-mm-dd HH:MM:ss')
    console.error('logging: ' + this.dev)
    process.stdout.write(JSON.stringify(this) + '\n')
    return true
  }
  return false
}

function parseMetric(obj) {
  return new Rollup(
    obj.time,
    obj.fxa_uid,
    obj.device_id,
    toType(obj.agent),
    obj.hostname
  )
}

var metricSchema = Joi.object({
  time: Joi.date().required(),
  agent: Joi.string().required(),
  method: Joi.string().required(),
  path: Joi.string().required(),
  code: Joi.number().integer().min(200).max(999).required(),
  hostname: Joi.string().required(),
  fxa_uid: Joi.string().hex().length(32).required(),
  device_id: Joi.string().hex().length(32).required()
})

process.stdin
  .pipe(JSONStream())
  .pipe(
    through.obj(
      function (obj, _, next) {
        var validated = Joi.validate(obj, metricSchema, { allowUnknown: true })
        if (validated.error) { return next() }
        next(null, validated.value)
      }
    )
  )
  .on(
    'data',
    function (obj) {
      var r = devices[obj.device_id] || parseMetric(obj)
      r.addRoute(toRoute(obj.method, obj.path, obj.code), obj.time)
      if (r.log()) {
        delete devices[obj.device_id]
        console.error('deleted: ' + obj.device_id)
      }
      else {
        devices[obj.device_id] = r
      }
    }
  )

setInterval(
  function () {
    var devs = Object.keys(devices)
    for (var i = 0; i < devs.length; i++) {
      var id = devs[i]
      var d = devices[id]
      d.end_time = new Date()
      console.error('checking: ' + id + ' ' + (d.end_time - d.start_time))
      if (d.log()) {
        delete devices[id]
        console.error('flushed: ' + id)
      }
    }
  },
  FLUSH_INTERVAL * 2
)

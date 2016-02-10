#!/usr/bin/env node

var JSONStream = require('json-stream')
var through = require('through2')
var dateformat = require('dateformat')

process.stdin
  .pipe(JSONStream())
  .pipe(
    through.obj(
      function (obj, _, next) {
        var time = new Date(obj.time)
        var stat = {
          time: dateformat(time, 'yyyy-mm-dd HH:MM:ss'),
          agent: obj.agent,
          method: obj.method,
          path: obj.path,
          code: obj.code,
          t: Math.floor(obj.request_time * 1000),
          host: obj.hostname
        }
        next(null, JSON.stringify(stat) + '\n')
      }
    )
  )
  .pipe(process.stdout)

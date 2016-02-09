#!/usr/bin/env node

var JSONStream = require('json-stream')
var through = require('through2')

process.stdin
  .pipe(JSONStream())
  .pipe(
    through.obj(
      function (obj, _, next) {
        var stat = {
          time: obj.time,
          agent: obj.agent,
          method: obj.method,
          path: obj.path,
          code: obj.code,
          t: obj.request_time,
          host: obj.hostname
        }
        next(null, JSON.stringify(stat) + '\n')
      }
    )
  )
  .pipe(process.stdout)

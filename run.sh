#!/usr/bin/env bash

tail -F /var/log/syncserver.log | grep metrics | /data/synclogtailer/index.js

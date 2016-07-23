#!/usr/bin/env node

'use strict'

const setupProxy = require('..')

const options = {
  host: process.env.HOST,
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  csrfCookieName: process.env.CSRF_COOKIE || 'csrftoken',
  hostCsrfHeader: process.env.CSRF_HEADER || 'X-CSRF'
}

setupProxy(options)
  .then(console.log)
  .catch(console.error)

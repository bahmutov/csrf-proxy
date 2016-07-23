'use strict'

const debug = require('debug')('proxy')
const csrfLogin = require('csrf-login')
const request = require('request')
const express = require('express')
const la = require('lazy-ass')
const is = require('check-more-types')

function setupProxy (options) {
  la(is.unemptyString(options.host), 'missing host')

  const localPort = 5050
  const localHost = 'localhost'
  const localProxy = `http://${localHost}:${localPort}`

  function isCsrfCookie (c) {
    return c.key === options.csrfCookieName
  }

  function getCsrfToken (authenticated) {
    const cookie = authenticated.jar.getCookies(options.host).find(isCsrfCookie)
    const token = cookie && cookie.value
    return token
  }

  function prepareProxyMiddleware (authed) {
    debug('got authed jar', authed.jar)
    const token = getCsrfToken(authed)
    debug(`host ${options.host} csrf token ${token}`)
    const proxyRequest = loggedInForward.bind(null, authed.jar, token)
    return proxyRequest
  }

  return csrfLogin(options)
    .then(prepareProxyMiddleware)
    .then(startProxy)

  function isLoginPath (url) {
    return /\/login/.test(url)
  }

  function loggedInForward (cookieJar, csrftoken, req, resp) {
    const destUrl = req.originalUrl
    debug(`proxy ${req.method} ${destUrl} accept ${req.headers.accept}`)

    const forwardOptions = {
      uri: `${options.host}${destUrl}`,
      jar: cookieJar,
      headers: {
        Accept: req.headers.accept,
        Referer: options.host
      },
      followRedirect: true
    }
    if (options.hostCsrfHeader && csrftoken) {
      forwardOptions[options.hostCsrfHeader] = csrftoken
    }

    const myReq = request()

    if (isLoginPath(destUrl)) {
      // login usually has redirect that we do not pick up
      // by just piping the response to original request
      // read the redirected login from the response
      // and redirect the original client there
      myReq.on('response', function () {
        console.log('after login')
        const redirected = `${localProxy}${myReq.path}`
        console.log('sending redirect back', redirected)
        resp.redirect(redirected)
      })
    } else {
      req.pipe(myReq)
      myReq.pipe(resp)
    }
  }

  function startProxy (proxyForward) {
    return new Promise(function (resolve, reject) {
      const app = express()
      app.use(proxyForward)
      app.listen(localPort, localHost, function () {
        console.log(`started proxy on ${localProxy} pointing at ${options.host}`)
        resolve(localProxy)
      })
    })
  }
}

module.exports = setupProxy

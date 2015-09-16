#!/usr/bin/env node

require('dotenv').load();

var request = require('request');
var jsonstream = require('jsonstream');
var through2 = require('through2');
var UserModel = require('./models/user.js');
var P = require('bluebird');

var User = new UserModel();

function skipFirst() {
  var n = 0;
  return through2.obj(function(e, _, next) {
    if (n++ > 0) this.push(e);
    next();
  });
}

function updateSince(days) {
  var d = new Date(Date.now() - 86400 * days * 1000);
  return P.all([
    stromise(request({
      method: 'get',
      uri: 'https://us9.api.mailchimp.com/export/1.0/list/?apikey=' + process.env.MAILCHIMP_KEY + '&id=e17fe5d778&since=' + d.toISOString() + '&status=unsubscribed'
    }).pipe(jsonstream.parse()).pipe(skipFirst()).pipe(setWeeklyTo(''))),

    stromise(request({
      method: 'get',
      uri: 'https://us9.api.mailchimp.com/export/1.0/list/?apikey=' + process.env.MAILCHIMP_KEY + '&id=e17fe5d778&since=' + d.toISOString() + '&status=subscribed'
    }).pipe(jsonstream.parse()).pipe(skipFirst()).pipe(setWeeklyTo('on')))

  ]);
}

updateSince(Number(process.argv[2])).catch(function(err) {
  console.warn(err);
  process.exit(1);
});

function setWeeklyTo(val) {
  return through2.obj(function(e, _, next) {
    User.listByEmailUncached(e[0]).catch(notFoundIsOkay).map(function(user) {
      user.resource.npmweekly = val;
      return User.save(user);
    }).then(function(resp) {
      resp.forEach(function(e) {
        console.warn('set', e.name, 'npmweekly setting to', val);
      });
      next();
    }).catch(next);
  });
}

function notFoundIsOkay(err) {
  if (err.statusCode == 404) {
    return [];
  } else {
    throw err;
  }
}

function stromise(str) {
  return new P(function(accept, reject) {
    str.on('error', reject);
    str.on('end', accept);
  });
}

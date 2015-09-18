var path = require('path');
var Hapi = require('hapi');
var inject = require('require-inject');

process.env.REDIS_URL = 'redis://localhost:99999';
process.env.SESSION_PASSWORD = '12345';

module.exports = function(cb) {
  var makeServer = inject.installGlobally('../../lib/startup.js', {
    redis: require('redis-mock')
  });

  var server = makeServer({
    connection: null
  });

  server.then(function(server) {
    server.on('close', function() {
      console.warn(server);
    });
  });

  if (cb) {
    server.then(cb);
  }
  return server;
};

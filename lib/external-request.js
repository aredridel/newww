var bole = require('bole');
var clf = require('../lib/utils').toCommonLogFormat;
var emitter = require('../adapters/metrics')();
var logger = bole('EXTERNAL');
var P = require('bluebird');
var Request = P.promisify(require('request'));

var externalRequest = function externalRequest(opts, cb) {

  return new P(function(accept, reject) {
    var start = Date.now();
    Request(opts, function(err, resp, body) {

      if (resp) {
        var hostname = '';
        if (resp.request && resp.request.uri && resp.request.uri.host) {
          if (process.env.REMOTE_DEV) {
            hostname = resp.request.uri.host.replace('.internal.npmjs.dev', '');
          } else {
            hostname = resp.request.uri.host.replace('.internal.npmjs.com', '');
          }
        }
        emitter.metric({
          name: 'latency.external',
          value: Date.now() - start,
          source: hostname
        });

        logger.info(clf(resp));
      }

      if (err) {
        logger.error(body); // get more info about the error
        logger.error(err);
      }

      if (cb) cb(err, resp, body);

      if (err) {
        reject(err);
      } else {
        accept([resp, body]);
      }
    });
  });
}

externalRequest.get = function(opts, cb) {
  opts.method = 'get';
  return externalRequest(opts, cb);
};

externalRequest.post = function(opts, cb) {
  opts.method = 'post';
  return externalRequest(opts, cb);
};

externalRequest.put = function(opts, cb) {
  opts.method = 'put';
  return externalRequest(opts, cb);
};

externalRequest.del = function(opts, cb) {
  opts.method = 'delete';
  return externalRequest(opts, cb);
};

externalRequest.logger = logger;

module.exports = externalRequest;

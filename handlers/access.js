var omit = require("lodash").omit;
var Collaborator = require("../agents/collaborator");
var Package = require("../agents/package");
var VError = require('verror');

module.exports = function(request, reply) {

  var cpackage;
  var loggedInUser = request.loggedInUser;
  var context = {
    title: request.packageName + ": access",
    userHasReadAccessToPackage: false,
    userHasWriteAccessToPackage: false,
    norobots: true,
  };

  var promise = Package(request.loggedInUser)
    .get(request.packageName)
    .catch(function(err) {

      switch (err.statusCode) {
        case 402:
          reply.redirect('/settings/billing?package=' + request.packageName);
          break;
        case 404:
          request.logger.error(new VError("Package not found '%s'", request.packageName));
          reply.view('errors/not-found').code(404);
          break;
        default:
          reply(new VError(err, "unable to get package '%s'", request.packageName));
      }
      return promise.cancel();
    })
    .then(function(pkg) {
      cpackage = omit(pkg, ['readme', 'versions']);
      return Collaborator(loggedInUser && loggedInUser.name).list(cpackage.name);
    })
    .catch(function(err) {
      reply(new VError(err, "unable to get collaborators for package '%s'", request.packageName));
      return promise.cancel();
    })
    .then(function(collaborators) {
      cpackage.collaborators = collaborators;

      if (loggedInUser && loggedInUser.name in cpackage.collaborators) {
        context.userHasReadAccessToPackage = true;
        context.userHasWriteAccessToPackage = cpackage.collaborators[loggedInUser.name].write;
      }

      if (cpackage.private && !context.userHasReadAccessToPackage) {
        return reply.view('errors/not-found').code(404);
      }

      context.enablePermissionTogglers = Boolean(cpackage.private) && context.userHasWriteAccessToPackage;

      context.package = cpackage;

      // Disallow unpaid users from toggling their public scoped packages to private
      if (Boolean(cpackage.scoped) && !Boolean(cpackage.private) && context.userHasWriteAccessToPackage) {
        context.paymentRequiredToTogglePrivacy = true;
        request.customer.getStripeData(function(err, customer) {
          if (err && err.statusCode !== 404) {
            return reply(new VError(err, "error fetching customer data for user '%s'" + loggedInUser.name));
          } else {
            if (customer) {
              context.paymentRequiredToTogglePrivacy = false;
              context.customer = customer;
            }
            return reply.view('package/access', context);
          }
        });
      } else {
        return reply.view('package/access', context);
      }

    })
    .catch(function(err) {
      reply(new VError(err, "unable to verify access for package '%s'", request.packageName));
    });
};

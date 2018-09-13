# js-odinlabsio-sdk

Welcome to OdinLabs IO.

## Table of Contents

- [Overview](#overview)
  - [Quick Summary](#quick-summary)
- [How it works](#how-it-works)
  - [Authentification](#authentification)
  - [Signed Consent Collection](#signed-consent-collection)
  - [Consent Configuration](#consent-configuration)
- [License](#license)

## Overview

odinlabsio-sdk provides a wrapper for odinlabsio-app services. Features are implemented as expressjs middleware. odinlabsio-app services are implemented as Oauth2 endpoints hence, one can write clients for any platform.

### Quick Summary

Currently the SDK provides verifiable authentification and verifiable consent collection.

## Install
TODO

## Usage

### Configure

#### Options

- Import odin-sdk and passport. Passport must be configured with a session for odin-sdk to work:

```
const passport = require('passport');
const ConsentServer = require('odin-sdk').consent.ConsentServer;
```

- Consent server configuration parameters: 

```
var params = {
  odinsdk: {
    'consentURL': 'https://local.odinlabs.io:3000/consent/', /* consent OAuth2 authorization url */
    'authentificationURL': 'https://local.odinlabs.io:3000/consent/authentification', /* authentification OAuth2 authorization url*/
    'tokenURL': 'https://local.odinlabs.io:3000/consent/token', /* OAuth2 token url*/
    'clientID': 'myAppId', // your App ID
    'clientSecret': 'myAppSecret', // your App Secret
    'callbackURLConsent': 'https://myhost/odinsdk/callback/consent', /* Oauth2 callback for consent authorization*/
    'callbackURLAuthentify': 'https://myhost/odinsdk/callback/authentification', /* Oauth2 callback for authentificatio authorization*/
    'scope': 'Scope1 Scope1', /* OAuth2 Scope */
    'host': 'https://local.odinlabs.io:3000' /* OAuth2 server host */
  }
}
```

- Server instance:

```
const ConsentServerInstance = new ConsentServer(passport, function (user, permission, cb) {
    return cb(null, user, permission);
  }, params);
```
ConsentServer args are `passport`, a verification `function (user, permission, cb) { ... })` and server `params`.
Verification function will be passed user and permission. user is defined if authenfication or consent request was succesfull. permission is defined if consent request was succesfull.
Client code can serialize or save to db user and permission for later usage.
`cb` is a callback `funtion (err, user, permission)`. client Code must call this function with `user`, `permission` or values derived from `user`, `permission`.

### Verifiable authentification
Authentify is an express middleware.

```
// authentify user
app.get('/', ConsentServerInstance.authentify({ failureRedirect: '/error' }), function (req, res) {
    res.render('index');
  });
// call back for authentification
app.get('/odinsdk/callback/authentification', ConsentServerInstance.authentify(), function (request, response) {
    response.redirect(request.session.odinsdk.successRedirect);
  });
```
Options:
- `succesRedirect`: redirect path if authentification succeeds (default to: request.originalUrl)
- `failureRedirect`: redirect path if authentification fails

### Verifiable consent collection
Consent is an express middleware.
```
// ask consent
app.get('/', ConsentServerInstance.consent({ failureRedirect: '/error' }), function (req, res) {
    res.render('index');
  });
// call back for consent
app.get('/odinsdk/callback/consent', ConsentServerInstance.consent(), function (request, response) {
    response.redirect(request.session.odinsdk.successRedirect);
  });
```
Options:
- `succesRedirect`: redirect path if authentification succeeds (default to: request.originalUrl)
- `failureRedirect`: redirect path if authentification fails

### Collect consent once

User data and consent data are stored in user sessions and are added to `request.user` and `request.session.odinsdk.permission` respectively.

#### Collect consent for a single session

Collect consent for currrent session.

```
const ConsentServerInstance = new ConsentServer(passport, function (user, permission, cb) {
    return cb(null, user, permission);
  }, params);
// ask consent
app.get('/', ConsentServerInstance.consent({ failureRedirect: '/error' }), function (req, res) {
    res.render('index');
  });
// call back for consent
app.get('/odinsdk/callback/consent', ConsentServerInstance.consent(), function (request, response) {
    response.redirect(request.session.odinsdk.successRedirect);
  });
```
#### Collect consent once for cross session permission

Collect cross session eg. we want to collect consent if consent has never been collected for current session.
To do this perform a two step authentification-consent. Authenfitication returns user and lookup for pervious consent based on user. If a consent exist return previousConsent this will skip the collect consent step else will perform collect consent step.

```
const ConsentServerInstance = new ConsentServer(passport, function (user, permission, cb) {
    if (!permission) {
      var previousPermission = db.getPermission(user);
      if (perviousPermission) {
         return cb(null, user, previousPermission);
      }
      return cb(null, user, previousPermission);
    } else {
      db.savePermission(user, permission);
      return cb(null, user, permission);
    }
  }, params);
  
// ask authentification consent
app.get('/', ConsentServerInstance.authentify({ failureRedirect: '/error' }), ConsentServerInstance.consent({ failureRedirect: '/error' }), function (request, response) {
    response.render('index');
  });
// call back for consent
app.get('/odinsdk/callback/consent', ConsentServerInstance.consent(), function (request, response) {
    response.redirect(request.session.odinsdk.successRedirect);
  });
// call back for authentification
app.get('/odinsdk/callback/authentification', ConsentServerInstance.authentify(), function (request, response) {
    response.redirect(request.session.odinsdk.successRedirect);
  });
```

## License

MIT

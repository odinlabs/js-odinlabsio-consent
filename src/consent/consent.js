var JWT = require('jsonwebtoken');
var OdinStrategy = require('passport-oauth2').Strategy;
const RestClient = require('node-rest-client').Client;

const json_content = { 'Content-Type': 'application/json' };
const json_accept = { 'Accept': 'application/json' };

function OdinServer(options) {
    this.client = new RestClient();
    this.client.registerMethod('getUser', `${options.host}/consent/\${token}/user`, 'GET');
    this.client.registerMethod('getPermission', `${options.host}/consent/\${token}/permission`, 'GET');
    this.client.registerMethod('getConsent', `${options.host}/consent/\${token}/consent`, 'GET');
}

OdinServer.prototype.getUser = function getUser(token, done) {
    return new Promise((resolve, reject) => {
        const request = {
            token,
        };
        this.client.methods.getUser({ path: request, headers: json_content }, (data, response) => {
            const code = response.statusCode;
            if (code !== 200 && code !== 201) {
                const error = new Error(`OdinServer Error ${code} ${response.statusMessage}`);
                return done ? done(error) : reject(error);
            }
            return done ? done(null, data) : resolve(data);
        }).on('error', (err) => {
            return done ? done(err) : reject(err);
        });
    });
}
OdinServer.prototype.getPermission = function getPermission(token, done) {
    return new Promise((resolve, reject) => {
        const request = {
            token,
        };
        this.client.methods.getPermission({ path: request, headers: json_content }, (data, response) => {
            const code = response.statusCode;
            if (code !== 200 && code !== 201) {
                const error = new Error(`OdinServer Error ${code} ${response.statusMessage}`);
                return done ? done(error) : reject(error);
            }
            return done ? done(null, data) : resolve(data);
        }).on('error', (err) => {
            return done ? done(err) : reject(err);
        });
    });
}
OdinServer.prototype.getConsent = function getConsent(token, done) {
    return new Promise((resolve, reject) => {
        const request = {
            token,
        };
        this.client.methods.getConsent({ path: request, headers: json_content }, (data, response) => {
            const code = response.statusCode;
            if (code !== 200 && code !== 201) {
                const error = new Error(`OdinServer Error ${code} ${response.statusMessage}`);
                return done ? done(error) : reject(error);
            }
            return done ? done(null, data) : resolve(data);
        }).on('error', (err) => {
            return done ? done(err) : reject(err);
        });
    });
}
function addStrategyConsent(passport, server, userHandler, options) {
    passport.use('odinsdk-consent', new OdinStrategy({
        authorizationURL: options.odinsdk.consentURL,
        tokenURL: options.odinsdk.tokenURL,
        clientID: options.odinsdk.clientID,
        clientSecret: options.odinsdk.clientSecret,
        callbackURL: options.odinsdk.callbackURLConsent,
        scope: options.odinsdk.scope,
    },
        function (token, refreshToken, profile, done) {
            process.nextTick(function () {
                return Promise.all([server.getUser(token), server.getPermission(token)]).then(ressources => {
                    var remote_user = ressources[0];
                    var remote_permission = ressources[1];
                    if (remote_user && remote_permission) {
                        var user = {
                            id: remote_user.id,
                            username: remote_user.username,
                            token,
                        }
                        var permission = remote_permission;
                        console.log(JSON.stringify(permission));
                        return userHandler(user, permission, (err, consent) => {
                            if (err) {
                                done(err);
                            } else {
                                done(null, consent);
                            }
                        });
                    }
                }).catch((err) => {
                    return done(err);
                });
            });
        }));
}
function addStrategyAuthenticate(passport, server, userHandler, options) {
    passport.use('odinsdk-authentify', new OdinStrategy({
        authorizationURL: options.odinsdk.authentificationURL,
        tokenURL: options.odinsdk.tokenURL,
        clientID: options.odinsdk.clientID,
        clientSecret: options.odinsdk.clientSecret,
        callbackURL: options.odinsdk.callbackURLAuthentify,
        scope: '',
    },
        function (token, refreshToken, profile, done) {
            process.nextTick(function () {
                return server.getUser(token).then((remote_user) => {
                    if (remote_user) {
                        var user = {
                            id: remote_user.id,
                            username: remote_user.username,
                            token,
                        }
                        return userHandler(user, null, (err, consent) => {
                            if (err) {
                                done(err);
                            } else {
                                done(null, consent);
                            }
                        });
                    } else {
                        done(null, false);
                    }
                }).catch((err) => {
                    return done(err);
                });
            });
        }));
}
/**
 * @constructor
 */
function ConsentServer(passport, userHandler, options) {
    this._userHandler = function (tmpuser, tmppermission, done) {
        return userHandler(tmpuser, tmppermission, (err, user, permission) => {
            if (err) return done(err);
            return done(null, { user, permission });
        });
    }

    this._passport = passport;
    this._client = new OdinServer({ host: options.odinsdk.host });
    addStrategyAuthenticate(this._passport, this._client, this._userHandler, options);
    addStrategyConsent(this._passport, this._client, this._userHandler, options);
}

ConsentServer.prototype.consent = function (options) {
    var options = options || {};
    var passport = this._passport;
    var userHandler = this._userHandler;
    return function (request, response, next) {
        // set success rediret to current url if none set
        if (!request.session.odinsdk) {
            request.session.odinsdk = {};
        }
        options.successRedirect = options.successRedirect || request.originalUrl;

        request.session.odinsdk.successRedirect = request.session.odinsdk.successRedirect || options.successRedirect;
        request.session.odinsdk.failureRedirect = request.session.odinsdk.failureRedirect || options.failureRedirect;

        if (request.session.odinsdk.permission) {
            return next();
        }
        passport.authenticate('odinsdk-consent', function (err, consent, info) {
            if (err) {
                return next(err);
            }
            if (!consent) {
                return response.redirect(request.session.odinsdk.failureRedirect);
            }
            request.logIn(consent.user, function (err) {
                if (err) { return next(err); }

                request.session.odinsdk.permission = consent.permission;
                return next();
            });
        })(request, response, next);
    }
}

ConsentServer.prototype.authentify = function (options) {
    var options = options || {};
    var passport = this._passport;
    var userHandler = this._userHandler;
    return function (request, response, next) {
        if (request.isAuthenticated()) {
            return next();
        }
        // set success rediret to current url if none set
        if (!request.session.odinsdk) {
            request.session.odinsdk = {};
        }
        options.successRedirect = options.successRedirect || request.originalUrl;

        request.session.odinsdk.successRedirect = request.session.odinsdk.successRedirect || options.successRedirect;
        request.session.odinsdk.failureRedirect = request.session.odinsdk.failureRedirect || options.failureRedirect;
        passport.authenticate('odinsdk-authentify', function (err, consent, info) {
            if (err) {
                return next(err);
            }
            if (!consent) {
                return response.redirect(request.session.odinsdk.failureRedirect);
            }
            request.logIn(consent.user, function (err) {
                if (err) { return next(err); }

                request.session.odinsdk.permission = consent.permission;
                return next();
            });
        })(request, response, next);
    }
}

exports.ConsentServer = ConsentServer;
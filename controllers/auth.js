require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.serializeUser(function(user, done) { done(null, user) });
  
passport.deserializeUser(function(user, done) { done(null, user) });

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CLIENT_CALLBACK_URL,
    passReqToCallback:true
},  (request, accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }
));
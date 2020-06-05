const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const bcrypt = require("bcryptjs");
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch(error) {
        done(error, null);
    }
});

passport.use('local', new LocalStrategy({
    usernameField: 'username' || 'email'
}, async (username, password, done) => {
    try {
        // 1) Check if the email already exists
        const user = await User.findOne((username.includes("@"))?{ 'email': username }: {'username': username});
        if (!user) {
            return done(null, false, { message: 'Unknown User' });
        }

        // 2) Check if the password is correct
        if (!bcrypt.compareSync(password,user.password)) {
            return done(null, false, { message: 'Unknown Password' });
        }

        // 3) Check if email has been verified
        if (!user.active) {
            return done(null, false, { message: 'Sorry, you must verify email first' });
        }
         var users = username
        return done(null, user, {message: `${users} logged in`});
    } catch(error) {
        return done(error, false);
    }
}));
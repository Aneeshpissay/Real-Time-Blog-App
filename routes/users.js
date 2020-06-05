var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var bodyParser = require('body-parser');
var passport = require('passport');
var async = require("async");
var nodemailer = require("nodemailer");
const methodOveride = require("method-override");
var Joi = require('@hapi/joi');
var crypto = require("crypto");
var flash = require("connect-flash");
var mailer = require("../mail");
var axios = require('axios');
var randomstring = require('randomstring');
// Load User model
var User = require('../models/User');
var { forwardAuthenticated } = require('../config/auth');
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: true }))
var userSchema = Joi.object().keys({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  password2: Joi.any().valid(Joi.ref('password')).required()
});

router.use(async function(req, res, next){
   res.locals.currentUser = req.user;
   if(req.user) {
    try {
      let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
      res.locals.notifications = user.notifications.reverse();
    } catch(err) {
      console.log(err.message);
    }
   }
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});

router.use(methodOveride("_method"));
var isNotAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.flash('error', 'Sorry, but you are already logged in!');
    res.redirect('/');
  } else {
    return next();
  }
};
function isLogged(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  req.flash("error","You must be logged in!");
  res.redirect("/login");
};
var pw = process.env.GMAILPW;
var ur = process.env.GMAILUR;

router.get('/',(req,res)=>{
    res.render("home");
})

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('login')
});

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => res.render('register'));

router.get('/contact',isLogged,(req, res)=>{
  res.render("contact");
});

router.post("/contact",(req, res)=>{
  const smtpTrans = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: ur,
      pass: pw
    }
  })

  // Specify what the email will look like
  const mailOpts = {
    from: `${req.body.email}`, // This is ignored by Gmail
    to: ur,
    subject: `New Message from ${req.body.username}`,
    text: `${req.body.message}`
  }

  // Attempt to send the email
  smtpTrans.sendMail(mailOpts, (error, response) => {
    if (error) {
      req.flash("error","Error sending")
      res.redirect("/contact") // Show a page indicating failure
    }
    else {
      req.flash("success","Messge Successfully Sent")
      res.redirect('/contact'); // Show a page indicating success
    }
  })
})
// Register
router.route('/register')
  .get(isNotAuthenticated, (req, res) => {
    res.render('register');
  })
  .post(async (req, res, next) => {
    try {
      var result = userSchema.validate(req.body);
      if (result.error) {
        req.flash('error', result.error.message);
        res.redirect('register');
        return;
      }

      // Checking if email is already taken
      var user = await User.findOne({ 'email': result.value.email });
      if (user) {
        req.flash('error', 'Email is already in use.');
        res.redirect('/register');
        return;
      }

      // Hash the password
      var hash = await User.hashPassword(result.value.password);

      // Generate secret token
      var verifyEmail = randomstring.generate();

      // Save secret token to the DB
      result.value.verifyEmail = verifyEmail;

      // Flag account as inactive
      result.value.active = false;

      // Save user to DB
      delete result.value.password2;
      result.value.password = hash;

      var newUser = await new User(result.value); 
      await newUser.save();
      var html = `Hi there,
      <br/>
      Thank you for registering!
      <br/><br/>
      Please verify your email by typing the following token:
      <br/>
      Token: <b>${verifyEmail}</b>
      
      <br/><a class="btn btn-primary" href="https://advanced-blog-app.herokuapp.com/verify">Verify your account</a><br/>
      Enjoy the Chat App<br/>
      Have a pleasant day.` 

      // Send email
      await mailer.sendEmail(ur, result.value.email, 'Please verify your email!', html);
      req.flash('success', 'Please check your email.');
      res.redirect('/login');
    } catch(error) {
      next(error);
    }
  });

router.route('/verify')
  .get(isNotAuthenticated, (req, res) => {
    res.render('verify');
  })
  .post(async (req, res, next) => {
    try {
      var { email,verifyEmail } = req.body;

      // Find account with matching secret token
      var user = await User.findOne({ email:email,'PasswordToken': verifyEmail });
      if (!user) {
        req.flash('error', 'No user found.');
        res.redirect('/verify');
        return;
      }

      user.active = true;
      user.verifyEmail = null;
      await user.save();

      req.flash('success', 'Thank you for verification! Now you may login.');
      res.redirect('/login');
    } catch(error) {
      next(error);
    }
  })

// Login
router.route('/login')
  .post(passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/',
    successFlash: true,
    failureFlash: true
  }));

router.post('/login/verify', function(req, res) {
        verifyRecaptcha(req.body["g-recaptcha-response"], function(success) {
                if (success) {
                        res.redirect(307,'/login');
                        // TODO: do registration using params in req.body
                } else {
                        req.flash("error","Please select the captcha");
                        return res.redirect('/login');
                        // TODO: take them back to the previous page
                        // and for the love of everyone, restore their inputs
                }
        });
});

router.post('/register/verify', function(req, res) {
        verifyRecaptcha(req.body["g-recaptcha-response"], function(success) {
                if (success) {
                        res.redirect(307,'/register');
                        // TODO: do registration using params in req.body
                } else {
                        req.flash("error","Please select the captcha");
                        return res.redirect('/register');
                        // TODO: take them back to the previous page
                        // and for the love of everyone, restore their inputs
                }
        });
});

router.get('/forgot', function(req, res) {
  res.render('forgot');
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: ur,
          pass: pw
        }
      });
      var mailOptions = {
        to: user.email,
        from: ur,
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'https://advanced-blog-app.herokuapp.com/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.password2) {
          bcrypt.genSalt(10,(err,salt)=>{
             bcrypt.hash(req.body.password, salt, (err, hash)=>{
            user.password = hash;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
                  });
                })
             })
          })
            
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: ur,
          pass: pw
        }
      });
      var mailOptions = {
        to: user.email,
        from: ur,
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/');
  });
});

router.get('/logout', (req, res) => {
  var name = req.user.username
  req.logout();
  req.flash('success',`${name} you are logged out!`);
  res.redirect('/login');
});

router.get('/about',(req,res)=>{
  res.render("about");
});

module.exports = router;

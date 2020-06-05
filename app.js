var express = require('express'),
	app = express(),
	session = require('express-session'),
	passport = require('passport'),
	mongoose = require('mongoose'),
	flash = require("connect-flash");
  var bodyParser = require('body-parser');
 var Comment = require('./models/Comment');
 var Blog = require('./models/Blog');
 var User = require('./models/User');
var http = require("http").createServer(app);
var io = require("socket.io")(http);

require('dotenv').config();

require('./config/passport');

app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
  })
);

app.use(flash());

app.set('view engine', 'ejs');

app.use(express.static("public"));

var db = process.env.mongoURI;
var connect = mongoose.connect(db, { useNewUrlParser: true,useUnifiedTopology: true, useFindAndModify:false})

app.use(passport.initialize());
app.use(passport.session());

app.use(async function(req, res, next){
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

app.use('/', require('./routes/users.js'));
app.use('/blogs', require('./routes/blogs.js'));

app.post("/blogs/:id/comment",(req, res)=>{
  Blog.findById(req.params.id,(err, blog)=>{
    if(err){
      console.log(err);
    }
    else{
      var message = req.body.message
      var newMessage = {message: message}
      Comment.create(newMessage, function(err, comment){
        if(err){
          console.log(err);
        }
        else{
            comment.author.id = req.user._id
            comment.author.username = req.user.username
            comment.save();
            blog.comments.push(comment);
            blog.save();
            res.redirect('back');
        }
      })
    }
  })
})

io.on('connection',socket=>{
     socket.on("new_comment", comment=>{
    io.emit("new_comment", comment);
  })
     socket.on("blogSent",message=>{
       socket.broadcast.emit("blogSent", message);
     });
     socket.on("messageSent",message=>{
       socket.broadcast.emit("messageSent", message);
     });
});


http.listen(process.env.PORT||3000);
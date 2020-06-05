var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var methodOveride = require("method-override");
var flash = require("connect-flash");
var Blog = require('../models/Blog');
var Comment = require("../models/Comment");
var mongoose = require('mongoose');
var fs = require("fs");
var multer = require('multer');
var path = require("path");
const webPush = require('web-push');
var Notification = require("../models/notification");
var User = require("../models/User");

var moment = require('moment');

router.use(express.json());

router.use(bodyParser.urlencoded({ extended: true }));

var Storage = multer.diskStorage({
	destination: "./public/uploads/",
	filename: (req, file, cb)=>{
		cb(null,file.fieldname + "-" + Date.now() + path.extname(file.originalname));
	}
});

var upload = multer({
	storage: Storage
}).single("file");


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

function isLogged(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  req.flash("error","You must be logged in!");
  res.redirect("/login");
};

router.get('/',isLogged,(req, res)=>{
	var noMatch = null;
	if(req.query.search){
		const regex = new RegExp(escapeRegex(req.query.search),'gi');
		Blog.find({'$or':[{title: regex},{description: regex}, {name: regex}]}, function(err, allFiles){
		if(err){
			res.send(err);
		}
		else{
			if(allFiles.length < 1){
				noMatch = "No Blog Post Found, please try again"
			}
			res.render("blog",{files :allFiles, noMatch: noMatch});
		}
	})
	}
	else{
		Blog.find({}, function(err, allFiles){
		if(err){
			res.send(err);
		}
		else{
			res.render("blog",{files :allFiles, noMatch: noMatch});
		}
	})
	}
});


router.post('/', upload,isLogged, async (req, res)=>{
	var name = req.user.username
	var img = req.file.filename;
	var title = req.body.title;
	var description = req.body.description
	var author = {
		id: req.user._id,
		username: req.user.username
	}
	var newBlog = {name: name, image: img, title: title, description: description, author: author}
	 try {
      let blog = await Blog.create(newBlog);
      let user = await User.findById(req.user._id).populate('followers').exec();
      let newNotification = {
        username: req.user.username,
        blogId: blog.id
      }
      for(const follower of user.followers) {
        let notification = await Notification.create(newNotification);
        follower.notifications.push(notification);
        follower.save();
      }

      //redirect back to campgrounds page
      res.redirect(`/blogs/${blog.id}`);
    } catch(err) {
      req.flash('error', err.message);
      res.redirect('back');
    }
});

router.post("/:id/likes",(req, res)=>{
	Blog.findById(req.params.id, function (err, foundBlog) {
        if (err) {
            console.log(err);
            return res.redirect("/blogs/" + foundBlog._id);
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundBlog.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundBlog.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundBlog.likes.push(req.user);
        }

        foundBlog.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/blogs/" + foundBlog._id);
            }
            return res.redirect("/blogs/" + foundBlog._id);
        });
    });
})

router.delete("/:id",isLogged, (req, res)=>{
	Blog.findById(req.params.id, function(err, deleteBlog){
		if(err){
			req.flash("error","Error finding Blog")
			res.redirect("/blogs")
		}
		else{
			var image = deleteBlog.image;
			Blog.find({'image': image}, (err, succDel)=>{
				if(err){
					req.flash("error","Error deleting Blog")
					res.redirect("/blogs");
				}
				else{
					Blog.findByIdAndRemove(req.params.id, err=>{
						req.flash("success","Successfully Deleted the Blog Post")
						res.redirect("/blogs");
					})
				}
			})
		}
	})
});

router.delete("/:comment_id/comment", (req, res)=>{
  Comment.findByIdAndRemove(req.params.comment_id, function(err, comment){
        if(err){
          console.log(err);
        }
        else{
            res.redirect("back");
        }
      })
})

router.get("/:id",isLogged,(req ,res)=>{
	Blog.findById(req.params.id).populate("comments likes").exec((err, foundBlog)=>{
			if(err){
			req.flash("error","Could not find the blog post")
			res.redirect("/blogs")
		}
		else{
			res.render("blog_view",{moment: moment,blog: foundBlog});
		}
	})
})


function escapeRegex(text){
	return text.replace(/[-[\]{}()*+?.,\\^$!#\s]/g,"\\$&");
}

router.get('/notifications', isLogged, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    console.log(allNotifications);
    res.render('index', { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/notifications/:id', isLogged, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/blogs/${notification.blogId}`);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/follow/:id', isLogged, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash("success","Successfully followed: " + user.username + "!");
    res.redirect('/blogs');
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/users/:id', async function(req, res) {
  try {
    let user = await User.findById(req.params.id).populate('followers').exec();
    res.render('profile', { user });
  } catch(err) {
    req.flash('error', err.message);
    return res.redirect('back');
  }
});

module.exports = router;
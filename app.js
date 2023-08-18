//jshint esversion:6
//prerequisite code
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
//const _ = require("lodash");
//const popup = require("popups");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require( 'passport-google-oauth20' ).Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false,
    //cookie: { secure: true }
  }))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/storyDB", {useNewUrlParser: true});

const storySchema = {
    user: String,
    title: String,
    content: String,
    continue: String,
};

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
});

const publishSchema = new mongoose.Schema({
    pubUser: String,
    pubTitle: String,
    pubContent: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const Story = mongoose.model("Story", storySchema);

const User = new mongoose.model("User", userSchema);

const Publish = mongoose.model("Publish", publishSchema);

passport.use(User.createStrategy());


passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback   : true,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value }, function (err, user) {
        currentUser = profile.emails[0].value;
      return done(err, user);
    });
  }
));

//prerequisite code


//-----------------------------------------------------------------------------------------------------------//


//MAIN CODE



let continueStoryId = 0; //for continue function
let currentUser = ""; //for continue function


app.get("/", function(req,res){
    if(req.isAuthenticated()){
            Story.findOne({user: currentUser, continue: "1"}).then(f =>{
                if(f===null){  //--> if no story has continue attribute as 1 
                    Story.find({user: currentUser}).sort({_id: -1}).limit(1).then(f =>{  //-->gets id of latest added story, (used to make continue functionable)
                    if(f.length===0){
                        res.render("home",{
                            storyId: 0
                        })
                    }else{
                        continueStoryId = f[0]._id;  
                        f[0].continue = "1";
                        res.render("home",{            //-->when this function was outside of Story.find() function then continueStoryId was storing only 0 untill we refresh the page, it started working
                            storyId: continueStoryId  //when res.render() was brought inside Story.find()
                        });
                    }
                });
                }else { //--> if a story has continue attribute as 1
                continueStoryId = f._id;
                res.render("home", {
                    storyId: continueStoryId
                });}

            });
      
}else{
    res.redirect("/signin")
}
});



//Login/Register page (get)
app.get("/signin", function(req,res){
    res.render("signin");
});

app.get("/login", function(req,res){
    res.render("login");
});

app.get("/register", function(req,res){
    res.render("register");
});

app.get('/auth/google',
  passport.authenticate('google', { scope:
      [ 'email', 'profile' ] }
));

app.get( '/auth/google/secrets',
    passport.authenticate( 'google', {
        successRedirect: '/',
        failureRedirect: '/login'
}));



//Login/Register page (post)
app.post("/login", function(req,res){
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req, res, function(){
                currentUser = req.user.username;
                res.redirect("/");
            })
        }
    })
});

app.post("/register", function(req,res){
    User.register({username: req.body.username}, req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                currentUser = req.user.username;
                res.redirect("/");
            })
        }
    })
});


//Logout page
app.get("/logout", function(req,res,next){
    req.logout(function(err){
        if(err){return next(err)}
        continueStoryId = 0;
        res.redirect("/");
    });
    
});


//+ New Story Page
app.get("/newstory", function(req,res){
    res.render("newStory",{
        title: "𝘵𝘪𝘵𝘭𝘦",
        content: "𝘺𝘰𝘶𝘳 𝘴𝘵𝘰𝘳𝘺"
    });
})

app.post("/newstory", function(req, res){
    const findTitle = req.body.storyTitle
    //only store stories with unique title
    Story.countDocuments({user:currentUser, title: findTitle}).then(f => {
        if(f>0){
            console.log("Story exists");
            
            res.redirect("/newstory");
        }
        else{
            Story.updateOne({user: currentUser, continue: "1"},{$set: {continue: "0"}}).then(f => { //--> here we are finding the story of currentUser with continue attribute set to 1. If found then it is set to 0 to ensure that no other stories with an attribute of 1 exists       
                const story = new Story({
                    user: currentUser,
                    title: req.body.storyTitle,
                    content: req.body.storyBody,
                    continue: "1",
                    publish: "no"
                  });
              
                  story.save();
            })
              
            
                res.redirect("/");
        }
    });
  
  });



  


//Read your Story page
app.get("/read", function(req, res){
Story.find({user: currentUser}).then(stories => {
res.render("read", {
    stories: stories,
    });
});
});

app.get("/stories/:storyId", function(req, res){
const requestedStoryId = req.params.storyId;
Story.findOne({_id: requestedStoryId}).then(story => {
    res.render("story", {
    title: story.title,
    content: story.content
    });
})

});


//Delete your Story
app.get("/delete",function(req,res){
    Story.find({user: currentUser}).then(stories =>{
        res.render("delete",{
            stories: stories
        })
    })
    
});
app.post("/delete",function(req,res){

    let arr = req.body.input;
    const isArr = Array.isArray(arr);

    if(isArr===false){ 
    //Deleting Single Story
    Story.deleteOne({_id: req.body.input}).then(f => {
        console.log("Deleted one Successfully");;
        });
        res.redirect("/delete")
    }
    else{
    //Deleting Multiple Stories
    arr.forEach(element => {
        Story.deleteOne({_id: element}).then(f => {
            console.log("Deleted all Successfully");;
        })
    });
    res.redirect("/delete");
    }
});


//Edit Story
app.get("/edit",function(req,res){
    Story.find({user: currentUser}).then(stories =>{
        res.render("edit",{
            stories: stories
        })
    })
    
});
app.get("/stories/edit/:storyId", function(req, res){
    const requestedStoryId = req.params.storyId;                                    //--> Logic for continue button is that a number is assigned with
                                                                                   //continue attribute i.e 0 or 1, the story that has attribute set as 1 will be our last edited story 
    continueStoryId = requestedStoryId;  //gets id of story recently edited
    Story.updateOne({user: currentUser, continue: "1"},{$set: {continue: "0"}}).then(story => { //--> here we are finding the story of currentUser with continue attribute set to 1. If found then it is set to 0 to ensure that no other stories with an attribute of 1 exists       
        Story.updateOne({_id: requestedStoryId, user: currentUser},{$set: {continue: "1"}}).then(story => { // After resetting the continue attribute to 0 in the outer function, the inner function will set the continue attribute for the current story of the current user to 1
            console.log("Edit continue updated successfully");                                              // which means that this story will be considered the latest edited story
            
        })
    })
    
    Story.findOne({_id: requestedStoryId}).then(story => {
        res.render("toeditstory", {
        title: story.title,
        content: story.content,
        storyId: story._id
        });
    })
    
});



app.post("/toeditstory", function(req, res){
    const requestedStoryId = req.body.button; //id sent as a button 

    //to update both the fields
    Story.updateOne({_id: requestedStoryId},{$set: {title: req.body.storyTitle, content: req.body.storyBody}}).then(story => {

        console.log("updated successfully");
    })
   
    res.redirect("/edit");
});




//Publish
app.get("/publish",function(req,res){
    Story.find({user: currentUser}).then(stories =>{
        res.render("publish",{
            stories: stories
        })
    })
});



app.post("/publish",function(req,res){
    const storiesId = req.body.input;
        Story.findOne({_id: storiesId}).then(story=>{
            Publish.countDocuments({pubUser:story.user, pubTitle: story.title, pubContent: story.content}).then(e => {
                if(e>0){
                    console.log("Story already published");
                }else{
                    const pub = new Publish({
                        pubUser: story.user,
                        pubTitle: story.title,
                        pubContent: story.content,
                
                      });
                    pub.save().then(f =>{
                        console.log("saved successfully");
                    });
                }
            });
            
        });
        
   
    res.render("common")

})



//Community
app.get("/community",function(req,res){
    
    Publish.find().then(pubStories =>{
        res.render("community",{
            pubStories: pubStories,
        })
    })
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
  });
  
  
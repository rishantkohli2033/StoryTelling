//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
//const _ = require("lodash");
//const popup = require("popups");
const mongoose = require("mongoose");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect("mongodb://127.0.0.1:27017/storyDB", {useNewUrlParser: true});

const storySchema = {
    title: String,
    content: String,
};

const Story = mongoose.model("Story", storySchema);

let continueStoryId = 0;  //for continue function

Story.findOne().sort({_id: -1}).limit(1).then(f =>{
    continueStoryId = f._id;   //gets id of latest added story
    //console.log(continueStory);
})

app.get("/", function(req,res){
    //console.log(continueStory);
    res.render("home",{
        storyId: continueStoryId
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
    //console.log(req.body.storyTitle)
    const findTitle = req.body.storyTitle
    //only store stories with unique title
    Story.countDocuments({title: findTitle}).then(f => {
        if(f>0){
            console.log("Story exists");
            
            res.redirect("/newstory");
        }
        else{
              const story = new Story({
                  title: req.body.storyTitle,
                  content: req.body.storyBody,
                });
            
                story.save();
            
                res.redirect("/");
        }
    });
  
  });



  


//Read your Story page
app.get("/read", function(req, res){
Story.find().then(stories => {
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
    Story.find().then(stories =>{
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
    Story.find().then(stories =>{
        res.render("edit",{
            stories: stories
        })
    })
    
});
app.get("/stories/edit/:storyId", function(req, res){
    const requestedStoryId = req.params.storyId;
    continueStoryId = requestedStoryId;  //gets id of story recently edited
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




app.listen(3000, function() {
    console.log("Server started on port 3000");
  });
  
  
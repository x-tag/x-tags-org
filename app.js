var path = require('path'),
  fs = require('fs'),
  express = require('express'),
  app = express(),
  Settings = require('settings'),
  nunjucks = require('nunjucks'),
  md = require('github-flavored-markdown'),
  moment = require('moment');

var config = new Settings(require('./config'));

app.disable('view cache');
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('app/views'));
env.express(app);

app.get('^(/|/index)$', function(req, res){

  render(req,res,'index.html', { });

});

app.get('/blog', function(req, res){

  fs.readdir(config.blogpath, function(err, files){
    if (err){
      return render(req,res,'blog.html', { posts: [] });
    }

    var posts = [];
    files.forEach(function(file){
      if (path.extname(file) == '.md'){
        posts.splice(0,0,createBlogItem(file));
      }
    });

    render(req,res,'blog.html', { posts: posts });

  });
});



app.get('/blog/:permalink', function(req, res){

  var filePath = path.join(config.blogpath, req.params.permalink + ".md");
  if (fs.exists(filePath)){
    render(req,res,'blog.html', { posts: [ createBlogItem(filePath) ]});
  }
  else {
    render(req,res,'index.html', {});
  }

});

app.get('/registry', function(req, res){

  render(req,res,'registry.html', { });

});

app.get('/docs', function(req, res){

  render(req,res,'docs.html', { });

});

app.get('/about', function(req, res){

  render(req,res,'about.html', { });

});

app.listen(process.env.PORT || process.env.VCAP_APP_PORT || 3000);

/*
  reads and parses a blog markdown file
*/
function createBlogItem(filePath){
  var content = fs.readFileSync(path.join(config.blogpath,filePath),'utf-8');
  content = md.parse(content);
  filePath = filePath.replace('.md','');
  var fileParts = filePath.split('-');

  return { 
    date: moment(fileParts.splice(0,3).join('-')).format('MMMM Do, YYYY'),
    permalink: filePath,
    content: content };
}

/*
  Decide between rendering template with layout
*/
function render(req, res, page, data){
  if(typeof req.query.frag != 'undefined'){
    page = "_" + page;
  }
  console.log("rendering:", page, data);
  res.render(page, data);
}

/*
var data = { url: "/about" };
var broken = new nunjucks.Template("{% if url.indexOf('/about')==0 %} selected {% endif %}");
console.log(broken.render(data));
//TypeError: String.prototype.indexOf called on null or undefined

var works = new nunjucks.Template("{% if url == '/about' %} selected {% endif %}");
console.log(works.render(data));
*/


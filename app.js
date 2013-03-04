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

var env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(
    path.join('app','views')));

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

  var fileName = req.params.permalink + ".md";
  if (fs.existsSync(path.join(config.blogpath,fileName))){
    render(req,res,'blog.html', { posts: [ createBlogItem(fileName) ]});
  }
  else {
    render(req,res,'index.html', {});
  }

});

app.get('/registry', function(req, res){

  res.redirect('http://registry.x-tags.org/');

});

app.get('/docs', function(req, res){

  render(req,res,'docs.html', { });

});

app.get('/about', function(req, res){

  render(req,res,'about.html', { });

});

var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
console.log("x-tags.org listening on port:", port)
app.listen(port);



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
  if (typeof req.query.frag != 'undefined'){
    page = "_" + page;
  }
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


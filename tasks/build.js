var bower = require('bower'),
  path = require('path'),
  tools = require('./statictools'),
  fs= require('fs');

module.exports = function(grunt){

  grunt.registerTask('dgen', 'Generate dependencies file' , function(){
    var done = this.async();

    grunt.util.spawn({cmd:'bower', args: ['-j', 'list']}, function(e, result){
      if (e) grunt.log.write(e);
      grunt.log.debug('parsing bower data');
      var bower_data;
      try {
        bower_data = JSON.parse(result.stdout);
      } catch (e) {
        grunt.log.error('cannot parse bower output. giving up.');
        grunt.log.debug('bower said:');
        grunt.log.debug(result.stdout);
        return done(e);
      }

      var dependencies = tools
        .flattenBowerDependencies(bower_data)
        .map(function (item) {
            var key = Object.keys(item)[0];
            delete item[key].dependencies['brick-common'];
            item[key].dependenciesArray = Object.keys(item[key].dependencies);
            item.key = key;
            return item;
      });

      grunt.file.write('dependencies.json', JSON.stringify(dependencies,null,2));

      done();

    });
  });

  grunt.registerTask('downloadpage', 'Generate download page' , function(){
    var done = this.async();

    var dependencies = require('../dependencies.json').filter(function(item){
      var key = Object.keys(item)[0];
      return key != 'brick-common';
    });

    var mixins = dependencies.filter(function(item){
      return packageType(item,['mixin']);
    });

    var components = dependencies.filter(function(item){
      return packageType(item,['component','element']);
    });

    var libraries = dependencies.filter(function(item){
      return packageType(item,['lib','library']);
    });

    var pseudos = dependencies.filter(function(item){
      return packageType(item,['pseudo']);
    });

    var polyfill = dependencies.filter(function(item){
      return !packageType(item,['pseudo','lib','library','component','element','mixin']) || packageType(item,['polyfill']);
    });

    var finalComponents = {
        'components': components,
        'pseudos': pseudos,
        'mixins': mixins,
        'libraries': libraries,
        'polyfills': polyfill
      };

      Object.keys(finalComponents).forEach(function(key){
        finalComponents[key] = finalComponents[key].sort(function(a,b){
          a = a[a.key].endpoint.name.replace('x-tag-','');
          b = b[b.key].endpoint.name.replace('x-tag-','');
          if(a > b) return 1;
          if(a < b) return -1;
          return 0;
        });
      });

    tools.staticPage('download.html',
      path.join('app','views','templates','content','download.html'),
        { packageTypes: finalComponents });
  });

  grunt.registerTask('build-dist', 'Build dist from bower components' , function(){
    var done = this.async();

    try {
      var sourcePath = 'bower_components';
      grunt.log.writeln('Fetching files from ' + sourcePath);
      buildGruntConfiguration(grunt, sourcePath, function(err, configs){
        if (err) grunt.log.write(JSON.stringify(err));
        execGrunt(grunt, sourcePath, configs, done);
      });
    } catch (e) {
      grunt.log.error('something has gone terribly wrong.');
      grunt.log.error(JSON.stringify(e));
      throw e;
    }
  });

}

function packageType(pkg, types){
  var key = Object.keys(pkg)[0],
    kw = pkg[key].pkgMeta.keywords || [],
    found = false;
  types.forEach(function(t){
    if(kw.map(function(word){return word.toLowerCase();}).indexOf(t)>-1){
      found = true;
    }
  });
  return found;
}

function execGrunt(grunt, sourcePath, configs, done){
  grunt.config.set('cssmin', configs.cssmin );
  grunt.config.set('uglify', configs.uglify );
  grunt.config.set('concat', configs.concat );
  grunt.task.run('concat','cssmin','uglify');
  done();
}

function buildGruntConfiguration(grunt, source, callback){
  var componentLocation = path.join(source,'x-tag-core');
  if (!fs.existsSync(componentLocation)){
      grunt.fail.warn('Source files missing, did you run "bower install" yet?\n');
    return;
  }

  grunt.log.debug('building grunt configuration...');

  var cssConfig = {},
    uglifyConfig = {};

  cssConfig[path.join('public','dist','x-tags.css')] = [];
  uglifyConfig[path.join('public','dist','x-tags.js')] = [];

  grunt.log.debug('spawning bower tasks');

  grunt.util.spawn({cmd:'bower', args: ['-j', 'list']}, function(e, result){
    if (e) grunt.log.write(e);
    grunt.log.debug('parsing bower data');
    var bower_data;
    try {
      bower_data = JSON.parse(result.stdout);
    } catch (e) {
      grunt.log.error('cannot parse bower output. giving up.');
      grunt.log.debug('bower said:');
      grunt.log.debug(result.stdout);
      throw e;
    }

    var dependencies = tools.flattenBowerDependencies(bower_data);

    grunt.log.debug('iterating over component dependencies');

    dependencies.forEach(function(item){
      k = Object.keys(item)[0];

      grunt.log.debug('dependency ' + k);

      var main = Array.isArray(item[k].pkgMeta.main)?
        item[k].pkgMeta.main : [item[k].pkgMeta.main];

      var cssFile = main.filter(function(f){
        if(f.indexOf('.css')>-1){
          return true;
        }
      });

      var jsFile = main.filter(function(f){
        if(f.indexOf('.js')>-1){
          return true;
        }
      });

      var dest = path.join('public','dist', k);

      cssFile.forEach(function(file){
        file = path.join(source, k, file);
        if (cssConfig[dest + '.css']){
          cssConfig[dest + '.css'].push(file);
        }
        else {
          cssConfig[dest + '.css'] = [file];
        }
        cssConfig[path.join('public','dist','x-tags.css')].push(file);
      });

      jsFile.forEach(function(file){
        file = path.join(source, k, file);
        if (uglifyConfig[dest + '.js']){
          uglifyConfig[dest + '.js'].push(file);
        }
        else {
          uglifyConfig[dest + '.js'] = [file];
        }
        uglifyConfig[path.join('public','dist','x-tags.js')].push(file);
      });

    });

    var minCSSConfig = {};
    Object.keys(cssConfig).forEach(function(item){
      minCSSConfig[item.replace('.css','.min.css')] = item;
    });

    var minJSConfig = {};
    Object.keys(uglifyConfig).forEach(function(item){
      minJSConfig[item.replace('.js','.min.js')] = item;
    });

    grunt.log.debug('finishing up');

    callback(null, {
      cssmin: {
        dist:{
          files: minCSSConfig
        }
      },
      uglify: {
        dist:{
          options: {
            mangle: false,
            compress: false,
            beautify: true
          },
          files: uglifyConfig
        },
        'dist-min':{
          files: minJSConfig
        }
      },
      concat: {
        'dist-css':{
          files: cssConfig
        }
      }
    });

  });

}

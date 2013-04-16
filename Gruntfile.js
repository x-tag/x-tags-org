module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    concat: {
      options: {
        separator: '\n',
      },      
      'x-tag-dist': {
        src: [
          'components/document.register/src/document.register.js', 
          'components/x-tag-core/src/core.js'
        ],
        dest: 'public/lib/x-tag-core.js'
      }
    },
    uglify: {      
      'x-tag-dist': {
        files: {
          'public/lib/x-tag-core.min.js': ['public/lib/x-tag-core.js']
        }
      },
      'x-tag-js': {
        files: {
          'public/js/x-tag-components.min.js' : ['public/js/x-tag-components.js']
        }
      }
    }, 
    'smush-components': {
      options: {
        fileMap: {
          js: 'public/js/x-tag-components.js',
          css: 'public/css/x-tag-components.css'
        }
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');  
  grunt.loadNpmTasks('grunt-smush-components');

  grunt.registerTask('build', ['smush-components', 'uglify:x-tag-js']);
  grunt.registerTask('build-dist', ['concat:x-tag-dist','uglify:x-tag-dist']);
  grunt.registerTask('build-all', ['build','build-dist']);
  grunt.registerTask('smush',['smush-components']);
  grunt.registerTask('default', ['build-all']);

};
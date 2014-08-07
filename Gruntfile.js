module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    cssmin: {
        minify: {
            expand: true,
            cwd: '_assets/css/',
            src: '*.css',
            dest: 'css/',
            ext: '.min.css'
        },
        combine: {
            files: {
                'css/site.min.css': 'css/*.css'
            }
        },
        add_banner: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            files: {
                'css/site.min.css': ['css/site.min.css']
            }
        }

    },

    watch: {
        css: {
            files: ['_assets/css/*.*'],
            tasks: ['cssmin'],
            options: {
              spawn: false,
            },
        },
    }
  });

  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('default', ['cssmin']);
};
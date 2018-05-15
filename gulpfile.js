'use strict';
 
var gulp = require('gulp');
var sass = require('gulp-sass');
 
gulp.task('sass', function () {
  return gulp.src('./assets/stylesheets/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./assets/stylesheets'));
});
 
gulp.task('sass:watch', function () {
  gulp.watch('./assets/stylesheets/*.scss', ['sass']);
});
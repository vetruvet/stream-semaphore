# Stream Semaphore

Node.js semaphore for streams. This module allows you to prevent race conditions across independent concurrent streams.

An example use case is preventing a race condition with using [gulp-rev](https://www.npmjs.com/package/gulp-rev) with the `merge` option across multiple streams.
For example, if there is a JS task and a CSS task that both try to write the rev manifest with the merge option, if they happen to finish at the same time, one will overwrite the other instead of merging.
This does not happen all the time but is pain to debug and account for, especially in CI environments.
This module would lock one of the streams until it finishes writing the rev manifest and then would allow the other stream to proceed.

It can also be used as a general-purpose promise-based semaphore.

## Usage

All lock/unlock functions require two parameters: semaphore name and lock name.
This allows multiple independent semaphores and multiple streams per lock.

#### Regular semaphore usage

```js
var sem = require('stream-semaphore');

sem.lock('semaphore-name', 'lock-name').then(function () {
    console.log('received lock for lock-name'); // will print immediately
    setTimeout(function () { sem.unlock('semaphore-name', 'lock-name'); }, 2000);
});

sem.lock('semaphore-name', 'lock-name').then(function() {
    console.log('received lock for lock-name'); // will also print immediately
});

sem.lock('semaphore-name', 'another-lock').then(function () {
    console.log('received lock for another-lock'); // will print after two seconds
    sem.unlock('semaphore-name', 'another-lock')
});

sem.lock('semaphore-name', 'another-lock').then(function () {
    console.log('received lock for another-lock'); // will also print after two seconds
});
```

#### Usage with gulp

```js
var gulp = require('gulp');
var run = require('run-sequence');
var through2 = require('through2');
var sem = require('stream-semaphore');

gulp.task('task1', function () {
  return gulp.src(['gulpfile.js', 'package.json'])
    .pipe(sem.lockStream('semaphore-name', 'task1'))
    .pipe(through2.obj(function (file, enc, cb) {
      console.log('task1:' + file.relative); // will print both file names
      setTimeout(function() { sem.unlock('semaphore-name', 'task1');  }, 2000);
      cb(null, file);
    }))
  ;
});

gulp.task('task2', function () {
  return gulp.src(['gulpfile.js', 'package.json'])
    .pipe(sem.lockStream('semaphore-name', 'task2'))
    .pipe(through2.obj(function (file, enc, cb) {
      console.log('task2:' + file.relative); // will print both file names after two seconds
      cb(null, file);
    }))
    .pipe(sem.unlockStream('semaphore-name', 'task2'))
  ;
});

gulp.task('default', function (cb) {
  run(['task1', 'task2'], cb);
});
```

#### Example with gulp-rev

```js
gulp.task('js', function () {
  return gulp.src('assets/js/**/*.js')
    // uglify, babel, whatever here
    .pipe(rev())
    .pipe('dist')
    .pipe(sem.lockStream('gulp-rev', 'rev-js'))
    .pipe(rev.manifest({merge: true}))
    .pipe('dist')
    .pipe(sem.unlockStream('gulp-rev', 'rev-js'));
});

gulp.task('css', function () {
  return gulp.src('assets/css/**/*.css')
    // postcss, cssmin, whatever here
    .pipe(rev())
    .pipe('dist')
    .pipe(sem.lockStream('gulp-rev', 'rev-css'))
    .pipe(rev.manifest({merge: true}))
    .pipe('dist')
    .pipe(sem.unlockStream('gulp-rev', 'rev-css'));
});
```


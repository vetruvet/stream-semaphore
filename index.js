var through2 = require('through2');

var semaphores = {};

function lock(sem, key) {
  if (!(sem in semaphores)) {
    semaphores[sem] = {
      locked: null,
      streams: {},
      queue: [],
    };
  }

  return new Promise(function(resolve) {
    if (!semaphores[sem].locked) {
      semaphores[sem].locked = key;
      resolve();
    } else if (semaphores[sem].locked === key) {
      resolve();
    } else {
      if (!(key in semaphores[sem].streams)) {
        semaphores[sem].streams[key] = [];
      }

      if (!semaphores[sem].streams[key].length) {
        semaphores[sem].queue.push(key);
      }

      semaphores[sem].streams[key].push(resolve);
    }
  });
}

function unlock(sem, key) {
  if (!(sem in semaphores) || semaphores[sem].locked !== key) {
    return;
  }

  var next = semaphores[sem].queue.shift();
  if (next) {
    var resolve;
    while (resolve = semaphores[sem].streams[next].shift()) {
      resolve();
    }
    semaphores[sem].locked = next;
  } else {
    semaphores[sem].locked = null;
  }
}

function lockStream(sem, key) {
  return through2.obj(function(file, enc, cb) {
    lock(sem, key).then(function() {
      cb(null, file);
    });
  });
}

function unlockStream(sem, key) {
  return through2.obj(function(file, enc, cb) {
    cb(null, file);
  }, function(cb) {
    unlock(sem, key);
    cb();
  });
}

module.exports = {
  lock: lock,
  unlock: unlock,
  lockStream: lockStream,
  unlockStream: unlockStream
};


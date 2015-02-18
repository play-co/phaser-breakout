var fs = require('fs');
var path = require('path');
var config = require('./config.js');

// compute a list of dynamic imports for weeby modules
exports.resolve = function (env, opts) {
  if (config.useWeeby) {
    return ["weeby"];
  }
  return [];
}


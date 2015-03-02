// A little bit of magic can go a long way!

window.__import_phaser_config = function() {
  return jsio('import .config');
}

window.__import_phaser_game = function() {
  return jsio('import .game');
}

import modules.devkit-phaser.src as application;
exports = application;


import ui.resource.Image as Image;
import ui.ImageView as ImageView;
import ui.View as View;
import device;

var addEventListenerAPI = function(el) {
    el.addEventListener = function(event, handler, useCapture) {
        if (!this.__eventListeners) {
            this.__eventListeners = {};
        }
        if (!this.__eventListeners[event]) {
            this.__eventListeners[event] = [];
        }
        this.__eventListeners[event].push({
            handler: handler,
            useCapture: useCapture
        });
    };

    el.removeEventListener = function(event, handler, useCapture) {
        // TODO: what is this check for?
        // if (!el.removeEventListener) {
            if (this.__eventListeners) {
                var listeners = this.__eventListeners[event];
                if (listeners) {
                    for (var i = 0; i < listeners.length; i++) {
                        var listener = listeners[i];
                        if (listener.handler == handler) {
                            listeners.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        // }
    };

    el.publishEvent = function(event, data) {
        if (this.__eventListeners) {
            var listeners =  this.__eventListeners[event];
            if (listeners) {
                listeners.forEach(function(l) {
                    l.handler(data);
                });
            }
        }
    };
};

/** WARNING: Empty object to provide support for phaser, which expectis the
 document.body object to exist. */
if (!document.body) {
    document.body = {};
}
if (!document.addEventListener) {
    addEventListenerAPI(document);
}

import .phaser;
import .game;

var USE_WEEBY = false;
if (USE_WEEBY) { jsio('import weeby'); }

exports = Class(GC.Application, function () {

    this.initUI = function () {
        this._gameLoaded = false;
        this.game = null;

        // Leave the clearing to pixi
        this.engine.updateOpts({
            clearEachFrame: false
        });

        // Get the main canvas and add event listener to it
        if (device.isMobileNative) {
          this._canvas = this.engine.getCanvas();
        } else {
          var _canvasView = this.makeCanvasBackedView(this.style.width, this.style.height);
          this._canvas = _canvasView.getCanvas();
        }

        addEventListenerAPI(this._canvas);
        this.spoofMouseEvents(this, this._canvas);

        GC.hidePreloader();
        if (USE_WEEBY) {
            weeby.on('StartGame', bind(this, 'startGame'));
        } else {
            this.startGame();
        }

    };

    this.spoofMouseEvents = function(view, canvas) {
        function makeMouseEvent(evt) {
            evt.preventDefault = function() {};
            evt.changedTouches = [];
            evt.pageX = evt.screenX = evt.clientX = evt.pt[1].x;
            evt.pageY = evt.screenY = evt.clientY = evt.pt[1].y;
        }

        // Spoof mouse events with devkit input functions
        view.onInputSelect = function(evt, pt) {
            makeMouseEvent(evt);
            canvas.publishEvent('mouseup', evt);
        };
        view.onInputStart = function(evt, pt) {
            makeMouseEvent(evt);
            canvas.publishEvent('mousedown', evt);
        };
        view.onInputMove = function(evt) {
            evt.pt = evt.point; // FIXME this seems like a inconsistency in devkit...
            makeMouseEvent(evt);
            canvas.publishEvent('mousemove', evt);
        }
    }

    this.makeCanvasBackedView = function(width, height) {
        var Canvas = device.get('Canvas');
        var canvas = new Canvas({ width: width, height: height });
        var image = new Image({ srcImage: canvas});
        // // var rootView = weeby.getGameView();
        var rootView = this;
        var iv = new View({
            image: image,
            width: rootView.style.width,
            height: rootView.style.height
        });
        iv.render = function(ctx) {
            image.render(ctx, 0, 0, width, height, 0, 0, this.style.width, this.style.height);
        };
        iv.getCanvas = function() {
            return canvas;
        };

        return iv;
    };

    this.launchUI = function () {
        console.log('in launchUI')
        // We need this function to start the phaser boot process, otherwise it
        // will be waiting for the DOM that doesn't really exist
        // NOTE: Because of how devkit handles the canvas on native, the set
        // timeout is requored so that there is 1 tick between creation and usage
        if (device.isMobileNative) {
          setTimeout(function(){
            document.publishEvent('DOMContentLoaded');
          /*    if (game.boot) {
                  console.log('calling boot');
                  game.boot();
              } else {
                  console.error("Game has no boot function - native start will hang.");
              }*/
          }.bind(this), 0);
        }
    };

    this.startGame = function() {
        console.log('in startGame');
        if (!this._gameLoaded) {
            setTimeout(function() {
                if (game.load) {
                    this.game = game.load(this.style.width, this.style.height, this._canvas);
                    logger.log('game loaded!');
                } else {
                    console.error("Game has no load function - how will the canvas be set?");
                }
            }.bind(this), 0);
            this._gameLoaded = true;
        } else {
            game.resume();
        }
    };

    this.getRootView = function() {
        return USE_WEEBY ? weeby.getGameView() : this.view;
    };
});


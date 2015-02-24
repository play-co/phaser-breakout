
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
import .config;

// For apply on 'new' keyword
var construct = function(constructor, args) {
    function F() {
        return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
}

// Hook Phaser.Game
var phaser_game = Phaser.Game;
Phaser.Game = function() {
    var app = GC.app;
    var width  = arguments[0] || 800;
    var height = arguments[1] || 600;

    // For now force a canvas backend
    arguments[2] = Phaser.CANVAS;

    var game = construct(phaser_game, arguments);

    // Get the main canvas and add event listener to it
    app.canvasView = GC.app.makeCanvasBackedView(width, height);
    app.canvas = app.canvasView.getCanvas();

    addEventListenerAPI(app.canvas);
    app.spoofMouseEvents(app, app.canvas);

    app.game_width  = width;
    app.game_height = height;

    game.setCanvas(app.canvas);
    return game;
};

// Import weeby?
if (config.useWeeby) {
    jsio('import ' + (config.weebyModuleName || 'weeby'));
}

exports = Class(GC.Application, function () {

    this.initUI = function () {
        this._gameLoaded = false;
        this.input_scalex = 1;
        this.input_scaley = 1;

        // Leave the clearing to pixi
        this.engine.updateOpts({
            clearEachFrame: false
        });

        GC.hidePreloader();
        if (config.useWeeby) {
            weeby.on('StartGame', bind(this, 'startGame'));
        } else {
            this.startGame();
        }
    };

    this.spoofMouseEvents = function(view, canvas) {
        var makeMouseEvent = function (evt) {
            evt.preventDefault = function() {};
            evt.changedTouches = [];
            evt.pageX = evt.screenX = evt.clientX = evt.pt[1].x * this.input_scalex;
            evt.pageY = evt.screenY = evt.clientY = evt.pt[1].y * this.input_scaley;
        }.bind(this);

        // Spoof mouse events with devkit input functions
        view.onInputSelect = function(evt, pt) {
            makeMouseEvent(evt);
            canvas.publishEvent('mouseup', evt);
            canvas.publishEvent('touchend', evt);
            canvas.publishEvent('click', evt);
        };
        view.onInputStart = function(evt, pt) {
            makeMouseEvent(evt);
            canvas.publishEvent('mousedown', evt);
            canvas.publishEvent('touchstart', evt);
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
        var rootView = this.getRootView();

        canvas.style.display = 'none';

        var iv = new View({
            image: image,
            width: rootView.style.width,
            height: rootView.style.height,
            parent: this.getRootView()
        });
        iv.render = function(ctx) {
            image.render(ctx, 0, 0, width, height, iv.style.left, iv.style.top, iv.style.width, iv.style.height);
        };
        iv.getCanvas = function() {
            return canvas;
        };

        return iv;
    };

    this.launchUI = function () {
        // NOTE: Because of how devkit handles the canvas on native, the set
        // timeout is required so that there is 1 tick between creation and usage
        if (device.isMobileNative) {
            setTimeout(function(){
                // This starts the phaser boot sequence
                document.publishEvent('DOMContentLoaded');
            }.bind(this), 0);
        }
    };

    this.startGame = function() {
        if (!this._gameLoaded) {
            setTimeout(function() {
                import .game;
            }.bind(this), 0);
            this._gameLoaded = true;
        }
    };

    this.getRootView = function() {
        return config.useWeeby ? weeby.getGameView() : this.view;
    };

    this.scaleGame = function(width, height) {
        console.log('SCALING TO ', width, height);

        this.canvasView.style.width = width;
        this.canvasView.style.height = height;

        this.input_scalex = this.game_width / width;
        this.input_scaley = this.game_height / height;

        // center the game
        this.offsetGame((device.screen.width - width) / 2, (device.screen.height - height) / 2);
    }

    this.offsetGame = function(x, y) {
        this.canvasView.style.left = x;
        this.canvasView.style.top  = y;
    };

    this.try_rescale = function() {
        if (this.canvas) {
            var scr = device.screen;

            if (scr.width != this.last_width || scr.height != this.last_height) {
                this.last_width = scr.width;
                this.last_height = scr.height;

                var game_width = this.game_width;
                var game_height = this.game_height;

                var xsize, ysize;
                var xscale, yscale;

                switch (config.fit) {
                case 'scale':
                    this.scaleGame(scr.width, scr.height);
                    break;

                case 'max':
                    xsize = game_width;
                    ysize = game_height;
                    xscale = scr.width / xsize;
                    yscale = scr.height / ysize;

                    if (xscale < yscale) {
                        xsize *= xscale;
                        ysize *= xscale;
                    } else {
                        xsize *= yscale;
                        ysize *= yscale;
                    }

                    this.scaleGame(xsize, ysize);
                    break;

                default:
                    console.error('Unrecognized value for config.fit');
                }
            }
        }
    };

    this.tick = function(dt) {
        // TODO this should probably be in an "on resize" function
        this.try_rescale();
    };
});


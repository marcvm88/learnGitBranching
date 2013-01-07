var _ = require('underscore');
var Q = require('q');
// horrible hack to get localStorage Backbone plugin
var Backbone = (!require('../util').isBrowser()) ? require('backbone') : window.Backbone;

var util = require('../util');
var KeyboardListener = require('../util/keyboard').KeyboardListener;
var Command = require('../models/commandModel').Command;

var ModalTerminal = require('../views').ModalTerminal;
var ContainedBase = require('../views').ContainedBase;

var Visualization = require('../visuals/visualization').Visualization;

var GitDemonstrationView = ContainedBase.extend({
  tagName: 'div',
  className: 'gitDemonstrationView box horizontal',
  template: _.template($('#git-demonstration-view').html()),

  events: {
    'click div.command > p.uiButton': 'positive'
  },

  initialize: function(options) {
    options = options || {};
    this.options = options;
    this.JSON = _.extend(
      {
        beforeMarkdowns: [
          '## Git Commits',
          '',
          'Awesome!'
        ],
        command: 'git commit',
        afterMarkdowns: [
          'Now you have seen it in action',
          '',
          'Go ahead and try the level!'
        ]
      },
      options
    );

    var convert = function(markdowns) {
      return require('markdown').markdown.toHTML(markdowns.join('\n'));
    };

    this.JSON.beforeHTML = convert(this.JSON.beforeMarkdowns);
    this.JSON.afterHTML = convert(this.JSON.afterMarkdowns);

    this.container = new ModalTerminal({
      title: options.title || 'Git Demonstration'
    });
    this.render();

    this.navEvents = _.clone(Backbone.Events);
    this.navEvents.on('positive', this.positive, this);
    this.navEvents.on('negative', this.negative, this);
    this.keyboardListener = new KeyboardListener({
      events: this.navEvents,
      aliasMap: {
        enter: 'positive',
        right: 'positive',
        left: 'negative'
      },
      wait: true
    });

    this.visFinished = false;
    this.initVis();

    if (!options.wait) {
      this.show();
    }
  },

  takeControl: function() {
    this.hasControl = true;
    this.keyboardListener.listen();
  },

  releaseControl: function() {
    if (!this.hasControl) { return; }
    this.hasControl = false;
    this.keyboardListener.mute();
  },

  reset: function() {
    this.mainVis.reset();
    this.demonstrated = false;
    this.$el.toggleClass('demonstrated', false);
    this.$el.toggleClass('demonstrating', false);
  },

  positive: function() {
    if (this.demonstrated) {
      return;
    }
    this.demonstrated = true;

    this.$el.toggleClass('demonstrating', true);

    var whenDone = Q.defer();
    this.dispatchCommand(this.JSON.command, whenDone);
    whenDone.promise.then(_.bind(function() {
      this.$el.toggleClass('demonstrating', false);
      this.$el.toggleClass('demonstrated', true);
      this.releaseControl();
    }, this));
  },

  negative: function(e) {
    if (this.$el.hasClass('demonstrating')) {
      return;
    }
    this.keyboardListener.passEventBack(e);
  },

  dispatchCommand: function(value, whenDone) {
    var commands = [];
    util.splitTextCommand(value, function(commandStr) {
      commands.push(new Command({
        rawStr: commandStr
      }));
    }, this);

    var chainDeferred = Q.defer();
    var chainPromise = chainDeferred.promise;

    _.each(commands, function(command, index) {
      chainPromise = chainPromise.then(_.bind(function() {
        var myDefer = Q.defer();
        this.mainVis.gitEngine.dispatch(command, myDefer);
        return myDefer.promise;
      }, this));
      chainPromise = chainPromise.then(function() {
        return Q.delay(300);
      });
    }, this);

    chainPromise = chainPromise.then(function() {
      whenDone.resolve();
    });

    chainDeferred.resolve();
  },

  tearDown: function() {
    this.mainVis.tearDown();
    GitDemonstrationView.__super__.tearDown.apply(this);
  },

  hide: function() {
    this.releaseControl();
    this.reset();
    if (this.visFinished) {
      this.mainVis.setTreeIndex(-1);
      this.mainVis.setTreeOpacity(0);
    }

    this.shown = false;
    GitDemonstrationView.__super__.hide.apply(this);
  },

  show: function() {
    this.takeControl();
    if (this.visFinished) {
      setTimeout(_.bind(function() {
        if (this.shown) {
          this.mainVis.setTreeIndex(300);
          this.mainVis.showHarsh();
        }
      }, this), this.getAnimationTime() * 1);
    }

    this.shown = true;
    GitDemonstrationView.__super__.show.apply(this);
  },

  die: function() {
    if (!this.visFinished) { return; }

    GitDemonstrationView.__super__.die.apply(this);
  },

  initVis: function() {
    this.mainVis = new Visualization({
      el: this.$('div.visHolder')[0],
      noKeyboardInput: true,
      noClick: true,
      smallCanvas: true,
      zIndex: -1
    });
    this.mainVis.customEvents.on('paperReady', _.bind(function() {
      this.visFinished = true;
      if (this.shown) {
        // show the canvas once its done if we are shown
        this.show();
      }
    }, this));
  }
});

exports.GitDemonstrationView = GitDemonstrationView;

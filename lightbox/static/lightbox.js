/*jslint indent: 2, plusplus: true */

// Wrap all of this in a self-executing anonymous function. This prevents any
// scope bleeding, but also means that our "use strict" doesn't affect code
// outside this source file.
(function() {
  "use strict";

  var apiCommandPath = '/api',
      apiQueryController = '/api',
      apiQueryOutputs = '/api/outputs',
      lightbox,
      transitionDialog,
      transitionStepsCount,
      toggleButton;

  $(document).ready(function() {
    // Set up theme and theme toggling
    toggleButton = $('.theme-toggle');
    toggleButton.show().find('.dark').show();
    toggleButton.find('.container').width(toggleButton.find('.dark').width());
    toggleButton.on('click', themeToggle);
    // Prepare the transition dialog and Lightbox instance
    transitionDialog = $('#picker').detach();
    lightbox = new Lightbox('#preview');
    lightbox.init();
    lightbox.automaticUpdates(150);
  });

  function themeToggle() {
    var body = $('body');
    if (body.hasClass('dark')) {
      toggleButton.find('.light').fadeIn();
      toggleButton.find('.dark').fadeOut();
      toggleButton.find('.container').animate(
        {'width': toggleButton.find('.light').width()});
    } else {
      toggleButton.find('.light').fadeOut();
      toggleButton.find('.dark').fadeIn();
      toggleButton.find('.container').animate(
        {'width': toggleButton.find('.dark').width()});
    }
    body.toggleClass('light dark');
  }

  function Lightbox(node) {
    this.node = $(node);
    this.controllerInfo = undefined;
    this.outputTemplate = $('.output').detach();
    this.outputs = [];
  }

  Lightbox.prototype.automaticUpdates = function(interval) {
    this.update();
    setInterval(this.update.bind(this), interval);
  };

  Lightbox.prototype.init = function() {
    $.getJSON(apiQueryController, this.setupLightbox.bind(this));
  };

  Lightbox.prototype.setupLightbox = function(apiInfo) {
    // Store API info and unhide dummy paragraph if necessary
    this.controllerInfo = apiInfo;
    if (apiInfo.device.type === 'dummy') {
      $('.dummy-controller').removeClass('hidden');
    }
    // Create the outputs
    var index, output, outputNode;
    for (index = 0; index < apiInfo.outputCount; index++) {
      outputNode = this.outputTemplate.clone();
      output = new Output(index, outputNode, apiInfo);
      this.outputs.push(output);
      this.node.append(output.node);
    }
    // Configure the transition dialog
    var blenders = transitionDialog.find('.blender');
    blenders.empty();
    $.each(this.controllerInfo.layerBlenders, function(_, blender) {
      blenders.append($('<option>', {"value": blender}).text(blender));
    });
    var envelopes = transitionDialog.find('.envelope');
    envelopes.empty();
    $.each(this.controllerInfo.transitionEnvelopes, function(_, envelope) {
      envelopes.append(
          $('<option>', {"value": envelope}).text(envelope));
    });
  };

  Lightbox.prototype.update = function() {
    $.getJSON(apiQueryOutputs, this.updateOutputs.bind(this));
  };

  Lightbox.prototype.updateOutputs = function(info) {
    var index;
    for (index = 0; index < info.length; index++) {
      this.outputs[index].update(info[index]);
    }
  };

  function Output(index, node, apiInfo) {
    this.index = index;
    this.node = node;
    this.layerNodes = node.find('.layers');
    this.layerTemplate = node.find('.layer').detach();
    this.layers = [];
    this.commandRate = apiInfo.commandRate.perOutput;
    this.setTitle('Output ' + (index + 1));
    this.addLayers(apiInfo.layerCount);
  }

  Output.prototype.addLayer = function(index) {
    var layer = new Layer(index, this.layerTemplate.clone(), this);
    this.layers.splice(0, 0, layer);  // Insert at the beginning
    this.layerNodes.append(layer.node);
  };

  Output.prototype.addLayers = function(count) {
    // Creates a number of layers for the output.
    while (count--) {
      this.addLayer(count);
    }
  };

  Output.prototype.setTitle = function(title) {
    // Sets the title that is displayed on the output node.
    this.node.find('h3').text(title);
  };

  Output.prototype.update = function(info) {
    this.node.find('.mixed').css('background-color', info.mixedColorHex);
    var i;
    for (i = 0; i < info.layers.length; i++) {
      this.layers[i].update(info.layers[i]);
    }
  };

  function Layer(index, node, output) {
    this.index = index;
    this.node = node;
    this.node.on('click', this.colorPicker.bind(this));
    this.output = output;
    // Default layer color and opacity values
    this.color = '#000';
    this.opacity = 1;
    this.blender = '';
    this.envelope = '';
    // Placed defaults, render this layer
    this.render();
  }

  Layer.prototype.colorPicker = function(event) {
    new LayerColorPicker(this);
    event.preventDefault();
  };

  Layer.prototype.render = function() {
    this.node.find('.color').css('background-color', this.color);
    this.node.find('.color').css('opacity', this.opacity);
    this.node.find('.opacity').text(Math.round(this.opacity * 100) + '%');
    this.node.find('.blender').text(this.blender);
    this.node.find('.envelope').text(this.envelope);
  };

  Layer.prototype.update = function(layerData) {
    this.color = layerData.colorHex;
    this.opacity = layerData.opacity;
    this.blender = layerData.blender;
    this.envelope = layerData.envelope;
    this.render();
  };

  function LayerColorPicker(layer) {
    this.layer = layer;
    // Color and other variables controlled by the user
    this.color = this.layer.color;
    this.opacity = this.layer.opacity;
    this.steps = transitionStepsCount || 40;
    this.blender = this.layer.blender;
    this.envelope = this.layer.envelope;
    this.updateImmediate = false;
    this.updateQueued = false;
    // Initialize color picker
    this.node = this.createWindow(transitionDialog);
    this.picker = new ColorPicker(
        this.node.find('.color-picker')[0], this.newColor.bind(this));
    // Command rate management
    this.setUpdateThrottler();
  }

  LayerColorPicker.prototype.createWindow = function(node) {
    var opacityPercents = Math.round(this.opacity * 100);
    node.appendTo('body');
    node.find('.opacity-value').text(opacityPercents + '%');
    node.find('.opacity-slider').slider({
      range: 'min',
      max: 100,
      value: opacityPercents,
      slide: this.newOpacity.bind(this),
      change: this.newOpacity.bind(this),
    });
    node.find('.steps-value').text(
      this.transitionDuration(this.steps) + '\u200ams');
    node.find('.steps-slider').slider({
      range: 'min',
      min: 1,
      max: 200,
      value: this.steps,
      slide: this.newSteps.bind(this),
      change: this.newSteps.bind(this),
    });
    node.find('.blender')
        .val(this.blender)
        .off('change')
        .on('change', this.newBlender.bind(this));
    node.find('.envelope')
        .val(this.envelope)
        .off('change')
        .on('change', this.newEnvelope.bind(this));
    node.find('#update-immediate')
        .off('change')
        .on('change', this.setImmediate.bind(this));
    node.find('#update-queued')
        .off('change')
        .on('change', this.setQueued.bind(this));
    node.find('.submit')
        .off('click')
        .on('click', this.submit.bind(this));
    node.lightbox_me({
      centered: true,
      destroyOnClose: true,
      onLoad: this.updatePicker.bind(this)
    });
    return node;
  };

  LayerColorPicker.prototype.updatePicker = function() {
    this.picker.setHex(this.color);
    this.updateImmediate = this.node.find('#update-immediate').is(':checked');
    this.updateQueued = this.node.find('#update-queued').is(':checked');
  };

  LayerColorPicker.prototype.newColor = function(hex) {
    this.color = hex;
    this.node.find('.preview .selected-color').css('background-color', hex);
    this.node.find('.preview .selected-opacity').css('opacity', this.opacity);
    if (this.updateImmediate) {
      this.updateThrottler(this.currentCommand());
    }
  };

  LayerColorPicker.prototype.newOpacity = function(event, ui) {
    this.opacity = ui.value / 100;
    this.node.find('.opacity-value').text(ui.value + '%');
    this.node.find('.preview .selected-opacity').css('opacity', this.opacity);
    if (this.updateImmediate) {
      this.updateThrottler(this.currentCommand());
    }
  };

  LayerColorPicker.prototype.newBlender = function(event) {
    this.blender = event.target.value;
  };

  LayerColorPicker.prototype.newEnvelope = function(event) {
    this.envelope = event.target.value;
  };

  LayerColorPicker.prototype.newSteps = function(event, ui) {
    this.steps = transitionStepsCount = ui.value;
    this.node.find('.steps-value').text(
      this.transitionDuration(this.steps) + '\u200ams');
    this.setUpdateThrottler();
  };

  LayerColorPicker.prototype.currentCommand = function() {
    return {
      color: this.color,
      opacity: this.opacity,
      steps: this.steps,
      queue: this.updateQueued,
      blender: this.blender,
      envelope: this.envelope,
    };
  };

  LayerColorPicker.prototype.setImmediate = function(event) {
    this.updateImmediate = event.target.checked;
  };

  LayerColorPicker.prototype.setQueued = function(event) {
    this.updateQueued = event.target.checked;
  };

  LayerColorPicker.prototype.setUpdateThrottler = function() {
    this.updateThrottler = $.throttle(
        this.transitionDuration(this.steps),
        this.sendCommand.bind(this));
  };

  LayerColorPicker.prototype.sendCommand = function(command) {
    command.output = this.layer.output.index;
    command.layer = this.layer.index;
    $.ajax(apiCommandPath, {
        data: JSON.stringify(command),
        contentType: 'application/json',
        type: 'POST'
      });
  };

  LayerColorPicker.prototype.submit = function() {
    this.sendCommand(this.currentCommand());
    this.node.trigger('close');
  };

  LayerColorPicker.prototype.transitionDuration = function(steps) {
    return 1000 * steps / this.layer.output.commandRate;
  };

}());

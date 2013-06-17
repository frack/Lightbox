/*jslint indent: 2, plusplus: true */

// Wrap all of this in a self-executing anonymous function. This prevents any
// scope bleeding, but also means that our "use strict" doesn't affect code
// outside this source file.
(function() {
  "use strict";

  $(document).ready(function() {
    var lightbox = new Lightbox('#preview');
    lightbox.init();
    lightbox.automaticUpdates(150);
    window.picker = $('#picker_popup').detach();
  });

  function Lightbox(node) {
    this.node = $(node);
    this.apiController = '/api';
    this.apiOutputs = '/api/outputs';
    this.outputTemplate = $('.output').detach();
    this.outputs = [];
    this.info = {};
  }

  Lightbox.prototype.automaticUpdates = function(interval) {
    this.update();
    setInterval(this.update.bind(this), interval);
  };

  Lightbox.prototype.init = function() {
    $.getJSON(this.apiController, this.createOutputs.bind(this));
  };

  Lightbox.prototype.createOutputs = function(apiInfo) {
    var index, output, outputNode;
    for (index = 0; index < apiInfo.outputCount; index++) {
      outputNode = this.outputTemplate.clone();
      output = new Output(index, outputNode, apiInfo);
      this.outputs.push(output);
      this.node.append(output.node);
    }
  };

  Lightbox.prototype.update = function() {
    $.getJSON(this.apiOutputs, this.updateOutputs.bind(this));
  };

  Lightbox.prototype.updateOutputs = function(info) {
    var index;
    for (index = 0; index < info.length; index++) {
      this.outputs[index].update(info[index]);
    }
  };

  function Output(index, node, apiInfo) {
    this.apiInfo = apiInfo;
    this.index = index;
    this.node = node;
    this.layerNodes = node.find('.layers');
    this.layerTemplate = node.find('.layer').detach();
    this.layers = [];
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
    this.node.find('strong').text(title);
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
    this.node.click(this.colorPicker.bind(this));
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
    this.node.find('.opacity').text(Math.round(this.opacity * 100));
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
    this.commandPath = '/api';
    this.layer = layer;
    // Color and other variables controlled by the user
    this.color = this.layer.color;
    this.opacity = this.layer.opacity;
    this.immediateUpdate = true;
    // Initialize color picker
    this.node = this.createWindow(window.picker.clone());
    this.picker = new ColorPicker($('#picker')[0], this.newColor.bind(this));
  }

  LayerColorPicker.prototype.createWindow = function(node) {
    node.appendTo('body');
    node.find('#opacityValue').text(this.opacity * 100);
    node.find('#opacitySlider').slider({
      range: 'min',
      max: 100,
      value: this.opacity * 100,
      slide: this.newOpacity.bind(this),
      change: this.newOpacity.bind(this),
    });
    node.find('#stepsValue').text(40);
    node.find('#stepsSlider').slider({
      range: 'min',
      max: 200,
      value: 40,
      slide: this.newSteps.bind(this),
      change: this.newSteps.bind(this),
    });
    node.lightbox_me({
      centered: true,
      destroyOnClose: true,
      onLoad: this.updatePicker.bind(this)
    });
    return node;
  };

  LayerColorPicker.prototype.updatePicker = function() {
    this.picker.setHex(this.color);
  };

  LayerColorPicker.prototype.newColor = function(hex) {
    this.color = hex;
    this.node.find('.preview .color').css('background-color', hex);
    this.node.find('.preview .opacity').css('opacity', this.opacity);
    if (this.immediateUpdate) {
      this.setColorImmediate();
    }
  };

  LayerColorPicker.prototype.newOpacity = function(event, ui) {
    this.opacity = ui.value / 100
    this.node.find('#opacityValue').text(ui.value);
    this.node.find('.preview .opacity').css('opacity', this.opacity);
    if (this.immediateUpdate) {
      this.setColorImmediate();
    }
  }

  LayerColorPicker.prototype.newSteps = function(event, ui) {
    this.steps = ui.value
    this.node.find('#stepsValue').text(this.steps);
  }

  LayerColorPicker.prototype.setColor = function() {
    this.sendCommand({
      color: this.color,
      opacity: this.opacity,
      steps: this.steps
    });
    this.sendCommand(command);
  };

  LayerColorPicker.prototype.setColorImmediate = function() {
    this.sendCommand({
      color: this.color,
      opacity: this.opacity,
      steps: 1
    });
  };

  LayerColorPicker.prototype.sendCommand = function(command) {
    command.output = this.layer.output.index;
    command.layer = this.layer.index;
    $.ajax(this.commandPath, {
        data: JSON.stringify(command),
        contentType: 'application/json',
        type: 'POST'
      });
  };

}());

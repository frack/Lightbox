# Lightbox

Lightbox is a Python library that controls hardware to drive LED-strips. It was originally written for the Twitterboom (http://twitterboom.nl) project at Frack, and has since seen continued development. All color transitions are performed in LAB color space, ensuring that there are no dips or peaks in perceived lightness during a transition.

## Overview

At the heart of Lightbox is the _Controller_, which interfaces with the attached hardware box. For our existing solution, this is plain serial at 57600 baud. This controller object maintains a number of _Outputs_, abstractions of the physically connected strips. Each output can only assume one color; individually addressable strips are not the target for this library.

Each of these outputs contains a number of _Layers_. With these layers (and the different blend options  exist a number of layers. This allows more advanced setups where you have combined effects, for example:
* a basic color pattern at the lowest layer that changes slowly over time
* a darkening layer that responds to the audio volume in the room
* and an alarm signaling layer at the top for events like a doorbell or incoming email

Lastly, each layer accepts _Transition_ objects, which contain instructions on how the given layer should change appearance. The transition specifies the RGB color and opacity, but also the transition envelope. This is a simple function that determines the transition strength.

The default envelope here is a cosine, which has a slow start and end, giving a smooth looking transition. The other provided option is a linear envelope, which makes the start and end of a transition very visible.

As mentioned, all color transitions are performed in LAB colorspace. When a transition begint, the current color of the layer is converted to LAB space, as well as the target color. The differences for _l_, _a_ and _b_ are determined and using the given envelope, all the intermediate colors between start and finish are determined as they're written to the controller.

The benefit of this is that a transition from red to blue will not dip in lightness (such as with linear RGB color conversions), or have a noticeable peak in lightness (such as with linear HSV conversions), while remaining essentially a linear transition that can be calculated individually for each step.

## JSON API Documentation

There is a basic JSON API available for Lightbox. This can be started using the `api_server.py` script in the main repo directory. The controller used can be chosen with the `--controller` option (this defaults to `JTagController`), as well as the port that the http server binds to (`--port`, default 8000).

### Controller information

Information about the controller and commands that can be sent. The name for the controller is present under the key `controller`, the number of outputs is given as an integer under the key `outputs`. Command rates are specified on the key `commandRate`, this object has entries for both the `combined` and `perOutput` rates.

The physical device information is provided, the `type` of this is always provided, other keys for this are present dependant on the type of the attached hardware.

For transitions, the action, layer blending method, and transition envelope can be configured. The available values for these can be gathered from the API output. The keys `layerBlenders`, `outputActions` and `transitionEnvelopes` have the information for this.

The controller information can be retrieved from `/api`.

```json
{
    "commandRate": {
        "combined": 200,
        "perOutput": 40
    },
    "controller": "JTagController",
    "device": {
        "baudrate": 57600,
        "port": "/dev/ttyUSB1"
        "type": "serial",
    },
    "layerBlenders": [
        "Darken",
        "Lighten",
        "LabAverage",
        "RgbAverage",
        "RootSumSquare"
    ],
    "outputActions": [
        "Blink",
        "Constant",
        "Fade"
    ],
    "outputCount": 5,
    "transitionEnvelopes": [
        "CosineEnvelope",
        "LinearEnvelope"
    ]
}
```

### Output information

The current color information for each of the outputs can be requested. This will return an array of all outputs on the controller. For each of the outputs the following information will be provided:

* `layerCount`: The number of layers in this output, slightly easier than getting the length of `layers`
* `layers`: Detailed information for each of the layers in this output, looks like this:
 * `colorHex`: Current color of the layer as hex string
 * `colorRgb`: As above, but as array of red, green and blue intensity (0-255)
 * `opacity`: Opacity of the layer, the fraction with which it blends over the layer under it
 * `blender`: Blend function that is used
 * `envelope`: Transition envelope function; Determines how the color/opacity transition eases in
* `mixedColorHex`: Resulting color after blending all layers, as hex string
* `mixedColorRgb`: As above, but as array of red, green and blue intensity (0-255)
* `outputNumber`: The output index (0-based)

Output information can be retrieved from `/api/outputs` and would look like this for a single output with three layers:

```json
[
  {
    "layerCount": 3,
    "layers": [
      {
        "colorHex": "#6acfe3",
        "colorRgb": [106, 207, 227],
        "opacity": 1,
        "blender": "LabAverage",
        "envelope": "CosineEnvelope"
      },
      {
        "colorHex": "#000000",
        "colorRgb": [0, 0, 0],
        "opacity": 0,
        "blender": "LabAverage",
        "envelope": "CosineEnvelope"
      },
      {
        "colorHex": "#000000",
        "colorRgb": [0, 0, 0],
        "opacity": 0,
        "blender": "LabAverage",
        "envelope": "CosineEnvelope"
      }
    ],
    "mixedColorHex": "#6acfe3",
    "mixedColorRgb": [106, 207, 227],
    "outputNumber": 0
  }
]
```

### Sending commands

Send commands to `/api` using HTTP POST. The `json` parameter should contain a single JSON object, or an array of objects. Each object targets an output and layer and defines a new color and/or opacity. Envelope and blend method may optionally be provided. Any optional argument that is not provided defaults to the currently existing (that is, not defining a color, only an opacity leaves the color unchanged). The `steps` key on the transition object indicates how fast or smooth the transition should happen.

Example to set the second output to teal:

```json
{
    "output": 1,
    "color": [0, 200, 200],
    "opacity": 1,
    "steps": 40
}
```

---
layout: post
title:  "Digital filters with Web Audio (Part 1)"
date:   2014-04-05 0:00:00
categories: dsp webaudio
active: blog
---

Audio on the web has come a long way since the [`<bgsound>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bgsound) tag. If we simply want to play an audio clip we can use the `<audio>` tag, which gets the job done. If we want more low level control over the audio signal to play, we no longer have to resort to proprietary plugins like Flash or Silverlight — we can now use the Web Audio API. To give Web Audio a try I decided to write a little demo web app that allows you to play around with some different digital filters. You can check it out [here](https://github.com/dmeffert/digital-filter-explorer) if you like. In this series of posts we will take a closer look at the concepts used in this demo.

## Getting started with Web Audio ##

For our example we want two things from the Web Audio API:

* The ability to play audio clips
* The ability to use JavaScript code to process these audio clips in real-time

To get started with Web Audio we need to get an audio context. We obtain one with the [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) constructor (currently still named `webkitAudioContext` in WebKit based browsers). This context has functions to create audio nodes, which can be used to construct a complex audio graph. Nodes can be source nodes (for example an oscillator or an audio buffer), processing nodes (for example a filter, a compressor, or a JavaScript processor), analysis nodes (for example a spectrum analyzer) or destination nodes (the audio output). We will only create an [`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) and a [`ScriptProcessor`](https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode) node, since we want to do our own processing.

More concretely, to play a processed audio clip we will need to do the following:

1. Initialize an audio context
2. Create a buffer source node and a script processor node
3. Load an audio clip, and assign it to the buffer source node
4. Connect the buffer source node to the processor node, and connect the processor node to the audio output
5. Play the audio clip

Or, in code:
{% highlight javascript %}
// Step 1: Initialize an audio context.
var context = new webkitAudioContext();

// Step 2: Create the nodes.
var bufferSource = context.createBufferSource();
var processor = context.createScriptProcessorNode(2048, 1, 1);
var process = function(input) {
    return input;  // No processing right now.
};

processor.onaudioprocess = function(e) {
    var input = e.inputBuffer.getChannelData(0);
    var output = e.outputBuffer.getChannelData(0);
    for (var sample = 0; sample < output.length; sample++) {
        output[sample] = process(input[sample]);
    }
};

// Step 3: Load an audio clip and assign it to the buffer source node.
var request = new XMLHttpRequest();
request.open('GET', urlToAudioClip, true);
request.responseType = 'arraybuffer';
request.onload = function() {
    self.context.decodeAudioData(request.response,
        function(buffer) {
          bufferSource.buffer = buffer;
        }
    );
};
request.send();

// Step 4: Connect the nodes.
bufferSource.connect(processor)
processor.connect(context.destination);

// Step 5: Play the audio cilp
bufferSource.start();
{% endhighlight %}

The `onaudioprocess` function we used does not do any processing right now. It just copies the input buffer to the output buffer. Next up is doing the processing.

## Digital filters ##

The Web Audio API features a [`BiquadFilterNode`](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode) which you can use to apply standard low-pass and high-pass filtering (among other things) to your signal. In this example we will not use this ready made processing node, but create our own filtering code instead. But what is it we exactly mean when we say <em>filter</em>?

Let's see what Wikipedia has to say about a [digital filter](http://en.wikipedia.org/wiki/Digital_filter):

> In signal processing, a digital filter is a system that performs mathematical operations on a sampled, discrete-time signal to reduce or enhance certain aspects of that signal.

Okay, so let's think of a filter $\mathcal{F}$ as a function that maps an input sequence $x[0], x[1], x[2], \ldots$ to an output sequence $y[0], y[1], y[2], \ldots$ $$\mathcal{F}(x[n]) = y[n].$$

For our purposes we are not going to allow just <em>any</em> mathematical operation on our signal. We will restrict ourself to filters that are <em>linear</em>, and <em>time-invariant</em>. Linearity requires that 

$$\mathcal{F}(\alpha_1x_1[n] + \alpha_2x_2[n]) = \alpha_1\mathcal{F}(x_1[n]) + \alpha_2\mathcal{F}(x_2[n]).$$ 

Time-invariance requires that 

$$\mathcal{F}(x[n]) = y[n] \iff \mathcal{F}(x[n+n_0]) = y[n+n_0].$$

These are reasonable requirements. Suppose we have a drum track and a bass track. We can filter these two tracks seperately and then mix them. We could also first mix them and then filter the resulting track. Linearity ensures these two operations yield the same result. Thanks to time-invariance we know the filter sounds the same everytime we run it on the same input.

We will add one additional requirement. Since we would like our filter to process a signal in real-time we also require that the output of $\mathcal{F}$ only depends on a finite number of past inputs and outputs ($\mathcal{F}$ is <em>causal</em> and <em>realizable</em>). With these requirements in place we can express $\mathcal{F}$ as follows: 

$$\mathcal{F}(x[n]) = \sum_{k=0}^{M-1}\beta_kx[n-k] - \sum_{k=1}^{N-1}\alpha_k\mathcal{F}(x[n-k]).$$ 

The combination of linearity, time-invariance and causality ensures that $\mathcal{F}$ can be computed by taking a finite linear combination of past inputs and outputs. Translating this to code seems rather straightforward. We store the coefficients $\alpha_k$ and $\beta_k$ in arrays `alpha` and `beta`, memorize the last $M$ inputs in an array `x`, the last $N-1$ outputs in an array `y` and simply compute the linear combination for every input sample frame. Our `process` function would then look as follows:

{% highlight javascript %}
var process = function(input) {
    x.unshift(input);
    x.pop();
    var output = 0.0;
    for (var a = 0; a < alpha.length; a++) {
        output += alpha[a]*y[a];
    }
    for (var b = 0; b < beta.length; b++) {
        output += beta[b]*x[b];
    }
    y.unshift(output);
    y.pop();
    return output;
};
{% endhighlight %}

And that's all it takes to implement a linear time-invariant filter with Web Audio. Of course, now want to know some sane methods for choosing the coefficients $\alpha_k$ and $\beta_k$. This will be covered in the next part, so stay tuned. For now we will listen to what it sounds like when out filter takes the average of the last 20 inputs. In code this means `alpha = []` and `beta = [0.05, 0.05, ... /* 20 of these */, 0.05]`. Use the buttons below to hear the result. This only works in a Web Audio enabled browser. You can hear the processed version sounds muffled and has some weird phase effect going on. In the following post we will take a closer look at this filter and analyze what's going on.

<div markdown="0">
<button id="audio-without-filter">Play unprocessed audio clip</button>
<button id="audio-with-filter">Play audio clip processed with averaging filter</button>
<button id="stop-audio">Stop playback</button>
<script type="text/javascript">
    var context = new webkitAudioContext();
    context.createScriptProcessor = context.createScriptProcessor || context.createJavaScriptNode;
    var processor = context.createScriptProcessor(2048, 1, 1);
    var bufferSource;
    var buffer;
    var beta = [];
    var x = [];
    var n = 20;
    for (var i = 0; i < n; i++) {
        beta.push(1 / n);
        x.push(0);
    }
    var process = function (input) {
        x.unshift(input);
        x.pop();
        var output = 0;
        for (var i = 0; i < beta.length; i++) {
            output += x[i] * beta[i];
        }
        return output;
    };
    processor.onaudioprocess = function (e) {
        var input = e.inputBuffer.getChannelData(0);
        var output = e.outputBuffer.getChannelData(0);
        for (var sample = 0; sample < output.length; sample++) {
            output[sample] = process(input[sample]);
        }
    };
    var request = new XMLHttpRequest();
    request.open('GET', '/media/digital-filters/funkymule.mp3', true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
        self.context.decodeAudioData(request.response,
            function (result) {
                buffer = result;
            }
        );
    };
    request.send();
    processor.connect(context.destination);
    var isPlaying = false;
    $('#audio-without-filter').click(function (e) {
        if (isPlaying) bufferSource.stop();
        bufferSource = context.createBufferSource();
        bufferSource.start = bufferSource.start || bufferSource.noteOn;
        bufferSource.stop = bufferSource.stop || bufferSource.noteOff;
        bufferSource.buffer = buffer;
        bufferSource.connect(context.destination);
        bufferSource.start(0);
        isPlaying = true;
    });
    $('#audio-with-filter').click(function (e) {
        if (isPlaying) bufferSource.stop();
        bufferSource = context.createBufferSource();
        bufferSource.start = bufferSource.start || bufferSource.noteOn;
        bufferSource.stop = bufferSource.stop || bufferSource.noteOff;
        bufferSource.buffer = buffer;
        bufferSource.connect(processor);
        bufferSource.start(0);
        isPlaying = true;
    });
    $('#stop-audio').click(function (e) {
        e.preventDefault();
        if (isPlaying) {
            bufferSource.stop();
            isPlaying = false;
        }
    });
</script>
</div>



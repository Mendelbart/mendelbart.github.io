const MORSE_CHARS = {"A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.", "G": "--.", "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..", "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "S": "...", "R": ".-.", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-", "Y": "-.--", "Z": "--..", "Å": ".--.-", "Ä": ".-.-", "É": "..-..", "Ö": "---.", "Ü": "..--", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-", "\"": ".-..-.", "$": "...-..-", "@": ".--.-.", "¿": "..-.-", "¡": "--...-"};
const MORSE_CHARS_DATA = objectMap(MORSE_CHARS, morseCharData);
const MORSE_BUTTON_HTML = `<button class="morse-button" data-playing="false" role="switch" aria-checked="false">
    <span class="play-button">Play</span>
    <span class="stop-button">Stop</span>
</button>`;

function morseCharData(morse) {
    const starts = [];
    const stops = [];

    let beats = 0;
    for (let i = 0; i < morse.length; i++) {
        starts.push(beats);
        if (morse.charCodeAt(i) == 45) { // "-": 45, ".": 46
            beats += 3;
        } else {
            beats += 1;
        }
        stops.push(beats);
        beats += 1;
    }
    return [starts, stops];
}

function playMorse(text, {wpm = 20, fwpm = 20, frequency = 550, gain = 0.7} = {}) {
    const ctx = new AudioContext();
    const osc = new OscillatorNode(ctx, {frequency: frequency});
    const gainNode = new GainNode(ctx, {gain: gain});
    const onOffNode = new GainNode(ctx, {gain: 0});

    osc.connect(gainNode);
    gainNode.connect(onOffNode);
    onOffNode.connect(ctx.destination);

    osc.start();

    const beat = 1.2 / wpm;
    const fbeat = 1.2 / fwpm;

    let time = ctx.currentTime;
    for (const char of Object.values(text.toUpperCase())) {
        if (char === " ") {
            time += beat + 6 * fbeat;
            continue;
        }

        [starts, stops] = MORSE_CHARS_DATA[char];
        for (let i = 0; i < starts.length; i++) {
            onOffNode.gain.setTargetAtTime(1, time + starts[i] * beat, 0.002);
            onOffNode.gain.setTargetAtTime(0, time + stops[i] * beat, 0.002);
        }
        time += stops[stops.length - 1] * beat + beat + 2 * fbeat;
    }
    const ms = (time - ctx.currentTime) * 1000 + 200;

    return [ctx, ms];
}

function objectMap(obj, fn) {
    return Object.fromEntries(
        Object.entries(obj).map(
            ([k, v], i) => [k, fn(v, k, i)]
        )
    );
}

function setup_morse_button(container, text) {
    container.innerHTML = MORSE_BUTTON_HTML;
    const button = container.firstElementChild;
    button.dataset.text = text;

    button.playMorse = morsePlayFunc(button);
    button.stopMorse = morseStopFunc(button);
    button.toggleMorse = function() {
        if (this.dataset.playing == "false") {
            this.playMorse();
        } else {
            this.stopMorse();
        }
    }

    button.addEventListener("click", button.toggleMorse);   
}

function morsePlayFunc(btn) {
    return function() {
        if (btn.dataset.playing == "true") {
            return;
        }

        const [audioCtx, ms] = playMorse(btn.dataset.text, getMorseOptions());
        btn.audioCtx = audioCtx;

        btn.dataset.playing = "true";
        btn.ariaChecked = "true";

        btn.timeout = setTimeout(() => {
            audioCtx.close();
            btn.dataset.playing = "false";
            btn.ariaChecked = "false";
        }, ms);
    }
}

function morseStopFunc(btn) {
    return function() {
        if (btn.dataset.playing == "false") {
            return;
        }

        clearTimeout(btn.timeout);
        btn.audioCtx.close();
        
        btn.dataset.playing = "false";
        btn.ariaChecked = "false";

        delete this.audioCtx;
        delete this.timeout;
    }
}

function getMorseOptions() { // TODO
    return {};
}

setup_morse_button(document.getElementById("buttoncontainer"), "I love you");
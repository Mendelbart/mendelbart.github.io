import {DATASETS_METADATA, DEFAULT_DATASET, Dataset} from "./dataset/Dataset.js";
import {DOMHelper, ObjectHelper} from "./helpers/helpers.js";
import {GameContext} from "./context.js";

// --------------- CONSTANTS -----------------
const datasetSelect = document.getElementById("datasetSelect");


// --------------- GAME SETUP -----------------
(function () {
    readDarkLightMode();

    try {
        const ctx = new GameContext();

        DOMHelper.setOptions(
            datasetSelect,
            ObjectHelper.map(DATASETS_METADATA, data => data.name),
            {selected: new URLSearchParams(location.search).get("dataset") ?? DEFAULT_DATASET}
        );

        window.addEventListener("resize", () => {
            if (ctx.itemSelector) {
                ctx.itemSelector.scaleButtons();
            }
        });

        datasetSelect.addEventListener("change", (e) => {
            const key = e.target.value;
            Dataset.fromKey(key).then(dataset => {
                ctx.selectDataset(key, dataset);
            }).catch(console.error);
        });

        document.getElementById("start-game-button").addEventListener("click", () => {
            ctx.startGame();
        });

        document.getElementById("stop-game-button").addEventListener("click", () => {
            ctx.game.finish();
        });

        document.getElementById("item-submit-button").addEventListener("click", () => {
            ctx.game.submitRound();
        });

        document.getElementById("item-next-button").addEventListener("click", () => {
            ctx.game.newRound();
        });

        document.querySelectorAll(".ribbon").forEach((element) => {
            setupRibbon(element, element.classList.contains("ribbon-closable"));
        });

        document.querySelectorAll(".pages-container").forEach((element) => {
            DOMHelper.setupPages(element);
        });


        const key = datasetSelect.value;
        Dataset.fromKey(key).then(dataset => {
            ctx.selectDataset(key, dataset);

            const searchParams = new URLSearchParams(location.search);
            if (["1", "true"].includes(searchParams.get("play"))) {
                ctx.startGame();
            } else {
                ctx.setPlaying(false);
            }
        }).catch(DOMHelper.printError);
    } catch (e) {
        DOMHelper.printError(e);
    }
})();


function readDarkLightMode() {
    const params = new URLSearchParams(location.search);

    if (["1", "true"].includes(params.get("darkmode"))) {
        document.documentElement.classList.add("dark-mode");
    } else if (["1", "true"].includes(params.get("lightmode"))) {
        document.documentElement.classList.add("light-mode");
    }
}


/**
 * @param {HTMLElement} container
 * @param {boolean} [closable]
 */
function setupRibbon(container, closable = false) {
    const contents = container.querySelector(".ribbon-contents");
    const inputs = container.querySelectorAll(".ribbon-buttons input[type=checkbox]");
    container.dataset.closable = closable.toString();

    let openId = container.dataset.openId;
    if (!openId) {
        for (const input of inputs) {
            if (input.checked) {
                openId = input.dataset.contentId;
                break;
            }
        }
    }

    DOMHelper.addClass(contents.querySelectorAll(".ribbon-content"), "hidden");
    if (!openId && !(closable && contents.classList.contains("hidden"))) {
        openId = inputs[0].dataset.contentId;
        inputs[0].checked = true;
    }

    if (openId) {
        document.getElementById(openId).classList.remove("hidden");
        contents.classList.remove("hidden");
        container.dataset.openId = openId;
    }

    container.querySelector('.ribbon-buttons').addEventListener("change", ribbonButtonsChangeListener);
}

/**
 * @param {Event} event
 */
function ribbonButtonsChangeListener(event) {
    const input = event.target;
    const container = input.closest(".ribbon");
    const contents = container.querySelector('.ribbon-contents');

    if (input.checked) {
        const previousOpenId = container.dataset.openId;
        if (!contents.classList.contains("hidden") && previousOpenId) {
            DOMHelper.addClass(document.getElementById(previousOpenId), "hidden");
            container.querySelector(`.ribbon-buttons input[data-content-id="${previousOpenId}"]`).checked = false;
        }

        document.getElementById(input.dataset.contentId).classList.remove("hidden");
        container.dataset.openId = input.dataset.contentId;

        contents.classList.remove("hidden");
    } else if (container.dataset.closable === "true") {
        contents.classList.add("hidden");
        container.dataset.openId = "";
    } else {
        input.checked = true;
    }
}

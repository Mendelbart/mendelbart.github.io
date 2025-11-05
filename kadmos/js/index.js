import {DATASETS_METADATA, DEFAULT_DATASET} from "./dataset/Dataset.js";
import {DOMHelper, ObjectHelper} from "./helpers/helpers.js";
import {GameContext} from "./context.js";

// --------------- CONSTANTS -----------------
const datasetSelect = document.getElementById("datasetSelect");


// --------------- GAME SETUP -----------------
(function () {
    try {
        const ctx = new GameContext();

        DOMHelper.setOptions(
            datasetSelect,
            ObjectHelper.map(DATASETS_METADATA, data => data.name),
            window.localStorage.getItem("dataset") ?? DEFAULT_DATASET
        );

        window.addEventListener("resize", () => {
            document.querySelectorAll(".track-width").forEach(element => {
                element.style.setProperty("--scroll-width", element.scrollWidth);
                element.style.setProperty("--client-width", element.clientWidth);
                element.style.setProperty("--offset-width", element.offsetWidth);
            });

            window.addEventListener("resize", () => {
                if (ctx.itemSelector) {
                    ctx.itemSelector.scaleButtons();
                }
            })
        });

        datasetSelect.addEventListener("change", (e) => {
            ctx.selectDataset(e.target.value);
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

        ctx.selectDataset(datasetSelect.value).then(() => {
            ctx.setPlaying(false);

            const searchParams = new URLSearchParams(window.location.search);
            if (["1", "true"].includes(searchParams.get("autoplay"))) {
                ctx.startGame();
            }
            throw new Error("No Error yay");
        }).catch(DOMHelper.printError);

        document.querySelectorAll(".ribbon").forEach((element) => {
            setupRibbon(element, element.classList.contains("ribbon-closable"));
        });
    } catch (e) {
        DOMHelper.printError(e);
    }
})();



/**
 * @param {HTMLElement} container
 * @param {boolean} [closable]
 */
function setupRibbon(container, closable = false) {
    const contents = container.querySelector(".ribbon-contents");
    const inputs = container.querySelectorAll(".ribbon-buttons input[type=checkbox]")

    let checked;
    for (const input of inputs) {
        if (input.checked) {
            checked = input.dataset.contentId;
            break;
        }
    }

    DOMHelper.addClass(contents.querySelectorAll(".ribbon-content"), "hidden");
    if (!checked && !(closable && contents.classList.contains("hidden"))) {
        checked = inputs[0].dataset.contentId;
        inputs[0].checked = true;
    }

    if (checked) {
        document.getElementById(checked).classList.remove("hidden");
    }

    inputs.forEach(input => {
        input.addEventListener("change", () => {
            if (!input.checked && !closable) {
                input.checked = checked;
                return;
            }

            const previousShown = contents.querySelector(".ribbon-content:not(.hidden)");
            if (input.checked) {
                if (!contents.classList.contains("hidden") && previousShown) {
                    DOMHelper.addClass(previousShown, "hidden");
                    container.querySelector(`.ribbon-buttons input[type=checkbox][data-content-id="${previousShown.id}"]`).checked = false;
                }

                document.getElementById(input.dataset.contentId).classList.remove("hidden");
                contents.classList.remove("hidden");
            } else {
                contents.classList.add("hidden");
            }
        });
    });
}

import {DATASETS_METADATA, DEFAULT_DATASET} from "./dataset/Dataset.js";
import {DOMHelper, ObjectHelper} from "./helpers/helpers.js";
import {GameContext} from "./context.js";

// --------------- CONSTANTS -----------------
const datasetSelect = document.getElementById("datasetSelect");


// --------------- GAME SETUP -----------------
(function() {
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
    });
})();


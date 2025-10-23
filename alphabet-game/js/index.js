import {DATASETS_METADATA, DEFAULT_DATASET} from "./dataset/Dataset.js";
import {DOMHelper, ObjectHelper} from "./helpers/helpers.js";
import {GameContext} from "./context.js";

// --------------- CONSTANTS -----------------
const datasetSelect = document.getElementById("datasetSelect");


// --------------- GAME SETUP -----------------
(async function() {
    const ctx = new GameContext();

    DOMHelper.setOptions(
        datasetSelect,
        ObjectHelper.map(DATASETS_METADATA, data => data.name),
        window.localStorage.getItem("dataset") ?? DEFAULT_DATASET
    );

    datasetSelect.addEventListener("change", (e) => {
        ctx.selectDataset(e.target.value);
    });

    document.getElementById("playButton").addEventListener("click", () => {
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

    await ctx.selectDataset(datasetSelect.value);
    ctx.showScreen("dialogue");

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("play") === "1") {
        ctx.startGame();
    } else {
        ctx.setPlaying(false);
    }
})();


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

    document.getElementById("new-game-button").addEventListener("click", () => {
        ctx.startGame();
    });

    document.getElementById("pause-game-button").addEventListener("click", () => {
        ctx.game.pause();
        ctx.showScreen("dialogue");
    });
    document.getElementById("stop-game-button").addEventListener("click", () => {
        ctx.game.cleanup();
        DOMHelper.hide(document.getElementById("game-stats-container"));
        ctx.showScreen("dialogue");
    });
    document.getElementById("resume-game-button").addEventListener("click", () => {
        ctx.showScreen("game");
        ctx.game.focus();
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
    if (["1", "true"].includes(searchParams.get("autoplay"))) {
        ctx.startGame();
    }
})();


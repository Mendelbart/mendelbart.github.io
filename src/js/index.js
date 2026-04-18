import {DOMUtils} from "./utils";
import {setup} from "./context.js";

// --------------- GAME SETUP -----------------
(function () {
    setup();

    document.querySelectorAll(".ribbon").forEach((element) => {
        DOMUtils.setupRibbon(element, element.classList.contains("ribbon-closable"));
    });

    document.querySelectorAll(".pages-container").forEach((element) => {
        DOMUtils.setupPages(element);
    });
})();

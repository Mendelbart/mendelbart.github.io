import {DOMUtils} from "./utils";
import {setup} from "./context.js";

// --------------- GAME SETUP -----------------
(function () {
    readDarkLightMode();

    DOMUtils.transition(setup);

    document.querySelectorAll(".ribbon").forEach((element) => {
        setupRibbon(element, element.classList.contains("ribbon-closable"));
    });

    document.querySelectorAll(".pages-container").forEach((element) => {
        DOMUtils.setupPages(element);
    });
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

    DOMUtils.hide(contents.querySelectorAll(".ribbon-content"));
    if (!openId && !closable) {
        openId = inputs[0].dataset.contentId;
        inputs[0].checked = true;
    }

    if (openId) {
        DOMUtils.show([document.getElementById(openId), contents]);
    } else if (closable) {
        container.classList.add("contents-hidden");
    }

    container.querySelector('.ribbon-buttons').addEventListener("change", ribbonButtonsChangeListener);
}

/**
 * @param {Event} event
 */
function ribbonButtonsChangeListener(event) {
    DOMUtils.transition(() => {
        const input = event.target;
        const container = input.closest(".ribbon");
        const contents = container.querySelector('.ribbon-contents');

        if (input.checked) {
            const previousOpenId = container.dataset.openId;
            if (!container.classList.contains("contents-hidden") && previousOpenId) {
                DOMUtils.hide(document.getElementById(previousOpenId));
                container.querySelector(`.ribbon-buttons input[data-content-id="${previousOpenId}"]`).checked = false;
            }

            container.dataset.openId = input.dataset.contentId;
            DOMUtils.show([document.getElementById(input.dataset.contentId), contents]);
            container.classList.remove("contents-hidden");
        } else if (container.dataset.closable === "true") {
            container.classList.add("contents-hidden")
            DOMUtils.hide(contents);
            container.dataset.openId = "";
        } else {
            input.checked = true;
        }
    });
}

const nav = document.querySelector(".site-nav");
const toggle = nav.querySelector(".menu-toggle");
const mainMenu = nav.querySelector(".main-menu");
const dropdowns = [...nav.querySelectorAll(".nav-dropdown")];
const services = document.querySelector("#services-menu");
const explore = document.querySelector(".explore-services");
const isMobile = window.matchMedia("(max-width: 63rem)");

function setMenu(open) {
  toggle.setAttribute("aria-expanded", String(open));
  if (!open) {
    dropdowns.forEach((dropdown) => { dropdown.open = false; });
  }
}

nav.dataset.menuReady = "";
toggle.hidden = false;

toggle.addEventListener("click", () => {
  setMenu(toggle.getAttribute("aria-expanded") !== "true");
});

dropdowns.forEach((dropdown) => {
  dropdown.addEventListener("toggle", () => {
    if (!dropdown.open) return;
    dropdowns.forEach((other) => {
      if (other !== dropdown) other.open = false;
    });
  });
});

if (explore) {
  explore.hidden = false;
  explore.addEventListener("click", () => {
    if (isMobile.matches) setMenu(true);
    services.open = true;
    services.querySelector("summary").focus();
  });
}

document.addEventListener("pointerdown", (event) => {
  if (nav.contains(event.target)) return;
  setMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const activeDropdown = dropdowns.find((dropdown) => dropdown.open);
  if (activeDropdown) {
    activeDropdown.open = false;
    if (activeDropdown.contains(document.activeElement)) {
      activeDropdown.querySelector("summary").focus();
    }
  } else if (isMobile.matches && toggle.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    toggle.focus();
  }
});

isMobile.addEventListener("change", () => {
  const focusWasInMenu = mainMenu.contains(document.activeElement);
  setMenu(false);
  if (isMobile.matches && focusWasInMenu) toggle.focus();
});

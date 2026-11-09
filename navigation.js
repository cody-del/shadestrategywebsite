const nav = document.querySelector(".site-nav");
const toggle = nav.querySelector(".menu-toggle");
const mainMenu = nav.querySelector(".main-menu");
const dropdowns = [...nav.querySelectorAll(".nav-dropdown")];
const services = document.querySelector("#services-menu");
const explore = document.querySelector(".explore-services");
const dialog = document.querySelector(".preview-dialog");
const dialogTitle = document.querySelector("#preview-title");
const isMobile = window.matchMedia("(max-width: 63rem)");

function setMenu(open) {
  toggle.setAttribute("aria-expanded", String(open));
  if (!open) {
    dropdowns.forEach((dropdown) => { dropdown.open = false; });
  }
}

nav.dataset.menuReady = "";
toggle.hidden = false;
explore.hidden = false;

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

explore.addEventListener("click", () => {
  if (isMobile.matches) setMenu(true);
  services.open = true;
  services.querySelector("summary").focus();
});

document.addEventListener("pointerdown", (event) => {
  if (dialog.open || nav.contains(event.target)) return;
  setMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dialog.open) return;
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

mainMenu.querySelectorAll("[data-planned-page]").forEach((button) => {
  button.addEventListener("click", () => {
    dialogTitle.textContent = button.dataset.plannedPage;
    dialog.showModal();
  });
});

isMobile.addEventListener("change", () => {
  const focusWasInMenu = mainMenu.contains(document.activeElement);
  setMenu(false);
  if (isMobile.matches && focusWasInMenu) toggle.focus();
});

const announcement = document.querySelector(".nav-announcement");
const announcementText = Array.from(
  announcement.querySelectorAll(".announcement-copy > span"),
  (item) => item.textContent.trim().replace(/\.$/, ""),
).join(". ");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateAnnouncementMotion() {
  announcement.disabled = reducedMotion.matches;
  if (reducedMotion.matches) {
    announcement.removeAttribute("aria-label");
    announcement.removeAttribute("aria-pressed");
    announcement.removeAttribute("title");
    return;
  }
  announcement.setAttribute("aria-label", `${announcementText}. Pause scrolling announcement`);
  announcement.setAttribute("aria-pressed", "false");
  announcement.title = "Pause scrolling announcement";
}

announcement.addEventListener("click", () => {
  const paused = announcement.getAttribute("aria-pressed") !== "true";
  announcement.setAttribute("aria-pressed", String(paused));
  announcement.title = paused ? "Resume scrolling announcement" : "Pause scrolling announcement";
});

reducedMotion.addEventListener("change", updateAnnouncementMotion);
updateAnnouncementMotion();

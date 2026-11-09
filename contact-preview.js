for (const contactForm of document.querySelectorAll(".contact-form")) {
  const contactStatus = contactForm.querySelector(".contact-status");

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactStatus.textContent = "This is a preview. Your inquiry has not been sent.";
  });

  contactForm.addEventListener("input", () => {
    contactStatus.textContent = "";
  });

  contactForm.querySelector('button[type="submit"]').disabled = false;
}

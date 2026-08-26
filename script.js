const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("show");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });

  document.querySelectorAll("#navLinks a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      navLinks.classList.remove("show");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
    }
  });
}

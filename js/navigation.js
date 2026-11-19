export function initNavigation({ sidebar, menuToggle, scrim, onNotice, onNavigate }) {
  const navItems = [...sidebar.querySelectorAll("[data-page]")];

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      if (page === "Dashboard" || page === "Products" || page === "Orders" || page === "Inventory" || page === "Customers" || page === "Analytics" || page === "Settings") {
        navItems.forEach((navItem) => {
          const active = navItem === item;
          navItem.classList.toggle("is-active", active);
          if (active) navItem.setAttribute("aria-current", "page");
          else navItem.removeAttribute("aria-current");
        });
        onNavigate(page);
        closeMenu();
        return;
      }

      onNotice(`${page} is planned for a later phase. Your dashboard is still available.`);
      closeMenu();
    });
  });

  function closeMenu() {
    sidebar.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    scrim.hidden = true;
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
    sidebar.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    scrim.hidden = !isOpen;
  });

  scrim.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

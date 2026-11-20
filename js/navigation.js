const pageHashes = {
  Dashboard: "#dashboard",
  Products: "#products",
  Orders: "#orders",
  Inventory: "#inventory",
  Customers: "#customers",
  Analytics: "#analytics",
  Settings: "#settings"
};
const hashPages = new Map(Object.entries(pageHashes).map(([page, hash]) => [hash, page]));

export function initNavigation({ sidebar, menuToggle, scrim, onNotice, onNavigate }) {
  const navItems = [...sidebar.querySelectorAll("[data-page]")];
  let activePage = "";

  function activatePage(page) {
    navItems.forEach((item) => {
      const active = item.dataset.page === page;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    if (activePage === page) return;
    activePage = page;
    onNavigate(page);
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      const hash = pageHashes[page];
      if (hash) {
        if (window.location.hash === hash) activatePage(page);
        else window.location.hash = hash;
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

  function handleHashChange() {
    const page = hashPages.get(window.location.hash);
    if (page) {
      activatePage(page);
      return;
    }

    const fallbackPage = activePage || "Dashboard";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${pageHashes[fallbackPage]}`
    );
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
    sidebar.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    scrim.hidden = !isOpen;
  });

  scrim.addEventListener("click", closeMenu);
  window.addEventListener("hashchange", handleHashChange);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    const mainContent = document.querySelector("#main-content");
    mainContent.focus();
    mainContent.scrollIntoView();
  });

  const initialPage = hashPages.get(window.location.hash) || "Dashboard";
  if (!hashPages.has(window.location.hash)) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${pageHashes[initialPage]}`
    );
  }
  activatePage(initialPage);
}

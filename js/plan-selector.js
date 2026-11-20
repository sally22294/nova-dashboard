export const DEMO_PLAN_STORAGE_KEY = "nova-dashboard.demo-plan.v1";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    description: "For small stores getting started.",
    features: [
      "Dashboard overview",
      "Product management",
      "Order management",
      "Basic inventory management",
      "Customer management"
    ]
  },
  {
    id: "growth",
    name: "Growth",
    price: 19,
    description: "For growing stores that need better business insights.",
    popular: true,
    features: [
      "Everything in Starter",
      "Advanced analytics and revenue insights",
      "Inventory movement history",
      "Customer order history",
      "Data export",
      "Business settings and preferences"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "For established stores seeking a complete management experience.",
    features: [
      "Everything in Growth",
      "Advanced product and order insights",
      "Detailed customer analytics",
      "Full inventory oversight",
      "Priority-style support (demo label)"
    ]
  }
];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatPrice(price) {
  return `$${price}/month`;
}

function readSelectedPlan() {
  try {
    const savedPlan = window.localStorage.getItem(DEMO_PLAN_STORAGE_KEY);
    return plans.some((plan) => plan.id === savedPlan) ? savedPlan : "starter";
  } catch {
    return "starter";
  }
}

function renderPopoverPlan(plan) {
  return `<span class="plan-popover-heading">
      <strong>${plan.name}</strong>
      <span class="plan-demo-badge">Demo Plan</span>
    </span>
    <strong class="plan-popover-price">${formatPrice(plan.price)}</strong>
    <p>${escapeHTML(plan.description)}</p>
    <button class="plan-view-all" id="viewAllPlans" type="button">View all plans</button>`;
}

function renderPlanCard(plan) {
  return `<article class="plan-card${plan.popular ? " plan-card--popular" : ""}" data-plan-card="${plan.id}">
    ${plan.popular ? '<span class="plan-popular-badge">Most Popular</span>' : ""}
    <header class="plan-card-header">
      <div><h3>${plan.name}</h3><p>${escapeHTML(plan.description)}</p></div>
      <strong class="plan-card-price">${plan.price === 0 ? "$0" : `$${plan.price}`}<small>/ month</small></strong>
    </header>
    <ul>${plan.features.map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")}</ul>
    <button class="plan-select-button" type="button" data-select-plan="${plan.id}"></button>
  </article>`;
}

export function initPlanSelector({ toggle, popover, dialog, onNotice }) {
  const cards = dialog.querySelector("#planCards");
  const closeButton = dialog.querySelector("#closePlanDialog");
  let selectedPlanId = readSelectedPlan();

  function getSelectedPlan() {
    return plans.find((plan) => plan.id === selectedPlanId);
  }

  function updatePlanUI() {
    const selectedPlan = getSelectedPlan();
    toggle.querySelector("#currentPlanLabel").textContent = `${selectedPlan.name} · ${formatPrice(selectedPlan.price)}`;
    popover.innerHTML = renderPopoverPlan(selectedPlan);
    cards.querySelectorAll("[data-plan-card]").forEach((card) => {
      const isSelected = card.dataset.planCard === selectedPlanId;
      const button = card.querySelector("[data-select-plan]");
      card.classList.toggle("is-selected", isSelected);
      card.setAttribute("aria-current", isSelected ? "true" : "false");
      button.textContent = isSelected ? "Current demo plan" : `Select ${plans.find((plan) => plan.id === card.dataset.planCard).name}`;
      button.disabled = isSelected;
    });
    toggle.setAttribute("aria-label", `Current demo plan: ${selectedPlan.name}, ${formatPrice(selectedPlan.price)}`);
  }

  function closePopover(returnFocus = false) {
    popover.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }

  function closeDialog(returnFocus = true) {
    if (dialog.open) dialog.close();
    if (returnFocus) toggle.focus();
  }

  cards.innerHTML = plans.map(renderPlanCard).join("");
  updatePlanUI();

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    popover.hidden = isOpen;
  });

  popover.addEventListener("click", (event) => {
    if (event.target.closest("#viewAllPlans")) {
      closePopover();
      dialog.showModal();
      closeButton.focus();
    }
  });

  cards.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-plan]");
    if (!button || button.disabled) return;

    selectedPlanId = button.dataset.selectPlan;
    try {
      window.localStorage.setItem(DEMO_PLAN_STORAGE_KEY, selectedPlanId);
    } catch {
      selectedPlanId = readSelectedPlan();
      updatePlanUI();
      onNotice("This browser could not save the demo plan selection.");
      return;
    }
    updatePlanUI();
    closeDialog();
    onNotice(`${getSelectedPlan().name} plan selected for demo.`);
  });

  closeButton.addEventListener("click", () => closeDialog());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => toggle.focus());

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".plan-selector-wrap")) closePopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dialog.open) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (toggle.getAttribute("aria-expanded") === "true") {
      closePopover(true);
    }
  });
}

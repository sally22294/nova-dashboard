# Nova Dashboard

Nova Dashboard is a premium, minimal e-commerce admin dashboard demo built with vanilla HTML, CSS, and JavaScript. It brings common store-management views together in a responsive interface, with data saved in the current browser.

> **Portfolio demo only:** Nova is not connected to a live store or commerce service.

## Features

- **Dashboard:** Overview with illustrative sales metrics and saved-record summaries.
- **Products:** Create, edit, search, filter, sort, and manage catalog items.
- **Orders:** Create and edit orders, update statuses, cancel orders, and integrate order changes with stock.
- **Inventory:** Adjust stock and review inventory movement history.
- **Customers:** Manage customer profiles, view details, and review linked order history.
- **Analytics:** Explore saved-order revenue, trends, product performance, and customer insights.
- **Settings:** Configure business details and preferences, manage notification preferences, export data, and reset business data.

## Screenshots

Screenshots will be added in a future update.

- Dashboard: _Screenshot placeholder_
- Products and orders: _Screenshot placeholder_
- Analytics and settings: _Screenshot placeholder_

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript using browser ES modules

There is no frontend framework, build step, backend, or database.

## Demo limitations and data privacy

- This is a portfolio/demo application, not a live connected store.
- Products, orders, customers, inventory movements, and settings are stored in the visitor's browser using `localStorage`.
- Data is browser-local: it is not shared with other users or synchronized to a server. Clearing the browser's site data removes saved changes; the demo data is seeded again when the app is opened.
- There is no authentication or backend database. Do not use the demo to store sensitive or production customer information.
- Currency preferences do not convert amounts. Operational monetary values continue to be formatted in USD.
- Notification content is static demo content; the app does not send live notifications.
- The optional product image field accepts image URLs. When used, the browser requests the image from its hosting site.
- Settings can export a JSON backup. Treat downloaded backups as potentially containing personal or business data.

## Running locally

The app uses JavaScript ES modules, which may not work reliably when `index.html` is opened directly with a `file://` URL. Serve the project over HTTP instead:

1. Open the project folder in VS Code and start it with the Live Server extension, or run a local HTTP server from the project root, for example:

   ```sh
   python -m http.server 8000
   ```

2. Open `http://localhost:8000` in a browser.

The server is only for local development; the application itself does not require a backend.

## Project structure

```text
Nova Dashboard/
├── index.html
├── css/
│   ├── style.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── navigation.js
│   ├── dashboard.js
│   ├── data.js
│   ├── products.js
│   ├── product-storage.js
│   ├── orders.js
│   ├── order-storage.js
│   ├── inventory.js
│   ├── inventory-storage.js
│   ├── customers.js
│   ├── customer-storage.js
│   ├── analytics.js
│   ├── settings.js
│   ├── settings-storage.js
│   └── formatting.js
└── assets/
    ├── icons/
    └── images/
```

`index.html` is the entry point. The CSS files separate shared styles, layout, components, and responsive rules. JavaScript modules divide application setup, page behavior, demo data, storage, and formatting.

## Future improvements

The following are ideas for future development, not implemented features:

- Add automated tests for storage, calculations, and core workflows.
- Explore an optional backend for shared data and authenticated accounts.
- Add real notification delivery if a suitable service is introduced.
- Support currency conversion with an explicit exchange-rate source and conversion rules.
- Add project screenshots and expand setup and contribution documentation.

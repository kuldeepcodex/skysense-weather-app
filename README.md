# Weather App

A modern, accessible, and performant weather application built with Vanilla JS, HTML, and a comprehensive CSS Custom Properties design system.

## Key Features

- **Robust Architecture**: Modular ES6 structure separating API logic, state management, UI rendering, and utilities.
- **Performance Optimized**: Implements 350ms input debouncing, in-memory TTL caching (10min for weather, 30min for forecast, 60min for autocomplete), and `AbortController` for stale requests.
- **Accessibility (a11y) First**: Fully WCAG 2.1 AA compliant. Features semantic HTML5 landmarks, ARIA combobox patterns for search, roving `tabindex` for forecast tabs, programmatic focus management, and visually hidden `.sr-only` utilities.
- **Security & Reliability**: Vercel serverless proxy integration with rate limiting (30 requests/min per IP) and strict CORS policies.
- **Design Token System**: Fully tokenized CSS architecture using `:root` custom properties for consistent styling, easy theming, and maintainability.

## Design Token Architecture

All styling in this project relies on a centralized CSS Custom Property system defined in `style.css`. We do not use hardcoded colors, spacing, or typography values.

### Categories

The tokens are grouped into the following categories:

- **Colors** (`--clr-*`): Includes semantic colors (`--clr-primary`, `--clr-bg-start`), hex values (`--clr-fff176`), and alpha-channel variants (`--clr-black-a60`).
- **Spacing** (`--space-*`): Used for `margin`, `padding`, `width`, `height`, etc. Includes absolute (`px`, `rem`) and relative (`%`, `vw`, `vh`) values.
- **Typography** (`--text-*`): Used for font sizes.
- **Radii** (`--radius-*`): Used for `border-radius`.
- **Blurs** (`--blur-*`): Used for `backdrop-filter`.

### Usage Example

Instead of hardcoding a value:
```css
.card {
  background-color: rgba(0, 0, 0, 0.35);
  padding: 20px;
  border-radius: 14px;
}
```

Use the corresponding design tokens:
```css
.card {
  background-color: var(--clr-black-a35-1);
  padding: var(--space-20px);
  border-radius: var(--space-14px);
}
```

## Setup & Deployment

1. **Install Dependencies**: `npm install`
2. **Local Development**: Run `npm start` or `node server.js`
3. **Deployment**: This app is configured for Vercel. Push to main to trigger the deployment. Ensure environment variables (`WEATHER_API_KEY`) are set in your Vercel project settings.

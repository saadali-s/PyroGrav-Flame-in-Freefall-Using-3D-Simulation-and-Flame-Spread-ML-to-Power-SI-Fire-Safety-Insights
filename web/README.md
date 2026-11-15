# PyroGrav web

Next.js application for the Dashboard, PMMA/FLEX experiment workbenches, Evidence explorer and Space Guide.

Run `npm ci` followed by `npm run dev`, then open http://localhost:3000. Copy `.env.example` into a local environment file to configure the optional research guide.

The root [README](../README.md) documents the architecture, model results, scientific limits, repository layout and verification commands. The [Worker setup](../workers/README.md) covers the separately hosted explanation service and local INDUS encoder.

`npm run build` writes `.next-production`, while development uses `.next`. `npm start` serves the production build.

# Put Aura Match online for free

No backend, database, API key, custom domain or paid account is required by the application. Provider limits and account policies still apply. The following hosting notes are retained from the original project delivery. Recheck the provider's current plan and dashboard before deployment. Version 1.1.0 does not change the hosting architecture.

## Recommended: GitHub Pages, directly from your repository

GitHub Pages is available with GitHub Free for **public** repositories. This suits an open-source project. Never commit player backups, exported schedules or other personal data to that public repository.

1. Extract the source archive. Put the **contents of the `aura-match` folder** at the root of your repository, including the hidden `.github` folder. `package.json` should be at the repository root.
2. Run `npm install`, `npm test` and `npm run build` locally. Commit the generated `package-lock.json` as well as the source.
3. Push to the repository's `main` branch.
4. On GitHub, open **Settings > Pages > Build and deployment > Source**, and choose **GitHub Actions**.
5. Open **Actions > Deploy to GitHub Pages > Run workflow**. The workflow also runs on later pushes to `main`. It installs dependencies, runs the unit tests, builds the app and deploys `dist/`.
6. Find the resulting site address in the workflow output or Pages settings. A project site is normally `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The included Vite configuration uses a relative asset base, so repository subpaths do not require a hardcoded repo name. Change `branches: [main]` in the workflow when using a different deployment branch. Organization policies may require enabling Actions or approving the deployment environment.

For a new, empty GitHub repository, this is one possible first push from inside the extracted source folder:

```bash
git init
git add .
git commit -m "Add Aura Match badminton planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Skip initialization and remote creation for a repository you already cloned. Do not overwrite an existing remote blindly.

Official documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

## Fastest no-build route: Cloudflare Pages Direct Upload

Use the separate **`aura-match-static-v1.1.0.zip`**, not the source ZIP.

1. Create or sign in to a Cloudflare account and open **Workers & Pages**.
2. Choose **Create application > Get started > Drag and drop your files** (the dashboard may offer a Pages tab first).
3. Name the project and upload `aura-match-static-v1.1.0.zip`, or the extracted folder whose root contains `index.html`.
4. Choose **Deploy site** and copy the resulting `pages.dev` URL.

Cloudflare supports ZIPs/folders for dashboard direct uploads. Its Free Pages plan currently allows 500 builds per month; the prebuilt distribution is far below its file-size and file-count limits. Do not enable optional paid services for this app.

**Direct Upload cannot later be converted to Git integration in the same project.** Choose Git integration now for automatic repo-based updates, or create a separate Git-integrated project later.

Official instructions: https://developers.cloudflare.com/pages/get-started/direct-upload/
Free limits: https://developers.cloudflare.com/pages/platform/limits/

## Cloudflare Pages with automatic Git deployments

Connect your GitHub/GitLab repository through Pages Git integration. Use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root |
| Node version | `22` via `NODE_VERSION` if needed |

The host installs dependencies before the build. Commit your generated lockfile for repeatable installs. No runtime environment variables are required. Push updates to the production branch to redeploy.

Official instructions: https://developers.cloudflare.com/pages/get-started/git-integration/

## Alternative: Netlify

Import the Git repository into Netlify. The included `netlify.toml` sets `npm run build`, `dist`, and Node 22. Choose the Free plan and review the plan screen before confirming. For manual deployment, upload the extracted prebuilt folder containing `index.html`.

Netlify's current Free plan is credit-limited (300 monthly credits when checked); deploys, traffic and other usage share that allowance. Do not treat it as unlimited free hosting. Review the usage dashboard if the site becomes popular. GitHub Pages is the simpler fit when you already use a public GitHub repository.

Official pricing: https://www.netlify.com/pricing/

## Share the right link

**Website link:** gives each friend their own planner, saved in their own browser.

**Share session link:** open the website, generate matches, and use **Share session**. This gives friends a fixed, read-only copy of that schedule. Send a new link after changes. It does not expose your editable local workspace or provide live collaboration.

**HTML/text export:** useful when a chat app truncates a long snapshot URL, when you need an offline copy, or alongside JPEGs for accessibility.

## Before sending the link to the club

Run `npm run check` and `npm run test:e2e`. Then test the actual deployed URL on a phone and computer. Add a player, change an early departure, generate, export, open a snapshot in a private window and confirm no editing controls appear. Test the main-thread/worker execution and security headers on that host. No public deployment was created as part of this delivery.

## Troubleshooting

**Blank site or module MIME error:** publish `dist/` (Vite build) or the root contents of the prebuilt static ZIP, not `src/` from the source project. Upload all folders together. Use HTTP/HTTPS rather than `file://`.

**Assets fail on GitHub Pages:** confirm `base: './'` remains in `vite.config.js`; don't move files out of `dist/` after building.

**Worker cannot load:** verify the worker JS asset exists, the host serves JavaScript with a JavaScript MIME type, and no custom CSP blocks same-origin workers.

**Dependencies fail to install:** use Node 22.12+ and a working npm registry connection. Run `npm install` once, then commit its lockfile. Do not use `npm ci` without a lockfile.

**Site works but saved players disappeared:** local data is specific to the browser and origin. A move to a new domain does not migrate local storage. Export a setup backup on the old address, then import it at the new one.

**Share link is long or broken:** copy the entire fragment after `#session=`. Use the HTML/ZIP export for large schedules or chat apps with URL limits.

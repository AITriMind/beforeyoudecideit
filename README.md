# Decision Stress Test publication package

This folder is the standalone public package for `beforeyoudecideit.com`.
It contains only the public landing page and its local assets:

- `index.html`
- `assets/kraft-offers.css`
- `assets/kraft-offers.js`

Open locally from this folder:

```sh
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/`
- `http://<mac-ip>:8000/` from a phone on the same network

## Current values

- Domain: `beforeyoudecideit.com`.
- Calendly: `https://calendly.com/trmnd-ai/decision-call`.
- Instagram: `https://www.instagram.com/alesianezh/`.
- YouTube: `https://www.youtube.com/@AITriMind`.
- LinkedIn: `https://www.linkedin.com/in/alesia-yuzhakov/`.
- Telegram: `https://t.me/AITriMind`.
- Analytics choice: GoatCounter. The page has a commented script slot in `index.html`.

Optional portrait:

- Put the portrait file at `assets/alesia-portrait.jpg`.
- In `index.html`, find the commented portrait line inside `about-intro` and uncomment it.

## Operator: Create GitHub Repository And Push

Create a GitHub repository named `beforeyoudecideit`. It can be public or private.
The repository content should be this folder's files, not the parent CRAFTHOUSE repo.

From the Mac, open Terminal and run these commands from this folder:

```sh
cd /Users/alesiayuzhakov/PROJECTS/crafthouse-codex/offers-public
```

You should see no output if the folder exists.

```sh
git init
```

You should see that Git initialized an empty repository.

```sh
git branch -M main
```

You should see no output.

```sh
git add index.html assets README.md
```

You should see no output.

```sh
git commit -m "Publish Decision Stress Test landing page"
```

You should see one new commit with the three tracked paths.

```sh
git remote add origin git@github.com:YOUR-GITHUB-USERNAME/beforeyoudecideit.git
```

Replace `YOUR-GITHUB-USERNAME` with the account that owns the repository.
You should see no output.

```sh
git push -u origin main
```

You should see the files upload to GitHub and `main` become the tracked branch.
Do this push only when you are ready to publish the package.

## Alex: Import Into Vercel

In Vercel, import the GitHub repository `beforeyoudecideit`.

Use these project settings:

- Framework preset: Other.
- Root directory: repository root.
- Build command: leave empty.
- Output directory: leave empty or use the default.

After the first deployment, open the Vercel project:

1. Open Settings.
2. Open Domains.
3. Add `beforeyoudecideit.com`.
4. Add `www.beforeyoudecideit.com` if the `www` version should also work.
5. Copy the DNS records Vercel shows on screen.
6. In Namecheap, open Domain List.
7. Select Manage for `beforeyoudecideit.com`.
8. Open Advanced DNS.
9. Remove conflicting parking or redirect records if Namecheap shows them.
10. Add the A record Vercel shows for the root domain.
11. Add the CNAME record Vercel shows for `www`.
12. Save all changes.
13. Return to Vercel Domains and wait until the domain check passes.

Every later push to `main` deploys automatically through Vercel.

## GoatCounter

Create a GoatCounter site for `beforeyoudecideit.com`.

1. Open GoatCounter and create a new site.
2. Copy the site's JavaScript snippet.
3. In `index.html`, find `GoatCounter slot`.
4. Replace `MYCODE` with the GoatCounter site code or paste the snippet GoatCounter gives you.
5. Uncomment the script line.

The page sends two events only after the tag is active:

- `/check-result` when the Decision Check result is shown.
- `/book-call-click` when the booking button is clicked.

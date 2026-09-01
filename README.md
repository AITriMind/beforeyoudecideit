# Offers

Current offer pages:

- `dst.html` - English Decision Stress Test landing page.
- `agent-trust-assessment.html` - English B2B Agent Trust Assessment landing page.

Approved DST details:

- Full price: `$250`.
- Application mechanism: client-side Decision Check plus optional Telegram DM path.
- Calendly URL: `https://calendly.com/trmnd-ai/decision-call`.
- Domain: `beforeyoudecideit.com`.
- Social links: Instagram `https://www.instagram.com/alesianezh/`, YouTube
  `https://www.youtube.com/@AITriMind`, LinkedIn
  `https://www.linkedin.com/in/alesia-yuzhakov/`, Telegram `https://t.me/AITriMind`.

Portrait slot:

- Put the portrait at `offers/assets/alesia-portrait.jpg`.
- Uncomment the image line in `offers/dst.html` inside the `about-intro` block.
- For the public package, put the same file at `offers-public/assets/alesia-portrait.jpg` and
  uncomment the same line in `offers-public/index.html`.

Analytics:

- GoatCounter is selected for the Friday counter.
- The active and public DST pages include a commented GoatCounter script slot.
- When the operator adds the tag, the page counts `/check-result` and `/book-call-click`.

Languages:

- `dst.html` supports EN and RU through the in-page switcher.
- `?lang=ru` and `?lang=en` override browser language and saved preference.

Parked pages:

- `parked/door-2-mentorship-dst/` - prior mentorship and Decision Stress Test pages. They remain
  parked because the offer composition changed.
- `parked/mastermind-v2.html` - Russian mastermind page parked because the current strategy does not
  include a mastermind offer.

Preview from this directory:

```sh
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173/dst.html`
- `http://localhost:4173/agent-trust-assessment.html`

Phone preview on the local network:

- Start the server from `offers/`.
- Open `http://<mac-ip>:8000/dst.html` if the server is started on port `8000`.
- Open `http://<mac-ip>:4173/dst.html` if the server is started on port `4173`.

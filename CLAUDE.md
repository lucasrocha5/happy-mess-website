# Happy Mess website: guide for AI agents

This is the website for Happy Mess, a pottery painting party business. It is
plain HTML, CSS and JavaScript with no build step, hosted on Cloudflare
(free plan). Everything visitors download is in `public/`.

The person asking for changes is not technical. They ask in plain language in
the Claude app (the Code tab) or at claude.ai/code. Make the change safely and
reply in plain language: what changed, where on the page, and the preview link.
In replies to them, say "preview" and "publish". Don't use words like branch,
commit, merge, pull request or deploy.

## How to handle requests

- Make the smallest change that does what was asked. Do not redesign, rename or
  tidy anything that was not mentioned.
- If a request is unclear (for example "change the price" when several prices
  exist), ask one short question before editing.
- Never invent facts about the business: prices, dates, addresses, policies,
  testimonials. If a request needs a fact you were not given, ask for it.

## Preview, then publish

Every change follows these steps. Merging into `main` publishes the live site,
so never push to `main` or merge without the person's clear approval.

1. Make the change on a new branch. Name it with lowercase letters, numbers
   and hyphens only, under 30 characters (for example `update-party-faq`):
   the branch name becomes part of the preview link. Check the changed area at
   390px and 1440px wide (`npm run dev`, or open `public/index.html` in a
   browser, when one is available).
2. Push the branch and open a pull request into `main` with a short
   plain-language title. In a cloud session `gh pr create` fails (GitHub's
   GraphQL API is blocked there), so use the REST API:
   `gh api repos/{owner}/{repo}/pulls -f title="..." -f head=BRANCH -f base=main -f body="..."`
3. Cloudflare builds a preview of every pushed branch in under a minute. Wait
   until the "Workers Builds" check on the latest commit shows `completed` and
   `success`:
   `gh api repos/{owner}/{repo}/commits/BRANCH/check-runs --jq '.check_runs[] | .name + " " + .status + " " + (.conclusion // "")'`
   The preview link is `https://BRANCH-happy-mess-website.uttr.workers.dev`
   (BRANCH is the branch name). If Cloudflare also posts a comment on the pull
   request with a Preview URL, use that one.
4. Reply with that preview link and one or two sentences on what changed, then
   ask: "Want me to publish it?"
5. If they ask for more changes, update the same pull request. The preview link
   stays the same.
6. Publish only when they clearly say so ("publish it", "looks good, go live").
   Squash-merge the pull request into `main`; Cloudflare then puts it live by
   itself. In a cloud session, `gh pr merge` fails because GitHub's GraphQL API
   is blocked there, so use the REST API:
   `gh api -X PUT repos/{owner}/{repo}/pulls/{number}/merge -f merge_method=squash`
7. Tell them it's published and that it can take a few minutes to show up.

## Where things live

| The request is about | Edit this |
| --- | --- |
| Which page is which | `/` is `public/index.html`, `/book-a-party` (For the Little Ones) is `public/book-a-party.html`, `/corporate-and-social-gatherings` (For the Grown-Ups) is `public/corporate-and-social-gatherings.html`, `/shop` is `public/shop.html`, `/contact-us` is `public/contact-us.html`, `/our-story` is `public/our-story.html` |
| Any wording, FAQ questions and answers | that page's `.html` file (search for the current text) |
| Page title and Google description | `<title>`, `<meta name="description">` and the matching `og:` tags in that page's file |
| Where a button or link leads | its `href` in the page files. The menu and footer repeat on every page, so change them in all six files |
| Photos and illustrations | files in `public/images/` (each new page's files start with its name: `party-`, `shop-`, `contact-`, `story-`) |
| Colors, fonts, spacing | shared styles and color tokens: `public/css/styles.css`. Styles for one page only: `public/css/pages/` (`parties.css` serves both party pages, plus `shop.css`, `contact.css`, `our-story.css`) |
| Etsy links on the shop page | every link marked `data-etsy` in `public/shop.html` |
| Menu, FAQ open/close, form behavior, animations | `public/js/main.js` |
| What a form sends to Slack or saves to the spreadsheet | `src/submit.js` (Google sign-in and saving: `src/sheets.js`) |
| Hosting settings | `wrangler.jsonc` (do not change unless asked) |

### Common requests

- **Edit an FAQ:** each one is a `<details class="faq__item">` block in
  `public/index.html`. Copy a block to add one, delete a block to remove one. Only
  the first block has the `open` attribute (starts expanded). Keep it that way
  unless asked. On desktop the left column (heading, text and lightbulb,
  all inside `.faq__intro`) stays in view while the questions scroll past.
  Keep the lightbulb inside `.faq__intro` so it moves with the heading.
- **Replace a photo:** photos come in two crops, one for desktop (for example
  `public/images/hero.webp`) and one for mobile (`public/images/hero-mobile.webp`),
  and each crop comes in two sizes: a regular file and a sharper `-large`
  file (`hero.webp` and `hero-large.webp`). The page lists both in `srcset`
  and the browser picks the right one for the screen, so phones and normal
  screens get the small file and sharp (Retina) screens get the large one.
  Replace all four files, keeping the same pixel sizes and proportions as the
  files you replace so nothing is cropped oddly, and update the `alt` text to
  describe the new photo. Save as WebP, quality 80. Make the large file from
  the original photo, then shrink that to make the regular file (never
  enlarge a small photo). Keep regular files under about 45 KB and large
  files under about 75 KB. Do not change the `srcset` or `sizes` numbers
  unless the layout changes. Big images are the quickest way to lose the 100
  performance score.
- **Change a form's confirmation message:** the `data-success` attribute on
  the form. The waitlist form is on most pages, so change it on each one.

## Design rules

The layout matches the Figma file exactly at 390px (mobile) and 1440px
(desktop). Most numbers in `public/css/styles.css` come straight from Figma, including
decimals. Do not round them or "clean them up".

- Colors: use the tokens in `:root` (`--red`, `--black`, `--pink`, `--yellow`,
  `--vanilla`, `--blue`, `--ink`). Never add new hex values.
- Fonts: Be Vietnam Pro for text, Chewy for playful headings. The original
  Be Vietnam is used only for desktop button labels and mobile footer headings,
  because the design uses it there. No other fonts.
- Logo: never stretch, recolor, rotate or crop it.
- Voice: warm, playful, plain. Short sentences. American spelling.
- Reuse existing classes (`btn btn--primary`, `btn btn--secondary`,
  `hero__title`, `card__title`, and so on) rather than writing new styles.
- Font sizes, line heights and letter spacing are always in `rem`
  (1rem = 16px), never `px`, so text grows when visitors enlarge it.
- Every button label sits inside `<span class="btn__label">`. That span is
  what keeps the text exactly centered in the button, so copy a whole
  existing button when adding one.

## Accessibility and speed

The page scores 100 for performance, accessibility, best practices and SEO in
Lighthouse (mobile and desktop) and passes axe with no issues. Keep it there:

- Text must keep a contrast of at least 4.5:1 with its background. Some
  grays and reds are a touch darker than Figma for this reason
  (`--text-60`, `--red-on-vanilla`, `--placeholder`, the FAQ grays). Do not
  "fix" them back to the Figma values.
- Every image needs `alt` text. Decorative images use `alt=""`.
- Images below the first screen keep `loading="lazy"`. The hero photo must not
  be lazy.
- Links inside paragraphs stay underlined.
- Do not add third-party scripts, trackers, widgets or web fonts without
  asking first: each one costs speed and privacy.
- The fonts in `public/fonts/` are trimmed to Western European characters (English,
  Spanish, French and similar). If the client needs another language, say so
  before adding text in it.

## Motion

Animations live in the "Motion and interactions" section of
`public/css/styles.css` and in `public/js/main.js`. To animate something on any page, add an attribute in the
HTML; no new code is needed:

| Attribute | Effect |
| --- | --- |
| `data-reveal` | fades and rises into place the first time it scrolls into view |
| `data-reveal="pop"` | scales up with a small bounce (stickers, icons) |
| `data-reveal="swing"` | swings in from a tilt (illustrations) |
| `data-reveal="draw"` | an inline SVG line draws itself (the path needs `pathLength="1"`) |
| `data-reveal-stagger` | on a parent: its `data-reveal` children arrive one after another |

Buttons, cards, menu links and FAQ items already have hover and press effects.
Rules:

- Only animate `opacity` and `transform`. Never animate size or position
  properties (width, height, top, margin), which make the page jump.
- Nothing may loop forever or move for more than 5 seconds on its own.
- Everything must still work, fully visible, for visitors who turn on
  "reduce motion" on their device. The CSS handles this already.
- Keep it light: one effect per element, short and calm.

## Forms, Google Sheets and Slack

`src/` is the only server code. `src/worker.js` sends `/api/submit` to
`src/submit.js`, which checks the submission, adds it as a row to the client's
Google Sheet (`src/sheets.js`), and posts it to Slack. It uses secrets set in
Cloudflare: `SLACK_WEBHOOK_URL`, `GOOGLE_SERVICE_ACCOUNT_KEY` and
`GOOGLE_SHEET_ID`. Never write any of them, or the spreadsheet's address,
into a file, and never commit `.dev.vars` (it holds them for local testing
only).

Preview links don't get these secrets unless someone also added them under
**Previews Base** in Cloudflare, so on a preview the form may show its error
message instead of sending. That's expected. Check a form change after it is
published, and say so in your reply when the change touches a form.

Each form saves to its own spreadsheet tab. The website fills the first
columns (Submitted, each field, Page); the client uses the columns after them
for notes. Never change the order of the fields in `FORMS` for an existing
form: the spreadsheet columns would no longer match.

To add a form (for example a party inquiry):

1. Add an entry to `FORMS` in `src/submit.js` listing its fields and the
   `sheet` (tab name) it saves to. The first submission adds that tab to the
   spreadsheet with a header row, so there is nothing to set up there.
2. Give the `<form>` a matching `data-form="..."` attribute, include the hidden
   `fax_number` spam-trap field (copy it from the waitlist form; no real field
   may use that name), and add a `data-form-status` element after it. Put each
   radio or checkbox group in a `<fieldset>` with a `<legend>`, and give every
   other field a `<label for>`: error messages name the field by its label.
3. `public/js/main.js` already handles any form with a `data-form` attribute.
   A checkbox group arrives as one value with the ticked choices separated by
   commas.
4. A new form only saves after it is published (see the note on preview links
   above). After publishing, ask the client to send one test entry and check
   that it reached Slack and the spreadsheet.

## Adding a page

Copy `public/index.html` to a new file in `public/` named after the address
(for example `public/our-story.html` serves `/our-story`), keep the `<header>`
and `<footer>`, and
replace what is inside `<main>`. Add `data-reveal` attributes to the new
sections (see Motion).

Put styles used only by the new page in a new file in `public/css/pages/`,
linked right after `/css/styles.css`. Then add the page to the menu and footer
on every page. "Book a party" buttons go to `/book-a-party#book` (the inquiry
form). Any address that does not exist shows the friendly `public/404.html`
page.

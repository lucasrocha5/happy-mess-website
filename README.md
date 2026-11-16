# Happy Mess website

The Happy Mess homepage: plain HTML, CSS and JavaScript, hosted on
Cloudflare's free plan, plus a few lines of server code that save form
submissions to the client's Google Sheet and post them to Slack. There is no
build step.

## Files

```
public/               Everything visitors download
  index.html          The homepage. All the text lives here.
  404.html            Shown for any address that doesn't exist
  css/styles.css      All styles. Brand colors are at the top.
  js/main.js          Mobile menu, waitlist form, buttons that jump to the form, animations
  images/             Photos, illustrations, logo, favicon, link preview image
  fonts/              Be Vietnam Pro, Be Vietnam and Chewy, self-hosted and trimmed to Western European characters (English, Spanish, French and similar)
  robots.txt          Lets search engines index the site
  _headers            Caching rules (fonts are kept for a year)
src/worker.js         Sends /api/submit to the form code; anything else to public/ (or the 404 page)
src/submit.js         Receives form submissions, saves them to Google Sheets, posts them to Slack
src/sheets.js         Signs in to Google and adds a row to the spreadsheet
wrangler.jsonc        Cloudflare settings
package.json          Pins the Cloudflare command line tool (Wrangler)
CLAUDE.md             Editing guide for AI agents
```

## Quality bar

At handover the page scores 100 in Lighthouse for performance, accessibility,
best practices and SEO on mobile and desktop, has no axe issues, and every
font size is in `rem`. Animations respect the visitor's "reduce motion"
setting. `CLAUDE.md` lists the rules that keep it that way.

## How the client updates the site

The client asks for changes in plain language in the Claude app's Code tab
(or at claude.ai/code), using their own paid Claude plan with this repository
connected. Claude follows `CLAUDE.md`: it makes the change, replies with
the preview link, and publishes (merges into `main`) only when the
client says so. The client never needs to open GitHub.

Setup: in the client's Claude account, connect GitHub and give the Claude
GitHub App access to this repository.

## What it costs

Nothing. Cloudflare's free plan allows business sites. Requests for files in
`public/` are free and unlimited. Only form submissions and unknown addresses
run the code in `src/`, and the free plan covers 100,000 of those a day.

## Preview locally

Run `npm install` once, then `npm run dev` and open <http://localhost:8787>.
To test the form, copy `.dev.vars.example` to `.dev.vars` and fill in the
Slack and Google values (see the sections below). `.dev.vars` is never
committed.

To check layout only, you can also open `public/index.html` straight in a
browser. The form won't send from there.

## Deploy on Cloudflare (one time)

1. Push this folder to a GitHub repository in the client's GitHub organization.
2. In the client's Cloudflare dashboard, open **Workers & Pages**, create an
   application and import the GitHub repository. Keep the suggested
   settings: no build command, deploy command `npx wrangler deploy`.
3. In the Worker's **Settings > Build**, make sure preview builds are on, with
   the Preview command `npx wrangler preview`. Every pushed branch then gets a
   preview link: `https://BRANCH-happy-mess-website.SUBDOMAIN.workers.dev`,
   where SUBDOMAIN is the account's workers.dev subdomain (shown on the
   Worker's overview page). Update the link in step 3 of "Preview, then
   publish" in `CLAUDE.md` to the client's subdomain (it is `uttr` while the
   site runs on UTTR's test account). Cloudflare may also post the link as a
   comment on the pull request; in UTTR's test this did not happen, so
   `CLAUDE.md` does not depend on it.
4. Add the Slack and Google secrets (sections below).
5. Add the client's domain to the same Cloudflare account (free; the
   registrar's nameservers are switched to Cloudflare's). Then, in the
   Worker's **Settings > Domains & Routes**, add it as a Custom Domain.

From then on, every change merged into `main` goes live automatically.

## Connect the form to Slack

1. Go to <https://api.slack.com/apps>, choose **Create New App > From scratch**
   and pick the client's workspace.
2. Open **Incoming Webhooks**, turn it on, and choose **Add New Webhook to
   Workspace**. Pick the channel for website messages.
3. Copy the webhook address (it starts with `https://hooks.slack.com/`).
4. In Cloudflare, open the Worker's **Settings > Variables and Secrets**, keep
   **Production** selected, and add a **Secret** named `SLACK_WEBHOOK_URL`
   with that address.
5. Optional: to let the form send from preview links too, switch the same
   section to **Previews Base** and add the secret there as well (or run
   `npx wrangler preview base-config secret put SLACK_WEBHOOK_URL`). Previews
   do not copy production secrets. Use a test channel if preview signups
   should stay out of the real one.

Treat the webhook address like a password: anyone who has it can post to the
channel. Never commit it to the repository. Until it is set, the form shows
its error message and nothing is sent.

## Save submissions to Google Sheets

Every submission is also added as a row to a Google Sheet that the client
owns. The website signs in to Google with its own robot account (a Google
Cloud "service account"), so it keeps working after UTTR is removed from the
spreadsheet. If saving fails, the submission still reaches Slack with a note
asking for it to be added by hand.

The spreadsheet template is "Happy Mess website submissions" in UTTR's Google
Drive. Each form has its own tab (Waitlist for now; new forms get theirs
automatically). Columns A to C are filled by the website (Submitted, Email,
Page); column D onwards is free for the client's notes. The "How it works" tab
explains this to the client.

One-time setup:

1. **The client's copy.** The client opens the template's copy link
   (`https://docs.google.com/spreadsheets/d/<template id>/copy`), clicks
   **Make a copy**, and shares the copy with admin@uttr.com as Editor. The
   copy belongs to them. (Google Workspace accounts can't hand file ownership
   to someone outside their organization, so the client makes the copy rather
   than UTTR transferring it.)
2. **Time zone.** In the client's copy, set **File > Settings > Time zone** to
   the studio's time zone. The website writes times in whatever zone the
   spreadsheet uses.
3. **The robot account.** It lives in the client's own Google Cloud project,
   so it keeps working after handover. The client signs in to
   [Google Cloud](https://console.cloud.google.com) with the Google account
   that owns their spreadsheet copy, creates a project named "Happy Mess
   website" and adds admin@uttr.com as Owner (setup page, step 4). In that
   project, enable the **Google Sheets API**, then create a service account
   under **IAM & Admin > Service Accounts**. It needs no roles. Open it, go to **Keys > Add key > Create new
   key > JSON** and download the key file. If the client signed in with a
   Google Workspace account, their Cloud organization may be "secure by
   default" (organizations created since May 2024): it blocks adding outside
   emails (`iam.allowedPolicyMemberDomains`) and creating keys
   (`iam.managed.disableServiceAccountKeyCreation`). Either the client's
   Workspace admin relaxes those two policies for this project, or the
   project is created with a Gmail account the business controls.
4. **Share the sheet with the robot.** Share the client's copy with the
   service account's email (it ends in `iam.gserviceaccount.com`) as Editor.
5. **Secrets.** In the Worker's **Settings > Variables and Secrets**, add two
   Secrets:

| Name | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The whole contents of the JSON key file |
| `GOOGLE_SHEET_ID` | The ID in the client's copy's address: `docs.google.com/spreadsheets/d/<THIS PART>/edit` |

Then delete the downloaded key file. Treat it like a password: anyone with it
can edit the spreadsheet. To make preview links save rows too, add the same
secrets under **Previews Base** (ideally pointing at a test copy of the sheet).

**Handover:** the client removes admin@uttr.com from the spreadsheet's sharing
list and from the Google Cloud project. The robot account must stay as Editor
of the spreadsheet.

**Adding a form:** add an entry to `FORMS` in `src/submit.js` with a `sheet`
(tab) name. The first submission adds that tab to the spreadsheet with a bold
header row (Submitted, each field label in order, Page, Notes), dates as
yyyy-mm-dd hh:mm and a filter, like the Waitlist tab. Every form also posts
to the same Slack channel.

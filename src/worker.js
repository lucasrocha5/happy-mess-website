// The Happy Mess website on Cloudflare Workers.
//
// Every file in public/ is served by Cloudflare directly and never reaches this
// code. It only runs for addresses that are not a file:
// - /api/submit receives the website forms and posts them to Slack
// - anything else gets the friendly 404 page (public/404.html)

import { handleSubmit } from './submit.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/submit') return handleSubmit(request, env);
    return env.ASSETS.fetch(request);
  },
};

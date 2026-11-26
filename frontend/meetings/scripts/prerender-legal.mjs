// Write the privacy policy and terms as plain HTML pages after the build, so Google's verification check
// (and anyone without JavaScript) sees the full text at /privacy-policy and /terms-of-service.
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const dist = new URL('../dist/', import.meta.url)
const shell = await readFile(new URL('index.html', dist), 'utf8')

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const legal = await vite.ssrLoadModule('/src/Legal.tsx')

  const pages = [
    { file: 'privacy-policy.html', component: legal.PrivacyPage, title: 'Privacy policy · Genmars Meetings', description: 'How Genmars Meetings uses your information, including data from your Google account.' },
    { file: 'terms-of-service.html', component: legal.TermsPage, title: 'Terms of service · Genmars Meetings', description: 'The rules for using Genmars Meetings.' },
  ]
  for (const page of pages) {
    const body = renderToStaticMarkup(createElement(page.component))
    const html = shell
      // a plain document: no app script, so it never redirects to sign-in
      .replace(/<script type="module"[^>]*><\/script>\s*/g, '')
      .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
      // public, unlike the rest of the site
      .replace(/<meta name="robots"[^>]*>\s*/, '')
      .replace(/<!-- internal tool[^>]*-->\s*/, '')
      .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${page.description}"`)
      .replace('<body>', '<body class="theme-light">')
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    await writeFile(new URL(page.file, dist), html)
    console.log(`prerendered ${page.file}`)
  }
} finally {
  await vite.close()
}

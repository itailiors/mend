import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

declare const process: { env: Record<string, string | undefined> };

/**
 * Link-preview crawlers need an absolute og:image. When SITE_URL is set at build time
 * (e.g. the deploy URL), rewrite the final hashed og:image path onto it. Runs on the
 * emitted index.html because asset URLs are only resolved at bundle time.
 */
function absoluteOgImage(siteUrl: string | undefined): Plugin {
  return {
    name: 'mend-absolute-og',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = bundle['index.html'];
      if (!siteUrl || !html || html.type !== 'asset') return;
      const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
      html.source = String(html.source)
        .replace(
          /(<meta property="og:image" content=")\.?\/?([^"]+)"( ?\/?>)/,
          (_m, pre: string, path: string, end: string) =>
            `${pre}${base}${path}"${end}\n  <meta property="og:url" content="${base}"${end}\n  <link rel="canonical" href="${base}"${end}`,
        )
        .replace(
          /(<meta name="twitter:image" content=")\.?\/?([^"]+)"/,
          (_m, pre: string, path: string) => `${pre}${base}${path}"`,
        );
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}</loc></url>\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [absoluteOgImage(process.env.SITE_URL)],
  build: {
    target: 'es2020',
    sourcemap: false,
    // Badges are 512px PNGs: keep them as files, never inline them into the JS.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

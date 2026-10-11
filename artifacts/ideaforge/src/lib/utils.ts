import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isFullHtmlDocument(html: string): boolean {
  const trimmed = html.trim()
  return /<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildWebAppPreviewHtml(
  html: string,
  css: string,
  js: string,
  title: string,
): string {
  const trimmedHtml = html.trim()
  const safeTitle = escapeHtml(title)

  if (isFullHtmlDocument(trimmedHtml)) {
    let doc = trimmedHtml
    if (css.trim()) {
      const styleTag = `<style>${css}</style>`
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${styleTag}\n</head>`)
      } else {
        doc = `${styleTag}\n${doc}`
      }
    }
    if (js.trim()) {
      const scriptTag = `<script>${js}</script>`
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${scriptTag}\n</body>`)
      } else {
        doc = `${doc}\n${scriptTag}`
      }
    }
    return doc
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>${css}</style>
</head>
<body>
    ${trimmedHtml}
    <script>${js}</script>
</body>
</html>`
}

export function buildWebAppDownloadHtml(
  html: string,
  css: string,
  js: string,
  title: string,
): string {
  const trimmedHtml = html.trim()
  const safeTitle = escapeHtml(title)

  if (isFullHtmlDocument(trimmedHtml)) {
    let doc = trimmedHtml
    if (css.trim() && !/href=["'](?:\.\/)?style\.css["']/i.test(doc)) {
      const linkTag = `<link rel="stylesheet" href="style.css">`
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${linkTag}\n</head>`)
      } else {
        doc = `${linkTag}\n${doc}`
      }
    }
    if (js.trim() && !/src=["'](?:\.\/)?script\.js["']/i.test(doc)) {
      const scriptTag = `<script src="script.js"></script>`
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${scriptTag}\n</body>`)
      } else {
        doc = `${doc}\n${scriptTag}`
      }
    }
    return doc
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${css.trim() ? '<link rel="stylesheet" href="style.css">' : ''}
</head>
<body>
    ${trimmedHtml}
    ${js.trim() ? '<script src="script.js"></script>' : ''}
</body>
</html>`
}

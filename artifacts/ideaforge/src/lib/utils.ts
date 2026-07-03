import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isFullHtmlDocument(html: string): boolean {
  const trimmed = html.trim()
  return /<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}

export function buildWebAppPreviewHtml(
  html: string,
  css: string,
  js: string,
  title: string,
): string {
  const trimmedHtml = html.trim()
  if (isFullHtmlDocument(trimmedHtml)) {
    return trimmedHtml
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
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
  if (isFullHtmlDocument(trimmedHtml)) {
    return trimmedHtml
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    ${trimmedHtml}
    <script src="script.js"></script>
</body>
</html>`
}

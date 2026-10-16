# SQUEEZE ME — Live Website

A static, browser-based version of the SQUEEZE ME CustomTkinter app. It can be hosted free using **GitHub Pages**. Visitors can open the shared URL in a browser and use the image/PDF reducer and enhancer.

## Files

- `index.html` — website structure
- `styles.css` — responsive dark-red interface
- `app.js` — file selection, compression, enhancement and downloads

## Publish with GitHub Pages

1. Sign in at https://github.com/
2. Click **+** → **New repository**.
3. Name it `squeeze-me-website`; set it to **Public**.
4. Create the repository.
5. In the repository, click **Add file** → **Upload files**.
6. Upload `index.html`, `styles.css`, `app.js`, and `README.md` (upload the files themselves, not just the ZIP).
7. Click **Commit changes**.
8. Open **Settings** → **Pages**.
9. Under **Build and deployment**, select **Deploy from a branch**.
10. Select branch `main`, folder `/(root)`, then click **Save**.
11. Wait for GitHub Pages to finish publishing. Your public URL will look like:
    `https://YOUR-GITHUB-USERNAME.github.io/squeeze-me-website/`

Replace `YOUR-GITHUB-USERNAME` with your GitHub username. The exact URL is shown on the repository's **Settings → Pages** page.

## Local preview

You can open `index.html` in a browser, or use VS Code's Live Server extension and choose **Open with Live Server**.

## Features

- Reducer and Enhancer modes
- JPG/JPEG, PNG, WEBP and PDF input
- Image target-size compression (best effort)
- Image upscale and sharpness/contrast enhancement
- PDF compression and page enhancement
- Original/new size and size-change summary
- Download output file
- Responsive layout for phones, tablets and desktops
- Processing runs locally in the visitor's browser

## Important notes

- PDF processing uses PDF.js and jsPDF loaded from public CDNs, so an internet connection is required for those libraries.
- PDF export renders pages as images. This can remove selectable/searchable text, forms, links, bookmarks, and other interactive PDF features.
- Browser memory and file-size limits vary by device. Very large PDFs or images may fail on some phones/computers.
- Compression targets are best-effort; the app reports the resulting size rather than guaranteeing a specific size.
- This is a static website, so no server or database is required and files are not uploaded to a backend.

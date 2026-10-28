# BiUH Tee Lab (prototype)

Anyone can generate T-shirt designs for Hainan Island and BiUH from a shared asset catalogue.
An admin reviews the submissions and selects which ones get printed.

See [concept.md](concept.md) for the idea.

## Run it

Needs Node 22 or newer. Nothing to install.

```sh
npm start                   # http://localhost:3210
ADMIN_KEY=secret npm start  # change the admin key (default: biuh-admin)
```

- **Generator:** `http://localhost:3210`. Pick a style, colors and words, swap artwork, then submit.
- **Print desk:** `http://localhost:3210/admin`. Review, select for print, mark as printed, download print files, add assets.

## How it works

A design is stored as a small JSON **spec** (template, palette, shirt color, texts, chosen assets, random seed), not as an image.
Rendering happens in the browser. The admin's "Print PNG" re-renders the spec at 3600×4800 px (12×16" at 300 dpi) with fonts and assets embedded.
Any design can be reopened in the editor through its URL (`/#d=…`).

```
server.js              zero-dependency HTTP server + JSON API
data/designs.json      submissions (created on first submit, git-ignored)
catalogue/             the asset catalogue: catalogue.json + assets/*.svg|png
public/js/templates.js the 9 design templates (layout code + text presets)
public/js/render.js    spec → SVG, shirt mockup, random generator
public/js/style.js     palettes, shirt colors, fonts
public/js/export.js    print-ready SVG / PNG export
```

### Adding to the catalogue

Upload through the print desk, or put a file in `catalogue/assets/` and add an entry to `catalogue.json`.
Tags decide where an asset is offered first: `island`, `palm`, `coconut`, `rocket`, `heart`, `logo`, `star`, `decor`, `icon`.
With `recolor: true` the asset is printed as a one-color silhouette in the palette's ink, so single-color artwork works best.
Islands can carry `pins` (relative x/y positions) for the map template.

### Adding a template

Add an entry to `TEMPLATES` in `public/js/templates.js` with `fields` (text presets), `slots` (asset tags), and a `draw(t)` function that lays out from the top and returns the bottom y.
Each template borrows a *format* from well-known shirts and never copies the original artwork.

## Before printing anything for real

- `biuh-wordmark.svg` is a placeholder. The real logo needs the university's approval.
- Check the license of `coconut-palm.svg` (from Wikimedia Commons).
- The island outline comes from DataV.GeoAtlas boundary data. Products that show maps in China fall under map regulations, so a full China map should never be added to the catalogue.
- The fonts are open-license (SIL OFL) Google Fonts: Anton, Alfa Slab One, Pacifico, Graduate, Space Mono.

## Prototype limits

- The admin key is a single shared password and there are no user accounts.
- Submissions are stored in a JSON file, which is fine for a demo but not for many users at once.
- Chinese text uses the viewer's system font (PingFang SC / Noto Sans SC). A production render server should bundle a CJK font.

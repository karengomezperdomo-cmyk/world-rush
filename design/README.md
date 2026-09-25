# design/

Design deliverables for RUSH 7 (provisional name). Everything here is static: HTML, CSS, images and one tiny script. It is not
part of the Mini App build and it does not talk to World, Vercel or any server.

| Path                         | What it is                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `index.html`                 | The design board: every screen, layout comparison, palette, type, icons, sprites, maps, open questions |
| `overview.png`               | All screens on one image (made from `sheet.html`)                                                  |
| `screens/*.html`             | One mock per screen at 390 × 844; `screens/png/*.png` are their renders                            |
| `tokens.css`                 | Colours, fonts and layout variables (single source for the mocks)                                  |
| `ui.css`, `game.css`, `screens.css` | Components: shared UI, in-game HUD and controls, tab screens                                |
| `icons.js`                   | SVG icon sprite injected into each mock                                                            |
| `art/`                       | Provisional pixel art, **generated** by `tools/art` (do not edit by hand; see `art/manifest.json`) |
| `fonts/`                     | Jersey 15, Silkscreen, Chakra Petch (SIL Open Font License; texts in `fonts/licenses`)             |

## Commands

```bash
node tools/design/serve.mjs                 # board at http://localhost:4173
node tools/design/render.mjs                # re-render every screen to design/screens/png (uses the Edge/Chrome already installed)
node tools/design/render.mjs home           # only one screen
node tools/art/generate.mjs                 # regenerate all art (same output every time)
node tools/design/shot.mjs sheet.html design/overview.png 1930 full 1   # rebuild the overview image
```

## Conventions

- 1 art pixel = 2 CSS pixels. Frames get their pixel-notched corners from `.notch` (a `box-shadow` trick, colour in `--nb`).
- The `human` pill is a **placeholder** for World's official badge. Replace it, do not restyle it.
- Orange dashed boxes (`.anno`) are design notes, never UI.
- Replace any generated sprite with final art of the same size; the mocks pick it up unchanged.

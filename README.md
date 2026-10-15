# 地铁织城 Metro City

A procedural city where you draw the metro and the city grows around it.

## Commands

```bash
npm install
npm run dev      # dev server, reloads on save
npm run build    # → dist/index.html: one minified, self-contained file (~250 KB, ~90 KB gzip)
npm run check    # headless test of the game logic in Node (city generation, simulation, assistant)
```

`dist/index.html` runs on its own: double-click it, or upload it to any static host.

## Layout

```
index.html              page shell (panels, toolbar, dialogs)
src/main.js             entry: styles + game
src/styles.css          all styles
src/game/
  core/                 constants, zh/en/ja text, utilities, city generation
  sim/                  network, commute simulation, population growth, suggestions, achievements,
                        expansion, facilities and projects, express trains, road web,
                        quick estimate, build assistant, line planner
  ui/                   canvas rendering, camera, drawing lines, input, panels, report, rewards, save/load
scripts/game-scope.js   Vite plugin: joins src/game into one module
scripts/smoke.mjs       headless check used by `npm run check`
```

The game files share one scope (the city, the network and the simulation are read and written everywhere),
so `scripts/game-scope.js` joins them into a single ES module in folder order (core → sim → ui), then by
the number at the start of each file name. To add a file, give it a number that places it after everything it uses.

`window.__mc` exposes a small debugging API in the browser console (`__mc.newCity(seed)`, `__mc.adoptTop()`, …).

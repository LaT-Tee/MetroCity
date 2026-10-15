// The game modules share one scope (city state, the network, the simulation and the UI all read and write the same
// variables), so they are joined in folder order — core → sim → ui, then by file number — into one ES module.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GAME_DIR = fileURLToPath(new URL('../src/game', import.meta.url))

export function gameFiles(dir = GAME_DIR, only) {
  return readdirSync(dir).sort().flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return dir === GAME_DIR && only && !only.includes(name) ? [] : gameFiles(p)
    return name.endsWith('.js') ? [p] : []
  })
}

export function joinGame(only) {
  return gameFiles(GAME_DIR, only).map(f => `// ── ${relative(GAME_DIR, f)}\n` + readFileSync(f, 'utf8')).join('\n')
}

export function gameScope() {
  const ID = 'virtual:game', RID = '\0virtual:game'
  return {
    name: 'game-scope',
    resolveId(id) { if (id === ID) return RID },
    load(id) {
      if (id !== RID) return
      for (const f of gameFiles()) this.addWatchFile(f)
      return joinGame()
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(GAME_DIR)) { server.ws.send({ type: 'full-reload' }); return [] }
    },
  }
}

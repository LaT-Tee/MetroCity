// Headless check of the game logic (core + sim, no browser): generate a city, run the simulation,
// let the build assistant plan a few lines and make sure the network stays sane.
import vm from 'node:vm'
import { joinGame } from './game-scope.js'

const code = joinGame(['core', 'sim']) + `
;({ generate, initGrowth, runSim, analyze, assistJob, growthTick, projectsTick, relocate, newLine, newStation, smoothThrough, cleanup, stById,
   set: g => { G = g }, setSim: v => { sim = v }, setMonths: v => { months = v }, st: () => ({ stations, lines }) })`
const m = vm.runInNewContext(code, { console, performance, Math, Date, setTimeout })

const seed = +process.argv[2] || 35263, t0 = performance.now()
const G = m.generate(seed); m.set(G); m.initGrowth(); m.setMonths(0)
let sim = m.runSim(); m.setSim(sim); const base = sim.avg
let built = 0
for (let k = 1; k <= 36; k++) {
  m.setMonths(k); m.projectsTick(); m.growthTick(); m.relocate(0.03)
  if (k % 6) continue
  sim = m.runSim(); m.setSim(sim)
  const job = m.assistJob(m.analyze()); while (!job.step());
  const r = job.top.find(o => o.type === 'new' || o.type === 'ring'); if (!r) continue
  const L = m.newLine(); if (r.type === 'ring') L.loop = true
  for (const n of r.nodes) { const s = n.id != null ? m.stById(n.id) : m.newStation(n.x, n.y); if (s && !L.stops.includes(s.id)) L.stops.push(s.id) }
  m.smoothThrough(L); m.cleanup(); built++
  sim = m.runSim(); m.setSim(sim)
}
const { lines, stations } = m.st()
const ok = lines.length > 0 && stations.length > 0 && sim.avg < base
console.log(`seed ${seed}: ${built} lines planned, ${stations.length} stations, commute ${base.toFixed(1)} → ${sim.avg.toFixed(1)} min, ${((performance.now() - t0) / 1000).toFixed(1)} s`)
console.log(ok ? 'OK' : 'FAILED'); process.exit(ok ? 0 : 1)

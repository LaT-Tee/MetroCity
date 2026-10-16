/* ================= constants ================= */
const W = 600, H = 420, BS = (typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches)?4:5;
// playable area grows in stages; the whole world is generated once from the seed
const STAGES=[[100,70,500,350],[50,35,550,385],[0,0,600,420]], STAGE_AGENTS=[7000,9000,11000];            // grid cells; base raster px per cell
const CELL_KM = 0.15;                      // one cell = 150 m
const ST_COST = 4, TRACK_COST = 0.9;       // 亿 per station, per cell of track (reported, not limited)
const WALK_V = 0.65, WALK_F = 1.2, WALK_R = 11;
const METRO_V = 5.6, DWELL = 0.5, WAIT = 2.5, ALIGHT = 1;
const CAR_V = 4.4, CONG = 3.4, CAR_OVERHEAD = 5;
const N_AGENTS = 7000, MAX_LINES = 40;    // a real budget: the assistant plans with it (extend before adding), one colour per line
const LINE_COLORS = ['#2f55ff','#ff2d43','#18d83a','#ff8a00','#a100ff','#ff19d9','#00d5e8','#ffc400','#ff9ee9','#0b9a3c','#4677b0','#b1a03c','#b98ad6','#00a8f5','#5fbe6a','#a5784b','#2a8f7a','#1fb61f','#2c0a42','#ee9300','#8e1f45','#00897b','#d81b60','#5c6bc0','#8d6e63','#9e9d24','#e65100','#26c6da','#6a1b9a','#c9a227','#1565c0','#e57373','#2e7d32','#f48fb1','#00695c','#bf360c','#7cb342','#ba68c8','#546e7a','#0277bd'];
const STORE_KEY = 'mc-state-v5';

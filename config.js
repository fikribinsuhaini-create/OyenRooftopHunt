// ============================================================
//  OYEN ROOFTOP HUNT — config.js
//  Edit sini untuk customize semua benda
// ============================================================
const CONFIG = {

  // ── Saiz game canvas ─────────────────────────────────────
  // Tukar maxWidth untuk kawal berapa besar game kat web
  // 600 = kecil, 800 = sederhana, 1100 = besar penuh
  maxWidth      : 1280,  // resolution — naikkan kalau nak lebih tajam

  // ── Gameplay ─────────────────────────────────────────────
  startSpeed    : 280,
  maxSpeed      : 580,
  dashMult      : 1.75,
  jumpVel       : -530,
  doubleJumpVel : -650,
  gravity       : 950,

  // ── Lives ────────────────────────────────────────────────
  lives         : 10,
  invincibleTime: 1.5,    // saat invincible selepas kena

  // ── Extra life collectible ────────────────────────────────
  extraLife: {
    enabled   : true,          // hidupkan/matikan
    sprite    : null,          // null = lukis sendiri (bentuk ❤️)
                               // atau 'assets/heart.png'
    spawnEvery: 25,            // spawn setiap berapa meter distance
    color     : 0xff3366,      // warna kalau guna lukisan
  },

  // ── Obstacle hitbox ──────────────────────────────────────
  // 0.3 = lenient, 0.5 = standard, 0.8 = strict
  hitboxScale   : 0.45,

  // ── Obstacle spawn position ──────────────────────────────
  // Tukar nilai ni untuk adjust ketinggian obstacle
  obstacleY: {
    antenna    : -85,   // negatif = ke atas dari lantai
    watertank  : -58,
    ac         : null,  // null = auto (ikut stack height)
    clothesline: -115,
    pipe       : -46,

    // Custom sprite obstacles: positive = turun (fix gambar ada padding bawah)
    tongsampah : 16,
    tong       : 16,
    tayar      : 32,
  },

  // ── Obstacle sizes ───────────────────────────────────────
  obstacleSize: {
    antenna_w    : 14,
    antenna_h    : 85,
    watertank_w  : 46,
    watertank_h  : 58,
    ac_w         : 40,
    ac_h_per_stack: 28,  // tinggi setiap unit AC
    bird_w       : 36,
    bird_h       : 24,
    clothesline_w: 130,
    clothesline_h: 75,
    pipe_w       : 20,
    pipe_h       : 46,

    // Custom sprite obstacles
    tongsampah_w : 84,
    tongsampah_h : 84,
    tong_w       : 76,
    tong_h       : 76,
    tayar_w      : 74,
    tayar_h      : 74,
  },

  // ── Dash Energy ──────────────────────────────────────────
  energyMax     : 100,
  energyDrain   : 28,
  energyGain    : 22,

  // ── Custom Assets ────────────────────────────────────────
  catSprite : 'assets/oyen.png',

  background: {
    far  : null,   // 'assets/sky.png'   (800x400)
    mid  : null,   // 'assets/mid.png'   (800x400)
    floor: null,   // 'assets/floor.png' (800x80)
  },

  obstacles: {
    // Custom obstacle sprites (set path to enable)
    // Note: 'bird' removed (disabled)
    tongsampah : 'assets/tongsampah.png',
    tong       : 'assets/tong.png',
    tayar      : 'assets/tayar.png',
  },

  // Fish collectible sprites (random pick each spawn)
  fishSprites   : [
    'assets/tuna.png',
    'assets/tuna2.png',
    'assets/treats.png',
    'assets/treats2.png',
  ],
  fishSize      : { w: 90, h: 60 },

  // ── UI colours ───────────────────────────────────────────
  scoreColor    : '#ffe082',
  distColor     : '#b0c4ff',
  dashBarColor  : '#00e5ff',
  dashBarActive : '#ff8c00',

  // ── Mobile buttons ───────────────────────────────────────
  showButtons   : false,

  // Touch controls (phone)
  // kanan screen = dash (no jump), kiri screen = jump
  touch: {
    dashZoneX   : 0.62, // >62% width = dash zone
    holdDashMs  : 160,  // hold dekat kiri (fallback)
    swipeDashPx : 28,   // swipe kanan dekat kiri (fallback)
  },
};

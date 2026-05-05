'use strict';

const W=1280, H=640, GROUND_Y=512;
const FRAME_W=144, FRAME_H=96;

const COL={
  sky1:0x0d0d2b,sky2:0x1a1040,roofFloor:0x2d2250,roofEdge:0x5a4a9a,
  roofGlow:0x6040ff,neon:[0xff4fda,0x00e5ff,0xff6b2b],
  build1:0x1c1c3a,build2:0x251f45,buildEdge:0x3a2d6a,
  winOn:0xffe082,winOff:0x1a1535,fish:0x00e5ff,moon:0xfffde7,white:0xffffff,
};
const rnd =(a,b)=>Phaser.Math.Between(a,b);
const rndF=(a,b)=>Phaser.Math.FloatBetween(a,b);
const hexC=(h)=>Phaser.Display.Color.HexStringToColor(h).color;

// shorthand helpers to read CONFIG with fallback
const OY  = CONFIG.obstacleY    || {};
const OSZ = CONFIG.obstacleSize || {};

// ── BOOT ──────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}
  preload(){
    const bar=this.add.graphics();
    this.load.on('progress',v=>{
      bar.clear();
      bar.fillStyle(0x0e0830,1);bar.fillRect(0,0,W,H);
      bar.fillStyle(0xff4fda,1);bar.fillRect(W/2-150,H/2-8,300*v,16);
      bar.lineStyle(2,0x00e5ff,1);bar.strokeRect(W/2-152,H/2-10,304,20);
      bar.fillStyle(0xffffff,0.5);bar.fillRect(W/2-150,H/2-8,Math.max(0,300*v-2),5);
    });
    this.add.text(W/2,H/2+28,'Loading Oyen...',{fontFamily:'monospace',fontSize:'12px',fill:'#ffe082'}).setOrigin(0.5);
    this.load.image('sheet',CONFIG.catSprite);
    if(CONFIG.background.far)    this.load.image('bg_far',  CONFIG.background.far);
    if(CONFIG.background.mid)    this.load.image('bg_mid',  CONFIG.background.mid);
    if(CONFIG.background.floor)  this.load.image('bg_floor',CONFIG.background.floor);

    // Obstacles (dynamic keys)
    const obs=CONFIG.obstacles||{};
    for(const k of Object.keys(obs)){
      if(!obs[k]||k==='bird')continue;
      this.load.image('obs_'+k, obs[k]);
    }

    // Fish sprites (optional array)
    if(Array.isArray(CONFIG.fishSprites)&&CONFIG.fishSprites.length){
      CONFIG.fishSprites.forEach((p,i)=>{ if(p) this.load.image('fish_'+i, p); });
    }else if(CONFIG.fishSprite){
      this.load.image('fish_0', CONFIG.fishSprite);
    }
    if(CONFIG.extraLife&&CONFIG.extraLife.sprite) this.load.image('heart_img',CONFIG.extraLife.sprite);
  }
  create(){
    const src=this.textures.get('sheet').getSourceImage();
    ['idle','run1','run2','jump','dash1','dash2','dash3'].forEach((name,i)=>{
      const rt=this.textures.createCanvas(name,FRAME_W,FRAME_H);
      rt.getContext().drawImage(src,i*FRAME_W,0,FRAME_W,FRAME_H,0,0,FRAME_W,FRAME_H);
      rt.refresh();
    });
    const px=this.textures.createCanvas('px',2,2);
    px.getContext().clearRect(0,0,2,2);px.refresh();
    this.scene.start('Game');
  }
}

// ── GAME ──────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor(){super('Game');}

  init(){
    this.score     =0; this.distance=0; this.gameSpeed=CONFIG.startSpeed;
    this.alive     =true;
    this.lives     =CONFIG.lives;
    this.invTimer  =0;
    this.energy    =CONFIG.energyMax;
    this.isDashing =false; this.jumpCount=0;
    this.holdDash  =false; this.lastTap=0;
    this.diffTimer =0; this.spawnTimer=1.2; this.fishTimer=0.8;
    this.heartTimer=0;   // extra life spawn timer
    this.gScroll   =0; this.animFrame=0; this.animTimer=0;
    this.squash    =0; this.shake=0; this.grace=1.2;
    this.obstacles =[];this.fishes=[];this.hearts=[];
    this.buildings=[];this.particles=[];this._stars=null;
  }

  create(){
    this.physics.world.gravity.y=CONFIG.gravity;
    this.gBg =this.add.graphics().setDepth(0);
    this.gMid=this.add.graphics().setDepth(2);
    this.gFg =this.add.graphics().setDepth(4);
    this.gUi =this.add.graphics().setDepth(20);

    if(this.textures.exists('bg_far'))
      this.bgFar=this.add.tileSprite(W/2,H/2,W,H,'bg_far').setDepth(0).setScrollFactor(0);
    if(this.textures.exists('bg_mid'))
      this.bgMid=this.add.tileSprite(W/2,H/2,W,H,'bg_mid').setDepth(1).setScrollFactor(0);
    if(this.textures.exists('bg_floor'))
      this.bgFloor=this.add.tileSprite(W/2,GROUND_Y+(H-GROUND_Y)/2,W,H-GROUND_Y,'bg_floor').setDepth(3).setScrollFactor(0);

    // Ground
    this.gnd=this.physics.add.staticImage(W/2,GROUND_Y+20,'px');
    this.gnd.setAlpha(0).setDisplaySize(W*8,40).refreshBody();

    // Player
    this.cat=this.physics.add.sprite(130,GROUND_Y-38,'idle');
    this.cat.setDisplaySize(68,52).setDepth(10).setCollideWorldBounds(false);
    this.cat.body.setSize(38,34).setOffset(53,40);
    this.physics.add.collider(this.cat,this.gnd,()=>{
      if(this.jumpCount>0&&this.cat.body.velocity.y>60)this.squash=6;
      this.jumpCount=0;
    });

    // UI text
    const ts=(t,x,y,sz,c)=>this.add.text(x,y,t,{fontFamily:'monospace',fontSize:sz,fill:c,stroke:'#000022',strokeThickness:4}).setDepth(25);
    this.tScore=ts('SCORE  0', 16,10,'13px',CONFIG.scoreColor||'#ffe082');
    this.tDist =ts('DIST   0m',16,28,'11px',CONFIG.distColor ||'#b0c4ff');
    this.tDash =ts('DASH',     16,52,'9px', '#8888aa');

    // Float text pool
    this.ftPool=Array.from({length:12},()=>({
      obj:this.add.text(0,0,'',{fontFamily:'monospace',fontSize:'13px',fill:'#ffe082',stroke:'#000',strokeThickness:3}).setDepth(15).setAlpha(0),
      life:0
    }));

    // Keyboard
    this.space  =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cursors=this.input.keyboard.createCursorKeys();
    this.space.on('down',()=>this._jump());
    this.space.on('up',  ()=>{this.holdDash=false;});
    this.cursors.up.on('down',()=>this._jump());

    // Touch
    this._touchActive=false;this._holdTimer=null;
    this.input.on('pointerdown',(ptr)=>{
      this._touchActive=true;
      this._touchStartX=ptr.x;this._touchStartY=ptr.y;
      const now=this.time.now;
      if(now-this.lastTap<300&&this.jumpCount===1){
        this.cat.body.setVelocityY(CONFIG.doubleJumpVel);
        this.squash=-7;this.jumpCount=2;this._sndJump();
        for(let i=0;i<8;i++)this._part(this.cat.x,this.cat.y+18,rndF(-90,90),rndF(10,80),'#ffffff',0.8,0.35);
      } else { this._jump(); }
      this.lastTap=now;
      this._holdTimer=this.time.delayedCall(200,()=>{if(this._touchActive)this.holdDash=true;});
    });
    this.input.on('pointermove',(ptr)=>{
      if(!this._touchActive)return;
      if(ptr.x-this._touchStartX>40&&Math.abs(ptr.y-this._touchStartY)<60)this.holdDash=true;
    });
    this.input.on('pointerup',()=>{this._touchActive=false;this.holdDash=false;if(this._holdTimer)this._holdTimer.remove();});

    window._oyenScene=this;

    // Sprite layers for custom obstacles/fish (drawn above floor graphics)
    this.obSprites=[];
    this.fishSprites=[];
    try{this.actx=new(window.AudioContext||window.webkitAudioContext)();}catch(_){this.actx=null;}
    for(let x=0;x<W+300;x+=rnd(80,160))this._spawnBuilding(x);
  }

  // ── Audio ────────────────────────────────────────────────
  _beep(freq,dur,type,vol){
    if(!this.actx)return;
    try{
      const o=this.actx.createOscillator(),g=this.actx.createGain();
      o.connect(g);g.connect(this.actx.destination);
      o.type=type||'square';o.frequency.value=freq;
      g.gain.setValueAtTime(vol||0.13,this.actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,this.actx.currentTime+dur);
      o.start();o.stop(this.actx.currentTime+dur);
    }catch(_){}
  }
  _sndJump(){this._beep(300,.1,'square',.12);this._beep(500,.07,'sine',.08);}
  _sndFish(){[660,880,1100].forEach((f,i)=>this.time.delayedCall(i*38,()=>this._beep(f,.07,'sine',.14)));}
  _sndHeart(){this._beep(520,.08,'sine',.15);this._beep(780,.1,'sine',.12);}
  _sndHit(){this._beep(180,.15,'sawtooth',.2);this._beep(100,.2,'square',.15);}
  _sndDie(){[220,140,80].forEach((f,i)=>this.time.delayedCall(i*80,()=>this._beep(f,.18,'sawtooth',.18)));}

  // ── Jump ─────────────────────────────────────────────────
  _jump(){
    if(!this.alive||this.jumpCount>=2)return;
    this.cat.body.setVelocityY(this.jumpCount===0?CONFIG.jumpVel:CONFIG.doubleJumpVel);
    this.squash=this.jumpCount===0?-4:-7;
    this.jumpCount++;this._sndJump();
    if(this.jumpCount===2)
      for(let i=0;i<8;i++)this._part(this.cat.x,this.cat.y+18,rndF(-90,90),rndF(10,80),'#ffffff',0.8,0.35);
  }

  // ── Spawners ─────────────────────────────────────────────
  _spawnObstacle(){
    const cfgObs=CONFIG.obstacles||{};
    const types=Object.keys(cfgObs).filter(k=>cfgObs[k]&&k!=='bird');
    const fallback=['antenna','watertank','ac','clothesline','pipe'];
    const pool=types.length?types:fallback;
    const type=pool[Math.floor(Math.random()*pool.length)];
    const ob={type,x:W+130,y:0,w:0,h:0,dead:false,ex:{}};

    // Custom sprite obstacle (default: sit on ground)
    if(cfgObs[type]&&this.textures.exists('obs_'+type)){
      ob.w=OSZ[type+'_w']||76;
      ob.h=OSZ[type+'_h']||76;
      // allow per-sprite Y offset (many PNGs have transparent bottom padding)
      const yOff=(OY[type]===0||OY[type])?OY[type]:0;
      ob.y=GROUND_Y-ob.h+yOff;
      ob.ex.sprite=this.add.image(ob.x,ob.y,'obs_'+type).setOrigin(0,0).setDepth(6);
      ob.ex.sprite.setDisplaySize(ob.w,ob.h);
      this.obSprites.push(ob.ex.sprite);
      this.obstacles.push(ob);
      return;
    }

    switch(type){
      case 'antenna':
        ob.w=OSZ.antenna_w||14; ob.h=OSZ.antenna_h||85;
        ob.y=GROUND_Y+(OY.antenna||-85); ob.ex.dish=Math.random()>0.45;
        break;
      case 'watertank':
        ob.w=OSZ.watertank_w||46; ob.h=OSZ.watertank_h||58;
        ob.y=GROUND_Y+(OY.watertank||-58);
        break;
      case 'ac':
        ob.ex.stack=rnd(1,3); ob.w=OSZ.ac_w||40;
        ob.h=(OSZ.ac_h_per_stack||28)*ob.ex.stack;
        ob.y=GROUND_Y-ob.h;
        break;
      case 'clothesline':
        ob.w=OSZ.clothesline_w||130; ob.h=OSZ.clothesline_h||75;
        ob.y=GROUND_Y+(OY.clothesline||-115);
        ob.ex.h1=rnd(75,100); ob.ex.h2=rnd(50,74);
        break;
      case 'pipe':
        ob.w=OSZ.pipe_w||20; ob.h=OSZ.pipe_h||46;
        ob.y=GROUND_Y+(OY.pipe||-46);
        break;
    }
    this.obstacles.push(ob);
  }

  _spawnFish(){
    const f={x:W+70,y:rnd(GROUND_Y-125,GROUND_Y-46),bob:Math.random()*Math.PI*2,dead:false,ex:{}};
    const keys=[];
    if(Array.isArray(CONFIG.fishSprites)&&CONFIG.fishSprites.length){
      for(let i=0;i<CONFIG.fishSprites.length;i++) if(this.textures.exists('fish_'+i)) keys.push('fish_'+i);
    }else if(this.textures.exists('fish_0')) keys.push('fish_0');

    if(keys.length){
      const key=keys[Math.floor(Math.random()*keys.length)];
      f.ex.key=key;
      f.ex.sprite=this.add.image(f.x,f.y,key).setOrigin(0.5,0.5).setDepth(7);
      const fs=CONFIG.fishSize||{};
      f.ex.sprite.setDisplaySize(fs.w||54, fs.h||36);
      this.fishSprites.push(f.ex.sprite);
    }
    this.fishes.push(f);
  }

  // Extra life heart collectible
  _spawnHeart(){
    if(!CONFIG.extraLife||!CONFIG.extraLife.enabled)return;
    this.hearts.push({x:W+70,y:rnd(GROUND_Y-110,GROUND_Y-55),bob:Math.random()*Math.PI*2,dead:false});
  }

  _spawnBuilding(x){
    const h=rnd(70,210),w=rnd(65,150),col=Math.random()>0.5?COL.build1:COL.build2;
    const wins=[];
    for(let f=0;f<Math.floor(h/22);f++)
      for(let c=0;c<Math.floor(w/24);c++)
        if(Math.random()>0.28)wins.push({fx:6+c*24,fy:8+f*22,on:Math.random()>0.22});
    const neons=Math.random()>0.45?[{col:COL.neon[Math.floor(Math.random()*3)],y:rnd(0,h-24)}]:[];
    this.buildings.push({x,y:H-h-20,w,h,col,wins,neons});
  }

  _part(x,y,vx,vy,col,alpha,life){this.particles.push({x,y,vx,vy,col,alpha,life,ml:life});}

  _float(x,y,text,col){
    const slot=this.ftPool.find(s=>s.life<=0);if(!slot)return;
    slot.life=1.1;
    slot.obj.setStyle({fill:col||'#ffe082'});
    slot.obj.setText(text).setPosition(x,y).setAlpha(1);
  }

  // ── Update ───────────────────────────────────────────────
  update(_,delta){
    const dt=Math.min(delta/1000,0.05);
    this._drawAll();
    if(!this.alive)return;

    if(this.grace>0)    this.grace-=dt;
    if(this.invTimer>0) this.invTimer-=dt;

    this.diffTimer+=dt;
    if(this.diffTimer>=5){this.diffTimer=0;this.gameSpeed=Math.min(CONFIG.maxSpeed,this.gameSpeed+8);}

    const onGround=this.cat.body.blocked.down;
    if((this.cursors.right.isDown||this.space.isDown)&&onGround&&this.energy>0)this.holdDash=true;
    if(!this._touchActive&&!this.cursors.right.isDown&&!this.space.isDown)this.holdDash=false;

    this.isDashing=this.holdDash&&onGround&&this.energy>0;
    if(this.isDashing){
      this.energy=Math.max(0,this.energy-CONFIG.energyDrain*dt);
      if(this.energy===0)this.isDashing=false;
      this.shake=Math.min(this.shake+0.5,2.5);
      if(Math.random()<0.55)this._part(this.cat.x-20+Math.random()*10,this.cat.y+14+Math.random()*14,rndF(-80,-30),rndF(-15,15),'#ff8800',0.75,0.2);
    }

    const spd=this.gameSpeed*(this.isDashing?CONFIG.dashMult:1.0);
    if(this.bgFar)   this.bgFar.tilePositionX  +=spd*0.1*dt;
    if(this.bgMid)   this.bgMid.tilePositionX  +=spd*0.25*dt;
    if(this.bgFloor) this.bgFloor.tilePositionX+=spd*dt;

    this.gScroll   =(this.gScroll+spd*dt)%40;
    this.score    +=dt*2;
    this.distance +=spd*dt*0.1;

    // Move obstacles
    for(const ob of this.obstacles){
      ob.x-=spd*dt;
      if(ob.ex.sprite) ob.ex.sprite.x=ob.x;
    }
    this.obstacles=this.obstacles.filter(o=>{
      if(o.x>-220&&!o.dead)return true;
      if(o.ex&&o.ex.sprite){o.ex.sprite.destroy();o.ex.sprite=null;}
      return false;
    });

    for(const f of this.fishes){
      f.x-=spd*dt;f.bob+=dt*3.5;
      if(f.ex.sprite){ f.ex.sprite.x=f.x; f.ex.sprite.y=f.y+Math.sin(f.bob)*6; }
    }
    this.fishes=this.fishes.filter(f=>{
      if(f.x>-90&&!f.dead)return true;
      if(f.ex&&f.ex.sprite){f.ex.sprite.destroy();f.ex.sprite=null;}
      return false;
    });
    for(const h of this.hearts){h.x-=spd*dt;h.bob+=dt*2.5;}
    this.hearts=this.hearts.filter(h=>h.x>-90&&!h.dead);
    for(const b of this.buildings)b.x-=spd*0.24*dt;
    this.buildings=this.buildings.filter(b=>b.x>-165);
    const last=this.buildings[this.buildings.length-1];
    if(!last||last.x<W+50)this._spawnBuilding(W+80);

    // Spawn timers
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0){this._spawnObstacle();this.spawnTimer=rndF(0.85,2.1)*(CONFIG.startSpeed/spd)+0.12;}
    this.fishTimer-=dt;
    if(this.fishTimer<=0){this._spawnFish();this.fishTimer=rndF(0.55,1.5)*(CONFIG.startSpeed/spd)+0.1;}

    // Extra life spawn — every N meters
    if(CONFIG.extraLife&&CONFIG.extraLife.enabled){
      const interval=CONFIG.extraLife.spawnEvery||25;
      if(Math.floor(this.distance/interval)>Math.floor((this.distance-spd*dt*0.1)/interval)){
        // Only spawn if lives < max
        if(this.lives<CONFIG.lives) this._spawnHeart();
      }
    }

    // Obstacle collision
    if(this.grace<=0&&this.invTimer<=0){
      const px=this.cat.x,py=this.cat.y,hs=CONFIG.hitboxScale||0.45;
      for(const ob of this.obstacles){
        if(ob.dead)continue;
        const dx=Math.abs(px-(ob.x+ob.w/2))-(ob.w*hs+12);
        const dy=Math.abs(py-(ob.y+ob.h/2))-(ob.h*hs+8);
        if(dx<0&&dy<0){this._takeDamage();if(!this.alive)return;break;}
      }
    }

    // Fish collision
    for(const f of this.fishes){
      if(f.dead)continue;
      const fy=f.y+Math.sin(f.bob)*6;
      if(Math.abs(this.cat.x-f.x)<26&&Math.abs(this.cat.y-fy)<22){
        f.dead=true;this.score+=10;
        if(f.ex&&f.ex.sprite){f.ex.sprite.destroy();f.ex.sprite=null;}
        this.energy=Math.min(CONFIG.energyMax,this.energy+CONFIG.energyGain);
        this._float(f.x,fy-24,'+10');this._sndFish();
        for(let i=0;i<8;i++)this._part(f.x,fy,rndF(-70,70),rndF(-90,-20),'#00e5ff',0.9,0.5);
      }
    }

    // Heart (extra life) collision
    for(const h of this.hearts){
      if(h.dead)continue;
      const hy=h.y+Math.sin(h.bob)*5;
      if(Math.abs(this.cat.x-h.x)<28&&Math.abs(this.cat.y-hy)<24){
        h.dead=true;
        this.lives=Math.min(CONFIG.lives,this.lives+1);  // max = starting lives
        this._float(h.x,hy-28,'+1 ❤️','#ff3366');
        this._sndHeart();
        // Pink particle burst
        for(let i=0;i<10;i++)this._part(h.x,hy,rndF(-80,80),rndF(-100,-20),'#ff3366',1,0.6);
      }
    }

    // Particles & floats
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;p.alpha=Math.max(0,(p.life/p.ml)*0.9);}
    this.particles=this.particles.filter(p=>p.life>0);
    for(const s of this.ftPool){if(s.life<=0)continue;s.life-=dt;s.obj.y-=40*dt;s.obj.setAlpha(Math.max(0,s.life));}

    this.squash*=0.72;if(Math.abs(this.squash)<0.05)this.squash=0;
    this.shake *=0.80;

    // Cat flicker when invincible
    this.cat.setAlpha(this.invTimer>0&&Math.floor(this.invTimer*10)%2===0?0.3:1.0);

    // Animate
    this.animTimer+=dt;
    if(!onGround){this.cat.setTexture('jump');}
    else if(this.isDashing){
      const df=['dash1','dash2','dash3'];
      if(this.animTimer>0.055){this.animTimer=0;this.animFrame=(this.animFrame+1)%3;}
      this.cat.setTexture(df[this.animFrame]);
    }else{
      const rf=['run1','run2'];
      if(this.animTimer>0.11){this.animTimer=0;this.animFrame=(this.animFrame+1)%2;}
      this.cat.setTexture(rf[this.animFrame]);
    }
    const sy=this.squash<0?1+this.squash*0.025:1-this.squash*0.02;
    const sx=this.squash<0?1-this.squash*0.018:1+this.squash*0.01;
    this.cat.setScale(sx,sy);
  }

  _takeDamage(){
    this.lives--;this._sndHit();this.shake=4;
    for(let i=0;i<12;i++)this._part(this.cat.x,this.cat.y,rndF(-100,100),rndF(-120,-20),['#ff4400','#ffaa00','#ffffff'][i%3],1,0.6);
    if(this.lives<=0){this._die();}
    else{this.invTimer=CONFIG.invincibleTime;this._float(this.cat.x,this.cat.y-30,'-1 LIFE','#ff4444');}
  }

  _die(){
    if(!this.alive)return;
    this.alive=false;this._sndDie();
    for(let i=0;i<20;i++)this._part(this.cat.x,this.cat.y,rndF(-130,130),rndF(-160,-20),['#ff8800','#ff4400','#ffdd00','#ffffff'][i%4],1.0,0.9);
    this.cat.setVisible(false);
    this.time.delayedCall(700,()=>this.scene.launch('GameOver',{score:Math.floor(this.score),dist:Math.floor(this.distance)}));
  }

  // ── Draw ─────────────────────────────────────────────────
  _drawAll(){
    const tn=this.time.now*0.001;
    const shk=this.shake>0.15?{x:(Math.random()-0.5)*this.shake*2,y:(Math.random()-0.5)*this.shake}:{x:0,y:0};

    const g=this.gBg;g.clear();
    if(!this.bgFar){
      g.fillGradientStyle(COL.sky1,COL.sky1,COL.sky2,COL.sky2,1);g.fillRect(0,0,W,H);
      const mx=668,my=56;
      g.fillStyle(COL.moon,0.08);g.fillCircle(mx,my,54);g.fillStyle(COL.moon,0.15);g.fillCircle(mx,my,40);
      g.fillStyle(COL.moon,1);g.fillCircle(mx,my,29);
      g.fillStyle(0xf0e0b0,0.28);g.fillCircle(mx-7,my-6,6);g.fillStyle(0xf0e0b0,0.20);g.fillCircle(mx+9,my+7,4);
      if(!this._stars)this._stars=Array.from({length:70},()=>({x:Math.random()*W,y:Math.random()*H*0.62,r:Math.random()*1.4+0.3,ph:Math.random()*6.28}));
      for(const s of this._stars){const a=0.35+0.4*Math.sin(tn*0.9+s.ph);g.fillStyle(COL.white,a);g.fillCircle(s.x,s.y,s.r);}
    }

    const mg=this.gMid;mg.clear();
    if(!this.bgMid){
      for(const b of this.buildings){
        const bx=b.x+shk.x*0.3,by=b.y+shk.y*0.3;
        mg.fillStyle(b.col,1);mg.fillRect(bx,by,b.w,b.h);
        for(const w of b.wins){
          mg.fillStyle(w.on?COL.winOn:COL.winOff,w.on?0.9:0.4);mg.fillRect(bx+w.fx,by+w.fy,11,9);
          if(w.on){mg.fillStyle(COL.winOn,0.14);mg.fillRect(bx+w.fx-1,by+w.fy-1,13,11);}
        }
        mg.fillStyle(COL.buildEdge,1);mg.fillRect(bx-2,by,b.w+4,7);
        for(const n of b.neons){mg.fillStyle(n.col,0.22);mg.fillRect(bx+3,by+n.y-3,b.w-6,18);mg.fillStyle(n.col,0.88);mg.fillRect(bx+3,by+n.y,b.w-6,9);}
      }
    }

    const fg=this.gFg;fg.clear();
    if(!this.bgFloor){
      fg.fillStyle(COL.roofFloor,1);fg.fillRect(0,GROUND_Y,W,H-GROUND_Y);
      fg.fillStyle(COL.roofEdge,0.7);fg.fillRect(0,GROUND_Y,W,4);
      fg.fillStyle(COL.roofGlow,0.06);fg.fillRect(0,GROUND_Y,W,12);
      fg.lineStyle(2,0x3a2d60,0.5);
      for(let tx=-(this.gScroll%40)+shk.x;tx<W;tx+=40)fg.lineBetween(tx,GROUND_Y+shk.y,tx,GROUND_Y+14+shk.y);
    }else{fg.lineStyle(3,0x5a4a9a,0.8);fg.lineBetween(0,GROUND_Y,W,GROUND_Y);}

    for(const ob of this.obstacles){
      if(ob.dead)continue;
      if(ob.ex&&ob.ex.sprite){
        ob.ex.sprite.y=ob.y+shk.y;
        ob.ex.sprite.x=ob.x+shk.x;
      }else{
        this._drawOb(fg,ob,ob.x+shk.x,ob.y+shk.y,tn);
      }
    }

    // Fish (draw sprite if provided, else fallback vector fish)
    for(const f of this.fishes){
      if(f.dead)continue;
      const fx=f.x+shk.x,fy=f.y+Math.sin(f.bob)*6+shk.y;
      if(f.ex&&f.ex.sprite){
        f.ex.sprite.x=fx;
        f.ex.sprite.y=fy;
        continue;
      }
      fg.fillStyle(COL.fish,0.18);fg.fillCircle(fx,fy,20);fg.fillStyle(COL.fish,1);fg.fillEllipse(fx,fy,28,15);
      fg.fillStyle(0x00aacc,1);fg.fillTriangle(fx+14,fy,fx+23,fy-7,fx+23,fy+7);
      fg.fillStyle(COL.white,0.55);fg.fillEllipse(fx-5,fy-2,9,5);fg.fillStyle(0x002244,1);fg.fillCircle(fx+9,fy-1,2.5);
      if(Math.sin(tn*5+f.bob)>0.7){fg.fillStyle(COL.white,0.9);fg.fillCircle(fx+14,fy-10,1.5);}
    }

    // Extra life hearts (floating collectible)
    for(const h of this.hearts){
      if(h.dead)continue;
      const hx=h.x+shk.x, hy=h.y+Math.sin(h.bob)*5+shk.y;
      const hcol=CONFIG.extraLife.color||0xff3366;
      // Glow
      fg.fillStyle(hcol,0.2);fg.fillCircle(hx,hy,18);
      // Heart shape
      fg.fillStyle(hcol,1);
      fg.fillCircle(hx-5,hy-2,7);fg.fillCircle(hx+5,hy-2,7);
      fg.fillTriangle(hx-12,hy+2,hx+12,hy+2,hx,hy+16);
      // Shine
      fg.fillStyle(COL.white,0.4);fg.fillCircle(hx-3,hy-5,3);
      // Sparkle
      if(Math.sin(tn*4+h.bob)>0.6){fg.fillStyle(COL.white,0.9);fg.fillCircle(hx+10,hy-10,2);}
    }

    if(this.isDashing)for(let i=1;i<=5;i++){fg.fillStyle(0xff9900,0.11*(6-i));fg.fillEllipse(this.cat.x-i*13+shk.x,this.cat.y+shk.y,54-i*6,34-i*4);}
    for(const p of this.particles){fg.fillStyle(hexC(p.col),p.alpha);fg.fillCircle(p.x+shk.x,p.y+shk.y,3);}

    // UI
    const ui=this.gUi;ui.clear();
    this.tScore.setText('SCORE  '+Math.floor(this.score));
    this.tDist.setText ('DIST   '+Math.floor(this.distance)+'m');
    this.tDash.setText (this.isDashing?'DASH >>>':'DASH');

    // Lives (hearts) — top right
    for(let i=0;i<CONFIG.lives;i++){
      const hx=W-20-i*22, hy=26;
      const filled=i<this.lives;
      ui.fillStyle(filled?0xff3366:0x441122,filled?1:0.35);
      ui.fillCircle(hx-5,hy-2,6);ui.fillCircle(hx+5,hy-2,6);
      ui.fillTriangle(hx-11,hy+2,hx+11,hy+2,hx,hy+14);
      if(filled){ui.fillStyle(0xffffff,0.3);ui.fillCircle(hx-2,hy-5,2.5);}
    }

    // Dash bar
    const bx=16,by=55,bw=152,bh=10;
    ui.fillStyle(0x000000,0.55);ui.fillRoundedRect(bx-2,by-2,bw+4,bh+4,4);
    ui.fillStyle(0x111133,1);ui.fillRoundedRect(bx,by,bw,bh,3);
    const ef=this.energy/CONFIG.energyMax;
    const bc=this.isDashing?0xff8c00:ef>0.5?0x00e5ff:ef>0.25?0xffaa00:0xff4444;
    if(ef>0){ui.fillStyle(bc,1);ui.fillRoundedRect(bx,by,bw*ef,bh,3);}

    if(!this.alive){ui.fillStyle(0x000000,0.72);ui.fillRect(0,0,W,H);}
  }

  _drawOb(g,ob,ox,oy,tn){
    switch(ob.type){
      case 'antenna':
        g.fillStyle(0x9090a8,1);g.fillRect(ox+5,oy,4,ob.h);g.fillStyle(0xddddee,1);g.fillCircle(ox+7,oy+3,5);
        g.fillStyle(0xff2222,0.65+0.35*Math.sin(tn*4));g.fillCircle(ox+7,oy-3,3);
        g.fillStyle(0xaaaacc,1);g.fillRect(ox-7,oy+12,28,3);g.fillRect(ox-5,oy+26,24,2);g.fillRect(ox-3,oy+40,20,2);
        if(ob.ex.dish){g.fillStyle(0xccccdd,1);g.fillEllipse(ox-10,oy+10,22,12);g.fillStyle(0xaaaacc,1);g.fillRect(ox+1,oy+10,4,8);}
        break;
      case 'watertank':
        g.fillStyle(0x7a6aaa,1);g.fillRect(ox+6,oy+ob.h-26,5,26);g.fillRect(ox+ob.w-11,oy+ob.h-26,5,26);g.fillRect(ox+1,oy+ob.h-14,ob.w-2,4);
        g.fillStyle(0x9898b8,1);g.fillRect(ox,oy+16,ob.w,ob.h-30);g.fillStyle(0xb0b0cc,1);g.fillEllipse(ox+ob.w/2,oy+16,ob.w,26);
        g.fillStyle(0x8080a0,1);g.fillEllipse(ox+ob.w/2,oy+ob.h-14,ob.w,22);
        g.fillStyle(0x555570,0.45);g.fillRect(ox+2,oy+ob.h/2-3,ob.w-4,6);g.fillStyle(0xaa6633,0.28);g.fillRect(ox+ob.w*0.3,oy+20,3,ob.h-38);
        break;
      case 'ac':
        for(let s=0;s<ob.ex.stack;s++){
          const sy=oy+s*28;g.fillStyle(0x8898b8,1);g.fillRoundedRect(ox,sy,ob.w,26,4);
          g.fillStyle(0x6678a0,1);g.fillRoundedRect(ox+4,sy+5,14,16,3);
          g.lineStyle(1,0x99aabb,0.8);for(let l=0;l<4;l++)g.lineBetween(ox+22+l*4,sy+7,ox+22+l*4,sy+19);
          g.fillStyle(0xffffff,0.45);g.fillCircle(ox+ob.w-7,sy+7,2.5);
        }
        break;
      case 'bird':{
        const fl=Math.sin(ob.ex.flap)*13;
        g.fillStyle(0x3a3a5a,1);g.fillEllipse(ox+ob.w/2,oy+ob.h/2+4,ob.w-6,ob.h-4);
        g.fillStyle(0x4a4a6a,1);
        g.fillTriangle(ox,oy+ob.h/2+fl,ox+ob.w/2,oy+ob.h/2+2,ox+ob.w/2+2,oy+ob.h/2+fl);
        g.fillTriangle(ox+ob.w,oy+ob.h/2+fl,ox+ob.w/2,oy+ob.h/2+2,ox+ob.w/2-2,oy+ob.h/2+fl);
        g.fillStyle(0xffffaa,1);g.fillCircle(ox+ob.w/2+5,oy+ob.h/2+2,3);g.fillStyle(0x111111,1);g.fillCircle(ox+ob.w/2+6,oy+ob.h/2+2,1.5);
        g.fillStyle(0xffaa44,1);g.fillTriangle(ox+ob.w/2+9,oy+ob.h/2+3,ox+ob.w/2+15,oy+ob.h/2+2,ox+ob.w/2+9,oy+ob.h/2+7);
        break;}
      case 'clothesline':{
        g.fillStyle(0x888880,1);g.fillRect(ox,GROUND_Y-ob.ex.h1,6,ob.ex.h1);g.fillRect(ox+ob.w-6,GROUND_Y-ob.ex.h2,6,ob.ex.h2);
        g.fillStyle(0x666660,1);g.fillRect(ox-2,GROUND_Y-ob.ex.h1-5,10,7);g.fillRect(ox+ob.w-8,GROUND_Y-ob.ex.h2-5,10,7);
        g.lineStyle(2,0x999980,0.9);g.beginPath();
        for(let i=0;i<=24;i++){const lx=ox+i*(ob.w/24),sag=Math.sin(i/24*Math.PI)*18,ly=GROUND_Y-ob.ex.h1+(ob.ex.h1-ob.ex.h2)*(i/24)-sag*(ob.ex.h1/90);i===0?g.moveTo(lx,ly):g.lineTo(lx,ly);}
        g.strokePath();
        const cc=[0xff6b8a,0x6bc5ff,0xffd86b,0x8aff6b,0xff9966];
        for(let c=0;c<5;c++){
          const cx=ox+10+c*22,fi=c/24,sag=Math.sin(fi*Math.PI)*18,cly=GROUND_Y-ob.ex.h1+(ob.ex.h1-ob.ex.h2)*fi-sag*(ob.ex.h1/90)+2;
          g.fillStyle(cc[c%cc.length],0.9);g.fillRect(cx-5,cly,10,16);g.fillRect(cx-9,cly+2,5,9);g.fillRect(cx+4,cly+2,5,9);
        }
        break;}
      case 'pipe':
        g.fillStyle(0x7799aa,1);g.fillRect(ox,oy,ob.w,ob.h);g.fillStyle(0x557788,1);
        g.fillRect(ox-4,oy,ob.w+8,7);g.fillRect(ox-4,oy+ob.h-5,ob.w+8,7);
        g.fillStyle(0x88aabb,1);g.fillRect(ox+3,oy+8,6,ob.h-18);g.fillStyle(0xaa6633,0.25);g.fillRect(ox+ob.w*0.4,oy+10,3,ob.h-18);
        break;
    }
  }
}

// ── GAME OVER ────────────────────────────────────────────────
class GameOverScene extends Phaser.Scene {
  constructor(){super('GameOver');}
  init(data){this.fs=data.score||0;this.fd=data.dist||0;}
  create(){
    const cx=W/2,cy=H/2,g=this.add.graphics();
    g.fillStyle(0x000000,0.78);g.fillRect(0,0,W,H);
    g.fillStyle(0x0e0830,1);g.fillRoundedRect(cx-215,cy-145,430,290,18);
    g.lineStyle(3,0xff4fda,1);g.strokeRoundedRect(cx-215,cy-145,430,290,18);
    g.lineStyle(1,0x00e5ff,0.4);g.strokeRoundedRect(cx-211,cy-141,422,282,16);
    const t=(txt,x,y,sz,fill)=>this.add.text(x,y,txt,{fontFamily:'monospace',fontSize:sz,fill,stroke:'#000011',strokeThickness:4,align:'center'}).setOrigin(0.5).setDepth(5);
    t('GAME  OVER',cx,cy-112,'26px','#ff4fda');
    t('SCORE :  '+this.fs,cx,cy-64,'16px','#ffe082');
    t('DIST  :  '+this.fd+'m',cx,cy-38,'14px','#b0c4ff');
    const btn=this.add.graphics().setDepth(5);
    btn.fillStyle(0xff4fda,1);btn.fillRoundedRect(cx-105,cy+14,210,52,12);
    btn.fillStyle(0xffffff,0.1);btn.fillRoundedRect(cx-105,cy+14,210,26,12);
    t('RESTART',cx,cy+40,'15px','#ffffff');
    this.add.image(cx,cy+90,'idle').setDisplaySize(52,40).setOrigin(0.5).setDepth(5);
    t('tap or press any key',cx,cy+118,'9px','#445566');
    const doRestart=()=>{this.scene.stop('GameOver');this.scene.stop('Game');this.scene.start('Game');};
    this.add.zone(cx,cy+40,210,52).setInteractive().setDepth(6).on('pointerdown',doRestart);
    this.input.keyboard.on('keydown',doRestart);
    this.time.delayedCall(600,()=>this.input.on('pointerdown',doRestart));
  }
}

// ── LAUNCH ───────────────────────────────────────────────────
window._oyenGame = new Phaser.Game({
  type:Phaser.CANVAS,
  width:W, height:H,
  canvas:document.getElementById('gameCanvas'),
  backgroundColor:'#080818',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},
  scene:[BootScene,GameScene,GameOverScene],
});

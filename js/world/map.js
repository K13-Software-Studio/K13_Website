/* K13 Workbench World: the building. Tiles, rooms, objects, posts (where each person lives).
   One file, no dependencies. Coordinates are tiles (16 x 16 logical px); x grows east, y grows south.
   Exported as K13World.map. Object ids are a contract with decor.js and secrets.js (docs/WORKBENCH_WORLD.md).

   Object fields beyond the spec, all optional:
     fh      footprint height in tiles: only the bottom `fh` rows block movement and take the prompt (a tall
             cabinet is 3 tiles tall but stands on one row; you can walk behind it)
     layer   'floor' (rugs, mats: under everything), 'wall' (hangs on the wall rows) or default (y-sorted)
     act     'game' | 'toy' | 'look' | 'code' | 'door'
     look    one flavour line shown when nothing from secrets.js answers
   The sprite of an object fills w x h tiles; decor may draw a little above it. */
(function(){
"use strict";
var NS=window.K13World=window.K13World||{};
var MW=52, MH=34;

/* ---------- tiles ---------- */
var g=[], y, x;
for(y=0;y<MH;y++){ g[y]=[]; for(x=0;x<MW;x++) g[y][x]=" "; }
function box(x0,y0,x1,y1,ch){ for(var yy=y0;yy<=y1;yy++) for(var xx=x0;xx<=x1;xx++) g[yy][xx]=ch; }
/* the building: west wing, centre block, east wing (a T that is longer in the middle, so the front door has a stoop) */
box(0,0,15,28,"#"); box(16,0,35,32,"#"); box(36,0,51,31,"#");

var rooms=[
  {id:"studio",   name:"Studio floor", x:16,y:2, w:20,h:9},
  {id:"lounge",   name:"Lounge",       x:16,y:13,w:20,h:8},
  {id:"lobby",    name:"Lobby",        x:16,y:23,w:20,h:9},
  {id:"arcade",   name:"Arcade hall",  x:1, y:2, w:14,h:25},
  {id:"workshop", name:"Workshop",     x:37,y:12,w:14,h:18},
  {id:"backroom", name:"The War Room", x:37,y:2, w:14,h:8}
];
rooms.forEach(function(r){ box(r.x,r.y,r.x+r.w-1,r.y+r.h-1,"."); });
/* doorways. Walls between a north and a south room are two tiles thick, so a doorway there is two tiles deep. */
box(15,5,15,7,"d"); box(15,15,15,17,"d"); box(15,24,15,26,"d");      /* arcade <-> studio, lounge, lobby */
box(36,15,36,17,"d"); box(36,24,36,26,"d");                          /* workshop <-> lounge, lobby */
box(24,11,27,12,"d"); box(24,21,27,22,"d");                          /* studio <-> lounge <-> lobby */
/* the front door is a gap in the south wall; the engine keeps it shut (it is after hours) */
var BACKDOOR=[[43,10],[44,10],[43,11],[44,11]];

var tiles=g.map(function(r){ return r.join(""); });

/* ---------- objects ---------- */
var objects=[];
function roomAt(tx,ty){ for(var i=0;i<rooms.length;i++){ var r=rooms[i]; if(tx>=r.x&&tx<r.x+r.w&&ty>=r.y&&ty<r.y+r.h) return r.id; } return ""; }
function O(id,kind,x,y,w,h,o){
  o=o||{};
  var ob={id:id,kind:kind,x:x,y:y,w:w,h:h,solid:!!o.solid,label:o.label||"",room:""};
  if(o.fh) ob.fh=o.fh;
  if(o.layer) ob.layer=o.layer;
  if(o.act) ob.act=o.act;
  if(o.look) ob.look=o.look;
  if(o.game) ob.game=o.game;
  if(o.toy) ob.toy=o.toy;
  var fy=y+h-1;                               /* the room is read from the row the object stands on, or the row just below a wall piece */
  ob.room=roomAt(x,fy)||roomAt(x,fy+1)||roomAt(x,fy+2)||roomAt(x,fy-1);
  objects.push(ob); return ob;
}

/* games and toys, in the order of the classic page */
var games=[
  ["hardest13","The Hardest Ship"],["platform13","Ship Run"],["contra13","Run & Ship"],["race13","Fast Track 13"],["paper13","Bin It"],
  ["dx13","Debt Breaker"],["rope13","Cut the Scope"],["haxball13","K13 Kickoff"],["duo13","Design & Code"],["bubble13","Scope Pop"],
  ["bloons13","Pop 13"],["worms13","Turf 13"],["goldminer13","Gold Rush 13"],["volfied13","Reveal 13"],["heli13","Deadline Run"]
];
var toys=["eggtoss","carlos","miramar","tide","egg","cengo","stack","sandwich","goldenhour","roof","eggcursor","pours","limewash","dumpling","angry13"];

/* --- arcade hall: three rows of five, each cabinet 2 wide, 3 tall, standing on its bottom row --- */
games.forEach(function(gm,i){
  var row=Math.floor(i/5), col=i%5;
  O("cab-"+gm[0],"cabinet",3+col*2,[2,8,14][row],2,3,{solid:true,fh:1,act:"game",game:gm[0],label:"Play "+gm[1],look:gm[1]+", an arcade cabinet."});
});
O("cab-secret","cabinet",2,20,2,3,{solid:true,fh:1,act:"look",label:"Look under the sheet",look:"A cabinet under a dust sheet. Somebody has been here."});
O("claw","fixture",10,21,2,3,{solid:true,fh:1,act:"look",label:"Look",look:"A claw machine. It only ever grabs lint, and everyone still tries."});
O("change-machine","fixture",14,18,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"The change machine. Free play, so it has nothing to change."});
O("scoreboard","fixture",4,0,3,2,{layer:"wall",act:"look",label:"Read the scoreboard",look:"HIGH SCORES. Every game keeps your best on this device, and nowhere else."});
O("neon-freeplay","fixture",8,1,3,1,{layer:"wall",act:"look",label:"Look",look:"FREE PLAY. No coins in this arcade, only time."});
O("window-1","fixture",1,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"The street is quiet. The studio is lit for the night."});
O("window-2","fixture",13,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"Rain on the glass, or something that looks like it."});

/* --- studio floor --- */
for(var d=0;d<8;d++){
  O("desk-"+(d+1),"desk",[17,22,27,32][d%4],d<4?4:8,2,2,{solid:true,act:"look",label:"Look at the desk",look:"A desk mid-task. The monitor is awake, the chair is still warm."});
}
O("whiteboard","fixture",21,0,3,2,{layer:"wall",act:"look",label:"Read the whiteboard",look:"A whiteboard covered in arrows, boxes and one very firm circle."});
O("printer","fixture",35,2,1,1,{solid:true,act:"look",label:"Look",look:"The printer. It works when nobody is watching."});
O("window-3","fixture",17,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"Streetlights, a few late windows, nobody in a hurry."});
O("window-4","fixture",28,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"The sky over the studio. Quiet, for once."});
O("window-5","fixture",32,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"A bus goes by and does not stop."});
O("plant-5","plant",16,2,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant that has outlived three deadlines."});
O("plant-6","plant",50,12,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant, dusted with sawdust."});

/* --- lounge --- */
O("rug","rug",18,15,7,4,{layer:"floor"});
O("bookshelf","fixture",17,12,2,2,{solid:true,fh:1,act:"look",label:"Browse the shelf",look:"Books on type, books on motion, one on knots."});
O("coffee","fixture",20,12,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"The coffee machine. It has opinions about the time of day."});
O("fishtank","fixture",31,12,2,2,{solid:true,fh:1,act:"look",label:"Watch the fish",look:"The fish swim in slow figure eights. They have never missed a deadline."});
O("records","fixture",34,13,1,1,{solid:true,act:"look",label:"Look",look:"A record player. Somebody left it on the last side."});
O("couch","furniture",19,16,3,2,{solid:true,act:"look",label:"Look",look:"A couch with a dent exactly where the best ideas happen."});
O("pinball","fixture",31,16,2,3,{solid:true,fh:2,act:"look",label:"Look",look:"A pinball table. The top score is a very smug three letters."});
O("plant-3","plant",17,19,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant, watered on schedule."});
O("plant-4","plant",34,19,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant leaning toward the fish tank."});

/* --- lobby --- */
O("rug-2","rug",21,29,10,3,{layer:"floor"});
O("counter","counter",23,26,6,2,{solid:true,act:"look",label:"Look",look:"The Masterminds' counter. Kazim and Gürkan run the place from here."});
O("guestbook","fixture",31,28,1,1,{solid:true,act:"look",label:"Open the guestbook",look:"The guestbook. Everyone who walked in has signed it."});
O("waitbench","furniture",17,28,2,2,{solid:true,fh:1,act:"look",label:"Look",look:"A waiting bench. Nobody has waited on it, because nobody has to."});
O("neon-k13","fixture",19,22,3,1,{layer:"wall",act:"look",label:"Look",look:"K13, in neon. It hums a little."});
O("poster-13","fixture",31,21,1,2,{layer:"wall",act:"look",label:"Look at the poster",look:"A poster with a very large number on it."});
O("plant-1","plant",17,23,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant by the door, greeting people."});
O("plant-2","plant",34,23,1,2,{solid:true,fh:1,act:"look",label:"Look",look:"A plant guarding the corner."});
O("door-front","door",25,31,2,2,{layer:"wall",act:"look",label:"Look at the door",look:"The front door. It is after hours: stay as long as you like, then come back tomorrow."});

/* --- workshop: sixteen slots of four, fifteen benches and the lathe --- */
toys.forEach(function(t,i){
  var row=Math.floor(i/4), col=i%4;
  O("bench-"+t,"bench",[38,41,44,47][col],[14,18,22,26][row],2,2,{solid:true,fh:1,act:"toy",toy:t,label:"Open the bench",look:"A workbench with a toy on it."});
});
O("lathe","fixture",47,26,2,2,{solid:true,fh:1,act:"look",label:"Look",look:"A lathe, still. The shavings on the floor are the only sign it ran today."});
O("pegboard","fixture",38,10,3,2,{layer:"wall",act:"look",label:"Look at the tools",look:"A pegboard of tools, each with its own outline. One outline is empty."});
O("radio","fixture",49,11,1,1,{layer:"wall",act:"look",label:"Look",look:"A radio on a shelf, tuned to nothing in particular."});
O("door-back","door",43,10,2,2,{layer:"wall",act:"door",label:"Try the door",look:"A steel door marked WAR ROOM. It is locked."});
O("keypad","fixture",46,11,1,1,{layer:"wall",act:"code",label:"Use the keypad",look:"A keypad beside the door."});

/* --- the war room (north-east, locked) --- */
O("window-6","fixture",38,0,2,2,{layer:"wall",act:"look",label:"Look outside",look:"A window onto the back street."});
O("screens","fixture",41,0,8,2,{layer:"wall",act:"look",label:"Look at the screens",look:"A wall of screens. The board is up on all of them."});
O("rug-3","rug",40,4,8,4,{layer:"floor"});

/* ---------- where people live ---------- */
function P(name,room,x,y,wander){ return {name:name,room:room,x:x,y:y,wander:wander}; }
var posts={
  kazim:    P("Kazim","lobby",25,25,[[24,24],[27,24]]),
  gurkan:   P("Gürkan","lobby",27,25,[[28,24],[25,24]]),
  jessica:  P("Jessica","lobby",18,26,[[18,27],[20,25],[19,26]]),
  ana:      P("Ana","lobby",33,29,[[32,30],[33,26],[34,28]]),
  james:    P("James","studio",25,7,[[20,7],[30,7],[25,10],[21,10]]),
  natalia:  P("Natalia","studio",18,6,[[19,6],[18,6]]),
  camila:   P("Camila","studio",23,6,[[24,6],[23,6]]),
  valentina:P("Valentina","studio",28,6,[[29,6],[28,6]]),
  selma:    P("Selma","studio",18,10,[[19,10],[18,10]]),
  gabi:     P("Gabi","studio",23,10,[[22,10],[23,10]]),
  leticia:  P("Leticia","studio",29,10,[[30,10],[33,10],[29,10]]),
  baha:     P("Baha","studio",22,3,[[21,3],[22,3]]),
  memotti:  P("Memotti","studio",24,3,[[25,3],[24,3]]),
  olga:     P("Olga","arcade",5,6,[[6,6],[8,7],[5,6],[12,7]]),
  kate:     P("Kate","arcade",9,12,[[8,12],[11,12],[6,13],[9,12]]),
  tony:     P("Tony (Gangaa)","lounge",31,19,[[30,19],[33,18],[31,19]]),
  gangaa:   P("Tony (Gangaa)","lounge",31,19,[[30,19],[33,18],[31,19]]),
  emre:     P("Emre","lounge",21,14,[[22,14],[19,14],[21,14]]),
  chefito:  P("Chefito","lounge",26,18,[[27,18],[24,17],[26,18]]),
  halodinho:P("Halodinho","lounge",33,15,[[34,14],[33,15],[32,14]]),
  mariana:  P("Mariana","lounge",18,18,[[18,19],[20,19],[19,19]]),
  nastiya:  P("Nastiya","workshop",44,21,[[43,21],[45,20],[44,21]]),
  fadil:    P("Fadil","workshop",40,17,[[41,17],[39,16],[40,17],[43,17]])
};
delete posts.gangaa;   /* one id for Tony; people.js may call him tony */
var postsOut={};
Object.keys(posts).forEach(function(k){ var p=posts[k]; postsOut[k]={x:p.x,y:p.y,room:p.room,wander:p.wander,name:p.name}; });

/* ---------- lamps (the engine glows them at night) ---------- */
var lights=[
  {x:26,y:6,r:9,c:"warm"},{x:20,y:6,r:6,c:"warm"},{x:32,y:6,r:6,c:"warm"},
  {x:26,y:16,r:9,c:"warm"},{x:32,y:12.5,r:5,c:"jade"},{x:21,y:12.5,r:3.5,c:"warm"},{x:35,y:13,r:3,c:"warm"},
  {x:26,y:28,r:9,c:"warm"},{x:20,y:22,r:4,c:"orange"},{x:30,y:22,r:3,c:"warm"},{x:26,y:31,r:3,c:"warm"},
  {x:7,y:6,r:8,c:"orange"},{x:7,y:12,r:8,c:"jade"},{x:7,y:18,r:8,c:"orange"},{x:10,y:1.5,r:5,c:"orange"},{x:6,y:1.5,r:4,c:"warm"},
  {x:44,y:17,r:9,c:"warm"},{x:44,y:25,r:9,c:"warm"},{x:41,y:12,r:4,c:"warm"},
  {x:45,y:5,r:8,c:"jade"}
];

/* ---------- validation helpers the engine and the tests share ---------- */
var map={
  w:MW,h:MH,tiles:tiles,
  legend:{"#":{wall:true,tile:"wall"},".":{floor:true,tile:"floor"},d:{floor:true,tile:"door"}," ":{solid:true,tile:"void"}},
  rooms:rooms,
  spawn:{x:25.5,y:30.4},                 /* the welcome mat, in tiles (feet position) */
  objects:objects,
  posts:postsOut,
  lights:lights,
  games:games.map(function(a){ return {id:a[0],title:a[1]}; }),
  toys:toys,
  backDoor:BACKDOOR
};
NS.map=map;
})();

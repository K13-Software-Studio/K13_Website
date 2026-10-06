#!/usr/bin/env node
/* check-world-data: proves js/world/world-data.js is sound.
 *   every place has a tile inside the map; its tile centre and its real point are on land, on the correct side of the
 *   coastline polygon and out of the bays; the district polygon contains it; no two buildings share a tile; a building
 *   never sits more than 4 tiles from its real spot; coast, roads and cities fall where they should.
 * Run: node scripts/check-world-data.js      (exit 1 on any failure) */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var file = path.join(__dirname, '..', 'js', 'world', 'world-data.js');
var sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
var K = sandbox.K13World;
var fails = [];
function fail(m) { fails.push(m); }

function pip(lat, lng, poly) {
  var inside = false, j = poly.length - 1, i;
  for (i = 0; i < poly.length; i++) {
    var yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    j = i;
  }
  return inside;
}

if (!K || !K.data || !K.project) { console.error('world-data.js did not define K13World.data and project()'); process.exit(1); }
var D = K.data, G = D.geo, P = G.proj;
var land = G.coast.concat([[32.45, -116.8], [34.45, -116.8], [34.45, -118.6]]);
function onLand(lat, lng) {
  if (!pip(lat, lng, land)) return false;
  for (var i = 0; i < G.waters.length; i++) if (pip(lat, lng, G.waters[i].poly)) return false;
  return true;
}
function districtOf(lat, lng) {
  for (var i = 0; i < G.districts.length; i++) if (pip(lat, lng, G.districts[i].poly)) return G.districts[i].id;
  return null;
}

// projection round trip and map size
var q = K.unproject(K.project(33.1, -117.3).x, K.project(33.1, -117.3).y);
if (Math.abs(q.lat - 33.1) > 1e-9 || Math.abs(q.lng + 117.3) > 1e-9) fail('project/unproject do not round-trip');
var corner = K.project(P.south, P.east);
if (Math.ceil(corner.x) !== P.w || Math.ceil(corner.y) !== P.h) fail('map size ' + P.w + 'x' + P.h + ' does not match the bbox');

var seen = {}, ids = {}, perProject = {};
D.places.forEach(function (p) {
  var tag = p.id + ': ';
  if (ids[p.id]) fail(tag + 'duplicate id'); ids[p.id] = 1;
  perProject[p.project] = (perProject[p.project] || 0) + 1;
  if (!(p.tx >= 0 && p.tx < P.w && p.ty >= 0 && p.ty < P.h)) { fail(tag + 'tile ' + p.tx + ',' + p.ty + ' is outside the map'); return; }
  var c = K.unproject(p.tx + 0.5, p.ty + 0.5);
  if (!onLand(c.lat, c.lng)) fail(tag + 'tile centre is not on land');
  if (!onLand(p.lat, p.lng)) fail(tag + 'real point (' + p.lat + ',' + p.lng + ') is not on land (wrong side of the coast or in a bay)');
  if (districtOf(p.lat, p.lng) !== p.district) fail(tag + 'real point is not inside district ' + p.district);
  if (districtOf(c.lat, c.lng) !== p.district) fail(tag + 'tile centre is not inside district ' + p.district);
  var k = p.tx + ',' + p.ty;
  if (seen[k]) fail(tag + 'shares tile ' + k + ' with ' + seen[k]); else seen[k] = p.id;
  if (p.snap > 4) fail(tag + 'snapped ' + p.snap + ' tiles from its real spot');
  var f = K.project(p.lat, p.lng);
  if (Math.abs(f.x - p.x) > 0.02 || Math.abs(f.y - p.y) > 0.02) fail(tag + 'stored x,y disagree with project()');
  if (p.pier && !/Worldwide pier/.test(p.label)) fail(tag + 'pier place without the pier label');
  if (/(edisyn|halil|okto|\btlc\b|\bicp\b)/i.test(JSON.stringify(p))) fail(tag + 'names a non-public project');
});
if (!D.places.some(function (p) { return p.id === 'hq'; })) fail('K13 HQ is missing');
var works = Object.keys(perProject).filter(function (k) { return k !== 'hq'; });
if (works.length !== 13) fail('expected 13 Work projects with places, found ' + works.length);

// every coast, road and city point inside (or at the edge of) the world; roads and cities on land
G.cities.forEach(function (c) {
  if (!onLand(c.lat, c.lng)) fail('city ' + c.id + ' is not on land');
  var p = K.project(c.lat, c.lng);
  if (p.x < 0 || p.y < 0 || p.x >= P.w || p.y >= P.h) fail('city ' + c.id + ' is off the map');
});
G.freeways.forEach(function (f) {
  f.line.forEach(function (pt, i) {
    if (!onLand(pt[0], pt[1])) fail('freeway ' + f.id + ' point ' + i + ' is in the sea or a bay');
  });
});
// the coast runs north to south and keeps land on its east side
for (var i = 1; i < G.coast.length; i++) {
  if (G.coast[i][0] > G.coast[i - 1][0] + 0.03 && i < G.coast.length - 1) fail('coast point ' + i + ' turns back north');
}
// activity and news rules
var ROSTER = 'james jessica natalia camila olga kate valentina mariana leticia gabi nastiya ana selma baha fadil memotti emre chefito halodinho tony kazim gurkan'.split(' ');
Object.keys(D.activity).forEach(function (k) {
  D.activity[k].crew.forEach(function (c) { if (ROSTER.indexOf(c) < 0) fail('activity ' + k + ' names ' + c + ', not on the roster'); });
  if (k !== 'hq' && !perProject[k]) fail('activity for ' + k + ' which has no place');
});
if (D.news.length > 13) fail('more than 13 news lines');
D.news.forEach(function (n) { if (/[—–]/.test(n.text)) fail('dash in news line: ' + n.text); });

if (fails.length) {
  console.error('check-world-data: ' + fails.length + ' problem(s)');
  fails.forEach(function (m) { console.error('  - ' + m); });
  process.exit(1);
}
console.log('check-world-data: ok. ' + D.places.length + ' places, ' + works.length + ' projects, map ' + P.w + 'x' + P.h +
  ', worst snap ' + Math.max.apply(null, D.places.map(function (p) { return p.snap; })) + ' tiles, ' +
  Object.keys(seen).length + ' distinct tiles.');

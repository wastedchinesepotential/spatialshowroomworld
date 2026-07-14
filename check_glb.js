const fs = require('fs'); 
const path = './public/assets/FLIGHT/flyingloop.glb'; 
const buf = fs.readFileSync(path); 
const length = buf.readUInt32LE(8); 
const chunkLength = buf.readUInt32LE(12); 
const jsonStr = buf.toString('utf8', 20, 20 + chunkLength); 
const json = JSON.parse(jsonStr); 
console.log('Animations:', json.animations ? json.animations.length : 0); 
if (json.animations) { 
  json.animations.forEach((a, i) => console.log('Anim', i, a.name, 'Tracks:', a.channels ? a.channels.length : 0)); 
}

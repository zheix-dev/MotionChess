// Motion Chess generated-code runtime.
// Generated code runs in a fresh Node VM with a tiny capability API and a hard timeout.
// It never receives process, require, filesystem, network, sockets, or the live server objects.
const vm = require('node:vm');
const crypto = require('node:crypto');

const MAX_CODE = 12000;
const MAX_OPS = 80;
const ALLOWED_ANIMATIONS = new Set(['flash','pulse','shake','projectile','explosion','transform','summon','beam','wave','fade','rise','fall','glow','teleport','fire','ice','lightning','custom']);

function executeGeneratedMotion({ code, match, playerId, username, motion }) {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, error: 'No generated motion program was supplied.' };
  if (code.length > MAX_CODE) return { ok: false, error: 'Generated program exceeds the size limit.' };
  if (!match.runtime) match.runtime = { entities: [], squareEffects: [], rules: [], animations: [], variables: {}, turn: 0 };
  const runtime = match.runtime;
  let operations = 0;
  const op = () => { if (++operations > MAX_OPS) throw new Error('Motion exceeded the operation limit.'); };
  const cleanText = (v, max=180) => String(v ?? '').slice(0,max);
  const api = Object.freeze({
    addRule(rule) { op(); runtime.rules.push({ id: crypto.randomUUID(), by: playerId, username, description: cleanText(rule?.description), trigger: cleanText(rule?.trigger), duration: cleanText(rule?.duration || 'match'), code: cleanText(rule?.code, 2000) }); },
    createEntity(entity) { op(); if (runtime.entities.length >= 32) throw new Error('Match entity limit reached.'); const e = { id: crypto.randomUUID(), owner: playerId, name: cleanText(entity?.name || 'Created piece',40), kind: cleanText(entity?.kind || 'custom',32), square: cleanText(entity?.square,2), movement: Array.isArray(entity?.movement) ? entity.movement.slice(0,12).map(x=>cleanText(x,40)) : [], abilities: Array.isArray(entity?.abilities) ? entity.abilities.slice(0,8).map(x=>cleanText(x,120)) : [], health: Math.max(1,Math.min(1000,Number(entity?.health)||1)), duration: cleanText(entity?.duration || 'match') }; runtime.entities.push(e); return e.id; },
    setSquareEffect(effect) { op(); if (runtime.squareEffects.length >= 64) throw new Error('Square effect limit reached.'); const square=cleanText(effect?.square,2); if (!/^[a-h][1-8]$/.test(square)) throw new Error('Invalid board square.'); runtime.squareEffects.push({ id:crypto.randomUUID(), square, owner:playerId, type:cleanText(effect?.type || 'custom',32), description:cleanText(effect?.description), duration:cleanText(effect?.duration || 'match'), trigger:cleanText(effect?.trigger) }); },
    animate(animation) { op(); const type=cleanText(animation?.type || 'custom',24); if(!ALLOWED_ANIMATIONS.has(type)) throw new Error('Unsupported animation primitive.'); if(runtime.animations.length>=100) runtime.animations.shift(); runtime.animations.push({ id:crypto.randomUUID(), type, target:cleanText(animation?.target,40), from:cleanText(animation?.from,8), to:cleanText(animation?.to,8), color:cleanText(animation?.color,24), durationMs:Math.max(100,Math.min(8000,Number(animation?.durationMs)||700)), description:cleanText(animation?.description) }); },
    setVariable(name,value) { op(); name=cleanText(name,40).replace(/[^a-zA-Z0-9_]/g,''); if(!name) throw new Error('Invalid variable name.'); runtime.variables[name]=typeof value==='number'?Math.max(-100000,Math.min(100000,value)):cleanText(value,160); },
    log(message) { op(); match.events.push('[Motion engine] '+cleanText(message)); },
    getTurn() { return runtime.turn; }
  });
  // The program must be an expression returning a function(api, context).
  const context = Object.freeze({ player: username, motion: cleanText(motion,3000), matchId: match.id, turn: runtime.turn, boardFen: match.fen });
  try {
    const sandbox = Object.create(null);
    sandbox.api = api; sandbox.context = context;
    const script = new vm.Script(`"use strict"; (${code})(api, context);`, { filename: 'ai-generated-motion.vm' });
    script.runInNewContext(sandbox, { timeout: 40, breakOnSigint: true });
    runtime.turn++;
    return { ok:true, operations, runtime };
  } catch (error) {
    return { ok:false, error:cleanText(error.message,240) };
  }
}
module.exports = { executeGeneratedMotion };

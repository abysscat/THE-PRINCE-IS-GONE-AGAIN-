/* Prince Game Audio Runtime V1 — optional overrides; all empty bindings preserve legacy audio. */
(() => {
  'use strict';
  const STORAGE_KEY = 'prince-game.audio-config.v1';
  const DEFAULTS = {
    schemaVersion: 1, configVersion: '1.0.0', activeProfileId: 'classic',
    settings: { masterVolume: 1, musicVolume: 1, sfxVolume: 1, musicEnabled: true, sfxEnabled: true },
    profiles: [{ id: 'classic', name: '原版音效', music: { title: '', chapters: {}, stages: {} }, sfx: {} }], customAssets: []
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  function safeRead() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; } }
  function getConfig() {
    const fileConfig = window.PRINCE_AUDIO_CONFIG && typeof window.PRINCE_AUDIO_CONFIG === 'object' ? window.PRINCE_AUDIO_CONFIG : {};
    const saved = safeRead();
    const fileTime = Date.parse(fileConfig.updatedAt || '') || 0, savedTime = Date.parse(saved?.updatedAt || '') || 0;
    // A deployed config file must win when this browser has no saved profile yet.
    // Once a local profile exists, the newest timestamp wins.
    const source = !saved ? fileConfig : (savedTime >= fileTime ? saved : fileConfig);
    const config = { ...clone(DEFAULTS), ...source };
    config.settings = { ...DEFAULTS.settings, ...(source.settings || {}) };
    const profiles = source.profiles || DEFAULTS.profiles;
    config.profiles = Array.isArray(profiles) && profiles.length ? profiles : clone(DEFAULTS.profiles);
    if (!config.profiles.some(p => p.id === config.activeProfileId)) config.activeProfileId = config.profiles[0].id;
    return config;
  }
  function activeProfile(config = getConfig()) { return config.profiles.find(p => p.id === config.activeProfileId) || config.profiles[0] || DEFAULTS.profiles[0]; }
  function getMusic(context = {}, legacyFallback = '') {
    const profile = activeProfile(); const music = profile.music || {};
    const stageId = String(context.stageId || ''); const chapter = String(context.chapter || '');
    const stage = stageId && music.stages ? music.stages[stageId] : undefined;
    const chapterTrack = chapter && music.chapters && music.chapters[chapter];
    // Explicit Audio Manager Stage override wins; otherwise respect a Stage Editor
    // per-stage track before the Chapter default, then fall back to legacy config.
    const stageEditorTrack = context.stageMusic || '';
    const src = (typeof stage === 'string' ? stage : stage?.src) || stageEditorTrack || (typeof chapterTrack === 'string' ? chapterTrack : chapterTrack?.src) || (context.title ? music.title : '') || legacyFallback;
    const stageVol = typeof stage === 'object' && stage ? stage.volume : undefined;
    const chapterVol = typeof chapterTrack === 'object' && chapterTrack ? chapterTrack.volume : undefined;
    const baseVol = Number.isFinite(Number(stageVol)) ? Number(stageVol) : Number.isFinite(Number(chapterVol)) ? Number(chapterVol) : null;
    const settings = getConfig().settings;
    return { src: src || legacyFallback, volume: baseVol, loop: typeof stage === 'object' && stage ? stage.loop !== false : context.loop !== false, enabled: settings.musicEnabled !== false };
  }
  function getSfxPath(key, legacyFallback = '') {
    const row = activeProfile().sfx || {}; const value = row[key];
    return (typeof value === 'string' ? value : value?.src) || legacyFallback;
  }
  function getSfxVolume(base = 1) { const s = getConfig().settings; return clamp(base, 0, 1) * clamp(s.masterVolume, 0, 1) * clamp(s.sfxVolume, 0, 1); }
  function getMusicVolume(base = 1) { const s = getConfig().settings; return clamp(base, 0, 1) * clamp(s.masterVolume, 0, 1) * clamp(s.musicVolume, 0, 1); }
  function createAudio(key, fallback, options = {}) {
    const category = options.category || 'sfx';
    const path = category === 'music' ? getMusic(options.context || {}, fallback).src : getSfxPath(key, fallback);
    const audio = new Audio(path); audio.preload = options.preload || 'auto';
    audio.loop = options.loop === true;
    audio.volume = category === 'music' ? getMusicVolume(options.volume ?? 1) : getSfxVolume(options.volume ?? 1);
    return audio;
  }
  const previewVoices = new Set();
  function playSfx(key, fallback, options = {}) {
    const config = getConfig(); if (config.settings.sfxEnabled === false) return null;
    const audio = createAudio(key, fallback, { ...options, category: 'sfx' });
    if (options.loop) audio.loop = true;
    previewVoices.add(audio);
    const cleanup = () => previewVoices.delete(audio);
    audio.addEventListener('ended', cleanup, { once: true }); audio.addEventListener('error', cleanup, { once: true });
    try { const p = audio.play(); if (p?.catch) p.catch(cleanup); } catch (_) { cleanup(); }
    return audio;
  }
  function stopAllSfx() { for (const audio of previewVoices) { try { audio.pause(); audio.currentTime = 0; } catch (_) {} } previewVoices.clear(); }
  function applyMusic(audio, context = {}, legacyFallback = '', baseVolume = 1) {
    if (!audio) return null;
    const row = getMusic(context, legacyFallback); const path = row.src;
    const url = new URL(path, document.baseURI).href;
    if (audio.src !== url) { audio.src = path; audio.load(); }
    audio.loop = row.loop !== false;
    audio.volume = getMusicVolume(row.volume == null ? baseVolume : row.volume);
    return row;
  }
  function saveConfig(config) {
    const next = { ...config, schemaVersion: 1, configVersion: '1.0.0', updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('prince:audio-config-updated', { detail: { config: next } }));
    try { const channel = new BroadcastChannel(STORAGE_KEY); channel.postMessage({ type: 'audio-config-updated', updatedAt: next.updatedAt }); channel.close(); } catch (_) {}
    return next;
  }
  function listTracks() {
    const staticTracks = Array.isArray(window.PRINCE_AUDIO_CATALOG) ? window.PRINCE_AUDIO_CATALOG : [];
    const custom = (getConfig().customAssets || []).map(asset => ({ id: asset.id, name: asset.name || asset.path, path: asset.path, custom: true }));
    const map = new Map(); [...staticTracks, ...custom].forEach(track => { if (track.path && !map.has(track.path)) map.set(track.path, track); });
    return [...map.values()];
  }
  window.PrinceAudioRuntime = { STORAGE_KEY, getConfig, activeProfile, getMusic, getSfxPath, getSfxVolume, getMusicVolume, createAudio, playSfx, stopAllSfx, applyMusic, saveConfig, listTracks };
})();

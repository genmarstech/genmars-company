const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

export const OPEN_EVENT = 'genmars:palette'
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

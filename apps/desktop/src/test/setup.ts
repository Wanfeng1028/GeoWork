import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
})

Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: () => 'blob:geowork-test'
})

Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: () => undefined
})

HTMLCanvasElement.prototype.getContext = (() => ({
  canvas: document.createElement('canvas'),
  fillRect: () => undefined,
  clearRect: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => undefined,
  createImageData: () => [],
  setTransform: () => undefined,
  drawImage: () => undefined,
  fillText: () => undefined,
  strokeText: () => undefined,
  createLinearGradient: () => ({
    addColorStop: () => undefined
  }),
  createPattern: () => null,
  save: () => undefined,
  restore: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  bezierCurveTo: () => undefined,
  quadraticCurveTo: () => undefined,
  closePath: () => undefined,
  stroke: () => undefined,
  translate: () => undefined,
  scale: () => undefined,
  rotate: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  measureText: () => ({ width: 0 }),
  transform: () => undefined,
  rect: () => undefined,
  clip: () => undefined
})) as unknown as typeof HTMLCanvasElement.prototype.getContext

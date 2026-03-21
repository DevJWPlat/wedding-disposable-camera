
const FALLBACK_API_BASE_URL = 'https://wedding-camera.jonny-whittle.workers.dev'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || FALLBACK_API_BASE_URL

console.log('API_BASE_URL:', API_BASE_URL)
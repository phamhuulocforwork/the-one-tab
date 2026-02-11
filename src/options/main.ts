import { mount } from 'svelte'
import App from './App.svelte'
import '../app.css'
import { initDarkMode } from '$lib/utils/theme'

// Initialize dark mode based on browser preference
initDarkMode()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

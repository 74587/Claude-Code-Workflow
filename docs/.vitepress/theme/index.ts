import DefaultTheme from 'vitepress/theme'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import DocSearch from './components/DocSearch.vue'
import DarkModeToggle from './components/DarkModeToggle.vue'
import CopyCodeButton from './components/CopyCodeButton.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import PageToc from './components/PageToc.vue'
import Layout from './layouts/Layout.vue'
import './styles/variables.css'
import './styles/custom.css'
import './styles/mobile.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app, router, siteData }) {
    // Register global components
    app.component('ThemeSwitcher', ThemeSwitcher)
    app.component('DocSearch', DocSearch)
    app.component('DarkModeToggle', DarkModeToggle)
    app.component('CopyCodeButton', CopyCodeButton)
    app.component('Breadcrumb', Breadcrumb)
    app.component('PageToc', PageToc)
  }
}

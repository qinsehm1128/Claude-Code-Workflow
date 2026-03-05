import DefaultTheme from 'vitepress/theme'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import DocSearch from './components/DocSearch.vue'
import DarkModeToggle from './components/DarkModeToggle.vue'
import CopyCodeButton from './components/CopyCodeButton.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import PageToc from './components/PageToc.vue'
import ProfessionalHome from './components/ProfessionalHome.vue'
import Layout from './layouts/Layout.vue'
// Demo system components
import DemoContainer from './components/DemoContainer.vue'
import CodeViewer from './components/CodeViewer.vue'
import PropsTable from './components/PropsTable.vue'
// Language switcher component
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import './styles/variables.css'
import './styles/custom.css'
import './styles/mobile.css'
import './styles/demo.css'

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
    app.component('ProfessionalHome', ProfessionalHome)
    // Register demo system components
    app.component('DemoContainer', DemoContainer)
    app.component('CodeViewer', CodeViewer)
    app.component('PropsTable', PropsTable)
    // Register language switcher component
    app.component('LanguageSwitcher', LanguageSwitcher)
  }
}

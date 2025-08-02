import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import FontAwesomeIcon from './plugins/fontawesome'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Register Font Awesome globally
app.component('FontAwesomeIcon', FontAwesomeIcon)

app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { NMessageProvider } from 'naive-ui'

import App from './App.vue'
import router from './router'
import FontAwesomeIcon from './plugins/fontawesome'
import { socketService } from './services/socket';

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Register Font Awesome globally
app.component('FontAwesomeIcon', FontAwesomeIcon)

// Wrap the App component with NMessageProvider
app.component('NMessageProvider', NMessageProvider)

socketService.connect();

app.mount('#app')

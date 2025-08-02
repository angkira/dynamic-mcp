import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { 
  // Navigation & UI
  faBars,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faTimes,
  faPlus,
  faArrowDown,
  faPaperPlane,
  faStop,
  faGear,
  faArrowRight,
  
  // Chat & Communication
  faComments,
  faComment,
  faMessage,
  
  // Actions
  faCopy,
  faRedo,
  faTrash,
  
  // AI & Tech
  faRobot,
  faLightbulb,
  faMagic,
  faBrain,
  
  // States
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

import {
  // Regular icons for subtle states
  faComment as faCommentRegular,
  faCopy as faCopyRegular,
} from '@fortawesome/free-regular-svg-icons'

// Add icons to the library
library.add(
  // Navigation & UI
  faBars,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faTimes,
  faPlus,
  faArrowDown,
  faPaperPlane,
  faStop,
  faGear,
  faArrowRight,
  // Chat & Communication
  faComments,
  faComment,
  faMessage,
  
  // Actions
  faCopy,
  faRedo,
  faTrash,
  
  // AI & Tech
  faRobot,
  faLightbulb,
  faMagic,
  faBrain,
  
  // States
  faSpinner,
  
  // Regular icons
  faCommentRegular,
  faCopyRegular,
)

export default FontAwesomeIcon
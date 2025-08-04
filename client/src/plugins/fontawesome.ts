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
  faEllipsisV,
  
  // Chat & Communication
  faComments,
  faComment,
  faMessage,
  
  // Actions
  faCopy,
  faRedo,
  faTrash,
  faEdit,
  
  // AI & Tech
  faRobot,
  faLightbulb,
  faMagic,
  faBrain,
  
  // States
  faSpinner,
  faCheckCircle,
  
  // MCP & Development
  faCodeBranch,
  faPlug,
  faClock,
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
  faEllipsisV,
  
  // Chat & Communication
  faComments,
  faComment,
  faMessage,
  
  // Actions
  faCopy,
  faRedo,
  faTrash,
  faEdit,
  
  // AI & Tech
  faRobot,
  faLightbulb,
  faMagic,
  faBrain,
  
  // States
  faSpinner,
  faCheckCircle,
  
  // MCP & Development
  faCodeBranch,
  faPlug,
  faClock,
  
  // Regular icons
  faCommentRegular,
  faCopyRegular,
)

export default FontAwesomeIcon